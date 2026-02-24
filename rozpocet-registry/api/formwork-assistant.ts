/**
 * Formwork AI Assistant — Vercel serverless function
 *
 * Hybrid approach:
 *  1. Deterministic calculation of all numeric values (reliable)
 *  2. AI (Gemini 2.0 Flash) generates Czech explanation + contextual warnings
 *  3. Optional deep analysis via Claude Sonnet 4.6 (extended reasoning)
 *
 * POST /api/formwork-assistant
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Model configuration ────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
// gemini-2.0-flash is stable GA (Jan 2026). -exp was removed from public API.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
// claude-sonnet-4-6 is current as of Feb 2026 (claude-sonnet-4-5 → 4-6)
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

// ─── Domain types ───────────────────────────────────────────────────────────

export type ElementType  = 'zakl' | 'stena' | 'pilir' | 'strop' | 'mostovka';
export type Season       = 'summer' | 'spring_autumn' | 'winter' | 'frost';
export type ConcreteClass = 'C25_CEM1' | 'C30_CEM2' | 'C35_mostni' | 'C25_CEM3';
export type Workforce    = 'small_2' | 'medium_4' | 'large_6plus';

export interface FormworkAIRequest {
  element_type:    ElementType;
  celkem_m2:       number;
  sada_m2:         number;
  pocet_sad:       number;
  bednici_system:  string;     // e.g. "Frami Xlife"
  season:          Season;
  concrete_class:  ConcreteClass;
  workforce:       Workforce;
  deep_analysis?:  boolean;    // If true: use Claude Sonnet 4.6 instead of Gemini
}

export interface FormworkAIResponse {
  // Deterministic calculated values (always present, regardless of AI)
  pocet_taktu:          number;
  sada_m2_doporucena:   number;
  dni_na_takt:          number;
  dni_beton_takt:       number;
  dni_demontaz:         number;
  celkova_doba_dni:     number;
  billing_months:       number;
  // AI-generated explanation (may be null if AI key not configured)
  zduvodneni:    string | null;
  upozorneni:    string[];
  model_used:    string;
  temp_factor:   number;
  cement_factor: number;
}

// ─── Expert knowledge tables ────────────────────────────────────────────────

/** Base stripping time at +20°C per ČSN EN 13670 §8.5 */
const BASE_CURE_DAYS: Record<ElementType, number> = {
  zakl:    2,
  stena:   5,
  pilir:   7,
  strop:  21,
  mostovka: 28,
};

/** Temperature factor for curing time */
const TEMP_FACTOR: Record<Season, number> = {
  summer:       1.0,   // 20–25°C
  spring_autumn: 2.0,  // 10–15°C
  winter:       3.0,   // 5–10°C
  frost:        4.0,   // <5°C — additional heating required!
};

const TEMP_RANGE: Record<Season, string> = {
  summer:       '20–25°C',
  spring_autumn: '10–15°C',
  winter:       '5–10°C',
  frost:        '<5°C',
};

/** Cement type factor — slower setting = higher multiplier */
const CEMENT_FACTOR: Record<ConcreteClass, number> = {
  C25_CEM1:   1.0,   // CEM I 42.5R — fastest (most common for bridges)
  C30_CEM2:   1.2,   // CEM II/A 32.5 — slightly slower
  C35_mostni: 1.0,   // C35/45 bridge — usually CEM I 52.5R, fast
  C25_CEM3:   1.8,   // CEM III/A — slag cement, slow esp. in cold
};

const CEMENT_LABEL: Record<ConcreteClass, string> = {
  C25_CEM1:   'C25/30 CEM I 42.5R',
  C30_CEM2:   'C30/37 CEM II',
  C35_mostni: 'C35/45 mostní',
  C25_CEM3:   'C25/30 CEM III',
};

/** Assembly days per tact based on workforce */
const ASSEMBLY_DAYS: Record<Workforce, number> = {
  small_2:   3,    // 2 workers, no crane (Frami h≤1.8m manual)
  medium_4:  2,    // 4 workers + crane (standard Framax)
  large_6plus: 2,  // 6+ workers + crane (Framax velký, Framax 4.65m)
};

const WORKFORCE_LABEL: Record<Workforce, string> = {
  small_2:    '2 pracovníci (bez jeřábu)',
  medium_4:   '4 pracovníci + jeřáb',
  large_6plus: '6+ pracovníci + jeřáb',
};

