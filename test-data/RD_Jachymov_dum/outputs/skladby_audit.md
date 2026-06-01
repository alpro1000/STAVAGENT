# Skladby cross-check audit — RD Jáchymov dům (260219)

> **Type:** read-only cross-check. `items_rd_jachymov_complete.json` (188 dům položek) × `inputs/skladby_navrh.md` (STÁVAJÍCÍ / BOURÁNÍ / NÁVRH, S01–S12) + poznámky 2.01–2.05.
> **Date:** 2026-06-01 (v2 — two-group lens) · **Gate:** STOP před dogenerací.
> **Princip:** jedna skladba = 2 skupiny — **STÁVAJÍCÍ→bourání** (HSV-6) a **NÁVRH→konstrukční** (HSV/PSV). Auditováno odděleně, nemíchat.
> **Legend:** ✅ pokryto · 🟦 globální PSV/HSV (ne per-skladba) · 🟡 GAP · ⚠️ DRIFT · ⛔/❓ VYJASNĚNÍ · ℹ️ stávající (zachováno, bez akce)

---

## 0. HEADLINE — S08 verdikt (klemba mezi patry)

**Otázka:** S08 je v legendě, ale řez A-A/B-B ji nekříží (kříží jen S05/06/07/09). „Může být i to i to?"

**Zjištění (grounded, ne z fantazie):**
- `outputs/skladby_per_zone_v2.json` → S08 „strop cihelná klenba mezi patry", `tz_explicit: true`, `tz_source: "PDF řez D.1.1.2.2.21 — legenda S08"`. **ALE chybí `applies_to_area_m2`** — na rozdíl od S06 (~50 m²), **S07 (59,5 m²)**, **S09 (104,4 m²)**, kterým plocha přiřazena byla.
- Legenda OCR (`cev_ocr_skladby_legenda.json`) potvrzuje kód S08 v legendě (text garbled).
- Půdorysy v `inputs/vykresy_pdf/` jsou pro tento účet **nedostupné** (Read permission denied) → polohu klenby si NEMOHU sám ověřit.

**Odpověď na „i to i to":** **NE — S07 a S08 jsou DVA různé stropy, ne overlap.** Historické domy běžně míchají dřevěný trámový strop (S07) a cihelnou klenbu (S08) **ve stejném podlaží, ale v jiných místnostech/traktech**. Legenda = všechny skladby; řez = jen protnuté. Takže S08 v legendě + chybí v řezu = **normální**, NEznamená duplicitu se S07.

**Disposition S08 = ❓ VYJASNĚNÍ PROJEKTANTOVI (negeneruji):** S08 je v legendě, ale **nemá přiřazenou plochu** (S06/S07/S09 mají) a řez ji nekříží. Buď (a) legenda je generická a S08 se v domě nepoužívá, nebo (b) použije se v nekvantifikované oblasti. Per tvůj pokyn „S08 generovat JEN když TZ/výkres potvrdí + nevymýšlet" → **dotaz do vyjasnění**, ne položka. Pokud projektant potvrdí plochu: cihelná klemba 150 = STÁVAJÍCÍ (ne bourání) + nová suchá skladba shora (6 vrstev NÁVRH), `_source="skladba S08 legenda"`.

---

## 1. Poznámky 2.01–2.05 — všechny pokryty ✅ (žádný gap)

| Pozn | Obsah | Položka | Stav |
|---|---|---|---|
| 2.01 | nový vstup — lehká ocel. konstrukce přes mezipodestu | `PSV76.001` (Ocelové schodiště ze zahrady na mezipodestu UPE200) | ✅ |
| 2.02 | opěrná stěna bílá vana + drenáž | `HSV2.001/002/003` BV + `HSV1.015` drenáž | ✅ |
| 2.03 | nová stropnice (statika) | `HSV4.001` IPE180 (+ `HSV4.002`) | ✅ |
| 2.04 | ŽB ztužující věnec (statika) | `HSV2.007/008/009` | ✅ |
| 2.05 | mykologický průzkum + dřevokazný hmyz | `VRN.001` (Mykologický průzkum + dřevokazný hmyz) | ✅ už existuje |

