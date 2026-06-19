# Google Cloud call — STAVAGENT — příprava / подготовка

**Datum hovoru:** pá 19. 6. 2026, 13:00–14:00 CEST
**Meeting:** meet.google.com/feg-wekz-rtx · tel. (PL) +48 22 163 92 98, PIN 440667539
**Organizátor:** Edyta Bryk (info@stavagent.cz / Karel Jakubec)
**Inženýr:** Čech → hlavní část hovoru vést **česky** (RU verze níže pro Alexandra).

**3 témata (z mailu):**
1. Vertex AI generative SDK → `google-genai` migrace
2. Quick review architektury Cloud Run / Cloud SQL / Vertex
3. Start Tier — $2,000 kreditů

---
---

# 🇨🇿 ČESKÁ VERZE (pro inženýra)

## 1. Co je ta migrace — stav v našem kódu

Google sjednocuje **dvě staré knihovny** do jedné nové:

| Stará knihovna | K čemu | Náhrada |
|---|---|---|
| `google-generativeai` (`import google.generativeai`) | Gemini přes API-klíč | `google-genai` (`from google import genai`) |
| `vertexai.generative_models` (uvnitř `google-cloud-aiplatform`) | Gemini přes Vertex / ADC na Cloud Run | `google-genai` — `genai.Client(vertexai=True, ...)` |

V kódu máme **dvě volací plochy** + embeddings, dohromady **6 souborů**:

**A) API-key cesta** (`genai.configure` + `GenerativeModel`):
- `app/integrations/gemini_client.py` — ř. 10, 28, 31, 34, 144
- `app/services/price_parser/llm_client.py` — ř. 195, 199–200, 202 (`generate_content_async`)
- `app/services/passport_enricher.py` — ř. 33, 255, 260, 714

**B) Vertex / ADC cesta** (`vertexai.init` + `VertexGenerativeModel`) — běží na Cloud Run bez klíče:
- `app/core/gemini_client.py` — ř. 17, 24–25, 46, 73, 107, 285, 418–427 (`vertexai.init` ADC), 447–449, 507, 625 (`Part`), 635 — **hlavní soubor**
- `app/services/passport_enricher.py` — ř. 341–342, 368–370, 381, 894

**C) Embeddings** (samostatná cesta, `TextEmbeddingModel`):
- `app/integrations/vertex_embeddings.py` — ř. 50–51, 53–54, 59 (`TextEmbeddingInput`), pgvector 768 dim

**D) Health-check importy** (triviální, jen probe):
- `app/api/routes_llm_status.py` — ř. 66, 72

**Pinned v `requirements.txt`:**
- ř. 20 `google-generativeai==0.8.3`
- ř. 35 `google-cloud-aiplatform==1.154.0` — **zmrazeno** ("frozen for Cemex window … Unfreeze after google-genai migration, vertexai removal 2026-06-24")
- ř. 49 `google-auth>=2.47.0`

## 2. Co potřebuju potvrdit / zeptat se

1. **Datum odstranění `vertexai.*`** — máme v poznámce **24. 6. 2026**. Je to reálné *removal*, nebo jen deprecation a reálné vypnutí je později? (Tohle určuje, jestli migrujeme tento týden, nebo máme klid.)
2. **Vertex + ADC na Cloud Run v novém SDK** — je `genai.Client(vertexai=True, project=…, location="europe-west3")` kanonická náhrada za náš `vertexai.init()` + `GenerativeModel`? Bez API-klíče, čistě přes service-account ADC.
3. **Embeddings** — `TextEmbeddingModel.from_pretrained` → jaký je ekvivalent v `google-genai`? Zachováme **768 dim** kvůli pgvector sloupci (nesmí driftnout).
4. **Region europe-west3** — `gemini-2.5-flash-lite` nám vrací 404. Které modely jsou v euw3 GA i po migraci? Používáme `gemini-2.5-flash` (default) + `gemini-2.5-pro` (heavy).
5. **`response_mime_type: application/json`** (force-JSON) — podporováno v novém SDK na Vertex cestě? Potřebujeme to pro MCP advisor.

## 3. Architektura — co ukázat při review

