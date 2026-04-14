/**
 * Element Classifier v1.0
 *
 * Classifies construction elements by name/description and provides:
 * - Structural element type
 * - Recommended formwork system(s)
 * - Typical rebar ratio (kg/m³)
 * - Assembly difficulty factor
 * - Required auxiliary systems (supports, platforms, crane)
 * - Curing strip strength requirement
 *
 * Used by: Planner Orchestrator, Formwork Engine, Rebar Lite, Pour Task Engine
 */
import { FORMWORK_SYSTEMS } from '../constants-data/formwork-systems.js';
import { calculateLateralPressure, filterFormworkByPressure, inferPourMethod } from '../calculators/lateral-pressure.js';
// ─── Element Catalog ─────────────────────────────────────────────────────────
const ELEMENT_CATALOG = {
    zaklady_piliru: {
        label_cs: 'Základy pilířů / patky',
        recommended_formwork: ['Frami Xlife', 'DOMINO', 'Tradiční tesařské'],
        difficulty_factor: 0.9,
        needs_supports: false,
        needs_platforms: false,
        needs_crane: false,
        rebar_ratio_kg_m3: 100,
        rebar_ratio_range: [80, 120],
        rebar_norm_h_per_t: 40,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 40,
        pump_typical: true,
    },
    driky_piliru: {
        label_cs: 'Dříky pilířů / sloupy',
        recommended_formwork: ['VARIO GT 24', 'TRIO', 'QUATTRO', 'SL-1 Sloupové', 'Framax Xlife'],
        difficulty_factor: 1.1,
        needs_supports: false,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 150,
        rebar_ratio_range: [100, 200],
        rebar_norm_h_per_t: 55,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 25,
        pump_typical: true,
    },
    rimsa: {
        label_cs: 'Římsa',
        recommended_formwork: ['Římsové bednění T', 'Římsový vozík TU', 'Římsový vozík T'],
        difficulty_factor: 1.15,
        needs_supports: false,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 120,
        rebar_ratio_range: [100, 180],
        rebar_norm_h_per_t: 50,
        strip_strength_pct: 70,
        orientation: 'horizontal',
        max_pour_rate_m3_h: 20,
        pump_typical: true,
    },
    operne_zdi: {
        label_cs: 'Opěrné zdi',
        recommended_formwork: ['TRIO', 'Framax Xlife', 'MAXIMO', 'Frami Xlife'],
        difficulty_factor: 1.0,
        needs_supports: false,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 90,
        rebar_ratio_range: [60, 120],
        rebar_norm_h_per_t: 45,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 35,
        pump_typical: true,
    },
    mostovkova_deska: {
        label_cs: 'Mostovková deska',
        recommended_formwork: ['MULTIFLEX', 'Top 50', 'Dokaflex'],
        difficulty_factor: 1.2,
        needs_supports: true,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 150,
        rebar_ratio_range: [120, 180],
        rebar_norm_h_per_t: 50,
        strip_strength_pct: 70,
        orientation: 'horizontal',
        max_pour_rate_m3_h: 30,
        pump_typical: true,
    },
    rigel: {
        label_cs: 'Příčník / hlavice pilíře',
        recommended_formwork: ['VARIO GT 24', 'Framax Xlife', 'TRIO', 'Tradiční tesařské'],
        difficulty_factor: 1.1,
        needs_supports: true,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 140,
        rebar_ratio_range: [110, 170],
        rebar_norm_h_per_t: 55,
        strip_strength_pct: 70,
        orientation: 'horizontal',
        max_pour_rate_m3_h: 25,
        pump_typical: true,
    },
    opery_ulozne_prahy: {
        label_cs: 'Opěry, úložné prahy',
        recommended_formwork: ['TRIO', 'Framax Xlife', 'DOMINO', 'Frami Xlife'],
        difficulty_factor: 1.0,
        needs_supports: false,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 100,
        rebar_ratio_range: [80, 130],
        rebar_norm_h_per_t: 45,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 35,
        pump_typical: true,
    },
    kridla_opery: {
        label_cs: 'Křídla mostních opěr',
        recommended_formwork: ['Frami Xlife', 'Framax Xlife', 'Frami Xlife'],
        difficulty_factor: 0.9,
        needs_supports: false,
        needs_platforms: true,
        needs_crane: false, // Frami = ruční; Framax potřebuje jeřáb ale jen pro h>3m
        rebar_ratio_kg_m3: 90,
        rebar_ratio_range: [70, 120],
        rebar_norm_h_per_t: 45,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 35,
        pump_typical: false,
    },
    mostni_zavirne_zidky: {
        label_cs: 'Mostní závěrné zídky',
        recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
        difficulty_factor: 0.85,
        needs_supports: false,
        needs_platforms: false,
        needs_crane: false,
        rebar_ratio_kg_m3: 80,
        rebar_ratio_range: [60, 100],
        rebar_norm_h_per_t: 40,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 30,
        pump_typical: false,
    },
    prechodova_deska: {
        label_cs: 'Přechodová deska',
        recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
        difficulty_factor: 0.9,
        needs_supports: false,
        needs_platforms: false,
        needs_crane: false,
        rebar_ratio_kg_m3: 90,
        rebar_ratio_range: [80, 100],
        rebar_norm_h_per_t: 40,
        strip_strength_pct: 50,
        orientation: 'horizontal',
        max_pour_rate_m3_h: 35,
        pump_typical: true,
    },
    // ─── Building elements (pozemní stavby) ────────────────────────────────────
    zakladova_deska: {
        label_cs: 'Základová deska',
        recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
        difficulty_factor: 0.85,
        needs_supports: false,
        needs_platforms: false,
        needs_crane: false,
        rebar_ratio_kg_m3: 110,
        rebar_ratio_range: [80, 140],
        rebar_norm_h_per_t: 40,
        strip_strength_pct: 50,
        orientation: 'horizontal',
        max_pour_rate_m3_h: 40,
        pump_typical: true,
    },
    zakladovy_pas: {
        label_cs: 'Základový pás',
        recommended_formwork: ['Frami Xlife', 'DOMINO', 'Tradiční tesařské'],
        difficulty_factor: 0.8,
        needs_supports: false,
        needs_platforms: false,
        needs_crane: false,
        rebar_ratio_kg_m3: 80,
        rebar_ratio_range: [50, 110],
        rebar_norm_h_per_t: 35,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 40,
        pump_typical: true,
    },
    zakladova_patka: {
        label_cs: 'Základová patka',
        recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
        difficulty_factor: 0.8,
        needs_supports: false,
        needs_platforms: false,
        needs_crane: false,
        rebar_ratio_kg_m3: 90,
        rebar_ratio_range: [60, 120],
        rebar_norm_h_per_t: 35,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 40,
        pump_typical: true,
    },
    stropni_deska: {
        label_cs: 'Stropní deska / podlahová deska',
        recommended_formwork: ['Dokaflex', 'SKYDECK', 'Top 50'],
        difficulty_factor: 1.0,
        needs_supports: true, // stojky / podpěry
        needs_platforms: false,
        needs_crane: true,
        rebar_ratio_kg_m3: 120,
        rebar_ratio_range: [80, 160],
        rebar_norm_h_per_t: 45,
        strip_strength_pct: 70, // horizontal — higher strip strength
        orientation: 'horizontal',
        max_pour_rate_m3_h: 35,
        pump_typical: true,
    },
    stena: {
        label_cs: 'Monolitická stěna',
        recommended_formwork: ['Framax Xlife', 'MAXIMO', 'TRIO', 'Frami Xlife'],
        difficulty_factor: 1.0,
        needs_supports: false,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 80,
        rebar_ratio_range: [50, 120],
        rebar_norm_h_per_t: 45,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 30,
        pump_typical: true,
    },
    sloup: {
        label_cs: 'Sloup',
        recommended_formwork: ['SL-1 Sloupové', 'QUATTRO', 'SRS', 'Framax Xlife'],
        difficulty_factor: 1.1,
        needs_supports: false,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 160,
        rebar_ratio_range: [120, 220],
        rebar_norm_h_per_t: 55,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 20,
        pump_typical: true,
    },
    pruvlak: {
        label_cs: 'Průvlak / trám',
        recommended_formwork: ['Dokaflex', 'Tradiční tesařské'],
        difficulty_factor: 1.15,
        needs_supports: true, // skruž / podpěry
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 140,
        rebar_ratio_range: [100, 180],
        rebar_norm_h_per_t: 55,
        strip_strength_pct: 70, // horizontal
        orientation: 'horizontal',
        max_pour_rate_m3_h: 25,
        pump_typical: true,
    },
    schodiste: {
        label_cs: 'Schodiště',
        recommended_formwork: ['Tradiční tesařské', 'Dokaflex'],
        difficulty_factor: 1.3, // complex formwork (sloped + steps)
        needs_supports: true,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 130,
        rebar_ratio_range: [100, 170],
        rebar_norm_h_per_t: 60,
        strip_strength_pct: 70,
        orientation: 'horizontal',
        max_pour_rate_m3_h: 15,
        pump_typical: true,
    },
    nadrz: {
        label_cs: 'Nádrž / jímka / bazén',
        recommended_formwork: ['Framax Xlife', 'RUNDFLEX', 'Frami Xlife'],
        difficulty_factor: 1.1,
        needs_supports: false,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 100,
        rebar_ratio_range: [70, 140],
        rebar_norm_h_per_t: 50,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 25,
        pump_typical: true,
    },
    podzemni_stena: {
        label_cs: 'Podzemní stěna (milánská)',
        recommended_formwork: ['Tradiční tesařské'], // usually no traditional formwork — guide walls + bentonite
        difficulty_factor: 1.3,
        needs_supports: false,
        needs_platforms: true,
        needs_crane: true,
        rebar_ratio_kg_m3: 80,
        rebar_ratio_range: [50, 120],
        rebar_norm_h_per_t: 50,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 20,
        pump_typical: true,
    },
    pilota: {
        label_cs: 'Pilota / mikropilota',
        recommended_formwork: ['Tradiční tesařské'], // no formwork — bored pile
        difficulty_factor: 0.7, // no formwork work
        needs_supports: false,
        needs_platforms: false,
        needs_crane: true,
        rebar_ratio_kg_m3: 60,
        rebar_ratio_range: [40, 100],
        rebar_norm_h_per_t: 30,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 30,
        pump_typical: false, // tremie pipe, not pump
    },
    other: {
        label_cs: 'Jiný monolitický prvek',
        recommended_formwork: ['Frami Xlife'],
        difficulty_factor: 1.0,
        needs_supports: false,
        needs_platforms: false,
        needs_crane: false,
        rebar_ratio_kg_m3: 100,
        rebar_ratio_range: [60, 150],
        rebar_norm_h_per_t: 45,
        strip_strength_pct: 50,
        orientation: 'vertical',
        max_pour_rate_m3_h: 30,
        pump_typical: true,
    },
};
/**
 * OTSKP→element_type mapping table.
 * Checked BEFORE keyword rules. Patterns match normalized (lowercased) OTSKP names.
 * Order matters — first match wins.
 */
