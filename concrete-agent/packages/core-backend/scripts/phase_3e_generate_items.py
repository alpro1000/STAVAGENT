"""Phase 3e — osazení + speciální + úklid + VRN + border-zone.

7 categories (A-G):
  A. Osazení oken (HSV-642 + PSV-766 vnitřní parapety + PSV-764 ext)
  B. Osazení dveří (HSV-642/643 + PSV-767 příslušenství)
  C. PSV-768 speciální dveře (garážová vrata, EI, revize)
  D. PSV-952 stavební úklid
  E. Border-zone items (vyboření drážek, prostupy, revize) — to_be_clarified
  F. Libuše specifika (záchyt. systém, schránky, rohože, tabulky)
  G. VRN structure (CL010-027 vedlejší rozpočtové náklady)
"""
from __future__ import annotations

import json
import uuid
from collections import defaultdict
from pathlib import Path

DS = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")
OUT = Path("test-data/libuse/outputs/items_phase_3e_osazeni_specialni_uklid_vrn.json")

# Geometric facts
TOTAL_INTERIOR_M2 = 1056.16
PP_FLOOR_AREA_M2 = 268.0
FACADE_M2 = 838.0
N_WINDOWS_FACADE_D = 35
N_ROOFLIGHTS_D = 11
N_DOORS_TOTAL_D = 117  # Phase 1 aggregate sum
HARMONOGRAM_MESICE = 4
N_BYTU_D = 11  # objekt D má 11 bytů (per spec)


def make_item(kapitola, popis, mj, mnozstvi, misto,
              category="subcontractor_required",
              status="to_audit",
              skladba_ref=None, vyrobce_ref="", confidence=0.85,
              poznamka="", warnings=None):
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
        "category": category,
        "status": status,
        "confidence": confidence,
        "poznamka": poznamka,
        "warnings": warnings or [],
    }


M_FACADE = {"objekt": "D", "podlazi": "fasáda", "mistnosti": []}
M_ALL = {"objekt": "D", "podlazi": "ALL", "mistnosti": []}
M_PP = {"objekt": "D", "podlazi": "1.PP", "mistnosti": []}
M_STRECHA = {"objekt": "D", "podlazi": "střecha", "mistnosti": []}
M_VRN = {"objekt": "D", "podlazi": "VRN", "mistnosti": []}


