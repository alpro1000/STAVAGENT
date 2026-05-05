# Most ev.č. 2062-1 — Žihle (sandbox)

**Status:** `raw` — struktura založena, žádná data ještě neextrahována.
**Účel:** experimentální průchod celým workflow STAVAGENT (HPM → analýza
stávajícího mostu → požadavky ZD → návrh nové NK → výpočet kalkulátorem
→ generace soupisu prací) na malém reálném tendru.
**NENÍ pro odevzdání tendru.** Po dokončení workflow se zhuštěná verze
může konvertovat do golden testu pod `test-data/tz/`.

## Konvence struktury

Pattern přebírá z `test-data/libuse/` (raw inputs + outputs), rozšířen
o číslované phase-prefixy podle 4 fází workflow:

```
test-data/most-2062-1-zihle/
├── README.md            ← tento soubor
├── metadata.yaml        ← strukturovaná karta projektu (identifikace, ZD limity, stávající most)
├── inputs/              ← raw bidder docs (HPM, ZD); user dodává drag&drop
│   └── pdf/
├── 01_extraction/       ← strukturovaná data (JSON/YAML) ze zdrojových PDF
├── 02_design/           ← varianty NK (skici, popisy, rozhodnutí)
├── 03_calculation/      ← Excel/CSV výstupy kalkulátoru, harmonogram, soupis prací
└── 04_documentation/    ← generované TZ pro DUR/DSP, výkaz výměr
```

## Postup

| Fáze | Status | Cesta |
|------|--------|-------|
| 0. Initialized | ✅ done | `metadata.yaml` |
| 1. Extraction (HPM + ZD → JSON) | ⏳ pending | `01_extraction/` |
| 2. Design (varianty NK) | ⏳ pending | `02_design/` |
| 3. Calculation (kalkulátor + Gantt) | ⏳ pending | `03_calculation/` |
| 4. Documentation (TZ + VV) | ⏳ pending | `04_documentation/` |

## Zdrojové dokumenty (k doplnění)

User nahraje přes drag&drop do `inputs/pdf/`:

- `HPM_2025-09-24.pdf` — Hlavní prohlídka mostu, 6 stran
- `ZD_2026-04-01.pdf` — Zadávací dokumentace, č.j. 3967/26/SÚSPK-P, 26 stran

Stav přítomnosti je vedený v `metadata.yaml → zdrojove_dokumenty.*.pritomno`.

## Klíčové parametry (souhrn z `metadata.yaml`)

- **Hodnota:** ~30 mil. Kč bez DPH, Design & Build (§92 odst. 2 ZZVZ)
- **Lhůta nabídek:** 2026-07-02 10:00, jistota 600 000 Kč
- **Stávající most:** 1 pole, 16 ŽB trámů + ŽB deska, kamenné opěry, NK ve stavu VI
- **Nový most:** S 7,5; Vn=32 t / Vr=80 t / Ve=180 t; bez dilatačních závěrů, bez ložisek
- **Limity:** sedání ≤ 12 mm, dlouhodobá deformace NK ≤ 3 mm

## Vztah k golden testům

Po dokončení všech 4 fází lze projekt zkrátit do golden testu pod
`test-data/tz/MOST-2062-1_ZIHLE_golden_test.md` (pattern viz
`test-data/tz/SO-202_D6_most_golden_test.md`). Cílová cesta zatím
neexistuje — pole `golden_test_candidate.target_path` v metadatech
zůstává `null`.
