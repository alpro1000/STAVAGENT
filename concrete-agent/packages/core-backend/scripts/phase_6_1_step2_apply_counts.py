"""Phase 6.1 step 2 — apply best-available count source per item.

Hierarchy:
  1. Tabulka per-objekt value (D-codes from Tabulka dveří) → confidence 1.0
  2. DXF spatial count per objekt D (OP/LI/LP/TP) → confidence 0.95
  3. Phase 1 aggregate from DXF (W/D type counts) → confidence 0.95
  4. Uniform 0.25 D-share fallback → confidence 0.6

Side effects:
  - PSV-768 misplaced revizní dvířka items removed
  - For each OP## dodávka item, paired HSV-642 osazení item added
  - All ks/kpl items remaining as estimate get integer round-up
"""
from __future__ import annotations

import copy
import json
import math
import re
import uuid
from collections import defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
COMBINED = OUT_DIR / "items_objekt_D_complete.json"
TAB_PERO = OUT_DIR / "tabulky_perobjekt_counts.json"
DXF_COUNTS = OUT_DIR / "dxf_segment_counts_per_objekt_d.json"
TABULKY = OUT_DIR / "tabulky_loaded.json"
DIFF = OUT_DIR / "phase_6_1_diff_log.md"


INTEGER_MJS = {"ks", "kpl", "ks-měs", "kpl-měs", "soubor", "soub"}


def load_all():
    return (
        json.loads(COMBINED.read_text(encoding="utf-8")),
        json.loads(TAB_PERO.read_text(encoding="utf-8")),
        json.loads(DXF_COUNTS.read_text(encoding="utf-8")),
        json.loads(TABULKY.read_text(encoding="utf-8")),
    )


def get_dxf_d_count(dxf_counts: dict, prefix: str, code: str) -> int | float | None:
    bag = dxf_counts.get("counts_per_objekt_d", {}).get(prefix, {})
    e = bag.get(code)
    if e is None:
        return None
    return e["total_d_count_int"]


def detect_code_in_skladba(skl: dict, prefix: str) -> str | None:
    """Look for OP/LI/LP/TP/D_type/W_type key in skladba_ref."""
    if not skl:
        return None
    keys_to_check = {
        "OP": ["OP"],
        "LI": ["LI"],
        "LP": ["LP"],
        "TP": ["TP"],
        "D":  ["D_type"],
        "W":  ["W_type"],
    }.get(prefix, [])
    for k in keys_to_check:
        if k in skl:
            v = str(skl[k]).strip()
            if v.startswith(prefix):
                return v
    return None


