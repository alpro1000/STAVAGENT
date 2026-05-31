"""Audit-log writer + content hashing for the orchestrator (PR3b).

Turns orchestrator events (tool calls, state transitions, policy violations) into
immutable rows in `orchestrator_audit_log` (the append-only table from the PR3b
migration). The orchestrator depends only on the `AuditLogWriter` protocol, so
tests inject an in-memory fake and production injects the DB-backed writer.

Hashing (AC14 + the replay guarantee): tool inputs / outputs / policy are stored
as sha256 digests of their *canonical* JSON. Canonicalization sorts keys and —
critically — strips volatile fields (timestamps) recursively, so the same logical
call hashes identically across runs. This is what lets the replay verification
(AC20) compare two runs without a wall-clock-induced mismatch.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §3, AC13, AC14, AC16, AC20.
"""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, Protocol
from uuid import UUID

# Core engine version stamped on every audit row (AC14). Overridable per
# deployment; the value is part of the replay contract — same inputs + same
# engine version must reproduce the same run (AC20 / Domain Rules).
CORE_ENGINE_VERSION = os.environ.get("CORE_ENGINE_VERSION", "stage-gating-1.0.0")

# Keys treated as non-deterministic and dropped before hashing/replay compare.
# "at" is the orchestrator's per-record timestamp; the rest cover common
# timestamp field names that may appear nested in tool payloads.
VOLATILE_KEYS = frozenset({"at", "timestamp", "created_at", "updated_at", "ts"})

# Event types — must match the CHECK constraint in the migration.
EVENT_TOOL_CALL = "tool_call"
EVENT_STATE_TRANSITION = "state_transition"
EVENT_POLICY_VIOLATION = "policy_violation"


def strip_volatile(value: Any) -> Any:
    """Recursively drop VOLATILE_KEYS so timestamps don't perturb a hash."""
    if isinstance(value, dict):
        return {
            k: strip_volatile(v)
            for k, v in value.items()
            if k not in VOLATILE_KEYS
        }
    if isinstance(value, (list, tuple)):
        return [strip_volatile(v) for v in value]
    return value


def hash_payload(payload: Any) -> Optional[str]:
    """sha256 hex of the canonical, volatile-stripped JSON of `payload`.

    Returns None for a None payload (so an absent input/output records NULL, not
    the hash of "null"). Deterministic: sort_keys + compact separators + UTF-8.
    """
    if payload is None:
        return None
    canonical = json.dumps(
        strip_volatile(payload),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@dataclass
class AuditEntry:
    """One audit record, mapping 1:1 to orchestrator_audit_log columns."""

    event_type: str
    session_id: UUID
    user_id: UUID
    project_id: Optional[UUID] = None
    tool_name: Optional[str] = None
    tool_version: Optional[str] = None
    inputs_hash: Optional[str] = None
    outputs_hash: Optional[str] = None
    policy_hash: Optional[str] = None
    core_engine_version: str = CORE_ENGINE_VERSION
    transition_from: Optional[str] = None
    transition_to: Optional[str] = None
    transition_source: Optional[str] = None
    detail: Optional[dict[str, Any]] = None


# ── entry builders (compute hashes) ──────────────────────────────────────────
def build_tool_call_entry(
    *,
    session_id: UUID,
    user_id: UUID,
    project_id: Optional[UUID],
    tool_name: str,
    tool_version: Optional[str],
    inputs: Any = None,
    outputs: Any = None,
    policy: Any = None,
    detail: Optional[dict[str, Any]] = None,
) -> AuditEntry:
    return AuditEntry(
        event_type=EVENT_TOOL_CALL,
        session_id=session_id,
        user_id=user_id,
        project_id=project_id,
        tool_name=tool_name,
        tool_version=tool_version,
        inputs_hash=hash_payload(inputs),
        outputs_hash=hash_payload(outputs),
        policy_hash=hash_payload(policy),
        detail=detail,
    )


def build_state_transition_entry(
    *,
    session_id: UUID,
    user_id: UUID,
    project_id: Optional[UUID],
    transition_from: str,
    transition_to: str,
    transition_source: str,
) -> AuditEntry:
    return AuditEntry(
        event_type=EVENT_STATE_TRANSITION,
        session_id=session_id,
        user_id=user_id,
        project_id=project_id,
        transition_from=transition_from,
        transition_to=transition_to,
        transition_source=transition_source,
    )


def build_policy_violation_entry(
    *,
    session_id: UUID,
    user_id: UUID,
    project_id: Optional[UUID],
    tool_name: str,
    detail: dict[str, Any],
) -> AuditEntry:
    return AuditEntry(
        event_type=EVENT_POLICY_VIOLATION,
        session_id=session_id,
        user_id=user_id,
        project_id=project_id,
        tool_name=tool_name,
        policy_hash=hash_payload(detail),
        detail=detail,
    )


# ── writers ──────────────────────────────────────────────────────────────────
class AuditLogWriter(Protocol):
    """Persistence boundary for audit entries. Orchestrator depends on this."""

    def write(self, entry: AuditEntry) -> None: ...


class InMemoryAuditLogWriter:
    """Collects entries in a list. Used by tests + replay comparison."""

    def __init__(self) -> None:
        self.entries: list[AuditEntry] = []

    def write(self, entry: AuditEntry) -> None:
        self.entries.append(entry)


class NullAuditLogWriter:
    """Drops entries. Default when no audit sink is wired (keeps orchestrator
    callable without a DB — e.g. the PR3a in-memory path)."""

    def write(self, entry: AuditEntry) -> None:  # noqa: D401
        return None


class SyncAuditLogWriter:
    """Writes audit entries to orchestrator_audit_log via a sync sessionmaker.

    INSERT-only — the table's BEFORE UPDATE OR DELETE trigger guarantees the rows
    are immutable at the DB level regardless of what this writer does.
    """

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    def write(self, entry: AuditEntry) -> None:
        from app.db.models.orchestrator_audit_log import OrchestratorAuditLog

        with self._session_factory() as session:
            session.add(
                OrchestratorAuditLog(
                    session_id=entry.session_id,
                    user_id=entry.user_id,
                    project_id=entry.project_id,
                    event_type=entry.event_type,
                    tool_name=entry.tool_name,
                    tool_version=entry.tool_version,
                    inputs_hash=entry.inputs_hash,
                    outputs_hash=entry.outputs_hash,
                    policy_hash=entry.policy_hash,
                    core_engine_version=entry.core_engine_version,
                    transition_from=entry.transition_from,
                    transition_to=entry.transition_to,
                    transition_source=entry.transition_source,
                    detail=entry.detail,
                )
            )
            session.commit()
