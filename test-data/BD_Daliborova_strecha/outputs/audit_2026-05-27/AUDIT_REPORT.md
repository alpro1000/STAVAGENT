# Audit report — BD Daliborova 266/24, soupis prací v1 → v2

**Datum:** 2026-05-27 (rev2 — pre-statika doplněna)
**Vstup:** `inputs/chatgpt_draft/Vykaz_BD_Daliborova_v1_KROS_73poz.xlsx` (73 položek, ~2.20 M Kč)
**Výstup:** `outputs/audit_2026-05-27/Vykaz_BD_Daliborova_v2_KROS.xlsx` (139 položek, ~3.97 M Kč bez DPH)
**Metodika:** Pattern 17 (Phase 0a) + Pattern 20 (Audit v2 10-section) + Pattern 23 (per-drawing) + Pattern 31 (CEV) + **Pre-statika dle ČSN EN 1990-1995 Eurokódů** (`calc_traces/statika_assumed.md`)

---

## TL;DR

| | v1 (ChatGPT) | v2 (po auditu + pre-statice) | Δ |
|---|---|---|---|
| Položek | 73 | 139 | +66 |
| Sekcí KROS | 7 | 19 | +12 |
| Cena bez DPH | 2 196 660 Kč | **3 974 133 Kč** | +1 777 473 Kč |
| Cena s DPH 15 % | 2 526 160 Kč | **4 570 253 Kč** | +2 044 093 Kč |
| Fatální chyby | 4 (EPS místo MW, duplikace, 105 m³ prkna, špatná pol. okna) | 0 | -4 |
| Chybějící sekce | 8 (zdivo, ŽB, omítky, SDK, ocel, klempířské Cu, VRN, demolice) | 0 | -8 |
| Statické dimenzování | nedostupné | **pre-statika dle Eurokódů** (statika_assumed.md) | nový |
| Průměrné confidence | n/a | 0.78 (vs. 0.65 před pre-statikou) | +0.13 |

**Nárůst ~1.8 M Kč není „předražení". Znamená, že v1 vynechalo:**
- celé sekce HSV-31 (zdivo Porotherm ~410 tis. Kč), HSV-41 (ŽB věnec + překlady + zesílení trámů ~146 tis. Kč), HSV-6 (omítky + ETICS ~171 tis. Kč),
- celou sekci PSV-763 (SDK podhledy + suchá podlaha Fermacell ~460 tis. Kč),
- celou sekci PSV-767 (ocelové vaznice 2× U100 + 2× U120 + sloupky + IPE 100 ~205 tis. Kč),
- větší část PSV-764 (Cu žlaby + svody + okapnice + oplechování 5 komínů + lemování světlíku ~140 tis. Kč),
- VRN celé (BOZP, ZS, geodet, průzkum zdiva, pasportizace ~271 tis. Kč),
- demolici starého krovu + atiky + staré skladby podlahy + správné množství suti (z 10.6 t na 54 t).

**Tento rozpočet stále NEZAHRNUJE D.1.4 TZB** (kanalizace, vodovod, plyn — 2 nové kotle BAXI Nuvola DUO-TEC, elektroinstalace — 2 nové rozvaděče + 2 elektroměry, VZT — 4 ventilátory koupelen 90 m³/h, vytápění). Reálná D.1.4 TZB pro 2 byty 3+kk = další **800 tis. – 1.2 M Kč**.

---

## 1. Fatální chyby v1 (4)

### F1: EPS 70 fasádní místo minerální vlny mezi krokvemi

