# SO-250 — SmartExtractor probe spec

**Účel:** ověřit jak baseline extractor (`tz-text-extractor.ts`, 604 LOC) zvládá reálný ŘSD TZ.
**Existing extractor:** sources = `'regex' | 'keyword' | 'heuristic' | 'smeta_line'` + ExtractedParam s confidence + alternatives.
**Out of scope:** formula parser, vision MCP, multi-element classifier per-document (to je Variant B v2, deferred post-CSC).
**In scope:** regex coverage gap + AI helper integrace v kalkulátoru.
**Datum:** 2026-05-14

---

## 1. Co se testuje

Vstup: markdown excerpts z SO 250 TZ (viz §3 níže).

Výstup: tabulka **"expected vs current"** — co má extractor správně rozpoznat, co reálně rozpoznává, kde má wrong confidence, kde chybí pattern.

Cílový artefakt: `docs/audits/smartextractor_so250/2026-MM-DD_extractor_coverage.md`

---

## 2. Test corpus (excerpty z TZ SO 250)

### Block A — Identifikace (TZ str. 5)

```
Číslo objektu SO 250
Název objektu Zárubní zeď v km 6,500 – 7,000 vpravo
Druh převáděné komunikace dálnice D6
Staničení zdi km 6,492 40 – 7,007 60
Stupeň dokumentace Projektová dokumentace pro provádění stavby (PDPS)
Charakteristika zdi Úhlová železobetonová zeď.
Délka zdi 515,20 m
Výška zdi nad terénem Proměnná, od 1,550 do 3,400 m
Pohledová plocha zdi 1737,44 m2
```

### Block B — Konstrukce (TZ str. 7-8)

```
Zeď bude založena na podkladní beton tloušťky 0,15 m z betonu C25/30 XF3, XA2, XC2.
Základ opěrné zdi je konstantní tloušťky 0,56 m a šířky 2,75 m.
V podélném směru je základ členěn na 40 dilatačních celků konstantní délky 12,50 m
a dva krajní dilatační celky DC01 a DC42 konstantní délky 7,60 m.
Dřík konstrukce je konstantní tloušťky 0,45 m a proměnné výšky 1,65 – 3,50 m.
Dřík konstrukce je na líci obložen lomovým kamenem tloušťky 0,30 m.
Lícový obklad je kotven do dříku opěrné zdi vlepenými kotvami R8.
Kotvy jsou v rastru minimálně 0,75 x 0,75 m.
```

### Block C — Římsa a zábradlí (TZ str. 8-9)

```
Římsy-kotevní trámy jsou navrženy z betonu C 30/37 XF4, XD3, XC4
a vyztuženy betonářskou výztuží B 500 B.
Šířka 0,85 m, tloušťka 0,4 m na líci a 0,36 m na rubu.
Na horním kotevním trámu je navrženo silniční zábradlí výška 1,10 m.
```

### Block D — Výkres (Vzorový příčný řez)

```
PODKLADNÍ BETON  C12/15 — X0 (CZ-TKP 18PK)-Cl 1,0-Dmax22-S2
OPĚRNÁ ZEĎ DŘÍK  C30/37 - XF4-XC4 (CZ-TKP 18PK)-Cl 0,4-Dmax22-S3
OPĚRNÁ ZEĎ ZÁKLAD  C25/30 - XF3, XC2, XA2 (CZ-TKP 18PK)-Cl 0,4-Dmax22-S3
OPĚRNÁ ZEĎ ŘÍMSA  C30/37 - XF4, XD3, XC4 (CZ-TKP 18PK)-Cl 0,4-Dmax22-S3
KOMPOZITNÍ 3-LANKOVÉ ZÁBRADLÍ, H=1,15 m
```

### Block E — Geotechnika (TZ str. 5-6)

```
Geologie: granit karlovarského plutonu.
Třída těžitelnosti I.-III, lokálně IV. dle ČSN 73 6133.
Edef,2 ≥ 60 MPa, Edef,2/Edef,1 ≤ 2,5.
Stupeň ochranných opatření proti bludným proudům: 3. (dle TP 124)
```

---

## 3. Expected extraction matrix

### 3.1 Z Bloku A (Identifikace)

| Pole | Hodnota | Source preference | Confidence target |
|------|---------|-------------------|-------------------|
| `object_id` | "SO 250" | regex `SO\s*(\d{3})` | 1.0 |
| `object_name` | "Zárubní zeď v km 6,500 – 7,000 vpravo" | keyword | 0.95 |
| `road` | "D6" | regex `dálnice\s+(D\d+)` | 1.0 |
| `stationing_from` | "6+492.40" | regex (km parser) | 1.0 |
| `stationing_to` | "7+007.60" | regex | 1.0 |
| `documentation_stage` | "PDPS" | keyword | 1.0 |
| `construction_type` | "úhlová železobetonová" | keyword | 0.9 |
| `length_m` | 515.20 | regex `Délka.*?(\d+[,\.]\d+)\s*m` | 1.0 |
| `height_above_terrain_min_m` | 1.55 | regex `od\s+(\d+[,\.]\d+)\s+do` | 0.95 |
| `height_above_terrain_max_m` | 3.40 | regex `do\s+(\d+[,\.]\d+)\s*m` | 0.95 |
| `visible_area_m2` | 1737.44 | regex `Pohledová.*?(\d+[,\.]\d+)\s*m2` | 1.0 |

