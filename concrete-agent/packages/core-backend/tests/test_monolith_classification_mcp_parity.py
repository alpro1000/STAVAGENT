"""
Gate 6 of the monolith-classification spec (ADR-007): MCP classify parity.

The spec unified MONOLITH classification (marka / prefab / sub-role) in the
Monolit-Planner shared package — a DIFFERENT axis from this classifier's
element-TYPE matching. Gates 2–5 touched no concrete-agent file, so the W3
outputs must be bit-identical to the pre-spec goldens; this suite pins that
(and one documented gap) so any future drift is conscious.

Runs WITHOUT fastmcp / pytest-asyncio — same discipline as
test_mcp_golden_so250.py: plain sync tests over the real coroutine through
asyncio.run, no app.mcp.server import.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.classifier import classify_construction_element


def _classify(name: str, object_code: str | None = None) -> dict:
    return asyncio.run(classify_construction_element(name, object_code=object_code))


def test_parity_pier_golden_unchanged():
    """Compat golden (test_classifier_pilir) via direct call — unchanged."""
    data = _classify("Mostní pilíře P2-P3, C35/45")
    assert data["element_type"] == "driky_piliru"
    assert data["confidence"] > 0.5


def test_parity_rimsa_golden_unchanged():
    """Compat golden (test_classifier_rimsa) via direct call — unchanged."""
    data = _classify("Římsy monolitické, C30/37")
    assert data["element_type"] == "rimsa"


def test_parity_zaklady_family():
    """The engine-side spec fixtures classify into the zaklady family here."""
    data = _classify("ZÁKLADY ZE ŽELEZOBETONU DO C25/30")
    assert data["element_type"].startswith("zaklady")
    assert data.get("is_concrete_element", True) is True


def test_documented_gap_no_prefab_axis_yet():
    """
    PINNED GAP (Gate 0 audit + ADR-007 §5): the W3 classifier has NO
    monolith/prefab axis — «PATKY Z DÍLCŮ C25/30» (precast!) classifies as a
    concrete element type today. The shared engine-side classifier vetoes it
    (is_monolith=false, is_prefab=true); the MCP tool is planned to gain the
    same axis ADDITIVELY (new output fields, existing fields untouched).

    This test pins TODAY'S behavior so that landing the additive axis is a
    conscious change: when is_prefab/is_monolith fields appear here, update
    this test to assert them instead.
    """
    data = _classify("PATKY Z DÍLCŮ C25/30")
    assert data.get("is_concrete_element", True) is True  # no prefab veto yet
    assert "is_prefab" not in data                        # axis not added yet
    assert data["element_type"].startswith("zaklady")     # typed as foundations
