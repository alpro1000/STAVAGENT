#!/usr/bin/env python3
"""
Path C — Tier 2: HIGH TEXT (MTEXT/TEXT) classification + 160 mm disambiguation.

Per user spec: extract VŠECHNY MTEXT/TEXT entities across all 4 DXFs with
position + content + nearby_entity classification. CRITICAL: disambiguate
160 mm DIMENSION value (7 hits, ETICS EPS vs HEA160 vs PIR).

Output:
  outputs/dxf_mtext_classified_v2.json
  outputs/dimension_semantic_pairs.json
  outputs/urs_cache_inventory.json — for Part 5b deferred matching

Classification taxonomy:
  material_marker / skladba_code / room_number / dimension_callout /
  embedded_table_row / poznamka_reference / klempir_label /
  konstr_callout / dimension_with_marker / metadata_label / other
"""

from __future__ import annotations

import csv
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
URS_CACHE = PROJ.parent.parent / "URS_MATCHER_SERVICE" / "backend" / "data" / "URS201801.csv"

SOURCES = {
    "dum_DPZ":       INPUTS / "vykresy_dxf" / "260219_dum"   / "RD Jachymov dum _ DPZ _ 10.dxf",
    "dum_situace":   INPUTS / "vykresy_dxf" / "260219_dum"   / "RD Jachymov dum _ situace 02.dxf",
    "sklad_DPZ":     INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ DPZ _ 02.dxf",
    "sklad_situace": INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ situace 04.dxf",
}

# ───────────────────────────────────────────────────────────────────────────
# Strip MTEXT formatting codes

MTEXT_CODE_RE = re.compile(r"\\[fHpBISOLAQix][^;]*;|[{}]")
TAB_LITERAL_RE = re.compile(r"(\^I)+")

def strip_mtext(raw: str) -> str:
    """Clean MTEXT formatting codes + tab literals."""
    t = MTEXT_CODE_RE.sub("", raw or "")
    t = TAB_LITERAL_RE.sub("\t", t)
    t = t.replace("\\P", "\n")
    return t.strip()


# ───────────────────────────────────────────────────────────────────────────
# Classification patterns

SCODE_RE = re.compile(r"^\s*(S\d{1,2}[a-z]?)\s*$")
FCODE_RE = re.compile(r"^\s*(F\d{1,2}[a-z]?)\s*$")
ROOM_NUM_RE = re.compile(r"^\s*(\d\.\d{1,2})\s*$")
POZN_RE = re.compile(r"^\s*POZN\.\s*\d+\.\d{1,2}\s*$", re.I)
DIM_WITH_PROFILE_RE = re.compile(r"\b\d{2,4}\s*[/x×]\s*\d{2,4}\b")  # e.g. 200/160, 100×4
PROFILE_RE = re.compile(r"\b(HEA|HEB|IPE|IPN|UPE|JEKL|jakl|jakl)\s*\d{2,4}\b", re.I)
MATERIAL_RE = re.compile(
    r"\b(EPS|XPS|PIR|MW|Porotherm|Ytong|vinyl|dlažba|dlazba|beton|cement|"
    r"asfalt|hydroizolac|tepeln[áě] izolac|kročejov|fermacell|isover|knauf|"
    r"sádrokarton|sdk|trapéz|nabetonávka|žárov[ýé] zinek|žárově|laku|fasád)",
    re.IGNORECASE,
)
KLEMPIR_RE = re.compile(
    r"\b(atik|okap|svod|parapet|lemma|oplechován|plech|klempířin|klempíř|"
    r"falcov|hřeben|úžlab|závětrná lišta)",
    re.IGNORECASE,
)
KONSTR_RE = re.compile(
    r"\b(stropnice|krokev|kleština|pozednice|sloupek|vaznice|nosník|"
    r"překlad|trám|jakl|jekl|profil|ocelová|železobeton|ŽB|žb)",
    re.IGNORECASE,
)
EMBEDDED_TABLE_HINT = re.compile(r"\bč\.\s*m\.\s*\t|název\s*místnosti|skladba|plocha\s*\[?\s*m[²2]", re.I)
METADATA_HINT_RE = re.compile(
    r"^(investor|projektant|hlavn[íi]\s*projektant|projektov[ýy]\s*stupe[ňn]|"
    r"datum|razítko|severka|výškov[ýy]\s*systém|paré|měřítko|revize|"
    r"SMASH|TeAnau|TUSPO|Smolka|Tvardík|Volný|stupeň|název\s*výkresu|"
    r"název\s*akce|generální\s*projektant|ČKAIT|ČKA|IČO|Vodňanského|"
    r"Praha\s*\d|tel\.|email|Bc\.|Ing\.)",
    re.IGNORECASE,
)

