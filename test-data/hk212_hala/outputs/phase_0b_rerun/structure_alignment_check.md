# §13.3 + §13.4 — Apply Precedent to hk212 + Discrepancy Check

**Date:** 2026-05-13
**Phase:** 0b RE-RUN · §13 addendum
**Input:** `example_pattern_analysis.md` (Rožmitál primary + 4 URS_KROS_KOMPLET cross-precedents)
**Output use:** Skeleton recommendation pro Phase 1 generator (NEPISE Phase 1 sama tato task)

---

## §13.3 Skeleton recommendation pro hk212 Phase 1

### Doporučená SO struktura — 11 stavebních objektů (hala-typical Czech praxe)

```
SO-01  Stavební a konstrukční řešení (ASŘ/ASR)     — HSV-1...HSV-9 + PSV-7x stavebně
SO-02  Statické řešení (KSŘ)                        — typicky duplikát SO-01 OK/ŽB nebo dedicated sheet
SO-03  Zdravotní instalace vnitřní (ZTI vnitř)     — voda, kanalizace, požární vodovod
SO-04  Zdravotní instalace venkovní (ZTI venk)     — přípojky vodovod/kanal + retence
SO-05  Vzduchotechnika (VZT)                       — rekuperace + dveřní clony + odvod
SO-06  Ústřední vytápění (ÚT/OTK)                  — sálavé panely Sahara/Schwank
SO-07  Silnoproud (EL)                              — silnoproud + osvětlení + zásuvky
SO-08  Bleskosvod / LPS (slaboproud-EL)            — jímací soustava + svody + zemnič
SO-09  Požárně bezpečnostní řešení (PBŘ)           — hasicí přístroje + hydrant + revize
SO-10  Technologie strojů (M-konstrukce)            — kotvící body + anchorage + el. připojení strojů
SO-11  Vedlejší a ostatní náklady (VRN)            — geodet + ZS + revize + atesty
```

### Excel layout pro Phase 1 výstup

| Sheet # | Sheet jméno | URS Díly | Cílový počet položek |
|---:|---|---|---:|
| 1 | Rekapitulace stavby | — | ~12 řádků (rekapitulace per SO) |
| 2 | SO-01 ASŘ | 1 (zemní) + 2x (základy ŽB) + 3 (svislé) + 4 (vodorovné) + 6 (úpravy) + 7x (PSV — opláštění, klempířské) + 9 (ostatní) + 998 (přesun hmot) | **80-120** |
| 3 | SO-02 Statika (OK) | 7xx-specifikace OK | 25-40 |
| 4 | SO-03 ZTI vnitř | 72x (potrubí + armatury) | 15-25 |
| 5 | SO-04 ZTI venk | 89x (přípojky areálové) | 10-15 |
| 6 | SO-05 VZT | 73x (vzduchotechnika) | 15-25 |
| 7 | SO-06 ÚT | 73x (otopná tělesa, panely) | 8-15 |
| 8 | SO-07 Silnoproud | 21-M + 22-M | 20-30 |
| 9 | SO-08 LPS | 21-M (hromosvod) | 5-10 |
| 10 | SO-09 PBŘ | 953x + 94x (hasi.přístroje) | 5-8 |
| 11 | SO-10 Technologie M | Rpol* (custom kotvení) | 5-10 |
| 12 | SO-11 VRN | 005x + 094x | 8-12 |
| **TOTAL** | | | **~200-310 položek** |

(Bližší k spec target ≥180; Rožmitál benchmark 552 zahrnuje demolice 113 položek SO01 + 14 položek SO03 elektroinstalace separate — pro novostavbu bez demolice nižší base).

### Granularity per element type (z §13.2 B precedent)

Pro každý element z hk212 facts §3.3:

