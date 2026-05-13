#!/usr/bin/env python3
"""
hk212 — URS rematch against local urs_cache.db (dual-layer FTS5).

Reads test-data/hk212_hala/outputs/phase_1_etap1/items_hk212_etap1.json (141 items),
queries the modern URS cache built by scripts/urs_cache/{urs_cache_builder,urs_cache_enrich}.py,
and updates urs_code / urs_status / urs_match_score in place. Backup written once.

Run:
    python test-data/hk212_hala/scripts/phase_1_etap1/rematch_urs_cache.py
    python ... --dry-run           # show deltas without writing
    python ... --threshold 0.85    # high-tier cutoff (default)
    python ... --top-k 20          # candidates per layer

Spec: test-data/hk212_hala/TASK_HK212_URS_Cache_Rematch_v2.md
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
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ----------------------------------------------------------------------------
# Defaults
# ----------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[3].parent  # test-data/hk212_hala/scripts/phase_1_etap1 → repo root
DEFAULT_ITEMS = REPO_ROOT / "test-data/hk212_hala/outputs/phase_1_etap1/items_hk212_etap1.json"
DEFAULT_DB = REPO_ROOT / "data/urs_cache.db"
DEFAULT_THRESHOLD_HIGH = 0.55   # Calibrated for Dice over (title + path + breadcrumb).
DEFAULT_THRESHOLD_MEDIUM = 0.30  # BM25-era "0.85" doesn't translate to Dice — see ADR in commit log.
DEFAULT_TOP_K = 50  # FTS5 retrieval per layer; Dice rescore picks final top.

STATUS_RANK = {"needs_review": 0, "matched_medium": 1, "matched_high": 2, "custom_item": 9}

VINTAGE_ORDER = [
    "2026-I", "2025-II", "2025-I", "2024-II", "2024-I",
    "2023-II", "2023-I", "2022-II", "2022-I", "2021-II", "2021-I",
]
VINTAGE_WEIGHT = {v: 1.0 - i * 0.01 for i, v in enumerate(VINTAGE_ORDER)}  # 1.00 → 0.90

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


# ----------------------------------------------------------------------------
# Logging
# ----------------------------------------------------------------------------

def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    logger = logging.getLogger("rematch")
    logger.setLevel(level)
    logger.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
    logger.addHandler(h)
    return logger


# ----------------------------------------------------------------------------
# Text normalization + tokenization
# ----------------------------------------------------------------------------

def deburr(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", deburr(text).lower()).strip()


def tokenize(text: str) -> list[str]:
    """Split, drop short + stopwords, keep tech tokens regardless."""
    raw = re.findall(r"[a-z0-9]+", normalize(text))
    out = []
    for tok in raw:
        if tok in TECH_TOKENS:
            out.append(tok)
        elif len(tok) < 3:
            continue
        elif tok in CZECH_STOPWORDS:
            continue
        else:
            out.append(tok)
    return out


# FTS5 reserved chars + bare numbers + 1-2 char tokens are unsafe in MATCH expressions.
_FTS5_SAFE_RE = re.compile(r"^[a-z][a-z0-9]*$")


def build_fts_query(tokens: list[str]) -> str:
    """OR-joined query with auto-prefix wildcard for tokens ≥ 4 chars.

    Skip pure-numeric and 1-2 char tokens — they break FTS5 BM25 ranking
    (too common, no selectivity).
    """
    parts: list[str] = []
    seen: set[str] = set()
    for tok in tokens:
        if tok in seen or not _FTS5_SAFE_RE.match(tok):
            continue
        seen.add(tok)
        parts.append(f"{tok}*" if len(tok) >= 4 else tok)
    return " OR ".join(parts)


# ----------------------------------------------------------------------------
# DB queries
# ----------------------------------------------------------------------------

def dice_score(query_toks: set[str], cand_toks: set[str]) -> float:
    """Dice coefficient 2|A∩B|/(|A|+|B|) in [0, 1].

    FTS5 BM25 rank is great for retrieval (give me 50 candidates with overlap)
    but useless as an absolute similarity score — the raw values are in some
    unbounded negative range that depends on query length, doc length, IDF, etc.
    So we use FTS5 only for candidate selection, then re-score with token Dice.
    """
    if not query_toks or not cand_toks:
        return 0.0
    inter = len(query_toks & cand_toks)
    return 2.0 * inter / (len(query_toks) + len(cand_toks))


def query_layer1(conn: sqlite3.Connection, fts_q: str, top_k: int) -> list[dict]:
    """urs_fts: catalog item titles + breadcrumb path. Retrieval-only, no rank."""
    sql = """
        SELECT i.urs_code, i.title, i.vintage, i.catalog_code, i.path_titles
        FROM urs_fts JOIN items i ON i.id = urs_fts.rowid
        WHERE urs_fts MATCH ?
        ORDER BY rank LIMIT ?
    """
    cur = conn.execute(sql, (fts_q, top_k))
    return [
        {"urs_code": r[0], "title": r[1], "vintage": r[2],
         "catalog_code": r[3], "path_titles": r[4]}
        for r in cur
    ]


def query_layer2(conn: sqlite3.Connection, fts_q: str, top_k: int) -> list[dict]:
    """node_texts_fts: Czech long-form HTML articles. node_code may be NULL on root-level."""
    sql = """
        SELECT n.node_code, n.node_title, n.vintage, n.catalog_code,
               substr(COALESCE(n.content_text, ''), 1, 200),
               COALESCE(n.breadcrumb_path, '')
        FROM node_texts_fts JOIN node_texts n ON n.id = node_texts_fts.rowid
        WHERE node_texts_fts MATCH ?
        ORDER BY rank LIMIT ?
    """
    cur = conn.execute(sql, (fts_q, top_k))
    return [
        {"urs_code": r[0] or "", "title": r[1], "vintage": r[2],
         "catalog_code": r[3], "preview": r[4], "breadcrumb": r[5]}
        for r in cur if r[0]
    ]


def merge_candidates(
    query_toks: set[str],
    layer1: list[dict],
    layer2: list[dict],
    catalog_prefix: Optional[str],
) -> list[dict]:
    """Group by urs_code, Dice-score each candidate × vintage_weight × catalog_bonus."""
    by_code: dict[str, dict] = {}
    for src, cand in [("layer1", layer1), ("layer2", layer2)]:
        for c in cand:
            code = c["urs_code"]
            # Build candidate token bag from title + path/breadcrumb + (Layer 2) preview.
            # path_titles / breadcrumb add semantic context (catalog hierarchy)
            # which is what makes "Skládkovné" item match catalog "800-1 / Zemní práce / Skládkování".
            cand_text = c.get("title") or ""
            for extra in ("path_titles", "breadcrumb", "preview"):
                v = c.get(extra)
                if v:
                    cand_text += " " + v
            cand_toks = set(tokenize(cand_text))
            base = dice_score(query_toks, cand_toks)
            vintage_w = VINTAGE_WEIGHT.get(c["vintage"], 0.85)
            catalog_bonus = 1.10 if (catalog_prefix and c["catalog_code"]
                                      and c["catalog_code"].startswith(catalog_prefix)) else 1.0
            score = min(base * vintage_w * catalog_bonus, 1.0)
            existing = by_code.get(code)
            if not existing or score > existing["score"]:
                by_code[code] = {
                    "urs_code": code,
                    "title": c["title"],
                    "vintage": c["vintage"],
                    "catalog_code": c["catalog_code"],
                    "score": round(score, 4),
                    "source_layer": existing["source_layer"] + "+" + src if existing and existing.get("source_layer") != src else src,
                }
    return sorted(by_code.values(), key=lambda d: d["score"], reverse=True)


# ----------------------------------------------------------------------------
# Per-item rematch
# ----------------------------------------------------------------------------

def catalog_prefix_for_item(item: dict) -> Optional[str]:
    """Existing urs_code's leading digits hint a catalog (e.g. 800-1)."""
    code = item.get("urs_code") or ""
    digits = re.match(r"^(\d{3})", str(code))
    return digits.group(1) if digits else None


