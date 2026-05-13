#!/usr/bin/env python3
"""
Diagnostic: why does rematch return 0 results?
==============================================

Runs raw FTS5 queries against urs_cache.db with sample HK212 needs_review
raw_descriptions to verify Layer 1 (urs_fts) + Layer 2 (node_texts_fts) actually
return hits. Auto-detects the most common failure mode: empty FTS5 virtual
table (trigger only fires on INSERT, so older content rows never got indexed).

Run:
    python test-data/hk212_hala/scripts/phase_1_etap1/diagnose_urs_fts.py

Expected outcome: ~5-50 results per sample query. If 0 across all samples
and `urs_fts` row count = 0 while `items` row count = 77,551 → FTS5 index
is out of sync. Rebuild SQL is printed at the end.
"""

import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

DB_PATH = Path("data/urs_cache.db")

# Sample raw_descriptions from HK212 needs_review
SAMPLES = [
    "Skládkovné — uložení vytěžené zeminy na řízené skládce",
    "Výztuž desky KARI síť Ø8 oka 100×100 mm B500B",
    "Antikorozní nátěr 2-vrstvý dle ISO 12944",
    "Specifikace + dodávka příčlí IPE 450 S235",
    "Odvoz výkopu na deponii / skládku — kontejnerová doprava",
]


def normalize(text: str) -> str:
    text = text.lower()
    nfkd = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).strip()


def main() -> int:
    if not DB_PATH.exists():
        print(f"❌ DB not found: {DB_PATH}")
        return 2

    conn = sqlite3.connect(str(DB_PATH))

    # FTS5 tables
    print("=== FTS5 virtual tables ===")
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%fts%' ORDER BY name"
    )
    fts_tables = [r[0] for r in cur]
    for t in fts_tables:
        print(f"  {t}")
    print()

    # Row counts (the critical sanity check)
    print("=== Row counts ===")
    counts: dict[str, int] = {}
    for table in ["items", "urs_fts", "node_texts", "node_texts_fts"]:
        try:
            counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"  {table}: {counts[table]:,}")
        except sqlite3.Error as e:
            counts[table] = -1
            print(f"  {table}: ERROR {e}")
    print()

    # FTS5 sync check — most common failure mode
    fts1_broken = counts.get("urs_fts", 0) == 0 and counts.get("items", 0) > 0
    fts2_broken = counts.get("node_texts_fts", 0) == 0 and counts.get("node_texts", 0) > 0
    if fts1_broken or fts2_broken:
        print("⛔ FTS5 INDEX OUT OF SYNC — this is why rematch returns 0 results")
        print()
        print("  Trigger items_ai (and nt_ai) only fire on INSERT. If the items / node_texts")
        print("  tables were populated under an older schema and the FTS5 virtual tables were")
        print("  added later, the index stays empty. Fix with rebuild SQL.")
        print()
        print("  Run this once:")
        print()
        print("  python -c \"import sqlite3; c=sqlite3.connect('data/urs_cache.db'); \\")
        if fts1_broken:
            print("    c.execute(\\\"INSERT INTO urs_fts(urs_fts) VALUES('rebuild')\\\"); \\")
        if fts2_broken:
            print("    c.execute(\\\"INSERT INTO node_texts_fts(node_texts_fts) VALUES('rebuild')\\\"); \\")
        print("    c.commit(); print('FTS5 rebuilt')\"")
        print()
        # Skip sample queries — they'll all return 0 anyway
        conn.close()
        return 1

    # Sample queries
    for sample in SAMPLES:
        print(f"\n{'=' * 70}")
        print(f"INPUT: {sample}")
        normalized = normalize(sample)
        print(f"NORMALIZED: {normalized}")

        tokens = [t for t in re.split(r"[\s\-—/,()×.]+", normalized)
                  if len(t) >= 4 and not t.isdigit()]
        print(f"TOKENS (raw): {tokens}")

        if not tokens:
            print("  (no usable tokens — skipping)")
            continue

        # Strategy 1: OR with prefix wildcards
        query_or = " OR ".join(f"{t}*" for t in tokens[:5])
        print(f"\nQUERY 1 (OR wildcards): {query_or}")
        try:
            cur = conn.execute(
                """
                SELECT items.urs_code, items.title, items.vintage
                FROM urs_fts JOIN items ON items.id = urs_fts.rowid
                WHERE urs_fts MATCH ?
                ORDER BY rank LIMIT 5
                """,
                (query_or,),
            )
            results = cur.fetchall()
            print(f"  Results: {len(results)}")
            for r in results[:5]:
                print(f"    [{r[2]}] {r[0]} | {r[1][:80]}")
        except sqlite3.Error as e:
            print(f"  ERROR: {e}")

        # Strategy 2: single most distinctive token
        longest = max(tokens, key=len)
        query_single = f"{longest}*"
        print(f"\nQUERY 2 (single token '{longest}*'):")
        try:
            cur = conn.execute(
                """
                SELECT items.urs_code, items.title, items.vintage
                FROM urs_fts JOIN items ON items.id = urs_fts.rowid
                WHERE urs_fts MATCH ?
                ORDER BY rank LIMIT 5
                """,
                (query_single,),
            )
            results = cur.fetchall()
            print(f"  Results: {len(results)}")
            for r in results[:5]:
                print(f"    [{r[2]}] {r[0]} | {r[1][:80]}")
        except sqlite3.Error as e:
            print(f"  ERROR: {e}")

        # Strategy 3: Layer 2 (node_texts)
        print(f"\nQUERY 3 (Layer 2 node_texts, '{longest}*'):")
        try:
            cur = conn.execute(
                """
                SELECT node_texts.node_code, node_texts.node_title, node_texts.vintage
                FROM node_texts_fts JOIN node_texts ON node_texts.id = node_texts_fts.rowid
                WHERE node_texts_fts MATCH ?
                ORDER BY rank LIMIT 3
                """,
                (query_single,),
            )
            results = cur.fetchall()
            print(f"  Results: {len(results)}")
            for r in results[:3]:
                print(f"    [{r[2]}] {r[0]} | {r[1][:80]}")
        except sqlite3.Error as e:
            print(f"  ERROR: {e}")

    conn.close()
    print(f"\n{'=' * 70}\nDIAGNOSTIC DONE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
