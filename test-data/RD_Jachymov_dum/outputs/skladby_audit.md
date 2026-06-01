# Skladby cross-check audit — RD Jáchymov dům (260219)

> **Type:** read-only cross-check. `items_rd_jachymov_complete.json` (188 dům položek) × `inputs/skladby_navrh.md` (S01–S12).
> **Date:** 2026-06-01 · **Gate:** STOP před dogenerací — approve gaps níže, pak generuji (Pattern 41 split + `_source="skladba S0X"`).
> **Legend:** ✅ pokryto (skladba-tagged) · 🟦 pokryto jinde (globální PSV — omítky/malby/podlahy/obklady/izolace, ne per-skladba) · 🟡 GAP (vrstva nenalezena) · ⚠️ DRIFT (tloušťka ≠ návrh) · ⛔ BLOCKER (chybí celá skladba / schema bug) · ℹ️ stávající (renovace, bez nové položky)

---

## 0. Schema-integrity bug (mimo skladby, ale BLOCKER)

⛔ **Duplicitní `id` — porušení Pattern 28 (globally-unique entity IDs):**
- `260219_dum.PSV71.001` = **2 různé položky**: „HI pod ŽB deskou 1.NP" (namespace HI) **i** „Podlahový EPS 150 λ0.035 120 mm" (namespace TI)
- `260219_dum.PSV71.002` = **2 různé položky**: „Odvětrání radonu" (HI) **i** „Kročejová EPS 150/30 dB 30 mm" (TI)

Stejný `id` pro 4 fyzicky odlišné práce → kolize v každém indexu/exportu, který klíčuje na `id`. **Fix:** přečíslovat TI namespace (např. `PSV71.011/012`) nebo prefixovat namespace do `id`. Nezávislé na skladbách — doporučuji opravit při téže dogeneraci.

---

## 1. Verdikt po skladbách

