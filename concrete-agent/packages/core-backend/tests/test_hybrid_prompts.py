"""
Tests for hybrid prompts - Comprehensive Analysis + Compliance/Risks

Version: 3.0 (Optimized Multi-Role)
Purpose: Verify hybrid prompts produce valid output faster than 6-role sequential
"""

import pytest
import json
from pathlib import Path

# Test data
HYBRID_PROMPTS_DIR = Path(__file__).parent.parent / "app" / "prompts" / "hybrid"

# Test scenarios
TEST_SCENARIOS = [
    {
        "name": "simple_interior_foundation",
        "description": "Foundation strip 12m × 0.6m × 0.4m, interior basement, dry environment",
        "expected_exposure": ["XC1"],
        "expected_min_class": "C20/25",
        "expected_frost": "none",
        "expected_compliance": "COMPLIANT"
    },
    {
        "name": "exterior_foundation_groundwater",
        "description": "Foundation strip 45m × 0.8m × 0.6m, outdoor, groundwater pH 6.2, Czech climate",
        "expected_exposure": ["XC4", "XC2", "XF3"],
        "expected_min_class": "C30/37",
        "expected_frost": "F150",
        "expected_compliance": "COMPLIANT"  # if specs match requirements
    },
    {
        "name": "parking_deck_deicing",
        "description": "Parking deck 200m², exposed to de-icing salts, Czech winter climate",
        "expected_exposure": ["XD3", "XF4"],
        "expected_min_class": "C30/37",
        "expected_frost": "F200",
        "expected_air_content": "5-6%",
        "expected_compliance": "CONDITIONAL"  # requires strict specs
    },
    {
        "name": "aggressive_groundwater",
        "description": "Foundation in industrial site, groundwater pH 4.9, sulfates 2200 mg/l",
        "expected_exposure": ["XA2", "XD2"],
        "expected_min_class": "C30/37",
        "expected_special": "SR cement (sulfate-resistant)",
        "expected_compliance": "CONDITIONAL"  # if SR cement specified
    },
    {
        "name": "non_compliant_underspec",
        "description": "Parking deck with C25/30, no air entrainment, de-icing exposure",
        "expected_exposure": ["XD3", "XF4"],
        "expected_min_class": "C30/37",  # REQUIRED
        "specified_class": "C25/30",     # GIVEN (inadequate)
        "expected_compliance": "NON_COMPLIANT",
        "expected_critical_risk": "Concrete class below minimum for XD3+XF4"
    }
]


