# SO-202 D6 Karlovy Vary — Golden Test Data for Calculator Audit

**Source:** TZ PDPS VD-ZDS, VIAPONT s.r.o., Ing. Jan Macák (ČKAIT 1007197)
**Audit date:** 2026-04-16
**Audit session:** claude/calc-blocks-refactor-etX8c commits ffec7b3..55c0dbd
**Last re-snapshot:** 2026-04-17 (v4.21.0 terminology + MSS fix pack)

---

## v4.21.0 Re-Snapshot Notes (2026-04-17)

Following the "Terminologie bednění/skruž/stojky + MSS" fix pack on
`claude/calc-ux-fixes-HfW2W`, several audit entries below are now
resolved or changed behavior. Summary:

| Bug # | Before v4.21 | After v4.21 | Status |
|-------|--------------|-------------|--------|
| #5 (MEDIUM) | `recommendFormwork(mostovkova_deska, h=7.8)` returned `Staxo 100` as `fwSystem` (a support tower / props). UI card said "📦 Bednění: Staxo 100". | Returns `Top 50` (pour_role='falsework'). UI card reads "🏗️ Skruž (nosníky): Top 50 / DOKA". `calculateProps()` adds Staxo 40 separately in the new "🔩 Stojky" card. Layers are no longer conflated. | ✅ RESOLVED |
| Dokaflex for mostovka | `getSuitableSystemsForElement('mostovkova_deska')` pool included Dokaflex, MULTIFLEX, SKYDECK, CC-4 (all `formwork_category='slab'`). User could pick Dokaflex for a bridge deck — max reach ~5 m, structurally a building slab system. | `applicable_element_types` allow-list on those systems excludes mostovkova_deska; selector never offers them for bridge decks. Top 50 + VARIOKIT HD 200 are the only slab-category falsework systems that pass. | ✅ RESOLVED |
| Cost summary labels | One-line "Bednění (práce)" + "Pronájem bednění" for bridges. | Labels switch per `pour_role`: "Skruž (nosníky — práce)" + "Pronájem skruže" + separate "Stojky (práce)" + "Pronájem stojek" rows. Subtotal renamed "↳ Tesařské práce (skruž + stojky)". | ✅ RESOLVED |
| Warning prefix | "Top 50 vyžaduje jeřáb (panel 150+ kg)" regardless of pour_role. | "Skruž Top 50 vyžaduje jeřáb (nosník 150+ kg)" for falsework (nosníky ship as beams, not panels). | ✅ RESOLVED |

**Expected output delta for SO-202** (LM, mostovka, h=7.795 m, V≈350 m³, pevná skruž):

- `plan.formwork.system.name` = `Top 50` (was `Staxo 100`)
- `plan.formwork.system.pour_role` = `'falsework'` (new field)
- `plan.costs.is_mss_path` = `false` (SO-202 uses pevná skruž)
- `plan.props?.system.name` = `Staxo 40` (h < 8 m) — unchanged
- UI cards: "🏗️ Skruž (Top 50)" + "🔩 Stojky (Staxo 40)" instead of one "📦 Bednění"
- Cost breakdown: 4 rental rows (skruž / stojky) instead of 2 (bednění / podpěry)

Numerical costs shift slightly because Top 50's `assembly_h_m2 = 0.60`
vs Staxo 100's `0.90` — fewer man-hours for the formwork step, but
props labor already accounted separately. Magnitude is within the
~5 % calibration band the audit already tolerates.

---

## 1. Stavba

- D6 Karlovy Vary – Olšová Vrata, SO202 Most na sil. I/6 v km 0,900
- 2 samostatné mosty (LM + PM), 6 polí každý, kolmé, ve stoupání 4.48%
- Délka přemostění: 108.9 m, délka mostu: 117.9 m, délka NK: 111.5 m
- Šířka mostu: 10.85 m (jeden), celková 23.40 m
- Výška nad terénem: LM 7.795 m, PM 7.846 m

