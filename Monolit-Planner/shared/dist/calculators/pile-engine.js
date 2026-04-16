/**
 * Pile Engine — bored pile (vrtaná pilota) productivity, schedule and cost
 *
 * Piles are fundamentally different from every other monolithic element:
 *   - No formwork — soil IS the form
 *   - No lateral pressure — there's nothing to push against
 *   - No tacts — 1 pilota = 1 záběr always
 *   - No supports — pile is in the ground
 *   - Concrete is placed via tremie pipe (under water) or direct discharge
 *     into a dry bore — never with a pump, no vibration (S4/SCC)
 *   - Reinforcement is a pre-fabricated cage (armokoš) lifted by crane,
 *     not in-situ rebar
 *   - Schedule bottleneck is the drilling rig, not crews
 *
 * This module provides:
 *   - PILE_PRODUCTIVITY_TABLE: piles per shift by diameter × geology × method
 *   - calculatePileDrilling(): main entry that builds drilling/concreting
 *     phases, optional pile cap (hlavice), labor/material costs and a
 *     simple traceability log
 *
 * The orchestrator (planner-orchestrator.ts) routes through this module
 * via an early branch when element_type === 'pilota'. The result is then
 * mapped into a standard PlannerOutput so consumers (PlanResult cards,
 * applyPlanToPositions, scheduler-shaped fields) keep working without
 * a parallel type system.
 *
 * Productivity ranges are taken from the task spec (TZ + ČSN 73 1002):
 *
 *   Ø600  CFA (soudržná)        5–8  pilot/směna
 *   Ø600  s pažnicí (soudržná)  3–5  pilot/směna
 *   Ø600  s pažnicí (pod HPV)   2–4  pilot/směna
 *   Ø600  skalní podloží        1–3  pilot/směna
 *   ... (full table below)
 *
 * For diameters between catalog rows we linearly interpolate the mid value
 * by the diameter ratio so an arbitrary Ø500 / Ø750 input does not crash.
 */
// ─── Productivity table ────────────────────────────────────────────────────
/**
 * Mid-range piles per shift (8h) by diameter × geology × casing method.
 *
 * Table maps `${diameter_mm}::${geology}` to a record of method → piles/shift.
 * Values are the midpoint of the spec range — e.g. Ø600 CFA cohesive
 * 5–8 → 6.5. For rock the ranges given are cumulative across methods,
 * so we use the same value regardless of method (rock dominates).
 */
const PILE_PRODUCTIVITY_TABLE = {
    600: {
        cohesive: { cfa: 6.5, cased: 4.0, uncased: 4.0 },
        noncohesive: { cfa: 5.0, cased: 3.0, uncased: 3.0 },
        below_gwt: { cfa: 4.0, cased: 3.0, uncased: 3.0 },
        rock: { cfa: 2.0, cased: 2.0, uncased: 2.0 },
    },
    900: {
        cohesive: { cfa: 4.0, cased: 2.5, uncased: 2.5 },
        noncohesive: { cfa: 3.0, cased: 2.0, uncased: 2.0 },
        below_gwt: { cfa: 2.0, cased: 1.5, uncased: 1.5 },
        rock: { cfa: 1.5, cased: 1.5, uncased: 1.5 },
    },
    1200: {
        cohesive: { cfa: 2.5, cased: 1.5, uncased: 1.5 },
        noncohesive: { cfa: 2.0, cased: 1.2, uncased: 1.2 },
        below_gwt: { cfa: 1.0, cased: 1.0, uncased: 1.0 },
        rock: { cfa: 0.75, cased: 0.75, uncased: 0.75 },
    },
    1500: {
        cohesive: { cfa: 1.5, cased: 0.75, uncased: 0.75 },
        noncohesive: { cfa: 1.2, cased: 0.6, uncased: 0.6 },
        below_gwt: { cfa: 0.5, cased: 0.5, uncased: 0.5 },
        rock: { cfa: 0.4, cased: 0.4, uncased: 0.4 },
    },
};
const TABLE_DIAMETERS = Object.keys(PILE_PRODUCTIVITY_TABLE)
    .map(Number)
    .sort((a, b) => a - b);
/**
 * Productivity lookup with linear interpolation by diameter for off-catalog sizes.
 * Diameters below the catalog minimum clamp to the smallest row;
 * diameters above the maximum clamp to the largest row.
 *
 * Productivity falls roughly with the cross-section area (∝ diameter²),
 * so we interpolate in 1/diameter² space which empirically tracks the
 * tabular ranges better than linear-in-diameter.
 */
