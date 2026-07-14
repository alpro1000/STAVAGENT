"""
MCP Tool: export_soupis

Promotes the soupis-prací deliverable (today assembled by a script outside MCP)
to a first-class MCP tool, so the orchestrator can emit the deliverable end-to-end
and the workflow's EXPORTED terminal state becomes reachable.

Deterministic render only — NO LLM. It wraps the SAME renderer used by the existing
REST /export-xlsx endpoint (app.utils.soupis_exporter.export_soupis_xlsx); the render
is NOT forked. Provenance (`_source` from the work-breakdown items) is preserved in
the RESPONSE METADATA (source_preserved + source_map), NOT injected into the
KROS-compatible soupis columns — the KROS sheet stays clean and the format intact.

Extensible: `deliverable` selects the artefact kind. This task ships only
'soupis_praci'; further deliverables (výměry, zařízení staveniště) slot in as new
deliverable kinds without rewriting the tool.
"""

import base64
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

DELIVERABLE_SOUPIS = "soupis_praci"


def _load_items_from_project(project_id: str) -> list:
    """Best-effort load of a stored work-breakdown for a project (no fabrication).

    Reads the project cache; returns [] when no breakdown is stored, so the caller
    gets a clear "no items" error rather than an invented soupis. Forward-compatible
    hook — the primary path is an explicit `items` list.
    """
    try:
        from app.services.project_cache import load_project_cache

        cache = load_project_cache(project_id) or {}
        return (
            cache.get("work_breakdown_items")
            or cache.get("breakdown_items")
            or []
        )
    except Exception as e:  # pragma: no cover - defensive, project cache optional
        logger.debug("[MCP/Export] project load skipped for %s: %s", project_id, e)
        return []


def _items_to_soupis_data(items: list, project_id: Optional[str]) -> dict:
    """Map work-breakdown items → the soupis_data shape export_soupis_xlsx expects.

    The grounding `_source` is intentionally NOT mapped into a position field — it
    must not land in the KROS 'Zdroj' column. Catalog codes are passed through only
    when already present on the item (work_with_catalog); never fabricated.
    """
    positions = []
    for idx, it in enumerate(items, 1):
        hsv = str(it.get("hsv_section") or "").upper()
        typ = "PSV" if hsv.startswith("PSV") else "HSV"
        # Visible Zdroj label, calc-status-aware (Q4): a row the engine did NOT
        # compute (honest-blank) gets an explicit "NEPOČÍTÁNO" marker so it is
        # visually distinct from a fully-processed row — a soupis must not read as
        # complete where lines were never calculated. Computed rows show the plain
        # classification source.
        _cls_src = it.get("classification_source") or "klasifikace"
        if it.get("calc_status") == "computed":
            zdroj_label = it.get("classification_source") or ""
        else:
            zdroj_label = f"{_cls_src} · NEPOČÍTÁNO"
        # Last mile of the quantity-honesty axis (review #1510 finding 10): the
        # whole `quantity_status` discipline exists for the human opening the
        # XLSX — an `assumed` that screams only in JSON screams to nobody. The
        # status rides the visible Zdroj label (incl. the NEPOČÍTÁNO(reason)
        # text verbatim) and the quantity_formula fills the EXISTING KROS
        # 'VV vzorec' column (the renderer already reads `vv_vzorec`).
        q_status = it.get("quantity_status")
        if q_status:
            zdroj_label = f"{zdroj_label} · množ. {q_status}" if zdroj_label else f"množ. {q_status}"
        positions.append(
            {
                "poradi": idx,
                "typ": typ,
                # No fabrication: only a code the item already carries.
                "kod": it.get("otskp_code") or it.get("kod") or "",
                "popis": it.get("work_description") or it.get("popis") or "",
                "mj": it.get("unit") or it.get("mj") or "",
                "mnozstvi": it.get("quantity", it.get("mnozstvi", "")),
                "vv_vzorec": it.get("quantity_formula") or None,
                "quantity_status": q_status,
                "section": hsv or None,
                # Fill the EXISTING visible KROS columns (renderer already declares
                # Zdroj + Důvěra and reads these keys): confidence ← classification
                # confidence (a real scalar); source ← calc-status-aware label so an
                # uncomputed (honest-blank) row is visually distinct (Q4). The richer
                # calc numbers stay in the response metadata, NOT in the KROS columns.
                # The raw `_source` work→template provenance is preserved separately
                # in source_map.
                "confidence": it.get("classification_confidence"),
                "source": zdroj_label,
                "calc_status": it.get("calc_status"),
            }
        )
    return {
        "positions": positions,
        "stats": {
            "total_positions": len(positions),
            "hsv_count": sum(1 for p in positions if p["typ"] == "HSV"),
            "psv_count": sum(1 for p in positions if p["typ"] == "PSV"),
        },
        "warnings": [],
        "attribution": (
            "Generováno systémem StavAgent (export_soupis)"
            + (f" · projekt {project_id}" if project_id else "")
        ),
    }


