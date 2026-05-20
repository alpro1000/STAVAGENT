# Pattern 09 — Iterative layer probe (ANTI-PATTERN, user-caught gaps)

**Source pilot:** RD Jáchymov (Phase 0b §3.3 first-pass, 2026-05-17)
**Pipeline phase:** N/A — this is the CAUSE that motivated Pattern 08
**Status:** **ANTI-PATTERN** — preserved jako negative example, do NOT replicate

## What happened

Phase 0b §3.3 DXF extraction was implemented as **keyword-driven incremental probing**:

```python
# DON'T DO THIS
TARGET_LAYERS = ['SM_kóty', 'okno_', 'dveře_']  # known-good list
for dxf in DXF_FILES:
    for layer in dxf.layers:
        if any(k in layer.dxf.name for k in TARGET_LAYERS):
            extract(layer)
        # ostatní LAYERS NOT PROBED — silently skipped
```

This probed **11 layers across 4 files** (out of 156 total). Generated items.json shipped to Part 2 review.

User opened review session 2026-05-17, asked:
> "почему ты не вынял данные с чертежей" (Why didn't you extract data from the drawings?)

User had spotted:
- ETICS thickness in popis ("200 mm") didn't match řez S01 (which says 160 mm)
- PIR thickness in popis ("180 mm") didn't match řez S10 (which says 160 mm)
- Klempířina was single aggregate item, but DXF has 4 distinct INSERT block types
- Obklady koupelen used flat 2.0 m ČSN fallback, but řez D.1.1.2.2.21 has per-koupelna heights (1.6 / 2.45 / 2.70)
- Špalety perimeter was flat 5 m × N_oken estimate, but DXF block bbox gives exact 2×(W+H) per typ
- Per-podlaží světlé výšky were silently inherited from TZ text 2700 mm flat, ale DXF SM_kóty + řez A-A gives 2.10 / 2.795 / 2.865 / 2.63

**6 silent drifts**, all caught by user manual cross-check proti DXF + řez PDFs. If undetected, items.json would have shipped to Karel Šmíd s 6 confirmed errors.

## Why the keyword-driven approach failed

1. **Naming variability:** TZB items live on `_kanaliz`, `_voda_T`, `_topeni`, `_ELE_SS` — no shared keyword
2. **Embedded tables:** Výpis oken byl na `nabytek_VYPIS_OKEN`, ne na žádném `okno_*` layer
3. **Krov / střecha:** `kr_*` layers (krovová geometrie) didn't match any keyword, contained polyline lengths for klempířina
4. **HATCH layers:** decorative pattern names (`HATCH_BETON1`, `HATCH_INSULATION_*`) — semantic content invisible from name
5. **Confirmation bias:** "if my keyword matches, that's the right layer" — never enumerated unprobed

## What was missing

**No explicit per-layer `probe_status`** — silently skipped layers indistinguishable from explicitly-confirmed-empty layers.

## Cure (Pattern 08)

Phase 0a Completeness Audit now mandatory:
- **List ALL 156 layers** before probing decisions
- **Tier 1-5 prioritization** ensures every layer reaches `probed_extracted` OR `probed_metadata_only_confirmed`
- **Zero `probe_status: unknown`** allowed pre-Phase-1 gate

Result on RD Jáchymov rerun: 156/156 layers probed → 11 silent drifts caught + cured WITHOUT user manual checking.

## Forbidden

- ❌ "Quick keyword pass, ostatní určitě nemá nic" — that's exactly the trap
- ❌ Probing without producing per-layer manifest s probe_status
- ❌ Assuming consistency napříč pilots — RD Jáchymov má 156 layers, next pilot může mít 240, různě pojmenovaných

## Lesson

**Completeness ≠ correctness. Můžeš mít 100 % correct data za 7 % source pokrytí — and still ship 93 % blind spots.** The user-caught gap is the cheapest possible discovery (we shipped 0 errors). The next pilot may not have an Alexander watching.
