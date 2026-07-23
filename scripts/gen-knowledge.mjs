#!/usr/bin/env node
/**
 * Knowledge codegen — reads kb/*.yaml, writes typed TS modules.
 *
 * Source of truth: kb/<name>.yaml
 * Output: Monolit-Planner/shared/src/kb-generated/<name>.ts (default), or a
 *         per-integration `outAbs` dir (Zeleznice-Planner shared) — each
 *         output dir gets its own index.ts over ITS integrations only.
 *
 * Usage:
 *   node scripts/gen-knowledge.mjs            # generate all
 *   node scripts/gen-knowledge.mjs --check    # CI drift check (non-zero on stale)
 *   node scripts/gen-knowledge.mjs --help
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const KB_DIR = resolve(REPO_ROOT, 'kb');
const OUT_DIR = resolve(REPO_ROOT, 'Monolit-Planner/shared/src/kb-generated');
const ZELEZNICE_OUT_DIR = resolve(REPO_ROOT, 'Zeleznice-Planner/shared/src/kb-generated');

// ─── CLI args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isCheck = args.includes('--check');
const isHelp = args.includes('--help') || args.includes('-h');

if (isHelp) {
  console.log(`Usage:
  node scripts/gen-knowledge.mjs            Generate all kb-generated/*.ts
  node scripts/gen-knowledge.mjs --check    Re-generate, fail if any file changed
  node scripts/gen-knowledge.mjs --help     This help`);
  process.exit(0);
}

// ─── js-yaml loader (lazy require so --help works without dep) ────────────

let yaml;
try {
  yaml = require('js-yaml');
} catch (err) {
  console.error(`✖ Missing dependency 'js-yaml'. Run: npm install --save-dev js-yaml`);
  process.exit(2);
}

// ─── Registry: source-yaml → loader + renderer ────────────────────────────

const INTEGRATIONS = [
  {
    name: 'tkp18-maturity',
    yaml: 'tkp18_maturity.yaml',
    validate: validateTkp18Maturity,
    render: renderTkp18Maturity,
  },
  {
    name: 'urs-otskp-routing',
    yaml: 'urs_otskp_routing.yaml',
    validate: validateUrsOtskpRouting,
    render: renderUrsOtskpRouting,
  },
  {
    name: 'doka-frami-catalog',
    yaml: 'doka_frami_catalog.yaml',
    validate: validateDokaFramiCatalog,
    render: renderDokaFramiCatalog,
  },
  {
    // Non-DOKA vendor formwork (PERI / ULMA / NOE / Místní). Sibling of the
    // DOKA catalog; the two are disjoint and composed in formwork-systems.ts.
    name: 'formwork-catalog-non-doka',
    yaml: 'formwork_catalog_non_doka.yaml',
    validate: validateNonDokaFormworkCatalog,
    render: renderNonDokaFormworkCatalog,
  },
  {
    name: 'lateral-pressure-formulas',
    yaml: 'lateral_pressure.yaml',
    validate: validateLateralPressure,
    render: renderLateralPressure,
  },
  {
    name: 'ucebnice-mostu-pour',
    yaml: 'ucebnice_mostu_pour.yaml',
    validate: validateUcebniceMostuPour,
    render: renderUcebniceMostuPour,
  },
  {
    // TASK_2b — element-classification rule-DATA. Source lives in the
    // concrete-agent KB (so the W3 Python classifier reads it natively inside
    // the concrete-agent Docker image); the TS engine imports this generated
    // artifact. `yamlAbs` overrides the default kb/ source dir for this one
    // integration. The head-noun ALGORITHM is code, never in this data.
    name: 'element-classification-rules',
    yamlAbs: resolve(
      REPO_ROOT,
      'concrete-agent/packages/core-backend/app/classifiers/element_rules/element_types.yaml',
    ),
    sourceLabel: 'concrete-agent/packages/core-backend/app/classifiers/element_rules/element_types.yaml',
    validate: validateElementClassification,
    render: renderElementClassification,
  },
  {
    // ADR-008 (half-B Gate 2) — tz-bridge-passport element-key map. One axis,
    // three consumers: TS half-A mapper (this generated artifact), Python
    // half-B assembler (reads the YAML natively), future frontend manifest.
    name: 'bridge-passport-element-map',
    yamlAbs: resolve(
      REPO_ROOT,
      'concrete-agent/packages/core-backend/app/classifiers/element_rules/passport_element_map.yaml',
    ),
    sourceLabel: 'concrete-agent/packages/core-backend/app/classifiers/element_rules/passport_element_map.yaml',
    validate: validateBridgePassportElementMap,
    render: renderBridgePassportElementMap,
  },
  {
    // Zeleznice-Planner kiosk — railway superstructure single-source data
    // (rail profiles, sleepers, fastenings, sestavy, rozdělení pražců,
    // ballast profiles, BK params). `outAbs` routes the artifact into the
    // railway kiosk's shared package; the Monolit kb-generated/ dir and its
    // index stay byte-identical.
    name: 'zeleznice-svrsek',
    yaml: 'zeleznicni_svrsek.yaml',
    outAbs: ZELEZNICE_OUT_DIR,
    validate: validateZelezniceSvrsek,
    render: renderZelezniceSvrsek,
  },
  {
    name: 'zeleznice-vyhybky',
    yaml: 'zeleznicni_vyhybky.yaml',
    outAbs: ZELEZNICE_OUT_DIR,
    validate: validateZelezniceVyhybky,
    render: renderZelezniceVyhybky,
  },
  {
    name: 'zeleznice-mechanizace',
    yaml: 'zeleznicni_mechanizace.yaml',
    outAbs: ZELEZNICE_OUT_DIR,
    validate: validateZelezniceMechanizace,
    render: renderZelezniceMechanizace,
  },
];

// ─── Index re-export ──────────────────────────────────────────────────────

function renderIndex(integrations) {
  // Namespace each module re-export to avoid SOURCE_CITATION name collision
  // across integrations. Consumers can either `import { TKP18_MATURITY }`
  // or `import { CURING_DAYS_TABLE } from '../kb-generated/tkp18-maturity.js'`.
  // One index per OUTPUT DIR — each dir re-exports only its own modules.
  const lines = integrations.map(i => {
    const ns = i.name.replace(/-/g, '_').toUpperCase();
    return `export * as ${ns} from './${i.name}.js';`;
  });
  return banner('index.ts (namespaced re-exports)', null) + lines.join('\n') + '\n';
}

// ─── Validators ───────────────────────────────────────────────────────────

function validateTkp18Maturity(data) {
  if (!data.curing_days_table || !Array.isArray(data.curing_days_table)) {
    throw new Error('curing_days_table must be an array');
  }
  for (const row of data.curing_days_table) {
    if (typeof row.temp_min !== 'number' || typeof row.temp_max !== 'number') {
      throw new Error('curing_days_table rows need numeric temp_min, temp_max');
    }
    if (!row.days || typeof row.days !== 'object') {
      throw new Error('curing_days_table rows need a days object');
    }
  }
  if (!data.exposure_min_curing_days || typeof data.exposure_min_curing_days !== 'object') {
    throw new Error('exposure_min_curing_days must be an object');
  }
  if (typeof data.tkp18_absolute_min_days !== 'number') {
    throw new Error('tkp18_absolute_min_days must be a number');
  }
}

function validateUrsOtskpRouting(data) {
  if (!data.routing || typeof data.routing !== 'object') {
    throw new Error('routing must be an object keyed by project_type');
  }
  const validTypes = ['verejna', 'privatni', 'design_build'];
  for (const t of validTypes) {
    if (!data.routing[t]) throw new Error(`routing.${t} required`);
    const r = data.routing[t];
    if (!Array.isArray(r.catalog_priority) || r.catalog_priority.length === 0) {
      throw new Error(`routing.${t}.catalog_priority must be non-empty array`);
    }
  }
}

function validateDokaFramiCatalog(data) {
  if (!Array.isArray(data.systems) || data.systems.length === 0) {
    throw new Error('systems must be a non-empty array');
  }
  for (const s of data.systems) {
    if (!s.name || !s.manufacturer) {
      throw new Error(`system missing name or manufacturer: ${JSON.stringify(s)}`);
    }
    if (typeof s.assembly_h_m2 !== 'number') {
      throw new Error(`system ${s.name}: assembly_h_m2 must be a number`);
    }
  }
}

function validateNonDokaFormworkCatalog(data) {
  if (!Array.isArray(data.systems) || data.systems.length === 0) {
    throw new Error('systems must be a non-empty array');
  }
  for (const s of data.systems) {
    if (!s.name || !s.manufacturer) {
      throw new Error(`system missing name or manufacturer: ${JSON.stringify(s)}`);
    }
    if (typeof s.assembly_h_m2 !== 'number') {
      throw new Error(`system ${s.name}: assembly_h_m2 must be a number`);
    }
    // Partition guard: DOKA systems live in doka_frami_catalog.yaml only.
    // Keeping the two catalogs disjoint prevents duplicate/drifting entries.
    if (s.manufacturer === 'DOKA') {
      throw new Error(`system ${s.name}: DOKA entries belong in doka_frami_catalog.yaml, not the non-DOKA catalog`);
    }
  }
}

function validateLateralPressure(data) {
  if (!data.constants) throw new Error('constants section required');
  if (typeof data.constants.rho_kg_m3 !== 'number') throw new Error('constants.rho_kg_m3 required');
  if (typeof data.constants.g_m_s2 !== 'number') throw new Error('constants.g_m_s2 required');
  if (!data.k_factors_by_consistency || typeof data.k_factors_by_consistency !== 'object') {
    throw new Error('k_factors_by_consistency must be an object');
  }
  for (const k of ['standard', 'plastic', 'scc']) {
    if (typeof data.k_factors_by_consistency[k] !== 'number') {
      throw new Error(`k_factors_by_consistency.${k} must be a number`);
    }
  }
  if (!Array.isArray(data.pour_rate_to_k)) {
    throw new Error('pour_rate_to_k must be an array');
  }
}

function validateUcebniceMostuPour(data) {
  if (!data.pour_sequences || typeof data.pour_sequences !== 'object') {
    throw new Error('pour_sequences must be keyed by element_type');
  }
  for (const [key, seq] of Object.entries(data.pour_sequences)) {
    if (!seq.recommended_sequence || !Array.isArray(seq.recommended_sequence)) {
      throw new Error(`pour_sequences.${key}.recommended_sequence must be array`);
    }
  }
}

function validateElementClassification(data) {
  for (const key of ['version', 'type_core', 'w3_family', 'bridge_remap', 'object_type_aliases', 'dictionaries']) {
    if (!(key in data)) throw new Error(`element_types.yaml missing top-level key: ${key}`);
  }
  if (!data.dictionaries.cs || !data.dictionaries.cs.keywords) {
    throw new Error('element_types.yaml: dictionaries.cs.keywords is required');
  }
  // Every keyword type and every bridge_remap target must be a known concept.
  for (const t of Object.keys(data.dictionaries.cs.keywords)) {
    if (!(t in data.type_core)) {
      throw new Error(`dictionaries.cs.keywords.${t} is not declared in type_core`);
    }
  }
  for (const [from, to] of Object.entries(data.bridge_remap)) {
    if (!(from in data.type_core)) throw new Error(`bridge_remap source '${from}' not in type_core`);
    if (!(to in data.type_core)) throw new Error(`bridge_remap target '${to}' not in type_core`);
  }
  // Directed roll-up invariant: family(engineType) === w3_family[w3_name]. This
  // guarantees the engine-fine→W3-coarse equivalence never crosses a family.
  for (const [t, core] of Object.entries(data.type_core)) {
    if (!core.w3_name) throw new Error(`type_core.${t} missing w3_name`);
    if (!core.family) throw new Error(`type_core.${t} missing family`);
    const wf = data.w3_family[core.w3_name];
    if (wf === undefined) {
      throw new Error(`type_core.${t}.w3_name='${core.w3_name}' has no w3_family entry`);
    }
    if (wf !== core.family) {
      throw new Error(
        `family mismatch for ${t}: family='${core.family}' but w3_family['${core.w3_name}']='${wf}'`,
      );
    }
  }
}

// ─── Renderers ────────────────────────────────────────────────────────────

function banner(srcPath, integrationName) {
  const src = srcPath ? `\n * Source: kb/${srcPath}` : '';
  const regen = integrationName
    ? `\n * Regenerate: npm run gen:knowledge`
    : '\n * Regenerate: npm run gen:knowledge';
  return `/**
 * AUTO-GENERATED FILE — DO NOT EDIT.${src}${regen}
 */

