"""Phase 3a item generation — vnitřní dokončovací práce.

Kapitoly: HSV-611/612, HSV-631, PSV-771, PSV-776, PSV-781, PSV-784.

Iterates over the 109 D-rooms in objekt_D_geometric_dataset.json,
filters by relevant skladba/povrch code, decomposes each finishing
treatment into discrete items (per vrstva from Tabulka skladeb where
useful). ÚRS lookup is deferred — every item carries `urs_code: null`.

Output: test-data/libuse/outputs/items_phase_3a_vnitrni.json
"""
from __future__ import annotations

import json
import re
import sys
import uuid
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path("concrete-agent/packages/core-backend").resolve()))

DS = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")
AGG07 = Path("test-data/libuse/outputs/objekt_D_per_podlazi_aggregates.json")
OUT = Path("test-data/libuse/outputs/items_phase_3a_vnitrni.json")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def split_combined(value: str) -> list[str]:
    if not value:
        return []
    parts = re.split(r"[,/;\s]+", value.strip())
    return [p for p in parts if re.match(r"^[A-Z]{1,3}\d{1,3}$", p)]


def make_item(
    kapitola: str,
    popis: str,
    mj: str,
    mnozstvi: float,
    room: dict,
    skladba_ref: dict | None = None,
    vyrobce_ref: str = "",
    confidence: float = 0.9,
    poznamka: str = "",
    warnings: list[str] | None = None,
) -> dict:
    return {
        "item_id": str(uuid.uuid4()),
        "kapitola": kapitola,
        "popis": popis,
        "MJ": mj,
        "mnozstvi": round(mnozstvi, 3),
        "misto": {
            "objekt": room["objekt"],
            "podlazi": room["podlazi"],
            "mistnosti": [room["code"]],
        },
        "skladba_ref": skladba_ref or {},
        "vyrobce_ref": vyrobce_ref,
        "urs_code": None,
        "urs_description": None,
        "confidence": confidence,
        "status": "to_audit",
        "poznamka": poznamka,
        "warnings": warnings or [],
    }


def assign_doors_per_room(rooms: list[dict], openings_classified: dict) -> dict[str, float]:
    """For each room, sum door widths of openings whose nearest room is this one
    (closest code_position on the same podlaží). Returns {room_code: total_door_width_m}."""
    rooms_by_floor: dict[str, list[dict]] = defaultdict(list)
    for r in rooms:
        rooms_by_floor[r["podlazi"]].append(r)

    door_widths: dict[str, float] = defaultdict(float)
    for podlazi, block in openings_classified.items():
        cands = rooms_by_floor.get(podlazi, [])
        if not cands:
            continue
        for o in block.get("openings", []):
            if o["otvor_type"] != "door":
                continue
            ox, oy = o["position"]
            best = None
            best_d = None
            for r in cands:
                rx, ry = r["code_position"]
                d = ((ox - rx) ** 2 + (oy - ry) ** 2) ** 0.5
                if best is None or d < best_d:
                    best = r["code"]
                    best_d = d
            if best:
                w = o.get("width_mm") or 0
                door_widths[best] += w / 1000.0
    return door_widths


def assign_openings_per_room(rooms: list[dict], openings_classified: dict) -> dict[str, list]:
    """Same nearest-room logic, but returns full opening dicts per room."""
    rooms_by_floor: dict[str, list[dict]] = defaultdict(list)
    for r in rooms:
        rooms_by_floor[r["podlazi"]].append(r)
    out: dict[str, list[dict]] = defaultdict(list)
    for podlazi, block in openings_classified.items():
        cands = rooms_by_floor.get(podlazi, [])
        if not cands:
            continue
        for o in block.get("openings", []):
            ox, oy = o["position"]
            best = None
            best_d = None
            for r in cands:
                rx, ry = r["code_position"]
                d = ((ox - rx) ** 2 + (oy - ry) ** 2) ** 0.5
                if best is None or d < best_d:
                    best = r["code"]
                    best_d = d
            if best:
                out[best].append(o)
    return out


def opening_area_m2(o: dict) -> float:
    if o.get("width_mm") and o.get("height_mm"):
        return o["width_mm"] * o["height_mm"] / 1_000_000.0
    return 0.0


# ---------------------------------------------------------------------------
# Kapitola generators
# ---------------------------------------------------------------------------

