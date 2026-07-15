"""
Unified Item Layer — Pydantic schemas for project items (smetné pozice).

Provides a single permanent identifier for each budget position across all kiosks.
Each kiosk writes to its own namespace block; blocks are isolated.

Code systems: OTSKP (transport), ÚRS (civil), RTS (regional).

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-28
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Code system (coding classification system)
# ---------------------------------------------------------------------------
class CodeSystem(str, Enum):
    OTSKP = "otskp"        # Oborový třídník (transport/infrastructure)
    URS = "urs"             # ÚRS Praha (civil construction)
    RTS = "rts"             # Regionální technologický standard
    UNKNOWN = "unknown"     # Not yet determined


# ---------------------------------------------------------------------------
# Catalog-binding status (UWO F3 — single source of truth)
# ---------------------------------------------------------------------------
class CodeStatus(str, Enum):
    """Unified catalog-binding status for a work-atom's `code_status` field.

    SINGLE SOURCE (design.md universal-work-decomposer §2.2 / §5.1). Before F3
    the value lived as divergent string literals across the two binding paths:
    the catalog-binding adapter used ``candidate``/``not_verified`` while the
    work-breakdown OTSKP path used ``bound``/``no_match`` for the *same*
    outcomes. Those synonyms are collapsed here — ``bound`` → ``candidate``,
    ``no_match`` → ``not_verified`` — so every producer emits from one vocabulary.

    INVARIANT: ``exact`` is RESERVED for a deterministic OTSKP DB exact-code hit
    (conf 1.0). A text-search / ÚRS-matcher / Perplexity match is at most
    ``candidate`` — a client must never mistake a candidate for an official code.

    The design's canonical binding-outcome set is the first four. ``bundled`` and
    ``not_calculated`` extend it for two real states the ``code_status`` field
    also carries: a catalog-design rule (no standalone code) and the work-first
    frozen state (binding not yet run, Pattern 15).

    NOTE (scope): ``position_enricher.py``'s separate ``match`` axis
    (``exact|partial|none`` — match *quality*, not binding status) is a different
    concept and is intentionally NOT merged here; converging it is a follow-up.
    """
    EXACT = "exact"                  # deterministic OTSKP DB exact-code hit (reserved)
    CANDIDATE = "candidate"          # item match above floor (OTSKP text / ÚRS matcher) — needs confirm
    GROUP_ONLY = "group_only"        # only a skupina/kapitola prefix found, no concrete item
    NOT_VERIFIED = "not_verified"    # binding ran, no acceptable match / raw context
    BUNDLED = "bundled"              # no standalone code by CATALOG design (RULE, conf 1.0)
    NOT_CALCULATED = "not_calculated"  # work-first frozen: catalog binding not yet run (Pattern 15)


# ---------------------------------------------------------------------------
# `quantity_status` — AXIS INVENTORY (recon 2026-07-15, CodeStatus discipline)
#
# The key `quantity_status` rides THREE different entities and carries THREE
# semantically DIFFERENT axes. They are deliberately NOT merged into one
# vocabulary (unlike CodeStatus/F3, where `bound`≡`candidate` were synonyms of
# one outcome) — here the axes answer different questions. Unified is the
# DISCIPLINE: no raw string literals at producers, every axis named here.
#
#   1. ElementQuantityStatus — elements[] (soupis_quantity_join.py):
#      OUTCOME OF THE SOUPIS→ELEMENT JOIN. Did the authoritative soupis
#      volume land on this element?
#   2. ItemQuantityStatus — work-breakdown items (mcp/tools/breakdown.py):
#      PROVENANCE OF THE NUMBER. Where did this quantity come from
#      (verbatim input / deterministic formula / typed default / not
#      computable)? NEPOČÍTÁNO is a PREFIX — see the enum docstring.
#   3. PricingQuantityStatus — PricedPolozka (pricing/otskp_engine.py,
#      railway svršek/spodek engine, surfaced via /api/v1/soupis/generate):
#      COMPLETENESS OF THE PRICING INPUT.
#
# Known satellites (mapped, intentionally untouched):
#   - DORMANT DIALECT D: Monolit-Planner migration 002-add-soupis-items.sql
#     has a `quantity_status TEXT DEFAULT 'OK'` column mirroring
#     PricedPolozka — NO JS writer or reader exists (dead since the Soupis
#     Prací tab era). Tracked in BACKLOG; do not resurrect silently.
#   - SYNONYM ROW: soupis_quantity_join also writes a per-field provenance
#     sub-axis `_source.volume_m3.status` (`not_extracted_from_soupis` /
#     `collapsed_into_same_type_sibling` /
#     `ambiguous_multiple_elements_same_type`) — a 1:1 verbose mirror of
#     ElementQuantityStatus, NOT unified here (evidence detail, own shape).
#   - WORD COLLISION: the literal «NEPOČÍTÁNO» also appears on the separate
#     calc/soft-degradation axis (TS UncalculatedError, v4.38; export.py
#     `calc_status` Zdroj label) — same word, different axis. Enum names keep
#     the axes apart in code even where the visible label shares the word.
# ---------------------------------------------------------------------------
class ElementQuantityStatus(str, Enum):
    """Outcome of the soupis→element quantity join (`quantity_status` on
    elements[], producer: services/stage_gating/soupis_quantity_join.py).

    D-rules recap: soupis is authoritative; no match → honest-blank `missing`
    (element KEPT, volume None); same-type ambiguity → `ambiguous` +
    candidates[], never a silent split; a same-type sibling whose volume the
    carrier already holds → `collapsed_into_sibling` (no quantity, prevents
    double-count at the passport-key merge)."""
    EXTRACTED = "extracted"                          # summed soupis volume assigned (carrier / soupis-only synth)
    MISSING = "missing"                              # no soupis volume for this element_type — honest blank
    AMBIGUOUS = "ambiguous"                          # >1 element shares the type — candidates[], never split
    COLLAPSED_INTO_SIBLING = "collapsed_into_sibling"  # carrier sibling holds the volume — no quantity here


class ItemQuantityStatus(str, Enum):
    """Provenance of a work-breakdown item's quantity (`quantity_status` on
    items, producer: mcp/tools/breakdown.py; SPEC document-to-worklist §6.3,
    invariant §6.4.2 — no number without a formula + an honest status).

    Ladder: `from_input` = verbatim caller/document value; `computed` =
    deterministic formula where EVERY factor comes from the input (mixed
    provenance = the WORSE status, ratified after review #1510 finding 4);
    `assumed` = element-type default estimate — must scream, never look like
    a fact.

    NEPOCITANO is a PREFIX, not a full value: real payloads carry
    ``NEPOČÍTÁNO(<reason>)`` built via :meth:`nepocitano` — the reason rides
    the string verbatim into the XLSX Zdroj label (review #1510 finding 10)
    and tests pin ``startswith("NEPOČÍTÁNO")``. Splitting the reason into its
    own field is a conscious non-goal of the enum step (separate ticket)."""
    FROM_INPUT = "from_input"    # taken verbatim from the caller's element field
    COMPUTED = "computed"        # deterministic formula, all factors from input
    ASSUMED = "assumed"          # element-type default estimate
    NEPOCITANO = "NEPOČÍTÁNO"    # PREFIX — real values are NEPOČÍTÁNO(<reason>)

    @classmethod
    def nepocitano(cls, reason: str) -> str:
        """Build the parametrized honest-refusal value ``NEPOČÍTÁNO(<reason>)``."""
        return f"{cls.NEPOCITANO.value}({reason})"


class PricingQuantityStatus(str, Enum):
    """Completeness of the pricing input for a PricedPolozka
    (`quantity_status` on priced rows, producer: pricing/otskp_engine.py —
    railway svršek/spodek engine; REST surface /api/v1/soupis/generate).

    NOTE: `CHYBÍ_VSTUP` is counted by ``summarize()`` but no production site
    was found at enum introduction (recon 2026-07-15) — dead-or-missing-emitter
    question tracked in BACKLOG, deliberately not resolved by the enum step."""
    OK = "OK"                    # quantity derived from a real input (confidence ≥ 0.8)
    ODHADNUTO = "ODHADNUTO"      # estimated — low-confidence derivation
    CHYBI_VSTUP = "CHYBÍ_VSTUP"  # input missing — quantity not derivable


# ---------------------------------------------------------------------------
# Namespace — who owns which data block
# ---------------------------------------------------------------------------
class Namespace(str, Enum):
    ESTIMATE = "estimate"       # Smetné data from Excel (Registry imports)
    MONOLIT = "monolit"         # Monolit kiosk concrete parameters
    CLASSIFICATION = "classification"  # URS/OTSKP classification & work group
    CORE = "core"               # Core Engine metadata (auto-managed)


# ---------------------------------------------------------------------------
# Hierarchy level
# ---------------------------------------------------------------------------
class HierarchyLevel(BaseModel):
    """Position in the SO → oddíl → skupina → pozice hierarchy."""
    so_id: Optional[str] = None
    so_name: Optional[str] = None
    oddil_code: Optional[str] = None        # HSV/PSV section code
    oddil_name: Optional[str] = None
    skupina_code: Optional[str] = None      # Work group code (first 3 digits)
    skupina_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Code detection result
# ---------------------------------------------------------------------------
class CodeDetectionResult(BaseModel):
    """Result of auto-detecting which code system a code belongs to."""
    code_system: CodeSystem
    code_normalized: str                     # Numeric part only, no spaces
    code_raw: str                            # Original as in Excel
    confidence: float = Field(ge=0.0, le=1.0)
    detection_method: str = ""               # "otskp_db", "regex_structure", "prefix_letter", "ai"
    hierarchy: Optional[HierarchyLevel] = None
    otskp_match: Optional[Dict[str, Any]] = None  # If found in OTSKP catalog


# ---------------------------------------------------------------------------
# Estimate data block (from Excel/Registry)
# ---------------------------------------------------------------------------
class EstimateData(BaseModel):
    """Smetné data — owned by Registry (Excel import)."""
    kod: str = ""
    popis: str = ""
    popis_detail: Optional[str] = None
    mnozstvi: Optional[float] = None
    mj: str = ""
    cena_jednotkova: Optional[float] = None
    cena_celkem: Optional[float] = None
    specification: Optional[str] = None
    price_source: Optional[str] = None      # "CS URS 2025 02", "RTS 25/I"
    vv_lines: Optional[List[Dict[str, Any]]] = None  # Quantity calculations
    sheet_name: Optional[str] = None
    row_index: Optional[int] = None


# ---------------------------------------------------------------------------
# Monolit data block
# ---------------------------------------------------------------------------
class MonolitData(BaseModel):
    """Monolit kiosk data — concrete parameters, costs."""
    monolit_position_id: Optional[str] = None
    monolit_project_id: Optional[str] = None
    part_name: Optional[str] = None
    subtype: Optional[str] = None           # Concrete class, steel grade
    concrete_m3: Optional[float] = None
    crew_size: Optional[int] = None
    wage_czk_ph: Optional[float] = None
    shift_hours: Optional[float] = None
    days: Optional[float] = None
    labor_hours: Optional[float] = None
    cost_czk: Optional[float] = None
    unit_cost_on_m3: Optional[float] = None
    kros_unit_czk: Optional[float] = None
    kros_total_czk: Optional[float] = None
    curing_days: Optional[int] = None
    monolit_url: Optional[str] = None
    calculated_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Classification data block
# ---------------------------------------------------------------------------
class ClassificationData(BaseModel):
    """Classification result — work group, enrichment from catalog."""
    code_system: CodeSystem = CodeSystem.UNKNOWN
    code_normalized: Optional[str] = None
    detection_confidence: float = 0.0
    detection_method: Optional[str] = None
    skupina: Optional[str] = None           # Work group (BETON_MONOLIT, etc.)
    skupina_confidence: float = 0.0
    skupina_method: Optional[str] = None    # "rule", "regex", "ai", "manual"
    # Enrichment from OTSKP/URS catalog
    standard_name: Optional[str] = None     # Name from catalog
    hierarchy: Optional[HierarchyLevel] = None
    otskp_price: Optional[float] = None
    otskp_unit: Optional[str] = None


# ---------------------------------------------------------------------------
# Core metadata block (auto-managed)
# ---------------------------------------------------------------------------
class CoreMetadata(BaseModel):
    """Core Engine metadata — auto-managed, read-only for kiosks."""
    version: int = 1
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    estimate_filled: bool = False
    monolit_filled: bool = False
    classification_filled: bool = False
    deleted_in_reimport: bool = False        # Missing from new version of file
    source_file: Optional[str] = None
    # Grouping: linked positions (beton + armatura + opalubka)
    group_leader_id: Optional[str] = None    # If this is rebar/formwork, points to parent beton
    group_role: Optional[str] = None         # "beton", "armatura", "opalubka", None
    group_members: Optional[List[str]] = None  # If this is beton, list of linked item_ids
    armatura_included: bool = False          # "vč. výztuže" detected in description
    opalubka_included: bool = False          # "vč. bednění" detected in description


# ---------------------------------------------------------------------------
# Full item (read response)
# ---------------------------------------------------------------------------
class ProjectItem(BaseModel):
    """Complete project item with all namespace blocks."""
    item_id: str                             # Permanent UUID
    project_id: str                          # Project reference
    # Namespace blocks
    estimate: EstimateData = Field(default_factory=EstimateData)
    monolit: Optional[MonolitData] = None
    classification: Optional[ClassificationData] = None
    core: CoreMetadata = Field(default_factory=CoreMetadata)


# ---------------------------------------------------------------------------
# API request/response models
# ---------------------------------------------------------------------------

class ItemImportRow(BaseModel):
    """Single row from Excel import."""
    kod: str = ""
    popis: str = ""
    popis_detail: Optional[str] = None
    mnozstvi: Optional[float] = None
    mj: str = ""
    cena_jednotkova: Optional[float] = None
    cena_celkem: Optional[float] = None
    specification: Optional[str] = None
    price_source: Optional[str] = None
    vv_lines: Optional[List[Dict[str, Any]]] = None
    sheet_name: Optional[str] = None
    row_index: Optional[int] = None
    # Hierarchy
    so_id: Optional[str] = None
    so_name: Optional[str] = None
    oddil_code: Optional[str] = None
    oddil_name: Optional[str] = None


class BulkImportRequest(BaseModel):
    """Request to import positions from Excel."""
    project_id: str
    source_file: Optional[str] = None
    items: List[ItemImportRow]


class BulkImportResponse(BaseModel):
    """Response from bulk import."""
    project_id: str
    total: int
    created: int
    updated: int
    unchanged: int
    items: List[ProjectItem]


class ItemFilterRequest(BaseModel):
    """Filters for reading items."""
    skupina: Optional[str] = None           # Work group filter
    code_system: Optional[CodeSystem] = None
    has_monolit: Optional[bool] = None       # True = only filled, False = only empty
    has_classification: Optional[bool] = None
    keyword: Optional[str] = None            # Search in popis
    so_id: Optional[str] = None


class UpdateBlockRequest(BaseModel):
    """Request to update a namespace block."""
    namespace: Namespace
    data: Dict[str, Any]


class UpdateBlockResponse(BaseModel):
    """Response from block update."""
    item_id: str
    namespace: str
    updated: bool
    item: ProjectItem


class ItemVersionEntry(BaseModel):
    """A version snapshot of an item's estimate data."""
    version: int
    changed_at: str
    changed_fields: List[str]
    old_values: Dict[str, Any]
    new_values: Dict[str, Any]
