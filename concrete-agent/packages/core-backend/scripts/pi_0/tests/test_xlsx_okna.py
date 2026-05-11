"""Tests for Step 7 — Tabulka 0042 OKEN absorption.

Run from concrete-agent/packages/core-backend/scripts/:
    python -m pi_0.tests.test_xlsx_okna
"""
from __future__ import annotations

import sys
import unittest

from pi_0.extract import extract, TABULKA_OKEN_PATH
from pi_0.extractors.xlsx_okna import COLUMN_MAP, extract_windows
from pi_0.schema import canonical_hash


DROP_TIMESTAMP = (("metadata", "extracted_at"),)


class FullRowSchemaTests(unittest.TestCase):
    """Step 7 acceptance: every window row carries all 20 cols."""

    @classmethod
    def setUpClass(cls):
        cls.windows = extract_windows(TABULKA_OKEN_PATH)
        if not cls.windows:
            raise unittest.SkipTest("no windows found in Tabulka 0042")
        cls.sample = cls.windows[0]

    def test_all_20_columns_present(self):
        for _, field, _ in COLUMN_MAP:
            self.assertIn(field, self.sample, msg=f"missing field: {field}")

    def test_every_cell_has_value_source_confidence(self):
        for k, v in self.sample.items():
            if k == "id":
                continue
            self.assertIsInstance(v, dict, msg=k)
            self.assertIn("value", v, msg=k)
            self.assertIn("source", v, msg=k)
            self.assertIn("confidence", v, msg=k)
            self.assertEqual(v["confidence"], 1.0,
                             msg=f"{k}: literal extraction must be 1.0")

    def test_source_provenance_format(self):
        self.assertIn("XLSX|", self.sample["kod"]["source"])
        self.assertIn("0042", self.sample["kod"]["source"])
        self.assertIn("tabulka", self.sample["kod"]["source"])
        self.assertIn("col=1", self.sample["kod"]["source"])


class GateW03Tests(unittest.TestCase):
    """Step 7 PROBE-7-style gate: W03 has Uw + Rw + glazing visible."""

    @classmethod
    def setUpClass(cls):
        cls.windows = extract_windows(TABULKA_OKEN_PATH)

    def _find(self, kod):
        return next((w for w in self.windows
                     if w.get("kod", {}).get("value") == kod), None)

    def test_w03_has_uw_value(self):
        w03 = self._find("W03")
        self.assertIsNotNone(w03)
        uw = w03["uw"]["value"]
        self.assertIsNotNone(uw, msg="W03.uw must be set")
        # Sanity: typical residential triple-glazing Uw is 0.6-1.4
        self.assertEqual(str(uw), "0.62", msg=f"W03.uw={uw!r}")

    def test_w03_has_rw_acoustic(self):
        w03 = self._find("W03")
        rw = w03["rw_site_db"]["value"]
        self.assertIsNotNone(rw)
        self.assertEqual(str(rw), "40", msg=f"W03.rw_site_db={rw!r}")

    def test_w03_has_glazing_code(self):
        w03 = self._find("W03")
        glazing = w03["zasklenie"]["value"]
        self.assertIsNotNone(glazing, msg="W03.zasklenie must be set")
        # S1 = standard triple glazing per Tabulka 0042 system kódování
        self.assertEqual(glazing, "S1")

    def test_w03_has_rc_safety_class(self):
        """PROBE-7-style: RC class lifted (was 0% extracted before Step 7)."""
        w03 = self._find("W03")
        rc = w03["bezpecn_odolnost"]["value"]
        self.assertIsNotNone(rc)
        self.assertTrue(rc.startswith("RC"), msg=f"W03.RC={rc!r}")


class PerObjektCoverageTests(unittest.TestCase):
    """Each of A/B/C/D has a non-empty windows[] catalogue (komplex-wide)."""

    def test_all_four_objekty_windows_populated(self):
        for objekt in ("A", "B", "C", "D"):
            d = extract(objekt)
            self.assertGreater(
                len(d["windows"]), 0,
                msg=f"objekt {objekt} has 0 windows",
            )
            self.assertGreaterEqual(
                len(d["windows"]), 15,
                msg=f"objekt {objekt} has < 15 windows (expected ≥ 17)",
            )

    def test_windows_identical_across_objekty(self):
        """Komplex-wide catalogue → A.windows == B.windows == … == D.windows."""
        from pi_0.schema import canonical_bytes
        a = canonical_bytes(extract("A")["windows"])
        b = canonical_bytes(extract("B")["windows"])
        c = canonical_bytes(extract("C")["windows"])
        d = canonical_bytes(extract("D")["windows"])
        self.assertEqual(a, b, msg="A.windows != B.windows")
        self.assertEqual(b, c, msg="B.windows != C.windows")
        self.assertEqual(c, d, msg="C.windows != D.windows")


class IdempotencyAfterStep7Tests(unittest.TestCase):
    def test_d_three_runs_identical_after_step_7(self):
        h = [canonical_hash(extract("D"), drop_paths=DROP_TIMESTAMP)
             for _ in range(3)]
        self.assertEqual(h[0], h[1])
        self.assertEqual(h[1], h[2])


class ValidationStillPassesTests(unittest.TestCase):
    """Step 7 must not regress the Step 6 validation gate."""

    def test_validation_d_still_zero_missing_after_step_7(self):
        from pi_0.extract import OUTPUTS_ROOT
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