export function getPileProductivity(diameter_mm, geology, casing_method) {
    // Clamp to catalog bounds
    if (diameter_mm <= TABLE_DIAMETERS[0]) {
        return PILE_PRODUCTIVITY_TABLE[TABLE_DIAMETERS[0]][geology][casing_method];
    }
    if (diameter_mm >= TABLE_DIAMETERS[TABLE_DIAMETERS.length - 1]) {
        return PILE_PRODUCTIVITY_TABLE[TABLE_DIAMETERS[TABLE_DIAMETERS.length - 1]][geology][casing_method];
    }
    // Find bracket
    let lo = TABLE_DIAMETERS[0];
    let hi = TABLE_DIAMETERS[TABLE_DIAMETERS.length - 1];
    for (let i = 0; i < TABLE_DIAMETERS.length - 1; i++) {
        if (diameter_mm >= TABLE_DIAMETERS[i] && diameter_mm <= TABLE_DIAMETERS[i + 1]) {
            lo = TABLE_DIAMETERS[i];
            hi = TABLE_DIAMETERS[i + 1];
            break;
        }
    }
    const pLo = PILE_PRODUCTIVITY_TABLE[lo][geology][casing_method];
    const pHi = PILE_PRODUCTIVITY_TABLE[hi][geology][casing_method];
    // Interpolate productivity ∝ 1/d²
    const invSqLo = 1 / (lo * lo);
    const invSqHi = 1 / (hi * hi);
    const invSq = 1 / (diameter_mm * diameter_mm);
    const t = (invSq - invSqHi) / (invSqLo - invSqHi); // 0 at hi, 1 at lo
    const result = pHi + t * (pLo - pHi);
    return Math.round(result * 100) / 100;
}
// ─── Volume helpers ────────────────────────────────────────────────────────
/** Volume of one cylindrical pile in m³: π × (Ø/2)² × L. */
export function calculatePileVolume(diameter_mm, length_m) {
    const r_m = diameter_mm / 2 / 1000;
    return Math.PI * r_m * r_m * length_m;
}
/**
 * Derive pile count from total volume when the user only gave volume_m3.
 * Returns at least 1.
 */
export function derivePileCount(total_volume_m3, diameter_mm, length_m) {
    const v1 = calculatePileVolume(diameter_mm, length_m);
    if (v1 <= 0)
        return 1;
    return Math.max(1, Math.round(total_volume_m3 / v1));
}
// ─── Defaults ──────────────────────────────────────────────────────────────
const DEFAULTS = {
    diameter_mm: 600,
    length_m: 10,
    geology: 'cohesive',
    casing_method: 'cfa',
    rebar_index_kg_m3: 40, // base default, overridden by getDefaultRebarIndex(diameter)
    concrete_class: 'C25/30',
    /** BUG-P2: default overpouring height in m (0.5 m per TZ §6.3.3). */
    overpouring_m: 0.5,
    crew_size: 6, // 2 obsluha rigu + 2 železáři + 2 betonáři/pomocní
    shift_h: 8, // pile shifts are typically 8h, not 10h
    wage_czk_h: 398,
    rig_czk_per_shift: 25000,
    crane_czk_per_shift: 8000,
    /** Technological pause between drilling and head adjustment (ČSN 73 1002 + praxe) */
    technological_pause_days: 7,
    /** BUG-P4: integrity test default prices (CZK/pile). */
    cha_test_czk: 40000,
    pit_test_czk: 5000,
};
/**
 * BUG-P3 (2026-04-15): heads_per_shift depends on pile diameter.
 *
 * Odbourání laitance + úprava výztuže u Ø600 je rychlé (~5 hlav/směna),
 * u Ø1500 je to těžká ruční práce s hmotnou výztuží (~1.5 hlav/směna).
 *
 * Table (TZ + praxe):
 *   Ø600  → 5 hlav/směna
 *   Ø900  → 3 hlav/směna
 *   Ø1200 → 2 hlav/směna
 *   Ø1500 → 1.5 hlav/směna
 *
 * Off-table diameters are linearly interpolated; off-the-bottom clamps to
 * Ø600 speed (5), off-the-top clamps to Ø1500 speed (1.5).
 */
