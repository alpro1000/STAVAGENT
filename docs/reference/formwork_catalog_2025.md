# Katalog bednění — PERI + DOKA 2025
# Pro STAVAGENT kalkulátor — výběr systému dle rozměrů elementu

**Zdroje:**
- PERI Výrobní program bednění 01/2025 (756 str.) — přímá extrakce
- PERI product pages peri.com/peri-usa.com — max. tlak betonu
- DOKA školení zákazníků 2026 (Ing. Martin Sosna) — římsové systémy
- PERI nabídka D6 Nové Strašecí 2018 — pronájmové sazby
- DirectIndustry product specs — cross-check

**Poznámka k tlaku betonu:**
Všechny hodnoty max. tlaku jsou dle DIN 18218:2010-01 (ekvivalent ČSN EN 12812).
PERI Výrobní katalog max. tlak neobsahuje — je v separátních Tabulkách PERI.
Hodnoty zde jsou z produktových listů PERI na peri.com/peri-usa.com.

**Poznámka k Nhod/m²:**
Primární zdroj = methvin.org data v repozitáři STAVAGENT.
Hodnoty "reference working time" níže jsou z produktových listů PERI (orientační).

---

## 1. STĚNOVÁ BEDNĚNÍ (pro pilíře, opěry, stěny)

### 1.1 MAXIMO MX 18 300 / 360

```
system_id:         "PERI_MAXIMO"
vendor:            "PERI"
type:              "rámové stěnové"
max_pressure_kN_m2: 80        # z peri.com produktového listu; 81 kN/m² pro 2.70m panely dle DIN 18218
max_height_m:      3.6        # standardní 3.0m, s MX18 system 3.6m (pouze prodej, ne nájem)
standard_height_m: 3.0        # nejběžnější výška
panel_widths_m:    [0.30, 0.45, 0.60, 0.90, 1.20, 2.40]
plast_thickness_mm: 18
anchor_system:     "MX Tie (jednostranné), DW15/DW20"
tvar:              ["přímý", "roh", "šachta"]
nhod_m2:           [0.15, 0.38]  # reference working time z PERI — 50% méně než tradiční
notes: |
  - Největší panel: 360×240 cm, 473 kg
  - Panel 360×120 cm: 271 kg
  - MX Tie — kotvení z jedné strany, o 40% méně kotev
  - Tloušťka stěny 15–60 cm (nastavitelné na kotvě)
  - Kompatibilní s TRIO (stejné BFD příslušenství)
  - Pronájem: standardně do 3.0m; 3.6m panely jen prodej
  
vhodné_pro:        ["stena", "opery_ulozne_prahy", "zakladovy_pas", "driky_piliru"]
```

### 1.2 TRIO (270 / 330)

```
system_id:         "PERI_TRIO"
vendor:            "PERI"
type:              "rámové stěnové"
max_pressure_kN_m2: 67.5      # dle DIN 18218 linie 7 hydrostatický; 56 kN/m² konstantní; 81 kN/m² linie 6
max_height_m:      3.3        # standardní panely 3.30 × 2.40 m
standard_height_m: 2.7        # nejčastější výška
panel_heights_m:   [0.30, 0.60, 0.72, 0.90, 1.20, 2.40, 2.70, 3.30]
panel_widths_m:    [0.30, 0.60, 0.72, 0.90, 1.20, 2.40]
plast_thickness_mm: 18
anchor_system:     "DW15, DW20"
tvar:              ["přímý", "roh", "kloubový roh", "šachta"]
nhod_m2:           [0.2, 0.5]  # orientační
notes: |
  - Panel TR 330×240: 405 kg; TR 330×120: 196 kg; TR 270×240: ~350 kg
  - Kompatibilní s MAXIMO (BFD příslušenství)
  - Pro sloupy: TRIO TRS (viz sekce 2.2)
  - Pro šachty: šachtový díl TSE 330/270
  - Rozteč konzol: dle výšky a tlaku
  
vhodné_pro:        ["stena", "opery_ulozne_prahy", "zakladovy_pas", "driky_piliru"]
```

### 1.3 VARIO GT 24 (nosníkové)

