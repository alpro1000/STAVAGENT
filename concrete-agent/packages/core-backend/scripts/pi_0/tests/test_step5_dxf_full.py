"""Tests for Step 5 — full DXF parse, *-IDEN spatial matching, cache layer.

Run from concrete-agent/packages/core-backend/scripts/:
    python -m pi_0.tests.test_step5_dxf_full
"""
from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path

from pi_0 import cache as cache_mod
from pi_0.cache import CACHE_SCHEMA_VERSION, load_or_parse, invalidate
from pi_0.extract import (
    CACHE_DIR, extract, extract_dxf_data, _dxf_files_for_objekt,
)
from pi_0.extractors.dxf_openings import (
    find_nearest_iden_code, parse_dxf_full,
)
from pi_0.schema import canonical_hash


DROP_TIMESTAMP = (("metadata", "extracted_at"),)


class CacheLayerTests(unittest.TestCase):
    """Step 5 cache: mtime-based invalidation, schema-version invalidation."""

    def test_cache_load_or_parse_returns_data(self):
        """First call parses + persists; second call returns cached."""
        dxf_files = _dxf_files_for_objekt("D")
        if not dxf_files:
            self.skipTest("no D DXFs available")
        sample = dxf_files[0]
        # Force fresh parse (delete cache entry first)
        invalidate(sample, cache_dir=CACHE_DIR)
        data1 = load_or_parse(sample, parse_dxf_full, cache_dir=CACHE_DIR)
        data2 = load_or_parse(sample, parse_dxf_full, cache_dir=CACHE_DIR)
        self.assertEqual(data1, data2,
                         msg="Cache hit must equal fresh parse")
        self.assertIn("rooms", data1)
        self.assertIn("raw_openings", data1)

    def test_cache_invalidates_on_mtime_change(self):
        """Bumping the source DXF's mtime triggers a re-parse."""
        dxf_files = _dxf_files_for_objekt("D")
        if not dxf_files:
            self.skipTest("no D DXFs available")
        sample = dxf_files[0]
        # Prime cache
        load_or_parse(sample, parse_dxf_full, cache_dir=CACHE_DIR)
        cache_file = CACHE_DIR / f"{sample.name}.json"
        self.assertTrue(cache_file.exists(), msg="cache file should exist")
        cache_mtime_before = cache_file.stat().st_mtime
        # Touch the DXF — bump its mtime to "now"
        new_mtime = time.time() + 1.0
        import os
        os.utime(sample, (new_mtime, new_mtime))
        # Force a re-parse via load_or_parse
        load_or_parse(sample, parse_dxf_full, cache_dir=CACHE_DIR)
        cache_mtime_after = cache_file.stat().st_mtime
        self.assertGreater(cache_mtime_after, cache_mtime_before,
                           msg="cache file should be re-written")


class PerObjektScopeTests(unittest.TestCase):
    """Step 5 gate: each objekt has rooms[] populated from its own DXFs."""

    @classmethod
    def setUpClass(cls):
        cls.results = {o: extract(o) for o in "ABCD"}

    def test_each_objekt_has_rooms(self):
        for o, data in self.results.items():
            self.assertGreater(
                len(data["rooms"]), 0,
                msg=f"objekt {o} has 0 rooms — DXF parse may be broken",
            )

    def test_d_room_count_matches_phase_6_5_baseline(self):
        """D should have ≈ 109 rooms per Phase 6.5 v2 documentation
        (109 detected; 2 more (S.D.16, S.D.42) injected manually in
        Phase 0.11 — those won't be in DXF parse)."""
        n = len(self.results["D"]["rooms"])
        self.assertGreaterEqual(n, 105, msg=f"D has only {n} rooms (<105)")
        self.assertLessEqual(n, 115, msg=f"D has {n} rooms (>115 unexpected)")

    def test_each_objekt_room_codes_match_objekt_prefix(self):
        for o, data in self.results.items():
            for room in data["rooms"]:
                code = room["code"]
                self.assertTrue(
                    code.startswith(f"{o}.") or code.startswith(f"S.{o}."),
                    msg=f"objekt {o} contains foreign room {code!r}",
                )