# ------------------------------------------------------------ A: Osazení oken
def gen_A_osazeni_oken(dataset):
    items = []
    win_codes = dataset["aggregates"]["windows_by_type_code"]
    total_w = sum(win_codes.values()) or N_WINDOWS_FACADE_D

    # Average window per type — typical 1.2 × 1.5 m
    avg_w_m = 1.2
    avg_h_m = 1.5
    avg_perim_m = 2 * (avg_w_m + avg_h_m)  # 5.4 m per window

    for code, n in sorted(win_codes.items(), key=lambda x: -x[1]):
        skl = {"W_type": code}
        # HSV-642 osazení rámu
        items.append(make_item("HSV-642", f"Osazení okenního rámu {code}", "ks", n, M_FACADE, skladba_ref=skl))
        items.append(make_item("HSV-642", f"Kotvení {code} (turbo expanzní 6 ks/okno)", "ks", n * 6, M_FACADE, skladba_ref=skl))
        items.append(make_item("HSV-642", f"PUR pěna připojovací spáry {code}", "m", n * avg_perim_m, M_FACADE, skladba_ref=skl,
                               poznamka="2×(W+H)/1000"))
        items.append(make_item("HSV-642", f"Komprimační páska připojovací spáry {code}", "m", n * avg_perim_m, M_FACADE, skladba_ref=skl))
        items.append(make_item("HSV-642", f"Spárování okenního rámu silikon vnější + akrylát vnitřní {code}", "m", n * avg_perim_m * 2, M_FACADE, skladba_ref=skl,
                               poznamka="m × 2 strany"))
    # PSV-766 vnitřní parapety umělý kámen Technistone — per okno
    items.append(make_item("PSV-766", "Vnitřní parapet umělý kámen Technistone (30 mm)",
                           "m", total_w * avg_w_m, M_FACADE,
                           vyrobce_ref="Technistone Crystal Solid",
                           poznamka=f"{total_w} oken × {avg_w_m} m průměrná šířka"))
    items.append(make_item("PSV-766", "Lepení parapetu PUR pěnou + komprimační páska",
                           "m", total_w * avg_w_m, M_FACADE))
    items.append(make_item("PSV-766", "Spárování boků parapetu silikonem (oba boky)",
                           "m", total_w * 0.4, M_FACADE,
                           poznamka="2 × 200 mm hloubka boku per okno"))

    # PSV-764 vnější klempířské parapety — verify: Phase 3b PSV-764 pulled from Tabulka klempířských TP25 (Dešťový svod ø75) — note this is svod ne parapet. So vnější parapety NOT covered yet.
    items.append(make_item("PSV-764", "Vnější parapet pozinkovaný plech 0.7 mm s povlakem",
                           "m", total_w * (avg_w_m + 0.2), M_FACADE,
                           vyrobce_ref="poplastovaný ocelový plech RAL 7016",
                           poznamka="(W + 200 mm přesah) per okno; NEW — not in Phase 3b"))

    # Střešní okna
    items.append(make_item("HSV-642", "Lemování střešního okna (manžety)",
                           "ks", N_ROOFLIGHTS_D, M_STRECHA))
    items.append(make_item("HSV-642", "Difuzní límec střešního okna",
                           "ks", N_ROOFLIGHTS_D, M_STRECHA))
    items.append(make_item("HSV-642", "Parotěsná manžeta střešního okna vnitřní",
                           "ks", N_ROOFLIGHTS_D, M_STRECHA))
    items.append(make_item("PSV-764", "Krycí lemování plechové střešního okna",
                           "m", N_ROOFLIGHTS_D * 4.0, M_STRECHA,
                           poznamka="~4 m perimeter per střešní okno"))
    return items


# ------------------------------------------------------------ B: Osazení dveří
def gen_B_osazeni_dveri(dataset):
    items = []
    door_codes = dataset["aggregates"]["doors_by_type_code"]
    avg_perim_m = 2 * (0.9 + 2.1)  # 6 m per door

    for code, n in sorted(door_codes.items(), key=lambda x: -x[1]):
        is_steel = code in ("D04", "D34")  # heuristic: D04/D34 = ocelové zárubně (interior chodba)
        is_entry = code in ("D11",)  # entry doors — adjust per Tabulka if needed
        skl = {"D_type": code}
        # HSV-642 osazení zárubně
        zaruben_typ = "ocelová" if is_steel else "dřevěná"
        items.append(make_item("HSV-642", f"Osazení zárubně {zaruben_typ} {code}",
                               "ks", n, M_ALL, skladba_ref=skl))
        items.append(make_item("HSV-642", f"Plombrování + vyrovnání zárubně {code}",
                               "ks", n, M_ALL, skladba_ref=skl))
        items.append(make_item("HSV-642", f"Zazdění zárubně po obvodu {code}",
                               "m", n * avg_perim_m, M_ALL, skladba_ref=skl))
        items.append(make_item("HSV-642", f"Vyplnění spáry zárubeň ↔ stěna PUR pěnou {code}",
                               "m", n * avg_perim_m, M_ALL, skladba_ref=skl))

        if is_entry:
            items.append(make_item("HSV-643", f"Dodatečné kotvení vstupních dveří {code} (4 ks ankerov)",
                                   "ks", n * 4, M_ALL, skladba_ref=skl))
            items.append(make_item("HSV-643", f"Rektifikační šrouby vstupních dveří {code}",
                                   "ks", n * 8, M_ALL, skladba_ref=skl))

        # PSV-766 mezerové lišty + spárování obložek
        items.append(make_item("PSV-766", f"Mezerové lišty kolem obložek {code}",
                               "m", n * (2 * 2.1), M_ALL, skladba_ref=skl,
                               poznamka="2 strany × výška dveří"))
        items.append(make_item("PSV-766", f"Spárování obložek silikonem/akrylem {code}",
                               "m", n * (2 * 2.1), M_ALL, skladba_ref=skl))

        # PSV-767 příslušenství
        items.append(make_item("PSV-767", f"Klika + zámek {code}",
                               "ks", n, M_ALL, skladba_ref=skl,
                               poznamka="standardní rozetová klika; bezpečnostní pro D11 entry"))
        items.append(make_item("PSV-767", f"Dveřní zarážka {code}",
                               "ks", n, M_ALL, skladba_ref=skl))
        if is_entry:
            items.append(make_item("PSV-767", f"Cylinder bezpečnostní 5. třída {code}",
                                   "ks", n, M_ALL, skladba_ref=skl,
                                   vyrobce_ref="např. EVVA AirKey nebo MUL-T-LOCK"))
            items.append(make_item("PSV-767", f"5 klíčů sady {code}",
                                   "sady", n, M_ALL, skladba_ref=skl))
            items.append(make_item("PSV-767", f"Pant pojistka bezpečnostní {code}",
                                   "ks", n * 3, M_ALL, skladba_ref=skl,
                                   poznamka="3 panty per dveře"))
    return items


