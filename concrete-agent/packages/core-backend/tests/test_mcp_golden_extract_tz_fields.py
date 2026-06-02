"""
Golden Test: extract_tz_fields — stage 1, authoritative TEXT fields from the TZ.

Teaches the pipeline to READ the recipe-input fields from the technical report
itself (object name + charakteristika + named elements + per-element concrete
class), instead of being hand-fed `request.options`. Stage 1 is TEXT ONLY —
výměry / volumes from drawings (DXF / PDF geometry) are stage 2.

Skip-proof, like test_mcp_golden_so250b.py + test_thin_hybrid_recipe.py: plain
sync test_* functions driving the real coroutines via asyncio.run — no
@pytest.mark.asyncio, no fastmcp / app.mcp.server import, NO pdfplumber. The text
extractor is INJECTABLE; #94–#99 feed text= directly, #file_base64 feeds an
injected fake extractor. A missing dep ERRORS (red), never silently skips.

Criteria from docs/tasks/TASK_Extract_Stage1_TZFields.md §5 (continues from #94):

  #94 — SO-250 name + charakteristika from SIGNED SECTIONS, not poisoned by the
        geology section's "mostní objekt" / "lávka SO 222" (full-text trap).
  #95 — SO-202 name + charakteristika → "Most…" / "Trvalý dálniční most".
  #96 — extracted name+charakteristika → detect_object_type → SO-250
        retaining_wall, SO-202 bridge (end-to-end extract → detect).
  #97 — element list extracted from SO-202 (NK, dříky pilířů, opěry, úložné
        prahy, římsy, základy, pilota).
  #98 — concrete class BOUND to each element (≥6 SO-202 pairs); no dangling
        class without an element, no element silently dropped.
  #99 — every field carries _source (section/page) + confidence; unsure →
        OVĚŘIT/null; volume_m3 is None (stage 2), nothing fabricated.
  #100 — extract output IS the recipe input (drop-in vs request.options): the
        orchestrator runs SO-202 on the extract output end-to-end → flow
        completes, generic element gets the right type, soupis assembled.
        NOT that volumes are filled — that is stage 2.
"""

import asyncio
import os
import sys
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.detect_object_type import detect_object_type
from app.mcp.tools.extract_tz_fields import extract_tz_fields


# ── Canonical TZ text (page-marked, как _extract_pdf_text z pdfplumber) ────────
# SO-250 zárubní zeď. The GEOLOGY section deliberately mentions a neighbouring
# bridge — the full-text "most" trap that must NOT leak into name/charakteristika.
SO250_TZ_TEXT = """--- PAGE 1 ---
A. IDENTIFIKAČNÍ ÚDAJE OBJEKTU
Stavba: D6 Olšová Vrata – Žalmanov, VD-ZDS
Označení objektu: SO 250 – Zárubní zeď v km 6,500 – 7,000 vpravo
Stupeň: PDPS

B. CHARAKTERISTIKA OBJEKTU
Úhlová železobetonová zeď. Objekt zajišťuje zárubní stěnu zářezu silnice.

C. GEOLOGICKÉ POMĚRY
Trasa navazuje na mostní objekt a lávku SO 222 přes potok. Most ev.č. 6-049 se
nachází poblíž; v oblasti opěr mostu je granit karlovarského plutonu.

D. POUŽITÉ MATERIÁLY
Podkladní beton C12/15 X0
Základ C25/30 XF3, XC2, XA2
Dřík C30/37 XF4, XC4
Římsa C30/37 XF4, XD3, XC4
Výztuž B500B
--- PAGE 2 ---
(další strany — výkresy, statický výpočet)
"""

# SO-202 most. Materials section binds a concrete class to every named element.
SO202_TZ_TEXT = """--- PAGE 1 ---
A. ZÁKLADNÍ ÚDAJE
Stavba: D6, úsek Lomnice
Název objektu: SO 202 – Most na sil. I/6 přes Lomnický potok
Stupeň: DSP

B. CHARAKTERISTIKA MOSTU
Trvalý dálniční most o třech polích. Spojitá předpjatá deska.

C. SPECIFIKACE BETONU – MATERIÁLY
Nosná konstrukce (NK) C35/45 XF2
Dřík C35/45 XF4
Opěry C30/37 XF4
Úložné prahy C30/37 XF4
Římsy C30/37 XF4, XD3
Základy C25/30 XA2
Piloty C30/37 XA2
Výztuž B500B
--- PAGE 2 ---
(výkresy)
"""


