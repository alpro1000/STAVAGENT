# TASK — Universal Document Extraction Pipeline (UEP) — v3

> **STAVAGENT canonical task. Universal — applies to all construction project types: 
> rezidenční budovy, mostní objekty, silniční stavby, průmyslové haly, inženýrské 
> sítě, všechny D.1.x sekce projektové dokumentace dle vyhlášky 499/2006.**
> 
> **v3 changelog:** added §15 Robustness & Scaling covering DWG conversion fallback 
> chain (ODA → LibreDWG → manual escalation), concurrent job limits per user 
> (tier-based + per-project lock + rate limiting), IFC versioning & change 
> detection (hash-based version tracking + entity-level diff engine), streaming 
> IFC parser (tiered strategy). Added Q8 to Pre-Implementation Interview. 
> Extended §7 acceptance criteria to 50. Updated §9 stop conditions. Updated 
> §10 PR phasing.
> 
> **v2 changelog:** added §14 Deployment & API Surface, expanded §3.1 input 
> format support (DWG, IFC, XML adapters), added Q7.
> 
> **v1:** core architecture (4 phases, coverage matrix, reconciliation, 
> derivation registry).

---

## MANTRA pre Claude Code

> Před první řádkou kódu:
> 
> 1. **Read entire repo first.** Prozkoumej existující strukturu `concrete-agent/`: 
>    parsers, services, knowledge_base, ai layer, api routes, tests, Docker setup, 
>    Cloud Run deployment configs, MCP server existing tools.
> 2. **Derive naming from existing conventions.** Žádný file name, class name, 
>    function name, table name, env var, endpoint path v tomto tasku není závazný. 
>    Já popisuji ČOM (business logic + architecture). Ty derivuješ JAK (naming + 
>    layout) z repa.
> 3. **Then — and only then — write.**
>
> Tento task popisuje **univerzální chování** systému. Implementace musí fungovat 
> pro libovolný typ stavební dokumentace bez special-casing per project type. 
> Project-type-specific knowledge žije v konfiguraci (YAML matrices, derivation 
> rules), ne v hard-coded větvích pipeline.

---

## §0. CONTEXT (co už máme)

Stávající stav (k 2026-05-18):

- **DXF exhaustive extraction:** zakódifikováno v `SKILL_stavagent_dxf_exhaustive.md`. 
  Funguje na N=2 corpus (Libuše, RD Jáchymов). Seed script existuje v 
  `test-data/RD_Jachymov_dum/tools/phase0b_dxf_extractor.py`.
- **PDF TZ extraction:** existuje per-pilot, není zobecněno.
- **Vision drawing extraction:** experimentální, ne production.
- **MinerU OCR:** běží jako samostatný Cloud Run service.
- **AI provider chain:** existuje v `app/ai/ai_reasoner.py` — Gemini Flash → 
  Bedrock Claude Sonnet → Perplexity.
- **Cross-source reconciliation:** **NEEXISTUJE.**
- **Coverage matrix:** **NEEXISTUJE.**
- **Derivation rules registry:** **NEEXISTUJE.**
- **DWG support:** **NEEXISTUJE.**
- **IFC support:** **NEEXISTUJE.**
- **XML structured formats:** **NEEXISTUJE** generic adapter.
- **Concurrent job control:** **NEEXISTUJE.** Žádné per-user limits, žádný 
  project lock, žádný rate limiting na extraction jobs.
- **Version tracking:** **NEEXISTUJE** pro upload artifacts (žádná detekce 
  "stejný file jako minule s drobnými změnami").
- **Streaming parsers:** **NEEXISTUJE.** Vše loaded full-into-memory. Žádný 
  ochrana proti OOM na velkých BIM modelech.
- **MCP server:** existuje, 9 tools, Cloud Run.

**Tento task zavádí 5 univerzálních komponent + multi-format input + robustness:**

1. **Per-source extractor adapter pattern** — sjednocený výstupní schema pro 
   DXF / DWG / IFC / PDF TZ / Vision drawings / tables / soupis / XML.
2. **Coverage matrix engine** — YAML-driven anti-omission gate.
3. **Cross-source reconciliation engine** — samostatná fáze.
4. **Derivation rules registry** — YAML-driven povolené výpočty.
5. **(v3)** Robustness & scaling layer — conversion fallbacks, concurrency 
   control, version tracking, streaming parsers (viz §15).

Vše spolu tvoří **Universal Extraction Pipeline (UEP)** — exposed přes 
REST + MCP + in-process API surface (viz §14).

---

## §1. BUSINESS GOAL

### 1.1 Scénář uživatele

Uživatel nahraje **kompletní project package** (libovolná kombinace):

- 1+ DXF výkresy (CAD nativní)
- 0+ DWG výkresy (konvertují se interně — viz §15.1 fallback chain)
- 0+ IFC modely (BIM nativní, viz §15.3 versioning, §15.4 streaming)
- 1+ PDF technická zpráva (TZ)
- 0+ PDF tabulky
- 0+ PDF drawings (rasterové)
- 0+ Excel soupis prací
- 0+ XML soupis (UNIXML / LandXML / gbXML)
- 0+ Geologie / IGP report (PDF)
- 0+ ZD / Vysvětlení ZD dokumenty (PDF)

Spustí "Extract project facts" (přes UI, MCP, nebo internal job).

**Očekávaný výsledek:**

1. **Exhaustive extraction** ze všech zdrojů, s plnou source provenance.
2. **Coverage report** s explicit status per category.
3. **Reconciliation report** s confirmed / conflicts / gaps.
4. **Derived facts** pouze přes registrovaná pravidla.
5. **Items.json** připravený pro Phase 1 nebo Phase 6.
6. **(v3) Version diff** pokud projekt má předchozí UEP run — co se změnilo.

### 1.2 Co se NESMÍ stát

- ❌ Agent vrátí hodnotu bez source attribution
- ❌ Agent předpokládá strukturu skladby, která není v tabulce skladeb
- ❌ Agent předpokládá výšku obkladu bez explicit reference v TZ
- ❌ Agent skipne entity extraction "protože není relevantní"
- ❌ Agent volně počítá hodnoty bez registered derivation rule
- ❌ Agent mlčky nahradí chybějící data AI fallback hodnotou
- ❌ Agent prohlásí extraction completed, když coverage matrix má unhandled rows
- ❌ Agent reportuje "could not extract X" bez vyzkoušení canonical algorithm
- ❌ **(v3)** Agent neflagne DWG conversion failure — musí vyzkoušet fallback chain
- ❌ **(v3)** Agent spustí job který by překročil user concurrent limit
- ❌ **(v3)** Agent re-extrahuje identický file (hash match) bez force flag
- ❌ **(v3)** Agent OOM-crashne na velkém IFC bez streaming attempt

---

## §2. PRE-IMPLEMENTATION INTERVIEW (povinný)

