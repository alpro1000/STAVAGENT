/**
 * Bridge Construction Technology v1.0
 *
 * Recommends construction technology for bridge deck (mostovková deska):
 *   - Pevná skruž (fixed scaffolding) — whole bridge at once
 *   - Posuvná skruž / MSS (movable scaffolding system) — span by span
 *   - Letmá betonáž / CFT (cantilever free casting) — info only
 *
 * Reference data: SO204 (SAFE 2025), SO207 (D6 TZ 2025), SO221 (I/20 TZ 2025)
 */
// ─── Constants ──────────────────────────────────────────────────────────────
/** Default tact duration (days) by deck subtype for MSS. */
const MSS_TACT_DAYS = {
    deskovy: 14,
    jednotram: 18,
    dvoutram: 21,
    vicetram: 21,
    jednokomora: 28,
    dvoukomora: 28,
    ramovy: 18,
    sprazeny: 10, // only monolithic deck, not prefab
};
/** MSS mobilization cost ranges by span size (Kč). */
const MSS_MOBILIZATION = [
    { max_span_m: 40, cost_czk: 4500000, label: 'Malá MSS (do 40m)' },
    { max_span_m: 60, cost_czk: 7500000, label: 'Střední MSS (do 60m)' },
    { max_span_m: 80, cost_czk: 12000000, label: 'Velká MSS (do 80m)' },
];
/** MSS monthly rental by span size (Kč/month). */
const MSS_RENTAL_MONTH = [
    { max_span_m: 40, rental_czk: 1200000 },
    { max_span_m: 60, rental_czk: 1600000 },
    { max_span_m: 80, rental_czk: 2000000 },
];
/** Simplified MSS unit cost by span range (Kč/m² NK). */
const MSS_UNIT_COST = [
    { max_span_m: 35, czk_m2: 3000 },
    { max_span_m: 50, czk_m2: 4000 },
    { max_span_m: 80, czk_m2: 6000 },
];
/** MSS setup/teardown days. */
const MSS_SETUP_DAYS = 30;
const MSS_TEARDOWN_DAYS = 15;
const MSS_MOVE_DAYS = 3; // days to move MSS between spans
// ─── Technology Recommendation ──────────────────────────────────────────────
export function recommendBridgeTechnology(input) {
    const { span_m, clearance_height_m, num_spans, deck_subtype } = input;
    const warnings = [];
    // Build feasibility map
    const fixedFeasible = clearance_height_m <= 25;
    const fixedInfeasibleReason = !fixedFeasible
        ? `Výška ${clearance_height_m}m > 25m — standardní podpěrné věže nepostačují.`
        : undefined;
    const mssFeasible = span_m >= 25 && span_m <= 80;
    const mssInfeasibleReason = !mssFeasible
        ? span_m < 25
            ? `Rozpětí ${span_m}m < 25m — posuvná skruž je neekonomická pro krátká rozpětí.`
            : `Rozpětí ${span_m}m > 80m — přesahuje rozsah standardních MSS systémů.`
        : undefined;
    const cantileverFeasible = span_m > 80 &&
        (deck_subtype === 'jednokomora' || deck_subtype === 'dvoukomora');
    const cantileverInfeasibleReason = !cantileverFeasible
        ? span_m <= 80
            ? `Rozpětí ${span_m}m — letmá betonáž se používá od 80m.`
            : `Letmá betonáž vyžaduje komorový průřez (jednokomora/dvoukomora).`
        : undefined;
    // Decision logic
    let recommended;
    let reason;
    if (span_m > 80) {
        recommended = cantileverFeasible ? 'cantilever' : 'mss';
        reason = cantileverFeasible
            ? `Rozpětí ${span_m}m > 80m — letmá betonáž (CFT) je standardní řešení pro komorové nosníky.`
            : `Rozpětí ${span_m}m > 80m — letmá betonáž vyžaduje komorový průřez. Posuvná skruž je alternativa.`;
    }
    else if (span_m > 40) {
        recommended = 'mss';
        reason = `Rozpětí ${span_m}m > 40m — pevná skruž je technicky náročná a drahá. Posuvná skruž (MSS) je standardní řešení.`;
    }
    else if (num_spans >= 4 && mssFeasible) {
        recommended = 'mss';
        reason = `Rozpětí ${span_m}m × ${num_spans} polí — při 4+ polích je posuvná skruž obvykle výhodnější (bednění se přesouvá, nedemontuje).`;
    }
    else {
        recommended = fixedFeasible ? 'fixed_scaffolding' : 'mss';
        reason = fixedFeasible
            ? `Rozpětí ${span_m}m × ${num_spans} pol${num_spans === 1 ? 'e' : num_spans < 5 ? 'e' : 'í'} — pevná skruž je ekonomičtější pro krátké mosty.`
            : `Výška ${clearance_height_m}m > 25m — pevná skruž neproveditelná, doporučena posuvná skruž.`;
    }
    // Height warnings
    if (clearance_height_m > 20 && fixedFeasible) {
        warnings.push(`Výška ${clearance_height_m}m — vyžaduje podpěrné věže SL-1 (430 kN), ` +
            `speciální projekt podpěrné konstrukce. Konzultujte s dodavatelem.`);
    }
    else if (clearance_height_m > 8) {
        warnings.push(`Výška ${clearance_height_m}m — věže Staxo 100 / ST 100, nutný jeřáb pro montáž/demontáž.`);
    }
    // Technology-specific warnings
    if (recommended === 'fixed_scaffolding' && num_spans >= 4) {
        warnings.push(`Rozpětí ${span_m}m × ${num_spans} polí — zvažte posuvnou skruž. ` +
            `Při 4+ polích bývá MSS ekonomičtější (bednění se nedemontuje, přesune).`);
    }
    if (input.is_prestressed && mssFeasible) {
        warnings.push(`Předpjatý beton + posuvná skruž → kabely spojkovány v pracovních spárách mezi poli.`);
    }
    if (deck_subtype === 'sprazeny') {
        warnings.push(`Spřažená ocelbetonová konstrukce: bednění NK = ztracené bednění desky + konzoly (DOKA VARIOKIT). ` +
            `Ocelové nosníky nesou samy sebe — podpěry jen pod monolitickou deskou.`);
    }
    const options = [
        {
            technology: 'fixed_scaffolding',
            label_cs: 'Pevná skruž',
            feasible: fixedFeasible,
            infeasible_reason: fixedInfeasibleReason,
            is_recommended: recommended === 'fixed_scaffolding',
        },
        {
            technology: 'mss',
            label_cs: 'Posuvná skruž (MSS)',
            feasible: mssFeasible,
            infeasible_reason: mssInfeasibleReason,
            is_recommended: recommended === 'mss',
        },
        {
            technology: 'cantilever',
            label_cs: 'Letmá betonáž (CFT)',
            feasible: cantileverFeasible,
            infeasible_reason: cantileverInfeasibleReason,
            is_recommended: recommended === 'cantilever',
        },
    ];
    return { recommended, reason, options, warnings };
}
// ─── MSS Cost Calculator ────────────────────────────────────────────────────
export function calculateMSSCost(input) {
    const { span_m, num_spans, nk_width_m, tact_days } = input;
    const nk_area_m2 = span_m * num_spans * nk_width_m;
    // Mobilization
    const mobEntry = MSS_MOBILIZATION.find(e => span_m <= e.max_span_m)
        ?? MSS_MOBILIZATION[MSS_MOBILIZATION.length - 1];
    const mobilization_czk = input.mobilization_czk_override ?? mobEntry.cost_czk;
    // Monthly rental
    const rentalEntry = MSS_RENTAL_MONTH.find(e => span_m <= e.max_span_m)
        ?? MSS_RENTAL_MONTH[MSS_RENTAL_MONTH.length - 1];
    const rental_czk_month = input.rental_czk_month_override ?? rentalEntry.rental_czk;
    // Rental duration (months)
    const total_construction_days = MSS_SETUP_DAYS + num_spans * tact_days + MSS_TEARDOWN_DAYS;
    const rental_months = Math.ceil((total_construction_days / 30) * 10) / 10; // round to 0.1
    const rental_total_czk = Math.round(rental_czk_month * rental_months);
    // Demobilization (~50% of mobilization)
    const demobilization_czk = input.demobilization_czk_override
        ?? Math.round(mobilization_czk * 0.5);
    const total_czk = mobilization_czk + rental_total_czk + demobilization_czk;
    const unit_cost_czk_m2 = nk_area_m2 > 0 ? Math.round(total_czk / nk_area_m2) : 0;
    return {
        mobilization_czk,
        rental_czk_month,
        rental_months,
        rental_total_czk,
        demobilization_czk,
        total_czk,
        unit_cost_czk_m2,
        nk_area_m2,
        model: 'detailed',
    };
}
/**
 * Simplified MSS cost model — JC per m² NK.
 * For quick estimates when detailed parameters are not available.
 */