const OTSKP_RULES = [
    // ─── Mostovková deska subtypes ───
    { pattern: /mostn[ií]\s*nosn[eéa]\s*deskove|mostn[ií]\s*nosn[eéa]\s*desk\s*konstr/,
        element_type: 'mostovkova_deska', metadata: { bridge_deck_subtype: 'deskovy' } },
    { pattern: /mostn[ií]\s*nosn[eéa]\s*tram\s*konstr|mostn[ií]\s*nosn[eéa]\s*trám/,
        element_type: 'mostovkova_deska', metadata: { bridge_deck_subtype: 'dvoutram' } },
    { pattern: /mostn[ií]\s*nosn[eéa]\s*komorov/,
        element_type: 'mostovkova_deska', metadata: { bridge_deck_subtype: 'jednokomora' } },
    { pattern: /mostn[ií]\s*nosn[ií]ky\s*z\s*d[ií]lc[uů]|nosn[ií]ky\s*z\s*d[ií]lc/,
        element_type: 'mostovkova_deska', metadata: { is_prefab: true } },
    // ─── Opěry ───
    { pattern: /mostn[ií]\s*op[eě]ry\s*(a\s*)?k[rř][ií]dl/,
        element_type: 'opery_ulozne_prahy', metadata: { has_kridla: true } },
    { pattern: /mostn[ií]\s*op[eě]ry/,
        element_type: 'opery_ulozne_prahy' },
    // ─── Pilíře ───
    { pattern: /mostn[ií]\s*pil[ií][rř]e?\s*(a\s*)?stativ/,
        element_type: 'driky_piliru' },
    // ─── Římsy ───
    { pattern: /[rř][ií]msy|[rř][ií]msov/,
        element_type: 'rimsa' },
    // ─── Přechodové desky ───
    { pattern: /p[rř]echodov[eéa]\s*desk/,
        element_type: 'prechodova_deska' },
    // ─── Závěrné zídky ───
    { pattern: /z[aá]v[eě]rn[eéa]\s*z[ií]dk/,
        element_type: 'mostni_zavirne_zidky' },
    // ─── Křídla (standalone) ───
    { pattern: /k[rř][ií]dl[oa]\s+op[eě]r|k[rř][ií]dl[oa]\s+most/,
        element_type: 'kridla_opery' },
];
/**
 * Extract metadata from OTSKP element name.
 * Detects concrete class, prestress, and material type.
 */
