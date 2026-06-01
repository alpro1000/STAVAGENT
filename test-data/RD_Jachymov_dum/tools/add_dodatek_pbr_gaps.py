#!/usr/bin/env python3
"""
Dodatek PD č.1 + PBŘ + B zpráva gaps (2026-06-01) — N1-N6 + vyjasnění V5.

Source-verified: Dodatek PD č.1 (E.01) CONFIRMED real document (DI PČR požadavek,
napojení na komunikaci + rozhledové trojúhelníky + vjezdová brána). Stavba dodatku =
"Zahradní sklad a přístupové schodiště" → N1-N3 patří objektu 260217_sklad.

N1 vjezd Dvořákova (sklad): napojení betonová dlažba + spádování + odvodnění na pozemek
N2 vjezdová brána (sklad)
N3 rozhledové trojúhelníky vytyčení/kontrola (sklad VRN)
N4 VZT lokální odtah digestoří 2 kuchyně (dům)
N5 TOTAL STOP hlavní vypínač + požární značení (dům elektro)
N6 předávací protokol krbu (dům PBŘ; revize spalin už PSV73.007 — nedublovat)
V5 vyjasnění: topení TČ vzduch-vzduch (PSV73.005/006) vs vzduch/voda v B zprávě

P41 split (N1 atomic), _source P29, family/blank P26, qty OVĚŘIT kde geometrie / null kde ne.
items 228 → 234.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "outputs" / "items_rd_jachymov_complete.json"
QUEUE = ROOT / "inputs" / "meta" / "vyjasneni_queue.json"


def mk(id_, objekt, kap, sub, popis, mj, qty, formula, conf, src, subdod, hint,
       qty_status=None, vref=None, notes=None, dq="catalog_estimate", group="HSV", gate="HSV"):
    d = {
        "objekt": objekt, "kapitola_group": group, "_gate": gate, "kapitola": kap,
        "subkapitola": sub, "popis": popis, "mj": mj, "mnozstvi": qty,
        "mnozstvi_formula": formula, "mnozstvi_confidence": conf,
        "urs_code_proposed": None, "urs_status": "needs_production_lookup", "urs_confidence": 0.0,
        "urs_kapitola_hint": hint,
        "source": src, "subdodavatel": subdod, "subdodavatel_status": "mapped",
        "vyjasneni_ref": (vref or []), "status_flag": "ready_for_phase2",
        "notes": notes, "_data_quality": dq, "id": id_, "realizuje_skladbu": [],
        "_audit_gap_fixed": "DODATEK_PBR_GAPS_2026-06-01",
    }
    if qty_status:
        d["mnozstvi_status"] = qty_status
    return d


NEW = [
    # N1 — vjezd Dvořákova (SKLAD) — qty null (plocha dle situace, OVĚŘIT)
    mk("260217_sklad.HSV5.002", "260217_sklad", "HSV-5 Komunikace + vjezd",
       "Vjezd Dvořákova — napojení na komunikaci",
       "Napojení vjezdu na ulici Dvořákova — vydláždění z betonových dlaždic + spádování na pozemek investora + odvodnění dešťové vody na pozemek (ne na komunikaci)",
       "m²", None, "neurčeno — plocha napojení dle situace C.3.R1, OVĚŘIT", 0.0,
       "Dodatek PD č.1 (E.01) / DI PČR požadavek", "komunikace", "HSV 5 Komunikace pozemní — dlažby",
       qty_status="neurčeno — plocha dle situace C.3.R1, OVĚŘIT", notes="KRITICKÉ — požadavek DI PČR.",
       dq="awaiting_situace"),
    # N2 — vjezdová brána (SKLAD)
    mk("260217_sklad.PSV76.002", "260217_sklad", "PSV-76 Zámečnictví",
       "Vjezdová brána",
       "Vjezdová brána na pozemku investora (ocelová) — dodávka + montáž", "ks", 1,
       "= 1 brána (Dodatek PD č.1)", 0.6, "Dodatek PD č.1 (E.01)", "zamecnik",
       "PSV 767 zámečnické konstrukce", notes="OVĚŘIT rozměr/typ brány u projektanta.", group="PSV", gate="PSV"),
    # N3 — rozhledové trojúhelníky (SKLAD VRN)
    mk("260217_sklad.VRN.003", "260217_sklad", "VRN — Geodet / PČR",
       "Rozhledové trojúhelníky — vytyčení + kontrola",
       "Vytyčení + kontrola rozhledových trojúhelníků (Vn=40 km/h, Dz=25 m) dle požadavku DI PČR", "soubor", 1,
       "= 1 soubor (Dodatek PD č.1)", 0.7, "Dodatek PD č.1 (E.01) / DI PČR", "geodet",
       "VRN geodetické + zaměřovací práce", group="VRN", gate="VRN"),
    # N4 — VZT digestoře (DŮM)
    mk("260219_dum.M24.001", "260219_dum", "M-24 VZT",
       "Lokální odtah digestoří kuchyní",
       "Lokální odtah digestoří kuchyní (1.NP + 3.NP) — dodávka + montáž digestoře + prostup fasádou/střechou + zpětná klapka", "ks", 2,
       "= 2 kuchyně (1.06 byt rodičů + 3.05 byt podkroví)", 0.7,
       "B zpráva — VZT: obytné místnosti větrání okny, kuchyně lokální odtah digestoří", "vzduchotechnik",
       "M / 751 vzduchotechnika — odtah digestoře", group="M", gate="M"),
    # N5 — TOTAL STOP + požární značení (DŮM elektro)
    mk("260219_dum.M21.008", "260219_dum", "M-21 ELI silnoproud",
       "Hlavní vypínač TOTAL STOP + požární značení",
       "Hlavní vypínač elektrické energie TOTAL STOP + požární značení rozvodného zařízení a uzávěrů (voda/elektro)", "soubor", 1,
       "= 1 soubor (PBŘ)", 0.8, "PBŘ D.3 §16.05/16.06", "elektrikar",
       "M 21 elektroinstalace — hlavní vypínač + značení", group="M", gate="M"),
    # N6 — předávací protokol krbu (DŮM PBŘ)
    mk("260219_dum.PSV95.003", "260219_dum", "PSV-95 Detekce požární",
       "Předávací protokol krbu + kontrola bezpečných vzdáleností",
       "Předávací protokol krbu na tuhá paliva + kontrola bezpečných vzdáleností (800 mm směr sálání / 400 mm strany, nehořlavá zóna podlahy) dle PBŘ", "soubor", 1,
       "= 1 soubor (PBŘ)", 0.8, "PBŘ D.3", "topenar",
       "VRN doklady / revize požární", notes="Revize spalinové cesty NEDUBLOVAT — již PSV73.007.",
       group="PSV", gate="PSV"),
]

V5 = {
    "id": 32, "severity": "major", "status": "open", "category": "rozpor_PD_verify_projektant",
    "title": "Rozpor v B zprávě — systém vytápění (TČ vzduch-vzduch vs vzduch/voda)",
    "context": "B zpráva uvádí na jednom místě TČ vzduch-vzduch / multisplit s vnitřními jednotkami (= items PSV73.005/006), jinde TČ vzduch/voda. To jsou DVA různé systémy (multisplit vs otopná voda/radiátory). Cena i rozvody se liší.",
    "blocks": ["PSV73.005 multisplit venkovní j.", "PSV73.006 multisplit vnitřní j.", "PSV73.008 rozvody otopné"],
    "working_assumption": "Ponecháno TČ vzduch-vzduch / multisplit (PSV73.005/006) dle převažující části B zprávy.",
    "next_action": "Projektante: potvrďte systém vytápění — TČ vzduch-vzduch (multisplit, bez otopné vody) NEBO TČ vzduch/voda (radiátory/podlahovka)? Ovlivní PSV73 + rozvody.",
    "_source": "B zpráva crosscheck 2026-06-01 (ChatGPT review)",
}


def main():
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    ids = {i["id"] for i in data["items"]}
    added = 0
    for it in NEW:
        if it["id"] in ids:
            print("skip dup", it["id"]); continue
        data["items"].append(it); added += 1
    data["_dodatek_pbr_log"] = {
        "applied_at": "2026-06-01", "added_items": added,
        "snapshot_before": "outputs/items_pre_dodatek_pbr.json",
        "items_total": len(data["items"]),
    }
    ITEMS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    q = json.loads(QUEUE.read_text(encoding="utf-8"))
    if V5["id"] not in {e["id"] for e in q["items"]}:
        q["items"].append(V5)
    QUEUE.write_text(json.dumps(q, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"OK — added {added} items (N1-N6) + V5. items_total={len(data['items'])}, queue={len(q['items'])}.")


if __name__ == "__main__":
    main()
