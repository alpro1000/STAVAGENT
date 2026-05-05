"""Phase 3c Part A — SDK generation (PSV-763.1–4).

Sub-categories:
  PSV-763.1 SDK podhledy        — rooms with CF20/CF21
  PSV-763.2 SDK předstěny       — rooms with WF40/41/50/51 segment tags
  PSV-763.3 SDK podkroví        — 3.NP skosné stropy (skat 31° = 195 m² spec)
  PSV-763.4 SDK na nadezdívce   — rooms with WF11/WF22 segment tags

Output: test-data/libuse/outputs/items_phase_3c_sdk.json
"""
from __future__ import annotations

import json
import sys
import uuid
from collections import Counter, defaultdict
from pathlib import Path

DS = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")
OUT = Path("test-data/libuse/outputs/items_phase_3c_sdk.json")

# Heights (mm) per WF code
WF_HEIGHT_MM = {
    "WF40": 1400, "WF41": 1400,
    "WF50": 150,  "WF51": 150,
    "WF11": 3500, "WF22": 3500,  # nadezdívky 3.NP
}
# Default segment length when DXF doesn't tell us — 2.5 m typical wall
DEFAULT_WF_SEGMENT_LEN_M = 2.5

# Spec ground truth for podkroví roof skat 31°
SKAT_31_M2 = 195.0


def make_item(kapitola, popis, mj, mnozstvi, misto, skladba_ref=None,
              vyrobce_ref="", confidence=0.85, poznamka="", warnings=None):
    return {
        "item_id": str(uuid.uuid4()),
        "kapitola": kapitola,
        "popis": popis,
        "MJ": mj,
        "mnozstvi": round(mnozstvi, 3),
        "misto": misto,
        "skladba_ref": skladba_ref or {},
        "vyrobce_ref": vyrobce_ref,
        "urs_code": None,
        "urs_description": None,
        "confidence": confidence,
        "status": "to_audit",
        "poznamka": poznamka,
        "warnings": warnings or [],
    }


def gen_PSV_763_1_podhledy(rooms):
    """Per room with CF20/CF21 — full SDK ceiling decomposition."""
    items = []
    for r in rooms:
        cf = r.get("CF", "")
        if cf not in ("CF20", "CF21"):
            continue
        plocha = r.get("plocha_podlahy_m2") or 0
        if plocha <= 0:
            continue
        is_impreg = cf == "CF21"
        misto = {"objekt": "D", "podlazi": r["podlazi"], "mistnosti": [r["code"]]}
        skl = {"CF": cf, "vrstva": "SDK podhled" + (" impregnovaný" if is_impreg else "")}
        items.append(make_item("PSV-763.1", f"Konstrukce podhledu UD/CD profily ({cf})",
                               "m", plocha * 3.0, misto, skl,
                               poznamka="3 m profilů na m² (rozteč CD 400 mm)"))
        items.append(make_item("PSV-763.1", f"Závěsy posuvné podhled ({cf})",
                               "ks", plocha * 1.5, misto, skl, poznamka="~1.5 ks/m²"))
        items.append(make_item("PSV-763.1",
                               f"SDK desky 1× 12.5 mm{' impregnované' if is_impreg else ''} ({cf})",
                               "m2", plocha * 1.05, misto, skl,
                               vyrobce_ref="např. Knauf Diamant" if is_impreg else "Knauf",
                               poznamka="cut waste 5 %"))
        items.append(make_item("PSV-763.1", f"Tmelení Q3 + tmelení šroubů ({cf})",
                               "m2", plocha, misto, skl))
    return items


def gen_PSV_763_2_predsteny(rooms):
    """Per room with WF40/41/50/51 wall_segment_tags — předstěna."""
    items = []
    for r in rooms:
        for tag in r.get("wall_segment_tags", []):
            if tag not in ("WF40", "WF41", "WF50", "WF51"):
                continue
            misto = {"objekt": "D", "podlazi": r["podlazi"], "mistnosti": [r["code"]]}
            seg_len_m = DEFAULT_WF_SEGMENT_LEN_M
            height_m = WF_HEIGHT_MM[tag] / 1000.0
            plocha = seg_len_m * height_m
            skl = {"WF": tag, "vrstva": f"předstěna SDK h={height_m:.2f} m"}
            warns = [f"WF segment length estimated {seg_len_m} m (no DXF wall-length lookup)"]
            items.append(make_item("PSV-763.2",
                                   f"UW + CW profily 50 mm ({tag} h={height_m:.2f} m)",
                                   "m", plocha * 4.0, misto, skl, warnings=warns,
                                   poznamka="~4 m profilů/m²"))
            items.append(make_item("PSV-763.2",
                                   f"SDK desky 2× 12.5 mm impregnované ({tag})",
                                   "m2", plocha * 2 * 1.05, misto, skl,
                                   vyrobce_ref="Knauf Diamant impregnated",
                                   warnings=warns))
            items.append(make_item("PSV-763.2",
                                   f"Izolace minerální vata 50 mm ({tag})",
                                   "m2", plocha, misto, skl,
                                   vyrobce_ref="Isover Akusto Wall", warnings=warns))
            items.append(make_item("PSV-763.2", f"Tmelení Q3 ({tag})",
                                   "m2", plocha, misto, skl, warnings=warns))
            items.append(make_item("PSV-763.2", f"Kotvení do nosné stěny + ke stropu ({tag})",
                                   "ks", int(seg_len_m * 2 + height_m * 2), misto, skl,
                                   poznamka="~2 ks/m kotvení", warnings=warns))
    return items


