# SO-207 D6 Karlovy Vary — Golden Test Data for Calculator Audit

**Source:** TZ PDPS VD-ZDS, VIAPONT s.r.o., Ing. Martin Jaroš (ČKAIT 1005944), srpen 2025
**Object:** Estakáda na sil. I/6 v km 4.450–4.650 (přes Vratský potok + MK SO111)
**Audit date:** TBD
**Knowledge base refs:** B1 (ČSN EN 206+A2), B2 (Eurokódy), B3 (TKP18), B4 (TKP16 Piloty), B5 (TKP19 PKO), B6 (TP124), B7 (ČSN 73 6244), B8 (ČSN 73 6242), B9 (VL4), TP76 (svahy), TP97 (geosyntetika), TP107 (intenzita deště), TP124 (bludné proudy), TP231 (ošetřování), M10 (ŘSD geodet. sledování)

**⚠️ SPECIFICS of SO-207 (different from SO-202, SO-203):**
1. **Asymmetrický most** — LM má 9 polí, PM má 10 polí (různé délky!)
2. **Posuvná skruž** jako primární technologie (vs. pevná v SO203)
3. **Dva průměry pilot** v jednom objektu: Ø1200 (hlavní) + Ø900 (opěrná zeď)
4. **Konsolidační násyp** s geomonitoringem (OP1) — 60 dní, smax = 295 mm
5. **Proměnná šířka NK** 12.24–14.09 m (LM), 12.30–13.30 m (PM)
6. **Proměnná rozpětí polí** — každé pole má jinou délku v ose mostu!
7. **TP124 úroveň 4** (vs. 3 v SO203) — DEMZ + provaření výztuže povinné
8. **PHS + clona proti oslnění** — dodatečné příslušenství
9. **Hydraulické lisy na hlavách pilířů** — rozšíření pro rektifikaci
10. **6 fází výstavby** s převáděním dopravy přes 6. pole PM během stavby

---

## Layer 1 — Extracted Facts (parser target)

### 1.1 Stavba

- D6 Karlovy Vary – Olšová Vrata, SO207 Estakáda na sil. I/6 v km 4.450-4.650
- 2 samostatné mosty (LM + PM), kolmé (100g)
- **LM: 9 polí, PM: 10 polí** ← asymetrie!
- Délka přemostění: LM 306.37 m, PM 338.78 m
- Délka mostu: LM 335.45 m, PM 350.45 m
- Délka NK: LM **310.17 m**, PM **342.58 m**

### 1.2 Rozpětí NK (proměnná!)

**V ose SO101a (hlavní trasa):**
- LM: 27.00 + 7 × 36.00 + 27.00 m
- PM: 27.00 + 8 × 36.00 + 27.00 m

**V ose mostu (reálné kosé vzdálenosti):**
- LM: 27.55 + 36.74 + 36.68 + 36.52 + 36.27 + 36.06 + 35.92 + 35.66 + 26.57 m
- PM: 26.28 + 35.05 + 35.38 + 35.69 + 35.93 + 36.09 + 36.38 + 36.71 + 27.72 m (9 hodnot, ale PM má 10 polí — TZ inconsistency?)

**Assertion:** calculator musí pracovat s **každým polem zvlášť**, ne s průměrem.

### 1.3 Geometrie NK (proměnná!)

- Šířka NK LM: 12.24–14.09 m (proměnná!)
- Šířka NK PM: 12.30–13.30 m (proměnná!)
- Šířka mostu LM: 13.05–14.90 m (s římsami)
- Šířka mostu PM: 12.95–13.97 m
- Celková šířka mostu: 27.40–28.30 m (SDP se mění 0.45–1.40 m)
- Výška trámu: 2.00 m (vs. 1.40 m v SO203 — větší rozpětí!)
- Šířka trámů: 1.95 m, osová vzdálenost 6.30 m
- Konzoly: 2.000 m vnější / 1.37 m vnitřní (LM); 2.00 m / 1.45 m (PM)
- Výška konzol: proměnná 0.25–0.45 m
- Stavební výška: **2.135 m** (LM i PM)
- Podélný sklon v niveletě: **6.0% stoupání** (konstantní)
- Podélný sklon v ose mostu: 5.52–5.92% (LM), 5.60–6.26% (PM)
- **Příčný sklon se překlápí** z +6% na −6% (pole 7 = oblast nulového sklonu!)
- Plocha NK: LM 4246.2 m², PM 4471.6 m² (celkem 8717.8 m²)

### 1.4 Překážky

- BK1 (LM) — potok SO322 v km 0.176 093, úhel 57.82g, Y=847184.469, X=1013023.933
- BK2 (LM) — MK SO111 v km 0.194 144, úhel 61.52g
- BK3 (PM) — potok SO322 v km 0.195 795, úhel 55.37g
- BK4 (PM) — MK SO111 v km 0.176 706, úhel 57.92g
- Volná výška nad potokem: **5.60 m nad Q100**
- Volná výška nad MK: **4.2 m + 0.15 m + min. 2.37 m podjezdné výška**

### 1.5 Geotechnické podmínky (složité!)

- Geotech. kategorie: **3** (složité poměry, délka > 300 m, organické zeminy)
- Nadmořská výška: 530–557 m n.m., svažité území
- Kvartér: 1.0–2.5 m navážky, fluvialní písky + štěrky IIIa, IIIb, IIIc
- **Organické zeminy v podloží OP1 do hl. 7.7 m** (J2088) — vyschlý nebo zavezený rybník!
- Podmáčená oblast: OP1 → P5 (levý most), → P7 (pravý most)
- Granit: zcela zvětralý (R5) → silně zvětralý (R4) → navětralý (R3/R2 = XII)
- **Tektonická porucha ssz-jjv směru** mezi J252/J250 a J255
- HPV: naražená 1.5–5.4 m, ustálená 0.5–5.4 m pod T
- HPV u skalního podloží (P6 LM→, P10 PM→): nezastižena
- Agresivita vody: **XA2** (středně agresivní, CO2)
- Korozní agresivita vůči kovům: **stupeň III-IV** (ČSN 03 8372)
- Seismicita: agR = 0.04g, podloží **A + E** (kombinace!)

