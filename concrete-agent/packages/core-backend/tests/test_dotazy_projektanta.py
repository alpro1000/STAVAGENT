"""Element 24 Wave 3c — §2.11 «Dotazy na projektanta» (AC15).

A conflict between project sources (TZ ↔ výkres ↔ výkaz) is a QUESTION FOR
THE DESIGNER, never silently resolved by the engine: the finding carries
citations of BOTH sources with anchors, a CZK delta priced from the OTSKP DB,
and a FULL engine variant per conflicting class — the calculator computes
both and never picks. Agreement / unreadable values are SILENT. DO-bands
(«do C40/50») containing the project class = sloppy_wording (Pattern 53),
not a priced conflict.

Hermetic: delegate + OTSKP seams monkeypatched — no network/DB/AI.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools import dotazy_projektanta as dp  # noqa: E402
from app.mcp.tools.dotazy_projektanta import (  # noqa: E402
    LEVEL_CHYBA,
    LEVEL_OTAZKA,
    LEVEL_SLOPPY,
    concrete_class_delta_czk,
    detect_concrete_class_findings,
    normalize_concrete_class,
)


def _claim(doc, anchor, cls):
    return {"source_document": doc, "anchor": anchor, "concrete_class": cls}


# ── Detector ──────────────────────────────────────────────────────────────────

def test_tz_vs_drawing_conflict_is_otazka_with_both_citations():
    findings = detect_concrete_class_findings([
        _claim("TZ", "§4.2 str. 12", "C25/30"),
        _claim("výkres D.4.2", "legenda", "C20/25"),
    ])
    assert len(findings) == 1
    f = findings[0]
    assert f["level"] == LEVEL_OTAZKA
    assert f["classes"] == ["C20/25", "C25/30"]
    docs = {s["source_document"] for s in f["sources"]}
    assert docs == {"TZ", "výkres D.4.2"}
    assert all(s["anchor"] for s in f["sources"])  # kotva povinná (§2.11)
    assert "nevybírá" in f["message_cs"]


def test_same_source_contradiction_is_chyba_v_dokumentaci():
    findings = detect_concrete_class_findings([
        _claim("TZ", "§4.2 str. 12", "C25/30"),
        _claim("TZ", "§7.1 str. 34", "C30/37"),
    ])
    assert len(findings) == 1
    assert findings[0]["level"] == LEVEL_CHYBA


def test_do_band_containing_class_is_sloppy_not_conflict():
    # Pattern 53: «Z BET DO C40/50» je pásmo; C35/45 uvnitř ≠ nález-rozpor.
    findings = detect_concrete_class_findings([
        _claim("výkaz", "pos. 421325", "Z BET DO C40/50"),
        _claim("TZ", "§4.2", "C35/45"),
    ])
    assert len(findings) == 1
    assert findings[0]["level"] == LEVEL_SLOPPY


def test_class_above_band_is_real_otazka():
    findings = detect_concrete_class_findings([
        _claim("výkaz", "pos. 421325", "Z BET DO C30/37"),
        _claim("TZ", "§4.2", "C35/45"),
    ])
    assert any(f["level"] == LEVEL_OTAZKA for f in findings)


def test_agreement_and_unreadable_values_are_silent():
    assert detect_concrete_class_findings([
        _claim("TZ", "§4.2", "C25/30"),
        _claim("výkres", "legenda", "beton C 25/30 XF2"),  # same class, noisy text
    ]) == []
    assert detect_concrete_class_findings([
        _claim("TZ", "§4.2", "C25/30"),
        _claim("výkres", "legenda", "viz statika"),  # unreadable → silent
    ]) == []
    assert detect_concrete_class_findings([]) == []


def test_normalize_concrete_class_variants():
    assert normalize_concrete_class("C 25/30 XF2") == "C25/30"
    assert normalize_concrete_class("LC30/33") == "LC30/33"
    assert normalize_concrete_class("viz statika") is None
    assert normalize_concrete_class(None) is None


# ── CZK delta via OTSKP seam ─────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _restore_seam():
    original = dp._FIND_OTSKP
    yield
    dp._FIND_OTSKP = original


@pytest.mark.asyncio
async def test_delta_priced_from_otskp_items():
    prices = {"C20/25": 2800.0, "C25/30": 3100.0}

    async def _fake(query, max_results=5):
        for cls, price in prices.items():
            if cls in query:
                return {"results": [{"code": "272325", "unit_price_czk": price, "confidence": 0.9}]}
        return {"results": []}

    dp._FIND_OTSKP = _fake
    out = await concrete_class_delta_czk("C20/25", "C25/30", 100.0, "uzavreny_ram_tubus")
    assert out["cena_delta_czk"] == 30000.0  # (3100 − 2800) × 100
    assert "delta_formula" in out
    assert out["otskp_items"]["C25/30"]["unit_price_czk"] == 3100.0


@pytest.mark.asyncio
async def test_delta_honest_none_when_item_not_found():
    async def _fake(query, max_results=5):
        return {"results": []}

    dp._FIND_OTSKP = _fake
    out = await concrete_class_delta_czk("C20/25", "C25/30", 100.0, "stena")
    assert out["cena_delta_czk"] is None
    assert "nenalezena" in out["reason"]


@pytest.mark.asyncio
async def test_delta_honest_none_without_volume():
    async def _fake(query, max_results=5):  # pragma: no cover — must not be called
        raise AssertionError("no lookup without volume")

    dp._FIND_OTSKP = _fake
    out = await concrete_class_delta_czk("C20/25", "C25/30", 0, "stena")
    assert out["cena_delta_czk"] is None
    assert "objem" in out["reason"]


@pytest.mark.asyncio
async def test_delta_low_confidence_item_is_not_used():
    # Below the binding floor there is no reliable item — the delta must be
    # honest None, never a number from a speed-bump-class mismatch.
    async def _fake(query, max_results=5):
        return {"results": [{"code": "999999", "unit_price_czk": 1.0, "confidence": 0.2}]}

    dp._FIND_OTSKP = _fake
    out = await concrete_class_delta_czk("C20/25", "C25/30", 100.0, "stena")
    assert out["cena_delta_czk"] is None
