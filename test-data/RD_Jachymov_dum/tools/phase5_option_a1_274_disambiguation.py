#!/usr/bin/env python3
"""
Phase 5 Option A1 — HSV2.003 + HSV2.008 WRONG_LEAF disambiguation.

Phase 5B WebSearch identified duplicate code 631311115 on two different items:
  - HSV2.003  Bílá vana — bednění systémové (suterénní ŽB stěna BV)
  - HSV2.008  Pozední věnec — bednění

Family 631 = "Úpravy povrchů" — WRONG for bednění (formwork).
Phase 5B hint: 274XXX family (systémové bednění monolitických konstrukcí) per
cs-urs.cz 801-1 chapter "Budovy a haly — zděné a monolitické".

Per Pattern 26 (Honest fallback hierarchy):
  - NO fabricated 9-digit leaves (URS catalog access is paywalled at leaf level)
  - Move wrong code to `urs_code_proposed_was` (audit trail)
  - Set `urs_code_proposed: null` (no fake leaf)
  - Set `urs_code_family_6digit: "274"` (honest family-only stem)
  - Drop wrong 631/634 alternatives (also wrong family)
  - Status: wrong_leaf_274_family_lookup_required
  - Lower confidence 0.55 -> 0.40 (we know less now)
  - Annotate companion ŽB beton items (HSV2.001/2.002/2.007 already in 274 family)

Per Pattern 15 (Work-First, Catalog-Last) — FROZEN fields preserved:
  popis, mj, mnozstvi, mnozstvi_formula, source, kapitola, subkapitola,
  realizuje_skladbu, subdodavatel  ->  IMMUTABLE.

Per Pattern 28 (Schema integrity) — compound key (id, kapitola) used.
Per Pattern 32 (Two-file principle) — only items.json touched; File B (KROS
production) is a separate downstream artifact.

Idempotent — re-run sets the same values.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
SNAPSHOT_PATH = ROOT / "outputs" / "items_FROZEN_pre_phase5_optionA1.json"
LOG_PATH = ROOT / "outputs" / "phase5_optionA1_274_disambig_log.json"
TODAY = str(date.today())

# Per Pattern 28 — compound key (id, kapitola)
TARGETS = [
    {
        "id": "260219_dum.HSV2.003",
        "kapitola": "HSV-2 Základové a ŽB",
        "wrong_code": "631311115",
        "correct_code_hint": (
            "274XXX systémové bednění monolitických konstrukcí — bílá vana ŽB "
            "suterénní stěna; Karel: vyhledat v KROS v 274 family "
            "(společně s HSV2.001/HSV2.002 beton kód 274321321)"
        ),
        "verification_note": (
            "Phase 5B WebSearch: 631 = úpravy povrchů (wrong family for bednění). "
            "Phase 5 Option A1 disambiguation: leaf moved to null pending Karel's "
            "KROS lookup in 274 family per cs-urs.cz 801-1 chapter. "
            "Companion items HSV2.001/HSV2.002 use 274321321 for beton BV."
        ),
    },
    {
        "id": "260219_dum.HSV2.008",
        "kapitola": "HSV-2 Základové a ŽB",
        "wrong_code": "631311115",
        "correct_code_hint": (
            "274XXX systémové bednění věnců — pozední věnec ŽB; "
            "Karel: vyhledat v KROS v 274 family "
            "(společně s HSV2.007 beton věnec kód 274321311)"
        ),
        "verification_note": (
            "Phase 5B WebSearch: 631 = úpravy povrchů (wrong family for bednění). "
            "Phase 5 Option A1 disambiguation: leaf moved to null pending Karel's "
            "KROS lookup in 274 family per cs-urs.cz 801-1 chapter. "
            "Companion item HSV2.007 uses 274321311 for beton věnce."
        ),
    },
]

NEW_STATUS = "wrong_leaf_274_family_lookup_required"
NEW_CONF = 0.40
AUDIT_TAG = "URS_PHASE5_A1_274_DISAMBIG"
FAMILY_HINT = "274"

# Fields the patch is allowed to write (Pattern 15 guardrail)
ALLOWED_WRITE = {
    "urs_code_proposed",
    "urs_code_proposed_was",
    "urs_code_family_6digit",
    "urs_alternatives",
    "urs_status",
    "urs_confidence",
    "correct_code_hint",
    "urs_verification_note",
    "_audit_gap_fixed",
}

# Fields that MUST NOT change (Pattern 15 frozen list)
FROZEN_FIELDS = {
    "popis",
    "mj",
    "mnozstvi",
    "mnozstvi_formula",
    "source",
    "kapitola",
    "subkapitola",
    "realizuje_skladbu",
    "subdodavatel",
}


def main() -> None:
    data = json.loads(ITEMS_PATH.read_text())
    items = data["items"]
    by_key: dict[tuple[str, str], dict] = {
        (it["id"], it["kapitola"]): it for it in items
    }

    # Snapshot BEFORE patching (rollback source)
    if not SNAPSHOT_PATH.exists():
        SNAPSHOT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    applied = []
    skipped = []

    for tgt in TARGETS:
        key = (tgt["id"], tgt["kapitola"])
        it = by_key.get(key)
        if it is None:
            skipped.append({"key": list(key), "reason": "not_found"})
            continue

        # Capture frozen-field snapshot for post-write verification
        frozen_before = {f: it.get(f) for f in FROZEN_FIELDS}

        prev_code = it.get("urs_code_proposed")
        prev_alts = list(it.get("urs_alternatives", []))
        prev_status = it.get("urs_status")
        prev_conf = it.get("urs_confidence")
        prev_audit = it.get("_audit_gap_fixed")

        # === Apply patch (allowed-fields only) ===
        it["urs_code_proposed_was"] = prev_code  # preserve wrong code (audit trail)
        it["urs_code_proposed"] = None  # Pattern 26: no fabricated leaf
        it["urs_code_family_6digit"] = FAMILY_HINT  # honest family stem
        it["urs_alternatives"] = []  # drop wrong-family alts (631/634)
        it["urs_status"] = NEW_STATUS
        it["urs_confidence"] = NEW_CONF
        it["correct_code_hint"] = tgt["correct_code_hint"]
        it["urs_verification_note"] = tgt["verification_note"]

        existing_audit = it.get("_audit_gap_fixed")
        if existing_audit and AUDIT_TAG not in existing_audit:
            it["_audit_gap_fixed"] = f"{existing_audit}; {AUDIT_TAG}"
        elif not existing_audit:
            it["_audit_gap_fixed"] = AUDIT_TAG

        # === Post-write frozen-field verification ===
        for f, v in frozen_before.items():
            if it.get(f) != v:
                raise RuntimeError(
                    f"FROZEN FIELD VIOLATION on {key}: {f} changed "
                    f"from {v!r} to {it.get(f)!r}"
                )

        applied.append({
            "id": tgt["id"],
            "kapitola": tgt["kapitola"],
            "prev_code": prev_code,
            "prev_alts": prev_alts,
            "prev_status": prev_status,
            "prev_conf": prev_conf,
            "new_code": None,
            "new_family_6digit": FAMILY_HINT,
            "new_status": NEW_STATUS,
            "new_conf": NEW_CONF,
            "correct_code_hint": tgt["correct_code_hint"][:80] + "...",
        })

    # Append Option A1 log to items.json metadata
    data.setdefault("_phase5_option_a_log", {})
    data["_phase5_option_a_log"]["A1_274_disambig"] = {
        "applied_at": TODAY,
        "pattern_compliance": {
            "pattern_15": "FROZEN-fields preserved (verified inline)",
            "pattern_26": "No fabricated leaves — null + family_hint only",
            "pattern_28": "Compound key (id, kapitola) used",
            "pattern_32": "items.json only (File A); File B = separate downstream",
        },
        "targets_count": len(TARGETS),
        "items_patched": len(applied),
        "items_skipped": skipped,
        "snapshot_before": str(SNAPSHOT_PATH.relative_to(ROOT)),
        "audit_tag": AUDIT_TAG,
        "allowed_write_fields": sorted(ALLOWED_WRITE),
    }

    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    LOG_PATH.write_text(json.dumps({
        "_generated_at": TODAY,
        "option": "A1",
        "targets": TARGETS,
        "applied": applied,
        "skipped": skipped,
        "frozen_fields_verified": sorted(FROZEN_FIELDS),
        "allowed_write_fields": sorted(ALLOWED_WRITE),
    }, indent=2, ensure_ascii=False))

    print(json.dumps({
        "option": "A1",
        "targets_count": len(TARGETS),
        "items_patched": len(applied),
        "items_skipped": len(skipped),
        "log": str(LOG_PATH.relative_to(ROOT)),
        "snapshot_before": str(SNAPSHOT_PATH.relative_to(ROOT)),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
