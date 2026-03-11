"""
Main entry point for price list parsing.

Pipeline: PDF → extract → classify → parse sections → validate → PriceListResult
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from app.services.price_parser.classifier import classify_blocks
from app.services.price_parser.extractor import extract_text_from_pdf, extract_text_from_bytes
from app.services.price_parser.models import PriceListResult
from app.services.price_parser.parsers.betony import parse_betony
from app.services.price_parser.parsers.cerpadla import parse_cerpadla
from app.services.price_parser.parsers.doprava import parse_doprava
from app.services.price_parser.parsers.laborator import parse_laborator
from app.services.price_parser.parsers.malty import parse_malty
from app.services.price_parser.parsers.priplatky import parse_priplatky
from app.services.price_parser.parsers.source import parse_source

logger = logging.getLogger(__name__)


async def parse_price_list(file_path: str | Path, *, output_dir: Optional[str | Path] = None) -> PriceListResult:
    """
    Parse a concrete supplier PDF price list into structured JSON.

    Args:
        file_path: Path to the PDF file.
        output_dir: If provided, save result JSON to this directory.

    Returns:
        PriceListResult with all extracted sections.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    logger.info("=== Parsing price list: %s ===", file_path.name)

    # Step 1: Extract text
    text = extract_text_from_pdf(file_path)
    if not text.strip():
        logger.error("No text extracted from %s", file_path.name)
        return PriceListResult()

    # Step 2: Classify blocks
    blocks = await classify_blocks(text)

    # Step 3: Parse each section in parallel
    import asyncio
    source, betony, malty, doprava, cerpadla, priplatky, laborator = await asyncio.gather(
        parse_source(blocks.get("source")),
        parse_betony(blocks.get("betony")),
        parse_malty(blocks.get("malty_potere")),
        parse_doprava(blocks.get("doprava")),
        parse_cerpadla(blocks.get("cerpadla")),
        parse_priplatky(blocks.get("priplatky")),
        parse_laborator(blocks.get("laborator")),
    )

    result = PriceListResult(
        source=source,
        betony=betony,
        malty_potere=malty,
        doprava=doprava,
        cerpadla=cerpadla,
        priplatky=priplatky,
        laborator=laborator,
        ostatni=blocks.get("ostatni"),
    )

    logger.info(
        "Parsed: %d betony, %d malty, %d cerpadla, %d příplatky (čas: %d, zima: %d, tech: %d)",
        len(result.betony),
        len(result.malty_potere),
        len(result.cerpadla),
        len(result.priplatky.casove) + len(result.priplatky.zimni) + len(result.priplatky.technologicke),
        len(result.priplatky.casove),
        len(result.priplatky.zimni),
        len(result.priplatky.technologicke),
    )

    # Step 4: Optionally save to file
    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{file_path.stem}_parsed.json"
        output_file.write_text(
            json.dumps(result.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info("Saved result to %s", output_file)

    return result


async def parse_price_list_from_bytes(
    data: bytes,
    filename: str = "upload.pdf",
    *,
    output_dir: Optional[str | Path] = None,
) -> PriceListResult:
    """
    Parse a price list from in-memory PDF bytes.

    Used by the API endpoint for uploaded files.
    """
    logger.info("=== Parsing price list from bytes: %s (%d bytes) ===", filename, len(data))

    text = extract_text_from_bytes(data)
    if not text.strip():
        logger.error("No text extracted from %s", filename)
        return PriceListResult()

    blocks = await classify_blocks(text)

    import asyncio
    source, betony, malty, doprava, cerpadla, priplatky, laborator = await asyncio.gather(
        parse_source(blocks.get("source")),
        parse_betony(blocks.get("betony")),
        parse_malty(blocks.get("malty_potere")),
        parse_doprava(blocks.get("doprava")),
        parse_cerpadla(blocks.get("cerpadla")),
        parse_priplatky(blocks.get("priplatky")),
        parse_laborator(blocks.get("laborator")),
    )

    result = PriceListResult(
        source=source,
        betony=betony,
        malty_potere=malty,
        doprava=doprava,
        cerpadla=cerpadla,
        priplatky=priplatky,
        laborator=laborator,
        ostatni=blocks.get("ostatni"),
    )

    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        stem = Path(filename).stem
        output_file = output_dir / f"{stem}_parsed.json"
        output_file.write_text(
            json.dumps(result.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info("Saved result to %s", output_file)

    return result