```
system_id:         "PERI_VARIO_GT24"
vendor:            "PERI"
type:              "nosníkové stěnové (projekt-specific)"
max_pressure_kN_m2: 60        # standard panels; projekt-specific konfigurace = neomezeno dle statiky
max_height_m:      999        # neomezeno (šplhací přestavba)
tvar:              ["přímý", "libovolný průřez", "kruhový oblouk R≥4m"]
nhod_m2:           [0.4, 0.8]  # orientační (více práce než rámové)
nosníky_GT24_délky_m: [0.90, 1.20, 1.50, 1.80, 2.10, 2.40, 2.70, 3.00, 3.30, 3.60, 3.90, 4.20, 4.50, 4.80, 5.10, 5.40, 5.70, 6.00]
nosník_hmotnosti_kg:  [5.3, 7.1, 8.9, 10.6, 12.4, 14.2, 15.9, 17.7, 19.5, 21.2, 23.0, 24.8, 26.6, 28.3, 30.1, 31.9, 33.6, 35.4]
závory_SRU_U120_délky_m: [0.72, 0.97, 1.22, 1.47, 1.72, 1.97, 2.22, 2.47, 2.72, 2.97, 3.47, 3.97, 4.47, 4.97, 5.47, 5.97]
notes: |
  - Nosníkový rošt GT 24: MULTIFLEX pro stropy, VARIO pro stěny — stejné nosníky
  - Projekt-specific: tlak, výška, kotvení navrhuje statik PERI
  - Šplhací systém: ACS, SKE nebo přestavba jeřábem
  - Pro velké pilíře h>6m — šplhací varianta
  - Standard panels: 60 kN/m² dle DIN 18218, Tabulka 3, linie 7
  
vhodné_pro:        ["driky_piliru", "opery_ulozne_prahy", "stena", "podzemni_stena"]
```

### 1.4 RUNDFLEX (kruhové pro oblouky)

```
system_id:         "PERI_RUNDFLEX"
vendor:            "PERI"
type:              "rámové kruhové (obloukové)"
max_pressure_kN_m2: 60        # z directindustry.com
min_radius_m:      1.0        # vnitřní poloměr ≥ 1.0m (v katalogu PERI CZ: ≥ 4.0m pro výrobní program — ověřit)
panel_heights_m:   [0.60, 1.20, 1.80, 2.40, 3.00, 3.60]
panel_widths_ext_m: [0.85, 1.28, 2.50]
plast_thickness_mm: 21
notes: |
  - Min. poloměr z katalogu CZ: 4.0m (větší plocha);
    dle directindustry (globální PERI): 1.0m vnitřní poloměr
  - Závěs 700 kg při úhlu ≤15°
  - Rychlá změna poloměru pomocí vřeten a šablon
  - Pro kruhové nádrže, silá, opěry s obloukem
  
vhodné_pro:        ["opery_ulozne_prahy", "nadrz"]
```

### 1.5 DOMINO (základní systém)

```
system_id:         "PERI_DOMINO"
vendor:            "PERI"
type:              "rámové stěnové (základní)"
max_pressure_kN_m2: 60        # dle DIN 18218, obdobné TRIO
max_height_m:      2.5        # panel výška 2.50m
tvar:              ["přímý", "roh"]
notes: |
  - Jednodušší a levnější než TRIO
  - Pro nižší nároky na povrch a výšku
  - Panel D 250×100, D 250×75, D 250×50, D 250×25
  
vhodné_pro:        ["zakladovy_pas", "stena"]
```

### 1.6 DUO polymer (lehké)

```
system_id:         "PERI_DUO"
vendor:            "PERI"
type:              "polymerové stěnové"
max_pressure_kN_m2: 40        # odvozeno z kotvení DW15 (90kN) a rozteče; orientační
max_height_m:      2.5        # panel 135cm, kombinovatelné
panel_heights_m:   [0.15, 0.30, 0.60, 0.75, 0.90, 1.35, 2.50]  # 2.50 = 135+135+60+30...
hmotnost_panel_135x90: 24.9   # kg (č.výr. 128280)
notes: |
  - Plastové panely — lehké, čisté, pro agresivní prostředí
  - Pro sloupy: polymerové sloupové bednění DUO (sekce 2.4)
  - Spínací kotva DUO: DW15 (90 kN)
  - Omezené pro vysoký boční tlak
  
vhodné_pro:        ["zakladovy_pas", "stena"]  # nízké konstrukce
```

