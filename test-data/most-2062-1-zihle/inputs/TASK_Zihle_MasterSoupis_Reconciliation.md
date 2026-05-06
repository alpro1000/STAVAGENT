# TASK: Žihle 2062-1 — Master Soupis Assembly + Reconciliation + Phase E + Vendor Pricing

**Priorita:** P0 (real D&B nabídka deadline 2026-07-02 10:00)
**Scope:** Full retrofit of Phase D + new Demolice/ZS + Phase E visual + vendor integration
**Trvání odhad:** 7-9 hodin Claude Code (recommend split into 2 sessions)
**Návaznost:** Žihle Phase A-D done (commits cd0f2a19, b31bdf57, ea43ee16, fa34fec3, 44ff2634)
**Cíl:** připravit production-ready master soupis prací s ~120 položkami v 6 SO objektech,
        TSKP hierarchical structure, full audit trail formul, integrovaný s vendor cenами,
        + Phase E vizuální balíček (situace s katastr DXF).

---

## Мантра

> Сначала ты читаешь весь репо.
> 
> Tento task má **3 zdroje pravdy** — žádný neporáží, presentujem ranges a flags:
>   1. **User manual** (SO_180_JŠ.xls 30 položek + SO_201_JŠ.xls 91 položek) — expert intuition
>   2. **Calculator output** (Phase C 11 elementů) — deterministic engineering
>   3. **KB normy** (Pokorný, EN 1992-2, TKP 4, ČSN 73 6244) — authoritative ranges
>
> Pro mnozstvi v master soupis používáme **calculator deterministic** (single value, repeatable).
> Konflikty mezi user manual a calculator → flag v `reconciliation_report.md` jako delta s reasonable explanation.
> 
> **Audit trail per položku je MANDATORY.** Každý mnozstvi musí mít:
>   - `formula`: matematický výraz (např. "L × B × t")
>   - `vstupy`: dictionary s hodnotou, jednotkou, popisem, zdrojem každého parametru
>   - `vypocet_kroky`: step-by-step výpočet (např. "9.0 × 8.30 = 74.7 m²; 74.7 × 0.45 = 33.6 m³")
>   - `confidence`: 0.0-1.0 + popis proč
> 
> **TSKP hierarchical structure** (třídy 0-9) je MANDATORY pro každý SO.
> **No work duplication** — každá OTSKP položka v jednom SO maximálně, validovat.

---

## CONTEXT

User confirmed scope = **Mixed real tender + sandbox parallel**.
Žihle deadline **02.07.2026 10:00** přes E-ZAK, max budget **30 mil. Kč bez DPH**.

### Předchozí výstupy (existing v repo)

- **Phase A** `01_extraction/` — 4 YAML + SOURCES.md, ~195 facts s confidence
- **Phase B** `02_design/` — 6 deliverables (varianta_01_integralni_ram, decomposition_so, concrete_classes, formwork_choice, provizorium_specs, element_breakdown)
- **Phase C** `03_calculation/` — 11 elementů PlannerOutput JSONs, cost summary XLSX, Gantt SVG
- **Phase D** `04_documentation/` — otskp_mapping (52 položek), soupis_praci XML, TZ_DUR (500 řádků)
- **KB enrichment** commits b31bdf57 (UPa+EN1992-2+lifecycle) + 44ff2634 (TKP 4+ČSN 73 6244+VL 4+Litovel)

### Nové vstupní zdroje (per user, 2026-05-06)

#### A. User manual ground truth (CRITICAL — expert benchmark)

Lokace: `/mnt/user-data/uploads/` (user nahraje při startu sessionu, nebo v repo per audit)
- **`SO_180_-_Objízdná_trasa_-_JŠ.xls`** — user manual, 30 položek, TSKP třídy 0/1/2/4/5
- **`SO_201_-_Most_ev_č__20-005_-_JŠ.xls`** — user manual, 91 položek (76 s mnozstvi > 0), TSKP třídy 0-9

> **Pozor naming:** "20-005" je staré evidence number, ne aktuální 2062-1.
> Pravdepodobně user kopíroval Kfely template a adaptoval. Mnozstvi platná pro Žihle.

#### B. Vendor pricing data (`inputs/docx/`)

