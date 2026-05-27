"""Clarify wording per user correction 2026-05-27:

5.65° = SKLON RAMPY (gradient ~10 %), NOT angle of sectional gates.
2.00° = SKLON RAMPY (gradient ~3.5 %), bezbariérová pěší.

Sectional gates are vertical lifting/rolling — they have no angle. The
ramps at gate locations have a 5.65° slope so vehicles can enter the
hala floor from the lower outside grade. The pedestrian west ramp at
2.00° meets the bezbariérová accessibility requirement.

Edits:
  - M-VK-001 audit_poznamka: replace "Sklon 5.65° sekční vrata + 2.00°
    bezbariérová pěší rampa per A101" → "Sklon rampy 5.65° (~10 %
    gradient) u sekčních vrat + sklon 2.00° (~3.5 %) na bezbariérové
    pěší rampě západ per A101 (5.65° + 2.00° = sklony ramp, NE úhly vrat).
    Vrata jsou vertikálně zdvihací sekční, bez náklonu."
  - M-VK-001 audit_inputs labels: append "_sklon_rampy" so the angle
    field is unambiguous (R1_sever_4.0×2.3_5.65deg_sklon_rampy etc.)
  - M-VK-001 popis: keep beton wording (unchanged), no slope conflict
  - Add new revisions[] entry recording the wording fix
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"

OLD_POZNAMKA = (
    "Beton C25/30 XF3 (zmrazování/rozmrazování s rozmrazovacími prostředky). "
    "Dimenzování per ČSN EN 206 + XF3 expozice. Sklon 5.65° sekční vrata + "
    "2.00° bezbariérová pěší rampa per A101. Okapní pas u ramp included v ploše."
)

NEW_POZNAMKA = (
    "Beton C25/30 XF3 (zmrazování/rozmrazování s rozmrazovacími prostředky). "
    "Dimenzování per ČSN EN 206 + XF3 expozice. Sklon RAMPY 5.65° (~10 % "
    "gradient) u sekčních vrat R1/R2/R3 + sklon RAMPY 2.00° (~3.5 % gradient) "
    "na bezbariérové pěší rampě R4 per A101. POZN: 5.65° + 2.00° jsou sklony "
    "ramp (gradient nájezdu), NE úhly vrat — sekční vrata jsou vertikálně "
    "zdvihací bez náklonu. Okapní pas u ramp included v ploše."
)

LABEL_REPLACEMENTS = {
    "R1_sever_4.0×2.3_5.65deg": "R1_sever_4.0×2.3_sklon_5.65deg",
    "R2_jih_5.0×2.3_5.65deg": "R2_jih_5.0×2.3_sklon_5.65deg",
    "R3_jih_4.0×2.3_5.65deg": "R3_jih_4.0×2.3_sklon_5.65deg",
    "R4_zapad_2.2×6.1_2.00deg_bezbarierove": "R4_zapad_2.2×6.1_sklon_2.00deg_bezbarierove",
}


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    touched = 0
    for item in raw["items"]:
        if item["id"] != "M-VK-001":
            continue
        at = item["audit_trail"]
        if at.get("poznamka") == OLD_POZNAMKA:
            at["poznamka"] = NEW_POZNAMKA
            touched += 1
        for inp in at.get("inputs", []):
            old = inp.get("label", "")
            if old in LABEL_REPLACEMENTS:
                inp["label"] = LABEL_REPLACEMENTS[old]
                touched += 1
        # Add explicit slope clarification field
        at["slope_clarification"] = (
            "5.65° + 2.00° = SKLON RAMPY (gradient nájezdu na podlahu haly), "
            "NE úhel vrat. Sekční vrata jsou vertikálně zdvihací bez náklonu. "
            "Confirmed by user 2026-05-27."
        )
        touched += 1

    if not touched:
        raise SystemExit("FATAL: no edits applied — labels/poznamka did not match")

    raw["metadata"].setdefault("revisions", []).append({
        "date": "2026-05-27",
        "change": (
            "Wording fix on M-VK-001 audit_trail — clarify 5.65° + 2.00° are "
            "SKLON RAMPY (gradient), NOT angle of sectional gates. Per user "
            "correction 2026-05-27."
        ),
        "reason": (
            "Earlier poznámka 'Sklon 5.65° sekční vrata' could be misread as "
            "'5.65° angle of gates' instead of '5.65° slope of ramp at the "
            "gate location'. Sectional gates are vertical lifting — no angle."
        ),
        "items_modified": ["M-VK-001"],
        "items_added": [],
        "items_removed": [],
        "no_quantity_change": (
            "Rampy areas unchanged: R1=9.20 + R2=11.50 + R3=9.20 + R4=13.42 = "
            "43.32 m². No mnozstvi / mj / popis change. Pure audit_trail "
            "wording + label clarification."
        ),
    })

    ITEMS_PATH.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"items.json: {touched} edits applied on M-VK-001 audit_trail")


if __name__ == "__main__":
    main()