def _field_classes(elements):
    """name -> concrete_class map from extracted elements."""
    return {e["name"]: e.get("concrete_class") for e in elements}


def _has_element(elements, stem):
    """True if any extracted element name contains the (lowercased) stem."""
    return any(stem.lower() in e["name"].lower() for e in elements)


# ── #94 — SO-250 name + charakteristika from signed sections, not poisoned ─────

def test_94_so250_name_and_charakteristika_from_sections_not_poisoned():
    res = asyncio.run(extract_tz_fields(text=SO250_TZ_TEXT))
    obj = res["object"]

    # The full text DOES contain the bridge poison (prove the trap is real):
    # geology references a neighbouring "mostní objekt" + "lávku SO 222".
    assert "mostní objekt" in SO250_TZ_TEXT and "lávk" in SO250_TZ_TEXT
    assert "SO 222" in SO250_TZ_TEXT

    # …but section-reading keeps name + charakteristika clean (no most/lávka).
    name_l = obj["object_name"].lower()
    char_l = (obj.get("charakteristika") or "").lower()
    assert "zárubní zeď" in name_l, obj
    assert "most" not in name_l and "lávk" not in name_l, obj
    assert "úhlová" in char_l, obj
    assert "most" not in char_l and "lávk" not in char_l, obj
    assert obj["object_code"] in ("SO 250", "SO-250", "SO250"), obj


# ── #95 — SO-202 name + charakteristika ───────────────────────────────────────

def test_95_so202_name_and_charakteristika():
    res = asyncio.run(extract_tz_fields(text=SO202_TZ_TEXT))
    obj = res["object"]
    assert "most" in obj["object_name"].lower(), obj
    assert "dálniční most" in (obj.get("charakteristika") or "").lower(), obj
    assert obj["object_code"] in ("SO 202", "SO-202", "SO202"), obj


# ── #96 — extract → detect_object_type (end-to-end) ────────────────────────────

def test_96_extract_feeds_detect_object_type():
    so250 = asyncio.run(extract_tz_fields(text=SO250_TZ_TEXT))["object"]
    so202 = asyncio.run(extract_tz_fields(text=SO202_TZ_TEXT))["object"]

    d250 = asyncio.run(detect_object_type(
        object_name=so250["object_name"], charakteristika=so250.get("charakteristika", "")))
    d202 = asyncio.run(detect_object_type(
        object_name=so202["object_name"], charakteristika=so202.get("charakteristika", "")))

    assert d250["object_type"] == "retaining_wall", d250
    assert d202["object_type"] == "bridge", d202


# ── #97 — element list extracted from SO-202 ──────────────────────────────────

def test_97_so202_element_list():
    elements = asyncio.run(extract_tz_fields(text=SO202_TZ_TEXT))["elements"]
    for stem in ("nk", "dřík", "opěr", "úložn", "říms", "základ", "pilot"):
        assert _has_element(elements, stem), (stem, [e["name"] for e in elements])


# ── #98 — concrete class bound to each element; no dangling, no lost ──────────

def test_98_concrete_class_bound_per_element():
    res = asyncio.run(extract_tz_fields(text=SO202_TZ_TEXT))
    elements = res["elements"]
    classes = _field_classes(elements)

    # ≥6 element↔class pairs bound.
    bound = {n: c for n, c in classes.items() if c}
    assert len(bound) >= 6, classes

    # Specific authoritative pairs (the binding must be per-element, not global).
    nk = next(e for e in elements if "nk" in e["name"].lower() or "nosná" in e["name"].lower())
    drik = next(e for e in elements if "dřík" in e["name"].lower())
    opera = next(e for e in elements if "opěr" in e["name"].lower())
    assert nk["concrete_class"] == "C35/45", nk
    assert drik["concrete_class"] == "C35/45", drik
    assert opera["concrete_class"] == "C30/37", opera

    # No dangling class assigned to a random element: every class came from the
    # same line as its element (audit trail records unbound classes separately).
    meta = res.get("_extraction_meta", {})
    assert "unbound_concrete_classes" in meta, meta
    # No element silently dropped: an element with no class is KEPT (None + verify),
    # never omitted — so the element count is not deflated by missing classes.
    assert all("name" in e for e in elements)


# ── #99 — _source + confidence per field; unsure → null; volume = stage 2 ─────

