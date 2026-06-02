"""
MCP Tool: extract_tz_fields — stage 1 (authoritative TEXT fields from the TZ).

Reads the recipe-input fields straight from a technical report (TZ) so the
orchestrator no longer needs them hand-fed in `request.options`:

  - the object NAME + the CHARAKTERISTIKA sentence  → feed detect_object_type (W3b);
  - the list of named structural ELEMENTS (NK, dříky, opěry, úložné prahy, římsy,
    základy, pilota…);
  - the CONCRETE CLASS bound to each element (not a dangling, element-less class).

Stage 1 is TEXT ONLY. Výměry / volumes from drawings (DXF / PDF geometry) are
stage 2 — every element ships `volume_m3=None` here, honestly marked, never faked.

Key rule (same trap as W3b): fields come from the document's SIGNED SECTIONS
(„Označení/Název objektu", „Charakteristika", the materials chapter), NEVER from a
full-text scan. A retaining-wall TZ mentions neighbouring bridges in its geology
section (SO-250: „mostní objekt" / „lávka SO 222"); a full-text "most" would
poison the name/charakteristika and flip the object type. We scan the structure.

Determinism-first (§3): the existing pdfplumber extractor + concrete-class regex
from `app.mcp.tools.document` are REUSED (not duplicated). The LLM (existing Vertex
routing) is a fallback ONLY for a materials section that won't parse
deterministically — and it sees that ONE section, never the full text.

Output shape == the orchestrator recipe input (`{object, elements}`), so it is a
drop-in replacement for `request.options` (criterion #100).

Reference: docs/tasks/TASK_Extract_Stage1_TZFields.md §1–§5.
"""
from __future__ import annotations

import base64
import logging
import re
import tempfile
from pathlib import Path
from typing import Any, Callable, Optional

# Reuse — do NOT duplicate — the pdfplumber text extractor and the concrete-class
# regex that analyze_construction_document already ships.
from app.mcp.tools.document import PATTERNS, _extract_pdf_text

logger = logging.getLogger(__name__)

_CONCRETE_RE = PATTERNS["concrete_class"]  # C(\d{2,3})/(\d{2,3})

# Injectable seams — module-level, NOT public-tool params. FastMCP builds a JSON
# schema from the registered tool's signature, and a Callable can't be expressed
# in JSON schema (PydanticInvalidForJsonSchema: CallableSchema). Keeping these as
# module globals (tests monkeypatch them) keeps extract_tz_fields' schema clean.
# `_TEXT_EXTRACTOR` defaults to the shared pdfplumber extractor; `_LLM` is the
# murky-materials fallback hook (default None → deterministic-only).
_TEXT_EXTRACTOR: Callable[[Path], str] = _extract_pdf_text
_LLM: Optional[Callable[[str], list[dict]]] = None
_PAGE_RE = re.compile(r"^---\s*PAGE\s+(\d+)\s*---\s*$", re.I)
_SO_CODE_RE = re.compile(r"\bSO[\s\-]?(\d{2,3})\b")

# Signed-section headers (matched on heading-like lines only — see _is_heading).
_SECTION_HEADERS: dict[str, re.Pattern] = {
    "identifikace": re.compile(
        r"identifika|označení\s+objektu|název\s+objektu|základní\s+údaje", re.I),
    "charakteristika": re.compile(r"charakteristik", re.I),
    "materialy": re.compile(
        r"materiál|specifikace\s+betonu|třídy\s+betonu|použité\s+materiály", re.I),
}

# Object-name label inside the identifikace section.
_NAME_LABEL_RE = re.compile(r"(?:Označení|Název)\s+objektu\s*:\s*(.+)", re.I)
# Leading "SO 250 – " / "SO-250: " prefix to strip off a descriptive name.
_NAME_CODE_PREFIX_RE = re.compile(r"^\s*SO[\s\-]?\d{2,3}\s*[–\-:]\s*", re.I)

# Named structural-element stems (diacritic-safe — Pattern 30). Order matters:
# NK / mostovka first so a "Nosná konstrukce" line is not mis-stemmed.
_ELEMENT_STEMS: list[re.Pattern] = [
    re.compile(r"nosná\s+konstrukce|\bNK\b|mostovk", re.I),
    re.compile(r"dřík", re.I),
    re.compile(r"opěr", re.I),
    re.compile(r"úložn", re.I),
    re.compile(r"říms", re.I),
    re.compile(r"křídl", re.I),
    re.compile(r"základ", re.I),
    re.compile(r"pilot", re.I),
    re.compile(r"\bstěn|\bzeď|\bzdi\b", re.I),
    re.compile(r"sloup|pilíř", re.I),
]


def _is_heading(line: str, section_re: re.Pattern) -> bool:
    """A line is a section heading when it matches the section keyword AND looks
    like a title: enumerated ("A.", "1)") or short (≤6 words). This keeps a
    content line such as "Označení objektu: SO 250 – Zárubní zeď …" (8+ words)
    OUT of the header set, so its value is read as content, not swallowed."""
    if not section_re.search(line):
        return False
    enumerated = bool(re.match(r"^\s*(?:[A-Za-z]\d?[.)]|\d+[.)]|[IVXLC]+\.)\s+\S", line))
    return enumerated or len(line.split()) <= 6


