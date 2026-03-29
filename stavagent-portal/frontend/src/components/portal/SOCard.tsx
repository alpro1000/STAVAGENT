/**
 * SOCard — Universal data-driven card for one Stavební Objekt (SO).
 *
 * v3.1: Renders ALL SO types (roads, water, vegetation, DIO, electro, etc.)
 * Each section only appears when its data exists.
 * NO hardcoded layout for any single type — purely data-driven.
 */

import type { CSSProperties, ReactNode } from 'react';
import type {
  MergedSO, BridgeSOParams, GTPExtraction, TechnicalExtraction,
  RoadSOParams, TrafficDIOParams, WaterSOParams, VegetationSOParams,
  ElectroSOParams, PipelineSOParams, SignageSOParams,
  SilnoproudParams, SlaboproudParams, VZTParams, ZTIParams, UTParams, MaRParams,
  ZelSvrsekParams, ZelSpodekParams, IGPParams,
  ConstructionPhase, RoadClosure, DetourRoute, PlantSpecies,
  GenericSummary,
} from '../../types/passport';

interface SOCardProps {
  so: MergedSO;
}

// ===== Czech label maps for data-driven rendering =====

const BRIDGE_LABELS: Record<string, string> = {
  bridge_length_m: 'Délka mostu',
  bridge_width_m: 'Šířka mostu',
  free_width_m: 'Volná šířka',
  bridge_height_m: 'Výška mostu',
  structural_height_m: 'Konstrukční výška',
  clearance_under_m: 'Podjezdná výška',
  light_span_m: 'Světlost',
  span_m: 'Rozpětí',
  span_config: 'Konfigurace polí',
  nk_length_m: 'Délka NK',
  nk_area_m2: 'Plocha NK',
  nk_type: 'Typ NK',
  load_class: 'Třída zatížení',
  beam_count: 'Počet nosníků',
  beam_spacing_mm: 'Osová vzdálenost',
  slab_thickness_mm: 'Tloušťka desky',
  foundation_type: 'Typ založení',
  pile_diameter_mm: 'Průměr pilot',
  pile_length_m: 'Délka pilot',
  concrete_nk: 'Beton NK',
  concrete_substructure: 'Beton spodní stavba',
  concrete_foundation: 'Beton základy',
  reinforcement: 'Výztuž',
  settlement_abutment_1_mm: 'Sedání opěra 1',
  settlement_abutment_2_mm: 'Sedání opěra 2',
  deflection_span_mm: 'Průhyb pole',
  pko_aggressivity: 'Agresivita prostředí',
  obstacle_crossed: 'Překonávaná překážka',
  chainage_km: 'Staničení',
  csn_4_1: '4.1 Druh mostu',
  csn_4_2: '4.2 Překážka',
  csn_4_3: '4.3 Počet polí',
  csn_4_5: '4.5 Materiál',
};

const GTP_LABELS: Record<string, string> = {
  water_aggressivity: 'Agresivita vody',
  geotechnical_category: 'Geotechnická kategorie',
  stray_current_class: 'Bludné proudy',
  foundation_recommendation: 'Doporučení zakládání',
  pile_depth_estimate: 'Odhad hloubky pilot',
};

const TECHNICAL_LABELS: Record<string, string> = {
  project_name: 'Název projektu',
  structure_type: 'Typ konstrukce',
  structure_subtype: 'Podtyp',
  total_length_m: 'Celková délka (m)',
  width_m: 'Šířka (m)',
  height_m: 'Výška (m)',
  area_m2: 'Plocha (m²)',
  volume_m3: 'Objem (m³)',
  span_count: 'Počet polí',
  span_lengths_m: 'Rozpětí polí (m)',
  concrete_grade: 'Třída betonu',
  reinforcement_grade: 'Třída výztuže',
  foundation_type: 'Typ založení',
  fabrication_method: 'Metoda výroby',
  load_class: 'Třída zatížení',
  design_life_years: 'Návrhová životnost (let)',
  applicable_standards: 'Normy',
  construction_duration_months: 'Doba výstavby (měsíce)',
  special_conditions: 'Zvláštní podmínky',
};

const ROAD_LABELS: Record<string, string> = {
  road_designation: 'Označení silnice',
  road_class: 'Třída silnice',
  road_category: 'Kategorie',
  road_type: 'Typ stavby',
  road_length_m: 'Délka (m)',
  chainage_start: 'Staničení od',
  chainage_end: 'Staničení do',
  alignment_type: 'Směrové řešení',
  curve_radius_m: 'Poloměr oblouku (m)',
  cross_slope_pct: 'Příčný sklon (%)',
  cross_slope_type: 'Typ sklonu',
  lane_width_m: 'Šířka pruhu (m)',
  lane_count: 'Počet pruhů',
  shoulder_paved_m: 'Zpevněná krajnice (m)',
  shoulder_unpaved_m: 'Nezpevněná krajnice (m)',
  pavement_catalog: 'Katalog vozovky',
  traffic_load_class: 'Třída zatížení',
  design_damage_level: 'Úroveň porušení',
  surface_type: 'Povrch',
  pavement_layers: 'Skladba vozovky',
  active_zone_thickness_m: 'Aktivní zóna (m)',
  min_cbr_pct: 'Min. CBR (%)',
  earthwork_type: 'Typ zemního tělesa',
  has_sanation: 'Sanace',
  sanation_type: 'Typ sanace',
  has_guardrails: 'Svodidla',
  guardrail_type: 'Typ svodidel',
  drainage_method: 'Odvodnění',
  volume_cut_m3: 'Výkop (m³)',
  volume_fill_m3: 'Násyp (m³)',
  future_owner: 'Budoucí vlastník',
};

