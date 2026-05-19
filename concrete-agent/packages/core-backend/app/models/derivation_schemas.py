"""
UEP Derivation registry — Phase 4 schemas (PR2).

Pure-data schemas for the derivation rules registry. The engine
(`services/uep/derivation_registry.py`) loads YAML, validates against
these models, and refuses to compute anything that isn't in the
registry — server-side enforcement of "no arbitrary formula" per PR2
acceptance criterion 14.

A derivation rule = a named, reproducible formula that takes a small
set of typed inputs and emits a single derived quantity. Inputs come
from the reconciliation report (confirmed facts) or directly from
Phase 1 extractions. The output carries a confidence value that the
rule itself computes from the inputs.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.4, §6
Reference: docs/tasks/TASK_UEP_PR2.md §3.2
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


class DerivationInput(BaseModel):
    """One typed input parameter of a derivation rule."""

    name: str = Field(..., description="Argument name used in the formula expression.")
    unit: str = Field(
        ..., description="Expected unit (`m`, `m2`, `m3`, `t`, `kg`, `ks`, `°`)."
    )
    required: bool = Field(default=True)
    description: str = ""


class DerivationRule(BaseModel):
    """One entry in `derivation_rules.yaml`.

    The `formula` is a plain Python expression that the engine
    evaluates with a restricted global scope (no `__builtins__`, only
    explicit helpers like `pi`, `ceil`, `floor`, `min`, `max`). All
    placeholders in `formula` must appear in either `required_inputs`
    or `optional_inputs`.

    `confidence_formula` is an expression that yields the derived
    quantity's confidence (0..1). Typical shape:

        confidence_formula: "min(input_confidences) * 0.95"

    Variable `input_confidences` is a list of the input fact confidences
    that the engine assembles before evaluating the formula.
    """

    id: str
    output_quantity: str = Field(
        ..., description="Name of the derived quantity (e.g. 'wall_area_m2')."
    )
    output_unit: str = Field(..., description="Unit of the output value.")
    formula: str = Field(
        ...,
        description=(
            "Python expression. Allowed names: input placeholders + math "
            "helpers (`pi`, `ceil`, `floor`, `min`, `max`, `sqrt`, `abs`). "
            "No imports, no attribute access, no calls outside the safe set."
        ),
    )
    required_inputs: list[DerivationInput] = Field(default_factory=list)
    optional_inputs: list[DerivationInput] = Field(default_factory=list)
    confidence_formula: str = Field(
        default="min(input_confidences) * 0.95",
        description="Confidence expression — evaluates to a float in [0, 1].",
    )
    validity_conditions: str = Field(
        default="",
        description=(
            "Free-text guard rendered into the audit trail. Engine does not "
            "evaluate this — it's a human-readable note about when the rule "
            "is safe (e.g. 'flat ceiling only', 'rectangular cross section')."
        ),
    )
    references: list[str] = Field(
        default_factory=list,
        description="ČSN / TKP / DIN references that justify the formula.",
    )
    description: str = ""

    @model_validator(mode="after")
    def _check_inputs_in_formula(self) -> "DerivationRule":
        """Sanity check: every required input name should appear in the formula."""

        for inp in self.required_inputs:
            if inp.name not in self.formula:
                raise ValueError(
                    f"DerivationRule {self.id!r}: required_input "
                    f"{inp.name!r} does not appear in formula"
                )
        return self


class DerivationRuleSet(BaseModel):
    """YAML root container."""

    version: int = 1
    description: str = ""
    rules: list[DerivationRule] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Engine I/O records.
# ---------------------------------------------------------------------------


class DerivationInputValue(BaseModel):
    """A single input value passed to the engine when applying a rule."""

    name: str
    value: float
    unit: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    source_ref: Optional[str] = Field(
        default=None,
        description="Free-text pointer to the source fact (e.g. 'pdf_tz#23').",
    )


class DerivedQuantity(BaseModel):
    """Output of `apply_derivation()` — full audit trail.

    Persisted directly into the UEP project artefacts so a reviewer can
    answer "where did this number come from?" in one read.
    """

    rule_id: str
    output_quantity: str
    value: float
    unit: str
    confidence: float
    formula: str
    inputs: list[DerivationInputValue]
    confidence_formula: str
    validity_conditions: str = ""
    references: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class DerivationApplicableRule(BaseModel):
    """Engine answer for `list_applicable_derivations()`."""

    rule_id: str
    output_quantity: str
    required_inputs_satisfied: bool
    missing_inputs: list[str] = Field(default_factory=list)
    optional_inputs_satisfied: list[str] = Field(default_factory=list)
    description: str = ""
