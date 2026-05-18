#!/usr/bin/env python3
"""
Phase 0a Completeness Audit — MANDATORY before Phase 0b §3.1.

Per N=5 RD Jáchymov pilot 6 silent drifts: agent default extraction is subset
(extract what's obvious), not exhaustive. This audit inventories ALL data
sources (PDFs, DXF layers, cross-document markers) and gates Phase 1 generation.

Output: outputs/source_completeness_audit.json

Sections:
  A. PDF documents inventory (TZ + výkresy + situace + dokladová část)
     Per PDF: filename, pages, extractable text length, content type, useful data
  B. DXF exhaustive layer probe (ALL layers per file, not subset)
     Per layer: entity_count, entity_types, sample, probe_status
  C. Cross-document marker detection (S-codes, F-codes, materials)
     Per marker: legenda location + uses, decodability assessment

Gate: Phase 0b §3.1 opens ONLY if audit shows 0 unprobed sources.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import ezdxf
import pypdf

PROJ = Path(__file__).resolve().parent.parent
INPUTS = PROJ / "inputs"
OUT = PROJ / "outputs"
TARGET = OUT / "source_completeness_audit.json"

# ───────────────────────────────────────────────────────────────────────────
# Marker patterns

SCODE_RE = re.compile(r"\bS(\d{1,2}[a-z]?)\b")
FCODE_RE = re.compile(r"\bF(\d{1,2}[a-z]?)\b")
KAPITOLA_RE = re.compile(r"\b(HSV|PSV|VRN|TZB|M-)-?\s*\d+\b")
MATERIAL_RE = re.compile(
    r"\b(?:EPS\s*\d+|PIR\s*\d+|XPS\s*\d+|MW\s*\d+|"
    r"C\s*\d+/\d+|S\s*235|S\s*355|B\s*500B|"
    r"IPE\s*\d+|HEA\s*\d+|HEB\s*\d+|IPN\s*\d+|UPE\s*\d+|"
    r"Porotherm\s*\d+|Ytong\s*\d+)\b",
    re.IGNORECASE,
)
SKLADBA_LEGEND_RE = re.compile(r"^\s*S\s*0?\d{1,2}[a-z]?\b", re.MULTILINE | re.IGNORECASE)
METADATA_LAYER_PATTERNS = re.compile(
    r"netisk|defpoints|rozpiska|popisy?[\s_]?bubliny|severka|"
    r"hlavn[íi]\s*projektant|projektov[ýy]\s*stupe[ňn]|datum$|"
    r"investor|razítko|^_\s|geometrie$",
    re.IGNORECASE,
)

# ───────────────────────────────────────────────────────────────────────────
# Section A — PDF inventory

def detect_pdf_content_type(text: str, n_pages: int) -> str:
    """Classify PDF as text-heavy / drawing-heavy / scanned-image / mixed."""
    if not text or len(text) < 50:
        return "scanned_image_or_empty"
    chars_per_page = len(text) / max(n_pages, 1)
    if chars_per_page > 1500:
        return "text_heavy"
    elif chars_per_page > 300:
        return "mixed"
    else:
        return "drawing_heavy"


def probe_pdf(pdf_path: Path) -> dict:
    """Extract text + classify + scan for useful markers per PDF."""
    record = {
        "path": str(pdf_path.relative_to(PROJ)),
        "size_bytes": pdf_path.stat().st_size,
    }
    try:
        reader = pypdf.PdfReader(str(pdf_path))
    except Exception as e:
        record["error"] = f"{type(e).__name__}: {str(e)[:120]}"
        record["probe_status"] = "error_unreadable"
        return record

    n_pages = len(reader.pages)
    pages_text = []
    for p in reader.pages:
        try:
            pages_text.append(p.extract_text() or "")
        except Exception:
            pages_text.append("")
    text = "\n".join(pages_text)

    record["pages"] = n_pages
    record["chars_extracted"] = len(text)
    record["content_type"] = detect_pdf_content_type(text, n_pages)

    # Probe for markers
    scodes = sorted(set(SCODE_RE.findall(text)))
    fcodes = sorted(set(FCODE_RE.findall(text)))
    materials = sorted(set(MATERIAL_RE.findall(text)))
    record["scodes_found"] = [f"S{c}" for c in scodes]
    record["fcodes_found"] = [f"F{c}" for c in fcodes]
    record["material_markers_found"] = materials[:20]
    record["scodes_count"] = len(scodes)
    record["fcodes_count"] = len(fcodes)

    # Detect skladba legend presence (řez výkresy typically contain S0X legenda)
    legend_lines = SKLADBA_LEGEND_RE.findall(text)
    record["skladba_legend_lines"] = len(legend_lines)
    record["likely_has_skladba_legend"] = len(legend_lines) >= 5

    # Useful data assessment
    useful = []
    if record["chars_extracted"] > 1000:
        useful.append(f"text {record['chars_extracted']} chars extracted")
    if scodes:
        useful.append(f"{len(scodes)} S-codes found: {sorted(scodes)[:5]}{'...' if len(scodes) > 5 else ''}")
    if fcodes:
        useful.append(f"{len(fcodes)} F-codes found")
    if materials:
        useful.append(f"{len(materials)} material markers (EPS/PIR/IPE/HEA/etc.)")
    if record["likely_has_skladba_legend"]:
        useful.append(f"{len(legend_lines)} skladba legend rows detected")

    record["useful_data_summary"] = useful or ["no useful data detected — drawing-heavy or scanned"]

    # Probe status
    if record["chars_extracted"] < 50:
        record["probe_status"] = "scanned_needs_ocr"
    elif record["content_type"] == "drawing_heavy":
        record["probe_status"] = "drawing_heavy_partial_text"
    else:
        record["probe_status"] = "probed_extracted"

    return record


def section_a_pdf_inventory() -> dict:
    """Section A — All PDFs in inputs/ tree."""
    section = {
        "_purpose": "Inventory ALL PDFs in inputs/ tree (NOT just TZ texts). Per PDF: filename, content type, extracted text length, S-codes / F-codes / materials found.",
        "subsections": {},
    }
    pdf_dirs = [
        ("tz", INPUTS / "tz"),
        ("vykresy_pdf", INPUTS / "vykresy_pdf"),
        ("situace", INPUTS / "situace"),
        ("dokladova_cast", INPUTS / "dokladova_cast"),
    ]
    total_pdfs = 0
    total_unprobed = 0
    total_scanned = 0
    for label, base in pdf_dirs:
        if not base.exists():
            section["subsections"][label] = {"_note": f"Directory does not exist: {base}"}
            continue
        files = sorted(base.rglob("*.pdf"))
        records = []
        for f in files:
            rec = probe_pdf(f)
            records.append(rec)
            total_pdfs += 1
            if rec.get("probe_status") == "scanned_needs_ocr":
                total_scanned += 1
            if rec.get("probe_status") == "error_unreadable":
                total_unprobed += 1
        section["subsections"][label] = {
            "n_files": len(records),
            "records": records,
        }
    section["_summary"] = {
        "total_pdfs": total_pdfs,
        "scanned_needs_ocr": total_scanned,
        "unreadable_error": total_unprobed,
        "fully_probed": total_pdfs - total_scanned - total_unprobed,
    }
    return section


# ───────────────────────────────────────────────────────────────────────────
# Section B — DXF exhaustive layer probe

DXF_SOURCES = {
    "dum_DPZ":     INPUTS / "vykresy_dxf" / "260219_dum"  / "RD Jachymov dum _ DPZ _ 10.dxf",
    "dum_situace": INPUTS / "vykresy_dxf" / "260219_dum"  / "RD Jachymov dum _ situace 02.dxf",
    "sklad_DPZ":   INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ DPZ _ 02.dxf",
    "sklad_situace": INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ situace 04.dxf",
}

# Layers known to have been extracted (across all prior phases)
PREV_EXTRACTED = {
    # Phase 0b §3.3 baseline
    "km_tabulka místností", "km_čísla místností", "IP_obrysy místností",
    "SMA_okna", "SM__dveře", "km_kóty",
    # Wall + perimeter
    "SM__03b_tlustá nosné stěny", "SM__02d_tenka další",
    "km_R_návrh_tlustá 2", "km_R_návrh_šrafa", "km_šrafy",
    # Comprehensive extract Part 2
    "km_R_návrh_tlustá", "km_R_návrh_velmi tlustá", "km_R_návrh_velmi tlustá 2",
    "km_R_návrh_šrafa 2",
    # Per Part 1 inventory probes (Part 1 task IP_Výškové kóty, klempířina)
    "IP_Výškové kóty", "MA_klempíř", "SM__ klempířina",
    "SM_kóty bourání", "km Obklady", "SM_kóty",
}


def classify_layer(layer_name: str, entity_count: int, entity_types: dict) -> tuple[str, str]:
    """Classify layer probe_status + extraction priority."""
    if entity_count == 0:
        return "empty_layer", "skip"
    if METADATA_LAYER_PATTERNS.search(layer_name):
        return "probed_metadata_only", "skip"
    has_dim = entity_types.get("DIMENSION", 0) > 0
    has_text = (entity_types.get("MTEXT", 0) + entity_types.get("TEXT", 0)) > 0
    has_geom = (entity_types.get("LWPOLYLINE", 0) + entity_types.get("LINE", 0) + entity_types.get("ARC", 0)) > 0
    has_insert = entity_types.get("INSERT", 0) > 0
    has_hatch = entity_types.get("HATCH", 0) > 0

    if layer_name in PREV_EXTRACTED:
        return "probed_extracted", "covered_in_pipeline"
    # New layers — need extraction effort
    if has_dim and entity_count >= 5:
        return "unprobed", "high_priority_dimensions"
    if has_text and entity_count >= 5:
        return "unprobed", "high_priority_text"
    if has_geom and entity_count >= 30:
        return "unprobed", "medium_priority_geometry"
    if has_insert and entity_count >= 10:
        return "unprobed", "medium_priority_inserts"
    if has_hatch and entity_count >= 10:
        return "unprobed", "low_priority_hatch"
    if has_geom or has_insert:
        return "unprobed", "low_priority"
    return "probed_no_useful_data", "skip"


def sample_layer_data(msp, layer_name: str, max_samples: int = 3) -> list:
    """Extract minimal sample data from layer entities for audit."""
    samples = []
    for e in msp:
        if getattr(e.dxf, "layer", None) != layer_name:
            continue
        typ = e.dxftype()
        info = {"type": typ}
        try:
            if typ == "DIMENSION":
                m = e.get_measurement()
                info["measurement_mm"] = round(float(m), 1) if m is not None else None
            elif typ in ("MTEXT", "TEXT"):
                txt = e.text if typ == "MTEXT" else e.dxf.text
                info["text"] = (txt or "")[:80]
            elif typ == "INSERT":
                info["block_name"] = e.dxf.name
                # Get attributes if any
                try:
                    info["attrs"] = {att.dxf.tag: att.dxf.text for att in e.attribs}
                except Exception:
                    pass
            elif typ == "LWPOLYLINE":
                v = [(round(vv[0], 1), round(vv[1], 1)) for vv in e.vertices()]
                info["n_verts"] = len(v)
                info["closed"] = e.is_closed
                if v:
                    xs = [vv[0] for vv in v]
                    ys = [vv[1] for vv in v]
                    info["bbox_mm"] = (round(max(xs) - min(xs), 1), round(max(ys) - min(ys), 1))
            elif typ == "HATCH":
                try:
                    info["pattern"] = e.dxf.pattern_name
                except Exception:
                    pass
        except Exception as ex:
            info["sample_error"] = str(ex)[:60]
        samples.append(info)
        if len(samples) >= max_samples:
            break
    return samples


def section_b_dxf_layers() -> dict:
    section = {
        "_purpose": "Exhaustive DXF layer probe. Per file, iterate ALL layers (not subset). Per layer: entity_count, entity_types, sample_data, probe_status. 0 unprobed allowed for Phase 1 gate.",
        "subsections": {},
    }
    grand_total_layers = 0
    grand_total_unprobed = 0
    grand_total_extracted = 0
    grand_total_metadata = 0
    grand_total_empty = 0

    for key, path in DXF_SOURCES.items():
        if not path.exists():
            section["subsections"][key] = {"_error": "FILE_NOT_FOUND", "path": str(path)}
            continue
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()
        # Bucket entities by layer (one pass)
        per_layer = defaultdict(Counter)
        for e in msp:
            try:
                per_layer[e.dxf.layer][e.dxftype()] += 1
            except Exception:
                pass

        layers_data = []
        unprobed = 0
        probed_extracted = 0
        metadata = 0
        empty = 0
        for layer_obj in doc.layers:
            lname = layer_obj.dxf.name
            types = dict(per_layer.get(lname, {}))
            n = sum(types.values())
            probe_status, priority = classify_layer(lname, n, types)
            samples = sample_layer_data(msp, lname, max_samples=3) if probe_status == "unprobed" else []
            layer_rec = {
                "name": lname,
                "entity_count": n,
                "entity_types": types,
                "probe_status": probe_status,
                "extraction_priority": priority,
                "sample_data": samples,
            }
            layers_data.append(layer_rec)
            if probe_status == "unprobed":
                unprobed += 1
            elif probe_status == "probed_extracted":
                probed_extracted += 1
            elif probe_status == "probed_metadata_only":
                metadata += 1
            elif probe_status == "empty_layer":
                empty += 1

        section["subsections"][key] = {
            "path": str(path.relative_to(PROJ)),
            "total_layers": len(layers_data),
            "summary": {
                "probed_extracted_in_pipeline": probed_extracted,
                "probed_metadata_only_skip": metadata,
                "empty_layer_skip": empty,
                "unprobed_actionable": unprobed,
            },
            "layers": layers_data,
        }
        grand_total_layers += len(layers_data)
        grand_total_unprobed += unprobed
        grand_total_extracted += probed_extracted
        grand_total_metadata += metadata
        grand_total_empty += empty

    section["_summary"] = {
        "total_layers_across_4_dxf": grand_total_layers,
        "probed_extracted_in_pipeline": grand_total_extracted,
        "probed_metadata_only_skip": grand_total_metadata,
        "empty_layer_skip": grand_total_empty,
        "unprobed_actionable_BLOCKS_PHASE_1": grand_total_unprobed,
    }
    return section


# ───────────────────────────────────────────────────────────────────────────
# Section C — Cross-document marker detection

def collect_text_corpus():
    """Build dict of {source_id: text} across all PDFs + DXF MTEXT."""
    corpus = {}
    # PDFs
    for pdf_path in INPUTS.rglob("*.pdf"):
        try:
            r = pypdf.PdfReader(str(pdf_path))
            t = "\n".join(p.extract_text() or "" for p in r.pages)
            corpus[f"PDF:{pdf_path.relative_to(INPUTS)}"] = t
        except Exception:
            pass
    # DXF MTEXT
    for key, path in DXF_SOURCES.items():
        if not path.exists():
            continue
        try:
            doc = ezdxf.readfile(str(path))
            msp = doc.modelspace()
            chunks = []
            for e in msp:
                try:
                    if e.dxftype() == "MTEXT":
                        chunks.append(e.text or "")
                    elif e.dxftype() == "TEXT":
                        chunks.append(e.dxf.text or "")
                    elif e.dxftype() == "INSERT":
                        for att in e.attribs:
                            chunks.append(att.dxf.text or "")
                except Exception:
                    pass
            corpus[f"DXF:{key}"] = "\n".join(chunks)
        except Exception:
            pass
    return corpus


def section_c_cross_references() -> dict:
    section = {
        "_purpose": "Cross-document marker detection. For each unique S-code / F-code / material marker, identify legenda location (definition) + uses (citations). Marker is decodable if both legenda + uses exist.",
        "markers": {},
    }
    corpus = collect_text_corpus()

    # Collect all markers across all sources
    all_scodes = set()
    all_fcodes = set()
    for sid, text in corpus.items():
        all_scodes.update(SCODE_RE.findall(text))
        all_fcodes.update(FCODE_RE.findall(text))

    # For each S-code, find legenda + uses
    def find_marker_occurrences(marker: str):
        """Return list of (source_id, n_occurrences, has_legend_context, has_use_context)."""
        occ = []
        for sid, text in corpus.items():
            count = sum(1 for _ in re.finditer(rf"\b{re.escape(marker)}\b", text))
            if count == 0:
                continue
            # Heuristic: legenda = marker appears at line-start OR within 200 chars of "skladb" / "legend" / "vrstv" keyword
            legend_indicators = ["skladb", "legend", "vrstv", "obvodov", "podlaha", "strop", "kontaktn", "tepeln"]
            has_legend = False
            for m in re.finditer(rf"\b{re.escape(marker)}\b", text):
                window = text[max(0, m.start() - 100):m.end() + 300]
                if any(k in window.lower() for k in legend_indicators):
                    has_legend = True
                    break
            occ.append({
                "source": sid,
                "count": count,
                "has_legend_context": has_legend,
            })
        return occ

    decodable_count = 0
    undecodable_count = 0
    for sc in sorted(all_scodes, key=lambda x: (len(x), x)):
        marker = f"S{sc}"
        occs = find_marker_occurrences(marker)
        if not occs:
            continue
        has_legend = any(o["has_legend_context"] for o in occs)
        n_uses = sum(o["count"] for o in occs)
        decodable = has_legend and n_uses >= 2
        section["markers"][marker] = {
            "type": "skladba_code",
            "n_total_occurrences": n_uses,
            "n_sources": len(occs),
            "has_legend_in_some_doc": has_legend,
            "decodable": decodable,
            "occurrences": occs,
        }
        if decodable:
            decodable_count += 1
        else:
            undecodable_count += 1

    section["_summary"] = {
        "total_unique_scodes": len(all_scodes),
        "total_unique_fcodes": len(all_fcodes),
        "scodes_decodable": decodable_count,
        "scodes_undecodable_no_legend_or_uses": undecodable_count,
        "fcodes_found": sorted(f"F{c}" for c in all_fcodes),
    }
    return section


# ───────────────────────────────────────────────────────────────────────────
# Main

def main():
    OUT.mkdir(exist_ok=True)
    print("[1/3] Section A — PDF inventory...", file=sys.stderr)
    sec_a = section_a_pdf_inventory()
    print(f"  ✓ {sec_a['_summary']['total_pdfs']} PDFs probed", file=sys.stderr)

    print("[2/3] Section B — DXF exhaustive layer probe...", file=sys.stderr)
    sec_b = section_b_dxf_layers()
    print(f"  ✓ {sec_b['_summary']['total_layers_across_4_dxf']} layers across 4 DXF; "
          f"{sec_b['_summary']['unprobed_actionable_BLOCKS_PHASE_1']} unprobed actionable", file=sys.stderr)

    print("[3/3] Section C — Cross-document markers...", file=sys.stderr)
    sec_c = section_c_cross_references()
    print(f"  ✓ {sec_c['_summary']['total_unique_scodes']} S-codes, "
          f"{sec_c['_summary']['scodes_decodable']} decodable", file=sys.stderr)

    # Gate logic
    blocks_gate = []
    unprobed_pdfs = sum(
        1 for sub in sec_a["subsections"].values()
        if isinstance(sub, dict) and "records" in sub
        for r in sub["records"]
        if r.get("probe_status") in ("scanned_needs_ocr", "error_unreadable")
    )
    if unprobed_pdfs > 0:
        blocks_gate.append(f"{unprobed_pdfs} PDFs need OCR or unreadable")
    if sec_b["_summary"]["unprobed_actionable_BLOCKS_PHASE_1"] > 0:
        blocks_gate.append(
            f"{sec_b['_summary']['unprobed_actionable_BLOCKS_PHASE_1']} DXF layers unprobed actionable"
        )

    audit = {
        "_schema_version": "1.0",
        "_generated_by": "tools/phase0a_completeness_audit.py",
        "_generated_at": str(date.today()),
        "_purpose": (
            "Phase 0a MANDATORY completeness audit before Phase 0b §3.1. "
            "Per N=5 RD Jáchymov pilot 6 silent drifts where data WAS available but extractor "
            "missed. This audit enforces 0 unprobed sources before Phase 1 generation gates open."
        ),
        "_phase_1_gate_status": "BLOCKED" if blocks_gate else "OPEN",
        "_phase_1_gate_blockers": blocks_gate,
        "section_A_pdf_inventory": sec_a,
        "section_B_dxf_layers": sec_b,
        "section_C_cross_document_markers": sec_c,
    }
    TARGET.write_text(json.dumps(audit, indent=2, ensure_ascii=False))
    size = TARGET.stat().st_size
    print(f"\n✓ Wrote {TARGET.relative_to(PROJ)} ({size:,} bytes)", file=sys.stderr)
    print(f"\nPhase 1 gate: {audit['_phase_1_gate_status']}", file=sys.stderr)
    if blocks_gate:
        print("Blockers:", file=sys.stderr)
        for b in blocks_gate:
            print(f"  • {b}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