def rematch_item(
    item: dict,
    conn: sqlite3.Connection,
    threshold_high: float,
    threshold_medium: float,
    top_k: int,
    logger: logging.Logger,
) -> tuple[Optional[dict], list[dict]]:
    """Return (decision_dict | None, top5_alternatives).

    decision_dict has: urs_code, urs_match_score, urs_status, confidence, vintage_picked,
                       source_layer, title — if score >= threshold_medium.
    None means no candidate cleared the medium bar.
    """
    source = (item.get("raw_description") or item.get("popis") or "").strip()
    if not source:
        return None, []
    tokens = tokenize(source)
    if not tokens:
        return None, []
    fts_q = build_fts_query(tokens)
    if not fts_q:
        return None, []

    try:
        l1 = query_layer1(conn, fts_q, top_k)
        l2 = query_layer2(conn, fts_q, top_k)
    except sqlite3.OperationalError as e:
        # Elevated from debug → warning so silent FTS5 syntax failures are visible
        # without --verbose. Run diagnose_urs_fts.py for a focused repro.
        logger.warning(f"FTS query failed for {item.get('id')}: {e}; query={fts_q!r}")
        return None, []

    cat_prefix = catalog_prefix_for_item(item)
    merged = merge_candidates(set(tokens), l1, l2, cat_prefix)
    if not merged:
        return None, []

    top5 = [
        {"code": c["urs_code"], "score": c["score"], "title": c["title"],
         "vintage": c["vintage"], "catalog_code": c["catalog_code"]}
        for c in merged[:5]
    ]

    best = merged[0]
    score = best["score"]
    if score >= threshold_high:
        new_status, conf = "matched_high", 0.85
    elif score >= threshold_medium:
        new_status, conf = "matched_medium", 0.75
    else:
        return None, top5

    return {
        "urs_code": best["urs_code"],
        "urs_match_score": score,
        "urs_status": new_status,
        "confidence": conf,
        "vintage_picked": best["vintage"],
        "source_layer": best["source_layer"],
        "title": best["title"],
    }, top5


