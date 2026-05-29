# Výpočtové stopy — objemy a plochy

Cross-reference: TZ D.1.1 ↔ výkres řezu + fasády ↔ ChatGPT v0 + v1 ↔ vypočtená hodnota.

## Baseline geometrie (z výkresů)

| Veličina | Hodnota | Zdroj |
|---|---|---|
| Délka uliční fasády | 25.010 m | Výkres fasády (1000 + 6780 + 9450 + 6780 + 1000) |
| Hřeben | +11.180 m | Výkres řezu |
| Stávající římsa | +6.680 m | Výkres řezu |
| Vikýř ridge | +9.270 m | Výkres fasády (na řezu +9.170 — drobná nekonzistence) |
| Vikýř hrana | +8.650 m | Výkres detail vikýře |
| Podkroví podlaha | +6.350 m | Výkres řezu |
| Sklon hlavní střecha | 36.2° | TZ + výkres |
| Sklon vikýř | 7.0° | TZ + výkres |
| Půdorysná šířka uliční části | 4.41 m | Výkres řezu (4410 mm dimension) |
| Plocha hlavní střecha (sloped) | 154 m² | TZ + ChatGPT (`plocha střechy 154 m²`) |
| Plocha vikýře (sloped, 1 ks) | 25.6 m² | Výkres fasády (`plocha vikýře 25,6 m²` × 2) |
| Rozměr vikýře | 6.780 × 3.780 m | Výkres fasády |
| Plocha vikýře 2 ks | 51.2 m² | 2 × 25.6 |
| Užitná plocha 2 bytů | 127.03 m² | TZ §2 (BYT 34 64.48 + BYT 35 62.55) |
| Půdorys uliční části | 110.3 m² | 4.41 × 25.01 |

---

## 1. Tesařský rozpočet — krov

### 1.1 Krokve 100×180 mm

```
HLAVNÍ STŘECHA (sklon 36.2°):
  délka jedné krokve = 154 m² / (25.01 m × 1 krokev/m) = 6.16 m
  počet krokví = 25.01 m / 1.0 m rozteč = 25 ks
  celkem délka = 25 × 6.16 = 154.0 bm
  objem dřeva = 154 × 0.018 m² = 2.77 m³

VIKÝŘE (sklon 7°, 2 ks):
  šířka sloped = 3.78 / cos(7°) = 3.78 / 0.9925 = 3.81 m
  počet krokví per vikýř = 6.78 / 1.0 = 7 ks  → 2 vikýře = 14 ks
  celkem délka = 14 × 3.81 = 53.34 bm
  objem dřeva = 53.34 × 0.018 = 0.96 m³

CELKEM KROKVE: 207 bm, 3.73 m³
```

**Confidence:** 0.75 (rozteč 1.0 m je z TZ; profil 100×180 z TZ — ale statika může předepsat odlišný)

### 1.2 Pozednice 140×160 mm

```
2 × délka uliční fasády = 2 × 25.01 = 50.02 bm
profil 140×160 = 0.0224 m²
objem = 50.02 × 0.0224 = 1.12 m³
```

**Confidence:** 0.8 (profil 140×160 je standardní pro pozednici, ale TZ explicitně neuvádí)

### 1.3 Latě + kontralatě

```
LATĚ 50×40 pro bobrovku (hlavní střecha 154 m²):
  rozteč latí ~330 mm (3 latě/m sloped délky)
  počet latí = 154 m² / 0.33 m = 467 bm
  objem = 467 × (0.05 × 0.04) = 0.93 m³

KONTRALATĚ 50×40 nad krokvemi (1 kontralať na krokev):
  počet = 25 ks (hl. střecha) × 6.16 + 14 ks (vikýře) × 3.81 = 154 + 53.3 = 207 bm
  → ale kontralať se obvykle počítá 1× per krokev = ~154 bm pro hl. střecha + 53 bm pro vikýře
  CELKEM = 207 bm — ale obvykle se zaokr. na 154 bm pro hl. střechu jen
  
  Konservativně: 154 bm hl. + 53 bm vikýře = 207 bm
  objem = 207 × (0.05 × 0.04) = 0.41 m³

LATĚ 50×60 mm — větraná mezera vikýře (51.2 m²):
  rozteč 600 mm (2 latě/m)
  počet = 51.2 / 0.6 = 85 bm
  objem = 85 × (0.05 × 0.06) = 0.26 m³

CELKEM LATĚ + KONTRALATĚ:  759 bm,  1.60 m³
```

### 1.4 Bednění

