# Tasks — Modul „Železniční svršek + spodek"

**Stav k 2026-07-23:** Gates 0–6 HOTOVO (jedna session, branch
`claude/railway-kiosk-separate-jtp8mq`). Gate 7 = deploy + golden (čeká na
Alexandra). Testy: **70 vitest (shared) + 7 Jest (backend) + 7 pytest (MCP)
+ compat 29/29**; tsc + vite build čisté; `gen:knowledge:check` zelený
(Monolit artefakty byte-identické).

---

## Gate 0 — Audit + ratifikace ✅
Interview zodpovězeno autonomně na přímý pokyn (design.md §0 — veto vítáno);
audit přepoužitelných mechanismů v design.md §1.

## Gate 1 — KB single-source ✅
`kb/zeleznicni_{svrsek,vyhybky,mechanizace}.yaml` (každý záznam source +
confidence; null = honest-blank) + `gen-knowledge.mjs` rozšířen o `outAbs`
a per-dir index (validátor pinuje invariant ks/pole × (1000/L) = ks/km).

## Gate 2 — Shared engine ✅ (70 vitest)
| AC tasku | Pin |
|---|---|
| 1 vrstvy se nemíchají | rail-orchestrator.test — layer disjoint + fáze spodku |
| 2 data se zdrojem, ne v kódu | KB YAML + kb-generated; grep-free konstanty |
| 3 deterministické výměry s formulí | track-quantities.test (replay blok) |
| 4 golden tabulka rozdělení + dvojčitý + Y | track-quantities.test (10 řádků §3.3 1:1) |
| 5 lože z profilu / honest-blank | ballast.test (blank, parametric 1.343125 m², preset ⚠️) |
| 6 BK řetězec, ne „svar×počet" | sequence.test (pořadí, ověření PŘED upnutím, 17–23 °C) |
| 7 výhybky kusově h/ks | turnout-works.test (mid rozsahu, montáž blank→user norm) |
| 8 registr strojů (režimy/osádky/omezení/ztrátové časy) | KB YAML + machine-plan.test |
| 9 volba stroje respektuje omezení | machine-plan.test (Y→dvoucestná; ⛔ při přebití; poloměr ⚠️) |
| 10 user norma > katalog, zdroj viditelný | machine-plan.test (0.99 + „uživatelská norma" v rate_source) |
| 11 osádky: stroj/fronta/bezpečnostní role | rail-orchestrator.test (Pattern 50 fronta 200 m → 4 os.) |
| 12 posloupnost se závislostmi | sequence.test (DAG konzistence + pořadí §3.9) |
| 13 překážky automaticky | sequence.test (demontáž před linkou, montáž po GPK, ℹ️ při 0) |
| 14 katalog až po dekompozici | rail-orchestrator.test (bindCatalog čistá fn; per-item soustava) |
| 15 km trati ≠ km koleje | rail-orchestrator.test (2 koleje → ×2) |
| 16 testy bez sítě/DB/AI | celá suita hermetická |

## Gate 3 — Backend ✅ (7 Jest)
Thin wrapper `/api/rail/calculate` (400 human-text parity s Monolit, 422
uncalculated) + `/api/rail/catalog` (veřejný KB snapshot) + `/health`;
`requireServiceKey` fail-closed; Dockerfile (port 3004).

## Gate 4 — Frontend ✅ (tsc + vite build)
In-browser engine, live přepočet, LS persist; sekce úsek/sestava/lože/výhybky/
překážky/spodek/mechanizace+normy/výluky; výsledky: KPI, výkaz per vrstva
s formulí+zdrojem+soustavou, BK, sekvence se závislostmi, stroje, osádky,
⛔/⚠️/ℹ️; disclaimer; noindex.

## Gate 5 — MCP ✅ (tools 22→23; 7 pytest + compat 29/29)
`calculate_railway_works` (credits 10, catalog_only mode) + `zeleznice_delegate`
(mirror monolit fail-mode; sdílený SERVICE_API_KEY; env `ZELEZNICE_API_URL`);
všech 6 counter-souborů synchronně.

## Gate 6 — Docs + infra ✅
Per-service CLAUDE.md + README; root CLAUDE.md (v4.43.0); soul §9; handoff;
structure.md; `cloudbuild-zeleznice.yaml` + `triggers/zeleznice.yaml` +
`.github/workflows/zeleznice-ci.yml`.

---

## Gate 7 — NEXT (blokováno na Alexandrovi; první dodávka podkladů 2026-07-23)

- [~] **Golden reálný objekt (AC 17)** — ✅ PŘIJATO 2026-07-23:
      `test-data/pzs-p137-sokolov-kraslice/` (PZS P137 km 13,250 Sokolov–Kraslice,
      SŽ/VIAMONT 06/2025) — TZ (SO 02-10-01 svršek + SO 02-11-01 spodek) +
      vzorové příčné řezy 1:50 + **reálný soupis FORMULÁŘ SO/PS** (klasifikace
      824, R-položky, vzorce množství) + geotechnika/ZKPP. ⏳ ZBÝVÁ: situace +
      podélný profil („это еще не все") → pak golden test celého řetězce +
      kalibrace (soupis číst jako etalon, řez VISION per Pattern 39).
- [~] **Nahrát zdroje Přílohy A** — ✅ PŘIJATO: **Sborník ÚOŽI 2026**
      (`concrete-agent/.../knowledge_base/B1_uozi_codes/sbornik_2026/` —
      TH matice `Číslo položky|Popis|MJ|Cena`, metodika, změny) → zdroj pro
      catalog-binding upgrade not_verified→candidate/exact. ⏳ ZBÝVÁ: S3 díly,
      S3/1, S3/2, S3/5, S4, S8/3 přílohy (technologické listy strojů!), TKP
      kap. 8, **ÚRS 824-1 příloha „Rozdělení pražců"** (web cs-urs.cz vrací
      403 anti-bot — stáhnout ručně a nahrát), třídník ŽS → nahradit orientační
      hodnoty + doplnit honest-blank výkony/montáže/ztrátové časy.
- [ ] **Deploy**: secret SERVICE_API_KEY ověřit → `gcloud builds triggers import
      --source=triggers/zeleznice.yaml --region=europe-west3` → Cloud Run
      `zeleznice-planner-api` → Vercel frontend + `zeleznice.stavagent.cz` →
      živý MCP test calculate_railway_works.
- [ ] **Katalogová data**: 824-1/ÚOŽI/OTSKP ŽS položky do KB → binding
      candidate/exact místo not_verified.

## Deferred (fáze 2+, vědomě mimo v1)
TZ/PDF extraction → RailPlannerInput · spodek deterministika z příčných řezů ·
plná výluková okna (noční, přejezdy strojů, souběhy) · RCPSP scheduler
napojení · Portal integrace (projekty/credits) · sk/de slovníky.
