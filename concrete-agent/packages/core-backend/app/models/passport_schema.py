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

from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# =============================================================================
# ENUMS
# =============================================================================

class DocCategory(str, Enum):
    """Document type classification for Czech construction documents"""
    TZ = "TZ"   # Technická zpráva (Technical Report)
    RO = "RO"   # Rozpočet / Výkaz výměr (Bill of Quantities)
    PD = "PD"   # Podmínky (Tender Conditions)
    VY = "VY"   # Výkresy (Drawings metadata)
    SM = "SM"   # Smlouva / Návrh (Contract Draft)
    HA = "HA"   # Harmonogram (Schedule)
    GE = "GE"   # Geologie / Průzkum (Geotechnical)
    ZP = "ZP"   # Zpráva BOZP / EIA (Safety/Environmental)
    TI = "TI"   # Titulní list / Obsah (Title Page / TOC)
    OT = "OT"   # Ostatní (Other)


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


class StructureObject(BaseModel):
    """
    Sub-object within a project (e.g., a single bridge in a multi-bridge highway project).

    For a project like "D35 Highway" with 5 bridges, each bridge becomes a StructureObject.
    """
    object_code: str = Field(..., description="Object code, e.g. SO-201, SO 202")
    object_name: str = Field("", description="Object name, e.g. 'Most přes Chrudimku km 15.2'")
    structure_type: Optional[StructureType] = Field(None, description="Type of this structure")

    # Key dimensions for this specific object
    span_description: Optional[str] = Field(None, description="Span layout, e.g. '3×25m' or '1×42m'")
    total_length_m: Optional[float] = Field(None, description="Total length in meters")
    width_m: Optional[float] = Field(None, description="Width in meters")
    height_m: Optional[float] = Field(None, description="Height / clearance in meters")

    # Concrete and reinforcement for this object
    concrete_specifications: List[ConcreteSpecification] = Field(
        default_factory=list,
        description="Concrete classes for this specific object"
    )
    concrete_volume_m3: Optional[float] = Field(None, description="Total concrete volume for this object")
    reinforcement_tons: Optional[float] = Field(None, description="Total reinforcement for this object")
    formwork_m2: Optional[float] = Field(None, description="Total formwork area for this object")

    # Timeline
    duration_months: Optional[int] = Field(None, description="Construction duration for this object")
    budget_czk: Optional[float] = Field(None, description="Estimated budget for this object")

    # AI-generated summary
    summary: Optional[str] = Field(None, description="Short AI-generated description of this object")
    drawing_reference: Optional[str] = Field(None, description="Reference to associated drawing file")

    confidence: float = Field(0.7, description="Extraction confidence")


# =============================================================================
# V3: BRIDGE SO PARAMS (ČSN 73 6200)
# =============================================================================