`;
}

function jsonLit(v) {
  // YAML may give us BigInt-incompatible floats; JSON.stringify is fine.
  return JSON.stringify(v);
}

function renderTkp18Maturity(data) {
  return banner('tkp18_maturity.yaml') + `\
/** Per-row entry of CURING_DAYS_TABLE. */
export interface CuringDaysRow {
  temp_min: number;
  temp_max: number;
  description?: string;
  /** class group key → curing class key (as string) → days. */
  days: Record<string, Record<string, number>>;
}

/** ČSN EN 13670 Table NA.2 + TKP18 §7.8.3 — curing days by temp range × class group × curing class. */
export const CURING_DAYS_TABLE: CuringDaysRow[] = ${jsonLit(data.curing_days_table)};

/** TKP18 §7.8.3 hard minimums per exposure class (XF, XD, XS, XA series). */
export const EXPOSURE_MIN_CURING_DAYS: Record<string, number> = ${jsonLit(data.exposure_min_curing_days)};

/** TKP18 absolute minimum for PK (pozemní komunikace) bridge elements. */
export const TKP18_ABSOLUTE_MIN_DAYS = ${data.tkp18_absolute_min_days};

/** Cement type speed factor (relative to CEM I = 1.0). */
export const CEMENT_SPEED: Record<'CEM_I' | 'CEM_II' | 'CEM_III', number> = ${jsonLit(data.cement_speed)};

