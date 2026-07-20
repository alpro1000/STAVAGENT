# Stage 0 — corpus & measurement (catalog matching)

Measurement only. Nothing here changes the matching pipeline. Purpose: a
reproducible baseline so every later change is judged against numbers, not
guessed (SPEC §13).

## Why two baselines, not one

The task originally said "take a baseline on the current code". The catalog
version is now a single env knob, which changes what that means: there must be
**two** baselines, on the **same code**, differing only by env —

- **2025** (`OTSKP_CATALOG_VERSION="OTSKP 2025"`, `2025_03_otskp.xml`) — what is
  in production today. The reference point.
- **2026** (`OTSKP_CATALOG_VERSION="OTSKP 2026"`, `2026_otskp.xml`) — where we
  intend to go.

The delta between them is the only answer to "what did the 36 new 2026 catalog
positions do". Every result records the catalog version it was produced under
(harness `run.otskp_catalog_version`) — otherwise the two runs are
indistinguishable. This is *why* the version sits next to each result here, and
is independent of the Stage-6 "version in the persisted product record" work.

## The corpus (`corpus.otskp.jsonl`, `corpus.urs.jsonl`)

One JSON object per line. Separate file per catalog (OTSKP vs ÚRS) — they are
measured separately.

```json
{ "id": "otskp-001", "catalog": "otskp", "description": "…", "unit": "m3", "quantity": 12.5, "expected_code": "801361…", "category": "plain", "source": "…" }
```

| field | meaning |
|---|---|
| `id` | stable unique id |
| `catalog` | `otskp` \| `urs` |
| `description` | the work line as it appears in a real estimate (verbatim) |
| `unit` | unit from the výměra row (m², m³, t, ks …) |
| `quantity` | quantity if present, else 0 |
| `expected_code` | the confirmed correct code, or **`null`** for a "nonexistent" line |
| `category` | one of the five below |
| `source` | **mandatory** — where the ground truth came from |

### Ground-truth rule (non-negotiable)

`expected_code` and `source` must come from a **real estimate or a human**, never
from this system's own output. Otherwise the corpus measures the system's
agreement with itself. `source` records that provenance per line (e.g.
`"real estimate: SO-201 Žihle, řádek 43"` or `"human-confirmed: Alexander"`).

### Categories (four are mandatory, not decorative)

| `category` | why it must be present |
|---|---|
| `nodiacritics` | real estimates are often written without diacritics — this is normal input, not an error |
| `spec` | lines carrying a class / diameter / thickness (`C30/37`, `DN 100`, `tř. 3`) — the numeric differentiators must survive normalization |
| `supply_volume` | lines that differ **only** by scope of supply (with material / assembly only). This is the case the whole podmínky-included design exists for — without it, Stage 4 has nothing to test. |
| `nonexistent` | a work for which **no correct code exists** → `expected_code: null`. The **only** way to measure fabrication. Without it, the fabrication metric is undefined. |
| `plain` | ordinary lines (fills out the ≥50) |

Keep it to **~50 honest lines with confirmed codes**. Do not inflate to 100–200
"for robustness" — 50 confirmed lines are worth more than 200 gathered in haste.

## The five metrics (SPEC §13), per catalog

| metric | diagnoses |
|---|---|
| `top1_hit_rate` | overall quality |
| `candidate_recall` | candidate generation (stage 2) |
| `fabrication_rate` | safety — measurable **only** via `nonexistent` lines |
| `honest_skip_rate` | honesty |
| `online_calls_per_position` | cost (online ÚRS door; offline it is ~0) |

Diagnostic rule: low recall ⇒ candidate generation is broken; high recall + low
top-1 ⇒ selection is broken. Target function = **minimum fabrication at high
recall**, never "maximize top-1" (that trains guessing).

## Running the two baselines

The local OTSKP door reads the SQLite `urs_items` built by the importer, so the
DB must be rebuilt under each version before its run:

```bash
cd URS_MATCHER_SERVICE/backend
npm ci
mkdir -p eval/results

# 2025 (current prod) — default env
node scripts/import_otskp_to_sqlite.mjs --truncate
node eval/run-corpus.mjs eval/corpus.otskp.jsonl > eval/results/otskp_2025.json

# 2026 — same code, only env differs
export OTSKP_CATALOG_FILENAME=2026_otskp.xml OTSKP_CATALOG_VERSION="OTSKP 2026"
node scripts/import_otskp_to_sqlite.mjs --truncate
node eval/run-corpus.mjs eval/corpus.otskp.jsonl > eval/results/otskp_2026.json
unset OTSKP_CATALOG_FILENAME OTSKP_CATALOG_VERSION

# the delta (no pipeline needed)
node eval/run-corpus.mjs --compare eval/results/otskp_2025.json eval/results/otskp_2026.json
```

Reproducibility: the harness is deterministic; a re-run on the same corpus,
cache state and catalog version yields the same numbers (SPEC §12).

The ÚRS corpus runs the same way but exercises the online frontoffice door,
which needs network egress; measure it where that door is reachable.

## Note on where numbers get produced

The online ÚRS door needs egress; the local OTSKP door + SQLite DB run offline.
The 2025-vs-2026 delta is an **OTSKP-door** measurement (the ÚRS frontoffice
catalog is a different catalog, unaffected by the OTSKP version), so it is
fully measurable without the online door.
