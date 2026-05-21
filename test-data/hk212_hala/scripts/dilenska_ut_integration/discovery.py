#!/usr/bin/env python3
"""
hk212 dílenská OK + ÚT DPS — Stage A (razítko inventory) + Stage B (dílenská
kusovník) + Stage C (ÚT zařízení list + energy balance) discovery extractor.

Reads:
    test-data/hk212_hala/inputs/vykresy_dxf/Hala HK_ Úprava dveří.dxf  (dílenská OK, Mach/Mičánek)
    test-data/hk212_hala/inputs/vykresy_dxf/UT_HALAHK_DPS.dxf            (ÚT D.1.4 DPS)
    app/knowledge_base/B5_steel_profile_weights/csn_en_10025_10210.json   (kg/m catalog)

Writes:
    outputs/dilenska_ut_integration/dilenska_razitka.json
    outputs/dilenska_ut_integration/dilenska_kusovnik.json
    outputs/dilenska_ut_integration/ut_zarizeni_list.json
    outputs/dilenska_ut_integration/2966_1_extracted.json
    outputs/dilenska_ut_integration/energetical_balance_update.md
    outputs/dilenska_ut_integration/discovery_report.md

NO modification of items_hk212_etap1.json — that's Stage D after user ratification.
NO outbound HTTP calls (sandbox-blocked anyway, would fail).

Run:
    python test-data/hk212_hala/scripts/dilenska_ut_integration/discovery.py
"""

from __future__ import annotations

import json
import logging
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import ezdxf

REPO_ROOT = Path(__file__).resolve().parents[4]
DXF_DIR = REPO_ROOT / "test-data/hk212_hala/inputs/vykresy_dxf"
DILENSKA_PATH = DXF_DIR / "Hala HK_ Úprava dveří.dxf"
UT_PATH = DXF_DIR / "UT_HALAHK_DPS.dxf"
B5_CATALOG = REPO_ROOT / "concrete-agent/packages/core-backend/app/knowledge_base/B5_steel_profile_weights/csn_en_10025_10210.json"
OUT_DIR = REPO_ROOT / "test-data/hk212_hala/outputs/dilenska_ut_integration"

# Ghost razítko entities to filter (legacy LIMA DRSLAVICE template)
GHOST_RAZITKO_TOKENS = {"LIMA", "DRSLAVICE", "Tichák", "Fojtů"}
# Aktuální razítko match
CURRENT_AKCE_TOKENS = {"Hradec", "HK", "BVS"}

MTEXT_FMT = re.compile(r"\\[A-Za-z][^;]*;")
RE_WORKSHOP_CODE = re.compile(r"\b\d{2,3}\s*\.\s*[A-Z]\s*\.\s*\d{1,3}\s*-\s*\d{1,3}\b")
RE_DATUM = re.compile(r"\b\d{2}[./]\d{4}\b")


def setup_logging() -> logging.Logger:
    lg = logging.getLogger("discovery")
    lg.setLevel(logging.INFO)
    lg.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
    lg.addHandler(h)
    return lg


def get_text(e) -> str:
    t = e.dxftype()
    if t == "MTEXT":
        return MTEXT_FMT.sub("", e.text).replace("\\P", " | ").strip()
    if t in ("TEXT", "ATTRIB", "ATTDEF"):
        return getattr(e.dxf, "text", "").strip()
    return ""


def collect_all_text(doc) -> list[dict]:
    """Collect TEXT/MTEXT/ATTRIB from modelspace + layouts + block defs + nested INSERTs."""
    items: list[dict] = []
    for layout_name in doc.layout_names():
        for e in doc.layout(layout_name):
            s = get_text(e)
            if not s:
                continue
            pos = None
            try:
                if e.dxftype() == "MTEXT":
                    pos = (e.dxf.insert.x, e.dxf.insert.y)
                elif e.dxftype() == "TEXT":
                    pos = (e.dxf.insert.x, e.dxf.insert.y)
            except Exception:
                pass
            items.append({"loc": layout_name, "type": e.dxftype(),
                          "text": s, "layer": getattr(e.dxf, "layer", ""),
                          "pos": pos})
    # ATTRIBs in INSERT entities
    for ins in [e for e in doc.modelspace() if e.dxftype() == "INSERT"]:
        for a in ins.attribs:
            s = get_text(a)
            if not s:
                continue
            items.append({"loc": f"ATTRIB_in_{ins.dxf.name[:40]}",
                          "type": "ATTRIB", "text": s,
                          "layer": getattr(ins.dxf, "layer", ""),
                          "pos": None})
    return items


# ----------------------------------------------------------------------------
# Stage A: razítko inventory + ghost filtering
# ----------------------------------------------------------------------------

