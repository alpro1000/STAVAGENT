"""Gap A — XML soupis must route to the KROS parser (not the xlsx/zip reader).

Scoped validation (2026-06-09, real parsers + P1 join on real SO-202, no server)
found the front-half didn't converge: `parse_construction_budget` fed an XML
soupis to openpyxl → `BadZipFile` → **silently 0 items**, while `KROSParser` takes
the same file fine (3373 positions). This pins the routing fix.

Two tiers:
  - Hermetic units (always run): `_detect_file_kind` content-sniff + honest-error
    on an unrecognized format (no corpus, no net).
  - Corpus-gated golden (runs when the committed SO-202 XML is present, like the
    other SO-202 ingest goldens): the tool returns ~3373 positions (incl. m³ lines)
    AND the real parsed soupis + clean element bullets fed to the P1 join give
    those bullets REAL volumes (Opěry→~949.6, Římsy→~632.2) — proving Gap A
    unblocked the join for clean elements (independent of Gap B / TZ noise).

Deterministic, hermetic (XML from the committed corpus; no network/DB/LLM).
"""

import asyncio
import base64
from pathlib import Path

import pytest

from app.mcp.tools.budget import _detect_file_kind, parse_construction_budget
from app.mcp.tools.classifier import _classify
from app.services.stage_gating.soupis_quantity_join import map_soupis_to_elements

# tests/ → core-backend → packages → concrete-agent → STAVAGENT
_CORPUS = (
    Path(__file__).resolve().parents[4]
    / "test-data" / "SO_202_D6_OV_Z" / "E_Soupis praci_XC4_DI-009.xml"
)


# ── hermetic units: deterministic format routing + honest error ───────────────
def test_detect_kind_xml_by_content_wins_over_extension():
    # content says XML even though the name says .xlsx → content wins
    assert _detect_file_kind(b"<?xml version='1.0'?><x/>", "mislabeled.xlsx") == "xml"
    assert _detect_file_kind(b"  <KROS>...", "no_ext") == "xml"


def test_detect_kind_xlsx_by_zip_magic():
    assert _detect_file_kind(b"PK\x03\x04rest-of-zip", "mystery.bin") == "xlsx"
    assert _detect_file_kind(b"random", "book.xlsx") == "xlsx"  # extension fallback


def test_detect_kind_unknown():
    assert _detect_file_kind(b"plain text, not a soupis", "mystery.dat") == "unknown"


def test_unknown_format_is_honest_error_not_silent_zero():
    bad = asyncio.run(parse_construction_budget(
        file_base64=base64.b64encode(b"not a soupis at all").decode("ascii"),
        filename="mystery.dat",
    ))
    assert bad.get("error"), "unknown format must be an explicit error, not silent 0"
    assert bad.get("format_detected") == "unknown"
    assert bad.get("total_items") == 0


# ── corpus-gated golden: real SO-202 XML → KROS → join gets real volumes ──────
def _real_budget():
    b64 = base64.b64encode(_CORPUS.read_bytes()).decode("ascii")
    return asyncio.run(parse_construction_budget(file_base64=b64, filename=_CORPUS.name))


@pytest.mark.skipif(not _CORPUS.exists(), reason=f"SO-202 corpus absent: {_CORPUS}")
def test_so202_xml_soupis_routed_to_kros_yields_positions():
    budget = _real_budget()
    assert budget.get("error") is None, budget.get("error")
    assert budget.get("format_detected") == "kros_xml"   # routed to KROS, not xlsx
    assert budget.get("total_items", 0) >= 3000, budget.get("total_items")  # ~3373
    m3 = [it for it in budget["items"]
          if (it.get("unit") or "").strip().lower().replace(" ", "") in {"m3", "m³", "m^3"}]
    assert len(m3) >= 1000, len(m3)                       # ~1217 m³ lines


@pytest.mark.skipif(not _CORPUS.exists(), reason=f"SO-202 corpus absent: {_CORPUS}")
def test_so202_xml_soupis_feeds_join_clean_elements_get_volumes():
    budget = _real_budget()
    # Clean catalog bullets (as the TZ lists them) — isolates Gap A from Gap B
    # (TZ element-list noise). Distinct element_types → single match each.
    elements = [
        {"name": "Opěry", "object_code": "SO-202", "volume_m3": None, "_source": {}},
        {"name": "Římsy", "object_code": "SO-202", "volume_m3": None, "_source": {}},
    ]
    quantified = map_soupis_to_elements(
        budget, elements, None, classify=_classify, object_type="bridge"
    )
    by = {e["name"]: e for e in quantified}
    # Gap A unblocked: the clean bullets now receive REAL soupis volumes.
    assert by["Opěry"]["quantity_status"] == "extracted", by["Opěry"]
    assert by["Opěry"]["volume_m3"] > 100, by["Opěry"]["volume_m3"]
    assert by["Opěry"]["_source"]["volume_m3"]["source"] == "soupis"
    assert by["Římsy"]["quantity_status"] == "extracted", by["Římsy"]
    assert by["Římsy"]["volume_m3"] > 100, by["Římsy"]["volume_m3"]