## 2. Konstrukční prvky a betony

| Prvek | Beton | Exposure | Třída ošetř. | element_type v kalkulátoru |
|---|---|---|---|---|
| Piloty (vše) | C30/37 | XA2 | — | `pilota` |
| Základ opěr OP1, OP7 | C25/30 | XF1 | 3 | `zaklady_piliru` |
| Základ pilířů P2,P4,P5,P6 | C25/30 | XF1 | 3 | `zaklady_piliru` |
| Základ pilíře P3 | C25/30 | **XF3** | 3 | `zaklady_piliru` |
| Dřík opěr + závěrná zídka + křídla | C30/37 | **XF4** | 3 | `opery_ulozne_prahy` / `kridla_opery` |
| Sloupy P2, P3, P5, P6 | C35/45 | **XF4** | 3 | `driky_piliru` |
| Sloupy P4 | C35/45 | **XF2** | 3 | `driky_piliru` |
| NK (mostovka) | C35/45 | XF2 | **4** | `mostovkova_deska` |
| Přechodové desky | C25/30 | XF2 | 3 | `prechodova_deska` |
| Římsy | C30/37 | XF4 | **4** | `rimsa` |

## 3. Piloty — Golden Numbers

| Podpěra | Délka (m) | Ø (mm) | Počet (LM+PM) | Geologie | Casing |
|---|---|---|---|---|---|
| OP1 | 7.5 | 900 | 10+10=20 | below_gwt | cased |
| P2 | 11.0 | 900 | 8+8=16 | below_gwt | cased |
| P3 LM | 13.0 | 900 | 8 | below_gwt | cased |
| P3 PM | 13.0 | 900 | 8 | **plovoucí** (below_gwt) | cased |
| P4 LM | **16.0** | 900 | 8 | below_gwt / plovoucí (levá řada) | cased |
| P4 PM | **14.0** | 900 | 8 | below_gwt | cased |
| P5 | 12.0 | 900 | 8+8=16 | below_gwt | cased |
| P6 | 11.0 | 900 | 8+8=16 | below_gwt | cased |
| OP7 | 12.5 | 900 | 11+11=22 | below_gwt | cased |
| **Celkem** | — | **900** | **122 ks** | — | — |

