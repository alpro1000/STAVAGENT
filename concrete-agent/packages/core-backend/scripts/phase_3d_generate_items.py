"""Phase 3d — forgotten kapitoly (lešení + pomocné práce + zařízení staveniště).

Kapitoly:
  HSV-941 lešení fasádní      — facade brutto × pronájem
  HSV-941 lešení vnitřní      — schodiště + podkroví + 1.PP
  HSV-944 pomocné konstrukce  — žebříky, zábrany, sítě, krytí
  HSV-997 přesun hmot         — total weight estimate × per-tonne
  HSV-998 pomocné práce       — broušení, hladění, ochrana stávajících
  PSV-925 zařízení staveniště — sociální zázemí, sklad, oplocení (general_overhead)

Each item carries `category`: 'subcontractor_required' OR 'general_site_overhead'.
"""
from __future__ import annotations

import json
import uuid
from collections import defaultdict
from pathlib import Path

DS = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")
COMPLETE = Path("test-data/libuse/outputs/items_objekt_D_complete.json")
OUT = Path("test-data/libuse/outputs/items_phase_3d_leseni_pomocne.json")

# Ground-truth facts (carry-over from Phase 0.7 / Phase 3b)
FACADE_BRUTTO_M2 = 838.0
ROOF_SKAT_31_M2 = 195.0
ROOF_SKAT_67_M2 = 109.0
ROOF_FLAT_M2 = 139.0
PP_FLOOR_AREA_M2 = 268.0
TOTAL_INTERIOR_M2 = 1056.16  # Phase 0.7 sum across 1.PP+1.NP+2.NP+3.NP
FF_TOTAL_M2 = 730.4  # Phase 1 aggregate Σ FF skladby
ETICS_M2 = 786.59  # Phase 3b facade netto
SDK_TOTAL_M2 = 517.79 + 322.37 + 195.0 * 2  # podhledy + předstěny + podkroví double
HARMONOGRAM_MESICE = 4  # rental duration months


def make_item(kapitola, popis, mj, mnozstvi, misto,
              category="subcontractor_required",
              vyrobce_ref="", confidence=0.85, poznamka="", warnings=None):
    return {
        "item_id": str(uuid.uuid4()),
        "kapitola": kapitola,
        "popis": popis,
        "MJ": mj,
        "mnozstvi": round(mnozstvi, 3),
        "misto": misto,
        "skladba_ref": {},
        "vyrobce_ref": vyrobce_ref,
        "urs_code": None,
        "urs_description": None,
        "category": category,
        "confidence": confidence,
        "status": "to_audit",
        "poznamka": poznamka,
        "warnings": warnings or [],
    }


MISTO_FACADE = {"objekt": "D", "podlazi": "fasáda", "mistnosti": []}
MISTO_INTERIOR = {"objekt": "D", "podlazi": "ALL", "mistnosti": []}
MISTO_PP = {"objekt": "D", "podlazi": "1.PP", "mistnosti": []}
MISTO_PODKROVI = {"objekt": "D", "podlazi": "3.NP", "mistnosti": []}
MISTO_STRECHA = {"objekt": "D", "podlazi": "střecha", "mistnosti": []}
MISTO_SCHODISTE = {"objekt": "D", "podlazi": "ALL — schodiště", "mistnosti": []}
MISTO_SITE = {"objekt": "D", "podlazi": "staveniště", "mistnosti": []}


def gen_HSV_941_lеsenі_fasadni():
    items = []
    plocha = FACADE_BRUTTO_M2
    items.append(make_item(
        "HSV-941", "Postavění lešení fasádní rámové do v. 15 m", "m2",
        plocha, MISTO_FACADE,
        poznamka="facade brutto 838 m² (Phase 0.7 spec)",
    ))
    items.append(make_item(
        "HSV-941", f"Pronájem lešení fasádní × {HARMONOGRAM_MESICE} měsíce", "m2",
        plocha * HARMONOGRAM_MESICE, MISTO_FACADE,
        poznamka=f"plocha × {HARMONOGRAM_MESICE} měsíce harmonogramu",
    ))
    items.append(make_item(
        "HSV-941", "Montáž záchytných sítí na lešení", "m2",
        plocha, MISTO_FACADE,
    ))
    items.append(make_item(
        "HSV-941", "Demontáž lešení fasádního", "m2",
        plocha, MISTO_FACADE,
    ))
    return items


