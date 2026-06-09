# Pipeline-state recon — what the orchestrator does end-to-end vs. where the human stitches

**Date:** 2026-06-08
**Type:** RECON ONLY (no code, no behaviour change, no fixes)
**Scope:** concrete-agent MCP + stage-gating orchestration (`packages/core-backend/app/`)
**Method:** code read (authoritative call-graph) + the recipe e2e test fixture as observed
seam shape + the 2026-06-05 per-tool SO 202 recon (soul §9). Live end-to-end orchestrator
run **not** executed — see §8 (needs Postgres session store + Monolit `/api/calculate`
network + Portal JWT; not offline/deterministic).

> **TL;DR.** There IS a real chaining orchestrator (`recipe_runner.py`, wired live at
> `/api/v1/orchestrate`). It runs **detect → classify → nuance-decision → work-breakdown →
> calculate → export**. BUT it consumes **already-structured elements with quantities
> already filled** from `options["elements"]`. **No served path extracts množství from a
> parsed soupis (or TZ) and feeds them into the calculator.** That extraction-and-feed is
> the human/client seam. The reconciler is **standalone** (returns rules; nothing in the
> soupis flow applies them). So the system does **not** today take SO 202 documents and emit
> a TOV/soupis without a human assembling the structured element list first.

---

## 1. Entry points & call graph (code-grounded)

### 1a. The two surfaces
- **`POST /api/v1/orchestrate`** (`app/api/routes_orchestrator.py`) — the canonical
  stage-gated surface. Mounted (`app/api/__init__.py:72`). Body = `project_id` + `message` +
  `options` + `confirmation_token` + `user_response`. **No file upload.** Owner = Portal JWT
  principal. Wires the **recipe** runner (`routes_orchestrator.py:67`,
  `_TOOL_RUNNER = make_recipe_tool_runner(_CONFIG)`).
- **`POST /api/v1/mcp/tools/*`** (`app/mcp/routes.py`) + FastMCP `/mcp` (`app/mcp/server.py`)
  — the **20 individual MCP tools**, each independently callable. These are what ChatGPT /
  Claude.ai actually dial. No tool calls another tool except the few internal mini-pipelines
  listed in §1c.

### 1b. The orchestrator loop (thin, owns state only)
`StageGatingOrchestrator.run` (`orchestrator.py`) walks a workflow `sequence` state-by-state,
runs each state's *step* through an injected `ToolRunner`, records outputs into
`session.partials[<state>]`, advances via the validated state-machine edge, pauses for HITL.
**It contains no domain logic** — "which tool runs" is entirely the tool-runner's job. Two
runners exist:
- `make_checkpoint_tool_runner` — **no-op**: records `tools_allowed` from YAML, runs nothing,
  enforces only the COMMIT_PENDING confirmation gate.
- `make_recipe_tool_runner` (`recipe_runner.py`) — the **real** dispatch; this is what's live.

### 1c. The live recipe (what actually chains)
`recipe_runner.py` implements steps for **only 3 of the 8** `full_takeoff` states; the rest
fall through to the no-op checkpoint runner:

| Workflow state | Recipe step | Tools actually invoked | Input source |
|---|---|---|---|
| DOCUMENT_ANALYSIS | `_detect_step` | `detect_object_type` (cache by SO code) | `options["object"]` (caller: object_code/name/charakteristika) |
| WORK_ATOMIZATION | `_atomize_step` | `classify_construction_element` (per element) → nuance decider (≤1 LLM call) → `create_work_breakdown` → `calculate_concrete_works` (deck only) | **`options["elements"]`** (caller: name + volume_m3 + concrete_class + span_m…) |
| CATALOG_BINDING | — (checkpoint no-op) | none (find_otskp/find_urs **not** invoked) | — |
| PRICING / REVIEW | — (checkpoint no-op) | none | — |
| COMMIT_PENDING | checkpoint | none — HITL confirmation gate | `confirmation_token` |
| COMMITTED | `_export_step` | `export_soupis` (real .xlsx) | `partials[WORK_ATOMIZATION].breakdown_items` |
| EXPORTED | terminal | — | — |

Internal mini-pipelines inside single tools (not the orchestrator):
- `create_work_breakdown` (`breakdown.py`): classify → decompose into work items → *optional*
  catalog binding. Default `mode=work_first` → **code-less, price-less**.
- `calculate_concrete_works` (`calculator.py`): maps args → `PlannerInput` → **delegates over
  HTTP** to Monolit `/api/calculate` (`monolit_delegate.py`, SSOT seam). Never a local
  divergent calc; failure = typed error, never a silent number.
- `get_construction_advisor` (`advisor.py`): runs the calculator internally **only when the
  caller passes `volume_m3`**.

---

## 2. THE central question — soupis quantities → calculator: automatic or manual?

**MANUAL SEAM. The quantities are caller-supplied; nothing parses a soupis and feeds množství
into the calculator.**

