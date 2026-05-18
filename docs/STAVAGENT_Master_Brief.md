# STAVAGENT — Master Brief

> Living document. Создан 04.05.2026. Версия 0.1 (initial structure).
> Группирует: позиционирование сервиса, конкурентный landscape, стратегия подачи на CSC 2026, параллельные треки (YC, EU AI Act, GCP credits).
> Для редактирования / дополнения. Что не подтверждено — помечено `_to be added_`.

---

## 1. Сервис STAVAGENT

### 1.1 One-liner (current — to refine)

> Engineering calculation layer for construction with triple access (UI / MCP / Agent API). Formwork pressure per DIN 18218, concrete maturity Saul, RCPSP scheduling, 25 formwork systems, 23 element types — exposed for human estimators, AI agents, and direct integration.

Старый one-liner ("AI co-pilot for Czech construction estimators") — **launch wedge, не endgame**. Czech/SK = первый рынок входа, не определяющая черта продукта.

### 1.2 Engineering depth — что внутри калькулятора

**7-engine pipeline** (orchestrated, deterministic-first):

1. **Formwork engine** — DIN 18218 lateral pressure, выбор системы по геометрии и давлению
2. **Rebar-lite engine** — выбор арматуры по типу элемента, density по h/t матрице
3. **Pour-decision engine** — záběry, pracovní spáry, cycle time
4. **Maturity engine** — Saul model, время до стрипaния по температуре
5. **Element-scheduler (RCPSP)** — resource-constrained scheduling по DAG
6. **PERT Monte Carlo** — risk distribution для duration estimates
7. **Pump engine** — выбор насоса, crew composition, night supplement по §116 ZP

**Catalog & coverage:**
- 25 formwork systems (DOKA 6, PERI 13, ULMA 3, NOE 1, Místní 1)
- 23 element types (9 bridge + 13 building + 1 transport)
- 921+ engineering tests (после Gate 2 — 1036)
- OTSKP database 17,904 položek
- Pile engine: Ø600/900/1200/1500 × 4 geologies × 3 methods

**Точность:** ±10–15% (orientational, not engineering substitute). Финальное решение остаётся за přípravář / statik.

### 1.3 Triple access pattern (главный архитектурный moat)

| Access | Audience | Status |
|---|---|---|
| **UI** (Monolit-Planner) | Přípravář, rozpočtář (humans) | v4.24 в продакшне |
| **MCP server** (9 tools) | Claude Desktop, Custom GPT, AI agents | v1.0 live, Lemon Squeezy billing |
| **REST API** | Integrations, downstream tools (e.g. Alice Technologies) | Внутренний, expose pending |

Это редкость в construction tech — большинство SaaS только UI или только API. STAVAGENT — agentic-ready by design.

### 1.4 Architecture

- **Core Engine** (Python FastAPI) — Cloud Run, europe-west3
- **Kiosks** (Node+React, Vercel): Monolit-Planner, Rozpocet-Registry, Stavagent-Portal
- **MinerU OCR Service** — Cloud Run микросервис
- **URS_MATCHER** — Node service для классификации
- **Database** — Cloud SQL PostgreSQL
- **AI chain** — Vertex AI Gemini Flash → AWS Bedrock Claude → Perplexity (deterministic-first, AI fallback)
- **Confidence scoring**: 1.00 lookup → 0.95 regex code → 0.85 regex desc → 0.80 URS Matcher → 0.70 AI

**Принцип:** детерминизм прежде AI. Regex/lookup всегда первый, LLM fallback только для текстов где deterministic беспомощен.

### 1.5 Текущее состояние (04.05.2026)

