# Phase 6.6 GATE 1 — Material library coverage report

_Generated: 2026-05-20T16:52:32+00:00_

_Objekt: D | Pipeline phase: 6.6_A | Branch: claude/tz-material-decomposition-lBp5D_

## 1. Totals

- **Total material entries:** 714
- Entries with explicit manufacturer: 238 (33.3 %)
- Entries with explicit thickness (mm): 298
- Entries with explicit consumption rate: 3
- Master items (current state, unchanged): 4025

## 2. Source provenance distribution

| Source type | Count | % |
|---|---:|---:|
| `tz_explicit_with_rate` | 3 | 0.4 |
| `tz_explicit_no_rate` | 126 | 17.6 |
| `tabulka_referenced` | 454 | 63.6 |
| `vykres_annotated` | 131 | 18.3 |

## 3. Per-document yield

| Document | Entries |
|---|---:|
| `185-01_DPS_D_SO01_100_0030_R01_TABULKA SKLADEB A POVRCHU_R01.xlsx` | 351 |
| `185-01_DPS_D_SO01_100_0010_R01-TZ.docx` | 129 |
| `185-01_DPS_D_SO01_100_8030_01_Kniha_detailu.pdf` | 123 |
| `185-01_DPS_D_SO01_100_0080_R02 - TABULKA OSTATNICH PRVKU.xlsx` | 65 |
| `185-01_DPS_D_SO01_100_0060_R01_TABULKA KLEMPIRSKYCH PRVKU.xlsx` | 24 |
| `185-01_DPS_D_SO01_100_0050_R01_TABULKA ZAMECNICKYCH VYROBKU.xlsx` | 14 |
| `185-01_DPS_D_SO01_100_8050_00_Zasady_sparorezu.pdf` | 8 |

## 4. Per-kapitola coverage (master items vs material library)

| Kapitola | Master items | Material entries proposed | Status |
|---|---:|---:|---|
| `HSV-963` | 942 | 0 | ❌ gap |
| `HSV-631` | 523 | 74 | ✅ covered |
| `PSV-784` | 523 | 0 | ❌ gap |
| `PSV-763.2` | 215 | 4 | ✅ covered |
| `PSV-771` | 202 | 74 | ✅ covered |
| `PSV-781` | 172 | 4 | ✅ covered |
| `HSV-612` | 170 | 3 | ✅ covered |
| `PSV-776` | 168 | 74 | ✅ covered |
| `HSV-611` | 142 | 3 | ✅ covered |
| `PSV-763.1` | 136 | 4 | ✅ covered |
| `HSV-642` | 102 | 2 | ⚠️ thin |
| `PSV-767` | 97 | 28 | ✅ covered |
| `PSV-766` | 94 | 2 | ⚠️ thin |
| `PSV-783` | 93 | 14 | ✅ covered |
| `HSV-713` | 86 | 1 | ⚠️ thin |
| `PSV-713` | 80 | 10 | ✅ covered |
| `OP-detail` | 63 | 65 | ✅ covered |
| `HSV-961` | 48 | 0 | ❌ gap |
| `PSV-763` | 43 | 4 | ✅ covered |
| `PSV-764` | 41 | 24 | ✅ covered |
| `PSV-712` | 19 | 87 | ✅ covered |
| `LI-detail` | 14 | 0 | ❌ gap |
| `PSV-952` | 13 | 0 | ❌ gap |
| `HSV-941` | 10 | 0 | ❌ gap |
| `PSV-765` | 9 | 86 | ✅ covered |
| `HSV-962` | 9 | 0 | ❌ gap |
| `PSV-768` | 8 | 0 | ❌ gap |
| `PSV-763.3` | 7 | 4 | ✅ covered |
| `PSV-762` | 6 | 86 | ✅ covered |
| `HSV-622.1` | 5 | 9 | ✅ covered |

## 5. Top material kinds detected (Phase A library)

| material_kind | Count |
|---|---:|
| `(unmapped)` | 329 |
| `eps_polystyren` | 36 |
| `kotevni_prvky` | 30 |
| `okenni_vyplne` | 28 |
| `zaluzie` | 25 |
| `parapet` | 24 |
| `sdk_deska` | 21 |
| `hydroizolace` | 21 |
| `klempir_zlaby` | 21 |
| `dlazba_keramicka` | 20 |
| `penetrace` | 16 |
| `asfaltovy_pas` | 12 |
| `klempir_svody` | 12 |
| `pe_separacni_folie` | 9 |
| `lepidlo` | 9 |
| `lista_zakoncovaci` | 9 |
| `cementovy_poter` | 8 |
| `krocejova_izolace` | 8 |
| `mineralni_vata` | 7 |
| `klempir_oplechovani` | 6 |
| `polystyrenbeton` | 5 |
| `praskove_lakovani` | 5 |
| `zinkove_pozinkovani` | 4 |
| `polyuretanova_uprava` | 4 |
| `epoxidova_uprava` | 4 |

## 6. Top 20 work types WITHOUT material-library coverage

These kapitoly will fall back to generic industry rates in Phase B (case 4 = `generic_no_documentation`).

