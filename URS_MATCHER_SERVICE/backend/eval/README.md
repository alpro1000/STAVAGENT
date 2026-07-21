# Stage 0 — corpus & measurement (catalog matching)

Measurement infrastructure for SPEC §13. The harness (`run-corpus.mjs`) drives
the live matcher over a corpus of human-confirmed lines and reports the five
metrics per catalog. **This file is the single source for the protocol** — the
harness header deliberately repeats none of it.

> **Instrument rule:** after ANY edit to `run-corpus.mjs`, run
> `node eval/selfcheck.mjs` (dependency-free) and get PASS before trusting
> numbers. The self-check feeds synthetic lines with known outcomes through the
> harness and asserts the exact metrics — it verifies the meter, not the system.

## Why two baselines, not one

The OTSKP catalog version is a single env knob (facade
`src/config/otskpCatalog.js`), so the Stage-0 baseline is **two runs on the
same code**, differing only by catalog version:

- **2025** (`2025_03_otskp.xml`, default) — what production serves today.
- **2026** (`2026_otskp.xml` via env) — where we intend to go.

The delta between them is the only answer to "what did the 36 new 2026
positions do". Every run records both catalog axes + every behaviour knob, so
two runs are never confused.

## Isolation (built in, not operator discipline)

A measurement run must not touch production-adjacent state, and production
state must not leak into the measurement. The harness enforces:

- **Own DB file, explicit.** `--db` is required and must point at an eval DB
  built by the importer (below). The run records the resolved path + row count
  and **aborts below 1000 rows** (the runtime auto-seeds a 36-item toy DB on a
  missing file — that floor is what catches it). The service's working
  `data/urs_matcher.db` is never touched.
- **Learned-mappings layer off.** The harness sets `URS_LEARNING=0`
  (kill-switch in `matchUrsItems`): no cache answers (a learned hit would
  bypass the catalog), no store writes (run A cannot poison run B).
- **stdout = pure JSON.** Pipeline logs are forced to ERROR (stderr); prefer
  `--out <file>` anyway.

## Explicit measurement mode

- `--mode otskp` — sets `URS_FRONTOFFICE_SEARCH=0`. The frontoffice ÚRS door
  otherwise runs FIRST and any hit ≥ 0.7 suppresses the local + OTSKP layers —
  the 2025-vs-2026 delta would measure the network, not the catalog (and
  offline, every line would burn a 12 s timeout).
- `--mode urs` — frontoffice stays on (it IS the ÚRS door being measured).
  Needs network egress. The run records `urs_catalog_version`
  (`CS_URS_...`), whether the version-id is env-set, and the catalog mode.

The mode is stamped into the run record; `--compare` refuses cross-mode and
cross-corpus comparisons.

## The corpus (`corpus.otskp.jsonl`, `corpus.urs.jsonl`)