- **`Cenhled - most Žihle - Mostní provizorium.xls`** — user-prepared comparison spreadsheet
- **`CN Provizorium Žihle ze dne 5.5.2026.pdf`** — recent quote (datum 2026-05-05)
- **`Cenová nabídka TMS 9 m.pdf`** — vendor TMS, 9 m provizorium
- **`Cenová nabídka mostního provizoria MS.pdf`** — vendor MS
- **`Příloha č.1 - Cenová nabídka MP šířky 4m - varianta č.1.pdf`** — varianta šířka 4 m
- **`Příloha č.2 - Cenová nabídka MP šířky 3,5m - varianta č.2.pdf`** — varianta šířka 3,5 m
- **`Re Poptávka zajištění mostního provizoria most ev.č. 2062-1 u obce Žihle.msg`** — email thread
- **`Re Poptávka zajištění mostního provizoria + DIO most ev.č. 2062-1 u obce Žihle.msg`** — email thread
- **`Ukládka zeminy - nabídka BERGER 30.04.2026.pdf`** — vendor pro odvoz zeminy
- **`Ceník RS Žatec 2026.pdf`** — recyklační středisko, asfaltové odpady
- **`INFORMACE pro zákazníky RS 2026 I.pdf`** — RS Žatec policy
- **`INFORMACE pro zákazníky příjem asfaltových odpadů a zeminy RS 2026 I.pdf`** — RS Žatec přijem rules
- **`nabídka.xlsm`** — user's draft nabídka (**INTERNAL — sensitive, ne v KB ingest**)
- `Příloha č. 2 - SOD - Design and Build Most u obce Žihle.docx` (existing v repo)
- `Příloha č. 3 - Prohlášení o výši Nabídkové ceny a Době provádění Díla.docx` (existing)

#### C. Project documentation (`inputs/pdf/`)

- **`Most ev.č. 2062-1 u obce Žihle, přestavba - situace.pdf`** — professional vendor situace
- **`Most ev.č. 2062-1 - okruh pozemků-noname.pdf`** — kadastrální parcely (anonymized)
- **`Most ev.č. 2062-1 - předbežné souhlasy FO, obec, RFK-noname.pdf`** — souhlasy vlastníků (FO, obec, RFK)
- (existing: `2062-1 HMP.pdf` HPM 24.9.2025, `ZD - Most ev.č. 2062-1 u obce Žihle - DaB.pdf`, `Vysvětlení ZD č. 1 - Most u obce Žihle.pdf`)

#### D. Drawings & screenshots (`inputs/photos/`)

- **`PROJEKT_MOST_HLAVNI.dwg`** — kadastr DWG (user attempt nakreslit most, nedokončen)
- **`PROJEKT_MOST_HLAVNI.dxf`** — DXF konverze (user-provided, machine-readable!)
- **4× `Snímek obrazovky 2026-04-29/30/05-06.png`** — Mapy.cz / katastr screenshots
- (existing: 6 site photos + `Příloha č. 1 - snímek mostního listu.png`)

---

## ČÁST 1: AUDIT NEW DATA SOURCES

### 1.1 Read user manual XLS files

Open both XLS files (xlrd lib). Extract per-row:
- TSKP třída (D row L=1) → header
- Položky (K row L>2) → kód, popis, MJ, množství

Save as parsed YAML:
- `04_documentation/manual_reference_JS/SO_180_parsed.yaml`
- `04_documentation/manual_reference_JS/SO_201_parsed.yaml`

Format per třída:
```yaml
SO: 201
nazev: Most ev.č. 2062-1
total_polozek_with_quantity: 76
tskp_classes:
  "0":
    nazev: Všeobecné konstrukce a práce
    polozky:
      - kod: "014102"
        popis: POPLATKY ZA SKLÁDKU
        mj: T
        mnozstvi: 74.0
      ...
  "1":
    nazev: Zemní práce
    polozky: ...
```

### 1.2 Read DXF kadastr

Use `ezdxf` lib. Extract:
- Layers list
- Entities count per layer
- Bounding box (S-JTSK or WGS84?)
- Text labels (parcel numbers like "1714", "1755", "1756", "1757", "1758", "1843")
- Line/polyline geometries — kadastrální hranice

Save as `04_documentation/kadastr_audit/kadastr_extracted.yaml`:
```yaml
file: PROJEKT_MOST_HLAVNI.dxf
coordinate_system: S-JTSK / WGS84 / unknown
bbox: {x_min, x_max, y_min, y_max}
layers:
  - name: HRANICE_PARCEL
    entity_count: N
    entities: [list of polylines]
text_labels:
  - text: "1714"
    position: {x, y}
parcel_polygons:
  - parcel_number: "1714"
    points: [(x, y), ...]
notes: "User attempted to draw most HLAVNI but did not complete"
```

### 1.3 Read vendor situace.pdf

Audit only — page count, scale, drawing extent. Compare bounding box vs DXF + GPX.
Output: `04_documentation/situace_audit/vendor_situace_audit.yaml`

### 1.4 Read vendor pricing PDFs