# ------------------------------------------------------------ C: Speciální dveře
def gen_C_specialni_dvere():
    items = []
    # Garážová sekční vrata 5700×2100 (1 ks pro D, dle TZ)
    items.append(make_item("PSV-768", "Garážová sekční vrata 5700×2100 — dodávka",
                           "ks", 1, M_PP,
                           vyrobce_ref="např. Hörmann SPU 67 thermo",
                           poznamka="z TZ: 1 ks pro D (vstup do garáže)"))
    items.append(make_item("PSV-768", "Garážová vrata — elektrický pohon + ovládání",
                           "ks", 1, M_PP,
                           vyrobce_ref="např. Hörmann SupraMatic E"))
    items.append(make_item("PSV-768", "Garážová vrata — osazení + kotvení",
                           "ks", 1, M_PP))

    # Protipožární vrata mezi B/C v 1.PP (2 ks pravděpodobně, dle layout)
    items.append(make_item("PSV-768", "Protipožární vrata EI60 — dodávka (společný 1.PP, mezi A-B-C-D)",
                           "ks", 2, M_PP,
                           vyrobce_ref="např. Hörmann T30 EI60",
                           poznamka="společný suterén — k upřesnění s sousedy"))
    items.append(make_item("PSV-768", "Protipožární vrata — osazení + zárubeň",
                           "ks", 2, M_PP))
    items.append(make_item("PSV-768", "Protipožární vrata — samouzavírací mechanismus + doraz",
                           "ks", 2, M_PP))
    items.append(make_item("PSV-768", "Tabulka označení 'POŽÁRNÍ DVEŘE'",
                           "ks", 2, M_PP))

    # Revizní dvířka EI z Tabulky ostatních (OP18 VZT 600×600 atd.)
    items.append(make_item("PSV-768", "Revizní dvířka EI30 — dodávka (z OP## D-share)",
                           "ks", 4, M_ALL,
                           poznamka="VZT prostupy + vodoinstalace; již v OP-detail items, zde dodávka EI cert. variant"))
    items.append(make_item("PSV-768", "Revizní dvířka EI30 — osazení + rám",
                           "ks", 4, M_ALL))
    items.append(make_item("PSV-768", "Revizní dvířka EI30 — tmelení + finishing rámu",
                           "ks", 4, M_ALL))
    return items


