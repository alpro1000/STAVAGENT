"""
MCP Tool: classify_construction_element

Classifies a construction element into one of 22+ structural types
with difficulty factor, formwork recommendations, and rebar ratios.

The element classifier logic is in TypeScript (Monolit-Planner/shared),
so this MCP tool implements a simplified Python version using the same
classification rules (OTSKP patterns + keyword matching).
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# ── Element type definitions (mirroring element-classifier.ts) ───────────────

ELEMENT_TYPES = {
    "zaklady_piliru": {
        "label_cs": "Základy pilířů / patky",
        "difficulty": 0.9,
        "rebar_kg_m3": 100,
        "rebar_range": [80, 120],
        "orientation": "vertical",
        "formwork": ["Frami Xlife", "DOMINO", "Tradiční tesařské"],
    },
    "driky_piliru": {
        "label_cs": "Dříky pilířů / sloupy",
        "difficulty": 1.1,
        "rebar_kg_m3": 150,
        "rebar_range": [120, 200],
        "orientation": "vertical",
        "formwork": ["VARIO GT 24", "TRIO", "QUATTRO", "Framax Xlife"],
    },
    "opery_ulozne_prahy": {
        "label_cs": "Opěry / úložné prahy",
        "difficulty": 1.2,
        "rebar_kg_m3": 130,
        "rebar_range": [100, 160],
        "orientation": "vertical",
        "formwork": ["VARIO GT 24", "Framax Xlife"],
    },
    "kridla_opery": {
        "label_cs": "Křídla opěry",
        "difficulty": 1.3,
        "rebar_kg_m3": 120,
        "rebar_range": [90, 150],
        "orientation": "vertical",
        "formwork": ["Framax Xlife", "VARIO GT 24"],
    },
    "mostovkova_deska": {
        "label_cs": "Mostovková deska / NK",
        "difficulty": 1.5,
        "rebar_kg_m3": 180,
        "rebar_range": [140, 250],
        "orientation": "horizontal",
        "formwork": ["Pevná skruž", "Posuvná skruž", "CFT"],
    },
    "rimsa": {
        "label_cs": "Římsa",
        "difficulty": 1.4,
        "rebar_kg_m3": 130,
        "rebar_range": [100, 160],
        "orientation": "horizontal",
        "formwork": ["Římsový vozík", "Konzolové lešení"],
    },
    "pricinik": {
        "label_cs": "Příčník",
        "difficulty": 1.3,
        "rebar_kg_m3": 160,
        "rebar_range": [130, 200],
        "orientation": "vertical",
        "formwork": ["VARIO GT 24", "Framax Xlife"],
    },
    "stena": {
        "label_cs": "Stěna",
        "difficulty": 1.0,
        "rebar_kg_m3": 80,
        "rebar_range": [50, 120],
        "orientation": "vertical",
        "formwork": ["Framax Xlife", "Frami Xlife"],
    },
    "deska": {
        "label_cs": "Stropní deska / deska",
        "difficulty": 0.9,
        "rebar_kg_m3": 90,
        "rebar_range": [60, 130],
        "orientation": "horizontal",
        "formwork": ["Dokaflex", "SKYDECK", "Stropní stoly"],
    },
    "sloup": {
        "label_cs": "Sloup (pozemní)",
        "difficulty": 1.0,
        "rebar_kg_m3": 160,
        "rebar_range": [120, 220],
        "orientation": "vertical",
        "formwork": ["SL-1 Sloupové", "QUATTRO", "TRIO"],
    },
    "pruvlak": {
        "label_cs": "Průvlak / trám",
        "difficulty": 1.1,
        "rebar_kg_m3": 140,
        "rebar_range": [100, 180],
        "orientation": "horizontal",
        "formwork": ["Dokaflex", "Tradiční tesařské"],
    },
    "schodiste": {
        "label_cs": "Schodiště",
        "difficulty": 1.3,
        "rebar_kg_m3": 100,
        "rebar_range": [70, 130],
        "orientation": "horizontal",
        "formwork": ["Tradiční tesařské"],
    },
    "zaklady": {
        "label_cs": "Základy (pozemní)",
        "difficulty": 0.8,
        "rebar_kg_m3": 80,
        "rebar_range": [50, 110],
        "orientation": "vertical",
        "formwork": ["Frami Xlife", "DOMINO", "Tradiční tesařské"],
    },
    "pilota": {
        "label_cs": "Pilota",
        "difficulty": 0.7,
        "rebar_kg_m3": 60,
        "rebar_range": [40, 100],
        "orientation": "vertical",
        "formwork": [],
    },
    "zakladova_deska": {
        "label_cs": "Základová deska",
        "difficulty": 0.8,
        "rebar_kg_m3": 90,
        "rebar_range": [60, 120],
        "orientation": "horizontal",
        "formwork": ["Tradiční tesařské"],
    },
    "prechodova_deska": {
        "label_cs": "Přechodová deska",
        "difficulty": 1.0,
        "rebar_kg_m3": 100,
        "rebar_range": [80, 130],
        "orientation": "horizontal",
        "formwork": ["Tradiční tesařské"],
    },
    "izolacni_stena": {
        "label_cs": "Izolační stěna / bílá vana",
        "difficulty": 1.2,
        "rebar_kg_m3": 100,
        "rebar_range": [80, 130],
        "orientation": "vertical",
        "formwork": ["Framax Xlife", "Frami Xlife"],
    },
    "sachta": {
        "label_cs": "Šachta (výtahová, technická)",
        "difficulty": 1.3,
        "rebar_kg_m3": 100,
        "rebar_range": [80, 130],
        "orientation": "vertical",
        "formwork": ["Frami Xlife"],
    },
    "nadrz": {
        "label_cs": "Nádrž / jímka / retenční",
        "difficulty": 1.2,
        "rebar_kg_m3": 110,
        "rebar_range": [80, 140],
        "orientation": "vertical",
        "formwork": ["Framax Xlife", "Frami Xlife"],
    },
    "tunel_rampa": {
        "label_cs": "Tunel / rampa / korytový profil",
        "difficulty": 1.4,
        "rebar_kg_m3": 130,
        "rebar_range": [100, 170],
        "orientation": "vertical",
        "formwork": ["VARIO GT 24", "Framax Xlife"],
    },
    "operna_zed": {
        "label_cs": "Opěrná zeď / gabionová",
        "difficulty": 1.0,
        "rebar_kg_m3": 70,
        "rebar_range": [40, 100],
        "orientation": "vertical",
        "formwork": ["Framax Xlife", "Frami Xlife"],
    },
    "jine": {
        "label_cs": "Jiné / nespecifikováno",
        "difficulty": 1.0,
        "rebar_kg_m3": 100,
        "rebar_range": [60, 150],
        "orientation": "vertical",
        "formwork": ["Framax Xlife"],
    },
}

# ── Classification rules ─────────────────────────────────────────────────────

# Bridge context markers
BRIDGE_MARKERS = re.compile(r"SO[-\s]?\d{3}|most|bridge|přemost|lávk", re.I)

# Classification keywords (order matters — first match wins within priority)
KEYWORD_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"pilot[ay]|vrtan|CFA|mikropilot", re.I), "pilota"),
    (re.compile(r"mostovk|nosn[aá]\s*konstr|NK\s|hmotn|superstr", re.I), "mostovkova_deska"),
    (re.compile(r"říms[ay]|corniche|parapetní", re.I), "rimsa"),
    (re.compile(r"příčník|cross[\s-]?beam|diaphragm", re.I), "pricinik"),
    (re.compile(r"dřík|pilíř|pier\b|column.*bridge", re.I), "driky_piliru"),
    (re.compile(r"opěr[ay].*křídl|křídl.*opěr", re.I), "opery_ulozne_prahy"),
    (re.compile(r"křídl[ao]|wing\s*wall", re.I), "kridla_opery"),
    (re.compile(r"opěr[ay]|abutment|úložn[ýé]\s*prah", re.I), "opery_ulozne_prahy"),
    (re.compile(r"přechod.*desk|transition\s*slab", re.I), "prechodova_deska"),
    (re.compile(r"základov[áé]\s*desk|found.*slab", re.I), "zakladova_deska"),
    (re.compile(r"základ.*pilíř|patk[ay]|pile\s*cap|foot", re.I), "zaklady_piliru"),
    (re.compile(r"základ[ůy]|found|zákl\.\s*pás|zákl\.\s*pata", re.I), "zaklady"),
    (re.compile(r"šacht[ay]|výtah|elevator|shaft", re.I), "sachta"),
    (re.compile(r"bílá\s*van|vodon|water.*tight|WU[\s-]?beton", re.I), "izolacni_stena"),
    (re.compile(r"nádrž|jímk|reten[cč]|cistern|tank", re.I), "nadrz"),
    (re.compile(r"tunel|rampa|koryt|trough|tunnel", re.I), "tunel_rampa"),
    (re.compile(r"opěrn[áé]\s*z[eě]ď|retaining|gabion|tížn", re.I), "operna_zed"),
    (re.compile(r"schod|stair", re.I), "schodiste"),
    (re.compile(r"průvlak|trám|beam|nosník", re.I), "pruvlak"),
    (re.compile(r"sloup[ůy]?\b|column", re.I), "sloup"),
    (re.compile(r"desk[ay]|strop|slab|floor\s*slab|ceiling", re.I), "deska"),
    (re.compile(r"stěn[ay]|wall|zd[ií]", re.I), "stena"),
]


def _detect_concrete_class(name: str) -> Optional[str]:
    m = re.search(r"C\s*(\d{2,3})\s*/\s*(\d{2,3})", name)
    return m.group(0).replace(" ", "") if m else None


def _detect_prestress(name: str) -> bool:
    return bool(re.search(r"předp[ěj]|prestress|post[\s-]?tens|Y1860", name, re.I))


def _classify(name: str, object_code: Optional[str] = None) -> dict:
    """Classify element by name."""
    is_bridge = bool(BRIDGE_MARKERS.search(object_code or ""))

    # Try keyword rules
    for pattern, etype in KEYWORD_RULES:
        if pattern.search(name):
            # Bridge context: upgrade pozemní types to mostní equivalents
            if is_bridge:
                bridge_map = {
                    "sloup": "driky_piliru",
                    "zaklady": "zaklady_piliru",
                    "deska": "mostovkova_deska",
                }
                etype = bridge_map.get(etype, etype)

            profile = ELEMENT_TYPES.get(etype, ELEMENT_TYPES["jine"])
            return {
                "element_type": etype,
                "label_cs": profile["label_cs"],
                "confidence": 0.85,
                "classification_source": "keywords",
                "difficulty_factor": profile["difficulty"],
                "rebar_ratio_kg_m3": profile["rebar_kg_m3"],
                "rebar_ratio_range": profile["rebar_range"],
                "orientation": profile["orientation"],
                "recommended_formwork": profile["formwork"],
                "is_bridge_context": is_bridge,
                "concrete_class_detected": _detect_concrete_class(name),
                "is_prestressed_detected": _detect_prestress(name),
            }

    # No match
    profile = ELEMENT_TYPES["jine"]
    return {
        "element_type": "jine",
        "label_cs": profile["label_cs"],
        "confidence": 0.3,
        "classification_source": "fallback",
        "difficulty_factor": profile["difficulty"],
        "rebar_ratio_kg_m3": profile["rebar_kg_m3"],
        "rebar_ratio_range": profile["rebar_range"],
        "orientation": profile["orientation"],
        "recommended_formwork": profile["formwork"],
        "is_bridge_context": is_bridge,
        "concrete_class_detected": _detect_concrete_class(name),
        "is_prestressed_detected": _detect_prestress(name),
    }


async def classify_construction_element(
    name: str,
    object_code: Optional[str] = None,
) -> dict:
    """Classify a structural construction element into one of 22 types.

    Types include: pilota, základ, dřík pilíře, opěra, mostovka, římsa,
    stěna, deska, sloup, průvlak, schodiště, and more.
    Distinguishes bridge vs building types.
    Returns difficulty coefficient and formwork recommendations.

    Args:
        name: Element name from project documentation, in Czech,
              e.g. 'Mostní pilíře P2-P3, C35/45'
        object_code: Building object code, e.g. 'SO-204'
                     (helps distinguish bridge vs building context)
    """
    try:
        result = _classify(name, object_code)
        result["input_name"] = name
        if object_code:
            result["input_object_code"] = object_code
        return result
    except Exception as e:
        logger.error(f"[MCP/Classifier] Error: {e}")
        return {
            "error": str(e),
            "element_type": "jine",
            "confidence": 0.0,
        }
