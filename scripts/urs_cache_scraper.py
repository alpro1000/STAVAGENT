#!/usr/bin/env python3
"""
STAVAGENT URS Cache Scraper — Standalone Local Script
=====================================================

TARGET: https://podminky.urs.cz/home?productId=dPG7rN6DHQNGs5ErQ7IF

Scrapes public technical conditions (podmínky) from the modern ÚRS portal.
Legal: Czech ZZVZ requires public access to ÚRS technical conditions.
NEVER scrapes prices (paid data behind KROS license).

⚠️  IMPORTANT — RUN --explore FIRST!
The `productId=dPG7rN6DHQNGs5ErQ7IF` query parameter has the shape of a Firestore
document ID, which strongly suggests this is a React/Vue SPA with client-side
rendering. If --explore reports "SPA likely — body empty / __INITIAL_STATE__
absent", static fetch will not work and you have two options:

  1. Reverse-engineer the API:
     - Open the page in Chrome DevTools → Network → Fetch/XHR
     - Reload the page and identify the JSON endpoint(s)
     - Paste 1-2 example response URLs back to Claude, who will swap the
       fetch_page() call for direct API calls (faster + cleaner than HTML)
  2. Headless browser:
     - pip install playwright && playwright install chromium
     - Set USE_PLAYWRIGHT=1 env var (stub in fetch_rendered() below — fill in)

ZAPNUTÍ:
    pip install requests beautifulsoup4 tqdm lxml
    python urs_cache_scraper.py --explore                  # objev layout (PRVNÍ KROK)
    python urs_cache_scraper.py --dry-run                  # ukáž URL, nestahuj
    python urs_cache_scraper.py --catalogues 800-1         # smoke test 1 katalog
    python urs_cache_scraper.py                            # full run
    python urs_cache_scraper.py --resume                   # pokračovat po přerušení
    python urs_cache_scraper.py --audit                    # kontrola existujícího cache

VÝSTUP:
    data/urs_cache.db                       — SQLite s FTS5 indexem
    data/urs_cache/<vintage>/<catalog>.json — JSON dump per katalog
    data/urs_cache/resume_state.json        — checkpoint pro resume
    data/urs_cache/explore_<timestamp>.html — raw HTML samples z --explore

EXIT CODES:
    0 = success
    1 = stop gate (CAPTCHA, 403, layout change, SPA blocker, etc.)
    2 = bad arguments
    3 = network unreachable
"""

import argparse
import json
import logging
import random
import re
import sqlite3
import sys
import time
import unicodedata
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse, urlencode
from urllib.robotparser import RobotFileParser

try:
    import requests
    from bs4 import BeautifulSoup
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ Chybí závislost: {e.name}")
    print("Spusť: pip install requests beautifulsoup4 tqdm lxml")
    sys.exit(2)


# ============================================================
# Konfigurace
# ============================================================

ROOT_URL = "https://podminky.urs.cz"
PRODUCT_ID = "dPG7rN6DHQNGs5ErQ7IF"
TARGET_URL = f"{ROOT_URL}/home?productId={PRODUCT_ID}"

USER_AGENT = (
    "STAVAGENT/1.0 (research scraper for public ZZVZ technical conditions; "
    "contact: postmaster@stavagent.cz)"
)

DEFAULT_OUTPUT_DIR = Path("data/urs_cache")
DEFAULT_DB_PATH = Path("data/urs_cache.db")

# Rate limiting (hardcoded — ethics > convenience)
DELAY_MIN_SEC = 1.0
DELAY_MAX_SEC = 3.0
BACKOFF_INITIAL = 2
BACKOFF_MAX = 60

REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
MAX_4XX_RATIO = 0.10  # stop gate: >10% 4xx errors