---

## 2. Schema-integrity bug (BLOCKER, mimo skladby)

⛔ **Duplicitní `id` — porušení Pattern 28**, systémové (seq se restartuje per subkapitola uvnitř téže kapitoly):
- `PSV71.001` ×2 (HI pod deskou / EPS 150), `PSV71.002` ×2 (radon / kročejová)
- `PSV76.001` ×4 (Truhlář / Zámečnictví / Klempíř / Výplně otvorů)
- `VRN.001` ×mnoho (každá VRN subkapitola má vlastní .001)

**Fix:** prefix namespace do `id` nebo globálně unikátní seq. Doporučeno opravit při téže dogeneraci.

---

## 3. Verdikt po skladbách — DVĚ skupiny

| Sk | BOURÁNÍ (stávající→demolice) | NÁVRH (nové konstrukční) |
|---|---|---|
| **S01** | omítky/výmalba interiér: 🟡 otlučení nesoudržných omítek nenalezeno (jen `HSV7.001` příprava fasády). Zdivo ℹ️ zachováno. | ETICS 160 `HSV7.002` ✅ · finiš `HSV7.006` ✅ · omítky 🟦 PSV78. Pozn: silikonová vs „pastovitá" — ověřit. |
| **S02** | ℹ️ stěna zachována; omítky 🟡 (viz S01) | omítky 🟦 PSV78. `HSV3.007` příčky 150 tagged S02 — sporné. |
| **S03** | vnější keram. obklad 20 (stávající) → 🟡 demontáž obkladu suterénu nenalezena | 🟡 **GAP** sanační zateplení soklu (Styrcon 200 + lepidlo + armovací) + S03a nopová folie 20 + S03b provětraný sokl obklad — jen `_sklad`. Ověřit dům. |
| **S04** | ℹ️ beton 100 stávající zachován (suterén) | nášlap 1.PP `PSV77.003` 🟦. Báze (epoxid/beton) jen `_sklad` — 🟡 ověřit dům. |
| **S05** | nášlap + betonový potěr 80 → `HSV6.008` sejmutí podlah ✅ | ⚠️ **DRIFT** betonová deska návrh 120 vs `HSV2.012` 150. EPS 150=120 ✅ · HI ✅ · potěr 50 `PSV77.005` ✅ · radon ✅. Samonivel 5 🟡. |
| **S06** | zásypy klenby → `HSV4.007` vyvezení ✅ | perlitbeton 100 `HSV4.008` + roznos 50 `HSV4.009` ✅. Klemba 150 ℹ️ zachována. |
| **S07** | trámový strop 2.NP / záklop / zásyp → `HSV6.004` + `HSV6.009` + `HSV6.008` ✅ | min. vata 180 `HSV4.011` ✅ · SDK EI30 `HSV4.012` ✅ · Liapor 50 `HSV4.013` ✅ · Fermacell 25 `HSV4.014` ✅. 🟡 **GAP kročejová Isover T-P 30 mm** + separační geotextilie. Trámy/záklop ℹ️ zachováno. |
| **S08** | ❓ viz §0 (vyjasnění) | ❓ viz §0 — negeneruji bez potvrzení |
| **S09** | nosné trámy + záklop podkroví → `HSV6.004` ✅ | ocelobeton `HSV4.002-006` + nabetonávka `HSV2.010/011` ✅. ⚠️ **DRIFT kročejová 40 vs `PSV71.002` 30.** 🟡 **GAP min. vata výplň 180/200 mezi nosníky.** |
| **S10** | stávající plech krytina + krov → `HSV6.002` + `HSV6.001` ✅ | bednění 25 `HSV5.012` · Al krytina `HSV5.013` · doplň. HI `HSV5.010` · kontralatě `HSV5.011` · PIR 160 `HSV5.009` · parotěsná `HSV5.008` · palubka 20 `HSV5.007` · krokve `HSV5.001` ✅. 🟡 pojistná HI pod krytinu (horní) ověřit. |
| **S11** | — (nová konstrukce) | biodeska 22 `HSV5.014` ✅ |
| **S12** | — (nadezdívka) | Porotherm 30 `HSV3.002` ✅. Omítka sádrová vs PSV78 vápenocem. — ověřit. |
| **S12a** | — | = S01 ETICS `HSV7.002/004/005/006` ✅ |
| **S12b** | — | 🟡 bundle `HSV5.016` → rozpad na 5 vrstev (min. vata 180 / folie / rastr / bednění 25 / plech) — P41 |

