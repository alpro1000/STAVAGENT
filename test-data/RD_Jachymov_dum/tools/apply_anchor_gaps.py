#!/usr/bin/env python3
"""
Stage 1B-add — add CONFIRMED anchor gaps to items.json.

Per Stage 1B-verify + Alexander principle (NE add work not in TZ):
  ADD (technical necessities — physically required, povinné v rozpočtu):
    PM01 Přesun hmot pro budovu  → VRN — Přesun hmot
    PM02 Lešení fasádní          → VRN — Lešení
  NOT ADD (verify-projektant → vyjasnění only):
    PM03 hromosvod  (PBŘ no explicit → vyjasnění #22)
    PM06 terénní    (only in MU sjezd rozhodnutí, separate scope → vyjasnění #23)
  SKIP (not in TZ, rekonstrukce):
    PM04 slaboproud (medium — could be vyjasnění, but skip per "NE add not-in-TZ";
                     flag in vyjasnění #24 for completeness)
    PM05 okapový chodník + obvodová drenáž (NOT in any TZ)

Result: 212 → 214 (PM01 + PM02 only).

Per item: generic Czech popis, urs_code_proposed=null (Stage 1 work-first,
NO catalog codes), _source + _audit_gap_fixed traceability.
Snapshot already taken: outputs/items_FROZEN_pre_anchor_gaps.json
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
TODAY = str(date.today())

NEW_ITEMS = [
    {
        "objekt": "260219_dum",
        "kapitola_group": "VRN",
        "_gate": "VRN",
        "kapitola": "VRN — Přesun hmot",
        "subkapitola": "Přesun hmot pro budovu",
        "popis": (
            "Přesun hmot pro budovu — vnitrostaveništní vertikální + horizontální "
            "doprava materiálu a hmot (rekonstrukce vícepodlažní RD + nástavba 3.NP)"
        ),
        "mj": "t",
        "mnozstvi": 0,
        "mnozstvi_formula": (
            "TBD — buď % z HSV nákladů (běžně 2-4 %) nebo dle celkové tonáže "
            "přesouvaných hmot; množství doplní rozpočtář při cenotvorbě"
        ),
        "mnozstvi_confidence": 0.60,
        "urs_code_proposed": None,
        "urs_alternatives": [],
        "urs_status": "needs_production_lookup",
        "urs_confidence": 0.0,
        "source": "anchor checklist PM01 — technical necessity (povinná položka každého rozpočtu, 998xxx URS família)",
        "subdodavatel": "VRN_management",
        "subdodavatel_status": "mapped",
        "vyjasneni_ref": [],
        "status_flag": "ready_for_phase2",
        "notes": "Množství TBD při cenotvorbě (% z HSV nebo tonáž). Nástavba 3.NP → vertikální přesun nutný.",
        "id": "260219_dum.VRN.PM01",
        "realizuje_skladbu": None,
        "_audit_gap_fixed": "ANCHOR_CHECKLIST_PM01",
        "_added_via_audit": "anchor_checklist_gap_audit_2026-05-29",
    },
    {
        "objekt": "260219_dum",
        "kapitola_group": "VRN",
        "_gate": "VRN",
        "kapitola": "VRN — Lešení",
        "subkapitola": "Fasádní lešení (ETICS + krov + klempířina)",
        "popis": (
            "Fasádní lešení trubkové/rámové vč. montáže + pronájmu + demontáže — "
            "pro provedení ETICS fasády, krovu a klempířiny po obvodu domu (výška 13 m)"
        ),
        "mj": "m²",
        "mnozstvi": 503.1,
        "mnozstvi_formula": (
            "obvod domu 38.7 m × výška 13.0 m = 503.1 m² lešenné plochy "
            "(pro ETICS fasádu 276.7 m² + krov + klempířinu)"
        ),
        "mnozstvi_confidence": 0.80,
        "urs_code_proposed": None,
        "urs_alternatives": [],
        "urs_status": "needs_production_lookup",
        "urs_confidence": 0.0,
        "source": "anchor checklist PM02 — technical necessity (ETICS 276.7 m² nelze provést bez lešení, 941xxx URS família) + DXF obvod 38.7 m + řez výška 13 m",
        "subdodavatel": "VRN_management",
        "subdodavatel_status": "mapped",
        "vyjasneni_ref": [],
        "status_flag": "ready_for_phase2",
        "notes": "Lešenná plocha = obvod × výška. Pronájem dle doby ETICS + krov + klempířina.",
        "id": "260219_dum.VRN.PM02",
        "realizuje_skladbu": None,
        "_audit_gap_fixed": "ANCHOR_CHECKLIST_PM02",
        "_added_via_audit": "anchor_checklist_gap_audit_2026-05-29",
    },
]


def main() -> None:
    try:
        with ITEMS_PATH.open() as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        raise SystemExit(f"ERROR loading items.json: {e}")
    items = data["items"]

    existing_keys = {(it["id"], it["kapitola"]) for it in items}
    added, skipped = [], []
    for new in NEW_ITEMS:
        key = (new["id"], new["kapitola"])
        if key in existing_keys:
            skipped.append(new["id"])
            continue
        items.append(new)
        added.append(new["id"])

    # Recompute summary
    by_kap = Counter(it["kapitola"] for it in items)
    by_obj = Counter(it["objekt"] for it in items)
    active = sum(1 for it in items if it.get("status_flag") != "deprecated_audit_v2")
    deprecated = sum(1 for it in items if it.get("status_flag") == "deprecated_audit_v2")
    data["_summary_total"] = {
        "items_total": len(items),
        "items_active": active,
        "items_deprecated": deprecated,
        "by_kapitola": dict(by_kap),
        "by_objekt": dict(by_obj),
        "items_below_conf_0_70_mnozstvi": sum(1 for it in items if (it.get("mnozstvi_confidence") or 0) < 0.70),
        "subdodavatel_needs_mapping": sum(1 for it in items if it.get("subdodavatel_status") == "needs_mapping"),
        "urs_match_rate_pct": data.get("_summary_total", {}).get("urs_match_rate_pct", 0.0),
    }
    data["_anchor_gaps_applied_log"] = {
        "applied_at": TODAY,
        "purpose": "Stage 1B-add — confirmed anchor gaps (PM01 přesun hmot + PM02 lešení). Technical necessities only. PM03/PM05/PM06 NOT added per Stage 1B-verify (not in ARS dům TZ).",
        "items_added": added,
        "items_skipped_idempotent": skipped,
        "items_total_before": len(items) - len(added),
        "items_total_after": len(items),
        "verify_decisions": {
            "PM03_hromosvod": "VERIFY_PROJEKTANT — PBŘ no explicit LPS → vyjasnění #22, NOT added",
            "PM04_slaboproud": "SKIP — not in TZ (rekonstrukce); vyjasnění #24 flag",
            "PM05_okapovy_chodnik_drenaz": "SKIP — NOT in any TZ",
            "PM06_terenni_upravy": "VERIFY_PROJEKTANT — only in MU sjezd rozhodnutí (separate scope) → vyjasnění #23, NOT added",
        },
        "snapshot_before": "outputs/items_FROZEN_pre_anchor_gaps.json",
    }

    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(json.dumps({
        "items_total": len(items),
        "added": added,
        "skipped_idempotent": skipped,
        "VRN_Přesun_hmot": by_kap.get("VRN — Přesun hmot", 0),
        "VRN_Lešení": by_kap.get("VRN — Lešení", 0),
        "verify_only_not_added": ["PM03 hromosvod", "PM06 terénní"],
        "skipped_not_in_tz": ["PM04 slaboproud", "PM05 okapový chodník"],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