- **STAVAGENT** = SaaS pro stavební rozpočty (CZ/SK), filozofie **AI-last**: nejdřív regex + katalogy (OTSKP 17 904 / ÚRS 39 000+), LLM až jako fallback. Confidence se nikdy nepřepíše nižší hodnotou.
- **5 backendů na Cloud Run** (europe-west3) + 4 frontendy na Vercelu.
- **Cloud SQL PostgreSQL 15** (1 instance `stavagent-db`, 3 databáze) — teď **ZONAL** (sníženo z REGIONAL kvůli ceně) + **pgvector**.
- **LLM řetěz:** Vertex AI Gemini (primary) → Bedrock → Gemini API → Claude → OpenAI.
- **MCP Server** — **20 nástrojů** (FastMCP, mount `/mcp`), OAuth 2.0 + PKCE S256, Postgres backend, per-tool billing.
- **Orchestrátor (stage-gating) nad nástroji** — `app/services/stage_gating/`: tenká deterministická smyčka, která jako jediná vlastní session-state; workflow jako **data (YAML)**, ne kód; intent-classifier → workflow → state-machine s HITL pauzami; policy gateway vynucuje per-stage allow-listy nástrojů. Tools zůstávají „hloupé", stav mění jen orchestrátor → umožní replay/audit.

## 4. Otázky k programu / kreditům

1. $2,000 — který přesně tier, na jak dlouho platnost, a jde později přejít na vyšší Start Tier ($25k / $100k)?
2. Pokrývají kredity i **Cloud SQL + Cloud Run**, nebo jen Vertex AI inference?
3. Máme i $1,000 GCP z dřívějška — sčítá se to?
4. Cold-start: `concrete-agent` držíme `min-instances=0` kvůli ceně, ale ztrácíme in-memory KB cache. Doporučení na balanc cena/latence v rámci kreditů?
5. Cloud SQL ZONAL vs HA — levná/free varianta vyšší dostupnosti v rámci programu?

---
---

# 🇷🇺 РУССКАЯ ВЕРСИЯ (для Александра)

## Суть звонка
Google даёт **$2,000 кредитов** (Start Tier) + заодно ревью архитектуры. Инженер — **чех**, основную часть веди по-чешски (выше). Главная техническая тема — переписать вызовы Gemini с **двух старых SDK на один новый `google-genai`**.

## Что такое миграция (просто)
Раньше было два «кабеля» к Gemini: `google.generativeai` (по API-ключу) и `vertexai` (через Vertex/ADC на Cloud Run). Google их **выкидывает** и заменяет одним `google-genai`. Логика та же — меняется только как создаётся клиент и зовётся модель.

## 🚨 Срочность
В `requirements.txt` (твой же комментарий): **удаление `vertexai.*` — 24 июня 2026**. Сегодня 19-е → **5 дней**. Сейчас ты «заморозил» `google-cloud-aiplatform==1.154.0` (последняя версия со старыми модулями) — это костыль. **Первый вопрос инженеру — подтвердить эту дату** (по вашему же правилу: SDK-даты проверять у первоисточника, не по памяти — один раз дата уже была неверной).

## Что переписывать (проверено по коду)
- **6 рабочих файлов**, 2 поверхности вызова + embeddings (полный список с номерами строк — в чешской части §1).
- Главный файл — `app/core/gemini_client.py` (Vertex/ADC путь на Cloud Run).
- Embeddings (`vertex_embeddings.py`) — отдельная история, **держать 768 dim** ради pgvector.
- `routes_llm_status.py` — тривиально (только health-probe импорты).

## 5 вопросов инженеру (техника)
1. Реальная дата removal `vertexai` — 24 июня или позже?
2. Vertex+ADC в новом SDK = `genai.Client(vertexai=True, project, location)`? Без ключа.
3. Embeddings: чем заменить `TextEmbeddingModel`, сохранив 768 dim?
4. Какие модели GA в **europe-west3** (у тебя `flash-lite` даёт 404)?
5. Force-JSON (`response_mime_type`) поддержан на Vertex-пути? Нужно для MCP advisor.

