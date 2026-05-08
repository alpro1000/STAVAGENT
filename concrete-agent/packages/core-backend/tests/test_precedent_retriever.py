"""Unit tests for app.services.precedent_retriever.

Focused tests for: derive_scope_range, METADATA.md parsing, scoring, retrieve_precedents.
Uses tmp_path with fake KB structure to avoid coupling to actual KB content.
"""

from pathlib import Path

import pytest

from app.models.norm_schemas import AdvisorContext, Precedent
from app.services.precedent_retriever import (
    derive_scope_range,
    retrieve_precedents,
    format_precedents_for_prompt,
    _parse_metadata_md,
    _score_precedent,
)


# ---------------------------------------------------------------------------
# derive_scope_range
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("kc,expected", [
    (5_000_000,   "small"),
    (15_000_000,  "small"),
    (20_000_000,  "mid"),
    (50_000_000,  "mid"),
    (70_000_000,  "large"),
    (100_000_000, "large"),
    (None,        None),
    (0,           None),
    (-100,        None),
])
def test_derive_scope_range(kc, expected):
    assert derive_scope_range(kc) == expected


# ---------------------------------------------------------------------------
# _parse_metadata_md
# ---------------------------------------------------------------------------

def _write_md(tmp_path: Path, content: str) -> Path:
    """Helper: write a METADATA.md file under tmp_path/precedent_dir/."""
    p = tmp_path / "precedent_dir" / "METADATA.md"
    p.parent.mkdir(parents=True)
    p.write_text(content, encoding="utf-8")
    return p


def test_parse_metadata_md_full(tmp_path):
    md = _write_md(tmp_path, """
# Test pilot

## Project metadata

| Field | Value |
|---|---|
| **Project type** | mostovy (silnice III) |
| **Project size** | 12 201 523 Kč bez DPH |
| **Duration** | 11 měsíců |
| **ZS poměr** | 22.6 % |
| **Status** | tender_ready |
""")
    result = _parse_metadata_md(md)
    assert result["project_type"] == "mostovy"
    assert result["scope_kc_bez_dph"] is not None
    assert 12_000_000 < result["scope_kc_bez_dph"] < 13_000_000
    assert result["duration_mes"] == 11.0
    assert result["zs_pomer_pct"] == 22.6
    assert "tender_ready" in (result["status"] or "")


def test_parse_metadata_md_amounts_in_M(tmp_path):
    """Amounts like '70 M Kč' should parse to 70_000_000."""
    md = _write_md(tmp_path, """
**Project type:** highway_urban
**Project size:** 70 M Kč
**Duration:** 7 měs
**ZS poměr:** 5.0 %
""")
    result = _parse_metadata_md(md)
    assert result["scope_kc_bez_dph"] == 70_000_000.0
    assert result["duration_mes"] == 7.0
    assert result["project_type"] == "highway_urban"


def test_parse_metadata_md_missing_fields(tmp_path):
    md = _write_md(tmp_path, "# Just a heading, no metadata")
    result = _parse_metadata_md(md)
    assert result["project_type"] is None
    assert result["scope_kc_bez_dph"] is None
    assert result["duration_mes"] is None


# ---------------------------------------------------------------------------
# _score_precedent
# ---------------------------------------------------------------------------

def test_score_precedent_exact_type_and_scope():
    p = Precedent(
        name="ref1", path="x", project_type="mostovy",
        scope_kc_bez_dph=12_000_000, scope_range="small",
        duration_mes=11.0, status="tender_ready",
    )
    ctx = AdvisorContext(
        project_type="mostovy",
        scope_kc_bez_dph=10_000_000,
        scope_range="small",
        duration_mes=11.0,
    )
    score = _score_precedent(p, ctx)
    # type 5.0 + scope ratio in [0.5,2] 3.0 + bucket 2.0 + duration 1.0 + status 0.5 = 11.5
    assert score == pytest.approx(11.5)


def test_score_precedent_no_match():
    p = Precedent(
        name="ref-urban", path="x",
        project_type="highway_urban", scope_kc_bez_dph=70_000_000, scope_range="large",
        duration_mes=7.0,
    )
    ctx = AdvisorContext(project_type="mostovy", scope_kc_bez_dph=10_000_000, scope_range="small")
    score = _score_precedent(p, ctx)
    assert score == 0.0


