#!/usr/bin/env python3
"""A4: DXF-First auto-takeoff as a pipeline step (Pattern 49 + Pattern 45).

Runs the deterministic DXF takeoff on the project's DXF sheets and emits:
  - outputs/DXF_VYMERY_<date>.json   — rooms (číslo/název/area) + counts, conf 1.0
  - outputs/DXF_VYMERY_crosscheck_<date>.md — DXF (ground truth) vs the manual
    Výměry register (inputs/meta/vymery_souhrn.json): MATCH / MISMATCH / DXF-only

GRACEFUL: if ezdxf/shapely are missing or no DXF files are present, it prints a
skip notice and exits 0 — never breaks the items.json regeneration chain.

Wired into regenerate_all_views.py as a non-blocking validation step.
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

DXF_SHEETS = {
    "260217_sklad": "inputs/vykresy_dxf/260217_sklad/RD Ja_chymov vjezd _ DPZ _ 02.dxf",
    "260219_dum": "inputs/vykresy_dxf/260219_dum/RD Jachymov dum _ DPZ _ 10.dxf",
}


def _load_manual_areas():
    p = ROOT / "inputs" / "meta" / "vymery_souhrn.json"
    if not p.exists():
        return []
    d = json.loads(p.read_text(encoding="utf-8"))
    rows = d if isinstance(d, list) else d.get("jednotky", d.get("rows", []))
    out = []
    for r in rows:
        a = r.get("plocha_m2")
        if isinstance(a, (int, float)) and a > 0:
            out.append((r.get("jednotka", "?"), float(a)))
    return out


def main() -> int:
    try:
        from dxf_takeoff import takeoff  # noqa
    except Exception as e:  # ezdxf/shapely missing
        print(f"  [dxf] skipped — DXF deps unavailable ({e.__class__.__name__}); non-blocking.")
        return 0

    sheets = {obj: ROOT / rel for obj, rel in DXF_SHEETS.items() if (ROOT / rel).exists()}
    if not sheets:
        print("  [dxf] skipped — no DXF sheets present; non-blocking.")
        return 0

    today = date.today().isoformat()
    result = {"_generated": today, "_pattern": "49 DXF-First + 45 Výměry", "objekty": {}}
    for obj, path in sheets.items():
        try:
            t = takeoff(str(path))
        except Exception as e:
            print(f"  [dxf] {obj}: parse error {e.__class__.__name__} — skipped.")
            continue
        result["objekty"][obj] = {
            "rooms": t["rooms"],
            "counts": t["blocks"]
            + [{"element": v["element"], "qty": v["qty"], "_source": v["_source"]}
               for v in t["vymery"] if v["role"] == "label" and not v["element"].startswith("_")],
            "unknown_layers": t["unknown_layers"],
        }

    out_json = ROOT / "outputs" / f"DXF_VYMERY_{today}.json"
    out_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    # cross-check DXF room areas vs manual register
    manual = _load_manual_areas()
    lines = [f"# DXF auto-takeoff × manual Výměry — cross-check ({today})", "",
             "DXF = deterministic ground truth (Pattern 49). Manual = vymery_souhrn.json.", ""]
    import re as _re

    def _linked(room, jednotka):
        """Type-aware: manual row references the DXF room by číslo or shares a název keyword."""
        j = jednotka.lower()
        if str(room.get("cislo", "")) and str(room["cislo"]) in j:
            return True
        for w in _re.findall(r"[a-zřčšžýáíéúůňťďě]{4,}", (room.get("nazev") or "").lower()):
            if w in j:
                return True
        return False

    dxf_rooms = [(obj, r) for obj, data in result["objekty"].items() for r in data["rooms"]]
    matched = labelless = dxf_only = 0
    lines.append("| DXF místnost | DXF m² | manual (type-linked) | manual m² | verdikt |")
    lines.append("|---|---|---|---|---|")
    for obj, r in dxf_rooms:
        a = r["area_m2"]
        in_tol = [m for m in manual if abs(m[1] - a) / max(a, m[1]) <= 0.05]
        linked = [m for m in in_tol if _linked(r, m[0])]
        if linked:
            best = min(linked, key=lambda m: abs(m[1] - a)); verdikt = "✓ MATCH"; matched += 1
        elif in_tol:
            best = min(in_tol, key=lambda m: abs(m[1] - a)); verdikt = "≈ area-only (no label)"; labelless += 1
        else:
            best = ("—", 0); verdikt = "DXF-only"; dxf_only += 1
        bn, bm = best
        lines.append(f"| {r['cislo']} {str(r['nazev'] or '')[:18]} | {a} | {str(bn)[:24]} | {bm or '—'} | {verdikt} |")
    lines += ["", f"**Σ:** {matched} MATCH (type-linked) · {labelless} area-only · {dxf_only} DXF-only · "
              f"{len(dxf_rooms)} DXF rooms vs {len(manual)} manual.",
              "", "_Type-aware (Pattern 49 refinement): MATCH requires číslo/název linkage, "
              "not bare area coincidence — removes false matches._"]
    out_md = ROOT / "outputs" / f"DXF_VYMERY_crosscheck_{today}.md"
    out_md.write_text("\n".join(lines), encoding="utf-8")

    print(f"  [dxf] {len(sheets)} sheet(s) → {out_json.name} + {out_md.name} "
          f"({len(dxf_rooms)} rooms, {matched} MATCH manual)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
