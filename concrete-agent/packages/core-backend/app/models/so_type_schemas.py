"""
SO Type-Specific Schemas — v3.1 Universal Parser Expansion

Covers all Czech construction SO (Stavební Objekt) categories:
- 0xx: Preparation (příprava staveniště)
- 1xx: Roads (pozemní komunikace)
- 2xx: Bridges (mosty) — already in passport_schema.py as BridgeSOParams
- 3xx: Water infrastructure (vodohospodářské)
- 4xx: Electrical (elektro a sdělovací)
- 5xx: Pipelines (trubní vedení)
- 8xx: Vegetation (úprava území)
- Special: DIO (180), Signage (190)

Based on real documents from I/20 Hněvkov–Sedlice project.

Author: STAVAGENT Team
Version: 3.1.0
Date: 2026-03-26
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# =============================================================================
# SO TYPE REGISTRY — Auto-detection by SO number
# =============================================================================

SO_TYPE_REGISTRY = {
    # Řada 000: Příprava staveniště
    (0, 100): {
        "category": "příprava",
        "params_key": "preparation_params",
        "label_cz": "Objekty přípravy staveniště",
    },
    # Řada 100: Pozemní komunikace
    (100, 200): {
        "category": "komunikace",
        "params_key": "road_params",
        "label_cz": "Objekty pozemních komunikací",
    },
    # Řada 200: Mostní objekty a zdi
    (200, 300): {
        "category": "mosty",
        "params_key": "bridge_params",
        "label_cz": "Mostní objekty a zdi",
    },
    # Řada 300: Vodohospodářské objekty
    (300, 400): {
        "category": "vodohospodářské",
        "params_key": "water_params",
        "label_cz": "Vodohospodářské objekty",
    },
    # Řada 400: Elektro a sdělovací objekty
    (400, 500): {
        "category": "elektro",
        "params_key": "electro_params",
        "label_cz": "Elektro a sdělovací objekty",
    },
    # Řada 500: Objekty trubních vedení
    (500, 600): {
        "category": "trubní_vedení",
        "params_key": "pipeline_params",
        "label_cz": "Objekty trubních vedení",
    },
    # Řada 800: Objekty úpravy území
    (800, 900): {
        "category": "úprava_území",
        "params_key": "vegetation_params",
        "label_cz": "Objekty úpravy území",
    },
}

# Special overrides (SO 180 is in 100-range but NOT a road)
SO_TYPE_OVERRIDES: Dict[int, str] = {
    180: "traffic_params",
    190: "signage_params",
}


def detect_so_params_key(so_code: str) -> str:
    """Detect the params_key for a given SO code string like 'SO 341'."""
    import re
    match = re.search(r"(\d{3})", so_code)
    if not match:
        return "technical"

    so_num = int(match.group(1))

    # Check overrides first
    if so_num in SO_TYPE_OVERRIDES:
        return SO_TYPE_OVERRIDES[so_num]

    # Range-based detection
    for (lo, hi), config in SO_TYPE_REGISTRY.items():
        if lo <= so_num < hi:
            return config["params_key"]

    return "technical"


def get_so_category_label(so_code: str) -> str:
    """Get Czech label for SO category."""
    import re
    match = re.search(r"(\d{3})", so_code)
    if not match:
        return "Ostatní"

    so_num = int(match.group(1))

    if so_num in SO_TYPE_OVERRIDES:
        if so_num == 180:
            return "Dopravně inženýrská opatření"
        if so_num == 190:
            return "Dopravní značení"

    for (lo, hi), config in SO_TYPE_REGISTRY.items():
        if lo <= so_num < hi:
            return config["label_cz"]

    return "Ostatní"


# =============================================================================
# 1. RoadSOParams — Pozemní komunikace (SO 1xx)
# =============================================================================

class RoadSOParams(BaseModel):
    """Parameters for road construction objects (SO 1xx)."""

    # ── Identification ──
    road_designation: Optional[str] = None
    road_class: Optional[int] = None
    road_category: Optional[str] = None
    road_type: Optional[str] = None
    road_length_m: Optional[float] = None
    chainage_start: Optional[str] = None
    chainage_end: Optional[str] = None
    crossing_chainage_main: Optional[float] = None

    # ── Směrové poměry (Alignment) ──
    alignment_type: Optional[str] = None
    curve_radius_m: Optional[float] = None
    has_transition_curves: Optional[bool] = None

    # ── Výškové poměry (Vertical) ──
    vertical_description: Optional[str] = None
    max_gradient_pct: Optional[float] = None

    # ── Příčný profil (Cross-section) ──
    cross_slope_pct: Optional[float] = None
    cross_slope_type: Optional[str] = None
    lane_width_m: Optional[float] = None
    lane_count: Optional[int] = None
    shoulder_paved_m: Optional[float] = None
    shoulder_unpaved_m: Optional[float] = None
    shoulder_slope_pct: Optional[float] = None
    shoulder_surface: Optional[str] = None

    # ── Konstrukce vozovky (Pavement structure) ──
    pavement_catalog: Optional[str] = None
    traffic_load_class: Optional[str] = None
    design_damage_level: Optional[str] = None
    surface_type: Optional[str] = None
    pavement_layers: List[str] = Field(default_factory=list)

    # ── Aktivní zóna ──
    active_zone_thickness_m: Optional[float] = None
    active_zone_standard: Optional[str] = None
    active_zone_compaction: Optional[str] = None
    min_cbr_pct: Optional[float] = None
    min_density_kg_m3: Optional[float] = None

    # ── Zemní těleso ──
    earthwork_type: Optional[str] = None
    embankment_slope: Optional[str] = None
    cut_slope: Optional[str] = None
    humus_layer_m: Optional[float] = None

    # ── Sanace ──
    has_sanation: Optional[bool] = None
    sanation_type: Optional[str] = None
    sanation_first_layer: Optional[str] = None
    consolidation_days: Optional[int] = None

    # ── Bezpečnostní zařízení ──
    has_guardrails: Optional[bool] = None
    guardrail_type: Optional[str] = None
    guardrail_standard: Optional[str] = None
    direction_posts: Optional[str] = None

    # ── Odvodnění ──
    drainage_method: Optional[str] = None
    drainage_destination: Optional[str] = None

    # ── Křižovatky a sjezdy ──
    intersections: List[Dict[str, str]] = Field(default_factory=list)
    driveways: List[Dict[str, str]] = Field(default_factory=list)

    # ── Vegetační úpravy (odkaz) ──
    vegetation_humus_mm: Optional[int] = None
    vegetation_seed_type: Optional[str] = None
    vegetation_so_ref: Optional[str] = None

    # ── Kubatury (from kubaturový list) ──
    volume_cut_m3: Optional[float] = None
    volume_fill_m3: Optional[float] = None
    volume_active_zone_m3: Optional[float] = None
    volume_aggregate_m3: Optional[float] = None

    # ── Related SOs ──
    related_sos: List[str] = Field(default_factory=list)
    future_owner: Optional[str] = None
    future_administrator: Optional[str] = None

    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 2. TrafficDIOParams — Dopravně inženýrská opatření (SO 180)
# =============================================================================

class ConstructionPhase(BaseModel):
    """One phase of the construction timeline."""
    phase_number: int
    name: Optional[str] = None
    duration_weeks: Optional[int] = None
    description: Optional[str] = None
    sos_in_phase: List[str] = Field(default_factory=list)
    traffic_restrictions: List[str] = Field(default_factory=list)
    key_activities: List[str] = Field(default_factory=list)


class RoadClosure(BaseModel):
    """Road closure during construction."""
    road: str
    closure_type: str
    reason: str
    phase: int
    duration_description: Optional[str] = None


class DetourRoute(BaseModel):
    """Detour route for closed road."""
    for_road: str
    route_description: str
    roads_used: List[str] = Field(default_factory=list)


class TrafficDIOParams(BaseModel):
    """Traffic engineering measures — construction phasing and detours (SO 180)."""

    total_duration_weeks: Optional[int] = None
    phases: List[ConstructionPhase] = Field(default_factory=list)

    dio_standard: Optional[str] = None
    sign_standards: List[str] = Field(default_factory=list)
    ppk_references: List[str] = Field(default_factory=list)

    closures: List[RoadClosure] = Field(default_factory=list)
    detours: List[DetourRoute] = Field(default_factory=list)

    bus_impact: Optional[str] = None
    rail_impact: Optional[str] = None

    phase_so_mapping: Dict[str, List[str]] = Field(default_factory=dict)

    provisional_roads: List[Dict[str, Any]] = Field(default_factory=list)

    related_sos: List[str] = Field(default_factory=list)
    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 3. WaterSOParams — Vodohospodářské objekty (SO 3xx)
# =============================================================================

class WaterSOParams(BaseModel):
    """Water infrastructure: vodovod, kanalizace, odvodnění, meliorace (SO 3xx)."""

    water_type: Optional[str] = None

    # ── Pipeline parameters ──
    pipe_material: Optional[str] = None
    pipe_dn: Optional[int] = None
    pipe_pn: Optional[int] = None
    pipe_standard: Optional[str] = None
    pipe_quality: Optional[str] = None
    pipe_length_m: Optional[float] = None
    pipe_slope_permille: Optional[str] = None

    # ── Pipe protection ──
    outer_protection: Optional[str] = None
    inner_lining: Optional[str] = None
    joint_type: Optional[str] = None
    stray_current_resistance: Optional[str] = None

    # ── Chránička (casing pipe) ──
    casing_material: Optional[str] = None
    casing_dn: Optional[int] = None
    casing_length_m: Optional[float] = None
    casing_protection: Optional[str] = None
    casing_centering: Optional[str] = None
    casing_sealing: Optional[str] = None
    casing_joints_inside: Optional[str] = None
    pull_out_space_m: Optional[float] = None

    # ── Trench parameters ──
    trench_walls: Optional[str] = None
    trench_shoring: Optional[str] = None
    trench_standard: Optional[str] = None
    bedding_material: Optional[str] = None
    bedding_depth_mm: Optional[int] = None
    backfill_above_mm: Optional[int] = None
    compaction_pipe_zone: Optional[str] = None
    compaction_above_pipe: Optional[str] = None
    backfill_layer_mm: Optional[int] = None

    # ── Warning/detection ──
    detection_wire: Optional[str] = None
    warning_foil: Optional[str] = None
    markers: Optional[str] = None

    # ── Connection to existing ──
    connection_type: Optional[str] = None
    existing_pipe: Optional[str] = None

    # ── Testing requirements ──
    pressure_test: Optional[str] = None
    disinfection: Optional[bool] = None
    water_analysis: Optional[bool] = None

    # ── Crossing info ──
    crossing_km: List[str] = Field(default_factory=list)
    crossing_road: Optional[str] = None
    min_distance_from_cut_m: Optional[float] = None

    # ── Drainage specific (SO 301, 360, 380) ──
    drain_type: Optional[str] = None
    inlet_structures: List[str] = Field(default_factory=list)
    outlet_structures: List[str] = Field(default_factory=list)
    retention_volume_m3: Optional[float] = None
    oil_separator: Optional[bool] = None
    meliorace_branches: List[str] = Field(default_factory=list)

    # ── Owner/operator ──
    owner: Optional[str] = None
    operator: Optional[str] = None

    related_sos: List[str] = Field(default_factory=list)
    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 4. VegetationSOParams — Vegetační úpravy (SO 8xx)
# =============================================================================

class SeedComponent(BaseModel):
    """One species in the seed mix."""
    species_cz: str
    species_latin: Optional[str] = None
    percentage: float


class SeedMix(BaseModel):
    """Travní směs composition."""
    name: str = ""
    components: List[SeedComponent] = Field(default_factory=list)
    seed_rate_g_m2: Optional[int] = None
    purity_range: Optional[str] = None


class LawnMethod(BaseModel):
    """Lawn establishment method."""
    surface_type: str
    method: str
    seed_rate_g_m2: Optional[int] = None
    humus_layer_m: Optional[float] = None
    components: List[str] = Field(default_factory=list)


class PlantSpecies(BaseModel):
    """One species in the planting plan."""
    code: str
    latin_name: str
    czech_name: str
    total_count: int
    size_category: str


class SectionPlanting(BaseModel):
    """Species with count in one section side."""
    species_code: str
    species_name: str
    count: int
    size_category: str = ""


class VegetationSection(BaseModel):
    """Per-section (úsek) planting breakdown."""
    section_number: int
    chainage: str = ""
    left_side: List[SectionPlanting] = Field(default_factory=list)
    right_side: List[SectionPlanting] = Field(default_factory=list)
    planting_type: str = ""


class VegetationSOParams(BaseModel):
    """Vegetation and landscaping objects (SO 8xx)."""

    # ── Climate context ──
    climate_region: Optional[str] = None
    phytogeographic_zone: Optional[str] = None
    potential_vegetation: Optional[str] = None

    # ── Trávník (Lawn) ──
    lawn_area_estimate_m2: Optional[float] = None
    lawn_methods: List[LawnMethod] = Field(default_factory=list)
    lawn_seed_mix: Optional[SeedMix] = None
    lawn_care_count: Optional[int] = None
    lawn_mowing_frequency: Optional[str] = None
    watering_count: Optional[int] = None
    watering_amount_l_m2: Optional[float] = None

    # ── Výsadby — Summary ──
    total_trees: Optional[int] = None
    total_shrubs: Optional[int] = None
    tree_species: List[PlantSpecies] = Field(default_factory=list)
    shrub_species: List[PlantSpecies] = Field(default_factory=list)

    # ── Výsadby — Per section ──
    sections: List[VegetationSection] = Field(default_factory=list)

    # ── Material requirements ──
    tree_trunk_circumference_cm: Optional[str] = None
    tree_trunk_height_cm: Optional[int] = None
    tree_root_type: Optional[str] = None

    # ── Fertilization ──
    shrub_fertilizer: Optional[str] = None
    tree_fertilizer: Optional[str] = None

    # ── Protection ──
    animal_protection: Optional[str] = None
    tree_stakes: Optional[str] = None
    stake_durability_years: Optional[int] = None

    # ── Mulching ──
    mulch_material: Optional[str] = None
    mulch_thickness_cm: Optional[int] = None

    # ── Dokončovací péče ──
    tree_care_years: Optional[int] = None
    tree_care_frequency: Optional[str] = None
    shrub_watering_l: Optional[int] = None
    tree_watering_l: Optional[int] = None
    watering_total_count: Optional[int] = None

    # ── Standards ──
    standards: List[str] = Field(default_factory=list)

    greened_sos: List[str] = Field(default_factory=list)
    related_sos: List[str] = Field(default_factory=list)
    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 5. ElectroSOParams — Elektro a sdělovací (SO 4xx)
# =============================================================================

class ElectroSOParams(BaseModel):
    """Electrical and communication infrastructure (SO 4xx)."""

    electro_type: Optional[str] = None
    voltage_level: Optional[str] = None
    cable_type: Optional[str] = None
    telecom_operator: Optional[str] = None
    energy_operator: Optional[str] = None

    chainage_km: Optional[str] = None
    crossing_description: Optional[str] = None

    realized_by: Optional[str] = None
    is_separate_contract: Optional[bool] = None

    dis_type: Optional[str] = None

    related_sos: List[str] = Field(default_factory=list)
    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 6. PipelineSOParams — Trubní vedení (SO 5xx)
# =============================================================================

class PipelineSOParams(BaseModel):
    """Gas and oil pipeline relocations (SO 5xx)."""

    pipeline_type: Optional[str] = None
    pressure_class: Optional[str] = None

    pipe_dn: Optional[int] = None
    pipe_material: Optional[str] = None
    pipe_length_m: Optional[float] = None
    chainage_km: Optional[str] = None

    operator: Optional[str] = None
    realized_by: Optional[str] = None
    is_separate_contract: Optional[bool] = None
    coordination_note: Optional[str] = None

    related_sos: List[str] = Field(default_factory=list)
    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 7. SignageSOParams — Dopravní značení (SO 190)
# =============================================================================

class SignageSOParams(BaseModel):
    """Traffic signage — permanent markings after construction (SO 190)."""

    horizontal_type: Optional[str] = None
    horizontal_standard: Optional[str] = None

    sign_standards: List[str] = Field(default_factory=list)

    roads_signed: List[str] = Field(default_factory=list)

    related_sos: List[str] = Field(default_factory=list)
    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# PARAMS KEY → CLASS MAPPING
# =============================================================================

SO_PARAMS_CLASSES = {
    "road_params": RoadSOParams,
    "traffic_params": TrafficDIOParams,
    "water_params": WaterSOParams,
    "vegetation_params": VegetationSOParams,
    "electro_params": ElectroSOParams,
    "pipeline_params": PipelineSOParams,
    "signage_params": SignageSOParams,
}
