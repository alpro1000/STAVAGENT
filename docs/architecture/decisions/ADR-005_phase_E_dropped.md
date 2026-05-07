# ADR-005: Drop Phase E (Engineering Drawings) from STAVAGENT Output

## Status

**Accepted** — 2026-05-07
Validated against: Žihle 2062-1 D&B pilot.

## Context

Žihle pilot included a Phase E experiment — auto-generate situace M 1:500 SVG from GPX +
DXF kadastr + Phase B parametric inputs (bridge polygon, skew, zábor). The proof-of-concept
worked technically (`test-data/most-2062-1-zihle/build_situace_svg.py` →
`C.2.1_situace_M1_500.svg` + PNG via cairosvg, commit `218f03a2`). The output is
human-readable, scaled correctly, parses in browsers + PDF readers.

The question: should "engineering drawings" become a STAVAGENT workflow deliverable
alongside TZ + soupis, or stay as an internal validation tool?

## Decision

**STAVAGENT does NOT produce engineering CAD drawings as deliverable.**

Engineering drawings (situace M 1:500/1:200, podélný řez, příčný řez, výkres výztuže,
detail bednění) are explicitly out of scope. The capability to render lightweight SVG/PDF
from extracted geometry is retained **only as a validation tool** (sanity-check that the
extracted bridge polygon + GPX trace + DXF kadastr are geometrically consistent).

## Reasoning

1. **CAD is mature engineering domain.** AutoCAD / Revit / MicroStation / TurboCAD have
   30+ years of feature depth, ISO/ČSN-conformant linetypes, layer conventions, title-block
   standards, and ČKAIT-recognized output formats (DWG/DGN). STAVAGENT cannot match this in
   the foreseeable roadmap, and approximating it produces output that looks engineering-
   grade but isn't.

2. **Real DPS submission requires authorized projektant signature** (ČKAIT autorizovaný
   inženýr or autorizovaný architekt) per zákon 360/1992 Sb. + ČSN 01 3420. The signature
   carries personal legal liability for the geometry. AI-generated drawings cannot be
   signed; a human projektant who signs an AI drawing they didn't author + verify is taking
   on liability they may not realize.

3. **STAVAGENT moat is the text/data layer** — TZ generation from KB normy, soupis
   reconciliation across calculator + user manual + vendor data, audit trail per položka,
   OTSKP/ÚRS classification. That's where deterministic-first AI offers leverage. CAD is
   not where the differentiation lives.

4. **Tendrová praxe accepts** "výkresy budou součást DPS zhotovitele" in DUR-stage
   submissions. STAVAGENT's text package + reference to "výkresy by zhotovitel/projektant"
   is a complete, non-misleading deliverable.

## What we KEEP

- Capability to **extract geometry** from GPX traces + DXF kadastr + Phase B parametric
  inputs — used downstream for VALIDATION (sanity-check bridge bounding box, parcel
  overlap, skew consistency).
- Optional **Nano Banana / GPT-4o marketing illustrations** for landing pages, blog posts,
  and pre-tender presentations — clearly labelled "Illustrative only — not to scale, not
  for engineering use."
- The Žihle Phase E artefakty (`build_situace_svg.py`, `C.2.1_situace_M1_500.svg`/`.png`,
  `cross_validation_notes.md`) stay in the repo as **validation tooling** + golden-test
  reference for the geometry-extraction pipeline.

## What we DROP

- **Phase E as a workflow deliverable** — no future pilot project includes Phase E in its
  task scope.
- **SVG/PDF outputs framed as "professional drawings"** — internal naming changes from
  `C.2.1_situace_M1_500.svg` (which mimics ČSN 01 3420 výkres číslování) to neutral names
  like `geometry_validation.svg` for new projects.
- **Pretense of CAD-grade quality** in marketing/sales materials — no "STAVAGENT generates
  výkresy" claims.
- **Tendrový package wording** "Výkresy: viz přiložené SVG" → replaced by "Výkresy v rámci
  DPS zhotovitele per ZD §X.Y."

## Consequences

- **Žihle reference project status:** `tender_ready` per `metadata.yaml`. The phase_d_e
  block stays valid because the SVG artefakty are now framed as validation tooling, not
  deliverable. No code or commit is reverted.
- **Future pilot projects:** Phase A → B → C → D → submission. Phase E task is removed
  from the standard checklist.
- **TZ wording:** TZ generators reference "výkresy součást DPS zhotovitele" rather than
  embedding SVG. Žihle TZ B-section already uses neutral wording — no retroactive edit
  needed.
- **Marketing:** AI illustrations for landing pages allowed only with disclaimer
  ("Ilustrativní — nikoli technický výkres").
- **Backlog impact:** any backlog item proposing Phase E expansion (e.g.
  "build_podelny_rez.py", "build_pricny_rez.py") is now closed-as-rejected with link to
  this ADR.

## Cross-references

- Žihle Phase E artefakty: `test-data/most-2062-1-zihle/04_documentation/výkresy/`
- Žihle Phase E build script: `test-data/most-2062-1-zihle/build_situace_svg.py`
- Cross-validation against vendor situace: `test-data/most-2062-1-zihle/04_documentation/výkresy/cross_validation_notes.md`
- Product patterns: `docs/STAVAGENT_PATTERNS.md`
- ČSN 01 3420 (výkresy stavebních konstrukcí) — out of repo, ÚNMZ
- Zákon 360/1992 Sb. (autorizace ve výstavbě) — out of repo, MMR