### 1.6 Founding — Piloty (MIXED diameters!)

**Hlavní piloty:** Ø **1200 mm**, beton C30/37 XA2, ocel B500B
**Opěrná zeď křídlo SDP u OP10L:** Ø **900 mm**, délka **6 m**, C30/37 XA2

**Podpěry — založení:**

| Podpěra | Most | Založení | Piloty |
|---|---|---|---|
| OP1 | LM+PM | hlubinné | Ø1200 + konsolidační násyp |
| P2-P6 | LM+PM | hlubinné | Ø1200 |
| **P7 LM** | | **plošné** | — (skalní podloží R3) |
| P7 PM | | hlubinné | Ø1200 |
| **P8 LM** | | **plošné** | — (eluvium R3/R2) |
| P8 PM | | hlubinné (v TZ možnost plošné) | Ø1200 |
| **P9 LM** | | **plošné** | — (silně zvětralý R4, R3) |
| P9 PM | | **plošné** | — |
| **P10 PM** | | **plošné** (alt. hlubinné dle PD) | — / Ø1200 |
| **OP10 LM** | | **plošné** | — (R4 + R3) |
| **OP11 PM** | | **hlubinné** | Ø1200 |
| Opěrná zeď u OP10 (SDP) | | **Ø900 × 6 m piloty** | 900 mm ring |

**Rozměry pilot Ø1200 (detail z výkresu "08 - Hlubinné založení" — není v TZ textu):**
Počty a délky nejsou v TZ explicitně uvedeny — **parser musí flag-ovat "reference to drawing 08"** + get data from drawing.

**Ochrana pilot před bludnými proudy:** Provaření výztuže (**TP124 stupeň 4!**)

**Testování:**
- Integrita: všechny piloty
- CHA (ultrazvuk): u vybraných (počty ve výkrese 08)
- Armokoš CHA: dle VL4 210.01

### 1.7 Konsolidační násyp OP1 — SPECIFIC to SO207

**TZ §6.2:**
- Budování 2 měsíce
- Vlastní konsolidace 2 měsíce
- Odtěžení 0.3 měsíce
- **smax = 295 mm v čase 60 dní** od dosypání
- Pravidelný monitoring: horizontální inklinometrie + piezometrické měření pórových tlaků
- Výměna měkkých potočních náplavů za štěrkovitou zeminu nebo hrubozrnný materiál fr. 0/125
- Zlepšení podloží P2: mísením nebo výměnou

**Výpočet sedání OP1 z geotech. pasportu (příloha 2):**
| Fáze | Doba | Sedání |
|---|---|---|
| Fáze 0 (přeložka) | 30 dní | 4 mm |
| Fáze 1 (násyp pravé str.) | +120 d | 58 mm |
| Fáze 1 + 120 d konsolidace | +120 d | 83 mm |
| Fáze 1 + kce vozovky PM | +30 d | 98 mm |
| Fáze 2 (násyp levé str.) | +30 d | 106 mm |
| Fáze 2 + 60 d konsolidace | +60 d | 111 mm |
| Dokončení stavby | +30 d | 117 mm |
| 3 roky po stavbě | +1095 d | 121 mm |
| **Celkové (konec)** | — | **121 mm** |

**Δs dle ČSN 73 6244:** 0 + (121 − 111) − 0 = **10 mm** ✓ (pod limitem 20 mm)

**Assertion:** SO object with `consolidation_required: true` must have monitoring plan + geomonitoring timeline.

### 1.8 Konstrukční prvky a betony

| Prvek | Beton | Exposure | Třída ošetř. | element_type |
|---|---|---|---|---|
| Podkladní beton | C12/15 | X0 | — | `podkladni_beton` |
| Podkladní beton pod drenáž | C12/15 | X0 | — | `podkladni_beton` |
| Pilotážní šablony | C16/20 | X0 | — | `pilotazni_sablona` |
| **Piloty (vše)** | **C30/37** | **XA2** | — | `pilota` |
| Základ opěr + opěrných zdí | C25/30 | **XF1** | 3 | `zaklady_opery` |
| Základ pilířů P2, P3, P4 | C30/37 | **XF3** | 3 | `zaklady_piliru` |
| Základ pilířů P5, P6, P7, P9 | C30/37 | **XA2** | 3 | `zaklady_piliru` |
| Základ pilířů P8, P10P | C30/37 | XF1 | 3 | `zaklady_piliru` |
| Mostní opěry, dříky zdí | C30/37 | **XF4** | 3 | `opery_ulozne_prahy` |
| Sloupové pilíře P2, P8, P9, P10P | **C35/45** | **XF2** | 3 | `driky_piliru` |
| Sloupové pilíře P3, P4, P5, P6, P7 | **C35/45** | **XF4** | 3 | `driky_piliru` |
| **NK (nosná konstrukce)** | **C35/45** | **XF2** | **4** | `mostovkova_deska` |
| Dobetonávka kapes MZ | C30/37 | XF4 | 3 | `dobetonavky` |
| Dobetonávka kapes kotev předpětí | C30/37 | XF4 | 3 | `dobetonavky` |
| Přechodové desky | C25/30 | XF2 | — | `prechodova_deska` |
| Mostní monolitické římsy | C30/37 | **XF4** | **4** | `rimsa` |
| Schodišťové stupně | C30/37 | XF4 | — | `schodistove_stupne` |
| Silniční obrubníky | ≥C30/37 | XF4 | — | `obruby` |
| Betonové prahy v patě svahu | C25/30 | XF3 | — | `prahy_svahu` |
| Podkladní beton pod dlažbu | C20/25n | XF3 | — | `podkladni_beton_dlazba` |

