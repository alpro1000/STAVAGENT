/**
 * Formwork Assistant API
 * POST /api/formwork-assistant
 *
 * Combines deterministic formwork scheduling calculation with AI explanation.
 * Deterministic core always runs; AI generates human-readable explanation + warnings.
 *
 * Calculation model:
 *   pocet_taktu    = ⌈total_area_m2 ÷ set_area_m2⌉
 *   assembly_days  = (set_area_m2 × h_m2 × crew_factor) ÷ (crew × shift)
 *   zrani_days     = base_curing × temp_factor × cement_factor
 *   days_per_tact  = assembly_days + disassembly_days
 *   term_days      = pocet_taktu × (days_per_tact + zrani_days)
 */

import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { logger } from '../utils/logger.js';

const router = express.Router();

const CORE_API_URL = process.env.CORE_API_URL || 'https://concrete-agent.onrender.com';
const CORE_TIMEOUT = parseInt(process.env.CORE_TIMEOUT || '60000', 10);

// ── Load assembly norms from KB (bedneni.json) ───────────────────────────────

/**
 * Hardcoded fallback norms — used if bedneni.json cannot be loaded.
 * These mirror the values in formworkSystems.ts (frontend).
 */
const ASSEMBLY_NORMS_FALLBACK = {
  'Frami Xlife':       { h_m2: 0.72, disassembly_h_m2: 0.25, disassembly_ratio: 0.35 },
  'Framax Xlife':      { h_m2: 0.55, disassembly_h_m2: 0.19, disassembly_ratio: 0.35 },
  'TRIO':              { h_m2: 0.50, disassembly_h_m2: 0.18, disassembly_ratio: 0.36 },
  'Top 50':            { h_m2: 0.60, disassembly_h_m2: 0.21, disassembly_ratio: 0.35 },
  'Dokaflex':          { h_m2: 0.45, disassembly_h_m2: 0.14, disassembly_ratio: 0.31 },
  'SL-1 Sloupové':     { h_m2: 0.80, disassembly_h_m2: 0.30, disassembly_ratio: 0.375 },
  'Tradiční tesařské': { h_m2: 1.30, disassembly_h_m2: 0.65, disassembly_ratio: 0.50 },
};

/** Load norms from bedneni.json KB file, fall back to hardcoded if unavailable */
function loadAssemblyNorms() {
  // Try to locate bedneni.json relative to this file and via env override
  const candidates = [
    process.env.BEDNENI_JSON_PATH,
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../../concrete-agent/packages/core-backend/app/knowledge_base/B4_production_benchmarks/bedneni.json'),
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../concrete-agent/packages/core-backend/app/knowledge_base/B4_production_benchmarks/bedneni.json'),
  ].filter(Boolean);

  for (const candidatePath of candidates) {
    try {
      const raw = readFileSync(candidatePath, 'utf8');
      const kb = JSON.parse(raw);
      if (!kb.systemy) continue;

      const norms = {};
      for (const [systemName, data] of Object.entries(kb.systemy)) {
        norms[systemName] = {
          h_m2:              data.assembly_h_m2,
          disassembly_h_m2:  data.disassembly_h_m2,
          disassembly_ratio: data.disassembly_ratio,
        };
      }

      logger.info(`[Formwork Assistant] Loaded ${Object.keys(norms).length} systems from KB: ${candidatePath}`);
      return norms;
    } catch {
      // try next candidate
    }
  }

  logger.warn('[Formwork Assistant] bedneni.json not found — using hardcoded norms');
  return ASSEMBLY_NORMS_FALLBACK;
}

const ASSEMBLY_NORMS = loadAssemblyNorms();

/**
 * Q4 crew configurations.
 * crane_factor: jeřáb speeds up heavy-panel assembly (less manual repositioning).
 */
const CREW_CONFIG = {
  '2_bez_jeravu': { crew: 2, shift: 8,  crane: false, crane_factor: 1.00 },
  '4_bez_jeravu': { crew: 4, shift: 10, crane: false, crane_factor: 1.00 },
  '4_s_jeravem':  { crew: 4, shift: 10, crane: true,  crane_factor: 0.80 },
  '6_s_jeravem':  { crew: 6, shift: 10, crane: true,  crane_factor: 0.70 },
};

/** Base curing (zrání) days at 20°C with CEM I/II — from TKP17 */
const BASE_CURING = {
  'C20_25': 7,
  'C25_30': 7,
  'C30_37': 10,
  'C35_45': 14,
  'C40_50': 14,
};