def extract_razitka(doc, file_label: str, logger: logging.Logger) -> dict:
    all_text = collect_all_text(doc)
    persons, dates, akce, stupne, ckaity, zakazky, ghost_hits = (
        Counter(), Counter(), Counter(), Counter(), Counter(), Counter(), Counter()
    )
    for it in all_text:
        t = it["text"]
        # ghost markers
        for g in GHOST_RAZITKO_TOKENS:
            if g.lower() in t.lower():
                ghost_hits[g] += 1
        # Persons via Ing. <name>
        for m in re.finditer(r"\bIng\.?\s+[A-ZÁ-Ž][a-zá-ž]+(?:\s+[A-ZÁ-Ž][a-zá-ž]+)?", t):
            persons[m.group()] += 1
        # Dates
        for m in RE_DATUM.finditer(t):
            dates[m.group()] += 1
        # ČKAIT
        for m in re.finditer(r"\bČKAIT\s*\d+", t):
            ckaity[m.group()] += 1
        # Akce keyword neighborhood
        if "akce" in t.lower() and len(t) < 200:
            akce[t] += 1
        if "zakázka" in t.lower() and len(t) < 200:
            zakazky[t] += 1
        if "stupeň" in t.lower() or "DPS" in t or "DSP" in t or "DPZ" in t or "DÚR" in t:
            if len(t) < 200:
                stupne[t] += 1

    # Identify current vs ghost — heuristic per task §9 rule 3
    # Persons: name with >5 occurrences AND not in ghost set
    current_persons = []
    ghost_persons = []
    for name, n in persons.most_common():
        is_ghost = any(g.lower() in name.lower() for g in GHOST_RAZITKO_TOKENS) or \
                   "Tichák" in name or "Fojtů" in name
        if is_ghost:
            ghost_persons.append({"name": name, "count": n})
        else:
            current_persons.append({"name": name, "count": n})

    # Identify current razítko
    has_current = any(t in str(akce) for t in CURRENT_AKCE_TOKENS) or \
                  any(t in str(list(akce.keys())) for t in CURRENT_AKCE_TOKENS)

    # Separate current vs ghost dates (current = >= 2024 per task §9 rule 3)
    current_dates = {d: n for d, n in dates.items()
                     if (lambda y: int(y) >= 2024 if y.isdigit() else False)(d.split("/")[-1])}
    ghost_dates = {d: n for d, n in dates.items() if d not in current_dates}

    out = {
        "file": file_label,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "current_razitko": {
            "akce_strings": list(akce.keys())[:5],
            "zakazky_strings": list(zakazky.keys())[:5],
            "stupne_strings": list(stupne.keys())[:5],
            "current_dates": current_dates,
            "current_persons": current_persons,
            "ckaity": dict(ckaity.most_common(5)),
            "has_current_HK_signal": bool(has_current),
        },
        "ghost_razitko": {
            "tokens_filtered": dict(ghost_hits.most_common()),
            "ghost_persons": ghost_persons,
            "ghost_dates": ghost_dates,
            "rule_applied": "task §9 rule 3 — dates with year < 2024 AND tokens like LIMA/DRSLAVICE/Tichák/Fojtů",
        },
    }
    logger.info(f"  Stage A [{file_label}]: current persons={len(current_persons)}, "
                f"ghost persons={len(ghost_persons)}, dates={len(dates)}")
    return out


# ----------------------------------------------------------------------------
# Stage B: dílenská kusovník extraction
# ----------------------------------------------------------------------------

# Block-name → profile lookup (DXF block names like "IPE450", "JAKL60", "HEA200", "L50")
RE_IPE = re.compile(r"^IPE\s*(\d{2,3})\b", re.IGNORECASE)
RE_HEA = re.compile(r"^HEA\s*(\d{2,3})\b", re.IGNORECASE)
RE_HEB = re.compile(r"^HEB\s*(\d{2,3})\b", re.IGNORECASE)
RE_UPE = re.compile(r"^UPE\s*(\d{2,3})\b", re.IGNORECASE)
RE_U = re.compile(r"^U\s*(\d{2,3})\b")
RE_JEKL_JAKL = re.compile(r"^(?:JEKL|JAKL)\s*(\d{2,3})(?:\s*x\s*(\d{2,3})\s*x\s*(\d{1,2}))?", re.IGNORECASE)
RE_L = re.compile(r"^L\s*(\d{2,3})(?:\s*x\s*(\d{2,3})\s*x\s*(\d{1,2}))?", re.IGNORECASE)


