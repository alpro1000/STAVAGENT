"""
ParsedDocument → ExtractionResult adapter.

Converts Excel/XML ParsedDocument (positions with codes, prices, units)
into the same ExtractedValue fact format used by PDF chunked extraction.

This allows Excel-based documents to participate in the same downstream
pipeline (calculator suggestions, audit, registry) as PDF TZ documents.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-04-01
"""

import hashlib
import logging
import re
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.models.extraction_schemas import (
    ChunkInfo,
    ExtractionResult,
    ExtractionSource,
    ExtractedValue,
)
from app.parsers.models import ParsedDocument, ParsedPosition  # noqa: direct import, skip __init__

logger = logging.getLogger(__name__)

# Regex patterns for extracting construction facts from position descriptions
_CONCRETE_RE = re.compile(r"\bC\s*(\d{2,3})\s*/\s*(\d{2,3})\b")
_EXPOSURE_RE = re.compile(r"\b(X[CDFSAM]\d)\b")
_REBAR_RE = re.compile(r"\b(B\s*500\s*[ABC])\b")
_REBAR_DIAM_RE = re.compile(r"[∅Ø]\s*(\d{1,2})")
_URS_CODE_RE = re.compile(r"\b(\d{9})\b")
_VOLUME_RE = re.compile(r"(\d+(?:[,.]\d+)?)\s*(m[³3²2]|m\b|t\b|kg\b|ks\b|bm\b)", re.IGNORECASE)
_PIPE_DN_RE = re.compile(r"\bDN\s*(\d+)\b")
_NORM_RE = re.compile(r"ČSN\s+(?:EN\s+)?(?:ISO\s+)?\d[\d\s]*\d", re.IGNORECASE)


def parsed_document_to_facts(
    doc: ParsedDocument,
    file_bytes: Optional[bytes] = None,
) -> ExtractionResult:
    """
    Convert a ParsedDocument (from Excel/XML parsers) into ExtractionResult.

    Each díl/chapter becomes a logical chunk. Facts are extracted from
    position codes, descriptions, and quantities.
    """
    result = ExtractionResult(
        document_hash=hashlib.sha256(file_bytes).hexdigest() if file_bytes else "",
        filename=doc.source_file or "",
        extracted_at=datetime.now().isoformat(),
        parser_used=doc.source_format.value if doc.source_format else "excel",
        total_pages=0,
        raw_text_length=0,
    )

    # Document metadata
    if doc.project_name:
        result.document_meta["project_name"] = ExtractedValue(
            value=doc.project_name,
            confidence=1.0,
            source=ExtractionSource.REGEX,
            source_detail="parsed_document:project_name",
        )
    if doc.project_id:
        result.document_meta["project_id"] = ExtractedValue(
            value=doc.project_id,
            confidence=1.0,
            source=ExtractionSource.REGEX,
            source_detail="parsed_document:project_id",
        )

    chunk_index = 0
    for so in doc.stavebni_objekty:
        for chapter in so.chapters:
            chunk_id = f"dil_{so.so_id}_{chapter.code}".replace(" ", "_")
            chunk = ChunkInfo(
                chunk_id=chunk_id,
                chunk_index=chunk_index,
                page_start=0,
                page_end=0,
                section_title=f"{so.so_id} / {chapter.code} {chapter.name}",
                char_count=0,
                strategy="excel_dil",
            )
            result.chunk_details.append(chunk)
            chunk_index += 1

            for pos in chapter.positions:
                _extract_facts_from_position(pos, chunk_id, result)

    result.chunks_processed = chunk_index

    # Deduplicate
    result.norm_references = _dedup(result.norm_references)
    result.materials = _dedup(result.materials)

    logger.info(
        "[ADAPTER] %s: %d positions → %d materials, %d norms, %d dimensions from %d chunks",
        doc.source_file,
        doc.positions_count or len(doc.all_positions),
        len(result.materials),
        len(result.norm_references),
        len(result.dimensions),
        result.chunks_processed,
    )

    return result


def _extract_facts_from_position(
    pos: ParsedPosition, chunk_id: str, result: ExtractionResult
) -> None:
    """Extract construction facts from a single position's code + description."""
    text = f"{pos.code or ''} {pos.description or ''} {pos.specification or ''}"

    # Concrete grade
    for m in _CONCRETE_RE.finditer(text):
        result.materials.append(ExtractedValue(
            value=m.group(0).strip(),
            confidence=1.0,
            source=ExtractionSource.REGEX,
            source_detail=f"excel_position:{pos.code}",
            context=pos.description[:100] if pos.description else None,
            chunk_id=chunk_id,
        ))

    # Exposure class
    for m in _EXPOSURE_RE.finditer(text):
        result.materials.append(ExtractedValue(
            value=m.group(1),
            confidence=1.0,
            source=ExtractionSource.REGEX,
            source_detail=f"excel_position:{pos.code}",
            context=pos.description[:100] if pos.description else None,
            chunk_id=chunk_id,
        ))

    # Reinforcement grade
    for m in _REBAR_RE.finditer(text):
        result.materials.append(ExtractedValue(
            value=m.group(1).replace(" ", ""),
            confidence=1.0,
            source=ExtractionSource.REGEX,
            source_detail=f"excel_position:{pos.code}",
            chunk_id=chunk_id,
        ))

    # Rebar diameter
    for m in _REBAR_DIAM_RE.finditer(text):
        result.dimensions.append(ExtractedValue(
            value=f"∅{m.group(1)}",
            unit="mm",
            confidence=1.0,
            source=ExtractionSource.REGEX,
            source_detail=f"excel_position:{pos.code}",
            chunk_id=chunk_id,
        ))

    # ÚRS code as fact
    if pos.code and _URS_CODE_RE.match(pos.code):
        result.norm_references.append(ExtractedValue(
            value=f"ÚRS {pos.code}",
            confidence=1.0,
            source=ExtractionSource.REGEX,
            source_detail="excel_position:urs_code",
            context=pos.description[:80] if pos.description else None,
            chunk_id=chunk_id,
        ))

    # Volume/quantity with unit
    if pos.quantity and pos.unit:
        qty = float(pos.quantity) if isinstance(pos.quantity, Decimal) else pos.quantity
        if qty > 0:
            result.dimensions.append(ExtractedValue(
                value=qty,
                unit=pos.unit,
                confidence=1.0,
                source=ExtractionSource.REGEX,
                source_detail=f"excel_position:{pos.code}",
                context=pos.description[:80] if pos.description else None,
                chunk_id=chunk_id,
            ))

    # Norms in description text
    for m in _NORM_RE.finditer(text):
        result.norm_references.append(ExtractedValue(
            value=m.group(0).strip(),
            confidence=1.0,
            source=ExtractionSource.REGEX,
            source_detail=f"excel_position:{pos.code}",
            chunk_id=chunk_id,
        ))

    # Pipe DN
    for m in _PIPE_DN_RE.finditer(text):
        result.materials.append(ExtractedValue(
            value=f"DN{m.group(1)}",
            confidence=1.0,
            source=ExtractionSource.REGEX,
            source_detail=f"excel_position:{pos.code}",
            chunk_id=chunk_id,
        ))


def _dedup(facts: List[ExtractedValue]) -> List[ExtractedValue]:
    """Deduplicate keeping highest confidence per unique value."""
    best: Dict[str, ExtractedValue] = {}
    for f in facts:
        key = str(f.value).strip().lower()
        if key not in best or f.confidence > best[key].confidence:
            best[key] = f
    return list(best.values())
