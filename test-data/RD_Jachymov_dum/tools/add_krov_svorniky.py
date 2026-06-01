#!/usr/bin/env python3
"""
Add krov fasteners item (2026-05-31) — spojovací prostředky krovu (svorníky/šrouby).

Closes the "spojovací prostředky krovu" companion gap flagged during krov leaf-binding.
Source: KROS/ÚRS catalog + STAVAGENT MCP (ChatGPT-assisted). Connects kleštiny 2×60/180
to krokve (fošna 60 + krokev ~100 + fošna 60 ≈ 220 mm → band přes 150 do 300 mm).

Montáž 762085112 (ks) + material split:
  31197004 tyč závitová Pz 4.6 M12 (m) — 14 m   (50 × 0.25 m × 1.10)
  3111006  matice DIN 934-8 M12 (100 ks) — 1    (50 × 2 = 100 ks)
  31121004 podložka DIN 440 D12 (100 ks) — 1    (50 × 2 = 100 ks)

Count: 11 kleštin pozic × 2 konce × 2 svorníky = 44 + rezerva ≈ 50 ks.
Status OVĚŘIT — průměr (M12 vs M16) / pevnost (4.6 vs 8.8) / délka / počet dle statiky.
items 215 → 216.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "outputs" / "items_rd_jachymov_complete.json"

NEW = {
    "objekt": "260219_dum",
    "kapitola_group": "HSV",
    "_gate": "HSV",
    "kapitola": "HSV-5 Krov + střecha",
    "subkapitola": "Spojovací prostředky krovu — svorníky tesařských spojů",
    "popis": (
        "Montáž svorníků / šroubů tesařských spojů krovu délky přes 150 do 300 mm — "
        "spojení kleštin 2×60/180 mm s krokvemi (svorník cca 250 mm, M12), vč. tyče závitové + matic + podložek"
    ),
    "mj": "ks",
    "mnozstvi": 50,
    "mnozstvi_formula": "11 pozic kleštin × 2 konce × 2 svorníky/spoj = 44 ks + rezerva ≈ 50 ks",
    "mnozstvi_confidence": 0.6,
    "urs_code_proposed": "762085112",
    "urs_alternatives": [],
    "urs_status": "matched_catalog",
    "urs_confidence": 0.85,
    "source": "KROS/ÚRS catalog (762085112 montáž svorníků tesařských spojů) + STAVAGENT MCP; TZ statika §4 krov ocelové spojky",
    "subdodavatel": "tesar",
    "subdodavatel_status": "mapped",
    "vyjasneni_ref": [],
    "status_flag": "ready_for_phase2",
    "notes": "OVĚŘIT — průměr (M12/M16), pevnostní třída (4.6/8.8), délka a počet svorníků dle statického / tesařského detailu krovu.",
    "_data_quality": "catalog_estimate",
    "id": "260219_dum.HSV5.017",
    "realizuje_skladbu": "Krov — spojovací prostředky",
    "urs_code_family_6digit": "762085",
    "correct_code_hint": (
        "KROS 762085112 — Montáž svorníků/šroubů tesařských spojů délky přes 150 do 300 mm (MJ ks). "
        "Materiál samostatně (atomic): tyč závitová Pz 4.6 M12 31197004 (m), matice DIN 934-8 M12 3111006 (100 ks), "
        "podložka DIN 440 D12 31121004 (100 ks). Status ODHAD/OVĚŘIT dle statiky. NEZAHRNUJE: kotvení pozednice "
        "do věnce (samostatně ~20 ks), kovové úhelníky 762086111 (kg), hřebíky/vruty (pomocný materiál)."
    ),
    "_audit_gap_fixed": "KROV_SVORNIKY_ADD_2026-05-31",
}


def main() -> None:
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    if any(it.get("id") == "260219_dum.HSV5.017" for it in data["items"]):
        print("already present — skip")
        return
    data["items"].append(dict(NEW))
    data["_krov_svorniky_log"] = {
        "applied_at": "2026-05-31",
        "added": "260219_dum.HSV5.017 Montáž svorníků tesařských spojů krovu (762085112, 50 ks) + material split",
        "snapshot_before": "outputs/items_pre_krov_svorniky.json",
        "items_total": len(data["items"]),
    }
    ITEMS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK — added HSV5.017 krov svorníky (762085112, 50 ks). items_total={len(data['items'])}.")


if __name__ == "__main__":
    main()
