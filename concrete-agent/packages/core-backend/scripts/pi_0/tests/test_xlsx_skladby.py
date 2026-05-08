"""Tests for Step 4 — Tabulka 0030 skladby + povrchy absorption.

Run from concrete-agent/packages/core-backend/scripts/:
    python -m pi_0.tests.test_xlsx_skladby
"""
from __future__ import annotations

import sys
import unittest

from pi_0.extract import extract, TABULKA_SKLADEB_PATH
from pi_0.extractors.xlsx_skladby import extract_skladby
from pi_0.schema import canonical_hash


class AllKindsCoverageTests(unittest.TestCase):
    """Step 4 acceptance: all 5 Tabulka 0030 kinds present + populated."""

    @classmethod
    def setUpClass(cls):
        cls.skladby = extract_skladby(TABULKA_SKLADEB_PATH)

    def test_all_five_kinds_present(self):
        """F + FF + WF + RF + CF must be present (TP/OP from other tables)."""
        for kind in ("F", "FF", "WF", "RF", "CF"):
            self.assertIn(kind, self.skladby, msg=f"{kind} missing")
            self.assertGreater(len(self.skladby[kind]), 0,
                               msg=f"{kind} empty")

    def test_total_skladby_count_in_expected_range(self):
        total = sum(len(by_code) for by_code in self.skladby.values())
        # Per Π.0 inventory + Phase 0.8 audit: ~70 skladby across komplex.
        self.assertGreaterEqual(total, 60, msg=f"only {total} skladby (<60)")
        self.assertLessEqual(total, 100, msg=f"{total} skladby (>100 unexpected)")


class SkladbaSchemaTests(unittest.TestCase):
    """Each skladba entry has the §2.5 mandatory fields."""

    @classmethod
    def setUpClass(cls):
        cls.skladby = extract_skladby(TABULKA_SKLADEB_PATH)

    def test_every_entry_has_kind_populated(self):
        """Step 4 explicit gate: NO null kinds across all skladby."""
        nulls: list[str] = []
        for kind_section in self.skladby.values():
            for code, entry in kind_section.items():
                if not entry.get("kind"):
                    nulls.append(code)
        self.assertEqual(nulls, [], msg=f"{len(nulls)} skladby with null kind: {nulls[:5]}")

    def test_every_entry_has_source_and_confidence(self):
        for kind_section in self.skladby.values():
            for code, entry in kind_section.items():
                self.assertIn("source", entry, msg=code)
                self.assertIn("confidence", entry, msg=code)
                self.assertEqual(entry["confidence"], 1.0,
                                 msg=f"{code}: literal extraction must be 1.0")

    def test_source_format_xlsx_pattern(self):
        sample = next(iter(self.skladby["WF"].values()))
        self.assertTrue(sample["source"].startswith("XLSX|"))
        self.assertIn("0030", sample["source"])
        self.assertIn("row=", sample["source"])

    def test_vrstvy_is_list_with_at_least_one_layer(self):
        for kind_section in self.skladby.values():
            for code, entry in kind_section.items():
                self.assertIsInstance(entry["vrstvy"], list, msg=code)
                self.assertGreaterEqual(
                    len(entry["vrstvy"]), 1,
                    msg=f"{code} has 0 layers — degenerate",
                )


class LegacyAlignmentTests(unittest.TestCase):
    """Step 4 cross-check: pi_0 output agrees with Phase 0.8 known fixtures."""

    @classmethod
    def setUpClass(cls):
        cls.skladby = extract_skladby(TABULKA_SKLADEB_PATH)

    def test_wf22_label_matches_phase_0_8_fix(self):
        """Phase 0.8 cross-check identified WF22 as 'obvodová stěna -
        nadezdívky' (was incorrectly classified as vnitřní_nosná).
        Verify pi_0 picks the same label from XLSX."""
        wf22 = self.skladby.get("WF", {}).get("WF22")
        self.assertIsNotNone(wf22, msg="WF22 missing from extract")
        self.assertIn("nadezdívky", (wf22["label"] or "").lower(),
                      msg=f"WF22 label is {wf22['label']!r}")

    def test_ff20_has_seven_layer_composition(self):
        """FF20 'podlaha nad suterénem - dlažba' has 7 layers per Tabulka 0030
        (Povrchová úprava + Roznášecí + Separace + Kročejová + Instalační +
        ŽB deska + Povrchová). Sanity check on multi-layer parsing."""
        ff20 = self.skladby.get("FF", {}).get("FF20")
        self.assertIsNotNone(ff20, msg="FF20 missing")
        self.assertEqual(len(ff20["vrstvy"]), 7,
                         msg=f"FF20 has {len(ff20['vrstvy'])} layers, expected 7")
        labels = [v["label"] for v in ff20["vrstvy"]]
        self.assertIn("Roznášecí vrstva s kari sítí", labels)
        self.assertIn("Kročejová izolace", labels)


class IntegrationWithExtractTests(unittest.TestCase):
    """Step 4 integration: master_extract.skladby populated for all 4 objekty
    (skladby is komplex-wide → identical across A/B/C/D)."""

    def test_skladby_identical_across_objekty(self):
        """Skladby are komplex-wide; A == B == C == D."""
        from pi_0.schema import canonical_bytes
        skladby_canonical = {}
        for objekt in ("A", "B", "C", "D"):
            data = extract(objekt)
            skladby_canonical[objekt] = canonical_bytes(data["skladby"])
        a, b, c, d = (skladby_canonical[o] for o in "ABCD")
        self.assertEqual(a, b, msg="A.skladby != B.skladby")
        self.assertEqual(b, c, msg="B.skladby != C.skladby")
        self.assertEqual(c, d, msg="C.skladby != D.skladby")

    def test_d_has_step_4_gate_warning(self):
        """master_extract_D.warnings contains a step_4_gate info line."""
        d = extract("D")
        gate_warnings = [w for w in d["warnings"]
                         if w["category"] == "step_4_gate"]
        self.assertEqual(len(gate_warnings), 1, msg="step_4_gate missing or duplicated")


class IdempotencyAfterStep4Tests(unittest.TestCase):
    """Step 4 idempotency: 3× extract is byte-identical after skladby added."""

    DROP_TIMESTAMP = (("metadata", "extracted_at"),)

    def test_d_three_runs_identical_after_step_4(self):
        h = [canonical_hash(extract("D"), drop_paths=self.DROP_TIMESTAMP)
             for _ in range(3)]
        self.assertEqual(h[0], h[1])
        self.assertEqual(h[1], h[2])


if __name__ == "__main__":
    sys.exit(0 if unittest.main(argv=[sys.argv[0], "-v"], exit=False).result.wasSuccessful() else 1)
