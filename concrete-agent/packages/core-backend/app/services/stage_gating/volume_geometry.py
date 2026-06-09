"""Volume-vs-geometry cross-check — Python mirror of the canonical TS engine.

SINGLE SOURCE OF TRUTH = the TS engine
``Monolit-Planner/shared/src/classifiers/element-classifier.ts``
(``DECK_SUBTYPE_EQ_THICKNESS_M`` + ``estimateExpectedVolume`` +
``checkVolumeGeometry``).

This module is a deterministic *port* so the W3 (Python) soupis↔TZ join can run
the same cross-check the engine runs (two independent nets, one set of numbers).
The constants + formula + bands below are GUARDED against TS drift by
``tests/test_volume_geometry_parity.py``, which parses the TS source and asserts
equality. Per pin B (TS/Python drift anti-pattern): do **not** edit the numbers
here without first changing the TS engine (canonical) — the parity test will go
red otherwise.

The Czech user-facing message string stays on the TS side (UI owns it); this
port only emits the deterministic ``severity`` + numbers the join needs.
"""

from __future__ import annotations

import math
from typing import Optional

# ─── Mirror of DECK_SUBTYPE_EQ_THICKNESS_M (element-classifier.ts) ────────────
DECK_SUBTYPE_EQ_THICKNESS_M = {
    "deskovy": 0.5,
    "jednotram": 1.0,
    "dvoutram": 1.0,
    "vicetram": 1.0,
    "jednokomora": 0.7,
    "dvoukomora": 0.7,
    "ramovy": 0.8,
    "sprazeny": 0.25,
}
DEFAULT_DECK_SUBTYPE = "deskovy"
DEFAULT_DECK_THICKNESS_M = 0.5  # mirror of the `?? 0.5` fallback

# ─── Divergence bands (mirror checkVolumeGeometry) ───────────────────────────
#   ratio ∈ [0.7, 1.5]  → consistent (no issue)
#   ratio < 0.3         → critical (far too small)
#   0.3 ≤ ratio < 0.7   → warning  (small)
#   1.5 < ratio ≤ 3     → warning  (large)
#   ratio > 3           → critical (far too large)
BAND_OK_LOW = 0.7
BAND_OK_HIGH = 1.5
BAND_CRIT_LOW = 0.3
BAND_CRIT_HIGH = 3.0


def estimate_expected_volume(
    element_type: str,
    *,
    span_m: Optional[float] = None,
    num_spans: Optional[float] = None,
    nk_width_m: Optional[float] = None,
    bridge_deck_subtype: Optional[str] = None,
    pile_diameter_mm: Optional[float] = None,
    pile_length_m: Optional[float] = None,
    pile_count: Optional[float] = None,
) -> Optional[float]:
    """1st-order expected concrete volume from geometry (or None when the
    required inputs are absent — honest-blank, never guessed). Mirrors the TS
    ``estimateExpectedVolume`` exactly."""
    if element_type == "mostovkova_deska":
        if not span_m or not num_spans or not nk_width_m:
            return None
        thick = DECK_SUBTYPE_EQ_THICKNESS_M.get(
            bridge_deck_subtype or DEFAULT_DECK_SUBTYPE, DEFAULT_DECK_THICKNESS_M
        )
        return span_m * num_spans * nk_width_m * thick
    if element_type == "pilota":
        if not pile_diameter_mm or not pile_length_m or not pile_count:
            return None
        r = (pile_diameter_mm / 1000) / 2
        return math.pi * r * r * pile_length_m * pile_count
    return None


def check_volume_geometry(
    element_type: str, actual_m3: float, geometry: dict
) -> Optional[dict]:
    """Compare an actual volume against the geometry-derived expectation.
    Returns ``None`` when consistent (or geometry insufficient), else a dict
    ``{severity, actual_m3, expected_m3, ratio}``. Mirrors the TS
    ``checkVolumeGeometry`` band logic + rounding."""
    expected = estimate_expected_volume(element_type, **geometry)
    if expected is None or expected <= 0 or actual_m3 <= 0:
        return None
    ratio = actual_m3 / expected
    if BAND_OK_LOW <= ratio <= BAND_OK_HIGH:
        return None
    expected_rounded = round(expected * 10) / 10
    if ratio < BAND_CRIT_LOW:
        severity = "critical"
    elif ratio < BAND_OK_LOW:
        severity = "warning"
    elif ratio <= BAND_CRIT_HIGH:
        severity = "warning"
    else:
        severity = "critical"
    return {
        "severity": severity,
        "actual_m3": actual_m3,
        "expected_m3": expected_rounded,
        "ratio": round(ratio * 100) / 100,
    }
