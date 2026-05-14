"""
MCP Auth & Billing API Routes

POST /api/v1/mcp/auth/register  — create account + get API key
POST /api/v1/mcp/auth/login     — retrieve existing API key
GET  /api/v1/mcp/auth/credits   — check credit balance
POST /api/v1/mcp/oauth/token    — OAuth 2.0 client_credentials (ChatGPT)
POST /api/v1/mcp/billing/webhook — Lemon Squeezy webhook

Also: REST wrappers for GPT Actions (OpenAPI schema auto-generated).
"""

import hashlib
import hmac
import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, Form, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr

from app.mcp import auth as mcp_auth

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


# ── OAuth 2.0 endpoint (for ChatGPT) ────────────────────────────────────────

@router.post("/oauth/token")
async def oauth_token(
    grant_type: str = Form(...),
    client_id: str = Form(""),
    client_secret: str = Form(""),
):
    """OAuth 2.0 client_credentials grant for ChatGPT MCP integration.

    ChatGPT sends API key as client_id → receives bearer token.
    Token = the API key itself (stateless, no DB lookup on each MCP call).
    """
    if grant_type != "client_credentials":
        raise HTTPException(
            status_code=400,
            detail={"error": "unsupported_grant_type", "error_description": "Only client_credentials supported"},
        )

    result = mcp_auth.oauth_token(client_id, client_secret)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result)
    return result


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
}

# Canonical tool order (matches app/mcp/server.py registration order).
TOOL_ORDER = [
    "find_otskp_code",
    "find_urs_code",
    "classify_construction_element",
    "calculate_concrete_works",
    "parse_construction_budget",
    "analyze_construction_document",
    "create_work_breakdown",
    "get_construction_advisor",
    "search_czech_construction_norms",
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
    authorization: Optional[str] = Header(None),
):
    """Classify construction element (free tool, no auth required)."""
    from app.mcp.tools.classifier import classify_construction_element
    return await classify_construction_element(name=name, object_code=object_code)


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


@router.post("/tools/breakdown")
async def rest_breakdown(
    body: BreakdownRequest,
    authorization: Optional[str] = Header(None),
):
    """Create work breakdown (20 credits)."""
    api_key = _extract_bearer(authorization)
    credit_check = mcp_auth.check_credits(api_key or "", "create_work_breakdown")
    if not credit_check["ok"]:
        raise HTTPException(status_code=402, detail=credit_check["error"])

    from app.mcp.tools.breakdown import create_work_breakdown
    return await create_work_breakdown(
        elements=[e.model_dump() for e in body.elements],
        project_type=body.project_type,
        catalog=body.catalog,
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
