# GATE 8 11c_AVK_smeta vs user-manual file — comparison report

**Generated:** 2026-05-21
**Compared:**
- `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` (GATE 8.2,
  this branch) — 6 791 data rows
- `VV_MAT_AVK_STYLE.xlsx` (user's manually corrected version) —
  7 661 data rows

**Net delta:** user has **+870 rows more** than our auto-generated
version (mix of additions + restructuring).

---

## Summary

The user manually walked the 11c sheet and made two kinds of edits:

1. **Added missing LOKACE rows** for masters whose pairing was skipped
   by pair_materials.SKIP_STATUSES (deprecated / interpretace_pending
   masters that still represent rooms where the work physically
   happens).
2. **Adjusted consumption rates** on individual MATERIÁL rows
   (corrections to the KB defaults during walk-through).

The auto-generator currently only emits LOKACE for masters whose
own sub-items contributed to the MATERIÁL bucket.  Skipped masters
disappear silently.

---

## High-impact discrepancies (top 25 G-groups by row delta)

| G-kód | rows U/O | MATERIÁL U/O | LOKACE U/O | Master popis (work) |
|---|---:|---:|---:|---|
| G016 | 151 / 51   | 3 / 1 | 147 / 49  | Malba disperzní 2. nátěr |
| G014 | 151 / 52   | 3 / 2 | 147 / 49  | Penetrace stěn pod malbu disperzní |
| G031 | 121 / 41   | 3 / 1 | 117 / 39  | Malba vápenná 2. nátěr |
| G029 | 121 / 41   | 3 / 1 | 117 / 39  | Penetrace stěn pod malbu vápenná |
| G015 | 151 / 101  | 3 / 2 | 147 / 98  | Malba disperzní 1. nátěr |
| G013 | 151 / 101  | 3 / 2 | 147 / 98  | Malba disperzní (dodávka) |
| **G007** | **85 / 40** | **1 / 3** | **83 / 36** | **Cementový potěr F5 tl. 50 mm** |
| G030 | 121 / 81   | 3 / 2 | 117 / 78  | Malba vápenná 1. nátěr |
| G028 | 121 / 81   | 3 / 2 | 117 / 78  | Omítka sádrová vnitřních ploch |
| G055 |  58 / 20   | 3 / 1 |  54 / 18  | Malba podhledu 2. nátěr |
| G082 |  52 / 18   | 3 / 1 |  48 / 16  | Malba podhledu 2. nátěr (CF21) |
| G040 | 137 / 103  | 4 / 3 | 132 / 99  | Špalety sádrová okolo otvorů |
| G044 | 100 / 67   | 3 / 2 |  96 / 64  | Špalety sádrová (širší) |
| G060 |  67 / 45   | 3 / 2 |  63 / 42  | (chain master) |
| G065 |  58 / 39   | 3 / 2 |  54 / 36  | (chain master) |
| G054 |  58 / 39   | 3 / 2 |  54 / 36  | Malba podhledu 1. nátěr (CF20) |
| G081 |  52 / 35   | 3 / 2 |  48 / 32  | (chain master) |
| G074 |  52 / 35   | 3 / 2 |  48 / 32  | (chain master) |
| G073 |  52 / 35   | 3 / 2 |  48 / 32  | (chain master) |
| G071 |  52 / 35   | 3 / 2 |  48 / 32  | (chain master) |
| G093 |  45 / 34   | 4 / 3 |  40 / 30  | (chain master) |
| G102 |  28 / 19   | 3 / 2 |  24 / 16  | (chain master) |
| G109 |  22 / 15   | 3 / 2 |  18 / 12  | (chain master) |
| G108 |  22 / 15   | 3 / 2 |  18 / 12  | (chain master) |
| G106 |  22 / 15   | 3 / 2 |  18 / 12  | (chain master) |

**Total discrepancy groups:** 50 G-groups have ≠ row count.

---

## Pattern analysis — two distinct root causes

### Pattern A — Vrstva-chain undercoverage

**Affected:** G013/14/15/16, G028/29/30/31, G053/54/55, G080/81/82,
G013-93 painting chains.

Each chain has 3-4 master G-groups (Penetrace + 1.nátěr + 2.nátěr
+ optional Tmel) sharing the same physical surface = same N rooms.
User's manual file has equal LOKACE per group (147 in malba
disperzní chain; 117 in malba vápenná chain; etc.) because every
room receives every coat.

