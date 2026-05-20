# Completeness Audit — RD Jáchymov items.json

**Generated:** 2026-05-19
**Items total:** 189
**TZ files scanned:** 7

> **Pozor.** Tato kontrola dělá strukturovaný sweep — neznačí *garanci* úplnosti.
> Cíl: poskytnout worksheet kde uživatel rychle vidí potenciální mezery.
> Mnoho 'missing' anchor položek mohou být ve skutečnosti přítomny pod jiným popis-stringem.
> Sekce D (TZ verb scan) má největší false-positive rate (regex noise).

## Souhrn (top-line gaps)

| Sekce | Metrika | Hodnota |
|---|---|--:|
| A. TKP families | rodin s ≥1 položkou / total | 9 / 10 |
| A. TKP families | položek bez kódu | 0 |
| B. Subdodavatel | trades s ≥1 položkou / 36 | 36 / 36 |
| C. RD anchors | OK / applicable / missing | 59 / 66 / **7** |
| C. RD anchors | N/A (per project) | 1 |
| D. TZ verbs | covered / unique | 16 / 70 |

---

## Sekce A — TKP family coverage

| TKP | Popis | N položek | Vzorek |
|--:|---|--:|---|
| 0 | VRN, společné konstrukce, ZS, doprava | 16 | `260219_dum.VRN.001`; `260219_dum.VRN.002` |
| 1 | Zemní práce (sejmutí ornice, hloubení rýh/jam, výkopy) | 12 | `260219_dum.HSV1.001`; `260219_dum.HSV1.002` |
| 2 | Základové konstrukce, ŽB pasy/desky/věnce, hydroizolace | 22 | `260219_dum.HSV2.001`; `260219_dum.HSV2.002` |
| 3 | Svislé konstrukce (zdivo, příčky, sloupy) | 12 | `260217_sklad.HSV2.003`; `260219_dum.HSV3.001` |
| 4 | Vodorovné konstrukce (stropy, schodiště, překlady) | 9 | `260219_dum.HSV4.001`; `260219_dum.HSV4.002` |
| 5 | Komunikace, zpevněné plochy, dlažby (NA mostech / silnicích — pro RD typicky 564 chodník + dvorek) | 3 | `260219_dum.HSV1.004`; `260219_dum.HSV1.005` |
| 6 | Úpravy povrchů, omítky vnitřní/vnější, ETICS | 18 | `260219_dum.HSV2.003`; `260219_dum.HSV2.008` |
| 7 | Konstrukce ostatní (izolace, výplně otvorů, klempířina, podlahy, malby, obklady) | 79 | `260219_dum.HSV2.005`; `260219_dum.HSV3.005` |
| 8 | Trubní vedení (kanalizace venkovní, vodovod venkovní) | 0 🟠 GAP |  |
| 9 | Ostatní konstrukce (bourání, demolice, lešení, přesun hmot, VRN konstrukčního charakteru) | 18 | `260217_sklad.HSV1.001`; `260219_dum.HSV3.006` |

---

## Sekce B — Subdodavatel coverage

