"""Normalisation utilities for bill-of-quantities tables (Task H)."""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Header aliases (case-insensitive, diacritics ignored)
# ---------------------------------------------------------------------------


HEADER_ALIASES: Dict[str, set[str]] = {
    "code": {
        "kód",
        "kód položky",
        "číslo položky",
        "kod",
        "kod položky",
        "kod_polozky",
        "kód polož.",
        "č.položky",
    },
    "description": {
        "popis",
        "úplný popis",
        "popis položky",
        "název",
        "opis",
    },
    "unit": {
        "mj",
        "měrná jednotka",
        "jedn.",
        "jednotka",
    },
    "quantity": {
        "množství",
        "množství celkem",
        "množ.",
        "qty",
    },
    "unit_price": {
        "cena jednotková",
        "jedn. cena",
        "cena/jedn.",
        "jednotková cena",
    },
    "total_price": {
        "cena celkem",
        "celkem",
        "součet",
        "cena bez dph",
        "cena s dph",
    },
}

# Additional explicit mappings for complex Czech headers (normalized keys)
# Use normalized header keys (see _normalise_header_key)
CZECH_HEADER_MAPPING: Dict[str, str] = {
    # multi-line 'rozhled' header observed in logs (maps to description)
    _normalise_header_key(
        "Délka rozhledu předepsaná (m)\nDélka rozhledu dosažená (m)\nRozhled. Délka předepsaná (m)\n- od začátku trati *\n- od konce trati *\nRozhled. Délka dosažená (m)\n- od začátku trati *\n- od konce trati *"
    ): "description",

    # common Czech headers
    _normalise_header_key("Položka"): "description",
    _normalise_header_key("Množství"): "quantity",
    _normalise_header_key("Jednotka"): "unit",
    _normalise_header_key("Jednotková cena"): "unit_price",
    _normalise_header_key("Cena celkem"): "total_price",
}


CODE_PATTERN = re.compile(r"^\d{4,6}(?:[.\-][A-Z0-9])?$")
SECTION_PREFIX = re.compile(r"^(?:\d+[.)]?|[IVXLCDM]+\.)\s+")
RESOURCE_KEYWORDS = (
    "kalkulace s rozbory",
    "rozbory",
    "tov",
)
EMPTY_NUMERIC_TOKENS = {"", "-", "–", "—"}
NBSP = "\xa0"
NARROW_NBSP = "\u202f"
THIN_SPACE = "\u2009"
THOUSAND_SEPARATORS = {" ", NBSP, NARROW_NBSP, THIN_SPACE}
NON_NUMERIC_PATTERN = re.compile(r"[^0-9,\.\-+]")


