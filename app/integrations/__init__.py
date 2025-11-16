"""
Integration adapters for external systems.

Provides bridges between Concrete-Agent and other applications:
- Monolit-Planner: XLSX parsing, position enrichment, audit
- Custom integrations: Add your own adapters here
"""

from app.integrations.monolit_adapter import (
    MonolitAdapter,
    MonolitEnrichmentRequest,
    MonolitEnrichmentResponse,
    ConcreteAgentClient,
    router as monolit_router,
)

__all__ = [
    "MonolitAdapter",
    "MonolitEnrichmentRequest",
    "MonolitEnrichmentResponse",
    "ConcreteAgentClient",
    "monolit_router",
]
