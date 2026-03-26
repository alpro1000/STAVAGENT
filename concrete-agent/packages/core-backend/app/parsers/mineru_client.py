"""
MinerU HTTP client for concrete-agent.

Calls mineru-service (standalone Cloud Run) if MINERU_SERVICE_URL is set.
Otherwise returns None and pdf_parser_unified uses pdfplumber as fallback.

Author: STAVAGENT Team
Version: 1.0.0
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MINERU_SERVICE_URL = os.getenv("MINERU_SERVICE_URL", "")
MINERU_TIMEOUT = int(os.getenv("MINERU_TIMEOUT", "120"))


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
    if not MINERU_SERVICE_URL:
        logger.debug("[MinerU] MINERU_SERVICE_URL not set, skipping")
        return None

    try:
        import httpx

        with open(pdf_path, 'rb') as f:
            response = httpx.post(
                f"{MINERU_SERVICE_URL}/parse-pdf",
                files={"file": ("document.pdf", f, "application/pdf")},
                params={"method": method},
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
        r = httpx.get(f"{MINERU_SERVICE_URL}/health", timeout=5)
        return r.status_code == 200 and r.json().get("mineru_available", False)
    except Exception:
        return False
