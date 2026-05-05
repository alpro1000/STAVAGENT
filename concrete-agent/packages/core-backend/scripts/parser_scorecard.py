"""Phase 2 step 5 — quality scorecard across 14 DXFs (12 valid, 2 skipped)."""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path("concrete-agent/packages/core-backend").resolve()))

from app.services.dxf_parser import parse_batch, PREFIX_CATEGORY  # noqa: E402

DXF_DIR = Path("test-data/libuse/inputs/dxf")
TABULKA = Path(
    "test-data/libuse/inputs/185-01_DPS_D_SO01_100_0020_R01_TABULKA MISTNOSTI.xlsx"
)
OUT = Path("test-data/libuse/outputs/dxf_parser_quality_scorecard.md")


# Drawing role classification — different drawing types have different
# expectations for what the parser should find.
def classify_drawing(stem: str) -> str:
    s = stem.lower()
    if "ars" in s and "desky" in s:
        return "skipped"
    if "odvodneni" in s:
        return "skipped"
    if "půdorys" in s or "pudorys" in s or "půdorys 1pp" in s or "pudorys 1pp" in s:
        if "střecha" in s or "strecha" in s:
            return "roof_plan"
        return "primary_pudorys"
    if "podhled" in s:
        return "podhledy_plan"
    if "řezy" in s or "rezy" in s:
        return "section"
    if "pohledy" in s:
        return "elevation"
    if "jadra" in s:
        return "coordination"
    return "other"


# Per-role acceptance thresholds.
ROLE_THRESHOLDS = {
    # rooms_with_code, polygon_match, doors_w_code, windows_w_code
    "primary_pudorys": (0.95, 0.90, 0.70, 0.70),
    "podhledy_plan":   (0.95, 0.90, None, None),  # podhledy don't need opening tags
    "roof_plan":       (None, None, None, 0.10),  # roof plans show střešní okna only
    "section":         (None, None, None, None),  # sections — informational
    "elevation":       (None, None, None, None),  # elevations — informational
    "coordination":    (None, None, None, None),  # internal layouts
    "other":           (None, None, None, None),
}


def load_tabulka() -> dict[str, dict]:
    wb = openpyxl.load_workbook(str(TABULKA), data_only=True)
    ws = wb["tabulka místností"]
    out: dict[str, dict] = {}
    for row in ws.iter_rows(min_row=7, values_only=True):
        code = row[0]
        if code is None:
            continue
        code = str(code).strip()
        if not re.match(r"^[A-D]\.|^S\.", code):
            continue
        try:
            plocha = float(str(row[2]).replace(",", ".").replace(" ", "")) if row[2] else None
        except Exception:
            plocha = None
        out[code] = {"nazev": (row[1] or "").strip(), "plocha_m2": plocha}
    return out


def is_d_code(c: str) -> bool:
    """Is this a D-related code? Includes D.* and S.D.* (sklepy assigned to D)."""
    if c.startswith("D."):
        return True
    if c.startswith("S.") and len(c.split(".")) == 3 and c.split(".")[1] == "D":
        return True
    return False


tabulka = load_tabulka()
print(f"Tabulka loaded: {len(tabulka)} entries (D-related: {sum(1 for c in tabulka if is_d_code(c))})")

paths = sorted(DXF_DIR.glob("*.dxf"))
print(f"Parsing {len(paths)} DXFs…")
parsed = parse_batch(paths)

# Filter into valid vs skipped
valid = {k: v for k, v in parsed.items() if not v.skipped}
skipped = {k: v for k, v in parsed.items() if v.skipped}

# Aggregate (raw, may include cross-drawing duplicates)
total_doors = total_door_with_code = 0
total_windows = total_window_with_code = 0
total_curtain = 0
total_warnings = sum(len(p.warnings) for p in valid.values())
total_duration = sum(p.parse_duration_ms for p in valid.values())

