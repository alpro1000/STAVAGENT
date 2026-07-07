"""Bridge-passport schema drift-guard (tz-passport-json, ratified 2026-07-07).

The Pydantic model in app/models/bridge_passport.py is the SINGLE SOURCE of
the passport shape; the canonical example in docs/specs MUST validate against
it in CI. If either side drifts, this fails loud — same discipline as
gen:knowledge:check on the YAML→TS chain.
"""
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.models.bridge_passport import BridgePassport

_EXAMPLE = (
    Path(__file__).resolve().parents[4]
    / "docs" / "specs" / "tz-passport-json" / "example_SO202_zalmanov.json"
)


def _load() -> dict:
    return json.loads(_EXAMPLE.read_text(encoding="utf-8"))


def test_canonical_example_validates():
    p = BridgePassport.model_validate(_load())
    # Calculable-critical facts survive the round trip
    assert p.construction_process.deck_pour_stages == 3
    assert "3 TAKTECH" in p.construction_process.deck_pour_stages_source
    assert p.construction_process.falsework_technology == "fixed_scaffolding"
    assert p.geometry.spans == [32.0, 44.5, 32.0]
    assert len(p.geometry.decks) == 2
    deck_q = next(i for i in p.quantities.items if i.element == "superstructure_deck")
    assert deck_q.volume_m3 == pytest.approx(2697.941)
    assert deck_q.soupis_class_is_otskp_band is True
    uses = {c.use: c.class_ for c in p.materials_and_standards.concretes}
    assert uses["superstructure_deck"].startswith("C35/45")


def test_unknown_sections_tolerated():
    data = _load()
    data["future_section"] = {"anything": [1, 2, 3]}
    data["geometry"]["future_field"] = "ok"
    BridgePassport.model_validate(data)  # must not raise (extra=allow)


def test_wrong_schema_version_rejected():
    data = _load()
    data["_meta"]["schema_version"] = "9.9-unknown"
    with pytest.raises(ValidationError):
        BridgePassport.model_validate(data)


def test_wrong_schema_name_rejected():
    data = _load()
    data["_meta"]["schema"] = "something-else"
    with pytest.raises(ValidationError):
        BridgePassport.model_validate(data)


def test_invalid_falsework_technology_rejected():
    data = _load()
    data["construction_process"]["falsework_technology"] = "levitation"
    with pytest.raises(ValidationError):
        BridgePassport.model_validate(data)