| hk212 element | Pre-baked count | Recommended položek per element | Total položek očekávané |
|---|---:|---:|---:|
| Patky rámové ŽB 1.5×1.5 C16/20 XC0 | 14 | 4 (beton + bedn zřízení + bedn odstr + výztuž) + 1 přesun hmot = **5 per kapitola, ne per kus** | 5 |
| Patky štítové ŽB 0.8×0.8 C16/20 XC0 | 10 | 4 + 1 přesun hmot | 5 |
| Atypický základ / pilota variant Ø800×8m | 1 | 4 + 1 | 5 |
| Pasy spojovací mezi patkami | ~30 bm | 4 + 1 | 5 |
| Deska podlahová C25/30 XC4 | 495 m² | 4 + 1 + 1 (vetkáním vláken vetonu) | 6 |
| Sloupy IPE 400 + montáž S235 | 36 (per §3.3 RE-RUN) | 2 (specifikace t + montáž t) + 1 nátěr (m²) | 3 |
| Sloupy štítové HEA 200 | 8 | 2 + 1 nátěr | 3 |
| Příčle IPE 450 | 5 | 2 + 1 nátěr | 3 |
| Vaznice IPE 160 | TBD count | 2 + 1 nátěr | 3 |
| Vaznice krajní UPE 160 | TBD count | 2 + 1 nátěr | 3 |
| Ztužidla stěnová L 70/70/6 | TBD | 2 + 1 nátěr | 3 |
| Ztužidla střešní Ø20 kruhové | 8 | 2 + 1 nátěr | 3 |
| Kingspan stěna sendvičová PUR/IPN typ TBD tl. TBD | ~? m² | 2 (specifikace + montáž) | 2 |
| Kingspan střecha sendvičová panel + atikový krycí | 495 m² + atika | 2 + 1 atika | 3 |
| Okna OKNO_1k 1×1m sklopná (V1..V21) | 21 | 2 (specifikace + montáž) | 2 |
| Vrata sekční | 4 | 2 + 1 (el.pohon) | 3 |
| Vnější dveře 2-křídlé | 2 | 2 | 2 |
| Žlaby Pz pokr. půlkruhové rš 400 | ~30 m | 2 + 1 přesun hmot Díl 998-764 | 3 |
| Oplechování říms Pz rš 750 | ~30 m | 2 + 1 přesun hmot Díl 998-764 | 3 |
| Svody dešťové Lindab Ø100 | 3 nebo 4 (TBD §9.6) | 2 (specifikace + montáž) | 2 |
| Atika Pz / klempířská | ~80 m | 2 | 2 |
| Hromosvod jímací soustava + svody + zemnič | ČSN 62305 | 6-8 (vedení svodů + svorky 2-3 typy + jímač + uzemnění + revize) | 7 |
| **HSV-1 výkopy** (per ABMV_17) | ~250 m³ figura + ~30 m³ dohloubky + ~30 m³ ruční | 6-8 (hloubení nezapaž + přípl lepivost + svislé přem + vodorov přem + zásyp + obetonování sítí) | 7 |
| Hala — Sálavé panely ÚT | TBD kW | 2 (specifikace + montáž) | 2 |
| VZT rekuperační jednotka + dveřní clony | TBD m³/h | 4 (rekuperace + 2 clony + potrubí SPIRO) | 4 |
| EL hlavní rozváděč + přívod | 3×100 A + CYKY 5×35 mm² | 4-6 (rozváděč + jistič + přívod + ochrana) | 5 |
| EL osvětlení LED + zásuvky | TBD ks | 6-10 (svítidla + spínače + zásuvky + průmyslové z. + průchodky) | 8 |
| Technologie strojů (anchorage + el.připoj) | TBD per ABMV #3 + #16 | 4-6 (Rpol* custom) | 5 |

**Aggregated estimate:** ~135-160 položek pro HSV+PSV stavebně, +30-50 TZB, +5-10 technologie, +8-12 VRN = **~180-230 položek** = matches spec target ≥180. ✓

---

## §13.4 Discrepancy Check — hk212 facts vs Rožmitál precedent

### Macro-level rozdíly

