"""
half-B Gate 5 golden: build_bridge_passport — documents → passport E2E.

Runs the REAL stage-1 extractor (deterministic, synthetic page-marked TZ in
the same shape the extract_tz_fields golden uses) + the REAL live classifier
+ the REAL assembler; the soupis stage is monkeypatched at the
parse_construction_budget seam (budget parsing has its own suites — this
golden pins the COMPOSITION). Structure-level grounding against the
hand-built example_SO202_zalmanov.json: same schema, quantity keys ⊆ the
example's key set (never inventing keys the ratified fixture doesn't know).

Sync-over-coroutine discipline (no fastmcp import) + one transport test at
the bottom (importorskip fastmcp — MCP CI lane).
"""

import asyncio
import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.passport_build import build_bridge_passport
from app.models.bridge_passport import BridgePassport

_FIXTURE = (
    Path(__file__).resolve().parents[3]
    / ".." / "docs" / "specs" / "tz-passport-json" / "example_SO202_zalmanov.json"
).resolve()

TZ_TEXT = """--- PAGE 1 ---
A. ZÁKLADNÍ ÚDAJE
Stavba: D6, úsek Lomnice
Název objektu: SO 202 – Most na sil. I/6 přes Lomnický potok
Stupeň: DSP

B. CHARAKTERISTIKA MOSTU
Trvalý dálniční most o třech polích. Spojitá předpjatá deska.

C. SPECIFIKACE BETONU – MATERIÁLY
Nosná konstrukce (NK) C35/45 XF2
Dřík C35/45 XF4
Základy C25/30 XA2
Výztuž B500B
--- PAGE 2 ---
(výkresy)
"""

_SOUPIS_ITEMS = {
    "items": [
        {"code": "421321109", "description": "Nosná konstrukce mostovka železobeton",
         "unit": "m3", "quantity": 2697.941},
        {"code": "421361109", "description": "VÝZTUŽ NOSNÉ KONSTRUKCE B500B",
         "unit": "t", "quantity": 468.886},
    ],
    "total_items": 2, "format_detected": "soupis", "diagnostics": {},
}


def _build(**kw):
    return asyncio.run(build_bridge_passport(**kw))


def test_e2e_tz_only_emits_valid_passport_with_honest_gaps():
    out = _build(tz_text=TZ_TEXT)
    assert "error" not in out
    p = out["passport"]
    BridgePassport.model_validate(p)
    assert p["_meta"]["schema"] == "tz-bridge-passport"
    # no soupis → every element honestly without quantities
    assert any("no soupis" in g for g in out["gaps"])
    assert all("volume_m3" not in it for it in p["quantities"]["items"])
    # stage-2 fields declared as gaps, never fabricated
    assert any("construction_process" in g for g in out["gaps"])


def test_e2e_with_soupis_quantities_and_example_grounding(monkeypatch):
    import app.mcp.tools.passport_build as pb

    async def fake_budget(**kw):
        return dict(_SOUPIS_ITEMS)

    # patch at the import site (lazy import inside the tool)
    import app.mcp.tools.budget as budget_mod
    monkeypatch.setattr(budget_mod, "parse_construction_budget", fake_budget)

    out = _build(tz_text=TZ_TEXT, soupis_file_base64="ZmFrZQ==",
                 soupis_filename="soupis.xlsx")
    assert "error" not in out
    p = out["passport"]
    BridgePassport.model_validate(p)

    items = {it["element"]: it for it in p["quantities"]["items"]}
    assert items["superstructure_deck"]["volume_m3"] == pytest.approx(2697.941)
    assert items["superstructure_deck"]["rebar_mass_kg"] == pytest.approx(468886.0)

    # Structure grounding: keys ⊆ the ratified hand-built example's key set
    example = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    example_keys = {it["element"] for it in example["quantities"]["items"]}
    assert set(items.keys()) <= example_keys
    uses = {c["use"] for c in p["materials_and_standards"]["concretes"]}
    example_uses = {c["use"] for c in example["materials_and_standards"]["concretes"]}
    assert "superstructure_deck" in uses
    # every emitted use the example also knows OR is a quantities key
    assert uses <= (example_uses | example_keys)


def test_verified_note_fragment_lands_and_clears_the_gap():
    frag = {"deck_pour_stages": 3,
            "deck_pour_stages_source": "výkres 202/17 POZN. 3",
            "falsework_technology": "fixed_scaffolding"}
    out = _build(tz_text=TZ_TEXT, construction_process=frag)
    p = out["passport"]
    BridgePassport.model_validate(p)
    assert p["construction_process"] == frag
    assert not any(g.startswith("construction_process") for g in out["gaps"])


def test_typed_errors_are_json_safe():
    out = _build()  # no TZ at all
    assert out["error"] == "tz_extraction_failed"
    json.dumps(out)  # transport rule — never a live object inside

    out2 = _build(tz_text=TZ_TEXT, soupis_file_base64="!!!not-base64!!!",
                  soupis_filename="soupis.xlsx")
    assert out2["error"] == "soupis_parse_failed"
    json.dumps(out2)


def test_store_persistence_roundtrip(tmp_path, monkeypatch):
    from app.core.config import settings
    from app.services import bridge_passport_store

    monkeypatch.setattr(settings, "PROJECT_DIR", tmp_path)
    bridge_passport_store._memory.clear()
    out = _build(tz_text=TZ_TEXT, passport_id="SO-202-test")
    assert out["stored"] is True
    bridge_passport_store._memory.clear()
    assert bridge_passport_store.get("SO-202-test") == out["passport"]


# ── transport (MCP CI lane; skipped locally without fastmcp) ─────────────────

def test_typed_error_survives_fastmcp_transport():
    fastmcp = pytest.importorskip("fastmcp")
    from fastmcp import Client, FastMCP

    mcp = FastMCP("passport-build-transport-test")
    mcp.tool()(build_bridge_passport)

    async def _run():
        async with Client(mcp) as c:
            return await c.call_tool("build_bridge_passport", {})

    res = asyncio.run(_run())
    assert res.is_error is False
    assert res.structured_content["error"] == "tz_extraction_failed"
