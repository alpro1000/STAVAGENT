# Google for Startups AI Agents Challenge — STAVAGENT Submission Analysis

**Author:** Claude Code session (analytical deliverable, no implementation)
**Date:** 2026-05-15
**Status:** Draft — awaiting Alexander's go/no-go decision
**Reading time target:** 20 minutes

---

## 1. Executive Summary

The hackathon (Google for Startups AI Agents Challenge, deadline **June 5, 2026 — 21 days from today**) offers $90,000 prize pool + $500 Cloud credits per registered team across three tracks: **Build Net-New / Optimize Existing / Refactor for Marketplace**. [Source: Google Cloud Blog 1, 2]

**Honest assessment of STAVAGENT today (verified against repo, not CLAUDE.md marketing copy):**
- ✅ 9 working MCP tools, OAuth 2.0 + PKCE, Cloud Run deployed (`concrete-agent/.../app/mcp/`)
- ✅ 7-engine deterministic TypeScript calculator (`Monolit-Planner/shared/src/calculators/`, ~17K LOC)
- ✅ Multi-format document parsing (14 parser files, Czech-specific, MinerU OCR fallback)
- ✅ Žihle pilot complete end-to-end as production-shape demo case (`test-data/most-2062-1-zihle/`)
- ❌ **No autonomous agent loop in repo.** Zero grep hits for `agent_loop`, `decide_next_step`, LLM-driven tool routing. All workflows are hardcoded Python pipelines (`workflow_a`, `workflow_b`). Multi-role expert system is a fixed 4-role consensus, not autonomous reasoning.

**Per Google's own definition** (Gemini Enterprise blog 3): agents "execute complex, end-to-end tasks" with "deep context and memory, intelligent orchestration, and safe tool use" — explicitly NOT rigid workflows. **STAVAGENT today is a tool provider for agents, not an agent.**

**Recommended track: Track 1 (Build Net-New)** — build a thin ADK + Gemini Flash agent layer that uses the existing 9 MCP tools to autonomously process a Czech construction tender. Track 2 fails the "existing prototype" gate (no agent exists to optimize). Track 3 needs Marketplace + Gemini Enterprise certification (4-step process, weeks of paperwork) which is unrealistic in 21 days alongside Cemex CSC pitch (Jun 28) and Žihle tender (Jul 2).

**Key risk to surface up front:** the strategic source documents Alexander cited in the brief — `STAVAGENT_Master_Brief.md`, `STAVAGENT_Competitive_Landscape_Cemex_CSC.md`, `STAVAGENT_DACH_Addendum.md`, `TASK_MCP_*.md` — **do not exist in the repository under those names**. Either they live outside the repo (chat/Drive) or use different filenames. This document proceeds on what was verifiable; open question §10 asks where to find them.

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
| **1 — Build** | "Build a net-new agent from scratch" | New agent on ADK/LangChain/CrewAI/similar; MCP for external tools; autonomous multi-step reasoning; Gemini-centric stack | **Strong.** Existing 9 MCP tools = tool layer. Build thin ADK agent on top using Gemini Flash for orchestration. | **~80–120 h.** Agent prompt design + ADK wiring + MCP client + audit-trail UI + Žihle demo replay. |
| **2 — Optimize** | "Optimize an existing prototype for production reliability" | Pre-existing experimental agent with known edge-case failures; tooling to harden it | **Poor.** No existing agent in repo to optimize. Claiming the deterministic pipeline IS an agent would not survive technical review (Innovation 20%, Technical 30% both penalized). | N/A — false start. |
| **3 — Refactor for Marketplace** | "Refactor a business-ready agent for potential enterprise distribution on Google Cloud Marketplace and the Gemini Enterprise app" | Functional agent + Marketplace listing prep + "Google Cloud Ready – Gemini Enterprise" 4-step cert (functionality, output accuracy, autonomous execution, enterprise standards) [Source 3] | **Mismatch on prerequisite.** No agent exists yet; cert is a multi-week enterprise process; A2A protocol integration is required for several Marketplace partners. | **~250+ h** plus calendar weeks of Google review. Infeasible in 21 days. |

**Definition of "agent" Google uses** [Source 3]: *"autonomous systems that execute complex, end-to-end tasks combining deep context and memory, intelligent orchestration, and safe tool use"* — explicitly NOT passive chatbots or rigid workflows. This rules Track 2 out and reinforces Track 1.

**Framework support confirmed**: ADK is Google's first-class framework (featured in both Blog 1 and 2); MCP is featured as "fully managed, remote MCP servers"; A2A protocol mentioned for Marketplace. **LangChain / CrewAI are not mentioned in any of the three blogs** — likely accepted via Devpost rules but unverified.

---

## 4. Competitive Analysis (Gemini Enterprise launch partners)

Across all 40+ named Gemini Enterprise launch partners [Source 3], **zero are in construction, AEC, civil engineering, preconstruction, or cost-estimation**. Closest adjacencies:
- Watershed — sustainability/ESG (not estimating)
- Industrility — manufacturing aftersales (not construction)
- Stord — logistics/supply chain
- Manhattan, Pluto7, Devoteam — supply chain

