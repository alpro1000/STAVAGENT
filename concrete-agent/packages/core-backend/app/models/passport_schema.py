"""
Project Passport Schema

Complete schema for Czech construction project passport.
Combines deterministic facts (regex extracted) with AI-enriched context.

Architecture:
- Layer 2 (Regex) populates facts with confidence=1.0
- Layer 3 (Claude) enriches context with confidence=0.5-0.9
- All enrichments are marked with confidence scores

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-02-10
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# =============================================================================
# ENUMS
# =============================================================================

class ExposureClass(str, Enum):
    """ČSN EN 206 Třída prostředí (Exposure Classes)"""
    XC1 = "XC1"  # Suché nebo trvale mokré
    XC2 = "XC2"  # Mokré, zřídka suché
    XC3 = "XC3"  # Střední vlhkost
    XC4 = "XC4"  # Cyklické vlhnutí a vysychání

    XD1 = "XD1"  # Mírná vlhkost
    XD2 = "XD2"  # Mokré, zřídka suché
    XD3 = "XD3"  # Cyklické vlhnutí a vysychání

    XS1 = "XS1"  # Vzdušné prostředí s mořskou solností
    XS2 = "XS2"  # Ponořené
    XS3 = "XS3"  # Přílivové pásmo

    XF1 = "XF1"  # Střední nasycení vodou, bez rozmrazovacích solí
    XF2 = "XF2"  # Střední nasycení vodou, s rozmrazovacími solemi
    XF3 = "XF3"  # Vysoké nasycení vodou, bez rozmrazovacích solí
    XF4 = "XF4"  # Vysoké nasycení vodou, s rozmrazovacími solemi

    XA1 = "XA1"  # Slabě agresivní prostředí
    XA2 = "XA2"  # Středně agresivní prostředí
    XA3 = "XA3"  # Silně agresivní prostředí

    XM1 = "XM1"  # Mírná abraze
    XM2 = "XM2"  # Středně silná abraze
    XM3 = "XM3"  # Silná abraze


class SteelGrade(str, Enum):
    """Ocel pro výztuž (Reinforcement Steel Grades)"""
    B500A = "B500A"  # Hladká
    B500B = "B500B"  # Žebrovaná (nejběžnější)
    B500C = "B500C"  # Vysoká duktilita
    R10505 = "10 505 (R)"  # Starší označení


class ConcreteType(str, Enum):
    """Typ betonu"""
    CAST_IN_PLACE = "cast_in_place"  # Monolitický
    PRECAST = "precast"  # Prefabrikovaný
    PRESTRESSED = "prestressed"  # Předpjatý
    FIBRE_REINFORCED = "fibre_reinforced"  # Vláknový


class StructureType(str, Enum):
    """Typ konstrukce / Structure Type"""
    BUILDING = "building"  # Budova / Building
    BRIDGE = "bridge"  # Most / Bridge
    TUNNEL = "tunnel"  # Tunel / Tunnel
    FOUNDATION = "foundation"  # Základy / Foundation
    RETAINING_WALL = "retaining_wall"  # Opěrná zeď / Retaining wall
    SLAB = "slab"  # Deska / Slab
    RAILWAY = "railway"  # Železniční stavba / Railway structure
    ROAD = "road"  # Silnice / Road
    INDUSTRIAL = "industrial"  # Průmyslová stavba / Industrial facility
    RESIDENTIAL = "residential"  # Obytná stavba / Residential building
    COMMERCIAL = "commercial"  # Obchodní stavba / Commercial building
    INFRASTRUCTURE = "infrastructure"  # Infrastruktura / Infrastructure
    PARKING = "parking"  # Parkování / Parking structure
    STADIUM = "stadium"  # Stadion / Stadium
    HYDRAULIC = "hydraulic"  # Hydrotechnické dílo / Hydraulic structure
    OTHER = "other"  # Jiné / Other


class ExposedConcreteClass(str, Enum):
    """Pohledový beton (Exposed Concrete)"""
    PB1 = "PB1"  # Běžná kvalita
    PB2 = "PB2"  # Zvýšená kvalita
    PB3 = "PB3"  # Vysoká kvalita


# =============================================================================
# CORE DATA MODELS
# =============================================================================

class ConcreteSpecification(BaseModel):
    """Specification of a concrete class with exposure"""
    concrete_class: str = Field(..., description="e.g. C30/37")
    characteristic_strength: int = Field(..., description="fck in MPa (e.g. 30)")
    cube_strength: int = Field(..., description="fck,cube in MPa (e.g. 37)")
    exposure_classes: List[ExposureClass] = Field(
        default_factory=list,
        description="Environmental exposure classes"
    )
    concrete_type: Optional[ConcreteType] = Field(None, description="Type of concrete")

    # Quality requirements
    min_cement_content: Optional[int] = Field(None, description="kg/m³")
    max_water_cement_ratio: Optional[float] = Field(None, description="w/c ratio")
    consistency_class: Optional[str] = Field(None, description="e.g. S3, S4, F4")

    # Context
    raw_text: str = Field(..., description="Original text from document")
    confidence: float = Field(1.0, description="Extraction confidence (1.0 for regex)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "concrete_class": "C30/37",
                "characteristic_strength": 30,
                "cube_strength": 37,
                "exposure_classes": ["XC4", "XF1"],
                "concrete_type": "cast_in_place",
                "raw_text": "C30/37 XC4 XF1",
                "confidence": 1.0
            }
        }
    )


class ReinforcementSpecification(BaseModel):
    """Specification of reinforcement steel"""
    steel_grade: SteelGrade = Field(..., description="Grade of steel")
    diameter_mm: Optional[List[int]] = Field(None, description="Bar diameters used (mm)")
    total_mass_tons: Optional[float] = Field(None, description="Total mass in tons")

    # Context
    raw_text: str = Field(..., description="Original text from document")
    confidence: float = Field(1.0, description="Extraction confidence")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "steel_grade": "B500B",
                "diameter_mm": [10, 12, 16, 20, 25],
                "total_mass_tons": 45.5,
                "raw_text": "Betonářská výztuž B500B",
                "confidence": 1.0
            }
        }
    )


class QuantityItem(BaseModel):
    """Quantity of a specific element"""
    element_type: str = Field(..., description="e.g. Základy, Stěny, Stropy")
    description: str = Field(..., description="Element description")

    # Quantities
    volume_m3: Optional[float] = Field(None, description="Concrete volume")
    area_m2: Optional[float] = Field(None, description="Formwork/surface area")
    mass_tons: Optional[float] = Field(None, description="Reinforcement mass")
    length_m: Optional[float] = Field(None, description="Linear dimension")

    # Associated concrete
    concrete_class: Optional[str] = Field(None, description="e.g. C30/37")

    # Context
    source_section: Optional[str] = Field(None, description="Document section")
    confidence: float = Field(1.0, description="Extraction confidence")


class BuildingDimensions(BaseModel):
    """Building dimensions and layout"""
    floors_underground: Optional[int] = Field(None, description="Podzemní podlaží (PP)")
    floors_above_ground: Optional[int] = Field(None, description="Nadzemní podlaží (NP)")
    total_floors: Optional[int] = Field(None, description="Total floors")

    height_m: Optional[float] = Field(None, description="Building height")
    built_up_area_m2: Optional[float] = Field(None, description="Zastavěná plocha")
    gross_floor_area_m2: Optional[float] = Field(None, description="Celková podlažní plocha")

    confidence: float = Field(1.0, description="Extraction confidence")


class SpecialRequirement(BaseModel):
    """Special construction requirements"""
    requirement_type: str = Field(..., description="Type of requirement")
    description: str = Field(..., description="Description")
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Technical parameters"
    )

    # Examples:
    # - Bílá vana: {"watertight_class": "V8", "thickness_mm": 300}
    # - Pohledový beton: {"class": "PB2", "surface_finish": "hladký"}
    # - Vodotěsnost: {"class": "V4"}

    raw_text: str = Field(..., description="Original text")
    confidence: float = Field(..., description="Extraction confidence")


class ProjectLocation(BaseModel):
    """Project location information"""
    address: Optional[str] = Field(None, description="Street address")
    city: Optional[str] = Field(None, description="City")
    postal_code: Optional[str] = Field(None, description="PSČ")
    cadastral_area: Optional[str] = Field(None, description="Katastrální území")
    parcel_numbers: Optional[List[str]] = Field(None, description="Parcelní čísla")

    # Geographic
    latitude: Optional[float] = Field(None, description="GPS latitude")
    longitude: Optional[float] = Field(None, description="GPS longitude")

    confidence: float = Field(0.8, description="Extraction confidence")


class ProjectTimeline(BaseModel):
    """Project timeline information"""
    start_date: Optional[str] = Field(None, description="Expected start (YYYY-MM)")
    completion_date: Optional[str] = Field(None, description="Expected completion")
    duration_months: Optional[int] = Field(None, description="Total duration")

    phases: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Construction phases"
    )

    confidence: float = Field(0.6, description="Extraction confidence")


class RiskAssessment(BaseModel):
    """Identified project risks"""
    risk_category: str = Field(..., description="Category: technical/environmental/schedule/cost")
    risk_description: str = Field(..., description="Description of the risk")
    severity: str = Field(..., description="high/medium/low")
    mitigation: Optional[str] = Field(None, description="Mitigation measures")

    source_text: str = Field(..., description="Text that led to this risk")
    confidence: float = Field(..., description="AI confidence (0.5-0.9)")


class ProjectStakeholder(BaseModel):
    """Project stakeholders"""
    role: str = Field(..., description="e.g. Investor, Dodavatel, Projektant")
    name: Optional[str] = Field(None, description="Company/person name")
    contact: Optional[str] = Field(None, description="Contact information")

    confidence: float = Field(0.7, description="Extraction confidence")


# =============================================================================
# MAIN PASSPORT MODEL
# =============================================================================

class ProjectPassport(BaseModel):
    """
    Complete Project Passport

    Combines:
    - Layer 2 (Regex): Deterministic facts with confidence=1.0
    - Layer 3 (Claude): Enriched context with confidence=0.5-0.9
    """

    # Metadata
    passport_id: str = Field(..., description="Unique passport ID")
    project_name: str = Field(..., description="Project name")
    generated_at: datetime = Field(
        default_factory=datetime.now,
        description="Passport generation timestamp"
    )

    # Document source
    source_documents: List[str] = Field(
        default_factory=list,
        description="Source document filenames"
    )

    # === LAYER 2: DETERMINISTIC FACTS (Regex) ===

    # Concrete specifications
    concrete_specifications: List[ConcreteSpecification] = Field(
        default_factory=list,
        description="All concrete classes found"
    )

    # Reinforcement
    reinforcement: List[ReinforcementSpecification] = Field(
        default_factory=list,
        description="Steel specifications"
    )

    # Quantities
    quantities: List[QuantityItem] = Field(
        default_factory=list,
        description="Extracted quantities by element"
    )

    # Building dimensions
    dimensions: Optional[BuildingDimensions] = Field(
        None,
        description="Building dimensions and layout"
    )

    # Special requirements
    special_requirements: List[SpecialRequirement] = Field(
        default_factory=list,
        description="Special construction requirements"
    )

    # === LAYER 3: AI-ENRICHED CONTEXT (Claude) ===

    # Project type and structure
    structure_type: Optional[StructureType] = Field(
        None,
        description="Type of structure (AI-inferred)"
    )

    # Location
    location: Optional[ProjectLocation] = Field(
        None,
        description="Project location (AI-extracted)"
    )

    # Timeline
    timeline: Optional[ProjectTimeline] = Field(
        None,
        description="Project timeline (AI-extracted)"
    )

    # Stakeholders
    stakeholders: List[ProjectStakeholder] = Field(
        default_factory=list,
        description="Project stakeholders (AI-extracted)"
    )

    # Risks
    risks: List[RiskAssessment] = Field(
        default_factory=list,
        description="Identified risks (AI-analyzed)"
    )

    # Project description
    description: Optional[str] = Field(
        None,
        description="AI-generated project summary"
    )

    # Technical highlights
    technical_highlights: List[str] = Field(
        default_factory=list,
        description="Key technical aspects (AI-extracted)"
    )

    # === QUALITY METADATA ===

    extraction_stats: Dict[str, Any] = Field(
        default_factory=dict,
        description="Statistics about extraction quality"
    )

    processing_time_ms: Optional[int] = Field(
        None,
        description="Total processing time"
    )

    layer_breakdown: Dict[str, Any] = Field(
        default_factory=lambda: {
            "layer1_parsing": {},
            "layer2_regex": {},
            "layer3_ai": {}
        },
        description="Performance breakdown by layer"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "passport_id": "passport_12345",
                "project_name": "Polyfunkční dům Praha 5",
                "generated_at": "2026-02-10T10:30:00Z",
                "source_documents": ["technicka_zprava.pdf", "vykaz_vymur.xlsx"],
                "concrete_specifications": [
                    {
                        "concrete_class": "C30/37",
                        "characteristic_strength": 30,
                        "cube_strength": 37,
                        "exposure_classes": ["XC4", "XF1"],
                        "raw_text": "C30/37 XC4 XF1",
                        "confidence": 1.0
                    }
                ],
                "dimensions": {
                    "floors_underground": 2,
                    "floors_above_ground": 6,
                    "confidence": 1.0
                },
                "structure_type": "building",
                "extraction_stats": {
                    "concrete_classes_found": 3,
                    "quantities_extracted": 45,
                    "regex_matches": 127,
                    "ai_enrichments": 8
                }
            }
        }
    )


# =============================================================================
# API REQUEST/RESPONSE MODELS
# =============================================================================

class PassportGenerationRequest(BaseModel):
    """Request to generate a project passport"""
    project_id: str = Field(..., description="Project ID")
    file_paths: List[str] = Field(..., description="Paths to documents to process")

    # Options
    enable_ai_enrichment: bool = Field(
        True,
        description="Enable Layer 3 (Claude) enrichment"
    )
    language: str = Field("cs", description="Document language (cs/en)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "project_id": "proj_12345",
                "file_paths": ["/data/projects/proj_12345/technicka_zprava.pdf"],
                "enable_ai_enrichment": True,
                "language": "cs"
            }
        }
    )


class PassportGenerationResponse(BaseModel):
    """Response from passport generation"""
    success: bool = Field(..., description="Generation success")
    passport: Optional[ProjectPassport] = Field(None, description="Generated passport")
    error: Optional[str] = Field(None, description="Error message if failed")

    processing_time_ms: int = Field(..., description="Total processing time")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "passport": {"passport_id": "passport_12345"},
                "processing_time_ms": 4500
            }
        }
    )
