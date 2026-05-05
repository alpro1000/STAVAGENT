"""Phase 3c Part C — detaily (OP/LI + Kniha detailů + ostatní).

OP## items already partially covered as ostatní in Tabulka. Here we
add the lookup-resolved per-OP items.
LI## překlady — translation lintels for opening above doors/windows.
Kniha detailů: vnitřní parapety, ostění, připojovací spáry, dilatační
lišty, větrací mřížky soklu.
"""
from __future__ import annotations

import json
import re
import uuid
from collections import defaultdict
from pathlib import Path

DS = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")
TAB = Path("test-data/libuse/outputs/tabulky_loaded.json")
OUT = Path("test-data/libuse/outputs/items_phase_3c_detaily.json")
D_SHARE = 0.25


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


MISTO_D = {"objekt": "D", "podlazi": "ALL", "mistnosti": []}
MISTO_FACADE = {"objekt": "D", "podlazi": "fasáda", "mistnosti": []}


def gen_OP_items(tabulky):
    """OP## items from Tabulka ostatních prvků × 0.25 D-share."""
    items = []
    op = tabulky["ostatni"]["items"]
    for code in sorted(op):
        item = op[code]
        qty = item.get("mnozstvi") or 0
        mj = item.get("mj") or "ks"
        nazev = (item.get("nazev") or "")[:60]
        if qty == 0:
            continue
        d_qty = qty * D_SHARE
        skl = {"OP": code, "tabulka_qty_komplex": qty}
        items.append(make_item(
            "OP-detail", f"{code}: {nazev}",
            mj, d_qty, MISTO_D, skl,
            vyrobce_ref=item.get("povrch", ""),
            poznamka=f"komplex × 0.25 D-share; tabulka_qty={qty} {mj}",
        ))
    return items


def gen_LI_items(tabulky):
    """LI## překlady from Tabulka překladů × 0.25 D-share."""
    items = []
    li = tabulky["preklady"]["items"]
    for code in sorted(li):
        item = li[code]
        qty = item.get("mnozstvi") or 0
        mj = item.get("mj") or "ks"
        nazev = (item.get("nazev_vyrobku") or "")[:60]
        if qty == 0:
            continue
        d_qty = qty * D_SHARE
        skl = {"LI": code, "tabulka_qty_komplex": qty}
        items.append(make_item(
            "LI-detail", f"{code}: {nazev}",
            mj, d_qty, MISTO_D, skl,
            poznamka=f"komplex × 0.25 D-share; tabulka_qty={qty} {mj}",
        ))
    return items


