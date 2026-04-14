/**
 * Pour Decision Tree v2.0
 *
 * Core principle: The ONLY parameter determining pour mode is the presence
 * of dilatační spáry (dilation joints). NOT element type, NOT volume alone.
 *
 * Terminology:
 *   - Spára (dilatační spára) = physical joint in the structure (permanent, designed by architect)
 *   - Záběr (capture/tact)    = construction pour unit (temporary, decided by builder)
 *   - Sekce (section)         = portion of structure between two adjacent spáry
 *
 * Relationship: num_sections = structure divided by spáry.
 *               num_tacts ≤ num_sections (can combine small sections into one tact).
 *
 * Decision flow:
 *   has_spary? ──YES──→ sectional (can interrupt)
 *              │         ├─ adjacent? → chess order (odd→cure→even)
 *              │         ├─ independent? → any order
 *              │         └─ vertical? → bottom-to-top
 *              │
 *              └──NO───→ monolithic (must complete in one pass)
 *                        ├─ fits 1 pump? → simple pour
 *                        ├─ needs N pumps? → multi-pump
 *                        └─ mega pour (>500m³)? → backup pump required
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Pour mode — determined by has_dilatacni_spary */
export type PourMode = 'sectional' | 'monolithic';

/** Sub-mode for sectional pouring.
 *  `manual_override` is set by the orchestrator when the user provides
 *  `num_tacts_override` — derived fields (pumps, t_window, pour_hours_per_tact)
 *  get recomputed for the smaller per-tact volume (Block D). */
export type SectionalSubMode = 'independent' | 'adjacent_chess' | 'vertical_layers' | 'manual_override';

/** Sub-mode for monolithic pouring */
export type MonolithicSubMode = 'single_pump' | 'multi_pump' | 'mega_pour';

/** Temperature/season affecting t_window */
export type SeasonMode = 'hot' | 'normal' | 'cold';

/** Element type — used ONLY for default suggestions, NOT for mode determination */
export type StructuralElementType =
  // ─── Bridge elements (mostní prvky) ───
  | 'zaklady_piliru'      // Základy pilířů mostu
  | 'driky_piliru'        // Dříky pilířů / sloupy mostu
  | 'rimsa'               // Římsová deska
  | 'operne_zdi'          // Opěrné zdi (mostní i pozemní)
  | 'mostovkova_deska'    // Mostovková deska / nosná konstrukce
  | 'rigel'               // Příčník / ригель
  | 'opery_ulozne_prahy'  // Opěry, úložné prahy
  | 'kridla_opery'        // Křídla mostních opěr (wing walls)
  | 'mostni_zavirne_zidky'// Mostní závěrné zídky
  | 'prechodova_deska'   // Přechodová deska mostních opěr
  // ─── Building elements (pozemní stavby) ───
  | 'zakladova_deska'     // Základová deska (foundation slab)
  | 'zakladovy_pas'       // Základový pás (strip foundation)
  | 'zakladova_patka'     // Základová patka (pad foundation)
  | 'stropni_deska'       // Stropní deska / podlahová deska (floor slab)
  | 'stena'               // Monolitická stěna (wall, core wall, shear wall)
  | 'sloup'               // Sloup (column, pillar)
  | 'pruvlak'             // Průvlak / trám (beam, girder)
  | 'schodiste'           // Schodiště (staircase)
  | 'nadrz'               // Nádrž / jímka / bazén (tank, reservoir, pool)
  | 'podzemni_stena'      // Podzemní stěna / milánská stěna (diaphragm wall)
  | 'pilota'              // Pilota / mikropilota (pile)
  | 'other';

// ─── Input / Output ─────────────────────────────────────────────────────────

export interface PourDecisionInput {
  // === REQUIRED (user must provide) ===
  element_type: StructuralElementType;
  volume_m3: number;                    // Total volume of the element
  has_dilatacni_spary: boolean;         // THE key decision parameter