# Dedupe rooms by code (parser sees the same code on multiple drawings)
dxf_rooms_all: dict[str, "RoomGeometry"] = {}
for p in valid.values():
    for r in p.rooms:
        if r.area_m2 is None:
            continue
        if r.code not in dxf_rooms_all:
            dxf_rooms_all[r.code] = r

# Cross-validation against Tabulka — D-related codes only (DWG covers only D)
d_codes_tab = sorted(c for c in tabulka if is_d_code(c))
in_both = [c for c in d_codes_tab if c in dxf_rooms_all]
tab_only = [c for c in d_codes_tab if c not in dxf_rooms_all]
dxf_only = sorted(c for c in dxf_rooms_all if is_d_code(c) and c not in tabulka)

discrepancies: list[tuple[str, float, float, float]] = []
for c in in_both:
    tab_a = tabulka[c]["plocha_m2"]
    dxf_a = dxf_rooms_all[c].area_m2
    if tab_a is None or dxf_a is None:
        continue
    diff = ((dxf_a - tab_a) / tab_a) * 100.0
    discrepancies.append((c, tab_a, dxf_a, diff))
within = [d for d in discrepancies if abs(d[3]) <= 2.0]
outside = [d for d in discrepancies if abs(d[3]) > 2.0]

# Segment tag aggregations
prefix_count: Counter = Counter()
prefix_drawings: dict[str, set[str]] = {}
for stem, p in valid.items():
    for st in p.segment_tags:
        prefix_count[st.prefix] += 1
        prefix_drawings.setdefault(st.prefix, set()).add(stem)


# === Per-drawing verdict ===
def per_drawing_verdict(stem: str, p) -> tuple[str, list[str]]:
    role = classify_drawing(stem)
    notes: list[str] = []
    if role == "skipped":
        return "skipped", []
    rooms_total = len(p.rooms)
    rooms_w_code = sum(1 for r in p.rooms if r.code)
    rooms_w_area = sum(1 for r in p.rooms if r.area_m2 is not None)
    n_door = sum(1 for o in p.openings if o.otvor_type == "door")
    n_door_c = sum(1 for o in p.openings if o.otvor_type == "door" and o.type_code)
    n_win = sum(1 for o in p.openings if o.otvor_type == "window")
    n_win_c = sum(1 for o in p.openings if o.otvor_type == "window" and o.type_code)
    th_rcode, th_poly, th_door, th_win = ROLE_THRESHOLDS.get(role, (None, None, None, None))
    bad = 0
    if th_rcode is not None and rooms_total > 0:
        rate = rooms_w_code / rooms_total
        if rate < th_rcode:
            bad += 1
            notes.append(f"rooms_w_code {rate:.0%} < {th_rcode:.0%}")
    if th_poly is not None and rooms_total > 0:
        rate = rooms_w_area / rooms_total
        if rate < th_poly:
            bad += 1
            notes.append(f"polygon_match {rate:.0%} < {th_poly:.0%}")
    if th_door is not None and n_door > 0:
        rate = n_door_c / n_door
        if rate < th_door:
            bad += 1
            notes.append(f"doors_w_code {rate:.0%} < {th_door:.0%}")
    if th_win is not None and n_win > 0:
        rate = n_win_c / n_win
        if rate < th_win:
            bad += 1
            notes.append(f"windows_w_code {rate:.0%} < {th_win:.0%}")
    if bad == 0:
        return "pass", notes
    return "review", notes


