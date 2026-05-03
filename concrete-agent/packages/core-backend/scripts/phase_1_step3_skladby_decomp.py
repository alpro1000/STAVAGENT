"""Phase 1 step 3 — skladby decomposition for objekt D.

For each unique skladba code referenced by D rooms (Tabulka místností
columns: skladba_podlahy / povrch_podlahy / povrch_sten / typ_podhledu /
povrch_podhledu) PLUS each WF / CF / RF tag found by DXF segment-tag
spatial join, look up the layer specification from Tabulka skladeb
and embed the full vrstva list.

Adds `skladby` section to objekt_D_geometric_dataset.json.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

DS = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")
TAB = Path("test-data/libuse/outputs/tabulky_loaded.json")


def split_combined(value: str) -> list[str]:
    """'F05, F20', 'FF01/FF03' → ['F05', 'F20'], ['FF01', 'FF03']."""
    if not value:
        return []
    parts = re.split(r"[,/;\s]+", value.strip())
    return [p for p in parts if re.match(r"^[A-Z]{1,3}\d{1,3}$", p)]


def main() -> None:
    if not DS.exists():
        raise SystemExit("Run Phase 1 step 2 first")
    if not TAB.exists():
        raise SystemExit("Run Phase 1 step 1 first")

    dataset = json.loads(DS.read_text(encoding="utf-8"))
    tabulky = json.loads(TAB.read_text(encoding="utf-8"))
    skladby_master = tabulky["skladby"]["skladby"]

    referenced: dict[str, set[str]] = {
        # code → set of contexts where it appears
    }
    for room in dataset["rooms"]:
        for field in ("FF", "F_povrch_podlahy", "F_povrch_sten", "CF", "F_povrch_podhledu"):
            v = room.get(field, "")
            for code in split_combined(v):
                referenced.setdefault(code, set()).add(f"room.{field}")
        for tag in room.get("wall_segment_tags", []):
            referenced.setdefault(tag, set()).add("dxf.wall_tag")
        for tag in room.get("ceiling_segment_tags", []):
            referenced.setdefault(tag, set()).add("dxf.ceiling_tag")

    # Build full skladba records per referenced code
    skladby_used: dict[str, dict] = {}
    missing: list[str] = []
    for code in sorted(referenced):
        contexts = sorted(referenced[code])
        master = skladby_master.get(code)
        if master is None:
            missing.append(code)
            skladby_used[code] = {
                "code": code,
                "in_tabulka_skladeb": False,
                "referenced_in": contexts,
                "vrstvy": [],
                "celkova_tloustka_mm": None,
                "warning": "Code referenced by Tabulka místností or DXF tags but not found in Tabulka skladeb",
            }
            continue
        skladby_used[code] = {
            "code": code,
            "in_tabulka_skladeb": True,
            "referenced_in": contexts,
            "kind": master.get("kind"),
            "label": master.get("label"),
            "celkova_tloustka_mm": master.get("celkova_tloustka_mm"),
            "vrstvy": master.get("vrstvy", []),
        }

    # Embed into dataset
    dataset["skladby"] = skladby_used
    dataset["skladby_count"] = len(skladby_used)
    dataset["skladby_missing_in_master"] = missing
    dataset["phase_1_step"] = 3

    DS.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {DS} ({DS.stat().st_size:,} bytes)")
    print()
    print(f"  Unique skladba codes referenced: {len(skladby_used)}")
    print(f"  In Tabulka skladeb (full vrstva spec): {sum(1 for s in skladby_used.values() if s['in_tabulka_skladeb'])}")
    print(f"  Missing in Tabulka skladeb: {len(missing)}")
    if missing:
        print(f"    Missing codes: {', '.join(missing)}")


if __name__ == "__main__":
    main()
