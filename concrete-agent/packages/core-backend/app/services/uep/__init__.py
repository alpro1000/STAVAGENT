"""
UEP — Universal Extraction Pipeline (PR1: skeleton + Phase 1 + Phase 2).

Per-source extractors (Phase 1) + coverage matrix engine (Phase 2) for
construction project documentation. Extractors emit `PerSourceExtraction`
records (see `app.models.uep_schemas`); the coverage engine reads those
records and produces a `CoverageReport` against a YAML matrix.

Naming follows `services/extractor_registry.py` — "extractor" not "adapter".

Scope-locked for PR1:
- DXF (ezdxf, universal entity-type + layer + block coverage)
- PDF TZ (pdfplumber + regex baseline)

Out of PR1 scope (see task §10):
- DWG / IFC / XML extractors (PR3)
- Reconciliation engine (PR2)
- Derivation registry (PR2)
- REST API (PR2)
- MCP tools (PR2-3)

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3
"""

from app.services.uep.dxf_extractor import DxfExtractor
from app.services.uep.extractor_base import BaseExtractor, ExtractorError
from app.services.uep.pdf_tz_extractor import PdfTzExtractor
from app.services.uep.registry import (
    detect_format,
    get_extractor,
    list_supported_formats,
)

# Coverage engine ships in the follow-up commit; re-export lazily so an
# `from app.services.uep import evaluate_coverage` still resolves once
# the module is on disk.
try:
    from app.services.uep.coverage_engine import (  # noqa: F401
        evaluate_coverage,
        load_matrix,
    )
except ImportError:  # pragma: no cover — only between commits in this PR
    evaluate_coverage = None  # type: ignore[assignment]
    load_matrix = None  # type: ignore[assignment]

# Reconciliation engine (PR2 Phase 3) — same lazy re-export shape.
try:
    from app.services.uep.reconciliation_engine import (  # noqa: F401
        evaluate_reconciliation,
        load_rules,
        rules_path_for,
    )
except ImportError:  # pragma: no cover
    evaluate_reconciliation = None  # type: ignore[assignment]
    load_rules = None  # type: ignore[assignment]
    rules_path_for = None  # type: ignore[assignment]

# Derivation registry (PR2 Phase 4) — same lazy re-export shape.
try:
    from app.services.uep.derivation_registry import (  # noqa: F401
        DerivationError,
        DerivationRegistry,
        UnknownDerivationRule,
        apply_derivation,
        get_global_registry,
        list_applicable_derivations,
        load_registry,
    )
except ImportError:  # pragma: no cover
    DerivationError = None  # type: ignore[assignment]
    DerivationRegistry = None  # type: ignore[assignment]
    UnknownDerivationRule = None  # type: ignore[assignment]
    apply_derivation = None  # type: ignore[assignment]
    get_global_registry = None  # type: ignore[assignment]
    list_applicable_derivations = None  # type: ignore[assignment]
    load_registry = None  # type: ignore[assignment]


__all__ = [
    "BaseExtractor",
    "ExtractorError",
    "DxfExtractor",
    "PdfTzExtractor",
    "detect_format",
    "get_extractor",
    "list_supported_formats",
    "load_matrix",
    "evaluate_coverage",
    "load_rules",
    "evaluate_reconciliation",
    "rules_path_for",
]
