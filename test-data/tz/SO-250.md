# SO-250 — Golden test spec pro kalkulátor

**Element type:** `operne_zdi` (žádný nový typ; zárubní = opěrná konstrukčně)
**Zdroj:** ŘSD, D6 Olšová Vrata – Žalmanov, PRAGOPROJEKT, PDPS, Zak.č. 25-150-2
**Test-data path:** `test-data/tz/SO-250.md` (po commitu)
**Status:** spec, hand-verified expected values, ne implementace
**Datum:** 2026-05-14

---

## 1. Identifikace objektu

| Pole | Hodnota |
|------|---------|
| Stavba | D6 Olšová Vrata – Žalmanov, VD-ZDS |
| SO | **250 – Zárubní zeď v km 6,500 – 7,000 vpravo** |
| Staničení | km 6,492 40 – 7,007 60 |
| Stupeň | PDPS |
| Investor | ŘSD s.p. |
| Projektant | PRAGOPROJEKT, a.s. |

---

## 2. Vstupy do kalkulátoru

### 2.1 Element a kontext

```yaml
element_type: operne_zdi
is_bridge: false
project_type: verejna_zakazka     # ŘSD → OTSKP primary catalog
season: TBD                        # user input (zima/léto/celý rok)
working_hours_per_day: 10          # default per ZP §79
```

### 2.2 Geometrie

```yaml
length_total_m: 515.20
height_above_terrain_min_m: 1.55
height_above_terrain_max_m: 3.40
nk_height_min_m: 2.65
nk_height_max_m: 4.50
visible_area_m2: 1737.44

base_thickness_m: 0.56
base_width_m: 2.75
wall_thickness_m: 0.45
wall_height_min_m: 1.65
wall_height_max_m: 3.50

rimsa_width_m: 0.85
rimsa_thickness_face_m: 0.40
rimsa_thickness_back_m: 0.36

podkladni_beton_thickness_m: 0.15
podkladni_beton_overhang_m: 0.25
```

### 2.3 Dilatace

```yaml
dilatation:
  main_count: 40
  main_length_m: 12.50
  edge_count: 2
  edge_length_m: 7.60
  total_dc: 42
  total_length_check_m: 515.20  # 40*12.5 + 2*7.6 = 515.2 ✓
```

### 2.4 Materiály (po jednotlivých záběrech)

| Element | Beton | Expozice | Cl- | Dmax | Konzistence |
|---------|-------|----------|-----|------|-------------|
| Podkladní beton | **C12/15** | X0 | 1.0 | 22 | S2 |
| Základ | **C25/30** | XF3, XC2, XA2 | 0.4 | 22 | S3 |
| Dřík | **C30/37** | XF4, XC4 | 0.4 | 22 | S3 |
| Římsa | **C30/37** | XF4, XD3, XC4 | 0.4 | 22 | S3 |
| Spárovací malta | MC25 | XF4 | — | — | — |
| Výztuž | **B500B** | — | — | — | — |

### 2.5 Geotechnika

```yaml
geology: granit_karlovarskeho_plutonu
soil_class_excavation: I-III  # ČSN 73 6133, lokálně IV
edef2_base_min_MPa: 60
edef2_backfill_min_MPa: 45
edef2_to_edef1_ratio_max: 2.5
stray_currents_protection_grade: 3  # TP 124
```

### 2.6 Bednění

```yaml
formwork_quality:
  invisible_surfaces: C1d   # TKP PK kap. 18
  visible_surfaces: C2d     # vícevrstvé desky, pečetící pryskyřice
edge_chamfer_mm: 15
precision_class: 10  # TKP PK kap. 1
```

---

## 3. Expected outputs kalkulátoru

### 3.1 Objemy betonu (m³, vypočítané ručně)

| Položka | Vzorec | Hodnota |
|---------|--------|---------|
| Podkladní beton | 515.20 × (2.75 + 2×0.25) × 0.15 | **251.16** |
| Základ | 515.20 × 2.75 × 0.56 | **793.41** |
| Dřík (průměr výška 2.575) | 515.20 × 0.45 × 2.575 | **596.97** |
| Římsa (průměr tl. 0.38) | 515.20 × 0.85 × 0.38 | **166.41** |
| **Celkem** | | **≈ 1808** |