def classify_mtext(text: str) -> str:
    """Apply classification taxonomy to MTEXT content."""
    cleaned = strip_mtext(text)
    if not cleaned:
        return "empty"
    short = cleaned.strip()

    if SCODE_RE.match(short):
        return "skladba_code"
    if FCODE_RE.match(short):
        return "fcode"
    if ROOM_NUM_RE.match(short):
        return "room_number"
    if POZN_RE.match(short):
        return "poznamka_reference"
    if PROFILE_RE.search(short):
        return "konstr_callout_profile"
    if DIM_WITH_PROFILE_RE.search(short) and len(short) < 30:
        return "dimension_with_marker"
    if KLEMPIR_RE.search(cleaned):
        return "klempir_label"
    if EMBEDDED_TABLE_HINT.search(cleaned):
        return "embedded_table_row"
    if MATERIAL_RE.search(cleaned):
        return "material_marker"
    if METADATA_HINT_RE.match(short):
        return "metadata_label"
    if re.match(r"^[\+\-±]?[\d,.]+$", short):
        return "elevation_or_number"
    if KONSTR_RE.search(cleaned):
        return "konstr_callout_general"
    return "other"


# ───────────────────────────────────────────────────────────────────────────
# Nearby entity search (KD-tree-ish, brute force for small datasets)

def find_nearby_entities(target_x: float, target_y: float, all_entities: list, radius: float = 500) -> list:
    """Find entities within radius mm of target point."""
    out = []
    for e in all_entities:
        ex, ey = e["x"], e["y"]
        d = math.hypot(ex - target_x, ey - target_y)
        if d <= radius:
            rec = dict(e)
            rec["distance_mm"] = round(d, 1)
            out.append(rec)
    out.sort(key=lambda r: r["distance_mm"])
    return out[:5]


# ───────────────────────────────────────────────────────────────────────────
# Main