Exact locations:
- `recipe_runner.py:145` — `elements = [dict(e) for e in (opts.get("elements") or [])]`.
  The elements (and their `volume_m3`) come straight from the request `options`.
- `recipe_runner.py:206-212` — `calculate_concrete_works(volume_m3=deck.get("volume_m3", 0), …)`
  reads the volume **off the caller-supplied element**, defaulting to 0 when absent.
- `breakdown.py:177-180` — explicit comment: *"Stage-1 extract ships volume_m3=None (volumes
  are stage 2) — coalesce to 0 so the qty<=0 skip applies"*. Items with no caller volume are
  silently skipped.
- `calculator.py:227` — `calculate_concrete_works(element_type, volume_m3, …)`: `volume_m3` is
  a **direct required argument**, never sourced from a parsed soupis.
- **Observed** (`tests/test_thin_hybrid_recipe.py:64-70, 120`): the SO 202 fixture hands the
  recipe `{"name":"NK mostovka","volume_m3":605,…}, {"…Dřík…","volume_m3":20}, {"…Piloty…","volume_m3":50.9}`
  — i.e. volumes **pre-filled by the test/caller**, exactly the shape the live endpoint expects.

`parse_construction_budget` (`budget.py`, the soupis parser → `{items:[{…quantity…}]}`) exists
as a standalone tool, is in the YAML `_all_stages` allow-list, but **has no consumer in
`app/` that maps its output into `elements[].volume_m3`** (grep: only its own definition).
The bridge from "parsed soupis quantity" to "calculator input volume" does not exist in code.

---

## 3. Inventory of ALL manual seams (documents → TOV)

1. **Document → structured `elements[]` with quantities.** *(primary seam)* The caller must
   read the soupis/TZ/drawings and assemble `options["elements"]` with `name`, `volume_m3`,
   `concrete_class`, `span_m`, `num_spans`, `is_prestressed`. No served orchestrator step does
   this. `extract_tz_fields` (which since Gate 3 extracts NK geometry from prose) is allowed in
   DOCUMENT_ANALYSIS but **the recipe never calls it** (grep `stage_gating/` → only yaml +
   manifest reference it; `_detect_step` calls `detect_object_type` only).
2. **Object metadata.** `_detect_step` consumes `options["object"]` (object_code, name,
   charakteristika) — caller-supplied, not auto-extracted from the document.
3. **Catalog binding (OTSKP/ÚRS codes).** CATALOG_BINDING is a checkpoint no-op in the recipe;
   `find_otskp_code`/`find_urs_code` are never invoked end-to-end. Codes are attached only if a
   client calls those tools separately (or `create_work_breakdown` is run in the non-default
   `work_with_catalog` mode). Exported soupis is code-less/price-less by default.
4. **Pricing / Review.** PRICING + REVIEW states have empty tool lists — no automated step.
5. **Reconciliation across calculator vs soupis vs TZ.** Not run in the flow (see §5). The only
   automated cross-check is the single-contradiction **nuance decider** — and only if the caller
   passes `options["nuance"]`.
6. **Rebar / sanity corrections** (the "armatura poprava", "60 dní je завышено" kind of fix the
   ChatGPT client did in the MCP runs): not an orchestrator step. The calculator returns its
   `PlannerOutput` (incl. its own warnings) but nothing post-processes/sanity-gates it inside
   the served flow; the recipe even discards the PlannerOutput (see §4).

---

## 4. Provenance flow (confidence + `_source`)

- **`_source`: survives to the deliverable metadata.** `create_work_breakdown` stamps each item
  `_source: "element:<name> / template:<work>"` (`breakdown.py:233`). The orchestrator runs
  `validate_grounding(work_items)` and records verified/unverified counts
  (`orchestrator.py:363-366`). `export_soupis` preserves `_source` in **response metadata**
  (`source_map`, `source_preserved`) and deliberately keeps it **out** of the KROS sheet columns
  (`export.py:49-55, 141-149`). → provenance-as-traceability is intact end-to-end for the work
  list.
- **Confidence: dies at the atomize seam.** `classify_construction_element` returns a
  `confidence`, but `_atomize_step` keeps only `{name, element_type}`
  (`recipe_runner.py:162`) — **classification confidence is dropped.** `create_work_breakdown`
  items carry no confidence field. `calculate_concrete_works` returns the full `PlannerOutput`,
  but the recipe stores only `calc_keys = sorted(calc.keys())[:6]` (`recipe_runner.py:214`) —
  **the calculator's numbers + warnings never reach `breakdown_items`, the export, or the
  deliverable.** So the "replayable/sourced" thesis holds for `_source` provenance and the audit
  log (append-only tool_call + state_transition rows, `orchestrator.py:245-298`), but the
  **numeric confidence chain does not propagate** to the exported soupis.

---

## 5. Reconciler — wired or standalone?

