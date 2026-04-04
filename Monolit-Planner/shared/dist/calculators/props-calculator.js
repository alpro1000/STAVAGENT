/**
 * Props Calculator v1.0
 *
 * Calculates shoring/propping requirements for horizontal concrete elements:
 * - Number of props (from area + grid spacing)
 * - Prop type selection (from height)
 * - Assembly / disassembly time
 * - Rental cost
 * - Hold duration (from maturity / ČSN EN 13670)
 *
 * Applies to elements with needs_supports = true:
 *   mostovka, stropní deska, průvlak, římsová deska, schodiště, rigel
 *
 * Standards: ČSN EN 13670, ČSN 73 6244, DOKA Eurex/Staxo catalogs
 */
export const PROP_SYSTEMS = [
    {
        name: 'Eurex 20 top',
        manufacturer: 'Doka',
        min_height_m: 1.5,
        max_height_m: 3.5,
        assembly_h_per_prop: 0.12,
        disassembly_h_per_prop: 0.08,
        rental_czk_per_prop_day: 12,
        weight_kg: 18,
    },
    {
        name: 'Eurex 30 top',
        manufacturer: 'Doka',
        min_height_m: 2.5,
        max_height_m: 5.5,
        assembly_h_per_prop: 0.18,
        disassembly_h_per_prop: 0.12,
        rental_czk_per_prop_day: 18,
        weight_kg: 28,
    },
    {
        name: 'Staxo 40',
        manufacturer: 'Doka',
        min_height_m: 4.0,
        max_height_m: 12.0,
        assembly_h_per_prop: 0.35,
        disassembly_h_per_prop: 0.25,
        rental_czk_per_prop_day: 45,
        weight_kg: 85,
    },
    {
        name: 'Staxo 100',
        manufacturer: 'Doka',
        min_height_m: 8.0,
        max_height_m: 20.0,
        assembly_h_per_prop: 0.55,
        disassembly_h_per_prop: 0.40,
        rental_czk_per_prop_day: 75,
        weight_kg: 160,
    },
    {
        name: 'PEP Ergo',
        manufacturer: 'PERI',
        min_height_m: 1.5,
        max_height_m: 3.5,
        assembly_h_per_prop: 0.10,
        disassembly_h_per_prop: 0.07,
        rental_czk_per_prop_day: 11,
        weight_kg: 16,
    },
    {
        name: 'Multiprop MP 250',
        manufacturer: 'PERI',
        min_height_m: 1.5,
        max_height_m: 5.0,
        assembly_h_per_prop: 0.15,
        disassembly_h_per_prop: 0.10,
        rental_czk_per_prop_day: 15,
        weight_kg: 22,
    },
    {
        name: 'ST 100',
        manufacturer: 'PERI',
        min_height_m: 4.0,
        max_height_m: 14.0,
        assembly_h_per_prop: 0.40,
        disassembly_h_per_prop: 0.28,
        rental_czk_per_prop_day: 50,
        weight_kg: 95,
    },
];
// ─── Grid Spacing Defaults ──────────────────────────────────────────────────
/** Default prop grid spacing by element type (m × m) */
export const PROP_GRID_DEFAULTS = {
    stropni_deska: { grid_m: 1.5, description: 'Stropní deska: stojky 1.5 × 1.5 m (Dokaflex raster)' },
    mostovkova_deska: { grid_m: 1.25, description: 'Mostovka: skruž 1.25 × 1.25 m (Top 50 / Staxo raster)' },
    pruvlak: { grid_m: 1.0, description: 'Průvlak: podpěry 1.0 × 1.0 m (pod liniovým prvkem)' },
    rigel: { grid_m: 1.0, description: 'Příčník: podpěry 1.0 × 1.0 m (pod liniovým prvkem)' },
    rimsa: { grid_m: 1.25, description: 'Římsová deska: konzolové podpěry 1.25 × 1.25 m' },
    schodiste: { grid_m: 1.25, description: 'Schodiště: podpěry 1.25 × 1.25 m (šikmá plocha)' },
};
export const ELEMENT_DIMENSION_HINTS = {
    // ─── Bridge: horizontal with supports ────
    mostovkova_deska: {
        required_dimensions: ['height_m', 'thickness_m'],
        hint_cs: 'Výška = podpěrné lešení od terénu po spodek desky. Tloušťka = průřez desky.',
        typical_height_range: [4, 20],
        has_height: true,
    },
    rimsa: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška = vzdálenost od mostovky po spodek římsy (konzola).',
        typical_height_range: [1.5, 4],
        has_height: true,
    },
    rigel: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška = od základu pilíře po spodek příčníku.',
        typical_height_range: [3, 15],
        has_height: true,
    },
    // ─── Bridge: vertical (no supports) ────
    zaklady_piliru: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška základu (bednění pouze boční). Podpěry nepotřeba.',
        typical_height_range: [1, 3],
        has_height: true,
    },
    driky_piliru: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška dříku pilíře. Ovlivňuje volbu lešení a plošin.',
        typical_height_range: [3, 25],
        has_height: true,
    },
    operne_zdi: {
        required_dimensions: ['height_m', 'length_m'],
        hint_cs: 'Výška zdi (m), délka zdi (m). Vertikální — bez podpěr.',
        typical_height_range: [2, 10],
        has_height: true,
    },
    opery_ulozne_prahy: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška opěry od základové spáry.',
        typical_height_range: [3, 12],
        has_height: true,
    },
    mostni_zavirne_zidky: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška zídky (typicky 0.5–1.5 m). Malý prvek, bez podpěr.',
        typical_height_range: [0.5, 1.5],
        has_height: true,
    },
    prechodova_deska: {
        required_dimensions: ['thickness_m'],
        hint_cs: 'Tloušťka přechodové desky (m). Na terénu za opěrou — bez podpěr.',
        has_height: false,
    },
    // ─── Building: horizontal with supports ────
    stropni_deska: {
        required_dimensions: ['height_m', 'thickness_m'],
        hint_cs: 'Výška = světlá výška podlaží (stojky). Tloušťka desky = průřez.',
        typical_height_range: [2.5, 4.5],
        has_height: true,
    },
    pruvlak: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška = od podlahy po spodek průvlaku (podpěry).',
        typical_height_range: [2.5, 6],
        has_height: true,
    },
    schodiste: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška = podlažní výška schodiště (podpěry pod šikmou deskou).',
        typical_height_range: [2.8, 4.2],
        has_height: true,
    },
    // ─── Building: vertical (no supports) ────
    stena: {
        required_dimensions: ['height_m', 'length_m'],
        hint_cs: 'Výška stěny (m). Vertikální — bez podpěr, ovlivňuje plošiny.',
        typical_height_range: [2.5, 6],
        has_height: true,
    },
    sloup: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška sloupu (m). Vertikální — bez podpěr.',
        typical_height_range: [2.5, 6],
        has_height: true,
    },
    // ─── Foundation: no height needed typically ────
    zakladova_deska: {
        required_dimensions: ['thickness_m'],
        hint_cs: 'Tloušťka desky (m). Na terénu — bez podpěr, bez výšky.',
        has_height: false,
    },
    zakladovy_pas: {
        required_dimensions: [],
        hint_cs: 'Základový pás — bednění pouze boční, bez výšky.',
        has_height: false,
    },
    zakladova_patka: {
        required_dimensions: [],
        hint_cs: 'Základová patka — bednění pouze boční, bez výšky.',
        has_height: false,
    },
    // ─── Special ────
    nadrz: {
        required_dimensions: ['height_m'],
        hint_cs: 'Výška stěny nádrže (m). Vertikální — bez podpěr.',
        typical_height_range: [2, 8],
        has_height: true,
    },
    podzemni_stena: {
        required_dimensions: [],
        hint_cs: 'Podzemní stěna — bednění řízené jílovým suspenzí, bez klasické výšky.',
        has_height: false,
    },
    pilota: {
        required_dimensions: [],
        hint_cs: 'Pilota — vrtaná, bez bednění a podpěr.',
        has_height: false,
    },
    other: {
        required_dimensions: ['height_m'],
        hint_cs: 'Zadejte výšku elementu (m) pro odhad podpěr.',
        typical_height_range: [2, 10],
        has_height: true,
    },
};
// ─── Calculator ─────────────────────────────────────────────────────────────
function roundTo(val, decimals) {
    const f = Math.pow(10, decimals);
    return Math.round(val * f) / f;
}
/**
 * Select the best prop system for given height.
 * Prefers cheapest system that covers the height.
 */
