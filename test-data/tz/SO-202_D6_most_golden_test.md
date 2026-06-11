# SO-202 D6 Karlovy Vary — Golden Test Data for Calculator Audit

**Source:** TZ PDPS VD-ZDS, VIAPONT s.r.o., Ing. Jan Macák (ČKAIT 1007197)
**Source documents in repo:** `test-data/SO_202_D6_KV_OV/` (TZ D-01-02-01 + výkresy + soupis `D6_KV-OV_Soupis-praci-a-vykaz-vymer_DI-015.xml`)
**Audit date:** 2026-04-16
**Audit session:** claude/calc-blocks-refactor-etX8c commits ffec7b3..55c0dbd
**Last re-snapshot:** 2026-06-11 (Part A — PDPS recalibration, viz níže)

**Provenance convention (Part A):** každé číslo etalonu nese status
`[TZ §X]` (technická zpráva) / `[VV pos. NNNNNN]` (výkaz výměr DI-015) /
`[odhad]` (estimate — NOT authoritative). Příští „605" musí být vidět
dřív, než se stane pravdou.

---

## Part A Recalibration Notes (2026-06-11) — PDPS technology fix

**Root cause:** §5f modeloval mostovku jako 6 taktů × 20 m s objemem
605 m³ `[odhad]`. PDPS TZ jednoznačně předepisuje JINOU technologii:

- TZ §7.2: „Předpokládá se betonáž NK na pevné skruži **v jednom taktu**"
- TZ §6.11.3: „Nosná konstrukce bude betonována **v jedné etapě** na pevné skruži"
- TZ Fáze 4: betonáž NK + aktivace předpětí v jedné etapě

**Authoritative quantities (VV DI-015, XC4 soupis, OBA mosty LM+PM):**

| Pozice | Položka | Množství oba | Na 1 most | Provenance |
|---|---|---|---|---|
| 422336 | NK předpjatý beton C35/45 | 1 386.700 m³ | **693.35 m³** | [VV pos. 422336 ÷ 2] |
| 422365 | Výztuž NK B500B | 208.005 t | **104.0 t** → 150 kg/m³ | [VV pos. 422365 ÷ 2] |
| 422373 | Předpínací lana Y1860 | 38.420 t | **19.21 t** | [VV pos. 422373 ÷ 2] |

Dřívější 605 m³ = `[odhad]` (5 m²/bm × 111.5 m) — NIKDY nebyl z VV.

**num_bridges=2 semantics:** VV množství jsou pro OBA mosty → vstup
kalkulátoru na 1 most = VV ÷ 2. Engine pozn.: orchestrator multi-bridge
větev (`num_bridges: 2`) interpretuje `volume_m3` jako součet OBOU mostů
a dělí jej na takty po mostech — golden §5f proto modeluje JEDEN most
(num_bridges nezadáno) s objemem 693.35 m³, aby takt = celá NK jednoho
mostu, přesně jak TZ předepisuje. (Pozn. recon: MCP docstring tvrdí
per-bridge sémantiku vstupu — rozpor s engine multi-bridge větví je
zaznamenán, NEŘEŠEN v Part A.)

**Starý 6-taktový case:** zachován jako `§5f-SYN` — explicitně označená
SYNTETIKA pro multi-takt logiku (NOT PDPS). Po merge Žalmanov goldenu
(Part C — skutečný PDPS 3-takt etalon) bude odstraněn.

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

## v4.22.0 Re-Snapshot Notes (Gate 2.1 — 2026-04-29)

**Gap #8 (CRITICAL) — terminology correction:**

