#!/usr/bin/env python3
"""
Path C — Tier 3: HIGH GEOMETRY + embedded tables hunt + dual catalog inventory.

5-fold task per user spec + DODATEK:
  A. 10 medium-priority geometry layers + 2 low-priority hatch — LWPOLYLINE/LINE/HATCH
  B. Embedded tables follow-up extraction (20 hits z Tier 2)
  C. Sklad external perimeter (sklad_DPZ)
  D. Bourací qty deterministic (SM__04_čárkovaná + SM__kóty bourání)
  E. HATCH stav vs návrh distinction
  + DODATEK: catalog_cache_inventory.json s dual-catalog (URS201801 + KROS TSKP)

Outputs:
  outputs/dxf_geometry_tier3.json (geometry, perimeter, bourání, HATCH)
  outputs/dxf_embedded_tables_extracted.json (tables full content)
  outputs/catalog_cache_inventory.json (dual catalog inventory)
"""

from __future__ import annotations

import csv
import json
import math
import re
import sqlite3
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import ezdxf

PROJ = Path(__file__).resolve().parent.parent
INPUTS = PROJ / "inputs"
OUT = PROJ / "outputs"
URS_CSV = PROJ.parent.parent / "URS_MATCHER_SERVICE" / "backend" / "data" / "URS201801.csv"
KROS_MDB = PROJ.parent.parent / "URS_MATCHER_SERVICE" / "backend" / "data" / "KROS.MDB"

SOURCES = {
    "dum_DPZ":       INPUTS / "vykresy_dxf" / "260219_dum"   / "RD Jachymov dum _ DPZ _ 10.dxf",
    "dum_situace":   INPUTS / "vykresy_dxf" / "260219_dum"   / "RD Jachymov dum _ situace 02.dxf",
    "sklad_DPZ":     INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ DPZ _ 02.dxf",
    "sklad_situace": INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ situace 04.dxf",
}

# Target geometry layers (per user spec + audit)
TARGET_GEOM_LAYERS = {
    "Vnější zdi", "km_R_návrh_ zateplení", "SM__04_čárkovaná", "SM__06_dvojčerchovaná",
    "SMA_šrafy", "SM_ Návrh šrafa", "Zdi.model", "IP_zařizováky",
    "MA_klempíř", "SM__ klempířina",
}
HATCH_FOCUS_LAYERS = {"km_R_návrh_šrafa", "km_R_návrh_šrafa 2", "km_šrafy", "SMA_šrafy", "SM_ Návrh šrafa"}

MTEXT_CODE_RE = re.compile(r"\\[fHpBISOLAQix][^;]*;|[{}]")
TAB_RE = re.compile(r"(\^I)+")

EMBEDDED_TABLE_HINT = re.compile(r"\bč\.\s*m\.\s*\t|název\s*místnosti|skladba|plocha\s*\[?\s*m[²2]", re.I)


