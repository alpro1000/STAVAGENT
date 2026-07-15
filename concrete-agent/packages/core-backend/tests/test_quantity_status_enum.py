"""
quantity_status axis enums — vocabulary-only unification (recon 2026-07-15).

The key `quantity_status` rides THREE entities carrying THREE semantically
different axes (join outcome / number provenance / pricing-input completeness).
Unlike CodeStatus/F3 there are no synonyms to collapse — the axes stay separate
enums; unified is the DISCIPLINE: no raw string literals at producers, every
axis named in the item_schemas.py inventory header. These tests pin the enum
values byte-for-byte (payloads must stay identical), the NEPOČÍTÁNO prefix
contract, and that raw literals are gone from the producers.
"""
from pathlib import Path

from app.models.item_schemas import (
    ElementQuantityStatus,
    ItemQuantityStatus,
    PricingQuantityStatus,
)

_APP = Path(__file__).resolve().parents[1] / "app"


def test_element_axis_canonical_values():
    # Soupis→element join outcome (soupis_quantity_join.py) — FOUR values,
    # not three: collapsed_into_sibling is easy to forget but load-bearing
    # (prevents double-count at the passport-key merge).
    assert ElementQuantityStatus.EXTRACTED.value == "extracted"
    assert ElementQuantityStatus.MISSING.value == "missing"
    assert ElementQuantityStatus.AMBIGUOUS.value == "ambiguous"
    assert ElementQuantityStatus.COLLAPSED_INTO_SIBLING.value == "collapsed_into_sibling"
    assert len(ElementQuantityStatus) == 4


def test_item_axis_canonical_values_and_nepocitano_prefix():
    assert ItemQuantityStatus.FROM_INPUT.value == "from_input"
    assert ItemQuantityStatus.COMPUTED.value == "computed"
    assert ItemQuantityStatus.ASSUMED.value == "assumed"
    # NEPOCITANO is a PREFIX — real payloads are parametrized. The helper is
    # the single source of the prefix; consumers keep startswith("NEPOČÍTÁNO")
    # (test_quantify_status.py) and the XLSX Zdroj label carries the reason
    # verbatim (review #1510 finding 10).
    assert ItemQuantityStatus.NEPOCITANO.value == "NEPOČÍTÁNO"
    built = ItemQuantityStatus.nepocitano("chybí výměra z podkladu")
    assert built == "NEPOČÍTÁNO(chybí výměra z podkladu)"
    assert built.startswith(ItemQuantityStatus.NEPOCITANO.value)
    assert isinstance(built, str) and type(built) is str


def test_pricing_axis_canonical_values():
    # PricedPolozka pricing-input completeness (otskp_engine.py, railway).
    assert PricingQuantityStatus.OK.value == "OK"
    assert PricingQuantityStatus.ODHADNUTO.value == "ODHADNUTO"
    assert PricingQuantityStatus.CHYBI_VSTUP.value == "CHYBÍ_VSTUP"
    assert len(PricingQuantityStatus) == 3


def test_values_are_plain_strings_for_payloads():
    """Producers assign `.value` — payload dicts must carry plain `str`
    (byte-stable JSON, no Enum leaking into FastMCP serialization)."""
    for enum_cls in (ElementQuantityStatus, ItemQuantityStatus, PricingQuantityStatus):
        for member in enum_cls:
            assert type(member.value) is str, member


def test_axes_are_disjoint_vocabularies():
    """The three axes answer different questions — a shared literal would mean
    a consumer could silently branch across axes. Keep them disjoint."""
    e = {m.value for m in ElementQuantityStatus}
    i = {m.value for m in ItemQuantityStatus}
    p = {m.value for m in PricingQuantityStatus}
    assert not (e & i) and not (e & p) and not (i & p)


def test_raw_literals_removed_from_producers():
    """Call-site guard (same source-inspection idiom as
    test_code_status_enum.test_legacy_literals_removed_from_producers): a revert
    re-introduces raw strings and fails here."""
    join_src = (_APP / "services" / "stage_gating" / "soupis_quantity_join.py").read_text(
        encoding="utf-8"
    )
    for lit in ('= "extracted"', '= "missing"', '= "ambiguous"', '= "collapsed_into_sibling"',
                '"quantity_status": "extracted"'):
        assert lit not in join_src, lit

    breakdown_src = (_APP / "mcp" / "tools" / "breakdown.py").read_text(encoding="utf-8")
    for lit in ('q_status = "from_input"', 'q_status = "computed"', 'q_status = "assumed"',
                'q_status = "NEPOČÍTÁNO', 'rebar_status = "', 'fw_status = "',
                'curing_status = "'):
        assert lit not in breakdown_src, lit

    engine_src = (_APP / "pricing" / "otskp_engine.py").read_text(encoding="utf-8")
    for lit in ('== "OK"', '== "ODHADNUTO"', '== "CHYBÍ_VSTUP"', 'quantity_status="OK"'):
        assert lit not in engine_src, lit


def test_summary_counter_keys_match_element_axis():
    """recipe_runner counts by the element axis; keys must be the enum values
    (byte-identical summary shape). COLLAPSED_INTO_SIBLING deliberately stays
    outside the counter — behavioral change tracked as its own BACKLOG ticket."""
    from app.services.stage_gating.recipe_runner import _summarize_quantification

    quantified = [
        {"name": "a", "quantity_status": ElementQuantityStatus.EXTRACTED.value},
        {"name": "b", "quantity_status": ElementQuantityStatus.MISSING.value},
        {"name": "c", "quantity_status": ElementQuantityStatus.AMBIGUOUS.value},
        {"name": "d", "quantity_status": ElementQuantityStatus.COLLAPSED_INTO_SIBLING.value},
    ]
    summary, _warnings = _summarize_quantification(quantified)
    # Byte-identical summary shape: flat counts + divergence block.
    assert summary == {
        "extracted": 1,
        "missing": 1,
        "ambiguous": 1,
        "divergent": 0,
        "divergences": [],
    }
