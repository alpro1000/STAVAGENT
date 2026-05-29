#!/usr/bin/env python3
"""
Add vyjasnění #25/#26/#27 from ChatGPT revize cross-check (2026-05-29).

Source: ChatGPT master soupis revize (JACHIMOV_master_soupis_bez_URS_v0_9.xlsx)
diffed against items.json + independent TZ verification. All three are
NOT_IN_TZ (DSP-level documentation gaps) — per Pattern 26 the honest move is a
vyjasnění for the projektant, NOT fabricated položky with invented quantities.

Idempotent: skips ids already present.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUEUE = ROOT / "inputs" / "meta" / "vyjasneni_queue.json"

NEW = [
    {
        "id": 25,
        "severity": "important",
        "status": "open",
        "category": "chatgpt_review_gap_verify_projektant",
        "title": "Sklad — svislá hydroizolace + drenáž stěn pod terénem (skladby S03a/S04) — DSP nespecifikuje",
        "context": (
            "ChatGPT revize (master soupis v0.9) + nezávislý fulltext scan TZ skladu (260217): "
            "sklad má specifikovánu POUZE střešní hydroizolaci (souvrství ve spádu). Svislé "
            "obvodové stěny ze ztraceného bednění tl. 250 mm jsou ve svahu částečně pod terénem, "
            "ale TZ neuvádí svislou hydroizolaci, asfaltovou penetraci, 2× asfaltový pás, nopovou "
            "fólii ani drenáž za opěrnou stěnou S04. ChatGPT je odvodil ze skladeb S03a/S04 — "
            "v TZ skladu termíny 'drenáž / odvodnění / nopová fólie / svislá hydroizolace' "
            "NENALEZENY (jen generická poznámka 'penetrační a separační vrstvy dle výrobce')."
        ),
        "blocks": [
            "SKL-ST-05 asfaltová penetrace svislých stěn",
            "SKL-ST-06 2× asfaltový hydroizolační pás svislých stěn",
            "SKL-ST-07 nopová / drenážní fólie svislá",
            "SKL-ST-08 drenáž za opěrnou stěnou S04",
        ],
        "working_assumption": (
            "NEPŘIDÁNO do rozpočtu (Pattern 26 — DSP nespecifikuje, množství by bylo 'doplnit'). "
            "Pro stěny pod terénem ve svahu je svislá HI + drenáž technicky nutná (riziko vody/mrazu)."
        ),
        "next_action": (
            "Karle, ověř u projektanta zda skladby S03a/S04 zahrnují svislou hydroizolaci + drenáž "
            "stěn skladu pod terénem. Pokud ano → doplníme (penetrace + 2× asfalt. pás + nopová "
            "fólie + drenáž DN100 za S04) dle ploch pod terénem."
        ),
        "_source": "chatgpt_review_2026-05-29",
    },
    {
        "id": 26,
        "severity": "important",
        "status": "open",
        "category": "chatgpt_review_gap_verify_projektant",
        "title": "Sněhové zábrany / protisněhové prvky — falcovaná krytina, VII. sněhová oblast",
        "context": (
            "ChatGPT revize + TZ scan: TZ uvádí klimatické zatížení 'VII. sněhová oblast' (vstupní "
            "zatížení pro statiku), ale NEUVÁDÍ protisněhové prvky jako výrobek/práci. Nová "
            "hliníková/ocelová falcovaná krytina v Jáchymově (Krušnohoří, region VII) dle ČSN a "
            "doporučení výrobců krytin běžně vyžaduje sněhové zachytávače nad vstupy a okapem."
        ),
        "blocks": ["RD-KR-19 protisněhové prvky / sněhové zábrany"],
        "working_assumption": "NEPŘIDÁNO (mimo TZ — pouze sněhové zatížení, ne sněhové zábrany jako prvek).",
        "next_action": (
            "Karle, ověř u projektanta / dodavatele krytiny zda jsou pro falc. krytinu v VII. "
            "sněhové oblasti požadovány sněhové zábrany. Pokud ano → doplníme bm dle délky okapů "
            "(zejména nad vstupy)."
        ),
        "_source": "chatgpt_review_2026-05-29",
    },
    {
        "id": 27,
        "severity": "minor",
        "status": "open",
        "category": "chatgpt_review_gap_verify_projektant",
        "title": "Lemování komína a střešních prostupů — klempířský detail",
        "context": (
            "ChatGPT revize: items.json má klempířské oplechování (úžlabí, hřeben, štítové lemy, "
            "doplňky vikýřů, atika, závětrné lemy), ale ne explicitní lemování komína / střešních "
            "prostupů. Vrchní část komína se bourá (HSV6.016), ale pokud komín nebo VZT prostupy "
            "procházejí novou střechou, vyžadují oplechování. V TZ lemování komína nenalezeno."
        ),
        "blocks": ["RD-KLE-06 lemování komína a prostupů"],
        "working_assumption": "NEPŘIDÁNO (mimo TZ — závisí na tom zda komín/prostupy procházejí novou střechou).",
        "next_action": (
            "Karle, ověř zda komín nebo VZT/ZTI prostupy procházejí novou střechou → pokud ano, "
            "doplníme klempířské lemování (ks dle počtu prostupů)."
        ),
        "_source": "chatgpt_review_2026-05-29",
    },
]


def main() -> None:
    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    existing = {v["id"] for v in data["items"]}
    added = []
    for v in NEW:
        if v["id"] in existing:
            continue
        data["items"].append(v)
        added.append(v["id"])

    note = data.get("_chatgpt_review_note", "")
    data["_chatgpt_review_note"] = (
        "Vyjasnění #25-27 přidána z ChatGPT revize master soupisu (2026-05-29) + nezávislé "
        "TZ verifikace. Všechna NOT_IN_TZ (DSP gaps) → vyjasnění, nefabrikovat položky (Pattern 26)."
    )

    QUEUE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Queue now {len(data['items'])} items. Added: {added or '(none — already present)'}")


if __name__ == "__main__":
    main()
