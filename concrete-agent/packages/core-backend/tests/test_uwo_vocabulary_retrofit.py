"""UWO Gate-4 retrofit tests — vocabulary_code on decomposer atoms.

The three ratified checks (Alexander, Gate-4 GO 2026-07-14):

  1. Template→code mapping is STATIC data (inline in WORK_TEMPLATES /
     the branch KB YAML), deterministic — never an LLM pick. A template
     atom without a mapping is a vocabulary HOLE, not something to
     "match approximately": these tests fail loudly on it.
  2. The retrofit IS the test of the coverage contract:
     set(codes the built branches actually emit) == set(covered codes in
     the vocabulary) — EXACTLY. No covered code without an emitter
     (FALSEWORK.STRIP stays declared — the retrofit must not "pull it in"),
     no emitted code left declared. An assertion, not a manual check.
  3. Golden byte-stability except the new field is proven by the EXISTING
     atomizer goldens (test_uwo_atomizer_t1.py asserts per-field tuples,
     untouched) running green alongside these tests.

Runs WITHOUT fastmcp / pytest-asyncio — mirrors test_uwo_atomizer_t1.py:
plain sync tests drive the real coroutine via asyncio.run.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.breakdown import (  # noqa: E402
    WORK_TEMPLATES,
    _load_interier_psv_templates,
    create_work_breakdown,
)
from app.services.uwo_vocabulary import get_code, is_covered, load_vocabulary  # noqa: E402


def _emitted_codes() -> set:
    """Every vocabulary_code the built branches can emit (static data walk)."""
    codes = {
        tmpl["vocabulary_code"]
        for atoms in WORK_TEMPLATES.values()
        for tmpl in atoms
        if tmpl.get("vocabulary_code")
    }
    for section in _load_interier_psv_templates().values():
        for atom in section.get("atoms", []):
            if atom.get("vocabulary_code"):
                codes.add(atom["vocabulary_code"])
    return codes


# ── Check 1: static mapping is TOTAL over the built branches ─────────────────

def test_every_monolit_template_atom_has_a_static_code():
    for etype, atoms in WORK_TEMPLATES.items():
        for tmpl in atoms:
            code = tmpl.get("vocabulary_code")
            assert code, f"{etype}: template atom {tmpl['work']!r} has NO vocabulary_code — vocabulary hole, file a proposal"
            assert get_code(code) is not None, f"{etype}: {code} not in vocabulary"


def test_every_interier_kb_atom_has_a_static_code():
    sections = _load_interier_psv_templates()
    assert sections, "interier_psv KB templates missing"
    for key, section in sections.items():
        for atom in section.get("atoms", []):
            code = atom.get("vocabulary_code")
            assert code, f"{key}: atom {atom['key']} has NO vocabulary_code"
            assert get_code(code) is not None, f"{key}: {code} not in vocabulary"


# ── Check 2: coverage-contract closure — the load-bearing assertion ─────────

def test_emitted_set_equals_covered_set_exactly():
    vocab = load_vocabulary()
    covered = {c for c, e in vocab["codes"].items() if e["coverage"] == "covered"}
    emitted = _emitted_codes()
    assert emitted == covered, (
        "coverage contract broken:\n"
        f"  covered-without-emitter: {sorted(covered - emitted)}\n"
        f"  emitted-but-declared:    {sorted(emitted - covered)}"
    )


def test_falsework_strip_stays_declared_and_unemitted():
    # Honesty pin: removal of the falsework is its own položka the branch does
    # NOT emit today — the retrofit must not have "pulled it in".
    assert "FORMWORK.FALSEWORK.STRIP" not in _emitted_codes()
    assert is_covered("FORMWORK.FALSEWORK.STRIP") is False


# ── Emission: live run carries the code on every atom ───────────────────────

def test_breakdown_items_carry_covered_vocabulary_codes():
    result = asyncio.run(create_work_breakdown(
        elements=[
            {"name": "Pilíř P1", "volume_m3": 24, "concrete_class": "C30/37"},
            {"name": "NK mostovka", "volume_m3": 605, "concrete_class": "C35/45",
             "is_prestressed": True},
        ],
        project_type="bridge",
    ))
    items = result["work_items"] if "work_items" in result else result.get("items", [])
    assert items, f"no items emitted: {list(result.keys())}"
    for it in items:
        code = it.get("vocabulary_code")
        assert code, f"item without vocabulary_code: {it.get('work_description')!r}"
        assert is_covered(code), f"emitted code not covered: {code}"