def gen_HSV_611_omitky(room: dict, openings: list[dict]) -> list[dict]:
    """HSV-611/612 — vnitřní omítky stěn (sádrové byty, vápenocementové 1.PP)."""
    F = room.get("F_povrch_sten", "")
    items = []
    for code in split_combined(F):
        if code not in ("F04", "F05", "F17", "F19"):
            continue
        wall = room.get("plocha_sten_brutto_m2") or 0
        if wall <= 0:
            continue
        # Subtract opening areas from gross wall
        op_area = sum(opening_area_m2(o) for o in openings)
        wall_net = max(wall - op_area, 0)
        is_vapen = code == "F19"
        omitka_typ = "vápenocementová" if is_vapen else "sádrová"
        kapitola = "HSV-611" if is_vapen else "HSV-612"
        vyrobce = "např. Cemix 022 (vápenocement)" if is_vapen else "např. Cemix 016 j (sádrová)"
        skladba_ref = {"F_povrch_sten": code, "vrstva": f"omítka {omitka_typ} 10 mm"}

        items.append(make_item(kapitola, f"Penetrace pod omítku {omitka_typ}", "m2", wall_net,
                               room, skladba_ref, vyrobce_ref="adhézní můstek"))
        items.append(make_item(kapitola, f"Omítka {omitka_typ} vnitřních ploch tl. 10 mm",
                               "m2", wall_net, room, skladba_ref, vyrobce_ref=vyrobce))

        # Špalety okolo otvorů (door + window): obvod otvoru × hloubka 200 mm × 2 (dvě strany špalety)
        spalet_total_m2 = 0.0
        for o in openings:
            w_mm = o.get("width_mm") or 0
            h_mm = o.get("height_mm") or 0
            if not w_mm or not h_mm:
                continue
            otvor_obvod_m = (2 * w_mm + 2 * h_mm) / 1000.0  # outer frame perimeter
            spalet_total_m2 += otvor_obvod_m * 0.2  # 20 cm depth
        if spalet_total_m2 > 0:
            items.append(make_item(kapitola, f"Špalety {omitka_typ} okolo otvorů (hloubka ~200 mm)",
                                   "m2", spalet_total_m2, room, skladba_ref))
    return items


def gen_HSV_631_mazaniny(room: dict, skladby: dict) -> list[dict]:
    """HSV-631 — cementový potěr / mazanina podlah."""
    FF = room.get("FF", "")
    items = []
    for code in split_combined(FF):
        if not re.match(r"^FF\d", code):
            continue
        plocha = room.get("plocha_podlahy_m2") or 0
        if plocha <= 0:
            continue
        skladba = skladby.get(code, {})
        # Find a 'cement' / 'roznášecí' vrstva and its thickness
        cement_layer = None
        for v in skladba.get("vrstvy", []):
            n = (v.get("nazev") or "").lower()
            if "cement" in n or "potěr" in n or "potěr" in n or "roznáš" in n:
                cement_layer = v
                break
        thickness_mm = (cement_layer or {}).get("tloustka_mm") or 50  # default 50 mm
        skladba_ref = {"FF": code, "vrstva": f"cementový potěr tl. {thickness_mm} mm"}
        # Volume m³ = plocha × tl
        objem_m3 = plocha * (thickness_mm / 1000.0)
        items.append(make_item(
            "HSV-631", f"Penetrace pod potěr ({code})",
            "m2", plocha, room, skladba_ref, vyrobce_ref="adhézní můstek",
        ))
        items.append(make_item(
            "HSV-631", f"Cementový potěr F5 tl. {thickness_mm:.0f} mm ({code})",
            "m2", plocha, room, skladba_ref,
            vyrobce_ref="např. Cemix 020", poznamka=f"~{objem_m3:.3f} m³",
        ))
        # Kari síť 150/150/4 mm — typical reinforcement for screeds ≥ 50 mm
        if thickness_mm >= 50:
            items.append(make_item(
                "HSV-631", f"Kari síť 150/150/4 mm pro potěr ({code})",
                "m2", plocha * 1.05, room, skladba_ref,
                poznamka="overlap 5 % faktor",
            ))
    return items


