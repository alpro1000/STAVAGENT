"""Π.0a Step 8c — TZB prostupy (slab penetrations) extraction.

Per `probe_9_full_audit_per_section.md` (2026-05-10), the per-discipline
TZB DXFs in `sources/{D,shared}/dxf/` carry prostup symbols on
discipline-specific Czech-named layers. This module extracts every
CIRCLE on a TZB pipe layer plus every INSERT of a prostup-symbol block,
cross-references nearby TEXT entities for DN labels, and emits one
record per prostup with full provenance.

Output records (one per prostup):
    {
        "id": "{objekt}.{discipline}.{podlazi}.{idx:04d}",
        "discipline": "kanalizace" | "vodovod" | "silnoproud" |
                      "slaboproud" | "UT" | "plyn",
        "podlazi": "1.PP" | "1.NP" | "2.NP" | "3.NP",
        "position": [x_mm, y_mm],
        "source_kind": "circle" | "block_insert",
        "source_layer": "{layer name}",
        "source_drawing": "{drawing key}",
        "block_name": {value, source, confidence}  # for INSERT
        "dn":        {value, source, confidence}  # nearest TEXT label
        "confidence": 0.95 | 0.85 | 0.70,  # per Π.0a convention
    }

Reference: probe_9_full_audit_per_section.md §3 (per-discipline layer
convention) + §8 (Step 8c implementation outline).
"""
from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Optional

import ezdxf

# ---------------------------------------------------------------------------
# Discipline -> DXF filename pattern map
# ---------------------------------------------------------------------------
# Each key is a (objekt_id, podlazi) tuple. Value is a list of (discipline,
# filename_glob) pairs identifying the DXF files that carry prostupy for
# that discipline at that podlazi.
#
# 9421 jadra D 2.NP zoom is intentionally NOT used as a primary source —
# it's a subset of the 9420-driven 2.NP per-discipline files.
DISCIPLINE_DXF_PATTERNS: dict[tuple[str, str], list[tuple[str, str]]] = {
    # Above-ground D: per-podlazi per-discipline files
    ("D", "1.NP"): [
        ("kanalizace", "D_1NP_kan.dxf"),
        ("silnoproud", "D_1NP_sil.dxf"),
        ("slaboproud", "D_1NP_slb.dxf"),
        ("vodovod",    "D_1NP_vod.dxf"),
        # VZT + chl: user-supplied AC1024 DXFs landed 2026-05-10 after
        # original LibreDWG conversion failed on the AC1027 source DWGs.
        ("VZT",        "D_1NP_vzt.dxf"),
        ("chl",        "D_1NP_chl.dxf"),
    ],
    ("D", "2.NP"): [
        ("kanalizace", "D_2NP_kan.dxf"),
        ("silnoproud", "D_2NP_sil.dxf"),
        ("slaboproud", "D_2NP_slb.dxf"),
        ("vodovod",    "D_2NP_vod.dxf"),
        ("VZT",        "D_2NP_vzt.dxf"),
        ("chl",        "D_2NP_chl.dxf"),
        # 9421 jadra zoom retained as `VZT_partial` for confidence
        # cross-check; produces ~13 entries on `_VZT` layer covering
        # byt cores only. Now redundant with the full D_2NP_vzt.dxf,
        # but kept as a defence-in-depth audit trail per Step 8c
        # idempotency contract — same 13 prostupy will be deduped
        # at item-generator level if needed.
        ("VZT_partial", "18501_DPS_D_SO01_140_9421_R00_jadra D 2NP.dxf"),
    ],
    ("D", "3.NP"): [
        ("kanalizace", "D_3NP_kan.dxf"),
        ("silnoproud", "D_3NP_sil.dxf"),
        ("slaboproud", "D_3NP_slb.dxf"),
        ("vodovod",    "D_3NP_vod.dxf"),
        ("VZT",        "D_3NP_vzt.dxf"),
        ("chl",        "D_3NP_chl.dxf"),
    ],
    # 1.PP shared (komplex). D treats 1.PP as its own bookkeeping;
    # A/B/C deliverables emit zero 1.PP items per ADR-2026-05-09.
    ("D", "1.PP"): [
        ("kanalizace", "K1pp.dxf"),         # K1pp = Kanalizace 1.PP
        ("plyn",       "1pp_plyn.dxf"),
        ("slaboproud", "1pp_slb.dxf"),
        ("UT",         "1pp_UT.dxf"),
        ("vodovod",    "1PP_vod.dxf"),
        # VZT: 1pp_VZT.dxf — file too large (29 MB) for GitHub UI
        # upload; remains heuristic per Part 5B until git CLI upload.
        # silnoproud: NO standalone 1.PP DWG; embedded in 1.PP koord overlay
        # _100_9000_R00_koordinacni vykres 1PP.dxf on `_silnoproud` layer.
        ("silnoproud_embedded", "18501_DPS_D_SO01_100_9000_R00_koordinacni vykres 1PP.dxf"),
    ],
}

