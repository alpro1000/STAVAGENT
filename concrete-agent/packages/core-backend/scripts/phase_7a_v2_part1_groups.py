"""Phase 7a v2 Part 1 — build explicit query groups (KROS-style aggregation).

NO API calls. Just group items, save JSON + review markdown, print top 30.

Group key:
  (kapitola, popis_template, MJ, skladba_refs_sorted)

popis_template = popis with item-specific suffixes stripped + lowercased
                  for hashing; popis_canonical = original best representative.
"""
from __future__ import annotations

import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
ITEMS = OUT_DIR / "items_objekt_D_complete.json"
GROUPS = OUT_DIR / "urs_query_groups.json"
REPORT = OUT_DIR / "urs_groups_review.md"


# Patterns to strip from popis (order: specific → generic). Each is removed
# BEFORE hashing so that popisy differing only by skladba/window/door code
# collapse to one template.
STRIP_PATTERNS = [
    # "(paired with X (nested) Y)" — greedy to end-of-string so nested
    # parens like "(Primalex Polar)" don't break the match prematurely
    re.compile(r"\s*\(paired with .+$"),
    # " — okno W03", " — D-typ D04", " — koupelna D.1.1.05"
    re.compile(r"\s*[—-]\s*(okno\s+W\d{1,3}[a-z]?|D[-\s]?typ\s+D\d{1,3}|koupelna\s+\S+)\s*$",
                re.IGNORECASE),
    # " (z OP## D-share)" leftover from Phase 3c
    re.compile(r"\s*\(z\s+OP##\s+D-share\)\s*$", re.IGNORECASE),
    # Trailing skladba code in parens: "(FF20)", "(F05)", "(CF20)", "(F06)"
    re.compile(r"\s*\((F{1,2}\d{1,3}|CF\d{1,3}|WF\d{1,3}|RF\d{1,3}|D\d{1,3}|W\d{1,3})\)\s*$"),
    # "(F18)", "(F03)" with optional space
    re.compile(r"\s*\(\s*[A-Z]{1,3}\d{1,3}\s*\)\s*$"),
    # "— Revizní dvířka KAN 300 x ", "— Žaluziový kastlík pro v" tail context
    re.compile(r"\s*[—-]\s*[A-ZČŠŘŽÚŮÍÁÉÝÓŤĚŇĎ][\w\sáčďéěíňóřšťúůýž]+(?:\s+\d+\s*x\s*\d+)?\s*$"),
    # Generic trailing "— místnost {code}" or "— D ·" or "— Přenosný hasi"
    re.compile(r"\s*[—-]\s*[A-ZD]?[\.·][\.\w\d\s]+\s*$"),
    # "OP##" shortenings as trailing space-prefixed code
    re.compile(r"\s+OP\s*\d+\s*$"),
    # "— okno WXX" without word "okno"
    re.compile(r"\s*[—-]\s*W\d{1,3}\s*$"),
]


def normalize_popis(popis: str) -> str:
    """Apply all strip patterns + lower + collapse whitespace."""
    s = popis or ""
    for pat in STRIP_PATTERNS:
        s = pat.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def extract_skladba_refs(skl: dict) -> list[str]:
    if not skl:
        return []
    out = []
    for k, v in skl.items():
        if isinstance(v, str) and re.match(r"^[A-Z]{1,3}\d{1,3}[a-z]?$", v):
            out.append(v)
    return sorted(set(out))


