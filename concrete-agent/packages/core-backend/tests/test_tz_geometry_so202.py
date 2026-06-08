"""
Golden Test: NK geometry from TZ prose (SO-202 ingest, Gate 3).

A bridge TZ describes the NK geometry in PROSE, not in signed fields, and describes
BOTH the new monolithic NK AND the old prefab ("Petra") deck being demolished.
Gate 3 extracts the new NK's geometry deterministically — declension/preposition-
tolerant, Czech decimal comma, source-grounded — and HONEST-BLANK for facts that
are not cleanly in the prose. Drawings/DXF are out of scope.

Asserted (all from the real SO-202 §4.1.6 prose, confirmed by the recon report):
  - span count + ordered span lengths (32,0+44,5+32,0), spans_consistent;
  - NK construction height (2,40 m) and width (13,65 m) — NOT the old bridge's
    2,40-poison 1,15 m / 13,65-poison 12,64 m;
  - cross-section type (calculator nk_subtype vocab) + structural system;
  - poison-guard: a retaining-wall / geometry-poor TZ yields blanks, not guesses;
  - both entry paths (filename + content-only) behave identically.

Hermetic tests inject page-marked text (no pdfplumber); the corpus-gated tests read
the real 202_01 TZ and skip only when the committed corpus is absent. Deterministic —
no net/DB/AI.
"""

import asyncio
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.extract_tz_fields import extract_tz_fields


def _geo(text, filename=""):
    return asyncio.run(extract_tz_fields(text=text, filename=filename))["object"]["geometry"]


# New NK §4.1.6 prose + the existing prefab bridge being demolished (the poison:
# 4 spans / 26,30+… / nosník výšky 1,15 m / šířka NK 12,64 m / prefabrikovaných Petra).
GEO_TRAP = """--- PAGE 1 ---
4.1.1. Popis stávajícího mostu ev. č. 6-049
Stávající most na I/6 je o 4 polích. Nosná konstrukce s rozpětími jednotlivých polí
26,30+27,0+27,0+26,30 m je sestavena z prefabrikovaných nosníků typu Petra
(nosníky výšky 1,15 m). Celková šířka NK činí 12,64 m. Most bude snesen.
--- PAGE 2 ---
4.1.6. Nosná konstrukce
Nosnou konstrukci pro oba mosty tvoří spojitá monolitická dvoutrámová konstrukce
z předpjatého betonu o 3 polích o rozpětích 32,0+44,5+32,0 m s konstantní
konstrukční výškou trámů. V příčném řezu se jedná o dvoutrámový nosník
s konstrukční výškou 2,40 m. Šířka nosné konstrukce 13,65 m.
"""

# Declension/word-number ("o třech polích") + komora cross-section.
GEO_DECLENSION = """--- PAGE 1 ---
Most o třech polích o rozpětích 30,0+40,5+30,0 m. Spojitá monolitická komorová
konstrukce z předpjatého betonu. Konstrukční výška 1,80 m. Šířka nosné konstrukce 10,25 m.
"""

# Span sequence present but the COUNT is not stated as "o N polích" → inferred.
GEO_INFERRED_COUNT = """--- PAGE 1 ---
Nový most. Spojitá monolitická dvoutrámová konstrukce z předpjatého betonu
s rozpětími 28,0+35,0+28,0 m a konstrukční výškou 2,10 m.
"""

# Bridge with system described but NO clean dimensions in the prose (honest-blank).
GEO_PARTIAL = """--- PAGE 1 ---
Most. Nosnou konstrukci tvoří spojitá monolitická dvoutrámová konstrukce
z předpjatého betonu. Bližší geometrie je uvedena ve výkresové dokumentaci.
"""

# Retaining wall — no bridge geometry at all (poison-guard).
GEO_WALL = """--- PAGE 1 ---
Úhlová železobetonová zárubní zeď v km 6,5 – 7,0. Výška zdi 4,0 m. Délka 120 m.
Dřík C30/37. Základ C25/30.
"""


# ── New-NK geometry extracted; existing prefab bridge is NOT confused for it ───

def test_spans_count_and_ordered_lengths():
    g = _geo(GEO_TRAP)
    assert g["num_spans"] == 3, g
    assert g["span_lengths_m"] == [32.0, 44.5, 32.0], g          # ordered, not the old 26,30+…
    assert g["spans_consistent"] is True, g
    assert g["total_span_length_m"] == 108.5, g


def test_height_and_width_are_new_nk_not_existing():
    g = _geo(GEO_TRAP)
    assert g["nk_height_m"] == 2.4, g       # NOT the old nosník výšky 1,15 m
    assert g["nk_width_m"] == 13.65, g      # NOT the old šířka NK 12,64 m


def test_cross_section_and_structural_system():
    g = _geo(GEO_TRAP)
    assert g["cross_section_type"] == "dvoutramovy", g           # calculator nk_subtype vocab
    assert g["structural_system"] == {
        "continuity": "spojita", "casting": "monolit", "prestress": "predpjaty"}, g


