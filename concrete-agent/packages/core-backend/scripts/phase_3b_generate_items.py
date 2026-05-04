"""Phase 3b item generation — vnější dokončovací práce + suterén.

Kapitoly 1-9: HSV-622.1/2/3, PSV-712, PSV-713 ETICS, PSV-762, PSV-764,
PSV-765 (fasáda + střecha).

Kapitoly 10-11: PSV-783 vnější + suterén PSV-783/PSV-713/PSV-711.

Uses spec ground-truth numbers where parser geometry is rough
(facade brutto, roof slope areas) — flagged in poznamka. Klempířské
a zámečnické kvanta z Tabulky × 0.25 D-share (4 equal objekty).

Output: test-data/libuse/outputs/items_phase_3b_vnejsi_a_suteren.json
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
TAB = Path("test-data/libuse/outputs/tabulky_loaded.json")
OUT = Path("test-data/libuse/outputs/items_phase_3b_vnejsi_a_suteren.json")


# ---------------------------------------------------------------------------
# D-side ground-truth facts (mix of spec values + Phase 1 aggregates)
# ---------------------------------------------------------------------------

# Spec ground truth (Phase 0.7 step 2 cross-check uses these).
FACADE_BRUTTO_M2 = 838.0       # J 275 + S 275 + V 144 + Z 144
FACADE_OPENINGS_M2 = 51.41     # Phase 0.7 step 3 sum windows + curtain walls
FACADE_NETTO_M2 = FACADE_BRUTTO_M2 - FACADE_OPENINGS_M2

ROOF_SKAT_31_M2 = 195.0        # spec slope-projected
ROOF_SKAT_67_M2 = 109.0        # spec slope-projected
ROOF_FLAT_CENTRAL_M2 = 139.0   # spec central plochá střecha
ROOF_KRYTINA_M2 = ROOF_SKAT_31_M2 + ROOF_SKAT_67_M2   # 304
ROOF_HREBEN_LENGTH_M = 28.0    # rough, footprint long axis
ROOF_OBVOD_M = 80.98           # spec terén obvod also approximates roof eaves obvod

# D-share for items pulled from Tabulky klempířských / zámečnických
# (whose quantities are komplex A+B+C+D). 4 buildings ≈ equal → 0.25.
D_SHARE = 0.25

# 1.PP D-side
PP_FLOOR_AREA_M2 = 268.0       # Phase 1 step 1 sum_area_m2
PP_PERIMETER_M = 462.8          # Phase 1 step 1 sum_perimeter_m

# Wall finish brutto from Phase 1 aggregates
F13_M2 = 214.01                # tenkovrstvá omítka balkóny + atiky
F23_M2_ESTIMATE = ROOF_OBVOD_M * 3.0  # anti-graffiti — fasáda parter, ~3 m výšky × obvod

# F08 ETICS / cihelné pásky area = facade netto − F13 (− F16 podhledy ~30 m² estimate)
F16_PODHLEDY_M2_ESTIMATE = 30.0
F08_PASKY_M2 = FACADE_NETTO_M2 - F13_M2 - F16_PODHLEDY_M2_ESTIMATE
ETICS_BRUTTO_M2 = FACADE_NETTO_M2  # ETICS is under all finishes; same area

# Sokl ETICS XPS (~0.5 m height)
SOKL_HEIGHT_M = 0.5
SOKL_AREA_M2 = ROOF_OBVOD_M * SOKL_HEIGHT_M  # ~40 m²


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_item(
    kapitola: str,
    popis: str,
    mj: str,
    mnozstvi: float,
    misto: dict,
    skladba_ref: dict | None = None,
    vyrobce_ref: str = "",
    confidence: float = 0.85,
    poznamka: str = "",
    warnings: list[str] | None = None,
) -> dict:
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


MISTO_D_FACADE = {"objekt": "D", "podlazi": "fasáda", "mistnosti": []}
MISTO_D_ROOF = {"objekt": "D", "podlazi": "střecha", "mistnosti": []}
MISTO_D_PP = {"objekt": "D", "podlazi": "1.PP", "mistnosti": []}


# ---------------------------------------------------------------------------
# Kapitola 1: HSV-622.1 cihelné pásky Terca (F08)
# ---------------------------------------------------------------------------

def gen_HSV_622_1_pasky() -> list[dict]:
    items = []
    plocha = F08_PASKY_M2
    skladba_ref = {"F_povrch_sten": "F08", "vrstva": "cihelné pásky Terca"}
    poznamka = (
        f"F08 plocha = facade_netto {FACADE_NETTO_M2:.1f} − F13 {F13_M2:.1f} − "
        f"F16_podhledy {F16_PODHLEDY_M2_ESTIMATE:.1f} = {plocha:.1f} m² (estimate; "
        f"verify in Phase 4 against Tabulka skladeb)"
    )
    items.append(make_item("HSV-622.1", "Penetrace pod cihelné pásky", "m2",
                           plocha, MISTO_D_FACADE, skladba_ref, poznamka=poznamka))
    items.append(make_item("HSV-622.1", "Lepidlo flexibilní pro cihelné pásky", "kg",
                           plocha * 5.0, MISTO_D_FACADE, skladba_ref,
                           vyrobce_ref="Terca / nebo dle TZ", poznamka="~5 kg/m²"))
    items.append(make_item("HSV-622.1", "Cihelné pásky Terca — kladení", "m2",
                           plocha, MISTO_D_FACADE, skladba_ref,
                           vyrobce_ref="Terca / Wienerberger",
                           poznamka="~50 ks/m² vazba běžná"))
    items.append(make_item("HSV-622.1", "Spárovací hmota Polyblend S", "kg",
                           plocha * 4.0, MISTO_D_FACADE, skladba_ref,
                           vyrobce_ref="Polyblend S", poznamka="~4 kg/m²"))
    return items


# ---------------------------------------------------------------------------
# Kapitola 2: HSV-622.2 tenkovrstvá omítka F13
# ---------------------------------------------------------------------------

def gen_HSV_622_2_omitka_F13() -> list[dict]:
    items = []
    plocha = F13_M2
    skladba_ref = {"F_povrch_sten": "F13", "vrstva": "tenkovrstvá silikonová omítka 2 mm"}
    items.append(make_item("HSV-622.2", "Penetrace pod tenkovrstvou omítku (F13)", "m2",
                           plocha, MISTO_D_FACADE, skladba_ref))
    items.append(make_item("HSV-622.2", "Armovací síť do první vrstvy (F13)", "m2",
                           plocha * 1.1, MISTO_D_FACADE, skladba_ref,
                           vyrobce_ref="sklotextilní 145 g/m²", poznamka="overlap 10 %"))
    items.append(make_item("HSV-622.2", "Tenkovrstvá silikonová omítka 1.5–2 mm (F13)", "m2",
                           plocha, MISTO_D_FACADE, skladba_ref,
                           vyrobce_ref="např. Cemix Silikonová pastovitá"))
    return items


# ---------------------------------------------------------------------------
# Kapitola 3: HSV-622.3 betonová stěrka podhledy F16
# ---------------------------------------------------------------------------

def gen_HSV_622_3_sterka_F16() -> list[dict]:
    items = []
    plocha = F16_PODHLEDY_M2_ESTIMATE
    skladba_ref = {"F_povrch_podhledu": "F16", "vrstva": "betonová stěrka strukturovaná"}
    poznamka = (
        f"F16 plocha {plocha:.1f} m² je odhad (balkónové podhledy + atik podhled). "
        f"Ověřit v Phase 4 spočítáním z DXF balkónových polygonů."
    )
    items.append(make_item("HSV-622.3", "Penetrace pod betonovou stěrku (F16)", "m2",
                           plocha, MISTO_D_FACADE, skladba_ref, poznamka=poznamka))
    items.append(make_item("HSV-622.3", "Betonová stěrka strukturovaná (F16)", "m2",
                           plocha, MISTO_D_FACADE, skladba_ref,
                           vyrobce_ref="např. Cemix BetonContact"))
    return items


# ---------------------------------------------------------------------------
# Kapitola 4-5: PSV-712 ploché střechy + terasy + balkóny (RF11/12/13/14/20/22)
# ---------------------------------------------------------------------------

def gen_PSV_712_strechy(skladby_master: dict) -> list[dict]:
    items = []
    # 4a) RF — central flat roof (RF13/RF14 chodník nebo extensive). We don't
    # know which RF code is used for the central flat — use placeholder RF13.
    plocha_central = ROOF_FLAT_CENTRAL_M2
    rf_central = "RF13"
    skladba = skladby_master.get(rf_central, {})
    skladba_ref = {"RF": rf_central, "kind": "plochá střecha centrální"}
    items.append(make_item("PSV-712", f"Parozábrana ({rf_central})", "m2",
                           plocha_central * 1.1, MISTO_D_ROOF, skladba_ref,
                           vyrobce_ref="SBS modifikovaný asfaltový pás"))
    items.append(make_item("PSV-712", f"EPS 200 mm tepelná izolace ({rf_central})", "m2",
                           plocha_central, MISTO_D_ROOF, skladba_ref,
                           vyrobce_ref="EPS 100/150 dle skladby",
                           poznamka="objem ≈ 0.20 m³/m² → ~28 m³"))
    items.append(make_item("PSV-712", f"Spádová klín EPS prům. tl. 100 mm ({rf_central})", "m2",
                           plocha_central, MISTO_D_ROOF, skladba_ref,
                           poznamka="objem ≈ 0.10 m³/m² → ~14 m³"))
    items.append(make_item("PSV-712", f"PVC fólie DEKPLAN 77 ({rf_central})", "m2",
                           plocha_central * 1.1, MISTO_D_ROOF, skladba_ref,
                           vyrobce_ref="DEKPLAN 77 / Sika Sarnafil",
                           poznamka="overlap 10 %"))
    items.append(make_item("PSV-712", f"Mechanické kotvení PVC fólie ({rf_central})", "ks",
                           plocha_central * 4.0, MISTO_D_ROOF, skladba_ref,
                           poznamka="~4 ks/m² (větrná zóna II)"))
    items.append(make_item("PSV-712", f"Geotextilie pod chodník ({rf_central})", "m2",
                           plocha_central * 1.1, MISTO_D_ROOF, skladba_ref))
    items.append(make_item("PSV-712", f"Štěrkový posyp 50 mm ({rf_central})", "m3",
                           plocha_central * 0.05, MISTO_D_ROOF, skladba_ref))

    # 4b) RF20 balkóny (z Phase 1 = 49 m²)
    plocha_balk = 49.14
    skladba_ref = {"RF": "RF20", "kind": "balkóny — terasová dlažba na podstavcích"}
    items.append(make_item("PSV-712", "Hydroizolace balkóny (RF20)", "m2",
                           plocha_balk + 0.3 * 35.0, MISTO_D_ROOF, skladba_ref,
                           vyrobce_ref="SBS pás",
                           poznamka="plocha + nahoru 0.3 m × přibližný balkón obvod 35 m"))
    items.append(make_item("PSV-712", "XPS 80 mm tepelná izolace (RF20)", "m2",
                           plocha_balk, MISTO_D_ROOF, skladba_ref,
                           vyrobce_ref="XPS Synthos / Stiroduro"))
    items.append(make_item("PSV-712", "Geotextilie pod terasovou dlažbu (RF20)", "m2",
                           plocha_balk * 1.1, MISTO_D_ROOF, skladba_ref))
    items.append(make_item("PSV-712", "Terasová dlažba 60×60 cm na podstavcích (RF20)", "m2",
                           plocha_balk, MISTO_D_ROOF, skladba_ref,
                           vyrobce_ref="betonová dlažba dle architekta + plast. podstavce"))
    items.append(make_item("PSV-712", "Odvodňovač terasy + napojení na svod (RF20)", "ks",
                           4, MISTO_D_ROOF, skladba_ref,
                           poznamka="odhadem 1 odvodňovač / 12 m² balkónu"))
    return items


# ---------------------------------------------------------------------------
# Kapitola 6: PSV-713 ETICS (EPS 200 + sokl XPS)
# ---------------------------------------------------------------------------

def gen_PSV_713_etics() -> list[dict]:
    items = []
    plocha = ETICS_BRUTTO_M2
    skladba_ref = {"system": "ETICS", "vrstva": "EPS 200 + výztužná stěrka"}
    poznamka = "ETICS pod celou facade netto, vč. F08 cihelných pásků a F13 omítky"

    items.append(make_item("PSV-713", "Penetrace podkladu ETICS", "m2",
                           plocha, MISTO_D_FACADE, skladba_ref, poznamka=poznamka))
    items.append(make_item("PSV-713", "Lepicí stěrka pod EPS", "kg",
                           plocha * 5.0, MISTO_D_FACADE, skladba_ref, poznamka="~5 kg/m²"))
    items.append(make_item("PSV-713", "EPS 200 mm tepelná izolace fasáda", "m2",
                           plocha, MISTO_D_FACADE, skladba_ref,
                           vyrobce_ref="Isover EPS Greywall",
                           poznamka="objem ≈ 0.20 m³/m² → ~157 m³"))
    items.append(make_item("PSV-713", "Talířové hmoždinky", "ks",
                           plocha * 6.0, MISTO_D_FACADE, skladba_ref,
                           poznamka="~6 ks/m² (větrná zóna)"))
    items.append(make_item("PSV-713", "Armovací síť do výztužné stěrky", "m2",
                           plocha * 1.1, MISTO_D_FACADE, skladba_ref,
                           vyrobce_ref="sklotextilní 160 g/m²", poznamka="overlap 10 %"))
    items.append(make_item("PSV-713", "Výztužná stěrka pod finální vrstvu", "kg",
                           plocha * 7.0, MISTO_D_FACADE, skladba_ref, poznamka="~7 kg/m²"))
    items.append(make_item("PSV-713", "Soklový profil hliníkový", "m",
                           ROOF_OBVOD_M, MISTO_D_FACADE, skladba_ref))
    items.append(make_item("PSV-713", "Rohové lišty fasády hliníkové", "m",
                           ROOF_OBVOD_M / 4 * 12,  # ~12 m výška / 4 strany
                           MISTO_D_FACADE, skladba_ref,
                           poznamka="obvod / 4 × výška ~12 m"))
    items.append(make_item("PSV-713", "Lišty okolo otvorů (rohové + okenní)", "m",
                           sum([(2*1.5+2*1.5)] * 35),  # ~35 fasádních otvorů × 6 m obvod
                           MISTO_D_FACADE, skladba_ref,
                           poznamka="Σ obvody fasádních otvorů (rough estimate)"))

    # Sokl ETICS — XPS 100 mm
    items.append(make_item("PSV-713", "Penetrace soklu ETICS", "m2",
                           SOKL_AREA_M2, MISTO_D_FACADE,
                           {"system": "ETICS sokl", "vrstva": "XPS 100"}))
    items.append(make_item("PSV-713", "XPS 100 mm sokl ETICS", "m2",
                           SOKL_AREA_M2, MISTO_D_FACADE,
                           {"system": "ETICS sokl"}, vyrobce_ref="XPS Synthos"))
    items.append(make_item("PSV-713", "Lepicí stěrka soklová", "kg",
                           SOKL_AREA_M2 * 5.0, MISTO_D_FACADE, skladba_ref))
    items.append(make_item("PSV-713", "Hmoždinky soklové", "ks",
                           SOKL_AREA_M2 * 6.0, MISTO_D_FACADE, skladba_ref))
    items.append(make_item("PSV-713", "Mozaiková omítka soklová", "m2",
                           SOKL_AREA_M2, MISTO_D_FACADE, skladba_ref))
    return items


# ---------------------------------------------------------------------------
# Kapitola 7: PSV-762 tesařské — latě/kontralatě/difuzní fólie pro Tondach
# ---------------------------------------------------------------------------

def gen_PSV_762_tesarske() -> list[dict]:
    items = []
    plocha = ROOF_KRYTINA_M2
    skladba_ref = {"vrstva": "podstřešní konstrukce pod Tondach"}
    items.append(make_item("PSV-762", "Difuzní fólie podkrokevní", "m2",
                           plocha * 1.1, MISTO_D_ROOF, skladba_ref,
                           vyrobce_ref="např. Jutadach 150",
                           poznamka="overlap 10 %"))
    # Latě 30×50 mm rozteč ~330 mm pro bobrovku → 1/0.33 = 3.03 m latí na m² střechy
    items.append(make_item("PSV-762", "Latě 30×50 mm rozteč 330 mm pod bobrovku", "m",
                           plocha * 3.03, MISTO_D_ROOF, skladba_ref,
                           poznamka="3.03 m latí na m² střechy"))
    items.append(make_item("PSV-762", "Kontralatě 30×50 mm rozteč 1000 mm", "m",
                           plocha * 1.0, MISTO_D_ROOF, skladba_ref,
                           poznamka="1 m kontralatě na m² střechy"))
    items.append(make_item("PSV-762", "Spojovací materiál (vruty + svorky)", "kg",
                           plocha * 0.5, MISTO_D_ROOF, skladba_ref,
                           poznamka="~0.5 kg/m²"))
    return items


# ---------------------------------------------------------------------------
# Kapitola 8: PSV-764 klempířské — z Tabulky × D-share 0.25
# ---------------------------------------------------------------------------

def gen_PSV_764_klempir(klempir_items: dict) -> list[dict]:
    items = []
    poznamka_base = (
        "Quantity from Tabulka klempířských (komplex A+B+C+D) × 0.25 "
        "D-share (4 equal objekty)"
    )
    for code in sorted(klempir_items):
        item = klempir_items[code]
        qty = item.get("mnozstvi")
        mj = item.get("mj") or "ks"
        nazev = item.get("nazev") or code
        if qty is None:
            continue
        d_qty = qty * D_SHARE
        skladba_ref = {"TP": code, "tabulka_qty_komplex": qty, "tabulka_mj": mj}
        items.append(make_item(
            "PSV-764", f"{code}: {nazev[:60]}", mj, d_qty, MISTO_D_FACADE,
            skladba_ref, vyrobce_ref=item.get("povrch", ""),
            poznamka=poznamka_base + f"; tabulka_qty={qty} {mj}",
        ))
        # Plus a separate "montáž" entry for major TP items (oplechování, žlaby) where natural
        if mj == "bm" and qty > 5 and "žlab" in nazev.lower():
            items.append(make_item(
                "PSV-764", f"Montáž {code} ({nazev[:50]})", mj, d_qty,
                MISTO_D_FACADE, skladba_ref,
            ))
    return items


# ---------------------------------------------------------------------------
# Kapitola 9: PSV-765 pokrývačské — Tondach bobrovka
# ---------------------------------------------------------------------------

def gen_PSV_765_pokryvac() -> list[dict]:
    items = []
    plocha = ROOF_KRYTINA_M2
    skladba_ref = {"vrstva": "Tondach bobrovka 19×40 šupinová"}
    items.append(make_item("PSV-765", "Tondach bobrovka 19×40 cm — kladení šupinové", "m2",
                           plocha, MISTO_D_ROOF, skladba_ref,
                           vyrobce_ref="Tondach Bobrovka 19×40",
                           poznamka="~36 ks/m² → ~10 944 ks pro D"))
    items.append(make_item("PSV-765", "Tondach bobrovka — počet kusů", "ks",
                           plocha * 36, MISTO_D_ROOF, skladba_ref))
    items.append(make_item("PSV-765", "Hřebenáče Tondach", "m",
                           ROOF_HREBEN_LENGTH_M, MISTO_D_ROOF, skladba_ref,
                           poznamka="hřeben délka cca 28 m (footprint long axis)"))
    items.append(make_item("PSV-765", "Větrací prvky hřebene", "ks",
                           int(ROOF_HREBEN_LENGTH_M / 5), MISTO_D_ROOF, skladba_ref,
                           poznamka="1 ks / 5 m hřebene"))
    items.append(make_item("PSV-765", "Prostupová taška Tondach OP50", "ks",
                           5, MISTO_D_ROOF, skladba_ref,
                           poznamka="z Phase 1.5 PROBE: ~5 ks pro D",
                           warnings=["OP50 quantity from manual proof-of-concept"]))
    items.append(make_item("PSV-765", "Sněhové zachytávače", "m",
                           ROOF_OBVOD_M / 2,  # eaves length, both sides
                           MISTO_D_ROOF, skladba_ref))
    return items


# ---------------------------------------------------------------------------
# Build & save (kapitoly 1-9 only at this point)
# ---------------------------------------------------------------------------

def build_kap_1_9() -> tuple[list[dict], dict]:
    if not DS.exists() or not TAB.exists():
        raise SystemExit("Run prior phases first")
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    tabulky = json.loads(TAB.read_text(encoding="utf-8"))

    klempir_items = tabulky["klempirske"]["items"]
    skladby_master = dataset.get("skladby", {})

    all_items: list[dict] = []
    all_items.extend(gen_HSV_622_1_pasky())
    all_items.extend(gen_HSV_622_2_omitka_F13())
    all_items.extend(gen_HSV_622_3_sterka_F16())
    all_items.extend(gen_PSV_712_strechy(skladby_master))
    all_items.extend(gen_PSV_713_etics())
    all_items.extend(gen_PSV_762_tesarske())
    all_items.extend(gen_PSV_764_klempir(klempir_items))
    all_items.extend(gen_PSV_765_pokryvac())
    return all_items, dataset


def main() -> None:
    items, dataset = build_kap_1_9()

    by_kap: dict[str, dict] = defaultdict(lambda: {"count": 0, "by_mj": defaultdict(float)})
    for it in items:
        by_kap[it["kapitola"]]["count"] += 1
        by_kap[it["kapitola"]]["by_mj"][it["MJ"]] += it["mnozstvi"]
    by_kap_clean = {
        k: {"count": v["count"], "totals_per_mj": {mj: round(t, 2) for mj, t in v["by_mj"].items()}}
        for k, v in by_kap.items()
    }

    out = {
        "metadata": {
            "phase": "3b",
            "kapitoly_present": ["HSV-622.1", "HSV-622.2", "HSV-622.3",
                                  "PSV-712", "PSV-713", "PSV-762", "PSV-764", "PSV-765"],
            "kapitoly_pending": ["PSV-783 vnější + suterén"],
            "items_count": len(items),
            "summary_per_kapitola": by_kap_clean,
            "carry_forward_findings": dataset.get("carry_forward_findings", []),
            "ground_truth_used": {
                "facade_brutto_m2": FACADE_BRUTTO_M2,
                "facade_openings_m2": FACADE_OPENINGS_M2,
                "facade_netto_m2": FACADE_NETTO_M2,
                "roof_skat_31_m2": ROOF_SKAT_31_M2,
                "roof_skat_67_m2": ROOF_SKAT_67_M2,
                "roof_flat_central_m2": ROOF_FLAT_CENTRAL_M2,
                "F08_pasky_m2_estimate": F08_PASKY_M2,
                "F13_m2_phase1": F13_M2,
                "F16_podhledy_m2_estimate": F16_PODHLEDY_M2_ESTIMATE,
                "D_share_for_komplex_items": D_SHARE,
                "sokl_height_m": SOKL_HEIGHT_M,
                "obvod_m": ROOF_OBVOD_M,
            },
        },
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print(f"Total items: {len(items)}")
    for k, v in sorted(by_kap_clean.items()):
        print(f"  {k:12s} count={v['count']:>3}  totals={v['totals_per_mj']}")


if __name__ == "__main__":
    main()