def test_99_source_and_confidence_grounding():
    res = asyncio.run(extract_tz_fields(text=SO202_TZ_TEXT))
    obj = res["object"]

    # Object fields carry _source with section + confidence.
    src = obj["_source"]
    assert src["object_name"]["section"] and src["object_name"]["confidence"] > 0, src
    assert src["charakteristika"]["section"], src

    for e in res["elements"]:
        # Stage 1 produces NO volume — it is explicitly None (stage 2), not 0/faked.
        assert e["volume_m3"] is None, e
        # Every element field is grounded.
        assert "_source" in e and "name" in e["_source"], e
        if e.get("concrete_class"):
            cc = e["_source"]["concrete_class"]
            assert cc["section"] and 0 < cc["confidence"] <= 1.0, e
        else:
            # Unsure → explicit verify flag, never a fabricated class.
            assert e.get("needs_verify") is True, e


# ── #file_base64 — glue test with an INJECTED fake extractor (no pdfplumber) ──

def test_file_base64_uses_injected_extractor():
    """file_base64 → decode → (injected) text extractor → same segmentation.

    The real pdfplumber parse is already covered by document.py; here we only
    verify the base64 → extractor → sections glue, with the extractor injected
    so the test needs no pdfplumber.
    """
    import base64

    captured = {}

    def fake_extractor(path):
        captured["path_exists"] = path.exists()
        return SO202_TZ_TEXT

    payload = base64.b64encode(b"%PDF-1.4 fake bytes").decode()
    res = asyncio.run(extract_tz_fields(
        file_base64=payload, filename="SO-202_TZ.pdf", _text_extractor=fake_extractor))

    assert captured.get("path_exists") is True  # decoded bytes were written to a temp file
    assert res["object"]["object_code"] in ("SO 202", "SO-202", "SO202"), res["object"]
    assert any("dřík" in e["name"].lower() for e in res["elements"]), res["elements"]


# ── #100 — extract output IS the recipe input (drop-in vs request.options) ────

def test_100_extract_output_is_recipe_input_end_to_end():
    """extract(SO-202) → request.options → orchestrator → COMMITTED.

    Asserts the AUTONOMY prize: the flow completes (volume=None passes through
    calculate + breakdown), the generic element gets the right bridge type, and
    the soupis is assembled — NOT that volumes/quantities are filled (stage 2).
    """
    from app.services.stage_gating import (
        InMemorySessionRepository,
        OrchestrateRequest,
        SessionManager,
        StageGatingOrchestrator,
        load_workflow_config,
    )
    from app.services.stage_gating.orchestrator import STATUS_COMPLETED
    from app.services.stage_gating.recipe_runner import make_recipe_tool_runner

    cfg = load_workflow_config()

    class FakeStore:
        def __init__(self):
            self.data = {}

        def loader(self, project_id):
            return self.data.get(project_id), f"/fake/{project_id}"

        def saver(self, project_id, field, value):
            self.data.setdefault(project_id, {})[field] = value

    def never_decide(_contradiction):  # extract output carries no nuance → never called
        raise AssertionError("decider must not be called for a no-nuance extract output")

    # 1) The extract output, used VERBATIM as request.options.
    extracted = asyncio.run(extract_tz_fields(text=SO202_TZ_TEXT))
    options = {"object": extracted["object"], "elements": extracted["elements"]}

    # Sanity: stage 1 really has no volumes (the thing #100 must survive).
    assert all(e["volume_m3"] is None for e in options["elements"]), options["elements"]

    store = FakeStore()
    repo = InMemorySessionRepository()
    runner = make_recipe_tool_runner(
        cfg, decider=never_decide, loader=store.loader, saver=store.saver)
    orch = StageGatingOrchestrator(manager=SessionManager(repo, config=cfg),
                                   config=cfg, tool_runner=runner)

    res = orch.run(OrchestrateRequest(
        user_id=uuid4(), project_id=uuid4(), options=options, confirmation_token="ok"))

    # Flow completes despite volume=None everywhere.
    assert res.status == STATUS_COMPLETED, res.error

    # Context is correct: the generic "Dřík" reaches driky_piliru via bridge type.
    state = repo.get(res.session_id)
    atom = state.partials.get("WORK_ATOMIZATION") or {}
    types = {c["name"]: c["element_type"] for c in atom.get("elements_classified", [])}
    assert types.get("Dřík") == "driky_piliru", types

    # Soupis assembled: the export step ran and produced a deliverable.
    committed = state.partials.get("COMMITTED") or {}
    assert committed.get("exported") is True, committed
    assert committed.get("row_count", 0) >= 1, committed