export function extractOtskpMetadata(name) {
    const n = name.toUpperCase();
    const result = {};
    // Concrete class: C20/25, C30/37, C35/45, C40/50
    const ccMatch = n.match(/C(\d{2})\/(\d{2,3})/);
    if (ccMatch)
        result.concrete_class = `C${ccMatch[1]}/${ccMatch[2]}`;
    // Prestressed vs reinforced vs plain
    if (/PŘEDPJ|PŘEDPĚT|PŘEPJ|PREDPJ/.test(n)) {
        result.is_prestressed = true;
    }
    else if (/ŽELEZOB|ŽELEZOVÉHO/.test(n)) {
        result.is_prestressed = false;
    }
    else if (/PROST\s*BET|PROSTÉHO/.test(n)) {
        result.is_prestressed = false;
    }
    // Prefab
    if (/Z\s*DÍLCŮ|Z\s*DILCU/.test(n)) {
        result.is_prefab = true;
    }
    return result;
}
const KEYWORD_RULES = [
    // ─── Bridge elements (higher priority) ───
    {
        element_type: 'mostovkova_deska',
        keywords: [
            'mostovka', 'mostovkov', 'mostova deska', 'mostní deska', 'mostni deska',
            'deska mostu', 'nosna konstrukce', 'nosná konstrukce', 'bridge deck',
            'nosne tram', 'nosné trám', 'nosna konstr', 'nosná konstr',
            'predpj bet', 'předpj bet', 'predpjat', 'předpjat',
            'nosnik most', 'nosník most', 'podelny nosnik', 'podélný nosník',
            'mostni svrsek', 'mostní svršek', 'superstructure',
            'hlavni nosnik', 'hlavní nosník', 'komorovy nosnik', 'komorový nosník',
            'deska nosne', 'deska nosné', 'nosna deska', 'nosná deska',
            'мостов', 'мостовая плита', 'пролетное строение',
        ],
        priority: 10,
    },
    { element_type: 'rimsa', keywords: [
            'rimsa', 'říms', 'rimsov', 'rimsova deska', 'římsová deska',
            'zabradeln zid', 'zábradelní zíd', 'zabradel', 'zábradel',
            'parapet', 'cornice', 'coping',
            'римс', 'карниз',
        ], priority: 10 },
    { element_type: 'prechodova_deska', keywords: [
            'prechodova deska', 'přechodová deska', 'prechodove desky', 'přechodové desky',
            'prechodov', 'přechodov', 'transition slab', 'approach slab',
        ], priority: 11 },
    { element_type: 'mostni_zavirne_zidky', keywords: [
            'zavirn', 'závěrn', 'zavirne zidky', 'závěrné zídky',
            'zidka most', 'zídka most',
            'closure wall', 'end wall',
        ], priority: 9 },
    { element_type: 'rigel', keywords: [
            'pricnik', 'příčník', 'pricni', 'příčn',
            'pricnik most', 'příčník most',
            'rigel', 'ригель',
            'hlavice pilir', 'hlavice pilíř', 'hlavic', 'pier cap', 'crossbeam',
            'diafragm', 'diaphragm',
        ], priority: 9 },
    { element_type: 'zaklady_piliru', keywords: [
            'zaklad pilir', 'základ pilíř', 'zaklady piliru', 'základy pilířů',
            'zaklady', 'základy',
            'pilotov zaklad', 'pilotový základ',
            'zakladovy blok', 'základový blok', 'blok oper', 'blok opěr',
            'plosny zaklad most', 'plošný základ most',
            'фундамент опор', 'фундамент пилон',
        ], priority: 10 },
    { element_type: 'driky_piliru', keywords: [
            'drik', 'dřík', 'driky pilir', 'dříky pilíř',
            'pilir most', 'pilíř most',
            'mostni pilir', 'mostní pilíř', 'mostni pilire', 'mostní pilíře',
            'stativ', 'stativa',
            'telo pilir', 'tělo pilíř', 'telo oper', 'tělo opěr',
            'pier stem', 'pier shaft', 'pylon',
            'тело опор', 'столб моста',
        ], priority: 8 },
    { element_type: 'operne_zdi', keywords: [
            'opern', 'opěrn', 'operna zed', 'opěrná zeď',
            'operne zdi most', 'opěrné zdi most',
            'gabionov', 'gabion',
            'retaining wall',
            'подпорн стен',
        ], priority: 8 },
    { element_type: 'kridla_opery', keywords: [
            'kridl', 'křídl', 'kridla', 'křídla', 'křídlo',
            'wing wall', 'mostni kridl', 'mostní křídl',
        ], priority: 9 },
    { element_type: 'opery_ulozne_prahy', keywords: [
            'opera', 'opěra', 'opery', 'opěry',
            'ulozn', 'úložn', 'ulozne prah', 'úložné prah',
            'prah', 'sedlo',
            'mostni oper', 'mostní opěr', 'mostni opery', 'mostní opěry',
            'abutment', 'bearing seat',
        ], priority: 7 },
    // ─── Building elements ───
    { element_type: 'stropni_deska', keywords: [
            'stropni', 'stropní', 'strop', 'podlah', 'podlažní', 'floor slab',
            'перекрыт', 'плита перекрыт', 'монолитн перекрыт',
        ], priority: 7 },
    { element_type: 'zakladova_deska', keywords: [
            'zakladova deska', 'základová deska', 'zakladni deska', 'základní deska',
            'foundation slab', 'фундаментн плит', 'фундаментн деск',
        ], priority: 9 },
    { element_type: 'zakladovy_pas', keywords: [
            'zakladovy pas', 'základový pás', 'zakladove pasy', 'základové pásy',
            'zaklady', 'základy',
            'strip found', 'ленточн фундамент',
        ], priority: 9 },
    { element_type: 'zakladova_patka', keywords: [
            'patka', 'patky', 'zakladova patka', 'základová patka', 'pad found',
            'столбчат фундамент',
        ], priority: 8 },
    { element_type: 'stena', keywords: [
            'stena', 'stěna', 'zed', 'zeď', 'jadro', 'jádro', 'core wall', 'shear wall',
            'стена', 'монолитн стен', 'ядро жесткости',
        ], priority: 6 },
    { element_type: 'sloup', keywords: [
            'sloup', 'pilir', 'pilíř', 'column', 'pillar',
            'колонн', 'столб', 'пилон',
        ], priority: 6 },
    { element_type: 'pruvlak', keywords: [
            'pruvlak', 'průvlak', 'tram', 'trám', 'beam', 'girder', 'preklad', 'překlad',
            'nosnik', 'nosník',
            'балк', 'прогон', 'ригель здан',
        ], priority: 6 },
    { element_type: 'schodiste', keywords: [
            'schodist', 'schodiště', 'schody', 'staircase', 'stairs', 'stupne', 'stupně',
            'лестниц',
        ], priority: 8 },
    { element_type: 'nadrz', keywords: [
            'nadrz', 'nádrž', 'jimka', 'jímka', 'bazen', 'bazén', 'nadoba', 'nádoba',
            'tank', 'reservoir', 'pool', 'vodojem',
            'резервуар', 'ёмкость', 'бассейн', 'отстойник',
        ], priority: 8 },
    { element_type: 'podzemni_stena', keywords: [
            'podzemni stena', 'podzemní stěna', 'milansk', 'milánsk', 'diaphragm wall',
            'стена в грунт', 'милан',
        ], priority: 9 },
    { element_type: 'pilota', keywords: [
            'pilota', 'piloty', 'mikropilot', 'vrtana pilota', 'vrtaná pilota', 'bored pile',
            'свая', 'буронабивн',
        ], priority: 8 },
];
/**
 * Normalize Czech text for keyword matching: lowercase + strip diacritics
 */