| Trade | Label | N položek | Kapitoly | Status |
|---|---|--:|---|---|
| `zemni_prace` | Zemní práce | 12 | HSV-1 | ✓ |
| `zelezobetonarsky_specialny` | ŽB práce — komplexní (bednění + výztuž + betonáž + ošetření) | 12 | HSV-2 | ✓ |
| `bila_vana_csb02` | Bílá vana ČBS 02 — specialista (těsnění + dohled betonáže) | 4 | HSV-2 | ✓ |
| `bednici_tesar` | Bednící tesař (systémové bednění + odbednění) | 1 | HSV-2, HSV-5 | ✓ |
| `zednik` | Zedník | 11 | HSV-3, PSV-78 | ✓ |
| `ocel_zamecnik_konstrukce` | Zámečník ocelových konstrukcí — IPE/HEA/UPE/L (dodávka + montáž) | 8 | HSV-3, HSV-4, HSV-5, PSV-76 | ✓ |
| `ocelobeton_strop_IPE_trapez` | Ocelobetonový strop hybridní (IPE + trapéz + nabetonávka) — komplexní dodavatel | 6 | HSV-4 | ✓ |
| `krov_tesarsky_kompletni` | Tesařský krov — komplexní (krokve + kleštiny + pozednice + bednění + PIR + kontralatě) | 10 | HSV-5 | ✓ |
| `plech_falcovany_hlinik` | Klempíř — falcovaná hliníková krytina (specialista) | 2 | HSV-5 | ✓ |
| `klempir` | Klempíř (plech Pzn lakovaný + falcování + svody) | 4 | HSV-4, PSV-76 | ✓ |
| `bourani_demolice` | Demoliční práce (manuální + odvoz + likvidace) | 18 | HSV-6 | ✓ |
| `fasadnik_etics` | Fasádník ETICS (kontaktní zateplení + omítka) | 6 | HSV-7 | ✓ |
| `izolater_HI` | Izolatér hydroizolace (asfaltové pásy + folie) | 7 | PSV-71 | ✓ |
| `izolater_TI` | Izolatér tepelná izolace (EPS, MW, PIR) | 4 | PSV-71 | ✓ |
| `vodar` | Instalatér ZTI (vodovod + kanalizace + sanita) | 9 | PSV-72 | ✓ |
| `topenar` | Topenář (ÚT rozvody + kotle + radiátory + TUV) | 5 | PSV-73 | ✓ |
| `specialista_TC_multisplit` | Specialista tepelné čerpadlo + chlazení (multisplit) | 2 | PSV-73 | ✓ |
| `kominik` | Kominík — revize a údržba komínů | 1 | PSV-73 | ✓ |
| `okennar` | Okenář (plastová okna + venkovní žaluzie) | 8 | PSV-76 | ✓ |
| `truhlar` | Truhlář (vnitřní dveře, dřevěné stupně schodiště, vestavby) | 3 | PSV-76 | ✓ |
| `zamecnik_PSV` | Zámečník PSV (zábradlí, schodiště ocel, stříšky) | 4 | PSV-76 | ✓ |
| `podlahar` | Podlahář (suchá + mokrá skladba + nášlap) | 9 | PSV-77 | ✓ |
| `malir` | Malíř (interiérová výmalba + tmely) | 1 | PSV-78 | ✓ |
| `obkladac` | Obkladač (keramický obklad koupelny, kuchyně) | 7 | PSV-78 | ✓ |
| `sadrokartonar` | Sádrokartonář (SDK podhledy, předstěny, suché podlahy) | 5 | HSV-4, PSV-77, PSV-78 | ✓ |
| `elektroinstalater` | Elektroinstalatér silnoproud (kompletní ELI + příprava FVE) | 7 | M-21 | ✓ |
| `revize_specialista` | Revize (ELI, hydrant, komín, plyn) | 2 | M-21, VRN | ✓ |
| `VRN_management` | VRN — generální dodavatel (zařízení staveniště, BOZP, doprava, likvidace) | 11 | VRN | ✓ |
| `geodet` | Geodet (vytýčení, polohopis, výškopis) | 2 | VRN | ✓ |
| `specialista_RC3_dvere` | Specialista bezpečnostní dveře RC3 (sklad) | 1 | PSV-76 | ✓ |
| `prefa_bloky_specialista` | Specialista prefa bloků s autem s hydraulickou rukou (Herkul H-BLOK) | 2 | HSV-3 | ✓ |
| `okenni_zaluzie_kastlik_purenit` | Okenář + venkovní žaluzie v kastlíku s purenitovou izolací | 1 | PSV-76 | ✓ |
| `biodeska_konstrukcni` | Konstrukční biodeska (smrk masiv / OSB / X-LAM) pro půdní vestavby a nášlapy | 1 | PSV-77, HSV-5 | ✓ |
| `instalater_TUV_akumulacni_zasobnik` | Instalatér akumulačního zásobníku TUV pro multivariantní topný systém | 1 | PSV-72, PSV-73 | ✓ |
| `mykolog` | Autorizovaný mykolog dřeva (specialty surveyor) | 1 | VRN | ✓ |
| `azbestovy_specialista` | Autorizovaný technik azbestu (odběr + laboratorní posudek) | 1 | VRN | ✓ |

