# STAVAGENT — Tech Steering

> **Účel dokumentu:** Stack, infrastruktura, AI-tier strategie, deployment, naming conventions.
> Tento dokument je **kanonický zdroj** pro architektonická rozhodnutí. Před uvedením jakéhokoliv nového toolu/platformy do produkce — aktualizovat zde.
>
> **Verze:** 1.0 — 19.05.2026

---

## 1. Architektura — Core ↔ Kiosks pattern

```
┌────────────────────────────────────────────────────────────┐
│  KIOSKS (Vercel, Node+React, Vite, TailwindCSS)            │
│  ┌──────────────┬──────────────┬──────────────┬──────────┐ │
│  │ Portal       │ Registr      │ Kalkulátor   │ Klasifik.│ │
│  │ stavagent.cz │ registry.*   │ kalkulator.* │ klasif.* │ │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───┘ │
└─────────┼──────────────┼──────────────┼──────────────┼─────┘
          │ JWT auth     │              │              │
          ▼              ▼              ▼              ▼
┌────────────────────────────────────────────────────────────┐
│  CORE ENGINE (Python FastAPI, Cloud Run europe-west3)      │
│  Parsers + LLM abstraction + Knowledge Base + 7 engines    │
└─────┬──────────────┬──────────────┬──────────────┬─────────┘
      │              │              │              │
      ▼              ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│ MinerU   │  │ URS_MATCH│  │ Cloud SQL│  │ Vertex AI    │
│ OCR      │  │ Service  │  │ Postgres │  │ Gemini       │
│ Cloud Run│  │ Node     │  │          │  │              │
└──────────┘  └──────────┘  └──────────┘  └──────────────┘
                                                  │
                              ┌───────────────────┼───────────────┐
                              ▼                   ▼               ▼
                        ┌──────────┐       ┌──────────┐    ┌──────────┐
                        │ AWS      │       │Perplexity│    │ MCP      │
                        │ Bedrock  │       │ API      │    │ Server   │
                        └──────────┘       └──────────┘    └──────────┘
```

**Pravidlo:** Core Engine **neví nic** o UI. Každý kiosk volá Core API nezávisle. Kiosky **nemají vlastní knowledge** — pouze cache, vždy získané z Core API.

---

## 2. Frontend (Vercel kiosks)

| Kiosk | URL | Repo path | Status |
|---|---|---|---|
| Portal | `stavagent.cz` | `apps/portal` | beta |
| Registr | `registry.stavagent.cz` | `apps/registry` | v4.24 produkce |
| Kalkulátor | `kalkulator.stavagent.cz` | `apps/monolit-planner` | v4.24 produkce |
| Klasifikátor | `klasifikator.stavagent.cz` | `apps/klasifikator` | produkce |

**Stack:**
- TypeScript, React 19, Vite
- TailwindCSS (žádné jiné CSS frameworky)
- Zustand (state)
- IndexedDB (offline cache)
- shadcn/ui (kde se hodí, ne všude)

**Deploy:** Vercel auto-deploy z PR (preview URLs) + main branch produkce.

---

## 3. Backend (Cloud Run services)

### 3.1 Core Engine

- **Repo:** `alpro1000/STAVAGENT` (root, `app/` dir)
- **Framework:** FastAPI (Python 3.11)
- **Region:** `europe-west3` (Frankfurt — EU data residency)
- **Deploy:** Cloud Build trigger `cloudbuild-portal.yaml` (branch `^main$`)
- **Container:** Docker
- **Knowledge base struktura:** `app/knowledge_base/B0_sources/`, `B1_otksp/`, ..., `B9_validation/` (viz `docs/steering/domain.md`)

### 3.2 MinerU OCR Service

- **Repo:** separátní (vyhledat v org)
- **Framework:** Python, Cloud Run
- **Účel:** OCR pro PDF a obrázky, extrakce tabulek

### 3.3 URS_MATCHER_SERVICE

- **Framework:** Node.js
- **Účel:** Microservice unifying retrieval from catalog sources (OTSKP local DB + AI semantic search)
- **Acronym decoded as:** **"Unified Retrieval Service"** (interní jméno, nikdy ne branded `ÚRS` publicly)
- **Vstup:** description text + element context
- **Výstup:** ranked OTSKP codes s confidence

---

## 4. Database

### 4.1 Production

- **Cloud SQL PostgreSQL** (region `europe-west3`)
- **DB names:**
  - `stavagent_portal` — auth, projekty, billing
  - `stavagent_registry` — Registr workshop data
  - `stavagent_calculator` — Kalkulátor sessions
