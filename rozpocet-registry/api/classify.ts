/**
 * AI Classification API - Vercel Serverless Function
 * Proxies to concrete-agent Multi-Role API for intelligent BOQ classification
 *
 * CLASSIFICATION RULES:
 * - Classifies ONLY main items (items with rowRole='main' or 'section')
 * - Subordinate items (PP/PSC/VV/A195/B5) provided as CONTEXT only
 * - Skupina assigned only to main items, subordinates inherit via cascade
 * - Returns model name and source for debugging
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONCRETE_AGENT_URL = process.env.CONCRETE_AGENT_URL || 'https://concrete-agent-1086027517695.europe-west3.run.app';

interface ClassifyRequest {
  items: Array<{
    id: string;
    kod: string;
    popis: string;
    popisFull?: string;
    mj?: string;
    mnozstvi?: number;
    cenaJednotkova?: number;
    rowRole?: 'main' | 'section' | 'subordinate' | 'unknown';
    subordinates?: Array<{
      popis: string;
    }>;
  }>;
  mode?: 'single' | 'batch';
}

interface ClassifyResult {
  id: string;
  skupina: string;
  confidence: number;
  reasoning: string;
}

// Work groups for classification
const WORK_GROUPS = [
  'Výkopy', 'Násypy', 'Zemní práce',
  'Základy', 'Piloty', 'Mikropiloty', 'Štětovnice',
  'Beton-mostovka', 'Beton-nosná konstrukce', 'Beton-spodní stavba', 'Beton-opěry', 'Beton-pilíře',
  'Výztuž', 'Předpínací výztuž',
  'Bednění',
  'Mostní ložiska', 'Mostní závěry', 'Odvodňovače', 'Zábradlí', 'Svodidla', 'Římsy',
  'Izolace', 'Hydroizolace',
  'Zkoušky', 'Geodézie',
  'Demolice', 'Přeložky IS', 'Dopravní značení', 'Ostatní'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, mode = 'batch' } = req.body as ClassifyRequest;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    console.log(`[AI Classification] 🚀 Starting classification for ${items.length} items (mode: ${mode})`);

    // Build context for Multi-Role AI
    const itemDescriptions = items.map((item, i) => {
      let desc = `${i + 1}. [${item.kod}] ${item.popisFull || item.popis} (${item.mj || '?'})`;

      // Add subordinate context if available
      if (item.subordinates && item.subordinates.length > 0) {
        const subContext = item.subordinates
          .map(sub => sub.popis)
          .filter(p => p && p.trim().length > 0)
          .join(' | ');
        if (subContext) {
          desc += `\n   Kontext podřízených řádků: ${subContext}`;
        }
      }

      return desc;
    }).join('\n\n');

    const prompt = `INSTRUKCE: Klasifikuj POUZE HLAVNÍ POLOŽKY stavebního rozpočtu do pracovních skupin.

DŮLEŽITÉ PRAVIDLA:
- Klasifikuj POUZE hlavní položky (s kódy URS/OTSKP/RTS)
- Podřízené řádky (PP/PSC/VV/A195/B5) jsou uvedeny jako KONTEXT pro lepší pochopení hlavní položky
- Podřízené řádky NIKDY neklasifikuj samostatně
- Pokud nemáš dostatečnou jistotu, vrať "unknown" a confidence=low
- Nikdy nerozhoduj pouze na základě přítomnosti kódu v řádku

Dostupné skupiny:
${WORK_GROUPS.join(', ')}

Hlavní položky k klasifikaci (s kontextem podřízených řádků):
${itemDescriptions}

Pro každou HLAVNÍ položku vrať:
- index: číslo položky (1-based)
- skupina: navrhovaná skupina nebo "unknown"
- confidence: jistota 0-100 (high=80+, medium=50-79, low=0-49)
- reasoning: krátké zdůvodnění (max 1 věta)

Odpověz ve formátu JSON:
{
  "classifications": [
    {"index": 1, "skupina": "Beton-mostovka", "confidence": 95, "reasoning": "Betonová mostovka C30/37, kontext potvrzuje materiál"}
  ]
}`;

    // Call concrete-agent Multi-Role API
    const response = await fetch(`${CONCRETE_AGENT_URL}/api/v1/multi-role/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'cost_estimator',
        question: prompt,
        context: {
          task: 'boq_classification',
          items_count: items.length
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Classification] Multi-Role API error:', response.status, errorText);

      // Fallback to rule-based classification if AI fails
      const fallbackResults = items.map(item => classifyByRules(item));
      console.log(`[AI Classification] ❌ AI failed, using fallback rules for ${items.length} items`);

      return res.status(200).json({
        success: true,
        results: fallbackResults,
        source: 'fallback_rules',
        model: 'rule-based',
        warning: 'AI unavailable, used rule-based classification'
      });
    }

    const aiResponse = await response.json();
    const modelUsed = aiResponse.model || aiResponse.metadata?.model || 'unknown';
    console.log(`[AI Classification] ✅ AI model used: ${modelUsed} for ${items.length} items`);

    // Parse AI response
    let classifications: ClassifyResult[] = [];
    let parseSuccess = false;

    try {
      // Extract JSON from AI response
      const responseText = aiResponse.answer || aiResponse.response || '';
      const jsonMatch = responseText.match(/\{[\s\S]*"classifications"[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        classifications = parsed.classifications.map((c: any, i: number) => ({
          id: items[c.index - 1]?.id || items[i]?.id,
          skupina: c.skupina,
          confidence: c.confidence || 80,
          reasoning: c.reasoning || ''
        }));
        parseSuccess = true;
        console.log(`[AI Classification] ✅ Parsed ${classifications.length} classifications from AI response`);
      } else {
        console.warn('[AI Classification] ⚠️ No JSON found in AI response, using fallback');
      }
    } catch (parseError) {
      console.error('[AI Classification] ❌ Failed to parse AI response:', parseError);
      // Use fallback
      classifications = items.map(item => classifyByRules(item));
      console.log(`[AI Classification] Using fallback rules for all ${items.length} items`);
    }

    // Ensure all items have classifications
    const results = items.map((item, i) => {
      const aiResult = classifications.find(c => c.id === item.id);
      if (aiResult) return aiResult;

      // Fallback for missing items
      return classifyByRules(item);
    });

    const finalSource = parseSuccess ? 'ai_multi_role' : 'fallback_rules_partial';
    console.log(`[AI Classification] 📊 Final results: ${results.length} items, source: ${finalSource}, model: ${modelUsed}`);

    return res.status(200).json({
      success: true,
      results,
      source: finalSource,
      model: modelUsed
    });

  } catch (error) {
    console.error('[AI Classification] ❌ Fatal error:', error);
    return res.status(500).json({
      error: 'Classification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      source: 'error'
    });
  }
}

// Fallback rule-based classification
function classifyByRules(item: ClassifyRequest['items'][0]): ClassifyResult {
  const text = (item.popisFull || item.popis || '').toLowerCase();
  const kod = (item.kod || '').toLowerCase();

  // Simple keyword matching
  const rules: Array<{ pattern: RegExp; skupina: string }> = [
    { pattern: /beton.*mostov|mostov.*beton|deska.*most/i, skupina: 'Beton-mostovka' },
    { pattern: /beton.*nosn|nosn.*konstrukc/i, skupina: 'Beton-nosná konstrukce' },
    { pattern: /beton.*spod|základ.*beton/i, skupina: 'Beton-spodní stavba' },
    { pattern: /opěr|opěra|křídl/i, skupina: 'Beton-opěry' },
    { pattern: /pilíř|sloup.*most/i, skupina: 'Beton-pilíře' },
    { pattern: /výztuž|armov|ocel.*beton|betonář/i, skupina: 'Výztuž' },
    { pattern: /předpín|kabely|lana.*předpín/i, skupina: 'Předpínací výztuž' },
    { pattern: /bedněn|šalov/i, skupina: 'Bednění' },
    { pattern: /výkop|hloub|jám/i, skupina: 'Výkopy' },
    { pattern: /násyp|zásyp|hutn/i, skupina: 'Násypy' },
    { pattern: /pilot|vrtan|hlubinn/i, skupina: 'Piloty' },
    { pattern: /mikropilot/i, skupina: 'Mikropiloty' },
    { pattern: /štětov|štětovnic/i, skupina: 'Štětovnice' },
    { pattern: /ložisk|elastomer/i, skupina: 'Mostní ložiska' },
    { pattern: /závěr.*most|dilat/i, skupina: 'Mostní závěry' },
    { pattern: /odvod|vpusť|žlab/i, skupina: 'Odvodňovače' },
    { pattern: /zábradl/i, skupina: 'Zábradlí' },
    { pattern: /svodidl/i, skupina: 'Svodidla' },
    { pattern: /říms/i, skupina: 'Římsy' },
    { pattern: /izolac|nátěr.*ochran/i, skupina: 'Izolace' },
    { pattern: /hydroizolac|asfalt.*pás/i, skupina: 'Hydroizolace' },
    { pattern: /zkouš|test|měřen/i, skupina: 'Zkoušky' },
    { pattern: /geodez|zaměř|vytýč/i, skupina: 'Geodézie' },
    { pattern: /demol|bourá|odstra/i, skupina: 'Demolice' },
    { pattern: /přelož|kabely.*přelož|inženýr.*sít/i, skupina: 'Přeložky IS' },
    { pattern: /značen|doprav.*značk/i, skupina: 'Dopravní značení' },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      return {
        id: item.id,
        skupina: rule.skupina,
        confidence: 70,
        reasoning: 'Rule-based classification'
      };
    }
  }

  return {
    id: item.id,
    skupina: 'Ostatní',
    confidence: 30,
    reasoning: 'No matching rule found'
  };
}
