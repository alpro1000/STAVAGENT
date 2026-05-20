"""Phase 6.6 GATE 3 — Excel generator for material decomposition.

Adds two new sheets to the existing Vykaz_vymer Excel:

  * `Material_rozklad`  — detail sheet, one row per material sub-item with
                          full provenance, hyperlink back to master VV row,
                          conditional formatting by Status, alternating
                          row tint per master ID.
  * `Material_audit`    — dashboard sheet (set as ACTIVE on open):
                            block 1 hero stats
                            block 2 donut chart + table
                            block 3 per-kapitola horizontal bar chart
                            block 4 top-20 needs-VELTON-confirm
                            block 5 Case 5 masters summary
                            block 6 orphan library entries
                            block 7 vykres-annotated note
                            block 8 disclaimer footer

Main VV sheet (`1_Vykaz_vymer`) and the other 11 existing sheets are
untouched. Backup pre_phase6_6 written before overwrite. Run from repo
root.
"""
from __future__ import annotations

import json
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import openpyxl  # type: ignore[import-not-found]
from openpyxl.chart import BarChart, DoughnutChart, Reference  # type: ignore[import-not-found]
from openpyxl.chart.label import DataLabelList  # type: ignore[import-not-found]
from openpyxl.formatting.rule import CellIsRule  # type: ignore[import-not-found]
from openpyxl.styles import (Alignment, Border, Font, PatternFill,  # type: ignore[import-not-found]
                              Side)
from openpyxl.utils import get_column_letter  # type: ignore[import-not-found]
from openpyxl.workbook.defined_name import DefinedName  # type: ignore[import-not-found]

REPO_ROOT = Path(__file__).resolve().parents[4]
LIBUSE = REPO_ROOT / "test-data" / "libuse"
OUTPUTS = LIBUSE / "outputs"

EXCEL_TARGET = OUTPUTS / "Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx"
EXCEL_BACKUP = OUTPUTS / "Vykaz_vymer_pre_phase6_6.xlsx"
ITEMS_IN = OUTPUTS / "items_objekt_D_with_materials.json"
LIBRARY_IN = OUTPUTS / "material_library_D.json"

ROZKLAD_SHEET = "Material_rozklad"
AUDIT_SHEET = "Material_audit"
VV_SHEET = "1_Vykaz_vymer"

# Status fills per user spec
STATUS_FILLS: dict[str, tuple[str, str]] = {
    # status_label → (bg hex, font hex)
    "OK":      ("C6EFCE", "006100"),
    "Confirm": ("FFEB9C", "9C5700"),
    "Odhad":   ("FFC09A", "974706"),
    "Missing": ("FFC7CE", "9C0006"),
}

# Donut chart colors per source provenance
SOURCE_COLORS: dict[str, str] = {
    "tz_explicit_with_rate":    "00B050",  # bright green
    "tz_explicit_no_rate":      "92D050",  # lighter green
    "tabulka_referenced":       "FFC000",  # orange
    "vykres_annotated":         "00B0F0",  # blue
    "generic_no_documentation": "FF6B6B",  # red
}

THIN = Side(style="thin", color="B0B0B0")
BORDER_ALL = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
BOLD = Font(bold=True)
BIG_BOLD = Font(bold=True, size=18)
HERO_FONT = Font(bold=True, size=22, color="2C5F8D")
TITLE_FONT = Font(bold=True, size=14, color="2C5F8D")
SMALL_ITALIC = Font(size=9, italic=True, color="606060")

CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT_WRAP = Alignment(horizontal="left", vertical="top", wrap_text=True)


def _load_data() -> tuple[list[dict], list[dict], list[dict]]:
    items_data = json.loads(ITEMS_IN.read_text(encoding="utf-8"))
    library_data = json.loads(LIBRARY_IN.read_text(encoding="utf-8"))

    masters: list[dict] = []
    sub_items: list[dict] = []
    for it in items_data["items"]:
        if it.get("item_role") == "material_subitem":
            sub_items.append(it)
        else:
            masters.append(it)
    library = library_data["materials"]
    return masters, sub_items, library