# === Build the report ===
lines: list[str] = []
lines.append("# DXF Parser Quality Scorecard")
lines.append("")
lines.append("**Generated:** Phase 2 step 5  ")
lines.append("**Branch:** `claude/phase-0-5-batch-and-parser`  ")
lines.append("**Parser:** `concrete-agent/packages/core-backend/app/services/dxf_parser.py`  ")
lines.append("**Source:** 14 DXF files in `test-data/libuse/inputs/dxf/`  ")
lines.append("")
lines.append("## Per-drawing summary")
lines.append("")
lines.append(
    "| # | DXF | Role | Rooms / w-code / w-area | Doors / w-code | Wins / w-code | Curt | Tags | Verdict |"
)
lines.append("|---|---|---|---|---|---|---:|---:|---|")
for i, (stem, p) in enumerate(parsed.items(), 1):
    role = classify_drawing(stem)
    if p.skipped:
        lines.append(f"| {i} | `{stem[:60]}` | SKIP | — | — | — | — | — | skipped |")
        continue
    n_rooms = len(p.rooms)
    n_rcode = sum(1 for r in p.rooms if r.code)
    n_rarea = sum(1 for r in p.rooms if r.area_m2 is not None)
    n_door = sum(1 for o in p.openings if o.otvor_type == "door")
    n_door_c = sum(1 for o in p.openings if o.otvor_type == "door" and o.type_code)
    n_win = sum(1 for o in p.openings if o.otvor_type == "window")
    n_win_c = sum(1 for o in p.openings if o.otvor_type == "window" and o.type_code)
    n_curt = sum(1 for o in p.openings if o.otvor_type == "curtain_wall")
    n_tags = len(p.segment_tags)
    verdict, notes = per_drawing_verdict(stem, p)
    icon = {"pass": "✅", "review": "⚠️", "skipped": "—"}.get(verdict, "?")
    notes_str = ("; ".join(notes)) if notes else ""
    lines.append(
        f"| {i} | `{stem[:60]}` | {role} | {n_rooms} / {n_rcode} / {n_rarea} | "
        f"{n_door} / {n_door_c} | {n_win} / {n_win_c} | {n_curt} | {n_tags} | "
        f"{icon} {verdict} {notes_str} |"
    )
lines.append("")

# Aggregate doors/windows for the headline
for p in valid.values():
    for o in p.openings:
        if o.otvor_type == "door":
            total_doors += 1
            if o.type_code:
                total_door_with_code += 1
        elif o.otvor_type == "window":
            total_windows += 1
            if o.type_code:
                total_window_with_code += 1
        elif o.otvor_type == "curtain_wall":
            total_curtain += 1

# Per-role roll-up
role_rollup: dict[str, list[str]] = {}
for stem, p in valid.items():
    role = classify_drawing(stem)
    role_rollup.setdefault(role, []).append(stem)

lines.append("## Drawing roles")
lines.append("")
lines.append(
    "Drawing types have different expected content; the verdict applies "
    "role-specific thresholds (e.g. podhledy don't need opening tags, sections "
    "don't need rooms)."
)
lines.append("")
lines.append("| Role | Drawings | Threshold (rooms_w_code / poly_match / doors / windows) |")
lines.append("|---|---:|---|")
for role in sorted(role_rollup):
    th = ROLE_THRESHOLDS.get(role, (None, None, None, None))
    th_str = " / ".join("—" if t is None else f"{t:.0%}" for t in th)
    lines.append(f"| `{role}` | {len(role_rollup[role])} | {th_str} |")
lines.append("")

# Headline numbers (raw + scoped)
lines.append("## Aggregated headline metrics")
lines.append("")
lines.append("### Rooms (deduped by code)")
lines.append("")
lines.append(f"- Unique room codes parsed (with area): **{len(dxf_rooms_all)}**")
lines.append(f"- Tabulka místností has **{len(tabulka)}** total ({len(d_codes_tab)} D-related)")
lines.append(f"- Coverage of D-related codes: **{len(in_both)} / {len(d_codes_tab)}** "
             f"({len(in_both) / max(len(d_codes_tab), 1) * 100:.1f} %)")
lines.append("")
lines.append("### Openings (raw, across all drawings — same opening counted once per drawing)")
lines.append("")
lines.append(f"- Doors: **{total_doors}** total — with type code: **{total_door_with_code}** "
             f"({total_door_with_code / max(total_doors, 1) * 100:.1f} %)")