Verticals saturated: cybersecurity (5 partners), sales/CRM (4), HR (2), IT ops (4), marketing (4), financial services (4), supply chain (6), healthcare (4), dev tools (3).

**Implication:** STAVAGENT, as a Czech/Slovak civil-construction tender agent built on the existing MCP tool ecosystem, would be the **first AEC agent in the Gemini Enterprise ecosystem**. This is a defensible Innovation 20% angle even with a relatively thin agentic layer — judges are pattern-matching against repetitive verticals.

**Caveat on competitive intel:** The Devpost public registry of submitted entries is gated by login (goo.gle/486nbl4 returned 403 to anonymous fetch). Density of construction submissions inside the hackathon itself is unverifiable until Alexander registers and inspects the submission gallery. Expected outcome: very few or none, given the broader market gap.

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
- **Market opportunity:** Czech/Slovak public construction tenders ~250B Kč/year. ~3,000 D&B contractor estimators. Currently served by KROS (~50% market share), Kalkulus, RTS BUILDpower — none of which are AI-native.
- **Why an agent (not a feature in an existing tool):** existing tools are deterministic spreadsheet GUIs. An agent that *autonomously decides what to extract, classify, calculate, cross-check, and flag* is a category move that incumbents cannot replicate in a sprint.

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
| **R2** | **Eligibility gate failure** — STAVAGENT's legal entity status (incorporated startup vs sole proprietor / OSVČ) may not satisfy Google's eligibility. Public sources do not disclose specific gates [Source 1, 2 — silent on this]. | Medium | Critical (DQ) | **Verify on Devpost rules page immediately after registration** (Wk 1 Day 1). If eligibility fails, claim $500 credits anyway and use the work as Cemex CSC asset only. |
| **R3** | **IP / usage rights** — Google may claim non-exclusive license to submission content. Standard hackathon clauses can conflict with future Cemex contract terms where Cemex expects exclusivity over derivative IP. | Medium | High (legal) | Read Devpost rules at registration. Submit only the **agent layer source** (new code written for the hackathon), not the existing STAVAGENT codebase. The agent calls STAVAGENT-the-platform as an external MCP server; the platform itself is not part of the submission package. |
| **R4** | **Demo failure on live recording** — Žihle data is real and complex; Gemini Flash may hallucinate Czech construction term, agent loop may not terminate. | High | Medium (re-record) | Two mitigations: (a) Wk 2 produces a deterministic-replay fixture for the exact Žihle case so the demo is reproducible; (b) record one "live" video and one "scripted" video — submit live if it works, scripted as fallback. Judges will accept scripted demos. |
| **R5** | **Time conflict with Cemex CSC pitch (Jun 28)** — if Wk 3 overruns into Wk 4, Cemex deck has only 23 days and no buffer. | Medium | Critical (revenue) | Hard stop on hackathon work at June 5, 23:59 — no post-deadline polish. Cemex deck starts Wk 2 weekend in parallel. The submission demo doubles as Cemex demo, reducing net Cemex work. |
| **R6** | **Cross-user isolation P0 leak** — the in-flight MCP cross-user isolation work (currently P0 unresolved) could surface a security issue in the public demo agent if it shares Cloud SQL connection pool with multi-tenant Portal. | Low | High (security disclosure) | Demo agent uses a separate Cloud Run service + dedicated SA + read-only DB user; cannot mutate Portal data. Explicitly out-of-scope: any agent action that writes back to Portal during the hackathon. |
| **R7** | **Repositioning conflict with Cemex CSC** — submission portrays STAVAGENT as "Czech tender estimator agent". If Cemex wants positioning as "concrete supplier integration platform", these frames could conflict. | Low | Medium (rework) | The Cemex CSC competitive-landscape analysis (cited by Alexander but not found in repo — Open Q O-1) likely has the answer. Until that doc is available, the recommended frame is "STAVAGENT is the AI estimation layer; Cemex CSC is the concrete-supply integration"; the two are complementary verticals on the same platform. |
| **R8** | **Gemini 2.5 Flash quota / cost overrun during 3 weeks** — agent will burn tokens fast in iteration. Existing $1K Vertex AI budget could exhaust mid-Wk 2. | Medium | Medium (work stalls) | Claim hackathon $500 credits Wk 1 Day 1. Set Vertex AI budget alert at $500 / $750 / $900 mark. Use Gemini Flash (cheaper) not Pro for orchestration; reserve Pro for the final demo recording. |

---

## 9. Cemex CSC Synergy / Conflict Analysis

The Cemex CSC pitch deadline is **June 28, 2026** — 23 days after the hackathon submission. The hackathon work directly **strengthens** the Cemex pitch under three conditions, and creates a manageable conflict under one.

