"""Load + validate VYJASNĚNÍ queue references for hk212 Phase 1.

Single source of truth: ``outputs/phase_0b_rerun/vyjasneni_queue_updated.json``
(20 ABMV_NN items, all using canonical ``ABMV_<N>`` ID format).

Task spec §4 references items as ``#17`` shorthand — we normalize all such
references to ``ABMV_17`` to match the existing data.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
QUEUE_PATH = REPO_ROOT / "test-data" / "hk212_hala" / "outputs" / "phase_0b_rerun" / "vyjasneni_queue_updated.json"


_SHORTHAND_RE = re.compile(r"^#(\d{1,3})$")


def normalize_ref(ref: str) -> str:
    """Map ``#17`` → ``ABMV_17``. Pass through already-canonical IDs."""
    m = _SHORTHAND_RE.match(ref.strip())
    if m:
        return f"ABMV_{int(m.group(1))}"
    return ref.strip()


class VyjasneniQueue:
    """In-memory queue with canonical ID lookup."""

    def __init__(self, queue_data: dict) -> None:
        self.queue = queue_data
        self.items_by_id: dict[str, dict] = {}
        for item in queue_data.get("items", []):
            iid = item.get("id")
            if iid:
                self.items_by_id[iid] = item

    @classmethod
    def load(cls, path: Path | None = None) -> "VyjasneniQueue":
        p = path or QUEUE_PATH
        if not p.exists():
            raise FileNotFoundError(f"Vyjasneni queue not found: {p}")
        return cls(json.loads(p.read_text(encoding="utf-8")))

    def validate_refs(self, refs: list[str]) -> tuple[list[str], list[str]]:
        """Normalize + validate a list of references.

        Returns ``(normalized_refs, unknown_refs)``.
        """
        norm: list[str] = []
        unknown: list[str] = []
        for r in refs:
            n = normalize_ref(r)
            norm.append(n)
            if n not in self.items_by_id:
                unknown.append(n)
        return norm, unknown

    def all_ids(self) -> list[str]:
        return list(self.items_by_id.keys())

    def severity(self, ref: str) -> str:
        return self.items_by_id.get(normalize_ref(ref), {}).get("severity", "unknown")
