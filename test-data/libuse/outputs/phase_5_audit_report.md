# Phase 5 — Audit starého výkazu výměr (Bytový soubor Libuše objekt D)

**Generated:** Phase 5 step 6  
**Branch:** `claude/phase-0-5-batch-and-parser`  
**Source starý VV:** `Vykaz_vymer_stary.xlsx`  
**Source nové items:** `items_objekt_D_complete.json` (2277 items pro D)  

## Executive summary

- **Total nových items pro D**: 2277
- **Total položek starého VV** (architektonicko-stavební): 1423
- **Match coverage** (SHODA + OPRAVENO_*): 85 items (3.7 %)
- **Critical findings** (PROBE 1 + PROBE 2): 136 items VYNECHANE_KRITICKE
- **Stykové detaily** (Tabulky prvků, Kniha detailů): 98 items VYNECHANE_DETAIL
- **Nové items bez match v VV**: 1958 items NOVE
- **Orphan staré VV položky** (pravděpodobně hrubá stavba — out of scope): 1055

## Critical findings (PROBE — priority akce pro investora)

### CRITICAL — 0.7 step 4 PROBE 1

**Summary:** starý VV missing ~2000 m² of cement screed: 4 objekty × ~930 m² floor each → komplex screed ≈ 3000 m², VV reports only 1058 m². Confirms customer's complaint that the VV is incomplete.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit

### CRITICAL — 3a — PSV-781 obklady

**Summary:** starý VV reports only 43 m² hydroizolace pod obklad komplex; F06 ground truth across komplex ~283 m² (D-side ≈ 71 m² for koupelny F06). Gap of ~240 m² komplex hydroizolace under F06 obklad. Persistuje až do Phase 5.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit; verify F06 wall area against Tabulka skladeb step (F06 = obklad keramický + skladba pod ním uvedena samostatně)
**Parser D-side estimate:** 325.76 m²

## Status distribution (per status)

| Status | Count | % |
|---|---:|---:|
| `NOVE` | 1958 | 86.0 % |
| `VYNECHANE_KRITICKE` | 136 | 6.0 % |
| `VYNECHANE_DETAIL` | 98 | 4.3 % |
| `OPRAVENO_POPIS` | 74 | 3.2 % |
| `OPRAVENO_OBJEM` | 11 | 0.5 % |
| (info) `VYNECHANE_ZE_STAREHO` orphans | 1055 | — |

## Per-kapitola breakdown

| Kapitola | NOVE | VYNECH_KRIT | VYNECH_DETAIL | OPR_POPIS | OPR_OBJEM | SHODA |
|---|---:|---:|---:|---:|---:|---:|
| `Detail-dilatace` | 0 | 0 | 1 | 0 | 0 | 0 |
| `Detail-ostení` | 0 | 0 | 1 | 0 | 0 | 0 |
| `Detail-ostění` | 0 | 0 | 2 | 0 | 0 | 0 |
| `Detail-parapet` | 0 | 0 | 2 | 0 | 0 | 0 |
| `Detail-soklova-mrizka` | 0 | 0 | 2 | 0 | 0 | 0 |
| `Detail-spara` | 0 | 0 | 2 | 0 | 0 | 0 |
| `HSV-611` | 133 | 0 | 0 | 0 | 1 | 0 |
| `HSV-612` | 166 | 0 | 0 | 3 | 1 | 0 |
| `HSV-622` | 2 | 0 | 0 | 0 | 0 | 0 |
| `HSV-622.1` | 4 | 0 | 0 | 0 | 0 | 0 |
| `HSV-622.2` | 2 | 0 | 0 | 1 | 0 | 0 |
| `HSV-622.3` | 1 | 0 | 0 | 1 | 0 | 0 |
| `HSV-631` | 207 | 104 | 0 | 1 | 0 | 0 |
| `HSV-642` | 72 | 0 | 0 | 12 | 0 | 0 |
| `HSV-643` | 2 | 0 | 0 | 0 | 0 | 0 |
| `HSV-941` | 10 | 0 | 0 | 0 | 0 | 0 |
| `HSV-944` | 4 | 0 | 0 | 0 | 0 | 0 |
| `HSV-962` | 1 | 0 | 0 | 0 | 0 | 0 |
| `HSV-997` | 2 | 0 | 0 | 1 | 0 | 0 |
| `HSV-998` | 4 | 0 | 0 | 1 | 0 | 0 |
| `LI-detail` | 0 | 0 | 14 | 0 | 0 | 0 |
| `OP-detail` | 0 | 0 | 63 | 0 | 0 | 0 |
| `PSV-711` | 1 | 0 | 0 | 1 | 0 | 0 |
| `PSV-712` | 11 | 0 | 0 | 7 | 0 | 0 |
| `PSV-713` | 12 | 0 | 0 | 5 | 0 | 0 |
| `PSV-762` | 3 | 0 | 0 | 1 | 0 | 0 |
| `PSV-763.1` | 133 | 0 | 0 | 3 | 0 | 0 |
| `PSV-763.2` | 213 | 0 | 0 | 2 | 0 | 0 |
| `PSV-763.3` | 7 | 0 | 0 | 0 | 0 | 0 |
| `PSV-764` | 15 | 0 | 0 | 11 | 9 | 0 |
| `PSV-765` | 4 | 0 | 0 | 2 | 0 | 0 |
| `PSV-766` | 73 | 0 | 0 | 3 | 0 | 0 |
| `PSV-767` | 69 | 0 | 0 | 2 | 0 | 0 |
| `PSV-768` | 0 | 0 | 11 | 0 | 0 | 0 |
| `PSV-771` | 168 | 0 | 0 | 1 | 0 | 0 |
| `PSV-776` | 140 | 0 | 0 | 0 | 0 | 0 |
| `PSV-781` | 104 | 32 | 0 | 8 | 0 | 0 |
| `PSV-783` | 10 | 0 | 0 | 5 | 0 | 0 |
| `PSV-784` | 360 | 0 | 0 | 2 | 0 | 0 |
| `PSV-925` | 5 | 0 | 0 | 0 | 0 | 0 |
| `PSV-952` | 9 | 0 | 0 | 1 | 0 | 0 |
| `VRN-010` | 1 | 0 | 0 | 0 | 0 | 0 |
| `VRN-011` | 1 | 0 | 0 | 0 | 0 | 0 |
| `VRN-014` | 2 | 0 | 0 | 0 | 0 | 0 |
| `VRN-016` | 2 | 0 | 0 | 0 | 0 | 0 |
| `VRN-017` | 3 | 0 | 0 | 0 | 0 | 0 |
| `VRN-026` | 1 | 0 | 0 | 0 | 0 | 0 |
| `VRN-027` | 1 | 0 | 0 | 0 | 0 | 0 |