**Synergies:**
1. **Same demo, two audiences.** The Žihle live-replay video produced for Devpost is the same artifact Cemex needs to see "what STAVAGENT actually does on a real tender". Save 5–8 hours of Cemex deck demo-prep.
2. **Validated MCP + ADK story.** If Cemex's procurement / IT side asks "does this integrate with our existing systems?", an MCP-native agent answers that question structurally. Cemex's own systems (concrete dispatch, SAP, fleet) can expose MCP tools the agent can call alongside STAVAGENT's — this is the "agent-as-integration-layer" pitch, much stronger than "we are an AI tool".
3. **Innovation-narrative reinforcement.** "First AEC agent in the Gemini Enterprise ecosystem" is a defensible Innovation claim for both audiences.

**Potential conflict (manageable):**
- **Vertical positioning.** Devpost submission must claim a clear single-vertical (civil construction estimating). Cemex CSC may want to be positioned as a foundational customer in a broader platform play (cement supply integration → estimation → procurement). These are not contradictory but require careful language: the **Devpost narrative** is "agent for tender estimation"; the **Cemex deck** says "STAVAGENT is the estimation layer, Cemex CSC is the concrete-supply layer, both share the same agent-friendly MCP foundation". Same product, different slices for different audiences.

**Direct reusable assets from Google submission for Cemex deck:**
- Demo video (1:1 reuse)
- Žihle 10.59M Kč master soupis + reconciliation report (1:1 reuse — both audiences want to see real numbers)
- Agent decision-log visualization (Cemex IT will value seeing the "brain" not just the output)
- Architecture diagram (agent → MCP server → 9 tools → KB)
- Market-gap slide (zero AEC partners in Gemini Enterprise launch)

**Direct conflict items to neutralize:**
- Any wording in Devpost suggesting "general construction platform" should be moderated to "tender estimation agent" — keeps Cemex deck free to expand the scope.

---

## 10. Open Questions for Alexander

Decisions required before starting Week 1:

| # | Question | Why it blocks start | Who answers |
|---|---|---|---|
| **O-1** | Where are the strategic source documents named in the brief (`STAVAGENT_Master_Brief.md`, `STAVAGENT_Competitive_Landscape_Cemex_CSC.md` + `_RU.md`, `STAVAGENT_DACH_Addendum.md`, `TASK_MCP_Server_AllModules.md` and three siblings)? None exist in the repository under those names. | Without them, the Cemex synergy analysis (§9) is inferred not grounded, and DACH expansion angle for the submission narrative is unverified. | Alexander — provide path or attach |
| **O-2** | What is STAVAGENT's legal entity status for Google for Startups eligibility? Incorporated (s.r.o. / Ltd.)? Sole proprietor (OSVČ)? Pre-incorporation? | Risk R2. If ineligible, the entire submission strategy collapses to "claim $500 credits, reuse work for Cemex". | Alexander |
| **O-3** | Agent name — "StavAgent Přípravář" (Czech-native) or "BidScout for Civil Construction" (English-native)? Or other? | Affects branding consistency between hackathon and Cemex deck. | Alexander |
| **O-4** | Demo video language — Czech with English subtitles, or English with Czech subtitles, or fully English? Judges are global; primary user is Czech. | Affects video production time (Wk 3 budget). | Alexander |
| **O-5** | Acceptable Libuše Phase 7a/8 slip — is 2-week delay OK, or is there a hard date there that conflicts? | Determines whether the 35h/week budget is achievable. | Alexander |
| **O-6** | Comfort with Track 1 vs preference to register-only for $500 credits and skip submission? | The full submission is 90–120h. Register-only is ~2h. Trade-off is Innovation positioning vs guaranteed revenue from Cemex. | Alexander |
| **O-7** | If submission goes ahead, what is the agent's repository structure decision — separate new repo (`stavagent-agent-hackathon`) submitted to Devpost, with existing STAVAGENT as external MCP server, or in-repo branch? | Affects R3 (IP scope) and ongoing maintenance. Recommended: separate repo, cleanly scoped. | Alexander |
| **O-8** | Devpost-rules verification of: per-track prize distribution, demo video length, code repo public/private requirement, multi-track entry allowed, framework restrictions. Public Google blogs are silent; only Devpost rules page knows. | Day-1 task on Wk 1 after registration. | Alexander after registration |

---

## Sources cited

1. Google Cloud Blog — "Startups are building the agentic future with Google Cloud" — <https://cloud.google.com/blog/topics/startups/startups-are-building-the-agentic-future-with-google-cloud>
2. Google Cloud Blog — "The top startup announcement from Next '26" — <https://cloud.google.com/blog/topics/startups/the-top-startup-announcement-from-next26>
3. Google Cloud Blog — "Partner-built agents available in Gemini Enterprise" — <https://cloud.google.com/blog/products/ai-machine-learning/partner-built-agents-available-in-gemini-enterprise>
4. Devpost registration — <https://goo.gle/486nbl4> (gated, requires registration for per-track rules and eligibility specifics)
5. STAVAGENT repo — `CLAUDE.md`, `concrete-agent/packages/core-backend/app/mcp/`, `Monolit-Planner/shared/src/calculators/`, `test-data/most-2062-1-zihle/`, `.github/workflows/`, `cloudbuild-*.yaml` (verified 2026-05-15)

---

*End of analysis. No code was written. Implementation begins only on Alexander's explicit go-decision against §10 open questions.*
