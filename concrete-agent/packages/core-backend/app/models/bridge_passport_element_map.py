"""tz-bridge-passport element-key map loader — Python side of the single source.

The map (passport element/use key → engine element_type + per-SO join metadata)
lives ONCE in `app/classifiers/element_rules/passport_element_map.yaml`
(ADR-008 §2). The TS half-A mapper consumes the generated
`kb-generated/bridge-passport-element-map.ts` artifact; this loader is the
native Python read for the half-B assembler (Gate 3+) — same convention as
the classifier's element_types.yaml read, so the two runtimes cannot drift.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional, TypedDict

import yaml

_MAP_PATH = (
    Path(__file__).resolve().parents[1]
    / "classifiers" / "element_rules" / "passport_element_map.yaml"
)


class PassportElementRule(TypedDict, total=False):
    engine_type: str
    per_deck: bool
    concrete_use: str


@lru_cache(maxsize=1)
def load_passport_element_map() -> dict[str, PassportElementRule]:
    """Passport element/use key → rule. Cached; raises loudly on a broken file
    (a missing single-source map is a defect, never a silent empty dict)."""
    with open(_MAP_PATH, encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    elements = data.get("elements")
    if not isinstance(elements, dict) or not elements:
        raise ValueError(f"passport_element_map.yaml has no elements: {_MAP_PATH}")
    return elements


def engine_type_for(passport_key: str) -> Optional[str]:
    """Canonical engine StructuralElementType for a passport element key."""
    rule = load_passport_element_map().get(passport_key)
    return rule.get("engine_type") if rule else None
