#!/usr/bin/env python3
"""
hk212 Task 1 Stage D — apply Stage A + Stage B + Stage C + Task 2 outputs
to items_hk212_etap1.json + abmv_email_queue.json.

User locks for this batch (chat 2026-05-22):
- Remove 15 VZT (concept-only items) + 7 M (kapitola=M = Rpol-* machine
  protection/anchor items also concept-only per Phase 0b §5 audit) — both
  groups dropped from etap-1 scope because D.1.4 TZB profesní PD missing
  (ABMV #12) blocks workable quantities.
- HSV-3 _length_source: hybrid ladder per item:
    1. PROFILY layer LINE/POLYLINE sum where INSERT block name matches
       → confidence 0.90, _length_source = "profily_layer_geometry"
    2. DIMENSION entity spatial lookup near INSERT position
       → confidence 0.92, _length_source = "dimension_dxf_lookup"
       (NOT implemented Stage D — bonus follow-up; left as enabling code)
    3. B5 default × INSERT count fallback → confidence 0.70,
       _length_source = "default_estimate"
  For service items (kotvení, montáž, doprava, nátěr, požární, revize) →
  _length_source = "not_applicable_service".
- ABMV updates: #1 (resolved_with_caveats per UT extraction), #12 (working
  _assumption_partial — ÚT only), #15 (resolved=UPE160 per kusovník DXF),
  #16 (resolved_external_xref_confirmed per Stage A razítka + Task 2 layer
  dictionary external_reference category).

Idempotency: writes backup at items_hk212_etap1.pre_stage_d.json before
mutating. Re-running on already-updated file is detected via metadata.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
HK = REPO / "test-data/hk212_hala"

ITEMS_PATH = HK / "outputs/phase_1_etap1/items_hk212_etap1.json"
ABMV_PATH = HK / "outputs/abmv_email_queue.json"
KUSOVNIK_PATH = HK / "outputs/dsp_dxf_ut_integration/dsp_dxf_kusovnik.json"
EXTRACTION_PATH = HK / "outputs/dsp_geometry_extraction/extraction_aggregated.json"
UT_DEVICES_PATH = HK / "outputs/dsp_dxf_ut_integration/ut_zarizeni_list.json"
AUDIT_OUT = HK / "outputs/phase_1_etap1/stage_d_audit.md"
BACKUP_ITEMS = HK / "outputs/phase_1_etap1/items_hk212_etap1.pre_stage_d.json"
BACKUP_ABMV = HK / "outputs/abmv_email_queue.pre_stage_d.json"

STAGE_D_VERSION = "stage_d_2026_05_22"


def setup_logger() -> logging.Logger:
    lg = logging.getLogger("stage_d")
    lg.setLevel(logging.INFO)
    lg.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
    lg.addHandler(h)
    return lg


# ─────────────────────── HSV-3 hybrid length ladder ──────────────────────

# B5 default lengths per profile (meters) when no DXF evidence — Stage D
# fallback per user spec. Sourced from typical hala HK steel-design defaults:
#   - sloupy IPE 400 / HEA 200 (štítové): 7.0 m (hala výška)
#   - příčle IPE 450: 9.6 m (half-rozpon 18.5 m + náběh = ~10 m, joined apex)
#   - vaznice IPE 160: 6.0 m (modul mezi rámy ~6 m)
#   - vaznice krajní UPE 160: 6.0 m
#   - ztužidla stěnová L 70/70/6: 4.0 m (diagonála pole)
#   - ztužidla střešní Ø20: 6.0 m
B5_DEFAULT_LENGTHS_M = {
    "IPE 400": 7.0,
    "HEA 200": 7.0,
    "IPE 450": 9.6,
    "IPE 160": 6.0,
    "UPE 160": 6.0,
    "L 70/70/6": 4.0,
    "Ø20": 6.0,
}

# HSV-3 ID → (profile_label, role_label) tag for length-source resolution
HSV3_PROFILE_MAP = {
    "HSV-3-001": ("IPE 400", "sloupy"),
    "HSV-3-002": ("HEA 200", "sloupy štítové"),
    "HSV-3-003": ("IPE 450", "příčle"),
    "HSV-3-004": ("IPE 160", "vaznice"),
    "HSV-3-005": ("UPE 160", "vaznice krajní"),
    "HSV-3-006": ("L 70/70/6", "ztužidla stěnová"),
    "HSV-3-007": ("Ø20", "ztužidla střešní"),
}
HSV3_SERVICE_IDS = {"HSV-3-008", "HSV-3-009", "HSV-3-010",
                     "HSV-3-011", "HSV-3-012", "HSV-3-013", "HSV-3-014"}


def hybrid_length_source(item_id: str, extraction: dict, kusovnik: dict) -> dict:
    """Return {_length_source, _length_confidence, _length_value_m, _length_method, _length_notes}."""
    if item_id in HSV3_SERVICE_IDS:
        return {
            "_length_source": "not_applicable_service",
            "_length_confidence": None,
            "_length_value_m": None,
            "_length_method": "service item — kg/m³/m²/ks/paušál, no per-piece length concept",
        }

    if item_id not in HSV3_PROFILE_MAP:
        return {
            "_length_source": "unmapped",
            "_length_confidence": 0.0,
            "_length_value_m": None,
            "_length_method": "no profile mapping in HSV3_PROFILE_MAP",
        }

    profile, role = HSV3_PROFILE_MAP[item_id]

    # ----- Ladder 1: PROFILY layer geometry sum (NOT implemented this stage) -----
    # The PROFILY layer in HK212 totals 14.2 m of LINE work across ALL profiles
    # (it's the schedule LEGEND, 1 sample line per profile family); not real
    # piece geometry. So this ladder cannot hit on this project. Documented
    # in audit; implementation deferred to bonus follow-up where per-INSERT
    # surrounding LINE-cluster extraction is feasible.
    ladder_1_eligible = False

    # ----- Ladder 2: DIMENSION near INSERT (NOT implemented this stage) ----------
    # Requires spatial index of 1637 DIMENSION entities × per-INSERT-position
    # queries; documented as Step 3 follow-up.
    ladder_2_eligible = False

    # ----- Ladder 3: B5 default × INSERT count (active fallback) -----------------
    default_m = B5_DEFAULT_LENGTHS_M.get(profile)
    return {
        "_length_source": "default_estimate",
        "_length_confidence": 0.70,
        "_length_value_m": default_m,
        "_length_method": (f"B5 default for '{profile}' as {role} = {default_m} m per piece "
                           "(ladder 3 fallback; ladder 1 PROFILY-geom and ladder 2 "
                           "DIMENSION-spatial not implemented this stage)"),
    }


# ─────────────────────── ABMV updates per user lock ──────────────────────

def build_abmv_updates(ut_devices: dict) -> dict[str, dict]:
    """Return {abmv_id: patch_dict}."""
    # Extract canonical totals from UT discovery (correct field = topny_kw_total)
    devices = ut_devices.get("devices", [])
    total_kw = sum((d.get("topny_kw_total") or 0)
                    for d in devices if isinstance(d, dict))
    # Build per-device summary string
    dev_lines = []
    for d in devices:
        per = d.get("topny_kw_per_unit", 0) or 0
        tot = d.get("topny_kw_total", 0) or 0
        dev_lines.append(f"{d.get('vendor','?')} {d.get('device_key','?')} "
                          f"× {d.get('count','?')} ({per} kW/unit = {tot} kW)")
    dev_summary = "; ".join(dev_lines)

    return {
        "ABMV_1": {
            "status": "resolved_with_caveats",
            "resolution_note": (
                f"Stage C ÚT discovery extracted P_topny_total = {total_kw:.1f} kW from "
                f"UT_HALAHK_DPS.dxf zařízení list. Devices: {dev_summary}. "
                f"Heating bilance covered; cooling + VZT electric load NOT in DXF "
                f"(VZT D.1.4 still missing per ABMV_12). LED svítidla a VZT "
                f"rekuperační jednotky listed at 0 kW (reference only — actual "
                f"EL spotřeba waits on EL D.1.4)."
            ),
            "resolution_date": "2026-05-22",
            "resolution_source": "outputs/dsp_dxf_ut_integration/ut_zarizeni_list.json",
        },
        "ABMV_12": {
            "status": "working_assumption_partial",
            "resolution_note": (
                f"ÚT D.1.4 extracted via Stage C: {dev_summary}, P_topny_total = "
                f"{total_kw:.1f} kW. No DPS razítko per Stage A dossier — DXF stupeň "
                f"= DSP. VZT D.1.4 + ZTI D.1.4 + MAR D.1.4 still missing — assumed "
                f"concept-level per Phase 0b. VZT/M items dropped from etap-1 scope "
                f"(Stage D 22-item removal)."
            ),
            "resolution_date": "2026-05-22",
            "resolution_source": ("outputs/dsp_dxf_ut_integration/{ut_razitka,ut_zarizeni_list,"
                                  "energetical_balance_update}.{json,md}"),
        },
        "ABMV_15": {
            "status": "resolved",
            "resolution_note": (
                "Kusovník DXF rozbor (Stage B) confirms UPE 160 as krajní vaznice "
                "(NOT C150×19.3 per RE-RUN §9.4 working assumption). Profile_rollup "
                "entry: UPE 160 with catalog_hit=True, kg/m=18.8. Item HSV-3-005 "
                "mnozstvi=1030.24 kg retained as written."
            ),
            "resolution_date": "2026-05-22",
            "resolution_source": "outputs/dsp_dxf_ut_integration/dsp_dxf_kusovnik.json",
        },
        "ABMV_16": {
            "status": "resolved_external_xref_confirmed",
            "resolution_note": (
                "External document '2966-1 návrh dispozice strojů HK' confirmed as DXF "
                "external xref: 3 layers ('212_HK_situace_03_dwg-1', "
                "'2966-1_navrh dispozice stroju-HK_02_dwg-1', "
                "'2966-1_navrh dispozice stroju-HK_dwg-1') across A106_stroje + "
                "A107_stroje_kotvici_body. Reclassified as `external_reference` in "
                "ratified layer dictionary (Task 2 Step 1.5). Cross-ref to Stage A "
                "razítka odkazů — same document referenced 2× in title block."
            ),
            "resolution_date": "2026-05-22",
            "resolution_source": ("outputs/dsp_geometry_extraction/"
                                  "{layer_dictionary_ratified,dictionary_decisions}.{json,md}"),
        },
    }


# ─────────────────────────── Main pipeline ────────────────────────────────

def main() -> int:
    logger = setup_logger()

    # Load everything
    items_doc = json.loads(ITEMS_PATH.read_text())
    abmv_doc = json.loads(ABMV_PATH.read_text())
    kusovnik = json.loads(KUSOVNIK_PATH.read_text())
    extraction = json.loads(EXTRACTION_PATH.read_text())
    ut_devices = json.loads(UT_DEVICES_PATH.read_text())

    # Idempotency check
    if items_doc.get("metadata", {}).get("stage_d_applied") == STAGE_D_VERSION:
        logger.warning(f"Stage D ({STAGE_D_VERSION}) already applied — refusing to re-run.")
        return 1

    # Backup
    if not BACKUP_ITEMS.exists():
        BACKUP_ITEMS.write_text(ITEMS_PATH.read_text())
        logger.info(f"backup written: {BACKUP_ITEMS}")
    if not BACKUP_ABMV.exists():
        BACKUP_ABMV.write_text(ABMV_PATH.read_text())
        logger.info(f"backup written: {BACKUP_ABMV}")

    items: list[dict] = items_doc["items"]
    initial_count = len(items)

    # ─── 1. Drop 15 VZT + 7 M items ────────────────────────────────────────
    DROP_KAPITOLA = {"VZT", "M"}
    dropped_items = [i for i in items if i.get("kapitola") in DROP_KAPITOLA]
    items = [i for i in items if i.get("kapitola") not in DROP_KAPITOLA]
    logger.info(f"dropped {len(dropped_items)} items (kapitola in {DROP_KAPITOLA}): "
                 f"VZT={sum(1 for d in dropped_items if d['kapitola']=='VZT')}, "
                 f"M={sum(1 for d in dropped_items if d['kapitola']=='M')}")

    # ─── 2. Annotate HSV-3 items with _length_source ───────────────────────
    hsv3_patched = 0
    for it in items:
        if it.get("kapitola") != "HSV-3":
            continue
        ladder = hybrid_length_source(it["id"], extraction, kusovnik)
        it.update(ladder)
        hsv3_patched += 1
    logger.info(f"annotated {hsv3_patched} HSV-3 items with _length_source")

    # ─── 3. ABMV updates ───────────────────────────────────────────────────
    if isinstance(abmv_doc, list):
        abmv_items: list[dict] = abmv_doc
    else:
        abmv_items = abmv_doc.get("items") or abmv_doc.get("queue") or []
    patches = build_abmv_updates(ut_devices)
    abmv_patched = 0
    for a in abmv_items:
        aid = a.get("id")
        if aid in patches:
            patch = patches[aid]
            a["status"] = patch["status"]
            a["resolution_note"] = patch["resolution_note"]
            a["resolution_date"] = patch["resolution_date"]
            a["resolution_source"] = patch["resolution_source"]
            abmv_patched += 1
    logger.info(f"patched {abmv_patched} ABMV queue items (#1, #12, #15, #16)")

    # ─── 4. Items.json metadata refresh ────────────────────────────────────
    md = items_doc["metadata"]
    md["total_items"] = len(items)
    md["kapitola_modules_loaded"] = [
        line for line in md["kapitola_modules_loaded"]
        if not line.startswith("kap_vzt") and not line.startswith("kap_m ")
    ]
    md["stage_d_applied"] = STAGE_D_VERSION
    md["stage_d_summary"] = {
        "applied_at": datetime.now(timezone.utc).isoformat(),
        "initial_item_count": initial_count,
        "final_item_count": len(items),
        "dropped_items": [
            {"id": d["id"], "kapitola": d["kapitola"], "popis": d.get("popis", "")[:120]}
            for d in dropped_items
        ],
        "hsv3_length_source_patched": hsv3_patched,
        "abmv_patched": abmv_patched,
        "rationale_doc": "outputs/phase_1_etap1/stage_d_audit.md",
    }

    # Recompute status_counts
    from collections import Counter
    sc = Counter(i.get("urs_status", "?") for i in items)
    md["status_counts"] = dict(sc)
    md["match_rate_high_plus_medium"] = round(
        (sc.get("matched_high", 0) + sc.get("matched_medium", 0)) / max(len(items), 1), 4)

    # Recompute vyjasneni_ref_distribution
    vd = Counter()
    for it in items:
        for ref in (it.get("_vyjasneni_ref") or []):
            vd[ref] += 1
    md["vyjasneni_ref_distribution"] = dict(vd)

    items_doc["items"] = items

    # ─── 5. Write outputs ──────────────────────────────────────────────────
    ITEMS_PATH.write_text(json.dumps(items_doc, indent=2, ensure_ascii=False))
    logger.info(f"wrote {ITEMS_PATH}")
    ABMV_PATH.write_text(json.dumps(abmv_doc, indent=2, ensure_ascii=False))
    logger.info(f"wrote {ABMV_PATH}")

    # ─── 6. Audit markdown ─────────────────────────────────────────────────
    lines = [
        f"# HK212 Stage D Audit — applied {datetime.now(timezone.utc).isoformat()}\n",
        f"## Items.json {ITEMS_PATH.name}\n",
        f"- Initial item count: **{initial_count}**\n",
        f"- Final item count: **{len(items)}** (Δ −{initial_count - len(items)})\n",
        f"- New URS status counts: `{dict(sc)}`\n",
        f"- New high+medium match rate: **{md['match_rate_high_plus_medium']}**\n",
        "\n### Dropped items (out-of-scope per Phase 0b §5 + Task §3)\n\n",
        "| ID | kapitola | popis |\n|---|---|---|\n",
    ]
    for d in dropped_items:
        lines.append(f"| {d['id']} | {d['kapitola']} | {d['popis'][:100]} |\n")

    lines.append("\n### HSV-3 _length_source annotation (hybrid ladder)\n\n")
    lines.append("| ID | _length_source | _length_value_m | _length_confidence | method |\n")
    lines.append("|---|---|---:|---:|---|\n")
    for it in items:
        if it.get("kapitola") != "HSV-3":
            continue
        ls = it.get("_length_source", "?")
        lv = it.get("_length_value_m", "—") or "—"
        lc = it.get("_length_confidence", "—") or "—"
        method = (it.get("_length_method") or "")[:120]
        lines.append(f"| {it['id']} | {ls} | {lv} | {lc} | {method} |\n")

    lines.append("\n### ABMV queue updates\n\n")
    for aid in ("ABMV_1", "ABMV_12", "ABMV_15", "ABMV_16"):
        for a in abmv_items:
            if a.get("id") == aid:
                lines.append(f"#### {aid} — {a.get('otazka', a.get('title', ''))}\n")
                lines.append(f"- Status: **{a.get('status')}**\n")
                lines.append(f"- Resolution: {a.get('resolution_note', '')}\n")
                lines.append(f"- Source: `{a.get('resolution_source', '')}`\n\n")
                break

    lines.append("\n### Not closed (NEW DXF/extraction evidence available — deferred)\n\n")
    lines.append("- **ABMV_2** Šířka sekčních vrat 3000 vs 3500: DXF block name "
                  "`M_Vrata_výsuvná_sekční - 3000×4000 MM` (4 ks confirmed) supports 3000 mm — "
                  "deferred formal closure to next Stage iteration.\n")
    lines.append("- **ABMV_14** Lindab svody 3 vs 4: Task 2 extraction shows **3 distinct physical "
                  "downpipes** (815811, 794159, 815879) per `agenm_targeted_scan.json`; "
                  "PSV-78x-001 currently states 4 ks. Reconciliation deferred — flagged in "
                  "ABMV queue but not silently overwritten.\n")
    lines.append("- **ABMV_20** Lindab svody A101 vs A104 elevation: same evidence as ABMV_14.\n")
    lines.append("\n### HSV-3 mass reconciliation (deferred — sensitive)\n\n")
    lines.append("Current HSV-3 masses sourced from `statika D.1.2` + Stage 0b assumption "
                  "`DXF A101 INSERT 'Sloup IPE' × 36`. Kusovník (Stage B DXF rozbor) shows "
                  f"{kusovnik['summary']['total_INSERT_instances']} total INSERT instances across "
                  f"{len(kusovnik['profile_rollup'])} profile families; PROFILY layer counts often "
                  "represent SCHEDULE LEGEND (1× HEA100, 1× HEA120 … 1× HEA340 = catalog "
                  "reference, NOT real piece counts). Real physical sloupy = "
                  f"{extraction['by_category'].get('structural_columns', {}).get('entity_count', '?')} "
                  "INSERTs on `structural_columns` layer (S-COLS), průvlaky = "
                  f"{extraction['by_category'].get('structural_beams', {}).get('entity_count', '?')}. "
                  "Mass recalibration requires (a) cross-sheet dedup of replicated views and "
                  "(b) schedule-vs-physical distinction — deferred to dedicated reconciliation task.\n")

    AUDIT_OUT.write_text("".join(lines))
    logger.info(f"wrote {AUDIT_OUT}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