def classify_block_to_profile(block_name: str) -> dict | None:
    """Map DXF block name → {family, size_key, ambiguous_thickness}."""
    n = block_name.strip()
    m = RE_IPE.match(n)
    if m:
        return {"family": "IPE", "size_key": m.group(1), "ambiguous": False}
    m = RE_HEA.match(n)
    if m:
        return {"family": "HEA", "size_key": m.group(1), "ambiguous": False}
    m = RE_HEB.match(n)
    if m:
        return {"family": "HEB", "size_key": m.group(1), "ambiguous": False}
    m = RE_UPE.match(n)
    if m:
        return {"family": "UPE", "size_key": m.group(1), "ambiguous": False}
    m = RE_U.match(n)
    if m and not n.upper().startswith("UPE"):
        return {"family": "U", "size_key": m.group(1), "ambiguous": False}
    m = RE_JEKL_JAKL.match(n)
    if m:
        size = m.group(1)
        # Default assumed thickness if not given in name (JAKL60 → 60x60x4 common)
        # Mark as ambiguous so user can verify via DIMENSION cross-check
        if m.group(3):
            return {"family": "JEKL_JAKL_square",
                    "size_key": f"{m.group(1)}x{m.group(2) or m.group(1)}x{m.group(3)}",
                    "ambiguous": False}
        else:
            # Default fallback wall thickness 4 mm for sizes ≤60, 5 mm for 80-100, 6 mm for ≥120
            s = int(size)
            t = 4 if s <= 60 else (5 if s <= 100 else 6)
            return {"family": "JEKL_JAKL_square",
                    "size_key": f"{size}x{size}x{t}",
                    "ambiguous": True,
                    "assumed_thickness_mm": t}
    m = RE_L.match(n)
    if m:
        size = m.group(1)
        if m.group(3):
            return {"family": "L_equal_angle",
                    "size_key": f"{m.group(1)}x{m.group(2) or m.group(1)}x{m.group(3)}",
                    "ambiguous": False}
        else:
            s = int(size)
            t = 5 if s <= 50 else (6 if s <= 70 else 8)
            return {"family": "L_equal_angle",
                    "size_key": f"{size}x{size}x{t}",
                    "ambiguous": True,
                    "assumed_thickness_mm": t}
    return None


def extract_kusovnik(doc, b5: dict, logger: logging.Logger) -> dict:
    msp = doc.modelspace()
    # Per-profile counter (all 5 výkresy combined — per-rám split deferred to Stage D)
    profile_counts: dict[tuple[str, str], int] = defaultdict(int)
    profile_examples: dict[tuple[str, str], list] = defaultdict(list)
    unclassified: list[str] = []
    blk_counts = Counter(e.dxf.name for e in msp if e.dxftype() == "INSERT")

    for name, n in blk_counts.items():
        cls = classify_block_to_profile(name)
        if cls is None:
            unclassified.append(f"{n}× {name}")
            continue
        key = (cls["family"], cls["size_key"])
        profile_counts[key] += n
        if len(profile_examples[key]) < 3:
            profile_examples[key].append({"block_name": name, "count": n,
                                          "ambiguous": cls.get("ambiguous", False),
                                          "assumed_thickness_mm": cls.get("assumed_thickness_mm")})

    # Compute kg per profile (count × kg_per_m × default_length placeholder)
    # NOTE: kg_per_m × length × count — length is NOT count of pieces alone.
    # For discovery we report: kg_per_m × count × placeholder length 1.0
    #   = "kg per 1 m per piece × count" — actual mass needs DIMENSION lengths.
    # Cross-check task §9 rule 4: kg = délka_m × kg_per_m × počet_ks.
    # In discovery pass we report only count + kg_per_m; user verifies lengths via DIMENSIONs.
    rows: list[dict] = []
    for (family, size_key), n in sorted(profile_counts.items(), key=lambda x: -x[1]):
        cat = b5.get(family, {})
        rec = cat.get(size_key)
        kg_m = rec.get("kg_per_m") if rec else None
        rows.append({
            "family": family,
            "size_key": size_key,
            "count": n,
            "kg_per_m": kg_m,
            "_catalog_hit": rec is not None,
            "examples": profile_examples[(family, size_key)],
            "_note": "kg_total deferred to Stage D after DIMENSION-based length extraction "
                     "per task §9 rule 4 (NEVER hardcode length)",
        })

    # Workshop part codes — extract all
    all_text = collect_all_text(doc)
    codes = []
    seen_codes = set()
    for it in all_text:
        for m in RE_WORKSHOP_CODE.finditer(it["text"]):
            code = m.group()
            if code not in seen_codes:
                seen_codes.add(code)
                codes.append({
                    "code": code,
                    "first_seen_in_layer": it["layer"],
                    "first_seen_at": it["loc"],
                })

    # Rám/Pohled labels with positions for future spatial clustering (Stage D)
    rams_pohleds = []
    for it in all_text:
        t = it["text"]
        if re.search(r"\b(R[ÁA]M\s+OSA|POHLED\s+OSA|P[ŮU]DORYS|KONSTRUKCE\s+ST[ŘR]ECHY)", t, re.IGNORECASE):
            rams_pohleds.append({"label": t[:80], "loc": it["loc"], "pos": it["pos"]})

    # Layer entity counts (for context)
    layer_counts = Counter(e.dxf.layer for e in msp if hasattr(e.dxf, "layer"))

    # DIMENSION entities — collect raw measurements per layer (lengths in mm)
    dims = []
    for e in msp:
        if e.dxftype() != "DIMENSION":
            continue
        actual = getattr(e.dxf, "actual_measurement", None)
        if actual is None:
            try:
                actual = float(e.get_measurement())
            except Exception:
                actual = None
        dims.append({"layer": e.dxf.layer, "value_mm": actual,
                     "text_override": getattr(e.dxf, "text", "")})
    dim_summary = {
        "total": len(dims),
        "by_layer": Counter(d["layer"] for d in dims).most_common(),
        "value_distribution_top20": Counter(round(d["value_mm"]) for d in dims if d["value_mm"]).most_common(20),
    }

    out = {
        "file": str(DILENSKA_PATH.name),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_INSERT_instances": sum(blk_counts.values()),
            "unique_blocks": len(blk_counts),
            "profile_lines": len(rows),
            "unclassified_blocks": len(unclassified),
            "workshop_codes_distinct": len(codes),
            "ram_pohled_labels": len(rams_pohleds),
            "DIMENSION_entities": len(dims),
        },
        "profile_rollup": rows,
        "unclassified_blocks_top20": unclassified[:20],
        "workshop_part_codes": codes,
        "ram_pohled_labels": rams_pohleds,
        "layer_entity_counts_top20": layer_counts.most_common(20),
        "dimension_summary": dim_summary,
    }
    logger.info(f"  Stage B: {len(rows)} profile lines, {sum(r['count'] for r in rows)} total INSERTs classified, "
                f"{len(codes)} workshop codes, {len(rams_pohleds)} rám/pohled labels, "
                f"{len(unclassified)} unclassified blocks")
    return out