def _segment_sections(text: str) -> dict[str, list[tuple[str, Optional[int]]]]:
    """Split page-marked text into {section: [(line, page), …]}.

    Every line is appended to the CURRENT section (header lines included, so
    label values stay readable); a heading line switches the current section.
    Lines before the first heading land in 'preamble'.
    """
    sections: dict[str, list[tuple[str, Optional[int]]]] = {}
    current = "preamble"
    page: Optional[int] = None
    for raw in text.splitlines():
        pm = _PAGE_RE.match(raw)
        if pm:
            page = int(pm.group(1))
            continue
        line = raw.rstrip()
        if not line.strip():
            continue
        for name, sec_re in _SECTION_HEADERS.items():
            if _is_heading(line, sec_re):
                current = name
                break
        sections.setdefault(current, []).append((line, page))
    return sections


def _section_text(sections, name: str) -> tuple[str, Optional[int]]:
    """Joined text + first page of a section ('' / None when absent)."""
    rows = sections.get(name) or []
    if not rows:
        return "", None
    return "\n".join(r[0] for r in rows), rows[0][1]


def _src(section: str, page: Optional[int], confidence: float) -> dict:
    return {"section": section, "page": page, "confidence": confidence}


def _extract_object_code(sections, full_text: str) -> tuple[Optional[str], Optional[int]]:
    """SO code from the identifikace section first (a code can't be poisoned by
    'most'), then anywhere as a last resort."""
    ident_text, ident_page = _section_text(sections, "identifikace")
    for hay, page in ((ident_text, ident_page), (full_text, None)):
        m = _SO_CODE_RE.search(hay)
        if m:
            return f"SO {m.group(1)}", page
    return None, None


def _extract_object(sections, full_text: str) -> dict:
    """Object code + name + charakteristika, each grounded, from signed sections
    only — NEVER from the geology/full text (the bridge-poison trap)."""
    ident_text, ident_page = _section_text(sections, "identifikace")
    char_text, char_page = _section_text(sections, "charakteristika")

    code, code_page = _extract_object_code(sections, full_text)

    # Name: prefer the explicit "Označení/Název objektu:" label; strip a leading
    # SO-code prefix to keep the descriptive name. Fallback: the descriptive tail
    # after an SO code in the identifikace section (NOT full text).
    name, name_conf = None, 0.0
    m = _NAME_LABEL_RE.search(ident_text)
    if m:
        name = _NAME_CODE_PREFIX_RE.sub("", m.group(1)).strip()
        name_conf = 1.0
    elif ident_text:
        m2 = re.search(r"SO[\s\-]?\d{2,3}\s*[–\-:]\s*(.+)", ident_text)
        if m2:
            name, name_conf = m2.group(1).strip(), 0.8

    # Charakteristika: first ≤2 sentences of the charakteristika section (drop the
    # heading line). None when the section is absent (→ verify, never invented).
    charakteristika, char_conf = None, 0.0
    if char_text:
        body = "\n".join(
            ln for ln in char_text.splitlines()
            if not _is_heading(ln, _SECTION_HEADERS["charakteristika"])
        ).strip()
        if body:
            parts = re.split(r"(?<=[.!?])\s+", body)
            charakteristika = " ".join(parts[:2]).strip()
            char_conf = 1.0

    return {
        "object_code": code,
        "object_name": name,
        "charakteristika": charakteristika,
        "needs_verify": name is None or charakteristika is None,
        "_source": {
            "object_code": _src("identifikace", code_page, 1.0 if code else 0.0),
            "object_name": _src("identifikace", ident_page, name_conf),
            "charakteristika": _src("charakteristika", char_page, char_conf),
        },
    }


def _strip_class_tail(line: str, first_class: Optional[str]) -> str:
    """Element name = the line up to its first concrete class / exposure token."""
    cut = line
    if first_class:
        idx = line.find(first_class)
        if idx > 0:
            cut = line[:idx]
    # also trim a trailing exposure list if the class wasn't found before it
    cut = re.split(r"\bX[CDSFAW0]\d?\b", cut)[0]
    return cut.strip(" .:–-\t")