## 5 вопросов про программу/деньги
1. $2,000 — какой тир, срок, апгрейд до $25k/$100k?
2. Кредиты покрывают Cloud SQL + Cloud Run или только Vertex inference?
3. Старые $1,000 GCP суммируются?
4. Cold-start `min-instances=0` vs in-memory KB cache — что советуют?
5. Cloud SQL ZONAL → дешёвый HA в рамках программы?

## Чем похвастаться на ревью (твои козыри)
- **AI-last** философия (детерминизм > LLM) — Google это любит, дёшево по inference.
- **20 MCP-инструментов** + **слой оркестратора** (stage-gating: workflow как данные, детерминированная смена состояний, HITL, audit/replay).
- **5 Cloud Run + Cloud SQL pg15 + pgvector + Vertex**, многоуровневый LLM-fallback.

---

# 🔑 Co se REÁLNĚ změní po přechodu na google-genai (a doporučená strategie)

> Numerické SDK detaily níže pocházejí z Google vertex-ai-samples / uživatelské rešerše,
> **nejsou re-verifikovány touto session** → na hovoru potvrdit u inženýra (označeno „ověřit").

**1. Auth + region — čistší, a léčí náš bug.** Nový vzor:
`client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)`.
Region jde **explicitně do klienta**, ne přes globální `vertexai.init()`. → embeddings i Gemini-chat
dostanou **nezávislé klienty s nezávislým regionem**, a celý třída bugů s globálním init-collision
**strukturálně mizí**. ADC beze změny (bez klíče). Vzor **potvrzen** v Google samples.

**2. Embeddings — volání se mění, 768-dim se drží parametrem.**
Bylo: `TextEmbeddingModel.from_pretrained(...).get_embeddings(...)`.
Bude: `client.models.embed_content(model="gemini-embedding-001", contents=[...],
config=EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT", output_dimensionality=768))`.
⚠️ `gemini-embedding-001` má **default 3072-dim** → `output_dimensionality=768` MUSÍ být explicitně,
jinak pgvector sloupec nesedí. (ověřit default 3072)

**3. Re-embed je POVINNÝ** i při stejném 768 — `gemini-embedding-001` ≠ `text-multilingual-embedding-002`,
jiný vektorový prostor. Všech ~17 940 přeembedovat. To je práce, ne řádek.

**4. Batch limit + quota** (ověřit): ~5 textů/volání + 60 req/min pro nové projekty → ingest-skript
přepsat na limit 5; re-embed bude **pomalejší** než minulý běh. Založit čas.

**5. Nemění se:** pgvector schéma, HNSW index, SQL, retrieve→prefilter→ranking, MCP kontrakty,
Cloud Run / Cloud SQL. Migrace = jen embed-volání + Gemini-volání, NE architektura.

## ⭐ Doporučená strategie — rozdělit migraci na DVA kroky

Datum 24.06 je o SDK-releasech, náš pin `==1.154.0` drží. Proto NEtahat oba kusy najednou:

| Krok | Co | Proč teď / proč počkat |
|---|---|---|
| **1 (hned)** | Gemini-chat → `genai.Client(vertexai=True)` | opraví init-collision, sundá SDK-risk, žádný re-embed |
| **2 (vědomě později)** | embeddings → `gemini-embedding-001` + re-embed 17 940 | drahé + riziko kvality, dělat až s rozmyslem |

**Otázka na inženýra (klíčová):** je podporovaný **hybrid** — `genai` pro chat + starý
`TextEmbeddingModel` pro embeddings paralelně po dobu přechodu? Pokud ano → rozbije rizikovou
migraci na dva bezpečné kroky.

**Druhá otázka (kvalita 768):** `gemini-embedding-001` je optimalizován na 3072. Náš retrieve dává
cosine ~0.82 na 768 (text-multilingual-embedding-002). Neklesne kvalita po oříznutí na 768? Nebo
pro katalog raději zůstat na `text-multilingual-embedding-002` co nejdéle?

---

> ⚠️ В корневом `CLAUDE.md` MCP всё ещё описан как «9 tools» — это **устарело**, по коду их **20** (`EXPECTED_TOOLS` в `tests/test_mcp_compatibility.py`). Поправить в отдельной сессии.
