#!/usr/bin/env python3
"""
Stage 1B — add vyjasnění #22-24 for the NOT-ADDED anchor gaps.

Per Stage 1B-verify, these 3 gaps were NOT added to items.json (not in
ARS dům TZ / needs projektant decision). They are recorded as open
questions instead — honest flag without fabricating scope.

  #22 PM03 hromosvod      — PBŘ no explicit LPS; ČSN EN 62305 risk needed
  #23 PM06 terénní úpravy — only in MU sjezd rozhodnutí (separate scope)
  #24 PM04 slaboproud     — not in TZ; 3 byty would normally have it
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUEUE_PATH = ROOT / "inputs" / "meta" / "vyjasneni_queue.json"
TODAY = str(date.today())

NEW_VYJ = [
    {
        "id": 22,
        "severity": "important",
        "status": "open",
        "category": "anchor_gap_verify_projektant",
        "title": "Hromosvod / ochrana před bleskem (LPS) — chybí v PBŘ, ČSN EN 62305 risk analysis nutná",
        "context": "Anchor checklist Stage 1A (PM03) zjistil že hromosvod není v items.json. PBŘ D.3 (D_3_PBR_dum_TUSPO.pdf) — fulltext scan NENALEZL zmínku hromosvod/bleskosvod/LPS/jímač/uzemnění. Nový krov + hliníková falcovaná krytina + dům výšky 13 m v exponované poloze (Krušnohoří, VII. sněhová oblast).",
        "blocks": ["M-22 ELI hromosvod položka — pokud vyžadováno"],
        "working_assumption": "NEPŘIDÁNO do rozpočtu (NE vymýšlet práci mimo TZ). Pokud ČSN EN 62305 risk analysis vyžaduje LPS (pravděpodobné u nového krovu s kovovou krytinou v exponované poloze), doplnit jímací soustavu + svody + uzemnění.",
        "next_action": "Karle, ověř u projektanta (TUSPO / elektroprojektant) zda dle ČSN EN 62305 je hromosvod požadován. Pokud ano → doplníme M-22 položku (jímací soustava + svody + uzemnění + revize), cca 30-50 tis. Kč.",
    },
    {
        "id": 23,
        "severity": "medium",
        "status": "open",
        "category": "anchor_gap_scope_boundary",
        "title": "Terénní + sadové úpravy — pouze v MU rozhodnutí o sjezdu (separate scope), NE v ARS dům TZ",
        "context": "Anchor checklist Stage 1A (PM06) našel zmínku 'rozprostřena humusová vrstva tl. 10 cm a obnovena zeleň' POUZE v dokladová části '02.06 - MU Jáchymov - rozhodnutí zřízení vjezdu' (podmínka #8), kontext sjezd/komunikace Dvořákova (sjezd 13×, komunikace 24× v dokumentu, žádná zmínka 260219 dům). ARS TZ dům terénní/sadové úpravy NEZMIŇUJE.",
        "blocks": [],
        "working_assumption": "NEPŘIDÁNO do rozpočtu dům (260219). Restoration zeleně dle MU podmínky #8 patří do scope sjezd/parking akce (separate povolovaná akce, viz vyjasnění #2), NE do rozpočtu rekonstrukce domu.",
        "next_action": "Karle, ověř zda terénní/sadové úpravy + restoration zeleně (humusová vrstva 10 cm) má být v rozpočtu sjezd/parking (260217?) nebo samostatně. Pokud spadá do našeho scope → doplníme HSV-1 položku.",
    },
    {
        "id": 24,
        "severity": "medium",
        "status": "open",
        "category": "anchor_gap_not_in_tz",
        "title": "Slaboproud (data/TV/zvonek/domofon/anténa) — není v TZ, ale 3 byty obvykle vyžadují",
        "context": "Anchor checklist Stage 1A (PM04) zjistil že slaboproudé rozvody nejsou v items.json (M-21 silnoproud pokryt: rozvody + svítidla + zásuvky + příprava FVE). TZ ARS slaboproud explicitně NEZMIŇUJE.",
        "blocks": [],
        "working_assumption": "NEPŘIDÁNO (NE vymýšlet mimo TZ). Pro RD se 3 bytovými jednotkami jsou slaboproudé rozvody (datové zásuvky + TV/STA + zvonek/domofon) obvyklé, ale rozsah závisí na požadavcích investora (vyjasnění #7 řeší počty silnoproudu — slaboproud analogicky).",
        "next_action": "Karle, ověř u investora rozsah slaboproudu (data/TV/domofon) — souvisí s vyjasnění #7 (počty zásuvek/svítidel). Pokud požadováno → doplníme M-22 slaboproud položku.",
    },
]


def main() -> None:
    q = json.load(QUEUE_PATH.open())
    existing_ids = {it["id"] for it in q["items"]}
    added = []
    for v in NEW_VYJ:
        if v["id"] in existing_ids:
            continue
        q["items"].append(v)
        added.append(v["id"])
    q["_status"] = q.get("_status", {})
    q["_anchor_gaps_note"] = (
        f"Vyjasnění #22-24 added {TODAY} from anchor checklist Stage 1A. "
        "PM01 přesun hmot + PM02 lešení were ADDED to items.json (technical "
        "necessities); PM03/PM04/PM06 recorded here as open questions "
        "(not in ARS dům TZ — Alexander principle: NE add work not in TZ)."
    )
    QUEUE_PATH.write_text(json.dumps(q, indent=2, ensure_ascii=False))
    print(json.dumps({
        "vyjasneni_added": added,
        "total_vyjasneni": len(q["items"]),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