lines.append(f"- Windows: **{total_windows}** total — with type code: **{total_window_with_code}** "
             f"({total_window_with_code / max(total_windows, 1) * 100:.1f} %)")
lines.append(f"- Curtain walls: **{total_curtain}**")
lines.append("")
lines.append(
    "_Note:_ each room/opening is exported into both the půdorys and the podhledy "
    "drawing of the same floor (same model exported twice). Door/window tag "
    "extraction by design only succeeds on půdorysy (podhledy show outlines but "
    "no D##/W## tags). The per-drawing verdict above is the accurate gauge; "
    "this aggregate dilutes the signal across drawing types."
)
lines.append("")

lines.append("### Segment tags by prefix (across all valid drawings)")
lines.append("")
lines.append("| Prefix | Count | Drawings | Category | Notes |")
lines.append("|---|---:|---:|---|---|")
for prefix, count in prefix_count.most_common():
    drawings_n = len(prefix_drawings.get(prefix, set()))
    cat = PREFIX_CATEGORY.get(prefix, "unknown")
    notes = ""
    if prefix == "F":
        notes = "Disambiguate facade vs floor in Phase 3 via Tabulka skladeb"
    elif prefix == "OS":
        notes = "Lighting — out of finishing scope"
    elif prefix == "LI":
        notes = "Broad — disambiguate via Tabulka klempířských in Phase 3"
    elif prefix == "RF":
        notes = "Roof finish — present on roof_plan + section drawings"
    lines.append(f"| `{prefix}##` | {count} | {drawings_n} | {cat} | {notes} |")
lines.append("")

# Cross-validation (the gold-standard check)
lines.append("## Cross-validation against Tabulka místností")
lines.append("")
lines.append("Compares parser-extracted room areas against the official Tabulka. "
             "Tolerance ±2 % per task spec.")
lines.append("")
lines.append(f"- Tabulka D-related codes: **{len(d_codes_tab)}**")
lines.append(f"- DXF unique D-related codes (with area): **{sum(1 for c in dxf_rooms_all if is_d_code(c))}**")
lines.append(f"- Codes in BOTH: **{len(in_both)}**")
lines.append(f"- Within ±2 %: **{len(within)} / {len(discrepancies)}** "
             f"({len(within) / max(len(discrepancies), 1) * 100:.1f} %)")
lines.append(f"- Outside ±2 %: **{len(outside)}**")
if outside:
    lines.append("")
    lines.append("Out-of-tolerance rooms:")
    lines.append("")
    lines.append("| Code | Tabulka m² | DXF m² | Δ % |")
    lines.append("|------|-----:|-----:|-----:|")
    for c, ta, da, diff in sorted(outside, key=lambda x: -abs(x[3])):
        lines.append(f"| `{c}` | {ta:.2f} | {da:.2f} | {diff:+.2f} % |")
lines.append("")
lines.append(f"- Codes in Tabulka but NOT in DXF: **{len(tab_only)}**")
if tab_only:
    floors = Counter()
    for c in tab_only:
        if c.startswith("S."):
            floors["sklep / 1.PP"] += 1
        else:
            parts = c.split(".")
            if len(parts) >= 2:
                m = {"0": "1.PP", "1": "1.NP", "2": "2.NP", "3": "3.NP"}.get(parts[1], parts[1])
                floors[m] += 1
    lines.append(f"  By floor: {dict(floors)}")
lines.append(f"- Codes in DXF but NOT in Tabulka: **{len(dxf_only)}**")
if dxf_only:
    for c in dxf_only:
        a = dxf_rooms_all[c].area_m2
        lines.append(f"  - `{c}` — DXF area {a:.2f} m²")
lines.append("")

