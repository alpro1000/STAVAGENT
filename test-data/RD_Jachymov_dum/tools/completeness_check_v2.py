#!/usr/bin/env python3
"""
Completeness audit v2 — extends v1 (A-D) with 6 new sections (E-J).

Sections:
  A. TKP family coverage           (v1)
  B. Subdodavatel coverage         (v1)
  C. RD anchor checklist           (v1)
  D. TZ verb-noun scan             (v1, kept but de-prioritized)
  E. Per-podlaží matrix            (4 podlaží × 7 elements = 28 cells)
  F. Per-room matrix               (25 rooms × 9 attributes = 225 cells)
  G. Cross-element consistency     (okna / dveře / krokve / sanit chains)
  H. Material balance              (podlahy / fasáda / stěny vnitřní)
  I. Cost ratio sanity             (per-gate × Methvin rates estimate)
  J. TZ deep scan per section      (IPE/HEA profiles, odpady, sanit, ELI okruhy)

Output:
  outputs/items_completeness_audit_v2.json — structured
  outputs/items_completeness_report_v2.md  — human worksheet + consolidated_gaps
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

# Import v1 helpers + reuse sections A-D
sys.path.insert(0, str(Path(__file__).resolve().parent))
from completeness_check import (  # noqa: E402
    norm, item_text, match_anchor, scan_tz_verbs,
    TKP_FAMILIES, RD_ANCHORS, APPLICABILITY,
)

PROJ = Path(__file__).resolve().parent.parent
ITEMS_JSON = PROJ / "outputs" / "items_rd_jachymov_complete.json"
SUBDOD_JSON = PROJ / "inputs" / "meta" / "subdodavatel_mapping.json"
DXF_JSON = PROJ / "outputs" / "dxf_comprehensive_extract.json"
TZ_DIR = PROJ / "inputs" / "tz"
OUT_JSON = PROJ / "outputs" / "items_completeness_audit_v2.json"
OUT_MD = PROJ / "outputs" / "items_completeness_report_v2.md"

TODAY = str(date.today())


# ── Section E — Per-podlaží required elements ──────────────────────────────
# Per-podlaží: 7 elements with applicability per floor type (sklep vs obytné)
PODLAZI_ELEMENTS = ["podlaha", "soklíky", "omítka_stěn", "výmalba",
                    "strop_podhled", "stropní_svítidla", "vytápěcí_prvky"]

# Applicability table per podlaží — TRUE means element required, FALSE = N/A
PODLAZI_REQUIRES = {
    "1.PP": {
        "podlaha": True,        # sklep dlažba protiskluzná
        "soklíky": False,       # sklep: bez soklíku obvyklé
        "omítka_stěn": True,    # sklep: hrubá / štuk
        "výmalba": True,        # sklep: bílá vápenná
        "strop_podhled": False, # klenba zachována — žádný podhled
        "stropní_svítidla": True,  # sklep musí mít osvětlení
        "vytápěcí_prvky": False,   # sklep technický, bez topení
    },
    "1.NP": {k: True for k in PODLAZI_ELEMENTS},
    "2.NP": {k: True for k in PODLAZI_ELEMENTS},
    "3.NP": {
        "podlaha": True,
        "soklíky": True,
        "omítka_stěn": True,
        "výmalba": True,
        "strop_podhled": True,   # podkroví obytné → MUSÍ mít SDK pod krov
        "stropní_svítidla": True,
        "vytápěcí_prvky": True,
    },
}

PODLAZI_KEYWORDS = {
    "podlaha":           ["podlah", "naslapn", "vinyl", "dlazb", "biodesk", "laminat"],
    "soklíky":           ["soklik", "sokl podlah", "lemovani soklu"],
    "omítka_stěn":       ["omitk", "stuk", "vapenocementov"],
    "výmalba":           ["vymalb", "nater stenku", "mal interier"],
    "strop_podhled":     ["podhled", "sdk strop", "sadrokarton strop"],
    "stropní_svítidla":  ["svitidl", "led strop", "stropni svitidlo"],
    "vytápěcí_prvky":    ["radiator", "topen", "tepelne cerpadl", "krb", "kamna", "elektrokot"],
}


def find_items_for_podlazi(items: list[dict], podlazi: str, kws: list[str]) -> list[dict]:
    """Items whose popis contains podlaží mention + any keyword."""
    podlazi_norm = norm(podlazi)
    out = []
    for it in items:
        t = item_text(it)
        if podlazi_norm in t and any(norm(k) in t for k in kws):
            out.append(it)
    return out


def section_E_per_podlazi(items: list[dict]) -> dict:
    """Per-podlaží required elements coverage."""
    matrix = {}
    for podlazi in ["1.PP", "1.NP", "2.NP", "3.NP"]:
        row = {}
        for elem in PODLAZI_ELEMENTS:
            required = PODLAZI_REQUIRES[podlazi][elem]
            if not required:
                row[elem] = {
                    "status": "N/A",
                    "reason": _na_reason(podlazi, elem),
                    "n_hits": 0,
                }
                continue
            kws = PODLAZI_KEYWORDS[elem]
            hits = find_items_for_podlazi(items, podlazi, kws)
            if not hits:
                # Try general (without podlaží anchor) — sometimes položka is global
                global_hits = match_anchor(items, kws)
                if global_hits:
                    row[elem] = {
                        "status": "PARTIAL",
                        "reason": f"{len(global_hits)} global items match keywords; no per-podlaží split — verify allocation",
                        "n_hits": len(global_hits),
                        "sample_ids": [h["id"] for h in global_hits[:3]],
                    }
                else:
                    row[elem] = {
                        "status": "GAP",
                        "reason": f"no items match keywords for {podlazi}",
                        "n_hits": 0,
                        "keywords_used": kws,
                    }
            else:
                row[elem] = {
                    "status": "✓",
                    "n_hits": len(hits),
                    "sample_ids": [h["id"] for h in hits[:3]],
                }
        matrix[podlazi] = row
    return matrix


def _na_reason(podlazi: str, elem: str) -> str:
    """Project-specific N/A justifications."""
    reasons = {
        ("1.PP", "soklíky"): "Sklep — bez soklíků obvyklé",
        ("1.PP", "strop_podhled"): "Klenba sklepa zachována — žádný podhled",
        ("1.PP", "vytápěcí_prvky"): "Sklep technický bez topení — verify TZ",
    }
    return reasons.get((podlazi, elem), "Per project metadata")


# ── Section F — Per-room matrix ────────────────────────────────────────────
ROOM_ATTRS = ["podlaha", "soklíky", "omítka_obvod", "výmalba",
              "obklad", "dveře", "okno", "stropní_podhled", "vytápěcí_prvek"]


def room_type(name: str) -> str:
    """Classify room type from name."""
    n = norm(name)
    if "koupeln" in n: return "koupelna"
    if "wc" in n: return "wc"
    if "kuchyn" in n: return "kuchyne"
    if "sklep" in n: return "sklep"
    if "schodist" in n: return "schodiste"
    if "chodb" in n: return "chodba"
    if "komora" in n: return "komora"
    if "vstup" in n: return "vstup"
    if "obyv" in n or "loznic" in n or "pokoj" in n: return "obytna"
    return "ostatní"


def room_applicability(rtype: str, attr: str) -> tuple[bool, str]:
    """Returns (required, reason_if_NA)."""
    if attr == "obklad":
        if rtype in ("koupelna", "wc", "kuchyne"):
            return (True, "")
        return (False, f"{rtype} — obklad není povinný")
    if attr == "vytápěcí_prvek":
        if rtype in ("sklep", "komora", "schodiste", "chodba"):
            return (False, f"{rtype} — vytápění obvykle není")
        return (True, "")
    if attr == "okno":
        if rtype in ("schodiste", "chodba", "komora"):
            return (False, f"{rtype} — okno obvykle nepřítomné")
        return (True, "")
    if attr == "stropní_podhled":
        if rtype == "sklep":
            return (False, "Sklep — klenba zachována")
        return (True, "")
    if attr == "soklíky":
        if rtype == "sklep":
            return (False, "Sklep — bez soklíků")
        return (True, "")
    return (True, "")


ROOM_KEYWORDS = {
    "podlaha":         ["podlah", "naslapn", "vinyl", "dlazb", "biodesk"],
    "soklíky":         ["soklik"],
    "omítka_obvod":    ["omitk", "stuk"],
    "výmalba":         ["vymalb", "nater stenku"],
    "obklad":          ["obklad keramick", "obklad koupeln", "obklad kuchyn"],
    "dveře":           ["dvere", "zarubn"],
    "okno":            ["okno", "plastov okna"],
    "stropní_podhled": ["podhled", "sdk strop"],
    "vytápěcí_prvek":  ["radiator", "topen", "vytapeni", "krb", "kamna"],
}


def section_F_per_room(items: list[dict], rooms: list[dict]) -> list[dict]:
    """Per-room × per-attribute coverage."""
    out = []
    for room in rooms:
        rname = room["name"]
        rtype = room_type(rname)
        room_id = room.get("room_id", "?")
        podlazi = room.get("podlazi", "?")
        attrs_status = {}
        for attr in ROOM_ATTRS:
            req, na_reason = room_applicability(rtype, attr)
            if not req:
                attrs_status[attr] = {"status": "N/A", "reason": na_reason}
                continue
            kws = ROOM_KEYWORDS[attr]
            # First try: items mentioning the room directly (by id "1.05" or by name "koupelna")
            room_anchor = [room_id, rname.lower()]
            hits = []
            for it in items:
                t = item_text(it)
                if any(norm(a) in t for a in room_anchor) and any(norm(k) in t for k in kws):
                    hits.append(it)
            if not hits:
                # Fallback: per-podlaží level
                podlazi_norm = norm(podlazi)
                podlazi_hits = []
                for it in items:
                    t = item_text(it)
                    if podlazi_norm in t and any(norm(k) in t for k in kws):
                        podlazi_hits.append(it)
                if podlazi_hits:
                    attrs_status[attr] = {
                        "status": "OK_PER_FLOOR",
                        "reason": f"covered at {podlazi} level (no per-room split)",
                        "n_hits": len(podlazi_hits),
                    }
                else:
                    # Last fallback: global (any item with kw)
                    global_hits = match_anchor(items, kws)
                    if global_hits:
                        attrs_status[attr] = {
                            "status": "OK_GLOBAL",
                            "reason": f"{len(global_hits)} global items with kw",
                            "n_hits": len(global_hits),
                        }
                    else:
                        attrs_status[attr] = {
                            "status": "GAP",
                            "reason": "no items match keywords at any granularity",
                        }
            else:
                attrs_status[attr] = {
                    "status": "✓",
                    "n_hits": len(hits),
                    "sample_ids": [h["id"] for h in hits[:2]],
                }
        out.append({
            "room_id": room_id,
            "name": rname,
            "type": rtype,
            "podlazi": podlazi,
            "area_m2": room.get("area_m2"),
            "attrs": attrs_status,
        })
    return out


# ── Section G — Cross-element consistency ──────────────────────────────────
def section_G_cross_element(items: list[dict], dxf: dict) -> dict:
    """4 element chains — DXF count must align with items count/qty."""
    chains = {}

    # 1. Okna chain — restrict to kapitola PSV-76 Výplně otvorů + plast okno items
    dxf_okna = dxf.get("otvory", {}).get("okna", {}).get("total_count", 0)
    okna_items = [
        it for it in items
        if "PSV-76" in it.get("kapitola", "") and it.get("mj") == "ks"
        and any(t in norm(it["popis"]) for t in ("plastov okn", "okno plast", "plast okn"))
    ]
    okna_ks_sum = _sum_ks(okna_items)
    # Parapety: often measured in bm (linear meters per okno) not ks — accept both
    parapety_items = [it for it in items if "parapet" in norm(it["popis"]) and "spalet" not in norm(it["popis"])]
    parapety_ks_sum = sum(
        (it.get("mnozstvi") or 0) for it in parapety_items
        if it.get("mj") in ("ks", "kpl", "sada")
    )
    parapety_bm_sum = sum(
        (it.get("mnozstvi") or 0) for it in parapety_items
        if it.get("mj") in ("bm", "m")
    )
    parapety_has_items = bool(parapety_items)
    spalety_items = [it for it in items if "spalet" in norm(it["popis"])]
    spalety_bm_sum = sum((it.get("mnozstvi") or 0) for it in spalety_items if it.get("mj") in ("bm", "m"))
    oplech_items = [it for it in items if "oplech" in norm(it["popis"]) and "parapet" in norm(it["popis"])]
    oplech_ks_sum = _sum_ks(oplech_items)

    chains["okna"] = {
        "dxf_count": dxf_okna,
        "okna_items_ks_sum": okna_ks_sum,
        "parapety_items_ks_sum": parapety_ks_sum,
        "parapety_items_bm_sum": parapety_bm_sum,
        "parapety_has_any_items": parapety_has_items,
        "spalety_bm": spalety_bm_sum,
        "spalety_expected_bm": dxf_okna * 5.0,
        "oplech_parapetu_ks": oplech_ks_sum,
        "verdict": _verdict_okna(dxf_okna, okna_ks_sum, parapety_has_items,
                                  spalety_bm_sum, oplech_ks_sum),
        "items_okna_ids": [it["id"] for it in okna_items][:5],
    }

    # 2. Dveře chain — restrict to PSV-76 only, ks unit
    dxf_vnitrni = dxf.get("otvory", {}).get("dvere_vnitrni", {}).get("estimated_actual_count", 0)
    dxf_vstupni = dxf.get("otvory", {}).get("vstupni_dvere", {}).get("estimated_count", 0)
    dvere_items = [
        it for it in items
        if "PSV-76" in it.get("kapitola", "") and it.get("mj") == "ks"
        and "dver" in norm(it["popis"]) and "demont" not in norm(it["popis"])
    ]
    dvere_ks = _sum_ks(dvere_items)
    zarubn_items = [it for it in items if it.get("mj") == "ks" and "zarubn" in norm(it["popis"])]
    zarubn_ks = _sum_ks(zarubn_items)
    kovani_items = [it for it in items if "kovan" in norm(it["popis"]) and "sad" in norm(it["popis"])]
    kovani_ks = _sum_ks(kovani_items)

    chains["dvere"] = {
        "dxf_vnitrni_count": dxf_vnitrni,
        "dxf_vstupni_count": dxf_vstupni,
        "dxf_total_expected": dxf_vnitrni + dxf_vstupni,
        "dvere_items_ks_sum": dvere_ks,
        "zarubn_items_ks_sum": zarubn_ks,
        "kovani_items_ks_sum": kovani_ks,
        "verdict": _verdict_dvere(dxf_vnitrni + dxf_vstupni, dvere_ks, zarubn_ks),
        "items_dvere_ids": [it["id"] for it in dvere_items][:5],
    }

    # 3. Krov / krokve chain
    dxf_krokve_blocks = dxf.get("konstrukce", {}).get("krokve_KR_blocks", {}).get("insert_count", 0)
    krokve_items = [it for it in items if "krokv" in norm(it["popis"])]
    krokve_bm = sum((it.get("mnozstvi") or 0) for it in krokve_items if it.get("mj") == "bm")
    klestiny_items = [it for it in items if "klestin" in norm(it["popis"])]
    klestiny_bm = sum((it.get("mnozstvi") or 0) for it in klestiny_items if it.get("mj") == "bm")
    pozednice_items = [it for it in items if "pozednic" in norm(it["popis"])]
    pozednice_bm = sum((it.get("mnozstvi") or 0) for it in pozednice_items if it.get("mj") == "bm")
    hea_items = [it for it in items if any(t in norm(it["popis"]) for t in ("hea", "vaznic"))]
    hea_ks_or_bm = sum((it.get("mnozstvi") or 0) for it in hea_items)

    chains["krokve"] = {
        "dxf_krokve_blocks_count": dxf_krokve_blocks,
        "_note": "KR INSERT count is gross (incl sloupky + námětky); geometric calc primary per items.json",
        "krokve_bm_sum": krokve_bm,
        "klestiny_bm_sum": klestiny_bm,
        "pozednice_bm_sum": pozednice_bm,
        "hea_items_qty_sum": hea_ks_or_bm,
        "verdict": _verdict_krov(krokve_bm, klestiny_bm, pozednice_bm),
        "items_krokve_ids": [it["id"] for it in krokve_items][:5],
    }

    # 4. Sanitární chain — PSV-72 ZTI items only, ks unit
    # Exclude deprecated set items (replaced by per-fixture items in audit v2)
    sanit_dxf = dxf.get("sanitarni", [])
    dxf_sanit_count = {s["prvek"].lower(): s.get("deduplicated_count", 0) for s in sanit_dxf}
    sanit_kuchyne_dxf = dxf.get("kuchyne", [])
    dxf_drez = sum(s.get("deduplicated_count", 0) for s in sanit_kuchyne_dxf if "drez" in s.get("prvek","").lower())
    psv72 = [it for it in items if "PSV-72" in it.get("kapitola", "")
             and it.get("status_flag") != "deprecated_audit_v2"]
    baterie_items = [it for it in psv72 if "baterie" in norm(it["popis"])]
    baterie_ks = _sum_ks(baterie_items)
    sanit_items = [
        it for it in psv72
        if it.get("mj") == "ks"
        and any(t in norm(it["popis"]) for t in ("wc kombi", "wc keramick", "wc zaves",
                                                  "umyvadl", "vana koupeln", "sprch kout",
                                                  "wc misa", "drez nerez", "drez kuch"))
    ]
    sanit_items_ks = _sum_ks(sanit_items)
    rozvody_voda_items = [it for it in items if "vodovod" in norm(it["popis"]) or "rozvod vod" in norm(it["popis"])]
    rozvody_voda_bm = sum((it.get("mnozstvi") or 0) for it in rozvody_voda_items if it.get("mj") in ("bm", "m"))

    chains["sanit"] = {
        "dxf_sanit_count": dxf_sanit_count,
        "dxf_drez_count": dxf_drez,
        "dxf_total_fixtures": sum(dxf_sanit_count.values()) + dxf_drez,
        "sanit_items_ks_sum": sanit_items_ks,
        "baterie_items_ks_sum": baterie_ks,
        "rozvody_voda_bm": rozvody_voda_bm,
        "verdict": _verdict_sanit(sum(dxf_sanit_count.values()) + dxf_drez, sanit_items_ks, baterie_ks),
        "items_sanit_ids": [it["id"] for it in sanit_items][:5],
    }
    return chains


def _sum_ks(items: list[dict]) -> float:
    """Sum mnozstvi for items where mj indicates 'ks'."""
    return sum((it.get("mnozstvi") or 0) for it in items if it.get("mj") in ("ks", "kpl", "sada"))


def _delta_pct(actual: float, expected: float) -> float:
    if expected == 0:
        return float("inf") if actual else 0.0
    return abs(actual - expected) / expected * 100


def _verdict_okna(dxf, okna, parapety_has_items, spalety, oplech):
    issues = []
    if okna and _delta_pct(okna, dxf) > 10:
        issues.append(f"okna items={okna} vs DXF={dxf} (Δ {_delta_pct(okna, dxf):.0f}%)")
    if not parapety_has_items:
        issues.append("parapety items=0 — chybí")
    expected_spalety = dxf * 5.0
    if spalety and _delta_pct(spalety, expected_spalety) > 20:
        issues.append(f"špalety={spalety:.1f} bm vs expected≈{expected_spalety:.0f} bm (Δ {_delta_pct(spalety, expected_spalety):.0f}%)")
    if oplech == 0:
        issues.append("oplechování parapetů items=0 (může být v klempířina aggregate)")
    return "OK" if not issues else "ISSUES: " + "; ".join(issues)


def _verdict_dvere(dxf_total, items_ks, zarubn_ks):
    issues = []
    if items_ks and _delta_pct(items_ks, dxf_total) > 20:
        issues.append(f"dveře={items_ks} vs DXF≈{dxf_total} (Δ {_delta_pct(items_ks, dxf_total):.0f}%)")
    if zarubn_ks == 0:
        issues.append("zárubně items=0 (může být inclusive v dveře položce)")
    return "OK" if not issues else "ISSUES: " + "; ".join(issues)


def _verdict_krov(krokve, klestiny, pozednice):
    issues = []
    if krokve > 0 and klestiny == 0:
        issues.append("klestiny bm=0 (může být inclusive v krov agregate)")
    if krokve > 0 and pozednice == 0:
        issues.append("pozednice bm=0 (může být inclusive v krov agregate)")
    return "OK" if not issues else "ISSUES: " + "; ".join(issues)


def _verdict_sanit(dxf_total, items_ks, baterie_ks):
    issues = []
    if items_ks and _delta_pct(items_ks, dxf_total) > 20:
        issues.append(f"sanit items={items_ks} vs DXF≈{dxf_total} (Δ {_delta_pct(items_ks, dxf_total):.0f}%)")
    # WC nemá baterii → 3 WC bez baterií → 8 fixtures need baterie
    expected_baterie = dxf_total - 3  # subtract WC count
    if baterie_ks and _delta_pct(baterie_ks, expected_baterie) > 25:
        issues.append(f"baterie={baterie_ks} vs expected≈{expected_baterie} (Δ {_delta_pct(baterie_ks, expected_baterie):.0f}%)")
    return "OK" if not issues else "ISSUES: " + "; ".join(issues)


# ── Section H — Material balance ───────────────────────────────────────────
def section_H_material_balance(items: list[dict], dxf: dict) -> dict:
    out = {}

    # Items to EXCLUDE from balance checks (per audit-v2 calibration):
    # - "tz_only_aggregate" (rough estimates, not precise enough for ±10 % balance)
    # - "deprecated_split_into_per_fixture" (replaced by per-fixture items, qty=0)
    def in_balance(it):
        return it.get("_data_quality") not in (
            "tz_only_aggregate", "deprecated_split_into_per_fixture",
        ) and it.get("status_flag") != "deprecated_audit_v2"

    # 1. Podlahy — separate dum vs sklad; biodeska 'spící patro nad krovem' is
    # additional surface NOT in TZ 219.3 m² baseline (which is podlahová plocha
    # of habitable rooms per DXF mistnosti).
    floor_buckets = {
        "vinyl":     ["vinyl"],
        "dlazba":    ["dlazb"],
        "biodeska":  ["biodesk"],
        "ostatní":   ["laminat", "marmoleum", "koberec"],
    }
    floor_sums_dum = {}
    floor_sums_sklad = {}
    for bucket, kws in floor_buckets.items():
        sd, ss = 0, 0
        for it in items:
            if not in_balance(it):
                continue
            if it.get("mj") not in ("m²", "m2"):
                continue
            t = item_text(it)
            if any(norm(k) in t for k in kws) and any(t2 in t for t2 in ["podlah", "naslapn"]):
                if it.get("objekt") == "260219_dum":
                    sd += (it.get("mnozstvi") or 0)
                elif it.get("objekt") == "260217_sklad":
                    ss += (it.get("mnozstvi") or 0)
        floor_sums_dum[bucket] = sd
        floor_sums_sklad[bucket] = ss

    # Biodeska "spící patro nad krovem" is additional level, not in TZ habitable area
    biodeska_extra = floor_sums_dum.get("biodeska", 0)
    dum_habitable_total = sum(v for k, v in floor_sums_dum.items() if k != "biodeska")
    tz_baseline_dum = dxf.get("plochy_podlah_per_podlazi", {}).get("tz_baseline_m2", 219.3)
    delta_pct = _delta_pct(dum_habitable_total, tz_baseline_dum)
    out["podlahy"] = {
        "per_material_dum": floor_sums_dum,
        "per_material_sklad": floor_sums_sklad,
        "dum_habitable_total_m2": dum_habitable_total,
        "biodeska_extra_spici_patro_m2": biodeska_extra,
        "tz_baseline_dum_m2": tz_baseline_dum,
        "_note": "Comparing dum habitable (vinyl + dlažba) vs TZ 219.3. Biodeska 25 m² is půdní spící patro nad krovem — ADDITIONAL surface, NOT in TZ habitable.",
        "delta_pct": delta_pct,
        "verdict": "OK" if delta_pct < 5 else f"GAP {delta_pct:.0f}%",
    }

    # 2. Fasáda — Příprava, EPS hlavní plocha, Omítka, Špalety, Sokl
    hsv7 = [it for it in items if "HSV-7" in it.get("kapitola", "") and in_balance(it)]
    etics = {}
    for label, kws, exclude in [
        ("priprava",   ["priprav"], []),
        ("eps_hlavni", ["eps 70f", "eps grey", "etics kontaktni zatepleni", "etics zatepleni"],
                       ["sokl", "spalet", "profilac", "kordon", "samban", "priprav", "omitka"]),
        ("omitka",     ["tenkovrstv", "konecna omitka", "fasadni omitka"], ["sokl", "spalet"]),
        ("spalety",    ["spalet"], []),
        ("sokl",       ["sokl xps", "sokl etics", "xps sokl", "sokl —"], []),
        ("profilace",  ["profilac fasad", "kordon", "samban"], []),
    ]:
        s = 0
        for it in hsv7:
            popis_norm = norm(it.get("popis", ""))
            if not any(norm(k) in popis_norm for k in kws):
                continue
            if exclude and any(norm(e) in popis_norm for e in exclude):
                continue
            if it.get("mj") in ("m²", "m2"):
                s += (it.get("mnozstvi") or 0)
        etics[label] = s
    out["fasada_etics"] = {
        "per_kategorie_m2": etics,
        "_logic": "priprava ≈ EPS ≈ omítka should match within ±5 %",
        "verdict": _verdict_etics(etics),
    }

    # 3. Stěny vnitřní — strict scope:
    # - omítka = ONLY PSV-78 jádrová+štuková (interior); EXCLUDE fasáda HSV-7
    # - výmalba = ONLY interiérová výmalba items (NOT SDK podhled tmelení — different work)
    # - nový obklad = ONLY new PSV-78 keramický obklad; EXCLUDE HSV-6 bourání obkladů + HSV-7 cihelný obklad sokl
    psv78 = [it for it in items if "PSV-78" in it.get("kapitola", "") and in_balance(it)]
    # Mutually-exclusive role buckets by FIRST significant work-noun in popis
    # (subkapitola contains item title; popis-prefix used to disambiguate items
    # mentioning multiple finishing trades like "SDK podhled + tmelení před výmalbou").
    omitka_items, vymal_items, obklad_items, sdk_items = [], [], [], []
    for it in psv78:
        if it.get("mj") not in ("m²", "m2"):
            continue
        p = norm(it["popis"])
        sub = norm(it.get("subkapitola", ""))
        # Priority by first significant noun in popis OR subkapitola
        # SDK podhled has higher priority than vymalba (SDK items mention vymalba
        # as next-step descriptor)
        if p.startswith("sdk podhled") or "sdk podhled" in sub:
            sdk_items.append(it)
        elif p.startswith("interier") or p.startswith("vymalb") or "interierova vymalb" in sub:
            vymal_items.append(it)
        elif "obklad" in p and "keramick" in p:
            obklad_items.append(it)
        elif "omitk" in p and not any(x in p for x in ("fasad", "tenkovrstv")):
            omitka_items.append(it)
    omitka_sum = sum((it.get("mnozstvi") or 0) for it in omitka_items)
    vymal_sum = sum((it.get("mnozstvi") or 0) for it in vymal_items)
    obklad_sum = sum((it.get("mnozstvi") or 0) for it in obklad_items)
    sdk_sum = sum((it.get("mnozstvi") or 0) for it in sdk_items)

    # Total paint-able surface = interior omítka (stěny) + SDK podhled (stropy)
    paintable_total = omitka_sum + sdk_sum
    out["steny_vnitrni"] = {
        "omitka_psv78_m2": omitka_sum,
        "sdk_podhled_m2": sdk_sum,
        "paintable_total_m2": paintable_total,
        "vymalba_interier_m2": vymal_sum,
        "nove_obklady_keramick_m2": obklad_sum,
        "vymalba_plus_obklad_m2": vymal_sum + obklad_sum,
        "_logic": "Paint-able = interiérová omítka stěn + SDK podhled stropy. Výmalba pokrývá paintable - obklady. Δ ≤ 10 % acceptable (round 70-cm obklad sub).",
        "delta_pct": _delta_pct(vymal_sum + obklad_sum, paintable_total) if paintable_total else 0,
        "verdict": _verdict_steny(paintable_total, vymal_sum, obklad_sum),
    }
    return out


def _verdict_etics(d: dict) -> str:
    issues = []
    priprava = d.get("priprava", 0)
    eps = d.get("eps_hlavni", 0)
    omitka = d.get("omitka", 0)
    if priprava == 0:
        issues.append("příprava podkladu items=0 (chybí?)")
    if eps and priprava and _delta_pct(eps, priprava) > 10:
        issues.append(f"EPS hlavní {eps:.0f} m² vs příprava {priprava:.0f} m² (Δ {_delta_pct(eps, priprava):.0f}%)")
    if omitka and priprava and _delta_pct(omitka, priprava) > 10:
        issues.append(f"omítka {omitka:.0f} m² vs příprava {priprava:.0f} m² (Δ {_delta_pct(omitka, priprava):.0f}%)")
    return "OK" if not issues else "ISSUES: " + "; ".join(issues)


def _verdict_steny(omitka, vymal, obklad):
    if omitka == 0:
        return "GAP — žádná omítka items"
    delta = _delta_pct(vymal + obklad, omitka)
    if delta < 10:
        return "OK"
    return f"ISSUE — výmalba+obklad {vymal+obklad:.0f} vs omítka {omitka:.0f} (Δ {delta:.0f}%)"


# ── Section I — Cost ratio sanity (Methvin estimates) ──────────────────────
METHVIN_RATES_CZK = {
    "HSV-1": 450,      # zemní práce Kč/m³ průměr
    "HSV-2": 4500,     # ŽB komplet Kč/m³
    "HSV-3": 2500,     # zdivo Kč/m²
    "HSV-4": 4500,     # stropy Kč/m²
    "HSV-5": 2000,     # krov + krytina Kč/m²
    "HSV-6": 500,      # bourání Kč/m²
    "HSV-7": 1850,     # ETICS komplet Kč/m²
    "PSV-71": 500,
    "PSV-72": 8000,    # ZTI Kč/ks
    "PSV-73": 25000,   # vytápění Kč/ks
    "PSV-76": 15000,   # výplně otvorů Kč/ks
    "PSV-77": 900,     # podlahy nášlap Kč/m²
    "PSV-78": 350,     # omítky+výmalba Kč/m²
    "PSV-95": 5000,
    "M-21":  3000,
    "VRN":   30000,    # paušál/ks
}

RD_TYPICAL_RATIOS = {
    "HSV": (0.45, 0.55),
    "PSV": (0.25, 0.35),
    "TZB": (0.15, 0.20),
    "VRN": (0.05, 0.10),
}


def section_I_cost_ratio(items: list[dict]) -> dict:
    per_kapitola = defaultdict(float)
    for it in items:
        kapitola = it.get("kapitola", "?").split()[0]  # "HSV-1 Zemní práce" → "HSV-1"
        rate = METHVIN_RATES_CZK.get(kapitola)
        if rate is None:
            continue
        qty = (it.get("mnozstvi") or 0)
        if not qty:
            continue
        per_kapitola[kapitola] += qty * rate
    total = sum(per_kapitola.values())
    if total == 0:
        return {"_error": "no items priced"}
    per_gate = defaultdict(float)
    for k, v in per_kapitola.items():
        gate = "HSV" if k.startswith("HSV") else "PSV" if k.startswith("PSV") else "TZB" if k in ("M-21","M-22","M-24") else "VRN"
        per_gate[gate] += v
    per_gate_pct = {g: v / total for g, v in per_gate.items()}
    out_gates = []
    for g, (lo, hi) in RD_TYPICAL_RATIOS.items():
        pct = per_gate_pct.get(g, 0)
        in_range = lo <= pct <= hi
        out_gates.append({
            "gate": g,
            "estimate_czk": per_gate.get(g, 0),
            "pct_of_total": pct,
            "typical_range_pct": [lo, hi],
            "in_range": in_range,
            "verdict": "OK" if in_range else f"OUT OF RANGE (typical {lo*100:.0f}-{hi*100:.0f}%)",
        })
    return {
        "_status": "INFORMATIONAL_ONLY",
        "_method": "Σ(qty × Methvin průměrná sazba) per kapitola → aggregate per gate",
        "_disclaimer": (
            "Methvin rates have INCONSISTENT UNITS per kapitola (Kč/m³ vs Kč/m² vs Kč/ks) and "
            "are aggregated naively — results are NOT reliable for ratio analysis. Treated as "
            "informational ballpark only. Real cenotvorba requires unit-aware per-item rates "
            "from URS catalog. Verdict 'OUT OF RANGE' for this section is EXPECTED and not "
            "treated as a gap in consolidated_gaps."
        ),
        "total_estimate_czk_ballpark": total,
        "per_kapitola_czk": dict(per_kapitola),
        "per_gate_breakdown": out_gates,
    }


# ── Section J — TZ deep scan per anchor ────────────────────────────────────
TZ_DEEP_ANCHORS = [
    # (anchor_id, severity, description, regex_search_pattern, item_keywords_to_match)
    ("J01", "important", "TZ statika — IPE profily (počet jednotek)",
        re.compile(r"IPE\s*\d{2,3}", re.IGNORECASE),
        ["ipe"]),
    ("J02", "important", "TZ statika — HEA profily",
        re.compile(r"HEA\s*\d{2,3}", re.IGNORECASE),
        ["hea"]),
    ("J03", "important", "TZ statika — IPN profily",
        re.compile(r"IPN\s*\d{2,3}", re.IGNORECASE),
        ["ipn"]),
    ("J04", "important", "TZ statika — jekl uzavřený profil",
        re.compile(r"jekl|uzavřený\s+profil", re.IGNORECASE),
        ["jekl", "uzavren profil"]),
    ("J05", "important", "TZ B m.10.e — bilance odpadů (kategorie t)",
        re.compile(r"\b\d+[,.]?\d*\s*t\b.{0,40}(?:beton|cihel|dřev|kov|plast|sklo|izolac)", re.IGNORECASE),
        ["odpad", "skladkovne"]),
    ("J06", "important", "TZ ARS — komínové těleso (zachované / nové)",
        re.compile(r"komín|kominov", re.IGNORECASE),
        ["komin"]),
    ("J07", "important", "TZ ARS — vikýře (počet, materiál)",
        re.compile(r"vikýř|vikyr", re.IGNORECASE),
        ["vikyr"]),
    ("J08", "important", "TZ ARS — opěrná stěna / bílá vana",
        re.compile(r"opěrn[áé]\s+stěn|bílá vana|bila vana|BV\b", re.IGNORECASE),
        ["operna sten", "bila vana"]),
    ("J09", "important", "TZ ARS — anglický dvorek",
        re.compile(r"anglick(?:ý|y)\s+dvorek", re.IGNORECASE),
        ["anglicky dvorek"]),
    ("J10", "important", "TZ ARS — terasa (materiál)",
        re.compile(r"teras[ay]?\b", re.IGNORECASE),
        ["terasa", "teras"]),
    ("J11", "important", "TZ PBŘ — detekce kouře (PSV-95)",
        re.compile(r"detekc[ei]\s+kouř|EDHP|hlásič|detekc[ei]\s+poz", re.IGNORECASE),
        ["detekce", "hlasic", "edhp"]),
    ("J12", "important", "TZ PBŘ — fire-rated dveře (PSV-76)",
        re.compile(r"požárn[íi]\s+dveř|EI\s*\d+|protipožárn[íi]|požárn[ěe]\s+odoln", re.IGNORECASE),
        ["pozarne odolne dver", "ei 30", "ei 60", "ei 90", "pozarn dver", "protipozarn", "pozarni uzaver"]),
    ("J13", "important", "TZ ARS — tepelné čerpadlo (PSV-73)",
        re.compile(r"tepeln[éí]\s+čerpadl|multisplit|TČ\b", re.IGNORECASE),
        ["tepelne cerpadl", "multisplit"]),
    ("J14", "medium",    "TZ ARS — elektrokotel / kotel",
        re.compile(r"elektrokotel|plynový kotel|kotel\b", re.IGNORECASE),
        ["elektrokot", "kotel"]),
    ("J15", "medium",    "TZ ARS — krb (PSV-73)",
        re.compile(r"\bkrb\b", re.IGNORECASE),
        ["krb"]),
    ("J16", "medium",    "TZ ARS — kamna (PSV-73)",
        re.compile(r"sporákov[áé]\s+kamna|kamna\b", re.IGNORECASE),
        ["kamna"]),
    ("J17", "medium",    "TZ ARS — žaluzie (PSV-76)",
        re.compile(r"žaluzi[eé]|venkovn[íi]\s+stín", re.IGNORECASE),
        ["zaluzi", "stineni"]),
    ("J18", "informational", "TZ ARS — geodet vytýčení",
        re.compile(r"vytýč|vytýčen[ií]|geodet", re.IGNORECASE),
        ["geodet", "vytyceni"]),
]


def section_J_tz_deep_scan(items: list[dict], tz_dir: Path) -> list[dict]:
    """For each TZ deep anchor: find in TZ AND verify covered in items.json."""
    try:
        import pypdf
    except ImportError:
        return [{"_error": "pypdf not available"}]

    # Concatenate all TZ text
    tz_text_parts = []
    for sub in ["260219_dum", "260217_sklad", "common"]:
        sub_dir = tz_dir / sub
        if not sub_dir.exists():
            continue
        for pdf in sub_dir.glob("*.pdf"):
            try:
                reader = pypdf.PdfReader(str(pdf))
                tz_text_parts.append("\n".join(p.extract_text() or "" for p in reader.pages))
            except Exception:
                pass
    full_tz = "\n".join(tz_text_parts)
    items_text_blob = " ".join(item_text(it) for it in items)

    out = []
    for anchor_id, sev, desc, regex, item_kws in TZ_DEEP_ANCHORS:
        tz_matches = list(set(m.group(0) for m in regex.finditer(full_tz)))
        items_hit = any(norm(k) in items_text_blob for k in item_kws)
        if tz_matches and items_hit:
            verdict, status = "OK", "covered"
        elif tz_matches and not items_hit:
            verdict, status = "GAP — mentioned in TZ but no items match", "gap"
        elif not tz_matches:
            verdict, status = "TZ_silent", "tz_silent"
        else:
            verdict, status = "?", "unknown"
        out.append({
            "anchor_id": anchor_id,
            "severity": sev,
            "description": desc,
            "tz_mention_count": len(tz_matches),
            "tz_mention_sample": list(tz_matches)[:3],
            "items_keyword_hit": items_hit,
            "status": status,
            "verdict": verdict,
        })
    return out


# ── Reuse v1 sections ──────────────────────────────────────────────────────
def run_v1_sections(items: list[dict], sub_doc: dict, tz_dir: Path) -> dict:
    trades = sub_doc.get("trades", {})

    # Section A
    tkp_hist = Counter()
    tkp_samples: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        code = it.get("urs_code_proposed") or it.get("urs_code_family_6digit")
        d = str(code)[0] if code and str(code)[0].isdigit() else "?"
        tkp_hist[d] += 1
        if len(tkp_samples[d]) < 3:
            tkp_samples[d].append({"id": it["id"], "popis": it["popis"][:80]})
    tkp_coverage = []
    for d, label in TKP_FAMILIES.items():
        n = tkp_hist.get(d, 0)
        tkp_coverage.append({
            "tkp_family": d, "label": label, "n_items": n,
            "samples": tkp_samples.get(d, []),
            "gap_flag": (n == 0),
        })

    # Section B
    trade_hits = Counter(it.get("subdodavatel") for it in items)
    sub_coverage = []
    for trade_id, meta in trades.items():
        if trade_id == "needs_mapping":
            continue
        sub_coverage.append({
            "trade": trade_id, "label_cz": meta.get("label_cz", ""),
            "n_items": trade_hits.get(trade_id, 0),
            "kapitoly_expected": meta.get("kapitoly", []),
            "gap_flag": trade_hits.get(trade_id, 0) == 0,
        })

    # Section C
    anchor_results = []
    for anchor_id, label, tokens, app_key in RD_ANCHORS:
        applicable = APPLICABILITY.get(app_key, True) if app_key else True
        if not applicable:
            anchor_results.append({"anchor_id": anchor_id, "label": label,
                                   "applicable": False, "status": "n_a",
                                   "n_hits": 0, "sample_ids": []})
            continue
        hits = match_anchor(items, tokens)
        anchor_results.append({
            "anchor_id": anchor_id, "label": label, "applicable": True,
            "status": "ok" if hits else "missing",
            "n_hits": len(hits),
            "sample_ids": [h["id"] for h in hits[:3]],
        })

    return {
        "A": {"coverage": tkp_coverage, "n_orphans": tkp_hist.get("?", 0)},
        "B": {"coverage": sub_coverage},
        "C": {"anchors": anchor_results},
        "D": {"_note": "v1 TZ verb scan kept in items_completeness_audit.json — de-prioritized in v2 (high noise)"},
    }


# ── Consolidated gaps ─────────────────────────────────────────────────────
def consolidate_gaps(v1_sections, e_matrix, f_matrix, g_chains, h_balance, j_deep) -> list[dict]:
    gaps = []
    gid = 1

    def add(severity, description, fix_action, source):
        nonlocal gid
        gaps.append({
            "id": f"GAP_{gid:03d}",
            "severity": severity,
            "description": description,
            "fix_action": fix_action,
            "source_section": source,
        })
        gid += 1

    # A — TKP gaps. TKP 8 (venkovní trubní vedení) marked N/A per project: TZ B
    # Souhrnná states 'Stávající vodovodní + kanalizační přípojka, plyn zaslepen'
    # — žádné nové venkovní rozvody potřeba.
    TKP_NA_PER_PROJECT = {"8": "TZ B Souhrnná: stávající vodovodní + kanalizační přípojka, plyn zaslepen — žádné nové venkovní rozvody"}
    for c in v1_sections["A"]["coverage"]:
        if c["gap_flag"]:
            if c["tkp_family"] in TKP_NA_PER_PROJECT:
                continue  # skipped — N/A per project metadata
            sev = "medium" if c["tkp_family"] in ("5", "0") else "important"
            add(sev, f"TKP {c['tkp_family']} ({c['label']}) — žádné položky",
                f"Verify TZ for {c['label']} need; if applicable, add items; if N/A, document reason",
                "A.TKP")

    # B — subdodavatel gaps
    for s in v1_sections["B"]["coverage"]:
        if s["gap_flag"]:
            add("medium", f"Trade '{s['trade']}' ({s['label_cz']}) bez položek",
                f"Verify if trade applicable; if yes, add items for {', '.join(s['kapitoly_expected']) or 'relevant kapitola'}",
                "B.Subdodavatel")

    # C — anchor missing
    for a in v1_sections["C"]["anchors"]:
        if a["status"] == "missing":
            add("important", f"Anchor {a['anchor_id']} {a['label']} — no items match keywords",
                "Verify in TZ; add item or refine search keywords if false-positive",
                "C.Anchor")

    # E — per-podlaží gaps
    for podlazi, row in e_matrix.items():
        for elem, st in row.items():
            if st.get("status") == "GAP":
                add("critical" if elem in ("podlaha", "omítka_stěn") else "important",
                    f"Per-podlaží {podlazi} / {elem} — GAP",
                    f"Add item for {elem} v {podlazi} OR mark N/A with TZ citation",
                    "E.PerPodlazi")

    # F — per-room critical gaps (koupelna without obklad etc.)
    for room in f_matrix:
        for attr, st in room["attrs"].items():
            if st.get("status") == "GAP":
                sev = "critical" if (room["type"] == "koupelna" and attr in ("obklad", "podlaha", "vytápěcí_prvek")) \
                    else "important" if attr in ("podlaha", "okno") else "medium"
                add(sev, f"Room {room['room_id']} {room['name']} ({room['type']}) / {attr} — GAP",
                    f"Add room-specific {attr} item OR confirm per-floor coverage in items.json",
                    "F.PerRoom")

    # G — cross-element issues
    for chain_name, chain in g_chains.items():
        v = chain.get("verdict", "")
        if v != "OK" and not v.startswith("OK"):
            add("important", f"Cross-element chain '{chain_name}' — {v}",
                f"Reconcile {chain_name} counts/quantities across items vs DXF baseline",
                f"G.{chain_name}")

    # H — material balance
    for cat in ("podlahy", "fasada_etics", "steny_vnitrni"):
        block = h_balance.get(cat, {})
        v = block.get("verdict", "OK")
        if v != "OK" and not v.startswith("OK"):
            add("important", f"Material balance '{cat}' — {v}",
                f"Reconcile m² totals across items in {cat}",
                f"H.{cat}")

    # J — TZ deep anchor gaps
    for a in j_deep:
        if a.get("status") == "gap":
            add(a["severity"], f"TZ deep anchor {a['anchor_id']} {a['description']} — TZ mentions but items don't",
                f"Add corresponding item OR verify it's collapsed in aggregate",
                f"J.{a['anchor_id']}")

    # Sort by severity
    sev_order = {"critical": 0, "important": 1, "medium": 2, "informational": 3}
    gaps.sort(key=lambda g: sev_order.get(g["severity"], 9))
    return gaps


def main() -> int:
    print(f"[1/8] Loading data ...", file=sys.stderr)
    items = json.loads(ITEMS_JSON.read_text())["items"]
    sub_doc = json.loads(SUBDOD_JSON.read_text())
    dxf = json.loads(DXF_JSON.read_text())["dum_DPZ"]

    print(f"[2/8] Sections A-D (v1, reused) ...", file=sys.stderr)
    v1 = run_v1_sections(items, sub_doc, TZ_DIR)

    print(f"[3/8] Section E — per-podlaží matrix ...", file=sys.stderr)
    e_matrix = section_E_per_podlazi(items)

    print(f"[4/8] Section F — per-room matrix (25 rooms × 9 attrs) ...", file=sys.stderr)
    rooms = dxf.get("mistnosti", {}).get("rooms", [])
    f_matrix = section_F_per_room(items, rooms)

    print(f"[5/8] Section G — cross-element consistency (4 chains) ...", file=sys.stderr)
    g_chains = section_G_cross_element(items, dxf)

    print(f"[6/8] Section H — material balance (3 categories) ...", file=sys.stderr)
    h_balance = section_H_material_balance(items, dxf)

    print(f"[7/8] Section I — cost ratio sanity (Methvin estimates) ...", file=sys.stderr)
    i_cost = section_I_cost_ratio(items)

    print(f"[8/8] Section J — TZ deep scan (18 anchors) ...", file=sys.stderr)
    j_deep = section_J_tz_deep_scan(items, TZ_DIR)

    # Consolidated gaps
    consolidated = consolidate_gaps(v1, e_matrix, f_matrix, g_chains, h_balance, j_deep)

    # ── Output JSON ────────────────────────────────────────────────────────
    out = {
        "_schema_version": "2.0",
        "_generated_at": TODAY,
        "_generated_by": "tools/completeness_check_v2.py",
        "_items_total": len(items),
        "_rooms_total": len(rooms),
        "_sections_present": ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
        "section_A_tkp_coverage": v1["A"],
        "section_B_subdodavatel": v1["B"],
        "section_C_anchors": v1["C"],
        "section_D_tz_verbs": {"_see_v1": "outputs/items_completeness_audit.json"},
        "section_E_per_podlazi": e_matrix,
        "section_F_per_room": f_matrix,
        "section_G_cross_element": g_chains,
        "section_H_material_balance": h_balance,
        "section_I_cost_ratio": i_cost,
        "section_J_tz_deep_scan": j_deep,
        "consolidated_gaps": consolidated,
        "_gap_severity_counts": dict(Counter(g["severity"] for g in consolidated)),
    }
    OUT_JSON.write_text(json.dumps(out, indent=2, ensure_ascii=False))

    # ── Output report ──────────────────────────────────────────────────────
    md = [
        f"# Completeness Audit v2 — RD Jáchymov",
        f"",
        f"**Generated:** {TODAY}",
        f"**Items:** {len(items)} | **Rooms:** {len(rooms)} | **Sections:** A–J (10)",
        f"",
        f"> Tato kontrola dělá strukturovaný sweep po 10 osách. Cíl: poskytnout worksheet kde",
        f"> uživatel vidí potenciální mezery. Není garance úplnosti.",
        f"",
        f"## Consolidated gap list (sorted by severity)",
        f"",
        f"**Severity breakdown:** " + " · ".join(f"{k}={v}" for k, v in
            sorted(Counter(g["severity"] for g in consolidated).items(),
                   key=lambda x: ["critical","important","medium","informational"].index(x[0]) if x[0] in ["critical","important","medium","informational"] else 9)),
        f"",
        f"| ID | Sev | Description | Fix action | Source |",
        f"|---|---|---|---|---|",
    ]
    for g in consolidated:
        sev_icon = {"critical": "🟥", "important": "🟧", "medium": "🟨", "informational": "⚪"}.get(g["severity"], "❓")
        md.append(f"| {g['id']} | {sev_icon} {g['severity']} | {g['description'][:90]} | {g['fix_action'][:80]} | {g['source_section']} |")

    # Section E table
    md.extend([
        "", "---", "", "## Section E — Per-podlaží matrix (4 × 7)",
        "",
        "| Podlaží | podlaha | soklíky | omítka | výmalba | strop | svítidla | topení |",
        "|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|",
    ])
    for podlazi in ["1.PP", "1.NP", "2.NP", "3.NP"]:
        row_cells = []
        for elem in PODLAZI_ELEMENTS:
            st = e_matrix[podlazi][elem]["status"]
            icon = {"✓": "✓", "GAP": "❌", "PARTIAL": "⚠", "N/A": "⚪"}.get(st, st)
            row_cells.append(icon)
        md.append(f"| **{podlazi}** | " + " | ".join(row_cells) + " |")

    # Section F summary (per room — abbreviated table, gaps only in detailed list)
    md.extend(["", "---", "", "## Section F — Per-room matrix (25 × 9)", "",
               "Legend: ✓=hit | flr=covered_at_floor_level | glb=covered_globally | ⚪=N/A | ❌=GAP",
               "",
               "| Room | Typ | Podl | pod | sok | om | vým | obkl | dv | okno | strop | top |",
               "|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|"])
    for r in f_matrix:
        cells = []
        for a in ROOM_ATTRS:
            st = r["attrs"][a]["status"]
            cell = {"✓": "✓", "OK_PER_FLOOR": "flr", "OK_GLOBAL": "glb",
                    "N/A": "⚪", "GAP": "❌"}.get(st, st[:3])
            cells.append(cell)
        md.append(f"| {r['room_id']} {r['name'][:18]} | {r['type'][:8]} | {r['podlazi']} | " + " | ".join(cells) + " |")

    # Section G
    md.extend(["", "---", "", "## Section G — Cross-element consistency (4 chains)", ""])
    for chain, data in g_chains.items():
        md.append(f"### G.{chain}")
        md.append("")
        md.append(f"**Verdict:** {data.get('verdict', '?')}")
        md.append("")
        for k, v in data.items():
            if k in ("verdict", "_note") or k.startswith("items_"):
                continue
            md.append(f"- `{k}` = `{v}`")
        if data.get("_note"):
            md.append(f"- _note: {data['_note']}_")
        md.append("")

    # Section H
    md.extend(["---", "", "## Section H — Material balance (3 categories)", ""])
    for cat, block in h_balance.items():
        md.append(f"### H.{cat}")
        md.append("")
        md.append(f"**Verdict:** {block.get('verdict', '?')}")
        md.append("")
        for k, v in block.items():
            if k.startswith("_") or k == "verdict":
                continue
            md.append(f"- `{k}` = `{v}`")
        md.append("")

    # Section I
    md.extend(["---", "", "## Section I — Cost ratio sanity (Methvin estimates)", "",
               f"**Total estimate:** {i_cost.get('total_estimate_czk', 0):,.0f} Kč (ballpark)",
               "",
               "| Gate | Estimate Kč | % of total | Typical range | Verdict |",
               "|---|--:|--:|---|---|"])
    for g in i_cost.get("per_gate_breakdown", []):
        lo, hi = g["typical_range_pct"]
        md.append(f"| {g['gate']} | {g['estimate_czk']:,.0f} | {g['pct_of_total']*100:.1f}% | {lo*100:.0f}–{hi*100:.0f}% | {g['verdict']} |")

    # Section J
    md.extend(["", "---", "", "## Section J — TZ deep scan (18 anchors)", "",
               "| ID | Sev | Description | TZ ks | Items? | Verdict |",
               "|---|---|---|--:|:--:|---|"])
    for a in j_deep:
        icon = {"covered": "✓", "gap": "❌", "tz_silent": "⚪"}.get(a.get("status"), "?")
        md.append(f"| {a['anchor_id']} | {a['severity']} | {a['description'][:50]} | {a['tz_mention_count']} | {icon} | {a['verdict'][:50]} |")

    # Sections A-D summary (compact, refer to v1)
    md.extend(["", "---", "", "## Sections A–D — see also v1 audit (outputs/items_completeness_report.md)",
               "", f"- A. TKP coverage: {sum(1 for c in v1['A']['coverage'] if not c['gap_flag'])} of {len(v1['A']['coverage'])} families",
               f"- B. Subdodavatel: {sum(1 for s in v1['B']['coverage'] if not s['gap_flag'])} of {len(v1['B']['coverage'])} trades",
               f"- C. RD anchors: {sum(1 for a in v1['C']['anchors'] if a['status']=='ok')} ok / {sum(1 for a in v1['C']['anchors'] if a['status']=='missing')} missing / {sum(1 for a in v1['C']['anchors'] if a['status']=='n_a')} N/A",
               f"- D. TZ verb scan: deprioritized — see v1 (high noise)"])

    OUT_MD.write_text("\n".join(md))
    print(
        f"\n✓ {OUT_JSON.relative_to(PROJ)} ({OUT_JSON.stat().st_size:,} bytes)\n"
        f"✓ {OUT_MD.relative_to(PROJ)} ({OUT_MD.stat().st_size:,} bytes)\n"
        f"\nConsolidated gaps: {len(consolidated)} ("
        + " · ".join(f"{k}={v}" for k, v in
            sorted(Counter(g['severity'] for g in consolidated).items(),
                   key=lambda x: ['critical','important','medium','informational'].index(x[0]) if x[0] in ['critical','important','medium','informational'] else 9))
        + ")",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
