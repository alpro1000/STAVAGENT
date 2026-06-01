"""
Golden Test: W3b — activation of object type from the technical report.

Validates that the construction object's type is determined ONCE from its TZ
(name + charakteristika) and threaded as the authoritative classification context
into every element of that object — closing the W3 gap where nobody filled
`object_type` and the fragile name+code fallback stayed in effect.

Skip-proof, like test_mcp_golden_so250.py: sync test_* functions driving the real
coroutines via asyncio.run — no @pytest.mark.asyncio, no fastmcp/app.mcp.server
import. A missing dep ERRORS (red), never silently skips.

Criteria from §4 of docs/tasks/TASK_W3b_ActivateObjectType.md (continues from #71):

  #71 — detect type from TZ (name + charakteristika ONLY, not full text)
  #72 — authoritative + threaded: every element of an object gets the same type
  #73 — bridge with a generic name → bridge classification (the activation payoff)
  #74 — retaining wall → wall/operna_zed, no false bridge flip
  #75 — once per object: detection runs once, cached, not recomputed (spy)
  #76 — undetermined type → fallback unchanged vs W3 (no #63–#70 regression)
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.breakdown import create_work_breakdown
from app.mcp.tools.object_type_detector import (
    detect_and_cache_object_type,
    detect_object_type,
    get_cached_object_type,
)

# SO-250 TZ excerpts (object name + charakteristika ONLY). The geology section of
# the real TZ mentions "mostní objekt" / "lávka SO 222" — deliberately NOT passed
# here, because detection must use only name + charakteristika (criterion #71).
SO250_NAME = "Zárubní zeď v km 6,500 – 7,000 vpravo"
SO250_CHARAKTERISTIKA = "Úhlová železobetonová zeď."
SO250_FULLTEXT_NOISE = (
    "Geologie: navazuje na mostní objekt a lávku SO 222 přes potok. "
    "Most ev.č. 6-049 se nachází poblíž."
)

SO202_NAME = "Most na sil. I/6 přes Lomnický potok"
SO202_CHARAKTERISTIKA = "Trvalý dálniční most o třech polích."


# ── in-memory fake project cache (no disk / no real project_cache) ────────────
class FakeCache:
    """Minimal stand-in for project_cache load/save, with a detect-call spy."""

    def __init__(self):
        self.store: dict[str, dict] = {}
        self.save_calls = 0

    def loader(self, project_id: str):
        return self.store.get(project_id), f"/fake/{project_id}"

    def saver(self, project_id: str, field: str, value):
        self.save_calls += 1
        self.store.setdefault(project_id, {"project_id": project_id})[field] = value


def _classify_via_breakdown(name, project_id=None, so_code=None):
    """Run the real create_work_breakdown for one element and return its
    element_type (read from the produced work items)."""
    result = asyncio.run(
        create_work_breakdown(
            elements=[{"name": name, "object_code": so_code, "volume_m3": 10}],
            project_id=project_id,
        )
    )
    assert "error" not in result, f"breakdown error: {result.get('error')}"
    items = result.get("items", [])
    assert items, f"no work items produced for {name!r}"
    # All items of one element share its element_type.
    return items[0]["element_type"]


# ── #71 — detection from name + charakteristika only ──────────────────────────

def test_71_detect_type_from_tz_name_and_charakteristika():
    assert detect_object_type(SO250_NAME, SO250_CHARAKTERISTIKA) == "retaining_wall"
    assert detect_object_type(SO202_NAME, SO202_CHARAKTERISTIKA) == "bridge"


def test_71_fulltext_most_noise_does_not_flip_wall_to_bridge():
    """Geology noise mentioning a neighbouring most/lávka must NOT make the wall a
    bridge — detection sees only name + charakteristika, never that full text."""
    # Correct call (name + charakteristika) → wall.
    assert detect_object_type(SO250_NAME, SO250_CHARAKTERISTIKA) == "retaining_wall"
    # Even if the noise were (wrongly) handed in as charakteristika, the explicit
    # wall wording in the name still wins over the bridge mention.
    assert (
        detect_object_type(SO250_NAME, SO250_CHARAKTERISTIKA + " " + SO250_FULLTEXT_NOISE)
        == "retaining_wall"
    )


# ── #72 — authoritative + threaded to every element of the object ─────────────

def test_72_object_type_threaded_to_each_element():
    fake = FakeCache()
    detect_and_cache_object_type(
        "proj-202", "SO 202", SO202_NAME, SO202_CHARAKTERISTIKA,
        loader=fake.loader, saver=fake.saver,
    )
    # Two differently-named bridge elements; both must land in bridge context
    # purely from the cached object type, not their individual names.
    result = asyncio.run(
        create_work_breakdown(
            elements=[
                {"name": "Dřík", "object_code": "SO 202", "volume_m3": 10},
                {"name": "Základ", "object_code": "SO 202", "volume_m3": 10},
            ],
            project_id="proj-202",
            object_types=fake.store["proj-202"]["object_types"],
        )
    )
    types = {it["element_name"]: it["element_type"] for it in result["items"]}
    assert types.get("Dřík") == "driky_piliru", types
    assert types.get("Základ") == "zaklady_piliru", types


# ── #73 — bridge with a generic name (the activation payoff) ───────────────────

def test_73_bridge_generic_name_classifies_in_bridge_context():
    result = asyncio.run(
        create_work_breakdown(
            elements=[{"name": "Dřík", "object_code": "SO 202", "volume_m3": 10}],
            project_id="proj-202",
            object_types={"SO 202": "bridge"},
        )
    )
    et = result["items"][0]["element_type"]
    assert et == "driky_piliru", (
        f"#73 generic 'Dřík' under a bridge must be driky_piliru, not a wall. Got {et}"
    )


# ── #74 — retaining wall, no false bridge flip ────────────────────────────────

def test_74_retaining_wall_no_false_bridge():
    result = asyncio.run(
        create_work_breakdown(
            elements=[{"name": "Dřík", "object_code": "SO 250", "volume_m3": 10}],
            project_id="proj-250",
            object_types={"SO 250": "retaining_wall"},
        )
    )
    et = result["items"][0]["element_type"]
    assert et == "operna_zed", (
        f"#74 'Dřík' under a retaining wall must be operna_zed, not a pier. Got {et}"
    )


# ── #75 — once per object: detection runs once, then cache-read only ──────────

def test_75_detection_runs_once_per_object():
    fake = FakeCache()
    calls = {"n": 0}
    real_detect = detect_object_type

    import app.mcp.tools.object_type_detector as otd

    def counting_detect(name, charakteristika=""):
        calls["n"] += 1
        return real_detect(name, charakteristika)

    otd.detect_object_type = counting_detect
    try:
        for _ in range(3):  # 3 elements of the same object
            detect_and_cache_object_type(
                "proj-250", "SO 250", SO250_NAME, SO250_CHARAKTERISTIKA,
                loader=fake.loader, saver=fake.saver,
            )
    finally:
        otd.detect_object_type = real_detect

    assert calls["n"] == 1, f"#75 detection must run once per object, ran {calls['n']}x"
    assert fake.save_calls == 1, f"#75 cache written once, wrote {fake.save_calls}x"
    assert get_cached_object_type("proj-250", "SO 250", loader=fake.loader) == "retaining_wall"


# ── #76 — undetermined type → unchanged W3 fallback ───────────────────────────

def test_76_undetermined_type_falls_back():
    # Ambiguous TZ → None (no detection).
    assert detect_object_type("SO 999 objekt", "Blíže neurčeno.") is None
    # Cache miss → consumer returns None.
    assert get_cached_object_type("proj-x", "SO 999", loader=FakeCache().loader) is None
    # And breakdown with no object_types behaves exactly like W3 name+code fallback:
    # 'Dřík' under bare SO 202 (no cached type) → wall stem (W3 behavior).
    result = asyncio.run(
        create_work_breakdown(
            elements=[{"name": "Dřík", "object_code": "SO 202", "volume_m3": 10}],
            project_id=None,
        )
    )
    assert result["items"][0]["element_type"] == "operna_zed"
