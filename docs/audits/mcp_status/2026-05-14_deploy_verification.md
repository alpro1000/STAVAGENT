# MCP Production Deployment Verification

**Datum:** 2026-05-14
**Branch:** `claude/audit-mcp-server-lAbOS`
**Repo HEAD:** `214a468` (audit report commit) on top of `0ecfa53`
**Scope:** Read-only verification — žádné code change.

---

## Summary table

| # | Verification | Result | Note |
|---|--------------|--------|------|
| 0 | Cloud Run `describe stavagent-mcp` | **N/A** | Service name in task neexistuje (skutečné jméno = `concrete-agent`). `gcloud` není v této sandbox dostupný. |
| 1 | `GET /mcp/health` | **FAIL — BLOCKED + endpoint neexistuje** | HTTP 403 *"Host not in allowlist"* z této sítě. Navíc v kódu žádný `/mcp/health` neexistuje (FastMCP mountuje pouze MCP protokol na `/mcp/`). |
| 2 | `POST /api/v1/mcp/oauth/token` (JSON dle taska) | **FAIL — wrong content-type + BLOCKED** | Endpoint v kódu očekává `application/x-www-form-urlencoded` (FastAPI `Form(...)`), ne JSON. JSON varianta by vrátila 422. + Sandbox egress 403. |
| 3 | `GET /api/v1/mcp/tools` | **FAIL — endpoint neexistuje** | V `routes.py` není žádný list-of-tools endpoint. Existují pouze 6 dílčích REST wrapperů (`/tools/otskp`, `/tools/classify`, `/tools/calculate`, `/tools/breakdown`, `/tools/norms`, `/tools/advisor`). |
| 4 | SQLite WAL DB persistence | **FAIL (CRITICAL)** | Žádný persistent volume v `cloudbuild-concrete.yaml`. DB na efemérním FS → každý redeploy = wipe. Detail níže. |
| 5 | Rate limit (11×/60s → 429) | **N/A (code-verified PASS)** | Z této sandbox nelze síťově otestovat. Code review: `auth.py:52-66` implementuje `RATE_LIMIT_MAX=10`, `RATE_LIMIT_WINDOW=60` per identifier (IP). Logika korektní. |
| 6 | `GET /api/v1/mcp/pricing` (public) | **BLOCKED** | HTTP 403 *"Host not in allowlist"* z této sítě. |
| 7 | `GET /api/v1/mcp/tools/otskp?query=…` (free) | **BLOCKED** | HTTP 403 *"Host not in allowlist"* z této sítě. |

**Overall verdict:** ❌ Verifikace z této session **nebyla možná**. Vyžaduje run z autorizovaného prostředí s `gcloud auth` + sítí, která má přístup na `*.run.app`.

---

## 0. Cloud Run describe — service name correction

Task volá:

```bash
gcloud run services describe stavagent-mcp --region=europe-west3 \
  --format="value(status.url,status.latestReadyRevisionName)"
```

**Reálný stav:**

- Žádný Cloud Run service `stavagent-mcp` per CLAUDE.md není definován.
- MCP server běží **mountnutý na `concrete-agent`** Cloud Run service (region `europe-west3`):
  - `app/main.py:222` → `app.mount("/mcp", MCPOriginMiddleware(_mcp_http_app))`
  - `cloudbuild-concrete.yaml:73` → `deploy ... concrete-agent ...`
  - URL: `https://concrete-agent-1086027517695.europe-west3.run.app`

**Correct command:**

```bash
gcloud run services describe concrete-agent --region=europe-west3 \
  --format="value(status.url,status.latestReadyRevisionName,spec.template.spec.containers[0].image)"
gcloud run revisions list --service=concrete-agent --region=europe-west3 --limit=3
```

**Sandbox availability:** `gcloud: command not found` → cannot execute.

---

## 1-3. HTTP probe results (raw)

Všechny requesty z této session vrátily HTTP **403 `Host not in allowlist`** s latencí ~30-240 ms. Jde o sandbox egress proxy, **ne** o response z Cloud Run.