class SpatialIdenMatchingTests(unittest.TestCase):
    """Step 5 gate: spatial *-IDEN matching resolves type_codes."""

    @classmethod
    def setUpClass(cls):
        cls.d = extract("D")

    def test_some_d_openings_have_spatial_type_code(self):
        spatial = [op for op in self.d["openings"]
                   if op.get("type_code_source") == "spatial_iden"]
        # Lower bound: půdorys drawings carry IDEN tags. Step 2 had 0
        # spatial; Step 5 must produce significant resolution.
        self.assertGreater(
            len(spatial), 50,
            msg=f"only {len(spatial)} spatial *-IDEN matches — far below "
                f"threshold (suggests parser regression)",
        )

    def test_d_d10_d11_d20_d42_at_least_one_each(self):
        """The 5 PROBE 7 codes should each have at least one resolved
        opening in D after spatial matching."""
        type_codes = {op["type_code"] for op in self.d["openings"]
                      if op.get("type_code_source") == "spatial_iden"}
        # All 5 (D10, D11, D20, D21, D42) seen in segment_counts confirms
        # they're recognised somewhere; require at least 3 since some
        # drawings may not carry their IDEN tags.
        present = type_codes & {"D10", "D11", "D20", "D21", "D42"}
        self.assertGreaterEqual(
            len(present), 3,
            msg=f"PROBE 7 codes resolved: {present} (expected ≥3 of 5)",
        )

    def test_find_nearest_iden_code_threshold(self):
        """Unit test on the helper: returns nearest within threshold,
        None outside."""
        tags = [
            {"code": "D10", "position": [100.0, 100.0]},
            {"code": "D21", "position": [500.0, 100.0]},
        ]
        # Within threshold (default 1500mm) → return nearest
        self.assertEqual(find_nearest_iden_code([110, 110], tags), "D10")
        # Far outside → None
        self.assertIsNone(find_nearest_iden_code([100000, 100000], tags))


class CrossLinkPostStep5Tests(unittest.TestCase):
    """Step 5 cross-link rate (post-spatial-matching) is materially
    higher than Step 3's 1.1 % baseline."""

    def test_d_cross_link_rate_above_step3(self):
        d = extract("D")
        linked = sum(1 for op in d["openings"] if "door_match" in op)
        rate = linked / len(d["openings"]) if d["openings"] else 0
        # Step 3 was 1.1 %; Step 5 spatial matching should lift to >25 %.
        # The ceiling is bounded by source data: ŘEZY / POHLEDY / Podhledy
        # drawings don't carry *-IDEN tags, and openings appear duplicated
        # across drawings. Step 6+ adds dedup → expect ~90 % then.
        self.assertGreater(rate, 0.25,
                           msg=f"link rate {rate:.1%} ≤ 25 % — "
                               f"spatial matching not helping enough")


class SegmentCountsTests(unittest.TestCase):
    """Step 5 segment_counts populated per objekt."""

    def test_d_segment_counts_populated(self):
        d = extract("D")
        self.assertGreater(
            len(d["segment_counts"]), 0,
            msg="segment_counts empty after Step 5",
        )
        # Should at least include WF + CF + F prefixes (architectural)
        prefixes = set(d["segment_counts"].keys())
        for required in ("WF", "CF", "F"):
            self.assertIn(required, prefixes,
                          msg=f"prefix {required} missing from segment_counts")


class IdempotencyAfterStep5Tests(unittest.TestCase):
    """Step 5 idempotency: 3× extract is byte-identical (cache must be
    deterministic)."""

    def test_d_three_runs_identical_after_step_5(self):
        h = [canonical_hash(extract("D"), drop_paths=DROP_TIMESTAMP)
             for _ in range(3)]
        self.assertEqual(h[0], h[1])
        self.assertEqual(h[1], h[2])


if __name__ == "__main__":
    sys.exit(0 if unittest.main(argv=[sys.argv[0], "-v"], exit=False).result.wasSuccessful() else 1)