For each vendor offer PDF, extract:
- Vendor name
- Datum vystavení
- Configuration (délka, šířka, únosnost provizoria)
- Total price (Kč bez DPH)
- Breakdown:
  - Montáž
  - Pronájem (Kč/měsíc × měsíce)
  - Demontáž
  - Doprava
  - Volitelné položky (DIO, světelná signalizace)

Output: `04_documentation/vendor_pricing/vendor_quotes.yaml`

### 1.5 Read kadastr + souhlasy PDFs

Output: `04_documentation/kadastr_audit/parcels_and_consents.yaml`:
```yaml
parcels:
  - parcel_number: "1714"
    owner_type: FO/PO/obec/stát/RFK
    in_construction_zone: true/false
    in_provizorium_zone: true/false
souhlasy:
  total_obtained: N
  by_purpose:
    - parcel: "1714"
      purpose: provizorium/zaboru/pristup
      datum: ...
outstanding: [parcels without souhlas]
```

### 1.6 Acceptance Část 1

- [x] All 5 audit YAMLs created
- [x] No fabrication — confidence flags where extraction unclear
- [x] `nabídka.xlsm` audited only structure (no price values extracted)

---

## ČÁST 2: RECONCILIATION REPORT

**Cíl:** porovnat 3 zdroje pravdy per element — user manual, calculator output, KB norms.

### 2.1 Build reconciliation matrix

Pro každý OTSKP kód v user manual (76 položek SO 201 + ~22 SO 180):

| OTSKP kód | User manual | Calculator | KB norm range | Delta | Status |
|---|---|---|---|---|---|
| 421325 (mostovka) | 37.62 m³ | 33.6 m³ | 22.4-33.6 m³ (Pokorný 1/30-1/20 L) | +12% | review |
| 333325 (opěry) | 25.84 m³ | ~25 m³ | matches Phase B | <5% | match |
| ... | ... | ... | ... | ... | ... |

Status categories:
- **match** (Δ ≤ 5%) — green
- **minor delta** (5-15%) — yellow, document explanation
- **major delta** (>15%) — red, requires investigation
- **missing in calc** — calculator nepokrývá (např. třída 0 dokumentace)
- **missing in manual** — user neobsahuje (např. provizorium calculator estimate)

### 2.2 System gaps identification

Group "missing in calc" cases by TSKP třída:
- Třída 0 (dokumentace, geodézie): 12 položek missing in calculator
- Třída 1 (zemní detail): 7 položek missing in calculator (jen 1-2 souhrn)
- Třída 5 (komunikace detail): 11 položek missing in calculator
- Třída 9 (svodidla, závěry, příkopy): 18 položek missing in calculator

This is **system gap** documented for backlog.

### 2.3 Output

`04_documentation/reconciliation_report.md`:

```markdown
# Žihle 2062-1 — Reconciliation Report

## Summary
- User manual: 76 položek SO 201 + 22 SO 180 = 98 total
- Calculator Phase D: 52 položek total
- Coverage gap: 46 položek missing in calculator

## Per-element comparison
[detailed table]

## System gaps (calculator improvement backlog)
1. Třída 0 (dokumentace) — calculator nepokrývá administrativní položky
2. Třída 1 (zemní práce) — calculator dělá souhrn, ne detail
3. ...

## Recommendation
Master soupis použije calculator deterministic mnozstvi pro core elementy
(třídy 2-4-7), user manual mnozstvi pro doprovodné položky (třídy 0-1-5-9).
Konflikty flagged jako delta s explanation.
```

### 2.4 Acceptance Část 2

- [x] Reconciliation matrix existuje s ≥98 řádky
- [x] System gaps documentováno per TSKP třída
- [x] Žádné rozhodování "expert vs calc" — vše v rangech a flagy

---

## ČÁST 3: MASTER SOUPIS — 6 SO OBJECTS

**Cíl:** vytvořit production-ready soupis prací s TSKP hierarchical structure,
audit trail per položku, no work duplication.

### 3.1 SO Decomposition

| SO | Název | Source pro mnozstvi | Status |
|---|---|---|---|
| **SO 001** | Demolice (PLNÝ SCOPE) | Calculator + user manual review | NEW expansion |
| **SO 180** | Provizorium | User manual SO_180 + vendor pricing | adapted from objízdná |
| **SO 201** | Most | Calculator deterministic + user manual reconciliation | retrofit Phase D |
| **SO 290** | Silnice (návaznosti) | User manual SO_201 třída 5 | new |
| **SO 801** | ZS detailní | New — per checklist | NEW separate SO |
| **VRN** | Vedlejší rozpočtové náklady | 3% z SO 001+180+201+290+801 | new |

### 3.2 SO 001 DEMOLICE — full scope (per user decision = D)

**TSKP hierarchical structure:**

