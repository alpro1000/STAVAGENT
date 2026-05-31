"""
MCP Auth & Billing API Routes

POST /api/v1/mcp/auth/register     — create account + get API key
POST /api/v1/mcp/auth/login        — retrieve existing API key
GET  /api/v1/mcp/auth/credits      — check credit balance
GET  /api/v1/mcp/oauth/authorize   — OAuth 2.0 authorization_code + PKCE start
POST /api/v1/mcp/oauth/token       — OAuth 2.0 token endpoint
                                     (client_credentials + authorization_code)
POST /api/v1/mcp/billing/webhook   — Lemon Squeezy webhook

Discovery (`/.well-known/oauth-authorization-server` +
`/.well-known/openid-configuration`) lives in `app/main.py` because
well-known URIs must resolve at the application root.

Also: REST wrappers for GPT Actions (OpenAPI schema auto-generated).
"""

import hashlib
import hmac
import json
import logging
import os
from typing import Optional
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Form, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, EmailStr, Field

from app.mcp import auth as mcp_auth
from app.mcp import oauth_codes as mcp_oauth_codes
from app.mcp import rate_limit as mcp_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mcp", tags=["MCP"])


# ── Pricing source of truth ─────────────────────────────────────────────────
# Prices must match Lemon Squeezy dashboard exactly.
# Update both places in the same change — no other file in the repo holds
# credit prices.
#
# Set Lemon Squeezy variant IDs via env to enable strict variant_id matching
# in the webhook (LEMONSQUEEZY_VARIANT_100/500/2000). When unset, the webhook
# falls back to variant_name substring match (e.g. "100 kreditů" → 100).

PRICING_TIERS = [
    {
        "credits": 100,
        "price_czk": 11,
        "price_per_credit": 0.110,
        "lemon_squeezy_variant_id": os.getenv("LEMONSQUEEZY_VARIANT_100", ""),
    },
    {
        "credits": 500,
        "price_czk": 55,
        "price_per_credit": 0.110,
        "lemon_squeezy_variant_id": os.getenv("LEMONSQUEEZY_VARIANT_500", ""),
    },
    {
        "credits": 2000,
        "price_czk": 220,
        "price_per_credit": 0.110,
        "lemon_squeezy_variant_id": os.getenv("LEMONSQUEEZY_VARIANT_2000", ""),
    },
]


def _credits_for_lemon_squeezy_order(
    variant_id: str, product_id: str, variant_name: str
) -> int:
    """Map a Lemon Squeezy order_created event to the credits to grant.

    Resolution order:
      1. Exact variant_id match (when LEMONSQUEEZY_VARIANT_* env is set).
      2. variant_name substring (e.g. variant labelled "100 kreditů — 11 Kč").
      3. product_id substring (legacy fallback for the original 3 SKUs).
    Returns 0 if no tier matches.
    """
    if variant_id:
        for tier in PRICING_TIERS:
            if tier["lemon_squeezy_variant_id"] and str(variant_id) == str(
                tier["lemon_squeezy_variant_id"]
            ):
                return tier["credits"]

    if variant_name:
        for tier in PRICING_TIERS:
            if str(tier["credits"]) in variant_name:
                return tier["credits"]

    if product_id:
        for tier in PRICING_TIERS:
            if str(tier["credits"]) in str(product_id):
                return tier["credits"]

    return 0


# ── Pydantic models ─────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    email: str
    password: str


class CreditCheckResponse(BaseModel):
    email: str
    credits: int
    total_used: int
    total_purchased: int


class DCRRequest(BaseModel):
    """RFC 7591 §2 client_metadata. Only fields we actually consume.

    pydantic v1/v2 compatible: `Field(default=...)` instead of dataclass
    syntax, no model_config (the project still has both versions in
    different services).
    """
    redirect_uris: list[str] = Field(default_factory=list)
    client_name: Optional[str] = None
    grant_types: Optional[list[str]] = None
    scope: Optional[str] = None
    software_id: Optional[str] = None
    software_version: Optional[str] = None
    # Echoed-but-unused fields are accepted silently per RFC 7591 §3.2.1:
    # "the authorization server MAY reject ... [or] ignore values that it
    # does not understand". Anthropic broker sends application_type +
    # token_endpoint_auth_method which we don't yet enforce.
    application_type: Optional[str] = None
    token_endpoint_auth_method: Optional[str] = None
    response_types: Optional[list[str]] = None
    contacts: Optional[list[str]] = None
    logo_uri: Optional[str] = None
    client_uri: Optional[str] = None
    policy_uri: Optional[str] = None
    tos_uri: Optional[str] = None
    jwks_uri: Optional[str] = None
    jwks: Optional[dict] = None


# ── Auth endpoints ───────────────────────────────────────────────────────────

@router.post("/auth/register")
async def register(body: AuthRequest, request: Request):
    """Register for MCP API access. Returns API key + 200 free credits."""
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    client_ip = request.client.host if request.client else "unknown"
    result = mcp_auth.register(body.email, body.password, client_ip=client_ip)
    if result.get("status") == "rate_limited":
        raise HTTPException(status_code=429, detail=result["error"])
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])
    return result


@router.post("/auth/login")
async def login(body: AuthRequest, request: Request):
    """Login to retrieve API key and current credits."""
    client_ip = request.client.host if request.client else "unknown"
    result = mcp_auth.login(body.email, body.password, client_ip=client_ip)
    if result.get("status") == "rate_limited":
        raise HTTPException(status_code=429, detail=result["error"])
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


@router.get("/auth/credits")
async def get_credits(authorization: Optional[str] = Header(None)):
    """Check current credit balance."""
    api_key = _extract_bearer(authorization)
    if not api_key:
        raise HTTPException(status_code=401, detail="Authorization: Bearer <api_key> required")
    result = mcp_auth.get_credits(api_key)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


# ── OAuth 2.0 endpoints ─────────────────────────────────────────────────────

def _validate_authorize_common(
    response_type: str, code_challenge: str, code_challenge_method: str
) -> None:
    """Shared RFC 6749 §4.1 + RFC 7636 PKCE parameter validation.

    Raises HTTPException with the appropriate RFC error code if any
    constraint fails — caller (GET or POST handler) propagates.
    """
    if response_type != "code":
        raise HTTPException(
            status_code=400,
            detail={"error": "unsupported_response_type",
                    "error_description": "Only response_type=code is supported"},
        )
    if code_challenge_method != "S256":
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_request",
                    "error_description": "code_challenge_method must be S256"},
        )
    if not code_challenge:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_request",
                    "error_description": "code_challenge required (PKCE mandatory)"},
        )


