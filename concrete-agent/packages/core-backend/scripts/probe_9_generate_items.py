"""PROBE 9 item generator — HSV-961 / 962 / 963 from Π.0a Step 8c output.

Reads `master_extract_D.json`'s `tzb_prostupy[]` + `tzb_strby[]` sections
and emits HSV-961 (štroby) + HSV-962 (prostupy ve stěnách) + HSV-963
(prostupy ve stropech) items per podlazi per discipline. Output shape
matches the Phase 6 input contract used by the existing D Excel
generator.

Mapping rules:
    - Each tzb_prostupy[] record  → one HSV-963 item (treated as prostup
      ve stropech, since CIRCLE-on-pipe-layer in koord drawings denotes
      slab penetration). UT pipes that go horizontally through walls
      are minority — accepting MJ=ks per-prostup is the conservative
      Czech HSV convention.
    - Each tzb_strby[] record     → one HSV-961 item (cable-tray chase
      length, MJ=m, derived from polyline length).
    - HSV-962 prostupy ve stěnách → emitted only when block_role ==
      "slaboproud_explicit" (`SLP_PROSTUP` block) per audit §3.4.

Per-item fields:
    item_id     UUID-style (deterministic from prostup id)
    kapitola    "HSV-961" | "HSV-962" | "HSV-963"
    popis       human-readable Czech description with discipline + DN
    MJ          "ks" (HSV-962/963) | "m" (HSV-961)
    mnozstvi    1 per prostup (count) or length_m for chases
    misto       {objekt: "D", podlazi: "1.NP" | …, mistnosti: []}
    skladba_ref empty (TZB items are not skladba-driven)
    confidence  prostup-record confidence (0.95 direct extract)
    status      "to_audit"
    poznamka    DN if known + source drawing for traceability
    data_source "pi_0a_step_8c_tzb_extract"
    urs_status  null (Phase 7a out-of-scope per task spec "no pricing")
    urs_code    null

Usage:
    python scripts/probe_9_generate_items.py
        → reads test-data/libuse/outputs/master_extract_D.json
        → writes test-data/libuse/outputs/items_probe_9_tzb.json
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path

# Resolve repo root from this script's location
REPO_ROOT = Path(__file__).resolve().parents[4]
OUTPUTS = REPO_ROOT / "test-data" / "libuse" / "outputs"
MASTER_EXTRACT_D = OUTPUTS / "master_extract_D.json"
OUT_ITEMS = OUTPUTS / "items_probe_9_tzb.json"


_DISCIPLINE_LABEL = {
    "vodovod":              "vodovod",
    "kanalizace":           "kanalizace",
    "silnoproud":           "silnoproud (kabelové trasy)",
    "silnoproud_embedded":  "silnoproud (embedded v koord overlay)",
    "slaboproud":           "slaboproud (data / EPS)",
    "UT":                   "UT (topení)",
    "plyn":                 "plyn",
    "VZT_partial":          "VZT (z 9421 jádra zoom — částečné pokrytí 2.NP)",
    "VZT":                  "VZT (vzduchotechnika)",
    "chl":                  "chlazení",
}

# ---------------------------------------------------------------------------
# Part 5B / drop v3 (2026-05-10) — heuristic VZT + chl estimates per podlazi
# ---------------------------------------------------------------------------
# Drop v3 update: user uploaded user-converted AC1024 DXFs for D 1.NP/2.NP/
# 3.NP VZT + chl. Step 8c now extracts those disciplines DIRECTLY at
# confidence 0.85; heuristic for above-ground floors is therefore
# DISABLED (set to 0). Only 1.PP entries remain heuristic:
#   - 1.PP VZT: 94 (file 1pp_VZT.dxf 29 MB, exceeds GitHub UI upload
#     limit; remains in backlog for git CLI upload — see ABMV item #11
#     follow-up in probe_9_backlog.md ticket #1).
#   - 1.PP chl: 8 (no standalone D_chl_1PP source DWG was ever produced
#     by ABMV — central chiller drawing not separable from the 1.PP
#     koord overlay; flat-cap heuristic anchored to plant capacity).
#
# Methodology + sanity check: probe_9_vzt_chl_manual_counts.md.
# Above-ground heuristic = 0 ⇒ no items emitted; direct VZT + chl
# items come from master_extract_D.json's tzb_prostupy[] section.
#
# Heuristic items emit at confidence 0.70 (vs 0.95 for direct extract).
PART_5B_HEURISTIC_VZT: dict[str, int] = {
    "1.PP": 94,   # 30% of (kan+vod=210) + 20 for machine room (KEEP)
    "1.NP": 0,    # disabled — direct extract from D_1NP_vzt.dxf
    "2.NP": 0,    # disabled — direct extract from D_2NP_vzt.dxf
    "3.NP": 0,    # disabled — direct extract from D_3NP_vzt.dxf
}
PART_5B_HEURISTIC_CHL: dict[str, int] = {
    "1.PP": 8,    # central chiller + main supply pair (KEEP)
    "1.NP": 0,    # disabled — direct extract from D_1NP_chl.dxf
    "2.NP": 0,    # disabled — direct extract from D_2NP_chl.dxf
    "3.NP": 0,    # disabled — direct extract from D_3NP_chl.dxf
}


def _stable_id(prefix: str, source_id: str) -> str:
    """Deterministic UUID-shaped ID — same input → same output, byte-identical
    across runs (idempotency requirement)."""
    h = hashlib.sha256(f"{prefix}|{source_id}".encode("utf-8")).hexdigest()
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _format_dn_suffix(dn_mm) -> str:
    if not dn_mm:
        return ""
    v = dn_mm.get("value")
    if v is None:
        return ""
    return f" DN{v}"


def _classify_prostup_kapitola(record: dict) -> str:
    """HSV-962 ve stěnách | HSV-963 ve stropech.

    SLP_PROSTUP blocks → HSV-962 (per audit §3.4 — slaboproud penetrations
    cross walls, not slabs). Everything else → HSV-963 (riser / pipe
    penetration through floor slab). Conservative; HSV-962 vs 963 is a
    nuance the contractor can re-classify on review.
    """
    if record.get("block_role") == "slaboproud_explicit":
        return "HSV-962"
    return "HSV-963"


def generate_items(extract_path: Path) -> tuple[list[dict], dict]:
    """Read master_extract for one objekt, return (items, summary)."""
    data = json.loads(extract_path.read_text(encoding="utf-8"))
    objekt = data["metadata"]["objekt"]
    prostupy = data.get("tzb_prostupy", [])
    strby = data.get("tzb_strby", [])

    items: list[dict] = []

    # HSV-962 + HSV-963 from prostupy
    for r in prostupy:
        kapitola = _classify_prostup_kapitola(r)
        discipline = r["discipline"]
        discipline_label = _DISCIPLINE_LABEL.get(discipline, discipline)
        podlazi = r["podlazi"]
        dn_suffix = _format_dn_suffix(r.get("dn_mm"))
        if kapitola == "HSV-962":
            popis = (
                f"Prostup ve stěně — {discipline_label}{dn_suffix}, "
                f"{podlazi}"
            )
        else:
            popis = (
                f"Prostup ve stropě — {discipline_label}{dn_suffix}, "
                f"{podlazi}"
            )
        item_id = _stable_id("probe9.prostup", r["id"])
        item: dict = {
            "item_id": item_id,
            "kapitola": kapitola,
            "popis": popis,
            "MJ": "ks",
            "mnozstvi": 1,
            "misto": {
                "objekt": objekt,
                "podlazi": podlazi,
                "mistnosti": [],
            },
            "skladba_ref": {},
            "vyrobce_ref": None,
            "urs_code": None,
            "urs_description": None,
            "confidence": r.get("confidence", 0.85),
            "status": "to_audit",
            "poznamka": (
                f"PROBE 9 Step 8c auto-extract: "
                f"{r.get('source_kind', '?')} on layer "
                f"{r.get('source_layer', '?')} | "
                f"source: {r.get('source_drawing', '?')} | "
                f"position: {r.get('position', [None, None])}"
            ),
            "warnings": [],
            "urs_status": "no_match",
            "audit_note": "PROBE 9 TZB recovery — auto-extract from per-discipline DXFs",
            "urs_confidence": 0.0,
            "data_source": "pi_0a_step_8c_tzb_extract",
            "category": "PROBE_9",
        }
        items.append(item)

    # ----------------------------------------------------------------------
    # Part 5B: heuristic VZT + chl items (DWG conversion failed for 7 files)
    # ----------------------------------------------------------------------
    # Each podlazi gets N items per discipline based on density ratio.
    # Items emit at confidence 0.70 with explicit poznamka pointing at the
    # methodology document. Stable item_id ensures idempotency.
    PART_5B_NOTE = (
        "PROBE 9 Part 5B heuristic estimate (DWG conversion failed — "
        "LibreDWG 0.13.4 bug). Source: density ratio anchored to kanalizace + "
        "vodovod actuals × 30% (VZT) / 20% (chl). See "
        "probe_9_vzt_chl_manual_counts.md for methodology. ABMV email #11 "
        "opened for re-export of failing DWGs."
    )
    for podlazi, n_vzt in PART_5B_HEURISTIC_VZT.items():
        for i in range(1, n_vzt + 1):
            source_id = f"part5b.VZT.{podlazi}.{i:04d}"
            item_id = _stable_id("probe9.heuristic", source_id)
            popis = (
                f"Prostup ve stropě — VZT (vzduchotechnika), {podlazi} "
                f"(heuristický odhad #{i})"
            )
            items.append({
                "item_id": item_id,
                "kapitola": "HSV-963",
                "popis": popis,
                "MJ": "ks",
                "mnozstvi": 1,
                "misto": {
                    "objekt": objekt,
                    "podlazi": podlazi,
                    "mistnosti": [],
                },
                "skladba_ref": {},
                "vyrobce_ref": None,
                "urs_code": None,
                "urs_description": None,
                "confidence": 0.70,
                "status": "to_audit",
                "poznamka": PART_5B_NOTE,
                "warnings": [
                    "Confidence 0.70: heuristic estimate, not direct extract. "
                    "Source DWG D_NNP_vzt.dwg or 1pp_VZT.dwg failed LibreDWG "
                    "conversion. Verify via PDF or re-exported DWG before "
                    "billing."
                ],
                "urs_status": "no_match",
                "audit_note": "Part 5B manual VZT recovery — density ratio heuristic",
                "urs_confidence": 0.0,
                "data_source": "pi_0a_step_8c_part_5b_heuristic",
                "category": "PROBE_9",
            })
    for podlazi, n_chl in PART_5B_HEURISTIC_CHL.items():
        for i in range(1, n_chl + 1):
            source_id = f"part5b.chl.{podlazi}.{i:04d}"
            item_id = _stable_id("probe9.heuristic", source_id)
            popis = (
                f"Prostup ve stropě — chlazení, {podlazi} "
                f"(heuristický odhad #{i})"
            )
            items.append({
                "item_id": item_id,
                "kapitola": "HSV-963",
                "popis": popis,
                "MJ": "ks",
                "mnozstvi": 1,
                "misto": {
                    "objekt": objekt,
                    "podlazi": podlazi,
                    "mistnosti": [],
                },
                "skladba_ref": {},
                "vyrobce_ref": None,
                "urs_code": None,
                "urs_description": None,
                "confidence": 0.70,
                "status": "to_audit",
                "poznamka": PART_5B_NOTE,
                "warnings": [
                    "Confidence 0.70: heuristic estimate, not direct extract. "
                    "Source DWG D_NNP_chl.dwg failed LibreDWG conversion. "
                    "Verify via PDF or re-exported DWG before billing."
                ],
                "urs_status": "no_match",
                "audit_note": "Part 5B manual chl recovery — density ratio heuristic",
                "urs_confidence": 0.0,
                "data_source": "pi_0a_step_8c_part_5b_heuristic",
                "category": "PROBE_9",
            })

    # HSV-961 from štroby (cable-tray chases)
    for r in strby:
        # length_m is required by the štroba contract (see
        # extract_tzb_strby in dxf_tzb_strby.py — every record has it
        # set from polyline arithmetic). Belt-and-suspenders defensive
        # default of 0.0 keeps the f-string + round() crash-safe if
        # an upstream change ever drops the field.
        length_m = r.get("length_m", 0.0)
        discipline_label = _DISCIPLINE_LABEL.get(r["discipline"], r["discipline"])
        podlazi = r["podlazi"]
        spec = r.get("spec", {})
        spec_value = spec.get("value")
        spec_suffix = f" ({spec_value})" if spec_value else ""
        popis = (
            f"Štroba pro kabelovou trasu — {discipline_label}{spec_suffix}, "
            f"{podlazi}"
        )
        item_id = _stable_id("probe9.strba", r["id"])
        item = {
            "item_id": item_id,
            "kapitola": "HSV-961",
            "popis": popis,
            "MJ": "m",
            "mnozstvi": round(length_m, 3),
            "misto": {
                "objekt": objekt,
                "podlazi": podlazi,
                "mistnosti": [],
            },
            "skladba_ref": {},
            "vyrobce_ref": None,
            "urs_code": None,
            "urs_description": None,
            "confidence": r.get("confidence", 0.85),
            "status": "to_audit",
            "poznamka": (
                f"PROBE 9 Step 8c auto-extract: "
                f"{r.get('source_kind', '?')} on layer "
                f"{r.get('source_layer', '?')} | "
                f"source: {r.get('source_drawing', '?')} | "
                f"length: {length_m:.3f} m"
            ),
            "warnings": [],
            "urs_status": "no_match",
            "audit_note": "PROBE 9 TZB recovery — auto-extract from cable-tray DXFs",
            "urs_confidence": 0.0,
            "data_source": "pi_0a_step_8c_tzb_extract",
            "category": "PROBE_9",
        }
        items.append(item)

    # Summary stats
    by_kap = Counter(it["kapitola"] for it in items)
    by_pod = Counter(it["misto"]["podlazi"] for it in items)
    summary = {
        "objekt": objekt,
        "n_items": len(items),
        "n_prostupy": len(prostupy),
        "n_strby": len(strby),
        "by_kapitola": dict(by_kap),
        "by_podlazi": dict(by_pod),
    }
    return items, summary


def main() -> int:
    if not MASTER_EXTRACT_D.exists():
        print(f"⛔ {MASTER_EXTRACT_D.relative_to(REPO_ROOT)} not found — "
              f"run pi_0/extract.py --objekt=D first.")
        return 2

    items, summary = generate_items(MASTER_EXTRACT_D)
    out = {
        "metadata": {
            "objekt": summary["objekt"],
            "phase": "PROBE_9_step_8c_tzb_recovery",
            "items_count": summary["n_items"],
            "tzb_prostupy_consumed": summary["n_prostupy"],
            "tzb_strby_consumed": summary["n_strby"],
            "by_kapitola": summary["by_kapitola"],
            "by_podlazi": summary["by_podlazi"],
        },
        "items": items,
    }
    OUT_ITEMS.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Wrote {OUT_ITEMS.relative_to(REPO_ROOT)}")
    print(f"  objekt:        {summary['objekt']}")
    print(f"  items:         {summary['n_items']}")
    print(f"  by_kapitola:   {summary['by_kapitola']}")
    print(f"  by_podlazi:    {summary['by_podlazi']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
