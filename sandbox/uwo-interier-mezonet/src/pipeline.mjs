// UWO interiér/PSV sandbox pipeline: Work-First → Catalog-Last → orientační cost.
// Pure, offline, deterministic. No network, no DB, no AI at run time
// (the catalog probe was recorded ONCE and frozen into data/catalog-findings.json).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { routeSections } from './scope-router.mjs';
import { decompose } from './decomposer.mjs';
import { bindCatalog } from './catalog-adapter.mjs';
import { priceAtoms, totals } from './cost.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dir, '..', 'data');

export function loadData() {
  try {
    const corpus = JSON.parse(readFileSync(join(DATA, 'corpus.json'), 'utf8'));
    const findings = JSON.parse(readFileSync(join(DATA, 'catalog-findings.json'), 'utf8'));
    return { corpus, findings };
  } catch (error) {
    throw new Error(`Failed to load sandbox data files (data/corpus.json, data/catalog-findings.json): ${error.message}`);
  }
}

export function runPipeline() {
  const { corpus, findings } = loadData();

  // [1] Scope-Router
  const routed = routeSections(corpus);

  // [2] Work-First decomposition (codeless, priceless)
  const decomposed = decompose(corpus, routed);

  // [3] Catalog-Last binding (status-enum + sanity flags), privátní → ÚRS
  const { atoms: boundAtoms, sanity_flags } = bindCatalog(decomposed, findings, 'privatni');

  // [4] Orientační cost
  const pricedAtoms = priceAtoms(boundAtoms);
  const cost = totals(pricedAtoms, corpus.master_baseline.total_czk);

  const workAtoms = pricedAtoms.filter((a) => a.branch === 'interier_psv' && a.key);
  const gaps = workAtoms.filter((a) => a.gap_vs_master);

  return {
    routed,
    atoms: pricedAtoms,
    work_atoms: workAtoms,
    gaps,
    sanity_flags,
    cost,
    branch_summary: routed.reduce((acc, r) => {
      const b = r.route.branch ?? 'honest_blank';
      acc[b] = (acc[b] || 0) + 1;
      return acc;
    }, {}),
  };
}