> **Před první řádkou kódu zavolej `AskUserQuestion` s těmito otázkami.** 
> Pokud kteroukoli skipneš nebo "rozhodneš sám" — STOP a vrať kontrolu uživateli.

### Q1 — Adapter pattern boundary

(A/B/C, beze změny vs v2 — recommend C)

### Q2 — Coverage matrix location

(A/B/C — recommend A start, B/C follow-up)

### Q3 — Derivation registry strictness

(A/B/C — recommend C configurable per project type)

### Q4 — Reconciliation tolerance defaults

(strict ±2% geometrie, exact klasifikace, configurable per type)

### Q5 — AI provider chain

(A/B/C — recommend A canonical Gemini → Bedrock → Perplexity)

### Q6 — Run mode

(A/B/C — recommend C skeleton + 1 end-to-end residential)

### Q7 — External binaries and dependencies

(A/B/C — recommend A everything in main Docker image)

### Q8 — NEW: User tier model and concurrency limits

UEP jobs jsou long-running (2-10 min residential, 5-30 min bridge). Per-user 
limits prevention abuse + fairness. Souvisí s tvým existujícím credit/subscription 
modelem (Lemon Squeezy tiers 100/500/2000 credits).

**Tier limits (návrh):**

| Tier | Concurrent jobs | Daily limit | Per-project | Burst (15min window) |
|---|---|---|---|---|
| Free / Trial | 1 | 5 | 1 active | 2 |
| Starter (100 cr) | 2 | 25 | 1 active | 5 |
| Pro (500 cr) | 5 | 100 | 1 active | 15 |
| Business (2000 cr) | 10 | unlimited | 1 active | 30 |
| Enterprise (custom) | configurable | unlimited | configurable | configurable |

Možnosti implementace:

- **A)** Hard-code tier limits v config YAML, distribuovaný s deploymentem
- **B)** Tier limits v Cloud SQL table, editovatelné bez deploy (admin tool)
- **C)** Tier limits v Lemon Squeezy product metadata, fetched per user

Doporučení: **B** (database-driven). Easier to adjust per analytics, 
A/B testing tier values, individual user overrides for enterprise customers.

**Per-project lock policy:**

- **A)** Strict lock: only 1 active job per project. New `run` returns 409 
  Conflict unless `force_rerun=true` (which cancels existing).
- **B)** Allow parallel jobs per project (different phase combinations), 
  output to different job_id paths.
- **C)** Strict lock + queue (new job queued, runs after current completes).

Doporučení: **A** (simplest, avoids race conditions on GCS output paths, 
clear semantics).

**Rate limiting beyond tier limits:**

- **A)** No additional rate limit — tier limits sufficient
- **B)** Token bucket per user (e.g., 5 tokens, refill 1/minute) for burst control
- **C)** Sliding window (max N starts per 15-min window)

Doporučení: **C** (clearer to users than token bucket, easier to explain 
in error messages, simpler implementation).

### Q9 — NEW: IFC version retention policy

IFC modely se v BIM workflow často revidují. Storage + compute tradeoff:

- **A)** Keep all IFC versions indefinitely. Storage costs ~$0.02/GB/month 
  for typical 200MB models = negligible. Full history for compliance/audit.
- **B)** Keep last N versions per project (default N=10), older auto-deleted 
  via GCS lifecycle policy.
- **C)** Keep all versions for active projects, deleted projects → 90 day 
  retention then full delete.

Doporučení: **A** (storage is cheap, BIM audit trail is valuable). Per-tier 
override possible (Free tier = N=3 to limit costs).

### Q10 — NEW: Streaming IFC threshold

Memory budget on Cloud Run: 4GB allocated, ~2.5GB usable Python heap.

- **A)** Fixed thresholds: <200MB full-load, 200MB-1GB partial streaming, 
  >1GB strict streaming, >2GB reject.
- **B)** Dynamic detection: try full-load first, OOM-detect → restart with 
  streaming.
- **C)** Always streaming (slower for small files but consistent behavior).

Doporučení: **A** (predictable behavior, clear thresholds in error messages, 
no double-work).

**Pokud Александр answers s preferencí — pokračuj. Pokud "podle tebe" — 
pokračuj s doporučeními výše.**

---

## §3. BUSINESS LOGIC — 4 phases of UEP

### 3.1 PHASE 1 — Per-source extraction (independent)

**Princip:** Každý vstupní soubor je parsován **nezávisle**.

**Per-file extraction matrix:**

| Typ vstupu | Extractor / Library | Pre-processing | Confidence |
|---|---|---|---|
| `.dxf` | **ezdxf** | none | 0.85–1.00 |
| `.dwg` | **ezdxf.addons.odafc** → ODA File Converter → DXF → ezdxf | DWG→DXF (R2018), **with fallback chain — see §15.1** | 0.85–1.00 |
| `.ifc` | **IfcOpenShell**, **streaming-aware — see §15.4** | none / sharding | 0.90–1.00 |
| TZ PDF (text) | pdfplumber + regex tokens | none | 0.85–1.00 |
| TZ PDF (scanned) | MinerU service → regex + AI fallback | OCR | 0.60–0.85 |
| Tabulky PDF | pdfplumber structured tables | none | 0.85–0.95 |
| Drawings PDF (raster) | Vision via Gemini Flash | PDF→PNG | 0.60–0.85 |
| Soupis Excel | Existing xlsx parsers | none | 0.95–1.00 |
| `.xml` UNIXML | lxml + UNIXML adapter | namespace detection | 0.95–1.00 |
| `.xml` LandXML | lxml + LandXML adapter | namespace detection | 0.90–1.00 |
| `.xml` gbXML | lxml + gbXML adapter | namespace detection | 0.90–1.00 |
| `.xml` other | Generic XML adapter — flag pro user identifikaci | namespace detection | 0.60–0.80 |
| Geologie PDF | Regex (γ, φ, c, Rdt, HPV) + tables | none | 0.85–0.95 |

#### 3.1.1 DWG handling

ezdxf NEčte DWG nativně. Conversion required:
```
DWG → ODA File Converter → DXF R2018 → ezdxf → unified schema
```

**Pokud ODA fails → fallback chain (viz §15.1).** Robust DWG handling NESMÍ 
být silently dropped — každý DWG musí buď úspěšně convertovat, nebo 
explicitně escalate to user.

Conversion cache (file hash → cached DXF on GCS) — repeated uploads of same DWG 
skip conversion.

#### 3.1.2 IFC handling

IfcOpenShell extracts:
- `IfcSpace` → místnost (area, volume, name, level)
- `IfcSlab`, `IfcWall`, `IfcBeam`, `IfcColumn`, `IfcFooting` → structural + dimensions
- `IfcDoor`, `IfcWindow` → otvor + dimensions + host wall
- `IfcMaterial`, `IfcMaterialLayerSet` → skladba (vrstvy + tloušťky)
- `IfcQuantityArea`, `IfcQuantityVolume`, `IfcQuantityLength` → pre-computed quantities (HIGH confidence 0.95+)
- `IfcPropertySet`, `IfcPropertySingleValue` → custom properties
- `IfcSpatialStructureElement` → site / building / storey decomposition
- `IfcClassificationReference` → links to external classifications

