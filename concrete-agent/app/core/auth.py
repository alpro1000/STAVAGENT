"""Authentication utilities — verify_token for API key validation."""
from __future__ import annotations

import os
from typing import Optional

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from loguru import logger

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_token(
    api_key: Optional[str] = Security(API_KEY_HEADER),
) -> str:
    """Validate API key from X-API-Key header.

    Returns:
        Validated API key string.

    Raises:
        HTTPException 401 if key is missing or invalid.
    """
    expected_key = os.getenv("SERVICE_API_KEY", "")

    if not expected_key:
        # No key configured — allow all requests (dev mode)
        logger.warning("verify_token: SERVICE_API_KEY not set, running in open mode")
        return api_key or "dev-mode"

    if not api_key:
        logger.warning("verify_token: missing X-API-Key header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide X-API-Key header.",
        )

    if api_key != expected_key:
        logger.warning(f"verify_token: invalid API key attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )

    return api_key
