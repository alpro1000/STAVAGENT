/**
 * Resource Ceiling — Per-Element Resource Constraint Model
 *
 * Phase 1 deliverable per Phase 0 audit recommendations R1–R4.
 * Branch: `claude/calculator-resource-ceiling-phase0`.
 *
 * Single union schema (one TypeScript interface) for the strop of resources
 * available on site. Per-element relevance flags decide which fields are
 * applicable for a given `StructuralElementType`; everything else is
 * silently ignored by the engine.
 *
 * Customer problem: kalkulátor doporučuje 30 lidí když je dostupných 12.
 * Demo otázka: *"u nás je fixně 12 lidí, jak to spočítáš?"*
 * Resource Ceiling answers that — either a feasible plán within the ceiling,
 * or an explicit ⛔ KRITICKÉ warning with a concrete recovery suggestion.
 *
 * Confidence ladder (per task spec §5.5, audit §5.3):
 *   - Manual user input               → 0.99 (engine NEVER exceeds)
 *   - Default from B4 knowledge_base  → 0.85
 *   - Auto-derived lower bound (DIN 18218 / ČSN EN 13670)
 *                                     → 1.00 (if ceiling < lower bound → INFEASIBLE)
 *
 * Decision: defaults are embedded in this module mirroring the B4 YAML
 * (`concrete-agent/.../B4_production_benchmarks/default_ceilings/<el>.yaml`).
 * The YAML is the source-of-truth document; the TS constants are the runtime
 * cache. A KB-lookup runtime path is Phase 2+ work.
 *
 * Reference:
 *   - `docs/audits/calculator_resource_ceiling/2026-05-07_phase0_audit.md` §6.1
 *   - `concrete-agent/.../B4_production_benchmarks/{bedneni,productivity_rates}.json`
 *   - `Monolit-Planner/docs/ELEMENT_CATALOG_REFERENCE.md`
 *   - Task spec §5 (Phase 1 — Shared Resource Constraint Model)
 */

import type { StructuralElementType } from './pour-decision.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Per-profession worker breakdown (volitelný; doplňuje `num_workers_total`). */
export interface ResourceCeilingWorkforce {
  /** Celkový strop osob ve směně. */
  num_workers_total?: number;
  /** Tesaři / bednáři. Bednění montáž + demontáž. */
  num_carpenters?: number;
  /** Železáři. Vázání + položení výztuže. */
  num_rebar_workers?: number;
  /** Betonáři. Ukládání betonu během záběru (ukladani). */
  num_concrete_workers?: number;
  /** Vibrátoři. Vibrace během záběru. */
  num_vibrators?: number;
  /** Finišéři / hladičky. Povrchová úprava (mostovka, stropní deska, podlaha). */
  num_finishers?: number;
  /** Řízení (stavbyvedoucí, mistr, geodet, laborant). Per ČSN 73 0212 obvykle
   *  v "Zařízení staveniště" VRN, ale strop omezuje souběh. */
  num_supervisors?: number;
}

/** Strop bednění + podpěrné konstrukce + MSS. */
export interface ResourceCeilingFormwork {
  /** Počet kompletních sad bednění (rámového / nosníkového). */
  num_formwork_sets?: number;
  /** Počet kompletních sad skruže (těžké podpěrné konstrukce — mostovka). */
  num_falsework_sets?: number;
  /** Počet kompletních sad stojek (lehké podpěry — strop, příčník). */
  num_props_sets?: number;
  /** MSS systém k dispozici? (Posuvná skruž, pouze pro mostovkova_deska.) */
  mss_set_available?: boolean;
  /** Max výška kompletní sady stojek (m). */
  props_max_height_m?: number;
}

/** Strop pump + plant + mixer + zvedací techniky. */
export interface ResourceCeilingEquipment {
  /** Počet čerpadel (vlastních / pronajatých). */
  num_pumps?: number;
  /** Počet záložních čerpadel (per `TASK_MegaPour_CrewLogic_Warnings.md`
   *  pro MEGA pour ≥500 m³ povinné). */
  num_backup_pumps?: number;
  /** Kapacita betonárny (m³/h). */
  plant_rate_m3_h?: number;
  /** Rychlost doručení autodomíchávači (m³/h). */
  mixer_delivery_m3_h?: number;
  /** Počet jeřábů (nutné pro Framax/Top 50/Staxo + těžké panely). */
  num_cranes?: number;
  /** Max nosnost největšího jeřábu (kg) — porovnává se s `panel_weight_kg`. */
  crane_max_load_kg?: number;
}

