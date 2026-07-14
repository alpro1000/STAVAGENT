"""UWO vocabulary loader + invariant validator (axis-A, Pattern 16).

Single accessor for the controlled work vocabulary
(`app/knowledge_base/B5_tech_cards/technological_postupy/uwo_vocabulary.yaml`)
that stage-4 Decompose emits from and stage-5 Bind maps from
(SPEC document-to-worklist §5.1/§6.3; ADR-009 D2).

Honesty discipline mirrors the branch-template loader in
`app/mcp/tools/breakdown.py` (`_load_interier_psv_templates`): an unreadable
OR invariant-violating file yields an EMPTY vocabulary (downstream stays
honest-blank / not_covered_branch), never a crash and never a broken
controlled vocab served to the LLM.
"""

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

ALLOWED_UNITS = {"m", "m2", "m3", "m2_day", "m3_day", "t", "ks", "kpl", "h"}
ALLOWED_PARAM_KINDS = {"scalar", "eurocode_class", "market_scheme"}
ALLOWED_COVERAGE = {"covered", "declared"}
LANG_SLOTS = {"cs", "de", "es"}

# Coverage contract (vocabulary header): `covered` = the decomposer branch is
# BUILT and can emit this atom. Built today: branch `monolit` (WORK_TEMPLATES)
# + branch `interier_psv` section `malba` only. Codes marked covered outside
# these atom families are a contract violation.
BUILT_ATOM_PREFIXES = (
    "CONCRETE.POUR.STRUCTURE",
    "CONCRETE.CURING.SURFACE",
    "FORMWORK.PANEL.",
    "FORMWORK.FALSEWORK.ERECT",
    "FORMWORK.TRAVELER.",
    "REINFORCEMENT.",
    "PILING.",
    "FINISHES.PAINT.",
    "FINISHES.PROTECT.",
)


def _vocabulary_path() -> Path:
    # __file__ = app/services/uwo_vocabulary.py → parent×2 = app/
    app_dir = Path(__file__).resolve().parent.parent
    return (
        app_dir / "knowledge_base" / "B5_tech_cards"
        / "technological_postupy" / "uwo_vocabulary.yaml"
    )


def validate_vocabulary(data: Dict[str, Any]) -> List[str]:
    """Return invariant violations ([] = valid). Pure — shared by tests and CI.

    Checks the market-proofing schema rules (lang-map slots, canonical-unit
    whitelist, typed param kinds), uniqueness, the coverage contract, and the
    "VRN is not vocabulary" rule (no SITE.* codes).
    """
    v: List[str] = []
    codes = data.get("codes") or []
    domains = data.get("domains") or []

    # Shape guard: a malformed entry (not a mapping) must become a VIOLATION,
    # not an AttributeError — the honest-empty contract says a broken file is
    # reported and refused, never crashes the caller.
    bad_codes = sum(1 for c in codes if not isinstance(c, dict))
    bad_domains = sum(1 for d in domains if not isinstance(d, dict))
    if bad_codes or bad_domains:
        return [
            f"malformed entries (not mappings): {bad_codes} in codes[], "
            f"{bad_domains} in domains[]"
        ]

    domain_keys = {d.get("key") for d in domains}

    seen: set = set()
    for c in codes:
        code = c.get("code", "<missing>")
        if code in seen:
            v.append(f"{code}: duplicate code")
        seen.add(code)

        for field in ("label", "keywords"):
            slots = c.get(field)
            if not isinstance(slots, dict) or set(slots.keys()) != LANG_SLOTS:
                v.append(f"{code}: {field} must be a lang map with exactly {sorted(LANG_SLOTS)}")
        if c.get("unit_canonical") not in ALLOWED_UNITS:
            v.append(f"{code}: unit_canonical {c.get('unit_canonical')!r} not in whitelist")
        for p in c.get("params") or []:
            if p.get("kind") not in ALLOWED_PARAM_KINDS:
                v.append(f"{code}: param {p.get('name')!r} kind {p.get('kind')!r} invalid")
        cov = c.get("coverage")
        if cov not in ALLOWED_COVERAGE:
            v.append(f"{code}: coverage {cov!r} invalid")
        if cov == "covered" and not code.startswith(BUILT_ATOM_PREFIXES):
            v.append(f"{code}: marked covered but no built branch emits it (coverage contract)")
        if code.startswith("SITE."):
            v.append(f"{code}: VRN/ZS cost articles are not vocabulary (ČSN 73 0212)")
        dom = code.split(".", 1)[0]
        if dom not in domain_keys:
            v.append(f"{code}: domain {dom} not declared in domains[]")
    return v


@lru_cache(maxsize=1)
def load_vocabulary() -> Dict[str, Any]:
    """Load + validate the vocabulary. {version, codes: {code→entry}, domains: {key→entry}}.

    Unreadable or invariant-violating file → empty shape (honest-empty),
    violations logged loudly. Never serves a broken controlled vocab.
    """
    import yaml

    empty = {"version": None, "codes": {}, "domains": {}}
    path = _vocabulary_path()
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("[UWO/vocab] unreadable %s: %s", path.name, e)
        return empty

    # Belt-and-braces: the validator is written to RETURN violations, but if a
    # future edit lets it raise, the honest-empty promise must still hold.
    try:
        violations = validate_vocabulary(data)
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("[UWO/vocab] validator crashed on %s: %s", path.name, e)
        return empty
    if violations:
        for msg in violations:
            logger.warning("[UWO/vocab] invariant violation: %s", msg)
        return empty

    return {
        "version": data.get("vocabulary_version"),
        "codes": {c["code"]: c for c in data.get("codes") or []},
        "domains": {d["key"]: d for d in data.get("domains") or []},
    }


def get_code(code: str) -> Optional[Dict[str, Any]]:
    """Vocabulary entry for an exact code, or None (never invented)."""
    return load_vocabulary()["codes"].get(code)


def is_covered(code: str) -> bool:
    """True only for a known code whose decomposer branch is built."""
    entry = get_code(code)
    return bool(entry) and entry.get("coverage") == "covered"


def domain_of(code: str) -> Optional[str]:
    """Declared domain key of a code-shaped string, or None if undeclared."""
    dom = code.split(".", 1)[0]
    return dom if dom in load_vocabulary()["domains"] else None
