"""
Item Store — PostgreSQL CRUD for project items with matching, versioning, namespace isolation.

Three operations:
1. bulk_import — Atomic import of positions from Excel, with dedup matching
2. read_items — Filtered read of items for any kiosk
3. update_block — Write to a specific namespace block

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-28
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from app.models.item_schemas import (
    BulkImportRequest,
    BulkImportResponse,
    ClassificationData,
    CodeSystem,
    CoreMetadata,
    EstimateData,
    ItemFilterRequest,
    ItemImportRow,
    ItemVersionEntry,
    MonolitData,
    Namespace,
    ProjectItem,
    UpdateBlockRequest,
    UpdateBlockResponse,
)
from app.services.code_detector import detect_code_system
from app.services.position_grouper import group_positions

logger = logging.getLogger(__name__)


def _generate_item_id() -> str:
    return f"item_{uuid.uuid4().hex[:16]}"


def _make_match_key(code_system: str, kod: str, mj: str, oddil_code: str = "") -> str:
    """Build the identity triple key for dedup matching."""
    parts = [
        code_system.lower().strip(),
        kod.strip().lower(),
        mj.strip().lower(),
    ]
    if code_system == "rts" and oddil_code:
        parts.append(oddil_code.strip().lower())
    return "|".join(parts)


# ═══════════════════════════════════════════════════════════════════════════════
# In-memory store (fallback when PostgreSQL is unavailable)
# Production uses PostgreSQL via async pool
# ═══════════════════════════════════════════════════════════════════════════════

_items_store: dict[str, dict] = {}  # item_id → item dict
_versions_store: list[dict] = []     # version entries


def _item_to_project_item(row: dict) -> ProjectItem:
    """Convert a DB row dict to ProjectItem model."""
    estimate_data = row.get("estimate_data") or {}
    monolit_data = row.get("monolit_data")
    classification_data = row.get("classification_data")

    return ProjectItem(
        item_id=row["item_id"],
        project_id=row["project_id"],
        estimate=EstimateData(**estimate_data) if estimate_data else EstimateData(),
        monolit=MonolitData(**monolit_data) if monolit_data else None,
        classification=ClassificationData(**classification_data) if classification_data else None,
        core=CoreMetadata(
            version=row.get("version", 1),
            created_at=row.get("created_at", ""),
            updated_at=row.get("updated_at", ""),
            estimate_filled=bool(estimate_data.get("kod") or estimate_data.get("popis")),
            monolit_filled=monolit_data is not None,
            classification_filled=classification_data is not None,
            deleted_in_reimport=row.get("deleted_in_reimport", False),
            source_file=row.get("source_file"),
            group_role=row.get("group_role"),
            group_leader_id=row.get("group_leader_id"),
            group_members=row.get("group_members"),
            armatura_included=row.get("armatura_included", False),
            opalubka_included=row.get("opalubka_included", False),
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# OPERATION 1: Bulk Import
# ═══════════════════════════════════════════════════════════════════════════════

async def bulk_import(request: BulkImportRequest, pool=None) -> BulkImportResponse:
    """
    Atomic import of positions from Excel.

    - Idempotent: repeated calls with same data don't create duplicates.
    - Matching: by code_system + kod + mj (identity triple).
    - Versioning: changed quantities/prices create version history entries.
    """
    project_id = request.project_id
    source_file = request.source_file
    now = datetime.utcnow().isoformat()

    created = 0
    updated = 0
    unchanged = 0
    result_items: list[ProjectItem] = []

    if pool:
        return await _bulk_import_pg(request, pool)

    # ── In-memory fallback ──
    # Build existing index for matching
    existing_by_key: dict[str, str] = {}  # match_key → item_id
    for iid, row in _items_store.items():
        if row["project_id"] == project_id:
            key = _make_match_key(
                row.get("code_system", "unknown"),
                row.get("kod", ""),
                row.get("mj", ""),
                row.get("oddil_code", ""),
            )
            existing_by_key[key] = iid

    # Track which items are in this import (for deleted_in_reimport detection)
    seen_ids: set[str] = set()

    for row in request.items:
        # Detect code system
        detection = detect_code_system(
            code=row.kod,
            popis=row.popis,
            price_source=row.price_source or "",
        )
        code_system = detection.code_system.value

        match_key = _make_match_key(code_system, row.kod, row.mj, row.oddil_code or "")

        estimate_data = {
            "kod": row.kod,
            "popis": row.popis,
            "popis_detail": row.popis_detail,
            "mnozstvi": row.mnozstvi,
            "mj": row.mj,
            "cena_jednotkova": row.cena_jednotkova,
            "cena_celkem": row.cena_celkem,
            "specification": row.specification,
            "price_source": row.price_source,
            "vv_lines": row.vv_lines,
            "sheet_name": row.sheet_name,
            "row_index": row.row_index,
        }

        classification_data = None
        if detection.confidence > 0:
            classification_data = {
                "code_system": code_system,
                "code_normalized": detection.code_normalized,
                "detection_confidence": detection.confidence,
                "detection_method": detection.detection_method,
            }
            if detection.hierarchy:
                classification_data["hierarchy"] = detection.hierarchy.model_dump()
            if detection.otskp_match:
                classification_data["standard_name"] = detection.otskp_match.get("nazev", "")
                classification_data["otskp_price"] = detection.otskp_match.get("cena")
                classification_data["otskp_unit"] = detection.otskp_match.get("mj", "")

        if match_key in existing_by_key:
            # ── Existing item: check for changes ──
            item_id = existing_by_key[match_key]
            existing = _items_store[item_id]
            old_estimate = existing.get("estimate_data", {})

            # Check if anything actually changed
            changes = _diff_estimate(old_estimate, estimate_data)
            if changes:
                # Save version history
                version = existing.get("version", 1) + 1
                _versions_store.append({
                    "item_id": item_id,
                    "version": version,
                    "changed_at": now,
                    "changed_fields": list(changes.keys()),
                    "old_values": {k: old_estimate.get(k) for k in changes},
                    "new_values": {k: estimate_data.get(k) for k in changes},
                })

                existing["estimate_data"] = estimate_data
                existing["version"] = version
                existing["updated_at"] = now
                existing["source_file"] = source_file
                if classification_data:
                    existing["classification_data"] = classification_data
                updated += 1
            else:
                unchanged += 1

            seen_ids.add(item_id)
            result_items.append(_item_to_project_item(existing))
        else:
            # ── New item ──
            item_id = _generate_item_id()
            item_row = {
                "item_id": item_id,
                "project_id": project_id,
                "code_system": code_system,
                "kod": row.kod,
                "popis": row.popis,
                "mj": row.mj,
                "so_id": row.so_id,
                "so_name": row.so_name,
                "oddil_code": row.oddil_code,
                "oddil_name": row.oddil_name,
                "estimate_data": estimate_data,
                "monolit_data": None,
                "classification_data": classification_data,
                "version": 1,
                "source_file": source_file,
                "deleted_in_reimport": False,
                "created_at": now,
                "updated_at": now,
            }
            _items_store[item_id] = item_row
            existing_by_key[match_key] = item_id
            seen_ids.add(item_id)
            created += 1
            result_items.append(_item_to_project_item(item_row))

    # Mark items not in this import as deleted_in_reimport
    for iid, row in _items_store.items():
        if row["project_id"] == project_id and iid not in seen_ids:
            row["deleted_in_reimport"] = True

    # Run position grouping (beton + armatura + opalubka)
    result_items = group_positions(result_items)

    # Persist grouping back to store
    for item in result_items:
        if item.item_id in _items_store:
            row = _items_store[item.item_id]
            row["group_role"] = item.core.group_role
            row["group_leader_id"] = item.core.group_leader_id
            row["group_members"] = item.core.group_members
            row["armatura_included"] = item.core.armatura_included
            row["opalubka_included"] = item.core.opalubka_included

    return BulkImportResponse(
        project_id=project_id,
        total=len(request.items),
        created=created,
        updated=updated,
        unchanged=unchanged,
        items=result_items,
    )


def _diff_estimate(old: dict, new: dict) -> dict:
    """Find fields that changed between old and new estimate data."""
    changes = {}
    compare_fields = ["mnozstvi", "cena_jednotkova", "cena_celkem", "popis", "specification"]
    for field in compare_fields:
        old_val = old.get(field)
        new_val = new.get(field)
        if old_val != new_val:
            # For numeric: ignore tiny floating point differences
            if isinstance(old_val, (int, float)) and isinstance(new_val, (int, float)):
                if old_val and abs(old_val - new_val) / max(abs(old_val), 1) < 0.001:
                    continue
            changes[field] = {"old": old_val, "new": new_val}
    return changes


# ═══════════════════════════════════════════════════════════════════════════════
# OPERATION 2: Read Items with Filters
# ═══════════════════════════════════════════════════════════════════════════════

async def read_items(
    project_id: str,
    filters: Optional[ItemFilterRequest] = None,
    pool=None,
) -> list[ProjectItem]:
    """Read project items with optional filters."""
    if pool:
        return await _read_items_pg(project_id, filters, pool)

    # ── In-memory fallback ──
    items = []
    for row in _items_store.values():
        if row["project_id"] != project_id:
            continue
        if row.get("deleted_in_reimport", False):
            continue

        if filters:
            # Filter by skupina (work group)
            if filters.skupina:
                cls = row.get("classification_data") or {}
                if cls.get("skupina") != filters.skupina:
                    continue

            # Filter by code_system
            if filters.code_system:
                if row.get("code_system") != filters.code_system.value:
                    continue

            # Filter by monolit filled
            if filters.has_monolit is not None:
                has = row.get("monolit_data") is not None
                if has != filters.has_monolit:
                    continue

            # Filter by classification filled
            if filters.has_classification is not None:
                has = row.get("classification_data") is not None
                if has != filters.has_classification:
                    continue

            # Filter by keyword in popis
            if filters.keyword:
                kw = filters.keyword.lower()
                popis = row.get("popis", "").lower()
                estimate_popis = (row.get("estimate_data") or {}).get("popis", "").lower()
                if kw not in popis and kw not in estimate_popis:
                    continue

            # Filter by SO
            if filters.so_id:
                if row.get("so_id") != filters.so_id:
                    continue

        items.append(_item_to_project_item(row))

    return items


# ═══════════════════════════════════════════════════════════════════════════════
# OPERATION 3: Update Namespace Block
# ═══════════════════════════════════════════════════════════════════════════════

async def update_block(
    item_id: str,
    request: UpdateBlockRequest,
    pool=None,
) -> UpdateBlockResponse:
    """Update a specific namespace block of an item."""
    if pool:
        return await _update_block_pg(item_id, request, pool)

    # ── In-memory fallback ──
    if item_id not in _items_store:
        raise ValueError(f"Item {item_id} not found")

    row = _items_store[item_id]
    ns = request.namespace
    now = datetime.utcnow().isoformat()

    if ns == Namespace.ESTIMATE:
        row["estimate_data"] = request.data
        row["updated_at"] = now
    elif ns == Namespace.MONOLIT:
        row["monolit_data"] = request.data
        row["updated_at"] = now
    elif ns == Namespace.CLASSIFICATION:
        row["classification_data"] = request.data
        row["updated_at"] = now
    elif ns == Namespace.CORE:
        raise ValueError("Namespace 'core' is read-only. Only Core Engine manages this block.")
    else:
        raise ValueError(f"Unknown namespace: {ns}")

    return UpdateBlockResponse(
        item_id=item_id,
        namespace=ns.value,
        updated=True,
        item=_item_to_project_item(row),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Version History
# ═══════════════════════════════════════════════════════════════════════════════

async def get_item_versions(item_id: str, pool=None) -> list[ItemVersionEntry]:
    """Get version history for an item."""
    # In-memory fallback
    entries = [
        ItemVersionEntry(
            version=v["version"],
            changed_at=v["changed_at"],
            changed_fields=v["changed_fields"],
            old_values=v["old_values"],
            new_values=v["new_values"],
        )
        for v in _versions_store
        if v["item_id"] == item_id
    ]
    return sorted(entries, key=lambda e: e.version, reverse=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PostgreSQL implementations (used when pool is available)
# ═══════════════════════════════════════════════════════════════════════════════

async def _bulk_import_pg(request: BulkImportRequest, pool) -> BulkImportResponse:
    """PostgreSQL implementation of bulk_import."""
    project_id = request.project_id
    source_file = request.source_file
    now = datetime.utcnow().isoformat()

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Load existing items for this project
            rows = await conn.fetch(
                "SELECT item_id, code_system, kod, mj, oddil_code, estimate_data, version "
                "FROM project_items WHERE project_id = $1 AND NOT deleted_in_reimport",
                project_id,
            )

            existing_by_key = {}
            existing_by_id = {}
            for r in rows:
                key = _make_match_key(r["code_system"], r["kod"], r["mj"], r["oddil_code"] or "")
                existing_by_key[key] = dict(r)
                existing_by_id[r["item_id"]] = dict(r)

            created = 0
            updated = 0
            unchanged = 0
            result_ids = []
            seen_ids = set()

            for row in request.items:
                detection = detect_code_system(row.kod, row.popis, row.price_source or "")
                code_system = detection.code_system.value
                match_key = _make_match_key(code_system, row.kod, row.mj, row.oddil_code or "")

                estimate_data = json.dumps({
                    "kod": row.kod, "popis": row.popis, "popis_detail": row.popis_detail,
                    "mnozstvi": row.mnozstvi, "mj": row.mj,
                    "cena_jednotkova": row.cena_jednotkova, "cena_celkem": row.cena_celkem,
                    "specification": row.specification, "price_source": row.price_source,
                    "vv_lines": row.vv_lines, "sheet_name": row.sheet_name, "row_index": row.row_index,
                })

                classification_json = None
                if detection.confidence > 0:
                    cls_dict = {
                        "code_system": code_system,
                        "code_normalized": detection.code_normalized,
                        "detection_confidence": detection.confidence,
                        "detection_method": detection.detection_method,
                    }
                    if detection.hierarchy:
                        cls_dict["hierarchy"] = detection.hierarchy.model_dump()
                    if detection.otskp_match:
                        cls_dict["standard_name"] = detection.otskp_match.get("nazev", "")
                        cls_dict["otskp_price"] = detection.otskp_match.get("cena")
                        cls_dict["otskp_unit"] = detection.otskp_match.get("mj", "")
                    classification_json = json.dumps(cls_dict)

                if match_key in existing_by_key:
                    ex = existing_by_key[match_key]
                    item_id = ex["item_id"]
                    old_estimate = json.loads(ex["estimate_data"]) if isinstance(ex["estimate_data"], str) else (ex["estimate_data"] or {})
                    new_estimate = json.loads(estimate_data)
                    changes = _diff_estimate(old_estimate, new_estimate)

                    if changes:
                        new_version = (ex.get("version") or 1) + 1
                        await conn.execute(
                            "INSERT INTO item_versions (item_id, version, changed_at, changed_fields, old_values, new_values) "
                            "VALUES ($1, $2, $3, $4, $5, $6)",
                            item_id, new_version, now,
                            list(changes.keys()),
                            json.dumps({k: old_estimate.get(k) for k in changes}),
                            json.dumps({k: new_estimate.get(k) for k in changes}),
                        )
                        await conn.execute(
                            "UPDATE project_items SET estimate_data = $1, classification_data = COALESCE($2, classification_data), "
                            "version = $3, source_file = $4, updated_at = $5, deleted_in_reimport = FALSE "
                            "WHERE item_id = $6",
                            estimate_data, classification_json, new_version, source_file, now, item_id,
                        )
                        updated += 1
                    else:
                        unchanged += 1

                    seen_ids.add(item_id)
                    result_ids.append(item_id)
                else:
                    item_id = _generate_item_id()
                    await conn.execute(
                        "INSERT INTO project_items "
                        "(item_id, project_id, code_system, kod, popis, mj, so_id, so_name, oddil_code, oddil_name, "
                        " estimate_data, classification_data, version, source_file, created_at, updated_at) "
                        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
                        item_id, project_id, code_system, row.kod, row.popis, row.mj,
                        row.so_id, row.so_name, row.oddil_code, row.oddil_name,
                        estimate_data, classification_json, 1, source_file, now, now,
                    )
                    seen_ids.add(item_id)
                    result_ids.append(item_id)
                    created += 1

            # Mark missing items
            for iid in existing_by_id:
                if iid not in seen_ids:
                    await conn.execute(
                        "UPDATE project_items SET deleted_in_reimport = TRUE, updated_at = $1 WHERE item_id = $2",
                        now, iid,
                    )

            # Fetch all result items
            result_rows = await conn.fetch(
                "SELECT * FROM project_items WHERE item_id = ANY($1::varchar[])",
                result_ids,
            )

    result_items = [_item_to_project_item(_pg_row_to_dict(r)) for r in result_rows]

    return BulkImportResponse(
        project_id=project_id,
        total=len(request.items),
        created=created,
        updated=updated,
        unchanged=unchanged,
        items=result_items,
    )


async def _read_items_pg(project_id: str, filters: Optional[ItemFilterRequest], pool) -> list[ProjectItem]:
    """PostgreSQL implementation of read_items."""
    query = "SELECT * FROM project_items WHERE project_id = $1 AND NOT deleted_in_reimport"
    params = [project_id]
    idx = 2

    if filters:
        if filters.code_system:
            query += f" AND code_system = ${idx}"
            params.append(filters.code_system.value)
            idx += 1
        if filters.so_id:
            query += f" AND so_id = ${idx}"
            params.append(filters.so_id)
            idx += 1
        if filters.keyword:
            query += f" AND popis ILIKE ${idx}"
            params.append(f"%{filters.keyword}%")
            idx += 1
        if filters.skupina:
            query += f" AND classification_data->>'skupina' = ${idx}"
            params.append(filters.skupina)
            idx += 1
        if filters.has_monolit is True:
            query += " AND monolit_data IS NOT NULL"
        elif filters.has_monolit is False:
            query += " AND monolit_data IS NULL"
        if filters.has_classification is True:
            query += " AND classification_data IS NOT NULL"
        elif filters.has_classification is False:
            query += " AND classification_data IS NULL"

    query += " ORDER BY so_id, oddil_code, kod"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    return [_item_to_project_item(_pg_row_to_dict(r)) for r in rows]


async def _update_block_pg(item_id: str, request: UpdateBlockRequest, pool) -> UpdateBlockResponse:
    """PostgreSQL implementation of update_block."""
    ns = request.namespace
    now = datetime.utcnow().isoformat()
    data_json = json.dumps(request.data)

    if ns == Namespace.CORE:
        raise ValueError("Namespace 'core' is read-only. Only Core Engine manages this block.")

    column_map = {
        Namespace.ESTIMATE: "estimate_data",
        Namespace.MONOLIT: "monolit_data",
        Namespace.CLASSIFICATION: "classification_data",
    }
    column = column_map.get(ns)
    if not column:
        raise ValueError(f"Unknown namespace: {ns}")

    async with pool.acquire() as conn:
        # Use CASE-based query to avoid f-string SQL interpolation (CWE-89)
        query = """
            UPDATE project_items
            SET estimate_data = CASE WHEN $4 = 'estimate_data' THEN $1 ELSE estimate_data END,
                monolit_data = CASE WHEN $4 = 'monolit_data' THEN $1 ELSE monolit_data END,
                classification_data = CASE WHEN $4 = 'classification_data' THEN $1 ELSE classification_data END,
                updated_at = $2
            WHERE item_id = $3
        """
        result = await conn.execute(query, data_json, now, item_id, column)
        if result == "UPDATE 0":
            raise ValueError(f"Item {item_id} not found")

        row = await conn.fetchrow("SELECT * FROM project_items WHERE item_id = $1", item_id)

    item = _item_to_project_item(_pg_row_to_dict(row))
    return UpdateBlockResponse(
        item_id=item_id,
        namespace=ns.value,
        updated=True,
        item=item,
    )


def _pg_row_to_dict(row) -> dict:
    """Convert asyncpg Record to dict, parsing JSONB fields."""
    d = dict(row)
    for key in ("estimate_data", "monolit_data", "classification_data"):
        val = d.get(key)
        if isinstance(val, str):
            try:
                d[key] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                d[key] = {}
    # Convert datetime to isoformat string
    for key in ("created_at", "updated_at"):
        val = d.get(key)
        if hasattr(val, "isoformat"):
            d[key] = val.isoformat()
    return d


# ═══════════════════════════════════════════════════════════════════════════════
# Store reset (for testing)
# ═══════════════════════════════════════════════════════════════════════════════

def reset_store():
    """Reset in-memory store. For testing only."""
    global _items_store, _versions_store
    _items_store = {}
    _versions_store = []
