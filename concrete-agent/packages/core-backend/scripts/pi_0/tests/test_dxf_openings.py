"""Tests for Step 2 — DXF block-name parser + opening extraction.

Run from concrete-agent/packages/core-backend/scripts/:
    python -m pi_0.tests.test_dxf_openings
"""
from __future__ import annotations

import sys
import unittest

from pi_0.extract import extract, extract_openings
from pi_0.extractors.dxf_openings import (
    parse_block_name,
    parse_dimensions_from_block_name,
    parsed_anything,
)
from pi_0.schema import canonical_hash


# Real samples observed in dxf_parser_test.json (D-objekt 1.NP / Řezy / Podhledy)
SAMPLE_DOOR_BJ = "HA_DR_Single_Swing_Solid - In_BJ_900x2100_Vstup-2000314-DPS_1NP-D"
SAMPLE_DOOR_DOUBLE = "HA_DR_Double_Swing_Solid - In_BJ_1200x2100_800-1652965-DPS_1NP-D"
SAMPLE_DOOR_FAS = "HA_DR_Double_Swing_Solid_FrameButt - In_FAS_1600x2350_1000-1915407-DPS_1NP-D"
SAMPLE_DOOR_OBJ = "HA_DR_Single_Swing_Solid_wCasing - In_OBJ_1500x2100_900-1771115-DPS_1NP-D"
SAMPLE_CW_GLASS = "ABMV_CW_Single_Swing_Generic - Ex_Glass_SKLOPNE-1529247-DPS_1NP-D"
SAMPLE_DOOR_RIZ = "HA_DR_Single_Swing_Solid - In_900x2100_SKLEP_CIP-2273793-ŘEZ 4-4 OBJEKT D"


class ParseBlockNameTests(unittest.TestCase):
    """Unit tests for the pure parser (≥3 per Step 2 gate criteria)."""

    def test_parses_facade_door_with_full_attrs(self):
        result = parse_block_name(SAMPLE_DOOR_FAS)
        self.assertEqual(result["vendor"]["value"], "HA")
        self.assertEqual(result["element"]["value"], "DR")
        self.assertEqual(result["swing_type"]["value"], "Double_Swing_Solid_FrameButt")
        self.assertEqual(result["frame_type"]["value"], "FrameButt")
        self.assertEqual(result["install_context"]["value"], "In_FAS")
        self.assertEqual(result["cad_lib_id"]["value"], "1915407")

    def test_parses_byt_interior_door(self):
        result = parse_block_name(SAMPLE_DOOR_BJ)
        self.assertEqual(result["vendor"]["value"], "HA")
        self.assertEqual(result["element"]["value"], "DR")
        self.assertEqual(result["install_context"]["value"], "In_BJ")
        self.assertEqual(result["subtype"]["value"], "Vstup")
        self.assertEqual(result["cad_lib_id"]["value"], "2000314")

    def test_parses_curtain_wall_glass(self):
        result = parse_block_name(SAMPLE_CW_GLASS)
        self.assertEqual(result["vendor"]["value"], "ABMV")
        self.assertEqual(result["element"]["value"], "CW")
        self.assertEqual(result["swing_type"]["value"], "Single_Swing_Generic")
        self.assertEqual(result["frame_type"]["value"], "Generic")
        self.assertEqual(result["install_context"]["value"], "Ex_Glass")
        self.assertEqual(result["subtype"]["value"], "SKLOPNE")
        self.assertEqual(result["cad_lib_id"]["value"], "1529247")

    def test_parses_door_with_wCasing_frame(self):
        result = parse_block_name(SAMPLE_DOOR_OBJ)
        self.assertEqual(result["frame_type"]["value"], "wCasing")
        self.assertEqual(result["install_context"]["value"], "In_OBJ")

    def test_parses_door_with_no_install_context_qualifier(self):
        result = parse_block_name(SAMPLE_DOOR_RIZ)
        self.assertEqual(result["install_context"]["value"], "In")
        self.assertEqual(result["cad_lib_id"]["value"], "2273793")

    def test_every_field_has_source_and_confidence(self):
        result = parse_block_name(SAMPLE_DOOR_BJ)
        for field_name, field in result.items():
            self.assertIn("value", field, msg=field_name)
            self.assertIn("source", field, msg=field_name)
            self.assertIn("confidence", field, msg=field_name)
            self.assertEqual(field["confidence"], 0.95)

    def test_unparseable_returns_all_none(self):
        for bad in (None, "", "garbage", 42):
            result = parse_block_name(bad)  # type: ignore[arg-type]
            for field in result.values():
                self.assertIsNone(field["value"])
            self.assertFalse(parsed_anything(result))

    def test_parsed_anything_true_for_valid_input(self):
        self.assertTrue(parsed_anything(parse_block_name(SAMPLE_DOOR_BJ)))
        self.assertTrue(parsed_anything(parse_block_name(SAMPLE_CW_GLASS)))

    def test_dimension_extraction(self):
        self.assertEqual(parse_dimensions_from_block_name(SAMPLE_DOOR_FAS),
                         (1600, 2350, None))
        self.assertEqual(parse_dimensions_from_block_name(SAMPLE_DOOR_DOUBLE),
                         (1200, 2100, None))
        # Invalid inputs return None tuple
        self.assertEqual(parse_dimensions_from_block_name(""), (None, None, None))
        self.assertEqual(parse_dimensions_from_block_name(None), (None, None, None))


