"""
Tests for the document→soupis orchestration + its determinism guarantees.

Hermetic: the four stage tools are replaced at their module-level seams, so
nothing here touches Postgres, the Monolit engine, or an LLM. What is under
test is the *composition* — fixed stage order, honest skip/fail recording, and
a content-addressed run_id that makes a run replayable.
"""

from __future__ import annotations

import pytest

from app.mcp.tools import pipeline as pipe
from app.services.pipeline_run import (
    PIPELINE_VERSION,
    canonical_json,
    content_hash,
    start_run,
)

# ── Fakes for the four stages ───────────────────────────────────────────────

_PASSPORT = {"passport": {"_meta": {"schema": "bridge_passport"}, "elements": {}}}
_PLAN = {
    "mapping": {"elements": [{"element_type": "mostovkova_deska", "volume_m3": 693.35}]},
    "project": {"aggregate": {"total_days": 90.5}},
}
_BREAKDOWN = {"items": [{"work_description": "Beton NK", "unit": "m3", "quantity": 693.35}]}
_SOUPIS = {"deliverable": "soupis_praci", "row_count": 1, "filename": "soupis.xlsx"}


@pytest.fixture
def stub_stages(monkeypatch):
    """Wire all four seams to deterministic fakes; record the call order."""
    calls: list[str] = []

    async def fake_passport(**kwargs):
        calls.append("structure")
        return dict(_PASSPORT)

    async def fake_calculate(passport):
        calls.append("plan")
        return dict(_PLAN)

    async def fake_breakdown(**kwargs):
        calls.append("decompose")
        return dict(_BREAKDOWN)

    async def fake_export(**kwargs):
        calls.append("export")
        return dict(_SOUPIS)

    monkeypatch.setattr(pipe, "_BUILD_PASSPORT", fake_passport)
    monkeypatch.setattr(pipe, "_CALCULATE", fake_calculate)
    monkeypatch.setattr(pipe, "_BREAKDOWN", fake_breakdown)
    monkeypatch.setattr(pipe, "_EXPORT", fake_export)
    return calls


# ── Manifest primitives ─────────────────────────────────────────────────────


def test_canonical_json_is_key_order_independent():
    """Dict insertion order must not change the hash — the classic replay trap."""
    a = {"b": 1, "a": {"y": 2, "x": 3}}
    b = {"a": {"x": 3, "y": 2}, "b": 1}
    assert canonical_json(a) == canonical_json(b)
    assert content_hash(a) == content_hash(b)


def test_run_id_is_content_addressed_and_stable():
    inputs = {"tz_text": "TZ", "project_type": "most"}
    first = start_run(inputs, catalog_version="OTSKP 2026")
    second = start_run(dict(reversed(list(inputs.items()))), catalog_version="OTSKP 2026")
    assert first.run_id == second.run_id
    assert first.run_id.startswith("run-")
    assert first.pipeline_version == PIPELINE_VERSION


def test_run_id_changes_with_inputs_and_with_catalog_version():
    base = {"tz_text": "TZ"}
    a = start_run(base, catalog_version="OTSKP 2026")
    b = start_run({"tz_text": "TZ2"}, catalog_version="OTSKP 2026")
    c = start_run(base, catalog_version="OTSKP 2025_03")
    assert a.run_id != b.run_id, "different inputs must not collide"
    assert a.run_id != c.run_id, "a different catalog vintage is a different result"


def _xlsx_like(sheet_bytes: bytes, *, created: str, zip_date) -> str:
    """Minimal OOXML-shaped archive with a wall clock baked in, base64'd."""
    import base64
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            zipfile.ZipInfo("docProps/core.xml", date_time=zip_date),
            f"<cp:coreProperties><dcterms:created>{created}</dcterms:created>"
            f"</cp:coreProperties>",
        )
        zf.writestr(
            zipfile.ZipInfo("xl/worksheets/sheet1.xml", date_time=zip_date),
            sheet_bytes,
        )
    return base64.b64encode(buf.getvalue()).decode()