def _build_master_row_map(masters: list[dict]) -> dict[str, int]:
    """Master items appear in VV at row index i+2 (1-indexed, +1 header)."""
    return {m["item_id"]: i + 2 for i, m in enumerate(masters)}


def _format_qty(q: Any) -> str:
    if q is None:
        return ""
    try:
        v = float(q)
    except (ValueError, TypeError):
        return str(q)
    if v == int(v):
        return f"{int(v):,}".replace(",", " ")
    return f"{v:,.2f}".replace(",", " ")


def _format_master_qty_mj(master: dict) -> str:
    q = master.get("mnozstvi")
    mj = master.get("MJ") or ""
    if q is None:
        return mj
    return f"{_format_qty(q)} {mj}".strip()


def _build_material_rozklad(wb: openpyxl.Workbook, masters: list[dict],
                            sub_items: list[dict],
                            master_by_id: dict[str, dict],
                            master_row_in_vv: dict[str, int]) -> None:
    if ROZKLAD_SHEET in wb.sheetnames:
        del wb[ROZKLAD_SHEET]
    ws = wb.create_sheet(ROZKLAD_SHEET)

    headers = ["Master ID", "Kapitola", "Master popis", "Master qty + MJ",
               "#", "Materiál", "Spotřeba na MJ", "Sub-qty", "MJ",
               "Zdroj", "Confidence", "Status"]
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(1, c, h)
        cell.font = BOLD
        cell.alignment = CENTER
        cell.fill = PatternFill(start_color="D9E2F3", end_color="D9E2F3",
                                 fill_type="solid")
        cell.border = BORDER_ALL

    # Sort sub-items by (master kapitola, master popis, master_id) for grouping
    def master_key(s: dict) -> tuple[str, str, str]:
        m = master_by_id.get(s["paired_with"], {})
        return (m.get("kapitola") or "", m.get("popis") or "", s["paired_with"])

    sub_items_sorted = sorted(sub_items, key=master_key)

    # Build per-master ordinal (sub-item # within master) and color group
    sub_idx_in_master: dict[str, int] = defaultdict(int)
    master_color_idx: dict[str, int] = {}
    color_counter = 0

    # Subtle alternating tint per master ID
    TINT_A = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    TINT_B = PatternFill(start_color="F4F6FA", end_color="F4F6FA", fill_type="solid")

    for row_idx, sub in enumerate(sub_items_sorted, start=2):
        master = master_by_id.get(sub["paired_with"])
        if master is None:
            continue
        sub_idx_in_master[master["item_id"]] += 1
        if master["item_id"] not in master_color_idx:
            master_color_idx[master["item_id"]] = color_counter % 2
            color_counter += 1
        tint = TINT_A if master_color_idx[master["item_id"]] == 0 else TINT_B

        # Column A — Master ID (hyperlink → VV!A{row})
        master_short = master["item_id"][:12] + "…"
        cell_a = ws.cell(row_idx, 1, master_short)
        vv_row = master_row_in_vv.get(master["item_id"])
        if vv_row:
            cell_a.hyperlink = f"#'{VV_SHEET}'!A{vv_row}"
            cell_a.font = Font(color="0563C1", underline="single", size=10)
        else:
            cell_a.font = Font(size=10)

        ws.cell(row_idx, 2, master.get("kapitola") or "")
        ws.cell(row_idx, 3, master.get("popis") or "")
        ws.cell(row_idx, 4, _format_master_qty_mj(master))
        ws.cell(row_idx, 5, sub_idx_in_master[master["item_id"]])
        ws.cell(row_idx, 6, sub.get("popis") or "")

        # Spotřeba na MJ
        rate_str = ""
        if sub.get("rate_value") and sub.get("rate_unit_num") and sub.get("rate_unit_denom"):
            rate_str = f"{sub['rate_value']:g} {sub['rate_unit_num']}/{sub['rate_unit_denom']}"
        ws.cell(row_idx, 7, rate_str)

        ws.cell(row_idx, 8, sub.get("mnozstvi"))
        ws.cell(row_idx, 9, sub.get("MJ") or "")
        ws.cell(row_idx, 10, sub.get("zdroj_marker") or "")
        ws.cell(row_idx, 11, sub.get("confidence"))
        ws.cell(row_idx, 12, sub.get("status_label") or "")

        # Apply tint to entire row
        for c in range(1, len(headers) + 1):
            cur_fill = ws.cell(row_idx, c).fill
            # Don't override status column (handled by conditional formatting)
            if c == 12:
                continue
            ws.cell(row_idx, c).fill = tint
            ws.cell(row_idx, c).border = BORDER_ALL

    # Status column conditional formatting
    last_row = len(sub_items_sorted) + 1
    status_range = f"L2:L{last_row}"
    for status, (bg, fg) in STATUS_FILLS.items():
        ws.conditional_formatting.add(
            status_range,
            CellIsRule(operator="equal", formula=[f'"{status}"'],
                       fill=PatternFill(start_color=bg, end_color=bg,
                                         fill_type="solid"),
                       font=Font(color=fg, bold=True)),
        )

    # Column widths
    widths = [16, 12, 38, 16, 5, 38, 14, 12, 8, 38, 11, 11]
    for c, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(c)].width = w

    # Header freeze + auto-filter
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:L{last_row}"

    # Title cell A0 not feasible — sheet tab name + first row header are it.


