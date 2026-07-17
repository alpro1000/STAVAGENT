"""Element 24 Wave 3c — §2.11 integration in calculate_concrete_works (AC15).

When the caller supplies `concrete_class_sources` and the sources conflict,
the calculate result must gain a `dotazy_na_projektanta` section: citations
of both sources with anchors, a full engine VARIANT per conflicting class
(the engine computes BOTH — the main plan stays on the caller's explicit
concrete_class, never a silent engine pick), and the OTSKP CZK delta.
Agreement / absent sources → no section at all.

Hermetic: delegate_calculate + the OTSKP seam are monkeypatched.
"""
import pytest

import app.mcp.tools.calculator as calc
from app.mcp.tools import dotazy_projektanta as dp


SOURCES_CONFLICT = [
    {"source_document": "TZ", "anchor": "§4.2 str. 12", "concrete_class": "C25/30"},
    {"source_document": "výkres D.4.2", "anchor": "legenda", "concrete_class": "C20/25"},
]


@pytest.fixture(autouse=True)
def _restore_otskp_seam():
    original = dp._FIND_OTSKP
    yield
    dp._FIND_OTSKP = original


def _wire(monkeypatch, prices=None):
    """Delegate returns a plan echoing its concrete_class (so variants are
    distinguishable); OTSKP seam prices per class."""
    calls = []

    async def fake_delegate(payload):
        calls.append(payload)
        return {
            "element": {"concrete_class": payload["concrete_class"]},
            "costs": {"total_czk": 1000.0},
        }

    monkeypatch.setattr(calc, "delegate_calculate", fake_delegate)

    prices = prices or {"C20/25": 2800.0, "C25/30": 3100.0}

    async def fake_find(query, max_results=5):
        for cls, price in prices.items():
            if cls in query:
                return {"results": [
                    {"code": "272325", "unit_price_czk": price, "confidence": 0.9}
                ]}
        return {"results": []}

    dp._FIND_OTSKP = fake_find
    return calls


@pytest.mark.asyncio
async def test_conflict_yields_section_with_variant_and_delta(monkeypatch):
    calls = _wire(monkeypatch)
    result = await calc.calculate_concrete_works(
        element_type="stena",
        volume_m3=100.0,
        concrete_class="C25/30",
        concrete_class_sources=SOURCES_CONFLICT,
    )
    section = result["dotazy_na_projektanta"]
    assert len(section) == 1
    f = section[0]
    assert f["level"] == "otazka_na_projektanta"
    assert {s["source_document"] for s in f["sources"]} == {"TZ", "výkres D.4.2"}

    # Engine computed BOTH variants: main call (C25/30) + variant (C20/25).
    assert len(calls) == 2
    assert calls[0]["concrete_class"] == "C25/30"  # main = caller's explicit input
    assert calls[1]["concrete_class"] == "C20/25"
    assert f["main_variant_class"] == "C25/30"
    assert f["variants"][0]["concrete_class"] == "C20/25"
    assert f["variants"][0]["plan"]["element"]["concrete_class"] == "C20/25"

    # Cenová delta z OTSKP: (3100 − 2800) × 100.
    assert f["cena_delta"]["cena_delta_czk"] == 30000.0


@pytest.mark.asyncio
async def test_agreeing_sources_are_silent(monkeypatch):
    calls = _wire(monkeypatch)
    result = await calc.calculate_concrete_works(
        element_type="stena",
        volume_m3=100.0,
        concrete_class="C25/30",
        concrete_class_sources=[
            {"source_document": "TZ", "anchor": "§4.2", "concrete_class": "C25/30"},
            {"source_document": "výkres", "anchor": "legenda", "concrete_class": "C 25/30 XF2"},
        ],
    )
    assert "dotazy_na_projektanta" not in result or result["dotazy_na_projektanta"] == []
    assert len(calls) == 1  # no variant runs


@pytest.mark.asyncio
async def test_no_sources_no_section(monkeypatch):
    _wire(monkeypatch)
    result = await calc.calculate_concrete_works(
        element_type="stena", volume_m3=100.0, concrete_class="C25/30",
    )
    assert "dotazy_na_projektanta" not in result


@pytest.mark.asyncio
async def test_variant_leg_failure_degrades_honestly(monkeypatch):
    # The variant re-run failing must NOT kill the main result — the finding
    # carries a typed error for that leg instead of a fabricated plan.
    calls = []

    async def flaky_delegate(payload):
        calls.append(payload)
        if payload["concrete_class"] == "C20/25":
            raise calc.EngineDelegationError("variant leg down", status=503)
        return {"element": {"concrete_class": payload["concrete_class"]}}

    monkeypatch.setattr(calc, "delegate_calculate", flaky_delegate)

    async def fake_find(query, max_results=5):
        return {"results": [{"code": "272325", "unit_price_czk": 3000.0, "confidence": 0.9}]}

    dp._FIND_OTSKP = fake_find

    result = await calc.calculate_concrete_works(
        element_type="stena",
        volume_m3=100.0,
        concrete_class="C25/30",
        concrete_class_sources=SOURCES_CONFLICT,
    )
    f = result["dotazy_na_projektanta"][0]
    assert f["variants"][0]["plan"] is None
    assert f["variants"][0]["error"]  # typed error, not silence
    assert result["element"]["concrete_class"] == "C25/30"  # main plan intact


@pytest.mark.asyncio
async def test_sloppy_band_finding_carries_no_variants(monkeypatch):
    calls = _wire(monkeypatch)
    result = await calc.calculate_concrete_works(
        element_type="stena",
        volume_m3=100.0,
        concrete_class="C35/45",
        concrete_class_sources=[
            {"source_document": "výkaz", "anchor": "pos. 421325", "concrete_class": "Z BET DO C40/50"},
            {"source_document": "TZ", "anchor": "§4.2", "concrete_class": "C35/45"},
        ],
    )
    section = result["dotazy_na_projektanta"]
    assert len(section) == 1
    assert section[0]["level"] == "sloppy_wording"
    assert "variants" not in section[0]  # pásmo ≠ oceněný rozpor (Pattern 53)
    assert len(calls) == 1  # no variant runs
