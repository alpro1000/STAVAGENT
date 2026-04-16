# SO-203 D6 Karlovy Vary — Golden Test Data for Calculator Audit

**Source:** TZ PDPS VD-ZDS, VIAPONT s.r.o., Ing. Martin Drnec (ČKAIT 1004498), říjen 2025
**Object:** Most na sil. I/6 v km 2,450 (přes MK SO106)
**Audit date:** TBD
**Knowledge base refs:** B1 (ČSN EN 206+A2), B2 (ČSN EN 1992-2, Eurokód 2), B3 (TKP18), B4 (TKP16 Piloty), B5 (TKP19 PKO), B6 (TP124 bludné proudy), B7 (ČSN 73 6244 přechodové oblasti), B8 (ČSN 73 6242 izolace), B9 (VL4)

---

## Layer 1 — Extracted Facts (parser target)

### 1.1 Stavba

- D6 Karlovy Vary – Olšová Vrata, SO203 Most na sil. I/6 v km 2,450
- 2 samostatné mosty (LM + PM), **5 polí** každý, kolmé (100g)
- Délka přemostění: LM 106.80 m, PM 106.80 m
- Délka mostu: LM 123.87 m, PM 120.57 m
- Délka NK: LM 109.20 m, PM 109.20 m
- Rozpětí NK: **18.00 + 3 × 24.00 + 18.00 m** (oba mosty, v ose)
- Šířka mostu: LM 13.90 m, PM 12.75 m (celková 27.05 m)
- Volná šířka: LM 11.10 m, PM 10.25 m
- Výška nad terénem: LM 5.65 m, PM 5.85 m
- Stavební výška: LM 1.444 m, PM 2.041 m
- Plocha NK: LM 1517.9 m², PM 1392.3 m² (celkem 2910.2 m²)
- **Technologie:** PEVNÁ SKRUŽ v 1 nebo více taktech (TZ §7.2, §7.3.4)
- Geotech. kategorie: **2** (ČSN 73 6133)
- Seismicita: agR = 0.04g, základová půda typ B (ČSN EN 1998-1)

### 1.2 Překážka a staničení

- BK1 (PM) — MK SO106 v km 0.949 186, úhel křížení 52.46g
- BK2 (LM) — MK SO106 v km 0.967 230, úhel křížení 58.34g
- Volná výška: **4.2 m + 0.15 m rezerva** (podjezdná pro MO6.5/30)

### 1.3 Konstrukční prvky a betony

| Prvek | Beton | Exposure | Třída ošetř. | element_type |
|---|---|---|---|---|
| Podkladní beton | C12/15 | X0 | — | `podkladni_beton` |
| Pilotážní šablony | C16/20 | X0 | — | `pilotazni_sablona` |
| **Piloty (vše)** | **C30/37** | **XA2** | — | `pilota` |
| Základ opěr | C30/37 | XF1 | 3 | `zaklady_opery` |
| Základ pilířů | C30/37 | **XA2** | 3 | `zaklady_piliru` |
| Dřík opěr + závěrná zídka + křídla | C30/37 | **XF4** | 3 | `opery_ulozne_prahy` / `zaverna_zidka` / `kridla_opery` |
| Sloupové pilíře | C30/37 | **XF4** | 3 | `driky_piliru` |
| Podložiskové bloky (pilíře) | C35/45 | XF2 | 3 | `podloziskove_bloky` |
| Podložiskové bloky (opěry) | C30/37 | XF4 | 3 | `podloziskove_bloky` |
| **NK (nosná konstrukce)** | **C35/45** | **XF2** | **4** | `mostovkova_deska` |
| Přechodové desky | C25/30 | XF2 | — | `prechodova_deska` |
| Podkladní beton PD | C12/15 | X0 | — | `podkladni_beton` |
| Mostní monolitické římsy | C30/37 | **XF4** | **4** | `rimsa` |
| Schodišťové stupně | C30/37 | XF4 | — | `schodistove_stupne` |
| Silniční obrubníky | ≥C30/37 | XF4 | — | `obruby` |
| Betonové prahy v patě svahu | C25/30 | XF3 | — | `prahy_svahu` |
| Podkladní beton pod dlažbu | C20/25n | XF3 | — | `podkladni_beton_dlazba` |

