# URS Match Worksheet — RD Jáchymov (Part 5b draft, NOT authoritative)

**Generated:** 2026-05-19
**Catalog:** `test-data/kros_catalog.db` (9,173 URS codes; only 1 602 from CS ÚRS 2026 01)
**Items processed:** 189

> **Disclaimer.** This is a DRAFT worksheet. Local DB is a tiny slice of full URS
> 2026/1 (~40 000+ codes). Even `hint_strong` rows need human verification —
> heuristic `urs_code_proposed` in `items.json` frequently guesses the right
> family (first 6 digits) but the wrong leaf. Spot-check examples in the matched
> list: EPS pro podlahu was suggested 713141121 which is actually 'izolace střech
> plochých', and 'Bourání plechové krytiny' matched 962081141 'Bourání příček ze
> skleněných tvárnic' — both code prefixes overlap but the work types disagree.
> Always open `podminky.urs.cz` and verify per row.

## Summary

| Status | Count | Criterion |
|---|--:|---|
| `hint_strong` | **12** | proposed code in DB + mj agrees + best.score ≥ 0.60 |
| `hint_text` | 42 | text signal only (mj match + score ≥ 0.45) |
| `hint_weak` | 6 | proposed code in DB but text disagrees |
| `urs_search_needed` | 124 | weak signal — open podminky.urs.cz |

**Proposed code confirmed (exact hit in DB):** 28 / 189
**Avg best_score:** 0.315

### Reason breakdown

| Reason | Count |
|---|--:|
| no_strong_signal | 124 |
| moderate_signal | 39 |
| proposed_code_in_db_mj_text_aligned | 12 |
| proposed_code_in_db_text_weak | 6 |
| no_candidates_returned | 5 |
| high_text_score_mj_match | 3 |

## By gate × status

| Gate | hint_strong | hint_text | hint_weak | urs_search_needed |
|---|--:|--:|--:|--:|
| HSV | 8 | 31 | 6 | 52 |
| PSV | 4 | 6 | 0 | 38 |
| TZB | 0 | 1 | 0 | 23 |
| VRN | 0 | 4 | 0 | 11 |

## hint_strong — verify these first (false-positive rate observed ~50 %)

