"""DWG fallback chain tests — PR3 §3.1.

Tests mock the subprocess calls so they run without ODA / LibreDWG
binaries installed in the sandbox. The real binaries live in the
Cloud Run image (Dockerfile updates in a later PR3 commit).
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from app.services.uep.dwg_converter import (
    LIBREDWG_CONFIDENCE,
    ODA_CONFIDENCE,
    ConversionResult,
    convert_dwg_to_dxf,
)


def _make_fake_dwg(tmp_path: Path, name: str = "input.dwg") -> Path:
    p = tmp_path / name
    p.write_bytes(b"AC1027\x00\x00FAKE_DWG_CONTENT_FOR_TEST\x00" * 10)
    return p


def _make_fake_dxf(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    # Minimal DXF skeleton just for the cache-validation path. The
    # tests that need ezdxf to actually parse this will use ezdxf
    # to write a real fixture.
    target.write_text("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# ODA success path
# ---------------------------------------------------------------------------


def test_oda_success_returns_oda_source_high_confidence(tmp_path: Path) -> None:
    dwg = _make_fake_dwg(tmp_path)
    work = tmp_path / "work"

    def _fake_oda(_dwg, out_dir):
        _make_fake_dxf(out_dir / (dwg.stem + ".dxf"))
        return True, "", 1234

    with patch(
        "app.services.uep.dwg_converter._run_oda", side_effect=_fake_oda
    ) as m_oda, patch(
        "app.services.uep.dwg_converter._run_libredwg"
    ) as m_libredwg:
        result = convert_dwg_to_dxf(dwg, work)

    assert result.success
    assert result.source == "oda"
    assert result.confidence == ODA_CONFIDENCE
    assert result.dxf_path is not None and result.dxf_path.exists()
    assert m_oda.call_count == 1
    # LibreDWG must not be called when ODA succeeds.
    assert m_libredwg.call_count == 0


# ---------------------------------------------------------------------------
# ODA fail → LibreDWG fallback
# ---------------------------------------------------------------------------


def test_oda_fail_libredwg_success_uses_fallback(tmp_path: Path) -> None:
    dwg = _make_fake_dwg(tmp_path)
    work = tmp_path / "work"

    def _fake_libredwg(_dwg, out_dxf):
        _make_fake_dxf(out_dxf)
        return True, "", 567

    with patch(
        "app.services.uep.dwg_converter._run_oda",
        return_value=(False, "oda blew up", 999),
    ), patch(
        "app.services.uep.dwg_converter._run_libredwg",
        side_effect=_fake_libredwg,
    ):
        result = convert_dwg_to_dxf(dwg, work)

    assert result.success
    assert result.source == "libredwg"
    assert result.confidence == LIBREDWG_CONFIDENCE
    assert len(result.attempts) == 2
    assert result.attempts[0].tool == "oda" and not result.attempts[0].success
    assert result.attempts[1].tool == "libredwg" and result.attempts[1].success


# ---------------------------------------------------------------------------
# Both fail → escalation, NOT silent drop
# ---------------------------------------------------------------------------


def test_both_fail_escalates_no_silent_drop(tmp_path: Path) -> None:
    """Task constraint: a DWG is NEVER silently dropped."""

    dwg = _make_fake_dwg(tmp_path)
    work = tmp_path / "work"

    with patch(
        "app.services.uep.dwg_converter._run_oda",
        return_value=(False, "oda dead", 1),
    ), patch(
        "app.services.uep.dwg_converter._run_libredwg",
        return_value=(False, "libredwg dead", 1),
    ):
        result = convert_dwg_to_dxf(dwg, work)

    assert not result.success
    assert result.escalated is True
    assert result.dxf_path is None
    assert len(result.attempts) == 2
    assert all(not a.success for a in result.attempts)


# ---------------------------------------------------------------------------
# Cache hit on re-conversion of same content
# ---------------------------------------------------------------------------


def test_cache_hit_on_identical_content(tmp_path: Path, monkeypatch) -> None:
    cache = tmp_path / "cache"
    cache.mkdir()
    monkeypatch.setenv("UEP_DWG_CACHE_DIR", str(cache))

    dwg = _make_fake_dwg(tmp_path)
    work = tmp_path / "work"

    # First conversion via ODA — populates the cache.
    def _fake_oda(_dwg, out_dir):
        # Write a real ezdxf-parseable file so the cache validation
        # passes on lookup.
        import ezdxf  # type: ignore[import-not-found]
        doc = ezdxf.new("R2018")
        doc.modelspace().add_line((0, 0), (1, 1))
        doc.saveas(str(out_dir / (dwg.stem + ".dxf")))
        return True, "", 100

    with patch(
        "app.services.uep.dwg_converter._run_oda", side_effect=_fake_oda
    ) as m_oda:
        r1 = convert_dwg_to_dxf(dwg, work)
        assert r1.success
        assert m_oda.call_count == 1

        # Second call on the same content — must hit the cache.
        r2 = convert_dwg_to_dxf(dwg, work / "second")
        assert r2.success
        assert r2.cache_hit is True
        assert r2.source == "cache"
        # ODA never invoked the second time.
        assert m_oda.call_count == 1


# ---------------------------------------------------------------------------
# Cache corruption auto-invalidates
# ---------------------------------------------------------------------------


def test_cached_dxf_corruption_auto_invalidates(tmp_path: Path, monkeypatch) -> None:
    cache = tmp_path / "cache"
    cache.mkdir()
    monkeypatch.setenv("UEP_DWG_CACHE_DIR", str(cache))

    dwg = _make_fake_dwg(tmp_path)
    work = tmp_path / "work"

    # Seed the cache with garbage that ezdxf will reject.
    import hashlib
    digest = hashlib.sha256(dwg.read_bytes()).hexdigest()
    (cache / f"{digest}.dxf").write_bytes(b"NOT_A_VALID_DXF")

    def _fake_oda(_dwg, out_dir):
        import ezdxf
        doc = ezdxf.new("R2018")
        doc.modelspace().add_line((0, 0), (1, 1))
        doc.saveas(str(out_dir / (dwg.stem + ".dxf")))
        return True, "", 100

    with patch(
        "app.services.uep.dwg_converter._run_oda", side_effect=_fake_oda
    ) as m_oda:
        result = convert_dwg_to_dxf(dwg, work)

    assert result.success
    # Cache miss because invalidation fired → ODA ran.
    assert result.cache_hit is False
    assert m_oda.call_count == 1
    # New cache file is the freshly-converted (valid) DXF.
    assert (cache / f"{digest}.dxf").exists()
