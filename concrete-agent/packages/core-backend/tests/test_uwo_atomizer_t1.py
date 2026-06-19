"""
Golden tests: UWO T1-adapter MVP (scope-router → branch-decomposer →
catalog-binding adapter). Proves the seam end-to-end on ONE non-concrete section
(malba) without porting the other 9 PSV sections.

Mirrors the acceptance criteria of the orphan reference impl
(sandbox/uwo-interier-mezonet/harness.test.mjs), ported to Python goldens, plus
a monolit-regression guard and an honest-blank guard.

IMPORTANT — runs WITHOUT fastmcp / pytest-asyncio. Each test drives the real
coroutine (`create_work_breakdown`, the exact body the MCP tool wraps) through
`asyncio.run`, as a plain sync `test_*` function. So:
  - no @pytest.mark.asyncio  → cannot silently no-await into a false green;
  - no `app.mcp.server` import → does not depend on fastmcp being installed.
A missing dependency makes collection ERROR (red), never a silent skip.

Numbering of criteria follows the harness AC labels (AC2..AC8) where applicable.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.breakdown import create_work_breakdown  # noqa: E402
from app.mcp.tools.scope_router import route_scope  # noqa: E402
from app.mcp.tools.catalog_binding_adapter import (  # noqa: E402
    map_status,
    URS_CANDIDATE_FLOOR,
)
import app.mcp.tools.urs as urs_mod  # noqa: E402


# ── Monolit regression: concrete WORK_TEMPLATES output stays BIT-IDENTICAL ────
# Frozen snapshot captured from the engine BEFORE the T1 changes (SO-202 pier +
# prestressed deck). The scope-router + branch registry must not perturb a single
# concrete row.
_MONOLIT_GOLDEN = [
    ("Bednění Dříky pilířů / sloupy", "m²", 160.0, "HSV3", "driky_piliru"),
    ("Odbednění Dříky pilířů / sloupy", "m²", 160.0, "HSV3", "driky_piliru"),
    ("Výztuž Dříky pilířů / sloupy z oceli B500B", "t", 3.6, "HSV4", "driky_piliru"),
    ("Beton Dříky pilířů / sloupy C30/37", "m³", 24, "HSV2", "driky_piliru"),
    ("Ošetřování betonu Dříky pilířů / sloupy", "m²", 160.0, "HSV2", "driky_piliru"),
    ("Skruž pevná/posuvná pro NK", "m²", 2420.0, "HSV4", "mostovkova_deska"),
    ("Bednění NK — spodní deska", "m²", 2420.0, "HSV4", "mostovkova_deska"),
    ("Výztuž NK z oceli B500B", "t", 108.9, "HSV4", "mostovkova_deska"),
    ("Beton NK C35/45", "m³", 605, "HSV4", "mostovkova_deska"),
    ("Předpínací výztuž Y1860 S7", "t", 32.67, "HSV4", "mostovkova_deska"),
    ("Ošetřování betonu NK", "m²", 2420.0, "HSV4", "mostovkova_deska"),
]

_MONOLIT_ELEMENTS = [
    {"name": "Pilíř P1", "volume_m3": 24, "concrete_class": "C30/37"},
    {"name": "NK mostovka", "volume_m3": 605, "concrete_class": "C35/45",
     "is_prestressed": True},
]


def test_monolit_regression_bit_identical():
    """Concrete path is byte-for-byte the same as before the UWO seam landed."""
    r = asyncio.run(create_work_breakdown(
        _MONOLIT_ELEMENTS, project_type="most", catalog="otskp"))
    assert r["total_items"] == len(_MONOLIT_GOLDEN), (
        f"Expected {len(_MONOLIT_GOLDEN)} concrete items, got {r['total_items']}")
    assert r["scope_guard_status"] == "ok"
    assert r["unresolved"] == []
    got = [
        (it["work_description"], it["unit"], it["quantity"],
         it["hsv_section"], it["element_type"])
        for it in r["items"]
    ]
    assert got == _MONOLIT_GOLDEN, "Concrete WORK_TEMPLATES output drifted"


# ── AC4: scope-router splits monolit / interiér / unknown ─────────────────────
def test_scope_router_branches():
    assert route_scope("Betonáž základové desky, bednění a výztuž")["section_code"] == "monolit"
    assert route_scope("Malba stěn 2× finální")["section_code"] == "interier_psv"
    assert route_scope("Dodávka a montáž fotovoltaiky")["section_code"] is None  # honest-blank


# ── AC2/AC3: malba scope → a PACK of atoms (never one line) ───────────────────
def test_malba_decomposes_to_pack():
    r = asyncio.run(create_work_breakdown(
        [{"name": "Malba stěn obývacího pokoje", "area_m2": 120}],
        project_type="budova", catalog="none"))
    assert r["scope_guard_status"] == "ok"
    psv = [it for it in r["items"] if it.get("section_code") == "interier_psv"]
    assert len(psv) >= 3, f"malba should yield a pack, got {len(psv)} atoms"
    # NO monolit atoms leaked onto the interiér scope.
    for it in psv:
        assert not _is_monolit_atom(it["work_description"]), it["work_description"]
    # quantity provenance is honest (derived_from_scope when m² present).
    derived = [it for it in psv if it.get("quantity_provenance") == "derived_from_scope"]
    assert derived, "expected at least one derived_from_scope atom"


def _is_monolit_atom(work: str) -> bool:
    w = work.lower()
    return any(k in w for k in ("bednění", "výztuž", "beton", "ošetřování"))


# ── AC2: malba with NO geometry → atoms kept with needs_input (not dropped) ───
def test_malba_needs_input_when_no_area():
    # "stěn" routes to interiér and the classifier falls back to 'jine' (not a
    # concrete element) → PSV branch with no geometry → needs_input.
    r = asyncio.run(create_work_breakdown(
        [{"name": "Malba stěn obývacího pokoje"}], project_type="budova", catalog="none"))
    psv = [it for it in r["items"] if it.get("section_code") == "interier_psv"]
    assert len(psv) >= 3, "atoms are kept even without m² (work is real)"
    m2_atoms = [it for it in psv if it["unit"] == "m2"]
    assert all(it["quantity"] is None and it["quantity_provenance"] == "needs_input"
               for it in m2_atoms), "m² atoms without area → needs_input, not dropped"


# ── AC4 / honest-blank: unknown scope → no atoms, surfaced in unresolved ──────
def test_honest_blank_unknown_scope():
    r = asyncio.run(create_work_breakdown(
        [{"name": "Dodávka a montáž fotovoltaiky"}],
        project_type="budova", catalog="none"))
    assert r["total_items"] == 0, "unknown scope must yield NO monolit atoms"
    assert r["scope_guard_status"] == "no_template_for_section"
    assert len(r["unresolved"]) == 1
    assert r["unresolved"][0]["section_code"] is None


# ── AC5: end-to-end PSV → adapter → find_urs_code → atom-with-code (status) ───
def test_malba_urs_binding_seam():
    """router → decomposer → adapter → find_urs_code → status from match_kind."""
    async def fake_find_urs_code(description, context=None):
        return {
            "results": [{
                "code": "784410010",
                "description": "Malba dvojnásobná " + description,
                "unit": "m2", "unit_price_czk": None, "confidence": 0.85,
                "source": "urs_matcher_service", "catalog": "urs",
                "catalog_version": None, "match_kind": "item",
            }],
            "total_found": 1, "query": description, "context": context,
            "catalog": "urs",
        }

    orig = urs_mod.find_urs_code
    urs_mod.find_urs_code = fake_find_urs_code
    try:
        r = asyncio.run(create_work_breakdown(
            [{"name": "Malba stěn obývacího pokoje", "area_m2": 120}],
            project_type="budova", catalog="urs", mode="work_with_catalog"))
    finally:
        urs_mod.find_urs_code = orig

    assert r["catalog"] == "urs"
    assert r["catalog_bound"] is True
    psv = [it for it in r["items"] if it.get("section_code") == "interier_psv"]
    assert psv, "expected PSV atoms"
    for it in psv:
        assert it["urs_code"] == "784410010"
        assert it["code_status"] == "candidate"  # item + conf≥floor, never exact
        b = it["catalog_binding"]
        assert b["catalog"] == "urs"
        assert b["match_kind"] == "item"
        assert b["catalog_version"] is None  # honest null, never a constant


# ── CONTRACT §3 / §6: match_kind → status mapping + floor semantics ───────────
def test_status_enum_mapping():
    # item above floor (matcher) → candidate; below → not_verified (demotion).
    assert map_status("item", 0.85, "urs_matcher_service") == "candidate"
    assert map_status("item", URS_CANDIDATE_FLOOR - 0.01, "urs_matcher_service") == "not_verified"
    # perplexity item is NOT floored (its 0.80 is a flat stamp, not a score).
    assert map_status("item", 0.80, "perplexity_urs_search") == "candidate"
    assert map_status("item", 0.5, "perplexity_urs_search") == "candidate"
    # group / raw_context / none.
    assert map_status("group", 0.55, "urs_matcher_service") == "group_only"
    assert map_status("raw_context", 0.5, "perplexity_urs_search") == "not_verified"
    assert map_status("none", 0.0, None) == "not_verified"
    # INVARIANT: URS never yields `exact`.
    for src in ("urs_matcher_service", "perplexity_urs_search"):
        for mk in ("item", "group", "raw_context", "none"):
            assert map_status(mk, 0.99, src) != "exact"


# ── INVARIANT: raw_context never surfaces a fabricated code ───────────────────
def test_raw_context_no_fabricated_code():
    async def fake_find_urs_code(description, context=None):
        return {
            "results": [{
                "code": "N/A", "description": "oddíl 784 identifikován, kód licencován",
                "unit": None, "unit_price_czk": None, "confidence": 0.5,
                "source": "perplexity_urs_search", "catalog": "urs",
                "catalog_version": None, "match_kind": "raw_context",
            }],
            "total_found": 1, "query": description, "context": context,
            "catalog": "urs",
        }

    orig = urs_mod.find_urs_code
    urs_mod.find_urs_code = fake_find_urs_code
    try:
        r = asyncio.run(create_work_breakdown(
            [{"name": "Malba stěn", "area_m2": 50}],
            project_type="budova", catalog="urs", mode="work_with_catalog"))
    finally:
        urs_mod.find_urs_code = orig

    psv = [it for it in r["items"] if it.get("section_code") == "interier_psv"]
    assert psv
    for it in psv:
        assert it["code_status"] == "not_verified"
        assert it["urs_code"] is None  # never a fabricated code for raw_context


if __name__ == "__main__":  # offline self-run (no pytest needed)
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)