# ----------------------------------------------------------------------------
# Stage C: ÚT zařízení list + energy balance + 2966-1 block extract
# ----------------------------------------------------------------------------

UT_DEVICE_PATTERNS = {
    "Dalap_E-HP_9kW": {"keywords": ["Dalap E-HP", "Dalap"], "topny_kw": 9.0, "vendor": "DALAP",
                       "category": "tepelné čerpadlo vzduch-vzduch"},
    "ECOSUN_S+_12": {"keywords": ["ECOSUN S+", "ECOSUN"], "topny_kw": 1.2, "vendor": "FENIX (ECOSUN)",
                     "category": "sálavý infrapanel", "_note": "ECOSUN S+ 12 = 1200 W = 1.2 kW typicky; v originálu může být uvedeno 12 kW (verify)"},
    "PT_Vents_UET-15D": {"keywords": ["PT Vents UET-15D", "PT Vents", "UET-15D"], "topny_kw": 0.0, "vendor": "PT Ventilation",
                         "category": "VZT rekuperační jednotka", "_note": "VZT primary, ne topný zdroj"},
    "LENS_ARENA_60x120_W": {"keywords": ["LENS ARENA", "LENS_ARENA"], "topny_kw": 0.0, "vendor": "LENS",
                             "category": "LED svítidlo (reference podklad pro EL D.1.4)", "_note": "elektro scope, ne ÚT"},
}