function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
// ─── Main API ────────────────────────────────────────────────────────────────
/** Bridge element types — get priority boost in bridge context */
const BRIDGE_ELEMENT_TYPES = new Set([
    'zaklady_piliru', 'driky_piliru', 'rimsa', 'operne_zdi',
    'mostovkova_deska', 'rigel', 'opery_ulozne_prahy', 'kridla_opery',
    'mostni_zavirne_zidky', 'prechodova_deska',
]);
/** Building element types that have bridge equivalents */
const BRIDGE_EQUIVALENT = {
    sloup: 'driky_piliru', // "pilíř" in bridge context = dříky pilířů, not sloup
    zakladova_deska: 'zaklady_piliru', // "základy" in bridge context = základy pilířů
    zakladovy_pas: 'zaklady_piliru',
    zakladova_patka: 'zaklady_piliru', // "patky" in bridge context = základy pilířů
    stropni_deska: 'mostovkova_deska', // "deska" in bridge context = mostovková deska
    pruvlak: 'rigel', // "trám/nosník" in bridge context = příčník
    stena: 'operne_zdi', // "stěna" in bridge context = opěrná zeď
};
/**
 * Classify a construction element by name/description.
 *
 * @param name - Part name or description (Czech), e.g. "ZÁKLADY PILÍŘŮ", "Mostovková deska"
 * @param context - Optional context (is_bridge) to resolve ambiguities like pilíř vs sloup
 * @returns ElementProfile with all defaults and recommendations
 */
