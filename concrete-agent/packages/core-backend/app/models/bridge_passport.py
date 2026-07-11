"""Bridge Passport schema — SINGLE SOURCE (tz-passport-json, ratified 2026-07-07).

Governance (interview answer 1): this Pydantic model owns the passport shape.
`docs/specs/tz-passport-json/example_SO202_zalmanov.json` is the golden
fixture and MUST validate against this model in CI (drift-guard — same
principle as the element_types.yaml → W3 → TS chain). Half B (extraction)
writes this shape; half A (mapper → PlannerInput) reads it — both ends check
against THIS model.

Design: STRICT on the fields half A consumes (quantities, geometry,
structural_system, deck material/post-tensioning, construction_process pour
staging, materials per-use concrete classes); everything else `extra="allow"`
so richer TZ content never breaks validation. Honest-ignore is the consumer's
contract (AC), tolerance is the schema's.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

SCHEMA_NAME = "tz-bridge-passport"
SUPPORTED_SCHEMA_VERSIONS = {"0.1-draft"}


class _Tolerant(BaseModel):
    """Base for passport sections: unknown keys are data, not errors."""
    model_config = ConfigDict(extra="allow")


class PassportMeta(_Tolerant):
    schema_: str = Field(alias="schema")
    schema_version: str
    source: Optional[str] = None
    validated_against: List[str] = Field(default_factory=list)
    known_conflicts: List[str] = Field(default_factory=list)

    @field_validator("schema_")
    @classmethod
    def _schema_name(cls, v: str) -> str:
        if v != SCHEMA_NAME:
            raise ValueError(f"_meta.schema must be '{SCHEMA_NAME}', got '{v}'")
        return v

    @field_validator("schema_version")
    @classmethod
    def _schema_version(cls, v: str) -> str:
        if v not in SUPPORTED_SCHEMA_VERSIONS:
            raise ValueError(
                f"unsupported schema_version '{v}' (supported: {sorted(SUPPORTED_SCHEMA_VERSIONS)})"
            )
        return v


class QuantityItem(_Tolerant):
    """One soupis-joined quantity line. `element` keys join against
    materials_and_standards.concretes[].use where applicable."""
    element: str
    volume_m3: Optional[float] = Field(default=None, ge=0)
    rebar_mass_kg: Optional[float] = Field(default=None, ge=0)
    prestress_strand_mass_kg: Optional[float] = Field(default=None, ge=0)
    height_m: Optional[float] = Field(default=None, gt=0)
    length_bm: Optional[float] = Field(default=None, gt=0)
    source: Optional[str] = None
    concrete_class_soupis: Optional[str] = None
    # Pattern 53: True = soupis value is an OTSKP price band («DO C40/50»),
    # not a concrete grade → grade difference vs TZ is INFORMATIVE, not a conflict.
    soupis_class_is_otskp_band: bool = False


class Quantities(_Tolerant):
    source: Optional[str] = None
    scope: Optional[str] = None
    items: List[QuantityItem] = Field(default_factory=list)


class DeckGeometry(_Tolerant):
    id: Optional[str] = None
    deck_width_m: Optional[float] = Field(default=None, gt=0)
    # Height of the deck over terrain — a single number OR a dict per crossing
    # ({"road": 8.1, "stream": 14.9}). Consumed by half A since the
    # passport-height-skruz fix (2026-07-11): max value → PlannerInput.height_m
    # (falsework height for the deck).
    deck_height_over_terrain_m: Optional[Union[float, Dict[str, float]]] = None


class Geometry(_Tolerant):
    spans: List[float] = Field(default_factory=list)
    deck_length_m: Optional[float] = Field(default=None, gt=0)
    decks: List[DeckGeometry] = Field(default_factory=list)


class StructuralSystem(_Tolerant):
    type: Optional[str] = None
    spans_count: Optional[int] = Field(default=None, ge=1)
    girder_count_per_deck: Optional[int] = Field(default=None, ge=1)
    constant_depth_m: Optional[float] = Field(default=None, gt=0)


class DeckMaterial(_Tolerant):
    concrete_class: Optional[str] = None
    reinforcement: Optional[str] = None


class Deck(_Tolerant):
    type: Optional[str] = None
    spans_m: List[float] = Field(default_factory=list)
    width_per_deck_m: Optional[float] = Field(default=None, gt=0)
    # NK construction depth — half A forwards it as deck_thickness_m
    # (volume-plausibility check) since the passport-height-skruz fix.
    constant_depth_m: Optional[float] = Field(default=None, gt=0)
    material: Optional[DeckMaterial] = None


class Superstructure(_Tolerant):
    deck: Optional[Deck] = None


class ConstructionProcess(_Tolerant):
    # The calculable-critical trio (E2E 2026-07-07: the pour-stage note lived
    # ON THE DRAWING, not in the TZ text — provenance field is mandatory
    # whenever stages are set).
    deck_pour_stages: Optional[int] = Field(default=None, ge=1)
    deck_pour_stages_source: Optional[str] = None
    falsework_technology: Optional[str] = None

    @field_validator("falsework_technology")
    @classmethod
    def _tech(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"fixed_scaffolding", "mss", "cantilever"}:
            raise ValueError(
                "falsework_technology must be fixed_scaffolding | mss | cantilever"
            )
        return v


class ConcreteUse(_Tolerant):
    use: str
    class_: str = Field(alias="class")


class MaterialsAndStandards(_Tolerant):
    concretes: List[ConcreteUse] = Field(default_factory=list)
    reinforcement: Optional[str] = None
    post_tensioning: Optional[str] = None


class BridgePassport(_Tolerant):
    """Per-SO passport (interview answer 5). Stavba = collection of these."""
    meta: PassportMeta = Field(alias="_meta")
    quantities: Optional[Quantities] = None
    geometry: Optional[Geometry] = None
    structural_system: Optional[StructuralSystem] = None
    superstructure: Optional[Superstructure] = None
    construction_process: Optional[ConstructionProcess] = None
    materials_and_standards: Optional[MaterialsAndStandards] = None