def _strip_diacritics(value: str) -> str:
    """Remove diacritics from text using NFKD normalisation."""

    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _normalise_header_key(value: str) -> str:
    """Normalise header text for alias lookup."""

    text = value.strip().lower()
    text = text.replace("_", " ").replace("/", " ")
    text = _strip_diacritics(text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _coerce_to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        parts = [str(item).strip() for item in value if item is not None]
        return " ".join(part for part in parts if part)
    return str(value).strip()


# ---------------------------------------------------------------------------
# Legacy normaliser (fallback)
# ---------------------------------------------------------------------------


class _LegacyPositionNormalizer:
    """Original implementation kept for fallback compatibility."""

    FIELD_MAPPING = {
        "description": "description",
        "desc": "description",
        "popis": "description",
        "opis": "description",
        "nazev": "description",
        "name": "description",
        "text": "description",
        "работа": "description",
        "position_number": "position_number",
        "pos_number": "position_number",
        "number": "position_number",
        "cislo": "position_number",
        "c": "position_number",
        "№": "position_number",
        "no": "position_number",
        "code": "code",
        "kod": "code",
        "kód": "code",
        "urs_code": "code",
        "kros_code": "code",
        "quantity": "quantity",
        "qty": "quantity",
        "mnozstvi": "quantity",
        "množství": "quantity",
        "amount": "quantity",
        "pocet": "quantity",
        "mn": "quantity",
        "количество": "quantity",
        "unit": "unit",
        "mj": "unit",
        "jednotka": "unit",
        "measure": "unit",
        "ед": "unit",
        "unit_price": "unit_price",
        "price": "unit_price",
        "cena": "unit_price",
        "cena_jednotkova": "unit_price",
        "jednotkova_cena": "unit_price",
        "price_per_unit": "unit_price",
        "цена": "unit_price",
        "total_price": "total_price",
        "total": "total_price",
        "celkem": "total_price",
        "celkova_cena": "total_price",
        "price_total": "total_price",
        "итого": "total_price",
    }

    @classmethod
    def normalize(cls, position: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not isinstance(position, dict):
            return None

        normalized: Dict[str, Any] = {}

        for key, value in position.items():
            if not key:
                continue
            clean_key = str(key).lower().strip()
            standard_key = cls.FIELD_MAPPING.get(clean_key, clean_key)
            clean_value = cls._clean_value(value)
            if clean_value is not None:
                normalized[standard_key] = clean_value

        normalized = cls._extract_missing_fields(normalized, position)
        normalized = cls._convert_types(normalized)

        if not cls._has_required_fields(normalized):
            return None

        return normalized

    @staticmethod
    def _clean_value(value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            value = re.sub(r"\s+", " ", value)
            if not value or value in {"", "-", "N/A", "null", "None"}:
                return None
        return value

    @classmethod
    def _extract_missing_fields(
        cls, normalized: Dict[str, Any], original: Dict[str, Any]
    ) -> Dict[str, Any]:
        if "description" not in normalized or not normalized.get("description"):
            for key, value in original.items():
                if isinstance(value, str) and len(value) > 5:
                    if not re.match(r"^[\d\s\.,\-]+$", value):
                        normalized["description"] = value
                        break

        if "code" not in normalized or not normalized.get("code"):
            for key, value in original.items():
                if isinstance(value, str):
                    if re.match(r"^\d{2,3}[\-\.]\d{2}[\-\.]\d{3}$", value):
                        normalized["code"] = value
                        break

        return normalized

    @staticmethod
    def _convert_types(position: Dict[str, Any]) -> Dict[str, Any]:
        if "quantity" in position:
            try:
                qty_str = str(position["quantity"]).replace(",", ".").replace(" ", "")
                position["quantity"] = float(qty_str)
            except (ValueError, TypeError):
                position["quantity"] = 0.0

        if "unit_price" in position:
            try:
                price_str = str(position["unit_price"]).replace(",", ".").replace(" ", "")
                position["unit_price"] = float(price_str)
            except (ValueError, TypeError):
                position["unit_price"] = None

        if "total_price" in position:
            try:
                total_str = str(position["total_price"]).replace(",", ".").replace(" ", "")
                position["total_price"] = float(total_str)
            except (ValueError, TypeError):
                position["total_price"] = None

        return position

    @staticmethod
    def _has_required_fields(position: Dict[str, Any]) -> bool:
        has_description = bool(position.get("description"))
        has_quantity = (
            "quantity" in position
            and position["quantity"] is not None
            and float(position["quantity"]) > 0
        )
        return has_description and has_quantity

    @classmethod
    def normalize_list(
        cls, positions: Iterable[Dict[str, Any]], return_stats: bool = False
    ) -> Tuple[List[Dict[str, Any]], Dict[str, int]] | List[Dict[str, Any]]:
        source = list(positions)
        normalized: List[Dict[str, Any]] = []
        skipped = 0

        for idx, pos in enumerate(source):
            result = cls.normalize(pos)
            if result:
                if "position_number" not in result:
                    result["position_number"] = str(idx + 1)
                normalized.append(result)
            else:
                skipped += 1

        stats = {
            "raw_total": len(source),
            "normalized_total": len(normalized),
            "skipped_total": skipped,
        }

        if return_stats:
            return normalized, stats

        return normalized


# ---------------------------------------------------------------------------
# Task H normaliser
# ---------------------------------------------------------------------------


@dataclass
class NormalisationResult:
    positions: List[Dict[str, Any]]
    stats: Dict[str, Any]


class OTSKPEstimateNormalizer:
    """Normalizer implementing Task H requirements."""

    alias_lookup: Dict[str, str] = {}

    def __init__(self, rows: Iterable[Dict[str, Any]]):
        self.rows = list(rows or [])
        if not self.alias_lookup:
            self.alias_lookup = self._build_alias_lookup()

        self.header_map: Dict[str, str] = {}
        self.unknown_headers: set[str] = set()
        self.code_headers: set[str] = set()
        self.code_samples: List[str] = []
        self.section_rows = 0
        self.resource_rows = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def normalize(self) -> NormalisationResult:
        normalized_positions: List[Dict[str, Any]] = []

        for raw_row in self.rows:
            if not isinstance(raw_row, dict):
                continue

            normalized = self._normalize_row(raw_row)
            if normalized is None:
                continue

            if normalized.pop("section_row", False):
                self.section_rows += 1
                continue

            if normalized.get("resource_row"):
                self.resource_rows += 1

            normalized_positions.append(normalized)

        stats = self._build_stats(normalized_positions)

        return NormalisationResult(positions=normalized_positions, stats=stats)

    # ------------------------------------------------------------------
    # Row handling
    # ------------------------------------------------------------------

    def _normalize_row(self, row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        header_lookup = row.get("_header_map") if isinstance(row.get("_header_map"), dict) else {}
        sheet_name = row.get("_sheet_name") if isinstance(row.get("_sheet_name"), str) else None
        row_values = row.get("_row_values") if isinstance(row.get("_row_values"), list) else []
        first_value = row.get("_row_first_value")
        source_ref = row.get("_source")

        canonical_payload: Dict[str, Any] = {}

        for key, value in row.items():
            if key.startswith("_"):
                continue

            raw_header = header_lookup.get(key) or key
            canonical_field = self._resolve_field(raw_header)

            if canonical_field:
                if canonical_field == "code":
                    self.code_headers.add(str(raw_header))
                if raw_header and raw_header not in self.header_map:
                    self.header_map[str(raw_header)] = canonical_field
            else:
                if raw_header:
                    self.unknown_headers.add(str(raw_header))
                continue

            cell_value = _coerce_to_text(value)
            if not cell_value:
                continue
            canonical_payload.setdefault(canonical_field, cell_value)

        if not canonical_payload:
            return None

        description = canonical_payload.get("description")
        if description:
            canonical_payload["description"] = self._normalise_description(description)

        code = canonical_payload.get("code")
        parsed_code = self._parse_code(code) if code else None
        if parsed_code:
            canonical_payload["code"] = parsed_code
            if parsed_code not in self.code_samples and len(self.code_samples) < 12:
                self.code_samples.append(parsed_code)
        elif "code" in canonical_payload:
            canonical_payload.pop("code", None)

        for numeric_field in ("quantity", "unit_price", "total_price"):
            if numeric_field in canonical_payload:
                parsed_number, was_normalised = self._parse_number(
                    canonical_payload[numeric_field], field=numeric_field
                )
                if parsed_number is None:
                    canonical_payload.pop(numeric_field, None)
                else:
                    canonical_payload[numeric_field] = parsed_number
                    if was_normalised:
                        normalised_fields = canonical_payload.setdefault(
                            "_normalised_fields", []
                        )
                        if numeric_field not in normalised_fields:
                            normalised_fields.append(numeric_field)

        if "unit" in canonical_payload:
            canonical_payload["unit"] = canonical_payload["unit"].upper()

        if source_ref:
            canonical_payload["source_ref"] = source_ref
        if sheet_name:
            canonical_payload["sheet_name"] = sheet_name

        description_text = canonical_payload.get("description", "")
        if self._is_section_row(description_text, first_value, canonical_payload):
            return {"section_row": True, "description": description_text}

        if self._is_resource_row(description_text, row_values):
            canonical_payload["resource_row"] = True

        if not description_text:
            return None

        return canonical_payload

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_stats(self, positions: List[Dict[str, Any]]) -> Dict[str, Any]:
        raw_total = len(self.rows)
        normalized_total = len(positions)
        skipped_total = raw_total - normalized_total

        evidence = {
            "headers": sorted({header for header in self.code_headers if header}),
            "code_samples": self.code_samples[:10],
        }

        format_detected = (
            "OTSKP"
            if len(evidence["code_samples"]) >= 10 and evidence["headers"]
            else "UNKNOWN"
        )

        stats = {
            "raw_total": raw_total,
            "normalized_total": normalized_total,
            "skipped_total": skipped_total,
            "format": format_detected,
            "evidence": evidence,
            "header_map": self.header_map,
            "numbers_locale": "EU",
            "positions": {
                "total": normalized_total,
                "sections": self.section_rows,
                "resources": self.resource_rows,
            },
            "unknown_headers": sorted(self.unknown_headers),
        }

        logger.info("format=%s, evidence=%s", stats["format"], stats["evidence"])
        logger.info("header_map=%s", stats["header_map"])
        if self.unknown_headers:
            for header in sorted(self.unknown_headers):
                logger.warning('unknown_header="%s"', header)
        logger.info("numbers_locale=%s", stats["numbers_locale"])
        logger.info(
            "positions: total=%s, sections=%s, resources=%s",
            stats["positions"]["total"],
            stats["positions"]["sections"],
            stats["positions"]["resources"],
        )

        return stats

    @classmethod
    def _build_alias_lookup(cls) -> Dict[str, str]:
        lookup: Dict[str, str] = {}
        for canonical, aliases in HEADER_ALIASES.items():
            lookup[_normalise_header_key(canonical)] = canonical
            for alias in aliases:
                lookup[_normalise_header_key(alias)] = canonical
        return lookup

    def _resolve_field(self, header: str) -> Optional[str]:
        if not header:
            return None
        normalized = _normalise_header_key(str(header))
        if not normalized:
            return None
        return self.alias_lookup.get(normalized)

    @staticmethod
    def _normalise_description(value: str) -> str:
        text = re.sub(r"\s+", " ", value).strip()
        return text

    def _parse_code(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            if float(value).is_integer():
                digits = str(int(value))
            else:
                digits = str(value)
        else:
            digits = str(value)

        digits = digits.replace(NBSP, " ")
        digits = re.sub(r"\s+", "", digits.upper())
        if CODE_PATTERN.match(digits):
            return digits
        return None

    @staticmethod
    def _detect_decimal_separator(text: str) -> Optional[str]:
        last_comma = text.rfind(",")
        last_dot = text.rfind(".")
        if last_comma == -1 and last_dot == -1:
            return None
        if last_comma > last_dot:
            return ","
        if last_dot > last_comma:
            return "."
        # Both separators occur in the same position (unlikely) → prefer comma for EU inputs
        return "," if last_comma != -1 else "."

    def _parse_number(self, value: Any, field: Optional[str] = None) -> Tuple[Optional[float], bool]:
        """Parse numeric fields handling EU thousands separators."""

        if value is None:
            return None, False
        if isinstance(value, (int, float)):
            return float(value), False

        text = str(value).strip()
        if not text:
            return None, False

        normalized = unicodedata.normalize("NFKC", text)
        for separator in (NBSP, NARROW_NBSP, THIN_SPACE):
            normalized = normalized.replace(separator, " ")

        if normalized in EMPTY_NUMERIC_TOKENS:
            return None, False

        decimal_sep = self._detect_decimal_separator(normalized)

        # Remove thousands separators and unexpected characters while tracking sanitisation
        sanitised = normalized.replace(" ", "")
        sanitised = NON_NUMERIC_PATTERN.sub("", sanitised)
        had_non_numeric = sanitised != normalized.replace(" ", "")

        if decimal_sep == ",":
            sanitised = sanitised.replace(".", "")
            sanitised = sanitised.replace(",", ".")
        elif decimal_sep == ".":
            sanitised = sanitised.replace(",", "")
        else:
            sanitised = sanitised.replace(",", "")

        for separator in THOUSAND_SEPARATORS:
            sanitised = sanitised.replace(separator, "")

        sanitised = sanitised.strip()
        if sanitised in {"", ".", "-", "+", "-.", "+."}:
            return None, had_non_numeric

        try:
            parsed = float(sanitised)
        except ValueError:
            logger.warning(
                "numeric_autofix_failed field=%s raw=%r sanitised=%r",
                field or "unknown",
                text,
                sanitised,
            )
            return None, True

        if had_non_numeric:
            logger.warning(
                "numeric_autofix field=%s raw=%r normalised=%s",
                field or "unknown",
                text,
                sanitised,
            )
        elif sanitised != text:
            logger.debug(
                "numeric_normalised field=%s raw=%r normalised=%s",
                field or "unknown",
                text,
                sanitised,
            )

        return parsed, sanitised != text

    def _is_section_row(
        self,
        description: str,
        first_value: Any,
        payload: Dict[str, Any],
    ) -> bool:
        if payload.get("quantity") is not None:
            return False
        if payload.get("unit_price") is not None:
            return False
        if payload.get("total_price") is not None:
            return False

        candidate = _coerce_to_text(first_value) or description
        candidate = candidate.strip()
        if not candidate:
            return False
        ascii_candidate = _strip_diacritics(candidate)
        upper_candidate = ascii_candidate.upper()
        if SECTION_PREFIX.match(upper_candidate):
            return True
        lower_candidate = upper_candidate.lower()
        for keyword in ("rekap", "souhrn", "součet", "soucet", "celkem"):
            if keyword in lower_candidate:
                return True
        return False

    def _is_resource_row(self, description: str, row_values: List[Any]) -> bool:
        combined = " ".join(str(value).lower() for value in row_values if value)
        text = f"{description} {combined}".lower()
        return any(keyword in text for keyword in RESOURCE_KEYWORDS)


# ---------------------------------------------------------------------------
# Public convenience functions
# ---------------------------------------------------------------------------


def normalize_positions(
    positions: Iterable[Dict[str, Any]],
    return_stats: bool = False,
) -> List[Dict[str, Any]] | Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Normalize raw position rows into canonical schema."""

    if settings.PARSER_H_ENABLE:
        normalizer = OTSKPEstimateNormalizer(positions)
        result = normalizer.normalize()
        if return_stats:
            return result.positions, result.stats
        return result.positions

    legacy_positions, legacy_stats = _LegacyPositionNormalizer.normalize_list(
        positions, return_stats=True
    )
    if return_stats:
        return legacy_positions, legacy_stats
    return legacy_positions


def normalize_position(position: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Normalise a single position (legacy compatibility)."""

    if settings.PARSER_H_ENABLE:
        normalizer = OTSKPEstimateNormalizer([position])
        result = normalizer.normalize()
        return result.positions[0] if result.positions else None

    return _LegacyPositionNormalizer.normalize(position)


if __name__ == "__main__":
    sample = {
        "kód položky": "22694.R",
        "popis": "Beton C25/30",
        "mj": "m3",
        "množství": "834,506",
        "cena celkem": "1 234 567,89",
    }
    rows, stats = normalize_positions([sample], return_stats=True)
    print(rows)
    print(stats)
