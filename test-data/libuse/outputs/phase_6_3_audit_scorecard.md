# Phase 6.3 Audit Scorecard

**Generated:** Phase 6.3 step F (final summary)
**Items audited:** 2327
**Branch:** `claude/phase-0-5-batch-and-parser`

## Summary table

| Audit part | Findings | Severity | Recommendation |
|---|---:|---|---|
| A — Materials vs work split | 10 aggregated gaps | 🚨 HIGH | Fix v Phase 6.4 PŘED Phase 7a |
| B — OP edge cases (komplex ≤ 4) | 28 need review | ⚠️ MEDIUM | Manual sample 5-10 items |
| C — Door D## completeness | 0 gaps | ⚠️ MEDIUM | Verify per D-type |
| D — Window W## completeness | 10 gaps | ⚠️ MEDIUM | Verify per W-type |
| E — Příplatky eligibility | ~768 items | ℹ️ LOW | Defer Phase 7b |

## Detailed reports

- `audit_materials_vs_work.md`
- `audit_op_edge_cases.md`
- `audit_door_completeness.md`
- `audit_window_completeness.md`
- `priplatky_eligibility_plan.md`

## 🚨 HIGH severity — Material dodávka gaps (must fix)

Items with WORK-only popis (kladení / pokládka / montáž) lacking sibling 'dodávka materiálu' item. Customer feedback confirms these are needed.

Gap categories (top 5):

- **PSV-784** Malba disperzní — dodávka barvy: 2231.4 m2 across 49 rooms
- **PSV-762** Dřevěné latě 30×50 — dodávka materiálu: 921.1 m across 1 rooms
- **PSV-713** EPS 200 — dodávka: 786.6 m2 across 1 rooms
- **HSV-622.1** Cihelné pásky Terca — dodávka materiálu: 542.6 m2 across 1 rooms
- **PSV-776** Vinyl Gerflor Creation 30 — dodávka: 490.0 m2 across 28 rooms

## Estimated cost impact (HIGH gaps)

From audit_materials_vs_work.md analysis:
- Total estimated material gap: **~varies, see report A**
- Adding ~14-20 dodávka items per affected room
- Item count delta: **+ ~200-400 items** if each room gets material dodávka row

## Verdict

⚠️ **STOP — Phase 6.4 fix session needed BEFORE Phase 7a ÚRS lookup.**

Reasoning: ÚRS lookup batch je ~150-300 unique queries. If we run Phase 7a now and add 200-400 material items in Phase 6.4 afterwards, they'd need a SECOND ÚRS lookup pass. Better to add material items first, deduplicate query groups, and run ÚRS lookup once.

**Suggested Phase 6.4 (next session):**
1. Add ~200-400 material dodávka items per Part A findings
2. Address OP edge cases (Part B) — set qty=0 where DXF says zero
3. Fix door/window completeness gaps (Part C, D) where applicable
4. Re-run Phase 5 audit (status flags) on updated dataset
5. Then proceed Phase 7a ÚRS lookup