**Memory budget management — viz §15.4 streaming strategy.**  
**Version tracking — viz §15.3.**

#### 3.1.3 XML handling

Generic pattern: detect root element + namespace → route to specific adapter.

**UNIXML** (ÚRS soupis prací format):
- Root: `polozky` / `cenova_soustava` / `stavba`
- Extract: položky s kódy, množství, MJ, jednotková cena

**LandXML** (civil engineering):
- Root: `LandXML` v `http://www.landxml.org/schema/LandXML-1.2`
- Extract: alignments, surfaces, parcels, cross-sections

**gbXML** (energy / MEP):
- Root: `gbXML` v `http://www.gbxml.org/schema`
- Extract: spaces, surfaces, constructions, HVAC zones

**Generic XML fallback:** unknown namespace → structured representation + 
user prompt for identification. Never silent skip.

**Per-source output:** JSON file per source file. Žádný merge ještě.

**Forbidden v této fázi:**

- Sloučení faktů mezi soubory
- Předpokládání hodnot
- Volání derivation rules
- AI inference o vztazích
- Filtrování "irrelevantních" entit
- Silent skip neznámého XML namespace
- Skip DWG protože "trvalo by to dlouho"
- **(v3)** Silent skip DWG po prvním ODA failure — musí vyzkoušet fallback chain
- **(v3)** Skip IFC version diff když existuje předchozí version
- **(v3)** Load full IFC pokud size > streaming threshold

**Phase 1 gate:** Každý input file má corresponding output file OR explicit 
error log s reason. Žádný silent skip.

### 3.2 PHASE 2 — Coverage matrix check

(beze změny vs v2)

### 3.3 PHASE 3 — Cross-source reconciliation

(beze změny vs v2)

### 3.4 PHASE 4 — Derivation

(beze změny vs v2)

---

## §4-6. DOMAIN RULES & EXAMPLES

(beze změny vs v2)

---

## §7. ACCEPTANCE CRITERIA (extended v3)

### 7.1 Architecture (criteria 1-4, beze změny)

### 7.2 Functional (criteria 5-9, beze změny)

### 7.3 Multi-format input (criteria 29-36, beze změny vs v2)

### 7.4-7.9 (criteria 10-28, beze změny)

### 7.10 Cost (criteria 29-32, beze změny — renumbered v2 viz cleanup below)

### 7.11 NEW: Robustness & scaling (v3)

**37.** **DWG fallback chain:** UEP attempts ODA File Converter first. 
On failure (non-zero exit, error pattern, empty/invalid output, timeout 
>60s) → automatically retries with LibreDWG `dwg2dxf`. On second failure 
→ stores DWG in `pending_manual_conversion` queue + generates user 
notification. NEVER silent drop.

**38.** **Conversion attempt audit:** each DWG conversion logs attempts:
```
{
  attempts: [
    {converter: "ODA", started, completed, exit_code, error?},
    {converter: "LibreDWG", started, completed, exit_code, error?}
  ],
  final_status: "success" | "manual_intervention_required",
  resulting_dxf_path?: gs://...,
  cache_hit: bool
}
```

**39.** **DWG conversion cache invalidation:** if cached DXF fails to load 
with ezdxf (corrupt cache), automatically invalidate cache and re-convert.

**40.** **Concurrent job limits enforced server-side:** REST POST `/uep/run` 
returns 429 Too Many Requests when user exceeds tier concurrent limit. 
Returns 409 Conflict when project has active job (unless force_rerun=true). 
Returns 429 with `Retry-After` header when sliding window rate limit exceeded.

**41.** **Tier limits configurable without deploy:** if Q8 → B selected, 
DB-driven tier configuration. Admin can adjust limits per user / globally 
via existing admin UI patterns (or new admin endpoint per Claude Code 
discretion).

**42.** **Per-project lock:** Cloud SQL row lock on project_id prevents 
race conditions on GCS output paths. Atomic check-and-set on job creation.

**43.** **IFC version tracking:** every IFC upload computes SHA-256 hash, 
extracts IfcOwnerHistory metadata (timestamp, author, originating software), 
inserts row in `ifc_versions` table linked to project. Hash dedup — same 
content uploaded twice → no new version.

**44.** **IFC diff engine (basic):** if project has previous IFC version, 
diff engine compares entity-level (added / removed / modified per category: 
spaces, structural elements, openings, materials, properties). Generates 
`ifc_diff_report.json` per pair (previous_version → current_version).

**45.** **IFC diff content quality:** diff includes:
- `added_entities[]` with GlobalId, type, location
- `removed_entities[]` with GlobalId, type, last_seen_in_version
- `modified_entities[]` with GlobalId, type, changed_attributes (e.g. 
  area: 24.5→24.8, material_layer_count: 3→4)
- `quantity_deltas{}` aggregated by entity type (Σ wall area delta, etc.)
- `summary` human-readable narrative

**46.** **IFC streaming threshold detection:** UEP detects IFC size 
pre-load. <200MB → standard `ifcopenshell.open()`. 200MB-1GB → 
streaming iterator mode. >1GB → strict streaming, multi-pass per category. 
>2GB → reject with explicit message + admin escalation queue.

**47.** **IFC streaming correctness:** streaming mode produces IDENTICAL 
unified schema output as full-load mode (verified via fixture tests on 
medium IFC file run in both modes).

**48.** **IFC streaming memory cap:** streaming parser peak memory 
≤1.5GB regardless of file size (within 0-2GB tested range).

**49.** **IFC streaming progress reporting:** streaming mode reports 
progress at sub-phase boundaries (spatial structure done → materials done 
→ geometry per category). Visible in job status streaming endpoint.

**50.** **Graceful degradation across robustness features:** if any 
robustness feature fails internally (DWG fallback exhausted, version DB 
write fails, streaming parser hits unexpected entity), job continues 
with explicit warning in audit log, NEVER silent corruption of items.json.

---

## §8. WHAT IS NOT INCLUDED (scope exclusions)

(beze změny vs v2)

Plus v3:

- ❌ IFC merging / consolidating multi-author models (each IFC = independent version)
- ❌ Automated DWG repair (only conversion via existing tools)
- ❌ Custom DWG version reverse engineering (rely on ODA + LibreDWG ecosystem)
- ❌ IFC diff visualization (data layer only, UI follow-up)
- ❌ Adaptive concurrent limits based on real-time system load (static tier 
  limits only)
- ❌ Cross-region replication (single region GCS deployment)

---

## §9. WORKFLOW STOP CONDITIONS (extended v3)

(beze změny criteria 1-8 vs v2)

Plus v3:

