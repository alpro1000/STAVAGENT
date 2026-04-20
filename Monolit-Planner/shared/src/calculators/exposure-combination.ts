/**
 * Exposure-class combination engine (ČSN EN 206+A2, Tab. F.1).
 *
 * Concrete cast into real structures is typically exposed to MULTIPLE
 * environmental actions simultaneously (e.g. a bridge deck sees XF2 frost +
 * de-icing salts + XD1 chlorides + XC4 carbonation). The norm then requires
 * the mix to satisfy the strictest of each per-property requirement across
 * all exposure classes (ČSN EN 206+A2 §4.3.1 + Tab. F.1).
 *
 * This module provides:
 *   - EXPOSURE_CLASS_REQUIREMENTS: Record of all 20 valid classes
 *   - combineExposure(classes[]): max/min rules → derived requirements
 *   - getMostRestrictive(classes[]): single most-severe class (legacy string API)
 *   - validateExposureCombination(classes[]): warnings for atypical combos
 *   - getExposureCategory(cls): which of 5 categories the class belongs to
 *
 * Task 2 (2026-04-20). Designed as a pure, stateless helper — no imports
 * from other calculators, all inputs strings + numbers.
 */

// ─── Type catalog ────────────────────────────────────────────────────────────

/**
 * All 20 valid exposure classes per ČSN EN 206+A2. Every string literal
 * here must also appear as a key in `EXPOSURE_CLASS_REQUIREMENTS`.
 */
export const EXPOSURE_CLASSES = [
  'X0',
  'XC1', 'XC2', 'XC3', 'XC4',
  'XD1', 'XD2', 'XD3',
  'XF1', 'XF2', 'XF3', 'XF4',
  'XA1', 'XA2', 'XA3',
  'XM1', 'XM2', 'XM3',
  'XS1', 'XS2', 'XS3', // sea-water chlorides (included for completeness)
] as const;

export type ExposureClass = typeof EXPOSURE_CLASSES[number];

export type ExposureCategory =
  | 'zero'       // X0
  | 'karbonatace' // XC1-XC4
  | 'chloridy'    // XD1-XD3 + XS1-XS3
  | 'mraz'        // XF1-XF4
  | 'chemie'      // XA1-XA3
  | 'obrus';      // XM1-XM3

export interface ExposureClassRequirements {
  /** Minimum concrete strength class, e.g. "C30/37". */
  min_C_class: string;
  /** Maximum water/cement ratio (lower = stricter). `null` if not regulated. */
  max_wc: number | null;
  /** Minimum cement content, kg/m³. `null` if not regulated. */
  min_cement_kg_m3: number | null;
  /** Minimum entrained air content in fresh concrete (%). `null` if not required. */
  min_air_content_pct: number | null;
  /** Requires sulfate-resistant cement (CEM III/B-SV, ČSN P 73 2404). */
  requires_sulfate_resistant: boolean;
  /** Short human-readable description, Czech. */
  label_cs: string;
  /** Category for UI grouping. */
  category: ExposureCategory;
}

/**
 * Full table of exposure-class requirements per ČSN EN 206+A2 Tab. F.1
 * (also reconciled with ČSN P 73 2404 Tab. 2 for sulfate-resistant cement).
 *
 * Values marked "LP" in the norm (XF2/3/4) imply entrained air — represented
 * here by `min_air_content_pct=4.0`. Some authoritative sources quote XF2/3
 * at 4.5 % for the bigger aggregate sizes, but the norm's baseline line is
 * 4.0 % and that's what we enforce; the user can always override.
 */
