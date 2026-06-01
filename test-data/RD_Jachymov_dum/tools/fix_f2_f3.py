#!/usr/bin/env python3
"""
F2 + F3 (2026-06-01) — ChatGPT section-audit fixes.

F2 — duplicate demontáž oken/dveří FIX:
  HSV6.010 "Demontáž všech oken a dveří" (aggregate, 25 ks) double-counts the detailed
  HSV6.013 (okna 16) + HSV6.014 (vstupní 2) + HSV6.015 (vnitřní 15) = 33 ks. Aggregate
  also UNDERcounts (25 < 33). Remove aggregate, keep detailed (per ChatGPT — detail wins).
  No atomic entry, no cross-ref → clean delete. items 234 → 233.

F3 — pažení sklad VERIFY → vyjasnění #33 (NOT a blind change):
  Sklad statika (D.2.1) explicitly: "Stavební jáma bude svahovaná. Přípustný sklon
  dočasných výkopů 1:0,5" → sklad cut solved by SVAHOVÁNÍ (battering), NOT pažení.
  HSV1.006 pažení hl. do 2 m is DŮM, not sklad → no contradiction. Open point: verify
  výkop volume accounts for 1:0,5 battering in prudký svah + utility-trench pažení BOZP.

F1 (code 411321414 ×8) — SKIPPED per decision (legit code-sharing, not a bug).
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "outputs" / "items_rd_jachymov_complete.json"
QUEUE = ROOT / "inputs" / "meta" / "vyjasneni_queue.json"

V33 = {
    "id": 33, "severity": "minor", "status": "open", "category": "vykop_verify_statika",
    "title": "Sklad výkop — svahovaná jáma 1:0,5 v prudkém svahu (hloubka >2 m)",
    "context": "Sklad je zasazen do prudkého svahu. Statika D.2.1: 'Stavební jáma bude svahovaná, přípustný sklon dočasných výkopů 1:0,5 (F4)' — řešeno SVAHOVÁNÍM, ne pažením (HSV1.006 pažení do 2 m je DŮM). Sklad jámy jsou nezapažené (správně). Otevřené: zda objem hloubení 260217_sklad.HSV1.002 zahrnuje přídavek za svahování 1:0,5 a zda je v prudkém svahu dostupný dočasný zábor/prostor pro svah.",
    "blocks": ["260217_sklad.HSV1.002 hloubení jam (objem vs svahování)"],
    "working_assumption": "Jáma svahovaná 1:0,5 (statika). Pažení sklad NEPŘIDÁNO. Rýhy přípojek pažit dle BOZP.",
    "next_action": "Statiku/projektante: potvrďte, že objem výkopu skladu počítá se svahováním 1:0,5 + je dostupný prostor pro svah v prudkém svahu; pažení jen rýhy přípojek dle BOZP?",
    "_source": "D.2.1 TZ statika sklad §4.2 + ChatGPT review 2026-06-01",
}


def main():
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    before = len(data["items"])
    data["items"] = [i for i in data["items"] if i["id"] != "260219_dum.HSV6.010"]
    removed = before - len(data["items"])

    # note on the detailed survivor for audit trail
    for i in data["items"]:
        if i["id"] == "260219_dum.HSV6.013":
            i["notes"] = ((i.get("notes") or "") +
                          " | F2: agregát HSV6.010 odstraněn (double-count); demontáž oken/dveří detailně = HSV6.013 (16 oken) + HSV6.014 (2 vstupní) + HSV6.015 (15 vnitřních) = 33 ks.").strip(" |")
            i["_audit_gap_fixed"] = "F2_DEDUP_DEMONTAZ_OKEN_2026-06-01"

    data["_f2_f3_log"] = {
        "applied_at": "2026-06-01", "f2_removed": ["260219_dum.HSV6.010"] if removed else [],
        "f3_vyjasneni": 33, "snapshot_before": "outputs/items_pre_f2f3.json",
        "items_total": len(data["items"]),
    }
    ITEMS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    q = json.loads(QUEUE.read_text(encoding="utf-8"))
    if V33["id"] not in {e["id"] for e in q["items"]}:
        q["items"].append(V33)
    QUEUE.write_text(json.dumps(q, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"OK — F2 removed {removed} (HSV6.010), F3 vyjasnění #33 added. "
          f"items_total={len(data['items'])}, queue={len(q['items'])}.")


if __name__ == "__main__":
    main()
