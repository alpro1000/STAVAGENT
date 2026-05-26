# HK212 Kapitola Coverage Audit — 2026-05-22

**Items.json source:** `outputs/phase_1_etap1/items_hk212_etap1.json` (119 items post-Stage D)
**Branch:** `claude/hk212-step3-polygonization-areas`
**Auditor mandate:** verify all kapitoly typické skladové haly présent before Stage E benchmark

---

## Verdict

🚨 **P0 BLOCKER FOUND — opláštění sendvičové panely (Kingspan/Trimo) MISSING ENTIRELY.**
Stage E benchmark proti example_vv corpus is **nesmyslný** until this is added — typicky 30–40 % bid value for skladová hala.

---

## Coverage table

| # | Kapitola | Count | Sample item | Verdict | Notes |
|---|---|---:|---|---|---|
| 1 | **HSV-1** zemní práce | **27** | `HSV-1-001 Hloubení figury pod základovou desku, stroj. tř. 3` | ✅ **complete (above typical 5–10)** | 15 výkopových + 4 obetonování stávajících sítí + 3 přípojky + 3 lože/zhutnění + 2 zásyp |
| 2 | **HSV-2** základy + deska | **18** | `HSV-2-001 Beton patek rámových C16/20 XC0` | ✅ **complete (incl. pilota varianta)** | 9 patek/pasů + 3 pilota varianta + 3 deska + 3 obvodové |
| 3 | **HSV-3** ocelová konstrukce | **14** | `HSV-3-001 sloupy IPE 400 S235 EXC2` | ✅ **complete (Stage D _length_source annotated)** | 7 profilových + 7 services (kotvení/montáž/doprava/nátěr/požární/revize) |
| 4 | **HSV-6** obklady, omítky | **0** | — | ⚠️ **N/A** | čistá ocelová hala bez obkladů + bez admin zázemí; legitimately empty |
| 5 | **HSV-9** ostatní stavební | **4** | `HSV-9-001 Přesun hmot HSV vodorovně` | ✅ **adequate** | 1 přesun + 3 lešení (montážní + demont. + pro opláštění) |
| 6 | **PSV-71x** izolace | **4** | `PSV-71x-001 Penetrace soklu` | ⚠️ **partial** | jen 4 položky **sokl hydroizolace**. Chybí (a) tepelná izolace střechy (může být v Kingspan panelu); (b) tepelná izolace obvodu (taktéž). Stage D pamatuje že Kingspan tepelnou izolaci OBSAHUJE — pokud panel coverage existuje, samostatná tepelka netřeba. |
| 7 | **PSV-76x** výplně otvorů | **12** | `PSV-76x-005 Sekční vrata 3000×4000 mm motorická` | ✅ **complete** | 4 okna (dodávka + montáž + parapet + lemy) + 4 vrata sekční (dodávka + pohon + odblokování + montáž) + 4 dveře dvoukřídlé (dodávka + montáž + zámek + práh). DXF dedup (Task 2) potvrdil 4 vrata + 4 dveře; current 21 ks oken bude reconciled s DXF ~30 estimate v separate task. |
| 8 | **PSV-77x** podlahy průmyslové | **6** | `PSV-77x-002 PU stěrka tl. 4–5 mm, 1600 kg/m²` | ✅ **complete** | penetrace + stěrka + lokální zesílení + dilatace + lemovací úhelníky + protiskluz |
| 9 | **PSV-78x** klempířské konstrukce | **12** | `PSV-78x-001 Lindab Round Downpipe 150/100 Antique White` | ✅ **complete** | 6 Lindab svody + Wavin Tegra vpust + MEARIN Plus3000 liniový žlab + 6 atikové/úžlabí/nároží + tmely. ABMV_14 svody 3 vs 4 deferred reconciliation per Stage D. |
| 10 | 🚨 **PSV opláštění sendvičové panely** | **0** | — | 🚨 **P0 BLOCKER** | **Kingspan K-roc / IPN nebo Trimo / IsoPanel kompletně chybí.** TZ explicitně zmiňuje Kingspan (ABMV_13 K-roc vs IPN = `closed_fabricated`). Pro HK212 missing: střešní opláštění ~558 m² × cca 1500 Kč/m² = ~837 tis CZK; obvodové opláštění ~537 m² netto × cca 1500 Kč/m² = ~805 tis CZK. Plus kotvící prvky, lemy, přechody, dilatace, doprava, montáž. **Celkový missing scope ~2.0–2.5 mil CZK = 30–40 % typického bid value.** |
| 11 | **PSV-EL** elektroinstalace | **0** | — | ⚠️ **out-of-scope per ABMV_12** | D.1.4 EL chybí v PD — intentional Stage D removal. LPS hromosvod také missing — VRN-022 zmiňuje **revizi** hromosvodu ale samotné LPS položky chybí. Open question: revize bez instalation = nesmysl? |
| 12 | **PSV-ZTI** vnitřní + venkovní | **0** | — | ⚠️ **out-of-scope per ABMV_12** | D.1.4 ZTI chybí v PD. HSV-1 ale obsahuje výkop pro **přípojku** (HSV-1-011 vodovod DN150 LT + HSV-1-012 areálová kanalizace DN200). Samotné položky přípojek (potrubí + instalace + revize) jsou missing. Open question: výkop pro přípojku má smysl bez položky přípojky? |
| 13 | **PSV-VZT** vzduchotechnika | **0** | — | ⚠️ **removed Stage D (15 položek)** | concept-only per Phase 0b §5 — intentional |
| 14 | **PSV-MAR** měření a regulace | **0** | — | ⚠️ **VZT-bundled, removed Stage D** | byly v VZT-010/011 — intentional |
| 15 | **M** machine protection / kotvy / oplocení strojů | **0** | — | ⚠️ **removed Stage D (7 položek Rpol-)** | concept-only per Phase 0b §5 — intentional |
| 16 | **VRN** | **22** | `VRN-001 ZS buňka kancelář stavbyvedoucího` | ✅ **complete (above typical 8–15)** | 4 ZS buňky + oplocení + vodovod + elektro + WC + BOZP + plán BOZP + pojištění + 2 likvidace + doprava + 2 geodézie + revize hromosvodu + 5 dalších |

