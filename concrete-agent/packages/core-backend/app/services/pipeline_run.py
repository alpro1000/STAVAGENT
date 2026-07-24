"""
Deterministic run manifest for the document→soupis pipeline.

The audit finding this closes: individual MCP tools were reproducible, but a
whole *run* was not addressable — no run id, no record of which stages fired
in what order, no way to prove that re-running the same inputs reproduced the
same numbers. Composition order was whatever the calling agent chose.

This module is the run-level spine:

  * ``run_id`` is **content-addressed** — sha256 over the canonicalised inputs
    plus the pipeline version and the catalog version. Same inputs + same
    engine ⇒ same id, on any host, in any process. Different catalog vintage
    ⇒ different id, because the numbers legitimately differ.
  * every stage records the sha256 of what went in and what came out, so a
    replay can be diffed stage-by-stage instead of eyeballing a blob.
  * a skipped or failed stage is recorded as such — never dropped, so the
    manifest can't imply coverage the run didn't have.

Hermetic by construction: no I/O, no clock, no randomness. ``Date.now()``-style
inputs would make the id meaningless, so the caller passes any timestamp in as
data if it genuinely belongs to the inputs.

Reference: docs/audits/orchestrator_readiness/2026-07-19_orchestrator_readiness.md
(§3.2 "no run-level object", §3.7 "no result-id / replay").
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Optional

# Bumped when the pipeline's stage graph or a stage's contract changes in a way
# that can move numbers. It is part of the run_id, so a pipeline change yields a
# new id rather than silently reusing an old one for different behaviour.
PIPELINE_VERSION = 1

# Stage lifecycle. A stage is ALWAYS one of these in the manifest — there is no
# "absent" state, because absence is what hides missing coverage.
STATUS_OK = "ok"
STATUS_SKIPPED = "skipped"
STATUS_FAILED = "failed"


def canonical_json(obj: Any) -> str:
    """Stable JSON: sorted keys, no incidental whitespace, unicode preserved.

    Sorting is what makes the hash independent of dict insertion order — the
    exact drift that would otherwise make two identical runs hash differently.
    """
    return json.dumps(
        obj,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    )


def content_hash(obj: Any) -> str:
    """sha256 of the canonical JSON form of ``obj``."""
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


@dataclass
class StageRecord:
    """One executed (or deliberately skipped) pipeline stage."""

    name: str
    tool: str
    status: str
    input_sha256: Optional[str] = None
    output_sha256: Optional[str] = None
    # Honest reason for skipped/failed. Never a fabricated success.
    reason: Optional[str] = None

    def to_dict(self) -> dict:
        out = {
            "name": self.name,
            "tool": self.tool,
            "status": self.status,
            "input_sha256": self.input_sha256,
            "output_sha256": self.output_sha256,
        }
        if self.reason is not None:
            out["reason"] = self.reason
        return out


@dataclass
class RunManifest:
    """Content-addressed record of one pipeline run.

    ``run_id`` is derived at construction from the inputs; stages are appended
    as they execute. The id therefore identifies the *request*, and the stage
    hashes identify what the engine actually produced for it — a replay that
    yields the same run_id but different stage hashes is a genuine regression,
    and that is exactly the signal this manifest exists to give.
    """

    run_id: str
    inputs_sha256: str
    pipeline_version: int
    catalog_version: Optional[str]
    stages: list[StageRecord] = field(default_factory=list)

    def record(
        self,
        *,
        name: str,
        tool: str,
        status: str,
        input_obj: Any = None,
        output_obj: Any = None,
        reason: Optional[str] = None,
    ) -> StageRecord:
        rec = StageRecord(
            name=name,
            tool=tool,
            status=status,
            input_sha256=content_hash(input_obj) if input_obj is not None else None,
            output_sha256=content_hash(output_obj) if output_obj is not None else None,
            reason=reason,
        )
        self.stages.append(rec)
        return rec

    @property
    def stages_sha256(self) -> str:
        """Fingerprint of the whole executed chain — the replay comparand.

        Two runs of the same inputs must produce the same value; if they don't,
        some stage is non-deterministic (LLM fallback, wall clock, dict order).
        """
        return content_hash([s.to_dict() for s in self.stages])

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "inputs_sha256": self.inputs_sha256,
            "pipeline_version": self.pipeline_version,
            "catalog_version": self.catalog_version,
            "stages": [s.to_dict() for s in self.stages],
            "stages_sha256": self.stages_sha256,
        }


def start_run(inputs: dict, *, catalog_version: Optional[str] = None) -> RunManifest:
    """Open a manifest whose ``run_id`` is determined solely by its inputs.

    The id binds three things that can each change the numbers:
    the request itself, the pipeline version, and the catalog vintage.
    """
    inputs_sha = content_hash(inputs)
    seed = {
        "inputs_sha256": inputs_sha,
        "pipeline_version": PIPELINE_VERSION,
        "catalog_version": catalog_version,
    }
    return RunManifest(
        run_id=f"run-{content_hash(seed)[:32]}",
        inputs_sha256=inputs_sha,
        pipeline_version=PIPELINE_VERSION,
        catalog_version=catalog_version,
    )
