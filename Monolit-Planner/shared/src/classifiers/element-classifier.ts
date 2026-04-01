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

import type { StructuralElementType } from '../calculators/pour-decision.js';
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';
import { FORMWORK_SYSTEMS } from '../constants-data/formwork-systems.js';
import type { PourMethod, FormworkFilterResult } from '../calculators/lateral-pressure.js';
import { calculateLateralPressure, filterFormworkByPressure, inferPourMethod } from '../calculators/lateral-pressure.js';

// ─── Element Profile ─────────────────────────────────────────────────────────

export interface ElementProfile {
  /** Classified element type */
  element_type: StructuralElementType;
  /** Czech label */
  label_cs: string;
  /** Confidence of classification (0–1) */
  confidence: number;

  // --- Formwork ---
  /** Recommended formwork systems (best first) */
  recommended_formwork: string[];
  /** Assembly difficulty factor (1.0 = standard, <1 easier, >1 harder) */
  difficulty_factor: number;
  /** Whether support structures needed (podpěry, stojky, věže) */
  needs_supports: boolean;
  /** Whether working platforms needed (pracovní plošiny) */
  needs_platforms: boolean;
  /** Whether crane required for formwork operations */
  needs_crane: boolean;

  // --- Rebar ---
  /** Typical reinforcement ratio kg/m³ (midpoint) */
  rebar_ratio_kg_m3: number;
  /** Min–max rebar ratio range */
  rebar_ratio_range: [number, number];
  /** Rebar labor norm (h/t) — element-specific */
  rebar_norm_h_per_t: number;

  // --- Curing ---
  /** Required strip strength as % of f_ck */
  strip_strength_pct: number;
  /** Element orientation for curing model: vertical strips faster */
  orientation: 'horizontal' | 'vertical';

  // --- Pour ---
  /** Typical pour rate constraint (m³/h) — element-specific limit */
  max_pour_rate_m3_h: number;
  /** Whether pump is typically needed */
  pump_typical: boolean;
}

// ─── Element Catalog ─────────────────────────────────────────────────────────

