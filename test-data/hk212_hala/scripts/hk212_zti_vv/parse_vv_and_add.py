"""HK212 — parse VV (projektant authoritative) into M-ZTI kapitola + add
zámková dlažba 1.5 m chodník (norm-verified) + supersede guessed M-VK items.

Source: inputs/tz/VV_Hradec Králové.pdf (projektantský výkaz výměr, confidence 0.95).
Norm verification: outputs/norm_verification_okapnik_dlazba.md (all skladby compliant).

M-ZTI (56 items, 4 sub-sections, SO-14):
  A. Domovní vodovod (DV1-DV7)         15 items
  B. Domovní kanalizace (K1-K2)        16 items
  C. Kanalizace čerpaná vnější (P1)    15 items
  D. Vodovod vnější (P1)               10 items

Dlažba 1.5 m chodník (M-VK-030..039, 10 items per ČSN 73 6131).

Supersede 5 guessed M-VK items (VV authoritative):
  M-VK-005 dešťová DN200 40m  → VV K1.6 DN125 55m + K1.7 DN160 30m + K1.8 DN200 9m
  M-VK-006 splašková DN150 30m → VV precise potrubí
  M-VK-007 revizní šachta 3ks → VV K1.9..K1.15 specific šachty (7 ks)
  M-VK-010 hydrant DN80        → VV DV7.4 hydrant D19/30 + požární vodovod DV7.1-7.5
  M-VK-011 retenční 30 m³      → VV K1.14 retenční 15 m³ + K1.13 zasakovací 2 m³

Projektant kódy (DV1.1, K1.9, P1.5) preserved as _projektant_code (NE KROS).
Percentage rows (kompletace/rezerva %) → _pct_addon on section, NOT separate item.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
ABMV_PATH = ROOT / "outputs" / "abmv_email_queue.json"

NOW_ISO = "2026-05-27T23:30:00+00:00"
VV_SOURCE = "inputs/tz/VV_Hradec Králové.pdf"
PATTERN_15_REF = "Work-first generation. KROS catalog mapping in separate Stage 3 task."

# --------------------------------------------------------------------------- #
# VV data: (projektant_code, popis, mj, mnozstvi, subsection_tag)
# Percentage / zero-qty ("–") rows excluded — captured as _pct_addon per section.
# --------------------------------------------------------------------------- #
VV_ROWS = [
    # ===== A. Domovní vodovod =====
    ("DV1.1", "EVO PP-RCT 16×2,2 + izolace mirelon 9 mm", "bm", 2.0, "A_vodovod_potrubi"),
    ("DV1.2", "EVO PP-RCT 16×2,2 + izolace mirelon 13 mm", "bm", 2.0, "A_vodovod_potrubi"),
    ("DV1.3", "EVO PP-RCT 20×2,3–50×4,6 + izolace mirelon 9–30 mm", "bm", 8.0, "A_vodovod_potrubi"),
    ("DV3.1", "Rohový ventil 1/2\" + flexi hadička, připojení zařizovacích předmětů — komplet", "kus", 2.0, "A_vodovod_armatury"),
    ("DV3.2", "Kulový kohout DN40 s vypouštěním", "kus", 1.0, "A_vodovod_armatury"),
    ("DV3.3", "Podružná vodoměrná sestava dle požadavku provozovatele areálové sítě", "kus", 1.0, "A_vodovod_armatury"),
    ("DV4.1", "Stojánková páková umyvadlová směšovací baterie s ramínkem", "ks", 1.0, "A_vodovod_vytokove"),
    ("DV5.1", "Automatická stanice přípravy TUV vč. jistící armatury — el. tlakově nezávislý zásobník (dodávka VYT, komplet)", "ks", 1.0, "A_vodovod_TUV"),
    ("DV5.2", "Uzavírací ventil DN20", "ks", 2.0, "A_vodovod_TUV"),
    ("DV6.1", "Umyvadlo dle výběru investora vč. kotvících prvků (komplet)", "ks", 1.0, "A_vodovod_zarizovaci"),
    ("DV7.1", "Ocelové pozinkové potrubí DN20 (požární vodovod)", "bm", 1.0, "A_vodovod_pozarni"),
    ("DV7.2", "Ocelové pozinkové potrubí DN25 (požární vodovod)", "bm", 5.0, "A_vodovod_pozarni"),
    ("DV7.3", "Ocelové pozinkové potrubí DN32 (požární vodovod)", "bm", 40.0, "A_vodovod_pozarni"),
    ("DV7.4", "Hydrant typu D19/30 dle PBŘ — do výklenku vč. uzavíracího kohoutu + tvarově stálá hadice", "ks", 1.0, "A_vodovod_pozarni"),
    ("DV7.5", "Zpětná klapka DN32 EA — oddělovač požárního a spotřebního vodovodu", "ks", 1.0, "A_vodovod_pozarni"),
    # ===== B. Domovní kanalizace =====
    ("K1.2", "Potrubí PP-HT DN50", "bm", 2.0, "B_kanalizace_potrubi"),
    ("K1.3", "Potrubí PP-HT DN110", "bm", 5.0, "B_kanalizace_potrubi"),
    ("K1.5", "Kanalizační potrubí PP-KG DN110 vč. tvarovek", "bm", 1.0, "B_kanalizace_potrubi"),
    ("K1.6", "Kanalizační potrubí PP-KG DN125 vč. tvarovek", "bm", 55.0, "B_kanalizace_potrubi"),
    ("K1.7", "Kanalizační potrubí PP-KG DN160 vč. tvarovek", "bm", 30.0, "B_kanalizace_potrubi"),
    ("K1.8", "Kanalizační potrubí PP-KG DN200 vč. tvarovek", "bm", 9.0, "B_kanalizace_potrubi"),
    ("K1.9", "Revizní šachta Dš — bet. skruže DN1000, pojezdný poklop, šachetní dno, regulační prvek max 0,55 l/s + havarijní přepad DN200, hl do 2,5 m (kpl)", "kpl", 1.0, "B_kanalizace_sachty"),
    ("K1.10", "Revizní betonová šachta dešťová Dš1 — DN1000, rovné dno, hl do 2,0 m, nátok DN160 (-90°/180°), výtok DN200, pojezdový poklop (kpl)", "kpl", 1.0, "B_kanalizace_sachty"),
    ("K1.11", "Revizní filtrační šachta Dš2 — bet. skruže DN1000, pojezdný poklop, dno, hl do 1,6 m, nátok DN160 -90°, výtok DN160 (kpl)", "kpl", 1.0, "B_kanalizace_sachty"),
    ("K1.12", "Revizní šachty Rš2 + Rš3 — bet. skruže DN1000, pojezdný poklop, dno, hl dle stáv. kanalizace (kpl)", "kpl", 2.0, "B_kanalizace_sachty"),
    ("K1.13", "Zasakovací těleso 1,5×3,0×0,39 m — min. využitelný objem 2 m³, zasakovací plocha min 4,5 m², kamenivo/voštinové těleso", "kpl", 1.0, "B_kanalizace_hospodareni"),
    ("K1.14", "Akumulačně retenční nádoba na dešťovou vodu 15 m³ — ⌀3,1 m × v=2,0 m, dodávka + montáž (kpl)", "kpl", 1.0, "B_kanalizace_hospodareni"),
    ("K1.15", "Revizní šachta Dš2 — bet. skruže DN1000, pojezdný poklop, dno, hl do 2,2 m (kpl)", "kpl", 1.0, "B_kanalizace_sachty"),
    ("K2.2", "Zápachová uzávěrka pro umyvadla — sifon trubkový chrom designový 5/4\" 32 mm (komplet)", "ks", 1.0, "B_kanalizace_prislusenstvi"),
    ("K2.3", "Sifon pro odvod kondenzátu z kondenzačního kotle, VZT a boileru (ref. HL 136)", "ks", 1.0, "B_kanalizace_prislusenstvi"),
    ("K2.4", "Lapač splavenin a nečistot — litinový", "ks", 5.0, "B_kanalizace_prislusenstvi"),
    # ===== C. Kanalizace čerpaná vnější =====
    ("P1.2c", "Plastové potrubí PE100 SDR11 d50 (50×4,5 mm) vč. montáže a tvarovek", "bm", 8.0, "C_kanal_cerpana_potrubi"),
    ("P1.3c", "Navrtávací pas 75/40", "ks", 1.0, "C_kanal_cerpana_potrubi"),
    ("P1.4c", "Automatická přečerpávací stanice tlakové kanalizace vč. jímky, vystrojení a řídící jednotky (např. Tlakan P2 smart, kpl)", "kpl", 1.0, "C_kanal_cerpana_potrubi"),
    ("P1.5c", "Výkop pro pokládku potrubí šířky 1 m, pažený", "bm", 12.8, "C_kanal_cerpana_zemni"),
    ("P1.6c", "Pískový podsyp frakce 0–16 mm, výška 0,1 m, zhutnění", "m³", 1.28, "C_kanal_cerpana_zemni"),
    ("P1.7c", "Pískový obsyp frakce 0–16 mm bez ostrých zrn, výška 0,2 m, zhutnění", "m³", 3.84, "C_kanal_cerpana_zemni"),
    ("P1.8c", "Konečný zához výkopu zeminou", "kpl", 7.68, "C_kanal_cerpana_zemni"),
    ("P1.10c", "Odvoz a uskladnění přebytečného výkopového materiálu", "kpl", 1.0, "C_kanal_cerpana_zemni"),
    ("P1.11c", "Montážní a pomocný materiál (součást zemních a pomocných prací)", "kpl", 1.0, "C_kanal_cerpana_zemni"),
    ("P.2.2", "Ostatní práce", "kpl", 1.0, "C_kanal_cerpana_inzenyrska"),
    ("P.2.3", "Identifikace, vytyčení a průkaz stávajících sítí ve výkopem dotčeném území vč. příp. projektové činnosti", "kpl", 1.0, "C_kanal_cerpana_inzenyrska"),
    ("P.2.4", "Inženýrská činnost vč. mapových podkladů, správních poplatků atd.", "kpl", 1.0, "C_kanal_cerpana_inzenyrska"),
    ("P.2.5", "Dílenská dokumentace", "kpl", 1.0, "C_kanal_cerpana_inzenyrska"),
    ("P.2.6", "Dokumentace skutečného provedení", "kpl", 1.0, "C_kanal_cerpana_inzenyrska"),
    ("P.2.7", "Zkouška těsnosti kanalizace", "kpl", 1.0, "C_kanal_cerpana_inzenyrska"),
    # ===== D. Vodovod vnější =====
    ("P1.2d", "Plastové potrubí PE100 SDR11 d50 (50×4,6 mm) vč. montáže a tvarovek", "bm", 10.0, "D_vodovod_vnejsi_potrubi"),
    ("P1.3d", "Navrtávací pas 110/50", "ks", 1.0, "D_vodovod_vnejsi_potrubi"),
    ("P1.4d", "Uzavírací šoupě vč. zemní soupravy DN40", "kpl", 1.0, "D_vodovod_vnejsi_potrubi"),
    ("P1.5d", "Výkop pro pokládku potrubí šířky 1 m, pažený", "bm", 16.0, "D_vodovod_vnejsi_zemni"),
    ("P1.6d", "Pískový podsyp frakce 0–16 mm, výška 0,1 m, zhutnění", "m³", 1.6, "D_vodovod_vnejsi_zemni"),
    ("P1.7d", "Pískový obsyp frakce 0–16 mm bez ostrých zrn, výška 0,2 m, zhutnění", "m³", 4.8, "D_vodovod_vnejsi_zemni"),
    ("P1.8d", "Konečný zához výkopu zeminou", "kpl", 9.6, "D_vodovod_vnejsi_zemni"),
    ("P1.9d", "Výstražná folie", "bm", 10.0, "D_vodovod_vnejsi_zemni"),
    ("P1.10d", "Odvoz a uskladnění přebytečného výkopového materiálu", "kpl", 1.0, "D_vodovod_vnejsi_zemni"),
    ("P1.11d", "Montážní a pomocný materiál (součást zemních a pomocných prací)", "kpl", 1.0, "D_vodovod_vnejsi_zemni"),
]

SECTION_PCT_ADDON = {
    "A_vodovod": "DV1.5 kompletace+montáž 15 % + DV1.6 rezerva 10 % + DV3.4 10 % + DV4.2 10 %",
    "B_kanalizace": "K1.16 montáž + kompletace 10 %",
    "C_kanal_cerpana": "montáž + kompletace 10 %",
    "D_vodovod_vnejsi": "montáž + kompletace 10 %",
}

SUBSECTION_LABEL = {
    "A": "Domovní vodovod (DV1-DV7)",
    "B": "Domovní kanalizace (K1-K2)",
    "C": "Kanalizace čerpaná vnější (P1)",
    "D": "Vodovod vnější (P1)",
}


def make_zti_item(idx: int, code: str, popis: str, mj: str, mn: float, tag: str) -> dict:
    section = tag[0]  # A/B/C/D
    pct_key = next((k for k in SECTION_PCT_ADDON if tag.startswith(k)), None)
    return {
        "id": f"M-ZTI-{idx:03d}",
        "kapitola": "M-ZTI",
        "SO": "SO-14",
        "popis": popis,
        "mj": mj,
        "mnozstvi": mn,
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "pending_stage_3",
        "urs_match_score": 0.0,
        "skladba_ref": None,
        "source": f"VV projektantský výkaz výměr ({VV_SOURCE}) — {SUBSECTION_LABEL[section]}",
        "raw_description": f"{code}: {popis[:60]}",
        "confidence": 0.95,
        "subdodavatel_chapter": "zti_vodovod_kanalizace",
        "_vyjasneni_ref": [],
        "_status_flag": None,
        "_data_source": "VV_projektant",
        "_completeness": 1.0,
        "_qty_formula": f"VV {code} = {mn} {mj} (projektant authoritative)",
        "_export_wrapper_hint": None,
        "_pattern_15_ref": PATTERN_15_REF,
        "_kros_hint": "Stage 3 — VV kód → KROS/URS mapping separate task",
        "_projektant_code": code,
        "_pct_addon": SECTION_PCT_ADDON.get(pct_key) if pct_key else None,
        "audit_trail": {
            "lokalizace": f"ZTI — {SUBSECTION_LABEL[section]} · SO-14",
            "formula": f"VV {code} = {mn} {mj}",
            "formula_parsed_method": "direct_vv_extract",
            "inputs": [
                {"label": "projektant_code", "value": code, "unit": ""},
                {"label": "vymera", "value": mn, "unit": mj},
            ],
            "reference": [
                {"type": "document", "code": "VV výkaz výměr",
                 "document": VV_SOURCE, "projektant_code": code},
            ],
            "poznamka": (
                f"Projektantský VV — authoritative (confidence 0.95). Kód {code} "
                f"preserved. Percentage addon na sekci: {SECTION_PCT_ADDON.get(pct_key, '—') if pct_key else '—'}."
            ),
            "confidence": 0.95,
            "extraction_method": "vv_projektant_authoritative",
            "data_source_hint": "VV_projektant",
            "extracted_at": NOW_ISO,
            "kapitola_decision": "M-ZTI (new — ZTI z projektantského VV, SO-14)",
            "projektant_code": code,
        },
    }


# --------------------------------------------------------------------------- #
# Dlažba 1.5 m chodník — 10 items per ČSN 73 6131 (norm-verified §1.2)
# Geometrie: 1.5 m × ~80 m = 120 m²
# --------------------------------------------------------------------------- #
DLAZBA_L = 80.0
DLAZBA_W = 1.5
DLAZBA_PLOCHA = round(DLAZBA_L * DLAZBA_W, 1)  # 120.0

DLAZBA_ROWS = [
    ("M-VK-030", "Výkop rýhy pro zámkovou dlažbu chodníku hl. ~300 mm", "m³", 36.0,
     f"{DLAZBA_L} × {DLAZBA_W} × 0.30 = 36.0 m³", "132xxx (výkop rýh)"),
    ("M-VK-031", "Odvoz vykopané zeminy z rýhy chodníku na skládku", "m³", 36.0,
     "= objem výkopu M-VK-030 = 36.0 m³", "162xxx (odvoz)"),
    ("M-VK-032", "Úprava + hutnění zemní pláně pod dlažbu chodníku (Edef2 ≥ 30 MPa)", "m²", DLAZBA_PLOCHA,
     f"{DLAZBA_L} × {DLAZBA_W} = {DLAZBA_PLOCHA} m²", "181xxx (úprava pláně)"),
    ("M-VK-033", "Geotextilie 300 g/m² separační pod dlažbu chodníku", "m²", DLAZBA_PLOCHA,
     f"{DLAZBA_L} × {DLAZBA_W} = {DLAZBA_PLOCHA} m²", "693xxx (geotextilie)"),
    ("M-VK-034", "Štěrk ŠD 32/63 nosná podkladní vrstva tl 150 mm + hutnění (chodník dlažba)", "m³", 18.0,
     f"{DLAZBA_PLOCHA} × 0.15 = 18.0 m³", "564xxx (podkladní vrstvy)"),
    ("M-VK-035", "Jemný štěrk / drť frakce 4/8 mm — ložná vrstva dlažby tl 40 mm", "m³", 4.8,
     f"{DLAZBA_PLOCHA} × 0.04 = 4.8 m³", "564xxx (ložná vrstva)"),
    ("M-VK-036", "Obrubníky betonové ABO 100×250 do betonového lože C16/20 (lemování chodníku)", "bm", 80.0,
     f"~{DLAZBA_L} bm (vnější hrana chodníku)", "916xxx (obrubníky)"),
    ("M-VK-037", "Beton lože C16/20 pod obrubníky chodníku + boční opěra", "m³", 2.4,
     "80 bm × ~0.03 m³/bm (lože + opěra) = ~2.4 m³", "916xxx (lože obrubníku)"),
    ("M-VK-038", "Zámková dlažba BEST tl 80 mm — kladení, sklon 2 % od fasády", "m²", DLAZBA_PLOCHA,
     f"{DLAZBA_L} × {DLAZBA_W} = {DLAZBA_PLOCHA} m²", "596xxx (kladení dlažby)"),
    ("M-VK-039", "Zásyp spár křemičitým pískem frakce 0,2 mm + hutnění vibrodeskou", "m²", DLAZBA_PLOCHA,
     f"{DLAZBA_L} × {DLAZBA_W} = {DLAZBA_PLOCHA} m²", "596xxx (zásyp spár)"),
]


def make_dlazba_item(item_id, popis, mj, mn, qty_formula, kros_hint) -> dict:
    return {
        "id": item_id,
        "kapitola": "M-VK",
        "SO": "SO-13",
        "popis": popis,
        "mj": mj,
        "mnozstvi": mn,
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "pending_stage_3",
        "urs_match_score": 0.0,
        "skladba_ref": None,
        "source": (
            "TZ ARS B p09 (chodník pro pěší ze zámkové dlažby 1,5 m) + zákazník "
            "confirmation 2026-05-27 + ČSN 73 6131 (norm-verified skladba)"
        ),
        "raw_description": f"dlažba chodník 1.5 m — {popis[:45]}",
        "confidence": 0.80,
        "subdodavatel_chapter": "venkovni_upravy",
        "_vyjasneni_ref": ["ABMV_34"],
        "_status_flag": None,
        "_data_source": "TZ_ARS_B_p09+ČSN_73_6131+user_2026-05-27",
        "_completeness": 1.0,
        "_qty_formula": qty_formula,
        "_export_wrapper_hint": None,
        "_pattern_15_ref": PATTERN_15_REF,
        "_kros_hint": kros_hint,
        "_scope_basis": (
            "TZ ARS B p09 explicit 'chodník pro pěší ze zámkové dlažby 1,5 m'. "
            "Dlažba 1.5 m ADJACENT k okapníku 0.7 m = 2.2 m kolem haly (user "
            "decision 2026-05-27). Skladba per ČSN 73 6131 (norm verification "
            "outputs/norm_verification_okapnik_dlazba.md §1.2). Viz ABMV_34."
        ),
        "audit_trail": {
            "lokalizace": "venkovní úpravy — zámková dlažba chodník 1.5 m podél haly · SO-13",
            "formula": qty_formula,
            "formula_parsed_method": "product",
            "inputs": [
                {"label": "delka_chodniku", "value": DLAZBA_L, "unit": "m"},
                {"label": "sire_chodniku", "value": DLAZBA_W, "unit": "m"},
            ],
            "reference": [
                {"type": "tz_section", "section": "ARS B p09",
                 "raw": "chodník pro pěší ze zámkové dlažby o šířce 1,5 m"},
                {"type": "norma", "code": "ČSN 73 6131-1",
                 "section": "Stavba vozovek — Kryty z dlažeb"},
                {"type": "user_decision", "code": "2026-05-27",
                 "raw": "dlažba 1.5 m + okapník 0.7 m = 2.2 m kolem haly"},
            ],
            "poznamka": (
                "Zámková dlažba pěší chodník per TZ ARS B p09 (1,5 m šíře). "
                "Skladba ČSN 73 6131 — norm-verified. ADJACENT k betonovému "
                "okapníku 0.7 m (M-VK-020..029)."
            ),
            "confidence": 0.80,
            "extraction_method": "tz_ars + ČSN_73_6131_layer_stack",
            "data_source_hint": "TZ_ARS_B+ČSN_73_6131",
            "extracted_at": NOW_ISO,
            "kapitola_decision": (
                "M-VK zámková dlažba chodník 1.5 m — TZ ARS B p09 explicit + "
                "user decision 2026-05-27 (NE dříve dropped — nyní IN bid)"
            ),
            "kros_hint": kros_hint,
        },
    }


# Supersede map: guessed M-VK id → VV authoritative replacement note
SUPERSEDE = {
    "M-VK-005": "VV K1.6 DN125 55m + K1.7 DN160 30m + K1.8 DN200 9m (M-ZTI dešťová kanalizace přesné DN+metry)",
    "M-VK-006": "VV K1.2/K1.3 PP-HT + K1.5 PP-KG DN110 (M-ZTI splašková kanalizace přesné)",
    "M-VK-007": "VV K1.9..K1.15 — 7 specifických šachet (Dš, Dš1, Dš2 filtrační, Rš2, Rš3, Dš2) místo guessed 3 generic",
    "M-VK-010": "VV DV7.1-7.5 požární vodovod + hydrant D19/30 (M-ZTI A požární)",
    "M-VK-011": "VV K1.14 retenční nádoba 15 m³ (⌀3.1×2.0) + K1.13 zasakovací těleso 2 m³ — NE 30 m³ guessed",
}


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    existing_ids = {it["id"] for it in raw["items"]}

    # 1. Supersede guessed M-VK items (Pattern 14)
    superseded = 0
    for item in raw["items"]:
        if item["id"] in SUPERSEDE:
            note = SUPERSEDE[item["id"]]
            item["_status_flag"] = "superseded_by_VV_2026-05-27"
            item["_superseded_by"] = note
            journey = item.setdefault("_analytical_journey", [])
            journey.append({
                "timestamp": NOW_ISO,
                "phase": "superseded_by_projektant_VV",
                "previous_state": {
                    "mnozstvi": item["mnozstvi"], "mj": item["mj"],
                    "confidence": item.get("confidence"), "active": True,
                },
                "current_state": {"_status_flag": "superseded_by_VV_2026-05-27", "active": False},
                "source": (
                    f"VV projektantský výkaz ({VV_SOURCE}) authoritative (conf 0.95) "
                    f"supersedes guessed item. Replacement: {note}"
                ),
                "correction_type": "guessed_superseded_by_authoritative_VV",
            })
            superseded += 1

    # 2. Add M-ZTI items from VV
    zti_items = [make_zti_item(i + 1, *row) for i, row in enumerate(VV_ROWS)]
    # 3. Add dlažba items
    dlazba_items = [make_dlazba_item(*row) for row in DLAZBA_ROWS]

    for it in zti_items + dlazba_items:
        if it["id"] in existing_ids:
            raise SystemExit(f"FATAL: id collision {it['id']!r}")

    prev = len(raw["items"])
    raw["items"].extend(zti_items)
    raw["items"].extend(dlazba_items)
    new = len(raw["items"])
    expected = prev + len(zti_items) + len(dlazba_items)
    if new != expected:
        raise SystemExit(f"FATAL: expected {expected}, got {new}")
    if superseded != len(SUPERSEDE):
        raise SystemExit(f"FATAL: expected {len(SUPERSEDE)} superseded, got {superseded}")

    raw["metadata"].setdefault("revisions", []).append({
        "date": "2026-05-27",
        "change": (
            f"VV ZTI parse → M-ZTI kapitola ({len(zti_items)} items, SO-14) + "
            f"zámková dlažba 1.5 m chodník ({len(dlazba_items)} items, M-VK-030..039) "
            f"+ supersede {superseded} guessed M-VK items per projektant VV authoritative."
        ),
        "reason": (
            "Projektantský VV (inputs/tz/VV_Hradec Králové.pdf) authoritative "
            "(confidence 0.95) — nahrazuje guessed kanalizace/vodovod/šachty/"
            "hydrant/retenční items. Dlažba 1.5 m per TZ ARS B p09 + user "
            "decision 2026-05-27 (dříve dropped, nyní IN bid). Všechny skladby "
            "norm-verified (outputs/norm_verification_okapnik_dlazba.md)."
        ),
        "previous_count": prev,
        "new_count": new,
        "items_added_m_zti": [it["id"] for it in zti_items],
        "items_added_dlazba": [it["id"] for it in dlazba_items],
        "items_superseded": list(SUPERSEDE.keys()),
        "abmvs_added": ["ABMV_33", "ABMV_34"],
        "retencni_discrepancy": (
            "Guessed M-VK-011 = 30 m³ (6.15×2.75×2.0). VV K1.14 = retenční 15 m³ "
            "(⌀3.1×2.0) + K1.13 zasakovací 2 m³. VV authoritative → ABMV_33."
        ),
        "norm_verification": "outputs/norm_verification_okapnik_dlazba.md (all skladby compliant)",
        "pattern_14_compliance": "5 superseded items have _analytical_journey + _superseded_by link",
        "pattern_15_compliance": "VV codes preserved as _projektant_code; KROS mapping Stage 3 separate",
        "projektant_codes_preserved": "DV1.1..DV7.5, K1.2..K1.15, K2.2-K2.4, P1.x, P.2.x in _projektant_code",
    })

    ITEMS_PATH.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"items.json: {prev} → {new}")
    print(f"  M-ZTI: {len(zti_items)} items (SO-14, VV authoritative)")
    print(f"  dlažba: {len(dlazba_items)} items (M-VK-030..039)")
    print(f"  superseded: {superseded} guessed M-VK items")

    # ABMV
    abmv = json.loads(ABMV_PATH.read_text(encoding="utf-8"))
    new_abmvs = [
        {
            "id": "ABMV_33",
            "category": "design_clarification",
            "severity": "medium",
            "status": "open",
            "title": "Retenční nádrž objem 30 vs 15 m³ — VV authoritative",
            "summary_cs": (
                "C.3 situace + guessed item M-VK-011 = 30 m³ (6.15×2.75×2.0). "
                "Projektantský VV K1.14 = akumulačně retenční nádoba 15 m³ "
                "(⌀3.1 × v=2.0 m) + K1.13 zasakovací těleso min 2 m³. VV "
                "authoritative → bid = 15 m³ retenční + 2 m³ zasakovací. M-VK-011 "
                "superseded. Cena impact: objem -50 %. Verify projektant Volka."
            ),
            "blocks_vv": [],
            "addressee": ["projektant Volka", "SOLAR DISPOREC"],
            "items_affected": ["M-VK-011 (superseded)", "M-ZTI K1.13", "M-ZTI K1.14"],
            "resolution_required_before": "objednávka nádrže",
            "created_at": NOW_ISO,
        },
        {
            "id": "ABMV_34",
            "category": "design_clarification",
            "severity": "low",
            "status": "open",
            "title": "Konfigurace 2.2 m kolem haly — okapník 0.7 + dlažba 1.5",
            "summary_cs": (
                "User decision 2026-05-27: betonový okapník 0.7 m ADJACENT zámková "
                "dlažba 1.5 m = 2.2 m total kolem haly. Okapník = drip/sokl ochrana "
                "u fasády (M-VK-020..029); dlažba = pěší chodník vně (M-VK-030..039, "
                "per TZ ARS B p09). Verify projektant Volka že kombinace 2.2 m "
                "souhlasí s detailem řezu A103 + osazením."
            ),
            "blocks_vv": [],
            "addressee": ["projektant Volka"],
            "items_affected": ["M-VK-020..029 okapník", "M-VK-030..039 dlažba"],
            "resolution_required_before": "execution kick-off",
            "created_at": NOW_ISO,
        },
    ]
    for a in new_abmvs:
        if a["id"] in {x["id"] for x in abmv["items"]}:
            raise SystemExit(f"FATAL: ABMV collision {a['id']}")
    abmv["items"].extend(new_abmvs)
    ABMV_PATH.write_text(json.dumps(abmv, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("abmv_email_queue.json: +2 ABMV (ABMV_33 retenční, ABMV_34 konfigurace 2.2 m)")

    # Emit ID lists for sequential_list SEQUENCE wiring
    print("\n--- M-ZTI IDs (for SEQUENCE) ---")
    print([it["id"] for it in zti_items])
    print("--- dlažba IDs ---")
    print([it["id"] for it in dlazba_items])


if __name__ == "__main__":
    main()
