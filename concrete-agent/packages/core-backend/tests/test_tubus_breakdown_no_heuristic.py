"""Element 24 (uzavřený rám / tubus) — soupis §2.10 / AC10 / AC14 guard.

`create_work_breakdown` decomposes a structural element into work rows and, for
most types, estimates formwork/curing area from generic V/thickness heuristics
(soffit V/0.25, wall V/0.3×2). Those heuristics are FORBIDDEN for the tubus
(§2.10) — they overstate a closed frame (the 450 mm strop's soffit ~1.8×) and
their defects are pinned by the divergence suite (#1514). The tubus derives
quantities ONLY from explicit inputs; a missing formwork/curing area is an honest
NEPOČÍTÁNO, never a fabricated default (AC14). In OTSKP, bednění/odbednění and
ošetřování are bundled into the concrete price (AC10) — deterministic None with
reason, confidence 1.0; výztuž is matched separately.

Hermetic: work_first mode does no catalog binding; the OTSKP-bundling test
monkeypatches find_otskp_code so no DB is touched.
"""
import asyncio

import pytest

from app.mcp.tools.breakdown import (
    MODE_WORK_FIRST,
    MODE_WORK_WITH_CATALOG,
    create_work_breakdown,
)


def _run(elements, **kw):
    return asyncio.run(create_work_breakdown(elements=elements, **kw))


def _rows(result, substr):
    return [i for i in result["items"] if substr in i["work_description"]]


def _one(result, substr):
    rows = _rows(result, substr)
    assert rows, f"no item matching {substr!r}: " + "; ".join(
        i["work_description"] for i in result["items"]
    )
    return rows[0]


# SO 11-20-04 profile: strop tl. 0.45 m. The forbidden soffit heuristic would be
# 500 m³ / 0.25 = 2000 m²; the vertical fallback 500 / 0.3 × 2 = 3333 m². Neither
# may appear.
TUBUS = {
    "name": "Uzavřený rám SO 11-20-04",
    "element_type": "uzavreny_ram_tubus",
    "volume_m3": 500,
    "height_m": 0.45,  # strop thickness — must NOT become a soffit area
    "concrete_class": "C30/37",
}


def test_formwork_and_curing_are_nepocitano_not_fabricated():
    r = _run([TUBUS], mode=MODE_WORK_FIRST)
    for label in ("Bednění", "Odbednění", "Ošetřování"):
        row = _one(r, label)
        assert row["quantity"] is None, f"{label} must be NEPOČÍTÁNO, got {row['quantity']}"
        assert "NEPOČÍTÁNO" in row["quantity_status"]
        # The forbidden fabricated numbers never surface.
        assert row["quantity"] not in (2000, 3333.33, 2000.0)


def test_beton_and_vyztuz_come_from_inputs():
    r = _run([TUBUS], mode=MODE_WORK_FIRST)
    beton = _one(r, "Beton")
    assert beton["quantity"] == 500  # volume from input
    vyztuz = _one(r, "Výztuž")
    # rebar_kg_m3 = 131 (n=1 Turnov calibration) → 500 × 131 / 1000 = 65.5 t
    assert vyztuz["quantity"] == pytest.approx(65.5, abs=0.01)


def test_explicit_area_is_honored_for_formwork():
    elem = {**TUBUS, "area_m2": 640.0}
    r = _run([elem], mode=MODE_WORK_FIRST)
    bedneni = _one(r, "Bednění")
    assert bedneni["quantity"] == 640.0
    assert bedneni["quantity_status"] == "from_input"
    # Curing stays honest NEPOČÍTÁNO — area_m2 is the formwork face, not the
    # curing surface of a closed box.
    assert _one(r, "Ošetřování")["quantity"] is None


def test_otskp_bundles_formwork_and_curing(monkeypatch):
    """AC10 — in OTSKP, bednění/odbednění/ošetřování bind to a deterministic None
    (zahrnuto v betonu) at confidence 1.0; výztuž/beton are matched separately."""
    import app.mcp.tools.breakdown as bd

    async def _fake_find(query, max_results=5):
        return {"results": [{"code": "27231", "description": "Beton", "confidence": 0.9, "unit_price_czk": 3000}]}

    monkeypatch.setattr("app.mcp.tools.otskp.find_otskp_code", _fake_find)

    r = _run([TUBUS], mode=MODE_WORK_WITH_CATALOG, catalog="otskp")
    for label in ("Bednění", "Odbednění", "Ošetřování"):
        row = _one(r, label)
        assert row["otskp_code"] is None
        assert row["code_status"] == "bundled"
        assert row["code_confidence"] == 1.0
        assert "zahrnuto v betonu" in row["code_note"]
    # Reinforcement is NOT bundled — it goes through matching.
    assert _one(r, "Výztuž")["code_status"] != "bundled"