class BridgeSOParams(BaseModel):
    """
    v3: Detailed bridge parameters matching ČSN 73 6200 Odst. 4 and 5 structure.
    Populated from dílčí TZ, výkresy, and GTP with source tracking.
    """

    # ── Odst. 4: Classification ──
    csn_4_1: Optional[str] = Field(None, description="4.1 druh převáděné komunikace")
    csn_4_2: Optional[str] = Field(None, description="4.2 překážka (potok, údolí, ...)")
    csn_4_3: Optional[str] = Field(None, description="4.3 počet polí (jedno/vícepolový)")
    csn_4_6: Optional[str] = Field(None, description="4.6 s/bez přesypávky")
    csn_4_12: Optional[str] = Field(None, description="4.12 materiál (předpjatý/železobeton)")
    csn_4_14: Optional[str] = Field(None, description="4.14 integrální/s ložisky")

    # ── Odst. 5: Dimensions ──
    light_span_m: Optional[float] = Field(None, description="5.3 světlost mostního otvoru [m]")
    span_m: Optional[float] = Field(None, description="5.4 rozpětí mostních polí [m]")
    span_config: Optional[str] = Field(None, description="rozpětí multi-span, e.g. '17+25+17 = 59 m'")
    nk_length_m: Optional[float] = Field(None, description="5.7 délka nosné konstrukce [m]")
    nk_area_m2: Optional[float] = Field(None, description="plocha NK [m²]")
    bridge_length_m: Optional[float] = Field(None, description="5.9 délka mostu [m]")
    bridge_width_m: Optional[float] = Field(None, description="5.13 šířka mostu [m]")
    free_width_m: Optional[float] = Field(None, description="5.14 volná šířka [m]")
    width_between_railings_m: Optional[float] = Field(None, description="5.16 šířka mezi zábradlím [m]")
    bridge_height_m: Optional[float] = Field(None, description="5.19 výška mostu [m]")
    structural_height_m: Optional[float] = Field(None, description="5.20 stavební výška [m]")
    construction_height: Optional[str] = Field(None, description="5.21 konstrukční výška, e.g. '1.4m nosník + 0.22m deska'")
    clearance_under_m: Optional[float] = Field(None, description="5.23 volná výška pod mostem [m]")
    crossing_angle_deg: Optional[int] = Field(None, description="5.11 úhel křížení [°]")
    skewness_deg: Optional[int] = Field(None, description="5.12 šikmost [°]")
    load_class: Optional[str] = Field(None, description="5.28 zatížení (ČSN EN 1991-2)")

    # ── NK (nosná konstrukce) ──
    nk_type: Optional[str] = Field(None, description="typ NK (prefab nosníky + spřažená deska, ...)")
    beam_count: Optional[int] = Field(None, description="počet nosníků")
    beam_spacing_mm: Optional[int] = Field(None, description="osová vzdálenost nosníků [mm]")
    slab_thickness_mm: Optional[int] = Field(None, description="tloušťka spřažené desky [mm]")
    hard_protection_mm: Optional[int] = Field(None, description="tvrdá ochrana izolace [mm]")
    transverse_slope_pct: Optional[float] = Field(None, description="příčný sklon [%]")
    longitudinal_slope_pct: Optional[float] = Field(None, description="podélný sklon [%]")

    # ── Foundation ──
    foundation_type: Optional[str] = Field(None, description="hlubinné/plošné/piloty")
    pile_diameter_mm: Optional[int] = Field(None, description="průměr pilot [mm]")
    pile_length_m: Optional[float] = Field(None, description="délka pilot [m]")
    pile_change_note: Optional[str] = Field(None, description="změna oproti DSP, e.g. 'zkráceny o 2m'")

    # ── Concrete ──
    concrete_nk: Optional[str] = Field(None, description="beton NK: C30/37-XF2,XD1,XC4")
    concrete_substructure: Optional[str] = Field(None, description="beton spodní stavby")
    concrete_protection: Optional[str] = Field(None, description="beton tvrdé ochrany")
    concrete_foundation: Optional[str] = Field(None, description="podkladní beton: C12/15-X0")
    cover_mm: Optional[str] = Field(None, description="krytí výztuže, e.g. '45/55 mm'")
    reinforcement: Optional[str] = Field(None, description="výztuž: B500B dle ČSN EN 10027-1")

    # ── Deformace ──
    settlement_abutment_1_mm: Optional[float] = Field(None, description="sedání opěra 1 [mm]")
    settlement_abutment_2_mm: Optional[float] = Field(None, description="sedání opěra 2 [mm]")
    deflection_span_mm: Optional[float] = Field(None, description="průhyb pole [mm]")
    consolidation_95pct_days: Optional[int] = Field(None, description="konsolidace 95% [dny]")

    # ── PKO (protikorozní ochrana) ──
    pko_aggressivity: Optional[str] = Field(None, description="korozní agresivita: C4, C5")
    pko_lifetime: Optional[str] = Field(None, description="životnost PKO: V")
    stray_current_protection: Optional[int] = Field(None, description="stupeň ochrany bludnými proudy")

    # ── Geotechnické údaje (z GTP) ──
    gtp_boreholes: List[str] = Field(default_factory=list, description="ID vrtů: J516, J517, ...")
    groundwater_level_m: Optional[str] = Field(None, description="HPV: '1.15-1.79 m'")
    water_aggressivity: Optional[str] = Field(None, description="agresivita vody: XA2")
    geotechnical_category: Optional[int] = Field(None, description="geotechnická kategorie")
    foundation_soils: List[str] = Field(default_factory=list, description="zeminy: P1a, P1c, P2")

    # ── Related SOs ──
    related_sos: List[str] = Field(default_factory=list, description="SO 020, SO 101, SO 323, ...")

    # ── Crossing info ──
    obstacle_crossed: Optional[str] = Field(None, description="bezejmenný potok, biokoridor")
    road_on_bridge: Optional[str] = Field(None, description="SO 101, S9,5/90")
    chainage_km: Optional[float] = Field(None, description="staničení: 2.710")
    crossing_point_jtsk: Optional[str] = Field(None, description="JTSK: Y=788614; X=1114445")

    # ── Source tracking ──
    sources: Dict[str, str] = Field(
        default_factory=dict,
        description="Per-field source: {'bridge_length_m': 'dilci_TZ_p4', 'groundwater': 'GTP_p3'}"
    )