/** Datum temperature for Nurse-Saul maturity (°C). */
export const T_DATUM = ${data.t_datum};

/** Default curing class per element type per TKP18 §7.8.3 (2=foundations, 3=substructure, 4=superstructure). */
export const DEFAULT_CURING_CLASS_BY_ELEMENT: Record<string, 2 | 3 | 4> = ${jsonLit(data.default_curing_class_by_element)};

/** ZDS exception per §7.8.3.4 — default 5d, 7d pro XF3/XF4. */
export const ZDS_EXCEPTION = ${jsonLit(data.zds_exception)} as const;

/** Source citation for audit trail. */
export const SOURCE_CITATION = ${jsonLit(data.source_citation)} as const;
`;
}

function renderUrsOtskpRouting(data) {
  return banner('urs_otskp_routing.yaml') + `\
/** Catalog priority per project type (per soul.md memory rules). */
export type ProjectType = 'verejna' | 'privatni' | 'design_build';
export type CatalogName = 'OTSKP' | 'URS' | 'RTS' | 'own';

export interface RoutingEntry {
  catalog_priority: CatalogName[];
  notes: string;
  source_examples: string[];
}

export const URS_OTSKP_ROUTING: Record<ProjectType, RoutingEntry> = ${jsonLit(data.routing)};

/** Return ordered catalog priority for a given project type. */
export function getCatalogPriority(projectType: ProjectType): CatalogName[] {
  return URS_OTSKP_ROUTING[projectType]?.catalog_priority ?? ['URS'];
}

export const SOURCE_CITATION = ${jsonLit(data.source_citation)} as const;
`;
}

function renderDokaFramiCatalog(data) {
  return banner('doka_frami_catalog.yaml') + `\
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';