- v4.24 в продакшне (PR #983 deployed)
- Gate 1 PR #1058 merged (29.04.2026)
- Gate 2 PR #1064 в работе (15 commits, branch `gate-2-element-classification`)
- MCP v1.0 live с биллингом
- 3,693+ commits, 500+ deployments
- $5,000 Perplexity credit активен
- Cemex pilot scheduled W4+ (15.05.2026+)

---

## 2. Конкурентный landscape

### 2.1 Cemex Top 50 Contech 2026 — Enhanced Productivity (твой сегмент)

**Direct competitors (мостокирующие функции):**

| Startup | Что делает | Перекрытие со STAVAGENT |
|---|---|---|
| **Aitenders** (FR) | AI tender documents + compliance | Document parsing — частично (no calc, no scheduling) |
| **Togal.AI** (US) | AI takeoff (количественный обмер с PDF) | Quantity extraction — частично (only takeoff, no engineering) |
| **Buildcheck AI** (US) | AI plan review for compliance | None (US codes focus, no estimating) |
| **ConCntric** (US) | Preconstruction collaboration platform | Workflow tool, no AI extraction/calc |
| **Datagrid** (JP) | AI for construction documents | Japan-specific, adjacent |
| **SmartPM Technologies** (US) | Schedule analytics post-execution | Adjacent (post-execution, not preconstruction) |

### 2.2 Alice Technologies — НЕ конкурент (разные слои стека)

| Layer | What | Tool |
|---|---|---|
| **Engineering calculation** | Formwork pressure, pour cycles, maturity, rebar — generates resource-loaded inputs | **STAVAGENT** |
| **Schedule optimization** | Generative scheduling: 600M variants, optimize duration/cost/resource | **Alice Technologies** |

Alice предполагает что у пользователя **уже есть** scope breakdown, construction methods, cost info. Они оптимизируют. STAVAGENT **генерирует** эти inputs из engineering первых принципов.

**Complementary, not competitive.** STAVAGENT может быть upstream provider для Alice через MCP / API.

Alice profile: $47M Series B, Stanford spin-off (R. Morkos PhD), enterprise-only ($1B+ projects).

### 2.3 Где STAVAGENT уникален

| Capability | STAVAGENT | Top 50 competitors |
|---|---|---|
| Engineering calculations (DIN 18218, Saul, RCPSP, PERT) | ✅ | ❌ none |
| Triple access (UI + MCP + Agent API) | ✅ | ❌ none |
| Catalog systems (OTSKP, ÚRS, public norms integration) | ✅ | Partial (region-specific) |
| Concrete-specific engineering (25 formwork systems, 23 elements) | ✅ | ❌ none |
| End-to-end (TZ extract → bid → schedule → execution) | ✅ | Partial (each owns one slice) |
| Deterministic-first (confidence=1.00 over AI) | ✅ | ❌ AI-first |

### 2.4 Что про KROS (incumbent CZ)

KROS = SAP стройотрасли в ČR. Desktop legacy, manual entry, без AI, без agentic interface. STAVAGENT — поколение вперёд по архитектуре (agentic ready, cloud-native, AI-augmented), но KROS владеет market share через legacy.

Стратегия — **не replace KROS frontally**. Coexist через export/import. Через 3-5 лет, когда příprava generation switches, отъесть market by being agent-first.

---

## 3. Позиционирование

### 3.1 Three layers of narrative

**Layer 1 — what we are (technical):**
> Engineering calculation infrastructure for construction. 7 engines, 25 formwork systems, 23 element types, OTSKP database, exposed via UI / MCP / REST API.

**Layer 2 — why now (timing):**
> AI agents need engineering ground truth. LLMs hallucinate construction calculations. STAVAGENT is the deterministic layer agents call when they need formwork pressure or pour cycle, not when they need text generation.

**Layer 3 — go-to-market (commercial):**
> Launching in Czech/Slovak market (underserved, no direct competitor, founder relationships). Engines are universal — DACH expansion = catalog + language layer, not engine rewrite. Spain Phase 2 (Codigo Estructural / FIEBDC-3 mapped to existing engine inputs).

### 3.2 Pitch reframe для CSC 2026

**Старый pitch:**
> "AI co-pilot for Czech construction estimators replacing přípravář work"

**Новый pitch:**
> "Construction has many AI tools — document parsing (Aitenders), takeoff (Togal.AI), scheduling optimization (Alice Technologies), plan review (Buildcheck), field operations (Trunk Tools). None of them do the engineering calculations. STAVAGENT is the engineering calculation layer — formwork lateral pressure per DIN 18218, concrete maturity Saul model, RCPSP resource-constrained scheduling, PERT Monte Carlo risk, 25 formwork systems, 23 element types — exposed three ways: as UI for estimators, as MCP server for AI agents, as REST API for integration. AI tools above us can pull from STAVAGENT to make engineering decisions instead of guessing."

### 3.3 DACH / Spain expansion narrative

**Не "we adapted to German norms"** — это слабо.
**А "engines are universal, regional layer is plug-in"** — это сильно.

- DIN 18218 (German) — уже canonical в STAVAGENT. Wedge, не extension.
- Saul maturity model — universal physics, not regional.
- RCPSP, PERT — language-agnostic OR.
- BKI (Germany) — slot вместо ÚRS, тот же engine input format.
- Codigo Estructural RD 470/2021 (Spain) — слот вместо ČSN, FIEBDC-3 .bc3 как input format.

**Slide message:** "International expansion = adding catalog + language layer, not rewriting engines. Engines are universal physics + EU OR; regional norms are pluggable."

---

## 4. CSC 2026 Application

### 4.1 Ключевые даты

| Date | Event |
|---|---|
| **04.05.2026** | Official launch (today) |
| **28.06.2026** | **Application deadline** |
| **02.09.2026** | APAC Pitch Day (Singapore IBEW) |
| **01.10.2026** | Top 30 announcement |
| **09–11.11.2026** | Las Vegas Pitch Day (Trimble Dimensions) — 8 finalists |
| **16–19.11.2026** | European Pitch Day (Helsinki, Recotech / Slush) — 6 finalists |

**Realistic target:** European Pitch Day Helsinki. ~7 weeks до deadline.

### 4.2 Категории (CSC 2026 taxonomy — отличается от Top 50 taxonomy)

STAVAGENT попадает в **Preconstruction Tech**, sub-categories:

- ✅ Cost estimation & budgeting (core)
- ✅ Document management (SmartExtractor, TZ-to-Soupis)
- ✅ Planning & scheduling (Monolit-Planner Gantt + RCPSP)
- ✅ Tendering & bid management (přípravář flow)
- ✅ Risk assessment & scenario planning (PERT Monte Carlo)
- ⚠ Permitting & compliance (TKP/ČSN — partial)
- ⚠ BIM & Digital twins (tangential)

**Strategy:** multi-tag все 5 strong categories при подаче.

### 4.3 Партнёры 2026

Cemex Ventures, **BCA** (Building & Construction Authority Singapore — новый партнёр 2026, регулятор), Caterpillar, Dysruptek by Haskell, Ferrovial, Hilti Venture, VINCI's Leonard, NOVA by Saint-Gobain, Trimble, Zacua Ventures.

**Ключевые для STAVAGENT:** Ferrovial (Spain — твой target market), VINCI Leonard (France/EU contractor), Hilti (DACH formwork ecosystem), Trimble (BIM/digital).

### 4.4 Что нужно подготовить до 28.06.2026

**Already in plan (W3 — 08-14.05):**
- Pitch deck EN
- 60-second demo video
- MCP Claude Directory submission
- Custom GPT в GPT Store

**Critical additions для CSC pitch:**

1. **Engineering benchmark slide** — golden test где STAVAGENT 7-engine pipeline сравнивается с:
   - Manual calculation experienced přípravář
   - Generic LLM (Claude/Gemini без STAVAGENT) на том же TZ
   - (Optional) Alice Technologies output на том же сценарии
   
   Используй VP4 FORESTINA или SO-202 D6 most golden tests.

2. **"Why we are not a Czech tool" slide** — explicit. DIN 18218 = German. Saul = universal. RCPSP = generic OR. ČSN/TKP/ÚRS = pluggable slots → BKI/DIN/ÖNORM/Codigo Estructural.

3. **Triple access demo** — 30-second video where same engineering query goes through:
   - UI (přípravář flow)
   - Claude Desktop via MCP
   - Direct API call

4. **Competitive landscape slide** — таблица из §2.3 (capability × competitor). Ты единственный со всеми ✅.

5. **Outreach к Alice Technologies — до подачи** — см. §4.6.

### 4.5 Pitch deck — slide skeleton (~10 slides)

1. **Cover** — STAVAGENT, one-liner, founder, contact
2. **Problem** — přípravář spends 60-80% on manual calc / catalog lookup. AI tools hallucinate engineering. Gap between document AI и schedule AI.
3. **Solution** — engineering calculation layer with triple access. Visual: layered diagram (UI / MCP / API → Engine → Catalogs)
4. **Engineering depth** — 7 engines schematic with norms cited (DIN 18218, Saul, RCPSP, PERT, ČSN EN 1992)
5. **Demo** — 60s video (W3 deliverable)
6. **Why now** — agentic AI needs ground truth; MCP protocol just emerged; Cemex Top 50 says Enhanced Productivity = 64% of all 2025 deals
7. **Competitive landscape** — capability matrix (§2.3)
8. **Engineering benchmark** — STAVAGENT vs LLM vs manual on golden test
9. **Go-to-market** — Czech/SK launch wedge → DACH plug-in expansion → Spain Phase 2. Cemex pilot W4+. Lemon Squeezy billing live.
10. **Ask** — what we want from CSC (pilot, capital, network)

### 4.6 Outreach to Alice Technologies (до подачи!)

Email/LinkedIn к René Morkos, draft:

> Hi René — building STAVAGENT, an engineering calculation layer for construction (DIN 18218 formwork, RCPSP scheduling, etc) with MCP + REST API access. Looking at Alice's optioneering platform, I see clear synergy: STAVAGENT generates engineering-grounded inputs, Alice optimizes schedules across them. Would love a 20-min chat to explore integration possibilities — could be interesting for Alice users running concrete-heavy projects in DACH/EU where regional norms matter.

**Outcome regardless of response:**
- If positive → "Strategic partnerships in conversation: Alice Technologies" в pitch deck
- If no response → still proof of ecosystem-play maturity in deck
- Worst case → no harm done

### 4.7 Application form — likely fields (untested)

_to be confirmed when registering at constructionstartupcompetition.tech/register_

- Founder info, team size
- Stage, funding status
- Revenue / users / pilots
- Market size, competitors
- Categories (multi-select)
- Pitch video URL
- Pitch deck file
- Patent/IP status

---

## 5. Параллельные треки

### 5.1 YC Summer 2026 RFS (deadline ~04.05.2026)

**Status:** _to be decided — apply or pass_

**Best fit categories:**
- #3 AI-Native Service Companies (replacing přípravář work)
- #12 SaaS Challengers (vs KROS, Aitenders, Togal)
- #13 Software for Agents (MCP server)

**Pro:** YC application короткая (30-60 мин), strong product position, real revenue motion.
**Con:** Solo founder + сегодняшний deadline = rushed.

### 5.2 EU AI Act Compliance

**Risk classification:** Limited risk (transparency only). **Не в Annex III high-risk categories.** STAVAGENT — deployer of GPAI (Vertex AI / Bedrock / Perplexity), не provider.

**TODO до конца мая 2026:**
1. AI transparency banner в UI на каждом AI-touchpoint
2. Privacy policy update (Použití AI секция) на stavagent.cz
3. AI literacy документ (1 page, для compliance + onboarding)
4. Human-in-the-loop явно обозначен (přípravář decides)
5. Подписать DPA с Google Vertex AI, AWS Bedrock, Perplexity (free templates)

**Слайд для Cemex pitch:** "AI Act compliance: limited risk, not Annex III, deployer of GPAI, transparency disclaimers + confidence scoring + human-in-the-loop by design, EU data residency europe-west3."

**Caveat:** не юридическая оценка. Если enterprise клиент потребует formal compliance letter — чешский lawyer 2-3h консультации (~5–10k Kč).

### 5.3 Google for Startups Cloud — re-application

**Status:** заблокировано на политике "только корпоративный email".

**Action:** ответить с `info@stavagent.cz` коротко (без re-pitch), запросить link existing application к corporate domain. Draft в чате 04.05.2026.

**Pre-flight check:** проверить что отправка с info@ работает с правильным From-header (тест: отправить себе на gmail).

---

## 6. Action items / Roadmap

### 6.1 Эта неделя (04–10.05.2026, W1 продолжение)

- [ ] Ответить Google с info@stavagent.cz (готовый draft в чате)
- [ ] Зарегистрироваться на CSC 2026 (constructionstartupcompetition.tech/register)
- [ ] Outreach email к René Morkos (Alice Technologies)
- [ ] Решение по YC application (apply / pass)
- [ ] SmartExtractor Variant B — продолжение (5 golden TZ)

### 6.2 W2 (11–17.05.2026)

- [ ] SmartExtractor finalize → 5 TZ autofill gate
- [ ] EU AI Act transparency banner в UI
- [ ] Privacy policy update на stavagent.cz
- [ ] DPAs с AI providers подписать

### 6.3 W3 (18–24.05.2026) — pitch sprint

- [ ] Pitch deck EN draft (10 slides per §4.5)
- [ ] 60-second demo video
- [ ] Triple access demo (UI / MCP / API на одном engineering query)
- [ ] Engineering benchmark slide (VP4 FORESTINA или SO-202)
- [ ] MCP Claude Directory submission
- [ ] Custom GPT в GPT Store

### 6.4 W4+ (25.05.2026+) — Cemex + CSC submission

- [ ] Cemex CSC pilot pitch (parallel track to CSC competition)
- [ ] CSC 2026 application submit
- [ ] Libuše freelance final (deadline 11.05 — pre-W2)

### 6.5 Pre-deadline (do 28.06.2026)

- [ ] Iterate pitch deck based on early feedback
- [ ] Обновить traction numbers (revenue, users, pilots)
- [ ] Final video record
- [ ] Application submit + multi-tag categories

---

## 7. Open questions / decisions needed

_to be filled by Александр_

- [ ] Apply to YC Summer 2026 today? Y/N
- [ ] CSC 2026 target Pitch Day — Helsinki only, or also Las Vegas?
- [ ] Alice Technologies outreach — send today or wait until pitch deck ready?
- [ ] Pricing model для DACH expansion — same Lemon Squeezy credits, or new SaaS subscription?
- [ ] _add more as they emerge_

---

## 8. Appendix — links & references

- CSC 2026: https://constructionstartupcompetition.tech/
- Top 50 Contech 2026: https://www.cemexventures.com/top-50/
- Alice Technologies: https://www.alicetechnologies.com/
- YC RFS Summer 2026: (look up YC page)
- EU AI Act Annex III: https://artificialintelligenceact.eu/annex/3/
- Aitenders (closest direct competitor): _to add_
- Togal.AI: _to add_

---

## 9. Document versioning

| Date | Version | Author | Changes |
|---|---|---|---|
| 04.05.2026 | 0.1 | Claude (initial) + Alexander | Created from chat 04.05.2026: YC RFS, EU AI Act, CSC 2026, Top 50 analysis, Alice Technologies analysis, repositioning |
| _next_ | _0.2_ | _Alexander_ | _to fill_ |

---

_End of document. Edit freely below this line or above as needed._