/** Temperature factor for curing duration (TKP17 §6) */
const TEMP_FACTOR = {
  'leto':        1.0,   // >15°C
  'podzim_jaro': 1.5,   // 5–15°C
  'zima':        3.0,   // <5°C (heating/insulation required)
};

/** Cement strength development factor (TKP17 §6) */
const CEMENT_FACTOR = {
  'CEM_I_II': 1.0,
  'CEM_III':  1.8,
};

const CONSTRUCTION_LABELS = {
  'zakladove_pasy': 'Základové pásy / piloty',
  'pilire_mostu':   'Pilíře mostu',
  'mostovka':       'Mostovka / deska',
  'steny':          'Stěny / opěry',
  'sloupy':         'Sloupy',
  'rimsy':          'Římsы / konzoly',
};

const SEASON_LABELS = {
  'leto':        'léto (>15 °C)',
  'podzim_jaro': 'podzim/jaro (5–15 °C)',
  'zima':        'zima (<5 °C)',
};

// ── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/formwork-assistant
 *
 * Body:
 *   construction_type  'zakladove_pasy' | 'pilire_mostu' | 'mostovka' | 'steny' | 'sloupy' | 'rimsy'
 *   season             'leto' | 'podzim_jaro' | 'zima'
 *   concrete_class     'C20_25' | 'C25_30' | 'C30_37' | 'C35_45' | 'C40_50'
 *   cement_type        'CEM_I_II' | 'CEM_III'
 *   crew               '2_bez_jeravu' | '4_bez_jeravu' | '4_s_jeravem' | '6_s_jeravem'
 *   total_area_m2      number
 *   set_area_m2        number
 *   system_name        string  (formwork system name)
 *   model              'gemini' | 'claude'
 *
 * Response:
 *   { success, deterministic, ai_explanation, warnings, model_used }
 */
