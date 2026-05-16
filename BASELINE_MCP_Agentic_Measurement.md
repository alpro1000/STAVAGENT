# BASELINE — MCP Server Agentic Behavior Measurement

**Author:** Claude Code session (measurement protocol; Alexander executes)
**Date created:** 2026-05-15
**Scope:** measure how STAVAGENT MCP server v1.0 actually behaves when consumed by Custom GPT in ChatGPT against a 3-case corpus, full A→B→C→D pipeline
**Status:** Protocol ready. Sections 5–9 fill in **after** Alexander runs the measurements.
**Reading time:** 30 min (protocol). Execution time: ~6–8 h for Alexander.

> **What this document is.** A fact-based measurement of the question *"is my MCP server doing the work or is the LLM imagining it?"* — done by running real queries against the live system, fixating every tool call, and cross-checking outputs against existing golden tests. It is **not** an implementation. No new tools, no new code. Alexander runs the queries; this document tells him exactly what to run, what to capture, and how to interpret what comes back.

---

## 1. Executive Summary

**[TO BE FILLED AFTER EXECUTION]**

Suggested template (≤10 lines): one paragraph that names which of the three forensic questions (Q1 who-does-the-work / Q2 imperative-vs-declarative / Q3 where-chain-breaks) got the cleanest answers; the headline number — typically "X% of values in declarative-broad responses came from MCP tool calls, Y% from LLM imagination"; the one composite tool whose absence most clearly forces the LLM to hallucinate; whether Custom GPT is "good enough" as the demo client for Variant B or whether the recommendation is to switch to Claude Desktop post-Wk1; and the single demo scenario recommended (case × query × client) for the Google hackathon submission video.

---

## 2. Test Corpus Inventory

All eight known test cases. Three are **in scope** for this baseline. Five are **out of scope** with explicit reasons.

| Case | Path | Object type | Golden test reference | Maturity | In scope? | Reason for skip |
|---|---|---|---|---|---|---|
| **Žihle Most 2062-1** | `test-data/most-2062-1-zihle/` | Bridge (D&B) | `00_PROJECT_SUMMARY.md` + 4 phase folders (01_extraction … 04_documentation) + `master_soupis.yaml` (154 položek, 10.59M Kč) | Complete pilot, all phases end-to-end | **YES** (flagship) | — |
| **VP4 FORESTINA opěrná zeď** | `test-data/tz/VP4_FORESTINA_operna_zed_golden_test.md` + `Monolit-Planner/shared/src/calculators/golden-vp4-forestina.test.ts` | Retaining wall | Markdown golden + 6 vitest scenarios | Engineering layer locked to golden | **YES** (different typology, has authoritative golden) | — |
| **hk212 hala** | `test-data/hk212_hala/` + `example_vv/` (FORESTINA Horažďovice) | Civilní hala (skladová) | `TASK_HK212_URS_Cache_Rematch_v2.md` + 6 example XLSX výkazy (UT/VZT/elektro/ZTI) | Phase 0b + Phase 1 ready, example_vv real | **YES** (civil building typology) | — |
| SO-202 D6 most | `test-data/tz/SO-202_D6_most_golden_test.md` + `golden-so202.test.ts` | Bridge | Markdown + 11 vitest baseline | Complete | NO | Same typology as Žihle; golden coverage overlaps; adding it deepens bridge axis instead of widening typology distribution. Keep as Wk2 spot-check if time. |
| SO-203 D6 most | `test-data/tz/SO-203_D6_most_golden_test_v2.md` + `golden-so203.test.ts` | Bridge (large pour, 664 m³) | Markdown + vitest | Complete | NO | Same as SO-202. Useful for v4.20 pump scenario validation, not for general baseline. |
| SO-207 D6 estakada | `test-data/tz/SO-207_D6_estakada_golden_test_v2.md` | Bridge (MSS deck) | Markdown only | Complete | NO | Same typology. MSS-specific scenario already exercised in v4.21 unit tests. |
| SO-250 most | `test-data/SO_250/` (11 PDFs incl. statický výpočet) | Bridge (deska) | No markdown golden — only raw drawings + TZ | Drawings + TZ raw | NO | No markdown reference means hallucination check requires manual re-derivation. Out of scope for fast baseline. |
| Libuše objekt D | `test-data/libuse/` + `outputs/` (4090 items, 13 sheets) | Civilní budova (dokončovací práce) | `TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md` + outputs XLSX | Phase 7a/8 partial | NO | 4090-item scale exceeds baseline measurement runway. Run a separate measurement after Variant B Wk2 when agent-loop limits matter more. |

**Coverage check:** three in-scope cases give distribution **bridge / retaining wall / civil hall** — i.e., the calculator's main typological axes. This is stronger than three bridge cases or six anything.

---

## 3. Methodology

### 3.1 The three forensic questions

