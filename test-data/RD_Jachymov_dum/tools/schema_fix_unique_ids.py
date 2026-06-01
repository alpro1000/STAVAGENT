#!/usr/bin/env python3
"""
Schema fix (2026-06-01) — Commit 2 of 2. Pattern 28: globally-unique entity IDs.

Bug: id = objekt.KAPITOLA.seq, but seq restarts per subkapitola → collisions within
the same kapitola-prefix (PSV71.001/002 ×2, PSV76.001-004 ×4, VRN.001/002/003 ×many).

Fix (block scheme, deterministic): for each (objekt, id-prefix) WITH collisions among
numeric-suffix items, order distinct `kapitola` strings by first appearance:
  rank 0 → keep original numeric suffix
  rank k≥1 → new suffix = k*100 + local_index (1-based within that kapitola, index order)
Non-numeric suffixes (PM01, PM02) untouched (already unique). Prefixes without
collisions untouched. atomic_decomposition.py keys auto-updated from the remap.
"""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "outputs" / "items_rd_jachymov_complete.json"
ATOMIC_SRC = ROOT / "tools" / "atomic_decomposition.py"


def prefix_of(idv: str) -> tuple[str, str]:
    p, _, suf = idv.rpartition(".")
    return p, suf


def main() -> None:
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"]

    # index items by prefix, preserving array order
    by_prefix: dict[str, list[int]] = {}
    for idx, it in enumerate(items):
        p, _ = prefix_of(it["id"])
        by_prefix.setdefault(p, []).append(idx)

    remap: list[tuple[str, str, str]] = []  # (old_id, kapitola, new_id)
    for prefix, idxs in by_prefix.items():
        # collision among numeric-suffix items?
        seen: dict[str, int] = {}
        for i in idxs:
            seen[items[i]["id"]] = seen.get(items[i]["id"], 0) + 1
        if not any(c > 1 for c in seen.values()):
            continue  # no collision → skip prefix entirely
        # distinct kapitoly by first appearance
        kap_order: list[str] = []
        for i in idxs:
            k = items[i].get("kapitola", "")
            if k not in kap_order:
                kap_order.append(k)
        # assign per kapitola
        for rank, kap in enumerate(kap_order):
            local = 0
            for i in idxs:
                it = items[i]
                if it.get("kapitola", "") != kap:
                    continue
                p, suf = prefix_of(it["id"])
                if not suf.isdigit():
                    continue  # leave PM01/PM02 etc.
                local += 1
                if rank == 0:
                    continue  # keep original numeric suffix
                new_id = f"{p}.{rank*100 + local:03d}"
                old_id = it["id"]
                remap.append((old_id, it.get("kapitola", ""), new_id))
                it["id"] = new_id

    # verify uniqueness
    all_ids = [it["id"] for it in items]
    dups = {x for x in all_ids if all_ids.count(x) > 1}
    assert not dups, f"STILL DUPLICATE after fix: {dups}"

    # update atomic_decomposition.py keys for any remapped id present as a key
    src = ATOMIC_SRC.read_text(encoding="utf-8")
    atomic_updates = 0
    for old_id, kap, new_id in remap:
        needle = f'("{old_id}", "{kap}")'
        if needle in src:
            src = src.replace(needle, f'("{new_id}", "{kap}")')
            atomic_updates += 1
    ATOMIC_SRC.write_text(src, encoding="utf-8")
    import py_compile
    py_compile.compile(str(ATOMIC_SRC), doraise=True)

    # warn if any item field still references an old id (cross-refs)
    blob = json.dumps(data, ensure_ascii=False)
    stale = [old for old, _, _ in remap if f'"{old}"' in blob and old not in all_ids]
    # (old ids that vanished from id field but linger elsewhere)
    lingering = []
    for old_id, _, _ in remap:
        # count occurrences as a standalone quoted string anywhere
        if blob.count(f'"{old_id}"') > 0:
            lingering.append(old_id)

    data["_schema_fix_log"] = {
        "applied_at": "2026-06-01", "pattern": 28, "renumbered": len(remap),
        "atomic_keys_updated": atomic_updates,
        "remap_sample": [f"{o} → {n}" for o, _, n in remap[:8]],
        "items_total": len(items),
    }
    ITEMS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"OK — renumbered {len(remap)} ids, atomic keys updated {atomic_updates}, 0 duplicates.")
    if lingering:
        print("  ⚠️ lingering old-id references (verify):", lingering)
    else:
        print("  ✓ no lingering old-id references in any field.")
    for o, k, n in remap:
        print(f"    {o}  [{k}]  →  {n}")


if __name__ == "__main__":
    main()
