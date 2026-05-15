# Google for Startups AI Agents Challenge — STAVAGENT Submission Analysis

**Author:** Claude Code session (analytical deliverable, no implementation)
**Date:** 2026-05-15
**Status:** Draft — awaiting Alexander's go/no-go decision
**Reading time target:** 20 minutes

---

## 1. Executive Summary

The hackathon (Google for Startups AI Agents Challenge, deadline **June 6, 2026 at 02:00 GMT+2 ≡ June 5, 2026 5:00 PM PT — 21 days from today**) offers a **$97,500 prize pool ($60K cash + $37.5K Cloud credits)** + non-cash perks (virtual coffee with Addy Osmani / Google Cloud & DeepMind experts; VIP tickets to a Bay Area Google event; social promo on Google's channels) + **$500 Cloud credits to every eligible registered team**. Three tracks: **Build Net-New / Optimize Existing / Refactor for Marketplace**. [Source: Devpost official challenge page text, provided by Alexander 2026-05-15; cross-referenced Google Cloud Blog 1, 2]

**Alexander has registered** — application pending Devpost approval (the auto-reply "Your information has been sent to the organizer… You will receive an email when approved" confirms submission). This partially resolves R2 / O-2.

**Honest assessment of STAVAGENT today (verified against repo, not CLAUDE.md marketing copy):**
- ✅ 9 working MCP tools, OAuth 2.0 + PKCE, Cloud Run deployed (`concrete-agent/.../app/mcp/`)
- ✅ 7-engine deterministic TypeScript calculator (`Monolit-Planner/shared/src/calculators/`, ~17K LOC)
- ✅ Multi-format document parsing (14 parser files, Czech-specific, MinerU OCR fallback)
- ✅ Žihle pilot complete end-to-end as production-shape demo case (`test-data/most-2062-1-zihle/`)
- ❌ **No autonomous agent loop in repo.** Zero grep hits for `agent_loop`, `decide_next_step`, LLM-driven tool routing. All workflows are hardcoded Python pipelines (`workflow_a`, `workflow_b`). Multi-role expert system is a fixed 4-role consensus, not autonomous reasoning.

**Per Google's own definition** (Gemini Enterprise blog 3): agents "execute complex, end-to-end tasks" with "deep context and memory, intelligent orchestration, and safe tool use" — explicitly NOT rigid workflows. **Track 1's exact wording on the Devpost page is even sharper**: *"move from static code to declarative intent. Show us how your agent uses the Model Context Protocol (MCP) to securely connect to external tools, gather context, and execute tasks autonomously."* — this confirms my read that **STAVAGENT today is a tool provider for agents, not an agent**: its workflows are static Python code (`workflow_a`, `workflow_b`), not declarative intent.

**Recommended track: Track 1 (Build Net-New)** — Track 2 fails the "existing prototype" gate (no agent exists to optimize); Track 3 needs Marketplace + Gemini Enterprise certification (4-step process, weeks of paperwork), unrealistic in 21 days alongside Cemex CSC pitch (Jun 28) and Žihle tender (Jul 2).

**Two submission variants explored:**
- **Variant A (baseline):** thin ADK + Gemini Flash agent that autonomously processes a Czech tender via the 9 MCP tools. Safe, ~90–120h. §6 spec applies as written.
- **Variant B (creative, recommended):** reframe the submission so that the **MCP server itself is the hero** — "engineering ground truth infrastructure for any AI agent in construction" — and the ADK agent is the demonstration that the infrastructure works. Adds a multi-client demo (Claude Desktop + Custom GPT + new ADK Gemini Flash agent all calling the same MCP server simultaneously) and a "hallucination vs ground truth" contrast. ~100–130h. Full spec in §11. This variant maps 1:1 onto the Master Brief Layer 2 narrative ("AI agents need engineering ground truth; LLMs hallucinate construction calculations; STAVAGENT is the deterministic layer agents call") and onto all three Cemex CSC positioning angles simultaneously. Recommended as the primary submission story.

**Note on source documents:** strategic docs cited in the brief (`STAVAGENT_Competitive_Landscape_Cemex_CSC.md`, `STAVAGENT_DACH_Addendum.md`, `STAVAGENT_Master_Brief.md`) were not in the repo at initial inventory but were subsequently provided directly. They are now reflected in §3 (competitive analysis), §6 (Variant A submission positioning), §9 (Cemex synergy), and §11 (Variant B creative alternative). The Master Brief in particular surfaced STAVAGENT's **triple-access architecture** (UI + MCP + REST API) and the **Layer 2 narrative** ("AI agents need engineering ground truth; LLMs hallucinate construction calculations; STAVAGENT is the deterministic layer agents call") — both of which power Variant B. Four `TASK_MCP_*.md` documents and `STAVAGENT_Project_Knowledge_Snapshot.md` remain unprovided — see O-1.

**Decision recommended to Alexander:** register for $500 credits regardless; commit to Track 1 only if you can protect 30h/week without breaking Cemex/Žihle critical path; otherwise treat hackathon as forcing function to ship ADK agent layer that doubles as Cemex demo asset.

---

## 2. Asset Inventory (verified, with maturity)

| Asset | Maturity | Production evidence | Hackathon reuse value |
|---|---|---|---|
| **MCP Server v1.0** — 9 tools (`otskp`, `urs`, `calculator`, `classifier`, `document`, `budget`, `breakdown`, `advisor`, `norms`) | **Production** | `app/mcp/server.py` 95 LOC; ~2,327 LOC across 9 tool files; `tests/test_mcp_compatibility.py` (9 tools verified); OAuth 2.0 + PKCE for Claude.ai / ChatGPT (PRs #1151, #1156, #1159) | **High.** This IS the tool layer the agent calls. Nothing to rebuild. |
| **OAuth 2.0 client_credentials + PKCE flow** | **Production** | RFC 9728 protected-resource metadata, X-Forwarded-Proto handling, CORS for claude.ai/chatgpt.com (PRs #1156-#1160) | **High.** Already certified pattern for two LLM clients; ADK auth wiring is the same model. |
| **Vertex AI Gemini Flash integration** | **Production, scoped** | Used in `scenario_b_generator.py`, `section_extraction_engine.py`, `audit_service.py` (Claude path), `document_search_router.py`. Fixed prompts, no agentic loop. | **High.** Gemini Flash is Google's preferred model; agent's reasoning engine can reuse same auth + client wrapper. |
| **7-engine deterministic calculator** | **Production** | `Monolit-Planner/shared/src/calculators/` 44 TS files: scheduler, bridge-technology, calendar, exposure-combination, formwork, concreting, batchCalculator. 1,088 vitest passing. No LLM calls inside. | **High as a tool, zero as an agent.** Calculator exposed via `calculator` MCP tool already. |
| **Document parsing pipeline** | **Production** | 14 parser files (universal, smart, PDF/MinerU, XLSX in 4 dialects, KROS XML, XC4, format_detector). End-to-end verified on Žihle TZ. | **High.** Already wrapped as `document` + `budget` MCP tools. |
| **Multi-role expert system (4 roles SME/ARCH/ENG/SUP)** | **Production, NOT agentic** | `audit_service.py` — fixed consensus algorithm, GREEN/AMBER/RED + HITL triggers. Not LLM-driven orchestration. | **Medium.** Can be re-framed in the demo as "multi-perspective audit step" the agent triggers. |
| **Žihle Most 2062-1 pilot** | **Complete** | `test-data/most-2062-1-zihle/` — 4 phases populated (Extraction → Design 6 variants → Calculation Gantt+XLSX → Documentation OTSKP/XML/XLSX). Real ZD, real numbers (10.59M Kč, 154 položek, 6 SO). | **Critical.** This is the demo. Re-run live in demo video with agent autonomy on top. |
| **CI/CD on Cloud Run + Cloud Build** | **Production** | 8 GitHub Actions workflows including `test-mcp-compatibility.yml`; 6 `cloudbuild-*.yaml` files; auto-deploy on master push | **High.** Hackathon agent service deploys via existing pipeline pattern. |
| **Czech construction KB** (42 JSON files, ~40MB, OTSKP 17,904 codes + ÚRS + ČSN norms) | **Production** | `concrete-agent/.../knowledge_base/` + `kb_loader.py`; norms search via Perplexity fallback | **Critical for the moat.** This is what no Gemini Enterprise launch partner has. |
| **Multi-step autonomous orchestration** | **DOES NOT EXIST** | Grep confirms: no `agent_loop`, no LLM-driven tool routing. Workflows A/B are fixed sequences. | **This is what the hackathon submission must add.** |
| **Existing GCP infra** ($1K Vertex AI budget, Cloud SQL, Artifact Registry, Cloud Build) | **Production** | `cloudbuild-*.yaml` × 6; SA `1086027517695-compute@developer.gserviceaccount.com` | **High.** Adds $500 credits on registration. |

**Repository naming gap:** The brief cites these as required inputs — none found under those names:
- `STAVAGENT_Project_Knowledge_Snapshot.md` (closest: `docs/STAVAGENT_PROJECT_KNOWLEDGE_2026_05_07.md` — different format)
- `STAVAGENT_Master_Brief.md` (closest: `concrete-agent/docs/MASTER_PLAN.md`)
- `STAVAGENT_Competitive_Landscape_Cemex_CSC.md` / `_RU.md` (closest: `concrete-agent/docs/COMPETITIVE_ANALYSIS_RozpocetPRO.md` part 1 + 2 — not Cemex-focused)
- `STAVAGENT_DACH_Addendum.md` — not found
- `TASK_MCP_Server_AllModules.md` / `_Deploy_Auth_Billing_Listings.md` / `_PricingSync_FastMCPMount.md` / `_SchemaEnrichment_GoldenValidation.md` — not found

**This is open question O-1.** Either provide the docs or the analysis stands on what's in the repo.

---

## 3. Track Requirements vs Existing Assets

Per Google Cloud Blog 1 (canonical track descriptions, exact wording):

| Track | Google's wording | What it actually requires | STAVAGENT fit | Effort gap (hours) |
|---|---|---|---|---|
| **1 — Build** | *"architect a net-new autonomous agent… move from static code to declarative intent… use MCP to securely connect to external tools, gather context, and execute tasks autonomously"* [Devpost] | New agent on ADK / LangChain / CrewAI (all three **explicitly named** in Devpost text); MCP for external tools mandatory; LLM-driven decision making not hardcoded sequences | **Strong.** Existing 9 MCP tools = tool layer. Build thin ADK agent on top using Gemini Flash for orchestration. Both Variant A and Variant B fit. | **~90–130 h.** See §6 (Variant A) and §11 (Variant B) for two scopings. |
| **2 — Optimize** | *"bring your existing experimental agent and use our new optimization tools… stress-test multi-step reasoning, debug stalled logic, programmatically refine your system instructions"* [Devpost] | A pre-existing agent with edge-case failures + the optimization tooling Google provides | **Poor.** No existing agent in repo to optimize. The wording *"stress-test multi-step reasoning"* and *"debug stalled logic"* assumes an LLM-driven agent loop already exists — STAVAGENT has none. | N/A — false start. |
| **3 — Refactor for Marketplace** | *"take your current, functional agents and refactor their architecture… transform an MVP into a scalable, monetizable asset prepped for listing on the Google Cloud Marketplace and within Gemini Enterprise"* [Devpost] | Functional agent already exists + Marketplace listing prep + "Google Cloud Ready – Gemini Enterprise" 4-step cert (functionality, output accuracy, autonomous execution, enterprise standards) [Source 3] | **Mismatch on prerequisite.** Devpost wording *"current, functional agents"* and *"MVP"* both presume the agent already exists. STAVAGENT has the MCP tool layer ready but not the agent. Cert is a multi-week enterprise process. | **~250+ h** plus calendar weeks of Google review. Infeasible in 21 days. Right move for 2027 after Variant B has established the MCP-infrastructure narrative. |

**Definition of "agent" Google uses** [Source 3]: *"autonomous systems that execute complex, end-to-end tasks combining deep context and memory, intelligent orchestration, and safe tool use"* — explicitly NOT passive chatbots or rigid workflows. The Devpost text adds *"agent that doesn't just respond, but acts"* and *"move from static code to declarative intent"* — both reinforcing the autonomous-reasoning requirement. This rules Track 2 out and reinforces Track 1.

**Framework support — now officially confirmed by Devpost text**: ADK is Google's first-class framework, with **LangChain and CrewAI explicitly named as accepted alternatives** ("the Agent Development Kit (ADK)—or your preferred open-source framework like LangChain or CrewAI"). MCP is *required* in Track 1 wording. A2A protocol mentioned for Marketplace [Source 3]. This removes the earlier "LangChain unverified" caveat and makes R10 (framework neutrality demo in Variant B) lower-risk.

---

## 4. Competitive Analysis

### 4.1 Gemini Enterprise launch partners (40+ named) [Source 3]

**Zero are in construction, AEC, civil engineering, preconstruction, or cost-estimation.** Closest adjacencies: Watershed (sustainability/ESG), Industrility (manufacturing aftersales), Stord/Manhattan/Pluto7 (supply chain). Saturated verticals: cybersecurity (5), sales/CRM (4), HR (2), IT ops (4), marketing (4), financial services (4), supply chain (6), healthcare (4), dev tools (3).

**Implication:** STAVAGENT would be the **first AEC agent in the Gemini Enterprise ecosystem** — a defensible Innovation 20% angle even with a relatively thin agentic layer because judges pattern-match against repetitive verticals.

**Caveat:** Devpost public registry of submissions is gated (goo.gle/486nbl4 → 403 anonymous). Density of construction entries inside the hackathon itself is unverifiable until registration; expected outcome: very few or none.

### 4.2 Broader preconstruction-tech competitive structure (from `STAVAGENT_Competitive_Landscape_Cemex_CSC.md`)

The hackathon submission lives inside a 5-tier market structure. None of the five tiers occupies STAVAGENT's exact slot (multi-vendor AI co-pilot, CZ/SK regulatory compliance, end-to-end document→bid→schedule):

| Tier | Examples | What they do | What they don't do — STAVAGENT's wedge |
|---|---|---|---|
| 1 — Vendor calculators | Rigips Profikalkulátor, DOKA Tipos 9 / Easy Formwork Planner, PERI CAD + apps, Hilti PROFIS | Free, polished, single-catalog leadgen tools | Single vendor only; user re-keys output into KROS by hand |
| 2 — AI tender/bid-response | AItenders (FR), mytender.io (UK), AI TENDERINGMANAGER (DE), Brainial, Document Crunch | Read RFP, extract requirements, draft proposal | Stop at proposal — no priced BoQ in ÚRS/OTSKP, no crew, no schedule |
| 3 — Regional BoQ incumbents | **KROS 4 (~13,500 CZ licenses)**, Callida euroCALC, RTSrozp; BKI / STLB-Bau / SIRADOS / NPK in DACH | Catalog-bound položkový rozpočet, ZZVZ-compliant | Zero AI extraction; manual item picking; no production engineering |
| 4 — 5D BIM enterprise | RIB iTWO 4.0 / iTWO costX (Schneider Electric €1.4B), Kreo (UK), Trimble | Model-based 5D BoQ, BIM-driven | Requires BIM-mature workflow; enterprise pricing; SMB inaccessible |
| 5 — AI field execution | **Trunk Tools ($70M Ser A+B)**, Procore, Buildots | Post-tender field AI: RFI / submittal / schedule Q&A | Post-tender only; not the estimator workflow |

**Two competitor references the submission MUST cite for credibility:**
- **Trunk Tools** — $70M raised on the "vertical AI for construction" thesis (post-tender side). Validates investor conviction in the category. STAVAGENT positions as **same thesis applied to the preconstruction side** — the slot Trunk Tools deliberately doesn't fill.
- **KROS 4** — the incumbent STAVAGENT must coexist with. ~13,500 paid CZ licenses; the submission must explicitly say "we feed KROS, we do not replace KROS" to be credible to construction-industry judges.

**Implication for Innovation 20% scoring:** the agent narrative isn't just "construction is unserved in Gemini Enterprise" — it's also "the closest analog (Trunk Tools at $70M) operates the opposite phase of the same workflow; this submission completes the picture." Two-step credibility frame.

### 4.3 DACH adjacency note (from `STAVAGENT_DACH_Addendum.md`)

The DACH market is structurally different (GAEB X81–X86 mandatory data exchange, STLB-Bau gov-mandated since 1998, BKI/SIRADOS catalogs, DIN 276 cost groups) and entry is a 6–12 month investment in catalog/format adaptation. **This is explicitly out of scope for the 3-week hackathon runway** — the submission proposes a CZ/SK-grounded agent with DACH as a roadmap slide, not implemented surface. Mentioned because if Cemex CSC follow-up surfaces a Cemex Deutschland angle (Cemex is a large DE ready-mix player), the agent's MCP-tool architecture is the right substrate for adding GAEB intake/emit as additional tools later.

---

## 5. Track Choice + Rationale

**Recommendation: Track 1 — Build a Net-New Agent.**

**Reasoning chain:**
1. STAVAGENT's core competence is **engineering correctness via deterministic pipelines + a Czech KB moat**. The hackathon scores Innovation 20% + Technical 30% — both reward genuine agentic autonomy more than additional deterministic pipeline polish (which Track 2 would optimize toward).
2. The 9 MCP tools already cover the entire tool-surface a tender-analysis agent needs (parse documents, classify elements, calculate concrete works, search norms, advise). Adding the autonomous layer is **net-additive**, not a rewrite — preserves STAVAGENT's deterministic-first philosophy where the agent's job is to *decide* which deterministic tool to call, while the tools themselves remain deterministic.
3. Track 3 would be the right ambition for Q3/Q4 2026 (after Cemex CSC pitch closes and Žihle tender ships), but the Marketplace + Gemini Enterprise cert is a multi-week enterprise process that **cannot complete in 21 days**.
4. Track 2 fails the precondition gate ("existing prototype agent with edge cases" — none exists).

**What this means in plain terms for the submission:** the agent is a thin ADK + Gemini 2.5 Flash orchestrator that, given a Czech tender package (TZ + výkres + soupis), decides on its own which MCP tools to call, in what order, with what parameters, to produce a complete cost estimate with audit trail and reconciliation against the user's manual numbers. STAVAGENT-the-platform stays exactly as it is; the new layer is the "brain" deciding which existing capability to invoke.

---

## 6. Submission Theme Spec

### Agent name
**StavAgent Přípravář** — autonomous Czech/Slovak tender analyst.

Working alternative for English audiences: **"BidScout for Civil Construction"**. Final name to be picked by Alexander.

### One-line description
*"An autonomous AI estimator that reads a Czech/Slovak public tender (technical report + drawings + bill of quantities), decides which engineering and pricing tools to invoke, and produces a complete cost estimate with audit trail, gap report, and reconciliation against the user's manual numbers."*

### Target user
Czech and Slovak D&B contractor's **přípravář (preparation engineer) / rozpočtář (estimator)** working on public tenders in the 5–100M Kč range. Concretely: the persona who currently spends 40–80 hours building a tender response in KROS / Kalkulus / RTS BUILDpower and would prefer to spend that time on engineering judgment, not data entry.

### Business problem solved
- **Žihle Most 2062-1 evidence (pilot):** 154 položek across 6 SO, 10.59M Kč without VAT, 100% audit-trail coverage, 16 reconciliation flags vs user manual SO_201_JŠ.xls, 4 explicit ZD §4.4.l exclusions, completed in 4 phases — equivalent manual work is ~40–80 person-hours. [Source: `test-data/most-2062-1-zihle/00_PROJECT_SUMMARY.md`]
- **Market opportunity:** Czech/Slovak public construction tenders. KROS alone has **~13,500 active commercial licenses + ~3,700 educational** in CZ — i.e., the de facto national standard [Source: `STAVAGENT_Competitive_Landscape_Cemex_CSC.md` §3.1]. Currently served by KROS, Callida euroCALC, RTSrozp — **none AI-native**.
- **Why an agent (not a feature in an existing tool):** the closest precedent is Trunk Tools, which raised $70M on the "vertical AI for construction" thesis but deliberately operates the *post-tender field* side. AItenders (FR) and mytender.io (UK) read tender documents but stop at proposal text. **No tool in the market today decides autonomously, end-to-end, what to extract → classify → price in ÚRS/OTSKP → cross-validate against soupis → flag reconciliation gaps.** KROS prices what the user types; this agent decides what to type.
- **Positioning frame the submission must hold (per `STAVAGENT_Competitive_Landscape_Cemex_CSC.md`):** "AI layer on top of regional incumbents, multi-vendor neutral." STAVAGENT feeds KROS via XLS / uniXML export — it does not displace it. This frame survives Czech construction-industry scrutiny *and* the Cemex CSC pitch 23 days later.

### Agentic behavior (this is the Technical 30% story)
The agent, when given a tender package, autonomously:
1. **Triages** the document pack — identifies which files are TZ, soupis, výkres, statika, ZD podmínky (decision: which document parsing tool to call first).
2. **Routes** each document to the appropriate MCP tool (`document.analyze` for TZ, `budget.parse` for soupis, `classifier` per item).
3. **Detects gaps** — if soupis line missing material spec, calls `norms.search` to find applicable ČSN/TKP rule, decides whether to ask the user or assume default.
4. **Cross-validates** — runs `calculator` on extracted geometry, compares against soupis quantity, flags mismatches >10% as reconciliation items.
5. **Iterates** — re-reads TZ section for any flagged item before finalizing; this is the part with the actual LLM-driven loop and is the Innovation 20% story.
6. **Produces** audit-traceable output: every number has formula + inputs + sources + confidence.

All five steps are LLM-decided (which tool, in what order, with what parameters). The tools themselves remain deterministic.

### Tech stack
- **Reused from STAVAGENT (no modification):** 9 MCP tools as-is; OAuth 2.0 + PKCE flow; Cloud Run deploy infra; Czech KB; calculator engines; document parsers; Žihle demo data
- **Built new for the hackathon:** thin ADK agent service (single Cloud Run service); Gemini 2.5 Flash as reasoning LLM (also fits Google's Gemini-centric preference); audit-trail viewer (web UI surface to make the agentic decision tree visible in the demo video — judges need to *see* autonomy)
- **Explicitly not built:** any new deterministic engine, any new parser, any new calculator logic, any DB migration

### MCP integration story
The agent is an MCP client connecting to the existing STAVAGENT MCP server (`/mcp` endpoint, already live). This satisfies the "MCP for external tools" requirement in Track 1 *natively*, without contrivance — the agent and the tool layer are physically separate services and physically connected via MCP protocol. This is more compelling than most "MCP integrations" judges will see, where MCP is bolted on to satisfy the rubric.

### Demo scenario (50/50 technical / business framing per Alexander's choice)
**Live re-run of the Žihle Most 2062-1 tender on camera.** Two columns side-by-side in the video:
- **Left (business / 50%)** — the agent's outputs in plain Czech: extracted TZ sections, classified SOs, calculated quantities, gap report (Povodí Vltavy souhlas missing, 4 §4.4.l exclusions), final 10.59M Kč master soupis vs user manual JŠ.xls reconciliation
- **Right (technical / 50%)** — the agent's autonomous decision log: "I see PDF, calling document.analyze → got TZ with prestressed deck → calling classifier on SO 201 → routing to calculator for mostovkova_deska — wait, span not in TZ → calling norms.search for ČSN 73 6200 — found span constraint — re-reading TZ section 3.2 — got 7.5m — calling calculator → cross-checking against soupis line 31 → reconciliation OK"

The demo's narrative weight is the **comparison: 40 hours manual → 8 minutes autonomous**.

---

## 7. Three-Week Implementation Plan

**Total budget:** 90–120 hours of Alexander's time at 30–40h/week. Plan assumes 35h/week as midpoint.

| Week (calendar) | Goal | Concrete deliverables by end of week | Parallel-priority impact |
|---|---|---|---|
| **Week 1 — May 16–22** | Foundation: ADK agent skeleton talks to existing MCP server end-to-end | (a) Register on Devpost, claim $500 credits. (b) ADK installed locally, hello-world agent calling one MCP tool authenticated via existing OAuth flow. (c) Agent prompt v1 with tool-routing logic for Žihle Phase A (Extraction only). (d) First end-to-end smoke run: feed Žihle TZ PDF, agent autonomously extracts and outputs structured YAML. | **Cemex CSC pitch (Jun 28):** zero impact this week, deck prep can defer to Wk 2. **Žihle tender (Jul 2):** zero impact. **MCP P0 (cross-user isolation):** zero impact, this work is additive on top. |
| **Week 2 — May 23–29** | Full pipeline + reliability: agent handles all 4 Žihle phases autonomously | (a) Agent prompt v2 covering Extraction + Design + Calculation + Documentation. (b) Audit-trail JSON output structured for demo-video left column. (c) Error handling for tool failures (LLM-driven recovery, not hardcoded retries). (d) Cross-validation step (calculator vs soupis ≥10% Δ flagging). (e) Audit-trail viewer UI (minimal — single HTML page consuming the JSON; reuses Portal's flat-style tokens). | **Cemex CSC deck:** start drafting Wk 2 weekend, low conflict. **Žihle tender:** still untouched (no new D&B engineering work needed). **Risk:** Libuše Phase 7a/8 paused for ~10 days. |
| **Week 3 — May 30 – June 5** | Submission: demo video + written submission + polish | (a) Demo video script (2 columns: business outputs + agent decision log). (b) Demo video recorded on the live deployed agent at custom domain. (c) Devpost submission written — sections: technical (ADK + MCP + Gemini Flash), business case (Žihle numbers + market size + KROS-incumbent positioning), innovation (AEC vertical gap), demo embed. (d) Submission June 5 with ≥24h buffer. | **Cemex CSC:** Wk 3 can absorb 10h on deck since the Google demo *is* the Cemex demo. **Žihle tender:** must reserve last weekend for tender finalisation if Google submission overruns — explicit fallback plan needed. |

**Critical constraints surfaced by this plan:**
- **No Cemex/Žihle blocker.** The hackathon work is net-new agent layer on top of existing tools. It does not modify any code path Žihle tender or Cemex pitch depends on.
- **Libuše Phase 7a/8 slips ~2 weeks.** This is the explicit trade-off and Alexander needs to accept it.
- **Buffer.** ≥24h before deadline on June 5 is non-negotiable. If Wk 2 ends with agent failing on Žihle Phase C, scope down to Phases A+B and ship the smaller demo.

---

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **ADK API instability** — ADK was first-classed at Next '26 (April 2026); API surface may change mid-hackathon, breaking the agent. | Medium | High (rebuild) | Pin ADK to specific version at Wk 1 start; if instability hits, fall back to LangChain — LangChain not explicitly named by Google but is the most-cited agentic framework outside ADK, judges will not penalize. |
| **R2** | **Eligibility gate failure** — STAVAGENT's legal entity status (incorporated s.r.o. / sole proprietor OSVČ / pre-incorporation) may not satisfy Google's eligibility. **Update 2026-05-15: Alexander has submitted the registration; Devpost auto-reply "You will receive an email when approved" confirms application is in queue. Approval is pending, not granted.** | Medium → Low (pending email) | Critical (DQ) | Monitor inbox for Devpost approval. If approval is delayed >5 days, email `dani@devpost.com` (challenge contact). If denied, claim $500 credits anyway and use the work as Cemex CSC asset only. |
| **R3** | **IP / usage rights** — Google may claim non-exclusive license to submission content. Standard hackathon clauses can conflict with future Cemex contract terms where Cemex expects exclusivity over derivative IP. | Medium | High (legal) | Read Devpost rules at registration. Submit only the **agent layer source** (new code written for the hackathon), not the existing STAVAGENT codebase. The agent calls STAVAGENT-the-platform as an external MCP server; the platform itself is not part of the submission package. |
| **R4** | **Demo failure on live recording** — Žihle data is real and complex; Gemini Flash may hallucinate Czech construction term, agent loop may not terminate. | High | Medium (re-record) | Two mitigations: (a) Wk 2 produces a deterministic-replay fixture for the exact Žihle case so the demo is reproducible; (b) record one "live" video and one "scripted" video — submit live if it works, scripted as fallback. Judges will accept scripted demos. |
| **R5** | **Time conflict with Cemex CSC pitch (Jun 28)** — if Wk 3 overruns into Wk 4, Cemex deck has only 23 days and no buffer. | Medium | Critical (revenue) | Hard stop on hackathon work at June 5, 23:59 — no post-deadline polish. Cemex deck starts Wk 2 weekend in parallel. The submission demo doubles as Cemex demo, reducing net Cemex work. |
| **R6** | **Cross-user isolation P0 leak** — the in-flight MCP cross-user isolation work (currently P0 unresolved) could surface a security issue in the public demo agent if it shares Cloud SQL connection pool with multi-tenant Portal. | Low | High (security disclosure) | Demo agent uses a separate Cloud Run service + dedicated SA + read-only DB user; cannot mutate Portal data. Explicitly out-of-scope: any agent action that writes back to Portal during the hackathon. |
| **R7** | **Repositioning conflict with Cemex CSC** — submission portrays STAVAGENT as "Czech tender estimator agent". If Cemex wants positioning as "concrete supplier integration platform", these frames could conflict. | Low | Medium (rework) | The Cemex CSC competitive-landscape analysis (cited by Alexander but not found in repo — Open Q O-1) likely has the answer. Until that doc is available, the recommended frame is "STAVAGENT is the AI estimation layer; Cemex CSC is the concrete-supply integration"; the two are complementary verticals on the same platform. |
| **R8** | **Gemini 2.5 Flash quota / cost overrun during 3 weeks** — agent will burn tokens fast in iteration. Existing $1K Vertex AI budget could exhaust mid-Wk 2. | Medium | Medium (work stalls) | Claim hackathon $500 credits Wk 1 Day 1. Set Vertex AI budget alert at $500 / $750 / $900 mark. Use Gemini Flash (cheaper) not Pro for orchestration; reserve Pro for the final demo recording. |

---

## 9. Cemex CSC Synergy / Conflict Analysis

The Cemex CSC pitch deadline is **June 28, 2026** — 23 days after the hackathon submission. The hackathon work directly **strengthens** all three positioning angles already proposed in `STAVAGENT_Competitive_Landscape_Cemex_CSC.md` §"Implications for the Cemex CSC pitch", and creates one manageable conflict.

### 9.1 Map of three positioning angles ↔ hackathon submission

| Cemex CSC angle (from competitive landscape doc) | How the Google submission reinforces it |
|---|---|
| **Angle 1 — "Neutral aggregator."** Cemex's CSC partner watchlist (Ferrovial, VINCI Leonard, Hilti, Trimble) favors partners who distribute producer catalogs without locking customers in. | The agent's MCP architecture is *natively* multi-vendor: it can call `find_otskp_code`, `find_urs_code`, and (future) `cemex_catalog_lookup` interchangeably. The submission demo can include Cemex's concrete-grade catalog as a tool the agent picks autonomously when classifying ready-mix items — proves the neutrality claim with a live workflow, not a slide. |
| **Angle 2 — "AI layer on top of regional incumbents."** STAVAGENT feeds KROS / BKI / BEDEC, doesn't replace them. | The agent's final step in the Žihle demo is **XLS / uniXML export to KROS format**. Showing the agent autonomously producing a KROS-ingestible artifact closes the "but how does my team actually use this" objection from both judges and Cemex's GC audience. |
| **Angle 3 — "SMB AI vs. enterprise BIM."** Trunk Tools at $70M validated vertical AI; RIB iTWO at €1.4B validated enterprise; the SMB segment is uncovered. | The agent is deliberately designed for the 5- to 50-person přípravář shop that cannot afford iTWO and cannot wait for a BIM model. The Žihle case (a real SÚSPK D&B tender) is precisely this user. One demo serves both narratives. |

### 9.2 Direct reusable assets from Google submission for Cemex deck

- Demo video (1:1 reuse — same Žihle workflow, same artifact)
- Žihle 10.59M Kč master soupis + 16-flag reconciliation report (both audiences want real numbers)
- Agent decision-log visualization (Cemex IT will value seeing the "brain" structure, not just the output table)
- Architecture diagram (agent → MCP server → 9 tools → Czech KB → KROS-compatible export)
- Two slides in the Google submission write-up are 1:1 reusable as Cemex deck slides:
  - **"The estimator's day today vs with STAVAGENT"** (already in §"Implications for Cemex CSC pitch")
  - **"Trunk Tools at $70M validates vertical AI — STAVAGENT does the same for preconstruction"**
- Market-gap slide (zero AEC partners in Gemini Enterprise launch — fresh data point not in the existing Cemex competitive landscape doc)

### 9.3 Conflict items to neutralize

- **Vertical width.** Devpost submission claims a single vertical (civil construction estimating); Cemex pitch wants STAVAGENT positioned as a broader concrete-supply integration partner. Resolve by saying in Devpost: "tender estimation agent for civil construction"; saying in Cemex deck: "STAVAGENT is the estimation layer; Cemex CSC concrete catalog is the supply layer; both share the same MCP-native agent foundation." Same product, different audience slice.
- **DACH expansion timing.** The `STAVAGENT_DACH_Addendum.md` notes Cemex Deutschland is a major DE ready-mix player and that DACH adaptation is 6–12 months of GAEB/STLB/DIN work. Do NOT promise DACH in the Devpost submission (out of scope, out of timeline). DO mention it in the Cemex deck as a 12-month roadmap item conditioned on partnership.

---

## 10. Open Questions for Alexander

Decisions required before starting Week 1:

| # | Question | Why it blocks start | Who answers |
|---|---|---|---|
| **O-1** | ~~Strategic source documents not in repo.~~ **PARTIALLY RESOLVED**: `STAVAGENT_Competitive_Landscape_Cemex_CSC.md` and `STAVAGENT_DACH_Addendum.md` provided directly and integrated into §3 / §6 / §9. Still missing: `STAVAGENT_Master_Brief.md`, `STAVAGENT_Project_Knowledge_Snapshot.md`, four `TASK_MCP_*.md` documents. Confirm whether these exist elsewhere (Drive / chat / older repo branch) or whether `MASTER_PLAN.md` + the MCP context inside CLAUDE.md are the authoritative substitutes. | Affects only completeness of provenance trail, not the analysis conclusions. | Alexander — confirm or attach |
| **O-2** | ~~Legal entity status for Google for Startups eligibility.~~ **PARTIALLY RESOLVED**: Alexander has submitted the Devpost application; approval is pending. Confirm by inbox what entity form Alexander declared during registration, so that the Cemex deck and any contract follow-ups are internally consistent. | Risk R2 mostly retired pending the approval email. | Alexander — confirm declared entity form |
| **O-3** | Agent name — "StavAgent Přípravář" (Czech-native) or "BidScout for Civil Construction" (English-native)? Or other? | Affects branding consistency between hackathon and Cemex deck. | Alexander |
| **O-4** | Demo video language — Czech with English subtitles, or English with Czech subtitles, or fully English? Judges are global; primary user is Czech. | Affects video production time (Wk 3 budget). | Alexander |
| **O-5** | Acceptable Libuše Phase 7a/8 slip — is 2-week delay OK, or is there a hard date there that conflicts? | Determines whether the 35h/week budget is achievable. | Alexander |
| **O-6** | Comfort with Track 1 vs preference to register-only for $500 credits and skip submission? | The full submission is 90–120h. Register-only is ~2h. Trade-off is Innovation positioning vs guaranteed revenue from Cemex. | Alexander |
| **O-7** | If submission goes ahead, what is the agent's repository structure decision — separate new repo (`stavagent-agent-hackathon`) submitted to Devpost, with existing STAVAGENT as external MCP server, or in-repo branch? | Affects R3 (IP scope) and ongoing maintenance. Recommended: separate repo, cleanly scoped. | Alexander |
| **O-8** | Devpost-rules items now partially confirmed by the official challenge page: $60K cash + $37.5K credits + $500 universal credits, deadline June 6 02:00 GMT+2, ADK / LangChain / CrewAI accepted, contact `dani@devpost.com`. **Still unknown:** per-track prize split, demo video length / format, code repo public-vs-private requirement, whether multi-track entries are allowed, written-submission length cap. To verify in Devpost rules tab once application is approved. | Day-1 task after approval email. | Alexander after approval |

---

## Sources cited

1. Google Cloud Blog — "Startups are building the agentic future with Google Cloud" — <https://cloud.google.com/blog/topics/startups/startups-are-building-the-agentic-future-with-google-cloud>
2. Google Cloud Blog — "The top startup announcement from Next '26" — <https://cloud.google.com/blog/topics/startups/the-top-startup-announcement-from-next26>
3. Google Cloud Blog — "Partner-built agents available in Gemini Enterprise" — <https://cloud.google.com/blog/products/ai-machine-learning/partner-built-agents-available-in-gemini-enterprise>
4. Devpost registration — <https://goo.gle/486nbl4> (gated, requires registration for per-track rules and eligibility specifics)
5. STAVAGENT repo — `CLAUDE.md`, `concrete-agent/packages/core-backend/app/mcp/`, `Monolit-Planner/shared/src/calculators/`, `test-data/most-2062-1-zihle/`, `.github/workflows/`, `cloudbuild-*.yaml` (verified 2026-05-15)
6. `STAVAGENT_Competitive_Landscape_Cemex_CSC.md` — 5-tier preconstruction-tech landscape; KROS license count; Trunk Tools / iTWO / Kreo / AItenders profiles; three Cemex positioning angles (provided directly, dated 2026-05-15)
7. `STAVAGENT_DACH_Addendum.md` — DACH catalog stack (BKI / STLB-Bau / SIRADOS / Heinze); AVA software tier (SIDOUN / AVA.relax / NEVARIS); AT (ÖNORM) and CH (NPK) specifics; GAEB X81–X86 entry requirement (provided directly, dated 2026-05-15)
8. `STAVAGENT_Master_Brief.md` — triple-access architecture (UI + MCP + REST API); 7-engine pipeline depth (DIN 18218, Saul, RCPSP, PERT); Cemex Top 50 Contech 2026 direct competitors (Aitenders, Togal.AI, Buildcheck, ConCntric, Datagrid, SmartPM); Alice Technologies complementary positioning; Layer 2 narrative for the "engineering ground truth" framing in §11 Variant B (provided directly, dated 2026-05-04)
9. **Devpost official challenge page text** — provided directly by Alexander 2026-05-15. Confirms: prize structure ($60K cash + $37.5K credits + non-cash perks + $500 universal credits), deadline June 6 02:00 GMT+2, ADK / LangChain / CrewAI explicitly accepted, MCP required in Track 1, contact `dani@devpost.com`, Alexander's registration submitted and pending approval. Per-track prize split and submission-format constraints still not disclosed in this text.

---

---

## 11. Variant B — Creative Alternative: "Engineering Ground Truth Infrastructure"

This section is an alternative to §6 (Submission Theme Spec) for Track 1. It was added after the `STAVAGENT_Master_Brief.md` confirmed STAVAGENT's triple-access architecture (UI + MCP + REST API) and crystallized the "agents need engineering ground truth, LLMs hallucinate construction" framing. Variant A (§6) and Variant B share runway, risks, and Cemex synergy — they differ only in narrative center of gravity and the depth of the demo.

### 11.1 Re-framing

**Variant A** says: "I built an agent that processes Czech tenders."
**Variant B** says: "I built the MCP infrastructure every construction-AI agent will need. Here is one agent using it as a demonstration; here are three more clients using it in parallel; here is what happens when an LLM does not use it."

The shift is from *"agent as product"* to *"infrastructure as product, agent as demonstration"*. This is the same architectural move Anthropic and Google have been advocating in 2026: build the substrate, not yet another wrapper. Judges from the Google Cloud agentic team will recognize this framing.

### 11.2 Agent name and one-line

Working name: **"STAVAGENT — Engineering Ground Truth for AI Agents in Construction"**.

One-line: *"The MCP server that prevents construction AI hallucination — 9 deterministic engineering tools (DIN 18218 formwork pressure, Saul concrete maturity, RCPSP scheduling, multi-vendor catalog lookup) callable by Claude, GPT, Gemini, or any MCP-aware agent, demonstrated on a real €420k Czech bridge tender."*

### 11.3 Agentic behavior in the demo

The demo has **four parallel agent clients** consuming the same MCP server, plus **one control case without it**:

1. **Claude Desktop** (existing OAuth wiring) — asks a Czech-language question about Žihle deck design; Claude routes to STAVAGENT MCP and returns engineering-grounded answer
2. **Custom GPT** in the GPT Store (existing — already submitted per Master Brief §1.5) — same question, same correct answer via MCP
3. **ADK + Gemini Flash agent** (the net-new build for this hackathon) — autonomously processes the full Žihle tender end-to-end, like Variant A but framed as one client of the infrastructure
4. **LangChain agent** (optional, 1 day of work) — same question, same correct answer — proves the MCP server is framework-neutral
5. **Control: GPT-4o standalone, no MCP** — same question — returns hallucinated DIN 18218 pressure value, mis-identifies element type, recommends wrong formwork system

This is the technical 30% story: not "one agent doing autonomous reasoning" but "an infrastructure layer that makes *every* agent doing autonomous reasoning correct in this vertical". Judges have not seen this framing.

### 11.4 Demo scenario (revised from §6)

Three parts, ~3 minutes total:

**Part 1 — The infrastructure (30 seconds).** Architecture diagram: MCP server in the middle, 9 tools spokes, 4 different LLM clients connected on the outside, deterministic engineering KB underneath. One sentence: *"This already exists in production. Czech tax-paying, OAuth-certified for Claude.ai and ChatGPT, billing live."*

**Part 2 — The contrast (60 seconds).** Side-by-side terminal: GPT-4o vanilla vs GPT-4o through STAVAGENT MCP, same prompt about Žihle mostovková deska. Vanilla hallucinates pressure / class / formwork. MCP-enabled returns DIN 18218 + 7-engine output. The visual is the take-away: *"This is what 'engineering ground truth' looks like."*

**Part 3 — The agent on top (90 seconds).** ADK agent processes Žihle autonomously — split screen, agent decision log on right (which MCP tool it picks and why), business outputs on left (extracted SOs, calculated quantities, 10.59M Kč master soupis, reconciliation flags). End on the final XLS / uniXML export to KROS format. *"This agent is one of many. The infrastructure is the product."*

### 11.5 Tech stack

- **Reused unchanged from STAVAGENT:** 9 MCP tools, OAuth + PKCE, Cloud Run deployment, billing, calculator engines, Czech KB, Žihle case data
- **Net-new for hackathon:** ADK agent service (single Cloud Run service); Gemini 2.5 Flash as reasoning LLM; minimal HTML page rendering the "split-screen decision log + outputs" for the demo video; the "hallucination vs ground truth" comparison script (~30 LOC)
- **Optional flourishes (only if Week 2 ends with buffer):** LangChain client; one or two A2A-style sub-agents (a Statik validator and an Adversarial auditor) talking to the main ADK agent — but **gated behind a "stretch goal" flag**, not in the critical path

### 11.6 Innovation 20% — three explicit hooks

1. **Vertical gap:** zero AEC partners in Gemini Enterprise launch (§4.1)
2. **Architectural inversion:** MCP server as the hero, not the agent — submission embodies the "infrastructure for agents" thesis Google itself has been advocating
3. **Framework neutrality demo:** same MCP server serving Claude + GPT + Gemini + LangChain in one video — concrete proof that the infrastructure is not bound to one vendor; this is also the Cemex "neutral aggregator" angle (§9.1) visualized

### 11.7 Effort delta vs Variant A

| Item | Variant A | Variant B |
|---|---|---|
| ADK agent (core) | 50–70h | 50–70h (same) |
| Audit-trail UI / split-screen demo page | 15–20h | 20–25h (slightly richer for demo) |
| Hallucination-contrast script | — | 5h |
| Wiring Claude Desktop + Custom GPT for demo (already done in production — just need to script the demo) | — | 5h |
| LangChain client (optional) | — | 8h |
| A2A sub-agents (stretch, not committed) | — | 15–25h if attempted |
| Demo video + written submission | 20h | 25h (one more part to film) |
| **Total committed** | **~90–120h** | **~105–130h** |
| **Total with stretch** | n/a | **up to 155h** |

Variant B's committed scope is ~15h more than Variant A. With 30–40h/week × 3 weeks = 90–120h budget, Variant B fits with no buffer at the high end of Alexander's commitment. Stretch goals are explicitly cuttable.

### 11.8 Why Variant B is the recommendation

1. **It matches the Master Brief's own Layer 2 narrative verbatim.** Section 3.1 of the brief says: *"AI agents need engineering ground truth. LLMs hallucinate construction calculations. STAVAGENT is the deterministic layer agents call when they need formwork pressure or pour cycle, not when they need text generation."* The submission writes itself from this paragraph.
2. **All three Cemex CSC positioning angles (§9.1) become visual demonstrations**, not slide claims:
   - Neutrality → 4 different LLM clients in one video
   - AI layer over incumbents → KROS-format export at the end of the ADK demo
   - SMB AI vs enterprise BIM → Žihle as a real €420k mid-size case
3. **Track 3 future is unlocked.** If Alexander later submits STAVAGENT MCP to Google Cloud Marketplace + Gemini Enterprise (the natural next step), Variant B is the prerequisite narrative — "production MCP infrastructure with multi-client validation." Variant A as "I built an agent" does not naturally transition to Marketplace listing.
4. **Defensible against the "is this really an agent" challenge.** The ADK agent embedded in Part 3 of the demo *is* an autonomous reasoning agent by Google's own definition; the surrounding infrastructure narrative does not weaken that, only amplifies it.
5. **The hallucination-vs-ground-truth contrast is memorable.** Judges watch dozens of submissions; "GPT-4o hallucinated, MCP fixed it" is the kind of 30-second beat that survives the watch pile.

### 11.9 Risks specific to Variant B (delta on §8)

- **R9 — Live LLM contrast may not show clean hallucination on the day.** GPT-4o occasionally guesses right by luck. *Mitigation:* pick the engineering query carefully (DIN 18218 lateral pressure for a tall column is a near-100% miss for vanilla LLMs); record multiple takes; have a fallback prompt list of 5 known-miss queries.
- **R10 — Framework-neutrality claim creates more surface area to maintain.** LangChain client is optional and explicitly stretch. *Mitigation:* if Wk 2 ends behind schedule, drop LangChain — Claude Desktop + Custom GPT + ADK agent is already three clients and proves the claim.
- **R11 — "Infrastructure is the product" framing may confuse judges who pattern-match against agent-as-product submissions.** *Mitigation:* lead the written submission and the video opening with the agent (Part 3 first, then re-frame). Tell the agent story first, infrastructure story second.

### 11.10 Decision for Alexander

Variant A is the safe play. Variant B is the recommended play because it crystallizes the narrative Alexander already wants to use for Cemex CSC and future investor pitches; the hackathon becomes a forcing function that produces three reusable assets (positioning crystallization, multi-client demo video, "ground truth vs hallucination" contrast clip) regardless of whether the submission places. Variant B's additional 15h fits the 30–40h × 3-week budget; the stretch goals (LangChain, A2A sub-agents) are honestly optional and explicitly cuttable.

If Alexander chooses Variant B, §6 stays in the document as the contingency fallback — Variant B can degrade gracefully into Variant A at any point during Week 2 or Week 3 without rework, by simply not filming Parts 1 and 2 of the demo.

---

*End of analysis. No code was written. Implementation begins only on Alexander's explicit go-decision against §10 open questions and §11.10 variant choice.*