/** Strop časový (deadline + zákazy). */
export interface ResourceCeilingTime {
  /** Deadline v pracovních dnech. POZN: pole `deadline_days` na `PlannerInput`
   *  zůstává jako alias pro backward compat — ceiling.time.deadline_days
   *  má precedenci pokud je obě nastavené. */
  deadline_days?: number;
  /** Zákaz prací o víkendech (sobota + neděle). */
  no_weekends?: boolean;
  /** Zákaz prací o českých státních svátcích. */
  no_holidays?: boolean;
  /** Povolený počet směn za den (1/2/3). Default 1. */
  shifts_per_day?: 1 | 2 | 3;
  /** Hodin na směnu. Default 10. */
  shift_h?: number;
  /** Povolen noční režim (§116 ZP příplatek +10 % — kontinuální MEGA pour). */
  allow_night_shift?: boolean;
}

/**
 * Strop dostupných zdrojů na element. Sada polí je union; per-element
 * `RESOURCE_RELEVANCE_BY_ELEMENT` rozhoduje, které jsou relevantní.
 *
 * Engine NIKDY nepřekročí manual user input (confidence 0.99) — pokud
 * `auto_derived_lower_bound > user_ceiling`, vrátí ⛔ KRITICKÉ warning
 * + best-effort plán s konkrétními překročeními označenými.
 */
export interface ResourceCeiling {
  workforce?: ResourceCeilingWorkforce;
  formwork?: ResourceCeilingFormwork;
  equipment?: ResourceCeilingEquipment;
  time?: ResourceCeilingTime;
  /** Metadata: confidence per task §5.5. Default 0.99 (manual). */
  confidence?: number;
  /** Source of the ceiling values. 'manual' = user-supplied,
   *  'kb_default' = auto-filled z B4 defaults, 'auto_derived' = engine. */
  source?: 'manual' | 'kb_default' | 'auto_derived';
}

// ─── Relevance flags per element type ───────────────────────────────────────

/** Per-field relevance. Engine může strop pole `X` brát v úvahu jenom pokud
 *  `RESOURCE_RELEVANCE_BY_ELEMENT[elementType][X] === true`.
 *  Pole NEPŘÍTOMNÉ v mapě = irrelevant (false). */
export interface ResourceRelevanceMap {
  num_workers_total: boolean;
  num_carpenters: boolean;
  num_rebar_workers: boolean;
  num_concrete_workers: boolean;
  num_vibrators: boolean;
  num_finishers: boolean;
  num_supervisors: boolean;
  num_formwork_sets: boolean;
  num_falsework_sets: boolean;
  num_props_sets: boolean;
  mss_set_available: boolean;
  num_pumps: boolean;
  num_backup_pumps: boolean;
  num_cranes: boolean;
  deadline_days: boolean;
  shifts_per_day: boolean;
  allow_night_shift: boolean;
}

const DEFAULT_RELEVANCE: ResourceRelevanceMap = {
  num_workers_total: true,
  num_carpenters: true,
  num_rebar_workers: true,
  num_concrete_workers: true,
  num_vibrators: true,
  num_finishers: false,    // jen pro mostovka, stropní deska, podlaha
  num_supervisors: false,  // ČSN 73 0212 VRN scope, ne ceiling default
  num_formwork_sets: true,
  num_falsework_sets: false, // jen pro mostovka, příčník
  num_props_sets: false,    // jen pro stropní deska, průvlak, mostovka_pevná_skruž
  mss_set_available: false, // jen pro mostovkova_deska s MSS technology
  num_pumps: true,
  num_backup_pumps: false,  // jen pro MEGA pour ≥500 m³
  num_cranes: false,        // jen kde needs_crane === true v ElementProfile
  deadline_days: true,
  shifts_per_day: true,
  allow_night_shift: false, // jen pro MEGA pour
};