**9.** ODA File Converter + LibreDWG both fail on a critical DWG → STOP, 
request_user_input "DWG cannot be converted automatically. Options: 
(a) skip this file with explicit note in coverage report, (b) wait for 
manual conversion, (c) abort full pipeline."

**10.** User exceeds concurrent job limit on first run attempt for a 
production project → STOP, suggest queue mode or upgrade prompt (no 
silent rejection).

**11.** IFC version diff shows >50% entity changes between versions → 
STOP, request_user_input "Major model revision detected. Re-run full 
pipeline (high cost) or extract only changed entities (faster, partial)?"

**12.** IFC file size > 2GB threshold → STOP, request_user_input 
"File exceeds streaming threshold. Options: split via ifcconvert 
externally then upload subsets, OR admin escalation for instance memory 
bump."

**13.** Tier limit configuration appears invalid (e.g., Pro tier 
concurrent=0) → STOP, request_user_input "Tier config seems wrong. Verify."

**14.** Streaming IFC parser encounters entity type not in known mapping 
→ STOP, log entity type + count, request_user_input "Unknown IFC entity 
type X (count N). Add to adapter mapping or skip?"

---

## §10. PHASED DELIVERY (updated v3)

### PR 1 — Architecture skeleton + Coverage engine + DXF/PDF basics (Týden 1)
- Adapter layer skeleton
- DXF parser (ezdxf, exhaustive per SKILL)
- PDF TZ parser (pdfplumber + regex)
- Coverage matrix engine
- `coverage_matrix_residential.yaml`
- End-to-end on Libuše_objekt_D
- Acceptance: 1-3, 5 (residential), 7-10, 18 partial, 21 (adapter+coverage), 24

### PR 2 — Reconciliation + Derivation + REST API + Concurrency (Týden 2)
- Reconciliation engine + rules
- Derivation registry + 15 universal rules
- **REST API surface** (§14)
- **Job_id pattern + Cloud Tasks** (§14.5)
- **(v3) Concurrent job limits per user** (§15.2) — tier config, 
  per-project lock, rate limiting
- First MCP tool integration: `uep_run_extraction`
- End-to-end on Libuše still works
- Acceptance: 6 (residential), 14-20, 21 (recon+deriv), 22 (residential), 
  **40-42**

### PR 3 — Bridge + Road + Multi-format + Robustness (Týden 3)
- Bridge + road coverage matrices
- Project type detection
- **DWG support + fallback chain** (§15.1) — ODA primary, LibreDWG fallback
- **IFC support + version tracking** (§15.3 basic) — hash-based versions, 
  ifc_versions table
- **IFC streaming** (§15.4) — tiered thresholds <200MB / 200MB-1GB / >1GB
- UNIXML adapter
- LandXML adapter
- End-to-end on Žihle + SO-250
- Full MCP tool suite
- Acceptance: 5 (all 3 types), 6 (all), 11-12, 22 (all), **29-32, 37-39, 
  43, 46-49**

### PR 4 (follow-up, scope exclusion v tomto tasku)
- MEP D.1.4 detailed matrices
- gbXML adapter
- **IFC diff engine (full)** (§15.3 advanced) — entity-level diff, quantity 
  deltas, narrative summary (covers acceptance 44-45)
- UI visualization (coverage report, reconciliation, IFC diff)
- Performance optimization
- Multi-region deployment

---

## §11. NAMING RULE

(beze změny vs v1 — všechno naming derive z existujících konvencí v repo)

---

## §12. CONTEXT FOR CLAUDE CODE — what to read first

1. `concrete-agent/README.md`
2. `concrete-agent/app/` top-level layout
3. `concrete-agent/app/parsers/` existing patterns
4. `concrete-agent/app/services/`
5. `concrete-agent/app/schemas/`
6. `concrete-agent/app/ai/ai_reasoner.py`
7. `concrete-agent/app/knowledge_base/B*`
8. `concrete-agent/tests/`
9. `SKILL_stavagent_dxf_exhaustive.md`
10. `STAVAGENT_PATTERNS.md`
11. `docs/architecture/`
12. `CLAUDE.md`
13. `Dockerfile` Core Engine
14. Existing MCP server tool registrations
15. Existing FastAPI router structure
16. **(v3)** Existing Lemon Squeezy webhook + credit handling code (for 
    tier limits integration)
17. **(v3)** Existing Cloud SQL migration scripts (for ifc_versions, 
    tier_limits, sliding_window_counters tables)

---

## §13. SUCCESS DEFINITION

Tento task je úspěšný, když:

- Александр může spustit pipeline na libovolný z 3 testovacích projektů 
  (Libuše / Žihle / SO-250) a dostane se mu strukturovaný coverage_report + 
  reconciliation_report + items.json s plnou source attribution
- Nový project type lze přidat pouze YAML matrix + rules, bez kódových změn 
  pipeline core
- Agent v MCP serveru nemůže fyzicky obejít coverage gate ani reconciliation 
  gate ani derivation registry
- Audit trail dovolí reverse-engineer každou hodnotu zpět ke zdroji + formuli
- **(v3)** DWG nikdy není silently dropped — buď success, buď cache hit, 
  buď explicit escalation
- **(v3)** Žádný user nepřetíží systém přes UEP — tier limits enforced
- **(v3)** Žádný projekt nemá race condition — per-project lock works
- **(v3)** Žádná IFC revision není ignorována — version tracking + diff 
  visible
- **(v3)** Žádný velký IFC nezpůsobí OOM crash — streaming threshold respected

---

## §14. DEPLOYMENT & API SURFACE (v2)

### 14.1 Compute topology

(viz v2 diagram — UEP module v Core Engine, REST + MCP + in-process surfaces)

### 14.2 REST API surface

Base path: `/api/v1/projects/{project_id}/uep/`.

**Job lifecycle endpoints:**

```
POST   /uep/run
       Body: { phases?, project_type?, force_rerun?, source_filter? }
       → 202 Accepted (success)
       → 429 Too Many Requests (concurrent limit, rate limit) [v3]
       → 409 Conflict (project already running, unless force_rerun) [v3]
       Returns: { job_id, status: "queued", created_at, 
                  position_in_queue?, retry_after_sec? }

GET    /uep/jobs/{job_id}
       Returns: { job_id, project_id, status, current_phase, progress_pct, ... }

GET    /uep/jobs/{job_id}/stream
       SSE stream until completion

DELETE /uep/jobs/{job_id}
       Cancellation

GET    /uep/jobs/active
       v3: Returns user's currently active jobs (for UI display "you have 
       N/M concurrent jobs running")
```

**Result access endpoints:**

```
GET    /uep/coverage-report?job_id=...
GET    /uep/reconciliation-report?job_id=...
GET    /uep/derived-quantities?job_id=...
GET    /uep/items?job_id=...
GET    /uep/facts?job_id=...&source_file=X
GET    /uep/audit-log?job_id=...
GET    /uep/dwg-conversion-attempts?job_id=...  [v3]
       Returns DWG conversion attempt history per file
```

**Version tracking endpoints (v3):**