export function classifyElement(name, context) {
    const normalized = normalize(name);
    const isBridge = context?.is_bridge ?? false;
    // ─── Early-exit rules: special materials/non-structural → always 'other' ───
    // PODKLADNÍ/VÝPLŇOVÉ = plain concrete, simplified calculation
    if (/podkladn|podkl\b|vyplnov|výplňov/.test(normalized)) {
        return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
    }
    // STŘÍKANÝ = shotcrete, special technology
    if (/strikan|stříkan|torkret|nastrik|nástřik/.test(normalized)) {
        return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
    }
    // IZOLAČNÍ VRSTVY = insulation layers, no structural formwork
    if (/izolacn\s*vrst|izolační\s*vrst/.test(normalized)) {
        return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
    }
    // ZÁLIVKA SPÁR = joint grouting, no formwork
    if (/zalivk\s*spar|zálivk\s*spár|zalivkov|zálivkov/.test(normalized)) {
        return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
    }
    // MONOLITICKÁ VOZOVKA = road surface, not structural element
    if (/monolitick\S*\s*vozovk|betonov\S*\s*vozovk|betonový\s*kryt/.test(normalized)) {
        return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
    }
    // ─── OTSKP catalog match (confidence=1.0, highest priority) ───
    for (const rule of OTSKP_RULES) {
        if (rule.pattern.test(normalized)) {
            const catalog = ELEMENT_CATALOG[rule.element_type];
            const meta = extractOtskpMetadata(name);
            return {
                element_type: rule.element_type,
                confidence: 1.0,
                ...catalog,
                classification_source: 'otskp',
                concrete_class_detected: meta.concrete_class,
                is_prestressed_detected: meta.is_prestressed,
                is_prefab: meta.is_prefab || rule.metadata?.is_prefab,
                has_kridla_detected: rule.metadata?.has_kridla,
                bridge_deck_subtype_detected: rule.metadata?.bridge_deck_subtype,
            };
        }
    }
    // ─── Keyword scoring (fallback) ───
    let bestType = 'other';
    let bestScore = 0;
    let bestPriority = 0;
    for (const rule of KEYWORD_RULES) {
        let matchCount = 0;
        for (const kw of rule.keywords) {
            if (normalized.includes(normalize(kw))) {
                matchCount++;
            }
        }
        // Křídla: suppress when name contains both "opěr" and "křídl" (composite item = opěra)
        if (rule.element_type === 'kridla_opery' && matchCount > 0) {
            const hasOpera = /oper|opěr/.test(normalized);
            const isComposite = hasOpera && /kridl|křídl/.test(normalized);
            if (isComposite)
                matchCount = 0; // Let opery_ulozne_prahy handle it
        }
        if (matchCount > 0) {
            // Bridge context: boost bridge element types by +5 priority
            const contextBoost = isBridge && BRIDGE_ELEMENT_TYPES.has(rule.element_type) ? 5 : 0;
            const score = matchCount * 10 + rule.priority + contextBoost;
            if (score > bestScore || (score === bestScore && (rule.priority + contextBoost) > bestPriority)) {
                bestScore = score;
                bestType = rule.element_type;
                bestPriority = rule.priority + contextBoost;
            }
        }
    }
    // Bridge context: remap building types to bridge equivalents
    if (isBridge && BRIDGE_EQUIVALENT[bestType]) {
        bestType = BRIDGE_EQUIVALENT[bestType];
    }
    const confidence = bestType === 'other' ? 0.3 : Math.min(1.0, 0.6 + bestScore * 0.04);
    const catalog = ELEMENT_CATALOG[bestType];
    const meta = extractOtskpMetadata(name);
    return {
        element_type: bestType,
        confidence,
        ...catalog,
        classification_source: 'keywords',
        ...(meta.concrete_class ? { concrete_class_detected: meta.concrete_class } : {}),
        ...(meta.is_prestressed !== undefined ? { is_prestressed_detected: meta.is_prestressed } : {}),
    };
}
/**
 * Get element profile by known type (no classification needed).
 */