const ELEMENT_CATALOG: Record<StructuralElementType, Omit<ElementProfile, 'element_type' | 'confidence'>> = {
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
    recommended_formwork: ['Římsové bednění T', 'Tradiční tesařské'],
    difficulty_factor: 1.15,
    needs_supports: true,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 120,
    rebar_ratio_range: [100, 150],
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
    recommended_formwork: ['MULTIFLEX', 'Top 50', 'SKYDECK', 'Dokaflex'],
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
    label_cs: 'Opěry, úložné prahy, křídla',
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
    needs_supports: true,   // stojky / podpěry
    needs_platforms: false,
    needs_crane: true,
    rebar_ratio_kg_m3: 120,
    rebar_ratio_range: [80, 160],
    rebar_norm_h_per_t: 45,
    strip_strength_pct: 70,  // horizontal — higher strip strength
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
    needs_supports: true,   // skruž / podpěry
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 140,
    rebar_ratio_range: [100, 180],
    rebar_norm_h_per_t: 55,
    strip_strength_pct: 70,  // horizontal
    orientation: 'horizontal',
    max_pour_rate_m3_h: 25,
    pump_typical: true,
  },
  schodiste: {
    label_cs: 'Schodiště',
    recommended_formwork: ['Tradiční tesařské', 'Dokaflex'],
    difficulty_factor: 1.3,   // complex formwork (sloped + steps)
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
    recommended_formwork: ['Tradiční tesařské'],  // usually no traditional formwork — guide walls + bentonite
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
    recommended_formwork: ['Tradiční tesařské'],  // no formwork — bored pile
    difficulty_factor: 0.7,   // no formwork work
    needs_supports: false,
    needs_platforms: false,
    needs_crane: true,
    rebar_ratio_kg_m3: 60,
    rebar_ratio_range: [40, 100],
    rebar_norm_h_per_t: 30,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 30,
    pump_typical: false,   // tremie pipe, not pump
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

// ─── Keyword-based classification ────────────────────────────────────────────

interface KeywordRule {
  element_type: StructuralElementType;
  keywords: string[];
  /** Higher priority wins when multiple rules match */
  priority: number;
}

const KEYWORD_RULES: KeywordRule[] = [
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
  { element_type: 'opery_ulozne_prahy', keywords: [
    'opera', 'opěra', 'opery', 'opěry',
    'ulozn', 'úložn', 'ulozne prah', 'úložné prah',
    'prah', 'sedlo',
    'mostni oper', 'mostní opěr', 'mostni opery', 'mostní opěry',
    'kridl', 'křídl', 'kridla', 'křídla',
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
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─── Main API ────────────────────────────────────────────────────────────────

/** Bridge element types — get priority boost in bridge context */
const BRIDGE_ELEMENT_TYPES = new Set<StructuralElementType>([
  'zaklady_piliru', 'driky_piliru', 'rimsa', 'operne_zdi',
  'mostovkova_deska', 'rigel', 'opery_ulozne_prahy', 'mostni_zavirne_zidky',
  'prechodova_deska',
]);

/** Building element types that have bridge equivalents */
const BRIDGE_EQUIVALENT: Partial<Record<StructuralElementType, StructuralElementType>> = {
  sloup: 'driky_piliru',              // "pilíř" in bridge context = dříky pilířů, not sloup
  zakladova_deska: 'zaklady_piliru',  // "základy" in bridge context = základy pilířů
  zakladovy_pas: 'zaklady_piliru',
  zakladova_patka: 'zaklady_piliru',  // "patky" in bridge context = základy pilířů
  stropni_deska: 'mostovkova_deska',  // "deska" in bridge context = mostovková deska
  pruvlak: 'rigel',                   // "trám/nosník" in bridge context = příčník
  stena: 'operne_zdi',                // "stěna" in bridge context = opěrná zeď
};

/** Classification context — optional hints to improve accuracy */
export interface ClassificationContext {
  /** Is this element part of a bridge/mostní objekt? (SO-xxx prefix, bridge_id present) */
  is_bridge?: boolean;
}

/**
 * Classify a construction element by name/description.
 *
 * @param name - Part name or description (Czech), e.g. "ZÁKLADY PILÍŘŮ", "Mostovková deska"
 * @param context - Optional context (is_bridge) to resolve ambiguities like pilíř vs sloup
 * @returns ElementProfile with all defaults and recommendations
 */
export function classifyElement(name: string, context?: ClassificationContext): ElementProfile {
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

  // Score each rule
  let bestType: StructuralElementType = 'other';
  let bestScore = 0;
  let bestPriority = 0;

  for (const rule of KEYWORD_RULES) {
    let matchCount = 0;
    for (const kw of rule.keywords) {
      if (normalized.includes(normalize(kw))) {
        matchCount++;
      }
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
    bestType = BRIDGE_EQUIVALENT[bestType]!;
  }

  const confidence = bestType === 'other' ? 0.3 : Math.min(1.0, 0.6 + bestScore * 0.04);
  const catalog = ELEMENT_CATALOG[bestType];

  return {
    element_type: bestType,
    confidence,
    ...catalog,
  };
}

/**
 * Get element profile by known type (no classification needed).
 */
export function getElementProfile(type: StructuralElementType): ElementProfile {
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
export function recommendFormwork(
  type: StructuralElementType,
  height_m?: number,
  pour_method?: PourMethod,
): FormworkSystemSpec {
  const profile = ELEMENT_CATALOG[type];

  // No height → static recommendation (original behavior)
  if (height_m == null || height_m <= 0) {
    const systemName = profile.recommended_formwork[0];
    return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
  }

  // Infer pour method if not given
  const method = pour_method ?? inferPourMethod(profile.pump_typical, height_m);

  // Calculate lateral pressure
  const pressure = calculateLateralPressure(height_m, method);

  // Get category-compatible systems
  const { all: compatibleSystems } = getSuitableSystemsForElement(type);

  // Filter by pressure
  const filtered = filterFormworkByPressure(
    pressure.pressure_kn_m2,
    compatibleSystems,
    profile.orientation,
  );

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
export function getFilteredFormworkSystems(
  type: StructuralElementType,
  height_m: number,
  pour_method?: PourMethod,
): FormworkFilterResult & { pour_method: PourMethod; pressure_formula: string } {
  const profile = ELEMENT_CATALOG[type];
  const method = pour_method ?? inferPourMethod(profile.pump_typical, height_m);
  const pressure = calculateLateralPressure(height_m, method);
  const { all: compatibleSystems } = getSuitableSystemsForElement(type);
  const filtered = filterFormworkByPressure(
    pressure.pressure_kn_m2,
    compatibleSystems,
    profile.orientation,
  );
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
export function getAdjustedAssemblyNorm(
  elementType: StructuralElementType,
  formworkSystem: FormworkSystemSpec
): { assembly_h_m2: number; disassembly_h_m2: number; difficulty_factor: number } {
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
const ELEMENT_SUITABLE_CATEGORIES: Record<string, Set<string>> = {
  vertical: new Set(['wall', 'universal']),
  horizontal: new Set(['slab', 'universal']),
};

/**
 * Get formwork systems suitable for a given element type.
 * Combines: (1) explicitly recommended systems + (2) all systems of compatible category.
 * Returns { recommended, compatible, all } with deduplication.
 */
export function getSuitableSystemsForElement(elementType: StructuralElementType): {
  recommended: FormworkSystemSpec[];
  compatible: FormworkSystemSpec[];
  all: FormworkSystemSpec[];
} {
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

  const recommended: FormworkSystemSpec[] = [];
  const compatible: FormworkSystemSpec[] = [];

  for (const sys of FORMWORK_SYSTEMS) {
    if (sys.unit === 'bm') continue; // skip linear-meter systems
    const cat = sys.formwork_category ?? 'wall';
    const isSuitable = suitableCategories.has(cat);
    const isRecommended = recommendedNames.has(sys.name);

    if (isRecommended) {
      recommended.push(sys);
    } else if (isSuitable) {
      compatible.push(sys);
    }
  }

  return {
    recommended,
    compatible,
    all: [...recommended, ...compatible],
  };
}

export function estimateRebarMass(
  elementType: StructuralElementType,
  volume_m3: number
): { estimated_kg: number; min_kg: number; max_kg: number; ratio_kg_m3: number } {
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
export function getAllElementTypes(): Array<{ type: StructuralElementType; label_cs: string }> {
  return (Object.entries(ELEMENT_CATALOG) as [StructuralElementType, typeof ELEMENT_CATALOG[StructuralElementType]][]).map(
    ([type, profile]) => ({ type, label_cs: profile.label_cs })
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
