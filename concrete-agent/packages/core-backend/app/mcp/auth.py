"""
MCP Auth + Credit System

Handles API key registration, authentication, and per-tool credit billing.
Stores keys in PostgreSQL (mcp_api_keys table). Falls back to in-memory
store if DB is unavailable (development mode).

Free tools (OTSKP, classify) work without any authentication.
Paid tools require a valid API key with sufficient credits.
"""

import hashlib
import logging
import os
import secrets
import sqlite3
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Tool credit costs ────────────────────────────────────────────────────────

TOOL_COSTS = {
    "find_otskp_code": 0,
    "classify_construction_element": 0,
    "search_czech_construction_norms": 1,
    "find_urs_code": 3,
    "get_construction_advisor": 3,
    "calculate_concrete_works": 5,
    "parse_construction_budget": 5,
    "analyze_construction_document": 10,
    "create_work_breakdown": 20,
}

FREE_CREDITS = 200

# ── SQLite fallback (dev mode / no PostgreSQL) ───────────────────────────────

_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "mcp_keys.db"
_db: Optional[sqlite3.Connection] = None


def _get_db() -> sqlite3.Connection:
    """Get or create SQLite DB for API keys (development fallback)."""
    global _db
    if _db is not None:
        return _db

    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    _db = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    _db.row_factory = sqlite3.Row
    _db.execute("""
        CREATE TABLE IF NOT EXISTS mcp_api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL UNIQUE,
            api_key TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            credits INTEGER NOT NULL DEFAULT 200,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_used_at TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            total_credits_used INTEGER NOT NULL DEFAULT 0,
            total_credits_purchased INTEGER NOT NULL DEFAULT 0
        )
    """)
    _db.execute("""
        CREATE TABLE IF NOT EXISTS mcp_credit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key_id INTEGER NOT NULL,
            tool_name TEXT NOT NULL,
            credits_used INTEGER NOT NULL,
            credits_remaining INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    _db.commit()
    logger.info(f"[MCP/Auth] SQLite DB initialized: {_DB_PATH}")
    return _db


def _hash_password(password: str) -> str:
    """Hash password with SHA-256 + salt."""
    salt = os.getenv("MCP_AUTH_SALT", "stavagent-mcp-2026")
    return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()


def _generate_api_key() -> str:
    """Generate a unique API key."""
    return f"sk-stavagent-{secrets.token_hex(24)}"


# ── Public API ───────────────────────────────────────────────────────────────

def register(email: str, password: str) -> dict:
    """Register a new API user. Returns API key + initial credits."""
    db = _get_db()

    # Check if already exists
    existing = db.execute(
        "SELECT api_key, credits FROM mcp_api_keys WHERE user_email = ?",
        (email,),
    ).fetchone()
    if existing:
        return {
            "error": "Email already registered. Use /login to retrieve your key.",
            "status": "exists",
        }

    api_key = _generate_api_key()
    pw_hash = _hash_password(password)

    db.execute(
        "INSERT INTO mcp_api_keys (user_email, api_key, password_hash, credits) VALUES (?, ?, ?, ?)",
        (email, api_key, pw_hash, FREE_CREDITS),
    )
    db.commit()

    logger.info(f"[MCP/Auth] Registered: {email}")
    return {
        "api_key": api_key,
        "credits": FREE_CREDITS,
        "email": email,
        "status": "created",
    }


def login(email: str, password: str) -> dict:
    """Login and retrieve API key."""
    db = _get_db()
    pw_hash = _hash_password(password)

    row = db.execute(
        "SELECT api_key, credits, is_active FROM mcp_api_keys WHERE user_email = ? AND password_hash = ?",
        (email, pw_hash),
    ).fetchone()

    if not row:
        return {"error": "Invalid email or password.", "status": "invalid"}

    if not row["is_active"]:
        return {"error": "Account deactivated.", "status": "deactivated"}

    return {
        "api_key": row["api_key"],
        "credits": row["credits"],
        "email": email,
        "status": "ok",
    }


def check_credits(api_key: str, tool_name: str) -> dict:
    """Check if API key has enough credits for the tool.
    Returns {"ok": True} or {"error": "...", "ok": False}.
    """
    cost = TOOL_COSTS.get(tool_name, 0)

    # Free tools — always allowed, even without key
    if cost == 0:
        return {"ok": True, "cost": 0, "credits_remaining": None}

    # Paid tools require a valid key
    if not api_key:
        return {
            "ok": False,
            "cost": cost,
            "error": "API key required. Register at stavagent.cz/api-access",
        }

    db = _get_db()
    row = db.execute(
        "SELECT id, credits, is_active FROM mcp_api_keys WHERE api_key = ?",
        (api_key,),
    ).fetchone()

    if not row:
        return {
            "ok": False,
            "cost": cost,
            "error": "Invalid API key. Register at stavagent.cz/api-access",
        }

    if not row["is_active"]:
        return {"ok": False, "cost": cost, "error": "Account deactivated."}

    if row["credits"] < cost:
        return {
            "ok": False,
            "cost": cost,
            "credits_remaining": row["credits"],
            "error": f"Insufficient credits ({row['credits']} < {cost}). "
                     f"Top up at stavagent.cz/api-access",
        }

    # Deduct credits
    new_credits = row["credits"] - cost
    db.execute(
        "UPDATE mcp_api_keys SET credits = ?, last_used_at = datetime('now'), "
        "total_credits_used = total_credits_used + ? WHERE id = ?",
        (new_credits, cost, row["id"]),
    )
    db.execute(
        "INSERT INTO mcp_credit_log (api_key_id, tool_name, credits_used, credits_remaining) "
        "VALUES (?, ?, ?, ?)",
        (row["id"], tool_name, cost, new_credits),
    )
    db.commit()

    return {"ok": True, "cost": cost, "credits_remaining": new_credits}


def add_credits(email: str, amount: int) -> dict:
    """Add credits to a user account (called by billing webhook)."""
    db = _get_db()
    row = db.execute(
        "SELECT id, credits FROM mcp_api_keys WHERE user_email = ?",
        (email,),
    ).fetchone()

    if not row:
        logger.warning(f"[MCP/Auth] add_credits: unknown email {email}")
        return {"error": f"User not found: {email}", "status": "not_found"}

    new_credits = row["credits"] + amount
    db.execute(
        "UPDATE mcp_api_keys SET credits = ?, total_credits_purchased = total_credits_purchased + ? WHERE id = ?",
        (new_credits, amount, row["id"]),
    )
    db.commit()

    logger.info(f"[MCP/Auth] Added {amount} credits to {email}, new balance: {new_credits}")
    return {"credits": new_credits, "added": amount, "status": "ok"}


def get_credits(api_key: str) -> dict:
    """Get current credit balance."""
    db = _get_db()
    row = db.execute(
        "SELECT user_email, credits, total_credits_used, total_credits_purchased FROM mcp_api_keys WHERE api_key = ?",
        (api_key,),
    ).fetchone()

    if not row:
        return {"error": "Invalid API key.", "credits": 0}

    return {
        "email": row["user_email"],
        "credits": row["credits"],
        "total_used": row["total_credits_used"],
        "total_purchased": row["total_credits_purchased"],
    }


def oauth_token(client_id: str, client_secret: str) -> dict:
    """OAuth 2.0 client_credentials grant for ChatGPT integration.
    For simplicity, client_id == client_secret == api_key.
    """
    db = _get_db()
    # Accept either client_id or client_secret as the API key
    api_key = client_id or client_secret
    if not api_key:
        return {"error": "invalid_client", "error_description": "client_id required"}

    row = db.execute(
        "SELECT api_key, is_active FROM mcp_api_keys WHERE api_key = ?",
        (api_key,),
    ).fetchone()

    if not row or not row["is_active"]:
        return {"error": "invalid_client", "error_description": "Invalid API key"}

    return {
        "access_token": row["api_key"],
        "token_type": "bearer",
        "expires_in": 86400,
    }
