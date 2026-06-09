"""Pin B drift guard — the Python volume-geometry cross-check MUST stay numerically
identical to the canonical TS engine.

The constants/formula/bands live in TWO runtimes (TS engine + this Python port).
That is exactly the TS/Python drift anti-pattern the project has been bitten by
(v4.34 single-source work). Rather than hardcode-and-hope, this test PARSES the
TS source of truth and asserts the Python mirror equals it — so a change to the
TS bands or deck-thickness table that isn't reflected in Python goes RED.

If the TS file moves/disappears this test FAILS (not skips): the single-source
guarantee is the whole point, so its absence is a real defect, not a skip.
"""

import re
from pathlib import Path

from app.services.stage_gating import volume_geometry as vg

# tests/ → core-backend → packages → concrete-agent → STAVAGENT (repo root)
_TS = (
    Path(__file__).resolve().parents[4]
    / "Monolit-Planner/shared/src/classifiers/element-classifier.ts"
)


def _ts_source() -> str:
    assert _TS.exists(), (
        f"TS single-source-of-truth not found at {_TS} — the drift guard cannot "
        "run. If the engine moved, update this path AND re-verify parity."
    )
    return _TS.read_text(encoding="utf-8")


def test_deck_subtype_thickness_table_matches_ts():
    src = _ts_source()
    block = re.search(
        r"DECK_SUBTYPE_EQ_THICKNESS_M:\s*Record<string,\s*number>\s*=\s*\{(.*?)\}",
        src,
        re.S,
    )
    assert block, "DECK_SUBTYPE_EQ_THICKNESS_M not found in TS engine"
    ts_table = {
        k: float(v)
        for k, v in re.findall(r"(\w+):\s*([0-9.]+)\s*,", block.group(1))
    }
    assert ts_table, "parsed an empty deck-thickness table from TS"
    assert ts_table == vg.DECK_SUBTYPE_EQ_THICKNESS_M, (
        "Python DECK_SUBTYPE_EQ_THICKNESS_M drifted from the TS engine: "
        f"TS={ts_table} Python={vg.DECK_SUBTYPE_EQ_THICKNESS_M}"
    )


def test_default_deck_thickness_matches_ts():
    src = _ts_source()
    # `DECK_SUBTYPE_EQ_THICKNESS_M[input.bridge_deck_subtype ?? 'deskovy'] ?? 0.5`
    m = re.search(
        r"DECK_SUBTYPE_EQ_THICKNESS_M\[[^\]]*\?\?\s*'(\w+)'\s*\]\s*\?\?\s*([0-9.]+)",
        src,
    )
    assert m, "deck-thickness default fallback not found in TS engine"
    assert m.group(1) == vg.DEFAULT_DECK_SUBTYPE
    assert float(m.group(2)) == vg.DEFAULT_DECK_THICKNESS_M


def test_divergence_bands_match_ts():
    src = _ts_source()
    # OK window: `ratio >= 0.7 && ratio <= 1.5`
    ok = re.search(r"ratio\s*>=\s*([0-9.]+)\s*&&\s*ratio\s*<=\s*([0-9.]+)", src)
    assert ok, "OK band not found in TS engine"
    assert float(ok.group(1)) == vg.BAND_OK_LOW
    assert float(ok.group(2)) == vg.BAND_OK_HIGH
    # critical-low cut: `ratio < 0.3`
    crit_low = re.search(r"ratio\s*<\s*([0-9.]+)\s*\)", src)
    assert crit_low and float(crit_low.group(1)) == vg.BAND_CRIT_LOW
    # critical-high cut: `ratio <= 3`
    crit_high = re.search(r"ratio\s*<=\s*([0-9.]+)\s*\)\s*\{", src)
    assert crit_high and float(crit_high.group(1)) == vg.BAND_CRIT_HIGH


def test_expected_volume_formula_shape_matches_ts():
    src = _ts_source()
    # mostovka: span × num_spans × nk_width × thick
    assert re.search(
        r"input\.span_m\s*\*\s*input\.num_spans\s*\*\s*input\.nk_width_m\s*\*\s*thick",
        src,
    ), "TS mostovka expected-volume formula changed shape"
    # pilota: π r² L count
    assert re.search(
        r"Math\.PI\s*\*\s*r\s*\*\s*r\s*\*\s*input\.pile_length_m\s*\*\s*input\.pile_count",
        src,
    ), "TS pilota expected-volume formula changed shape"


def test_python_formula_reproduces_ts_numbers():
    # A concrete value computed by hand from the (now-asserted) TS formula:
    # span 20 × 6 spans × 12 m width × 0.5 (deskovy) = 720 m³
    assert vg.estimate_expected_volume(
        "mostovkova_deska", span_m=20, num_spans=6, nk_width_m=12,
        bridge_deck_subtype="deskovy",
    ) == 720.0
    # sprazeny thickness 0.25 → 360 m³
    assert vg.estimate_expected_volume(
        "mostovkova_deska", span_m=20, num_spans=6, nk_width_m=12,
        bridge_deck_subtype="sprazeny",
    ) == 360.0
    # unknown subtype → default 0.5
    assert vg.estimate_expected_volume(
        "mostovkova_deska", span_m=20, num_spans=6, nk_width_m=12,
        bridge_deck_subtype=None,
    ) == 720.0
