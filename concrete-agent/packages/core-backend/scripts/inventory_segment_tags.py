"""Phase 2 step 1 — inventory FF/CF/WF segment tags on IDEN layers.

Scans půdorys 1.NP and podhledy 1.NP to discover where skladba codes
(WF##, FF##, CF##, F##) live, what layers they sit on, and whether
they're single TEXTs or split into letter+digit pieces."""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from pathlib import Path

import ezdxf

PUDORYS = Path(
    "test-data/libuse/inputs/dxf/"
    "185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dxf"
)
PODHLEDY = Path(
    "test-data/libuse/inputs/dxf/"
    "185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. NP.dxf"
)
OUT = Path("test-data/libuse/outputs/dxf_segment_tag_inventory.md")

# Patterns that may match skladba codes (per task spec):
# - F##, FF##  → floor finishes
# - CF##       → ceiling finishes
# - WF##       → wall finishes
# - RF##       → roof / terrace finishes
# - W##, D##   → openings (informational here)
SINGLE_CODE_RE = re.compile(r"^([A-Z]{1,3})(\d{2,3})$")
PREFIX_ONLY_RE = re.compile(r"^([A-Z]{1,3})$")
DIGITS_ONLY_RE = re.compile(r"^(\d{1,3})$")


def scan_iden_layers(dxf_path: Path) -> tuple[dict[str, list[dict]], list[str]]:
    doc = ezdxf.readfile(str(dxf_path))
    msp = doc.modelspace()
    iden_layers = sorted({
        e.dxf.layer for e in msp
        if hasattr(e.dxf, "layer") and "-IDEN" in e.dxf.layer
    })
    per_layer: dict[str, list[dict]] = defaultdict(list)
    for ent in msp.query("TEXT MTEXT"):
        layer = ent.dxf.layer
        if "-IDEN" not in layer:
            continue
        raw = ent.dxf.text if ent.dxftype() == "TEXT" else ent.text
        raw = raw.strip()
        if not raw:
            continue
        per_layer[layer].append({
            "text": raw,
            "x": ent.dxf.insert.x,
            "y": ent.dxf.insert.y,
        })
    return per_layer, iden_layers


def classify_texts(items: list[dict]) -> dict:
    single_codes = []
    prefixes = []
    digits = []
    other = []
    for item in items:
        m = SINGLE_CODE_RE.match(item["text"])
        if m:
            single_codes.append((item["text"], item["x"], item["y"], m.group(1)))
            continue
        m = PREFIX_ONLY_RE.match(item["text"])
        if m:
            prefixes.append((item["text"], item["x"], item["y"]))
            continue
        m = DIGITS_ONLY_RE.match(item["text"])
        if m:
            digits.append((item["text"], item["x"], item["y"]))
            continue
        other.append((item["text"], item["x"], item["y"]))
    return {
        "single_codes": single_codes,
        "prefixes": prefixes,
        "digits": digits,
        "other": other,
    }


def reconstruct_split_codes(prefixes: list, digits: list, dy_max: float = 250,
                            dx_max: float = 80) -> list[tuple[str, float, float]]:
    """Pair each prefix TEXT with the closest digits TEXT below it (Δy < dy_max)."""
    out = []
    used = set()
    for ptext, px, py in prefixes:
        best = None
        best_d = None
        for i, (dtext, dx_, dy_) in enumerate(digits):
            if i in used:
                continue
            dx = abs(dx_ - px)
            dy = py - dy_  # prefix is ABOVE the digits → expect dy>0
            if 0 < dy <= dy_max and dx <= dx_max:
                d = dx + dy
                if best is None or d < best_d:
                    best = (i, dtext, dx_, dy_)
                    best_d = d
        if best:
            i, dtext, dx_, dy_ = best
            used.add(i)
            out.append((f"{ptext}{dtext}", px, py))
    return out


lines: list[str] = []
lines.append("# DXF segment-tag inventory — Phase 2 step 1")
lines.append("")
lines.append(
    "Scans `*-IDEN` layers in two DXF files to find where skladba codes "
    "(WF/FF/CF/RF/F + opening codes W/D) live and whether they're single "
    "TEXT entities or split letter+digit pieces."
)
lines.append("")

