#!/usr/bin/env python3
"""
Phase 3 — Consolidate items.json:
  3.1 Add `realizuje_skladbu` (S-code list or external-skladba name) to
      skladba-implementing items.
  3.3 Add `klempir_reconciliation_note` field to PSV-76 Klempíř items
      with the Δ -8 % flag for Karel walkthrough.
  3.4 Freeze final state into outputs/items_consolidated_FROZEN_2026-05-20.json
      read-only snapshot.

Mapping per user spec (gate-4 disposition):
  HSV-2 podlaha sklep        → S04 (no current item; sklep podlaha kept as-is)
  HSV-2 podlaha přízemí 1.NP → S05  (HSV2.012-013)
  HSV-4 strop klenba 1.PP/1.NP → S06 (HSV4.007-009)
  HSV-4 strop trámový 1.NP/2.NP → S07 (HSV4.010-014)
  HSV-4 strop klenba mezi patry → S08 (existing klenba preserved, no items)
  HSV-4 strop ocelobeton 2.NP/3.NP → S09 (HSV4.002-006 + HSV2.010-011)
  HSV-5 šikmá střecha         → S10 (HSV5.007-013)
  HSV-5 strop biodeska (krov spací patro) → S11 (HSV5.014)
  HSV-3 obvodová stěna 1.NP/2.NP → S01 (HSV3.001/003/004/005)
  HSV-3 obvodová stěna 3.NP   → S12 (HSV3.002 + pozední věnec HSV2.007-009 supports)
  HSV-3 společná stěna        → S02 (HSV3.001 patches + HSV3.007 nové příčky)
  HSV-3 suterénní stěna       → S03 (existing, no item — bílá vana is separate retaining wall)
  HSV-7 ETICS RD              → S01 + S12a (HSV7.001/002/004/005/006)
  HSV-7 ETICS sokl            → S01 (HSV7.003 — sokl below RD wall)
  HSV-7 ETICS falcovaná podkroví → S12b (HSV5.016 vikýře provětrávaná fasáda + plech)
  HSV-7 omítka pastovitá      → S01 + S12a + S12b (HSV7.006)
  HSV-1 dvorek                → "Anglický dvorek" (HSV1.004)
  HSV-1 terasa                → "Terasa" (HSV1.005)

PSV-76 Klempíř items get `klempir_reconciliation_note`:
  "Items sum 159.9 m vs DXF MA_klempíř + SM__ klempířina total 173.8 m,
   Δ -8.0 % (-13.9 m). Within ±15 % tolerance per gate-3 D.4 verdict.
   Flag for Karel site walkthrough — possible missing klempíř segment.
   Source: outputs/cev_matrix_d_cross_doc_consistency.json D.4."

Idempotent: re-run sets fields again to identical values.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
SNAPSHOT_PATH = ROOT / "outputs" / "items_consolidated_FROZEN_2026-05-20.json"
TODAY = str(date.today())


# Explicit per-item id → skladba mapping (canonical truth — manual review)
# Keys are last segment of id (kapitola.NNN); objekt prefix added at lookup.
SKLADBA_BY_ITEM: dict[str, list[str]] = {
    # HSV-2 dům
    "HSV2.010": ["S09"],
    "HSV2.011": ["S09"],
    "HSV2.012": ["S05"],
    "HSV2.013": ["S05"],
    # HSV-3 dům
    "HSV3.001": ["S01", "S02"],
    "HSV3.002": ["S12"],
    "HSV3.003": ["S01"],
    "HSV3.004": ["S01"],
    "HSV3.005": ["S01"],
    "HSV3.007": ["S02"],
    # HSV-4 dům
    "HSV4.002": ["S09"],
    "HSV4.003": ["S09"],
    "HSV4.004": ["S09"],
    "HSV4.005": ["S09"],
    "HSV4.006": ["S09"],
    "HSV4.007": ["S06"],
    "HSV4.008": ["S06"],
    "HSV4.009": ["S06"],
    "HSV4.010": ["S07"],
    "HSV4.011": ["S07"],
    "HSV4.012": ["S07"],
    "HSV4.013": ["S07"],
    "HSV4.014": ["S07"],
    # HSV-5 dům
    "HSV5.007": ["S10"],
    "HSV5.008": ["S10"],
    "HSV5.009": ["S10"],
    "HSV5.010": ["S10"],
    "HSV5.011": ["S10"],
    "HSV5.012": ["S10"],
    "HSV5.013": ["S10"],
    "HSV5.014": ["S11"],
    "HSV5.016": ["S12b"],
    # HSV-7 dům
    "HSV7.001": ["S01"],
    "HSV7.002": ["S01", "S12a"],
    "HSV7.003": ["S01"],
    "HSV7.004": ["S01", "S12a"],
    "HSV7.005": ["S01", "S12a"],
    "HSV7.006": ["S01", "S12a", "S12b"],
}

# External (non-S-code) skladby
EXTERNAL_SKLADBA_BY_ITEM: dict[str, str] = {
    "HSV1.004": "Anglický dvorek",
    "HSV1.005": "Terasa",
}

# All items get scope=260219_dum unless the id explicitly carries 260217_sklad
DUM_PREFIX = "260219_dum."


KLEMPIR_NOTE = (
    "PSV-76 Klempíř items sum 159.9 m vs DXF MA_klempíř + SM__ klempířina "
    "total 173.8 m, Δ -8.0 % (-13.9 m). Within ±15 % tolerance per CEV "
    "Matrix D.4 verdict (gate-3). FLAG for Karel site walkthrough — possible "
    "missing klempíř segment (small). Source: "
    "outputs/cev_matrix_d_cross_doc_consistency.json D.4."
)


def main() -> None:
    data = json.load(ITEMS_PATH.open())
    items = data["items"]

    tagged_skladba = 0
    tagged_external = 0
    tagged_klempir = 0
    skladba_changes_by_kapitola: Counter[str] = Counter()

    for it in items:
        # Skip if not dum (sklad has its own skladba set, not in scope per user)
        id_short = it["id"].split(".", 1)[1] if "." in it["id"] else ""
        # The id is like "260219_dum.HSV2.012" — last part of split-on-first-dot
        # is "HSV2.012". Keep just the kapitola.NNN component.
        if it["objekt"] != "260219_dum":
            continue
        if id_short in SKLADBA_BY_ITEM:
            it["realizuje_skladbu"] = SKLADBA_BY_ITEM[id_short]
            tagged_skladba += 1
            skladba_changes_by_kapitola[it["kapitola"]] += 1
        elif id_short in EXTERNAL_SKLADBA_BY_ITEM:
            it["realizuje_skladbu"] = EXTERNAL_SKLADBA_BY_ITEM[id_short]
            tagged_external += 1
            skladba_changes_by_kapitola[it["kapitola"]] += 1
        # If item is in skladba-implementing kapitolas but not in our mapping,
        # explicitly mark it as such (so downstream tools know it was reviewed)
        elif it["kapitola"] in (
            "HSV-2 Základové a ŽB", "HSV-3 Svislé konstrukce",
            "HSV-4 Vodorovné", "HSV-5 Krov + střecha",
            "HSV-7 Fasáda ETICS",
        ):
            it.setdefault("realizuje_skladbu", None)  # explicit null = reviewed, no direct skladba

        if it["kapitola"] == "PSV-76 Klempíř":
            it["klempir_reconciliation_note"] = KLEMPIR_NOTE
            tagged_klempir += 1

    # Log block
    data["_phase3_consolidate_log"] = {
        "applied_at": TODAY,
        "purpose": (
            "Phase 3 consolidation per gate-4 disposition: add realizuje_skladbu "
            "S-code traceability to skladba-implementing items + klempířina "
            "reconciliation note to PSV-76 Klempíř items."
        ),
        "tagged_skladba_items": tagged_skladba,
        "tagged_external_skladba_items": tagged_external,
        "tagged_klempir_items": tagged_klempir,
        "skladba_changes_by_kapitola": dict(skladba_changes_by_kapitola),
        "explicit_review_marker": "Items in skladba-implementing kapitolas without a direct S-code mapping carry realizuje_skladbu=null (explicit reviewed-as-not-applicable, e.g. structural support items that DON'T form a skladba layer themselves).",
    }

    # Save back into items.json
    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    # Freeze snapshot
    SNAPSHOT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(json.dumps({
        "items_total": len(items),
        "tagged_skladba_items": tagged_skladba,
        "tagged_external_skladba_items": tagged_external,
        "tagged_klempir_items": tagged_klempir,
        "skladba_changes_by_kapitola": dict(skladba_changes_by_kapitola),
        "snapshot_path": str(SNAPSHOT_PATH.relative_to(ROOT)),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