### 3.2 Z Bloku B (Konstrukce)

| Pole | Hodnota | Source | Confidence |
|------|---------|--------|------------|
| `podkladni_beton_thickness_m` | 0.15 | regex | 1.0 |
| `podkladni_beton_grade` | "C25/30" | regex `C\d+/\d+` | 1.0 |
| `podkladni_beton_exposure` | ["XF3","XA2","XC2"] | regex `X[A-Z]\d` | 1.0 |
| `base_thickness_m` | 0.56 | regex | 1.0 |
| `base_width_m` | 2.75 | regex | 1.0 |
| `dilatation_main_count` | 40 | regex `na\s+(\d+)\s+dilatačních` | 1.0 |
| `dilatation_main_length_m` | 12.50 | regex | 1.0 |
| `dilatation_edge_count` | 2 | regex `dva\s+krajní` → 2 | 0.9 |
| `dilatation_edge_length_m` | 7.60 | regex | 1.0 |
| `wall_thickness_m` | 0.45 | regex | 1.0 |
| `wall_height_min_m` | 1.65 | regex range | 0.95 |
| `wall_height_max_m` | 3.50 | regex range | 0.95 |
| `face_cladding_material` | "lomový kámen" | keyword | 0.9 |
| `face_cladding_thickness_m` | 0.30 | regex | 1.0 |
| `face_cladding_anchor_type` | "R8" | regex | 0.95 |
| `face_cladding_anchor_grid_m` | [0.75, 0.75] | regex `(\d+[,\.]\d+)\s*x\s*(\d+[,\.]\d+)` | 1.0 |

### 3.3 Z Bloku C (Římsa)

| Pole | Hodnota | Source | Confidence |
|------|---------|--------|------------|
| `rimsa_concrete_grade` | "C30/37" | regex | 1.0 |
| `rimsa_exposure` | ["XF4","XD3","XC4"] | regex | 1.0 |
| `rebar_grade` | "B500B" | regex `B\s*500\s*B?` | 1.0 |
| `rimsa_width_m` | 0.85 | regex | 1.0 |
| `rimsa_thickness_face_m` | 0.40 | regex `tloušťka\s+(\d+[,\.]\d+)\s+na\s+líci` | 0.95 |
| `rimsa_thickness_back_m` | 0.36 | regex `(\d+[,\.]\d+)\s+na\s+rubu` | 0.95 |
| `railing_height_m` | 1.10 | regex | 1.0 |

### 3.4 Z Bloku D (Výkres — výsledek vision/OCR)

| Pole | Hodnota | Source | Confidence |
|------|---------|--------|------------|
| `podkladni_beton_grade_from_drawing` | "C12/15" | regex | 1.0 |
| `podkladni_beton_exposure_from_drawing` | ["X0"] | regex | 1.0 |
| `dřík_grade_from_drawing` | "C30/37" | regex | 1.0 |
| `dřík_exposure_from_drawing` | ["XF4","XC4"] | regex | 1.0 |
| `základ_grade_from_drawing` | "C25/30" | regex | 1.0 |
| `základ_exposure_from_drawing` | ["XF3","XC2","XA2"] | regex | 1.0 |
| `railing_height_from_drawing_m` | 1.15 | regex | 1.0 |

### 3.5 Z Bloku E (Geotechnika)

| Pole | Hodnota | Source | Confidence |
|------|---------|--------|------------|
| `geology_main` | "granit karlovarského plutonu" | keyword | 0.85 |
| `excavation_class_main` | "I-III" | regex | 0.95 |
| `excavation_class_local_max` | "IV" | regex | 0.85 |
| `edef2_base_MPa` | 60 | regex `Edef.*?(\d+)\s*MPa` | 1.0 |
| `edef_ratio_max` | 2.5 | regex | 0.95 |
| `stray_currents_grade` | 3 | regex | 0.95 |

---

## 4. Conflict detection (kritický test)

**Pokud extractor vyhodnotí oba bloky (B + D), musí vyprodukovat alternatives s confidence < 1.0 pro konfliktní pole.**

