# Design — Modul „Železniční svršek + spodek" (Zeleznice-Planner kiosk)

**Datum:** 2026-07-23 · **Stav:** v1 implementováno (viz `tasks.md`)
**Requirements:** [`requirements.md`](./requirements.md) (TASK v1, DRAFT — ratifikace níže)

---

## 0. Ratifikace + PRE-IMPLEMENTATION INTERVIEW (autonomní rozhodnutí)

Alexander zadal implementaci přímým pokynem *(„хочу сделать отдельный киоск для
ЖД … сделай за раз если сможешь")* — tím (a) ratifikoval DRAFT tasku,
(b) přebil §0.2 tasku („nezakládej paralelní strukturu") ve prospěch
**samostatného kiosku**, (c) autorizoval zodpovězení interview bez blokace.
Odpovědi zvolené implementací — **každou lze levně revertovat, veto vítáno**:

| # | Otázka | Rozhodnutí v1 | Proč |
|---|---|---|---|
| 1 | Rozsah | **Celá vertikála v tenkém řezu**: svršek plně deterministicky; spodek jako strukturované vstupní výměry + fáze v posloupnosti; výhybky, BK, mechanizace ano | User chtěl „celou technologii"; spodek nemá bez příčných řezů deterministický základ — pass-through je poctivý |
| 2 | Vstup | **Ruční geometrie** (km od–do / délka + sestava); TZ-extraction = follow-up (vstup je JSON-friendly, seam připraven) | Determinismus first; extraction pipeline existuje v Core a napojí se později |
| 3 | Katalog | **Routing dle typu zakázky**: SŽ/veřejná → OTSKP ŽS + ÚOŽI primární; vlečka → ÚRS 824-1. Každá položka nese `pricing_system`; kódy `not_verified` (nefabrikují se) | TASK §5 doslova; ceníky nejsou v KB → kódy až po nahrání |
| 4 | Mechanizace | **Obojí s prioritou vlastních norem**: user norm 0.99 > tech list/katalog 0.80; AI zakázán (honest-blank) | TASK §3.7 žebříček doslova |
| 5 | Výluky | **V1 čistý výkon** + `possession_window_h` (okno/den) + `shift_hours`; plná výluková logika (noční okna, přejezdy strojů) = follow-up | Okno/den pokrývá 80 % užitku za 5 % složitosti |
| 6 | Jednotka | **Metr koleje** jako base (km display v UI; pole odvozená u stykované) | Nejmenší bezztrátová jednotka; km trati ≠ km koleje explicitně v modelu |

## 1. Audit-first (co už v repu existovalo → co se přepoužilo)

| Mechanismus | Přepoužití |
|---|---|
| `kb/*.yaml` → `gen-knowledge.mjs` codegen + drift-guard | **Rozšířen** o per-integration `outAbs` + index per output-dir (Monolit artefakty byte-identické — ověřeno `--check`); 3 nové integrace `zeleznice-*` |
| Data-with-provenance (`labor-norms.ts` vzor) | Každý KB záznam nese `source` + `confidence`; null = honest-blank |
| `UncalculatedError` duck-marker + 422 kontrakt (v4.38) | `RailUncalculatedError` (uncalculated=true, reason_cs, missing_fields) + `RailInputError` (invalid_input=true → 400) |
| Monolit `engine.js` thin-wrapper SSOT | `backend/src/app.js` — žádná logika, verbatim engine; 400 human-text-in-error parity |
| `requireAuthOrServiceKey` (HOTFIX-2 fail-closed) | `requireServiceKey` — sdílený `SERVICE_API_KEY`, prod bez klíče = 503 |
| `monolit_delegate` fail-mode státní stroj | `zeleznice_delegate` (sibling; sdílí typed exceptions + `_err_text` importem) |
| MCP counter-files disciplína (6 souborů) | server.py · routes.py (×2 + REST) · auth.py · tool_manifest.py · workflow YAML · EXPECTED_TOOLS |
| ⛔/⚠️/ℹ️ warnings + `warnings_structured` mirror (v4.22/v4.38) | identická konvence v RailPlanResult |
| `CodeStatus` čtveřice (v4.39.1) | `code_status: not_verified` na všech položkách |
| Pattern 50 front-capacity | `crew-plan.ts` — četa = min(base, fronta/workspace) |
| Flat stone style + noindex vercel.json (kalkulator) | frontend styl + vercel.json |

**Vědomě NEpřepoužito:** Monolit 7-engine pipeline (jiná osa dekompozice —
délka×sestava, ne objem betonu; TASK §2) — kiosk je paralelní doménový modul,
ne rozšíření betonového kalkulátoru (rozhodnutí Alexandra).

## 2. Architektura

```
kb/zeleznicni_svrsek.yaml      (kolejnice, pražce, upevnění, ROZDĚLENÍ, sestavy, lože presety, BK, technologie)
kb/zeleznicni_vyhybky.yaml     (tvary, h/ks podbití, montáž=null honest-blank, svary vevaření)
kb/zeleznicni_mechanizace.yaml (stroje × režimy × výkony, osádky, omezení, ztrátové časy=null, četa+bezpečnostní role)
        │ gen-knowledge.mjs (outAbs → Zeleznice shared)
        ▼
Zeleznice-Planner/shared/src/
  kb-generated/*.ts            (artefakty, drift-guard)
  types.ts                     (RailPlannerInput/RailPlanResult, RailQuantity {value,formula,source,confidence,status,reason_cs})
  calculators/
    resolve.ts                 (sestava = primární volba; typed chyby s výčtem povolených)
    track-quantities.ts        (pražce/kolejnice/upevnění/styky/svary — golden §3.3)
    ballast.ts                 (lože VŽDY z profilu; area|parametric|preset; nikdy paušál)
    turnout-works.ts           (kusově h/ks; metriky se nemíchají)
    sequence.ts                (DAG §3.9 vč. BK řetězce, překážek, podbití dle druhu stavby)
    machine-plan.ts            (režim → výkon; user norm 0.99; omezení Y/poloměr; okno/směna)
    crew-plan.ts               (Pattern 50 + bezpečnostní role + osádky strojů)
    catalog-binding.ts         (Catalog-LAST routing; kódy not_verified)
    rail-orchestrator.ts       (planRailSection — jediný emit-point)
        │
        ├── frontend (in-browser, useMemo live přepočet, LS persist)
        ├── backend POST /api/rail/calculate + GET /api/rail/catalog (service-key)
        └── MCP calculate_railway_works (tools 22→23, credits 10, WORK_ATOMIZATION)
```

## 3. Klíčové deterministické převody (formule v kódu, hodnoty v KB)

- pražce (table-mode): `ceil(km_koleje_na_kolej × ks/km) × koleje`; dvojčitý
  (dřevo+stykovaná): `+ (polí−1) × koleje`; Y-mode: `ceil(L / rozteč) × koleje`
- kolejnice: `L × 2 pásy × koleje`; hmotnost `× kg/m` (T = null → blank)
- upevnění: `pražce × uzly/pražec` (2; Y=3)
- stykovaná: pole `ceil(L/délka_pole)`; styky `(polí−1) × 2 × koleje`
- BK: svary `(ceil(L/dodávka)−1) × 2 × koleje`; závěrné `4 × koleje`; výhybka `+6/ks`
- lože: `A = koruna×t + sklon×t²`; `V = A × L (× koleje u parametrického)`
- stroj: `h = výměra/výkon | výměra×h/ks`; `dny = h / (okno ?? směna)`
- četa: `min(base, floor(fronta/workspace))`, min 2

## 4. Acceptance criteria → pokrytí (17 bodů tasku)

1–15 ✅ implementováno + pinnuto testy (70 vitest + 7 Jest + 7 pytest; mapování
v `tasks.md`). 16 ✅ všechny testy hermetické (bez sítě/DB/AI).
17 ⏳ **golden reálný objekt — čeká na podklady Alexandra** (Příloha B: TZ +
situace + vzorový řez + soupis) — jediné otevřené kritérium.

## 5. Bezpečnostní & provozní poznámky

- Kiosk nemá DB ani per-user data → cross-user izolace N/A (compute stateless);
  přesto compute fail-closed za service-key (žádný veřejný výpočetní povrch).
- MCP delegát do deploye vrací typed `engine_unavailable` — stejný precedens
  jako calculate_from_passport před nasazením Monolit endpointu.
- Frontend noindex (pracovní aplikace, viz kalkulator konvence).

## 6. Rizika / dluhy (tracked v tasks.md + root TODO)

Orientační hodnoty KB (0.80/0.70) čekají na S3/S8-3 + ÚRS 824-1 přílohu —
golden test tabulky rozdělení pak přejde z „reprodukce TASK §3.3" na „reprodukce
ceníkové přílohy". Honest-blank výkony (pokládka, čištění, stabilizace, svary,
montáž výhybek) = záměr, ne bug. Spodek deterministika (příčné řezy) = fáze 2.