def main() -> None:
    combined, tab_pero, dxf_counts, tabulky = load_all()
    items = combined["items"]

    diff_lines: list[str] = []
    diff_lines.append("# Phase 6.1 diff log — count source updates")
    diff_lines.append("")
    diff_lines.append("Per-item changes from uniform 0.25 D-share fallback to best-available "
                      "source.")
    diff_lines.append("")

    # Stats
    upd_tabulka = 0
    upd_dxf = 0
    rounded_up = 0
    psv768_removed = 0
    osazeni_added = 0
    confidence_dist = defaultdict(int)

    # Tabulka dveří per-objekt (from Tabulka structure analysis)
    tab_dvere = tab_pero.get("dvere", {}).get("objekt_d_per_type", {})

    # Sample changes (for scorecard)
    sample_changes_op: list[dict] = []
    sample_changes_li: list[dict] = []
    sample_changes_lp: list[dict] = []
    sample_changes_dw: list[dict] = []

    new_items: list[dict] = []
    op_dodavka_pairs: list[dict] = []  # OP## dodávka items needing osazení pair

    for it in items:
        it = copy.deepcopy(it)
        skl = it.get("skladba_ref") or {}
        old_qty = it.get("mnozstvi")
        kapitola = it.get("kapitola", "")
        popis = it.get("popis", "")
        update_source = None
        new_qty = None

        # Path 1: Tabulka dveří per-objekt (D-codes)
        d_code = skl.get("D_type")
        if d_code and d_code in tab_dvere:
            tab_d_count = tab_dvere[d_code]
            # Only override count-based items (ks); spárování / m items keep DXF-derived
            if it["MJ"] == "ks":
                # If Phase 1 DXF count differs from Tabulka, use Tabulka per-objekt (more accurate)
                if abs(tab_d_count - old_qty) > 0.5:
                    new_qty = tab_d_count
                    update_source = f"tabulka_dveri_per_objekt: {old_qty} → {tab_d_count}"
                    if len(sample_changes_dw) < 8 and tab_d_count != old_qty:
                        sample_changes_dw.append({
                            "code": d_code, "popis": popis[:50],
                            "old": old_qty, "new": tab_d_count,
                            "source": "tabulka_dveri_per_objekt",
                        })

        # Path 2: DXF spatial counts (OP/LI/LP/TP)
        for prefix in ("OP", "LI", "LP", "TP"):
            code = detect_code_in_skladba(skl, prefix)
            if not code:
                continue
            dxf_d = get_dxf_d_count(dxf_counts, prefix, code)
            if dxf_d is None:
                continue
            # The old item used komplex × 0.25 D-share; replace with DXF count
            if it["MJ"] in ("ks", "kpl"):
                if abs(dxf_d - old_qty) > 0.5:
                    new_qty = dxf_d
                    update_source = f"dxf_spatial_count {prefix}: {old_qty} → {dxf_d}"
                    sample_list = {"OP": sample_changes_op, "LI": sample_changes_li,
                                   "LP": sample_changes_lp}.get(prefix)
                    if sample_list is not None and len(sample_list) < 5:
                        sample_list.append({
                            "code": code, "popis": popis[:50],
                            "old": old_qty, "new": dxf_d,
                            "source": f"dxf_spatial_count {prefix}",
                        })
            elif it["MJ"] in ("bm", "m"):
                # For bm/m items keep komplex Tabulka × better D-share — DXF count
                # is per-instance; bm needs Tabulka komplex × actual D-share
                # Compute actual D-share: dxf_d_count / komplex_qty (where qty=ks proxy)
                # Skip — these are low-priority and already in old item
                pass
            break

        # Apply update
        if new_qty is not None and new_qty != old_qty:
            it["mnozstvi"] = round(float(new_qty), 3)
            it["data_source"] = (
                "tabulka_per_objekt" if "tabulka" in update_source
                else "dxf_count"
            )
            it["confidence"] = 1.0 if "tabulka" in update_source else 0.95
            it.setdefault("warnings", []).append(f"BUG_FIX_2: {update_source}")
            it["audit_note"] = (it.get("audit_note", "") + f"; phase_6.1: {update_source}").strip("; ")
            if "tabulka" in update_source:
                upd_tabulka += 1
            else:
                upd_dxf += 1

        # Round-up for integer MJ items still on uniform fallback
        if it["MJ"] in INTEGER_MJS and isinstance(it["mnozstvi"], float):
            int_qty = math.ceil(it["mnozstvi"])
            if int_qty != it["mnozstvi"]:
                old_int = it["mnozstvi"]
                it["mnozstvi"] = int_qty
                it.setdefault("warnings", []).append(
                    f"BUG_FIX_1: {it['MJ']} item rounded up {old_int} → {int_qty}"
                )
                rounded_up += 1

        # PSV-768 cleanup: remove misplaced revizní dvířka items
        # Keep only garážová vrata + protipožární vrata (atypické dveře)
        if kapitola == "PSV-768":
            popis_l = popis.lower()
            if "revizní dvířka" in popis_l:
                # Remove (don't append)
                psv768_removed += 1
                continue

        # Track final confidence
        confidence_dist[it.get("confidence", 0.85)] += 1

        new_items.append(it)

        # If OP## dodávka, queue for HSV-642 osazení pair
        if (it["kapitola"] == "OP-detail" and skl.get("OP")
                and it["MJ"] == "ks" and it["mnozstvi"] > 0):
            op_dodavka_pairs.append(it)

    # Add HSV-642 osazení items paired with OP## dodávka
    for op in op_dodavka_pairs:
        osazeni = {
            "item_id": str(uuid.uuid4()),
            "kapitola": "HSV-642",
            "popis": f"Osazení revizních dvířek / OP {op['skladba_ref']['OP']} ({op['popis'][:30]})",
            "MJ": op["MJ"],
            "mnozstvi": op["mnozstvi"],
            "misto": op["misto"],
            "skladba_ref": {"OP": op["skladba_ref"]["OP"], "paired_with": op["item_id"]},
            "vyrobce_ref": "",
            "urs_code": None,
            "urs_description": None,
            "category": "subcontractor_required",
            "status": "to_audit",
            "confidence": op.get("confidence", 0.95),
            "data_source": "paired_with_op_dodavka",
            "poznamka": f"Phase 6.1: pair osazení s OP## dodávka {op['skladba_ref']['OP']}",
            "warnings": ["Phase 6.1 BUG fix: HSV-642 osazení item paired with OP-detail"],
            "urs_status": "VYNECHANE_DETAIL",
            "audit_note": "Phase 6.1: paired osazení created",
        }
        new_items.append(osazeni)
        osazeni_added += 1
        confidence_dist[osazeni["confidence"]] += 1

    # Persist
    combined["items"] = new_items
    combined["metadata"]["items_count"] = len(new_items)
    combined["metadata"]["phase_6_1_applied"] = True
    COMBINED.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")

    # Diff log
    diff_lines.append("## Stats")
    diff_lines.append("")
    diff_lines.append(f"- Items before: {len(items)}")
    diff_lines.append(f"- Items after:  {len(new_items)}")
    diff_lines.append(f"- Updated via Tabulka per-objekt: **{upd_tabulka}**")
    diff_lines.append(f"- Updated via DXF spatial count:  **{upd_dxf}**")
    diff_lines.append(f"- ks/kpl items rounded up:        **{rounded_up}**")
    diff_lines.append(f"- PSV-768 revizní dvířka removed: **{psv768_removed}**")
    diff_lines.append(f"- HSV-642 osazení items added (paired with OP##): **{osazeni_added}**")
    diff_lines.append("")

    diff_lines.append("## Confidence distribution after fix")
    diff_lines.append("")
    diff_lines.append("| Confidence | Items |")
    diff_lines.append("|---:|---:|")
    for c, n in sorted(confidence_dist.items(), reverse=True):
        diff_lines.append(f"| {c} | {n} |")
    diff_lines.append("")

    # Sample changes
    diff_lines.append("## Sample changes (D## doors via Tabulka)")
    diff_lines.append("")
    diff_lines.append("| Code | Popis | Old qty | New qty | Source |")
    diff_lines.append("|---|---|---:|---:|---|")
    for s in sample_changes_dw[:10]:
        diff_lines.append(f"| `{s['code']}` | {s['popis']} | {s['old']} | {s['new']} | {s['source']} |")
    diff_lines.append("")

    diff_lines.append("## Sample changes (OP## via DXF)")
    diff_lines.append("")
    diff_lines.append("| Code | Popis | Old qty | New qty | Source |")
    diff_lines.append("|---|---|---:|---:|---|")
    for s in sample_changes_op:
        diff_lines.append(f"| `{s['code']}` | {s['popis']} | {s['old']} | {s['new']} | {s['source']} |")
    diff_lines.append("")

    diff_lines.append("## Sample changes (LI## via DXF)")
    diff_lines.append("")
    diff_lines.append("| Code | Popis | Old qty | New qty | Source |")
    diff_lines.append("|---|---|---:|---:|---|")
    for s in sample_changes_li:
        diff_lines.append(f"| `{s['code']}` | {s['popis']} | {s['old']} | {s['new']} | {s['source']} |")
    diff_lines.append("")

    diff_lines.append("## Sample changes (LP## via DXF)")
    diff_lines.append("")
    diff_lines.append("| Code | Popis | Old qty | New qty | Source |")
    diff_lines.append("|---|---|---:|---:|---|")
    for s in sample_changes_lp:
        diff_lines.append(f"| `{s['code']}` | {s['popis']} | {s['old']} | {s['new']} | {s['source']} |")
    diff_lines.append("")

    DIFF.write_text("\n".join(diff_lines), encoding="utf-8")
    print(f"Updated {COMBINED.name}: {len(items)} → {len(new_items)} items")
    print(f"Updated via Tabulka: {upd_tabulka}, DXF: {upd_dxf}, "
          f"rounded: {rounded_up}, PSV-768 removed: {psv768_removed}, "
          f"osazení added: {osazeni_added}")
    print(f"Wrote {DIFF}")


if __name__ == "__main__":
    main()
