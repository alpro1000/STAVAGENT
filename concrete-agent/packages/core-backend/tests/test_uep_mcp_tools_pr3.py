"""MCP read-only inspection tools — PR3 §14.3."""

from __future__ import annotations

import pytest

from app.mcp.tools.uep import (
    uep_get_coverage_matrix,
    uep_get_dwg_conversion_status,
    uep_get_job,
    uep_get_reconciliation_rules,
    uep_list_supported_formats,
)


@pytest.mark.asyncio
async def test_list_supported_formats_includes_pr3_additions() -> None:
    out = await uep_list_supported_formats()
    assert "formats" in out
    assert "count" in out
    fmts = set(out["formats"])
    for required in {"dxf", "pdf_tz", "dwg", "ifc", "xml_unixml", "xml_landxml"}:
        assert required in fmts, f"missing {required}"


@pytest.mark.asyncio
async def test_get_job_returns_not_found_for_unknown_id() -> None:
    out = await uep_get_job("definitely-not-a-real-uuid")
    assert out["error"] == "not_found"


@pytest.mark.asyncio
async def test_get_job_rejects_empty_id() -> None:
    out = await uep_get_job("")
    assert "error" in out


@pytest.mark.asyncio
async def test_get_coverage_matrix_rejects_unknown_type() -> None:
    out = await uep_get_coverage_matrix("zoo")
    assert out["error"] == "invalid_project_type"
    assert "bridge" in out["allowed"]


@pytest.mark.asyncio
@pytest.mark.parametrize("pt", ["residential", "bridge", "road", "industrial"])
async def test_get_coverage_matrix_returns_valid_payload(pt: str) -> None:
    out = await uep_get_coverage_matrix(pt)
    assert "version" in out, out
    assert out["project_type"] == pt
    assert isinstance(out["requirements"], list)
    assert len(out["requirements"]) >= 10


@pytest.mark.asyncio
async def test_get_reconciliation_rules_returns_summary() -> None:
    out = await uep_get_reconciliation_rules("bridge")
    assert out["project_type"] == "bridge"
    assert out["count"] >= 10
    # Each rule entry must carry the schema fields the MCP UI relies on.
    for r in out["rules"]:
        assert {"id", "description", "severity", "tolerance_type"} <= set(r)


@pytest.mark.asyncio
async def test_dwg_conversion_status_returns_advisory() -> None:
    """Probe is environment-aware — assert the shape, not the values."""

    out = await uep_get_dwg_conversion_status()
    assert isinstance(out["oda_available"], bool)
    assert isinstance(out["libredwg_available"], bool)
    assert isinstance(out["any_available"], bool)
    assert isinstance(out["advisory"], str)
    # When neither binary is on PATH (CI / sandbox), advisory must
    # mention DWG_CONVERSION_FAILED so operators know the symptom.
    if not out["any_available"]:
        assert "DWG_CONVERSION_FAILED" in out["advisory"]