#### Třída 0 — Všeobecné konstrukce
- 014102 POPLATKY ZA SKLÁDKU (T) — for all materials (asfalt, beton, ocel)
- 014201 POPLATKY ZA ZEMNÍK - ZEMINA (m³) — pro odvoz zeminy
- 02510 ZKOUŠENÍ MATERIÁLŮ (kpl) — kontrola materiálu při bourání
- 02960 ODBORNÝ DOZOR (kpl)
- 02991 INFORMAČNÍ TABULE (kus) × 2

#### Třída 1 — Zemní práce
- 11511 ČERPÁNÍ VODY (hod) — během demolice
- 121108 SEJMUTÍ ORNICE (m³) — pro provizorium podloží
- 13173 HLOUBENÍ JAM (m³) — pro stavební jámu po demolici
- 17120 ULOŽENÍ SYPANINY (m³)

#### Třída 9 — Demolice properties
- **96xxxx** kódy pro bourání:
  - Demontáž stávajícího mostu — bourání NK monolitické ŽB s ocelovými I-vložkami (najít OTSKP)
  - Demontáž svodidel + zábradlí stávajících
  - Demontáž odvodňovačů a izolace
  - Demontáž asfaltové vozovky (frézování + odvoz na RS Žatec)
- **968xx** odstranění:
  - Odstranění dlažby koryta stávající
  - Odstranění opevnění břehů
- **Provizorium demontáž (po dokončení nového mostu, end-of-construction):**
  - 027413 PROVIZORNÍ MOSTY - DEMONTÁŽ (m²)
  - Demontáž podložek pod provizorium (zemní práce + dlažba)
  - Demontáž panelů/vozovkových vrstev pod provizoriem
  - Rekultivace záboru (ornice + hydroosev — viz user formula)

#### Odvozy (s konkrétními vendor pricami z Část 1.4)
- Beton sutí + ocel I-280 → recyklační středisko nebo skládka
- Asfaltové frézování → RS Žatec (per ceník)
- Zemina → BERGER skládka (per nabídka 30.04.2026)

**Audit trail příklady:**
```yaml
- otskp_kod: "11511"
  popis: ČERPÁNÍ VODY DO 500 L/MIN
  mj: hod
  mnozstvi: 200
  vypocet:
    formula: "doba_demolice × hodin_per_den × intenzita_cerpani_factor"
    vstupy:
      doba_demolice: {hodnota: 60, jednotka: dní, popis: "demolice + výkop", zdroj: "Phase B harmonogram"}
      hodin_per_den: {hodnota: 8, jednotka: hod, popis: "pracovní směna", zdroj: "praxe"}
      intenzita_cerpani_factor: {hodnota: 0.42, jednotka: -, popis: "průměrná intenzita potřeby čerpání", zdroj: "engineering judgment based on Mladotický potok flow"}
    vypocet_kroky:
      - "60 × 8 = 480 hod (max teoretická doba)"
      - "480 × 0.42 = 200 hod (realistic estimate)"
  confidence: 0.6
```

### 3.3 SO 180 PROVIZORIUM — adapted from objízdná template

**Source:** User manual SO_180_JŠ (30 položek, ale typ = objízdná, ne provizorium).
**Adaptation:** zachovat třídu 0 + 1 (poplatky, zemní práce pro podloží), nahradit třídu 5 (komunikace) za třídy 0/2 (pomocné práce + zakládání) per `027411-027413` (PROVIZORNÍ MOSTY).

**TSKP structure pro provizorium:**

#### Třída 0
- 014102 Skládka (T)
- 02710 Pomocné práce zřízení (kpl)
- 02740 Pomocné práce provizorní mostů (kpl)
- **027411 PROVIZORNÍ MOSTY - MONTÁŽ (m²)** ← per vendor pricing
- **027412 PROVIZORNÍ MOSTY - NÁJEMNÉ (kpl/měsíc)** ← per vendor pricing × měsíce
- 02946 Fotodokumentace
- 02950 Posudky

#### Třída 1 — Zemní práce pod provizoriem
- 111208 Odstranění křovin (m²)
- 11511 Čerpání vody (hod)
- 121108 Sejmutí ornice (m³)
- 13173 Výkop pro založení provizoria (m³)
- 18241 Založení trávníku (m²) — rekultivace záboru

#### Třída 2 — Zakládání
- 28997 Geotextilie (m²) — pod provizorium

#### Třída 4 — Vodorovné konstrukce
- 451523 Výplň z kameniva drceného (m³) — podloží provizoria
- 45211 Podklad z dílců beton (m³) — pod provizorium

#### Třída 5 — Komunikace (pokud provizorium má vlastní vozovku/přechody)
- 56333 Štěrkodrť tl. 150mm (m²) — nájezdy
- 56336 Štěrkodrť tl. 300mm (m²) — nájezdy

