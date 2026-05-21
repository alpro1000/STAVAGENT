"""
UEP IFC diff engine — PR4b-1 basic deterministic diff.

Pure-function module that compares two IFC version snapshots (as
captured by `ifc_extractor._emit_entity_snapshots`) and emits a
`IfcDiffReport` with:

  - **add / remove / modify** lists, keyed by GlobalId
  - per-IfcType `IfcCategoryCount` deltas
  - PR4b-1 leaves `severity=UNSCORED`, `report_payload={}` —
    PR4b-2 fills quantity_deltas / material_changes /
    property_changes / severity_rules_fired into `report_payload`
    + flips `severity` per the rule table in task §3.3.

Identity:
  GlobalId is the only stable identity carrier across IFC exports
  (per IFC4 §5.1.3.1.7). Name / ObjectPlacement / IsDefinedBy ordering
  are all volatile under Revit / Allplan / ArchiCAD round-trips, so
  we never use them as identity.

Modified detection:
  `payload_hash` (SHA-256 over canonical-JSON of the diff-relevant
  fields) is recomputed on every extraction. A diff in any of
  {ifc_type, name, object_type, storey_global_id, quantities,
   material_layers, property_sets} flips the hash → entity classified
  as `modified`. Hash equality on the same GlobalId → unchanged,
  skipped from the report.

  GlobalId change is NOT a "modified" — it's an add + remove pair
  (the entity has lost its identity).

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.3.4
Reference: docs/tasks/TASK_UEP_PR4.md §3.3
"""

from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Iterable

from app.models.ifc_diff_schemas import (
    IfcCategoryCount,
    IfcChangeSeverity,
    IfcDiffReport,
    IfcEntityChange,
    IfcEntitySnapshot,
)


def compute_basic_ifc_diff(
    *,
    project_id: str,
    old_version_id: str,
    new_version_id: str,
    old_snapshots: Iterable[dict | IfcEntitySnapshot],
    new_snapshots: Iterable[dict | IfcEntitySnapshot],
) -> IfcDiffReport:
    """Compare two snapshot lists and return a foundation diff report.

    Parameters are keyword-only so callers can't swap old/new by
    accident — that swap would produce a deceptively-valid report
    with adds and removes inverted.

    Args:
        project_id: UUID of the owning project (FK target).
        old_version_id: UUID of the previous `ifc_versions` row.
        new_version_id: UUID of the current `ifc_versions` row.
        old_snapshots: Iterable of dicts or `IfcEntitySnapshot`
            instances from the previous extraction
            (`raw_data["entity_snapshots"]`).
        new_snapshots: Same shape, for the current extraction.

    Returns:
        Populated `IfcDiffReport`. `severity` is `UNSCORED` and
        `report_payload` is `{}` — PR4b-2 will fill them.

    Raises:
        ValueError: if `old_version_id == new_version_id` (no-op
            comparison) or any snapshot lacks a GlobalId.
    """

    if old_version_id == new_version_id:
        raise ValueError(
            "compute_basic_ifc_diff: old_version_id == new_version_id "
            f"({old_version_id!r}); refusing to diff a version against itself."
        )

    old_by_gid = _index_by_gid(old_snapshots, side="old")
    new_by_gid = _index_by_gid(new_snapshots, side="new")

    old_gids = set(old_by_gid.keys())
    new_gids = set(new_by_gid.keys())

    added_gids = new_gids - old_gids
    removed_gids = old_gids - new_gids
    common_gids = old_gids & new_gids

    entity_changes: list[IfcEntityChange] = []

    for gid in sorted(added_gids):
        snap = new_by_gid[gid]
        entity_changes.append(
            IfcEntityChange(
                change_kind="added",
                ifc_type=snap.ifc_type,
                global_id=gid,
                old_snapshot=None,
                new_snapshot=snap,
            )
        )

    for gid in sorted(removed_gids):
        snap = old_by_gid[gid]
        entity_changes.append(
            IfcEntityChange(
                change_kind="removed",
                ifc_type=snap.ifc_type,
                global_id=gid,
                old_snapshot=snap,
                new_snapshot=None,
            )
        )

    for gid in sorted(common_gids):
        old_snap = old_by_gid[gid]
        new_snap = new_by_gid[gid]
        # GlobalId is the same, but the new payload_hash differs →
        # something inside the diff-relevant fields shifted.
        if old_snap.payload_hash == new_snap.payload_hash:
            continue
        entity_changes.append(
            IfcEntityChange(
                # New IfcType on the same GlobalId is rare but legal
                # (re-cast of an IfcWallStandardCase → IfcWall, e.g.
                # via a Revit family swap). Report the NEW type so
                # category counts reflect the post-change inventory.
                change_kind="modified",
                ifc_type=new_snap.ifc_type,
                global_id=gid,
                old_snapshot=old_snap,
                new_snapshot=new_snap,
            )
        )

    category_counts = _compute_category_counts(old_by_gid, new_by_gid)

    total_added = sum(1 for c in entity_changes if c.change_kind == "added")
    total_removed = sum(1 for c in entity_changes if c.change_kind == "removed")
    total_modified = sum(1 for c in entity_changes if c.change_kind == "modified")

    return IfcDiffReport(
        diff_id=str(uuid.uuid4()),
        project_id=project_id,
        old_version_id=old_version_id,
        new_version_id=new_version_id,
        generated_at=datetime.now(timezone.utc),
        severity=IfcChangeSeverity.UNSCORED,
        total_added=total_added,
        total_removed=total_removed,
        total_modified=total_modified,
        category_counts=category_counts,
        entity_changes=entity_changes,
        report_payload={},
        diff_engine_version="1.0",
    )


