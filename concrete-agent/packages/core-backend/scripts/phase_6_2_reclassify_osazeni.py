"""Phase 6.2 — reclassify osazení popis + kapitola per OP## activity type.

Phase 6.1 mistakenly applied generic "Osazení revizních dvířek" to all
58 paired osazení items, even when the OP## was a hasicí přístroj,
poštovní schránka, žaluzie, etc. This step:
  1. For each paired osazení item, look up the actual OP## popis
  2. Map to correct kapitola + popis template via category table
  3. Drop pseudo-osazení (těsnění etc. — already in dodávka)
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
COMBINED = OUT_DIR / "items_objekt_D_complete.json"
TABULKY = OUT_DIR / "tabulky_loaded.json"
DIFF = OUT_DIR / "phase_6_2_diff_log.md"


# Pattern → (kapitola, popis_template, apply_osazeni)
# Order matters — first match wins. More specific patterns first.
CATEGORY_RULES: list[tuple[re.Pattern, str, str, bool]] = [
    # Těsnění — already in dodávka, drop osazení
    (re.compile(r"těsnění|tesnění|pryž", re.IGNORECASE),
     "", "", False),
    # Hasicí přístroj
    (re.compile(r"hasicí|hasící", re.IGNORECASE),
     "PSV-952", "Montáž hasicího přístroje na stěnu — {op_short}", True),
    # Schránky poštovní
    (re.compile(r"schránk|schranka", re.IGNORECASE),
     "PSV-767", "Osazení poštovních schránek — {op_short}", True),
    # Čisticí zóna / rohož
    (re.compile(r"čisticí|cisticí|rohož", re.IGNORECASE),
     "PSV-771", "Osazení čisticí rohože do podlahy — {op_short}", True),
    # Zinkovaný rošt
    (re.compile(r"zinkovaný rošt|rošt zinkovaný|rošt", re.IGNORECASE),
     "PSV-767", "Osazení zinkovaného roštu — {op_short}", True),
    # Stavební pouzdro posuvných dveří
    (re.compile(r"pouzdro|posuvných", re.IGNORECASE),
     "PSV-766", "Osazení stavebního pouzdra posuvných dveří — {op_short}", True),
    # Tondach průchodka / průchod střechy
    (re.compile(r"průchod|prechodka|průchodk", re.IGNORECASE),
     "PSV-765", "Montáž průchodky v krytině — {op_short}", True),
    # Chrlič
    (re.compile(r"chrlič|chrlic", re.IGNORECASE),
     "PSV-764", "Montáž chrliče v atice — {op_short}", True),
    # Bezpečnostní přepad
    (re.compile(r"bezpečnostní přepad|prepad", re.IGNORECASE),
     "PSV-764", "Montáž bezpečnostního přepadu — {op_short}", True),
    # Venkovní žaluzie
    (re.compile(r"venkovní žaluzie|žaluzie", re.IGNORECASE),
     "PSV-767", "Osazení venkovní žaluzie — {op_short}", True),
    # Žaluziový kastlík (housing)
    (re.compile(r"kastlík|kastlik|podomítkov.+ schránk", re.IGNORECASE),
     "HSV-622", "Osazení žaluziového kastlíku ve fasádě — {op_short}", True),
    # Vanová revizní dvířka
    (re.compile(r"vanová revizní|vana revizní", re.IGNORECASE),
     "HSV-642", "Osazení vanové revizní dvířka — {op_short}", True),
    # Hydrant 600x900
    (re.compile(r"hydrant", re.IGNORECASE),
     "HSV-642", "Osazení revizní dvířka k hydrantu — {op_short}", True),
    # Revizní dvířka v podhledu (SDK) — keyword "podhled"
    (re.compile(r"revizní.*podhled|podhled.*revizní|do SDK|v SDK", re.IGNORECASE),
     "PSV-763", "Osazení revizní dvířka v SDK podhledu — {op_short}", True),
    # Revizní dvířka ve fasádě
    (re.compile(r"revizní.*fasád|fasád.*revizní", re.IGNORECASE),
     "HSV-622", "Osazení revizní dvířka ve fasádě — {op_short}", True),
    # Revizní dvířka generic (KAN/VOD/instalační šachty)
    (re.compile(r"revizní dvířk|reviz dvirka", re.IGNORECASE),
     "HSV-642", "Osazení revizní dvířka — {op_short}", True),
    # Dilatační lišta — already installed during finishing, no separate osazení
    (re.compile(r"dilatační lišt|dilatace", re.IGNORECASE),
     "", "", False),
    # Krycí lišta — same — installed during finishing
    (re.compile(r"krycí lišta", re.IGNORECASE),
     "", "", False),
]
# Default fallback: keep as HSV-642 generic osazení
DEFAULT_KAPITOLA = "HSV-642"
DEFAULT_TEMPLATE = "Osazení / montáž — {op_short}"


def shorten_popis(popis: str, max_len: int = 50) -> str:
    """Strip 'OP##: ' prefix and truncate."""
    s = re.sub(r"^OP\s*\d+\s*:\s*", "", popis or "")
    return s[:max_len].strip()


def classify(op_popis: str) -> tuple[str, str, bool]:
    for pat, kap, template, apply in CATEGORY_RULES:
        if pat.search(op_popis or ""):
            return kap, template, apply
    return DEFAULT_KAPITOLA, DEFAULT_TEMPLATE, True


def main() -> None:
    combined = json.loads(COMBINED.read_text(encoding="utf-8"))
    items = combined["items"]

    # Build OP-code → dodávka popis lookup
    dodavka_popis_by_op: dict[str, str] = {}
    dodavka_id_to_op: dict[str, str] = {}
    for it in items:
        op = (it.get("skladba_ref") or {}).get("OP")
        if op and it["kapitola"] == "OP-detail":
            dodavka_popis_by_op[op] = it.get("popis", "")
            dodavka_id_to_op[it["item_id"]] = op

    # Process paired osazení items
    new_items: list[dict] = []
    reclassified: Counter = Counter()
    dropped: list[dict] = []
    sample_changes: list[dict] = []
    seen_osazeni = 0

    for it in items:
        # Identify Phase 6.1 paired osazení items
        is_paired_osazeni = (
            it.get("kapitola") == "HSV-642"
            and "Osazení revizních dvířek / OP" in (it.get("popis") or "")
            and (it.get("skladba_ref") or {}).get("paired_with")
        )
        if not is_paired_osazeni:
            new_items.append(it)
            continue

        seen_osazeni += 1
        op = (it.get("skladba_ref") or {}).get("OP")
        paired_id = (it.get("skladba_ref") or {}).get("paired_with")
        op_popis = dodavka_popis_by_op.get(op, it.get("popis", ""))
        op_short = shorten_popis(op_popis)

        new_kap, template, apply_osazeni = classify(op_popis)
        old_kap = it["kapitola"]
        old_popis = it["popis"]

        if not apply_osazeni:
            dropped.append({
                "op": op,
                "op_popis": op_popis[:80],
                "reason": "Pseudo-osazení — already in dodávka (těsnění / dilatační lišta / krycí lišta)",
            })
            reclassified["DROPPED"] += 1
            if len(sample_changes) < 15:
                sample_changes.append({
                    "op": op,
                    "old_popis": old_popis,
                    "new_popis": "(DROPPED — pseudo-osazení)",
                    "old_kapitola": old_kap,
                    "new_kapitola": "—",
                })
            continue

        new_popis = template.format(op_short=op_short)
        it["kapitola"] = new_kap
        it["popis"] = new_popis
        it.setdefault("warnings", []).append(
            f"BUG_FIX_6.2: Reclassified osazení {old_kap} → {new_kap}"
        )
        it["audit_note"] = (it.get("audit_note", "")
                             + f"; phase_6.2: reclassified {old_kap} → {new_kap}").strip("; ")
        reclassified[new_kap] += 1
        if len(sample_changes) < 15:
            sample_changes.append({
                "op": op,
                "old_popis": old_popis,
                "new_popis": new_popis,
                "old_kapitola": old_kap,
                "new_kapitola": new_kap,
            })
        new_items.append(it)

    # Persist
    combined["items"] = new_items
    combined["metadata"]["items_count"] = len(new_items)
    combined["metadata"]["phase_6_2_applied"] = True
    COMBINED.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")

    # Diff log
    diff = []
    diff.append("# Phase 6.2 diff log — osazení reclassification per OP## category")
    diff.append("")
    diff.append(f"Paired osazení items processed: **{seen_osazeni}**")
    diff.append(f"Items dropped (pseudo-osazení): **{len(dropped)}**")
    diff.append(f"Items reclassified: **{seen_osazeni - len(dropped)}**")
    diff.append(f"Items count: {len(items)} → {len(new_items)}")
    diff.append("")

    diff.append("## Reclassification distribution")
    diff.append("")
    diff.append("| New kapitola | Items |")
    diff.append("|---|---:|")
    for kap, n in sorted(reclassified.items(), key=lambda x: -x[1]):
        label = kap if kap != "DROPPED" else "(dropped pseudo-osazení)"
        diff.append(f"| `{label}` | {n} |")
    diff.append("")

    diff.append("## Dropped items (pseudo-osazení)")
    diff.append("")
    if dropped:
        diff.append("| OP code | OP popis | Reason |")
        diff.append("|---|---|---|")
        for d in dropped:
            diff.append(f"| `{d['op']}` | {d['op_popis']} | {d['reason']} |")
    else:
        diff.append("_(none)_")
    diff.append("")

    diff.append("## Sample 15 changes (before/after)")
    diff.append("")
    diff.append("| OP | Old popis | Old kapitola | → New popis | New kapitola |")
    diff.append("|---|---|---|---|---|")
    for s in sample_changes:
        diff.append(f"| `{s['op']}` | {s['old_popis'][:50]} | `{s['old_kapitola']}` | "
                    f"{s['new_popis'][:50]} | `{s['new_kapitola']}` |")
    diff.append("")

    diff.append("## Audit — verify no more 'Osazení revizních dvířek' for non-revizní items")
    diff.append("")
    bad = [it for it in new_items
            if "Osazení revizních dvířek" in it["popis"]
            and not re.search(r"revizní|hydrant", dodavka_popis_by_op.get(
                (it.get("skladba_ref") or {}).get("OP", ""), ""), re.IGNORECASE)]
    diff.append(f"Bad items remaining: **{len(bad)}** (target: 0)")
    if bad[:5]:
        diff.append("")
        for b in bad[:5]:
            diff.append(f"- {b.get('popis')}")

    DIFF.write_text("\n".join(diff), encoding="utf-8")
    print(f"Updated {COMBINED.name}: {len(items)} → {len(new_items)} items")
    print(f"Paired osazení processed: {seen_osazeni}")
    print(f"Reclassified: {seen_osazeni - len(dropped)}, Dropped: {len(dropped)}")
    print(f"Distribution: {dict(reclassified)}")
    print(f"Wrote {DIFF}")


if __name__ == "__main__":
    main()