def _extract_elements(
    sections, object_code: Optional[str], page: Optional[int],
    llm: Optional[Callable[[str], list[dict]]],
) -> tuple[list[dict], list[str]]:
    """Per-line element↔class binding inside the materials section.

    - element stem + concrete class on the SAME line → bound pair (proximity);
    - element stem, no class on the line → element KEPT (class None + verify),
      never dropped (#98 guard: no lost element);
    - class with no element on the line → recorded as UNBOUND, never silently
      attached to a random element (#98 guard: no dangling class).
    """
    mat_text, mat_page = _section_text(sections, "materialy")
    src_page = mat_page or page
    elements: list[dict] = []
    unbound: list[str] = []
    seen: set[str] = set()

    for line, ln_page in (sections.get("materialy") or []):
        if _is_heading(line, _SECTION_HEADERS["materialy"]):
            continue
        classes = [m.group(0).replace(" ", "") for m in _CONCRETE_RE.finditer(line)]
        has_element = any(stem.search(line) for stem in _ELEMENT_STEMS)
        if not has_element:
            unbound.extend(classes)  # e.g. "Výztuž B500B" has no concrete class → []
            continue
        first_class = classes[0] if classes else None
        name = _strip_class_tail(line, first_class)
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        cc_conf = 1.0 if first_class else 0.0
        elements.append({
            "name": name,
            "object_code": object_code,
            "concrete_class": first_class,
            "volume_m3": None,  # stage 2
            "needs_verify": first_class is None,
            "_source": {
                "name": _src("materialy", ln_page or src_page, 1.0),
                "concrete_class": _src("materialy", ln_page or src_page, cc_conf),
                "volume_m3": {"status": "stage_2", "confidence": 0.0},
            },
        })

    # LLM fallback ONLY for a murky materials section (present but nothing parsed),
    # and it sees ONLY that section — never the full text.
    if mat_text and not elements and llm is not None:
        try:
            for pair in llm(mat_text) or []:
                nm = (pair.get("name") or "").strip()
                if not nm or nm.lower() in seen:
                    continue
                seen.add(nm.lower())
                cc = pair.get("concrete_class")
                elements.append({
                    "name": nm,
                    "object_code": object_code,
                    "concrete_class": cc,
                    "volume_m3": None,
                    "needs_verify": cc is None,
                    "_source": {
                        "name": _src("materialy", src_page, 0.7),
                        "concrete_class": _src("materialy", src_page, 0.7 if cc else 0.0),
                        "volume_m3": {"status": "stage_2", "confidence": 0.0},
                    },
                })
        except Exception as exc:  # never crash, never fabricate — flag for review
            logger.warning("[MCP/ExtractTZ] LLM materials fallback failed: %s", exc)

    return elements, unbound


def _decode_to_text(
    file_base64: str, filename: str, extractor: Optional[Callable[[Path], str]]
) -> str:
    """base64 PDF → temp file → (injectable) text extractor. Default extractor is
    document._extract_pdf_text (pdfplumber). The real pdfplumber parse is already
    covered by document.py; injection lets callers/tests supply text directly."""
    extractor = extractor or _extract_pdf_text
    file_bytes = base64.b64decode(file_base64)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = Path(tmp.name)
    try:
        return extractor(tmp_path) or ""
    finally:
        tmp_path.unlink(missing_ok=True)


async def extract_tz_fields(
    text: Optional[str] = None,
    file_base64: Optional[str] = None,
    filename: str = "",
) -> dict:
    """Extract authoritative TEXT fields from a technical report (TZ) — stage 1.

    Reads the recipe-input fields (object name + charakteristika + named elements
    + per-element concrete class) from the document's SIGNED SECTIONS, never from
    a full-text scan (a retaining-wall TZ mentions neighbouring bridges in its
    geology section; full-text "most" would poison the object type). Stage 1 is
    TEXT ONLY — volumes (výměry) come from drawings in stage 2, so every element
    ships volume_m3=None, honestly marked.

    The output shape equals the orchestrator recipe input ({object, elements}), so
    it is a drop-in replacement for request.options.

    Args:
        text: Already-extracted TZ text (page-marked "--- PAGE n ---" like
            analyze_construction_document). Preferred for deterministic callers.
        file_base64: PDF bytes as base64 — decoded and run through the pdfplumber
            extractor (shared with analyze_construction_document) when `text` is
            not given.
        filename: Original filename (diagnostics only).

    Returns a dict with:
        object: {object_code, object_name, charakteristika, needs_verify, _source}
        elements: [{name, object_code, concrete_class, volume_m3=None,
                    needs_verify, _source}, …]
        _extraction_meta: {stage, sections_found, unbound_concrete_classes,
                           elements_needs_verify}
    """
    if text is None:
        if not file_base64:
            return {"error": "Provide either text= or file_base64=",
                    "object": {}, "elements": []}
        try:
            text = _decode_to_text(file_base64, filename, _TEXT_EXTRACTOR)
        except Exception as exc:
            logger.error("[MCP/ExtractTZ] could not read PDF: %s", exc)
            return {"error": str(exc), "object": {}, "elements": []}
    if not text or not text.strip():
        return {"error": "Empty document text", "object": {}, "elements": []}

    sections = _segment_sections(text)
    obj = _extract_object(sections, text)
    elements, unbound = _extract_elements(
        sections, obj.get("object_code"), None, _LLM)

    return {
        "object": obj,
        "elements": elements,
        "_extraction_meta": {
            "stage": 1,
            "filename": filename,
            "sections_found": [s for s in _SECTION_HEADERS if s in sections],
            "unbound_concrete_classes": unbound,
            "elements_needs_verify": [e["name"] for e in elements if e["needs_verify"]],
        },
    }