# ---------------------------------------------------------------------------
# Internal helpers — pure-function, unit-testable.
# ---------------------------------------------------------------------------


def _index_by_gid(
    snapshots: Iterable[dict | IfcEntitySnapshot],
    *,
    side: str,
) -> dict[str, IfcEntitySnapshot]:
    """Build GlobalId → snapshot index, validating + hydrating in one pass.

    Hydration: callers can pass either raw dicts (as stored in
    `raw_data["entity_snapshots"]`) or already-validated
    `IfcEntitySnapshot` instances. Both forms collapse to the model
    instance for downstream code.

    Validation: empty GlobalId is a contract violation upstream
    (`_emit_entity_snapshots` already skips entities without one), so
    we raise loudly rather than silently dropping — a silent drop
    would inflate the `added` / `removed` bucket on the OTHER side.

    `side` is purely for the error message ("old" vs "new") so the
    caller can pinpoint which extraction is malformed.
    """

    out: dict[str, IfcEntitySnapshot] = {}
    for raw in snapshots:
        snap = raw if isinstance(raw, IfcEntitySnapshot) else IfcEntitySnapshot(**raw)
        gid = snap.global_id
        if not gid:
            raise ValueError(
                f"compute_basic_ifc_diff: {side}-side snapshot missing GlobalId "
                f"(ifc_type={snap.ifc_type!r}, name={snap.name!r}). The "
                "extractor must skip such entities upstream."
            )
        if gid in out:
            # Duplicate GlobalId in one extraction is also a contract
            # violation — IFC requires uniqueness. Surface loudly.
            raise ValueError(
                f"compute_basic_ifc_diff: duplicate GlobalId {gid!r} on "
                f"{side} side (entries: {out[gid].ifc_type} + {snap.ifc_type})."
            )
        out[gid] = snap
    return out


def _compute_category_counts(
    old_by_gid: dict[str, IfcEntitySnapshot],
    new_by_gid: dict[str, IfcEntitySnapshot],
) -> list[IfcCategoryCount]:
    """One `IfcCategoryCount` per IfcType observed in either side.

    Both sides keep a row even when one bucket is zero — that's how a
    consumer reads "everything of type X was removed" without rejoining
    the snapshot lists. Sorted alphabetically for stable output.
    """

    old_counts = Counter(s.ifc_type for s in old_by_gid.values())
    new_counts = Counter(s.ifc_type for s in new_by_gid.values())
    all_types = sorted(set(old_counts) | set(new_counts))
    return [
        IfcCategoryCount(
            ifc_type=t,
            old_count=old_counts.get(t, 0),
            new_count=new_counts.get(t, 0),
            delta=new_counts.get(t, 0) - old_counts.get(t, 0),
        )
        for t in all_types
    ]