### 1.7 Tradiční (místní) bednění

```
system_id:         "TRADICNI"
vendor:            "Místní"
type:              "tradiční tesařské"
max_pressure_kN_m2: 999       # neomezeno — dimenzuje tesař dle potřeby
max_height_m:      999        # neomezeno
nhod_m2:           [1.0, 2.5]  # orientační — více práce než systémové
notes: |
  - Řezivo + překližka
  - Vždy dostupné jako fallback
  - Ekonomické pro malé objemy a atypické tvary
  - Neomezený tlak ani výška — ale pracnost vyšší
  
vhodné_pro:        ["all"]  # fallback pro každý element
```

---

## 2. SLOUPOVÁ BEDNĚNÍ

### 2.1 QUATTRO (čtvercové, malé)

```
system_id:         "PERI_QUATTRO"
vendor:            "PERI"
type:              "sloupové čtvercové"
prurez_min_cm:     20         # 20×20 cm
prurez_max_cm:     60         # 60×60 cm
prurez_modul_cm:   5          # nastavení po 5 cm
panel_heights_m:   [0.35, 0.275, 0.125, 0.05]  # skládají se pro celkovou výšku
max_height_m:      3.5        # panel 350 cm
hmotnost_panel_350: 199       # kg
anchor:            "Čep Ø20, Závlačka"
notes: |
  - Plastová deska přišroubovaná zezadu
  - Bod zavěšení 1,0 t
  - Pro pozemní stavby — sloupy
  - Pro mostní pilíře malého průřezu
  
vhodné_pro:        ["sloup", "driky_piliru"]  # malé průřezy
```

### 2.2 TRIO TRS (čtvercové, velké)

```
system_id:         "PERI_TRIO_TRS"
vendor:            "PERI"
type:              "sloupové čtvercové (větší)"
prurez_min_cm:     20         # 20×20 cm
prurez_max_cm_small: 75       # panel TRS 270×90 → sloupy do 75×75 cm
prurez_max_cm_large: 105      # panel TRS 120×120 → sloupy do 105×105 cm
panel_heights_m:   [0.60, 0.90, 1.20, 2.70, 3.30]
max_height_m:      3.9        # dle PERI UK: "columns of various dimensions and heights of up to 3.9m"
anchor:            "DW15 (90 kN), Upínák TRS"
notes: |
  - Kompatibilní se systémem MAXIMO/TRIO (BFD kupler, stabilizátory MX/TR)
  - Pro pozemní i mostní aplikace (malé a střední pilíře)
  
vhodné_pro:        ["sloup", "driky_piliru"]
```

### 2.3 SRS (kruhové sloupy)

```
system_id:         "PERI_SRS"
vendor:            "PERI"
type:              "sloupové kruhové"
prumer_min_cm:     25         # Ø 25 cm
prumer_max_cm:     120        # Ø 120 cm
prumer_modul_cm:   5          # po 5 cm: 25, 30, 35, ... 120
panel_heights_m:   [0.30, 1.20, 2.40, 3.00]  # výšky půlkruhů — skládají se
max_sloupeni_m:    99         # neomezeno skládáním
notes: |
  - Půlkruhové díly: 2 kusy = 1 kruh
  - Díly Ø 25–70 cm: standardní; Ø 75–120 cm: zvětšená sestava
  - Pro mostní kruhové pilíře (dříky)
  - Šplhací adaptér pro velké výšky
  
vhodné_pro:        ["sloup", "driky_piliru"]  # kruhový průřez
```

### 2.4 DUO polymer sloupový

```
system_id:         "PERI_DUO_SLOUP"
vendor:            "PERI"
type:              "sloupové polymerové"
panel_heights_m:   [0.75, 1.35]  # DMP panely
notes: |
  - Pro jednoduché sloupy nízkých pozemních staveb
  
vhodné_pro:        ["sloup"]
```

