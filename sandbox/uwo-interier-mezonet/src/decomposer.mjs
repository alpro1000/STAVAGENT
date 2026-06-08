// [Stage 2] Work-First decomposer. section → PACK of work-atoms.
// Output is CODELESS and PRICELESS (Pattern 15). No catalog binding, no cost here.
// A scope section never collapses into a single line — koupelna yields its whole pack.

import { INTERIER_PSV_TEMPLATES, resolveQuantity } from './templates.mjs';

export function decompose(corpus, routedSections) {
  const atoms = [];
  for (const routed of routedSections) {
    if (routed.route.branch !== 'interier_psv') {
      // Honest-blank or out-of-sandbox branch: emit NO monolit atoms.
      atoms.push({
        section_id: routed.id,
        branch: routed.route.branch,
        honest_blank: routed.route.branch === null,
        work: null,
        note: routed.route.branch === null
          ? 'Nemám šablonu pro tuto sekci (honest-blank).'
          : `Větev '${routed.route.branch}' je mimo sandbox (production branch).`,
      });
      continue;
    }
    const section = corpus.scope_sections.find((s) => s.id === routed.id);
    const template = INTERIER_PSV_TEMPLATES[routed.id] || [];
    for (const tmpl of template) {
      const q = resolveQuantity(tmpl.qty_source, section, corpus);
      atoms.push({
        section_id: routed.id,
        branch: 'interier_psv',
        key: tmpl.key,
        work: tmpl.work,
        unit: tmpl.unit,
        quantity: q.quantity,
        quantity_provenance: q.provenance,
        gap_vs_master: tmpl.gap, // true = master's offer omitted this atom
        // intentionally NO code, NO price at this stage
      });
    }
  }
  return atoms;
}
