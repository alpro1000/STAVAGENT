"""
MinerU HTTP client for concrete-agent.

Calls mineru-service (standalone Cloud Run) if MINERU_SERVICE_URL is set.
Otherwise returns None and pdf_parser_unified uses pdfplumber as fallback.

Auth: Uses Google Cloud ID token for service-to-service calls
(mineru-service has --no-allow-unauthenticated).

Author: STAVAGENT Team
Version: 1.1.0
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MINERU_SERVICE_URL = os.getenv("MINERU_SERVICE_URL", "")
MINERU_TIMEOUT = int(os.getenv("MINERU_TIMEOUT", "120"))

# Cache the auth token (refreshed on 401)
_cached_token: Optional[str] = None


def _get_id_token() -> Optional[str]:
    """Get Google Cloud ID token for service-to-service auth."""
    global _cached_token
    if _cached_token:
        return _cached_token
    try:
        import google.auth.transport.requests
        import google.oauth2.id_token
        auth_req = google.auth.transport.requests.Request()
        token = google.oauth2.id_token.fetch_id_token(auth_req, MINERU_SERVICE_URL)
        _cached_token = token
        return token
    except Exception as e:
        logger.debug(f"[MinerU] ID token fetch failed (local dev?): {e}")
        return None


def parse_pdf_with_mineru(
    pdf_path: str,
    method: str = "auto",
) -> Optional[str]:
    """
    Synchronous call to mineru-service.

    Returns:
      str  — extracted markdown text
      None — mineru unavailable or failed (use fallback)
    """
    global _cached_token

    if not MINERU_SERVICE_URL:
        logger.debug("[MinerU] MINERU_SERVICE_URL not set, skipping")
        return None

    try:
        import httpx

        headers = {}
        token = _get_id_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"

        with open(pdf_path, 'rb') as f:
            response = httpx.post(
                f"{MINERU_SERVICE_URL}/parse-pdf",
                files={"file": ("document.pdf", f, "application/pdf")},
                params={"method": method},
                headers=headers,
                timeout=MINERU_TIMEOUT,
            )

        # Token expired — refresh and retry once
        if response.status_code == 401 and token:
            _cached_token = None
            new_token = _get_id_token()
            if new_token:
                headers["Authorization"] = f"Bearer {new_token}"
                with open(pdf_path, 'rb') as f:
                    response = httpx.post(
                        f"{MINERU_SERVICE_URL}/parse-pdf",
                        files={"file": ("document.pdf", f, "application/pdf")},
                        params={"method": method},
                        headers=headers,
                        timeout=MINERU_TIMEOUT,
                    )

        if response.status_code == 200:
            data = response.json()
            text = data.get("text", "")
            logger.info(
                f"[MinerU] OK: {len(text)} chars, method={method}, "
                f"pages~{data.get('pages_processed', '?')}"
            )
            return text if text else None

        logger.warning(f"[MinerU] HTTP {response.status_code}: {response.text[:100]}")
        return None

    except Exception as e:
        logger.warning(f"[MinerU] Error: {e} — using pdfplumber fallback")
        return None


def is_mineru_available() -> bool:
    """Quick health check — calls /health endpoint."""
    if not MINERU_SERVICE_URL:
        return False
    try:
        import httpx
        headers = {}
        token = _get_id_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        r = httpx.get(f"{MINERU_SERVICE_URL}/health", headers=headers, timeout=5)
        return r.status_code == 200 and r.json().get("mineru_available", False)
    except Exception:
        return False
