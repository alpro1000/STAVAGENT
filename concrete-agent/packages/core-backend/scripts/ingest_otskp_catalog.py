#!/usr/bin/env python3
"""
Ingest the OTSKP catalog (2026, SFDI open format) from GCS into otskp.db and,
optionally, index it into the `otskp_embeddings` pgvector table.

The catalog XML lives in GCS (NOT committed to the repo — it is ingestion data,
not knowledge). Primary source is the SFDI open-format file; the AspeEsticon
export is a heavier cross-check only.

    Primary:    gs://stavagent-catalogs/otskp/2026_OTSKP_sfdi_otevreny_format.xml
    Cross-check: gs://stavagent-catalogs/otskp/2026_OTSKP_aspe_esticon.xml

Usage:
    # download + build otskp.db (provenance-stamped), print the real item count
    python scripts/ingest_otskp_catalog.py \
        --gcs gs://stavagent-catalogs/otskp/2026_OTSKP_sfdi_otevreny_format.xml \
        --db-out app/otskp.db --catalog-version "OTSKP 2026"

    # also embed + upsert into the otskp_embeddings pgvector table
    python scripts/ingest_otskp_catalog.py --gcs gs://... --db-out app/otskp.db --index

    # verify parser against a local file (no GCS, no DB)
    python scripts/ingest_otskp_catalog.py --parse-only /path/to/local.xml

Indexing reads EMBEDDING_MODEL / EMBEDDING_DIM from settings and writes to the
table created by the `otskp_embeddings_pgvector` Alembic migration — so indexing
runs directly on the fresh 2026 base (no double re-index).

Run from the package dir; `app` is made importable via a sys.path bootstrap
(no PYTHONPATH needed): `cd packages/core-backend && python scripts/ingest_otskp_catalog.py ...`
"""
from __future__ import annotations

import argparse
import logging
import os
import sqlite3
import sys
import time
import xml.etree.ElementTree as ET
from typing import Iterable

# Make `app` importable when run from the package dir (scripts/ is a sibling of
# app/). Without this, `from app...` raises ModuleNotFoundError: app.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("ingest_otskp")


def _local(tag: str) -> str:
    """Strip XML namespace: '{ns}Polozka' -> 'Polozka'."""
    return tag.rsplit("}", 1)[-1]


def parse_otskp_xml(content: str) -> list[dict]:
    """Pure parser — SFDI/XC4 OTSKP XML → list of item dicts. Hermetically testable.

    Tolerant of the namespace and of the XC4 > CenoveSoustavy > Polozky wrapper:
    every element whose local tag is 'Polozka' is read by child local-name
    (znacka, nazev, MJ, jedn_cena, technicka_specifikace), matching the existing
    in-memory parser + the URS_MATCHER importer. Raises on a structurally empty
    or unrecognised file (no silent zero-item ingest).
    """
    content = content.lstrip("﻿")
    root = ET.fromstring(content)
    items: list[dict] = []
    for el in root.iter():
        if _local(el.tag) != "Polozka":
            continue
        fields: dict = {}
        for child in el:
            fields[_local(child.tag)] = (child.text or "").strip()
        code = fields.get("znacka", "").strip()
        if not code:
            continue
        cena_raw = fields.get("jedn_cena", "") or ""
        try:
            cena = float(cena_raw.replace(",", ".")) if cena_raw else 0.0
        except ValueError:
            cena = 0.0
        items.append({
            "code": code,
            "nazev": fields.get("nazev", "").strip(),
            "mj": fields.get("MJ", "").strip(),
            "cena": cena,
            "spec": fields.get("technicka_specifikace", "").strip(),
        })
    if not items:
        raise ValueError(
            "No <Polozka> items parsed — unexpected OTSKP XML structure. "
            "If this is the AspeEsticon export, use the SFDI open-format file instead."
        )
    return items


def load_xml_text(source: str, *, timeout: int = 300, retries: int = 4) -> str:
    """Load OTSKP XML from a gs:// URI OR a local file path.

    For gs://: a 17 MB blob streamed via download_as_text can ReadTimeout / hit
    gRPC 503 from Cloud Shell, so we download to a temp file (chunked) with a
    generous timeout and exponential backoff. A non-gs:// argument is read as a
    local path — so a pre-downloaded file (`gsutil cp …`) sidesteps egress flakiness.
    """
    if not source.startswith("gs://"):
        with open(source, encoding="utf-8") as f:
            return f.read()

    import tempfile

    from google.cloud import storage

    bucket_name, _, blob_name = source[len("gs://"):].partition("/")
    blob = storage.Client().bucket(bucket_name).blob(blob_name)
    last_err = None
    for attempt in range(1, retries + 1):
        tmp = tempfile.NamedTemporaryFile(suffix=".xml", delete=False)
        tmp.close()
        try:
            logger.info("Downloading %s (attempt %d/%d) ...", source, attempt, retries)
            blob.download_to_filename(tmp.name, timeout=timeout)
            with open(tmp.name, encoding="utf-8") as f:
                return f.read()
        except Exception as e:  # noqa: BLE001 — transient ReadTimeout / 503 / connreset
            last_err = e
            if attempt == retries:
                break
            wait = min(2 ** attempt, 30)
            logger.warning("  download failed (%s) — retry in %ds", e, wait)
            time.sleep(wait)
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass
    raise RuntimeError(f"GCS download failed after {retries} attempts: {last_err}")


