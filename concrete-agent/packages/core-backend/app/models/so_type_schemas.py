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
# 10. VZTParams — Vzduchotechnika a klimatizace (D.1.4.xx / D.2.x.x) — v4.2
# =============================================================================

# ── v4.1 simple sub-models (backward compat for RD/bytové domy) ──

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


# ── v4.2 complex sub-models (multi-device commercial/infrastructure) ──

class DesignParams(BaseModel):
    """Klimatické a návrhové parametry místa stavby."""
    location: Optional[str] = None
    altitude_m: Optional[int] = None
    summer_outdoor_temp_c: Optional[float] = None
    winter_outdoor_temp_c: Optional[float] = None
    summer_enthalpy_kj_kg: Optional[float] = None
    min_ventilation_intensity: Optional[float] = None
    toilet_seat_m3h: Optional[int] = None
    washbasin_m3h: Optional[int] = None
    urinal_m3h: Optional[int] = None
    covers_heat_loss: Optional[bool] = None
    covers_cooling_load: Optional[bool] = None
    regulates_humidity: Optional[bool] = None


class SiteConditions(BaseModel):
    """Podmínky prostředí — chemikálie, vzduch."""
    prevailing_wind: Optional[str] = None
    hazardous_materials: Optional[bool] = None
    overpressure_equipment: Optional[bool] = None
    external_influence_protocol: Optional[bool] = None
    note: Optional[str] = None


class InsulationSpec(BaseModel):
    """Specifikace tepelné/požární izolace potrubí."""
    interior_main_mm: Optional[int] = None
    interior_branch_mm: Optional[int] = None
    interior_material: Optional[str] = None
    exterior_mm: Optional[int] = None
    exterior_material: Optional[str] = None
    fire_resistance_min: Optional[int] = None
    fire_insulation_type: Optional[str] = None


class FilterSpec(BaseModel):
    """Filtrační stupeň VZT jednotky (EN 779/ISO 16890)."""
    stage: int = 1
    filter_class: Optional[str] = None
    position: Optional[str] = None
    epm_class: Optional[str] = None


class HumidifierParams(BaseModel):
    """Parní vyvíječ / zvlhčovač vzduchu."""
    humidifier_type: Optional[str] = None
    max_capacity_kg_hr: Optional[float] = None
    location: Optional[str] = None
    water_supply_required: Optional[bool] = None
    condensate_drain_required: Optional[bool] = None
    power_supply: Optional[str] = None


class VAVRegulator(BaseModel):
    """Regulátor variabilního průtoku vzduchu (VAV)."""
    location: Optional[str] = None
    actuator_voltage_v: Optional[int] = None
    control_inputs: List[str] = Field(default_factory=list)
    control_logic: Optional[str] = None
    zone: Optional[str] = None


class FireDamperSpec(BaseModel):
    """Požární klapka."""
    fire_resistance: Optional[str] = None
    actuator_voltage_v: Optional[int] = None
    fail_safe: Optional[str] = None
    limit_switches: Optional[bool] = None
    monitoring_by: Optional[str] = None
    control_by: Optional[str] = None
    standard: Optional[str] = None
    quantity: Optional[int] = None


class FireGrillSpec(BaseModel):
    """Požární stěnová mřížka."""
    fire_resistance: Optional[str] = None
    control_by: Optional[str] = None
    quantity: Optional[int] = None


class DuctSpec(BaseModel):
    """Specifikace potrubních rozvodů."""
    material_rectangular: Optional[str] = None
    material_circular: Optional[str] = None
    tightness_class: Optional[str] = None
    flexible_connection: Optional[str] = None
    exhaust_termination: Optional[str] = None
    min_roof_height_mm: Optional[int] = None


class SilencerSpec(BaseModel):
    """Tlumič hluku."""
    position: Optional[str] = None
    type: Optional[str] = None
    length_mm: Optional[int] = None
    quantity: Optional[int] = None
    note: Optional[str] = None


class InterprofRequirements(BaseModel):
    """Požadavky na spolupracující profese."""
    silnoproud: List[str] = Field(default_factory=list)
    ut_chl: List[str] = Field(default_factory=list)
    eps: List[str] = Field(default_factory=list)
    mar: List[str] = Field(default_factory=list)
    zti: List[str] = Field(default_factory=list)
    asr: List[str] = Field(default_factory=list)
    other: Dict[str, List[str]] = Field(default_factory=dict)