def gen_PSV_771_keramika(room: dict, openings: list[dict], door_width_m: float) -> list[dict]:
    """PSV-771 — keramická dlažba (F01/F02/F18/F21/F22)."""
    F = room.get("F_povrch_podlahy", "")
    items = []
    for code in split_combined(F):
        if code not in ("F01", "F02", "F18", "F21", "F22"):
            continue
        plocha = room.get("plocha_podlahy_m2") or 0
        obvod = room.get("obvod_m") or 0
        if plocha <= 0:
            continue
        skladba_ref = {"F_povrch_podlahy": code, "vrstva": "keramická dlažba 10 mm"}
        items.append(make_item("PSV-771", f"Penetrace pod dlažbu ({code})", "m2", plocha, room, skladba_ref))
        items.append(make_item("PSV-771", f"Lepidlo flexibilní pod dlažbu ({code})",
                               "kg", plocha * 3.0, room, skladba_ref,
                               vyrobce_ref="např. Cemix 250", poznamka="~3 kg/m²"))
        items.append(make_item("PSV-771", f"Dlažba keramická — kladení ({code})",
                               "m2", plocha, room, skladba_ref,
                               vyrobce_ref="např. Rako Extra (slinutá, R10)"))
        items.append(make_item("PSV-771", f"Spárovací hmota ({code})",
                               "kg", plocha * 0.5, room, skladba_ref,
                               vyrobce_ref="cementová spárovací hmota", poznamka="~0.5 kg/m²"))
        # Sokl 80 mm — only F01/F02/F21 (chodby/byty); not F18/F22 (wet rooms with wall obklad)
        if code in ("F01", "F02", "F21"):
            sokl_m = max(obvod - door_width_m, 0)
            items.append(make_item("PSV-771", f"Sokl 80 mm dlažba ({code})",
                                   "m", sokl_m, room, skladba_ref,
                                   poznamka="obvod − šířka dveří"))
        # Wet rooms (F18, F22): hydroizolační stěrka pod dlažbu
        if code in ("F18", "F22"):
            # plocha + 0.3 m × obvod (vytažení nahoru podél stěn)
            hi_area = plocha + 0.3 * obvod
            items.append(make_item("PSV-771", f"Hydroizolační stěrka pod dlažbu — wet room ({code})",
                                   "m2", hi_area, room, skladba_ref,
                                   vyrobce_ref="např. Cemix 1K nebo Schomburg AquaFin",
                                   poznamka="plocha + 0.3 m vytažení po obvodu",
                                   warnings=["Sprchový kout: 2.0 m × šířka stěn extra (Phase 3a v2)"]))
    return items


def gen_PSV_776_vinyl(room: dict, door_width_m: float) -> list[dict]:
    """PSV-776 — vinyl Gerflor (F03)."""
    F = room.get("F_povrch_podlahy", "")
    items = []
    if "F03" not in split_combined(F):
        return items
    plocha = room.get("plocha_podlahy_m2") or 0
    obvod = room.get("obvod_m") or 0
    if plocha <= 0:
        return items
    skladba_ref = {"F_povrch_podlahy": "F03", "vrstva": "vinyl Gerflor"}
    items.append(make_item("PSV-776", "Penetrace pod nivelační stěrku (F03)",
                           "m2", plocha, room, skladba_ref))
    items.append(make_item("PSV-776", "Samonivelační stěrka 3 mm (F03)",
                           "m2", plocha, room, skladba_ref,
                           vyrobce_ref="např. Cemix Nivelační 30"))
    items.append(make_item("PSV-776", "Lepidlo na vinyl (F03)",
                           "kg", plocha * 0.4, room, skladba_ref,
                           vyrobce_ref="např. Mapei Ultrabond Eco V4 SP", poznamka="~0.4 kg/m²"))
    items.append(make_item("PSV-776", "Vinyl Gerflor Creation 30 — kladení (F03)",
                           "m2", plocha, room, skladba_ref,
                           vyrobce_ref="Gerflor Creation 30 nebo dle vzorkování"))
    items.append(make_item("PSV-776", "Sokl PVC 50 mm — vinyl (F03)",
                           "m", max(obvod - door_width_m, 0), room, skladba_ref))
    return items


