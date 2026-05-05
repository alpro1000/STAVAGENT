# Most ev.č. 2062-1 — Žihle (sandbox)

**Status:** `extraction_done` — Phase A (extrakce) dokončena 2026-05-05. Phase B (návrh) + Phase C (výpočet) deferred do dalších sessionů.
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
├── inputs/              ← raw bidder docs — viz inputs/README.md
│   ├── pdf/             ← ZD + Vysvětlení ZD č.1
│   ├── docx/            ← Přílohy 2 + 3 (SOD, Nabídková cena)
│   └── photos/          ← snímek mostního listu + 6 fotek z osmotky
├── 01_extraction/       ← strukturovaná data (JSON/YAML) ze zdrojových PDF
├── 02_design/           ← varianty NK (skici, popisy, rozhodnutí)
├── 03_calculation/      ← Excel/CSV výstupy kalkulátoru, harmonogram, soupis prací
└── 04_documentation/    ← generované TZ pro DUR/DSP, výkaz výměr
```

## Postup

| Fáze | Status | Cesta |
|------|--------|-------|
| 0. Initialized | ✅ done | `metadata.yaml` |
| 1. Inputs received | ✅ done | `inputs/` (viz `inputs/README.md`) |
| 2. Extraction (HPM + ZD + photos → YAML) | ✅ done 2026-05-05 | `01_extraction/` (4 YAML + SOURCES.md) |
| 3. Design (varianty NK) | ⏳ pending | `02_design/` |
| 4. Calculation (kalkulátor + Gantt) | ⏳ pending | `03_calculation/` |
| 5. Documentation (TZ + VV) | ⏳ pending | `04_documentation/` |

## Phase A — extrakce (2026-05-05)

Strukturovaná data ze 4 PDF + 1 PNG + 6 fotografií → 4 YAML + index:

| Soubor | Obsah | # facts | Avg. confidence |
|--------|-------|---------|-----------------|
| [`01_extraction/stavajici_most.yaml`](01_extraction/stavajici_most.yaml) | Identifikace + NK + SS + svršek + stav + zatížitelnost stávající | ~70 | 0.93 |
| [`01_extraction/pozadavky_novy_most.yaml`](01_extraction/pozadavky_novy_most.yaml) | ZD §4.1–4.4 + provizorium + cena/doba + kvalifikace | ~65 | 1.00 |
| [`01_extraction/site_conditions.yaml`](01_extraction/site_conditions.yaml) | Foto-inventura + site conclusions + Vysvětlení ZD č.1 Q&A | ~30 | 0.65 |
| [`01_extraction/aplikovatelne_normy.yaml`](01_extraction/aplikovatelne_normy.yaml) | TKP kapitoly + ČSN normy + KB cross-reference | ~30 | 0.90 |
| [`01_extraction/SOURCES.md`](01_extraction/SOURCES.md) | Index všech zdrojů + missing-data flags + executive summary | — | — |

**Klíčová zjištění:**
- Stávající: 16 ŽB trámů 20×50 cm s I-280, šikmost 50°, rozpětí ~9 m, NK stav VI havarijní
- ZD: D&B max 30 mil. Kč / 30 měsíců; bez ložisek/dilatací → **integrální rám** = jediná varianta
- Provizorium **povinné** (Vysvětlení ZD č.1) — alternativa objízdné zamítnuta
- Skruž zdola **nemožná** (světlá výška ~1 m pod mostem)
- KB chybí: ČSN 73 6222, ČSN 73 6244, ČSN EN 1992-2, ČSN EN 1317 → Phase B bude citovat externí zdroje

**Pre-Phase-B checklist + missing data flags:** viz [`01_extraction/SOURCES.md`](01_extraction/SOURCES.md).

## Zdrojové dokumenty

Aktuální stav viz [`inputs/README.md`](inputs/README.md) a
`metadata.yaml → zdrojove_dokumenty`.

Nahráno:
- ZD (PDF, 26 s.) + Vysvětlení ZD č. 1 (PDF) → `inputs/pdf/`
- Přílohy 2 (SOD) + 3 (Nabídková cena) → `inputs/docx/`
- Snímek mostního listu (PNG) + 6 terénních fotek → `inputs/photos/`

Chybí:
- Plný 6-stránkový HPM PDF z 2025-09-24 (částečně zastoupen kolekcí v `photos/`)

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
