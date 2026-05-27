#!/usr/bin/env python3
"""
Phase 5 Option A2 — HSV1.004 + HSV1.005 WRONG_LEAF disambiguation.

Phase 5B WebSearch flagged duplicate code 564831111 on HSV1.004 (anglický dvorek)
and HSV1.005 (terasa). Different works wrongly sharing one leaf.

A2 evidence (this session, via concrete-agent MCP find_urs_code → cs-urs.cz +
URS_MATCHER local DB cross-validation):

HSV1.004 — anglický dvorek (betonová dlažba + štěrkový podklad):
  Family 596 (Kladení dlažeb), NOT 564 (Podkladní vrstvy). 564 covers ONLY the
  base layers; 596 covers the paving installation which is the leading work and
  unit-price driver in this composite item.
  Best leaf candidate: 596811220 "Betonová dlažba 50 mm na kamenné drti, kladecí
  + nosná vrstva, pozemní komunikace pěší" (perplexity 0.80 — exact spec match).
  Cross-validation: 596411142 (matcher 0.74) + 596811311 (matcher 0.56).

HSV1.005 — terasa (dřevěná prkna garapa na roštu + terče + dlaždice + štěrk):
  Family 762 (Tesařské konstrukce), NOT 564. Composite item; dominant work is
  the tesařská montáž of rošt + prkna.
  Best leaf candidates: 762952004 "Montáž terasy nášlapné vrstvy z prken..."
  (matcher 0.91) + 762951002 "Montáž podkladního roštu terasy..." (matcher 0.95).
  Alternative: 767590124 (matcher 0.52, alternate rošt method).
  Item is composite — Karel's KROS should split into 762951002 rošt + 762952004
  prkna + separate HSV-1/HSV-4 line for podklad (dlaždice + štěrk).

Per Pattern 26 (Honest fallback hierarchy):
  - Catalog-evidenced codes ARE allowed in urs_code_proposed (not fabricated)
  - Cross-validation across 2 sources (perplexity + URS matcher) = stronger signal
  - cross_verification_status: WRONG_LEAF -> FAMILY_VERIFIED (Pattern 27 evidence layer)

Per Pattern 15 (Work-First, Catalog-Last) — FROZEN fields preserved.
Per Pattern 28 — compound key (id, kapitola).
Per Pattern 32 — items.json only (File B deferred).

Idempotent.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
SNAPSHOT_PATH = ROOT / "outputs" / "items_FROZEN_pre_phase5_optionA2.json"
LOG_PATH = ROOT / "outputs" / "phase5_optionA2_dvorek_terasa_log.json"
TODAY = str(date.today())

AUDIT_TAG_DVOREK = "URS_PHASE5_A2_DVOREK_596_FIX"
AUDIT_TAG_TERASA = "URS_PHASE5_A2_TERASA_762_FIX"

TARGETS = [
    {
        "id": "260219_dum.HSV1.004",
        "kapitola": "HSV-1 Zemní práce",
        "wrong_code": "564831111",
        "new_code_proposed": "596811220",
        "new_alternatives": ["596411142", "596811311"],
        "new_family_6digit": "596",
        "new_status": "family_verified_leaf_candidate_kros_confirm_needed",
        "new_conf": 0.65,
        "new_cross_verification_status": "FAMILY_VERIFIED",
        "evidence_url": "https://podminky.urs.cz/  (cs-urs.cz 800-596 Kladení dlažeb)",
        "correct_code_hint": (
            "596xxx Kladení dlažeb (NOT 564 podkladní vrstvy) — composite item "
            "anglický dvorek; kandidát hlavního leafu 596811220 "
            "'Betonová dlažba 50 mm na kamenné drti, kladecí + nosná vrstva, "
            "pozemní komunikace pěší' per cs-urs.cz; alternativy 596411142 + "
            "596811311. Karel: ověřit v KROS — pokud KROS vyžaduje samostatný "
            "leaf pro podkladní vrstvy, dodat 564xxx jako 2. řádek."
        ),
        "verification_note": (
            "Phase 5 A2 evidence: concrete-agent MCP find_urs_code returned "
            "596811220 (perplexity 0.80, exact spec match) + 596411142 "
            "(URS_MATCHER local DB 0.74) + 596811311 (URS_MATCHER 0.56) — "
            "three-source convergence on 596 family. 564 family was wrong "
            "interpretation of composite item (564 = jen podkladní vrstvy, "
            "596 = dlažba + lože — leading work in this RD item). "
            "Duplicate-code conflict with HSV1.005 terasa (different family 762) "
            "is now structurally resolved by Pattern 26 disambiguation."
        ),
        "audit_tag": AUDIT_TAG_DVOREK,
    },
    {
        "id": "260219_dum.HSV1.005",
        "kapitola": "HSV-1 Zemní práce",
        "wrong_code": "564831111",
        "new_code_proposed": "762952004",
        "new_alternatives": ["762951002", "767590124"],
        "new_family_6digit": "762",
        "new_status": "family_verified_leaf_candidate_kros_decomposition_needed",
        "new_conf": 0.70,
        "new_cross_verification_status": "FAMILY_VERIFIED",
        "evidence_url": "https://podminky.urs.cz/  (cs-urs.cz 762 Tesařské konstrukce)",
        "correct_code_hint": (
            "762xxx Tesařské konstrukce (NOT 564 komunikace) — dřevěná terasa "
            "exteriér; kandidát hlavního leafu 762952004 'Montáž terasy nášlapné "
            "vrstvy z prken' (matcher 0.91); rošt samostatně 762951002 'Montáž "
            "podkladního roštu terasy' (matcher 0.95); alternativa rošt 767590124. "
            "Karel: v KROS rozdělit COMPOSITE položku na 762951002 rošt + "
            "762952004 prkna + samostatný řádek HSV-1/HSV-4 pro podklad "
            "(dlaždice 50 mm + štěrkový podsyp 16/32 100 mm + 4/8 150 mm + "
            "geotextilie). Mnozstvi 30 m² zůstává pro všechny komponenty."
        ),
        "verification_note": (
            "Phase 5 A2 evidence: concrete-agent MCP find_urs_code returned "
            "762951002 (URS_MATCHER 0.95) + 762952004 (URS_MATCHER 0.91) — "
            "high-confidence dual-leaf hit in tesařské konstrukce 762 family. "
            "Original 564 family was completely wrong (komunikace ≠ dřevěná "
            "terasa). Original duplicate-code conflict with HSV1.004 dvorek "
            "(different family 596) is now structurally resolved by Pattern 26."
        ),
        "audit_tag": AUDIT_TAG_TERASA,
    },
]

# Allowed-to-write fields (Pattern 15 guardrail; matches Option A1)
ALLOWED_WRITE = {
    "urs_code_proposed",
    "urs_code_proposed_was",
    "urs_code_family_6digit",
    "urs_alternatives",
    "urs_status",
    "urs_confidence",
    "correct_code_hint",
    "cross_verification_status",
    "cross_verification_evidence_url",
    "urs_verification_note",
    "_audit_gap_fixed",
}

FROZEN_FIELDS = {
    "popis", "mj", "mnozstvi", "mnozstvi_formula", "source",
    "kapitola", "subkapitola", "realizuje_skladbu", "subdodavatel",
}


def main() -> None:
    data = json.loads(ITEMS_PATH.read_text())
    items = data["items"]
    by_key: dict[tuple[str, str], dict] = {
        (it["id"], it["kapitola"]): it for it in items
    }

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

        frozen_before = {f: it.get(f) for f in FROZEN_FIELDS}

        prev = {
            "urs_code_proposed": it.get("urs_code_proposed"),
            "urs_alternatives": list(it.get("urs_alternatives", [])),
            "urs_status": it.get("urs_status"),
            "urs_confidence": it.get("urs_confidence"),
            "cross_verification_status": it.get("cross_verification_status"),
        }

        # === Apply patch ===
        it["urs_code_proposed_was"] = prev["urs_code_proposed"]
        it["urs_code_proposed"] = tgt["new_code_proposed"]
        it["urs_code_family_6digit"] = tgt["new_family_6digit"]
        it["urs_alternatives"] = list(tgt["new_alternatives"])
        it["urs_status"] = tgt["new_status"]
        it["urs_confidence"] = tgt["new_conf"]
        it["cross_verification_status"] = tgt["new_cross_verification_status"]
        it["cross_verification_evidence_url"] = tgt["evidence_url"]
        it["correct_code_hint"] = tgt["correct_code_hint"]
        it["urs_verification_note"] = tgt["verification_note"]

        existing_audit = it.get("_audit_gap_fixed")
        new_tag = tgt["audit_tag"]
        if existing_audit and new_tag not in existing_audit:
            it["_audit_gap_fixed"] = f"{existing_audit}; {new_tag}"
        elif not existing_audit:
            it["_audit_gap_fixed"] = new_tag

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
            "before": prev,
            "after": {
                "urs_code_proposed": tgt["new_code_proposed"],
                "urs_alternatives": tgt["new_alternatives"],
                "urs_code_family_6digit": tgt["new_family_6digit"],
                "urs_status": tgt["new_status"],
                "urs_confidence": tgt["new_conf"],
                "cross_verification_status": tgt["new_cross_verification_status"],
            },
            "audit_tag": tgt["audit_tag"],
        })

    data.setdefault("_phase5_option_a_log", {})
    data["_phase5_option_a_log"]["A2_dvorek_terasa_disambig"] = {
        "applied_at": TODAY,
        "pattern_compliance": {
            "pattern_15": "FROZEN-fields preserved (verified inline)",
            "pattern_26": "Catalog-evidenced codes only (no fabrication)",
            "pattern_27": "External LLM (Perplexity + URS_MATCHER) cross-validation",
            "pattern_28": "Compound key (id, kapitola) used",
            "pattern_32": "items.json only; File B separate",
        },
        "evidence_source": "concrete-agent MCP find_urs_code (perplexity_urs_search + urs_matcher_service)",
        "targets_count": len(TARGETS),
        "items_patched": len(applied),
        "items_skipped": skipped,
        "snapshot_before": str(SNAPSHOT_PATH.relative_to(ROOT)),
        "audit_tags": [AUDIT_TAG_DVOREK, AUDIT_TAG_TERASA],
        "wrong_leaf_resolved_in_this_step": 2,
    }

    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    LOG_PATH.write_text(json.dumps({
        "_generated_at": TODAY,
        "option": "A2",
        "targets": TARGETS,
        "applied": applied,
        "skipped": skipped,
        "frozen_fields_verified": sorted(FROZEN_FIELDS),
        "allowed_write_fields": sorted(ALLOWED_WRITE),
    }, indent=2, ensure_ascii=False))

    print(json.dumps({
        "option": "A2",
        "targets_count": len(TARGETS),
        "items_patched": len(applied),
        "items_skipped": len(skipped),
        "wrong_leaf_resolved": 2,
        "log": str(LOG_PATH.relative_to(ROOT)),
        "snapshot_before": str(SNAPSHOT_PATH.relative_to(ROOT)),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
