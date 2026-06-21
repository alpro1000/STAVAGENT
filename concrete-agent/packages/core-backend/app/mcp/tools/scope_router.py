"""
Scope-Router (UWO Stage 1, upstream).

scope text → section_code. Decides WHICH branch of the work decomposer applies,
BEFORE the element-classifier runs. The element-classifier is a pure structural-
concrete typer (W3-parity golden tests) and must stay that way — so scope-routing
lives here, orthogonal to it (design.md §6.1 Decision 1).

Branches:
  'monolit'      — concrete / structural → the existing WORK_TEMPLATES branch.
                   Only for this section_code does breakdown.py call _classify.
  'interier_psv' — interiér / PSV finishing work (this MVP: malba) → KB templates.
  None           — no rule matched → honest-blank. The caller MUST NOT fall back
                   to the monolit branch (the "sebevědomě-špatně" cure).

Ported from sandbox/uwo-interier-mezonet/src/scope-router.mjs. Czech stems avoid
\\w boundaries on diacritics (Pattern 30).
"""

from __future__ import annotations

# Monolit (concrete / structural) vocabulary. Mirrors the sandbox list.
_MONOLIT_KEYWORDS = [
    "beton", "bednění", "bedneni", "výztuž", "vyztuz", "monolit",
    "základová deska", "zakladova deska", "mostovk", "pilíř", "pilir", "opěr", "oper",
]

# Interiér / PSV vocabulary. Mirrors the sandbox list (covers all 10 PSV sections;
# only the malba templates are wired in this MVP, but routing recognises the family).
_INTERIER_KEYWORDS = [
    "stěn", "sten", "štuk", "stuk", "perlink", "nátěr", "nater", "malb", "omítk", "omitk",
    "koupeln", "wc", "obklad", "dlažb", "dlazb", "vana", "sprch", "sanuzel",
    "vinyl", "parket", "podlah", "sádrokarton", "sadrokarton", "sdk", "podhled",
    "elektr", "kotel", "plynov", "okn", "dveř", "dver", "schodišt", "schodist",
    "doprav", "odvoz", "suť", "sut", "administrativ", "hodinov", "demontáž", "demontaz",
]


def _hits(text: str, keywords: list[str]) -> bool:
    t = (text or "").lower()
    return any(k in t for k in keywords)


def route_scope(text: str) -> dict:
    """Route a single scope text (element name / mistr's položka) to a branch.

    Returns: {section_code, confidence, matched_rule, honest_blank}.
      * monolit keyword AND NOT interiér keyword → 'monolit' (0.9). An interiér
        keyword present anywhere wins, because monolit terms ("beton") leak into
        PSV phrasing ("betonová mazanina pod vinyl") but not vice versa.
      * interiér keyword → 'interier_psv' (0.95).
      * neither → None, honest_blank=True. Caller must NOT fall back to monolit.
        (LLM fallback would sit here at 0.70 + flag — out of MVP scope.)
    """
    if _hits(text, _MONOLIT_KEYWORDS) and not _hits(text, _INTERIER_KEYWORDS):
        return {
            "section_code": "monolit",
            "confidence": 0.9,
            "matched_rule": "monolit_keyword",
            "honest_blank": False,
        }
    if _hits(text, _INTERIER_KEYWORDS):
        return {
            "section_code": "interier_psv",
            "confidence": 0.95,
            "matched_rule": "interier_keyword",
            "honest_blank": False,
        }
    return {
        "section_code": None,
        "confidence": 0.0,
        "matched_rule": None,
        "honest_blank": True,
    }
