# STAVAGENT — Capability Truth (source for positioning copy)

**Date:** 2026-06-06
**Purpose:** Single source of truth for what is REAL vs aspirational, so marketing/positioning copy never overclaims.
**Method:** Code inspection with `file:line` anchors + tiering. Three parallel sweeps (CORE, kiosks+golden, existing copy).
**Tier legend:** `LIVE` = implemented + has runnable test/deploy path · `BETA` = implemented but untested / off-by-default / not end-to-end · `STUB` = no real implementation.

> Rule: a claim with no code anchor does not exist. If marketing wants to say it, it must point to a line here.

> **CORRECTION 2026-06-06 (post-review, then post-prod-probe):** Two-step correction, both recorded for honesty.
> 1. The original sweep tiered **DWG/DXF as STUB** ("no parser in `app/parsers/`"). Wrong on location — a code-complete DWG→DXF→extract adapter exists in `app/services/uep/` (`dwg_extractor.py`, `dxf_extractor.py`, `registry.py:42,75`) + `app/infrastructure/dwg_converter.py` (LibreDWG), exposed over MCP (`uep_run_extraction`).
> 2. BUT a **live prod probe** of `uep_get_dwg_conversion_status` returns **`any_available: false`** — neither ODAFileConverter nor `dwg2dxf` is on PATH in the deployed image (the `Dockerfile:43` best-effort `|| echo WARNING` install fell through). So every `.dwg` upload fails with **`DWG_CONVERSION_FAILED`**. **Net: DWG is a wired-but-NON-FUNCTIONAL adapter in production — NOT LIVE.** My intermediate "LIVE (best-effort)" tiering is superseded by this — see §3.
>
> **Marketing consequence:** the live landing's "PDF, DWG" is currently a **false functional claim** (a user cannot upload a DWG and get a result) — though for a deployment reason (missing binary), not a missing-parser reason. Fix is decided **outside this session**: (a) install ODAFileConverter / libredwg-tools in the prod image (Dockerfile, PR3 §3.1) → DWG becomes real → keep "PDF, DWG"; or (b) remove "DWG" until the binary ships. **No landing/deck/README edit made this pass.** Lesson: "registered in the dispatch table" ≠ "functional on prod" — always probe the runtime, not just the code.

---

## 1. Headline verdict

The product is **substantially more real than the docs claim in some places, and overclaims in a few specific spots.** The live landing page is already honest and accurate on almost everything. The concrete problems are narrow (below). Do NOT do a from-scratch landing rewrite — the page is good.

---

## 2. What is SAFE to claim (LIVE — verified)

