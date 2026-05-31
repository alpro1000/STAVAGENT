"""
Element-name normalization layer (W3).

A single pure function that runs **immediately before** element classification and
rewrites a raw element name into three signals the classifier consumes:

  - canonical_name        — head-noun canonicalized + prepositional/participle
                            tail stripped + dimensions removed, so the existing
                            (deliberately unchanged) keyword rule table matches on
                            the governing structural noun, not a stray substring.
  - construction_context  — 'bridge' | 'retaining_wall' | 'building' | None,
                            derived from object name + content keywords, DECOUPLED
                            from the assumption that a numbered object code (SO\\d{3})
                            means bridge.
  - status                — 'nový' | 'stávající', from existing/demolition wording.

No LLM. Deterministic (required for replay). The classifier and its rule table
stay a pure category matcher; this layer only annotates + rewrites the string the
matcher sees.

Reference: docs/tasks/TASK_W3_NormalizeElementName_SO250.md §2, §3.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# ── construction context ─────────────────────────────────────────────────────

# Genuine bridge vocabulary (name + object_code), NOT the bare SO-number. A
# numbered object code alone no longer implies bridge (task §3 / criterion #69).
_BRIDGE_CONTENT = re.compile(
    r"\bmost\w*|přemost|lávk|mostovk|nosn[áéí]\w*\s*konstr|\bNK\b|pilíř|"
    r"opěr[ay]\b|\bP\d|estakád|silnič.*most",
    re.I,
)

# Retaining / angular / abutment-style WALL vocabulary.
_WALL_CONTENT = re.compile(
    r"zárubní|opěrn[áé]\s*z[eě]ď|úhlov[áé]|tížn[áé]|gabion|opěrn[áé]\s*konstr",
    re.I,
)

# ── status (nový vs stávající) ───────────────────────────────────────────────

_EXISTING_STATUS = re.compile(
    r"stávajíc|demol|bourán|odstran|původní|stav\.\s|odbour", re.I
)

# ── modifier stripping (prepositional / participle tails) ────────────────────
# These introduce a subordinate ref (material, anchoring, purpose) — NOT the head
# noun. Cut the name at the first such marker so the head NP remains (task §2).
# Conservative, curated set (the task's own examples) to avoid over-stripping.
_TAIL_MARKERS = re.compile(
    r"\s+(?:z|ze)\s+\w"          # "z lomového kamene"
    r"|\s+kotven\w*"              # "kotvený do dříku"
    r"|\s+obložen\w*"            # "obložen lomovým kamenem"
    r"|\s+vlepen\w*"             # "vlepenými kotvami"
    r"|\s+pro\s+založen"         # "pro založení"
    r"|\s+na\s+líci",            # "na líci"
    re.I,
)

# Dimensions / numeric noise: "0,56×2,75", "0,56 x 2,75", standalone numbers.
_DIMENSIONS = re.compile(r"\d+[\.,]?\d*\s*[x×]\s*\d+[\.,]?\d*|\b\d+[\.,]\d+\b")


@dataclass(frozen=True)
class NormalizedName:
    """Output of the normalization layer, consumed by the classifier."""

    canonical_name: str          # string the rule table matches on
    construction_context: Optional[str]  # 'bridge' | 'retaining_wall' | 'building' | None
    status: str                  # 'nový' | 'stávající'
    original_name: str
    head_noun: Optional[str] = None  # canonical head, when one was resolved


def _strip_modifiers(name: str) -> str:
    """Cut the prepositional/participle tail + dimensions, leaving the head NP."""
    m = _TAIL_MARKERS.search(name)
    core = name[: m.start()] if m else name
    core = _DIMENSIONS.sub(" ", core)
    return re.sub(r"\s+", " ", core).strip()


def _construction_context(name: str, object_code: Optional[str]) -> Optional[str]:
    hay = f"{name} {object_code or ''}"
    # Wall wins over bridge when an explicit retaining-wall term is present
    # (a zárubní/úhlová zeď that mentions 'opěra' is still a wall, not a bridge).
    if _WALL_CONTENT.search(hay):
        return "retaining_wall"
    if _BRIDGE_CONTENT.search(hay):
        return "bridge"
    return None


def _canonical_head(core: str, context: Optional[str]) -> tuple[str, Optional[str]]:
    """Resolve the governing structural noun → a canonical token the EXISTING
    rule table already matches. Ordered: multi-word structural terms first, then
    context-sensitive 'dřík', then single nouns. Returns (canonical_name, head)."""
    low = core.lower()

    # 1. Nosná konstrukce / NK — governing concept beats a 'trám' modifier (#68).
    if re.search(r"nosn[áéí]\w*\s*konstr|\bNK\b", low):
        return "nosná konstrukce", "nosná konstrukce"

    # 2. Lícové zdivo / obklad — the new masonry-cladding category (#65).
    if re.search(r"lícov\w*\s*(?:obklad|zdiv)|obklad|kamenn\w*\s*zdiv", low):
        return "lícový obklad zdivo", "obklad"

    # 3. 'Dřík' is context-sensitive (#63 vs #64):
    #    bridge/pier context → pier shaft; otherwise → retaining-wall stem.
    if re.search(r"dřík", low) and not re.search(r"pilíř", low):
        if context == "bridge":
            return "dřík pilíře", "dřík"
        return "opěrná zeď", "opěrná zeď"

    # 4. Explicit pier.
    if re.search(r"pilíř", low):
        return "dřík pilíře", "pilíř"

    # 5. 'Základ' canonized to the plural the brittle rule expects (#66).
    #    (foundation slab handled by the existing 'základová deska' rule.)
    if re.search(r"základ", low) and not re.search(r"základov\w*\s*desk", low):
        return "základy", "základ"

    # No canonical rewrite — let the matcher run on the stripped core.
    return core, None


def normalize_element_name(
    name: str, object_code: Optional[str] = None
) -> NormalizedName:
    """Normalize a raw element name for classification. Pure + deterministic."""
    raw = name or ""
    status = "stávající" if _EXISTING_STATUS.search(raw) else "nový"
    context = _construction_context(raw, object_code)
    core = _strip_modifiers(raw)
    canonical, head = _canonical_head(core, context)
    return NormalizedName(
        canonical_name=canonical or core or raw,
        construction_context=context,
        status=status,
        original_name=raw,
        head_noun=head,
    )
