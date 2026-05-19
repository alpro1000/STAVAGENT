# TASK: Google for Startups AI Agents Challenge — анализ соответствия STAVAGENT и предложение темы submission

## Мантра

Сначала читаешь весь репозиторий и все входные материалы. Потом сопоставляешь что есть со
что требуется. Потом предлагаешь тему submission. Не пиши код в этом задании.
Не создавай новые модули, файлы, таблицы. Это **аналитический deliverable**, а не
implementation. Karpathy rules: не предполагать, минимум выводов на основе фактов в репо,
хирургические рекомендации, цель-ориентированный output.

## Pre-implementation interview

Перед началом анализа задай пользователю следующие вопросы через AskUserQuestion и дождись
ответов. Не начинай работу пока не получишь ответы:

1. **Какой трек submission предпочтителен** (Track 1 Build Net-New / Track 2 Optimize / Track 3
   Refactor for Marketplace / "решай сам на основе анализа")?
2. **Сколько часов в неделю реально выделить** на хакатон в течение следующих 3 недель,
   учитывая параллельные приоритеты (Žihle tender 2 июля, Cemex CSC pitch 28 июня, MCP
   completion + cross-user isolation P0, Libuše Phase 7a/8)?
3. **Какой готовый материал можно переиспользовать без модификации** (текущий MCP server v1.0,
   Vertex AI Gemini Flash integration, Žihle pilot artifacts, calculator engines), а что
   разрешено переписывать?
4. **Кто аудитория demo video** — судьи Google Cloud (фокус технический, MCP/ADK/Gemini) или
   потенциальные customers (фокус business case, construction estimators)?

## Контекст

STAVAGENT — это AI-платформа для строительной сметы и документации в Чехии/Словакии,
которую строит соло-founder Александр. Репозиторий `alpro1000/STAVAGENT`, 1500+ коммитов.

Хакатон **Google for Startups AI Agents Challenge** — это глобальная 6-недельная asynchronous
competition (22 апреля — 5 июня 2026), запущенная Google Cloud на Next '26. Призовой пул
$90,000+ ($60K cash + $37.5K Cloud credits + $500 credits всем eligible startups). Три трека:

- **Track 1 — Build (Net-New Agents):** новый автономный агент с нуля на ADK / LangChain /
  CrewAI, обязательная демонстрация Model Context Protocol для подключения к external tools.
- **Track 2 — Optimize (Existing Agents):** existing experimental agent с edge case
  problems, доводится до production reliability через optimization tools.
- **Track 3 — Refactor for Google Cloud Marketplace & Gemini Enterprise:** existing functional
  agent рефакторится под архитектурные требования Google Cloud ecosystem для listing на
  Google Cloud Marketplace + Gemini Enterprise app.

Judging criteria: Technical Implementation 30%, Business Case 30%, Innovation 20%, Demo 20%.

Александр получил персональный guest invite от Devpost для рассылки — это значит он в Google
CRM как активный GCP user, но никаких pre-qualification преимуществ это не даёт. Сейчас
~3 недели до deadline. Регистрация даёт $500 Google Cloud credits автоматически.

## Входные материалы

Все эти материалы **обязательны к прочтению** перед формированием рекомендации. Не пропускай:

1. **Репозиторий `alpro1000/STAVAGENT`** — текущее состояние Core Engine, MCP server v1.0,
   calculator engines, parsers, knowledge base, kiosks (Portal / Registry / Monolit-Planner).
2. **`STAVAGENT_Project_Knowledge_Snapshot.md`** — общий снимок проекта.
3. **`STAVAGENT_Master_Brief.md`** — стратегическое позиционирование.
4. **`STAVAGENT_Competitive_Landscape_Cemex_CSC.md` и `_RU.md`** — конкурентный анализ Tier 1–5
   для подготовки Cemex CSC pitch. Содержит positioning матрицу и три угла позиционирования.
5. **`STAVAGENT_DACH_Addendum.md`** — разбор GAEB, STLB-Bau, BKI, SIRADOS, NEVARIS и
   стратегия выхода в DACH.
6. **`CALCULATOR_PHILOSOPHY.md`, `calculator_complete_pipeline.md`, `calculator_element_logic_v4_FINAL.md`** —
   философия 7-engine pipeline и логика расчёта элементов.
7. **`document-bridge-architecture.md`, `object-types-taxonomy.md`** — таксономия 22→23 типов
   элементов и архитектура document bridge.
8. **`TASK_MCP_Server_AllModules.md`, `TASK_MCP_Deploy_Auth_Billing_Listings.md`,
   `TASK_MCP_PricingSync_FastMCPMount.md`, `TASK_MCP_SchemaEnrichment_GoldenValidation.md`** —
   текущее состояние MCP server v1.0, его 9 tools, auth, billing.
