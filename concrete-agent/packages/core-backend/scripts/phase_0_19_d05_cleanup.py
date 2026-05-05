"""Phase 0.19 — D05 cleanup (PROBE 6).

User flagged: D05 v pipeline má items "Dveře dodávka rám/křídlo/obložky
+ kotvení + klika + zámek" — ale per Tabulka 0041 přehled kódů:
  D05 = "Roleta z Rampy — vjezdová rolovací lamelová vrata mezi rampou
        a podzemním podlažím, š.5700mm"

Rolovací vrata Hoermann ≠ klasické dveře. Žádný rám / křídlo / obložky
/ klika / zámek — má rolovací mechanismus, motor, čidla.

Plus scope: D05 1× instance v Tabulce 0041 cislo 301, **z=S.C.02** (=
garáž C). PATŘÍ OBJEKTU C, ne D. Out of scope pro objekt D delivery.

Phase 6 generator slepě aplikoval interior door template generator pro
všechny D-typy (D04, D05, D06...) bez ownership filtru. 11 items D05
v dataset s `room=None` (no per-room assignment) — Excel List 1 by je
zobrazil jako globální items komplexu.

Action:
  - DEPRECATE 11× D05 items (status='deprecated', mnozstvi=0 zachováno
    pro audit trail, popis prepended s [DEPRECATED PROBE 6])
  - Log PROBE 6 v carry_forward_findings

Additional concern flagged for user review (NOT deprecated automatically):
  - D10 Fasádní vstupní: 11 items v pipeline, 0 D-side instances v
    Tabulce 0041 (jen A.1.S.02 + B.1.S.02). May belong v Tabulce 0043
    curtain walls.
  - D11 Fasádní únikové: 19 items v pipeline, 0 D-side instances
    (3× v A+B). Same uncertainty.
  - D42 Revizní: 11 items v pipeline, 1 D-side instance (cislo 293,
    do=D.1.S.01) — KEEP, correct for D.

User must decide D10/D11 — possible scenarios:
  (a) Phase 6 mistakenly generated for D — should DEPRECATE
  (b) D-side fasádní vstup is in Tabulka 0043 prosklené (CW01-CW12)
      and Phase 6 used D10/D11 as proxy fallback — KEEP but reclass
"""
from __future__ import annotations

import json
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
ITEMS = OUT_DIR / "items_objekt_D_complete.json"
DS = OUT_DIR / "objekt_D_geometric_dataset.json"


def main() -> None:
    print("=" * 72)
    print("PHASE 0.19 — D05 PROBE 6 cleanup (rolovací brána, S.C.02 scope)")
    print("=" * 72)

    items_blob = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = items_blob["items"]

    # Deprecate D05 items only (user-flagged clear case)
    import re
    d05_pat = re.compile(r"\bD05\b")
    deprecated = 0
    total_value_removed = 0.0
    for it in items:
        if it.get("status") == "deprecated":
            continue
        if (it.get("mnozstvi") or 0) <= 0:
            continue
        if not d05_pat.search(it.get("popis", "")):
            continue
        # Deprecate
        old_qty = it["mnozstvi"]
        old_value = it.get("total_price_kc") or 0
        it["mnozstvi"] = 0.0
        it["status"] = "deprecated"
        if not it["popis"].startswith("[DEPRECATED"):
            it["popis"] = f"[DEPRECATED PROBE 6] {it['popis']}"
        warns = it.get("warnings") or []
        warns.append(
            "PHASE_0_19_PROBE_6: D05 = 'Roleta z Rampy' rolovací lamelová "
            "vrata Hoermann 5700×2100mm per Tabulka 0041 přehled kódů. NENÍ "
            "klasické dveře — Phase 6 generator wrong template (rám/křídlo/"
            "obložky/klika/zámek nepatří rolovací bráně). Plus z=S.C.02 (= "
            "garáž C) per Tabulka 0041 cislo 301 — patří objektu C, NE D. "
            "Out of scope pro objekt D delivery."
        )
        it["warnings"] = warns
        it["audit_note"] = ((it.get("audit_note", "")
                             + f"; PHASE_0_19: deprecated {old_qty}{it['MJ']} "
                             f"(was {old_value} Kč)").strip("; "))
        deprecated += 1
        total_value_removed += old_value
        print(f"  deprecated: {it['kapitola']:8s} | {old_qty:>5.1f} {it['MJ']:3s} "
              f"| {it['popis'][80:140]}")

    items_blob["items"] = items
    items_blob["metadata"]["phase_0_19_applied"] = True
    ITEMS.write_text(json.dumps(items_blob, ensure_ascii=False, indent=2),
                     encoding="utf-8")

    # PROBE 6 in carry_forward_findings
    ds = json.loads(DS.read_text(encoding="utf-8"))
    cff = ds.setdefault("carry_forward_findings", [])
    cff.append({
        "phase": "0.19",
        "type": "PROBE_FINDING + GENERATOR_FIX",
        "label": "PROBE 6 — D05 wrong template + out of scope",
        "description": (
            "User cross-check identifikoval že D05 v pipeline má 11 items "
            "popisující klasické dveře (rám/křídlo/obložky/klika/zámek) — "
            "ale per Tabulka 0041 přehled kódů D05 = 'Roleta z Rampy' = "
            "rolovací lamelová vrata Hoermann 5700×2100mm. Plus instance "
            "v Tabulce 0041 (cislo 301) je z=S.C.02 (garáž C), out of scope "
            "pro objekt D. Phase 6 generator nedetekoval tento special-type "
            "(non-door)."
        ),
        "items_deprecated": deprecated,
        "value_removed_kc": round(total_value_removed, 0),
        "additional_concerns_for_user_review": {
            "D10_fasadni_vstupni": "11 items v pipeline, 0 D-side instance "
            "v Tabulce 0041 (jen A.1.S.02 + B.1.S.02). Může patřit Tabulce "
            "0043 curtain walls — user must clarify.",
            "D11_fasadni_unikove": "19 items v pipeline, 0 D-side instance "
            "(3× A+B). Same uncertainty as D10.",
            "D42_revizni": "11 items v pipeline, 1 D-side instance OK — keep.",
        },
    })
    DS.write_text(json.dumps(ds, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n✅ PHASE 0.19 RESULTS:")
    print(f"   Items deprecated: {deprecated}")
    print(f"   Value removed: {total_value_removed:,.0f} Kč")
    print(f"\n⚠️  Flagged for user review (NOT auto-deprecated):")
    print(f"   D10 Fasádní vstupní: 11 items, 0 D-instance v 0041")
    print(f"   D11 Fasádní únikové: 19 items, 0 D-instance v 0041")
    print(f"   → user musí potvrdit zda KEEP (proxy pro 0043 curtain wall) "
          f"nebo DEPRECATE")


if __name__ == "__main__":
    main()