---

## 3. ŘÍMSOVÁ BEDNĚNÍ

### 3.1 Římsové bednění T — konzolový systém (DOKA) / VGK konzola (PERI)

```
system_id:         "DOKA_RIMS_T"
vendor:            "DOKA / PERI VGK"
type:              "konzolové římsové"
delka_mostu_max_m: 150        # optimální ≤50m najednou, do 150m s přemísťováním
rimsa_vyska_max_cm: 100       # VGK sloupek 139 + nástavec 40 = pro výšku 60–100 cm
rimsa_sirka_min_cm: 8         # b = 8 cm (DOKA bednění T)
rimsa_sirka_max_cm: 60        # b = 60 cm (DOKA bednění T)
konzola_rozteč_cm: [80, 180]  # nastavitelná rozteč konzol a = 80–180 cm (DOKA T)

# PERI VGK komponenty dle výšky římsy:
peri_vgk_sloupky:
  VGK_70:   {vyska_max_cm: 60, pouziti: "omezený průjezdný profil", hmot_kg: 11.9, c_vyr: "134161"}
  VGK_110:  {vyska_max_cm: 60, pouziti: "standardní", hmot_kg: 17.3, c_vyr: "124404"}
  VGK_139:  {vyska_min_cm: 60, vyska_max_cm: 100, pouziti: "velká římsa", hmot_kg: 22.0, c_vyr: "124427"}
  nastavec_40: {pouziti: "doplněk k VGK 139 pro 60-100 cm", hmot_kg: 4.5, c_vyr: "124360"}

# DOKA komponenty:
doka_konzola_T: {hmot_celkem_kg: 52, subkomponenty: ["Konzola 0.80m 22kg", "Nosník 1.40m 16kg", "Svěrka 0.40m 10kg", "Zábradlí 1.00m 4kg"]}
doka_uklon_max_deg: 15        # přizpůsobení úklonům ±15°

kotvení_hloubka_mm: 125       # dle Z-21.6-1764 (PERI VGK)
kotvení_pri_rekonstrukci: "Kotevní šroub M16-M24×50 (č.129637) do vrtání Ø22mm"

pronájem_PERI_2018: {nájem_Kč_bm_měsíc: 138.31, ztratné_Kč_bm: 62.50}  # aktualizovat +45% inflace
pronájem_odhad_2025: {nájem_Kč_bm_měsíc: 200, ztratné_Kč_bm: 90}

vhodné_pro:        ["rimsa"]
```

### 3.2 Římsový vozík TU (DOKA) — závěsný pro oblouky

```
system_id:         "DOKA_RIMS_TU"
vendor:            "DOKA"
type:              "římsový vozík závěsný"
delka_mostu_min_m: 150        # ekonomicky výhodné od 150m
poloměr_min_m:     250        # vhodné pro R ≥ 250 m
sekce_delka_m:     4          # vozíkové jednotky po 4m
takt_max_delka_m:  24         # max 6 jednotek × 4m = 24m
takty_tyden:       2          # standardní rychlost z DOKA školení 2026
vhodné_rekonstrukce: true
pozn: "Vyšší stupeň předmontáže, rychlá de/montáž"
vhodné_pro:        ["rimsa"]
```

### 3.3 Římsový vozík T (DOKA) + VGB (PERI)

```
system_id:         "DOKA_RIMS_T_VOZIK"
vendor:            "DOKA / PERI VGB"
type:              "římsový vozík převěšený"
delka_mostu_min_m: 150        # ekonomicky výhodné od 150m
takt_max_delka_m:  5          # obvyklé takty po 5m max
takty_tyden:       2          # standardní rychlost
vyzaduje_protizavazi: true    # prostor na horním povrchu mostovky

# PERI VGB komponenty:
peri_vgb:
  kolejnice_VGB_100: {delka_m: 1.0, hmot_kg: 41.3, c_vyr: "116291"}
  kolejnice_VGB_150: {delka_m: 1.5, hmot_kg: 52.2, c_vyr: "116297"}
  koleckovy_pojezd:  {hmot_kg: 18.0, c_vyr: "114535"}
  hydraul_navijak:   {hmot_kg: 81.0, c_vyr: "131361"}
  hydraul_agregat:   {hmot_kg: 109.0, c_vyr: "109766"}

vhodné_pro:        ["rimsa"]
```