**⚠️ Complex exposure mapping:** Pilíře P3-P7 použity **XF4** (kvůli rozmrazovacím solím + postřik), zatímco P2, P8, P9, P10P jen **XF2**. Parser musí extrahovat per-podpěra.

### 1.9 Předpětí

- **16 kabelů × 19 lan Y1860S7-15.7** (8/trám) — více lan než SO203 (tam bylo 15)!
- Kabely v každém trámu **spojkované v pracovní spáře** (betonáž ve více taktech!)
- Napínání: **jednostranné** (z pracovních spar)
- Min. pevnost: fcm,cyl ≥ **33 MPa**, nejdříve **7 dní** od betonáže
- Kotevní napětí: **1440 MPa**
- PKO: **PL2** (plastový kanálek)

### 1.10 Ložiska, závěry, PKO, DIS-SOS

- Ložiska: **kalotová**, celkem **20 + 22 = 42 ks** (LM + PM)
- **Pevné body: pilíře P5 a P6** ← **2 pevné body!** (vs. 1 v SO203)
- Ložiska kladena do tečny
- EXC3, polymerbeton 30 mm (min. 15 mm)
- **Mostní závěr OP1 (LM+PM):** lamelový druh 8 (T86), dilatace **+87/−139 mm**
- **Mostní závěr OP10 LM / OP11 PM:** lamelový druh 8, dilatace **+100/−155 mm**
- Prostor mezi NK a závěrnou zídkou: **700 mm** (vs. 600 v SO203)
- PKO atmosféra: **C4 lokálně C5**
- **Bludné proudy: 4. stupeň TP124** ← klíčový rozdíl!
  - Primární + sekundární ochrana
  - **Provaření výztuže + vyvedení na povrch**
  - **Měření před/během/po stavbě** (korozní průzkum + izolační odpor polymerbetonu + izol. odpor MZ)
  - **Vypracování DEMZ**

### 1.11 Vybavení mostu

- **Protihluková stěna (PHS) odrazivá výška 3.0 m** na PM od km 4.450 do km 4.670 (SO704)
- **Clona proti oslnění 1.5 m** na LM po celé délce, na PM od km 4.670 do konce
- Konstrukce clony: HEA 120 á 2.0 m, sokl 0.5 m hliníkové lamely, výplň tónovaný materiál + TP104 (ptactvo)
- Svodidla: H3 (W4) vnější, H3 zábradelní vnitřní + plotový nástavec 1.6 m
- Revizní chodník: 0.75 m na vnějších římsách
- Kabelové chráničky: **2×3 ks HDPE 110/94** ve vnitřní římse LM (DIS-SOS)
- **Portál dopravního značení č. 6** na PM nad P7 — rozšíření říms (vnitřní 1900 mm, vnější 3000 mm)
- Odvodnění: MO 500×500 u podpěr, dodatečné v poli 7 (překlápění příč. sklonu!), sběrné DN200 PP/HDPE
- **Meteostanice** u OP1 + 2 chráničky Ø50/41 pro teplotní čidla v poli 2 (SO495)
- Hydraulické lisy — **rozšířená hlava pilíře** pro umístění lisů (rektifikace NK)

### 1.12 Vozovka a izolace

- Třívrstvá vozovka **tl. 135 mm** (vs. 85 mm v SO203!):
  - SMA 11 S 40 mm
  - ACL 16 S 55 mm (ložná vrstva)
  - MA 11 IV 35 mm (litý asfalt)
  - NAIP 5 mm
- **Výztužná skelná textílie 10×10 mm** v litém asfaltu (kvůli sklonu 5.1%)
- Ochrana izolace pod římsami: asf. pás s hliníkovou vložkou + 150 mm přesah
- Konstrukce přístupové rampy k P10P: AC 60 mm + ŠDB 150+150 mm (NÚP D2, TDZ VI)

### 1.13 Postup výstavby (6 fází!)

**Critical sequencing:**
- Fáze I: spodní stavba P6→OP11P + přeložka potoka + SO904A/B + SO111
- Fáze II: spodní stavba P2→P5, betonáž NK PM pole 10→7, demolice stávajícího mostu, **konsolidační násyp OP1**
- Fáze III: spodní stavba OP1, betonáž NK PM pole 6→1
- Fáze IV: přesun skruže na LM, dosypání OP1, SO254 nájezd
- Fáze V: **doprava převedena na PM**, betonáž LM
- Fáze VI: doprava na LM, napojení definitivní vozovky

**Klíčová technologie §7.3:**
- Posuvná skruž s dočasným vymístěním dopravy z 6. do 4. pole
- Variantně pevná skruž (rezerva 2.59 m při podjezdné 4.2 m)
- **6. polem PM** vedena veřejná doprava během fází II-IV → provizorní objezd

---

## Layer 2 — Expected Calculator Outputs

### 2.1 Pilota Ø1200 OP1 LM (TZ: počty ve výkrese, odhad z kontextu 8-12 ks × 16-20 m)