/**
 * Per-element relevance map. Phase 1 covers 24 typů (Gate 2 baseline).
 *
 * Pravidla per audit §4.3 + `ELEMENT_CATALOG_REFERENCE.md`:
 *   - `pilota` — žádné bednění, žádné stojky/skruž, žádní vibrátoři
 *     (vibrace probíhá tremie pipe), žádné finišéři
 *   - `podkladni_beton` — žádná výztuž → žádní železáři, žádné bednění
 *     (mimo obvodové), žádní vibrátoři (kompaktace vibrační lištou)
 *   - `mostovkova_deska` — vždy skruž / MSS / stojky, vždy finišéři
 *     (krycí vrstva), vždy jeřáb, MEGA pour → backup pumps + night shift
 *   - `rimsa` — římsové konzoly (nejsou v ceiling — fixed na NK), malé
 *     objemy bez čerpadla per záběr
 *   - `stropni_deska` / `pruvlak` — vždy stojky (Dokaflex/MULTIFLEX),
 *     finišéři pro krycí vrstvu, žádná skruž
 *   - `nadrz` / `podzemni_stena` — speciální technologie
 */
export const RESOURCE_RELEVANCE_BY_ELEMENT: Partial<Record<StructuralElementType, ResourceRelevanceMap>> = {
  // ─── Bridge — substructure ─────────────────────────────────────────────────
  zaklady_piliru: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_cranes: false,        // patky obvykle bez panelu těžkého
  },
  zaklady_oper: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_cranes: false,
  },
  driky_piliru: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_cranes: true,         // šplhací bednění + jeřáb na panel
    allow_night_shift: false,
  },
  opery_ulozne_prahy: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_cranes: true,         // masivní → Framax + jeřáb
  },
  kridla_opery: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_cranes: true,
  },
  operne_zdi: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_cranes: true,
  },
  // ─── Bridge — superstructure ───────────────────────────────────────────────
  mostovkova_deska: {
    ...DEFAULT_RELEVANCE,
    num_finishers: true,      // krycí vrstva (rotační hladička)
    num_falsework_sets: true, // pevná skruž (Top 50)
    num_props_sets: true,     // stojky (Staxo) doprovázejí skruž
    mss_set_available: true,  // pokud construction_technology = mss
    num_cranes: true,
    num_backup_pumps: true,   // MEGA pour ≥500 m³ povinný
    allow_night_shift: true,  // kontinuální MEGA
  },
  rigel: {
    ...DEFAULT_RELEVANCE,
    num_finishers: true,
    num_falsework_sets: true,
    num_props_sets: true,
    num_cranes: true,
  },
  rimsa: {
    ...DEFAULT_RELEVANCE,
    num_finishers: true,
    num_concrete_workers: true,
    num_vibrators: true,
    num_pumps: true,
    num_formwork_sets: false, // římsové konzoly fixed, nejsou v ceiling pool
    num_cranes: false,
  },
  mostni_zavirne_zidky: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_pumps: false,         // malé objemy — badie / čerpadlo volitelné
  },
  prechodova_deska: {
    ...DEFAULT_RELEVANCE,
    num_finishers: true,
  },
  podlozkovy_blok: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_pumps: false,
  },
  // ─── Special concrete ──────────────────────────────────────────────────────
  podkladni_beton: {
    ...DEFAULT_RELEVANCE,
    num_rebar_workers: false, // prostý beton (C12/15 X0), bez výztuže
    num_vibrators: false,     // kompaktace vibrační lištou (součást ukládání)
    num_finishers: false,
    num_formwork_sets: false, // přímo do výkopu, bez systémového bednění
    num_cranes: false,
  },
  pilota: {
    ...DEFAULT_RELEVANCE,
    num_carpenters: false,    // žádné bednění (pažnice / tremie)
    num_vibrators: false,     // vibrace tremie pipe
    num_finishers: false,
    num_formwork_sets: false,
    num_pumps: false,         // betonáž tremie pipe, ne čerpadlem
    num_cranes: true,         // armokoš transport + lowering
  },
  // ─── Building — foundations ────────────────────────────────────────────────
  zakladova_deska: {
    ...DEFAULT_RELEVANCE,
    num_finishers: true,      // velká plocha → hladička povinná
    num_cranes: false,
  },
  zakladovy_pas: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_pumps: false,         // do výkopu, výsyp / žlab
    num_cranes: false,
  },
  zakladova_patka: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_pumps: false,
    num_cranes: false,
  },
  // ─── Building — vertical ───────────────────────────────────────────────────
  stena: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_cranes: true,         // Framax / TRIO + jeřáb
  },
  sloup: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_cranes: true,
  },
  podzemni_stena: {
    ...DEFAULT_RELEVANCE,
    num_carpenters: false,    // bentonit suspenze, žádné systémové bednění
    num_vibrators: false,
    num_finishers: false,
    num_formwork_sets: false,
    num_cranes: true,         // milánská freza + armokoš
  },
  // ─── Building — horizontal ─────────────────────────────────────────────────
  stropni_deska: {
    ...DEFAULT_RELEVANCE,
    num_finishers: true,
    num_props_sets: true,     // Dokaflex / MULTIFLEX / SKYDECK
  },
  pruvlak: {
    ...DEFAULT_RELEVANCE,
    num_finishers: true,
    num_props_sets: true,
  },
  schodiste: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_props_sets: true,
    num_cranes: false,
  },
  // ─── Building — special ────────────────────────────────────────────────────
  nadrz: {
    ...DEFAULT_RELEVANCE,
    num_finishers: false,
    num_cranes: true,         // bílá vana — Framax + jeřáb
  },
  // `other` zůstává neimplementovaný (catch-all, engine použije DEFAULT_RELEVANCE)
};