### 1.4 Piloty — Golden Numbers

**Vše:** Ø **1200 mm** (vrtané, cased, below_gwt), beton C30/37 XA2, ocel B500B

| Podpěra | Most | Délka (m) | Počet | Pata (m n.m.) | Základová spára (m n.m.) |
|---|---|---|---|---|---|
| OP1 | LM | 16.5 | 12 | 411.500 | 428.000 |
| P2 | LM | 16.5 | 14 | 408.400 | 424.900 |
| P3 | LM | 16.5 | 14 | 409.000 | 425.500 |
| P4 | LM | 16.5 | 14 | 408.700 | 425.200 |
| P5 | LM | 16.5 | 14 | 409.500 | 426.000 |
| OP6 | LM | 16.5 | 12 | 413.750 | 430.250 |
| OP1 | PM | 16.5 | 12 | 411.500 | 428.000 |
| P2 | PM | 16.5 | 14 | 408.800 | 425.300 |
| P3 | PM | 16.5 | 14 | 409.200 | 425.700 |
| **P4** | **PM** | **10.5** | 14 | 414.400 | 424.900 |
| **P5** | **PM** | **10.5** | 14 | 415.200 | 425.700 |
| OP6 | PM | 16.5 | 12 | 413.750 | 430.250 |
| **Σ LM** | — | — | **80** | — | — |
| **Σ PM** | — | — | **80** | — | — |
| **TOTAL** | — | — | **160 ks** | — | — |

**Zkoušky integrity (TZ §6.3.3):**
- CHA (ultrazvuk): 2+2 (LM+PM) per podpěra × 6 podpěr = **24 ks** + 3 u křídel SDP = **27 ks CHA celkem**
- Armokoš CHA: 4 trubky dle VL4 210.01
- PIT (odrazová): 160 − 27 = **133 ks**
- Overpouring: +0.50 m (TZ §6.3.3)

**Zvláštnost:** P4 a P5 pravého mostu — kratší piloty (10.5 m) díky vyššímu základu v granitech → **mix pile lengths within one object**.

### 1.5 Nosná konstrukce

- Typ: **spojitý monolitický dodatečně předpjatý dvoutrám**, 5 polí
- Šířka NK LM: 13.10 m, PM 12.25 m (konstrukční)
- Výška trámu: 1.40 m, šířka 1.60–2.20 m
- Osová vzdálenost trámů: LM 6.50 m, PM 5.69 m
- Konzoly: 2.21 m (LM) / 2.15–2.20 m (PM), výška 0.45–0.25 m
- Střední deska: výška 0.45–0.30 m
- Koncové příčníky: 1.25 m
- Podélný sklon NK: 1.16–2.35% (stoupá k Praze)
- Příčný sklon: 6% jednostranný (dostředný)
- Beton: **C35/45 XF2**, výztuž B500B
- **Technologie:** BETONÁŽ V JEDNÉ ETAPĚ NA PEVNÉ SKRUŽI (TZ §6.11.3, §7.3)

### 1.6 Předpětí

- **16 kabelů × 15 lan Y1860S7-15.7** (8/trám) — POZOR: více kabelů, méně lan než SO207
- Napínání: **oboustranné**
- Minimální pevnost pro předpětí: fcm,cyl ≥ **33 MPa**, nejdříve po **7 dnech**
- Kotevní napětí: **1440 MPa**
- PKO: stupeň **PL2** (plastový kanálek, ČSN EN 1992-2 Z2, TKP)

### 1.7 Ložiska, závěry, PKO