**Tolerance:** ±2% (kalkulátor může počítat sumací přes 42 DC s mírně odlišnou průměrnou výškou).

### 3.2 Plochy bednění (m²)

| Plocha | Strana | Vzorec | Hodnota | Kategorie |
|--------|--------|--------|---------|-----------|
| Dřík líce | pohledová | (z TZ) | **1737.44** | C2d |
| Dřík rub | invisible | ≈ 1737 | **1737** | C1d |
| Základ líce | invisible | 2 × 515.20 × 0.56 | **577** | C1d |
| Římsa líce | pohledová | 515.20 × 0.40 | **206** | C2d |

### 3.3 Výztuž (kg, default operne_zdi)

- Default v knowledge base: **D12 hlavní + D10 strmínky**, rate ≈ 120 kg/m³ (REBAR_NORMS_AUDIT 2026-04-20)
- Základ: 793 m³ × 120 = **95 160 kg**
- Dřík: 597 m³ × 120 = **71 640 kg**
- Římsa: 166 m³ × 130 (vyšší pro římsu, D10 hustší) = **21 580 kg**
- **Celkem: ≈ 188 380 kg** (≈ 188 t)

**Pozn.:** kalkulátor nemá vstup pro vlepené kotvy R8 0.75×0.75 m (žulový obklad) — to je out of scope.

### 3.4 Záběry (pour windows)

- Per dilatační celek = 1 záběr pro každý element (podkladní, základ, dřík, římsa)
- 42 DC × 4 elementy = **168 záběrů**
- Optimální sled: podkladní → základ → dřík → (tech. pauza 28 dní) → římsa
- Objem max. záběru: 12.5 × 0.45 × 3.50 ≈ **19.7 m³** (dřík nejvyšší DC) → není MEGA pour

### 3.5 Crew & pumps (z v4.24 logiky)

Záběr ~20 m³ → "malý-střední" segment:
- Pump count: **1 čerpadlo** (V < 80 m³ není MEGA)
- Crew per pour: **3 lidi** (2 ukládka + 1 vibrace)
- Crew per shift (bednění+výztuž+betonáž paralelně): **6-8 lidí**

### 3.6 Doba trvání (orientačně)

- 1 DC kompletní cyklus (základ→dřík→tech.pauza→římsa): ≈ **6 týdnů**
- Při 1 záběru v denně + paralelizaci přes celky → 42 DC za **~28 týdnů** = **6.5 měsíce** za jednu sezonu

---

## 4. Resource ceiling scenarios (Phase 1 validation)

### Scenario A — Realistic (feasible)

```yaml
resource_ceiling:
  total_workers: 14
  pump_count_max: 2
  duration_target_months: 7

expected_engine_output:
  feasibility: FEASIBLE
  warnings: []
  pour_count_per_day_avg: 2
```

### Scenario B — Tight ceiling (infeasible)

```yaml
resource_ceiling:
  total_workers: 5
  pump_count_max: 1
  duration_target_months: 7

expected_engine_output:
  feasibility: INFEASIBLE
  warnings:
    - "⛔ KRITICKÉ: Strop 5 osob nestačí na 42 DC za 7 měsíců"
    - "Doporučení: zvýšit strop na 12+ osob NEBO prodloužit termín na 14 měsíců NEBO rozdělit na 2 sezony"
  resource_violations:
    - resource: total_workers
      required: 12
      ceiling: 5
      delta: 7
```

### Scenario C — Zimní pauza (etapizace)

```yaml
resource_ceiling:
  total_workers: 14
  pump_count_max: 2
  duration_target_months: 4   # nelze stihnout, jen léto/podzim

expected_engine_output:
  feasibility: PARTIAL
  warnings:
    - "Záběr za 4 měsíce je nedostatečný — etapizace nutná"
    - "Doporučení etapa I (rok 1): DC01–DC22 (≈ 270 m), etapa II (rok 2): DC23–DC42"
  staging_required: true
```