async def export_soupis(
    items: Optional[list] = None,
    project_id: Optional[str] = None,
    deliverable: str = DELIVERABLE_SOUPIS,
) -> dict:
    """Render a construction deliverable (first: soupis prací) to an Excel file.

    Deterministic, no LLM — identical input yields identical rows/values. Wraps the
    canonical KROS soupis renderer (the same one behind REST /export-xlsx). The
    `_source` of each input item is preserved in the response metadata
    (source_preserved + source_map), keeping the KROS soupis sheet clean.

    Args:
        items: Structured work items — typically the output of create_work_breakdown
            (and decomposition). Each item: work_description, unit, quantity,
            hsv_section, optional otskp_code/kod, and a `_source` for provenance.
        project_id: When `items` is omitted, load a stored breakdown for this
            project (returns a clear error if none is stored — never fabricates).
        deliverable: Artefact kind. Only 'soupis_praci' is supported in this task;
            others return a clear error (extension point for future deliverables).

    Returns a dict with: deliverable, file_base64 (xlsx), filename, row_count,
    source_preserved (bool), source_map ({row_index: _source}), and `_source`.
    """
    try:
        if deliverable != DELIVERABLE_SOUPIS:
            return {
                "error": (
                    f"Unsupported deliverable '{deliverable}'. "
                    f"This tool currently exports only '{DELIVERABLE_SOUPIS}'."
                ),
                "deliverable": deliverable,
            }

        resolved: Optional[list] = items
        if resolved is None and project_id:
            resolved = _load_items_from_project(project_id)
        if not resolved:
            return {
                "error": (
                    "No items to export — provide a non-empty `items` list, or a "
                    "`project_id` with a stored work breakdown."
                ),
                "deliverable": deliverable,
                "row_count": 0,
            }

        soupis_data = _items_to_soupis_data(resolved, project_id)

        # SAME renderer as REST /export-xlsx — not forked.
        from app.utils.soupis_exporter import export_soupis_xlsx

        xlsx_bytes = export_soupis_xlsx(soupis_data)

        # Provenance preserved in METADATA (not in the KROS sheet). Traceable by
        # row index → originating item `_source`.
        source_map: dict[str, Any] = {}
        source_preserved = True
        for idx, it in enumerate(resolved, 1):
            src = it.get("_source")
            source_map[str(idx)] = src
            if not (isinstance(src, str) and src.strip()):
                source_preserved = False

        # Carried calculator output reaches the deliverable METADATA (not the KROS
        # columns): one calc block per computed element + the aggregated warnings.
        # Numbers stay traceable to their element; nothing is fabricated for the
        # elements the engine did not compute (they are simply absent here).
        calc_summary: list[dict[str, Any]] = []
        calc_warnings: list[str] = []
        seen_elements: set = set()
        for it in resolved:
            if it.get("calc_status") == "computed":
                en = it.get("element_name")
                if en not in seen_elements:
                    seen_elements.add(en)
                    calc_summary.append(
                        {
                            "element_name": en,
                            "element_type": it.get("element_type"),
                            "calc": it.get("calc"),
                        }
                    )
            for w in it.get("calc_warnings") or []:
                if w not in calc_warnings:
                    calc_warnings.append(w)

        return {
            "deliverable": deliverable,
            "file_base64": base64.b64encode(xlsx_bytes).decode("ascii"),
            "filename": f"soupis_praci_{len(resolved)}pol.xlsx",
            "row_count": len(resolved),
            "source_preserved": source_preserved,
            "source_map": source_map,
            "calc_summary": calc_summary,
            "calc_warnings": calc_warnings,
            "_source": f"export_soupis:{deliverable} ← {len(resolved)} work items",
        }

    except Exception as e:
        logger.exception("[MCP/Export] export_soupis failed")
        return {"error": str(e), "deliverable": deliverable, "row_count": 0}