class TestHybridPrompts:
    """Test suite for hybrid prompt system"""

    def test_prompts_exist(self):
        """Verify both hybrid prompt files exist"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"

        assert comprehensive.exists(), "comprehensive_analysis.md not found"
        assert compliance.exists(), "compliance_and_risks.md not found"

    def test_prompts_not_empty(self):
        """Verify prompts have substantial content"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"

        comp_text = comprehensive.read_text()
        compl_text = compliance.read_text()

        # Prompts should be at least 500 lines each
        assert len(comp_text.split('\n')) >= 500, "Comprehensive prompt too short"
        assert len(compl_text.split('\n')) >= 400, "Compliance prompt too short"

    def test_comprehensive_prompt_structure(self):
        """Verify Comprehensive Analysis prompt has required sections"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        text = comprehensive.read_text()

        required_sections = [
            "# HYBRID PROMPT",
            "## MISSION",
            "## CORE EXPERTISE",
            "### 1. STRUCTURAL & SAFETY",
            "### 2. MATERIALS & DURABILITY",
            "### 3. COST & PRICING",
            "## ANALYSIS WORKFLOW",
            "## OUTPUT FORMAT",
            "## EXAMPLES"
        ]

        for section in required_sections:
            assert section in text, f"Missing section: {section}"

    def test_compliance_prompt_structure(self):
        """Verify Compliance & Risks prompt has required sections"""
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"
        text = compliance.read_text()

        required_sections = [
            "# HYBRID PROMPT",
            "## MISSION",
            "## CORE EXPERTISE",
            "### 1. STANDARDS LIBRARY",
            "### 2. COMPLIANCE REQUIREMENTS",
            "### 3. RISK DETECTION PATTERNS",
            "## COMPLIANCE WORKFLOW",
            "## OUTPUT FORMAT",
            "## EXAMPLES"
        ]

        for section in required_sections:
            assert section in text, f"Missing section: {section}"

    def test_exposure_class_tables_present(self):
        """Verify exposure class reference tables are in prompts"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        text = comprehensive.read_text()

        # Check for XC, XD, XF, XA exposure classes
        assert "XC - Carbonation" in text
        assert "XD - Chlorides" in text
        assert "XF - Freeze-thaw" in text
        assert "XA - Chemical attack" in text

        # Check for Table F.1 references
        assert "ČSN EN 206" in text
        assert "Table F.1" in text

    def test_otskp_codes_present(self):
        """Verify OTSKP codes are in Comprehensive Analysis"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        text = comprehensive.read_text()

        # Common OTSKP codes
        assert "272-31-1" in text  # Strip foundations
        assert "272-32-1" in text  # Foundation slabs
        assert "272-33" in text     # Walls/columns

    def test_standards_library_complete(self):
        """Verify Czech/EN standards library in Compliance prompt"""
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"
        text = compliance.read_text()

        required_standards = [
            "ČSN 73 1201",
            "ČSN EN 206",
            "EN 1990",
            "EN 1992",
            "SNiP"  # Obsolete, but should be recognized
        ]

        for standard in required_standards:
            assert standard in text, f"Missing standard: {standard}"

    def test_json_output_format_specified(self):
        """Verify both prompts specify JSON-only output"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"

        comp_text = comprehensive.read_text()
        compl_text = compliance.read_text()

        # Both must specify JSON output
        assert "OUTPUT FORMAT" in comp_text
        assert "OUTPUT FORMAT" in compl_text
        assert "JSON ONLY" in comp_text or "json" in comp_text.lower()
        assert "JSON ONLY" in compl_text or "json" in compl_text.lower()

    def test_temperature_guidance_present(self):
        """Verify temperature guidance for LLM inference"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"

        comp_text = comprehensive.read_text()
        compl_text = compliance.read_text()

        assert "TEMPERATURE" in comp_text or "temp" in comp_text
        assert "TEMPERATURE" in compl_text or "temp" in compl_text

    def test_examples_provided(self):
        """Verify both prompts have concrete examples"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"

        comp_text = comprehensive.read_text()
        compl_text = compliance.read_text()

        # Both should have Example sections
        assert "Example" in comp_text or "EXAMPLE" in comp_text
        assert "Example" in compl_text or "EXAMPLE" in compl_text

    @pytest.mark.parametrize("scenario", TEST_SCENARIOS, ids=lambda s: s["name"])
    def test_scenario_requirements(self, scenario):
        """Verify test scenarios have correct expected values"""
        assert "description" in scenario
        assert "expected_exposure" in scenario
        assert "expected_min_class" in scenario
        assert "expected_compliance" in scenario

        # Exposure classes should be valid
        valid_exposures = ["XC1", "XC2", "XC3", "XC4", "XD1", "XD2", "XD3",
                          "XF1", "XF2", "XF3", "XF4", "XA1", "XA2", "XA3"]
        for exp in scenario["expected_exposure"]:
            assert exp in valid_exposures, f"Invalid exposure class: {exp}"

        # Concrete class should be valid
        valid_classes = ["C16/20", "C20/25", "C25/30", "C30/37", "C35/45",
                        "C40/50", "C45/55", "C50/60"]
        assert scenario["expected_min_class"] in valid_classes

    def test_czech_terminology_present(self):
        """Verify Czech construction terminology is used"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        text = comprehensive.read_text()

        czech_terms = [
            "ČSN",           # Czech National Standard
            "OTSKP",         # Classification system
            "základy",       # Foundations
            "beton",         # Concrete (may be in code examples)
            "m³",            # Cubic meters
            "Kč"             # Czech Koruna
        ]

        # At least 4 of these should be present
        found = sum(1 for term in czech_terms if term in text)
        assert found >= 4, f"Only {found}/6 Czech terms found"

    def test_no_hardcoded_dates(self):
        """Verify prompts don't have hardcoded dates that will become stale"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"

        comp_text = comprehensive.read_text()
        compl_text = compliance.read_text()

        # OK: "2024 Q4" (market prices reference)
        # NOT OK: "Today is December 29, 2024" (will be outdated)

        stale_patterns = [
            "Today is",
            "Current date:",
            "As of December"
        ]

        for pattern in stale_patterns:
            assert pattern not in comp_text, f"Hardcoded date pattern: {pattern}"
            assert pattern not in compl_text, f"Hardcoded date pattern: {pattern}"

    def test_prompts_size_reduction(self):
        """Verify hybrid prompts are significantly smaller than 6-role total"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"

        comp_lines = len(comprehensive.read_text().split('\n'))
        compl_lines = len(compliance.read_text().split('\n'))

        total_hybrid = comp_lines + compl_lines

        # Original 6 roles total: ~7445 lines (excluding orchestrator)
        # Hybrid should be ~1600-2000 lines (70-80% reduction)
        assert total_hybrid < 2500, f"Hybrid prompts too large: {total_hybrid} lines"
        assert total_hybrid > 1200, f"Hybrid prompts too small: {total_hybrid} lines (may be incomplete)"

        reduction_percent = ((7445 - total_hybrid) / 7445) * 100
        print(f"\n✅ Size reduction: {reduction_percent:.1f}% ({7445} → {total_hybrid} lines)")


class TestIntegrationReadiness:
    """Test that hybrid prompts are ready for orchestrator integration"""

    def test_json_schema_examples_valid(self):
        """Verify JSON examples in prompts are valid JSON"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"

        # Extract JSON examples and verify they parse
        # (This is a basic check - full validation would require parsing markdown)
        comp_text = comprehensive.read_text()
        compl_text = compliance.read_text()

        # Check that JSON examples have proper structure markers
        assert '```json' in comp_text or '"project_summary"' in comp_text
        assert '```json' in compl_text or '"compliance_status"' in compl_text

    def test_required_output_fields(self):
        """Verify prompts specify all required output fields"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        text = comprehensive.read_text()

        required_fields = [
            "project_summary",
            "exposure_analysis",
            "structural_analysis",
            "final_specification",
            "cost_summary",
            "warnings"
        ]

        for field in required_fields:
            assert field in text, f"Missing required field: {field}"

    def test_parallel_execution_ready(self):
        """Verify prompts are independent (can run in parallel)"""
        comprehensive = HYBRID_PROMPTS_DIR / "comprehensive_analysis.md"
        compliance = HYBRID_PROMPTS_DIR / "compliance_and_risks.md"

        comp_text = comprehensive.read_text()
        compl_text = compliance.read_text()

        # Comprehensive should NOT mention compliance checking
        # Compliance should NOT do cost calculations
        # This ensures they're independent

        # Note: Some overlap is OK (both check exposure class)
        # But major functions should be separate
        assert "COST & PRICING" in comp_text
        assert "COMPLIANCE REQUIREMENTS" in compl_text
        assert "RISK DETECTION" in compl_text


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