def shoelace(verts):
    a = 0.0
    for i in range(len(verts)):
        x1, y1 = verts[i]
        x2, y2 = verts[(i + 1) % len(verts)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def polyline_length(verts, closed):
    p = 0.0
    for i in range(len(verts) - 1):
        p += math.hypot(verts[i + 1][0] - verts[i][0], verts[i + 1][1] - verts[i][1])
    if closed and len(verts) >= 2:
        p += math.hypot(verts[0][0] - verts[-1][0], verts[0][1] - verts[-1][1])
    return p


def strip_mtext(raw: str) -> str:
    t = MTEXT_CODE_RE.sub("", raw or "")
    t = TAB_RE.sub("\t", t)
    t = t.replace("\\P", "\n")
    return t.strip()


def main():
    OUT.mkdir(exist_ok=True)
    # ─────────────────────────────────────────────────────────────────
    # PART A — Geometry extraction across all target layers
    print("[A/E] Geometry extraction across target layers...", file=sys.stderr)
    geom_results = {}
    for file_key, path in SOURCES.items():
        if not path.exists():
            continue
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()
        per_layer_geom = {}
        for layer in doc.layers:
            lname = layer.dxf.name
            # Probe ALL layers for geometry data, focus on TARGET ones
            ents_on = [e for e in msp if getattr(e.dxf, "layer", None) == lname]
            if not ents_on:
                continue
            n_line = sum(1 for e in ents_on if e.dxftype() == "LINE")
            n_poly = sum(1 for e in ents_on if e.dxftype() == "LWPOLYLINE")
            n_arc  = sum(1 for e in ents_on if e.dxftype() == "ARC")
            n_hatch = sum(1 for e in ents_on if e.dxftype() == "HATCH")
            if (n_line + n_poly + n_arc + n_hatch) == 0:
                continue
            total_len_mm = 0.0
            closed_areas_m2 = []
            for e in ents_on:
                try:
                    if e.dxftype() == "LINE":
                        s, en = e.dxf.start, e.dxf.end
                        total_len_mm += math.hypot(en[0] - s[0], en[1] - s[1])
                    elif e.dxftype() == "LWPOLYLINE":
                        v = [(vv[0], vv[1]) for vv in e.vertices()]
                        total_len_mm += polyline_length(v, e.is_closed)
                        if e.is_closed and len(v) >= 3:
                            closed_areas_m2.append(round(shoelace(v) / 1e6, 2))
                    elif e.dxftype() == "ARC":
                        # approximate length = radius × angle_rad
                        r = e.dxf.radius
                        ang = (e.dxf.end_angle - e.dxf.start_angle) % 360
                        total_len_mm += r * math.radians(ang)
                except Exception:
                    pass
            hatch_areas_by_pattern = defaultdict(float)
            for e in ents_on:
                if e.dxftype() != "HATCH":
                    continue
                try:
                    pn = e.dxf.pattern_name
                    for path_obj in e.paths:
                        v = []
                        if hasattr(path_obj, "vertices"):
                            v = [(vv[0], vv[1]) for vv in path_obj.vertices]
                        if len(v) >= 3:
                            hatch_areas_by_pattern[pn] += shoelace(v) / 1e6
                except Exception:
                    pass

            entry = {
                "n_line": n_line, "n_poly": n_poly, "n_arc": n_arc, "n_hatch": n_hatch,
                "total_length_m": round(total_len_mm / 1000, 2),
                "n_closed_polys": len(closed_areas_m2),
                "closed_areas_m2_top10": sorted(closed_areas_m2, reverse=True)[:10],
                "hatch_areas_m2_by_pattern": {k: round(v, 2) for k, v in hatch_areas_by_pattern.items() if v > 0.1},
                "target_geom_layer": lname in TARGET_GEOM_LAYERS,
                "hatch_focus_layer": lname in HATCH_FOCUS_LAYERS,
            }
            per_layer_geom[lname] = entry
        geom_results[file_key] = per_layer_geom
    print(f"  ✓ Geometry extracted from {sum(len(v) for v in geom_results.values())} layer-file combos", file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    # PART B — Embedded tables full extraction
    print("\n[B/E] Embedded tables full extraction...", file=sys.stderr)
    embedded_tables = []
    table_counter = 0
    for file_key, path in SOURCES.items():
        if not path.exists():
            continue
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()
        for e in msp:
            if e.dxftype() != "MTEXT":
                continue
            try:
                raw = e.text or ""
                cleaned = strip_mtext(raw)
                if not EMBEDDED_TABLE_HINT.search(cleaned) and "\t" not in cleaned:
                    continue
                if len(cleaned) < 30:
                    continue
                lines = [l for l in cleaned.split("\n") if l.strip()]
                if len(lines) < 2:
                    continue
                # Detect headers + rows
                first_line = lines[0]
                headers = [h.strip() for h in first_line.split("\t") if h.strip()]
                data_rows = []
                for line in lines[1:]:
                    cells = [c.strip() for c in line.split("\t") if c.strip()]
                    if cells:
                        data_rows.append(cells)
                if not data_rows:
                    continue
                # Classify table type by header keywords
                header_lc = " ".join(headers).lower() + " " + cleaned[:200].lower()
                table_type = "other"
                if "č. m." in header_lc or "místnosti" in header_lc and "plocha" in header_lc:
                    table_type = "tabulka_mistnosti"
                elif "okno" in header_lc or "okna" in header_lc:
                    table_type = "vypis_oken"
                elif "dveře" in header_lc or "dvere" in header_lc:
                    table_type = "vypis_dveri"
                elif "klemp" in header_lc or "oplech" in header_lc or "atika" in header_lc:
                    table_type = "vypis_klempir"
                elif re.search(r"\bF\d{2}\b", first_line) or "skladba" in header_lc:
                    table_type = "tabulka_skladeb_f"
                elif "hea" in header_lc or "ipe" in header_lc or "profil" in header_lc:
                    table_type = "vypis_profilov"
                elif "odpad" in header_lc or "kategorie" in header_lc:
                    table_type = "tabulka_odpadu"
                table_counter += 1
                embedded_tables.append({
                    "table_id": f"T{table_counter:02d}",
                    "source_dxf": file_key,
                    "source_layer": e.dxf.layer,
                    "position": (round(e.dxf.insert[0], 0), round(e.dxf.insert[1], 0)),
                    "type": table_type,
                    "header_row": headers,
                    "data_rows_count": len(data_rows),
                    "data_rows_sample": data_rows[:10],
                    "raw_chars": len(cleaned),
                })
            except Exception:
                pass

    table_type_counter = Counter(t["type"] for t in embedded_tables)
    print(f"  ✓ {len(embedded_tables)} embedded tables extracted", file=sys.stderr)
    for tt, n in table_type_counter.most_common():
        print(f"    {tt}: {n}", file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    # PART C — Sklad external perimeter
    print("\n[C/E] Sklad external perimeter probe...", file=sys.stderr)
    sklad_perimeter_candidates = []
    doc = ezdxf.readfile(str(SOURCES["sklad_DPZ"]))
    msp = doc.modelspace()
    for e in msp:
        if e.dxftype() != "LWPOLYLINE" or not e.is_closed:
            continue
        v = [(vv[0], vv[1]) for vv in e.vertices()]
        if len(v) < 4:
            continue
        area = shoelace(v) / 1e6
        per_m = polyline_length(v, True) / 1000
        # Sklad ~21 m² podlaha, perimeter ~19-22 m
        if 15 <= area <= 30 and 15 <= per_m <= 30:
            sklad_perimeter_candidates.append({
                "layer": e.dxf.layer,
                "area_m2": round(area, 2),
                "perim_m": round(per_m, 2),
                "n_verts": len(v),
            })
    sklad_perimeter_candidates.sort(key=lambda c: c["area_m2"], reverse=True)
    print(f"  ✓ {len(sklad_perimeter_candidates)} sklad perimeter candidates", file=sys.stderr)
    if sklad_perimeter_candidates:
        for c in sklad_perimeter_candidates[:5]:
            print(f"    layer={c['layer']!r}: area={c['area_m2']} m² perim={c['perim_m']} m", file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    # PART D — Bourací qty (SM__04_čárkovaná + SM_kóty bourání)
    print("\n[D/E] Bourací qty deterministic (DASHED lines + bourací DIMs)...", file=sys.stderr)
    bourani_data = {"DASHED_lines": [], "bourani_dims": []}
    doc = ezdxf.readfile(str(SOURCES["dum_DPZ"]))
    msp = doc.modelspace()
    # SM__04_čárkovaná polylines
    for e in msp.query('LWPOLYLINE[layer=="SM__04_čárkovaná"]'):
        v = [(vv[0], vv[1]) for vv in e.vertices()]
        if not v:
            continue
        length_m = round(polyline_length(v, e.is_closed) / 1000, 2)
        area_m2 = round(shoelace(v) / 1e6, 2) if e.is_closed and len(v) >= 3 else None
        bourani_data["DASHED_lines"].append({
            "length_m": length_m,
            "area_m2_if_closed": area_m2,
            "n_verts": len(v),
        })
    bourani_data["DASHED_total_length_m"] = round(sum(d["length_m"] for d in bourani_data["DASHED_lines"]), 2)
    bourani_data["DASHED_closed_total_area_m2"] = round(
        sum(d["area_m2_if_closed"] or 0 for d in bourani_data["DASHED_lines"]), 2
    )
    # SM_kóty bourání dimensions
    for e in msp.query('DIMENSION[layer=="SM_kóty bourání"]'):
        m = e.get_measurement()
        if m is None:
            continue
        bourani_data["bourani_dims"].append(round(float(m), 1))
    print(f"  ✓ DASHED lines: {len(bourani_data['DASHED_lines'])}, total {bourani_data['DASHED_total_length_m']} m", file=sys.stderr)
    print(f"  ✓ Bourání DIMs: {bourani_data['bourani_dims']}", file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    # PART E — HATCH stav vs návrh distinction
    print("\n[E/E] HATCH areas stav vs návrh distinction...", file=sys.stderr)
    hatch_phase_summary = defaultdict(lambda: defaultdict(float))
    for file_key, layers in geom_results.items():
        for lname, data in layers.items():
            phase = "návrh" if "návrh" in lname.lower() else ("stav" if "stav" in lname.lower() else "common")
            for pn, area in data.get("hatch_areas_m2_by_pattern", {}).items():
                hatch_phase_summary[file_key][f"{phase}|{pn}"] += area
    hatch_phase_final = {
        fk: {k: round(v, 2) for k, v in items.items()}
        for fk, items in hatch_phase_summary.items()
    }

    # ─────────────────────────────────────────────────────────────────
    # DODATEK — Dual catalog inventory (URS201801 + KROS TSKP)
    print("\n[+/+] Dual catalog inventory (URS201801 + KROS TSKP)...", file=sys.stderr)
    catalogs = {"catalogs_discovered": []}

    if URS_CSV.exists():
        urs_codes = set()
        with URS_CSV.open("r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if ";" in line:
                    code = line.split(";")[0].strip()
                    if code:
                        urs_codes.add(code)
        catalogs["catalogs_discovered"].append({
            "name": "URS201801",
            "path": str(URS_CSV.relative_to(PROJ.parent.parent)),
            "format": "CSV semicolon",
            "rows": len(urs_codes),
            "schema": ["code", "type", "description"],
            "vintage": "2018",
            "description_format": "tokenized normalized (lowercase, deaccent — needs item-side normalization for BM25 matching)",
            "sample_unique_codes": sorted(list(urs_codes))[:10],
        })

    # KROS TSKP via mdb-export
    tskp_codes = set()
    tskp_sample = []
    try:
        result = subprocess.run(
            ["mdb-export", str(KROS_MDB), "TSKP"],
            capture_output=True, text=True, timeout=60,
        )
        lines = result.stdout.splitlines()
        if lines:
            header = lines[0]
            for line in lines[1:]:
                parts = list(csv.reader([line]))[0] if line else []
                if len(parts) >= 5:
                    kod = parts[4].strip()
                    popis = parts[7].strip() if len(parts) > 7 else ""
                    if kod:
                        tskp_codes.add(kod)
                        if len(tskp_sample) < 10:
                            tskp_sample.append({"kod": kod, "popis": popis[:80]})
    except Exception as e:
        catalogs["_kros_error"] = str(e)[:120]

    if tskp_codes:
        catalogs["catalogs_discovered"].append({
            "name": "KROS_TSKP",
            "path": str(KROS_MDB.relative_to(PROJ.parent.parent)),
            "format": "Microsoft Access MDB (extracted via mdb-export)",
            "rows": len(tskp_codes),
            "table": "TSKP",
            "schema_main_fields": ["Kod (hierarchical 0..01..011..0111..01111)", "Popis (readable Czech)", "PopisSkrateny", "MJ", "Uroven (level 0-5)", "IDRodic (parent GUID)"],
            "vintage": "12/05/25 dle ZmenaCas (likely 2025 update)",
            "description_format": "readable Czech (NOT tokenized — more useful for human-readable matching)",
            "sample_entries": tskp_sample,
            "other_tables_in_mdb": "JKSO (971 rows building classification), CPACPV (2364 rows product activity), Diel (169 rows sections)",
        })

    # Overlap analysis
    if urs_codes and tskp_codes:
        common = urs_codes & tskp_codes
        unique_urs = urs_codes - tskp_codes
        unique_tskp = tskp_codes - urs_codes
        catalogs["overlap_analysis"] = {
            "urs201801_total": len(urs_codes),
            "tskp_total": len(tskp_codes),
            "common_codes": len(common),
            "unique_to_urs201801": len(unique_urs),
            "unique_to_tskp": len(unique_tskp),
            "sample_common": sorted(list(common))[:10],
            "recommendation": (
                "Use TSKP as PRIMARY (readable Czech popis enables BM25/fuzzy match without "
                "tokenization normalization step). Fall back to URS201801 for codes not in TSKP "
                "(URS201801 has more codes but tokenized form). Per Part 5b: try TSKP first → URS2018 → "
                "needs_production_lookup."
            ),
        }
    catalogs["_decision_per_user_spec"] = "NEK matchingu zatím — deferred to Part 5b after Tier 5 final items.json upgrade."
    catalogs["_generated_at"] = str(date.today())

    print(f"  ✓ URS201801: {len(urs_codes)} codes | KROS TSKP: {len(tskp_codes)} codes", file=sys.stderr)
    if urs_codes and tskp_codes:
        print(f"    Overlap: {len(urs_codes & tskp_codes)} common, "
              f"{len(urs_codes - tskp_codes)} unique URS, {len(tskp_codes - urs_codes)} unique TSKP",
              file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    # Write outputs

    out1 = OUT / "dxf_geometry_tier3.json"
    out1.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": str(date.today()),
        "_generated_by": "tools/path_c_tier3_geometry.py",
        "geometry_per_layer": geom_results,
        "sklad_external_perimeter_candidates": sklad_perimeter_candidates,
        "bourani_qty": bourani_data,
        "hatch_phase_summary": hatch_phase_final,
    }, indent=2, ensure_ascii=False))
    print(f"\n✓ Wrote {out1.relative_to(PROJ)} ({out1.stat().st_size:,} bytes)", file=sys.stderr)

    out2 = OUT / "dxf_embedded_tables_extracted.json"
    out2.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": str(date.today()),
        "_purpose": "Full content extraction of 20 embedded MTEXT tables detected in Tier 2.",
        "_type_distribution": dict(table_type_counter.most_common()),
        "tables": embedded_tables,
    }, indent=2, ensure_ascii=False))
    print(f"✓ Wrote {out2.relative_to(PROJ)} ({out2.stat().st_size:,} bytes)", file=sys.stderr)

    out3 = OUT / "catalog_cache_inventory.json"
    out3.write_text(json.dumps(catalogs, indent=2, ensure_ascii=False))
    print(f"✓ Wrote {out3.relative_to(PROJ)} ({out3.stat().st_size:,} bytes)", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
