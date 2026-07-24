"""
Drift guard: the OTSKP item count quoted to users must match the real catalog.

Why this exists — the 2026 SFDI base (17 940 items) superseded 2025_03
(17 904), but the literal "17 904" survived in ~34 live code/doc surfaces
(MCP tool descriptions, server instructions, READMEs, steering docs). An
agent reading the tool description was told a stale catalog size while the
DB answered from the newer base.

The count is DATA (it changes when the catalog is re-ingested), so this test
derives it from the committed XML rather than hardcoding a second literal —
and then asserts the user-facing strings agree. When the catalog is updated,
this test fails loudly and names every string that still quotes the old size,
instead of letting the number rot silently.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

_KB_DIR = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "knowledge_base"
    / "B1_otkskp_codes"
)
_CURRENT_CATALOG = _KB_DIR / "2026_otskp.xml"


def _local(tag: str) -> str:
    """Strip an XML namespace: '{ns}Polozka' -> 'Polozka'."""
    return tag.rsplit("}", 1)[-1]


def _count_catalog_codes(xml_path: Path) -> int:
    """Unique <znacka> codes under <Polozka> — the same unit the docs quote.

    Streamed via iterparse: the catalog is ~17 MB and the CI box should not
    hold the whole tree.
    """
    codes: set[str] = set()
    for _, el in ET.iterparse(str(xml_path), events=("end",)):
        if _local(el.tag) != "Polozka":
            continue
        for child in el:
            if _local(child.tag) == "znacka":
                code = (child.text or "").strip()
                if code:
                    codes.add(code)
                break
        el.clear()
    return len(codes)


@pytest.fixture(scope="module")
def catalog_count() -> int:
    if not _CURRENT_CATALOG.exists():
        pytest.skip(f"OTSKP catalog XML not present: {_CURRENT_CATALOG}")
    return _count_catalog_codes(_CURRENT_CATALOG)


def test_current_catalog_is_the_2026_base(catalog_count: int):
    """The committed catalog is the 2026 SFDI base, not the 2025_03 one.

    17 904 is the superseded 2025_03 size — if the count comes back as that,
    the wrong vintage got committed (or the pointer was reverted).
    """
    assert catalog_count != 17904, (
        "OTSKP catalog resolves to the SUPERSEDED 2025_03 base (17 904 items). "
        "Expected the 2026 SFDI base."
    )
    assert catalog_count > 0


# Live surfaces that quote the catalog size to a user or an agent. Historical
# artifacts (docs/archive, docs/audits, docs/handoff, session logs, frozen
# pilot outputs under test-data/) are deliberately NOT listed — a dated report
# correctly records the size at its own date.
_QUOTING_SURFACES = (
    "app/mcp/server.py",
    "app/mcp/routes.py",
    "app/mcp/tools/otskp.py",
    "app/mcp/tools/urs.py",
    "app/mcp/tools/breakdown.py",
    "app/services/code_detector.py",
    "app/pricing/otskp_engine.py",
)

# "17904", "17,904", "17 904" (incl. non-breaking space)
_COUNT_RE = re.compile(r"17[\s, ]?9\d{2}")


@pytest.mark.parametrize("rel_path", _QUOTING_SURFACES)
def test_quoted_count_matches_real_catalog(rel_path: str, catalog_count: int):
    """Every quoted 17,9xx figure on a live surface equals the real count."""
    path = Path(__file__).resolve().parent.parent / rel_path
    if not path.exists():
        pytest.skip(f"surface not present: {rel_path}")

    text = path.read_text(encoding="utf-8")
    quoted = _COUNT_RE.findall(text)
    if not quoted:
        return  # surface does not quote the size — nothing to drift

    normalized = {int(re.sub(r"[\s, ]", "", q)) for q in quoted}
    stale = normalized - {catalog_count}
    assert not stale, (
        f"{rel_path} quotes OTSKP size {sorted(stale)} but the committed "
        f"catalog has {catalog_count} codes. Update the string(s) — the count "
        f"is data, and a stale figure misleads every agent reading the tool "
        f"description."
    )
