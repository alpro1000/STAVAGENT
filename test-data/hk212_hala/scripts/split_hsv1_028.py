"""HSV-1-028 split — decompose výměna aktivní zóny into 6 KROS-mappable sub-items.

Source: user request 2026-05-22 + IGP ALTAGEO §4.4 + ČSN 72 1006 + ČSN 6133.

The consolidated HSV-1-028 (1 line, 265.61 m³ "výměna aktivní zóny") is too
coarse for KROS catalog mapping — every real workflow step has a different
KROS code group (122xxx výkop, 162xxx doprava, 174xxx hutnění, 935xxx zkouška,
933xxx geodet). User wants 6 separate lines so they can fill exact KROS codes
per step.

Mutations (deterministic, idempotent — driven by item ID):
- DELETE HSV-1-028 (kept entirely in metadata.revisions[].removed_item_snapshot
  + each child's audit_trail.parent_item + first journey entry preserves the
  parent state in full)
- INSERT 6 children HSV-1-028a..f in Fáze 3 position (after HSV-2-018, before
  HSV-2-009 — i.e. at the same index where HSV-1-028 used to sit)

Per child:
- Inherits SO/kapitola/subdodavatel_chapter/_data_source from parent
- Inherits the parent's audit_trail.reference[] (csn + igp refs) PLUS adds
  a Pattern 14 ancestry entry pointing to the parent's last state
- Adds new top-level `kros_hint` field (user-fillable; not a real catalog code)
- audit_trail.parent_item = "HSV-1-028"
- audit_trail.split_decision = "decomposed for KROS code granularity at user
  request 2026-05-22"
- audit_trail._analytical_journey starts with:
    [{"date": "...", "ancestor": "HSV-1-028", "ancestor_state": {...parent
      mnozstvi/formula/popis/audit_trail...}, "method": "Parent split into 6
      KROS-mappable sub-items"},
     {"date": "...", "value": <child mnozstvi>, "method": "Sub-item — first
      appearance", "status": "current"}]
- confidence: 0.85 (per IGP + ČSN — no further uncertainty introduced by split)

File-level:
- metadata.revisions[] append summarizing 133 → 138 (net +5: -1 parent, +6 children)
"""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
REVISION_DATE = "2026-05-22"


SUB_ITEMS = [
    {
        "suffix": "a",
        "popis": "Odstranění navážek GT1 z aktivní zóny — výkop + naložení na dopravní prostředek",
        "mj": "m³",
        "mnozstvi": 265.61,
        "kros_hint": "122xxx (odstranění zeminy z aktivní zóny)",
        "formula": "531.22 m² (A105 deska) × 0.5 m (mocnost výměny per IGP §4.4) = 265.61 m³",
        "krok_role": "1) výkop navážek",
    },
    {
        "suffix": "b",
        "popis": "Odvoz vytěžených navážek GT1 na skládku (vč. poplatku skládkovné)",
        "mj": "m³",
        "mnozstvi": 265.61,
        "kros_hint": "162xxx (odvoz) + skládkovné dle reálné vzdálenosti",
        "formula": "= HSV-1-028a vytěžený objem = 265.61 m³ (1 : 1 odvoz vykopaného materiálu)",
        "krok_role": "2) odvoz na skládku",
    },
    {
        "suffix": "c",
        "popis": "Dovoz hutného štěrku frakce 0/63 (alt. 0/125) na staveniště",
        "mj": "m³",
        "mnozstvi": 265.61,
        "kros_hint": "162xxx (dovoz materiálu) — frakce per finální výběr dodavatele",
        "formula": "= objem výměny 265.61 m³ (nahrazení 1 : 1 ekvivalent odstraněného)",
        "krok_role": "3) dovoz hutného štěrku",
    },
    {
        "suffix": "d",
        "popis": "Rozprostření štěrku po vrstvách max 300 mm + hutnění vibračním válcem / pěchem (ČSN 72 1006)",
        "mj": "m³",
        "mnozstvi": 265.61,
        "kros_hint": "174xxx (zhutněné násypy)",
        "formula": "= 265.61 m³ rozprostřeno v ≥ 2 vrstvách po max 0.3 m (ČSN 72 1006 §6.3 míra zhutnění)",
        "krok_role": "4) rozprostření + hutnění",
    },
    {
        "suffix": "e",
        "popis": "Statická zatěžovací zkouška Edef2 ≥ 45 MPa (Edef2/Edef1 < 2.2), min 3 měřená místa",
        "mj": "ks",
        "mnozstvi": 3.0,
        "kros_hint": "935xxx (zatěžovací zkouška)",
        "formula": "3 ks (ČSN 72 1006 minimum pro plochu < 1000 m²; deska 531.22 m² → 3 měřená místa)",
        "krok_role": "5) Edef2 kontrolní zkouška",
    },
    {
        "suffix": "f",
        "popis": "Geodetická kontrola roviny aktivní zóny po hutnění",
        "mj": "m²",
        "mnozstvi": 531.22,
        "kros_hint": "933xxx (geodetické práce — kontrolní zaměření)",
        "formula": "= A105 deska 19.04 × 27.90 = 531.22 m² (celá plocha aktivní zóny)",
        "krok_role": "6) geodetická kontrola roviny",
    },
]


