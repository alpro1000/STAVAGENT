#!/usr/bin/env node
/**
 * Knowledge codegen — reads kb/*.yaml, writes typed TS modules.
 *
 * Source of truth: kb/<name>.yaml
 * Output: Monolit-Planner/shared/src/kb-generated/<name>.ts
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
];

// ─── Index re-export ──────────────────────────────────────────────────────

function renderIndex() {
  // Namespace each module re-export to avoid SOURCE_CITATION name collision
  // across integrations. Consumers can either `import { TKP18_MATURITY }`
  // or `import { CURING_DAYS_TABLE } from '../kb-generated/tkp18-maturity.js'`.
  const lines = INTEGRATIONS.map(i => {
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
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const drift = [];
  let okCount = 0;
  let skipCount = 0;

  for (const integration of INTEGRATIONS) {
    // Most integrations source from kb/<name>.yaml; an integration may set
    // `yamlAbs` to source from elsewhere in the monorepo (e.g. concrete-agent).
    const yamlPath = integration.yamlAbs ?? resolve(KB_DIR, integration.yaml);
    const srcLabel = integration.sourceLabel ?? integration.yaml;
    const tsPath = resolve(OUT_DIR, `${integration.name}.ts`);

    if (!existsSync(yamlPath)) {
      console.warn(`⚠ ${srcLabel} missing — skipping ${integration.name}.ts`);
      skipCount++;
      continue;
    }

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

  // Index file
  const indexPath = resolve(OUT_DIR, 'index.ts');
  const indexOut = renderIndex();
  const indexPrev = readExisting(indexPath);

  if (isCheck) {
    if (indexPrev === null || sha256(indexPrev) !== sha256(indexOut)) {
      drift.push('index');
    }
  } else {
    writeFileSync(indexPath, indexOut, 'utf8');
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

  console.log(`✓ Generated ${okCount} module(s) into Monolit-Planner/shared/src/kb-generated/`);
  if (skipCount > 0) console.log(`  (${skipCount} skipped — YAML missing)`);
}

run();