**User formulas pro množství** (per user message):
```yaml
- otskp_kod: "027411"
  popis: PROVIZORNÍ MOSTY - MONTÁŽ
  mj: m2
  mnozstvi: 60.0  # vendor: délka × šířka, např. 12 × 5 = 60
  vypocet:
    formula: "L_provizorium × B_provizorium"
    vstupy:
      L_provizorium: {hodnota: 12, jednotka: m, popis: "celk. délka přemostění + nájezdy", zdroj: "vendor TMS spec"}
      B_provizorium: {hodnota: 5, jednotka: m, popis: "šířka mostní konstrukce", zdroj: "vendor 4-5m varianta"}
    vypocet_kroky:
      - "12 × 5 = 60 m²"
  confidence: 0.85
  vendor_pricing:
    median: ... Kč
    range_min: ... Kč
    range_max: ... Kč
    sources: [TMS, MS, CN_5_5_2026]

- otskp_kod: "027412"
  popis: PROVIZORNÍ MOSTY - NÁJEMNÉ
  mj: kpl_mesic
  mnozstvi: 6.0
  vypocet:
    formula: "doba_demolice + doba_vystavby_NK"
    vstupy:
      doba_demolice: {hodnota: 1.5, jednotka: měs, popis: "demolice starého mostu", zdroj: "Phase B harmonogram"}
      doba_vystavby_NK: {hodnota: 4.5, jednotka: měs, popis: "výstavba nového rámu", zdroj: "Phase C calculator"}
    vypocet_kroky:
      - "1.5 + 4.5 = 6.0 měs"
  confidence: 0.9
```

**Vozovka provizoria** (per user formula):
```yaml
- otskp_kod: "574A34"
  popis: ASFALTOVÝ BETON ACO 11+ TL. 40MM (vozovka provizoria nájezdy)
  mj: m2
  mnozstvi: 522.0
  vypocet:
    formula: "L_bypass × B_vozovka"
    vstupy:
      L_bypass: {hodnota: 116, jednotka: m, popis: "délka bypassu z GPS Mapy.cz", zdroj: "GPX export 2026-05-XX"}
      B_vozovka: {hodnota: 4.5, jednotka: m, popis: "šířka vozovky bypassu", zdroj: "user spec"}
    vypocet_kroky:
      - "116 × 4.5 = 522 m²"
  confidence: 0.85
```

### 3.4 SO 201 MOST — calculator deterministic + reconciliation

**Source:** Phase C calculator outputs, validovat proti user manual SO_201.

**TSKP structure** = full per user manual (třídy 0-9, viz Část 1.1).

**Klíčové položky s audit trail:**

```yaml
- otskp_kod: "421325"
  popis: MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE ZE ŽELEZOBETONU C30/37
  mj: m3
  mnozstvi: 33.6   # ← CALCULATOR DETERMINISTIC (per user choice C)
  vypocet:
    formula: "L × B × t"
    vstupy:
      L: {hodnota: 9.0, jednotka: m, popis: "rozpětí mostu", zdroj: "Phase A HPM, conf 0.7"}
      B: {hodnota: 8.30, jednotka: m, popis: "celk. šířka (vozovka 6.50 + 2× říмса 0.90)", zdroj: "Phase B varianta_01"}
      t: {hodnota: 0.45, jednotka: m, popis: "tloušťka desky", zdroj: "Pokorný-Suchánek tab. 15 (1/20 L)"}
    vypocet_kroky:
      - "9.0 × 8.30 = 74.7 m² (plocha desky)"
      - "74.7 × 0.45 = 33.6 m³"
  confidence: 0.85
  reconciliation:
    user_manual_value: 37.62  # m³
    delta_pct: +12  # user manual větší
    explanation: "User manual použil tloušťku 0.50 m (vs učebnik 0.45 m); + možné náběhy/haunches v user calculation. Pro DPS — projektant rozhodne dle statiky."

- otskp_kod: "333325"
  popis: MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOBETONU C30/37
  mj: m3
  mnozstvi: 25.0   # calculator
  vypocet:
    formula: "(plocha_oper + plocha_kridel) × tloušťka"
    vstupy:
      plocha_oper: {hodnota: 18.5, jednotka: m², popis: "2× opěra 4.5 × 2.0 m výška", zdroj: "Phase B"}
      plocha_kridel: {hodnota: 0, jednotka: m², popis: "Žihle bez křídel (svah 1:1.5)", zdroj: "Phase B varianta_01"}
      tloušťka: {hodnota: 1.35, jednotka: m, popis: "průměrná tloušťka opěr", zdroj: "Phase B"}
    vypocet_kroky:
      - "Plocha = 4.5 × 2.0 = 9.0 m² per opěra"
      - "Total plocha = 9.0 × 2 = 18.0 m² (2 opěry)"
      - "18.0 × 1.35 = 24.3 m³ (přibl. 25)"
  confidence: 0.8
  reconciliation:
    user_manual_value: 25.84
    delta_pct: +3
    status: match
```

