"""half-B review fixes: the Vertex LLM seam of extract_tz_fields.

Covers the gate (explicit-off kill switch on Cloud Run, VERTEX_AVAILABLE
guard) and the dict-tolerance parse (prefer "elements", never let a leading
"poznamky": [...] shadow it). No network — VertexGeminiClient is monkeypatched;
the gate reads env + the module-level VERTEX_AVAILABLE at call time.
"""

from app.mcp.tools import extract_tz_fields as ex


def test_explicit_off_wins_even_on_cloud_run(monkeypatch):
    monkeypatch.setenv("K_SERVICE", "some-service")   # Cloud Run auto-on…
    monkeypatch.setenv("TZ_LLM_FALLBACK", "0")         # …but explicit off wins
    monkeypatch.setattr("app.core.gemini_client.VERTEX_AVAILABLE", True, raising=False)
    assert ex._make_vertex_llm() is None


def test_off_when_vertex_unavailable(monkeypatch):
    monkeypatch.setenv("TZ_LLM_FALLBACK", "1")
    monkeypatch.delenv("K_SERVICE", raising=False)
    monkeypatch.setattr("app.core.gemini_client.VERTEX_AVAILABLE", False, raising=False)
    assert ex._make_vertex_llm() is None


def test_on_with_flag_and_vertex_available(monkeypatch):
    monkeypatch.setenv("TZ_LLM_FALLBACK", "1")
    monkeypatch.delenv("K_SERVICE", raising=False)
    monkeypatch.setattr("app.core.gemini_client.VERTEX_AVAILABLE", True, raising=False)
    assert callable(ex._make_vertex_llm())


def test_dict_tolerance_prefers_elements_over_leading_list(monkeypatch):
    monkeypatch.setenv("TZ_LLM_FALLBACK", "1")
    monkeypatch.setattr("app.core.gemini_client.VERTEX_AVAILABLE", True, raising=False)

    class _FakeClient:
        def call(self, *a, **k):
            # a non-compliant wrapped response with a decoy list FIRST
            return {"poznamky": ["viz TZ"],
                    "elements": [{"name": "NK", "concrete_class": "C35/45"}]}

    monkeypatch.setattr("app.core.gemini_client.VertexGeminiClient", _FakeClient)
    llm = ex._make_vertex_llm()
    assert llm("nějaká murky materiálová sekce") == [
        {"name": "NK", "concrete_class": "C35/45"}]


def test_bare_list_response_passes_through(monkeypatch):
    monkeypatch.setenv("TZ_LLM_FALLBACK", "1")
    monkeypatch.setattr("app.core.gemini_client.VERTEX_AVAILABLE", True, raising=False)

    class _FakeClient:
        def call(self, *a, **k):
            return [{"name": "Dřík", "concrete_class": "C35/45"}, "junk"]

    monkeypatch.setattr("app.core.gemini_client.VertexGeminiClient", _FakeClient)
    llm = ex._make_vertex_llm()
    assert llm("sekce") == [{"name": "Dřík", "concrete_class": "C35/45"}]