const WATER_LABELS: Record<string, string> = {
  water_type: 'Typ objektu',
  pipe_material: 'Materiál potrubí',
  pipe_dn: 'DN',
  pipe_pn: 'PN',
  pipe_standard: 'Norma',
  pipe_quality: 'Kvalita',
  pipe_length_m: 'Délka (m)',
  outer_protection: 'Vnější ochrana',
  inner_lining: 'Vnitřní výstelka',
  joint_type: 'Typ spoje',
  casing_material: 'Chránička — materiál',
  casing_dn: 'Chránička — DN',
  casing_length_m: 'Chránička — délka (m)',
  casing_protection: 'Chránička — ochrana',
  trench_walls: 'Stěny výkopu',
  trench_shoring: 'Pažení',
  bedding_material: 'Obsyp',
  bedding_depth_mm: 'Podsyp (mm)',
  detection_wire: 'Signální vodič',
  warning_foil: 'Výstražná folie',
  connection_type: 'Typ napojení',
  pressure_test: 'Tlaková zkouška',
  disinfection: 'Dezinfekce',
  crossing_km: 'Křížení (km)',
  owner: 'Vlastník',
  drain_type: 'Typ odvodnění',
  retention_volume_m3: 'Retenční objem (m³)',
  oil_separator: 'Odlučovač ropných látek',
};

const VEGETATION_LABELS: Record<string, string> = {
  climate_region: 'Klimatický region',
  total_trees: 'Stromy celkem',
  total_shrubs: 'Keře celkem',
  lawn_care_count: 'Počet ošetření trávníku',
  lawn_mowing_frequency: 'Frekvence sečení',
  watering_count: 'Počet zálivek',
  mulch_material: 'Mulč',
  mulch_thickness_cm: 'Tloušťka mulče (cm)',
  tree_care_years: 'Péče o stromy (roky)',
  tree_stakes: 'Kůly',
  standards: 'Normy',
};

const DIO_LABELS: Record<string, string> = {
  total_duration_weeks: 'Celková doba výstavby (týdny)',
  bus_impact: 'Dopad na autobusy',
  rail_impact: 'Dopad na železnici',
};

const ELECTRO_LABELS: Record<string, string> = {
  electro_type: 'Typ objektu',
  voltage_level: 'Napěťová úroveň',
  cable_type: 'Typ kabelu',
  telecom_operator: 'Provozovatel (telco)',
  energy_operator: 'Provozovatel (energie)',
  chainage_km: 'Staničení',
  realized_by: 'Realizuje',
  is_separate_contract: 'Samostatná zakázka',
  dis_type: 'Typ DIS',
};

const PIPELINE_LABELS: Record<string, string> = {
  pipeline_type: 'Typ vedení',
  pressure_class: 'Tlaková třída',
  pipe_dn: 'DN',
  pipe_material: 'Materiál',
  pipe_length_m: 'Délka (m)',
  chainage_km: 'Staničení',
  operator: 'Provozovatel',
  realized_by: 'Realizuje',
  is_separate_contract: 'Samostatná zakázka',
  coordination_note: 'Koordinace',
};

const SIGNAGE_LABELS: Record<string, string> = {
  horizontal_type: 'Vodorovné značení',
  horizontal_standard: 'Norma VDZ',
  sign_standards: 'Normy SDZ',
  roads_signed: 'Značené komunikace',
};

// ===== D.1.4 Profession label maps =====

const SILNOPROUD_LABELS: Record<string, string> = {
  section_id: 'Oddíl PD',
  pd_level: 'Stupeň PD',
  building_name: 'Budova',
  building_type: 'Typ budovy',
  voltage_3phase: 'Napětí 3f',
  voltage_1phase: 'Napětí 1f',
  current_system: 'Soustava',
  max_concurrent_power_kw: 'Max. soudobý příkon (kW)',
  total_installed_kw: 'Instalovaný příkon (kW)',
  total_concurrent_kw: 'Soudobý příkon (kW)',
  concurrency_factor: 'Součinitel soudobosti',
  annual_consumption_mwh: 'Roční spotřeba (MWh)',
  supply_source: 'Zdroj napájení',
  supply_cable: 'Přívodní kabel',
  lighting_control: 'Řízení osvětlení',
  emergency_lighting: 'Nouzové osvětlení',
  emergency_duration_min: 'Doba nouzového osvětlení (min)',
  outlet_cable: 'Kabel zásuvek',
  outlet_ip_rating: 'IP zásuvek',
  surge_protection_type: 'Přepěťová ochrana',
  revision_standard: 'Norma revize',
  protection_methods: 'Ochranná opatření',
  cable_types_main: 'Hlavní typy kabelů',
  installation_methods: 'Způsoby instalace',
};

