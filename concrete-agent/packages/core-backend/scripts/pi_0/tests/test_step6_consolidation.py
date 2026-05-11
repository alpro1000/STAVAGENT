"""Tests for Step 6 — opening dedup + Phase 0.11 carryforward + validation.

Run from concrete-agent/packages/core-backend/scripts/:
    python -m pi_0.tests.test_step6_consolidation
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from pi_0.extract import extract, OUTPUTS_ROOT
from pi_0.schema import canonical_hash
from pi_0.validation.diff_vs_legacy import run_validation_d


DROP_TIMESTAMP = (("metadata", "extracted_at"),)


class DedupTests(unittest.TestCase):
    """Step 6 opening dedup: source_drawings[] aggregates duplicates."""

    @classmethod
    def setUpClass(cls):
        cls.d = extract("D")
        cls.a = extract("A")

    def test_each_opening_has_source_drawings_list(self):
        """Every deduped opening carries a source_drawings list."""
        for op in self.d["openings"]:
            self.assertIn("source_drawings", op,
                          msg=f"opening {op.get('id')} missing source_drawings")
            self.assertIsInstance(op["source_drawings"], list)
            self.assertGreaterEqual(len(op["source_drawings"]), 1)

    def test_some_openings_appear_in_multiple_drawings(self):
        """At least some objekty produce multi-drawing matches (proves
        the dedup logic is firing somewhere)."""
        multi_seen = False
        for objekt_data in (self.a, self.d):
            multi = [op for op in objekt_data["openings"]
                     if op.get("instance_count", 1) > 1]
            if multi:
                multi_seen = True
                break
        self.assertTrue(multi_seen,
                        msg="No multi-drawing openings detected — dedup may "
                            "not be firing across any objekt")


class Phase011CarryforwardTests(unittest.TestCase):
    """Step 6 carryforward: S.D.16 + S.D.42 appear in D rooms[] via
    legacy dataset injection (they're absent from DXF parser output)."""

    @classmethod
    def setUpClass(cls):
        cls.d = extract("D")

    def test_s_d_16_present_in_d_rooms(self):
        codes = {r["code"] for r in self.d["rooms"]}
        self.assertIn("S.D.16", codes,
                      msg="S.D.16 missing — Phase 0.11 carryforward broken")

    def test_s_d_42_present_in_d_rooms(self):
        codes = {r["code"] for r in self.d["rooms"]}
        self.assertIn("S.D.42", codes)

    def test_injected_rooms_carry_provenance(self):
        injected = [r for r in self.d["rooms"]
                    if r.get("manual_injection") is True]
        self.assertGreaterEqual(len(injected), 2)
        for r in injected:
            self.assertEqual(
                r["source_drawing"],
                "PHASE_0_11_manual_inject_from_XLSX",
                msg=f"{r['code']} missing inject provenance",
            )

    def test_d_room_count_post_inject(self):
        """D should have 111 rooms after Phase 0.11 carryforward
        (109 from DXF + 2 manual injects), matching Phase 6.5 v2 baseline."""
        n = len(self.d["rooms"])
        self.assertEqual(n, 111, msg=f"D has {n} rooms; expected 111")


class ValidationGateTests(unittest.TestCase):
    """Step 6 acceptance gate: 0 MISSING entries in validation_report_D."""

    def test_validation_d_zero_missing(self):
        extract_path = OUTPUTS_ROOT / "master_extract_D.json"
        if not extract_path.exists():
            self.skipTest("master_extract_D.json not yet generated")
        report = run_validation_d(extract_path, OUTPUTS_ROOT)
        self.assertEqual(
            report["totals"]["missing"], 0,
            msg=f"MISSING={report['totals']['missing']} > 0; "
                f"Step 6 gate FAILED. Sections: "
                f"{[(s['section'], s['missing']) for s in report['sections']]}",
        )
        self.assertTrue(report["gate_passed"])


class IdempotencyAfterStep6Tests(unittest.TestCase):
    """Step 6 idempotency: 3× extract is byte-identical even after dedup +
    carryforward + cross-link."""

    def test_d_three_runs_identical_after_step_6(self):
        h = [canonical_hash(extract("D"), drop_paths=DROP_TIMESTAMP)
             for _ in range(3)]
        self.assertEqual(h[0], h[1])
        self.assertEqual(h[1], h[2])


class SelfConsistencyTests(unittest.TestCase):
    """Step 6 cohesive deliverable: cross-refs are valid where present."""

    @classmethod
    def setUpClass(cls):
        cls.d = extract("D")

    def test_door_match_cislos_exist_in_doors_section(self):
        """Every opening.door_match.cislo (when set) must reference a
        real cislo in doors[]."""
        cislos_in_doors = {
            d["cislo"]["value"] for d in self.d["doors"]
            if d.get("cislo", {}).get("value") is not None
        }
        for op in self.d["openings"]:
            dm = op.get("door_match")
            if not dm:
                continue
            v = dm.get("value", {})
            if "cislo" in v and v["cislo"] is not None:
                self.assertIn(
                    v["cislo"], cislos_in_doors,
                    msg=f"opening {op['id']} cross-links to cislo "
                        f"{v['cislo']!r} not in doors[]",
                )

    def test_skladby_kind_field_consistent_with_top_level_key(self):
        """skladby[<kind>][<code>].kind must equal <kind>."""
        for kind, by_code in self.d["skladby"].items():
            for code, entry in by_code.items():
                self.assertEqual(
                    entry["kind"], kind,
                    msg=f"skladby.{kind}.{code} kind={entry['kind']!r} != {kind!r}",
                )


if __name__ == "__main__":
    sys.exit(0 if unittest.main(argv=[sys.argv[0], "-v"], exit=False).result.wasSuccessful() else 1)