export const EXPOSURE_CLASS_REQUIREMENTS: Record<ExposureClass, ExposureClassRequirements> = {
  X0: {
    min_C_class: 'C12/15', max_wc: null, min_cement_kg_m3: null,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Bez rizika koroze nebo napadení', category: 'zero',
  },
  XC1: {
    min_C_class: 'C20/25', max_wc: 0.65, min_cement_kg_m3: 260,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Sucho nebo trvale mokro', category: 'karbonatace',
  },
  XC2: {
    min_C_class: 'C25/30', max_wc: 0.60, min_cement_kg_m3: 280,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Mokro, občas suché (základy v zemi)', category: 'karbonatace',
  },
  XC3: {
    min_C_class: 'C30/37', max_wc: 0.55, min_cement_kg_m3: 280,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Střední vlhkost, interiéry', category: 'karbonatace',
  },
  XC4: {
    min_C_class: 'C30/37', max_wc: 0.50, min_cement_kg_m3: 300,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Střídavě mokro a sucho', category: 'karbonatace',
  },
  XD1: {
    min_C_class: 'C30/37', max_wc: 0.55, min_cement_kg_m3: 300,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Středně vlhké, chloridy (ne moře)', category: 'chloridy',
  },
  XD2: {
    min_C_class: 'C30/37', max_wc: 0.55, min_cement_kg_m3: 320,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Mokro, chloridy', category: 'chloridy',
  },
  XD3: {
    min_C_class: 'C35/45', max_wc: 0.45, min_cement_kg_m3: 320,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Střídavě, chloridy (římsy)', category: 'chloridy',
  },
  XS1: {
    min_C_class: 'C30/37', max_wc: 0.50, min_cement_kg_m3: 300,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Mořská voda — vzduch se solnou mlhou', category: 'chloridy',
  },
  XS2: {
    min_C_class: 'C30/37', max_wc: 0.45, min_cement_kg_m3: 320,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Mořská voda — trvale ponořeno', category: 'chloridy',
  },
  XS3: {
    min_C_class: 'C35/45', max_wc: 0.45, min_cement_kg_m3: 340,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Mořská voda — smáčeno (příboj)', category: 'chloridy',
  },
  XF1: {
    min_C_class: 'C30/37', max_wc: 0.55, min_cement_kg_m3: 300,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Mráz bez solí, střední saturace', category: 'mraz',
  },
  XF2: {
    min_C_class: 'C25/30', max_wc: 0.55, min_cement_kg_m3: 300,
    min_air_content_pct: 4.0, requires_sulfate_resistant: false,
    label_cs: 'Mráz se solemi, střední saturace (LP)', category: 'mraz',
  },
  XF3: {
    min_C_class: 'C30/37', max_wc: 0.50, min_cement_kg_m3: 320,
    min_air_content_pct: 4.0, requires_sulfate_resistant: false,
    label_cs: 'Mráz bez solí, vysoká saturace (LP)', category: 'mraz',
  },
  XF4: {
    min_C_class: 'C30/37', max_wc: 0.45, min_cement_kg_m3: 340,
    min_air_content_pct: 4.0, requires_sulfate_resistant: false,
    label_cs: 'Mráz + rozmrazovací látky (římsy, mostovky, LP)', category: 'mraz',
  },
  XA1: {
    min_C_class: 'C30/37', max_wc: 0.55, min_cement_kg_m3: 300,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Slabě agresivní (SO₄²⁻ 200–600 mg/l)', category: 'chemie',
  },
  XA2: {
    min_C_class: 'C30/37', max_wc: 0.50, min_cement_kg_m3: 320,
    min_air_content_pct: null, requires_sulfate_resistant: true,
    label_cs: 'Středně agresivní — síranovzdorný cement', category: 'chemie',
  },
  XA3: {
    min_C_class: 'C35/45', max_wc: 0.45, min_cement_kg_m3: 360,
    min_air_content_pct: null, requires_sulfate_resistant: true,
    label_cs: 'Silně agresivní — síranovzdorný cement', category: 'chemie',
  },
  XM1: {
    min_C_class: 'C30/37', max_wc: 0.55, min_cement_kg_m3: 300,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Slabý obrus (průmyslové podlahy lehký provoz)', category: 'obrus',
  },
  XM2: {
    min_C_class: 'C30/37', max_wc: 0.50, min_cement_kg_m3: 320,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Střední obrus', category: 'obrus',
  },
  XM3: {
    min_C_class: 'C35/45', max_wc: 0.45, min_cement_kg_m3: 360,
    min_air_content_pct: null, requires_sulfate_resistant: false,
    label_cs: 'Silný obrus (těžká průmyslová, kolejová)', category: 'obrus',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Type-guard — is a raw string one of the 20 valid exposure classes? */
export function isValidExposureClass(s: string): s is ExposureClass {
  return (EXPOSURE_CLASSES as readonly string[]).includes(s);
}

/** Human-readable category label (Czech) for UI section headings. */
export const CATEGORY_LABELS_CS: Record<ExposureCategory, string> = {
  zero: 'Bez rizika',
  karbonatace: 'Karbonatace (XC)',
  chloridy: 'Chloridy (XD, XS)',
  mraz: 'Mráz a rozmrazovací látky (XF)',
  chemie: 'Chemická agresivita (XA)',
  obrus: 'Obrus (XM)',
};

export function getExposureCategory(cls: string): ExposureCategory | null {
  if (!isValidExposureClass(cls)) return null;
  return EXPOSURE_CLASS_REQUIREMENTS[cls].category;
}

/**
 * Priority for collapsing a multi-class selection to a single legacy
 * string. XF (frost + de-icing) is strictest because it drives curing floor
 * (ČSN EN 206+A2 §8.2.8 + TKP18 §7.8.3). XD/XS come next (chlorides).
 * XA (chemie) and XM (obrus) follow. XC is the weakest, X0 last.
 *
 * Higher number = more restrictive.
 */
export function getExposurePriority(cls: string): number {
  if (!isValidExposureClass(cls)) return -1;
  const cat = EXPOSURE_CLASS_REQUIREMENTS[cls].category;
  const categoryRank: Record<ExposureCategory, number> = {
    mraz: 50,
    chloridy: 40,
    chemie: 30,
    obrus: 20,
    karbonatace: 10,
    zero: 0,
  };
  // Within a category, the numeric suffix breaks ties (XF4 > XF2).
  const digit = parseInt(cls.slice(-1), 10);
  return categoryRank[cat] * 10 + (Number.isNaN(digit) ? 0 : digit);
}

/**
 * Return the most-restrictive exposure class from a set — used as the
 * legacy single-string API when older code expects one value.
 */
export function getMostRestrictive(classes: readonly string[]): string | null {
  const valid = classes.filter(isValidExposureClass);
  if (valid.length === 0) return null;
  return [...valid].sort((a, b) => getExposurePriority(b) - getExposurePriority(a))[0];
}

// ─── Concrete-class helpers ─────────────────────────────────────────────────

/**
 * Compare two Czech concrete-class strings (e.g. "C25/30" vs "C30/37").
 * Uses the cylinder strength (first number after "C") as the ordering key.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareConcreteClass(a: string, b: string): number {
  const ra = /C(\d+)\//.exec(a);
  const rb = /C(\d+)\//.exec(b);
  const va = ra ? parseInt(ra[1], 10) : 0;
  const vb = rb ? parseInt(rb[1], 10) : 0;
  return va - vb;
}

/** Higher (stricter) of two concrete classes; `b` wins on tie. */
function maxConcreteClass(a: string, b: string): string {
  return compareConcreteClass(a, b) >= 0 ? a : b;
}

// ─── Combined requirements ──────────────────────────────────────────────────

export interface CombinedExposureRequirements {
  /** Input set, filtered to valid classes only. */
  classes: ExposureClass[];
  /** Strictest concrete strength class across selection. */
  min_C_class: string;
  /** Strictest (lowest) w/c across selection. `null` if nothing selected. */
  max_wc: number | null;
  /** Strictest (highest) min cement content across selection. */
  min_cement_kg_m3: number | null;
  /** 4.0 if any of XF2/XF3/XF4 is in the selection, otherwise null. */
  min_air_content_pct: number | null;
  /** True if any of XA2 / XA3 is in the selection. */
  requires_sulfate_resistant: boolean;
  /** Category → class found in the selection (multiple same category detected). */
  by_category: Partial<Record<ExposureCategory, ExposureClass[]>>;
}

/**
 * Apply ČSN EN 206+A2 combination rules over a selection of exposure
 * classes. Invalid / unknown strings are silently dropped. Empty input
 * returns a neutral "nothing required" record with `min_C_class='C12/15'`
 * (the absolute lowest) so callers can always read a defined shape.
 */
export function combineExposure(classes: readonly string[]): CombinedExposureRequirements {
  const valid = classes.filter(isValidExposureClass);
  // Deduplicate preserving order.
  const unique: ExposureClass[] = [];
  for (const c of valid) if (!unique.includes(c)) unique.push(c);

  if (unique.length === 0) {
    return {
      classes: [],
      min_C_class: 'C12/15',
      max_wc: null,
      min_cement_kg_m3: null,
      min_air_content_pct: null,
      requires_sulfate_resistant: false,
      by_category: {},
    };
  }

  let min_C_class = 'C12/15';
  let max_wc: number | null = null;
  let min_cement: number | null = null;
  let min_air: number | null = null;
  let needsSulfate = false;
  const byCategory: Partial<Record<ExposureCategory, ExposureClass[]>> = {};

  for (const cls of unique) {
    const req = EXPOSURE_CLASS_REQUIREMENTS[cls];
    min_C_class = maxConcreteClass(min_C_class, req.min_C_class);
    if (req.max_wc !== null) {
      max_wc = max_wc === null ? req.max_wc : Math.min(max_wc, req.max_wc);
    }
    if (req.min_cement_kg_m3 !== null) {
      min_cement = min_cement === null
        ? req.min_cement_kg_m3
        : Math.max(min_cement, req.min_cement_kg_m3);
    }
    if (req.min_air_content_pct !== null) {
      min_air = min_air === null
        ? req.min_air_content_pct
        : Math.max(min_air, req.min_air_content_pct);
    }
    if (req.requires_sulfate_resistant) needsSulfate = true;
    const bucket = byCategory[req.category] ?? [];
    if (!bucket.includes(cls)) bucket.push(cls);
    byCategory[req.category] = bucket;
  }

  return {
    classes: unique,
    min_C_class,
    max_wc,
    min_cement_kg_m3: min_cement,
    min_air_content_pct: min_air,
    requires_sulfate_resistant: needsSulfate,
    by_category: byCategory,
  };
}

// ─── Validation warnings ────────────────────────────────────────────────────

export type ExposureWarningCode =
  | 'empty_selection'
  | 'xf_without_xd'
  | 'xa_missing_sulfate_cement'
  | 'multiple_in_category'
  | 'unknown_class';

export interface ExposureWarning {
  code: ExposureWarningCode;
  severity: 'info' | 'warning';
  message_cs: string;
  /** Category or class name the warning refers to, for UI grouping. */
  subject?: string;
}

/**
 * Validation warnings for a multi-class selection. These are advisory —
 * the caller decides whether to block submission or just surface the hint.
 *
 * Covered cases (from task spec AC 8-10):
 *   - Empty selection → info: "pick at least X0".
 *   - XF2/XF3/XF4 without any XD/XS → warning: "typically combined".
 *   - XA2/XA3 without explicit sulfate-resistant cement acknowledgement
 *     → warning: "recommend síranovzdorný".
 *   - More than one class per category (e.g. XC1 + XC4) → warning: "pick
 *     the worst only within a category".
 *   - Unknown strings (wouldn't survive combineExposure filter) → warning.
 */
export function validateExposureCombination(
  classes: readonly string[],
  options?: { cement_type_is_sulfate_resistant?: boolean },
): ExposureWarning[] {
  const warnings: ExposureWarning[] = [];
  const valid = classes.filter(isValidExposureClass);
  const unknown = classes.filter(c => !isValidExposureClass(c));

  for (const u of unknown) {
    warnings.push({
      code: 'unknown_class', severity: 'warning',
      message_cs: `Neznámá třída prostředí „${u}". Podporované: ${EXPOSURE_CLASSES.join(', ')}.`,
      subject: u,
    });
  }

  if (valid.length === 0) {
    warnings.push({
      code: 'empty_selection', severity: 'info',
      message_cs: 'Nebyla vybrána žádná třída prostředí. Pokud není riziko koroze, vyberte alespoň X0.',
    });
    return warnings;
  }

  // Combined buckets for downstream checks
  const combined = combineExposure(valid);

  // Multiple classes in the same category (rarely physically meaningful)
  for (const [cat, list] of Object.entries(combined.by_category)) {
    if (list && list.length > 1) {
      warnings.push({
        code: 'multiple_in_category', severity: 'warning',
        message_cs: `V kategorii ${CATEGORY_LABELS_CS[cat as ExposureCategory]} jste vybrali ${list.length} tříd (${list.join(', ')}). Obvykle se volí jen nejhorší scénář.`,
        subject: cat,
      });
    }
  }

  // XF with de-icing salts typically combines with XD/XS
  const hasXFWithSalts = valid.some(c => c === 'XF2' || c === 'XF4');
  const hasChlorides = valid.some(c => c.startsWith('XD') || c.startsWith('XS'));
  if (hasXFWithSalts && !hasChlorides) {
    warnings.push({
      code: 'xf_without_xd', severity: 'warning',
      message_cs: 'Vybrané XF2/XF4 (mráz se solemi) se obvykle kombinují s XD1–3 kvůli chloridům z posypových solí.',
    });
  }

  // XA2/XA3 need sulfate-resistant cement
  if (combined.requires_sulfate_resistant && !options?.cement_type_is_sulfate_resistant) {
    warnings.push({
      code: 'xa_missing_sulfate_cement', severity: 'warning',
      message_cs: 'Vybraná třída XA2/XA3 vyžaduje síranovzdorný cement (ČSN P 73 2404) — zvolte CEM II/B-SV, CEM III/B-SV nebo ekvivalent.',
    });
  }

  return warnings;
}

// ─── Human-readable summary ─────────────────────────────────────────────────

/**
 * Format a CombinedExposureRequirements as a single-line Czech string for
 * UI display, e.g.:
 *   "XF2 + XD1 + XC4 → C30/37, w/c ≤ 0.50, cement ≥ 320 kg/m³, vzduch ≥ 4.0 %"
 */
export function formatCombinedSummary(c: CombinedExposureRequirements): string {
  if (c.classes.length === 0) return 'Žádná třída prostředí nevybrána.';
  const parts = [`min. ${c.min_C_class}`];
  if (c.max_wc !== null) parts.push(`w/c ≤ ${c.max_wc.toFixed(2)}`);
  if (c.min_cement_kg_m3 !== null) parts.push(`cement ≥ ${c.min_cement_kg_m3} kg/m³`);
  if (c.min_air_content_pct !== null) parts.push(`vzduch ≥ ${c.min_air_content_pct.toFixed(1)} %`);
  if (c.requires_sulfate_resistant) parts.push('síranovzdorný cement');
  return `${c.classes.join(' + ')} → ${parts.join(', ')}`;
}