---

## P0 — Opláštění Kingspan: doplnit MINIMÁLNĚ tyto položky

Pro Stage E benchmark + tender-ready stav je nutné **before** doing the benchmark:

| ID návrh | mj | Mn. orientačně | Popis |
|---|---|---:|---|
| PSV-OPL-001 | m² | ~558 | Dodávka Kingspan K-roc (nebo IPN) střešní sendvičový panel tl. 150 mm, RAL šedá |
| PSV-OPL-002 | m² | ~558 | Montáž střešního opláštění Kingspan — kotvení, šrouby, těsnění |
| PSV-OPL-003 | m² | ~537 | Dodávka Kingspan KS1000 AWP obvodový panel tl. 100–150 mm, RAL šedá |
| PSV-OPL-004 | m² | ~537 | Montáž obvodového opláštění Kingspan — kotvení, samonosné šrouby |
| PSV-OPL-005 | bm | TBD | Lemy přechod střecha–fasáda + nároží + dilatace — pozink plech |
| PSV-OPL-006 | kpl | 1 | Spojovací materiál + těsnění + lepidla Kingspan systém |
| PSV-OPL-007 | paušál | 1 | Doprava sendvičových panelů na stavbu |
| PSV-OPL-008 | paušál | 1 | Statické posouzení uchycení Kingspan k OK + revize |

**Cross-ref:**
- Step 3 metrics: zastavěná 538.5 m², střecha brutto 556.5 m², fasáda netto 536.4 m² → use as basis
- HSV-9-004 (Pomocné lešení pro Kingspan) — confirms TZ scope assumes opláštění exists
- ABMV_13 K-roc vs IPN = `closed_fabricated` (Stage 0b/Phase 1 decision, but actual položka never materialized in items.json — likely lost between TZ parse and final items.json composition)

---

## Other gaps (priority order)

| # | Issue | Severity | Recommendation |
|---|---|---|---|
| 1 | LPS hromosvod položky missing, jen revize v VRN-022 | P1 | Add 4–6 LPS položek nebo vyjasnit s investorem že LPS bude separate kontrakt. |
| 2 | Přípojka vodovod + kanalizace položky missing | P1 | Decide: drop HSV-1-011/012 výkop pro přípojku, OR add přípojku položky. Asymmetric. |
| 3 | PSV-71x jen sokl — verify tepelka v Kingspan | P2 | Confirm Kingspan panel obsahuje izolaci (typicky 80–120 mm PUR mezi plechy). Pokud ano, dedicated izolační kapitola není potřeba. |
| 4 | PSV-76x okna 21 ks vs DXF 30+ estimate | P3 | Reconciliation deferred per Stage D ABMV. |

---

## Stage E impact

**Cannot proceed s Stage E benchmark until P0 resolved.** Comparing 119-item HK212 výkaz (missing 2.5M CZK opláštění) against full Forestina/HALA JHV reference výkazy = false reading. Forestina almost certainly has Kingspan/sendvič opláštění items — coverage diff would mislabel HK212 as "fundamentally incomplete" instead of the actual issue "missing 1 critical kapitola".

**Recommended flow:**
1. Add PSV-OPL-001..008 (8 položek, +6.7 % item count, +30–40 % bid value)
2. Re-validate item totals + URS match rate
3. Then Stage E benchmark with apples-to-apples comparison.
