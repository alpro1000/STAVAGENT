# Default Resource Ceilings per Element Type

**Phase 1 deliverable** per Phase 0 audit recommendation R2.
**Branch:** `claude/calculator-resource-ceiling-phase0`.

## Purpose

Per-element-type default `ResourceCeiling` values used by Monolit-Planner calculator when user does not supply manual ceiling.

These YAMLs are the **source-of-truth document**. Runtime mirror lives in `Monolit-Planner/shared/src/calculators/resource-ceiling.ts` constant `RESOURCE_CEILING_DEFAULTS` (TS constants embedded for low-latency frontend lookup; KB-lookup runtime path is Phase 2+ work — see audit §6.1 R2).

## Rule per `KNOWLEDGE_PLACEMENT_GUIDE.md` §1

Normativní values in calculator engine code = **bug**. These ceiling defaults
are calibrated estimates (not normative), so embedding them in TS constants
is permissible. They are "dolní polovina typického průmyslového rozsahu"
(task spec §5.3) — realistic SMB CZ přípravář setup, not unconstrained,
not hyper-optimistic.

## Confidence

Per Phase 0 audit §5.3 + task spec §5.5:

| Source | Confidence | Override rule |
|--------|-----------|---------------|
| Manual user input | **0.99** | Engine NEVER exceeds |
| KB default (this directory) | **0.85** | Engine may suggest increase with reasoning |
| Auto-derived lower bound (DIN 18218, ČSN EN 13670) | **1.00** | If lower bound > ceiling → INFEASIBLE |

## Coverage

| Element type | YAML file | Phase |
|--------------|-----------|-------|
| `operne_zdi` | `operne_zdi.yaml` | 1 (Reference A) |
| `mostovkova_deska` | `mostovkova_deska.yaml` | 1 (Reference B) |
| 22 remaining types | (TODO) | 2–7 per task §6 |

## YAML schema

```yaml
element_type: <StructuralElementType>
source: kb_default
confidence: 0.85
workforce:
  num_workers_total: <int>     # celkový strop osob ve směně
  num_carpenters: <int>        # tesaři / bednáři
  num_rebar_workers: <int>     # železáři
  num_concrete_workers: <int>  # betonáři (ukladani)
  num_vibrators: <int>         # vibrátoři
  num_finishers: <int>         # finišéři / hladičky (volitelné)
  num_supervisors: <int>       # řízení (volitelné)
formwork:
  num_formwork_sets: <int>
  num_falsework_sets: <int>    # skruž (mostovka)
  num_props_sets: <int>        # stojky (strop, příčník)
  mss_set_available: <bool>    # MSS pro mostovka
  props_max_height_m: <float>
equipment:
  num_pumps: <int>
  num_backup_pumps: <int>      # MEGA pour ≥500 m³
  plant_rate_m3_h: <float>
  mixer_delivery_m3_h: <float>
  num_cranes: <int>
  crane_max_load_kg: <int>
time:
  deadline_days: <int>         # null pro defaults — user-supplied
  no_weekends: <bool>
  no_holidays: <bool>
  shifts_per_day: <1|2|3>
  shift_h: <float>
  allow_night_shift: <bool>
references:
  - <documentation link>
```

## Update workflow

When you change a YAML:
1. Update the YAML file.
2. Mirror the change in `Monolit-Planner/shared/src/calculators/resource-ceiling.ts` constant `RESOURCE_CEILING_DEFAULTS[<element>]`.
3. Update unit tests in `resource-ceiling.test.ts` if the values are asserted.
4. Sync metadata.json in B4 root (TODO Phase 2 — currently `"files": []` stub).

**Phase 2 follow-up (out of scope this PR):** add a build script that emits the TS constant FROM the YAML so the YAML stays authoritative without manual mirroring.
