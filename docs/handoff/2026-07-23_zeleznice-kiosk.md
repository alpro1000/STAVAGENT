# Handoff — 2026-07-23 — Zeleznice kiosk (železniční svršek+spodek)

**Branch:** `claude/railway-kiosk-separate-jtp8mq` (pushed; PR NEOTEVŘEN — no-PR-unless-asked)
**Root version:** v4.43.0 · **Spec:** `docs/specs/zeleznicni-svrsek-spodek/` (req = TASK v1, design, tasks)

## Co je hotovo (Gates 0–6, jedna session)

1. **KB:** `kb/zeleznicni_{svrsek,vyhybky,mechanizace}.yaml` (data se zdrojem;
   null = honest-blank) + `scripts/gen-knowledge.mjs` s `outAbs` + per-dir index
   → `Zeleznice-Planner/shared/src/kb-generated/` (Monolit artefakty
   byte-identické, `gen:knowledge:check` zelený).
2. **Engine** `Zeleznice-Planner/shared` — `planRailSection`: golden rozdělení
   pražců (ÚRS 824-1 příloha 1:1, dvojčitý, Y-vzorec), lože jen z profilu,
   BK řetězec, výhybky h/ks, stroje výkon-dle-režimu (user norma 0.99),
   Pattern 50 osádky + bezpečnostní role, Catalog-LAST, vrstvy oddělené,
   replay guarantee. **70 vitest + tsc + build zelené.**
3. **Backend** — thin wrapper :3004 (`/api/rail/calculate` service-key
   fail-closed, `/api/rail/catalog` public, 422 uncalculated / 400 Monolit
   parity) + Dockerfile. **7 Jest zelených.**
4. **Frontend** — React+Vite in-browser kalkulačka (flat stone, CZ, LS persist,
   noindex). **tsc + vite build čisté.**
5. **MCP 22→23** — `calculate_railway_works` + `zeleznice_delegate` (mirror
   monolit fail-mode; `ZELEZNICE_API_URL`; sdílený SERVICE_API_KEY); všech 6
   counter-souborů. **7 pytest + test_mcp_compatibility 29/29 + stage-gating
   zelené** (lokálně doinstalováno: pytest, httpx, fastmcp, sqlalchemy, bcrypt).
6. **Docs+infra:** Zeleznice CLAUDE.md+README, root CLAUDE.md v4.43.0 (tree,
   services §3b, MCP 23, Totals, TODO P0), soul §9, structure.md,
   cloudbuild-zeleznice.yaml + triggers/zeleznice.yaml + zeleznice-ci.yml.

## Nedokončeno / blokováno na Alexandrovi (Gate 7 v tasks.md)

- **Golden reálný objekt (AC 17)** — TZ + situace + vzorový příčný řez +
  soupis (Příloha B tasku).
- **Zdroje Přílohy A** — S3 díly, S3/2, S3/5, S8/3 technologické listy
  (nahradí orientační výkony + doplní honest-blank), ÚRS 824-1 příloha, ÚOŽI,
  třídník ŽS (katalogové kódy → candidate/exact).
- **Deploy** — secret `SERVICE_API_KEY` ověřit → `gcloud builds triggers
  import --source=triggers/zeleznice.yaml --region=europe-west3` → Cloud Run →
  Vercel frontend → `zeleznice.stavagent.cz` → živý MCP test.
- **Interview veto** — 6 autonomních odpovědí v design.md §0 (každá levně
  revertovatelná).

## Pozor (pro příští session)

- MCP delegát do deploye vrací typed `engine_unavailable` — očekávané chování,
  ne bug (precedens calculate_from_passport pre-deploy).
- KB hodnoty s `confidence 0.7–0.8` jsou vědomě ORIENTAČNÍ (TASK §3.3/§3.7
  tabulky) — nahradit po nahrání zdrojů; NIKDY nedoplňovat z paměti/AI.
- Monolit CI běží i na claude/** při dotyku `kb/**` / `gen-knowledge.mjs` —
  drift-check musí zůstat zelený (ověřeno lokálně).

## Otevřené otázky pro uživatele

Viz soul.md §9 (2026-07-23) — golden objekt, zdroje, veto interview, deploy go.