export function getElementProfile(type) {
    const catalog = ELEMENT_CATALOG[type];
    return {
        element_type: type,
        confidence: 1.0,
        ...catalog,
    };
}
/**
 * Get recommended FormworkSystemSpec for an element type.
 *
 * When height_m is provided, applies pressure-based filtering:
 *   1. Calculate lateral pressure from height and pour method
 *   2. Get category-compatible systems (from getSuitableSystemsForElement)
 *   3. Filter by pressure capacity
 *   4. Return cheapest suitable system
 *
 * Without height_m, falls back to static recommendation (backward compatible).
 *
 * @param type - Element type
 * @param height_m - Element/pour height (m). Enables pressure-based selection.
 * @param pour_method - Concrete delivery method. Auto-inferred if not given.
 */
export function recommendFormwork(type, height_m, pour_method, total_length_m, concrete_consistency) {
    const profile = ELEMENT_CATALOG[type];
    // Rimsa: select formwork based on bridge length (konzoly vs. vozík)
    if (type === 'rimsa') {
        let systemName;
        if (total_length_m && total_length_m > 150) {
            systemName = 'Římsový vozík TU'; // long bridges → travelling carriage
        }
        else {
            systemName = 'Římsové bednění T'; // short bridges → bracket formwork
        }
        return FORMWORK_SYSTEMS.find(s => s.name === systemName)
            ?? FORMWORK_SYSTEMS.find(s => s.name === 'Římsové bednění T')
            ?? FORMWORK_SYSTEMS[0];
    }
    // Mostovka: prefer support towers for heights > 5m
    if (type === 'mostovkova_deska' && height_m != null && height_m > 5) {
        const systemName = 'Staxo 100';
        return FORMWORK_SYSTEMS.find(s => s.name === systemName)
            ?? FORMWORK_SYSTEMS.find(s => s.name === 'UP Rosett Flex')
            ?? FORMWORK_SYSTEMS.find(s => s.name === profile.recommended_formwork[0])
            ?? FORMWORK_SYSTEMS[0];
    }
    // Pilota: bored pile — uses pažnice (casing) or tremie pipe, not panel formwork.
    // Skip pressure-based filtering entirely.
    if (type === 'pilota') {
        const systemName = profile.recommended_formwork[0];
        return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
    }
    // No height → static recommendation (original behavior)
    if (height_m == null || height_m <= 0) {
        const systemName = profile.recommended_formwork[0];
        return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
    }
    // Horizontal elements: lateral pressure is irrelevant (concrete sits ON formwork).
    // Select by category compatibility and rental price — no pressure filtering needed.
    if (profile.orientation === 'horizontal') {
        const { all: compatibleSystems } = getSuitableSystemsForElement(type);
        if (compatibleSystems.length > 0) {
            // Sort: cheapest rental first, 0-price (tradiční) last
            const sorted = [...compatibleSystems].sort((a, b) => {
                if (a.rental_czk_m2_month === 0 && b.rental_czk_m2_month > 0)
                    return 1;
                if (b.rental_czk_m2_month === 0 && a.rental_czk_m2_month > 0)
                    return -1;
                return a.rental_czk_m2_month - b.rental_czk_m2_month;
            });
            return sorted[0];
        }
        const systemName = profile.recommended_formwork[0];
        return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
    }
    // Vertical elements: use lateral pressure (DIN 18218) to filter formwork systems.
    const method = pour_method ?? inferPourMethod(profile.pump_typical, height_m);
    // BUG-1: default concrete consistency = 'standard' (k=0.85), not method-based.
    const consistency = concrete_consistency ?? 'standard';
    const pressure = calculateLateralPressure(height_m, method, { concrete_consistency: consistency });
    // Get category-compatible systems
    const { all: compatibleSystems } = getSuitableSystemsForElement(type);
    // Filter by pressure AND max pour height
    const filtered = filterFormworkByPressure(pressure.pressure_kn_m2, compatibleSystems, profile.orientation, height_m);
    if (filtered.suitable.length > 0) {
        return filtered.suitable[0]; // Cheapest suitable
    }
    // Fallback: static recommendation (should rarely happen — tradiční is always available)
    const systemName = profile.recommended_formwork[0];
    return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
}
/**
 * Get pressure-filtered formwork systems for an element type.
 * Returns the full filter result (suitable, rejected, pressure).
 * Used by orchestrator for warnings and UI display.
 */
export function getFilteredFormworkSystems(type, height_m, pour_method, concrete_consistency) {
    const profile = ELEMENT_CATALOG[type];
    const method = pour_method ?? inferPourMethod(profile.pump_typical, height_m);
    const consistency = concrete_consistency ?? 'standard';
    const pressure = calculateLateralPressure(height_m, method, { concrete_consistency: consistency });
    const { all: compatibleSystems } = getSuitableSystemsForElement(type);
    const filtered = filterFormworkByPressure(pressure.pressure_kn_m2, compatibleSystems, profile.orientation, height_m);
    return {
        ...filtered,
        pour_method: method,
        pressure_formula: pressure.formula,
    };
}
/**
 * Get adjusted assembly norm for element + formwork system combination.
 *
 * adjusted_norm = base_norm × difficulty_factor
 */
