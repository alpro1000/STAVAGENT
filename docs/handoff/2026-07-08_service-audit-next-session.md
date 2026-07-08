# Handoff 2026-07-08 (konec relace) — zadání pro příští relaci

**Base:** `origin/main` @ `6b1ee87` — vše z 2026-07-08 je v main a **deployed**
(7 PR: #1428 Sprint A, #1430/#1431 klasifikator proxy, #1432 working-showcase,
#1433 registry-sync JWT, #1434 PositionsPanel JWT).
**Vývojová větev příští relace:** nová `claude/<téma>-<5rnd>` — restartovat
z main (`git fetch origin main && git checkout -B claude/<name> origin/main`).

---

## Jak začít příští relaci (mantra STAVAGENT)

1. **Effort `high`/`max`**, adaptive thinking OFF.
2. **Přečíst v pořadí** (root `CLAUDE.md` §mandatory reading): `docs/steering/`
   (conventions → product → tech → structure → domain) + `docs/soul.md §9`
   (nejnovější = 2026-07-08 nahoře) + tento handoff + `BACKLOG.md`.
3. **Restart větve z main** (viz výše) — NIKDY nestavět na staré větvi.
4. Merge-commit, ne squash (Pattern 12). Po každém merge ověřit přes
   `git worktree` off `origin/main` (ne lokální ref) — lekce #1285→#1295.
5. Owned-table změna → `cross-user-isolation-reviewer` PŘED pushem.
6. Po relaci: `docs/soul.md §9` entry + nový handoff sem.

---

## Stav služby po auditu (co JE hotové a živé)

- **Sprint A security** kompletní + deployed. Všechny secrets v Cloud Run
  (SERVICE_API_KEY, URS_ADMIN_API_KEY, REGISTRY_CLEANUP_SECRET, JWT_SECRET na
  Monolit). Anonymní přístup na credited/mutating routy → 401/403/503.
- **Portal vitrína** = jen funkční moduly (4 AKTIVNÍ + Kalkulačka čerpadel +
  2 BETA: Analýza dokumentace, Analýza výkresů). Placeholdery pryč.
- **Klasifikátor** = jen funkční UI (soubor/text/dokumenty/batch/export).
  Model-selector, Context Editor, mrtvá pole pryč. ÚRS výsledky značené
  «Návrh — ověřte» (web-search, ne katalog).
- **Registry sync** = skutečný hybrid: IndexedDB primární + PostgreSQL
  per-user kopie (Bearer JWT). Nepřihlášen → «Jen lokálně».
- **OTSKP katalog search** = zdravý, pgvector recall živě ověřen.

---

## PRIORITY příští relace (v pořadí)

### 🔴 P1 — Blok C: TZ text → soupis prací všech profesí (`BACKLOG.md` tz-to-worklist)
Founder's core ask («посчитать любую смету»). Honest baseline: kód pokrývá
~10–14 % BOQ (beton + malba); piloty Žihle/RD Jáchymov byly manuální.
4 kroky v dependency order:
1. **passport Gate 2** (~1 relace, nejlevnější výsledek) — napojit hotový
   `planPassport()` mapper jako MCP tool `calculate_from_passport` / route /
   UI import. POZOR counter-soubory (viz BACKLOG + root CLAUDE.md MCP rules).
2. **UWO F2/F3** (~2–3 relace) — portovat work-templates z pilotních skriptů
   RD Jáchymov + HK212 do KB branch YAMLů (PSV/izolace/zemní…).
3. **calculator_prompt_extension** (~144 h) — +14 element types → 14 %→80 %.
4. **Drawing/DXF takeoff jako služba** — množství bez vstupního soupisu
   (největší net-new kus, poslední).

### 🟡 P2 — dotažení auditních zbytků
- **ÚRS licenční katalog** — strategické rozhodnutí Alexandra: koupit ÚRS
  data (pak `is_web_suggestion` mizí) vs navždy web-suggestion. Do rozhodnutí
  ÚRS zůstává «Návrh — ověřte».
- **OTSKP accuracy benchmark** (~1 relace) — postavit 77-query Žihle fixture
  + runner, změřit 80% top-1 / 95% top-3 (nikdy neměřeno).
- **Zbylé 401 na frontendech** — jak uživatel narazí na fail-closed routu bez
  Bearer (`/api/positions`, `/api/portal-projects`, `/api/integration`),
  oprava triviální = `authHeader()`/`portalAuthHeader()` do fetch. Reaktivně.

### 🟢 P3 — z předchozích handoffů (nezměněno)
- tz-passport B-interview (otázky 2+3), warnings items 5-7 (MSS-9/10/golden
  runner), Resource Ceiling per-profession, URS SQLite→PG (infra), api-access
  (blokováno Lemon Squeezy TODOs).
- Ruční Secret Manager TODO: rotace `stavagent_portal`, `MASTER_ENCRYPTION_KEY`,
  `LEMONSQUEEZY_WEBHOOK_SECRET`; ověřit `VITE_DISABLE_AUTH` v Portal Vercel Prod.
- Monolit 403-vs-404 sjednocení; registry-backend test infra (jediný bez ní).

---

## Discipline reminders
- Handoff = tento adresář; root `next-session.md` = jen pointer.
- MCP nový tool = VŠECHNY counter-soubory v jedné změně (server.py
  `_REGISTERED_TOOL_NAMES`, routes.py TOOL_ORDER+TOOL_DESCRIPTIONS, auth.py
  TOOL_COSTS, tool_manifest.py, YAML allow-list, `EXPECTED_TOOLS`
  test_mcp_compatibility.py).
- Žádný `Callable` v MCP tool signatuře (PydanticInvalidForJsonSchema).