# ------------------------------------------------------------ D: Stavební úklid
def gen_D_uklid():
    items = []
    plocha = TOTAL_INTERIOR_M2

    # Hrubý úklid po stavbě
    items.append(make_item("PSV-952", "Hrubý úklid po stavbě před povrchovými úpravami",
                           "m2", plocha, M_ALL,
                           poznamka="celá plocha 1× detailní hrubý úklid"))

    # Průběžný úklid během prací
    items.append(make_item("PSV-952", f"Průběžný úklid během prací × {HARMONOGRAM_MESICE} měsíce",
                           "m2", plocha * HARMONOGRAM_MESICE * 0.5, M_ALL,
                           poznamka="0.5 frekvence/měsíc průměr"))

    # Závěrečný úklid před předáním
    items.append(make_item("PSV-952", "Závěrečný úklid před předáním — celková plocha",
                           "m2", plocha, M_ALL,
                           poznamka="detailní úklid před předáním"))
    items.append(make_item("PSV-952", "Mytí oken (vnitřní + vnější × oba povrchy)",
                           "m2", N_WINDOWS_FACADE_D * 1.8 * 2, M_ALL,
                           poznamka="35 oken × 1.8 m² × 2 strany"))
    items.append(make_item("PSV-952", "Vyleštění dlažby + obkladů",
                           "m2", 608 + 1303, M_ALL,
                           poznamka="dlažba PSV-771 (608 m²) + obklad PSV-781 (1303 m²)"))
    items.append(make_item("PSV-952", "Mytí WC + sanity",
                           "ks", N_BYTU_D + 5, M_ALL,
                           poznamka="11 bytů × 1 koupelna + společné WC"))
    items.append(make_item("PSV-952", "Odpad odvoz po úklidu (kontejnery)",
                           "m3", 8, M_ALL))
    items.append(make_item("PSV-952", "Odstranění samolepicích pásek + ochranných fólií (parapety, obklady, dveře)",
                           "h", 40, M_ALL))
    items.append(make_item("PSV-952", "Čištění fasády po stavbě (ze země)",
                           "m2", 250, M_FACADE,
                           poznamka="parter ~3 m výšky, dosažitelné ze země"))
    items.append(make_item("PSV-952", "Strojní úklid garáže před předáním",
                           "m2", PP_FLOOR_AREA_M2 * 0.6, M_PP,
                           poznamka="60 % 1.PP = parking area"))
    return items


# ------------------------------------------------------------ E: Border-zone
def gen_E_border_zone():
    """to_be_clarified status — interface s ZTI/elektro/VZT collegues."""
    items = []
    border_status = "to_be_clarified_with_collegues"
    border_warn = ["Border-zone — vyjasnit s collegues (elektro/VZT/ZTI)"]

    items.append(make_item("HSV-998", "Vyboření drážek pro elektroinstalace v stěnách",
                           "m", 150, M_ALL,
                           status=border_status,
                           confidence=0.6,
                           poznamka="50 % bytových místností × 5 m drážek; clarify with elektrikář",
                           warnings=border_warn))
    items.append(make_item("HSV-622", "Zazdění drážek po elektroinstalaci + finishing",
                           "m", 150, M_ALL,
                           status="subcontractor_required",
                           poznamka="po dokončení elektrikáře, před omítkou/malbou",
                           warnings=["Předpokládá hotové elektro před omítkou"]))
    items.append(make_item("HSV-962", "Vrtání prostupů pro potrubí ZTI/VZT (cca 30 prostupů)",
                           "ks", 30, M_ALL,
                           status=border_status,
                           confidence=0.5,
                           poznamka="počet prostupů z Tabulky prostupů (TBD); clarify",
                           warnings=border_warn))
    items.append(make_item("HSV-622", "Zazdění prostupů po instalacích ZTI/VZT",
                           "ks", 30, M_ALL,
                           status="subcontractor_required",
                           poznamka="po hotových instalacích, před finishing"))
    items.append(make_item("PSV-768", "Osazení revizních dvířek OP18/OP24/OP26/OP27 — vyřezání + osazení rámu",
                           "ks", 50, M_ALL,
                           status="subcontractor_required",
                           poznamka="OP## items z Tabulky ostatních prvků; interface mezi VZT a finishing"))
    items.append(make_item("PSV-784", "Lokální oprava povrchů po instalacích — touch-up omítka + malba",
                           "m2", 1841 * 0.05, M_ALL,
                           status="subcontractor_required",
                           poznamka="5 % wall plaster F05 area; po instalacích"))
    items.append(make_item("HSV-998", "Příprava stěn po elektrikářích (vyrovnání + plombrování po krabicích)",
                           "ks", 200, M_ALL,
                           status="subcontractor_required",
                           poznamka="200 elektro-krabic odhadem"))
    return items