| Pole | TZ value | Drawing value | Expected behavior |
|------|----------|---------------|-------------------|
| `podkladni_beton_grade` | "C25/30" | "C12/15" | `confidence: 0.6, alternatives: [{value: "C12/15", source: "drawing", confidence: 0.95}, {value: "C25/30", source: "tz", confidence: 0.85}]` |
| `podkladni_beton_exposure` | ["XF3","XA2","XC2"] | ["X0"] | conflict, drawing wins |
| `dřík_exposure_xf` | "XF3" | "XF4" | conflict, drawing wins |
| `railing_height_m` | 1.10 | 1.15 | both valid, no conflict (NK vs vč. patní) |

**Rule of thumb pro reconciliation:** výkres > TZ (drawing wins) je default, ale audit trail musí zobrazit obě hodnoty + uživatel může overridovat.

---

## 5. AI co-pilot integration test

### 5.1 UI hook v kalkulátoru

Předpokládaná akce uživatele:
1. Otevře `kalkulator.stavagent.cz/planner`
2. Vybere "Nový projekt z TZ"
3. Upload PDF SO 250 TZ (nebo paste markdown)
4. Stiskne "Vyplnit z TZ"

Expected behavior:
- Spinner "Extrahuji parametry..." (cíl < 5s pro 13-page TZ)
- Auto-fill polí v calculator formuláři
- Confidence badge u každého pole (green ≥0.9, yellow 0.7-0.89, red <0.7)
- Pro yellow/red pole — tooltip s extrahovaným kontextem + tlačítko "Potvrdit" / "Upravit"
- Pro konfliktní pole (alternatives.length > 0) — modal s tabulkou TZ/drawing/manual + požadavek na manuální výběr

### 5.2 Tracked metrics

Pro každý probe run zaznamenat:
- Coverage rate = (extracted_fields_correct) / (expected_fields_total)
- High-confidence accuracy = (correctly_extracted ∩ confidence≥0.9) / (confidence≥0.9 total)
- False positive rate = (extracted_wrong) / (extracted_total)
- Conflict detection rate = (conflicts_detected) / (conflicts_expected)

**Acceptance criteria pro SmartExtractor go-live:**
- Coverage ≥ 75% pro Block A+B (identifikace + konstrukce)
- High-confidence accuracy ≥ 95%
- Conflict detection rate = 100% (kritické)

---

## 6. Coverage gap analysis (anticipated)

Co současný extractor pravděpodobně **NEMÁ** (per FINDINGS):

### 6.1 Pravděpodobně chybí regex patterns

- `staničení km X,YYY ZZ – X,YYY ZZ` formát (mezera v desetinné části)
- `od X,YYY do Y,YYY m` range (dvojhodnota)
- `40 dilatačních celků konstantní délky 12,50 m` (count + length kombinace)
- `rastru 0,75 x 0,75 m` (grid 2D)
- `třída těžitelnosti I.-III` (Roman numerals)
- Exposure class lists `XF4, XD3, XC4` (víceslovné se zachováním pořadí)

### 6.2 Pravděpodobně chybí cross-source reconciliation

- TZ vs výkres conflict detection není explicitně v ExtractedParam.alternatives logice
- Drawing source ještě není v enum (`'regex' | 'keyword' | 'heuristic' | 'smeta_line'`)
- → potřeba rozšířit source enum o `'drawing'` (vision je dále, ale OCR-extracted text z výkresu může jít jako `'drawing'`)

### 6.3 Pravděpodobně chybí element-level grouping

- Multi-block extractor vrací flat list, ne strukturu "podkladní/základ/dřík/římsa"
- → potřeba post-processing: group by `element_keyword` (podkladní, základ, dřík, římsa)
- Toto je Variant B v2 deferred — ale base grouping bez formulí lze přidat za ~1 den

---

## 7. Definition of done pro probe

- [ ] Markdown s expected matrix commitnut v `docs/audits/smartextractor_so250/`
- [ ] Existing extractor spuštěn proti excerpts, výsledky zaznamenány
- [ ] Coverage % vypočteno
- [ ] Gap list napsán (chybějící regex, missing reconciliation)
- [ ] Doporučení: která 3 největší gapy řešit pro CSC demo? (nesmí být > 1 den implementace)
- [ ] User decision: které gapy zařadit do CSC sprint, které defer

---

## 8. Co tato práce NENÍ

- ❌ Není to spuštění extractora — to udělá Claude Code v repo (`Monolit-Planner/shared/`)
- ❌ Není to formula parser ani vision (Variant B v2, post-CSC)
- ❌ Není to multi-element classifier (Variant B v2)
- ❌ Není to nový extractor — pouze probe stávajícího + targeted fixes

---

## 9. Vazby

- Golden test spec: `SO-250_golden_test.md` (paralelní track)
- Existing extractor: `Monolit-Planner/shared/src/parsers/tz-text-extractor.ts` (604 LOC)
- FINDINGS archive: `docs/audits/smartextractor_variant_b/FINDINGS_SO_FAR_2026-05-10.md`
- PDF source: `test-data/SO_250/` (na GitHubu po commitu)

---

**End of probe spec. K předání do Claude Code session pro spuštění proti existing extractor.**
