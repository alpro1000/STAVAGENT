"""Disk-backed passport store (Sprint B, 2026-07 audit item 5).

Passports used to live ONLY in a module-level dict in `routes_passport.py` —
with Cloud Run min-instances=0 every cold start silently wiped all generated
passports (data loss the user could not see). This store follows the same
Cache-Aside convention as `project_cache.py`: memory is a read cache, disk
(`settings.PROJECT_DIR / "passports"`) is the durable layer, matching the
persistence guarantees of every other project-scoped artefact in CORE.

No new infrastructure: JSON files via pydantic v2 model_dump/model_validate.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import settings
from app.models.passport_schema import ProjectPassport

logger = logging.getLogger(__name__)

# Read cache on top of disk — NOT the source of truth.
_memory: Dict[str, ProjectPassport] = {}

# passport_id is generated internally, but it also arrives via URL path —
# constrain to a safe charset so it can never traverse outside the store dir.
_SAFE_ID = re.compile(r"^[A-Za-z0-9_.-]+$")


def _store_dir() -> Path:
    d = settings.PROJECT_DIR / "passports"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _path_for(passport_id: str) -> Optional[Path]:
    if not _SAFE_ID.match(passport_id or ""):
        return None
    return _store_dir() / f"{passport_id}.json"


def save(passport: ProjectPassport) -> None:
    """Write-through: memory + durable JSON on disk."""
    _memory[passport.passport_id] = passport
    path = _path_for(passport.passport_id)
    if path is None:
        logger.warning("Passport id %r is not filesystem-safe — memory only", passport.passport_id)
        return
    try:
        path.write_text(
            json.dumps(passport.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        # Honest degradation: the passport still serves from memory this
        # process lifetime; the durability gap is logged, not silent.
        logger.error("Passport %s: disk persist failed (%s) — memory only", passport.passport_id, exc)


def get(passport_id: str) -> Optional[ProjectPassport]:
    """Memory first, then rehydrate from disk (cold-start recovery)."""
    if passport_id in _memory:
        return _memory[passport_id]
    path = _path_for(passport_id)
    if path is None or not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        passport = ProjectPassport.model_validate(data)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Passport %s: stored file unreadable (%s)", passport_id, exc)
        return None
    _memory[passport_id] = passport
    return passport


def delete(passport_id: str) -> bool:
    """Remove from memory AND disk. True when something was deleted."""
    existed = _memory.pop(passport_id, None) is not None
    path = _path_for(passport_id)
    if path is not None and path.exists():
        try:
            path.unlink()
            existed = True
        except OSError as exc:
            logger.error("Passport %s: disk delete failed (%s)", passport_id, exc)
    return existed


def list_all() -> List[ProjectPassport]:
    """All stored passports — disk is authoritative, memory fills the gaps."""
    result: Dict[str, ProjectPassport] = {}
    for path in sorted(_store_dir().glob("*.json")):
        pid = path.stem
        loaded = get(pid)
        if loaded is not None:
            result[pid] = loaded
    # Memory-only entries (unsafe id / disk write failed) still listed.
    for pid, passport in _memory.items():
        result.setdefault(pid, passport)
    return list(result.values())


def count() -> int:
    return len(list_all())