### 3.5 SO 290 SILNICE — návaznosti

**Source:** User manual SO_201 třída 5 (komunikace) — navazující úseky silnice.

Položky:
- Frézování asfaltu navazujících úseků
- Nová ACO 11+ vrstva
- Vodorovné značení (915111)
- Svislé dopravní značení (914xxx)
- Příkopy (935212)

### 3.6 SO 801 ZS DETAILNÍ (per user decision A)

**TSKP structure:**

#### Třída 0
- 02520 Hygienická a sociální zařízení staveniště (kpl)
- 02530 Energie + voda staveniště (kpl)
- 02540 Telefonní spojení (kpl)
- 02560 Oplocení staveniště (m) × obvod staveniště
- 02570 Osvětlení staveniště (kpl)
- 02580 Příjezdová komunikace (m²) — dočasná
- 02590 Čistění vozidel při výjezdu (kpl)
- 02991 Tabule, značky staveniště (kus)

#### Audit trail
```yaml
- otskp_kod: "02560"
  popis: OPLOCENÍ STAVENIŠTĚ
  mj: m
  mnozstvi: 200
  vypocet:
    formula: "obvod_staveniste"
    vstupy:
      obvod_staveniste: {hodnota: 200, jednotka: m, popis: "perimetr ohraničující staveniště", zdroj: "DXF kataster + GPX trace"}
    vypocet_kroky:
      - "Staveniště ≈ 50 m × 50 m = 2500 m² (cca)"
      - "Obvod ≈ 200 m"
  confidence: 0.6
```

### 3.7 VRN — Vedlejší rozpočtové náklady

3% z (SO 001 + 180 + 201 + 290 + 801) per ČSN 73 0212.

### 3.8 No work duplication validation

**Validation rule:** každý OTSKP kód smí být v master soupis použit max 2× (pokud v různých SO se liší context — např. zemní práce v SO 001 demolice vs SO 201 výkop).

Když stejný OTSKP kód v 2 SO → flag in `validation_report.md` s explanation rozdílu.

### 3.9 Output

- `04_documentation/master_soupis/master_soupis.yaml` — strukturovaná data
- `04_documentation/master_soupis/soupis_praci_FINAL.xml` — UNIXML KROS export
- `04_documentation/master_soupis/soupis_praci_FINAL.xlsx` — XLSX duplikát s 6 sheets per SO

### 3.10 Acceptance Část 3

- [x] 6 SO objektů per decomposition table
- [x] TSKP hierarchical structure 0-9 per SO (kde aplikovatelné)
- [x] **Každá položka má audit trail** (formula + vstupy + vypocet_kroky + confidence)
- [x] **No work duplication validated** — žádný OTSKP kód v 2 SO bez explanation
- [x] Total ≥ 110 položek
- [x] Calculator deterministic mnozstvi (single value per user choice C)
- [x] Reconciliation deltas flagged inline kde |delta| > 10%

---

## ČÁST 4: PHASE E VISUAL — situace s katastr DXF

### 4.1 Situace M 1:500 — DXF integration

Use existing POC `/home/claude/zihle_phase_e/build_situace.py` jako základ.
Extend pro DXF integration:

1. Read DXF (ezdxf) — kadastr parcely + silnice III/206 2 z DXF (ne schematicky)
2. Overlay GPX trace (provizorium 116 m) z předchozího POC
3. Add bridge polygon — z user input (rozpětí 9 m × šířka 8.30 m, šikmost 50°, position center per GPX)
4. Add záboru pozemku ~1000 m² (per user měření)
5. Title block, scale bar, legend (per POC)

Output: `04_documentation/výkresy/C.2.1_situace_M1_500.svg` + PNG preview

### 4.2 Cross-validation vs vendor situace.pdf

Compare bounding boxes a klíčové features.
Pokud vendor situace má jiný layout — flag v `04_documentation/výkresy/cross_validation_notes.md`.

### 4.3 Podélný a příčný řez (deferred — pokud čas)

Pokud Část 4.1+4.2 hotová do 5h od začátku — pokračovat:
- `C.2.2_podelny_rez_M1_100.svg` — elevation profile s GPS heights
- `C.2.3_pricny_rez_M1_100.svg` — cross section (vozovka 6.50 m + 2× říмса)

Pokud čas neumožňuje — defer jako separate task, flag v output.

### 4.4 Acceptance Část 4

