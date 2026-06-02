#!/usr/bin/env python3
"""Part B: walk_drawings MCP validation gate (Pattern 40 host-delegated vision).

The host (ChatGPT/Claude/Gemini vision) walks each drawing reasoning like a
rozpočtář and submits elements via the `submit_element` schema. This gate is the
DETERMINISTIC validator the MCP server runs on every submission — it does NOT do
vision, it grounds the vision against DXF (Pattern 49) + TZ and assigns the
confidence per the P40 ladder, rejecting ungrounded claims.

Used for what DXF alone cannot give — the hidden logic Alexander reasons by hand
(patky = 2 rows; S01 vynos beyond the wall; wall face = obvod × řez height).

Confidence ladder (Část B §3):
  vision + DXF + TZ   -> 0.95
  vision + DXF        -> 0.90
  vision + TZ         -> 0.85
  vision alone        -> 0.60  (+ OVĚŘIT flag)
  no _source          -> REJECTED (ungrounded — P40 validation gate)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class Element:
    """What the host submits per submit_element schema."""
    type: str
    reasoning: str
    _source: str
    area_m2: float | None = None
    count: int | None = None
    length_m: float | None = None
    dimensions: dict = field(default_factory=dict)


def _label_link(el_type, room):
    """Type-aware linkage: the element must reference the room by číslo OR share a
    název keyword — area proximity alone is NOT enough (removes coincidental matches)."""
    t = el_type.lower()
    cislo = str(room.get("cislo", ""))
    if cislo and cislo in t:
        return f"číslo {cislo}"
    nazev = (room.get("nazev") or "").lower()
    for w in re.findall(r"[a-zřčšžýáíéúůňťďě]{4,}", nazev):
        if w in t:
            return f"název '{w}'"
    return None


def _dxf_area_hit(el, dxf_result, tol=0.05):
    """Type-aware: match a DXF room only when area is within tol AND there is a
    label linkage (číslo/název) — not bare area coincidence."""
    if el.area_m2 is None or not dxf_result:
        return None
    for obj in dxf_result.get("objekty", {}).values():
        for r in obj.get("rooms", []):
            a = r.get("area_m2")
            if not (a and abs(a - el.area_m2) / max(a, el.area_m2) <= tol):
                continue
            link = _label_link(el.type, r)
            if link:
                return f"DXF room {r.get('cislo')} = {a} m² (linked by {link})"
    return None


def _dxf_count_hit(count, label, dxf_result):
    if count is None or not dxf_result:
        return None
    for obj in dxf_result.get("objekty", {}).values():
        for c in obj.get("counts", []):
            if c.get("qty") == count and (not label or label.lower() in str(c.get("element", "")).lower()
                                          or label.lower() in str(c.get("_source", "")).lower()):
                return f"DXF count {c.get('element')} = {count}"
    return None


def _tz_hit(element, tz_text):
    if not tz_text:
        return None
    words = [w for w in re.findall(r"[a-zřčšžýáíéúůňťďě]{4,}", element.type.lower())]
    for w in words:
        if w in tz_text.lower():
            return f"TZ mentions '{w}'"
    return None


def validate_element(el: Element, dxf_result=None, tz_text="") -> dict:
    evidence = []
    if not el._source or not el._source.strip():
        return {"verdict": "REJECTED_UNGROUNDED", "confidence": 0.0,
                "evidence": [], "note": "no _source — P40 gate rejects ungrounded vision"}

    dxf = _dxf_area_hit(el, dxf_result) or _dxf_count_hit(el.count, el.type, dxf_result)
    tz = _tz_hit(el, tz_text)
    if dxf:
        evidence.append(dxf)
    if tz:
        evidence.append(tz)
    evidence.append(f"vision _source: {el._source}")

    if dxf and tz:
        conf, verdict = 0.95, "VERIFIED"
    elif dxf:
        conf, verdict = 0.90, "VERIFIED"
    elif tz:
        conf, verdict = 0.85, "TZ_GROUNDED"
    else:
        conf, verdict = 0.60, "VISION_ONLY_OVERIT"
    return {"verdict": verdict, "confidence": conf, "evidence": evidence,
            "note": "OVĚŘIT — vision alone, no DXF/TZ ground" if verdict == "VISION_ONLY_OVERIT" else ""}


# --- demo on the real hidden-logic gaps DXF could not resolve ---
def _demo():
    import json
    import glob
    dxf_files = sorted(glob.glob("test-data/RD_Jachymov_dum/outputs/DXF_VYMERY_*.json"))
    dxf_result = json.loads(open(dxf_files[-1]).read()) if dxf_files else None
    tz = "patky pro IPE180 dvoustupňové tvarovky ztraceného bednění opěrná stěna podlaha sklad"

    cases = [
        Element(type="patky horní 2 řady ztracené bednění", count=6,
                reasoning="Z řezu: nad spodní patkou 2 řady tvárnic ZB 300×300 (věnec), 6 patek.",
                _source="řez A-A + DXF block patka ×6"),
        Element(type="S01 vynos podlahy za stěnu", area_m2=6.0,
                reasoning="Řez B-B: skladba S01 přesahuje 1 m za stěnu (6010×1000), na půdorysu neviditelné.",
                _source="řez B-B (mimo DXF plán)"),
        Element(type="sklad podlaha", area_m2=17.6,
                reasoning="Místnost 0.01, podlaha betonová dlažba.",
                _source="DXF room-label + tabulka místností"),
        Element(type="výška dveří odhad", area_m2=None,
                reasoning="Dveřní otvor — výšku odhaduji 2000 mm, není kótováno.",
                _source=""),  # ungrounded -> rejected
    ]
    print(f"DXF ground: {dxf_files[-1].split('/')[-1] if dxf_files else 'none'}\n")
    for el in cases:
        r = validate_element(el, dxf_result, tz)
        print(f"  [{r['verdict']:22}] conf={r['confidence']}  {el.type[:40]}")
        for ev in r["evidence"]:
            print(f"        · {ev[:70]}")
        if r["note"]:
            print(f"        ⚠ {r['note']}")
        print()


if __name__ == "__main__":
    _demo()
