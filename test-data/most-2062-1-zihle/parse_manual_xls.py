#!/usr/bin/env python3
"""
parse_manual_xls.py — Parse user manual XLS files (SO_180 + SO_201 _JŠ.xls) into YAML.

Schema understanding (from row 0 + sample):
  Col 0: O (origin marker)
  Col 1: P
  Col 2: Úroveň ("1" for D-row třída header, ">2" for K-row položka)
  Col 3: TC (cost-center marker, e.g. "oc", "k", "fc")
  Col 4: ČP (číslo položky within třída)
  Col 5: TV (record type — D = třída header, K = položka)
  Col 6: Typ položky (HSV, PSV, M, "")
  Col 7: Kód položky (OTSKP code or třída number)
  Col 8: Popis
  Col 9: TOV (?)
  Col 10: MJ
  Col 11: Množství

Output: 04_documentation/manual_reference_JS/SO_{180,201}_parsed.yaml
"""

import xlrd
import yaml
import sys
from pathlib import Path
from collections import OrderedDict

ROOT = Path(__file__).parent
INPUT_DIR = ROOT / "inputs" / "docx"
OUTPUT_DIR = ROOT / "04_documentation" / "manual_reference_JS"

FILES = [
    ("SO 180 - Objízdná trasa - JŠ.xls", "SO_180", "Objízdná trasa (užívá se jako template pro provizorium)"),
    ("SO 201 - Most ev.č. 20-005 - JŠ.xls", "SO_201", "Most (evidenční číslo 20-005 = Kfely template, mnozstvi platná pro Žihle)"),
]


def parse_workbook(xls_path: Path, so_id: str, so_label: str) -> dict:
    wb = xlrd.open_workbook(str(xls_path), formatting_info=False)
    sh = wb.sheet_by_index(0)

    out = {
        "schema_version": 1,
        "SO": so_id,
        "label": so_label,
        "source_file": f"inputs/docx/{xls_path.name}",
        "source_rows": sh.nrows,
        "source_cols": sh.ncols,
        "tskp_classes": OrderedDict(),
        "stats": {"total_rows": 0, "polozky_total": 0, "polozky_with_quantity": 0, "tskp_classes_count": 0},
    }

    current_class = None
    for r in range(1, sh.nrows):  # skip header row
        try:
            uroven = str(sh.cell(r, 2).value).strip()
            tv = str(sh.cell(r, 5).value).strip()
            kod = str(sh.cell(r, 7).value).strip().rstrip(".0") if sh.cell(r, 7).value != "" else ""
            popis = str(sh.cell(r, 8).value).strip()
            mj = str(sh.cell(r, 10).value).strip()
            mnozstvi = sh.cell(r, 11).value
        except IndexError:
            continue

        if not popis:
            continue

        if tv == "D":
            # Třída header
            current_class = kod
            out["tskp_classes"][current_class] = OrderedDict()
            out["tskp_classes"][current_class]["nazev"] = popis
            out["tskp_classes"][current_class]["polozky"] = []
            out["stats"]["tskp_classes_count"] += 1
        elif tv == "K" and current_class is not None:
            typ = str(sh.cell(r, 6).value).strip()  # HSV / PSV / M
            cisl = sh.cell(r, 4).value
            try:
                mnozstvi_num = float(mnozstvi) if isinstance(mnozstvi, (int, float)) else (float(mnozstvi) if mnozstvi else 0.0)
            except (ValueError, TypeError):
                mnozstvi_num = 0.0
            polozka = {
                "kod": kod,
                "popis": popis,
                "mj": mj,
                "mnozstvi": mnozstvi_num,
                "typ": typ,
                "cisl": int(cisl) if isinstance(cisl, (int, float)) and cisl else None,
            }
            out["tskp_classes"][current_class]["polozky"].append(polozka)
            out["stats"]["polozky_total"] += 1
            if mnozstvi_num > 0:
                out["stats"]["polozky_with_quantity"] += 1
        out["stats"]["total_rows"] = r

    return out


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for fname, so_id, so_label in FILES:
        xls = INPUT_DIR / fname
        if not xls.exists():
            print(f"❌ NOT FOUND: {xls}", file=sys.stderr)
            continue
        parsed = parse_workbook(xls, so_id, so_label)
        out_path = OUTPUT_DIR / f"{so_id}_parsed.yaml"
        with open(out_path, "w", encoding="utf-8") as f:
            yaml.dump(parsed, f, allow_unicode=True, sort_keys=False, default_flow_style=False, width=200)
        s = parsed["stats"]
        print(f"✅ {so_id}: {s['polozky_total']} položek ({s['polozky_with_quantity']} s mnozstvi > 0), "
              f"{s['tskp_classes_count']} TSKP tříd → {out_path.name}")


if __name__ == "__main__":
    main()
