"""
Tests for Rule-Based Work Classifier

Tests 4 mandatory cases from specification:
1. Zemní práce - čerpání vody, hloubení, pažení
2. Beton prefab - obrubníky
3. Beton monolit - železobetonová konstrukce
4. Kotvení (NOT výztuž) - kotvy tyčové
"""

from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.classifiers.work_classifier import WorkClassifier


def test_zemni_prace_cerpani_vody():
    classifier = WorkClassifier()
    """
    Test Case 1: Zemní práce - čerpání vody, hloubení, pažení

    Input: "ČERPÁNÍ VODY DO 1000 L/MIN HLOUBENÍ JAM ZAPAŽ I NEPAŽ"
    Expected: ZEMNI_PRACE
    Evidence: Should contain "čerpání", "hloubení", or "zapaž"
    """
    text = "ČERPÁNÍ VODY DO 1000 L/MIN HLOUBENÍ JAM ZAPAŽ I NEPAŽ"
    result = classifier.classify(text)

    assert result.work_group == "ZEMNI_PRACE", f"Expected ZEMNI_PRACE, got {result.work_group}"
    assert result.confidence > 0.5, f"Low confidence: {result.confidence}"

    # Check evidence contains at least one keyword
    evidence_lower = [e.lower() for e in result.evidence]
    assert any(kw in ' '.join(evidence_lower) for kw in ['čerpání', 'hloubení', 'zapaž', 'jám']), \
        f"Evidence missing keywords: {result.evidence}"

    print(f"✅ Test 1 passed: {result.work_group} ({result.confidence:.2f}) - Evidence: {result.evidence}")


def test_beton_prefab_obrubnik():
    classifier = WorkClassifier()
    """
    Test Case 2: Beton prefabrikovaný - obrubníky

    Input: "SILNIČNÍ A CHODNÍKOVÉ OBRUBY Z BETONOVÝCH OBRUBNÍKŮ"
    Expected: BETON_PREFAB (NOT BETON_MONOLIT)
    Evidence: Should contain "obrubník"
    """
    text = "SILNIČNÍ A CHODNÍKOVÉ OBRUBY Z BETONOVÝCH OBRUBNÍKŮ"
    result = classifier.classify(text)

    assert result.work_group == "BETON_PREFAB", \
        f"Expected BETON_PREFAB, got {result.work_group}"
    assert result.work_group != "BETON_MONOLIT", \
        "Should NOT classify as BETON_MONOLIT"
    assert result.confidence > 0.5, f"Low confidence: {result.confidence}"

    # Check evidence
    evidence_lower = [e.lower() for e in result.evidence]
    assert any('obrub' in e for e in evidence_lower), \
        f"Evidence missing 'obrubník': {result.evidence}"

    print(f"✅ Test 2 passed: {result.work_group} ({result.confidence:.2f}) - Evidence: {result.evidence}")


def test_beton_monolit_konstrukce():
    classifier = WorkClassifier()
    """
    Test Case 3: Beton monolitický - železobetonová konstrukce

    Input: "MOSTNÍ RÁMOVÉ KONSTRUKCE ZE ŽELEZOBETONU C30/37"
    Expected: BETON_MONOLIT
    Subtype: ZELEZOBETON
    Evidence: Should contain "železobeton" or "konstrukce" or "C30/37"
    """
    text = "MOSTNÍ RÁMOVÉ KONSTRUKCE ZE ŽELEZOBETONU C30/37"
    result = classifier.classify(text)

    assert result.work_group == "BETON_MONOLIT", \
        f"Expected BETON_MONOLIT, got {result.work_group}"
    assert result.work_type == "ZELEZOBETON", \
        f"Expected subtype ZELEZOBETON, got {result.work_type}"
    assert result.confidence >= 0.5, f"Low confidence: {result.confidence}"

    # Check evidence
    evidence_str = ' '.join(result.evidence).lower()
    assert any(kw in evidence_str for kw in ['železobeton', 'konstrukce', 'c30/37']), \
        f"Evidence missing keywords: {result.evidence}"

    print(f"✅ Test 3 passed: {result.work_group}/{result.work_type} ({result.confidence:.2f}) - Evidence: {result.evidence}")


def test_kotveni_not_vyztuž():
    classifier = WorkClassifier()
    """
    Test Case 4: Kotvení (NOT výztuž) - kotvy tyčové

    Input: "KOTVY TRVALÉ TYČOVÉ INJEKTOVANÉ"
    Expected: KOTVENI (NOT VYZTUŽ)
    Unit: "ks" (should boost score)
    Evidence: Should contain "kotvy" or "injektované"
    """
    text = "KOTVY TRVALÉ TYČOVÉ INJEKTOVANÉ"
    result = classifier.classify(text, unit="ks")

    assert result.work_group == "KOTVENI", \
        f"Expected KOTVENI, got {result.work_group}"
    assert result.work_group != "VYZTUŽ", \
        "Should NOT classify as VYZTUŽ (exclude rule should work)"
    assert result.confidence > 0.5, f"Low confidence: {result.confidence}"

    # Check evidence
    evidence_lower = [e.lower() for e in result.evidence]
    assert any('kotv' in e for e in evidence_lower), \
        f"Evidence missing 'kotvy': {result.evidence}"

    print(f"✅ Test 4 passed: {result.work_group} ({result.confidence:.2f}) - Evidence: {result.evidence}")


