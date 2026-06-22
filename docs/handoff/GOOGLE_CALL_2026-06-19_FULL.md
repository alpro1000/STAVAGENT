# 📞 Google Cloud call — STAVAGENT — ПОЛНЫЙ документ

> **Это единый документ к звонку.** Всё в одном месте: как объяснить систему, что спросить,
> технические детали миграции, карта ИИ и плейбук. Раньше было 3 файла — слито сюда.
>
> **Cesta v repu:** `docs/handoff/GOOGLE_CALL_2026-06-19_FULL.md` · ветка `main`

**Datum hovoru:** pá 19. 6. 2026, 13:00–14:00 CEST
**Meeting:** meet.google.com/feg-wekz-rtx · tel. (PL) +48 22 163 92 98, PIN 440667539
**Organizátor:** Edyta Bryk (info@stavagent.cz / Karel Jakubec) · **Inženýr: Čech** → mluv česky.

**3 témata (z mailu):** 1) Vertex AI SDK → `google-genai` migrace · 2) review Cloud Run / Cloud SQL / Vertex · 3) Start Tier $2,000.

> **⏱️ Naléhavost:** žádná. 21.06 je jen **termín podání žádosti Cemex** (ne freeze produkce).
> Migrace removal je 24.06 jen ze SDK releasů — náš pin `==1.154.0` drží, prod nepadne. Timing = tvoje volba.

---
---

# 🟢 ČÁST 0 — PROSTĚ A JEDNODUŠE (čti před hovorem)

## A. Jak to u mě funguje — vysvětli za 1 minutu

> 🇷🇺 *(pro tebe)* STAVAGENT считает сметы для стройки. Загрузил ТЗ → программа достаёт работы, считает бетон, опалубку, арматуру, график. Внутри **5 маленьких серверов** на Cloud Run + **одна база** Cloud SQL Postgres. **ИИ (Gemini через Vertex) подключается последним**: сначала правила и каталоги, ИИ только советует и проверяет — специально, дёшево и предсказуемо. Поиск по нормам (ČSN/TKP) — через **эмбеддинги**: текст → числа → поиск похожего, числа в Postgres (pgvector).

> 🇨🇿 *(k vyslovení)* „STAVAGENT počítá stavební rozpočty. Nahraju zadávací dokumentaci, systém z ní vytáhne práce, spočítá beton, bednění, výztuž, harmonogram. Uvnitř je **5 malých služeb na Cloud Run + jedna Cloud SQL Postgres**. AI (Gemini přes Vertex) je až **poslední vrstva** — nejdřív běží pravidla a katalogy, AI jen radí a kontroluje. Schválně: levné a předvídatelné. Vyhledávání v normách jede přes **embeddings** — text se převede na čísla, hledá se podobnost, čísla jsou v Postgresu (pgvector)."

**Problém:** Google zavírá starou knihovnu pro Gemini → musím přejít na novou (`google-genai`).

## B. Co se chci zeptat — 6 otázek (stihneš-li jen 3 → **Q1, Q3, Q4**)

**Q1 — Nespadne mi to do 24.6.?** *(abys měl klid)*
- 🇷🇺 Старую библиотеку закрывают 24.06. Я заморозил рабочую версию. Прод продолжит работать после этой даты, если ничего не трогать? Дедлайн — про новые версии, не про отключение моего сервера?
- 🇨🇿 *„Staré SDK se odstraňuje 24. 6. Mám zapinovanou verzi 1.154.0. Když nic neudělám, produkce na Cloud Run pojede dál i po tom datu, že? Removal je jen z nových releasů, ne vypnutí běžícího?"*

**Q2 — Jak se teď správně připojit?** *(abys nepřepisoval poslepu)*
- 🇷🇺 Как создать клиент для Vertex без ключа (ADC на Cloud Run)? В доках то `vertexai=True`, то `enterprise=True` — какой правильный сейчас и работает ли старый как алиас?
- 🇨🇿 *„Jak vytvořit klienta pro Vertex přes ADC bez klíče na Cloud Run? V docs vidím `vertexai=True` i `enterprise=True` — který je teď platný a funguje ještě ten starý?"*