/** Get relevance map for an element type. Falls back to `DEFAULT_RELEVANCE`
 *  pro `other` / unknown / Phase 2+ typy. */
export function getResourceRelevance(elementType: StructuralElementType): ResourceRelevanceMap {
  return RESOURCE_RELEVANCE_BY_ELEMENT[elementType] ?? DEFAULT_RELEVANCE;
}

// ─── Per-element default ceilings (B4 mirror) ───────────────────────────────

/**
 * Phase 1 deliverable: defaults pro 2 reference elements per audit §7.
 * Mirror souboru `B4_production_benchmarks/default_ceilings/<el>.yaml`.
 *
 * Defaults = "dolní polovina typického průmyslového rozsahu" (task §5.3) —
 * realistic SMB CZ přípravář setup, ne unconstrained, ne hyper-optimistic.
 *
 * Phase 2–7 doplní zbývajících 22 typů.
 */
export const RESOURCE_CEILING_DEFAULTS: Partial<Record<StructuralElementType, ResourceCeiling>> = {
  // ─── Reference A: operne_zdi (Phase 1 R1) ─────────────────────────────────
  // VP4 FORESTINA baseline: 156.4m × 1.75m × 0.4m, 94 m³, ~5 lidí pour crew
  // per `computePourCrew(94, 1, 'operne_zdi')` → Level 3 → ukladani=2 + vibrace=2
  // + finiseri=1 = 5 total. Source: B4 bedneni.json `standard_s_jeravem`
  // (4 osob + jeřáb), productivity_rates.json bedneni `slozite` (1.0 m²/h/osoba).
  operne_zdi: {
    workforce: {
      num_workers_total: 12,
      num_carpenters: 4,
      num_rebar_workers: 3,
      num_concrete_workers: 3,
      num_vibrators: 2,
    },
    formwork: {
      num_formwork_sets: 2,
    },
    equipment: {
      num_pumps: 1,
      plant_rate_m3_h: 60,
      mixer_delivery_m3_h: 40,
      num_cranes: 1,
      crane_max_load_kg: 4000,
    },
    time: {
      shifts_per_day: 1,
      shift_h: 10,
      allow_night_shift: false,
    },
    confidence: 0.85,
    source: 'kb_default',
  },

  // ─── Reference B: mostovkova_deska (Phase 1 R1) ───────────────────────────
  // SO-203 baseline: V ~664 m³ MEGA pour, dvoutrámový. Per `computePourCrew(664,
  // 2, 'mostovkova_deska')` → Level 3 → ukladani=4 + vibrace=3 + finiseri=2 = 9.
  // Plus 4 tesaři skruž + 4 železáři + 2 dozor = ~19 lidí špička.
  // Source: `TASK_MegaPour_CrewLogic_Warnings.md` formula + B4 brigady
  // `velka_s_jeravem` (6 osob velký mostní), Element_Catalog_Reference §C.24.
  mostovkova_deska: {
    workforce: {
      num_workers_total: 21,
      num_carpenters: 4,
      num_rebar_workers: 4,
      num_concrete_workers: 6,    // 2 pumps × 2 + reserve = 6 (level 3 pump-based)
      num_vibrators: 3,
      num_finishers: 2,
      num_supervisors: 2,
    },
    formwork: {
      num_formwork_sets: 1,       // pevná skruž = 1 sada pro celé pole
      num_falsework_sets: 1,      // Top 50 / VARIOKIT
      num_props_sets: 1,          // Staxo 100
    },
    equipment: {
      num_pumps: 2,
      num_backup_pumps: 1,        // MEGA pour povinný backup
      plant_rate_m3_h: 80,
      mixer_delivery_m3_h: 60,
      num_cranes: 1,
      crane_max_load_kg: 6000,
    },
    time: {
      shifts_per_day: 2,
      shift_h: 10,
      allow_night_shift: true,    // kontinuální pour pro neporušení záběru
    },
    confidence: 0.85,
    source: 'kb_default',
  },
  // TODO Phase 2–7: zbývajících 22 typů (Group A–F per task §6).
};

