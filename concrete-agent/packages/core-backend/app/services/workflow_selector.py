"""Workflow selection utilities."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal, Tuple

logger = logging.getLogger(__name__)

Workflow = Literal["A", "B"]
SelectStatus = Literal["OK", "WARNING", "ERROR"]

WORKLIST_EXTS = {".xlsx", ".xls", ".csv", ".xml"}
DRAWING_EXTS = {".pdf", ".dwg", ".dxf", ".png", ".jpg", ".jpeg", ".txt"}


def has_worklist(files: list[Path]) -> bool:
    """Return True if any *files* look like a bill of quantities."""

    return any(path.suffix.lower() in WORKLIST_EXTS for path in files)


def select(
    workflow_param: str | None,
    enable_a: bool,
    enable_b: bool,
    saved_files: list[Path],
) -> Tuple[Workflow, SelectStatus]:
    """Select workflow with guaranteed outcome.

    The function never raises; instead it returns a workflow identifier and a
    status string indicating whether the selection required fallbacks.
    """

    if not enable_a and not enable_b:
        logger.error("Both workflows disabled – falling back to A with error state")
        return "A", "ERROR"

    if workflow_param == "A":
        if enable_a:
            logger.info("Workflow A explicitly selected and enabled")
            return "A", "OK"
        logger.warning("Workflow A explicitly requested but disabled, switching to B")
        return "B", "WARNING"

    if workflow_param == "B":
        if enable_b:
            logger.info("Workflow B explicitly selected and enabled")
            return "B", "OK"
        logger.warning("Workflow B explicitly requested but disabled, switching to A")
        return "A", "WARNING"

    if has_worklist(saved_files) and enable_a:
        logger.info("Auto selection: worklist detected – choosing Workflow A")
        return "A", "OK"

    if enable_b:
        logger.info("Auto selection: defaulting to Workflow B")
        return "B", "OK"

    logger.warning("Auto selection: Workflow B disabled, using Workflow A")
    return "A", "WARNING"
