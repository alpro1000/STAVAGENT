#!/usr/bin/env python3
"""
Phase 5A — URS family code consistency check (no WebSearch, no items.json mutation).

Pattern 15 strict sequence Phase 5: catalog matching against FROZEN baseline.
Phase 5A is the OFFLINE candidate-identification step that runs BEFORE
selective WebSearch (Pattern 25).

Per Pattern 21 (Multi-factor catalog candidate selection), one factor in
the score is unit/family alignment between the kapitola the item lives in
and the URS code family digit. URS code structure (CZ ÚRS) uses 9-digit
codes where the first digit broadly maps to a work-class:

  1xx — Zemní práce + komunikace + ostatní zemní
  2xx — Základové konstrukce + speciální zakládání
  3xx — Svislé konstrukce (zdivo, sloupy)
  4xx — Vodorovné konstrukce (stropy, věnce)
  5xx — Komunikace + zpevněné plochy (silnice scope)
  6xx — Úpravy povrchů + omítky
  7xx — PSV — izolace, podlahy, obklady, omítky
  8xx — PSV — trubní vedení, kanalizace, ZTI
  9xx — Bourání + demontáže + ostatní

This is a HEURISTIC: ČR ÚRS doesn't enforce 1:1 kapitola↔family mapping in
all cases (cross-discipline items legitimately use a different family
digit — e.g. drenáž za bílou vanou is HSV-1 kapitola but uses 8xx ZTI
family because of the trubní character). Check is INFORMATIONAL.

Output: outputs/phase5a_family_consistency.json — per-item flags +
candidates for selective WebSearch (Phase 5B).

NO MUTATION TO items.json IN THIS PASS.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "outputs" / "phase5a_family_consistency.json"
TODAY = str(date.today())

# Kapitola → expected URS family digit (allowed set)
KAPITOLA_TO_FAMILY: dict[str, set[str]] = {
    "HSV-1 Zemní práce":         {"1"},
    "HSV-2 Základové a ŽB":      {"2", "3", "4"},  # ŽB can land in 2-4
    "HSV-3 Svislé konstrukce":   {"3"},
    "HSV-4 Vodorovné":           {"4", "3"},       # IPE/HEA stropnice can sit in 4 or 3
    "HSV-5 Krov + střecha":      {"7", "6", "4"},  # CZ ÚRS krov ranges
    "HSV-5 Komunikace + schodiště": {"1", "2", "5", "9"},  # sklad mezipodesta — broad
    "HSV-6 Bourací práce":       {"9"},
    "HSV-7 Fasáda ETICS":        {"6", "7"},
    "PSV-71 Izolace TI":         {"7"},
    "PSV-71 Izolace HI":         {"7"},
    "PSV-72 ZTI":                {"7", "8"},        # 721-725 ZTI vnitřní, 89x ZTI vnější
    "PSV-73 Vytápění":           {"7"},
    "PSV-76 Klempíř":            {"7"},
    "PSV-76 Truhlář":            {"7"},
    "PSV-76 Výplně otvorů":      {"7"},
    "PSV-76 Zámečnictví":        {"7"},
    "PSV-77 Podlahy":            {"7"},
    "PSV-78 Povrchové úpravy":   {"7", "6"},
    "PSV-95 Detekce požární":    {"7"},             # 729 alarm scope
    "M-21 ELI silnoproud":       {"7", "2"},        # M21 family or 21x
    "VRN — BOZP":                {"0", "9"},
    "VRN — Doprava + odpad":     {"0", "1", "9"},
    "VRN — Geodet":              {"0"},
    "VRN — Pojištění + zábory":  {"0"},
    "VRN — Průzkumy":            {"0"},
    "VRN — Dokumentace":         {"0"},
    "VRN — Kolaudace":           {"0"},
    "VRN — Revize":              {"0", "7"},
    "VRN — Společné":            {"0"},
    "VRN — Zařízení staveniště": {"0"},
}

# Known cross-discipline legitimate cases (whitelist to suppress noise)
LEGITIMATE_CROSS_DISCIPLINE = {
    # HSV-1 drenáž za BV → 8xx ZTI family (trubní vedení vnější)
    ("260219_dum.HSV1.015", "8"): "Drenážní trubka DN100 — 8xx ZTI family legitimate for trubní vedení (Pattern 21 — cross-discipline boundary)",
    # HSV-1 anglický dvorek dlažba — 5xx? Could be either 1 or 5
    # HSV-7 ETICS — 7xx PSV legitimately (kontaktní zateplení = PSV-71-like)
}


def family_digit(code: str | None) -> str | None:
    if not code or not isinstance(code, str):
        return None
    # Strip non-digit prefix (e.g. "M-21" → digit '2')
    digits = re.sub(r"[^\d]", "", code)
    return digits[0] if digits else None


def main() -> None:
    data = json.load((ROOT / "outputs" / "items_rd_jachymov_complete.json").open())
    items = data["items"]

    per_item: list[dict] = []
    by_status: Counter[str] = Counter()
    candidates_for_websearch: list[dict] = []

    for it in items:
        iid = it["id"]
        kap = it["kapitola"]
        urs_code = it.get("urs_code_proposed")
        urs_status = it.get("urs_status")
        urs_conf = it.get("urs_confidence") or 0.0

        family = family_digit(urs_code)
        expected = KAPITOLA_TO_FAMILY.get(kap, set())
        whitelisted = (iid, family) in LEGITIMATE_CROSS_DISCIPLINE

        # Determine candidate-flag-class
        flag_class: str
        rationale: str = ""

        if not urs_code:
            flag_class = "no_code"
            rationale = "No urs_code_proposed — already MANUAL LOOKUP class"
        elif not expected:
            flag_class = "kapitola_unknown_in_table"
            rationale = f"Kapitola '{kap}' not in KAPITOLA_TO_FAMILY table — review heuristic"
        elif family in expected:
            flag_class = "family_match"
            rationale = f"family digit '{family}' in expected set {sorted(expected)}"
        elif whitelisted:
            flag_class = "family_mismatch_whitelisted"
            rationale = LEGITIMATE_CROSS_DISCIPLINE[(iid, family)]
        else:
            flag_class = "family_mismatch"
            rationale = f"family digit '{family}' NOT in expected set {sorted(expected)} for kapitola '{kap}'"

        # Determine WebSearch candidate priority
        ws_priority: str | None = None
        if flag_class == "family_mismatch":
            ws_priority = "high"  # most likely wrong leaf
        elif urs_status in ("wrong_leaf_disambiguation_needed", "needs_production_lookup") and urs_conf < 0.75:
            ws_priority = "medium"
        elif urs_status == "needs_production_lookup" and urs_conf < 0.65:
            ws_priority = "medium-low"
        elif flag_class == "family_match" and urs_status == "matched_websearch_verified":
            ws_priority = "skip"  # already verified

        by_status[flag_class] += 1
        if ws_priority and ws_priority != "skip":
            candidates_for_websearch.append({
                "item_id": iid,
                "kapitola": kap,
                "popis_excerpt": (it.get("popis") or "")[:80],
                "urs_code_current": urs_code,
                "urs_confidence_current": urs_conf,
                "urs_status_current": urs_status,
                "family_actual": family,
                "family_expected": sorted(expected) if expected else None,
                "flag_class": flag_class,
                "ws_priority": ws_priority,
            })

        per_item.append({
            "item_id": iid,
            "kapitola": kap,
            "urs_code_proposed": urs_code,
            "urs_confidence": urs_conf,
            "urs_status": urs_status,
            "family_actual": family,
            "family_expected": sorted(expected) if expected else None,
            "flag_class": flag_class,
            "rationale": rationale,
        })

    # Sort candidates by priority
    priority_rank = {"high": 0, "medium": 1, "medium-low": 2}
    candidates_for_websearch.sort(key=lambda c: priority_rank.get(c["ws_priority"], 99))

    # Aggregate stats
    by_kapitola_mismatch: Counter[str] = Counter()
    for r in per_item:
        if r["flag_class"] == "family_mismatch":
            by_kapitola_mismatch[r["kapitola"]] += 1

    out = {
        "_schema_version": "1.0",
        "_generated_at": TODAY,
        "_purpose": "Phase 5A — URS family code consistency check (offline, no WebSearch, no items.json mutation).",
        "_pattern_compliance": {
            "pattern_15": "Catalog-matching phase — operates against FROZEN baseline only",
            "pattern_21": "Multi-factor selection — family-digit factor evaluated",
            "pattern_25": "Prepares targeted WebSearch candidate list for Phase 5B (selective)",
            "pattern_26": "Honest fallback hierarchy — NO fabrication; gaps flagged explicitly"
        },
        "_summary_by_flag_class": dict(by_status),
        "_summary_by_kapitola_with_mismatches": dict(by_kapitola_mismatch),
        "_websearch_candidates_total": len(candidates_for_websearch),
        "_websearch_candidates_by_priority": dict(Counter(c["ws_priority"] for c in candidates_for_websearch)),
        "_websearch_budget_estimate": f"~${len(candidates_for_websearch) * 0.01:.2f} (Anthropic WebSearch ~$0.01/query)",
        "_items_total": len(items),
        "candidates_for_phase5b": candidates_for_websearch,
        "per_item_flags": per_item,
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))

    # Compact stdout report
    print(json.dumps({
        "items_total": len(items),
        "summary_by_flag_class": dict(by_status),
        "summary_by_kapitola_with_mismatches": dict(by_kapitola_mismatch),
        "websearch_candidates_total": len(candidates_for_websearch),
        "websearch_candidates_by_priority": dict(Counter(c["ws_priority"] for c in candidates_for_websearch)),
        "websearch_budget_estimate_usd": round(len(candidates_for_websearch) * 0.01, 2),
        "output": str(OUT.relative_to(ROOT)),
        "TOP_10_HIGH_PRIORITY_CANDIDATES": [
            {"id": c["item_id"], "kap": c["kapitola"], "code": c["urs_code_current"], "family_actual": c["family_actual"], "expected": c["family_expected"]}
            for c in candidates_for_websearch if c["ws_priority"] == "high"
        ][:10],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