---

## 4. STROPNÍ BEDNĚNÍ / MOSTOVKA (skruž)

### 4.1 MULTIFLEX GT 24

```
system_id:         "PERI_MULTIFLEX"
vendor:            "PERI"
type:              "nosníkové stropní"
nosníky:           "GT 24 — stejné jako VARIO"  # délky 0.9–6.0m
max_zatizeni_kN_m2: 50        # orientační dle konfigurace
notes: |
  - Pro mostovky na pevné skruži
  - Nosníkový rošt GT24: pronájem 65 Kč/m²/měsíc (2018 D6 nabídka)
  - Kombinovat s věžemi ST 100 nebo ROSETT

vhodné_pro:        ["mostovkova_deska", "stropni_deska"]
```

### 4.2 Podpěrné věže ST 100

```
system_id:         "PERI_ST100"
vendor:            "PERI"
type:              "podpěrné věže"
unosnost_na_nohu_kN: 100      # ST100: 100 kN/noha
pronájem_2018_Kč_m3_měsíc: 31  # z nabídky D6
notes: |
  - Základní rám ST 100: 16.6 kg (č.výr. 019900)
  - Nástavce po 1m výšky = 4 ks/m
  - Průmyslová podlaha UDG 25×100: dov. p = 6.0 kN/m²
  - Kombinovat s nosníkovým roštem GT24 pro mostovku

vhodné_pro:        ["skruz_mostovky"]
```

### 4.3 PERI UP ROSETT FLEX (podpěrné věže lešení)

```
system_id:         "PERI_ROSETT"
vendor:            "PERI"
type:              "modulové lešeňové věže"
pronájem_2018_Kč_m3_měsíc: [100, 200]  # 100 Kč/m³ standardní, 200 Kč/m³ pro DUN (z nabídky D6)
notes: |
  - Pro překlenutí nerovného terénu (svah, DUN)
  - Kombinovatelné s HEB překlenovacími nosníky

vhodné_pro:        ["skruz_mostovky", "podpora_skruz"]
```

---

## 5. ROZHODOVACÍ MATICE — výběr dle elementu a parametrů

```
# Logika: system.max_pressure >= tlak_betonu AND system.max_height >= vyska_bedeni

def select_formwork(element_type, vyska_m, sirka_m, tlak_kN_m2, prurez="obdelnik"):
  
  # ŘÍMSЫ (vždy konzolové/vozíkové — nevolí se dle tlaku)
  if element_type == "rimsa":
    delka = input.celkova_delka_mostu_m
    vyska_rimsy = input.vyska_rimsy_cm
    if delka <= 150:
      return "DOKA_RIMS_T"  # konzoly
    elif delka > 150 and poloměr >= 250:
      return "DOKA_RIMS_TU"  # vozík TU
    else:
      return "DOKA_RIMS_T_VOZIK"  # vozík T
  
  # KRUHOVÉ sloupy/pilíře
  if prurez == "kruhový":
    if prumer_cm <= 120:
      return "PERI_SRS"
    else:
      return "TRADICNI"  # SRS max Ø120, větší = tradiční nebo VARIO
  
  # ČTVERCOVÉ sloupy (pozemní stavby)
  if element_type in ["sloup"] and vyska_m <= 3.9:
    if prurez_cm <= 60:
      return "PERI_QUATTRO"
    elif prurez_cm <= 105:
      return "PERI_TRIO_TRS"
    else:
      return "TRADICNI"
  
  # STĚNY, PILÍŘE, OPĚRY (obdélníkové)
  if vyska_m <= 3.0 and tlak_kN_m2 <= 60:
    return "PERI_TRIO"       # standardní
  elif vyska_m <= 3.0 and tlak_kN_m2 <= 80:
    return "PERI_MAXIMO"     # vyšší tlak
  elif vyska_m <= 3.6:
    return "PERI_MAXIMO"     # s MX18 systémem
  else:
    return "PERI_VARIO_GT24"  # >3.6m → vždy VARIO (šplhací)

  # Tradiční = vždy dostupné jako fallback
  fallback: "TRADICNI"
```