  // === REQUIRED if has_spary=true ===
  spara_spacing_m?: number;             // Distance between joints (m)
  total_length_m?: number;              // Total length of element (m)
  adjacent_sections?: boolean;          // Sections touch each other?

  /**
   * BUG-4: Are pracovní (working) joints allowed when the element has NO
   * dilatační spáry?
   *   - undefined / 'no'  → strictly monolithic (1 záběr) — backward compatible default
   *   - 'yes'             → working joints allowed, sectioning by capacity
   *   - 'unknown'         → same as 'yes', but emits an "ověřte v RDS" warning
   *
   * Pracovní spára ≠ dilatační spára: the latter is permanent and designed by
   * the architect, the former is a temporary construction joint decided by the
   * builder. They can exist independently.
   */
  working_joints_allowed?: 'yes' | 'no' | 'unknown';

  // === PUMP PARAMETERS ===
  q_eff_m3_h?: number;                  // Pump effective capacity (m³/h) — default 30
  setup_hours?: number;                 // Per-pour setup (h) — default 0.5
  washout_hours?: number;               // Per-pour washout (h) — default 0.5

  // === ENVIRONMENT ===
  season?: SeasonMode;                  // Affects t_window — default 'normal'
  use_retarder?: boolean;               // PCE retarder available? — default false
}

export interface PourDecisionOutput {
  // === MODE ===
  pour_mode: PourMode;
  sub_mode: SectionalSubMode | MonolithicSubMode;

  // === SECTIONS & TACTS ===
  num_sections: number;                 // Sections between spáry (or 1 if monolithic)
  section_volume_m3: number;            // Volume per section
  max_sections_per_tact: number;        // How many sections fit in one pour window
  num_tacts: number;                    // Actual construction captures
  tact_volume_m3: number;              // Volume per tact

  // === PUMP ===
  t_window_hours: number;              // Continuous pour window (hours)
  pumps_required: number;              // Number of pumps needed
  retarder_required: boolean;          // PCE retarder needed?
  backup_pump: boolean;                // Standby pump needed?

  // === TIME ===
  pour_hours_per_tact: number;         // Pouring time per tact
  total_pour_hours: number;            // Total pouring time (all tacts)

  // === SCHEDULING HINT ===
  scheduling_mode: 'linear' | 'chess'; // For element-scheduler
  cure_between_neighbors_h: number;    // Min cure time between adjacent sections (0 if independent)

  // === WARNINGS ===
  warnings: string[];

  // === TRACEABILITY ===
  decision_log: string[];              // Step-by-step reasoning
}

// ─── T-Window Lookup ────────────────────────────────────────────────────────

/** Maximum continuous pour window (hours) by season and retarder */
export const T_WINDOW_HOURS: Record<SeasonMode, { no_retarder: number; with_retarder: number }> = {
  hot:    { no_retarder: 4,  with_retarder: 8  },
  normal: { no_retarder: 5,  with_retarder: 8  },
  cold:   { no_retarder: 6,  with_retarder: 10 },
};

// ─── Element Defaults Catalog ───────────────────────────────────────────────

export interface ElementDefaults {
  typical_has_spary: boolean | 'depends';
  typical_sub_mode: SectionalSubMode | null;
  typical_spara_spacing_m: number | null;
  description_cs: string;
}