export function getAdjustedAssemblyNorm(elementType, formworkSystem) {
    const profile = ELEMENT_CATALOG[elementType];
    const df = profile.difficulty_factor;
    return {
        assembly_h_m2: roundTo(formworkSystem.assembly_h_m2 * df, 3),
        disassembly_h_m2: roundTo(formworkSystem.disassembly_h_m2 * df, 3),
        difficulty_factor: df,
    };
}
/**
 * Estimate rebar mass from element type and concrete volume.
 * Uses typical reinforcement ratios per element type.
 */
/**
 * Element-to-category mapping: which formwork categories are suitable for each orientation.
 * Wall systems fit vertical elements, slab systems fit horizontal, etc.
 */
const ELEMENT_SUITABLE_CATEGORIES = {
    vertical: new Set(['wall', 'universal']),
    horizontal: new Set(['slab', 'universal']),
};
/**
 * Get formwork systems suitable for a given element type.
 * Combines: (1) explicitly recommended systems + (2) all systems of compatible category.
 * Returns { recommended, compatible, all } with deduplication.
 */
export function getSuitableSystemsForElement(elementType) {
    const profile = ELEMENT_CATALOG[elementType];
    const orientation = profile.orientation;
    const suitableCategories = ELEMENT_SUITABLE_CATEGORIES[orientation] ?? new Set(['wall', 'universal']);
    // Column elements also accept column-category systems
    if (['sloup', 'driky_piliru'].includes(elementType)) {
        suitableCategories.add('column');
    }
    // Tanks/basins accept special (RUNDFLEX)
    if (elementType === 'nadrz') {
        suitableCategories.add('special');
    }
    const recommendedNames = new Set(profile.recommended_formwork);
    const recommended = [];
    const compatible = [];
    for (const sys of FORMWORK_SYSTEMS) {
        if (sys.unit === 'bm')
            continue; // skip linear-meter systems
        const cat = sys.formwork_category ?? 'wall';
        if (cat === 'support_tower')
            continue; // support towers handled by props calculator, not formwork comparison
        const isSuitable = suitableCategories.has(cat);
        const isRecommended = recommendedNames.has(sys.name);
        if (isRecommended && isSuitable) {
            recommended.push(sys);
        }
        else if (isSuitable) {
            compatible.push(sys);
        }
    }
    return {
        recommended,
        compatible,
        all: [...recommended, ...compatible],
    };
}
/**
 * Minimum inputs the planner needs to compute a useful result.
 * Shared between wizard hints (HINT-1) and validation.
 */