| ID | Question | What "answered cleanly" looks like |
|---|---|---|
| **Q1** | When user asks a complex question, how much of the output comes from MCP tool calls vs LLM imagination? | Numerical: "X% of factual values in the response are traceable to a logged tool call output; (100−X)% are LLM-generated. Hallucination rate is Y%." |
| **Q2** | Does behavior differ between imperative pipeline-step queries and declarative one-shot queries? | Pair of numbers per case: tool-call count + completion-rate for imperative vs declarative. Delta tells whether Custom GPT can decompose declarative intent into tool chains. |
| **Q3** | Where does the chain break? Which gaps force the LLM to write filler? | Named composite tools missing (e.g., "no `bridge.estimate_all_elements`, so each element became a separate manual prompt") + a count of how many sub-prompts a single declarative goal required to actually complete. |

### 3.2 LLM client

**Only Custom GPT in ChatGPT Store** (Alexander's pick). Function calls are visible in the GPT UI ("View used actions" / "Used the X tool"). Claude Desktop and Gemini-via-ADK are deferred to a follow-up measurement post-Wk1.

**Consequence:** results characterize ChatGPT's tool-orchestration behavior specifically. Claude Desktop is known empirically to be more eager to call tools in long chains; the post-measurement gap analysis should explicitly note "results may improve on Claude Desktop, validate before locking demo client choice for the submission video."

### 3.3 Three query types per case

Three queries × three cases = **9 measurement runs**.

The query templates below are written so the same shape is asked across all three cases — only the object name and a few unit values change. This is what lets the aggregate table compare apples to apples.

#### 3.3.1 Imperative simple (one explicit pipeline step)

A single, narrow ask matching ONE tool's purpose. Tests whether MCP works at all when the user is "doing the orchestration in their head."

| Case | Imperative query (paste into ChatGPT after attaching files) |
|---|---|
| Žihle | *"Z přiloženého ZD vytáhni seznam stavebních objektů (SO) a u každého uveď typ konstrukce a hrubý objem betonu, pokud je v textu zmíněn. Žádné výpočty, jen extrakce."* |
| Forestina | *"Z přiloženého TZ a soupisu pro opěrnou zeď vytáhni: třída betonu, expoziční třída, hmotnost výztuže, plocha bednění, objem betonu, výška zdi. Vypiš jak jsou v dokumentu."* |
| hk212 | *"Z přiloženého souboru example_vv vytáhni seznam profesí (UT, VZT, ZTI, elektro), pro každou počet položek a celkovou cenu, pokud je v souboru. Nic neodhaduj."* |

**Expected behavior if MCP server is doing the work:** 1–3 tool calls (`document.analyze`, `budget.parse`, possibly `classifier`). Few values to hallucinate. Easy to verify against golden test markdown.

#### 3.3.2 Declarative broad (one-shot full pipeline)

The whole job in one sentence. This is what **Google means by "declarative intent."** Tests whether ChatGPT will decompose autonomously.

| Case | Declarative-broad query |
|---|---|
| Žihle | *"Tady je kompletní ZD pro most ev.č. 2062-1 u obce Žihle (D&B SÚSPK, termín 02.07.2026, limit ZD 30 M Kč). Udělej kompletní rozpočet bez DPH s rozdělením na 6 SO. Pro každou hlavní položku doplň formuli, vstupy, kroky výpočtu a confidence. Na konci přidej reconciliation report s rozdíly nad 10 % vůči expected manuálnímu odhadu."* |
| Forestina | *"Pro tuto opěrnou zeď (TZ + soupis přiloženy) udělej kompletní zařízení: vyber bednící systém, spočítej skruž / stojky / podpěry, navrhni počet zábrérů, sestav Ganttův diagram pracovní bandy, výsledná cena Kč/m³ a Kč celkem. Aplikuj DIN 18218 a §116 ZP pokud relevantní."* |
| hk212 | *"Pro tuto skladovou halu FORESTINA Horažďovice (Blatenská 587) zpracuj kompletní rozpočet: profese UT + VZT + ZTI vnitřek + ZTI vnějšek + elektro, materiály + mechanismy + pracovní bandy + ZS, exportuj jako UNIXML XML."* |

**Expected behavior if MCP server is doing the work:** 15–40 tool calls minimum; clean call chain through `document.analyze` → `parse_construction_budget` → multi-call `classifier` → multi-call `calculate_concrete_works` (or equivalent) → `breakdown` → export.
**Expected behavior if LLM is faking it:** 1–3 tool calls + a beautiful-looking table where most numbers are hallucinated from training data + the documents' visible text.

#### 3.3.3 Declarative focused (narrower autonomous goal)

Between the other two. Tests where exactly the loop snaps.

| Case | Declarative-focused query |
|---|---|
| Žihle | *"Pro most SO 201 (5 částí: spodní stavba, NK, vozovka, izolace, římsy) vyber a nasaď bednící systémy pro každý prvek se zdůvodněním a vyčísli celkové náklady (práce + pronájem). Beton C30/37 XF4. Použij DOKA pokud možno."* |
| Forestina | *"Pro tuto opěrnou zeď spočítej pouze pracovní harmonogram (Gantt). Vstupy: čeleď 4 tesaři + 4 železáři + 3 betonáři + 2 vibrátoři. Bednící systém je již vybrán (Framax 100 kN/m²). Začni nejdřív 2026-06-15."* |
| hk212 | *"Klasifikuj všechny položky v souboru `example_vv/Forestina Horaždovice- UT, OPZ [zadání].xlsx` podle profese a typu konstrukce (rozdělení do 11 skupin: zemní práce / základy / svislé / vodorovné / střecha / dokončovací / TZB / ostatní)."* |

**Expected behavior:** 4–15 tool calls. Should be inside the "comfortable chain depth" of ChatGPT's tool-use budget per turn.

### 3.4 Manual execution protocol (Alexander runs this)

For **each** of the 9 [case × query] pairs, do exactly these eight steps. Allow ~30–50 minutes per pair.

1. **Open a fresh ChatGPT conversation** with the Custom GPT selected. Fresh = no context bleed from prior tests.
2. **Attach files** appropriate to the case:
   - Žihle: at minimum `inputs/` PDFs from `test-data/most-2062-1-zihle/inputs/` (TZ + ZD podmínky + výkresy if filesize allows)
   - Forestina: `test-data/tz/VP4_FORESTINA_operna_zed_golden_test.md` + the original TZ/soupis if available outside the markdown
   - hk212: the relevant `example_vv/*.xlsx` named in the query (one per query) + `test-data/hk212_hala/README.md`
3. **Paste the exact query** from §3.3 (don't rephrase — exact wording for reproducibility).
4. **Wait for the response to complete.** Do not interrupt. Do not paste a follow-up.
5. **Click "View used actions" / expand the tool-call panel.** Screenshot or copy the list of tool calls + their input parameters + their truncated outputs.
6. **Copy the entire conversation** (query + tool calls + final response) into the per-run logging block in §4 below.
7. **Cross-check the response against the golden test** for that case. Mark every numeric value as one of:
   - **MCP** — value appears in a logged tool-call output. Trace it to the tool.
   - **HALLUCINATION** — value does NOT appear in any tool call AND does NOT appear in the attached source document. LLM generated it from training.
   - **DOC** — value appears in the attached source document but NOT in any tool call. LLM read it from the doc directly, did not use MCP.
   - **MIXED** — value partially comes from a tool call but was transformed (rounded, aggregated, re-derived) by the LLM. Note the transformation.
8. **Fill the metrics row** in §4 (10 fields per row). Use the rubric in §3.5 for the qualitative metrics.

### 3.5 Metrics rubric (decode for qualitative fields)

| Metric | Allowed values | Decision rule |
|---|---|---|
| **Task completion rate** | 1.0 / 0.5 / 0.0 | 1.0 = the response addresses everything asked; 0.5 = partial (e.g., 3 of 5 SOs covered, or list returned but no calculations); 0.0 = refusal or off-topic. |
| **Extraction accuracy %** | 0–100% | Numerator: count of fields in the response that match the golden test value within ±5%. Denominator: count of fields the response *claims* to provide. |
| **Completeness %** | 0–100% | Numerator: golden-test fields covered by the response. Denominator: total fields in the golden test relevant to this query. |
| **Tool/workflow correctness** | 1 / 0 | 1 = the *sequence* of tool calls (when ≥2) is logically ordered (extract → classify → calculate → aggregate; not calculate → extract). 0 = wrong order or critical tool skipped. For 0 / 1 tool calls, mark as N/A. |
| **Human correction rate %** | 0–100% | "Of the values in the final response, what % would I need to overwrite by hand to make it production-ready for a real tender?" Subjective but force a number. |
| **Wall-clock time (s)** | integer | From "send" to "response complete." Tool latency dominates. |
| **Tool calls count** | integer | Total invocations. Each call = 1, even if same tool called 5 times. |
| **Tools used (unique)** | list | The 9 MCP tools by name. |
| **% output from MCP** | 0–100% | Fraction of factual values classified as **MCP** or **MIXED** in step 7. |
| **% output from LLM imagination** | 0–100% | Fraction classified as **HALLUCINATION** or **DOC**. (DOC ≠ hallucination but ≠ MCP either — for the agentic-behavior question both belong to "LLM did the work, not MCP.") |

### 3.6 Gemini Enterprise Agent Platform — component tracking dimension

In addition to tool-call counts and value classification, **each measurement run also tracks which Gemini Enterprise Agent Platform components were physically engaged** during execution. This serves the submission's Technical 30% rubric — Google scores submissions on visible use of the Agent Platform.

The Agent Platform diagram has four layers; the following are the named components per layer Alexander tracks per run:

| Layer | Components |
|---|---|
| **Build** | ADK · 3P Agent Framework · Agent Studio · Agent Garden · Gemini Models · 3P Models · Open Models · A2A · **MCP** · A2UI · Grounding · Search · AP2/UCP · RAG · APIs and Connectors · Cloud Marketplace |
| **Scale [GA]** | Agent Runtime · Agent Sessions · Agent Sandbox · Agent Memory Bank |
| **Govern** | Agent Gateway · Agent Identity · Agent Registry · Agent Anomaly Detection · Model Armor · Agent Policy · Agent Security · Agent Compliance |
| **Optimize** | Agent Evaluation · Agent Simulation · Agent Observability · Agent Optimizer |

Per run, each component receives one of three labels:

- **USED** — physically engaged during this run. Evidence: tool call log line, UI element, backend trace, OAuth token in transit, etc. Be specific about evidence.
- **APPLICABLE-BUT-UNUSED** — STAVAGENT *could* engage this component on a future query of this shape, but did not this time. Wk1/Wk2 candidate for inclusion.
- **NOT-APPLICABLE** — STAVAGENT's vertical / architecture / scope fundamentally has no use for this component (e.g., AP2/UCP for agent commerce — STAVAGENT doesn't transact). Recording this defends against the judge question *"why did you skip X?"*

Component tracking does **not** require extra measurement runs — the same 9 runs produce this data as a side observation. Add ~10 minutes per run for honest categorization.

**This section is for Alexander to fill during execution.** One row per [case × query]. Nine rows total.

### 4.1 Žihle Most 2062-1

#### Run Z-IMP (imperative simple)

```
TIMESTAMP:       ___________________________________________
QUERY:           [exact text from §3.3.1 Žihle]
ATTACHED FILES:  ___________________________________________

TOOL CALLS (paste from "View used actions"):
  1. ___________ args: _______________ truncated output: ___________
  2. ___________
  ...

FINAL RESPONSE (paste full):
  ___________________________________________________________

VALUE CLASSIFICATION (per §3.4 step 7, one line per numeric value):
  - "10.59M Kč" → MCP / HALLUCINATION / DOC / MIXED, source: ___
  - "154 položek" → ___
  - ...

METRICS:
  Task completion rate:           [0 / 0.5 / 1]
  Extraction accuracy %:          ___
  Completeness %:                 ___
  Tool/workflow correctness:      [0 / 1 / N/A]
  Human correction rate %:        ___
  Wall-clock time (s):            ___
  Tool calls count:               ___
  Tools used (unique):            ___
  % output from MCP:              ___
  % output from LLM imagination:  ___

AGENT PLATFORM COMPONENTS (per §3.6 — one label per component, evidence required on USED):
  Build / ADK:                    [USED with evidence ___ / APPLICABLE-BUT-UNUSED / NOT-APPLICABLE reason ___]
  Build / MCP:                    [___]
  Build / Gemini Models:          [___]
  Build / APIs and Connectors:    [___]
  Build / Grounding:              [___]
  Build / RAG:                    [___]
  Build / Search:                 [___]
  Build / A2A:                    [___]
  Build / Cloud Marketplace:      [___]
  Build / (others — note only if USED): _____________________________
  Scale / Agent Runtime:          [___]
  Scale / Agent Sessions:         [___]
  Scale / Agent Memory Bank:      [___]
  Scale / Agent Sandbox:          [___]
  Govern / Agent Gateway:         [___]
  Govern / Agent Identity:        [___]
  Govern / Agent Registry:        [___]
  Govern / (others — note only if USED): __________________________
  Optimize / Agent Evaluation:    [___]
  Optimize / Agent Observability: [___]
  Optimize / (others — note only if USED): ________________________
```

#### Run Z-DEC-B (declarative broad)
```
[same structure — paste query from §3.3.2 Žihle]
```

#### Run Z-DEC-F (declarative focused)
```
[same structure — paste query from §3.3.3 Žihle]
```

### 4.2 VP4 FORESTINA opěrná zeď

#### Run F-IMP (imperative simple)
```
[same structure — query from §3.3.1 Forestina]
```

#### Run F-DEC-B (declarative broad)
```
[same structure — query from §3.3.2 Forestina]
```

#### Run F-DEC-F (declarative focused)
```
[same structure — query from §3.3.3 Forestina]
```

### 4.3 hk212 hala

#### Run H-IMP (imperative simple)
```
[same structure — query from §3.3.1 hk212]
```

#### Run H-DEC-B (declarative broad)
```
[same structure — query from §3.3.2 hk212]
```

#### Run H-DEC-F (declarative focused)
```
[same structure — query from §3.3.3 hk212]
```

---

## 5. Aggregate Metrics

**[TO BE COMPUTED AFTER §4 IS FILLED.]**

### 5.1 By query type (averages across 3 cases)

| Metric | Imperative (avg of Z/F/H IMP) | Declarative broad (avg of Z/F/H DEC-B) | Declarative focused (avg of Z/F/H DEC-F) |
|---|---|---|---|
| Tool calls count | ___ | ___ | ___ |
| % output from MCP | ___ | ___ | ___ |
| % output from LLM imagination | ___ | ___ | ___ |
| Task completion rate | ___ | ___ | ___ |
| Extraction accuracy % | ___ | ___ | ___ |
| Completeness % | ___ | ___ | ___ |
| Tool/workflow correctness | ___ | ___ | ___ |
| Human correction rate % | ___ | ___ | ___ |
| Wall-clock time (s) | ___ | ___ | ___ |

### 5.2 By object type (averages across 3 query types)

| Metric | Bridge (Žihle) | Retaining wall (Forestina) | Civil hall (hk212) |
|---|---|---|---|
| Tool calls count | ___ | ___ | ___ |
| % output from MCP | ___ | ___ | ___ |
| % output from LLM imagination | ___ | ___ | ___ |
| Task completion rate | ___ | ___ | ___ |
| Extraction accuracy % | ___ | ___ | ___ |
| Completeness % | ___ | ___ | ___ |
| Tool/workflow correctness | ___ | ___ | ___ |
| Human correction rate % | ___ | ___ | ___ |

### 5.3 Headline numbers (the three that matter)

- **Q1 answer:** On declarative-broad queries, MCP produces \_\_\_% of factual values; \_\_\_% are LLM-generated. → Agentic? \_\_\_
- **Q2 answer:** Declarative-broad calls \_\_\_ × more tools than imperative (or fewer? same?). Decomposition score: \_\_\_ / 5.
- **Q3 answer:** Median chain breaks at step \_\_\_ of \_\_\_ expected. Top gap: \_\_\_

---

## 6. Gap Analysis

**[TO BE FILLED AFTER §5 IS COMPUTED. Each gap MUST follow the four-line template below.]**

For each identified gap:

```
GAP NAME:        (short, e.g., "no bridge-wide element iterator")
SYMPTOM:         (observed during which runs; what the LLM did to fill the gap)
ROOT CAUSE:      (which composite operation is missing from the MCP toolset)
RECOMMENDED FIX: (a business-logic description, NOT a code spec. e.g., "add an operation that, given a list of structural-object IDs and a target metric, iterates the calculator across them and returns a unified table." NO file paths, NO function names, NO database columns.)
```

Aim for **5 named gaps minimum** per AC4. Suggested candidates to look for during analysis (Alexander, expand as needed):

1. **Bridge-wide element iteration** — does the LLM serially prompt one element at a time, or does the MCP server expose a one-call iterator? If the former, declarative-broad will fail the task completion test.
2. **Document-to-elements bridge** — once the document is parsed, does the MCP server return *structured-object IDs that can be fed back as input* to other tools? Or does the LLM have to manually copy values between calls?
3. **Reconciliation / cross-check** — is there an MCP tool that takes the calculator output AND the manual soupis and returns a delta report, or does the LLM eyeball the comparison? (Žihle's golden output has 16 reconciliation flags — these are exactly what should fall out of a `reconciliation.report` call.)
4. **Output assembly** — is there an MCP tool that emits the final XLSX/UNIXML/Gantt artifact, or does the LLM write Markdown tables that the user then has to re-key into KROS?
5. **Profession-aware classification for civil buildings** — does the classifier handle UT / VZT / ZTI / elektro splits cleanly, or only the calculator's 23 structural element types? (hk212 will surface this.)
6. **Calculator → ledger handoff** — Alexander has flagged this as a known broken pipeline ("ведомость ресурсов у меня не работает"). Expect this gap to surface in F-DEC-B and Z-DEC-B and document it formally here.
7. **Registry tools missing entirely from MCP** — `rozpocet-registry` operations (material grouping, supplier RFQ formatting) are not in the 9-tool MCP surface. Declarative-broad on hk212 will collide with this hard.

---

## 7. Variant B Week 1 Recommendations

**[TO BE FILLED AFTER §6 IS COMPLETE.]**

Decision tree to apply to the gap list:

| Observation in §5–§6 | Variant B Week 1 implication |
|---|---|
| Imperative works (>90% completion), declarative-broad fails (<40% completion) | The agent's primary job is **decomposition**. Wk1 agent prompt invests in decomposition logic; the MCP toolset is sufficient as-is. |
| Imperative works AND declarative-broad works (>70% completion) | The Variant B "infrastructure" framing is already real. Wk1 is mostly demo polish; consider including the LangChain stretch goal. |
| Imperative fails (<60% completion) on any case | Stop. The MCP server has a deeper problem than agentic orchestration. Fix the underlying tool before any agent layer. |
| ≥5 gaps name the same composite tool ("we need X") | Build X as part of Wk1 even though it counts as "new tool". This is the rare exception to the "no new MCP tools" rule from earlier analyses. |
| Custom GPT calls ≤3 tools on declarative-broad consistently | Custom GPT is **insufficient** as the demo client. Switch demo to Claude Desktop after a one-day Claude Desktop re-measurement. The Wk2 plan absorbs that day. |
| Gemini results unknown | If Variant B demo uses ADK + Gemini Flash, schedule a Gemini measurement on the same 3 cases in Wk1 Day 3–4. Without that data, the submission demo is shipping blind. |
| hk212 declarative collapses on registry tools | Registry-to-MCP bridge is a Wk2 stretch goal at best. Variant B demo focuses on bridge / retaining wall, not civil buildings, for the submission video. |

**Output of this section after fill:** a punch list of 3–6 named items Alexander commits to before Wk1 Friday.

---

## 8. Demo Scenario Recommendation

**[TO BE FILLED AFTER §6–§7.]**

The demo video for the Google submission needs one chosen scenario. Pick along four axes:

| Axis | Options | How §4–§6 informs the choice |
|---|---|---|
| **Case** | Žihle / Forestina / hk212 | Pick the case with the highest tool-call density AND highest extraction-accuracy on declarative-broad. Žihle is the candidate if completeness ≥70%, otherwise Forestina (smaller scope, more controllable). hk212 is unlikely to win unless registry-bridge gap is closed. |
| **Query type** | Imperative-only / Declarative-broad / Mixed | If declarative-broad delivers acceptable numbers, demo it (matches Google's "declarative intent" language). If only imperative works, demo a 3-step imperative chain that LOOKS declarative because the agent layer (ADK orchestrator) is doing the decomposition — but be honest in the script. |
| **Client** | Custom GPT / Claude Desktop / Gemini ADK | Variant B section 11.3 prescribes 4 clients in parallel. The MEASURED winner of this baseline becomes the "primary client" shown for the longest segment; others are 5-second cameos. |
| **Honesty markers** | Explicit / Soft / None | If completeness <80% on the chosen demo case, the demo must explicitly show the agent saying "I am missing X data — please confirm" rather than fabricating. This is a **selling point** (safe agent behavior), not a defect. Judges score this favorably. |

**Worked example of expected output of this section** (Alexander replaces with actual after measurements):

> *"Demo Variant B Part 3 uses **VP4 Forestina**. Query is **declarative-focused** ("for this retaining wall, do the complete formwork + schedule + cost"), framed in the video as a declarative-broad goal because the agent layer auto-decomposes. Primary client is **Claude Desktop** (measured 12-tool chain on F-DEC-F vs Custom GPT's 4-tool chain). Custom GPT appears for 5 seconds in the multi-client montage. The agent will explicitly say 'výztuž jsem nepočítal — vstup z TZ neúplný' if the rebar density does not appear in the attached docs — measured behavior, kept in the demo for credibility."*

### 8.1 Demo storyboard with Agent Platform component mapping (0:00–3:00)

**[TO BE FILLED. Required for AC8 / AC9.]**

The recommended demo scenario from §8 above expands into a second-by-second timeline. Each demo segment must name **which Agent Platform components are physically visible on screen** (tool-call panels, terminal logs, architecture diagrams, OAuth flows, etc.). Goal: **≥5 components visibly engaged** across the 3-minute video, per AC9.

Template (fill after §8 selection is made):

| Time | What appears on screen | Voiceover (≤2 sentences) | Agent Platform components visibly engaged | Evidence type |
|---|---|---|---|---|
| 0:00–0:15 | Problem framing card: "estimator spends 40h on one tender → can an agent do it in 8 min?" | Problem statement, no components yet | n/a (business context) | n/a |
| 0:15–0:30 | Architecture diagram: agent → MCP server → 9 tools → KB | "STAVAGENT MCP server, already in production. OAuth-certified for Claude.ai and ChatGPT." | **MCP**, **APIs and Connectors**, **Agent Gateway**, **Agent Identity**, **Cloud Run = Agent Runtime** | Architecture diagram in frame |
| 0:30–1:00 | Split-screen contrast: GPT-4o vanilla vs GPT-4o via STAVAGENT MCP on same prompt | "Vanilla LLM hallucinates DIN 18218 pressure. Same prompt through MCP returns ground truth from the 7-engine pipeline." | **MCP**, **Gemini Models** (or 3P models in vanilla case), **Grounding** | Two terminals side-by-side |
| 1:00–1:30 | ADK agent decision log streaming on right; business outputs growing on left | "The agent autonomously decides which MCP tool to call next, based on what the previous tool returned." | **ADK**, **MCP**, **Gemini Models**, **Agent Runtime**, **Agent Sessions**, **Agent Memory Bank** | Agent log panel + Cloud Run logs ticker |
| 1:30–2:00 | Multi-client montage: Claude Desktop, Custom GPT, ADK agent — same MCP server | "Framework-neutral. The infrastructure works under any agent that speaks MCP." | **MCP**, **ADK**, **3P Agent Framework** (Claude / ChatGPT clients), optionally **A2A** if multi-agent stretch is included | 3 windows visible, one MCP server log feed |
| 2:00–2:30 | Final outputs: master soupis table + Gantt + KROS-format XLS export downloading | "Output: 154 položek, 10.59 M Kč, KROS-ready, audit-trail per item." | **MCP**, **Cloud Marketplace** (roadmap callout for Track 3), **Agent Observability** (Cloud Logging panel) | XLS download visible + logs panel |
| 2:30–2:55 | Honesty marker: agent says *"X jsem nedopočítal — chybí vstup Y"* | "Safe agent behavior. When data is missing, the agent flags it instead of inventing." | **Agent Evaluation** (validates output against golden), **Grounding** (refuses to fabricate) | On-screen agent message in Czech |
| 2:55–3:00 | Tagline + URL: "Engineering ground truth for AI agents in construction. stavagent.cz/mcp" | Closing line | — | — |

**Component coverage check (auto-counted from the table above):** the storyboard skeleton above already names ≥10 visibly-engaged components — comfortably above the AC9 floor of 5. The actual coverage depends on which scenario §8 picks; if the chosen scenario can only naturally surface 3–4 components, Wk1 build adds whatever's missing (typically Agent Evaluation, Agent Observability, or Agent Memory Bank — all low-cost to expose visibly even when they were already running invisibly).

### 8.2 Components fundamentally not applicable to STAVAGENT (defensive)

**[TO BE FILLED. Required for AC10. Defends against the judge question *"why did your submission skip X?"*]**

For each Agent Platform component STAVAGENT does **not** engage and has no near-term plan to engage, record the reason. Pre-populated candidates Alexander confirms or corrects:

| Component | Reason for non-applicability | Confidence |
|---|---|---|
| **Agent Garden** | Pre-built agent templates marketplace. STAVAGENT is a custom vertical agent for Czech construction — there is no template to start from. Garden is for horizontal use cases (sales / support / IT helpdesk). | High |
| **Agent Studio** | Low-code visual agent builder for non-engineering teams. STAVAGENT is built in code (ADK Python) by an engineering-trained founder; visual builder is solving a different problem. | High |
| **AP2 / UCP (Agent Payments / Universal Commerce Protocol)** | For agent-mediated commerce (agents buying / selling). STAVAGENT estimates costs, does not transact. Future: if `request_supplier_quote` MCP tool is added and Cemex pays through it, AP2 becomes applicable — currently roadmap, not Wk1. | High |
| **A2UI (Agent-to-UI handoff)** | Standard for agents handing control back to UI surfaces. STAVAGENT's UI surfaces (Monolit-Planner, Portal) already run separately and accept agent output via standard REST. A2UI overhead doesn't add value yet at single-user scale. | Medium — revisit when multi-user agent sessions launch |
| **Open Models** (Llama / Mistral / Qwen self-hosted) | Gemini-centric per Google preference + cost. Gemini Flash is cheaper than self-hosting at STAVAGENT's volume. | Medium — re-evaluate if EU AI Act compliance forces on-prem |
| **3P Models** (Anthropic Claude via API) | Already engaged via Claude Desktop as MCP client (consumer side). For the **agent reasoning loop** (ADK orchestrator), staying Gemini-centric matches Track 1 framework expectations. | High |
| **Model Armor** | Content-safety filtering layer. Construction estimation queries don't carry the toxicity / PII / harmful-content risk profile this component addresses. Cemex enterprise sale may revisit. | High |
| **Agent Anomaly Detection** | Production telemetry for unusual agent behavior at scale. STAVAGENT is single-tenant at submission time; anomaly detection becomes meaningful at 100+ concurrent sessions. | Medium — Wk2 enterprise stretch |
| **Agent Policy** | Fine-grained per-user / per-org policy controls. Premature at solo-founder + first paying customer scale. | Medium |
| **Agent Compliance** | SOC2 / ISO27001 / HIPAA-style certified compliance attestation pack. Premature at current stage. Cemex enterprise sale will surface this in 2027. | High |
| **Agent Sandbox** | Isolated execution environment for testing agents before production. STAVAGENT uses Cloud Run staging + pytest as functional equivalent. Sandbox-as-a-service is for teams of multiple agent developers, not solo founder. | Medium |
| **Agent Simulation** | Large-scale eval across synthetic scenarios. Wk1 baseline measurement (this document) is the artisanal equivalent; Simulation becomes useful once the agent is locked and being optimized. | High — explicitly Wk3+ |
| **Agent Optimizer** | Automated reinforcement-style tuning of agent prompts and tool-call patterns. Useful AFTER §5 measurements identify the gaps; not as the first move. | High — Wk2 candidate if measurements show prompt-tuning is the bottleneck |

This list **counts as evidence of architectural maturity** — the submission write-up cites it briefly to demonstrate that components were deliberately excluded after evaluation, not unknown.

---

## 9. Open Questions

(Filled as measurement progresses. Some pre-populated based on the protocol design.)

| # | Question | Resolution path |
|---|---|---|
| **M-1** | Does Custom GPT's "View used actions" UI actually show *all* tool calls or does it collapse repeated ones? | Spot-check on the first run by comparing UI count to Cloud Run MCP server logs for the same conversation. If discrepancy >10%, use Cloud Run logs as authoritative for tool-call count. |
| **M-2** | The `master_soupis.yaml` for Žihle has 154 položek. Custom GPT's response in a single turn cannot enumerate all 154 — token budget. How do we score completeness fairly? | Normalize: if the response covers all 6 SOs at a summary level + the top 10 items per SO, score completeness against that bar, not 154 line items. Document this normalization explicitly in §4 Žihle runs. |
| **M-3** | hk212 example_vv files include `Forestina` in the filename — is this the same Forestina as the retaining wall case, causing context bleed if user/LLM connects them? | Confirm: these are different "Forestina" projects (the retaining wall vs the Horažďovice hala). The filename overlap is incidental. Alexander to verify and add a one-line clarification in the hk212 query prompt to prevent the LLM from cross-referencing. |
| **M-4** | If Custom GPT refuses a query (e.g., file too large, rate limited) — does that count as completion 0 or N/A? | Treat as N/A and re-run with reduced attachments. Document the reduction. Note in §4 raw log. |
| **M-5** | What is the wall-clock budget for the 9 runs? | 6–8 h Alexander time per his answer. If a single run >1h (rare, but possible on Žihle declarative-broad if it actually decomposes), pause and capture intermediate state — those are the most valuable data points. |
| **M-6** | Should `most-litovel` (unmentioned but exists at `test-data/most-litovel/`) be added to scope? | No — would be a fourth bridge case. Out of typological balance. Reserve for post-Wk1 follow-up if Žihle baseline is inconclusive. |
| **M-7** | Custom GPT vs Claude Desktop — should the conclusion of this measurement commit to one client, or recommend a re-measurement on Claude Desktop in Wk1? | Default recommendation: re-measure on Claude Desktop in Wk1 Day 4 if Custom GPT under-performs on declarative-broad (<5 tool calls average). Cheap insurance against shipping a demo on the wrong client. |
| **M-8** | What about the LLM seeing the same PDF text and just transcribing values (DOC category)? Is that hallucination or correct behavior? | Per §3.4 step 7: DOC values are *not* hallucinations but they are *also not* MCP-driven. For Q1 ("who does the work"), DOC counts toward "LLM did the work, MCP did not." This is the honest read — extraction-from-attachment is a built-in LLM capability, not a STAVAGENT capability. |
| **M-9** | The Agent Platform component list in §3.6 contains 30+ named components. Tracking each per run is heavy. What's the minimum honest tracking? | Track only components for which evidence is **clearly visible** during measurement (Build/MCP, Build/Gemini Models, Build/APIs and Connectors, Scale/Agent Runtime, Govern/Agent Identity, Govern/Agent Gateway — the always-on subset for any MCP-based run). Mark the rest as APPLICABLE-BUT-UNUSED or NOT-APPLICABLE in §8.2 once, not per run. This makes the per-run table populated honestly without ballooning execution time. |
| **M-10** | AC9 requires ≥5 Agent Platform components visibly engaged in the demo. The baseline measurement may surface only 2–3 visibly engaged (MCP + Gemini Models + Agent Runtime) for typical Custom-GPT runs. How does this not block AC9? | Three-stage answer: (1) the baseline measures *current state* — the recommendation in §7 may explicitly include "Wk1 builds add ADK + Agent Sessions + Agent Memory Bank + Agent Observability surfaces" precisely to reach ≥5; (2) some always-on components (Cloud Run = Agent Runtime, OAuth = Agent Identity + Agent Gateway) are "engaged" even if not visually showcased — Wk1 demo polish adds the visible chrome; (3) AC9 applies to the *demo storyboard* (§8.1), not the baseline runs themselves. Baseline can show 3, demo can show 8+ if Wk1 build adds the visualization. |

---

## Sources

- STAVAGENT repo paths verified 2026-05-15: `test-data/most-2062-1-zihle/`, `test-data/tz/`, `test-data/hk212_hala/`, `test-data/libuse/`, `test-data/SO_250/`, `test-data/most-litovel/`, `Monolit-Planner/shared/src/calculators/golden-*.test.ts`
- MCP server v1.0 spec: `CLAUDE.md` §"MCP Server v1.0" (9 tools: find_otskp_code, find_urs_code, classify_construction_element, calculate_concrete_works, parse_construction_budget, analyze_construction_document, create_work_breakdown, get_construction_advisor, search_czech_construction_norms)
- Custom GPT in ChatGPT — per `STAVAGENT_Master_Brief.md` §1.5, already submitted to GPT Store

---

*Document is a protocol. Sections 1, 4, 5, 6, 7, 8 fill in as measurements complete. Sections 2, 3, 9 are stable. No code, no new tools, no schema changes are produced by this work — only data and conclusions.*