def test_score_precedent_partial_type_match():
    p = Precedent(name="ref", path="x", project_type="mostovy III. třídy")
    ctx = AdvisorContext(project_type="mostovy")
    score = _score_precedent(p, ctx)
    assert score == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# retrieve_precedents — end-to-end with fake KB
# ---------------------------------------------------------------------------

def _make_fake_kb(tmp_path: Path) -> Path:
    """Build minimal KB tree: B5_tech_cards/{real_world_examples,ZS_templates}/.../METADATA.md."""
    kb = tmp_path / "kb"
    rwe_zihle = kb / "B5_tech_cards" / "real_world_examples" / "zihle"
    rwe_zihle.mkdir(parents=True)
    (rwe_zihle / "METADATA.md").write_text("""
**Project type:** mostovy
**Project size:** 12 201 523 Kč bez DPH
**Duration:** 11 měs
**ZS poměr:** 22.6 %
**Status:** tender_ready
""", encoding="utf-8")

    zst_kfely = kb / "B5_tech_cards" / "ZS_templates" / "mostovy" / "kfely"
    zst_kfely.mkdir(parents=True)
    (zst_kfely / "METADATA.md").write_text("""
**Project type:** mostovy
**Project size:** 70 M Kč
**Duration:** 7 měs
**ZS poměr:** 5.0 %
**Status:** complete
""", encoding="utf-8")

    zst_d6 = kb / "B5_tech_cards" / "ZS_templates" / "highway_urban" / "d6"
    zst_d6.mkdir(parents=True)
    (zst_d6 / "METADATA.md").write_text("""
**Project type:** highway_urban
**Project size:** 76 M Kč
**Duration:** 12 měs
**ZS poměr:** 9.9 %
""", encoding="utf-8")

    return kb


def test_retrieve_precedents_mostovy_small_prefers_zihle(tmp_path):
    kb = _make_fake_kb(tmp_path)
    ctx = AdvisorContext(
        project_type="mostovy",
        scope_kc_bez_dph=10_000_000,
        duration_mes=11.0,
    )
    # auto-derive scope_range
    if ctx.scope_range is None:
        ctx.scope_range = derive_scope_range(ctx.scope_kc_bez_dph)

    precedents = retrieve_precedents(ctx, top_k=3, kb_root=kb)
    assert len(precedents) == 2  # zihle + kfely (d6 is highway_urban, score=0, dropped)
    # zihle should rank first (same scope_range + similar size + same type + duration match)
    assert precedents[0].name == "zihle"
    assert precedents[0].score > precedents[1].score


def test_retrieve_precedents_no_match_returns_empty(tmp_path):
    kb = _make_fake_kb(tmp_path)
    ctx = AdvisorContext(project_type="some_unknown_type", scope_kc_bez_dph=999_000_000)
    precedents = retrieve_precedents(ctx, top_k=3, kb_root=kb)
    assert precedents == []


def test_retrieve_precedents_missing_kb_dir(tmp_path):
    """retrieve_precedents must gracefully return [] when KB dirs don't exist."""
    ctx = AdvisorContext(project_type="mostovy", scope_kc_bez_dph=10_000_000)
    precedents = retrieve_precedents(ctx, top_k=3, kb_root=tmp_path / "nonexistent")
    assert precedents == []


# ---------------------------------------------------------------------------
# format_precedents_for_prompt
# ---------------------------------------------------------------------------

def test_format_precedents_for_prompt_empty():
    assert format_precedents_for_prompt([]) == ""


def test_format_precedents_for_prompt_renders_block():
    p = Precedent(
        name="zihle",
        path="B5_tech_cards/real_world_examples/zihle",
        project_type="mostovy",
        scope_kc_bez_dph=12_201_523,
        scope_range="small",
        duration_mes=11,
        zs_pomer_pct=22.6,
        status="tender_ready",
        summary_lines=["**Project type:** mostovy", "**Project size:** 12.2 M Kč"],
        score=11.5,
    )
    block = format_precedents_for_prompt([p])
    assert "REFERENČNÍ PRECEDENTY" in block
    assert "zihle" in block
    assert "11.5" in block
    assert "12.2 M Kč" in block
    assert "mostovy" in block
    assert "22.6 %" in block