/**
 * DOKA formwork systems extracted from B3_current_prices/formwork_systems_doka.json.
 * Re-rendered into FormworkSystemSpec shape so engine consumers see the same type.
 *
 * NOTE: Some legacy entries in formwork-systems.ts pre-date this catalog and
 * include richer metadata (heights[], descriptions in Czech). The KB version is
 * the canonical source going forward; legacy hardcoded entries are merged on
 * top during initialization for fields the YAML doesn't carry yet.
 *
 * JSON literal cast — YAML string fields parse as wide string; FormworkSystemSpec
 * uses narrow union types (PourRole, FormworkSubtype, …). Cast is safe because
 * codegen validation guarantees only allowed values reach the file.
 */
export const KB_DOKA_FORMWORK_SYSTEMS = (${jsonLit(data.systems)} as unknown) as FormworkSystemSpec[];

export const SOURCE_CITATION = ${jsonLit(data.source_citation)} as const;
`;
}

function renderNonDokaFormworkCatalog(data) {
  return banner('formwork_catalog_non_doka.yaml') + `\
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';

/**
 * Non-DOKA formwork systems (PERI / ULMA / NOE / Místní). Sibling of
 * KB_DOKA_FORMWORK_SYSTEMS — composed AFTER it in formwork-systems.ts so that
 * FORMWORK_SYSTEMS = [...KB_DOKA_FORMWORK_SYSTEMS, ...KB_NON_DOKA_FORMWORK_SYSTEMS].
 * List order is preserved verbatim from the previous inline hardcode, so the
 * default system (FORMWORK_SYSTEMS[0]) and any order-dependent selection are
 * unchanged.
 *
 * JSON literal cast — YAML string fields parse as wide string; FormworkSystemSpec
 * uses narrow union types (PourRole, FormworkSubtype, …). Cast is safe because
 * codegen validation guarantees only allowed values reach the file.
 */
export const KB_NON_DOKA_FORMWORK_SYSTEMS = (${jsonLit(data.systems)} as unknown) as FormworkSystemSpec[];

export const SOURCE_CITATION = ${jsonLit(data.source_citation)} as const;
`;
}

function renderLateralPressure(data) {
  return banner('lateral_pressure.yaml') + `\
/** DIN 18218 / ČSN EN 12812 lateral pressure constants. */
export const LATERAL_PRESSURE_CONSTANTS = ${jsonLit(data.constants)} as const;

/** k-factor by concrete consistency (DIN 18218). */
export const K_FACTORS_BY_CONSISTENCY: Record<'standard' | 'plastic' | 'scc', number> = ${jsonLit(data.k_factors_by_consistency)};

/** Pour rate (m/h) → k coefficient bands (ČSN EN 12812). */
export interface PourRateBand {
  max_rate_m_h: number;
  k: number;
  description: string;
}
export const POUR_RATE_TO_K: PourRateBand[] = ${jsonLit(data.pour_rate_to_k)};

/** Reinforced concrete density (kg/m³). */
export const RHO_KG_M3 = ${data.constants.rho_kg_m3};
/** Gravitational acceleration (m/s²). */
export const G_M_S2 = ${data.constants.g_m_s2};

/** Return k-factor for a consistency name. */
export function getKFactorForConsistency(consistency: 'standard' | 'plastic' | 'scc'): number {
  return K_FACTORS_BY_CONSISTENCY[consistency] ?? K_FACTORS_BY_CONSISTENCY.standard;
}

/** Return k from pour rate band (first matching band). */
export function getKFromPourRate(pourRateMH: number): number {
  for (const band of POUR_RATE_TO_K) {
    if (pourRateMH <= band.max_rate_m_h) return band.k;
  }
  return POUR_RATE_TO_K[POUR_RATE_TO_K.length - 1].k;
}

export const SOURCE_CITATION = ${jsonLit(data.source_citation)} as const;
`;
}

function renderUcebniceMostuPour(data) {
  return banner('ucebnice_mostu_pour.yaml') + `\
/** Recommended pour sequence step. */
export interface PourSequenceStep {
  order: number;
  zone: string;
  technological_pause_h?: number;
  note?: string;
}

/** Per-element pour-sequence specification. */
export interface PourSequenceSpec {
  recommended_sequence: PourSequenceStep[];
  multi_pour_allowed: boolean;
  /** 'yes' | 'no' | 'unknown' | 'depends_on_project' (project-specific). */
  working_joints_allowed: string;
  source_section: string;
}

export const POUR_SEQUENCES: Record<string, PourSequenceSpec> = ${jsonLit(data.pour_sequences)};

/** Return pour sequence for an element type, or undefined. */
export function getPourSequence(elementType: string): PourSequenceSpec | undefined {
  return POUR_SEQUENCES[elementType];
}

export const SOURCE_CITATION = ${jsonLit(data.source_citation)} as const;
`;
}

function renderElementClassification(data) {
  const citation = {
    source: 'concrete-agent/packages/core-backend/app/classifiers/element_rules/element_types.yaml',
    schema_version: data.version,
    note:
      'Single source of truth for element-type classification rule-DATA. The ' +
      'head-noun ALGORITHM is code (TASK_2b Gate 2), never in this artifact. ' +
      'The W3 Python classifier reads the YAML source directly; this generated ' +
      'artifact keeps the TS engine in lockstep (drift-guarded by gen:knowledge:check).',
  };
  return `/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 * Source: concrete-agent/packages/core-backend/app/classifiers/element_rules/element_types.yaml
 * Regenerate: npm run gen:knowledge
 *
 * Element-classification rule-DATA consumed by the TS engine. The head-noun
 * decision is NOT here — it lives in code (TASK_2b Gate 2). The Python W3 side
 * reads the YAML source directly; this artifact keeps the two in lockstep.
 */