router.post('/', async (req, res) => {
  try {
    const {
      construction_type = 'steny',
      season            = 'leto',
      concrete_class    = 'C30_37',
      cement_type       = 'CEM_I_II',
      crew              = '4_bez_jeravu',
      total_area_m2     = 0,
      set_area_m2       = 0,
      system_name       = 'Framax Xlife',
      model             = 'gemini',
    } = req.body;

    // Basic validation
    if (typeof total_area_m2 !== 'number' || total_area_m2 <= 0) {
      return res.status(400).json({ error: 'total_area_m2 must be a positive number' });
    }
    if (typeof set_area_m2 !== 'number' || set_area_m2 <= 0) {
      return res.status(400).json({ error: 'set_area_m2 must be a positive number' });
    }

    // ── Deterministic core ──────────────────────────────────────────────────
    const norm      = ASSEMBLY_NORMS[system_name] || ASSEMBLY_NORMS['Framax Xlife'];
    const crewCfg   = CREW_CONFIG[crew]            || CREW_CONFIG['4_bez_jeravu'];
    const tempFact  = TEMP_FACTOR[season]           || 1.0;
    const cemFact   = CEMENT_FACTOR[cement_type]    || 1.0;
    const baseCure  = BASE_CURING[concrete_class]   || 10;

    const pocetTaktu = Math.ceil(total_area_m2 / set_area_m2);

    // Assembly hours for one set, adjusted for crane
    const assemblyH = set_area_m2 * norm.h_m2 * crewCfg.crane_factor;
    // Use absolute disassembly_h_m2 if available (from KB), otherwise fall back to ratio
    const disassemblyH = norm.disassembly_h_m2 != null
      ? set_area_m2 * norm.disassembly_h_m2 * crewCfg.crane_factor
      : assemblyH * (norm.disassembly_ratio || 0.35);
    const dailyH = crewCfg.crew * crewCfg.shift;

    const assemblyDays    = dailyH > 0 ? assemblyH / dailyH : 0;
    const disassemblyDays = dailyH > 0 ? disassemblyH / dailyH : 0;
    const daysPerTact     = parseFloat((assemblyDays + disassemblyDays).toFixed(1));

    // Curing days (formwork stays up during curing)
    const zraniDays = Math.round(baseCure * tempFact * cemFact);

    // Total formwork term: each tact occupies (assembly+disassembly) + curing
    const formworkTermDays = Math.round(pocetTaktu * (daysPerTact + zraniDays));

    const deterministic = {
      pocet_taktu:              pocetTaktu,
      set_area_m2:              set_area_m2,
      total_area_m2:            total_area_m2,
      assembly_days_per_tact:   parseFloat(assemblyDays.toFixed(2)),
      disassembly_days_per_tact: parseFloat(disassemblyDays.toFixed(2)),
      days_per_tact:            daysPerTact,
      zrani_days:               zraniDays,
      base_curing_days:         baseCure,
      temp_factor:              tempFact,
      cement_factor:            cemFact,
      formwork_term_days:       formworkTermDays,
      crew_size:                crewCfg.crew,
      shift_hours:              crewCfg.shift,
      crane:                    crewCfg.crane,
    };

    logger.info(`[Formwork Assistant] Deterministic OK: ${pocetTaktu} taktů, ${daysPerTact} dní/takt, zrání ${zraniDays} dní`);

    // ── Warnings ────────────────────────────────────────────────────────────
    const warnings = [];

    if (season === 'zima') {
      warnings.push('Zima: beton nutno ohřívat min. +5 °C po dobu 72 h (TKP17 §6.4)');
      warnings.push('Prověřit ochranu čerstvého betonu před mrazem a větrem');
    }
    if (season === 'podzim_jaro') {
      warnings.push('Přechodné období: sledovat noční teploty, možná potřeba zakrytí');
    }
    if (cement_type === 'CEM_III') {
      warnings.push('CEM III: pomalý nárůst pevnosti — prodloužit ošetřování o 80 % (TKP17)');
    }
    if (construction_type === 'mostovka') {
      warnings.push('Mostovka: min. 14 dní ošetřování, třída XD3/XF4, krytí 60 mm (TKP18)');
    }
    if (construction_type === 'pilire_mostu') {
      warnings.push('Pilíře mostu: takt max. 3,0 m výšky, krytí 50 mm, XC4/XF3 (TKP18)');
    }
    if (construction_type === 'rimsy') {
      warnings.push('Římsы: konzultovat systém — TU-vozík (≤150 m mostu) / T-vozík (>150 m)');
    }
    if (pocetTaktu > 10) {
      warnings.push(`${pocetTaktu} taktů — zvažte přidání sad bednění pro zkrácení celkové doby`);
    }
    if (crewCfg.crew < 3 && total_area_m2 > 100) {
      warnings.push('Malá parta pro velkou plochu — montáž bude neúměrně dlouhá');
    }
    if (!crewCfg.crane && norm.h_m2 >= 0.80) {
      warnings.push(`Systém ${system_name} (těžké panely) — jeřáb výrazně zrychlí montáž`);
    }

    // ── AI explanation ───────────────────────────────────────────────────────
    let aiExplanation = '';
    let modelUsed = model;

    try {
      const consLabel   = CONSTRUCTION_LABELS[construction_type] || construction_type;
      const seasonLabel = SEASON_LABELS[season] || season;
      const concrLabel  = concrete_class.replace('_', '/');
      const crewLabel   = `${crewCfg.crew} lidí${crewCfg.crane ? ' + jeřáb' : ''}`;

      if (model === 'openai' && process.env.OPENAI_API_KEY) {
        // ── OpenAI gpt-4o-mini — direct call ──────────────────────────────
        const prompt =
          `Jsi expert na stavební bednění. Zhodnoť plán pro konstrukci "${consLabel}" (systém ${system_name}). `
          + `Celková plocha ${total_area_m2} m², sada ${set_area_m2} m², ${pocetTaktu} taktů. `
          + `Beton ${concrLabel}, ${cement_type.replace('_', '/')}, ${seasonLabel}. Parta ${crewLabel}. `
          + `Výsledky kalkulace: montáž ${daysPerTact} dní/takt, ošetřování ${zraniDays} dní, celková doba ${formworkTermDays} dní. `
          + `Napiš stručné, praktické doporučení (max 5 vět). Zmiň 2-3 klíčová rizika.`;

        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), CORE_TIMEOUT);

        const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model:      'gpt-4o-mini',
            messages:   [{ role: 'user', content: prompt }],
            max_tokens: 400,
            temperature: 0.4,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          aiExplanation = oaiData.choices?.[0]?.message?.content || '';
          modelUsed = 'gpt-4o-mini';
          logger.info('[Formwork Assistant] OpenAI OK (gpt-4o-mini)');
        } else {
          const errText = await oaiRes.text().catch(() => '');
          logger.warn(`[Formwork Assistant] OpenAI ${oaiRes.status}: ${errText}`);
          // Fall through to multi-role fallback below
          throw new Error(`OpenAI ${oaiRes.status}`);
        }

      } else {
        // ── concrete-agent Multi-Role API (Gemini / Claude / OpenAI fallback) ──
        const isDetailed = model === 'claude';
        const isMedium   = model === 'openai'; // fallback path

        const question = isDetailed
          ? `Podej podrobné doporučení pro bednění konstrukce "${consLabel}" (${system_name}). `
            + `Celková plocha ${total_area_m2} m², sada ${set_area_m2} m², ${pocetTaktu} taktů. `
            + `Beton ${concrLabel}, ${cement_type.replace('_', '/')}, ${seasonLabel}. Parta ${crewLabel}. `
            + `Ošetřování ${zraniDays} dní/takt. Délka bednění: ${daysPerTact} dní/takt. `
            + `Odkaž na TKP17 (beton) nebo TKP18 (mosty) kde je to relevantní. `
            + `Zmíň hlavní rizika a kontrolní body pro stavební dozor.`
          : isMedium
          ? `Zhodnoť plán bednění: ${consLabel} (${system_name}), ${total_area_m2} m², ${pocetTaktu} taktů, `
            + `${daysPerTact} dní/takt + ošetřování ${zraniDays} dní. ${seasonLabel}, ${crewLabel}. `
            + `Uveď 3 praktická doporučení a hlavní rizika.`
          : `Stručně shrň: bednění ${consLabel}, ${total_area_m2} m², ${pocetTaktu} taktů po ${daysPerTact} dnech + ošetřování ${zraniDays} dní. `
            + `${seasonLabel}, ${crewLabel}. Co je klíčové hlídat?`;

        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), CORE_TIMEOUT);

        const aiRes = await fetch(`${CORE_API_URL}/api/v1/multi-role/ask`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            context: {
              tool:              'formwork_assistant',
              formwork_system:   system_name,
              construction_type,
              concrete_class,
              cement_type,
              season,
              crew_size:         crewCfg.crew,
              crane:             crewCfg.crane,
              deterministic:     deterministic,
            },
            enable_kb:         true,
            enable_perplexity: false,
            use_cache:         true,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiExplanation = aiData.answer || '';
          if (isMedium) modelUsed = 'openai-fallback';
          logger.info(`[Formwork Assistant] Multi-Role OK (model=${model})`);
        } else {
          logger.warn(`[Formwork Assistant] Multi-Role API ${aiRes.status}`);
          aiExplanation = buildFallbackExplanation(deterministic, construction_type, season, warnings);
          modelUsed = 'fallback';
        }
      }
    } catch (aiErr) {
      const isTimeout = aiErr.name === 'AbortError';
      logger.warn(`[Formwork Assistant] AI ${isTimeout ? 'timeout' : 'error'}: ${aiErr.message}`);
      aiExplanation = buildFallbackExplanation(deterministic, construction_type, season, warnings);
      modelUsed = 'fallback';
    }

    res.json({
      success:        true,
      deterministic,
      ai_explanation: aiExplanation,
      warnings,
      model_used:     modelUsed,
    });

  } catch (err) {
    logger.error('[Formwork Assistant] Unexpected error:', err);
    res.status(500).json({ error: 'Formwork assistant failed', details: err.message });
  }
});