| id | popis | best_kod | best popis | mj | catalog | URS |
|---|---|---|---|---|---|---|
| 260219_dum.HSV1.002 | Hloubení rýh š. do 60 cm pro pas opěrné stěny bílé | `132201101` | Hloubení zapažených i nezapažených rýh šířky do 60 | m3 | CS ÚRS 2018 01 | [open](https://podminky.urs.cz/?vyhledavani=132201101) |
| 260219_dum.HSV1.007 | Vodorovné přemístění výkopku — odvoz na deponii do | `162701105` | Vodorovné přemístění výkopku nebo sypaniny po such | m3 | CS ÚRS 2018 01 | [open](https://podminky.urs.cz/?vyhledavani=162701105) |
| 260217_sklad.HSV1.003 | Hloubení rýh pro betonové základové pasy 500×500 m | `132201101` | Hloubení zapažených i nezapažených rýh šířky do 60 | m3 | CS ÚRS 2018 01 | [open](https://podminky.urs.cz/?vyhledavani=132201101) |
| 260217_sklad.HSV1.006 | Odvoz výkopku z hloubení skladu + figur + patek na | `162701105` | Vodorovné přemístění výkopku nebo sypaniny po such | m3 | CS ÚRS 2018 01 | [open](https://podminky.urs.cz/?vyhledavani=162701105) |
| 260219_dum.HSV2.005 | Separační PE fólie pod základovou patou bílé vany  | `711132101` | Provedení izolace proti zemní vlhkosti pásy na suc | m2 | CS ÚRS 2026 01 | [open](https://podminky.urs.cz/?vyhledavani=711132101) |
| 260217_sklad.HSV2.001 | Základové pasy z prostého betonu C16/20 XC0, 500×5 | `273313811` | Základy z betonu prostého desky z betonu kamenem n | m3 | CS ÚRS 2018 01 | [open](https://podminky.urs.cz/?vyhledavani=273313811) |
| 260219_dum.HSV6.002 | Bourání stávající plechové krytiny (manuálně, recy | `962081141` | Bourání příček nebo přizdívek ze skleněných tvárni | m2 | CS ÚRS 2025 02 | [open](https://podminky.urs.cz/?vyhledavani=962081141) |
| 260219_dum.HSV6.007 | Bourání keramických obkladů a zařizovacích předmět | `962081141` | Bourání příček nebo přizdívek ze skleněných tvárni | m2 | CS ÚRS 2025 02 | [open](https://podminky.urs.cz/?vyhledavani=962081141) |
| 260219_dum.PSV71.003 | Hydroizolační stěrka koupelen 3 ks — podlaha + sok | `711132101` | Provedení izolace proti zemní vlhkosti pásy na suc | m2 | CS ÚRS 2026 01 | [open](https://podminky.urs.cz/?vyhledavani=711132101) |
| 260219_dum.PSV71.001 | Podlahový EPS 150 λ=0.035 tl. 120 mm — pod betonov | `713141121` | Montáž tepelné izolace střech plochých rohožemi, p | m2 | CS ÚRS 2026 01 | [open](https://podminky.urs.cz/?vyhledavani=713141121) |
| 260219_dum.PSV71.002 | Kročejová EPS 150 / 30 dB tl. 30 mm nad ocelobeton | `713141111` | Montáž tepelné izolace střech plochých rohožemi, p | m2 | CS ÚRS 2026 01 | [open](https://podminky.urs.cz/?vyhledavani=713141111) |
| 260217_sklad.PSV77.001 | Betonová dlažba do pískového lože — povrch podlahy | `771121011` | Příprava podkladu před provedením dlažby nátěr pen | m2 | CS ÚRS 2025 02 | [open](https://podminky.urs.cz/?vyhledavani=771121011) |

## hint_text (text-only signal — usually wrong family)

| id | popis | proposed | best_kod | best popis | score |
|---|---|---|---|---|--:|
| 260219_dum.HSV1.006 | Pažení a rozepření dočasných výkopů příložné, hl.  | `151101101` | `151101111` | Odstranění pažení a rozepření stěn rýh pro podzemn | 0.88 |
| 260219_dum.HSV4.011 | Tepelná izolace minerální vata mezi trámy stropu 1 | `713121121` | `713121122` | Montáž tepelné izolace podlah rohožemi, pásy, desk | 0.88 |
| 260219_dum.HSV6.012 | Odvoz a likvidace stavební suti dle vyhl. 8/2021 S | `997013501` | `997013509` | Odvoz suti a vybouraných hmot na skládku nebo mezi | 0.81 |
| 260219_dum.HSV1.001 | Sejmutí ornice tl. 100 mm na ploše budoucí opěrné  | `121101101` | `121101102` | Sejmutí ornice nebo lesní půdy  s vodorovným přemí | 0.67 |
| 260219_dum.HSV5.007 | Bednění z prken tl. 20 mm pod nadkrokevní PIR (bio | `762341711` | `762341650` | Bednění a laťování montáž bednění štítových okapov | 0.66 |
| 260219_dum.HSV7.006 | Tenkovrstvá pastovitá probarvená omítka, lomená bí | `622521111` | `622511102` | Omítka tenkovrstvá akrylátová vnějších ploch proba | 0.63 |
| 260217_sklad.PSV76.001 | Bezpečnostní dveře RC3 v ocelové zárubni — vrata s | `766682111` | `766682112` | Montáž zárubní dřevěných, plastových nebo z lamina | 0.61 |
| 260219_dum.VRN.003 | Likvidace stavební suti dle vyhl. 8/2021 Sb. — skl | `997013211` | `997013631R01` | Poplatek za uložení na skládce (skládkovné) staveb | 0.60 |
| 260219_dum.PSV76.009 | Plastové vstupní dveře (ulice + zahrada) — 2 ks | `766682111` | `766682112` | Montáž zárubní dřevěných, plastových nebo z lamina | 0.60 |
| 260217_sklad.VRN.002 | Likvidace odpadu sklad — kameny ze zídek + výkop + | `997013211` | `997013631R01` | Poplatek za uložení na skládce (skládkovné) staveb | 0.59 |
| 260219_dum.HSV7.002 | ETICS kontaktní zateplení — EPS 70F grey λ=0.032 t | `622221121` | `622221051R01` | Montáž kontaktního zateplení lepením a mechanickým | 0.59 |
| 260219_dum.HSV3.001 | Lokální dozdívky a přizdívky z cihel plných pálený | `311232511` | `311231139` | Zdivo z cihel pálených nosné z cihel plných dl. 25 | 0.58 |
| 260219_dum.HSV6.005 | Bourání stávajících lehkých příček (cihla, sádroka | `962031132` | `962081141` | Bourání příček nebo přizdívek ze skleněných tvárni | 0.58 |
| 260219_dum.PSV72.003 | Nové odpadní rozvody PVC-HT DN40-DN110 ke koupelná | `721174021` | `721174024` | Potrubí z plastových trub polypropylenové odpadní  | 0.56 |
| 260219_dum.HSV5.002 | Tesařský krov — kleštiny dvojfošny 60/180 mm probí | `762331912` | `762331924` | Vázané konstrukce krovů  vyřezání části střešní va | 0.51 |
| 260219_dum.PSV78.012 | Interiérová výmalba akrylátová bílá 2× — všechny s | `784121011` | `784181101` | Penetrace podkladu jednonásobná základní akrylátov | 0.51 |
| 260219_dum.HSV5.004 | Tesařský krov — námětky 60/100 v dolní koncové čás | `762331911` | `762331924` | Vázané konstrukce krovů  vyřezání části střešní va | 0.50 |
| 260219_dum.HSV2.011 | Výztuž nabetonávky kari síť 5/100/100 (cca 4.4 kg/ | `273362441` | `273362021` | Výztuž základů desek ze svařovaných sítí z drátů t | 0.50 |
| 260219_dum.HSV3.002 | Nadezdívka 3.NP a čela vikýřů — Porotherm 30 Profi | `311321411` | `311235151.WNR` | Zdivo jednovrstvé z cihel Porotherm 30 Profi P10 n | 0.49 |
| 260217_sklad.HSV1.002 | Hloubení figury pro objekt skladu v lichoběžníku 6 | `132211101` | `132201192` | Hloubení zapažených i nezapažených rýh šířky do 60 | 0.49 |
| 260219_dum.HSV5.009 | Nadkrokevní tepelná izolace PIR (polyisokyanurát)  | `713131811` | `713122134` | Izolace pro pochozí půdy izolace tepelná vkládaná  | 0.49 |
| 260219_dum.HSV1.003 | Hloubení figury pro anglický dvorek a nový vstup d | `132211101` | `132201192` | Hloubení zapažených i nezapažených rýh šířky do 60 | 0.47 |
| 260219_dum.PSV76.004 | Ocelové zábradlí svařované z jeklů + nerez výplň p | `767163115` | `767162811` | Demontáž zábradlí balkonového nebo lodžiového z hl | 0.47 |
| 260219_dum.HSV5.011 | Distanční kontralatě 40×60 mm pro vzduchovou mezer | `762331923` | `762136114` | Montáž bednění stěn  z hoblovaných latí s mezerami | 0.46 |
| 260217_sklad.HSV4.003 | Hydroizolační střešní souvrství skladu (modifikova | `712331101` | `711331383` | Provedení izolace mostovek pásy na sucho samolepíc | 0.46 |
| 260219_dum.HSV2.009 | Výztuž B500B věnce 100 kg/m³ (Methvin sazba pro po | `273361821` | `273361821` | Výztuž základů desek z betonářské oceli 10 505 (R) | 0.46 |
| 260219_dum.HSV5.015 | Vikýře — zděná čela z Porotherm 30 (odhad 4 ks × ~ | `311321411` | `311321411` | Nadzákladové zdi z betonu železového (bez výztuže) | 0.44 |
| 260217_sklad.HSV3.003 | Výztuž B500B do tvarovek ztraceného bednění (~30 k | `273361821` | `273361821` | Výztuž základů desek z betonářské oceli 10 505 (R) | 0.44 |
| 260219_dum.HSV2.004 | Výztuž bílé vany B500B 120 kg/m³ (empirická sazba  | `273361821` | `273361821` | Výztuž základů desek z betonářské oceli 10 505 (R) | 0.44 |
| 260219_dum.HSV2.013 | Výztuž ŽB desky 1.NP — kari 6/150/150 + B500B okra | `273361821` | `273361821` | Výztuž základů desek z betonářské oceli 10 505 (R) | 0.44 |
| 260217_sklad.HSV2.002 | Dvoustupňové patky pro IPE180 zastřešení parkingu  | `273313811` | `273313811` | Základy z betonu prostého desky z betonu kamenem n | 0.40 |
| 260217_sklad.HSV2.006 | ŽB schodišťová deska ve sklonu + základový pas — b | `273361821` | `273361821` | Výztuž základů desek z betonářské oceli 10 505 (R) | 0.40 |
| 260219_dum.HSV5.001 | Tesařský krov — krokve 100/180 mm á 800 mm, rezivo | `762331911` | `762331911` | Vázané konstrukce krovů  vyřezání části střešní va | 0.40 |
| 260219_dum.HSV5.003 | Tesařský krov — pozednice 140/160 mm kotvená do ŽB | `762331923` | `762331923` | Vázané konstrukce krovů  vyřezání části střešní va | 0.40 |
| 260217_sklad.VRN.001 | Podíl na obecných VRN domu (buňky, BOZP, pojištění | `030001000` | `030001000` | Zařízení staveniště | 0.40 |
| 260219_dum.HSV6.010 | Demontáž všech oken a dveří stávajících (recyklace | `968071120` | `968062355` | Vybourání dřevěných rámů oken s křídly, dveřních z | 0.38 |
| 260219_dum.HSV5.014 | Patro pro přespání v krovu — biodeska / OSB desky  | `762341711` | `762395000` | Spojovací prostředky krovů, bednění a laťování, na | 0.37 |
| 260219_dum.PSV76.010 | Vnitřní dveře DTD laminované s obložkovou zárubní  | `766660035` | `766682312` | Montáž zárubní dřevěných, plastových nebo z lamina | 0.37 |
| 260219_dum.VRN.001 | Zařízení staveniště — buňka kancelář + sociální bu | `030011000` | `030001000` | Zařízení staveniště | 0.36 |
| 260219_dum.HSV6.006 | Bourání 8 nových otvorů v nosných cihelných zdech  | `962031132` | `962081141` | Bourání příček nebo přizdívek ze skleněných tvárni | 0.35 |

## hint_weak (proposed code in DB but text disagrees — likely wrong leaf)

| id | popis | proposed_kod | catalog popis for that code | score |
|---|---|---|---|--:|
| 260219_dum.HSV1.008 | Zhutněný štěrkopískový zásyp + lože pod ŽB deskou  | `174101101` | Zásyp sypaninou z jakékoliv horniny  s uložením výkopku ve v | 0.58 |
| 260217_sklad.HSV1.005 | Zhutněný štěrkopískový násyp pod podlahu skladu +  | `174101101` | Zásyp sypaninou z jakékoliv horniny  s uložením výkopku ve v | 0.55 |
| 260219_dum.HSV2.007 | ŽB pozední věnec 300×250 mm po obvodu nadezdívky 3 | `274321311` | Základy z betonu železového (bez výztuže) pasy z betonu bez  | 0.55 |
| 260219_dum.HSV2.010 | Nabetonávka stropu 2.NP/3.NP — beton C25/30 XC1 tl | `274321111` | Základy z betonu železového (bez výztuže) pasy z betonu bez  | 0.55 |
| 260219_dum.HSV2.012 | ŽB deska podlahy 1.NP na terénu tl. 150 mm, C25/30 | `273321311` | Základy z betonu železového (bez výztuže) desky z betonu bez | 0.55 |
| 260217_sklad.HSV2.005 | Štěrkopískové lože pod podlahu skladu + pod schodi | `174101101` | Zásyp sypaninou z jakékoliv horniny  s uložením výkopku ve v | 0.55 |

## urs_search_needed — open podminky.urs.cz manually

| id | popis | proposed | URS link |
|---|---|---|---|
| 260219_dum.HSV1.004 | Anglický dvorek: betonová dlažba 50 mm + kladecí vrstva kame | `564831111` | [search](https://podminky.urs.cz/?vyhledavani=564831111) |
| 260219_dum.HSV1.005 | Terasa za opěrnou stěnou: rektifikovatelné terče 50 mm + bet | `564831111` | [search](https://podminky.urs.cz/?vyhledavani=564831111) |
| 260217_sklad.HSV1.001 | Sejmutí ornice a demolice stávajících kamenných zídek a scho | `962031132` | [search](https://podminky.urs.cz/?vyhledavani=962031132) |
| 260217_sklad.HSV1.004 | Hloubení patek pro stojky IPE180 zastřešení parkingu, 500×50 | `132211101` | [search](https://podminky.urs.cz/?vyhledavani=132211101) |
| 260219_dum.HSV2.001 | Bílá vana ČBS 02 — pata úhlové opěrné stěny 250×1200 mm × L= | `274321321` | [search](https://podminky.urs.cz/?vyhledavani=274321321) |
| 260219_dum.HSV2.002 | Bílá vana ČBS 02 — stěna úhlová tl. 250 mm × výška 2050 mm × | `274321321` | [search](https://podminky.urs.cz/?vyhledavani=274321321) |
| 260219_dum.HSV2.003 | Systémové oboustranné bednění bílé vany — DOKA Framax / PERI | `631311115` | [search](https://podminky.urs.cz/?vyhledavani=631311115) |
| 260219_dum.HSV2.006 | Mokré ošetřování betonu bílé vany min. 7 dní dle ČSN EN 1367 | `279351102` | [search](https://podminky.urs.cz/?vyhledavani=279351102) |
| 260219_dum.HSV2.008 | Bednění pozedního věnce systémové oboustranné | `631311115` | [search](https://podminky.urs.cz/?vyhledavani=631311115) |
| 260217_sklad.HSV2.003 | Dvoustupňové patky pro IPE180 — horní část z tvarovek ztrace | `311233812` | [search](https://podminky.urs.cz/?vyhledavani=311233812) |
| 260217_sklad.HSV2.004 | Beton C25/30 XC3 XF1 XA1 pro zalití tvarovek ZB patek + lemu | `273321321` | [search](https://podminky.urs.cz/?vyhledavani=273321321) |
| 260219_dum.HSV3.003 | Ocelové překlady IPN160 ve dvojici nad otvory pro nové dveře | `317143112` | [search](https://podminky.urs.cz/?vyhledavani=317143112) |
| 260219_dum.HSV3.004 | Maltové uložení překladů IPN160 — MC25 tl. 50 mm + kari 5/10 | `317242421` | [search](https://podminky.urs.cz/?vyhledavani=317242421) |
| 260219_dum.HSV3.005 | Zesílení ostění úhelníky L100/10 dvojicí u otvoru u komínové | `767131120` | [search](https://podminky.urs.cz/?vyhledavani=767131120) |
| 260219_dum.HSV3.006 | Dočasné podstojkování stávajících přiléhajících stropů při o | `962081120` | [search](https://podminky.urs.cz/?vyhledavani=962081120) |
| 260219_dum.HSV3.007 | Nové příčky z pórobetonových tvárnic 150 mm na lepidlo + dil | `342241211` | [search](https://podminky.urs.cz/?vyhledavani=342241211) |
| 260217_sklad.HSV3.002 | Obvodové stěny skladu — tvarovky ztraceného bednění tl. 250  | `311233811` | [search](https://podminky.urs.cz/?vyhledavani=311233811) |
| 260219_dum.HSV4.001 | Ocelová stropnice IPE180 1.NP v pozici nové příčky 2.NP — do | `411321414` | [search](https://podminky.urs.cz/?vyhledavani=411321414) |
| 260219_dum.HSV4.002 | Ocelobetonový strop 2.NP/3.NP — stropnice IPE180 á 1000 mm × | `411321414` | [search](https://podminky.urs.cz/?vyhledavani=411321414) |
| 260219_dum.HSV4.003 | Ocelobetonový strop — výztuha 2×HEA180 trakt do ulice (Fibic | `411321414` | [search](https://podminky.urs.cz/?vyhledavani=411321414) |
| 260219_dum.HSV4.004 | Ocelobetonový strop — výztuha HEA200 dvorní trakt, dl. ~10 m | `411321414` | [search](https://podminky.urs.cz/?vyhledavani=411321414) |
| 260219_dum.HSV4.005 | Trapézový plech 40S/160 tl. 0.75 mm — dodávka + montáž na st | `411321414` | [search](https://podminky.urs.cz/?vyhledavani=411321414) |
| 260219_dum.HSV4.006 | Protipožární SDK podhled pod trapézovým plechem (EI 30 dle P | `342213131` | [search](https://podminky.urs.cz/?vyhledavani=342213131) |
| 260219_dum.HSV4.007 | Vyvezení původního zásypu z cihelné klenby 1.PP/1.NP — manuá | `974031150` | [search](https://podminky.urs.cz/?vyhledavani=974031150) |
| 260219_dum.HSV4.008 | Nový zásyp klenby 1.PP/1.NP — perlitbeton (lehký zásyp) tl.  | `271223111` | [search](https://podminky.urs.cz/?vyhledavani=271223111) |
| 260219_dum.HSV4.009 | Plastická perlitbetonová roznášecí vrstva tl. 50 mm nad zásy | `631321311` | [search](https://podminky.urs.cz/?vyhledavani=631321311) |
| 260219_dum.HSV4.010 | Strop trámový 1.NP/2.NP — sejmutí podlah, demontáž záklopu a | `974041141` | [search](https://podminky.urs.cz/?vyhledavani=974041141) |
| 260219_dum.HSV4.012 | Protipožární SDK podhled zespodu trámového stropu (EI 30 dle | `342213131` | [search](https://podminky.urs.cz/?vyhledavani=342213131) |
| 260219_dum.HSV4.013 | Suchá podlahová skladba 1.NP/2.NP — zásyp Liapor pro vyrovná | `631311114` | [search](https://podminky.urs.cz/?vyhledavani=631311114) |
| 260219_dum.HSV4.014 | Suchá podlahová skladba — sádrovláknité dílce Fermacell tl.  | `771421111` | [search](https://podminky.urs.cz/?vyhledavani=771421111) |
| 260217_sklad.HSV4.001 | Dřevěné stropnice 100/160 mm á 625 mm primární zastřešení sk | `762341110` | [search](https://podminky.urs.cz/?vyhledavani=762341110) |
| 260217_sklad.HSV4.002 | Prkenný záklop stropnic skladu tl. 20 mm + impregnace | `762331110` | [search](https://podminky.urs.cz/?vyhledavani=762331110) |
| 260217_sklad.HSV4.004 | Sekundární zastřešení parkingu — IPE180 v rozteči 1000 mm ×  | `411321414` | [search](https://podminky.urs.cz/?vyhledavani=411321414) |
| 260217_sklad.HSV4.005 | Pojezdové ocelové pororošty demontovatelné — povrch parkingu | `411321515` | [search](https://podminky.urs.cz/?vyhledavani=411321515) |
| 260217_sklad.HSV4.006 | Žárově zinková povrchová úprava IPE180 + pororoštů dle ČSN E | `783201001` | [search](https://podminky.urs.cz/?vyhledavani=783201001) |
| 260219_dum.HSV5.005 | Ocelová středová vaznice HEA160 — 2 ks × cca 10 m délka | `411321414` | [search](https://podminky.urs.cz/?vyhledavani=411321414) |
| 260219_dum.HSV5.006 | Ocelové sloupky uzavřený profil 100×100×4 mm pod vaznice HEA | `411321414` | [search](https://podminky.urs.cz/?vyhledavani=411321414) |
| 260219_dum.HSV5.008 | Parotěsná folie nad bedněním pod nadkrokevní PIR (např. Isov | `712311101` | [search](https://podminky.urs.cz/?vyhledavani=712311101) |
| 260219_dum.HSV5.010 | Doplňková hydroizolační difuzně otevřená folie nad PIR pod k | `712311111` | [search](https://podminky.urs.cz/?vyhledavani=712311111) |
| 260219_dum.HSV5.012 | Bednění z prken tl. 25 mm pod plechovou hliníkovou krytinu ( | `762341711` | [search](https://podminky.urs.cz/?vyhledavani=762341711) |
| 260219_dum.HSV5.013 | Plechová falcovaná HLINÍKOVÁ krytina (např. PREFA, Rheinzink | `765791121` | [search](https://podminky.urs.cz/?vyhledavani=765791121) |
| 260219_dum.HSV5.016 | Vikýře — provětrávaná fasáda min. vata + plech falcovaný hli | `765791121` | [search](https://podminky.urs.cz/?vyhledavani=765791121) |
| 260219_dum.HSV6.001 | Bourání kompletního stávajícího krovu vč. vikýřů — vaznicový | `962041141` | [search](https://podminky.urs.cz/?vyhledavani=962041141) |
| 260219_dum.HSV6.003 | Bourání zděných nadezdívek nad stropem 2.NP (mimo štítových  | `962031132` | [search](https://podminky.urs.cz/?vyhledavani=962031132) |
| 260219_dum.HSV6.004 | Bourání trámového stropu 2.NP/podkroví — kompletně (vč. zaji | `962041141` | [search](https://podminky.urs.cz/?vyhledavani=962041141) |
| 260219_dum.HSV6.008 | Sejmutí podlah 1.NP a 2.NP — vč. nášlapů, podkladních vrstev | `974031132` | [search](https://podminky.urs.cz/?vyhledavani=974031132) |
| 260219_dum.HSV6.009 | Demontáž záklopu a zásypů stropu 1.NP (prkenný záklop na trá | `974041151` | [search](https://podminky.urs.cz/?vyhledavani=974041151) |
| 260219_dum.HSV6.011 | Demontáž všech sanitárních zařizovacích předmětů (WC, umyvad | `725900001` | [search](https://podminky.urs.cz/?vyhledavani=725900001) |
| 260219_dum.HSV7.001 | Příprava fasádního podkladu — očištění tlakovou vodou, vyspr | `622401110` | [search](https://podminky.urs.cz/?vyhledavani=622401110) |
| 260219_dum.HSV7.003 | ETICS sokl — XPS λ=0.034 tl. 120 mm + soklový profil + cihel | `622223111` | [search](https://podminky.urs.cz/?vyhledavani=622223111) |
| 260219_dum.HSV7.004 | Špalety oken — EPS přesah 35-40 mm + síťka + omítka | `622221221` | [search](https://podminky.urs.cz/?vyhledavani=622221221) |
| 260219_dum.HSV7.005 | Profilace fasády — různé tloušťky EPS (kordony, šambrány, rá | `622221221` | [search](https://podminky.urs.cz/?vyhledavani=622221221) |
| 260219_dum.PSV71.001 | Hydroizolace pod ŽB deskou 1.NP — modifikované asfaltové pás | `712311101` | [search](https://podminky.urs.cz/?vyhledavani=712311101) |
| 260219_dum.PSV71.002 | Odvětrání radonu z podloží — perforované DN50 trubky v štěrk | `712381111` | [search](https://podminky.urs.cz/?vyhledavani=712381111) |
| 260219_dum.PSV76.001 | Plastové okno izolačním trojsklem Uw=0.85 W/m²K — typ 'okno  | `766621011` | [search](https://podminky.urs.cz/?vyhledavani=766621011) |
| 260219_dum.PSV76.002 | Plastové okno izolačním trojsklem Uw=0.85 W/m²K — typ 'okno  | `766621011` | [search](https://podminky.urs.cz/?vyhledavani=766621011) |
| 260219_dum.PSV76.003 | Plastové okno izolačním trojsklem Uw=0.85 W/m²K — typ 'okno  | `766621011` | [search](https://podminky.urs.cz/?vyhledavani=766621011) |
| 260219_dum.PSV76.004 | Plastové okno izolačním trojsklem Uw=0.85 W/m²K — typ 'okno  | `766621011` | [search](https://podminky.urs.cz/?vyhledavani=766621011) |
| 260219_dum.PSV76.005 | Plastové okno izolačním trojsklem Uw=0.85 W/m²K — typ 'okno  | `766621011` | [search](https://podminky.urs.cz/?vyhledavani=766621011) |
| 260219_dum.PSV76.006 | Plastové okno izolačním trojsklem Uw=0.85 W/m²K — typ 'okno  | `766621011` | [search](https://podminky.urs.cz/?vyhledavani=766621011) |
| 260219_dum.PSV76.007 | Plastové okno izolačním trojsklem Uw=0.85 W/m²K — typ 'okno  | `766621011` | [search](https://podminky.urs.cz/?vyhledavani=766621011) |
| 260219_dum.PSV76.001 | Klempířské oplechování krytiny — úžlabí, hřeben, štítové lem | `764312235` | [search](https://podminky.urs.cz/?vyhledavani=764312235) |
| 260219_dum.PSV76.002 | Venkovní parapety oken — Pzn plech lakovaný 250 mm × tl. 0.5 | `764218201` | [search](https://podminky.urs.cz/?vyhledavani=764218201) |
| 260219_dum.PSV76.003 | Dešťové svody Pzn 100 mm + žlaby — 4 svody × ~14 m + žlaby p | `764454802` | [search](https://podminky.urs.cz/?vyhledavani=764454802) |
| 260219_dum.PSV76.004 | Klempířské doplňky vikýřů + atika + závětrné lemy (4 vikýře  | `764315235` | [search](https://podminky.urs.cz/?vyhledavani=764315235) |
| 260219_dum.PSV76.001 | Ocelové schodiště ze zahrady na mezipodestu — UPE200 schodni | `767531111` | [search](https://podminky.urs.cz/?vyhledavani=767531111) |
| 260219_dum.PSV76.002 | Interní ocelové schodiště do spacího patra v 3.NP s dřevěným | `767531111` | [search](https://podminky.urs.cz/?vyhledavani=767531111) |
| 260219_dum.PSV76.003 | Stříšky nad vstupy z ocelové konstrukce + Cetris desky + fal | `767532111` | [search](https://podminky.urs.cz/?vyhledavani=767532111) |
| 260219_dum.PSV76.001 | Dřevěné stupně ocelových schodišť (truhlářské, dub masiv tl. | `766811111` | [search](https://podminky.urs.cz/?vyhledavani=766811111) |
| 260219_dum.PSV76.002 | Dřevěná terasa za opěrnou stěnou — prkna garapa 145×25 mm na | `771474112` | [search](https://podminky.urs.cz/?vyhledavani=771474112) |
| 260219_dum.PSV77.001 | Nášlapná vrstva vinyl tl. 4 mm na suchou skladbu — obytné mí | `776511820` | [search](https://podminky.urs.cz/?vyhledavani=776511820) |
| 260219_dum.PSV77.002 | Nášlapná vrstva keramická dlažba lepená — koupelny + WC + sp | `771274102` | [search](https://podminky.urs.cz/?vyhledavani=771274102) |
| 260219_dum.PSV77.003 | Nášlapná vrstva keramická dlažba — 1.PP technické místnosti  | `771274102` | [search](https://podminky.urs.cz/?vyhledavani=771274102) |
| 260219_dum.PSV77.004 | Nášlapná vrstva biodeska (smrk masiv) nebo OSB v 3.NP spací  | `766411111` | [search](https://podminky.urs.cz/?vyhledavani=766411111) |
| 260219_dum.PSV77.005 | Mokrá podlahová skladba — betonový potěr s kari síťkou 4/100 | `631321311` | [search](https://podminky.urs.cz/?vyhledavani=631321311) |
| 260219_dum.PSV77.006 | Soklíky podlahové laminátové (dub) v obytných místnostech s  | `776511831` | [search](https://podminky.urs.cz/?vyhledavani=776511831) |
| 260219_dum.PSV77.007 | Soklíky keramické v místnostech s dlažbou (koupelny + WC + s | `771274107` | [search](https://podminky.urs.cz/?vyhledavani=771274107) |
| 260219_dum.PSV78.001 | Omítka jádrová vápenocementová tl. 15 mm + štuková povrchová | `612311311` | [search](https://podminky.urs.cz/?vyhledavani=612311311) |
| 260219_dum.PSV78.002 | Omítka jádrová vápenocementová tl. 15 mm + štuková povrchová | `612311311` | [search](https://podminky.urs.cz/?vyhledavani=612311311) |
| 260219_dum.PSV78.003 | Omítka jádrová vápenocementová tl. 15 mm + štuková povrchová | `612311311` | [search](https://podminky.urs.cz/?vyhledavani=612311311) |
| 260219_dum.PSV78.004 | Omítka jádrová vápenocementová tl. 15 mm + štuková povrchová | `612311311` | [search](https://podminky.urs.cz/?vyhledavani=612311311) |
| 260219_dum.PSV78.005 | SDK podhled + případné předstěny — tmelení spojů Q3 + povrch | `612471141` | [search](https://podminky.urs.cz/?vyhledavani=612471141) |
| 260219_dum.PSV78.006 | SDK podhled + případné předstěny — tmelení spojů Q3 + povrch | `612471141` | [search](https://podminky.urs.cz/?vyhledavani=612471141) |
| 260219_dum.PSV78.007 | SDK podhled + případné předstěny — tmelení spojů Q3 + povrch | `612471141` | [search](https://podminky.urs.cz/?vyhledavani=612471141) |
| 260219_dum.PSV78.008 | Keramický obklad stěn koupelny 1.05 1.NP — výška obkladu 1.6 | `781447001` | [search](https://podminky.urs.cz/?vyhledavani=781447001) |
| 260219_dum.PSV78.009 | Keramický obklad stěn koupelny 2.03 2.NP — výška obkladu 2.4 | `781447001` | [search](https://podminky.urs.cz/?vyhledavani=781447001) |
| 260219_dum.PSV78.010 | Keramický obklad stěn koupelny 3.04 3.NP — výška obkladu 2.7 | `781447001` | [search](https://podminky.urs.cz/?vyhledavani=781447001) |
| 260219_dum.PSV78.011 | Keramický obklad za kuchyňskou linkou nad pracovní deskou —  | `781447001` | [search](https://podminky.urs.cz/?vyhledavani=781447001) |
| 260219_dum.PSV95.001 | Autonomní hlásič kouře dle ČSN EN 14604 — 4 ks v místnostech | `375211101` | [search](https://podminky.urs.cz/?vyhledavani=375211101) |
| 260219_dum.PSV95.002 | Přenosný hasicí přístroj 34A dle PBŘ — min. 1 ks na společné | `966067121` | [search](https://podminky.urs.cz/?vyhledavani=966067121) |
| 260219_dum.PSV72.001 | Revize stávajícího napojení vodovodu + kanalizace na pozemku | `722290515` | [search](https://podminky.urs.cz/?vyhledavani=722290515) |
| 260219_dum.PSV72.002 | Nové rozvody studené + teplé vody do koupelen 1.NP + 2.NP +  | `722172011` | [search](https://podminky.urs.cz/?vyhledavani=722172011) |
| 260219_dum.PSV72.004 | Sanitární keramika dodávka + montáž v koupelně 1.05 1.NP: 1× | `725291131` | [search](https://podminky.urs.cz/?vyhledavani=725291131) |
| 260219_dum.PSV72.005 | Sanitární keramika dodávka + montáž v koupelně 2.03 2.NP: 1× | `725291131` | [search](https://podminky.urs.cz/?vyhledavani=725291131) |
| 260219_dum.PSV72.006 | Sanitární keramika dodávka + montáž v koupelně 3.04 3.NP: 1× | `725291131` | [search](https://podminky.urs.cz/?vyhledavani=725291131) |
| 260219_dum.PSV72.007 | Kuchyňský dřez nerez + montáž — 2 ks (kuchyně 1.06 byt rodič | `725840111` | [search](https://podminky.urs.cz/?vyhledavani=725840111) |
| 260219_dum.PSV72.008 | Vodovodní baterie (WC ventil + páková umyvadlová + sprchové  | `725822611` | [search](https://podminky.urs.cz/?vyhledavani=725822611) |
| 260219_dum.PSV72.010 | Elektrický bojler ~80 l v koupelně 3.NP (nezávislý zdroj pro | `732429211` | [search](https://podminky.urs.cz/?vyhledavani=732429211) |
| 260219_dum.PSV73.001 | Sporáková kamna na tuhá paliva ~10 kW s akumulačním zásobník | `733241011` | [search](https://podminky.urs.cz/?vyhledavani=733241011) |
| 260219_dum.PSV73.002 | Sporáková kamna — montáž vč. napojení na komín + akumulační  | `733281011` | [search](https://podminky.urs.cz/?vyhledavani=733281011) |
| 260219_dum.PSV73.003 | Elektrokotel ~8 kW pro 3.NP samostatný byt — dodávka + montá | `733131221` | [search](https://podminky.urs.cz/?vyhledavani=733131221) |
| 260219_dum.PSV73.004 | Krb na tuhá paliva v 3.NP ~6 kW — dodávka + montáž s napojen | `733241011` | [search](https://podminky.urs.cz/?vyhledavani=733241011) |
| 260219_dum.PSV73.005 | Multisplit tepelné čerpadlo vzduch-vzduch — 1× venkovní jedn | `733425211` | [search](https://podminky.urs.cz/?vyhledavani=733425211) |
| 260219_dum.PSV73.006 | Multisplit TČ — 5× vnitřní jednotka v obytných místnostech ( | `733425221` | [search](https://podminky.urs.cz/?vyhledavani=733425221) |
| 260219_dum.PSV73.007 | Revize stávajícího komínu — kontrola, čištění, vystrojení vl | `734262122` | [search](https://podminky.urs.cz/?vyhledavani=734262122) |
| 260219_dum.PSV73.008 | Rozvody otopné soustavy Cu/PEX k vnitřním jednotkám TČ + rad | `733111021` | [search](https://podminky.urs.cz/?vyhledavani=733111021) |
| 260219_dum.M21.001 | Demontáž stávající elektroinstalace v celém domě (vodiče, ro | `210010011` | [search](https://podminky.urs.cz/?vyhledavani=210010011) |
| 260219_dum.M21.002 | Nová pojistková skříň + 3× podružný rozvaděč pro každé patro | `210110023` | [search](https://podminky.urs.cz/?vyhledavani=210110023) |
| 260219_dum.M21.003 | Nové silnoproudé rozvody — vodiče CYKY 3×1.5 / 3×2.5 / 5×2.5 | `210800012` | [search](https://podminky.urs.cz/?vyhledavani=210800012) |
| 260219_dum.M21.004 | Zásuvky a vypínače dodávka + montáž — ~70 ks (60-80 dle vyja | `210810050` | [search](https://podminky.urs.cz/?vyhledavani=210810050) |
| 260219_dum.M21.005 | Svítidla dodávka + montáž — ~35 ks (30-40 dle vyjasnění #7)  | `210820002` | [search](https://podminky.urs.cz/?vyhledavani=210820002) |
| 260219_dum.M21.006 | Příprava na osazení FVE — rezerva v rozvaděči (jistič + zásu | `210800099` | [search](https://podminky.urs.cz/?vyhledavani=210800099) |
| 260219_dum.M21.007 | Výchozí revize elektrické instalace dle ČSN 33 2000-6 + revi | `996019011` | [search](https://podminky.urs.cz/?vyhledavani=996019011) |
| 260219_dum.VRN.002 | Mobilní chemické WC TOI TOI pro pracovníky — pronájem ~8 měs | `030013000` | [search](https://podminky.urs.cz/?vyhledavani=030013000) |
| 260219_dum.VRN.001 | Kontejnery na suť tříděnou velkoobjemové (beton/cihly, dřevo | `997013211` | [search](https://podminky.urs.cz/?vyhledavani=997013211) |
| 260219_dum.VRN.001 | Koordinátor BOZP na staveništi dle zákona 309/2006 Sb. — pro | `030091000` | [search](https://podminky.urs.cz/?vyhledavani=030091000) |
| 260219_dum.VRN.001 | Montážní pojištění stavby (CAR) + pojištění odpovědnosti za  | `030081000` | [search](https://podminky.urs.cz/?vyhledavani=030081000) |
| 260219_dum.VRN.001 | Mykologický průzkum stávajícího krovu a dřevěných trámů zhla | `030131000` | [search](https://podminky.urs.cz/?vyhledavani=030131000) |
| 260219_dum.VRN.001 | Geodetické zaměření před realizací (verifikace polohopis + v | `030141000` | [search](https://podminky.urs.cz/?vyhledavani=030141000) |
| 260219_dum.VRN.001 | Předávací protokoly + Dokumentace skutečného provedení (DSP) | `030151000` | [search](https://podminky.urs.cz/?vyhledavani=030151000) |
| 260219_dum.VRN.001 | Revize vnějšího hydrantu pro požární zabezpečení (DN min. 80 | `030161000` | [search](https://podminky.urs.cz/?vyhledavani=030161000) |
| 260219_dum.VRN.002 | Doprava materiálu na stavbu (centrální koordinace) — paušál  | `031031000` | [search](https://podminky.urs.cz/?vyhledavani=031031000) |
| 260217_sklad.VRN.001 | Doprava prefa H-BLOK Standard z výrobny Herkul (Obrnice) aut | `031032000` | [search](https://podminky.urs.cz/?vyhledavani=031032000) |
| 260217_sklad.VRN.001 | Geodetické vytýčení sklad+parking+schodiště ze situace (před | `030141000` | [search](https://podminky.urs.cz/?vyhledavani=030141000) |
---

## Appendix A — WebSearch verification (12 sample queries)

`podminky.urs.cz` returns HTTP 403 to non-browser agents (WebFetch blocked). But **WebSearch via Google indexes the same content** through public mirrors (`smlouvy.gov.cz`, `vhodne-uverejneni.cz`, `docplayer.cz`, `cs-urs.cz`). The Claude Code WebSearch tool aggregates 10 snippets per query and the underlying LLM summary extracts URS popis when sufficiently anchored.

12 verification queries executed against the 12 `hint_strong` items. Findings:

| Code | Verdict | Affects items | Note |
|---|---|---|---|
| `121101101` | code_real | HSV1.001 | "Sejmutí ornice ... do 50 m" m³ — leaf may need distance check |
| `132201101` | **matches_item** ✅ | HSV1.002, sklad.HSV1.003 | "Hloubení rýh š do 600 mm v hornině tř. 3 objemu do 100 m3" — exact |
| `162701105` | wrong_leaf | HSV1.007, sklad.HSV1.006 | URS leaf = 9-10 km, item = 8 km → use 162701104 |
| `711132101` | wrong_leaf | HSV2.005, PSV71.003 | URS leaf = AIP bituminous rolls, items = PE foil + stěrka → different leaf in 711 family |
| `962081141` | wrong_work_type | HSV6.002, HSV6.007 | URS = glass-block partitions, items = plech krytina + keramické obklady → entirely different family |
| `771121011` | wrong_work_type | sklad.PSV77.001 | URS = floor primer, item = betonová dlažba install → wrong work |
| `713141121` | wrong_work_location | PSV71.001, PSV71.002 | URS = střechy, items = podlahy → 713141xxx is roof family, podlahy = 713121xxx |
| `273313811` | wrong_geometry | sklad.HSV2.001 | URS = desky C25/30, item = pasy C16/20 → different geometry + class |
| `781471810` | **correct_code** ✅ | HSV6.007 | "Demontáž obkladů z dlaždic kladených do malty" — proposed replacement |
| `781473810` | **correct_code** ✅ | HSV6.007 | "Demontáž obkladů z dlaždic lepených" — likely best match for modern koupelna |
| `978059511` | alternative | HSV6.007 | "Odsekání obkladů stěn do 1 m2" |
| `978059541` | alternative | HSV6.007 | "Odsekání obkladů stěn přes 1 m2" |

### Key finding

Heuristic `urs_code_proposed` in `phase1_items_generator.py` correctly guessed the first-6-digit FAMILY in **6 of 8 verified codes** but the **9-digit LEAF was wrong** (different distance band, different material, different geometry, different work location). The remaining 2 were wrong even at family level (962… for plech krytina + obklady).

Generator improvement candidate: emit first 6 digits + leaf=NULL + family description, leaving leaf disambiguation to Part 5b lookup pass instead of guessing.

### Sample size caveat

Only 12 / 189 items verified via WebSearch — sample selected as the 12 `hint_strong` (highest auto-confidence from local DB matcher). Full verification of remaining 177 items requires `URS_MATCHER_SERVICE` Perplexity client (which user runs locally — sandbox can't invoke). Each WebSearch call costs ~0.5–1 USD on this account, so brute-force 189-query batch is impractical here; targeted manual verification of `hint_strong` + critical `urs_search_needed` is the cost-efficient path.

Full structured data in `outputs/urs_websearch_verifications.json`.
