"""
API endpoint for parsing concrete supplier price lists (PDF → JSON).

POST /api/v1/price-parser/parse  — upload PDF, get structured JSON
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.services.price_parser.main import parse_price_list_from_bytes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/price-parser", tags=["Price Parser"])


@router.post("/parse")
async def parse_price_list_endpoint(file: UploadFile = File(...)):
    """
    Upload a concrete supplier PDF price list and get structured JSON.

    Accepts: PDF file (text-based or scanned)
    Returns: Structured JSON with betony, doprava, cerpadla, priplatky, laborator
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")

    logger.info("Price parser: received %s (%d bytes)", file.filename, len(data))

    try:
        result = await parse_price_list_from_bytes(data, filename=file.filename)
        return result.model_dump()
    except Exception as e:
        logger.error("Price parser failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")