# ----------------------------------------------------------------------------
# Driver
# ----------------------------------------------------------------------------

def run(args, logger: logging.Logger) -> int:
    items_path: Path = args.items
    db_path: Path = args.db

    if not db_path.exists():
        logger.error(f"DB not found: {db_path}")
        logger.error("Run first: python scripts/urs_cache/urs_cache_builder.py")
        return 2

    if not items_path.exists():
        logger.error(f"Items file not found: {items_path}")
        return 2

    with open(items_path, encoding="utf-8") as f:
        wrapper = json.load(f)
    is_list = isinstance(wrapper, list)
    items = wrapper if is_list else wrapper.get("items", [])
    if not items:
        logger.error("No items in input")
        return 3

    # Sanity: at least some items should have raw_description or popis
    if not any((it.get("raw_description") or it.get("popis")) for it in items):
        logger.error("All items have empty raw_description AND popis")
        return 3

    n_items_in = len(items)
    custom_in = sum(1 for it in items if it.get("urs_status") == "custom_item")
    status_before = Counter(it.get("urs_status") for it in items)
    logger.info(f"Loaded {n_items_in} items (custom={custom_in})")
    logger.info(f"Status before: {dict(status_before)}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = None  # tuples
    layer1_n = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    try:
        layer2_n = conn.execute("SELECT COUNT(*) FROM node_texts").fetchone()[0]
    except sqlite3.OperationalError:
        layer2_n = 0
    logger.info(f"Cache: {layer1_n:,} items (Layer 1), {layer2_n:,} node texts (Layer 2)")

    # FTS5 sync check — fail fast if the virtual tables are empty while content
    # tables are full (trigger only fires on INSERT, so older content rows
    # never got indexed). Diagnose script offers the rebuild SQL.
    fts1_n = conn.execute("SELECT COUNT(*) FROM urs_fts").fetchone()[0]
    fts2_n = conn.execute("SELECT COUNT(*) FROM node_texts_fts").fetchone()[0] if layer2_n else 0
    logger.info(f"FTS5: {fts1_n:,} urs_fts rows, {fts2_n:,} node_texts_fts rows")
    if (layer1_n > 0 and fts1_n == 0) or (layer2_n > 0 and fts2_n == 0):
        logger.error("FTS5 index out of sync with content tables. Rebuild:")
        logger.error("  python -c \"import sqlite3; c=sqlite3.connect('data/urs_cache.db'); "
                     "c.execute(\\\"INSERT INTO urs_fts(urs_fts) VALUES('rebuild')\\\"); "
                     "c.execute(\\\"INSERT INTO node_texts_fts(node_texts_fts) VALUES('rebuild')\\\"); "
                     "c.commit(); print('OK')\"")
        conn.close()
        return 2

    # Backup (idempotent — only once)
    backup_path = items_path.with_name(items_path.stem + "_pre_rematch.json")
    if not args.dry_run and not backup_path.exists():
        shutil.copy2(items_path, backup_path)
        logger.info(f"Backup written → {backup_path.name}")
    elif backup_path.exists():
        logger.info(f"Backup already exists at {backup_path.name} (idempotent skip)")

    # Per-item rematch
    deltas: list[dict] = []
    improvements_kept = 0

    for item in items:
        if item.get("urs_status") == "custom_item":
            continue

        decision, top5 = rematch_item(
            item, conn, args.threshold_high, args.threshold_medium, args.top_k, logger
        )
        old_code = item.get("urs_code")
        old_score = item.get("urs_match_score") or 0.0
        old_status = item.get("urs_status")

        # Refresh alternatives whenever FTS5 returned ANY candidates.
        # Old alternatives use a different scoring system (Jaccard-ish ~0.667 range);
        # new Dice scores aren't directly comparable, so a score-vs-score gate would
        # never trigger refresh. Just trust the new top-5 — they're from the modern
        # 11-vintage catalog with vintage + title metadata.
        if top5:
            item["urs_alternatives"] = [
                {"code": c["code"], "score": c["score"], "title": c["title"],
                 "vintage": c["vintage"]}
                for c in top5
            ]
            improvements_kept += 1

        if decision is None:
            continue

        new_score = decision["urs_match_score"]
        # Status downgrade protection: never demote matched_high → matched_medium etc.
        # Otherwise (same or higher tier) take the new result as authoritative.
        old_rank = STATUS_RANK.get(old_status, 0)
        new_rank = STATUS_RANK.get(decision["urs_status"], 0)
        if new_rank >= old_rank:
            item["urs_code"] = decision["urs_code"]
            item["urs_match_score"] = new_score
            item["urs_status"] = decision["urs_status"]
            item["confidence"] = decision["confidence"]
            deltas.append({
                "id": item.get("id"),
                "kapitola": item.get("kapitola"),
                "old": {"code": old_code, "score": old_score, "status": old_status},
                "new": {"code": decision["urs_code"], "score": new_score,
                        "status": decision["urs_status"], "title": decision["title"]},
                "source_layer": decision["source_layer"],
                "vintage_picked": decision["vintage_picked"],
            })

    conn.close()

    n_items_out = len(items)
    custom_out = sum(1 for it in items if it.get("urs_status") == "custom_item")
    if n_items_out != n_items_in:
        logger.error(f"Item count drift: {n_items_in} → {n_items_out}")
        return 4
    if custom_out != custom_in:
        logger.error(f"custom_item count drift: {custom_in} → {custom_out}")
        return 5

    status_after = Counter(it.get("urs_status") for it in items)
    matched_before = status_before.get("matched_high", 0) + status_before.get("matched_medium", 0)
    matched_after = status_after.get("matched_high", 0) + status_after.get("matched_medium", 0)
    rate_before = matched_before / max(n_items_in - custom_in, 1) * 100
    rate_after = matched_after / max(n_items_in - custom_in, 1) * 100

    logger.info(f"Status after:  {dict(status_after)}")
    logger.info(f"Match rate (excl. custom): {rate_before:.1f} % → {rate_after:.1f} %")
    logger.info(f"Items updated: {len(deltas)}, alternatives refreshed: {improvements_kept}")

    if args.dry_run:
        logger.info("--dry-run: nothing written")
        for d in deltas[:10]:
            logger.info(f"  {d['id']}: {d['old']['code']} ({d['old']['score']:.2f}) → "
                        f"{d['new']['code']} ({d['new']['score']:.2f}) [{d['new']['status']}]")
        return 0

    # Write items back
    with open(items_path, "w", encoding="utf-8") as f:
        if is_list:
            json.dump(items, f, indent=2, ensure_ascii=False)
        else:
            wrapper["items"] = items
            json.dump(wrapper, f, indent=2, ensure_ascii=False)
        f.write("\n")
    logger.info(f"Wrote {items_path}")

    # Audit + report
    audit = {
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "threshold_high": args.threshold_high,
        "threshold_medium": args.threshold_medium,
        "top_k": args.top_k,
        "scoring": "dice_v1 (token Dice over title + path_titles + breadcrumb + preview)",
        "total_items": n_items_in,
        "skipped_custom": custom_in,
        "items_updated": len(deltas),
        "alternatives_refreshed": improvements_kept,
        "status_before": dict(status_before),
        "status_after": dict(status_after),
        "match_rate_before_pct": round(rate_before, 1),
        "match_rate_after_pct": round(rate_after, 1),
        "deltas": deltas,
    }
    audit_path = items_path.parent / "rematch_audit.json"
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(audit, f, indent=2, ensure_ascii=False)
        f.write("\n")
    logger.info(f"Wrote {audit_path.name}")

    write_report(items, items_path.parent / "rematch_report.md", audit, logger)
    return 0


# ----------------------------------------------------------------------------
# Markdown report
# ----------------------------------------------------------------------------

def write_report(items: list[dict], path: Path, audit: dict, logger: logging.Logger):
    lines: list[str] = []
    lines.append("# HK212 — URS Cache Rematch Report\n")
    lines.append(f"_Ran at: {audit['ran_at']}_\n")
    lines.append(f"_Thresholds: high={audit['threshold_high']}, medium={audit['threshold_medium']}, "
                 f"top-k per layer: {audit['top_k']}_\n")
    lines.append(f"_Scoring: {audit.get('scoring', 'dice_v1')}_\n")
    lines.append("")
    lines.append("## Summary\n")
    lines.append(f"- Items total: **{audit['total_items']}** (custom skipped: {audit['skipped_custom']})")
    lines.append(f"- Match rate: **{audit['match_rate_before_pct']:.1f} % → {audit['match_rate_after_pct']:.1f} %**")
    lines.append(f"- Items updated: **{audit['items_updated']}**")
    lines.append(f"- Alternatives refreshed (no primary swap): {audit['alternatives_refreshed']}")
    lines.append("")
    lines.append("### Status distribution\n")
    lines.append("| Status | Before | After | Δ |")
    lines.append("|---|---:|---:|---:|")
    all_st = sorted(set(audit["status_before"]) | set(audit["status_after"]))
    for st in all_st:
        b = audit["status_before"].get(st, 0)
        a = audit["status_after"].get(st, 0)
        lines.append(f"| {st or '(none)'} | {b} | {a} | {a - b:+d} |")
    lines.append("")

    deltas = audit["deltas"]
    if deltas:
        ranked = sorted(
            deltas,
            key=lambda d: (d["new"]["score"] - (d["old"]["score"] or 0)),
            reverse=True,
        )
        lines.append("## Top-20 biggest score improvements\n")
        lines.append("| id | kapitola | old code (score) | new code (score) | status | vintage |")
        lines.append("|---|---|---|---|---|---|")
        for d in ranked[:20]:
            lines.append(
                f"| {d['id']} | {d['kapitola']} | "
                f"`{d['old']['code']}` ({(d['old']['score'] or 0):.2f}) | "
                f"`{d['new']['code']}` ({d['new']['score']:.2f}) | "
                f"{d['new']['status']} | {d['vintage_picked']} |"
            )
        lines.append("")

    # Top-20 still needs_review
    still_review = [it for it in items if it.get("urs_status") == "needs_review"]
    if still_review:
        lines.append(f"## Still in needs_review ({len(still_review)} items, top 20 by quantity)\n")
        lines.append("| id | kapitola | popis | mj | mnozstvi |")
        lines.append("|---|---|---|---|---:|")
        for it in sorted(still_review, key=lambda x: -(x.get("mnozstvi") or 0))[:20]:
            popis = (it.get("popis") or "")[:80].replace("|", "\\|")
            lines.append(
                f"| {it.get('id')} | {it.get('kapitola')} | {popis} | "
                f"{it.get('mj')} | {it.get('mnozstvi')} |"
            )
        lines.append("")

    # Per-kapitola breakdown
    per_kap_before: dict[str, Counter] = defaultdict(Counter)
    per_kap_after: dict[str, Counter] = defaultdict(Counter)
    # Reconstruct before from current items + deltas (status before = current minus diff)
    # Simpler: take current item state for "after", deltas for "before".
    delta_by_id = {d["id"]: d for d in deltas}
    for it in items:
        kap = it.get("kapitola") or "(none)"
        after_st = it.get("urs_status")
        if it["id"] in delta_by_id:
            before_st = delta_by_id[it["id"]]["old"]["status"]
        else:
            before_st = after_st
        per_kap_before[kap][before_st] += 1
        per_kap_after[kap][after_st] += 1

    lines.append("## Per-kapitola breakdown\n")
    lines.append("| kapitola | total | matched before | matched after | Δ |")
    lines.append("|---|---:|---:|---:|---:|")
    for kap in sorted(per_kap_before):
        total = sum(per_kap_before[kap].values())
        mb = per_kap_before[kap].get("matched_high", 0) + per_kap_before[kap].get("matched_medium", 0)
        ma = per_kap_after[kap].get("matched_high", 0) + per_kap_after[kap].get("matched_medium", 0)
        lines.append(f"| {kap} | {total} | {mb} | {ma} | {ma - mb:+d} |")

    path.write_text("\n".join(lines), encoding="utf-8")
    logger.info(f"Wrote {path.name}")


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="hk212 URS rematch via local urs_cache.db")
    ap.add_argument("--items", type=Path, default=DEFAULT_ITEMS)
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    ap.add_argument("--threshold-high", type=float, default=DEFAULT_THRESHOLD_HIGH,
                    help=f"Dice score → matched_high (default {DEFAULT_THRESHOLD_HIGH})")
    ap.add_argument("--threshold-medium", type=float, default=DEFAULT_THRESHOLD_MEDIUM,
                    help=f"Dice score → matched_medium (default {DEFAULT_THRESHOLD_MEDIUM})")
    ap.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logger = setup_logging(args.verbose)
    logger.info(f"Items:  {args.items}")
    logger.info(f"DB:     {args.db}")
    logger.info(f"Thresholds: high={args.threshold_high}, medium={args.threshold_medium}, "
                f"top-k={args.top_k}, dry-run={args.dry_run}")

    try:
        return run(args, logger)
    except Exception as e:
        logger.exception(f"FATAL: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
