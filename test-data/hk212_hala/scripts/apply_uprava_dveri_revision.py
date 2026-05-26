"""Apply Úprava dveří revision to items_hk212_etap1.json.

Source: drawings "Hala HK_ Úprava dveří" (PDF revision) + user measurements
2026-05-22 — Kingspan composition revised (3 wall types + 2 roof types) +
window count revised 21 → 34 (29 fix + 5 otvíravé) + obvod corrected.

Mutations (deterministic, idempotent — driven by item ID):
- PSV-76x-001: dodávka okno fixní 21 → 29 ks, popis adds "fixní"
- PSV-76x-002: montáž 21 → 34 ks
- PSV-76x-003: parapet 22.05 → 35.7 bm
- PSV-76x-004: okenní lemy 63 → 102 bm
- PSV-76x-009: dveře vnější popis adds "plastové"
- PSV-OPL-001/002: KS NF 200 → KS 1000 NF 120 mm, 528.5 → 510.81 m²
- PSV-OPL-003/004: KS FF-ROC 200 → KS 1000 RW 160 mm, 558.8 → 500.60 m²
- PSV-OPL-005: klempířské lemy 207 → 189.14 bm

Inserts:
- PSV-76x-013: dodávka okno otvíravé 5 ks
- PSV-OPL-009/010: KS 1000 FR 150 mm 82.25 m² (dodávka + montáž)
- PSV-OPL-011/012: KS 1000 FF 175 mm 58.20 m² (dodávka + montáž)

Every mutation:
- updates audit_trail.formula
- prepends previous (formula, mnozstvi) into audit_trail._analytical_journey
- adds reference entry pointing to Úprava dveří revision
- sets _vyjasneni_ref entries for newly reopened ABMVs
"""
from __future__ import annotations

import json
from copy import deepcopy
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
REVISION_DATE = "2026-05-22"
REV_REF = {
    "type": "drawing",
    "code": "Hala HK_Úprava dveří",
    "document": "vykresy_pdf/Hala_HK_Uprava_dveri_2026-05-22.pdf",
    "raw": "Úprava dveří revision drawings — POHLED OSA A/F/01/06 + section",
}


def push_journey(at: dict, entry: dict) -> None:
    journey = at.setdefault("_analytical_journey", [])
    journey.append(entry)


def add_ref(at: dict, new_ref: dict) -> None:
    refs = at.setdefault("reference", [])
    if not any(r.get("code") == new_ref.get("code") for r in refs if isinstance(r, dict)):
        refs.append(new_ref)


def update_item(items_by_id: dict, iid: str, **changes) -> None:
    it = items_by_id[iid]
    at = it.setdefault("audit_trail", {})
    journey_entry = {
        "date": REVISION_DATE,
        "previous": {
            "mnozstvi": it.get("mnozstvi"),
            "formula": at.get("formula"),
            "popis": it.get("popis"),
        },
        "reason": changes.pop("_reason", "Úprava dveří revision 2026-05-22"),
        "source": "Úprava dveří drawings + user manual measurement",
    }
    push_journey(at, journey_entry)
    add_ref(at, REV_REF)

    if "mnozstvi" in changes:
        it["mnozstvi"] = changes.pop("mnozstvi")
    if "popis" in changes:
        it["popis"] = changes.pop("popis")
    if "formula" in changes:
        at["formula"] = changes.pop("formula")
    if "extraction_method" in changes:
        at["extraction_method"] = changes.pop("extraction_method")
    if "data_source_hint" in changes:
        at["data_source_hint"] = changes.pop("data_source_hint")
    if "confidence" in changes:
        new_conf = changes.pop("confidence")
        it["confidence"] = new_conf
        at["confidence"] = new_conf
    # audit_trail re-derived figures
    if "mnozstvi" not in journey_entry["previous"]:
        pass
    at["computed_quantity"] = it["mnozstvi"]
    at["declared_quantity"] = it["mnozstvi"]
    if changes:
        raise SystemExit(f"FATAL: unknown update keys for {iid}: {list(changes)}")


