#!/usr/bin/env python3
"""
STAVAGENT URS Cache Builder — Final Version
============================================

Discovered API (no auth needed, just productId in URL):
  GET /v1/version?productId=<pid>          → list of vintages with versionIds
  GET /v1/version/<versionId>/catalog      → entire catalog tree for that vintage

Recursive tree shape:
  catalogs[] → category → categories[] → categories[] → ...
  Leaf items: {id, title, code, categories:[], filter}

INSTALL:
    pip install requests tqdm

USAGE:
    python urs_cache_builder.py                              # все 11 vintages, ~5 min
    python urs_cache_builder.py --vintages 2026-I,2025-II    # subset
    python urs_cache_builder.py --product-id <pid>           # if different productId
    python urs_cache_builder.py --audit                      # quality check

OUTPUT:
    data/urs_cache.db                  — SQLite + FTS5
    data/urs_cache/<vintage>.json      — raw JSON per vintage
    data/urs_cache/items_flat.json     — flat list of all items
"""

import argparse
import json
import logging
import re
import sqlite3
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ Missing dependency: {e.name}")
    print("Run: pip install requests tqdm")
    sys.exit(2)


API_BASE = "https://frontoffice-vqysm7dnza-ez.a.run.app"
DEFAULT_PRODUCT_ID = "dPG7rN6DHQNGs5ErQ7IF"  # Александрův subscription token
DEFAULT_OUTPUT_DIR = Path("data/urs_cache")
DEFAULT_DB_PATH = Path("data/urs_cache.db")
REQUEST_TIMEOUT = 60
DELAY_BETWEEN_REQUESTS = 0.5  # be polite

USER_AGENT = "STAVAGENT/1.0 (research; contact: postmaster@stavagent.cz)"


# ============================================================
# Logging
# ============================================================

def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    logger = logging.getLogger("urs_cache")
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
    """Lowercase + remove diacritics + collapse whitespace for FTS5."""
    if not text:
        return ""
    text = text.lower()
    nfkd = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).strip()


def vintage_to_label(name: str) -> str:
    """'CS ÚRS 2026/I' → '2026-I'"""
    m = re.search(r"(\d{4})/(I{1,2})", name)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    return name


# ============================================================
# HTTP
# ============================================================

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "cs,en;q=0.9",
    })
    return s


