#!/usr/bin/env python3
"""
Part 5b — Apply WebSearch verification findings to items.json.

Idempotent patcher. Mutates urs_code_proposed / urs_status / urs_confidence /
urs_alternatives plus adds:
  - urs_code_proposed_was  (audit trail)
  - urs_verification_note
  - urs_websearch_verified_at

Source of truth: outputs/urs_websearch_verifications.json
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
ITEMS = PROJ / "outputs" / "items_rd_jachymov_complete.json"

# ── A. Exact-match items — confidence boost ────────────────────────────────
EXACT = {
    "260219_dum.HSV1.002": {
        "verified_code": "132201101",
        "note": "WebSearch: 'Hloubení rýh š do 600 mm v hornině tř. 3 objemu do 100 m3' — exact match to item",
    },
    "260217_sklad.HSV1.003": {
        "verified_code": "132201101",
        "note": "WebSearch: same URS leaf as HSV1.002 — exact match",
    },
    "260219_dum.HSV1.001": {
        "verified_code": "121101101",
        "note": "WebSearch: 'Sejmutí ornice ... do 50 m' m³ — leaf valid; distance ≤ 50 m for staging-close work matches RD Jáchymov dvorek scope",
    },
}

# ── B. Wrong-leaf items — downgrade + alternatives ─────────────────────────
WRONG_LEAF = {
    "260219_dum.HSV1.007": {
        "previous_code": "162701105",
        "reason": "URS leaf 162701105 = 9-10 km, item says 'do 8 km'",
        "family_6digit": "162701",
        "alternatives_revised": ["162701104", "162701103", "162701102"],
        "leaf_hint": "Wahrscheinlich 162701104 (8-9 km) podle WebSearch popis ladder",
    },
    "260217_sklad.HSV1.006": {
        "previous_code": "162701105",
        "reason": "Same wrong-leaf as HSV1.007 — 9-10 km vs 'do 8 km'",
        "family_6digit": "162701",
        "alternatives_revised": ["162701104", "162701103", "162701102"],
        "leaf_hint": "Wahrscheinlich 162701104 (8-9 km)",
    },
    "260219_dum.HSV2.005": {
        "previous_code": "711132101",
        "reason": "URS leaf = AIP bituminous rolls, item = PE separation foil",
        "family_6digit": "711141",
        "alternatives_revised": ["711141xxx_PE_folie"],
        "leaf_hint": "Family 711 (Izolace proti vodě) correct, leaf should be 711141 PE-folie family",
    },
    "260219_dum.PSV71.003": {
        "previous_code": "711132101",
        "reason": "URS leaf = AIP bituminous rolls, item = liquid stěrka coating for koupelna",
        "family_6digit": "711",
        "alternatives_revised": ["771274102", "711161xxx_sterka"],
        "leaf_hint": "Hydroizolační stěrka koupelen — TKP 771-27 family or 711-16 stěrka family",
    },
    "260219_dum.HSV6.002": {
        "previous_code": "962081141",
        "reason": "URS leaf = bourání skleněných tvárnic, item = bourání plechové krytiny",
        "family_6digit": "762",
        "alternatives_revised": ["762341xxx", "765191xxx", "764xxx_demontaz_plech"],
        "leaf_hint": "Plech krytina demolice = TKP 762 (tesařské konstrukce) or 764/765 (klempířina); NOT 962 (zdivo).",
    },
    "260217_sklad.PSV77.001": {
        "previous_code": "771121011",
        "reason": "URS leaf = nátěr penetrační (primer), item = betonová dlažba do pískového lože install",
        "family_6digit": "596",
        "alternatives_revised": ["596211xxx_betonova_dlazba_piskove_loze", "771-12_pokladka_betonove"],
        "leaf_hint": "Betonová dlažba do pískového lože = TKP 596 (chodník) family, NOT 771-1 (primery).",
    },
    "260219_dum.PSV71.001": {
        "previous_code": "713141121",
        "reason": "URS leaf = izolace STŘECH plochých, item = PODLAHA EPS",
        "family_6digit": "713121",
        "alternatives_revised": ["713121121", "713121122"],
        "leaf_hint": "Podlahy = TKP 713-12 (vrstvy podlah), NOT 713-14 (střechy).",
    },
    "260219_dum.PSV71.002": {
        "previous_code": "713141111",
        "reason": "Same wrong-family — kročejová EPS podlaha, not střecha",
        "family_6digit": "713121",
        "alternatives_revised": ["713121121", "713121111"],
        "leaf_hint": "Kročejová izolace mezi vrstvy podlahy = TKP 713-12.",
    },
    "260217_sklad.HSV2.001": {
        "previous_code": "273313811",
        "reason": "URS leaf = ZÁKLADY DESKY C 25/30, item = ZÁKLADOVÉ PASY C16/20 XC0",
        "family_6digit": "271313",
        "alternatives_revised": ["271313611_pasy_C16_20", "271313811", "274313811"],
        "leaf_hint": "Základové pasy = TKP 271 (pasy), NOT 273 (desky); class C16/20 leaf needed.",
    },
}

# ── C. HSV6.007 — direct replacement found via WebSearch ───────────────────
HSV6007_REPLACEMENT = {
    "id": "260219_dum.HSV6.007",
    "verified_code": "781473810",
    "alternatives": ["781471810", "978059541", "978059511"],
    "note": "WebSearch found exact match — 'Demontáž obkladů z dlaždic keramických lepených' (modern bonded tiles, fits post-1990 koupelna). 781471810 = malta-laid (older). 978059541/511 = odsekání (chip-off, no reuse).",
}

# ── D. Fabricated-term correction — "Hloubení figury" is not a Czech URS term ─
# User flagged 2026-05-19: "figura/figury" is a Russian loanword inadvertently
# left in item popis by Phase 1 generator. Correct Czech construction term for
# this work is "Hloubení jam" (TKP 131). WebSearch verified 131201101 =
# "Hloubení jam nezapažených v hornině tř. 3 objemu do 100 m3" m³.
FIGURA_FIX = {
    "260219_dum.HSV1.003": {
        "old_popis": "Hloubení figury pro anglický dvorek a nový vstup do 1.PP ze zahrady",
        "new_popis": "Hloubení jam nezapažených pro anglický dvorek a nový vstup do 1.PP ze zahrady, hornina tř. 3 (F4-CS)",
        "verified_code": "131201101",
        "alternatives": ["131211101", "131301101", "132201101"],
        "note": "Korekce 2026-05-19: 'figura' RU loanword odstraněn → správný URS term 'Hloubení jam nezapažených' (TKP 131). Verified leaf 131201101 = 'Hloubení jam nezapažených v hornině tř. 3 objemu do 100 m3' m³ (smlouvy.gov.cz, 2016).",
    },
    "260217_sklad.HSV1.002": {
        "old_popis": "Hloubení figury pro objekt skladu v lichoběžníku 6.35 × 3.34 m, hl. do 1.2 m",
        "new_popis": "Hloubení jam nezapažených pro objekt skladu v lichoběžníku 6,35 × 3,34 m, hl. do 1,2 m, hornina tř. 3",
        "verified_code": "131201101",
        "alternatives": ["131211101", "131301101", "132201101"],
        "note": "Korekce 2026-05-19: stejná oprava jako HSV1.003 — 'figura' → 'jám nezapažených'.",
    },
}

TODAY = str(date.today())


def patch(items: list[dict]) -> tuple[int, int, int, int]:
    by_id = {i["id"]: i for i in items}
    n_exact = n_wrong = n_repl = n_figura = 0

    # D. Fabricated-term corrections (run FIRST so popis is canonical before other patches)
    for iid, info in FIGURA_FIX.items():
        it = by_id.get(iid)
        if not it:
            print(f"WARN: {iid} not found (figura fix)", file=sys.stderr)
            continue
        # Idempotency: only patch if popis still has the old (RU loan) form
        if "figury" in it["popis"] or "figura" in it["popis"]:
            it["popis_was_fabricated"] = info["old_popis"]
            it["popis"] = info["new_popis"]
        # Always set verified code (idempotent assignment)
        prev_code = it.get("urs_code_proposed")
        if prev_code and prev_code != info["verified_code"]:
            it["urs_code_proposed_was"] = prev_code
        it["urs_code_proposed"] = info["verified_code"]
        it["urs_alternatives"] = info["alternatives"]
        it["urs_status"] = "matched_websearch_verified"
        it["urs_confidence"] = 0.95
        it["urs_verification_note"] = info["note"]
        it["urs_websearch_verified_at"] = TODAY
        n_figura += 1

    for iid, info in EXACT.items():
        it = by_id.get(iid)
        if not it:
            print(f"WARN: {iid} not found", file=sys.stderr)
            continue
        if it.get("urs_code_proposed") != info["verified_code"]:
            print(f"WARN: {iid} proposed differs from verified — skip", file=sys.stderr)
            continue
        it["urs_status"] = "matched_websearch_verified"
        it["urs_confidence"] = 0.95
        it["urs_verification_note"] = info["note"]
        it["urs_websearch_verified_at"] = TODAY
        n_exact += 1

    for iid, info in WRONG_LEAF.items():
        it = by_id.get(iid)
        if not it:
            print(f"WARN: {iid} not found", file=sys.stderr)
            continue
        it["urs_code_proposed_was"] = info["previous_code"]
        it["urs_code_proposed"] = None
        it["urs_code_family_6digit"] = info["family_6digit"]
        it["urs_alternatives"] = info["alternatives_revised"]
        it["urs_status"] = "wrong_leaf_disambiguation_needed"
        it["urs_confidence"] = 0.50
        it["urs_verification_note"] = f"WebSearch verified WRONG LEAF: {info['reason']}. Hint: {info['leaf_hint']}"
        it["urs_websearch_verified_at"] = TODAY
        n_wrong += 1

    iid = HSV6007_REPLACEMENT["id"]
    it = by_id.get(iid)
    if it:
        it["urs_code_proposed_was"] = it.get("urs_code_proposed")
        it["urs_code_proposed"] = HSV6007_REPLACEMENT["verified_code"]
        it["urs_alternatives"] = HSV6007_REPLACEMENT["alternatives"]
        it["urs_status"] = "matched_websearch_verified"
        it["urs_confidence"] = 0.90
        it["urs_verification_note"] = HSV6007_REPLACEMENT["note"]
        it["urs_websearch_verified_at"] = TODAY
        n_repl += 1

    return n_exact, n_wrong, n_repl, n_figura


def main() -> int:
    doc = json.loads(ITEMS.read_text())
    items = doc["items"]
    n_exact, n_wrong, n_repl, n_figura = patch(items)

    # Update document-level header
    doc["_websearch_verification_log"] = {
        "applied_at": TODAY,
        "verified_exact": n_exact,
        "wrong_leaf_flagged": n_wrong,
        "direct_replacement": n_repl,
        "fabricated_term_corrected": n_figura,
        "source": "outputs/urs_websearch_verifications.json",
    }

    ITEMS.write_text(json.dumps(doc, indent=2, ensure_ascii=False))
    print(
        f"\n✓ Patched items.json: exact={n_exact} wrong_leaf={n_wrong} replacement={n_repl} figura_fix={n_figura}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