---

## Sekce C — RD renovation anchor checklist

| ID | Anchor | Status | N | Vzorek items |
|---|---|---|--:|---|
| D01 | Bourání plechové krytiny | ✓ | 3 | `260219_dum.HSV5.013`; `260219_dum.HSV6.002`; `260219_dum.PSV76.003` |
| D02 | Bourání keramických obkladů | ✓ | 8 | `260219_dum.HSV6.007`; `260219_dum.PSV77.002`; `260219_dum.PSV77.003` |
| D03 | Bourání příček + zdiva | ✓ | 2 | `260219_dum.HSV3.007`; `260219_dum.HSV4.001` |
| D04 | Bourání podlah | ✓ | 1 | `260219_dum.HSV6.008` |
| D05 | Bourání střešní krytiny + krov | ❌ **MISSING** | 0 |  |
| D06 | Demontáž oken + dveří | ❌ **MISSING** | 0 |  |
| D07 | Odstranění komínu | ⚪ N/A | — | demolice_komin = False per project metadata |
| Z01 | Sejmutí ornice | ✓ | 2 | `260219_dum.HSV1.001`; `260217_sklad.HSV1.001` |
| Z02 | Hloubení rýh pro pasy | ✓ | 2 | `260219_dum.HSV1.002`; `260217_sklad.HSV1.003` |
| Z03 | Hloubení jam (figury nepoužívat) | ✓ | 2 | `260219_dum.HSV1.003`; `260217_sklad.HSV1.002` |
| Z04 | Odvoz výkopku na deponii | ✓ | 2 | `260219_dum.HSV1.007`; `260217_sklad.HSV1.006` |
| Z05 | Štěrkopískový zásyp / podsyp | ✓ | 10 | `260219_dum.HSV1.005`; `260219_dum.HSV1.008`; `260217_sklad.HSV1.005` |
| Z06 | Pažení výkopů (pokud nutno) | ✓ | 1 | `260219_dum.HSV1.006` |
| B01 | Základové pasy / patky | ✓ | 11 | `260219_dum.HSV1.002`; `260217_sklad.HSV1.003`; `260217_sklad.HSV1.005` |
| B02 | Základová deska na terénu | ✓ | 1 | `260219_dum.HSV2.012` |
| B03 | Pozední věnec | ✓ | 3 | `260219_dum.HSV2.007`; `260219_dum.HSV2.008`; `260219_dum.HSV2.009` |
| B04 | Nabetonávka stropu | ✓ | 2 | `260219_dum.HSV2.010`; `260219_dum.HSV2.011` |
| B05 | Hydroizolace pod základ (BV) | ✓ | 10 | `260219_dum.HSV2.001`; `260219_dum.HSV2.002`; `260219_dum.HSV2.003` |
| B06 | Bednění + odbednění ŽB | ✓ | 8 | `260219_dum.HSV2.003`; `260219_dum.HSV2.008`; `260217_sklad.HSV2.003` |
| S01 | Cihelné zdivo + překlady | ✓ | 2 | `260219_dum.HSV3.003`; `260219_dum.HSV3.004` |
| S02 | Nadezdívka / dozdívka | ✓ | 3 | `260219_dum.HSV2.007`; `260219_dum.HSV3.001`; `260219_dum.HSV3.002` |
| S03 | SDK příčky + předstěny | ✓ | 4 | `260219_dum.HSV6.005`; `260219_dum.PSV78.005`; `260219_dum.PSV78.006` |
| V01 | Strop ocelobetonový (IPE+trapéz) | ✓ | 11 | `260217_sklad.HSV1.004`; `260217_sklad.HSV1.005`; `260219_dum.HSV2.010` |
| V02 | Schodiště (ŽB / dřevěné) | ✓ | 10 | `260217_sklad.HSV1.001`; `260217_sklad.HSV2.005`; `260217_sklad.HSV2.006` |
| V03 | Krov dřevěný + krokve | ✓ | 20 | `260219_dum.HSV5.001`; `260219_dum.HSV5.002`; `260219_dum.HSV5.003` |
| V04 | Bednění krovu / OSB | ✓ | 3 | `260219_dum.HSV5.007`; `260219_dum.HSV5.014`; `260219_dum.PSV77.004` |
| K01 | Falcovaná plechová krytina | ✓ | 3 | `260219_dum.HSV5.013`; `260219_dum.HSV5.016`; `260219_dum.PSV76.003` |
| K02 | Klempířina — atika | ✓ | 4 | `260219_dum.HSV3.001`; `260219_dum.PSV76.004`; `260219_dum.PSV76.001` |
| K03 | Klempířina — okap + svod | ✓ | 1 | `260219_dum.PSV76.003` |
| K04 | Klempířina — parapety | ✓ | 1 | `260219_dum.PSV76.002` |
| F01 | ETICS zateplení (EPS/MW) | ✓ | 6 | `260219_dum.HSV7.001`; `260219_dum.HSV7.002`; `260219_dum.HSV7.003` |
| F02 | Sokl XPS / tenkostěnný | ✓ | 4 | `260219_dum.HSV7.003`; `260219_dum.PSV71.003`; `260219_dum.PSV77.006` |
| F03 | Špalety oken (perimeter EPS) | ✓ | 1 | `260219_dum.HSV7.004` |
| F04 | Tenkovrstvá omítka fasády | ✓ | 1 | `260219_dum.HSV7.006` |
| O01 | Plastová okna trojsklem | ✓ | 7 | `260219_dum.PSV76.001`; `260219_dum.PSV76.002`; `260219_dum.PSV76.003` |
| O02 | Vstupní dveře venkovní | ✓ | 1 | `260219_dum.PSV76.009` |
| O03 | Vnitřní dveře + zárubně | ✓ | 2 | `260219_dum.PSV76.010`; `260217_sklad.PSV76.001` |
| O04 | Venkovní žaluzie / kastlík | ✓ | 1 | `260219_dum.PSV76.008` |
| I01 | TI mezi krokvemi / nad krovem | ✓ | 10 | `260219_dum.HSV2.004`; `260219_dum.HSV5.007`; `260219_dum.HSV5.008` |
| I02 | Podlahová TI (EPS) | ❌ **MISSING** | 0 |  |
| I03 | Kročejová izolace | ✓ | 1 | `260219_dum.PSV71.002` |
| I04 | Hydroizolace koupelen (stěrka) | ❌ **MISSING** | 0 |  |
| P01 | Cementový potěr / lite směs | ✓ | 2 | `260219_dum.PSV71.001`; `260219_dum.PSV77.005` |
| P02 | Vinyl / laminát nášlap | ✓ | 5 | `260219_dum.PSV77.001`; `260219_dum.PSV77.002`; `260219_dum.PSV77.003` |
| P03 | Keramická dlažba | ✓ | 4 | `260219_dum.HSV1.004`; `260219_dum.PSV77.002`; `260219_dum.PSV77.003` |
| P04 | Sokl k podlaze | ✓ | 4 | `260219_dum.HSV7.003`; `260219_dum.PSV71.003`; `260219_dum.PSV77.006` |
| U01 | Vnitřní omítka štuková | ✓ | 7 | `260219_dum.HSV7.004`; `260219_dum.HSV7.006`; `260219_dum.PSV76.008` |
| U02 | Obklad koupelen keramický | ✓ | 3 | `260219_dum.PSV78.008`; `260219_dum.PSV78.009`; `260219_dum.PSV78.010` |
| U03 | Výmalba — finalní | ✓ | 9 | `260219_dum.HSV3.002`; `260219_dum.HSV3.004`; `260219_dum.HSV7.001` |
| T01 | Vodovod vnitřní rozvody | ❌ **MISSING** | 0 |  |
| T02 | Kanalizace splašková | ✓ | 1 | `260219_dum.PSV72.003` |
| T03 | Vytápění radiátory + rozvody | ✓ | 8 | `260219_dum.PSV73.001`; `260219_dum.PSV73.002`; `260219_dum.PSV73.003` |
| T04 | Tepelné čerpadlo / kotel | ✓ | 3 | `260219_dum.PSV72.009`; `260219_dum.PSV73.003`; `260219_dum.PSV73.005` |
| T05 | Komín / komínové těleso | ✓ | 4 | `260219_dum.HSV3.005`; `260219_dum.PSV73.002`; `260219_dum.PSV73.004` |
| T06 | Sanita — WC, umyvadlo, vana | ✓ | 10 | `260219_dum.HSV6.011`; `260219_dum.PSV71.003`; `260219_dum.PSV77.002` |
| T07 | ELI silnoproud — rozvody | ✓ | 7 | `260219_dum.M21.001`; `260219_dum.M21.002`; `260219_dum.M21.003` |
| T08 | ELI svítidla + zásuvky | ✓ | 4 | `260219_dum.M21.001`; `260219_dum.M21.004`; `260219_dum.M21.005` |
| T09 | PD / detekce požární | ✓ | 2 | `260219_dum.PSV95.001`; `260219_dum.PSV95.002` |
| R01 | Zařízení staveniště + buňky | ✓ | 6 | `260219_dum.HSV5.012`; `260219_dum.VRN.001`; `260219_dum.VRN.002` |
| R02 | Geodet + vytýčení | ✓ | 2 | `260219_dum.VRN.001`; `260217_sklad.VRN.001` |
| R03 | BOZP koordinátor | ✓ | 2 | `260219_dum.VRN.001`; `260217_sklad.VRN.001` |
| R04 | Odpady — odvoz na skládku | ✓ | 8 | `260219_dum.HSV1.007`; `260219_dum.HSV6.012`; `260219_dum.PSV72.003` |
| R05 | Revize závěrečné | ✓ | 4 | `260219_dum.PSV72.001`; `260219_dum.PSV73.007`; `260219_dum.M21.007` |
| R06 | Dokumentace skutečného provedení | ❌ **MISSING** | 0 |  |
| R07 | Pojištění stavby | ✓ | 3 | `260219_dum.VRN.001`; `260219_dum.VRN.002`; `260217_sklad.VRN.001` |
| R08 | Energie staveniště | ❌ **MISSING** | 0 |  |
| R09 | Kolaudace | ✓ | 4 | `260219_dum.M21.007`; `260219_dum.VRN.001`; `260219_dum.VRN.001` |