class AHUDevice(BaseModel):
    """Modulární VZT jednotka."""
    device_id: str = ""
    location: Optional[str] = None
    target_spaces: List[str] = Field(default_factory=list)
    flow_m3h: Optional[int] = None
    supply_flow_m3h: Optional[int] = None
    exhaust_flow_m3h: Optional[int] = None
    filters: List[FilterSpec] = Field(default_factory=list)
    heat_recovery_type: Optional[str] = None
    heat_recovery_efficiency_pct: Optional[float] = None
    fan_type: Optional[str] = None
    water_heater: Optional[bool] = None
    water_cooler: Optional[bool] = None
    humidifier: Optional[HumidifierParams] = None
    duct: Optional[DuctSpec] = None
    insulation: Optional[InsulationSpec] = None
    silencers: List[SilencerSpec] = Field(default_factory=list)
    vav_regulators: Optional[str] = None
    intake_exhaust_location: Optional[str] = None
    power_supply: Optional[str] = None
    external_cooler: Optional[str] = None
    is_preparation_only: Optional[bool] = None
    note: Optional[str] = None


class ExhaustFanDevice(BaseModel):
    """Odtahový ventilátor (bez AHU)."""
    device_id: str = ""
    fan_type: Optional[str] = None
    flow_m3h: Optional[int] = None
    target_space: Optional[str] = None
    duct_type: Optional[str] = None
    silencer_length_mm: Optional[int] = None
    exhaust_location: Optional[str] = None
    air_makeup: Optional[str] = None
    control: Optional[str] = None
    pressure_mode: Optional[str] = None
    note: Optional[str] = None


class SplitCoolingDevice(BaseModel):
    """Split/multi-split klimatizace."""
    device_id: str = ""
    system_type: Optional[str] = None
    target_space: Optional[str] = None
    indoor_units: List[Dict[str, Any]] = Field(default_factory=list)
    outdoor_units: List[Dict[str, Any]] = Field(default_factory=list)
    refrigerant: Optional[str] = None
    gwp: Optional[int] = None
    operation_mode: Optional[str] = None
    communication_protocol: Optional[str] = None
    redundancy: Optional[bool] = None
    controller_type: Optional[str] = None
    is_preparation_only: Optional[bool] = None
    note: Optional[str] = None


class VZTDeviceUnion(BaseModel):
    """Unifikovaný obal pro libovolné VZT zařízení."""
    device_number: int = 0
    device_type: str = ""
    label: Optional[str] = None
    ahu: Optional[AHUDevice] = None
    fan: Optional[ExhaustFanDevice] = None
    cooling: Optional[SplitCoolingDevice] = None


class VZTUnit(BaseModel):
    """One VZT unit specification (legacy, for simple commercial)."""
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
    """Vzduchotechnika a klimatizace (D.1.4.xx / D.2.x.x) — v4.2."""

    section_id: Optional[str] = None
    pd_level: Optional[str] = None
    building_name: Optional[str] = None
    building_type: Optional[str] = None
    project_author: Optional[str] = None
    authorized_engineer: Optional[str] = None
    investor: Optional[str] = None
    date: Optional[str] = None

    # ── v4.2: Návrhové parametry ──
    design_params: Optional[DesignParams] = None
    site_conditions: Optional[SiteConditions] = None
    power_supply: Optional[str] = None

    # ── Strategie větrání ──
    ventilation_strategy: Optional[str] = None

    # ── v4.2: Multi-device (commercial/infrastructure) ──
    devices: List[VZTDeviceUnion] = Field(default_factory=list)
    total_supply_m3h: Optional[int] = None
    total_exhaust_m3h: Optional[int] = None
    ahu_count: Optional[int] = None
    split_cooling_count: Optional[int] = None
    exhaust_fan_count: Optional[int] = None

    # ── v4.2: Protipožární prvky ──
    fire_dampers: Optional[FireDamperSpec] = None
    fire_grills: Optional[FireGrillSpec] = None
    fire_damper_count: Optional[int] = None

    # ── v4.2: Potrubí a izolace (project-wide) ──
    duct_spec: Optional[DuctSpec] = None
    insulation_spec: Optional[InsulationSpec] = None

    # ── v4.2: Normy a předpisy ──
    regulations_used: List[str] = Field(default_factory=list)

    # ── v4.2: Požadavky na profese ──
    interprofessional: Optional[InterprofRequirements] = None

    # ── v4.1: Simple building (backward compat) ──
    natural_ventilation: Optional[NaturalVentParams] = None
    forced_ventilation: Optional[ForcedVentParams] = None
    air_conditioning: Optional[ACParams] = None
    kitchen_hood: Optional[KitchenHoodParams] = None
    bathroom_fans: Optional[BathroomFanParams] = None
    garage_ventilation: Optional[GarageVentParams] = None

    # ── Legacy VZT units ──
    units: List[VZTUnit] = Field(default_factory=list)
    total_airflow_supply_m3h: Optional[float] = None
    total_airflow_exhaust_m3h: Optional[float] = None
    total_heating_kw: Optional[float] = None
    total_cooling_kw: Optional[float] = None
    duct_material: Optional[str] = None
    duct_insulation: Optional[str] = None
    fire_dampers_bool: Optional[bool] = None
    control_system: Optional[str] = None
    bms_integration: Optional[bool] = None
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
# 14. ZelSvrsekParams — Železniční svršek (SO 111-xx) — v4.3
# =============================================================================