---

## 5. Edge cases / known calculator gaps

### 5.1 Žulový obklad — out of scope (flag)

- 1737 m² × 0.30 m × hmotnost = ~1500 m² žulového kamene 200-300 mm
- Vlepené kotvy R8 v rastru 0.75×0.75 m → ~3000 ks kotev
- Spárovací malta MC25 XF4
- **Calculator current scope NEUMÍ:** prosím o flag "nezahrnuto v kalkulaci", uživatel přidá manuálně do soupisu

### 5.2 TZ ↔ výkres konflikty (extractor probe)

Calculator dostává buď ručně zadané hodnoty, nebo z extractora. Pokud z extractora s konfliktem TZ ↔ výkres:

| Element | TZ str. 6 | Výkres 03 | Co kalkulátor přijme |
|---------|-----------|-----------|----------------------|
| Podkladní beton | C25/30 XF3 XA2 XC2 | **C12/15 X0** | Výkres (drawing wins) |
| Dřík expozice | XF3 XD3 XC4 | **XF4 XC4** | Výkres |
| Zábradlí výška | 1.10 m | **1.15 m** | TZ (NK level, výkres = vč. patní desky) |

**Tato volba musí být zalogována v audit trail (formula+vstupy+kroky+confidence).**

### 5.3 Hluboké výkopy v třídě IV

- TZ §3.3: lokálně třída těžitelnosti IV (skalní)
- Kalkulátor default: třída I-III. **Cena/produktivita výkopu jiná** pro IV.
- Doporučení: zobrazit varování "Lokální skalní výkop — manuálně upřesnit rozsah".

### 5.4 Lícový obklad jako "akustický obklad"

- TZ §3.1: "akustický obklad výšky 3.0 m"
- Výkres 03: "Lícové zdivo - materiál žula"
- **Konflikt:** akustický vs konstrukční obklad? Pravděpodobně **kámen plní akustickou funkci** (hmotnost pohlcuje hluk). Doporučení: kalkulátor klasifikuje jako jednu položku "Lícový žulový obklad s akustickou funkcí", neduplikuje.

---

## 6. Verification checklist (manual smoke test)

Při manuálním testu v kalkulátoru zaškrtnout:

- [ ] Element klasifikován jako `operne_zdi` (ne nový typ)
- [ ] Volumes vypočtené v rámci ±2% tolerance (251 / 793 / 597 / 166 m³)
- [ ] Pohledová plocha 1737 m² → bednění C2d
- [ ] Záběry = 42 DC × 4 elementy = 168
- [ ] Pour decision: 1 čerpadlo per záběr (V<80 m³)
- [ ] Crew per pour: 3 lidi (malý-střední segment, ne MEGA)
- [ ] Doba trvání orientačně 6-7 měsíců při 14 lidech
- [ ] Resource ceiling 5 lidí → INFEASIBLE + recovery suggestion
- [ ] Zimní pauza scenario → PARTIAL + etapizace návrh
- [ ] Audit trail obsahuje formula+vstupy+kroky+confidence

---

## 7. Bug capture template

Pokud při testu cokoliv selže, zaznamenat:

```
BUG #N
Scénář: [A/B/C/jiný]
Vstup: [parametr a hodnota]
Očekáváno: [z této spec]
Skutečnost: [co kalkulátor vrátil]
Severity: [P0 blocker / P1 high / P2 medium / P3 low]
Repro: [krok 1, krok 2, ...]
Screenshot: [path]
```

Buggy se commitují do `docs/audits/calculator_so250_validation/YYYY-MM-DD_bugs.md`.

---

## 8. Related work

- Phase 1 Resource Ceiling: PR #1110 (DONE, b40450de)
- Golden tests existing: VP4 FORESTINA, SO-202, SO-203, SO-207
- Briefing: `SO250_briefing_calculator_test.md` (this session output)
- SmartExtractor probe: `SO-250_smartextractor_probe.md` (paralelní track)

---

**End of golden test spec. K commitu do `test-data/tz/SO-250.md`.**