---

## Sekce D — TZ verb-noun scan (top 40)

| TZ soubor | Phrase | Covered? | Tokens |
|---|---|---|---|
| D_2_1_TZ_statika_dum_TeAnau.pd | nosných konstrukcí | ❌ | nosnych, konstrukci |
| D_2_1_TZ_statika_dum_TeAnau.pd | stavby | ✓ | stavby |
| D_2_1_TZ_statika_dum_TeAnau.pd | nadezdívek | ✓ | nadezdivek |
| D_2_1_TZ_statika_dum_TeAnau.pd | stavby před vlastním zahájením stavby | ❌ | stavby, pred, vlastnim |
| D_2_1_TZ_statika_dum_TeAnau.pd | podlah 1/300 rozponu | ❌ | podlah, 1/300, rozponu |
| D_2_1_TZ_statika_dum_TeAnau.pd | stavby je nutné zejména řešit definitivní pr ůřezy | ❌ | stavby, nutne, zejmena |
| D_2_1_TZ_statika_dum_TeAnau.pd | železobetonových konstrukcí se řídí požadavky uvedenými v ČSN | ❌ | zelezobetonovych, konstrukci, ridi |
| D_2_1_TZ_statika_dum_TeAnau.pd | ocelových konstrukcí se řídí požadavky uvedenými v ČSN | ❌ | ocelovych, konstrukci, ridi |
| D_2_1_TZ_statika_dum_TeAnau.pd | zd ěných konstrukcí se řídí požadavky uvedenými v | ❌ | enych, konstrukci, ridi |
| D_2_1_TZ_statika_dum_TeAnau.pd | d řevěných konstrukcí se řídí požadavky uvedenými v | ❌ | revenych, konstrukci, ridi |
| D_2_1_TZ_statika_dum_TeAnau.pd | bude provád ěno postupným rozebíráním stavebních konstrukcí z | ❌ | bude, provad, postupnym |
| D_2_1_TZ_statika_dum_TeAnau.pd | nosných prvk ů musí probíhat od podepíraných k | ❌ | nosnych, prvk, musi |
| D_2_1_TZ_statika_dum_TeAnau.pd | stropních | ❌ | stropnich |
| D_2_1_TZ_statika_dum_TeAnau.pd | částí konstrukcí nesmí být narušena | ❌ | casti, konstrukci, nesmi |
| D_2_1_TZ_statika_dum_TeAnau.pd | prováděno ze samostatné pomocné konstrukce | ❌ | provadeno, samostatne, pomocne |
| D_2_1_TZ_statika_dum_TeAnau.pd | nosných konstrukcí se provádí | ❌ | nosnych, konstrukci, provadi |
| D_2_1_TZ_statika_dum_TeAnau.pd | příček se musí vždy ov ěřit | ❌ | pricek, musi, vzdy |
| D_3_PBR_dum_TUSPO.pdf | a vybavení | ❌ | vybaveni |
| D_3_PBR_dum_TUSPO.pdf | požárního zásahu | ❌ | pozarniho, zasahu |
| D_3_PBR_dum_TUSPO.pdf | bezpečného zásahu | ❌ | bezpecneho, zasahu |
| D_3_PBR_dum_TUSPO.pdf | krbu musí odpovídat požadavkům uvedeným v | ❌ | krbu, musi, odpovidat |
| D_3_PBR_dum_TUSPO.pdf | dle části j1) této zprávy | ❌ | casti, teto, zpravy |
| D_3_PBR_dum_TUSPO.pdf | a provedení krbu | ❌ | provedeni, krbu |
| D_3_PBR_dum_TUSPO.pdf | SHZ se nenavrhuje | ❌ | nenavrhuje |
| D_3_PBR_dum_TUSPO.pdf | do objektu se mohou pouze tepeln á zařízení | ❌ | objektu, mohou, pouze |
| D_3_PBR_dum_TUSPO.pdf | a provozování tepelného zařízení je nutné se řídit | ❌ | provozovani, tepelneho, zarizeni |
| D_3_PBR_dum_TUSPO.pdf | izolační podložky st anoví výrobce | ❌ | izolacni, podlozky, anovi |
| D_3_PBR_dum_TUSPO.pdf | pouze tepelné zařízení | ❌ | pouze, tepelne, zarizeni |
| D_3_PBR_dum_TUSPO.pdf | požárních klapek | ❌ | pozarnich, klapek |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | v podobě šikmé střechy s vikýři | ❌ | podobe, sikme, strechy |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | pouze vybourání a rozšíření několika dveřních a okenních | ❌ | pouze, vybourani, rozsireni |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | několik lokálních dozdívek a přizdívek | ❌ | nekolik, lokalnich, dozdivek |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | dle PBŘ a návrhu statika) | ❌ | navrhu, statika) |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | bednění z prken a následně | ❌ | bedneni, prken, nasledne |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | do spacího patra v krovu | ✓ | spaciho, patra, krovu |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | jako ocelová | ❌ | jako, ocelova |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | lokální | ✓ | lokalni |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | dle standard ů | ✓ | standard |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | jako zapuštěné | ❌ | jako, zapustene |
| D_1_1_01_TZ_ARS_dum_EAR.pdf | vyspravení stávajících stěn | ✓ | vyspraveni, stavajicich, sten |
| (...) | _+ 30 more phrases in JSON_ | — | — |