```
GET    /uep/ifc-versions?project_id=...
       Returns version history for project

GET    /uep/ifc-diff?project_id=...&from_version=...&to_version=...
       Returns diff report between two versions
```

**Ad-hoc derivation endpoint:**

```
POST   /uep/derivation
       Body: { rule_id, inputs }
       → derived value + audit_trail

GET    /uep/derivation/applicable-rules?quantity=...&available_inputs=...
```

**Configuration read endpoints:**

```
GET    /uep/config/coverage-matrices/{project_type}
GET    /uep/config/derivation-rules
GET    /uep/config/reconciliation-rules
GET    /uep/config/supported-formats
GET    /uep/config/tier-limits             [v3]
       Returns current user's tier limits + usage
```

### 14.3 MCP tool surface

(viz v2 list — 10 tools)

**(v3) Additions:**

```yaml
uep_get_dwg_conversion_status:
  description: Returns DWG conversion attempt log for files in project. 
               Useful when DWG failed and user needs to see why.
  paid: false
  parameters: { project_id, file_path? }
  returns: list of conversion attempts per file

uep_list_ifc_versions:
  description: Returns IFC version history for project.
  paid: false
  parameters: { project_id }
  returns: list of versions with timestamps + author + diff summary

uep_get_ifc_diff:
  description: Returns detailed diff between two IFC versions.
  paid: true
  credits: 3
  parameters: { project_id, from_version, to_version }
  returns: full diff report

uep_check_user_quota:
  description: Returns current user's tier limits, usage, and time until 
               next slot available.
  paid: false
  parameters: {} (user inferred from auth)
  returns: { tier, concurrent_used, concurrent_limit, daily_used, 
            daily_limit, next_available_at?, queue_position? }
```

### 14.4 In-process API surface

(viz v2)

### 14.5 Job_id pattern (extended v3)

**Job states:**

```
queued → running → completed
   │         │         
   │         ├──→ failed
   │         │
   │         └──→ cancelled
   │
   └──→ rejected (validation error pre-run)
   
v3 additional states:
   queued → throttled (waiting on concurrent slot)
   running → paused (system maintenance, rare)
```

**PostgreSQL table additions (v3):**

```
uep_jobs (existing from v2):
├── ... existing columns
├── tier_at_creation              VARCHAR    -- snapshot of user tier
├── queue_position                INT NULL   -- for throttled state
├── dwg_conversion_log_uri        VARCHAR    -- v3
└── ifc_streaming_mode_used       VARCHAR    -- v3 (full/partial/strict)

tier_limits (NEW v3):                        -- Q8 → B
├── tier_id                       VARCHAR PRIMARY KEY
├── concurrent_jobs               INT
├── daily_limit                   INT
├── per_project                   INT
├── burst_window_minutes          INT
├── burst_limit                   INT
├── price_credits                 INT
├── updated_at                    TIMESTAMPTZ
└── updated_by                    UUID FK

user_tier_overrides (NEW v3):                -- enterprise customers
├── user_id                       UUID PRIMARY KEY
├── tier_id                       VARCHAR FK → tier_limits
├── concurrent_jobs_override      INT NULL
├── daily_limit_override          INT NULL
├── notes                         TEXT
└── expires_at                    TIMESTAMPTZ NULL

sliding_window_starts (NEW v3):              -- rate limit tracking
├── user_id                       UUID
├── started_at                    TIMESTAMPTZ
└── job_id                        UUID
INDEX (user_id, started_at)
-- query: COUNT(*) WHERE user_id=? AND started_at > NOW() - INTERVAL '15 min'

ifc_versions (NEW v3):
├── version_id                    UUID PRIMARY KEY
├── project_id                    UUID FK
├── file_hash                     VARCHAR(64) UNIQUE  -- SHA-256
├── file_size_bytes               BIGINT
├── original_filename             VARCHAR
├── owner_history_timestamp       TIMESTAMPTZ NULL   -- IfcOwnerHistory
├── owner_history_author          VARCHAR NULL
├── owner_history_app             VARCHAR NULL       -- Revit / Allplan / etc
├── uploaded_at                   TIMESTAMPTZ
├── uploaded_by                   UUID FK
├── previous_version_id           UUID FK NULL       -- linked chain
├── extraction_job_id             UUID FK NULL
├── streaming_mode_used           VARCHAR
└── entity_counts_summary         JSONB              -- {spaces: 24, walls: 67, ...}

ifc_diff_reports (NEW v3):
├── diff_id                       UUID PRIMARY KEY
├── from_version_id               UUID FK
├── to_version_id                 UUID FK
├── computed_at                   TIMESTAMPTZ
├── added_count                   INT
├── removed_count                 INT
├── modified_count                INT
├── summary_narrative             TEXT
├── full_report_uri               VARCHAR             -- gs://.../diff.json
└── UNIQUE (from_version_id, to_version_id)

dwg_conversion_attempts (NEW v3):
├── attempt_id                    UUID PRIMARY KEY
├── project_id                    UUID FK
├── original_filename             VARCHAR
├── file_hash                     VARCHAR(64)
├── converter_used                ENUM(oda, libredwg)
├── started_at                    TIMESTAMPTZ
├── completed_at                  TIMESTAMPTZ NULL
├── exit_code                     INT NULL
├── error_message                 TEXT NULL
├── resulting_dxf_uri             VARCHAR NULL
└── cache_hit                     BOOLEAN
```

**Pre-run validation (v3 enforced):**

Before inserting `uep_jobs` row with status=queued, atomically check:

```sql
-- 1. Concurrent limit
SELECT COUNT(*) FROM uep_jobs 
WHERE triggered_by_user_id = $user_id 
  AND status IN ('queued', 'running', 'throttled')
-- If >= effective_concurrent_limit($user_id) → 429

-- 2. Per-project lock
SELECT COUNT(*) FROM uep_jobs 
WHERE project_id = $project_id 
  AND status IN ('queued', 'running')
-- If > 0 AND NOT force_rerun → 409

-- 3. Sliding window
SELECT COUNT(*) FROM sliding_window_starts 
WHERE user_id = $user_id 
  AND started_at > NOW() - INTERVAL '$burst_window_minutes minutes'
-- If >= burst_limit → 429 with Retry-After header

-- 4. Daily limit
SELECT COUNT(*) FROM uep_jobs 
WHERE triggered_by_user_id = $user_id 
  AND DATE(created_at) = CURRENT_DATE
-- If >= daily_limit → 429
```

Wrapped in `SERIALIZABLE` transaction to prevent race conditions on concurrent 
POST /uep/run calls.

Effective limit computed: `user_tier_overrides.X_override` if exists, else 
`tier_limits.X` for user's tier.

### 14.6 Persistence model

**Per-job GCS structure (extended v3):**