- [x] `C.2.1_situace_M1_500.svg` exists s DXF kadastr layer
- [x] PNG preview generated
- [x] Cross-validation notes vs vendor situace
- [x] Podélný + příčný řez = nice-to-have, ne mandatory

---

## ČÁST 5: BACKLOG ITEMS pro core team

Document **system gaps** identifikované v reconciliation:

### 5.1 `backlog/calculator_prompt_extension.md`

```markdown
# Calculator AI Reasoner — Prompt Extension Required

## Problem
Calculator generuje element_breakdown.yaml zaměřený na konstruktivní elementy
(třídy 2-4-7 TSKP). Žihle reconciliation odhalila že 46 položek z 98 expert ground truth
chybí v calculator output:
- Třída 0 (administrativa, dokumentace, geodézie): 12 missing
- Třída 1 (zemní práce detail): 7 missing  
- Třída 5 (komunikace detail vrstev): 11 missing
- Třída 9 (svodidla, závěry, příkopy, dilatace, znamení): 18 missing

## Required fix
Extend AI Reasoner prompt s checklists pro každou TSKP třídu:
[detailed prompt template here]

## Validation
After fix, re-run Žihle Phase C → should produce ≥90 položek (±5% per třída).
```

### 5.2 `backlog/otskp_search_algorithm.md`

```markdown
# OTSKP / URS Matcher — Search Algorithm Improvement

## Problem
Current search algorithm (URS_MATCHER + OTSKP DB) ranks položky by keyword similarity.
Professional projektanti however hledají **by TSKP třída** (structurnaá position),
ne keywords.

## User feedback (2026-05-XX)
"OTSKP plоhо ищет" — mostovka deska 421325 nebyl found, římsy 317325 nebyl found,
přechodové desky 420324 nebyl found. Yet they exist v OTSKP DB.

## Required fix
Rewrite search:
1. Determine TSKP třída from element_type (mapping table)
2. Filter OTSKP DB by třída prefix
3. Rank within třída by params match (concrete class, MJ, exposure)
4. Return top-N s confidence score

## Architecture
[detailed code template]
```

### 5.3 Acceptance Část 5

- [x] Both backlog files exist with concrete fix specifications
- [x] Reproducible test cases (re-run Žihle to validate fix)

---

## ČÁST 6: TZ + PROJECT SUMMARY UPDATE

### 6.1 Update `04_documentation/TZ_DUR_zihle_2062-1.md`

Add/update sekce:
- **B.1.3 Pozemky** — cite kadastr audit + předběžné souhlasy obtained → risk reduction
- **B.8.1 ZOV** — provizorium pricing range z vendor offers (3+ vendors)
- **B.8.2 Etapizace** — reference master soupis SO sequence
- **B.8.3 Demolice scope** — full per part 3.2

### 6.2 Update `00_PROJECT_SUMMARY.md`

Add sekce:
- **Phase D+E (retrofit) deliverables**
- **Reconciliation findings** — system gaps
- **Vendor pricing integration** — final cost range
- **Visual outputs** — situace SVG ready

### 6.3 Update `metadata.yaml`

- `status: tender_ready` (z `documented`)
- Přidat sekci `master_soupis_stats`:
  - total_polozek
  - SO_count
  - cena_total_kc
  - cena_with_vat_kc
  - confidence_distribution

### 6.4 Acceptance Část 6

- [x] TZ updated s 4 new sekce
- [x] PROJECT_SUMMARY reflects retrofit
- [x] metadata status `tender_ready`

---

## CROSS-CUTTING ACCEPTANCE CRITERIA

1. ✅ **Žádný kód mimo `test-data/most-2062-1-zihle/`** + `backlog/` nebyl změněn
2. ✅ KB pouze čteme (no new entries v this task)
3. ✅ Calculator core unchanged (gaps documented for backlog, ne fixed here)
4. ✅ Existing CI tests pass
5. ✅ All YAML files load via `yaml.safe_load`
6. ✅ All XML files validate
7. ✅ All SVG files render
8. ✅ Master soupis total cost ≤ 30 mil. Kč budget per ZD

---

## ČO NEPATRÍ DO TOHTO TASKU

- ❌ Calculator core changes (jen backlog tickets)
- ❌ OTSKP search algorithm fix (jen backlog ticket)
- ❌ KB entries new (audit only, žádný ingest)
- ❌ Litovel sandbox A-D (separate future task)
- ❌ FINAL nabídka XLSM preparation (separate task po master soupis review)
- ❌ SOD signing / banková záruka (manual user actions)
- ❌ Real podání přes E-ZAK (user action)
- ❌ Plný extraction EN 1992-2 (separate task)

---

## PRE-IMPLEMENTATION INTERVIEW (před kódem!)