def gen_PSV_781_obklady(room: dict) -> list[dict]:
    """PSV-781 — keramický obklad stěn F06 koupelny/WC, vč. hydroizolace pod obklad."""
    F = room.get("F_povrch_sten", "")
    items = []
    if "F06" not in split_combined(F):
        return items
    obvod = room.get("obvod_m") or 0
    sv_vyska_mm = room.get("svetla_vyska_mm") or 2700
    sv_vyska_m = sv_vyska_mm / 1000.0
    # Default: obklad to ceiling (světlá výška)
    plocha_obkladu = obvod * sv_vyska_m
    # NB: opening areas ideally subtracted; keep as gross + warning for now
    skladba_ref = {"F_povrch_sten": "F06", "vrstva": f"keramický obklad ~{sv_vyska_m:.2f} m"}

    # 🚨 HYDROIZOLACE STĚN POD OBKLAD — PROBE 2 finding
    items.append(make_item(
        "PSV-781", "Penetrace pod hydroizolaci stěn (F06)",
        "m2", plocha_obkladu, room, skladba_ref,
        warnings=[
            "PROBE 2: starý VV reports only 43 m² hydroizolace pod obklad komplex; "
            "ground truth ~283 m² komplex — significant gap"
        ],
    ))
    items.append(make_item(
        "PSV-781", "Hydroizolační stěrka 2× pod obklad (F06)",
        "m2", plocha_obkladu, room, skladba_ref,
        vyrobce_ref="např. Schomburg AquaFin 1K nebo Cemix 1K",
        warnings=["⚠️ KRITICKÉ — VYNECHANE_KRITICKE in starý VV (PROBE 2)"],
    ))
    items.append(make_item(
        "PSV-781", "Bandáž v koutech pod hydroizolaci (F06)",
        "m", obvod * 2, room, skladba_ref,
        poznamka="2× obvod (vertikální kouty + horizontální napojení)",
    ))

    # Obklad samotný
    items.append(make_item("PSV-781", "Penetrace pod lepidlo obkladu (F06)",
                           "m2", plocha_obkladu, room, skladba_ref))
    items.append(make_item("PSV-781", "Lepidlo flexibilní pod obklad (F06)",
                           "kg", plocha_obkladu * 3.0, room, skladba_ref,
                           vyrobce_ref="např. Cemix 250", poznamka="~3 kg/m²"))
    items.append(make_item("PSV-781", f"Obklad keramický — kladení do výšky ~{sv_vyska_m:.2f} m (F06)",
                           "m2", plocha_obkladu, room, skladba_ref,
                           vyrobce_ref="např. Rako WAA"))
    items.append(make_item("PSV-781", "Spárovací hmota epoxidová (F06)",
                           "kg", plocha_obkladu * 0.3, room, skladba_ref,
                           vyrobce_ref="např. Sopro EpoxiMörtel", poznamka="~0.3 kg/m²"))
    items.append(make_item("PSV-781", "Rohové lišty Schluter — chrome (F06)",
                           "m", obvod * 1.5, room, skladba_ref,
                           poznamka="vertikální kouty + horizontální ukončení",
                           vyrobce_ref="Schluter SCHIENE-A"))
    return items


