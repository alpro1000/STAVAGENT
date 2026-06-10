"""Authenticated principal for the orchestrator endpoint (PR3b, P0).

The orchestrator session owner MUST come from an authenticated principal, never
from the request body (otherwise the cross-user isolation guard is advisory, not
a security boundary — the PR3a limitation this closes). concrete-agent has no JWT
of its own; the cross-service principal is the Portal-issued user JWT (HS256,
shared `JWT_SECRET`, claims: `userId` / `email` / `name` / `role`). This module
validates that token and resolves it to a `Principal`.

No auto-provisioning (б-zero, live-seal blockers 2026-06-10). The former
`ensure_user_provisioned` / `ensure_project_provisioned` upserts were written
for an ASSUMED own UUID `users`/`projects` schema; the shared production
database is Portal-owned (`users.id` is INTEGER), so they could only 500
(UndefinedColumn / DatatypeMismatch — exactly the first live seal). They
existed solely to satisfy the `orchestrator_sessions` FKs, which migration
012_orchestrator_tables.sql replaced with plain indexed UUIDs (nothing ever
reads the provisioned rows; isolation is the app-level principal-vs-session
compare). This service must never write Portal-owned tables.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md AC9, AC18; Domain Rules.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import Header, HTTPException

from app.core.config import settings


@dataclass(frozen=True)
class Principal:
    """An authenticated caller. `user_id` is the tenant-isolation key."""

    user_id: UUID
    email: Optional[str] = None
    role: Optional[str] = None


class PrincipalAuthError(Exception):
    """Raised when a token cannot be validated into a Principal."""


def decode_principal(token: str, *, secret: Optional[str] = None) -> Principal:
    """Validate a Portal HS256 JWT and return its Principal. Pure (no DB).

    Raises PrincipalAuthError on a missing secret, malformed/expired token, or a
    `userId` claim that is absent or not a UUID. `jwt` is imported lazily so this
    module stays importable where PyJWT isn't installed (e.g. pure unit runs).
    """
    secret = secret if secret is not None else settings.JWT_SECRET
    if not secret:
        raise PrincipalAuthError("JWT auth is not configured (JWT_SECRET unset).")

    try:
        import jwt  # PyJWT
    except ImportError as exc:  # pragma: no cover - dependency guaranteed in prod
        raise PrincipalAuthError(f"PyJWT not available: {exc}") from exc

    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"])
    except Exception as exc:  # jwt.InvalidTokenError + subclasses
        raise PrincipalAuthError(f"Invalid token: {exc}") from exc

    raw_id = claims.get("userId") or claims.get("user_id") or claims.get("sub")
    if not raw_id:
        raise PrincipalAuthError("Token missing userId claim.")
    try:
        user_id = UUID(str(raw_id))
    except (ValueError, AttributeError) as exc:
        raise PrincipalAuthError(f"userId claim is not a UUID: {raw_id}") from exc

    return Principal(
        user_id=user_id,
        email=claims.get("email"),
        role=claims.get("role"),
    )


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer ") :].strip()
    return token or None


async def require_principal(
    authorization: Optional[str] = Header(None),
) -> Principal:
    """FastAPI dependency: resolve the authenticated Principal or 401.

    The session owner is bound to THIS value, never to a body field — that is
    what makes the isolation guard a real HTTP boundary.
    """
    token = _extract_bearer(authorization)
    if token is None:
        raise HTTPException(
            status_code=401,
            detail="Authorization: Bearer <jwt> required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return decode_principal(token)
    except PrincipalAuthError as exc:
        raise HTTPException(
            status_code=401,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )


# NOTE: ensure_user_provisioned / ensure_project_provisioned were REMOVED here
# (б-zero) — see the module docstring. Do not reintroduce writes to the
# Portal-owned users/projects tables from this service.
