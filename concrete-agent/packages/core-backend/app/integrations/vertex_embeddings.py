"""
Vertex AI text embeddings — catalog semantic retrieve (recall).

Replaces the retired `textembedding-gecko@003` (RETIRED 2025-05-24). Model +
dimension come from settings (`EMBEDDING_MODEL` / `EMBEDDING_DIM`), so the
pgvector column and the client never drift, and the post-google-genai-migration
swap to `gemini-embedding-001` @ output_dimensionality=768 is a config change,
not a re-index.

Built on the SAME `vertexai` + ADC pattern as `app/core/gemini_client.py` (the
repo's current working Vertex stack). `vertexai` is removed 2026-06-24; this
client migrates to `google-genai` together with the rest of the codebase then.

Import-safe: the `vertexai` SDK is imported lazily inside `_ensure_model()`, so
importing this module (and anything that wires the provider) never crashes in a
test/CI environment without the SDK or ADC.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Task types per Vertex embeddings API — document corpus vs. query are embedded
# with different task types for better retrieval (asymmetric search).
_TASK_DOCUMENT = "RETRIEVAL_DOCUMENT"
_TASK_QUERY = "RETRIEVAL_QUERY"


class VertexEmbeddings:
    """Thin wrapper over Vertex `TextEmbeddingModel`. Model/dim from settings."""

    def __init__(self, model_name: Optional[str] = None, dim: Optional[int] = None,
                 location: Optional[str] = None, project_id: Optional[str] = None):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self.dim = dim or settings.EMBEDDING_DIM
        self.location = location or settings.EMBEDDING_LOCATION
        self.project_id = project_id or settings.GOOGLE_PROJECT_ID
        self._model = None

    def _ensure_model(self):
        if self._model is not None:
            return self._model
        import vertexai
        from vertexai.language_models import TextEmbeddingModel

        vertexai.init(project=self.project_id or None, location=self.location)
        self._model = TextEmbeddingModel.from_pretrained(self.model_name)
        logger.info("[VertexEmbeddings] model=%s dim=%s loc=%s", self.model_name, self.dim, self.location)
        return self._model

    def _embed(self, texts: List[str], task_type: str) -> List[List[float]]:
        from vertexai.language_models import TextEmbeddingInput

        model = self._ensure_model()
        inputs = [TextEmbeddingInput(text=t, task_type=task_type) for t in texts]
        # output_dimensionality drives MRL truncation (gemini-embedding-001) and
        # is a no-op at the native dim for multilingual-002 — passing it is safe
        # and keeps the column/model contract explicit.
        embeddings = model.get_embeddings(inputs, output_dimensionality=self.dim)
        return [e.values for e in embeddings]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed catalog item texts for indexing (batch ≤ 250)."""
        return self._embed(texts, _TASK_DOCUMENT)

    def embed_query(self, query: str) -> List[float]:
        """Embed a single search query."""
        return self._embed([query], _TASK_QUERY)[0]


# Singleton
_vertex_embeddings: Optional[VertexEmbeddings] = None


def get_vertex_embeddings() -> VertexEmbeddings:
    global _vertex_embeddings
    if _vertex_embeddings is None:
        _vertex_embeddings = VertexEmbeddings()
    return _vertex_embeddings
