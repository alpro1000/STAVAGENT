/**
 * AI Classification API - Vercel Serverless Function
 * Proxies to concrete-agent Multi-Role API for intelligent BOQ classification
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONCRETE_AGENT_URL = process.env.CONCRETE_AGENT_URL || 'https://concrete-agent.onrender.com';

interface ClassifyRequest {
  items: Array<{
    id: string;
    kod: string;
    popis: string;
    popisFull?: string;
    mj?: string;
    mnozstvi?: number;
    cenaJednotkova?: number;
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

    // Build context for Multi-Role AI
    const itemDescriptions = items.map((item, i) =>
      `${i + 1}. [${item.kod}] ${item.popisFull || item.popis} (${item.mj || '?'})`
    ).join('\n');

    const prompt = `Klasifikuj následující položky stavebního rozpočtu do pracovních skupin.

Dostupné skupiny:
${WORK_GROUPS.join(', ')}

Položky k klasifikaci:
${itemDescriptions}

Pro každou položku vrať:
- číslo položky
- navrhovaná skupina
- jistota (0-100%)
- krátké zdůvodnění

Odpověz ve formátu JSON:
{
  "classifications": [
    {"index": 1, "skupina": "Beton-mostovka", "confidence": 95, "reasoning": "Betonová mostovka C30/37"}
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
      console.error('Multi-Role API error:', errorText);

      // Fallback to rule-based classification if AI fails
      const fallbackResults = items.map(item => classifyByRules(item));
      return res.status(200).json({
        success: true,
        results: fallbackResults,
        source: 'fallback_rules',
        warning: 'AI unavailable, used rule-based classification'
      });
    }

    const aiResponse = await response.json();

    // Parse AI response
    let classifications: ClassifyResult[] = [];

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
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Use fallback
      classifications = items.map(item => classifyByRules(item));
    }

    // Ensure all items have classifications
    const results = items.map((item, i) => {
      const aiResult = classifications.find(c => c.id === item.id);
      if (aiResult) return aiResult;

      // Fallback for missing items
      return classifyByRules(item);
    });

    return res.status(200).json({
      success: true,
      results,
      source: 'ai_multi_role',
      model: aiResponse.model || 'unknown'
    });

  } catch (error) {
    console.error('Classification error:', error);
    return res.status(500).json({
      error: 'Classification failed',
      message: error instanceof Error ? error.message : 'Unknown error'
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
