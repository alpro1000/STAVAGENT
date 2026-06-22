"""
Golden Test: AspeEsticon XC4 routing (SO-202 ingest blocker #1).

An AspeEsticon XC4 *export* (soupis prací) wraps its <polozka> work items in an
<XC4> root — the SAME root tag a KROS OTSKP *price-list* uses. KROSParser keyed on
that bare <XC4> tag (`_has_xc4_prices`) and forced every export down the price-list
path, which finds 0 <CenoveSoustavy> and drops all položky → **0 parsed**. The
dedicated AspeEsticon parser (app.parsers.xc4_parser) reads the same tree fully.

Fix under test:
  - `_has_xc4_prices` now keys on actual price-list content (<CenoveSoustavy>), so
    AspeEsticon exports fall through to _detect_format → ASPE_XC4 → xc4_parser.
  - format_detector gives AspeEsticon a distinct identity (SourceFormat.XML_ASPE_XC4),
    separate from the KROS price-list (XML_OTSKP) and TSKP classification (XML_TSKP).
  - KROSParser.parse coerces str → Path (SmartParser.parse_xml hands it a str).

Hermetic tests use synthetic inline XML (no corpus, no net/DB/AI), like
test_xc4_parser.py. The corpus-gated golden asserts the real SO-202 export
(3373 položek + 6 betonové prvky) and is skipped only when the committed corpus
file is absent. XML only — no pdfplumber.
"""

import sys
import tempfile
import os
from pathlib import Path
import xml.etree.ElementTree as ET

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.parsers.kros_parser import KROSParser
from app.parsers.format_detector import detect_format
from app.parsers.models import SourceFormat
from app.parsers.smart_parser import SmartParser


# ── Synthetic fixtures ────────────────────────────────────────────────────────

# AspeEsticon XC4 export: root <XC4>, <zdroj>AspeEsticon</zdroj>, work items nested
# objekty > objekt > stavDily > stavDil > polozky > polozka. NO <CenoveSoustavy>.
ASPE_XC4 = """<?xml version="1.0" encoding="utf-8"?>
<XC4>
  <verze>1.0</verze>
  <zdroj>AspeEsticon</zdroj>
  <stavba>
    <objekty>
      <objekt>
        <stavDily>
          <stavDil>
            <polozky>
              <polozka>
                <id_polozka>1</id_polozka>
                <znacka>272325</znacka>
                <popis>ZÁKLADY ZE ŽELEZOBETONU DO C30/37</popis>
                <id_mj>M3</id_mj>
                <mnozstvi>867,136</mnozstvi>
              </polozka>
              <polozka>
                <id_polozka>2</id_polozka>
                <znacka>422336</znacka>
                <popis>MOSTNÍ NOSNÉ TRÁM KONSTR Z PŘEDPJ BET DO C40/50</popis>
                <id_mj>M3</id_mj>
                <mnozstvi>2697,941</mnozstvi>
              </polozka>
            </polozky>
          </stavDil>
        </stavDily>
      </objekt>
    </objekty>
  </stavba>
</XC4>
"""

# KROS OTSKP price-list XC4: root <XC4> with a <CenoveSoustavy> price list. This is
# the file family that MUST keep routing to OTSKP_XC4 (regression guard).
KROS_PRICE_XC4 = """<?xml version="1.0" encoding="utf-8"?>
<XC4>
  <CenoveSoustavy>
    <typ_CS>OTSKP</typ_CS>
    <Polozky>
      <Polozka>
        <znacka>011</znacka>
        <nazev>Položka ceníku</nazev>
        <MJ>m3</MJ>
        <jedn_cena>100</jedn_cena>
      </Polozka>
    </Polozky>
  </CenoveSoustavy>
</XC4>
"""


def _write_tmp(xml: str) -> str:
    f = tempfile.NamedTemporaryFile(suffix=".xml", delete=False, mode="w", encoding="utf-8")
    f.write(xml)
    f.close()
    return f.name


# ── Hermetic: AspeEsticon export routes to ASPE_XC4 and yields its položky ─────

def test_aspe_export_not_treated_as_price_list():
    """The bare <XC4> root must NOT be mistaken for a price list."""
    root = ET.fromstring(ASPE_XC4)
    assert KROSParser._has_xc4_prices(root) is False


def test_aspe_export_routes_to_aspe_xc4_and_parses_items():
    path = _write_tmp(ASPE_XC4)
    try:
        result = KROSParser().parse(Path(path))
        assert result["document_info"]["kros_format"] == "ASPE_XC4", result["document_info"]
        # Both <polozka> are valid → parsed, NOT 0.
        assert len(result["positions"]) == 2, result["positions"]
    finally:
        os.unlink(path)


def test_format_detector_gives_aspe_distinct_identity():
    path = _write_tmp(ASPE_XC4)
    try:
        assert detect_format(path) == SourceFormat.XML_ASPE_XC4
    finally:
        os.unlink(path)


def test_kros_parse_accepts_str_path():
    """SmartParser.parse_xml hands KROSParser a str; it must not raise on .name."""
    path = _write_tmp(ASPE_XC4)
    try:
        result = KROSParser().parse(path)  # str, not Path
        assert len(result["positions"]) == 2
    finally:
        os.unlink(path)