export function calculateMSSCostSimplified(span_m, nk_area_m2, unit_cost_override_czk_m2) {
    const ucEntry = MSS_UNIT_COST.find(e => span_m <= e.max_span_m)
        ?? MSS_UNIT_COST[MSS_UNIT_COST.length - 1];
    const czk_m2 = unit_cost_override_czk_m2 ?? ucEntry.czk_m2;
    const total_czk = Math.round(nk_area_m2 * czk_m2);
    return {
        mobilization_czk: 0,
        rental_czk_month: 0,
        rental_months: 0,
        rental_total_czk: 0,
        demobilization_czk: 0,
        total_czk,
        unit_cost_czk_m2: czk_m2,
        nk_area_m2,
        model: 'simplified',
    };
}
// ─── MSS Schedule Calculator ────────────────────────────────────────────────
export function calculateMSSSchedule(num_spans, deck_subtype, is_prestressed, tact_days_override) {
    const baseTactDays = tact_days_override
        ?? MSS_TACT_DAYS[deck_subtype ?? 'deskovy']
        ?? 14;
    // Tact breakdown: formwork + rebar + concrete + curing/prestress + move
    const curing_prestress_days = is_prestressed ? 7 : 3;
    const formwork_days = Math.max(2, Math.round(baseTactDays * 0.25));
    const rebar_days = Math.max(2, Math.round(baseTactDays * 0.25));
    const concrete_days = 1;
    const move_days = MSS_MOVE_DAYS;
    // Adjust tact days to be consistent with breakdown
    const computed_tact_days = formwork_days + rebar_days + concrete_days + curing_prestress_days + move_days;
    const tact_days = tact_days_override ?? Math.max(baseTactDays, computed_tact_days);
    const setup_days = MSS_SETUP_DAYS;
    const teardown_days = MSS_TEARDOWN_DAYS;
    const total_days = setup_days + num_spans * tact_days + teardown_days;
    return {
        setup_days,
        tact_days,
        num_tacts: num_spans,
        total_days,
        teardown_days,
        tact_breakdown: {
            formwork_days,
            rebar_days,
            concrete_days,
            curing_prestress_days,
            move_days,
        },
    };
}
/**
 * Get default MSS tact duration for a deck subtype.
 */
export function getMSSTactDays(deck_subtype) {
    return MSS_TACT_DAYS[deck_subtype ?? 'deskovy'] ?? 14;
}
