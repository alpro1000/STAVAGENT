"""Tests for Step 3 — Tabulka 0041 doors full-row absorption.

Run from concrete-agent/packages/core-backend/scripts/:
    python -m pi_0.tests.test_xlsx_dvere
"""
from __future__ import annotations

import sys
import unittest

from pi_0.extract import (
    extract, extract_doors_for_objekt, TABULKA_DVERI_PATH,
)
from pi_0.extractors.xlsx_dvere import COLUMN_MAP
from pi_0.schema import canonical_hash


# All 28 schema-field names (subset of COLUMN_MAP without col index/comment)
TABULKA_FIELDS = {field for _, field, _ in COLUMN_MAP}


class FullRowSchemaTests(unittest.TestCase):
    """Step 3 acceptance: every door row has all 28 cols + derived fields."""

    @classmethod
    def setUpClass(cls):
        cls.doors_a = extract_doors_for_objekt(TABULKA_DVERI_PATH, "A")
        if not cls.doors_a:
            raise unittest.SkipTest("No A doors found in Tabulka 0041")
        cls.sample = cls.doors_a[0]

    def test_all_28_tabulka_columns_present(self):
        """Every door entry carries every Tabulka column (cell wrapped)."""
        for field in TABULKA_FIELDS:
            self.assertIn(field, self.sample, msg=f"missing field: {field}")

    def test_derived_fields_present(self):
        for field in ("id", "tabulka_dveri_row", "objekt_filter",
                      "is_garage_gate"):
            self.assertIn(field, self.sample, msg=f"missing derived: {field}")

    def test_every_cell_has_value_source_confidence(self):
        for k, v in self.sample.items():
            if k == "id":
                continue
            self.assertIsInstance(v, dict, msg=k)
            self.assertIn("value", v, msg=k)
            self.assertIn("source", v, msg=k)
            self.assertIn("confidence", v, msg=k)

    def test_literal_columns_have_confidence_1_0(self):
        for field in TABULKA_FIELDS:
            self.assertEqual(
                self.sample[field]["confidence"], 1.0,
                msg=f"{field} has non-1.0 confidence (literal extraction)",
            )

    def test_source_provenance_format(self):
        """Source string follows `XLSX|<path>|<sheet>|row=N,col=C` format."""
        self.assertIn("XLSX|", self.sample["typ"]["source"])
        self.assertIn("0041", self.sample["typ"]["source"])
        self.assertIn("tab dvere", self.sample["typ"]["source"])
        self.assertIn("row=", self.sample["typ"]["source"])
        self.assertIn("col=2", self.sample["typ"]["source"])


class ProbeSevenGateTests(unittest.TestCase):
    """Step 3 PROBE 7 closure: D10 + D11 with bezpečnostní pack visible."""

    @classmethod
    def setUpClass(cls):
        cls.doors_a = extract_doors_for_objekt(TABULKA_DVERI_PATH, "A")
        cls.doors_b = extract_doors_for_objekt(TABULKA_DVERI_PATH, "B")

    def _find_typ(self, doors, typ):
        return [d for d in doors if d["typ"]["value"] == typ]

    def test_a_d10_lifts_emz_acs_sn2_kovani(self):
        """A's D10 (cislo=070) carries EMZ + ACS + SN2 + KP1 hardware
        (PROBE 7 evidence — these were dropped before)."""
        d10s = self._find_typ(self.doors_a, "D10")
        self.assertEqual(len(d10s), 1, msg="exactly 1 D10 in A")
        d = d10s[0]
        self.assertEqual(d["zamek"]["value"], "EMZ")
        self.assertEqual(d["acs"]["value"], "●")
        self.assertEqual(d["typ_samozavirace"]["value"], "SN2")
        self.assertEqual(d["typ_kovani"]["value"], "KP1,MM")

    def test_b_d10_lifts_full_bezpecn_pack(self):
        """B's D10 (cislo=120) carries RC3,ESG safety class — PROBE 7
        evidence that we now lift Tabulka col 19."""
        d10s = self._find_typ(self.doors_b, "D10")
        self.assertEqual(len(d10s), 1)
        rc = d10s[0]["bezpecn_odolnost"]["value"]
        self.assertIsNotNone(rc, msg="RC class must be non-null")
        self.assertIn("RC3", rc, msg=f"expected RC3 in {rc!r}")

    def test_a_d11_carries_security_class(self):
        """A's D11 (cislo=086) carries RC3,ESG + 34 dB Rw — full
        bezpečnostní pack per Tabulka 0041. (B's D11 cislo=296 doesn't —
        Tabulka inconsistency, not our extractor's fault.)"""
        d11s = self._find_typ(self.doors_a, "D11")
        self.assertGreater(len(d11s), 0, msg="A should have D11 rows")
        # At least one of A's D11 rows must have RC class populated
        with_rc = [d for d in d11s if d["bezpecn_odolnost"]["value"]]
        self.assertGreater(
            len(with_rc), 0,
            msg="No A D11 row has bezpecn_odolnost — PROBE 7 lift incomplete",
        )
        rc = with_rc[0]["bezpecn_odolnost"]["value"]
        self.assertIn("RC3", rc, msg=f"expected RC3 in {rc!r}")