- Ložiska: **kalotová**, celkem 12+12 = **24 ks**
- **Pevný bod:** pilíř P4 (posun oproti DUSP, kde byl P2)
- Třída provedení: EXC3 (ČSN 73 6203)
- Polymerbeton pod ložisky: odpor ≥ 1×10¹² Ω·m, pevnost ≥ 50 MPa, tl. 30 mm (min. 15 mm)
- Izolační odpor ložiska: min. 5 kΩ
- **Mostní závěr OP1:** povrchový lamelový druh 8 (T86), dilatace +26/−70 mm
- **Mostní závěr OP6:** jednoduché těsnění spáry druh 8, dilatace +18/−43 mm
- Šířka prostoru mezi NK a závěrnou zídkou: 600 mm
- PKO: životnost **velmi vysoká** (ložiska) / vysoká (závěry, svodidla), C4 lokálně C5
- Ochrana před bludnými proudy: **3. stupeň TP124** (BEZ provaření výztuže, BEZ měření, BEZ DEMZ)

### 1.8 Přechodové oblasti

- Uspořádání dle ČSN 73 6244 obr. B.7 (s přechodovou deskou)
- PD délka **6.0 m**, tloušťka **350 mm**, C25/30 XF2
- Pod PD: podkladní beton 100 mm C12/15 X0
- Štěrkový klín: min. 150 mm ŠDA 0/32, hutnění ID = 0.85
- Rubová drenáž: DN150 SN8, sklon ≥ 3%, podkladní beton C12/15 X0 š. 300 mm
- Zásyp za opěrou: ID = 0.85, zrna max. 90 mm
- Těsnicí vrstva: geosyntetika TP97, pevnost ≥ 20 kN/m, tažnost ≥ 20%, 2× 150+150 mm ŠP

### 1.9 Sledování a monitoring

- **Piloty:** protokol o pilotě, CHA + PIT zkoušky (viz §1.4)
- **Spodní stavba:** 8 ks nivelačních značek na opěrách + 1 ks/pilíř + 4 ks terče náklonu → **24 ks** (dle §6.11.2)
- **Římsy:** 11 × 4 = **44 ks** hřebových nivelačních značek (VL4 509.01)
- **Sedání:** měření po betonáži spodní stavby → po betonáži NK → po dokončení → pravidelně po 3 měs. do provozu → 6 měs. po uvedení → dále při prohlídkách
- **Směrodatná výšková odchylka:** ±1 mm (sedání, deformace NK za provozu), ±3 mm (NK během výstavby)
- **Zatěžovací zkouška:** projektant NEPOŽADUJE (rozhodnutí investora)

---

## Layer 2 — Expected Calculator Outputs

### 2.1 Pilota OP1 LM (12 ks × Ø1200 × 16.5 m, cased, below_gwt)

```
volume_per_pile_design    = π × 0.60² × 16.5 = 18.66 m³
overpouring_loss          = 12 × π × 0.60² × 0.5 = 6.79 m³
total_volume_incl_loss    = 223.9 + 6.79 = 230.7 m³
productivity              = 1.0 pilot/shift (Ø1200 cased below_gwt) — CHECK
drilling_days             = ceil(12 / 1.0) = 12
heads_per_shift           = 2–3 (Ø1200) — CHECK calculator
head_adjustment_days      = ceil(12 / 2) = 6
tech_pause                = 7 d
total_days                = 12 + 7 + 6 = 25
rebar_total_kg_default    = 223.9 × 40 = 8956 (WRONG — real ≈ 18000-22000 for Ø1200 bridge) → BUG #13 confirmed
cha_cost_per_pile         = 2 CHA per podpěra / 12 pilot per OP1 = 2 ks zkoušky → 2 × 40000 = 80000 Kč
pit_cost                  = (12 − 2) × 5000 = 50000 Kč
```

### 2.2 Pilota P4 PM (14 ks × Ø1200 × **10.5 m** — kratší!)

```
volume_per_pile_design    = π × 0.60² × 10.5 = 11.88 m³
total_volume_incl_loss    = 14 × (11.88 + π × 0.60² × 0.5) = 174.2 m³
drilling_days             = ceil(14 / 1.0) = 14
WARNING                   = "Mix pile lengths within object — OP1/P2/P3 = 16.5m, P4/P5 PM = 10.5m → schedule per-podpěra"
```