**Q3 — Můžu to udělat po částech?** *(rozbít riziko na 2 kroky)*
- 🇷🇺 ИИ у меня в двух местах: чат/советник и поиск по нормам (эмбеддинги). Могу перевести только чат, а эмбеддинги оставить на старом надолго — параллельно?
- 🇨🇿 *„AI mám na dvou místech: chat/poradce a vyhledávání v normách přes embeddings. Můžu přejít na nové SDK jen u chatu a embeddings nechat na starém, ať běží paralelně?"*

**Q4 — ⭐ Embeddings: jdu na plných 3072 přes `halfvec` — háček?** *(rozhodnuto: bez ořezu na 768)*
> Rozhodnutí: NEořezávat na 768. Jít na `gemini-embedding-001` v plných **3072 dim** → odpadá ruční
> normalizace i otázka ztráty kvality. pgvector `vector` má HNSW limit 2000 dim → obejít přes typ
> **`halfvec(3072)`** (HNSW až 4000 dim). Re-embed všech ~17 940 stejně nutný.
- 🇷🇺 Иду на `gemini-embedding-001` в полных 3072 (без обрезки — так нет ни нормализации, ни вопроса о потере качества). Колонку меняю `vector(768)` → `halfvec(3072)`, HNSW-индекс (лимит 2000 обхожу через halfvec). Re-embed всех ~17 940. Видишь подвох для Cloud SQL pg15? И `halfvec` точно есть в нашей версии pgvector?
- 🇨🇿 *„Půjdu na `gemini-embedding-001` v plných 3072 dim — sloupec `halfvec(3072)` + HNSW (limit 2000 obejdu přes halfvec). Re-embed všech ~17 940. Vidíš nějaký háček pro Cloud SQL pg15? A je `halfvec` v naší verzi pgvectoru?"*

**Q5 — Region a modely**
- 🇷🇺 Я в europe-west3. Какие модели Gemini там точно есть? `flash-lite` даёт 404. И ок ли location='europe-west3' или толкают 'global'?
- 🇨🇿 *„Jsem v europe-west3. Které Gemini modely jsou tam GA? `flash-lite` vrací 404. Je ok location='europe-west3', nebo se tlačí 'global'?"*

**Q6 — Kredity $2,000** *(byznys)*
- 🇷🇺 $2000 — на какой срок, покрывают Cloud Run + Cloud SQL или только Vertex? Апгрейд на больший тир позже? Старые $1000 суммируются?
- 🇨🇿 *„Těch $2,000 — na jak dlouho, pokrývají i Cloud Run + Cloud SQL, nebo jen Vertex inference? Jde později přejít na vyšší tier? Sčítá se to s předchozími $1,000?"*

---
---

# 🔧 ČÁST 1 — Technický stav migrace (záloha k otázkám)

## Co se mění — dvě staré knihovny → jedna nová

| Stará | K čemu | Náhrada |
|---|---|---|
| `google-generativeai` | Gemini přes API-klíč | `google-genai` |
| `vertexai.generative_models` (v `google-cloud-aiplatform`) | Gemini přes Vertex/ADC na Cloud Run | `google-genai` (`genai.Client`) |

## Soubory k úpravě (z code-recon)

**Krok A — chat:**
- `app/core/gemini_client.py` — hlavní, Vertex/ADC
- `app/integrations/gemini_client.py` — API-key
- `app/services/passport_enricher.py` — obě cesty
- `app/services/price_parser/llm_client.py` — **async** → `client.aio.models.generate_content`
- `app/api/routes_llm_status.py` — jen probe importy (triviální)

**Krok B — embeddings:**
- `app/integrations/vertex_embeddings.py` — `embed_content` v **3072 dim** + re-embed
- DB migrace: sloupec `vector(768)` → **`halfvec(3072)`** + nový HNSW index (žádná ruční normalizace)