// ── Fallback explanation (when AI unavailable) ───────────────────────────────

function buildFallbackExplanation(det, constructionType, season, warnings) {
  const constr = CONSTRUCTION_LABELS[constructionType] || constructionType;

  const lines = [
    `**Výsledek kalkulace bednění — ${constr}**`,
    ``,
    `Celková plocha **${det.total_area_m2} m²** bude realizována v **${det.pocet_taktu} taktech** po ${det.set_area_m2} m².`,
    ``,
    `| Ukazatel | Hodnota |`,
    `|---|---|`,
    `| Montáž/takt | ${det.assembly_days_per_tact.toFixed(1)} dní |`,
    `| Demontáž/takt | ${det.disassembly_days_per_tact.toFixed(1)} dní |`,
    `| Dny/takt (celkem) | **${det.days_per_tact} dní** |`,
    `| Ošetřování betonu | ${det.zrani_days} dní (základ ${det.base_curing_days}d × ×${det.temp_factor} teplota × ×${det.cement_factor} cement) |`,
    `| Doba bednění | **~${det.formwork_term_days} dní** |`,
    `| Parta | ${det.crew_size} lidí${det.crane ? ' + jeřáb' : ''}, směna ${det.shift_hours} h |`,
  ];

  if (season === 'zima') {
    lines.push('', '⚠️ **Zimní betování:** Zabezpečte ohřev, TKP17 §6.4.');
  }

  if (warnings.length > 0) {
    lines.push('', '**Upozornění:**');
    warnings.forEach(w => lines.push(`- ${w}`));
  }

  lines.push('', '_AI nedostupná — zobrazena deterministická kalkulace._');

  return lines.join('\n');
}

export default router;
