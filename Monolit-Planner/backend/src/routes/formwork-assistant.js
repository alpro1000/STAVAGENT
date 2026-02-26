/**
 * Formwork Assistant API — v2
 * POST /api/formwork-assistant
 *
 * New calculation model (ČSN EN 13670):
 *
 *   CYCLE per capture:
 *     [MONTÁŽ] → [ARMOVÁNÍ] → [BETONÁŽ 1d] → [ZRÁNÍ min.] → [DEMONTÁŽ]
 *     cycle_days = A + R + 1 + C + D
 *
 *   CURING TABLE (min. days by construction type × temperature):
 *     ČSN EN 13670, TKP17 §6
 *
 *   3 STRATEGIES:
 *     A — Sequential (1 set):   total = N × cycle
 *     B — Overlapping (2 sets): total = (N-1) × stride + cycle,  stride = cycle - overlap
 *     C — Parallel (N sets):    total = cycle
 *
 *   AUTO-OPTIMIZATION: compare min cost vs min time
 */

import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { logger } from '../utils/logger.js';

const router = express.Router();

const CORE_API_URL = process.env.CORE_API_URL || 'https://concrete-agent.onrender.com';
const CORE_TIMEOUT = parseInt(process.env.CORE_TIMEOUT || '60000', 10);

// ── Assembly norms (h/m²) ───────────────────────────────────────────────────

const ASSEMBLY_NORMS_FALLBACK = {
  'Frami Xlife':       { h_m2: 0.72, disassembly_h_m2: 0.25, disassembly_ratio: 0.35, rental_czk_m2_month: 507.20 },
  'Framax Xlife':      { h_m2: 0.55, disassembly_h_m2: 0.17, disassembly_ratio: 0.30, rental_czk_m2_month: 520.00 },
  'TRIO':              { h_m2: 0.50, disassembly_h_m2: 0.15, disassembly_ratio: 0.30, rental_czk_m2_month: 480.00 },
  'Top 50':            { h_m2: 0.60, disassembly_h_m2: 0.21, disassembly_ratio: 0.35, rental_czk_m2_month: 380.00 },
  'Dokaflex':          { h_m2: 0.45, disassembly_h_m2: 0.14, disassembly_ratio: 0.30, rental_czk_m2_month: 350.00 },
  'SL-1 Sloupové':     { h_m2: 0.80, disassembly_h_m2: 0.28, disassembly_ratio: 0.35, rental_czk_m2_month: 580.00 },
  'Tradiční tesařské': { h_m2: 1.30, disassembly_h_m2: 0.65, disassembly_ratio: 0.50, rental_czk_m2_month: 0 },
  'Římsové bednění T': { h_m2: 0.38, disassembly_h_m2: 0.10, disassembly_ratio: 0.25, rental_czk_m2_month: 0, unit: 'bm' },
};

function loadAssemblyNorms() {
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
        const isBm = data.assembly_h_mb_min != null;
        const assemblyH = isBm
          ? (data.assembly_h_mb_min + data.assembly_h_mb_max) / 2
          : data.assembly_h_m2;
        const disassemblyH = isBm
          ? assemblyH * (data.disassembly_ratio || 0.25)
          : data.disassembly_h_m2;
        norms[systemName] = {
          h_m2:              assemblyH,
          disassembly_h_m2:  disassemblyH,
          disassembly_ratio: data.disassembly_ratio,
          rental_czk_m2_month: data.rental_czk_m2_month || 0,
          ...(isBm ? { unit: 'bm' } : {}),
        };
      }
      logger.info(`[Formwork v2] Loaded ${Object.keys(norms).length} systems from KB: ${candidatePath}`);
      return norms;
    } catch {
      // try next candidate
    }
  }
  logger.warn('[Formwork v2] bedneni.json not found — using hardcoded norms');
  return ASSEMBLY_NORMS_FALLBACK;
}

const ASSEMBLY_NORMS = loadAssemblyNorms();

