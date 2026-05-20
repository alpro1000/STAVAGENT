# Pattern 05 — Exhaustive DXF extraction (5-tier prioritization)

**Source pilot:** RD Jáchymov (Path C — 2026-05-18, post user-caught gap)
**Pipeline phase:** Phase 0a → Phase 0b §3.3 (DXF parse)
**Status:** validated, mandatory pre-Phase-1 rule
**Anti-pattern reference:** `09_iterative_layer_probe_user_caught_gaps.md`

## Problem

Phase 0b §3.3 first pass probed jen 11 ze 156 DXF layers napříč 4 souborů (7 %). Bias: extractor sahal po keyword-matched layers (`SM_*`, `okno_*`), ignoroval celé třídy (`HATCH_*`, `kr_*` krov, `popisy_*`, `nabytek_*`). User-caught — would have shipped 187 items s neoznámenou 93 % subset bias.

## Solution — 5-tier exhaustive sweep

Enforce ALL layers probed before Phase 1 gate opens. Per-tier prioritization umožňuje time-bounded delivery without sacrificing completeness:

### Tier 1 — Dimensions (`get_measurement()`)
- ALL DIMENSION entities napříč všech files
- Magnitude bands: micro <100, small 100-999, medium 1k-9k, large ≥10k
- Cross-reference proti pre-existing items → flag conflicts ≥ 0.10 m drift
- RD Jáchymov yield: 785 entities → 208 unique → 0 conflicts, 17 new decoration measurements

### Tier 2 — MTEXT classified
- ALL MTEXT entities → text classification (skladba_legenda / dimension_callout / S-code / popis_místnosti / technické_značky / ostatní)
- Embedded table extraction: rows split on `^I` literal tab (Czech CAD encoding)
- Disambiguate ambiguous dimension callouts (e.g. ETICS 160 mm vs PIR 160 mm) přes lokální layer + řez context
- RD Jáchymov yield: 2268 entities, 31 layers, ETICS/PIR 160 disambiguation, 16 oken + 14 dveří embedded tables

### Tier 3 — Geometry + HATCH + dual catalog
- LWPOLYLINE / LINE / ARC / HATCH counts per layer
- HATCH pattern semantic map (CONCRETE1 → ŽB, V_MASONRY → cihla, INSULATION → izolant, WOOD3 → krov/podlaha)
- External perimeter, closed polygon areas top-10 per layer
- Catalog cache inventory (URS, KROS TSKP, …) — set aside pro Part 5b

### Tier 4 — INSERT block discovery
- ALL INSERT entities, block_name pattern dictionary (klempir_*, sanit_*, kuchyne_*, nabytek_*, schody_*, bourani_X, plot_*, wall_block, …)
- Unmapped block names → Counter most_common(50) → human review
- Klempířina category breakdown ze INSERTů → seeds N-way split items

### Tier 5 — Metadata layers (skip confirmation)
- Match `rozpiska|defpoints|severka|popisy_bubliny|razítk|stafáž|netisk` patterns
- Per layer: `probe_status: probed_metadata_only_confirmed` + explicit `decision: skip — title block / severka / …`
- Closes the inventory loop — 0 layers s `probe_status: unknown`

## Acceptance criteria pro Phase 1 gate

```
all_layers_count == probed_count
  where probed_count = (Tier 1-4 actionable) + (Tier 5 explicit skip)
  AND 0 layers s probe_status: unknown
```

RD Jáchymov result: 156/156 layers probed (47 actionable extracted, 31 metadata skip-confirmed, 78 ostatní explicit `n_entities: 0` empty/decoration).

## Forbidden

- ❌ "Spot check" extraction — pick 3-5 obvious layers, hope ostatní obsahuje totéž
- ❌ Skipping HATCH patterns "protože je to dekorativní" — semantic HATCH disambiguates beton / cihla / izolant
- ❌ Treating Tier 5 metadata jako Tier 1-4 — different probe_status + decision

## Tools

- `tools/path_c_tier1_dimensions.py`
- `tools/path_c_tier2_mtext.py`
- `tools/path_c_tier3_geometry.py`
- `tools/path_c_tier4_5_inserts_metadata.py`
