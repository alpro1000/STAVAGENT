"""
MCP Tool: build_bridge_passport — half-B Gate 5 (ADR-008).

Turns raw per-SO DOCUMENTS into a tz-bridge-passport JSON that the sibling
tool `calculate_from_passport` (half-A) consumes — closing the pipeline
TZ + soupis (+ drawing note) → passport → whole-SO plan:

    stage 1  TZ text        → extract_tz_fields (deterministic, LLM fallback
                              gated per ADR-008 — single section only)
    stage 3  soupis         → parse_construction_budget → soupis join
    stage 2  drawing note   → host vision reads the note; the note VERDICT
                              comes from validate_drawing_element (notes mode)
                              and only a VERIFIED fragment is written here

This tool does NO extraction logic of its own — it composes the assembler
(`app/services/bridge_passport_assembler.py`, the single emit point) with the
LIVE deterministic classifier injected, and optionally persists the result to
the bridge-passport store. Errors are typed, strictly JSON-serializable dicts
(the transport rule — bug passport-mcp-error-transport), never a fabricated
passport.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def build_bridge_passport(
    tz_text: Optional[str] = None,
    tz_file_base64: Optional[str] = None,
    tz_filename: str = "",
    soupis_file_base64: Optional[str] = None,
    soupis_filename: str = "",
    construction_process: Optional[dict] = None,
    passport_id: Optional[str] = None,
) -> dict:
    """Assemble a per-SO bridge passport from documents (half-B of tz-passport).

    Feed the output to `calculate_from_passport` for the whole-SO plan. The
    passport carries `_meta.gaps` — an honest list of everything the sources
    did NOT provide (per-deck geometry, heights, the construction trio unless
    you pass a VERIFIED one) — fill those from drawings and re-build, or let
    half-A mark the affected elements NEPOČÍTÁNO.

    Args:
        tz_text: TZ text (page-marked like analyze_construction_document), OR
        tz_file_base64: TZ PDF as base64 (pdfplumber extraction runs here).
        tz_filename: original TZ filename (diagnostics only).
        soupis_file_base64: soupis XLSX/XML as base64 (optional — without it
            every element emits without quantities, honestly marked).
        soupis_filename: original soupis filename (format detection).
        construction_process: OPTIONAL verified trio fragment
            ({deck_pour_stages, deck_pour_stages_source, falsework_technology})
            — pass EXACTLY what a VERIFIED `validate_drawing_element` notes-mode
            call returned. An unverified/hand-typed trio defeats the P40 gate;
            the field is copied verbatim into the passport with its source.
        passport_id: when set, the passport is persisted to the bridge-passport
            store under this id (path-safe charset) and survives cold starts.

    Returns:
        {"passport": {...}, "gaps": [...], "stored": bool} on success;
        typed errors otherwise: {"error": "tz_extraction_failed" |
        "soupis_parse_failed" | "assembly_invalid", "message": ...}.
    """
    try:
        # ── stage 1: TZ text ────────────────────────────────────────────────
        from app.mcp.tools.extract_tz_fields import extract_tz_fields

        tz_fields = await extract_tz_fields(
            text=tz_text, file_base64=tz_file_base64, filename=tz_filename,
        )
        if tz_fields.get("error"):
            return {"error": "tz_extraction_failed",
                    "message": str(tz_fields["error"])}

        # ── stage 3: soupis (optional) ──────────────────────────────────────
        parsed_budget: Optional[dict] = None
        if soupis_file_base64:
            from app.mcp.tools.budget import parse_construction_budget

            parsed_budget = await parse_construction_budget(
                file_base64=soupis_file_base64, filename=soupis_filename,
            )
            if parsed_budget.get("error"):
                # A PROVIDED soupis that fails to parse is an input error —
                # never silently assembled without quantities.
                return {"error": "soupis_parse_failed",
                        "message": str(parsed_budget["error"])}

        # ── assemble (single emit point) with the LIVE classifier ──────────
        from app.mcp.tools.classifier import _classify
        from app.services.bridge_passport_assembler import assemble_bridge_passport

        try:
            passport = assemble_bridge_passport(
                tz_fields, parsed_budget, classify=_classify,
            )
        except Exception as exc:  # pydantic ValidationError et al — typed, JSON-safe
            logger.error("[MCP/BuildPassport] assembly invalid: %s", exc)
            return {"error": "assembly_invalid", "message": str(exc)}

        # ── stage 2 fragment: verbatim copy of a VERIFIED notes-gate result ─
        if construction_process:
            passport["construction_process"] = dict(construction_process)
            passport["_meta"]["gaps"] = [
                g for g in passport["_meta"].get("gaps", [])
                if not g.startswith("construction_process")
            ]

        stored = False
        if passport_id:
            from app.services import bridge_passport_store

            bridge_passport_store.save(passport_id, passport)
            stored = True

        return {
            "passport": passport,
            "gaps": list(passport["_meta"].get("gaps", [])),
            "stored": stored,
        }

    except Exception as e:  # noqa: BLE001 — surface, never a silent fabrication
        logger.error(f"[MCP/BuildPassport] Error: {e}")
        return {"error": "build_failed", "message": str(e)}