def build_sqlite(items: list[dict], db_path: str, catalog_version: str) -> int:
    """Write items into otskp.db (schema matching app.pricing.otskp_engine)."""
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("DROP TABLE IF EXISTS otskp;")
        conn.execute(
            "CREATE TABLE otskp (code TEXT PRIMARY KEY, nazev TEXT, mj TEXT, "
            "cena REAL, spec TEXT, catalog_version TEXT);"
        )
        conn.executemany(
            "INSERT OR REPLACE INTO otskp (code, nazev, mj, cena, spec, catalog_version) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [(i["code"], i["nazev"], i["mj"], i["cena"], i["spec"], catalog_version) for i in items],
        )
        conn.commit()
        n = conn.execute("SELECT COUNT(*) FROM otskp").fetchone()[0]
    finally:
        conn.close()
    return n


# Embedding request limits. The per-text model cap is ~2k tokens; the per-REQUEST
# (batch) total has a ~20k-token ceiling — a few items with multi-page
# technicka_specifikace (observed 22k / 26k tokens) blow it even at batch 50. So:
# truncate each text, then pack batches by an estimated token budget.
_MAX_TEXT_CHARS = 8000          # ~2k tokens — keeps any single item under the model cap
_BATCH_TOKEN_BUDGET = 16000     # stay safely under the ~20k per-request total
_MAX_BATCH_ITEMS = 50


def _est_tokens(text: str) -> int:
    return max(1, len(text) // 4)  # ~4 chars/token heuristic


def _doc_text(item: dict) -> str:
    return f"{item['nazev']} {item['spec']}".strip()[:_MAX_TEXT_CHARS]


def _token_budgeted_batches(pairs: list) -> Iterable[list]:
    """Yield batches of (item, text) packed under the per-request token budget."""
    batch: list = []
    toks = 0
    for item, text in pairs:
        tt = _est_tokens(text)
        if batch and (toks + tt > _BATCH_TOKEN_BUDGET or len(batch) >= _MAX_BATCH_ITEMS):
            yield batch
            batch, toks = [], 0
        batch.append((item, text))
        toks += tt
    if batch:
        yield batch


def index_pgvector(items: list[dict], catalog_version: str) -> int:
    """Embed item popis and upsert into otskp_embeddings (pgvector).

    Token-aware batching + per-text truncation so multi-page specs can't blow the
    per-request token ceiling; embed_documents retries transient gRPC errors.
    """
    import psycopg2

    from app.integrations.vertex_embeddings import get_vertex_embeddings
    from app.services.catalog_embeddings import _sync_dsn, _vector_literal

    emb = get_vertex_embeddings()
    conn = psycopg2.connect(_sync_dsn())
    pairs = [(i, _doc_text(i)) for i in items]
    written = 0
    try:
        for batch in _token_budgeted_batches(pairs):
            vecs = emb.embed_documents([t for _, t in batch])
            rows = [
                (it["code"], it["nazev"], it["mj"], it["cena"], catalog_version, _vector_literal(v))
                for (it, _), v in zip(batch, vecs)
            ]
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO otskp_embeddings "
                    "(code, popis, unit, unit_price_czk, catalog_version, embedding) "
                    "VALUES (%s, %s, %s, %s, %s, %s::vector) "
                    "ON CONFLICT (code) DO UPDATE SET "
                    "popis=EXCLUDED.popis, unit=EXCLUDED.unit, "
                    "unit_price_czk=EXCLUDED.unit_price_czk, "
                    "catalog_version=EXCLUDED.catalog_version, embedding=EXCLUDED.embedding",
                    rows,
                )
            conn.commit()
            written += len(rows)
            logger.info("  indexed %d/%d", written, len(items))
    finally:
        conn.close()
    return written


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Ingest OTSKP catalog from GCS → otskp.db (+ pgvector)")
    ap.add_argument("--gcs", help="gs:// URI OR local path of the SFDI OTSKP XML "
                                  "(local path avoids Cloud Shell egress timeouts)")
    ap.add_argument("--parse-only", help="Local XML path: parse + report count, no GCS/DB")
    ap.add_argument("--db-out", default="app/otskp.db", help="SQLite output path")
    ap.add_argument("--catalog-version", default=None, help="Provenance label (default: settings.OTSKP_CATALOG_VERSION)")
    ap.add_argument("--index", action="store_true", help="Also embed + upsert into otskp_embeddings (pgvector)")
    args = ap.parse_args(argv)

    if args.parse_only:
        with open(args.parse_only, encoding="utf-8") as f:
            items = parse_otskp_xml(f.read())
        logger.info("Parsed %d OTSKP items (parse-only).", len(items))
        return 0

    if not args.gcs:
        ap.error("either --gcs or --parse-only is required")

    from app.core.config import settings
    version = args.catalog_version or settings.OTSKP_CATALOG_VERSION

    content = load_xml_text(args.gcs)
    items = parse_otskp_xml(content)
    logger.info("Parsed %d OTSKP items from %s.", len(items), args.gcs)

    n = build_sqlite(items, args.db_out, version)
    logger.info("Wrote %d items to %s (catalog_version=%r).", n, args.db_out, version)
    logger.info("NOTE: tool descriptions cite the item count — update if it changed (was 17,940).")

    if args.index:
        written = index_pgvector(items, version)
        logger.info("Indexed %d items into otskp_embeddings (pgvector).", written)
    return 0


if __name__ == "__main__":
    sys.exit(main())
