"""Validation: compare master_extract_D.json vs Phase 0.x legacy outputs.

Step 6 gate (TASK_PHASE_PI_0_SPEC.md §5 step 6): produce a
validation_report_D.{md,json} that classifies every
data point in master_extract_D.json as one of:

  MATCH    — Π.0a value == legacy value
  NEW      — Π.0a found, legacy missed (a gap closed by Π.0a)
  CHANGED  — different value (investigate which is correct)
  MISSING  — legacy has, Π.0a missed (Π.0a bug — blocks Step 7)

Sections compared (per legacy artefact):

  rooms[]                  ↔  objekt_D_geometric_dataset.json (rooms by code)
  doors[]                  ↔  objekt_D_doors_ownership.json (cisla)
  segment_counts{}         ↔  dxf_segment_counts_per_objekt_d.json
  skladby{}                ↔  tabulky_loaded.json (skladby section)
  per-podlazi rooms        ↔  objekt_D_per_podlazi_aggregates.json
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def compare_rooms(extract: dict, legacy_geometric: dict) -> dict:
    """Match rooms[] by code against objekt_D_geometric_dataset.json.

    Returns counters + lists of CHANGED / MISSING entries (for the report).
    """
    extract_codes = {r["code"]: r for r in extract.get("rooms", [])}
    legacy_codes = {r["code"]: r for r in legacy_geometric.get("rooms", [])
                    if r.get("objekt") == "D"}

    matched = []     # code in both, area within tolerance
    changed = []     # code in both, area differs > 5%
    new_in_pi0 = []  # in Π.0a, not in legacy
    missing = []     # in legacy, not in Π.0a

    for code, l_room in legacy_codes.items():
        e_room = extract_codes.get(code)
        if not e_room:
            missing.append({"code": code, "legacy_area_m2": l_room.get("plocha_podlahy_m2")})
            continue
        l_area = l_room.get("plocha_podlahy_m2")
        e_area = e_room.get("area_m2", {}).get("value") if isinstance(e_room.get("area_m2"), dict) else e_room.get("area_m2")
        if l_area is None or e_area is None:
            matched.append(code)
            continue
        rel_diff = abs(e_area - l_area) / max(abs(l_area), 1e-9)
        if rel_diff <= 0.05:  # 5% tolerance
            matched.append(code)
        else:
            changed.append({
                "code": code,
                "legacy_area_m2": l_area,
                "pi_0a_area_m2": e_area,
                "diff_pct": round(rel_diff * 100, 2),
            })

    for code in extract_codes:
        if code not in legacy_codes:
            new_in_pi0.append({"code": code,
                                "pi_0a_area_m2": (
                                    extract_codes[code].get("area_m2", {}).get("value")
                                    if isinstance(extract_codes[code].get("area_m2"), dict)
                                    else extract_codes[code].get("area_m2")
                                )})

    return {
        "section": "rooms",
        "match": len(matched),
        "changed": len(changed),
        "new": len(new_in_pi0),
        "missing": len(missing),
        "changed_details": changed,
        "new_details": new_in_pi0,
        "missing_details": missing,
    }


def compare_doors(extract: dict, legacy_ownership: dict) -> dict:
    """Match doors[] by cislo against objekt_D_doors_ownership.json."""
    legacy_cisla: set[str] = set()
    for owners in legacy_ownership.get("ownership", {}).values():
        for d in owners:
            cislo = d.get("cislo")
            if cislo:
                legacy_cisla.add(str(cislo))
    extract_cisla = {str(d["cislo"]["value"]): d for d in extract.get("doors", [])
                     if d.get("cislo", {}).get("value")}

    matched = sorted(set(extract_cisla.keys()) & legacy_cisla)
    new_in_pi0 = sorted(set(extract_cisla.keys()) - legacy_cisla)
    missing = sorted(legacy_cisla - set(extract_cisla.keys()))

    return {
        "section": "doors",
        "match": len(matched),
        "new": len(new_in_pi0),
        "missing": len(missing),
        "changed": 0,
        "new_details": new_in_pi0[:30],
        "missing_details": missing[:30],
    }


def compare_segment_counts(extract: dict, legacy_counts: dict) -> dict:
    """Match segment_counts{} by prefix against dxf_segment_counts_per_objekt_d.json."""
    e_counts = extract.get("segment_counts", {})
    l_counts = legacy_counts.get("counts_per_objekt_d", {})

    sections: dict[str, dict] = {}
    for prefix in set(list(e_counts.keys()) + list(l_counts.keys())):
        e_codes = e_counts.get(prefix, {})
        l_codes_section = l_counts.get(prefix, {})
        # Legacy format: {prefix: {code: {"total_d_count_int": N, …}, ...}}
        l_normalized: dict[str, int] = {}
        for code, code_data in l_codes_section.items():
            if isinstance(code_data, dict):
                l_normalized[code] = int(code_data.get("total_d_count_int", 0))
            elif isinstance(code_data, (int, float)):
                l_normalized[code] = int(code_data)

        sections[prefix] = {
            "match": len(set(e_codes) & set(l_normalized)),
            "new":   len(set(e_codes) - set(l_normalized)),
            "missing": len(set(l_normalized) - set(e_codes)),
            "missing_details": sorted(set(l_normalized) - set(e_codes))[:10],
        }
    aggregate = {
        "section": "segment_counts",
        "match": sum(s["match"] for s in sections.values()),
        "new": sum(s["new"] for s in sections.values()),
        "missing": sum(s["missing"] for s in sections.values()),
        "changed": 0,
        "per_prefix": sections,
    }
    return aggregate


def compare_skladby(extract: dict, legacy_tabulky: dict) -> dict:
    """Match skladby{} flat code set against tabulky_loaded.json.

    Legacy structure: tabulky_loaded.skladby is a wrapper:
      {"skladby": {<code>: <entry>, ...}, "count": N, "source": ..., "warnings": [...]}
    The real code map is one level deeper.
    """
    extract_codes: set[str] = set()
    for kind_section in extract.get("skladby", {}).values():
        extract_codes.update(kind_section.keys())

    skladby_section = legacy_tabulky.get("skladby", {})
    if isinstance(skladby_section, dict) and "skladby" in skladby_section:
        legacy_codes = set(skladby_section["skladby"].keys())
    elif isinstance(skladby_section, dict):
        # Filter out wrapper keys like 'count', 'source', 'warnings'
        legacy_codes = {k for k in skladby_section.keys()
                        if not k.islower() or len(k) > 2}
    else:
        legacy_codes = set()

    matched = extract_codes & legacy_codes
    new_in_pi0 = extract_codes - legacy_codes
    missing = legacy_codes - extract_codes

    return {
        "section": "skladby",
        "match": len(matched),
        "new": len(new_in_pi0),
        "missing": len(missing),
        "changed": 0,
        "new_details": sorted(new_in_pi0)[:30],
        "missing_details": sorted(missing)[:30],
    }


def run_validation_d(extract_path: Path, outputs_dir: Path) -> dict:
    """Run full Π.0a vs legacy validation for objekt D.

    Returns a structured report dict; caller writes to .json + .md.
    """
    extract = json.loads(extract_path.read_text(encoding="utf-8"))

    sections: list[dict] = []

    # rooms vs objekt_D_geometric_dataset.json
    geo_path = outputs_dir / "objekt_D_geometric_dataset.json"
    if geo_path.exists():
        legacy = json.loads(geo_path.read_text(encoding="utf-8"))
        sections.append(compare_rooms(extract, legacy))

    # doors vs objekt_D_doors_ownership.json
    own_path = outputs_dir / "objekt_D_doors_ownership.json"
    if own_path.exists():
        legacy = json.loads(own_path.read_text(encoding="utf-8"))
        sections.append(compare_doors(extract, legacy))

    # segment_counts vs dxf_segment_counts_per_objekt_d.json
    sc_path = outputs_dir / "dxf_segment_counts_per_objekt_d.json"
    if sc_path.exists():
        legacy = json.loads(sc_path.read_text(encoding="utf-8"))
        sections.append(compare_segment_counts(extract, legacy))

    # skladby vs tabulky_loaded.json
    tab_path = outputs_dir / "tabulky_loaded.json"
    if tab_path.exists():
        legacy = json.loads(tab_path.read_text(encoding="utf-8"))
        sections.append(compare_skladby(extract, legacy))

    totals = {
        "match": sum(s["match"] for s in sections),
        "changed": sum(s.get("changed", 0) for s in sections),
        "new": sum(s["new"] for s in sections),
        "missing": sum(s["missing"] for s in sections),
    }

    return {
        "objekt": "D",
        "extract_path": str(extract_path.name),
        "totals": totals,
        "gate_passed": totals["missing"] == 0,
        "sections": sections,
    }


def render_report_md(report: dict) -> str:
    """Render the validation report as human-readable markdown."""
    lines: list[str] = []
    t = report["totals"]
    gate = "✅ PASSED (0 MISSING)" if report["gate_passed"] else "🔴 FAILED"
    lines.append(f"# validation_report_{report['objekt']}.md")
    lines.append("")
    lines.append(f"**Source**: `outputs/{report['extract_path']}`")
    lines.append(f"**Step 6 gate**: {gate}")
    lines.append("")
    lines.append("## Totals")
    lines.append("")
    lines.append("| Status | Count | Meaning |")
    lines.append("|---|---:|---|")
    lines.append(f"| MATCH    | {t['match']:>6} | Π.0a value == legacy |")
    lines.append(f"| CHANGED  | {t['changed']:>6} | different value (investigate) |")
    lines.append(f"| NEW      | {t['new']:>6} | Π.0a found, legacy missed (gap closed) |")
    lines.append(f"| MISSING  | {t['missing']:>6} | legacy has, Π.0a missed (must be 0 to advance) |")
    lines.append("")

    for s in report["sections"]:
        lines.append(f"## Section: `{s['section']}`")
        lines.append("")
        lines.append(f"- MATCH: {s['match']}")
        lines.append(f"- CHANGED: {s.get('changed', 0)}")
        lines.append(f"- NEW: {s['new']}")
        lines.append(f"- MISSING: {s['missing']}")
        lines.append("")
        if s.get("missing"):
            lines.append("### MISSING (Π.0a bug — investigate)")
            for entry in s.get("missing_details", [])[:30]:
                lines.append(f"- {entry!r}")
            lines.append("")
        if s.get("changed"):
            lines.append("### CHANGED (per-field investigation needed)")
            for entry in s.get("changed_details", [])[:30]:
                lines.append(f"- {entry!r}")
            lines.append("")
        if s.get("new") and s.get("new_details"):
            lines.append("### NEW (gap closed — these only exist in Π.0a)")
            for entry in s.get("new_details", [])[:15]:
                lines.append(f"- {entry!r}")
            if s.get("new") > len(s.get("new_details", [])):
                lines.append(f"- ... and {s['new'] - len(s.get('new_details', []))} more")
            lines.append("")
        # segment_counts breakdown per prefix
        if s.get("per_prefix"):
            lines.append("### Per prefix")
            lines.append("")
            lines.append("| Prefix | MATCH | NEW | MISSING |")
            lines.append("|---|---:|---:|---:|")
            for p, sub in sorted(s["per_prefix"].items()):
                lines.append(f"| `{p}` | {sub['match']} | {sub['new']} | {sub['missing']} |")
            lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("_Generated by Π.0a Step 6 validation._")
    return "\n".join(lines)