def test_correction_mechanism():
    classifier = WorkClassifier()
    """
    Test Case 5: Self-correction mechanism

    Scenario: User corrects misclassification
    Expected: Correction saved and applied
    """
    # Simulate misclassification
    text = "TEST VÝZTUŽ KOTEVNÍ"
    wrong_group = "VYZTUŽ"
    correct_group = "KOTVENI"

    # Add correction
    classifier.add_correction(
        text=text,
        wrong_group=wrong_group,
        correct_group=correct_group,
        scope="global"
    )

    # Verify correction was saved
    assert len(classifier.corrections) > 0, "Correction not saved"

    # Verify rules were updated
    vyztuž_group = classifier.config.groups["VYZTUŽ"]
    kotveni_group = classifier.config.groups["KOTVENI"]

    # Check that keyword was added to exclude/include lists
    # (keyword extraction should pick "kotevní" or similar)
    assert any('kotv' in exc.lower() for exc in vyztuž_group.exclude) or \
           any('kotv' in inc.lower() for inc in kotveni_group.include), \
           "Correction not applied to rules"

    print(f"✅ Test 5 passed: Correction mechanism works")


def test_confidence_scoring():
    classifier = WorkClassifier()
    """
    Test Case 6: Confidence scoring

    Multiple keywords = high confidence
    Single keyword = medium confidence
    No keywords = low confidence
    """
    # High confidence - multiple keywords
    text_high = "VÝKOP JAM HLOUBENÍ PAŽENÍ ČERPÁNÍ VODY"
    result_high = classifier.classify(text_high)
    assert result_high.confidence > 0.8, \
        f"Expected high confidence (>0.8), got {result_high.confidence}"

    # Medium confidence - single keyword
    text_medium = "VÝKOP MATERIÁLU"  # Only "výkop" matches, "materiálu" is generic
    result_medium = classifier.classify(text_medium)
    assert 0.4 <= result_medium.confidence <= 0.6, \
        f"Expected medium confidence (0.4-0.6), got {result_medium.confidence}"

    # Low confidence - ambiguous
    text_low = "DODÁVKA MATERIÁLU"
    result_low = classifier.classify(text_low)
    assert result_low.confidence < 0.5, \
        f"Expected low confidence (<0.5), got {result_low.confidence}"

    print(f"✅ Test 6 passed: Confidence scoring works correctly")


def test_unit_boost():
    classifier = WorkClassifier()
    """
    Test Case 7: Unit of measure boost

    Same text with different units should affect score.
    """
    text = "VÝKOP ZEMINY"

    # With correct unit (m3) - should boost score
    result_with_unit = classifier.classify(text, unit="m3")

    # Without unit
    result_without_unit = classifier.classify(text, unit=None)

    # With wrong unit (kg)
    result_wrong_unit = classifier.classify(text, unit="kg")

    assert result_with_unit.confidence >= result_without_unit.confidence, \
        "Unit boost should increase confidence"

    print(f"✅ Test 7 passed: Unit boost works (with: {result_with_unit.confidence:.2f}, without: {result_without_unit.confidence:.2f})")


def test_priority_over():
    classifier = WorkClassifier()
    """
    Test Case 8: Priority resolution

    BETON_PREFAB has priority over BETON_MONOLIT
    Text with "dílců" should classify as PREFAB, not MONOLIT
    """
    text = "MONTÁŽ DÍLCŮ Z BETONU C30/37"
    result = classifier.classify(text)

    assert result.work_group == "BETON_PREFAB", \
        f"Expected BETON_PREFAB (priority over MONOLIT), got {result.work_group}"

    print(f"✅ Test 8 passed: Priority resolution works ({result.work_group})")


if __name__ == "__main__":
    """Run tests with detailed output."""
    print("\n" + "="*70)
    print("Running Rule-Based Work Classifier Tests")
    print("="*70 + "\n")

    try:
        test_zemni_prace_cerpani_vody()
        test_beton_prefab_obrubnik()
        test_beton_monolit_konstrukce()
        test_kotveni_not_vyztuž()
        test_correction_mechanism()
        test_confidence_scoring()
        test_unit_boost()
        test_priority_over()

        print("\n" + "="*70)
        print("✅ ALL TESTS PASSED")
        print("="*70 + "\n")

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        raise