**Naposled:** `requirements.txt` ř. 20/35/49 — odpinovat až po A+B.

## ⭐ STRATEGIE — dva nezávislé kroky

| Krok | Co | Kdy / proč |
|---|---|---|
| **A — kdykoli, bezpečný** | jen chat → `genai.Client`. Embeddings nechat na starém. | opraví init-collision, sundá SDK-risk, force-JSON jede, **ŽÁDNÝ re-embed** |
| **B — vědomě později** | embeddings → `gemini-embedding-001` v **3072** (`halfvec(3072)`) + re-embed ~17 940 | plná kvalita modelu #1, bez ořezu/normalizace; schema-migrace vector→halfvec (→ Q4) |

---

# 🤖 ČÁST 2 — Kde AI reálně běží (ověřeno živými MCP-testy 2026-06-19)

**Jedna vstupní brána:** `POST /api/v1/multi-role/ask` → orchestrátor → Vertex Gemini #1. Volají ji **4 služby** (Portal, URS, Registry, Monolit-advisor).

| Stav | Co | Důkaz |
|---|---|---|
| ✅ **LIVE** | deterministický klasifikátor | MCP `classify` → `mostovkova_deska` conf 0.9 (regex, NE AI) |
| ✅ **LIVE** | vyhledávání norem (Perplexity) | conf 0.85, reálné zdroje pjpk.rsd.cz |
| ✅ **LIVE** | advisor + kalkulačka (fusion) | plán: Top 50 DOKA, 4 záběry, 66.8 d, výztuž, normy |
| 🟡 **LIVE-v-kódu** | Multi-Role 5 rolí (Vertex) | zadrátováno + voláno 4 službami; runtime pod zátěží **neověřen** odsud (egress blok) |

**5 rolí:** DOCUMENT_VALIDATOR → STRUCTURAL_ENGINEER + CONCRETE_SPECIALIST + COST_ESTIMATOR → STANDARDS_CHECKER.
⚠️ **Desync čísel:** CLAUDE.md „4", landing „6", kód **5** → opravit zvlášť.

**Tvoje vize „nahraju ТЗ → AI rozhodne opalubku/dělení":** z 80 % postaveno. Opalubku + dělení dnes řeší **engine podle pravidel** (AI-last), AI jen radí. Chybí **šev advisor↔engine** — leží v backlogu: SmartInput PDF pipeline · `tz_facts` napojení · AI advisor v2.

---

# 📘 ČÁST 3 — Migrační playbook (kód z primárních zdrojů)

> Ověřeno: Google migration guide, PyPI `google-genai`, `python-genai` README, ai.google.dev/embeddings, Google blog.
> Co neověřeno → **`[OVĚŘIT]`**.

## Datum — POTVRZENO
> *„deprecated as of June 24, 2025 … removed on June 24, 2026"* — removal ze SDK releasů, pin drží.

## Klient (⚠️ NÁLEZ — parametr se změnil)
```python
from google import genai
# Aktuální PyPI + README ukazují enterprise=True (NE vertexai=True):
client = genai.Client(enterprise=True, project='PROJECT_ID', location='europe-west3')
```
Google přejmenoval Vertex AI generative → „Gemini Enterprise Agent Platform". ADC beze změny.
**`[OVĚŘIT]`** přijímá SDK ještě `vertexai=True` jako alias? (→ Q2)

## Gemini-chat
```python
from google.genai import types
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents='...',
    config=types.GenerateContentConfig(
        system_instruction='...', temperature=0.3,
        response_mime_type='application/json',   # force-JSON pro MCP advisor — PODPOŘENO
    ),
)
# async (price_parser): client.aio.models.generate_content(...)
```

## Embeddings (krok B) — ROZHODNUTO: plných 3072, BEZ ořezu

