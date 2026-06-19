# Migrace google-genai — playbook «jak na to» (z primárních zdrojů)

**Datum:** 2026-06-19 · **Session:** t6ni7j · **Pro:** post-Cemex implementaci (NE teď)
**Zdroje (ověřeno tuto session):** Google Cloud migration guide (přes search snippet), PyPI `google-genai`, official `python-genai` README, `ai.google.dev/gemini-api/docs/embeddings`, Google Developers Blog (Gemini Embedding GA).

> ⚠️ **Pravidlo dodrženo:** kde se zdroje rozcházejí nebo jsem fakt neověřil → označeno **`[OVĚŘIT u inženýra]`**. Nic neověřeného není psáno jako fakt.

---

## 0. Datum — POTVRZENO primárním zdrojem

> *"The Generative AI modules in the Vertex AI SDK are **deprecated as of June 24, 2025** and will be **removed on June 24, 2026**."* — Google Cloud migration guide.

**Removal = ze SDK releasů.** Náš pin `google-cloud-aiplatform==1.154.0` drží, prod NEPADNE po 24.06. Migrace = klidně po Cemexu.

---

## 1. ⚠️ NÁLEZ #1 — parametr klienta se ZMĚNIL (oprava staré rešerše)

Stará rešerše (i paměť) tvrdila `genai.Client(vertexai=True, …)` jako "potvrzeno".
**Aktuální PyPI + README ale ukazují:**

```python
from google import genai
client = genai.Client(enterprise=True, project='PROJECT_ID', location='global')
```

+ env-var varianta: `GOOGLE_GENAI_USE_ENTERPRISE=true` / `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION`, pak `genai.Client()` bez argů.

**Proč:** Google přejmenoval Vertex AI generative → "Gemini Enterprise Agent Platform" (proto i redirecty docs na to jméno).
**`[OVĚŘIT u inženýra]`** — přijímá současný SDK ještě `vertexai=True` jako alias (zpětná kompatibilita), nebo už JEN `enterprise=True`? A je naše `location='europe-west3'` ok, nebo se tlačí `'global'`? ADC (bez klíče) zůstává — předáváme jen project+location.

---

## 2. ⚠️ NÁLEZ #2 — gemini-embedding-001 vyžaduje RUČNÍ L2-normalizaci na 768 (stará rešerše VYNECHALA)

Z `ai.google.dev` + Google blog (Gemini Embedding GA):
- default **3072 dim**, podporuje 768/1536/3072 přes **Matryoshka (MRL)** → `output_dimensionality=768` drží pgvector sloupec.
- **ALE:** *"With gemini-embedding-001 you need to perform **manual normalization** for dimensions other than 3072"* — novější modely normalizují samy, **tenhle NE**.

**Důsledek pro nás:** po oříznutí na 768 musíme vektor **sami L2-normalizovat**, jinak cosine similarity v pgvectoru rozbita → náš retrieve (teď cosine ~0.82) by spadl. Toto stará rešerše neměla. Konkrétně:

```python
import numpy as np
v = np.array(response.embeddings[0].values)
v = v / np.linalg.norm(v)          # POVINNÉ pro dim ≠ 3072
```

---

## 3. Co se mění — TŘI volací plochy, zbytek netknut

### 3a. Instalace (až PŘI migraci, ne teď)
```
pip install -U google-genai
# pin google-cloud-aiplatform==1.154.0 zůstává, dokud běží starý embeddings (krok B)
```

### 3b. Gemini-chat — `client.models.generate_content`
```python
from google.genai import types

response = client.models.generate_content(
    model='gemini-2.5-flash',                      # náš model (NE 3.x — to byl halucinát summarizeru)
    contents='...',
    config=types.GenerateContentConfig(
        system_instruction='...',
        temperature=0.3,
        response_mime_type='application/json',     # force-JSON pro MCP advisor — PODPOŘENO
        # response_schema=...  [OVĚŘIT přesný název: response_schema vs response_json_schema]
    ),
)
```
→ **NÁLEZ #3 (async):** `price_parser/llm_client.py` volá `generate_content_async`. Nový SDK to dělá přes
`client.aio.models.generate_content(...)` (a `client.aio.models.embed_content(...)`). Není to už metoda modelu.

