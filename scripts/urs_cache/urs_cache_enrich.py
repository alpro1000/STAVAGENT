#!/usr/bin/env python3
"""
STAVAGENT URS Cache Enricher — Step 2
======================================

Pulls full podmínky HTML content from /v1/version/<vid>/category/<nid> endpoint
for EVERY node in the catalog tree across all 11 vintages.

This is the "long form" data — Czech HTML articles about each ÚRS category
(materiálové varianty, způsoby aplikace, podmínky použití).

PREREQUISITE:
    First run: python urs_cache_builder.py
    Must have: data/urs_cache.db + data/urs_cache/<vintage>.json files

USAGE:
    pip install requests beautifulsoup4 tqdm
    python urs_cache_enrich.py                     # default 5 parallel, ALL nodes
    python urs_cache_enrich.py --parents-only      # only nodes WITH children (~1.5h)
    python urs_cache_enrich.py --vintages 2026-I   # just newest
    python urs_cache_enrich.py --concurrency 3     # gentler
    python urs_cache_enrich.py --resume            # continue after interrupt
    python urs_cache_enrich.py --audit             # quality check
    python urs_cache_enrich.py --search "vapenocementovy stropy"

OUTPUT:
    data/urs_cache.db                                 — same DB, new tables:
      - node_texts          full HTML content per text article
      - node_texts_fts      FTS5 fulltext search
      - enrich_state        resume tracking

EXIT CODES:
    0 = success
    1 = error (network, layout change, etc.)
    2 = bad arguments / prerequisites missing
"""

import argparse
import concurrent.futures
import html
import json
import logging
import random
import re
import sqlite3
import sys
import threading
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ Missing dependency: {e.name}")
    print("Run: pip install requests beautifulsoup4 tqdm")
    sys.exit(2)


API_BASE = "https://frontoffice-vqysm7dnza-ez.a.run.app"
DEFAULT_DB_PATH = Path("data/urs_cache.db")
DEFAULT_CACHE_DIR = Path("data/urs_cache")
REQUEST_TIMEOUT = 30
DEFAULT_CONCURRENCY = 5
MIN_DELAY_PER_REQUEST = 0.15  # global rate limit per thread
USER_AGENT = "STAVAGENT/1.0 (research; contact: postmaster@stavagent.cz)"


# ============================================================
# Logging
# ============================================================

def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    logger = logging.getLogger("urs_enrich")
    logger.setLevel(level)
    logger.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
    logger.addHandler(h)
    return logger


# ============================================================
# Normalization
# ============================================================

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    nfkd = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).strip()


def html_to_text(html_str: str) -> str:
    """Strip HTML tags and decode entities → plain text."""
    if not html_str:
        return ""
    try:
        soup = BeautifulSoup(html_str, "html.parser")
        text = soup.get_text(" ", strip=True)
    except Exception:
        # Fallback: regex strip
        text = re.sub(r"<[^>]+>", " ", html_str)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def vintage_to_label(name: str) -> str:
    m = re.search(r"(\d{4})/(I{1,2})", name)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    return name


# ============================================================
# DB schema extension
# ============================================================

ENRICH_SCHEMA = """
CREATE TABLE IF NOT EXISTS node_texts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vintage_id TEXT NOT NULL,
    vintage TEXT NOT NULL,
    node_id TEXT NOT NULL,
    node_code TEXT,
    node_title TEXT,
    catalog_code TEXT,
    text_id TEXT,
    text_code TEXT,
    information_label TEXT,
    construction_label TEXT,
    content_html TEXT,
    content_text TEXT,
    content_normalized TEXT,
    breadcrumb_path TEXT,
    fetched_at TEXT NOT NULL,
    UNIQUE(vintage_id, node_id, text_id)
);

CREATE INDEX IF NOT EXISTS idx_nt_vintage ON node_texts(vintage);
CREATE INDEX IF NOT EXISTS idx_nt_node_code ON node_texts(node_code);
CREATE INDEX IF NOT EXISTS idx_nt_catalog ON node_texts(catalog_code);

CREATE VIRTUAL TABLE IF NOT EXISTS node_texts_fts USING fts5(
    content_text, content_normalized, node_title, node_code, catalog_code,
    information_label, construction_label,
    content='node_texts', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS nt_ai AFTER INSERT ON node_texts BEGIN
    INSERT INTO node_texts_fts(rowid, content_text, content_normalized, node_title,
                                node_code, catalog_code, information_label, construction_label)
    VALUES (new.id, new.content_text, new.content_normalized, new.node_title,
            new.node_code, new.catalog_code, new.information_label, new.construction_label);
END;

CREATE TABLE IF NOT EXISTS enrich_state (
    vintage_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    status TEXT NOT NULL,
    text_count INTEGER DEFAULT 0,
    error_msg TEXT,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (vintage_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_state_status ON enrich_state(status);
"""