```
gs://stavagent-uep-outputs/{project_id}/{job_id}/
├── manifest.json
├── phase1/per_source/{hash}.json
├── phase2/coverage_report.json
├── phase3/reconciliation_report.json
├── phase4/derived_quantities.json
├── final/items.json
├── dwg_conversion_log.json      [v3]
└── ifc_diff_report.json         [v3, if applicable]
```

**Additional GCS buckets:**

```
gs://stavagent-dwg-conversion-cache/{file_hash}.dxf
gs://stavagent-ifc-archives/{project_id}/{version_id}/original.ifc  [v3]
gs://stavagent-ifc-diffs/{from_version}_{to_version}/diff.json      [v3]
gs://stavagent-coverage-matrices/  (if Q2 → B)
```

**Retention:**
- Active project outputs: indefinite
- Failed/cancelled job outputs: 30 days
- DWG conversion cache: 90 days inactive then delete
- IFC archives: per Q9 decision (default A = indefinite)
- IFC diffs: same as IFC archives
- Audit logs: 1 year minimum

### 14.7-14.10 (Auth, observability, deployment, migration)

(beze změny vs v2, plus v3 deployment additions below)

**Dockerfile additions (v3):**

```dockerfile
# v3: LibreDWG fallback converter
RUN apt-get update && apt-get install -y \
    libredwg-tools                       # provides dwg2dxf binary
    
# v3: IFC streaming + diff
RUN pip install --no-cache-dir \
    ifcopenshell>=0.8.0 \
    ifcdiff>=0.1.0                       # if available, else custom diff
```

**Cloud Run config (v3 updated):**
- Memory: 4GB → 6GB (large IFC streaming)
- Timeout: 900s → 1800s (large IFC + version diff)
- Min instances: 0 → 1 (eliminate cold start for tier limit checks)

---

## §15. ROBUSTNESS & SCALING (v3 — NEW)

### 15.1 DWG Conversion Fallback Chain

**Primary: ODA File Converter** (Open Design Alliance, free commercial use).

**Fallback: LibreDWG** (GNU project, `dwg2dxf` command, package 
`libredwg-tools` in Debian/Ubuntu).

#### 15.1.1 Failure detection

ODA conversion considered failed if ANY of:

- Subprocess exit code != 0
- Subprocess stderr matches error patterns:
  - "Unsupported version"
  - "Corrupt file"
  - "Cannot read"
  - "Invalid DWG"
- Conversion timeout exceeded (default 60s for typical DWG, 180s for >50MB)
- Output DXF file does not exist or size == 0
- Output DXF fails to load: `ezdxf.readfile()` raises `DXFError` or 
  `DXFStructureError`

#### 15.1.2 Fallback flow

```
DWG input
    │
    ▼
┌─────────────────────────────┐
│ Cache check (file_hash)     │
└──┬──────────────────────────┘
   │
   ▼ cache miss
┌─────────────────────────────┐
│ Attempt 1: ODA File         │     success ──► cache DXF
│ Converter                   │              ──► ezdxf parse
└──┬──────────────────────────┘
   │ failure
   ▼
┌─────────────────────────────┐
│ Log ODA failure details     │
│ Attempt 2: LibreDWG dwg2dxf │     success ──► cache DXF
└──┬──────────────────────────┘              ──► ezdxf parse
   │ failure                                     ──► confidence: 0.80
   ▼                                                  (lower than ODA 0.95
┌─────────────────────────────┐                       due to less mature)
│ Log LibreDWG failure        │
│ Insert dwg_conversion_      │
│ attempts row "manual"       │
│ Coverage report flag:       │
│ "DWG_CONVERSION_FAILED"     │
│ User notification           │
└─────────────────────────────┘
```

#### 15.1.3 Cache strategy

- Cache key: SHA-256 of DWG file content
- Cache location: `gs://stavagent-dwg-conversion-cache/{hash}.dxf`
- Cache metadata: `{hash}.meta.json` with converter used, conversion timestamp, 
  source file size
- Cache invalidation: on `ezdxf.readfile()` failure on cached DXF, delete 
  cache entry, retry conversion from scratch

#### 15.1.4 Confidence adjustment

DWG via ODA: confidence 0.95 (proven authoritative converter).  
DWG via LibreDWG: confidence 0.80 (less mature, edge cases may exist).

Downstream consumers (reconciliation engine, derivation registry) should 
respect the confidence delta.

#### 15.1.5 User-facing messaging

When DWG conversion completely fails:

```
"Unable to automatically convert DWG file: {filename}
Tried: ODA File Converter (error: {oda_error})
Tried: LibreDWG (error: {libredwg_error})

Possible causes:
- DWG version older than R14 (pre-1997)
- File corruption during upload
- Vendor-specific extensions not supported

Options:
1. Manually convert to DXF using AutoCAD or BricsCAD, re-upload
2. Re-export from original CAD tool with 'DXF R2018' format
3. Continue extraction without this file (will appear as gap in 
   coverage report)
4. Contact support with file for investigation
"
```

#### 15.1.6 Testing

- Fixture: valid R2018 DWG, valid R2010 DWG, valid R14 DWG, intentionally 
  corrupted DWG, R12 DWG (pre-R14)
- Mock ODA subprocess to inject specific failure modes
- Mock LibreDWG subprocess for fallback testing
- Cache hit/miss scenarios

### 15.2 Concurrent Job Limits per User

#### 15.2.1 Architecture

Three independent layers:

1. **Per-user concurrent limit** — at any moment, user has ≤ N jobs in 
   `(queued, running, throttled)` states.
2. **Per-project lock** — at any moment, project has ≤ 1 job in 
   `(queued, running)` states.
3. **Sliding-window burst limit** — in any 15-min window, user starts 
   ≤ M jobs.

Plus daily cap (per Q8).

#### 15.2.2 Limit determination (per user)

Effective limits computed at `/uep/run` validation:

```python
def effective_limits(user_id):
    user = fetch_user(user_id)
    tier = fetch_tier_limits(user.tier_id)
    overrides = fetch_user_tier_overrides(user_id)
    
    return {
        'concurrent': overrides.concurrent_override or tier.concurrent_jobs,
        'daily': overrides.daily_override or tier.daily_limit,
        'per_project': tier.per_project,
        'burst_window_minutes': tier.burst_window_minutes,
        'burst_limit': tier.burst_limit
    }
```

(Naming above is illustrative — Claude Code derives from existing patterns.)

#### 15.2.3 Validation sequence (atomic, SERIALIZABLE transaction)

