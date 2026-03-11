"""
Rule-Based Work Classifier

Deterministic classification system for construction work items.
Uses YAML rules instead of LLM guessing.

Features:
- Transparent scoring algorithm
- Self-correction mechanism
- Evidence trail for debugging
- Priority resolution for conflicts
"""

import yaml
import re
import unicodedata
from pathlib import Path
from datetime import datetime
from typing import Optional
from .rules.rules_schema import WorkGroup, ClassificationResult, CorrectionRule, RulesConfig


class WorkClassifier:
    """
    Rule-based classifier for construction work items.

    Loads rules from YAML, applies scoring algorithm,
    and provides self-correction mechanism.
    """

    def __init__(
        self,
        rules_path: Optional[str] = None,
        corrections_path: Optional[str] = None
    ):
        """
        Initialize classifier with rules.

        Args:
            rules_path: Path to default_rules.yaml
            corrections_path: Path to corrections.yaml
        """
        if rules_path is None:
            rules_path = Path(__file__).parent / "rules" / "default_rules.yaml"
        if corrections_path is None:
            corrections_path = Path(__file__).parent / "rules" / "corrections.yaml"

        self.rules_path = Path(rules_path)
        self.corrections_path = Path(corrections_path)

        # Load rules
        self.config = self._load_rules(self.rules_path)
        self.corrections = self._load_corrections(self.corrections_path)

        # Apply corrections to rules
        self._apply_corrections()

    def _load_rules(self, path: Path) -> RulesConfig:
        """Load and validate rules from YAML."""
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        # Convert dict to WorkGroup objects
        groups = {}
        for group_name, group_data in data.get('groups', {}).items():
            group_data['name'] = group_name
            groups[group_name] = WorkGroup(**group_data)

        return RulesConfig(
            version=data.get('version', '1.0.0'),
            groups=groups
        )

    def _load_corrections(self, path: Path) -> list[CorrectionRule]:
        """Load user corrections from YAML."""
        if not path.exists():
            return []

        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        corrections_list = data.get('corrections', [])
        return [CorrectionRule(**c) for c in corrections_list]

    def _apply_corrections(self):
        """Apply user corrections to loaded rules."""
        for correction in self.corrections:
            wrong_group = self.config.groups.get(correction.wrong_group)
            correct_group = self.config.groups.get(correction.correct_group)

            if wrong_group and correction.keyword:
                # Add keyword to exclude list of wrong group
                if correction.keyword not in wrong_group.exclude:
                    wrong_group.exclude.append(correction.keyword)

            if correct_group and correction.keyword:
                # Add keyword to include list of correct group
                if correction.keyword not in correct_group.include:
                    correct_group.include.append(correction.keyword)

    def _normalize_text(self, text: str) -> str:
        """
        Normalize text for matching.

        - Lowercase
        - Remove diacritics (ř→r, č→c, ů→u)
        - Keep spaces
        """
        text = text.lower()
        # Remove diacritics
        text = ''.join(
            c for c in unicodedata.normalize('NFD', text)
            if unicodedata.category(c) != 'Mn'
        )
        return text

    def _extract_keyword(self, text: str) -> Optional[str]:
        """
        Extract most significant keyword from text.

        Used for corrections.
        """
        normalized = self._normalize_text(text)
        words = normalized.split()

        # Filter stop words
        stop_words = {'z', 'ze', 'do', 'na', 'v', 've', 'pro', 'pri', 'od', 'po', 'se', 'a', 'i'}
        keywords = [w for w in words if len(w) > 3 and w not in stop_words]

        # Return first significant word
        return keywords[0] if keywords else None

    def _calculate_score(
        self,
        text: str,
        group: WorkGroup,
        unit: Optional[str] = None
    ) -> tuple[float, list[str]]:
        """
        Calculate match score for a work group.

        Args:
            text: Normalized input text
            group: Work group to match against
            unit: Unit of measure (optional boost)

        Returns:
            (score, evidence_list)

        Scoring algorithm:
            +1.0 for each include match
            -2.0 for each exclude match (stronger penalty)
            +0.5 for unit match
            +0.3 for priority bonus
        """
        score = 0.0
        evidence = []

        # Check include patterns
        for keyword in group.include:
            keyword_norm = self._normalize_text(keyword)
            if keyword_norm in text:
                score += 1.0
                evidence.append(keyword)

        # Check exclude patterns (strong penalty)
        for keyword in group.exclude:
            keyword_norm = self._normalize_text(keyword)
            if keyword_norm in text:
                score -= 2.0

        # Unit boost
        if unit and group.boost_units:
            unit_norm = self._normalize_text(unit)
            for boost_unit in group.boost_units:
                boost_norm = self._normalize_text(boost_unit)
                if unit_norm == boost_norm or unit_norm.replace('³', '3') == boost_norm.replace('³', '3'):
                    score += 0.5
                    break

        # Code boost
        if group.boost_codes:
            for code in group.boost_codes:
                if code in text:  # Codes are case-sensitive (C30/37)
                    score += 0.5
                    evidence.append(code)
                    break

        return score, evidence

    def _determine_subtype(
        self,
        text: str,
        group: WorkGroup
    ) -> str:
        """
        Determine specific subtype within group.

        Args:
            text: Normalized input text
            group: Work group with subtypes

        Returns:
            Subtype name or "GENERAL"
        """
        if not group.subtypes:
            return "GENERAL"

        best_subtype = "GENERAL"
        best_score = 0

        for subtype_name, keywords in group.subtypes.items():
            subtype_score = 0
            for keyword in keywords:
                keyword_norm = self._normalize_text(keyword)
                if keyword_norm in text:
                    subtype_score += 1

            if subtype_score > best_score:
                best_score = subtype_score
                best_subtype = subtype_name

        return best_subtype

    def classify(
        self,
        text: str,
        unit: Optional[str] = None,
        context_lines: Optional[list[str]] = None
    ) -> ClassificationResult:
        """
        Classify work item using rule-based algorithm.

        Args:
            text: Item description text
            unit: Unit of measure (m3, kg, etc.)
            context_lines: Surrounding lines for context (optional)

        Returns:
            ClassificationResult with evidence trail

        Algorithm:
            1. Normalize text
            2. Calculate score for each group
            3. Apply priority_over rules
            4. Determine subtype
            5. Return result with confidence
        """
        text_norm = self._normalize_text(text)

        # Calculate scores for all groups
        scores = {}
        all_evidence = {}

        for group_name, group in self.config.groups.items():
            score, evidence = self._calculate_score(text_norm, group, unit)
            scores[group_name] = score
            all_evidence[group_name] = evidence

        # Apply priority rules
        for group_name, group in self.config.groups.items():
            if group.priority_over and scores[group_name] > 0:
                for target_group in group.priority_over:
                    if target_group in scores and scores[target_group] > 0:
                        # Boost this group if it has priority
                        scores[group_name] += 0.3

        # Find best match
        if not scores or max(scores.values()) <= 0:
            # No match found
            return ClassificationResult(
                work_group="UNKNOWN",
                work_type="UNKNOWN",
                confidence=0.0,
                evidence=[],
                rule_hit="no_match"
            )

        best_group = max(scores, key=scores.get)
        best_score = scores[best_group]
        group = self.config.groups[best_group]

        # Determine subtype
        subtype = self._determine_subtype(text_norm, group)

        # Calculate confidence (normalize score to 0.0-1.0)
        # Score > 2.0 = 1.0 (very confident)
        # Score 1.0-2.0 = 0.5-1.0 (medium-high)
        # Score < 1.0 = 0.0-0.5 (low)
        confidence = min(1.0, best_score / 2.0) if best_score > 0 else 0.0

        # Limit evidence to 4 most relevant keywords
        evidence = all_evidence[best_group][:4]

        # Build rule hit string
        rule_hit = f"{best_group}.include[{','.join(evidence[:2])}]"

        return ClassificationResult(
            work_group=best_group,
            work_type=subtype,
            confidence=confidence,
            evidence=evidence,
            rule_hit=rule_hit
        )

    def add_correction(
        self,
        text: str,
        wrong_group: str,
        correct_group: str,
        scope: str = "project"
    ):
        """
        Add user correction for misclassification.

        This enables self-learning by modifying rules based on user feedback.

        Args:
            text: Original misclassified text
            wrong_group: Incorrect classification
            correct_group: Correct classification
            scope: "project" or "global"
        """
        # Extract keyword from text
        keyword = self._extract_keyword(text)

        # Create correction
        correction = CorrectionRule(
            text=text,
            wrong_group=wrong_group,
            correct_group=correct_group,
            scope=scope,
            keyword=keyword,
            created_at=datetime.now().isoformat()
        )

        # Add to corrections list
        self.corrections.append(correction)

        # Apply immediately to loaded rules
        wrong = self.config.groups.get(wrong_group)
        correct = self.config.groups.get(correct_group)

        if wrong and keyword:
            if keyword not in wrong.exclude:
                wrong.exclude.append(keyword)

        if correct and keyword:
            if keyword not in correct.include:
                correct.include.append(keyword)

        # Save to YAML
        self._save_corrections()

    def _save_corrections(self):
        """Save corrections to YAML file."""
        data = {
            'version': '1.0.0',
            'corrections': [c.dict() for c in self.corrections]
        }

        with open(self.corrections_path, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, sort_keys=False)


# Singleton instance
_classifier_instance = None


def get_classifier() -> WorkClassifier:
    """Get singleton classifier instance."""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = WorkClassifier()
    return _classifier_instance