def test_trap_nothing_needs_verify():
    assert _geo(GEO_TRAP)["needs_verify"] == []


# ── Czech declension / word-number / decimal comma ────────────────────────────

def test_declension_word_number_and_komora():
    g = _geo(GEO_DECLENSION)
    assert g["num_spans"] == 3, g                                # "o třech polích"
    assert g["span_lengths_m"] == [30.0, 40.5, 30.0], g
    assert g["nk_height_m"] == 1.8 and g["nk_width_m"] == 10.25, g
    assert g["cross_section_type"] == "komorovy", g


# ── Honest inference: count derived from the sequence, flagged ────────────────

def test_num_spans_inferred_from_sequence_is_flagged():
    g = _geo(GEO_INFERRED_COUNT)
    assert g["span_lengths_m"] == [28.0, 35.0, 28.0], g
    assert g["num_spans"] == 3, g                                # inferred from len
    assert "num_spans" in g["needs_verify"], g                  # flagged as inferred
    assert g["_source"]["num_spans"]["section"] == "inferred", g
    assert g["_source"]["num_spans"]["confidence"] < 1.0, g


# ── Honest-blank: extract what's there, blank what isn't, never guess ─────────

def test_partial_blanks_absent_dimensions_keeps_system():
    g = _geo(GEO_PARTIAL)
    assert g["cross_section_type"] == "dvoutramovy", g          # present → extracted
    assert g["structural_system"]["continuity"] == "spojita", g
    assert g["span_lengths_m"] == [] and g["num_spans"] is None, g   # absent → blank
    assert g["nk_height_m"] is None and g["nk_width_m"] is None, g
    for f in ("span_lengths_m", "num_spans", "nk_height_m", "nk_width_m"):
        assert f in g["needs_verify"], (f, g["needs_verify"])


def test_poison_guard_retaining_wall_no_false_geometry():
    g = _geo(GEO_WALL)
    assert g["num_spans"] is None and g["span_lengths_m"] == [], g
    assert g["nk_height_m"] is None and g["nk_width_m"] is None, g   # "výška zdi 4,0 m" ≠ NK height
    assert g["cross_section_type"] is None, g
    assert g["structural_system"] == {"continuity": None, "casting": None, "prestress": None}, g
    assert set(g["needs_verify"]) == {
        "num_spans", "span_lengths_m", "nk_height_m", "nk_width_m",
        "cross_section_type", "structural_system"}, g


# ── Source-grounding + both entry paths identical ─────────────────────────────

def test_every_extracted_value_is_source_grounded():
    g = _geo(GEO_TRAP)
    for field in ("num_spans", "span_lengths_m", "nk_height_m", "nk_width_m",
                  "cross_section_type"):
        s = g["_source"].get(field)
        assert s is not None, f"Missing _source for {field}"
        assert s["section"] and s["snippet"] and s["confidence"] > 0, (field, s)
        assert s["page"] is not None, (field, s)


def test_filename_and_content_paths_identical():
    a = _geo(GEO_TRAP, filename="202_01_TechnickaZprava.pdf")
    b = _geo(GEO_TRAP, filename="")
    for k in ("num_spans", "span_lengths_m", "nk_height_m", "nk_width_m",
              "cross_section_type", "structural_system", "needs_verify"):
        assert a[k] == b[k], (k, a[k], b[k])


# ── Corpus-gated golden: the real SO-202 TZ ───────────────────────────────────

_CORPUS_TZ = (
    Path(__file__).resolve().parents[4]
    / "test-data" / "SO_202_D6_OV_Z" / "202_01_TechnickaZprava.pdf"
)


def _real_tz_text():
    from app.mcp.tools.document import _extract_pdf_text
    return _extract_pdf_text(_CORPUS_TZ)


@pytest.mark.skipif(not _CORPUS_TZ.exists(), reason=f"SO-202 TZ absent: {_CORPUS_TZ}")
def test_so202_corpus_nk_geometry():
    g = _geo(_real_tz_text(), filename="202_01_TechnickaZprava.pdf")
    assert g["num_spans"] == 3, g
    assert g["span_lengths_m"] == [32.0, 44.5, 32.0], g
    assert g["spans_consistent"] is True, g
    assert g["nk_height_m"] == 2.4, g
    assert g["nk_width_m"] == 13.65, g
    assert g["cross_section_type"] == "dvoutramovy", g
    assert g["structural_system"] == {
        "continuity": "spojita", "casting": "monolit", "prestress": "predpjaty"}, g
    assert g["needs_verify"] == [], g


@pytest.mark.skipif(not _CORPUS_TZ.exists(), reason=f"SO-202 TZ absent: {_CORPUS_TZ}")
def test_so202_corpus_content_only_path_matches():
    a = _geo(_real_tz_text(), filename="202_01_TechnickaZprava.pdf")
    b = _geo(_real_tz_text(), filename="")
    assert a == b, "filename and content-only geometry must match"
