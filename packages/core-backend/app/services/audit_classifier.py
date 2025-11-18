"""Assign audit risk levels to validated positions."""

from __future__ import annotations

from typing import Dict, Iterable, List, Tuple


class AuditClassifier:
    """Classify positions into GREEN / AMBER / RED buckets."""

    def classify(
        self, positions: Iterable[Dict[str, object]]
    ) -> Tuple[List[Dict[str, object]], Dict[str, int]]:
        audited: List[Dict[str, object]] = []
        stats = {"green": 0, "amber": 0, "red": 0, "amber_by_reason": {}}

        for position in positions:
            payload = dict(position)
            audit_label = self._classify_single(payload)
            payload["audit"] = audit_label
            stats[audit_label.lower()] += 1
            if audit_label == "AMBER":
                reason = str(payload.get("amber_reason") or "unspecified")
                stats["amber_by_reason"][reason] = (
                    stats["amber_by_reason"].get(reason, 0) + 1
                )
            audited.append(payload)

        return audited, stats

    # ------------------------------------------------------------------

    @staticmethod
    def _classify_single(position: Dict[str, object]) -> str:
        code_missing = not str(position.get("code") or "").strip()
        validation_status = str(position.get("validation_status") or "").lower()
        enrichment_status = str(position.get("enrichment_status") or "").lower()
        unit_price = position.get("unit_price")

        if validation_status == "failed":
            return "RED"

        if code_missing:
            amber_reason = str(position.get("amber_reason") or "").strip()
            if amber_reason:
                return "AMBER"
            return "RED"

        if (
            validation_status == "warning"
            or enrichment_status == "partial"
            or enrichment_status == "unmatched"
            or unit_price in (None, "", 0, 0.0)
        ):
            return "AMBER"

        return "GREEN"


__all__ = ["AuditClassifier"]

