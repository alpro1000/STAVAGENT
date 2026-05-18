#!/usr/bin/env python3
"""
Path C — Tier 4 + Tier 5: HIGH INSERTS + LOW VALUE metadata pass.

Tier 4 — HIGH INSERTS (5 medium_priority_inserts layers + extended block discovery):
  - Klempířina symbols (atika joint, okap, svod, parapet)
  - Schodiště step markers
  - Vikýře markers
  - Bourání crosses (X marks)
  - Site equipment markers (parking, terasa)
  Update existing dxf_comprehensive_extract.json categories.

Tier 5 — LOW VALUE / METADATA quick scan:
  - Rozpiska layers (title block)
  - Popisy bubliny (description bubbles)
  - Stafáž, razítka, severka
  - Defpoints, empty layers
  Mark probe_status: probed_metadata_only — confirm, close inventory.

Output:
  outputs/dxf_inserts_tier4_extended.json
  outputs/dxf_metadata_tier5_confirmed.json
"""

from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import ezdxf

PROJ = Path(__file__).resolve().parent.parent
INPUTS = PROJ / "inputs"
OUT = PROJ / "outputs"

SOURCES = {
    "dum_DPZ":       INPUTS / "vykresy_dxf" / "260219_dum"   / "RD Jachymov dum _ DPZ _ 10.dxf",
    "dum_situace":   INPUTS / "vykresy_dxf" / "260219_dum"   / "RD Jachymov dum _ situace 02.dxf",
    "sklad_DPZ":     INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ DPZ _ 02.dxf",
    "sklad_situace": INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ situace 04.dxf",
}

# Pattern dictionaries — extend from prior Phase 0b §3.3 + comprehensive extract
INSERT_PATTERNS = {
    "okno":          [r"^okno", r"^window"],
    "dvere":         [r"^dveř", r"^dver", r"^door"],
    "kr_krokev":     [r"^KR$"],
    "vykova_kota":   [r"^KR$"],  # also used for height markers via attribute
    "sanit_WC":      [r"^WC[_ ]", r"^WC$"],
    "sanit_umyvadlo": [r"^Umyvadlo", r"^umyvadlo"],
    "sanit_vana":    [r"^Vana"],
    "sanit_sprcha":  [r"^Sprch"],
    "kuchyne_drez":  [r"^drez"],
    "kuchyne_indukce": [r"^indukce", r"^Elektrický sporák"],
    "kuchyne_trouba": [r"^trouba"],
    "kuchyne_lednice": [r"^lednice"],
    "kuchyne_mycka": [r"^mycka"],
    "nabytek_postel": [r"^postel"],
    "nabytek_zidle": [r"^židle"],
    "nabytek_pohovka": [r"^L pohovka", r"^pohovka"],
    "nabytek_tv":    [r"^tv_"],
    # Klempířina symbols
    "klempir_atika": [r"atik"],
    "klempir_okap":  [r"^okap", r"_okap"],
    "klempir_svod":  [r"^svod", r"_svod"],
    "klempir_parapet": [r"parap"],
    # Schodiště
    "schody_marker": [r"^schod", r"_schod"],
    # Vikýře
    "vikyr_marker":  [r"vikýř", r"^vikyr"],
    # Bourání X markers
    "bourani_X":     [r"^X[_ ]", r"^bouran", r"_demol"],
    # Plot patterns (terasa, dvorek)
    "plot_dreveny":  [r"^PLOT_DREVENY"],
    "plot_kameny":   [r"^PLOT_KAMEN"],
    # Wall blocks
    "wall_block":    [r"^WALL_"],
    # Stamping / metadata
    "razitko":       [r"razítko", r"^razitko"],
    "severka":       [r"^severka", r"north"],
    "rezova_znacka": [r"^řezová značka", r"^rezova"],
    # Generic blocks (lower priority)
    "rezni_pole":    [r"^rezní", r"^řezní"],
    "stredova_osa": [r"^osa", r"_osa"],
}

METADATA_LAYER_PATTERNS = re.compile(
    r"netisk|defpoints|rozpiska|popisy?[\s_]?bubliny|severka|"
    r"hlavn[íi]\s*projektak|projektov[ýy]\s*stupe[ňn]|^datum$|"
    r"^investor$|razítk|^_[\s_]|geometrie$|stafáž|^stafaz",
    re.IGNORECASE,
)


def classify_insert(name: str) -> str | None:
    for label, patterns in INSERT_PATTERNS.items():
        for p in patterns:
            if re.search(p, name, re.IGNORECASE):
                return label
    return None


