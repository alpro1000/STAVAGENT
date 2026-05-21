"""
Tests for PR4b-1 IFC diff foundation — schemas + diff engine +
extractor pure helpers.

Runs without `ifcopenshell` (no wheel needed) because all tests use
synthetic snapshot dicts that mirror the shape captured by
`ifc_extractor._emit_entity_snapshots`. When a real IFC fixture lands
in the corpus, add an integration test that wires the extractor +
diff engine end-to-end against it; for now the contract is exercised
on hand-built dicts so the diff math is covered independently of
ifcopenshell schema variants.

Reference: docs/tasks/TASK_UEP_PR4.md §3.3
"""

from __future__ import annotations

import uuid

import pytest

from app.models.ifc_diff_schemas import (
    IfcChangeSeverity,
    IfcEntitySnapshot,
    IfcVersionMetadata,
)
from app.services.uep.ifc_diff_engine import compute_basic_ifc_diff
from app.services.uep.ifc_extractor import (
    _coerce_jsonable,
    _coerce_number,
    _compute_payload_hash,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _wall(gid: str, name: str = "W", area: float = 10.0) -> dict:
    """Build a snapshot dict shaped exactly like the extractor emits."""

    snap = {
        "global_id": gid,
        "ifc_type": "IfcWall",
        "name": name,
        "object_type": None,
        "storey_global_id": "STOREY-01",
        "quantities": {"NetArea": area},
        "material_layers": [],
        "property_sets": {},
    }
    snap["payload_hash"] = _compute_payload_hash(snap)
    return snap


def _slab(gid: str, volume: float = 5.0) -> dict:
    snap = {
        "global_id": gid,
        "ifc_type": "IfcSlab",
        "name": "S",
        "object_type": None,
        "storey_global_id": "STOREY-01",
        "quantities": {"NetVolume": volume},
        "material_layers": [],
        "property_sets": {},
    }
    snap["payload_hash"] = _compute_payload_hash(snap)
    return snap


@pytest.fixture
def diff_ids():
    return {
        "project_id": str(uuid.uuid4()),
        "old_version_id": str(uuid.uuid4()),
        "new_version_id": str(uuid.uuid4()),
    }


# ---------------------------------------------------------------------------
# Hash helper
# ---------------------------------------------------------------------------


class TestPayloadHash:
    def test_deterministic_key_order_independent(self):
        h1 = _compute_payload_hash({"ifc_type": "IfcWall", "name": "W"})
        h2 = _compute_payload_hash({"name": "W", "ifc_type": "IfcWall"})
        assert h1 == h2

    def test_quantity_drift_shifts_hash(self):
        h1 = _compute_payload_hash({"ifc_type": "IfcWall", "quantities": {"NetArea": 10.0}})
        h2 = _compute_payload_hash({"ifc_type": "IfcWall", "quantities": {"NetArea": 10.1}})
        assert h1 != h2

    def test_global_id_excluded_from_hash(self):
        # A GlobalId change must NOT register as `modified` — it's
        # an add + remove pair.
        h1 = _compute_payload_hash({"ifc_type": "IfcWall", "name": "W"})
        h2 = _compute_payload_hash({"ifc_type": "IfcWall", "name": "W", "global_id": "ANY"})
        assert h1 == h2

    def test_payload_hash_excluded_from_hash(self):
        # Chicken-and-egg — hash never recurses on itself.
        h1 = _compute_payload_hash({"ifc_type": "IfcWall"})
        h2 = _compute_payload_hash({"ifc_type": "IfcWall", "payload_hash": "previous_value"})
        assert h1 == h2

    def test_material_layer_order_matters(self):
        # Layer order encodes the physical stack — Vrstva 1 then 2.
        # Swapping the order IS a structural change.
        h1 = _compute_payload_hash({
            "ifc_type": "IfcWall",
            "material_layers": [{"name": "A", "thickness_m": 0.1}, {"name": "B", "thickness_m": 0.2}],
        })
        h2 = _compute_payload_hash({
            "ifc_type": "IfcWall",
            "material_layers": [{"name": "B", "thickness_m": 0.2}, {"name": "A", "thickness_m": 0.1}],
        })
        assert h1 != h2


# ---------------------------------------------------------------------------
# Coercion helpers
# ---------------------------------------------------------------------------


class TestCoercion:
    def test_bool_filtered(self):
        # bool is an int subclass in Python — guard so True doesn't
        # silently slip into a NetArea quantity.
        assert _coerce_number(True) is None
        assert _coerce_number(False) is None

    def test_none_returns_none(self):
        assert _coerce_number(None) is None

    def test_int_to_float(self):
        assert _coerce_number(3) == 3.0
        assert isinstance(_coerce_number(3), float)

    def test_string_number(self):
        assert _coerce_number("4.2") == 4.2

    def test_invalid_string(self):
        assert _coerce_number("not a number") is None

    def test_jsonable_passes_primitives(self):
        assert _coerce_jsonable(None) is None
        assert _coerce_jsonable(True) is True
        assert _coerce_jsonable(3.14) == 3.14
        assert _coerce_jsonable("text") == "text"

    def test_jsonable_recurses_lists_and_dicts(self):
        assert _coerce_jsonable([1, "a", {"k": 2}]) == [1, "a", {"k": 2}]

    def test_jsonable_fallback_to_str(self):
        class Opaque:
            def __str__(self):
                return "opaque"

        assert _coerce_jsonable(Opaque()) == "opaque"


# ---------------------------------------------------------------------------
# Schema contracts — verify the diff engine's expected dict shape
# round-trips through Pydantic without surprise.
# ---------------------------------------------------------------------------


class TestSnapshotSchema:
    def test_minimal_snapshot_validates(self):
        snap = IfcEntitySnapshot(
            global_id="GID1",
            ifc_type="IfcWall",
            payload_hash="abc",
        )
        assert snap.global_id == "GID1"
        assert snap.quantities == {}
        assert snap.material_layers == []
        assert snap.property_sets == {}

    def test_payload_hash_required(self):
        with pytest.raises(Exception):  # Pydantic ValidationError
            IfcEntitySnapshot(global_id="x", ifc_type="IfcWall")

    def test_version_metadata_validates(self):
        v = IfcVersionMetadata(
            version_id=str(uuid.uuid4()),
            project_id=str(uuid.uuid4()),
            file_name="model.ifc",
            file_size_bytes=12345,
            schema_version="IFC4",
            streaming_strategy="full",
            upload_timestamp="2026-05-20T10:00:00Z",
        )
        assert v.entity_snapshots == []


# ---------------------------------------------------------------------------
# Diff engine — basic three-bucket math
# ---------------------------------------------------------------------------


class TestDiffEngineBasic:
    def test_empty_diff(self, diff_ids):
        r = compute_basic_ifc_diff(
            **diff_ids, old_snapshots=[], new_snapshots=[]
        )
        assert r.total_added == 0
        assert r.total_removed == 0
        assert r.total_modified == 0
        assert r.entity_changes == []
        assert r.category_counts == []
        assert r.severity == IfcChangeSeverity.UNSCORED
        assert r.report_payload == {}

    def test_only_added(self, diff_ids):
        r = compute_basic_ifc_diff(
            **diff_ids,
            old_snapshots=[],
            new_snapshots=[_wall("W1"), _wall("W2"), _slab("S1")],
        )
        assert r.total_added == 3
        assert r.total_removed == 0
        assert r.total_modified == 0

    def test_only_removed(self, diff_ids):
        r = compute_basic_ifc_diff(
            **diff_ids,
            old_snapshots=[_wall("W1"), _slab("S1")],
            new_snapshots=[],
        )
        assert r.total_added == 0
        assert r.total_removed == 2
        assert r.total_modified == 0

    def test_unchanged_skipped(self, diff_ids):
        # Same GlobalId + same hash → unchanged → NOT in entity_changes.
        snap = _wall("W1", area=10.0)
        r = compute_basic_ifc_diff(
            **diff_ids, old_snapshots=[snap], new_snapshots=[dict(snap)]
        )
        assert r.entity_changes == []
        assert r.total_modified == 0

    def test_modified_by_hash_drift(self, diff_ids):
        r = compute_basic_ifc_diff(
            **diff_ids,
            old_snapshots=[_wall("W1", area=10.0)],
            new_snapshots=[_wall("W1", area=10.5)],
        )
        assert r.total_modified == 1
        change = r.entity_changes[0]
        assert change.change_kind == "modified"
        assert change.global_id == "W1"
        assert change.old_snapshot is not None
        assert change.new_snapshot is not None
        assert change.old_snapshot.quantities["NetArea"] == 10.0
        assert change.new_snapshot.quantities["NetArea"] == 10.5

    def test_global_id_change_is_add_plus_remove(self, diff_ids):
        # Rebuild the same wall with a new GlobalId — should NOT be a
        # "modified" entry, but one add + one remove.
        r = compute_basic_ifc_diff(
            **diff_ids,
            old_snapshots=[_wall("OLDGID", area=10.0)],
            new_snapshots=[_wall("NEWGID", area=10.0)],
        )
        assert r.total_added == 1
        assert r.total_removed == 1
        assert r.total_modified == 0

    def test_mixed_scenario(self, diff_ids):
        # W1 unchanged, W2 modified, W3 added, S1 removed.
        old = [_wall("W1", area=10.0), _wall("W2", area=20.0), _slab("S1")]
        new = [_wall("W1", area=10.0), _wall("W2", area=21.0), _wall("W3")]
        r = compute_basic_ifc_diff(**diff_ids, old_snapshots=old, new_snapshots=new)
        assert r.total_added == 1
        assert r.total_removed == 1
        assert r.total_modified == 1
        kinds = {(c.change_kind, c.global_id) for c in r.entity_changes}
        assert kinds == {("added", "W3"), ("removed", "S1"), ("modified", "W2")}

    def test_recast_modified_reports_new_type(self, diff_ids):
        # IfcWall → IfcWallStandardCase on the same GlobalId is a
        # legal Revit family-swap. The modified entry should reflect
        # the NEW ifc_type so category counts match the post-change
        # inventory.
        old_snap = _wall("X1")
        new_snap = dict(old_snap)
        new_snap["ifc_type"] = "IfcWallStandardCase"
        new_snap["payload_hash"] = _compute_payload_hash(new_snap)
        r = compute_basic_ifc_diff(
            **diff_ids, old_snapshots=[old_snap], new_snapshots=[new_snap]
        )
        assert r.total_modified == 1
        assert r.entity_changes[0].ifc_type == "IfcWallStandardCase"


# ---------------------------------------------------------------------------
# Category counts — every IfcType row even when one bucket is 0
# ---------------------------------------------------------------------------


class TestCategoryCounts:
    def test_one_row_per_observed_type(self, diff_ids):
        r = compute_basic_ifc_diff(
            **diff_ids,
            old_snapshots=[_wall("W1"), _wall("W2"), _slab("S1")],
            new_snapshots=[_wall("W1"), _wall("W3")],
        )
        rows = {c.ifc_type: c for c in r.category_counts}
        assert rows["IfcWall"].old_count == 2
        assert rows["IfcWall"].new_count == 2
        assert rows["IfcWall"].delta == 0
        assert rows["IfcSlab"].old_count == 1
        assert rows["IfcSlab"].new_count == 0
        assert rows["IfcSlab"].delta == -1

    def test_zero_bucket_still_emits_row(self, diff_ids):
        # Type entirely removed — must keep a row to surface the loss.
        r = compute_basic_ifc_diff(
            **diff_ids,
            old_snapshots=[_slab("S1")],
            new_snapshots=[_wall("W1")],
        )
        types = {c.ifc_type for c in r.category_counts}
        assert types == {"IfcSlab", "IfcWall"}

    def test_alphabetical_order_stable(self, diff_ids):
        r = compute_basic_ifc_diff(
            **diff_ids,
            old_snapshots=[_slab("S1"), _wall("W1")],
            new_snapshots=[],
        )
        types = [c.ifc_type for c in r.category_counts]
        assert types == sorted(types)


# ---------------------------------------------------------------------------
# Guard rails
# ---------------------------------------------------------------------------


class TestGuardRails:
    def test_same_version_id_raises(self, diff_ids):
        bad = {**diff_ids, "new_version_id": diff_ids["old_version_id"]}
        with pytest.raises(ValueError, match="refusing to diff a version against itself"):
            compute_basic_ifc_diff(**bad, old_snapshots=[], new_snapshots=[])

    def test_empty_global_id_raises(self, diff_ids):
        bad_snap = _wall("X")
        bad_snap["global_id"] = ""
        with pytest.raises(ValueError, match="missing GlobalId"):
            compute_basic_ifc_diff(
                **diff_ids, old_snapshots=[bad_snap], new_snapshots=[]
            )

    def test_duplicate_global_id_raises(self, diff_ids):
        a = _wall("DUP")
        b = _slab("DUP")
        with pytest.raises(ValueError, match="duplicate GlobalId"):
            compute_basic_ifc_diff(
                **diff_ids, old_snapshots=[a, b], new_snapshots=[]
            )

    def test_accepts_pydantic_model_instances(self, diff_ids):
        # `_index_by_gid` accepts either dicts OR already-validated
        # `IfcEntitySnapshot` instances. Caller convenience.
        snap = IfcEntitySnapshot(
            global_id="X1", ifc_type="IfcWall", payload_hash="h1"
        )
        r = compute_basic_ifc_diff(
            **diff_ids, old_snapshots=[], new_snapshots=[snap]
        )
        assert r.total_added == 1
        assert r.entity_changes[0].new_snapshot.global_id == "X1"
