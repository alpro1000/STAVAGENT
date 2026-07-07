"""
Integration adapters for external systems.

Live modules (imported directly, not via this barrel):
- vertex_search: Vertex AI Search client (document_search_router, routes_vertex)
- vertex_embeddings: Vertex AI embeddings (catalog_embeddings)

Removed 2026-07 (audit Sprint D): monolit_adapter (613 L HTTP router that was
never mounted — Monolit delegation goes the other way, via
app/mcp/tools/monolit_delegate.py → Monolit /api/calculate) and the legacy
gemini_client stub (the live client is app/core/gemini_client.py).
"""
