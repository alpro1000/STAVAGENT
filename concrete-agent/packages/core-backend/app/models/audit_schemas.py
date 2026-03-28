"""
NKB Audit Schemas — Models for normative source audit and gap analysis.

Extends the NKB system with source tracking, audit results, and gap analysis.
Used by the norm_audit_service to crawl external sources and compare with DB.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-28
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Document status in gap analysis
# ---------------------------------------------------------------------------
class DocStatus(str, Enum):
    AKTUALNI = "aktuální"          # In system, version matches source
    ZASTARALY = "zastaralý"        # In system, but source has newer version
    CHYBI = "chybí"                # In source, not in system, freely available
    NEDOSTUPNY = "nedostupný"      # Requires registration or payment
    KALIBRACNI = "kalibrační"      # Not a norm — calibration data (soupisy, smlouvy)


class DocType(str, Enum):
    NORMA = "norma"                # ČSN, EN, ISO
    ZAKON = "zákon"                # zákon, vyhláška, nařízení
    TKP = "tkp"                    # technické kvalitativní podmínky
    TP = "tp"                      # technické podmínky MD/ŘSD
    VTP = "vtp"                    # všeobecné technické podmínky SŽ
    PREDPIS = "předpis"            # předpis SŽ řady S, Směrnice
    METODIKA = "metodika"          # metodický pokyn
    DATOVY_PREDPIS = "datový_předpis"  # XC4, B1, C4
    KALIBRACNI = "kalibrační"      # soupisy prací ze smluv


class SourcePriority(int, Enum):
    HIGH = 3    # ★★★
    MEDIUM = 2  # ★★
    LOW = 1     # ★


# ---------------------------------------------------------------------------
# Source catalog entry
# ---------------------------------------------------------------------------
class NormSource(BaseModel):
    """Definition of an external normative source."""
    source_code: str = Field(..., description="Unique code: sz, pjpk_tp, mmr_pravo, etc.")
    name: str = Field(..., description="Human-readable name")
    url: str = Field(..., description="Primary catalog URL")
    description: str = Field(default="")
    priority: SourcePriority = Field(default=SourcePriority.MEDIUM)
    doc_types: List[DocType] = Field(default_factory=list)
    oblasti: List[str] = Field(default_factory=list, description="mosty, koleje, silnice, beton, tunely, občanská, zákony")
    is_signal_only: bool = Field(default=False, description="True = only metadata, no downloads (ČAS, ÚNMZ)")
    scraper_implemented: bool = Field(default=False)


# ---------------------------------------------------------------------------
# Found document (from scraping a source)
# ---------------------------------------------------------------------------
class FoundDocument(BaseModel):
    """A document found by scraping an external source."""
    oznaceni: str = Field(..., description="Official designation: TKP 18, TP 102, zákon 283/2021 Sb.")
    nazev: str = Field(default="", description="Full Czech title")
    doc_type: DocType = Field(default=DocType.NORMA)
    datum_ucinnosti: Optional[str] = Field(default=None, description="Date of effect (YYYY-MM-DD or year)")
    oblast: Optional[str] = Field(default=None, description="mosty, koleje, silnice, beton, tunely, občanská, zákony")
    url_ke_stazeni: Optional[str] = Field(default=None, description="Download URL if available")
    zdroje: List[str] = Field(default_factory=list, description="Source codes where this was found")
    priorita: SourcePriority = Field(default=SourcePriority.MEDIUM)
    is_freely_available: bool = Field(default=True)
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Gap analysis result for a single document
# ---------------------------------------------------------------------------
class GapEntry(BaseModel):
    """Gap analysis result for a single normative document."""
    oznaceni: str
    nazev: str
    doc_type: DocType
    status: DocStatus
    datum_ucinnosti: Optional[str] = None
    oblast: Optional[str] = None
    zdroje: List[str] = Field(default_factory=list)
    priorita: SourcePriority = Field(default=SourcePriority.MEDIUM)
    url_ke_stazeni: Optional[str] = None
    # If in system:
    norm_id_in_db: Optional[str] = None
    version_in_db: Optional[str] = None
    # If source is newer:
    version_in_source: Optional[str] = None


# ---------------------------------------------------------------------------
# Source summary (for the top table in admin UI)
# ---------------------------------------------------------------------------
class SourceSummary(BaseModel):
    """Summary for one source in the audit results."""
    source_code: str
    source_name: str
    total: int = 0
    aktualni: int = 0
    zastaraly: int = 0
    chybi: int = 0
    nedostupny: int = 0
    kalibracni: int = 0
    last_scraped: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Full audit result
# ---------------------------------------------------------------------------
class AuditResult(BaseModel):
    """Complete NKB audit result."""
    audit_id: str
    started_at: str
    completed_at: Optional[str] = None
    status: str = "running"  # running, completed, failed
    progress: int = 0  # 0-100
    current_source: Optional[str] = None
    sources_checked: List[str] = Field(default_factory=list)
    source_summaries: List[SourceSummary] = Field(default_factory=list)
    gap_entries: List[GapEntry] = Field(default_factory=list)
    total_unique_documents: int = 0
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# API request/response models
# ---------------------------------------------------------------------------
class StartAuditRequest(BaseModel):
    sources: Optional[List[str]] = Field(default=None, description="Source codes to audit. None = all.")
    priority_filter: Optional[int] = Field(default=None, description="Min priority (1-3). None = all.")


class DownloadMissingRequest(BaseModel):
    min_priority: int = Field(default=3, description="Minimum priority to download (3=★★★)")
    oznaceni_list: Optional[List[str]] = Field(default=None, description="Specific documents to download. None = all matching priority.")