// ── Crew configs ────────────────────────────────────────────────────────────

const CREW_CONFIG = {
  '2_bez_jeravu': { crew: 2, shift: 8,  crane: false, crane_factor: 1.00 },
  '4_bez_jeravu': { crew: 4, shift: 10, crane: false, crane_factor: 1.00 },
  '4_s_jeravem':  { crew: 4, shift: 10, crane: true,  crane_factor: 0.80 },
  '6_s_jeravem':  { crew: 6, shift: 10, crane: true,  crane_factor: 0.70 },
};

// ── NEW: Minimum curing table (ČSN EN 13670) ──────────────────────────────
// Min days before stripping, by construction type × temperature range

const MIN_CURING = {
  //                          >15°C   10-15°C   5-10°C
  'zakladove_pasy': { leto: 0.5, podzim_jaro: 1.0, zima: 2.0 },  // Fundament / masiv
  'steny':          { leto: 1.0, podzim_jaro: 1.5, zima: 3.0 },  // Stěna / kolona
  'pilire_mostu':   { leto: 1.0, podzim_jaro: 1.5, zima: 3.0 },  // Pilíř (≈ stěna)
  'sloupy':         { leto: 1.0, podzim_jaro: 1.5, zima: 3.0 },  // Sloup (≈ stěna)
  'mostovka':       { leto: 7.0, podzim_jaro: 10.0, zima: 14.0 }, // Překlítí / mostovka
  'rimsy':          { leto: 3.0, podzim_jaro: 5.0,  zima: 7.0 },  // Konzola / římsa (≈ deska)
};

// For horizontal structures (floor slabs, beams), props stay longer
const PROPS_MIN_DAYS = {
  'mostovka': { leto: 14, podzim_jaro: 21, zima: 28 },
  'rimsy':    { leto: 7,  podzim_jaro: 10, zima: 14 },
};

// ── NEW: Rebar norms (h/t by diameter) ─────────────────────────────────────
// Typical Czech norms for manual tying

const REBAR_NORMS_H_PER_T = {
  6:  35, 8: 35, 10: 28, 12: 24, 14: 22,
  16: 20, 18: 18, 20: 16, 25: 14, 28: 13, 32: 12,
};
const MESH_NORM_H_PER_M2 = 0.10;  // KARI sítě: 0.08–0.12 h/m²
const SPACER_PCS_PER_M2 = 5;      // Distanční kroužky: 5 ks/m²
const SPACER_PRICE_CZK = 4.50;    // Cena za kus

// ── Labels ──────────────────────────────────────────────────────────────────

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

const ORIENTATION = {
  'zakladove_pasy': 'vertical',
  'steny':          'vertical',
  'pilire_mostu':   'vertical',
  'sloupy':         'vertical',
  'mostovka':       'horizontal',
  'rimsy':          'horizontal',
};