```
HLAVNÍ STŘECHA, prkno tl. 20 mm (skladba pos. 5):
  154 m² × 0.020 m = 3.08 m³

VIKÝŘE, OSB tl. 25 mm (skladba pos. 3 — pod plech):
  51.2 m² × 0.025 m = 1.28 m³

VIKÝŘE, Steico Universal nebo prkno tl. 25 mm (skladba pos. 6 — pod izolaci):
  51.2 m² × 0.025 m = 1.28 m³

CELKEM BEDNĚNÍ: 5.64 m³
```

### 1.5 Trámky 60×60 mezi krokvemi (pro 80 mm izolace)

```
plocha celkem 205.2 m² / rozteč 1.0 m = 205 bm
objem = 205 × (0.06 × 0.06) = 0.74 m³
```

### 1.6 Podbití přesahu střechy

```
TZ: podbití š do 0.8 m, hoblovaná prkna na pero a drážku
délka přesahu (odhad ze štítů a okapů): 100 bm × 0.8 m š × 0.025 tl. = 2.0 m³

⚠ v1 mělo 105 m³ × 8190 = 859 950 Kč → REÁLNÉ 2.5 m³ (s nadměrkem 25 %) × 8190 = 20 475 Kč
   úspora: 839 475 Kč v jediné chybě
```

### 1.7 Celkem řezivo

```
krokve              3.73 m³
pozednice           1.12 m³
latě 50×40 + kontralatě  1.34 m³
latě 50×60 vikýř    0.26 m³
trámky 60×60        0.74 m³
bednění 20 mm hl.   3.08 m³
OSB 25 mm vikýř     1.28 m³  (alternativa: prkno řezivo)
Steico Universal    1.28 m³
podbití             2.50 m³
────────────────────────────
CELKEM ŘEZIVO:     15.33 m³
```

Pro impregnaci se konzervativně použije ~8 m³ (krokve + pozednice + latě + trámky, ne bednění/Steico/OSB které mají vlastní úpravu).

---

## 2. Ocel — zámečnické konstrukce

### 2.1 2× U100 u hřebene

```
TZ: „2× U100 u hřebene" (pravděpodobně střední vaznice + vrcholová)
ChatGPT poznámka: „pokud po celé délce hřebene"

Délka odhad: 2 × 25.01 m = 50.02 bm
Profil U100 (= UPN 100): 10.6 kg/m
Hmotnost: 50.02 × 10.6 = 530 kg = 0.53 t
```

**⚠ NEJISTÉ — statika může předepsat jiný profil, jinou délku, méně/víc kusů**

### 2.2 2× U120 v zalomení vikýřů

```
ChatGPT: „2× U120 v zalomení / podpoře"
TZ neuvádí přesnou polohu, ale logicky:
  - v zalomení každého vikýře (na hraně mezi sklonem 7° a 36.2°)
  - délka cca = délka vikýře 6.78 m × 2 (pro každý vikýř po obou stranách zalomení) × 2 vikýře = 27.12 bm
  - profil UPN 120: 13.4 kg/m
  - hmotnost: 27.12 × 13.4 = 363 kg = 0.36 t

Alt. interpretace: 2× U120 = nárožní profily mezi vikýři a bobrovkou (přidružení vaznice k vikýři)
  → délka 4× 3.81 = 15.24 bm × 13.4 = 204 kg

Pro v2 použito konzervativní:  0.36 + nadrezerva → 0.72 t
```

**⚠ NEJISTÉ — bez statiky pouze odhad**

### 2.3 Sloupky pod vaznice

```
Odhad: 6 ks × 100 kg = 0.6 t (různé délky a profily)
```

### 2.4 IPE 100 nadpraží

```
TZ: „Jako nadpraží jsou navrženy ocelové profily IPE 100 mm"
2 dveřní otvory × 1.5 m × 8.1 kg/m × 2 (oboustranně) = 48.6 kg + spojovací = 60 kg
```

### 2.5 Celkem ocel

```
2× U100              0.53 t
2× U120              0.72 t  
Sloupky              0.60 t
IPE 100 nadpraží     0.06 t
─────────────────────
CELKEM:              1.91 t
```

---

## 3. Suť — demolice

### 3.1 Skladba demolice po vrstvách