class GPKParams(BaseModel):
    """Geometrická poloha koleje — směr a výška."""
    alignment_type: Optional[str] = None
    curve_direction: Optional[str] = None
    curve_radius_m: Optional[int] = None
    cant_mm: Optional[int] = None
    transition_lk1_m: Optional[int] = None
    transition_lk2_m: Optional[int] = None
    design_speed_kmh: Optional[int] = None
    future_speed_kmh: Optional[int] = None
    future_speed_v130_kmh: Optional[int] = None
    gradient_before_pct: Optional[float] = None
    gradient_after_pct: Optional[float] = None
    vertical_radius_rv_m: List[int] = Field(default_factory=list)
    niveleta_elevation_max_mm: Optional[int] = None
    ln_position_km: Optional[float] = None
    clearance_profile: Optional[str] = None
    bridge_clearance: Optional[str] = None


class TrackFrameParams(BaseModel):
    """Kolejový rošt — kolejnice, pražce, lože, upevnění."""
    rail_type: Optional[str] = None
    rail_steel_class: Optional[str] = None
    rail_length_m: Optional[float] = None
    sleeper_type: Optional[str] = None
    sleeper_division: Optional[str] = None
    sleeper_spacing_mm: Optional[int] = None
    sleeper_support_spacing_mm: Optional[int] = None
    sleeper_count_transition: Optional[int] = None
    sleeper_count_standard: Optional[int] = None
    existing_sleeper_type: Optional[str] = None
    existing_sleeper_division: Optional[str] = None
    fastening_type: Optional[str] = None
    fastening_clip: Optional[str] = None
    rail_inclination: Optional[str] = None
    base_plate: Optional[bool] = None
    ballast_material: Optional[str] = None
    ballast_fraction: Optional[str] = None
    ballast_class: Optional[str] = None
    ballast_thickness_under_y_mm: Optional[int] = None
    ballast_thickness_under_sb_mm: Optional[int] = None
    ballast_thickness_bridge_mm_min: Optional[int] = None
    ballast_thickness_bridge_mm_max: Optional[int] = None
    ballast_type_open: Optional[bool] = None
    ballast_type_bridge: Optional[str] = None
    ballast_contamination_class: Optional[List[str]] = None
    existing_ballast_depth_cm_range: Optional[str] = None
    nominal_gauge_mm: Optional[int] = None
    design_gauge_mm: Optional[int] = None
    gauge_widening: Optional[bool] = None
    clearance_profile: Optional[str] = None
    load_capacity_class: Optional[str] = None


class ContinuousWeldedParams(BaseModel):
    """Bezstyková kolej (BK)."""
    is_new: Optional[bool] = None
    rail_strip_length_m: Optional[int] = None
    temperature_regulation: Optional[bool] = None
    sleeper_anchor_required: Optional[bool] = None
    standard_ref: Optional[str] = None
    dynamic_stabilizer_required: Optional[bool] = None


class TrackCircuitParams(BaseModel):
    """Kolejové obvody a LIS."""
    location_km: Optional[float] = None
    lis_type: Optional[str] = None
    lis_length_m: Optional[float] = None
    lis_holes: Optional[int] = None
    lis_offset_mm: Optional[int] = None
    transformer_relocation: Optional[bool] = None
    insulation_system: Optional[str] = None
    regulation_required: Optional[bool] = None


class TrackSignParams(BaseModel):
    """Výstroj trati — návěstidla."""
    sign_type: Optional[str] = None
    sign_code: Optional[str] = None
    action: Optional[str] = None
    location_km: Optional[float] = None
    note: Optional[str] = None


