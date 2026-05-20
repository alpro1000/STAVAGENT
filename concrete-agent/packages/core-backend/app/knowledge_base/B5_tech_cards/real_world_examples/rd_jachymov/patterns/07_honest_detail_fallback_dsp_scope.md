# Pattern 07 — Honest detail fallback within DSP scope

**Source pilot:** RD Jáchymov (Phase 1 PSV gate, Part 2 obklady koupelen)
**Pipeline phase:** Phase 1 generator
**Status:** PARTIALLY SUPERSEDED by Pattern 05 (Path C exhaustive extraction) — fallback still applies kde DSP nedostatek je opravdový (nikoli neprobed)

## Problem

DSP (Dokumentace ke Stavebnímu Povolení) má **typický scope limit** — neobsahuje:
- Výpisy oken / dveří per typ
- Tabulky místností s plochami
- Detailní skladby vrstev
- Schémata silnoproudu / slaboproudu

Pilot může čekat PD-pro-DPS upgrade (typically +6 týdnů, +400 KKČ projektant fee), NEBO produkovat varianta-B s explicit `_data_quality` fallback flags.

## Solution — Cascading fallback s explicit flag

Source priority order (per Phase 0b §3.3 codification):

```
1. DXF DIMENSION explicit            → confidence 0.99, _data_quality: dxf_deterministic
2. DXF LWPOLYLINE bbox / INSERT      → confidence 0.95, _data_quality: dxf_partial_pip
3. DXF + TZ explicit both confirm    → confidence 0.95, _data_quality: dxf_plus_tz_explicit
4. TZ explicit only                  → confidence 0.85, _data_quality: tz_explicit
5. DXF partial + TZ assumption       → confidence 0.85, _data_quality: dxf_partial_pip_plus_tz_assumption
6. DXF obvod + TZ silent výška ČSN   → confidence 0.85, _data_quality: dxf_obvod_plus_tz_silent_fallback_vyska_podlazi_csn
7. ČSN default (TZ silent)           → confidence 0.75, _data_quality: tz_silent_fallback_csn_default
8. Methvin empirical ratio           → confidence 0.75, _data_quality: empirical_ratio
9. TZ-only aggregate (no expansion)  → confidence 0.75, _data_quality: tz_only_aggregate
< 0.70 — STRICT DROP, never include
```

## Live example — obklady koupelen RD Jáchymov

**TZ ARS dum:** "obklady koupelen 200/250/300 v rozsahu projektu" — výška NE specified.

**ČSN default fallback:** flat 2.0 m → koupelna 1.05 (4.2 m²), 2.03 (6.7 m²), 3.04 (4.9 m²) na výšku 2.0 m.

**Part 2 řez D.1.1.2.2.21 cross-check:** specific koupelna heights 1.6 / 2.45 / 2.70 m → recalced, `_data_quality: dxf_deterministic` (upgraded from `tz_silent_fallback_csn_default`).

Auditor čte `_data_quality` flag → ví, že NE jde o fabrication, ale explicit fallback chain s upgrade path.

## Forbidden

- ❌ Padding items at confidence < 0.70 → **strict drop**, never include
- ❌ Promoting confidence bez explicit DXF / TZ corroboration ("AI estimated 0.85" → no)
- ❌ Hiding `_data_quality` flag z Excelu — investor sees what's deterministic vs fallback

## Anti-pattern lesson

Před Phase 0a Completeness Audit (Pattern 08) byla "DSP nedostatek" easy excuse — extractor by jednoduše označil item `tz_silent_fallback` a moved on. Ale Path C odhalil, že VŠECHNY claimed DSP-nedostatky for RD Jáchymov byly actually **available v DXF**, jen unprobed. Honest fallback aplikuj POST Pattern 05 exhaustive extraction, ne místo něj.