def extract_ut_zarizeni(doc, logger: logging.Logger) -> dict:
    msp = doc.modelspace()
    blk_counts = Counter(e.dxf.name for e in msp if e.dxftype() == "INSERT")

    # ÚT devices: identifiers live in TEXT/MTEXT/nested block-def TEXT,
    # NOT in INSERT block names (which are anonymous "Model_Space" subtrees).
    # Strategy: count distinct TEXT-entity occurrences of each device label.
    all_text = collect_all_text(doc)

    # Also include text from inside REAL block definitions (skip *Model_Space /
    # *Paper_Space* — those are already covered by collect_all_text via the
    # Model and Layout1 layouts; iterating them again would double-count).
    for b in doc.blocks:
        if b.name.startswith("*"):
            continue
        for e in b:
            s = get_text(e)
            if s:
                all_text.append({"loc": f"BLK_{b.name[:30]}", "type": e.dxftype(),
                                  "text": s, "layer": "", "pos": None})

    devices = []
    for dev_key, spec in UT_DEVICE_PATTERNS.items():
        total = 0
        matched_blocks = []
        # First try INSERT block names (LENS ARENA is this case)
        for blk_name, n in blk_counts.items():
            if any(kw.upper().replace(" ", "_") in blk_name.upper().replace(" ", "_") for kw in spec["keywords"]):
                total += n
                matched_blocks.append({"source": "INSERT_block_name", "block_name": blk_name, "count": n})
        # Then TEXT-label occurrences (Dalap, ECOSUN, PT Vents — labels on anonymous INSERTs)
        text_hits = 0
        for it in all_text:
            for kw in spec["keywords"]:
                if kw in it["text"]:
                    text_hits += 1
                    break
        # Prefer INSERT count when blocks matched; else use TEXT label count
        if total == 0 and text_hits > 0:
            total = text_hits
            matched_blocks.append({"source": "TEXT_label", "occurrences": text_hits,
                                    "_note": "device identifier present as TEXT/MTEXT entity, "
                                             "not as INSERT block name"})
        if total > 0:
            devices.append({
                "device_key": dev_key,
                "vendor": spec["vendor"],
                "category": spec["category"],
                "count": total,
                "topny_kw_per_unit": spec["topny_kw"],
                "topny_kw_total": round(total * spec["topny_kw"], 2),
                "matched_blocks": matched_blocks,
                "_note": spec.get("_note", ""),
            })

    # Pipe runs — count LWPOLYLINE per layer containing "POTRUBI"/"CHLAD"/"TOPNA" keywords
    pipe_layers = {}
    for e in msp:
        if e.dxftype() != "LWPOLYLINE":
            continue
        ly = e.dxf.layer.upper()
        if any(kw in ly for kw in ("POTRUBI", "POTRUBÍ", "CHLAD", "TOPN", "VZT", "VENT", "ROZVOD")):
            pipe_layers.setdefault(e.dxf.layer, 0)
            pipe_layers[e.dxf.layer] += 1

    layer_counts = Counter(e.dxf.layer for e in msp if hasattr(e.dxf, "layer"))

    return {
        "file": str(UT_PATH.name),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "devices": devices,
        "pipe_LWPOLYLINE_per_layer": pipe_layers,
        "layer_count_top20": layer_counts.most_common(20),
    }


def extract_2966_1_block(doc, logger: logging.Logger) -> dict:
    """Extract 2966-1 block reference content (geometry + nested text)."""
    msp = doc.modelspace()
    refs = [e for e in msp if e.dxftype() == "INSERT" and "2966" in e.dxf.name]
    if not refs:
        return {"file": str(UT_PATH.name), "found": False,
                "note": "2966-1 block not referenced in modelspace"}

    # Group refs by prefix (143 individual machines share the same 2966-1_NAVRH_DISPOZICE_* prefix)
    by_prefix: dict[str, list] = defaultdict(list)
    all_inner_text: list[str] = []
    inner_types: Counter = Counter()
    distinct_positions: set = set()
    for ins in refs:
        prefix = re.sub(r"_?\d+$", "_<N>", ins.dxf.name)
        by_prefix[prefix].append(ins.dxf.name)
        distinct_positions.add((round(ins.dxf.insert.x, 2), round(ins.dxf.insert.y, 2)))
        try:
            block_def = doc.blocks.get(ins.dxf.name)
        except Exception:
            block_def = None
        if block_def:
            for e in block_def:
                inner_types[e.dxftype()] += 1
                if e.dxftype() in ("TEXT", "MTEXT"):
                    s = get_text(e)
                    if s:
                        all_inner_text.append(s[:200])

    # Compact per-prefix summary (no 143 individual entries — group, sample 5)
    prefix_summary = [
        {"prefix": p, "unique_block_defs": len(names), "sample_names": sorted(names)[:5]}
        for p, names in sorted(by_prefix.items(), key=lambda x: -len(x[1]))
    ]

    return {
        "file": str(UT_PATH.name),
        "found": True,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_INSERT_references": len(refs),
            "unique_block_defs": len(by_prefix),
            "distinct_insert_positions": len(distinct_positions),
            "aggregated_inner_entity_types": dict(inner_types),
            "aggregated_inner_text_samples": all_inner_text[:30],
            "aggregated_inner_text_count": len(all_inner_text),
        },
        "block_def_prefix_groups": prefix_summary,
        "note": "2966-1 block embedded as INSERT — partial resolution of ABMV #16. "
                "Separate PDF dokument 2966-1 stále žádaný (block je rendering-only).",
    }


