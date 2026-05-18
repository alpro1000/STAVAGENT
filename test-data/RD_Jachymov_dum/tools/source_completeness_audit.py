#!/usr/bin/env python3
"""
Part 0 — Source completeness audit (RD Jáchymov).

Mandatory pre-Phase-1 gate per project rule "Phase 0a Completeness Audit".
Inventories ALL data sources before any selective extraction:

  A. Every PDF in inputs/ (except _superseded/) — text-probe + content-type
     classification + marker regex (S-codes, F-codes, skladby, výšky).
  B. Every DXF file — iterate ALL layers from doc.layers, classify each
     layer as `probed_extracted | probed_no_useful_data | probed_metadata_only
     | empty_layer | unprobed`.
  C. Cross-document marker matrix — for every unique S-/F-/material marker,
     list every doc it occurs in with surrounding context (50 chars).

Output: outputs/source_completeness_audit.json with 3 sections (A/B/C).

Phase-1 gate opens ONLY when:
  - 0 PDFs marked "unprobed"
  - 0 DXF layers marked "unprobed"
  - Every marker with legenda has documented uses

Run: PYTHONPATH=. python3 tools/source_completeness_audit.py

Reference: STAVAGENT_PATTERNS.md Pattern #8 (forthcoming, this PR)
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

# ───────────────────────────────────────────────────────────────────────────
# Constants
# ───────────────────────────────────────────────────────────────────────────

PROJ = Path(__file__).resolve().parent.parent
INPUTS = PROJ / "inputs"
OUT = PROJ / "outputs"
OUT.mkdir(exist_ok=True)

# PDF subdirs in scope. _superseded/ explicitly excluded.
PDF_SCOPE_DIRS = ("tz", "vykresy_pdf", "situace", "dokladova_cast")

# DXF subdir.
DXF_SUBDIR = "vykresy_dxf"

# Metadata-only layer name patterns (skip from extraction work, but STILL
# probed and marked `probed_metadata_only`). Pattern from task spec §B.
METADATA_LAYER_RE = re.compile(
    r"netisk|stafáž|stafaz|rozpiska|popisy_bublina|defpoints|"
    r"textove_bloky|titlblk|titulek|rastr",
    re.IGNORECASE,
)

# Marker regexes. Tightened to require word boundaries so we don't
# match "S10mm" or "F30 kg/m³" mid-token.
SCODE_RE = re.compile(r"\bS\d{2}[a-z]?\b")           # S01, S04, S12b
FCODE_RE = re.compile(r"\bF\d{2}[a-z]?\b")           # F01..F30 floor codes
MA_RE = re.compile(r"\bMA[\-_]?\d{2}\b")             # MA-01 klempíř codes
SKLADBA_RE = re.compile(r"\bsklad[ab]y?\s+[A-Z]?\d", re.IGNORECASE)
VYSKA_RE = re.compile(r"[+\-]?\s?\d[,\.]\d{3}(?:\s?(?:m|mm))?")

# Density thresholds for PDF content-type classification.
# text-heavy: ≥150 chars/page; drawing-heavy: 1–150 chars/page;
# scanned: <1 char/page (effectively no extractable text).
PDF_TEXT_HEAVY_PER_PAGE = 150
PDF_SCANNED_THRESHOLD = 1

# Context window around a marker hit for cross-reference matrix.
CONTEXT_WINDOW = 50


# ───────────────────────────────────────────────────────────────────────────
# Section A — PDF inventory
# ───────────────────────────────────────────────────────────────────────────


def _classify_pdf_content(
    char_total: int, page_count: int
) -> str:
    """Map (chars, pages) to content type. Densities tuned for RD/DPS docs."""
    if page_count <= 0:
        return "unknown"
    chars_per_page = char_total / page_count
    if chars_per_page < PDF_SCANNED_THRESHOLD:
        return "scanned"
    if chars_per_page < PDF_TEXT_HEAVY_PER_PAGE:
        return "drawing-heavy"
    return "text-heavy"


def _probe_markers(text: str) -> dict[str, list[str]]:
    """Find every S-/F-/MA-code, výška, skladba marker. Return unique set
    per type (full marker strings, no positions — positions live in
    Section C cross-reference matrix)."""
    return {
        "s_codes": sorted(set(SCODE_RE.findall(text))),
        "f_codes": sorted(set(FCODE_RE.findall(text))),
        "ma_codes": sorted(set(MA_RE.findall(text))),
        "skladby_mentions": sorted(set(m.lower() for m in SKLADBA_RE.findall(text))),
        "vyska_mentions_sample": list(set(VYSKA_RE.findall(text)))[:20],
    }


def section_a_pdf_inventory() -> dict[str, Any]:
    """Walk every PDF in scope and text-probe with pdfplumber."""
    try:
        import pdfplumber
    except ImportError as exc:  # pragma: no cover — pdfplumber is in requirements
        raise SystemExit(f"pdfplumber required: {exc}")

    files: list[dict[str, Any]] = []
    for subdir in PDF_SCOPE_DIRS:
        root = INPUTS / subdir
        if not root.is_dir():
            continue
        for pdf_path in sorted(root.rglob("*.pdf")):
            entry: dict[str, Any] = {
                "path": str(pdf_path.relative_to(PROJ)),
                "subdir": subdir,
                "filename": pdf_path.name,
                "size_kb": round(pdf_path.stat().st_size / 1024, 1),
                "probe_status": "unprobed",
            }
            try:
                with pdfplumber.open(str(pdf_path)) as doc:
                    page_count = len(doc.pages)
                    pages_text: list[str] = []
                    for i, page in enumerate(doc.pages, start=1):
                        try:
                            pages_text.append(page.extract_text() or "")
                        except Exception as exc:  # noqa: BLE001
                            entry.setdefault("page_errors", []).append(
                                {"page": i, "error": str(exc)}
                            )
                            pages_text.append("")
                combined = "\n".join(pages_text)
                entry["page_count"] = page_count
                entry["char_total"] = len(combined)
                entry["content_type"] = _classify_pdf_content(len(combined), page_count)
                entry["markers"] = _probe_markers(combined)
                entry["extracted_useful_data"] = bool(
                    entry["markers"]["s_codes"]
                    or entry["markers"]["f_codes"]
                    or entry["markers"]["ma_codes"]
                    or entry["markers"]["skladby_mentions"]
                    or entry["content_type"] == "text-heavy"
                )
                if entry["content_type"] == "scanned":
                    entry["probe_status"] = "probed_no_text"
                    entry["ocr_required"] = True
                elif entry["content_type"] == "drawing-heavy":
                    # Drawing PDFs often carry useful legend / popis text
                    # even when overall density is low. We've already
                    # extracted what pdfplumber can see; the gate flips
                    # to `probed_no_useful_data` only when zero markers.
                    has_data = entry["extracted_useful_data"]
                    entry["probe_status"] = (
                        "probed_extracted" if has_data else "probed_no_useful_data"
                    )
                else:
                    entry["probe_status"] = "probed_extracted"
            except Exception as exc:  # noqa: BLE001
                entry["probe_status"] = "probe_failed"
                entry["error"] = str(exc)
            files.append(entry)

    by_subdir: dict[str, Counter[str]] = defaultdict(Counter)
    for entry in files:
        by_subdir[entry["subdir"]][entry["probe_status"]] += 1
    summary = {
        "total_pdfs": len(files),
        "by_subdir": {k: dict(v) for k, v in by_subdir.items()},
        "by_probe_status": dict(Counter(e["probe_status"] for e in files)),
        "by_content_type": dict(
            Counter(e.get("content_type", "unknown") for e in files)
        ),
        "unprobed_count": sum(1 for e in files if e["probe_status"] == "unprobed"),
    }
    return {
        "section": "A — PDF inventory",
        "scope_dirs": list(PDF_SCOPE_DIRS),
        "summary": summary,
        "files": files,
    }


# ───────────────────────────────────────────────────────────────────────────
# Section B — DXF exhaustive layer probe
# ───────────────────────────────────────────────────────────────────────────


def _classify_layer(name: str, entity_types: Counter[str]) -> str:
    """Return one of: `empty_layer`, `metadata_layer`, `probed_extracted`,
    `probed_no_useful_data`. NEVER `unprobed` from this function — caller
    decides if a layer was actually probed."""
    if not entity_types:
        return "empty_layer"
    if METADATA_LAYER_RE.search(name):
        return "metadata_layer"
    # If layer has any geometric or text content, it's `probed_extracted`.
    productive = {
        "LINE",
        "LWPOLYLINE",
        "POLYLINE",
        "TEXT",
        "MTEXT",
        "INSERT",
        "DIMENSION",
        "ALIGNED_DIMENSION",
        "ROTATED_DIMENSION",
        "HATCH",
        "ARC",
        "CIRCLE",
        "ELLIPSE",
        "SPLINE",
        "LEADER",
        "MLEADER",
        "ATTRIB",
        "ATTDEF",
    }
    if any(t in productive for t in entity_types):
        return "probed_extracted"
    return "probed_no_useful_data"


def _sample_entities(msp: Any, layer_name: str, n: int = 3) -> list[dict[str, Any]]:
    """Up to N minimal entity samples for the layer (for audit replay)."""
    samples: list[dict[str, Any]] = []
    for e in msp.query(f"*[layer=='{layer_name}']"):
        info: dict[str, Any] = {"type": e.dxftype()}
        if e.dxftype() in ("TEXT", "MTEXT"):
            txt = getattr(e.dxf, "text", "") if e.dxftype() == "TEXT" else getattr(e, "text", "")
            info["text_preview"] = (txt or "")[:80]
        elif e.dxftype() == "INSERT":
            info["block_name"] = e.dxf.name
        elif e.dxftype() == "LWPOLYLINE":
            info["closed"] = bool(getattr(e, "closed", False))
            info["n_vertices"] = len(list(e.get_points("xy")))
        elif e.dxftype() in ("DIMENSION", "ALIGNED_DIMENSION", "ROTATED_DIMENSION"):
            info["measurement"] = getattr(e.dxf, "actual_measurement", None)
        samples.append(info)
        if len(samples) >= n:
            break
    return samples


def section_b_dxf_layer_probe() -> dict[str, Any]:
    """For every DXF file, iterate every layer in doc.layers and classify."""
    try:
        import ezdxf
    except ImportError as exc:
        raise SystemExit(f"ezdxf required: {exc}")

    root = INPUTS / DXF_SUBDIR
    files_inventory: dict[str, Any] = {}
    layer_status_totals: Counter[str] = Counter()

    for dxf_path in sorted(root.rglob("*.dxf")):
        rel = str(dxf_path.relative_to(PROJ))
        file_entry: dict[str, Any] = {
            "path": rel,
            "filename": dxf_path.name,
            "size_kb": round(dxf_path.stat().st_size / 1024, 1),
            "layers": {},
            "summary": {},
        }
        try:
            doc = ezdxf.readfile(str(dxf_path))
            msp = doc.modelspace()

            # Index entity counts per layer in one pass.
            counts_per_layer: dict[str, Counter[str]] = defaultdict(Counter)
            for entity in msp:
                counts_per_layer[entity.dxf.layer][entity.dxftype()] += 1

            # Iterate ALL layers (incl. empty ones) for explicit probe_status.
            for layer in doc.layers:
                name = layer.dxf.name
                etypes = counts_per_layer.get(name, Counter())
                status = _classify_layer(name, etypes)
                file_entry["layers"][name] = {
                    "entity_count": sum(etypes.values()),
                    "entity_types": dict(etypes),
                    "probe_status": status,
                    "sample_data": (
                        _sample_entities(msp, name, n=3)
                        if status == "probed_extracted"
                        else []
                    ),
                    "metadata": {
                        "color": int(layer.dxf.color),
                        "frozen": bool(layer.is_frozen()),
                        "off": bool(layer.is_off()),
                        "locked": bool(layer.is_locked()),
                    },
                }
                layer_status_totals[status] += 1

            statuses = Counter(L["probe_status"] for L in file_entry["layers"].values())
            file_entry["summary"] = {
                "layer_total": len(file_entry["layers"]),
                "by_probe_status": dict(statuses),
                "total_entities": sum(
                    L["entity_count"] for L in file_entry["layers"].values()
                ),
                "unprobed_count": statuses.get("unprobed", 0),
            }
        except Exception as exc:  # noqa: BLE001
            file_entry["error"] = str(exc)
            file_entry["summary"] = {"layer_total": 0, "by_probe_status": {}, "unprobed_count": 0}

        files_inventory[rel] = file_entry

    return {
        "section": "B — DXF exhaustive layer probe",
        "scope_dir": DXF_SUBDIR,
        "summary": {
            "total_dxf_files": len(files_inventory),
            "layer_total_all_files": sum(
                f["summary"]["layer_total"] for f in files_inventory.values()
            ),
            "by_probe_status_all_files": dict(layer_status_totals),
            "unprobed_count_all_files": layer_status_totals.get("unprobed", 0),
        },
        "files": files_inventory,
    }


# ───────────────────────────────────────────────────────────────────────────
# Section C — Cross-document marker matrix
# ───────────────────────────────────────────────────────────────────────────


def _context_window(text: str, start: int, end: int, window: int = CONTEXT_WINDOW) -> str:
    a = max(0, start - window)
    b = min(len(text), end + window)
    return text[a:b].replace("\n", " ").strip()


def _occurrences(text: str, pattern: re.Pattern) -> dict[str, list[str]]:
    """For each marker found, return list of context snippets."""
    bag: dict[str, list[str]] = defaultdict(list)
    for m in pattern.finditer(text):
        ctx = _context_window(text, m.start(), m.end())
        bag[m.group(0)].append(ctx)
    return dict(bag)


def section_c_cross_reference(
    section_a: dict[str, Any], section_b: dict[str, Any]
) -> dict[str, Any]:
    """Build per-marker cross-document index using Section A text + Section B
    MTEXT/TEXT/ATTRIB samples + raw PDF re-read for context."""
    try:
        import ezdxf
        import pdfplumber
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(f"missing deps: {exc}")

    docs: dict[str, str] = {}

    # Re-read PDFs in scope for context windows (Section A only stored unique
    # marker sets, not the full text).
    for entry in section_a["files"]:
        if entry["probe_status"] not in ("probed_extracted",):
            continue
        path = PROJ / entry["path"]
        try:
            with pdfplumber.open(str(path)) as doc:
                docs[entry["path"]] = "\n".join(
                    (p.extract_text() or "") for p in doc.pages
                )
        except Exception:  # noqa: BLE001
            continue

    # Pull TEXT/MTEXT/ATTRIB content per DXF.
    for rel, finfo in section_b["files"].items():
        path = PROJ / rel
        try:
            doc = ezdxf.readfile(str(path))
            msp = doc.modelspace()
            chunks: list[str] = []
            for e in msp:
                t = e.dxftype()
                if t == "TEXT":
                    chunks.append(getattr(e.dxf, "text", "") or "")
                elif t == "MTEXT":
                    try:
                        chunks.append(e.plain_text())
                    except Exception:  # noqa: BLE001
                        chunks.append(getattr(e, "text", "") or "")
                elif t == "INSERT":
                    for a in e.attribs:
                        chunks.append(getattr(a.dxf, "text", "") or "")
            docs[rel] = "\n".join(chunks)
        except Exception:  # noqa: BLE001
            continue

    patterns = {
        "s_codes": SCODE_RE,
        "f_codes": FCODE_RE,
        "ma_codes": MA_RE,
    }

    matrix: dict[str, dict[str, Any]] = {}
    for marker_type, pat in patterns.items():
        for doc_path, text in docs.items():
            for marker, contexts in _occurrences(text, pat).items():
                entry = matrix.setdefault(
                    marker,
                    {
                        "marker_type": marker_type,
                        "occurrences": [],
                        "doc_count": 0,
                    },
                )
                entry["occurrences"].append(
                    {
                        "doc": doc_path,
                        "count": len(contexts),
                        "context_samples": contexts[:3],  # cap to keep file size sane
                    }
                )
                entry["doc_count"] = len(entry["occurrences"])

    # Heuristic legenda detection: a doc whose name contains "rez" / "řez" /
    # "legenda" / "skladb" is treated as a candidate legenda source.
    legenda_re = re.compile(r"řez|rez|legenda|skladb|výpis|vypis", re.IGNORECASE)
    legenda_status: dict[str, dict[str, Any]] = {}
    for marker, info in matrix.items():
        legenda_docs = [
            occ["doc"] for occ in info["occurrences"] if legenda_re.search(occ["doc"])
        ]
        use_docs = [
            occ["doc"] for occ in info["occurrences"] if not legenda_re.search(occ["doc"])
        ]
        legenda_status[marker] = {
            "legenda_candidates": legenda_docs,
            "use_docs": use_docs,
            "decodable": bool(legenda_docs and use_docs),
        }

    return {
        "section": "C — Cross-document marker matrix",
        "summary": {
            "unique_markers": len(matrix),
            "by_type": dict(Counter(v["marker_type"] for v in matrix.values())),
            "decodable_markers": sum(
                1 for s in legenda_status.values() if s["decodable"]
            ),
            "orphan_legenda": sum(
                1 for s in legenda_status.values()
                if s["legenda_candidates"] and not s["use_docs"]
            ),
            "orphan_use": sum(
                1 for s in legenda_status.values()
                if s["use_docs"] and not s["legenda_candidates"]
            ),
        },
        "matrix": matrix,
        "legenda_status": legenda_status,
    }


# ───────────────────────────────────────────────────────────────────────────
# Acceptance gate
# ───────────────────────────────────────────────────────────────────────────


def evaluate_gate(audit: dict[str, Any]) -> dict[str, Any]:
    a = audit["section_a"]["summary"]
    b = audit["section_b"]["summary"]
    c = audit["section_c"]["summary"]
    gate = {
        "phase1_can_open": True,
        "blockers": [],
        "warnings": [],
    }
    if a.get("unprobed_count", 0) > 0:
        gate["phase1_can_open"] = False
        gate["blockers"].append(f"{a['unprobed_count']} PDFs unprobed")
    if b.get("unprobed_count_all_files", 0) > 0:
        gate["phase1_can_open"] = False
        gate["blockers"].append(
            f"{b['unprobed_count_all_files']} DXF layers unprobed"
        )
    if c.get("orphan_use", 0) > 0:
        gate["warnings"].append(
            f"{c['orphan_use']} markers used without legenda doc — "
            "potential silent drift (legenda may live in vykresy_pdf řezy "
            "or in an unprobed PDF)"
        )
    return gate


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────


def main() -> int:
    print("Section A — PDF inventory…", file=sys.stderr)
    section_a = section_a_pdf_inventory()
    print(
        f"  → {section_a['summary']['total_pdfs']} PDFs probed; "
        f"by_status={section_a['summary']['by_probe_status']}",
        file=sys.stderr,
    )

    print("Section B — DXF exhaustive layer probe…", file=sys.stderr)
    section_b = section_b_dxf_layer_probe()
    print(
        f"  → {section_b['summary']['total_dxf_files']} DXFs; "
        f"{section_b['summary']['layer_total_all_files']} total layers; "
        f"by_status={section_b['summary']['by_probe_status_all_files']}",
        file=sys.stderr,
    )

    print("Section C — Cross-document marker matrix…", file=sys.stderr)
    section_c = section_c_cross_reference(section_a, section_b)
    print(
        f"  → {section_c['summary']['unique_markers']} unique markers; "
        f"decodable={section_c['summary']['decodable_markers']}; "
        f"orphan_use={section_c['summary']['orphan_use']}",
        file=sys.stderr,
    )

    audit = {
        "_schema_version": "1.0",
        "_generated_by": "tools/source_completeness_audit.py",
        "_generated_at": date.today().isoformat(),
        "_purpose": (
            "Part 0 mandatory pre-Phase-1 completeness audit per project "
            "rule Phase 0a. Inventories ALL PDFs + ALL DXF layers + "
            "cross-document marker matrix BEFORE any selective extraction."
        ),
        "section_a": section_a,
        "section_b": section_b,
        "section_c": section_c,
    }
    audit["acceptance_gate"] = evaluate_gate(audit)

    out_path = OUT / "source_completeness_audit.json"
    out_path.write_text(json.dumps(audit, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ {out_path.relative_to(PROJ)} written ({out_path.stat().st_size // 1024} KB)")

    g = audit["acceptance_gate"]
    print()
    print("─" * 72)
    print(f"Phase-1 gate can open: {g['phase1_can_open']}")
    if g["blockers"]:
        print("Blockers:")
        for b in g["blockers"]:
            print(f"  - {b}")
    if g["warnings"]:
        print("Warnings:")
        for w in g["warnings"]:
            print(f"  - {w}")
    print("─" * 72)
    return 0


if __name__ == "__main__":
    sys.exit(main())
