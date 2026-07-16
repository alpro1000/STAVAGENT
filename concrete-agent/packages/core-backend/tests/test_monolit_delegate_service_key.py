"""HOTFIX-2 (2026-07-16) — the Core→Monolit MCP delegate authenticates.

The Monolit compute surface (/api/calculate, /api/calculate-from-passport) is
now fail-closed behind `requireAuthOrServiceKey`. This delegate must attach the
SHARED ecosystem service key (same secret the Monolit→Portal write-back uses),
or calculate_from_passport gets a 401.

Alexander's AC (2026-07-16): a delegate-path test so a future key rotation that
drops the header fails HERE, not silently in front of an MCP user.

These tests exercise the REAL `_http_post` (not the monkeypatch seam) with a
capturing httpx client, so they pin the actual header-attach behavior.
Hermetic: the fake client never touches the network.
"""
import httpx
import pytest

from app.mcp.tools import monolit_delegate as md


class _CapturingClient:
    """Fake httpx.AsyncClient that records the kwargs of the last post()."""

    last_kwargs: dict = {}

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, **kwargs):
        _CapturingClient.last_kwargs = {"url": url, **kwargs}

        class _Resp:
            status_code = 200

            @staticmethod
            def json():
                return {"ok": True}

        return _Resp()


@pytest.fixture(autouse=True)
def _capture(monkeypatch):
    _CapturingClient.last_kwargs = {}
    monkeypatch.setattr(httpx, "AsyncClient", _CapturingClient)


@pytest.mark.asyncio
async def test_http_post_sends_service_key_when_set(monkeypatch):
    monkeypatch.setenv("SERVICE_API_KEY", "shared-eco-key-123")
    status, body = await md._http_post("/api/calculate", {"volume_m3": 10})
    assert status == 200
    headers = _CapturingClient.last_kwargs.get("headers") or {}
    assert headers.get("X-Service-Key") == "shared-eco-key-123"


@pytest.mark.asyncio
async def test_http_post_omits_header_when_key_absent(monkeypatch):
    monkeypatch.delenv("SERVICE_API_KEY", raising=False)
    status, body = await md._http_post("/api/calculate", {"volume_m3": 10})
    assert status == 200
    headers = _CapturingClient.last_kwargs.get("headers") or {}
    # No fabricated/empty key — honest omission → Monolit 401 (debuggable),
    # never a silent wrong result.
    assert "X-Service-Key" not in headers


@pytest.mark.asyncio
async def test_service_key_read_at_call_time_not_import(monkeypatch):
    """Rotation without a process restart works: the key is read per call."""
    monkeypatch.setenv("SERVICE_API_KEY", "rotated-key-456")
    await md._http_post("/api/calculate-from-passport", {"_meta": {}})
    headers = _CapturingClient.last_kwargs.get("headers") or {}
    assert headers.get("X-Service-Key") == "rotated-key-456"