// ── Route ──────────────────────────────────────────────────────────────────

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
      // NEW: rebar params (optional)
      rebar_kg_per_m3   = 0,       // 0 = no rebar in cycle
      concrete_m3_per_tact = 0,    // volume per tact (for rebar calc)
      diameter_main_mm  = 16,
      diameter_stirrups_mm = 8,
      stirrup_fraction  = 0.15,
      mesh_m2           = 0,
      crew_size_rebar   = 0,       // 0 = same crew as formwork
      // Rental params
      transport_days    = 1,       // Transport each way
    } = req.body;

    if (typeof total_area_m2 !== 'number' || total_area_m2 <= 0) {
      return res.status(400).json({ error: 'total_area_m2 must be a positive number' });
    }
    if (typeof set_area_m2 !== 'number' || set_area_m2 <= 0) {
      return res.status(400).json({ error: 'set_area_m2 must be a positive number' });
    }

    // ── Deterministic core v2 ───────────────────────────────────────────────

    const norm    = ASSEMBLY_NORMS[system_name] || ASSEMBLY_NORMS['Framax Xlife'];
    const crewCfg = CREW_CONFIG[crew]           || CREW_CONFIG['4_bez_jeravu'];

    const pocetTaktu = Math.ceil(total_area_m2 / set_area_m2);

    // 1. Assembly (A)
    const assemblyH    = set_area_m2 * norm.h_m2 * crewCfg.crane_factor;
    const dailyH       = crewCfg.crew * crewCfg.shift;
    const assemblyDays = dailyH > 0 ? assemblyH / dailyH : 0;

    // 2. Disassembly (D)
    const disassemblyH    = norm.disassembly_h_m2 != null
      ? set_area_m2 * norm.disassembly_h_m2 * crewCfg.crane_factor
      : assemblyH * (norm.disassembly_ratio || 0.35);
    const disassemblyDays = dailyH > 0 ? disassemblyH / dailyH : 0;

    // 3. Reinforcement (R) — optional
    let rebarDays = 0;
    let rebarHours = 0;
    let rebarDetails = null;
    const hasRebar = rebar_kg_per_m3 > 0 && concrete_m3_per_tact > 0;

    if (hasRebar) {
      const rebarMassKg = rebar_kg_per_m3 * concrete_m3_per_tact;
      const rebarMassT  = rebarMassKg / 1000;

      // Norm for main bars
      const normMain = REBAR_NORMS_H_PER_T[diameter_main_mm] || 20;
      // Norm for stirrups
      const normStirrups = REBAR_NORMS_H_PER_T[diameter_stirrups_mm] || 30;

      // Total rebar hours
      const mainFraction = 1 - stirrup_fraction;
      rebarHours = rebarMassT * (mainFraction * normMain + stirrup_fraction * normStirrups);

      // KARI mesh hours
      if (mesh_m2 > 0) {
        rebarHours += mesh_m2 * MESH_NORM_H_PER_M2;
      }

      // Rebar days
      const rebarCrew = crew_size_rebar > 0 ? crew_size_rebar : crewCfg.crew;
      const rebarDailyH = rebarCrew * crewCfg.shift;
      rebarDays = rebarDailyH > 0 ? rebarHours / rebarDailyH : 0;

      // Smart parallelism: if rebar crew ≠ formwork crew, partial overlap is possible.
      // Overlap is capped at min(rebar, assembly) to avoid subtracting more than the actual work.
      const parallelOverlap = crew_size_rebar > 0 && crew_size_rebar !== crewCfg.crew
        ? Math.min(rebarDays, assemblyDays) * 0.5  // up to 50% of the shorter phase
        : 0;
      rebarDays = Math.max(0.1, rebarDays - parallelOverlap);  // min 0.1d to represent at least some rebar work

      // Spacers (distanční kroužky)
      const spacerPcs  = Math.round(set_area_m2 * SPACER_PCS_PER_M2);
      const spacerCost = spacerPcs * SPACER_PRICE_CZK;

      rebarDetails = {
        rebar_mass_kg:  Math.round(rebarMassKg),
        rebar_mass_t:   round2(rebarMassT),
        rebar_hours:    round2(rebarHours),
        rebar_days:     round2(rebarDays),
        rebar_crew:     crew_size_rebar > 0 ? crew_size_rebar : crewCfg.crew,
        parallel_overlap: round2(parallelOverlap),
        norm_main_h_t:  normMain,
        norm_stirrups_h_t: normStirrups,
        spacer_pcs:     spacerPcs,
        spacer_cost_czk: round2(spacerCost),
      };
    }

    // 4. Concrete pouring = 1 day (fixed)
    const concreteDays = 1;

    // 5. Curing (C) — new table by construction type × temperature
    const curingRow = MIN_CURING[construction_type] || MIN_CURING['steny'];
    const curingDays = curingRow[season] || 1.0;

    // Cement factor still applies for CEM III (slower strength gain)
    const cementFactor = cement_type === 'CEM_III' ? 1.8 : 1.0;
    const adjustedCuringDays = round1(curingDays * cementFactor);

    // Props min days (horizontal only)
    const propsRow = PROPS_MIN_DAYS[construction_type];
    const propsDays = propsRow ? (propsRow[season] || 0) : 0;

    // 6. CYCLE per capture
    // [A] + [R] + [B=1] + [C] + [D]
    const A = round2(assemblyDays);
    const R = round2(rebarDays);
    const B = concreteDays;
    const C = adjustedCuringDays;
    const D = round2(disassemblyDays);
    const cycleDays = round1(A + R + B + C + D);

    // Work days (everything except curing)
    const workDays = round1(A + R + B + D);

    // ── 3 STRATEGIES ────────────────────────────────────────────────────────

    const rentalPerM2Day = (norm.rental_czk_m2_month || 0) / 30;
    const transportDays  = transport_days || 1;

    // Strategy A — Sequential (1 set)
    const totalA = round1(pocetTaktu * cycleDays);
    const rentalDaysA = totalA + 2 * transportDays;
    const rentalCostA = round0(1 * set_area_m2 * rentalPerM2Day * rentalDaysA);

    // Strategy B — Overlapping (2 sets)
    // overlap = how much of curing can overlap with next tact's work
    const overlapB = Math.max(0, C - (A + R + B));  // curing minus work-before-curing
    const strideB  = round1(cycleDays - overlapB);
    const totalB   = round1(pocetTaktu <= 1 ? cycleDays : (pocetTaktu - 1) * strideB + cycleDays);
    const rentalDaysB = totalB + 2 * transportDays;
    const rentalCostB = round0(2 * set_area_m2 * rentalPerM2Day * rentalDaysB);

    // Strategy C — Fully parallel (N sets)
    const totalC = cycleDays;
    const rentalDaysC = totalC + 2 * transportDays;
    const rentalCostC = round0(pocetTaktu * set_area_m2 * rentalPerM2Day * rentalDaysC);

    // ── AUTO-OPTIMIZATION ───────────────────────────────────────────────────

    const strategies = [
      { id: 'A', label: 'Posloupně (1 sada)', sets: 1,          total_days: totalA, rental_cost: rentalCostA },
      { id: 'B', label: 'S překrytím (2 sady)', sets: 2,        total_days: totalB, rental_cost: rentalCostB },
      { id: 'C', label: 'Paralelně (plný)',     sets: pocetTaktu, total_days: totalC, rental_cost: rentalCostC },
    ];

    // Filter: C = 'parallel with N sets' is only meaningful when N > 2
    // (N=1: C≡A, N=2: C≡B — no value to show it separately)
    const filteredStrategies = pocetTaktu <= 2
      ? strategies.filter(s => s.id !== 'C')
      : strategies;

    // Guard against empty array (should not happen, but prevents crash)
    const safeStrategies = filteredStrategies.length > 0 ? filteredStrategies : strategies;
    const minCost = safeStrategies.reduce((a, b) => a.rental_cost <= b.rental_cost ? a : b);
    const minTime = safeStrategies.reduce((a, b) => a.total_days <= b.total_days ? a : b);

    // ── Labor cost ──────────────────────────────────────────────────────────

    const wageCzkH = crewCfg.shift === 8 ? 380 : 398; // typical CZ rates
    const laborCostPerTact = round0((assemblyH + disassemblyH + rebarHours) * wageCzkH);
    const laborCostTotal   = laborCostPerTact * pocetTaktu;

    // ── Build response ──────────────────────────────────────────────────────

    const deterministic = {
      // Capture cycle
      pocet_taktu:               pocetTaktu,
      total_area_m2,
      set_area_m2,
      assembly_days:             round2(A),
      rebar_days:                round2(R),
      concrete_days:             B,
      curing_days:               adjustedCuringDays,
      curing_base_days:          curingDays,
      cement_factor:             cementFactor,
      disassembly_days:          round2(D),
      cycle_days:                cycleDays,
      work_days:                 workDays,
      // Props (horizontal)
      props_min_days:            propsDays,
      orientation:               ORIENTATION[construction_type] || 'vertical',
      // Strategies
      strategies:                filteredStrategies,
      recommended_cost:          minCost.id,
      recommended_time:          minTime.id,
      // Crew
      crew_size:                 crewCfg.crew,
      shift_hours:               crewCfg.shift,
      crane:                     crewCfg.crane,
      // Rebar
      rebar:                     rebarDetails,
      // Cost
      labor_cost_per_tact:       laborCostPerTact,
      labor_cost_total:          laborCostTotal,
      rental_per_m2_day:         round2(rentalPerM2Day),
      // Legacy compat fields
      assembly_days_per_tact:    round2(A),
      disassembly_days_per_tact: round2(D),
      days_per_tact:             round1(A + D),
      zrani_days:                adjustedCuringDays,
      formwork_term_days:        totalA,  // default = strategy A
    };

    logger.info(`[Formwork v2] ${pocetTaktu} taktů, cycle=${cycleDays}d, A=${totalA}d B=${totalB}d C=${totalC}d`);

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
      warnings.push(`CEM III: pomalý nárůst pevnosti — ošetřování ×${cementFactor} (TKP17)`);
    }
    if (construction_type === 'mostovka') {
      warnings.push('Mostovka: stojky nesmí se odstraňovat min. ' + propsDays + ' dní — počítat v nájmu');
    }
    if (construction_type === 'pilire_mostu') {
      warnings.push('Pilíře: takt max 3,0 m výšky, krytí 50 mm, XC4/XF3 (TKP18)');
    }
    if (ORIENTATION[construction_type] === 'horizontal' && propsDays > 0) {
      warnings.push(`Stojky zůstávají min. ${propsDays} dní — pronájem stojek navíc`);
    }
    if (pocetTaktu > 10) {
      warnings.push(`${pocetTaktu} taktů — zvažte strategii B (2 sady) pro zkrácení`);
    }
    if (safeStrategies.length > 0 && minCost.id !== minTime.id) {
      warnings.push(`Optimum: ${minCost.label} = nejlevnější (${minCost.rental_cost.toLocaleString('cs')} Kč), ${minTime.label} = nejrychlejší (${minTime.total_days} dní)`);
    }
    if (hasRebar && crew_size_rebar > 0 && crew_size_rebar !== crewCfg.crew) {
      warnings.push(`Paralelní armování: brig. ${rebarDetails.rebar_crew} arm. + ${crewCfg.crew} bedna. — úspora ${rebarDetails.parallel_overlap.toFixed(1)} dní/takt`);
    }

    // ── AI explanation ──────────────────────────────────────────────────────

    let aiExplanation = '';
    let modelUsed = model;

    try {
      const consLabel   = CONSTRUCTION_LABELS[construction_type] || construction_type;
      const seasonLabel = SEASON_LABELS[season] || season;
      const concrLabel  = concrete_class.replace('_', '/');
      const crewLabel   = `${crewCfg.crew} lidí${crewCfg.crane ? ' + jeřáb' : ''}`;

      const stratSummary = filteredStrategies.map(s =>
        `${s.id}: ${s.total_days}d / ${s.rental_cost.toLocaleString('cs')} Kč (${s.sets} sad)`
      ).join('; ');

      if (model === 'openai' && process.env.OPENAI_API_KEY) {
        const prompt =
          `Jsi expert na stavební bednění. Zhodnoť plán pro "${consLabel}" (${system_name}). `
          + `${total_area_m2} m², ${pocetTaktu} taktů. Beton ${concrLabel}, ${seasonLabel}. Parta ${crewLabel}. `
          + `Cyklus zachvatky: montáž ${A}d + armování ${R}d + betonáž 1d + zrání ${C}d + demontáž ${D}d = ${cycleDays}d. `
          + `Strategie: ${stratSummary}. `
          + `Doporuč optimální strategii. Stručně, max 5 vět.`;

        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), CORE_TIMEOUT);
        const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.4 }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          aiExplanation = oaiData.choices?.[0]?.message?.content || '';
          modelUsed = 'gpt-4o-mini';
        } else {
          throw new Error(`OpenAI ${oaiRes.status}`);
        }

      } else {
        const isDetailed = model === 'claude';
        const question = isDetailed
          ? `Podrobné doporučení pro bednění "${consLabel}" (${system_name}). `
            + `${total_area_m2} m², ${pocetTaktu} taktů. ${concrLabel}, ${seasonLabel}, ${crewLabel}. `
            + `Cyklus: A=${A}d R=${R}d B=1d C=${C}d D=${D}d = ${cycleDays}d. `
            + `Strategie: ${stratSummary}. Odkaž na TKP17/TKP18.`
          : `Shrň: bednění "${consLabel}" ${total_area_m2} m², ${pocetTaktu}×${cycleDays}d. ${stratSummary}. Co hlídat?`;

        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), CORE_TIMEOUT);
        const aiRes = await fetch(`${CORE_API_URL}/api/v1/multi-role/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            context: { tool: 'formwork_assistant_v2', construction_type, season, deterministic },
            enable_kb: true, enable_perplexity: false, use_cache: true,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiExplanation = aiData.answer || '';
        } else {
          throw new Error(`Multi-Role ${aiRes.status}`);
        }
      }
    } catch (aiErr) {
      logger.warn(`[Formwork v2] AI ${aiErr.name === 'AbortError' ? 'timeout' : 'error'}: ${aiErr.message}`);
      aiExplanation = buildFallbackExplanation(deterministic, construction_type, season, warnings);
      modelUsed = 'fallback';
    }

    res.json({
      success: true,
      deterministic,
      ai_explanation: aiExplanation,
      warnings,
      model_used: modelUsed,
    });

  } catch (err) {
    logger.error('[Formwork v2] Error:', err);
    res.status(500).json({ error: 'Formwork assistant failed', details: err.message });
  }
});

// ── Fallback explanation ────────────────────────────────────────────────────

function buildFallbackExplanation(det, constructionType, season, warnings) {
  const constr = CONSTRUCTION_LABELS[constructionType] || constructionType;
  const lines = [
    `**Kalkulace bednění v2 — ${constr}**`,
    ``,
    `Plocha **${det.total_area_m2} m²** → **${det.pocet_taktu} taktů** po ${det.set_area_m2} m².`,
    ``,
    `**Cyklus zachvátky:**`,
    `| Fáze | Dní |`,
    `|---|---|`,
    `| Montáž opalubky | ${det.assembly_days} |`,
    det.rebar ? `| Armování | ${det.rebar_days} (${det.rebar.rebar_mass_kg} kg) |` : null,
    `| Betonáž | ${det.concrete_days} |`,
    `| Zrání (min. ČSN) | ${det.curing_days}${det.cement_factor > 1 ? ` (základ ${det.curing_base_days}d × CEM III ×${det.cement_factor})` : ''} |`,
    `| Demontáž | ${det.disassembly_days} |`,
    `| **Celkem cyklus** | **${det.cycle_days} dní** |`,
    ``,
    `**Srovnání strategií:**`,
    `| Strategie | Sady | Doba | Nájem |`,
    `|---|---|---|---|`,
    ...det.strategies.map(s =>
      `| ${s.label} | ${s.sets} | ${s.total_days} dní | ${s.rental_cost.toLocaleString('cs')} Kč |`
    ),
  ].filter(Boolean);

  if (det.props_min_days > 0) {
    lines.push(``, `⚠️ Stojky zůstávají min. **${det.props_min_days} dní** (horizontální konstrukce).`);
  }
  if (warnings.length > 0) {
    lines.push('', '**Upozornění:**');
    warnings.forEach(w => lines.push(`- ${w}`));
  }
  lines.push('', '_AI nedostupná — zobrazena deterministická kalkulace._');
  return lines.join('\n');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function round0(v) { return Math.round(v); }
function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return Math.round(v * 100) / 100; }

export default router;
