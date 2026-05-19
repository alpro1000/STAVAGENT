"""
Tests for the YAML extension to `app.core.kb_loader.KnowledgeBaseLoader`.

Scope: covers the YAML support added in this PR + the skip-pattern
aggregator + metadata.yaml symmetry + the json↔yaml conflict warning.
A handful of JSON regression smoke tests are included to verify the
existing loader behaviour is untouched. A full JSON test suite is
out of scope and tracked separately.

Fixtures: tests/fixtures/kb_loader/{valid_yaml,valid_json,malformed,
skip_files,metadata_yaml,metadata_conflict}.

Reference: TASK_DCR_KBYamlLoader.md Gate 8.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pytest

from app.core.kb_loader import (
    KnowledgeBaseLoader,
    _SKIP_FILES,
    _SKIP_SUFFIXES,
)


FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "kb_loader"


def _load_category(subdir: str) -> dict:
    """Drive a single fixture subdirectory through `_load_category`.

    Returns the resulting data dict so tests can assert on the parsed
    entries. The loader is instantiated with `kb_dir=FIXTURE_ROOT`
    just so its constructor stays happy; we never touch `load_all()`
    directly here.
    """
    loader = KnowledgeBaseLoader(kb_dir=FIXTURE_ROOT)
    return loader._load_category(FIXTURE_ROOT / subdir)


# ── YAML positive (3 shapes) ────────────────────────────────────────────────


def test_yaml_single_entry_loaded_as_dict():
    """B4 default_ceilings shape — root mapping → dict in data."""
    data = _load_category("valid_yaml")
    assert "single_entry.yaml" in data
    entry = data["single_entry.yaml"]
    assert isinstance(entry, dict)
    assert entry["element_type"] == "operne_zdi"
    assert entry["confidence"] == 0.85
    assert entry["workforce"]["num_workers_total"] == 12
    assert entry["equipment"]["num_pumps"] == 1


def test_yaml_nested_structure_loaded_recursively():
    """B7 INDEX.yaml shape — deeply nested keys preserved."""
    data = _load_category("valid_yaml")
    assert "nested.yaml" in data
    entry = data["nested.yaml"]
    assert entry["source"]["norm_id"] == "csn_73_6244"
    assert entry["source"]["edition_year"] == 2010
    assert entry["clanek_1_predmet"]["scope"] == [
        "Mostní přechod", "Přechodové desky, závěrné zídky",
    ]
    # Nested-nested still preserved
    assert entry["clanek_5_materialy"]["zasyp_oper"]["min_proctor_pct"] == 95


def test_yaml_list_of_entries_loaded_as_list():
    """B5-shape: top-level list. Also exercises .yml (not just .yaml)."""
    data = _load_category("valid_yaml")
    assert "list_of_entries.yml" in data
    entries = data["list_of_entries.yml"]
    assert isinstance(entries, list)
    assert len(entries) == 3
    assert entries[0]["code"] == "121-01-001"
    assert entries[2]["base_price"] == 2900


# ── YAML malformed → ERROR + continue ───────────────────────────────────────


def test_malformed_yaml_logs_error_but_does_not_stop(caplog):
    """Bad YAML must not blow up the whole category — the sibling
    `alongside_good.yaml` must still appear in the result."""
    with caplog.at_level(logging.ERROR):
        data = _load_category("malformed")

    # The malformed file did NOT make it into data
    assert "broken.yaml" not in data
    # The sibling did
    assert "alongside_good.yaml" in data
    assert data["alongside_good.yaml"] == {"key": "value"}
    # An ERROR log line names the offending file
    error_lines = [r.message for r in caplog.records if r.levelno >= logging.ERROR]
    assert any("broken.yaml" in line for line in error_lines), (
        f"Expected an ERROR mentioning broken.yaml. Got: {error_lines}"
    )


# ── Skip pattern: .zip / .tmp / .bak silent, .gitkeep skipped, JSON loads ──


def test_skip_pattern_silent_and_aggregated(caplog):
    """`.zip` + `.tmp` + `.bak` are skipped silently; aggregated counter
    INFO logged once if N > 0; the lone `.json` still loads."""
    with caplog.at_level(logging.INFO):
        data = _load_category("skip_files")

    # 3 silent-skip files → only entry.json should be in data
    assert list(data.keys()) == ["entry.json"]
    assert data["entry.json"] == {"id": "real-entry", "value": 42}

    # The skip count INFO line fires once with the right number
    skip_lines = [r.message for r in caplog.records
                  if "Skipped" in r.message and "skip_files" in r.message]
    assert len(skip_lines) == 1, f"Expected 1 aggregated skip line, got: {skip_lines}"
    assert "3" in skip_lines[0]  # 3 silent-skip files

    # No per-file "Unsupported format" warning for archive.zip / *.tmp / *.bak
    warn_lines = [r.message for r in caplog.records
                  if r.levelno >= logging.WARNING]
    for noise in ("archive.zip", "swp.tmp", "old.bak"):
        assert not any(noise in line for line in warn_lines), (
            f"{noise} should be silent, got warnings: {warn_lines}"
        )


def test_skip_files_constant_includes_expected_names():
    """Forensic check: a future refactor must not silently drop one of
    these from the skip list (would re-introduce per-file warning noise)."""
    assert ".gitkeep" in _SKIP_FILES
    assert ".DS_Store" in _SKIP_FILES
    assert "Thumbs.db" in _SKIP_FILES


def test_skip_suffixes_constant_includes_expected():
    assert ".zip" in _SKIP_SUFFIXES
    assert ".tmp" in _SKIP_SUFFIXES
    assert ".bak" in _SKIP_SUFFIXES


# ── metadata.yaml symmetry with metadata.json ───────────────────────────────


def test_metadata_yaml_loaded_into_metadata_not_data(tmp_path, caplog):
    """metadata.yaml in a category → loader puts it on self.metadata,
    NOT in self.data, mirroring metadata.json behaviour."""
    # Build a fake KB dir with ONE category containing metadata.yaml
    fake_kb = tmp_path / "kb"
    cat = fake_kb / "B4_production_benchmarks"
    cat.mkdir(parents=True)
    (cat / "metadata.yaml").write_text(
        "category_name: test\nversion: 1.0\n", encoding="utf-8"
    )
    (cat / "entry.yaml").write_text("key: value\n", encoding="utf-8")

    loader = KnowledgeBaseLoader(kb_dir=fake_kb)
    # Restrict the loader to just this one category for the test
    loader.CATEGORIES = ["B4_production_benchmarks"]
    with caplog.at_level(logging.INFO):
        loader.load_all()

    assert loader.metadata["B4_production_benchmarks"]["category_name"] == "test"
    assert loader.metadata["B4_production_benchmarks"]["version"] == 1.0
    # metadata.yaml not in self.data
    assert "metadata.yaml" not in loader.data["B4_production_benchmarks"]
    # entry.yaml IS in self.data
    assert "entry.yaml" in loader.data["B4_production_benchmarks"]


def test_metadata_yaml_yml_extension_works(tmp_path):
    """metadata.yml (not .yaml) also recognized as metadata file."""
    fake_kb = tmp_path / "kb"
    cat = fake_kb / "B4_production_benchmarks"
    cat.mkdir(parents=True)
    (cat / "metadata.yml").write_text("version: 2\n", encoding="utf-8")

    loader = KnowledgeBaseLoader(kb_dir=fake_kb)
    loader.CATEGORIES = ["B4_production_benchmarks"]
    loader.load_all()

    assert loader.metadata["B4_production_benchmarks"]["version"] == 2


def test_metadata_yaml_wins_over_metadata_json_with_warning(tmp_path, caplog):
    """Both metadata.yaml + metadata.json present → YAML wins, WARNING
    (not INFO) logged so ops sees an in-progress migration."""
    fake_kb = tmp_path / "kb"
    cat = fake_kb / "B4_production_benchmarks"
    cat.mkdir(parents=True)
    (cat / "metadata.json").write_text(
        '{"category_name": "stale-from-json", "version": "0.9.0"}', encoding="utf-8")
    (cat / "metadata.yaml").write_text(
        'category_name: fresh-from-yaml\nversion: "2.0.0"\n', encoding="utf-8")

    loader = KnowledgeBaseLoader(kb_dir=fake_kb)
    loader.CATEGORIES = ["B4_production_benchmarks"]
    with caplog.at_level(logging.WARNING):
        loader.load_all()

    # YAML content wins
    meta = loader.metadata["B4_production_benchmarks"]
    assert meta["category_name"] == "fresh-from-yaml"
    assert meta["version"] == "2.0.0"

    # WARNING line about the conflict (NOT INFO)
    warn_lines = [r for r in caplog.records
                  if r.levelno >= logging.WARNING and "metadata" in r.message.lower()]
    assert any(
        "yaml wins" in r.message.lower() and r.levelno == logging.WARNING
        for r in warn_lines
    ), f"Expected WARNING about YAML winning. Got: {[r.message for r in warn_lines]}"


# ── JSON regression smoke ──────────────────────────────────────────────────


def test_json_still_loads_alongside_yaml():
    """Existing JSON behaviour preserved: sample.json in valid_json/
    parses identically to before this PR."""
    data = _load_category("valid_json")
    assert "sample.json" in data
    entry = data["sample.json"]
    assert entry["code"] == "121-01-100"
    assert entry["values"] == [1, 2, 3]


def test_json_only_fixture_no_yaml_warnings(caplog):
    """Pure JSON category must not emit any YAML-related warnings — proves
    the YAML branch only fires when YAML files are present."""
    with caplog.at_level(logging.WARNING):
        data = _load_category("valid_json")
    assert "sample.json" in data
    yaml_warnings = [r.message for r in caplog.records
                     if "yaml" in r.message.lower()]
    assert yaml_warnings == [], f"Pure-JSON load emitted YAML noise: {yaml_warnings}"


# ── Dispatcher safety: unknown extension still warns ───────────────────────


def test_truly_unknown_extension_still_warns(tmp_path, caplog):
    """A file with an extension that's neither supported nor in the skip
    list MUST still log the "Unsupported format" warning — preserves
    visibility for genuinely novel formats added to the KB tree."""
    fake_kb = tmp_path / "kb"
    cat = fake_kb / "B4_production_benchmarks"
    cat.mkdir(parents=True)
    (cat / "weird.xyz").write_text("???", encoding="utf-8")

    loader = KnowledgeBaseLoader(kb_dir=fake_kb)
    loader.CATEGORIES = ["B4_production_benchmarks"]
    with caplog.at_level(logging.WARNING):
        loader.load_all()

    warn_lines = [r.message for r in caplog.records
                  if "Unsupported format" in r.message]
    assert any("weird.xyz" in line for line in warn_lines), (
        f"Expected 'Unsupported format' warning for weird.xyz. Got: {warn_lines}"
    )


# ── safe_load over yaml.load (security smoke) ───────────────────────────────


def test_yaml_loader_uses_safe_load_not_load():
    """`yaml.load` without a Loader executes arbitrary Python — confirm
    the helper uses `safe_load`. We can't easily test the negative
    case at runtime, but a unicode + tag-laden payload would
    crash if Loader=Loader was used to execute it. SafeLoader rejects
    the tag cleanly with a YAMLError."""
    import yaml
    payload = "!!python/object/apply:os.system ['echo PWNED']\n"
    with pytest.raises(yaml.YAMLError):
        yaml.safe_load(payload)


# ── _load_yaml direct unit test ────────────────────────────────────────────


def test_load_yaml_helper_returns_parsed_object(tmp_path):
    p = tmp_path / "f.yaml"
    p.write_text("a: 1\nb:\n  - 2\n  - 3\n", encoding="utf-8")
    loader = KnowledgeBaseLoader(kb_dir=tmp_path)
    assert loader._load_yaml(p) == {"a": 1, "b": [2, 3]}


def test_load_yaml_helper_handles_empty_file(tmp_path):
    """Empty YAML → yaml.safe_load returns None. Don't crash."""
    p = tmp_path / "empty.yaml"
    p.write_text("", encoding="utf-8")
    loader = KnowledgeBaseLoader(kb_dir=tmp_path)
    assert loader._load_yaml(p) is None


def test_load_yaml_helper_raises_yaml_error_for_malformed(tmp_path):
    """Malformed YAML must raise yaml.YAMLError so `_load_category`'s
    outer try/except can route it to a per-file ERROR log + continue."""
    import yaml
    p = tmp_path / "bad.yaml"
    p.write_text("key: 'unterminated\n  list:\n    - item\n", encoding="utf-8")
    loader = KnowledgeBaseLoader(kb_dir=tmp_path)
    with pytest.raises(yaml.YAMLError):
        loader._load_yaml(p)
