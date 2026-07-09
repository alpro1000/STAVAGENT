"""
Catalog-Binding Adapter (UWO Stage 3, post-step). INTERNAL module — NOT a new MCP
tool (design.md §5.3). Wraps the existing find_otskp_code / find_urs_code WITHOUT
changing their signatures, normalises their heterogeneous output into ONE
status-enum, and selects the catalog by procurement mode.

Status-enum semantics (design.md §5.1 + CONTRACT_find_urs_code §3, ratified §6):
  exact        — OTSKP DB hit (exact code lookup). RESERVED for OTSKP, conf 1.0.
  candidate    — URS/Perplexity/matcher item match, conf ≥ floor. Needs confirm.
  group_only   — only a skupina/kapitola (prefix) found, no concrete item.
  not_verified — no match / raw context / weak item / licensed full-ÚRS needed.

INVARIANT: URS status is at most `candidate`, NEVER `exact`. `exact` is reserved
for a deterministic OTSKP DB hit.

match_kind → status mapping (CONTRACT §3). The tool stamps `match_kind` on every
result; the adapter reads it — never sort-sniffs the source.
"""

from __future__ import annotations

import logging

from app.models.item_schemas import CodeStatus

logger = logging.getLogger(__name__)

# ── Floor for URS `candidate` (CONTRACT §6 decision 4) ───────────────────────
# Separate from the OTSKP binding floor: the signals are not interchangeable
# (OTSKP = DB+embeddings; URS = web/matcher). 0.80 lets the matcher (~0.85) into
# `candidate`, cuts perplexity noise (~0.5), 0.05 headroom kills jitter at 0.85.
URS_CANDIDATE_FLOOR = 0.80

# ⚠️ CONTRACT §6 ⚠️-check resolved IN CODE (urs.py): the perplexity branch stamps a
# CONSTANT 0.80 for any regex-extracted code (not a measured similarity), while the
# matcher emits a genuine score-derived confidence. The two confidence scales are
# therefore NOT comparable, so the demotion floor is applied to the MATCHER branch
# only (per the contract's conditional). A perplexity `item` is treated as a
# candidate regardless of its flat 0.80 stamp — it is a real extracted code, and its
# confidence is not a quality signal to threshold on.
_FLOORED_SOURCES = {"urs_matcher_service"}


def map_status(match_kind: str | None, confidence: float | None, source: str | None = None) -> str:
    """match_kind (+ conf, + source) → status-enum. URS never returns `exact`."""
    conf = confidence or 0.0
    if match_kind == "item":
        # Floor only the matcher branch — perplexity's 0.80 is a flat stamp, not a
        # comparable score (see _FLOORED_SOURCES note above).
        if source in _FLOORED_SOURCES and conf < URS_CANDIDATE_FLOOR:
            return CodeStatus.NOT_VERIFIED.value
        return CodeStatus.CANDIDATE.value
    if match_kind == "group":
        return CodeStatus.GROUP_ONLY.value
    # raw_context / none / unknown → honest not_verified, never a fabricated code.
    return CodeStatus.NOT_VERIFIED.value


# ── Catalog choice by procurement mode (reuse kb/urs_otskp_routing.yaml) ──────
# Mirrors the routing YAML's catalog_priority without re-stating the rule:
#   privatni → URS; verejna → OTSKP; design_build → URS (OTSKP cross is a later
#   phase — the MVP binds the primary catalog only).
def _primary_catalog(procurement_mode: str) -> str:
    return "otskp" if procurement_mode == "verejna" else "urs"


async def bind_catalog_code(
    work_description: str,
    procurement_mode: str = "privatni",
    context: str | None = None,
) -> dict:
    """Bind ONE work-atom to a catalog candidate + status.

    Routes to find_otskp_code (verejna) or find_urs_code (privatni/design_build),
    reads the tool's per-result provenance, and derives the status-enum. Tool
    timeout / 5xx → status='not_verified' (decomposition survives — Pattern 15 /
    design.md §7). Returns a CatalogBinding-shaped dict (design.md §3.1).
    """
    catalog = _primary_catalog(procurement_mode)
    binding = {
        "catalog": catalog,
        "procurement_mode": procurement_mode,
        "code": None,
        "status": CodeStatus.NOT_VERIFIED.value,
        "confidence": 0.0,
        "match_kind": "none",
        "matched_description": None,
        "unit": None,
        "catalog_version": None,
    }

    try:
        if catalog == "otskp":
            from app.mcp.tools.otskp import find_otskp_code

            res = await find_otskp_code(work_description, max_results=5)
            top = (res.get("results") or [None])[0]
            if top:
                # OTSKP fulltext: the deterministic chain caps keyword at 0.9 and
                # never stamps 1.0 on a bare hit. `exact` is reserved for the exact
                # code-lookup branch (not reachable here — we search by text), so a
                # text-search top candidate is a `candidate`, not `exact`.
                binding.update(
                    code=top.get("code"),
                    status=CodeStatus.CANDIDATE.value,
                    confidence=top.get("confidence", 0.0),
                    match_kind="item",
                    matched_description=top.get("description"),
                    unit=top.get("unit"),
                    catalog_version=top.get("source"),
                )
            return binding

        # URS path (privatni / design_build primary).
        from app.mcp.tools.urs import find_urs_code

        res = await find_urs_code(work_description, context=context)
        top = (res.get("results") or [None])[0]
        if top:
            match_kind = top.get("match_kind", "none")
            status = map_status(match_kind, top.get("confidence"), top.get("source"))
            binding.update(
                # Only surface a code for an accepted item match — never for
                # raw_context / not_verified (no fabricated codes).
                code=top.get("code") if status in (CodeStatus.CANDIDATE.value, CodeStatus.GROUP_ONLY.value) else None,
                status=status,
                confidence=top.get("confidence", 0.0),
                match_kind=match_kind,
                matched_description=top.get("description"),
                unit=top.get("unit"),
                catalog_version=top.get("catalog_version"),
            )
        return binding

    except Exception as e:  # tool timeout / 5xx — decomposition survives
        logger.warning("[CatalogBinding] %s lookup failed: %s", catalog, e)
        binding["bind_error"] = str(e)
        return binding


async def attach_urs_codes(items: list[dict], procurement_mode: str = "privatni") -> list[dict]:
    """Bind a list of decomposed work-atoms to the procurement-mode catalog.

    Mutates each item in place, mirroring the OTSKP `_attach_catalog_codes`
    contract (fills the SAME reserved slots: code / status / confidence). This is
    the closed ÚRS gap: the monolit/PSV → ÚRS path now calls find_urs_code instead
    of early-returning. The work-first list is already frozen — this is the
    separate catalog-last stage (Pattern 15).
    """
    for item in items:
        binding = await bind_catalog_code(
            item.get("work_description", ""),
            procurement_mode=procurement_mode,
        )
        item["catalog_binding"] = binding
        # Mirror onto the flat reserved slots so downstream readers don't need to
        # know which catalog ran (parity with the OTSKP path).
        item["urs_code"] = binding["code"]
        item["code_status"] = binding["status"]
        item["code_confidence"] = binding["confidence"]
        item["unit_price_czk"] = None  # ÚRS is priceless data (honest null)
    return items