export const ELEMENT_DEFAULTS: Record<StructuralElementType, ElementDefaults> = {
  zaklady_piliru: {
    typical_has_spary: true,
    typical_sub_mode: 'independent',
    typical_spara_spacing_m: null,
    description_cs: 'Základy pilířů — každý základ = samostatná zachvatka, bez smejnosti',
  },
  driky_piliru: {
    typical_has_spary: true,
    typical_sub_mode: 'vertical_layers',
    typical_spara_spacing_m: null,
    description_cs: 'Dříky pilířů — horizontální pracovní švy, zespodu nahoru',
  },
  rimsa: {
    typical_has_spary: true,
    typical_sub_mode: 'adjacent_chess',
    typical_spara_spacing_m: 20,
    description_cs: 'Římsová deska — spáry VŽDY (20-30 m), šachovnicový postup povinný',
  },
  operne_zdi: {
    typical_has_spary: true,
    typical_sub_mode: 'adjacent_chess',
    typical_spara_spacing_m: 10,
    description_cs: 'Opěrné zdi — spáry (8-12 m), šachovnicový pořadí doporučen',
  },
  mostovkova_deska: {
    typical_has_spary: 'depends',
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Mostovková deska — ZÁVISÍ NA PROJEKTU: se spárami = sekční, bez = monolitická',
  },
  rigel: {
    typical_has_spary: 'depends',
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Příčník — krátký (<10 m) = monolit, dlouhý = podle projektu',
  },
  opery_ulozne_prahy: {
    typical_has_spary: true,
    typical_sub_mode: 'independent',
    typical_spara_spacing_m: null,
    description_cs: 'Opěry, úložné prahy — spáry obvykle ano, libovolné pořadí',
  },
  kridla_opery: {
    typical_has_spary: false,
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Křídla opěr — VŽDY samostatný záběr, oddělená sada bednění od dříku opěry',
  },
  mostni_zavirne_zidky: {
    typical_has_spary: false,
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Závěrné zídky — malý monolit, bez švů',
  },
  prechodova_deska: {
    typical_has_spary: false,
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Přechodová deska — jednoduchá geometrie, monolit za opěrou, bez švů',
  },
  // ─── Building elements ───
  zakladova_deska: {
    typical_has_spary: 'depends',
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Základová deska — malá (<100m²) = monolit, velká = se spárami (15-25 m)',
  },
  zakladovy_pas: {
    typical_has_spary: false,
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Základový pás — obvykle monolit v jednom záběru',
  },
  zakladova_patka: {
    typical_has_spary: false,
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Základová patka — vždy monolit, každá patka = 1 záběr',
  },
  stropni_deska: {
    typical_has_spary: 'depends',
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Stropní deska — malá (<200m²) = monolit, velká = se spárami. Vyžaduje skruž/stojky.',
  },
  stena: {
    typical_has_spary: 'depends',
    typical_sub_mode: 'adjacent_chess',
    typical_spara_spacing_m: 6,
    description_cs: 'Monolitická stěna — krátká = monolit, dlouhá = záběry 4-8 m, šachovnicový postup',
  },
  sloup: {
    typical_has_spary: false,
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Sloup — vždy monolit v jednom záběru, každý sloup = 1 záběr',
  },
  pruvlak: {
    typical_has_spary: false,
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Průvlak/trám — obvykle monolit společně se stropní deskou. Vyžaduje skruž.',
  },
  schodiste: {
    typical_has_spary: false,
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Schodiště — monolit, složité bednění, spodní bednění + boční šablony',
  },
  nadrz: {
    typical_has_spary: true,
    typical_sub_mode: 'adjacent_chess',
    typical_spara_spacing_m: 6,
    description_cs: 'Nádrž/jímka — vodonepropustný beton (C30/37 XA), záběry 4-8 m, šachovnicový postup',
  },
  podzemni_stena: {
    typical_has_spary: true,
    typical_sub_mode: 'independent',
    typical_spara_spacing_m: null,
    description_cs: 'Podzemní/milánská stěna — každý panel = 1 záběr, betonáž pod bentonitovou suspenzi',
  },
  pilota: {
    typical_has_spary: false,
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Pilota — monolit, betonáž kontraktorovou rourou, každá pilota = 1 záběr',
  },
  other: {
    typical_has_spary: 'depends',
    typical_sub_mode: null,
    typical_spara_spacing_m: null,
    description_cs: 'Jiný typ — nutno zadat ručně',
  },
};

// ─── Decision Engine ────────────────────────────────────────────────────────

const MEGA_POUR_THRESHOLD_M3 = 500;

