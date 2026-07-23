# CLAUDE.md — Zeleznice-Planner (Kiosk: Železniční svršek + spodek)

**Version:** 1.0.0 (2026-07-23)
**Spec:** [`docs/specs/zeleznicni-svrsek-spodek/`](../docs/specs/zeleznicni-svrsek-spodek/) — requirements (TASK) + design + tasks
**Live-state pointer:** kanonický status → root [`../CLAUDE.md`](../CLAUDE.md) (Services §6 + changelog)

---

## Co to je

Kiosk pro **železniční stavby** (SŽ zakázky + vlečky). Dekompozice se
neodvozuje z objemu betonu (Monolit), ale z **délky koleje × sestavy svršku**.
Deterministic-first: geometrický převod = confidence 1.0, KB hodnota s citací
0.80–0.85, uživatelská norma firmy 0.99, **AI odhad výkonů zakázán**
(honest-blank NEPOČÍTÁNO).

```
Zeleznice-Planner/
├── shared/     ← kanonický TS engine (planRailSection) + kb-generated/ + 70 vitest
├── backend/    ← Express thin wrapper (SSOT parity s Monolit engine.js) + 7 Jest
├── frontend/   ← React+Vite kalkulačka (in-browser engine, flat stone style)
└── Dockerfile  ← Cloud Run image (port 3004)
```

## SSOT řetěz (nikdy neporušit)

```
kb/zeleznicni_{svrsek,vyhybky,mechanizace}.yaml   ← JEDINÝ zdroj dat (se zdrojem per záznam)
        │ scripts/gen-knowledge.mjs (outAbs; drift-guard gen:knowledge:check)
        ▼
shared/src/kb-generated/*.ts                       ← NEEDITOVAT ručně
        ▼
shared/src/calculators/rail-orchestrator.ts        ← planRailSection (jediný výpočet)
        ├── frontend (in-browser import)
        ├── backend POST /api/rail/calculate (thin wrapper, žádná logika)
        └── MCP calculate_railway_works → zeleznice_delegate (HTTP, typed errors)
```

- Změna normativní hodnoty = edit YAML + `npm run gen:knowledge` (root) + commit artefaktů.
- Python NIKDY nepočítá železnici — jen deleguje (mirror `monolit_delegate` fail-mode).

## Engine — domain invarianty (testy je pinují)

- **Vrstvy spodek/svršek se nemíchají** — každá položka/fáze nese `layer`;
  rozhraní = tloušťka lože od ložné plochy pražce po pláň.
- **Rozdělení pražců** (b/c/d/e/u × délka pole) = golden tabulka ÚRS 824-1
  přílohy; dvojčitý dřevěný pražec u styku = 2 ks; pražec Y = vzorec z rozteče
  (ne tabulka).
- **Lože jen z příčného profilu** (area / parametric / KB preset s povinným
  potvrzením); bez profilu NEPOČÍTÁNO — paušál zakázán. Vícekolejný parametrický
  profil = ×koleje + warning (mezikolejní prostor nemodelován).
- **BK ≠ „svar × počet"**: příprava → ověření polohy (PŘED upnutím!) →
  svařování → upnutí (17–23 °C) → závěrné svary → kontrolní měření.
- **Výhybky kusově** (h/ks dle tvaru); montáž bez normy v KB = honest-blank,
  doplní `user_machine_norms` (stroj `jerab_montaz_vyhybek`).
- **Výkon stroje závisí na režimu** (propracování/2 záběry/po pokládce/APK/Y);
  priorita: firemní norma 0.99 > KB 0.80; chybějící = NEPOČÍTÁNO.
- **Pattern 50**: četa = min(base, fronta/workspace) — frontu určuje výluka,
  ne objem; bezpečnostní role povinně v osádce; osádka stroje vázaná na stroj.
- **Catalog-Last**: bindCatalog až po dekompozici; routing sz_verejna→OTSKP_ZS
  (+ÚOŽI note) / vlecka→URS_824_1; kódy se NEFABRIKUJÍ (not_verified).
- **Replay guarantee**: stejné vstupy → stejný výstup; každé číslo nese
  formula + source + confidence.
- **km trati ≠ km koleje** — vše svrškové na kolej.

## Fail-mode kontrakt (backend + MCP)

| Stav | Backend | MCP tool |
|---|---|---|
| OK | 200 RailPlanResult verbatim | výsledek + `source: zeleznice_planner_api` |
| Neznámé id / špatný tvar | 400, human text v `error` (Monolit parity) | `engine_invalid_input` |
| Chybí délka úseku | 422 `{uncalculated, reason_cs, missing_fields}` | `engine_invalid_input` (reason_cs v message) |
| Engine down / cold start | — | `engine_unavailable` (2 retry) |
| Bez service key (prod) | 401 / 503 not-configured | — |

Auth: compute fail-closed za `X-Service-Key` = sdílený `SERVICE_API_KEY`
(HOTFIX-2 vzor); frontend backend nevolá (počítá in-browser); `/api/rail/catalog`
je veřejný read-only KB snapshot.

## Development

```bash
cd Zeleznice-Planner/shared && npm i && npm test        # 70 vitest + tsc build
cd ../backend && npm i && npm test                      # 7 Jest (supertest, hermetic)
cd ../frontend && npm i && npm run dev                  # Vite :5175 (build = tsc && vite build)
node ../../scripts/gen-knowledge.mjs --check            # drift-guard KB artefaktů
```

MCP testy: `concrete-agent/packages/core-backend`: `pytest tests/test_mcp_railway_works.py tests/test_mcp_compatibility.py`.

## Deploy (připraveno, ZATÍM NENASAZENO)

- `cloudbuild-zeleznice.yaml` + `triggers/zeleznice.yaml` (import ručně:
  `gcloud builds triggers import --source=triggers/zeleznice.yaml --region=europe-west3`).
- Cloud Run služba `zeleznice-planner-api` (port 3004, europe-west3); secret
  `SERVICE_API_KEY` musí existovat v Secret Manageru PŘED prvním deployem.
- Frontend → Vercel (`zeleznice-planner-frontend`), custom doména
  `zeleznice.stavagent.cz` (noindex jako kalkulator).
- MCP delegát čte `ZELEZNICE_API_URL` (default = budoucí Cloud Run URL);
  do deploye vrací typed `engine_unavailable` — poctivé, žádná fabrikace.

## Co je vědomě V1 (deferred → spec tasks.md)

TZ/PDF extraction pipeline (vstup zatím ruční geometrie) · plnohodnotná
výluková okna (v1: okno h/den) · katalogové kódy 824-1/ÚOŽI/OTSKP ŽS (čekají
na nahrání ceníků do KB) · RCPSP scheduler napojení · golden reálný objekt
(dodá Alexander — Příloha B tasku) · S3/S8-3 technologické listy (nahradí
orientační hodnoty a honest-blank výkony) · pevná jízdní dráha = detekce only.
