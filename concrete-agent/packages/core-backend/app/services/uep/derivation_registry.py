"""
UEP Derivation registry — Phase 4 implementation (PR2).

Loads `derivation_rules.yaml`, validates each rule, and exposes:
  - `apply_derivation(rule_id, inputs)` — compute one derived quantity.
    REFUSES unknown rule_id at the Python boundary so consumers can't
    smuggle arbitrary formulas through. PR2 acceptance criterion 14.
  - `list_applicable_derivations(output, available_inputs)` — list
    rules that COULD compute `output` given the inputs the caller has.

Formula evaluation uses a restricted `eval` scope: no `__builtins__`,
only the helpers in `_SAFE_GLOBALS`. The Pydantic validator on
DerivationRule also asserts every required input placeholder appears
in the formula text, so a typo'd input name fails at load-time, not
runtime.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.4, §6
Reference: docs/tasks/TASK_UEP_PR2.md §3.2
"""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Iterable, Optional

import yaml

from app.models.derivation_schemas import (
    DerivationApplicableRule,
    DerivationInputValue,
    DerivationRule,
    DerivationRuleSet,
    DerivedQuantity,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Safe evaluation scope.
# ---------------------------------------------------------------------------


_SAFE_GLOBALS = {
    "__builtins__": {},
    "pi": math.pi,
    "ceil": math.ceil,
    "floor": math.floor,
    "min": min,
    "max": max,
    "sqrt": math.sqrt,
    "abs": abs,
    "round": round,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "radians": math.radians,
    "degrees": math.degrees,
}


class DerivationError(Exception):
    """Raised when a rule cannot be applied (missing inputs / bad math)."""


class UnknownDerivationRule(DerivationError):
    """Raised when `rule_id` is not in the loaded registry.

    Distinct exception so the REST + MCP surface can map this directly
    to a 404 instead of a generic 500.
    """


# ---------------------------------------------------------------------------
# Registry container.
# ---------------------------------------------------------------------------


class DerivationRegistry:
    """In-memory rule store.

    Construct once at app startup; lookups are O(1). The class is the
    boundary that refuses unregistered rule_ids — there is no path
    around it.
    """

    def __init__(self, rule_set: DerivationRuleSet) -> None:
        self._rules: dict[str, DerivationRule] = {r.id: r for r in rule_set.rules}
        if len(self._rules) != len(rule_set.rules):
            raise ValueError("DerivationRegistry: duplicate rule ids in YAML")

    def __len__(self) -> int:
        return len(self._rules)

    def list_rule_ids(self) -> list[str]:
        return sorted(self._rules.keys())

    def get(self, rule_id: str) -> DerivationRule:
        if rule_id not in self._rules:
            raise UnknownDerivationRule(
                f"derivation rule_id={rule_id!r} not registered "
                f"(known: {self.list_rule_ids()[:5]}{'…' if len(self._rules) > 5 else ''})"
            )
        return self._rules[rule_id]

    # -----------------------------------------------------------------------
    # Apply
    # -----------------------------------------------------------------------

    def apply(
        self, rule_id: str, inputs: Iterable[DerivationInputValue]
    ) -> DerivedQuantity:
        """Apply a registered rule to a set of typed inputs.

        Validation:
          1. rule_id must exist (else UnknownDerivationRule).
          2. Every `required_input` must be provided (else DerivationError).
          3. Unit of each provided input must match (else DerivationError).
          4. Formula evaluation under restricted scope (math errors raise
             DerivationError with context).
        """

        rule = self.get(rule_id)
        provided = {i.name: i for i in inputs}

        # 2. required input presence
        missing = [
            i.name for i in rule.required_inputs if i.name not in provided
        ]
        if missing:
            raise DerivationError(
                f"rule {rule.id!r} missing required inputs: {missing}"
            )

        # 3. unit alignment — strict equality. PR3 can add unit conversion.
        all_declared = list(rule.required_inputs) + list(rule.optional_inputs)
        for declared in all_declared:
            if declared.name not in provided:
                continue
            got = provided[declared.name]
            if got.unit != declared.unit:
                raise DerivationError(
                    f"rule {rule.id!r} input {declared.name!r}: "
                    f"expected unit {declared.unit!r}, got {got.unit!r}"
                )

        scope = {**_SAFE_GLOBALS}
        for name, val in provided.items():
            scope[name] = val.value

        # 4. evaluate formula
        try:
            value = float(eval(rule.formula, scope, {}))  # noqa: S307 — controlled scope
        except Exception as exc:  # noqa: BLE001
            raise DerivationError(
                f"rule {rule.id!r} formula evaluation failed: {exc} "
                f"(formula={rule.formula!r})"
            ) from exc

        # 5. evaluate confidence formula
        confidences = [
            provided[i.name].confidence
            for i in rule.required_inputs
            if i.name in provided
        ]
        if not confidences:
            confidences = [1.0]
        conf_scope = {**_SAFE_GLOBALS, "input_confidences": confidences}
        try:
            confidence = float(eval(rule.confidence_formula, conf_scope, {}))  # noqa: S307
        except Exception as exc:  # noqa: BLE001
            raise DerivationError(
                f"rule {rule.id!r} confidence_formula failed: {exc}"
            ) from exc
        confidence = max(0.0, min(1.0, confidence))

        used_inputs = [provided[i.name] for i in rule.required_inputs if i.name in provided]
        used_inputs.extend(
            provided[i.name] for i in rule.optional_inputs if i.name in provided
        )

        return DerivedQuantity(
            rule_id=rule.id,
            output_quantity=rule.output_quantity,
            value=value,
            unit=rule.output_unit,
            confidence=confidence,
            formula=rule.formula,
            inputs=used_inputs,
            confidence_formula=rule.confidence_formula,
            validity_conditions=rule.validity_conditions,
            references=list(rule.references),
        )

    # -----------------------------------------------------------------------
    # List applicable
    # -----------------------------------------------------------------------

    def list_applicable(
        self, output_quantity: str, available_inputs: set[str]
    ) -> list[DerivationApplicableRule]:
        """List rules whose `output_quantity` matches and which COULD run
        given the supplied set of input names.

        Sorted by ascending count of missing inputs so the easiest-to-satisfy
        rule shows first.
        """

        out: list[DerivationApplicableRule] = []
        for rule in self._rules.values():
            if rule.output_quantity != output_quantity:
                continue
            required = [i.name for i in rule.required_inputs]
            missing = [n for n in required if n not in available_inputs]
            optional_present = [
                i.name for i in rule.optional_inputs if i.name in available_inputs
            ]
            out.append(
                DerivationApplicableRule(
                    rule_id=rule.id,
                    output_quantity=rule.output_quantity,
                    required_inputs_satisfied=(not missing),
                    missing_inputs=missing,
                    optional_inputs_satisfied=optional_present,
                    description=rule.description,
                )
            )
        out.sort(key=lambda r: (not r.required_inputs_satisfied, len(r.missing_inputs)))
        return out


# ---------------------------------------------------------------------------
# Module-level convenience.
# ---------------------------------------------------------------------------


_GLOBAL_REGISTRY: Optional[DerivationRegistry] = None


def rules_path() -> Path:
    """Default path of the bundled derivation rules YAML."""

    return (
        Path(__file__).resolve().parents[2]
        / "knowledge_base"
        / "B12_derivation_rules"
        / "derivation_rules.yaml"
    )


def load_registry(path: Optional[Path] = None) -> DerivationRegistry:
    """Load + return a registry; caller may cache the result.

    The module-level `get_global_registry()` caches the canonical
    instance so apply_derivation() can be called without re-parsing
    YAML.
    """

    p = path or rules_path()
    # YAML I/O wrap (Amazon Q PR #1186 C3) — malformed file →
    # RuntimeError with path context, not raw YAMLError.
    try:
        raw = yaml.safe_load(p.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise RuntimeError(
            f"Failed to load derivation rules from {p}: {exc}"
        ) from exc
    rule_set = DerivationRuleSet.model_validate(raw)
    registry = DerivationRegistry(rule_set)
    logger.info("[uep.derivation] loaded %d rules from %s", len(registry), p.name)
    return registry


def get_global_registry() -> DerivationRegistry:
    """Lazy singleton for app-wide use."""

    global _GLOBAL_REGISTRY
    if _GLOBAL_REGISTRY is None:
        _GLOBAL_REGISTRY = load_registry()
    return _GLOBAL_REGISTRY


def apply_derivation(
    rule_id: str, inputs: Iterable[DerivationInputValue]
) -> DerivedQuantity:
    """Module-level convenience wrapper around `DerivationRegistry.apply`."""

    return get_global_registry().apply(rule_id, inputs)


def list_applicable_derivations(
    output_quantity: str, available_inputs: set[str]
) -> list[DerivationApplicableRule]:
    """Module-level convenience wrapper for `list_applicable`."""

    return get_global_registry().list_applicable(output_quantity, available_inputs)