- Beton: C30/37 XA2 (střední agresivita podzemní vody)
- Overpouring: +0.5 m (TZ §6.3.3)
- CHA zkoušky: 16 ks (1+1 per podpěra OP1~P6 + 2+2 per OP7)
- PIT zkoušky: 122 - 16 = 106 ks
- Rebar index: reálně 80-100 kg/m³ (calculator default = 40 — BUG #13)
- Heads per shift Ø900: 3 (calculator C6 fix = 3 — correct)

## 4. Nosná konstrukce — Golden Numbers

- Typ: dvoutrámový předpjatý (bridge_deck_subtype='dvoutram')
- Rozpětí: 15 + 4×20 + 15 m (6 polí, max pole = 20 m)
- Šířka NK: 10.25 m (konstrukční), 10.85 m (vč. říms)
- Plocha NK: 10.85 × 111.5 = 1 209.78 m² (1 most)
- Technologie: **PEVNÁ SKRUŽ v 1 taktu** (TZ §7.2)
- Beton: C35/45 XF2, třída ošetřování 4
- Předpětí: 12 kabelů × 13 lan Y1860S7-15.7 (6/trám), jednostranné napínání
- Napínání: ≥ 7 dní od betonáže, ≥ 33 MPa

### Ošetřování dle TZ §7.8.3

| Teplota | Třída 2 | Třída 3 | Třída 4 |
|---|---|---|---|
| t ≥ 25°C | 1.5 d | 2.5 d | 5 d |
| 15–25°C | 2.5 d | **4 d** | **9 d** |
| 10–15°C | 4 d | **7 d** | **13 d** |
| 5–10°C | 5 d | **9 d** | **18 d** |

Spodní stavba = třída 3, NK + římsy = třída 4.
XF3/XF4 betony min. 7 dní VŽDY (TZ §7.8.3 poznámka).

## 5. Expected Calculator Outputs (golden assertions)

### 5a. Pilota OP1 LM (10 ks × Ø900 × 7.5 m, cased, below_gwt)

```
volume_per_pile_design    = π × 0.45² × 7.5  = 4.77 m³
overpouring_loss          = 10 × π × 0.45² × 0.5 = 3.18 m³
total_volume_incl_loss    = 47.7 + 3.18 = 50.9 m³
productivity              = 1.5 pilot/shift (Ø900 cased below_gwt)
drilling_days             = ceil(10 / 1.5) = 7
heads_per_shift           = 3 (Ø900)
head_adjustment_days      = ceil(10 / 3) = 4
tech_pause                = 7 d
total_days                = 7 + 7 + 4 = 18
rebar_total_kg_default    = 47.7 × 40 = 1908 (WRONG — real ≈ 4000)
cha_cost                  = 2 × 40000 = 80000 Kč
pit_cost                  = 18 × 5000 = 90000 Kč
```

### 5b. Základ opěry OP1 (C25/30 XF1, ~35 m³, h=1.2m)

```
orientation               = horizontal (C1 fix)
lateral_pressure          = SKIP (horizontal)
formwork_system           = Frami Xlife
formwork_area (L/W/H)     = 2×(7+4)×1.2 = 26.4 m² (E2 auto-compute)
curing @15°C XF1          = max(maturity 2d, exposure_floor 5d) = 5 d
curing @10°C XF1          = max(maturity 3d, floor 5d) = 5d — BUT TZ class 3 = 7d → BUG
curing @5°C XF1           = max(maturity 4d, floor 5d) = 5d — BUT TZ class 3 = 9d → BUG
exposure_warning          = NONE (XF1 in list after C3 fix)
needs_supports            = false
num_tacts                 = 1
```

### 5c. Dřík opěry OP1 (C30/37 XF4, ~55 m³, h=5.0m)

```
orientation               = vertical
lateral_pressure @h=5 k=0.85 = 104 kN/m²
needs_staging             = true (104 > 100), 2 záběry po 2.5 m
formwork_system           = TRIO / Framax Xlife
curing @15°C XF4          = max(maturity 1.5d, floor 7d) = 7 d ✓
exposure_warning          = ⚠️ FIRES — XF4 NOT in opery list → BUG #11
```

### 5d. Sloup P2 (C35/45 XF4, ~20 m³, h=6.0m)

```
orientation               = vertical
lateral_pressure @h=6     = 125 kN/m²
needs_staging             = true, 2 záběry po 3 m
formwork_system           = VARIO GT 24 / SL-1 Sloupové
curing @15°C XF4          = max(maturity 1.5d, floor 7d) = 7 d ✓
exposure_warning          = NONE (XF4 in driky_piliru list)
```

### 5e. Sloup P4 (C35/45 XF2, ~20 m³, h=6.0m)

```
curing @15°C XF2          = max(maturity 1.5d, floor 5d) = 5 d
exposure_warning          = ⚠️ FIRES — XF2 NOT in driky list → BUG #12
```

### 5f. Mostovka NK (C35/45 XF2, ~605 m³, 6 polí × 20 m)

```
bridge_deck_subtype       = dvoutram
construction_technology   = fixed_scaffolding (TZ §7.2)
recommendation            = fixed_scaffolding (span=20 < 25 → MSS infeasible)
warning                   = "4+ polí — zvažte MSS"
curing @15°C XF2          = max(maturity 1.5d, floor 5d) = 5 d — BUT TZ class 4 = 9d → BUG #1
prestress_days            = max(5, 20/10) = 5 d — BUT real = ~11 d → BUG #7
exposure_warning          = NONE (XF2 in mostovka list)
num_bridges               = 2 → warning "2 mosty bez dilatací"
is_prestressed            = true
```

## 6. Audit Bug Registry (24 bugs found)

### CRITICAL (7)

| # | Element | Bug |
|---|---|---|
| 1 | mostovka NK | Curing 5d vs TZ 9d (třída ošetřování 4 neimplementovaná) |
| 2 | wizard step 2 | Curing hint ignores exposure_class (shows 1.5d for XF2) |
| 3 | wizard steps 2-4 | Mostní params (span, polí, subtype) only in step 5 |
| 11 | opery_ulozne_prahy | XF4 missing from RECOMMENDED_EXPOSURE → false positive |
| 12 | driky_piliru | XF2 missing from RECOMMENDED_EXPOSURE → false positive |
| 13 | pilota | Default rebar 40 kg/m³ → 50% underestimate for bridge Ø900 |
| 14 | ALL elements | Curing class 2/3/4 not implemented — cold weather underestimates |

### MEDIUM (10)

| # | Element | Bug |
|---|---|---|
| 4 | bridge tech | MSS floor 25m (task says ≤40m + ≥4 polí → MSS) |
| 5 | mostovka props | Staxo 100 classifier vs Staxo 40 props (h=7.8 on boundary) |
| 6 | mostovka | Volume per-most vs total undefined, num_bridges=2 NE-doubles schedule |
| 7 | mostovka | Prestress 5d ignores cable count + injection (real ~11d) |
| 16 | driky_piliru | Wizard step 3 missing L/W/H block |
| 17 | opery (vertical) | E2 L/W/H block + vertical lateral pressure hint semantic overlap |
| 18 | pilota | No bulk input for 14 pile groups |
| 19 | opery + driky | needs_staging conservative (2 záběry for h=5-6m, real often 1) |
| 20 | zaklady_piliru | Rebar 100 kg/m³ estimate ~25% below real (120-150) |
| 21 | opery_ulozne_prahy | Rebar 100 kg/m³ estimate ~25-45% below real (120-180) |

### LOW (7)

| # | Element | Bug |
|---|---|---|
| 8 | mostovka | Rebar-lite doesn't include Y1860 prestressing cables |
| 9 | mostovka | No 2-phase pour mention for dvoutrám |
| 10 | ALL | No curing_class UI input field |
| 22 | kridla_opery | Duplicate in recommended_formwork array |
| 23 | mostni_zavirne_zidky | Missing from RECOMMENDED_EXPOSURE map |
| 24 | catalog | Missing element types: podložiskové bloky, podkladní betony, obruby |
| 25 | opery composite | Classifier composite suppression merges opěra+křídlo when user wants separate |

## 7. Fix Priorities

### P0 — Must fix before production use on bridge NK

1. **Curing class 2/3/4** (#1, #14): Add `curing_class?: 2|3|4` to CuringParams, expand CURING_DAYS_TABLE, orchestrator defaults 4 for NK/římsy, 3 for spodní stavba.
2. **RECOMMENDED_EXPOSURE gaps** (#11, #12): Add XF4 to opery_ulozne_prahy, XF2 to driky_piliru.
3. **Wizard exposure in hint** (#2): Pass exposure_class into wizardHint2 calculateCuring call.

### P1 — Important for SO202 accuracy

4. **Pile rebar default** (#13): Change DEFAULTS.rebar_index_kg_m3 from 40 to 80 for bridge piles.
5. **Prestress days formula** (#7): Add cable_count × injection_time component.
6. **Wizard bridge params** (#3): Move span/polí/subtype to step 1b or 2.

### P2 — Quality improvements

7. **Rebar ratios** (#20, #21): Increase defaults for zaklady_piliru to 120, opery to 140.
8. **MSS recommendation threshold** (#4): Lower MSS floor from 25m to "span ≤ 40m AND polí ≥ 4".
9. **Volume per-most clarity** (#6): Label "Objem betonu (1 most)" when num_bridges > 1.