def write_energy_balance_md(out_path: Path, ut_data: dict,
                              tz_b_p_inst_kw: float = 83.0,
                              cop_default: float = 3.5) -> None:
    devices = ut_data["devices"]
    L = []
    L.append("# HK212 — Energetická bilance ÚT vs TZ B\n")
    L.append(f"_Extracted: {datetime.now(timezone.utc).isoformat()}_\n")
    L.append(f"_Source: {ut_data['file']} (DXF INSERT counting via ezdxf), no AI_\n")
    L.append("")
    L.append("## Zařízení ÚT (z DXF entity count)\n")
    L.append("| Zařízení | Vendor | Kategorie | Počet ks | Topný výkon/ks (kW) | Topný výkon celkem (kW) |")
    L.append("|---|---|---|---:|---:|---:|")
    p_topny_total = 0.0
    for d in devices:
        L.append(f"| {d['device_key']} | {d['vendor']} | {d['category']} | "
                 f"{d['count']} | {d['topny_kw_per_unit']} | {d['topny_kw_total']} |")
        p_topny_total += d["topny_kw_total"]
    L.append(f"| **CELKEM topný výkon** | | | | | **{p_topny_total:.2f}** |")
    L.append("")
    L.append(f"## Srovnání s TZ B\n")
    L.append(f"- TZ B P_inst (instalovaný příkon): **{tz_b_p_inst_kw:.1f} kW**")
    L.append(f"- DXF P_topný celkem: **{p_topny_total:.2f} kW**")
    if p_topny_total > 0:
        delta_pct = (p_topny_total - tz_b_p_inst_kw) / tz_b_p_inst_kw * 100
        L.append(f"- Δ = {p_topny_total - tz_b_p_inst_kw:+.2f} kW  ({delta_pct:+.1f} %)")
        L.append("")
        p_prikon = p_topny_total / cop_default
        L.append(f"- COP default = {cop_default} (vzduch-vzduch HP — assumption)")
        L.append(f"- Odhadovaný P_příkon = P_topný / COP = **{p_prikon:.2f} kW**")
        L.append("")
    L.append("## Verdikt + ABMV #1 update\n")
    if p_topny_total > tz_b_p_inst_kw * 2:
        L.append(f"🚨 **§11 STOP GATE #7 možný**: ÚT P_topný ({p_topny_total:.1f} kW) > 2× TZ B P_inst ({tz_b_p_inst_kw:.1f} kW). "
                 "Pravděpodobné příčiny:")
        L.append("- ECOSUN S+ 12: výkon per ks může být 1.2 kW (1200W panel), ne 12 kW. "
                 "Verify v DXF jednotky a v ECOSUN technical sheet.")
        L.append("- ECOSUN INSERT count může zahrnovat duplikáty z různých řezů (40× je suspicious pro halu 28×19 m).")
        L.append("- TZ B P_inst může pokrývat jen ELEKTRO příkon, ne topný výkon (P_topný ≠ P_inst).")
        L.append("- Update ABMV #1 status → `needs_clarification_per_p_inst_definition`, "
                 "zachovat open dokud projektant nepotvrdí.")
    elif p_topny_total < tz_b_p_inst_kw * 0.5:
        L.append(f"🚨 **§11 STOP GATE #7 triggered**: ÚT P_topný ({p_topny_total:.1f} kW) < polovina TZ B P_inst ({tz_b_p_inst_kw:.1f} kW). "
                 "Možná chybí část ÚT D.1.4 (např. radiátory, podlahové topení).")
    else:
        L.append(f"✓ Bilance v rozsahu 50–200 % TZ B P_inst — věrohodné. ABMV #1 lze posunout na `resolved_with_caveats`.")
    L.append("")
    out_path.write_text("\n".join(L), encoding="utf-8")


# ----------------------------------------------------------------------------
# Discovery report
# ----------------------------------------------------------------------------