class TrackAdjustmentZone(BaseModel):
    """Úsek se směrovou/výškovou úpravou GPK."""
    start_km: Optional[float] = None
    end_km: Optional[float] = None
    length_m: Optional[float] = None
    action: Optional[str] = None


class SalvagedMaterialParams(BaseModel):
    """Vyzískaný materiál z rekonstrukce."""
    rails_type: Optional[str] = None
    sleepers_type: Optional[str] = None
    ballast_volume_t: Optional[float] = None
    deposit_location: Optional[str] = None
    recycling_threshold_t: Optional[float] = None
    rubber_pads_disposal: Optional[bool] = None


class ZelSvrsekParams(BaseModel):
    """Železniční svršek — kolejový rošt, GPK, výstroj trati (SO 111-xx)."""

    section_id: Optional[str] = None
    so_id: Optional[str] = None
    pd_level: Optional[str] = None
    project_name: Optional[str] = None
    investor: Optional[str] = None
    track_section: Optional[str] = None
    track_number_jrz: Optional[str] = None
    track_number_prohlaseni: Optional[str] = None
    track_category: Optional[str] = None
    region: Optional[str] = None

    # ── Traťové parametry ──
    max_speed_kmh: Optional[int] = None
    load_order: Optional[int] = None
    axle_load_t: Optional[float] = None
    axle_load_shunting_t: Optional[float] = None
    load_class: Optional[str] = None
    tsi_inf_passenger: Optional[str] = None
    tsi_inf_freight: Optional[str] = None
    track_position: Optional[str] = None
    traction_system: Optional[str] = None
    safety_device: Optional[str] = None
    track_count: Optional[int] = None

    # ── Rozsah úprav ──
    start_km: Optional[float] = None
    end_km: Optional[float] = None
    total_length_m: Optional[float] = None
    reconstruction_start_km: Optional[float] = None
    reconstruction_end_km: Optional[float] = None
    reconstruction_length_m: Optional[float] = None
    adjustment_zones: List[TrackAdjustmentZone] = Field(default_factory=list)

    # ── GPK ──
    gpk: Optional[GPKParams] = None

    # ── Kolejový rošt ──
    track_frame: Optional[TrackFrameParams] = None

    # ── Bezstyková kolej ──
    continuous_welded: Optional[ContinuousWeldedParams] = None

    # ── Kolejové obvody a LIS ──
    track_circuits: List[TrackCircuitParams] = Field(default_factory=list)

    # ── Drážní stezky ──
    walkway_width_m: Optional[float] = None
    walkway_renewal: Optional[bool] = None

    # ── Výstroj trati ──
    track_equipment: List[TrackSignParams] = Field(default_factory=list)

    # ── Vyzískaný materiál ──
    salvaged_material: Optional[SalvagedMaterialParams] = None

    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 15. ZelSpodekParams — Železniční spodek (SO 112-xx) — v4.3
# =============================================================================

class KPPLayer(BaseModel):
    """Vrstva KPP."""
    layer_type: Optional[str] = None
    material: Optional[str] = None
    compaction_id: Optional[float] = None
    thickness_mm: Optional[int] = None
    thickness_variable: Optional[bool] = None
    thickness_mm_min: Optional[int] = None
    thickness_mm_max: Optional[int] = None
    note: Optional[str] = None


class KPPZone(BaseModel):
    """Konstrukční vrstva pražcového podloží — jedna zóna."""
    zone_type: Optional[str] = None
    start_km: Optional[float] = None
    end_km: Optional[float] = None
    location: Optional[str] = None
    e_min_zp_mpa: Optional[float] = None
    e_min_pl_mpa: Optional[float] = None
    layers: List[KPPLayer] = Field(default_factory=list)


class SubgradeParams(BaseModel):
    """Zemní pláň."""
    transverse_slope_pct: Optional[float] = None
    slope_direction: Optional[str] = None
    embankment_height_m_range: Optional[str] = None
    excavation_depth_mm: Optional[int] = None
    required_e_min_mpa: Optional[float] = None


class FormationLevelParams(BaseModel):
    """Pláň tělesa železničního spodku."""
    width_min_m: Optional[float] = None
    walkway_width_m: Optional[float] = None
    transverse_slope_pct: Optional[float] = None
    required_e_min_mpa: Optional[float] = None
    geotechnical_supervision: Optional[bool] = None


