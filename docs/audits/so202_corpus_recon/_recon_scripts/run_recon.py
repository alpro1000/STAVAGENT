"""
SO202 corpus RECON runner — read-only. Runs the REAL Core Engine recognition +
extraction code on every file in test-data/SO_202_D6_OV_Z/ and records, per file:
  - type recognition (format_detector + document_classifier + analyze doc-type)
  - what the parser extracts (analyze regex params / extract_tz_fields / PDFParser
    tables / KROSParser+xc4 for XML)
  - text density per page (to flag graphic/sparse drawings)
No production code is modified. Results → recon_results.json (incremental writes).

Invocation faithfulness: for PDFs the canonical page-marked text is produced exactly
like document._extract_pdf_text, then the tools' own internal functions are called on
it (document._extract_parameters / _detect_doc_type, extract_tz_fields(text=...)).
This equals the MCP entrypoints minus the base64/tempfile transport.
"""
from __future__ import annotations
import os, sys, json, time, asyncio, traceback
from pathlib import Path

CB = "/home/user/STAVAGENT/concrete-agent/packages/core-backend"
sys.path.insert(0, CB)
CORPUS = Path("/home/user/STAVAGENT/test-data/SO_202_D6_OV_Z")
OUT = Path("/home/user/STAVAGENT/docs/audits/so202_corpus_recon/_recon_scripts/recon_results.json")
OUT.parent.mkdir(parents=True, exist_ok=True)

import pdfplumber
import xml.etree.ElementTree as ET

# Real engines
from app.parsers import format_detector
from app.services import document_classifier as dc
from app.parsers.pdf_parser import PDFParser
from app.parsers.kros_parser import KROSParser
from app.parsers.xc4_parser import parse_xml_tree as xc4_parse_tree
import app.mcp.tools.document as docmod
import app.mcp.tools.extract_tz_fields as etf
import app.mcp.tools.detect_object_type as dot

RESULTS = {"meta": {}, "files": [], "errors": []}

def save():
    OUT.write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding="utf-8")

def pdf_text_and_stats(path: Path):
    """Replicates document._extract_pdf_text output + per-page char counts (1 open)."""
    parts, per_page, ntables = [], [], 0
    npages = 0
    with pdfplumber.open(str(path)) as pdf:
        npages = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            t = page.extract_text() or ""
            per_page.append(len(t))
            if t.strip():
                parts.append(f"--- PAGE {i+1} ---\n{t}")
    full = "\n\n".join(parts)
    return full, npages, per_page

def analyze_params(text: str):
    """document._extract_parameters(text,'all') aggregated by type."""
    params = docmod._extract_parameters(text, "all")
    by_type = {}
    for p in params:
        by_type.setdefault(p["type"], [])
        if p["value"] not in by_type[p["type"]]:
            by_type[p["type"]].append(p["value"])
    return {"total": len(params), "unique_by_type": {k: v for k, v in by_type.items()}}

def classify(filename: str, text: str):
    enh = dc.classify_document_enhanced(filename, text)
    ci = enh["classification"]
    return {
        "category": ci.category.value,
        "sub_type": ci.sub_type.value if ci.sub_type else None,
        "confidence": ci.confidence,
        "method": ci.method,
        "so_code": enh.get("so_code"),
        "construction_type": enh.get("construction_type"),
        "is_non_construction": enh.get("is_non_construction"),
        "section_ids": enh.get("section_ids", [])[:8],
        "detected_keywords": (ci.detected_keywords or [])[:8],
    }

def run_pdf(path: Path):
    rec = {"filename": path.name, "ext": ".pdf", "size_bytes": path.stat().st_size}
    t0 = time.time()
    try:
        text, npages, per_page = pdf_text_and_stats(path)
        rec["pages"] = npages
        rec["total_chars"] = len(text)
        rec["chars_per_page_summary"] = {
            "min": min(per_page) if per_page else 0,
            "max": max(per_page) if per_page else 0,
            "mean": round(sum(per_page)/len(per_page), 1) if per_page else 0,
            "pages_under_120_chars": sum(1 for c in per_page if c < 120),
        }
        rec["density_flag"] = ("graphic_sparse_text" if (per_page and
            sum(1 for c in per_page if c < 120) >= max(1, npages*0.6)) else "text_rich")
        # --- type recognition ---
        rec["format_detector"] = format_detector.detect_format(str(path)).value
        rec["classifier"] = classify(path.name, text)
        rec["analyze_doc_type"] = docmod._detect_doc_type(path.name, text[:2000])
        # --- analyze_construction_document params (regex, conf 1.0) ---
        rec["analyze_params"] = analyze_params(text)
        # --- PDFParser (budget table -> positions) ---
        try:
            pres = PDFParser().parse(path)
            rec["pdfparser"] = {
                "positions": len(pres.get("positions", [])),
                "tables_found": pres.get("document_info", {}).get("tables_found"),
                "diag": {k: pres.get("diagnostics", {}).get(k) for k in
                         ("raw_total", "normalized_total", "skipped_total", "format")},
            }
        except Exception as e:
            rec["pdfparser"] = {"error": f"{type(e).__name__}: {e}"}
        rec["secs"] = round(time.time()-t0, 1)
    except Exception as e:
        rec["error"] = f"{type(e).__name__}: {e}"
        RESULTS["errors"].append({"file": path.name, "tb": traceback.format_exc()[-1500:]})
    return rec, (text if 'text' in dict(rec) or True else "")