# =============================================================================
# V3: GTP EXTRACTION (Geotechnický pasport)
# =============================================================================

class SoilLayer(BaseModel):
    """One layer in a borehole profile."""
    depth_from_m: float
    depth_to_m: float
    soil_type_code: str = Field(..., description="Q2p, P1a, P1c")
    csn_class: Optional[str] = Field(None, description="F3/MS, R6/CS")
    description: Optional[str] = None
    consistency: Optional[str] = Field(None, description="tuhá, pevná, ...")


class BoreholeData(BaseModel):
    """One borehole from GTP / IGP."""
    borehole_id: str = Field(..., description="J516, JV125, ...")
    coordinates_jtsk: Optional[str] = None
    elevation_bpv: Optional[float] = Field(None, description="nadmořská výška Bpv [m]")
    depth_m: float = Field(..., description="hloubka vrtu [m]")
    date: Optional[str] = None
    layers: List[SoilLayer] = Field(default_factory=list)


class SoilType(BaseModel):
    """Geotechnický typ zeminy z tabulky GTP."""
    code: str = Field(..., description="H, Q2p, P1a, ...")
    description: Optional[str] = None
    depth_range: Optional[str] = None
    edef_mpa: Optional[float] = Field(None, description="modul přetvárnosti [MPa]")
    phi_deg: Optional[float] = Field(None, description="úhel vnitřního tření [°]")
    c_kpa: Optional[float] = Field(None, description="soudržnost [kPa]")
    rp_mpa: Optional[float] = Field(None, description="únosnost [MPa]")
    permeability: Optional[str] = None


class GTPExtraction(BaseModel):
    """Extracted from geotechnický pasport (GTP) / IGP."""

    # Boreholes
    boreholes: List[BoreholeData] = Field(default_factory=list)

    # Soil types summary table
    soil_types: List[SoilType] = Field(default_factory=list)

    # Groundwater
    groundwater_levels: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="{'J516': {'narazena': 1.80, 'ustalena': 1.15}, ...}"
    )

    # Aggressivity
    water_aggressivity: Optional[str] = Field(None, description="XA2")
    aggressivity_details: Dict[str, Any] = Field(
        default_factory=dict,
        description="{'SO4': 58.8, 'pH': 6.16, 'CO2_agr': 34}"
    )

    # Stray currents
    stray_current_class: Optional[int] = Field(None, description="stupeň 1-4")

    # Recommendations
    foundation_recommendation: Optional[str] = None
    pile_depth_estimate: Optional[str] = Field(None, description="8-10 m")
    special_measures: List[str] = Field(default_factory=list)

    # Settlement calculations
    settlements: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="[{'location': 'za opěrou km 2,680', 'value_cm': 24.2, ...}]"
    )

    source_pages: Dict[str, int] = Field(default_factory=dict)


# =============================================================================
# V3: CONTRADICTION DETECTION
# =============================================================================

class ContradictionRecord(BaseModel):
    """Detected contradiction between documents for same SO."""
    so_code: str = Field(..., description="SO 202")
    field_name: str = Field(..., description="bridge_length_m")
    value_1: str = Field(..., description="32.0")
    source_1: str = Field(..., description="Souhrnná TZ, strana 6")
    value_2: str = Field(..., description="31.0")
    source_2: str = Field(..., description="Dílčí TZ SO 202, Odst. 5.9")
    resolution: str = Field(..., description="dilci_TZ_wins / kept_existing")
    severity: str = Field(..., description="high / medium / low")
    note: str = Field(default="", description="explanation")


