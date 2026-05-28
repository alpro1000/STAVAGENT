#!/usr/bin/env python3
"""
§6 — Atomic worklist Excel generator (HK212 6-sheet hybrid).

Reads outputs/atomic_decomposition_map.json (238 atomic ops). Generates
outputs/Vykaz_vymer_RD_Jachymov_ATOMIC_WORKLIST_2026-05-27.xlsx with 6 sheets:

  1. Souhrn               — structure overview + distributions
  2. 260219_DUM_HSV       — phase-ordered HSV-1..7
  3. 260219_DUM_PSV       — PSV-71..95 + M-21 folded
  4. 260219_DUM_VRN       — VRN lump-sum 1:1
  5. 260217_SKLAD         — HSV + PSV + VRN combined
  6. Composite_Decomposition_Map — parent → atomic children

Columns (HK212 style): Poř. / Kapitola / Atomic operace popis / MJ /
Množství / URS kód kandidát / Status / Parent frozen item_id /
Realizuje skladbu / Pozn.

items.json frozen NOT touched. Pattern 26 honest blanks (no 999/TBD).
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
MAP_PATH = ROOT / "outputs" / "atomic_decomposition_map.json"
TARGET = ROOT / "outputs" / "Vykaz_vymer_RD_Jachymov_ATOMIC_WORKLIST_2026-05-27.xlsx"

# Styles
THIN = Side(border_style="thin", color="999999")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEADER_FILL = PatternFill("solid", fgColor="1F3A5F")
HEADER_FONT = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)
KAP_FILL = PatternFill("solid", fgColor="D6E0F0")
KAP_FONT = Font(name="Calibri", size=10, bold=True)
BODY_FONT = Font(name="Calibri", size=9)
DECOMP_FILL = PatternFill("solid", fgColor="FFF6E0")   # decomposed children — amber tint
BLANK_FILL = PatternFill("solid", fgColor="FFE0E0")    # blank URS code — red tint
VERIFIED_FILL = PatternFill("solid", fgColor="E0F0E0") # verified — green tint
LEFT = Alignment(horizontal="left", vertical="top", wrap_text=True)
RIGHT = Alignment(horizontal="right", vertical="top")
CENTER = Alignment(horizontal="center", vertical="top")
TITLE_FONT = Font(name="Calibri", size=14, bold=True)
SECTION_FONT = Font(name="Calibri", size=11, bold=True)
NOTE_FONT = Font(name="Calibri", size=9, italic=True, color="555555")

COLS = ["Poř.", "Kapitola", "Atomic operace (popis)", "MJ", "Množství",
        "URS kód kandidát", "Status", "Parent frozen item_id",
        "Realizuje skladbu", "Pozn."]
COL_WIDTHS = [6, 22, 56, 7, 10, 16, 22, 22, 16, 50]

# Phase order within HSV/PSV per HK212 construction sequence
HSV_ORDER = ["HSV-1 Zemní práce", "HSV-2 Základové a ŽB", "HSV-3 Svislé konstrukce",
             "HSV-4 Vodorovné", "HSV-5 Krov + střecha", "HSV-5 Komunikace + schodiště",
             "HSV-6 Bourací práce", "HSV-7 Fasáda ETICS"]
PSV_ORDER = ["PSV-71 Izolace HI", "PSV-71 Izolace TI", "PSV-72 ZTI", "PSV-73 Vytápění",
             "PSV-76 Klempíř", "PSV-76 Truhlář", "PSV-76 Výplně otvorů", "PSV-76 Zámečnictví",
             "PSV-77 Podlahy", "PSV-78 Povrchové úpravy", "PSV-95 Detekce požární",
             "M-21 ELI silnoproud"]
VRN_ORDER = ["VRN — Zařízení staveniště", "VRN — Doprava + odpad", "VRN — BOZP",
             "VRN — Pojištění + zábory", "VRN — Průzkumy", "VRN — Geodet",
             "VRN — Dokumentace", "VRN — Revize", "VRN — Kolaudace", "VRN — Společné"]


def status_icon(status: str) -> str:
    s = (status or "").lower()
    if "verified" in s and "cross_discipline" not in s and "carried" not in s:
        return "✓ verified"
    if "carried_verified" in s or status == "matched_websearch_verified":
        return "✓ verified"
    if "cross_discipline" in s:
        return "✓ cross-disc"
    if "family" in s:
        return "⚠ family_only"
    if "wrong_leaf" in s:
        return "⚠ wrong_leaf"
    if "manual_lookup" in s:
        return "❌ MANUAL LOOKUP"
    if "needs_lookup" in s or "needs_production" in s:
        return "? needs_lookup"
    return f"? {status}"


def write_header(ws, row=1):
    for c, (name, w) in enumerate(zip(COLS, COL_WIDTHS), start=1):
        cell = ws.cell(row, c, value=name)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = HEADER_ALIGN
        cell.border = BORDER
        ws.column_dimensions[get_column_letter(c)].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLS))}1"


def write_op_row(ws, row, op, poradi_override=None):
    rs = op.get("realizuje_skladbu")
    if isinstance(rs, list):
        rs = ", ".join(rs)
    code = op.get("urs_kod_kandidat")
    is_decomp = op.get("decomposition_type") in ("skladba_vrstva", "fixture")
    is_blank = not code
    vals = [
        poradi_override if poradi_override is not None else op["poradi"],
        op["kapitola"],
        op["atomic_operace_popis"],
        op["mj"],
        op["mnozstvi"],
        code if code else "",
        status_icon(op.get("status")),
        f"{op['parent_frozen_item_id']} → {op['atomic_id']}" if is_decomp else op["parent_frozen_item_id"],
        rs or "",
        op.get("pozn") or "",
    ]
    for c, v in enumerate(vals, start=1):
        cell = ws.cell(row, c, value=v)
        cell.font = BODY_FONT
        cell.border = BORDER
        cell.alignment = RIGHT if c == 5 else (CENTER if c in (1, 4, 7) else LEFT)
    # Row tint
    if is_blank:
        for c in range(1, len(COLS) + 1):
            ws.cell(row, c).fill = BLANK_FILL
    elif is_decomp:
        for c in range(1, len(COLS) + 1):
            ws.cell(row, c).fill = DECOMP_FILL
    elif "verified" in (op.get("status") or "").lower():
        ws.cell(row, 7).fill = VERIFIED_FILL


def write_kapitola_divider(ws, row, kapitola, n_ops):
    cell = ws.cell(row, 1, value=f"━━ {kapitola}  ({n_ops} atomic operací) ━━")
    cell.font = KAP_FONT
    cell.fill = KAP_FILL
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=len(COLS))
    for c in range(1, len(COLS) + 1):
        ws.cell(row, c).fill = KAP_FILL


def build_profession_sheet(wb, sheet_name, ops, kapitola_order):
    ws = wb.create_sheet(sheet_name)
    write_header(ws)
    row = 2
    by_kap = defaultdict(list)
    for op in ops:
        by_kap[op["kapitola"]].append(op)
    # Order kapitolas per construction sequence; unknown kapitolas appended
    ordered_kaps = [k for k in kapitola_order if k in by_kap]
    for k in by_kap:
        if k not in ordered_kaps:
            ordered_kaps.append(k)
    seq = 0
    for kap in ordered_kaps:
        kap_ops = by_kap[kap]
        write_kapitola_divider(ws, row, kap, len(kap_ops))
        row += 1
        for op in kap_ops:
            seq += 1
            write_op_row(ws, row, op, poradi_override=seq)
            row += 1
    return ws, seq


def build_souhrn(wb, data):
    ws = wb.create_sheet("Souhrn")
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 16
    ws.column_dimensions["C"].width = 60
    summ = data["_summary"]
    r = 1
    ws.cell(r, 1, value="ATOMIC WORKLIST — RD Jáchymov Fibichova 733").font = TITLE_FONT
    r += 1
    ws.cell(r, 1, value="HK212 atomic-operation principle — composite skladby/fixtures decomposed to codeable operations").font = NOTE_FONT
    r += 2

    def section(title):
        nonlocal r
        c = ws.cell(r, 1, value=title)
        c.font = SECTION_FONT
        c.fill = KAP_FILL
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
        r += 1

    def kv(k, v, note=""):
        nonlocal r
        ws.cell(r, 1, value=k).font = BODY_FONT
        ws.cell(r, 2, value=v).font = Font(name="Calibri", size=10, bold=True)
        if note:
            ws.cell(r, 3, value=note).font = NOTE_FONT
        r += 1

    section("PŘEHLED STRUKTURY")
    kv("Frozen items (zdroj)", summ["frozen_items_total"], "items_rd_jachymov_complete.json — FROZEN, nedotčeno")
    kv("Atomic operací celkem", summ["atomic_operations_total"], "= carried 1:1 + decomposed children")
    kv("Items decomposed", summ["items_decomposed"], "composite skladby + multi-fixture")
    kv("Atomic children z dekompozice", summ["atomic_children_from_decomposition"], "")
    kv("Items carried 1:1", summ["items_carried_1to1"], "atomic + VRN lump-sum")
    r += 1

    section("ATOMIC OPERACE PER KAPITOLA")
    ws.cell(r, 1, value="Kapitola").font = HEADER_FONT
    ws.cell(r, 1).fill = HEADER_FILL
    ws.cell(r, 2, value="Počet").font = HEADER_FONT
    ws.cell(r, 2).fill = HEADER_FILL
    r += 1
    for kap, n in summ["atomic_per_kapitola"].items():
        kv(kap, n)
    r += 1

    section("URS FAMÍLIA DISTRIBUCE (54 distinct)")
    ws.cell(r, 1, value="Família").font = HEADER_FONT
    ws.cell(r, 1).fill = HEADER_FILL
    ws.cell(r, 2, value="Počet ops").font = HEADER_FONT
    ws.cell(r, 2).fill = HEADER_FILL
    r += 1
    fam_sorted = sorted(summ["familia_distribution"].items(), key=lambda x: -x[1])
    for fam, n in fam_sorted:
        note = ""
        if fam == "(blank)":
            note = "❌ MANUAL LOOKUP — Pattern 26 honest blank (NE fabrikováno)"
        kv(fam, n, note)
    r += 1

    section("METODIKA + PATTERN COMPLIANCE")
    for line in [
        "HK212 028a..f princip: composite → atomic codeable operace (per vrstva / per fixture)",
        "Pattern 15 Work-First: atomic ops = codeable units, catalog matching downstream",
        "Pattern 26: família-level URS kde leaf neznámý + status flag; 9 BLANK ops (NE 999/TBD)",
        "Pattern 28: (id, kapitola) compound key — řeší PSV76.003 ×3 + VRN.001 ×9 collisions",
        "Pattern 32: separate deliverable — items.json frozen + File A audit NEDOTČENO",
        "Traceability: každá atomic op → parent_frozen_item_id (100% coverage)",
        "Terasa A2 korekce: HSV1.005a = 636311 família (dlaždice NA TERČE, NE 762 carpentry)",
    ]:
        ws.cell(r, 1, value="• " + line).font = BODY_FONT
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
        r += 1
    return ws


def build_decomp_map(wb, data):
    ws = wb.create_sheet("Composite_Decomposition_Map")
    headers = ["Parent frozen item_id", "Kapitola", "Parent popis", "Parent MJ",
               "Parent qty", "N children", "Atomic children IDs"]
    widths = [24, 22, 50, 8, 10, 11, 40]
    for c, (h, w) in enumerate(zip(headers, widths), start=1):
        cell = ws.cell(1, c, value=h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = HEADER_ALIGN
        cell.border = BORDER
        ws.column_dimensions[get_column_letter(c)].width = w
    ws.freeze_panes = "A2"
    row = 2
    for dm in data["decomposition_map"]:
        vals = [dm["parent_frozen_item_id"], dm["parent_kapitola"], dm["parent_popis"],
                dm["parent_mj"], dm["parent_qty"], dm["n_atomic_children"],
                ", ".join(dm["atomic_children_ids"])]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(row, c, value=v)
            cell.font = BODY_FONT
            cell.border = BORDER
            cell.alignment = RIGHT if c == 5 else (CENTER if c in (4, 6) else LEFT)
            cell.fill = DECOMP_FILL
        row += 1
    return ws


def main() -> None:
    data = json.load(MAP_PATH.open())
    ops = data["atomic_operations"]

    # Partition ops
    dum_hsv = [o for o in ops if o["objekt"] == "260219_dum" and o["kapitola"].startswith("HSV")]
    dum_psv = [o for o in ops if o["objekt"] == "260219_dum" and (o["kapitola"].startswith("PSV") or o["kapitola"].startswith("M-21"))]
    dum_vrn = [o for o in ops if o["objekt"] == "260219_dum" and o["kapitola"].startswith("VRN")]
    sklad = [o for o in ops if o["objekt"] == "260217_sklad"]

    wb = Workbook()
    wb.remove(wb.active)  # drop default

    build_souhrn(wb, data)
    _, n_hsv = build_profession_sheet(wb, "260219_DUM_HSV", dum_hsv, HSV_ORDER)
    _, n_psv = build_profession_sheet(wb, "260219_DUM_PSV", dum_psv, PSV_ORDER)
    _, n_vrn = build_profession_sheet(wb, "260219_DUM_VRN", dum_vrn, VRN_ORDER)
    _, n_sklad = build_profession_sheet(wb, "260217_SKLAD", sklad, HSV_ORDER + PSV_ORDER + VRN_ORDER)
    build_decomp_map(wb, data)

    wb.save(str(TARGET))

    # Validation
    total_rows = n_hsv + n_psv + n_vrn + n_sklad
    traceability_ok = all(o.get("parent_frozen_item_id") for o in ops)
    fabricated = [o for o in ops if o.get("urs_kod_kandidat") in ("999999999", "TBD", "999")]

    print(json.dumps({
        "file": str(TARGET.relative_to(ROOT)),
        "sheets": wb.sheetnames,
        "sheet_count": len(wb.sheetnames),
        "row_counts": {
            "DUM_HSV": n_hsv, "DUM_PSV": n_psv, "DUM_VRN": n_vrn, "SKLAD": n_sklad,
            "total_atomic_rows": total_rows,
        },
        "atomic_ops_in_map": len(ops),
        "rows_match_map": total_rows == len(ops),
        "decomp_map_parents": len(data["decomposition_map"]),
        "decomp_children": sum(d["n_atomic_children"] for d in data["decomposition_map"]),
        "traceability_100pct": traceability_ok,
        "fabricated_codes": len(fabricated),
        "pattern_26_honest_blanks": data["_summary"]["familia_distribution"].get("(blank)", 0),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
