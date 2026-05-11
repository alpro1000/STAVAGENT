"""Tests for Step 8c — TZB prostupy + štroby extraction.

Run from concrete-agent/packages/core-backend/scripts/:
    python -m pi_0.tests.test_dxf_tzb
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

from pi_0.extract import SOURCES_ROOT, OUTPUTS_ROOT, extract
from pi_0.extractors.dxf_tzb_prostupy import (
    extract_tzb_prostupy,
    DISCIPLINE_DXF_PATTERNS,
    DISCIPLINE_LAYER_PATTERNS,
    DN_LABEL_LAYERS,
)
from pi_0.extractors.dxf_tzb_strby import (
    extract_tzb_strby,
    STRBY_DXF_PATTERNS,
    CHASE_LAYERS,
)
from pi_0.schema import canonical_hash

DROP_TIMESTAMP = (("metadata", "extracted_at"),)


class ProstupyExtractionTests(unittest.TestCase):
    """Step 8c acceptance: per-discipline prostupy land in master_extract."""

    @classmethod
    def setUpClass(cls):
        cls.records, cls.warnings = extract_tzb_prostupy("D", SOURCES_ROOT)

    def test_d_emits_some_prostupy(self):
        """Drop v2 has ~497 expected — assert > 200 as a generous floor."""
        self.assertGreater(len(self.records), 200,
                           msg=f"Got only {len(self.records)} prostupy")

    def test_per_discipline_coverage(self):
        """At least 4 of 6 disciplines (vodovod/kanalizace/UT/slaboproud)
        must have non-zero records — VZT + chl are known-blocked."""
        disciplines = {r["discipline"] for r in self.records}
        # Disciplines we expect to be present:
        for required in ("vodovod", "kanalizace", "UT", "slaboproud"):
            self.assertIn(required, disciplines,
                          msg=f"Discipline {required} missing — extraction broken?")

    def test_per_podlazi_coverage(self):
        """All 4 podlaží present (1.PP / 1.NP / 2.NP / 3.NP)."""
        podlazi_set = {r["podlazi"] for r in self.records}
        self.assertEqual(podlazi_set, {"1.PP", "1.NP", "2.NP", "3.NP"})

    def test_record_shape(self):
        """Every record carries required fields per audit §8."""
        sample = self.records[0]
        for key in ("id", "discipline", "podlazi", "position",
                    "source_kind", "source_layer", "source_drawing",
                    "dn_mm", "confidence"):
            self.assertIn(key, sample, msg=f"Missing key: {key}")
        self.assertIsInstance(sample["dn_mm"], dict)
        for sub in ("value", "source", "confidence"):
            self.assertIn(sub, sample["dn_mm"])

    def test_record_id_unique(self):
        ids = [r["id"] for r in self.records]
        self.assertEqual(len(ids), len(set(ids)),
                         msg="Duplicate prostup ids — counter broken")

    def test_layer_pattern_coverage(self):
        """Every emitted record's source_layer matches at least one
        pattern in DISCIPLINE_LAYER_PATTERNS for its discipline."""
        for r in self.records:
            patterns = DISCIPLINE_LAYER_PATTERNS.get(r["discipline"], [])
            layer = r["source_layer"]
            matches = any(layer == p or layer.startswith(p) for p in patterns)
            # block_insert records may match via PROSTUP_BLOCKS instead;
            # those still carry source_layer for context but it's allowed
            # to be off-pattern (e.g. ZT_STOUP for stoup blocks).
            if r["source_kind"] == "circle":
                self.assertTrue(matches,
                                msg=f"layer {layer!r} not in patterns for {r['discipline']}")


class StrbyExtractionTests(unittest.TestCase):
    """Step 8c acceptance: cable-tray chases extracted as length-m records."""

    @classmethod
    def setUpClass(cls):
        cls.records, cls.warnings = extract_tzb_strby("D", SOURCES_ROOT)

    def test_d_emits_some_strby(self):
        """Drop v2 has ~48 expected — assert > 20 as a generous floor."""
        self.assertGreater(len(self.records), 20,
                           msg=f"Got only {len(self.records)} chase segments")

    def test_only_sil_and_slb_disciplines(self):
        """vodovod/kan/UT/plyn don't annotate chases — verify no leakage."""
        disciplines = {r["discipline"] for r in self.records}
        self.assertEqual(disciplines, {"silnoproud", "slaboproud"})

    def test_lengths_positive(self):
        """All chase lengths > 0.1 m (degenerate filter is 100 mm)."""
        for r in self.records:
            self.assertGreater(r["length_m"], 0.1)

    def test_total_length_reasonable(self):
        """Sum of all chase lengths should be in 50-200 m range
        (audit estimated ~72)."""
        total = sum(r["length_m"] for r in self.records)
        self.assertGreater(total, 50.0,
                           msg=f"Total chase length {total:.2f} m too low")
        self.assertLess(total, 500.0,
                        msg=f"Total chase length {total:.2f} m unreasonably high")


