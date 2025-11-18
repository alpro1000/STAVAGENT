"""Canonical contract helpers for audit results."""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple


AUDIT_STATUSES = {"GREEN", "AMBER", "RED"}


def _safe_text(value: Any) -> str:
    text = str(value or "").strip()
    return text


def _safe_code(value: Any) -> Optional[str]:
    text = _safe_text(value).upper()
    return text or None


def _coerce_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = _safe_text(value)
    if not text:
        return None
    normalised = text.replace(" ", "").replace("\xa0", "").replace(",", ".")
    try:
        return float(normalised)
    except ValueError:
        return None


def _normalise_status(value: Any, classify: Optional[Callable[[Dict[str, Any]], str]] = None, position: Optional[Dict[str, Any]] = None) -> str:
    candidate = _safe_text(value).upper()
    if candidate in AUDIT_STATUSES:
        return candidate
    if classify and position is not None:
        try:
            label = _safe_text(classify(position)).upper()
        except Exception:  # pragma: no cover - defensive guard
            label = ""
        if label in AUDIT_STATUSES:
            return label
    return "GREEN"


def _collect_issue_list(position: Dict[str, Any]) -> List[str]:
    issues: List[str] = []

    def _append(item: Any) -> None:
        if item is None:
            return
        if isinstance(item, str):
            tokens = [token.strip() for token in re.split(r"[;\n]", item) if token.strip()]
            issues.extend(tokens)
        elif isinstance(item, (list, tuple, set)):
            for entry in item:
                _append(entry)

    for key in (
        "issues",
        "notes",
        "reason",
        "audit_notes",
        "validation_message",
        "validation_notes",
        "advice",
    ):
        _append(position.get(key))

    validation_results = position.get("validation_results")
    if isinstance(validation_results, dict):
        for bucket in ("errors", "warnings"):
            _append(validation_results.get(bucket))

    amber_reason = position.get("amber_reason")
    if amber_reason:
        _append(str(amber_reason))

    seen: set[str] = set()
    unique: List[str] = []
    for note in issues:
        if note not in seen:
            seen.add(note)
            unique.append(note)
    return unique


def _build_provenance(position: Dict[str, Any], fallback_index: int) -> Dict[str, Any]:
    provenance: Dict[str, Any] = {}

    position_id = (
        position.get("position_id")
        or position.get("id")
        or position.get("position_number")
        or position.get("code")
    )
    if position_id:
        provenance["position_id"] = str(position_id)
    else:
        provenance["position_id"] = f"pos-{fallback_index:04d}"

    section = position.get("section") or position.get("section_name")
    if section:
        provenance["section"] = section

    sheet = position.get("sheet_name") or position.get("source_document")
    if sheet:
        provenance["sheet"] = sheet

    source_ref = position.get("source_ref")
    if isinstance(source_ref, dict):
        filtered = {key: value for key, value in source_ref.items() if value not in (None, "")}
        if filtered:
            provenance["source"] = filtered
    elif source_ref:
        provenance["source"] = source_ref

    details: Dict[str, Any] = {}
    for key in ("enrichment", "validation_results", "schema_validation"):
        data = position.get(key)
        if isinstance(data, dict) and data:
            details[key] = data
    if details:
        provenance["details"] = details

    return provenance