class RailDrainageParams(BaseModel):
    """Odvodnění železničního tělesa."""
    transverse_slope_pct: Optional[float] = None
    drainage_ribs_spacing_m: Optional[float] = None
    drainage_rib_material: Optional[str] = None
    drainage_rib_width_m: Optional[float] = None
    bridge_drainage_slope_pct: Optional[float] = None
    bridge_drainage_type: Optional[str] = None


class WideningZone(BaseModel):
    """Jedna zóna rozšíření."""
    side: Optional[str] = None
    start_km: Optional[float] = None
    end_km: Optional[float] = None
    length_m: Optional[float] = None
    steps: Optional[int] = None


class EmbankmentWideningParams(BaseModel):
    """Rozšíření drážního tělesa přisypávkou."""
    widening_zones: List[WideningZone] = Field(default_factory=list)
    slope_max: Optional[str] = None
    fill_material: Optional[str] = None
    step_height_max_mm: Optional[int] = None
    step_slope_pct: Optional[float] = None


class WallZone(BaseModel):
    """Zóna zídky (prefabrikované U3 nebo gabionové)."""
    side: Optional[str] = None
    start_km: Optional[float] = None
    end_km: Optional[float] = None
    length_m: Optional[float] = None
    location_description: Optional[str] = None
    distance_from_axis_m: Optional[float] = None
    foundation_concrete: Optional[str] = None
    foundation_thickness_mm: Optional[int] = None
    foundation_base_material: Optional[str] = None
    foundation_base_thickness_mm: Optional[int] = None
    element_length_m: Optional[float] = None
    element_width_m: Optional[float] = None
    element_height_m: Optional[float] = None
    drainage_holes: Optional[bool] = None
    drainage_hole_diameter_m: Optional[float] = None
    backfill_material: Optional[str] = None
    coating: Optional[str] = None
    wall_standard: Optional[str] = None


class SlopeStabilityParams(BaseModel):
    """Posouzení stability svahu."""
    method: Optional[str] = None
    standard: Optional[str] = None
    design_situation: Optional[str] = None
    gamma_g_unfavorable: Optional[float] = None
    gamma_q: Optional[float] = None
    gamma_rs: Optional[float] = None
    utilization_pct: Optional[float] = None
    result: Optional[str] = None
    critical_km: Optional[float] = None
    critical_side: Optional[str] = None
    phi_ef_degrees: Optional[float] = None


class ZelSpodekParams(BaseModel):
    """Železniční spodek — KPP, ZKPP, zemní pláň, zídky (SO 112-xx)."""

    section_id: Optional[str] = None
    so_id: Optional[str] = None
    pd_level: Optional[str] = None

    # ── Moduly přetvárnosti — požadované ──
    e_min_zp_mpa: Optional[float] = None
    e_min_pl_mpa: Optional[float] = None

    # ── Typy KPP ──
    kpp_zones: List[KPPZone] = Field(default_factory=list)

    # ── Zemní pláň ──
    subgrade: Optional[SubgradeParams] = None

    # ── Pláň tělesa ──
    formation_level: Optional[FormationLevelParams] = None

    # ── Odvodnění ──
    drainage: Optional[RailDrainageParams] = None

    # ── Rozšíření drážního tělesa ──
    embankment_widening: Optional[EmbankmentWideningParams] = None

    # ── Zídky ──
    precast_walls_u3: List[WallZone] = Field(default_factory=list)
    gabion_walls: List[WallZone] = Field(default_factory=list)

    # ── Stabilita svahu ──
    slope_stability: Optional[SlopeStabilityParams] = None

    sources: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# 16. IGPParams — Inženýrskogeologický průzkum — v4.3
# =============================================================================

class IGPLayer(BaseModel):
    """Vrstva v kopané sondě."""
    depth_from_m: Optional[float] = None
    depth_to_m: Optional[float] = None
    description: Optional[str] = None
    sz_s4_class: Optional[str] = None
    iso_14688_class: Optional[str] = None


class IGPProbe(BaseModel):
    """Kopaná sonda z IGP průzkumu."""
    probe_id: Optional[str] = None
    location_km: Optional[float] = None
    side: Optional[str] = None
    date: Optional[str] = None
    depth_from_tk_m: Optional[float] = None
    dimensions: Optional[str] = None
    ballast_total_cm: Optional[int] = None
    ballast_contaminated_cm: Optional[int] = None
    subgrade_soil_class: Optional[str] = None
    subgrade_soil_name: Optional[str] = None
    frost_susceptibility: Optional[str] = None
    water_regime: Optional[str] = None
    groundwater: Optional[str] = None
    relative_density_id_min: Optional[float] = None
    layers: List[IGPLayer] = Field(default_factory=list)


