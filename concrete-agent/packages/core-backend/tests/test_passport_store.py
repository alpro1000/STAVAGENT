"""Passport store — disk persistence survives process recycles (Sprint B).

The old module-level dict in routes_passport.py lost every passport on Cloud
Run cold start (min-instances=0). These tests prove the store's contract:
write-through to disk, rehydrate after a simulated restart, safe ids only.
"""
import pytest

from app.models.passport_schema import ProjectPassport
from app.services import passport_store


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    """Point the store at a temp dir and start with empty memory."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "PROJECT_DIR", tmp_path, raising=False)
    passport_store._memory.clear()
    yield
    passport_store._memory.clear()


def _make(pid: str = "passport_test1") -> ProjectPassport:
    return ProjectPassport(passport_id=pid, project_name="Test projekt")


def test_save_writes_durable_file(tmp_path):
    passport_store.save(_make())
    stored = tmp_path / "passports" / "passport_test1.json"
    assert stored.exists()
    assert "Test projekt" in stored.read_text(encoding="utf-8")


def test_get_rehydrates_after_cold_start():
    passport_store.save(_make())
    # Simulate cold start: process memory gone, disk survives.
    passport_store._memory.clear()
    loaded = passport_store.get("passport_test1")
    assert loaded is not None
    assert loaded.project_name == "Test projekt"


def test_list_all_sees_disk_after_cold_start():
    passport_store.save(_make("passport_a"))
    passport_store.save(_make("passport_b"))
    passport_store._memory.clear()
    ids = {p.passport_id for p in passport_store.list_all()}
    assert ids == {"passport_a", "passport_b"}
    assert passport_store.count() == 2


def test_delete_removes_memory_and_disk(tmp_path):
    passport_store.save(_make())
    assert passport_store.delete("passport_test1") is True
    assert not (tmp_path / "passports" / "passport_test1.json").exists()
    assert passport_store.get("passport_test1") is None
    # Second delete: nothing left
    assert passport_store.delete("passport_test1") is False


def test_unsafe_id_never_touches_filesystem(tmp_path):
    evil = _make("../../etc/passwd")
    passport_store.save(evil)  # memory-only, logged
    assert not (tmp_path.parent / "etc").exists()
    # Reachable in-process (memory), invisible via path lookup after restart
    assert passport_store.get("../../etc/passwd") is not None
    passport_store._memory.clear()
    assert passport_store.get("../../etc/passwd") is None


def test_get_unknown_returns_none():
    assert passport_store.get("passport_missing") is None