export const SOURCE_CITATION = ${jsonLit(citation)} as const;

export const ELEMENT_CLASSIFICATION_RULES = ${jsonLit(data)} as const;

export type ElementClassificationRules = typeof ELEMENT_CLASSIFICATION_RULES;
`;
}

function validateBridgePassportElementMap(data) {
  for (const key of ['version', 'elements']) {
    if (!(key in data)) throw new Error(`passport_element_map.yaml missing top-level key: ${key}`);
  }
  const entries = Object.entries(data.elements);
  if (entries.length === 0) throw new Error('passport_element_map.yaml: elements is empty');
  for (const [k, rule] of entries) {
    if (!/^[a-z][a-z0-9_]*$/.test(k)) {
      throw new Error(`passport element key '${k}' is not snake_case`);
    }
    if (typeof rule.engine_type !== 'string' || !rule.engine_type) {
      throw new Error(`elements.${k}: engine_type must be a non-empty string`);
    }
    if (typeof rule.per_deck !== 'boolean') {
      throw new Error(`elements.${k}: per_deck must be boolean`);
    }
    if (rule.concrete_use !== undefined && typeof rule.concrete_use !== 'string') {
      throw new Error(`elements.${k}: concrete_use must be a string when present`);
    }
    const extra = Object.keys(rule).filter(f => !['engine_type', 'per_deck', 'concrete_use'].includes(f));
    if (extra.length) throw new Error(`elements.${k}: unknown fields ${extra.join(', ')}`);
  }
}

function renderBridgePassportElementMap(data) {
  const citation = {
    source: 'concrete-agent/packages/core-backend/app/classifiers/element_rules/passport_element_map.yaml',
    schema_version: data.version,
    note:
      'Single source for the tz-bridge-passport element-key map (ADR-008 §2). ' +
      'The Python half-B assembler reads the YAML directly; this generated ' +
      'artifact keeps the TS half-A mapper in lockstep (gen:knowledge:check).',
  };
  return `/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 * Source: concrete-agent/packages/core-backend/app/classifiers/element_rules/passport_element_map.yaml
 * Regenerate: npm run gen:knowledge
 *
 * tz-bridge-passport element/use key → engine element_type + per-SO join
 * metadata (per_deck split, concretes[].use alias). Consumed by the half-A
 * mapper (bridge-passport.ts); the Python half-B assembler reads the YAML
 * source natively — one map, no drift (ADR-008).
 */

export const SOURCE_CITATION = ${jsonLit(citation)} as const;

export interface BridgePassportElementRule {
  /** Canonical engine StructuralElementType (consumer casts). */
  engine_type: string;
  /** Symmetric per-deck element (÷ decks, num_bridges = decks) vs whole-SO. */
  per_deck: boolean;
  /** materials_and_standards.concretes[].use key when it differs from the element key. */
  concrete_use?: string;
}

export const BRIDGE_PASSPORT_ELEMENT_MAP: Record<string, BridgePassportElementRule> =
  ${jsonLit(data.elements)};