# ----------------------------------------------------------------------------

def _build_material_audit(wb: openpyxl.Workbook, masters: list[dict],
                          sub_items: list[dict], library: list[dict]) -> None:
    if AUDIT_SHEET in wb.sheetnames:
        del wb[AUDIT_SHEET]
    ws = wb.create_sheet(AUDIT_SHEET, 0)  # Insert as first sheet

    # Compute stats
    by_source: Counter[str] = Counter(s["source"] for s in sub_items)
    total_subs = len(sub_items)
    documented = sum(by_source.get(k, 0) for k in
                     ["tz_explicit_with_rate", "tz_explicit_no_rate",
                      "tabulka_referenced", "vykres_annotated"])
    documented_pct = round(documented / max(total_subs, 1) * 100, 1)
    n_unique_materials = len(set(s.get("source_entry_id") for s in sub_items
                                  if s.get("source_entry_id")))
    n_library_citations = sum(1 for s in sub_items if s.get("source_entry_id"))

    # ----- Block 1: HERO STATS -----
    ws.merge_cells("A1:H1")
    ws["A1"] = "PHASE 6.6 — Rozklad materiálů"
    ws["A1"].font = HERO_FONT
    ws["A1"].alignment = CENTER

    ws.merge_cells("A2:H2")
    ws["A2"] = "Objekt D, akce 185-01, Bytový soubor Libuše"
    ws["A2"].font = Font(size=11, italic=True, color="606060")
    ws["A2"].alignment = CENTER

    ws.merge_cells("A4:H4")
    ws["A4"] = f"{documented_pct:.1f} % sub-položek má dokumentovaný zdroj (TZ + tabulky + výkresy)"
    ws["A4"].font = Font(bold=True, size=16, color="008B8B")
    ws["A4"].alignment = CENTER

    ws.merge_cells("A5:H5")
    ws["A5"] = (f"{len(masters):,} master položek · {total_subs:,} sub-položek "
                f"materiálů · {n_unique_materials} kanonických materiálů "
                f"z library citováno {n_library_citations}×")
    ws["A5"].font = Font(size=11, color="606060")
    ws["A5"].alignment = CENTER

    # Spacer rows
    row = 7

    # ----- Block 2: PROVENANCE BREAKDOWN -----
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = "Rozklad podle zdroje provenance"
    ws[f"A{row}"].font = TITLE_FONT
    row += 2

    # Table (cols A-D), chart anchored to F:H
    chart_start_row = row
    ws.cell(row, 1, "Zdroj"); ws.cell(row, 1).font = BOLD
    ws.cell(row, 2, "Počet"); ws.cell(row, 2).font = BOLD
    ws.cell(row, 3, "%"); ws.cell(row, 3).font = BOLD
    ws.cell(row, 4, "Status"); ws.cell(row, 4).font = BOLD
    row += 1
    provenance_rows = [
        ("TZ — explicit rate", "tz_explicit_with_rate", "OK"),
        ("TZ — explicit material", "tz_explicit_no_rate", "Confirm"),
        ("Tabulka — referenced", "tabulka_referenced", "OK"),
        ("Výkres — annotated", "vykres_annotated", "Confirm"),
        ("Generic odhad (KB)", "generic_no_documentation", "Odhad"),
    ]
    table_first_row = row
    for label, src_key, status in provenance_rows:
        n = by_source.get(src_key, 0)
        pct = n / max(total_subs, 1) * 100
        ws.cell(row, 1, label)
        ws.cell(row, 2, n)
        ws.cell(row, 3, round(pct, 1))
        ws.cell(row, 4, status)
        for c in range(1, 5):
            ws.cell(row, c).border = BORDER_ALL
        # Apply Status fill manually (Material_audit doesn't use conditional fmt)
        if status in STATUS_FILLS:
            bg, fg = STATUS_FILLS[status]
            ws.cell(row, 4).fill = PatternFill(start_color=bg, end_color=bg,
                                                 fill_type="solid")
            ws.cell(row, 4).font = Font(color=fg, bold=True)
        row += 1
    table_last_row = row - 1

    # Add doughnut chart
    chart = DoughnutChart()
    chart.title = "Sub-items podle zdroje"
    labels = Reference(ws, min_col=1, min_row=table_first_row,
                      max_row=table_last_row)
    data = Reference(ws, min_col=2, min_row=chart_start_row,
                    max_row=table_last_row)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(labels)
    chart.height = 8
    chart.width = 14
    ws.add_chart(chart, f"F{chart_start_row}")

    row += 2  # spacer

    # ----- Block 3: PER-KAPITOLA COVERAGE -----
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = "Pokrytí podle kapitoly (% sub-položek s dokumentovaným zdrojem)"
    ws[f"A{row}"].font = TITLE_FONT
    row += 2

    # Compute per-kapitola coverage from sub_items
    kap_counts: dict[str, dict[str, int]] = defaultdict(lambda: {"doc": 0, "tot": 0})
    for s in sub_items:
        k = s.get("kapitola") or "?"
        kap_counts[k]["tot"] += 1
        if s["source"] != "generic_no_documentation":
            kap_counts[k]["doc"] += 1

    # Sort by total descending, top 20
    sorted_kaps = sorted(kap_counts.items(), key=lambda x: -x[1]["tot"])[:20]

    bar_first_row = row
    ws.cell(row, 1, "Kapitola"); ws.cell(row, 1).font = BOLD
    ws.cell(row, 2, "% dokumentováno"); ws.cell(row, 2).font = BOLD
    ws.cell(row, 3, "Sub-items celkem"); ws.cell(row, 3).font = BOLD
    row += 1
    bar_data_first = row
    for kap, counts in sorted_kaps:
        pct = counts["doc"] / max(counts["tot"], 1) * 100
        ws.cell(row, 1, kap)
        ws.cell(row, 2, round(pct, 1))
        ws.cell(row, 3, counts["tot"])
        for c in range(1, 4):
            ws.cell(row, c).border = BORDER_ALL
        # Tinted fill on % column
        if pct > 70:
            bg = "C6EFCE"
        elif pct >= 40:
            bg = "FFEB9C"
        else:
            bg = "FFC09A"
        ws.cell(row, 2).fill = PatternFill(start_color=bg, end_color=bg,
                                            fill_type="solid")
        row += 1
    bar_data_last = row - 1

    bar_chart = BarChart()
    bar_chart.type = "bar"
    bar_chart.style = 11
    bar_chart.title = "Pokrytí podle kapitoly (top 20)"
    bar_chart.x_axis.title = "% dokumentováno"
    bar_chart.y_axis.title = "Kapitola"
    bar_chart.height = 12
    bar_chart.width = 18
    bar_labels = Reference(ws, min_col=1, min_row=bar_data_first,
                          max_row=bar_data_last)
    bar_data = Reference(ws, min_col=2, min_row=bar_first_row,
                        max_row=bar_data_last)
    bar_chart.add_data(bar_data, titles_from_data=True)
    bar_chart.set_categories(bar_labels)
    ws.add_chart(bar_chart, f"F{bar_first_row}")

    row += 2

    # ----- Block 4: TOP-20 needs-VELTON-confirm -----
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = "Top 20 sub-položek vyžadujících konfirmaci VELTON (confidence ≤ 0.5)"
    ws[f"A{row}"].font = TITLE_FONT
    row += 2

    headers4 = ["Master kapitola", "Materiál", "Sub-qty", "MJ", "Zdroj", "Důvod"]
    for c, h in enumerate(headers4, start=1):
        ws.cell(row, c, h)
        ws.cell(row, c).font = BOLD
        ws.cell(row, c).border = BORDER_ALL
    row += 1
    # Filter sub-items with conf ≤ 0.5, sort by master qty desc
    needs_confirm = [s for s in sub_items if s.get("confidence", 1.0) <= 0.5]
    # Resolve master qty for sort
    needs_confirm_sorted: list[tuple[float, dict]] = []
    masters_by_id = {m["item_id"]: m for m in masters}
    for s in needs_confirm:
        m = masters_by_id.get(s["paired_with"])
        master_qty = float(m.get("mnozstvi", 0) or 0) if m else 0
        needs_confirm_sorted.append((master_qty, s))
    needs_confirm_sorted.sort(key=lambda x: -x[0])
    for _, s in needs_confirm_sorted[:20]:
        ws.cell(row, 1, s.get("kapitola") or "")
        ws.cell(row, 2, s.get("popis") or "")
        ws.cell(row, 3, s.get("mnozstvi"))
        ws.cell(row, 4, s.get("MJ") or "")
        ws.cell(row, 5, s.get("zdroj_marker") or "")
        reason = "Confidence " + str(s.get("confidence"))
        if s["source"] == "tz_explicit_no_rate":
            reason += " · rate z generic KB"
        elif s["source"] == "generic_no_documentation":
            reason += " · materiál i rate generic"
        ws.cell(row, 6, reason)
        for c in range(1, 7):
            ws.cell(row, c).border = BORDER_ALL
        row += 1

    row += 2

    # ----- Block 5: Case 5 masters -----
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = "Case 5 — master items, které jsou samy materiálovou specifikací"
    ws[f"A{row}"].font = TITLE_FONT
    row += 1
    ws.merge_cells(f"A{row}:H{row}")
    # Detect Case 5 masters: existed in items but received no sub-items.
    # Mirror the pair script's Case-5 keyword set to filter out other
    # no-pairing reasons (skipped_status, no_kapitola_rule, …).
    paired_master_ids = set(s["paired_with"] for s in sub_items)
    case5_candidates = [m for m in masters
                        if m["item_id"] not in paired_master_ids
                        and m.get("mnozstvi", 0)
                        and m.get("status") not in {"deprecated",
                            "WRONGLY_ATTRIBUTED_TO_D", "interpretace_pending_ABMV"}]
    CASE5_KW = ["penetrace pod", "penetrace univerzá", "lepidlo flexib",
                "lepidlo na", "spárovací hmot", "sparovaci hmot",
                "samonivelační stěr", "samonivelacni ster",
                "kari síť", "kari sit", "pe fólie", "pe folie",
                "asfaltový pás", "asfaltovy pas",
                "armovací síť", "armovaci sit",
                "tmel ", "akrylový "]
    def _is_case5(popis: str) -> bool:
        norm = (popis or "").lower()
        return any(kw in norm for kw in CASE5_KW)

    case5_real = [m for m in case5_candidates if _is_case5(m.get("popis", ""))]
    ws[f"A{row}"] = (f"{len(case5_real)} master items jsou samy materiálovou "
                    f"specifikací (penetrace, lepidla, hydroizolace, izolace, "
                    f"SDK desky, kari síť, asfaltové pásy, …). "
                    f"Sub-items se pro ně negenerují by design — master "
                    f"řádek v List 1 Vykaz_vymer je už kompletní položka.")
    ws[f"A{row}"].font = Font(size=10)
    ws[f"A{row}"].alignment = LEFT_WRAP
    ws.row_dimensions[row].height = 50
    row += 2

    # Top 10 Case 5 by qty
    ws.cell(row, 1, "Top 10 podle qty:"); ws.cell(row, 1).font = BOLD
    row += 1
    headers5 = ["Kapitola", "Popis", "Qty", "MJ"]
    for c, h in enumerate(headers5, start=1):
        ws.cell(row, c, h); ws.cell(row, c).font = BOLD
        ws.cell(row, c).border = BORDER_ALL
    row += 1
    case5_sorted = sorted(case5_real,
                          key=lambda m: -float(m.get("mnozstvi", 0) or 0))
    for m in case5_sorted[:10]:
        ws.cell(row, 1, m.get("kapitola") or "")
        ws.cell(row, 2, m.get("popis") or "")
        ws.cell(row, 3, m.get("mnozstvi"))
        ws.cell(row, 4, m.get("MJ") or "")
        for c in range(1, 5):
            ws.cell(row, c).border = BORDER_ALL
        row += 1

    row += 2

    # ----- Block 6: Orphan library entries -----
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = "Orphan library entries (extracted but not auto-paired)"
    ws[f"A{row}"].font = TITLE_FONT
    row += 1
    used_lib_ids = set(s.get("source_entry_id") for s in sub_items
                       if s.get("source_entry_id"))
    orphans = [e for e in library if e["material_id"] not in used_lib_ids]
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = (f"{len(orphans)} library entries extracted in GATE 1 ale "
                    f"nenavázány na žádnou master položku. Důvody: chybějící "
                    f"kapitola_proposed (typicky vykres entries), nemapovaná "
                    f"taxonomy (material_kind=None), nebo kapitola bez "
                    f"pairing rule. Záznamy zůstávají v material_library_D."
                    f"json pro budoucí review / manuální párování.")
    ws[f"A{row}"].font = Font(size=10)
    ws[f"A{row}"].alignment = LEFT_WRAP
    ws.row_dimensions[row].height = 50
    row += 2

    # Top 10 by source document
    ws.cell(row, 1, "Top 10 podle zdrojového dokumentu:"); ws.cell(row, 1).font = BOLD
    row += 1
    orphan_by_doc: Counter[str] = Counter(o["source"]["document"] for o in orphans)
    ws.cell(row, 1, "Dokument"); ws.cell(row, 1).font = BOLD
    ws.cell(row, 2, "Orphan count"); ws.cell(row, 2).font = BOLD
    for c in range(1, 3):
        ws.cell(row, c).border = BORDER_ALL
    row += 1
    for doc, n in orphan_by_doc.most_common(10):
        ws.cell(row, 1, doc[:70])
        ws.cell(row, 2, n)
        ws.cell(row, 1).border = BORDER_ALL
        ws.cell(row, 2).border = BORDER_ALL
        row += 1

    row += 2

    # ----- Block 7: Výkres-annotated note -----
    n_vykres = sum(1 for e in library if e["source"]["type"] == "vykres_annotated")
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = "Výkres-annotated entries — proč 0 paired sub-items"
    ws[f"A{row}"].font = TITLE_FONT
    row += 1
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = (
        f"{n_vykres} výkres-annotated library entries z GATE 1 (Kniha "
        f"detailů + Zásady spárořezu) popisují principles of detailing "
        f"(napojení oken na fasádu, řešení nadpraží, parapetů, ostění, "
        f"přechodů terras na fasádu, spárořez obkladů), nikoliv konkrétní "
        f"materiálové kvantity vázané na master položku. Zůstávají dostupné "
        f"v material_library_D.json pro budoucí referenci a pro VELTON "
        f"review konzistence detailů; sub-items pro ně negenerují by design."
    )
    ws[f"A{row}"].font = Font(size=10)
    ws[f"A{row}"].alignment = LEFT_WRAP
    ws.row_dimensions[row].height = 75
    row += 2

    # ----- Block 8: DISCLAIMER FOOTER -----
    row += 1
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = (
        "Tento dokument je technický rozklad materiálů na základě "
        "dostupné projektové dokumentace (TZ, tabulky skladeb, výkresy "
        "detailu). Položky označené ⚠ ODHAD jsou estimator's expansion "
        "na základě industry standardů (ČSN, typická spotřeba), ne "
        "závazné množství z projektu. Pro cenotvorbu doporučujeme "
        "konfirmaci výrobci materiálů nebo aktualizaci projektové "
        "dokumentace."
    )
    ws[f"A{row}"].font = SMALL_ITALIC
    ws[f"A{row}"].alignment = LEFT_WRAP
    ws.row_dimensions[row].height = 70

    # Generated timestamp
    row += 2
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = (f"Generováno: {datetime.now(timezone.utc).isoformat(timespec='seconds')} "
                    f"· Phase 6.6 GATE 3 · Branch claude/tz-material-decomposition-lBp5D")
    ws[f"A{row}"].font = Font(size=8, italic=True, color="909090")
    ws[f"A{row}"].alignment = CENTER

    # Column widths
    widths_audit = [20, 50, 14, 8, 32, 32, 12, 12]
    for c, w in enumerate(widths_audit, start=1):
        ws.column_dimensions[get_column_letter(c)].width = w