# ---------------------------------------------------------------------------
# Discipline -> layer prefix patterns
# ---------------------------------------------------------------------------
# Layers carrying prostup CIRCLE entities + pipe runs. Layer matching is
# case-insensitive, prefix-based. See audit §3.
DISCIPLINE_LAYER_PATTERNS: dict[str, list[str]] = {
    "vodovod": [
        "ZT_V_STU", "ZT-V_TEPLA", "ZT_VKOTY", "ZT_STOUP",
        "ZT_ARMAT", "ZT_POZARNI", "ZT_VPOPIS",
    ],
    "kanalizace": [
        "ZT_K_PRIPOJ", "ZT_K_KONDEN", "ZT_K_KONDEN_ZAV",
        "ZT_K_DES_ZAV", "ZT_K_DES", "ZT_K_ODVETR", "ZT_K_SPL_ZAV",
        "ZT_K_VYTLAK", "ZT_STOUP", "ZT_TVAR", "ZT_POPIS",
    ],
    "silnoproud": ["0_el_"],          # prefix match, e.g. 0_el_trasy
    "silnoproud_embedded": ["_silnoproud"],
    "slaboproud": ["SLP-", "SLP_"],
    "UT":         ["0UT_", "0ut_"],
    "plyn":       ["Plyn_", "Plyn STL"],
    # VZT_partial (Part 5B recovery): the 9421 jadra zoom carries _VZT
    # content but is a 2.NP-byt-cores-only subset; flag for confidence
    # downgrade in HSV item generator.
    "VZT_partial": ["_VZT"],
    # VZT (drop v3 2026-05-10): user-supplied AC1024 DXFs use a
    # different layer convention than 9421. Endpoint exhaust grilles
    # on `VZT_EXHAUST` and equipment objects on `V-objekty` are the
    # primary prostup signal (each grille / object passes through a
    # wall or slab); `V-tvarovky` (fittings) excluded — those are
    # in-line junctions, not penetrations.
    "VZT": ["VZT_EXHAUST", "V-objekty", "VZT_DIGESTOR"],
    # chl (drop v3 2026-05-10): split AC outdoor + indoor units on
    # `Jednotky Daikin` layer. Each Daikin INSERT = one through-wall
    # refrigerant connection. Pipe runs on PIPE-C1 are NOT prostupy.
    "chl": ["Jednotky Daikin"],
}

# ---------------------------------------------------------------------------
# Layers where ANY INSERT counts as a prostup (regardless of block name)
# ---------------------------------------------------------------------------
# Default INSERT handling requires block_name to be in PROSTUP_BLOCKS.
# These layers override that — every INSERT on them is a prostup, since
# the layer convention itself implies "this is a penetration symbol".
# Used by VZT (anonymous AutoCAD blocks like `*U77`) and chl (Daikin
# vendor blocks).
LAYER_INSERT_AS_PROSTUP: set[str] = {
    "VZT_EXHAUST", "V-objekty", "VZT_DIGESTOR",
    "Jednotky Daikin",
}