def setup_db(db_path: Path, logger: logging.Logger) -> sqlite3.Connection:
    if not db_path.exists():
        logger.error(f"DB not found: {db_path}")
        logger.error("Run first: python urs_cache_builder.py")
        sys.exit(2)
    conn = sqlite3.connect(str(db_path), check_same_thread=False, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.executescript(ENRICH_SCHEMA)
    conn.commit()
    return conn


# ============================================================
# Collect all nodes from raw catalog JSON files
# ============================================================

def walk_collect(node: dict, vintage_id: str, vintage: str, catalog_code: str,
                 path: list, collected: list):
    if not isinstance(node, dict):
        return
    node_id = node.get("id", "")
    code = node.get("code", "")
    title = node.get("title", "")
    children = node.get("categories", [])

    current_path = path + [{"code": code, "title": title}]

    if node_id:
        collected.append({
            "vintage_id": vintage_id,
            "vintage": vintage,
            "node_id": node_id,
            "code": code,
            "title": title,
            "catalog_code": catalog_code,
            "has_children": bool(children),
            "breadcrumb_path": " > ".join(p["title"] for p in current_path if p["title"]),
        })

    for child in children:
        walk_collect(child, vintage_id, vintage, catalog_code, current_path, collected)


def collect_all_nodes(cache_dir: Path, vintages_filter: set,
                       logger: logging.Logger) -> list:
    """Collect all (vintage_id, node_id) pairs from raw catalog JSONs.
    Also fetches versionIds from API to map vintage labels → IDs.
    """
    # Fetch versionIds first
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
    r = session.get(f"{API_BASE}/v1/version",
                    params={"productId": "dPG7rN6DHQNGs5ErQ7IF"},
                    timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    versions = r.json().get("versions", [])
    vintage_to_id = {vintage_to_label(v["name"]): v["id"] for v in versions}

    all_nodes = []
    for label, vintage_id in vintage_to_id.items():
        if vintages_filter and label not in vintages_filter:
            continue
        json_path = cache_dir / f"{label}.json"
        if not json_path.exists():
            logger.warning(f"Missing raw JSON for {label}: {json_path}")
            continue
        with open(json_path, "r", encoding="utf-8") as f:
            catalog_data = json.load(f)
        nodes_before = len(all_nodes)
        for top_catalog in catalog_data.get("catalogs", []):
            catalog_code = top_catalog.get("code", "") or top_catalog.get("title", "")
            category = top_catalog.get("category")
            if not category:
                continue
            walk_collect(category, vintage_id, label, catalog_code, [], all_nodes)
        logger.info(f"  {label} ({vintage_id[:8]}...): {len(all_nodes) - nodes_before} nodes")

    return all_nodes


# ============================================================
# Fetch & parse single node detail
# ============================================================

class Fetcher:
    """Thread-safe HTTP fetcher with rate limiting."""
    def __init__(self, logger: logging.Logger):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        })
        self.lock = threading.Lock()
        self.last_request = 0.0
        self.logger = logger

    def _wait(self):
        with self.lock:
            elapsed = time.time() - self.last_request
            if elapsed < MIN_DELAY_PER_REQUEST:
                time.sleep(MIN_DELAY_PER_REQUEST - elapsed)
            self.last_request = time.time()

    def fetch_category(self, vintage_id: str, node_id: str) -> dict:
        self._wait()
        url = f"{API_BASE}/v1/version/{vintage_id}/category/{node_id}"
        for attempt in range(3):
            try:
                r = self.session.get(url, timeout=REQUEST_TIMEOUT)
                if r.status_code == 200:
                    return r.json()
                if r.status_code == 404:
                    return {"_status": 404}
                if r.status_code == 429:
                    backoff = 2 ** attempt * 5
                    self.logger.warning(f"429 rate limited, backoff {backoff}s")
                    time.sleep(backoff)
                    continue
                if 500 <= r.status_code < 600:
                    time.sleep(2 ** attempt)
                    continue
                return {"_status": r.status_code}
            except requests.RequestException as e:
                if attempt == 2:
                    return {"_status": -1, "_error": str(e)}
                time.sleep(2 ** attempt)
        return {"_status": -1, "_error": "max retries"}


# ============================================================
# DB writer
# ============================================================