def test_export_digest_ignores_the_embedded_clock_but_not_the_content():
    """OOXML bakes in a timestamp; replay must not drift because of it.

    Found by running the pipeline for real — the same rows rendered 7529 vs
    7528 bytes across two invocations (identical within one), which would have
    made `stages_sha256` unreproducible for any run that exports.
    """
    rows = b"<sheetData><row><c><v>693.35</v></c></row></sheetData>"

    early = {"row_count": 1, "file_base64": _xlsx_like(
        rows, created="2026-07-24T18:35:06Z", zip_date=(2026, 7, 24, 18, 35, 6))}
    later = {"row_count": 1, "file_base64": _xlsx_like(
        rows, created="2031-01-01T00:00:00Z", zip_date=(2031, 1, 1, 0, 0, 0))}
    changed = {"row_count": 1, "file_base64": _xlsx_like(
        b"<sheetData><row><c><v>999.99</v></c></row></sheetData>",
        created="2026-07-24T18:35:06Z", zip_date=(2026, 7, 24, 18, 35, 6))}

    d_early = pipe._stable_export_view(early)["content_sha256"]
    d_later = pipe._stable_export_view(later)["content_sha256"]
    d_changed = pipe._stable_export_view(changed)["content_sha256"]

    assert d_early == d_later, "clock movement must not change the digest"
    assert d_early != d_changed, "a changed value MUST change the digest"
    # The volatile blob itself never reaches the manifest.
    assert "file_base64" not in pipe._stable_export_view(early)


# ── Orchestration ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_runs_all_four_stages_in_fixed_order(stub_stages):
    out = await pipe.run_document_to_soupis(
        tz_text="TZ", with_breakdown=True, with_export=True
    )
    assert stub_stages == ["structure", "plan", "decompose", "export"], (
        "stage order is code, not prompt — it must not vary"
    )
    assert out["passport"] == _PASSPORT
    assert out["plan"] == _PLAN
    assert out["breakdown"] == _BREAKDOWN
    assert out["soupis"] == _SOUPIS

    stages = out["manifest"]["stages"]
    assert [s["name"] for s in stages] == ["structure", "plan", "decompose", "export"]
    assert all(s["status"] == "ok" for s in stages)
    # Every executed stage is hashed on both sides — that is the replay unit.
    assert all(s["input_sha256"] and s["output_sha256"] for s in stages)


@pytest.mark.asyncio
async def test_identical_inputs_reproduce_run_id_and_stage_fingerprint(stub_stages):
    """The determinism claim, end to end: two runs, byte-identical identity."""
    kwargs = dict(tz_text="TZ", with_breakdown=True, with_export=True)
    first = await pipe.run_document_to_soupis(**kwargs)
    second = await pipe.run_document_to_soupis(**kwargs)

    assert first["run_id"] == second["run_id"]
    assert first["manifest"]["inputs_sha256"] == second["manifest"]["inputs_sha256"]
    assert (
        first["manifest"]["stages_sha256"] == second["manifest"]["stages_sha256"]
    ), "same inputs must reproduce the same executed chain"


@pytest.mark.asyncio
async def test_optional_stages_are_recorded_as_skipped_with_reason(stub_stages):
    """A stage that did not run is present and explained — never just absent."""
    out = await pipe.run_document_to_soupis(
        tz_text="TZ", with_breakdown=False, with_export=False
    )
    assert stub_stages == ["structure", "plan"]
    by_name = {s["name"]: s for s in out["manifest"]["stages"]}
    assert by_name["decompose"]["status"] == "skipped"
    assert by_name["decompose"]["reason"] == "with_breakdown=False"
    assert by_name["export"]["status"] == "skipped"
    assert "breakdown" not in out and "soupis" not in out


