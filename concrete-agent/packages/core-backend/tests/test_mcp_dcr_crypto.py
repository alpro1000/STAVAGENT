"""
Tests for DCR / OAuth crypto helpers in `app.mcp.auth`.

These are pure-function tests — no Postgres / network required. They
cover the cryptographic primitives shipped for Dynamic Client
Registration (RFC 7591) and OAuth 2.0 token issuance (RFC 6749):

  - generate_salt: entropy + length + uniqueness
  - hash_client_secret: determinism, salt-as-bytes / salt-as-hex parity
  - verify_client_secret: correct verify, wrong-secret reject, wrong-salt
                          reject, constant-time compare via hmac
  - generate_client_id / client_secret / access_token / refresh_token:
                          prefix + length + entropy (uniqueness over many
                          samples) + character set

Reference: migrations/009_mcp_oauth_clients.sql + 011_mcp_oauth_tokens.sql
"""

import hmac
import re

import pytest

from app.mcp.auth import (
    generate_access_token,
    generate_client_id,
    generate_client_secret,
    generate_refresh_token,
    generate_salt,
    hash_client_secret,
    verify_client_secret,
)


# ── generate_salt ────────────────────────────────────────────────────────────


def test_generate_salt_default_length_is_16_bytes():
    """128-bit salt per OWASP Password Storage Cheat Sheet."""
    assert len(generate_salt()) == 16


def test_generate_salt_custom_length():
    """Caller can request a longer salt for high-value secrets."""
    assert len(generate_salt(32)) == 32
    assert len(generate_salt(8)) == 8


def test_generate_salt_returns_bytes_not_str():
    """Raw bytes, not hex — callers .hex() for storage."""
    assert isinstance(generate_salt(), bytes)


def test_generate_salt_unique_across_calls():
    """1000 samples, all distinct. ~10⁻³⁰ collision probability for 128 bits."""
    salts = {generate_salt() for _ in range(1000)}
    assert len(salts) == 1000


# ── hash_client_secret ───────────────────────────────────────────────────────


def test_hash_client_secret_deterministic():
    """Same (secret, salt) → same hash. Required for verify."""
    salt = b"\x00" * 16
    assert hash_client_secret("dcs-abc123", salt) == hash_client_secret("dcs-abc123", salt)


def test_hash_client_secret_salt_changes_output():
    """Different salt → different hash even with identical secret."""
    s1 = generate_salt()
    s2 = generate_salt()
    assert hash_client_secret("dcs-abc123", s1) != hash_client_secret("dcs-abc123", s2)


def test_hash_client_secret_accepts_bytes_salt():
    """Storage may pass raw bytes — must work."""
    salt = b"\x01" * 16
    h = hash_client_secret("secret", salt)
    assert len(h) == 64  # SHA-256 hex = 64 chars
    assert re.fullmatch(r"[0-9a-f]{64}", h)


def test_hash_client_secret_accepts_hex_salt():
    """Storage normally hands back .hex() from DB — must also work."""
    salt_bytes = b"\x02" * 16
    h_bytes = hash_client_secret("secret", salt_bytes)
    h_hex = hash_client_secret("secret", salt_bytes.hex())
    assert h_bytes == h_hex


def test_hash_client_secret_returns_64_hex_chars():
    """SHA-256 output = 32 bytes = 64 hex chars, lowercase."""
    h = hash_client_secret("anything", generate_salt())
    assert re.fullmatch(r"[0-9a-f]{64}", h)


def test_hash_client_secret_different_secret_different_hash():
    """Output is sensitive to secret bytes (sanity check the hash isn't a no-op)."""
    salt = generate_salt()
    assert hash_client_secret("secret-a", salt) != hash_client_secret("secret-b", salt)


# ── verify_client_secret ────────────────────────────────────────────────────


def test_verify_client_secret_correct():
    """Round-trip: hash then verify the same input → True."""
    secret = generate_client_secret()
    salt = generate_salt()
    h = hash_client_secret(secret, salt)
    assert verify_client_secret(secret, h, salt) is True


def test_verify_client_secret_wrong_secret_rejected():
    """Tampered secret → False."""
    salt = generate_salt()
    h = hash_client_secret("dcs-correct", salt)
    assert verify_client_secret("dcs-wrong", h, salt) is False


def test_verify_client_secret_wrong_salt_rejected():
    """Same secret, different salt → False. (Defends against salt swap.)"""
    h = hash_client_secret("dcs-correct", generate_salt())
    assert verify_client_secret("dcs-correct", h, generate_salt()) is False