export const REQUIRED_FIELDS = {
    zaklady_piliru: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry a náklady' },
        { field: 'height_m', label_cs: 'Výška základu', severity: 'optional', reason_cs: 'ovlivňuje boční tlak a volbu bednění' },
    ],
    driky_piliru: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Výška pilíře', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak a záběry' },
        { field: 'formwork_area_m2', label_cs: 'Plocha bednění', severity: 'optional', reason_cs: 'prázdné = dopočítám z objemu a výšky' },
    ],
    rimsa: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'total_length_m', label_cs: 'Délka mostu', severity: 'optional', reason_cs: 'určuje systém (konzoly vs. vozík)' },
    ],
    operne_zdi: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Výška zdi', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
        { field: 'total_length_m', label_cs: 'Délka zdi', severity: 'optional', reason_cs: 'ovlivňuje sekce a šachovnici' },
    ],
    mostovkova_deska: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat náklady' },
        // Task 3 (2026-04): height_m is REQUIRED for needs_supports=true elements.
        // calculateProps in the orchestrator gates on input.height_m, so without
        // it the entire skruž / stojky pricing pipeline is skipped silently.
        { field: 'height_m', label_cs: 'Výška nad terénem', severity: 'critical', reason_cs: 'nutná pro výpočet podpěr/skruže (stropní bednění visí na stojkách)' },
        { field: 'formwork_area_m2', label_cs: 'Plocha bednění', severity: 'optional', reason_cs: 'prázdné = dopočítám z objemu' },
        { field: 'span_m', label_cs: 'Rozpětí', severity: 'optional', reason_cs: 'rozhoduje o technologii (MSS/CFT)' },
        { field: 'num_spans', label_cs: 'Počet polí', severity: 'optional', reason_cs: 'pro MSS harmonogram' },
    ],
    rigel: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Výška pod příčníkem', severity: 'critical', reason_cs: 'nutné pro podpěrnou konstrukci' },
    ],
    opery_ulozne_prahy: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Výška opěry', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
    ],
    kridla_opery: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Výška křídla', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
    ],
    mostni_zavirne_zidky: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    ],
    prechodova_deska: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    ],
    zakladova_deska: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'formwork_area_m2', label_cs: 'Plocha desky', severity: 'optional', reason_cs: 'pro podpěry a pronájem bednění' },
    ],
    zakladovy_pas: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'total_length_m', label_cs: 'Délka pásu', severity: 'optional', reason_cs: 'pro sekcování' },
    ],
    zakladova_patka: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    ],
    stropni_deska: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'formwork_area_m2', label_cs: 'Plocha stropu', severity: 'optional', reason_cs: 'prázdné = dopočítám z objemu' },
        { field: 'height_m', label_cs: 'Světlá výška', severity: 'critical', reason_cs: 'pro výpočet stojek a skruže' },
    ],
    stena: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Výška stěny', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak a záběry' },
    ],
    sloup: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Výška sloupu', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
    ],
    pruvlak: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Světlá výška', severity: 'critical', reason_cs: 'pro skruž a stojky' },
    ],
    schodiste: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Výška podlaží', severity: 'critical', reason_cs: 'pro skruž' },
    ],
    nadrz: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
        { field: 'height_m', label_cs: 'Výška stěn', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
    ],
    podzemni_stena: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat panely' },
    ],
    pilota: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    ],
    other: [
        { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat náklady' },
    ],
};
export const SANITY_RANGES = {
    zaklady_piliru: { volume_m3: [10, 800], height_m: [0.8, 3.0], rebar_kg_m3: [60, 150] },
    driky_piliru: { volume_m3: [5, 400], height_m: [3.0, 30.0], rebar_kg_m3: [80, 220] },
    rimsa: { volume_m3: [2, 200], height_m: [0.3, 0.8], rebar_kg_m3: [80, 180] },
    operne_zdi: { volume_m3: [10, 500], height_m: [2.0, 12.0], rebar_kg_m3: [50, 130] },
    mostovkova_deska: { volume_m3: [20, 2000], height_m: [0.3, 2.5], rebar_kg_m3: [100, 200] },
    rigel: { volume_m3: [3, 150], height_m: [0.6, 3.0], rebar_kg_m3: [100, 200] },
    opery_ulozne_prahy: { volume_m3: [10, 500], height_m: [2.0, 15.0], rebar_kg_m3: [70, 160] },
    kridla_opery: { volume_m3: [5, 200], height_m: [2.0, 10.0], rebar_kg_m3: [60, 140] },
    mostni_zavirne_zidky: { volume_m3: [1, 20], height_m: [0.5, 2.0], rebar_kg_m3: [50, 120] },
    prechodova_deska: { volume_m3: [5, 80], height_m: [0.2, 0.5], rebar_kg_m3: [70, 140] },
    zakladova_deska: { volume_m3: [10, 2000], height_m: [0.3, 2.0], rebar_kg_m3: [80, 160] },
    zakladovy_pas: { volume_m3: [5, 500], height_m: [0.4, 1.5], rebar_kg_m3: [50, 120] },
    zakladova_patka: { volume_m3: [2, 50], height_m: [0.5, 2.0], rebar_kg_m3: [60, 140] },
    stropni_deska: { volume_m3: [5, 1000], height_m: [0.12, 0.40], rebar_kg_m3: [60, 150] },
    stena: { volume_m3: [5, 500], height_m: [2.5, 12.0], rebar_kg_m3: [50, 130] },
    sloup: { volume_m3: [1, 80], height_m: [2.5, 20.0], rebar_kg_m3: [120, 240] },
    pruvlak: { volume_m3: [1, 60], height_m: [0.4, 2.0], rebar_kg_m3: [100, 200] },
    schodiste: { volume_m3: [1, 30], height_m: [2.5, 5.0], rebar_kg_m3: [100, 180] },
    nadrz: { volume_m3: [10, 800], height_m: [2.0, 8.0], rebar_kg_m3: [70, 160] },
    podzemni_stena: { volume_m3: [20, 2000], height_m: [5.0, 40.0], rebar_kg_m3: [50, 140] },
    pilota: { volume_m3: [1, 200], height_m: [5.0, 40.0], rebar_kg_m3: [40, 120] },
    other: { volume_m3: [0.5, 5000] },
};
/**
 * Check a set of user-provided numeric inputs against SANITY_RANGES and
 * return any that are out of the typical range (possibly a typo).
 */
export function checkSanity(elementType, values) {
    const ranges = SANITY_RANGES[elementType];
    if (!ranges)
        return [];
    const issues = [];
    const labels = {
        volume_m3: 'Objem',
        height_m: 'Výška',
        rebar_kg_m3: 'Výztuž',
        formwork_area_m2: 'Plocha bednění',
    };
    for (const key of Object.keys(ranges)) {
        const range = ranges[key];
        if (!range)
            continue;
        const value = values[key];
        if (value == null || !Number.isFinite(value))
            continue;
        const [min, max] = range;
        if (value < min || value > max) {
            issues.push({
                field: key,
                value,
                min, max,
                label_cs: labels[key],
                message_cs: `${labels[key]} ${value} je mimo typický rozsah (${min}–${max}) pro ${ELEMENT_CATALOG[elementType].label_cs}.`,
            });
        }
    }
    return issues;
}
export function estimateRebarMass(elementType, volume_m3) {
    const profile = ELEMENT_CATALOG[elementType];
    return {
        estimated_kg: roundTo(volume_m3 * profile.rebar_ratio_kg_m3, 1),
        min_kg: roundTo(volume_m3 * profile.rebar_ratio_range[0], 1),
        max_kg: roundTo(volume_m3 * profile.rebar_ratio_range[1], 1),
        ratio_kg_m3: profile.rebar_ratio_kg_m3,
    };
}
/**
 * Get all element types with their Czech labels.
 */
export function getAllElementTypes() {
    return Object.entries(ELEMENT_CATALOG).map(([type, profile]) => ({ type, label_cs: profile.label_cs }));
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function roundTo(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
