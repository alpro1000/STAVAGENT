# Deck reconciliation — STAVAGENT_Deck_EN vs capability truth

**Date:** 2026-06-06
**Deck:** `docs/marketing/STAVAGENT_Deck_EN.pptx` (9 slides; `STAVAGENT_Deck_EN.pdf` + `STAVAGENT_Deck_RU.pdf` mirror the same claims).
**Truth source:** `docs/audits/capability_truth/2026-06-06_capability_truth.md`.
**Scope:** Text-only reconciliation. **Binaries NOT edited** — this is an edit list for the author.
**Method:** Text extracted from PPTX slide XML; each claim checked against a `file:line` code anchor.

> Verdict: the deck is **strong and mostly true**. The core thesis (DECOMPOSE vs MATCH, deterministic-first, confidence per number, MCP-exposed) is fully backed by code. **One functional overclaim: DWG ingest is non-functional on prod (B1) — converter binary missing.** Plus commercial-maturity wording fixes: B3 KROS export, B4 residential KROS pricing, B5 subscription tiers (MEDIUM); B6/B7 (LOW). All deck fixes deferred to a deliberate pass — **nothing edited here, findings captured only.**

---

## A. Claims that are SOLID — keep as is (verified)

| Slide | Claim | Anchor |
|---|---|---|
| 3 | "DECOMPOSE: Work → materials + labour + machines + time … explicit formula and a norm source … confidence score on every number" | 7 engines in `Monolit-Planner/shared/src/calculators/*`; confidence framework verified. This is the strongest, true differentiator. |
| 3 / 4 | "whole engine exposed over MCP, so any AI agent can run it" / "agent-native" | `app/mcp/server.py:23-213` — 20 tools registered, LIVE. |
| 4 | "02 Extract: Deterministic first — regex + catalogue; the model only as fallback" | `element_name_normalizer.py` (pure regex), classifier; confidence 1.0 vs 0.7. Verified. |
| 5 | "PERT P50 / P80 / P90 from 10,000 Monte-Carlo runs" | `pert.ts:11`, `planner-orchestrator.ts:633` (default 10000). TRUE. ⚠️ minor: it is **opt-in** (`enable_monte_carlo` default `false`, `planner-orchestrator.ts:293-294`) — fine to claim as a capability. |
| 5 | "Every value cites its norm — ČSN, DIN 18218, TKP — automatic site warnings" | `lateral-pressure.ts` (DIN 18218) + warnings. Verified. |
| 5 | "computed instantly in the browser" | shared TS engine runs client-side. Verified. |
| 6 | "Public-works tender — tender-ready bill of quantities with sourced quantities" | Žihle SO 2062-1, 154 položek, `tender_ready` (CLAUDE.md v4.28; `test-data/most-2062-1-zihle/`). TRUE. |
| 8 | "CZ — live: OTSKP … ; DACH/Spain — next" (roadmap labeled "next") | OTSKP LIVE; DACH/Spain correctly marked future. OK. |

---

## B. Fixes required

### B1 — Slide 4 "01 Ingest: Drawings" — DWG NON-FUNCTIONAL on prod (no edit this pass)
**Two corrections, both recorded.** (1) The original STUB flag was wrong on *location* (adapter lives in `app/services/uep/`, not `app/parsers/`). (2) But a live prod probe (`uep_get_dwg_conversion_status` → `any_available: false`) shows the DWG→DXF converter binary is **absent in the deployed image** (`Dockerfile:43` install fell through), so every `.dwg` upload → `DWG_CONVERSION_FAILED`. **DWG ingest is wired but non-functional on prod.** Native **DXF** (no binary) works; **DWG** does not.
**Decision (outside this session):** install ODA/libredwg in the prod image → DWG real → keep "Drawings"; OR scope the slide to DXF/PDF until then. **No deck edit made this pass — finding captured only.** See capability_truth.md §4 + CORRECTION banner.

