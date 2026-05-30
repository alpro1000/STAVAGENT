#!/usr/bin/env python3
"""
Situace-measured area correction (2026-05-29) — legend zpevněné plochy: dlažba vs terasa.

Situace measurement + legend (zpevněné plochy — dlažba [brick-hatch] vs terasa [line-hatch]):
  - terasa (line-hatch, dřevěná)        = 9.23 m²
  - anglický dvorek (brick-hatch dlažba) = 12.46 + 4.08 = 16.54 m²
  - venkovní schody na terénu (red/ŽB)   = 8×175×280 + 5×175×280 = 13 stupňů (NEW item)

Earlier ODHAD had terasa 30 + dvorek 30 (both from rough DXF PLOT_DREVENY). Corrected here
to measured values. New HSV1.016 = betonové schody na terénu (TZ statika §3.2.5), code blank
(Pattern 26 — família ÚRS not yet bound).

(id, kapitola) compound key (Pattern 28). Idempotent. items 214 → 215 (+1 stairs).
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "outputs" / "items_rd_jachymov_complete.json"

TAG = "SITUACE_AREA_FIX_2026-05-29"


def patch_dvorek(it: dict) -> None:
    it["mnozstvi"] = 16.54
    it["mnozstvi_formula"] = (
        "Situace měření 2026-05-29 — anglický dvorek (zpevněné plochy DLAŽBA, brick-hatch) "
        "= 12.46 + 4.08 = 16.54 m². Dříve ODHAD 30 m²."
    )
    it["mnozstvi_confidence"] = 0.95
    it["_data_quality"] = "situace_measured"
    it["_audit_gap_fixed"] = (str(it.get("_audit_gap_fixed") or "").strip("; ") + "; " + TAG).strip("; ")


def patch_terasa_substructure(it: dict) -> None:
    it["mnozstvi"] = 9.23
    it["mnozstvi_formula"] = (
        "Situace měření 2026-05-29 — terasa (zpevněné plochy TERASA, line-hatch, dřevěná) = 9.23 m². "
        "Dříve ODHAD 30 m². Dlažba 12.46+4.08 = anglický dvorek HSV1.004 (jiná konstrukce). "
        "ŘEZ C-C: dlaždice = roznášecí vrstva POD terče; terče nesou dřevěnou pochozí vrstvu PSV76.002."
    )
    it["mnozstvi_confidence"] = 0.95
    it["_data_quality"] = "situace_measured"
    it["_audit_gap_fixed"] = (str(it.get("_audit_gap_fixed") or "").strip("; ") + "; " + TAG).strip("; ")


def patch_terasa_wood(it: dict) -> None:
    it["mnozstvi"] = 9.23
    it["mnozstvi_formula"] = (
        "Situace měření 2026-05-29 — dřevěná terasa (line-hatch zpevněné plochy) = 9.23 m². "
        "Dříve ODHAD 30 m². Terče + podkladní skladba viz HSV1.005 (split-by-trade)."
    )
    it["mnozstvi_confidence"] = 0.95
    it["_data_quality"] = "situace_measured"
    it["_audit_gap_fixed"] = (str(it.get("_audit_gap_fixed") or "").strip("; ") + "; " + TAG).strip("; ")


STAIRS_ITEM = {
    "objekt": "260219_dum",
    "kapitola_group": "HSV",
    "_gate": "HSV",
    "kapitola": "HSV-1 Zemní práce",
    "subkapitola": "Venkovní schody na terénu (zahrada za opěrnou stěnou)",
    "popis": (
        "Venkovní schody na terénu z betonových dílců do betonového lože — rameno 1: 8×175×280 mm "
        "+ rameno 2: 5×175×280 mm (13 stupňů), zahrada za opěrnou stěnou"
    ),
    "mj": "ks",
    "mnozstvi": 13,
    "mnozstvi_formula": "Situace měření 2026-05-29: rameno 1 = 8 stupňů + rameno 2 = 5 stupňů = 13 stupňů (175×280 mm)",
    "mnozstvi_confidence": 0.9,
    "urs_code_proposed": None,
    "urs_alternatives": [],
    "urs_status": "needs_lookup",
    "urs_confidence": 0.0,
    "source": (
        "Situace měření 2026-05-29 (rameno 8×175×280 + rameno 5×175×280) + TZ statika §3.2.5 "
        "'schody na terénu z betonových dílců do betonového lože'"
    ),
    "subdodavatel": "zednik",
    "subdodavatel_status": "mapped",
    "vyjasneni_ref": [],
    "status_flag": "ready_for_phase2",
    "notes": None,
    "_data_quality": "situace_measured",
    "id": "260219_dum.HSV1.016",
    "realizuje_skladbu": "Venkovní schody na terénu",
    "urs_code_family_6digit": None,
    "correct_code_hint": (
        "Venkovní betonové schody na terénu z dílců do lože — família ÚRS ověřit "
        "(kandidáti: 935 drobné betonové konstrukce / 917-919 osazení betonových dílců / 564 lože). "
        "Leaf z app.urs.cz. Pattern 26: kód blank dokud neověřeno."
    ),
    "_audit_gap_fixed": "SITUACE_STAIRS_ADD_2026-05-29",
}


def main() -> None:
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"]

    targets = {
        ("260219_dum.HSV1.004", "HSV-1 Zemní práce"): patch_dvorek,
        ("260219_dum.HSV1.005", "HSV-1 Zemní práce"): patch_terasa_substructure,
        ("260219_dum.PSV76.002", "PSV-76 Truhlář"): patch_terasa_wood,
    }
    hit = {k: False for k in targets}
    for it in items:
        key = (it.get("id"), it.get("kapitola"))
        if key in targets and not hit[key]:
            targets[key](it)
            hit[key] = True
    missing = [k for k, v in hit.items() if not v]
    if missing:
        raise SystemExit(f"FAIL — target(s) not found: {missing}")

    # add stairs item (idempotent)
    if not any(it.get("id") == "260219_dum.HSV1.016" for it in items):
        items.append(dict(STAIRS_ITEM))

    data["_situace_area_fix_log"] = {
        "applied_at": "2026-05-29",
        "tag": TAG,
        "source": "Situace měření + legend (zpevněné plochy: dlažba [brick] vs terasa [line])",
        "changes": {
            "HSV1.004 anglický dvorek (dlažba)": "30 → 16.54 m² (12.46 + 4.08, brick-hatch)",
            "HSV1.005 terasa podklad (line-hatch)": "30 → 9.23 m²",
            "PSV76.002 terasa dřevo (line-hatch)": "30 → 9.23 m²",
            "HSV1.016 venkovní schody na terénu": "NEW — 13 stupňů (8×175×280 + 5×175×280), code blank (Pattern 26)",
        },
        "snapshot_before": "outputs/items_pre_terasa_area_fix.json",
        "items_total": len(items),
    }

    ITEMS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK — dvorek=16.54, terasa=9.23 (×2), +HSV1.016 stairs. items_total={len(items)}.")


if __name__ == "__main__":
    main()
