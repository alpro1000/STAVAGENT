"""Golden (P2): documents → quantified elements[] → deliverable, end-to-end.

Proves the DOCUMENT_ANALYSIS wiring built in P2:
  - the step calls extract_tz_fields + parse_construction_budget, runs the P1
    soupis→element JOIN, and caches quantified elements[] + quantification_summary;
  - WORK_ATOMIZATION consumes the EXTRACTED volume (no caller-supplied elements);
  - honest-blank elements thread through;
  - a soupis↔TZ volume divergence reaches the COMMITTED deliverable as an INGEST
    warning with `origin: "ingest:soupis_vs_geometry"` — pin A — and is NEVER
    folded into the calculator's `calc_warnings` (distinct identity);
  - a consistent-geometry control raises no false divergence;
  - back-compat: with no documents, WORK_ATOMIZATION still uses options['elements'].

Hermetic + offline: the two document tools and the Monolit engine are MOCKED at
their seams (no live service, no real parser/extractor — those have their own
goldens). The JOIN + classifier (_classify) run for real. Plain sync test_* (no
asyncio marker, no fastmcp import); a missing dep ERRORS rather than skips.
"""

import base64
import json
import os
import sys
from uuid import uuid4

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.stage_gating import (
    InMemorySessionRepository,
    OrchestrateRequest,
    SessionManager,
    StageGatingOrchestrator,
    load_workflow_config,
)
from app.services.stage_gating.orchestrator import STATUS_COMPLETED
from app.services.stage_gating.recipe_runner import make_recipe_tool_runner

CFG = load_workflow_config()

DECK = "NK mostovka"
OBJECT = {
    "object_code": "SO-202",
    "object_name": "Most na sil. I/6 přes Lomnický potok",
    "charakteristika": "Trvalý dálniční most o třech polích.",
}

# Distinctive engine numbers — if the live engine leaked instead of the mock the
# assertions would fail loudly, not silently pass.
FAKE_PLANNER_OUTPUT = {
    "total_days": 1234, "num_tacts": 7,
    "resources": {"pour_crew_breakdown": {"ukladani": 8}},
    "warnings": ["⚠️ TEST: mostovka NK vyžaduje pevnou skruž"],
    "source": "monolit_planner_api",
}

SOUPIS_B64 = base64.b64encode(b"dummy-soupis-xlsx-bytes").decode("ascii")

# nk_width 70 m → expected ≈ 120×70×0.5 = 4200 m³, soupis 605 → ratio 0.14 → CRITICAL
DIVERGENT_GEO = {"num_spans": 6, "total_span_length_m": 120, "nk_width_m": 70,
                 "cross_section_type": "deskovy"}
# nk_width 12 m → expected = 720 m³, ratio 0.84 ∈ [0.7,1.5] → consistent
CONSISTENT_GEO = {"num_spans": 6, "total_span_length_m": 120, "nk_width_m": 12,
                  "cross_section_type": "deskovy"}
DOCS = {"tz_text": "(mocked TZ)", "soupis_file_base64": SOUPIS_B64,
        "soupis_filename": "soupis.xlsx"}


def _tz_elements():
    src = {"volume_m3": {"status": "stage_2", "confidence": 0.0}}
    return [
        {"name": DECK, "object_code": "SO-202", "volume_m3": None,
         "concrete_class": "C35/45", "is_prestressed": True, "span_m": 20,
         "num_spans": 6, "_source": dict(src)},
        # no soupis match → honest-blank
        {"name": "Římsa monolitická", "object_code": "SO-202", "volume_m3": None,
         "concrete_class": "C30/37", "_source": dict(src)},
    ]


def _budget_items():
    return [
        {"code": "27 33", "description": "Mostovka železobeton C35/45",
         "unit": "m3", "quantity": 605},
        {"code": "45 11", "description": "Bednění mostovky", "unit": "m2",
         "quantity": 547},  # m2 → never a volume
    ]


@pytest.fixture
def mocks(monkeypatch):
    import app.mcp.tools.budget as bud
    import app.mcp.tools.extract_tz_fields as etz
    import app.mcp.tools.monolit_delegate as md

    captured = {"soupis_b64": None, "calc_payloads": []}
    holder = {"geometry": None}

    async def fake_extract(text=None, file_base64=None, filename=""):
        return {"object": {"object_code": "SO-202", "geometry": holder["geometry"]},
                "elements": _tz_elements()}

    async def fake_budget(file_base64, filename):
        captured["soupis_b64"] = file_base64
        return {"items": _budget_items(), "total_items": 2}

    async def fake_post(path, payload):
        if path == "/api/calculate":
            captured["calc_payloads"].append(payload)
            return 200, dict(FAKE_PLANNER_OUTPUT)
        raise AssertionError(f"unexpected delegation path: {path}")

    monkeypatch.setattr(etz, "extract_tz_fields", fake_extract)
    monkeypatch.setattr(bud, "parse_construction_budget", fake_budget)
    monkeypatch.setattr(md, "_http_post", fake_post)
    monkeypatch.setattr(md, "_RETRY_BACKOFF_S", 0)
    return captured, holder


class _FakeStore:
    def __init__(self):
        self.data = {}

    def loader(self, project_id):
        return self.data.get(project_id), f"/fake/{project_id}"

    def saver(self, project_id, field, value):
        self.data.setdefault(project_id, {})[field] = value