```
volume_per_pile_design    = π × 0.60² × 17 (odhad) = 19.22 m³
overpouring_loss_per_pile = π × 0.60² × 0.5 = 0.566 m³
productivity              = 1.0 pilot/shift (Ø1200 cased below_gwt)
heads_per_shift           = 2 (Ø1200) — CHECK calculator default

⚠️ PARSER FLAG: "Pile counts and lengths reference výkresová příloha 08 — not in TZ text"
⚠️ MUST BE SUPPLIED from drawing or user input
```

### 2.2 Pilota Ø900 opěrná zeď SDP (z TZ §6.4.2)

```
volume_per_pile           = π × 0.45² × 6.0 = 3.82 m³
productivity              = 1.5 pilot/shift (Ø900 cased below_gwt)
count                     = per dilatační celek 6 m, TZ neuvádí počet — odhadem cca 10-15 pilot

⚠️ MIX pile diameters → calculator must aggregate separately:
   - pilot_group_1: Ø1200 (hlavní)
   - pilot_group_2: Ø900 (opěrná zeď)
   Volume, rebar, productivity per group independently.
```

### 2.3 Plošné založení OP10 LM (TZ §6.3, §1.6)

```
foundation_type           = "shallow" (spread footing)
base_concrete             = C25/30 XF1
main_concrete             = C30/37 XF4 (dřík)

⚠️ Calculator MUST support foundation_type enum ["deep_pile", "shallow", "mixed"]
   — SO207 has MIX: OP1 hlubinné, OP10 plošné, opěrná zeď mezi nimi Ø900 piloty
```

### 2.4 Nosná konstrukce LM (C35/45 XF2, 9 polí, 310.17 m, posuvná skruž)

```
bridge_deck_subtype       = dvoutram_variable_width ← NEW subtype needed!
num_fields                = 9 (LM), 10 (PM) — asymmetric!
span_pattern_LM           = [27.55, 36.74, 36.68, 36.52, 36.27, 36.06, 35.92, 35.66, 26.57]
span_pattern_PM           = [26.28, 35.05, 35.38, 35.69, 35.93, 36.09, 36.38, 36.71, 27.72]
                            (⚠️ PM has 9 values in TZ but 10 polí claimed — parser must flag inconsistency)
max_span                  = 36.74 m (LM), 36.71 m (PM)
min_span                  = 26.28 m
deck_width_range_LM       = [12.24, 14.09]  ← variable width
deck_width_range_PM       = [12.30, 13.30]
construction_technology   = "moving_scaffolding"  ← posuvná skruž
taktů                     = multiple (per pole nebo per 2 pole) — TZ §6.5.1 "více taktů"
curing_class              = 4
curing @15°C XF2 class 4  = 9 d ✓ CRITICAL (bug #1 from SO-202)

prestress:
  cables_per_beam         = 8
  strands_per_cable       = 19  ← vs. 15 in SO203
  spojkování              = true, v pracovní spáře
  napínání                = jednostranné
  min_days                = 7
  min_strength_MPa        = 33

warnings:
  - "Asymmetric bridge: LM 9 polí vs PM 10 polí — schedule separately"
  - "Variable deck width: per-pole volume estimate needed"
  - "Posuvná skruž: min 2 taktů, prestress ready per takt"
  - "Příčný sklon se překlápí v poli 7 — odvodnění na obou stranách"

num_bridges               = 2 (LM + PM)
```

### 2.5 Římsy (C30/37 XF4 class 4, variable width 0.80–3.00 m)

```
curing_15C_class4_XF4     = 9 d
total_length_rimsa        = 2 × (310.17 + 342.58) = 1305.5 m (4 římsy, 2 mosty × 2 římsy)

⚠️ VARIABLE WIDTH říms:
  - vnější LM: 1.70 m
  - vnější PM: 1.90 m (kvůli PHS)
  - vnitřní LM: 1.10 m
  - vnitřní PM: 0.80 m
  - vnitřní PM nad P7 (portál): 1900 mm
  - vnější PM nad P7 (portál): 3000 mm

calculator must support per-segment width
```

### 2.6 Ochrana před bludnými proudy (TP124 stupeň 4)

```
tp124_level               = 4
requires_rebar_welding    = true
requires_measurement      = true
  - before_construction   = korozní průzkum (ověřující)
  - during_construction   = polymerbeton + MZ izolační odpor
  - after_construction    = DEMZ complete
requires_demz             = true
additional_cost_estimate  = significant (welding, monitoring, DEMZ) ~5-10% spodní stavby

⚠️ Calculator MUST have tp124_level as first-class attribute
⚠️ Difference vs SO203 (level 3): DEMZ absent there, no welding
```

---

## Layer 3 — Norm & Technology Cross-Check

### 3.1 Technologie vs. rozpětí

| Object | Max span | Expected tech | TZ tech | Match |
|---|---|---|---|---|
| SO202 | ~20 m | fixed_scaffolding | fixed | ✓ |
| SO203 | 24 m | fixed_scaffolding | **fixed** v 1+ taktech | ✓ |
| **SO207** | **36.74 m** | **MSS preferred** | **posuvná (primární), pevná (alt.)** | ✓ TZ flexibility |

**Rule (knowledge base):** rozpětí 25–40 m + ≥4 polí → MSS efektivní; > 40 m → cantilever

**Assertion for SO207:**
```python
assert max_span > 25
assert num_fields_total >= 4  # 9+10 = 19 !
assert "moving_scaffolding" in allowed_techs
assert "fixed_scaffolding" in allowed_techs  # backup per TZ §7.3
```

### 3.2 Ošetřování — tabulka (TKP18 P10 + TZ §7.8.3)

**Expected curing days for SO207 (same rules as SO203):**