def fetch_versions(session: requests.Session, product_id: str, logger: logging.Logger) -> list:
    url = f"{API_BASE}/v1/version"
    logger.info(f"Fetching versions for productId={product_id}")
    r = session.get(url, params={"productId": product_id}, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    data = r.json()
    versions = data.get("versions", [])
    logger.info(f"Found {len(versions)} vintages")
    return versions


def fetch_catalog(session: requests.Session, version_id: str,
                   logger: logging.Logger) -> dict:
    url = f"{API_BASE}/v1/version/{version_id}/catalog"
    logger.debug(f"Fetching {url}")
    r = session.get(url, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    return r.json()


# ============================================================
# Tree walker
# ============================================================

def walk_tree(node: dict, vintage: str, catalog_code: str, catalog_name: str,
              path: list, items: list):
    """Recursively walk category tree. Leaf = empty categories[].
    Collects items with full ancestry path for kapitola/dil/soubor classification.
    """
    if not isinstance(node, dict):
        return

    title = node.get("title", "")
    code = node.get("code", "")
    node_id = node.get("id", "")
    children = node.get("categories", [])

    current_path = path + [{"title": title, "code": code}]

    if not children:
        # Leaf item
        if code or title:
            kapitola = current_path[1]["title"] if len(current_path) >= 2 else None
            dil = current_path[2]["title"] if len(current_path) >= 3 else None
            soubor = current_path[3]["title"] if len(current_path) >= 4 else None

            items.append({
                "node_id": node_id,
                "urs_code": code,
                "title": title,
                "title_normalized": normalize_text(title),
                "catalog_code": catalog_code,
                "catalog_name": catalog_name,
                "vintage": vintage,
                "kapitola": kapitola,
                "dil": dil,
                "soubor": soubor,
                "path_codes": " > ".join(p["code"] for p in current_path if p["code"]),
                "path_titles": " > ".join(p["title"] for p in current_path if p["title"]),
            })
        return

    # Recurse into children
    for child in children:
        walk_tree(child, vintage, catalog_code, catalog_name, current_path, items)


def extract_items_from_catalog_response(catalog_data: dict, vintage: str,
                                          logger: logging.Logger) -> list:
    """Extract all leaf items from a /v1/version/<id>/catalog response."""
    items = []
    catalogs = catalog_data.get("catalogs", [])
    for top_catalog in catalogs:
        catalog_code = top_catalog.get("code", "") or top_catalog.get("title", "")
        catalog_name = top_catalog.get("title", "")
        category = top_catalog.get("category")
        if not category:
            continue
        walk_tree(category, vintage, catalog_code, catalog_name, [], items)
    return items


# ============================================================
# SQLite cache
# ============================================================

class UrsCacheDB:
    SCHEMA = """
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT,
        urs_code TEXT NOT NULL,
        title TEXT NOT NULL,
        title_normalized TEXT NOT NULL,
        catalog_code TEXT,
        catalog_name TEXT,
        vintage TEXT NOT NULL,
        kapitola TEXT,
        dil TEXT,
        soubor TEXT,
        path_codes TEXT,
        path_titles TEXT,
        scraped_at TEXT NOT NULL,
        UNIQUE(urs_code, vintage, catalog_code, title)
    );

    CREATE INDEX IF NOT EXISTS idx_vintage_catalog ON items(vintage, catalog_code);
    CREATE INDEX IF NOT EXISTS idx_urs_code ON items(urs_code);
    CREATE INDEX IF NOT EXISTS idx_vintage ON items(vintage);

    CREATE VIRTUAL TABLE IF NOT EXISTS urs_fts USING fts5(
        urs_code, title, title_normalized, path_titles,
        content='items', content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO urs_fts(rowid, urs_code, title, title_normalized, path_titles)
        VALUES (new.id, new.urs_code, new.title, new.title_normalized, new.path_titles);
    END;
    """

    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path))
        self.conn.executescript(self.SCHEMA)
        self.conn.commit()

    def insert_items(self, items: list) -> int:
        now = datetime.now(timezone.utc).isoformat()
        inserted = 0
        for it in items:
            try:
                cur = self.conn.execute(
                    """INSERT OR IGNORE INTO items
                       (node_id, urs_code, title, title_normalized, catalog_code,
                        catalog_name, vintage, kapitola, dil, soubor,
                        path_codes, path_titles, scraped_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (it["node_id"], it["urs_code"], it["title"],
                     it["title_normalized"], it["catalog_code"], it["catalog_name"],
                     it["vintage"], it["kapitola"], it["dil"], it["soubor"],
                     it["path_codes"], it["path_titles"], now)
                )
                if cur.rowcount > 0:
                    inserted += 1
            except sqlite3.Error as e:
                logging.getLogger("urs_cache").error(f"Insert failed: {e}")
        self.conn.commit()
        return inserted

    def count(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]

    def stats(self) -> dict:
        cur = self.conn.execute("""
            SELECT vintage, COUNT(*) FROM items GROUP BY vintage ORDER BY vintage DESC
        """)
        return {row[0]: row[1] for row in cur.fetchall()}

    def sample(self, n: int = 20) -> list:
        cur = self.conn.execute(f"SELECT * FROM items ORDER BY RANDOM() LIMIT {n}")
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    def search(self, query: str, limit: int = 10) -> list:
        normalized = normalize_text(query)
        cur = self.conn.execute("""
            SELECT items.urs_code, items.title, items.vintage, items.catalog_code,
                   items.path_titles, urs_fts.rank
            FROM urs_fts
            JOIN items ON items.id = urs_fts.rowid
            WHERE urs_fts MATCH ?
            ORDER BY rank LIMIT ?
        """, (normalized, limit))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    def close(self):
        self.conn.close()


# ============================================================
# Audit
# ============================================================

def run_audit(db: UrsCacheDB, sample_size: int, logger: logging.Logger):
    total = db.count()
    logger.info(f"Total items: {total}")
    if total == 0:
        logger.warning("DB empty — run without --audit first")
        return

    stats = db.stats()
    logger.info("Items per vintage:")
    for v, c in stats.items():
        logger.info(f"  {v}: {c}")

    samples = db.sample(sample_size)
    have_code = sum(1 for s in samples if s["urs_code"])
    have_title = sum(1 for s in samples if s["title"])
    have_catalog = sum(1 for s in samples if s["catalog_code"])
    logger.info(f"\nSchema completeness on {sample_size} random items:")
    logger.info(f"  urs_code: {have_code}/{sample_size} ({have_code/sample_size*100:.0f}%)")
    logger.info(f"  title:    {have_title}/{sample_size} ({have_title/sample_size*100:.0f}%)")
    logger.info(f"  catalog:  {have_catalog}/{sample_size} ({have_catalog/sample_size*100:.0f}%)")

    logger.info("\nSample items:")
    for s in samples[:10]:
        logger.info(f"  [{s['vintage']}] {s['catalog_code']}/{s['urs_code']} | {s['title'][:70]}")

    # Test FTS5 search
    logger.info("\nFTS5 sanity test — searching 'beton C30/37':")
    results = db.search("beton C30 37", limit=5)
    for r in results:
        logger.info(f"  [{r['vintage']}] {r['urs_code']} | {r['title'][:70]}")


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="STAVAGENT URS Cache Builder (final version, JSON API)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--product-id", default=DEFAULT_PRODUCT_ID,
                        help=f"Subscription productId (default: {DEFAULT_PRODUCT_ID[:8]}...)")
    parser.add_argument("--vintages", default=None,
                        help="Comma-separated vintages e.g. '2026-I,2025-II' (default: all)")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--audit", action="store_true", help="Quality check existing cache")
    parser.add_argument("--search", type=str, default=None,
                        help="Test FTS5 search query and exit")
    parser.add_argument("--sample-size", type=int, default=20)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logger = setup_logging(args.verbose)
    logger.info(f"STAVAGENT URS Cache Builder starting at {datetime.now().isoformat()}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    db = UrsCacheDB(args.db_path)

    # Audit-only mode
    if args.audit:
        run_audit(db, args.sample_size, logger)
        db.close()
        return

    # Search-only mode
    if args.search:
        logger.info(f"Search query: {args.search!r}")
        results = db.search(args.search, limit=20)
        if not results:
            logger.info("No matches")
        else:
            for r in results:
                logger.info(f"  [{r['vintage']}] {r['catalog_code']}/{r['urs_code']} | {r['title']}")
        db.close()
        return

    # Build mode
    session = make_session()

    try:
        versions = fetch_versions(session, args.product_id, logger)
    except requests.HTTPError as e:
        logger.error(f"Failed to fetch versions: {e}")
        sys.exit(1)

    if not versions:
        logger.error("No vintages returned — check productId")
        sys.exit(1)

    requested_vintages = None
    if args.vintages:
        requested_vintages = [v.strip() for v in args.vintages.split(",")]

    # Filter & sort newest first
    versions_to_fetch = []
    for v in versions:
        label = vintage_to_label(v.get("name", ""))
        if requested_vintages is None or label in requested_vintages:
            versions_to_fetch.append((label, v))

    versions_to_fetch.sort(key=lambda x: x[0], reverse=True)
    logger.info(f"Will fetch {len(versions_to_fetch)} vintages: {[lbl for lbl,_ in versions_to_fetch]}")

    all_items_flat = []
    grand_total_inserted = 0

    for label, ver in tqdm(versions_to_fetch, desc="Vintages"):
        version_id = ver["id"]
        logger.info(f"\n→ {label} (id={version_id})")
        try:
            catalog_data = fetch_catalog(session, version_id, logger)
        except requests.HTTPError as e:
            logger.error(f"  Failed: {e}")
            continue

        # Save raw JSON
        raw_path = args.output_dir / f"{label}.json"
        with open(raw_path, "w", encoding="utf-8") as f:
            json.dump(catalog_data, f, indent=2, ensure_ascii=False)
        size_mb = raw_path.stat().st_size / 1024 / 1024
        logger.info(f"  Saved raw → {raw_path} ({size_mb:.2f} MB)")

        # Extract items
        items = extract_items_from_catalog_response(catalog_data, label, logger)
        logger.info(f"  Extracted {len(items)} leaf items")

        # Insert into DB
        inserted = db.insert_items(items)
        logger.info(f"  Inserted {inserted} new (skipped {len(items) - inserted} duplicates)")
        grand_total_inserted += inserted
        all_items_flat.extend(items)

        time.sleep(DELAY_BETWEEN_REQUESTS)

    # Save flat items list
    flat_path = args.output_dir / "items_flat.json"
    with open(flat_path, "w", encoding="utf-8") as f:
        json.dump(all_items_flat, f, indent=2, ensure_ascii=False)
    logger.info(f"\nSaved flat items list → {flat_path}")

    logger.info(f"\n✓ BUILD DONE")
    logger.info(f"Total items in DB: {db.count()}")
    logger.info(f"New items inserted this run: {grand_total_inserted}")

    stats = db.stats()
    logger.info("Items per vintage:")
    for v, c in stats.items():
        logger.info(f"  {v}: {c}")

    logger.info(f"\nQuick test: python {sys.argv[0]} --search 'beton C30/37 XC4'")
    logger.info(f"Or audit:   python {sys.argv[0]} --audit")

    db.close()


if __name__ == "__main__":
    main()