# ------------------------------------------------------------ F: Libuše specifika
def gen_F_libuse_specifika():
    items = []

    # Záchytný systém na střeše
    items.append(make_item("PSV-767", "Záchytný systém střecha — jistící body ABS Sicherheit",
                           "ks", 6, M_STRECHA,
                           vyrobce_ref="ABS Sicherheit ABS-Lock SYS",
                           poznamka="6 bodů pro střechu D objektu (pro budoucí údržbu)"))
    items.append(make_item("PSV-767", "Záchytný systém — osazení do nosné konstrukce",
                           "ks", 6, M_STRECHA))
    items.append(make_item("PSV-767", "Záchytný systém — certifikát + revizní zpráva",
                           "kpl", 1, M_STRECHA,
                           poznamka="ČSN EN 795 typ A"))

    # Schránky poštovní
    n_schranek = N_BYTU_D + 1  # bytové + společná
    items.append(make_item("PSV-767", "Poštovní schránky (sada pro 11 bytů)",
                           "ks", n_schranek, M_ALL,
                           vyrobce_ref="např. nerez Brabantia nebo dle architekta",
                           poznamka=f"{N_BYTU_D} bytů + 1 společná"))
    items.append(make_item("PSV-767", "Osazení poštovních schránek do stěny + číslování",
                           "ks", n_schranek, M_ALL))

    # Tabulky orientační
    items.append(make_item("PSV-767", "Tabulky orientační podlažní (číslo + map)",
                           "ks", 4, M_ALL,
                           poznamka="4 podlaží: 1.PP, 1.NP, 2.NP, 3.NP"))
    items.append(make_item("PSV-767", "Číslování dveří bytů",
                           "ks", N_BYTU_D, M_ALL))
    items.append(make_item("PSV-767", "Označení nouzových východů + směrovky",
                           "ks", 8, M_ALL))
    items.append(make_item("PSV-767", "Označení technických místností",
                           "ks", 15, M_ALL,
                           poznamka="rozvodny, výtah strojovna, sklepní sekce, atd."))

    # Čisticí rohože
    items.append(make_item("PSV-771", "Čisticí rohož venkovní před vchodem",
                           "m2", 4, M_ALL,
                           vyrobce_ref="např. Geggus Aluclean",
                           poznamka="2 m² × 2 vchody"))
    items.append(make_item("PSV-771", "Čisticí rohož v zádveří D.1.S.02",
                           "m2", 6, M_ALL,
                           poznamka="zádveří plocha"))
    items.append(make_item("PSV-771", "Rám pro rohož + úprava podlahy (zapuštěné)",
                           "m", 16, M_ALL,
                           poznamka="obvod rohoží 2× zádveří + 2× venkovní"))

    # Schodiště — protiskluz
    items.append(make_item("PSV-784", "Označení schodišťových stupňů kontrastním pruhem (1. + poslední stupeň)",
                           "m", 60, M_ALL,
                           poznamka="ČSN EN 81 / 1.+ poslední stupeň každého ramene × ~5 m × 6 ramen"))
    items.append(make_item("PSV-771", "Protiskluzová úprava 1. + posledního stupně (R10 lišta)",
                           "m", 60, M_ALL))
    return items