| Element | Třída | Exposure | @15°C expected |
|---|---|---|---|
| Piloty | — | XA2 | (XA nepatří do tabulky XF, použije se floor = 5 d pro PK) |
| Základ opěr XF1 | 3 | XF1 | 5 |
| Základ pilířů XA2 | 3 | XA2 | 5 (floor) nebo 7 per TZ pozn. |
| Dřík opěr XF4 | 3 | XF4 | **7** (XF4 min. 7) |
| Sloupové pilíře XF4 | 3 | XF4 | **7** |
| Sloupové pilíře XF2 | 3 | XF2 | 5 |
| **NK C35/45 XF2** | **4** | XF2 | **9** ← CRITICAL |
| **Římsy C30/37 XF4** | **4** | XF4 | **9** (floor 7 overridden by class 4 = 9) |

### 3.3 Konsolidace — ČSN 73 6244 (B7)

**TZ §1.7 dává explicitní limity:**
- Δs ≤ 20 mm (zbytkové sedání po položení stmelených vrstev)
- SO207: Δs = 10 mm ✓ **VYHOVUJE**

**Monitoring dle doporučení IGP:**
- Piezometrické měření pórových tlaků
- Horizontální inklinometrie
- Interval: TZ §6.11.1 "dle projektu geotech. monitoringu"

**Assertion:**
```python
if consolidation_required:
    assert delta_s_mm <= 20, "Limit ČSN 73 6244 §7.1"
    assert monitoring.includes("piezometry")
    assert monitoring.includes("inklinometrie")
```

### 3.4 Stabilita svahů (TP76)

**SO207 přechodové oblasti — stability:**

| Profile | Fs expected | TZ says | OK? |
|---|---|---|---|
| O1 (km 4,390), hrubozrnný násyp | ≥ 1.2 | **Fs = 1.56** | ✓ |
| O11 (km 4,750), hrubozrnný | ≥ 1.2 | **Fs = 1.25** | ✓ (na limitu!) |
| O11 odřez 1:1.75 | ≥ 1.5 | 1.78 | ✓ |

**Warning:** O11 Fs = 1.25 — na limitu. Pokud by násyp byl z jemnozrnných zemin, vyztužení geosyntetiky nutné.

### 3.5 Odvodnění — TP107 (intenzita deště)

**Parametry pro Karlovarsko (TZ Hydrotechnický výpočet):**
- Karlovy Vary: 180 l·s⁻¹·ha⁻¹
- Podbořany: 207
- Mar. Lázně: 198
- Průměr: 195
- **Požadavek ŘSD: 200 l·s⁻¹·ha⁻¹**

**Musí být použito 200** (ne průměr) — důležité pro kontrolu!

**Assertion:**
```python
assert intenzita_deste == 200, "ŘSD requirement, not regional average"
```

### 3.6 PKO atmosféra — konzistence mezi objekty

| Prvek | SO203 | SO207 | Norm |
|---|---|---|---|
| Ložiska (C4/C5) | IA + I speciál | IA + I speciál | ČSN EN ISO 12944-2 ✓ |
| MZ | IIIA + IIIE | IIIA + IIIE | TP86 ✓ |
| Svodidla sloupky | IIIA | IIIA | ✓ |
| Clona | — | IIIA + zinkování ČSN EN ISO 1461 | ✓ (SO207 má PHS) |

### 3.7 Min. krytí pilot XA2 (TKP18, ČSN EN 1992-1-1)

**Requirements:**
- XA2 → krycí vrstva ≥ 50 mm
- S dodatečnou toleranci +10 mm (pro piloty vrtané) → **min. 60 mm**

**Assertion:**
```python
assert pile.concrete_cover_mm >= 60, "XA2 + pile tolerance"
```

---

## Layer 4 — Pydantic Schema Assertions