# URS item kód v textu — možné formáty na modern URS portálu
# např. "800-1 11-1101", "121.10.1101", "8001111101"
URS_CODE_PATTERNS = [
    re.compile(r"\b(\d{3}-\d{1,2}\s+\d{2}-\d{4})\b"),
    re.compile(r"\b(\d{3}\s+\d{2}\s+\d{4})\b"),
    re.compile(r"\b(\d{9,11})\b"),
]


# ============================================================
# Logging
# ============================================================

def setup_logging(output_dir: Path, verbose: bool = False) -> logging.Logger:
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = output_dir / f"scraper_{datetime.now():%Y%m%d_%H%M%S}.log"
    level = logging.DEBUG if verbose else logging.INFO

    logger = logging.getLogger("urs_scraper")
    logger.setLevel(level)
    logger.handlers.clear()

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S")

    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    return logger


# ============================================================
# Datový model
# ============================================================

@dataclass
class UrsItem:
    urs_code: str
    catalog_code: str
    catalog_name: str
    vintage: str               # např. "2026-I" (auto-detected from page metadata)
    popis: str
    popis_normalized: str
    mj: Optional[str] = None
    kapitola: Optional[str] = None
    dil: Optional[str] = None
    soubor: Optional[str] = None
    product_id: str = PRODUCT_ID
    source_url: str = ""
    scraped_at: str = ""


def normalize_popis(text: str) -> str:
    """lowercase + odstranění diakritiky + collapse whitespace pro FTS5."""
    text = text.lower()
    nfkd = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in nfkd if not unicodedata.combining(c))
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ============================================================
# Resume state
# ============================================================

