# TODO — Pattern 20 schema fix: globally-unique item.id

**Status:** queued for follow-up workstream (NOT blocking current delivery)
**Tracked by:** Pattern 20 (Audit v2) discipline + Pattern 28 (Schema integrity globally-unique entity IDs)
**Origin:** RD Jáchymov pilot 2026-05-26 — VRN.001 collision bug

## Problem

Item id reuse across sub-kapitolas in `items.json`:

```
260219_dum.VRN.001   appears 9× under different VRN sub-kapitolas
260217_sklad.VRN.001 appears under VRN sub-kapitolas
HSVN.001 / PSVN.001  same collision pattern likely under other namespaces
```

Tooling that resolves an item by id alone (e.g. `{it["id"]: it for it in items}`)
silently deduplicates collisions. First-match patch tools overwrite the wrong
entry. Caught during Phase 3.5 application of per-drawing audit fixes:
the VRN.001 enrichment patch overwrote VRN — Zařízení staveniště (Buňky kancelář)
instead of the intended VRN — Průzkumy (Mykologický průzkum) entry.

## Resolution discipline (current workaround)

All patch tools now resolve identity via compound key `(id, kapitola)` and
iterate the items list directly rather than dict-by-id. Worked through Phase 3.5
+ Action 1 + Action 2 finalize without regression. Compound-key workaround
preserves the schema as-is and is sufficient for delivery.

## Real fix (queued)

Enforce globally-unique `item.id` at the schema validation step. Two options:

### Option A — namespace prefix per sub-kapitola

```
260219_dum.VRN.ZS.001       (Zařízení staveniště)
260219_dum.VRN.PRZ.001      (Průzkumy)
260219_dum.VRN.GEO.001      (Geodet)
260219_dum.VRN.BZP.001      (BOZP)
260219_dum.VRN.POJ.001      (Pojištění + zábory)
260219_dum.VRN.DOK.001      (Dokumentace)
260219_dum.VRN.REV.001      (Revize)
260219_dum.VRN.KOL.001      (Kolaudace)
260219_dum.VRN.SPO.001      (Společné)
260219_dum.VRN.DOP.001      (Doprava + odpad)
```

Sub-kapitola gets a 3-letter abbreviation that becomes part of the id.
Schema validator enforces uniqueness across the full items list.

### Option B — flat sequential renumber

```
260219_dum.VRN.001 → 260219_dum.VRN.001
260219_dum.VRN.001 → 260219_dum.VRN.002
260219_dum.VRN.001 → 260219_dum.VRN.003
... (existing IDs renumbered sequentially per objekt)
```

Risk: every existing reference (`_vyjasneni_ref`, `realizuje_skladbu`
parents, `_audit_gap_fixed` tags pointing to other items) needs hand-walk
update. Higher migration cost, lower clarity downstream.

**Recommended:** Option A (namespace prefix) — semantically meaningful,
easier hand-walking of references, retains kapitola context in the id itself.

## Migration plan (when scheduled)

1. **Audit existing collisions** — enumerate all duplicated ids across
   items.json. Expected ~9 VRN.001 + an unknown number of others.
2. **Define abbreviation table** — per sub-kapitola: 3-letter code.
   Document in `docs/schema/sub_kapitola_abbreviations.md`.
3. **Schema validator** — `tools/schema_validate_unique_ids.py` runs
   before any patch tool. Fails build if duplicates detected.
4. **Migration script** — `tools/migrate_globally_unique_ids.py`:
   - Apply new ids in-place
   - Build `id_old → id_new` map
   - Walk all cross-reference fields (`_vyjasneni_ref`, `realizuje_skladbu`
     containing item-id references, `_audit_gap_fixed`) and update
5. **Update all patch tools** — remove the `(id, kapitola)` compound-key
   workaround, simplify back to `{it["id"]: it for it in items}` dict lookup.
6. **CI integration** — add schema validator to pre-commit hook for
   `outputs/items*.json` changes.

## Effort estimate

- Audit + abbreviation table: 1-2 h
- Schema validator: 1 h
- Migration script (idempotent + cross-ref walking): 3-4 h
- Patch tool cleanup (~8 tools currently use compound key workaround): 2 h
- CI hook + testing: 1 h
- **Total: ~8-10 h**

## Acceptance

- `items.json` validates against schema with 0 duplicate ids
- Patch tools simplified to dict-by-id lookup
- All cross-references resolve to new ids
- Pre-commit hook prevents regression

## Why not now

Schema refactor is a discrete workstream best done in isolation from pilot
delivery. The compound-key workaround is functional + the audit logs preserve
the bug-discovery context for future-me. Migration risk is non-trivial
(every cross-reference field walked) and warrants its own focused session
with its own test plan.

**This applies to future pilots automatically once landed — N+1 pilots will
inherit globally-unique ids by default.**

## Cross-references

- Master Pattern 20 — Audit v2 10-section completeness methodology
- Master Pattern 28 — Schema integrity globally-unique entity IDs
- RD Jáchymov pilot `_phase3_5_*_log` + `_per_drawing_audit_fixes_log`
  blocks document the bug discovery + workaround application