| # | Kapitola | Master items |
|--:|---|---:|
| 1 | `HSV-963` | 942 |
| 2 | `PSV-784` | 523 |
| 3 | `HSV-961` | 48 |
| 4 | `LI-detail` | 14 |
| 5 | `PSV-952` | 13 |
| 6 | `HSV-941` | 10 |
| 7 | `HSV-962` | 9 |
| 8 | `PSV-768` | 8 |
| 9 | `HSV-998` | 5 |
| 10 | `PSV-925` | 5 |
| 11 | `HSV-944` | 4 |
| 12 | `HSV-997` | 3 |
| 13 | `VRN-017` | 3 |
| 14 | `HSV-622.3` | 2 |
| 15 | `Detail-parapet` | 2 |
| 16 | `Detail-ostění` | 2 |
| 17 | `Detail-spara` | 2 |
| 18 | `Detail-soklova-mrizka` | 2 |
| 19 | `HSV-643` | 2 |
| 20 | `VRN-014` | 2 |

## 7. Sample materials (5) with full provenance chain

### Sample 1 — `mat_42803d0af9`
- **verbatim:** Objekty mají obdélníkové půdorysy, 2 nadzemní podlaží a podkroví. Všechny byty na přízemí mají terasy a byty ve vyšších patrech balkóny. Soubor má vizuálně působit jednotně, každý objekt je však rozpoznatelný. Fasády objektů budou obloženy cihelnými pásky, na střechu bude použita keramická krytina bobrovka s rovným zakončením. Oba materiály jsou zvoleny jako tradiční materiály s maximálním důrazem na moderní architekturu, která se začlení do současné zástavby. Dostatek denního světla je zajištěn
- **source.type:** `tz_explicit_no_rate`
- **source.document:** `185-01_DPS_D_SO01_100_0010_R01-TZ.docx`
- **source.section:** `ARCHITEKTONICKÉ ŘEŠENÍ`
- **source.locator:** `paragraph_index=71`
- **material_kind:** `obklad_cihelny_terca`
- **MJ:** `m2`
- **kapitola_proposed:** `[]`
- **confidence:** 1.0

### Sample 2 — `mat_70e6c03464`
- **verbatim:** Filtrační vrstva (textilie 200g/m2)	2 mm
- **source.type:** `tz_explicit_with_rate`
- **source.document:** `185-01_DPS_D_SO01_100_0010_R01-TZ.docx`
- **source.section:** `STAVEBNĚ TECHNICKÉ ŘEŠENÍ > Střechy a terasy`
- **source.locator:** `paragraph_index=261`
- **material_kind:** `None`
- **MJ:** `None`
- **kapitola_proposed:** `['PSV-712', 'PSV-762', 'PSV-765']`
- **specifikum:** `{"tloustka_mm": 2.0}`
- **consumption_rate:** `{'value': 200.0, 'unit_num': 'g', 'unit_denom': 'm2', 'verbatim': '200g/m2'}`
- **confidence:** 1.0

### Sample 3 — `mat_d3d830311e`
- **verbatim:** vsyp pro pancéřové betonové podlahy se střední a vyšší provozní zátěží, směs speciálních cementů, kompatibilních chemických přísad a tříděných tvrdých plniv s vyšším obsahem zrn vysokého lesku, prováděno ve dvou krocích. Celkové množství vsypu 5kg/m2, povrch zdrsněn metličkovou úpravou. Vsyp vč. ošetření čerstvé směsi akrylátovým nátěrem (0,1-0,2l/m2). Zvýšená odolnost povrchu proti vsakování ropných látek a silničních solí. Systémové uzavření dilatačních spar v ploše a na obvodu. Odolnost v obr
- **source.type:** `tabulka_referenced`
- **source.document:** `185-01_DPS_D_SO01_100_0030_R01_TABULKA SKLADEB A POVRCHU_R01.xlsx`
- **source.section:** `Tabulka 0030 / povrchy / Povrch podlahy 1PP - vjezdová rampa`
- **source.locator:** `sheet='povrchy', row=6`
- **material_kind:** `None`
- **MJ:** `m2`
- **kapitola_proposed:** `['HSV-631', 'PSV-771', 'PSV-776']`
- **specifikum:** `{"vyrobce": "Sika", "tloustka_mm": 2.0, "referencni_vyrobek": "např.Sika CZ"}`
- **confidence:** 0.95

### Sample 4 — `mat_74c35109a4`
- **verbatim:** A PURENITOVÝCH BOXŮ PRO UMÍSTĚNÍ ŽALUZIÍ
- **source.type:** `vykres_annotated`
- **source.document:** `185-01_DPS_D_SO01_100_8030_01_Kniha_detailu.pdf`
- **source.section:** `kniha_detailu`
- **source.locator:** `line=52`
- **material_kind:** `None`
- **MJ:** `None`
- **kapitola_proposed:** `[]`
- **specifikum:** `{"vyrobce": "Purenit"}`
- **confidence:** 0.85

## 8. Stop conditions check

| Condition | Threshold | Actual | Status |
|---|---|---|---|
| Q1 inventory expected sources available | ≥ 50 % | 100 % | ✅ |
| Material extraction errors | < 5 % | 0 % | ✅ |
| Unclear pairing rule per kapitola | n/a in Phase A | — | ✅ |
| Cross-objekt conflict | n/a in Phase A | — | ✅ |

---

**GATE 1 deliverable status:** material library + coverage report + 5 sample materials + top-20 gap list emitted.

**Awaiting user approval before Phase B (master-material pairing).**