**Assertion:** Calculator MUST handle mix of pile lengths within single SO — aggregated volume OK, but drilling_days per-group.

### 2.3 Základ opěry OP1 (C30/37 XF1, ~40-50 m³, horizontal)

```
orientation               = horizontal
formwork_system           = Frami Xlife
curing_class              = 3 (spodní stavba)
curing @15°C XF1 class 3  = max(maturity 2d, exposure_floor XF1 = 5d, třída 3 = 4d @ 15-25°C) = 5 d
curing @10°C XF1 class 3  = max(maturity 3d, XF1 floor 5d, třída 3 @ 10-15°C = 7d) = 7 d
curing @5°C XF1 class 3   = max(maturity 4d, XF1 floor 5d, třída 3 @ 5-10°C = 9d) = 9 d
exposure_warning          = NONE (XF1 in zaklady_opery list)
```

### 2.4 Dřík opěry OP1 (C30/37 XF4, ~60 m³, h ≈ 5-6m, vertical)

```
orientation               = vertical
formwork_system           = TRIO / Framax Xlife
curing_class              = 3
curing @15°C XF4 class 3  = max(maturity 1.5d, XF4 floor 7d, třída 3 = 4d) = 7 d ✓
curing @10°C XF4 class 3  = max(maturity 3d, XF4 floor 7d, třída 3 = 7d) = 7 d
curing @5°C XF4 class 3   = max(maturity 4d, XF4 floor 7d, třída 3 = 9d) = 9 d
exposure_warning          = ⚠️ XF4 must be in opery_ulozne_prahy list → BUG #11 from SO-202
```

### 2.5 Sloupové pilíře P2-P5 (C30/37 XF4, h ≈ 4-6m, vertical)

```
orientation               = vertical
formwork_system           = VARIO GT 24 / SL-1 Sloupové
curing_class              = 3
curing @15°C XF4 class 3  = 7 d ✓
exposure_warning          = NONE (XF4 should be in driky_piliru list)
needs_staging             = depends on h — for h<4m not needed, h>4m → 2 záběry
```

### 2.6 Nosná konstrukce LM (C35/45 XF2, ~1400 m³, 5 polí × 24 m max)

```
bridge_deck_subtype       = dvoutram
construction_technology   = fixed_scaffolding (TZ §6.11.3, §7.3)
recommendation            = fixed_scaffolding (max_span=24m < 25-30m threshold)
warning                   = NONE (5 polí × 24 m, pevná skruž přiměřená)
curing_class              = 4 (nosná konstrukce)
curing @15°C XF2 class 4  = max(maturity 1.5d, XF2 floor 5d, třída 4 @ 15-25°C = 9d) = 9 d ✓ CRITICAL
curing @10°C XF2 class 4  = 13 d
curing @5°C XF2 class 4   = 18 d
prestress_ready_days      = 7 d (≥33 MPa, TZ §6.5.2) — FIX from SO-202 bug #7
exposure_warning          = NONE (XF2 in mostovka list)
num_bridges               = 2 → LM + PM warning, samostatné konstrukce
is_prestressed            = true
cable_count               = 16 × 15 lan Y1860S7-15.7 = 240 lan total per most
```

### 2.7 Mostní římsy (C30/37 XF4, class 4)

```
orientation               = horizontal (na NK)
formwork_system           = (specific římsová forma)
curing_class              = 4 (TZ §7.8.3)
curing @15°C XF4 class 4  = max(maturity 1.5d, XF4 floor 7d, třída 4 = 9d) = 9 d
exposure_warning          = NONE (XF4 in rimsa list)
smrsteci_spary            = per 6 m, následně proříznutím
```

---

## Layer 3 — Norm & Technology Cross-Check

### 3.1 Beton XA2 — ochrana, krytí, beton

**Normy:** ČSN EN 206+A2, TKP18