class ExtractOpeningsTests(unittest.TestCase):
    """Integration tests for D openings + 90 % coverage gate."""

    def test_d_openings_populated(self):
        openings, warnings = extract_openings("D")
        self.assertGreater(len(openings), 0, msg="D produced 0 openings")

    def test_d_openings_have_block_attrs(self):
        openings, _ = extract_openings("D")
        for op in openings:
            self.assertIn("block_attrs", op)
            for field_name in ("vendor", "element", "swing_type",
                               "install_context", "subtype", "cad_lib_id",
                               "frame_type"):
                self.assertIn(field_name, op["block_attrs"])

    def test_d_openings_90pct_parseable_gate(self):
        """Step 2 acceptance gate: ≥ 90 % of D openings have at least one
        parsed block_attrs field."""
        openings, _ = extract_openings("D")
        if not openings:
            self.skipTest("no D openings to evaluate")
        parsed = sum(1 for op in openings if parsed_anything(op["block_attrs"]))
        rate = parsed / len(openings)
        self.assertGreaterEqual(
            rate, 0.90,
            msg=f"Only {rate:.1%} parseable — Step 2 gate ≥90% FAILED",
        )

    def test_abc_openings_populated_via_dxf(self):
        """Step 2.5: A/B/C now have direct DXF reads (was empty in Step 2)."""
        for objekt in ("A", "B", "C"):
            openings, warnings = extract_openings(objekt)
            self.assertGreater(
                len(openings), 0,
                msg=f"objekt {objekt} should have openings after Step 2.5",
            )
            # Step 2.5 gate report should be present (the legacy "deferred"
            # warning category is gone)
            categories = {w["category"] for w in warnings}
            self.assertIn("step_2_gate", categories, msg=f"objekt {objekt}")
            self.assertNotIn("deferred_extraction", categories,
                             msg=f"objekt {objekt} still has deferral warning")

    def test_each_objekt_90pct_gate(self):
        """All four objekty must pass the ≥90 % parseable gate."""
        for objekt in ("A", "B", "C", "D"):
            openings, _ = extract_openings(objekt)
            if not openings:
                self.skipTest(f"no openings for {objekt} to evaluate")
            from pi_0.extractors.dxf_openings import parsed_anything
            parsed = sum(1 for op in openings if parsed_anything(op["block_attrs"]))
            rate = parsed / len(openings)
            self.assertGreaterEqual(
                rate, 0.90,
                msg=f"{objekt}: {rate:.1%} parseable < 90 %",
            )


class IdempotencyTests(unittest.TestCase):
    """Step 2 idempotency: 3 consecutive runs produce identical output."""

    DROP_TIMESTAMP = (("metadata", "extracted_at"),)

    def test_d_three_runs_byte_identical(self):
        h = [canonical_hash(extract("D"), drop_paths=self.DROP_TIMESTAMP)
             for _ in range(3)]
        self.assertEqual(h[0], h[1])
        self.assertEqual(h[1], h[2])

    def test_all_objekty_each_idempotent(self):
        for obj in ("A", "B", "C", "D"):
            h = [canonical_hash(extract(obj), drop_paths=self.DROP_TIMESTAMP)
                 for _ in range(2)]
            self.assertEqual(h[0], h[1], msg=f"{obj} not idempotent")


if __name__ == "__main__":
    sys.exit(0 if unittest.main(argv=[sys.argv[0], "-v"], exit=False).result.wasSuccessful() else 1)