async def run_tz_fields(text: str, filename: str):
    out = await etf.extract_tz_fields(text=text, filename=filename)
    obj = out.get("object", {})
    res = {
        "object_code": obj.get("object_code"),
        "object_name": obj.get("object_name"),
        "charakteristika": (obj.get("charakteristika") or "")[:300],
        "needs_verify": obj.get("needs_verify"),
        "sections_found": out.get("_extraction_meta", {}).get("sections_found"),
        "unbound_concrete_classes": out.get("_extraction_meta", {}).get("unbound_concrete_classes", [])[:20],
        "n_elements": len(out.get("elements", [])),
        "elements": [{"name": e["name"], "concrete_class": e["concrete_class"],
                      "volume_m3": e["volume_m3"], "needs_verify": e["needs_verify"]}
                     for e in out.get("elements", [])][:40],
    }
    # chain detect_object_type on name + charakteristika
    if obj.get("object_name") or obj.get("charakteristika"):
        dt = await dot.detect_object_type(obj.get("object_name") or "", obj.get("charakteristika") or "")
        res["detect_object_type"] = {"object_type": dt.get("object_type"),
                                     "verified": dt.get("verified"), "_source": dt.get("_source")}
    return res

def run_xml(path: Path):
    rec = {"filename": path.name, "ext": ".xml", "size_bytes": path.stat().st_size}
    try:
        tree = ET.parse(str(path)); root = tree.getroot()
        def loc(t): return t.split('}')[-1] if t else t
        polozka_lc = sum(1 for e in root.iter() if loc(e.tag) == "polozka")
        polozka_uc = sum(1 for e in root.iter() if loc(e.tag) == "Polozka")
        rec["raw_polozka_lower"] = polozka_lc
        rec["raw_Polozka_upper"] = polozka_uc
        rec["format_detector"] = format_detector.detect_format(str(path)).value
        rec["classifier"] = classify(path.name, "")
        # KROSParser (production path)
        kres = KROSParser().parse(path)
        rec["krosparser"] = {
            "kros_format": kres.get("document_info", {}).get("kros_format"),
            "positions": len(kres.get("positions", [])),
            "diag": kres.get("diagnostics", {}),
        }
        # Direct AspeEsticon xc4 parser (what the dedicated parser WOULD yield)
        try:
            xpos, xdiag = xc4_parse_tree(root)
            rec["xc4_direct"] = {"positions": len(xpos),
                                 "skipped": len(xdiag.get("skipped", [])) if isinstance(xdiag, dict) else None}
            rec["_xc4_positions"] = xpos  # keep for cross-check (trimmed before save)
        except Exception as e:
            rec["xc4_direct"] = {"error": f"{type(e).__name__}: {e}"}
        save()
    except Exception as e:
        rec["error"] = f"{type(e).__name__}: {e}"
        RESULTS["errors"].append({"file": path.name, "tb": traceback.format_exc()[-1500:]})
    return rec

# ---- main ----
files = sorted(os.listdir(CORPUS))
RESULTS["meta"] = {"corpus": str(CORPUS), "n_files": len(files), "files": files,
                   "generated": time.strftime("%Y-%m-%d %H:%M:%S")}
save()
print(f"Corpus: {len(files)} files")

# order: xml + small pdfs first, big pdfs (TZ 104p, statika 84p) last
def sort_key(fn):
    p = CORPUS/fn
    big = fn in ("202_01_TechnickaZprava.pdf", "202_31_StatickyVypocet.pdf")
    return (1 if big else 0, fn)

tz_text_cache = {}
for fn in sorted(files, key=sort_key):
    path = CORPUS/fn
    if path.is_dir():
        continue
    ext = path.suffix.lower()
    print(f"  -> {fn} ({path.stat().st_size} B)")
    if ext == ".pdf":
        rec, _ = run_pdf(path)
        # extract_tz_fields for TZ-ish docs (TZ + statika)
        if rec.get("classifier", {}).get("category") == "TZ" or "TechnickaZprava" in fn or "Staticky" in fn:
            try:
                text, _n, _pp = pdf_text_and_stats(path)
                rec["extract_tz_fields"] = asyncio.run(run_tz_fields(text, fn))
            except Exception as e:
                rec["extract_tz_fields"] = {"error": f"{type(e).__name__}: {e}"}
        RESULTS["files"].append(rec); save()
    elif ext == ".xml":
        rec = run_xml(path)
        RESULTS["files"].append(rec); save()
    else:
        # the marker file "1" and anything else
        try:
            raw = path.read_bytes()[:200]
            rec = {"filename": fn, "ext": ext or "(none)", "size_bytes": path.stat().st_size,
                   "raw_head": raw.decode("utf-8", "replace")}
        except Exception as e:
            rec = {"filename": fn, "ext": ext, "error": str(e)}
        RESULTS["files"].append(rec); save()

print("DONE. results ->", OUT)
save()
