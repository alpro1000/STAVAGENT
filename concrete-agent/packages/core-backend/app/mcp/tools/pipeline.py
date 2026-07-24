"""
MCP Tool: run_document_to_soupis — the document→soupis pipeline as ONE call.

Before this, the headline flow existed only as loose primitives: a caller had
to invoke `build_bridge_passport`, then `calculate_from_passport`, then
`create_work_breakdown`, then `export_soupis`, hand-threading dicts between
them and choosing the order itself. Four separately-billed calls, no run
object, no result id, and the composition order decided per-conversation by
whichever agent happened to be driving.

This tool runs the chain in a FIXED, deterministic order and returns a
content-addressed `run_id` plus a per-stage manifest (see
`app.services.pipeline_run`). Same inputs + same engine + same catalog ⇒ same
`run_id` and the same `stages_sha256`, which is what makes a run replayable
and a regression visible.

Stage graph (order is code, not prompt):

    1. structure  build_bridge_passport      documents → per-SO passport
    2. plan       calculate_from_passport    passport  → whole-SO plan (SSOT engine)
    3. decompose  create_work_breakdown      elements  → work items (Pattern 15:
                                             work-first, catalog binding is a
                                             separate gated stage)
    4. export     export_soupis              items     → KROS soupis XLSX

Stages 3–4 are opt-in. Every stage lands in the manifest with `ok` / `skipped`
/ `failed` and an honest reason — a stage that did not run is never silently
absent, because absence is exactly what would let a partial run read as a
complete one.

Failure policy mirrors the delegation seam: a failed stage stops the chain and
is reported verbatim. The tool NEVER substitutes a computed-looking number for
a stage that did not succeed.

Test seams are module-level globals (`_BUILD_PASSPORT`, `_CALCULATE`,
`_BREAKDOWN`, `_EXPORT`) rather than parameters — a `Callable` in a tool's
public signature breaks FastMCP's JSON-schema build.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.mcp.tools.breakdown import create_work_breakdown
from app.mcp.tools.export import export_soupis
from app.mcp.tools.passport_build import build_bridge_passport
from app.mcp.tools.passport_plan import calculate_from_passport
from app.services.pipeline_run import (
    STATUS_FAILED,
    STATUS_OK,
    STATUS_SKIPPED,
    start_run,
)

logger = logging.getLogger(__name__)

# ── Test seams (monkeypatched in tests; never function parameters) ───────────
_BUILD_PASSPORT = build_bridge_passport
_CALCULATE = calculate_from_passport
_BREAKDOWN = create_work_breakdown
_EXPORT = export_soupis


def _catalog_version() -> Optional[str]:
    """Catalog vintage that the run's numbers are bound to.

    Part of the run_id: the same TZ priced against a different catalog is a
    different result and must not collide on id.
    """
    try:
        from app.core.config import settings

        return settings.OTSKP_CATALOG_VERSION
    except Exception:  # pragma: no cover - config import is defensive
        return None


def _is_error(result) -> bool:
    """MCP tools signal failure as `{"error": <kind>, ...}`."""
    return isinstance(result, dict) and bool(result.get("error"))


def _elements_from_plan(plan: dict) -> list[dict]:
    """Canonical element list for decomposition = the engine mapper's output.

    `calculate_from_passport` returns `{mapping: {elements: [...]}, project}`;
    `mapping.elements` is what the SSOT engine actually planned, so the work
    breakdown is decomposed from the SAME elements that were costed — not from
    a second, independently-derived list that could drift from the plan.
    """
    if not isinstance(plan, dict):
        return []
    mapping = plan.get("mapping")
    if not isinstance(mapping, dict):
        return []
    elements = mapping.get("elements")
    return elements if isinstance(elements, list) else []


async def run_document_to_soupis(
    tz_text: Optional[str] = None,
    tz_file_base64: Optional[str] = None,
    tz_filename: str = "",
    soupis_file_base64: Optional[str] = None,
    soupis_filename: str = "",
    soupis_ref: Optional[str] = None,
    construction_process: Optional[dict] = None,
    project_type: str = "most",
    catalog: str = "otskp",
    with_breakdown: bool = True,
    with_export: bool = False,
    project_id: Optional[str] = None,
) -> dict:
    """Run the whole document→soupis pipeline in one deterministic pass.

    Turns project documents (TZ + optional soupis) into a per-SO passport, a
    costed whole-SO plan, and — optionally — a work breakdown and a KROS soupis
    XLSX, in a fixed stage order with a replayable run manifest.

    Args:
        tz_text: TZ text (page-marked), OR
        tz_file_base64: TZ PDF as base64 (extraction runs server-side).
        tz_filename: real TZ filename — drives SO-code detection.
        soupis_file_base64: soupis XLSX/XML as base64 — ONLY for small files.
        soupis_filename: original soupis filename (format detection).
        soupis_ref: owner-scoped handle from POST /api/v1/mcp/soupis/upload —
            the way to feed a real multi-MB soupis. Wins over the base64 form.
        construction_process: optional VERIFIED construction trio (deck pour
            stages + falsework technology) from `validate_drawing_element`.
        project_type: object family for the work breakdown (default 'most').
        catalog: catalog for the binding stage ('otskp' | 'urs').
        with_breakdown: run stage 3 (work breakdown). Default True.
        with_export: run stage 4 (render the soupis XLSX). Default False —
            the XLSX is a base64 payload, so it is opt-in.
        project_id: optional project id threaded to breakdown/export.

    Returns:
        `{run_id, manifest, passport, plan, breakdown?, soupis?}` on success, or
        `{error, stage, run_id, manifest, ...}` when a stage fails — the
        manifest always shows how far the run got.
    """
    # The run identity is the REQUEST, canonicalised. Binary payloads are
    # hashed by content via the manifest's canonical JSON, so two identical
    # uploads yield one id.
    inputs = {
        "tz_text": tz_text,
        "tz_file_base64": tz_file_base64,
        "tz_filename": tz_filename,
        "soupis_file_base64": soupis_file_base64,
        "soupis_filename": soupis_filename,
        "soupis_ref": soupis_ref,
        "construction_process": construction_process,
        "project_type": project_type,
        "catalog": catalog,
        "with_breakdown": with_breakdown,
        "with_export": with_export,
        "project_id": project_id,
    }
    run = start_run(inputs, catalog_version=_catalog_version())

    def _fail(stage: str, result) -> dict:
        """Stop the chain, report the failing stage verbatim."""
        return {
            "error": (result or {}).get("error", "stage_failed"),
            "stage": stage,
            "detail": result,
            "run_id": run.run_id,
            "manifest": run.to_dict(),
        }

    # ── Stage 1: structure — documents → passport ────────────────────────────
    passport_args = {
        "tz_text": tz_text,
        "tz_file_base64": tz_file_base64,
        "tz_filename": tz_filename,
        "soupis_file_base64": soupis_file_base64,
        "soupis_filename": soupis_filename,
        "soupis_ref": soupis_ref,
        "construction_process": construction_process,
    }
    passport = await _BUILD_PASSPORT(**passport_args)
    if _is_error(passport):
        run.record(
            name="structure",
            tool="build_bridge_passport",
            status=STATUS_FAILED,
            input_obj=passport_args,
            reason=str(passport.get("error")),
        )
        return _fail("structure", passport)
    run.record(
        name="structure",
        tool="build_bridge_passport",
        status=STATUS_OK,
        input_obj=passport_args,
        output_obj=passport,
    )

    # The passport tool wraps its emit; the plan stage needs the passport body.
    passport_body = passport.get("passport") if isinstance(passport, dict) else None
    if not isinstance(passport_body, dict):
        passport_body = passport

    # ── Stage 2: plan — passport → whole-SO plan (canonical TS engine) ───────
    plan = await _CALCULATE(passport_body)
    if _is_error(plan):
        run.record(
            name="plan",
            tool="calculate_from_passport",
            status=STATUS_FAILED,
            input_obj=passport_body,
            reason=str(plan.get("error")),
        )
        return _fail("plan", plan)
    run.record(
        name="plan",
        tool="calculate_from_passport",
        status=STATUS_OK,
        input_obj=passport_body,
        output_obj=plan,
    )

    out: dict = {
        "run_id": run.run_id,
        "passport": passport,
        "plan": plan,
    }

    # ── Stage 3: decompose — elements → work items (work-first) ─────────────
    elements = _elements_from_plan(plan)
    breakdown = None
    if not with_breakdown:
        run.record(
            name="decompose",
            tool="create_work_breakdown",
            status=STATUS_SKIPPED,
            reason="with_breakdown=False",
        )
    elif not elements:
        # Honest skip: the plan produced no elements to decompose. Emitting an
        # empty breakdown would read as "nothing to build" rather than "nothing
        # was mapped".
        run.record(
            name="decompose",
            tool="create_work_breakdown",
            status=STATUS_SKIPPED,
            reason="plan produced no mapped elements",
        )
    else:
        breakdown_args = {
            "elements": elements,
            "project_type": project_type,
            "catalog": catalog,
            "project_id": project_id,
        }
        breakdown = await _BREAKDOWN(**breakdown_args)
        if _is_error(breakdown):
            run.record(
                name="decompose",
                tool="create_work_breakdown",
                status=STATUS_FAILED,
                input_obj=breakdown_args,
                reason=str(breakdown.get("error")),
            )
            return _fail("decompose", breakdown)
        run.record(
            name="decompose",
            tool="create_work_breakdown",
            status=STATUS_OK,
            input_obj=breakdown_args,
            output_obj=breakdown,
        )
        out["breakdown"] = breakdown

    # ── Stage 4: export — work items → KROS soupis XLSX ─────────────────────
    items = breakdown.get("items") if isinstance(breakdown, dict) else None
    if not with_export:
        run.record(
            name="export",
            tool="export_soupis",
            status=STATUS_SKIPPED,
            reason="with_export=False",
        )
    elif not items:
        run.record(
            name="export",
            tool="export_soupis",
            status=STATUS_SKIPPED,
            reason="no work items to render",
        )
    else:
        export_args = {"items": items, "project_id": project_id}
        soupis = await _EXPORT(**export_args)
        if _is_error(soupis):
            run.record(
                name="export",
                tool="export_soupis",
                status=STATUS_FAILED,
                input_obj=export_args,
                reason=str(soupis.get("error")),
            )
            return _fail("export", soupis)
        run.record(
            name="export",
            tool="export_soupis",
            status=STATUS_OK,
            input_obj=export_args,
            output_obj=soupis,
        )
        out["soupis"] = soupis

    out["manifest"] = run.to_dict()
    return out