| Aspekt | Rožmitál (precedent) | hk212 (target) | Implikace |
|---|---|---|---|
| **Stavební akce** | Demolice + novostavba | Novostavba only | -1 SO (Demolice) → ~100 položek méně |
| **Účel haly** | Skladová (sůl) | Skladová (fotovoltaika) + recyklační technologie | +1 SO (Technologie M) → +5-10 položek |
| **Plocha** | TBD (Rožmitál soupis nemá explicit area) | 495 m² podlahová / 540-556 m² zastavěná | Měřítko podobné |
| **Konstrukce** | Ocelová rámová + Z-profilové vaznice | Ocelová rámová + IPE vaznice + UPE 160 krajní | Stejný strukturální systém — granularita 1:1 |
| **Beton patek** | C 16/20 | C 16/20 (TZ + §3.4 RE-RUN) ✓ | Identické |
| **Beton desky** | TBD (Rožmitál slepý nehlásí) | C 25/30 XC4 | Možná drobná deviation v MJ kódu, ale pattern stejný |
| **Kingspan** | Sendvičové opláštění (1 zmínka) | Sendvičové opláštění (typ a tloušťka neuvedeny → ABMV #13 / #14) | Granularita 2 položky stejná, ale `popis` musí být general (Specifikace + montáž — dimensions per ABMV resolution) |
| **Hromosvod** | Plný (15 položek) | Plný požadavek z ČSN EN 62305 | Granularita stejná, počet svodů per §9.6 / §3.7 RE-RUN |
| **Klempířské konstrukce** | 4 položky + přesun hmot | Potřebné per §3.7 RE-RUN (3-4 svody Lindab DN100 + oplechování říms + žlaby + atika) | Granularita identická |
| **Technologie strojů** | NENÍ | EXPLICITNÍ POŽADAVEK (ABMV #3 + #16) — kotvící body 8× nebo více + el. připojení | **NOVÝ SO-10 typu výjimečné** s Rpol* položkami — žádný precedent neprovází |
| **Subdodavatel split** | "Vlastní" napříč (slepý) | Stejně "Vlastní" v generátoru, fill při kontraktování | Identický pattern |
| **VRN** | 12 položek | 8-12 (subset z hala-standardní VRN) | Identický pattern, lehce méně (menší stavba) |

### Granularity discrepancy flags

✅ **Shoda granulárity** s precedent: žel.bet konstrukce (4-5 položek), ocel (2-3), Kingspan (2), klempířské (2-3), vrata/dveře (2), VRN (8-12).

⚠️ **Granularity discrepancy — Technologie strojů (SO-10):**
- Rožmitál nemá technologii (nedostatečná data) — precedent neaplikovatelný
- **Doporučení:** Vytvoř 5-8 `Rpol*` položek s explicit ABMV-flag `_status_flag: 'pending_specifikace_stroju'` + `_vyjasneni_ref: ['ABMV_3', 'ABMV_16']`. Granularita per stroj: anchor body (kus) + chemická kotva specifikace (kus) + el. připojení (Soubor) + uzemnění (Soubor)

⚠️ **Granularity discrepancy — Výkopové práce (HSV-1, ABMV_17):**
- Rožmitál SO01 demoluje + SO02 hala má jen 17 položek zemních prací (kombinováno)
- hk212 výkop calc = 349.8 m³ vs TZ B 32 m³ (10.9× drift per Phase 0b RE-RUN)
- **Doporučení:** Použít FULL precedent breakdown (6-8 položek per VV-DPL hloubení + lepivost + svislé/vodorovné přemístění + zásyp + obetonování sítí). KAŽDÁ položka HSV-1 musí mít `_vyjasneni_ref: ['ABMV_17']`. Po vyjasnění s projektantem se Money values přepočítají.

⚠️ **Granularity discrepancy — Beton desky podlahy (HSV-2 + HSV-6):**
- Rožmitál uvádí "Železobeton základových desek C 16/20" = 1 položka pro foundation slab
- hk212 deska podlahy je C 25/30 XC4 (per §3.4 RE-RUN) + má vetkáním vláken vetonu (per TZ B) — to je rozdílná granularita
- **Doporučení:** Generuj 6 položek pro podlahovou desku: lož pod desku (m³) + železobeton desky (m³) + bednění zřízení (m²) + bednění odstr (m²) + ocelová vlákna do betonu (kg) + KH síť výztuž (t) + povrchová úprava (m²) + případně tvrdá maska (m²). To je o 2 položky více než pure Rožmitál pattern.

⚠️ **Catalog vs Export wrapper — vyjasnění (per user feedback 2026-05-13):**
- **Catalog jádra:** **URS 9-mistné kódy** jsou jedna kanonická pravda. Rožmitál, Hala JHV, Kralovice, Sklad škrobu, Třemošná — všichni používají identický URS katalog.
- **Export wrapper:** RTS Rozpočet (`#RTSROZP#` header) vs KROS Komplet (`Export Komplet` header) jsou jen různé software exportery NAD URS katalogem. Pro Phase 1 generátor je catalog jeden.
- **Volba wrapperu (pro hk212):**
  - **Veřejná zakázka** → KROS Komplet (zadávací řízení očekává; protistrana otevírá v KROS 4).
  - **Vlastní cost tracking / nabídka pro soukromého investora** → RTS Rozpočet je interchangeable, vlastně preferable (úplnější 25 sloupců).
- **Price book overlay:** sloupec "Ceník" (`RTS 24/ II` / `URS 24/I` / `Vlastní`) řeší jen Kč/MJ údaje, ne catalog. Pro slepý rozpočet (hk212 default) lze nechat default RTS / URS / Vlastní mix per položka.
- ANTRACIT-format flat investor template = ❌ **NEPOUŽÍVAT** pro hk212 (jiný catalog, jiná filozofie, nepřenese se do zadávacího řízení).

---

## §13.4 STOP/PROCEED gate

**Phase 1 generator nyní MÁ dostatek precedent struktury pro start:**

1. ✓ Catalog: **URS 9-mistné kódy** (canonical, identický napříč všemi 5 precedenty). Export wrapper KROS Komplet (default) nebo RTS Rozpočet (user volba — interchangeable).
2. ✓ SO hierarchie: 11 SO (SO-01..SO-11) + Rekapitulace stavby sheet
3. ✓ Granularita per element type: jasně mapovaná (tabulka výše)
4. ✓ Naming convention: URS 9-mistné kódy + `Rpol*` pro custom
5. ✓ Subdodavatel split: column "Dodavatel" = `Vlastní` default
6. ✓ VRN: 8-12 položek v SO-11

**REMAINING blockers pro Phase 1:**
- 7 ABMV-tagged drifts z Phase 0b RE-RUN MUSÍ být schválené uživatelem (sloupy 30→36, štítové 10→8, sklon 5.25°/5.65°, krajní vaznice UPE 160 vs C150×19,3, atd.) — viz `drift_audit_vs_header.md`
- 17 otevřených ABMV položek (ABMV_1..ABMV_17) některé musí být **odeslány projektantovi** dříve než Phase 1 vygeneruje finální množství (Kingspan typ, vrata 3000 vs 3500, počet svodů, technologie strojů)
- Lokální URS catalog k matching potřebuje smoke-test na ~20 vzorkových položek z Rožmitál (TF-IDF keyword overlap) — viz Phase 1 plan v `session_handoff_phase0b_rerun.md`

**Doporučení uživatel:**
1. Schvál drifts + uzavři kritická ABMV (alespoň #1, #3, #11, #13, #15, #17) před Phase 1 startem
2. Vybrat output format: URS_KROS_KOMPLET (default) nebo RTS_ROZPOCET
3. Confirm 11-SO struktura výše OR navrhni změny

Phase 1 generator se spustí v separátní task po user review tohoto reportu.