for label, dxf in [("Půdorys 1.NP", PUDORYS), ("Podhledy 1.NP", PODHLEDY)]:
    lines.append(f"## {label}")
    lines.append(f"`{dxf.name}`")
    lines.append("")
    per_layer, iden_layers = scan_iden_layers(dxf)
    lines.append(f"IDEN-suffixed layers found: **{len(iden_layers)}**  ")
    lines.append("")
    if not iden_layers:
        lines.append("_(no IDEN layers — drawing has no tag data)_")
        lines.append("")
        continue

    for layer in iden_layers:
        items = per_layer.get(layer, [])
        if not items:
            lines.append(f"### `{layer}` — 0 TEXT/MTEXT")
            lines.append("")
            continue
        cls = classify_texts(items)
        single_prefix_hist = Counter(p for *_, p in cls["single_codes"])
        prefix_hist = Counter(t for t, *_ in cls["prefixes"])
        # Reconstruct split codes
        split_codes = reconstruct_split_codes(cls["prefixes"], cls["digits"])
        split_prefix_hist = Counter(c[:2] if c[:2].isalpha() else c[:1] for c, *_ in split_codes)

        lines.append(f"### `{layer}` — {len(items)} TEXT/MTEXT")
        lines.append("")
        lines.append(
            f"- Single-token codes (`^[A-Z]+\\d+$`): **{len(cls['single_codes'])}** — "
            f"prefixes: {dict(single_prefix_hist)}"
        )
        lines.append(
            f"- Lone prefixes (`^[A-Z]+$`): **{len(cls['prefixes'])}** — "
            f"texts: {dict(prefix_hist)}"
        )
        lines.append(
            f"- Lone digits (`^\\d+$`): **{len(cls['digits'])}**"
        )
        lines.append(
            f"- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): "
            f"**{len(split_codes)}** — prefixes: {dict(split_prefix_hist)}"
        )
        lines.append(
            f"- Other (free text): **{len(cls['other'])}**"
        )
        lines.append("")

        if cls["single_codes"]:
            sample = sorted({code for code, *_ in cls["single_codes"]})
            lines.append("Sample single codes (sorted unique):")
            lines.append("")
            lines.append("```")
            for code in sample[:30]:
                lines.append(f"  {code}")
            if len(sample) > 30:
                lines.append(f"  ... +{len(sample) - 30} more")
            lines.append("```")
            lines.append("")

        if split_codes:
            sample = sorted({code for code, *_ in split_codes})
            lines.append("Sample reconstructed split codes (unique):")
            lines.append("")
            lines.append("```")
            for code in sample[:30]:
                lines.append(f"  {code}")
            if len(sample) > 30:
                lines.append(f"  ... +{len(sample) - 30} more")
            lines.append("```")
            lines.append("")

        if cls["other"][:8]:
            lines.append("Sample free-text on this layer (first 8):")
            lines.append("")
            lines.append("```")
            for t, x, y in cls["other"][:8]:
                short = t[:60].replace("\n", " ")
                lines.append(f"  '{short}'  pos=({x:.0f}, {y:.0f})")
            lines.append("```")
            lines.append("")

# Cross-layer summary
lines.append("## Cross-layer summary")
lines.append("")
lines.append(
    "Goal: confirm which prefix family lives on which IDEN layer so the "
    "parser can target each segment-tag category by layer name."
)
lines.append("")

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {OUT}")
print()
# Also dump key counts to stdout
for label, dxf in [("Půdorys 1.NP", PUDORYS), ("Podhledy 1.NP", PODHLEDY)]:
    per_layer, iden_layers = scan_iden_layers(dxf)
    print(f"\n{label}: {len(iden_layers)} IDEN layers")
    for layer in iden_layers:
        items = per_layer.get(layer, [])
        if not items:
            continue
        cls = classify_texts(items)
        split = reconstruct_split_codes(cls["prefixes"], cls["digits"])
        single_p = Counter(p for *_, p in cls["single_codes"])
        split_p = Counter(c[:2] if c[:2].isalpha() else c[:1] for c, *_ in split)
        prefix_h = Counter(t for t, *_ in cls["prefixes"])
        print(
            f"  {layer:<32s} TEXT={len(items):>3}  "
            f"single={len(cls['single_codes']):>3} {dict(single_p)}  "
            f"prefixes={dict(prefix_h)}  "
            f"split={len(split):>3} {dict(split_p)}"
        )