Our generator emits LOKACE only when a master's own sub-items were
paired into the bucket.  After GATE 8.2 cascade narrowed
WORK_FOCUS_RULES to:
  - 1. nátěr → {malba, vymalba, tmel}
  - 2. nátěr → {malba, vymalba}

→ 2.nátěr loses tmel rows (correct per spec — tmel applied once on
   1.nátěr) but ALSO loses penetrace+tmel rows for the master
   instances that previously got those as sub-items.

**Effect:** ~50 % LOKACE coverage on 2.nátěr buckets (49 of 147
   rooms), ~67 % on 1.nátěr (98 of 147 rooms).

**Why:** masters whose status = deprecated /
   interpretace_pending_ABMV are SKIP_STATUSES → no sub-items
   emitted → no LOKACE rendered → user manually filled them.

### Pattern B — Cementový potěr (G007) per-room coverage

**Affected:** G007 only.

User has 83 LOKACE rooms; we have 36 (delta 47).

**Why:** of 111 cementový potěr master instances in items file:
  - 36 have status that passed SKIP_STATUSES → got KB rate
    (110 kg/m² × area)
  - 47 are status=deprecated → skipped → user added manually
  - 28 are status=interpretace_pending_ABMV → skipped
  - or qty=0 → skipped_zero_qty

Same root cause as Pattern A: SKIP_STATUSES filter blocks LOKACE
emission for masters whose statuses are explicitly pending review.

---

## What I tried (GATE 8.3 attempt, reverted)

Iterate ALL `master_ids` in g.items_ids regardless of whether the
master contributed a sub-item to the bucket; compute LOKACE.qty =
`master.area × parent_MATERIÁL.rate`.

**Result:** fixed Pattern A vrstva chains (G014 49→147 ✓) but
**broke Pattern C — dodávka pair buckets**:
  - G001 Malba dodávka: 5 MATERIÁL buckets × 131 masters = 655
    LOKACE (was 123 in user's file).  Over by 5×.
  - G002 similar: 555 vs 64.  Over by 8×.

**Reason for break:** G001/G002 split into multiple MATERIÁL
buckets via "(paired with X)" annotation in master.popis.  Each
bucket maps to a SUBSET of master_ids.  Iterating all 131 per
bucket multiplies the count.

GATE 8.3 reverted.  Need bucket-aware logic that distinguishes:
  - vrstva chains: iterate all masters
  - dodávka pairs: iterate only contributors

---

## Recommended next step (for follow-up gate 8.4)

In `_build_avk_smeta` LOKACE emission, decide per-bucket:

```python
n_contributors = len(b["per_master"])
n_group_masters = len(master_ids)
# Heuristic: if the bucket covers > 80 % of group masters OR is a
# self-material consolidation, iterate all masters (Pattern A).
# Otherwise restrict to contributors (Pattern C dodávka pairs).
iterate_all = (
    popis_clean == "__self_material__"
    or n_contributors >= 0.8 * n_group_masters
)
```

Alternative: tag dodávka-pair buckets explicitly via a marker on
the sub-item popis ("(paired with …)" → split-bucket) and route
LOKACE emission accordingly.

---

## What's authoritative

**User's `VV_MAT_AVK_STYLE.xlsx` is the ground truth for the Libuše
VELTON dispatch.**  The auto-generated file is a tool that walks
toward that ground truth but isn't there yet on row coverage.

For dispatch: ship user's file.  For future projects (Žihle,
hk212, RD Jáchymov): GATE 8.4 follow-up should land bucket-aware
LOKACE logic so the generator emits the right coverage natively.
