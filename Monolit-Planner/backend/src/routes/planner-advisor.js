/**
 * Planner Advisor API
 * POST /api/planner-advisor
 *
 * AI-powered recommendations for element planning:
 * - Approach (подступ): sectional vs monolithic, chess vs linear
 * - Formwork system suggestion based on element type + volume
 * - Relevant norms from Knowledge Base
 *
 * Calls concrete-agent Multi-Role API + KB Research
 */

import express from 'express';
import { logger } from '../utils/logger.js';
import {
  FORMWORK_SYSTEMS,
} from '@stavagent/monolit-shared';

const router = express.Router();

const CORE_API_URL = process.env.CORE_API_URL || process.env.STAVAGENT_CORE_URL || 'https://concrete-agent-1086027517695.europe-west3.run.app';
const TIMEOUT_MS = 30_000;

/**
 * POST /api/planner-advisor
 * Body: { element_type, element_name?, volume_m3, has_dilatacni_spary, concrete_class, temperature_c }
 * Returns: { approach, formwork_suggestion, norms, warnings }
 */
router.post('/', async (req, res) => {
  const {
    element_type,
    element_name,
    volume_m3,
    has_dilatacni_spary,
    concrete_class,
    temperature_c,
    total_length_m,
    spara_spacing_m,
  } = req.body;

  if (!element_type && !element_name) {
    return res.status(400).json({ error: 'element_type nebo element_name je povinný' });
  }

  const elementLabel = element_name || element_type;
  const result = {
    approach: null,
    formwork_suggestion: null,
    norms: [],
    warnings: [],
  };

  // ── 1. AI approach recommendation via Multi-Role ──────────────────────────
  try {
    const question = buildApproachPrompt({
      elementLabel,
      element_type,
      volume_m3,
      has_dilatacni_spary,
      concrete_class,
      temperature_c,
      total_length_m,
      spara_spacing_m,
    });

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const coreRes = await fetch(`${CORE_API_URL}/api/v1/multi-role/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'concrete_specialist',
        question,
        context: {
          element_type,
          volume_m3,
          concrete_class,
          temperature_c,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (coreRes.ok) {
      const data = await coreRes.json();
      result.approach = {
        text: data.answer || data.response || '',
        model: data.model_used || 'multi-role',
        confidence: data.confidence || 0.8,
      };
    } else {
      logger.warn(`[PlannerAdvisor] Core Multi-Role returned ${coreRes.status}`);
    }
  } catch (err) {
    logger.warn(`[PlannerAdvisor] Multi-Role error: ${err.message}`);
  }

  // ── 2. Formwork system suggestion (deterministic + KB) ────────────────────
  try {
    result.formwork_suggestion = suggestFormwork(element_type, volume_m3, has_dilatacni_spary);
  } catch (err) {
    logger.warn(`[PlannerAdvisor] Formwork suggestion error: ${err.message}`);
  }

  // ── 3. KB Research — relevant norms ───────────────────────────────────────
  try {
    const normQuestion = `Jaké normy ČSN EN platí pro betonáž ${elementLabel}? ` +
      `Beton ${concrete_class || 'C30/37'}, objem ${volume_m3} m³. ` +
      `Zaměř se na: požadavky na bednění, ošetřování betonu, zrání, minimální doby odbednění.`;

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const kbRes = await fetch(`${CORE_API_URL}/api/v1/kb/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: normQuestion,
        save_to_kb: false,
        category: 'norms',
      }),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (kbRes.ok) {
      const kbData = await kbRes.json();
      result.norms = {
        answer: kbData.answer || '',
        sources: kbData.sources || [],
        model: kbData.model_used || 'kb-research',
      };
    }
  } catch (err) {
    logger.warn(`[PlannerAdvisor] KB Research error: ${err.message}`);
  }

  res.json(result);
});

// ── Approach prompt builder ─────────────────────────────────────────────────

function buildApproachPrompt({
  elementLabel,
  element_type,
  volume_m3,
  has_dilatacni_spary,
  concrete_class,
  temperature_c,
  total_length_m,
  spara_spacing_m,
}) {
  return `Jsi expert na betonáž monolitických konstrukcí.

ELEMENT: ${elementLabel} (typ: ${element_type || 'neurčen'})
OBJEM: ${volume_m3} m³
BETON: ${concrete_class || 'C30/37'}
TEPLOTA: ${temperature_c || 15}°C
DÉLKA: ${total_length_m ? total_length_m + ' m' : 'neurčena'}
DILATAČNÍ SPÁRY: ${has_dilatacni_spary ? `ano, rozteč ${spara_spacing_m || '?'} m` : 'ne'}

Doporuč optimální postup betonáže. Odpověz strukturovaně v JSON:
{
  "pour_mode": "sectional | monolithic",
  "sub_mode": "chess | linear | single_pour",
  "recommended_tacts": <číslo>,
  "tact_volume_m3": <číslo>,
  "reasoning": "<2-3 věty proč tento postup>",
  "warnings": ["<seznam rizik/upozornění>"],
  "overtime_recommendation": "<zda doporučuješ přesčas nebo víkendovou práci>",
  "pump_type": "<doporučený typ čerpadla: stacionární | mobilní | autodomíchávač>"
}

Zohledni:
- ČSN EN 13670 požadavky na betonáž
- Maximální objem na záběr (typicky 30-60 m³/den)
- Šachovnicový postup pro sousední záběry (chess)
- Klimatické podmínky a vliv na zrání betonu
- Dostupnost čerpadel a betonáren

ODPOVĚZ POUZE JSON.`;
}

// ── Formwork suggestion (deterministic) ─────────────────────────────────────

function suggestFormwork(element_type, volume_m3, has_dilatacni_spary) {
  // Map element types to suitable formwork systems
  const elementFormworkMap = {
    zaklady_piliru: ['Frami Xlife', 'Framax Xlife', 'TRIO'],
    driky_piliru: ['SL-1 Sloupové', 'Frami Xlife', 'TRIO'],
    operne_zdi: ['Framax Xlife', 'Frami Xlife', 'TRIO'],
    mostovkova_deska: ['Dokaflex', 'Top 50', 'Tradiční tesařské'],
    rimsa: ['Římsové bednění T', 'Tradiční tesařské'],
    rigel: ['Framax Xlife', 'TRIO', 'Frami Xlife'],
    opery_ulozne_prahy: ['Framax Xlife', 'Frami Xlife', 'TRIO'],
    mostni_zavirne_zidky: ['Frami Xlife', 'Tradiční tesařské'],
    other: ['Frami Xlife', 'Framax Xlife'],
  };

  const suitableNames = elementFormworkMap[element_type] || elementFormworkMap.other;

  // Find full system data from shared FORMWORK_SYSTEMS
  const suggestions = suitableNames
    .map(name => FORMWORK_SYSTEMS.find(s => s.name === name))
    .filter(Boolean)
    .map((sys, idx) => ({
      ...sys,
      rank: idx + 1,
      reasoning: idx === 0
        ? `Doporučený systém pro ${element_type}`
        : `Alternativa ${idx + 1}`,
    }));

  // Check if volume is large enough to warrant rental vs purchase
  const num_sets_recommendation = has_dilatacni_spary ? 2 : 1;

  return {
    recommended: suggestions[0] || null,
    alternatives: suggestions.slice(1),
    num_sets_recommendation,
    tip: has_dilatacni_spary
      ? 'Se spárami: doporučeny 2 sady pro překrývající postup (strategie B).'
      : 'Bez spár: 1 sada stačí pro jednorázovou betonáž.',
  };
}

export default router;
