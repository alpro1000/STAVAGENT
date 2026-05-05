"""Phase 3c Part B — truhlářské (PSV-766) + zámečnické vnitřní (PSV-767).

PSV-766: per door type (D## from Tabulka dveří × DXF spatial counts on D)
PSV-767: madla schodišť, ocelové stupně, IPE120 sloupky podkroví, kotvení
"""
from __future__ import annotations

import json
import sys
import uuid
from collections import Counter, defaultdict
from pathlib import Path

DS = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")
TAB = Path("test-data/libuse/outputs/tabulky_loaded.json")
OUT = Path("test-data/libuse/outputs/items_phase_3c_truhl_zamec.json")
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


MISTO_D_INTERIOR = {"objekt": "D", "podlazi": "ALL", "mistnosti": []}


def gen_PSV_766_truhlarske(dataset, tabulky):
    """Per D## type — count from aggregates.doors_by_type_code (DXF D-side)."""
    items = []
    door_counts = dataset.get("aggregates", {}).get("doors_by_type_code", {})
    dvere_master = tabulky["dvere"]["items"]
    for d_code, count in sorted(door_counts.items(), key=lambda x: -x[1]):
        master = dvere_master.get(d_code, {})
        nazev = master.get("name", "") or master.get("code", d_code)
        is_entry = "Vstup" in nazev or d_code in ("D11", "D14")  # heuristic
        skl = {"D_type": d_code}
        # Dodávka rám + křídlo + obložky
        items.append(make_item(
            "PSV-766", f"Dveře {d_code} — dodávka (rám + křídlo + obložky)",
            "ks", count, MISTO_D_INTERIOR, skl,
            vyrobce_ref=nazev[:60], poznamka=f"DXF count = {count}",
        ))
        items.append(make_item(
            "PSV-766", f"Dveře {d_code} — kotvení + spárování",
            "ks", count, MISTO_D_INTERIOR, skl,
        ))
        items.append(make_item(
            "PSV-766", f"Dveře {d_code} — klika + zámek",
            "ks", count, MISTO_D_INTERIOR, skl,
            vyrobce_ref="standard nebo dle TZ",
        ))
        if is_entry:
            items.append(make_item(
                "PSV-766", f"Dveře {d_code} — bezpečnostní rám 4. třída",
                "ks", count, MISTO_D_INTERIOR, skl,
            ))
            items.append(make_item(
                "PSV-766", f"Dveře {d_code} — bezpečnostní křídlo",
                "ks", count, MISTO_D_INTERIOR, skl,
            ))
            items.append(make_item(
                "PSV-766", f"Dveře {d_code} — cylinder bezp. + 5 klíčů",
                "ks", count, MISTO_D_INTERIOR, skl,
            ))
    return items


def gen_PSV_767_zamec_vnitrni(tabulky):
    """LP## interior items (madla, IPE120, ocelové stupně)."""
    items = []
    zam = tabulky["zamecnicke"]["items"]
    for code in sorted(zam):
        item = zam[code]
        qty = item.get("mnozstvi") or 0
        mj = item.get("mj") or "ks"
        nazev = (item.get("nazev") or "")[:60]
        # Skip outdoor LP60-65 (covered in Phase 3b PSV-783 anti-graffiti / žárové zinkování pool)
        # Keep all bm + ks LP items here as separate dodávka + montáž
        d_qty = qty * D_SHARE
        skl = {"LP": code, "tabulka_qty_komplex": qty, "mj": mj}
        items.append(make_item(
            "PSV-767", f"{code}: {nazev} — dodávka",
            mj, d_qty, MISTO_D_INTERIOR, skl,
            vyrobce_ref=item.get("povrch", ""),
            poznamka=f"komplex × 0.25 D-share; tabulka_qty={qty} {mj}",
        ))
        items.append(make_item(
            "PSV-767", f"{code}: {nazev} — montáž",
            mj, d_qty, MISTO_D_INTERIOR, skl,
        ))

    # Ocelové stupně schodiště (PROBE finding ~50 ks pro D)
    items.append(make_item(
        "PSV-767", "Ocelové stupně schodiště — dodávka (PROBE finding)",
        "ks", 50, MISTO_D_INTERIOR, {"vrstva": "ocelové stupně"},
        warnings=[
            "PROBE 1.5 finding: ~50 ks pro D, úplně chybí ve starém VV. "
            "VYNECHANE_KRITICKE in Phase 5 audit."
        ],
        poznamka="z Phase 1.5 manual proof-of-concept",
    ))
    items.append(make_item(
        "PSV-767", "Ocelové stupně schodiště — montáž + kotvení",
        "ks", 50, MISTO_D_INTERIOR, {"vrstva": "ocelové stupně"},
    ))

    # IPE120 ocelové sloupky (krov 3.NP) — count z DXF řezy not extractable easily; estimate
    items.append(make_item(
        "PSV-767", "Ocelové sloupky IPE120 — krov 3.NP",
        "kg", 8 * 12 * 12,  # 8 ks × 12 kg/m × 12 m výšky D-objekt = ~1152 kg
        MISTO_D_INTERIOR, {"vrstva": "IPE120"},
        poznamka="estimate ~8 ks × 12 m × 12 kg/m; verify v Phase 4 z DXF řezy",
    ))
    return items


def main() -> None:
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    tabulky = json.loads(TAB.read_text(encoding="utf-8"))

    items = []
    items.extend(gen_PSV_766_truhlarske(dataset, tabulky))
    items.extend(gen_PSV_767_zamec_vnitrni(tabulky))

    by_kap = defaultdict(lambda: {"count": 0, "by_mj": defaultdict(float)})
    for it in items:
        by_kap[it["kapitola"]]["count"] += 1
        by_kap[it["kapitola"]]["by_mj"][it["MJ"]] += it["mnozstvi"]
    by_kap_clean = {k: {"count": v["count"], "totals": {mj: round(t, 2) for mj, t in v["by_mj"].items()}}
                     for k, v in by_kap.items()}

    out = {
        "metadata": {
            "phase": "3c",
            "part": "B — truhlářské + zámečnické vnitřní",
            "kapitoly": ["PSV-766", "PSV-767"],
            "items_count": len(items),
            "summary_per_kapitola": by_kap_clean,
        },
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    for k, v in sorted(by_kap_clean.items()):
        print(f"  {k:10s} count={v['count']:>4}  totals={v['totals']}")


if __name__ == "__main__":
    main()