def main():
    OUT.mkdir(exist_ok=True)
    print("[1/5] Extracting all MTEXT/TEXT entities across 4 DXFs...", file=sys.stderr)

    # Collect all MTEXT/TEXT entities globally
    all_texts = []      # for nearby lookup
    all_dimensions = [] # for disambiguation
    per_layer_mtext = defaultdict(list)   # final classification output keyed by layer

    for file_key, path in SOURCES.items():
        if not path.exists():
            continue
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()

        for e in msp:
            try:
                typ = e.dxftype()
                if typ in ("MTEXT", "TEXT"):
                    if typ == "MTEXT":
                        raw_text = e.text or ""
                        pos = e.dxf.insert
                    else:
                        raw_text = e.dxf.text or ""
                        pos = e.dxf.insert
                    cleaned = strip_mtext(raw_text)
                    if not cleaned:
                        continue
                    classification = classify_mtext(raw_text)
                    layer = e.dxf.layer
                    rec = {
                        "file": file_key,
                        "layer": layer,
                        "type": typ,
                        "raw_text": raw_text[:200],
                        "cleaned_text": cleaned[:200],
                        "classification": classification,
                        "x": round(pos[0], 0),
                        "y": round(pos[1], 0),
                    }
                    all_texts.append(rec)
                    per_layer_mtext[layer].append(rec)
                elif typ == "DIMENSION":
                    try:
                        m = e.get_measurement()
                        if m is None:
                            continue
                        try:
                            dpos = e.dxf.defpoint
                            px, py = dpos[0], dpos[1]
                        except Exception:
                            px, py = 0.0, 0.0
                        all_dimensions.append({
                            "file": file_key,
                            "layer": e.dxf.layer,
                            "value_mm": round(float(m), 1),
                            "x": round(px, 0),
                            "y": round(py, 0),
                        })
                    except Exception:
                        pass
            except Exception:
                pass

    print(f"  ✓ {len(all_texts)} MTEXT/TEXT total across {len(per_layer_mtext)} layers", file=sys.stderr)
    print(f"  ✓ {len(all_dimensions)} DIMENSIONs (for disambiguation)", file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    print("\n[2/5] Classification taxonomy distribution...", file=sys.stderr)
    class_counter = Counter(t["classification"] for t in all_texts)
    for cls, n in class_counter.most_common():
        print(f"  {cls:32} | {n}", file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    print("\n[3/5] 160 mm DIMENSION disambiguation (7 known hits)...", file=sys.stderr)
    dims_160 = [d for d in all_dimensions if abs(d["value_mm"] - 160.0) < 1.0]
    disambig_160 = []
    for dim in dims_160:
        nearby = find_nearby_entities(dim["x"], dim["y"], all_texts, radius=2000)
        # Classify based on nearby text content
        verdict = "ambiguous"
        reasoning = []
        keywords_hit = []
        for nb in nearby:
            t = nb["cleaned_text"]
            tl = t.lower()
            if any(k in tl for k in ["hea", "heb", "ipe", "ipn", "jakl", "jekl", "profil", "ocelov"]):
                verdict = "profile_HEA_or_jakl"; keywords_hit.append(t[:30])
                break
            if any(k in tl for k in ["eps", "etics", "s01", "s12a", "zateplení", "kontaktní"]):
                verdict = "ETICS_EPS_tloušťka"; keywords_hit.append(t[:30])
                break
            if any(k in tl for k in ["pir", "krov", "s10", "střech"]):
                verdict = "PIR_střecha"; keywords_hit.append(t[:30])
                break
        disambig_160.append({
            "file": dim["file"],
            "layer": dim["layer"],
            "position": (dim["x"], dim["y"]),
            "verdict": verdict,
            "keywords_hit": keywords_hit,
            "n_nearby_text": len(nearby),
            "nearby_text_sample": [n["cleaned_text"][:50] for n in nearby[:3]],
        })
    print(f"  ✓ {len(disambig_160)} 160-mm dimensions, verdicts:", file=sys.stderr)
    verdict_counter = Counter(d["verdict"] for d in disambig_160)
    for v, n in verdict_counter.most_common():
        print(f"    {v}: {n}", file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    print("\n[4/5] POZN.X.YY reference extraction + krov dimension semantic pairs...", file=sys.stderr)
    pozn_refs = [t for t in all_texts if t["classification"] == "poznamka_reference"]
    print(f"  ✓ {len(pozn_refs)} POZN references found", file=sys.stderr)

    # Cross-reference critical Tier 1 dimensions with nearby MTEXT
    semantic_pairs = []
    critical_dim_values = [2100, 2795, 2865, 2630, 3200, 6350, 3340, 180, 160]
    for cv in critical_dim_values:
        matches = [d for d in all_dimensions if abs(d["value_mm"] - cv) < 1.0]
        for dim in matches[:3]:  # limit to first 3 per critical value
            nearby = find_nearby_entities(dim["x"], dim["y"], all_texts, radius=1500)
            semantic_pairs.append({
                "dimension_value_mm": cv,
                "dimension_file": dim["file"],
                "dimension_layer": dim["layer"],
                "dimension_position": (dim["x"], dim["y"]),
                "nearby_text_count": len(nearby),
                "nearby_text_top3": [
                    {"text": n["cleaned_text"][:80], "classification": n["classification"], "distance_mm": n["distance_mm"]}
                    for n in nearby[:3]
                ],
            })

    # ─────────────────────────────────────────────────────────────────
    print("\n[5/5] URS local cache inventory...", file=sys.stderr)
    urs_inventory = {}
    if URS_CACHE.exists():
        n_rows = 0
        schema_sample = []
        kapitola_prefixes = Counter()
        with URS_CACHE.open("r", encoding="utf-8", errors="ignore") as f:
            for i, line in enumerate(f):
                if i < 5:
                    parts = line.strip().split(";")
                    schema_sample.append(parts)
                if line.strip():
                    n_rows += 1
                # First 3 chars (kapitola prefix)
                if ";" in line:
                    code = line.split(";")[0].strip()
                    if len(code) >= 3 and code[:3].isdigit():
                        kapitola_prefixes[code[:3]] += 1
                    elif len(code) >= 2 and code[:2].isdigit():
                        kapitola_prefixes[code[:2]] += 1
        urs_inventory = {
            "path": str(URS_CACHE.relative_to(PROJ.parent.parent)),
            "size_bytes": URS_CACHE.stat().st_size,
            "n_rows": n_rows,
            "schema": "code;type;description (semicolon-separated, KROS URS 2018 catalog)",
            "schema_sample_rows": schema_sample[:3],
            "_format_note": (
                "Description field is encoded — appears to be lowercased + diacritic-stripped + "
                "tokenized form (e.g. 'cinnst nakld pruvdnch rozdln zakldn'). For BM25/fuzzy matching "
                "v Part 5b deferred phase, will need to normalize item popis to same encoding for "
                "consistent matching."
            ),
            "kapitola_prefix_distribution_top20": dict(kapitola_prefixes.most_common(20)),
            "_deferred_to_part_5b": "URS matching against this cache will run AFTER final items.json upgrade (Tier 5 complete).",
        }
        print(f"  ✓ URS cache: {n_rows:,} rows, {URS_CACHE.stat().st_size:,} bytes", file=sys.stderr)
    else:
        urs_inventory = {"_error": "URS cache file not found", "expected_path": str(URS_CACHE)}
        print(f"  ✗ URS cache not at {URS_CACHE}", file=sys.stderr)

    # ─────────────────────────────────────────────────────────────────
    # Write outputs

    # 1. Main classified MTEXT output
    out1 = OUT / "dxf_mtext_classified_v2.json"
    main_output = {
        "_schema_version": "2.0",
        "_generated_at": str(date.today()),
        "_generated_by": "tools/path_c_tier2_mtext.py",
        "_summary": {
            "total_mtext_text_entities": len(all_texts),
            "n_layers_with_mtext": len(per_layer_mtext),
            "classification_distribution": dict(class_counter.most_common()),
        },
        "per_layer_mtext": {
            layer: {
                "n_entities": len(entries),
                "classification_breakdown": dict(Counter(e["classification"] for e in entries).most_common()),
                "entries": entries[:50],  # cap per-layer to 50 to keep file manageable
            }
            for layer, entries in sorted(per_layer_mtext.items(), key=lambda x: -len(x[1]))
        },
        "disambiguation_160mm": {
            "_description": "7 known 160 mm DIMENSION hits — disambiguate ETICS EPS vs HEA160 profile vs PIR střecha via nearby MTEXT classification",
            "occurrences": disambig_160,
            "verdict_summary": dict(verdict_counter.most_common()),
        },
        "poznamka_references": pozn_refs[:30],
    }
    out1.write_text(json.dumps(main_output, indent=2, ensure_ascii=False))
    print(f"\n✓ Wrote {out1.relative_to(PROJ)} ({out1.stat().st_size:,} bytes)", file=sys.stderr)

    # 2. Dimension semantic pairs
    out2 = OUT / "dimension_semantic_pairs.json"
    out2.write_text(json.dumps({
        "_schema_version": "2.0",
        "_generated_at": str(date.today()),
        "_purpose": "Cross-reference critical Tier 1 dimensions with nearby MTEXT semantic context for element attribution.",
        "_critical_dim_values_checked": critical_dim_values,
        "semantic_pairs": semantic_pairs,
    }, indent=2, ensure_ascii=False))
    print(f"✓ Wrote {out2.relative_to(PROJ)} ({out2.stat().st_size:,} bytes)", file=sys.stderr)

    # 3. URS inventory
    out3 = OUT / "urs_cache_inventory.json"
    out3.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": str(date.today()),
        "_purpose": "URS local cache discovery for Part 5b deferred matching phase.",
        "_decision_per_user_spec": "NEK matchingu zatím — URS lookup deferred to Part 5b after final items.json upgrade (post Tier 5).",
        "urs_cache": urs_inventory,
    }, indent=2, ensure_ascii=False))
    print(f"✓ Wrote {out3.relative_to(PROJ)} ({out3.stat().st_size:,} bytes)", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