| Skladba | Stav | Pokrytí / poznámka |
|---|---|---|
| **S01** obvodová stěna + ETICS | ✅ | ETICS EPS grey 160 λ0.032 = `HSV7.002` (popis „ne 200 fallback" — drift dořešen ✅). Omítky/malby/obklady 🟦 PSV78. Zdivo 450 ℹ️ stávající + `HSV3.001` lokální dozdívky. Břizolit příprava = `HSV7.001`. Finiš `HSV7.006`. **Pozn:** návrh „silikonová omítka 2 mm", item „pastovitá probarvená" — ověřit typ. |
| **S02** společná stěna řadovky | ✅ | Zdivo 300 ℹ️ stávající. Omítky 🟦 PSV78. **Pozn:** `HSV3.007` (příčky pórobeton 150) tagged S02 — sporné (příčky ≠ společná stěna 300); příčky nemají vlastní skladbu v návrhu. |
| **S03** suterénní stěna + sanační zateplení | 🟡 **GAP** | Pro **dům** existují jen `S03a_sklad`/`S03b_sklad` (sklad 260217). Pro dům suterén: sanační zateplení soklu (Lepstyr + **Styrcon 200** + armovací), **S03a drenážní nopová folie 20 mm**, **S03b provětraný sokl rošt 40 + keram. obklad 20** — nenalezeno. `HSV1.015` drenáž je za **opěrnou** stěnou, ne suterén. ⚠️ Ověřit TZ: má dům suterén sanační zateplení, nebo jen sklad? |
| **S04** podlaha v suterénu | 🟡 částečně | Nášlap 1.PP = `PSV77.003` (dlažba technické místnosti) 🟦. Báze (epoxid + beton 100 + štěrkopísek 50) — pro dům nenalezena (jen `S04_sklad`). ℹ️ pravděpodobně stávající podlaha — ověřit. |
| **S05** podlaha 1.NP na terénu | ⚠️ **DRIFT** | EPS 150 podl. 120 = `PSV71.001`(TI) ✅. HI asfalt = `PSV71.001`(HI) ✅. Potěr kari 50 = `PSV77.005` ✅. Štěrk = `HSV1.008` ✅. Radon = `PSV71.002` ✅. **DRIFT:** návrh „betonová deska vyztužená **120 mm**" vs `HSV2.012` „ŽB deska **150 mm**". Ověřit (statika může 150 chtít). Samonivelační stěrka 5 mm 🟡 nezvlášť. |
| **S06** klemba suterén/přízemí | ✅ | Zásyp perlitbeton 100 = `HSV4.008` (návrh 80–180 ✓), roznos TB2 50 = `HSV4.009` ✅. Klemba 150 + nosníky ℹ️ stávající (`HSV4.007` vyvezení). Nášlap/omítka/malba 🟦. |
| **S07** trámový strop mezi patry | 🟡 **GAP** | Min. vata mezi trámy 180 = `HSV4.011` ✅. SDK EI30 = `HSV4.012` ✅. Liapor 50 = `HSV4.013` ✅. Fermacell 25 = `HSV4.014` ✅. Záklop 20 ℹ️ stávající. **GAP:** **kročejová izolace Isover T-P 30 mm** pro trámový strop — nenalezena (`PSV71.002` kročejová je explicitně „nad ocelobeton 2.NP/3.NP" = S09, ne S07). Separační geotextilie 🟡. |
| **S08** klemba mezi patry | ⛔ **BLOCKER** | **0 položek.** Dům má S06 (1.PP/1.NP), S07 (1.NP/2.NP), S09 (2.NP/3.NP) — kam patří S08 (cihelná klemba mezi patry)? Možná smíšený strop per trakt. **Nelze rozhodnout z textu → ověřit TZ/výkres (per tvůj pokyn: S08 generovat JEN když TZ potvrdí, že v domě je).** |
| **S09** ocelobeton podkroví | ⚠️ **DRIFT + GAP** | Nabetonávka 60 = `HSV2.010` ✅, výztuž `HSV2.011` ✅, IPE180 `HSV4.002` ✅, HEA180/200 `HSV4.003/004` ✅, trapéz 40S/160 `HSV4.005` ✅ (= košický plech 40), SDK EI30 `HSV4.006` ✅. **DRIFT:** kročejová návrh **40 mm** vs `PSV71.002` **30 mm**. **GAP:** **minerální vata výplň 180/200 mm mezi ocel. nosníky** — nenalezena. Betonová mazanina 60 (horní) vs nabetonávka 60 (dolní) — ověřit, zda nejsou 2 vrstvy. |
| **S10** šikmá střecha | ✅ (1 ?) | Bednění 25 `HSV5.012` ✅, Al krytina `HSV5.013` ✅, doplňková HI `HSV5.010` ✅, kontralatě 40×60 `HSV5.011` ✅, PIR 160 λ0.022 `HSV5.009` ✅, parotěsná `HSV5.008` ✅, palubka/bednění 20 `HSV5.007` ✅, krokve 180 `HSV5.001` ✅. 🟡 **pojistná HI folie přímo pod Al krytinu** (horní, odlišná od doplňkové nad PIR) — ověřit, zda není zvlášť potřeba. |
| **S11** lehký strop mezipatří | ✅ | Biodeska/OSB 22 = `HSV5.014` ✅. |
| **S12** obvodová stěna podkroví | ✅ | Nadezdívka Porotherm 30 = `HSV3.002` ✅. **Pozn:** návrh „omítka **sádrová** stříkaná", PSV78 je vápenocementová — ověřit typ omítky v podkroví. |
| **S12a** fasáda omítka ETICS | ✅ | = S01 ETICS (`HSV7.002/004/005/006`). ✅ |
| **S12b** fasáda falcovaný plech | 🟡 under-decomposed | `HSV5.016` = JEDNA bundled položka „provětrávaná fasáda min. vata + plech". Návrh = 5 vrstev: **min. vata 180 λ0.035 + kotvy / paropropustná folie UV / rastr 40×60 / bednění prkna 25 / falc. plech**. Doporučen rozpad (Pattern 41 montáž/materiál). |

---

## 2. Gap-souhrn (k approve před dogenerací)

### ⛔ Blockery — VERIFY TZ první (nehádám)
| # | Co | Akce |
|---|---|---|
| B1 | **S08 cihelná klemba mezi patry** — 0 položek | Ověřit TZ/výkres, zda dům má cihelnou klembu mezi patry. JEN pak generovat (per tvůj pokyn). |
| B2 | **Duplicitní id `PSV71.001`/`PSV71.002`** (Pattern 28) | Přečíslovat TI namespace. Nezávislé na skladbách. |

### 🟡 Gaps — pravděpodobně generovat (po approve)
| # | Skladba | Chybějící vrstva | Pozn. |
|---|---|---|---|
| G1 | S03 (dům) | sanační zateplení soklu (Styrcon 200 + lepidlo + armovací) + nopová folie 20 (S03a) + provětraný sokl obklad (S03b) | Ověřit, zda dům, ne jen sklad |
| G2 | S07 | kročejová izolace Isover T-P **30 mm** (trámový strop) | + separační geotextilie |
| G3 | S09 | minerální vata výplň **180/200 mm** mezi ocel. nosníky | |
| G4 | S12b | rozpad bundlu `HSV5.016` na 5 vrstev (min. vata 180 / folie / rastr / bednění 25 / plech) | Pattern 41 |
| G5 | S10 | pojistná HI folie pod Al krytinu (horní underlay) | ověřit nutnost |

### ⚠️ Drifty — VERIFY (možná záměr, neměnit bez potvrzení)
| # | Skladba | Návrh | items.json | |
|---|---|---|---|---|
| D1 | S05 | betonová deska 120 mm | `HSV2.012` ŽB deska 150 mm | statika? |
| D2 | S09 | kročejová 40 mm | `PSV71.002` 30 mm | sjednotit |

### ✅ Potvrzené shody (žádná akce)
ETICS EPS grey 160 λ0.032 (S01/S12a) · PIR 160 λ0.022 (S10) · min. vata mezi trámy 180 (S07) · perlitbeton 100+50 (S06) · podl. EPS 150 = 120 (S05) · biodeska 22 (S11) · zdivo 300/Porotherm (S02/S12) · povrchové úpravy globálně 🟦 PSV77/PSV78.

---

## 3. Pozn. k metodice
- Povrchové vrstvy skladeb (vnitřní omítka 15, výmalba, nášlap, obklad) NEjsou per-skladba — kryjí je globální PSV položky (`PSV78` omítky/malby, `PSV77` podlahy, `PSV78.008-011` obklady, `PSV71` izolace). Proto NEflagovány jako chybějící.
- „ℹ️ stávající" = renovace zachovává konstrukci (zdivo 450/300/600, klemba, záklop) → bez nové položky, jen příprava/lokální oprava.
- Dogenerace (po approve) půjde per vrstva s montáž/materiál split (Pattern 41), `_source="skladba S0X"` (Pattern 29), family-kód kde známý / blank jinak (Pattern 26 — žádný find_urs_code wrong-leaf).