/**
 * Get default ceiling for an element type. Returns `undefined` for elements
 * not yet covered (Phase 2–7 will fill remaining 22 typů).
 *
 * Engine usage:
 *   const defaults = getDefaultCeiling('operne_zdi');
 *   if (!defaults) {
 *     // Phase 2-7: emit "default ceiling for {element} not yet defined" warning
 *     // engine falls back to unconstrained behaviour
 *   }
 */
export function getDefaultCeiling(elementType: StructuralElementType): ResourceCeiling | undefined {
  return RESOURCE_CEILING_DEFAULTS[elementType];
}

// ─── Merge user-supplied + defaults ─────────────────────────────────────────

/**
 * Merge user-supplied ceiling with KB defaults. User values WIN (confidence
 * 0.99 over 0.85) on every defined field; defaults fill the rest.
 *
 * Per task §5.3:
 *   "Pokud uživatel nezadá strop:
 *    - Engine použije rozumné defaulty per element type z knowledge_base."
 *
 * Per Q5 interview answer (per-profession + total):
 *   user can supply `num_workers_total` without breakdown — engine then
 *   uses default breakdown's RATIO scaled to user's total.
 */
export function applyResourceCeilingDefaults(
  elementType: StructuralElementType,
  userCeiling?: ResourceCeiling,
): ResourceCeiling {
  const defaults = getDefaultCeiling(elementType);

  if (!userCeiling && !defaults) {
    // No user input + no KB defaults for this element (Phase 2–7 TODO).
    return { source: 'auto_derived', confidence: 1.0 };
  }
  if (!userCeiling) {
    return { ...(defaults as ResourceCeiling), source: 'kb_default' };
  }
  if (!defaults) {
    return { ...userCeiling, source: 'manual', confidence: userCeiling.confidence ?? 0.99 };
  }

  // Both present — merge. User wins per field; defaults fill gaps.
  // Special handling: if user gave num_workers_total but no breakdown,
  // scale defaults' breakdown to match user's total.
  const merged: ResourceCeiling = {
    workforce: mergeWorkforce(defaults.workforce, userCeiling.workforce),
    formwork: { ...defaults.formwork, ...userCeiling.formwork },
    equipment: { ...defaults.equipment, ...userCeiling.equipment },
    time: { ...defaults.time, ...userCeiling.time },
    confidence: userCeiling.confidence ?? 0.99,
    source: 'manual',
  };
  return merged;
}

function mergeWorkforce(
  defaults: ResourceCeilingWorkforce | undefined,
  user: ResourceCeilingWorkforce | undefined,
): ResourceCeilingWorkforce {
  if (!user) return { ...defaults };
  if (!defaults) return { ...user };

  const defaultsTotal = defaults.num_workers_total ?? 0;
  const userTotal = user.num_workers_total;
  const userHasBreakdown =
    user.num_carpenters !== undefined ||
    user.num_rebar_workers !== undefined ||
    user.num_concrete_workers !== undefined ||
    user.num_vibrators !== undefined ||
    user.num_finishers !== undefined ||
    user.num_supervisors !== undefined;

  // User total only, no breakdown → scale default ratio.
  if (userTotal !== undefined && !userHasBreakdown && defaultsTotal > 0) {
    const scale = userTotal / defaultsTotal;
    return {
      num_workers_total: userTotal,
      num_carpenters: defaults.num_carpenters !== undefined
        ? Math.max(1, Math.round(defaults.num_carpenters * scale)) : undefined,
      num_rebar_workers: defaults.num_rebar_workers !== undefined
        ? Math.max(1, Math.round(defaults.num_rebar_workers * scale)) : undefined,
      num_concrete_workers: defaults.num_concrete_workers !== undefined
        ? Math.max(1, Math.round(defaults.num_concrete_workers * scale)) : undefined,
      num_vibrators: defaults.num_vibrators !== undefined
        ? Math.max(1, Math.round(defaults.num_vibrators * scale)) : undefined,
      num_finishers: defaults.num_finishers !== undefined
        ? Math.max(0, Math.round(defaults.num_finishers * scale)) : undefined,
      num_supervisors: defaults.num_supervisors !== undefined
        ? Math.max(0, Math.round(defaults.num_supervisors * scale)) : undefined,
    };
  }

  // Otherwise field-by-field merge (user wins).
  return { ...defaults, ...user };
}

