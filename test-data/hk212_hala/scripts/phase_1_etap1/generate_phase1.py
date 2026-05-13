"""Phase 1 Etapa 1 master driver — orchestrate all kapitola generators.

Builds items per spec §4 across HSV / PSV / M / VRN / VZT, runs URS lookup
against URS201801.csv (offline-only per Q1), validates schema, writes outputs:

- ``outputs/phase_1_etap1/items_hk212_etap1.json`` — full structured items
- ``outputs/phase_1_etap1/count_summary.md`` — per-kapitola breakdown (final commit)
- ``outputs/phase_1_etap1/urs_match_report.md`` — match rates (final commit)
- ``outputs/phase_1_etap1/needs_review_top_items.md`` — top-N review queue (final commit)

Driver runs incrementally as each commit lands more kapitola modules — modules
not yet present are gracefully skipped.

Run from repo root::

    python3 test-data/hk212_hala/scripts/phase_1_etap1/generate_phase1.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from phase_1_etap1.item_schema import Item  # noqa: E402
from phase_1_etap1.kapitola_helpers import apply_urs_lookup, validate_all  # noqa: E402
from phase_1_etap1.urs_lookup import load_urs_catalog, UrsIndex  # noqa: E402
from phase_1_etap1.vyjasneni_loader import VyjasneniQueue  # noqa: E402

# Conditional kapitola imports — modules not yet present are skipped
KAPITOLA_MODULES = [
    "kap_hsv1", "kap_hsv2", "kap_hsv3", "kap_hsv9",
    "kap_psv71x", "kap_psv76x", "kap_psv77x", "kap_psv78x",
    "kap_m", "kap_vrn", "kap_vzt",
]


def collect_all_items() -> tuple[list[Item], list[str]]:
    """Load every available kapitola module, call build_items(), aggregate."""
    all_items: list[Item] = []
    loaded: list[str] = []
    for mod_name in KAPITOLA_MODULES:
        try:
            mod = __import__(f"phase_1_etap1.{mod_name}", fromlist=["build_items"])
        except ModuleNotFoundError:
            continue
        if not hasattr(mod, "build_items"):
            continue
        items = mod.build_items()
        all_items.extend(items)
        loaded.append(f"{mod_name} ({len(items)} items)")
    return all_items, loaded


def cross_validate_vyjasneni_refs(items: list[Item], queue: VyjasneniQueue) -> dict:
    """Verify every item's _vyjasneni_ref values reference known ABMV IDs."""
    unknown_refs_by_item: dict[str, list[str]] = {}
    ref_distribution: dict[str, int] = {}
    for it in items:
        if not it._vyjasneni_ref:
            continue
        norm, unknown = queue.validate_refs(it._vyjasneni_ref)
        # Update in place so the dump uses canonical IDs
        it._vyjasneni_ref = norm
        for r in norm:
            ref_distribution[r] = ref_distribution.get(r, 0) + 1
        if unknown:
            unknown_refs_by_item[it.id] = unknown
    return {
        "unknown_refs_by_item": unknown_refs_by_item,
        "ref_distribution": ref_distribution,
    }


def main() -> int:
    print("=== Phase 1 Etapa 1 generator ===")

    # 1. Load URS catalog
    print("\n[1/5] Loading URS201801.csv …")
    entries = load_urs_catalog()
    idx = UrsIndex(entries)
    print(f"  ✓ {len(entries)} entries loaded")

    # 2. Load VYJASNĚNÍ queue
    print("\n[2/5] Loading VYJASNĚNÍ queue …")
    queue = VyjasneniQueue.load()
    print(f"  ✓ {len(queue.items_by_id)} ABMV items loaded")

    # 3. Build all items from kapitola modules
    print("\n[3/5] Building items from kapitola modules …")
    items, loaded = collect_all_items()
    for line in loaded:
        print(f"  ✓ {line}")
    print(f"  → total items: {len(items)}")

    # 4. URS lookup
    print("\n[4/5] Running URS lookup …")
    apply_urs_lookup(items, idx)

    # Status breakdown
    status_counts: dict[str, int] = {}
    for it in items:
        status_counts[it.urs_status] = status_counts.get(it.urs_status, 0) + 1
    print(f"  status breakdown:")
    for st, n in sorted(status_counts.items(), key=lambda x: -x[1]):
        print(f"    {st:18s} {n}")

    matched = status_counts.get("matched_high", 0) + status_counts.get("matched_medium", 0)
    match_rate = matched / max(len(items), 1) if items else 0
    print(f"  match rate (high+medium): {match_rate:.1%}")

    # 5. Cross-validate vyjasneni refs + schema
    print("\n[5/5] Validation …")
    cross = cross_validate_vyjasneni_refs(items, queue)
    if cross["unknown_refs_by_item"]:
        print(f"  ⚠ unknown vyjasneni refs in {len(cross['unknown_refs_by_item'])} items:")
        for iid, refs in list(cross["unknown_refs_by_item"].items())[:5]:
            print(f"    {iid}: {refs}")
    else:
        print(f"  ✓ all _vyjasneni_ref values resolve to known ABMV IDs")

    ok_count, failures = validate_all(items)
    if failures:
        print(f"  ✗ {len(failures)} items fail schema validation:")
        for iid, errs in failures[:5]:
            print(f"    {iid}: {errs}")
    else:
        print(f"  ✓ all {ok_count} items pass schema validation")

    # 6. Dump items_hk212_etap1.json
    out_dir = REPO_ROOT / "test-data" / "hk212_hala" / "outputs" / "phase_1_etap1"
    out_dir.mkdir(parents=True, exist_ok=True)
    items_path = out_dir / "items_hk212_etap1.json"
    payload = {
        "metadata": {
            "project": "hk212_hala",
            "phase": "1_etap1",
            "scope": "HSV + PSV + M + VRN + VZT (etap 1 IN-scope per §3)",
            "catalog": "URS201801.csv (39742 stemmed rows)",
            "export_wrapper_default": "KROS Komplet",
            "kapitola_modules_loaded": loaded,
            "total_items": len(items),
            "status_counts": status_counts,
            "match_rate_high_plus_medium": round(match_rate, 3),
            "vyjasneni_ref_distribution": cross["ref_distribution"],
        },
        "items": [it.to_dict() for it in items],
    }
    items_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"\n  → {items_path.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
