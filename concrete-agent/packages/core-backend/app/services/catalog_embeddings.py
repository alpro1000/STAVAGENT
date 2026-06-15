"""
pgvector embeddings retrieve provider for the catalog matching chain (recall).

Plugs into `catalog_matching._EMBEDDINGS_PROVIDER` (the seam from Phase 1a). The
provider embeds the query with the configured Vertex model and returns the
nearest OTSKP items from the `otskp_embeddings` pgvector table by COSINE
distance, each carrying ``source='embeddings'`` + a ``similarity`` in [0,1] so
the chain places them in the AI confidence band (~0.70–0.80) — never as a source
of truth, never at 1.0.

The table is denormalised (code + popis + unit + price + embedding) so a query
is a single Postgres round-trip with no cross-store join to the SQLite catalog.

Import- and registration-safe: registering only sets a callable. The DB
connection and the Vertex call happen lazily, on first query — so importing this
module (or wiring the provider at startup) never needs a live DB / ADC.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_SEARCH_SQL = (
    "SELECT code, popis, unit, unit_price_czk, "
    "1 - (embedding <=> %s::vector) AS similarity "
    "FROM otskp_embeddings "
    "ORDER BY embedding <=> %s::vector "
    "LIMIT %s"
)


def build_candidates_from_rows(rows) -> list[dict]:
    """Pure mapper: DB rows → chain candidate dicts. Hermetically testable.

    Each row is (code, popis, unit, unit_price_czk, similarity).
    """
    candidates = []
    for code, popis, unit, price, similarity in rows:
        candidates.append({
            "code": code,
            "description": popis,
            "unit": unit or "",
            "unit_price_czk": float(price) if price is not None else 0.0,
            "source": "embeddings",
            "similarity": float(similarity) if similarity is not None else 0.0,
        })
    return candidates


def _vector_literal(vec: list[float]) -> str:
    """pgvector text literal: '[0.1,0.2,...]' (cast ::vector in SQL)."""
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


def _sync_dsn() -> str:
    """psycopg2 DSN from DATABASE_URL (strip async driver + scheme suffix)."""
    dsn = settings.DATABASE_URL or ""
    return dsn.replace("postgresql+asyncpg://", "postgresql://").replace("+asyncpg", "").strip()


def _search(query: str, limit: int = 20) -> list[dict]:
    """Raw embeddings retrieve — RAISES on any failure.

    Diagnostics (``recall_health``) call this so the failing stage surfaces;
    the public ``pgvector_provider`` wraps it to degrade silently at query time.
    """
    import psycopg2

    from app.integrations.vertex_embeddings import get_vertex_embeddings

    vec = get_vertex_embeddings().embed_query(query)
    vec_lit = _vector_literal(vec)
    conn = psycopg2.connect(_sync_dsn())
    try:
        with conn.cursor() as cur:
            cur.execute(_SEARCH_SQL, (vec_lit, vec_lit, limit))
            rows = cur.fetchall()
    finally:
        conn.close()
    return build_candidates_from_rows(rows)


def pgvector_provider(query: str, limit: int = 20) -> list[dict]:
    """Embeddings retrieve over `otskp_embeddings`. Returns [] on any failure.

    Recall is best-effort: an embeddings outage must never break code lookup or
    keyword search, so all errors degrade to an empty list (the chain still
    returns keyword candidates).
    """
    try:
        return _search(query, limit)
    except Exception as e:  # pragma: no cover - exercised on deploy, not in CI
        logger.warning(
            "[catalog_embeddings] retrieve failed, degrading to keyword-only (query=%r): %s",
            query, e,
        )
        return []


def recall_health(probe_query: str = "beton mostních pilířů C35/45") -> dict:
    """Best-effort end-to-end self-test of the recall path, for startup logging.

    Walks the SAME stages ``pgvector_provider`` uses (DB → Vertex embed → vector
    search) but surfaces the FAILING stage + error instead of degrading silently,
    so a single deploy log answers "is recall live, and if not, why?". This is
    the one place recall failure is loud — every other path is best-effort quiet.

    Never raises. Returns a dict with ``active`` + diagnostics.
    """
    health: dict = {
        "active": False, "stage": None, "rows": None, "dim": None,
        "model": getattr(settings, "EMBEDDING_MODEL", None),
        "top_similarity": None, "error": None,
    }

    # Stage 1 — DB reachable + table exists + populated. Isolates the most common
    # real cause: ingest --index wrote to a DIFFERENT database than the runtime
    # connects to (rows=0 / relation missing), or the DSN/socket is wrong.
    try:
        import psycopg2

        conn = psycopg2.connect(_sync_dsn())
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM otskp_embeddings")
                health["rows"] = int(cur.fetchone()[0])
        finally:
            conn.close()
    except Exception as e:
        health["stage"] = "db"
        health["error"] = str(e)
        return health

    if not health["rows"]:
        health["stage"] = "empty_table"
        health["error"] = (
            "otskp_embeddings has 0 rows — run ingest --index against THIS database"
        )
        return health

    # Stage 2 — Vertex embed + vector search round-trip (ADC, model, pgvector
    # extension, vector-dim agreement all exercised here).
    try:
        cands = _search(probe_query, limit=1)
    except Exception as e:
        health["stage"] = "search"
        health["error"] = str(e)
        return health

    if cands:
        health["dim"] = getattr(settings, "EMBEDDING_DIM", None)
        health["top_similarity"] = round(float(cands[0].get("similarity", 0.0)), 4)

    health["active"] = True
    health["stage"] = "ok"
    return health


def register_embeddings_provider(provider: Optional[callable] = None) -> None:
    """Wire the embeddings retrieve into the matching chain seam.

    Call once at startup AFTER the OTSKP catalog has been indexed into pgvector.
    Passing a custom provider is used by tests; default is `pgvector_provider`.
    """
    from app.services import catalog_matching

    catalog_matching._EMBEDDINGS_PROVIDER = provider or pgvector_provider
    logger.info("[catalog_embeddings] embeddings provider registered: %s",
                getattr(catalog_matching._EMBEDDINGS_PROVIDER, "__name__", "custom"))