```text
GET  /mcp/health                                 → 403 Host not in allowlist
GET  /health                                     → 403 Host not in allowlist
GET  /                                           → 403 Host not in allowlist
POST /api/v1/mcp/oauth/token (form-urlencoded)   → 403 Host not in allowlist
POST /api/v1/mcp/oauth/token (json)              → 403 Host not in allowlist
GET  /api/v1/mcp/pricing                         → 403 Host not in allowlist
GET  /api/v1/mcp/tools                           → 403 Host not in allowlist
GET  /api/v1/mcp/tools/otskp?query=beton+C30/37  → 403 Host not in allowlist
```

### Endpoint-existence audit (code-level)

| Endpoint dle taska | V kódu? | Detail |
|--------------------|---------|--------|
| `GET /mcp/health` | ❌ Ne | FastMCP `http_app(path="/")` registruje pouze `POST /mcp/` (MCP streamable HTTP). Žádný `/health` sub-path. FastAPI má `/health` na root → kdyby URL bylo `/health` (bez prefixu `/mcp/`) a sandbox nebyl blocked, prošlo by. |
| `POST /api/v1/mcp/oauth/token` | ✅ Ano (form) | `routes.py:149` — FastAPI `Form(...)` parametry. **Vyžaduje `application/x-www-form-urlencoded`** (per OAuth 2.0 RFC 6749 §4.4.2). JSON varianta v tasku selže s 422. |
| `GET /api/v1/mcp/tools` (list) | ❌ Ne | V `routes.py` chybí list endpoint. K dispozici je 6 REST wrapperů `/tools/{otskp,classify,calculate,breakdown,norms,advisor}` (chybí `urs`, `budget`, `document` — pouze přes MCP protokol). |

### Correct probe set (pro autorizovaný env)

```bash
URL=https://concrete-agent-1086027517695.europe-west3.run.app

# Service health (FastAPI root health)
curl -s "$URL/health"

# MCP transport (MCP protocol POST — vyžaduje MCP-Session-Id handshake)
curl -s -X POST "$URL/mcp/" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","clientInfo":{"name":"audit","version":"1.0"},"capabilities":{}}}'

# OAuth (správný content-type)
curl -s -X POST "$URL/api/v1/mcp/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=sk-stavagent-XXXX&client_secret=ignored"

# Public pricing
curl -s "$URL/api/v1/mcp/pricing"

# Free tool (no auth)
curl -s "$URL/api/v1/mcp/tools/otskp?query=beton+C30/37&max_results=2"
```

---

## 4. SQLite WAL DB persistence — **CRITICAL FAIL**

### Code-level findings

`packages/core-backend/app/mcp/auth.py:71`:

```python
_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "mcp_keys.db"
```

Resolves to `concrete-agent/packages/core-backend/data/mcp_keys.db` — uvnitř kontejneru, **na efemérním filesystem**.

### Deploy config (`cloudbuild-concrete.yaml`)

Žádný `--add-volume` / `--add-volume-mount` / Cloud Storage FUSE mount. Žádný `--execution-environment=gen2` (gen2 by povolovalo volume mounty). Žádná Cloud SQL migrace pro MCP keys (SQL migrace step se týká pouze `nkb_norms`/`nkb_rules`).

```yaml
- --min-instances=1   # ← snižuje frekvenci wipe, NEELIMINUJE ji
```

### Důsledek

| Scénář | Co se stane s `mcp_keys.db` |
|--------|------------------------------|
| Cloud Run scale-up na 2+ instance | Každá instance má **vlastní izolovanou DB** → API key vytvořený na instanci A nelze validovat na B → 401 *"Invalid API key"* podle hash routing. |
| `min-instances=1` v idle | Instance žije → DB persistuje. |
| Nový deploy (`gcloud run deploy` nebo Cloud Build) | Container se vymění → **wipe**: všichni uživatelé ztratí API key + zůstatek kreditů. |
| Cloud Run revize crash/restart | Re-created container → **wipe**. |
| Bcrypt password hashes | Také wipe → uživatelé se nemohou přihlásit přes `/auth/login` ani vyzvednout klíč. |

**Doporučení (P0):**