const HEADS_PER_SHIFT_TABLE = [
    { diameter_mm: 600, heads: 5.0 },
    { diameter_mm: 900, heads: 3.0 },
    { diameter_mm: 1200, heads: 2.0 },
    { diameter_mm: 1500, heads: 1.5 },
];
export function getHeadsPerShift(diameter_mm) {
    if (diameter_mm <= HEADS_PER_SHIFT_TABLE[0].diameter_mm) {
        return HEADS_PER_SHIFT_TABLE[0].heads;
    }
    if (diameter_mm >= HEADS_PER_SHIFT_TABLE[HEADS_PER_SHIFT_TABLE.length - 1].diameter_mm) {
        return HEADS_PER_SHIFT_TABLE[HEADS_PER_SHIFT_TABLE.length - 1].heads;
    }
    for (let i = 0; i < HEADS_PER_SHIFT_TABLE.length - 1; i++) {
        const lo = HEADS_PER_SHIFT_TABLE[i];
        const hi = HEADS_PER_SHIFT_TABLE[i + 1];
        if (diameter_mm >= lo.diameter_mm && diameter_mm <= hi.diameter_mm) {
            const t = (diameter_mm - lo.diameter_mm) / (hi.diameter_mm - lo.diameter_mm);
            return Math.round((lo.heads + t * (hi.heads - lo.heads)) * 100) / 100;
        }
    }
    return HEADS_PER_SHIFT_TABLE[0].heads;
}
// ─── Diameter-dependent rebar default (BUG 3/3b) ──────────────────────────
/**
 * BUG 3/3b: Default rebar index depends on pile diameter.
 *
 * Pozemní piloty (Ø<800) use 30-50 kg/m³ (light cages).
 * Mostní Ø900 use ~90 kg/m³ (B500B podélná + spirála + CHA roury).
 * Mostní Ø1200+ use ~100 kg/m³ (heavier cage + more spirála/m).
 *
 * Table (SO-202 Ø900, SO-203 Ø1200, SO-207 mix):
 *   Ø < 800  → 40 kg/m³  (pozemní)
 *   800-999  → 90 kg/m³  (mostní Ø900)
 *   ≥ 1000   → 100 kg/m³ (mostní Ø1200+)
 */
export function getDefaultRebarIndex(diameter_mm) {
    if (diameter_mm < 800)
        return 40;
    if (diameter_mm < 1000)
        return 90;
    return 100;
}
// ─── Main entry ────────────────────────────────────────────────────────────
/**
 * calculatePileDrilling — main entry point used by the orchestrator's pile branch.
 *
 * Steps:
 *   1. Resolve defaults for missing pile-specific inputs
 *   2. Compute volume_per_pile (or back-derive count from total volume)
 *   3. Look up productivity from the table
 *   4. Build schedule phases: drilling → 7d pause → head adjustment → optional cap
 *   5. Build cost breakdown (rig × shifts + crane × shifts + crew × shifts × wage + cap labor)
 *   6. Emit a Czech traceability log
 *
 * Material costs (concrete, steel) are NOT included — same convention as the
 * rest of the planner, where material is treated as external and only labor
 * + equipment rental flow through the engines.
 */
