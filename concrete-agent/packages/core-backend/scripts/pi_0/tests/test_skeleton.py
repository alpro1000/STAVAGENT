"""Step 1 acceptance: skeleton produces valid output + idempotency holds.

Run from repo root:
    python -m pytest concrete-agent/packages/core-backend/scripts/pi_0/tests/

Or directly (no pytest):
    python -m pi_0.tests.test_skeleton
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from pi_0 import SCHEMA_VERSION, __version__
from pi_0.extract import extract, files_for_objekt, VALID_OBJEKTY
from pi_0.schema import canonical_hash, write_canonical


DROP_TIMESTAMP = (("metadata", "extracted_at"),)


class SkeletonTests(unittest.TestCase):
    def test_extract_d_has_metadata(self):
        data = extract("D")
        self.assertEqual(data["metadata"]["objekt"], "D")
        self.assertEqual(data["metadata"]["schema_version"], SCHEMA_VERSION)
        self.assertEqual(data["metadata"]["extractor_version"], __version__)
        self.assertGreater(len(data["metadata"]["source_files"]), 0)

    def test_extract_d_idempotent_three_runs(self):
        """Step 1 acceptance: 3 consecutive runs are byte-identical
        (excluding the timestamp)."""
        h1 = canonical_hash(extract("D"), drop_paths=DROP_TIMESTAMP)
        h2 = canonical_hash(extract("D"), drop_paths=DROP_TIMESTAMP)
        h3 = canonical_hash(extract("D"), drop_paths=DROP_TIMESTAMP)
        self.assertEqual(h1, h2)
        self.assertEqual(h2, h3)

    def test_all_four_objekty_resolve(self):
        """Each of A/B/C/D resolves to a non-empty source file list."""
        for obj in VALID_OBJEKTY:
            files = files_for_objekt(obj)
            self.assertGreater(len(files), 0, msg=f"objekt {obj} has 0 sources")

    def test_d_includes_shared_files(self):
        """D's source file list must include both _140_ and _100_ (shared) files."""
        d_files = files_for_objekt("D")
        names = [p.name for p in d_files]
        has_140 = any("_140_" in n for n in names)
        has_100 = any("_100_" in n for n in names)
        self.assertTrue(has_140, msg="D missing its own _140_ files")
        self.assertTrue(has_100, msg="D missing shared _100_ files")

    def test_a_includes_shared_files(self):
        """A's list must include _110_ + _100_ (shared); not _140_ etc."""
        a_files = files_for_objekt("A")
        names = [p.name for p in a_files]
        has_110 = any("_110_" in n for n in names)
        has_100 = any("_100_" in n for n in names)
        leaks_other = any(("_120_" in n or "_130_" in n or "_140_" in n) for n in names)
        self.assertTrue(has_110, msg="A missing its own _110_ files")
        self.assertTrue(has_100, msg="A missing shared _100_ files")
        self.assertFalse(leaks_other, msg="A leaked B/C/D files")

    def test_invalid_objekt_raises(self):
        with self.assertRaises(ValueError):
            files_for_objekt("X")

    def test_canonical_serialization_rounds_floats(self):
        """write_canonical rounds floats to 6 decimals; strings pass through."""
        import tempfile

        with tempfile.NamedTemporaryFile("r", suffix=".json", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            write_canonical(tmp_path, {
                "area": 12.123456789,
                "wkt": "POLYGON((1.123456789 2.123456789))",
                "count": 42,
            })
            roundtripped = json.loads(tmp_path.read_text())
            # Float was rounded
            self.assertEqual(roundtripped["area"], 12.123457)
            # WKT string passed through verbatim — still has 9 decimals
            self.assertIn("1.123456789", roundtripped["wkt"])
            self.assertIn("2.123456789", roundtripped["wkt"])
            # int unchanged
            self.assertEqual(roundtripped["count"], 42)
        finally:
            tmp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(unittest.main(argv=[sys.argv[0], "-v"], exit=False).result.wasSuccessful() == False)
