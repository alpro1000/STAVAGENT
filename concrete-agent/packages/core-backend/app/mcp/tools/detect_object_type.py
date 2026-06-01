"""
MCP Tool: detect_object_type

Exposes the W3b object-type detector as a first-class MCP tool so the orchestrator
(and the step that fills the per-SO type cache) can call it. The tool only
DETERMINES the type from the object's NAME + charakteristika sentence; filling the
SO-code cache stays with the caller (orchestrator) — single responsibility.

Deterministic by design: it delegates to the rule-based detector in
app.mcp.tools.object_type_detector via a qualified import. W3b is NOT modified or
renamed, and there is NO LLM path here (task §A: deterministic default).
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def detect_object_type(object_name: str, charakteristika: str = "") -> dict:
    """Determine a construction object's type from its technical report.

    Uses ONLY the object name + the charakteristika sentence — never the full
    document text. A retaining-wall TZ often mentions a neighbouring bridge in its
    geology section (e.g. SO 250 references "mostní objekt" / "lávka SO 222");
    full-text matching on "most" would wrongly flag the wall as a bridge. The
    object's own name + charakteristika are the deterministic, self-describing
    source.

    Deterministic rule matching (no LLM): retaining wall (zárubní/úhlová/opěrná +
    zeď/stěna) wins over bridge (most/lávka), which wins over building.

    Returns a dict with:
      - object_type: 'bridge' | 'retaining_wall' | 'building' | None
      - verified: True when a type was determined, False otherwise
      - _source: which field decided ('object_type_detector:name' /
        ':charakteristika' / ':name+charakteristika'), or None when undetermined
      - input_name: echo of the object name

    When neither name nor charakteristika determine a type, the result is the safe
    fallback (object_type=None, verified=False) — no exception, the item is left
    unverified for the grounding gate.

    Args:
        object_name: The construction object's name (e.g. 'Zárubní zeď v km 6,5',
            'Most na sil. I/6 přes potok'). Authoritative — NOT the full TZ text.
        charakteristika: The object's one-line charakteristika sentence
            (e.g. 'Úhlová železobetonová zeď.', 'Trvalý dálniční most o třech polích').
    """
    # Qualified import — the W3b detector is the single source of truth and is
    # left untouched. Lazy import avoids any import-time coupling at MCP startup.
    from app.mcp.tools import object_type_detector as otd

    name = object_name or ""
    char = charakteristika or ""

    object_type: Optional[str] = otd.detect_object_type(name, char)

    if object_type is None:
        return {
            "object_type": None,
            "verified": False,
            "_source": None,
            "input_name": name,
            "note": (
                "Typ objektu neurčen z názvu ani charakteristiky — bezpečná záloha "
                "(položka zůstává nepotvrzená)."
            ),
        }

    # Identify which authoritative field decided the type — deterministic re-run on
    # each field alone (name takes precedence when it alone suffices). Honest
    # provenance for the grounding gate (#80).
    decided_by_name = otd.detect_object_type(name, "") == object_type
    decided_by_char = otd.detect_object_type("", char) == object_type
    if decided_by_name:
        field = "name"
    elif decided_by_char:
        field = "charakteristika"
    else:
        # Neither field alone determines it — the combination did (e.g. wall
        # adjective in the name + wall noun in the charakteristika).
        field = "name+charakteristika"

    return {
        "object_type": object_type,
        "verified": True,
        "_source": f"object_type_detector:{field}",
        "input_name": name,
    }