### 3c. Embeddings — `client.models.embed_content` (krok B, viz strategie)
```python
from google.genai import types

response = client.models.embed_content(
    model='gemini-embedding-001',
    contents=['text 1', 'text 2'],                 # contents PŘIJÍMÁ list = batch (ověřeno v README)
    config=types.EmbedContentConfig(
        task_type='RETRIEVAL_DOCUMENT',            # korpus; 'RETRIEVAL_QUERY' pro dotazy
        output_dimensionality=768,                 # ⚠️ default 3072 → MUSÍ být explicitně
    ),
)
# + RUČNÍ L2-normalizace každého vektoru (NÁLEZ #2)
```
**`[OVĚŘIT]`** přesný strop batche na request (stará rešerše říkala "≤5" — neověřeno tuto session) + quota rpm pro náš projekt.

## 4. Co se NEMĚNÍ
pgvector schéma · HNSW index · SQL · retrieve→prefilter→ranking · MCP kontrakty · Cloud Run · Cloud SQL.
Migrace = jen embed-volání + Gemini-volání, **NE architektura**.

---

## 5. ⭐ STRATEGIE — dva nezávislé kroky (potvrzeno, drží i po ověření)

| Krok | Co | Kdy / proč |
|---|---|---|
| **A — kdykoli, bezpečný** | jen Gemini-chat → `genai.Client` + `client.models.generate_content`. Embeddings nechat na `text-multilingual-embedding-002` přes starý SDK. | opraví init-collision, sundá SDK-risk k 24.06, force-JSON jede, **ŽÁDNÝ re-embed** |
| **B — vědomě později** | embeddings → `gemini-embedding-001` + `output_dimensionality=768` + **L2-norm** + re-embed všech ~17 940 | drahé + riziko kvality 768; dělat JEN když to dává smysl |

**Proč:** blokující riziko = globální init (řeší A) + datum 24.06 (řeší A). Re-embed (B) je o "chci nový model", ne o deadline → lze odložit nebo NEdělat.

**`[OVĚŘIT u inženýra]` — hybrid:** lze jet `genai` pro chat + starý `TextEmbeddingModel` pro embeddings paralelně po dobu přechodu? (Pokud ano → A a B jsou opravdu nezávislé.)

---

## 6. Soubory k úpravě (z code-recon této session)

**Krok A (chat):**
- `app/core/gemini_client.py` — hlavní, Vertex/ADC cesta
- `app/integrations/gemini_client.py` — API-key cesta
- `app/services/passport_enricher.py` — obě cesty
- `app/services/price_parser/llm_client.py` — **async** → `client.aio.models.generate_content`
- `app/api/routes_llm_status.py` — jen probe importy (triviální)

**Krok B (embeddings):**
- `app/integrations/vertex_embeddings.py` — `embed_content` + L2-norm + re-embed skript

**Poslední:** `requirements.txt` ř. 20/35/49 — odpinovat až po dokončení A+B.

---

## 7. JEDINÁ otázka na inženýra, kterou doku NEŘEŠÍ

Kvalita 768: `gemini-embedding-001` oříznutý na 768 (+ ruční norm) — drží retrieval kvalitu proti
`text-multilingual-embedding-002` na 768 (náš current cosine ~0.82)? Nebo pro katalogový search radši
zůstat na staré multilingual modelu co nejdéle? **Tohle rozhoduje, zda krok B vůbec dělat.**

---

### Ověřovací TODO před implementací (ne před hovorem)
- [ ] `enterprise=True` vs `vertexai=True` — který je v nainstalované verzi SDK kanonický (rychlý `python -c` test)
- [ ] `response_schema` vs `response_json_schema` — přesný název v `types.GenerateContentConfig`
- [ ] přesný batch-strop `embed_content` + quota rpm
- [ ] smoke: clean `pip install -r requirements.txt` ve fresh venv (Pattern: pin → transitive konflikt)