const SLABOPROUD_LABELS: Record<string, string> = {
  section_id: 'Oddíl PD',
  pd_level: 'Stupeň PD',
  subsystems: 'Podsystémy',
};

const VZT_LABELS: Record<string, string> = {
  section_id: 'Oddíl PD',
  pd_level: 'Stupeň PD',
  building_name: 'Budova',
  ventilation_strategy: 'Strategie větrání',
  total_supply_m3h: 'Přívod celkem (m³/h)',
  total_exhaust_m3h: 'Odvod celkem (m³/h)',
  ahu_count: 'VZT jednotky',
  split_cooling_count: 'Split/chlazení',
  exhaust_fan_count: 'Odtahové ventilátory',
  fire_damper_count: 'Požární klapky',
  total_heating_kw: 'Topný výkon (kW)',
  total_cooling_kw: 'Chladící výkon (kW)',
  duct_material: 'Materiál potrubí',
  duct_insulation: 'Izolace',
  control_system: 'Řídící systém',
  bms_integration: 'Integrace BMS',
  noise_limit_db: 'Limit hluku (dB)',
  design_outdoor_temp_winter: 'Výp. teplota zima (°C)',
  design_outdoor_temp_summer: 'Výp. teplota léto (°C)',
  design_indoor_temp: 'Vnitřní teplota (°C)',
  regulations_used: 'Použité předpisy',
};

const ZTI_LABELS: Record<string, string> = {
  section_id: 'Oddíl PD',
  pd_level: 'Stupeň PD',
  building_name: 'Budova',
  building_type: 'Typ budovy',
  floors_above: 'Nadzemní podlaží',
  floors_below: 'Podzemní podlaží',
  occupants: 'Počet osob',
  design_flow_qww_ls: 'Návrhový průtok Qww (l/s)',
  main_branch_dn: 'Hlavní potrubí DN',
  water_demand_m3_year: 'Potřeba vody (m³/rok)',
  fire_hydrants: 'Požární hydranty',
  fire_hydrant_dn: 'DN hydrantu',
};

const UT_LABELS: Record<string, string> = {
  section_id: 'Oddíl PD',
  pd_level: 'Stupeň PD',
  building_name: 'Budova',
  heat_loss_total_kw: 'Tepelná ztráta (kW)',
  design_outdoor_temp_c: 'Výp. venkovní teplota (°C)',
  design_indoor_temp_c: 'Výp. vnitřní teplota (°C)',
  u_mean_wm2k: 'Průměr. U (W/m²K)',
  specific_heat_demand_kwh_m2: 'Měrná potřeba tepla (kWh/m²)',
  energy_class: 'Energetická třída',
  dhw_source: 'Zdroj TUV',
  dhw_storage_volume_l: 'Objem zásobníku TUV (l)',
};

const MAR_LABELS: Record<string, string> = {
  section_id: 'Oddíl PD',
  pd_level: 'Stupeň PD',
  control_system_brand: 'Výrobce ŘS',
  control_system_type: 'Typ ŘS',
  plc_type: 'Typ PLC',
  io_points_count: 'Počet I/O bodů',
  bus_protocol: 'Sběrnice',
  bms_integration: 'Integrace BMS',
  visualization: 'Vizualizace',
  remote_access: 'Vzdálený přístup',
  controlled_professions: 'Řízené profese',
  controlled_equipment: 'Řízená zařízení',
  temperature_sensors_count: 'Teplotní čidla',
  humidity_sensors_count: 'Vlhkostní čidla',
  pressure_sensors_count: 'Tlaková čidla',
};

// ===== Railway label maps =====

const ZEL_SVRSEK_LABELS: Record<string, string> = {
  section_id: 'Oddíl PD',
  so_id: 'SO',
  pd_level: 'Stupeň PD',
  project_name: 'Stavba',
  track_section: 'Traťový úsek',
  track_category: 'Kategorie trati',
  max_speed_kmh: 'Traťová rychlost (km/h)',
  axle_load_t: 'Nápravové zatížení (t)',
  load_class: 'Třída zatížení',
  track_position: 'Poloha koleje',
  traction_system: 'Trakční soustava',
  safety_device: 'Zabezpečovací zařízení',
  track_count: 'Počet kolejí',
  start_km: 'Začátek (km)',
  end_km: 'Konec (km)',
  total_length_m: 'Celková délka (m)',
  reconstruction_length_m: 'Délka rekonstrukce (m)',
  walkway_width_m: 'Šířka stezky (m)',
  walkway_renewal: 'Obnova stezky',
};

const ZEL_SPODEK_LABELS: Record<string, string> = {
  section_id: 'Oddíl PD',
  so_id: 'SO',
  pd_level: 'Stupeň PD',
  e_min_zp_mpa: 'Emin ZP (MPa)',
  e_min_pl_mpa: 'Emin PL (MPa)',
};

