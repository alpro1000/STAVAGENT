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
const TIMEOUT_MS = 60_000; // 60s to account for Cloud Run cold starts

/**
 * Fetch with retry for Cloud Run cold-start resilience.
 * Retries once after 2s on connection reset / network errors.
 */
async function fetchWithRetry(url, options, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      const isRetryable = err.cause?.code === 'ECONNRESET' ||
        err.cause?.code === 'UND_ERR_SOCKET' ||
        err.message?.includes('fetch failed') ||
        err.message?.includes('ECONNRESET');
      if (attempt < retries && isRetryable) {
        logger.info(`[PlannerAdvisor] Retry ${attempt + 1} after ${err.message}`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
}

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

    const coreRes = await fetchWithRetry(`${CORE_API_URL}/api/v1/multi-role/ask`, {
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

    const kbRes = await fetchWithRetry(`${CORE_API_URL}/api/v1/kb/research`, {
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

  // ── 4. Methvin productivity norms (from scraped KB) ─────────────────────
  try {
    const workTypes = mapElementToWorkTypes(element_type);
    const methvinNorms = {};

    for (const wt of workTypes) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10_000);

      const normsRes = await fetchWithRetry(`${CORE_API_URL}/api/v1/norms/work-type/${wt}`, {
        signal: controller.signal,
      });

      clearTimeout(tid);

      if (normsRes.ok) {
        const data = await normsRes.json();
        if (data.methvin_norms && Object.keys(data.methvin_norms).length > 0) {
          methvinNorms[wt] = data.methvin_norms;
        }
        if (data.existing_kb_norms && Object.keys(data.existing_kb_norms).length > 0) {
          methvinNorms[`${wt}_kb`] = data.existing_kb_norms;
        }
      }
    }

    if (Object.keys(methvinNorms).length > 0) {
      result.productivity_norms = {
        source: 'methvin.co + KB',
        work_types: workTypes,
        data: methvinNorms,
      };
    }
  } catch (err) {
    logger.warn(`[PlannerAdvisor] Methvin norms error: ${err.message}`);
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
  const sparyText = has_dilatacni_spary
    ? `ano, rozteč ${spara_spacing_m || '?'} m → sekční betonáž (záběry)`
    : 'ne → monolitická betonáž (jeden záběr, nepřerušitelná)';

  return `Jsi expert na betonáž monolitických konstrukcí (mosty i pozemní stavby).

ELEMENT: ${elementLabel} (typ: ${element_type || 'neurčen'})
OBJEM: ${volume_m3} m³
BETON: ${concrete_class || 'C30/37'}
TEPLOTA: ${temperature_c || 15}°C
DÉLKA: ${total_length_m ? total_length_m + ' m' : 'neurčena'}
DILATAČNÍ SPÁRY: ${sparyText}

PRAVIDLA (dodržuj přesně):
- Postup betonáže určuje VÝHRADNĚ přítomnost dilatačních spár:
  • Spáry ANO → sectional (záběrový), sub_mode závisí na typu prvku
  • Spáry NE → monolithic (vše v jednom záběru)
- Monolitická betonáž = celý objem v jednom nepřerušeném záběru, i kdyby to trvalo 12-16h
  • Navýšit osádku (až 15 lidí), čerpadla, prodloužit směnu
  • Příplatek 25% za přesčas od 10. hodiny
- Šachovnicový postup (chess) = sousední záběry nejdříve liché, pak sudé (min. 24h tvrdnutí mezi sousedy)
- Římsy: VŽDY sekční betonáž po 25–30 m bez ohledu na dilatační spáry. Počet záběrů = délka mostu ÷ 25–30 m. Římsa NENÍ deska.
- Podpěrná konstrukce (skruž/stojky) je nutná pro všechny vodorovné prvky (desky, průvlaky, schodiště, římsy)

Odpověz v tomto JSON formátu:
{
  "pour_mode": "sectional" nebo "monolithic",
  "sub_mode": "chess" nebo "linear" nebo "single_pour",
  "recommended_tacts": <počet záběrů>,
  "tact_volume_m3": <objem jednoho záběru>,
  "reasoning": "<2-3 věty proč tento postup>",
  "warnings": ["<seznam rizik/upozornění>"],
  "overtime_recommendation": "<doporučení k přesčasu>",
  "pump_type": "<stacionární | mobilní | autodomíchávač>"
}

Zohledni: ČSN EN 13670, ČSN 73 6244 (mosty), technologické okno betonu, klimatické podmínky.
ODPOVĚZ POUZE VALIDNÍM JSON.`;
}

// ── Formwork suggestion (deterministic) ─────────────────────────────────────

function suggestFormwork(element_type, volume_m3, has_dilatacni_spary) {
  // Map element types to suitable formwork systems
  const elementFormworkMap = {
    // Bridge elements
    zaklady_piliru: ['Frami Xlife', 'Framax Xlife', 'TRIO'],
    driky_piliru: ['SL-1 Sloupové', 'Frami Xlife', 'TRIO'],
    operne_zdi: ['Framax Xlife', 'Frami Xlife', 'TRIO'],
    mostovkova_deska: ['Dokaflex', 'Top 50', 'Tradiční tesařské'],
    rimsa: ['Římsové bednění T', 'Tradiční tesařské'],
    rigel: ['Framax Xlife', 'TRIO', 'Frami Xlife'],
    opery_ulozne_prahy: ['Framax Xlife', 'Frami Xlife', 'TRIO'],
    mostni_zavirne_zidky: ['Frami Xlife', 'Tradiční tesařské'],
    // Building elements
    zakladova_deska: ['Frami Xlife', 'Tradiční tesařské'],
    zakladovy_pas: ['Frami Xlife', 'Tradiční tesařské'],
    zakladova_patka: ['Frami Xlife', 'Tradiční tesařské'],
    stropni_deska: ['Dokaflex', 'Top 50', 'Tradiční tesařské'],
    stena: ['Framax Xlife', 'Frami Xlife', 'TRIO'],
    sloup: ['SL-1 Sloupové', 'Framax Xlife'],
    pruvlak: ['Dokaflex', 'Tradiční tesařské'],
    schodiste: ['Tradiční tesařské', 'Dokaflex'],
    nadrz: ['Framax Xlife', 'Frami Xlife'],
    podzemni_stena: ['Tradiční tesařské'],
    pilota: ['Tradiční tesařské'],
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

// ── Element type → work types mapping ─────────────────────────────────────

function mapElementToWorkTypes(element_type) {
  const map = {
    zaklady_piliru: ['bedneni', 'beton', 'vyztuž', 'zemni_prace'],
    driky_piliru: ['bedneni', 'beton', 'vyztuž'],
    operne_zdi: ['bedneni', 'beton', 'vyztuž', 'zemni_prace'],
    mostovkova_deska: ['bedneni', 'beton', 'vyztuž'],
    rimsa: ['bedneni', 'beton', 'vyztuž'],
    rigel: ['bedneni', 'beton', 'vyztuž'],
    opery_ulozne_prahy: ['bedneni', 'beton', 'vyztuž'],
    mostni_zavirne_zidky: ['bedneni', 'beton'],
    piloty: ['zaklady', 'beton'],
  };
  return map[element_type] || ['bedneni', 'beton', 'vyztuž'];
}

// ── Proxy: /api/planner-advisor/norms/scrape-all → concrete-agent ───────────
// Avoids CORS issues when calling concrete-agent directly from the browser

router.post('/norms/scrape-all', async (req, res) => {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 300_000); // 5 min for full scrape

    const coreRes = await fetch(`${CORE_API_URL}/api/v1/norms/scrape-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (coreRes.ok) {
      const data = await coreRes.json();
      res.json(data);
    } else {
      const text = await coreRes.text().catch(() => '');
      res.status(coreRes.status).json({ error: text || `Core returned ${coreRes.status}` });
    }
  } catch (err) {
    logger.warn(`[PlannerAdvisor] norms/scrape-all proxy error: ${err.message}`);
    res.status(502).json({ error: `Proxy error: ${err.message}` });
  }
});

// ── Calculator Suggestions: proxy to Core extraction engine ─────────────────

/**
 * POST /api/planner-advisor/calculator-suggestions
 * Body: { portal_project_id, building_object?, element_description? }
 * Returns: { suggestions[], warnings[], conflicts[], facts_count, documents_used[] }
 *
 * Proxies to Core: POST /api/v1/extraction/calculator-suggestions
 * Used by PlannerPage to show inline suggestions from extracted documents.
 */
router.post('/calculator-suggestions', async (req, res) => {
  const { portal_project_id, building_object, element_description } = req.body;

  if (!portal_project_id) {
    return res.status(400).json({ error: 'portal_project_id je povinný' });
  }

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15_000); // 15s timeout

    const coreRes = await fetchWithRetry(`${CORE_API_URL}/api/v1/extraction/calculator-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portal_project_id,
        building_object: building_object || undefined,
        element_description: element_description || undefined,
      }),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (coreRes.ok) {
      const data = await coreRes.json();
      res.json(data);
    } else {
      const text = await coreRes.text().catch(() => '');
      logger.warn(`[PlannerAdvisor] calculator-suggestions: Core returned ${coreRes.status}: ${text}`);
      // Return empty response so calculator works without suggestions
      res.json({
        project_id: portal_project_id,
        building_object: building_object || '',
        suggestions: [],
        warnings: [],
        conflicts: [],
        facts_count: 0,
        documents_used: [],
      });
    }
  } catch (err) {
    logger.warn(`[PlannerAdvisor] calculator-suggestions error: ${err.message}`);
    // Graceful degradation: return empty so calculator works normally
    res.json({
      project_id: portal_project_id,
      building_object: building_object || '',
      suggestions: [],
      warnings: [],
      conflicts: [],
      facts_count: 0,
      documents_used: [],
    });
  }
});

export default router;