@dataclass
class ResumeState:
    started_at: str = ""
    last_updated: str = ""
    product_id: str = PRODUCT_ID
    completed_catalogs: list = field(default_factory=list)
    failed_catalogs: list = field(default_factory=list)
    in_progress: Optional[dict] = None
    total_items: int = 0

    @classmethod
    def load(cls, path: Path) -> "ResumeState":
        if not path.exists():
            return cls(started_at=datetime.now(timezone.utc).isoformat())
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            # tolerate old state files without product_id
            data.setdefault("product_id", PRODUCT_ID)
            return cls(**data)
        except Exception:
            return cls(started_at=datetime.now(timezone.utc).isoformat())

    def save(self, path: Path):
        self.last_updated = datetime.now(timezone.utc).isoformat()
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(self), f, indent=2, ensure_ascii=False)

    def is_done(self, vintage: str, catalog_code: str) -> bool:
        return any(
            c["vintage"] == vintage and c["catalog_code"] == catalog_code
            for c in self.completed_catalogs
        )

    def mark_done(self, vintage: str, catalog_code: str, item_count: int):
        self.completed_catalogs.append({
            "vintage": vintage,
            "catalog_code": catalog_code,
            "item_count": item_count,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        self.total_items += item_count


# ============================================================
# SQLite cache
# ============================================================

class UrsCacheDB:
    SCHEMA = """
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        urs_code TEXT NOT NULL,
        catalog_code TEXT NOT NULL,
        catalog_name TEXT,
        vintage TEXT NOT NULL,
        popis TEXT NOT NULL,
        popis_normalized TEXT NOT NULL,
        mj TEXT,
        kapitola TEXT,
        dil TEXT,
        soubor TEXT,
        product_id TEXT,
        source_url TEXT,
        scraped_at TEXT NOT NULL,
        UNIQUE(urs_code, vintage)
    );

    CREATE INDEX IF NOT EXISTS idx_vintage_catalog ON items(vintage, catalog_code);
    CREATE INDEX IF NOT EXISTS idx_urs_code ON items(urs_code);

    CREATE VIRTUAL TABLE IF NOT EXISTS urs_fts USING fts5(
        urs_code, popis, popis_normalized, content='items', content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO urs_fts(rowid, urs_code, popis, popis_normalized)
        VALUES (new.id, new.urs_code, new.popis, new.popis_normalized);
    END;
    """

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path))
        self.conn.executescript(self.SCHEMA)
        self.conn.commit()

    def insert_items(self, items: list[UrsItem]) -> int:
        inserted = 0
        for item in items:
            try:
                cur = self.conn.execute(
                    """INSERT OR IGNORE INTO items
                    (urs_code, catalog_code, catalog_name, vintage, popis,
                     popis_normalized, mj, kapitola, dil, soubor, product_id,
                     source_url, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (item.urs_code, item.catalog_code, item.catalog_name,
                     item.vintage, item.popis, item.popis_normalized,
                     item.mj, item.kapitola, item.dil, item.soubor,
                     item.product_id, item.source_url, item.scraped_at)
                )
                if cur.rowcount:
                    inserted += 1
            except sqlite3.Error as e:
                logging.getLogger("urs_scraper").error(f"DB insert failed: {e}")
        self.conn.commit()
        return inserted

    def count(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]

    def sample(self, n: int = 50) -> list[dict]:
        cur = self.conn.execute(
            "SELECT * FROM items ORDER BY RANDOM() LIMIT ?", (n,)
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    def close(self):
        self.conn.close()


# ============================================================
# HTTP client s rate limiting
# ============================================================

class PoliteFetcher:
    def __init__(self, logger: logging.Logger):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept-Language": "cs,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        })
        self.logger = logger
        self.total_requests = 0
        self.errors_4xx = 0
        self.errors_5xx = 0
        self.last_request_time = 0.0

    def _wait(self):
        elapsed = time.time() - self.last_request_time
        delay = random.uniform(DELAY_MIN_SEC, DELAY_MAX_SEC)
        if elapsed < delay:
            time.sleep(delay - elapsed)

    def fetch(self, url: str) -> Optional[str]:
        self._wait()
        backoff = BACKOFF_INITIAL

        for attempt in range(MAX_RETRIES):
            try:
                self.logger.debug(f"GET {url} (attempt {attempt + 1})")
                resp = self.session.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
                self.last_request_time = time.time()
                self.total_requests += 1

                if resp.status_code == 200:
                    return resp.text

                if resp.status_code == 429:
                    self.logger.warning(f"429 rate limited, backoff {backoff}s")
                    time.sleep(backoff)
                    backoff = min(backoff * 2, BACKOFF_MAX)
                    continue

                if resp.status_code == 403:
                    self.errors_4xx += 1
                    self.logger.error(f"403 FORBIDDEN — STOP GATE")
                    self.logger.error(f"Response body (first 500): {resp.text[:500]}")
                    raise StopGate(f"403 Forbidden na {url}")

                if 400 <= resp.status_code < 500:
                    self.errors_4xx += 1
                    self.logger.warning(f"{resp.status_code} for {url}")
                    return None

                if 500 <= resp.status_code < 600:
                    self.errors_5xx += 1
                    self.logger.warning(f"{resp.status_code}, retry after {backoff}s")
                    time.sleep(backoff)
                    backoff = min(backoff * 2, BACKOFF_MAX)
                    continue

            except requests.RequestException as e:
                self.logger.warning(f"Network error: {e}, retry after {backoff}s")
                time.sleep(backoff)
                backoff = min(backoff * 2, BACKOFF_MAX)

        return None

    def fetch_json(self, url: str) -> Optional[dict]:
        """Convenience for hitting an API endpoint discovered via DevTools."""
        text = self.fetch(url)
        if text is None:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            self.logger.warning(f"Not JSON at {url}")
            return None

    def error_ratio(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return (self.errors_4xx + self.errors_5xx) / self.total_requests


class StopGate(Exception):
    """Raised when scraper should stop immediately."""
    pass


# ============================================================
# SPA detection
# ============================================================

SPA_MARKERS = [
    '<div id="root"></div>',
    '<div id="app"></div>',
    "window.__INITIAL_STATE__",
    "window.__NUXT__",
    "window.__NEXT_DATA__",
    'data-reactroot',
    "ng-version=",
]


def detect_spa(html: str, logger: logging.Logger) -> bool:
    """Heuristic SPA detection — empty body or framework markers => SPA."""
    soup = BeautifulSoup(html, "lxml")
    body = soup.body
    body_text_len = len(body.get_text(strip=True)) if body else 0
    inline_scripts = sum(1 for s in soup.find_all("script") if s.string)

    markers_found = [m for m in SPA_MARKERS if m in html]

    logger.info(f"  body text length: {body_text_len}")
    logger.info(f"  inline scripts: {inline_scripts}")
    logger.info(f"  SPA markers found: {markers_found if markers_found else 'none'}")

    # SPA verdict: very little body text + framework markers present
    is_spa = bool(markers_found) or body_text_len < 200
    return is_spa


# ============================================================
# Robots.txt check
# ============================================================

def check_robots_txt(fetcher: PoliteFetcher, logger: logging.Logger) -> bool:
    robots_url = f"{ROOT_URL}/robots.txt"
    logger.info(f"Checking {robots_url}")
    content = fetcher.fetch(robots_url)
    if content is None:
        logger.warning("robots.txt nedostupný — pokračuji opatrně")
        return True

    rp = RobotFileParser()
    rp.parse(content.splitlines())
    allowed = rp.can_fetch(USER_AGENT, TARGET_URL)
    logger.info(f"robots.txt: {TARGET_URL} allowed = {allowed}")
    if not allowed:
        logger.error("robots.txt zakazuje cílovou cestu — STOP")
    return allowed


# ============================================================
# Discovery & parsing
# ============================================================

def discover_vintages(fetcher: PoliteFetcher, logger: logging.Logger) -> dict[str, str]:
    """Best-effort: parse home page for vintage selectors.
    Returns: dict[vintage_label → vintage_id_in_url].

    NOTE: podminky.urs.cz URL structure is unknown until --explore reveals it.
    Fill in concrete patterns after explore confirms layout.
    """
    logger.info("Discovering vintages from target home page")
    html = fetcher.fetch(TARGET_URL)
    if html is None:
        raise StopGate("Nelze stáhnout TARGET_URL")

    soup = BeautifulSoup(html, "lxml")
    vintages: dict[str, str] = {}

    # Generic patterns — adjust after --explore reveals real URL shape
    # 1) vintage in URL path like /2026-I/ or /cu261/
    for a in soup.find_all("a", href=True):
        href = a["href"]
        m = re.search(r"/(20\d{2}-I{1,2})/", href) or re.search(r"/cu(\d{3})/", href)
        if m:
            token = m.group(1)
            if token.startswith("20"):
                vintages[token] = token
            else:
                yy, half = token[:2], token[2]
                year = 2000 + int(yy)
                roman = "I" if half == "1" else "II"
                vintages[f"{year}-{roman}"] = token

    # 2) vintage in <select> / <option> elements
    for opt in soup.find_all("option"):
        label = opt.get_text(strip=True)
        m = re.fullmatch(r"(20\d{2})/(I{1,2})", label)
        if m:
            year, roman = m.groups()
            vintages[f"{year}-{roman}"] = opt.get("value", label)

    logger.info(f"Discovered {len(vintages)} vintages: {sorted(vintages.keys())}")
    return vintages


def discover_catalogues(fetcher: PoliteFetcher, vintage_url: str,
                         logger: logging.Logger) -> list[dict]:
    """For a vintage URL, find all catalog entries on it.
    Returns: list[{catalog_code, catalog_name, url}].

    Adjust selectors after --explore reveals the real DOM structure.
    """
    html = fetcher.fetch(vintage_url)
    if html is None:
        return []

    soup = BeautifulSoup(html, "lxml")
    catalogues: list[dict] = []
    seen = set()

    # Generic pattern: catalog code "NNN-N" or "NNN-NN" anywhere in href
    pattern = re.compile(r"(\d{3}-\d{1,2})")

    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(" ", strip=True)
        m = pattern.search(href) or pattern.search(text)
        if not m:
            continue
        catalog_code = m.group(1)
        if catalog_code in seen:
            continue
        seen.add(catalog_code)
        # name = text minus the code prefix
        catalog_name = re.sub(rf"^{re.escape(catalog_code)}\s*[-–—]?\s*", "", text).strip() or catalog_code
        catalogues.append({
            "catalog_code": catalog_code,
            "catalog_name": catalog_name,
            "url": urljoin(ROOT_URL, href),
        })

    logger.info(f"  → {len(catalogues)} catalogues")
    return catalogues


def discover_sections(fetcher: PoliteFetcher, catalog_url: str,
                       logger: logging.Logger) -> list[str]:
    """For a catalog URL find all section/article URLs."""
    html = fetcher.fetch(catalog_url)
    if html is None:
        return []

    soup = BeautifulSoup(html, "lxml")
    sections: list[str] = []
    seen = set()
    base_path = urlparse(catalog_url).path.rstrip("/")

    for a in soup.find_all("a", href=True):
        href = a["href"]
        # heuristic: deeper path = section/article
        if href.startswith(base_path) and len(href) > len(base_path) + 1:
            full = urljoin(ROOT_URL, href)
            if full not in seen and full != catalog_url:
                seen.add(full)
                sections.append(full)

    return sections


def extract_items_from_section(html: str, vintage: str, catalog_code: str,
                                catalog_name: str, source_url: str,
                                logger: logging.Logger) -> list[UrsItem]:
    """Extract položky z section HTML. Best-guess extractor.
    Po --explore uprav selektory pokud potřeba."""
    soup = BeautifulSoup(html, "lxml")
    items: list[UrsItem] = []
    now = datetime.now(timezone.utc).isoformat()

    # Strategy 1: <table> rows
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        for tr in rows:
            cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
            if not cells:
                continue
            cell_text = " | ".join(cells)
            code = _try_extract_urs_code(cell_text)
            if not code:
                continue
            popis = _find_longest_text_cell(cells)
            mj = _find_mj_cell(cells)
            if not popis:
                continue
            items.append(UrsItem(
                urs_code=code,
                catalog_code=catalog_code,
                catalog_name=catalog_name,
                vintage=vintage,
                popis=popis,
                popis_normalized=normalize_popis(popis),
                mj=mj,
                source_url=source_url,
                scraped_at=now,
            ))

    # Strategy 2: structured divs / lis
    if not items:
        for el in soup.find_all(["div", "li"], class_=re.compile(r"(item|polozka|cenik|row)", re.I)):
            text = el.get_text(" ", strip=True)
            code = _try_extract_urs_code(text)
            if not code:
                continue
            items.append(UrsItem(
                urs_code=code,
                catalog_code=catalog_code,
                catalog_name=catalog_name,
                vintage=vintage,
                popis=text,
                popis_normalized=normalize_popis(text),
                source_url=source_url,
                scraped_at=now,
            ))

    if not items:
        logger.debug(f"Žádné položky extrahovány z {source_url} — možná SPA / layout změna")

    return items


def _try_extract_urs_code(text: str) -> Optional[str]:
    for pattern in URS_CODE_PATTERNS:
        m = pattern.search(text)
        if m:
            return m.group(1).strip()
    return None


def _find_longest_text_cell(cells: list[str]) -> str:
    candidates = [c for c in cells
                  if len(c) > 20
                  and not c.replace(".", "").replace(",", "").replace(" ", "").isdigit()]
    if not candidates:
        return ""
    return max(candidates, key=len)


def _find_mj_cell(cells: list[str]) -> Optional[str]:
    mj_set = {"m", "m2", "m3", "m²", "m³", "kg", "t", "ks", "hod", "soubor", "bm", "MJ"}
    for c in cells:
        if c in mj_set or (1 <= len(c) <= 8 and any(p in c.lower() for p in ["m", "kg", "ks", "t"])):
            return c
    return None


# ============================================================
# Explore mode — STÁHNI tohle JAKO PRVNÍ
# ============================================================

def run_explore(fetcher: PoliteFetcher, output_dir: Path, logger: logging.Logger):
    """Stáhne TARGET_URL + sample stránku, uloží HTML pro inspekci, detekuje SPA."""
    logger.info("=" * 60)
    logger.info(f"EXPLORE MODE — target: {TARGET_URL}")
    logger.info("=" * 60)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # 1) Target home page
    logger.info(f"\n[1/4] Fetching home: {TARGET_URL}")
    html = fetcher.fetch(TARGET_URL)
    if not html:
        logger.error("Nepodařilo se stáhnout home — pravděpodobně blokováno na úrovni sítě")
        return

    home_path = output_dir / f"explore_home_{timestamp}.html"
    home_path.write_text(html, encoding="utf-8")
    logger.info(f"  saved → {home_path}")
    logger.info(f"  size: {len(html):,} bytes")

    # 2) SPA detection
    logger.info(f"\n[2/4] SPA detection:")
    is_spa = detect_spa(html, logger)
    if is_spa:
        logger.warning("⚠️  PRAVDĚPODOBNĚ SPA — static fetch nestačí.")
        logger.warning("    Otevři {} v prohlížeči, F12 → Network → Fetch/XHR,".format(TARGET_URL))
        logger.warning("    reload stránky, pošli 1-2 ukázkové JSON URL zpět Claudovi pro úpravu skriptu.")
        logger.warning("    Alternativně: nastav USE_PLAYWRIGHT=1 a doplň fetch_rendered() stub.")
    else:
        logger.info("  ✓ Static HTML rendering — extraction by mělo fungovat")

    # 3) Try vintage discovery
    logger.info(f"\n[3/4] Discovering vintages from home")
    try:
        vintages = discover_vintages(fetcher, logger)
        if vintages:
            logger.info(f"  found: {json.dumps(vintages, indent=2)}")
        else:
            logger.warning("  none found — open HTML in browser, locate vintage selector, "
                           "report URL pattern back to Claude")
    except StopGate as e:
        logger.error(f"  STOP during vintage discovery: {e}")
        return

    # 4) Sample one catalog if possible
    logger.info(f"\n[4/4] Sample fetch:")
    if vintages:
        first_vintage, first_token = sorted(vintages.items(), reverse=True)[0]
        # heuristic URL — adjust after explore reveals real shape
        vintage_url = urljoin(ROOT_URL + "/", first_token)
        if "?" in TARGET_URL and "productId" not in vintage_url:
            vintage_url = f"{vintage_url}?productId={PRODUCT_ID}"
        logger.info(f"  trying vintage URL: {vintage_url}")
        v_html = fetcher.fetch(vintage_url)
        if v_html:
            vpath = output_dir / f"explore_vintage_{first_token}_{timestamp}.html"
            vpath.write_text(v_html, encoding="utf-8")
            logger.info(f"  saved → {vpath}")
            catalogues = discover_catalogues(fetcher, vintage_url, logger)
            if catalogues:
                logger.info(f"  catalogues sample (first 5):\n{json.dumps(catalogues[:5], indent=2, ensure_ascii=False)}")
    else:
        logger.info("  skipped — no vintages discovered, nothing to sample")

    logger.info("\n" + "=" * 60)
    logger.info(f"EXPLORE DONE — files in {output_dir}")
    logger.info(f"Total requests: {fetcher.total_requests}, errors: {fetcher.errors_4xx + fetcher.errors_5xx}")
    logger.info("Next steps:")
    logger.info("  1. Open explore_home_*.html in a browser — confirm rendering")
    logger.info("  2. If SPA warning fired → DevTools Network → identify JSON endpoint")
    logger.info("  3. Pokud extractor selhal → pošli explore_*.html zpět Claudovi")
    logger.info("=" * 60)


# ============================================================
# Full build
# ============================================================

def run_build(args, fetcher: PoliteFetcher, db: UrsCacheDB,
              state: ResumeState, output_dir: Path, state_path: Path,
              logger: logging.Logger):

    if not check_robots_txt(fetcher, logger):
        raise StopGate("robots.txt zakazuje scraping")

    vintages_available = discover_vintages(fetcher, logger)
    if not vintages_available:
        raise StopGate("Žádné vintages nenalezeny — pravděpodobně SPA. Spusť --explore.")

    requested_vintages = None
    if args.vintages:
        requested_vintages = [v.strip() for v in args.vintages.split(",")]

    vintages_to_scrape = {
        v: token for v, token in vintages_available.items()
        if requested_vintages is None or v in requested_vintages
    }

    if not vintages_to_scrape:
        logger.error(f"Žádný z požadovaných vintages není dostupný. Available: {sorted(vintages_available.keys())}")
        return

    logger.info(f"Will scrape vintages: {sorted(vintages_to_scrape.keys())}")

    requested_catalogues = None
    if args.catalogues:
        requested_catalogues = [c.strip() for c in args.catalogues.split(",")]

    for vintage, token in sorted(vintages_to_scrape.items(), reverse=True):
        vintage_url = urljoin(ROOT_URL + "/", token)
        if "productId" not in vintage_url:
            sep = "&" if "?" in vintage_url else "?"
            vintage_url = f"{vintage_url}{sep}{urlencode({'productId': PRODUCT_ID})}"
        logger.info(f"\n{'=' * 60}\nVintage {vintage} → {vintage_url}\n{'=' * 60}")

        catalogues = discover_catalogues(fetcher, vintage_url, logger)
        if requested_catalogues:
            catalogues = [c for c in catalogues if c["catalog_code"] in requested_catalogues]

        for cat in catalogues:
            if state.is_done(vintage, cat["catalog_code"]):
                logger.info(f"  ⏭  {cat['catalog_code']} — already done, skipping")
                continue

            if args.dry_run:
                logger.info(f"  [DRY] {cat['catalog_code']} {cat['catalog_name']} → {cat['url']}")
                continue

            logger.info(f"  📚 {cat['catalog_code']} {cat['catalog_name']}")
            try:
                items = scrape_catalog(fetcher, cat, vintage, logger)
            except StopGate:
                raise
            except Exception as e:
                logger.error(f"    Catalog failed: {e}")
                state.failed_catalogs.append({
                    "vintage": vintage,
                    "catalog_code": cat["catalog_code"],
                    "error": str(e),
                })
                state.save(state_path)
                continue

            if items:
                inserted = db.insert_items(items)
                logger.info(f"    ✓ {len(items)} extracted, {inserted} new in DB")

                json_dir = output_dir / vintage
                json_dir.mkdir(parents=True, exist_ok=True)
                json_path = json_dir / f"{cat['catalog_code']}.json"
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump([asdict(i) for i in items], f, indent=2, ensure_ascii=False)

                state.mark_done(vintage, cat["catalog_code"], len(items))
            else:
                logger.warning(f"    ⚠ Žádné items extracted")
                state.failed_catalogs.append({
                    "vintage": vintage,
                    "catalog_code": cat["catalog_code"],
                    "error": "no items extracted",
                })

            state.save(state_path)

            if fetcher.error_ratio() > MAX_4XX_RATIO and fetcher.total_requests > 50:
                raise StopGate(f"Error ratio {fetcher.error_ratio():.1%} > {MAX_4XX_RATIO:.0%} — STOP")

    logger.info(f"\n✓ BUILD DONE — total items in DB: {db.count()}")


def scrape_catalog(fetcher: PoliteFetcher, catalog: dict, vintage: str,
                    logger: logging.Logger) -> list[UrsItem]:
    sections = discover_sections(fetcher, catalog["url"], logger)
    logger.info(f"    {len(sections)} sections")

    all_items: list[UrsItem] = []
    for section_url in tqdm(sections, desc=f"    {catalog['catalog_code']}", leave=False):
        html = fetcher.fetch(section_url)
        if html is None:
            continue
        items = extract_items_from_section(
            html, vintage, catalog["catalog_code"],
            catalog["catalog_name"], section_url, logger
        )
        all_items.extend(items)

    return all_items


# ============================================================
# Audit mode
# ============================================================

def run_audit(db: UrsCacheDB, sample_size: int, logger: logging.Logger):
    total = db.count()
    logger.info(f"Total items in DB: {total}")
    if total == 0:
        logger.warning("DB empty")
        return

    samples = db.sample(sample_size)
    complete = 0
    issues = []
    for s in samples:
        missing = [k for k in ["urs_code", "popis", "mj"] if not s.get(k)]
        if not missing:
            complete += 1
        else:
            issues.append((s["urs_code"] or "?", missing))

    completeness = complete / len(samples) * 100
    logger.info(f"Schema completeness: {completeness:.1f}% ({complete}/{len(samples)})")
    logger.info("Sample items:")
    for s in samples[:5]:
        logger.info(f"  {s['urs_code']} | {s['popis'][:80]} | mj={s['mj']}")

    if issues:
        logger.warning("Issues found:")
        for code, miss in issues[:10]:
            logger.warning(f"  {code}: missing {miss}")


# ============================================================
# Main CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="STAVAGENT URS Cache Scraper (podminky.urs.cz)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--explore", action="store_true",
                        help="Discovery mode — stáhne sample HTML pro inspekci (SPUSŤ JAKO PRVNÍ)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Ukáže URL co by se scrapovaly, nestahuje")
    parser.add_argument("--resume", action="store_true",
                        help="Pokračovat po přerušení (load checkpoint)")
    parser.add_argument("--audit", action="store_true",
                        help="Kontrola kvality existujícího cache")
    parser.add_argument("--vintages", type=str, default=None,
                        help="Comma-separated vintages např. '2026-I,2025-II'")
    parser.add_argument("--catalogues", type=str, default=None,
                        help="Comma-separated catalog codes např. '800-1,800-2'")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--sample-size", type=int, default=50,
                        help="Audit sample size (default: 50)")
    parser.add_argument("--verbose", action="store_true", help="DEBUG logging")

    args = parser.parse_args()
    logger = setup_logging(args.output_dir, verbose=args.verbose)

    logger.info(f"STAVAGENT URS Scraper starting at {datetime.now().isoformat()}")
    logger.info(f"Target: {TARGET_URL}")
    logger.info(f"Output: {args.output_dir}")
    logger.info(f"DB: {args.db_path}")

    state_path = args.output_dir / "resume_state.json"
    state = ResumeState.load(state_path) if args.resume else ResumeState(
        started_at=datetime.now(timezone.utc).isoformat()
    )

    db = UrsCacheDB(args.db_path)
    fetcher = PoliteFetcher(logger)

    try:
        if args.audit:
            run_audit(db, args.sample_size, logger)
        elif args.explore:
            run_explore(fetcher, args.output_dir, logger)
        else:
            run_build(args, fetcher, db, state, args.output_dir, state_path, logger)
    except StopGate as e:
        logger.error(f"\n🛑 STOP GATE: {e}")
        logger.error(f"Total requests: {fetcher.total_requests}")
        logger.error(f"Error ratio: {fetcher.error_ratio():.1%}")
        state.save(state_path)
        db.close()
        sys.exit(1)
    except KeyboardInterrupt:
        logger.info("\n⏸  Interrupted by user — state saved, můžeš pokračovat s --resume")
        state.save(state_path)
        db.close()
        sys.exit(0)

    state.save(state_path)
    db.close()
    logger.info("Done.")


if __name__ == "__main__":
    main()