def gen_kniha_detailu(dataset):
    """Spec stykové detaily per Phase 1.5: vnitřní parapety, ostění oken,
    připojovací spáry, dilatační lišty, větrací mřížky soklu."""
    items = []
    aggs = dataset["aggregates"]

    # Window stats from doors_by_type_code / windows_by_type_code
    win_counts = aggs.get("windows_by_type_code", {})
    n_windows_d = sum(win_counts.values()) if win_counts else 35

    # Vnitřní parapety umělý kámen Technistone
    # Average windows have width ~1.0 m × hloubka parapetu 0.2 m → ~0.2 m² per okno
    parapet_total_m = n_windows_d * 1.2  # avg 1.2 m per parapet
    items.append(make_item(
        "Detail-parapet", "Vnitřní parapet umělý kámen Technistone",
        "m", parapet_total_m, MISTO_FACADE,
        {"detail": "vnitřní parapet"},
        vyrobce_ref="Technistone Crystal Solid",
        poznamka=f"~{n_windows_d} oken × 1.2 m průměr",
    ))
    items.append(make_item(
        "Detail-parapet", "Lepení parapetu PUR pěnou + silikon",
        "m", parapet_total_m, MISTO_FACADE,
        {"detail": "vnitřní parapet"},
    ))

    # Ostění oken — komprimační páska + APU lišta + tmel
    # Window obvod ostění = 2 × výška + 2 × šířka (top + 2 sides + bottom internal)
    # Average window 1.2 m × 1.5 m → obvod ostění ≈ 2 × 1.5 + 1.2 = 4.2 m
    osteni_total_m = n_windows_d * 4.2
    items.append(make_item(
        "Detail-ostení", "Komprimační páska ostění oken",
        "m", osteni_total_m, MISTO_FACADE, {"detail": "ostění oken"},
        vyrobce_ref="např. Illbruck TP652",
    ))
    items.append(make_item(
        "Detail-ostění", "APU lišta ostění oken",
        "m", osteni_total_m, MISTO_FACADE, {"detail": "ostění oken"},
    ))
    items.append(make_item(
        "Detail-ostění", "Tmel akrylový ostění oken",
        "kg", osteni_total_m * 0.05, MISTO_FACADE, {"detail": "ostění oken"},
    ))

    # Připojovací spáry oken (parotěsná + paropropustná fólie)
    # Plný obvod okna 4 × strany ≈ 5.4 m průměr
    spara_obvod_m = n_windows_d * 5.4
    items.append(make_item(
        "Detail-spara", "Parotěsná fólie vnitřní (připojovací spára)",
        "m", spara_obvod_m, MISTO_FACADE, {"detail": "spára okna"},
        vyrobce_ref="např. Illbruck ME501 BG1",
    ))
    items.append(make_item(
        "Detail-spara", "Paropropustná fólie vnější (připojovací spára)",
        "m", spara_obvod_m, MISTO_FACADE, {"detail": "spára okna"},
        vyrobce_ref="např. Illbruck ME501 BG2",
    ))

    # Dilatační lišty podlah — 1 grid 6 × 6 m
    total_floor_d = sum(
        b.get("sum_area_m2", 0) for b in aggs.get("per_floor", {}).values()
    )
    n_dilatace = total_floor_d / 36  # 1 dilatace per 36 m²
    items.append(make_item(
        "Detail-dilatace", "Dilatační lišta hliníková podlah (grid 6 × 6 m)",
        "m", n_dilatace * 6.0, MISTO_D, {"detail": "dilatace podlahy"},
        poznamka=f"floor area D = {total_floor_d:.0f} m² → ~{n_dilatace:.0f} dilatace × 6 m",
    ))

    # Větrací mřížky soklu
    obvod_d = 80.98  # spec terén obvod
    n_mrizek = int(obvod_d / 5)  # 1 mřížka / 5 m
    items.append(make_item(
        "Detail-soklova-mrizka", "Větrací mřížka soklu nerez",
        "ks", n_mrizek, MISTO_FACADE, {"detail": "soklová mřížka"},
        poznamka=f"obvod {obvod_d:.1f} m / 5 m = {n_mrizek} ks",
    ))
    items.append(make_item(
        "Detail-soklova-mrizka", "Osazení mřížky soklu",
        "ks", n_mrizek, MISTO_FACADE, {"detail": "soklová mřížka"},
    ))
    return items


def main() -> None:
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    tabulky = json.loads(TAB.read_text(encoding="utf-8"))

    items = []
    items.extend(gen_OP_items(tabulky))
    items.extend(gen_LI_items(tabulky))
    items.extend(gen_kniha_detailu(dataset))

    by_kap = defaultdict(lambda: {"count": 0, "by_mj": defaultdict(float)})
    for it in items:
        by_kap[it["kapitola"]]["count"] += 1
        by_kap[it["kapitola"]]["by_mj"][it["MJ"]] += it["mnozstvi"]
    by_kap_clean = {k: {"count": v["count"], "totals": {mj: round(t, 2) for mj, t in v["by_mj"].items()}}
                     for k, v in by_kap.items()}

    out = {
        "metadata": {
            "phase": "3c",
            "part": "C — detaily (OP/LI + Kniha detailů)",
            "items_count": len(items),
            "summary_per_kapitola": by_kap_clean,
        },
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    for k, v in sorted(by_kap_clean.items()):
        print(f"  {k:32s} count={v['count']:>3}  totals={v['totals']}")


if __name__ == "__main__":
    main()
