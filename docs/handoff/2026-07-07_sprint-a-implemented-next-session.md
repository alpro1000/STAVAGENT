# Handoff 2026-07-07 (Sprint A implementován) — zadání pro příští relaci

**Base:** `origin/main` @ `ca38b49` + Sprint A branch
`claude/session-closed-sprint-a-handoff-p8y9ek` (6 commitů A1–A6 + testy).
**Zadání této relace:** `2026-07-07_next-session-sprint-a.md` (předchozí handoff).

---

## Co je HOTOVO (Sprint A — security, celý plán A1–A6)

- **A1 Portal** — `/api/pump` + `/api/parse-preview` + `/api/kb/research`
  za `requireAuth`; `/import` štancuje `owner_id` z JWT (ne literál 1);
  PoradnaWidget posílá Bearer; pump `created_by` čte `userId` (bylo `id`
  — pole neexistovalo).
- **A5 Portal fail-closed** — nový `src/config/secrets.js`: JWT_SECRET +
  SERVICE_API_KEY **povinné při startu v produkci** (fail-fast; Cloud Run
  drží starou revizi). `requireServiceKey` bez klíče → 503 (bylo allow-all);
  `requireAuthOrServiceKey` bez klíče → propad na 401. Mounty
  `/api/integration` + `/api/positions` → `requireAuthOrServiceKey`
  (browser JWT callers fungovaly jen díky fail-open). Monolit
  `portalWriteBack` posílá `X-Service-Key`. `canAfford` catch →
  `allowed:false`; kreditovaný POST přes core-proxy bez přihlášení → 401;
  deduction failures se logují.
- **A2 Monolit ownership** — `positions.js` + `planner-variants.js`:
  `optionalAuth` + owner-chain přes nový `services/bridgeOwnership.js`
  (monolith_projects.portal_user_id → bridges.owner_id). Owned bridge +
  cizí/anonym → 403; legacy NULL-owner zůstává kiosk-open. POST kontroluje
  RESOLVED bridge po Phase-11 dedup (cizí portal/registry id už nezapíše
  do cizího mostu) a štancuje `owner_id` při auto-create (anonym → 401).
  DELETE + variants PUT/DELETE resolvují parent chain (bylo raw-id).
  suggest-days (LLM) → 401 pro anonyma. Monolit `auth.js`: JWT_SECRET
  fail-fast v produkci. Frontend: `authHeader()` v `services/api.ts` +
  raw fetche v `applyPlanToPositions` posílají Bearer.
- **A3 URS** — `POST /api/settings/model` + `/model/reset` za fail-closed
  `X-API-Key` gate (`URS_ADMIN_API_KEY`; unset → 503). Cost routy
  jobs/batch/pipeline: opt-in gate `URS_REQUIRE_API_KEY=true` (default
  off — veřejný klasifikator frontend běží dál, rate limity zůstávají).
- **A4 Registry** — `cleanup-empty`: secret z env
  (`REGISTRY_CLEANUP_SECRET`, unset → 503) + SELECT i DELETE owner-scoped
  (dřív mazal prázdné projekty VŠECH ownerů). `formwork-rental/calculate`
  + `export/excel-with-pump` za `requireAuth` (0 frontend callerů).
- **A6 hygiena** — `rozpocet-registry/.env` +
  `stavagent-portal/frontend/.env.production` odtrackovány (bez secretů,
  ověřeno); root `.gitignore` už pokrývá.
- **Testy:** Portal 58/58 (49 + 9 nových negativ), Monolit Jest 73/73
  (62 + 11 ownership negativ), URS 240/240 (232 + 8 gate negativ),
  Monolit frontend tsc + Portal frontend tsc clean.
  `cross-user-isolation-reviewer` spuštěn před pushem (per root CLAUDE.md).

---

## 🔴 DEPLOY PREREQUISITY (ruční, PŘED merge/deployem téhle větve)

1. **`SERVICE_API_KEY`** — `openssl rand -hex 32` → Cloud Run env
   (Secret Manager) na **Portal + Monolit** backendech (Portal jinak
   nenastartuje novou revizi — fail-fast je záměr; Monolit ho potřebuje
   pro portalWriteBack).
2. **`URS_ADMIN_API_KEY`** — nastavit na URS Cloud Run, jinak je přepínač
   modelu vypnutý (503) i pro admina.
3. **`REGISTRY_CLEANUP_SECRET`** — nastavit na registry-backendu, pokud
   je cleanup endpoint ještě potřeba.
4. Ověřit, že `JWT_SECRET` je nastaven na Portal + Monolit +
   registry-backend (mělo by být — registry už fail-fast běží).
5. Z předchozího handoffu trvá: rotace hesla `stavagent_portal`,
   `MASTER_ENCRYPTION_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`, ověřit
   `VITE_DISABLE_AUTH` v Portal Vercel Prod.

## Otevřené otázky (Alexander)

- **URS auth model** — API-key vs Portal-JWT pro veřejné matching routy
  (`URS_REQUIRE_API_KEY` gate je připraven, default off).
- **Portal `/api/positions`** (position-instances.js) — routy nemají
  vlastní owner-scoping v SQL (mount-level auth je nyní fail-closed, ale
  valid-JWT uživatel dosáhne na cizí position instance podle UUID).
  Viz nález isolation-reviewera — kandidát Sprint A follow-up.
- registry-backend nemá test infra (jediný backend bez ní) — negativní
  testy A4 jen syntax-checked; zvážit malý Jest setup.

## Priority dál (nezměněno z předchozího handoffu)

- **P2 tz-passport:** B-interview (otázky 2+3) + gate 2 consumer wiring.
- **P3:** warnings items 5-7, Resource Ceiling per-profession, URS PG,
  api-access, LIVE re-verifikace fixů po deployi.