const IGP_LABELS: Record<string, string> = {
  project_name: 'Stavba',
  contractor: 'Zhotovitel průzkumu',
  client: 'Objednatel',
  report_date: 'Datum zprávy',
  location_municipality: 'Obec',
  elevation_range_m: 'Nadmořská výška',
  track_vmax_kmh: 'Traťová rychlost (km/h)',
  track_load_class: 'Třída zatížení',
  required_e_min_zp_mpa: 'Požadovaný Emin ZP (MPa)',
  required_e_min_pl_pp_mpa: 'Požadovaný Emin PL PP (MPa)',
  conclusion_summary: 'Závěr',
};

const STRUCTURE_TYPE_LABELS: Record<string, string> = {
  BUILDING: 'Budova',
  BRIDGE: 'Most',
  TUNNEL: 'Tunel',
  FOUNDATION: 'Základy',
  RETAINING_WALL: 'Opěrná zeď',
  SLAB: 'Deska',
  RAILWAY: 'Železnice',
  ROAD: 'Silnice',
  INDUSTRIAL: 'Průmyslový objekt',
  RESIDENTIAL: 'Obytná stavba',
  COMMERCIAL: 'Komerční stavba',
  INFRASTRUCTURE: 'Infrastruktura',
  PARKING: 'Parkovací objekt',
  STADIUM: 'Stadion',
  HYDRAULIC: 'Vodní dílo',
  OTHER: 'Jiné',
};

// v3.1.1: Construction type labels
const CONSTRUCTION_TYPE_LABELS: Record<string, string> = {
  'dopravní': 'Dopravní stavba',
  'mostní': 'Mostní stavba',
  'pozemní_bytová': 'Pozemní — bytová',
  'pozemní_občanská': 'Pozemní — občanská',
  'průmyslová': 'Průmyslová stavba',
  'rekonstrukce': 'Rekonstrukce',
  'inženýrské_sítě': 'Inženýrské sítě',
  'vegetační': 'Vegetační úpravy',
  'nestavební': 'Nestavební dokument',
};

// Non-construction document type labels
const NONCONSTRUCTION_TYPE_LABELS: Record<string, string> = {
  'legal': 'Právní dokument',
  'invoice': 'Faktura',
  'correspondence': 'Korespondence',
  'other': 'Ostatní',
  'unknown': 'Neznámý typ',
};

// Generic formatter for values
function formatValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return value.toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'Ano' : 'Ne';
  }
  return String(value);
}