- **Připojení:** Private VPC, Cloud SQL Proxy
- **Backup:** automatic daily, retention 7 dní

### 4.2 Local (knowledge)

- **OTSKP SQLite:** `app/knowledge_base/B1_otksp/otskp.db` (17 904 položek)
- **URS local cache (P0 roadmap):** `catalogs/urs_local_cache.jsonl` — 6-8K stažených ÚRS položek, 10× speedup vs HTTP

### 4.3 Co se **NEPOUŽÍVÁ**

- ❌ Render (legacy, miграция dokončena)
- ❌ Vercel KV / Vercel Postgres (používáme Cloud SQL)
- ❌ Heroku
- ❌ MongoDB / NoSQL

---

## 5. AI providers — tier strategie

> **Princip:** Deterministic-first. Regex/lookup vždy nejdřív. LLM **pouze** fallback pro texty kde deterministic je bezmocný.

### 5.1 Tier 1 — Vertex AI (primary)

- **Modely:** Gemini Flash (rychlý, levný) → Gemini 2.5 Pro (přesný)
- **Projekt:** `project-947a512a-481d-49b5-81c`
- **Billing:** `01587B-BEBC6E-418C29`
- **Region:** `europe-west3` (EU data residency)
- **Použití:** Klasifikace pozic, document extraction, geometry recognition (Gemini 2.0 Flash Vision)

### 5.2 Tier 2 — AWS Bedrock (fallback)

- **Model:** Claude Sonnet 4
- **Credit:** $1,000 (AWS Activate)
- **Použití:** Když Vertex selže nebo potřeba větší kontext

### 5.3 Tier 3 — Perplexity (norms research)

- **Credit:** $5,000 (active)
- **Použití:** `search_norms` tool — aktuální normy, web search pro ČSN/EN/DIN updates

### 5.4 Confidence scoring (povinné)

| Source | Confidence |
|---|---|
| OTSKP exact lookup | 1.00 |
| Regex match na kód | 0.95 |
| Regex match na popis | 0.85 |
| URS Matcher | 0.80 |
| AI návrh (Gemini/Claude) | 0.70 |
| Human manual entry | 0.99 |

**Pravidlo:** Data s vyšším confidence **se nepřepisují** daty s nižším.

### 5.5 Co se **NEPOUŽÍVÁ** v AI tier

- ❌ OpenAI GPT-4 (drahé, EU data residency horší)
- ❌ Self-hosted LLM (provozní overhead nevybalancovaný benefitem)
- ❌ Direct Anthropic API (jdeme přes Bedrock kvůli enterprise credits)

---

## 6. Storage

| Co | Kde |
|---|---|
| Raw PDFs, .xlsx, .dwg | Google Cloud Storage |
| Normativní content (auto-sync 3 dny → Vertex Data Store) | `gs://stavagent-cenik-norms/` |
| Frontend assets (static) | Cloudflare R2 |
| Vertex AI Data Store | `urs-otskp-csn-norms-cenik` |

**Hybrid pattern (důležité):**
- GCS — raw PDFs
- Git — synthesized files (`METADATA.md`, `extracted.yaml`, `citations.md`, `source_pointer.md` s `gs://` paths)

---

## 7. MCP Server (agentic interface)

- **URL:** `https://concrete-agent-3uxelthc4q-ey.a.run.app/mcp`
- **Verze:** v1.0 live
- **Tools:** 9 (2 free + 7 paid 1-20 credits)
  - `find_otskp_code` (free)
  - `classify_construction_element` (free)
  - + 7 paid tools
- **Auth:** `sk-stavagent-{hex48}` API keys + OAuth 2.0 (ChatGPT)
- **Billing:** Lemon Squeezy, webhook secret `stavagent_lmsq_wh_2026`
- **Tiery:** 100 / 500 / 2000 credit balíčky

### 7.1 P3 CRITICAL pre Cemex (28.06.2026)

- [ ] MCP Policy Engine
- [ ] Audit logs
- [ ] Read-only default
- [ ] Forbidden tools (shell / fs / ERP write / email / price changes)

---

## 8. Authentication

- **Portal JWT** — jednotná auth pro všechny kiosky
- **Migration completed:** PR #1043 (JWT) + #1045 (cookie fallback) + #1049 (auth headers)
- **SameSite cookie issue** для `/api/portal-projects` — known bug, alternative path `api.stavagent.cz`
- **OAuth 2.0** pro ChatGPT MCP integration