def new_item(items: list, template_id: str, *, id_: str, kapitola: str, popis: str,
             mj: str, mnozstvi: float, confidence: float, formula: str,
             refs: list, poznamka: str, extraction_method: str = "uprava_dveri_revision",
             insert_after: str | None = None) -> None:
    """Build a new item dict, mirror schema of items[0]."""
    template = next(it for it in items if it["id"] == template_id)
    new = deepcopy(template)
    new["id"] = id_
    new["kapitola"] = kapitola
    new["popis"] = popis
    new["mj"] = mj
    new["mnozstvi"] = mnozstvi
    new["confidence"] = confidence
    if "urs_code" in new:
        new["urs_code"] = ""
    if "urs_alternatives" in new:
        new["urs_alternatives"] = []
    if "urs_match_score" in new:
        new["urs_match_score"] = 0.0
    if "urs_status" in new:
        new["urs_status"] = "not_matched"
    new["_review_concrete_class"] = None
    new["_review_qty"] = None
    new["_vyjasneni_ref"] = None
    new["raw_description"] = popis
    new["source"] = "uprava_dveri_2026-05-22"
    new["audit_trail"] = {
        "lokalizace": template["audit_trail"].get("lokalizace", ""),
        "formula": formula,
        "formula_parsed_method": "uprava_dveri_user_measurement",
        "inputs": [],
        "reference": refs,
        "poznamka": poznamka,
        "computed_quantity": mnozstvi,
        "declared_quantity": mnozstvi,
        "match_delta_pct": 0.0,
        "match_within_tolerance": True,
        "confidence": confidence,
        "extraction_method": extraction_method,
        "data_source_hint": "uprava_dveri_drawings+user_measurement",
        "extracted_at": f"{REVISION_DATE}T12:00:00+00:00",
        "_analytical_journey": [
            {
                "date": REVISION_DATE,
                "value": mnozstvi,
                "method": "Úprava dveří revision — first appearance",
                "status": "current",
            }
        ],
    }
    # Insert at right position
    if insert_after:
        idx = next(i for i, it in enumerate(items) if it["id"] == insert_after)
        items.insert(idx + 1, new)
    else:
        items.append(new)


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    items = data["items"]
    items_by_id = {it["id"]: it for it in items}
    assert len(items) == 128, f"expected 128, got {len(items)}"

    # ----- A. Windows -----
    update_item(items_by_id, "PSV-76x-001",
                mnozstvi=29.0,
                popis="Dodávka okno plastové fixní 1000 × 1000 mm, izol. dvojsklo Ug ≤ 1.1, barva šedá",
                formula="29 ks fixních (z 34 oken celkem; 5 otvíravých v PSV-76x-013) — Úprava dveří POHLED OSA A/F/06/01",
                confidence=0.85,
                extraction_method="uprava_dveri_revision",
                data_source_hint="uprava_dveri_drawings")
    update_item(items_by_id, "PSV-76x-002",
                mnozstvi=34.0,
                popis="Montáž okna plastového 1000 × 1000 mm (fixní i otvíravé) do osazovacího otvoru, vč. kotvení a pěny",
                formula="34 ks celkem (29 fixní + 5 otvíravé) — Úprava dveří POHLED OSA A/F/06/01",
                confidence=0.85)
    update_item(items_by_id, "PSV-76x-003",
                mnozstvi=35.7,
                formula="34 ks × 1.05 m (šířka okna + přesah) = 35.7 bm — Úprava dveří 34 oken",
                confidence=0.85)
    update_item(items_by_id, "PSV-76x-004",
                mnozstvi=102.0,
                formula="34 ks × 3 bm (perimetr 3 stran, parapet samostatně) = 102 bm — Úprava dveří 34 oken",
                confidence=0.5)
    update_item(items_by_id, "PSV-76x-009",
                popis="Dodávka vnější dvoukřídlé dveře plastové 1050 × 2100 mm, izol. plnostěnné, klika a zámek",
                formula="2 ks (Úprava dveří potvrzeno) — materiál plastové dle user expectation, čeká finální potvrzení projektantem",
                confidence=0.5)

    # ----- B. Wall Kingspan (PSV-OPL) -----
    nf120_area = round(593.06 - 82.25, 2)  # 510.81
    update_item(items_by_id, "PSV-OPL-001",
                mnozstvi=nf120_area,
                popis="Kingspan KS 1000 NF 120 mm, jádro minerální vata (MW), per Úprava dveří + TZ ARS DPZ D.1.1 — alternativně k orig. 200 mm",
                formula=f"fasáda brutto Úprava dveří: 94.57 m obvod × 6.085 m okap + 17.58 m² štíty = 593.06 m² brutto − 82.25 m² FR zóny (rohy s dveřmi) = {nf120_area} m² (bez vyřezání otvorů — sendvič ordered celý)",
                confidence=0.9)
    update_item(items_by_id, "PSV-OPL-002",
                mnozstvi=nf120_area,
                popis="Montáž obvodového opláštění Kingspan KS 1000 NF 120 mm — kotvení samořeznými šrouby + EPDM těsnicí podložkou k ocelové konstrukci (rozteč rámů 6.1 m)",
                formula=f"= dodávka PSV-OPL-001 = {nf120_area} m²",
                confidence=0.9)

    # ----- C. Roof Kingspan -----
    # FF 175 user-measured projection 57.95 m² slope-corrected to 58.20 m²
    # (57.95 / cos(5.25°) ≈ 58.196 → rounded to 58.20).
    # RW 160 = 558.8 (total) − 58.20 = 500.60. Hardcoded to avoid float drift.
    ff_175_corrected = 58.20
    rw_160_area = 500.60
    update_item(items_by_id, "PSV-OPL-003",
                mnozstvi=rw_160_area,
                popis="Kingspan KS 1000 RW 160 mm, jádro PIR, pro šikmé střechy sklon 5.25°, hlavní střecha (mimo zónu FF 175)",
                formula=f"střecha total 558.8 m² − FF 175 zóna 58.20 m² (57.95 m² projection / cos 5.25°) = {rw_160_area} m² — Úprava dveří section view",
                confidence=0.85)
    update_item(items_by_id, "PSV-OPL-004",
                mnozstvi=rw_160_area,
                popis="Montáž střešního opláštění Kingspan KS 1000 RW 160 mm — kotvení k ocelové konstrukci samořeznými šrouby + těsnění přesahů",
                formula=f"= dodávka PSV-OPL-003 = {rw_160_area} m²",
                confidence=0.85)

    # ----- D. Klempířské lemy obvod recompute -----
    lemy_bm = round(2 * 94.57, 2)  # 189.14
    update_item(items_by_id, "PSV-OPL-005",
                mnozstvi=lemy_bm,
                formula=f"2 × obvod budovy 94.57 m (Úprava dveří) = {lemy_bm} bm (hrubý odhad atika + parapety)",
                confidence=0.75)

    # ----- E. New items -----
    new_item(items, template_id="PSV-76x-001",
             id_="PSV-76x-013",
             kapitola="PSV-76x",
             popis="Dodávka okno plastové otvíravé 1000 × 1000 mm, izol. dvojsklo Ug ≤ 1.1, barva šedá, kování pro mikroventilaci",
             mj="ks",
             mnozstvi=5.0,
             confidence=0.85,
             formula="5 ks otvíravých z 34 oken celkem — Úprava dveří POHLED OSA A/F/06/01 user-confirmed split",
             refs=[REV_REF],
             poznamka="Úprava dveří revision 2026-05-22 — separated from PSV-76x-001 because otvíravé varianta má vyšší cenu (+30-50 %)",
             insert_after="PSV-76x-012")

    new_item(items, template_id="PSV-OPL-001",
             id_="PSV-OPL-009",
             kapitola="PSV-OPL",
             popis="Kingspan KS 1000 FR 150 mm, jádro PIR (fire-resistant), 2 rohové zóny u vstupních dveří (45.69 + 36.56 m²) — Úprava dveří",
             mj="m²",
             mnozstvi=82.25,
             confidence=0.85,
             formula="45.69 m² + 36.56 m² = 82.25 m² (2 šrafované rohové zóny v POHLED F a POHLED 01 — user manual měření)",
             refs=[REV_REF, {"type": "tz_section", "section": "B p.8", "raw": "Kingspan tl. 200 mm, alternativně 150 mm dle"}],
             poznamka="FR jádro per Úprava dveří značení — odlišný materiál od NF 120 mm (PIR vs MW)",
             insert_after="PSV-OPL-008")

    new_item(items, template_id="PSV-OPL-002",
             id_="PSV-OPL-010",
             kapitola="PSV-OPL",
             popis="Montáž Kingspan KS 1000 FR 150 mm — 2 rohové zóny (45.69 + 36.56 m²), kotvení samořeznými šrouby + EPDM podložka",
             mj="m²",
             mnozstvi=82.25,
             confidence=0.85,
             formula="= dodávka PSV-OPL-009 = 82.25 m²",
             refs=[REV_REF],
             poznamka="Montážní práce identické s NF panelem, FR pouze materiálová odlišnost",
             insert_after="PSV-OPL-009")

    new_item(items, template_id="PSV-OPL-003",
             id_="PSV-OPL-011",
             kapitola="PSV-OPL",
             popis="Kingspan KS 1000 FF 175 mm, jádro FF (Rockwool), zóna ve střeše — Úprava dveří section view",
             mj="m²",
             mnozstvi=58.20,
             confidence=0.75,
             formula="57.95 m² projection (user měřeno) / cos(5.25°) = 58.20 m² (slope-corrected)",
             refs=[REV_REF],
             poznamka="2. typ střešního panelu vedle hlavního RW 160 mm — image 1 section view ukazuje oba typy paralelně",
             insert_after="PSV-OPL-010")

    new_item(items, template_id="PSV-OPL-004",
             id_="PSV-OPL-012",
             kapitola="PSV-OPL",
             popis="Montáž Kingspan KS 1000 FF 175 mm — zóna 58.20 m² ve střeše",
             mj="m²",
             mnozstvi=58.20,
             confidence=0.75,
             formula="= dodávka PSV-OPL-011 = 58.20 m²",
             refs=[REV_REF],
             poznamka="Montážní práce identické s RW panelem",
             insert_after="PSV-OPL-011")

    # ----- Metadata revision -----
    meta = data.setdefault("metadata", {})
    revisions = meta.setdefault("revisions", [])
    revisions.append({
        "date": REVISION_DATE,
        "source": "Hala HK_ Úprava dveří drawings",
        "summary": "Window count 21→34 (29 fix + 5 otvíravé), Kingspan wall NF200→NF120 (510.81 m²) + new FR150 (82.25 m²), Kingspan roof FF-ROC200→RW160 (500.60 m²) + new FF175 (58.20 m²), obvod 103.5→94.57 m, klempířské lemy 207→189.14 bm, dveře vnější popis +plastové",
        "items_modified": ["PSV-76x-001", "PSV-76x-002", "PSV-76x-003", "PSV-76x-004", "PSV-76x-009",
                            "PSV-OPL-001", "PSV-OPL-002", "PSV-OPL-003", "PSV-OPL-004", "PSV-OPL-005"],
        "items_added": ["PSV-76x-013", "PSV-OPL-009", "PSV-OPL-010", "PSV-OPL-011", "PSV-OPL-012"],
        "items_removed": [],
    })

    # Sanity
    final = data["items"]
    assert len(final) == 133, f"expected 133, got {len(final)}"
    ids = [it["id"] for it in final]
    assert len(set(ids)) == 133, "duplicate IDs in output"

    SRC.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK — items.json now has {len(final)} items (was 128, +5).")


if __name__ == "__main__":
    main()