export function decidePourMode(input: PourDecisionInput): PourDecisionOutput {
  const log: string[] = [];
  const warnings: string[] = [];

  // Defaults
  const q_eff = input.q_eff_m3_h ?? 30;
  const setup_h = input.setup_hours ?? 0.5;
  const washout_h = input.washout_hours ?? 0.5;
  const season = input.season ?? 'normal';
  const use_retarder = input.use_retarder ?? false;

  // T-window lookup
  const t_window = use_retarder
    ? T_WINDOW_HOURS[season].with_retarder
    : T_WINDOW_HOURS[season].no_retarder;

  log.push(`T-window: ${t_window}h (season=${season}, retarder=${use_retarder})`);

  // Available pumping time per window (minus setup/washout)
  const available_pumping_h = t_window - setup_h - washout_h;
  if (available_pumping_h <= 0) {
    throw new Error(
      `t_window (${t_window}h) must exceed setup (${setup_h}h) + washout (${washout_h}h)`
    );
  }

  // ─── BRANCH: has_dilatacni_spary ─────────────────────────────────────────

  if (input.has_dilatacni_spary) {
    log.push('Spáry: ANO → sekční režim');

    // Calculate sections
    let num_sections: number;
    if (input.spara_spacing_m && input.total_length_m && input.spara_spacing_m > 0) {
      num_sections = Math.ceil(input.total_length_m / input.spara_spacing_m);
      log.push(`Sections: ceil(${input.total_length_m}m / ${input.spara_spacing_m}m) = ${num_sections}`);
    } else {
      // If no spacing info, assume sections from volume (each ~section_volume)
      const max_vol_per_section = q_eff * available_pumping_h;
      num_sections = Math.max(1, Math.ceil(input.volume_m3 / max_vol_per_section));
      log.push(`Sections: estimated from volume = ${num_sections}`);
      warnings.push('Chybí spara_spacing_m nebo total_length_m — počet sekcí odhadnut z objemu');
    }

    const section_volume = input.volume_m3 / num_sections;
    log.push(`Section volume: ${roundTo(section_volume, 1)} m³`);

    // How many sections fit in one tact (pour window)?
    const max_vol_per_tact = q_eff * available_pumping_h;
    const max_sections_per_tact = Math.max(1, Math.floor(max_vol_per_tact / section_volume));
    const num_tacts = Math.ceil(num_sections / max_sections_per_tact);
    const tact_volume = input.volume_m3 / num_tacts;

    log.push(`Max sections/tact: ${max_sections_per_tact} (max ${roundTo(max_vol_per_tact, 0)} m³/tact)`);
    log.push(`Tacts: ${num_tacts}, each ${roundTo(tact_volume, 1)} m³`);

    // Determine sub-mode
    const adjacent = input.adjacent_sections ?? false;
    let sub_mode: SectionalSubMode;
    let scheduling_mode: 'linear' | 'chess';
    let cure_between: number;

    // Check element defaults for suggestion
    const defaults = ELEMENT_DEFAULTS[input.element_type];
    if (defaults.typical_sub_mode) {
      sub_mode = defaults.typical_sub_mode;
      log.push(`Sub-mode from element defaults: ${sub_mode} (${defaults.description_cs})`);
    } else if (adjacent) {
      sub_mode = 'adjacent_chess';
      log.push('Adjacent=true → šachovnicový pořadí');
    } else {
      sub_mode = 'independent';
      log.push('Adjacent=false → libovolné pořadí');
    }

    // Override by adjacency if explicitly provided
    if (input.adjacent_sections === true && sub_mode === 'independent') {
      sub_mode = 'adjacent_chess';
      log.push('Override: adjacent_sections=true → chess');
    }
    if (input.adjacent_sections === false && sub_mode === 'adjacent_chess') {
      sub_mode = 'independent';
      log.push('Override: adjacent_sections=false → independent');
    }

    scheduling_mode = sub_mode === 'adjacent_chess' ? 'chess' : 'linear';
    cure_between = sub_mode === 'adjacent_chess' ? 24 : 0;

    // Pour time per tact (1 pump per tact in sectional mode)
    const pour_h_per_tact = setup_h + (tact_volume / q_eff) + washout_h;

    return {
      pour_mode: 'sectional',
      sub_mode,
      num_sections,
      section_volume_m3: roundTo(section_volume, 2),
      max_sections_per_tact,
      num_tacts,
      tact_volume_m3: roundTo(tact_volume, 2),
      t_window_hours: t_window,
      pumps_required: 1,
      retarder_required: false,
      backup_pump: false,
      pour_hours_per_tact: roundTo(pour_h_per_tact, 2),
      total_pour_hours: roundTo(pour_h_per_tact * num_tacts, 2),
      scheduling_mode,
      cure_between_neighbors_h: cure_between,
      warnings,
      decision_log: log,
    };
  }

  // ─── BUG-4 + Block C: NO dilatační spáry, check working joints ──────────
  // Block C (2026-04): unify default — when the user hasn't explicitly set
  // working_joints_allowed, treat it as 'unknown' (sectional by capacity +
  // warning "ověřte v RDS"). Previously undefined fell through to the
  // strict monolithic branch silently, which made the first Aplikovat for
  // any no-dilatace element produce num_tacts=1 without warning. Explicit
  // 'no' still forces a single continuous pour with its own warning.
  const wjRaw = input.working_joints_allowed;
  const wjAllowed: 'yes' | 'no' | 'unknown' =
    wjRaw === 'no' ? 'no' :
    wjRaw === 'yes' ? 'yes' :
    'unknown';  // covers 'unknown', undefined, ''

  if (wjAllowed === 'yes' || wjAllowed === 'unknown') {
    log.push(`Dilatační spáry: NE, pracovní spáry: ${wjAllowed}${wjRaw == null || wjRaw === ('' as any) ? ' (default)' : ''} → sekční režim po pracovních spárách`);

    if (wjAllowed === 'unknown') {
      warnings.push(
        'Pracovní spáry nepotvrzeny — ověřte v RDS. ' +
        'Bez dilatačních spár: doporučena minimalizace pracovních spár. ' +
        'Definitivní členění záběrů dle RDS/statiky.',
      );
    }

    // Compute number of tacts purely by volume / window capacity
    const max_vol_per_tact = q_eff * available_pumping_h;
    const num_tacts = Math.max(1, Math.ceil(input.volume_m3 / max_vol_per_tact));
    const tact_volume = input.volume_m3 / num_tacts;
    const pour_h_per_tact = setup_h + (tact_volume / q_eff) + washout_h;

    log.push(`Working joints: ${num_tacts} záběrů × ${roundTo(tact_volume, 1)} m³ ` +
      `(max ${roundTo(max_vol_per_tact, 0)} m³/okno)`);

    return {
      pour_mode: 'sectional',
      sub_mode: 'independent',
      num_sections: num_tacts,
      section_volume_m3: roundTo(tact_volume, 2),
      max_sections_per_tact: 1,
      num_tacts,
      tact_volume_m3: roundTo(tact_volume, 2),
      t_window_hours: t_window,
      pumps_required: 1,
      retarder_required: false,
      backup_pump: false,
      pour_hours_per_tact: roundTo(pour_h_per_tact, 2),
      total_pour_hours: roundTo(pour_h_per_tact * num_tacts, 2),
      scheduling_mode: 'linear',
      cure_between_neighbors_h: 0,
      warnings,
      decision_log: log,
    };
  }

  // ─── BRANCH: explicit 'no' pracovní spáry → strict monolithic ─────────
  // After Block C, this branch is only reachable when the user explicitly
  // disallowed pracovní spáry — undefined/'' now routes through 'unknown'
  // in the sectional branch above.

  log.push("Pracovní spáry: NE (explicit) → monolitický režim (nepřerušitelná zálivka)");
  warnings.push(
    'Bez dilatačních spár a bez pracovních spár: vyžaduje nepřetržitou betonáž. ' +
    'Definitivní členění záběrů dle RDS/statiky.',
  );

  const V = input.volume_m3;
  const pumping_h_1pump = V / q_eff;
  const pour_h_1pump = setup_h + pumping_h_1pump + washout_h;

  log.push(`1 pump: ${roundTo(pumping_h_1pump, 1)}h pumping + ${setup_h + washout_h}h overhead = ${roundTo(pour_h_1pump, 1)}h total`);

  // Does it fit in 1 pump within t_window?
  let pumps_required: number;
  let sub_mode: MonolithicSubMode;
  let retarder_required = use_retarder;
  let backup_pump = false;

  if (pour_h_1pump <= t_window) {
    // Fits in 1 pump
    pumps_required = 1;
    sub_mode = 'single_pump';
    log.push(`✅ 1 pump fits: ${roundTo(pour_h_1pump, 1)}h ≤ ${t_window}h window`);
  } else {
    // Need multiple pumps
    // First try with retarder if not already using one
    const t_window_with_retarder = T_WINDOW_HOURS[season].with_retarder;
    if (!use_retarder && pour_h_1pump <= t_window_with_retarder) {
      // Retarder solves it with 1 pump
      pumps_required = 1;
      sub_mode = 'single_pump';
      retarder_required = true;
      log.push(`⚠️ S retardérem (PCE): ${roundTo(pour_h_1pump, 1)}h ≤ ${t_window_with_retarder}h → 1 pump`);
      warnings.push(`Vyžadován retardér (PCE) pro dodržení okna ${t_window_with_retarder}h`);
    } else {
      // Multiple pumps needed
      const effective_t = use_retarder ? t_window : t_window_with_retarder;
      retarder_required = true;
      const available_h = effective_t - setup_h - washout_h;
      pumps_required = Math.ceil(V / (q_eff * available_h));
      log.push(`Multi-pump: N = ceil(${V} / (${q_eff} × ${roundTo(available_h, 1)})) = ${pumps_required}`);

      if (V >= MEGA_POUR_THRESHOLD_M3) {
        sub_mode = 'mega_pour';
        backup_pump = true;
        warnings.push(`MEGA zálivka (${V} m³ ≥ ${MEGA_POUR_THRESHOLD_M3}): záložní čerpadlo povinné`);
        log.push(`🔴 Mega pour: V=${V}m³ ≥ ${MEGA_POUR_THRESHOLD_M3}m³ → backup pump`);
      } else {
        sub_mode = 'multi_pump';
      }
    }
  }

  // Effective pour time with N pumps
  const effective_q = q_eff * pumps_required;
  const pour_h = setup_h + (V / effective_q) + washout_h;

  if (pumps_required > 1) {
    const pCtx = `[Celkem ${V} m³]`;
    warnings.push(`${pCtx} ${pumps_required} čerpadel potřeba — interval domíchávačů ≤ 8 min`);
    warnings.push(`${pCtx} Před zahájením nutný podpis PDK (plán kontroly a zkoušek)`);
    if (pour_h > 8) {
      warnings.push(`${pCtx} Zálivka ${roundTo(pour_h, 1)}h > 8h — zajistit osvětlení pracoviště`);
    }
  }

  return {
    pour_mode: 'monolithic',
    sub_mode,
    num_sections: 1,
    section_volume_m3: V,
    max_sections_per_tact: 1,
    num_tacts: 1,
    tact_volume_m3: V,
    t_window_hours: retarder_required ? T_WINDOW_HOURS[season].with_retarder : t_window,
    pumps_required,
    retarder_required,
    backup_pump,
    pour_hours_per_tact: roundTo(pour_h, 2),
    total_pour_hours: roundTo(pour_h, 2),
    scheduling_mode: 'linear',
    cure_between_neighbors_h: 0,
    warnings,
    decision_log: log,
  };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