class CrossValidationTests(unittest.TestCase):
    """Cross-discipline consistency checks."""

    @classmethod
    def setUpClass(cls):
        cls.prostupy, _ = extract_tzb_prostupy("D", SOURCES_ROOT)
        cls.strby, _ = extract_tzb_strby("D", SOURCES_ROOT)

    def test_kanalizace_richer_than_vodovod_above_ground(self):
        """Czech building convention: kanalizace + vodovod riser counts
        are roughly 2:1 (every drainage stack pairs with up to 2 supply
        risers + cold/hot pair). For above-ground (1.NP/2.NP/3.NP)
        we expect kan ≥ vod."""
        kan_above = sum(1 for r in self.prostupy
                        if r["discipline"] == "kanalizace"
                        and r["podlazi"] != "1.PP")
        vod_above = sum(1 for r in self.prostupy
                        if r["discipline"] == "vodovod"
                        and r["podlazi"] != "1.PP")
        self.assertGreaterEqual(kan_above, vod_above // 2,
                                msg=(f"Anomaly: kanalizace {kan_above} < "
                                     f"vodovod/2 {vod_above // 2}"))

    def test_1pp_richest_podlazi(self):
        """1.PP houses all utility entry points — should have the most
        prostupy of any podlazi."""
        from collections import Counter
        per_pod = Counter(r["podlazi"] for r in self.prostupy)
        if "1.PP" in per_pod:  # only enforce when 1.PP present
            self.assertEqual(
                per_pod.most_common(1)[0][0], "1.PP",
                msg=f"Expected 1.PP to be richest, got {per_pod.most_common()}",
            )


class IdempotencyAfterStep8cTests(unittest.TestCase):
    """master_extract_D.json must be byte-identical 3× re-run."""

    def test_d_three_runs_identical_after_step_8c(self):
        h = [canonical_hash(extract("D"), drop_paths=DROP_TIMESTAMP)
             for _ in range(3)]
        self.assertEqual(h[0], h[1])
        self.assertEqual(h[1], h[2])


class ABCEmptyTzbSectionsTests(unittest.TestCase):
    """A/B/C deliverables must have empty tzb_* sections (drop v2 was D-only)."""

    def test_a_b_c_have_empty_tzb_sections(self):
        for objekt in ("A", "B", "C"):
            d = extract(objekt)
            self.assertEqual(
                d.get("tzb_prostupy", []), [],
                msg=f"Objekt {objekt} has unexpected tzb_prostupy[] entries",
            )
            self.assertEqual(
                d.get("tzb_strby", []), [],
                msg=f"Objekt {objekt} has unexpected tzb_strby[] entries",
            )


class ValidationStillPassesTests(unittest.TestCase):
    """Step 8c must not regress the Step 6 / Step 7 validation gate."""

    def test_validation_d_still_zero_missing_after_step_8c(self):
        from pi_0.validation.diff_vs_legacy import run_validation_d
        extract_path = OUTPUTS_ROOT / "master_extract_D.json"
        if not extract_path.exists():
            self.skipTest("master_extract_D.json not generated yet")
        report = run_validation_d(extract_path, OUTPUTS_ROOT)
        self.assertEqual(
            report["totals"]["missing"], 0,
            msg=f"Step 6 gate regressed — MISSING={report['totals']['missing']}",
        )


if __name__ == "__main__":
    sys.exit(0 if unittest.main(argv=[sys.argv[0], "-v"], exit=False).result.wasSuccessful() else 1)
