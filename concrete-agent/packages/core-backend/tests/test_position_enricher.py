import sys
import types
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.normalization import extract_entities, normalize_text
from app.services.position_enricher import PositionEnricher


@pytest.fixture()
def dummy_kb() -> types.SimpleNamespace:
    return types.SimpleNamespace(
        kb_b1={
            "otskp": {
                "AAA-001": {
                    "code": "AAA-001",
                    "name": "Beton C20/25 základová deska",
                    "unit": "m3",
                    "tech_spec": "C20/25 XC2",
                },
                "BBB-002": {
                    "code": "BBB-002",
                    "name": "Výkopové práce",
                    "unit": "m2",
                    "tech_spec": "",
                },
            }
        }
    )


def test_normalize_text_squashes_spaces_and_accents() -> None:
    assert normalize_text("  Čerstvý   Beton ") == "cerstvy beton"


def test_extract_entities_detects_patterns() -> None:
    entities = extract_entities("Beton C30/37 XF2 m3 Ø16")
    assert "C30/37" in entities["concretes"]
    assert "XF2" in entities["exposures"]
    assert "m3" in entities["units"]


def test_enricher_exact_match_by_code(dummy_kb: types.SimpleNamespace) -> None:
    enricher = PositionEnricher(enabled=True, kb_loader=dummy_kb)
    positions = [{"code": "AAA-001", "description": "Beton C20/25", "unit": "m3"}]

    enriched, stats = enricher.enrich(positions, drawing_payload=[])
    assert stats["matched"] == 1
    block = enriched[0]["enrichment"]
    assert block["match"] == "exact"
    assert block["score"] == 1.0
    assert block["evidence"]


def test_enricher_partial_without_exposure(dummy_kb: types.SimpleNamespace) -> None:
    enricher = PositionEnricher(enabled=True, kb_loader=dummy_kb)
    positions = [
        {
            "code": "",
            "description": "Betonáž základové desky C20/25",
            "unit": "m3",
        }
    ]

    enriched, stats = enricher.enrich(positions, drawing_payload=[])
    assert stats["partial"] == 1
    block = enriched[0]["enrichment"]
    assert block["match"] == "partial"
    assert block["score"] >= 0.75
    assert block["evidence"]