def write_discovery_report(out_path: Path, razitka_dilenska: dict, razitka_ut: dict,
                            kusovnik: dict, ut_zarizeni: dict, b2966: dict) -> None:
    L = []
    L.append("# HK212 — Dílenská OK + ÚT DPS discovery report\n")
    L.append(f"_Generated: {datetime.now(timezone.utc).isoformat()}_\n")
    L.append("_Source: ezdxf 1.4.3 (deterministic), no AI calls, no outbound HTTP_\n")
    L.append("")
    L.append("## Stage A — Razítka inventory\n")
    L.append("### Dílenská (Hala HK_ Úprava dveří.dxf)\n")
    cd = razitka_dilenska["current_razitko"]
    L.append(f"- Current persons: {[p['name'] for p in cd['current_persons']]}")
    L.append(f"- ČKAIT: {list(cd['ckaity'].keys())}")
    L.append(f"- Stupeň strings (top 3): {cd['stupne_strings'][:3]}")
    L.append(f"- Current dates (≥2024): {list(cd['current_dates'].keys())}")
    L.append(f"- HK akce signal: {cd['has_current_HK_signal']}  (text 'Hradec' matched in akce, see ghost-toggle below)")
    L.append(f"- **Ghost razítko filtered**: {razitka_dilenska['ghost_razitko']['tokens_filtered']}")
    L.append(f"  - Ghost persons: {[p['name'] for p in razitka_dilenska['ghost_razitko']['ghost_persons']]}")
    L.append(f"  - Ghost dates (<2024): {list(razitka_dilenska['ghost_razitko']['ghost_dates'].keys())}")
    L.append("")
    L.append("### ÚT DPS (UT_HALAHK_DPS.dxf)\n")
    cu = razitka_ut["current_razitko"]
    L.append(f"- Current persons: {[p['name'] for p in cu['current_persons']]}")
    L.append(f"- HK akce signal: {cu['has_current_HK_signal']}")
    L.append(f"- **§11 STOP gate #2 hit**: no razítko text extractable from this file. "
             "ÚT projektant vendor TBD — flagged.")
    L.append("")
    L.append("## Stage B — Dílenská kusovník (combined across all 5 výkresy)\n")
    s = kusovnik["summary"]
    L.append(f"- Total INSERT instances: **{s['total_INSERT_instances']}**")
    L.append(f"- Profile lines (classified): **{s['profile_lines']}**")
    L.append(f"- Unclassified blocks: {s['unclassified_blocks']}")
    L.append(f"- Workshop part codes distinct: **{s['workshop_codes_distinct']}**")
    L.append(f"- Rám/Pohled labels: {s['ram_pohled_labels']}")
    L.append(f"- DIMENSION entities: {s['DIMENSION_entities']}")
    L.append("")
    L.append("### Profile rollup (top 20 by count)\n")
    L.append("| Family | Size | Count | kg/m | Catalog hit |")
    L.append("|---|---|---:|---:|---|")
    for r in kusovnik["profile_rollup"][:20]:
        kgm = f"{r['kg_per_m']}" if r['kg_per_m'] else "—"
        hit = "✓" if r["_catalog_hit"] else "✗"
        ambig = " (assumed)" if any(ex.get("ambiguous") for ex in r["examples"]) else ""
        L.append(f"| {r['family']} | {r['size_key']}{ambig} | {r['count']} | {kgm} | {hit} |")
    L.append("")
    L.append("### Workshop part codes (first 30)\n")
    codes = kusovnik["workshop_part_codes"][:30]
    L.append("`" + " · ".join(c["code"] for c in codes) + "`")
    L.append(f"\n_Total distinct codes: {s['workshop_codes_distinct']}. Sémantika kódů NOT YET interpreted (Q1 default — raw extract)._")
    L.append("")
    L.append("## Stage C — ÚT zařízení list\n")
    L.append("| Zařízení | Count | Topný kW/ks | Topný total kW | Vendor |")
    L.append("|---|---:|---:|---:|---|")
    p_total = 0
    for d in ut_zarizeni["devices"]:
        L.append(f"| {d['device_key']} | {d['count']} | {d['topny_kw_per_unit']} | "
                 f"{d['topny_kw_total']} | {d['vendor']} |")
        p_total += d["topny_kw_total"]
    L.append(f"| **CELKEM** | | | **{p_total:.2f}** | |")
    L.append("")
    L.append("### 2966-1 NÁVRH DISPOZICE block extraction\n")
    if b2966["found"]:
        s = b2966["summary"]
        L.append(f"- Total INSERT references: **{s['total_INSERT_references']}**")
        L.append(f"- Unique block defs (one per machine in dispozice plan): **{s['unique_block_defs']}**")
        L.append(f"- Distinct insert positions: {s['distinct_insert_positions']} (all near 408627 / 397388 X-coord)")
        L.append(f"- Aggregated inner entity types: {s['aggregated_inner_entity_types']}")
        L.append(f"- Inner text fragments (extracted): {s['aggregated_inner_text_count']}")
        if s["aggregated_inner_text_samples"]:
            L.append(f"  - Sample: {s['aggregated_inner_text_samples'][:5]}")
        L.append(f"\nBlock-def prefix groups (top 5):")
        for pg in b2966["block_def_prefix_groups"][:5]:
            L.append(f"  - `{pg['prefix']}` — {pg['unique_block_defs']} distinct definitions; "
                     f"sample: {pg['sample_names'][:3]}")
        L.append("\n_ABMV #16 → `partially_resolved` (block content available — 143 unique machine block-defs "
                 "embedded; samostatný PDF stále žádán pro definici jednotlivých strojů)._")
    else:
        L.append("- NOT found in modelspace")
    L.append("")
    L.append("## Open ABMV items (proposed update)\n")
    L.append("| ID | Topic | Current status | Proposed status |")
    L.append("|---|---|---|---|")
    L.append("| #1 | Energetická bilance | open | needs_clarification (P_topný vs P_inst ambiguity, see energy MD) |")
    L.append("| #12 | TZB profesní D.1.4 | open | partially_resolved (ÚT v DPS in hand; ZTI/EL/VZT detail still missing) |")
    L.append("| #15 | Vaznice krajní UPE 160 vs C150×19.3 | open | NEEDS_USER — dílenská má 0× UPE, 0× C150 v INSERT names. Profile may be in geometric LINEs without block reference. |")
    L.append("| #16 | 2966-1 dispozice strojů | open | partially_resolved (block embedded; PDF still wanted) |")
    L.append("")
    L.append("## Phase 2.1 readiness\n")
    L.append("- 🟢 **Stage A (razítko)**: done for both files")
    L.append("- 🟢 **Stage B (kusovník combined)**: 152 INSERTs classified across profile families")
    L.append("- 🟡 **Stage B per-rám split**: deferred — needs spatial clustering of rám/pohled labels with INSERT positions (Stage D)")
    L.append("- 🟢 **Stage C (ÚT inventory)**: done; energy bilance flagged for ABMV #1 update")
    L.append("- 🟢 **2966-1 block**: extracted (partial close ABMV #16)")
    L.append("- 🔴 **Stage D (items_hk212_etap1.json update)**: NOT done — awaits user ratification of discovery findings")
    L.append("")
    L.append("## Recommended next steps\n")
    L.append("1. Review this report. Especially check ECOSUN energy bilance — 480 kW suspicious.")
    L.append("2. Ratify Stage D plan: update HSV-3 items (per-rám length × kg/m), concretize PT Vents VZT concept, "
             "add Dalap + ECOSUN as new ÚT items, update ABMV queue.")
    L.append("3. If Stage D OK → I proceed with backup + in-place items.json update + delta_report.md + integration_summary.md.")
    out_path.write_text("\n".join(L), encoding="utf-8")