def main() -> int:
    print("Phase 6.6 GATE 3 — Excel generator")
    print("=" * 60)

    masters, sub_items, library = _load_data()
    print(f"  masters:    {len(masters):,}")
    print(f"  sub-items:  {len(sub_items):,}")
    print(f"  library:    {len(library):,}")

    if not EXCEL_TARGET.exists():
        print(f"ERR: target Excel not found at {EXCEL_TARGET}", file=sys.stderr)
        return 1

    # Backup (idempotent — only write if backup absent so a re-run
    # doesn't clobber the pre-Phase-6.6 snapshot with a post-6.6 file)
    if EXCEL_BACKUP.exists():
        print(f"\n[1/4] Backup already exists, preserving: "
              f"{EXCEL_BACKUP.relative_to(REPO_ROOT)} "
              f"({EXCEL_BACKUP.stat().st_size:,} bytes)")
    else:
        shutil.copy2(EXCEL_TARGET, EXCEL_BACKUP)
        print(f"\n[1/4] Backup: {EXCEL_BACKUP.relative_to(REPO_ROOT)} "
              f"({EXCEL_BACKUP.stat().st_size:,} bytes)")

    # Load workbook + master-row map (built from masters in items.json order)
    print(f"\n[2/4] Loading workbook + computing master→VV row map...")
    wb = openpyxl.load_workbook(str(EXCEL_TARGET))
    master_row_in_vv = _build_master_row_map(masters)
    master_by_id = {m["item_id"]: m for m in masters}
    print(f"      Loaded {len(wb.sheetnames)} sheets, mapped "
          f"{len(master_row_in_vv)} masters")

    print(f"\n[3/4] Building Material_rozklad sheet...")
    _build_material_rozklad(wb, masters, sub_items, master_by_id, master_row_in_vv)
    rozklad_ws = wb[ROZKLAD_SHEET]
    print(f"      → {rozklad_ws.max_row - 1} sub-item rows")

    print(f"\n[4/4] Building Material_audit sheet (dashboard)...")
    _build_material_audit(wb, masters, sub_items, library)

    # Set Material_audit as active sheet (opens first)
    audit_idx = wb.sheetnames.index(AUDIT_SHEET)
    wb.active = audit_idx
    print(f"      → set as active sheet (index {audit_idx})")

    # Move Material_rozklad to second position (after audit)
    rozklad_idx = wb.sheetnames.index(ROZKLAD_SHEET)
    wb.move_sheet(ROZKLAD_SHEET, offset=1 - rozklad_idx)

    wb.save(str(EXCEL_TARGET))
    print(f"\nWrote {EXCEL_TARGET.relative_to(REPO_ROOT)} "
          f"({EXCEL_TARGET.stat().st_size:,} bytes)")
    print(f"\nSheets in final file (order):")
    wb2 = openpyxl.load_workbook(str(EXCEL_TARGET), read_only=True)
    for i, sn in enumerate(wb2.sheetnames):
        active_marker = "  ← ACTIVE" if i == wb2.active else ""
        print(f"  {i+1:2d}. {sn}{active_marker}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
