"""HOTFIX-1 (2026-07-16) — canonical TZ→calculator-field extraction route.

`POST /api/v1/tz/extract-calculator-fields` replaces the free-form chat path.
Force-JSON transport: a valid JSON array → {params}; a `raw_text` payload
(model ignored the mime / max_tokens cutoff) → typed `ai_invalid_json` (422),
never a 500 or a fabricated empty list; an LLM exception → `llm_unavailable`
(502). The `_LLM` seam is monkeypatched so tests stay hermetic (no Vertex).
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.api import routes_tz_extract as rt  # noqa: E402


def _app():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(rt.router)
    return TestClient(app)


@pytest.fixture(autouse=True)
def _restore_llm():
    original = rt._LLM
    yield
    rt._LLM = original


def test_success_bare_array_returns_params():
    rt._LLM = lambda prompt: [
        {"field": "concrete_class", "value": "C30/37", "quote": "C30/37", "confidence": 0.9},
        {"field": "height_m", "value": 3.0, "quote": "výška 3,0 m", "confidence": 0.85},
    ]
    r = _app().post("/api/v1/tz/extract-calculator-fields",
                    json={"prompt": "P", "element_type": "stena"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["params"]) == 2
    assert body["params"][0]["field"] == "concrete_class"


def test_success_object_wrapping_array():
    rt._LLM = lambda prompt: {"params": [{"field": "volume_m3", "value": 10, "confidence": 0.8}]}
    r = _app().post("/api/v1/tz/extract-calculator-fields",
                    json={"prompt": "P", "element_type": "stena"})
    assert r.status_code == 200
    assert r.json()["params"][0]["field"] == "volume_m3"


def test_raw_text_payload_is_typed_ai_invalid_json():
    # Force-JSON still truncated / model returned prose → client gives {"raw_text": ...}.
    rt._LLM = lambda prompt: {"raw_text": "Bohužel: [ {\"field\": \"height_m\""}
    r = _app().post("/api/v1/tz/extract-calculator-fields",
                    json={"prompt": "P", "element_type": "stena"})
    assert r.status_code == 422
    assert r.json()["error"] == "ai_invalid_json"


def test_empty_dict_is_typed_ai_invalid_json_not_500():
    rt._LLM = lambda prompt: {}
    r = _app().post("/api/v1/tz/extract-calculator-fields",
                    json={"prompt": "P", "element_type": "stena"})
    assert r.status_code == 422
    assert r.json()["error"] == "ai_invalid_json"


def test_llm_exception_is_typed_llm_unavailable_not_500():
    def _boom(prompt):
        raise RuntimeError("vertex timeout")

    rt._LLM = _boom
    r = _app().post("/api/v1/tz/extract-calculator-fields",
                    json={"prompt": "P", "element_type": "stena"})
    assert r.status_code == 502
    assert r.json()["error"] == "llm_unavailable"
    assert "vertex timeout" in r.json()["message"]


def test_schema_validation_rejects_empty_prompt():
    r = _app().post("/api/v1/tz/extract-calculator-fields",
                    json={"prompt": "", "element_type": "stena"})
    assert r.status_code == 422  # pydantic min_length


def test_json_mode_flag_passed_to_vertex(monkeypatch):
    """The default seam must call VertexGeminiClient with json_mode=True
    (force-JSON canon). Pin it so a refactor can't silently drop the flag."""
    calls = {}

    class _FakeClient:
        def call(self, prompt, temperature=0.3, json_mode=False):
            calls["json_mode"] = json_mode
            calls["temperature"] = temperature
            return []

    import app.core.gemini_client as gc
    monkeypatch.setattr(gc, "VertexGeminiClient", _FakeClient)
    out = rt._default_llm("some prompt")
    assert out == []
    assert calls["json_mode"] is True
    assert calls["temperature"] == 0.1