```
BEGIN SERIALIZABLE;

-- Check 1: per-project lock
SELECT COUNT(*) FROM uep_jobs 
WHERE project_id = $project_id 
  AND status IN ('queued', 'running', 'throttled');
-- If > 0 AND NOT $force_rerun: 
--     ROLLBACK; return 409 Conflict;

-- Check 2: concurrent limit
SELECT COUNT(*) FROM uep_jobs 
WHERE triggered_by_user_id = $user_id 
  AND status IN ('queued', 'running', 'throttled');
-- If >= limits.concurrent:
--     If queue mode enabled: enqueue as throttled (priority FIFO);
--     Else ROLLBACK; return 429 with retry_after estimate;

-- Check 3: burst window
SELECT COUNT(*) FROM sliding_window_starts 
WHERE user_id = $user_id 
  AND started_at > NOW() - $burst_window_minutes * INTERVAL '1 minute';
-- If >= limits.burst_limit:
--     ROLLBACK; return 429 with Retry-After header 
--       (= earliest started_at + burst_window expiry);

-- Check 4: daily limit
SELECT COUNT(*) FROM uep_jobs 
WHERE triggered_by_user_id = $user_id 
  AND DATE(created_at) = CURRENT_DATE;
-- If >= limits.daily:
--     ROLLBACK; return 429 "Daily limit reached, resets at 00:00 UTC";

-- All checks passed:
INSERT INTO sliding_window_starts(user_id, started_at, job_id) 
  VALUES ($user_id, NOW(), $new_job_id);
INSERT INTO uep_jobs(job_id, project_id, status, ...) 
  VALUES ($new_job_id, $project_id, 'queued', ...);

COMMIT;
```

#### 15.2.4 Force rerun handling

When `force_rerun=true`:

1. Identify existing active job for project
2. Mark existing job `status=cancelled`, `cancellation_reason='superseded_by_force_rerun'`
3. Best-effort signal Cloud Tasks to skip if not yet started
4. Proceed with new job validation (concurrent + burst + daily limits still apply)

#### 15.2.5 Queue mode (optional, per Q8C)

If enabled, exceeding concurrent limit enqueues as `throttled` state 
instead of rejecting. Background worker dequeues throttled jobs FIFO 
as concurrent slots free up.

Default: queue mode OFF (clearer UX), enable per tier in tier_limits config.

#### 15.2.6 Sliding window cleanup

Background job (daily) deletes `sliding_window_starts` rows older than 
24 hours to prevent unbounded growth.

#### 15.2.7 Tier limit administration

If Q8 → B: admin endpoint `PATCH /admin/tier-limits/{tier_id}` for adjustments.
Audit log captures who changed what when.

#### 15.2.8 User-facing UX

REST `429` response body:

```json
{
  "error": "rate_limit_exceeded",
  "reason": "concurrent_limit",
  "current_usage": 5,
  "limit": 5,
  "retry_after_sec": 180,
  "next_available_at": "2026-05-18T14:32:00Z",
  "upgrade_url": "https://stavagent.cz/billing"
}
```

REST `409` response body:

```json
{
  "error": "project_already_running",
  "active_job_id": "uuid",
  "active_job_status": "running",
  "active_job_phase": "phase2",
  "force_rerun_url": "POST /uep/run with force_rerun=true",
  "wait_url": "GET /uep/jobs/{active_job_id}/stream"
}
```

#### 15.2.9 Testing

- Test 1: User at concurrent limit, new job rejected with 429
- Test 2: User exceeds burst window, rejected with Retry-After
- Test 3: User hits daily limit, rejected with reset time
- Test 4: Project already running, new run rejected with 409
- Test 5: force_rerun cancels existing, new job proceeds
- Test 6: Tier override applied, higher limit honored
- Test 7: Concurrent requests race — only one succeeds (serializable test)
- Test 8: Queue mode (if enabled) — throttled jobs FIFO dispatched

### 15.3 IFC Versioning & Change Detection

#### 15.3.1 Version identity

Each IFC upload identified by SHA-256 hash of file content. Identical 
hash = same version (deduplication). Different hash = new version.

#### 15.3.2 Version registration

On every IFC upload:

```
1. Compute SHA-256 hash
2. Check ifc_versions for (project_id, hash) — if exists, no new version
3. Extract IfcOwnerHistory:
   - CreationDate → owner_history_timestamp
   - OwningUser.ThePerson.GivenName + FamilyName → owner_history_author
   - OwningApplication.ApplicationFullName + Version → owner_history_app
4. Look up most recent prior version for project (max uploaded_at)
5. Insert ifc_versions row:
   - version_id (new UUID)
   - file_hash
   - previous_version_id = prior version (if any)
   - entity_counts_summary (computed during Phase 1)
6. Store full IFC archive: gs://stavagent-ifc-archives/{project_id}/{version_id}/original.ifc
7. If previous_version_id is set, enqueue diff job
```

#### 15.3.3 Diff engine (basic version — PR3)

Compute entity-level diff between two versions. Basic implementation:

```python
def basic_diff(prev_ifc_path, curr_ifc_path):
    prev = ifcopenshell.open(prev_ifc_path)
    curr = ifcopenshell.open(curr_ifc_path)
    
    prev_entities = {e.GlobalId: e for e in prev.by_type("IfcRoot")}
    curr_entities = {e.GlobalId: e for e in curr.by_type("IfcRoot")}
    
    added = curr_entities.keys() - prev_entities.keys()
    removed = prev_entities.keys() - curr_entities.keys()
    common = curr_entities.keys() & prev_entities.keys()
    
    modified = []
    for gid in common:
        if entity_attrs_changed(prev_entities[gid], curr_entities[gid]):
            modified.append(gid)
    
    return {
        "added": list(added),
        "removed": list(removed),
        "modified": modified,
        "summary": generate_narrative(...)
    }
```

(Naming illustrative — Claude Code adapts to repo conventions.)

For PR3: basic diff sufficient. Full diff engine (with quantity deltas, 
material change analysis, structured narrative) → PR4.

#### 15.3.4 Diff engine (full version — PR4, scope excluded from this task)

PR4 will extend basic_diff to:

- Categorize entities by type (IfcWall, IfcSlab, IfcSpace, etc.)
- Per-category counts of added/removed/modified
- Quantity deltas (Σ area change, Σ volume change per element type)
- Material composition changes per entity
- Property set changes per entity
- Spatial structure changes (rooms split/merged)
- Human-readable narrative summary
- Severity classification (cosmetic / structural / major scope change)

#### 15.3.5 Diff storage

```
gs://stavagent-ifc-diffs/{from_version}_{to_version}/
├── diff.json              # full structured diff
└── summary.md             # human-readable summary
```

PostgreSQL `ifc_diff_reports` table indexes diff existence + summary 
numbers for fast querying.

#### 15.3.6 Diff triggering

- Automatic: on IFC upload with existing previous_version_id
- Manual: `GET /uep/ifc-diff?project_id=...&from_version=...&to_version=...`
  Computes on-demand if not cached, caches result

#### 15.3.7 Re-extraction strategy on version change

When new IFC version uploaded:

- **Option A**: Full re-extraction (run full UEP on new version). Safe, 
  slow, expensive.
- **Option B**: Incremental — extract only changed entities, merge with 
  previous extraction. Fast, but complex.

For PR3: **always full re-extraction**. Incremental option in future PR.

If diff > 50% entity changes → STOP condition #11 triggers (request user 
confirmation).

#### 15.3.8 User-facing UX

