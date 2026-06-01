"""
Object-type detection from the technical report (W3b).

Determines a construction object's type ONCE from its technical report — using
ONLY the object NAME + the charakteristika sentence, never the full text — and
caches it in the project state keyed by SO code, so element classification can
receive it as the authoritative context (W3) instead of guessing per item.

Why name + charakteristika only (NOT full text): a retaining-wall TZ routinely
mentions neighbouring bridge objects in its geology/context sections (e.g. SO 250
references "mostní objekt" and "lávka SO 222"). Full-text matching on "most"
would falsely flag the wall as a bridge. The object's own name + charakteristika
sentence are the deterministic, self-describing source.

No LLM here — pure rule matching (task §2). LLM only as a fallback elsewhere via
existing routing; this module never calls it.

Producer (document-analysis time): detect_and_cache_object_type(...) — runs once
per object, persists to the `object_types` cache field.
Consumer (work atomization): get_cached_object_type(...) — read-only, never
detects; a cache miss returns None so classification falls back to the W3
name+code heuristic (criterion #76).

Reference: docs/tasks/TASK_W3b_ActivateObjectType.md §2, §3.
"""
from __future__ import annotations

import re
from typing import Any, Callable, Optional

# Cache field in project state holding {SO_code: object_type}.
OBJECT_TYPES_FIELD = "object_types"

# Canonical object types (match the W3 normalizer's authoritative aliases).
TYPE_BRIDGE = "bridge"
TYPE_RETAINING_WALL = "retaining_wall"
TYPE_BUILDING = "building"

# ── detection rules (name + charakteristika ONLY) ────────────────────────────
# Retaining wall: an explicit wall adjective AND a wall noun must co-occur, so a
# bridge "opěra mostu" (abutment) is NOT caught by the opěrná stem.
_WALL_ADJ = re.compile(r"zárubní|opěrn[áéíoý]|úhlov[áéíý]|tížn|gabion", re.I)
_WALL_NOUN = re.compile(r"zeď|zdí|zdi|stěn", re.I)
# Bridge: bridge nouns. Wall is tested first, so an "opěrná zeď u mostu" → wall.
_BRIDGE = re.compile(r"most|lávk|estakád|přemost", re.I)
# Building.
_BUILDING = re.compile(r"budova|pozemní\s+stavb|bytov[ýé]\s+d[ůu]m|občansk", re.I)


def detect_object_type(
    object_name: str, charakteristika: str = ""
) -> Optional[str]:
    """Deterministically classify a construction object's type.

    Inputs are the object's NAME and its charakteristika sentence — NOTHING else
    (no full text). Returns 'bridge' | 'retaining_wall' | 'building', or None when
    the two fields do not determine a type (→ safe fallback, criterion #76).

    Order: retaining_wall → bridge → building. Wall wins over bridge when explicit
    wall wording is present (a zárubní/úhlová/opěrná zeď that mentions a bridge in
    passing is still a wall).
    """
    hay = f"{object_name or ''} {charakteristika or ''}"
    if _WALL_ADJ.search(hay) and _WALL_NOUN.search(hay):
        return TYPE_RETAINING_WALL
    if _BRIDGE.search(hay):
        return TYPE_BRIDGE
    if _BUILDING.search(hay):
        return TYPE_BUILDING
    return None


# ── project-state cache (keyed by SO code) ───────────────────────────────────
def _default_loader(project_id: str):
    from app.services.project_cache import load_project_cache

    return load_project_cache(project_id)


def _default_saver(project_id: str, field: str, value: Any) -> None:
    from app.services.project_cache import save_field

    save_field(project_id, field, value)


def load_object_types(
    project_id: str, *, loader: Optional[Callable] = None
) -> dict[str, str]:
    """Return the {SO_code: object_type} map from project state (empty if none)."""
    payload, _ = (loader or _default_loader)(project_id)
    mapping = (payload or {}).get(OBJECT_TYPES_FIELD) or {}
    return dict(mapping)


def get_cached_object_type(
    project_id: Optional[str],
    so_code: Optional[str],
    *,
    loader: Optional[Callable] = None,
) -> Optional[str]:
    """Consumer read: cached object_type for an SO code, or None on any miss.

    Read-only — NEVER detects. Missing project_id / so_code / entry → None so the
    classifier falls back to the W3 name+code heuristic (criterion #76)."""
    if not project_id or not so_code:
        return None
    return load_object_types(project_id, loader=loader).get(so_code)


def detect_and_cache_object_type(
    project_id: str,
    so_code: str,
    object_name: str,
    charakteristika: str = "",
    *,
    loader: Optional[Callable] = None,
    saver: Optional[Callable] = None,
) -> Optional[str]:
    """Producer: detect ONCE per object and persist under its SO code.

    Idempotent — if the SO code is already resolved in the cache, returns the
    cached value WITHOUT re-detecting (criterion #75). Detection runs only on the
    first call per object; element classification later only reads the cache.
    """
    existing = get_cached_object_type(project_id, so_code, loader=loader)
    if existing is not None:
        return existing
    otype = detect_object_type(object_name, charakteristika)
    if otype is not None and project_id and so_code:
        mapping = load_object_types(project_id, loader=loader)
        mapping[so_code] = otype
        (saver or _default_saver)(project_id, OBJECT_TYPES_FIELD, mapping)
    return otype