// ─── Feasibility check ──────────────────────────────────────────────────────

export type CeilingViolationSeverity = 'critical' | 'warning' | 'info';

export interface CeilingViolation {
  field: keyof ResourceCeilingWorkforce | keyof ResourceCeilingFormwork
       | keyof ResourceCeilingEquipment | keyof ResourceCeilingTime
       | 'num_workers_total_sum';
  required: number;
  available: number;
  severity: CeilingViolationSeverity;
  /** Czech message per CLAUDE.md prefix convention (⛔/⚠️/ℹ️). */
  message: string;
}

export interface CeilingFeasibilityResult {
  feasible: boolean;
  violations: CeilingViolation[];
  /** Best-effort recovery hints (e.g. "rozdělit do 2 záběrů"). */
  recovery_hints: string[];
}

/**
 * Engineering demand — what the calculator engine *wanted* to use before
 * being capped. Used by `checkCeilingFeasibility()`.
 */
export interface EngineeringDemand {
  workforce?: ResourceCeilingWorkforce;
  formwork?: ResourceCeilingFormwork;
  equipment?: Pick<ResourceCeilingEquipment, 'num_pumps' | 'num_backup_pumps' | 'num_cranes'>;
  /** Total work days required (for deadline_days check). */
  total_days?: number;
}

/**
 * Check whether the engineering demand fits within the ceiling. Returns
 * structured violations (⛔ critical when demand > ceiling AND no recovery)
 * + recovery hints.
 *
 * Per audit §5.3 confidence priority:
 *   - User ceiling (0.99) > KB defaults (0.85)
 *   - Auto-derived lower bound (1.00) > user ceiling → INFEASIBLE
 *
 * Per Q3 interview answer (warning + best-effort plan):
 *   engine returns a plan WITH violations marked — never silent fail.
 */