def gen_PSV_763_3_podkrovi():
    """3.NP podkroví — skosné stropy SDK záklop."""
    items = []
    plocha = SKAT_31_M2
    misto = {"objekt": "D", "podlazi": "3.NP", "mistnosti": []}
    skl = {"vrstva": "SDK podkroví podhled"}
    items.append(make_item("PSV-763.3", "Parozábrana fólie pod SDK podkroví",
                           "m2", plocha * 1.1, misto, skl, poznamka="overlap 10 %"))
    items.append(make_item("PSV-763.3", "Konstrukce SDK profily UD/CD podkroví",
                           "m", plocha * 3.0, misto, skl))
    items.append(make_item("PSV-763.3", "Závěsy posuvné podkroví",
                           "ks", plocha * 1.5, misto, skl))
    items.append(make_item("PSV-763.3", "SDK desky 2× 12.5 mm protipožární GKF podkroví",
                           "m2", plocha * 2 * 1.05, misto, skl,
                           vyrobce_ref="Knauf Diamant + Knauf GKF"))
    items.append(make_item("PSV-763.3", "Izolace minerální vata mezikrokevní 200 mm podkroví",
                           "m2", plocha, misto, skl, vyrobce_ref="Isover Unirol Profi"))
    items.append(make_item("PSV-763.3", "Izolace minerální vata nadkrokevní 100 mm podkroví",
                           "m2", plocha, misto, skl, vyrobce_ref="Isover EPS GreyWall"))
    items.append(make_item("PSV-763.3", "Tmelení Q3 podkroví",
                           "m2", plocha, misto, skl))
    return items


def gen_PSV_763_4_nadezdivka(rooms):
    """WF11 + WF22 in 3.NP — nadezdívky."""
    items = []
    for r in rooms:
        if r.get("podlazi") != "3.NP":
            continue
        for tag in r.get("wall_segment_tags", []):
            if tag not in ("WF11", "WF22"):
                continue
            misto = {"objekt": "D", "podlazi": "3.NP", "mistnosti": [r["code"]]}
            seg_len_m = DEFAULT_WF_SEGMENT_LEN_M
            height_m = WF_HEIGHT_MM[tag] / 1000.0
            plocha = seg_len_m * height_m
            skl = {"WF": tag, "vrstva": f"nadezdívka SDK h={height_m:.1f} m"}
            warns = [f"{tag} segment length estimated {seg_len_m} m"]
            items.append(make_item("PSV-763.4",
                                   f"Ocelová konstrukce profily KEW 150 ({tag})",
                                   "kg", plocha * 18.0, misto, skl,
                                   poznamka="~18 kg/m² pro KEW 150 stojiny",
                                   warnings=warns))
            if tag == "WF22":
                items.append(make_item("PSV-763.4",
                                       "Cementová deska Aquapanel 12.5 mm (WF22)",
                                       "m2", plocha * 1.05, misto, skl,
                                       vyrobce_ref="Knauf Aquapanel Outdoor",
                                       warnings=warns))
            items.append(make_item("PSV-763.4",
                                   f"Tepelná izolace minerální vata 150 mm ({tag})",
                                   "m2", plocha, misto, skl,
                                   vyrobce_ref="Isover TF Profi", warnings=warns))
            items.append(make_item("PSV-763.4", f"Parozábrana ({tag})",
                                   "m2", plocha * 1.1, misto, skl, warnings=warns))
            items.append(make_item("PSV-763.4",
                                   f"Instalační předstěna profily 50 mm ({tag})",
                                   "m", plocha * 3.0, misto, skl, warnings=warns))
            items.append(make_item("PSV-763.4",
                                   f"Dvojitý SDK záklop 25 mm ({tag})",
                                   "m2", plocha * 2 * 1.05, misto, skl,
                                   vyrobce_ref="Knauf Diamant 12.5 mm × 2",
                                   warnings=warns))
            items.append(make_item("PSV-763.4", f"Tmelení Q3 ({tag})",
                                   "m2", plocha, misto, skl, warnings=warns))
    return items


def main() -> None:
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    rooms = dataset["rooms"]

    items = []
    items.extend(gen_PSV_763_1_podhledy(rooms))
    items.extend(gen_PSV_763_2_predsteny(rooms))
    items.extend(gen_PSV_763_3_podkrovi())
    items.extend(gen_PSV_763_4_nadezdivka(rooms))

    by_kap = defaultdict(lambda: {"count": 0, "by_mj": defaultdict(float)})
    for it in items:
        by_kap[it["kapitola"]]["count"] += 1
        by_kap[it["kapitola"]]["by_mj"][it["MJ"]] += it["mnozstvi"]
    by_kap_clean = {k: {"count": v["count"], "totals": {mj: round(t, 2) for mj, t in v["by_mj"].items()}}
                     for k, v in by_kap.items()}

    out = {
        "metadata": {
            "phase": "3c",
            "part": "A — SDK",
            "kapitoly": ["PSV-763.1", "PSV-763.2", "PSV-763.3", "PSV-763.4"],
            "items_count": len(items),
            "summary_per_kapitola": by_kap_clean,
            "wf_segment_length_assumed_m": DEFAULT_WF_SEGMENT_LEN_M,
            "wf_height_mm": WF_HEIGHT_MM,
        },
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print(f"Items: {len(items)}")
    for k, v in sorted(by_kap_clean.items()):
        print(f"  {k:10s} count={v['count']:>4}  totals={v['totals']}")


if __name__ == "__main__":
    main()
