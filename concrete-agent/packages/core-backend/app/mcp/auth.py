"""
MCP Auth + Credit System

Handles API key registration, authentication, and per-tool credit billing.
Stores keys in PostgreSQL (mcp_api_keys table). Falls back to SQLite
store if DB is unavailable (development mode).

Security:
- bcrypt password hashing with per-user random salt
- Thread-safe SQLite via per-thread connection pool
- Atomic credit deduction (UPDATE WHERE credits >= cost) prevents double-spending
- Rate limiting on auth endpoints (in-memory, per-IP)

Free tools (OTSKP, classify) work without any authentication.
Paid tools require a valid API key with sufficient credits.
"""

import logging
import os
import secrets
import sqlite3
import threading
import time
from collections import defaultdict
from pathlib import Path
from typing import Optional

import bcrypt

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

# ── Rate limiter (in-memory, per-IP) ────────────────────────────────────────

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_rate_lock = threading.Lock()
RATE_LIMIT_MAX = 10  # max attempts per window
RATE_LIMIT_WINDOW = 60  # seconds


def _check_rate_limit(identifier: str) -> bool:
    """Return True if request is allowed, False if rate-limited."""
    now = time.monotonic()
    with _rate_lock:
        attempts = _rate_limit_store[identifier]
        # Prune old entries
        _rate_limit_store[identifier] = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
        if len(_rate_limit_store[identifier]) >= RATE_LIMIT_MAX:
            return False
        _rate_limit_store[identifier].append(now)
        return True


# ── Thread-safe SQLite connection pool ───────────────────────────────────────

_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "mcp_keys.db"
_db_pool: dict[int, sqlite3.Connection] = {}
_pool_lock = threading.Lock()


def _get_db() -> sqlite3.Connection:
    """Get thread-local SQLite connection (thread-safe pool)."""
    tid = threading.get_ident()
    with _pool_lock:
        if tid in _db_pool:
            return _db_pool[tid]

    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for better concurrent read performance
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS mcp_credit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key_id INTEGER NOT NULL REFERENCES mcp_api_keys(id) ON DELETE CASCADE,
            tool_name TEXT NOT NULL,
            credits_used INTEGER NOT NULL,
            credits_remaining INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.commit()

    with _pool_lock:
        _db_pool[tid] = conn
    logger.info(f"[MCP/Auth] SQLite connection for thread {tid}: {_DB_PATH}")
    return conn


def _hash_password(password: str) -> str:
    """Hash password with bcrypt (per-user random salt, adaptive cost)."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _generate_api_key() -> str:
    """Generate a unique API key."""
    return f"sk-stavagent-{secrets.token_hex(24)}"


# ── Public API ───────────────────────────────────────────────────────────────

def register(email: str, password: str, client_ip: str = "unknown") -> dict:
    """Register a new API user. Returns API key + initial credits."""
    if not _check_rate_limit(f"register:{client_ip}"):
        return {"error": "Too many registration attempts. Try again later.", "status": "rate_limited"}

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


def login(email: str, password: str, client_ip: str = "unknown") -> dict:
    """Login and retrieve API key."""
    if not _check_rate_limit(f"login:{client_ip}"):
        return {"error": "Too many login attempts. Try again later.", "status": "rate_limited"}

    db = _get_db()

    row = db.execute(
        "SELECT api_key, credits, is_active, password_hash FROM mcp_api_keys WHERE user_email = ?",
        (email,),
    ).fetchone()

    if not row or not _verify_password(password, row["password_hash"]):
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

    Uses atomic UPDATE WHERE credits >= cost to prevent double-spending
    from concurrent requests. Returns {"ok": True} or {"error": "..."}.
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

    # Atomic deduction: UPDATE only succeeds if credits >= cost
    # This prevents race conditions from concurrent requests
    cursor = db.execute(
        "UPDATE mcp_api_keys SET "
        "credits = credits - ?, "
        "last_used_at = datetime('now'), "
        "total_credits_used = total_credits_used + ? "
        "WHERE api_key = ? AND is_active = 1 AND credits >= ?",
        (cost, cost, api_key, cost),
    )

    if cursor.rowcount == 0:
        # Deduction failed — find out why
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

        return {
            "ok": False,
            "cost": cost,
            "credits_remaining": row["credits"],
            "error": f"Insufficient credits ({row['credits']} < {cost}). "
                     f"Top up at stavagent.cz/api-access",
        }

    # Deduction succeeded — read new balance and log
    row = db.execute(
        "SELECT id, credits FROM mcp_api_keys WHERE api_key = ?",
        (api_key,),
    ).fetchone()
    new_credits = row["credits"]

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

    cursor = db.execute(
        "UPDATE mcp_api_keys SET credits = credits + ?, "
        "total_credits_purchased = total_credits_purchased + ? "
        "WHERE user_email = ?",
        (amount, amount, email),
    )

    if cursor.rowcount == 0:
        logger.warning(f"[MCP/Auth] add_credits: unknown email {email}")
        return {"error": f"User not found: {email}", "status": "not_found"}

    db.commit()
    row = db.execute(
        "SELECT credits FROM mcp_api_keys WHERE user_email = ?",
        (email,),
    ).fetchone()

    logger.info(f"[MCP/Auth] Added {amount} credits to {email}, new balance: {row['credits']}")
    return {"credits": row["credits"], "added": amount, "status": "ok"}


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
    """OAuth 2.0 client_credentials grant for ChatGPT integration."""
    db = _get_db()
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