```
HLAVNÍ STŘECHA (154 m²):
  bobrovka:       154 × 45 kg/m² = 6.93 t  (vč. starých latí lehce nadhodnoceno)
  staré latě + bednění (cca 1.5 m³ × 500): 0.75 t (uvažováno jako součást krovu)

STARÝ KROV (vaznicový):
  uvažováno ~10 m³ řeziva × 500 kg/m³ = 5.0 t

ATIKA NADEZDÍVKA + HORNÍ ŘÍMSA:
  délka 25.01 m × výška ~1.5 m × tl. 0.3 m = 11.25 m³
  cihla plná × 1800 kg/m³ = 20.25 t

STARÁ PODLAHA PODKROVÍ (110.3 m² půdorysu):
  beton mazaniny tl. 50:  0.05 × 110.3 = 5.52 m³ × 2400 = 13.2 t
  podkladový beton tl. 20: 0.02 × 110.3 = 2.21 m³ × 2400 =  5.3 t
  násyp tl. 70:           0.07 × 110.3 = 7.72 m³ × 1500 = 11.6 t
  2× záklop tl. 50:       0.10 × 110.3 = 11.03 m³ × 500 =  5.5 t  (dřevo)
  polystyren tl. 40:      0.04 × 110.3 = 4.4 m³ × 25 =     0.11 t
  lepenka + folie:                                          0.05 t

DEMONTÁŽ STAVAJÍCÍCH 6 STŘEŠNÍCH OKEN:                     0.30 t

CELKEM:
  ┌─────────────────────────────────────────┐
  │ keramika (17 01 03):           6.93 t   │
  │ cihla (17 01 02):             20.25 t   │
  │ beton (17 01 01):             18.50 t   │
  │ dřevo (17 02 01):              9.00 t   │
  │ násyp smíšený (17 09 04):     11.60 t   │
  │ plast/sklo:                    0.46 t   │
  │ ─────────────────────────────────────── │
  │ TOTAL:                        ~54.0 t   │
  └─────────────────────────────────────────┘

v1 mělo 10.646 t — chybí ~43 t (~80 % suti chybělo!)
```

**Pozn.:** v rozpočtu v2 se uvádí celkové množství 54 t pro vnitrostaveništní dopravu + odvoz, ale skládkovné se ÚČTUJE PO KÓDU ODPADU:
- 17 01 03 keramika 2520 Kč/t × 6.93 = 17 463 Kč
- 17 01 02 cihla — předpokládá se stejný kód jako keramika (17 01 03 cihla + taška) — položka v Excel sloučena → 26.93 t × 2520 = 67 864 Kč
- 17 01 01 beton 850 Kč/t × 18.5 = 15 725 Kč
- 17 02 01 dřevo 1450 Kč/t × 9 = 13 050 Kč
- (násyp v rámci doprava + odvoz, skládkovné záleží na svozové firmě)

---

## 4. Zdivo — Porotherm

### 4.1 Vikýře — Porotherm T Profi 440 mm

```
PER VIKÝŘ (6.78 × 3.78 m):
  Čelní stěna:      šířka 6.78 m × výška 2.49 m (od +6.68 do +9.17) = 16.88 m²
                    minus okenní otvory (2 × 1.2 × 1.4 = 3.36 m²) = 13.52 m²
                    POZN: pro výkaz Porotherm se obvykle účtuje brutto, otvory se nepoctají

  Boční stěny (2 ks): průměrná výška 3.5 m (proměnná od 2.49 do 4.5 m)
                    2 × 3.78 × 3.5 = 26.46 m²

  Plocha za vikýř:  16.88 + 26.46 = 43.34 m²

CELKEM 2 VIKÝŘE: 2 × 43.34 = 86.68 m²
Objem zdiva: 86.68 × 0.44 = 38.14 m³ Porotherm T Profi
```

**Confidence:** 0.75 (geometrie z výkresu; výška boční stěny jen průměr — přesné by chtělo půdorys vikýře)

### 4.2 Mezibytová stěna AKU 200 mm

```
Předpoklad: mezi BYT 34 a BYT 35 ve směru kolmém na hřeben
Délka: 4.41 m (půdorysná šířka uliční části)
Výška: 3.0 m (od podlahy podkroví po hřeben/strop)
Plocha: 13.2 m²
Objem: 2.64 m³
```

### 4.3 Hygienické přizdívky 250 mm + příčky 200 mm

```
Hygienické přizdívky (instalační, koupelny + WC):
  4 koupelny + 2 WC = 6 prostorů
  průměrně 2 bm × 2.4 m výška = 4.8 m²/prostor
  celkem 28.8 m²

Vnitřní bytové příčky:
  2 byty × 3+kk → každý byt cca 15 bm příček × 2.6 m výška = 39 m²/byt
  celkem 78 m²

  ⚠ Bez půdorysu pouze odhad — ověřit
```

---

## 5. SDK + suchá podlaha Fermacell

### 5.1 SDK podhled (TZ + skladba pos. 9-10)

```
Plocha celé střechy zatepleené: 154 + 51.2 = 205.2 m²
Skladba: rošt 50 mm + GKB/GKF 12.5 mm = 62.5 mm tloušťky systému
```

### 5.2 SDK předstěny + opláštění ocelových konstrukcí

