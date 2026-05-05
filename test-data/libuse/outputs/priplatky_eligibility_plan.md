# Audit Part E — Příplatky eligibility plan

Identifies items eligible for ÚRS RSPS surcharges (R-suffix items).

**NOTE: NO implementation yet — this is just a plan. Implementation deferred to Phase 7b after Phase 7a ÚRS base lookup completes.**

## Eligibility category 1 — Tloušťka cement screed > 50 mm

Triggers ÚRS R-suffix 'Příplatek za každý další 1/5 mm tloušťky'.

| FF code | Skladba tl. | Delta over 50 mm | Items affected | Σ m² |
|---|---:|---:|---:|---:|
| `FF31` | 58.0 mm | +8.0 mm | 19 | 326.3 |

## Eligibility category 2 — Světlá výška > 4 m

Triggers HSV-611/612 omítky + PSV-784 malby surcharge.

_(No rooms with světlá výška > 4 m — no eligibility)_

## Eligibility category 3 — R11 odolnost dlažby (wet rooms F18/F22)

- Items affected: **80**
- Σ m² wet floor: **246.2**

## Eligibility category 4 — Lešení v 1.PP (stísněné)

- Items affected: **2**

## Eligibility category 5 — Malé množství (< 5 jednotek)

- Items affected: **667**
- Triggers ÚRS 'Příplatek za malé množství' (varies per kapitola)

## Summary

- **Total eligible item-instances** (across all categories): ~768
- Estimated cost impact: +5-10 % over base ÚRS prices
- For Libuše D scope: ~+500 tis – 1 mil Kč

## Recommendation

⏳ **LOW priority** (defer to Phase 7b after ÚRS lookup). Implementation requires:
1. Phase 7a returns urs_base_code per item
2. For each eligible item, compute delta (e.g. tl. 55 mm − 50 mm = +5 mm)
3. Lookup R-suffix code in ÚRS catalog
4. Emit příplatek item paired_with base item