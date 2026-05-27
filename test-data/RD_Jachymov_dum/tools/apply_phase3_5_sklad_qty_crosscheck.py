#!/usr/bin/env python3
"""
Action 1 (Phase 3.5 follow-up) — sklad qty cross-check against DXF room tables.

Per DXF room tables extracted in Phase 3.5 (km_tabulka místností layer of
sklad DPZ DXF, verified against user's drawing screenshots):

  Sklad zahradní techniky 0.01 — 17.60 m² (inner usable area, walls excluded)
  Parking 1.01 stání pororošt   — 44.60 m²
  Parking 1.02 schodiště beton  —  5.50 m² (mezipodesta)

Applies:
  1A. PSV77.001 podlaha sklad — UPDATE 21.209 → 17.60 m²
      (was outer 6.35×3.34; correct = inner usable per room table)
  1B. HSV4.005 parking pororošt — UPDATE 21.0 → 44.60 m²
      (was rough 7×3 estimate; correct = full parking footprint)
  1C. ADD sklad HSV5.001 — sklad mezipodesta schodiště prefa layer (5.50 m²)
      (gap; existing HSV2.005 lože + HSV2.006 deska cover base; step blocks
       themselves were missing)

Audit trail tags:
  PHASE_3_5_SKLAD_QTY_DXF_VERIFY  — qty corrections (1A, 1B)
  PHASE_3_5_SKLAD_MEZIPODESTA_GAP — new item (1C)

Output:
  outputs/sklad_qty_crosscheck.json — before/after delta per item
  items.json items_consolidated_FROZEN_2026-05-20.json refreshed

Pattern compliance:
  Pattern 17 (Phase 0a) — DXF room tables are the canonical source
  Pattern 31 (CEV) — Matrix D D.2 sklad geometrie consistency check satisfied
  Pattern 15 (Work-First) — work-only changes, no catalog code touched

Idempotent: re-run sets same values; new item skipped if already present.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
SNAPSHOT_PATH = ROOT / "outputs" / "items_consolidated_FROZEN_2026-05-20.json"
CROSSCHECK_PATH = ROOT / "outputs" / "sklad_qty_crosscheck.json"
TODAY = str(date.today())


# DXF ground truth from km_tabulka místností layer (sklad DPZ DXF)
DXF_ROOM_TABLE = {
    "0.01": {"name": "sklad zahradní techniky", "podlaha": "beton. dlažba", "plocha_m2": 17.60},
    "1.01": {"name": "stání", "podlaha": "pororošt", "plocha_m2": 44.60},
    "1.02": {"name": "schodiště (mezipodesta)", "podlaha": "beton", "plocha_m2": 5.50},
}


# New sklad HSV5.001 item (Action 1C — gap fill)
NEW_HSV5_001 = {
    "objekt": "260217_sklad",
    "kapitola_group": "HSV",
    "_gate": "HSV",
    "kapitola": "HSV-5 Komunikace + schodiště",
    "subkapitola": "Sklad mezipodesta schodiště prefa",
    "popis": (
        "Sklad mezipodesta schodiště — prefa betonové stupně (9 ks × 179.5×250 mm) "
        "+ kladecí vrstva zavlhlého betonu nad ŽB podkladní deskou (S05 sklad skladba)"
    ),
    "mj": "m²",
    "mnozstvi": 5.50,
    "mnozstvi_formula": (
        "DXF sklad_DPZ km_tabulka místností: room 1.02 schodiště plocha = 5.50 m². "
        "9 stupňů 179.5×250 mm vyznačené v půdoryse parking sheet (Phase 3.5 cross-check)"
    ),
    "mnozstvi_confidence": 0.95,
    "urs_code_proposed": "121301101",  # placeholder family — will need production lookup
    "urs_alternatives": ["965042141", "961044111"],
    "urs_status": "needs_production_lookup",
    "urs_confidence": 0.60,
    "source": (
        "DXF sklad_DPZ km_tabulka místností room 1.02 + DXF dimension 9×179.5×250 mm "
        "+ Phase 3.5 sklad S-code mapping (S05 sklad schodiště skladba)"
    ),
    "subdodavatel": "betonar",
    "subdodavatel_status": "mapped",
    "vyjasneni_ref": [],
    "status_flag": "ready_for_phase2",
    "notes": None,
    "id": "260217_sklad.HSV5.001",
    "realizuje_skladbu": ["S05_sklad"],
    "_audit_gap_fixed": "PHASE_3_5_SKLAD_MEZIPODESTA_GAP",
    "_added_via_audit": "phase_3_5_sklad_qty_crosscheck_2026-05-26",
}


def main() -> None:
    data = json.load(ITEMS_PATH.open())
    items = data["items"]

    deltas: list[dict] = []

    # 1A — PSV77.001 podlaha sklad: 21.209 → 17.60 m²
    for it in items:
        if it["id"] != "260217_sklad.PSV77.001":
            continue
        before = {
            "mnozstvi": it.get("mnozstvi"),
            "mnozstvi_formula": it.get("mnozstvi_formula"),
            "source": it.get("source"),
        }
        target = DXF_ROOM_TABLE["0.01"]["plocha_m2"]
        delta_pct = (target - before["mnozstvi"]) / before["mnozstvi"] * 100 if before["mnozstvi"] else None
        if abs(target - (before["mnozstvi"] or 0)) > 0.02:
            it["mnozstvi"] = target
            it["mnozstvi_formula"] = (
                "DXF sklad_DPZ km_tabulka místností room 0.01 (sklad zahradní techniky) "
                "= 17.60 m² (inner usable area per DXF room table, walls excluded). "
                f"Prior estimate 21.209 m² (outer 6.35×3.34) over-counted by {abs(delta_pct):.1f}% — "
                "walls of tvarovky ZB tl. 250 mm take ~3.6 m² of outer footprint."
            )
            it["source"] = (
                "DXF sklad_DPZ km_tabulka místností + Phase 3.5 sklad qty crosscheck "
                "(Pattern 17 Phase 0a Layer 2 + Pattern 31 CEV Matrix D.2)"
            )
            it["_audit_gap_fixed"] = "PHASE_3_5_SKLAD_QTY_DXF_VERIFY"
            it["_added_via_audit"] = "phase_3_5_sklad_qty_crosscheck_2026-05-26"
            deltas.append({
                "action": "UPDATE",
                "item_id": it["id"],
                "field": "mnozstvi",
                "before": before["mnozstvi"],
                "after": target,
                "delta_pct": round(delta_pct, 2),
                "rationale": "Inner usable per DXF room table 0.01 (was outer footprint)",
            })
        else:
            deltas.append({"action": "NO_CHANGE", "item_id": it["id"], "current": before["mnozstvi"], "target": target})

    # 1B — HSV4.005 parking pororošt: 21.0 → 44.60 m²
    for it in items:
        if it["id"] != "260217_sklad.HSV4.005":
            continue
        before = {"mnozstvi": it.get("mnozstvi"), "mnozstvi_formula": it.get("mnozstvi_formula")}
        target = DXF_ROOM_TABLE["1.01"]["plocha_m2"]
        delta_pct = (target - before["mnozstvi"]) / before["mnozstvi"] * 100 if before["mnozstvi"] else None
        if abs(target - (before["mnozstvi"] or 0)) > 0.02:
            it["mnozstvi"] = target
            it["mnozstvi_formula"] = (
                "DXF sklad_DPZ km_tabulka místností room 1.01 (stání pororošt) = 44.60 m². "
                f"Prior rough estimate 21.0 m² (7×3) under-counted by {abs(delta_pct):.1f}% — "
                "actual parking footprint covers full sklad+access zone 2 cars + manoeuvring strip."
            )
            it["source"] = (
                "DXF sklad_DPZ km_tabulka místností + Phase 3.5 sklad qty crosscheck "
                "(Pattern 17 Phase 0a Layer 2 + Pattern 31 CEV Matrix D.2)"
            )
            it["_audit_gap_fixed"] = "PHASE_3_5_SKLAD_QTY_DXF_VERIFY"
            it["_added_via_audit"] = "phase_3_5_sklad_qty_crosscheck_2026-05-26"
            deltas.append({
                "action": "UPDATE",
                "item_id": it["id"],
                "field": "mnozstvi",
                "before": before["mnozstvi"],
                "after": target,
                "delta_pct": round(delta_pct, 2),
                "rationale": "Full parking footprint per DXF room table 1.01 (was rough 7×3 estimate)",
            })
        else:
            deltas.append({"action": "NO_CHANGE", "item_id": it["id"], "current": before["mnozstvi"], "target": target})

    # 1C — ADD new sklad HSV5.001 mezipodesta schodiště
    existing_ids = {(it["id"], it["kapitola"]) for it in items}
    new_key = (NEW_HSV5_001["id"], NEW_HSV5_001["kapitola"])
    if new_key not in existing_ids:
        items.append(NEW_HSV5_001)
        deltas.append({
            "action": "ADD",
            "item_id": NEW_HSV5_001["id"],
            "kapitola": NEW_HSV5_001["kapitola"],
            "mnozstvi": NEW_HSV5_001["mnozstvi"],
            "rationale": "DXF room 1.02 schodiště 5.5 m² + S05_sklad skladba (step blocks were missing — HSV2.005 lože + HSV2.006 deska cover base only)",
        })
    else:
        deltas.append({"action": "SKIP_IDEMPOTENT", "item_id": NEW_HSV5_001["id"]})

    # Recompute _summary_total
    from collections import Counter
    by_kapitola = Counter(it["kapitola"] for it in items)
    by_objekt = Counter(it["objekt"] for it in items)
    active_count = sum(1 for it in items if it.get("status_flag") != "deprecated_audit_v2")
    deprecated_count = sum(1 for it in items if it.get("status_flag") == "deprecated_audit_v2")
    urs_status_distribution = Counter(it.get("urs_status") for it in items)
    data["_summary_total"] = {
        "items_total": len(items),
        "items_active": active_count,
        "items_deprecated": deprecated_count,
        "by_kapitola": dict(by_kapitola),
        "by_objekt": dict(by_objekt),
        "urs_status_distribution": dict(urs_status_distribution),
        "items_below_conf_0_70_mnozstvi": sum(1 for it in items if (it.get("mnozstvi_confidence") or 0) < 0.70),
        "subdodavatel_needs_mapping": sum(1 for it in items if it.get("subdodavatel_status") == "needs_mapping"),
        "urs_match_rate_pct": data.get("_summary_total", {}).get("urs_match_rate_pct", 0.0),
    }

    # Append log block
    data["_phase3_5_sklad_qty_crosscheck_log"] = {
        "applied_at": TODAY,
        "purpose": (
            "Action 1 (Phase 3.5 follow-up) — sklad qty cross-check against DXF "
            "room tables. Pattern 17 (Phase 0a Layer 2 DXF room tables) + "
            "Pattern 31 (CEV Matrix D.2 sklad geometrie) + Pattern 15 (work-only "
            "changes, no catalog code touched)."
        ),
        "dxf_room_table_ground_truth": DXF_ROOM_TABLE,
        "deltas": deltas,
        "items_total_before": data.get("_per_drawing_audit_fixes_log", {}).get("items_total_after", 211),
        "items_total_after": len(items),
    }

    # Save
    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    SNAPSHOT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    # Write standalone crosscheck file
    CROSSCHECK_PATH.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": TODAY,
        "_purpose": "Sklad item qty cross-check vs DXF room tables (Action 1 deliverable).",
        "dxf_room_table_ground_truth": DXF_ROOM_TABLE,
        "items_total_before": data["_phase3_5_sklad_qty_crosscheck_log"]["items_total_before"],
        "items_total_after": len(items),
        "deltas": deltas,
    }, indent=2, ensure_ascii=False))

    # Print summary
    print(json.dumps({
        "items_total": len(items),
        "items_active": active_count,
        "items_deprecated": deprecated_count,
        "deltas": deltas,
        "outputs": {
            "items.json": str(ITEMS_PATH.relative_to(ROOT)),
            "frozen_snapshot": str(SNAPSHOT_PATH.relative_to(ROOT)),
            "crosscheck_report": str(CROSSCHECK_PATH.relative_to(ROOT)),
        },
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