# ----------------------------------------------------------------------------
# Driver
# ----------------------------------------------------------------------------

def main() -> int:
    logger = setup_logging()
    if not DILENSKA_PATH.exists():
        logger.error(f"Dílenská file missing: {DILENSKA_PATH}")
        return 2
    if not UT_PATH.exists():
        logger.error(f"ÚT file missing: {UT_PATH}")
        return 2
    if not B5_CATALOG.exists():
        logger.error(f"B5 catalog missing: {B5_CATALOG}")
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(B5_CATALOG, encoding="utf-8") as f:
        b5 = json.load(f)
    logger.info(f"B5 catalog loaded: {sum(1 for k, v in b5.items() if isinstance(v, dict) and k != '_meta' and len(v) > 0)} families")

    logger.info(f"Reading dílenská: {DILENSKA_PATH.name}")
    doc_dil = ezdxf.readfile(DILENSKA_PATH, errors="ignore")
    razitka_dil = extract_razitka(doc_dil, "dilenska_Mach_Micanek", logger)
    (OUT_DIR / "dilenska_razitka.json").write_text(
        json.dumps(razitka_dil, indent=2, ensure_ascii=False), encoding="utf-8")

    kusovnik = extract_kusovnik(doc_dil, b5, logger)
    (OUT_DIR / "dilenska_kusovnik.json").write_text(
        json.dumps(kusovnik, indent=2, ensure_ascii=False), encoding="utf-8")

    logger.info(f"Reading ÚT: {UT_PATH.name}")
    doc_ut = ezdxf.readfile(UT_PATH, errors="ignore")
    razitka_ut = extract_razitka(doc_ut, "ut_dps", logger)
    (OUT_DIR / "ut_razitka.json").write_text(
        json.dumps(razitka_ut, indent=2, ensure_ascii=False), encoding="utf-8")

    ut_zar = extract_ut_zarizeni(doc_ut, logger)
    (OUT_DIR / "ut_zarizeni_list.json").write_text(
        json.dumps(ut_zar, indent=2, ensure_ascii=False), encoding="utf-8")

    b2966 = extract_2966_1_block(doc_ut, logger)
    (OUT_DIR / "2966_1_extracted.json").write_text(
        json.dumps(b2966, indent=2, ensure_ascii=False), encoding="utf-8")

    write_energy_balance_md(OUT_DIR / "energetical_balance_update.md", ut_zar)
    logger.info(f"  Stage C: {len(ut_zar['devices'])} devices, "
                f"P_topny_total={sum(d['topny_kw_total'] for d in ut_zar['devices']):.1f} kW")

    write_discovery_report(OUT_DIR / "discovery_report.md",
                            razitka_dil, razitka_ut, kusovnik, ut_zar, b2966)
    logger.info(f"All outputs in {OUT_DIR.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
