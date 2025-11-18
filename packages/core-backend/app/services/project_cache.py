"""Project cache utilities for Workflow A."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from app.core.config import settings
from app.utils.audit_contracts import ensure_audit_contract, is_new_contract

logger = logging.getLogger(__name__)


def _ensure_cache_dir() -> Path:
    """Ensure the project cache directory exists."""
    cache_dir = settings.PROJECT_DIR
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_cache_path(project_id: str) -> Path:
    """Return the cache path for a project."""
    return _ensure_cache_dir() / f"{project_id}.json"


def load_project_cache(project_id: str) -> Tuple[Optional[Dict[str, Any]], Path]:
    """Load the cache for a project if it exists."""
    cache_path = get_cache_path(project_id)
    if cache_path.exists():
        try:
            with cache_path.open("r", encoding="utf-8") as fp:
                data = json.load(fp)
            logger.info("Project %s: Loaded cache from %s", project_id, cache_path)
            audit_payload = data.get("audit_results")
            migrated, changed = ensure_audit_contract(
                audit_payload, fallback_positions=data.get("positions")
            )
            if changed:
                data["audit_results"] = migrated
                save_project_cache(project_id, data)
            return data, cache_path
        except json.JSONDecodeError as exc:
            logger.warning(
                "Project %s: Cache at %s is corrupt (%s). Re-initialising.",
                project_id,
                cache_path,
                exc,
            )
    return None, cache_path


def save_project_cache(project_id: str, cache_data: Dict[str, Any]) -> Path:
    """Persist project cache to disk."""
    cache_path = get_cache_path(project_id)
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    cache_data = dict(cache_data)
    cache_data.setdefault("project_id", project_id)
    cache_data["updated_at"] = cache_data.get("updated_at") or datetime.now().isoformat()

    with cache_path.open("w", encoding="utf-8") as fp:
        json.dump(cache_data, fp, ensure_ascii=False, indent=2)

    logger.info("Project %s: Cache saved to %s", project_id, cache_path)
    return cache_path


def load_or_create_project_cache(
    project_id: str, base_data: Optional[Dict[str, Any]] = None
) -> Tuple[Dict[str, Any], Path, bool]:
    """Load an existing cache or create a new one with base data."""
    existing_cache, cache_path = load_project_cache(project_id)
    if existing_cache is not None:
        return existing_cache, cache_path, False

    cache_payload: Dict[str, Any] = dict(base_data or {})
    cache_payload.setdefault("project_id", project_id)
    now_iso = datetime.now().isoformat()
    cache_payload.setdefault("created_at", now_iso)
    cache_payload["updated_at"] = now_iso

    save_project_cache(project_id, cache_payload)
    logger.info("Project %s: Created new project cache at %s", project_id, cache_path)
    return cache_payload, cache_path, True


def save_field(project_id: str, field: str, value: Any) -> None:
    """Persist a single field update to the project cache."""

    cache_payload, cache_path = load_project_cache(project_id)
    if cache_payload is None:
        cache_payload = {"project_id": project_id}

    cache_payload[field] = value
    save_project_cache(project_id, cache_payload)
    logger.info(
        "Project %s: Cache field '%s' updated via save_field (path=%s)",
        project_id,
        field,
        cache_path,
    )


def _is_new_audit_format(audit_results: Dict[str, Any] | None) -> bool:
    return is_new_contract(audit_results)


def _migrate_legacy_audit_results(old: Dict[str, Any] | None) -> Dict[str, Any]:
    payload, _ = ensure_audit_contract(old)
    return payload
