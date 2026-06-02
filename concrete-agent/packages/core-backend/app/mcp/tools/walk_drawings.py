"""
MCP Tool: walk_drawings (validate_drawing_element)

Part B of the automated-takeoff roadmap (Pattern 40 host-delegated vision +
Pattern 49 DXF-First). The HOST (ChatGPT/Claude/Gemini vision) walks each drawing
reasoning like a rozpočtář and submits one element at a time; this tool is the
DETERMINISTIC validation gate the MCP server runs on every submission.

The tool does NOT do vision. It grounds the host's reasoning against the
deterministic DXF takeoff (passed in as `dxf_rooms`) + the TZ excerpt, assigns a
confidence per the P40 ladder, and REJECTS ungrounded claims (no `_source`).

This fills what DXF alone cannot give — the hidden logic a rozpočtář reasons by
hand (patky = 2 rows; floor skladba extends beyond the wall; wall face = obvod ×
section height). Determinism-first: DXF (conf 1.0) runs before this; the host
vision only covers the flagged-ambiguous remainder, and this gate scores it.

No LLM path here — pure deterministic grounding (the vision was already done by
the host before the element reached this tool).
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

_WORD_RE = re.compile(r"[a-zřčšžýáíéúůňťďě]{4,}")


def _label_link(element_type: str, room: dict) -> Optional[str]:
    """Type-aware linkage: the element must reference the room by číslo OR share a
    název keyword — area proximity alone is not enough (removes coincidences)."""
    t = (element_type or "").lower()
    cislo = str(room.get("cislo", ""))
    if cislo and cislo in t:
        return f"číslo {cislo}"
    for w in _WORD_RE.findall((room.get("nazev") or "").lower()):
        if w in t:
            return f"název '{w}'"
    return None


def _dxf_hit(element_type, area_m2, count, dxf_rooms, dxf_counts, tol=0.05) -> Optional[str]:
    if dxf_rooms and area_m2:
        for r in dxf_rooms:
            a = r.get("area_m2")
            if a and abs(a - area_m2) / max(a, area_m2) <= tol and _label_link(element_type, r):
                return f"DXF room {r.get('cislo')} = {a} m²"
    if dxf_counts and count is not None:
        for c in dxf_counts:
            if c.get("qty") == count:
                return f"DXF count {c.get('element')} = {count}"
    return None


def _tz_hit(element_type, tz_text) -> Optional[str]:
    if not tz_text:
        return None
    low = tz_text.lower()
    for w in _WORD_RE.findall((element_type or "").lower()):
        if w in low:
            return f"TZ mentions '{w}'"
    return None


async def validate_drawing_element(
    element_type: str,
    reasoning: str,
    source: str,
    area_m2: Optional[float] = None,
    count: Optional[int] = None,
    length_m: Optional[float] = None,
    dxf_rooms: Optional[list] = None,
    dxf_counts: Optional[list] = None,
    tz_text: str = "",
) -> dict:
    """Validate one host-vision element against DXF + TZ (Pattern 40 gate).

    The host walks the drawing reasoning like a rozpočtář and submits an element
    via this schema. The tool grounds it deterministically and scores confidence:

      vision + DXF + TZ -> 0.95 VERIFIED
      vision + DXF      -> 0.90 VERIFIED
      vision + TZ       -> 0.85 TZ_GROUNDED
      vision alone      -> 0.60 VISION_ONLY_OVERIT (+ OVĚŘIT flag)
      no `source`       -> 0.00 REJECTED_UNGROUNDED  (P40 gate)

    DXF matching is TYPE-AWARE: an area matches a DXF room only when the area is
    within tolerance AND the element references that room by číslo or název — bare
    area coincidence does not count.

    Args:
        element_type: Element name in Czech (e.g. 'sklad podlaha',
            'patky horní 2 řady ztracené bednění'). Used for TZ + DXF linkage.
        reasoning: The host's out-loud derivation (mandatory — forces grounding).
        source: Drawing/TZ reference (e.g. 'řez A-A + DXF block patka ×6').
            REQUIRED — an empty source is rejected as ungrounded.
        area_m2: Element area in m² (optional).
        count: Element count (optional).
        length_m: Element length in m (optional).
        dxf_rooms: Deterministic DXF takeoff rooms — list of
            {cislo, nazev, area_m2} (from dxf_takeoff). Used to ground areas.
        dxf_counts: DXF block/label counts — list of {element, qty}.
        tz_text: TZ excerpt for keyword grounding.

    Returns a dict:
        - verdict: VERIFIED | TZ_GROUNDED | VISION_ONLY_OVERIT | REJECTED_UNGROUNDED
        - confidence: 0.0–0.95 per the ladder
        - evidence: list of grounding strings
        - overit: True when confidence < 0.85 (needs human verification)
        - _source: echo of the submitted source
    """
    if not source or not source.strip():
        return {"verdict": "REJECTED_UNGROUNDED", "confidence": 0.0, "evidence": [],
                "overit": True, "_source": None,
                "note": "no source — P40 gate rejects ungrounded vision"}

    evidence = []
    dxf = _dxf_hit(element_type, area_m2, count, dxf_rooms, dxf_counts)
    tz = _tz_hit(element_type, tz_text)
    if dxf:
        evidence.append(dxf)
    if tz:
        evidence.append(tz)
    evidence.append(f"vision source: {source}")

    if dxf and tz:
        conf, verdict = 0.95, "VERIFIED"
    elif dxf:
        conf, verdict = 0.90, "VERIFIED"
    elif tz:
        conf, verdict = 0.85, "TZ_GROUNDED"
    else:
        conf, verdict = 0.60, "VISION_ONLY_OVERIT"

    return {"verdict": verdict, "confidence": conf, "evidence": evidence,
            "overit": conf < 0.85, "_source": source,
            "note": "OVĚŘIT — vision alone, no DXF/TZ ground" if verdict == "VISION_ONLY_OVERIT" else ""}