class DBWriter:
    """Thread-safe DB writer."""
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.lock = threading.Lock()

    def save_node_result(self, node: dict, detail: dict):
        now = datetime.now(timezone.utc).isoformat()
        vintage_id = node["vintage_id"]
        node_id = node["node_id"]

        status_code = detail.get("_status")
        if status_code is not None:
            # Error / not-found
            with self.lock:
                self.conn.execute(
                    """INSERT OR REPLACE INTO enrich_state
                       (vintage_id, node_id, status, text_count, error_msg, fetched_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (vintage_id, node_id, f"http_{status_code}", 0,
                     detail.get("_error"), now)
                )
                self.conn.commit()
            return 0

        texts = detail.get("texts", []) or []
        breadcrumb_parts = detail.get("breadcrumb", {}).get("parts", []) or []
        breadcrumb_path = " > ".join(p.get("categoryName", "") for p in breadcrumb_parts)

        if not texts:
            with self.lock:
                self.conn.execute(
                    """INSERT OR REPLACE INTO enrich_state
                       (vintage_id, node_id, status, text_count, fetched_at)
                       VALUES (?, ?, 'empty', 0, ?)""",
                    (vintage_id, node_id, now)
                )
                self.conn.commit()
            return 0

        rows = []
        for t in texts:
            content_html = t.get("content", "") or ""
            content_text = html_to_text(content_html)
            content_normalized = normalize_text(content_text)
            rows.append((
                vintage_id, node["vintage"], node_id,
                node.get("code", ""), node.get("title", ""),
                node.get("catalog_code", ""),
                t.get("id", ""), t.get("code", ""),
                t.get("informationLabel", ""), t.get("constructionLabel", ""),
                content_html, content_text, content_normalized,
                breadcrumb_path, now
            ))

        with self.lock:
            self.conn.executemany(
                """INSERT OR IGNORE INTO node_texts
                   (vintage_id, vintage, node_id, node_code, node_title, catalog_code,
                    text_id, text_code, information_label, construction_label,
                    content_html, content_text, content_normalized,
                    breadcrumb_path, fetched_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                rows
            )
            self.conn.execute(
                """INSERT OR REPLACE INTO enrich_state
                   (vintage_id, node_id, status, text_count, fetched_at)
                   VALUES (?, ?, 'done', ?, ?)""",
                (vintage_id, node_id, len(rows), now)
            )
            self.conn.commit()
        return len(rows)

    def already_done(self, vintage_id: str, node_id: str) -> bool:
        with self.lock:
            cur = self.conn.execute(
                "SELECT status FROM enrich_state WHERE vintage_id=? AND node_id=?",
                (vintage_id, node_id)
            )
            row = cur.fetchone()
        return row is not None and row[0] in ("done", "empty")


# ============================================================
# Enrich runner
# ============================================================

def run_enrich(args, logger: logging.Logger):
    if not args.db_path.exists():
        logger.error(f"DB not found: {args.db_path}. Run urs_cache_builder.py first.")
        sys.exit(2)
    if not args.cache_dir.exists():
        logger.error(f"Cache dir not found: {args.cache_dir}")
        sys.exit(2)

    conn = setup_db(args.db_path, logger)

    vintages_filter = set()
    if args.vintages:
        vintages_filter = {v.strip() for v in args.vintages.split(",")}

    logger.info("Collecting all unique nodes from raw catalog JSONs...")
    all_nodes = collect_all_nodes(args.cache_dir, vintages_filter, logger)
    logger.info(f"Total nodes collected: {len(all_nodes)}")

    if args.parents_only:
        before = len(all_nodes)
        all_nodes = [n for n in all_nodes if n["has_children"]]
        logger.info(f"Filtered to parents-only: {len(all_nodes)} (was {before})")

    # Filter out already done
    writer = DBWriter(conn)
    pending = []
    for n in all_nodes:
        if not writer.already_done(n["vintage_id"], n["node_id"]):
            pending.append(n)
    logger.info(f"Pending: {len(pending)} (skipped {len(all_nodes) - len(pending)} already done)")

    if not pending:
        logger.info("Nothing to do — all nodes already enriched.")
        run_audit(conn, logger)
        return

    # Estimate time
    estimated_sec = len(pending) * MIN_DELAY_PER_REQUEST / args.concurrency
    logger.info(f"Estimated time: ~{estimated_sec/60:.0f} min "
                f"({args.concurrency} parallel, {MIN_DELAY_PER_REQUEST}s rate)")

    fetcher = Fetcher(logger)

    total_texts = 0
    total_empty = 0
    total_errors = 0
    start = time.time()

    def process(node):
        nonlocal total_texts, total_empty, total_errors
        detail = fetcher.fetch_category(node["vintage_id"], node["node_id"])
        text_count = writer.save_node_result(node, detail)
        return text_count, detail.get("_status")

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as exe:
            futures = {exe.submit(process, n): n for n in pending}
            with tqdm(total=len(pending), desc="Enriching") as pbar:
                for fut in concurrent.futures.as_completed(futures):
                    try:
                        text_count, status = fut.result()
                        if status is not None and status not in (200,):
                            total_errors += 1
                        elif text_count == 0:
                            total_empty += 1
                        else:
                            total_texts += text_count
                        pbar.set_postfix({
                            "texts": total_texts,
                            "empty": total_empty,
                            "err": total_errors,
                        })
                    except Exception as e:
                        logger.error(f"Worker error: {e}")
                        total_errors += 1
                    pbar.update(1)
    except KeyboardInterrupt:
        logger.warning("\nInterrupted — state saved. Resume with --resume.")
        return

    elapsed = time.time() - start
    logger.info(f"\n✓ ENRICH DONE in {elapsed/60:.1f} min")
    logger.info(f"  Texts inserted: {total_texts}")
    logger.info(f"  Empty nodes: {total_empty}")
    logger.info(f"  Errors: {total_errors}")

    run_audit(conn, logger)


# ============================================================
# Audit
# ============================================================

def run_audit(conn: sqlite3.Connection, logger: logging.Logger):
    logger.info("\n=== AUDIT ===")
    total_texts = conn.execute("SELECT COUNT(*) FROM node_texts").fetchone()[0]
    logger.info(f"Total text articles: {total_texts}")

    if total_texts == 0:
        logger.warning("No texts yet. Run enrichment first.")
        return

    logger.info("\nPer vintage:")
    for row in conn.execute("""
        SELECT vintage, COUNT(*) FROM node_texts GROUP BY vintage ORDER BY vintage DESC
    """):
        logger.info(f"  {row[0]}: {row[1]} texts")

    logger.info("\nPer status (enrich_state):")
    for row in conn.execute("""
        SELECT status, COUNT(*) FROM enrich_state GROUP BY status ORDER BY 2 DESC
    """):
        logger.info(f"  {row[0]}: {row[1]} nodes")

    logger.info("\nContent size distribution:")
    for row in conn.execute("""
        SELECT
            CASE
                WHEN LENGTH(content_text) < 100 THEN '<100'
                WHEN LENGTH(content_text) < 500 THEN '100-500'
                WHEN LENGTH(content_text) < 2000 THEN '500-2000'
                ELSE '>2000'
            END AS bucket,
            COUNT(*) FROM node_texts GROUP BY bucket
    """):
        logger.info(f"  {row[0]} chars: {row[1]}")

    logger.info("\nSample (random):")
    for row in conn.execute("""
        SELECT vintage, node_code, node_title, text_code, information_label,
               SUBSTR(content_text, 1, 120) AS preview
        FROM node_texts ORDER BY RANDOM() LIMIT 5
    """):
        logger.info(f"  [{row[0]}] {row[1]} {row[2][:40]} | {row[3]} {row[4]}")
        logger.info(f"     → {row[5]}...")


def run_search(conn: sqlite3.Connection, query: str, logger: logging.Logger):
    normalized = normalize_text(query)
    logger.info(f"Search: {query!r} (normalized: {normalized!r})")
    cur = conn.execute("""
        SELECT node_texts.vintage, node_texts.node_code, node_texts.node_title,
               node_texts.text_code, node_texts.information_label,
               SUBSTR(node_texts.content_text, 1, 200) AS preview,
               node_texts_fts.rank
        FROM node_texts_fts
        JOIN node_texts ON node_texts.id = node_texts_fts.rowid
        WHERE node_texts_fts MATCH ?
        ORDER BY rank LIMIT 20
    """, (normalized,))
    found = False
    for row in cur:
        found = True
        logger.info(f"  [{row[0]}] {row[1]} | {row[2]} → {row[3]} {row[4]}")
        logger.info(f"     {row[5]}...")
    if not found:
        logger.info("  No matches. Try wildcards: 'vapenocementov*' or split into single words.")


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="STAVAGENT URS Cache Enricher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY,
                        help=f"Parallel HTTP connections (default: {DEFAULT_CONCURRENCY})")
    parser.add_argument("--vintages", default=None,
                        help="Comma-separated subset, e.g. '2026-I,2025-II'")
    parser.add_argument("--parents-only", action="store_true",
                        help="Only nodes with children (faster, may miss leaf texts)")
    parser.add_argument("--resume", action="store_true",
                        help="(default behavior — always resumes from checkpoint)")
    parser.add_argument("--audit", action="store_true", help="Quality check only")
    parser.add_argument("--search", type=str, default=None, help="Test FTS5 search")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logger = setup_logging(args.verbose)
    logger.info(f"STAVAGENT URS Cache Enricher starting at {datetime.now().isoformat()}")

    if not args.db_path.exists():
        logger.error(f"DB not found: {args.db_path}. Run urs_cache_builder.py first.")
        sys.exit(2)
    conn = setup_db(args.db_path, logger)

    if args.audit:
        run_audit(conn, logger)
        return

    if args.search:
        run_search(conn, args.search, logger)
        return

    run_enrich(args, logger)


if __name__ == "__main__":
    main()
