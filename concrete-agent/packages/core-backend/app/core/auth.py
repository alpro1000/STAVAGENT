"""
app/core/auth.py
Authentication utilities for Concrete-Agent backend.
"""
import os
import logging
from typing import Optional
from fastapi import Header, HTTPException, status

logger = logging.getLogger(__name__)

# Service token for internal API authentication
_SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "")
_API_KEY = os.getenv("API_KEY", "")


def verify_token(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
) -> bool:
    """
    Verify request authentication token.
    Accepts either Authorization: Bearer <token> or X-Api-Key: <key> header.

    Security: if no tokens are configured in env, requests are DENIED
    to prevent authentication bypass in production (CWE-306).
    Set SERVICE_TOKEN or API_KEY env vars to enable access.
    """
    # Security: deny all if no tokens configured (prevents silent bypass in production)
    if not _SERVICE_TOKEN and not _API_KEY:
        logger.warning(
            "Auth: SERVICE_TOKEN and API_KEY are both unset — "
            "all requests denied. Set at least one token in environment."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Server not configured: no authentication tokens set",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check X-Api-Key header
    if x_api_key and _API_KEY and x_api_key == _API_KEY:
        return True

    # Check Authorization: Bearer <token> header
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
            if _SERVICE_TOKEN and token == _SERVICE_TOKEN:
                return True
            if _API_KEY and token == _API_KEY:
                return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
