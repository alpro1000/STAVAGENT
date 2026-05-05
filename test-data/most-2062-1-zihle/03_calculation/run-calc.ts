/**
 * run-calc.ts — Phase C calculator runner for Most 2062-1 Žihle.
 *
 * Loads element_breakdown.yaml from 02_design/, calls planElement() from
 * Monolit-Planner/shared/ for each element, and writes per-element
 * PlannerOutput JSONs to outputs/.
 *
 * Run via:
 *   cd test-data/most-2062-1-zihle/03_calculation
 *   npm install
 *   npm run calc
 *
 * Or directly:  npx tsx run-calc.ts
 *
 * AC #11–12 (per TASK_KBIngest_And_Zihle_PhaseBC.md): really invokes the
 * existing STAVAGENT calculator (NOT a hand model); preserves inputs +
 * outputs as JSON for reproducibility.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

// Direct import from Monolit-Planner/shared via relative path. Per shared/package.json
// exports field, ./src/* is exposed for direct .ts access, which tsx executes natively.
// Same import style as Monolit-Planner/shared/src/calculators/golden-vp4-forestina.test.ts.
import { planElement } from '../../../Monolit-Planner/shared/src/calculators/planner-orchestrator.js';
import type { PlannerInput, PlannerOutput } from '../../../Monolit-Planner/shared/src/calculators/planner-orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BREAKDOWN_PATH = path.resolve(__dirname, '../02_design/element_breakdown.yaml');
const OUTPUTS_DIR = path.resolve(__dirname, 'outputs');

// ─────────────────────────────────────────────────────────────────────
// Types from element_breakdown.yaml
// ─────────────────────────────────────────────────────────────────────

interface ElementSpec {
  element_type: string;
  input: Partial<PlannerInput>;
  rationale: string;
}

interface OutOfCalculatorItem {
  description: string;
  estimate_method: string;
  confidence: string;
  midpoint_czk?: number;
  estimate_czk_range?: [number, number];
  estimate_czk_per_m_range?: [number, number];
  length_m?: number;
  pct_of_main_works?: [number, number];
  detail_in?: string;
  note?: string;
}

interface ElementBreakdown {
  schema_version: number;
  created: string;
  project: string;
  context: string;
  defaults: Record<string, unknown>;
  elements: Record<string, ElementSpec>;
  summary_volumes: Record<string, number>;
  summary_reinforcement_kg: Record<string, number>;
  out_of_calculator: Record<string, OutOfCalculatorItem>;
  cross_refs: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`📂 Loading: ${BREAKDOWN_PATH}`);
  const yamlText = fs.readFileSync(BREAKDOWN_PATH, 'utf-8');
  const breakdown = yaml.load(yamlText) as ElementBreakdown;

  if (!breakdown.elements) {
    throw new Error('element_breakdown.yaml has no `elements` key');
  }

  console.log(`📋 Found ${Object.keys(breakdown.elements).length} elements to calculate.`);

  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }

  const results: Record<string, { input: Partial<PlannerInput>; output: PlannerOutput | null; error?: string }> = {};
  let okCount = 0;
  let errCount = 0;

  for (const [elementId, spec] of Object.entries(breakdown.elements)) {
    process.stdout.write(`⚙️  ${elementId} (${spec.element_type})... `);
    try {
      // Cast: element_breakdown YAML uses lowercase strings for unions; Monolit
      // PlannerInput accepts these as-is at runtime (TS narrows via classifier).
      const input = spec.input as PlannerInput;
      const output = planElement(input);
      const outFile = path.join(OUTPUTS_DIR, `${elementId}.json`);
      fs.writeFileSync(outFile, JSON.stringify({ input, output }, null, 2));
      results[elementId] = { input, output };
      okCount++;
      const cost = output.costs?.total_labor_czk ?? 0;
      const dur = output.schedule?.total_days ?? 0;
      console.log(`✅  Total labor: ${cost.toLocaleString('cs-CZ')} Kč, schedule: ${dur} d`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results[elementId] = { input: spec.input, output: null, error: msg };
      errCount++;
      console.log(`❌  ${msg}`);
    }
  }

  // Write combined summary
  const combinedPath = path.join(OUTPUTS_DIR, '_all_outputs.json');
  fs.writeFileSync(combinedPath, JSON.stringify({
    project: breakdown.project,
    timestamp: new Date().toISOString(),
    elements: results,
    out_of_calculator: breakdown.out_of_calculator,
  }, null, 2));

  console.log(`\n📊 Done. ${okCount} OK, ${errCount} errors. Combined: ${combinedPath}`);
  if (errCount > 0) {
    console.log(`⚠️  ${errCount} elements failed — see outputs/<id>.json for details.`);
  }
}

main();