**Standalone.** `uep_get_reconciliation_rules` (`uep.py:333`) loads + returns the rule set
(12 for bridge) from YAML. The engine that *applies* rules,
`app/services/uep/reconciliation_engine.py`, is invoked **only** inside the UEP job runner
(`run_job_in_process`, Phase 3), which is reachable **only** from the UEP surfaces
(`app/api/routes_uep.py:378`, `app/mcp/tools/uep.py:173`) — a **separate pipeline** keyed on a
project-type *coverage matrix* (residential in PR2; bridge/road PR3), writing JSON artefacts to
disk. **Nothing in the soupis/calculator recipe calls it.** The recipe's only contradiction
handling is the per-field **nuance decider** (`recipe_runner.py:166-184, 298-326`): one LLM
"pick the source" decision on a single `options["nuance"]` contradiction — *not* a systematic
calculator-vs-soupis-vs-TZ reconciliation across the 12 rules.

---

## 6. Honest answer: can the system produce TOV for SO 202 without manual stitching?

**No — not without a human/client first turning the documents into the structured element list.**
Where it requires the human, in order:
- **Before DOCUMENT_ANALYSIS:** someone must read SO 202's soupis/TZ/drawings and produce
  `options["elements"]` with quantities (the seam of §2/§3.1). The orchestrator has no document
  ingestion in its request body and no recipe step that extracts/feeds quantities.
- **CATALOG_BINDING / PRICING:** not executed by the recipe → the exported soupis is
  code-less + price-less unless the client separately runs the catalog tools.
- **Reconciliation / sanity:** not in the flow; the client must judge calculator output.

What the system **can** do autonomously **once given the structured elements**: classify each
element with object context, resolve one fed contradiction, decompose into a work list with
`_source`, schedule the deck via the canonical engine, gate on an explicit commit confirmation,
and render a real `.xlsx` soupis with provenance metadata. The corpus-side wins from the SO202
Ingest gates (XC4 soupis now parses 3373 položek; `extract_tz_fields` now returns the right SO
code + NK geometry from prose) make those **inputs** extractable as tools — but they are **not
wired into the orchestrator recipe**, so they don't close the seam on their own.

---

## 7. Client (ChatGPT) vs orchestrator — split of the MCP-run stitching

| Stitching the external client did in the MCP runs | Orchestrator native today? |
|---|---|
| Read quantities out of the soupis/TZ and put them into each element | **No** — caller supplies `options["elements"]` volumes (§2). Tools to extract exist (`parse_construction_budget`, `extract_tz_fields`) but are unwired. |
| Decide element types from names | **Yes** — `classify_construction_element` per element, with object-type context threaded (§1c). |
| Resolve a contradiction between sources | **Partial** — one nuance decision *if* `options["nuance"]` is passed; not a full reconciliation. |
| Rebar / "60 dní" sanity corrections | **No** — calculator returns PlannerOutput+warnings; nothing post-processes it, and the recipe even discards the numbers (§4). |
| Attach OTSKP/ÚRS codes + prices | **No** — CATALOG_BINDING/PRICING are no-ops in the recipe (§3.3-3.4). |
| Assemble the final soupis | **Yes** — `export_soupis` renders the deterministic `.xlsx` from `breakdown_items`. |

Principally-client-required today (not just unwired): the **judgement seams** — choosing which
source's quantity to trust when the documents disagree, and sanity-judging the schedule — beyond
the single fed nuance. Everything else in the "client did it" column is **unwired, not
impossible**: the tools exist; no recipe step calls them.

---

## 8. Observation note (honesty about method)

- **Code read** is the authoritative call-graph source and is complete for §1-§7.
- **Observed seam shape:** `tests/test_thin_hybrid_recipe.py` drives the real recipe over SO 202
  with pre-filled volumes — direct evidence of the §2 input contract.
- **Per-tool SO 202 behaviour** was executed live in the 2026-06-05 recon
  (`docs/audits/so202_corpus_recon/2026-06-05_recon.md`): `extract_tz_fields`,
  `detect_object_type`, parsers — cited, not re-run.
- **Full live `/orchestrate` e2e was NOT run.** It needs a Postgres session repository
  (`DATABASE_URL`), a reachable Monolit `/api/calculate` (network), and a Portal JWT — none of
  which is offline/deterministic. This is a gap in *observation*, not in the *map*: the call
  graph fully determines the seam, and the recipe test exercises it without those externals.

---

## 9. STOP — for review

No code touched, no behaviour changed, no fixes applied. Decisions on closing any seam
(wiring `extract_tz_fields`/`parse_construction_budget` quantity-feed into the recipe; wiring
CATALOG_BINDING; propagating calculator output + confidence into `breakdown_items`; running the
reconciler in-flow) are **separate gated tasks after review of this map** — each additive,
deterministic, golden-paired, with a verbatim CI log on the final HEAD.