```python
from google.genai import types
resp = client.models.embed_content(
    model='gemini-embedding-001',
    contents=['text 1', 'text 2'],              # list = batch
    config=types.EmbedContentConfig(
        task_type='RETRIEVAL_DOCUMENT',         # 'RETRIEVAL_QUERY' pro dotazy
        # output_dimensionality NEnastavovat → default 3072 (plná kvalita)
    ),
)
# ŽÁDNÁ ruční normalizace — ta byla nutná JEN při ořezu na dim≠3072.
# Na nativních 3072 model normalizuje sám.
```

**DB strana (jednorázová migrace):**
```sql
-- pgvector `vector` má HNSW limit 2000 dim → 3072 jen přes halfvec (limit 4000):
SELECT extversion FROM pg_extension WHERE extname='vector';   -- musí být >= 0.7.0 (jinak ALTER EXTENSION vector UPDATE)
ALTER TABLE <tab> ALTER COLUMN embedding TYPE halfvec(3072);
CREATE INDEX ON <tab> USING hnsw (embedding halfvec_cosine_ops);
```
Storage ~6 KB/vektor × 17 940 ≈ 108 MB (zanedbatelné).

## ⚠️ Tři nálezy z dokumentace (které stará rešerše neměla / měla špatně)
1. **Klient = `enterprise=True`**, ne `vertexai=True` (rebrand). → Q2.
2. **Volíme 3072 (halfvec)** místo ořezu na 768 → odpadá ruční L2-normalizace (ta hrozila jen při dim≠3072) i otázka ztráty kvality. pgvector `vector` neumí index >2000 dim, proto **`halfvec(3072)`** (HNSW limit 4000). → Q4.
3. **Async** se přesouvá na `client.aio.models.*` (týká se `price_parser`).

## Co se NEMĚNÍ
SQL dotazy (cosine) · retrieve→prefilter→ranking · MCP kontrakty · Cloud Run · Cloud SQL.
(pgvector sloupec + index se PŘI kroku B mění: `vector(768)` → `halfvec(3072)`.)

## Ověřovací TODO před implementací (ne před hovorem)
- [ ] `enterprise=True` vs `vertexai=True` — co je v nainstalované verzi (`python -c` test)
- [ ] **pgvector >= 0.7.0** (kvůli `halfvec`) — `SELECT extversion …`; jinak `ALTER EXTENSION vector UPDATE`
- [ ] `response_schema` vs `response_json_schema` — přesný název v `GenerateContentConfig`
- [ ] přesný batch-strop `embed_content` + quota rpm
- [ ] clean `pip install -r requirements.txt` ve fresh venv (pin → transitive konflikt)

---

# 🎯 ČÁST 4 — Co ukázat při architecture review

- **AI-last** filozofie (determinismus > LLM) — levné na inference, předvídatelné.
- **20 MCP nástrojů** + **orchestrátor (stage-gating)**: workflow jako data (YAML), deterministické přechody, HITL, audit/replay.
- **5 Cloud Run** (europe-west3) + **Cloud SQL pg15 + pgvector** + Vertex; LLM řetěz Vertex→Bedrock→Gemini API→Claude→Perplexity.
- **Cloud SQL** je teď ZONAL (sníženo z REGIONAL kvůli ceně) — možná otázka na HA v rámci kreditů.
- `concrete-agent` má `min-instances=0` (cena) → cold-start ztrácí in-memory KB cache — otázka na balanc.

## Zdroje (čteno 2026-06-19)
- Google Cloud genai migration guide · [google-genai PyPI](https://pypi.org/project/google-genai/) · [python-genai README](https://github.com/googleapis/python-genai) · [ai.google.dev embeddings](https://ai.google.dev/gemini-api/docs/embeddings) · [Gemini Embedding GA blog](https://developers.googleblog.com/gemini-embedding-available-gemini-api/)

> ⚠️ V kořenovém `CLAUDE.md` je MCP „9 tools" — **zastaralé**, v kódu jich je **20** (`EXPECTED_TOOLS`). Opravit zvlášť.
