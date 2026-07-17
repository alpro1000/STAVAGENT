"""Tubus OTSKP binding — micro-PR pins (live find 2026-07-17, GO Alexander).

Prod bound tubus výztuž to 15411 «ZAJIŠTĚNÍ VÝRUBU TUNELU Z OCEL PŘÍHRAD…»
(60 390 Kč/t → 8,3 M Kč row) and beton to 743742 «ROZVADĚČ — ZÁBRANA PROTI
NAJETÍ…» at conf 0.78 — the sebevědomě-špatně class. Mechanism: no
_OTSKP_QUERY_NOUN entry → label-head fallback «Uzavřený rám (tubus) — podchod»
poisoned the fulltext; prefab atoms fell to work-type 'ostatni'.

Pins here (fixes ratified as the micro-PR scope):
  1. canonical noun: tubus beton → «MOSTNÍ RÁMOVÉ KONSTRUKCE ZE ŽELEZOBETONU»
     family 389325; výztuž → 389365 (verbatim real rows from 2025_03 OTSKP);
  2. prefab atoms montáž/zálivka ≠ 'ostatni' — and DELIBERATELY narrow: the
     římsa traveler row «Římsový vozík — montáž» must STAY 'ostatni' (no
     collateral binding drift on an old type);
  3. NAMED negative pins: 15411 / 743742 / 741C03 must never appear — the fake
     catalog SERVES the nonsense for any polluted query, so a regression that
     re-issues a garbage query resurfaces the exact prod defect by name;
  4. floor hardening: unmapped type + polluted label fallback → NO query at
     all, honest not_verified + reason (never a confident code).

Hermetic: find_otskp_code is monkeypatched with verbatim-real rows (the
golden-ranking convention); one optional integration test runs the REAL
in-memory XML catalog when present.
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app.mcp.tools.otskp as otskp_mod  # noqa: E402
from app.mcp.tools.breakdown import (  # noqa: E402
    _canonical_query,
    create_work_breakdown,
)
from app.services.catalog_matching import classify_work_type  # noqa: E402

# Verbatim rows from 2025_03_otskp.xml (name + MJ + price untouched).
ROW_BETON = {"code": "389325", "description": "MOSTNÍ RÁMOVÉ KONSTRUKCE ZE ŽELEZOBETONU C30/37",
             "unit": "M3", "unit_price_czk": 13886.89, "confidence": 0.77}
ROW_VYZTUZ = {"code": "389365", "description": "VÝZTUŽ MOSTNÍ RÁMOVÉ KONSTRUKCE Z OCELI 10505, B500B",
              "unit": "T", "unit_price_czk": 42334.95, "confidence": 0.79}
# The PROD NONSENSE (named regression targets) — served ONLY for polluted queries.
ROW_TUNEL = {"code": "15411", "description": "ZAJIŠTĚNÍ VÝRUBU TUNELU Z OCEL PŘÍHRAD OBLOUKU V HOR SUCHÉ",
             "unit": "T", "unit_price_czk": 60390.48, "confidence": 0.78}
ROW_ROZVADEC = {"code": "743742", "description": "ROZVADĚČ - ZÁBRANA PROTI NAJETÍ KONSTRUKCE TRUBKOVÁ",
                "unit": "KUS", "unit_price_czk": 12605.39, "confidence": 0.78}
NONSENSE_CODES = {"15411", "743742", "741C03"}


def _fake_find(monkeypatch, calls):
    async def fake(query, max_results=5):
        calls.append(query)
        if "(" in query or "—" in query:
            # Simulate the prod defect: fulltext over a polluted query returns
            # confident nonsense. A regression re-issuing such a query for the
            # tubus resurfaces 15411/743742 and fails the named negative pin.
            return {"results": [ROW_TUNEL, ROW_ROZVADEC]}
        if "výztuž" in query and "rámové" in query:
            return {"results": [ROW_VYZTUZ]}
        if "beton" in query and "železobetonu" in query:
            return {"results": [ROW_BETON]}
        return {"results": []}

    monkeypatch.setattr(otskp_mod, "find_otskp_code", fake)
    return calls


# ── 1. canonical queries ─────────────────────────────────────────────────────

def test_canonical_queries_for_tubus():
    assert _canonical_query("beton", "uzavreny_ram_tubus") == \
        "beton mostní rámové konstrukce ze železobetonu"
    assert _canonical_query("vyztuz", "uzavreny_ram_tubus") == \
        "výztuž mostní rámové konstrukce z oceli"


# ── 2. prefab work-types, narrow (collateral pins included) ─────────────────

def test_prefab_work_types_and_collateral_stability():
    assert classify_work_type(
        "Montáž prefabrikovaných rámových dílců — Uzavřený rám (tubus)") == "montaz_dilcu"
    assert classify_work_type(
        "Zálivka spár mezi prefabrikovanými dílci C30/37") == "zalivka"
    # Collateral pins: the narrow stems must NOT recapture old rows.
    assert classify_work_type("Římsový vozík — montáž") == "ostatni"
    # Pre-existing routing pinned AS-IS: «ASFALTOVÉ» hits the izolace rule
    # (position 2, before demolice AND before the new zalivka stem) — the new
    # rule must not move it.
    assert classify_work_type(
        "ODSTRANĚNÍ ASFALTOVÉ ZÁLIVKY ZE SPÁRY VYTRŽENÍM") == "izolace"
    assert classify_work_type("DEMONTÁŽ prefabrikovaného zábradlí") == "demolice"


# ── 3. golden + named-negative binding pins ──────────────────────────────────

@pytest.mark.asyncio
async def test_monolith_tubus_binds_389325_and_389365_never_nonsense(monkeypatch):
    calls = _fake_find(monkeypatch, [])
    result = await create_work_breakdown(
        elements=[{
            "name": "Podchod pro pěší — uzavřený železobetonový rám",
            "element_type": "uzavreny_ram_tubus",
            "concrete_class": "C30/37",
            "volume_m3": 1046.8,
            "rebar_tons": 137.161,
        }],
        catalog="otskp",
        mode="work_with_catalog",
    )
    by_code_status = {i["work_description"]: i for i in result["items"]}
    beton = next(i for i in result["items"] if i["work_description"].startswith("Beton "))
    vyztuz = next(i for i in result["items"] if i["work_description"].startswith("Výztuž "))
    assert beton["otskp_code"] == "389325"
    assert beton["unit_price_czk"] == 13886.89
    assert vyztuz["otskp_code"] == "389365"
    # Named negative pin: the prod nonsense must never reappear anywhere.
    bound = {i.get("otskp_code") for i in result["items"]}
    assert bound.isdisjoint(NONSENSE_CODES), bound
    # And no polluted query was ever issued for the tubus.
    assert all("(" not in q and "—" not in q for q in calls), calls
    del by_code_status


@pytest.mark.asyncio
async def test_prefab_atoms_bundle_into_dilce_item_no_fulltext_guess(monkeypatch):
    calls = _fake_find(monkeypatch, [])
    result = await create_work_breakdown(
        elements=[{
            "name": "Rámový propustek z prefabrikovaných dílců IZM",
            "element_type": "uzavreny_ram_tubus",
            "construction_mode": "prefab",
            "pieces_count": 12,
            "grout_volume_m3": 4.8,
        }],
        catalog="otskp",
        mode="work_with_catalog",
    )
    assert len(result["items"]) == 2
    for item in result["items"]:
        # Catalog-TRUE bundling per the 389125 spec («…včetně montáže dílců» +
        # «výplň, těsnění a tmelení spár a spojů») — deterministic, conf 1.0.
        assert item["code_status"] == "bundled"
        assert item["otskp_code"] is None
        assert "dílc" in item["code_note"]
        assert item["code_confidence"] == 1.0
    # No fulltext guess was attempted for the prefab atoms at all.
    assert calls == []


# ── 4. floor hardening: polluted fallback → honest no-query ─────────────────

def test_polluted_label_fallback_returns_no_query(monkeypatch):
    from app.mcp.tools import classifier as clf

    monkeypatch.setitem(
        clf.ELEMENT_TYPES, "fiktivni_typ",
        {**clf.ELEMENT_TYPES["jine"], "label_cs": "Fiktivní typ (zvláštní) — cosi"},
    )
    assert _canonical_query("beton", "fiktivni_typ") is None
    # Clean unmapped labels keep the fallback path (no behavior change).
    assert _canonical_query("beton", "stena") is not None
    # Grandfathered polluted fallbacks (sloup/zaklady/sachta/gabionova_zed)
    # keep TODAY'S behavior — sequential discipline: their binding path is not
    # silently changed under this micro-PR (BACKLOG otskp-binding-fallback-heads).
    assert _canonical_query("beton", "sloup") == "beton Sloup (pozemní)"
    assert _canonical_query("beton", "zaklady") is not None


@pytest.mark.asyncio
async def test_polluted_fallback_binds_honest_not_verified(monkeypatch):
    from app.mcp.tools import classifier as clf

    monkeypatch.setitem(
        clf.ELEMENT_TYPES, "fiktivni_typ",
        {**clf.ELEMENT_TYPES["jine"], "label_cs": "Fiktivní typ (zvláštní) — cosi"},
    )
    calls = _fake_find(monkeypatch, [])
    result = await create_work_breakdown(
        elements=[{
            "name": "Beton fiktivní konstrukce",
            "element_type": "fiktivni_typ",
            "volume_m3": 10.0,
        }],
        catalog="otskp",
        mode="work_with_catalog",
    )
    beton = next(i for i in result["items"] if i["work_description"].startswith("Beton "))
    assert beton["otskp_code"] is None
    assert beton["code_status"] == "not_verified"
    assert "zamusořen" in beton["code_note"]
    assert calls == []  # the garbage query was never issued


# ── 5. REAL-catalog integration golden (in-memory XML when present) ─────────

_XML = Path(__file__).resolve().parent.parent / "app" / "knowledge_base" / \
    "B1_otkskp_codes" / "2025_03_otskp.xml"


@pytest.mark.skipif(not _XML.exists(), reason="OTSKP XML not present")
@pytest.mark.asyncio
async def test_real_catalog_golden_queries_hit_389x_family():
    from app.mcp.tools.otskp import find_otskp_code

    r_beton = await find_otskp_code(
        "beton mostní rámové konstrukce ze železobetonu", max_results=5)
    r_vyztuz = await find_otskp_code(
        "výztuž mostní rámové konstrukce z oceli", max_results=5)
    top_beton = r_beton["results"][0]
    top_vyztuz = r_vyztuz["results"][0]
    assert top_beton["code"].startswith("3893"), top_beton
    assert top_vyztuz["code"] == "389365", top_vyztuz
    all_codes = {c["code"] for c in r_beton["results"] + r_vyztuz["results"]}
    assert all_codes.isdisjoint(NONSENSE_CODES), all_codes
