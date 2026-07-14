"""
Golden Test: TZ object-code + name/charakteristika (SO-202 ingest blocker #2).

On the real SO-202 TZ, extract_tz_fields returned the wrong own code (SO 101 — the
crossed dálnice, referenced in the geology AND embedded in the object name) and empty
name/charakteristika, so detect_object_type could not confirm the bridge. Root cause:
the section segmenter grabbed the OBSAH/TOC as "identifikace", and the "Název objektu"
label has NO colon in real TZs.

Fix under test (extract_tz_fields):
  - object_code REUSES the classifier's deterministic SO logic (NOT a parallel
    extractor): extract_so_code(filename) first, then extract_section_ids(text) —
    the so_code priority of classify_document_enhanced.
  - name/charakteristika fall back to a whole-document explicit-label scan
    (colon-optional "Název objektu", inline "Charakteristika …"), skipping TOC
    dotted-leader lines; a trailing crossed "… SO 101" is trimmed from the name.
    Scanning an explicit LABEL is safe from the bridge-poison trap.

Hermetic tests inject page-marked text (no pdfplumber), like
test_mcp_golden_extract_tz_fields.py. The corpus-gated tests read the real 202_01 TZ
via pdfplumber and skip only when the committed corpus is absent. Deterministic — no
net/DB/AI.
"""

import asyncio
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.detect_object_type import detect_object_type
from app.mcp.tools.extract_tz_fields import extract_tz_fields


# ── Real-TZ-shaped trap: OBSAH/TOC (dotted leaders), colon-less "Název objektu"
# label, the crossed "SO 101" referenced in the TOC + embedded in the object name,
# and the bridge's own "SO 202" only in the title. A naive identifikace-section scan
# picks SO 101; the classifier reuse must pick SO 202. ─────────────────────────────
SO202_TRAP_TEXT = """--- PAGE 1 ---
ČÁST D.2  SO 202  D6 OLŠOVÁ VRATA-ŽALMANOV  TECHNICKÁ ZPRÁVA

OBSAH
1. IDENTIFIKAČNÍ ÚDAJE MOSTU ............................................ 4
3.2.1. Údaje o dálnici D6 (SO 101) ..................................... 5
4.3. POUŽITÉ MATERIÁLY ................................................. 9
--- PAGE 2 ---
1. IDENTIFIKAČNÍ ÚDAJE MOSTU
Název stavby D6 Olšová Vrata - Žalmanov, DSP
Objekt č. 202
Název objektu Most na D6 přes Lomnický potok v km 1,600 SO 101
Katastrální území Horní Tašovice
2. ZÁKLADNÍ ÚDAJE O MOSTU
Charakteristika mostu Trvalý dálniční most, spojitá monolitická dvoutrámová
konstrukce z předpjatého betonu o 3 polích.
4.3. POUŽITÉ MATERIÁLY
• Nosná konstrukce C35/45 XF2
• Opěry C30/37 XF4
Výztuž B500B
"""

# Retaining-wall trap for the label-scan path: the GEOLOGY mentions a neighbouring
# bridge, but the object's own "Název objektu" label reads "Zárubní zeď". The label
# scan must read the authoritative label, never the geology "most".
SO250_TRAP_TEXT = """--- PAGE 1 ---
SO 250  Zárubní zeď v km 6,500

OBSAH
1. IDENTIFIKAČNÍ ÚDAJE .................................................. 3
4.3. POUŽITÉ MATERIÁLY ................................................. 7
--- PAGE 2 ---
1. IDENTIFIKAČNÍ ÚDAJE OBJEKTU
Název objektu Zárubní zeď v km 6,500
Charakteristika objektu Úhlová železobetonová zeď zajišťující zářez silnice.
3. GEOLOGICKÉ POMĚRY
Trasa navazuje na mostní objekt a lávku SO 222 přes potok.
4.3. POUŽITÉ MATERIÁLY
• Dřík C30/37 XF4
"""


def _extract(text, filename=""):
    return asyncio.run(extract_tz_fields(text=text, filename=filename))


def _detect(obj):
    return asyncio.run(detect_object_type(
        object_name=obj.get("object_name") or "",
        charakteristika=obj.get("charakteristika") or ""))


# ── object_code: own code (SO 202), never the crossed SO 101 ──────────────────

def test_object_code_from_filename_not_crossed_so101():
    obj = _extract(SO202_TRAP_TEXT, filename="202_01_TechnickaZprava.pdf")["object"]
    assert obj["object_code"] in ("SO 202", "SO-202", "SO202"), obj
    assert obj["object_code"] not in ("SO 101", "SO-101", "SO101"), obj


def test_object_code_content_fallback_when_no_filename():
    # No filename → classifier content tier (extract_section_ids): the title's
    # SO 202 precedes the crossed SO 101, so the own code still wins.
    obj = _extract(SO202_TRAP_TEXT, filename="")["object"]
    assert obj["object_code"] in ("SO 202", "SO-202", "SO202"), obj


# ── name + charakteristika filled; name carries no crossed code ───────────────

def test_object_name_filled_without_crossed_code():
    obj = _extract(SO202_TRAP_TEXT, filename="202_01_TechnickaZprava.pdf")["object"]
    assert obj["object_name"], obj
    assert "most" in obj["object_name"].lower(), obj
    assert "SO 101" not in obj["object_name"], obj  # trailing crossed code trimmed


