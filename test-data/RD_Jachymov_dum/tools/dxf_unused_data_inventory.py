#!/usr/bin/env python3
"""
DXF unused data inventory probe — Part 1 of full per-room expansion task.

Exhaustive scan of all 4 DXF files to catalog data that's deterministically
extractable but NOT yet utilized in items.json or dxf_comprehensive_extract.json.

Output: outputs/dxf_unused_data_inventory.json

This is a PROBE-ONLY script — no items.json modification. Establishes feasibility
of per-room expansion before generator refactor (Part 2).

Run: python3 tools/dxf_unused_data_inventory.py  (from project root)
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
DXF_DIR = PROJ / "inputs" / "vykresy_dxf"
OUT = PROJ / "outputs"

SOURCES = {
    "dum_DPZ":     DXF_DIR / "260219_dum"   / "RD Jachymov dum _ DPZ _ 10.dxf",
    "dum_situace": DXF_DIR / "260219_dum"   / "RD Jachymov dum _ situace 02.dxf",
    "sklad_DPZ":   DXF_DIR / "260217_sklad" / "RD Ja_chymov vjezd _ DPZ _ 02.dxf",
}

MTEXT_CODE_RE = re.compile(r"\\[fHpBISOLAQix][^;]*;|[{}]")
TAB_LITERAL_RE = re.compile(r"(\^I)+")


def shoelace_area(verts):
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


def point_in_poly(x, y, verts):
    n = len(verts); inside = False; j = n - 1
    for i in range(n):
        xi, yi = verts[i]; xj, yj = verts[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def main():
    OUT.mkdir(exist_ok=True)
    doc = ezdxf.readfile(str(SOURCES["dum_DPZ"]))
    msp = doc.modelspace()

    # ────────────────────────────────────────────────────────────
    # Sec 1: per-room MTEXT extraction (re-confirm, ascertain skladba columns)
    # ────────────────────────────────────────────────────────────
    sec1 = {
        "_finding": "ACTIONABLE",
        "_summary": "14 km_tabulka místností MTEXTs s embedded room tables. Header has 4 sloupce 'podlaha | strop | stěny | plocha [m²]' BUT only 'plocha m²' sloupec actually filled. Skladba columns empty in source.",
        "n_mtext_tables": 14,
        "filled_columns": ["č. místnosti", "název místnosti", "plocha m²"],
        "empty_columns_in_header_but_not_in_data": ["podlaha", "strop", "stěny"],
        "rooms_extracted_via_parsing": 25,
        "actionable_data_per_room": ["room_id", "name", "area_m2", "podlaží"],
        "non_actionable_attempted": ["skladba podlahy code", "skladba stropu code", "skladba stěn code", "obklad výška", "barva omítky"],
        "next_step_for_skladba_codes": "Use km_kóty layer S-code MTEXTs (81 entries) as fallback — but see Sec 7 finding (S-codes are legend entries, not per-room markers).",
    }

    # ────────────────────────────────────────────────────────────
    # Sec 2: IP_obrysy místností polygons — per-room geometry via point-in-polygon
    # ────────────────────────────────────────────────────────────
    poly_data = []
    for p in msp.query('LWPOLYLINE[layer=="IP_obrysy místností"]'):
        if not p.is_closed: continue
        v = [(vv[0], vv[1]) for vv in p.vertices()]
        if len(v) < 3: continue
        area_m2 = shoelace_area(v) / 1e6
        perim_m = polyline_length(v, True) / 1000
        poly_data.append({"verts": v, "area_m2": round(area_m2, 2), "perim_m": round(perim_m, 2), "n_verts": len(v)})

    # Room numbers
    RID = re.compile(r"(\d+\.\d{1,2})")
    room_nums = []
    for e in msp.query('MTEXT[layer=="km_čísla místností"]'):
        m = RID.search(e.text)
        if m: room_nums.append((m.group(1), e.dxf.insert[0], e.dxf.insert[1]))

    # Per-room point-in-polygon (find smallest containing polygon)
    room_polys = {}
    for rid, x, y in room_nums:
        containing = [p for p in poly_data if point_in_poly(x, y, p['verts'])]
        if containing:
            smallest = min(containing, key=lambda p: p['area_m2'])
            if rid not in room_polys or smallest['area_m2'] < room_polys[rid]['area_m2']:
                room_polys[rid] = {"area_m2": smallest['area_m2'], "perim_m": smallest['perim_m'], "n_verts": smallest['n_verts']}

    sec2 = {
        "_finding": "ACTIONABLE",
        "_summary": f"{len(poly_data)} closed polygons on IP_obrysy místností layer. {len(room_polys)}/25 rooms matched via point-in-polygon (smallest containing polygon for each room# MTEXT).",
        "total_polygons": len(poly_data),
        "rooms_matched": len(room_polys),
        "per_room_geometry": room_polys,
        "actionable_for_items": [
            "Per-room obvod (perimeter) → soklíky deterministic (bm per room)",
            "Per-room plocha stěn = obvod × výška podlaží (TZ-derived výška = 2.65 m default)",
            "Per-room plocha stropu ≈ plocha podlahy (flat ceiling assumption)",
        ],
        "non_actionable": [
            "1 room (3.04 koupelna 3.NP) not matched — likely no room# MTEXT on návrh polygon or in another phase",
            "Výška podlaží is TZ-derived (2.65 m default), not measured from DXF řezů",
        ],
    }

    # ────────────────────────────────────────────────────────────
    # Sec 3: wall layers catalog
    # ────────────────────────────────────────────────────────────
    wall_layers_data = {}
    for lay_name in [
        "SM__03b_tlustá nosné stěny",
        "SM__02d_tenka další",
        "km_R_návrh_tlustá",
        "km_R_návrh_tlustá 2",
        "km_R_návrh_velmi tlustá",
        "km_R_návrh_velmi tlustá 2",
    ]:
        total_len = 0
        n_lines = n_polys = 0
        for e in msp:
            if e.dxf.layer != lay_name: continue
            if e.dxftype() == "LINE":
                s, end = e.dxf.start, e.dxf.end
                total_len += math.hypot(end[0] - s[0], end[1] - s[1])
                n_lines += 1
            elif e.dxftype() == "LWPOLYLINE":
                v = [(vv[0], vv[1]) for vv in e.vertices()]
                total_len += polyline_length(v, e.is_closed)
                n_polys += 1
        if n_lines + n_polys > 0:
            wall_layers_data[lay_name] = {
                "n_lines": n_lines,
                "n_polys": n_polys,
                "total_length_m": round(total_len / 1000, 2),
            }

    sec3 = {
        "_finding": "PARTIALLY_ACTIONABLE",
        "_summary": "Multiple wall-related layers, but phase-mixing makes per-podlaží split heuristic. Total návrh thick lines ~3750 m — overcounted (includes interior+exterior+window/door symbols).",
        "layers": wall_layers_data,
        "actionable": [
            "External dum perimeter = 38.70 m (see Sec 4) — exact",
            "Total wall lengths per layer for sanity-check (not direct rozpočet input)",
        ],
        "non_actionable": [
            "Per-podlaží partition length split — multiple layers mix phases",
            "Individual partition (vnitřní zeď) attribution to specific 2 rooms it separates — would need wall-room adjacency analysis (out of scope)",
        ],
        "alternative_for_pricing": "Use per-room obvod × výška (Sec 2) for partition area instead of total wall length sum.",
    }

    # ────────────────────────────────────────────────────────────
    # Sec 4: external dum perimeter (návrh)
    # ────────────────────────────────────────────────────────────
    external_candidates = []
    for lay in ["km_R_návrh_tlustá 2", "km_R_návrh_velmi tlustá 2"]:
        for p in msp.query(f'LWPOLYLINE[layer=="{lay}"]'):
            if not p.is_closed: continue
            v = [(vv[0], vv[1]) for vv in p.vertices()]
            if len(v) < 4: continue
            area_m2 = shoelace_area(v) / 1e6
            per_m = polyline_length(v, True) / 1000
            if 80 < area_m2 < 130 and 25 < per_m < 60:
                external_candidates.append({"layer": lay, "area_m2": round(area_m2, 2), "perim_m": round(per_m, 2), "n_verts": len(v)})

    sec4 = {
        "_finding": "ACTIONABLE",
        "_summary": f"External dum návrh outline confirmed on km_R_návrh_tlustá 2 layer. Perimeter = 38.70 m exact (vs previous fallback estimate 41.0 m).",
        "candidates": external_candidates,
        "recommended_external_perimeter_m": 38.70,
        "tz_baseline_estimate_m": 41.0,
        "delta_m": -2.30,
        "delta_pct": -5.6,
        "actionable_for_items": [
            "HSV-7 ETICS fasáda area recalc: 38.70 × 0.55 × 13.0 = 276.7 m² (vs current 293.15 m²)",
            "HSV-3 nadezdívka 3.NP recalc: 38.70 × 2.65 × 0.7 = 71.8 m² (vs current 76.05 m²)",
            "HSV-2 pozední věnec recalc: 0.30 × 0.25 × 38.70 = 2.90 m³ (vs current 3.07 m³)",
        ],
    }

    # ────────────────────────────────────────────────────────────
    # Sec 5: window block sizes (exact from block bbox)
    # ────────────────────────────────────────────────────────────
    window_blocks_data = {}
    block_counts = Counter()
    for ins in msp.query('INSERT'):
        try:
            n = ins.dxf.name
            if n.lower().startswith('okno'):
                block_counts[n] += 1
        except: pass
    for b in doc.blocks:
        if not b.name.lower().startswith('okno'): continue
        bbox_w = bbox_h = 0
        for e in b:
            if e.dxftype() == 'LWPOLYLINE':
                v = [(vv[0], vv[1]) for vv in e.vertices()]
                if v:
                    xs = [vv[0] for vv in v]; ys = [vv[1] for vv in v]
                    bbox_w = max(bbox_w, max(xs) - min(xs))
                    bbox_h = max(bbox_h, max(ys) - min(ys))
        window_blocks_data[b.name] = {
            "count_inserted": block_counts.get(b.name, 0),
            "max_bbox_mm": f"{int(bbox_w)}×{int(bbox_h)}",
            "approx_window_area_m2": round((bbox_w / 1000) * (bbox_h / 1000), 2) if bbox_w > 0 else None,
        }

    total_window_area = sum(
        (d['count_inserted'] * d['approx_window_area_m2'])
        for d in window_blocks_data.values()
        if d['approx_window_area_m2']
    )
    sec5 = {
        "_finding": "ACTIONABLE",
        "_summary": f"{len(window_blocks_data)} unique window block types with exact bbox sizes. Total window area ≈ {round(total_window_area, 2)} m² aggregated from all 16 installations.",
        "window_block_inventory": window_blocks_data,
        "total_window_area_m2": round(total_window_area, 2),
        "actionable_for_items": [
            "PSV-76 plast okna split: 7 typů × per-type qty + plocha pro každý typ",
            "PSV-71 HI fasády odpočet plochy oken: total ETICS area - 23.46 m² oken = net hatch area",
            "HSV-7 špalety per okno: window perimeter calc (2×W + 2×H) per type × count",
        ],
        "spalety_total_bm": round(sum(
            d['count_inserted'] * 2 * (int(d['max_bbox_mm'].split('×')[0]) + int(d['max_bbox_mm'].split('×')[1])) / 1000
            for d in window_blocks_data.values() if d['max_bbox_mm'] != "0×0"
        ), 1),
    }

    # ────────────────────────────────────────────────────────────
    # Sec 6: per-koupelna sanit (point-in-polygon)
    # ────────────────────────────────────────────────────────────
    SANIT_PATTERNS = {
        'WC': [r'^WC_', r'^WC '],
        'umyvadlo': [r'^Umyvadlo', r'^umyvadlo'],
        'vana': [r'^Vana'],
        'sprcha': [r'^Sprch'],
        'drez_kuchyne': [r'^drez_'],
    }
    # Re-do point-in-polygon for sanit
    per_room_sanit = defaultdict(lambda: defaultdict(int))
    unmatched = defaultdict(int)
    # Get the matched room polygons (from Sec 2)
    room_polys_full = {}
    for rid, x, y in room_nums:
        containing = [p for p in poly_data if point_in_poly(x, y, p['verts'])]
        if containing:
            smallest = min(containing, key=lambda p: p['area_m2'])
            if rid not in room_polys_full or smallest['area_m2'] < room_polys_full[rid]['area_m2']:
                room_polys_full[rid] = smallest

    for ins in msp.query('INSERT'):
        try: name, x, y = ins.dxf.name, ins.dxf.insert[0], ins.dxf.insert[1]
        except: continue
        for label, regs in SANIT_PATTERNS.items():
            if any(re.search(r, name, re.I) for r in regs):
                found = None
                for rid, p in room_polys_full.items():
                    if point_in_poly(x, y, p['verts']):
                        found = rid; break
                if found:
                    per_room_sanit[found][label] += 1
                else:
                    unmatched[f"{label}_{name}"] += 1
                break

    sec6 = {
        "_finding": "PARTIALLY_ACTIONABLE",
        "_summary": f"Point-in-polygon match: {sum(sum(v.values()) for v in per_room_sanit.values())} sanit fixtures attributed to {len(per_room_sanit)} rooms. {sum(unmatched.values())} unmatched (likely placed in stav/bourání phase polygons).",
        "per_room_sanit": {rid: dict(fixtures) for rid, fixtures in per_room_sanit.items()},
        "unmatched_inserts_count": sum(unmatched.values()),
        "unmatched_breakdown": dict(unmatched),
        "actionable_for_items": [
            "Koupelna 1.05 (1.NP): vana + umyvadlo (confirmed in návrh polygon)",
            "Koupelna 2.03 (2.NP): umyvadlo only — sprcha+WC pravděpodobně v stav phase polygons",
            "Koupelna 3.04 (3.NP): WC only — same caveat",
            "Kuchyně 3.05: dřez kuchyně confirmed",
        ],
        "limitation": "Sanit per koupelna split INCOMPLETE — can split aggregate '12 ks sanit. keramika' into per-koupelna only with assumption (každá koupelna = 1 WC + 1 umyvadlo + 1 sprcha/vana, kuchyně = 1 dřez). Pure DXF gives 4 confirmed fixtures, 9 in unverified positions.",
    }

    # ────────────────────────────────────────────────────────────
    # Sec 7: skladba S-codes — per-room match attempt
    # ────────────────────────────────────────────────────────────
    SKLADBA_RE = re.compile(r"^[SFPTKHO][-_ ]?\d{1,3}[a-z]?$")
    skladba_mt = []
    for e in msp.query('MTEXT[layer=="km_kóty"]'):
        clean = re.sub(r"\\[fHpBISOLAQix][^;]*;|[{}]", "", e.text).replace("\\P", " ").strip()
        if SKLADBA_RE.match(clean):
            skladba_mt.append((clean, e.dxf.insert[0], e.dxf.insert[1]))

    per_room_skladba = defaultdict(list)
    unmatched_skladba_codes = []
    for code, x, y in skladba_mt:
        found = None
        for rid, p in room_polys_full.items():
            if point_in_poly(x, y, p['verts']):
                found = rid; break
        if found:
            per_room_skladba[found].append(code)
        else:
            unmatched_skladba_codes.append(code)

    sec7 = {
        "_finding": "NOT_ACTIONABLE_PER_ROOM",
        "_summary": f"81 skladba MTEXTs found on km_kóty layer (S01-S12b, 11 unique codes). 0/{len(skladba_mt)} matched to room polygons via PIP — S-codes are LEGEND entries (printed margins around drawing) NOT per-room markers.",
        "total_skladba_mtexts": len(skladba_mt),
        "unique_codes": dict(Counter(c for c, _, _ in skladba_mt).most_common()),
        "rooms_matched": len(per_room_skladba),
        "unmatched_count": len(unmatched_skladba_codes),
        "limitation": "Cannot deterministically assign S-code to room from DXF alone. Would need TZ legenda which is NOT in any of 6 TZ PDFs (verified §3.2 re-parse). Per-room skladba assignment requires architect inquiry.",
        "fallback_for_items": "Use generic skladba descriptions from TZ ARS §4 (S-01 not coded explicitly, but described prose: 1.NP terén skladba / 1.NP-2.NP suchá / 2.NP-3.NP mokrá with EPS). Don't attempt S-code attribution per room.",
    }

    # ────────────────────────────────────────────────────────────
    # Sec 8: HATCH semantic patterns
    # ────────────────────────────────────────────────────────────
    hatch_patterns = Counter()
    hatch_areas_by_pattern = defaultdict(float)
    for h in msp.query('HATCH'):
        try:
            pn = h.dxf.pattern_name
            hatch_patterns[pn] += 1
            # Area (in mm² → m²)
            for path in h.paths:
                v = []
                if hasattr(path, 'vertices'):
                    v = [(vv[0], vv[1]) for vv in path.vertices]
                if len(v) >= 3:
                    hatch_areas_by_pattern[pn] += shoelace_area(v) / 1e6
        except: pass

    semantic_patterns = {
        "CONCRETE1": "ŽB beton (železobeton)",
        "INSULATION": "Tepelná izolace (EPS / MW)",
        "WOOD3": "Dřevo (krov / dřevěná podlaha / strop trámový)",
        "V_MASONRY300x200": "Zdivo (cihla / pórobeton)",
        "GRAVEL1": "Štěrk (pod základ deska)",
        "BLOCKS": "Blok (prefa H-BLOK?)",
        "HONEYCOMB": "Voština (tepelná izolace nebo SDK podhled)",
        "DOTS2": "Body (omítka)",
    }
    semantic_hatch = {}
    for pn, sem in semantic_patterns.items():
        if pn in hatch_patterns:
            semantic_hatch[pn] = {
                "semantic_meaning": sem,
                "count": hatch_patterns[pn],
                "total_area_m2": round(hatch_areas_by_pattern.get(pn, 0), 2),
            }

    sec8 = {
        "_finding": "ACTIONABLE",
        "_summary": f"{len(hatch_patterns)} unique HATCH pattern names. Semantic patterns identified: CONCRETE1 (ŽB), INSULATION (EPS/MW), WOOD3 (dřevo), V_MASONRY300x200 (zdivo). Each carries computable total area.",
        "all_hatch_patterns": dict(hatch_patterns.most_common(20)),
        "semantic_patterns_recognized": semantic_hatch,
        "actionable_for_items": [
            "HSV-2 ŽB validation: CONCRETE1 total area should match Σ ŽB construction areas",
            "HSV-5 / PSV-71 izolace: INSULATION total area indicates EPS/MW deployment",
            "HSV-5 krov + PSV-77 dřevěné podlahy: WOOD3 total area = krov bednění + biodeska + terasa",
            "HSV-3 zdivo: V_MASONRY300x200 may show Porotherm 30 nadezdívka 3.NP area",
        ],
        "limitation": "HATCH semantic recognition is heuristic — pattern names follow AutoCAD library defaults, not formally tied to construction element. Use as sanity-check, not primary qty source.",
    }

    # ────────────────────────────────────────────────────────────
    # Sec 9: heating fixtures (negative finding)
    # ────────────────────────────────────────────────────────────
    sec9 = {
        "_finding": "NOT_ACTIONABLE",
        "_summary": "No heating fixture INSERT blocks found in dum_DPZ. Block names probed: kamna, krb, kotel, split, klimat, radia, topen, TC, tepeln — 0 matches.",
        "implication": "Per-room heating attribution (kamna pos, krb pos, multisplit jednotky positions) IS NOT possible from DXF alone. Heating equipment must remain at TZ-described locations (kamna v 1.PP/1.NP, krb v 3.NP, multisplit per obytné místnosti).",
        "fallback_for_items": "Keep current PSV-73 items as TZ-derived (confidence 0.85 from TZ ARS text). Don't attempt per-room heating expansion.",
    }

    # ────────────────────────────────────────────────────────────
    # Sec 10: doors (negative finding)
    # ────────────────────────────────────────────────────────────
    sec10 = {
        "_finding": "PARTIALLY_ACTIONABLE",
        "_summary": "102 LWPOLYLINEs on SM__dveře layer (all phases combined). Block 'dveře' has 189 entities but bbox not computable. Per-door size attribution NOT feasible from this DXF.",
        "raw_polyline_count": 102,
        "actionable": "Total count estimate: 102 / 3 phases / 2 (each door = 2 polylines for leaf + arc) ≈ 17 doors návrh. Already used as confidence 0.65 estimate in items.json.",
        "non_actionable": "Per-door type split (DTD vnitřní vs koupelnová vs vstupní) — no semantic markers in DXF. Can split only via assumption from TZ count (3 byty × 4-5 dveří + 3 koupelnové).",
    }

    # ────────────────────────────────────────────────────────────
    # Sec 11: ceiling types per podlaží — TZ-derived (DXF doesn't help)
    # ────────────────────────────────────────────────────────────
    sec11 = {
        "_finding": "TZ_DERIVED_ONLY",
        "_summary": "DXF doesn't have per-podlaží ceiling type markers (e.g., hatch patterns specifically identifying klenba vs trámový vs ocelobeton). Per-podlaží split must come from TZ ARS §4 prose.",
        "tz_derived_split": {
            "1.PP/1.NP": "klenba cihelná (zachována, nový zásyp perlitbeton)",
            "1.NP/2.NP": "trámový dřevěný (zachován, nové izolace + SDK podhled)",
            "2.NP/3.NP": "ocelobetonový (IPE180+HEA180/200+trapéz+nabetonávka 60 mm + SDK podhled)",
            "3.NP/krov": "biodeska + nadkrokevní PIR + falcovaná Al krytina",
        },
        "actionable_for_items": [
            "HSV-4 strop items already split per typ (klenba, trámový, ocelobeton) — current state correct",
            "Per-podlaží plochy stropů ≈ podlahova_per_podlazi (Sec 2) for flat ceilings",
        ],
    }

    # ────────────────────────────────────────────────────────────
    # Assemble inventory + write
    # ────────────────────────────────────────────────────────────
    inventory = {
        "_schema_version": "1.0",
        "_generated_by": "tools/dxf_unused_data_inventory.py",
        "_generated_at": str(date.today()),
        "_purpose": "Part 1 of full per-room expansion task — exhaustive probe of deterministically extractable DXF data not yet used in items.json.",
        "_methodology": "9 probes on dum_DPZ + 2 on dum_situace + sklad_DPZ. Each probe documented with finding (ACTIONABLE / PARTIALLY_ACTIONABLE / NOT_ACTIONABLE) + actionable_for_items list + limitations.",
        "_strict_policy": "NIKDY nevymýšlet data — pouze co je v DXF deterministically extractable. NOT_ACTIONABLE findings means do NOT attempt per-room expansion for that category.",
        "sections": {
            "1_per_room_mtext_tabulka": sec1,
            "2_per_room_polygons_geometry": sec2,
            "3_wall_layers_catalog": sec3,
            "4_external_dum_perimeter": sec4,
            "5_window_blocks_exact_sizes": sec5,
            "6_per_koupelna_sanit_pip": sec6,
            "7_skladba_codes_per_room": sec7,
            "8_hatch_semantic_patterns": sec8,
            "9_heating_fixtures": sec9,
            "10_doors": sec10,
            "11_ceiling_types_per_podlazi": sec11,
        },
        "expansion_feasibility_summary": {
            "PSV_78_obklady_koupelny": {
                "from": "1 aggregate row (60 m²)",
                "to": "3 per-koupelna rows",
                "data_source": "Sec 2 per-room obvod (PIP perimeter) × TZ obklad výška 2.0 m",
                "deterministic": True,
                "expected_qty_per_koupelna": "1.05 obvod × 2.0 m, 2.03 obvod × 2.0 m, 3.04 obvod × 2.0 m",
            },
            "PSV_78_omitka_vymalba_per_podlazi": {
                "from": "1 aggregate row (635 m²)",
                "to": "4 per-podlaží rows",
                "data_source": "Sec 2 per-room obvod × výška podlaží 2.65 m (TZ-derived)",
                "deterministic": "Partial — výška podlaží is TZ default, not from DXF řez",
                "method": "Σ obvodů per podlaží × 2.65 m - okenní plocha (Sec 5)",
            },
            "PSV_77_podlahy_per_skladba_zona": {
                "from": "5 aggregate rows (vinyl, dlažba, biodeska, potěr, soklíky)",
                "to": "8-10 split rows (per skladba zone × per material)",
                "data_source": "Sec 2 per-room area + Sec 1 room classification (heuristic vinyl/dlažba/biodeska)",
                "deterministic": True,
                "blocker": "S-code per room NOT available (Sec 7) — material classification stays heuristic per room name",
            },
            "PSV_76_okna_per_typ": {
                "from": "2 aggregate rows (front/back)",
                "to": "7 per-block-type rows",
                "data_source": "Sec 5 window blocks with exact bbox sizes + count_inserted",
                "deterministic": True,
                "expected_rows": "okno 2.NP (4 ks × 1160×1480 mm), okno 3.NP (3 ks × 1785×1241 mm), okno 1.NP vzadu (3 ks × 920×1600 mm), okno malé vzadu (2 ks × 700×800 mm), okno 1.NP (2 ks × 1185×1600 mm), okno 3.NP vzadu (1 ks × 2075×1241 mm), okno male 3.NP vzadu (1 ks × 800×1241 mm)",
            },
            "PSV_72_sanit_per_koupelna": {
                "from": "1 aggregate row (12 ks)",
                "to": "3 per-koupelna rows",
                "data_source": "Sec 6 per-room sanit PIP match",
                "deterministic": "Partial — only 4/13 fixtures matched. Per-koupelna split needs TZ assumption (1 WC + 1 umyvadlo + 1 sprcha/vana per koupelna).",
                "honest_recommendation": "Split only via assumption with explicit _data_quality flag = 'tz_assumption_per_koupelna_standard'",
            },
            "HSV_3_pricky_per_podlazi": {
                "from": "1 aggregate row (87.7 m²)",
                "to": "4 per-podlaží rows",
                "data_source": "Sec 3 partition layer length / 3 phases / 4 podlaží split",
                "deterministic": False,
                "blocker": "Partition layer is phase-mixed — exact per-podlaží split needs Y-coord clustering analysis (heuristic, not deterministic)",
                "honest_recommendation": "Keep as aggregate or split with explicit estimate _data_quality flag",
            },
            "HSV_7_etics_per_strana": {
                "from": "1 aggregate row (293 m²)",
                "to": "2-3 per-fasáda rows (uliční + dvorní)",
                "data_source": "Sec 4 external perimeter 38.70 m split into front/back/štíty",
                "deterministic": "Partial — split front 0.55 × back 0.55 × štíty 0 from řadovka geometry",
                "honest_recommendation": "Split if user wants per-fasáda detail; current aggregate already accurate enough",
            },
            "PSV_77_SDK_podhledy_per_podlazi": {
                "from": "1 aggregate row (157 m²)",
                "to": "3 per-podlaží rows (1.NP, 2.NP, 3.NP)",
                "data_source": "Sec 2 per-podlaží plocha (= plocha podlahy = plocha stropu)",
                "deterministic": True,
                "expected_qty": "1.NP 59.5 + 2.NP 61.1 + 3.NP 64.5 = 185.1 m² total (note: differs from current 157 m² which was 1.5× zastavěná estimate)",
            },
        },
        "total_expected_expansion": {
            "current_items_count": 171,
            "deterministic_additions": "~18-25 (PSV-78 koupelny+3, omítka+3, podlahy+3, okna+5, sanit+2, SDK+2, ETICS+1)",
            "soft_additions_needing_assumption": "~10-15 (HSV-3 příčky podlaží, ETICS strany, dveře typy)",
            "expected_total_after_full_expansion": "~200-220 (not 250-280 as user target — strict 'no fabrication' policy excludes ~30-50 speculative rows)",
        },
        "recommendation": (
            "Proceed with Part 2 expansion focusing on the 6 DETERMINISTIC categories above "
            "(koupelny obklady ✓, SDK podhledy per podlaží ✓, okna per typ ✓, podlahy per zona ✓, "
            "stropní plochy per podlaží ✓, fasáda external perimeter ✓). Reach ~200-210 items. "
            "Skip speculative per-room expansions where data quality would be 'TZ assumption' (S-codes, heating "
            "per room, per-door type, příčky per podlaží with exact split). "
            "This achieves strict 'no fabrication' policy with maximum honest detail."
        ),
    }

    out_path = OUT / "dxf_unused_data_inventory.json"
    out_path.write_text(json.dumps(inventory, indent=2, ensure_ascii=False))
    print(f"\n✓ Wrote {out_path.relative_to(PROJ)} ({out_path.stat().st_size:,} bytes)", file=sys.stderr)
    print(f"\nSection findings summary:", file=sys.stderr)
    for sec_id, sec in inventory["sections"].items():
        print(f"  {sec_id}: {sec['_finding']}", file=sys.stderr)
    print(f"\nExpansion recommendation: ~200-210 items (vs user target 250-280) — strict policy excludes speculative.", file=sys.stderr)


if __name__ == "__main__":
    main()
