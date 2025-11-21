"""
Datetime utilities for consistent timestamp handling across the application.
"""
from datetime import datetime, timezone


def get_utc_timestamp_iso() -> str:
    """
    Get current UTC timestamp in ISO 8601 format with 'Z' suffix.

    Returns:
        str: ISO 8601 formatted timestamp ending with 'Z'
             Example: "2025-10-28T14:30:45.123456Z"

    Note:
        This format is consistent with JSON API standards and
        JavaScript Date.parse() compatibility.
    """
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def get_utc_now() -> datetime:
    """
    Get current UTC datetime (timezone-aware).

    Returns:
        datetime: Current UTC datetime with timezone info

    Note:
        Prefer this over datetime.utcnow() which returns naive datetime
        and is deprecated in Python 3.12+.
    """
    return datetime.now(timezone.utc)
