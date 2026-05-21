"""
`BaseExtractor` behavioural tests.

Phase-1 gate (task §3.1) says EVERY input file gets a `PerSourceExtraction`
record — either with facts or with `extractor_error` populated. NEVER a
silent skip. These tests pin that invariant.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.models.uep_schemas import ExtractedFact, SourceFormat
from app.services.uep.extractor_base import BaseExtractor, ExtractorError


class _StubExtractor(BaseExtractor):
    """Pluggable stub: injectable behaviour for `_extract`."""

    source_format = SourceFormat.DXF
    extractor_id = "uep.stub_extractor"
    extractor_version = "test"
    default_confidence = 0.42

    def __init__(self, behaviour: str) -> None:
        self._behaviour = behaviour

    def _extract(self, path: Path):
        if self._behaviour == "ok":
            return [ExtractedFact(category="x", field="y", value=1)], {"raw": "ok"}, []
        if self._behaviour == "extractor_error":
            raise ExtractorError("synthetic fatal")
        if self._behaviour == "unexpected_error":
            raise ValueError("synthetic unexpected")
        raise AssertionError(f"unknown behaviour {self._behaviour!r}")


def test_returns_failure_record_when_file_missing(tmp_path: Path) -> None:
    """File-existence check happens BEFORE `_extract` is called."""
    ex = _StubExtractor(behaviour="ok")
    missing = tmp_path / "nope.dxf"
    result = ex.extract(missing)
    assert result.extractor_error is not None
    assert "not found" in result.extractor_error.lower()
    assert result.facts == []
    assert result.confidence == 0.0
    # Provenance still populated — coverage matrix can see WHO failed where.
    assert result.provenance.source_file == "nope.dxf"
    assert result.provenance.extractor == "uep.stub_extractor"


def test_returns_failure_when_path_is_directory(tmp_path: Path) -> None:
    """A directory is not a file — surfaced via `extractor_error`."""
    ex = _StubExtractor(behaviour="ok")
    result = ex.extract(tmp_path)
    assert result.extractor_error is not None
    assert "not a regular file" in result.extractor_error.lower()


def test_happy_path_returns_facts_and_confidence(tmp_path: Path) -> None:
    """Successful extraction packs facts + applies `default_confidence`."""
    f = tmp_path / "exists.dxf"
    f.write_text("dummy")
    ex = _StubExtractor(behaviour="ok")
    result = ex.extract(f)
    assert result.extractor_error is None
    assert result.confidence == 0.42
    assert len(result.facts) == 1
    assert result.facts[0].category == "x"
    assert result.data == {"raw": "ok"}
    assert result.parse_duration_ms >= 0


def test_extractor_error_surfaced(tmp_path: Path) -> None:
    """`ExtractorError` raised inside `_extract` packs into `extractor_error`."""
    f = tmp_path / "exists.dxf"
    f.write_text("dummy")
    ex = _StubExtractor(behaviour="extractor_error")
    result = ex.extract(f)
    assert result.extractor_error == "synthetic fatal"
    assert result.facts == []
    assert result.confidence == 0.0


def test_unexpected_exception_does_not_crash_caller(tmp_path: Path) -> None:
    """Any other exception is caught and recorded — no propagation up."""
    f = tmp_path / "exists.dxf"
    f.write_text("dummy")
    ex = _StubExtractor(behaviour="unexpected_error")
    result = ex.extract(f)
    assert result.extractor_error is not None
    assert "ValueError" in result.extractor_error
    assert "synthetic unexpected" in result.extractor_error


def test_provenance_carries_extractor_metadata(tmp_path: Path) -> None:
    """Identification block must be filled — audit trail relies on it."""
    f = tmp_path / "audit.dxf"
    f.write_text("dummy")
    ex = _StubExtractor(behaviour="ok")
    result = ex.extract(f)
    assert result.provenance.extractor == "uep.stub_extractor"
    assert result.provenance.extractor_version == "test"
    assert result.provenance.source_format == SourceFormat.DXF