export function calculatePileDrilling(input) {
    const diameter_mm = input.diameter_mm ?? DEFAULTS.diameter_mm;
    const length_m = input.length_m ?? DEFAULTS.length_m;
    const geology = input.geology ?? DEFAULTS.geology;
    const casing_method = input.casing_method ?? DEFAULTS.casing_method;
    // BUG 3/3b: diameter-dependent default replaces flat 40 kg/m³
    const rebar_index_kg_m3 = input.rebar_index_kg_m3 ?? getDefaultRebarIndex(diameter_mm);
    const concrete_class = input.concrete_class ?? DEFAULTS.concrete_class;
    const overpouring_m = input.overpouring_m ?? DEFAULTS.overpouring_m;
    const crew_size = input.crew_size ?? DEFAULTS.crew_size;
    const shift_h = input.shift_h ?? DEFAULTS.shift_h;
    const wage_czk_h = input.wage_czk_h ?? DEFAULTS.wage_czk_h;
    const rig_czk_per_shift = input.rig_czk_per_shift ?? DEFAULTS.rig_czk_per_shift;
    const crane_czk_per_shift = input.crane_czk_per_shift ?? DEFAULTS.crane_czk_per_shift;
    // ── 1. Volume + count ──────────────────────────────────────────────────
    // BUG-P2: pile is cast (length_m + overpouring_m) above design top.
    // The extra 0.5–1.0 m of concrete is later chipped away during head
    // adjustment, but the volume had to leave the truck.
    const designVolumePerPile = calculatePileVolume(diameter_mm, length_m);
    const pouredVolumePerPile = calculatePileVolume(diameter_mm, length_m + overpouring_m);
    // "volume_per_pile" we report is the DESIGN (design length) volume so
    // existing consumers (acceptance tests, rebar index) keep seeing the
    // same number. The overpouring loss shows up separately in
    // `overpouring_loss_m3` and is folded into `total_volume_m3`.
    const volume_per_pile_m3 = designVolumePerPile;
    // Use explicit count if given; otherwise derive from total volume.
    // NOTE: derivePileCount is called with DESIGN volume-per-pile, not
    // poured, so the user-supplied total_m3 is interpreted as DESIGN m³
    // (matches how quantity surveyors read TZ drawings).
    const count = input.count && input.count > 0
        ? Math.max(1, Math.round(input.count))
        : derivePileCount(input.volume_m3, diameter_mm, length_m);
    const design_total_m3 = input.volume_m3 > 0
        ? input.volume_m3
        : count * designVolumePerPile;
    const overpouring_loss_m3 = Math.round((count * (pouredVolumePerPile - designVolumePerPile)) * 100) / 100;
    const total_volume_m3 = Math.round((design_total_m3 + overpouring_loss_m3) * 10) / 10;
    // ── 2. Productivity & drilling days ────────────────────────────────────
    const productivity = getPileProductivity(diameter_mm, geology, casing_method);
    // ceil — partial shift = full shift on a real site
    const drilling_days = Math.max(1, Math.ceil(count / productivity));
    // ── 3. Head adjustment ─────────────────────────────────────────────────
    // BUG-P3: heads_per_shift depends on diameter. Ø600 = 5/směna,
    // Ø1500 = 1.5/směna. Previously hardcoded 3 regardless of size.
    const heads_per_shift_used = getHeadsPerShift(diameter_mm);
    const head_adjustment_days = Math.max(1, Math.ceil(count / heads_per_shift_used));
    // ── 4. Optional pile cap (hlavice) ─────────────────────────────────────
    // We treat the cap as a small patka with simplified labor formulas:
    //   - bednění:  4 m²/h · person → cap_area / (4 × crew × shift)
    //   - výztuž:   80 kg/h · person × 0.5 (small element overhead) → ~40 kg/h
    //   - betonáž:  6 m³/h
    //   - zrání:    7 days
    //   - odbednění: half of bednění
    // Total cap labor cost is computed inline; the Card in the UI just shows
    // the day total. This avoids a recursive planElement call (out of scope).
    let pile_cap_days;
    let pile_cap_labor_czk = 0;
    if (input.pile_cap) {
        const { length_m: cl, width_m: cw, height_m: ch } = input.pile_cap;
        const cap_volume_m3 = cl * cw * ch;
        const cap_area_m2 = 2 * (cl + cw) * ch + cl * cw; // sides + top
        const cap_rebar_kg = cap_volume_m3 * 80; // patka rebar index ≈ 80 kg/m³
        const formwork_h = cap_area_m2 / (4 * crew_size);
        const rebar_h = cap_rebar_kg / (40 * crew_size);
        const concrete_h = cap_volume_m3 / (6 * crew_size);
        const stripping_h = formwork_h * 0.5;
        const cap_total_h = formwork_h + rebar_h + concrete_h + stripping_h;
        const cap_active_days = Math.max(1, Math.ceil(cap_total_h / shift_h));
        const cap_curing_days = 7;
        pile_cap_days = cap_active_days + cap_curing_days;
        pile_cap_labor_czk = Math.round(cap_total_h * crew_size * wage_czk_h);
    }
    // ── 5. Schedule total ──────────────────────────────────────────────────
    const total_days = drilling_days +
        DEFAULTS.technological_pause_days +
        head_adjustment_days +
        (pile_cap_days ?? 0);
    // ── 6. Integrity tests (BUG-P4) ────────────────────────────────────────
    // CHA (cross-hole analysis) is the slow/expensive test, PIT is cheap.
    // Both are external subcontractor costs — no labor days, just money.
    // Default count 0 = opt-out; UI can fill 10% CHA + rest PIT.
    const cha_count = Math.max(0, Math.floor(input.cha_test_count ?? 0));
    const pit_count = Math.max(0, Math.floor(input.pit_test_count ?? 0));
    const cha_czk = cha_count * (input.cha_test_czk ?? DEFAULTS.cha_test_czk);
    const pit_czk = pit_count * (input.pit_test_czk ?? DEFAULTS.pit_test_czk);
    const integrity_total_czk = cha_czk + pit_czk;
    const integrity_tests = (cha_count + pit_count) > 0
        ? { cha_count, pit_count, cha_czk, pit_czk, total_czk: integrity_total_czk }
        : undefined;
    // ── 7. Costs ───────────────────────────────────────────────────────────
    // Drilling phase: rig + crane + crew
    const drilling_rig_czk = drilling_days * rig_czk_per_shift;
    const crane_czk = drilling_days * crane_czk_per_shift;
    const crew_labor_czk = Math.round(drilling_days * crew_size * shift_h * wage_czk_h);
    // Head adjustment: 2-person crew, no rig
    const head_crew = 2;
    const head_adjustment_labor_czk = Math.round(head_adjustment_days * head_crew * shift_h * wage_czk_h);
    const total_labor_czk = drilling_rig_czk +
        crane_czk +
        crew_labor_czk +
        head_adjustment_labor_czk +
        pile_cap_labor_czk +
        integrity_total_czk;
    // ── 8. Rebar mass (armokoše) ───────────────────────────────────────────
    // Rebar index applies to DESIGN volume, not poured — the overpouring
    // laitance has no armokoš.
    const rebar_total_kg = Math.round(design_total_m3 * rebar_index_kg_m3);
    // ── 9. Traceability log ────────────────────────────────────────────────
    const geologyLabelCs = {
        cohesive: 'soudržná zemina',
        noncohesive: 'nesoudržná zemina',
        below_gwt: 'pod hladinou podzemní vody',
        rock: 'skalní podloží',
    };
    const methodLabelCs = {
        cfa: 'CFA (průběžný šnek)',
        cased: 's pažnicí',
        uncased: 'bez pažení',
    };
    const log = [
        `Pilota: Ø${diameter_mm} × ${length_m} m, počet ${count}, beton ${concrete_class}`,
        `Geologie: ${geologyLabelCs[geology]}, metoda: ${methodLabelCs[casing_method]}`,
        `Objem 1 piloty (design): ${volume_per_pile_m3.toFixed(2)} m³, celkem design ${design_total_m3.toFixed(1)} m³`,
        `Přebetonování: +${overpouring_m} m → ztráta ${overpouring_loss_m3} m³ ` +
            `(celkem odlité: ${total_volume_m3.toFixed(1)} m³)`,
        `Produktivita: ${productivity} pilot/směna → vrtání ${drilling_days} dní`,
        `Technologická přestávka: ${DEFAULTS.technological_pause_days} dní (ČSN 73 1002)`,
        `Úprava hlav: ${head_adjustment_days} dní (${heads_per_shift_used} hlav/směna pro Ø${diameter_mm})`,
        ...(pile_cap_days ? [`Hlavice: ${pile_cap_days} dní (vč. zrání)`] : []),
        `Armokoše: ${rebar_total_kg} kg (index ${rebar_index_kg_m3} kg/m³, design objem)`,
        ...(integrity_tests
            ? [`Zkoušky integrity: ${cha_count}× CHA + ${pit_count}× PIT = ${integrity_total_czk.toLocaleString('cs')} Kč`]
            : []),
        `Celkem schedule: ${total_days} dní`,
    ];
    // BUG-P1: concrete class informs design, not schedule. Warn when the
    // combo doesn't match practice (e.g. C20/25 under water).
    if (casing_method === 'cased' && geology === 'below_gwt') {
        const fckMatch = concrete_class.match(/^C(\d+)\//);
        const fck = fckMatch ? parseInt(fckMatch[1], 10) : 30;
        if (fck < 25) {
            log.push(`⚠️ Třída ${concrete_class} pod HPV je pod minimem C25/30 (ČSN EN 206 + TKP 18).`);
        }
    }
    return {
        diameter_mm,
        length_m,
        count,
        geology,
        casing_method,
        rebar_index_kg_m3,
        concrete_class,
        volume_per_pile_m3: Math.round(volume_per_pile_m3 * 100) / 100,
        total_volume_m3,
        overpouring_loss_m3,
        overpouring_m,
        productivity_pile_per_shift: productivity,
        drilling_days,
        technological_pause_days: DEFAULTS.technological_pause_days,
        head_adjustment_days,
        heads_per_shift_used,
        pile_cap_days,
        total_days,
        rebar_total_kg,
        integrity_tests,
        costs: {
            drilling_rig_czk,
            crane_czk,
            crew_labor_czk,
            head_adjustment_labor_czk,
            pile_cap_labor_czk,
            integrity_tests_czk: integrity_total_czk,
            total_labor_czk,
        },
        log,
    };
}
