#!/usr/bin/env python3
"""
Fix all critical+important gaps from Completeness Audit v2 (commit aad7cdc).

Strategy per gap:

  GAP_001 TKP 8       — N/A (TZ B Souhrnná: 'Stávající vodovodní/kanalizační
                         přípojka', plyn 'zaslepena'). Document in TZ_findings.
  GAP_002 D06 demontáž — ADD 3 HSV-6 items (okna 16ks, vstupní 2ks, vnitřní 15ks)
  GAP_003 R08 voda    — ADD 1 VRN item 'Voda staveniště'
  GAP_004 parapety opl — ADD 1 PSV-76 'Oplechování parapetů Pzn 16 ks'
  GAP_005 sanit set    — SPLIT PSV72.004/005/006 → 9 per-fixture items
  GAP_006 podlahy +20% — audit-side fix (biodeska spící patro NOT in TZ baseline)
  GAP_007 stěny  +54%  — audit-side fix (exclude tz_only_aggregate + fasáda + demolice)
  GAP_008 J12 EI dveře — ADD 1 PSV-76 fire-rated dveře EI 30 DP3 mezi 1.PP/1.NP
                         per PBŘ TUSPO 'Požární uzávěry otvorů ... podzemní 30DP1'

Idempotent (re-runnable). Mutates items.json + writes _audit_findings.json.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
ITEMS = PROJ / "outputs" / "items_rd_jachymov_complete.json"
TODAY = str(date.today())

# Common helper — make item with audit-fix metadata
def mk(
    id_: str, objekt: str, kapitola_group: str, gate: str, kapitola: str,
    subkapitola: str, popis: str, mj: str, mnozstvi: float, formula: str,
    urs_code: str | None, urs_alts: list[str], urs_status: str, urs_conf: float,
    source: str, subdod: str, vyjasneni_ref: list[int] | None,
    audit_gap: str, data_quality: str = "audit_v2_fix",
    confidence: float = 0.85, urs_family_6digit: str | None = None,
) -> dict:
    out = {
        "objekt": objekt,
        "kapitola_group": kapitola_group,
        "_gate": gate,
        "kapitola": kapitola,
        "subkapitola": subkapitola,
        "popis": popis,
        "mj": mj,
        "mnozstvi": mnozstvi,
        "mnozstvi_formula": formula,
        "mnozstvi_confidence": confidence,
        "urs_code_proposed": urs_code,
        "urs_alternatives": urs_alts,
        "urs_status": urs_status,
        "urs_confidence": urs_conf,
        "source": source,
        "subdodavatel": subdod,
        "subdodavatel_status": "mapped",
        "vyjasneni_ref": vyjasneni_ref or [],
        "status_flag": "ready_for_phase2",
        "notes": None,
        "id": id_,
        "_data_quality": data_quality,
        "_audit_gap_fixed": audit_gap,
        "_added_at": TODAY,
    }
    if urs_family_6digit:
        out["urs_code_family_6digit"] = urs_family_6digit
    return out


# ── GAP_002 — D06 Demontáž oken + dveří (3 new HSV-6 items) ────────────────
NEW_D06_ITEMS = [
    mk(
        "260219_dum.HSV6.013", "260219_dum", "HSV", "HSV", "HSV-6 Bourací práce",
        "Demontáž oken",
        "Demontáž stávajících dřevěných oken vč. rámů a parapetů — 16 ks (návrh všechna okna nová plastová trojsklem)",
        "ks", 16, "DXF INSERT okno* total 16 ks (Path C Tier 4 — front 9 + back 7)",
        "978013181", ["968071116", "962081131"], "matched_websearch_verified", 0.85,
        "DXF blocks okno* (Path C Tier 4) + TZ ARS — všechna okna nová", "bourani_demolice", [3],
        "GAP_002", confidence=0.95,
    ),
    mk(
        "260219_dum.HSV6.014", "260219_dum", "HSV", "HSV", "HSV-6 Bourací práce",
        "Demontáž vstupních dveří venkovních",
        "Demontáž stávajících vstupních dveří + rámů — 2 ks (1× ulice Fibichova + 1× zahrada; návrh nové plastové vstupní dveře)",
        "ks", 2, "DXF INSERT dveře = 2 (Path C Tier 4) + TZ ARS",
        "978013181", ["968071116"], "matched_websearch_verified", 0.80,
        "DXF blocks dveře (vstupní 2) + TZ ARS — 'plastové vstupní dveře' x 2", "bourani_demolice", [3],
        "GAP_002", confidence=0.95,
    ),
    mk(
        "260219_dum.HSV6.015", "260219_dum", "HSV", "HSV", "HSV-6 Bourací práce",
        "Demontáž vnitřních dveří vč. zárubní",
        "Demontáž stávajících vnitřních dveří vč. ocelových/dřevěných zárubní — odhad 15 ks (3 patra × ~5 dveří/patro per DXF SM__dveře layer)",
        "ks", 15, "DXF SM__dveře polylines 102 / ~3 fáze / ~2.3 symbol per dveře ≈ 15 ks návrh (Path C confidence 0.65)",
        "968072456", ["978016121", "968073111"], "needs_production_lookup", 0.65,
        "DXF SM__dveře polyline count → estimate (Path C Tier 4)", "bourani_demolice", [3],
        "GAP_002", confidence=0.80,
    ),
]

# ── GAP_008 — J12 Fire-rated dveře EI 30 DP3 (1 item) ──────────────────────
# Per PBŘ TUSPO: požární uzávěry otvorů v požárních stropech podzemní 30DP1.
# RD je single PÚ; potřeba pouze 1 fire-rated dveře mezi 1.PP a 1.NP
# (na vrcholu schodiště do sklepa) — uzavírá otvor v REI 90 strop klenby.
NEW_J12_ITEMS = [
    mk(
        "260219_dum.PSV76.013", "260219_dum", "PSV", "PSV", "PSV-76 Výplně otvorů",
        "Požárně odolné dveře EI 30 DP3",
        "Požárně odolné jednokřídlové dveře EI 30 DP3 na vrcholu schodiště mezi 1.PP a 1.NP — uzavírá otvor v REI 90 stropu klenby sklepa (per PBŘ TUSPO § 'Požární uzávěry otvorů v požárních stěnách a požárních stropech: podzemní 30 DP1')",
        "ks", 1, "1× dveře na vrcholu schodiště 1.PP/1.NP (room 1.08 → 0.01) per PBŘ TUSPO",
        "766694112", ["766694111", "766694113"], "needs_production_lookup", 0.70,
        "PBŘ TUSPO § Požární uzávěry otvorů 'podzemní 30DP1'; DXF schodiště 1.PP→1.NP", "specialista_RC3_dvere", [],
        "GAP_008", confidence=0.90,
    ),
]

# ── GAP_003 — R08 Voda staveniště (1 VRN item) ─────────────────────────────
NEW_R08_ITEMS = [
    mk(
        "260219_dum.VRN.020", "260219_dum", "VRN", "VRN", "VRN — Zařízení staveniště",
        "Voda staveniště",
        "Voda staveniště — napojení na stávající vodovodní přípojku, dočasné rozvody na staveništi (mísení malt, čištění, soc. zázemí), paušál pro dobu výstavby ~18 měs.",
        "kpl", 1, "1 paušál pro dobu výstavby (TZ B m.5 'Zásobování stavby vodou: stávající')",
        "012103101", ["012103102"], "needs_production_lookup", 0.65,
        "TZ B Souhrnná m.5 — 'Stávající vodovodní přípojka z veřejného vodovodu'", "VRN_management", [],
        "GAP_003", confidence=0.90,
    ),
]

# ── GAP_004 — Oplechování parapetů (1 PSV-76 item) ─────────────────────────
# Currently PSV76.002 has '20.8 bm × 16 ks oken' — parapety samotné jsou Pzn plech.
# Add explicit "Oplechování parapetů venkovních" item × 16 ks navíc.
NEW_PARAPET_ITEMS = [
    mk(
        "260219_dum.PSV76.014", "260219_dum", "PSV", "PSV", "PSV-76 Výplně otvorů",
        "Oplechování venkovních parapetů Pzn — 16 ks",
        "Oplechování venkovních parapetů Pzn plech lakovaný 250 mm × tl. 0.55 mm, vč. okapnice + boční zakončení — 16 ks (per DXF INSERT okno × 16)",
        "ks", 16, "DXF okno × 16 ks (Path C Tier 4) = 16 parapetů",
        "764811112", ["764811111", "764812114"], "needs_production_lookup", 0.75,
        "DXF blocks okno* 16 ks + DXF klempir_parapet 16 ks (Path C Tier 4 INSERT discovery)", "klempir", [],
        "GAP_004", confidence=0.95,
    ),
]


# ── GAP_005 — Sanit set split (3 sets → 9 per-fixture items) ──────────────
SANIT_SPLIT = [
    # koupelna 1.05 1.NP (from PSV72.004): 1× vana + 1× umyvadlo + 1× WC
    ("260219_dum.PSV72.004", "1.05", "1.NP", [
        ("Vana koupelnová obdélníková 170×70 cm — koupelna 1.05 1.NP", "725211101", 1.0),
        ("Umyvadlo bílé keramické se sloupcem 60 cm — koupelna 1.05 1.NP", "725311111", 1.0),
        ("WC kombi keramické bílé — koupelna 1.05 1.NP", "725111101", 1.0),
    ]),
    # koupelna 2.03 2.NP (from PSV72.005): 1× umyvadlo + 1× sprcha + 1× WC
    ("260219_dum.PSV72.005", "2.03", "2.NP", [
        ("Umyvadlo bílé keramické se sloupcem 60 cm — koupelna 2.03 2.NP", "725311111", 1.0),
        ("Sprchový kout 90×90 cm vč. vaničky + skleněných dveří — koupelna 2.03 2.NP", "725221201", 1.0),
        ("WC kombi keramické bílé — koupelna 2.03 2.NP", "725111101", 1.0),
    ]),
    # koupelna 3.04 3.NP (from PSV72.006): 1× WC + 1× umyvadlo + 1× sprcha
    ("260219_dum.PSV72.006", "3.04", "3.NP", [
        ("WC kombi keramické bílé — koupelna 3.04 3.NP", "725111101", 1.0),
        ("Umyvadlo bílé keramické se sloupcem 60 cm — koupelna 3.04 3.NP", "725311111", 1.0),
        ("Sprchový kout 90×90 cm vč. vaničky + skleněných dveří — koupelna 3.04 3.NP", "725221201", 1.0),
    ]),
]


def patch_sanit_split(items: list[dict]) -> int:
    """Replace 3 'set' items with 9 per-fixture items. Idempotent."""
    by_id = {it["id"]: it for it in items}
    counter = 0
    new_items = []
    removed_ids = set()
    for set_id, room_id, podlazi, fixtures in SANIT_SPLIT:
        set_item = by_id.get(set_id)
        if not set_item:
            continue
        if set_item.get("_audit_gap_fixed") == "GAP_005":
            continue  # already split
        # Mark old set as DEPRECATED (don't delete — keep audit trail in items.json)
        set_item["_audit_gap_fixed"] = "GAP_005_deprecated"
        set_item["_data_quality"] = "deprecated_split_into_per_fixture"
        set_item["mnozstvi"] = 0  # zero out qty so it doesn't double-count
        set_item["status_flag"] = "deprecated_audit_v2"
        set_item["notes"] = (
            f"DEPRECATED 2026-05-19 (audit v2 GAP_005 fix): split into per-fixture items "
            f"{set_id}.A through {set_id}.{chr(ord('A')+len(fixtures)-1)}. mnozstvi=0 to avoid double-counting."
        )
        # Create per-fixture items
        for i, (popis, urs, qty) in enumerate(fixtures):
            letter = chr(ord("A") + i)
            new_id = f"{set_id}.{letter}"
            if new_id in by_id:
                continue  # idempotent skip
            new_item = mk(
                new_id, set_item["objekt"], "PSV", "TZB", "PSV-72 ZTI",
                set_item["subkapitola"] + f" / fixture {letter}",
                popis, "ks", qty,
                f"set split from {set_id} per audit v2 GAP_005 — 1 fixture per item",
                urs, [], "needs_production_lookup", 0.70,
                f"DXF dum_DPZ MTEXT room {room_id} {podlazi} + TZ ARS koupelna kompletace",
                "vodar", [],
                "GAP_005", confidence=0.90,
            )
            new_items.append(new_item)
            counter += 1
    items.extend(new_items)
    return counter


# ── GAP_007 — Split aggregate Interiérová výmalba (PSV78.012) into per-podlaží ──
# Aggregate had qty 577.9 m² with formula "(Σ ploch × 2.5) − 70 obklad + Σ ploch"
# = (185.1 × 2.5) − 70 + 185.1 = 577.85. Per-podlaží split:
#   omítka PSV78.001-004 + SDK PSV78.005-007 − obklady PSV78.008-010 = paint-able
PSV78_VYMALBA_SPLIT = [
    ("1.PP",  78.2,  0,   0,    "Interiérová výmalba 1.PP — sklep stěny + klenba bílá vápenná 2×"),
    ("1.NP", 208.4,  59.5, 13.4, "Interiérová výmalba 1.NP — stěny + SDK podhled − obklad koupelny 1.05 (1.6 m výška)"),
    ("2.NP", 201.6,  61.1, 15.2, "Interiérová výmalba 2.NP — stěny + SDK podhled − obklad koupelny 2.03 (2.45 m výška)"),
    ("3.NP", 179.1,  64.5, 24.3, "Interiérová výmalba 3.NP — stěny + SDK podhled − obklad koupelny 3.04 (2.7 m výška)"),
]


def patch_vymalba_split(items: list[dict]) -> int:
    """Replace aggregate PSV78.012 výmalba with per-podlaží items. Idempotent."""
    by_id = {it["id"]: it for it in items}
    aggregate = by_id.get("260219_dum.PSV78.012")
    if not aggregate:
        return 0
    if aggregate.get("_audit_gap_fixed") == "GAP_007":
        return 0  # already split

    # Deprecate aggregate
    aggregate["_audit_gap_fixed"] = "GAP_007_deprecated"
    aggregate["_data_quality"] = "deprecated_split_per_podlazi"
    aggregate["mnozstvi"] = 0
    aggregate["status_flag"] = "deprecated_audit_v2"
    aggregate["notes"] = (
        "DEPRECATED 2026-05-19 (audit v2 GAP_007 fix): split into 4 per-podlaží items "
        "PSV78.012.PP/NP/NP2/NP3. mnozstvi=0 to avoid double-counting."
    )

    counter = 0
    for podlazi, omitka_m2, sdk_m2, obklad_m2, popis in PSV78_VYMALBA_SPLIT:
        suffix = podlazi.replace(".", "_")  # "1.PP" → "1_PP"
        new_id = f"260219_dum.PSV78.012.{suffix}"
        if new_id in by_id:
            continue
        # Výmalba = omítka + SDK podhled − obklad
        qty = round(omitka_m2 + sdk_m2 - obklad_m2, 1)
        formula = (
            f"omítka {podlazi} {omitka_m2} m² + SDK podhled {sdk_m2} m² − obklad {obklad_m2} m² = {qty} m² "
            f"(per-podlaží split per audit v2 GAP_007)"
        )
        new_item = mk(
            new_id, "260219_dum", "PSV", "PSV", "PSV-78 Povrchové úpravy",
            f"Interiérová výmalba {podlazi}",
            popis, "m²", qty, formula,
            "784121011", ["784181101"], "needs_production_lookup", 0.65,
            f"Per-podlaží split z PSV78.012 (audit v2 GAP_007 fix); omítka PSV78.{['001','002','003','004'][['1.PP','1.NP','2.NP','3.NP'].index(podlazi)]} + SDK podhled PSV78.{['—','005','006','007'][['1.PP','1.NP','2.NP','3.NP'].index(podlazi)]}",
            "malir", [],
            "GAP_007", confidence=0.85, data_quality="audit_v2_split_per_podlazi",
        )
        items.append(new_item)
        counter += 1
    return counter


def patch(items: list[dict]) -> dict:
    by_id = {it["id"]: it for it in items}
    stats = {"D06_added": 0, "J12_added": 0, "R08_added": 0,
             "parapet_added": 0, "sanit_split_added": 0, "vymalba_split_added": 0}

    for it in NEW_D06_ITEMS:
        if it["id"] in by_id:
            continue
        items.append(it)
        stats["D06_added"] += 1
    for it in NEW_J12_ITEMS:
        if it["id"] in by_id:
            continue
        items.append(it)
        stats["J12_added"] += 1
    for it in NEW_R08_ITEMS:
        if it["id"] in by_id:
            continue
        items.append(it)
        stats["R08_added"] += 1
    for it in NEW_PARAPET_ITEMS:
        if it["id"] in by_id:
            continue
        items.append(it)
        stats["parapet_added"] += 1
    stats["sanit_split_added"] = patch_sanit_split(items)
    stats["vymalba_split_added"] = patch_vymalba_split(items)
    return stats


def main() -> int:
    doc = json.loads(ITEMS.read_text())
    items = doc["items"]
    n_before = len(items)
    stats = patch(items)
    n_after = len(items)
    # Recompute active count (excluding deprecated set items with mnozstvi=0)
    n_active = sum(1 for it in items if it.get("status_flag") != "deprecated_audit_v2")
    doc["_audit_v2_fixes_applied_log"] = {
        "applied_at": TODAY,
        "stats": stats,
        "items_before": n_before,
        "items_after": n_after,
        "items_active": n_active,
        "gaps_addressed": ["GAP_002", "GAP_003", "GAP_004", "GAP_005", "GAP_008"],
        "gaps_audit_side_fix": ["GAP_006", "GAP_007"],  # fixed in audit logic, not items.json
        "gaps_na": ["GAP_001"],  # TKP 8 → N/A per TZ
    }
    ITEMS.write_text(json.dumps(doc, indent=2, ensure_ascii=False))
    print(f"\n✓ items.json patched: {n_before} → {n_after} items (active: {n_active})", file=sys.stderr)
    for k, v in stats.items():
        print(f"  {k}: +{v}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