def gen_HSV_941_leseni_vnitrni():
    items = []
    # Schodiště — společná schodiště, 4 podlaží (1.PP + 1.NP + 2.NP + 3.NP)
    # Předpoklad 1 schodiště D × 4 ramena × 5 m výška každé = 20 m výšky × 1.5 m š
    schodiste_pojezd_ks = 4  # ks pojezdových lešení per schodiště
    schodiste_dni = HARMONOGRAM_MESICE * 30
    items.append(make_item(
        "HSV-941", "Postavění lešení pojezdové schodiště D", "ks",
        schodiste_pojezd_ks, MISTO_SCHODISTE,
        poznamka="1 schodiště D × 4 ramena (1.PP→3.NP)",
    ))
    items.append(make_item(
        "HSV-941", f"Pronájem lešení pojezdové schodiště × {schodiste_dni} dní", "ks",
        schodiste_pojezd_ks * schodiste_dni, MISTO_SCHODISTE,
    ))

    # Podkroví — skosné stropy 3.NP do hřebene ~6 m výška
    podkrovi_plocha = ROOF_SKAT_31_M2  # 195 m² podlaha podkroví
    items.append(make_item(
        "HSV-941", "Postavění lešení vnitřní podkroví (skosné stropy)", "m2",
        podkrovi_plocha, MISTO_PODKROVI,
        poznamka="3.NP plocha 195 m², do hřebene ~6 m výška",
    ))
    items.append(make_item(
        "HSV-941", f"Pronájem lešení podkroví × {HARMONOGRAM_MESICE} měsíce", "m2",
        podkrovi_plocha * HARMONOGRAM_MESICE, MISTO_PODKROVI,
    ))

    # 1.PP — vyšší stěny garáže (~3 m), parkování + technické
    pp_plocha = PP_FLOOR_AREA_M2
    items.append(make_item(
        "HSV-941", "Postavění lešení vnitřní 1.PP (parkování, tech. místnosti)", "m2",
        pp_plocha, MISTO_PP,
        poznamka="1.PP plocha 268 m²",
    ))
    items.append(make_item(
        "HSV-941", f"Pronájem lešení 1.PP × {HARMONOGRAM_MESICE} měsíce", "m2",
        pp_plocha * HARMONOGRAM_MESICE, MISTO_PP,
    ))
    return items


def gen_HSV_944_pomocne_konstrukce():
    items = []
    # Pomocné žebříky — pro výškové práce v interiéru + na střechě
    items.append(make_item(
        "HSV-944", "Pomocné žebříky pro výškové práce — pronájem", "ks-měs",
        8 * HARMONOGRAM_MESICE, MISTO_INTERIOR,
        poznamka="8 žebříků × harmonogram",
    ))
    # Ochranné zábrany na okrajích (atika, balkóny během prací)
    items.append(make_item(
        "HSV-944", "Ochranné zábrany na okrajích atik + balkónů", "m",
        80.98 + 35.0, MISTO_FACADE,
        poznamka="obvod střechy + balkónové obvody",
    ))
    # Bezpečnostní sítě — záchytné na střeše
    items.append(make_item(
        "HSV-944", "Bezpečnostní záchytné sítě střecha", "m2",
        ROOF_SKAT_31_M2 + ROOF_SKAT_67_M2 + ROOF_FLAT_M2, MISTO_STRECHA,
        poznamka="celá střecha 443 m²",
    ))
    # Provizorní zakrytí stávajících konstrukcí (ŽB stěny už hotové)
    items.append(make_item(
        "HSV-944", "Provizorní zakrytí stávajících konstrukcí PE folií", "m2",
        TOTAL_INTERIOR_M2 * 0.5, MISTO_INTERIOR,
        poznamka="50 % vnitřních ploch během prací (typicky podlahy + okna)",
    ))
    return items


def gen_HSV_997_presun_hmot():
    items = []
    # Cement screed: 730 m² × 0.05 m × 2200 kg/m³ = 80 300 kg = 80 t
    cement_t = FF_TOTAL_M2 * 0.05 * 2.2
    # Sádrokarton: ~12 kg/m² × ~1500 m² SDK = ~18 t
    sdk_t = SDK_TOTAL_M2 * 12 / 1000
    # ETICS EPS 200 mm: ETICS_M2 × 0.20 m × 25 kg/m³ = ~4 t
    eps_t = ETICS_M2 * 0.20 * 0.025
    # Klempíř + zámečnické: ~3 t (plech + ocelové prvky)
    klempir_t = 3.0
    # Tondach krytina: 304 m² × 36 ks × 1.6 kg/ks = ~17.5 t
    tondach_t = ROOF_SKAT_31_M2 + ROOF_SKAT_67_M2  # 304 m²
    tondach_t = tondach_t * 36 * 1.6 / 1000
    # Ostatní materiály (lepidla, malby, izolace): odhad 5 t
    ostatni_t = 5.0
    total_t = cement_t + sdk_t + eps_t + klempir_t + tondach_t + ostatni_t

    items.append(make_item(
        "HSV-997", "Přesun hmot ručně do 30 m", "t",
        total_t, MISTO_INTERIOR,
        poznamka=(
            f"Σ ≈ {total_t:.1f} t: cement {cement_t:.1f} + SDK {sdk_t:.1f} + "
            f"EPS {eps_t:.1f} + klempíř {klempir_t:.1f} + Tondach {tondach_t:.1f} + "
            f"ostatní {ostatni_t:.1f}"
        ),
    ))
    items.append(make_item(
        "HSV-997", "Přesun hmot autojeřábem (těžké materiály na střechu)", "t",
        tondach_t + eps_t + klempir_t * 0.5, MISTO_INTERIOR,
        poznamka="Tondach + EPS na ploché + klempíř plechy",
    ))
    # Doprava odpadu — odhad 30 % z přesun_hmot je odpad (obaly + výřezy)
    items.append(make_item(
        "HSV-997", "Doprava odpadu na skládku (kontejnery + km)", "m3",
        total_t * 0.3 * 2.0, MISTO_INTERIOR,
        poznamka="~30 % přesun hmot × 2 m³/t (sypký odpad)",
    ))
    return items