---

## 6. SOUHRN MAX. TLAKŮ (pro filtr katalogu)

| Systém | Max. tlak kN/m² | Zdroj |
|--------|----------------|-------|
| MAXIMO MX18 | **80** | peri.com produktový list; 81 kN/m² pro 2.70m panely |
| TRIO 270/330 | **67.5** (hydrostat.) / 56 (konst.) / 81 (line 6) | peri.com |
| VARIO GT 24 | **projekt-specific** (standard panely 60) | scribd tech sheet |
| RUNDFLEX | **60** | directindustry.com |
| DOMINO | **60** | analogie TRIO/DIN 18218 |
| DUO polymer | ~**40** | orientační z kotevního systému |
| SRS kruhové | **60** | dle PERI info; přesnější z Tabulek PERI |
| QUATTRO | **80+** | dle kotevního systému M20 (90 kN zápora) |
| TRIO TRS | **80+** | dle DW15 kotvení (90 kN) |
| Tradiční | **∞** | fallback — bez omezení |

---

## 7. ORIENTAČNÍ NHOD/m² (FALLBACK — primární: methvin.org v repozitáři)

| Systém | Nhod/m² montáž | Nhod/m² demontáž | Poznámka |
|--------|---------------|-----------------|----------|
| MAXIMO | 0.15–0.38 | 0.10–0.20 | z PERI produktového listu |
| TRIO | 0.20–0.50 | 0.12–0.25 | orientační |
| VARIO GT24 | 0.40–0.80 | 0.25–0.40 | složitější montáž |
| RUNDFLEX | 0.30–0.60 | 0.20–0.30 | ruční nastavení poloměru |
| SRS kruhové | 0.35–0.70 | 0.20–0.35 | skládání půlkruhů |
| QUATTRO | 0.25–0.50 | 0.15–0.25 | jednoduchá montáž |
| TRIO TRS | 0.25–0.50 | 0.15–0.25 | - |
| VGK římsová konzola | 0.40–0.80 | 0.25–0.40 | kotvení do mostovky |
| VGB římsový vozík | 0.20–0.35 | 0.10–0.20 | vysoký stupeň předmontáže |
| Tradiční | 1.00–2.50 | 0.50–1.20 | tesařská práce |

**VAROVÁNÍ:** Nhod hodnoty jsou orientační fallback. Primárním zdrojem jsou methvin.org data
scrapovaná do repozitáře STAVAGENT. Vždy preferuj methvin data pokud existují.

---

## 8. PRONÁJMOVÉ SAZBY (PERI CZ — orientační, 2025)

Základní sazby z nabídky D6 Nové Strašecí 2018 + inflační korekce ~+45%:

| Systém | Sazba 2018 | Odhad 2025 | Jednotka |
|--------|-----------|-----------|---------|
| Bednění říms (konzoly GT) | 138 Kč | ~200 Kč | bm/měsíc |
| Ztratné říms (kónusy DW15) | 63 Kč | ~90 Kč | bm (prodej) |
| Nosníkový rošt GT24 | 65 Kč | ~95 Kč | m²/měsíc |
| Překližka (nájem, smrk 21mm) | 62 Kč | ~90 Kč | m²/měsíc |
| Překližka (prodej, TOPOL 21mm) | 210 Kč | ~305 Kč | m² |
| ST100 podpěrné věže | 31 Kč | ~45 Kč | m³/měsíc |
| ROSETT FLEX věže | 100–200 Kč | ~145–290 Kč | m³/měsíc |
| HEB300 dl.6m nosníky | 900 Kč | ~1305 Kč | ks/měsíc |

**Pro VGB, VARIO, MAXIMO, TRIO, SRS — sazby jsou projekt-specific.**
**Kalkulátor nechá pole ceny prázdné, uživatel doplní aktuální nabídku.**

---

*Generováno: duben 2026*
*Zdroje: PERI katalog 01/2025 (extrakce), DOKA školení 2026, peri.com, directindustry.com*
*Revize: při změně katalogu PERI nebo DOKA*