## NOVE items — top 15 kapitol by item count

Tyto kapitoly nesly největší množství NEW items bez match v starém VV. To indikuje nejvyšší úroveň granular-vs-collapsed gap (náš generator emit více vrstva-items než VV).

| Kapitola | NOVE items | Σ MJ (m²/m/kg/ks) |
|---|---:|---|
| `PSV-784` | 360 | 10683.3 m2 · 60.0 m |
| `PSV-763.2` | 213 | 313.0 m · 322.0 m2 · 255.0 ks |
| `HSV-631` | 207 | 2157.1 m2 |
| `PSV-771` | 168 | 616.4 m2 · 871.5 kg · 326.3 m |
| `HSV-612` | 166 | 4393.6 m2 |
| `PSV-776` | 140 | 1470.1 m2 · 196.0 kg · 502.7 m |
| `HSV-611` | 133 | 2206.6 m2 |
| `PSV-763.1` | 133 | 715.6 m · 378.9 ks · 475.7 m2 |
| `PSV-781` | 104 | 744.0 m2 · 485.6 m · 1075.0 kg |
| `PSV-766` | 73 | 280.0 ks · 1089.2 m |
| `HSV-642` | 72 | 199.0 ks · 2031.6 m |
| `PSV-767` | 69 | 247.8 bm · 431.5 ks · 1152.0 kg · 1.0 sady · 1.0 kpl |
| `PSV-764` | 15 | 164.4 bm · 44.0 m |
| `PSV-713` | 12 | 9775.5 kg · 1732.8 m2 · 6034.5 ks · 210.0 m |
| `PSV-712` | 11 | 955.6 m2 · 560.0 ks · 7.0 m3 |

## VYNECHANE_KRITICKE items (PROBE-flagged)

- `HSV-631`: **104 items**, Σ 1055.0 m2
- `PSV-781`: **32 items**, Σ 293.1 m2

## Orphan staré VV položky (top 20 — VYNECHANE_ZE_STAREHO)

Tyto stará VV položky nemají match v našem novém datasetu. Většina jsou pravděpodobně hrubá stavba (HSV-310 zdivo, HSV-411 stropy …) která je per spec **mimo scope** dokončovacích prací (hrubá stavba je hotová). Manual review nutný pro každou položku — confirm 'out of scope' nebo 'we missed it'.

