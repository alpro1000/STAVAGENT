"""
Pipeline models — Pydantic schemas for the Universal Document Pipeline.

Principle: every extracted value carries confidence + source.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════
#  ENUMS
# ═══════════════════════════════════════════════════════════

class FileFormat(str, enum.Enum):
    PDF = "pdf"
    XLSX = "xlsx"
    XLS = "xls"
    CSV = "csv"
    XML = "xml"
    DOCX = "docx"
    DOC = "doc"
    JPEG = "jpeg"
    PNG = "png"
    TIFF = "tiff"
    DWG = "dwg"
    DXF = "dxf"
    IFC = "ifc"
    RVT = "rvt"
    ZIP = "zip"
    UNKNOWN = "unknown"


class DocType(str, enum.Enum):
    # Technické zprávy D.1.4
    TZ_SILNOPROUD = "tz_silnoproud"
    TZ_SLABOPROUD = "tz_slaboproud"
    TZ_ZTI = "tz_zti"
    TZ_VZT = "tz_vzt"
    TZ_UT = "tz_ut"
    TZ_PLYNOVOD = "tz_plynovod"
    TZ_MAR = "tz_mar"
    # Ostatní TZ
    TZ_STATIKA = "tz_statika"          # D.1.2
    TZ_PBRS = "tz_pbrs"                # D.1.3
    TZ_BETON = "tz_beton"
    TZ_BEDNENI = "tz_bedneni"
    TZ_VYZTUZE = "tz_vyztuze"
    TZ_HYDRO = "tz_hydro"
    TZ_ZEMNI = "tz_zemni"
    TZ_KOMUNIKACE = "tz_komunikace"
    TZ_MOST = "tz_most"
    TZ_GENERIC = "tz_generic"
    # Průvodní / souhrnná
    PRUVODNI_ZPRAVA = "pruvodni_zprava"    # A
    SOUHRNNA_TZ = "souhrnna_tz"            # B
    KOORDINACNI_SITUACE = "koordinacni_situace"  # C
    # Rozpočty a soupisy
    ROZPOCET_KOMPLET = "rozpocet_komplet"
    ROZPOCET_RTS = "rozpocet_rts"
    SOUPIS_PRACI = "soupis_praci"
    VYKAZ_VYMER = "vykaz_vymer"
    # Geologie / geodézie
    GEOLOGIE = "geologie"
    HYDROGEOLOGIE = "hydrogeologie"
    GEODEZIE = "geodezie"
    # Grafické
    VYKRESY = "vykresy"
    CAD_VYKRES = "cad_vykres"
    BIM_MODEL = "bim_model"
    FOTO = "foto"
    # Ostatní
    HARMONOGRAM = "harmonogram"
    SMLOUVA = "smlouva"
    ZADAVACI_DOKUMENTACE = "zadavaci_dokumentace"
    OSTATNI = "ostatni"


class PDStage(str, enum.Enum):
    """Stupeň projektové dokumentace."""
    DUR = "DÚR"      # Dokumentace pro územní rozhodnutí
    DSP = "DSP"      # Dokumentace pro stavební povolení
    DPS = "DPS"      # Dokumentace pro provádění stavby
    DVZ = "DVZ"      # Dokumentace pro výběr zhotovitele
    DSPS = "DSPS"    # Dokumentace skutečného provedení
    PDPS = "PDPS"    # Projektová dokumentace provádění stavby
    UNKNOWN = "unknown"


class ExtractionSource(str, enum.Enum):
    REGEX = "regex"
    AI_GEMINI = "ai_gemini"
    AI_BEDROCK = "ai_bedrock"
    AI_PERPLEXITY = "ai_perplexity"
    TABLE_PARSE = "table_parse"
    OCR = "ocr"
    MANUAL = "manual"


class ContradictionSeverity(str, enum.Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


# ═══════════════════════════════════════════════════════════
#  LAYER 0: INTAKE
# ═══════════════════════════════════════════════════════════

class IntakeResult(BaseModel):
    format: FileFormat
    size_bytes: int
    is_valid: bool
    error: Optional[str] = None
    needs_conversion: bool = False
    conversion_target: Optional[str] = None
    original_filename: str = ""
    mime_type: Optional[str] = None


# ═══════════════════════════════════════════════════════════
#  LAYER 1: EXTRACTION
# ═══════════════════════════════════════════════════════════

class ExtractedContent(BaseModel):
    text: str = ""
    tables: List[List[List[str]]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    page_count: int = 0
    images_count: int = 0
    parser_used: str = ""
    extraction_quality: float = 0.0  # 0-1


# ═══════════════════════════════════════════════════════════
#  LAYER 2: CLASSIFICATION
# ═══════════════════════════════════════════════════════════

class Classification(BaseModel):
    doc_type: DocType = DocType.OSTATNI
    section: Optional[str] = None       # "D.1.4", "A", "B", "C"
    stage: PDStage = PDStage.UNKNOWN
    confidence: float = 0.0
    method: str = "unknown"             # "tier_0"|"tier_1"|"tier_2"|"tier_3"
    detected_keywords: List[str] = Field(default_factory=list)
    so_code: Optional[str] = None       # "SO 202"


# ═══════════════════════════════════════════════════════════
#  LAYER 3: REGEX EXTRACTION (confidence=1.0)
# ═══════════════════════════════════════════════════════════

class ExtractedFact(BaseModel):
    """Single extracted datum with provenance."""
    name: str                           # "installed_power_kwp"
    value: Any                          # 34.58
    unit: Optional[str] = None          # "kWp"
    confidence: float = 1.0
    source: ExtractionSource = ExtractionSource.REGEX
    page: Optional[int] = None
    raw_text: Optional[str] = None      # original matched text


class NormReference(BaseModel):
    """Referenced standard / norm."""
    code: str                           # "ČSN 33 2000-7-712"
    title: Optional[str] = None
    is_mandatory: bool = False
    page: Optional[int] = None


class IdentificationData(BaseModel):
    stavba: Optional[str] = None
    investor: Optional[str] = None
    misto: Optional[str] = None
    kraj: Optional[str] = None
    projektant: Optional[str] = None
    datum: Optional[str] = None
    cislo_zakazky: Optional[str] = None
    stupen_pd: Optional[str] = None
    ico: Optional[str] = None
    ckait: Optional[str] = None


class RiskItem(BaseModel):
    severity: str = "medium"            # "high"|"medium"|"low"
    text: str = ""
    page: Optional[int] = None
    source: ExtractionSource = ExtractionSource.REGEX


class QuantityItem(BaseModel):
    pc: Optional[str] = None            # position number
    code: Optional[str] = None          # OTSKP/HSV/PSV code
    description: str = ""
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None


class SectionOutline(BaseModel):
    number: str = ""
    title: str = ""
    page: Optional[int] = None


class ExtractedData(BaseModel):
    """Complete extraction result from Layer 3 (regex) + Layer 4 (AI)."""
    identification: IdentificationData = Field(default_factory=IdentificationData)
    norms: List[NormReference] = Field(default_factory=list)
    facts: List[ExtractedFact] = Field(default_factory=list)
    risks: List[RiskItem] = Field(default_factory=list)
    quantities: List[QuantityItem] = Field(default_factory=list)
    sections_outline: List[SectionOutline] = Field(default_factory=list)
    materials: List[str] = Field(default_factory=list)
    equipment: List[str] = Field(default_factory=list)
    cross_references: List[str] = Field(default_factory=list)  # mentions of other docs


# ═══════════════════════════════════════════════════════════
#  UNIVERSAL SUMMARY (output of pipeline per document)
# ═══════════════════════════════════════════════════════════

class UniversalSummary(BaseModel):
    """Complete analysis of one document. Core output of the pipeline."""
    document_id: str = ""
    filename: str = ""
    file_hash: Optional[str] = None

    # Meta
    format: FileFormat = FileFormat.UNKNOWN
    pages: int = 0
    chars: int = 0
    has_tables: bool = False
    has_images: bool = False

    # Classification
    classification: Classification = Field(default_factory=Classification)

    # Extracted data
    identification: IdentificationData = Field(default_factory=IdentificationData)
    extracted_data: ExtractedData = Field(default_factory=ExtractedData)

    # AI summary (Layer 4)
    ai_summary: Optional[str] = None
    ai_summary_confidence: Optional[float] = None

    # Searchable text (first 5000 chars for fulltext)
    searchable_text: str = ""

    # Processing metadata
    processing_time_ms: int = 0
    layers_applied: List[str] = Field(default_factory=list)  # ["L0","L1","L2","L3","L4"]
    parser_used: str = ""
    ai_model_used: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ═══════════════════════════════════════════════════════════
#  LAYER 5: CROSS-VALIDATION
# ═══════════════════════════════════════════════════════════

class FactMatch(BaseModel):
    fact_name: str
    doc_a: str                          # filename
    doc_b: str
    value_a: Any
    value_b: Any
    status: str = "match"               # "match"|"mismatch"


class Contradiction(BaseModel):
    fact_name: str
    doc_a: str
    value_a: str
    doc_b: str
    value_b: str
    severity: ContradictionSeverity = ContradictionSeverity.WARNING
    note: Optional[str] = None


class CrossValidationResult(BaseModel):
    matches: List[FactMatch] = Field(default_factory=list)
    contradictions: List[Contradiction] = Field(default_factory=list)
    coverage_update: Dict[str, int] = Field(default_factory=dict)
    missing_documents: List[str] = Field(default_factory=list)
    version_diff: Optional[Dict[str, Any]] = None


# ═══════════════════════════════════════════════════════════
#  LAYER 6: PROJECT STATE
# ═══════════════════════════════════════════════════════════

class ProjectFact(BaseModel):
    """A single project-level fact aggregated from documents."""
    value: Any
    source_doc: str                     # filename
    confidence: float = 1.0
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProjectState(BaseModel):
    """Central knowledge store for a project. Grows with every document."""
    project_id: str = ""
    name: str = ""
    documents: List[UniversalSummary] = Field(default_factory=list)
    facts: Dict[str, ProjectFact] = Field(default_factory=dict)
    coverage_matrix: Dict[str, Dict[str, bool]] = Field(default_factory=dict)
    contradictions: List[Contradiction] = Field(default_factory=list)
    versions: Dict[str, List[str]] = Field(default_factory=dict)  # filename → [hash1, hash2]
    missing_documents: List[str] = Field(default_factory=list)
    timeline: List[Dict[str, str]] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ═══════════════════════════════════════════════════════════
#  API REQUEST / RESPONSE
# ═══════════════════════════════════════════════════════════

class AddDocumentResponse(BaseModel):
    success: bool = True
    document_id: str = ""
    filename: str = ""
    classification: Classification = Field(default_factory=Classification)
    summary: Optional[UniversalSummary] = None
    cross_validation: Optional[CrossValidationResult] = None
    project_state_snapshot: Optional[Dict[str, Any]] = None
    processing_time_ms: int = 0
    error: Optional[str] = None
