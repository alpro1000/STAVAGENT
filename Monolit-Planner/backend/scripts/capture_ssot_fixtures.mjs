/**
 * Capture golden SSOT-delegate fixtures from the LIVE canonical engine.
 *
 * Mounts the real `engineRouter` (POST /api/calculate + /api/classify) on a
 * bare express app (no DB, no auth) and POSTs the parity-set + compat-set
 * inputs — exactly what the concrete-agent MCP tools will send over HTTP.
 *
 * Output: a versioned JSON keyed by a contract hash (sha256 of the built
 * engine dist) so the Python replay fixtures drift in lockstep with the TS
 * engine. Run from Monolit-Planner/backend:
 *
 *     node scripts/capture_ssot_fixtures.mjs > <fixtures.json>
 *
 * The same input objects are mirrored in the Python payload-builder, so a
 * captured `calculate`/`classify` entry == what `calculate_concrete_works` /
 * `classify_construction_element` forwards.
 */
import express from 'express';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import engineRouter from '../src/routes/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedDist = path.resolve(__dirname, '../../shared/dist');

// Contract hash = sha256 of the two engine entry modules (built). Any change
// to planElement / classifyElement output shape changes this hash, signalling
// the Python replay fixtures must be re-captured.
function contractHash() {
  const h = crypto.createHash('sha256');
  for (const rel of ['calculators/planner-orchestrator.js', 'classifiers/element-classifier.js']) {
    h.update(readFileSync(path.join(sharedDist, rel)));
  }
  return h.digest('hex').slice(0, 16);
}

// ── Parity set (same elements as the jest parity + task spec) ────────────────
// Each `calculate` input is exactly the PlannerInput the MCP payload-builder
// produces; each `classify` input is the { name, is_bridge } body MCP POSTs.
const CALCULATE_CASES = {
  // ── parity set ──
  'parity/mostovkova_deska': {
    element_type: 'mostovkova_deska', volume_m3: 605, concrete_class: 'C35/45',
    height_m: 6, span_m: 20, num_spans: 6, is_prestressed: true, has_dilatacni_spary: false,
  },
  'parity/rimsa': {
    element_type: 'rimsa', volume_m3: 12.5, concrete_class: 'C30/37',
    height_m: 0.5, has_dilatacni_spary: false,
  },
  'parity/driky_piliru': {
    element_type: 'driky_piliru', volume_m3: 24, concrete_class: 'C30/37',
    height_m: 8.0, has_dilatacni_spary: false,
  },
  'parity/zaklady_piliru': {
    element_type: 'zaklady_piliru', volume_m3: 35, concrete_class: 'C25/30',
    height_m: 1.2, has_dilatacni_spary: false,
  },
  'parity/pilota': {
    element_type: 'pilota', volume_m3: 50, concrete_class: 'C30/37',
    pile_diameter_mm: 900, pile_count: 10, pile_geology: 'below_gwt', has_dilatacni_spary: false,
  },
  'parity/stena': {
    element_type: 'stena', volume_m3: 30, concrete_class: 'C25/30',
    height_m: 2.8, has_dilatacni_spary: false,
  },
  // dřík opěry — both paths must agree (even if currently "wrong", fixed later in TS)
  'parity/opery_ulozne_prahy': {
    element_type: 'opery_ulozne_prahy', volume_m3: 55, concrete_class: 'C30/37',
    height_m: 5.0, has_dilatacni_spary: false,
  },
  // ── compat set (mirrors existing test_mcp_compatibility.py calculator tests) ──
  'compat/driky_basic': {
    element_type: 'driky_piliru', volume_m3: 24, concrete_class: 'C30/37',
    height_m: 8.0, has_dilatacni_spary: false,
  },
  'compat/mostovka': {
    element_type: 'mostovkova_deska', volume_m3: 664, concrete_class: 'C30/37',
    span_m: 31, num_spans: 3, has_dilatacni_spary: false,
  },
  'compat/rimsa_override_t': {
    element_type: 'rimsa', volume_m3: 12.5, concrete_class: 'C30/37',
    formwork_system_name: 'Římsové bednění T', rental_czk_override: 350.0,
    has_dilatacni_spary: false,
  },
  // element_type 'zaklady' (MCP) aliases to engine 'zakladovy_pas'
  'compat/zaklady_mismatch': {
    element_type: 'zakladovy_pas', volume_m3: 50, concrete_class: 'C25/30',
    formwork_system_name: 'Římsové bednění T', has_dilatacni_spary: false,
  },
  'compat/stena_manufacturer': {
    element_type: 'stena', volume_m3: 30, concrete_class: 'C25/30',
    height_m: 2.8, preferred_manufacturer: 'PERI', has_dilatacni_spary: false,
  },
  'compat/stena_no_override': {
    element_type: 'stena', volume_m3: 30, concrete_class: 'C25/30',
    height_m: 2.8, has_dilatacni_spary: false,
  },
};

const CLASSIFY_CASES = {
  'parity/mostovkova_deska': { name: 'Mostovková deska', is_bridge: true },
  'parity/rimsa': { name: 'Římsy monolitické', is_bridge: true },
  'parity/driky_piliru': { name: 'Mostní pilíře P2-P3', is_bridge: true },
  'parity/zaklady_piliru': { name: 'Základy pilířů', is_bridge: true },
  'parity/pilota': { name: 'Piloty vrtané Ø900', is_bridge: false },
  'parity/stena': { name: 'Stěna', is_bridge: false },
  'parity/opery_ulozne_prahy': { name: 'Dřík opěry OP1', is_bridge: true },
  // compat
  'compat/pilir': { name: 'Mostní pilíře P2-P3, C35/45', is_bridge: true },
  'compat/rimsa': { name: 'Římsy monolitické, C30/37', is_bridge: false },
  'compat/mostovka_so204': { name: 'NK deskový předpjatý', is_bridge: true },
  'compat/stena': { name: 'Stěna', is_bridge: false },
};

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api', engineRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const post = async (route, body) => {
    const res = await fetch(`${base}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  const out = { _contract_hash: contractHash(), _captured_via: 'POST /api/{calculate,classify}', calculate: {}, classify: {} };

  for (const [key, input] of Object.entries(CALCULATE_CASES)) {
    const { status, body } = await post('/api/calculate', input);
    if (status !== 200) throw new Error(`calculate ${key} returned ${status}: ${JSON.stringify(body)}`);
    out.calculate[key] = { input, output: body };
  }
  for (const [key, input] of Object.entries(CLASSIFY_CASES)) {
    const { status, body } = await post('/api/classify', { name: input.name, is_bridge: input.is_bridge });
    if (status !== 200) throw new Error(`classify ${key} returned ${status}: ${JSON.stringify(body)}`);
    out.classify[key] = { input, output: body };
  }

  server.close();
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