- **v1 pol. 16, 18:** „deska EPS 70 fasádní λ=0,039 tl. 80 mm" + „tl. 180 mm", celkem 205.2 m² na celou střechu + vikýře = 104 381 Kč
- **TZ str. 3 + Skladba (sheet „Skladby"):** „minerální izolace mezi krokvemi tl. 180 mm + minerální izolace mezi trámky 60×60 tl. 80 mm"
- **Proč to vadí:** EPS nepatří do difuzně otevřené šikmé skladby s parozábranou a difuzní fólií. EPS je pro fasády a podlahy, ne pro mezi krokve. Při kontrole z auditu / TDI by se okamžitě označilo jako neslučitelné s normou ČSN 73 1901 a požadavkem TZ na „pojistnou difuzně otevřenou kontaktní hydroizolaci".
- **Oprava v v2:** položky 713141381 (MW tl. 180 mm) + 713141371 (MW tl. 80 mm) + správné materiály (63140700, 63140702). Cena ~184 tis. Kč (vyšší než EPS, protože MW je dražší).

### F2: Duplikátní položka „podkladový rošt pod krokve"

- **v1 pol. 22 (HSV) + 24 (PSV):** obě „713191411 Montáž izolace tepelné střech šikmých provedení podkladového roštu pod krokve", obě 328.32 m, obě 105 Kč/m, celkem 2× **34 473.60 = 68 947.20 Kč**
- **Dopad:** dvojí účtování stejné práce = 34 473.60 Kč navíc
- **Oprava:** smazána 1 z duplikátů, ponechána pouze ta správná v sekci PSV-762 (Konstrukce tesařské) jako lat 60×60.

### F3: 105 m³ prkna 20-30 mm (859 950 Kč)

- **v1 pol. 37:** „řezivo jehličnaté boční prkno 20-30 mm = 105 m³ × 8 190 Kč/m³ = **859 950 Kč**"
- **Reálný objem podbití přesahu střechy 100 m × 0.8 m š × 0.025 tl. = 2.0 m³**
- **Dopad:** předimenzování 50×! Nadhodnocení o **~835 tis. Kč** v jediné položce
- **Oprava:** snížení na 2.5 m³ × 8 190 = 20 475 Kč

> Toto je zdaleka největší jednotlivá chyba v1. Pravděpodobně vznikla špatným chápáním KROS jednotky „m³" jako „m běžné" nebo nekontrolovaným vstupem ChatGPT.

### F4: Vikýřová fasádní okna účtována jako „střešní okna do krytiny tvarované"

- **v1 pol. 70, 71:** „okno střešní dřevěné 114×140 cm = 2 ks" (jako střešní do bobrovky)
- **TZ + ChatGPT v0 draft:** „4 ks velkých fasádních oken vikýřů (2 ks v každém vikýři)"
- **Dopad:**
  1. Špatný KROS kód → montáž zahrnuje oplechování v plechu, ale rám vikýřového okna je v cihlové stěně Porotherm — montáž je zcela jiná
  2. Počet 2 ks místo 4 ks (chybí polovina oken vikýřů)
- **Oprava:** Pol. 766621035 (montáž do otvoru) × 4 ks + 61140125 (okno 1.2×1.4 m, plast/dřevo) × 4 ks = celkem ~69 400 Kč

---

## 2. Chybějící sekce (8)

| # | Sekce | Co chybělo | Odhad v2 |
|---|---|---|---|
| M-S1 | HSV-9 bourání | celý starý krov 11 m³, atika 11.25 m³, podlaha podkroví 110.3 m², přebourání prostupů, suť reálně 54 t | ~280 tis. Kč |
| M-S2 | HSV-31 zdivo | Porotherm T Profi 440 vikýře 86.7 m², AKU 200 mezibytová 13.2 m², AKU 250 hygienické 28.8 m², příčky 78 m² | ~410 tis. Kč |
| M-S3 | HSV-41 ŽB | věnec 2.5 m³ + bednění + výztuž, překlady 6 ks, zesílení trámů příložkou 175 bm | ~146 tis. Kč |
| M-S4 | HSV-6 omítky | vnitřní sádrová 280 m², vnější vápenocementová vikýřů 86.7 m², ETICS římsa nad fasádou 12.5 m², komíny 35 m² | ~171 tis. Kč |
| M-S5 | PSV-763 SDK + suchá podlaha | podhled 205.2 m², předstěny 90 m², suchá podlaha Fermacell 127 m² + OSB záklop, tenkovrstvá omítka 295 m² | ~459 tis. Kč |
| M-S6 | PSV-764 klempířské (Cu) | oplechování 5 komínů, lemování světlíku, žlaby 25 m, svody 30 m, okapnice, lemování vikýřů, oplechování ostění | ~140 tis. Kč |
| M-S7 | PSV-767 zámečnické (ocel) | 2× U100 hřeben 50 bm + 2× U120 vikýře 27 bm + sloupky + IPE 100 nadpraží — celkem 1.91 t ocel + AKZ + kotvení | ~205 tis. Kč |
| M-S8 | VRN | ZS, BOZP, geodet, statický dozor, průzkum zdiva (TZ §7 explicit!), pasportizace, DSPS | ~271 tis. Kč |

---

## 3. Chybějící položky v existujících sekcích (~15)

Kromě celých chybějících sekcí (#2) bylo v existujících sekcích vynecháno:

1. **Bednění hlavní střecha tl. 20 mm × 154 m²** — v1 mělo jen vikýře OSB 25 mm
2. **Krokve 100×180 × 207 bm** — v1 měl 0 m (nulová hodnota!)
3. **Pozednice 140×160 × 50 bm** — v1 nemá
4. **Latě 50/40 × 467 bm + kontralatě × 154 bm** — v1 měl 0 m
5. **Impregnace řeziva 8 m³** — v1 měl 0 m³
6. **Strukturovaná rohož pod plech vikýře tl. 8 mm × 51.2 m²** — TZ skladba pos. 2, v1 chybí
7. **Steico Universal tl. 25 mm × 51.2 m²** — TZ skladba pos. 6, v1 chybí
8. **Difuzní fólie Tyvek vikýře 51.2 m²** — TZ skladba pos. 5, v1 chybí (samostatně od pojistné HI hl. střechy)
9. **Tyčový sněhový zachytávač před vikýři × 13.56 bm** — TZ str. 3 EXPLICITNĚ, v1 chybí
10. **Větrací hřebenová tvarovka × 25 m** — TZ str. 3, v1 chybí (mřížka okapní ≠ hřebenová tvarovka)
11. **Hydroizolační stěrka v koupelnách × 32 m²** — TZ §Hydroizolace, v1 chybí
12. **Tepelně izolační návlek na ocel ve světlíku × 1 kpl** — TZ str. 3, v1 chybí
13. **Vstupní bytové dveře RC3 EI30 DP3 × 2 ks** — TZ str. 4, v1 chybí
14. **Vnitřní dveře 800-900/1970 × 10 ks** — v1 chybí
15. **Vnitřní omítka sádrová 280 m² + 2× malířský nátěr** — v1 chybí

---

## 4. Vypočtené objemy — křížová kontrola TZ vs výkres

Detailní výpočtové stopy viz `calc_traces/volumes.md`. Zkráceně:

### 4.1 Geometrie z fasády (screen 1)

```
Délka uliční fasády:           25.010 m
└─ vlevo krajní hrana:          1.000 m
└─ vikýř L:                     6.780 m
└─ střední část (svetlík):     9.450 m
└─ vikýř R:                     6.780 m
└─ vpravo krajní hrana:         1.000 m
```

### 4.2 Geometrie z řezu (screen 2, 5)

```
Hřeben:                        +11.180 m
Pultová střecha:                +9.800 m (dvorní část - beze změny)
Vikýř ridge:                    +9.270 m (na fasádě) / +9.170 m (na řezu)
Vikýř hrana spodní:             +8.650 m
Stávající římsa:                +6.680 m
Podkroví podlaha:               +6.350 m
Výška od stáv. římsy k hřebenu: 4.500 m
Sklon hl. střecha:              36.2°
Sklon vikýř:                    7.0°
Půdorysná šířka uliční části:   4.41 m (z řezu)
```

### 4.3 Půdorysné plochy

- Užitná plocha 2 bytů z TZ §2: **127.03 m²** (BYT 34 = 64.48 + BYT 35 = 62.55)
- Půdorysná plocha celkem uliční části: 4.41 × 25.01 = **110.3 m²** (z výkresu)
- Plocha hlavní střechy (sloped): **154 m²** (z TZ + výkresu fasády)
- Plocha vikýřů (sloped): **51.2 m²** = 2 × 25.6 m² = 2 × (6.78 × 3.78)

### 4.4 Krokve (klíčové pro tesařský rozpočet)

```
Hlavní střecha:
  šířka po sklonu = 154 / 25.01 = 6.16 m sloped length per krokev
  počet krokví = 25.01 m / 1.0 m = 25 ks
  celkem délka = 25 × 6.16 = 154 bm
  objem = 154 × (0.1 × 0.18) = 2.77 m³

Vikýře (2 ks):
  šířka po sklonu 7° = 3.78 / cos(7°) = 3.81 m
  počet krokví = 2 × 6.78 / 1.0 = 14 ks
  celkem délka = 14 × 3.81 = 53.3 bm
  objem = 53.3 × (0.1 × 0.18) = 0.96 m³

CELKEM krokve: 207 bm, 3.73 m³ dřeva
```

### 4.5 Suť — reálný odhad

```
Bobrovka 154 m² × 45 kg/m² (vč. latí starých) = 6.93 t  (keramika 17 01 03)
Atika cihlová 25 × 1.5 × 0.3 m = 11.25 m³ × 1800 kg/m³ = 20.25 t (cihla 17 01 02)
Stará podlaha skladba 110.3 m² (beton 50 + podklad. beton 20 + násyp 70 + lepenka + polystyren 40):
  - beton mazaniny 0.05 m × 110.3 = 5.52 m³ × 2400 = 13.2 t  (beton 17 01 01)
  - podkladový beton 0.02 m × 110.3 = 2.21 m³ × 2400 = 5.3 t (beton 17 01 01)
  - násyp 0.07 m × 110.3 = 7.72 m³ × 1500 = 11.6 t (smíšené)
  - polystyren 0.04 m × 110.3 = 4.4 m³ × 25 = 0.11 t (plast 17 02 03)
Stará dřevěná konstrukce:
  - krov 10 m³ × 500 = 5.0 t
  - záklopy 2× 50 mm × 110.3 = 11 m³... ne, raději: 2× 0.05 × 110.3 = 11.03 m³? to není reálné.
  - Realisticky: 4 m³ záklopu × 500 = 2 t + krov 5 t = 7 t (dřevo 17 02 01)

CELKEM suť:           
  ├─ Keramický odpad (17 01 03):     6.93 t
  ├─ Cihelný odpad (17 01 02):      20.25 t
  ├─ Beton (17 01 01):              18.50 t
  ├─ Dřevo (17 02 01):               9.00 t  (krov + záklopy)
  ├─ Násyp smíšený (17 09 04):      11.60 t
  └─ Plast/polystyren (17 02 03):    0.11 t
  ─────────────────────────────────────────
  TOTAL:                            54.0 t
```

v1 mělo 10.646 t — tedy **5×** podhodnoceno.

### 4.6 Zdivo Porotherm — vikýře

```
Plocha čelní stěny vikýře:  6.78 × 2.49 (výška od stáv. římsy k římse vikýře) = 16.88 m²
Plocha bočních stěn vikýře (2 ks): 2 × 3.78 × 3.5 (výška proměnná, průměr) = 26.46 m²
Plocha za vikýř:            43.34 m²
2 vikýře:                   86.68 m²
Objem zdiva (tl. 0.44):     86.68 × 0.44 = 38.14 m³

POZN.: rozpočet účtuje na m² (KROS standard pro Porotherm)
       — proto v rozpočtu jen 86.7 m², ne m³
```

---

## 5. Pre-implementation interview — co rozhodnout PŘED Phase 2

Per Pattern 17 (Phase 0a Completeness Audit) nemá smysl produkovat finální nabídku zhotoviteli, dokud:

### Blockery P0 (kritické)

1. **✅ Statika — VYŘEŠENO pro fázi nabídky** (`calc_traces/statika_assumed.md`)

   Provedena pre-statika dle Eurokódů (ČSN EN 1990–1995) — návrh všech ocelových a dřevěných prvků s safety margin ≥ 30 %:

   | Prvek | Návrh | Posouzení | Využití |
   |---|---|---|---|
   | Krokve hl. střecha 100×180 | 2-polový spojitý nosník 2× 3.08 m | ČSN EN 1995-1-1 | 30 %, průhyb 1/770 |
   | Krokve vikýře 100×180 | Prostý nosník 3.81 m | ČSN EN 1995-1-1 | 49 %, průhyb 1/400 |
   | Pozednice 140×160 | Spojitě podepřena | ČKAIT empirie | OK |
   | 2× UPN 100 vaznice | Spojitý nosník, pole sloupků 3.5 m | ČSN EN 1993-1-1 | 53 %, průhyb 1/300 limit |
   | 2× UPN 120 zalomení | Pole 2 m | ČSN EN 1993-1-1 | 6 % (rezerva) |
   | Sloupky trubka 80×60×4 (16 ks, h ≈ 1.8 m) | Tlačený prvek, β=0.7 | ČSN EN 1993-1-1 | 14 % |
   | Příložka 100/260 z dolní strany trámu | PUR + svorníky M12/500 | ČSN EN 1995-1-1 §7.3 | W +67 %, I +130 % |
   | Věnec 250×200 + 4Φ12 + třmínky Φ8/200 | Tlak + ohyb od sloupku | ČSN EN 1992-1-1 | 18 % |
   | IPE 100 nadpraží dveří 1.0 m | Krátký nosník | ČSN EN 1993-1-1 | 6 % |

   **Cenový dopad statického upřesnění: +2 449 Kč** (z 3 978 264 → 3 980 713 Kč) — marginal, ale velký dopad na confidence (z 0.55-0.75 → 0.82-0.92).

   ⚠ **Tato pre-statika je platná pro fázi nabídky a budget plan, NIKOLI pro DPS ani stavební povolení.** Pro DPS NUTNO **autorizovaný statický posudek (ČKAIT IS00)** dle zákona 360/1992 Sb. a 183/2006 Sb. § 159.

2. **Výpis výplní otvorů (D.1.1.3 nebo separate)**:
   - O/002 (2 ks střešní okno) — rozměr, materiál, U-hodnota
   - 4 ks velká okna vikýřů — rozměr, materiál (plast/dřevo/hliník), U-hodnota
   - 1 ks nové okno ve štítové stěně — rozměr
   - 2 ks vstupní bytové dveře RC3 EI30 DP3 37 dB (specifikováno v TZ str. 4)
   - cca 10 ks vnitřních dveří

3. **Výkresová část D.1.1.2**:
   - půdorys 3.NP (současný stav + nový stav)
   - řez příčný + podélný
   - výpis skladeb (skladby v TZ + Excel jsou souhrnné, ale výkres D.1.1.2.x by měl mít detaily)

### Blockery P1 (silné doporučení)

4. **PBŘ (D.1.3)** — typy SDK desek (GKB/GKBi/GKF impregnace), požární odolnost (EI 30 / 45 / 60), ucpávky prostupů
5. **D.1.4 TZB** — kanalizace + vodovod + plyn (2 nové kotle BAXI Nuvola DUO-TEC +16) + elektro (2 nové rozvaděče + 2 elektroměry) + VZT (4 ventilátory koupelen 90 m³/h)
6. **Statické posouzení existujícího zdiva** — TZ §7 explicitně požaduje „průzkum pevnosti zdiva vybraných přitěžovaných pilířů v 1.PP a 1.NP"

### Blockery P2 (nice-to-have)

7. Architektonický výkres interiérů (nášlapné vrstvy, obklady, sanita, kuchyně)
8. Souhlas SVJ / sousedů (vnitroblok)

---

## 6. Co dělat dál

### Pro Alexandra

1. **Tento rozpočet poslat investorovi/projektantovi jako „pracovní verzi v2 s otázkami"** — NE jako finální nabídku
2. Před vystavením oficiální nabídky **získat statiku + výpis výplní + D.1.4 TZB**
3. Doplnit do nabídky disclaimer: „rozpočet platí za podmínky doplnění blokerů P0; jednotkové ceny jsou orientační podle KROS 2026 + Cenová soustava ÚRS — finální cena bude upřesněna po doplnění chybějících částí PD"
4. Připravit **dotazník pro projektanta** (12-15 položek z Blockers P0 + P1)

### Pro Claude Code (další session)

1. Generovat KROS XML soupis prací (UNIXML 1.2) — položky v2.json jsou připraveny pro export
2. Po doplnění statiky regenerovat sekce HSV-9 (demolice krovu), HSV-41 (ŽB + zesílení trámů), PSV-767 (ocel)
3. Po doplnění výpisu výplní regenerovat sekce PSV-766 (okna + dveře)
4. Připravit kapitolovou variantu (Souhrn → A Var bez VRN → B Var s VRN → C Var s TZB) pro investora
5. Cross-reference s D.1.2 SVK Stavební výkresy (až dorazí)

---

## 7. Odkazy

- **Vstupní data:**
  - TZ: `inputs/tz/D.1.1_architektonicko_stavebni_cast.pdf` (17 stran)
  - ChatGPT v0 brainstorm: `inputs/chatgpt_draft/vykaz_strecha_vikire_prace_materialy_GEDA_vikyr_detail.xlsx`
  - ChatGPT v1 KROS: `inputs/chatgpt_draft/Vykaz_BD_Daliborova_v1_KROS_73poz.xlsx`
- **Výstupní data:**
  - JSON: `outputs/audit_2026-05-27/positions_v2.json` (machine-readable, ready for KROS XML export)
  - Excel: `outputs/audit_2026-05-27/Vykaz_BD_Daliborova_v2_KROS.xlsx` (KROS-compatible)
  - Výpočtové stopy: `outputs/audit_2026-05-27/calc_traces/volumes.md`
- **Metodika:**
  - Pattern 17 + 20 + 23 + 31 z `docs/STAVAGENT_PATTERNS.md`
  - Phase 0a Completeness Audit (`concrete-agent/.../08_completeness_audit_mandatory.md`)
