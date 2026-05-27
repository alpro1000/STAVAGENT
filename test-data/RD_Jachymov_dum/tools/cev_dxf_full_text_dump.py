#!/usr/bin/env python3
"""
Exhaustive DXF text + table extractor — walks all 4 DXFs and dumps every
TEXT / MTEXT / DIMENSION / INSERT attribute per layer, with MTEXT format-code
decoding so that legendy / tabulky / POZN bloky come out as readable Czech.

This is the parser-mode the user asked for: forget pypdf mojibake, go to the
DXF source directly. Outputs structured per-drawing per-layer JSON suitable
for cross-reference against items.json + sklad S-code mapping work.

Output: outputs/cev_dxf_full_text_dump.json
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

import ezdxf

ROOT = Path(__file__).resolve().parent.parent
DXF_DIR = ROOT / "inputs" / "vykresy_dxf"
OUT = ROOT / "outputs" / "cev_dxf_full_text_dump.json"
GEN_AT = "2026-05-26"

# DXF MTEXT format codes to strip
# https://ezdxf.mozman.at/docs/dxfentities/mtext.html
MTEXT_CODES = [
    (re.compile(r"\\f[^;]*;"), ""),                      # font + all params: \fCentury Gothic|b1|i0|c238|p34;
    (re.compile(r"\\[FHWQpPaAlokKxXASC][^;]*;"), ""),    # other inline params: \pxa0.66667,sm1.07917t8,...
    (re.compile(r"\\[CcLlOoUuT]"), ""),                  # color, alignment toggles
    (re.compile(r"\\P"), "\n"),                          # \P → newline
    (re.compile(r"\^I"), "\t"),                          # ^I → tab
    (re.compile(r"\\~"), " "),                           # non-breaking space
    (re.compile(r"\\\\"), r"\\"),                        # escaped backslash (raw replacement)
    (re.compile(r"\{|\}"), ""),                          # group markers
]


def decode_mtext(s: str) -> str:
    if not s:
        return ""
    text = s
    for pat, repl in MTEXT_CODES:
        text = pat.sub(repl, text)
    return text.strip()


def safe_get_text(e) -> str:
    try:
        if e.dxftype() == "MTEXT":
            return decode_mtext(e.text)
        if e.dxftype() == "TEXT":
            return e.dxf.text
        if e.dxftype() == "DIMENSION":
            return f"DIM({getattr(e.dxf, 'actual_measurement', '?')})"
    except Exception:
        return ""
    return ""


def extract_insert_attribs(e) -> dict:
    """Pull tag/text pairs from INSERT block attributes (ATTRIB sub-entities)."""
    out = {"block_name": getattr(e.dxf, "name", ""), "attribs": {}}
    try:
        for att in e.attribs:
            out["attribs"][att.dxf.tag] = att.dxf.text
    except Exception:
        pass
    return out


def extract_dxf_text(dxf_path: Path) -> dict:
    doc = ezdxf.readfile(str(dxf_path))
    msp = doc.modelspace()
    per_layer: dict[str, list[dict]] = defaultdict(list)
    insert_per_layer: dict[str, list[dict]] = defaultdict(list)
    dim_per_layer: dict[str, list[dict]] = defaultdict(list)
    for e in msp:
        layer = getattr(e.dxf, "layer", "?")
        if e.dxftype() in ("TEXT", "MTEXT"):
            txt = safe_get_text(e)
            if txt:
                per_layer[layer].append({
                    "type": e.dxftype(),
                    "text": txt[:1000],
                    "x": float(getattr(e.dxf, "insert", (0, 0))[0]) if hasattr(e.dxf, "insert") else None,
                    "y": float(getattr(e.dxf, "insert", (0, 0))[1]) if hasattr(e.dxf, "insert") else None,
                })
        elif e.dxftype() == "INSERT":
            attrs = extract_insert_attribs(e)
            if attrs["attribs"] or attrs["block_name"]:
                insert_per_layer[layer].append(attrs)
        elif e.dxftype() == "DIMENSION":
            try:
                m = getattr(e.dxf, "actual_measurement", None)
                t = safe_get_text(e)
                dim_per_layer[layer].append({
                    "value_mm": m,
                    "override_text": getattr(e.dxf, "text", None),
                })
            except Exception:
                pass
    # Compact
    return {
        "dxf_path": str(dxf_path.relative_to(ROOT)),
        "n_layers_with_text": len(per_layer),
        "text_per_layer": dict(per_layer),
        "n_layers_with_inserts": len(insert_per_layer),
        "inserts_per_layer": dict(insert_per_layer),
        "n_layers_with_dimensions": len(dim_per_layer),
        "dimensions_per_layer": dict(dim_per_layer),
    }


def harvest_signals(file_data: dict) -> dict:
    """Pull out S-codes, POZN refs, room legendy + materiály legendy rows."""
    signals = {
        "s_codes_called_out": [],
        "f_codes": [],
        "pozn_refs": [],
        "rooms_table_rows": [],
        "material_legend_rows": [],
        "skladba_legend_rows": [],
        "callouts": [],
    }
    s_rx = re.compile(r"\bS\d{1,2}[a-zA-Z]?\b")
    f_rx = re.compile(r"\bF\d{1,2}[a-zA-Z]?\b")
    pozn_rx = re.compile(r"POZN\.?\s*\d{1,2}[\.\d]*", re.IGNORECASE)
    for layer, entries in file_data["text_per_layer"].items():
        layer_l = layer.lower()
        for ent in entries:
            t = ent["text"]
            # S/F codes
            for m in set(s_rx.findall(t)):
                signals["s_codes_called_out"].append({"code": m, "layer": layer, "context": t[:120]})
            for m in set(f_rx.findall(t)):
                signals["f_codes"].append({"code": m, "layer": layer, "context": t[:120]})
            # POZN refs
            for m in set(pozn_rx.findall(t)):
                signals["pozn_refs"].append({"ref": m.upper().replace(" ", ""), "layer": layer, "context": t[:200]})
            # Tables — by layer name
            if "tabulka místno" in layer_l or "tabulka mistno" in layer_l or "km_tabulka" in layer_l:
                signals["rooms_table_rows"].append({"layer": layer, "text": t[:600]})
            if "legend" in layer_l and ("materi" in layer_l or "konstruk" in layer_l or "skladb" in layer_l):
                signals["skladba_legend_rows"].append({"layer": layer, "text": t[:600]})
            # Skladba detail in IP_rozpiska / km_rozpiska / km_kóty
            if any(k in layer_l for k in ("rozpiska", "km_kóty", "km_koty")):
                signals["callouts"].append({"layer": layer, "text": t[:300]})
    # Dedup
    def dedup(lst, key):
        seen = set()
        out = []
        for d in lst:
            k = (d[key], d.get("layer", ""))
            if k not in seen:
                seen.add(k)
                out.append(d)
        return out
    signals["s_codes_called_out"] = dedup(signals["s_codes_called_out"], "code")
    signals["pozn_refs"] = dedup(signals["pozn_refs"], "ref")
    return signals


def main() -> None:
    files = sorted(DXF_DIR.rglob("*.dxf"))
    out = {
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_generated_by": "tools/cev_dxf_full_text_dump.py",
        "_purpose": (
            "Exhaustive ezdxf walk of all DXFs — dumps every TEXT/MTEXT/INSERT/DIMENSION "
            "per layer with MTEXT format-code decoding. Replaces lossy pypdf path for "
            "drawing content extraction."
        ),
        "files_processed": len(files),
        "per_dxf": {},
    }
    for f in files:
        name = f.name
        rel = str(f.relative_to(ROOT))
        print(f"  parsing {name} ...", flush=True)
        data = extract_dxf_text(f)
        signals = harvest_signals(data)
        # Compact storage: keep signals + per-layer text counts; full text only
        # for layers that look semantic
        semantic_layers = {
            l: entries
            for l, entries in data["text_per_layer"].items()
            if any(k in l.lower() for k in ("tabulka", "legend", "rozpiska", "kóty", "koty", "popisy", "pozn", "skladb", "materi"))
            or any("S0" in e["text"] or "POZN" in e["text"].upper() for e in entries)
        }
        out["per_dxf"][name] = {
            "dxf_path": rel,
            "n_total_text_entities": sum(len(v) for v in data["text_per_layer"].values()),
            "n_total_inserts": sum(len(v) for v in data["inserts_per_layer"].values()),
            "n_total_dimensions": sum(len(v) for v in data["dimensions_per_layer"].values()),
            "semantic_layers_text": semantic_layers,
            "signals": signals,
        }
    # Cross-DXF aggregation
    all_s_codes = defaultdict(list)
    all_pozn = defaultdict(list)
    for name, fd in out["per_dxf"].items():
        for s in fd["signals"]["s_codes_called_out"]:
            all_s_codes[s["code"]].append({"dxf": name, "layer": s["layer"], "context": s["context"]})
        for p in fd["signals"]["pozn_refs"]:
            all_pozn[p["ref"]].append({"dxf": name, "layer": p["layer"], "context": p["context"]})
    out["aggregated"] = {
        "s_codes_by_dxf": {k: v[:6] for k, v in sorted(all_s_codes.items())},
        "pozn_refs_by_dxf": {k: v[:6] for k, v in sorted(all_pozn.items())},
        "s_codes_total_unique": len(all_s_codes),
        "pozn_refs_total_unique": len(all_pozn),
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(json.dumps({
        "files_processed": len(files),
        "output": str(OUT.relative_to(ROOT)),
        "s_codes_unique_total": len(all_s_codes),
        "s_codes_distribution": {k: len({i["dxf"] for i in v}) for k, v in sorted(all_s_codes.items())},
        "pozn_refs_unique_total": len(all_pozn),
        "pozn_refs_distribution": {k: len({i["dxf"] for i in v}) for k, v in sorted(all_pozn.items())},
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
