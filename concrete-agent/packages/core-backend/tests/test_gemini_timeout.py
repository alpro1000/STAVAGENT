"""
Per-call timeout on VertexGeminiClient.call().

Prod incident: a Vertex generate_content() hung ~598s during a 429 storm with no
per-call timeout, pushing a passport/generate request past Cloud Run's limit → 502.
The client now bounds each attempt and retries a timeout like a transient 429.
"""
import threading
import time
import pytest

import app.core.gemini_client as gc
from app.core.gemini_client import VertexGeminiClient


def _client(model):
    # Bypass the heavy __init__ (vertexai.init + probe) — we only exercise call().
    c = object.__new__(VertexGeminiClient)
    c._model_cls = model
    c.model_name = "test-model"
    c.max_tokens = 100
    c._project_id = "proj"
    c._location = "loc"
    return c


class _OkModel:
    def generate_content(self, prompt, generation_config=None):
        class _R:
            text = '{"ok": 1}'
        return _R()


class _HangModel:
    def generate_content(self, prompt, generation_config=None):
        # Block via Event, not time.sleep — the test no-ops time.sleep for the
        # retry backoff, and time.sleep is the same stdlib object everywhere.
        threading.Event().wait(2)  # longer than the patched per-call timeout
        class _R:
            text = '{}'
        return _R()


def test_call_returns_parsed_json_on_fast_response():
    assert _client(_OkModel()).call("hi") == {"ok": 1}


def test_call_times_out_then_gives_up_without_hanging(monkeypatch):
    # Tiny timeout + no-op backoff so the 3-attempt retry runs instantly.
    monkeypatch.setattr(gc, "_VERTEX_CALL_TIMEOUT_S", 0.2)
    monkeypatch.setattr(gc.time, "sleep", lambda *_a, **_k: None)

    started = time.monotonic()
    with pytest.raises(TimeoutError):
        _client(_HangModel()).call("hi")
    # Bounded: 3 attempts × ~0.2s ≪ the 2s-per-call hang × 3 it replaces.
    assert time.monotonic() - started < 2.0