def test_charakteristika_filled_from_inline_label():
    obj = _extract(SO202_TRAP_TEXT, filename="202_01_TechnickaZprava.pdf")["object"]
    assert obj["charakteristika"], obj
    assert "most" in obj["charakteristika"].lower(), obj
    assert obj["needs_verify"] is False, obj


# ── end-to-end: extract → detect_object_type confirms bridge ──────────────────

def test_detect_object_type_confirms_bridge():
    obj = _extract(SO202_TRAP_TEXT, filename="202_01_TechnickaZprava.pdf")["object"]
    d = _detect(obj)
    assert d["object_type"] == "bridge" and d["verified"] is True, d


def test_nk_concrete_class_bound():
    res = _extract(SO202_TRAP_TEXT, filename="202_01_TechnickaZprava.pdf")
    nk = next((e for e in res["elements"] if "nosná" in e["name"].lower()), None)
    assert nk is not None, f"NK element not found in {res['elements']}"
    assert nk["concrete_class"] == "C35/45-XF2", nk   # full grade+exposure string


# ── label-scan path is not poisoned by a neighbouring bridge in the geology ───

def test_label_scan_retaining_wall_not_poisoned():
    obj = _extract(SO250_TRAP_TEXT, filename="250_01_TechnickaZprava.pdf")["object"]
    assert obj["object_code"] in ("SO 250", "SO-250", "SO250"), obj
    # The label scan grabbed the AUTHORITATIVE value (the wall), not the geology bridge.
    assert "zárubní zeď" in (obj["object_name"] or "").lower(), obj
    assert "most" not in (obj["object_name"] or "").lower(), obj
    assert "lávk" not in (obj["object_name"] or "").lower(), obj
    d = _detect(obj)
    assert d["object_type"] == "retaining_wall", d  # NOT bridge, despite geology "most"


def test_scan_label_skips_toc_dotted_line_takes_real():
    """A dotted-leader OBSAH/TOC line that matches the label is skipped; the scan
    returns the REAL content line that follows."""
    from app.mcp.tools.extract_tz_fields import _NAME_LABEL_RE, _scan_label_value

    txt = (
        "Název objektu .................................. 5\n"  # OBSAH/TOC entry
        "Název objektu Most přes potok\n"                       # real content line
    )
    assert _scan_label_value(txt, _NAME_LABEL_RE) == "Most přes potok"


def test_trailing_so_strip_keeps_own_code_trims_foreign():
    # Foreign crossed code (SO 101) is trimmed from the SO-202 trap name.
    foreign = _extract(SO202_TRAP_TEXT, filename="202_01_TechnickaZprava.pdf")["object"]
    assert "SO 101" not in (foreign["object_name"] or ""), foreign
    # A name ending with the object's OWN code keeps it (own ≠ crossed).
    own_text = (
        "--- PAGE 1 ---\nNázev objektu Most SO 202\n"
        "4.3. POUŽITÉ MATERIÁLY\n• Nosná konstrukce C35/45\n"
    )
    obj = _extract(own_text, filename="202_01_TechnickaZprava.pdf")["object"]
    assert obj["object_name"] == "Most SO 202", obj


# ── Corpus-gated golden: the real SO-202 TZ ───────────────────────────────────

_CORPUS_TZ = (
    Path(__file__).resolve().parents[4]
    / "test-data" / "SO_202_D6_OV_Z" / "202_01_TechnickaZprava.pdf"
)


def _real_tz_text():
    from app.mcp.tools.document import _extract_pdf_text
    return _extract_pdf_text(_CORPUS_TZ)


@pytest.mark.skipif(not _CORPUS_TZ.exists(), reason=f"SO-202 TZ absent: {_CORPUS_TZ}")
def test_so202_corpus_object_code_and_bridge():
    obj = _extract(_real_tz_text(), filename="202_01_TechnickaZprava.pdf")["object"]
    assert obj["object_code"] in ("SO 202", "SO-202", "SO202"), obj["object_code"]
    assert obj["object_name"] and "most" in obj["object_name"].lower(), obj
    assert obj["charakteristika"], obj
    d = _detect(obj)
    assert d["object_type"] == "bridge" and d["verified"] is True, d


@pytest.mark.skipif(not _CORPUS_TZ.exists(), reason=f"SO-202 TZ absent: {_CORPUS_TZ}")
def test_so202_corpus_nk_class_c35_45():
    res = _extract(_real_tz_text(), filename="202_01_TechnickaZprava.pdf")
    nk = next((e for e in res["elements"]
              if e["name"].strip().lower().endswith("nosná konstrukce")), None)
    assert nk is not None, f"NK element not found in {res['elements']}"
    assert nk["concrete_class"] == "C35/45-XF2+XD1+XC4", nk   # full grade+exposure


@pytest.mark.skipif(not _CORPUS_TZ.exists(), reason=f"SO-202 TZ absent: {_CORPUS_TZ}")
def test_so202_corpus_object_code_content_fallback_no_filename():
    """MCP-tool entry on the real TZ with text only (NO filename) → classifier
    content tier (extract_section_ids) → SO 202, never the crossed SO 101."""
    obj = _extract(_real_tz_text(), filename="")["object"]
    assert obj["object_code"] in ("SO 202", "SO-202", "SO202"), obj["object_code"]
    assert obj["object_code"] not in ("SO 101", "SO-101", "SO101"), obj["object_code"]
