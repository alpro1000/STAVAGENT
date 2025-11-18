"""Workflow A Step 3 – schema validation, deduplication and section tagging."""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Tuple

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.core.config import settings

logger = logging.getLogger(__name__)


class PositionSchema(BaseModel):
    """Strict schema for parsed bill-of-quantities positions."""

    position_number: str | None = Field(default=None)
    description: str = Field(..., min_length=1)
    code: str | None = Field(default=None)
    quantity: float | None = Field(default=None)
    unit: str | None = Field(default=None)
    unit_price: float | None = Field(default=None)
    total_price: float | None = Field(default=None)
    sheet_name: str | None = Field(default=None)
    source_document: str | None = Field(default=None)

    model_config = ConfigDict(extra="allow")

    @field_validator("position_number", mode="before")
    @classmethod
    def _normalise_position_number(cls, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("description", mode="before")
    @classmethod
    def _require_description(cls, value: Any) -> str:
        if value is None:
            raise ValueError("description missing")
        text = str(value).strip()
        if not text:
            raise ValueError("description missing")
        return text

    @field_validator("code", mode="before")
    @classmethod
    def _normalise_code(cls, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip().upper()
        return text or None

    @field_validator("unit", mode="before")
    @classmethod
    def _normalise_unit(cls, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("quantity", "unit_price", "total_price", mode="before")
    @classmethod
    def _convert_numeric(cls, value: Any) -> float | None:
        if value is None or value == "":
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip()
        if not text:
            return None
        text = text.replace(" ", "").replace(",", ".")
        try:
            return float(text)
        except ValueError as exc:  # pragma: no cover - logged for diagnostics
            raise ValueError("not_a_number") from exc


@dataclass(slots=True)
class SchemaValidationResult:
    """Container for schema validation outputs."""

    positions: List[Dict[str, Any]]
    stats: Dict[str, Any]


class PositionValidator:
    """Validate, deduplicate and tag parsed positions (Workflow A Step 3)."""

    def __init__(self) -> None:
        self.section_index = self._load_section_index()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def validate(self, positions: Iterable[Dict[str, Any]]) -> SchemaValidationResult:
        """Validate raw positions and return clean list with statistics."""

        validated: List[Dict[str, Any]] = []
        stats = {
            "input_total": 0,
            "validated_total": 0,
            "invalid_total": 0,
            "duplicates_removed": 0,
            "sections_classified": 0,
            "deduplicated_total": 0,
        }
        dedup_index: set[Tuple[str, str, str, str]] = set()

        for raw_position in positions:
            stats["input_total"] += 1
            if not isinstance(raw_position, dict):
                stats["invalid_total"] += 1
                logger.debug("Skipping non-dict position: %r", raw_position)
                continue

            try:
                schema = PositionSchema.model_validate(raw_position)
            except ValidationError as exc:
                stats["invalid_total"] += 1
                logger.debug("Schema validation failed: %s", exc)
                continue

            payload = schema.model_dump()
            dedup_key = self._build_dedup_key(payload)
            if dedup_key in dedup_index:
                stats["duplicates_removed"] += 1
                continue

            dedup_index.add(dedup_key)

            section_meta = self._classify_section(payload.get("code"))
            if section_meta:
                payload.update(section_meta)
                stats["sections_classified"] += 1

            validated.append(payload)

        stats["validated_total"] = len(validated)
        stats["deduplicated_total"] = len(validated)

        logger.info(
            "Schema validation complete → input=%s, valid=%s, duplicates_removed=%s, invalid=%s",
            stats["input_total"],
            stats["validated_total"],
            stats["duplicates_removed"],
            stats["invalid_total"],
        )

        return SchemaValidationResult(positions=validated, stats=stats)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_dedup_key(position: Dict[str, Any]) -> Tuple[str, str, str, str]:
        """Create a hashable key that represents a unique position."""

        code = re.sub(r"[^A-Z0-9]", "", str(position.get("code") or "").upper())
        description = re.sub(r"\s+", " ", str(position.get("description") or "").strip().lower())
        unit = str(position.get("unit") or "").strip().lower()
        quantity = position.get("quantity")
        quantity_token = f"{quantity:.6f}" if isinstance(quantity, (int, float)) else ""

        return code, description, unit, quantity_token

    def _classify_section(self, code: str | None) -> Dict[str, str] | None:
        """Map ÚRS/KROS code to high level section metadata."""

        if not code:
            return None

        digits = re.sub(r"\D", "", code)
        if not digits:
            return None

        for length in (3, 1):
            if len(digits) < length:
                continue
            prefix = digits[:length]
            section = self.section_index.get(prefix)
            if section:
                return {
                    "section": section["code"],
                    "section_name": section.get("name"),
                    "section_type": section.get("type"),
                }

        return None

    def _load_section_index(self) -> Dict[str, Dict[str, str]]:
        """Load section metadata from the knowledge base."""

        structure_path = settings.KB_DIR / "B1_otkskp_codes" / "structure.json"
        if not structure_path.exists():
            logger.warning("Section structure file missing at %s", structure_path)
            return {}

        try:
            with structure_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except json.JSONDecodeError as exc:  # pragma: no cover - configuration issue
            logger.error("Failed to parse section structure file: %s", exc)
            return {}

        index: Dict[str, Dict[str, str]] = {}
        structure = payload.get("tskp_structure", {})

        for category in (structure.get("hsv_categories") or {}).values():
            code = str(category.get("code") or "").strip()
            if code:
                index[code] = {
                    "code": code,
                    "name": category.get("name", ""),
                    "type": category.get("type", "HSV"),
                }
            for example in category.get("example_codes") or []:
                example_code = str(example).strip()
                if example_code and example_code not in index:
                    index[example_code] = {
                        "code": code,
                        "name": category.get("name", ""),
                        "type": category.get("type", "HSV"),
                    }

        for category in (structure.get("psv_categories") or {}).values():
            code = str(category.get("code") or "").strip()
            if not code:
                continue
            index[code] = {
                "code": code,
                "name": category.get("name", ""),
                "type": category.get("type", "PSV"),
            }

        return index


__all__ = ["PositionValidator", "SchemaValidationResult"]