When new IFC version uploaded:

```
"IFC model revision detected.

Previous version: uploaded 2026-04-15 by Jan Architect (Revit 2025)
                  321 spaces, 1,247 walls, 89 doors

Current version:  just uploaded by Jan Architect (Revit 2025)
                  324 spaces (+3), 1,251 walls (+4), 89 doors (=)

Major changes detected:
- 3 new rooms added on 2nd floor
- 4 walls added (likely partition changes)
- 12 walls have modified properties

Recommended action: full re-extraction (estimated $2.40, 8 minutes)
[Run extraction] [View detailed diff] [Skip — keep previous extraction]
"
```

#### 15.3.9 Testing

- Fixture: IFC v1, IFC v2 with known changes (3 added rooms, 1 wall removed)
- Diff engine produces correct added/removed/modified lists
- Version chain integrity (v3 links to v2 links to v1)
- Hash dedup (same file uploaded twice → no new version)

### 15.4 Streaming IFC Parser

#### 15.4.1 Size thresholds (per Q10 → A recommendation)

| IFC size | Strategy | Memory budget |
|---|---|---|
| < 200 MB | Standard `ifcopenshell.open(path)` full-load | <500MB heap |
| 200 MB – 1 GB | Partial streaming (geometry iterator + selective full-load for property sets) | <1.5GB heap |
| 1 GB – 2 GB | Strict streaming, multi-pass per category | <1.5GB heap |
| > 2 GB | Reject + escalate (admin queue for instance memory bump) | n/a |

#### 15.4.2 Standard mode (<200MB)

```python
import ifcopenshell
ifc = ifcopenshell.open(path)

spaces = ifc.by_type("IfcSpace")
walls = ifc.by_type("IfcWall")
# ... full in-memory traversal
```

#### 15.4.3 Partial streaming mode (200MB-1GB)

Use geometry iterator for shape representations, full in-memory only for 
spatial structure + property sets:

```python
import ifcopenshell
import ifcopenshell.geom

ifc = ifcopenshell.open(path)  # still loads model graph, ~1GB heap acceptable

# Streaming geometry iterator
settings = ifcopenshell.geom.settings()
iterator = ifcopenshell.geom.iterator(settings, ifc, multiprocessing.cpu_count())
if iterator.initialize():
    while True:
        shape = iterator.get()
        # process shape, accumulate to output
        if not iterator.next():
            break
```

#### 15.4.4 Strict streaming mode (>1GB)

Multi-pass per entity category, never load full model graph:

```python
# Pass 1: spatial structure (small, fully loaded)
ifc = ifcopenshell.open(path)
project = ifc.by_type("IfcProject")[0]
spatial_tree = build_spatial_tree(project)
ifc = None  # release model graph
gc.collect()

# Pass 2: each entity type separately
for entity_type in ["IfcWall", "IfcSlab", "IfcDoor", "IfcWindow", 
                    "IfcBeam", "IfcColumn"]:
    ifc = ifcopenshell.open(path)
    for entity in ifc.by_type(entity_type):
        extract_entity_to_output(entity, output_writer)
    ifc = None
    gc.collect()

# Pass 3: materials and properties (incremental)
# ...

# Pass 4: quantities
# ...
```

Output written to per-source JSON incrementally (line-delimited JSON 
or streaming JSON writer) to avoid building huge in-memory result.

#### 15.4.5 Memory monitoring

Background monitor:
- Sample process RSS every 5 seconds during IFC parse
- If RSS exceeds 80% of allocated memory → log warning, attempt early 
  GC, continue
- If RSS exceeds 95% → abort job with `streaming_overflow` error status 
  rather than OOM crash

#### 15.4.6 Reject threshold

> 2 GB: pre-load size check rejects upfront:

```json
{
  "error": "ifc_too_large",
  "size_bytes": 2400000000,
  "max_supported": 2000000000,
  "options": [
    "Split via ifcconvert externally (separate large model into building 
     sections, upload each as separate project)",
    "Contact admin for memory bump on this project (Enterprise tier)"
  ]
}
```

#### 15.4.7 Correctness validation

Streaming mode MUST produce identical unified schema output as full-load 
mode. Validation:

- Fixture: medium IFC (~500MB) processed in both modes
- Output JSON deep-equal (modulo iteration order)
- Continuous integration test runs this comparison

#### 15.4.8 Progress reporting

Streaming mode reports progress at sub-phase boundaries via job status:

- "Streaming IFC: spatial structure (5%)"
- "Streaming IFC: walls (1247/1247, 35%)"
- "Streaming IFC: slabs (89/89, 45%)"
- ...
- "Streaming IFC: materials (95%)"
- "Streaming IFC: complete (100%)"

Visible via `GET /uep/jobs/{job_id}/stream` SSE.

#### 15.4.9 Testing

- Fixture: small IFC (50MB) → standard mode
- Fixture: medium IFC (300MB) → partial streaming mode
- Fixture: large IFC (1.2GB) → strict streaming mode
- Synthetic IFC (3GB) → rejected with proper error
- Streaming vs full-load output comparison test

### 15.5 Cross-cutting concerns

#### 15.5.1 Logging

All robustness events logged with structured fields:

- DWG conversion: converter_used, exit_code, error_pattern_matched, 
  cache_hit, duration_ms
- Concurrent limit: user_id, limit_type, current_usage, limit, action_taken
- IFC version: project_id, hash, previous_version_id, entity_counts
- Streaming: ifc_size_mb, mode_used, peak_rss_mb, duration_ms

#### 15.5.2 Metrics (Cloud Monitoring)

- DWG conversion success rate (ODA vs LibreDWG breakdown)
- DWG conversion latency distribution
- Concurrent limit rejection rate per tier
- Burst window rejection rate
- IFC version uploads per project (growth pattern)
- IFC streaming mode distribution (% files in each tier)
- IFC peak memory per size bucket

#### 15.5.3 Alerting

- DWG total failure rate > 5% over 1 hour
- Concurrent limit rejection rate > 30% (capacity issue)
- IFC streaming OOM aborts > 1 per day
- IFC diff engine errors > 1% over 1 hour

---

**End of task v3.**

> Reminder: **read repo first → derive naming → ask interview questions 
> (now including Q8/Q9/Q10) → implement.** Žádný kód před interview answers.

> v3 added: §15 Robustness & Scaling (DWG fallback chain, concurrent limits, 
> IFC versioning, streaming IFC), Q8/Q9/Q10 to interview, criteria 37-50, 
> stop conditions 9-14, updated PR phasing distributing robustness across 
> PR2 (concurrency) and PR3 (DWG fallback, IFC versioning, streaming), 
> updated §14.5 with new DB tables (tier_limits, user_tier_overrides, 
> sliding_window_starts, ifc_versions, ifc_diff_reports, 
> dwg_conversion_attempts), §14.10 Cloud Run config bumps (6GB memory, 
> 1800s timeout, min_instances=1).
