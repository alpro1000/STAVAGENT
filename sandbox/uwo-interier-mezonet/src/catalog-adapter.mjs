// [Stage 3] Catalog-Last binding adapter (separate post-step).
// work-atom → catalog candidate with HONEST status-enum + confidence + sanity flags.
// NEVER fabricates an "exact code found". Uses the FROZEN recorded ÚRS probe.
//
// status-enum:
//   exact        — deterministic catalog DB hit (reserved for OTSKP DB=1.0). Absent here
//                  by design: privátní zakázka → ÚRS, which is web/matcher (never 'exact').
//   candidate    — a concrete code matched (ÚRS matcher/web), needs human confirmation.
//   group_only   — only the oddíl/family identified, no concrete item (N/A + family).
//   not_verified — no probe / no match / licensed full-ÚRS needed. Human binds the code.

// atom.key → recorded finding atom_key (aliases where one probe covers several atoms)
const FINDING_ALIAS = {
  malba_steny: 'malba',
  malba_podhledy: 'malba',
  el_rozvody: 'elektroinstalace',
  kotel_montaz: 'plynovy_kotel_vymena',
};

// expected ÚRS family/oddíl per atom — used for the family/nature sanity check
const EXPECTED_FAMILY = {
  priprava_odstraneni_nateru: '783',
  armovaci_sterka_perlinka: '612',
  stuk: '613',
  malba_steny: '784',
  malba_podhledy: '784',
  obklad_sten: '781',
  dlazba_podlah: '771',
  hydroizolace_koupelna: '711',
  vinyl_pokladka: '776',
  parket_brouseni_lak: '775',
  sdk_podhled: '763',
  el_rozvody: 'M21',
  kotel_montaz: '5805',
};

function findingFor(atomKey, findings) {
  const wantKey = FINDING_ALIAS[atomKey] || atomKey;
  return findings.probes.find((p) => p.atom_key === wantKey) || null;
}

function classifyStatus(finding) {
  if (!finding) return { status: 'not_verified', confidence: 0, code: null };
  const top = finding.top;
  if (top.code && top.code !== 'N/A') {
    // A concrete code matched. ÚRS matcher/web is never 'exact'; high conf → candidate.
    return { status: 'candidate', confidence: top.confidence, code: top.code, description: top.description, unit: top.unit };
  }
  // N/A but an oddíl/family was identified → group_only; otherwise not_verified.
  if (top.family) return { status: 'group_only', confidence: top.confidence, code: null, family: top.family, description: top.description };
  return { status: 'not_verified', confidence: top.confidence ?? 0, code: null };
}

// Family/nature sanity: scan recorded alternates for observed issues, and flag any
// candidate/alternate whose family diverges from the work's expected family.
function sanityFlags(atom, finding) {
  const flags = [];
  if (!finding) return flags;
  const expected = EXPECTED_FAMILY[atom.key];
  const consider = [finding.top, ...(finding.alternates || [])];
  for (const c of consider) {
    if (!c || !c.code || c.code === 'N/A') continue;
    if (c._observed_issue) {
      flags.push({ atom: atom.key, code: c.code, confidence: c.confidence, issue: c._observed_issue, kind: 'nature_mismatch' });
    } else if (expected && c.family && c.family !== expected) {
      flags.push({ atom: atom.key, code: c.code, confidence: c.confidence, issue: `family ${c.family} ≠ expected ${expected}`, kind: 'family_divergence' });
    }
  }
  return flags;
}

export function bindCatalog(atoms, findings, procurementMode = 'privatni') {
  // Catalog choice by procurement mode (mirrors kb/urs_otskp_routing.yaml).
  const catalog = procurementMode === 'verejna' ? 'otskp' : 'urs';
  const allFlags = [];
  const bound = atoms.map((atom) => {
    if (atom.branch !== 'interier_psv' || !atom.key) return atom; // honest-blank/out-of-scope passthrough
    const finding = findingFor(atom.key, findings);
    const cls = classifyStatus(finding);
    const flags = sanityFlags(atom, finding);
    allFlags.push(...flags);
    return {
      ...atom,
      catalog_binding: {
        catalog,
        procurement_mode: procurementMode,
        status: cls.status,
        confidence: cls.confidence,
        code: cls.code || null,
        family: cls.family || null,
        matched_description: cls.description || null,
        sanity_flags: flags,
      },
    };
  });
  return { atoms: bound, sanity_flags: allFlags };
}