| Kontrola | TZ says | Norm says (B1/B3) | Match |
|---|---|---|---|
| Vodorozpustný CO2 agresivita | středně agresivní XA2 | XA2 vyžaduje C30/37 min., krytí ≥ 50 mm | ✓ C30/37 použit |
| Vliv na beton pilot | XA2 | C30/37 XA2 | ✓ |
| Min. cement content XA2 | nenapsáno | ≥ 320 kg/m³ (ČSN EN 206) | ? RDS |

**Assertion:** `beton_piloty.exposure == XA2 AND beton_piloty.grade >= C30/37`

### 3.2 Ochrana před bludnými proudy (TP124)

**TZ §6.10.3:** 3. stupeň ochranných opatření
**Norm (B6):**
- 3. stupeň = primární + sekundární ochrana + konstrukční opatření
- **BEZ** měřících vývodů a provaření výztuže
- **BEZ** měření během výstavby a na dokončeném mostě
- **BEZ** vypracování DEMZ

**Assertion:** `tp124_level == 3 AND demz_required == False AND rebar_welding == False`

**Porovnání se SO207:** SO207 = **4. stupeň** (provaření + DEMZ), zatímco SO203 = 3. stupeň → **must be reflected in object.protection_level** attribute.

### 3.3 Ošetřování betonu (TKP18 P10, TZ §7.8.3)

**Ručně propočítaný expected curing pro SO203:**

| Prvek | Třída | Exposure | @25°C | @15°C | @10°C | @5°C | XF-floor |
|---|---|---|---|---|---|---|---|
| Piloty C30/37 XA2 | — | XA2 | — | — | — | — | (není ve standardní tabulce XF) |
| Základy opěr C30/37 XF1 | 3 | XF1 | 2.5 | 4 | 7 | 9 | 5 (floor) |
| Základy pilířů C30/37 XA2 | 3 | XA2 | 2.5 | 4 | 7 | 9 | 7 (pozn. TZ §7.8.3) |
| Dřík opěr C30/37 XF4 | 3 | XF4 | 2.5 | 4 | 7 | 9 | **7 (povinné min. 7 dní pro XF4)** |
| Sloupové pilíře C30/37 XF4 | 3 | XF4 | 2.5 | 4 | 7 | 9 | **7** |
| NK C35/45 XF2 | **4** | XF2 | 5 | 9 | 13 | 18 | 5 (floor, ale třída 4 převažuje) |
| Římsy C30/37 XF4 | **4** | XF4 | 5 | 9 | 13 | 18 | **7** |
| PD C25/30 XF2 | 3 | XF2 | 2.5 | 4 | 7 | 9 | 5 |

**Critical rules (z TZ §7.8.3):**
1. Celková doba ošetřování ≥ **5 dnů** pro všechny stavby PK
2. XF3/XF4 vždy ≥ **7 dnů** (přepisuje tabulku)
3. Doba ošetřování ≠ termín odbednění

**Assertion template:**
```python
def assert_curing(element, exposure, class_, temp, expected):
    days = calculate_curing(element, exposure, class_, temp)
    assert days == expected, f"{element} {exposure} třída {class_} @{temp}°C: got {days}, expected {expected}"
```

### 3.4 Technologie výstavby NK — rozpětí vs. metoda

**TP (internal knowledge) + praxe:**

| Rozpětí | Metoda |
|---|---|
| ≤ 24 m | Pevná skruž (úsporné) |
| 24–36 m | Pevná nebo posuvná skruž |
| 36–60 m | Posuvná skruž (MSS) |
| > 60 m | Letmá betonáž, přesuvná skruž |

**SO203 má max. rozpětí 24 m → PEVNÁ SKRUŽ** (TZ §7.2 potvrzuje)

**SO207 má max. rozpětí 36.74 m → POSUVNÁ SKRUŽ** (TZ §7.3.1 potvrzuje)

**SO202 má max. rozpětí 20 m → PEVNÁ SKRUŽ** (TZ potvrzuje)