```
Odhad: 2 byty × 45 m² = 90 m² (koupelny + WC + opláštění U-profilů)
```

### 5.3 Suchá podlaha Fermacell (skladba z výkresu řezu)

```
Skladba (z TZ str. 3 + výkres detail):
  1. OSB záklop tl. 20-24 mm        ← podklad
  2. Voštinový systém Fermacell tl. 60 mm
  3. Minerální izolace tl. 20 mm
  4. 2× Fermacell deska 2E35 tl. 25 mm (= 12.5 + 12.5)
  5. Finální vrstva tl. 15 mm:
     - keramická dlažba lepená (v koupelnách, WC, zádveří, chodbě), nebo
     - plovoucí podlaha na podložce (v obytných místnostech)

Plocha: 127.03 m² (užitná plocha 2 bytů)
  ├─ Dlažba odhad 40 m² (koupelny + WC + zádveří + chodby)
  └─ Plovoucí 87 m² (obyt. místnosti + ložnice + pokoj)
```

---

## 6. Omítky + nátěry

### 6.1 Vnitřní omítka sádrová (TZ str. 4 — „Sádrový hladký štuk")

```
Vnitřní stěny v bytech:
  - obvodové (uliční štít + štítové stěny + komínová stěna od bytů):
    cca 2× (čelní 6.78 + boční 3.78×2) × výška 2.5 = 73 m²
  - vnitřní bytové stěny: 2 × 60 m² (odhad) = 120 m²
  - komínová stěna interiér: 25 × 2.5 = 62 m²
  - mezibytová z obou stran: 2 × 13.2 = 26 m²
  
  CELKEM cca 280 m² (konservativní odhad)
```

### 6.2 Vnější omítka vikýřů — vápenocementová

```
Plocha čelních + bočních stěn vikýřů: 86.7 m² (z 4.1)
Materiál: vápenocementová s armovací tkaninou + finální v odstínu fasády
```

### 6.3 ETICS — nová římsa nad uliční fasádou

```
TZ: „Nad fasádou směrem do ulice bude provedena nová římsa vytvarovaná pomocí zateplovacího systému"
Délka: 25.01 m
Pruh římsy odhad: 0.5 m výšky
Plocha: 12.5 m²
```

**Confidence: 0.5 — detail římsy z PD chybí**

---

## 7. Klempířské — Cu plech (TZ str. 4)

### 7.1 Žlaby + svody + okapnice

```
TZ: „klempířské výrobky zbývajících střech budou proveden z Cu plechu"
TZ: „dešťové svody do dvora opatřeny nátěrem v odstínu fasády"

Žlab podokapní polokruhový Cu ø 150:
  délka uliční fasády: 25.01 m → zaokr. 25 bm

Svody dešťové Cu ø 100:
  2 svody × výška domu cca 14 m + zaústění = 2 × 15 = 30 bm
  (svody do dvora — patrně na 2 stranách objektu)

Okapnice Cu rš 250:
  25 bm uliční fasáda
```

### 7.2 Oplechování komínů + světlíku

```
5 komínů × průměrný plášť oplechování cca 3.6 m² (4 strany × výška nad střechou ~0.8 m) = 18 m²
Světlík napojení: cca 8 bm + 3 m² oplechování
```

### 7.3 Lemování vikýřů (kritický detail)

```
TZ: „úžlabí na plech" mezi vikýřem a bobrovkou (vodotěsný detail)
Bočni lemování: 2 vikýře × 2 strany × 3.81 m = 15.24 bm
Čelní lemování (okapnice vikýře): 2 × 6.78 = 13.56 bm
Oplechování ostění a parapetů 4 vikýřových oken: cca 32 bm
```

---

## 8. VRN — vedlejší rozpočtové náklady

| Položka | Odhad | Zdroj |
|---|---|---|
| ZS — buňky, sklady, plot, energie/voda | 95 000 Kč | Standard pro středně-velkou rekonstrukci |
| Koordinátor BOZP | 48 000 Kč | Standard pro vícepatrový objekt |
| Geodetické zaměření před + po | 28 000 Kč | DSPS |
| Průzkum pevnosti zdiva 1.PP + 1.NP | 35 000 Kč | **TZ §7 EXPLICITNĚ POŽADUJE** |
| Statický dozor + AD | 25 000 Kč | Vícepodlažní rekonstrukce |
| Pasportizace okolních objektů | 22 000 Kč | Vnitroblok + sousední BD |
| DSPS všechny profese | 18 000 Kč | Stavební zákon |
| **CELKEM** | **271 000 Kč** | |

v1 mělo VRN = **0 Kč** (prázdná položka jen jako placeholder).