9. **Источники по хакатону** (web-доступ):
   - <https://cloud.google.com/blog/topics/startups/startups-are-building-the-agentic-future-with-google-cloud>
   - <https://cloud.google.com/blog/topics/startups/the-top-startup-announcement-from-next26>
   - <https://cloud.google.com/blog/products/ai-machine-learning/partner-built-agents-available-in-gemini-enterprise>
   - <https://goo.gle/486nbl4> (страница регистрации)

## Бизнес-задача

Произвести структурированный анализ и предложить **конкретную тему submission** для
Google for Startups AI Agents Challenge, которая удовлетворяет всем критериям:

а) технически реалистична в runway 3 недели (с учётом параллельных приоритетов);
б) максимизирует переиспользование того что уже построено в STAVAGENT;
в) удовлетворяет formal requirements Google по конкретному выбранному треку;
г) усиливает (не конкурирует с) Cemex CSC pitch, который deadline через 23 дня после Google;
д) демонстрирует agentic behavior, а не просто LLM-wrapper или AI-powered pipeline.

## Шаги анализа (выполнить в этом порядке)

### Шаг 1 — Инвентаризация существующих активов STAVAGENT

Пройди репозиторий и составь честный список **что реально работает в production** vs **что
заявлено в документации но не задеплоено**. Особое внимание:

- MCP server: сколько tools реально функционирует, какая auth, какой billing flow,
  какие deployment targets (Cloud Run? local?).
- Vertex AI Gemini Flash: где именно используется, насколько глубоко интегрирован, какие
  prompts, какие fallback (Bedrock Claude, Perplexity).
- Document parsing pipeline: какие типы документов реально обрабатываются end-to-end
  (TZ, soupis, výkaz výměr, statika, drawings).
- Calculator engines: 7-engine pipeline работает или только частично, на каких пилотах
  валидирован (Žihle complete, hk212, Libuše).
- Orchestration layer: есть ли где-то логика которая **сама** решает какие tools вызывать в
  каком порядке (это признак agent), или всё driven by explicit user clicks / hardcoded
  pipelines.

Не описывай это как "у нас уже всё есть". Опиши честно с уровнями зрелости.

### Шаг 2 — Маппинг требований Google по каждому треку на существующие активы

Для **каждого** из трёх треков составь таблицу: что Google требует → что у STAVAGENT есть →
gap → estimate effort на закрытие gap в человеко-часах.

Учитывай определение "agent" по Google: autonomous system с multi-step reasoning,
подключающаяся к external tools через MCP, gathers context, executes tasks autonomously.
"Move from static code to declarative intent" — то есть decision-making logic должна быть
declarative (LLM-driven), а не hardcoded.

Это критический шаг. Если STAVAGENT core — это deterministic pipeline с LLM fallback (как
сформулировано в принципах проекта), то по строгому определению Google это **не agent**, это
**tool provider for agents**. Это влияет на выбор трека.

### Шаг 3 — Конкурентный анализ среди уже зарегистрированных submissions

Просмотри страницу хакатона на Devpost (если public registry submissions доступен) или Google
Cloud Marketplace Agent Gallery (Acalvio, Accenture, Adobe, Atlassian, Deloitte, Lovable,
Oracle, Palo Alto Networks, Replit, S&P Global, Salesforce, ServiceNow, Workday).

Цель — понять плотность конкурентов в вертикали construction / preconstruction / estimating
и оценить unique angle STAVAGENT.

### Шаг 4 — Выбор трека с обоснованием

На основе шагов 1–3 предложи трек с письменным обоснованием. Если рекомендуется Track 3 —
объясни почему именно "refactor for Marketplace" даёт максимальный leverage существующих
активов. Если рекомендуется Track 1 — объясни какая часть существующего кода становится tool
provider для нового agent layer'а. Если рекомендуется не submit вообще (только зарегистрироваться
за $500 credits) — объясни обоснование на основе оценки рисков.

### Шаг 5 — Формулировка темы submission

Если выбран трек submit'а, сформулируй конкретную тему в формате:

- **Название агента** (короткое, для Devpost)
- **One-line description** (что делает в одном предложении)
- **Target user** (конкретно: чешский přípravář? European estimator? больше?)
- **Business problem solved** (с цифрами из реального опыта — Žihle 10.59M, 154 položek, etc)
- **Agentic behavior** — какие autonomous decisions агент принимает, какие tools вызывает,
  в каком порядке (это критично для technical 30% criterion)
- **Tech stack** (что из STAVAGENT переиспользуется, что добавляется: ADK / LangChain / Gemini)
- **MCP integration story** (если Track 1) или **Marketplace listing story** (если Track 3)
- **Demo scenario** — какой live workflow показывает video demo, на каком реальном кейсе

### Шаг 6 — Plan реализации в 3 недели

Разбей runway на недели:

- Неделя 1: что должно быть готово к концу
- Неделя 2: что должно быть готово к концу
- Неделя 3 (включая submission week): что должно быть готово к концу + buffer на запись
  demo video + написание submission текста + sanity check

Учитывай параллельные приоритеты. **Не закладывай работу которая блокирует Cemex CSC pitch
deadline 28 июня или Žihle tender deadline 2 июля.** Если такой блокировки не избежать —
явно укажи trade-off.