class SZZResult(BaseModel):
    """Statická zatěžovací zkouška (SZZ)."""
    test_id: Optional[int] = None
    location_km: Optional[float] = None
    depth_from_tk_m: Optional[float] = None
    plate_diameter_mm: Optional[int] = None
    device: Optional[str] = None
    e1_mpa: Optional[float] = None
    e2_mpa: Optional[float] = None
    e2_e1_ratio: Optional[float] = None
    correction_factor_z: Optional[float] = None
    er_mpa: Optional[float] = None
    counterweight: Optional[str] = None


class GeologyParams(BaseModel):
    """Geologická stavba lokality."""
    geomorphologic_unit: Optional[str] = None
    bedrock_type: Optional[str] = None
    bedrock_depth_m: Optional[float] = None
    quaternary_cover_m: Optional[float] = None
    quaternary_description: Optional[str] = None
    embankment_material: Optional[str] = None
    embankment_height_m: Optional[float] = None


class HydrogeologyParams(BaseModel):
    """Hydrogeologické poměry."""
    groundwater_depth_m: Optional[float] = None
    groundwater_type: Optional[str] = None
    catchment_area: Optional[str] = None
    frost_depth_m: Optional[float] = None
    frost_index_imn: Optional[float] = None
    elevation_band_m: Optional[str] = None


class LabResult(BaseModel):
    """Laboratorní výsledek vzorku zeminy."""
    sample_id: Optional[str] = None
    probe_id: Optional[str] = None
    depth_m: Optional[str] = None
    soil_class: Optional[str] = None
    soil_name: Optional[str] = None
    filtration_coeff_ms: Optional[float] = None
    frost_susceptibility: Optional[str] = None
    capillary_rise_m: Optional[float] = None
    permeability_class: Optional[str] = None


class KPPDesignResult(BaseModel):
    """Výsledek návrhu KPP nebo ZKPP."""
    zone_type: Optional[str] = None
    e_subgrade_mpa: Optional[float] = None
    e_equivalent_zp_mpa: Optional[float] = None
    e_equivalent_pl_mpa: Optional[float] = None
    e_required_zp_mpa: Optional[float] = None
    e_required_pl_mpa: Optional[float] = None
    frost_check_passes: Optional[bool] = None
    frost_depth_m: Optional[float] = None
    final_layers: List[KPPLayer] = Field(default_factory=list)


class IGPParams(BaseModel):
    """Inženýrskogeologický průzkum pražcového podloží."""

    project_name: Optional[str] = None
    contractor: Optional[str] = None
    client: Optional[str] = None
    report_date: Optional[str] = None
    location_municipality: Optional[str] = None
    cadastral_area_code: Optional[int] = None
    elevation_range_m: Optional[str] = None

    # ── Parametry trati ──
    track_vmax_kmh: Optional[int] = None
    track_load_class: Optional[str] = None
    operational_load_mhrt_year: Optional[float] = None

    # ── Požadované moduly ──
    required_e_min_zp_mpa: Optional[float] = None
    required_e_min_pl_pp_mpa: Optional[float] = None
    required_e_min_pl_zkpp_mpa: Optional[float] = None

    # ── Sondy ──
    probes: List[IGPProbe] = Field(default_factory=list)

    # ── SZZ ──
    load_tests: List[SZZResult] = Field(default_factory=list)

    # ── Geologie ──
    geology: Optional[GeologyParams] = None

    # ── Hydrogeologie ──
    hydrogeology: Optional[HydrogeologyParams] = None

    # ── Laboratorní výsledky ──
    lab_results: List[LabResult] = Field(default_factory=list)

    # ── Návrh KPP/ZKPP ──
    kpp_design: Optional[KPPDesignResult] = None
    zkpp_design: Optional[KPPDesignResult] = None

    # ── Závěr ──
    conclusion_summary: Optional[str] = None

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

# Railway document params — keyed by document type detector
RAILWAY_PARAMS_CLASSES = {
    "zel_svrsek_params": ZelSvrsekParams,
    "zel_spodek_params": ZelSpodekParams,
    "igp_params": IGPParams,
}

# Combined mapping (SO + D.1.4 + Railway)
ALL_PARAMS_CLASSES = {**SO_PARAMS_CLASSES, **D14_PARAMS_CLASSES, **RAILWAY_PARAMS_CLASSES}
