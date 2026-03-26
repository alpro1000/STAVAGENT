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