`;
}

// ─── Zeleznice validators + renderers ─────────────────────────────────────

function validateZelezniceSvrsek(data) {
  for (const key of [
    'version', 'source_citation', 'rail_profiles', 'sleeper_types',
    'fastening_systems', 'spacing_table', 'assemblies', 'ballast', 'bk', 'technology',
  ]) {
    if (!(key in data)) throw new Error(`zeleznicni_svrsek.yaml missing top-level key: ${key}`);
  }
  const profileIds = new Set();
  for (const p of data.rail_profiles) {
    if (!p.id || !p.name_cs) throw new Error(`rail_profile missing id/name_cs: ${JSON.stringify(p)}`);
    if (p.mass_kg_per_m !== null && typeof p.mass_kg_per_m !== 'number') {
      throw new Error(`rail_profile ${p.id}: mass_kg_per_m must be number or null (honest-blank)`);
    }
    profileIds.add(p.id);
  }
  const sleeperIds = new Set();
  for (const s of data.sleeper_types) {
    if (!['table', 'spacing'].includes(s.count_mode)) {
      throw new Error(`sleeper_type ${s.id}: count_mode must be 'table'|'spacing'`);
    }
    if (typeof s.fastening_nodes_per_sleeper !== 'number') {
      throw new Error(`sleeper_type ${s.id}: fastening_nodes_per_sleeper must be a number`);
    }
    if (typeof s.twin_at_joints !== 'boolean') {
      throw new Error(`sleeper_type ${s.id}: twin_at_joints must be boolean`);
    }
    sleeperIds.add(s.id);
  }
  const fasteningIds = new Set();
  for (const f of data.fastening_systems) {
    if (!Array.isArray(f.components_per_node) || f.components_per_node.length === 0) {
      throw new Error(`fastening ${f.id}: components_per_node must be non-empty`);
    }
    fasteningIds.add(f.id);
  }
  // Rozdělení pražců — internal consistency: ks/km == ks/pole × (1000 / délka pole)
  const spacingKeys = new Set();
  for (const row of data.spacing_table) {
    const expected = row.sleepers_per_field * (1000 / row.field_length_m);
    if (expected !== row.sleepers_per_km) {
      throw new Error(
        `spacing_table (${row.code}, ${row.field_length_m} m): per_km=${row.sleepers_per_km} != per_field×(1000/L)=${expected}`,
      );
    }
    spacingKeys.add(`${row.code}|${row.field_length_m}`);
  }
  for (const a of data.assemblies) {
    if (!profileIds.has(a.rail_profile)) throw new Error(`assembly ${a.id}: unknown rail_profile '${a.rail_profile}'`);
    if (!sleeperIds.has(a.sleeper_type)) throw new Error(`assembly ${a.id}: unknown sleeper_type '${a.sleeper_type}'`);
    if (!fasteningIds.has(a.fastening)) throw new Error(`assembly ${a.id}: unknown fastening '${a.fastening}'`);
    if (!['stykovana', 'bezstykova'].includes(a.track_form)) {
      throw new Error(`assembly ${a.id}: track_form must be 'stykovana'|'bezstykova'`);
    }
    for (const code of a.allowed_spacings) {
      for (const fl of a.allowed_field_lengths_m) {
        if (!spacingKeys.has(`${code}|${fl}`)) {
          throw new Error(`assembly ${a.id}: spacing '${code}' @ ${fl} m not in spacing_table`);
        }
      }
    }
    if (a.default_spacing !== null && !a.allowed_spacings.includes(a.default_spacing)) {
      throw new Error(`assembly ${a.id}: default_spacing '${a.default_spacing}' not in allowed_spacings`);
    }
  }
  for (const preset of data.ballast.profile_presets) {
    for (const k of ['thickness_under_sleeper_m', 'crown_width_m', 'slope_ratio']) {
      if (typeof preset[k] !== 'number') throw new Error(`ballast preset ${preset.id}: ${k} must be a number`);
    }
  }
  if (!Array.isArray(data.bk.rail_delivery_lengths_m) || !data.bk.rail_delivery_lengths_m.length) {
    throw new Error('bk.rail_delivery_lengths_m must be non-empty array');
  }
  for (const kind of ['novostavba', 'rekonstrukce', 'udrzba']) {
    if (typeof data.technology.tamping_passes_by_project_kind[kind] !== 'number') {
      throw new Error(`technology.tamping_passes_by_project_kind.${kind} required`);
    }
    if (typeof data.technology.dynamic_stabilization_by_project_kind[kind] !== 'boolean') {
      throw new Error(`technology.dynamic_stabilization_by_project_kind.${kind} required`);
    }
  }
}

function renderZelezniceSvrsek(data) {
  return banner('zeleznicni_svrsek.yaml') + `\
/** Provenance tag — every railway KB record carries its source. */
export interface RailSourceRef { document: string; note?: string | null; }

export interface RailProfileSpec {
  id: string; name_cs: string;
  /** null = honest-blank (hmotnost NEPOČÍTÁNA, dokud zdroj není v KB). */
  mass_kg_per_m: number | null;
  source: RailSourceRef; confidence: number;
}

export interface SleeperTypeSpec {
  id: string; name_cs: string;
  /** 'table' = rozdělení pražců; 'spacing' = rozteč upevňovacích bodů (Y). */
  count_mode: 'table' | 'spacing';
  default_spacing_m?: number; spacing_source?: RailSourceRef;
  mass_kg: number | null; mass_source: RailSourceRef;
  fastening_nodes_per_sleeper: number;
  /** Dvojčitý pražec u styku stykované koleje se počítá jako DVA (ÚRS 824-1 příloha). */
  twin_at_joints: boolean;
  confidence: number;
}

export interface FasteningComponentSpec { name_cs: string; qty: number; }
export interface FasteningSystemSpec {
  id: string; name_cs: string; kind: 'bezpodkladnicove' | 'podkladnicove';
  components_per_node: FasteningComponentSpec[];
  source: RailSourceRef; confidence: number;
}

/** Rozdělení pražců — (kód, délka pole) → ks/pole, ks/km. Průměr vč. zhuštění u styků. */
export interface SleeperSpacingRow {
  code: string; field_length_m: number;
  sleepers_per_field: number; sleepers_per_km: number;
}

export interface TrackAssemblySpec {
  id: string; name_cs: string;
  rail_profile: string; sleeper_type: string; fastening: string;
  track_form: 'stykovana' | 'bezstykova';
  allowed_field_lengths_m: number[]; default_field_length_m: number;
  allowed_spacings: string[]; default_spacing: string | null;
  note_cs: string | null;
}

export interface BallastProfilePreset {
  id: string; name_cs: string;
  thickness_under_sleeper_m: number; crown_width_m: number; slope_ratio: number;
  source: RailSourceRef; confidence: number;
}

