"""Schema helpers + canonical I/O for master_extract_{objekt}.json.

The idempotency contract (TASK_PHASE_PI_0_SPEC.md §3.4):

- sort_keys=True for stable dict order
- Numeric floats rounded to 6 decimals
- WKT strings (polygon_wkt) pass through verbatim — never re-parsed
  / re-rounded; original DXF coordinate precision is preserved
- metadata.extracted_at excluded from idempotency check (only content
  fields counted)
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Iterable

FLOAT_PRECISION = 6


def _normalize(obj: Any) -> Any:
    """Recursively round floats; pass other types (incl. WKT strings) through."""
    if isinstance(obj, float):
        return round(obj, FLOAT_PRECISION)
    if isinstance(obj, dict):
        return {k: _normalize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalize(v) for v in obj]
    return obj  # str / int / bool / None pass through


def write_canonical(path: Path, data: dict) -> None:
    """Serialize JSON with sorted keys + 6-decimal float rounding."""
    canonical = _normalize(data)
    text = json.dumps(canonical, indent=2, ensure_ascii=False, sort_keys=True)
    path.write_text(text + "\n", encoding="utf-8")


def canonical_bytes(data: dict, *, drop_paths: Iterable[tuple[str, ...]] = ()) -> bytes:
    """Return canonical-form bytes for a dict, optionally dropping nested paths.

    Used for idempotency comparison: pass `drop_paths=[("metadata", "extracted_at")]`
    to ignore the timestamp.
    """
    canonical = _normalize(data)
    for path_keys in drop_paths:
        cur = canonical
        for k in path_keys[:-1]:
            if not isinstance(cur, dict) or k not in cur:
                cur = None
                break
            cur = cur[k]
        if isinstance(cur, dict):
            cur.pop(path_keys[-1], None)
    return json.dumps(canonical, indent=2, ensure_ascii=False, sort_keys=True).encode("utf-8")


def canonical_hash(data: dict, *, drop_paths: Iterable[tuple[str, ...]] = ()) -> str:
    """SHA-256 of `canonical_bytes(data, drop_paths=...)`."""
    return hashlib.sha256(canonical_bytes(data, drop_paths=drop_paths)).hexdigest()