def build_child(parent: dict, sub: dict) -> dict:
    child = {
        "id": f"HSV-1-028{sub['suffix']}",
        "kapitola": parent["kapitola"],
        "SO": parent.get("SO", "SO-01"),
        "popis": sub["popis"],
        "mj": sub["mj"],
        "mnozstvi": sub["mnozstvi"],
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "needs_review",
        "urs_match_score": None,
        "kros_hint": sub["kros_hint"],
        "skladba_ref": None,
        "source": "IGP ALTAGEO §4.4 + ČSN 72 1006 + ČSN 6133 + user split 2026-05-22",
        "raw_description": sub["popis"],
        "confidence": 0.85,
        "subdodavatel_chapter": parent.get("subdodavatel_chapter", "zemni_prace"),
        "_vyjasneni_ref": [],
        "_status_flag": None,
        "_data_source": parent.get("_data_source", "IGP"),
        "_completeness": 0.9,
        "_qty_formula": sub["formula"],
        "_export_wrapper_hint": None,
        "_price_source": "user_skipped_pricing",
        "audit_trail": {
            "lokalizace": parent["audit_trail"]["lokalizace"],
            "formula": sub["formula"],
            "formula_parsed_method": "user_split_decomposition",
            "inputs": [
                {"label": "krok_role", "value": sub["krok_role"], "unit": ""},
                {"label": "parent_consolidated_qty", "value": 265.61, "unit": "m³ (HSV-1-028 původně)"},
                {"label": "deska_area_m2", "value": 531.22, "unit": "m² (A105 měřené 19.04 × 27.90)"},
                {"label": "mocnost_vymeny_m", "value": 0.5, "unit": "m (IGP §4.4)"},
                {"label": "edef2_min_MPa", "value": 45.0, "unit": "MPa (ČSN 72 1006)"},
            ],
            "reference": deepcopy(parent["audit_trail"]["reference"]) + [
                {
                    "type": "user_request",
                    "date": REVISION_DATE,
                    "raw": "Rozdělit HSV-1-028 na 6 podpoložek pro KROS code granularitu — user task 2026-05-22",
                },
            ],
            "poznamka": (
                f"Sub-item {sub['krok_role']} ze split HSV-1-028 (výměna aktivní zóny). "
                "Zachovává původní geometrickou bázi (A105 531.22 m² × 0.5 m = 265.61 m³). "
                "KROS hint per user — uživatel doplní exact catalog code do urs_code."
            ),
            "computed_quantity": sub["mnozstvi"],
            "declared_quantity": sub["mnozstvi"],
            "match_delta_pct": 0.0,
            "match_within_tolerance": True,
            "confidence": 0.85,
            "extraction_method": "user_split_decomposition",
            "data_source_hint": "IGP+CSN+user_split",
            "extracted_at": f"{REVISION_DATE}T13:00:00+00:00",
            "parent_item": "HSV-1-028",
            "split_decision": "decomposed for KROS code granularity at user request 2026-05-22",
            "_analytical_journey": [
                {
                    "date": REVISION_DATE,
                    "ancestor": "HSV-1-028",
                    "ancestor_state": {
                        "mnozstvi": parent["mnozstvi"],
                        "mj": parent["mj"],
                        "popis": parent["popis"],
                        "formula": parent["audit_trail"]["formula"],
                        "poznamka_excerpt": parent["audit_trail"]["poznamka"][:200] + "...",
                    },
                    "method": "Parent HSV-1-028 split into 6 KROS-mappable sub-items (a-f)",
                    "status": "split_origin",
                },
                {
                    "date": REVISION_DATE,
                    "value": sub["mnozstvi"],
                    "mj": sub["mj"],
                    "method": f"Sub-item {sub['krok_role']} — first appearance",
                    "status": "current",
                },
            ],
        },
    }
    return child


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    items = data["items"]
    assert len(items) == 133, f"expected 133, got {len(items)}"

    parent_idx = next(i for i, it in enumerate(items) if it["id"] == "HSV-1-028")
    parent = deepcopy(items[parent_idx])

    children = [build_child(parent, sub) for sub in SUB_ITEMS]

    items[parent_idx : parent_idx + 1] = children

    meta = data.setdefault("metadata", {})
    revisions = meta.setdefault("revisions", [])
    revisions.append({
        "date": REVISION_DATE,
        "source": "User request — KROS code granularity for výměna aktivní zóny",
        "summary": "HSV-1-028 split into 6 sub-items (a-f) per real workflow: odstranění → odvoz → dovoz → rozprostření+hutnění → Edef2 zkouška → geodet kontrola",
        "reason": "Granular KROS code mapping pre user fill — single consolidated 265.61 m³ line cannot map to one KROS code (5 different code groups apply)",
        "previous_count": 133,
        "new_count": 138,
        "items_modified": [],
        "items_added": [f"HSV-1-028{s['suffix']}" for s in SUB_ITEMS],
        "items_removed": ["HSV-1-028"],
        "removed_item_snapshot": {
            "id": parent["id"],
            "popis": parent["popis"],
            "mj": parent["mj"],
            "mnozstvi": parent["mnozstvi"],
            "formula": parent["audit_trail"]["formula"],
            "source": parent["source"],
            "confidence": parent["confidence"],
        },
    })

    assert len(items) == 138, f"expected 138 after split, got {len(items)}"
    ids = [it["id"] for it in items]
    assert len(set(ids)) == 138, "duplicate IDs in output"
    assert "HSV-1-028" not in ids, "parent HSV-1-028 should be removed"
    for sub in SUB_ITEMS:
        cid = f"HSV-1-028{sub['suffix']}"
        assert cid in ids, f"missing child {cid}"

    SRC.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK — items.json: 133 → {len(items)} (parent removed, 6 children added).")


if __name__ == "__main__":
    main()