def gen_HSV_998_pomocne_prace():
    items = []
    items.append(make_item(
        "HSV-998", "Vybourání drážek pro dilatace v podkladu",
        "m", TOTAL_INTERIOR_M2 / 36 * 6, MISTO_INTERIOR,
        poznamka="grid 6×6 m × m délky drážek",
    ))
    items.append(make_item(
        "HSV-998", "Příprava povrchů pro malby (broušení + hladění)",
        "m2", 4541 + 2216, MISTO_INTERIOR,
        poznamka="Σ HSV-611 + HSV-612 omítka brutto plocha",
    ))
    items.append(make_item(
        "HSV-998", "Prach + ochranné krytí stávajících konstrukcí",
        "m2", TOTAL_INTERIOR_M2 * 0.3, MISTO_INTERIOR,
        poznamka="30 % vnitřních ploch (přírubové práce)",
    ))
    return items


def gen_PSV_925_zarizeni_staveniste():
    items = []
    cat = "general_site_overhead"
    items.append(make_item(
        "PSV-925", f"Sociální zázemí (kontejner WC + šatna) × {HARMONOGRAM_MESICE} měs",
        "kpl-měs", HARMONOGRAM_MESICE, MISTO_SITE,
        category=cat, confidence=0.6,
        warnings=["general_site_overhead — k dořešení s hlavním dodavatelem"],
    ))
    items.append(make_item(
        "PSV-925", f"Sklad materiálu uzamykatelný × {HARMONOGRAM_MESICE} měs",
        "ks-měs", 2 * HARMONOGRAM_MESICE, MISTO_SITE,
        category=cat, confidence=0.6,
        warnings=["general_site_overhead — k dořešení s hlavním dodavatelem"],
    ))
    items.append(make_item(
        "PSV-925", "Energetické připojení staveniště (elektro + voda)",
        "kpl", 1, MISTO_SITE,
        category=cat, confidence=0.6,
        warnings=["general_site_overhead — k dořešení s hlavním dodavatelem"],
    ))
    items.append(make_item(
        "PSV-925", f"Mobilní oplocení × {HARMONOGRAM_MESICE} měs",
        "m-měs", 200 * HARMONOGRAM_MESICE, MISTO_SITE,
        category=cat, confidence=0.6,
        warnings=["general_site_overhead — k dořešení s hlavním dodavatelem"],
    ))
    items.append(make_item(
        "PSV-925", "Tabule informační + bezpečnostní",
        "ks", 4, MISTO_SITE,
        category=cat, confidence=0.6,
        warnings=["general_site_overhead — k dořešení s hlavním dodavatelem"],
    ))
    return items


def main() -> None:
    items = []
    items.extend(gen_HSV_941_lеsenі_fasadni())
    items.extend(gen_HSV_941_leseni_vnitrni())
    items.extend(gen_HSV_944_pomocne_konstrukce())
    items.extend(gen_HSV_997_presun_hmot())
    items.extend(gen_HSV_998_pomocne_prace())
    items.extend(gen_PSV_925_zarizeni_staveniste())

    by_kap = defaultdict(lambda: {"count": 0, "by_mj": defaultdict(float),
                                    "by_cat": defaultdict(int)})
    for it in items:
        by_kap[it["kapitola"]]["count"] += 1
        by_kap[it["kapitola"]]["by_mj"][it["MJ"]] += it["mnozstvi"]
        by_kap[it["kapitola"]]["by_cat"][it["category"]] += 1

    by_kap_clean = {
        k: {
            "count": v["count"],
            "totals": {mj: round(t, 2) for mj, t in v["by_mj"].items()},
            "category_split": dict(v["by_cat"]),
        }
        for k, v in by_kap.items()
    }

    out = {
        "metadata": {
            "phase": "3d",
            "kapitoly": ["HSV-941 fasádní", "HSV-941 vnitřní", "HSV-944",
                          "HSV-997", "HSV-998", "PSV-925"],
            "items_count": len(items),
            "summary_per_kapitola": by_kap_clean,
            "harmonogram_mesice": HARMONOGRAM_MESICE,
            "ground_truth_used": {
                "facade_brutto_m2": FACADE_BRUTTO_M2,
                "roof_total_m2": ROOF_SKAT_31_M2 + ROOF_SKAT_67_M2 + ROOF_FLAT_M2,
                "interior_total_m2": TOTAL_INTERIOR_M2,
                "FF_total_m2": FF_TOTAL_M2,
                "ETICS_m2": ETICS_M2,
                "SDK_total_m2": SDK_TOTAL_M2,
            },
        },
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Total items: {len(items)}")
    for k, v in sorted(by_kap_clean.items()):
        print(f"  {k:10s} count={v['count']:>3}  totals={v['totals']}  cat={v['category_split']}")


if __name__ == "__main__":
    main()