1. Migrace `mcp_api_keys` + `mcp_credit_log` do Cloud SQL Postgres (`stavagent-db`) — instance už mountnutá v `cloudbuild-concrete.yaml:80`, stačí přidat tabulky a přepsat `auth.py` connection na asyncpg/SQLAlchemy.
2. Alternativa (rychlejší, méně bezpečná): GCS Fuse mount pro `data/` adresář + `--execution-environment=gen2`. Nepodporuje WAL spolehlivě (fsync semantika přes FUSE je problematická pro SQLite) → nedoporučeno pro production.
3. Workaround pro demo: udržet `--min-instances=1` + `--max-instances=1` (single-instance lock) + cold-restart on deploy je akceptovatelný pouze pro alfa, nepřežije real growth.

---

## 5. Rate limit (code-verified)

`auth.py:48-66`:

```python
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_rate_lock = threading.Lock()
RATE_LIMIT_MAX = 10  # max attempts per window
RATE_LIMIT_WINDOW = 60  # seconds

def _check_rate_limit(identifier: str) -> bool:
    now = time.monotonic()
    with _rate_lock:
        attempts = _rate_limit_store[identifier]
        _rate_limit_store[identifier] = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
        if len(_rate_limit_store[identifier]) >= RATE_LIMIT_MAX:
            return False
        _rate_limit_store[identifier].append(now)
        return True
```

Wired na `/auth/register` (`routes.py:115-117`) + `/auth/login` (`routes.py:127-129`) přes `result.get("status") == "rate_limited"` → HTTP 429.

**Scope correctness:** rate-limit je per IP/identifier a per Cloud Run **instance** (in-memory dict). Při >1 instanci může útočník přepnout instanci přes load balancer → další 10 attempts. Pro auth endpoints to není kritické (bcrypt kalkulace je sama o sobě brzda), ale stojí to za zmínku.

**Probe (autorizovaný env):**

```bash
URL=https://concrete-agent-1086027517695.europe-west3.run.app
for i in $(seq 1 11); do
  printf "Attempt %2d: " "$i"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    -X POST "$URL/api/v1/mcp/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"ratelimit-test@example.com","password":"wrongpass123"}'
done
# Expected: 1-10 → 401 Invalid credentials; 11 → 429 Too many attempts
```

---

## 6. Action items pro reálnou verifikaci

Aby tato verifikace dala výsledek, je potřeba spustit z prostředí, které:

1. Má nainstalovaný a autentikovaný `gcloud` (`gcloud auth login` + project `project-947a512a-481d-49b5-81c`).
2. Má egress na `*.run.app` (cestou Cloud Shell, lokální dev stroj, nebo GitHub Actions runner s GCP credentials).

**Suggested next steps:**

| Prio | Akce | Effort |
|------|------|--------|
| P0 | Spustit `gcloud run services describe concrete-agent --region=europe-west3` + `gcloud run revisions list` z Cloud Shell pro potvrzení live revize ≥ commit `c463ab0` (12. května 2026) | 5 min |
| P0 | Spustit "Correct probe set" výše a doplnit reálná HTTP codes do této tabulky | 10 min |
| P0 | **Migrovat MCP SQLite → Cloud SQL Postgres** (P0 fix, jinak každý redeploy = wipe všech uživatelů) | 4-6 h |
| P1 | Spustit rate-limit probe (11 requestů) | 5 min |
| P1 | Opravit task spec — `stavagent-mcp` → `concrete-agent`, dokumentovat správné endpoint paths + OAuth content-type | 15 min |
| P2 | Přidat `GET /api/v1/mcp/tools` list endpoint (returns 9 tools z `TOOL_COSTS` dict) — užitečné pro directory listing | 30 min |
| P2 | Přidat REST wrappery pro chybějící 3 tools (`find_urs_code`, `parse_construction_budget`, `analyze_construction_document`) — bez nich GPT Actions nemůže volat všechny tools | 1-2 h |

---

## Verdict

❌ **Verifikace neúplná — externí přístup nemožný z této audit session.**

Code-level review **odhalil 1 CRITICAL production bug** (SQLite na efemérním FS = data loss při každém deployi) a **2 task-spec inconsistencies** (špatné jméno služby + neexistující endpointy `/mcp/health` a `/api/v1/mcp/tools`). Tyto findings jsou actionable bez reálného network access.

Reálné PASS/FAIL pro endpointy 1-3 + rate limit 5 musí být doplněno z autorizovaného GCP klienta podle "Suggested next steps" výše.

---

**Verification completed:** 2026-05-14 (read-only, žádný code change).