---

## 4. Gap-souhrn (k approve) — rozděleno

### ❓ VYJASNĚNÍ (verify TZ/projektant — negeneruji)
| # | Co |
|---|---|
| V1 | **S08 klemba mezi patry** — v legendě, bez plochy, řez nekříží, půdorysy nedostupné. Potvrdit, zda dům S08 má + plochu. |
| V2 | **S12 omítka** sádrová stříkaná vs PSV78 vápenocementová — typ v podkroví? |

### 🧱 BOURÁNÍ-gaps (stávající→demolice, po approve)
| # | Sk | Chybí bourání položka |
|---|---|---|
| BR1 | S01/S02/S03 | otlučení nesoudržných **vnitřních omítek** před novými (pokud projekt vyžaduje — možná zůstávají) — ověřit |
| BR2 | S03 | demontáž stávajícího **vnějšího keramického obkladu** suterénu (20 mm) |

### 🔨 NÁVRH-gaps (nové konstrukční, po approve)
| # | Sk | Chybí konstrukční vrstva |
|---|---|---|
| G1 | S03 | sanační zateplení soklu (Styrcon 200 + lepidlo + armovací) + nopová folie 20 (S03a) + provětraný sokl obklad (S03b) — ověřit dům |
| G2 | S07 | kročejová izolace Isover T-P **30 mm** + separační geotextilie |
| G3 | S09 | minerální vata výplň **180/200 mm** mezi ocel. nosníky |
| G4 | S12b | rozpad bundlu `HSV5.016` → 5 vrstev (P41) |
| G5 | S10 | pojistná HI folie pod Al krytinu (horní) — ověřit nutnost |

### ⚠️ DRIFTs (verify — možná záměr)
| # | Sk | Návrh | items.json |
|---|---|---|---|
| D1 | S05 | betonová deska 120 mm | `HSV2.012` ŽB deska 150 mm (statika?) |
| D2 | S09 | kročejová 40 mm | `PSV71.002` 30 mm |

### ✅ Potvrzené shody
ETICS EPS grey 160 λ0.032 (S01/S12a, „ne 200 fallback") · PIR 160 λ0.022 (S10) · min. vata trámy 180 (S07) · perlitbeton 100+50 (S06) · podl. EPS 150=120 (S05) · biodeska 22 (S11) · Porotherm 30 (S12) · bourání krov/krytina/strop/podlahy ✅ HSV6 · poznámky 2.01–2.05 ✅.

---

## 5. Metodika
- Povrchové vrstvy (vnitřní omítka, výmalba, nášlap, obklad) = globální PSV (`PSV77/PSV78/PSV71`) 🟦, ne per-skladba → neflagováno jako chybějící.
- „ℹ️ stávající" = renovace zachovává (zdivo, klenba S06/S08, trámy, záklop).
- Dogenerace (po approve): NÁVRH-gap → konstrukční (montáž/materiál split P41); BOURÁNÍ-gap → demontáž stávající vrstvy; `_source="skladba S0X stávající|návrh"` (P29); family-kód kde znám / blank jinak (P26, žádný find_urs_code wrong-leaf); rekonstrukce verify TZ (P9).
