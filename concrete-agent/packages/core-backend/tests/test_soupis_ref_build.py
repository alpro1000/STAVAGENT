"""build_bridge_passport soupis_ref path — owner isolation + provenance (hermetic).

No DB: the store + identity seams are monkeypatched, so these run everywhere and
pin the TOOL's isolation behavior (the DB-level owner scoping is covered by
test_soupis_handles.py against Postgres). The security-critical assertions:
a cross-owner / anonymous ref is a typed not-found, never someone else's blob.
"""

import asyncio
import json

from app.models.bridge_passport import BridgePassport

TZ_TEXT = """--- PAGE 1 ---
A. ZÁKLADNÍ ÚDAJE
Název objektu: SO 202 – Most
C. SPECIFIKACE BETONU – MATERIÁLY
Nosná konstrukce (NK) C35/45 XF2
--- PAGE 2 ---
"""

_SOUPIS = {
    "items": [{"code": "421321109", "description": "Nosná konstrukce mostovka",
               "unit": "m3", "quantity": 2697.941}],
    "total_items": 1, "format_detected": "soupis",
}


def _build(**kw):
    from app.mcp.tools.passport_build import build_bridge_passport
    return asyncio.run(build_bridge_passport(**kw))


def test_soupis_ref_resolves_owner_scoped_and_cites_source(monkeypatch):
    from app.mcp import identity, soupis_handles
    monkeypatch.setattr(identity, "current_owner_api_key", lambda: "sk-owner-A")
    monkeypatch.setattr(soupis_handles, "owner_id_for_api_key",
                        lambda k: 42 if k == "sk-owner-A" else None)

    def fake_resolve(ref, owner_id):
        if ref == "soupis-good" and owner_id == 42:
            return {"parsed_budget": _SOUPIS, "filename": "E_Soupis.xlsx",
                    "total_items": 1}
        return None
    monkeypatch.setattr(soupis_handles, "resolve", fake_resolve)

    out = _build(tz_text=TZ_TEXT, soupis_ref="soupis-good")
    assert "error" not in out, out
    p = out["passport"]
    BridgePassport.model_validate(p)
    # quantities cite their source (Pattern 2/29), not just "join"
    assert p["quantities"]["source"] == "soupis join: E_Soupis.xlsx (1 items)"
    assert p["_meta"]["soupis"] == {"ref": "soupis-good", "filename": "E_Soupis.xlsx",
                                    "total_items": 1}
    # the deck actually got its quantity from the resolved soupis
    deck = next(it for it in p["quantities"]["items"]
                if it["element"] == "superstructure_deck")
    assert deck.get("volume_m3")


def test_cross_owner_ref_is_typed_not_found(monkeypatch):
    """A ref that belongs to someone else resolves to None → typed error, never
    the victim's blob and never a 403 that confirms it exists."""
    from app.mcp import identity, soupis_handles
    monkeypatch.setattr(identity, "current_owner_api_key", lambda: "sk-attacker")
    monkeypatch.setattr(soupis_handles, "owner_id_for_api_key", lambda k: 99)
    monkeypatch.setattr(soupis_handles, "resolve", lambda ref, oid: None)

    out = _build(tz_text=TZ_TEXT, soupis_ref="soupis-victims-ref")
    assert out["error"] == "soupis_ref_invalid"
    json.dumps(out)


def test_anonymous_caller_ref_rejected(monkeypatch):
    """No verified owner → the ref can't resolve → typed error."""
    from app.mcp import identity
    monkeypatch.setattr(identity, "current_owner_api_key", lambda: None)
    out = _build(tz_text=TZ_TEXT, soupis_ref="soupis-x")
    assert out["error"] == "soupis_ref_invalid"


def test_owner_id_routes_bound_oauth_token_through_resolver(monkeypatch):
    """A user-bound sat-* OAuth bearer must resolve to its underlying sk-* owner
    on the REST surface too (parity with the /mcp tool path), via the canonical
    dual-prefix resolver — not only bare sk-* keys."""
    import pytest
    pytest.importorskip("bcrypt")  # app.mcp.auth imports bcrypt at module level
    from app.mcp import auth as mcp_auth
    from app.mcp import soupis_handles

    monkeypatch.setattr(
        mcp_auth, "resolve_bearer_token",
        lambda tok: {"user_api_key": "sk-stavagent-bound"} if tok == "sat-abc"
        else {"user_api_key": None},
    )
    monkeypatch.setattr(
        mcp_auth, "_resolve_initial_access_user_id",
        lambda k: 77 if k == "sk-stavagent-bound" else None,
    )
    assert soupis_handles.owner_id_for_api_key("sat-abc") == 77


def test_owner_id_public_dcr_and_anonymous_are_not_owners(monkeypatch):
    """public-DCR / revoked / expired sat-* (user_api_key NULL) and no bearer at
    all resolve to None — never an owner (fail-closed)."""
    import pytest
    pytest.importorskip("bcrypt")  # app.mcp.auth imports bcrypt at module level
    from app.mcp import auth as mcp_auth
    from app.mcp import soupis_handles

    monkeypatch.setattr(mcp_auth, "resolve_bearer_token",
                        lambda tok: {"user_api_key": None})
    assert soupis_handles.owner_id_for_api_key("sat-public-dcr") is None
    assert soupis_handles.owner_id_for_api_key(None) is None
    assert soupis_handles.owner_id_for_api_key("") is None


def test_soupis_ref_takes_precedence_over_base64(monkeypatch):
    """When both are given, soupis_ref wins (base64 can't carry a real file)."""
    from app.mcp import identity, soupis_handles
    monkeypatch.setattr(identity, "current_owner_api_key", lambda: "sk-owner-A")
    monkeypatch.setattr(soupis_handles, "owner_id_for_api_key", lambda k: 7)
    monkeypatch.setattr(soupis_handles, "resolve",
                        lambda ref, oid: {"parsed_budget": _SOUPIS,
                                          "filename": "ref.xlsx", "total_items": 1})
    out = _build(tz_text=TZ_TEXT, soupis_ref="soupis-good",
                 soupis_file_base64="!!!not-base64!!!", soupis_filename="ignored.xlsx")
    assert "error" not in out, out
    assert out["passport"]["_meta"]["soupis"]["filename"] == "ref.xlsx"
