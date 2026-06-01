#!/usr/bin/env python3
"""
Skladby gaps generation (2026-06-01) — Commit 1 of 2.

Adds 12 položek from skladby_audit.md (approved gaps), fixes D2 drift, adds 4 vyjasnění.
Schema-fix (duplicate id renumber, Pattern 28) is a SEPARATE second pass.

NÁVRH gaps → konstrukční (montáž/materiál split in atomic_decomposition.py, P41):
  G2 S07: kročejová izolace 30mm + separační geotextilie       (59.5 m²)
  G3 S09: minerální vata výplň 180/200mm mezi ocel. nosníky    (104.4 m²)
  G5 S10: pojistná HI folie pod Al krytinu                      (140.94 m²)
  G1 S03: sanační zateplení soklu + nopová folie + provětr.sokl (23 m² ODHAD obvod×výška, OVĚŘIT)
  S08:    Fermacell 25 + kročejová 30 + suchý podsyp+rošt 50 + separační (qty=NULL neurčeno, V1)
BOURÁNÍ gap → demontáž:
  BR2 S03: demontáž vnějšího keram. obkladu suterénu            (23 m² ODHAD, OVĚŘIT)
Fix:
  D2 S09: PSV71.002(TI) kročejová 30→40 mm (text authoritative; + tag realizuje S09)
Vyjasnění (ids 28-31): V1 S08 plocha, V2 S12 omítka, BR1 otlučení omítek, D1 S05 deska.

P26: family-kód kde znám / null jinak (žádný wrong-leaf). P29: _source per item.
items 216 → 228.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "outputs" / "items_rd_jachymov_complete.json"
QUEUE = ROOT / "inputs" / "meta" / "vyjasneni_queue.json"

OBVOD = 38.7   # m — obvod domu z ETICS
H_SOKL = 0.6   # m — výška soklu z Řez A-A tagů (-0.200 … -0.975)
SOKL_M2 = round(OBVOD * H_SOKL)   # = 23 m²

def base(id_, kap, sub, popis, mj, qty, formula, conf, code, status, src, subdod,
         skladba, gate="HSV", group="HSV", qty_status=None, vref=None, notes=None,
         dq="catalog_estimate", hint=None):
    d = {
        "objekt": "260219_dum", "kapitola_group": group, "_gate": gate, "kapitola": kap,
        "subkapitola": sub, "popis": popis, "mj": mj, "mnozstvi": qty,
        "mnozstvi_formula": formula, "mnozstvi_confidence": conf,
        "urs_code_proposed": code,
        "urs_status": status, "urs_confidence": (0.0 if code is None else 0.6),
        "source": src, "subdodavatel": subdod, "subdodavatel_status": "mapped",
        "vyjasneni_ref": (vref or []), "status_flag": "ready_for_phase2",
        "notes": notes, "_data_quality": dq, "id": id_,
        "realizuje_skladbu": [skladba], "_audit_gap_fixed": "SKLADBY_GAPS_2026-06-01",
    }
    if qty_status: d["mnozstvi_status"] = qty_status
    if hint: d["correct_code_hint"] = hint
    return d

NEW = [
    # ---- G2 S07 (59.5 m²) ----
    base("260219_dum.HSV4.015", "HSV-4 Vodorovné", "Strop 1.NP/2.NP — kročejová izolace (S07)",
         "Desky kročejové izolace (Isover T-P) tl. 30 mm — trámový strop 1.NP/2.NP", "m²", 59.5,
         "= plocha stropu S07 (skladby_per_zone)", 0.75, "713191",
         "family_only", "skladba S07 návrh — kročejová Isover T-P 30 mm", "izolater_TI", "S07",
         hint="ÚRS 713 izolace tepelné/akustické podlah — leaf needs production lookup"),
    base("260219_dum.HSV4.016", "HSV-4 Vodorovné", "Strop 1.NP/2.NP — separační geotextilie (S07)",
         "Separační geotextilie pod suchý podsyp — trámový strop 1.NP/2.NP", "m²", 59.5,
         "= plocha stropu S07", 0.7, None,
         "needs_production_lookup", "skladba S07 návrh — separační geotextilie", "izolater_TI", "S07",
         hint="ÚRS 711 geotextilie separační — leaf needs lookup"),
    # ---- G3 S09 (104.4 m²) ----
    base("260219_dum.HSV4.017", "HSV-4 Vodorovné", "Strop 2.NP/3.NP — min. vata výplň mezi nosníky (S09)",
         "Tepelná/akustická izolace minerální vata výplň mezi ocelové nosníky stropu 2.NP/3.NP, tl. 180/200 mm", "m²", 104.4,
         "= plocha stropu S09 (skladby_per_zone)", 0.75, "713121",
         "family_only", "skladba S09 návrh — min. vata výplň 180/200 mm", "izolater_TI", "S09",
         hint="ÚRS 713121 izolace tepelné — leaf needs lookup"),
    # ---- S08 (qty=NULL, vyjasnění V1=28) ----
    base("260219_dum.HSV4.018", "HSV-4 Vodorovné", "Strop klemba mezi patry — Fermacell (S08)",
         "Roznášecí sádrovláknité dílce Fermacell 2E22 tl. 25 mm — suchá skladba nad cihelnou klembou S08", "m²", None,
         "neurčeno — plocha S08 nepřiřazena", 0.0, None,
         "needs_production_lookup", "skladba S08 legenda (řez nepretíná, plocha nepřiřazena)", "suchá_vystavba", "S08",
         qty_status="neurčeno — plocha nepřiřazena, řez nepretíná", vref=[28],
         notes="VYJASNĚNÍ V1 — práce zachována, plocha čeká na projektanta.",
         dq="awaiting_projektant", hint="ÚRS 776/713 suchá skladba — leaf po potvrzení plochy"),
    base("260219_dum.HSV4.019", "HSV-4 Vodorovné", "Strop klemba mezi patry — kročejová izolace (S08)",
         "Desky kročejové izolace (Isover T-P) tl. 30 mm — suchá skladba nad klembou S08", "m²", None,
         "neurčeno — plocha S08 nepřiřazena", 0.0, "713191",
         "needs_production_lookup", "skladba S08 legenda", "izolater_TI", "S08",
         qty_status="neurčeno — plocha nepřiřazena, řez nepretíná", vref=[28],
         notes="VYJASNĚNÍ V1.", dq="awaiting_projektant"),
    base("260219_dum.HSV4.020", "HSV-4 Vodorovné", "Strop klemba mezi patry — suchý podsyp + dřevěný rošt (S08)",
         "Vyrovnávací suchý podsyp keramzit/liapor + dřevěný rošt tl. 50 mm — nad klembou S08", "m²", None,
         "neurčeno — plocha S08 nepřiřazena", 0.0, None,
         "needs_production_lookup", "skladba S08 legenda", "suchá_vystavba", "S08",
         qty_status="neurčeno — plocha nepřiřazena, řez nepretíná", vref=[28],
         notes="VYJASNĚNÍ V1.", dq="awaiting_projektant"),
    base("260219_dum.HSV4.021", "HSV-4 Vodorovné", "Strop klemba mezi patry — separační vrstva (S08)",
         "Separační vrstva pod suchý podsyp — nad cihelnou klembou S08", "m²", None,
         "neurčeno — plocha S08 nepřiřazena", 0.0, None,
         "needs_production_lookup", "skladba S08 legenda", "suchá_vystavba", "S08",
         qty_status="neurčeno — plocha nepřiřazena, řez nepretíná", vref=[28],
         notes="VYJASNĚNÍ V1. Cihelná klemba 150 mm = STÁVAJÍCÍ (zachováno, bez položky).",
         dq="awaiting_projektant"),
    # ---- G1 S03 sokl (23 m² ODHAD, OVĚŘIT) ----
    base("260219_dum.HSV7.007", "HSV-7 Fasáda + zateplení", "Sokl suterénu — sanační zateplení (S03)",
         "Sanační zateplení soklu — sanační izolační deska Styrcon 200 + lepící tmel (Lepstyr plus) + armovací vrstva s tkaninou + penetrace", "m²", SOKL_M2,
         f"= obvod {OBVOD} m × výška soklu {H_SOKL} m ≈ {SOKL_M2} m²", 0.5, None,
         "needs_production_lookup", "Řez A-A sokl tags (S03b -0.200/-0.975) + obvod ETICS", "fasader", "S03",
         qty_status=f"odhad z obvodu {OBVOD} m × výška soklu {H_SOKL} m — OVĚŘIT", vref=[],
         notes="OVĚŘIT plochu soklu dle skutečné výšky odkopu.", hint="ÚRS 711/783 sanační deska — leaf needs lookup"),
    base("260219_dum.HSV7.008", "HSV-7 Fasáda + zateplení", "Sokl pod terénem — drenážní nopová folie (S03a)",
         "Drenážní vrstva — nopová folie tl. 20 mm na suterénní stěnu pod úrovní terénu", "m²", SOKL_M2,
         f"= obvod {OBVOD} m × výška pod terénem ≈ {SOKL_M2} m²", 0.5, None,
         "needs_production_lookup", "Řez A-A/C-C sokl + obvod ETICS", "izolater_HI", "S03",
         qty_status=f"odhad z obvodu × výška — OVĚŘIT", vref=[],
         notes="OVĚŘIT plochu pod terénem.", hint="ÚRS 711 nopová folie drenážní — leaf needs lookup"),
    base("260219_dum.HSV7.009", "HSV-7 Fasáda + zateplení", "Sokl nad terénem — provětraný obklad (S03b)",
         "Provětrávaná mezera s kotevním roštem 40 mm + keramický obklad 20 mm — sokl nad úrovní terénu", "m²", SOKL_M2,
         f"= obvod {OBVOD} m × výška soklu nad terénem ≈ {SOKL_M2} m²", 0.5, None,
         "needs_production_lookup", "Řez A-A sokl tags S03b + obvod ETICS", "obkladac", "S03",
         qty_status=f"odhad z obvodu × výška — OVĚŘIT", vref=[],
         notes="OVĚŘIT plochu + rozsah provětraného soklu.", hint="ÚRS 781 obklady keramické + rošt — leaf needs lookup"),
    # ---- G5 S10 pojistná HI (140.94 m²) ----
    base("260219_dum.HSV5.018", "HSV-5 Krov + střecha", "Střecha — pojistná HI folie pod Al krytinu (S10)",
         "Pojistná hydroizolační folie pod hliníkovou falcovanou krytinu (nad celoplošným bedněním)", "m²", 140.94,
         "= plocha střechy S10 (= PIR/bednění)", 0.75, None,
         "needs_production_lookup", "skladba S10 návrh — pojistná HI pod Al krytinu", "pokryvac", "S10",
         hint="ÚRS 712 povlakové krytiny / pojistná fólie — leaf needs lookup"),
    # ---- BR2 demontáž obkladu suterénu (23 m² ODHAD) ----
    base("260219_dum.HSV6.018", "HSV-6 Bourací práce", "Demontáž vnějšího keram. obkladu suterénu (S03 stávající)",
         "Demontáž stávajícího vnějšího keramického obkladu suterénní stěny (sokl) tl. 20 mm", "m²", SOKL_M2,
         f"= obvod {OBVOD} m × výška soklu {H_SOKL} m ≈ {SOKL_M2} m²", 0.5, None,
         "needs_production_lookup", "skladba S03 stávající (vnější keram. obklad) + Řez A-A sokl", "bourac", "S03",
         qty_status=f"odhad z obvodu × výška — OVĚŘIT", vref=[],
         notes="STÁVAJÍCÍ→bourání. OVĚŘIT plochu.", dq="catalog_estimate",
         hint="ÚRS 965/978 bourání obkladů — leaf needs lookup"),
]

VYJASNENI_NEW = [
    {"id": 28, "severity": "major", "status": "open", "category": "skladby_gap_verify_projektant",
     "title": "S08 strop cihelná klemba mezi patry — plocha / poloha",
     "context": "S08 je v legendě skladeb s plnou skladbou, ALE řez A-A ani B-B ji nepretíná (pretínají S07 trámový + S09 ocelobeton) a skladby_per_zone_v2.json jí nepřiřadil plochu (S06/S07/S09 plochu mají). Buď legenda generická (S08 se nepoužívá), nebo se použije v nesekcované oblasti.",
     "blocks": ["HSV4.018-021 suchá skladba S08 (qty=neurčeno)"],
     "working_assumption": "Práce HSV4.018-021 ZALOŽENY s qty=null. Cihelná klemba 150 = stávající.",
     "next_action": "Karle/projektante: má dům cihelnou klembu mezi patry (S08)? Pokud ano — kde (které místnosti) a jaká plocha m²? Doplníme množství.",
     "_source": "skladby_audit_2026-06-01 + Řez A-A/B-B vision"},
    {"id": 29, "severity": "minor", "status": "open", "category": "skladby_gap_verify_projektant",
     "title": "S12 podkroví — vnitřní omítka sádrová vs vápenocementová",
     "context": "Skladba S12 (obvodová stěna podkroví) předepisuje vnitřní omítku SÁDROVOU stříkanou, ale PSV78 v items.json je vápenocementová jádrová + štuk (globální).",
     "blocks": [], "working_assumption": "PSV78 vápenocementová ponechána.",
     "next_action": "Karle: v podkroví (3.NP) sádrová stříkaná omítka, nebo sjednotit na vápenocementovou?",
     "_source": "skladby_audit_2026-06-01"},
    {"id": 30, "severity": "minor", "status": "open", "category": "bourani_rozsah_verify_projektant",
     "title": "Otlučení stávajících vnitřních omítek (S01/S02/S03)",
     "context": "Skladby S01-S03 stávající mají vnitřní omítky 10-15 mm. items.json nemá položku otlučení vnitřních omítek (jen příprava fasády HSV7.001). Záleží na rozsahu rekonstrukce — soudržné omítky mohou zůstat.",
     "blocks": ["BR1 otlučení vnitřních omítek"],
     "working_assumption": "NEPŘIDÁNO (závisí na rozsahu — nevymýšlím plochu).",
     "next_action": "Karle: otloukají se vnitřní omítky kompletně, nebo zůstávají soudržné části? Pokud bourat → doplníme m².",
     "_source": "skladby_audit_2026-06-01"},
    {"id": 31, "severity": "minor", "status": "open", "category": "drift_verify_statika",
     "title": "S05 betonová deska 1.NP — 120 mm (skladba) vs 150 mm (statika/items)",
     "context": "Skladba S05 (návrh) uvádí betonovou desku vyztuženou 120 mm; items HSV2.012 má ŽB desku 150 mm (C25/30 XC2 + kari). Ponecháno 150 mm (statika vítězí nad skladbou).",
     "blocks": [], "working_assumption": "Ponecháno 150 mm dle HSV2.012 (statika).",
     "next_action": "Projektante/statiku: potvrdit tl. ŽB desky 1.NP (120 vs 150 mm).",
     "_source": "skladby_audit_2026-06-01"},
]

def main():
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    ids = {i["id"] for i in data["items"]}
    added = 0
    for it in NEW:
        if it["id"] in ids:
            print("skip dup", it["id"]); continue
        data["items"].append(it); added += 1
    # D2 fix: PSV71.002 TI kročejová 30→40 + tag S09
    d2 = 0
    for i in data["items"]:
        if i.get("subkapitola") == "Kročejová EPS nad ocelobeton":
            i["popis"] = i["popis"].replace("tl. 30 mm", "tl. 40 mm").replace("30 dB tl. 40", "30 dB tl. 40")
            i["realizuje_skladbu"] = ["S09"]
            i["_audit_gap_fixed"] = "D2_KROCEJOVA_30_to_40_2026-06-01"
            i["notes"] = ((i.get("notes") or "") + " | D2: tl. opraveno 30→40 mm dle skladby S09 (text authoritative).").strip(" |")
            d2 += 1
    data["_skladby_gaps_log"] = {
        "applied_at": "2026-06-01", "added_items": added, "d2_fixed": d2,
        "snapshot_before": "outputs/items_pre_skladby_gaps.json",
        "sokl_estimate_m2": SOKL_M2, "items_total": len(data["items"]),
    }
    ITEMS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # vyjasnění queue
    q = json.loads(QUEUE.read_text(encoding="utf-8"))
    qids = {e["id"] for e in q["items"]}
    qadded = 0
    for v in VYJASNENI_NEW:
        if v["id"] in qids: continue
        q["items"].append(v); qadded += 1
    QUEUE.write_text(json.dumps(q, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"OK — added {added} items (D2 fixed {d2}), +{qadded} vyjasnění. items_total={len(data['items'])}, queue={len(q['items'])}.")

if __name__ == "__main__":
    main()