def main() -> None:
    items = json.loads(ITEMS.read_text(encoding="utf-8"))["items"]
    print(f"Loaded {len(items)} items")

    # Bucket by (kapitola, popis_template, MJ) — skladba_refs are AGGREGATED
    # across the bucket (not part of the key) so e.g. cement screed FF01+FF20+
    # FF30+FF31 merges into ONE group covering all 4 skladby. ÚRS lookup is the
    # same operation regardless of which FF code the room uses.
    buckets: dict[tuple, list[dict]] = defaultdict(list)
    for it in items:
        kapitola = it.get("kapitola", "")
        popis = it.get("popis", "")
        mj = it.get("MJ", "")
        popis_norm = normalize_popis(popis)
        key = (kapitola, popis_norm, mj)
        buckets[key].append(it)

    # Build groups list, sort by items_count desc
    groups: list[dict] = []
    for i, ((kapitola, popis_norm, mj), bag) in enumerate(
        sorted(buckets.items(), key=lambda kv: -len(kv[1])), 1
    ):
        # Aggregate skladba_refs across bucket
        skl_refs_set: set[str] = set()
        for it in bag:
            skl_refs_set.update(extract_skladba_refs(it.get("skladba_ref") or {}))
        skl_refs = tuple(sorted(skl_refs_set))
        # Pick canonical popis — shortest popis without "(paired with..." or
        # "(FF##)" suffix is cleanest. Build a candidate by stripping common
        # noise from each popis and pick the shortest result.
        def _clean_for_canonical(p: str) -> str:
            p = re.sub(r"\s*\(paired with .+$", "", p)
            p = re.sub(
                r"\s*\((?:F{1,2}\d{1,3}|CF\d{1,3}|WF\d{1,3}|RF\d{1,3}|D\d{1,3}|W\d{1,3})\)\s*$",
                "", p,
            )
            return p.strip()
        candidates = sorted(
            {_clean_for_canonical(it.get("popis", "")) for it in bag},
            key=len,
        )
        popis_canonical = candidates[-1] if candidates else ""
        qtys = [it.get("mnozstvi") or 0 for it in bag if it.get("mnozstvi") is not None]
        status_mix = Counter(it.get("urs_status", "—") for it in bag)
        # Sample 5 items (first 5)
        sample = []
        for it in bag[:5]:
            misto = it.get("misto") or {}
            mistnosti = misto.get("mistnosti") or []
            misto_str = f"{misto.get('objekt','')}·{misto.get('podlazi','')}"
            if mistnosti:
                misto_str += f"·{','.join(mistnosti[:2])}"
            skl = it.get("skladba_ref") or {}
            skl_str = "; ".join(f"{k}={v}" for k, v in skl.items()
                                 if isinstance(v, (str, int)) and len(str(v)) < 12)[:50]
            sample.append({
                "misto": misto_str,
                "mnozstvi": it.get("mnozstvi"),
                "skladba": skl_str,
                "urs_status": it.get("urs_status"),
            })

        groups.append({
            "group_id": f"G{i:03d}",
            "kapitola": kapitola,
            "popis_template": popis_norm,
            "popis_canonical": popis_canonical,
            "MJ": mj,
            "skladba_refs": list(skl_refs),
            "items_count": len(bag),
            "items_ids": [it["item_id"] for it in bag],
            "total_mnozstvi": round(sum(qtys), 3),
            "min_mnozstvi": round(min(qtys), 3) if qtys else 0,
            "max_mnozstvi": round(max(qtys), 3) if qtys else 0,
            "median_mnozstvi": round(statistics.median(qtys), 3) if qtys else 0,
            "sample_items": sample,
            "status_mix_in_group": dict(status_mix),
            "urs_code": None,
            "urs_status": "pending",
        })

    # Persist groups JSON
    out = {
        "metadata": {
            "items_total": len(items),
            "groups_total": len(groups),
            "items_per_group_max": max(g["items_count"] for g in groups),
            "items_per_group_min": min(g["items_count"] for g in groups),
            "items_per_group_median": int(statistics.median([g["items_count"] for g in groups])),
            "single_item_groups": sum(1 for g in groups if g["items_count"] == 1),
            "large_groups_50plus": sum(1 for g in groups if g["items_count"] >= 50),
        },
        "groups": groups,
    }
    GROUPS.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {GROUPS} ({GROUPS.stat().st_size:,} bytes)")

    # Per-kapitola summary
    per_kap: dict[str, dict] = defaultdict(lambda: {"groups": 0, "items": 0, "largest": 0})
    for g in groups:
        per_kap[g["kapitola"]]["groups"] += 1
        per_kap[g["kapitola"]]["items"] += g["items_count"]
        per_kap[g["kapitola"]]["largest"] = max(per_kap[g["kapitola"]]["largest"], g["items_count"])

    # Build markdown report
    lines = []
    lines.append("# ÚRS Query Groups — Review Report")
    lines.append("")
    lines.append("**Generated:** Phase 7a v2 Part 1 (group-first build)")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- **Total unique groups: {len(groups)}**")
    lines.append(f"- Items total covered: {len(items)} (verified)")
    lines.append(f"- Items per group: max=**{out['metadata']['items_per_group_max']}**, "
                 f"min={out['metadata']['items_per_group_min']}, "
                 f"median={out['metadata']['items_per_group_median']}")
    lines.append(f"- Single-item groups: **{out['metadata']['single_item_groups']}** "
                 "(need ÚRS individually)")
    lines.append(f"- Large groups (≥ 50 items): **{out['metadata']['large_groups_50plus']}** "
                 "(highest impact for KROS)")
    lines.append("")
    lines.append("## Top 50 groups by items_count")
    lines.append("")
    lines.append("| # | Group ID | Kapitola | Popis template (truncated) | MJ | Items | Total qty | Skladby |")
    lines.append("|---|----------|----------|----------------------------|------|------:|----------:|---------|")
    for g in groups[:50]:
        skl = ",".join(g["skladba_refs"]) or "—"
        lines.append(f"| {g['group_id'].lstrip('G').lstrip('0') or '0'} | "
                     f"`{g['group_id']}` | `{g['kapitola']}` | "
                     f"{g['popis_canonical'][:60]} | {g['MJ']} | "
                     f"{g['items_count']} | {g['total_mnozstvi']} | {skl} |")
    lines.append("")
    lines.append("## Per-kapitola breakdown")
    lines.append("")
    lines.append("| Kapitola | Groups | Items | Largest group |")
    lines.append("|---|---:|---:|---:|")
    for kap, stats in sorted(per_kap.items(), key=lambda x: -x[1]["items"]):
        lines.append(f"| `{kap}` | {stats['groups']} | {stats['items']} | "
                     f"{stats['largest']} |")
    lines.append("")
    # Single-item groups sample
    single = [g for g in groups if g["items_count"] == 1]
    lines.append(f"## Single-item groups (sample 30 of {len(single)})")
    lines.append("")
    lines.append("| Group ID | Kapitola | Popis | MJ | Qty | Místo |")
    lines.append("|---|---|---|---|---:|---|")
    for g in single[:30]:
        sample_misto = (g["sample_items"][0] or {}).get("misto", "—")
        lines.append(f"| `{g['group_id']}` | `{g['kapitola']}` | "
                     f"{g['popis_canonical'][:55]} | {g['MJ']} | "
                     f"{g['total_mnozstvi']} | {sample_misto} |")
    lines.append("")
    # Top 5 sample item details
    lines.append("## Sample items in top 5 groups (verification)")
    lines.append("")
    for g in groups[:5]:
        lines.append(f"### {g['group_id']} — {g['popis_canonical'][:60]}")
        lines.append("")
        lines.append(f"`{g['kapitola']}` · {g['MJ']} · {g['items_count']} items · "
                     f"Σ {g['total_mnozstvi']} {g['MJ']} · skladby: {','.join(g['skladba_refs']) or '—'}")
        lines.append("")
        lines.append("| Sample # | Místo | Množství | Skladba | urs_status |")
        lines.append("|---|---|---:|---|---|")
        for j, s in enumerate(g["sample_items"], 1):
            lines.append(f"| {j} | {s['misto']} | {s['mnozstvi']} | "
                         f"{s['skladba']} | {s.get('urs_status') or '—'} |")
        lines.append("")
        # Status mix per group
        lines.append(f"Status mix: `{g['status_mix_in_group']}`")
        lines.append("")

    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {REPORT} ({REPORT.stat().st_size:,} bytes)")
    print()
    print(f"=" * 80)
    print("TOP 30 GROUPS BY ITEMS_COUNT")
    print("=" * 80)
    print(f"{'#':>3} {'ID':<5} {'Kapitola':<11} {'Popis (40 ch)':<42} "
          f"{'MJ':<5} {'Items':>5} {'Total':>10}")
    print("-" * 80)
    for i, g in enumerate(groups[:30], 1):
        popis = g["popis_canonical"][:40].ljust(40)
        print(f"{i:>3} {g['group_id']:<5} {g['kapitola']:<11} {popis:<42} "
              f"{g['MJ']:<5} {g['items_count']:>5} {g['total_mnozstvi']:>10.2f}")
    print("=" * 80)
    print(f"Total groups: {len(groups)}")
    print(f"Items covered: {sum(g['items_count'] for g in groups)} / {len(items)}")
    print(f"Single-item groups: {len(single)}")
    print(f"Large groups (>= 50 items): {out['metadata']['large_groups_50plus']}")


if __name__ == "__main__":
    main()