def test_verify_client_secret_wrong_hash_rejected():
    """Tampered hash → False. (Defends against hash flip in DB.)"""
    salt = generate_salt()
    h = hash_client_secret("dcs-correct", salt)
    # Flip one hex char in the middle
    tampered = h[:30] + ("e" if h[30] != "e" else "f") + h[31:]
    assert verify_client_secret("dcs-correct", tampered, salt) is False


def test_verify_client_secret_uses_compare_digest(monkeypatch):
    """Verify routes through hmac.compare_digest, not Python's `==`.

    Without constant-time compare, an attacker could binary-search the
    hash by measuring response latency byte-by-byte. We can't directly
    test timing in a unit test, but we can verify the helper is wired
    to compare_digest by intercepting the call.
    """
    salt = generate_salt()
    h = hash_client_secret("secret", salt)

    calls = []
    real_compare = hmac.compare_digest

    def spy_compare(a, b):
        calls.append((a, b))
        return real_compare(a, b)

    monkeypatch.setattr("app.mcp.auth.hmac.compare_digest", spy_compare)
    assert verify_client_secret("secret", h, salt) is True
    assert len(calls) == 1, "verify_client_secret must call hmac.compare_digest exactly once"


def test_verify_client_secret_accepts_hex_salt():
    """Storage hands back hex strings — verify path must accept them."""
    salt = generate_salt()
    h = hash_client_secret("secret", salt)
    assert verify_client_secret("secret", h, salt.hex()) is True


# ── generate_client_id ──────────────────────────────────────────────────────


def test_generate_client_id_format():
    """dcr-{24 hex chars}."""
    cid = generate_client_id()
    assert re.fullmatch(r"dcr-[0-9a-f]{24}", cid), f"Bad client_id format: {cid}"


def test_generate_client_id_unique_over_1000_samples():
    """96-bit entropy → collision probability negligible at this scale."""
    ids = {generate_client_id() for _ in range(1000)}
    assert len(ids) == 1000


# ── generate_client_secret ──────────────────────────────────────────────────


def test_generate_client_secret_format():
    """dcs-{48 hex chars}."""
    sec = generate_client_secret()
    assert re.fullmatch(r"dcs-[0-9a-f]{48}", sec), f"Bad client_secret format: {sec}"


def test_generate_client_secret_unique_over_1000_samples():
    """192-bit entropy."""
    secs = {generate_client_secret() for _ in range(1000)}
    assert len(secs) == 1000


# ── generate_access_token ───────────────────────────────────────────────────


def test_generate_access_token_format():
    """sat-{48 hex chars} — distinct prefix from sk-stavagent- and srt-."""
    tok = generate_access_token()
    assert re.fullmatch(r"sat-[0-9a-f]{48}", tok), f"Bad access_token format: {tok}"


def test_generate_access_token_unique_over_1000_samples():
    secs = {generate_access_token() for _ in range(1000)}
    assert len(secs) == 1000


def test_access_token_distinct_prefix_from_legacy_api_key():
    """Middleware routing depends on this: sat-* → mcp_oauth_tokens,
    sk-stavagent-* → mcp_api_keys legacy path. Collision would break
    bearer dispatch."""
    tok = generate_access_token()
    assert not tok.startswith("sk-stavagent-")
    assert tok.startswith("sat-")


# ── generate_refresh_token ──────────────────────────────────────────────────


def test_generate_refresh_token_format():
    """srt-{48 hex chars}."""
    tok = generate_refresh_token()
    assert re.fullmatch(r"srt-[0-9a-f]{48}", tok), f"Bad refresh_token format: {tok}"


def test_generate_refresh_token_unique_over_1000_samples():
    toks = {generate_refresh_token() for _ in range(1000)}
    assert len(toks) == 1000


def test_refresh_token_distinct_from_access_token():
    """Different prefix lets storage + middleware tell them apart at a glance."""
    assert generate_refresh_token().startswith("srt-")
    assert generate_access_token().startswith("sat-")


# ── Cross-prefix collision check ────────────────────────────────────────────


def test_all_four_prefixes_disjoint():
    """No accidental prefix sharing between client_id / client_secret /
    access_token / refresh_token. Middleware routing + log greppability
    depend on this."""
    samples = {
        "client_id": generate_client_id(),
        "client_secret": generate_client_secret(),
        "access_token": generate_access_token(),
        "refresh_token": generate_refresh_token(),
    }
    prefixes = {name: val.split("-", 1)[0] for name, val in samples.items()}
    assert prefixes == {
        "client_id": "dcr",
        "client_secret": "dcs",
        "access_token": "sat",
        "refresh_token": "srt",
    }
    # And all four are distinct
    assert len(set(prefixes.values())) == 4
