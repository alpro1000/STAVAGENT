"""mcp_soupis_handles store — owner isolation + TTL + purge (Postgres-backed).

Skips cleanly without DATABASE_URL (local dev); the CI Postgres service runs it.
Self-applies migrations 007 (mcp_api_keys — the FK target) + 014 (the handles
table), both idempotent, then seeds two api keys = two distinct owners.

The security-critical assertion: a handle owned by A reads as not-found for B —
same shape as "no such ref", no existence leak (docs/security/isolation_model.md).
"""

import os
import pathlib

import pytest

if not (os.getenv("DATABASE_URL") or os.getenv("MCP_DATABASE_URL")):
    pytest.skip("DATABASE_URL not set — Postgres soupis-handle tests skipped",
                allow_module_level=True)

from app.mcp import auth as mcp_auth  # noqa: E402
from app.mcp import soupis_handles  # noqa: E402

_MIG = pathlib.Path(__file__).resolve().parents[1] / "migrations"


def _apply(sql_file: str) -> None:
    conn = mcp_auth._get_db()
    with conn.cursor() as cur:
        cur.execute((_MIG / sql_file).read_text())
    conn.commit()


@pytest.fixture()
def two_owners():
    _apply("007_mcp_api_keys.sql")
    _apply("014_mcp_soupis_handles.sql")
    conn = mcp_auth._get_db()
    ids = []
    with conn.cursor() as cur:
        for email, key in (("soupis_test_a@x.test", "sk-stavagent-soupistestA"),
                           ("soupis_test_b@x.test", "sk-stavagent-soupistestB")):
            cur.execute(
                "INSERT INTO mcp_api_keys (user_email, api_key, password_hash, credits) "
                "VALUES (%s, %s, %s, 200) ON CONFLICT (api_key) DO NOTHING",
                (email, key, "x"),
            )
            cur.execute("SELECT id FROM mcp_api_keys WHERE api_key = %s", (key,))
            ids.append(cur.fetchone()["id"])
    conn.commit()

    def _wipe():
        c = mcp_auth._get_db()
        with c.cursor() as cur:
            cur.execute("DELETE FROM mcp_soupis_handles WHERE owner_id = ANY(%s)", (ids,))
        c.commit()

    _wipe()
    yield ids
    _wipe()


def test_owner_id_for_api_key_resolution(two_owners):
    a, _ = two_owners
    assert soupis_handles.owner_id_for_api_key("sk-stavagent-soupistestA") == a
    assert soupis_handles.owner_id_for_api_key("sk-stavagent-unknown-xyz") is None
    assert soupis_handles.owner_id_for_api_key(None) is None


def test_resolve_is_owner_scoped_no_leak(two_owners):
    a, b = two_owners
    ref = soupis_handles.save(
        a, {"items": [{"code": "421321109", "quantity": 5}], "total_items": 1},
        filename="s.xlsx", format_detected="soupis",
    )
    got = soupis_handles.resolve(ref, a)
    assert got and got["parsed_budget"]["items"][0]["quantity"] == 5
    assert got["filename"] == "s.xlsx"
    # owner B sees not-found — never A's blob, never a 403 that confirms it exists
    assert soupis_handles.resolve(ref, b) is None
    # unknown ref, and anonymous (owner None), both not-found
    assert soupis_handles.resolve("soupis-does-not-exist", a) is None
    assert soupis_handles.resolve(ref, None) is None


def test_expired_reads_as_none_and_purge_deletes(two_owners):
    a, _ = two_owners
    live = soupis_handles.save(a, {"items": [{"code": "1"}]}, ttl_hours=24)
    dead = soupis_handles.save(a, {"items": [{"code": "2"}]}, ttl_hours=-1)  # already past
    assert soupis_handles.resolve(dead, a) is None       # expired → not-found
    assert soupis_handles.resolve(live, a) is not None
    purged = soupis_handles.purge_expired()
    assert purged >= 1
    assert soupis_handles.resolve(live, a) is not None   # live survives the sweep


def test_new_ref_per_save_no_dedup(two_owners):
    a, _ = two_owners
    body = {"items": [{"code": "1"}], "total_items": 1}
    r1 = soupis_handles.save(a, body)
    r2 = soupis_handles.save(a, body)
    assert r1 != r2 and r1.startswith("soupis-") and len(r1) == len("soupis-") + 32