```yaml
object:
  so_number: "SO207"
  so_name: "Estakáda na sil. I/6 v km 4.450-4.650"
  stavba: "D6 Karlovy Vary – Olšová Vrata"
  stage: "PDPS"
  special_flags:
    - "asymmetric_bridge"       # LM 9 polí vs PM 10 polí
    - "variable_deck_width"
    - "variable_span_per_field"
    - "mixed_foundation_types"  # deep + shallow in one SO
    - "mixed_pile_diameters"    # Ø1200 + Ø900
    - "consolidation_required"
    - "moving_scaffolding"
    - "phs_and_clona"
    - "portal_dopravniho_znaceni"
    - "tp124_level_4"
    - "protected_water_source_zone"  # OP 1. stupně Karlovy Vary

  bridge:
    num_bridges: 2
    num_fields_LM: 9
    num_fields_PM: 10
    span_pattern_LM: [27.55, 36.74, 36.68, 36.52, 36.27, 36.06, 35.92, 35.66, 26.57]
    span_pattern_PM_declared: 10  # TZ claims 10 but lists 9 values — PARSER FLAG
    span_pattern_PM_listed: [26.28, 35.05, 35.38, 35.69, 35.93, 36.09, 36.38, 36.71, 27.72]
    max_span: 36.74
    min_span: 26.28
    nk_length_LM: 310.17
    nk_length_PM: 342.58
    nk_width_range_LM: [12.24, 14.09]
    nk_width_range_PM: [12.30, 13.30]
    total_deck_area: 8717.8
    bridge_type: "continuous_prestressed_twobeam_variable"
    construction_technology: "moving_scaffolding"
    alternative_technology: "fixed_scaffolding"
    skewness_grad: 100
    longitudinal_slope_percent: 6.0
    transverse_slope_flip_field: 7  # ← kritické pro odvodnění
    vertical_clearance_over_water_m: 5.60  # nad Q100
    vertical_clearance_over_road_m: 4.35

  foundation:
    type: "mixed"  # deep + shallow in same SO
    geotech_category: 3
    consolidation:
      required: true
      location: "OP1"
      duration_days: 60
      smax_mm: 295
      delta_s_residual_mm: 10
      monitoring:
        - "piezometry_porove_tlaky"
        - "horizontalni_inklinometrie"
    piles:
      - group: "main_piles"
        diameter_mm: 1200
        material: "C30/37_XA2"
        locations: ["OP1", "P2", "P3", "P4", "P5", "P6", "P7_PM", "P8_PM", "OP11_PM"]
        # Count and length from výkres č. 08 — NOT in TZ text
        source: "drawing_08_hlubinne_zalozeni"
      - group: "opěrná_zeď_sdp"
        diameter_mm: 900
        length_m: 6.0
        material: "C30/37_XA2"
        location: "OP10L_SDP_wing"
    shallow_foundations:
      locations: ["P7_LM", "P8_LM", "P9_LM", "P9_PM", "P10_PM_alt", "OP10_LM"]
    rebar_welding_required: true  # TP124 level 4
    cha_tests: "per_drawing_08"
    pit_tests: "per_drawing_08"

  concrete_elements:
    - element: "piloty"
      grade: "C30/37"
      exposure: "XA2"
    - element: "zaklady_opery"
      grade: "C25/30"
      exposure: "XF1"
      curing_class: 3
    - element: "zaklady_piliru_P234"
      grade: "C30/37"
      exposure: "XF3"
      curing_class: 3
      applies_to: ["P2", "P3", "P4"]
    - element: "zaklady_piliru_P5679"
      grade: "C30/37"
      exposure: "XA2"
      curing_class: 3
      applies_to: ["P5", "P6", "P7", "P9"]
    - element: "zaklady_piliru_P8_P10P"
      grade: "C30/37"
      exposure: "XF1"
      curing_class: 3
      applies_to: ["P8", "P10P"]
    - element: "opery_ulozne_prahy"
      grade: "C30/37"
      exposure: "XF4"
      curing_class: 3
      expected_min_curing_15C: 7
    - element: "driky_piliru_XF2"
      grade: "C35/45"
      exposure: "XF2"
      curing_class: 3
      applies_to: ["P2", "P8", "P9", "P10P"]
    - element: "driky_piliru_XF4"
      grade: "C35/45"
      exposure: "XF4"
      curing_class: 3
      applies_to: ["P3", "P4", "P5", "P6", "P7"]
      expected_min_curing_15C: 7
    - element: "mostovkova_deska"
      grade: "C35/45"
      exposure: "XF2"
      curing_class: 4
      expected_min_curing_15C: 9  # CRITICAL
    - element: "rimsa"
      grade: "C30/37"
      exposure: "XF4"
      curing_class: 4
      expected_min_curing_15C: 9

  prestressing:
    cables_per_beam: 8
    total_cables: 16
    strands_per_cable: 19
    strand_type: "Y1860S7-15.7"
    tensioning_side: "one_sided"
    spojkovani: true
    min_strength_MPa: 33
    min_age_days: 7
    anchor_stress_MPa: 1440
    pko_level: "PL2"

  bearings:
    type: "kalotova"
    total_count: 42  # 20 LM + 22 PM
    fixed_points: ["P5", "P6"]  # ← TWO fixed points!
    exc_class: "EXC3"

  mostni_zavery:
    - location: "OP1_LM_PM"
      type: "povrchovy_lamelovy_druh_8"
      dilation_pos_mm: 87
      dilation_neg_mm: -139
      width_mm: 700  # prostor NK-závěrná zídka
    - location: "OP10_OP11"
      type: "povrchovy_lamelovy_druh_8"
      dilation_pos_mm: 100
      dilation_neg_mm: -155
      width_mm: 700

  pko_atmosphere: "C4"  # lokálně C5
  bludne_proudy_level: 4  # vs 3 in SO203
  demz_required: true
  rebar_welding: true
  monitoring_before_construction: true  # korozní průzkum

  seismic_zone:
    agR_g: 0.04
    subsoil_type: "A_E_combined"  # ← kombinace!

  vybaveni:
    phs:
      present: true
      height_m: 3.0
      length_m: 220  # 4.450 → 4.670
      type: "odrazová"
      so_ref: "SO704"
    clona_osvetleni:
      present: true
      height_m: 1.5
      location: "LM_full + PM_from_4.670"
    portal_dopravniho_znaceni:
      present: true
      location: "PM_over_P7"
      so_ref: "SO120a.3"
    meteostanice:
      present: true
      location: "OP1"
      so_ref: "SO495"
    dis_sos_chraniczky:
      count: 6  # 2×3 HDPE 110/94
      location: "LM_inner_rimsa"
    hydraulicke_lisy_hlava:
      present: true
      purpose: "nk_rektifikace"

  vozovka:
    thickness_mm: 135
    layers:
      - {name: "SMA_11S", thickness_mm: 40}
      - {name: "ACL_16S", thickness_mm: 55}
      - {name: "MA_11_IV", thickness_mm: 35}
      - {name: "NAIP", thickness_mm: 5}
    additional_mesh: true  # skelná textílie 10×10 mm kvůli sklonu 5.1%
    max_slope_percent: 6.0

  construction_phases: 6
  doprava_na_mostě_behem_stavby: true  # 6. pole PM během fází II-IV
  demolice_stavajiciho_mostu: true
  přeložka_potoka: true  # SO322

  prechodove_oblasti:
    type: "obr_B7_s_deskou"
    pd_length_m: 5.25  # ← menší než SO203 (6.0)!
    pd_thickness_mm: 300  # ← menší než SO203 (350)!
    pd_concrete: "C25/30_XF2"

  environmental:
    chko: "Slavkovský les (blízko)"
    chopav_karlovy_vary: "1_ochranné_pásmo_léčivých_zdrojů"  # ← SPECIAL
    aopk_requirements: true  # clona osvětlení je dle AOPK ČR

# Expected calculator assertions
calc_asserts:
  - scenario: "NK_curing_15C_class4"
    input: {element: "mostovkova_deska", exposure: "XF2", curing_class: 4, temp_C: 15}
    expected_days: 9

  - scenario: "rimsa_curing_15C_class4_XF4"
    input: {element: "rimsa", exposure: "XF4", curing_class: 4, temp_C: 15}
    expected_days: 9  # floor 7 < class4@15 = 9

  - scenario: "drik_piliru_P3_XF4"
    input: {element: "driky_piliru", exposure: "XF4", curing_class: 3, temp_C: 15}
    expected_days: 7  # floor XF4

  - scenario: "asymmetric_bridge_schedule"
    input: {so: "SO207", bridges: [{id: "LM", fields: 9}, {id: "PM", fields: 10}]}
    expected_warning: "Asymmetric: schedule per bridge separately"

  - scenario: "variable_span_per_field"
    input: {spans: [27.55, 36.74, 36.68, ...]}
    expected_behavior: "Calculate formwork, concrete, prestress per-field, not average"

  - scenario: "mixed_foundation_types"
    input: {so: "SO207"}
    expected: foundation_type == "mixed"
    behavior: "Pile cost for deep podpěry + shallow cost for P7L/P8L/P9/P10"

  - scenario: "mixed_pile_diameters"
    input: {pile_groups: [{d: 1200}, {d: 900, len: 6.0, loc: "SDP_wing"}]}
    expected: separate_productivity_and_rebar_per_group

  - scenario: "tp124_level_4"
    input: {so: "SO207"}
    expected:
      demz_required: true
      rebar_welding: true
      monitoring_before_and_during_and_after: true
    cost_impact: "+5-10% spodní stavba vs level 3"

  - scenario: "moving_scaffolding_taktov"
    input: {technology: "moving_scaffolding", span_max: 36.74, num_fields: 9}
    expected_taktov: ">=2"
    prestress_per_takt: true  # each takt predepne independently
    cable_spojkování: true  # in pracovní spáře

  - scenario: "consolidation_plan"
    input: {location: "OP1", smax: 295, delta_s: 10}
    expected:
      monitoring_plan_required: true
      piezometry: true
      inklinometrie: true
      delta_s_vyhovuje: true  # 10 <= 20

  - scenario: "transverse_slope_flip_pole7"
    input: {slope_profile: "+6% to -6% via 0% at pole 7"}
    expected:
      odvodnění_obou_stran_v_poli_7: true
      proužky_zapuštěné: true

  - scenario: "karlovy_vary_ochranne_pasmo"
    input: {zone: "1_lecive_zdroje"}
    expected_warning: "Vyžaduje stanovisko Inspekce lázní a zřídel před zahájením"

  - scenario: "intenzita_deste_ŘSD"
    input: {location: "Karlovarsko"}
    expected_value: 200  # not average 195
    source: "TP107 + ŘSD requirement"
```

