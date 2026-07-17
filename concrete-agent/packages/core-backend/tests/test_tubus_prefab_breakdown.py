"""Element 24 Wave 3d — prefab tubus assembly plan (task v2.1 §2.6 / AC2).

A prefabricated closed frame (construction_mode='prefab') must yield an
ASSEMBLY-ONLY breakdown: montáž dílců + zálivka spár. Never bednění,
never betonáž phases, never on-site výztuž (units arrive reinforced).
Quantities come ONLY from explicit inputs (pieces_count / grout_volume_m3)
— missing → honest NEPOČÍTÁNO, never an estimate (joint detail and piece
length are vendor data).

Vocabulary codes PRECAST.FRAME.INSTALL + CONCRETE.JOINT.GROUT are the
registration proposal delivered by this same change (vocabulary header:
"human approval = PR to this file").

Hermetic: work-first mode → no catalog/DB/network.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.breakdown import create_work_breakdown  # noqa: E402
from app.services.uwo_vocabulary import is_covered  # noqa: E402


def _descs(result):
    return [i["work_description"] for i in result["items"]]


@pytest.mark.asyncio
async def test_prefab_explicit_mode_yields_assembly_only_plan():
    result = await create_work_breakdown(
        elements=[{
            "name": "Rámový propustek DN 2000",
            "element_type": "uzavreny_ram_tubus",
            "construction_mode": "prefab",
        }],
        catalog="none",
    )
    descs = _descs(result)
    assert len(descs) == 2, descs
    assert any("Montáž prefabrikovaných rámových dílců" in d for d in descs)
    assert any("Zálivka spár" in d for d in descs)
    # AC2: no formwork, no pour phases, no on-site rebar
    joined = " | ".join(descs)
    assert "Bednění" not in joined
    assert "Odbednění" not in joined
    assert "Výztuž" not in joined
    assert "Ošetřování" not in joined
    assert not any(d.startswith("Beton ") for d in descs)


@pytest.mark.asyncio
async def test_prefab_quantities_are_honest_nepocitano_without_inputs():
    result = await create_work_breakdown(
        elements=[{
            "name": "Rámový propustek",
            "element_type": "uzavreny_ram_tubus",
            "construction_mode": "prefab",
        }],
        catalog="none",
    )
    for item in result["items"]:
        assert item["quantity"] is None, item["work_description"]
        assert item["quantity_status"].startswith("NEPOČÍTÁNO"), item["quantity_status"]


@pytest.mark.asyncio
async def test_prefab_quantities_from_explicit_inputs():
    result = await create_work_breakdown(
        elements=[{
            "name": "Rámový propustek",
            "element_type": "uzavreny_ram_tubus",
            "construction_mode": "prefab",
            "pieces_count": 12,
            "grout_volume_m3": 4.8,
        }],
        catalog="none",
    )
    by_code = {i["vocabulary_code"]: i for i in result["items"]}
    montaz = by_code["PRECAST.FRAME.INSTALL"]
    zalivka = by_code["CONCRETE.JOINT.GROUT"]
    assert montaz["quantity"] == 12 and montaz["unit"] == "ks"
    assert montaz["quantity_status"] == "from_input"
    assert zalivka["quantity"] == 4.8 and zalivka["unit"] == "m³"
    assert zalivka["quantity_status"] == "from_input"


@pytest.mark.asyncio
async def test_classifier_prefab_signal_selects_assembly_plan():
    # No explicit element_type/mode — the classifier must detect BOTH the
    # tubus type AND the prefab signal from the name (_TUBUS_PREFAB_RE).
    result = await create_work_breakdown(
        elements=[{
            "name": "Rámový propustek z prefabrikovaných dílců IZM",
        }],
        catalog="none",
    )
    descs = _descs(result)
    assert any("Montáž prefabrikovaných rámových dílců" in d for d in descs), descs
    assert not any("Bednění" in d for d in descs)


@pytest.mark.asyncio
async def test_explicit_monolit_mode_beats_prefab_name_signal():
    # Confidence ladder: caller-provided construction_mode wins over the
    # classifier's name signal — a monolithic replacement of a formerly
    # precast culvert keeps the pour plan (with §2.10 honest gaps).
    result = await create_work_breakdown(
        elements=[{
            "name": "Rámový propustek z prefabrikovaných dílců",
            "element_type": "uzavreny_ram_tubus",
            "construction_mode": "monolit",
            "volume_m3": 120.0,
        }],
        catalog="none",
    )
    descs = _descs(result)
    assert any(d.startswith("Beton ") for d in descs), descs
    assert not any("Montáž prefabrikovaných" in d for d in descs)


@pytest.mark.asyncio
async def test_monolith_tubus_unaffected_by_prefab_template():
    # Wave 3b contract intact: monolithic tubus keeps the default template
    # with honest NEPOČÍTÁNO on formwork/curing (§2.10) — 5 rows, not 2.
    result = await create_work_breakdown(
        elements=[{
            "name": "Podchod pro pěší",
            "element_type": "uzavreny_ram_tubus",
            "volume_m3": 1046.8,
        }],
        catalog="none",
    )
    assert len(result["items"]) == 5, _descs(result)


def test_prefab_vocabulary_codes_registered_and_covered():
    assert is_covered("PRECAST.FRAME.INSTALL") is True
    assert is_covered("CONCRETE.JOINT.GROUT") is True
