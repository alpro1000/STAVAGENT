# Pattern 01 — File-swap detection via independent re-parse

**Source pilot:** RD Jáchymov Fibichova 733 (N=5, 2026-05-16 → 2026-05-18)
**Pipeline phase:** Phase 0b §3.2 — `tools/phase0b_validator.py`
**Status:** validated

## Problem

V canonical layoutu `inputs/tz/260219_dum/D_2_1_TZ_statika_dum_TeAnau.pdf` byl SWAPPED se souborem pro sklad — `_dum_` soubor obsahoval per-page header "Zahradní sklad", `_sklad_` obsahoval "Dům". Filename-only routing v Phase 0a UNSORTED audit by ten swap missed.

Manuální spot check by jednoduše předpokládal že filename = obsah. Smoking gun: Rdt drift 300/350 mezi dum/sklad v pre-baked extraction.

## Solution

`tools/phase0b_validator.py` (pypdf-based independent re-parse) + 69 cross-checks proti pre-baked TZ extraction. Confidence ladder per task §5:

```
regex (1.0)  >  DXF (0.95)  >  substring (0.85)  >  AI (0.70)
```

Re-parse VŽDY vyhrává nad pre-baked (per user policy 2026-05-16). Discrepancy ≥0.10 mm na rozměru = drift flag → manual SHA-verified file swap.

Pre-swap: 36/69 (52 %) matches, 3 drift flags.
Post-swap: 67/69 (97.1 %) matches, 0 drift flags.

## Generalization

Pattern aplikovatelný na ANY pilot kde:
- multiple objekty (dum + sklad, SO1 + SO2, …) sdílejí filename schema
- TZ obsahuje structural numbers (Rdt, beton class, půdorysné rozměry) jako "fingerprint"

## Forbidden

- ❌ Hard-delete kteréhokoli "duplicitního" PDF před SHA verification
- ❌ Filename-only routing v Phase 0a UNSORTED audit
- ❌ Trust pre-baked extraction nad re-parse když diff ≥ 0.10
