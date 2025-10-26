import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.utils.position_normalizer import normalize_positions


def test_otskp_normalizer_aliases_numbers_and_flags():
    header_map = {
        "kod": "Kód položky",
        "popis": "Popis",
        "mj": "MJ",
        "mnozstvi": "Množství",
        "cena_celkem": "Cena celkem",
    }

    raw_positions = []
    # Create 10 valid OTSKP rows to satisfy format detection heuristics
    for idx in range(10):
        code = f"0{14100 + idx}"  # six digits with leading zero for first row
        row_values = [code, f"Práce {idx}", "m3", "1 234,56", "7,684"]
        raw_positions.append(
            {
                "kod": code,
                "popis": f"Práce {idx}",
                "mj": "m3",
                "mnozstvi": "1 234,56",
                "cena_celkem": "7,684",
                "foo": "extra",
                "_header_map": {**header_map, "foo": "Foo"},
                "_row_values": list(row_values),
                "_row_first_value": code,
            }
        )

    # Section row that should be excluded from positions
    raw_positions.append(
        {
            "popis": "1 Zemní práce",
            "_header_map": {"popis": "Popis"},
            "_row_values": ["1 Zemní práce"],
            "_row_first_value": "1 Zemní práce",
        }
    )

    # Resource row flagged via keyword detection
    resource_values = ["22694.R", "Kalkulace s rozbory - materiál", "kg", "7,5", "1 250,00"]
    raw_positions.append(
        {
            "kod": "22694.R",
            "popis": "Kalkulace s rozbory - materiál",
            "mj": "kg",
            "mnozstvi": "7,5",
            "cena_celkem": "1 250,00",
            "_header_map": header_map,
            "_row_values": list(resource_values),
            "_row_first_value": "22694.R",
        }
    )

    normalized, stats = normalize_positions(raw_positions, return_stats=True)

    # 10 main rows + 1 resource row, section excluded
    assert len(normalized) == 11
    assert stats["positions"]["sections"] == 1
    assert stats["positions"]["resources"] == 1
    assert stats["positions"]["total"] == 11
    assert stats["format"] == "OTSKP"
    assert stats["numbers_locale"] == "EU"
    assert stats["header_map"]["Kód položky"] == "code"
    assert "Foo" in stats["unknown_headers"]

    first = normalized[0]
    assert first["code"].startswith("0")
    assert pytest.approx(first["quantity"], rel=1e-6) == 1234.56
    assert pytest.approx(first["total_price"], rel=1e-6) == 7.684
    assert first["unit"] == "M3"

    resource_row = normalized[-1]
    assert resource_row["resource_row"] is True
    assert pytest.approx(resource_row["quantity"], rel=1e-6) == 7.5


def test_number_normalization_handles_nbsp_and_thin_space():
    raw_positions = [
        {
            "popis": "Beton",
            "mj": "m3",
            "mnozstvi": "1\u00a0234,5",
            "cena_celkem": "7\u202f684,00",
            "kod": "123456",
        }
    ]

    normalized, stats = normalize_positions(raw_positions, return_stats=True)

    assert len(normalized) == 1
    assert pytest.approx(normalized[0]["quantity"], rel=1e-6) == 1234.5
    assert pytest.approx(normalized[0]["total_price"], rel=1e-6) == 7684.0
    assert stats["numbers_locale"] == "EU"
