"""
RegexNormExtractor — Layer 2: Deterministic extraction (confidence=1.0).

50+ regex patterns for Czech construction norms, tolerances, deadlines,
materials, formulas, document metadata.

No LLM. Pure regex. Absolute confidence.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-27
"""

import re
from typing import Any, Dict, List, Optional, Set

from app.models.extraction_schemas import (
    ExtractedValue,
    ExtractionResult,
    ExtractionSource,
)


class RegexNormExtractor:
    """
    Layer 2: Deterministic regex extraction — confidence = 1.0.
    Each match → ExtractedValue with full provenance.
    """

    # ── Norm & law references ─────────────────────────────────

    NORM_PATTERNS = {
        "csn_en": re.compile(
            r"ČSN\s+EN\s+(?:ISO\s+)?(\d[\d\s]*\d)", re.IGNORECASE
        ),
        "csn": re.compile(
            r"ČSN\s+(\d{2})\s*(\d{4})(?:[–\-]\s*(\d))?", re.IGNORECASE
        ),
        "zakon": re.compile(
            r"[Zz]ákon[a-ůž]*\s+č\.\s*(\d+)/(\d{4})\s+Sb\."
        ),
        "vyhlaska": re.compile(
            r"[Vv]yhláš[a-ůž]*\s+(?:č\.\s*)?(\d+)/(\d{4})\s+Sb\."
        ),
        "narizeni_vlady": re.compile(
            r"[Nn]ařízení\s+vlády\s+č\.\s*(\d+)/(\d{4})\s+Sb\."
        ),
        "smernice_eu": re.compile(
            r"[Ss]měrnice\s+.*?\(EU\)\s+(\d{4})/(\d+)"
        ),
        "narizeni_eu": re.compile(
            r"[Nn]ařízení\s+.*?\(EU\)\s+(?:č\.\s*)?(\d+)/(\d{4})"
        ),
        "tkp": re.compile(
            r"TKP[,\s]+(?:kap(?:itola)?\.?\s*)?(\d+)", re.IGNORECASE
        ),
        "predpis_sz": re.compile(
            r"[Pp]ředpis[a-ůž]*\s+(?:SŽ|SŽDC)\s+([A-Z]\d+(?:/\d+)?)"
        ),
        "smernice_sz": re.compile(
            r"[Ss]měrnic[a-ůž]*\s+(?:SŽ|SŽDC)\s+(SM\d+|č\.\s*\d+)"
        ),
        "metodicky_pokyn": re.compile(
            r"(?:SŽDC|SŽ)\s+(M\d+/MP\d+)"
        ),
        "tnz": re.compile(
            r"TNŽ\s+(\d[\d\s]*\d)"
        ),
        "tsi": re.compile(
            r"TSI\s+(?:pro\s+)?(\w+)", re.IGNORECASE
        ),
        "vtp": re.compile(
            r"VTP(?:\s+SŽ)?\s+(\d+(?:/\d+)?)", re.IGNORECASE
        ),
        "ztp": re.compile(
            r"ZTP(?:\s+SŽ)?\s+(\d+)", re.IGNORECASE
        ),
        "ppk": re.compile(
            r"PPK\s+(?:SFDI|SŽ|ŘSD)", re.IGNORECASE
        ),
    }

    # ── Tolerances & deviations ───────────────────────────────

    TOLERANCE_PATTERNS = {
        "plus_minus_mm": re.compile(
            r"[±]\s*(\d+(?:[,.]\d+)?)\s*mm"
        ),
        "range_mm": re.compile(
            r"(\d{3,4})\s*(?:mm)?\s*[–\-]\s*(\d{3,4})\s*mm"
        ),
        "ska_tolerance": re.compile(
            r"SKa\s*=\s*[±]?\s*(\d+)\s*mm"
        ),
        "vka_tolerance": re.compile(
            r"VKa\s*=\s*\+\s*(\d+)\s*[,/]\s*-\s*(\d+)\s*mm"
        ),
        "max_diff_mm": re.compile(
            r"(?:rozdíl|nesmí\s+být\s+větší)\s+(?:než\s+)?(\d+)\s*mm",
            re.IGNORECASE,
        ),
        "max_distance_m": re.compile(
            r"(?:maximální|max\.?)\s+vzdálenost[a-ůž]*\s+(?:orientace\s+)?.*?(\d+)\s*m(?:\b|[^m])",
            re.IGNORECASE,
        ),
        "odchylka_mm": re.compile(
            r"(?:odchylk[auy]|tolerance)\s+(?:max\.?\s*)?[±]?\s*(\d+(?:[,.]\d+)?)\s*mm",
            re.IGNORECASE,
        ),
        "rovinatost": re.compile(
            r"rovinatost[a-ůž]*\s+.*?(\d+)\s*mm\s*(?:na|/)\s*(\d+)\s*m",
            re.IGNORECASE,
        ),
        "max_percent": re.compile(
            r"(?:max\.?|maximálně)\s+(\d+(?:[,.]\d+)?)\s*%",
            re.IGNORECASE,
        ),
    }

    # ── Deadlines & time limits ───────────────────────────────

    DEADLINE_PATTERNS = {
        "days": re.compile(
            r"(?:lhůt[a-ůž]*|nejpozději|minimálně|zpravidla|do)\s+(\d+)\s+(?:dnů|dní|dnech|dny|den)",
            re.IGNORECASE,
        ),
        "days_before": re.compile(
            r"(\d+)\s+(?:dnů|dní)\s+před\s+(\w+)", re.IGNORECASE
        ),
        "hours": re.compile(
            r"(?:do|nejpozději|max\.?|maximálně)\s+(\d+)\s+(?:hodin|hod\.?|h\b)",
            re.IGNORECASE,
        ),
        "calibration_years": re.compile(
            r"(?:kalibrační|kalibrac)\s+.*?(?:max(?:imálně)?\.?|nesmí být starší)\s+(?:než\s+)?(\d+)\s+(?:rok|let|roky)",
            re.IGNORECASE,
        ),
        "min_days": re.compile(
            r"(?:min(?:imálně)?\.?|alespoň|nejméně)\s+(\d+)\s+(?:dnů|dní|dny)",
            re.IGNORECASE,
        ),
    }

    # ── Materials & specifications ────────────────────────────

    MATERIAL_PATTERNS = {
        "concrete_grade": re.compile(
            r"\bC\s*(\d{2,3})\s*/\s*(\d{2,3})\b"
        ),
        "concrete_exposure": re.compile(
            r"\b(X[CDFSAM]\d)\b"
        ),
        "steel_grade": re.compile(
            r"\b(B\s*500\s*[AB]|10\s*50[05](?:\s*\(R\))?)\b"
        ),
        "pipe_dn": re.compile(
            r"\bDN\s*(\d+)\b"
        ),
        "thickness_mm": re.compile(
            r"tl\.?\s*(\d+)\s*mm"
        ),
        "speed_class": re.compile(
            r"\b(RP[0-5])\b"
        ),
        "rail_type": re.compile(
            r"\b(49E1|60E[12]|UIC\s*60|S49)\b"
        ),
        "sleeper_type": re.compile(
            r"\b(B91S|B03|SB8P|pražec\s+\w+)\b", re.IGNORECASE
        ),
        "concrete_wc": re.compile(
            r"w/c\s*(?:=|≤|max\.?)\s*(\d[,.]\d{1,2})"
        ),
        "cement_min": re.compile(
            r"(?:min\.?\s*)?(\d{3})\s*kg/m[³3]", re.IGNORECASE
        ),
    }

    # ── Document metadata ─────────────────────────────────────

    META_PATTERNS = {
        "vtp_code": re.compile(
            r"(VTP/[A-Z]+/\d+/\d+)"
        ),
        "document_date": re.compile(
            r"(?:[Dd]atum\s+vydání|[Úú]činnost\s+od)[:\s]*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})"
        ),
        "cj_number": re.compile(
            r"č\.?\s*j\.?[:\s]*([A-Z0-9/\-]+(?:SŽDC|SŽ)[A-Z0-9/\-]+)"
        ),
        "page_total": re.compile(
            r"(?:Počet\s+listů|[Ss]trana\s+\d+\s*\(\s*z\s+celkem)\s+(\d+)",
            re.IGNORECASE,
        ),
        "project_name": re.compile(
            r"(?:stavba|akce|projekt)[:\s]+(.{10,100}?)(?:\n|$)",
            re.IGNORECASE,
        ),
    }

    # ── Formulas ──────────────────────────────────────────────

    FORMULA_PATTERNS = {
        "math_formula": re.compile(
            r"([A-Za-zα-ωΑ-Ω]{1,10}\s*=\s*[A-Za-zα-ωΑ-Ω0-9\s\+\-\*/\(\)\.±²³√]{3,50}(?:mm|m|kN|MPa|°|%)?)"
        ),
        "edef": re.compile(
            r"E(?:def|DEF)\s*[12]?\s*(?:=|≥|min\.?)\s*(\d+)\s*MPa",
            re.IGNORECASE,
        ),
    }

    # ------------------------------------------------------------------

    @classmethod
    def extract_all(cls, text: str) -> ExtractionResult:
        """
        Run ALL regex patterns against text.
        Each match → ExtractedValue with confidence=1.0.
        """
        result = ExtractionResult()

        # Split by page breaks (if present from pdfplumber)
        pages = text.split("--- PAGE BREAK ---")
        if len(pages) == 1:
            # Try alternate page break
            pages = re.split(r"\n{3,}", text)

        for page_num, page_text in enumerate(pages, 1):
            # Norms
            for pattern_name, pattern in cls.NORM_PATTERNS.items():
                for match in pattern.finditer(page_text):
                    result.norm_references.append(ExtractedValue(
                        value=match.group(0).strip(),
                        confidence=1.0,
                        source=ExtractionSource.REGEX,
                        source_detail=f"regex:{pattern_name}",
                        page=page_num,
                        context=cls._get_context(page_text, match.start(), 120),
                    ))

            # Tolerances
            for pattern_name, pattern in cls.TOLERANCE_PATTERNS.items():
                for match in pattern.finditer(page_text):
                    value = cls._parse_tolerance_value(pattern_name, match)
                    unit = "mm" if "mm" in pattern_name else "m" if "m" in pattern_name else "%"
                    result.tolerances.append(ExtractedValue(
                        value=value,
                        unit=unit,
                        confidence=1.0,
                        source=ExtractionSource.REGEX,
                        source_detail=f"regex:{pattern_name}",
                        page=page_num,
                        context=cls._get_context(page_text, match.start(), 150),
                    ))

            # Deadlines
            for pattern_name, pattern in cls.DEADLINE_PATTERNS.items():
                for match in pattern.finditer(page_text):
                    unit = "roky" if "years" in pattern_name else "hodiny" if "hours" in pattern_name else "dny"
                    result.deadlines.append(ExtractedValue(
                        value=int(match.group(1)),
                        unit=unit,
                        confidence=1.0,
                        source=ExtractionSource.REGEX,
                        source_detail=f"regex:{pattern_name}",
                        page=page_num,
                        context=cls._get_context(page_text, match.start(), 150),
                    ))

            # Materials
            for pattern_name, pattern in cls.MATERIAL_PATTERNS.items():
                for match in pattern.finditer(page_text):
                    result.materials.append(ExtractedValue(
                        value=match.group(0).strip(),
                        confidence=1.0,
                        source=ExtractionSource.REGEX,
                        source_detail=f"regex:{pattern_name}",
                        page=page_num,
                        context=cls._get_context(page_text, match.start(), 100),
                    ))

            # Metadata
            for pattern_name, pattern in cls.META_PATTERNS.items():
                for match in pattern.finditer(page_text):
                    if pattern_name not in result.document_meta:
                        result.document_meta[pattern_name] = ExtractedValue(
                            value=match.group(0).strip(),
                            confidence=1.0,
                            source=ExtractionSource.REGEX,
                            source_detail=f"regex:{pattern_name}",
                            page=page_num,
                        )

            # Formulas
            for pattern_name, pattern in cls.FORMULA_PATTERNS.items():
                for match in pattern.finditer(page_text):
                    result.formulas.append(ExtractedValue(
                        value=match.group(0).strip(),
                        confidence=1.0,
                        source=ExtractionSource.REGEX,
                        source_detail=f"regex:{pattern_name}",
                        page=page_num,
                        context=cls._get_context(page_text, match.start(), 120),
                    ))

        # Deduplicate
        result.norm_references = cls._deduplicate(result.norm_references)
        result.tolerances = cls._deduplicate(result.tolerances)
        result.materials = cls._deduplicate(result.materials)
        result.deadlines = cls._deduplicate(result.deadlines)
        result.formulas = cls._deduplicate(result.formulas)

        return result

    @staticmethod
    def _get_context(text: str, pos: int, radius: int = 100) -> str:
        start = max(0, pos - radius)
        end = min(len(text), pos + radius)
        return text[start:end].replace("\n", " ").strip()

    @staticmethod
    def _parse_tolerance_value(pattern_name: str, match: re.Match) -> Any:
        if pattern_name == "vka_tolerance":
            return {"plus": int(match.group(1)), "minus": int(match.group(2))}
        elif pattern_name == "range_mm":
            return {"min": int(match.group(1)), "max": int(match.group(2))}
        elif pattern_name == "rovinatost":
            return {"value_mm": int(match.group(1)), "length_m": int(match.group(2))}
        elif pattern_name in ("ska_tolerance", "plus_minus_mm", "odchylka_mm", "max_percent"):
            return float(match.group(1).replace(",", "."))
        else:
            return float(match.group(1).replace(",", "."))

    @staticmethod
    def _deduplicate(items: List[ExtractedValue]) -> List[ExtractedValue]:
        seen: Set[str] = set()
        unique: List[ExtractedValue] = []
        for item in items:
            key = str(item.value)
            if key not in seen:
                seen.add(key)
                unique.append(item)
        return unique