### B2 — LOW (downgraded from MEDIUM) — Slide 4, infra line "FastAPI + OCR on Cloud Run"
**Status:** Largely TRUE. MinerU OCR is deployed on Cloud Run; UEP's `pdf_tz_extractor.py:81-87` detects scanned PDFs and flags `ocr_required`. The only gap is that the automatic UEP→MinerU hand-off is still "PR2 wiring" (operator-routed today). "OCR on Cloud Run" as **infrastructure** is accurate; just don't imply a fully-automatic OCR pipeline elsewhere. **No change required** (optional: footnote OCR auto-routing as "in progress").

### B3 — MEDIUM — Slide 4, step "04 Price & export: … export to Excel / KROS"
**Problem:** Live productized export is **Excel / CSV** (matches landing). For KROS there is a UNIXML **importer** (`app/services/uep/unixml_extractor.py:122` — *reads* KROS) and a one-off pilot script that *wrote* UNIXML (Žihle `soupis_praci_FINAL.xml`). No live in-app "export to KROS" button found.
**Fix:** *"export to Excel / CSV (KROS-importable UNIXML demonstrated in pilot)."* — or drop "KROS" until a live export path ships.

### B4 — MEDIUM — Slide 6, "Residential project — A complete priced budget (KROS) generated from the tender documents"
**Problem:** RD Jáchymov pilot shipped 189 items + 8-sheet Excel with quantities/formulas/confidence — but **KROS/ÚRS catalogue price-matching is an OPEN P0 task** (CLAUDE.md TODO "RD Jáchymov Part 5b"; items carry `urs_status: needs_production_lookup`). So "complete priced budget (KROS)" overstates the catalogue-pricing maturity.
**Fix:** *"A complete bill of quantities with sourced quantities and audit trail, exported to Excel; KROS/ÚRS price-matching in progress."*

### B5 — MEDIUM — Slide 7, "SaaS + usage credits. Self-serve subscription with three credit tiers."
**Problem:** Present tense implies live paid subscription. Reality: **open beta, 200 free credits, paid plans Q3 2026** via Lemon Squeezy (landing `LandingPage.tsx` pricing + FAQ; `add-credit-system.sql` seeds 15 op prices but billing not commercially active).
**Fix:** *"SaaS + usage credits — open beta today (200 free credits); three paid tiers via Lemon Squeezy from Q3 2026."*

### B6 — LOW — Slide 1, "Every quantity has a formula. Every formula has a source. Every decision is replayable."
**Note:** True for the **calculator/decompose output** (audit trail per item). Not literally true of raw document extraction. Acceptable as a tagline, but if challenged, scope it to the engine output. No change strictly required.

### B7 — LOW — Slide 6, "5 real pilot projects, end to end" / "255-line estimate"
**Note:** ≥5 pilot datasets exist (`test-data/`: RD_Jachymov, SO_250, hk212_hala, libuse, most-2062-1-zihle, most-litovel). Pilots are **manual/human-validated**, not covered by automated golden tests (RD Jáchymov / HK212 / Žihle have test-data markdown, no runnable golden — unlike SO-202/203/VP4). Fine as a pilot claim; just don't equate "validated end to end" with automated test coverage. "255-line" is plausible but unverified by the sweep.

---

## C. RU deck note
`STAVAGENT_Deck_RU.pdf` mirrors the EN claims — apply B1–B5 to the matching RU slides.

## D. Cross-link: live landing "PDF, DWG" — non-functional on prod
The live landing (`LandingPage.tsx` Klasifikátor module + workflow + FAQ) lists "PDF, DWG". The DWG adapter is wired but **non-functional in production** (converter binary missing; live probe `any_available: false` → `.dwg` = `DWG_CONVERSION_FAILED`). So "PDF, DWG" is a false *functional* claim today — fix decided outside this session (install binary → keep; or remove "DWG"). **No landing edit made this pass.** (See capability_truth.md §4 + CORRECTION banner.)
