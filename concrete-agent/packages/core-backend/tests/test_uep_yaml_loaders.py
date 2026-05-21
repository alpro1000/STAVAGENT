"""
YAML loader hardening tests — Amazon Q PR #1186 comment C3.

All 4 UEP YAML loaders must wrap raw `yaml.YAMLError` / `OSError`
in a `RuntimeError` with the source path, so a malformed bundled
YAML doesn't propagate as a bare 500 to the REST handler.

Loaders covered:
  - app.services.uep.coverage_engine.load_matrix
  - app.services.uep.reconciliation_engine.load_rules
  - app.services.uep.derivation_registry.load_registry
  - app.services.uep.concurrency_validator.load_tier_limits_from_yaml
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.uep.concurrency_validator import load_tier_limits_from_yaml
from app.services.uep.coverage_engine import load_matrix
from app.services.uep.derivation_registry import load_registry
from app.services.uep.reconciliation_engine import load_rules


def _make_bad_yaml(tmp_path: Path, name: str) -> Path:
    p = tmp_path / name
    p.write_text(
        "version: 1\n"
        "rules:\n"
        "  - id: bad\n"
        "    unclosed_string: 'hello\n",  # truncated string → YAMLError
        encoding="utf-8",
    )
    return p


def test_coverage_engine_wraps_yamlerror(tmp_path: Path) -> None:
    p = _make_bad_yaml(tmp_path, "matrix.yaml")
    with pytest.raises(RuntimeError) as exc:
        load_matrix(p, project_type="residential")
    assert "Failed to load coverage matrix" in str(exc.value)
    assert str(p) in str(exc.value)


def test_reconciliation_engine_wraps_yamlerror(tmp_path: Path) -> None:
    p = _make_bad_yaml(tmp_path, "recon.yaml")
    with pytest.raises(RuntimeError) as exc:
        load_rules(p, project_type="residential")
    assert "Failed to load reconciliation rules" in str(exc.value)


def test_derivation_registry_wraps_yamlerror(tmp_path: Path) -> None:
    p = _make_bad_yaml(tmp_path, "deriv.yaml")
    with pytest.raises(RuntimeError) as exc:
        load_registry(p)
    assert "Failed to load derivation rules" in str(exc.value)


def test_tier_limits_wraps_yamlerror(tmp_path: Path) -> None:
    p = _make_bad_yaml(tmp_path, "tiers.yaml")
    with pytest.raises(RuntimeError) as exc:
        load_tier_limits_from_yaml(p)
    assert "Failed to load tier limits" in str(exc.value)


def test_loaders_wrap_missing_file_as_runtimeerror(tmp_path: Path) -> None:
    """Missing file → OSError under the hood → RuntimeError surface."""

    missing = tmp_path / "does_not_exist.yaml"
    # load_tier_limits_from_yaml uses .read_text() so missing file raises
    # FileNotFoundError (subclass of OSError) → wrapped.
    with pytest.raises(RuntimeError):
        load_tier_limits_from_yaml(missing)