// Generic field renderer — renders key-value pairs for any data
function renderFieldGrid(
  data: Record<string, any>,
  labels: Record<string, string>,
  sources?: Record<string, string>,
  skipKeys: string[] = ['sources', 'source_pages', 'related_sos', 'greened_sos',
    'tree_species', 'shrub_species', 'sections', 'lawn_methods', 'lawn_seed_mix',
    'phases', 'closures', 'detours', 'phase_so_mapping', 'provisional_roads',
    'intersections', 'driveways', 'pavement_layers']
) {
  const entries = Object.entries(data).filter(
    ([key, val]) => val != null && val !== '' && !skipKeys.includes(key) && !key.startsWith('_')
  );

  if (entries.length === 0) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '8px',
    }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            {labels[key] || key.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>
            {formatValue(value)}
            {sources?.[key] && (
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary, #999)', marginLeft: '6px' }}>
                ← {sources[key]}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== MAIN COMPONENT =====

export default function SOCard({ so }: SOCardProps) {
  const contradictionCount = so.contradictions?.length || 0;
  const criticalCount = so.contradictions?.filter(c => c.severity === 'critical').length || 0;
  const typeLabel = so.so_category_label
    || (so.structure_type ? (STRUCTURE_TYPE_LABELS[so.structure_type] || so.structure_type) : null);

  // Coverage summary
  const covEntries = Object.entries(so.coverage || {});
  const covPresent = covEntries.filter(([, v]) => v).length;
  const covTotal = covEntries.length;

  return (
    <div
      className="c-card"
      style={{
        padding: '20px',
        marginBottom: '16px',
        borderLeft: criticalCount > 0 ? '4px solid #e74c3c' : '4px solid #FF9F1C',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
          {so.so_code}
          {so.so_name && <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '8px' }}>— {so.so_name}</span>}
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {typeLabel && (
            <span className="c-badge" style={{ backgroundColor: '#FF9F1C', color: '#fff', padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
              {typeLabel}
            </span>
          )}
          {so.construction_type && (
            <span className="c-badge" style={{ backgroundColor: so.is_non_construction ? '#95a5a6' : '#3498db', color: '#fff', padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
              {CONSTRUCTION_TYPE_LABELS[so.construction_type] || so.construction_type}
            </span>
          )}
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {so.file_count || so.files?.length || 0} souborů
          </span>
          {covTotal > 0 && (
            <span style={{ fontSize: '12px', color: covPresent === covTotal ? '#27ae60' : '#f39c12' }}>
              {covPresent}/{covTotal} typů
            </span>
          )}
          {contradictionCount > 0 && (
            <span className="c-badge" style={{
              backgroundColor: criticalCount > 0 ? '#e74c3c' : '#f39c12',
              color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
            }}>
              {contradictionCount} rozporů
            </span>
          )}
        </div>
      </div>

      {/* Technical data — universal for ALL structure types */}
      {so.technical && (
        <Section title="Technické údaje">
          {renderFieldGrid(so.technical as any, TECHNICAL_LABELS, so.sources)}
        </Section>
      )}

      {/* Bridge params — ONLY for SO 2xx */}
      {so.bridge_params && (
        <Section title="Parametry mostu (ČSN 73 6200)">
          {renderFieldGrid(so.bridge_params as any, BRIDGE_LABELS, so.sources)}
        </Section>
      )}

      {/* Road params — SO 1xx */}
      {so.road_params && (
        <Section title="Pozemní komunikace">
          {renderFieldGrid(so.road_params as any, ROAD_LABELS, so.sources)}
          {renderPavementLayers(so.road_params)}
          {renderIntersections(so.road_params)}
        </Section>
      )}

      {/* Traffic DIO — SO 180 */}
      {so.traffic_params && (
        <Section title="Dopravně inženýrská opatření">
          {renderFieldGrid(so.traffic_params as any, DIO_LABELS, so.sources)}
          {renderPhases(so.traffic_params)}
          {renderClosures(so.traffic_params)}
          {renderDetours(so.traffic_params)}
        </Section>
      )}

      {/* Water infrastructure — SO 3xx */}
      {so.water_params && (
        <Section title="Vodohospodářský objekt">
          {renderFieldGrid(so.water_params as any, WATER_LABELS, so.sources)}
        </Section>
      )}

      {/* Vegetation — SO 8xx */}
      {so.vegetation_params && (
        <Section title="Vegetační úpravy">
          {renderFieldGrid(so.vegetation_params as any, VEGETATION_LABELS, so.sources)}
          {renderSpecies(so.vegetation_params)}
        </Section>
      )}

      {/* Electro — SO 4xx */}
      {so.electro_params && (
        <Section title="Elektro a sdělovací">
          {renderFieldGrid(so.electro_params as any, ELECTRO_LABELS, so.sources)}
        </Section>
      )}

      {/* Pipeline — SO 5xx */}
      {so.pipeline_params && (
        <Section title="Trubní vedení">
          {renderFieldGrid(so.pipeline_params as any, PIPELINE_LABELS, so.sources)}
        </Section>
      )}

      {/* Signage — SO 190 */}
      {so.signage_params && (
        <Section title="Dopravní značení">
          {renderFieldGrid(so.signage_params as any, SIGNAGE_LABELS, so.sources)}
        </Section>
      )}

      {/* ===== D.1.4 Profession sections (pozemní TZB) ===== */}

      {/* Silnoproud — power electrics */}
      {so.silnoproud_params && (
        <Section title="Silnoproud (elektroinstalace)">
          {renderFieldGrid(so.silnoproud_params as any, SILNOPROUD_LABELS, so.silnoproud_params.sources)}
          {so.silnoproud_params.switchboards && so.silnoproud_params.switchboards.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Rozvaděče ({so.silnoproud_params.switchboards.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {so.silnoproud_params.switchboards.map((sw: any, i: number) => (
                  <span key={i} style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(59,130,246,0.1)', borderRadius: 4, color: '#3b82f6' }}>
                    {sw.name || sw.label || `Rozvaděč ${i + 1}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Slaboproud — low-voltage systems */}
      {so.slaboproud_params && (
        <Section title="Slaboproud (ELV systémy)">
          {renderFieldGrid(so.slaboproud_params as any, SLABOPROUD_LABELS, so.slaboproud_params.sources)}
          {so.slaboproud_params.subsystems && so.slaboproud_params.subsystems.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {so.slaboproud_params.subsystems.map((ss: string, i: number) => (
                <span key={i} style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(139,92,246,0.1)', borderRadius: 4, color: '#8b5cf6', fontWeight: 500 }}>
                  {ss}
                </span>
              ))}
            </div>
          )}
          {/* Render each subsystem detail block if present */}
          {(['scs', 'pzts', 'skv', 'cctv', 'eps', 'avt', 'intercom'] as const).map(key => {
            const sub = (so.slaboproud_params as any)?.[key];
            if (!sub || typeof sub !== 'object') return null;
            const subLabels: Record<string, string> = {
              scs: 'SCS (strukturovaná kabeláž)', pzts: 'PZTS (zabezpečení)', skv: 'SKV (přístup)',
              cctv: 'CCTV (kamerový systém)', eps: 'EPS (požární signalizace)', avt: 'AVT (audiovizuální)',
              intercom: 'Domovní telefon',
            };
            return (
              <div key={key} style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {subLabels[key]}
                </div>
                {renderFieldGrid(sub, {}, undefined)}
              </div>
            );
          })}
        </Section>
      )}

      {/* VZT — ventilation / HVAC */}
      {so.vzt_params && (
        <Section title="Vzduchotechnika a klimatizace (VZT)">
          {renderFieldGrid(so.vzt_params as any, VZT_LABELS, so.vzt_params.sources)}
          {so.vzt_params.devices && so.vzt_params.devices.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                Zařízení ({so.vzt_params.devices.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                {so.vzt_params.devices.map((dev: any, i: number) => (
                  <div key={i} style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dev.label || dev.name || dev.device_type || `Zařízení ${i + 1}`}</div>
                    {dev.airflow_supply_m3h && <div style={{ color: 'var(--text-secondary)' }}>Přívod: {dev.airflow_supply_m3h} m³/h</div>}
                    {dev.airflow_exhaust_m3h && <div style={{ color: 'var(--text-secondary)' }}>Odvod: {dev.airflow_exhaust_m3h} m³/h</div>}
                    {dev.heating_kw && <div style={{ color: 'var(--text-secondary)' }}>Topení: {dev.heating_kw} kW</div>}
                    {dev.cooling_kw && <div style={{ color: 'var(--text-secondary)' }}>Chlazení: {dev.cooling_kw} kW</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ZTI — plumbing */}
      {so.zti_params && (
        <Section title="Zdravotně technické instalace (ZTI)">
          {renderFieldGrid(so.zti_params as any, ZTI_LABELS, so.zti_params.sources)}
          {/* Subsystem details */}
          {(['sewage', 'rainwater', 'cold_water', 'hot_water'] as const).map(key => {
            const sub = (so.zti_params as any)?.[key];
            if (!sub || typeof sub !== 'object') return null;
            const subLabels: Record<string, string> = {
              sewage: 'Splašková kanalizace', rainwater: 'Dešťová kanalizace',
              cold_water: 'Studená voda', hot_water: 'Teplá voda',
            };
            return (
              <div key={key} style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {subLabels[key]}
                </div>
                {renderFieldGrid(sub, {}, undefined)}
              </div>
            );
          })}
          {/* Fixtures */}
          {so.zti_params.fixtures && so.zti_params.fixtures.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                Zařizovací předměty ({so.zti_params.fixtures.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {so.zti_params.fixtures.map((f: any, i: number) => (
                  <span key={i} style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(16,185,129,0.1)', borderRadius: 4, color: '#10b981' }}>
                    {f.name || f.type || `Předmět ${i + 1}`}{f.count ? ` ×${f.count}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* UT — heating */}
      {so.ut_params && (
        <Section title="Ústřední vytápění (ÚT)">
          {renderFieldGrid(so.ut_params as any, UT_LABELS, so.ut_params.sources)}
          {/* Heat source detail */}
          {so.ut_params.heat_source && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(239,68,68,0.04)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Zdroj tepla</div>
              {renderFieldGrid(so.ut_params.heat_source as any, {
                type: 'Typ', brand: 'Výrobce', model: 'Model', fuel: 'Palivo',
                output_kw: 'Výkon (kW)', efficiency_pct: 'Účinnost (%)', cascade_count: 'Kaskáda',
              }, undefined)}
            </div>
          )}
          {so.ut_params.heating_system && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Otopná soustava</div>
              {renderFieldGrid(so.ut_params.heating_system as any, {
                system_type: 'Typ soustavy', medium: 'Teplonosná látka',
                supply_temp_c: 'Přívodní teplota (°C)', return_temp_c: 'Vratná teplota (°C)',
                pipe_material: 'Materiál potrubí', insulation: 'Izolace',
              }, undefined)}
            </div>
          )}
        </Section>
      )}

      {/* MaR — automation */}
      {so.mar_params && (
        <Section title="Měření a regulace (MaR)">
          {renderFieldGrid(so.mar_params as any, MAR_LABELS, so.mar_params.sources)}
        </Section>
      )}

      {/* ===== Railway sections ===== */}

      {/* Železniční svršek */}
      {so.zel_svrsek_params && (
        <Section title="Železniční svršek">
          {renderFieldGrid(so.zel_svrsek_params as any, ZEL_SVRSEK_LABELS, so.zel_svrsek_params.sources)}
          {so.zel_svrsek_params.gpk && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>GPK (geometrické parametry koleje)</div>
              {renderFieldGrid(so.zel_svrsek_params.gpk as any, {
                gauge_mm: 'Rozchod (mm)', cant_mm: 'Převýšení (mm)',
                twist_max_mm_m: 'Max. zborcení (mm/m)', alignment_max_mm: 'Max. směr (mm)',
                level_max_mm: 'Max. výška (mm)', quality_number: 'Číslo kvality',
              }, undefined)}
            </div>
          )}
          {so.zel_svrsek_params.track_frame && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Kolejový rošt</div>
              {renderFieldGrid(so.zel_svrsek_params.track_frame as any, {
                rail_type: 'Typ kolejnice', rail_steel: 'Ocel kolejnice',
                sleeper_type: 'Typ pražce', sleeper_spacing_mm: 'Rozdělení (mm)',
                fastening_type: 'Upevnění', ballast_type: 'Štěrkové lože',
                ballast_thickness_mm: 'Tloušťka lože (mm)',
              }, undefined)}
            </div>
          )}
        </Section>
      )}

      {/* Železniční spodek */}
      {so.zel_spodek_params && (
        <Section title="Železniční spodek">
          {renderFieldGrid(so.zel_spodek_params as any, ZEL_SPODEK_LABELS, so.zel_spodek_params.sources)}
          {so.zel_spodek_params.kpp_zones && so.zel_spodek_params.kpp_zones.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                KPP zóny ({so.zel_spodek_params.kpp_zones.length})
              </div>
              {so.zel_spodek_params.kpp_zones.map((zone: any, i: number) => (
                <div key={i} style={{ padding: '4px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{zone.zone_name || zone.label || `Zóna ${i + 1}`}</span>
                  {zone.start_km != null && <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>km {zone.start_km}–{zone.end_km}</span>}
                  {zone.material && <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{zone.material}</span>}
                  {zone.thickness_mm && <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{zone.thickness_mm} mm</span>}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* IGP — inženýrsko-geologický průzkum */}
      {so.igp_params && (
        <Section title="Inženýrsko-geologický průzkum (IGP)">
          {renderFieldGrid(so.igp_params as any, IGP_LABELS, so.igp_params.sources)}
          {so.igp_params.probes && so.igp_params.probes.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                Sondy ({so.igp_params.probes.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                {so.igp_params.probes.map((probe: any, i: number) => (
                  <div key={i} style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{probe.probe_id || probe.name || `Sonda ${i + 1}`}</div>
                    {probe.depth_m && <div style={{ color: 'var(--text-secondary)' }}>Hloubka: {probe.depth_m} m</div>}
                    {probe.type && <div style={{ color: 'var(--text-secondary)' }}>{probe.type}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {so.igp_params.geology && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Geologie</div>
              {renderFieldGrid(so.igp_params.geology as any, {}, undefined)}
            </div>
          )}
          {so.igp_params.conclusion_summary && (
            <div style={{ marginTop: 8, padding: 10, background: 'rgba(59,130,246,0.05)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {so.igp_params.conclusion_summary}
            </div>
          )}
        </Section>
      )}

      {/* GTP — geotechnical */}
      {so.gtp && (
        <Section title="Geotechnika">
          {renderGTP(so.gtp, so.sources)}
        </Section>
      )}

      {/* Non-construction document summary */}
      {so.is_non_construction && so.generic_summary && (
        <Section title="Nestavební dokument">
          {renderGenericSummary(so.generic_summary)}
        </Section>
      )}

      {/* Section IDs found in content */}
      {so.section_ids && so.section_ids.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Identifikátory: {so.section_ids.map(s => `${s.type} ${s.id}`).join(', ')}
        </div>
      )}

      {/* Related SOs from any params */}
      {renderRelatedSOs(so)}

      {/* File list */}
      {so.files && so.files.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>
            Zdrojové soubory
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {so.files.map((f, i) => (
              <span key={i} style={{ fontSize: '12px', padding: '2px 8px', backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Section wrapper =====
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <h4 style={{
        margin: '0 0 8px',
        fontSize: '13px',
        fontWeight: 700,
        color: '#FF9F1C',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

// ===== GTP renderer =====
function renderGTP(gtp: GTPExtraction, sources?: Record<string, string>) {
  return (
    <div>
      {renderFieldGrid(
        {
          water_aggressivity: gtp.water_aggressivity,
          geotechnical_category: gtp.geotechnical_category,
          stray_current_class: gtp.stray_current_class,
          foundation_recommendation: gtp.foundation_recommendation,
          pile_depth_estimate: gtp.pile_depth_estimate,
        },
        GTP_LABELS,
        sources,
      )}
      {gtp.boreholes && gtp.boreholes.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Vrty</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {gtp.boreholes.map((bh, i) => (
              <div key={i} style={{ padding: '6px 10px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '6px', fontSize: '12px' }}>
                <strong>{bh.borehole_id}</strong>
                {bh.depth_m != null && <span> — {bh.depth_m} m</span>}
                {bh.layers && <span style={{ color: 'var(--text-secondary)' }}> ({bh.layers.length} vrstev)</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {gtp.aggressivity_details && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {Object.entries(gtp.aggressivity_details).map(([k, v]) => (
            <span key={k} style={{ marginRight: '12px' }}>{k}: <strong>{String(v)}</strong></span>
          ))}
        </div>
      )}
      {gtp.settlements && gtp.settlements.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Sedání</div>
          {gtp.settlements.map((s, i) => (
            <div key={i} style={{ fontSize: '12px' }}>
              {s.location}: <strong>{s.value_cm} cm</strong>
              {s.consolidation_95pct_days && <span style={{ color: 'var(--text-secondary)' }}> (konsolidace 95%: {s.consolidation_95pct_days} dní)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Road: Pavement Layers =====
function renderPavementLayers(road: RoadSOParams) {
  if (!road.pavement_layers || road.pavement_layers.length === 0) return null;
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Skladba vozovky</div>
      {road.pavement_layers.map((layer, i) => (
        <div key={i} style={{ fontSize: '12px', padding: '3px 0', borderLeft: '2px solid #FF9F1C', paddingLeft: '8px', marginBottom: '2px' }}>
          {i + 1}. {layer}
        </div>
      ))}
    </div>
  );
}

// ===== Road: Intersections =====
function renderIntersections(road: RoadSOParams) {
  if (!road.intersections || road.intersections.length === 0) return null;
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Křižovatky</div>
      {road.intersections.map((ix, i) => (
        <div key={i} style={{ fontSize: '12px', padding: '3px 0' }}>
          km {ix.km} — {ix.type}{ix.angle ? ` (${ix.angle})` : ''}{ix.so ? ` → ${ix.so}` : ''}
        </div>
      ))}
    </div>
  );
}

// ===== DIO: Construction Phases =====
function renderPhases(dio: TrafficDIOParams) {
  if (!dio.phases || dio.phases.length === 0) return null;
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Fáze výstavby</div>
      {dio.phases.map((phase, i) => (
        <div key={i} style={{ padding: '8px', marginBottom: '6px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '6px', borderLeft: '3px solid #FF9F1C' }}>
          <div style={{ fontWeight: 600, fontSize: '13px' }}>
            {phase.phase_number}. fáze{phase.name ? ` — ${phase.name}` : ''}
            {phase.duration_weeks && <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> ({phase.duration_weeks} týdnů)</span>}
          </div>
          {phase.sos_in_phase && phase.sos_in_phase.length > 0 && (
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              SO: {phase.sos_in_phase.join(', ')}
            </div>
          )}
          {phase.traffic_restrictions && phase.traffic_restrictions.length > 0 && (
            <div style={{ fontSize: '12px', color: '#e74c3c', marginTop: '2px' }}>
              Omezení: {phase.traffic_restrictions.join('; ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== DIO: Closures =====
function renderClosures(dio: TrafficDIOParams) {
  if (!dio.closures || dio.closures.length === 0) return null;
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Uzavírky</div>
      {dio.closures.map((cl, i) => (
        <div key={i} style={{ fontSize: '12px', padding: '3px 0' }}>
          <strong>{cl.road}</strong> — {cl.closure_type} (fáze {cl.phase}): {cl.reason}
        </div>
      ))}
    </div>
  );
}

// ===== DIO: Detour Routes =====
function renderDetours(dio: TrafficDIOParams) {
  if (!dio.detours || dio.detours.length === 0) return null;
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Objízdné trasy</div>
      {dio.detours.map((dt, i) => (
        <div key={i} style={{ fontSize: '12px', padding: '3px 0' }}>
          Pro <strong>{dt.for_road}</strong>: {dt.route_description}
          {dt.roads_used && dt.roads_used.length > 0 && (
            <span style={{ color: 'var(--text-secondary)' }}> (přes {dt.roads_used.join(', ')})</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== Vegetation: Species =====
function renderSpecies(veg: VegetationSOParams) {
  const allSpecies = [
    ...(veg.tree_species || []),
    ...(veg.shrub_species || []),
  ];
  if (allSpecies.length === 0) return null;
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Druhy rostlin</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            <th style={thStyle}>Kód</th>
            <th style={thStyle}>Český název</th>
            <th style={thStyle}>Latinský název</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Počet</th>
            <th style={thStyle}>Kategorie</th>
          </tr>
        </thead>
        <tbody>
          {allSpecies.map((sp, i) => (
            <tr key={i}>
              <td style={tdStyle}><strong>{sp.code}</strong></td>
              <td style={tdStyle}>{sp.czech_name}</td>
              <td style={{ ...tdStyle, fontStyle: 'italic' }}>{sp.latin_name}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{sp.total_count}</td>
              <td style={tdStyle}>{sp.size_category}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== Related SOs (from any params) =====
function renderRelatedSOs(so: MergedSO) {
  const sos: string[] = [];
  const params = [so.bridge_params, so.road_params, so.water_params,
    so.vegetation_params, so.traffic_params, so.electro_params,
    so.pipeline_params, so.signage_params];
  for (const p of params) {
    if (p && 'related_sos' in p && Array.isArray((p as any).related_sos)) {
      for (const s of (p as any).related_sos) {
        if (!sos.includes(s)) sos.push(s);
      }
    }
  }
  if (sos.length === 0) return null;
  return (
    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
      Související SO: {sos.join(', ')}
    </div>
  );
}

// ===== Non-construction document summary =====
function renderGenericSummary(summary: GenericSummary) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px' }}>
          Typ: <strong>{NONCONSTRUCTION_TYPE_LABELS[summary.document_type] || summary.document_type}</strong>
        </span>
        {summary.title && (
          <span style={{ fontSize: '12px' }}>
            Předmět: <strong>{summary.title}</strong>
          </span>
        )}
      </div>
      {summary.summary && (
        <div style={{ fontSize: '12px', padding: '8px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '6px', marginBottom: '8px' }}>
          {summary.summary}
        </div>
      )}
      {summary.key_entities && summary.key_entities.length > 0 && (
        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
          Entity: {summary.key_entities.map((e, i) => (
            <span key={i} style={{ padding: '1px 6px', backgroundColor: 'rgba(52,152,219,0.1)', borderRadius: '3px', marginRight: '4px', fontSize: '11px' }}>
              {e}
            </span>
          ))}
        </div>
      )}
      {summary.dates_found && summary.dates_found.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Data: {summary.dates_found.join(', ')}
        </div>
      )}
      {summary.amounts_found && summary.amounts_found.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Částky: {summary.amounts_found.join(', ')}
        </div>
      )}
    </div>
  );
}

// ===== Shared table styles =====
const thStyle: CSSProperties = {
  padding: '6px 8px',
  borderBottom: '2px solid rgba(0,0,0,0.1)',
  textAlign: 'left',
  fontSize: '10px',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  fontWeight: 700,
};

const tdStyle: CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid rgba(0,0,0,0.04)',
};