# ---------------------------------------------------------------------------
# DN label layer per discipline (TEXT entities with DN values)
# ---------------------------------------------------------------------------
DN_LABEL_LAYERS: dict[str, list[str]] = {
    "vodovod":   ["ZT_VKOTY", "ZT_VPOPIS"],
    "kanalizace":["ZT_POPIS"],
    "UT":        ["0UT_DN_DN", "0UT_DN_kota", "0UT_DN_vyska"],
    "plyn":      ["Plyn_popis"],
    "silnoproud":["0_el_trasy"],          # cable tray sizes via MTEXT
    "silnoproud_embedded": [],            # no DN labels
    "slaboproud":["SLP-_TRASY", "Defpoints"],
    # VZT label convention uses %%c125 / %%c160 (Ø notation in TEXT).
    "VZT":       ["VZT_EXHAUST-popis", "V-tvarovky-popis", "V-objekty-popis"],
    # chl label convention uses CU potrubí spec strings ("12,7/25,4 mm").
    "chl":       ["TT_popis OT"],
}

# ---------------------------------------------------------------------------
# Block names interpreted as explicit prostup symbols
# ---------------------------------------------------------------------------
# Maps block name → discipline-specific marker. INSERT entities matching
# any of these names emit a prostup record on top of any CIRCLE detection.
PROSTUP_BLOCKS: dict[str, str] = {
    "SLP_PROSTUP": "slaboproud_explicit",
    "stoup":       "kanalizace_or_vodovod_riser",
    "VTOK":        "kanalizace_drain_inlet",
    "vent_hlav":   "kanalizace_vent_head",
    "ČERPADLO":    "kanalizace_pump",
}

# ---------------------------------------------------------------------------
# Spatial proximity threshold for DN-label cross-reference (mm).
# DXF coordinates are in mm; pipe DN labels are typically annotated within
# 200 mm of the pipe geometry per Czech ABMV convention.
# ---------------------------------------------------------------------------
DN_PROXIMITY_MM = 250.0

# Bare-number DN label heuristic (kanalizace ZT_POPIS uses bare numbers).
_DN_BARE_RE = re.compile(r"^\s*(\d{2,4})\s*$")
# DN-prefixed label (vodovod, plyn).
_DN_PREFIX_RE = re.compile(r"\bDN\s*(\d{2,4})", re.IGNORECASE)


def _is_layer_match(layer_name: str, patterns: list[str]) -> bool:
    """Case-sensitive prefix match (DXF layer names are case-sensitive)."""
    if not layer_name:
        return False
    for pat in patterns:
        if layer_name == pat or layer_name.startswith(pat):
            return True
    return False


def _extract_dn(text: str) -> Optional[int]:
    """Parse a DN-like value from a TEXT/MTEXT string. Returns mm value."""
    if not text:
        return None
    cleaned = text.strip()
    m = _DN_PREFIX_RE.search(cleaned)
    if m:
        return int(m.group(1))
    m = _DN_BARE_RE.match(cleaned)
    if m:
        v = int(m.group(1))
        # Plausible DN range: 20 mm – 600 mm.
        if 20 <= v <= 600:
            return v
    return None


def _euclidean(p1: tuple, p2: tuple) -> float:
    dx = p1[0] - p2[0]
    dy = p1[1] - p2[1]
    return math.sqrt(dx * dx + dy * dy)


def _find_nearest_dn(position: tuple, dn_candidates: list[dict]) -> Optional[dict]:
    """Return the closest DN-label dict within DN_PROXIMITY_MM, else None."""
    if not dn_candidates:
        return None
    best = None
    best_dist = float("inf")
    for cand in dn_candidates:
        d = _euclidean(position, cand["position"])
        if d < best_dist and d <= DN_PROXIMITY_MM:
            best_dist = d
            best = cand
    return best