def gen_PSV_784_malby(room: dict, openings: list[dict]) -> list[dict]:
    """PSV-784 — vnitřní malby walls + ceilings."""
    items = []
    F_st = room.get("F_povrch_sten", "")
    for code in split_combined(F_st):
        if code not in ("F04", "F05", "F17", "F19"):
            continue
        wall = room.get("plocha_sten_brutto_m2") or 0
        op_area = sum(opening_area_m2(o) for o in openings)
        wall_net = max(wall - op_area, 0)
        is_vapen = code == "F19"
        malba_typ = "vápenná" if is_vapen else "disperzní (Primalex Polar)"
        skladba_ref = {"F_povrch_sten": code, "vrstva": f"malba {malba_typ}"}
        items.append(make_item("PSV-784", f"Penetrace stěn pod malbu {malba_typ} ({code})",
                               "m2", wall_net, room, skladba_ref))
        items.append(make_item("PSV-784", f"Malba {malba_typ} 1. nátěr ({code})",
                               "m2", wall_net, room, skladba_ref))
        items.append(make_item("PSV-784", f"Malba {malba_typ} 2. nátěr ({code})",
                               "m2", wall_net, room, skladba_ref))

    # Ceiling malby
    CF = room.get("CF", "")
    F_pod = room.get("F_povrch_podhledu", "")
    if not CF or not F_pod:
        return items
    plocha_pod = room.get("plocha_podlahy_m2") or 0  # podhled plocha ≈ podlaha plocha
    for code in split_combined(F_pod):
        if code not in ("F04", "F05", "F17"):
            continue
        skladba_ref = {"CF": CF, "F_povrch_podhledu": code, "vrstva": "malba disperzní"}
        items.append(make_item("PSV-784", f"Penetrace podhledu pod malbu ({CF}/{code})",
                               "m2", plocha_pod, room, skladba_ref))
        items.append(make_item("PSV-784", f"Malba podhledu disperzní 1. nátěr ({CF}/{code})",
                               "m2", plocha_pod, room, skladba_ref))
        items.append(make_item("PSV-784", f"Malba podhledu disperzní 2. nátěr ({CF}/{code})",
                               "m2", plocha_pod, room, skladba_ref))
    return items


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not DS.exists() or not AGG07.exists():
        raise SystemExit("Run prior phases first")
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    agg07 = json.loads(AGG07.read_text(encoding="utf-8"))

    rooms = dataset["rooms"]
    skladby = dataset.get("skladby", {})
    openings_classified = agg07.get("openings_classified", {}).get("per_podlazi_classified", {})

    print("Building per-room opening assignment…")
    door_widths = assign_doors_per_room(rooms, openings_classified)
    openings_by_room = assign_openings_per_room(rooms, openings_classified)

    print("Generating items…")
    all_items: list[dict] = []
    for room in rooms:
        ops = openings_by_room.get(room["code"], [])
        dw = door_widths.get(room["code"], 0.0)
        all_items.extend(gen_HSV_611_omitky(room, ops))
        all_items.extend(gen_HSV_631_mazaniny(room, skladby))
        all_items.extend(gen_PSV_771_keramika(room, ops, dw))
        all_items.extend(gen_PSV_776_vinyl(room, dw))
        all_items.extend(gen_PSV_781_obklady(room))
        all_items.extend(gen_PSV_784_malby(room, ops))

    # Aggregations per kapitola
    by_kap: dict[str, dict] = {}
    for it in all_items:
        kap = it["kapitola"]
        bag = by_kap.setdefault(kap, {"count": 0, "by_mj": defaultdict(float)})
        bag["count"] += 1
        bag["by_mj"][it["MJ"]] += it["mnozstvi"]
    by_kap_clean = {
        k: {"count": v["count"], "totals_per_mj": {mj: round(t, 2) for mj, t in v["by_mj"].items()}}
        for k, v in by_kap.items()
    }

    # Update carry-forward findings on the dataset (PROBE 2 NEW)
    new_finding = {
        "from_phase": "3a — PSV-781 obklady",
        "severity": "critical",
        "summary": (
            "starý VV reports only 43 m² hydroizolace pod obklad komplex; F06 ground "
            "truth across komplex ~283 m² (D-side ≈ 71 m² for koupelny F06). Gap of "
            "~240 m² komplex hydroizolace under F06 obklad. Persistuje až do Phase 5."
        ),
        "next_action": "catalogue as VYNECHANE_KRITICKE in Phase 5 audit; verify F06 wall area against Tabulka skladeb step (F06 = obklad keramický + skladba pod ním uvedena samostatně)",
        "parser_d_side_m2": round(
            sum(it["mnozstvi"] for it in all_items
                if it["kapitola"] == "PSV-781" and "Hydroizolační stěrka" in it["popis"]),
            2,
        ),
    }
    cff = dataset.setdefault("carry_forward_findings", [])
    cff.append(new_finding)
    DS.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")

    out = {
        "metadata": {
            "phase": "3a",
            "kapitoly": ["HSV-611/612", "HSV-631", "PSV-771", "PSV-776", "PSV-781", "PSV-784"],
            "items_count": len(all_items),
            "summary_per_kapitola": by_kap_clean,
            "carry_forward_findings": cff,
        },
        "items": all_items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print()
    print(f"Total items: {len(all_items)}")
    print()
    print("Per kapitola:")
    for k, v in sorted(by_kap_clean.items()):
        print(f"  {k:10s} count={v['count']:>4}  totals={v['totals_per_mj']}")


if __name__ == "__main__":
    main()
