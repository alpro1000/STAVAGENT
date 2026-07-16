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
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

from app.mcp.tools.element_name_normalizer import normalize_element_name

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
    # 24. typ (TASK_Element24_UzavrenyRam_Tubus_v2_1, PR1). rebar 131 = kalibrace
    # n=1 ze SO 11-20-04 ŽST Turnov (XDC: 389365/389325 = 137 161 kg / 1 046,800 m³,
    # C30/37; tíha rámových rohů sedí UVNITŘ čísla) — NE norma. Orientation
    # 'special': tubus má vlastní fázový plán (spodní deska/stěny/strop), obecné
    # orientation-větve breakdown geometrie jsou pro něj ZAKÁZÁNY (task §2.10,
    # pin #1514). Formwork: stěny rámové systémy; při PB2/PB3 jen nosníkové
    # (Top 50 / VARIO GT 24) — filtr §2.5.
    "uzavreny_ram_tubus": {
        "label_cs": "Uzavřený rám (tubus) — podchod/propustek/podjezd",
        "difficulty": 1.1,
        "rebar_kg_m3": 131,
        "rebar_range": [90, 160],
        "orientation": "special",
        "formwork": ["Framax Xlife", "TRIO", "Top 50", "VARIO GT 24"],
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
    "zdivo_obklad": {
        # Lícové zdivo / obklad z lomového kamene — masonry/cladding, NOT
        # concrete (W3 §4): no rebar, no formwork, vertical, area/volume of
        # masonry. Without it, stone cladding falls to the residual category.
        "label_cs": "Lícové zdivo / obklad z lomového kamene",
        "difficulty": 1.0,
        "rebar_kg_m3": 0,
        "rebar_range": [0, 0],
        "orientation": "vertical",
        "formwork": [],
    },
    "gabionova_zed": {
        # Gabionová zeď — drátokošová konstrukce plněná kamenivem. NENÍ monolitický
        # beton (BUGS#5(3)): family=reject → is_concrete_element=False, žádná výztuž,
        # žádné bednění. Bez toho by gabion spadl do operna_zed = chybný beton-výpočet.
        "label_cs": "Gabionová zeď (drátokoš — nebetonová)",
        "difficulty": 1.0,
        "rebar_kg_m3": 0,
        "rebar_range": [0, 0],
        "orientation": "vertical",
        "formwork": [],
    },
    "podkladni_beton": {
        # 2026-07-07 (SO-202 Žalmanov): prostý beton — rebar 0 by design;
        # pre-fix these rolled up to "jine" (rebar 100 kg/m³ = fabricated).
        "label_cs": "Podkladní beton",
        "difficulty": 0.5,
        "rebar_kg_m3": 0,
        "rebar_range": [0, 0],
        "orientation": "horizontal",
        "formwork": ["Tradiční tesařské"],
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

# ── Single-source classification rules (TASK_2b / BUGS#5(3)) ─────────────────
# The keyword DATA lives ONCE in element_types.yaml (the same source the TS engine
# consumes via its generated kb artifact). W3 reads it directly and scores with the
# SAME algorithm as the engine (matchCount*10 + priority + bridge boost) → Python↔TS
# parity by construction; the wall-keyword drift (zárubní/gabion) that motivated
# BUGS#5(3) is now impossible. The head-noun DECISION stays in the normalizer (code).
_RULES_PATH = (
    Path(__file__).resolve().parents[2]
    / "classifiers" / "element_rules" / "element_types.yaml"
)

# W3-only structural types the engine taxonomy does NOT model as distinct concepts
# (no type_core entry, no engine ELEMENT_CATALOG). Kept as a W3-LOCAL supplement so
# converging the SHARED types to the YAML does not silently drop W3 capability.
# Not part of the single-sourced shared set → no drift risk (nothing to drift against).
_W3_LOCAL_KEYWORDS: dict[str, dict] = {
    "sachta": {"priority": 8, "include": ["sacht", "vytah", "elevator", "shaft"]},
    "izolacni_stena": {"priority": 8, "include": ["bila van", "vodon", "watertight",
                                                  "water tight", "wu beton", "wu-beton"]},
    "tunel_rampa": {"priority": 8, "include": ["tunel", "rampa", "koryt", "trough",
                                               "tunnel"]},
}

# reject family → W3 reject_reason (mirrors the TS engine reject reasons)
_REJECT_REASONS = {
    "zdivo_obklad": "masonry_cladding",
    "gabionova_zed": "gabion_non_concrete",
}


def _normalize(text: Optional[str]) -> str:
    """Lowercase + strip diacritics — mirrors the TS engine normalize()
    (element-classifier.ts) so the shared YAML keyword includes match identically."""
    decomposed = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


@lru_cache(maxsize=1)
def _load_rules() -> dict:
    """Parse the shared element-rules YAML once (cached)."""
    with open(_RULES_PATH, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


@lru_cache(maxsize=1)
def _keyword_rules() -> list[dict]:
    """Scored keyword table from the YAML (+ the W3-local supplement). Each rule:
    {etype, priority, include[normalized], exclude[normalized]}."""
    data = _load_rules()
    rules: list[dict] = []
    for source in (data["dictionaries"]["cs"]["keywords"], _W3_LOCAL_KEYWORDS):
        for etype, spec in source.items():
            rules.append(
                {
                    "etype": etype,
                    "priority": int(spec.get("priority", 0)),
                    "include": [_normalize(k) for k in spec.get("include", [])],
                    "exclude": [_normalize(k) for k in spec.get("exclude", [])],
                }
            )
    return rules


def _match_keyword_type(
    match_name: str, is_bridge: bool
) -> tuple[Optional[str], float, Optional[list]]:
    """Engine-parity keyword scoring (mirror of element-classifier.ts §keyword
    scoring + signal ladder). Returns (engine_type | None, confidence, candidates).

    score = matchCount*10 + priority + bridge_boost(+5 for bridge_boost types in
    bridge context). A different-type runner at the SAME score that is NOT a
    more-specific win (best_base <= runner_base) is genuine ambiguity → confidence
    drops to 0.7 and ranked candidates are emitted (so the caller can ask a human
    instead of shipping a confidently-wrong type)."""
    data = _load_rules()
    type_core = data["type_core"]
    bridge_remap = data.get("bridge_remap", {})
    norm = _normalize(match_name)

    matches: list[tuple[int, int, str]] = []  # (score, base_priority, etype)
    for rule in _keyword_rules():
        if rule["exclude"] and any(x and x in norm for x in rule["exclude"]):
            continue
        match_count = sum(1 for kw in rule["include"] if kw and kw in norm)
        if match_count == 0:
            continue
        etype = rule["etype"]
        boost = 5 if (is_bridge and type_core.get(etype, {}).get("bridge_boost")) else 0
        matches.append((match_count * 10 + rule["priority"] + boost, rule["priority"], etype))

    if not matches:
        return None, 0.3, None

    matches.sort(key=lambda m: (m[0], m[1]), reverse=True)
    best_score, best_base, best_type = matches[0]
    if is_bridge:
        best_type = bridge_remap.get(best_type, best_type)

    confidence, candidates = 0.9, None
    if len(matches) > 1:
        r_score, r_base, r_type = matches[1]
        r_mapped = bridge_remap.get(r_type, r_type) if is_bridge else r_type
        if r_mapped != best_type and r_score == best_score and best_base <= r_base:
            confidence = 0.7
            candidates = [
                type_core.get(best_type, {}).get("w3_name", best_type),
                type_core.get(r_mapped, {}).get("w3_name", r_mapped),
            ]
    return best_type, confidence, candidates


def _detect_concrete_class(name: str) -> Optional[str]:
    m = re.search(r"C\s*(\d{2,3})\s*/\s*(\d{2,3})", name)
    return m.group(0).replace(" ", "") if m else None


def _detect_prestress(name: str) -> bool:
    return bool(re.search(r"předp[ěj]|prestress|post[\s-]?tens|Y1860", name, re.I))


# ── 24. typ: podtyp + režim výstavby (task v2.1 §2.1/§2.6, ratifikováno
# 2026-07-16). Pořadí rozhoduje: propustek PŘED podchodem. Administrativní
# hranice propustek/most (světlost 2 m, SŽ) ovlivňuje jen PODTYP, ne rodinu.
_TUBUS_SUBTYPES: list = [
    ("ramovy_propustek", re.compile(r"propust")),
    ("podchod", re.compile(r"podchod")),
    ("podjezd", re.compile(r"podjezd")),
    ("hloubeny_tunel", re.compile(r"tunel")),
    ("kolektor", re.compile(r"kolektor")),
]
# Prefab signály (IZM/ZBM dílce, prefabrikované rámy, montáž dílců) vs. výchozí
# monolit (betonáž na místě). Hodnoty schématu: monolit | prefab — rozšiřitelné
# na tristav s `hybrid` (ES praxe Forte), binárnost NENÍ zabetonována.
_TUBUS_PREFAB_RE = re.compile(r"prefabrik|\bprefa\b|\bizm\b|\bzbm\b|montaz\s+dil|dilc")
# Primární closed-frame signál na RAW normalizovaném textu (early-detect):
# «uzavřený [železobetonový] rám», «uzavřená rámová konstrukce», «tubus».
# Adjektivum mezi slovy → regex s mezislovem, ne YAML substring.
_TUBUS_CLOSED_FRAME_RE = re.compile(
    r"tubus|uzavren\w*(?:\s+\w+){0,2}\s+ram(?:\b|ov)|uzavren\w*\s+ramov"
)
# Otevřený rám / polorám NIKDY tubus (Q9 + AC1) — stráž early-detectu.
_TUBUS_OPEN_GUARD_RE = re.compile(r"poloram|otevren")


def _result(
    etype: str,
    source: str,
    confidence: float,
    norm,
    name: str,
    *,
    candidates: Optional[list] = None,
    reject_reason: Optional[str] = None,
    subtype: Optional[str] = None,
    construction_mode: Optional[str] = None,
) -> dict:
    """Assemble a classify response from a resolved W3 element type + the
    normalization result. A reject (reject_reason set) flags is_concrete_element
    =False (mirror of the TS engine) so the caller skips rebar/formwork/costing."""
    profile = ELEMENT_TYPES.get(etype, ELEMENT_TYPES["jine"])
    out = {
        "element_type": etype,
        "label_cs": profile["label_cs"],
        "confidence": confidence,
        "classification_source": source,
        "difficulty_factor": profile["difficulty"],
        "rebar_ratio_kg_m3": profile["rebar_kg_m3"],
        "rebar_ratio_range": profile["rebar_range"],
        "orientation": profile["orientation"],
        "recommended_formwork": profile["formwork"],
        "is_bridge_context": norm.construction_context == "bridge",
        "construction_context": norm.construction_context,
        "status": norm.status,
        "concrete_class_detected": _detect_concrete_class(name),
        "is_prestressed_detected": _detect_prestress(name),
    }
    if candidates:
        out["candidates"] = candidates
    if reject_reason is not None:
        out["is_concrete_element"] = False
        out["reject_reason"] = reject_reason
    # 24. typ: aditivní pole JEN pro uzavreny_ram_tubus (ostatních 23 typů se
    # response shape nemění — zpětná kompatibilita task §3).
    if construction_mode is not None:
        out["construction_mode"] = construction_mode
        out["subtype"] = subtype
    return out


def _classify(
    name: str,
    object_code: Optional[str] = None,
    object_type: Optional[str] = None,
) -> dict:
    """Classify an element by name.

    The raw name first passes through the normalization layer (head-noun
    canonicalization + construction context + status — code, per TASK_2b). The
    matcher then scores the canonical string against the SHARED element-rules YAML
    with the engine's algorithm (parity by construction). The matched ENGINE type is
    emitted under its W3 alias (w3_name); a reject (gabionová zeď via early-exit,
    lícové zdivo via the reject family) carries is_concrete_element=False + a reason.
    """
    norm = normalize_element_name(name, object_code, object_type)
    is_bridge = norm.construction_context == "bridge"

    # GABION early-exit (BUGS#5(3)): a gabionová / drátokošová zeď is wire baskets +
    # stone, NOT monolithic concrete. Reject ANY name mentioning gabion BEFORE the
    # concrete scorer (mirror of the TS engine early-exit) — pricing a gabion as a
    # concrete retaining wall is the worst outcome (confident wrong cost).
    if "gabion" in _normalize(name):
        return _result(
            "gabionova_zed", "keywords", 0.9, norm, name,
            reject_reason="gabion_non_concrete",
        )

    # UZAVŘENÝ RÁM early-detect (24. typ, zrcadlo GABION vzoru — sken RAW textu):
    # head-noun normalizer řeže participiální ocas, takže golden věta «nosná
    # konstrukce je navržena jako uzavřený železobetonový rám…» dorazí do
    # keyword matcheru jako holé «nosná konstrukce» (= deck) a closed-frame
    # signál se ztratí. Diskriminátor Q9: uzavřený průřez BIJE head-noun i
    # název objektu. Vylučovací stráž: polorám/otevřený (schodišťový polorám
    # NENÍ tubus, AC1). Slova podchod/propustek zůstávají sekundární — ta řeší
    # keyword tier přes YAML, ne tento early-detect.
    raw_norm = _normalize(name)
    if not _TUBUS_OPEN_GUARD_RE.search(raw_norm) and _TUBUS_CLOSED_FRAME_RE.search(raw_norm):
        return _result(
            "uzavreny_ram_tubus", "keywords", 0.9, norm, name,
            subtype=next((s for s, p in _TUBUS_SUBTYPES if p.search(raw_norm)), None),
            construction_mode="prefab" if _TUBUS_PREFAB_RE.search(raw_norm) else "monolit",
        )

    engine_type, confidence, candidates = _match_keyword_type(norm.canonical_name, is_bridge)
    if engine_type is None:
        return _result("jine", "fallback", 0.3, norm, name)

    type_core = _load_rules()["type_core"]
    # Emit the W3 alias (w3_name) for the matched engine type — keeps the MCP output
    # vocabulary stable (calculator.py map / allowed-lists, goldens).
    etype = type_core.get(engine_type, {}).get("w3_name", engine_type)
    reject = type_core.get(engine_type, {}).get("family") == "reject"
    reason = _REJECT_REASONS.get(etype, "not_concrete_element") if reject else None
    # 24. typ: deterministický podtyp + režim výstavby (task v2.1 §2.1/§2.6).
    subtype = None
    mode = None
    if etype == "uzavreny_ram_tubus":
        n = _normalize(name)
        subtype = next((s for s, p in _TUBUS_SUBTYPES if p.search(n)), None)
        mode = "prefab" if _TUBUS_PREFAB_RE.search(n) else "monolit"
    return _result(
        etype, "keywords", confidence, norm, name,
        candidates=candidates, reject_reason=reason,
        subtype=subtype, construction_mode=mode,
    )


async def classify_construction_element(
    name: str,
    object_code: Optional[str] = None,
    object_type: Optional[str] = None,
) -> dict:
    """Classify a structural construction element into one of 23 types.

    Input: element name from TZ documentation (Czech or English).
    Output: element_type code, Czech label, difficulty factor (0.7-1.5),
    rebar ratio (kg/m³ with range), orientation (horizontal/vertical),
    recommended formwork systems, and bridge context detection.

    Uses deterministic keyword + regex matching (confidence 0.85),
    NOT an LLM — results are reproducible and instant.
    Bridge context auto-detected from object_code (SO-xxx pattern).

    Args:
        name: Element name exactly as it appears in TZ/project documentation.
            Can include concrete class and other specs — they are parsed out.
            Examples for bridge objects:
            - 'Piloty vrtané Ø900, C30/37' → pilota
            - 'Základy opěry OP1, C25/30' → zaklady_piliru
            - 'Dřík opěry OP1' or 'Opěra OP1 — dřík + úložný práh' → opery_ulozne_prahy
            - 'Křídla opěry OP1' → kridla_opery
            - 'Pilíř P2, C35/45' or 'Sloupy P2-P3' (with SO-xxx) → driky_piliru
            - 'NK — nosná konstrukce, předpjatý dvoutrám' → mostovkova_deska
            - 'Římsy monolitické, C30/37' → rimsa
            - 'Přechodová deska' → prechodova_deska
            Examples for building objects:
            - 'Stěna 1.PP, C25/30' → stena
            - 'Stropní deska nad 1.NP' → deska
            - 'Sloupy S1-S4, C30/37' → sloup (without SO-xxx context)
            - 'Bílá vana — základová deska + stěny' → izolacni_stena
            - 'Výtahová šachta' → sachta

        object_code: Building object code from project documentation.
            If it matches SO-xxx pattern (e.g. 'SO-202', 'SO 204'),
            classifier switches to bridge context — generic types are
            upgraded: sloup→driky_piliru, zaklady→zaklady_piliru,
            deska→mostovkova_deska.
            Without this hint, 'Sloupy P2' would classify as building
            column instead of bridge pier.

        object_type: AUTHORITATIVE construction-object type, classified ONCE from
            the project TZ and threaded per item by the orchestrator:
            'bridge' | 'retaining_wall' | 'building' (aliases: most / zarubni_zed
            / operna_zed / budova / pozemni). Preferred over object_code, because
            bridge and wall vocabulary overlaps (opěra, římsa, nosná konstrukce) —
            a bridge element with an ordinary name must not default to wall. When
            omitted, context falls back to deriving from name + object_code.
    """
    try:
        result = _classify(name, object_code, object_type)
        result["input_name"] = name
        if object_code:
            result["input_object_code"] = object_code
        if object_type:
            result["input_object_type"] = object_type
        return result
    except Exception as e:
        logger.error(f"[MCP/Classifier] Error: {e}")
        return {
            "error": str(e),
            "element_type": "jine",
            "confidence": 0.0,
        }