class PerObjektCoverageTests(unittest.TestCase):
    """Each of A/B/C/D produces a non-empty doors[] section."""

    def test_all_four_objekty_have_doors(self):
        counts = {}
        for objekt in ("A", "B", "C", "D"):
            counts[objekt] = len(extract_doors_for_objekt(
                TABULKA_DVERI_PATH, objekt))
        for o, n in counts.items():
            self.assertGreater(n, 0, msg=f"objekt {o} has 0 doors")
        # Sanity: D should have at least 50 doors (largest objekt)
        self.assertGreater(counts["D"], 50,
                           msg=f"D has only {counts['D']} doors — too few")

    def test_objekt_filter_matches_extracted_objekt(self):
        """Sanity: every door extracted for objekt X has X in objekt_filter."""
        for objekt in ("A", "B", "C", "D"):
            for d in extract_doors_for_objekt(TABULKA_DVERI_PATH, objekt):
                filter_val = d["objekt_filter"]["value"]
                self.assertIn(objekt, filter_val,
                              msg=f"door {d['id']} extracted for {objekt} "
                                  f"but objekt_filter={filter_val!r}")

    def test_invalid_objekt_raises(self):
        from pathlib import Path
        with self.assertRaises(ValueError):
            extract_doors_for_objekt(Path("/nonexistent.xlsx"), "X")


class CrossLinkTests(unittest.TestCase):
    """Step 3 cross-link: openings[] gets door_match when typ matches doors[]."""

    @classmethod
    def setUpClass(cls):
        cls.d = extract("D")

    def test_d_openings_have_some_door_links(self):
        """At least some D openings cross-linked to D doors[]."""
        linked = sum(1 for op in self.d["openings"] if "door_match" in op)
        self.assertGreater(linked, 0,
                           msg="No D openings cross-linked to doors[]")

    def test_door_match_has_value_source_confidence(self):
        """Each door_match annotation follows the {value, source, confidence}
        schema."""
        with_match = [op for op in self.d["openings"] if "door_match" in op]
        if not with_match:
            self.skipTest("no D openings linked")
        sample = with_match[0]["door_match"]
        self.assertIn("value", sample)
        self.assertIn("source", sample)
        self.assertIn("confidence", sample)
        # Either cislo (unique) or cislo_candidates (ambiguous) present
        self.assertTrue(
            "cislo" in sample["value"] or "cislo_candidates" in sample["value"],
            msg=f"door_match.value missing cislo info: {sample['value']!r}",
        )


class IdempotencyTests(unittest.TestCase):
    """Step 3 idempotency: 3× extract is byte-identical."""

    DROP_TIMESTAMP = (("metadata", "extracted_at"),)

    def test_d_three_runs_identical_after_step_3(self):
        h = [canonical_hash(extract("D"), drop_paths=self.DROP_TIMESTAMP)
             for _ in range(3)]
        self.assertEqual(h[0], h[1])
        self.assertEqual(h[1], h[2])


if __name__ == "__main__":
    sys.exit(0 if unittest.main(argv=[sys.argv[0], "-v"], exit=False).result.wasSuccessful() else 1)