One JSON object per line; `//` lines are comments (this dialect is understood
by this harness only — don't feed the files to `jq` etc.). Separate file per
catalog.

```json
{ "id": "otskp-001", "catalog": "otskp", "description": "…", "unit": "m3", "quantity": 12.5, "expected_code": "801361…", "category": "plain", "source": "real estimate: SO-201 Žihle, řádek 43" }
```

| field | meaning |
|---|---|
| `id` | stable unique id (duplicates are rejected) |
| `catalog` | `otskp` \| `urs` — validated against `--mode` (catches wrong-file mixups) |
| `description` | the work line as it appears in a real estimate (verbatim) |
| `unit`, `quantity` | from the výměra row. **Collected, not measured**: the current matcher ignores both (no unit gate exists yet — that is Stage 2 work). They are recorded so the corpus survives Stage 2 unchanged; nothing today validates units. |
| `expected_code` | the confirmed correct code, or **`null`** (requires `category: "nonexistent"` — enforced both directions) |
| `category` | one of the five below (typos are rejected) |
| `source` | **mandatory** — ground-truth provenance |

### Ground-truth rule (non-negotiable)

`expected_code` + `source` come from a **real estimate or a human**, never from
this system's own output (that would measure self-agreement). Note: generated
artifacts like an auto-built `master_soupis` are system output — only
human/estimate-confirmed codes qualify.

### Categories (four are mandatory, not decorative)

| `category` | why it must be present |
|---|---|
| `nodiacritics` | real estimates are often written without diacritics — normal input, not an error |
| `spec` | class / diameter / thickness / size-band lines (`C30/37`, `DN 100`, `do 800 mm`, `přes 4 m2`) — numeric differentiators must survive normalization |
| `work_vs_material` | montáž ↔ dodávka pairs (K line + its M sibling, different descriptions) — work must not be answered with a material code and vice versa |
| `supply_volume` | **0 строк — в источнике (Vidímova) не встретилось; проверка уедет на Этап 4.** Reserved for the hard case the podmínky design exists for: the SAME description carrying different codes by scope of supply. Do not fabricate such lines — they must come from a real estimate. |
| `nonexistent` | no correct code exists (`expected_code: null`) — the **only** way to measure fabrication; a run without such lines is refused (override: `--allow-incomplete`) |
| `plain` | ordinary lines (fills out the ~50) |

Keep to **~50 honest lines**. Fifty confirmed lines beat two hundred gathered
in haste.

## Metric semantics (exact)

| metric | denominator | notes |
|---|---|---|
| `top1_hit_rate` | non-error lines with a code | `top_code` = the pipeline's OWN first candidate (no re-sort — ordering is part of what is measured) |
| `candidate_recall` | non-error lines with a code | expected code anywhere in the returned list |
| `fabrication_rate` | non-error, non-filtered `nonexistent` lines | a returned code where none exists |
| `honest_skip_rate` | same pool | empty result on a `nonexistent` line |
| `online_calls_per_position` | all lines | **resolved** fetches to the exact online hosts (frontoffice / Perplexity / Brave); failed attempts are recorded separately as `run.online_attempts`. Note: the one-shot frontoffice versionId lookup lands on the first line's counter. |

- **Errors** (pipeline threw): excluded from every denominator, surfaced as
  `n_errors`; `--compare` warns when nonzero — infra noise must not read as a
  catalog regression.
- **Input-filtered lines** (the matcher's pre-filter dropped them): counted as
  real quality misses (production drops them too) but excluded from the honesty
  pool (the matcher never judged them). Surfaced as `n_input_filtered`.
- A metric with an empty denominator is `null` and `--compare` calls it out as
  **UNMEASURABLE** — it never masquerades as "no change".
- STOP directions are per-metric (in the compare output): fabrication regresses
  by **rising**; quality/honesty regress by dropping.

## Protocol

```bash
cd URS_MATCHER_SERVICE/backend
npm ci
node eval/selfcheck.mjs                  # instrument sane?
mkdir -p eval/data eval/results

# Build per-version eval DBs (isolated files — the working DB is not touched):
node scripts/import_otskp_to_sqlite.mjs --db eval/data/otskp_2025.db --truncate
OTSKP_CATALOG_FILENAME=2026_otskp.xml OTSKP_CATALOG_VERSION="OTSKP 2026" \
  node scripts/import_otskp_to_sqlite.mjs --db eval/data/otskp_2026.db --truncate

# Baseline 2025 (current prod):
node eval/run-corpus.mjs --mode otskp --db eval/data/otskp_2025.db \
  --out eval/results/otskp_2025.json eval/corpus.otskp.jsonl

# Baseline 2026 — same code, env flips the in-memory OTSKP layer, --db flips SQLite:
OTSKP_CATALOG_FILENAME=2026_otskp.xml OTSKP_CATALOG_VERSION="OTSKP 2026" \
  node eval/run-corpus.mjs --mode otskp --db eval/data/otskp_2026.db \
  --out eval/results/otskp_2026.json eval/corpus.otskp.jsonl

# The delta (no pipeline needed):
node eval/run-corpus.mjs --compare eval/results/otskp_2025.json eval/results/otskp_2026.json
```

The ÚRS corpus runs with `--mode urs` against a DB built from the KROS/ÚRS
importers (`import_kros_urs.mjs` — needs a `--db`-capable invocation or a copy
of the working DB; it must contain the ÚRS rows, not OTSKP) and needs egress
for the frontoffice door. Take the ÚRS baseline on the CURRENT channel first —
that is the "before" for the frontoffice-routing fix.

Results land in `eval/results/` (gitignored — run artifacts are machine-local;
share them in the PR description, not as commits).

## Reproducibility

With `URS_LEARNING=0`, a fixed corpus, a fixed eval DB, and the same catalog
env, a re-run yields the same numbers for the deterministic doors. `--mode urs`
additionally depends on the live frontoffice release (recorded as
`urs_catalog_version`) and web-search nondeterminism — compare ÚRS runs only
with matching run records.
