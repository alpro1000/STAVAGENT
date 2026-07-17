"""Tubus OTSKP binding — micro-PR pins (live find 2026-07-17 + review verdicts).

Prod bound tubus výztuž to 15411 «ZAJIŠTĚNÍ VÝRUBU TUNELU Z OCEL PŘÍHRAD…»
(60 390 Kč/t → 8,3 M Kč row) and beton to 743742 «ROZVADĚČ — ZÁBRANA PROTI
NAJETÍ…» at conf 0.78 — the sebevědomě-špatně class. Root: no
_OTSKP_QUERY_NOUN entry → polluted label-head fallback poisoned the fulltext.

Review verdicts (Alexander 2026-07-17) pinned here:
  1. canonical noun: tubus beton → 389325, výztuž → 389365 (verbatim rows);
  2. NO lexical work-type rules for template atoms — prefab handling keys off
     the item's vocabulary_code + element_type + construction_mode; the
     retired global stems are pinned NOT to exist via three live phrases
     («Zálivka betonová monolitická» → beton; 931326 «TĚSNĚNÍ … ZÁLIVKOU» →
     ostatni; «beton zálivky» → beton) — the revert must not drift either;
  3. NAMED negative pins: 15411 / 743742 / 741C03 — the fake catalog SERVES
     all three for any polluted query, so a regression that re-issues a
     garbage query resurfaces the exact prod defect by name;
  4. prefab plan carries a PRICED CARRIER row (Dodávka a montáž dílců, m³ —
     finding 5: the grout bundled-note must point at an IN-LIST row) while a
     MONOLITHIC tubus grout atom never enters the prefab bundle (finding 7);
  5. floor hardening incl. the ÚRS branch (finding 4) and the full dash class
     (finding 6); the None contract is guarded in dotazy (finding 3).

Hermetic: find_otskp_code monkeypatched with verbatim-real rows; one optional
integration test runs the REAL in-memory XML catalog when present.
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
ROW_DILCE = {"code": "38912", "description": "MOSTNÍ RÁMOVÉ KONSTRUKCE Z DÍLCŮ ŽELEZOBETONOVÝCH",
             "unit": "M3", "unit_price_czk": 19019.35, "confidence": 0.9}
# The PROD NONSENSE (named regression targets) — served ONLY for polluted queries.
ROW_TUNEL = {"code": "15411", "description": "ZAJIŠTĚNÍ VÝRUBU TUNELU Z OCEL PŘÍHRAD OBLOUKU V HOR SUCHÉ",
             "unit": "T", "unit_price_czk": 60390.48, "confidence": 0.78}
ROW_ROZVADEC = {"code": "743742", "description": "ROZVADĚČ - ZÁBRANA PROTI NAJETÍ KONSTRUKCE TRUBKOVÁ",
                "unit": "KUS", "unit_price_czk": 12605.39, "confidence": 0.78}
ROW_POUZDRO = {"code": "741C03", "description": "POUZDRO PRO PRŮCHOD PÁSKU STĚNOU",
               "unit": "KUS", "unit_price_czk": 548.02, "confidence": 0.78}
NONSENSE_CODES = {"15411", "743742", "741C03"}


def _fake_find(monkeypatch, calls):
    async def fake(query, max_results=5):
        calls.append(query)
        if "(" in query or "—" in query or "None" in query:
            # Simulate the prod defect: fulltext over a polluted query returns
            # confident nonsense — ALL THREE named codes are served, so a
            # regression re-issuing a garbage query fails the named pins.
            return {"results": [ROW_TUNEL, ROW_ROZVADEC, ROW_POUZDRO]}
        if "dílců" in query:
            return {"results": [ROW_DILCE]}
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


# ── 2. NO lexical rules for template atoms — three live-phrase pins ─────────
# (review finding 1: the zalivka/montaz stems silently re-bucketed candidates
# on every element type; the revert itself must not drift either.)

def test_no_global_worktype_drift_three_live_phrases():
    assert classify_work_type("Zálivka betonová monolitická C30/37") == "beton"
    assert classify_work_type(
        "TĚSNĚNÍ DILATAČ SPAR ASF ZÁLIVKOU PRŮŘ DO 800MM2") == "ostatni"
    assert classify_work_type("beton zálivky kotevních šroubů") == "beton"
    # Old-row stability (unchanged from pre-PR):
    assert classify_work_type("Římsový vozík — montáž") == "ostatni"
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


@pytest.mark.asyncio
async def test_prefab_carrier_priced_and_grout_note_points_to_it(monkeypatch):
    calls = _fake_find(monkeypatch, [])
    result = await create_work_breakdown(
        elements=[{
            "name": "Rámový propustek z prefabrikovaných dílců IZM",
            "element_type": "uzavreny_ram_tubus",
            "construction_mode": "prefab",
            "volume_m3": 96.5,          # objem dílců (OTSKP 3891x kánon, m³)
            "pieces_count": 12,
            "grout_volume_m3": 4.8,
        }],
        catalog="otskp",
        mode="work_with_catalog",
    )
    assert len(result["items"]) == 2
    carrier = next(i for i in result["items"]
                   if i["work_description"].startswith("Dodávka a montáž"))
    grout = next(i for i in result["items"]
                 if i["work_description"].startswith("Zálivka"))
    # Finding 5: the carrier row CARRIES the dominant cost — priced, in-list.
    assert carrier["otskp_code"] == "38912"
    assert carrier["quantity"] == 96.5
    assert carrier["quantity_status"] == "from_input"
    assert "12 ks" in carrier["quantity_formula"]  # pieces = param echo (rule 4)
    assert carrier["total_price_czk"] == round(19019.35 * 96.5, 0)
    # Grout bundles INTO the in-list carrier — the note names it (no void).
    assert grout["code_status"] == "bundled"
    assert grout["otskp_code"] is None
    assert "Dodávka a montáž" in grout["code_note"]
    assert grout["code_confidence"] == 1.0
    # No polluted query; grout never queried.
    assert calls == ["mostní rámové konstrukce z dílců železobetonových"]
    assert result["total_price_czk"] > 0  # finding 5: never a silent 0-Kč prefab


@pytest.mark.asyncio
async def test_prefab_carrier_without_volume_is_honest_nepocitano(monkeypatch):
    _fake_find(monkeypatch, [])
    result = await create_work_breakdown(
        elements=[{
            "name": "Rámový propustek",
            "element_type": "uzavreny_ram_tubus",
            "construction_mode": "prefab",
            "pieces_count": 12,
        }],
        catalog="otskp",
        mode="work_with_catalog",
    )
    carrier = next(i for i in result["items"]
                   if i["work_description"].startswith("Dodávka a montáž"))
    # AC (finding 5): without dílce volume the carrier row SHOWS NEPOČÍTÁNO —
    # an honest zero, never a silently-empty total with no carrier at all.
    assert carrier["quantity"] is None
    assert carrier["quantity_status"].startswith("NEPOČÍTÁNO")
    assert "12 ks" in carrier["quantity_formula"]
    assert carrier["total_price_czk"] is None


@pytest.mark.asyncio
async def test_monolith_tubus_grout_atom_never_enters_prefab_bundle(monkeypatch):
    # Finding 7: the prefab bundle keys on construction_mode — a grout-coded
    # atom on a MONOLITHIC tubus must not be swallowed into a dílce item that
    # a cast-in-place pour does not contain.
    from app.mcp.tools import breakdown as bd

    calls = _fake_find(monkeypatch, [])
    item = {
        "work_description": "Zálivka pracovní spáry C30/37",
        "element_type": "uzavreny_ram_tubus",
        "construction_mode": "monolit",
        "vocabulary_code": "CONCRETE.JOINT.GROUT",
        "quantity": 1.0,
        "unit": "m³",
    }
    await bd._attach_catalog_codes([item], catalog="otskp")
    assert item.get("code_status") != "bundled"
    del calls


# ── 4. floor hardening: polluted fallback → honest no-query ─────────────────

def test_polluted_label_fallback_returns_no_query(monkeypatch):
    from app.mcp.tools import classifier as clf

    monkeypatch.setitem(
        clf.ELEMENT_TYPES, "fiktivni_typ",
        {**clf.ELEMENT_TYPES["jine"], "label_cs": "Fiktivní typ (zvláštní) — cosi"},
    )
    assert _canonical_query("beton", "fiktivni_typ") is None
    # Finding 6: ALL dash forms are pollution, not only the em-dash.
    monkeypatch.setitem(
        clf.ELEMENT_TYPES, "fiktivni_typ2",
        {**clf.ELEMENT_TYPES["jine"], "label_cs": "Fiktivní rám - podchod"},
    )
    assert _canonical_query("beton", "fiktivni_typ2") is None
    # Clean unmapped labels keep the fallback path (no behavior change).
    assert _canonical_query("beton", "stena") is not None
    # Grandfathered polluted fallbacks keep TODAY'S behavior — sequential
    # discipline (BACKLOG otskp-binding-fallback-heads).
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


@pytest.mark.asyncio
async def test_urs_branch_pollution_guard_lifted_above_early_return(monkeypatch):
    # Finding 4: the guard applies on the ÚRS branch too — a polluted-fallback
    # type is marked not_verified and NEVER handed to find_urs_code.
    from app.mcp.tools import classifier as clf
    from app.mcp.tools import breakdown as bd
    import app.mcp.tools.catalog_binding_adapter as urs_adapter

    monkeypatch.setitem(
        clf.ELEMENT_TYPES, "fiktivni_typ",
        {**clf.ELEMENT_TYPES["jine"], "label_cs": "Fiktivní typ (zvláštní) — cosi"},
    )
    handed_over = []

    async def fake_attach(items, procurement_mode="privatni"):
        handed_over.extend(i["work_description"] for i in items)

    monkeypatch.setattr(urs_adapter, "attach_urs_codes", fake_attach)

    polluted = {
        "work_description": "Beton fiktivní konstrukce C30/37",
        "element_type": "fiktivni_typ", "quantity": 1.0, "unit": "m³",
    }
    clean = {
        "work_description": "Beton stěny C30/37",
        "element_type": "stena", "quantity": 1.0, "unit": "m³",
    }
    await bd._attach_catalog_codes([polluted, clean], catalog="urs")
    assert polluted["code_status"] == "not_verified"
    assert "zamusořen" in polluted["code_note"]
    assert handed_over == ["Beton stěny C30/37"]  # only the clean row searched


@pytest.mark.asyncio
async def test_dotazy_delta_guards_none_query(monkeypatch):
    # Finding 3: the delta path must honest-fail on a polluted type, never
    # issue the literal query "None C30/37".
    from app.mcp.tools import classifier as clf
    from app.mcp.tools import dotazy_projektanta as dp

    monkeypatch.setitem(
        clf.ELEMENT_TYPES, "fiktivni_typ",
        {**clf.ELEMENT_TYPES["jine"], "label_cs": "Fiktivní typ (zvláštní) — cosi"},
    )

    async def _explode(query, max_results=5):  # pragma: no cover — must not run
        raise AssertionError(f"lookup issued for polluted type: {query!r}")

    monkeypatch.setattr(dp, "_FIND_OTSKP", _explode)
    out = await dp.concrete_class_delta_czk("C20/25", "C25/30", 100.0, "fiktivni_typ")
    assert out["cena_delta_czk"] is None
    assert "substantivum" in out["reason"]


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
    r_dilce = await find_otskp_code(
        "mostní rámové konstrukce z dílců železobetonových", max_results=5)
    assert r_beton["results"][0]["code"].startswith("3893")
    assert r_vyztuz["results"][0]["code"] == "389365"
    assert r_dilce["results"][0]["code"].startswith("3891")
    all_codes = {c["code"] for r in (r_beton, r_vyztuz, r_dilce) for c in r["results"]}
    assert all_codes.isdisjoint(NONSENSE_CODES), all_codes
