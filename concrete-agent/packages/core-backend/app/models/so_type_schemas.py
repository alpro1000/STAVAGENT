"""
SO Type-Specific Schemas — v3.2 Universal Parser Expansion

Covers all Czech construction SO (Stavební Objekt) categories:
- 0xx: Preparation (příprava staveniště)
- 1xx: Roads (pozemní komunikace)
- 2xx: Bridges (mosty) — already in passport_schema.py as BridgeSOParams
- 3xx: Water infrastructure (vodohospodářské)
- 4xx: Electrical (elektro a sdělovací)
- 5xx: Pipelines (trubní vedení)
- 8xx: Vegetation (úprava území)
- Special: DIO (180), Signage (190)

D.1.4 Professions (pozemní stavby — vyhláška 499/2006 Sb.):
- SilnoproudParams: silnoproudé elektroinstalace
- SlaboproudParams: slaboproudé systémy (SCS, PZTS, SKV, CCTV, EPS, AVT, INT)
- VZTParams: vzduchotechnika a klimatizace
- ZTIParams: zdravotechnické instalace
- UTParams: ústřední vytápění
- MaRParams: měření a regulace

Based on real documents from I/20 Hněvkov–Sedlice + ČZU Menza TC projects.

Author: STAVAGENT Team
Version: 3.2.0
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
# 8. SilnoproudParams — Silnoproudé elektroinstalace (D.1.4.xx pozemní stavby)
# =============================================================================

class PowerCircuit(BaseModel):
    """One row in the výkonová bilance table."""
    name: str
    installed_kw: Optional[float] = None
    concurrency_factor: Optional[float] = None
    concurrent_kw: Optional[float] = None


class EnvironmentZone(BaseModel):
    """External environment classification per zone (vnější vlivy)."""
    zone_name: str
    influences: Dict[str, str] = Field(default_factory=dict)
    measures: List[str] = Field(default_factory=list)


class FloorBox(BaseModel):
    """Podlahová krabice specification."""
    room: str = ""
    count: Optional[int] = None
    sockets_per_box: Optional[int] = None


class TZBConnection(BaseModel):
    """Connection to a TZB profession (VZT, ZTI, UT, etc.)."""
    profession: str
    description: str = ""


class SwitchboardInfo(BaseModel):
    """Switchboard (rozvaděč) specification."""
    designation: str
    location: Optional[str] = None
    main_breaker: Optional[str] = None
    supply_from: Optional[str] = None
    supply_cable: Optional[str] = None


class SilnoproudParams(BaseModel):
    """Silnoproudé elektroinstalace — pozemní stavby (D.1.4.xx)."""

    # ── Identification ──
    section_id: Optional[str] = None
    pd_level: Optional[str] = None
    building_name: Optional[str] = None
    building_type: Optional[str] = None
    building_area_m2: Optional[float] = None
    floors: Optional[str] = None
    location: Optional[str] = None

    # ── 1.1 Napájecí soustava ──
    voltage_3phase: Optional[str] = None
    voltage_1phase: Optional[str] = None
    voltage_dc: Optional[str] = None
    current_system: Optional[str] = None
    max_concurrent_power_kw: Optional[float] = None
    main_breaker: Optional[str] = None

    # ── Protection ──
    protection_methods: List[str] = Field(default_factory=list)
    protection_standard: Optional[str] = None

    # ── 1.2 Výkonová bilance ──
    power_balance: List[PowerCircuit] = Field(default_factory=list)
    total_installed_kw: Optional[float] = None
    total_concurrent_kw: Optional[float] = None
    concurrency_factor: Optional[float] = None

    # ── 1.3 Spotřeba ──
    annual_consumption_mwh: Optional[float] = None
    operating_hours_day: Optional[int] = None
    operating_days_year: Optional[int] = None

    # ── 1.4 Dodávka ──
    supply_source: Optional[str] = None
    supply_cable: Optional[str] = None
    pen_split_location: Optional[str] = None

    # ── 1.5 Vnější vlivy ──
    environments: List[EnvironmentZone] = Field(default_factory=list)

    # ── Přepětí ──
    surge_protection_type: Optional[str] = None

    # ── Vedení a instalace ──
    cable_types_main: List[str] = Field(default_factory=list)
    installation_methods: List[str] = Field(default_factory=list)

    # ── Osvětlení ──
    lighting_control: Optional[str] = None
    emergency_lighting: Optional[bool] = None
    emergency_duration_min: Optional[int] = None

    # ── Zásuvky ──
    outlet_cable: Optional[str] = None
    outlet_ip_rating: Optional[str] = None
    floor_boxes: List[FloorBox] = Field(default_factory=list)

    # ── Napojení TZB ──
    tzb_connections: List[TZBConnection] = Field(default_factory=list)

    # ── Rozvaděče ──
    switchboards: List[SwitchboardInfo] = Field(default_factory=list)

    # ── Revize ──
    revision_standard: Optional[str] = None

    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 9. SlaboproudParams — Slaboproudé systémy (D.1.4.xx pozemní stavby)
# =============================================================================

class SCSParams(BaseModel):
    """Strukturovaná kabeláž (SCS)."""
    cable_category: Optional[str] = None
    cable_type: Optional[str] = None
    rack_location: Optional[str] = None
    rack_size: Optional[str] = None
    backbone_type: Optional[str] = None
    outlet_type: Optional[str] = None
    port_naming_schema: Dict[str, str] = Field(default_factory=dict)
    max_cables_per_conduit: Dict[str, int] = Field(default_factory=dict)


class PZTSParams(BaseModel):
    """Poplachový zabezpečovací a tísňový systém (PZTS)."""
    system_brand: Optional[str] = None
    control_panel: Optional[str] = None
    detectors: List[Dict[str, Any]] = Field(default_factory=list)
    current_standby_a: Optional[float] = None
    current_alarm_a: Optional[float] = None
    battery_capacity_ah: Optional[int] = None
    backup_duration_hours: Optional[float] = None
    monitoring_target: Optional[str] = None
    compatibility_requirement: Optional[str] = None


class SKVParams(BaseModel):
    """Systém kontroly vstupu (SKV/ACS)."""
    system_brand: Optional[str] = None
    reader_technology: Optional[str] = None
    controlled_doors: List[Dict[str, str]] = Field(default_factory=list)
    fire_alarm_integration: Optional[str] = None


class CCTVParams(BaseModel):
    """Kamerový systém (CCTV)."""
    camera_count: Optional[int] = None
    camera_resolution: Optional[str] = None
    camera_features: List[str] = Field(default_factory=list)
    vms_software: Optional[str] = None
    power_method: Optional[str] = None


class EPSParams(BaseModel):
    """Elektronická požární signalizace (EPS)."""
    system_brand: Optional[str] = None
    control_panel: Optional[str] = None
    panel_location: Optional[str] = None
    bus_type: Optional[str] = None
    is_extension: Optional[bool] = None
    new_modules: List[str] = Field(default_factory=list)
    fire_cable_type: Optional[str] = None
    fire_integrity_class: Optional[str] = None
    controlled_devices: List[str] = Field(default_factory=list)


class AVTParams(BaseModel):
    """Audiovizuální technika (AVT)."""
    provided_by: Optional[str] = None
    preparation_scope: Optional[str] = None


class IntercomParams(BaseModel):
    """Interkom / domácí telefon."""
    technology: Optional[str] = None
    units: List[Dict[str, str]] = Field(default_factory=list)


class SlaboproudParams(BaseModel):
    """Slaboproudé systémy — SCS, PZTS, SKV, CCTV, EPS, AVT, INT (D.1.4.xx)."""

    # ── Identification ──
    section_id: Optional[str] = None
    pd_level: Optional[str] = None
    subsystems: List[str] = Field(default_factory=list)

    # ── Subsystem params (only present ones populated) ──
    scs: Optional[SCSParams] = None
    pzts: Optional[PZTSParams] = None
    skv: Optional[SKVParams] = None
    cctv: Optional[CCTVParams] = None
    eps: Optional[EPSParams] = None
    avt: Optional[AVTParams] = None
    intercom: Optional[IntercomParams] = None

    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 10. VZTParams — Vzduchotechnika a klimatizace (D.1.4.xx) — v4.1
# =============================================================================

class NaturalVentParams(BaseModel):
    """Přirozené větrání — základní údaje."""
    method: Optional[str] = None
    is_primary: Optional[bool] = None
    rooms_naturally_vented: List[str] = Field(default_factory=list)
    special_note: Optional[str] = None


class VentZone(BaseModel):
    """One zone served by VZT unit."""
    room_name: str = ""
    supply_m3h: Optional[float] = None
    exhaust_m3h: Optional[float] = None
    air_changes_per_hour: Optional[float] = None
    terminal_type: Optional[str] = None


class ForcedVentParams(BaseModel):
    """Nucené větrání — VZT jednotka, rozvody, rekuperace."""
    ahu_type: Optional[str] = None
    ahu_brand: Optional[str] = None
    ahu_location: Optional[str] = None
    has_heat_recovery: Optional[bool] = None
    heat_recovery_type: Optional[str] = None
    heat_recovery_efficiency_pct: Optional[float] = None
    supply_air_m3h: Optional[float] = None
    exhaust_air_m3h: Optional[float] = None
    outdoor_air_m3h: Optional[float] = None
    duct_material: Optional[str] = None
    duct_insulation: Optional[str] = None
    duct_routing: Optional[str] = None
    static_pressure_pa: Optional[int] = None
    design_velocity_ms: Optional[float] = None
    zones: List[VentZone] = Field(default_factory=list)
    filter_class: Optional[str] = None


class ACParams(BaseModel):
    """Klimatizace / chlazení."""
    ac_type: Optional[str] = None
    brand: Optional[str] = None
    cooling_power_kw: Optional[float] = None
    heating_power_kw: Optional[float] = None
    refrigerant: Optional[str] = None
    outdoor_unit_location: Optional[str] = None
    zones: List[Dict[str, Any]] = Field(default_factory=list)


class KitchenHoodParams(BaseModel):
    """Digestoř a odtah z kuchyně."""
    hood_type: Optional[str] = None
    duct_outlet: Optional[str] = None
    duct_dn_mm: Optional[int] = None
    duct_material: Optional[str] = None
    flow_rate_m3h: Optional[float] = None
    grease_filter: Optional[bool] = None


class BathroomFanParams(BaseModel):
    """Ventilátory v koupelnách a WC."""
    fan_type: Optional[str] = None
    control_type: Optional[str] = None
    flow_per_unit_m3h: Optional[float] = None
    duct_dn_mm: Optional[int] = None
    duct_outlet: Optional[str] = None
    rooms: List[str] = Field(default_factory=list)
    unit_count: Optional[int] = None


class GarageVentParams(BaseModel):
    """Větrání garáže."""
    ventilation_type: Optional[str] = None
    co_sensor: Optional[bool] = None
    openings_area_m2: Optional[float] = None
    fan_brand: Optional[str] = None
    flow_m3h: Optional[float] = None
    fire_damper: Optional[bool] = None
    note: Optional[str] = None


class VZTUnit(BaseModel):
    """One VZT unit specification (for commercial/industrial)."""
    designation: str = ""
    unit_type: Optional[str] = None
    airflow_m3h: Optional[float] = None
    pressure_pa: Optional[float] = None
    heating_kw: Optional[float] = None
    cooling_kw: Optional[float] = None
    filter_class: Optional[str] = None
    heat_recovery_type: Optional[str] = None
    heat_recovery_efficiency_pct: Optional[float] = None
    served_zones: List[str] = Field(default_factory=list)


class VZTParams(BaseModel):
    """Vzduchotechnika a klimatizace (D.1.4.xx) — v4.1 expanded."""

    section_id: Optional[str] = None
    pd_level: Optional[str] = None
    building_name: Optional[str] = None

    # ── Typ větrání ──
    ventilation_strategy: Optional[str] = None

    # ── Přirozené větrání ──
    natural_ventilation: Optional[NaturalVentParams] = None

    # ── Nucené větrání ──
    forced_ventilation: Optional[ForcedVentParams] = None

    # ── Klimatizace ──
    air_conditioning: Optional[ACParams] = None

    # ── Speciální prvky ──
    kitchen_hood: Optional[KitchenHoodParams] = None
    bathroom_fans: Optional[BathroomFanParams] = None
    garage_ventilation: Optional[GarageVentParams] = None

    # ── VZT units (for commercial buildings) ──
    units: List[VZTUnit] = Field(default_factory=list)

    # ── General parameters ──
    total_airflow_supply_m3h: Optional[float] = None
    total_airflow_exhaust_m3h: Optional[float] = None
    total_heating_kw: Optional[float] = None
    total_cooling_kw: Optional[float] = None

    # ── Duct system ──
    duct_material: Optional[str] = None
    duct_insulation: Optional[str] = None
    fire_dampers: Optional[bool] = None

    # ── Control ──
    control_system: Optional[str] = None
    bms_integration: Optional[bool] = None

    # ── Design parameters ──
    noise_limit_db: Optional[int] = None
    design_outdoor_temp_winter: Optional[float] = None
    design_outdoor_temp_summer: Optional[float] = None
    design_indoor_temp: Optional[float] = None
    design_temperatures: Dict[str, str] = Field(default_factory=dict)

    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 11. ZTIParams — Zdravotechnické instalace (D.1.4.xx) — v4.1
# =============================================================================

class DrainPipe(BaseModel):
    """Odpadní potrubí."""
    label: Optional[str] = None
    dn: Optional[int] = None
    material: Optional[str] = None
    rooms_served: List[str] = Field(default_factory=list)


class SewerageParams(BaseModel):
    """Splašková kanalizace."""
    internal_material: Optional[str] = None
    external_material: Optional[str] = None
    joint_type: Optional[str] = None
    uv_protection: Optional[bool] = None
    ventilation_above_roof: Optional[bool] = None
    ventilation_cap_type: Optional[str] = None
    vent_pipe_dn: Optional[int] = None
    waste_pipes: List[DrainPipe] = Field(default_factory=list)
    drain_branch_dn: Optional[int] = None
    drain_slope_pct: Optional[float] = None
    du_total_ls: Optional[float] = None
    qww_calculated_ls: Optional[float] = None
    inspection_shaft: Optional[bool] = None
    inspection_shaft_location: Optional[str] = None


class RainwaterTank(BaseModel):
    """Retenční/akumulační nádrž."""
    tank_type: Optional[str] = None
    total_volume_m3: Optional[float] = None
    accumulation_volume_m3: Optional[float] = None
    retention_volume_m3: Optional[float] = None
    example_product: Optional[str] = None
    material: Optional[str] = None
    emptying_time_h: Optional[float] = None


class RainwaterParams(BaseModel):
    """Dešťová kanalizace."""
    gutter_material: Optional[str] = None
    downpipe_dn: Optional[int] = None
    downpipe_count: Optional[int] = None
    roof_area_m2: Optional[float] = None
    roof_runoff_coeff: Optional[float] = None
    paved_area_m2: Optional[float] = None
    paved_disposal: Optional[str] = None
    tank: Optional[RainwaterTank] = None
    qr_ls: Optional[float] = None
    design_rain_intensity: Optional[float] = None
    outlet_to: Optional[str] = None
    outlet_max_ls: Optional[float] = None


class ColdWaterParams(BaseModel):
    """Rozvod studené pitné vody."""
    supply_source: Optional[str] = None
    secondary_source: Optional[str] = None
    separation_standard: Optional[str] = None
    connection_length_total_m: Optional[float] = None
    connection_length_new_m: Optional[float] = None
    connection_length_existing_m: Optional[float] = None
    meter_location: Optional[str] = None
    meter_accessible_from: Optional[str] = None
    pipe_material_internal: Optional[str] = None
    pipe_routing: Optional[str] = None
    outlet_fittings: Optional[str] = None
    outdoor_taps: List[str] = Field(default_factory=list)
    total_pipe_length_m: Optional[float] = None
    min_pressure_kpa: Optional[float] = None


class HotWaterParams(BaseModel):
    """Rozvod teplé vody."""
    heat_source: Optional[str] = None
    heat_source_brand: Optional[str] = None
    storage_type: Optional[str] = None
    storage_brand: Optional[str] = None
    storage_volume_l: Optional[int] = None
    storage_location: Optional[str] = None
    has_circulation: Optional[bool] = None
    circulation_pump: Optional[str] = None
    pipe_material: Optional[str] = None
    pipe_routing: Optional[str] = None
    rooms_served: List[str] = Field(default_factory=list)
    thermal_power_kw: Optional[float] = None


class PlumbingFixture(BaseModel):
    """Zařizovací předmět."""
    fixture_type: str
    count: int = 0
    room: Optional[str] = None
    du_value: Optional[float] = None
    note: Optional[str] = None


class UtilityConnection(BaseModel):
    """Přípojka inženýrské sítě."""
    utility_type: str = ""
    connection_type: str = ""
    length_m: Optional[float] = None
    dn: Optional[int] = None
    owner: Optional[str] = None
    note: Optional[str] = None


class ZTIParams(BaseModel):
    """Zdravotně technické instalace — v4.1 expanded (D.1.4.xx)."""

    section_id: Optional[str] = None
    pd_level: Optional[str] = None
    building_name: Optional[str] = None
    building_type: Optional[str] = None
    floors_above: Optional[int] = None
    floors_below: Optional[int] = None
    occupants: Optional[int] = None

    # ── Splašková kanalizace ──
    sewage: Optional[SewerageParams] = None

    # ── Dešťová kanalizace ──
    rainwater: Optional[RainwaterParams] = None

    # ── Rozvod studené vody ──
    cold_water: Optional[ColdWaterParams] = None

    # ── Rozvod teplé vody ──
    hot_water: Optional[HotWaterParams] = None

    # ── Zařizovací předměty ──
    fixtures: List[PlumbingFixture] = Field(default_factory=list)

    # ── Přípojky ──
    connections: List[UtilityConnection] = Field(default_factory=list)

    # ── Výpočtové parametry ──
    design_flow_qww_ls: Optional[float] = None
    main_branch_dn: Optional[int] = None
    water_demand_m3_year: Optional[float] = None

    # ── Požární vodovod ──
    fire_hydrants: Optional[bool] = None
    fire_hydrant_dn: Optional[int] = None

    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 12. UTParams — Ústřední vytápění (D.1.4.xx) — v4.1
# =============================================================================

class HeatSourceParams(BaseModel):
    """Zdroj tepla — kotel, TČ, krbová kamna."""
    source_type: Optional[str] = None
    fuel: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    nominal_power_kw: Optional[float] = None
    max_power_kw: Optional[float] = None
    min_power_kw: Optional[float] = None
    efficiency_pct: Optional[float] = None
    location: Optional[str] = None
    is_primary: Optional[bool] = None
    note: Optional[str] = None


class UnderfloorParams(BaseModel):
    """Podlahové vytápění."""
    system_brand: Optional[str] = None
    system_type: Optional[str] = None
    example_product: Optional[str] = None
    pipe_od_mm: Optional[int] = None
    pipe_spacing_mm: Optional[int] = None
    screed_thickness_mm: Optional[int] = None
    insulation_thickness_mm: Optional[int] = None
    heated_area_m2: Optional[float] = None
    zones: List[str] = Field(default_factory=list)


class RadiatorParams(BaseModel):
    """Otopná tělesa."""
    radiator_type: Optional[str] = None
    total_count: Optional[int] = None
    electric_towel_rail: Optional[bool] = None
    electric_count: Optional[int] = None


class HeatingSystemParams(BaseModel):
    """Otopná soustava — typ, rozvody, otopné plochy."""
    system_type: Optional[str] = None
    underfloor_heating: Optional[UnderfloorParams] = None
    radiators: Optional[RadiatorParams] = None
    pipe_material: Optional[str] = None
    pipe_routing: Optional[str] = None
    pipe_insulation: Optional[str] = None
    manifold_location: Optional[str] = None
    manifold_circuits: Optional[int] = None
    supply_temp_c: Optional[float] = None
    return_temp_c: Optional[float] = None
    operating_pressure_bar: Optional[float] = None
    expansion_vessel_l: Optional[int] = None
    control_type: Optional[str] = None
    control_brand: Optional[str] = None
    control_zones: Optional[int] = None
    circulation_pump: Optional[str] = None
    pump_brand: Optional[str] = None


class ChimneyParams(BaseModel):
    """Komínový systém."""
    brand: Optional[str] = None
    model: Optional[str] = None
    variant: Optional[str] = None
    flue_dn_mm: Optional[int] = None
    outer_dimension: Optional[str] = None
    shaft_count: Optional[int] = None
    height_m: Optional[float] = None
    appliances_connected: List[str] = Field(default_factory=list)
    air_supply_integrated: Optional[bool] = None
    installation_standard: Optional[str] = None
    note: Optional[str] = None


class GarageHeatingParams(BaseModel):
    """Vytápění garáže a vedlejších prostorů."""
    heating_type: Optional[str] = None
    unit_type: Optional[str] = None
    unit_count: Optional[int] = None
    total_power_kw: Optional[float] = None
    control: Optional[str] = None
    note: Optional[str] = None


class UTParams(BaseModel):
    """Ústřední vytápění / otopná soustava (D.1.4.xx) — v4.1 expanded."""

    section_id: Optional[str] = None
    pd_level: Optional[str] = None
    building_name: Optional[str] = None
    building_type: Optional[str] = None

    # ── Energetické parametry (z PENB) ──
    u_mean_wm2k: Optional[float] = None
    specific_heat_demand_kwh_m2: Optional[float] = None
    total_delivered_energy_kwh_m2: Optional[float] = None
    primary_energy_kwh_m2: Optional[float] = None
    energy_class: Optional[str] = None

    # ── Tepelné ztráty ──
    heat_loss_total_kw: Optional[float] = None
    heat_loss_w: Optional[float] = None
    design_outdoor_temp_c: Optional[int] = None
    design_indoor_temp_c: Optional[int] = None

    # ── Zdroje tepla ──
    heat_source: Optional[HeatSourceParams] = None
    secondary_heat_source: Optional[HeatSourceParams] = None
    backup_heat_source: Optional[HeatSourceParams] = None

    # ── Otopná soustava ──
    heating_system: Optional[HeatingSystemParams] = None

    # ── Příprava teplé vody (koordinace se ZTI) ──
    dhw_source: Optional[str] = None
    dhw_storage_volume_l: Optional[int] = None

    # ── Komín ──
    chimney: Optional[ChimneyParams] = None

    # ── Garáž a vedlejší prostory ──
    garage_heating: Optional[GarageHeatingParams] = None

    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 13. MaRParams — Měření a regulace (D.1.4.xx)
# =============================================================================

class MaRParams(BaseModel):
    """Měření a regulace — řídicí systém (D.1.4.xx)."""

    section_id: Optional[str] = None
    pd_level: Optional[str] = None

    # ── Řídicí systém ──
    control_system_brand: Optional[str] = None
    control_system_type: Optional[str] = None
    plc_type: Optional[str] = None
    io_points_count: Optional[int] = None

    # ── Komunikace ──
    bus_protocol: Optional[str] = None
    bms_integration: Optional[bool] = None
    visualization: Optional[str] = None
    remote_access: Optional[bool] = None

    # ── Řízené profese ──
    controlled_professions: List[str] = Field(default_factory=list)
    controlled_equipment: List[str] = Field(default_factory=list)

    # ── Senzory ──
    temperature_sensors_count: Optional[int] = None
    humidity_sensors_count: Optional[int] = None
    pressure_sensors_count: Optional[int] = None
    other_sensors: List[str] = Field(default_factory=list)

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

# D.1.4 profession params — keyed by profession detector output
D14_PARAMS_CLASSES = {
    "silnoproud_params": SilnoproudParams,
    "slaboproud_params": SlaboproudParams,
    "vzt_params": VZTParams,
    "zti_params": ZTIParams,
    "ut_params": UTParams,
    "mar_params": MaRParams,
}

# Combined mapping (SO + D.1.4)
ALL_PARAMS_CLASSES = {**SO_PARAMS_CLASSES, **D14_PARAMS_CLASSES}