def _drawing_key(dxf_path: Path) -> str:
    """Compact provenance key — drop suffix, no full path."""
    return dxf_path.stem


def _extract_one_dxf(
    dxf_path: Path,
    discipline: str,
    podlazi: str,
    objekt: str,
    counter: list[int],
) -> tuple[list[dict], list[dict]]:
    """Parse one DXF, return (prostupy, warnings)."""
    if not dxf_path.exists():
        return [], [{
            "level": "warning",
            "category": "tzb_dxf_missing",
            "message": (
                f"Step 8c: expected {discipline} DXF for objekt {objekt} "
                f"podlazi {podlazi} not found: {dxf_path.name}"
            ),
            "source_evidence": str(dxf_path.name),
        }]

    try:
        doc = ezdxf.readfile(str(dxf_path))
    except Exception as e:
        return [], [{
            "level": "warning",
            "category": "tzb_dxf_unreadable",
            "message": (
                f"Step 8c: ezdxf could not read {dxf_path.name} "
                f"({type(e).__name__}: {e}). Discipline {discipline} "
                f"podlazi {podlazi} skipped."
            ),
            "source_evidence": str(dxf_path.name),
        }]

    layer_pats = DISCIPLINE_LAYER_PATTERNS.get(discipline, [])
    dn_pats = DN_LABEL_LAYERS.get(discipline, [])
    drawing_key = _drawing_key(dxf_path)

    # First pass: collect DN-label candidates from TEXT/MTEXT entities
    dn_candidates: list[dict] = []
    for layout_name in doc.layouts.names_in_taborder():
        for e in doc.layouts.get(layout_name):
            if e.dxftype() not in ("TEXT", "MTEXT"):
                continue
            if not _is_layer_match(e.dxf.layer, dn_pats):
                continue
            try:
                if e.dxftype() == "TEXT":
                    text = e.dxf.text
                    pos = (e.dxf.insert.x, e.dxf.insert.y)
                else:  # MTEXT
                    text = e.text
                    pos = (e.dxf.insert.x, e.dxf.insert.y)
            except Exception:
                continue
            dn = _extract_dn(text)
            if dn is not None:
                dn_candidates.append({
                    "position": pos,
                    "dn": dn,
                    "raw_text": text.strip()[:80],
                    "layer": e.dxf.layer,
                })

    # Second pass: collect CIRCLE prostupy + INSERT prostup-block instances
    prostupy: list[dict] = []
    for layout_name in doc.layouts.names_in_taborder():
        for e in doc.layouts.get(layout_name):
            kind = e.dxftype()
            if kind == "CIRCLE":
                if not _is_layer_match(e.dxf.layer, layer_pats):
                    continue
                pos = (e.dxf.center.x, e.dxf.center.y)
                source_kind = "circle"
                block_name = None
            elif kind == "INSERT":
                try:
                    block_name = e.dxf.name
                except Exception:
                    continue
                # Two acceptance paths for INSERT:
                # (a) block_name is a known prostup symbol (PROSTUP_BLOCKS) —
                #     classic kanalizace/vodovod stoup, slaboproud
                #     SLP_PROSTUP, etc.
                # (b) layer is in LAYER_INSERT_AS_PROSTUP — VZT_EXHAUST /
                #     V-objekty / Jednotky Daikin (layer convention itself
                #     implies the symbol is a penetration; block_name
                #     can be an anonymous AutoCAD `*U77` or a vendor block
                #     like `RSen_55_ME_FB_SOg-...`).
                if (
                    block_name not in PROSTUP_BLOCKS
                    and e.dxf.layer not in LAYER_INSERT_AS_PROSTUP
                ):
                    continue
                # Layer-based INSERTs ALSO require layer-pattern match
                # (otherwise titleblock blocks etc. would leak in).
                if (
                    block_name not in PROSTUP_BLOCKS
                    and not _is_layer_match(e.dxf.layer, layer_pats)
                ):
                    continue
                pos = (e.dxf.insert.x, e.dxf.insert.y)
                source_kind = "block_insert"
            else:
                continue

            counter[0] += 1
            idx = counter[0]
            nearest_dn = _find_nearest_dn(pos, dn_candidates)
            dn_value = nearest_dn["dn"] if nearest_dn else None
            dn_confidence = 0.85 if nearest_dn else 0.0
            dn_source = (
                f"DXF|{drawing_key}|{nearest_dn['layer']}|nearest"
                if nearest_dn else f"DXF|{drawing_key}|none_in_{DN_PROXIMITY_MM:.0f}mm"
            )

            entry: dict = {
                "id": f"{objekt}.{discipline}.{podlazi}.{idx:04d}",
                "discipline": discipline,
                "podlazi": podlazi,
                "position": [round(pos[0], 3), round(pos[1], 3)],
                "source_kind": source_kind,
                "source_layer": e.dxf.layer,
                "source_drawing": drawing_key,
                "dn_mm": {
                    "value": dn_value,
                    "source": dn_source,
                    "confidence": dn_confidence,
                },
                "confidence": 0.95,  # direct extract from discipline DWG
            }
            if block_name:
                entry["block_name"] = {
                    "value": block_name,
                    "source": f"DXF|{drawing_key}|INSERT",
                    "confidence": 1.0,
                }
                # block_role only set when block_name is a known prostup
                # symbol (PROSTUP_BLOCKS). For layer-driven INSERTs (VZT
                # anonymous `*U77`, Daikin vendor blocks) we leave
                # block_role unset; the source_layer carries the role
                # info instead (e.g. layer=VZT_EXHAUST → exhaust grille).
                if block_name in PROSTUP_BLOCKS:
                    entry["block_role"] = PROSTUP_BLOCKS[block_name]
            prostupy.append(entry)

    return prostupy, []


