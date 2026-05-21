"""
Integration tests for the DCR + OAuth flow (Gate 7).

Each test exercises multiple gates in sequence — register → authorize →
token → /mcp/ — through a stateful in-memory mock that ties the calls
together. The mock implements only the DB operations that the route
handlers actually invoke; no Postgres / Redis is touched.

Reference: TASK_DCR_KBYamlLoader.md Gate 7.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.mcp import auth as mcp_auth
from app.mcp import oauth_codes as mcp_oauth_codes
from app.mcp import rate_limit as mcp_rate_limit
from app.mcp.middleware import MCPAuthChallengeMiddleware
from app.mcp.routes import router


# ───────────────────────────────────────────────────────────────────────────
# Stateful mock DB — minimum surface to exercise the full DCR flow.
# Each helper in auth.py + oauth_codes.py that the route handlers call is
# replaced via monkeypatch with a method on this class. All state lives
# in dicts so a single test can step through register → authorize → token
# → bearer use with the same identifiers tying calls together.
# ───────────────────────────────────────────────────────────────────────────


class MockDB:
    def __init__(self):
        # mcp_api_keys: api_key → {id, is_active, credits, user_email}
        self.api_keys: dict[str, dict[str, Any]] = {}
        # mcp_oauth_clients: client_id → row
        self.clients: dict[str, dict[str, Any]] = {}
        # mcp_oauth_registration_log: ordered list of audit rows
        self.audit_log: list[dict[str, Any]] = []
        # mcp_oauth_codes: code → row
        self.codes: dict[str, dict[str, Any]] = {}
        # mcp_oauth_tokens: access_token → row (refresh_token also indexed in
        # `self.tokens_by_refresh` for replay-detection lookups)
        self.tokens: dict[str, dict[str, Any]] = {}
        self.tokens_by_refresh: dict[str, dict[str, Any]] = {}
        self._token_id_seq = 0
        self._client_id_seq = 0
        self._fixed_now: Optional[datetime] = None

    # ── time control ────────────────────────────────────────────────────────

    def now(self) -> datetime:
        return self._fixed_now or datetime.now(timezone.utc)

    def freeze_at(self, when: datetime) -> None:
        self._fixed_now = when

    def advance(self, seconds: int) -> None:
        base = self._fixed_now or datetime.now(timezone.utc)
        self._fixed_now = base + timedelta(seconds=seconds)

    # ── api_keys helpers (test setup) ───────────────────────────────────────

    def add_user(self, api_key: str, *, user_id: int = None,
                 is_active: bool = True, credits: int = 100,
                 email: str = "u@x.com") -> int:
        if user_id is None:
            user_id = len(self.api_keys) + 1
        self.api_keys[api_key] = {
            "id": user_id,
            "api_key": api_key,
            "is_active": is_active,
            "credits": credits,
            "user_email": email,
            "total_credits_used": 0,
        }
        return user_id

    # ── mcp_auth.register_oauth_client ──────────────────────────────────────

    def register_oauth_client(self, **kw) -> dict:
        self._client_id_seq += 1
        client_id = f"dcr-{self._client_id_seq:024x}"[-28:]
        client_secret = f"dcs-{self._client_id_seq:048x}"[-52:]
        # client_secret_hash via the real helper so verify works downstream
        salt = mcp_auth.generate_salt()
        secret_hash = mcp_auth.hash_client_secret(client_secret, salt)
        issued_at = int(self.now().timestamp())
        self.clients[client_id] = {
            "id": self._client_id_seq,
            "client_id": client_id,
            "client_secret_hash": secret_hash,
            "client_secret_salt": salt,
            "client_name": kw["client_name"],
            "redirect_uris": list(kw["redirect_uris"]),
            "grant_types": list(kw["grant_types"]),
            "scope": kw.get("scope"),
            "software_id": kw.get("software_id"),
            "software_version": kw.get("software_version"),
            "created_by_user_id": kw.get("created_by_user_id"),
            "is_active": True,
            "registered_at": self.now(),
        }
        # Success audit row written inside the same logical "transaction"
        self.audit_log.append({
            "oauth_client_id_fk": self._client_id_seq,
            "client_name": kw["client_name"],
            "status": "success",
            "error_code": None,
            "error_description": None,
            "request_payload_hash": kw.get("request_payload_hash"),
            "registered_ip": kw.get("registered_ip"),
            "registered_user_agent": kw.get("registered_user_agent"),
            "created_at": self.now(),
        })
        return {
            "client_id": client_id,
            "client_secret": client_secret,
            "issued_at_unix": issued_at,
        }

    def log_oauth_registration_failure(self, **kw) -> None:
        self.audit_log.append({
            "oauth_client_id_fk": None,
            "client_name": kw.get("client_name"),
            "status": kw["status"],
            "error_code": kw.get("error_code"),
            "error_description": kw.get("error_description"),
            "request_payload_hash": kw.get("request_payload_hash"),
            "registered_ip": kw.get("registered_ip"),
            "registered_user_agent": kw.get("registered_user_agent"),
            "created_at": self.now(),
        })

    def _resolve_initial_access_user_id(self, api_key: str) -> Optional[int]:
        row = self.api_keys.get(api_key)
        return row["id"] if row and row["is_active"] else None

    # ── mcp_auth.lookup_oauth_client_for_authorize ──────────────────────────

    def lookup_oauth_client_for_authorize(self, client_id: str) -> Optional[dict]:
        if not client_id or not client_id.startswith("dcr-"):
            return None
        row = self.clients.get(client_id)
        if not row or not row["is_active"]:
            return None
        return dict(row)

    # ── mcp_auth.validate_oauth_client_credentials ──────────────────────────

    def validate_oauth_client_credentials(self, client_id: str,
                                          client_secret: str) -> Optional[dict]:
        row = self.clients.get(client_id)
        if not row or not row["is_active"]:
            return None
        if not mcp_auth.verify_client_secret(
            client_secret, row["client_secret_hash"], row["client_secret_salt"]
        ):
            return None
        return dict(row)

    # ── mcp_auth.resolve_user_api_key_for_client ────────────────────────────

    def resolve_user_api_key_for_client(self, client_id: str) -> Optional[str]:
        client = self.clients.get(client_id)
        if not client or not client["is_active"] or client["created_by_user_id"] is None:
            return None
        for ak, row in self.api_keys.items():
            if row["id"] == client["created_by_user_id"] and row["is_active"]:
                return ak
        return None

    # ── mcp_oauth_codes.generate_code / consume_code ────────────────────────

    def generate_code(self, *, client_id: str, redirect_uri: str,
                       code_challenge: str, state: Optional[str] = None,
                       ttl_seconds: int = 600,
                       code_challenge_method: str = "S256",
                       oauth_client_id: Optional[str] = None) -> str:
        code = f"code-{len(self.codes):08d}"
        self.codes[code] = {
            "code": code,
            "client_id": client_id,   # user api_key
            "redirect_uri": redirect_uri,
            "code_challenge": code_challenge,
            "code_challenge_method": code_challenge_method,
            "state": state,
            "created_at": self.now(),
            "expires_at": self.now() + timedelta(seconds=ttl_seconds),
            "used_at": None,
            "oauth_client_id": oauth_client_id,
        }
        return code

    def consume_code(self, *, code: str, code_verifier: str,
                     redirect_uri: str) -> dict:
        row = self.codes.get(code)
        if not row:
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "Authorization code not found"}
        if row["expires_at"] <= self.now():
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "Authorization code expired"}
        if row["redirect_uri"] != redirect_uri:
            return {"ok": False, "error": "invalid_request",
                    "error_description": "redirect_uri mismatch"}
        # PKCE check
        from app.mcp.oauth_codes import _pkce_s256
        if _pkce_s256(code_verifier) != row["code_challenge"]:
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "code_verifier mismatch"}
        if row["used_at"] is not None:
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "Authorization code already used"}
        row["used_at"] = self.now()
        return {"ok": True, "client_id": row["client_id"],
                "oauth_client_id": row["oauth_client_id"]}

    # ── mcp_auth.mint_token_pair / rotate_refresh_token / ... ───────────────

    def mint_token_pair(self, *, oauth_client_id: str,
                        user_api_key: Optional[str],
                        grant_type: str, scope: Optional[str],
                        with_refresh: bool,
                        rotated_from_id: Optional[int] = None) -> dict:
        self._token_id_seq += 1
        access = mcp_auth.generate_access_token()
        refresh = mcp_auth.generate_refresh_token() if with_refresh else None
        row = {
            "id": self._token_id_seq,
            "access_token": access,
            "refresh_token": refresh,
            "oauth_client_id": oauth_client_id,
            "user_api_key": user_api_key,
            "grant_type": grant_type,
            "scope": scope,
            "issued_at": self.now(),
            "access_expires_at": self.now() + timedelta(
                seconds=mcp_auth.ACCESS_TOKEN_TTL_SECONDS),
            "refresh_expires_at": (
                self.now() + timedelta(seconds=mcp_auth.REFRESH_TOKEN_TTL_SECONDS)
                if refresh else None
            ),
            "revoked_at": None,
            "rotated_from": rotated_from_id,
            "last_used_at": None,
        }
        self.tokens[access] = row
        if refresh:
            self.tokens_by_refresh[refresh] = row
        out = {
            "access_token": access,
            "token_type": "bearer",
            "expires_in": mcp_auth.ACCESS_TOKEN_TTL_SECONDS,
            "scope": scope or "",
            "_token_row_id": row["id"],
        }
        if refresh:
            out["refresh_token"] = refresh
        return out

    def rotate_refresh_token(self, *, presented_refresh: str,
                              client_id: str, scope: Optional[str]) -> dict:
        old = self.tokens_by_refresh.get(presented_refresh)
        if not old:
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "refresh_token not found"}
        if old["oauth_client_id"] != client_id:
            return {"ok": False, "error": "invalid_grant",
                    "error_description":
                        "refresh_token does not belong to this client"}
        if old["refresh_expires_at"] is None or old["refresh_expires_at"] <= self.now():
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "refresh_token expired"}
        if old["revoked_at"] is not None:
            # REPLAY — revoke entire chain
            self._revoke_chain(old["id"])
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "refresh_token has been revoked"}
        # Happy: revoke old + mint new bound to (oauth_client_id, user_api_key)
        old["revoked_at"] = self.now()
        new = self.mint_token_pair(
            oauth_client_id=client_id,
            user_api_key=old["user_api_key"],
            grant_type="refresh_token",
            scope=scope or old["scope"],
            with_refresh=True,
            rotated_from_id=old["id"],
        )
        return {"ok": True, **new}

    def _revoke_chain(self, token_row_id: int) -> int:
        revoked = 0
        ids_to_check = {token_row_id}
        while ids_to_check:
            tid = ids_to_check.pop()
            for row in list(self.tokens.values()) + list(self.tokens_by_refresh.values()):
                if row["id"] == tid and row["revoked_at"] is None:
                    row["revoked_at"] = self.now()
                    revoked += 1
                if row.get("rotated_from") == tid:
                    ids_to_check.add(row["id"])
        return revoked

    def resolve_bearer_token(self, token: str) -> dict:
        if not token:
            return {"status": "malformed", "user_api_key": None,
                    "oauth_client_id": None, "grant_type": None,
                    "scope": None, "token_row_id": None,
                    "error_description": "empty bearer"}
        if token.startswith("sat-"):
            row = self.tokens.get(token)
            if not row:
                return {"status": "unknown", "user_api_key": None,
                        "oauth_client_id": None, "grant_type": None,
                        "scope": None, "token_row_id": None,
                        "error_description": "Access token not found"}
            if row["revoked_at"] is not None:
                return {"status": "revoked", "user_api_key": None,
                        "oauth_client_id": row["oauth_client_id"],
                        "grant_type": None, "scope": None,
                        "token_row_id": row["id"],
                        "error_description": "Access token has been revoked"}
            if row["access_expires_at"] <= self.now():
                return {"status": "expired", "user_api_key": None,
                        "oauth_client_id": row["oauth_client_id"],
                        "grant_type": None, "scope": None,
                        "token_row_id": row["id"],
                        "error_description":
                            "Access token expired. Use grant_type=refresh_token "
                            "to obtain a new pair."}
            return {"status": "ok", "user_api_key": row["user_api_key"],
                    "oauth_client_id": row["oauth_client_id"],
                    "grant_type": row["grant_type"], "scope": row["scope"],
                    "token_row_id": row["id"], "error_description": ""}
        if token.startswith("sk-stavagent-"):
            row = self.api_keys.get(token)
            if not row:
                return {"status": "unknown", "user_api_key": None,
                        "oauth_client_id": None, "grant_type": None,
                        "scope": None, "token_row_id": None,
                        "error_description": "API key not found"}
            if not row["is_active"]:
                return {"status": "revoked", "user_api_key": None,
                        "oauth_client_id": "legacy", "grant_type": None,
                        "scope": None, "token_row_id": None,
                        "error_description": "API key deactivated"}
            return {"status": "ok", "user_api_key": token,
                    "oauth_client_id": "legacy", "grant_type": "legacy_bearer",
                    "scope": "*", "token_row_id": None,
                    "error_description": ""}
        return {"status": "malformed", "user_api_key": None,
                "oauth_client_id": None, "grant_type": None,
                "scope": None, "token_row_id": None,
                "error_description": "Bearer prefix not recognized"}

    def update_token_last_used(self, token_row_id: int) -> None:
        for row in self.tokens.values():
            if row["id"] == token_row_id:
                row["last_used_at"] = self.now()
                return

    # ── credit attribution ──────────────────────────────────────────────────

    def check_credits(self, api_key, tool_name: str) -> dict:
        cost = mcp_auth.TOOL_COSTS.get(tool_name, 0)
        if cost == 0:
            return {"ok": True, "cost": 0, "credits_remaining": None}
        if api_key is None:
            return {"ok": False, "cost": cost, "http_status": 402,
                    "error_code": "user_consent_required",
                    "error": "Authorization_code flow required"}
        if not api_key:
            return {"ok": False, "cost": cost,
                    "error": "API key required"}
        row = self.api_keys.get(api_key)
        if not row or not row["is_active"]:
            return {"ok": False, "cost": cost, "error": "invalid key"}
        if row["credits"] < cost:
            return {"ok": False, "cost": cost,
                    "credits_remaining": row["credits"],
                    "error": "insufficient credits"}
        row["credits"] -= cost
        row["total_credits_used"] += cost
        return {"ok": True, "cost": cost,
                "credits_remaining": row["credits"]}

    # Legacy oauth_token (sk-stavagent- client_credentials path)
    def oauth_token(self, client_id: str, client_secret: str) -> dict:
        api_key = client_id or client_secret
        if not api_key:
            return {"error": "invalid_client",
                    "error_description": "client_id required"}
        row = self.api_keys.get(api_key)
        if not row or not row["is_active"]:
            return {"error": "invalid_client",
                    "error_description": "Invalid API key"}
        return {"access_token": api_key, "token_type": "bearer",
                "expires_in": 86400}


# ── Fixture: wires the mock DB into all helper module attributes ────────────


@pytest.fixture
def integration(monkeypatch):
    """Stateful fixture for end-to-end DCR scenarios.

    Returns a `(client, db)` pair. `client` is a TestClient that
    routes through the real DCR endpoint + middleware; `db` is the
    MockDB so tests can preload api_keys / inspect audit_log /
    advance time / etc.
    """
    db = MockDB()

    # auth.py patches
    monkeypatch.setattr(mcp_auth, "register_oauth_client", db.register_oauth_client)
    monkeypatch.setattr(mcp_auth, "log_oauth_registration_failure",
                         db.log_oauth_registration_failure)
    monkeypatch.setattr(mcp_auth, "_resolve_initial_access_user_id",
                         db._resolve_initial_access_user_id)
    monkeypatch.setattr(mcp_auth, "lookup_oauth_client_for_authorize",
                         db.lookup_oauth_client_for_authorize)
    monkeypatch.setattr(mcp_auth, "validate_oauth_client_credentials",
                         db.validate_oauth_client_credentials)
    monkeypatch.setattr(mcp_auth, "resolve_user_api_key_for_client",
                         db.resolve_user_api_key_for_client)
    monkeypatch.setattr(mcp_auth, "mint_token_pair", db.mint_token_pair)
    monkeypatch.setattr(mcp_auth, "rotate_refresh_token", db.rotate_refresh_token)
    monkeypatch.setattr(mcp_auth, "resolve_bearer_token", db.resolve_bearer_token)
    monkeypatch.setattr(mcp_auth, "update_token_last_used", db.update_token_last_used)
    monkeypatch.setattr(mcp_auth, "check_credits", db.check_credits)
    monkeypatch.setattr(mcp_auth, "oauth_token", db.oauth_token)
    monkeypatch.setattr(mcp_auth, "get_credits", lambda ak: (
        {"email": db.api_keys[ak]["user_email"],
         "credits": db.api_keys[ak]["credits"],
         "total_used": db.api_keys[ak]["total_credits_used"],
         "total_purchased": 0}
        if ak in db.api_keys and db.api_keys[ak]["is_active"]
        else {"error": "Invalid API key.", "credits": 0}
    ))

    # oauth_codes patches
    monkeypatch.setattr(mcp_oauth_codes, "generate_code", db.generate_code)
    monkeypatch.setattr(mcp_oauth_codes, "consume_code", db.consume_code)
    monkeypatch.setattr(mcp_oauth_codes, "is_allowed_redirect_uri", lambda u: True)

    # Rate limit: always allowed in integration
    async def fake_rl(_ip):
        return {"status": mcp_rate_limit.RateLimitResult.ALLOWED,
                "current": 1, "limit": 10, "retry_after": 3600}
    monkeypatch.setattr(mcp_rate_limit, "check_register_rate_limit", fake_rl)

    # Build app with middleware so /mcp/ bearer flow is exercised end-to-end
    app = FastAPI()
    app.include_router(router)

    # Mount /mcp with the real middleware over a spy inner that records
    # AuthContext and TOOL_COSTS-checks.
    class SpyTool:
        def __init__(self):
            self.calls = []

        async def __call__(self, scope, receive, send):
            self.calls.append({
                "method": scope["method"],
                "path": scope["path"],
                "auth": scope.get("state", {}).get("mcp_auth"),
            })
            from starlette.responses import JSONResponse
            # Simulate a paid tool call: read tool_name from JSON body
            body = b""
            more = True
            while more:
                msg = await receive()
                body += msg.get("body", b"")
                more = msg.get("more_body", False)
            tool_name = "find_urs_code"  # default = paid 3 credits
            if body:
                try:
                    parsed = json.loads(body)
                    tool_name = parsed.get("tool", tool_name)
                except Exception:
                    pass
            auth_ctx = scope.get("state", {}).get("mcp_auth") or {}
            user_api_key = auth_ctx.get("user_api_key")
            credit_check = db.check_credits(user_api_key, tool_name)
            if credit_check.get("http_status") == 402:
                resp = JSONResponse(credit_check, status_code=402)
            elif not credit_check["ok"]:
                resp = JSONResponse(credit_check, status_code=403)
            else:
                resp = JSONResponse(
                    {"ok": True, "tool": tool_name,
                     "credits_remaining": credit_check["credits_remaining"],
                     "user_api_key": user_api_key},
                    status_code=200,
                )
            await resp(scope, receive, send)

    spy = SpyTool()
    mcp_inner = MCPAuthChallengeMiddleware(spy)
    mcp_with_cors = CORSMiddleware(
        app=mcp_inner,
        allow_origins=["https://claude.ai", "https://chatgpt.com",
                       "https://chat.openai.com"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Mcp-Session-Id"],
        expose_headers=["WWW-Authenticate"],
        max_age=86400,
    )
    app.mount("/mcp", mcp_with_cors)

    tc = TestClient(app)
    return tc, db, spy


# ───────────────────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────────────────


def _pkce_pair():
    import base64, hashlib, secrets
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    return verifier, challenge


# ───────────────────────────────────────────────────────────────────────────
# 1. Full end-to-end DCR authorization_code dance
# ───────────────────────────────────────────────────────────────────────────


def test_full_e2e_dcr_authorization_code_flow(integration):
    client, db, spy = integration
    user_api_key = "sk-stavagent-" + "u" * 48
    db.add_user(user_api_key, credits=100)
    redirect_uri = "https://claude.ai/api/mcp/auth_callback"

    # Step 1: POST /register → dcr-id + dcs-secret
    r1 = client.post("/api/v1/mcp/oauth/register", json={
        "redirect_uris": [redirect_uri],
        "client_name": "Claude.ai MCP",
        "grant_types": ["authorization_code", "client_credentials"],
    })
    assert r1.status_code == 201, r1.text
    cred = r1.json()
    client_id, client_secret = cred["client_id"], cred["client_secret"]

    # Step 2: GET /authorize → HTML consent form
    verifier, challenge = _pkce_pair()
    r2 = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": "csrf-state",
        "scope": "mcp",
    })
    assert r2.status_code == 200
    assert "Claude.ai MCP" in r2.text  # consent form rendered

    # Step 3: POST /authorize with api_key → 303 + code
    r3 = client.post("/api/v1/mcp/oauth/authorize", data={
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": "csrf-state",
        "scope": "mcp",
        "api_key": user_api_key,
    }, follow_redirects=False)
    assert r3.status_code == 303
    from urllib.parse import urlparse, parse_qs
    loc = urlparse(r3.headers["location"])
    assert loc.netloc == "claude.ai"
    qs = parse_qs(loc.query)
    code = qs["code"][0]
    assert qs["state"][0] == "csrf-state"

    # Step 4: POST /token grant_type=authorization_code → sat-/srt- pair
    r4 = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": code,
        "code_verifier": verifier,
        "redirect_uri": redirect_uri,
    })
    assert r4.status_code == 200, r4.text
    tok = r4.json()
    access_token = tok["access_token"]
    refresh_token = tok["refresh_token"]
    assert access_token.startswith("sat-")
    assert refresh_token.startswith("srt-")
    assert tok["expires_in"] == 3600

    # Step 5: Bearer sat- on /mcp/ → 200, credits debited from USER
    starting_credits = db.api_keys[user_api_key]["credits"]
    r5 = client.post("/mcp/",
                      headers={"authorization": f"Bearer {access_token}",
                               "origin": "https://claude.ai"},
                      json={"tool": "find_urs_code"})
    assert r5.status_code == 200
    body = r5.json()
    assert body["ok"] is True
    assert body["user_api_key"] == user_api_key
    # find_urs_code costs 3 credits — user got debited, not the client
    assert db.api_keys[user_api_key]["credits"] == starting_credits - 3

    # AuthContext was attached for the tool call
    assert spy.calls[-1]["auth"]["user_api_key"] == user_api_key
    assert spy.calls[-1]["auth"]["oauth_client_id"] == client_id


# ───────────────────────────────────────────────────────────────────────────
# 2. Refresh-token chain + replay revokes descendants (BCP §4.14.4)
# ───────────────────────────────────────────────────────────────────────────


def test_refresh_chain_replay_revokes_entire_descendants(integration):
    client, db, _ = integration
    user_api_key = "sk-stavagent-" + "u" * 48
    db.add_user(user_api_key)
    redirect_uri = "https://claude.ai/api/mcp/auth_callback"

    # Register + authorize + token (initial sat-1 + srt-1)
    cred = client.post("/api/v1/mcp/oauth/register", json={
        "redirect_uris": [redirect_uri], "client_name": "X",
        "grant_types": ["authorization_code"],
    }).json()
    verifier, challenge = _pkce_pair()
    client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code", "client_id": cred["client_id"],
        "redirect_uri": redirect_uri, "code_challenge": challenge,
        "code_challenge_method": "S256", "state": "s",
    })
    r3 = client.post("/api/v1/mcp/oauth/authorize", data={
        "response_type": "code", "client_id": cred["client_id"],
        "redirect_uri": redirect_uri, "code_challenge": challenge,
        "code_challenge_method": "S256", "state": "s",
        "api_key": user_api_key,
    }, follow_redirects=False)
    from urllib.parse import urlparse, parse_qs
    code = parse_qs(urlparse(r3.headers["location"]).query)["code"][0]
    tok1 = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code", "code": code,
        "code_verifier": verifier, "redirect_uri": redirect_uri,
    }).json()
    refresh1 = tok1["refresh_token"]

    # Rotate refresh1 → get sat-2 + srt-2 (refresh1 now revoked)
    tok2 = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": cred["client_id"], "client_secret": cred["client_secret"],
        "refresh_token": refresh1,
    }).json()
    assert tok2["access_token"] != tok1["access_token"]
    refresh2 = tok2["refresh_token"]

    # Both new tokens valid right now
    r_pre_replay = client.post("/mcp/",
        headers={"authorization": f"Bearer {tok2['access_token']}"},
        json={"tool": "find_otskp_code"})
    assert r_pre_replay.status_code == 200

    # REPLAY refresh1 (already revoked) → rotation refuses + revokes chain
    r_replay = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": cred["client_id"], "client_secret": cred["client_secret"],
        "refresh_token": refresh1,
    })
    assert r_replay.status_code == 400
    assert "revoked" in r_replay.json()["detail"]["error_description"].lower()

    # sat-2 must now also be revoked (descendant of refresh1)
    r_after_replay = client.post("/mcp/",
        headers={"authorization": f"Bearer {tok2['access_token']}"},
        json={"tool": "find_otskp_code"})
    assert r_after_replay.status_code == 401
    assert "revoked" in r_after_replay.json()["error_description"].lower()

    # refresh2 also unusable
    r_refresh2 = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": cred["client_id"], "client_secret": cred["client_secret"],
        "refresh_token": refresh2,
    })
    assert r_refresh2.status_code == 400


# ───────────────────────────────────────────────────────────────────────────
# 3. Authorization-code single use
# ───────────────────────────────────────────────────────────────────────────


def test_authorization_code_single_use(integration):
    client, db, _ = integration
    user_api_key = "sk-stavagent-" + "u" * 48
    db.add_user(user_api_key)
    redirect_uri = "https://claude.ai/api/mcp/auth_callback"
    cred = client.post("/api/v1/mcp/oauth/register", json={
        "redirect_uris": [redirect_uri], "client_name": "X",
    }).json()
    verifier, challenge = _pkce_pair()
    r3 = client.post("/api/v1/mcp/oauth/authorize", data={
        "response_type": "code", "client_id": cred["client_id"],
        "redirect_uri": redirect_uri, "code_challenge": challenge,
        "code_challenge_method": "S256", "state": "s",
        "api_key": user_api_key,
    }, follow_redirects=False)
    from urllib.parse import urlparse, parse_qs
    code = parse_qs(urlparse(r3.headers["location"]).query)["code"][0]

    # First exchange succeeds
    r_first = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code", "code": code,
        "code_verifier": verifier, "redirect_uri": redirect_uri,
    })
    assert r_first.status_code == 200

    # Second exchange of the SAME code fails with invalid_grant
    r_second = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code", "code": code,
        "code_verifier": verifier, "redirect_uri": redirect_uri,
    })
    assert r_second.status_code == 400
    assert r_second.json()["detail"]["error"] == "invalid_grant"
    assert "already used" in r_second.json()["detail"]["error_description"]


# ───────────────────────────────────────────────────────────────────────────
# 4. Access-token expiry → refresh works
# ───────────────────────────────────────────────────────────────────────────


def test_access_token_expiry_then_refresh(integration):
    client, db, _ = integration
    user_api_key = "sk-stavagent-" + "u" * 48
    db.add_user(user_api_key)
    redirect_uri = "https://claude.ai/api/mcp/auth_callback"
    db.freeze_at(datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc))
    cred = client.post("/api/v1/mcp/oauth/register", json={
        "redirect_uris": [redirect_uri], "client_name": "X",
    }).json()
    verifier, challenge = _pkce_pair()
    r3 = client.post("/api/v1/mcp/oauth/authorize", data={
        "response_type": "code", "client_id": cred["client_id"],
        "redirect_uri": redirect_uri, "code_challenge": challenge,
        "code_challenge_method": "S256", "state": "s",
        "api_key": user_api_key,
    }, follow_redirects=False)
    from urllib.parse import urlparse, parse_qs
    code = parse_qs(urlparse(r3.headers["location"]).query)["code"][0]
    tok = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code", "code": code,
        "code_verifier": verifier, "redirect_uri": redirect_uri,
    }).json()

    # Fast-forward past access_expires_at (3601s = +1s)
    db.advance(3601)

    # Old access_token must now 401 with refresh hint in body
    r_expired = client.post("/mcp/",
        headers={"authorization": f"Bearer {tok['access_token']}"},
        json={"tool": "find_otskp_code"})
    assert r_expired.status_code == 401
    body = r_expired.json()
    assert "refresh_token" in body["error_description"].lower()

    # Refresh succeeds — refresh_expires_at is 90d so still in window
    tok2 = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": cred["client_id"],
        "client_secret": cred["client_secret"],
        "refresh_token": tok["refresh_token"],
    }).json()
    assert tok2["access_token"].startswith("sat-")
    assert tok2["access_token"] != tok["access_token"]

    # New access_token works
    r_new = client.post("/mcp/",
        headers={"authorization": f"Bearer {tok2['access_token']}"},
        json={"tool": "find_otskp_code"})
    assert r_new.status_code == 200


# ───────────────────────────────────────────────────────────────────────────
# 5. Legacy regression — sk-stavagent-* unchanged
# ───────────────────────────────────────────────────────────────────────────


def test_legacy_sk_stavagent_client_credentials_unchanged(integration):
    """Critical backward-compat: legacy ChatGPT custom GPT flow must
    NOT write to mcp_oauth_tokens / mcp_oauth_clients."""
    client, db, _ = integration
    user_api_key = "sk-stavagent-" + "L" * 48
    db.add_user(user_api_key, credits=50)

    # Legacy /token client_credentials
    r = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": user_api_key,
        "client_secret": user_api_key,
    })
    assert r.status_code == 200
    tok = r.json()
    # Legacy returns the api_key VERBATIM as access_token — no sat-* mint
    assert tok["access_token"] == user_api_key
    assert "refresh_token" not in tok
    # No DCR client row created, no mcp_oauth_tokens row, no audit log line
    assert db.clients == {}
    assert db.tokens == {}
    assert all(a["status"] != "success" for a in db.audit_log)

    # Bearer sk-stavagent- on /mcp/ → 200 legacy path
    starting_credits = db.api_keys[user_api_key]["credits"]
    r_mcp = client.post("/mcp/",
        headers={"authorization": f"Bearer {user_api_key}"},
        json={"tool": "find_urs_code"})
    assert r_mcp.status_code == 200
    assert r_mcp.json()["user_api_key"] == user_api_key
    assert db.api_keys[user_api_key]["credits"] == starting_credits - 3


def test_legacy_authorize_get_unchanged(integration):
    """GET /authorize?client_id=sk-stavagent-... → 302 redirect (legacy),
    NOT HTML form."""
    client, db, _ = integration
    user_api_key = "sk-stavagent-" + "L" * 48
    db.add_user(user_api_key)

    r = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code", "client_id": user_api_key,
        "redirect_uri": "https://claude.ai/api/mcp/auth_callback",
        "code_challenge": "challenge", "code_challenge_method": "S256",
        "state": "s",
    }, follow_redirects=False)
    assert r.status_code == 302
    assert "claude.ai" in r.headers["location"]
    # NO DCR client created
    assert db.clients == {}


# ───────────────────────────────────────────────────────────────────────────
# 6. Cross-grant credit attribution
# ───────────────────────────────────────────────────────────────────────────


def test_credit_attribution_authcode_to_consenting_user(integration):
    """User_A grants consent → tokens issued attribute to user_A."""
    client, db, _ = integration
    user_a = "sk-stavagent-" + "A" * 48
    user_b = "sk-stavagent-" + "B" * 48
    db.add_user(user_a, credits=100)
    db.add_user(user_b, credits=100)
    redirect_uri = "https://claude.ai/api/mcp/auth_callback"

    cred = client.post("/api/v1/mcp/oauth/register", json={
        "redirect_uris": [redirect_uri], "client_name": "X",
    }).json()
    verifier, challenge = _pkce_pair()
    r3 = client.post("/api/v1/mcp/oauth/authorize", data={
        "response_type": "code", "client_id": cred["client_id"],
        "redirect_uri": redirect_uri, "code_challenge": challenge,
        "code_challenge_method": "S256", "state": "s",
        "api_key": user_a,
    }, follow_redirects=False)
    from urllib.parse import urlparse, parse_qs
    code = parse_qs(urlparse(r3.headers["location"]).query)["code"][0]
    tok = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code", "code": code,
        "code_verifier": verifier, "redirect_uri": redirect_uri,
    }).json()

    client.post("/mcp/",
        headers={"authorization": f"Bearer {tok['access_token']}"},
        json={"tool": "find_urs_code"})

    # user_a debited, user_b untouched
    assert db.api_keys[user_a]["credits"] == 97
    assert db.api_keys[user_b]["credits"] == 100


def test_credit_attribution_authenticated_dcr_client_credentials(integration):
    """Authenticated DCR (Bearer sk-stavagent- on /register) →
    client_credentials grant attributes to that user."""
    client, db, _ = integration
    user_b = "sk-stavagent-" + "B" * 48
    db.add_user(user_b, credits=100, user_id=42)

    cred = client.post("/api/v1/mcp/oauth/register",
        headers={"authorization": f"Bearer {user_b}"},
        json={"redirect_uris": ["https://example.com/cb"],
              "client_name": "X",
              "grant_types": ["client_credentials"]},
    ).json()

    tok = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": cred["client_id"],
        "client_secret": cred["client_secret"],
    }).json()

    r = client.post("/mcp/",
        headers={"authorization": f"Bearer {tok['access_token']}"},
        json={"tool": "find_urs_code"})
    assert r.status_code == 200
    assert db.api_keys[user_b]["credits"] == 97


def test_credit_attribution_public_dcr_402_on_paid_200_on_free(integration):
    """Public DCR (no Authorization on /register) → user_api_key=NULL →
    paid tool 402, free tool 200."""
    client, db, _ = integration

    cred = client.post("/api/v1/mcp/oauth/register", json={
        "redirect_uris": ["https://example.com/cb"],
        "client_name": "Public",
        "grant_types": ["client_credentials"],
    }).json()
    tok = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": cred["client_id"],
        "client_secret": cred["client_secret"],
    }).json()

    r_paid = client.post("/mcp/",
        headers={"authorization": f"Bearer {tok['access_token']}"},
        json={"tool": "find_urs_code"})
    assert r_paid.status_code == 402
    assert r_paid.json()["error_code"] == "user_consent_required"

    r_free = client.post("/mcp/",
        headers={"authorization": f"Bearer {tok['access_token']}"},
        json={"tool": "find_otskp_code"})
    assert r_free.status_code == 200


# ───────────────────────────────────────────────────────────────────────────
# 7. CORS browser simulation
# ───────────────────────────────────────────────────────────────────────────


def test_cors_preflight_from_claude_ai_through_mount(integration):
    client, _, _ = integration
    r = client.options("/mcp/", headers={
        "origin": "https://claude.ai",
        "access-control-request-method": "POST",
        "access-control-request-headers": "Authorization, Content-Type",
    })
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "https://claude.ai"
    assert "POST" in r.headers["access-control-allow-methods"]
    assert r.headers["access-control-max-age"] == "86400"


def test_cors_401_response_still_has_acao(integration):
    """Even error responses must carry ACAO so the browser surfaces
    them to the JavaScript fetch() promise."""
    client, _, _ = integration
    r = client.post("/mcp/",
        headers={"origin": "https://claude.ai",
                 "authorization": "Bearer sat-unknown" + "x" * 38},
        json={"tool": "find_otskp_code"})
    assert r.status_code == 401
    assert r.headers["access-control-allow-origin"] == "https://claude.ai"


def test_cors_preflight_from_evil_origin_blocked(integration):
    client, _, _ = integration
    r = client.options("/mcp/", headers={
        "origin": "https://evil.example.com",
        "access-control-request-method": "POST",
    })
    headers_lower = {k.lower() for k in r.headers.keys()}
    assert "access-control-allow-origin" not in headers_lower


def test_cors_actual_request_from_evil_origin_body_returned_no_acao(integration):
    """Body still returned (server can't suppress it) but NO ACAO → browser
    blocks the JS reading the body."""
    client, db, _ = integration
    user_api_key = "sk-stavagent-" + "L" * 48
    db.add_user(user_api_key)
    r = client.post("/mcp/",
        headers={"origin": "https://evil.example.com",
                 "authorization": f"Bearer {user_api_key}"},
        json={"tool": "find_otskp_code"})
    assert r.status_code == 200
    headers_lower = {k.lower() for k in r.headers.keys()}
    assert "access-control-allow-origin" not in headers_lower


# ───────────────────────────────────────────────────────────────────────────
# 8. Audit chain consistency
# ───────────────────────────────────────────────────────────────────────────


def test_audit_chain_4_outcomes(integration):
    client, db, _ = integration

    # 1. Success
    r1 = client.post("/api/v1/mcp/oauth/register",
                     headers={"x-forwarded-for": "1.1.1.1",
                              "user-agent": "claude.ai/1.0"},
                     json={"redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
                           "client_name": "A"})
    assert r1.status_code == 201

    # 2. invalid_redirect_uri
    r2 = client.post("/api/v1/mcp/oauth/register",
                     headers={"x-forwarded-for": "2.2.2.2",
                              "user-agent": "bot/1.0"},
                     json={"redirect_uris": ["http://attacker.com/cb"],
                           "client_name": "B"})
    assert r2.status_code == 400
    assert r2.json()["detail"]["error"] == "invalid_redirect_uri"

    # 3. invalid_client_metadata (bad grant_types)
    r3 = client.post("/api/v1/mcp/oauth/register",
                     headers={"x-forwarded-for": "3.3.3.3",
                              "user-agent": "test/1.0"},
                     json={"redirect_uris": ["https://example.com/cb"],
                           "client_name": "C",
                           "grant_types": ["implicit"]})
    assert r3.status_code == 400
    assert r3.json()["detail"]["error"] == "invalid_client_metadata"

    # 4. invalid_token (bad Authorization)
    r4 = client.post("/api/v1/mcp/oauth/register",
                     headers={"x-forwarded-for": "4.4.4.4",
                              "user-agent": "rogue/1.0",
                              "authorization": "Bearer bad-prefix"},
                     json={"redirect_uris": ["https://example.com/cb"],
                           "client_name": "D"})
    assert r4.status_code == 401
    assert r4.json()["detail"]["error"] == "invalid_token"

    # Assert audit chain: 4 rows, correct order, each carries ip + ua + payload_hash
    assert len(db.audit_log) == 4
    expected_statuses = ["success", "invalid_redirect_uri",
                          "invalid_client_metadata", "invalid_token"]
    expected_ips = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"]
    expected_uas = ["claude.ai/1.0", "bot/1.0", "test/1.0", "rogue/1.0"]
    for i, audit in enumerate(db.audit_log):
        assert audit["status"] == expected_statuses[i], \
            f"row {i}: {audit['status']} != {expected_statuses[i]}"
        assert audit["registered_ip"] == expected_ips[i]
        assert audit["registered_user_agent"] == expected_uas[i]
        assert audit["request_payload_hash"]  # SHA-256 hex present on every row
        assert len(audit["request_payload_hash"]) == 64  # SHA-256 hex