const ELEMENT_LABEL: Record<ElementType, string> = {
  zakl:    'Základy, čela stěn',
  stena:   'Stěny, opěry, opěrné zdi',
  pilir:   'Pilíře, masivní opěry',
  strop:   'Stropní desky — spodní bednění',
  mostovka:'Mostovka (bridge deck)',
};

// ─── Deterministic calculation ──────────────────────────────────────────────

function calculate(req: FormworkAIRequest): Omit<FormworkAIResponse, 'zduvodneni' | 'upozorneni' | 'model_used'> {
  const pocet_taktu = req.sada_m2 > 0 ? Math.ceil(req.celkem_m2 / req.sada_m2) : 1;

  // Assembly days — Framax with crane can also be done in 1.5d (round up)
  const dni_na_takt = ASSEMBLY_DAYS[req.workforce];

  // Curing: base × temperature factor × cement factor, rounded up
  const tf = TEMP_FACTOR[req.season];
  const cf = CEMENT_FACTOR[req.concrete_class];
  const base = BASE_CURE_DAYS[req.element_type];
  const dni_beton_takt = Math.ceil(base * tf * cf);

  const dni_demontaz = req.element_type === 'strop' || req.element_type === 'mostovka' ? 2 : 1;

  // takt_per_set = takty / sady → calendar duration per set
  const takt_per_set = req.pocet_sad > 0 ? pocet_taktu / req.pocet_sad : pocet_taktu;
  const doba_bedneni = takt_per_set * dni_na_takt;
  const celkem_beton = takt_per_set * dni_beton_takt;
  const celkova_doba_dni = Math.ceil(doba_bedneni + celkem_beton + dni_demontaz);

  const billing_months = Math.max(1, celkova_doba_dni / 30);

  // Recommend adjusting kit size if sada_m2 > 60% of total (risk of insufficient kit)
  const sada_m2_doporucena =
    req.sada_m2 > req.celkem_m2 * 0.6 && req.celkem_m2 > 50
      ? Math.round(req.celkem_m2 * 0.4 * 10) / 10
      : req.sada_m2;

  return {
    pocet_taktu,
    sada_m2_doporucena,
    dni_na_takt,
    dni_beton_takt,
    dni_demontaz,
    celkova_doba_dni,
    billing_months,
    temp_factor: tf,
    cement_factor: cf,
  };
}

// ─── AI explanation builder ─────────────────────────────────────────────────

function buildPrompt(req: FormworkAIRequest, calc: ReturnType<typeof calculate>): string {
  const warnings: string[] = [];
  if (req.season === 'frost') warnings.push('MRÁZ (<5°C): povinné vytápění nebo zakrytí betonu');
  if (req.season === 'winter') warnings.push('ZIMA: riziko zmrznutí, zajistit minimální teplotu +5°C');
  if (req.element_type === 'strop' || req.element_type === 'mostovka') {
    warnings.push('Nosné spodní bednění: po odstranění nutno ponechat podbednění (re-propping) dle statika');
  }
  if (req.element_type === 'mostovka') {
    warnings.push('Mostovka: odstraňovat bednění postupně od středu k oporám (dle TP 102)');
  }
  if (calc.cement_factor > 1.5) {
    warnings.push('CEM III: pomalá hydratace, nepodceňujte dobu zrání zvláště v zimním období');
  }
  if (calc.sada_m2_doporucena !== req.sada_m2) {
    warnings.push(`Sada ${req.sada_m2} m² > 60% celkové plochy — zvažte menší sadu (doporučeno: ${calc.sada_m2_doporucena} m²)`);
  }
  if (req.workforce === 'large_6plus' && req.bednici_system.toLowerCase().includes('frami')) {
    warnings.push('Frami h≤1.8m nevyžaduje jeřáb — zvažte použití 2–4 pracovníků bez jeřábu');
  }

  return `Jsi expert na monolitické betonové konstrukce v ČR (mosty, opěry, pilíře).

VYPOČTENÝ PLÁN TAKTOVÁNÍ:
- Typ konstrukce: ${ELEMENT_LABEL[req.element_type]}
- Bednění: ${req.bednici_system}
- Celková plocha: ${req.celkem_m2} m² | Sada: ${req.sada_m2} m² | Sad: ${req.pocet_sad}
- Počet taktů: ${calc.pocet_taktu} (= ⌈${req.celkem_m2}/${req.sada_m2}⌉)
- Montáž/takt: ${calc.dni_na_takt} dní (${WORKFORCE_LABEL[req.workforce]})
- Zrání betonu: ${calc.dni_beton_takt} dní (${BASE_CURE_DAYS[req.element_type]}d × ${calc.temp_factor} teplota × ${calc.cement_factor.toFixed(1)} cement)
  Beton: ${CEMENT_LABEL[req.concrete_class]}, Teplota: ${TEMP_RANGE[req.season]}
- Finální demontáž: ${calc.dni_demontaz} dní
- Celková doba: ${calc.celkova_doba_dni} dní (min. ${Math.ceil(calc.billing_months)} měsíce fakturace)
${warnings.length > 0 ? '\nIDENTIFIKOVANÁ RIZIKA:\n' + warnings.map(w => '- ' + w).join('\n') : ''}

ÚKOL:
1. Napiš 2–3 věty česky vysvětlující výpočet a doporučení (zduvodneni).
2. Vytvoř seznam konkrétních upozornění pro stavbyvedoucího (upozorneni, 2–4 položky).

Vrať POUZE JSON:
{
  "zduvodneni": "<2-3 věty česky>",
  "upozorneni": ["<upozornění 1>", "<upozornění 2>"]
}`;
}

