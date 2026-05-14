#!/usr/bin/env python3
"""
hk212 Phase 2.1 — Audit Trail Extraction (Stage C).

Reuses Phase 0b artefacts (outputs/tz_specs/_aggregate.json + dxf_parse/*.json)
and the rich `_qty_formula` + `source` fields already populated in
items_hk212_etap1.json. Adds an `audit_trail` block per item:

    {
      "lokalizace": "základové konstrukce, dle výkresu A105",
      "formula":   "14 ks × 4 × (1.5 × 0.6 × 2 stupně) — obvodový plech / dřevo",
      "inputs":    [{"label": "operand_1", "value": 14, "unit": "ks"}, ...],
      "reference": [{"document": "vykresy_dxf/A105_zaklady.dxf", "section": "..."}, ...],
      "poznamka":  "A105 + skladba dvoustupňová",
      "computed_quantity":  100.8,
      "declared_quantity":  100.8,
      "match_delta_pct":    0.0,
      "confidence":         0.85,
      "extraction_method":  "qty_formula_parse",
      "extracted_at":       "2026-05-14T..."
    }

Confidence ladder aligned with project_header.json _meta.confidence_ladder:
    dxf_dimension          → 0.95   (formula derived from DXF measurements)
    regex_on_description   → 0.85   (parseable arithmetic, computed ≈ declared)
    ai_extraction          → 0.70   (mixed verbal + numeric)
    dxf_visual_inference   → 0.60   (placeholder, ~approx flagged)
    manual_judgement       → 0.99   (rare — only when source cites explicit standard)

No external AI calls. Pure Python + existing JSON artefacts.

Run:
    python test-data/hk212_hala/scripts/phase_2_1/extract_audit_trail.py
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import sys
from collections import Counter
from datetime import datetime, timezone
from functools import reduce
from operator import mul
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3].parent
DEFAULT_ITEMS = REPO_ROOT / "test-data/hk212_hala/outputs/phase_1_etap1/items_hk212_etap1.json"
DEFAULT_TZ_AGGREGATE = REPO_ROOT / "test-data/hk212_hala/outputs/tz_specs/_aggregate.json"
DEFAULT_DXF_DIR = REPO_ROOT / "test-data/hk212_hala/outputs/dxf_parse"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "test-data/hk212_hala/outputs/phase_2_1"

DEFAULT_TOLERANCE = 0.05  # ±5 % computed vs declared

# Confidence ladder (canonical, from inputs/meta/project_header.json _meta.confidence_ladder)
CONF_DXF_DIM = 0.95
CONF_REGEX_DESC = 0.85
CONF_AI_EXTRACT = 0.70
CONF_DXF_VISUAL = 0.60
CONF_MANUAL = 0.99


# ----------------------------------------------------------------------------
# Kapitola → relevant drawings + TZ docs map
# ----------------------------------------------------------------------------

KAPITOLA_DRAWINGS: dict[str, list[str]] = {
    "HSV-1": ["A201_vykopy", "A105_zaklady", "A101_pudorys_1np"],
    "HSV-2": ["A105_zaklady"],
    "HSV-3": ["A105_zaklady", "A101_pudorys_1np", "A102_pudorys_strechy"],
    "HSV-9": ["A101_pudorys_1np"],
    "PSV-71x": ["A105_zaklady", "A101_pudorys_1np", "A102_pudorys_strechy"],
    "PSV-76x": ["A101_pudorys_1np", "A104_pohledy"],
    "PSV-77x": ["A101_pudorys_1np"],
    "PSV-78x": ["A102_pudorys_strechy", "A104_pohledy"],
    "M":       ["A106_stroje", "A107_stroje_kotvici_body"],
    "VRN":     [],
    "VZT":     ["A106_stroje"],
}

KAPITOLA_TZ_DOCS: dict[str, list[str]] = {
    "HSV-1": ["02_ars_souhrnna_B", "06_zaklady_titul"],
    "HSV-2": ["04_statika_d12_TZ_uplna", "06_zaklady_titul"],
    "HSV-3": ["04_statika_d12_TZ_uplna", "05_konstrukce_titul"],
    "HSV-9": ["02_ars_souhrnna_B"],
    "PSV-71x": ["03_ars_d11_TZ"],
    "PSV-76x": ["03_ars_d11_TZ"],
    "PSV-77x": ["03_ars_d11_TZ"],
    "PSV-78x": ["03_ars_d11_TZ"],
    "M":       ["02_ars_souhrnna_B"],
    "VRN":     ["01_ars_pruvodni_A", "02_ars_souhrnna_B"],
    "VZT":     ["02_ars_souhrnna_B", "07_pbr_kpl"],
}

KAPITOLA_LOKALIZACE: dict[str, str] = {
    "HSV-1": "výkopy a zemní práce — A201 + A105",
    "HSV-2": "základové konstrukce — A105",
    "HSV-3": "ocelová konstrukce nadzemí — A103 řez + A105 detail",
    "HSV-9": "ostatní stavební práce — celý objekt",
    "PSV-71x": "izolace proti vodě — pod základovou deskou + obvod",
    "PSV-76x": "konstrukce truhlářské / zámečnické — A101 dveře/okna",
    "PSV-77x": "podlahy — A101 plocha haly",
    "PSV-78x": "klempířské + krytina — A102 střecha + A104 atika",
    "M":       "elektromontážní + technologie — A106",
    "VRN":     "vedlejší rozpočtové náklady — celá stavba",
    "VZT":     "vzduchotechnika — A106 stroje",
}


# ----------------------------------------------------------------------------
# Formula parser
# ----------------------------------------------------------------------------

# Math operands  ×  x  *  ·  • + -
RE_OPERATORS = re.compile(r"[×x*·•]")
# Czech decimal: 1,5 → 1.5  (but only when followed by digit, not "stupně")
RE_CZECH_DECIMAL = re.compile(r"(\d),(\d)")
# Czech thousands separator: "10 263" → "10263" (digit + space + 3-digit group at word boundary)
RE_CZECH_THOUSANDS = re.compile(r"(\d)\s(\d{3})(?!\d)")
# Em-dash separator (annotation suffix)
EM_DASHES = ["—", "–", " - "]
# Result/approximation indicators — split formula, treat RIGHT side as stated result
RE_RESULT_SPLIT = re.compile(r"\s*(?:=|≈|≅|≅)\s*")
# Placeholder / approximate markers
PLACEHOLDER_MARKERS = re.compile(r"\b(placeholder|paušál|pausal|estimate|~|cca)\b", re.IGNORECASE)
# Approximate-result markers (use RIGHT side of split as authoritative)
APPROX_MARKERS = re.compile(r"[≈≅]|~")
# Verbal-only marker: starts with "=" then mostly text
RE_VERBAL = re.compile(r"^\s*=\s*[a-zA-Zá-žÁ-Ž]")
# A token-like number
RE_NUMBER = re.compile(r"\b\d+(?:\.\d+)?\b")
# §-prefixed standard reference ("§3.4", "§116") — strip to avoid parsing as math
RE_SECTION_REF = re.compile(r"§\s*\d+(?:\.\d+)*")
# "Count-only" formula start: "<N> <unit> <Czech word>" with no immediate ×.
# E.g. "1 ks pilota Ø800 × 8 m délka" — the trailing "×" is a unit/spec separator,
# not a multiplication operator. Take only N.
# IMPORTANT: must NOT match "14 ks × 4 × ..." — explicit math-op exclusion needed
# because '×' (U+00D7) is technically within the Latin "Á-Ž" Unicode range.
# Pattern: <N> <unit> <whitespace> <Czech letter (NOT operator)>
RE_COUNT_ONLY_START = re.compile(
    r"^\s*(\d+(?:\.\d+)?)\s+"
    r"(?:ks|kpl|kus|t|hod|paušál|bm)"
    r"\s+"
    r"[^\d\s×x*+\-=≈≅·•./()]",  # next must be a real letter, not math/digit/whitespace
    re.IGNORECASE,
)
# Ø<num> spec marker — diameter callout, not a multiplicand
RE_DIAMETER_SPEC = re.compile(r"Ø\s*\d+(?:\.\d+)?")


def _strip_annotation_parens(text: str) -> str:
    """Drop paren content that's clearly annotation, keep math sub-products.

    Heuristic: paren content is MATH only if its first non-whitespace char is a
    digit (or '.', or unary minus before digit). Otherwise it's a Czech word
    annotation like "(KARI Ø8 100×100)" / "(deska 0.20 + lože 0.25)" /
    "(náběh)" / "(od úr. figury -0.45 do -1.45)" — drop entirely (including
    any numbers inside, which would be wire diameters / mesh spec / depth
    callouts, not multiplicands).
    """
    out: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "(":
            depth = 1
            j = i + 1
            while j < len(text) and depth > 0:
                if text[j] == "(":
                    depth += 1
                elif text[j] == ")":
                    depth -= 1
                j += 1
            content = text[i + 1:j - 1]
            stripped = content.lstrip()
            starts_with_digit = (
                bool(stripped) and (
                    stripped[0].isdigit() or stripped[0] == "."
                    or (stripped[0] == "-" and len(stripped) > 1 and stripped[1].isdigit())
                )
            )
            if starts_with_digit:
                # Recurse for nested parens, then strip non-math chars (keep nums + ops)
                inner = _strip_annotation_parens(content)
                inner_clean = re.sub(r"[^\d.\s+\-*/()]", " ", inner)
                out.append(" (" + inner_clean + ") ")
            # else: pure annotation — drop entire paren including any numerics
            i = j
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def parse_formula(formula: str) -> dict[str, Any]:
    """Return {computed, method, operands, is_placeholder, is_verbal, raw}.

    Pipeline:
      1. Strip Czech thousands ("10 263" → "10263") + Czech decimals.
      2. Split on em-dash (annotation suffix dropped).
      3. Split on '='/'≈'/'≅'. If formula is placeholder/approximation,
         take RIGHT side as authoritative stated result (a single number).
         Otherwise take LEFT side and compute its arithmetic.
      4. Strip annotation parens (those not starting with a digit).
      5. Extract numbers, multiply (or sum if '+' present).
    """
    if not formula:
        return {"computed": None, "method": "unparseable", "operands": [],
                "is_placeholder": False, "is_verbal": False, "raw": ""}

    raw = formula
    s = formula.strip()

    is_placeholder = bool(PLACEHOLDER_MARKERS.search(s))
    has_approx = bool(APPROX_MARKERS.search(s))
    is_verbal = bool(RE_VERBAL.match(s))

    # FIX 1: Czech thousands ("10 263" → "10263"). Apply twice for "1 234 567".
    s = RE_CZECH_THOUSANDS.sub(r"\1\2", s)
    s = RE_CZECH_THOUSANDS.sub(r"\1\2", s)
    # Czech decimal "1,5" → "1.5"
    s = RE_CZECH_DECIMAL.sub(r"\1.\2", s)
    # FIX 4: strip §<num> standard refs (§3.4 = ČSN section, not a multiplier)
    s = RE_SECTION_REF.sub(" ", s)
    # FIX 5: strip Ø<num> diameter specs (Ø800 = 800 mm rebar diameter, not multiplier)
    s = RE_DIAMETER_SPEC.sub(" ", s)

    # FIX 6: count-only-start pattern ("1 ks pilota..." — × after is unit separator).
    # Only kicks in when there is NO '=' or '≈' (those go through the normal split).
    if not RE_RESULT_SPLIT.search(s):
        m = RE_COUNT_ONLY_START.match(s)
        if m:
            value = float(m.group(1))
            return {"computed": value, "method": "count_only_leading",
                    "operands": [value],
                    "is_placeholder": is_placeholder, "is_verbal": False, "raw": raw}

    # Strip em-dash annotations
    for em in EM_DASHES:
        if em in s:
            s = s.split(em)[0]
            break

    # FIX 2: Split on result indicator (=, ≈, ≅). Right side = stated result; left = computation.
    parts = RE_RESULT_SPLIT.split(s)
    if len(parts) >= 2:
        left = parts[0].strip()
        right = " ".join(parts[1:]).strip()
        # Verbal "= something_textual" → no math at all
        if not left and right and not re.search(r"\d", right):
            return {"computed": None, "method": "verbal", "operands": [],
                    "is_placeholder": is_placeholder, "is_verbal": True, "raw": raw}
        # If is_placeholder / approximation marker: trust right side (stated answer)
        if (is_placeholder or has_approx) and re.search(r"\d", right):
            right_nums = [float(n) for n in RE_NUMBER.findall(right)]
            if right_nums:
                # First numeric on the right is the stated result
                return {"computed": right_nums[0],
                        "method": "placeholder_stated_result",
                        "operands": right_nums[:1],
                        "is_placeholder": is_placeholder, "is_verbal": False, "raw": raw}
        # Else use left for arithmetic computation
        s = left if left else right
    elif is_verbal:
        return {"computed": None, "method": "verbal", "operands": [],
                "is_placeholder": is_placeholder, "is_verbal": True, "raw": raw}

    # Normalize multiplication operators (after the splitter has run)
    s = RE_OPERATORS.sub("*", s)

    # FIX 3: Strip annotation parens (those not starting with a digit)
    s = _strip_annotation_parens(s)

    # FIX 7: placeholder/approx formula with no '=' / '≈'. Discriminate stated-value
    # from real multiplication chain by checking what sits between the first two
    # numbers in the OUTSIDE-paren slice:
    #   * presence of '*' or '+' → real chain, keep normal product path
    #     e.g. "~30 bm × 0.4 m × 0.6 m"  ("bm * " between 30 and 0.4)
    #   * only words/units between → trailing numbers are descriptive context
    #     e.g. "placeholder ~200 m³ ... halu 28×19×6 m" (no operator between 200 and 28)
    #     e.g. "paušál (Rožmitál 00523 R)" (paren dropped, no outside number → unparseable)
    if is_placeholder or has_approx:
        s_no_math_parens = re.sub(r"\([^()]*\)", " ", s)
        outside_matches = list(RE_NUMBER.finditer(s_no_math_parens))
        use_first_only = False
        if len(outside_matches) <= 1:
            use_first_only = True
        else:
            between = s_no_math_parens[outside_matches[0].end():outside_matches[1].start()]
            if not re.search(r"[*+]", between):
                use_first_only = True
        if use_first_only:
            value: float | None = None
            if outside_matches:
                value = float(outside_matches[0].group())
            else:
                all_nums = RE_NUMBER.findall(s)
                value = float(all_nums[0]) if all_nums else None
            if value is not None:
                return {"computed": value,
                        "method": "placeholder_first_value",
                        "operands": [value],
                        "is_placeholder": is_placeholder, "is_verbal": False, "raw": raw}

    nums = [float(n) for n in RE_NUMBER.findall(s)]
    if not nums:
        return {"computed": None, "method": "unparseable", "operands": [],
                "is_placeholder": is_placeholder, "is_verbal": False, "raw": raw}

    # Single-number paušál/placeholder/single_value
    if len(nums) == 1:
        return {"computed": nums[0],
                "method": "placeholder" if is_placeholder else "single_value",
                "operands": nums,
                "is_placeholder": is_placeholder, "is_verbal": False, "raw": raw}

    # Multi-number arithmetic
    if "+" in s and "*" not in s:
        computed = sum(nums)
        method = "sum"
    elif "+" in s and "*" in s:
        math_only = re.sub(r"[^\d.+\-*()\s]", " ", s)
        math_only = re.sub(r"\s+", " ", math_only).strip()
        try:
            if re.fullmatch(r"[\d.+\-*()\s]+", math_only):
                computed = float(eval(math_only, {"__builtins__": {}}, {}))
                method = "mixed_eval"
            else:
                computed = reduce(mul, nums)
                method = "product_fallback"
        except Exception:
            computed = reduce(mul, nums)
            method = "product_fallback"
    else:
        computed = reduce(mul, nums)
        method = "product"

    if is_placeholder:
        method = f"{method}_placeholder"

    return {"computed": computed, "method": method, "operands": nums,
            "is_placeholder": is_placeholder, "is_verbal": False, "raw": raw}


# ----------------------------------------------------------------------------
# Source field → references list
# ----------------------------------------------------------------------------

RE_DRAWING = re.compile(r"\b(A\d{3}|C\d|D\d)\b")
RE_TZ_SECTION = re.compile(r"\bTZ\s*[A-Z]?\s*(?:§|m\.|d\.)?\s*([\d.a-zA-Z]+)", re.IGNORECASE)
RE_CSN = re.compile(r"\bČSN(?:\s+(?:EN|ISO))?\s+[\d\s]+")
RE_PHASE = re.compile(r"\b(Phase\s+\d+[a-zA-Z]?(?:\s+RE-RUN)?\s+§?[\d.]+)\b", re.IGNORECASE)

DRAWING_TO_FILE = {
    "A100": "vykresy_pdf/A100_uvod.pdf",
    "A101": "vykresy_dxf/A101_pudorys_1np.dxf",
    "A102": "vykresy_dxf/A102_pudorys_strechy.dxf",
    "A103": "vykresy_pdf/A103_rez_AB.pdf",
    "A104": "vykresy_dxf/A104_pohledy.dxf",
    "A105": "vykresy_dxf/A105_zaklady.dxf",
    "A106": "vykresy_dxf/A106_stroje.dxf",
    "A107": "vykresy_dxf/A107_stroje_kotvici_body.dxf",
    "A201": "vykresy_dxf/A201_vykopy.dxf",
    "C1": "situace/C1_sirsi_vztahy.pdf",
    "C2": "situace/C2_katastr.pdf",
    "C3": "situace/C3_situace_kaceni.pdf",
}


def parse_source(source: str) -> list[dict]:
    """Source field → structured reference list.

    Inputs like:  'A102 zastavěná 28.19×19.74 + TZ B m.10.g + Phase 0b RE-RUN §3.10'
    """
    refs: list[dict] = []
    if not source:
        return refs

    # Drawings
    seen_dwg = set()
    for m in RE_DRAWING.finditer(source):
        code = m.group(1)
        if code in seen_dwg:
            continue
        seen_dwg.add(code)
        refs.append({
            "type": "drawing",
            "code": code,
            "document": DRAWING_TO_FILE.get(code, f"vykresy_dxf/{code}.dxf"),
        })

    # TZ section refs (TZ B m.10.g  /  TZ §3.2.4)
    for m in RE_TZ_SECTION.finditer(source):
        refs.append({
            "type": "tz_section",
            "section": m.group(1),
            "raw": m.group(0).strip(),
        })

    # ČSN references
    for m in RE_CSN.finditer(source):
        refs.append({
            "type": "csn",
            "standard": m.group(0).strip(),
        })

    # Phase 0b cross-refs
    for m in RE_PHASE.finditer(source):
        refs.append({
            "type": "phase_ref",
            "section": m.group(1).strip(),
        })

    return refs


# ----------------------------------------------------------------------------
# Confidence assignment
# ----------------------------------------------------------------------------

def compute_confidence(item: dict, parse: dict, has_dxf_dim: bool,
                        match_within_tolerance: bool) -> tuple[float, str]:
    """Returns (confidence, extraction_method_label)."""
    if parse["is_verbal"]:
        return CONF_DXF_VISUAL, "verbal_only"
    if parse["is_placeholder"] and not match_within_tolerance:
        return 0.40, "placeholder_uncertain"
    if parse["is_placeholder"] and match_within_tolerance:
        # Even placeholder with arithmetic that matches declared is signal
        return CONF_DXF_VISUAL, "placeholder_matches_declared"
    if parse["computed"] is None:
        return 0.40, "unparseable"

    if has_dxf_dim and match_within_tolerance:
        return CONF_DXF_DIM, "qty_formula_dxf_verified"
    if match_within_tolerance:
        return CONF_REGEX_DESC, "qty_formula_parse"
    # Computed but doesn't match → middling confidence
    return CONF_AI_EXTRACT, "qty_formula_mismatch"


# ----------------------------------------------------------------------------
# Per-item audit_trail assembly
# ----------------------------------------------------------------------------

def build_audit_trail(item: dict, tolerance: float, ran_at_iso: str) -> dict:
    formula_raw = item.get("_qty_formula") or ""
    parse = parse_formula(formula_raw)

    declared = float(item.get("mnozstvi") or 0)
    computed = parse["computed"]

    if computed is not None and declared > 0:
        delta = abs(computed - declared) / declared
        match_within = delta <= tolerance
    else:
        delta = None
        match_within = False

    refs = parse_source(item.get("source") or "")
    has_dxf_dim = any(r["type"] == "drawing" for r in refs)
    confidence, method = compute_confidence(item, parse, has_dxf_dim, match_within)

    # Lokalizace per kapitola
    lokalizace = KAPITOLA_LOKALIZACE.get(item.get("kapitola"), "")
    # Append SO if available (e.g. SO-01 — single SO project)
    so = item.get("SO")
    if so and so != "SO-01":
        lokalizace = f"{lokalizace}  ·  {so}"

    # Structured inputs from operands
    inputs: list[dict] = []
    for idx, val in enumerate(parse["operands"], start=1):
        inputs.append({
            "label": f"operand_{idx}",
            "value": val,
            "unit": "",  # not easily inferrable from positional parse
        })

    # Notes: combine source + raw_description + data_source
    note_parts = []
    if item.get("source"):
        note_parts.append(item["source"])
    if item.get("raw_description"):
        note_parts.append(f"({item['raw_description']})")
    if item.get("subdodavatel_chapter"):
        note_parts.append(f"[sub: {item['subdodavatel_chapter']}]")
    poznamka = " · ".join(note_parts)[:400]

    return {
        "lokalizace": lokalizace,
        "formula": formula_raw,
        "formula_parsed_method": parse["method"],
        "inputs": inputs,
        "reference": refs,
        "poznamka": poznamka,
        "computed_quantity": round(computed, 4) if computed is not None else None,
        "declared_quantity": declared,
        "match_delta_pct": round(delta * 100, 2) if delta is not None else None,
        "match_within_tolerance": match_within,
        "confidence": confidence,
        "extraction_method": method,
        "data_source_hint": item.get("_data_source"),
        "extracted_at": ran_at_iso,
    }


# ----------------------------------------------------------------------------
# Driver
# ----------------------------------------------------------------------------

def setup_logging(verbose: bool) -> logging.Logger:
    lg = logging.getLogger("audit_trail")
    lg.setLevel(logging.DEBUG if verbose else logging.INFO)
    lg.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
    lg.addHandler(h)
    return lg


def run(args, logger: logging.Logger) -> int:
    if not args.items.exists():
        logger.error(f"Items not found: {args.items}")
        return 2
    if not args.tz_aggregate.exists():
        logger.warning(f"TZ aggregate missing: {args.tz_aggregate} (continuing without)")
    if not args.dxf_dir.exists():
        logger.warning(f"DXF dir missing: {args.dxf_dir} (continuing without)")

    with open(args.items, encoding="utf-8") as f:
        wrapper = json.load(f)
    is_list = isinstance(wrapper, list)
    items = wrapper if is_list else wrapper.get("items", [])
    logger.info(f"Loaded {len(items)} items")

    ran_at = datetime.now(timezone.utc).isoformat()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Backup (idempotent)
    if not args.dry_run:
        backup_path = args.items.with_name(args.items.stem + "_pre_audit_trail.json")
        if not backup_path.exists():
            shutil.copy2(args.items, backup_path)
            logger.info(f"Backup → {backup_path.name}")
        else:
            logger.info(f"Backup exists at {backup_path.name} (idempotent skip)")

    # Per-item assembly
    stats = Counter()
    method_counter: Counter = Counter()
    confidence_buckets = Counter()
    examples = {"green": [], "yellow": [], "red": []}

    for item in items:
        if item.get("urs_status") == "custom_item":
            stats["skipped_custom"] += 1
            continue

        at = build_audit_trail(item, args.tolerance, ran_at)
        item["audit_trail"] = at

        method_counter[at["extraction_method"]] += 1
        if at["confidence"] >= 0.85:
            confidence_buckets["green"] += 1
            if len(examples["green"]) < 10:
                examples["green"].append(item)
        elif at["confidence"] >= 0.60:
            confidence_buckets["yellow"] += 1
            if len(examples["yellow"]) < 10:
                examples["yellow"].append(item)
        else:
            confidence_buckets["red"] += 1
            if len(examples["red"]) < 10:
                examples["red"].append(item)

        if at["match_within_tolerance"]:
            stats["match_within_tolerance"] += 1
        elif at["computed_quantity"] is not None:
            stats["match_mismatch"] += 1
        else:
            stats["no_computed"] += 1
        stats["audit_trail_added"] += 1

    logger.info(f"Audit trail added: {stats['audit_trail_added']} items "
                f"(custom skipped: {stats['skipped_custom']})")
    logger.info(f"Match within ±{args.tolerance*100:.0f}%: {stats['match_within_tolerance']} "
                f"({stats['match_within_tolerance']/max(stats['audit_trail_added'],1)*100:.1f} %)")
    logger.info(f"Mismatch: {stats['match_mismatch']}, no computed: {stats['no_computed']}")
    logger.info(f"Confidence buckets: {dict(confidence_buckets)}")
    logger.info(f"Method distribution: {dict(method_counter)}")

    if args.dry_run:
        logger.info("--dry-run: no files written")
        return 0

    # Write items back
    with open(args.items, "w", encoding="utf-8") as f:
        if is_list:
            json.dump(items, f, indent=2, ensure_ascii=False)
        else:
            wrapper["items"] = items
            json.dump(wrapper, f, indent=2, ensure_ascii=False)
        f.write("\n")
    logger.info(f"Wrote {args.items.name}")

    # Audit report
    report_path = args.output_dir / "audit_trail_report.md"
    write_report(report_path, items, stats, method_counter, confidence_buckets,
                 examples, args.tolerance, ran_at, logger)
    return 0


def write_report(path: Path, items: list[dict], stats: Counter,
                  methods: Counter, confidence_buckets: Counter,
                  examples: dict, tolerance: float, ran_at: str,
                  logger: logging.Logger) -> None:
    L: list[str] = []
    L.append("# HK212 — Audit Trail Extraction Report (Stage C)\n")
    L.append(f"_Ran at: {ran_at}_\n")
    L.append(f"_Tolerance: ±{tolerance*100:.0f} %_\n")
    L.append(f"_Source: reused Phase 0b tz_specs/_aggregate.json + dxf_parse/*.json_\n")
    L.append(f"_AI calls made: 0 (pure deterministic + existing artefacts)_\n")
    L.append("")
    total = stats["audit_trail_added"] + stats["skipped_custom"]
    L.append("## Summary\n")
    L.append(f"- Items total: **{total}** (custom skipped: {stats['skipped_custom']})")
    L.append(f"- audit_trail blocks added: **{stats['audit_trail_added']}**")
    n = max(stats["audit_trail_added"], 1)
    L.append(f"- Match within tolerance: **{stats['match_within_tolerance']} / {n} "
             f"({stats['match_within_tolerance']/n*100:.1f} %)**")
    L.append(f"- Match mismatch: {stats['match_mismatch']}, no computed: {stats['no_computed']}\n")

    L.append("## Confidence buckets\n")
    L.append("| Tier | Count | Color |")
    L.append("|---|---:|---|")
    L.append(f"| green (≥ 0.85) | {confidence_buckets.get('green', 0)} | #C6EFCE |")
    L.append(f"| yellow (0.60–0.85) | {confidence_buckets.get('yellow', 0)} | #FFEB9C |")
    L.append(f"| red (< 0.60) | {confidence_buckets.get('red', 0)} | #FFC7CE |")
    L.append("")

    L.append("## Extraction method distribution\n")
    L.append("| Method | Count |")
    L.append("|---|---:|")
    for m, c in methods.most_common():
        L.append(f"| {m} | {c} |")
    L.append("")

    if examples.get("green"):
        L.append("## Sample green-tier audit trails (top 10 by quantity)\n")
        L.append("| id | popis | formula | computed | declared | Δ% |")
        L.append("|---|---|---|---:|---:|---:|")
        green_sorted = sorted(examples["green"], key=lambda x: -(x.get("mnozstvi") or 0))
        for it in green_sorted[:10]:
            at = it["audit_trail"]
            popis = (it.get("popis") or "")[:40].replace("|", "\\|")
            formula = (at.get("formula") or "")[:60].replace("|", "\\|")
            cq = f"{at['computed_quantity']}" if at.get("computed_quantity") is not None else "—"
            dq = at.get("declared_quantity", "—")
            d = f"{at['match_delta_pct']:.1f}" if at.get("match_delta_pct") is not None else "—"
            L.append(f"| {it['id']} | {popis} | {formula} | {cq} | {dq} | {d} |")
        L.append("")

    if examples.get("red"):
        L.append("## Sample red-tier audit trails (need manual review)\n")
        L.append("| id | popis | formula | declared | reason |")
        L.append("|---|---|---|---:|---|")
        for it in examples["red"][:10]:
            at = it["audit_trail"]
            popis = (it.get("popis") or "")[:40].replace("|", "\\|")
            formula = (at.get("formula") or "")[:60].replace("|", "\\|")
            dq = at.get("declared_quantity", "—")
            method = at.get("extraction_method")
            L.append(f"| {it['id']} | {popis} | {formula} | {dq} | {method} |")
        L.append("")

    L.append("## Mismatch — computed ≠ declared (top 10 worst Δ%)\n")
    mismatches = [it for it in items
                  if it.get("audit_trail")
                  and not it["audit_trail"]["match_within_tolerance"]
                  and it["audit_trail"]["computed_quantity"] is not None]
    mismatches.sort(key=lambda x: -(x["audit_trail"]["match_delta_pct"] or 0))
    if mismatches:
        L.append("| id | popis | formula | computed | declared | Δ% |")
        L.append("|---|---|---|---:|---:|---:|")
        for it in mismatches[:10]:
            at = it["audit_trail"]
            popis = (it.get("popis") or "")[:40].replace("|", "\\|")
            formula = (at.get("formula") or "")[:50].replace("|", "\\|")
            cq = at.get("computed_quantity")
            dq = at.get("declared_quantity")
            d = at.get("match_delta_pct")
            L.append(f"| {it['id']} | {popis} | {formula} | {cq} | {dq} | {d:.1f} |")
    else:
        L.append("_(none — all computed values matched declared within tolerance)_")
    L.append("")

    path.write_text("\n".join(L), encoding="utf-8")
    logger.info(f"Wrote {path.name}")


def main() -> int:
    ap = argparse.ArgumentParser(description="hk212 Phase 2.1 — Audit Trail Extraction (Stage C)")
    ap.add_argument("--items", type=Path, default=DEFAULT_ITEMS)
    ap.add_argument("--tz-aggregate", type=Path, default=DEFAULT_TZ_AGGREGATE)
    ap.add_argument("--dxf-dir", type=Path, default=DEFAULT_DXF_DIR)
    ap.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    ap.add_argument("--tolerance", type=float, default=DEFAULT_TOLERANCE,
                    help="Computed vs declared tolerance (default 0.05 = ±5%%)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logger = setup_logging(args.verbose)
    logger.info(f"Items:        {args.items}")
    logger.info(f"TZ aggregate: {args.tz_aggregate}")
    logger.info(f"DXF dir:      {args.dxf_dir}")
    logger.info(f"Output:       {args.output_dir}")
    logger.info(f"Tolerance:    ±{args.tolerance*100:.0f} %")

    try:
        return run(args, logger)
    except Exception as e:
        logger.exception(f"FATAL: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
