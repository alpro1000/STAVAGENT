#!/usr/bin/env python3
"""
Statika (D.2) cross-check annotation — 2026-05-29.

Full statika D.2 (TeAnau, RFEM 5.39) confirmed ALL structural profiles + concrete
classes in items.json (zero profile/class errors). Exact steel/timber/reinforcement
tonnage is explicitly DPS-level (statika §7: definitivní dimenzování v DPS), so the
kg/ks/bm quantities stay ODHAD — annotated here, NOT changed (Pattern 26).

Adds `statika_validation` field to structural members (steel profiles + timber krov
+ reinforcement + H-BLOK count). Two items get an extra quantity caveat:
  - sklad IPE180 parking (HSV4.004): span/count needs výkres (likely 7m length high)
  - pozední věnec (HSV2.007/HSV2.008): statika věnec runs at two levels (pozednice +
    vikýř) — single-ring obvod may underestimate.

Idempotent. Quantities untouched. (id, kapitola) compound identity (Pattern 28).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "outputs" / "items_rd_jachymov_complete.json"

BASE_NOTE = (
    "Profil/materiál ověřen dle statiky D.2 (TeAnau, RFEM 5.39) — shoda. "
    "Množství ODHAD; přesný výkaz oceli/dřeva/výztuže v DPS (statika §7: "
    "definitivní dimenzování v dokumentaci pro provedení stavby)."
)

# (id, kapitola) → extra caveat appended after BASE_NOTE
EXTRA_CAVEAT = {
    ("260219_dum.HSV2.007", "HSV-2 Základové a ŽB"): (
        " POZOR množství: statika — věnec probíhá ve dvou úrovních (nižší pozednice "
        "I horní část vikýře) + stávající; jednookruhový obvod 38.7 m může podhodnocovat. "
        "Ověřit délku věnce z výkresu."
    ),
    ("260219_dum.HSV2.008", "HSV-2 Základové a ŽB"): (
        " POZOR množství: bednění věnce škáluje s délkou věnce (viz HSV2.007 — dvě úrovně)."
    ),
    ("260217_sklad.HSV4.004", "HSV-4 Vodorovné"): (
        " POZOR množství: statika — IPE180 á 1000 mm, stání 7.0 m, pnuty přes stěnu na patky; "
        "nosníky pravděpodobně rozpětí ~3.3–4 m (ne 7 m délka každý) → 49 lm může být ~20–30 % "
        "nadhodnoceno. Ověřit počet × délku z výkresu / RFEM modelu."
    ),
}

# popis keywords selecting structural members; demolition rows excluded.
PROFILE_RE = re.compile(
    r"\bIPE\d|\bHEA\d|\bHEB\d|\bIPN\d|\bUPE\d|\bUPN\d|jekl|jaeckl|jäckl|"
    r"100×100×4|100/4|krokv|kleštin|vaznic|pozednic|námět|fošn|"
    r"výztuž|vyztuž|B500|kari|pororošt|žárov|H-BLOK|stropnic", re.I)
EXCLUDE_RE = re.compile(r"bourán|demontáž|sejmutí|demolic|doprava|potěr", re.I)
# kapitolas outside statika D.2 nosné-konstrukce scope
EXCLUDE_KAP = re.compile(r"VRN|PSV-77 Podlahy", re.I)


def main() -> None:
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"]

    tagged = []
    for it in items:
        # idempotent: clear any prior tag, re-add only to current matches
        it.pop("statika_validation", None)
        p = it.get("popis") or ""
        kap = it.get("kapitola") or ""
        if not PROFILE_RE.search(p) or EXCLUDE_RE.search(p) or EXCLUDE_KAP.search(kap):
            continue
        note = BASE_NOTE + EXTRA_CAVEAT.get((it.get("id"), it.get("kapitola")), "")
        it["statika_validation"] = note
        tagged.append(f"{it['id']} [{it['kapitola']}]")

    data["_statika_crosscheck_log"] = {
        "applied_at": "2026-05-29",
        "source": "Statika D.2 (TeAnau s.r.o., Ing. Jan Tvardík ČKAIT 0012219, RFEM 5.39) — full TZ text",
        "verdict": (
            "All structural profiles + concrete classes in items.json CONFIRMED by statika "
            "(zero profile/class errors). Notable: sklad pasy C16/20 XC0 confirmed (resolves "
            "ChatGPT 'ověřit'); pozední věnec 300×250 confirmed; bílá vana ČBS 02 / 250×1200 pata "
            "/ 250×2050 stěna confirmed; krov HEA160+jekl100/4+kleštiny60/180+krokve100/180 confirmed; "
            "sklad stropnice 100/160 á625 + IPE180 á1000 confirmed; H-BLOK Herkul Standard confirmed."
        ),
        "policy": "Quantities kept as ODHAD (DPS-level výkaz per statika §7); statika_validation note added.",
        "quantity_flags": [
            "260217_sklad.HSV4.004 IPE180 parking — span/count needs výkres (7m length likely high)",
            "260219_dum.HSV2.007/HSV2.008 věnec — two-level run may underestimate single-ring obvod",
        ],
        "items_tagged": len(tagged),
    }

    ITEMS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Tagged {len(tagged)} structural items with statika_validation:")
    for t in tagged:
        print("  -", t)


if __name__ == "__main__":
    main()