def build_audit_items(
    positions: Iterable[Dict[str, Any]],
    classify: Optional[Callable[[Dict[str, Any]], str]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    items: List[Dict[str, Any]] = []
    totals = {"GREEN": 0, "AMBER": 0, "RED": 0}

    for index, raw in enumerate(positions or [], start=1):
        if not isinstance(raw, dict):
            continue

        status = _normalise_status(
            raw.get("status")
            or raw.get("classification")
            or raw.get("audit"),
            classify=classify,
            position=raw,
        )
        totals[status] += 1

        item = {
            "code": _safe_code(raw.get("code") or raw.get("position_code")),
            "description": _safe_text(raw.get("description")),
            "unit": _safe_text(raw.get("unit")),
            "quantity": _coerce_float(raw.get("quantity")),
            "status": status,
            "issues": _collect_issue_list(raw),
            "provenance": _build_provenance(raw, index),
        }
        items.append(item)

    totals["TOTAL"] = len(items)
    return items, totals


def build_audit_contract(
    positions: Iterable[Dict[str, Any]],
    enrichment_stats: Optional[Dict[str, Any]] = None,
    validation_stats: Optional[Dict[str, Any]] = None,
    audit_stats: Optional[Dict[str, Any]] = None,
    schema_stats: Optional[Dict[str, Any]] = None,
    classify: Optional[Callable[[Dict[str, Any]], str]] = None,
) -> Dict[str, Any]:
    items, totals = build_audit_items(positions, classify=classify)

    totals_block = {
        "g": totals.get("GREEN", 0),
        "a": totals.get("AMBER", 0),
        "r": totals.get("RED", 0),
        "total": totals.get("TOTAL", len(items)),
    }

    audit_breakdown = dict(audit_stats or {})
    if not audit_breakdown:
        audit_breakdown = {
            "green": totals_block["g"],
            "amber": totals_block["a"],
            "red": totals_block["r"],
        }

    payload = {
        "totals": totals_block,
        "items": items,
        "preview": items[:100],
        "meta": {
            "enrichment": dict(enrichment_stats or {}),
            "validation": dict(validation_stats or {}),
            "audit": audit_breakdown,
            "schema_validation": dict(schema_stats or {}),
        },
    }

    return payload


def is_new_contract(audit_results: Dict[str, Any] | None) -> bool:
    if not isinstance(audit_results, dict):
        return False
    totals = audit_results.get("totals")
    items = audit_results.get("items")
    if not isinstance(totals, dict) or not isinstance(items, list):
        return False
    required = {"g", "a", "r", "total"}
    return required.issubset(totals.keys())


def ensure_audit_contract(
    audit_results: Dict[str, Any] | None,
    fallback_positions: Optional[Iterable[Dict[str, Any]]] = None,
    classify: Optional[Callable[[Dict[str, Any]], str]] = None,
) -> Tuple[Dict[str, Any], bool]:
    """Ensure payload follows the canonical audit contract."""

    if is_new_contract(audit_results):
        payload = dict(audit_results)  # shallow copy
        payload.setdefault("preview", list(payload.get("items", []))[:100])
        meta = payload.setdefault("meta", {})
        meta.setdefault("enrichment", {})
        meta.setdefault("validation", {})
        meta.setdefault("audit", {
            "green": payload["totals"].get("g", 0),
            "amber": payload["totals"].get("a", 0),
            "red": payload["totals"].get("r", 0),
        })
        meta.setdefault("schema_validation", {})
        return payload, False

    raw_positions: List[Dict[str, Any]] = []

    if isinstance(audit_results, dict):
        if isinstance(audit_results.get("items"), list):
            raw_positions.extend(
                item for item in audit_results.get("items", []) if isinstance(item, dict)
            )
        elif isinstance(audit_results.get("positions"), list):
            raw_positions.extend(
                item for item in audit_results.get("positions", []) if isinstance(item, dict)
            )

    if not raw_positions and fallback_positions is not None:
        raw_positions.extend(item for item in fallback_positions if isinstance(item, dict))

    enrichment_stats = None
    validation_stats = None
    audit_stats = None
    schema_stats = None
    if isinstance(audit_results, dict):
        enrichment_stats = audit_results.get("enrichment_stats") or audit_results.get("meta", {}).get("enrichment")
        validation_stats = audit_results.get("validation_stats") or audit_results.get("meta", {}).get("validation")
        schema_stats = audit_results.get("schema_validation") or audit_results.get("meta", {}).get("schema_validation")
        audit_stats = audit_results.get("audit") or audit_results.get("meta", {}).get("audit")

    payload = build_audit_contract(
        raw_positions,
        enrichment_stats=enrichment_stats,
        validation_stats=validation_stats,
        audit_stats=audit_stats,
        schema_stats=schema_stats,
        classify=classify,
    )

    return payload, True


__all__ = [
    "build_audit_contract",
    "build_audit_items",
    "ensure_audit_contract",
    "is_new_contract",
]

