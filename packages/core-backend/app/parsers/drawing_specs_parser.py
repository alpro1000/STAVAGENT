"""Utility to extract technical specifications from drawing PDFs.

The parser relies on :mod:`pdfplumber` – the same backend that powers the
``PDFParser`` used for cost documents – to keep the behaviour consistent across
the pipeline.  It scans each page line-by-line and looks for typical technical
markers such as concrete classes (``C30/37``), reinforcement grades (``B500B``)
and exposure classes (``XC3``, ``XF2`` …).  Whenever a line contains a marker
the parser emits a lightweight specification record that will later be used for
position enrichment.

Each specification record contains:

``file``
    Source drawing filename.
``page``
    Page number in the PDF (1-based).
``anchor``
    The strongest marker detected in the line (used for matching).
``text``
    Full line text for human inspection.
``confidence``
    Heuristic confidence score (0–1) based on the amount of technical data
    detected.
``technical_specs``
    Structured data extracted from the line (concrete class, exposures, unit …).

The module is intentionally deterministic – no ML/OCR is involved – which makes
it suitable for background processing and caching.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.services.pdf_text_recovery import PdfRecoverySummary, PdfTextRecovery

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DrawingSpecification:
    """Parsed specification snippet coming from a drawing."""

    file: str
    page: int
    anchor: str
    text: str
    confidence: float
    technical_specs: Dict[str, object]

    def to_dict(self) -> Dict[str, object]:
        """Return a JSON-serialisable representation."""

        return {
            "file": self.file,
            "page": self.page,
            "anchor": self.anchor,
            "text": self.text,
            "confidence": round(self.confidence, 4),
            "technical_specs": dict(self.technical_specs),
        }


class DrawingSpecsParser:
    """Parse PDF drawings and extract technical specification snippets."""

    # Regex snippets used as anchors.
    CONCRETE_PATTERN = re.compile(r"C\d{2}/\d{2}", re.IGNORECASE)
    REINFORCEMENT_PATTERN = re.compile(r"B\d{3}[A-Z]?", re.IGNORECASE)
    STEEL_PATTERN = re.compile(r"S\d{3}", re.IGNORECASE)
    EXPOSURE_PATTERN = re.compile(r"X[ACDFS][0-9](?:[AB])?", re.IGNORECASE)
    UNIT_PATTERN = re.compile(r"\b(m3|m2|m|kg|ks|t|m\s*3|m\s*2)\b", re.IGNORECASE)
    MESH_PATTERN = re.compile(
        r"(?:Ø|⌀)\s*\d{1,2}\s*@?\s*\d{2,3}|\b\d{1,2}\s*@\s*\d{2,3}\b",
        re.IGNORECASE,
    )
    RADIUS_PATTERN = re.compile(r"R\s*=\s*\d+(?:[.,]\d+)?", re.IGNORECASE)
    RADIUS_COMPACT_PATTERN = re.compile(r"R\s*\d+(?:[.,]\d+)?", re.IGNORECASE)
    COVER_PATTERN = re.compile(r"kryt[íi]\s*\d{1,3}(?:\/\d{1,3})?\s*mm", re.IGNORECASE)
    COMPOSITE_PATTERN = re.compile(r"\b(\d{3})[-\s\/]{0,2}(\d{2})[-\s\/]{0,2}(\d{3})\b")
    SURFACE_PATTERN = re.compile(r"\b(?:A[a-d]?|B[a-d]?|C[12][a-d]?|D[a-b]?|E)\b", re.IGNORECASE)
    NORM_PATTERN = re.compile(
        r"\b(?:ČSN\s*(?:EN\s*)?\d{2,3}(?:[+A-Z0-9\/-]+)?|ČSN\s*EN\s*206(?:\s*\+\s*A2)?|TKP\s*\d{1,2}|TP\s*\d{2,3}|VL4\s*\d{3}\.\d{2})\b",
        re.IGNORECASE,
    )
    GEOMETRY_PATTERN = re.compile(
        r"((?:Ø|⌀)\s*\d{2,4})|(\b\d{1,2}[.,]\d\s*m\b)|(\b\d{2,3}/\d{2,3}\s*mm\b)|(\b\d{1,4}\s*mm\b)",
        re.IGNORECASE,
    )
    BRIDGE_KEYWORDS = {
        "pilot", "pilota", "piloty", "pilotu", "vrubovy", "vrubový",
        "kloub", "niveleta", "nivelety", "opěra", "opery", "opěr", "římsa", "rims", "rimsa",
    }
    MARKER_TYPES = (
        "concrete_class",
        "exposure_env",
        "steel_grade",
        "rebar_layout",
        "cover_depth",
        "surface_category",
        "norm_refs",
        "geometry_tokens",
        "bridge_tokens",
    )

    ADDITIONAL_MARKERS = (
        "vodostavebni",
        "vodostavební",
        "mrazuvzd",
        "beton",
        "výztuž",
        "vyztuz",
    )

    def __init__(self, text_recovery: Optional[PdfTextRecovery] = None) -> None:
        self.text_recovery = text_recovery or PdfTextRecovery()

    def parse_files(self, drawing_files: Iterable[Dict[str, object]]) -> Dict[str, object]:
        """Parse all provided drawing files.

        Parameters
        ----------
        drawing_files:
            Iterable of dictionaries coming from :func:`WorkflowA._resolve_uploads`.

        Returns
        -------
        dict
            Dictionary with parsed specifications and diagnostics.
        """

        specifications: List[DrawingSpecification] = []
        diagnostics = {"files_processed": 0, "specifications_found": 0, "errors": []}
        pattern_hits = {
            "concrete": 0,
            "exposure": 0,
            "steel": 0,
            "mesh": 0,
            "cover": 0,
            "radii": 0,
            "composite": 0,
            "surface": 0,
            "norm": 0,
            "geometry": 0,
            "bridge": 0,
        }
        marker_registry: Dict[str, Dict[str, Dict[str, str]]] = {
            marker_type: {} for marker_type in self.MARKER_TYPES
        }

        pages_state: List[Dict[str, object]] = []
        summary_counters = {"good_text": 0, "encoded_text": 0, "image_only": 0}
        pdfium_total = 0
        poppler_total = 0
        ocr_plan: List[Dict[str, object]] = []

        for file_meta in drawing_files:
            if not file_meta.get("exists"):
                continue

            file_path = Path(str(file_meta.get("path")))
            if file_path.suffix.lower() != ".pdf":
                logger.debug("Skipping non-PDF drawing: %s", file_path)
                continue

            try:
                specs, recovery = self._parse_single_pdf(file_path, pattern_hits, marker_registry)
            except Exception as exc:  # noqa: BLE001 - logged for diagnostics
                logger.exception("Failed to parse drawing %s: %s", file_path.name, exc)
                diagnostics["errors"].append(
                    {
                        "file": file_path.name,
                        "error": str(exc),
                    }
                )
                continue

            if specs:
                specifications.extend(specs)

            diagnostics["files_processed"] += 1
            diagnostics["specifications_found"] += len(specs)

            counters = recovery.page_state_counters()
            for key, value in counters.items():
                summary_counters[key] = summary_counters.get(key, 0) + value

            pdfium_total += recovery.used_pdfium
            poppler_total += recovery.used_poppler

            if recovery.queued_ocr_pages:
                ocr_plan.append(
                    {
                        "file": file_path.name,
                        "pages": recovery.queued_ocr_pages,
                    }
                )

            recovery_dict = recovery.to_dict()
            pages_state.append(
                {
                    "file": file_path.name,
                    "pages": recovery_dict.get("pages", []),
                    "summary": counters,
                }
            )

        markers_payload, markers_stats = self._prepare_marker_payload(marker_registry)

        logger.info(
            "Parsed %s drawing(s); collected %s technical specification markers (typed=%s)",
            diagnostics["files_processed"],
            diagnostics["specifications_found"],
            markers_stats["total"],
        )

        logger.debug("patterns_hit=%s", json.dumps(pattern_hits, ensure_ascii=False))

        diagnostics["page_states"] = summary_counters
        diagnostics["used_pdfium"] = pdfium_total
        diagnostics["used_poppler"] = poppler_total
        diagnostics["ocr_pages_total"] = sum(len(item["pages"]) for item in ocr_plan)

        return {
            "specifications": [spec.to_dict() for spec in specifications],
            "diagnostics": diagnostics,
            "markers": markers_payload,
            "markers_stats": markers_stats,
            "pages_state": pages_state,
            "used_pdfium": pdfium_total,
            "used_poppler": poppler_total,
            "ocr_pages": ocr_plan,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _parse_single_pdf(
        self,
        file_path: Path,
        pattern_hits: Dict[str, int],
        marker_registry: Dict[str, Dict[str, Dict[str, str]]],
    ) -> tuple[List[DrawingSpecification], PdfRecoverySummary]:
        """Extract specifications from a single PDF drawing."""

        logger.info("📐 Analysing drawing %s", file_path.name)
        collected: List[DrawingSpecification] = []

        recovery = self.text_recovery.recover(file_path)

        counters = recovery.page_state_counters()
        logger.info(
            "drawing_detector: pages=%s pdfium_used=%s poppler_used=%s ocr_pages=%s",
            counters,
            recovery.used_pdfium,
            recovery.used_poppler,
            len(recovery.queued_ocr_pages),
        )

        for page in recovery.pages:
            pdfium_info = page.fallbacks.get("pdfium")
            poppler_info = page.fallbacks.get("poppler")

            pdfium_state = "n/a"
            if pdfium_info:
                accepted = "accepted" if page.extractor == "pdfium" else "candidate"
                pdfium_state = f"{accepted}(valid={pdfium_info.valid_ratio:.2f})"

            poppler_state = "n/a"
            if poppler_info:
                accepted = "accepted" if page.extractor == "poppler" else "candidate"
                poppler_state = f"{accepted}(valid={poppler_info.valid_ratio:.2f})"

            logger.debug(
                "p%s: state=%s miner=valid=%.2f pua=%.2f pdfium=%s poppler=%s ocr=%s",
                page.page_number,
                page.state,
                page.miner.valid_ratio,
                page.miner.pua_ratio,
                pdfium_state,
                poppler_state,
                "queued" if page.queued_for_ocr else "no",
            )

            text = page.accepted.text or ""
            if not text:
                continue

            for line in text.splitlines():
                line = line.strip()
                if len(line) < 6:
                    continue

                spec = self._line_to_spec(file_path.name, page.page_number, line, pattern_hits)
                if spec:
                    collected.append(spec)
                    self._register_markers(marker_registry, spec)

        return collected, recovery

    def _register_markers(
        self,
        registry: Dict[str, Dict[str, Dict[str, str]]],
        spec: DrawingSpecification,
    ) -> None:
        markers = self._extract_markers_from_spec(spec)
        source = f"{spec.file}#p{spec.page}"

        for marker_type, values in markers.items():
            if not values:
                continue
            store = registry.get(marker_type)
            if store is None:
                continue
            for value in values:
                if value not in store:
                    store[value] = {"value": value, "source": source}

    def _extract_markers_from_spec(
        self, spec: DrawingSpecification
    ) -> Dict[str, List[str]]:
        technical = spec.technical_specs or {}
        tokens: Dict[str, set[str]] = {marker_type: set() for marker_type in self.MARKER_TYPES}

        def _add(marker_type: str, value: str | None) -> None:
            normalized = self._normalise_marker_value(marker_type, value)
            if normalized:
                tokens[marker_type].add(normalized)

        concrete = technical.get("concrete_class")
        if isinstance(concrete, str):
            _add("concrete_class", concrete)
        if isinstance(technical.get("concrete_classes"), (list, tuple)):
            for value in technical["concrete_classes"]:
                _add("concrete_class", value)

        exposures = technical.get("exposure") or []
        if isinstance(exposures, (list, tuple)):
            for exposure in exposures:
                _add("exposure_env", exposure)

        reinforcement = technical.get("reinforcement")
        if isinstance(reinforcement, str):
            _add("steel_grade", reinforcement)
        steel_grade = technical.get("steel_grade")
        if isinstance(steel_grade, str):
            _add("steel_grade", steel_grade)
        steel_options = technical.get("steel_grade_options") or []
        if isinstance(steel_options, (list, tuple)):
            for value in steel_options:
                _add("steel_grade", value)

        mesh = technical.get("reinforcement_mesh") or []
        if isinstance(mesh, (list, tuple)):
            for layout in mesh:
                _add("rebar_layout", layout)

        covers = technical.get("concrete_cover") or []
        if isinstance(covers, (list, tuple)):
            for entry in covers:
                if isinstance(entry, dict):
                    _add("cover_depth", entry.get("normalized") or entry.get("raw"))
                else:
                    _add("cover_depth", entry)

        surfaces = technical.get("surface_category") or []
        if isinstance(surfaces, (list, tuple)):
            for surface in surfaces:
                _add("surface_category", surface)

        norms = technical.get("norm_refs") or []
        if isinstance(norms, (list, tuple)):
            for ref in norms:
                _add("norm_refs", ref)

        geometry = technical.get("geometry_tokens") or []
        if isinstance(geometry, (list, tuple)):
            for token in geometry:
                _add("geometry_tokens", token)

        bridges = technical.get("bridge_tokens") or []
        if isinstance(bridges, (list, tuple)):
            for token in bridges:
                _add("bridge_tokens", token)

        # Extract additional tokens directly from text for resilience
        _text = spec.text or ""
        for exposure in self._collect_surface_categories(_text):
            _add("surface_category", exposure)
        for ref in self._collect_norm_refs(_text):
            _add("norm_refs", ref)
        for token in self._collect_geometry_tokens(_text):
            _add("geometry_tokens", token)
        for token in self._collect_bridge_tokens(_text):
            _add("bridge_tokens", token)

        for value in self.CONCRETE_PATTERN.findall(_text):
            _add("concrete_class", value)
        for value in self.EXPOSURE_PATTERN.findall(_text):
            _add("exposure_env", value)
        for value in self.REINFORCEMENT_PATTERN.findall(_text):
            _add("steel_grade", value)
        for value in self.STEEL_PATTERN.findall(_text):
            _add("steel_grade", value)
        for value in self._collect_mesh(_text):
            _add("rebar_layout", value)
        for entry in self._collect_cover(_text):
            if isinstance(entry, dict):
                _add("cover_depth", entry.get("normalized") or entry.get("raw"))

        return {marker_type: sorted(values) for marker_type, values in tokens.items() if values}

    def _line_to_spec(
        self, filename: str, page: int, line: str, pattern_hits: Dict[str, int]
    ) -> Optional[DrawingSpecification]:
        """Convert a single line of text into a specification if possible."""

        concrete_matches = [match.upper() for match in self._unique_matches(self.CONCRETE_PATTERN, line)]
        reinforcement_matches = [
            match.upper() for match in self._unique_matches(self.REINFORCEMENT_PATTERN, line)
        ]
        steel_matches = [match.upper() for match in self._unique_matches(self.STEEL_PATTERN, line)]
        exposure_matches = [
            match.upper() for match in self._unique_matches(self.EXPOSURE_PATTERN, line)
        ]
        mesh_matches = self._collect_mesh(line)
        radii_matches = self._collect_radii(line)
        cover_matches = self._collect_cover(line)
        composite_matches = self._collect_composite_codes(line)
        surface_matches = self._collect_surface_categories(line)
        norm_matches = self._collect_norm_refs(line)
        geometry_matches = self._collect_geometry_tokens(line)
        bridge_matches = self._collect_bridge_tokens(line)
        unit = self._first_match(self.UNIT_PATTERN, line)

        if concrete_matches:
            pattern_hits["concrete"] += len(concrete_matches)
        if exposure_matches:
            pattern_hits["exposure"] += len(exposure_matches)
        steel_total = len(reinforcement_matches) + len(steel_matches)
        if steel_total:
            pattern_hits["steel"] += steel_total
        if mesh_matches:
            pattern_hits["mesh"] += len(mesh_matches)
        if cover_matches:
            pattern_hits["cover"] += len(cover_matches)
        if radii_matches:
            pattern_hits["radii"] += len(radii_matches)
        if composite_matches:
            pattern_hits["composite"] += len(composite_matches)
        if surface_matches:
            pattern_hits["surface"] += len(surface_matches)
        if norm_matches:
            pattern_hits["norm"] += len(norm_matches)
        if geometry_matches:
            pattern_hits["geometry"] += len(geometry_matches)
        if bridge_matches:
            pattern_hits["bridge"] += len(bridge_matches)

        anchor_candidates: List[str] = []
        anchor_candidates.extend(concrete_matches)
        anchor_candidates.extend(reinforcement_matches)
        anchor_candidates.extend(steel_matches)
        anchor_candidates.extend(mesh_matches)
        anchor_candidates.extend(exposure_matches)
        anchor_candidates.extend(composite_matches)

        if not anchor_candidates:
            # Check for general markers to avoid missing textual specs.
            lower_line = line.lower()
            if not any(marker in lower_line for marker in self.ADDITIONAL_MARKERS):
                return None

            anchor_candidates.append(self._derive_anchor_from_text(line))

        anchor = anchor_candidates[0]
        if not anchor:
            return None

        technical_specs: Dict[str, object] = {}
        if concrete_matches:
            concrete_unique = sorted(dict.fromkeys(concrete_matches))
            technical_specs["concrete_class"] = concrete_unique[0]
            if len(concrete_unique) > 1:
                technical_specs["concrete_classes"] = concrete_unique
        if exposure_matches:
            technical_specs["exposure"] = sorted(dict.fromkeys(exposure_matches))
        if reinforcement_matches:
            reinforcement_unique = sorted(dict.fromkeys(reinforcement_matches))
            technical_specs["reinforcement"] = reinforcement_unique[0]
            if len(reinforcement_unique) > 1:
                technical_specs["reinforcement_options"] = reinforcement_unique
        if steel_matches:
            steel_unique = sorted(dict.fromkeys(steel_matches))
            technical_specs["steel_grade"] = steel_unique[0]
            if len(steel_unique) > 1:
                technical_specs["steel_grade_options"] = steel_unique
        if mesh_matches:
            technical_specs["reinforcement_mesh"] = mesh_matches
        if radii_matches:
            technical_specs["radii"] = radii_matches
        if cover_matches:
            technical_specs["concrete_cover"] = cover_matches
        if composite_matches:
            technical_specs["composite_codes"] = composite_matches
        if surface_matches:
            technical_specs["surface_category"] = sorted(surface_matches)
        if norm_matches:
            technical_specs["norm_refs"] = sorted(norm_matches)
        if geometry_matches:
            technical_specs["geometry_tokens"] = sorted(geometry_matches)
        if bridge_matches:
            technical_specs["bridge_tokens"] = sorted(bridge_matches)
        if unit:
            normalised_unit = unit.replace(" ", "").lower()
            technical_specs["unit"] = normalised_unit

        # Calculate heuristic confidence score.
        confidence = 0.55
        if concrete_matches:
            confidence += 0.2
        if exposure_matches:
            confidence += 0.15
        if reinforcement_matches or steel_matches:
            confidence += 0.1
        if mesh_matches or radii_matches:
            confidence += 0.05
        if unit:
            confidence += 0.05

        confidence = min(confidence, 0.98)

        return DrawingSpecification(
            file=filename,
            page=page,
            anchor=anchor.upper(),
            text=line,
            confidence=confidence,
            technical_specs=technical_specs,
        )

    @staticmethod
    def _first_match(pattern: re.Pattern[str], text: str) -> Optional[str]:
        match = pattern.search(text)
        return match.group(0) if match else None

    @staticmethod
    def _unique_matches(pattern: re.Pattern[str], text: str) -> List[str]:
        return list({match.group(0) for match in pattern.finditer(text)})

    @classmethod
    def _collect_mesh(cls, text: str) -> List[str]:
        values: Dict[str, str] = {}
        for match in cls.MESH_PATTERN.finditer(text):
            normalised = cls._normalise_mesh(match.group(0))
            if normalised:
                values.setdefault(normalised, normalised)
        return sorted(values.values())

    @staticmethod
    def _normalise_mesh(value: str) -> str:
        cleaned = value.upper().replace(" ", "")
        cleaned = cleaned.replace("⌀", "Ø")
        digits = re.findall(r"\d{1,3}", cleaned)
        if len(digits) < 2:
            return ""
        diameter, spacing = digits[0], digits[1]
        return f"Ø{diameter}@{spacing}"

    @classmethod
    def _collect_radii(cls, text: str) -> List[str]:
        values: Dict[str, str] = {}
        for pattern in (cls.RADIUS_PATTERN, cls.RADIUS_COMPACT_PATTERN):
            for match in pattern.finditer(text):
                digits = re.search(r"\d+(?:[.,]\d+)?", match.group(0))
                if not digits:
                    continue
                normalised = digits.group(0).replace(",", ".")
                values.setdefault(normalised, f"R={normalised}")
        return sorted(values.values())

    @classmethod
    def _collect_cover(cls, text: str) -> List[Dict[str, str]]:
        covers: Dict[str, Dict[str, str]] = {}
        for match in cls.COVER_PATTERN.finditer(text):
            raw_value = match.group(0).strip()
            digits = re.findall(r"\d{1,3}", raw_value)
            if not digits:
                continue
            if len(digits) == 1:
                normalised = f"krytí {digits[0]} mm"
            else:
                normalised = f"krytí {'/'.join(digits)} mm"
            covers.setdefault(
                normalised,
                {
                    "raw": raw_value,
                    "normalized": normalised,
                },
            )
        return list(covers.values())

    @classmethod
    def _collect_composite_codes(cls, text: str) -> List[str]:
        codes: Dict[str, str] = {}
        for match in cls.COMPOSITE_PATTERN.finditer(text):
            parts = match.groups()
            if not parts:
                continue
            leading, middle, trailing = parts
            canonical = f"{leading}/{middle}-{trailing}"
            codes.setdefault(canonical, canonical)
        return sorted(codes.values())

    @classmethod
    def _collect_surface_categories(cls, text: str) -> List[str]:
        values = {match.group(0).upper() for match in cls.SURFACE_PATTERN.finditer(text)}
        return sorted(values)

    @classmethod
    def _collect_norm_refs(cls, text: str) -> List[str]:
        values: Dict[str, str] = {}
        for match in cls.NORM_PATTERN.finditer(text):
            raw = match.group(0)
            if not raw:
                continue
            normalised = re.sub(r"\s+", " ", raw.strip())
            normalised = normalised.replace(" + ", "+")
            values.setdefault(normalised.upper(), normalised)
        return sorted(values.values())

    @classmethod
    def _collect_geometry_tokens(cls, text: str) -> List[str]:
        values: Dict[str, str] = {}
        for match in cls.GEOMETRY_PATTERN.finditer(text):
            token = next((group for group in match.groups() if group), "")
            if not token:
                continue
            normalized = token.replace(" ", "")
            normalized = normalized.replace("⌀", "Ø")
            values.setdefault(normalized.upper(), normalized)
        return sorted(values.values())

    @classmethod
    def _collect_bridge_tokens(cls, text: str) -> List[str]:
        tokens = {
            word for word in re.findall(r"[A-Za-zÁ-Žá-ž]+", text)
            if word.lower() in cls.BRIDGE_KEYWORDS
        }
        return sorted(tokens)

    @staticmethod
    def _normalise_marker_value(marker_type: str, value: str | None) -> str:
        if not value:
            return ""
        text = str(value).strip()
        if not text:
            return ""
        if marker_type in {"concrete_class", "exposure_env", "steel_grade", "surface_category", "norm_refs"}:
            return text.upper()
        if marker_type == "rebar_layout":
            cleaned = text.replace(" ", "")
            cleaned = cleaned.replace("⌀", "Ø")
            return cleaned.upper()
        if marker_type == "cover_depth":
            return text
        if marker_type == "geometry_tokens":
            return text.replace("⌀", "Ø")
        if marker_type == "bridge_tokens":
            return text
        return text

    @staticmethod
    def _prepare_marker_payload(
        registry: Dict[str, Dict[str, Dict[str, str]]]
    ) -> Tuple[Dict[str, List[Dict[str, str]]], Dict[str, Any]]:
        markers: Dict[str, List[Dict[str, str]]] = {}
        stats = {"total": 0, "by_type": {}}

        for marker_type, entries in registry.items():
            if not entries:
                continue
            sorted_entries = sorted(entries.values(), key=lambda item: item["value"])
            markers[marker_type] = sorted_entries
            count = len(sorted_entries)
            stats["by_type"][marker_type] = count
            stats["total"] += count

        return markers, stats

    @staticmethod
    def _derive_anchor_from_text(text: str) -> str:
        """Fallback anchor derived from the most salient token in the text."""

        # Pick the longest alphanumeric token as a best-effort anchor.
        tokens = re.findall(r"[A-Za-z0-9/]+", text)
        tokens.sort(key=len, reverse=True)
        return tokens[0].upper() if tokens else text[:20].upper()


__all__ = ["DrawingSpecsParser", "DrawingSpecification"]