**Assertion:**
```python
if max_span <= 25:
    assert recommended_tech == "fixed_scaffolding"
elif 25 < max_span <= 40 and num_fields >= 4:
    assert recommended_tech in ["mss", "fixed_scaffolding"]
elif max_span > 40:
    assert recommended_tech == "mss" or "cantilever"
```

**⚠️ BUG #4 from SO-202 applies:** Calculator MSS floor = 25m. SO203 na rozhraní — potřebuje `fixed` preference pro ≤25m. SO207 jasně `mss`. Ale TZ SO207 říká "posuvná nebo pevná skruž" — flexibilita musí být ve výstupu.

### 3.5 Geotechnická kategorie (ČSN 73 6133, B7)

| Kritérium | SO202 | SO203 | SO207 |
|---|---|---|---|
| Délka mostu | ~? | 120 m | 335-350 m |
| Výška nad terénem | ~? | 5.7-5.9 m | 10+ m |
| Geologie | — | složité | **složité** |
| HPV | — | 0.3-8.3 m pod T | 0.5-5.4 m pod T |
| Organické zeminy | — | ne | **ANO (OP1)** |
| **Geotechnická kategorie** | — | **2** | **3** |

**Assertion:** `if organic_soils OR depth_pod_T < 2m OR bridge_length > 200m: geotech_category >= 3`

### 3.6 Ložiska — třída EXC (ČSN 73 6203)

**TZ:** EXC3 (oba mosty SO203, SO207)
**Norm (B2):** mostní ložiska pro silnice I. třídy + dálnice → min. EXC3 ✓

**Assertion:** `lozisko.exc_class == 'EXC3' AND road_category in ['D', 'I']`

### 3.7 PKO atmosféra C4/C5 — ochranný povlak

**Normy:** ČSN EN ISO 12944-2, TKP19B

| Prvek | Životnost | Atmosféra | Expected povlak |
|---|---|---|---|
| Ložiska | velmi vysoká | C4/C5 | **IA + I speciál** (TZ ✓) |
| Mostní závěry | vysoká | C4/C5 | IIIA, konstrukce IIIE, TP86 ✓ |
| Svodidla sloupky | vysoká | C4/C5 | **IIIA** (TZ ✓) |
| Svodidla svodnice | vysoká | C4/C5 | **IIIE** (TZ ✓) |
| Zábradlí | vysoká | C4/C5 | IIIA + ČSN EN ISO 1461 žárové zinkování |

### 3.8 Mostní závěry — typ dle dilatace

**TZ §6.5.4 SO203:**
- OP1: +26/−70 mm → **povrchový lamelový druh 8** ✓ (dilatace ≤ 100 mm → druh 8)
- OP6: +18/−43 mm → jednoduché těsnění druh 8 ✓ (dilatace ≤ 80 mm)

**TZ §6.5.3 SO207:**
- OP1: +87/−139 mm → lamelový druh 8 ✓
- OP10/11: +100/−155 mm → lamelový druh 8 ✓

**Assertion:**
```python
if abs(dilation_neg) + dilation_pos <= 80:
    assert zaver_type == "jednoduche_tesneni"
elif abs(dilation_neg) + dilation_pos <= 250:
    assert zaver_type == "povrchovy_lamelovy_druh_8"
```

---

## Layer 4 — Pydantic Schema Assertions