export function checkCeilingFeasibility(
  ceiling: ResourceCeiling,
  demand: EngineeringDemand,
  elementType: StructuralElementType,
): CeilingFeasibilityResult {
  const relevance = getResourceRelevance(elementType);
  const violations: CeilingViolation[] = [];
  const recovery_hints: string[] = [];

  // Workforce checks
  if (ceiling.workforce && demand.workforce) {
    const c = ceiling.workforce;
    const d = demand.workforce;

    if (relevance.num_carpenters && c.num_carpenters !== undefined && d.num_carpenters !== undefined && d.num_carpenters > c.num_carpenters) {
      violations.push({
        field: 'num_carpenters', required: d.num_carpenters, available: c.num_carpenters,
        severity: 'critical',
        message: `⛔ KRITICKÉ: tesařů potřeba ${d.num_carpenters}, dostupných ${c.num_carpenters} — práce na bednění poběží pomaleji`,
      });
      recovery_hints.push(`Snížit počet souprav bednění (méně paralelních záběrů), nebo zvýšit strop tesařů`);
    }
    if (relevance.num_rebar_workers && c.num_rebar_workers !== undefined && d.num_rebar_workers !== undefined && d.num_rebar_workers > c.num_rebar_workers) {
      violations.push({
        field: 'num_rebar_workers', required: d.num_rebar_workers, available: c.num_rebar_workers,
        severity: 'critical',
        message: `⛔ KRITICKÉ: železářů potřeba ${d.num_rebar_workers}, dostupných ${c.num_rebar_workers}`,
      });
      recovery_hints.push(`Prodloužit dobu vázání výztuže nebo navýšit počet železářů`);
    }
    if (relevance.num_concrete_workers && c.num_concrete_workers !== undefined && d.num_concrete_workers !== undefined && d.num_concrete_workers > c.num_concrete_workers) {
      violations.push({
        field: 'num_concrete_workers', required: d.num_concrete_workers, available: c.num_concrete_workers,
        severity: 'critical',
        message: `⛔ KRITICKÉ: betonářů (ukládání) potřeba ${d.num_concrete_workers}, dostupných ${c.num_concrete_workers}`,
      });
      recovery_hints.push(`Snížit počet souběžných čerpadel (méně ukládání naráz)`);
    }
    // Total cap (sum check) — only if user supplied num_workers_total.
    if (relevance.num_workers_total && c.num_workers_total !== undefined) {
      const demandTotal =
        (d.num_carpenters ?? 0) +
        (d.num_rebar_workers ?? 0) +
        (d.num_concrete_workers ?? 0) +
        (d.num_vibrators ?? 0) +
        (d.num_finishers ?? 0) +
        (d.num_supervisors ?? 0);
      if (demandTotal > c.num_workers_total) {
        violations.push({
          field: 'num_workers_total_sum', required: demandTotal, available: c.num_workers_total,
          severity: 'critical',
          message: `⛔ KRITICKÉ: celkem lidí potřeba ${demandTotal}, strop ${c.num_workers_total}`,
        });
        recovery_hints.push(`Rozdělit element do více záběrů — menší souběh profesí`);
      }
    }
  }

  // Formwork sets cap
  if (relevance.num_formwork_sets && ceiling.formwork?.num_formwork_sets !== undefined && demand.formwork?.num_formwork_sets !== undefined) {
    if (demand.formwork.num_formwork_sets > ceiling.formwork.num_formwork_sets) {
      violations.push({
        field: 'num_formwork_sets',
        required: demand.formwork.num_formwork_sets,
        available: ceiling.formwork.num_formwork_sets,
        severity: 'critical',
        message: `⛔ KRITICKÉ: souprav bednění potřeba ${demand.formwork.num_formwork_sets}, dostupných ${ceiling.formwork.num_formwork_sets}`,
      });
      recovery_hints.push(`Snížit obrátkovost — záběry pojedou sekvenčně místo paralelně`);
    }
  }

  // Pumps cap — most important for INFEASIBLE recovery (split logic)
  if (relevance.num_pumps && ceiling.equipment?.num_pumps !== undefined && demand.equipment?.num_pumps !== undefined) {
    if (demand.equipment.num_pumps > ceiling.equipment.num_pumps) {
      violations.push({
        field: 'num_pumps',
        required: demand.equipment.num_pumps,
        available: ceiling.equipment.num_pumps,
        severity: 'critical',
        message: `⛔ KRITICKÉ: čerpadel potřeba ${demand.equipment.num_pumps}, dostupných ${ceiling.equipment.num_pumps} — pour window překročeno`,
      });
      recovery_hints.push(
        `Rozdělit do ${demand.equipment.num_pumps} záběrů s pracovní spárou v ose pole, ` +
        `nebo zvýšit strop čerpadel na ${demand.equipment.num_pumps}`,
      );
    }
  }

  // Cranes cap
  if (relevance.num_cranes && ceiling.equipment?.num_cranes !== undefined && demand.equipment?.num_cranes !== undefined) {
    if (demand.equipment.num_cranes > ceiling.equipment.num_cranes) {
      violations.push({
        field: 'num_cranes',
        required: demand.equipment.num_cranes,
        available: ceiling.equipment.num_cranes,
        severity: 'critical',
        message: `⛔ KRITICKÉ: jeřábů potřeba ${demand.equipment.num_cranes}, dostupných ${ceiling.equipment.num_cranes}`,
      });
      recovery_hints.push(`Zvolit lehčí formwork system bez jeřábu (Frami → MAXIMO), nebo navýšit jeřábový park`);
    }
  }

  // Deadline check
  if (relevance.deadline_days && ceiling.time?.deadline_days !== undefined && demand.total_days !== undefined) {
    if (demand.total_days > ceiling.time.deadline_days) {
      violations.push({
        field: 'deadline_days',
        required: demand.total_days,
        available: ceiling.time.deadline_days,
        severity: 'critical',
        message: `⛔ KRITICKÉ: doba ${demand.total_days} d > deadline ${ceiling.time.deadline_days} d`,
      });
      recovery_hints.push(`Přidat 2. směnu, navýšit souprav bednění, nebo žádat prodloužení termínu`);
    }
  }

  return {
    feasible: violations.filter(v => v.severity === 'critical').length === 0,
    violations,
    recovery_hints,
  };
}