# ── Hermetic regression: real KROS price-list still routes to OTSKP_XC4 ────────

def test_price_list_still_detected_as_xc4_prices():
    root = ET.fromstring(KROS_PRICE_XC4)
    assert KROSParser._has_xc4_prices(root) is True


def test_price_list_routes_to_otskp_xc4():
    path = _write_tmp(KROS_PRICE_XC4)
    try:
        result = KROSParser().parse(Path(path))
        # Routing is unchanged: a genuine price list still takes the OTSKP_XC4 path.
        assert result["document_info"]["kros_format"] == "OTSKP_XC4", result["document_info"]
        # The price-list parser found the catalog entry (raw, pre-normalisation).
        # Price catalog rows carry no BoQ quantity, so they normalise out to 0 —
        # that is pre-existing behaviour this fix must NOT change.
        assert result["diagnostics"]["raw_total"] >= 1, result["diagnostics"]
    finally:
        os.unlink(path)


def test_format_detector_price_list_stays_otskp():
    path = _write_tmp(KROS_PRICE_XC4)
    try:
        assert detect_format(path) == SourceFormat.XML_OTSKP
    finally:
        os.unlink(path)


# ── Discriminator priority: positive soupis signal beats an embedded price list ─

def test_export_with_embedded_price_list_routes_as_soupis():
    """objekty+polozka (soupis) wins even when a <CenoveSoustavy> is embedded →
    ASPE_XC4 (parsed), not OTSKP_XC4. _has_xc4_prices, _detect_format and
    format_detector must all agree (soupis wins)."""
    xml = ASPE_XC4.replace(
        "</stavba>",
        "</stavba>\n  <KL><CenoveSoustavy><typ_CS>OTSKP</typ_CS><Polozky>"
        "<Polozka><znacka>011</znacka><nazev>cenik</nazev><MJ>m3</MJ>"
        "<jedn_cena>100</jedn_cena></Polozka></Polozky></CenoveSoustavy></KL>",
    )
    root = ET.fromstring(xml)
    assert KROSParser._has_xc4_prices(root) is False  # soupis wins over price list
    path = _write_tmp(xml)
    try:
        result = KROSParser().parse(Path(path))
        assert result["document_info"]["kros_format"] == "ASPE_XC4", result["document_info"]
        assert len(result["positions"]) == 2, result["positions"]
        assert detect_format(path) == SourceFormat.XML_ASPE_XC4
    finally:
        os.unlink(path)


# ── Corpus-gated golden: real SO-202 AspeEsticon export ───────────────────────

_CORPUS = (
    Path(__file__).resolve().parents[4]
    / "test-data" / "SO_202_D6_OV_Z" / "E_Soupis praci_XC4_DI-009.xml"
)

# Golden soupis betonové prvky (recon docs/audits/so202_corpus_recon): code -> m³.
_GOLDEN_ELEMENTS = {
    "272325": 867.136,    # Základy
    "317325": 266.328,    # Římsy
    "333325": 557.851,    # Opěry a křídla
    "334326": 361.384,    # Dříky pilířů
    "420324": 81.900,     # Přechodové desky
    "422336": 2697.941,   # NK trám předpjatá
}


def _qty(pos: dict):
    for k in ("quantity", "mnozstvi", "mnozstvi_puvodni"):
        v = pos.get(k)
        if v not in (None, ""):
            try:
                return float(str(v).replace(" ", "").replace(",", "."))
            except ValueError:
                pass
    return None


def _code(pos: dict) -> str:
    for k in ("code", "znacka", "kod"):
        if pos.get(k):
            return str(pos[k]).replace(" ", "")
    return ""


@pytest.mark.skipif(not _CORPUS.exists(), reason=f"SO-202 corpus absent: {_CORPUS}")
def test_so202_corpus_yields_3373_positions():
    result = KROSParser().parse(_CORPUS)
    assert result["document_info"]["kros_format"] == "ASPE_XC4", result["document_info"]
    assert len(result["positions"]) == 3373, len(result["positions"])
    assert detect_format(str(_CORPUS)) == SourceFormat.XML_ASPE_XC4


@pytest.mark.skipif(not _CORPUS.exists(), reason=f"SO-202 corpus absent: {_CORPUS}")
def test_so202_production_entry_smartparser_yields_3373():
    """SmartParser.parse_xml is the production XML entry that used to return 0."""
    result = SmartParser().parse_xml(_CORPUS)
    assert len(result["positions"]) == 3373, len(result["positions"])


@pytest.mark.skipif(not _CORPUS.exists(), reason=f"SO-202 corpus absent: {_CORPUS}")
def test_so202_six_concrete_elements_match_golden_volumes():
    positions = KROSParser().parse(_CORPUS)["positions"]
    for code, expected_m3 in _GOLDEN_ELEMENTS.items():
        hits = [p for p in positions if _code(p) == code or _code(p).startswith(code)]
        assert hits, f"{code}: not found in soupis"
        best = min(hits, key=lambda p: abs((_qty(p) or 0) - expected_m3))
        got = _qty(best)
        assert got == pytest.approx(expected_m3, abs=1e-3), f"{code}: got {got}, want {expected_m3}"