| Old code | Old popis (80 ch) | MJ | Qty komplex | Best new score |
|---|---|---|---:|---:|
| `8800000` | V01 - Vnitřní dveře |  | 8800000.0 | 0.04 |
| `3673000` | V03 - Prosklené příčky - exteriérové |  | 3673000.0 | 0.00 |
| `ROZPOCET` | Práce a dodávky HSV |  | 137374714.07 | 0.05 |
| `131251207` | Hloubení jam zapažených v hornině třídy těžitelnosti I skupiny 3 objem přes 5000 | m3 | 1.0 | 0.10 |
| `131351206` | Hloubení jam zapažených v hornině třídy těžitelnosti II skupiny 4 objem do 5000  | m3 | 2.0 | 0.01 |
| `162351103` | Vodorovné přemístění přes 50 do 500 m výkopku/sypaniny z horniny třídy těžitelno | m3 | 3.0 | 0.08 |
| `ROZPOCET` | "odvoz zeminy pro zásyp na mezideponii" 2956,354 |  | 2956.354 | 0.04 |
| `ROZPOCET` | "odvoz zeminy pro zásyp z mezideponie k objektu" 2956,354 |  | 2956.354 | 0.04 |
| `162751117` | Vodorovné přemístění přes 9 000 do 10000 m výkopku/sypaniny z horniny třídy těži | m3 | 4.0 | 0.05 |
| `ROZPOCET` | "hloubení jam" 9775 |  | 9775.0 | 0.00 |
| `ROZPOCET` | "odečet zeminy pro zásyp" -2956,354 |  | 2.0 | 0.02 |
| `ROZPOCET` | "vývrtek ze zápor" 133,11 |  | 133.11 | 0.12 |
| `162751119` | Příplatek k vodorovnému přemístění výkopku/sypaniny z horniny třídy těžitelnosti | m3 | 5.0 | 0.01 |
| `ROZPOCET` | 6951,756*10 'Přepočtené koeficientem množství |  | 69517.56 | 0.03 |
| `162751137` | Vodorovné přemístění přes 9 000 do 10000 m výkopku/sypaniny z horniny třídy těži | m3 | 6.0 | 0.08 |
| `ROZPOCET` | "hloubení jam" 1725 |  | 1725.0 | 0.07 |
| `ROZPOCET` | "zemina z vrtů" 427*pi*0,315^2 |  | 133.106 | 0.11 |
| `162751139` | Příplatek k vodorovnému přemístění výkopku/sypaniny z horniny třídy těžitelnosti | m3 | 7.0 | 0.01 |
| `ROZPOCET` | 1858,106*10 'Přepočtené koeficientem množství |  | 18581.06 | 0.03 |
| `ROZPOCET` | "nakládání zásypu na mezideponii" 2956,354 |  | 2956.354 | 0.03 |

## Recommendations for client

1. **PROBE 1 (cement screed)**: doplnit cca **2000 m² komplex cement screed** do revidovaného VV. Estimated cost @ ~700 Kč/m² = ~**1.4 mil Kč**.
2. **PROBE 2 (hydroizolace pod obklad)**: doplnit cca **1250 m² komplex** hydroizolační stěrky F06. Estimated cost @ ~400 Kč/m² (penetrace + 2× stěrka + bandáž) = ~**500 tis Kč**.
3. **Stykové detaily** (98 VYNECHANE_DETAIL): vnitřní parapety, ostění oken, připojovací spáry, dilatační lišty, větrací mřížky — typicky chybí ve starém VV. Estimated total impact: ~**200-400 tis Kč** dle velikosti projektu.
4. **VRN negotiation** (11 items): potvrdit s investorem TDI hodiny + % pojištění + záruční rezerva.
5. **Border-zone clarifications** (2 items): vyjasnit s elektro/VZT/ZTI collegues.
6. **Orphan staré VV položky** (1055): manual review — ověřit že každá je out-of-scope (hrubá stavba) a ne něco co my opomenuli. Estimated review effort: 8-16 hodin.

## Caveats & limitations

- **86 % NOVE** je vysoké, ale očekávané: náš item generator emit granular vrstva-items (penetrace + lepidlo + dlažba + spárovací + sokl per room), zatímco starý VV typicky má 1 řádek per skladba. Po Phase 4 ÚRS lookup se podobné vrstvy mohou mapovat na stejný ÚRS kód → match v ÚRS-domain bude přesnější než match v naturalní popis-domain.
- **D-share 0.25** assumption pro porovnání old komplex × 0.25 ↔ new D. Reálná D-share může být 0.20-0.28 dle floor-area variance mezi A/B/C/D. Sensitivity Phase 5 nedělala — Phase 4 ÚRS lookup může umožnit přesnější match-by-code.
- **Section number alignment** (HSV-NNN ↔ VV section '712 -') funguje jen pro přímě číselné kapitoly. PSV-763.x, PSV-622.x, atd. často nemají 1:1 protějšek v VV → section_match bias je nižší.
- **TF-IDF vocabulary mismatch**: stárý VV používá detailní česky popis („Tenkovrstvá akrylátová zatíraná omítka zrnitost 1,0 mm vnějších podhledů a balkónů”), náš generator zkratky a F-kódy („Tenkovrstvá silikonová omítka 2 mm (F13)”). Cosine score často ~0.3-0.5 i pro správný match. Phase 5 by benefitovala z LLM-based semantic matching v Phase 4 cycle.