def extract_tzb_prostupy(
    objekt: str, sources_root: Path
) -> tuple[list[dict], list[dict]]:
    """Walk every (discipline, podlazi) pair for `objekt` and return
    a flat list of prostup records + extraction warnings.

    Layer patterns + filename map come from the audit findings in
    `probe_9_full_audit_per_section.md`.
    """
    prostupy: list[dict] = []
    warnings: list[dict] = []
    counter = [0]  # mutable index for stable ID assignment

    # Locate dxf root for each bucket
    objekt_dxf = sources_root / objekt / "dxf"
    shared_dxf = sources_root / "shared" / "dxf"

    for (obj, podlazi), discipline_files in DISCIPLINE_DXF_PATTERNS.items():
        if obj != objekt:
            continue
        for discipline, fname in discipline_files:
            # Try objekt-specific first, fall back to shared
            candidate_paths = [objekt_dxf / fname, shared_dxf / fname]
            dxf_path = next((p for p in candidate_paths if p.exists()), candidate_paths[0])
            new_records, new_warnings = _extract_one_dxf(
                dxf_path, discipline, podlazi, objekt, counter
            )
            prostupy.extend(new_records)
            warnings.extend(new_warnings)

    # Stable sort for idempotency
    prostupy.sort(key=lambda r: (
        r["podlazi"], r["discipline"], r["position"][0], r["position"][1], r["id"]
    ))

    # Summary warning
    if prostupy or warnings:
        per_discipline: dict[str, int] = {}
        per_podlazi: dict[str, int] = {}
        for r in prostupy:
            per_discipline[r["discipline"]] = per_discipline.get(r["discipline"], 0) + 1
            per_podlazi[r["podlazi"]] = per_podlazi.get(r["podlazi"], 0) + 1
        warnings.append({
            "level": "info",
            "category": "step_8c_prostupy_gate",
            "message": (
                f"Step 8c: {len(prostupy)} TZB prostupy extracted for "
                f"objekt {objekt}; per-discipline {per_discipline}; "
                f"per-podlazi {per_podlazi}."
            ),
            "source_evidence": "DERIVED|step_8c_extract_tzb_prostupy",
        })

    return prostupy, warnings