```yaml
# pytest fixture: golden_SO203.yaml
object:
  so_number: "SO203"
  so_name: "Most na sil. I/6 v km 2,450"
  stavba: "D6 Karlovy Vary – Olšová Vrata"
  stage: "PDPS"

  bridge:
    num_bridges: 2
    num_fields: 5
    span_pattern: [18.00, 24.00, 24.00, 24.00, 18.00]
    max_span: 24.00
    nk_length: 109.20
    nk_width: [13.10, 12.25]  # LM, PM
    bridge_type: "continuous_prestressed_twobeam"
    skewness_grad: 100  # kolmý
    vertical_clearance_m: 4.35  # 4.2 + 0.15 rezerva
    construction_technology: "fixed_scaffolding"

  foundation:
    type: "deep_pile"
    geotech_category: 2
    total_piles: 160
    pile_diameter_mm: 1200
    pile_material: "C30/37_XA2"
    pile_steel: "B500B"
    pile_length_groups:
      - group: "OP1_OP6_all_P2_P3_LM_P4_LM_P5_LM"
        count: 132
        length_m: 16.5
      - group: "P4_P5_PM"
        count: 28
        length_m: 10.5
    overpouring_m: 0.5
    cha_tests: 27
    pit_tests: 133

  concrete_elements:
    - element: "piloty"
      grade: "C30/37"
      exposure: "XA2"
    - element: "zaklady_opery"
      grade: "C30/37"
      exposure: "XF1"
      curing_class: 3
    - element: "zaklady_piliru"
      grade: "C30/37"
      exposure: "XA2"
      curing_class: 3
    - element: "opery_ulozne_prahy"
      grade: "C30/37"
      exposure: "XF4"
      curing_class: 3
      expected_min_curing_15C: 7
    - element: "driky_piliru"
      grade: "C30/37"
      exposure: "XF4"
      curing_class: 3
      expected_min_curing_15C: 7
    - element: "mostovkova_deska"
      grade: "C35/45"
      exposure: "XF2"
      curing_class: 4
      expected_min_curing_15C: 9  # CRITICAL — differs from class 3
    - element: "rimsa"
      grade: "C30/37"
      exposure: "XF4"
      curing_class: 4
      expected_min_curing_15C: 9

  prestressing:
    cables_per_beam: 8
    total_cables: 16  # 8 per trám × 2 trámy
    strands_per_cable: 15
    strand_type: "Y1860S7-15.7"
    tensioning_side: "both"
    min_strength_MPa: 33
    min_age_days: 7
    anchor_stress_MPa: 1440
    pko_level: "PL2"

  bearings:
    type: "kalotova"
    total_count: 24  # 12 + 12
    fixed_point: "P4"
    exc_class: "EXC3"
    polymerbeton_resistivity_Ohm_m: 1e12
    isolation_resistance_kOhm: 5

  mostni_zavery:
    - location: "OP1"
      type: "povrchovy_lamelovy_druh_8"
      dilation_pos_mm: 26
      dilation_neg_mm: -70
    - location: "OP6"
      type: "jednoduche_tesneni_druh_8"
      dilation_pos_mm: 18
      dilation_neg_mm: -43

  pko_atmosphere: "C4"  # lokálně C5
  bludne_proudy_level: 3  # TP124
  demz_required: false
  seismic_zone:
    agR_g: 0.04
    subsoil_type: "B"

  prechodove_oblasti:
    type: "obr_B7_s_deskou"
    pd_length_m: 6.0
    pd_thickness_mm: 350
    pd_concrete: "C25/30_XF2"
    drainage_dn: 150
    zasyp_compaction_ID: 0.85

  monitoring:
    nivelacni_znacky_spodni_stavba: 24
    nivelacni_znacky_rimsy: 44
    mereni_sedani_faze: ["nulove", "po_NK", "po_dokonceni", "pravidelne_3m", "po_6m", "pri_prohlidkach"]
    stredodatna_odchylka_mm: 1
    zatezovaci_zkouska: false

# Expected calculator assertions
calc_asserts:
  - scenario: "NK_curing_15C"
    input: {element: "mostovkova_deska", exposure: "XF2", curing_class: 4, temp_C: 15}
    expected_days: 9
    bug_ref: "#1 from SO-202"

  - scenario: "rimsa_curing_15C"
    input: {element: "rimsa", exposure: "XF4", curing_class: 4, temp_C: 15}
    expected_days: 9
    bug_ref: "#1 from SO-202"

  - scenario: "drik_opery_XF4_15C"
    input: {element: "opery_ulozne_prahy", exposure: "XF4", curing_class: 3, temp_C: 15}
    expected_days: 7
    bug_ref: "#11 from SO-202 (XF4 must be in list)"

  - scenario: "pilota_rebar_default"
    input: {element: "pilota", diameter_mm: 1200, volume_m3: 18.66}
    expected_rebar_kg: 18.66 * 40  # calculator default — WRONG
    real_rebar_kg_estimate: 18.66 * 100  # realistic for Ø1200 bridge pile
    bug_ref: "#13 from SO-202"

  - scenario: "mix_pile_lengths_warning"
    input: {object: "SO203", pile_lengths: [16.5, 10.5]}
    expected_warning: "Mix pile lengths within single SO — schedule per podpěra"

  - scenario: "fixed_point_bearing"
    expected_value: "P4"  # changed from P2 vs DUSP

  - scenario: "tp124_level"
    input: {object: "SO203"}
    expected_level: 3
    expected_demz: false
```