### 8.1 P0 BLOCKER (před Cemex demo)

- [ ] **Cross-user data isolation** — uživatelé vidí navzájem projekty v Monolit-Planner a Registru. GDPR exposure. Řešit row-level security na Cloud SQL.

---

## 9. CI/CD

| Co | Tool |
|---|---|
| Unit tests, linting | GitHub Actions |
| Build & deploy backend | Cloud Build trigger (`cloudbuild-portal.yaml`, branch `^main$`) |
| Frontend deploy | Vercel auto-deploy (preview URLs per PR) |
| Branch protection | enabled na `main` — bez výjimky |

**Workflow:**
1. Lokálně `npm run build`
2. Generované HTML 4 soubory z `dist/` zkopírovat do `public/prerendered/`
3. Vše v jednom PR
4. Action `prerender.yml` blokována `protect-main` rulesetem — proto manuálně

---

## 10. Payments

- **Lemon Squeezy** — `stavagent.lemonsqueezy.com`
- **Tiery kreditů:** 100 / 500 / 2000
- **Webhook secret:** `stavagent_lmsq_wh_2026`
- **Co se **NEPOUŽÍVÁ:** Stripe (byl dead code, odstraněn v Gate 2)

---

## 11. External APIs

| API | Token / Endpoint | Účel |
|---|---|---|
| Hlídač státu | token `a2053f381a87460f826f67e7654534e1` | Registr smluv + dumps (VZ endpoint 403 без paid licence) |
| PJPK portal | `pjpk.rsd.cz` | TP, TKP PK, VL ŘSD dokumenty |
| methvin.co | scraped | Rebar norms primary source |

---

## 12. Code conventions

### 12.1 Languages

- **Code:** English + Czech (terminology — ČSN, OTSKP, TKP, přípravář)
- **Communication:** Russian s uživatelem
- **Domain:** Czech (vždy)
- **Commits, PR titles:** English (může být CS u domain-specific)

### 12.2 Naming

> **Pravidlo:** Naming určuje se podle existujících konvencí v repu. **Nevymýšlí se.**

Pokud v repu:
- `xlsx_komplet` parser — nový pojmenovávat ve stylu `xlsx_<scope>`
- tabulka `project_documents` — nevytvářet `portal_documents`
- snake_case — držet snake_case
- camelCase v React komponentách — držet

Pokud v repu **různá konvence** — sjednotit podle většiny.

### 12.3 Architecture principles

1. **Parser-first → Structure-first → Provenance-first → AI-last**
2. **Core ↔ Kiosk:** Core neví o UI, kiosky volají Core API
3. **Confidence scoring obligatorní:** každý výstup má `confidence: float`
4. **Vysoký confidence nepřepisuje nízký**
5. **Vždy citace zdroje** (DIN 18218 §4.2.1, ČSN EN 13670, ÚRS položka kód)

### 12.4 Co nepřidávat bez konzultace

- Nový frontend framework
- Nový database engine
- Nový AI provider
- Nový kiosk subdomain
- Změnu Core ↔ Kiosk patternu

---

## 13. Cloud Code settings

`~/.claude/settings.json`:
```json
{
  "effortLevel": "high",
  "env": {
    "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING": "1",
    "AUTO_COMPACT_WINDOW": "400000"
  }
}
```

- `effortLevel: "high"` (ne `"max"` — moc drahé pro velké repo)
- `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`
- `AUTO_COMPACT_WINDOW=400000`

---

## 14. Roadmap (post-N=5)

### 14.1 P0 (1-2 týdny)

- Ingest 6-8K stažených ÚRS jako `catalogs/urs_local_cache.jsonl`
- Second-pass match script — 10× speedup vs HTTP

### 14.2 P1 (3-4 týdny)

- UCWO ontology + mapování ÚRS → UCWO pro DE/PL/ES scale

### 14.3 P2 (4-6 týdnů)

- Hybrid BM25 + pgvector + filter → rerank → LLM judge

### 14.4 P3 CRITICAL pre Cemex 28.06.2026

- MCP Policy Engine + audit logs + read-only default + forbidden tools (viz §7.1)

---

## 15. Document versioning

| Date | Version | Notes |
|---|---|---|
| 19.05.2026 | 1.0 | Initial steering, synthesized from Project_Knowledge_Snapshot.md §3-4 + Master_Brief.md §1.4 + recent updates v userMemories |