def main():
    OUT.mkdir(exist_ok=True)
    # ─────────────────────────────────────────────────────────────────
    # TIER 4 — INSERT block extended discovery
    print("[Tier 4] Extended INSERT block extraction across 4 DXFs...", file=sys.stderr)

    all_inserts = []  # global registry
    per_file_summary = {}
    unmapped_blocks = Counter()  # block names that don't match any pattern

    for file_key, path in SOURCES.items():
        if not path.exists():
            continue
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()
        file_inserts = []
        for e in msp:
            if e.dxftype() != "INSERT":
                continue
            try:
                name = e.dxf.name
                category = classify_insert(name)
                pos = e.dxf.insert
                rec = {
                    "file": file_key,
                    "layer": e.dxf.layer,
                    "block_name": name,
                    "category": category or "unmapped",
                    "x": round(pos[0], 0),
                    "y": round(pos[1], 0),
                }
                # Capture attributes if any
                try:
                    attrs = {att.dxf.tag: att.dxf.text for att in e.attribs}
                    if attrs:
                        rec["attrs"] = attrs
                except Exception:
                    pass
                file_inserts.append(rec)
                all_inserts.append(rec)
                if category is None:
                    unmapped_blocks[name] += 1
            except Exception:
                pass
        per_file_summary[file_key] = {
            "n_inserts": len(file_inserts),
            "n_unique_blocks": len({i["block_name"] for i in file_inserts}),
        }

    # Category aggregation
    by_category = defaultdict(list)
    for ins in all_inserts:
        by_category[ins["category"]].append(ins)
    category_counts = {cat: len(items) for cat, items in by_category.items()}

    print(f"  ✓ {len(all_inserts)} INSERT entities total", file=sys.stderr)
    print(f"  ✓ Mapped categories: {sum(1 for c in category_counts if c != 'unmapped')}", file=sys.stderr)
    print(f"  ✓ Top mapped categories:", file=sys.stderr)
    for cat, n in sorted(category_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"    {cat:30}: {n}", file=sys.stderr)
    print(f"  ✓ Unmapped block names: {len(unmapped_blocks)}", file=sys.stderr)
    print(f"  ✓ Top unmapped (potential NEW patterns):", file=sys.stderr)
    for name, n in unmapped_blocks.most_common(15):
        print(f"    {n:4} × {name}", file=sys.stderr)

    # Klempířina geometry breakdown by category (Tier 4 deliverable)
    klempir_breakdown = {}
    for cat in ["klempir_atika", "klempir_okap", "klempir_svod", "klempir_parapet"]:
        items = by_category.get(cat, [])
        klempir_breakdown[cat] = {
            "n_inserts": len(items),
            "unique_block_names": sorted({i["block_name"] for i in items}),
        }

    # ─────────────────────────────────────────────────────────────────
    # TIER 5 — Metadata layer quick scan + confirmation
    print("\n[Tier 5] Metadata layer quick scan...", file=sys.stderr)
    metadata_confirmation = {}
    for file_key, path in SOURCES.items():
        if not path.exists():
            continue
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()
        meta_layers = []
        for layer in doc.layers:
            lname = layer.dxf.name
            # Match metadata pattern
            if METADATA_LAYER_PATTERNS.search(lname):
                ents = [e for e in msp if getattr(e.dxf, "layer", None) == lname]
                meta_layers.append({
                    "layer_name": lname,
                    "entity_count": len(ents),
                    "entity_types": dict(Counter(e.dxftype() for e in ents)),
                    "probe_status": "probed_metadata_only_confirmed",
                    "decision": "skip — title block / razítko / severka / defpoints content",
                })
        metadata_confirmation[file_key] = {
            "n_metadata_layers": len(meta_layers),
            "layers": meta_layers,
        }
    total_meta_layers = sum(d["n_metadata_layers"] for d in metadata_confirmation.values())
    print(f"  ✓ {total_meta_layers} metadata layers across 4 DXFs confirmed skip", file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    # Outputs

    out1 = OUT / "dxf_inserts_tier4_extended.json"
    out1.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": str(date.today()),
        "_generated_by": "tools/path_c_tier4_5_inserts_metadata.py",
        "_purpose": "Path C Tier 4 — extended INSERT block discovery + klempířina symbol categorization.",
        "_summary": {
            "total_inserts_across_4_dxf": len(all_inserts),
            "n_mapped_categories": sum(1 for c in category_counts if c != "unmapped"),
            "n_unmapped_blocks": len(unmapped_blocks),
            "category_counts": dict(sorted(category_counts.items(), key=lambda x: -x[1])),
        },
        "per_file_summary": per_file_summary,
        "klempirina_breakdown": klempir_breakdown,
        "all_categories_aggregated": {
            cat: {
                "n_inserts": len(items),
                "unique_block_names": sorted({i["block_name"] for i in items}),
                "sample_positions": [(i["x"], i["y"]) for i in items[:5]],
            }
            for cat, items in by_category.items() if cat != "unmapped"
        },
        "unmapped_block_names_top_50": dict(unmapped_blocks.most_common(50)),
    }, indent=2, ensure_ascii=False))
    print(f"\n✓ Wrote {out1.relative_to(PROJ)} ({out1.stat().st_size:,} bytes)", file=sys.stderr)

    out2 = OUT / "dxf_metadata_tier5_confirmed.json"
    out2.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": str(date.today()),
        "_generated_by": "tools/path_c_tier4_5_inserts_metadata.py",
        "_purpose": "Path C Tier 5 — metadata layers quick scan + skip confirmation (closes inventory).",
        "_summary": {
            "total_metadata_layers_confirmed": total_meta_layers,
        },
        "per_file": metadata_confirmation,
    }, indent=2, ensure_ascii=False))
    print(f"✓ Wrote {out2.relative_to(PROJ)} ({out2.stat().st_size:,} bytes)", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