| Claim | Tier | Anchor | Evidence |
|---|---|---|---|
| **1249 automated tests pass** | LIVE | `Monolit-Planner/shared` (`npm test`) | 30 files / 1249/1249 / 2.31s — actually run 2026-06-06. CLAUDE.md figure is correct. |
| **OTSKP catalog, 17 904 items** | LIVE | `app/mcp/tools/otskp.py`; XML at `app/knowledge_base/B1_otkskp_codes/2025_03_otskp.xml` (17 MB) | Real on-disk catalog, in-memory parser + optional SQLite. |
| **MCP server — 20 tools registered** | LIVE | `app/mcp/server.py:23-213`; `tests/test_mcp_compatibility.py` EXPECTED_TOOLS | All 20 wired (docs/CLAUDE.md still say "9" — undercount). |
| **`analyze_construction_document` works** | LIVE | `app/mcp/tools/document.py:36-206` | Regex extraction, 11 patterns, pdfplumber, error handling. NOT broken. (See §5.) |
| **24 element types** | LIVE | `element-audit.test.ts` (155 assertions); `pour-decision.ts:45-72` | All 24 classify + schedule + labor without crash. |
| **Runnable golden tests** | LIVE | `golden-so202.test.ts` (7), `golden-so203.test.ts` (3), `golden-vp4-forestina.test.ts` (7), `golden-group-a-pozemni-vodorovne.test.ts` (12), `element-classifier.golden-w3-parity.test.ts` (24) | Real vitest assertions, not markdown. |
| **7-engine calculator pipeline** | LIVE | `pour-decision.ts`, `element-scheduler.ts`, `formwork-3phase`, `rebar-lite.ts`, `pour-task-engine.ts`, `lateral-pressure.ts`, `pile-engine.ts` | Each engine has its own test file. |
| **Pile engine** | LIVE | `pile-engine.test.ts` (62 tests) | Productivity table Ø600/900/1200/1500 × geology × casing. |
| **Element classifier (deterministic)** | LIVE | `app/mcp/tools/classifier.py` + `element_name_normalizer.py` (195 lines pure regex) | Keyword+OTSKP, no LLM in core. |
| **DXF ingestion (UEP)** | LIVE | `app/services/uep/dxf_extractor.py` (ezdxf), `registry.py:41,73` | Native `.dxf`→ezdxf extract needs no external binary, so DXF works on prod. (DWG ≠ DXF — see §3.) |
| **Budget parsers: XLSX / XML(KROS) / PDF** | LIVE | `smart_parser.py` (399), `xlsx_komplet_parser.py` (201), `xlsx_rtsrozp_parser.py` (216), `kros_parser.py` (567), `pdf_parser.py` (313) | Substantial implementations, no stubs. |
| **Workflow A (parse→audit→export)** | LIVE | `workflow_a.py` | 6-stage, caching, artifacts. |
| **LLM chain Vertex→Gemini→Bedrock→Claude→GPT-4V→Perplexity** | LIVE | `gemini_client.py`, `bedrock_client.py`, `claude_client.py`, `gpt4_client.py`, `perplexity_client.py` | Vertex default (no key, ADC). |
| **URS matcher 4-phase** | LIVE | `ursMatcher.js`, `otskpCatalogService.js` | Regex→OTSKP→Perplexity→learned. (Tests can't run locally: missing `sqlite3` dep — env, not code.) |
| **Registry row classifier v1.1 + v2** | LIVE | `rowClassifierV2.test.ts`, `rowClassifier.integration.test.ts`, `classificationCodec.test.ts` | Integration tests pass. |
| **Credit system, 15 operations, 200 free** | LIVE | `add-credit-system.sql:48-64` | 15 ops seeded, 1–20 credits, deterministic ops cheap. |
| **DIN 18218 / ČSN EN 13670 / RCPSP in engines** | LIVE | `lateral-pressure.ts` (DIN 18218), maturity (`ČSN EN 13670`), `element-scheduler.ts` (RCPSP) | Real formula engines. |

---

## 3. CONDITIONAL — claim only with a caveat (BETA)

| Claim | Tier | Anchor | Required caveat |
|---|---|---|---|
| Resource ceiling "for 24 types" | BETA | `resource-ceiling.ts` (~231, `TODO Phase 3-7`) | Only **6 of 24** types have KB defaults (Group A). Say "Phase 2 — 6 foundational types; rest roadmapped." |
| Workflow B (drawing → estimate) | BETA | `workflow_b.py` (`ENABLE_WORKFLOW_B=False` default) | Wired but disabled by default. Mark "Beta / early access." |
| MSS (posuvná skruž) | BETA | `bridge-technology.ts` `calculateMSSCost/Schedule` | Code runs, but **no golden test against a real MSS project**. |
| OCR for scanned PDFs (MinerU) | BETA | UEP `pdf_tz_extractor.py:81-87` detects scanned PDFs → flags `ocr_required` (zero facts); MinerU service deployed on Cloud Run; auto-routing UEP→MinerU is "PR2 wiring" (operator-routed today) | Detection gate + deployed OCR service are real; the automatic hand-off is not yet end-to-end. "OCR on Cloud Run" as infra is true; "fully automatic OCR pipeline" is not. |
| `find_urs_code` | BETA→LIVE | `app/mcp/tools/urs.py:19-83` | LIVE only if `PERPLEXITY_API_KEY` set; otherwise fails. |
| SO-250 "tested" | BETA | classification tests only (`element-classifier.test.ts`) | NO orchestrator golden test (unlike SO-202/203). Don't equate with them. |

---

## 4. MUST NOT claim (STUB / no code)

| Claim | Tier | Evidence |
|---|---|---|
| **DWG ingestion (functional claim)** | code-complete adapter, **NON-FUNCTIONAL on prod** | Adapter wired (`app/services/uep/dwg_extractor.py`, `registry.py:42,75`), BUT live probe `uep_get_dwg_conversion_status` → **`any_available: false`** (no ODA / no `dwg2dxf` on PATH; `Dockerfile:43` install fell through). Every `.dwg` upload → `DWG_CONVERSION_FAILED`. → A user cannot upload a DWG and get a result. Do NOT claim "PDF, DWG" as functional until the binary ships in the prod image. **Note:** native DXF (no binary needed) DOES work — see §2. Fix decided outside this session. |
| "Offline ČSN standards database" | STUB | `search_czech_construction_norms` is Perplexity **web** search + small local KB, not a local norms DB. |
| Phase 0a completeness-audit **enforcement** | STUB | Documented in CLAUDE.md as mandatory gate; no gate() enforcement found in code. |

---

## 5. The "Analýza dokumentace" question (user suspected it was broken)

**Not broken at the MCP-tool level.** `analyze_construction_document` (`app/mcp/tools/document.py:36-206`) is a working deterministic regex extractor (11 patterns, pdfplumber, graceful errors).

BUT the landing's **"Analýza dokumentace" module** describes something bigger: cross-document checks (geologie→statika→rozpočet), 12+ doc types. That larger workflow = Workflow B territory = BETA/disabled. The landing correctly badges this module **"V přípravě — early access."** So the live page is honest here; the single MCP tool is real, the full cross-document product is not yet. Two different scopes — don't conflate.

Also note: README §3.2/§3.4 describes the analyzer as "PDF-to-structured-data with **MinerU + Gemini**" — that is **inaccurate** vs the live regex+pdfplumber path. README needs a fix.

---

## 6. Documentation drift to fix (accuracy, not marketing)

| Item | Landing | README | product.md | Truth |
|---|---|---|---|---|
| Element types | **24** | 22 | 23 | **24** — SOURCE-VERIFIED (`pour-decision.ts` union = 24 real + `other`). README/product.md stale. Safe to fix; **held pending explicit go** (no edit this pass). |
| MCP tools | (module-level) | 9 | 9 (UI/MCP/API) | **Ambiguous — DO NOT advertise a number yet.** 20 live-exposed includes ~5 introspection/operational probes (`uep_get_job`, `uep_get_dwg_conversion_status`, `uep_list_supported_formats`, `uep_get_coverage_matrix`, `uep_get_reconciliation_rules`) — not user-facing tools. compat-test asserts 11. True user-facing **work-tool** count = separate deliberate decision (derive exactly from `server.py`). **No number changed this pass.** |
| Test count | (not cited) | — | 1036 / 921 | **1249 is an AUDIT figure — do NOT stamp on trust.** Re-run `Monolit-Planner/shared` (`npm test`) to confirm the live number before writing it anywhere. **Held pending live run + go.** |
| Analyzer impl | "v přípravě" (honest) | "MinerU + Gemini" | — | regex + pdfplumber (MCP tool); cross-doc = BETA |

---

## 7. Overclaim risk list (for any deck / copy review)

1. **DWG upload — non-functional on prod.** Adapter is wired but the conversion binary is absent in the deployed image (live probe `any_available: false`); `.dwg` → `DWG_CONVERSION_FAILED`. The landing's "PDF, DWG" is a false functional claim today. → Fix outside this session: install ODA/libredwg in the prod image (keep claim) OR remove "DWG" (drop claim). Native DXF is unaffected (works). **No edit made this pass.**
2. **"Resource ceiling for all elements"** — only 6/24. → Caveat.
3. **"MinerU OCR pipeline"** — not wired. → Don't present as a live step.
4. **README "10-minute scenario" step 1 (MinerU OCR)** — overstates the live path.
5. **MSS / SO-250 "validated"** — code exists, no golden. → "implemented, validation pending."
6. **"Offline norms DB"** — it's web (Perplexity). → Say "norms lookup (web-grounded, cited)."

---

## 8. Anchors index (so copy can cite)

- CORE MCP tools: `concrete-agent/packages/core-backend/app/mcp/tools/*.py`, registry `server.py:23-213`
- OTSKP catalog: `app/knowledge_base/B1_otkskp_codes/2025_03_otskp.xml`
- Calculator engines: `Monolit-Planner/shared/src/calculators/*`
- Golden tests: `Monolit-Planner/shared/src/calculators/golden-*.test.ts`
- Credit pricing: `stavagent-portal/backend/src/db/migrations/add-credit-system.sql:48-64`
- Live landing copy: `stavagent-portal/frontend/src/pages/LandingPage.tsx`, `LandingPageEn.tsx`, `index.html:9-27`
