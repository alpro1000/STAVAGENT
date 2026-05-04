"""Phase 6.1 step 1b — DXF spatial counts per OP/LI/LP/D/W code per objekt D.

Re-parses all 12 valid DXFs, classifies each segment-tag occurrence by
the drawing's objekt:
  - Půdorys+Podhled 1.NP/2.NP/3.NP/střecha D → 'objekt_D' bucket
  - Půdorys 1.PP společný + ŘEZY 1-PP + ARS desky + jadra 2NP →
    'spol_1pp' bucket (D-share = 0.25 floor-area assumption)

Output: test-data/libuse/outputs/dxf_segment_counts_per_objekt_d.json
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path("concrete-agent/packages/core-backend").resolve()))

from app.services.dxf_parser import parse_batch  # noqa: E402

DXF_DIR = Path("test-data/libuse/inputs/dxf")
OUT = Path("test-data/libuse/outputs/dxf_segment_counts_per_objekt_d.json")

# Drawing classification: which DXF belongs to objekt D vs společný 1.PP
OBJEKT_D_DRAWINGS = {
    "185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP",
    "185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP",
    "185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP",
    "185-01_DPS_D_SO01_140_4440_00-OBJEKT D - Půdorys střecha",
    "185-01_DPS_D_SO01_140_5400_R01 - OBJEKT D - ŘEZY",
    "185-01_DPS_D_SO01_140_6400_R01 - OBJEKT D - POHLEDY",
    "185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. NP",
    "185-01_DPS_D_SO01_140_7420_00-OBJEKT D - Výkres podhledů 2. NP",
    "185-01_DPS_D_SO01_140_7430_00-OBJEKT D - Výkres podhledů 3. NP",
}
SPOL_1PP_DRAWINGS = {
    "185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP",
    "185-01_DPS_D_SO01_100_5000_R01 - ŘEZY 1-PP",
}
# D-share factor for společný 1.PP — floor-area-based (assume D ≈ 0.25)
PP_D_SHARE = 0.25

# Patterns
TARGET_PREFIXES = ("OP", "LI", "LP", "TP", "W", "D", "RF", "WF", "CF", "FF")


def main() -> None:
    paths = sorted(DXF_DIR.glob("*.dxf"))
    print(f"Parsing {len(paths)} DXFs…")
    parsed = parse_batch(paths)

    # Bucket counts: prefix → drawing_class → Counter[full_code → count]
    counts_d: dict[str, Counter] = defaultdict(Counter)   # objekt_D drawings
    counts_pp: dict[str, Counter] = defaultdict(Counter)  # spol 1.PP drawings
    counts_other: dict[str, Counter] = defaultdict(Counter)
    drawing_origins: dict[str, str] = {}

    for stem, p in parsed.items():
        if p.skipped:
            continue
        if stem in OBJEKT_D_DRAWINGS:
            target = counts_d
            drawing_origins[stem] = "objekt_D"
        elif stem in SPOL_1PP_DRAWINGS:
            target = counts_pp
            drawing_origins[stem] = "spol_1.PP"
        else:
            target = counts_other
            drawing_origins[stem] = "other"

        for st in p.segment_tags:
            target[st.prefix][st.code] += 1
        # Doors / windows from openings (these aren't in segment_tags)
        for o in p.openings:
            if o.type_code:
                if o.otvor_type == "door":
                    target["D"][o.type_code] += 1
                elif o.otvor_type == "window":
                    target["W"][o.type_code] += 1

    # Build per-prefix consolidated counts (D-only)
    consolidated: dict[str, dict[str, dict]] = {}
    for prefix in ("OP", "LI", "LP", "TP", "RF", "WF", "CF", "FF", "D", "W"):
        codes = set()
        codes.update(counts_d.get(prefix, {}))
        codes.update(counts_pp.get(prefix, {}))
        codes.update(counts_other.get(prefix, {}))
        if not codes:
            continue
        per_code = {}
        for code in sorted(codes):
            d_count = counts_d[prefix].get(code, 0)
            pp_count = counts_pp[prefix].get(code, 0)
            other_count = counts_other[prefix].get(code, 0)
            d_share_from_pp = pp_count * PP_D_SHARE
            d_total = d_count + d_share_from_pp
            per_code[code] = {
                "objekt_d_drawings": d_count,
                "spol_1pp_drawings": pp_count,
                "other_drawings": other_count,
                "d_share_from_pp": round(d_share_from_pp, 2),
                "total_d_count": round(d_total, 2),
                "total_d_count_int": int(round(d_total)),
            }
        consolidated[prefix] = per_code

    out = {
        "metadata": {
            "drawings_classified": drawing_origins,
            "pp_d_share": PP_D_SHARE,
            "method": (
                "Re-parses every DXF, classifies tag occurrences by drawing's "
                "objekt scope. objekt-D drawings count fully; spol 1.PP × "
                f"{PP_D_SHARE} D-share."
            ),
        },
        "counts_per_objekt_d": consolidated,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print()
    for prefix in ("OP", "LI", "LP", "TP", "D", "W"):
        if prefix not in consolidated:
            continue
        codes = consolidated[prefix]
        total_d = sum(c["total_d_count"] for c in codes.values())
        total_d_int = sum(c["total_d_count_int"] for c in codes.values())
        print(f"{prefix}##: {len(codes)} unique codes, "
              f"Σ D = {total_d:.1f} (int {total_d_int})")


if __name__ == "__main__":
    main()
