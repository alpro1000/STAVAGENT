# Backlog — KB norms extraction (Týden 3 scope)

**Datum:** 2026-05-21
**Trigger:** Říms Phase A — Q6 decision (see `docs/audits/rimsa_fullstack/2026-05-20_phase_a_closing.md`).
**Effort estimate:** 1–2 týdny Claude Code work (split into 3 PRs)
**Priority:** P1 (blocks Týden 3 codegen pipeline; not blocking Říms Phase C)

---

## Scope

Extract three norm sources currently referenced by hardcoded TS matrices into canonical YAML under `concrete-agent/packages/core-backend/app/knowledge_base/B7_regulations/`. After extraction, generate the TS constants from YAML at build time (codegen) so the source-of-truth lives in KB.

**In scope (3 norms):**

1. **TKP 18 §7.8.3 — Ošetřování betonu** → `B7_regulations/tkp_18_rsd_2024/extracted.yaml`
   - Curing class table (classes 2, 3, 4 × temperature bands × concrete groups)
   - Cement-type speed factors
   - Saul maturity datum temperature
   - Strip-strength % per element type
   - Currently mirrored in: `Monolit-Planner/shared/src/calculators/maturity.ts` lines 168–203 (TS) + `concrete-agent/.../app/mcp/tools/calculator.py` lines 48–55 (Python MCP, **disagreeing values**)

2. **ČSN EN 13670 — Provádění betonových konstrukcí** → `B7_regulations/csn_en_13670_provadeni/extracted.yaml`
   - Source PDF already present in `B2_csn_standards/CSN_EN_13670_provadeni/` but not yet extracted to YAML
   - Minimum-curing-days floor per exposure class (XF1=5d, XF2=5d, XF3=7d, XF4=7d, XD2=5d, XD3=7d, XS2=5d, XS3=7d, XA2=5d, XA3=7d)
   - Currently mirrored in: `maturity.ts:89` `EXPOSURE_MIN_CURING_DAYS`

3. **DIN 18218:2010 — Frischbetondruck** → `B7_regulations/din_18218_2010_frischbetondruck/extracted.yaml`
   - Lateral-pressure formula constants
   - Consistency-class k-factors (standard 0.85 / plastic 1.00 / SCC 1.50)
   - Pressure caps per formwork category
   - Currently mirrored in: `Monolit-Planner/shared/src/calculators/lateral-pressure.ts:52` `getConsistencyKFactor()`

**Out of scope:**

- B4 default_ceilings YAML per element type — separate per-element work, not norms extraction
- B5 tech cards extraction — done case-by-case as `T_bedneni.yaml` etc. ship
- Codegen pipeline itself — design + implementation is a separate Týden 3 ticket
- Migrating ELEMENT_CATALOG / SANITY_RANGES / RECOMMENDED_EXPOSURE — element-domain, not norms

---

## Suggested split (3 PRs)

**PR 1 — TKP 18 §7.8.3 extraction (highest leverage; unblocks Říms Phase C curing-table fix)**
- `B7_regulations/tkp_18_rsd_2024/source.pdf` (if available, else `source_pointer.md`)
- `B7_regulations/tkp_18_rsd_2024/METADATA.md`
- `B7_regulations/tkp_18_rsd_2024/extracted.yaml` — curing class table + cement factors + Saul datum
- `B7_regulations/tkp_18_rsd_2024/citations.md` — per-value page references
- ⚠️ **Resolve the TS ↔ Python divergence at this step.** Whichever side is wrong gets corrected to match the YAML.

**PR 2 — ČSN EN 13670 extraction**
- Same 4-file layout. Source PDF likely already in `B2_csn_standards/`.
- Output: exposure-class minimum-curing-days table.

**PR 3 — DIN 18218 extraction**
- Same 4-file layout.
- Output: k-factors, formula constants, pressure caps.

---

## Audit-trail requirement

Per `docs/STAVAGENT_PATTERNS.md` Pattern 2 (Audit Trail Mandatory): every value in `extracted.yaml` must carry `source` (norm citation), `confidence` (0.85+ for direct citation), and `notes` if interpretation was required.

Example shape:

```yaml
curing_days_table:
  - temp_min_c: 15
    temp_max_c: 25
    concrete_group: "C30+"
    curing_class_2_days: 1.5
    curing_class_3_days: 2.5
    curing_class_4_days: 9        # ⚠️ TS code currently says 5 — to be reconciled in PR 1
    source: "TKP 18 §7.8.3, tabulka 7.8.3-1, str. 142"
    confidence: 0.95
    notes: "Hodnoty pro CEM I, vodorovné prvky (deska/trám). Vertikální prvky × 0.7."
```

---

## Acceptance per PR

- 100 % audit trail coverage (`source` + `confidence` + optional `notes` per row)
- ≥3 spot-checks against original norm PDF for each table
- Cross-reference: every TS / Python constant currently mirroring this norm gets a `// TODO(codegen, KB:<path>)` comment with the YAML key pointing into the extracted file
- No code migration in these PRs (only YAML + comment trail). Codegen wiring = separate PR per Týden 3 plan

---

## Links

- Říms Phase A Q6 decision: `docs/audits/rimsa_fullstack/2026-05-20_phase_a_closing.md`
- MCP boundary doc: `docs/architecture/mcp_calculator_boundary.md`
- KB placement guide: `docs/KNOWLEDGE_PLACEMENT_GUIDE.md`
- Patterns reference: `docs/STAVAGENT_PATTERNS.md`

**Author:** Říms Phase A closing, 2026-05-21.
