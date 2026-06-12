"""otskp_embeddings — pgvector semantic retrieve for catalog matching.

Installs the `vector` extension and a denormalised `otskp_embeddings` table
(code + popis + unit + price + embedding) used by the catalog matching chain's
embeddings retrieve seam (recall). COSINE distance via an HNSW index.

The embedding dimension is taken from `settings.EMBEDDING_DIM` (default 768 for
`text-multilingual-embedding-002`; the same 768 for the later
`gemini-embedding-001` @ output_dimensionality=768) — so the column is sized to
the VERIFIED model and a model swap at the same dim never re-dimensions the
column. gecko@003 (768) is retired (2025-05-24) and intentionally NOT used.

Reversible. Apply via `alembic upgrade head`.

Revision ID: catalog_otskp_embeddings_pgvector
Revises: orch_sg_pr3b_audit
Create Date: 2026-06-11
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.core.config import settings

# revision identifiers
revision: str = "catalog_otskp_embeddings_pgvector"
down_revision: Union[str, None] = "orch_sg_pr3b_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DIM = int(settings.EMBEDDING_DIM)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.execute(
        f"""
        CREATE TABLE IF NOT EXISTS otskp_embeddings (
            code            TEXT PRIMARY KEY,
            popis           TEXT NOT NULL,
            unit            TEXT,
            unit_price_czk  DOUBLE PRECISION,
            catalog_version TEXT,
            embedding       vector({_DIM}) NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    # HNSW + cosine — absorbs the (un)normalisation caveat of truncated MRL
    # embeddings, so query vectors need no manual L2-normalisation.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_otskp_embeddings_cosine
        ON otskp_embeddings USING hnsw (embedding vector_cosine_ops);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_otskp_embeddings_cosine;")
    op.execute("DROP TABLE IF EXISTS otskp_embeddings;")
    # `vector` extension is left installed — it may back other tables.