export const RAIL_PROFILES = (${jsonLit(data.rail_profiles)} as unknown) as RailProfileSpec[];
export const SLEEPER_TYPES = (${jsonLit(data.sleeper_types)} as unknown) as SleeperTypeSpec[];
export const FASTENING_SYSTEMS = (${jsonLit(data.fastening_systems)} as unknown) as FasteningSystemSpec[];
export const SLEEPER_SPACING_TABLE = (${jsonLit(data.spacing_table)} as unknown) as SleeperSpacingRow[];
export const SPACING_TABLE_SOURCE = ${jsonLit(data.spacing_table_source)} as const;
export const SPACING_TABLE_CONFIDENCE = ${data.spacing_table_confidence};
export const TRACK_ASSEMBLIES = (${jsonLit(data.assemblies)} as unknown) as TrackAssemblySpec[];
export const ASSEMBLIES_SOURCE = ${jsonLit(data.assemblies_source)} as const;
export const ASSEMBLIES_CONFIDENCE = ${data.assemblies_confidence};
export const BALLAST_FRACTION_DEFAULT = ${jsonLit(data.ballast.fraction_default)};
export const BALLAST_FRACTION_SOURCE = ${jsonLit(data.ballast.fraction_source)} as const;
export const BALLAST_PROFILE_PRESETS = (${jsonLit(data.ballast.profile_presets)} as unknown) as BallastProfilePreset[];
export const BK_PARAMS = ${jsonLit(data.bk)} as const;
export const TECHNOLOGY_PARAMS = ${jsonLit(data.technology)} as const;
export const SOURCE_CITATION = ${jsonLit(data.source_citation)} as const;
`;
}

function validateZelezniceVyhybky(data) {
  if (!Array.isArray(data.turnout_forms) || data.turnout_forms.length === 0) {
    throw new Error('turnout_forms must be a non-empty array');
  }
  for (const t of data.turnout_forms) {
    if (!t.id || !t.name_cs) throw new Error(`turnout form missing id/name_cs: ${JSON.stringify(t)}`);
    if (!['jednoducha', 'slozita', 'velmi_slozita'].includes(t.complexity)) {
      throw new Error(`turnout ${t.id}: unknown complexity '${t.complexity}'`);
    }
    if (typeof t.tamping_h_per_unit?.min !== 'number' || typeof t.tamping_h_per_unit?.max !== 'number') {
      throw new Error(`turnout ${t.id}: tamping_h_per_unit needs numeric min/max`);
    }
    if (t.installation_h_per_unit !== null && typeof t.installation_h_per_unit !== 'number') {
      throw new Error(`turnout ${t.id}: installation_h_per_unit must be number or null (honest-blank)`);
    }
    if (typeof t.bk_welds_per_unit !== 'number') {
      throw new Error(`turnout ${t.id}: bk_welds_per_unit must be a number`);
    }
  }
}

function renderZelezniceVyhybky(data) {
  return banner('zeleznicni_vyhybky.yaml') + `\
/** Výhybka = KUSOVÁ konstrukce; pracnost v h/ks podle tvaru (nikdy m/h). */
export interface TurnoutFormSpec {
  id: string; name_cs: string;
  complexity: 'jednoducha' | 'slozita' | 'velmi_slozita';
  /** Podbití výhybkovou ASP — ORIENTAČNÍ rozsah h/ks (S8/3 tech. listy). */
  tamping_h_per_unit: { min: number; max: number };
  /** null = honest-blank (montážní norma není v KB — doplní firemní norma). */
  installation_h_per_unit: number | null;
  /** Svary při vevaření do BK (kolejnicové konce × pásy) — orientační. */
  bk_welds_per_unit: number;
  confidence: number;
}

export const TURNOUT_FORMS = (${jsonLit(data.turnout_forms)} as unknown) as TurnoutFormSpec[];
export const SOURCE_CITATION = ${jsonLit(data.source_citation)} as const;
`;
}

function validateZelezniceMechanizace(data) {
  if (!Array.isArray(data.machines) || data.machines.length === 0) {
    throw new Error('machines must be a non-empty array');
  }
  for (const m of data.machines) {
    if (!m.id || !m.name_cs) throw new Error(`machine missing id/name_cs: ${JSON.stringify(m)}`);
    if (!Array.isArray(m.work_types) || m.work_types.length === 0) {
      throw new Error(`machine ${m.id}: work_types must be non-empty`);
    }
    if (m.crew_size !== null && typeof m.crew_size !== 'number') {
      throw new Error(`machine ${m.id}: crew_size must be number or null (honest-blank)`);
    }
    if (!Array.isArray(m.modes) || m.modes.length === 0) {
      throw new Error(`machine ${m.id}: modes must be non-empty (výkon závisí na režimu — TASK §3.7)`);
    }
    for (const mode of m.modes) {
      if (!mode.rate || !('value' in mode.rate) || !['m/h', 'h/ks'].includes(mode.rate.unit)) {
        throw new Error(`machine ${m.id} mode ${mode.id}: rate must be {value, unit:'m/h'|'h/ks'}`);
      }
      if (mode.rate.value !== null && typeof mode.rate.value !== 'number') {
        throw new Error(`machine ${m.id} mode ${mode.id}: rate.value must be number or null (AI odhad zakázán)`);
      }
    }
    if (!m.restrictions || typeof m.restrictions.needs_track_possession !== 'boolean') {
      throw new Error(`machine ${m.id}: restrictions.needs_track_possession required`);
    }
    if (!Array.isArray(m.restrictions.excluded_sleeper_types)) {
      throw new Error(`machine ${m.id}: restrictions.excluded_sleeper_types must be an array`);
    }
  }
  if (typeof data.track_gang?.base_size !== 'number' || typeof data.track_gang?.workspace_m_per_worker !== 'number') {
    throw new Error('track_gang.base_size + workspace_m_per_worker required (Pattern 50)');
  }
  if (!Array.isArray(data.safety_roles) || data.safety_roles.length === 0) {
    throw new Error('safety_roles must be non-empty (povinná součást osádky — TASK §3.8)');
  }
}

function renderZelezniceMechanizace(data) {
  return banner('zeleznicni_mechanizace.yaml') + `\