---

## Layer 5 — Bug Audit (inherited + new)

### Inherited from SO-202 (confirmed applicable)

- #1 curing class 4 not implemented → **CRITICAL for NK + římsy**
- #11 XF4 missing from opery_ulozne_prahy list
- #13 pile rebar default 40 kg/m³ → for Ø1200 bridge piles should be ~80-100
- #14 curing class 2/3/4 generally not implemented

### New bugs potentially surfaced by SO203

| # | Category | Issue |
|---|---|---|
| 26 | pile scheduling | **Mix pile lengths within single SO** (16.5m vs 10.5m for P4/P5 PM) — calculator must group by length, not average |
| 27 | TP124 stupeň | `bludne_proudy_level` not a first-class object attribute — affects DEMZ, provaření výztuže, měření — 3 vs 4 **drastically changes cost** |
| 28 | mostní závěry | Type selection (druh 8 lamelový vs jednoduché) based on dilation range — not in calculator |
| 29 | fixed point | Position of pevný bod (P4 for SO203, P5+P6 for SO207) — affects ložiska types (pevné vs pohyblivé) — not modeled |
| 30 | geotech category | Not extracted from TZ → affects pile testing intensity (CHA count), monitoring requirements |
| 31 | prestress | 15 lan × 16 cables (SO203) vs 19 lan × 16 cables (SO207) — cable_size affects injection time, anchoring |
| 32 | stavební výška | LM 1.444 m vs PM 2.041 m — different deck thickness, different volume/m² |

### Priorities

**P0 for SO203:** Curing class 4 (bug #1), exposure XF4 in opery list (#11)

**P1 for SO203:** Mix pile lengths (#26), TP124 level as attribute (#27), fixed point modeling (#29)

**P2 for SO203:** Zaver type selection (#28), geotech category extraction (#30)

---

## Layer 6 — Parser Validation Checklist

For Universal Document Parser, these must be extracted from SO203 PDF:

- [ ] `so_number: "SO203"` from title page
- [ ] `2 samostatné mosty` detection (LM + PM pattern)
- [ ] Span pattern `18.00 + 3 × 24.00 + 18.00 m` → expanded to `[18, 24, 24, 24, 18]`
- [ ] Pile length groups (different for P4/P5 PM)
- [ ] All concrete exposure classes mapped to elements (table in §7.8.1)
- [ ] TP124 level 3 extracted (§6.10.3)
- [ ] Fixed point P4 (§6.5.3)
- [ ] CHA count derivation: `2 + 2 × 6 + 3 = 27` (not trivial — calculator helper needed)
- [ ] Curing class per element (§7.8.3): 3 for spodní stavba, 4 for NK + římsy
- [ ] Zaver type and dilation values per location (OP1 vs OP6)

**Risk flags:**
- ⚠️ Span pattern parsing "18.00 + 3 × 24.00 + 18.00" — regex test needed
- ⚠️ Geotechnický pasport (příloha č. 2) is **separate sub-document** — parser must link it
- ⚠️ Hydrotechnický výpočet (příloha č. 1) has different structure (field-by-field table) — separate schema

---

**End of SO-203 Golden Test. Next: SO-207 (estakáda).**