# Verdict
primary_drawings = role_rollup.get("primary_pudorys", []) + role_rollup.get("podhledy_plan", [])
primary_pass = 0
primary_review = 0
for stem in primary_drawings:
    v, _ = per_drawing_verdict(stem, valid[stem])
    if v == "pass":
        primary_pass += 1
    elif v == "review":
        primary_review += 1

tabulka_pass = (len(within) / max(len(discrepancies), 1)) >= 0.95 if discrepancies else False
parser_clean = sum(1 for p in valid.values() if any("ezdxf.readfile failed" in w for w in p.warnings)) == 0

verdict_pass = (
    primary_review == 0
    and primary_pass >= 1
    and tabulka_pass
    and parser_clean
)

lines.append("## Verdict")
lines.append("")
lines.append("Acceptance criteria (drawing-type aware):")
lines.append("")
lines.append(
    f"- Primary půdorysy + podhledy without ⚠️: **{primary_pass} pass / {primary_review} review** "
    f"{'✅' if primary_review == 0 else '❌'}"
)
lines.append(
    f"- Tabulka cross-check ≥ 95 % within ±2 %: "
    f"**{len(within) / max(len(discrepancies), 1) * 100:.1f} %** "
    f"{'✅' if tabulka_pass else '❌'}"
)
lines.append(
    f"- No critical parser errors: "
    f"**{0 if parser_clean else 'errors detected'}** "
    f"{'✅' if parser_clean else '❌'}"
)
lines.append("")

if verdict_pass:
    lines.append("### ✅ READY FOR PHASE 0.7 (cross-object geometric validation)")
    lines.append("")
    lines.append(
        "All thresholds met. Parser produces deterministic, layer-validated data on "
        f"{primary_pass} primary půdorys/podhledy drawings. Cross-source agreement with "
        f"Tabulka místností is **{len(within) / max(len(discrepancies), 1) * 100:.1f} %** "
        "within ±2 %, indicating Tabulka was generated from the same model the DXF reflects."
    )
else:
    lines.append("### ⚠️ NEEDS REVIEW")
    if primary_review > 0:
        lines.append(f"- {primary_review} primary drawing(s) flagged — see per-drawing verdict")
    if not tabulka_pass:
        lines.append(f"- Tabulka cross-check below 95 %")

lines.append("")
lines.append("### Known caveats")
lines.append("")
lines.append(
    "- DWG dataset covers only **objekt D + společný 1.PP**. A/B/C půdorysy exist "
    "only as PDFs. Cross-validation can only assess D-related codes; coverage gap "
    "for A/B/C is expected per Session 1 inventory."
)
lines.append(
    "- F## tag prefix is ambiguous (facade Terca F08 vs floor finish F0x). Parser flags "
    "with a warning; Phase 3 disambiguates via Tabulka skladeb."
)
lines.append(
    "- Some doors on Půdorys 1.NP are `ABMV_CW_Single_Swing_Generic` INSERTs (operable "
    "curtain-wall sklopná křídla) registered on `A-DOOR-OTLN` — they have no D## tag because "
    "they're parts of a curtain wall, not standalone doors. The 78.6 % door-tag rate on "
    "1.NP D reflects this and is correct."
)
lines.append(
    "- Sklepy / 1.PP suterén use a third room-code format `S.{objekt}.{NN}` "
    "(distinct from byt-podlaží `D.1.4.02` and společné NP `D.1.S.01`). Parser regex was "
    "extended to match all three patterns."
)

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"\nWrote {OUT}")
print()
print("=== HEADLINE ===")
print(f"Primary půdorys/podhledy verdicts: {primary_pass} pass / {primary_review} review")
print(f"Tabulka cross-check: {len(within)}/{len(discrepancies)} within ±2 %")
print(f"DXF coverage of D-related Tabulka codes: {len(in_both)}/{len(d_codes_tab)}")
print(f"Verdict: {'✅ READY' if verdict_pass else '⚠️ REVIEW'}")
