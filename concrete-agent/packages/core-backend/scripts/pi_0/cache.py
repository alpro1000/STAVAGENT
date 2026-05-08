"""DXF parse cache — Step 5 perf optimization.

Each DXF file's parsed contents (rooms, openings, segment_tags, iden_tags)
are cached as JSON keyed by the DXF's filename. mtime is recorded inside
the cache header; if the source DXF mtime exceeds the cached mtime, the
cache entry is re-parsed.

Cache layout:
    <repo_root>/.pi_0_cache/<dxf_filename>.json

Each cache file:
    {
      "source_path": str,
      "source_mtime": float,
      "schema_version": int,
      "data": {... arbitrary JSON ...},
    }

Cache is purely a performance optimization — never authoritative.
master_extract_*.json remains the canonical output. The cache directory
is gitignored.

Idempotency: cache content is deterministic for a given DXF (same
parser version + same source bytes → same data). Bumping
CACHE_SCHEMA_VERSION below invalidates all entries (forces re-parse on
next read).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

CACHE_SCHEMA_VERSION = 1


def _cache_path_for(dxf_path: Path, cache_dir: Path) -> Path:
    """Cache filename mirrors DXF basename. Ensures uniqueness within
    Libuše since DXF filenames are globally unique."""
    return cache_dir / f"{dxf_path.name}.json"


def load_or_parse(dxf_path: Path, parser: Callable[[Path], Any],
                   *, cache_dir: Path,
                   schema_version: int = CACHE_SCHEMA_VERSION) -> Any:
    """Return parsed data for `dxf_path`, using cache when fresh.

    Args:
      dxf_path: source DXF file
      parser: callable(Path) → JSON-serializable data — invoked on miss
      cache_dir: directory where `.json` cache files live
      schema_version: bump to invalidate all cached entries

    Cache hits when:
      - cache file exists
      - cache.schema_version matches CACHE_SCHEMA_VERSION
      - cache.source_mtime ≥ dxf_path.stat().st_mtime
    """
    if not dxf_path.exists():
        return None
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = _cache_path_for(dxf_path, cache_dir)
    src_mtime = dxf_path.stat().st_mtime

    if cache_file.exists():
        try:
            entry = json.loads(cache_file.read_text(encoding="utf-8"))
            if (entry.get("schema_version") == schema_version
                    and entry.get("source_mtime", 0.0) >= src_mtime):
                return entry["data"]
        except (OSError, json.JSONDecodeError):
            pass  # corrupted cache — fall through to re-parse

    # Cache miss / stale — parse fresh + persist
    data = parser(dxf_path)
    payload = {
        "source_path": str(dxf_path),
        "source_mtime": src_mtime,
        "schema_version": schema_version,
        "data": data,
    }
    # Atomic write (write to tmp, rename) to avoid partial-cache reads.
    tmp = cache_file.with_suffix(cache_file.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp.replace(cache_file)
    return data


def invalidate(dxf_path: Path, *, cache_dir: Path) -> bool:
    """Delete a single cache entry (e.g. after schema change). True if removed."""
    cache_file = _cache_path_for(dxf_path, cache_dir)
    if cache_file.exists():
        cache_file.unlink()
        return True
    return False


def clear(cache_dir: Path) -> int:
    """Remove every cache entry. Returns count removed."""
    if not cache_dir.exists():
        return 0
    n = 0
    for f in cache_dir.glob("*.json"):
        f.unlink()
        n += 1
    return n
