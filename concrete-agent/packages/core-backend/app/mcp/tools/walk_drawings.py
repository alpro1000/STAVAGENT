"""
Module: walk_drawings  (concept: the host "walks" the drawings)
Registered MCP tool name: validate_drawing_element  ← canonical, used everywhere
in the registry (server / routes / auth / test). "walk_drawings" is only the
module/flow name, never the tool name.

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
            # max(..., 0.001) guards division even if the truthy guards above are
            # ever relaxed (sub-mm² areas are never real rooms anyway).
            if a and abs(a - area_m2) / max(a, area_m2, 0.001) <= tol and _label_link(element_type, r):
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


# ── Notes branch (half-B Gate 4, ADR-008 §3) ─────────────────────────────────
# The calculable-critical construction_process trio lives as an IMAGE note on
# the drawing («NK BETONOVÁNA V 3 TAKTECH NA PEVNÉ SKRUŽI», SO-202 výkres
# 202/17 POZN. 3) — no text-extraction path can reach it. The HOST's vision
# reads the note verbatim and parses the trio; this branch deterministically
# re-parses the submitted note TEXT and rejects any host claim the text does
# not carry (same P40 discipline: vision proposes, the gate grounds).

_CZ_NUMERALS = {
    1: ("1", "jedn"), 2: ("2", "dvou", "dvě", "dvema", "dvěma"),
    3: ("3", "tře", "tří", "tri", "trech"), 4: ("4", "čtyř", "ctyr"),
    5: ("5", "pět", "pet", "pěti"), 6: ("6", "šest", "sest"),
    7: ("7", "sedm"), 8: ("8", "osm"), 9: ("9", "devět", "devet", "devíti"),
    10: ("10", "deset", "deseti"),
}

# Order matters: mss/posuvná must be checked BEFORE the bare «skruž» stem —
# «posuvná skruž» contains both.
_FALSEWORK_STEMS = (
    ("mss", ("mss", "posuvn", "vysuvn", "výsuvn")),
    ("cantilever", ("letm",)),
    ("fixed_scaffolding", ("skruz", "skruž", "skruzi", "skruži", "pevn")),
)


def _strip_cs(text: str) -> str:
    import unicodedata
    d = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(ch for ch in d if unicodedata.category(ch) != "Mn")


def _note_confirms_stages(note_text: str, stages: int) -> bool:
    low = _strip_cs(note_text)
    return any(_strip_cs(tok) in low for tok in _CZ_NUMERALS.get(stages, ()))


def _note_falsework(note_text: str) -> Optional[str]:
    low = _strip_cs(note_text)
    for tech, stems in _FALSEWORK_STEMS:
        if any(_strip_cs(s) in low for s in stems):
            return tech
    return None


def _validate_construction_note(
    note_text: str,
    source: str,
    pour_stages: Optional[int],
    falsework_technology: Optional[str],
    tz_text: str,
) -> dict:
    """Ground the host-read drawing note against its own verbatim text (+ TZ).

    Ladder: both claims re-parsed from the note + TZ corroborates → 0.95
    VERIFIED · both from the note → 0.90 VERIFIED · partial → 0.60
    VISION_ONLY_OVERIT (per-field notes) · host claim CONTRADICTED by the
    note text → 0.0 REJECTED_MISMATCH (never a silent pass-through).
    """
    if not note_text or not note_text.strip():
        return {"verdict": "REJECTED_UNGROUNDED", "confidence": 0.0, "evidence": [],
                "overit": True, "_source": source,
                "note": "empty note_text — the verbatim note is the ground, not the host's memory"}

    evidence: list = []
    problems: list = []

    stages_ok = None
    if pour_stages is not None:
        stages_ok = _note_confirms_stages(note_text, int(pour_stages))
        if stages_ok:
            evidence.append(f"note text confirms {pour_stages} takty")
        else:
            problems.append(f"note text does NOT carry the claimed stage count {pour_stages}")

    fw_ok = None
    if falsework_technology:
        parsed = _note_falsework(note_text)
        fw_ok = parsed == falsework_technology
        if fw_ok:
            evidence.append(f"note text confirms falsework '{falsework_technology}'")
        elif parsed is not None:
            problems.append(
                f"note text parses falsework as '{parsed}', host claimed '{falsework_technology}'")
        else:
            problems.append("note text carries no recognizable falsework keyword")

    # A falsework contradiction is a hard reject — a wrong trio poisons the
    # whole plan (num_tacts_override + technology feed the engine directly).
    if fw_ok is False and _note_falsework(note_text) is not None:
        return {"verdict": "REJECTED_MISMATCH", "confidence": 0.0, "evidence": evidence,
                "overit": True, "_source": source, "problems": problems,
                "note": "host claim contradicts the verbatim note text"}

    both_confirmed = bool(stages_ok) and bool(fw_ok)
    tz_corroborates = bool(tz_text) and (
        (pour_stages is not None and _note_confirms_stages(tz_text, int(pour_stages)))
        or (falsework_technology and _note_falsework(tz_text) == falsework_technology)
    )

    if both_confirmed and tz_corroborates:
        conf, verdict = 0.95, "VERIFIED"
    elif both_confirmed:
        conf, verdict = 0.90, "VERIFIED"
    elif stages_ok or fw_ok:
        conf, verdict = 0.60, "VISION_ONLY_OVERIT"
    else:
        conf, verdict = 0.0, "REJECTED_UNGROUNDED"

    out = {"verdict": verdict, "confidence": conf, "evidence": evidence,
           "overit": conf < 0.85, "_source": source}
    if problems:
        out["problems"] = problems
    if verdict == "VERIFIED":
        # Ready-to-paste passport fragment — the assembler/host applies it
        # ONLY on VERIFIED (the gate never writes anything itself).
        out["construction_process"] = {
            **({"deck_pour_stages": int(pour_stages)} if pour_stages is not None else {}),
            "deck_pour_stages_source": source,
            **({"falsework_technology": falsework_technology} if falsework_technology else {}),
        }
    return out


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
    note_text: Optional[str] = None,
    pour_stages: Optional[int] = None,
    falsework_technology: Optional[str] = None,
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
        note_text: half-B Gate 4 (ADR-008 §3) — the VERBATIM drawing-note text
            the host's vision read (e.g. «NK BETONOVÁNA V 3 TAKTECH NA PEVNÉ
            SKRUŽI»). When set, the call validates a CONSTRUCTION-PROCESS NOTE
            instead of an element: the gate re-parses the note text
            deterministically and rejects any host claim the text does not
            carry. On VERIFIED the response includes a ready-to-paste
            `construction_process` fragment for the bridge passport.
        pour_stages: host-parsed deck pour-stage count from the note (notes mode).
        falsework_technology: host-parsed technology from the note —
            'fixed_scaffolding' | 'mss' | 'cantilever' (notes mode).

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

    # Notes mode (half-B Gate 4): a verbatim drawing note carrying the
    # construction_process trio — a different grounding path than elements.
    if note_text is not None:
        return _validate_construction_note(
            note_text, source, pour_stages, falsework_technology, tz_text,
        )

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
