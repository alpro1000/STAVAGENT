# Pattern 04 — Workflow gate ≠ classification kapitola_group

**Source pilot:** RD Jáchymov (Phase 1 TZB+M gate)
**Pipeline phase:** Phase 1 generator + merge logic
**Status:** validated

## Problem

User-spec workflow gate "TZB+M" obsahuje:
- PSV-72 zdravotechnika
- PSV-73 vytápění
- M-21 silnoproud
- M-22 slaboproud

Z catalog perspective `kapitola_group ∈ {HSV, PSV, M, VRN}`, ale workflow gate je orthogonal user concept ("review tyto 4 kapitoly together protože sdílejí instalatér/elektrikář scheduling").

Naivní merge filter `kapitola_group=='PSV'` pulled PSV-72/73 **plus** PSV-71, 74, 75, 76, 77, 78 → accidentally re-processed already-reviewed items.

## Solution

**Parallel `_gate` field on each item**, populated via `KAPITOLA_TO_GATE` table:

```python
KAPITOLA_TO_GATE = {
    'PSV-71': 'PSV', 'PSV-72': 'TZB', 'PSV-73': 'TZB',
    'PSV-74': 'PSV', 'PSV-75': 'PSV', 'PSV-76': 'PSV',
    'PSV-77': 'PSV', 'PSV-78': 'PSV',
    'M-21': 'TZB', 'M-22': 'TZB', 'M-24': 'TZB',
    ...
}
```

- `kapitola_group` stays as **catalog classification** (HSV/PSV/M/VRN per Czech ÚRS 800)
- `_gate` is **user workflow concern** (HSV / PSV / TZB / VRN review batches)
- Merge / commit / Excel filter logic uses `_gate` exclusively
- Catalog reporting (URS matching, soupis assembly) uses `kapitola_group`

## Lesson

**Workflow concerns and classification concerns are orthogonal — don't conflate them into one field.** Adding a parallel field is cheaper than retrofitting filter logic to handle exception lists.

## Generalization

Apply to any pipeline kde user review batches ≠ catalog hierarchy:
- Statika: `_review_batch` (založení / sloupy / NK) vs `kapitola` (TKP 0, 7, 8)
- Pozemní stavby: `_subdodavatel_batch` (elektrikář bere PSV-72 sanit + M-21 silnoproud koupelen)