Per Gate 1 audit Section C.3 Gap #8 + canonical doc §9.1 + DOKA katalog
(„Nosníkové bednění Top 50"), Top 50 + VARIOKIT HD 200 reclassified.
The v4.21.0 section above documented the SELECTOR fix (Top 50 chosen
instead of Staxo 100); v4.22.0 corrects the TERMINOLOGY of that selection
per canonical taxonomy.

Changes in `formwork-systems.ts`:
- Top 50: `pour_role` `'falsework'` → `'formwork'`; `formwork_subtype`
  `'nosnikove'` added (Vrstva 1 per canonical §9.2 — kontaktní povrch)
- VARIOKIT HD 200: `pour_role` `'falsework'` → `'formwork_beam'`
  (NEW enum value, Vrstva 2 per §9.2 — horizontální nosníky)
- `PourRole` enum expanded with `'formwork_beam'`
- `FormworkSubtype` type alias added:
  `'ramove' | 'nosnikove' | 'stropni' | 'beam'`

Output shape changes for SO-202 §5f mostovka:
- `plan.formwork.system.name` = `'Top 50'` (unchanged)
- `plan.formwork.system.pour_role` = `'formwork'` (was `'falsework'`)
- `plan.formwork.system.formwork_subtype` = `'nosnikove'` (NEW field)

Out of scope (Phase 2 narrow per Variant B decision):
- Staxo 100 reclassification (`'props'` → `'falsework'` per canonical
  Vrstva 3) — deferred to Phase 3 mostní review or Gate 3
- `plan.falsework.system` field (multi-layer output) — deferred, would
  require `recommendFormwork` return-shape refactor
- UI card title changes („Bednění nosníkové" vs „Skruž (nosníky)") —
  Gate 3 UI scope

Test assertions inverted in lockstep:
- `formwork-systems.test.ts:23-30` (Top 50 pour_role + subtype)
- `formwork-systems.test.ts:71-82` (VARIOKIT HD pour_role)
- `element-classifier.test.ts:630-647` (mostovka → Top 50 formwork +
  nosnikove)
- `golden-so202.test.ts:95-105` (§5f mostovka post-Gap-8 state)

References:
- Gate 1 audit: `Monolit-Planner/docs/AUDIT_Podpera_Terminologie.md`
  Section C.3 Gap #8
- Migration plan:
  `Monolit-Planner/docs/MIGRATION_PLAN_GATE2_TO_GATE4.md` Phase 2
- Canonical: `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA_Section9.md`
  §9.1, §9.2, §9.3
- Calculator philosophy: `docs/CALCULATOR_PHILOSOPHY.md`
- Phase 2 commits: `6d2784f` (types), `b60d24d` (Top 50),
  `b2fc701` (VARIOKIT HD)

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

- Typ: dvoutrámový předpjatý (bridge_deck_subtype='dvoutram') `[TZ §4]`
- Rozpětí: **15 + 4×20 + 15 m** (6 polí, max pole = 20 m)
  `[výkres 18 Tvar nosné konstrukce; TZ §6.5.1]`
  ⚠️ VNITŘNÍ ROZPOR TZ: §2.1 uvádí «15+5×20+15» (aritmeticky 130 m / 7 hodnot —
  překlep); správně §6.5.1 + výkres 18 (110 m ≈ délka NK 111.5 m).
  Potvrzeno Alexander, STOP gate A 2026-06-11.
- Šířka NK: 10.25 m (konstrukční), 10.85 m (vč. říms) `[TZ §1]`
- Plocha NK: 10.85 × 111.5 = 1 209.78 m² (1 most) `[TZ §1 — derived]`
- Technologie: **PEVNÁ SKRUŽ v 1 taktu** `[TZ §7.2; §6.11.3 „v jedné etapě"]`
- **Objem NK: 693.35 m³ / most** `[VV pos. 422336: 1 386.700 ÷ 2]`
  (dříve uváděných ~605 m³ = `[odhad]` — superseded)
- **Výztuž B500B: 104.0 t / most → 150 kg/m³** `[VV pos. 422365: 208.005 ÷ 2]`
- **Předpínací lana: 19.21 t / most** `[VV pos. 422373: 38.420 ÷ 2]`
- Beton: C35/45 XF2, třída ošetřování 4 `[TZ §2]`
- Předpětí: 12 kabelů × 13 lan Y1860S7-15.7 (6/trám), jednostranné napínání `[TZ §4]`
- Napínání: ≥ 7 dní od betonáže, ≥ 33 MPa `[TZ §4]`

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

> **Provenance §5a–§5e:** geometrie pilot + třídy betonu = `[TZ §2/§3]`;
> objemy elementů (~35 m³ základ, ~55 m³ dřík, ~20 m³ sloup, 47.7 m³
> piloty OP1) = `[odhad]` z výkresů — VV-rozpad spodní stavby na
> jednotlivé podpěry zatím neproveden (kandidát na doplnění při Part C
> retrospektivě). §5f = plný provenance rozpad výše.

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

### 5f. Mostovka NK — PDPS (C35/45 XF2, 693.35 m³/most, pevná skruž v 1 taktu)

**Vstup kalkulátoru (1 most; provenance per řádek):**

```
element_type              = mostovkova_deska
volume_m3                 = 693.35            [VV pos. 422336 ÷ 2]
formwork_area_m2          = 1209.78           [TZ §1: 10.85 × 111.5]
height_m                  = 7.795             [TZ §1, LM]
nk_width_m                = 10.85             [TZ §1]
concrete_class            = C35/45            [TZ §2]
exposure_class            = XF2               [TZ §2]
curing_class              = 4                 [TZ §2 — NK třída ošetřování 4]
bridge_deck_subtype       = dvoutram          [TZ §4]
span_m / num_spans        = 20 / 6            [TZ §1/§4: 15+4×20+15]
construction_technology   = fixed_scaffolding [TZ §7.2]
working_joints_allowed    = 'no'              [TZ §7.2 jeden takt; §6.11.3 jedna etapa]
is_prestressed            = true              [TZ §4]
prestress_cables_count    = 12, one_sided     [TZ §4]
rebar_mass_kg             = 104000            [VV pos. 422365 ÷ 2]
temperature_c             = 15                [konvence goldenů]
num_bridges               = NEZADÁNO — scope 1 most (viz Part A Notes výše)
```

**Expected outputs (engine snapshot 2026-06-11 v2 — po STOP gate A
rozhodnutí «21 d pryč»; ±10–15 % tolerance per Calculator Philosophy,
klasifikace exaktní):**

```
num_tacts                 = 1 (celá NK jednoho mostu = jeden záběr)
tact_volume_m3            = 693.35
technology                = fixed_scaffolding ✓
formwork_system           = Top 50 (formwork / nosnikove, DOKA)
props_system              = Staxo 40 (h=7.795 < 8)
pumps_required            = 4 + 1 záložní (MEGA zálivka ≥ 500 m³)
pour_hours (4 pumps)      = ~6.8 h / 1 pump scénář ~18–23 h @30–40 m³/h
curing_days               = 9 (třída 4 @15°C, TKP 18 §7.8.3) — sezónní skruž
                            floor ČSN 73 6244 (21 d podzim_jaro) se na PŘEDPJATOU
                            NK NEAPLIKUJE: gate odskružení = po napnutí
                            [TZ §6.5.2; STOP gate A rozhodnutí; tržně CN SAFE
                            «betonáž, zrání, předepnutí = 8 dní»]
prestress_days            = 13 = wait max(7, curing 9) + napínání 2 (12 kabelů
                            jednostranně, 6/den) + injektáž 2; skruž post-pour
                            celkem 22 d (zrání 9 + předpětí 13)
rebar mass                = 104.0 t (VV override; engine heuristika 100 kg/m³
                            pro předpjatou NK by dala 69.3 t — VV vyhrává)
total_days (1 most)       = ~77.5 prac. d (sequential 95.3)
mega-pour chování         = NEBLOKUJE; warnings: MEGA zálivka + záložní čerpadlo
                            povinné + interval domíchávačů ≤ 8 min + PDK +
                            kontinuita (retardér/okno) + resource-ceiling ⛔
                            (čerpadla 4 > strop 2, betonáři 8 > 6) s recovery hints
volume-geometry check     = ⚠️ warning „693.35 < ~1302 z geometrie" (dvoutram
                            eq-thickness heuristika; skutečný objem JE z VV —
                            warning je očekávaný engine output, ne chyba vstupu)
```

**Známá residuální konzervativnost enginu (zaznamenáno, neřešeno):**
engine řadí fáze zrání (9 d) a předpětí (13 d, uvnitř wait 9) SEKVENČNĚ →
skruž post-pour 22 d; PDPS-minimum je ~11 d (wait 7 ⊂ ošetřování, napínání
od 7. dne) a CN SAFE kalkuluje «betonáž, zrání, předepnutí» = 8 d. Overlap
wait⊂zrání = vnitřní dluh scheduleru (příbuzný 220.5/307.8), samostatný task.

### 5f-Nh. Nh-snímek mostovky (vlastní výkon — kanonická projekce ×0.8)

> Model je VŽDY **vlastní výkon**: engine počítá fyzickou cenu práce
> vlastními silami; subdodávka NENÍ režim enginu, ale externí cena pro
> srovnání (viz §CN níže). Snapshot z `buildLaborProjection`, 2026-06-11.

| Operace | dní | Nh (kánon ×0.8) | h přítomnost | Nh/m³ |
|---|---|---|---|---|
| armování (výztuž B500B, 104 t) | 27.9 | 892.8 | 1 116 | 1.29 |
| předpětí (napínání + injektáž) | 13.0 | 520.0 | 650 | 0.75 |
| betonáž | 1.6 | 51.2 | 64 | 0.07 |
| skruž + bednění montáž + demontáž | 65.8 | 2 106.6 | 2 633 | 3.04 |
| ošetřování betonu | 1.5 ⚠️ | 6.0 ⚠️ | 7.5 | 0.01 |
| **CELKEM** | — | **3 576.6** | **4 470.8** | **5.16** |

⚠️ ošetřování: scheduler-fáze zrání v tact_details má span 1.5 d, zatímco
`curing_days` = 9 — projekce dědí podhodnocený span (mělo by být ~9 d ×
5 h × 0.8 = 36 Nh). Engine-internals nález ze STOP gate A, kandidát na
opravu v `labor-projection` (days = max(span, curing_days)) — čeká
rozhodnutí Alexander, neměněno mlčky.

### 5f-SYN. Mostovka — SYNTETIKA 6 taktů (NOT PDPS — multi-takt stress-test)

⚠️ **NOT PDPS.** TZ §7.2 předepisuje jeden takt (viz §5f). Tento case je
zachován VÝHRADNĚ jako syntetický stress-test multi-takt logiky, dokud
Žalmanov golden (Part C) nedodá skutečný PDPS multi-takt etalon — pak
bude odstraněn.

```
volume_m3                 = 605 [odhad — syntetika]
6 polí × 20 m → num_tacts > 1 (volume/pump-window driven)
construction_technology   = fixed_scaffolding
curing @15°C XF2          = max(maturity 1.5d, floor 5d) = 5 d — BUT TZ class 4 = 9d → BUG #1 (RESOLVED v4.18)
prestress_days            = max(5, 20/10) = 5 d — BUT real = ~11 d → BUG #7 (RESOLVED v4.18)
exposure_warning          = NONE (XF2 in mostovka list)
num_bridges               = 2 → warning "2 mosty bez dilatací"
is_prestressed            = true
```

### 5h. CN SAFE 26-027C — nabídka skruž + bednění (srovnávací fixtura)

> Provenance: `[CN SAFE 26-027C, 19.02.2026]` (Safe Czech s.r.o. pro
> Berger Bohemia a.s.; soubor v `test-data/SO_202_D6_KV_OV/`).
> CN je FIXTURA pro srovnání **vlastní výkon vs nabídka** — NENÍ vstup
> enginu. Engine vždy počítá vlastní výkon (viz §5f-Nh).

- **Kontaktní plocha bednění NK: 1 527.6 m² / most** — Meccano, rozvinutá
  šířka **13.7 m** × 111.5 m vč. přesahů. POZOR: ≠ plocha NK 1 209.775 m²
  `[TZ §2.1]` (půdorysná 10.85 × 111.5) — obě hodnoty žijí vedle sebe
  s různým významem (kontakt bednění vs plocha desky).
- **Objem nasazené skruže POLY: 5 838.3 m³ / most** (9.7 × 5.5 × 110 m).
- **Harmonogram dodavatele:** most 1 = 54 (montáž skruž+bednění) + 28
  (vázání výztuže vč. předpínacího systému) + **8 (betonáž, zrání,
  předepnutí)** + 24 (demontáž) = **114 d**; most 2 = 37 + 28 + 8 + 24 =
  **97 d** (druhá montáž rychlejší — predmontáž + sada se znovupoužívají);
  +10 d rozebrání předmontované sady (závěr).
- Jednotkové ceny (pronájem /30 d): POLY 41.40 Kč/m³, Meccano 190 Kč/m²,
  RINGSCAFF věž 900 Kč/m, nosníky 1 374 Kč/t. Montáže: POLY 180 Kč/m³,
  predmontáž Meccano 650 Kč/m², montáž+demontáž 950 Kč/m². Překlenutí:
  79.8 t nosníků. Rekapitulace projektu (oba mosty): pronájem 4 661 204 +
  montáže 6 814 328 + doprava 568 928 + mechanizace 3 295 000 + PD 208 100 +
  statika 50 900 + tisk VTD 10 000 = **15 608 460 Kč bez DPH**.

### 5i. Semantika dvou mostů (PRINCIP — implementace Part C)

`[Alexander, STOP gate A 2026-06-11]` SO 202 = **objekt**; LM/PM = dva
**podobjekty**, každý s plnou sadou elementů (piloty → římsy). VV-množství
÷ 2 na podobjekt. Harmonogram **sekvenční se sdílenou sadou skruže**
(zdroj se sdílí, objemy se dělí; CN SAFE potvrzuje: druhá montáž 37 d
místo 54 d díky znovupoužití). Tento princip uzavírá recon-nesoulad
`num_bridges` (engine multi-bridge větev dělí volume jako součet obou
mostů vs MCP docstring per-bridge): golden modeluje podobjekt (1 most),
objektová agregace LM+PM = úroveň výš.

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
