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

**Q4 — ⭐ NEJDŮLEŽITĚJŠÍ: měnit vůbec model embeddings?** *(jediné, co dokumentace neřeší)*
- 🇷🇺 Поиск по нормам сейчас на `text-multilingual-embedding-002`, вектор 768, качество ~0.82. Новая `gemini-embedding-001` по умолчанию 3072, можно обрезать до 768. Не упадёт ли качество на обрезанных 768 против моей модели? Или лучше остаться на старой подольше? И правда, что у новой обрезанный вектор надо самому L2-нормализовать?
- 🇨🇿 *„Vyhledávání jede na `text-multilingual-embedding-002`, 768 dim, cosine ~0.82. Nový `gemini-embedding-001` má default 3072, jde oříznout na 768. Neklesne kvalita retrievalu na 768 proti té mojí? Nebo zůstat na staré co nejdéle? A musím u `gemini-embedding-001` oříznutý vektor sám L2-normalizovat?"*

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
- `app/integrations/vertex_embeddings.py` — `embed_content` + L2-norm + re-embed

**Naposled:** `requirements.txt` ř. 20/35/49 — odpinovat až po A+B.

## ⭐ STRATEGIE — dva nezávislé kroky

| Krok | Co | Kdy / proč |
|---|---|---|
| **A — kdykoli, bezpečný** | jen chat → `genai.Client`. Embeddings nechat na starém. | opraví init-collision, sundá SDK-risk, force-JSON jede, **ŽÁDNÝ re-embed** |
| **B — vědomě později** | embeddings → `gemini-embedding-001` + 768 + L2-norm + re-embed ~17 940 | drahé + riziko kvality; jen když dává smysl (→ Q4) |

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

## Embeddings (krok B)
```python
from google.genai import types
import numpy as np
resp = client.models.embed_content(
    model='gemini-embedding-001',
    contents=['text 1', 'text 2'],              # list = batch
    config=types.EmbedContentConfig(
        task_type='RETRIEVAL_DOCUMENT',         # 'RETRIEVAL_QUERY' pro dotazy
        output_dimensionality=768,              # ⚠️ default 3072 → MUSÍ explicitně
    ),
)
v = np.array(resp.embeddings[0].values)
v = v / np.linalg.norm(v)                       # ⚠️ NÁLEZ: gemini-embedding-001 nenormalizuje sám pro dim≠3072
```

## ⚠️ Tři nálezy z dokumentace (které stará rešerše neměla / měla špatně)
1. **Klient = `enterprise=True`**, ne `vertexai=True` (rebrand). → Q2.
2. **gemini-embedding-001 vyžaduje ruční L2-normalizaci** pro 768 — jinak se rozbije cosine v pgvectoru (náš retrieve 0.82 by spadl). → Q4.
3. **Async** se přesouvá na `client.aio.models.*` (týká se `price_parser`).

## Co se NEMĚNÍ
pgvector schéma · HNSW index · SQL · retrieve→prefilter→ranking · MCP kontrakty · Cloud Run · Cloud SQL.

## Ověřovací TODO před implementací (ne před hovorem)
- [ ] `enterprise=True` vs `vertexai=True` — co je v nainstalované verzi (`python -c` test)
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