// ─── Gemini call ─────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<{ zduvodneni: string; upozorneni: string[] }> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const resp = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Gemini response');
  const parsed = JSON.parse(match[0]);
  return {
    zduvodneni: parsed.zduvodneni || '',
    upozorneni: Array.isArray(parsed.upozorneni) ? parsed.upozorneni : [],
  };
}

// ─── Claude call (deep analysis) ─────────────────────────────────────────────

async function callClaude(prompt: string): Promise<{ zduvodneni: string; upozorneni: string[] }> {
  if (!CLAUDE_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Claude ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text: string = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Claude response');
  const parsed = JSON.parse(match[0]);
  return {
    zduvodneni: parsed.zduvodneni || '',
    upozorneni: Array.isArray(parsed.upozorneni) ? parsed.upozorneni : [],
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body: FormworkAIRequest = req.body;

    // Validate required fields
    if (!body.element_type || !body.celkem_m2 || !body.sada_m2) {
      return res.status(400).json({ error: 'Missing required fields: element_type, celkem_m2, sada_m2' });
    }

    // Step 1: Deterministic calculation (always reliable)
    const calc = calculate(body);

    // Step 2: AI explanation (best-effort, falls back gracefully)
    let zduvodneni: string | null = null;
    let upozorneni: string[] = [];
    let model_used = 'none (deterministic only)';

    try {
      const prompt = buildPrompt(body, calc);
      if (body.deep_analysis && CLAUDE_API_KEY) {
        const ai = await callClaude(prompt);
        zduvodneni = ai.zduvodneni;
        upozorneni = ai.upozorneni;
        model_used = CLAUDE_MODEL;
      } else if (GEMINI_API_KEY) {
        const ai = await callGemini(prompt);
        zduvodneni = ai.zduvodneni;
        upozorneni = ai.upozorneni;
        model_used = GEMINI_MODEL;
      }
    } catch (aiErr) {
      console.warn('[FormworkAssistant] AI call failed, using deterministic only:', aiErr);
      // Build fallback explanation without AI
      zduvodneni = `Pro ${ELEMENT_LABEL[body.element_type]} o ploše ${body.celkem_m2} m² se sadou ${body.sada_m2} m² jsou potřeba ${calc.pocet_taktu} takty. Zrání ${calc.dni_beton_takt} dní (${BASE_CURE_DAYS[body.element_type]}d × ${calc.temp_factor} při ${TEMP_RANGE[body.season]}). Celková doba ${calc.celkova_doba_dni} dní.`;
      if (body.season === 'frost') upozorneni.push('Mráz <5°C: nutné vytápění nebo zakrytí!');
      if (body.element_type === 'strop' || body.element_type === 'mostovka') {
        upozorneni.push('Spodní bednění: nutné re-propping dle statika.');
      }
    }

    const response: FormworkAIResponse = {
      ...calc,
      zduvodneni,
      upozorneni,
      model_used,
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error('[FormworkAssistant] Fatal error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
