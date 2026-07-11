"""Disk-backed store for tz-BRIDGE-passports (half-B Gate 3, ADR-008).

Deliberately a SIBLING of `passport_store.py`, not an extension: that store
is type-locked to `ProjectPassport` (the doc-analysis passport concept) —
`get()` there validates as ProjectPassport, so a BridgePassport saved through
it would fail rehydration. Same Cache-Aside convention (memory = read cache,
disk = durable), own directory `bridge_passports/`, schema-tagged content
(the stored dict carries `_meta.schema = tz-bridge-passport` and is validated
against `BridgePassport` on both write and read).
"""
from __future__ import annotations

import copy
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import settings
from app.models.bridge_passport import BridgePassport

logger = logging.getLogger(__name__)

_memory: Dict[str, dict] = {}

# so/passport id also arrives via URL paths — safe charset only.
_SAFE_ID = re.compile(r"^[A-Za-z0-9_.-]+$")


def _store_dir() -> Path:
    d = settings.PROJECT_DIR / "bridge_passports"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _path_for(passport_id: str) -> Optional[Path]:
    if not _SAFE_ID.match(passport_id or ""):
        return None
    return _store_dir() / f"{passport_id}.json"


def save(passport_id: str, passport: dict) -> bool:
    """Validate + write-through (memory + durable JSON).

    We store the ORIGINAL dict shape, not a re-dump of the model — the half-A
    mapper reads the exact aliased shape (`_meta`, `class`, `use`), same
    forwarding rule as the MCP tool (v4.39 lesson) — but a DEEP COPY, so a
    caller mutating the returned/passed dict cannot corrupt the memory cache.

    Returns True only when the passport is DURABLY persisted (survives a cold
    start). A memory-only fallback (unsafe id or disk error) returns False —
    the caller must not report the passport as durably stored.
    """
    BridgePassport.model_validate(passport)  # storing an invalid passport is a defect
    _memory[passport_id] = copy.deepcopy(passport)
    path = _path_for(passport_id)
    if path is None:
        logger.warning("Bridge passport id %r not filesystem-safe — memory only", passport_id)
        return False
    try:
        path.write_text(json.dumps(passport, ensure_ascii=False, indent=2), encoding="utf-8")
        return True
    except OSError as exc:
        logger.error("Bridge passport %s: disk persist failed (%s) — memory only", passport_id, exc)
        return False


def get(passport_id: str) -> Optional[dict]:
    """Memory first, then disk rehydrate (cold-start recovery); re-validated.

    Hands back a DEEP COPY so a consumer mutating the result cannot corrupt the
    cached dict (which would then diverge from the durable JSON on disk).
    """
    if passport_id in _memory:
        return copy.deepcopy(_memory[passport_id])
    path = _path_for(passport_id)
    if path is None or not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        BridgePassport.model_validate(data)
        _memory[passport_id] = data
        return copy.deepcopy(data)
    except Exception as exc:  # noqa: BLE001 — corrupt file must not crash callers
        logger.error("Bridge passport %s: rehydrate failed (%s)", passport_id, exc)
        return None


def delete(passport_id: str) -> bool:
    existed = _memory.pop(passport_id, None) is not None
    path = _path_for(passport_id)
    if path is not None and path.exists():
        try:
            path.unlink()
            existed = True
        except OSError as exc:
            logger.error("Bridge passport %s: delete failed (%s)", passport_id, exc)
    return existed


def list_ids() -> List[str]:
    ids = set(_memory.keys())
    try:
        ids.update(p.stem for p in _store_dir().glob("*.json"))
    except OSError:
        pass
    return sorted(ids)