# ------------------------------------------------------------ G: VRN structure
def gen_G_VRN():
    items = []
    cat = "general_site_overhead"
    status = "to_be_negotiated_with_investor"
    warn_neg = ["VRN — k negociaci s investorem; reference na Phase 3d kde overlap s PSV-925"]

    # 010 — Příprava staveniště
    items.append(make_item("VRN-010", "Zpevnění příjezdových ploch dočasné (informativní)",
                           "m2", 100, M_VRN, category=cat, status=status, confidence=0.7))

    # 011 — Zařízení staveniště — REFERENCE only (overlap s Phase 3d)
    items.append(make_item("VRN-011", "Zařízení staveniště — REFERENCE na Phase 3d PSV-925",
                           "kpl", 1, M_VRN, category=cat, status=status, confidence=0.6,
                           poznamka="overlap s Phase 3d PSV-925 5 items; tady jen reference, NE duplicate items",
                           warnings=warn_neg))

    # 014 — BOZP
    items.append(make_item("VRN-014", f"Koordinátor BOZP × {HARMONOGRAM_MESICE} měsíce",
                           "měs", HARMONOGRAM_MESICE, M_VRN, category=cat, status=status, confidence=0.85))
    items.append(make_item("VRN-014", "BOZP vybavení staveniště (cedule, výstražné pásky, hasicí přístroje)",
                           "kpl", 1, M_VRN, category=cat, status=status, confidence=0.85))

    # 016 — Geodet
    items.append(make_item("VRN-016", "Vytyčení dokončovacích prací (omezené)",
                           "h", 16, M_VRN, category=cat, status=status, confidence=0.7,
                           poznamka="hrubá stavba je hotová, vytyčení omezené"))
    items.append(make_item("VRN-016", "Kontrolní geodetická měření při předání",
                           "h", 8, M_VRN, category=cat, status=status, confidence=0.8))

    # 017 — Inženýrské činnosti
    items.append(make_item("VRN-017", f"Autorský dozor projektanta × {HARMONOGRAM_MESICE} měs",
                           "h", 4 * HARMONOGRAM_MESICE * 4, M_VRN, category=cat, status=status, confidence=0.8,
                           poznamka="4 h/týden × 4 týdny × harmonogram"))
    items.append(make_item("VRN-017", f"Technický dozor investora × {HARMONOGRAM_MESICE} měs",
                           "h", 8 * HARMONOGRAM_MESICE * 4, M_VRN, category=cat, status=status, confidence=0.6,
                           poznamka="8 h/týden — pokud zákazník platí; jinak NE",
                           warnings=warn_neg))
    items.append(make_item("VRN-017", "Koordinace s BOZP",
                           "h", 16, M_VRN, category=cat, status=status, confidence=0.7))

    # 026 — Pojištění
    items.append(make_item("VRN-026", "Pojištění odpovědnosti zhotovitele (% z ceny)",
                           "%", 0.5, M_VRN, category=cat, status=status, confidence=0.8,
                           poznamka="0.5 % z celkové ceny díla"))

    # 027 — Záruční rezerva
    items.append(make_item("VRN-027", "Záruční rezerva na opravy (% z ceny)",
                           "%", 1.5, M_VRN, category=cat, status=status, confidence=0.7,
                           poznamka="1.5 % z ceny — záruka 24 měsíců typicky"))
    return items


# ------------------------------------------------------------ Main
def main() -> None:
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    cat_a = gen_A_osazeni_oken(dataset)
    cat_b = gen_B_osazeni_dveri(dataset)
    cat_c = gen_C_specialni_dvere()
    cat_d = gen_D_uklid()
    cat_e = gen_E_border_zone()
    cat_f = gen_F_libuse_specifika()
    cat_g = gen_G_VRN()

    by_cat = {
        "A — osazení oken": cat_a,
        "B — osazení dveří": cat_b,
        "C — speciální dveře": cat_c,
        "D — stavební úklid": cat_d,
        "E — border-zone": cat_e,
        "F — Libuše specifika": cat_f,
        "G — VRN structure": cat_g,
    }
    items = []
    for ic in by_cat.values():
        items.extend(ic)

    summary = {}
    by_kap = defaultdict(lambda: {"count": 0, "by_mj": defaultdict(float)})
    for it in items:
        by_kap[it["kapitola"]]["count"] += 1
        by_kap[it["kapitola"]]["by_mj"][it["MJ"]] += it["mnozstvi"]
    by_kap_clean = {k: {"count": v["count"], "totals": {mj: round(t, 2) for mj, t in v["by_mj"].items()}}
                     for k, v in by_kap.items()}
    for cat, ic in by_cat.items():
        summary[cat] = {"items": len(ic)}

    out = {
        "metadata": {
            "phase": "3e",
            "categories": ["A osazení oken", "B osazení dveří", "C speciální dveře",
                            "D stavební úklid", "E border-zone", "F Libuše specifika",
                            "G VRN structure"],
            "items_count": len(items),
            "items_per_category": summary,
            "items_per_kapitola": by_kap_clean,
        },
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Total items: {len(items)}")
    for cat, ic in by_cat.items():
        print(f"  {cat:30s} {len(ic):>4} items")


if __name__ == "__main__":
    main()