@pytest.mark.asyncio
async def test_export_skipped_when_no_items_rather_than_rendering_empty(monkeypatch, stub_stages):
    async def empty_breakdown(**kwargs):
        stub_stages.append("decompose")
        return {"items": []}

    monkeypatch.setattr(pipe, "_BREAKDOWN", empty_breakdown)
    out = await pipe.run_document_to_soupis(
        tz_text="TZ", with_breakdown=True, with_export=True
    )
    assert "export" not in stub_stages
    by_name = {s["name"]: s for s in out["manifest"]["stages"]}
    assert by_name["export"]["status"] == "skipped"
    assert by_name["export"]["reason"] == "no work items to render"


@pytest.mark.asyncio
async def test_decompose_skipped_when_plan_mapped_no_elements(monkeypatch, stub_stages):
    async def empty_plan(passport):
        stub_stages.append("plan")
        return {"mapping": {"elements": []}, "project": {}}

    monkeypatch.setattr(pipe, "_CALCULATE", empty_plan)
    out = await pipe.run_document_to_soupis(tz_text="TZ", with_breakdown=True)
    by_name = {s["name"]: s for s in out["manifest"]["stages"]}
    assert by_name["decompose"]["status"] == "skipped"
    assert by_name["decompose"]["reason"] == "plan produced no mapped elements"
    assert "decompose" not in stub_stages


# ── Failure policy ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_failing_stage_stops_chain_and_is_reported(monkeypatch, stub_stages):
    async def failing_plan(passport):
        stub_stages.append("plan")
        return {"error": "engine_unavailable", "message": "cold start"}

    monkeypatch.setattr(pipe, "_CALCULATE", failing_plan)
    out = await pipe.run_document_to_soupis(
        tz_text="TZ", with_breakdown=True, with_export=True
    )

    assert out["error"] == "engine_unavailable"
    assert out["stage"] == "plan"
    # Downstream stages must NOT have run — no fabricated numbers past a failure.
    assert "decompose" not in stub_stages and "export" not in stub_stages
    assert "plan" not in out and "breakdown" not in out
    # ...but the stage that DID succeed is still returned: the caller paid for
    # the whole run and should not have to redo finished work. `error` + `stage`
    # keep the incompleteness unmistakable.
    assert out["passport"] == _PASSPORT

    by_name = {s["name"]: s for s in out["manifest"]["stages"]}
    assert by_name["plan"]["status"] == "failed"
    assert by_name["plan"]["reason"] == "engine_unavailable"
    # The manifest still shows how far the run got.
    assert by_name["structure"]["status"] == "ok"
    assert out["run_id"].startswith("run-")


@pytest.mark.asyncio
async def test_failed_export_still_returns_the_finished_breakdown(monkeypatch, stub_stages):
    """A late failure must not throw away three stages the caller paid for.

    Found by running the pipeline for real: the XLSX renderer blew up and the
    response came back with the passport, plan and breakdown discarded, forcing
    a full re-run of work that had already succeeded.
    """
    async def failing_export(**kwargs):
        stub_stages.append("export")
        return {"error": "render_failed", "message": "openpyxl missing"}

    monkeypatch.setattr(pipe, "_EXPORT", failing_export)
    out = await pipe.run_document_to_soupis(
        tz_text="TZ", with_breakdown=True, with_export=True
    )

    assert out["error"] == "render_failed"
    assert out["stage"] == "export"
    # Everything that finished is still in hand.
    assert out["passport"] == _PASSPORT
    assert out["plan"] == _PLAN
    assert out["breakdown"] == _BREAKDOWN
    assert "soupis" not in out
    by_name = {s["name"]: s for s in out["manifest"]["stages"]}
    assert by_name["decompose"]["status"] == "ok"
    assert by_name["export"]["status"] == "failed"


@pytest.mark.asyncio
async def test_failing_first_stage_reports_structure(monkeypatch, stub_stages):
    async def failing_passport(**kwargs):
        stub_stages.append("structure")
        return {"error": "soupis_ref_stale"}

    monkeypatch.setattr(pipe, "_BUILD_PASSPORT", failing_passport)
    out = await pipe.run_document_to_soupis(tz_text="TZ", soupis_ref="soupis-dead")

    assert out["error"] == "soupis_ref_stale"
    assert out["stage"] == "structure"
    assert stub_stages == ["structure"]