export function selectPropSystem(height_m, override_name) {
    if (override_name) {
        const found = PROP_SYSTEMS.find(s => s.name === override_name);
        if (found)
            return found;
    }
    // Filter systems that cover this height
    const candidates = PROP_SYSTEMS.filter(s => height_m >= s.min_height_m && height_m <= s.max_height_m);
    if (candidates.length === 0) {
        // Height out of range — pick closest
        if (height_m < 1.5) {
            return PROP_SYSTEMS[0]; // Eurex 20 (shortest)
        }
        return PROP_SYSTEMS[PROP_SYSTEMS.length - 2]; // Staxo 100 (tallest)
    }
    // Sort by rental cost (cheapest first)
    candidates.sort((a, b) => a.rental_czk_per_prop_day - b.rental_czk_per_prop_day);
    return candidates[0];
}
export function calculateProps(input) {
    const warnings = [];
    const log = [];
    const crew = input.crew_size ?? 4;
    const shift = input.shift_h ?? 10;
    const k = input.k ?? 0.8;
    const wage = input.wage_czk_h ?? 398;
    const buffer = input.buffer_days ?? 2;
    // Grid spacing
    const gridDefault = PROP_GRID_DEFAULTS[input.element_type];
    const grid = input.grid_spacing_m ?? gridDefault?.grid_m ?? 1.5;
    log.push(`Grid: ${grid}m (${gridDefault?.description ?? 'default 1.5m'})`);
    // Prop system selection
    const system = selectPropSystem(input.height_m, input.prop_system_name);
    log.push(`System: ${system.name} (${system.manufacturer}), ${system.min_height_m}–${system.max_height_m}m`);
    if (input.height_m < system.min_height_m || input.height_m > system.max_height_m) {
        warnings.push(`Výška ${input.height_m}m je mimo rozsah systému ${system.name} ` +
            `(${system.min_height_m}–${system.max_height_m}m). Zkontrolujte výběr podpěrného systému.`);
    }
    // Number of props
    const gridArea = grid * grid;
    const numPropsPerTact = Math.ceil(input.formwork_area_m2 / gridArea);
    log.push(`Props/tact: ceil(${input.formwork_area_m2}m² / ${gridArea}m²) = ${numPropsPerTact}`);
    // For monolithic (1 tact) — all props at once
    // For sectional — props rotate between tacts (limited by hold_days)
    // If hold_days > assembly+disassembly, props can't rotate fast → need full set
    const totalPropsNeeded = numPropsPerTact; // one full set (hold_days prevent rotation)
    log.push(`Total props: ${totalPropsNeeded} (1 set, hold prevents fast rotation)`);
    // Assembly / disassembly time
    const asmHours = roundTo(numPropsPerTact * system.assembly_h_per_prop, 2);
    const disHours = roundTo(numPropsPerTact * system.disassembly_h_per_prop, 2);
    const asmDays = roundTo(asmHours / (crew * shift * k), 2);
    const disDays = roundTo(disHours / (crew * shift * k), 2);
    log.push(`Assembly: ${asmHours}h = ${asmDays}d, Disassembly: ${disHours}h = ${disDays}d`);
    // Rental duration
    // Props stay for: assembly + hold_days (per last tact) + disassembly + buffer
    const rentalDays = Math.ceil(asmDays + input.hold_days + disDays + buffer);
    const rentalCostCZK = roundTo(totalPropsNeeded * system.rental_czk_per_prop_day * rentalDays, 0);
    log.push(`Rental: ${totalPropsNeeded} × ${system.rental_czk_per_prop_day} Kč/d × ${rentalDays}d = ${rentalCostCZK} Kč`);
    // Labor cost: assembly + disassembly per tact × num_tacts
    const totalLaborH = (asmHours + disHours) * input.num_tacts;
    const laborCostCZK = roundTo(totalLaborH * wage, 0);
    log.push(`Labor: (${asmHours}+${disHours})h × ${input.num_tacts} tacts × ${wage} Kč/h = ${laborCostCZK} Kč`);
    // Weight
    const totalWeightKg = totalPropsNeeded * system.weight_kg;
    const craneNeeded = totalWeightKg > 500 || input.height_m > 5;
    if (craneNeeded) {
        warnings.push(`Podpěry: celková hmotnost ${(totalWeightKg / 1000).toFixed(1)} t — vyžaduje jeřáb pro montáž/demontáž.`);
    }
    if (input.height_m > 6) {
        warnings.push(`Výška podpěr ${input.height_m}m > 6m: vyžaduje podpěrné věže (${system.name}) ` +
            `se stabilizačními ztužidly. Kontrola dle ČSN EN 12812.`);
    }
    return {
        needed: true,
        system,
        grid_spacing_m: grid,
        num_props_per_tact: numPropsPerTact,
        total_props_needed: totalPropsNeeded,
        assembly_hours: asmHours,
        disassembly_hours: disHours,
        assembly_days: asmDays,
        disassembly_days: disDays,
        hold_days: input.hold_days,
        rental_days: rentalDays,
        rental_cost_czk: rentalCostCZK,
        labor_cost_czk: laborCostCZK,
        total_cost_czk: rentalCostCZK + laborCostCZK,
        total_weight_kg: totalWeightKg,
        crane_needed: craneNeeded,
        warnings,
        log,
    };
}
