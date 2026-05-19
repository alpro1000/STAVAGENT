#!/usr/bin/env python3
"""
Part 5b — URS catalog matching against local kros_catalog.db.

Strategy per item:
  1. Verify existing `urs_code_proposed` exists in DB → exact_code_hit
  2. FTS5 search by content tokens (popis stem) → top-N candidates
  3. Re-rank: code prefix overlap, mj match, vintage 2026 > 2018, token coverage
  4. Decide: matched (≥ 0.85) | candidate (0.60–0.85) | needs_lookup (< 0.60)

Output:
  outputs/urs_match_results.json — per-item candidates + best + confidence
  outputs/urs_match_report.md — human summary
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
ITEMS = PROJ / "outputs" / "items_rd_jachymov_complete.json"
DB = PROJ.parent / "kros_catalog.db"
OUT_JSON = PROJ / "outputs" / "urs_match_results.json"
OUT_MD = PROJ / "outputs" / "urs_match_report.md"

# Czech stopwords + filler tokens that hurt FTS ranking
STOPWORDS = {
    "a", "i", "v", "z", "na", "pro", "do", "se", "po", "od", "k", "u", "s",
    "nebo", "ano", "ne", "je", "jsou", "byl", "byla", "byly", "tj", "tzv",
    "td", "tj", "ten", "ta", "to", "ti", "ty", "ta", "te",
    "š", "tl", "mm", "cm", "m", "kg", "ks", "bm", "m2", "m3",
    "do", "nad", "pod", "při", "bez", "vč", "vc",
}
# Mass-noun tokens that don't disambiguate
GENERIC = {"prace", "praci", "praci", "polozka", "polozky", "material", "system", "doplnek"}


def strip_diacritics(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", s)
        if not unicodedata.combining(c)
    )


def normalize(s: str) -> str:
    s = strip_diacritics(s).lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(s: str) -> list[str]:
    norm = normalize(s)
    toks = [t for t in norm.split() if t not in STOPWORDS and t not in GENERIC]
    # Keep tokens length ≥ 3 OR pure numeric (e.g. C30/37 → "30" "37")
    toks = [t for t in toks if len(t) >= 3 or t.isdigit()]
    return toks


def fts_escape(tok: str) -> str:
    """FTS5 needs double-quoted phrase for tokens with special chars."""
    return f'"{tok}"' if not tok.isalnum() else tok


def fts_query(toks: list[str], max_tokens: int = 6) -> str:
    """Build OR query of top-N most distinctive tokens."""
    # Heuristic: longer tokens are more distinctive
    ranked = sorted(set(toks), key=lambda t: (-len(t), t))[:max_tokens]
    return " OR ".join(fts_escape(t) for t in ranked)


def code_prefix_score(proposed: str, candidate: str) -> float:
    """Common prefix length ratio. Same 6-digit code → 1.0; same 4-digit → 0.66; etc."""
    if not proposed or not candidate:
        return 0.0
    if proposed == candidate:
        return 1.0
    p = 0
    n = min(len(proposed), len(candidate))
    while p < n and proposed[p] == candidate[p]:
        p += 1
    return p / 6.0  # 6-digit URS code base


def mj_match(item_mj: str, cand_mj: str | None) -> bool:
    if not item_mj or not cand_mj:
        return False
    a = normalize(item_mj).replace("ha", "ha")
    b = normalize(cand_mj)
    # Normalize variants: m² ↔ m2, m³ ↔ m3
    map_table = {"m2": "m2", "m²": "m2", "m3": "m3", "m³": "m3"}
    a = map_table.get(a, a)
    b = map_table.get(b, b)
    return a == b


def vintage_bonus(cs: str | None) -> float:
    if not cs:
        return 0.0
    if "2026" in cs:
        return 0.10
    if "2025" in cs:
        return 0.05
    return 0.0  # 2018 = neutral


def search_catalog(con: sqlite3.Connection, item: dict) -> list[dict]:
    """Return ranked candidates for one item. Empty list if no FTS hits."""
    cur = con.cursor()
    item_toks = tokens(item["popis"])
    if not item_toks:
        return []

    q = fts_query(item_toks)
    proposed = (item.get("urs_code_proposed") or "").strip()
    item_mj = item.get("mj") or ""

    # 1) Exact code hit (preferred if present)
    candidates: list[dict] = []
    if proposed:
        for row in cur.execute(
            "SELECT kod_polozky, popis, mj, cenova_soustava FROM kros_items "
            "WHERE kod_polozky = ? ORDER BY cenova_soustava DESC",
            (proposed,),
        ):
            candidates.append({
                "kod": row[0], "popis": row[1], "mj": row[2],
                "cenova_soustava": row[3] or "",
                "_via": "exact_code",
            })

    # 2) FTS top-15
    try:
        for row in cur.execute(
            "SELECT i.kod_polozky, i.popis, i.mj, i.cenova_soustava, rank "
            "FROM kros_fts f JOIN kros_items i ON i.id = f.rowid "
            "WHERE kros_fts MATCH ? ORDER BY rank LIMIT 15",
            (q,),
        ):
            candidates.append({
                "kod": row[0], "popis": row[1], "mj": row[2],
                "cenova_soustava": row[3] or "",
                "fts_rank": row[4],
                "_via": "fts",
            })
    except sqlite3.OperationalError:
        pass  # FTS syntax error on weird tokens

    # Dedupe by (kod, cs)
    seen = set()
    deduped: list[dict] = []
    for c in candidates:
        key = (c["kod"], c["cenova_soustava"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)

    # Re-rank
    for c in deduped:
        cand_toks = set(tokens(c["popis"]))
        item_set = set(item_toks)
        coverage = (
            len(item_set & cand_toks) / max(len(item_set), 1)
            if item_set else 0.0
        )
        score = 0.0
        score += code_prefix_score(proposed, c["kod"]) * 0.40
        score += coverage * 0.40
        score += (0.15 if mj_match(item_mj, c["mj"]) else 0.0)
        score += vintage_bonus(c["cenova_soustava"])
        # Cap and store
        c["score"] = round(min(score, 1.0), 3)
        c["token_coverage"] = round(coverage, 3)
        c["mj_match"] = mj_match(item_mj, c["mj"])

    deduped.sort(key=lambda x: -x["score"])
    return deduped[:5]


def decide_status(item: dict, best: dict | None) -> tuple[str, str]:
    """
    Return (status, reason).

    Two-criterion model — code confirmation OR strong textual overlap:
      - matched_code:       proposed code exists in DB AND best == proposed (same 6-digit)
                            AND mj matches. Highest trust.
      - matched_text:       no code confirmation but score ≥ 0.70 AND mj matches.
      - candidate:          score ≥ 0.45 OR partial code-prefix overlap ≥ 4 digits.
      - needs_lookup:       rest. Recommend podminky.urs.cz manual search.
    """
    if best is None:
        return ("needs_lookup", "no_candidates_returned")

    proposed = (item.get("urs_code_proposed") or "").strip()
    item_mj = item.get("mj") or ""
    code_score = code_prefix_score(proposed, best["kod"])
    mj_ok = mj_match(item_mj, best.get("mj"))
    coverage = best.get("token_coverage", 0.0)

    # Honest labelling — DB is small (9173 codes; 1602 from 2026/1) and heuristic
    # `urs_code_proposed` in items.json often guesses the family but the wrong leaf.
    # No status implies "ship-ready"; everything still needs a human check, possibly
    # against podminky.urs.cz.
    if proposed and best["kod"] == proposed and mj_ok and best["score"] >= 0.60:
        return ("hint_strong", "proposed_code_in_db_mj_text_aligned")
    if proposed and best["kod"] == proposed and mj_ok:
        return ("hint_weak", "proposed_code_in_db_text_weak")
    if best["score"] >= 0.70 and mj_ok:
        return ("hint_text", "high_text_score_mj_match")
    if best["score"] >= 0.45 or code_score >= 4 / 6.0:
        return ("hint_text", "moderate_signal")
    return ("urs_search_needed", "no_strong_signal")


def podminky_url(code: str | None, query: str | None = None) -> str | None:
    """Build manual lookup URL for podminky.urs.cz (best-effort, user verifies)."""
    if code:
        return f"https://podminky.urs.cz/?vyhledavani={code}"
    if query:
        from urllib.parse import quote
        return f"https://podminky.urs.cz/?vyhledavani={quote(query)}"
    return None


def main() -> int:
    if not DB.exists():
        print(f"ERROR: DB not found at {DB}", file=sys.stderr)
        return 2

    print(f"[1/3] Loading items + DB ...", file=sys.stderr)
    items_doc = json.loads(ITEMS.read_text())
    items = items_doc["items"]
    con = sqlite3.connect(str(DB))

    # Ensure FTS up to date
    try:
        con.execute("INSERT INTO kros_fts(kros_fts) VALUES('rebuild')")
        con.commit()
    except sqlite3.OperationalError:
        pass

    print(f"[2/3] Matching {len(items)} items against {DB.name} ...", file=sys.stderr)
    results: list[dict] = []
    for i, item in enumerate(items, 1):
        cands = search_catalog(con, item)
        best = cands[0] if cands else None
        best_score = best["score"] if best else 0.0
        status, reason = decide_status(item, best)
        # Lookup URL: prefer code, fallback to first 3 distinctive tokens
        lookup_url = None
        # Always provide a lookup URL — even strong hints deserve human verification
        lookup_query = " ".join(tokens(item["popis"])[:3])
        lookup_url = podminky_url(item.get("urs_code_proposed"), lookup_query)
        results.append({
            "id": item["id"],
            "popis": item["popis"][:120],
            "mj": item.get("mj"),
            "mnozstvi": item.get("mnozstvi"),
            "kapitola_group": item.get("kapitola_group"),
            "_gate": item.get("_gate"),
            "urs_code_proposed": item.get("urs_code_proposed"),
            "best_match": best,
            "candidates_top3": cands[:3],
            "best_score": best_score,
            "match_status": status,
            "match_reason": reason,
            "podminky_url": lookup_url,
        })
        if i % 25 == 0:
            print(f"   {i}/{len(items)}", file=sys.stderr)

    # Aggregate stats
    status_counts = Counter(r["match_status"] for r in results)
    reason_counts = Counter(r["match_reason"] for r in results)
    by_gate = Counter((r["_gate"], r["match_status"]) for r in results)
    proposed_hits = sum(
        1 for r in results
        if r["best_match"]
        and r["urs_code_proposed"] == r["best_match"]["kod"]
    )
    avg_score = sum(r["best_score"] for r in results) / max(len(results), 1)

    print(f"[3/3] Writing outputs ...", file=sys.stderr)
    OUT_JSON.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": str(date.today()),
        "_generated_by": "tools/match_urs_against_catalog.py",
        "_source_items": str(ITEMS.relative_to(PROJ.parent)),
        "_source_catalog": str(DB.relative_to(PROJ.parent)),
        "_catalog_size": con.execute("SELECT COUNT(*) FROM kros_items").fetchone()[0],
        "_disclaimer": (
            "DRAFT worksheet, NOT authoritative. Local DB is a 9173-code subset "
            "(only 1602 from CS ÚRS 2026 01) so most items will need manual lookup "
            "at podminky.urs.cz. Even 'hint_strong' rows need human verification — "
            "heuristic urs_code_proposed in items.json frequently guesses the right "
            "family but the wrong leaf (e.g. EPS pro podlahu → catalog kód pro střechu)."
        ),
        "_summary": {
            "total_items": len(results),
            "hint_strong": status_counts.get("hint_strong", 0),
            "hint_text": status_counts.get("hint_text", 0),
            "hint_weak": status_counts.get("hint_weak", 0),
            "urs_search_needed": status_counts.get("urs_search_needed", 0),
            "proposed_code_present_in_db": proposed_hits,
            "avg_best_score": round(avg_score, 3),
            "reason_breakdown": dict(reason_counts.most_common()),
            "by_gate": {f"{g}/{s}": n for (g, s), n in by_gate.items()},
        },
        "results": results,
    }, indent=2, ensure_ascii=False))

    # Human report
    md = [
        "# URS Match Worksheet — RD Jáchymov (Part 5b draft, NOT authoritative)",
        f"",
        f"**Generated:** {date.today()}",
        f"**Catalog:** `test-data/kros_catalog.db` ({con.execute('SELECT COUNT(*) FROM kros_items').fetchone()[0]:,} URS codes; "
        f"only 1 602 from CS ÚRS 2026 01)",
        f"**Items processed:** {len(results)}",
        f"",
        "> **Disclaimer.** This is a DRAFT worksheet. Local DB is a tiny slice of full URS",
        "> 2026/1 (~40 000+ codes). Even `hint_strong` rows need human verification —",
        "> heuristic `urs_code_proposed` in `items.json` frequently guesses the right",
        "> family (first 6 digits) but the wrong leaf. Spot-check examples in the matched",
        "> list: EPS pro podlahu was suggested 713141121 which is actually 'izolace střech",
        "> plochých', and 'Bourání plechové krytiny' matched 962081141 'Bourání příček ze",
        "> skleněných tvárnic' — both code prefixes overlap but the work types disagree.",
        "> Always open `podminky.urs.cz` and verify per row.",
        f"",
        f"## Summary",
        f"",
        f"| Status | Count | Criterion |",
        f"|---|--:|---|",
        f"| `hint_strong` | **{status_counts.get('hint_strong', 0)}** | proposed code in DB + mj agrees + best.score ≥ 0.60 |",
        f"| `hint_text` | {status_counts.get('hint_text', 0)} | text signal only (mj match + score ≥ 0.45) |",
        f"| `hint_weak` | {status_counts.get('hint_weak', 0)} | proposed code in DB but text disagrees |",
        f"| `urs_search_needed` | {status_counts.get('urs_search_needed', 0)} | weak signal — open podminky.urs.cz |",
        f"",
        f"**Proposed code confirmed (exact hit in DB):** {proposed_hits} / {len(results)}",
        f"**Avg best_score:** {avg_score:.3f}",
        f"",
        f"### Reason breakdown",
        f"",
        f"| Reason | Count |",
        f"|---|--:|",
    ] + [f"| {r} | {n} |" for r, n in reason_counts.most_common()] + [
        f"",
        f"## By gate × status",
        f"",
    ]
    md.extend(["| Gate | hint_strong | hint_text | hint_weak | urs_search_needed |", "|---|--:|--:|--:|--:|"])
    for gate in ["HSV", "PSV", "TZB", "VRN"]:
        hs = by_gate.get((gate, "hint_strong"), 0)
        ht = by_gate.get((gate, "hint_text"), 0)
        hw = by_gate.get((gate, "hint_weak"), 0)
        us = by_gate.get((gate, "urs_search_needed"), 0)
        md.append(f"| {gate} | {hs} | {ht} | {hw} | {us} |")

    md.extend([
        "",
        "## hint_strong — verify these first (false-positive rate observed ~50 %)",
        "",
        "| id | popis | best_kod | best popis | mj | catalog | URS |",
        "|---|---|---|---|---|---|---|",
    ])
    hs = [r for r in results if r["match_status"] == "hint_strong"]
    for r in hs:
        b = r["best_match"]
        md.append(
            f"| {r['id']} | {r['popis'][:50]} | `{b['kod']}` | {b['popis'][:50]} | "
            f"{b['mj']} | {b['cenova_soustava']} | [open]({r['podminky_url']}) |"
        )

    md.extend([
        "",
        "## hint_text (text-only signal — usually wrong family)",
        "",
        "| id | popis | proposed | best_kod | best popis | score |",
        "|---|---|---|---|---|--:|",
    ])
    ht = sorted([r for r in results if r["match_status"] == "hint_text"], key=lambda x: -x["best_score"])
    for r in ht[:40]:
        b = r["best_match"]
        md.append(
            f"| {r['id']} | {r['popis'][:50]} | `{r['urs_code_proposed'] or '—'}` | "
            f"`{b['kod']}` | {b['popis'][:50]} | {r['best_score']:.2f} |"
        )

    md.extend([
        "",
        "## hint_weak (proposed code in DB but text disagrees — likely wrong leaf)",
        "",
        "| id | popis | proposed_kod | catalog popis for that code | score |",
        "|---|---|---|---|--:|",
    ])
    hw = [r for r in results if r["match_status"] == "hint_weak"]
    for r in hw:
        b = r["best_match"]
        md.append(
            f"| {r['id']} | {r['popis'][:50]} | `{b['kod']}` | {b['popis'][:60]} | {r['best_score']:.2f} |"
        )

    md.extend([
        "",
        "## urs_search_needed — open podminky.urs.cz manually",
        "",
        "| id | popis | proposed | URS link |",
        "|---|---|---|---|",
    ])
    us = sorted([r for r in results if r["match_status"] == "urs_search_needed"], key=lambda x: x["_gate"])
    for r in us:
        md.append(
            f"| {r['id']} | {r['popis'][:60]} | `{r['urs_code_proposed'] or '—'}` | "
            f"[search]({r['podminky_url'] or 'n/a'}) |"
        )

    OUT_MD.write_text("\n".join(md))
    print(f"\n✓ Wrote {OUT_JSON.relative_to(PROJ.parent)} ({OUT_JSON.stat().st_size:,} bytes)", file=sys.stderr)
    print(f"✓ Wrote {OUT_MD.relative_to(PROJ.parent)} ({OUT_MD.stat().st_size:,} bytes)", file=sys.stderr)
    print(
        f"\nSummary: hint_strong={status_counts.get('hint_strong',0)} "
        f"hint_text={status_counts.get('hint_text',0)} "
        f"hint_weak={status_counts.get('hint_weak',0)} "
        f"urs_search_needed={status_counts.get('urs_search_needed',0)} "
        f"(avg score {avg_score:.3f})",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