---

## Layer 5 — Bug Audit (SO207-specific)

### Inherited from SO-202/203

- #1 curing class 4 → critical for NK, římsy
- #11 XF4 missing from opery list → also affects XF4 in driky
- #13 pile rebar default 40 → Ø1200 needs ~80-100
- #14 curing class generally not implemented

### New bugs surfaced by SO207

| # | Category | Issue |
|---|---|---|
| 33 | bridge structure | **Asymmetric bridges** — LM 9 polí + PM 10 polí must be modeled separately, not as 1 avg |
| 34 | bridge deck | **Variable deck width** per-pole — volume computation must be per-segment |
| 35 | bridge deck | **Variable span per-field** — current calc probably uses 1 span value, must support array |
| 36 | foundation | **Mixed foundation types** in 1 SO (deep + shallow) — enum "deep_pile" insufficient |
| 37 | piles | **Mixed pile diameters** in 1 SO (Ø1200 main + Ø900 retaining wall) — must split groups |
| 38 | consolidation | **Konsolidační násyp** not modeled — affects schedule (+60 dní), monitoring costs |
| 39 | NK technology | **Moving scaffolding (posuvná skruž)** rules — taktov, cable spojkování, per-takt prestress |
| 40 | TP124 level | Level 4 vs 3 — binary flag not enough, affects welding, DEMZ, monitoring cost |
| 41 | fixed bearings | **Multiple fixed points** (P5 + P6) — current model probably assumes 1 |
| 42 | vybavení | **PHS + clona + portál** as first-class attributes — affect vnější římsa width, kotvení, zatížení |
| 43 | vozovka | **135 mm třívrstvá** vs 85 mm dvouvrstvá (SO203) — layer schema needs flexibility |
| 44 | odvodnění | **Překlápění příčného sklonu** in pole 7 — dual-sided drainage, nulový spád = hydrotechnický problém |
| 45 | zona CHOPAV | **1. ochranné pásmo** Karlovy Vary — regulatory flag affects approvals |
| 46 | fáze výstavby | **6 fází with traffic on bridge during construction** — schedule complexity 10× higher |
| 47 | rozměry prechodových desek | SO207 má PD 5.25 m × 300 mm, SO203 má 6.0 m × 350 mm — **per-object, not global default** |
| 48 | tektonická porucha | Mentioned in geotech. passport — affects pile design per-location but not extracted |
| 49 | span inconsistency | TZ SO207 claims PM 10 polí but lists 9 span values — **parser must flag arithmetic check** |

### Priorities

