#!/usr/bin/env python3
"""
hk212 — Layer 3 rematch via smety_corpus + urs_cache cross-check.

Layer 1 (urs_fts) + Layer 2 (node_texts_fts) score hk212 popis against
catalog *titles* (short, ~5 tokens). Layer 3 scores popis against full
rozpočtář-curated popis from 12 reference smety in example_vv/ (~3000
verified code↔popis pairs, mostly hala-style projects). Then verifies the
legacy code in the local urs_cache.db so we know it still lives in the
modern catalog (any vintage, prefer 2026-I).

Run order (after Phase 1 rematch_urs_cache.py):
    python test-data/hk212_hala/scripts/phase_1_etap1/build_smety_corpus.py
    python test-data/hk212_hala/scripts/phase_1_etap1/rematch_layer3.py

Args (all optional with sensible defaults):
    --items       items_hk212_etap1.json (target, in-place + backup)
    --corpus      smety_corpus.json (built by build_smety_corpus.py)
    --db          data/urs_cache.db   (skip DB verification with --no-db)
    --threshold-high 0.55
    --threshold-medium 0.35
    --top-k 10
    --no-db       run without cache verification (rely on corpus alone)
    --dry-run
    --verbose
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import sqlite3
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[3].parent
DEFAULT_ITEMS = REPO_ROOT / "test-data/hk212_hala/outputs/phase_1_etap1/items_hk212_etap1.json"
DEFAULT_CORPUS = REPO_ROOT / "test-data/hk212_hala/outputs/phase_1_etap1/smety_corpus.json"
DEFAULT_DB = REPO_ROOT / "data/urs_cache.db"
DEFAULT_THRESHOLD_HIGH = 0.55
DEFAULT_THRESHOLD_MEDIUM = 0.35
DEFAULT_TOP_K = 10

STATUS_RANK = {"needs_review": 0, "matched_medium": 1, "matched_high": 2, "custom_item": 9}

CZECH_STOPWORDS = {
    "a", "aby", "ale", "ani", "asi", "az", "by", "byl", "byla", "byli", "bylo", "byly", "byt",
    "ci", "co", "dale", "do", "ho", "i", "jak", "jako", "je", "jen", "jeho", "jejich", "ji",
    "jiz", "jsem", "jsi", "jsme", "jsou", "jste", "k", "ke", "ktera", "ktere", "ktery", "kteri",
    "kterou", "kdo", "kdy", "kdyz", "ma", "mam", "mate", "me", "mezi", "mi", "mit", "mu", "my",
    "na", "nad", "nam", "nas", "nase", "nasi", "ne", "nebo", "neni", "nez", "no", "o", "od",
    "on", "ona", "oni", "ono", "ony", "pak", "po", "pod", "podle", "pres", "pri", "pro", "proc",
    "proto", "prave", "s", "se", "si", "sice", "snad", "ta", "tak", "takovy", "tato", "te",
    "tedy", "tem", "ten", "ti", "to", "tohle", "toho", "tom", "tomu", "ty", "u", "uz", "v",
    "vam", "vas", "ve", "vedle", "vsak", "vsech", "vsechny", "vy", "z", "za", "zda", "zde", "ze",
}
TECH_TOKENS = {"m", "mm", "cm", "m2", "m3", "kg", "t", "ks", "hod", "bm"}


def setup_logging(verbose: bool) -> logging.Logger:
    logger = logging.getLogger("layer3")
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    logger.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
    logger.addHandler(h)
    return logger


def deburr_lower(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", stripped.lower()).strip()


def tokenize(text: str) -> set[str]:
    raw = re.findall(r"[a-z0-9]+", deburr_lower(text))
    out: set[str] = set()
    for tok in raw:
        if tok in TECH_TOKENS:
            out.add(tok)
        elif len(tok) < 3:
            continue
        elif tok in CZECH_STOPWORDS:
            continue
        else:
            out.add(tok)
    return out


def dice_score(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return 2.0 * len(a & b) / (len(a) + len(b))


# ----------------------------------------------------------------------------
# DB verification
# ----------------------------------------------------------------------------

def verify_in_cache(conn: Optional[sqlite3.Connection], code: str) -> dict:
    """Return {present, vintages, title} or {present: False}."""
    if not conn or not code:
        return {"present": False}
    try:
        cur = conn.execute(
            "SELECT vintage, title FROM items WHERE urs_code = ? ORDER BY vintage DESC LIMIT 11",
            (code,),
        )
        rows = cur.fetchall()
    except sqlite3.OperationalError:
        return {"present": False}
    if not rows:
        return {"present": False}
    vintages = sorted({r[0] for r in rows}, reverse=True)
    return {
        "present": True,
        "vintages": vintages,
        "latest_vintage": vintages[0],
        "title": rows[0][1],
    }


# ----------------------------------------------------------------------------
# Corpus search
# ----------------------------------------------------------------------------

def build_corpus_index(corpus: list[dict]) -> list[dict]:
    """Pre-tokenize every corpus item once (saves Nx repeats)."""
    for c in corpus:
        c["_tokens"] = tokenize(c.get("popis", ""))
    return corpus


def score_corpus(item_tokens: set[str], corpus: list[dict],
                  top_k: int) -> list[dict]:
    """Brute-force Dice over corpus. 134 items × 3000 corpus × Dice is trivial."""
    scored: list[dict] = []
    for c in corpus:
        if not c["_tokens"]:
            continue
        s = dice_score(item_tokens, c["_tokens"])
        if s < 0.20:  # cheap floor
            continue
        scored.append({
            "code": c["code"],
            "popis": c.get("popis", ""),
            "mj": c.get("mj", ""),
            "vintage": c.get("vintage"),
            "source_file": c.get("source_file", ""),
            "row_type": c.get("row_type", ""),
            "dice": round(s, 4),
        })
    scored.sort(key=lambda x: -x["dice"])
    return scored[:top_k]


# ----------------------------------------------------------------------------
# Driver
# ----------------------------------------------------------------------------

def run(args, logger: logging.Logger) -> int:
    if not args.items.exists():
        logger.error(f"Items not found: {args.items}")
        return 2
    if not args.corpus.exists():
        logger.error(f"Corpus not found: {args.corpus}  →  run build_smety_corpus.py first")
        return 2

    with open(args.items, encoding="utf-8") as f:
        wrapper = json.load(f)
    is_list = isinstance(wrapper, list)
    items = wrapper if is_list else wrapper.get("items", [])
    if not items:
        logger.error("No items in input")
        return 3

    with open(args.corpus, encoding="utf-8") as f:
        corpus_data = json.load(f)
    corpus = corpus_data["items"]
    logger.info(f"Loaded {len(items)} items + {len(corpus)} corpus entries "
                f"(vintage mix: {corpus_data.get('by_vintage')})")

    build_corpus_index(corpus)

    conn: Optional[sqlite3.Connection] = None
    if not args.no_db:
        if not args.db.exists():
            logger.warning(f"DB not found at {args.db} — running without cache verification "
                           "(use --no-db to suppress this warning)")
        else:
            conn = sqlite3.connect(str(args.db))
            cache_n = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
            logger.info(f"urs_cache.db verification ON ({cache_n:,} catalog rows)")

    # Backup (idempotent)
    if not args.dry_run:
        backup_path = args.items.with_name(args.items.stem + "_pre_layer3.json")
        if not backup_path.exists():
            shutil.copy2(args.items, backup_path)
            logger.info(f"Backup → {backup_path.name}")
        else:
            logger.info(f"Backup already exists at {backup_path.name} (idempotent skip)")

    # Per-item Layer 3
    status_before = Counter(it.get("urs_status") for it in items)
    deltas: list[dict] = []
    alternatives_added = 0

    for item in items:
        # Layer 3 only touches needs_review (conservative — don't override Phase 1 matches)
        if item.get("urs_status") != "needs_review":
            continue

        source = (item.get("raw_description") or item.get("popis") or "").strip()
        if not source:
            continue
        toks = tokenize(source)
        if not toks:
            continue

        candidates = score_corpus(toks, corpus, args.top_k)
        if not candidates:
            continue

        # Verify each top-candidate's code in cache
        for c in candidates:
            v = verify_in_cache(conn, c["code"])
            c["cache_present"] = v["present"]
            c["cache_vintages"] = v.get("vintages") or []
            c["cache_title"] = v.get("title") or ""
            # Boost score if code verified in current 2026-I; smaller boost for any vintage
            if v["present"]:
                if "2026-I" in c["cache_vintages"] or "2025-II" in c["cache_vintages"]:
                    c["dice_boosted"] = min(c["dice"] * 1.20, 1.0)
                else:
                    c["dice_boosted"] = min(c["dice"] * 1.10, 1.0)
            else:
                c["dice_boosted"] = c["dice"]
        candidates.sort(key=lambda x: -x["dice_boosted"])

        best = candidates[0]
        old_status = item.get("urs_status")
        old_code = item.get("urs_code")
        old_score = item.get("urs_match_score") or 0.0

        # Append Layer 3 hints to urs_alternatives (preserve existing too)
        existing_alts = item.get("urs_alternatives") or []
        layer3_alts = [
            {
                "code": c["code"],
                "score": c["dice_boosted"],
                "title": c["popis"][:120],
                "vintage": c.get("vintage") or "?",
                "source": "smety_corpus",
                "in_modern_cache": c["cache_present"],
            }
            for c in candidates[:5]
        ]
        merged_alts = existing_alts + layer3_alts
        # Dedupe by code, keep highest score
        seen: dict[str, dict] = {}
        for a in merged_alts:
            code = a.get("code") or ""
            if code and (code not in seen or (a.get("score") or 0) > (seen[code].get("score") or 0)):
                seen[code] = a
        item["urs_alternatives"] = sorted(seen.values(), key=lambda x: -(x.get("score") or 0))[:10]
        alternatives_added += 1

        # Decision
        score = best["dice_boosted"]
        if score >= args.threshold_high and best["cache_present"]:
            new_status, conf = "matched_high", 0.85
        elif score >= args.threshold_medium:
            new_status, conf = "matched_medium", 0.70
        else:
            continue  # keep needs_review, alternatives updated

        item["urs_code"] = best["code"]
        item["urs_match_score"] = score
        item["urs_status"] = new_status
        item["confidence"] = conf

        deltas.append({
            "id": item.get("id"),
            "kapitola": item.get("kapitola"),
            "old": {"code": old_code, "status": old_status, "score": old_score},
            "new": {"code": best["code"], "status": new_status, "score": score,
                    "title": best["popis"][:80]},
            "corpus_source": best.get("source_file", "")[:60],
            "corpus_vintage": best.get("vintage"),
            "in_modern_cache": best["cache_present"],
            "modern_vintages": best.get("cache_vintages")[:3],
        })

    if conn:
        conn.close()

    status_after = Counter(it.get("urs_status") for it in items)
    n_custom = status_before.get("custom_item", 0)
    matched_before = status_before.get("matched_high", 0) + status_before.get("matched_medium", 0)
    matched_after = status_after.get("matched_high", 0) + status_after.get("matched_medium", 0)
    rate_before = matched_before / max(len(items) - n_custom, 1) * 100
    rate_after = matched_after / max(len(items) - n_custom, 1) * 100

    logger.info(f"Status before: {dict(status_before)}")
    logger.info(f"Status after:  {dict(status_after)}")
    logger.info(f"Match rate (excl. custom): {rate_before:.1f} % → {rate_after:.1f} %")
    logger.info(f"Items updated: {len(deltas)}, alternatives merged: {alternatives_added}")

    if args.dry_run:
        logger.info("--dry-run: nothing written")
        for d in deltas[:10]:
            logger.info(f"  {d['id']}: → {d['new']['code']} ({d['new']['score']:.2f}) "
                        f"[{d['new']['status']}, vintage={d['corpus_vintage']}, "
                        f"in_cache={d['in_modern_cache']}]")
        return 0

    # Write items
    with open(args.items, "w", encoding="utf-8") as f:
        if is_list:
            json.dump(items, f, indent=2, ensure_ascii=False)
        else:
            wrapper["items"] = items
            json.dump(wrapper, f, indent=2, ensure_ascii=False)
        f.write("\n")
    logger.info(f"Wrote {args.items.name}")

    # Audit JSON
    audit = {
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "threshold_high": args.threshold_high,
        "threshold_medium": args.threshold_medium,
        "top_k": args.top_k,
        "cache_verification": conn is not None,
        "scoring": "layer3_dice_v1 (corpus popis-vs-popis, +20% boost if in modern cache 2026-I/2025-II, +10% if any vintage)",
        "corpus_size": len(corpus),
        "items_total": len(items),
        "items_updated": len(deltas),
        "alternatives_merged": alternatives_added,
        "status_before": dict(status_before),
        "status_after": dict(status_after),
        "match_rate_before_pct": round(rate_before, 1),
        "match_rate_after_pct": round(rate_after, 1),
        "deltas": deltas,
    }
    audit_path = args.items.parent / "rematch_layer3_audit.json"
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(audit, f, indent=2, ensure_ascii=False)
        f.write("\n")
    logger.info(f"Wrote {audit_path.name}")

    # Markdown report
    report_path = args.items.parent / "rematch_layer3_report.md"
    write_report(report_path, items, deltas, audit, logger)
    return 0


def write_report(path: Path, items: list[dict], deltas: list[dict],
                  audit: dict, logger: logging.Logger) -> None:
    L: list[str] = []
    L.append("# HK212 — Layer 3 Rematch Report (smety corpus + cache verification)\n")
    L.append(f"_Ran at: {audit['ran_at']}_\n")
    L.append(f"_Thresholds: high={audit['threshold_high']}, "
             f"medium={audit['threshold_medium']}, top-k={audit['top_k']}_\n")
    L.append(f"_Cache verification: {audit['cache_verification']}_\n")
    L.append(f"_Corpus size: {audit['corpus_size']} verified code↔popis pairs_\n")
    L.append("")
    L.append("## Summary\n")
    L.append(f"- Items updated: **{audit['items_updated']}**")
    L.append(f"- Alternatives merged: **{audit['alternatives_merged']}**")
    L.append(f"- Match rate: **{audit['match_rate_before_pct']:.1f} % → "
             f"{audit['match_rate_after_pct']:.1f} %**\n")
    L.append("| Status | Before | After | Δ |")
    L.append("|---|---:|---:|---:|")
    sb, sa = audit["status_before"], audit["status_after"]
    for st in ("matched_high", "matched_medium", "needs_review", "custom_item"):
        b, a = sb.get(st, 0), sa.get(st, 0)
        L.append(f"| {st} | {b} | {a} | {a - b:+d} |")
    L.append("")
    if deltas:
        L.append("## Top-20 Layer 3 matches\n")
        L.append("| id | kapitola | new code | score | status | vintage (corpus) | in cache? | popis |")
        L.append("|---|---|---|---:|---|---|---|---|")
        for d in sorted(deltas, key=lambda x: -x["new"]["score"])[:20]:
            in_c = "✓ " + (d["modern_vintages"][0] if d["modern_vintages"] else "?") if d["in_modern_cache"] else "—"
            popis = d["new"]["title"].replace("|", "\\|")[:60]
            L.append(
                f"| {d['id']} | {d['kapitola']} | `{d['new']['code']}` | "
                f"{d['new']['score']:.2f} | {d['new']['status']} | "
                f"{d['corpus_vintage'] or '?'} | {in_c} | {popis} |"
            )
        L.append("")
    still = [it for it in items if it.get("urs_status") == "needs_review"]
    L.append(f"## Still in needs_review ({len(still)} items, top 20 by quantity)\n")
    L.append("| id | kapitola | popis | mj | mnozstvi |")
    L.append("|---|---|---|---|---:|")
    for it in sorted(still, key=lambda x: -(x.get("mnozstvi") or 0))[:20]:
        popis = (it.get("popis") or "")[:80].replace("|", "\\|")
        L.append(f"| {it.get('id')} | {it.get('kapitola')} | {popis} | "
                 f"{it.get('mj')} | {it.get('mnozstvi')} |")
    L.append("")
    path.write_text("\n".join(L), encoding="utf-8")
    logger.info(f"Wrote {path.name}")


def main() -> int:
    ap = argparse.ArgumentParser(description="hk212 Layer 3 rematch via smety corpus")
    ap.add_argument("--items", type=Path, default=DEFAULT_ITEMS)
    ap.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    ap.add_argument("--threshold-high", type=float, default=DEFAULT_THRESHOLD_HIGH)
    ap.add_argument("--threshold-medium", type=float, default=DEFAULT_THRESHOLD_MEDIUM)
    ap.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    ap.add_argument("--no-db", action="store_true",
                    help="Skip urs_cache verification — rely on corpus codes verbatim")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logger = setup_logging(args.verbose)
    logger.info(f"Items:    {args.items}")
    logger.info(f"Corpus:   {args.corpus}")
    logger.info(f"DB:       {args.db if not args.no_db else 'OFF (--no-db)'}")
    logger.info(f"Thresholds: high={args.threshold_high}, medium={args.threshold_medium}, "
                f"top-k={args.top_k}, dry-run={args.dry_run}")

    try:
        return run(args, logger)
    except Exception as e:
        logger.exception(f"FATAL: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