1. **xlrd lib:** dostupný? Pokud ne — `pip install xlrd --break-system-packages`.
   `nabídka.xlsm` má macros — open as data only (no execute).

2. **ezdxf lib:** dostupný? Pokud ne — `pip install ezdxf --break-system-packages`.
   DXF coordinate system — pokud S-JTSK → convert to WGS84 pro overlay s GPX.

3. **extract-msg lib:** pro `.msg` Outlook files. Pokud ne — `pip install extract-msg`.
   Pokud nelze install → fallback na header extraction nebo skip + flag.

4. **PDF text extraction:** pdfplumber pro vendor offers. Pokud OCR-only PDF → tesseract
   nebo skip + flag.

5. **Vendor PDF parsing:** layout může být různý per vendor. Audit první PDF, vytvořit
   regex/template, apply na ostatní. Pokud structure inconsistent → manual entry s flag.

6. **DXF coordinate system:** **CRITICAL** — pokud DXF v S-JTSK (Czech standard) a
   GPX v WGS84 → potřeba transformation. Use `pyproj` library:
   ```python
   from pyproj import Transformer
   transformer = Transformer.from_crs("EPSG:5514", "EPSG:4326", always_xy=True)  # S-JTSK → WGS84
   lon, lat = transformer.transform(x_sjtsk, y_sjtsk)
   ```
   Pokud DXF nemá explicitní coordinate system v header → **STOP a AskUserQuestion**.

7. **No work duplication detection:** validace před XML export. Build dictionary
   `{otskp_kod: [list of SO]}`. Pokud len(list) > 1 → flag v report.

8. **Master soupis cena calculation:** orientační vendor unit prices z URS_MATCHER lookup.
   Pokud kód není v DB → flag confidence 0.5, dummy 0 Kč. Total reasonable check —
   pokud >30 mil. Kč → flag warning, ne block.

9. **Sensitive content scrubbing:** **`nabídka.xlsm`** je INTERNAL. Audit pouze sheet
   names + column headers, NE extract konkrétní hodnoty cen do žádného output souboru.
   `04_documentation/audit/nabidka_internal_audit.md` flag jako "INTERNAL — review by user".

10. **GPX coordinate origin:** předchozí Phase E POC použil GPX 6 bodů. Local Cartesian
    origin = centroid of trace. Pro DXF overlay — convert DXF z S-JTSK na same local
    Cartesian via WGS84 intermediate.

> Pokud na cokoli neumíš dát jednoznačnou odpověď z auditu → STOP a AskUserQuestion.

---

## VÝSTUP DO CHATU PO DOKONČENÍ

1. **Master soupis stats:**
   - Počet SO objektů: 6
   - Total položek: N (target ≥110)
   - Total cena bez DPH: X Kč
   - Headroom proti 30 mil. Kč: Y%

2. **Reconciliation summary:**
   - Match (≤5%): N items
   - Minor delta (5-15%): N items  
   - Major delta (>15%): N items s explanations
   - Missing in calc: N items per třída

3. **Vendor pricing summary:**
   - SO 180 provizorium: median X Kč, range Y-Z Kč, sources [TMS, MS, ...]
   - Odvozy zemina: BERGER X Kč/m³
   - Recyklace asfalt: RS Žatec X Kč/T

4. **Phase E status:**
   - C.2.1 situace SVG: created / failed
   - C.2.2 podélný řez: created / deferred
   - C.2.3 příčný řez: created / deferred

5. **Backlog tickets:**
   - calculator_prompt_extension.md ✅
   - otskp_search_algorithm.md ✅

6. **Strom artefaktů:**
   ```
   tree -L 3 test-data/most-2062-1-zihle/04_documentation/
   tree -L 2 backlog/
   ```

7. **Open questions / blockers** — co user musí potvrdit/dodat před tender submission

---

## SPLIT INTO 2 SESSIONS (recommended)

Pokud Claude Code session timeout ≤ 4h:

**Session 1 (~4h):**
- Část 1 (audit) + Část 2 (reconciliation) + Část 5 (backlog)
- Output: audit YAMLs + reconciliation_report.md + 2 backlog tickets

**Session 2 (~4-5h):**
- Část 3 (master soupis) + Část 4 (Phase E) + Část 6 (TZ update)
- Output: master soupis files + výkresy + updated TZ + status tender_ready

Pokud single session ≥6h available → all parts.

---

## Naming a strukturu určuj podle existujících konvencí v repu.
## Calculator deterministic mnozstvi je default per user choice C.
## Audit trail per položku je MANDATORY — žádný mnozstvi bez formula+vstupy+vypocet_kroky.
## TSKP hierarchy 0-9 je MANDATORY per SO.
## No work duplication MUSÍ být validováno před export.
