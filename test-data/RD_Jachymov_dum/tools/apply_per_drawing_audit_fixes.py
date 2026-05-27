#!/usr/bin/env python3
"""
Apply per-drawing audit fixes to items.json.

Per CEV per-drawing annotations audit (commit 91ab8d2) — 3 GAPs + 1 ENRICHMENT:
  POZN.1.02 → new HSV6.016  (komín bourání)
  POZN.1.03 → new HSV6.017  (opěrné zídky + venkovní schodiště bourání)
  POZN.2.02 → new HSV1.015  (drenáž za bílou vanou)
  POZN.2.05 → reword VRN.001 (add dřevokazný hmyz survey scope)

Schema mirrors existing items.json conventions (id, popis, mj, mnozstvi,
mnozstvi_formula, mnozstvi_confidence, source, urs_code_proposed,
urs_status, urs_confidence, subdodavatel, subdodavatel_status,
vyjasneni_ref, status_flag, notes). Adds two trace fields:
  _audit_gap_fixed   — tag matching cev_per_drawing audit verdict
  _added_via_audit   — date + source artefact

`_per_drawing_audit_fixes_log` block appended to top-level metadata,
parallel to existing `_audit_v2_fixes_applied_log`.

Idempotent: re-run skips items whose id+_audit_gap_fixed already match.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
TODAY = str(date.today())

# Three new items
NEW_ITEMS: list[dict] = [
    {
        "objekt": "260219_dum",
        "kapitola_group": "HSV",
        "_gate": "HSV",
        "kapitola": "HSV-6 Bourací práce",
        "subkapitola": "Bourání zdiva komínu",
        "popis": (
            "Bourání vrchní části stávajícího komínu v posledním podlaží "
            "(cihelné zdivo, ručně), vč. likvidace cihelné suti"
        ),
        "mj": "m³",
        "mnozstvi": 6.0,
        "mnozstvi_formula": (
            "průměr komín 0.50×0.50 × výška nad střechou ~2.4 m = 0.6 m³, "
            "× 10 m³ buffer pro suti + manipulace = 6.0 m³"
        ),
        "mnozstvi_confidence": 0.75,
        "urs_code_proposed": "962024141",
        "urs_alternatives": ["962024151", "965042141"],
        "urs_status": "needs_production_lookup",
        "urs_confidence": 0.65,
        "source": "DXF dum_DPZ řez A-A bourání + POZN.1.02 z půdorysů bourání",
        "subdodavatel": "bourani_demolice",
        "subdodavatel_status": "mapped",
        "vyjasneni_ref": [9],
        "status_flag": "ready_for_phase2",
        "notes": None,
        "id": "260219_dum.HSV6.016",
        "_audit_gap_fixed": "PER_DRAWING_GAP_POZN_1_02",
        "_added_via_audit": "cev_per_drawing_annotations_audit_2026-05-26",
    },
    {
        "objekt": "260219_dum",
        "kapitola_group": "HSV",
        "_gate": "HSV",
        "kapitola": "HSV-6 Bourací práce",
        "subkapitola": "Bourání venkovních konstrukcí",
        "popis": (
            "Bourání stávajících opěrných zídek a venkovního schodiště "
            "v zahradě/dvoře — částečné, dle vyznačení v půdorysech bourání"
        ),
        "mj": "m³",
        "mnozstvi": 8.0,
        "mnozstvi_formula": (
            "odhad ze řez A-A bourání + půdorys bourání 1.NP/1.PP, "
            "~8 m³ celkem (opěrné zídky + venkovní schodiště zahrada/dvůr)"
        ),
        "mnozstvi_confidence": 0.70,
        "urs_code_proposed": "961044111",
        "urs_alternatives": ["962031321", "965042141"],
        "urs_status": "needs_production_lookup",
        "urs_confidence": 0.60,
        "source": "DXF dum_DPZ řez A-A bourání + POZN.1.03 + půdorys bourání",
        "subdodavatel": "bourani_demolice",
        "subdodavatel_status": "mapped",
        "vyjasneni_ref": [9],
        "status_flag": "ready_for_phase2",
        "notes": None,
        "id": "260219_dum.HSV6.017",
        "_audit_gap_fixed": "PER_DRAWING_GAP_POZN_1_03",
        "_added_via_audit": "cev_per_drawing_annotations_audit_2026-05-26",
    },
    {
        "objekt": "260219_dum",
        "kapitola_group": "HSV",
        "_gate": "HSV",
        "kapitola": "HSV-1 Zemní práce",
        "subkapitola": "Drenáž za bílou vanou",
        "popis": (
            "Drenáž za opěrnou stěnou (bílou vanou) — drenážní trubka "
            "DN100 vlnitá perforovaná + štěrkový obsyp 16/32 + geotextilie + "
            "napojení do dešťové kanalizace, L po obvodu BV"
        ),
        "mj": "m",
        "mnozstvi": 12.0,
        "mnozstvi_formula": "obvod bílé vany ~10 m + napojení 2 m = 12 m",
        "mnozstvi_confidence": 0.80,
        "urs_code_proposed": "877315111",
        "urs_alternatives": ["873311111", "899711111"],
        "urs_status": "needs_production_lookup",
        "urs_confidence": 0.70,
        "source": (
            "TZ ARS dům §3.2 (drenáž za opěrnou stěnou) + POZN.2.02 z půdorysů návrh + řez A-A návrh"
        ),
        "subdodavatel": "izolater_HI",
        "subdodavatel_status": "mapped",
        "vyjasneni_ref": [8],
        "status_flag": "ready_for_phase2",
        "notes": None,
        "id": "260219_dum.HSV1.015",
        "_audit_gap_fixed": "PER_DRAWING_GAP_POZN_2_02",
        "_added_via_audit": "cev_per_drawing_annotations_audit_2026-05-26",
    },
]

# VRN.001 enrichment payload (replaces popis + source, leaves other fields)
VRN_001_ENRICHMENT = {
    "popis": (
        "Mykologický průzkum + průzkum výskytu dřevokazného hmyzu stávajícího "
        "krovu a dřevěných trámů zhlaví — pro vyloučení narušení dřevěných "
        "konstrukcí; provádí autorizovaný mykolog při bourání"
    ),
    "source": (
        "TZ ARS dům §3.2.3 + POZN.2.05 z půdorysů návrh + řez A-A návrh "
        "(explicit dřevokazný hmyz scope per drawing wording)"
    ),
    "_audit_gap_fixed": "PER_DRAWING_ENRICHMENT_POZN_2_05",
    "_added_via_audit": "cev_per_drawing_annotations_audit_2026-05-26",
}


def main() -> None:
    data = json.load(ITEMS_PATH.open())
    items = data["items"]
    existing_ids = {it["id"] for it in items}

    added: list[str] = []
    skipped: list[str] = []
    for new in NEW_ITEMS:
        if new["id"] in existing_ids:
            skipped.append(new["id"])
            continue
        items.append(new)
        added.append(new["id"])

    # Restore original Zařízení staveniště VRN.001 if the prior buggy patch
    # accidentally overwrote it. id `260219_dum.VRN.001` collides across 9 VRN
    # sub-kapitolas — earlier code picked the FIRST match (ZS), not the Průzkumy.
    ORIGINAL_ZS_VRN001 = {
        "popis": (
            "Zařízení staveniště — buňka kancelář + sociální buňka "
            "(WC + šatna), pronájem ~8 měsíců"
        ),
        "source": (
            "TZ B m.1.m realizace 2026-2027 + standard staveniště RD městská zástavba"
        ),
    }
    restored_zs = False
    for it in items:
        if it["id"] != "260219_dum.VRN.001":
            continue
        if it.get("kapitola") != "VRN — Zařízení staveniště":
            continue
        if it.get("_audit_gap_fixed") == VRN_001_ENRICHMENT["_audit_gap_fixed"]:
            # Buggy overwrite detected — restore and drop the audit tag
            it["popis"] = ORIGINAL_ZS_VRN001["popis"]
            it["source"] = ORIGINAL_ZS_VRN001["source"]
            it.pop("_audit_gap_fixed", None)
            it.pop("_added_via_audit", None)
            restored_zs = True

    # Now find the Průzkumy VRN.001 specifically (id + kapitola match)
    vrn_target = None
    for it in items:
        if it["id"] == "260219_dum.VRN.001" and it.get("kapitola") == "VRN — Průzkumy":
            vrn_target = it
            break
    if vrn_target is None:
        raise RuntimeError("VRN.001 / VRN — Průzkumy not found — schema drift?")

    vrn_before = {"popis": vrn_target["popis"], "source": vrn_target["source"]}
    if vrn_target.get("_audit_gap_fixed") != VRN_001_ENRICHMENT["_audit_gap_fixed"]:
        vrn_target.update(VRN_001_ENRICHMENT)
        vrn_enriched = True
    else:
        vrn_enriched = False

    # Recompute _summary_total
    from collections import Counter

    by_kapitola = Counter(it["kapitola"] for it in items)
    by_objekt = Counter(it["objekt"] for it in items)
    urs_status_distribution = Counter(it.get("urs_status") for it in items)
    active_count = sum(1 for it in items if it.get("status_flag") != "deprecated_audit_v2")
    deprecated_count = sum(1 for it in items if it.get("status_flag") == "deprecated_audit_v2")
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

    # Append per-drawing audit log block
    data["_per_drawing_audit_fixes_log"] = {
        "applied_at": TODAY,
        "audit_source": "outputs/cev_per_drawing_annotations_audit.json (commit 91ab8d2)",
        "items_added": added,
        "items_skipped_idempotent": skipped,
        "vrn_001_prouzkumy_enriched": vrn_enriched,
        "vrn_001_prouzkumy_before": vrn_before if vrn_enriched else None,
        "vrn_001_zs_restored_from_prior_buggy_overwrite": restored_zs,
        "id_collision_note": (
            "id `260219_dum.VRN.001` is reused across 9 VRN sub-kapitolas in "
            "items.json — schema-level data integrity issue worth fixing in a "
            "future refactor (one canonical id per item). For now, identity is "
            "resolved via (id, kapitola) pair when targeting a specific entry."
        ),
        "gaps_fixed": [
            "PER_DRAWING_GAP_POZN_1_02",
            "PER_DRAWING_GAP_POZN_1_03",
            "PER_DRAWING_GAP_POZN_2_02",
            "PER_DRAWING_ENRICHMENT_POZN_2_05",
        ],
        "items_total_before": len(items) - len(added),
        "items_total_after": len(items),
    }

    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(json.dumps({
        "items_total": len(items),
        "items_active": active_count,
        "items_deprecated": deprecated_count,
        "added": added,
        "skipped_idempotent": skipped,
        "vrn_001_prouzkumy_enriched": vrn_enriched,
        "vrn_001_zs_restored": restored_zs,
        "by_kapitola_changes": {
            "HSV-6 Bourací práce": by_kapitola.get("HSV-6 Bourací práce", 0),
            "HSV-1 Zemní práce": by_kapitola.get("HSV-1 Zemní práce", 0),
            "VRN — Průzkumy": by_kapitola.get("VRN — Průzkumy", 0),
            "VRN — Zařízení staveniště": by_kapitola.get("VRN — Zařízení staveniště", 0),
        },
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