**P0 for SO207:**
- Asymmetric bridges (#33)
- Variable widths + spans (#34, #35)
- TP124 level 4 support (#40)
- Curing class 4 (#1 inherited — CRITICAL)

**P1 for SO207:**
- Mixed foundation types (#36)
- Mixed pile diameters (#37)
- Konsolidační násyp in schedule (#38)
- Moving scaffolding taktov (#39)

**P2 for SO207:**
- Multiple fixed bearings (#41)
- Vybavení (PHS, clona, portál) (#42)
- Vozovka layer schema (#43)
- Variable transverse slope drainage (#44)
- CHOPAV flag (#45)

---

## Layer 6 — Parser Validation Checklist

Hardest extraction challenges SO207 vs. SO202/203:

- [ ] **Asymmetric fields** — LM 9 vs PM 10 in table — cross-check with span values count
- [ ] **Variable width parsing** — "12.24 – 14.09 m" pattern in text
- [ ] **Variable span per-field** — list of 9 values with units
- [ ] **Exposure class per-podpěra** — requires structured table parsing (not flat list)
- [ ] **Multiple fixed points** — "pilíře P5 a P6" pattern (not single value)
- [ ] **TP124 úroveň** extraction — text contains number but in specific context
- [ ] **Konsolidační násyp parameters** — duration, smax, Δs from calculation appendix
- [ ] **PHS + clona** — separate sub-objects with parameters (height, length, type)
- [ ] **Phase count** — "V. Fáze" roman numerals + content summary
- [ ] **Sub-document links** — Příloha 1 (hydrotech), Příloha 2 (geotech passport) — must fetch separately
- [ ] **Drawing references** — "výkres č. 08" for pile counts/lengths not in text
- [ ] **Span pattern formula vs list** — "27.00 + 7 × 36.00 + 27.00" → expand array
- [ ] **Slope flip field** — "pole 7" reference in drainage context
- [ ] **Protected zone flag** — "1. ochranné pásmo přírodních léčivých zdrojů" literal match

**Risk flags:**
- ⚠️ **Inconsistency in span count PM**: 10 polí declared, 9 values listed → arithmetic validation fail → parser MUST flag, not silently accept
- ⚠️ **Geotech. pasport as appendix** has its own tables, geotypes, parameters — separate Pydantic model
- ⚠️ **Hydrotechnický výpočet** per-pole — 19 identical calculations (LM pole 1-9, PM pole 1-10) — repetitive, must de-duplicate
- ⚠️ **Multi-pass parsing** needed: references between TZ, geotech, hydrotech appendices

---

## Layer 7 — Comparative Matrix (SO-202 / SO-203 / SO-207)

Purpose: ensure calculator handles the range of bridge types in Karlovy Vary project.

| Attribute | SO-202 | SO-203 | SO-207 |
|---|---|---|---|
| Mosty (LM+PM) | 2 | 2 | 2 **asymmetric** |
| Počet polí | 6+6 | 5+5 | **9+10** |
| Max rozpětí | ~20 m | 24 m | **36.74 m** |
| Délka NK | ~120 m | 109 m | **310-343 m** |
| Šířka NK | ~10.85 m | 13.10/12.25 m | **12.24-14.09 m proměnná** |
| Typ NK | dvoutrám | dvoutrám | dvoutrám **variable** |
| Technologie NK | pevná skruž | pevná skruž | **posuvná skruž** |
| Taktů | 1 | 1+ | **více (per pole)** |
| Piloty Ø | 900 | 1200 | **1200 + 900 mix** |
| Počet pilot | 122 | **160** | TBD (z výkresu) |
| Délka pilot | 7.5-13 m | 10.5, 16.5 | variable (z výkresu) |
| Mix pile lengths? | ne | ANO (P4/P5 PM 10.5) | ANO (expected) |
| Mix foundation types? | ne | ne | **ANO (deep + shallow)** |
| Konsolidace? | ne | ne | **ANO (OP1, 60 dní)** |
| Geotech. kat. | 2 | 2 | **3** |
| Pevný bod | ? | P4 | **P5 + P6** |
| Kabely × lana | ? | 16 × 15 | 16 × **19** |
| Napínání | jednostr.? | **oboustranné** | **jednostr. + spojkování** |
| TP124 stupeň | ? | **3** | **4** |
| DEMZ | ? | ne | **ANO** |
| Provaření výztuže | ? | ne | **ANO** |
| PHS | ne | ne | **ANO 3.0 m** |
| Clona | ne | ne | **ANO 1.5 m** |
| Portál značení | ne | ne | **ANO (nad P7 PM)** |
| Vozovka | 85 mm | 85 mm | **135 mm třívrstvá** |
| Fáze výstavby | ? | 6 | **6 + doprava na mostě** |
| Demolice stávajícího? | ? | ne | **ANO** |
| Ochranné pásmo | ne | ne | **1. OP léčivých zdrojů** |
| MZ dilatace max | ? | 70 mm | **155 mm** |
| Atmosféra PKO | C4 | C4/C5 | C4/C5 |

**Key takeaway:** SO-207 is the **most complex** object in the project — if the calculator handles SO-207 correctly, it handles SO-203 and SO-202 as subsets.

---

**End of SO-207 Golden Test.**

## Cross-test execution plan

```bash
# Pytest invocation
pytest tests/golden/ -v \
  --golden-dir=test-data/tz/ \
  --objects=SO202,SO203,SO207 \
  --check-layers=1,2,3,4  # extraction + calculator + norms + schema
```

Expected outcomes:
- Layer 1: parser extracts all facts — 95%+ F1 score required
- Layer 2: calculator matches golden outputs within ±1% (volumes) / ±0 days (curing)
- Layer 3: every ČSN/TP reference cross-checked, deviations flagged
- Layer 4: Pydantic schema round-trip validates