/** Výkonová norma stroje — závisí na REŽIMU nasazení (TASK §3.7). */
export interface MachineModeSpec {
  id: string; name_cs: string;
  /** value null = honest-blank (NEPOČÍTÁNO; AI odhad výkonu zakázán). */
  rate: { value: number | null; unit: 'm/h' | 'h/ks' };
  confidence: number;
  note_cs?: string | null;
}

export interface MachineRestrictions {
  min_curve_radius_m: number | null;
  excluded_sleeper_types: string[];
  needs_track_possession: boolean;
  note_cs: string | null;
}

export interface RailMachineSpec {
  id: string; name_cs: string;
  work_types: string[];
  /** Osádka je vázaná na STROJ, ne na objem práce (TASK §3.8). */
  crew_size: number | null;
  crew_source: string;
  modes: MachineModeSpec[];
  restrictions: MachineRestrictions;
  /** Ztrátové časy (min) — null dokud S8/3 technologické listy nejsou v KB. */
  setup_min_to_work: number | null;
  setup_min_to_transport: number | null;
}

export interface SafetyRoleSpec {
  id: string; name_cs: string; count_per_gang: number; mandatory: boolean;
}

export const RAIL_MACHINES = (${jsonLit(data.machines)} as unknown) as RailMachineSpec[];
export const TRACK_GANG = ${jsonLit(data.track_gang)} as const;
export const SAFETY_ROLES = (${jsonLit(data.safety_roles)} as unknown) as SafetyRoleSpec[];
export const SAFETY_ROLES_SOURCE = ${jsonLit(data.safety_roles_source)} as const;
export const SOURCE_CITATION = ${jsonLit(data.source_citation)} as const;
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

function readExisting(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function run() {
  if (!existsSync(KB_DIR)) {
    console.error(`✖ kb/ directory missing at ${KB_DIR}`);
    process.exit(2);
  }

  const drift = [];
  let okCount = 0;
  let skipCount = 0;
  // Output dir → integrations written there (each dir gets its own index.ts).
  const byOutDir = new Map();

  for (const integration of INTEGRATIONS) {
    // Most integrations source from kb/<name>.yaml; an integration may set
    // `yamlAbs` to source from elsewhere in the monorepo (e.g. concrete-agent)
    // and `outAbs` to write elsewhere (e.g. Zeleznice-Planner shared).
    const yamlPath = integration.yamlAbs ?? resolve(KB_DIR, integration.yaml);
    const srcLabel = integration.sourceLabel ?? integration.yaml;
    const outDir = integration.outAbs ?? OUT_DIR;
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const tsPath = resolve(outDir, `${integration.name}.ts`);

    if (!existsSync(yamlPath)) {
      console.warn(`⚠ ${srcLabel} missing — skipping ${integration.name}.ts`);
      skipCount++;
      continue;
    }
    if (!byOutDir.has(outDir)) byOutDir.set(outDir, []);
    byOutDir.get(outDir).push(integration);

    const raw = readFileSync(yamlPath, 'utf8');
    let parsed;
    try {
      parsed = yaml.load(raw);
    } catch (err) {
      console.error(`✖ YAML parse failed for ${srcLabel}: ${err.message}`);
      process.exit(3);
    }

    try {
      integration.validate(parsed);
    } catch (err) {
      console.error(`✖ Schema validation failed for ${srcLabel}: ${err.message}`);
      process.exit(4);
    }

    const out = integration.render(parsed);
    const prev = readExisting(tsPath);

    if (isCheck) {
      if (prev === null || sha256(prev) !== sha256(out)) {
        drift.push(integration.name);
      }
    } else {
      writeFileSync(tsPath, out, 'utf8');
      okCount++;
    }
  }

  // One index per output dir, listing only that dir's integrations.
  for (const [outDir, integrations] of byOutDir) {
    const indexPath = resolve(outDir, 'index.ts');
    const indexOut = renderIndex(integrations);
    const indexPrev = readExisting(indexPath);

    if (isCheck) {
      if (indexPrev === null || sha256(indexPrev) !== sha256(indexOut)) {
        drift.push(`index (${outDir === OUT_DIR ? 'monolit' : basename(dirname(dirname(dirname(outDir))))})`);
      }
    } else {
      writeFileSync(indexPath, indexOut, 'utf8');
    }
  }

  if (isCheck) {
    if (drift.length > 0) {
      console.error(`✖ Knowledge codegen drift detected for: ${drift.join(', ')}`);
      console.error(`  Run: npm run gen:knowledge`);
      process.exit(1);
    }
    console.log(`✓ Knowledge codegen up to date (${INTEGRATIONS.length} integrations checked).`);
    return;
  }

  console.log(`✓ Generated ${okCount} module(s) (Monolit-Planner + Zeleznice-Planner kb-generated/)`);
  if (skipCount > 0) console.log(`  (${skipCount} skipped — YAML missing)`);
}

run();