def _render_dcr_consent_form(
    *,
    client_row: dict,
    client_id: str,
    redirect_uri: str,
    state: Optional[str],
    code_challenge: str,
    code_challenge_method: str,
    scope: Optional[str],
    error_message: Optional[str] = None,
) -> HTMLResponse:
    """Render the minimal consent screen for DCR authorization_code flow.

    HTML-only, no JS, no external assets. Form POSTs back to /authorize
    with all query params preserved in hidden inputs plus the user's
    api_key. Posting via form instead of query-string keeps the api_key
    out of the browser URL bar + server access logs.

    TODO Replace with a proper styled consent page before Claude
    Directory submission — show requested scopes, application logo
    from software_id, "I agree" / "Deny" buttons, link to TOS/privacy.
    Current MVP is functional but visually rudimentary.
    """
    # Escape user-supplied strings for safe HTML embedding.
    import html as _html
    client_name = _html.escape(client_row.get("client_name") or client_id)
    software_id = _html.escape(client_row.get("software_id") or "")
    error_html = (
        f'<p class="error">{_html.escape(error_message)}</p>'
        if error_message else ""
    )
    software_html = (
        f'<p class="meta">Software: <code>{software_id}</code></p>'
        if software_id else ""
    )
    # Hidden fields preserve query state across the POST.
    hidden = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": code_challenge,
        "code_challenge_method": code_challenge_method,
        "state": state or "",
        "scope": scope or "",
    }
    hidden_inputs = "\n".join(
        f'    <input type="hidden" name="{k}" value="{_html.escape(v)}">'
        for k, v in hidden.items()
    )
    body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Authorize {client_name} — STAVAGENT</title>
  <style>
    body {{ font-family: -apple-system, system-ui, sans-serif;
            max-width: 480px; margin: 4rem auto; padding: 1rem;
            color: #222; line-height: 1.4; }}
    h1 {{ font-size: 1.5rem; margin-bottom: 0.5rem; }}
    .app {{ font-weight: 600; }}
    .meta {{ color: #666; font-size: 0.9rem; }}
    .scope {{ background: #f5f5f0; padding: 0.75rem 1rem;
             border-radius: 4px; margin: 1rem 0; }}
    input[type=password] {{ width: 100%; box-sizing: border-box;
                            font-family: ui-monospace, monospace;
                            font-size: 14px; padding: 0.5rem;
                            border: 1px solid #ccc; border-radius: 4px; }}
    button {{ background: #FF9F1C; color: #fff; border: 0;
             padding: 0.75rem 1.5rem; border-radius: 4px;
             font-weight: 600; cursor: pointer; font-size: 1rem; }}
    button:hover {{ background: #F97316; }}
    .actions {{ margin-top: 1rem; display: flex; gap: 1rem;
               align-items: center; }}
    .cancel {{ color: #666; text-decoration: none; }}
    .cancel:hover {{ text-decoration: underline; }}
    .error {{ background: #fee; border: 1px solid #fbb;
             padding: 0.75rem 1rem; border-radius: 4px;
             color: #900; margin-bottom: 1rem; }}
    code {{ background: #f5f5f0; padding: 0 4px; border-radius: 2px;
           font-size: 0.85em; }}
  </style>
</head>
<body>
  <h1>Authorize <span class="app">{client_name}</span></h1>
  <p>This application is requesting access to STAVAGENT MCP tools
     on your behalf.</p>
  {software_html}
  <div class="scope">
    Requested scope: <code>{_html.escape(scope or 'mcp')}</code>
  </div>
  {error_html}
  <form method="POST" action="/api/v1/mcp/oauth/authorize">
{hidden_inputs}
    <label for="api_key"><strong>Your STAVAGENT API key</strong></label>
    <input type="password" id="api_key" name="api_key"
           placeholder="sk-stavagent-..." autocomplete="off"
           autocapitalize="off" autocorrect="off" spellcheck="false"
           required>
    <div class="actions">
      <button type="submit">Authorize</button>
      <a class="cancel"
         href="{_html.escape(redirect_uri)}?error=access_denied{('&state=' + _html.escape(state)) if state else ''}">
        Cancel
      </a>
    </div>
  </form>
  <p class="meta" style="margin-top: 2rem;">
    Don't have an API key? Sign up at
    <a href="https://www.stavagent.cz/api-access">stavagent.cz/api-access</a>.
  </p>
</body>
</html>
"""
    return HTMLResponse(content=body, status_code=200)


@router.get("/oauth/authorize")
async def oauth_authorize(
    response_type: str = Query(...),
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    state: Optional[str] = Query(None),
    code_challenge: str = Query(...),
    code_challenge_method: str = Query("S256"),
    scope: Optional[str] = Query(None),  # accepted, ignored for legacy
):
    """RFC 6749 §4.1 authorization_code start + RFC 7636 PKCE.

    Dispatches on client_id prefix:

    - dcr-{hex24}     → DCR-broker flow (Claude.ai connector etc.):
                        validate the DCR client + its registered
                        redirect_uris, render an inline HTML consent
                        form. User posts their api_key → POST handler
                        below mints code bound to (oauth_client_id,
                        user_api_key).

    - sk-stavagent-*  → Legacy flow (ChatGPT custom GPT pre-DCR):
                        client_id IS the api_key. Mint code with
                        oauth_client_id=NULL — /token then uses the
                        backward-compat path (bearer = api_key, no
                        mcp_oauth_tokens row).
    """
    _validate_authorize_common(response_type, code_challenge, code_challenge_method)

    # ── DCR-broker dispatch ──────────────────────────────────────────────────
    if client_id.startswith("dcr-"):
        client_row = mcp_auth.lookup_oauth_client_for_authorize(client_id)
        if not client_row:
            # RFC 6749 §4.1.2.1: if redirect_uri can't be validated
            # (because we have no registered URIs for an unknown
            # client), MUST return the error to the user, not redirect.
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_client",
                        "error_description":
                            "Unknown or inactive client_id. Did you "
                            "register the client via /oauth/register?"},
            )

        registered_uris = client_row["redirect_uris"]
        if isinstance(registered_uris, str):
            registered_uris = json.loads(registered_uris)
        # RFC 7591 §2 + 6749 §3.1.2.3: exact match (no prefix / suffix
        # extension). One byte mismatch → rejected.
        if redirect_uri not in registered_uris:
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_redirect_uri",
                        "error_description":
                            "redirect_uri does not match any of the "
                            "client's registered URIs"},
            )

        # MVP consent shortcut: render an inline form. User pastes
        # api_key → POST handler below mints + redirects.
        #
        # TODO Replace with explicit "logged-in via cookie/JWT →
        # auto-consent" path before Claude Directory submission. The
        # form gets us through the OAuth dance today but it's a
        # paste-the-bearer step that ideally would be a button-click
        # on a real consent screen.
        return _render_dcr_consent_form(
            client_row=client_row,
            client_id=client_id,
            redirect_uri=redirect_uri,
            state=state,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            scope=scope,
        )

    # ── Legacy path: client_id IS the api_key ───────────────────────────────
    if not mcp_oauth_codes.is_allowed_redirect_uri(redirect_uri):
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_request",
                    "error_description": "redirect_uri not in allowlist"},
        )

    # `client_id` must be a known API key. We piggy-back on `get_credits`
    # which already does `SELECT … WHERE api_key=…` — returns
    # `{"error": "..."}` on unknown key.
    credit_check = mcp_auth.get_credits(client_id)
    if "error" in credit_check:
        # redirect_uri is allow-listed; per RFC §4.1.2.1 return the error
        # via redirect so the third-party sees a clean failure.
        params = {"error": "unauthorized_client",
                  "error_description": "Invalid client_id"}
        if state:
            params["state"] = state
        return RedirectResponse(
            url=f"{redirect_uri}?{urlencode(params)}",
            status_code=302,
        )

    code = mcp_oauth_codes.generate_code(
        client_id=client_id,
        redirect_uri=redirect_uri,
        code_challenge=code_challenge,
        state=state,
        code_challenge_method=code_challenge_method,
    )
    params = {"code": code}
    if state:
        params["state"] = state
    return RedirectResponse(
        url=f"{redirect_uri}?{urlencode(params)}",
        status_code=302,
    )


@router.post("/oauth/authorize")
async def oauth_authorize_consent(
    response_type: str = Form(...),
    client_id: str = Form(...),
    redirect_uri: str = Form(...),
    code_challenge: str = Form(...),
    code_challenge_method: str = Form("S256"),
    state: str = Form(""),
    scope: str = Form(""),
    api_key: str = Form(...),
):
    """Form-submission target for the DCR consent screen rendered by GET.

    All OAuth params are echoed back as hidden fields so we re-validate
    them server-side (defence against a tampered hidden field). On
    valid api_key: mint a code bound to (oauth_client_id, user_api_key)
    + 302 to redirect_uri. On invalid: re-render the form with an
    inline error message (HTTP 200, NOT a redirect — keeps the user on
    /authorize so they can fix their api_key without round-tripping
    through the broker).

    This handler exists only for DCR-issued client_ids. Legacy
    sk-stavagent-* clients have no consent UI and use the GET-only
    redirect flow.
    """
    if not client_id.startswith("dcr-"):
        # POST with a non-DCR client_id is a programming error on the
        # caller side, not a user-recoverable input mistake. Return JSON
        # rather than HTML form here.
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_request",
                    "error_description":
                        "POST /oauth/authorize only handles DCR consent. "
                        "Legacy clients should use GET."},
        )
    _validate_authorize_common(response_type, code_challenge, code_challenge_method)

    client_row = mcp_auth.lookup_oauth_client_for_authorize(client_id)
    if not client_row:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_client",
                    "error_description": "Unknown or inactive client_id"},
        )
    registered_uris = client_row["redirect_uris"]
    if isinstance(registered_uris, str):
        registered_uris = json.loads(registered_uris)
    if redirect_uri not in registered_uris:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_redirect_uri",
                    "error_description":
                        "redirect_uri does not match any of the "
                        "client's registered URIs"},
        )

    # Validate the user's pasted api_key. Re-render with inline error
    # if it doesn't match an active row — the browser tab stays on
    # /authorize so the user can correct + resubmit.
    user_id = mcp_auth._resolve_initial_access_user_id(api_key.strip())
    if user_id is None:
        return _render_dcr_consent_form(
            client_row=client_row,
            client_id=client_id,
            redirect_uri=redirect_uri,
            state=state or None,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            scope=scope or None,
            error_message="Invalid or inactive API key. Check the value and try again.",
        )

    code = mcp_oauth_codes.generate_code(
        client_id=api_key.strip(),  # FK to mcp_api_keys = the user who granted consent
        redirect_uri=redirect_uri,
        code_challenge=code_challenge,
        state=state or None,
        code_challenge_method=code_challenge_method,
        oauth_client_id=client_id,  # FK to mcp_oauth_clients = the broker app
    )
    params = {"code": code}
    if state:
        params["state"] = state
    return RedirectResponse(
        url=f"{redirect_uri}?{urlencode(params)}",
        status_code=303,  # See Other — convert POST → GET for redirect
    )


@router.post("/oauth/token")
async def oauth_token(
    grant_type: str = Form(...),
    # client_credentials + refresh_token grants
    client_id: str = Form(""),
    client_secret: str = Form(""),
    # authorization_code grant
    code: str = Form(""),
    redirect_uri: str = Form(""),
    code_verifier: str = Form(""),
    # refresh_token grant
    refresh_token: str = Form(""),
    scope: str = Form(""),
):
    """OAuth 2.0 token endpoint.

    Supports three grant types + smart routing for legacy / DCR clients:

    - `client_credentials` (RFC 6749 §4.4)
        Server-to-server. ChatGPT legacy custom GPTs (client_id=
        sk-stavagent-{hex}) → backward-compat path: access_token =
        the api_key itself, NO mcp_oauth_tokens row written. DCR-issued
        clients (client_id=dcr-{hex24}) → new path: validate secret,
        resolve user_api_key from mcp_oauth_clients.created_by_user_id
        (NULL for public DCR), mint sat-{hex48} access_token, INSERT
        into mcp_oauth_tokens. No refresh_token per RFC §4.4.3.

    - `authorization_code` (RFC 6749 §4.1 + RFC 7636 PKCE)
        consume_code() returns (user_api_key, oauth_client_id). If
        oauth_client_id IS NULL → legacy: access_token = api_key, no
        token row. If NOT NULL → new path: mint sat-{hex48} access +
        srt-{hex48} refresh, INSERT bound to (oauth_client_id,
        user_api_key).

    - `refresh_token` (RFC 6749 §6 + BCP §4.14 rotation)
        DCR-only. Rotates: revoke old, mint new pair, new.rotated_from
        = old.id. Replay (presenting an already-revoked refresh_token)
        revokes the entire rotation chain.

    Format-based dispatch (legacy vs new) is explicit and commented at
    each branch so a future reviewer can trace the backward-compat
    boundary without grep.
    """
    grant_type = (grant_type or "").strip()

    # ── client_credentials grant ─────────────────────────────────────────────
    if grant_type == "client_credentials":
        # Dispatch: dcr- prefix → new DCR flow; otherwise legacy.
        # The `sk-stavagent-` legacy path is preserved verbatim because
        # ChatGPT custom GPTs in production today (May 2026) authenticate
        # with their api_key as both client_id and client_secret — see
        # docs/audits/mcp_status/2026-05-09_chatgpt_legacy_oauth.md.
        if client_id.startswith("dcr-"):
            client_row = mcp_auth.validate_oauth_client_credentials(
                client_id, client_secret
            )
            if not client_row:
                raise HTTPException(
                    status_code=401,
                    detail={"error": "invalid_client",
                            "error_description": "Unknown or invalid client credentials"},
                )
            # client_credentials grant must be advertised by the client.
            grant_types_allowed = client_row["grant_types"]
            if isinstance(grant_types_allowed, str):
                # JSONB columns come back as str in some psycopg2 paths
                grant_types_allowed = json.loads(grant_types_allowed)
            if "client_credentials" not in grant_types_allowed:
                raise HTTPException(
                    status_code=400,
                    detail={"error": "unauthorized_client",
                            "error_description":
                                "Client did not register for client_credentials grant"},
                )
            # Resolve user_api_key — only NOT NULL for authenticated DCR.
            # Public-DCR clients get user_api_key=NULL → middleware will
            # 402 paid tools.
            user_api_key = (
                mcp_auth.resolve_user_api_key_for_client(client_id)
                if client_row["created_by_user_id"] is not None
                else None
            )
            new = mcp_auth.mint_token_pair(
                oauth_client_id=client_id,
                user_api_key=user_api_key,
                grant_type="client_credentials",
                scope=scope or client_row.get("scope"),
                with_refresh=False,  # RFC 6749 §4.4.3
            )
            # Strip internal id before serialising.
            new.pop("_token_row_id", None)
            return new

        # Legacy path: sk-stavagent-* (or any non-dcr- value) keeps the
        # old single-table lookup. NO mcp_oauth_tokens row written —
        # MCPAuthChallengeMiddleware will fall back to mcp_api_keys
        # when it sees a sk-stavagent-* bearer.
        result = mcp_auth.oauth_token(client_id, client_secret)
        if "error" in result:
            raise HTTPException(status_code=401, detail=result)
        return result

    # ── authorization_code grant ────────────────────────────────────────────
    if grant_type == "authorization_code":
        consume = mcp_oauth_codes.consume_code(
            code=code,
            code_verifier=code_verifier,
            redirect_uri=redirect_uri,
        )
        if not consume["ok"]:
            raise HTTPException(
                status_code=400,
                detail={"error": consume["error"],
                        "error_description": consume.get("error_description", "")},
            )

        user_api_key = consume["client_id"]
        oauth_client_id = consume.get("oauth_client_id")

        # Dispatch:
        #   oauth_client_id IS NULL  → legacy authorize flow (ChatGPT
        #     custom GPT before DCR) where the user pasted their api_key
        #     into the "Client ID" field directly. Preserve the existing
        #     bearer = api_key shape; no mcp_oauth_tokens row.
        #   oauth_client_id NOT NULL → DCR-broker flow. Mint sat-/srt-
        #     pair bound to (oauth_client_id, user_api_key).
        if not oauth_client_id:
            return {
                "access_token": user_api_key,
                "token_type": "bearer",
                "scope": "mcp",
            }

        new = mcp_auth.mint_token_pair(
            oauth_client_id=oauth_client_id,
            user_api_key=user_api_key,
            grant_type="authorization_code",
            scope=scope or "mcp",
            with_refresh=True,
        )
        new.pop("_token_row_id", None)
        return new

    # ── refresh_token grant ─────────────────────────────────────────────────
    if grant_type == "refresh_token":
        if not refresh_token:
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_request",
                        "error_description": "refresh_token required"},
            )
        # refresh_token grant is DCR-only by construction (legacy flow
        # doesn't mint refresh tokens). Validate client credentials
        # before touching the rotation chain so a stolen refresh_token
        # without matching client credentials gets 401 not 200.
        if not client_id.startswith("dcr-"):
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_client",
                        "error_description":
                            "refresh_token grant requires a DCR-issued client_id"},
            )
        client_row = mcp_auth.validate_oauth_client_credentials(
            client_id, client_secret
        )
        if not client_row:
            raise HTTPException(
                status_code=401,
                detail={"error": "invalid_client",
                        "error_description": "Unknown or invalid client credentials"},
            )
        rotation = mcp_auth.rotate_refresh_token(
            presented_refresh=refresh_token,
            client_id=client_id,
            scope=scope or None,
        )
        if not rotation["ok"]:
            raise HTTPException(
                status_code=400,
                detail={"error": rotation["error"],
                        "error_description": rotation.get("error_description", "")},
            )
        # Strip internal id before serialising.
        rotation.pop("_token_row_id", None)
        rotation.pop("ok", None)
        return rotation

    raise HTTPException(
        status_code=400,
        detail={"error": "unsupported_grant_type",
                "error_description":
                    "Supported: client_credentials, authorization_code, refresh_token"},
    )


# ── Dynamic Client Registration (RFC 7591) ──────────────────────────────────

# Local-loopback hosts allowed under http:// per RFC 8252 §7.3 (loopback
# interface redirection). All other schemes / hosts MUST be https://.
_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1", "[::1]"}

# RFC 7591 §2 client_name has no explicit max — we cap at 200 chars to
# bound DB row size and keep audit logs readable. 200 is generous (e.g.
# "Anthropic Claude Desktop — Claude.ai Connector Beta v2 (2026)" fits).
_CLIENT_NAME_MAX_LEN = 200


def _validate_redirect_uri(uri: str) -> Optional[str]:
    """Return None if URI is acceptable, else an RFC 7591 error description.

    Acceptance rules:
      - https:// any host, any port.
      - http:// only for loopback hosts (RFC 8252 §7.3).
      - No fragment (RFC 6749 §3.1.2).
      - No javascript:, data:, file:, mailto:, ... schemes.
    """
    if not uri or not isinstance(uri, str):
        return "redirect_uri must be a non-empty string"
    try:
        parsed = urlparse(uri)
    except Exception as exc:  # noqa: BLE001
        return f"redirect_uri could not be parsed: {exc}"
    if parsed.fragment:
        return "redirect_uri must not contain a fragment"
    if parsed.scheme == "https":
        if not parsed.hostname:
            return "redirect_uri must include a host"
        return None
    if parsed.scheme == "http":
        if (parsed.hostname or "").lower() in _LOOPBACK_HOSTS:
            return None
        return "redirect_uri with http:// is only allowed for loopback hosts"
    return f"redirect_uri scheme '{parsed.scheme}' not allowed (use https)"


def _hash_payload(raw_body: bytes) -> Optional[str]:
    """SHA-256 hex of the raw request body for audit-log forensics.

    Returns None for empty / unreadable bodies — caller persists NULL
    rather than logging a hash of nothing.
    """
    if not raw_body:
        return None
    return hashlib.sha256(raw_body).hexdigest()


@router.post("/oauth/register", status_code=201)
async def oauth_register(request: Request):
    """RFC 7591 §3 Dynamic Client Registration.

    Public endpoint by default (no Authorization header) — RFC 7591 §3
    "the authorization server MAY require an initial access token". We
    accept both modes:

      No Authorization header   → public DCR. The client row is created
                                  with `created_by_user_id = NULL`.
                                  client_credentials grants issued to
                                  this client mint tokens with
                                  `user_api_key = NULL`, and paid MCP
                                  tools return 402 Payment Required.
                                  authorization_code grants still work
                                  fully (the user supplies their own
                                  api_key during the consent flow).

      Bearer sk-stavagent-{hex} → authenticated DCR. The client row
                                  binds to that user; client_credentials
                                  grants attribute credits to them.

      Any other Authorization   → 401, invalid_token. Explicit reject
                                  rather than silent downgrade to public
                                  DCR so misconfigured callers see the
                                  problem.

    Audit trail: every code path writes one row to
    `mcp_oauth_registration_log` — success row carries
    `oauth_client_id` FK; failure rows carry NULL FK + status + error_code.

    Rate limited (Gate 6): 10 registrations / hour per source IP via
    Redis-backed atomic Lua INCR+EXPIRE. Fail-closed: Redis unreachable
    → 503 (NOT graceful fallback — this is a public endpoint with no
    second auth layer). MCP_RATE_LIMIT_WHITELIST env can bypass for
    CI smoke tests. See app/mcp/rate_limit.py.
    """
    raw_body = await request.body()
    payload_hash = _hash_payload(raw_body)
    client_ip = mcp_rate_limit.extract_client_ip(request)
    user_agent = request.headers.get("user-agent")

    # ── 0. Rate limit gate ───────────────────────────────────────────────────
    # Runs BEFORE any DB work or JSON parse so a flood of malformed
    # bodies can't pin the connection pool. Audit row is still
    # written on `exceeded` so we have forensic evidence + caller
    # identity for security review.
    rl = await mcp_rate_limit.check_register_rate_limit(client_ip)
    if rl["status"] == mcp_rate_limit.RateLimitResult.UNAVAILABLE:
        # Fail closed: rate limiter is the only DoS gate on a public
        # endpoint. 503 instead of 500 so Cloud Run / brokers know to
        # retry rather than treat as a permanent server fault.
        raise HTTPException(
            status_code=503,
            detail={
                "error": "service_unavailable",
                "error_description": rl["error_description"],
                "retry_after": rl["retry_after"],
            },
            headers={"Retry-After": str(rl["retry_after"])},
        )
    if rl["status"] == mcp_rate_limit.RateLimitResult.EXCEEDED:
        # 429 + RFC 6585 Retry-After header + audit row.
        mcp_auth.log_oauth_registration_failure(
            status="rate_limited",
            error_code="rate_limit_exceeded",
            error_description=(
                f"Exceeded {rl['limit']} registrations/hour from this IP. "
                f"Retry in {rl['retry_after']}s."
            ),
            client_name=None,
            request_payload_hash=payload_hash,
            registered_ip=client_ip,
            registered_user_agent=user_agent,
        )
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limit_exceeded",
                "retry_after": rl["retry_after"],
            },
            headers={"Retry-After": str(rl["retry_after"])},
        )

    # ── 1. Initial-access-token detection ────────────────────────────────────
    auth_header = request.headers.get("authorization")
    bearer = _extract_bearer(auth_header)
    created_by_user_id: Optional[int] = None
    if auth_header is not None:
        if not bearer or not bearer.startswith("sk-stavagent-"):
            mcp_auth.log_oauth_registration_failure(
                status="invalid_token",
                error_code="invalid_token",
                error_description="Authorization header must be 'Bearer sk-stavagent-{hex48}'",
                client_name=None,
                request_payload_hash=payload_hash,
                registered_ip=client_ip,
                registered_user_agent=user_agent,
            )
            raise HTTPException(
                status_code=401,
                detail={"error": "invalid_token",
                        "error_description": "Bearer sk-stavagent-{hex48} required"},
            )
        created_by_user_id = mcp_auth._resolve_initial_access_user_id(bearer)
        if created_by_user_id is None:
            mcp_auth.log_oauth_registration_failure(
                status="invalid_token",
                error_code="invalid_token",
                error_description="Initial access token does not match an active user",
                client_name=None,
                request_payload_hash=payload_hash,
                registered_ip=client_ip,
                registered_user_agent=user_agent,
            )
            raise HTTPException(
                status_code=401,
                detail={"error": "invalid_token",
                        "error_description": "Initial access token invalid or inactive"},
            )

    # ── 2. JSON parse ────────────────────────────────────────────────────────
    try:
        body_json = json.loads(raw_body or b"{}")
    except json.JSONDecodeError as exc:
        mcp_auth.log_oauth_registration_failure(
            status="invalid_client_metadata",
            error_code="invalid_client_metadata",
            error_description=f"Request body is not valid JSON: {exc.msg}",
            client_name=None,
            request_payload_hash=payload_hash,
            registered_ip=client_ip,
            registered_user_agent=user_agent,
        )
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_client_metadata",
                    "error_description": "Request body must be valid JSON"},
        )

    try:
        # `model_validate` for pydantic v2, fallback to `parse_obj` for v1.
        if hasattr(DCRRequest, "model_validate"):
            body = DCRRequest.model_validate(body_json)
        else:  # pragma: no cover — covered by version pinned to v2 in CI
            body = DCRRequest.parse_obj(body_json)
    except Exception as exc:  # noqa: BLE001
        mcp_auth.log_oauth_registration_failure(
            status="invalid_client_metadata",
            error_code="invalid_client_metadata",
            error_description=f"client_metadata failed schema validation: {exc}",
            client_name=body_json.get("client_name") if isinstance(body_json, dict) else None,
            request_payload_hash=payload_hash,
            registered_ip=client_ip,
            registered_user_agent=user_agent,
        )
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_client_metadata",
                    "error_description": "client_metadata failed schema validation"},
        )

    # ── 3. redirect_uris validation ──────────────────────────────────────────
    if not body.redirect_uris:
        mcp_auth.log_oauth_registration_failure(
            status="invalid_redirect_uri",
            error_code="invalid_redirect_uri",
            error_description="redirect_uris must contain at least one URI",
            client_name=body.client_name,
            request_payload_hash=payload_hash,
            registered_ip=client_ip,
            registered_user_agent=user_agent,
        )
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_redirect_uri",
                    "error_description": "redirect_uris must contain at least one URI"},
        )
    for uri in body.redirect_uris:
        err = _validate_redirect_uri(uri)
        if err:
            mcp_auth.log_oauth_registration_failure(
                status="invalid_redirect_uri",
                error_code="invalid_redirect_uri",
                error_description=err,
                client_name=body.client_name,
                request_payload_hash=payload_hash,
                registered_ip=client_ip,
                registered_user_agent=user_agent,
            )
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_redirect_uri",
                        "error_description": err},
            )

    # ── 4. client_name validation ───────────────────────────────────────────
    client_name = (body.client_name or "").strip()
    if not client_name:
        # RFC 7591 §2 client_name is recommended but not required. We
        # require it because the audit log + future user-facing "your
        # connected apps" UI both need a label. Derive from software_id
        # as a fallback so well-behaved brokers without an explicit
        # client_name still succeed.
        client_name = (body.software_id or "").strip() or "Unnamed MCP Client"
    if len(client_name) > _CLIENT_NAME_MAX_LEN:
        mcp_auth.log_oauth_registration_failure(
            status="invalid_client_metadata",
            error_code="invalid_client_metadata",
            error_description=f"client_name exceeds {_CLIENT_NAME_MAX_LEN} chars",
            client_name=client_name[:_CLIENT_NAME_MAX_LEN],
            request_payload_hash=payload_hash,
            registered_ip=client_ip,
            registered_user_agent=user_agent,
        )
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_client_metadata",
                    "error_description": f"client_name exceeds {_CLIENT_NAME_MAX_LEN} chars"},
        )

    # ── 5. grant_types validation ───────────────────────────────────────────
    grant_types = body.grant_types or ["authorization_code"]
    unsupported = [g for g in grant_types if g not in mcp_auth.SUPPORTED_GRANT_TYPES]
    if unsupported:
        mcp_auth.log_oauth_registration_failure(
            status="invalid_client_metadata",
            error_code="invalid_client_metadata",
            error_description=(
                f"Unsupported grant_types: {unsupported}. "
                f"Allowed: {sorted(mcp_auth.SUPPORTED_GRANT_TYPES)}"
            ),
            client_name=client_name,
            request_payload_hash=payload_hash,
            registered_ip=client_ip,
            registered_user_agent=user_agent,
        )
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_client_metadata",
                    "error_description": (
                        f"Unsupported grant_types: {unsupported}. "
                        f"Allowed: {sorted(mcp_auth.SUPPORTED_GRANT_TYPES)}"
                    )},
        )

    # ── 6. INSERT (single transaction with audit row) ───────────────────────
    try:
        result = mcp_auth.register_oauth_client(
            client_name=client_name,
            redirect_uris=body.redirect_uris,
            grant_types=grant_types,
            scope=body.scope,
            software_id=body.software_id,
            software_version=body.software_version,
            created_by_user_id=created_by_user_id,
            registered_ip=client_ip,
            registered_user_agent=user_agent,
            request_payload_hash=payload_hash,
        )
    except Exception as exc:  # noqa: BLE001 — RFC 7591 §3.2.2 maps anything else to server_error
        logger.exception("[MCP/DCR] register_oauth_client failed")
        mcp_auth.log_oauth_registration_failure(
            status="server_error",
            error_code="server_error",
            error_description=str(exc)[:500],
            client_name=client_name,
            request_payload_hash=payload_hash,
            registered_ip=client_ip,
            registered_user_agent=user_agent,
        )
        raise HTTPException(
            status_code=500,
            detail={"error": "server_error",
                    "error_description": "Registration failed; please retry"},
        )

    logger.info(
        "[MCP/DCR] Registered client_id=%s name=%r ip=%s authenticated=%s",
        result["client_id"], client_name, client_ip, created_by_user_id is not None,
    )

    # ── 7. RFC 7591 §3.2.1 response ─────────────────────────────────────────
    # Echo all registered_metadata + assign client_id + plaintext
    # client_secret + issued_at + expires_at=0 (no expiry for MVP).
    response_body = {
        "client_id": result["client_id"],
        "client_secret": result["client_secret"],
        "client_id_issued_at": result["issued_at_unix"],
        "client_secret_expires_at": 0,
        "client_name": client_name,
        "redirect_uris": body.redirect_uris,
        "grant_types": grant_types,
        "token_endpoint_auth_method": body.token_endpoint_auth_method or "client_secret_post",
        "response_types": body.response_types or ["code"],
    }
    # Optional echo fields — only include if caller sent them
    for field in ("scope", "software_id", "software_version",
                  "application_type", "contacts", "logo_uri",
                  "client_uri", "policy_uri", "tos_uri"):
        val = getattr(body, field, None)
        if val is not None:
            response_body[field] = val
    return JSONResponse(status_code=201, content=response_body)


# ── Billing webhook (Lemon Squeezy) ─────────────────────────────────────────

@router.post("/billing/webhook")
async def billing_webhook(request: Request):
    """Lemon Squeezy webhook: order_created → add credits."""
    body = await request.body()
    signature = request.headers.get("X-Signature", "")

    # Verify webhook signature in production
    secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET", "")
    if secret:
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            logger.warning("[MCP/Billing] Invalid webhook signature")
            raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = data.get("meta", {}).get("event_name", "")
    if event != "order_created":
        return {"status": "ignored", "event": event}

    attrs = data.get("data", {}).get("attributes", {})
    first_item = attrs.get("first_order_item", {})

    email = attrs.get("user_email", "") or attrs.get("custom_data", {}).get("email", "")
    variant_id = str(first_item.get("variant_id", ""))
    product_id = str(first_item.get("product_id", ""))
    variant_name = first_item.get("variant_name", "")

    credits_to_add = _credits_for_lemon_squeezy_order(variant_id, product_id, variant_name)

    if not email or credits_to_add == 0:
        logger.warning(
            f"[MCP/Billing] Cannot process: email={email!r}, "
            f"variant_id={variant_id!r}, product_id={product_id!r}, "
            f"variant_name={variant_name!r}"
        )
        return {"status": "warning", "message": "Could not determine email or credits"}

    result = mcp_auth.add_credits(email, credits_to_add)
    logger.info(f"[MCP/Billing] {email}: +{credits_to_add} credits")
    return {"status": "ok", "credits_added": credits_to_add, **result}


# ── Tool listing ─────────────────────────────────────────────────────────────

# Short human-readable descriptions for each MCP tool. Kept here (not derived
# from FastMCP introspection) so the API response is stable and independent of
# whether the MCP server boots — `/health` already covers MCP availability.
TOOL_DESCRIPTIONS = {
    "find_otskp_code": (
        "Vyhledá kódy z katalogu OTSKP (17 904 položek dopravních a inženýrských "
        "staveb). Hledá v reálné databázi — AI modely tyto kódy neznají."
    ),
    "find_urs_code": (
        "Vyhledá kódy ÚRS/RTS (39 000+ položek) přes Perplexity web search a "
        "URS Matcher službu."
    ),
    "classify_construction_element": (
        "Klasifikuje konstrukční prvek do jednoho z 22+ typů (pilíř, opěra, "
        "mostovka, římsa, …) s difficulty factor, doporučeným bedněním a "
        "vyztužením."
    ),
    "calculate_concrete_works": (
        "Spočítá betonářské práce pro jeden ŽB prvek (7engine pipeline): "
        "bednění, výztuž, zrání, podpěry, harmonogram, CZK/m³."
    ),
    "calculate_pump": (
        "Spočítá náklady na betonpumpu (TOV multi-supplier) podle objemu: "
        "čerpadlo, přistavení, doprava, vibrátor, příplatek + volitelně "
        "bednění doprava / ztracené díly / chemie. Vrací rozpad po položkách."
    ),
    "parse_construction_budget": (
        "Parsuje Excel rozpočet / soupis prací. Podporuje 4 formáty (Komplet/"
        "FORESTINA, OTSKP D6, AspeEsticon/SŽ, RTS)."
    ),
    "analyze_construction_document": (
        "Analyzuje PDF technické zprávy a další dokumentaci. Extrahuje třídy "
        "betonu, výztuže, expozice, normy, speciální požadavky."
    ),
    "create_work_breakdown": (
        "Z listu konstrukčních prvků vytvoří kompletní výkaz výměr / soupis "
        "prací s OTSKP/ÚRS kódy."
    ),
    "get_construction_advisor": (
        "Expertní doporučení pro ŽB prvek: postup, výběr bednění s "
        "odůvodněním, počet záběrů, plán čet, relevantní ČSN EN, rizika."
    ),
    "search_czech_construction_norms": (
        "Vyhledá české stavební normy (ČSN, TP, TKP, VL) — 3vrstvé hledání: "
        "lokální NKB + Perplexity web search + regex extrakce ID."
    ),
    "uep_run_extraction": (
        "Spustí UEP (Universal Extraction Pipeline) end-to-end pro projekt — "
        "discovery → extrakce → coverage matrix → reconciliation. Vrátí job_id "
        "pro polling stavu."
    ),
    "uep_get_job": (
        "Vrátí aktuální stav UEP úlohy (queued / running / succeeded / "
        "failed / cancelled) + fázi + progress + počty zpracovaných souborů."
    ),
    "uep_list_supported_formats": (
        "Vypíše source formáty, pro které je v aktuálním deploymentu "
        "registrován extractor (dxf, pdf_tz, dwg, ifc, xml_unixml, xml_landxml)."
    ),
    "uep_get_coverage_matrix": (
        "Vrátí YAML coverage matici pro daný project_type (residential / "
        "bridge / road / industrial) — kategorie + required_fields + expected "
        "sources, podle docs §3.2."
    ),
    "uep_get_reconciliation_rules": (
        "Vrátí kompaktní souhrn reconciliation pravidel pro project_type "
        "(id + description + severity + tolerance). Plný YAML lze získat přes "
        "REST /api/v1/uep/config/reconciliation-rules."
    ),
    "uep_get_dwg_conversion_status": (
        "Probe běhového prostředí — kontroluje dostupnost ODA File Converter "
        "+ LibreDWG binárek na PATH. Vrací status fallback řetězce + operátorské "
        "doporučení pro deployment."
    ),
}

# Canonical tool order (matches app/mcp/server.py registration order).
TOOL_ORDER = [
    "find_otskp_code",
    "find_urs_code",
    "classify_construction_element",
    "calculate_concrete_works",
    "calculate_pump",
    "parse_construction_budget",
    "analyze_construction_document",
    "create_work_breakdown",
    "get_construction_advisor",
    "search_czech_construction_norms",
    "uep_run_extraction",
    "uep_get_job",
    "uep_list_supported_formats",
    "uep_get_coverage_matrix",
    "uep_get_reconciliation_rules",
    "uep_get_dwg_conversion_status",
]


@router.get("/tools")
async def list_tools(authorization: Optional[str] = Header(None)):
    """List all MCP tools with name, description, and credit cost.

    Requires a valid API key (same auth as /auth/credits). Free tools cost 0
    credits but are still listed for discoverability.
    """
    api_key = _extract_bearer(authorization)
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Authorization: Bearer <api_key> required",
        )

    # Verify the key exists (and is active) — reuses the same lookup as
    # `/auth/credits`. `get_credits` returns {"error": …} on unknown key.
    credit_check = mcp_auth.get_credits(api_key)
    if "error" in credit_check:
        raise HTTPException(status_code=401, detail=credit_check["error"])

    tools = [
        {
            "name": name,
            "description": TOOL_DESCRIPTIONS[name],
            "cost_credits": mcp_auth.TOOL_COSTS.get(name, 0),
        }
        for name in TOOL_ORDER
    ]
    return {"tools": tools, "total": len(tools)}


# ── Pricing info ─────────────────────────────────────────────────────────────

@router.get("/pricing")
async def get_pricing():
    """Tool credit costs and pricing tiers.

    Pricing tiers come from PRICING_TIERS, which is the single source of truth
    shared with the Lemon Squeezy webhook. Internal Lemon Squeezy variant IDs
    are not exposed in the response.
    """
    return {
        "tool_costs": mcp_auth.TOOL_COSTS,
        "free_credits_on_registration": mcp_auth.FREE_CREDITS,
        "pricing_tiers": [
            {
                "credits": tier["credits"],
                "price_czk": tier["price_czk"],
                "price_per_credit": tier["price_per_credit"],
            }
            for tier in PRICING_TIERS
        ],
    }


# ── REST wrappers for GPT Actions ───────────────────────────────────────────

@router.get("/tools/otskp")
async def rest_otskp(
    query: str,
    code: Optional[str] = None,
    max_results: int = 5,
    authorization: Optional[str] = Header(None),
):
    """Find OTSKP catalog codes (free tool, no auth required)."""
    from app.mcp.tools.otskp import find_otskp_code
    return await find_otskp_code(query=query, code=code, max_results=max_results)


@router.get("/tools/classify")
async def rest_classify(
    name: str,
    object_code: Optional[str] = None,
    object_type: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    """Classify construction element (free tool, no auth required).

    `object_type` (bridge | retaining_wall | building) is the authoritative
    construction context when supplied — see classify_construction_element.
    """
    from app.mcp.tools.classifier import classify_construction_element
    return await classify_construction_element(
        name=name, object_code=object_code, object_type=object_type
    )


class CalculateRequest(BaseModel):
    element_type: str
    volume_m3: float
    concrete_class: str
    height_m: Optional[float] = None
    width_m: Optional[float] = None
    formwork_area_m2: Optional[float] = None
    is_prestressed: bool = False
    span_m: Optional[float] = None
    num_spans: Optional[int] = None
    temperature_c: float = 15.0


@router.post("/tools/calculate")
async def rest_calculate(
    body: CalculateRequest,
    authorization: Optional[str] = Header(None),
):
    """Calculate concrete works (5 credits)."""
    api_key = _extract_bearer(authorization)
    credit_check = mcp_auth.check_credits(api_key or "", "calculate_concrete_works")
    if not credit_check["ok"]:
        raise HTTPException(status_code=402, detail=credit_check["error"])

    from app.mcp.tools.calculator import calculate_concrete_works
    return await calculate_concrete_works(**body.model_dump())


class PumpRequest(BaseModel):
    volume_m3: float
    pump_supplier: Optional[str] = None
    cerpadlo_rate_czk_sh: float = 2500.0
    vibrator_rate_czk_sh: float = 50.0
    transport_km: float = 72.0
    transport_rate_czk_km: float = 68.0
    preplatek_rate_czk_m3: float = 35.0
    bedneni_doprava_czk: Optional[float] = None
    bedneni_ztracene_dily_czk: Optional[float] = None
    chemie_najezd_myti_czk: Optional[float] = None


@router.post("/tools/pump")
async def rest_pump(
    body: PumpRequest,
    authorization: Optional[str] = Header(None),
):
    """Calculate TOV concrete pump cost (5 credits)."""
    api_key = _extract_bearer(authorization)
    credit_check = mcp_auth.check_credits(api_key or "", "calculate_pump")
    if not credit_check["ok"]:
        raise HTTPException(status_code=402, detail=credit_check["error"])

    from app.mcp.tools.calculator import calculate_pump
    return await calculate_pump(**body.model_dump())


class BreakdownElement(BaseModel):
    name: str
    concrete_class: Optional[str] = None
    volume_m3: Optional[float] = None
    height_m: Optional[float] = None
    is_prestressed: bool = False
    rebar_tons: Optional[float] = None


class BreakdownRequest(BaseModel):
    elements: list[BreakdownElement]
    project_type: str = "most"
    catalog: str = "otskp"
    # Work-first contract (Pattern 15). Default produces a frozen, code-less list.
    mode: str = "work_first"
    # Opt-in stage gating: when set, the policy gateway enforces the session's
    # workflow stage; when omitted, the call is session-less (current behavior).
    session_id: Optional[str] = None


@router.post("/tools/breakdown")
async def rest_breakdown(
    body: BreakdownRequest,
    authorization: Optional[str] = Header(None),
):
    """Create work breakdown (20 credits). Work-first by default (Pattern 15)."""
    # Single server-side policy enforcement point (tools stay dumb). Session-less
    # calls pass through; a supplied session_id activates stage gating.
    from app.mcp.stage_gating_gateway import enforce_or_raise
    await enforce_or_raise(tool_name="create_work_breakdown", session_id=body.session_id)

    api_key = _extract_bearer(authorization)
    credit_check = mcp_auth.check_credits(api_key or "", "create_work_breakdown")
    if not credit_check["ok"]:
        raise HTTPException(status_code=402, detail=credit_check["error"])

    from app.mcp.tools.breakdown import create_work_breakdown
    return await create_work_breakdown(
        elements=[e.model_dump() for e in body.elements],
        project_type=body.project_type,
        catalog=body.catalog,
        mode=body.mode,
    )


@router.get("/tools/norms")
async def rest_norms(
    query: str,
    category: str = "všechno",
    authorization: Optional[str] = Header(None),
):
    """Search Czech construction norms (1 credit)."""
    api_key = _extract_bearer(authorization)
    credit_check = mcp_auth.check_credits(api_key or "", "search_czech_construction_norms")
    if not credit_check["ok"]:
        raise HTTPException(status_code=402, detail=credit_check["error"])

    from app.mcp.tools.norms import search_czech_construction_norms
    return await search_czech_construction_norms(query=query, category=category)


class AdvisorRequest(BaseModel):
    description: str
    element_type: Optional[str] = None
    volume_m3: Optional[float] = None
    height_m: Optional[float] = None
    concrete_class: Optional[str] = None
    question: Optional[str] = None


@router.post("/tools/advisor")
async def rest_advisor(
    body: AdvisorRequest,
    authorization: Optional[str] = Header(None),
):
    """Get construction advisor recommendation (3 credits)."""
    api_key = _extract_bearer(authorization)
    credit_check = mcp_auth.check_credits(api_key or "", "get_construction_advisor")
    if not credit_check["ok"]:
        raise HTTPException(status_code=402, detail=credit_check["error"])

    from app.mcp.tools.advisor import get_construction_advisor
    return await get_construction_advisor(**body.model_dump())


# ── Helper ───────────────────────────────────────────────────────────────────

def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None
