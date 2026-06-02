"""
Graceful OpenTelemetry shim for the recipe runner.

Returns a real OTel tracer when `opentelemetry` is importable, otherwise a no-op
tracer whose `start_as_current_span` is a context manager that does nothing. This
keeps the orchestrator callable (and tests/CI green) even when the OTel SDK is
absent — the production requirements pin opentelemetry-sdk (also present
transitively via google-cloud-aiplatform), so real spans flow in deployment.
"""
from __future__ import annotations

from contextlib import contextmanager

try:  # pragma: no cover - import-environment dependent
    from opentelemetry import trace as _otel_trace

    _HAS_OTEL = True
except Exception:  # pragma: no cover
    _HAS_OTEL = False


class _NoopSpan:
    def set_attribute(self, *args, **kwargs):  # noqa: D401
        return None


class _NoopTracer:
    @contextmanager
    def start_as_current_span(self, name, *args, **kwargs):
        yield _NoopSpan()


def get_tracer(name: str = "stage_gating.recipe"):
    """Return an OTel tracer, or a no-op tracer if the SDK is unavailable."""
    if _HAS_OTEL:
        return _otel_trace.get_tracer(name)
    return _NoopTracer()