# =============================================================================
# V3: SO FILE GROUPING
# =============================================================================

class SOFile(BaseModel):
    """One file within an SO group."""
    filename: str
    file_type: str = Field(..., description="TZ-D, VY-NK, GE, ...")
    pages: int = 0
    processed: bool = False
    priority: int = Field(default=99, description="1=TZ-D, 2=VY, 3=GE, 4=TZ-S, 5=RO")


class SOFileGroup(BaseModel):
    """Files automatically grouped by SO code."""
    so_code: str = Field(..., description="SO 202")
    so_name: str = Field(default="", description="Most přes potok v km 2,710")
    files: List[SOFile] = Field(default_factory=list)
    coverage: Dict[str, bool] = Field(
        default_factory=dict,
        description="{'TZ': True, 'VY': True, 'GE': False, ...}"
    )
    missing_categories: List[str] = Field(
        default_factory=list,
        description="['GE', 'HA', 'RO'] — categories without files"
    )


class MergedSO(BaseModel):
    """Result of merging multiple documents for one SO."""
    so_code: str
    so_name: str = ""
    so_category: Optional[str] = None
    so_category_label: Optional[str] = None
    structure_type: Optional[StructureType] = None
    bridge_params: Optional[BridgeSOParams] = None
    gtp: Optional[GTPExtraction] = None
    technical: Optional["TechnicalExtraction"] = None
    tender: Optional["TenderExtraction"] = None
    # v3.1: Universal SO type params (only one populated per SO)
    road_params: Optional[Dict[str, Any]] = None
    traffic_params: Optional[Dict[str, Any]] = None
    water_params: Optional[Dict[str, Any]] = None
    vegetation_params: Optional[Dict[str, Any]] = None
    electro_params: Optional[Dict[str, Any]] = None
    pipeline_params: Optional[Dict[str, Any]] = None
    signage_params: Optional[Dict[str, Any]] = None
    # v3.2: D.1.4 profession params (pozemní stavby)
    silnoproud_params: Optional[Dict[str, Any]] = None
    slaboproud_params: Optional[Dict[str, Any]] = None
    vzt_params: Optional[Dict[str, Any]] = None
    zti_params: Optional[Dict[str, Any]] = None
    ut_params: Optional[Dict[str, Any]] = None
    mar_params: Optional[Dict[str, Any]] = None
    d14_profession: Optional[str] = Field(None, description="Detected D.1.4 profession key")
    d14_profession_label: Optional[str] = Field(None, description="Czech label for D.1.4 profession")
    # v3.1.1: Enhanced classification
    construction_type: Optional[str] = Field(None, description="dopravní, mostní, pozemní_bytová, etc.")
    section_ids: List[Dict[str, str]] = Field(default_factory=list, description="Detected section IDs")
    is_non_construction: bool = Field(default=False)
    generic_summary: Optional["GenericSummary"] = None
    contradictions: List[ContradictionRecord] = Field(default_factory=list)
    sources: Dict[str, str] = Field(
        default_factory=dict,
        description="Field → source filename mapping"
    )
    file_count: int = 0
    files: List[str] = Field(default_factory=list, description="List of filenames in this SO")
    source_documents: List[str] = Field(default_factory=list)
    coverage: Dict[str, bool] = Field(
        default_factory=dict,
        description="{'TZ': True, 'VY': True, 'GE': True, 'RO': False, 'HA': False}"
    )


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

    # === SUB-OBJECTS (Bridges, Buildings, etc.) ===

    objects: List[StructureObject] = Field(
        default_factory=list,
        description="Sub-objects within the project (bridges, buildings, structures)"
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

# =============================================================================
# TYPE-SPECIFIC EXTRACTION MODELS (for classified documents)
# =============================================================================

class TechnicalExtraction(BaseModel):
    """Extracted parameters from Technical Report (TZ)"""
    project_name: Optional[str] = None
    structure_type: Optional[str] = None
    structure_subtype: Optional[str] = None
    total_length_m: Optional[float] = None
    width_m: Optional[float] = None
    height_m: Optional[float] = None
    area_m2: Optional[float] = None
    volume_m3: Optional[float] = None
    span_count: Optional[int] = None
    span_lengths_m: List[float] = Field(default_factory=list)
    concrete_grade: Optional[str] = None
    reinforcement_grade: Optional[str] = None
    foundation_type: Optional[str] = None
    fabrication_method: Optional[str] = None
    load_class: Optional[str] = None
    design_life_years: Optional[int] = None
    applicable_standards: List[str] = Field(default_factory=list)
    construction_duration_months: Optional[int] = None
    special_conditions: List[str] = Field(default_factory=list)
    source_pages: Dict[str, int] = Field(default_factory=dict)


class BillOfQuantitiesExtraction(BaseModel):
    """Extracted parameters from Rozpočet / Výkaz výměr (RO)"""
    total_items: int = 0
    total_price_czk: Optional[float] = None
    categories: List[Dict[str, Any]] = Field(default_factory=list)
    key_materials: List[Dict[str, Any]] = Field(default_factory=list)
    concrete_volume_m3: Optional[float] = None
    steel_tonnage_t: Optional[float] = None
    earthwork_volume_m3: Optional[float] = None
    source_pages: Dict[str, int] = Field(default_factory=dict)


class TenderConditionsExtraction(BaseModel):
    """Backward-compatible extraction from Tender Conditions (PD).
    For full extraction use TenderExtraction (v3)."""
    tender_name: Optional[str] = None
    contracting_authority: Optional[str] = None
    submission_deadline: Optional[str] = None
    question_deadline: Optional[str] = None
    estimated_budget: Optional[float] = None
    currency: str = "CZK"
    required_documents: List[str] = Field(default_factory=list)
    qualification_criteria: List[str] = Field(default_factory=list)
    evaluation_criteria: List[Dict[str, Any]] = Field(default_factory=list)
    submission_method: Optional[str] = None
    source_pages: Dict[str, int] = Field(default_factory=dict)


# =============================================================================
# V3: FULL TENDER EXTRACTION (PD — Zadávací dokumentace)
# =============================================================================

class PersonnelRequirement(BaseModel):
    """Required team member for the tender."""
    role: str = Field(..., description="Hlavní stavbyvedoucí")
    role_code: Optional[str] = Field(None, description="4.4a")
    experience_years: Optional[int] = None
    reference_description: str = Field(default="", description="řízení stavby silnice min 600 mil CZK")
    reference_min_value_czk: Optional[Decimal] = None
    authorization_required: Optional[str] = Field(None, description="autorizovaný inženýr, obor dopravní stavby")
    authorization_law: Optional[str] = Field(None, description="zákon 360/1992 Sb.")
    proof_documents: List[str] = Field(default_factory=list)


class ReferenceRequirement(BaseModel):
    """Required reference project for qualification."""
    reference_code: str = Field(default="", description="4.5.1a")
    description: str = Field(default="", description="novostavba/rekonstrukce silnice I.třídy")
    min_value_czk: Optional[Decimal] = None
    min_volume: Optional[str] = Field(None, description="430 tis m³ zemních prací")
    completed_period: Optional[str] = Field(None, description="posledních 10 let")
    proof_type: str = Field(default="", description="osvědčení objednatele")
    specific_conditions: List[str] = Field(default_factory=list)


class EquipmentRequirement(BaseModel):
    """Required equipment/facility for the tender."""
    description: str = Field(..., description="obalovna asfaltových směsí")
    min_capacity: Optional[str] = Field(None, description="120 t/hod")
    ownership: str = Field(default="", description="vlastnictví nebo smluvní zajištění")
    conditions: List[str] = Field(default_factory=list)


class EvaluationCriterion(BaseModel):
    """One evaluation criterion."""
    name: str = Field(..., description="Nabídková cena stavby v Kč bez DPH")
    weight_pct: float = Field(..., description="90.0")
    direction: str = Field(default="lower_better", description="lower_better | higher_better")
    min_value: Optional[float] = Field(None, description="60 měsíců min")
    max_scored_value: Optional[float] = Field(None, description="84 měsíců max for full score")
    unit: Optional[str] = Field(None, description="měsíců")
    formula: Optional[str] = Field(None, description="100 × (nejnižší cena / hodnocená cena)")
    disqualification_threshold: Optional[str] = Field(None, description="< 60 = nesplnění")


class TenderAttachment(BaseModel):
    """One attachment to the tender documentation."""
    number: int
    name: str
    description: Optional[str] = None
    is_form: bool = False
    is_contract: bool = False
    is_technical: bool = False


class TenderExtraction(BaseModel):
    """
    Complete extraction from Zadávací dokumentace (PD).
    v3: Every field is CRITICAL — missing one = disqualification risk.
    Based on ZZVZ (zákon 134/2016 Sb.) structure.
    """

    # ── 1. IDENTIFICATION ──
    tender_name: str = Field(default="", description="I/20 Hněvkov - Sedlice")
    tender_number: str = Field(default="", description="05PT-003052")
    evidence_number: Optional[str] = Field(None, description="ISPROFIN: 327 111 2015")
    procedure_type: str = Field(default="", description="otevřené řízení § 56 ZZVZ")

    contracting_authority: str = Field(default="", description="ŘSD s.p.")
    authority_address: str = Field(default="")
    authority_ico: str = Field(default="", description="65993390")
    authority_branch: Optional[str] = None
    contact_person: str = Field(default="")
    contact_phone: Optional[str] = None
    data_box: Optional[str] = Field(None, description="datová schránka: zjq4rhz")

    designer: Optional[str] = Field(None, description="projektant PD: Valbek, spol. s r.o.")
    contract_type: Optional[str] = Field(None, description="FIDIC Red Book")

    # ── 2. SUBJECT & VALUE ──
    estimated_value_czk: Optional[Decimal] = Field(None, description="1279250000")
    estimated_value_note: Optional[str] = None
    currency: str = "CZK"
    vat_note: str = "bez DPH"

    # ── 3. SITE INSPECTION ──
    site_inspection_organized: bool = False
    site_inspection_note: Optional[str] = None

    # ── 4. QUALIFICATION REQUIREMENTS ──
    basic_eligibility: List[str] = Field(default_factory=list, description="§74 ZZVZ")
    professional_eligibility: List[str] = Field(default_factory=list, description="§77 ZZVZ")

    # 4.3 Economic
    min_annual_turnover_czk: Optional[Decimal] = Field(None, description="400000000")
    turnover_period: Optional[str] = Field(None, description="poslední 3 uzavřená účetní období")
    turnover_note: Optional[str] = None

    # 4.4 Personnel
    required_personnel: List[PersonnelRequirement] = Field(default_factory=list)

    # 4.5 References
    required_references: List[ReferenceRequirement] = Field(default_factory=list)

    # 4.6 Equipment
    required_equipment: List[EquipmentRequirement] = Field(default_factory=list)

    # ── 5. SUBSTITUTION RULES ──
    can_substitute_with_declaration: bool = False
    jeoo_accepted: bool = True

    # ── 6. PRICING ──
    pricing_method: Optional[str] = Field(None, description="jednotkové ceny v soupisu prací")
    price_includes: Optional[str] = None

    # ── 7. EVALUATION CRITERIA ──
    evaluation_criteria: List[EvaluationCriterion] = Field(default_factory=list)

    # ── 8-9. SUBMISSION ──
    submission_method: str = Field(default="", description="elektronicky")
    electronic_tool: str = Field(default="", description="Tender arena (eGORDION)")
    tender_profile_url: Optional[str] = None
    submission_deadline: Optional[str] = Field(None, description="'na profilu zadavatele' or actual date")
    max_file_size_mb: Optional[int] = None
    qualification_size_mb: Optional[int] = None
    other_docs_size_mb: Optional[int] = None
    accepted_formats: List[str] = Field(default_factory=list)
    paper_submission_allowed: bool = False

    # ── 10. OPENING ──
    opening_method: Optional[str] = None

    # ── 11. ZADÁVACÍ LHŮTA ──
    binding_period_months: Optional[int] = None

    # ── 12. JISTOTA ──
    jistota_required: bool = False
    jistota_amount_czk: Optional[Decimal] = None
    jistota_forms: List[str] = Field(default_factory=list)
    jistota_bank_account: Optional[str] = None
    jistota_variable_symbol: Optional[str] = None
    jistota_must_be_original: bool = True

    # ── 13. RESERVATIONS ──
    variants_allowed: bool = False
    one_bid_only: bool = True

    # ── 14. SUBCONTRACTING ──
    subcontracting_limit: Optional[str] = None
    own_capacity_required: List[str] = Field(default_factory=list)
    subcontractor_identification_deadline: Optional[str] = None

    # ── 15. ATTACHMENTS ──
    attachments: List[TenderAttachment] = Field(default_factory=list)

    # ── CALCULATED / DERIVED ──
    submission_deadline_parsed: Optional[datetime] = None
    days_until_submission: Optional[int] = None

    # ── RISK FLAGS ──
    risk_flags: List[str] = Field(default_factory=list)

    source_pages: Dict[str, int] = Field(default_factory=dict)


class ScheduleExtraction(BaseModel):
    """Extracted from Harmonogram (HA)"""
    total_duration_months: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    phases: List[Dict[str, Any]] = Field(default_factory=list)
    milestones: List[Dict[str, Any]] = Field(default_factory=list)
    critical_path: List[str] = Field(default_factory=list)
    source_pages: Dict[str, int] = Field(default_factory=dict)


# =============================================================================
# V3.1.1: NON-CONSTRUCTION DOCUMENT SUMMARY
# =============================================================================

class GenericSummary(BaseModel):
    """
    Summary for non-construction documents (legal, invoices, etc.).
    Used when document doesn't match any construction schema.
    """
    document_type: str = Field(default="unknown", description="Detected type: legal, invoice, correspondence, other")
    title: Optional[str] = None
    summary: Optional[str] = Field(None, description="Brief AI-generated summary (2-3 sentences)")
    key_entities: List[str] = Field(default_factory=list, description="Named entities: people, companies, dates")
    dates_found: List[str] = Field(default_factory=list, description="Dates mentioned in document")
    amounts_found: List[str] = Field(default_factory=list, description="Monetary amounts found")
    language: str = Field(default="cs", description="Detected language")
    page_count: Optional[int] = None
    confidence: float = Field(default=0.5, description="Classification confidence")


# Resolve forward references after TenderExtraction is defined
MergedSO.model_rebuild()


# =============================================================================
# V3: DOCUMENT SUB-TYPE CLASSIFICATION
# =============================================================================

class DocSubType(str, Enum):
    """Fine-grained document sub-type for multi-doc merge priority."""
    TZ_S = "TZ-S"       # Souhrnná TZ (overview, lowest detail)
    TZ_D = "TZ-D"       # Dílčí TZ per SO (highest detail, ČSN structured)
    VY_SIT = "VY-SIT"   # Situace (layout/plan)
    VY_POD = "VY-POD"   # Podélný řez (longitudinal section)
    VY_PRI = "VY-PRI"   # Příčné řezy (cross sections)
    VY_VYT = "VY-VYT"   # Vytyčovací výkres (setting-out)
    VY_OPE = "VY-OPE"   # Tvar opěr a křídel (abutment/wing shapes)
    VY_NK = "VY-NK"     # Tvar nosné konstrukce (superstructure)
    VY_PRE = "VY-PRE"   # Přechodové oblasti (transition zones)
    VY_ARM = "VY-ARM"   # Výztuž (reinforcement drawings)
    VY_VYB = "VY-VYB"   # Vybavení mostu (bridge equipment)
    VY_GEN = "VY-GEN"   # Generic drawing
    GE_GTP = "GE-GTP"   # Geotechnický pasport
    GE_IGP = "GE-IGP"   # Inženýrsko-geologický průzkum
    RO_SOD = "RO-SOD"   # Soupis prací (itemized)
    RO_REC = "RO-REC"   # Rekapitulace (summary)
    PD_ZD = "PD-ZD"     # Zadávací dokumentace
    PD_KP = "PD-KP"     # Kvalifikační podmínky
    HA_GEN = "HA-GEN"   # Generic schedule
    SM_SOD = "SM-SOD"   # Smlouva o dílo
    OT_GEN = "OT-GEN"   # Other


class ClassificationInfo(BaseModel):
    """Document classification result attached to response"""
    category: DocCategory = DocCategory.OT
    sub_type: Optional[DocSubType] = Field(None, description="Fine-grained sub-type for merge priority")
    confidence: float = 0.0
    method: str = "none"  # "filename", "keywords", "ai"
    detected_keywords: List[str] = Field(default_factory=list)
    so_code: Optional[str] = Field(None, description="SO code extracted from filename, e.g. 'SO 202'")
    priority: int = Field(default=99, description="Merge priority: 1=TZ-D, 2=VY, 3=GE, 4=TZ-S, 5=RO")


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


class PassportMetadata(BaseModel):
    """Processing metadata returned with passport response"""
    file_name: str = Field("", description="Original file name")
    processing_time_seconds: float = Field(0.0, description="Total processing time in seconds")
    parser_used: str = Field("SmartParser", description="Parser used for document")
    extraction_method: str = Field("Regex + AI", description="Extraction method")
    ai_model_used: Optional[str] = Field(None, description="AI model used for enrichment")
    total_confidence: float = Field(0.0, description="Average confidence across all fields")


class PassportStatistics(BaseModel):
    """Numerical statistics about the generated passport"""
    total_concrete_m3: float = Field(0.0, description="Total concrete volume in m³")
    total_reinforcement_t: float = Field(0.0, description="Total reinforcement mass in tons")
    unique_concrete_classes: int = Field(0, description="Number of unique concrete classes")
    unique_steel_grades: int = Field(0, description="Number of unique steel grades")
    deterministic_fields: int = Field(0, description="Fields extracted with confidence=1.0 (regex)")
    ai_enriched_fields: int = Field(0, description="Fields enriched by AI (confidence<1.0)")


class PassportGenerationResponse(BaseModel):
    """Response from passport generation"""
    success: bool = Field(..., description="Generation success")
    passport: Optional[ProjectPassport] = Field(None, description="Generated passport")
    error: Optional[str] = Field(None, description="Error message if failed")

    processing_time_ms: int = Field(..., description="Total processing time")
    metadata: Optional[PassportMetadata] = Field(None, description="Processing metadata")
    statistics: Optional[PassportStatistics] = Field(None, description="Passport statistics")

    # Document classification (new)
    classification: Optional[ClassificationInfo] = Field(None, description="Document type classification")

    # Type-specific extractions (populated based on classification)
    technical: Optional[TechnicalExtraction] = Field(None, description="TZ extraction")
    bill_of_quantities: Optional[BillOfQuantitiesExtraction] = Field(None, description="RO extraction")
    tender_conditions: Optional[TenderConditionsExtraction] = Field(None, description="PD basic extraction")
    schedule: Optional[ScheduleExtraction] = Field(None, description="HA extraction")

    # v3: Full extractions
    tender: Optional[TenderExtraction] = Field(None, description="PD full tender extraction (v3)")
    gtp: Optional[GTPExtraction] = Field(None, description="GE geotechnical extraction (v3)")
    bridge_params: Optional[BridgeSOParams] = Field(None, description="Bridge ČSN 73 6200 params (v3)")

    # v3: Multi-document merge results
    merged_sos: List[MergedSO] = Field(default_factory=list, description="Merged SO cards (v3)")
    contradictions: List[ContradictionRecord] = Field(default_factory=list, description="Cross-doc contradictions (v3)")
    file_groups: List[SOFileGroup] = Field(default_factory=list, description="File→SO grouping (v3)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "passport": {"passport_id": "passport_12345"},
                "processing_time_ms": 4500,
                "metadata": {
                    "file_name": "technicka_zprava.pdf",
                    "processing_time_seconds": 4.5,
                    "parser_used": "SmartParser",
                    "ai_model_used": "gemini",
                    "total_confidence": 0.85
                },
                "statistics": {
                    "total_concrete_m3": 1250.5,
                    "total_reinforcement_t": 85.3,
                    "unique_concrete_classes": 3,
                    "unique_steel_grades": 2,
                    "deterministic_fields": 12,
                    "ai_enriched_fields": 5
                }
            }
        }
    )