### Шаг 7 — Risk register

Перечисли **минимум 5 рисков** с указанием likelihood / impact / mitigation:

- Технические риски (например, ADK API нестабильно, MCP integration с Gemini Enterprise сырая)
- Time риски (deadline conflicts, parallel pressures)
- Eligibility риски (что значит "eligible startup" — нужно ли incorporated entity, есть ли
  у Александра подходящая юридическая форма)
- IP / usage rights риски (что Google требует по правам на submission)
- Repositioning риски (что submission будет противоречить Cemex CSC pitch positioning)

### Шаг 8 — Synergy / conflict с Cemex CSC

Объясни как submission темы либо усиливает Cemex CSC pitch (через 23 дня после Google
deadline), либо конфликтует. Если конфликт — предложи как избежать. Если synergy — предложи
какие артефакты Google submission'а можно напрямую переиспользовать в Cemex deck.

## Что должно быть в результате

**Один аналитический документ** (markdown) в репозитории, который содержит:

1. Executive summary (15 строк, вердикт + ключевые трейд-оффы)
2. Asset inventory (Шаг 1)
3. Track requirements mapping table (Шаг 2)
4. Competitive analysis (Шаг 3, если данные доступны)
5. Track choice + rationale (Шаг 4)
6. Submission theme spec (Шаг 5)
7. 3-week implementation plan (Шаг 6)
8. Risk register (Шаг 7)
9. Cemex CSC synergy/conflict analysis (Шаг 8)
10. Open questions для Александра (что нужно решить перед стартом)

Документ должен быть **готов к чтению Александром за 20 минут** и **готов служить spec'ом для
последующих coding-сессий**, если Александр решит идти в submission.

## Domain rules / контекстные принципы

- **Принцип STAVAGENT "детерминизм прежде AI":** regex confidence=1.0, LLM как fallback. Это
  философия проекта. Если submission требует противоречить этому принципу — явно укажи.
- **Multi-provider AI:** Vertex AI Gemini Flash primary → AWS Bedrock Claude Sonnet fallback →
  Perplexity для search_norms. Google хочет Gemini-centric stack. Учти это в anализе.
- **Cemex CSC pipeline в memory** — не дублируй уже сделанную работу по конкурентам, citируй
  готовые документы.
- **"AVA-программы" в DACH контексте, "KROS" в CZ контексте** — STAVAGENT позиционируется
  как AI-слой над incumbents, не как replacement. Submission тема должна это уважать.
- **MCP уже у Александра в roadmap для Claude Directory submit** — Google Cloud Marketplace
  listing через Track 3 это **аналогичная стратегическая активность**. Не дублирующая работа.

## Чего НЕ делать

- **Не писать код.** Это deliverable — markdown-документ с анализом и планом, не реализация.
- **Не предлагать новые модули, схемы БД, таблицы или API endpoints.** Если они нужны —
  упоминай их в business-logic терминах в plan'е, без конкретных имён.
- **Не игнорировать параллельные приоритеты.** Если submission требует 60 часов в неделю, а
  у Александра только 20 свободных — план должен это отразить.
- **Не предполагать что STAVAGENT — это уже agent.** Делать честную оценку.
- **Не предлагать Track 1 "Build Net-New" если это потребует переписать половину
  существующих pipeline'ов.** Если real fit — это Track 3, признать это.
- **Не давать рекомендацию "точно submit" или "точно skip" без четкого обоснования
  trade-offs.** Решение принимает Александр.
- **Не выдумывать данные** про судей, prize distribution per track, eligibility если их
  нет в публичных источниках. Эти gaps честно указать как "уточнить после регистрации".
- **Не пытаться парсить файлы PDF из репо или из uploads** — это аналитический документ, не
  document processing task.

## Acceptance criteria

- AC1: Документ существует в репозитории и содержит все 10 секций из "Что должно быть в
  результате".
- AC2: Track choice имеет письменное обоснование на основе шагов 1–3 анализа, не subjective.
- AC3: Submission theme spec содержит все 8 атрибутов из Шага 5.
- AC4: 3-week implementation plan имеет недельные deliverables и явно отражает параллельные
  приоритеты.
- AC5: Risk register содержит минимум 5 рисков с likelihood/impact/mitigation для каждого.
- AC6: Документ не содержит конкретных имён переменных, файлов, классов, таблиц для
  будущей реализации — только business-logic описания.
- AC7: Все факты про хакатон сверены с источниками из секции "Входные материалы" (Google
  Cloud Blog) и явно цитируются.
- AC8: Документ читается за 20 минут максимум.

## Final naming rule

Имя файла deliverable, его расположение в репозитории, и любые названия упомянутых
компонентов определяй по существующим конвенциям проекта (типично `TASK_*.md` или
`ANALYSIS_*.md` в корне или в `docs/`). Не создавай параллельную структуру. Встраивайся в
существующий контекст.