def _run(mocks, *, documents=None, elements=None, geometry=None):
    _captured, holder = mocks
    holder["geometry"] = geometry
    store, repo = _FakeStore(), InMemorySessionRepository()
    runner = make_recipe_tool_runner(
        CFG, decider=lambda c: {"action": "proceed"},
        loader=store.loader, saver=store.saver,
    )
    orch = StageGatingOrchestrator(
        manager=SessionManager(repo, config=CFG), config=CFG, tool_runner=runner
    )
    options = {"object": dict(OBJECT)}
    if documents is not None:
        options["documents"] = documents
    if elements is not None:
        options["elements"] = elements
    res = orch.run(OrchestrateRequest(
        user_id=uuid4(), project_id=uuid4(), options=options, confirmation_token="ok",
    ))
    return res, repo


def _partials(repo, res, state_value):
    state = repo.get(res.session_id)
    return (state.partials.get(state_value) or {}) if state else {}


# ── the join runs in DOCUMENT_ANALYSIS: elements get quantified ───────────────
def test_document_analysis_quantifies_elements_from_soupis(mocks):
    res, repo = _run(mocks, documents=DOCS, geometry=DIVERGENT_GEO)
    assert res.status == STATUS_COMPLETED, res.error
    da = _partials(repo, res, "DOCUMENT_ANALYSIS")
    deck = next(e for e in da["elements"] if e["name"] == DECK)
    assert deck["volume_m3"] == 605                       # filled by the join
    assert deck["quantity_status"] == "extracted"
    assert deck["_source"]["volume_m3"]["source"] == "soupis"
    # honest-blank element kept, never dropped
    rimsa = next(e for e in da["elements"] if e["name"].startswith("Římsa"))
    assert rimsa["volume_m3"] is None
    assert rimsa["quantity_status"] == "missing"
    assert da["quantification_summary"]["extracted"] == 1
    assert da["quantification_summary"]["missing"] == 1
    # the DA step really called both document tools
    assert mocks[0]["soupis_b64"] == SOUPIS_B64           # soupis base64 forwarded


# ── WORK_ATOMIZATION consumes the EXTRACTED volume (no caller elements) ────────
def test_extracted_volume_drives_atomization(mocks):
    # options carries ONLY documents — no 'elements'. A computed deck work-item can
    # therefore ONLY come from the DA-extracted, join-quantified elements.
    res, repo = _run(mocks, documents=DOCS, geometry=DIVERGENT_GEO)
    items = _partials(repo, res, "WORK_ATOMIZATION")["breakdown_items"]
    deck_items = [it for it in items if it.get("element_name") == DECK]
    assert deck_items, "deck produced no work items — DA elements did not reach atomize"
    assert all(it["calc_status"] == "computed" for it in deck_items)
    # the extracted 605 m³ reached the calculator payload (not a caller value)
    captured = mocks[0]
    assert captured["calc_payloads"], "calculator was never called"
    assert any("605" in json.dumps(p) for p in captured["calc_payloads"])


# ── pin A: divergence reaches the COMMITTED deliverable, ingest identity ──────
def test_divergence_reaches_deliverable_as_ingest_warning(mocks):
    res, repo = _run(mocks, documents=DOCS, geometry=DIVERGENT_GEO)
    da = _partials(repo, res, "DOCUMENT_ANALYSIS")
    assert da["quantification_summary"]["divergent"] == 1

    committed = _partials(repo, res, "COMMITTED")
    qw = committed.get("quantification_warnings")
    assert qw, "divergence warning did NOT reach the deliverable (pin A regression)"
    entry = qw[0]
    assert entry["origin"] == "ingest:soupis_vs_geometry"   # distinct ingest identity
    assert entry["severity"] == "critical"
    assert entry["element_name"] == DECK
    assert "605" in entry["message"] and "4200" in entry["message"]
    # MUST NOT masquerade as a calc-warning: the calc rail carries only the engine
    # warning (a plain string), never the ingest dict.
    assert committed.get("calc_warnings") == FAKE_PLANNER_OUTPUT["warnings"]
    assert entry not in (committed.get("calc_warnings") or [])
    assert committed.get("quantification_summary", {}).get("divergent") == 1


# ── control: consistent geometry → no false divergence warning ───────────────
def test_consistent_geometry_no_false_divergence(mocks):
    res, repo = _run(mocks, documents=DOCS, geometry=CONSISTENT_GEO)
    da = _partials(repo, res, "DOCUMENT_ANALYSIS")
    assert da["quantification_summary"]["divergent"] == 0
    assert "quantification_warnings" not in da
    committed = _partials(repo, res, "COMMITTED")
    assert not committed.get("quantification_warnings")
    # the calc rail is unaffected — engine warning still rides through
    assert committed.get("calc_warnings") == FAKE_PLANNER_OUTPUT["warnings"]


# ── back-compat: no documents → WORK_ATOMIZATION uses options['elements'] ────
def test_backcompat_no_documents_uses_options_elements(mocks):
    elements = [{"name": DECK, "object_code": "SO-202", "volume_m3": 605,
                 "concrete_class": "C35/45", "span_m": 20, "num_spans": 6}]
    res, repo = _run(mocks, elements=elements, geometry=None)  # no documents
    assert res.status == STATUS_COMPLETED, res.error
    da = _partials(repo, res, "DOCUMENT_ANALYSIS")
    assert "elements" not in da                       # DA produced no quantified list
    assert "quantification_warnings" not in da
    items = _partials(repo, res, "WORK_ATOMIZATION")["breakdown_items"]
    assert any(it.get("element_name") == DECK for it in items)  # caller elements used
    # the two document tools were never called (no documents)
    assert mocks[0]["soupis_b64"] is None
