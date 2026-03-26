/**
 * SOCard — Universal data-driven card for one Stavební Objekt (SO).
 *
 * Renders whatever data the backend returned:
 * - Technical data (any structure type)
 * - Bridge params (only if bridge_params exists)
 * - GTP data (only if gtp exists)
 * - Source tracking (which file each field came from)
 *
 * NO hardcoded bridge layout — purely data-driven.
 */

import type { CSSProperties, ReactNode } from 'react';
import type { MergedSO, BridgeSOParams, GTPExtraction, TechnicalExtraction } from '../../types/passport';

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
  pile_change_note: 'Změna pilot',
  concrete_nk: 'Beton NK',
  concrete_substructure: 'Beton spodní stavba',
  concrete_protection: 'Beton ochrana',
  concrete_foundation: 'Beton základy',
  reinforcement: 'Výztuž',
  settlement_abutment_1_mm: 'Sedání opěra 1',
  settlement_abutment_2_mm: 'Sedání opěra 2',
  deflection_span_mm: 'Průhyb pole',
  consolidation_95pct_days: 'Konsolidace 95%',
  pko_aggressivity: 'Agresivita prostředí',
  stray_current_protection: 'Bludné proudy',
  obstacle_crossed: 'Překonávaná překážka',
  chainage_km: 'Staničení',
  csn_4_1: '4.1 Druh mostu',
  csn_4_2: '4.2 Překážka',
  csn_4_3: '4.3 Počet polí',
  csn_4_5: '4.5 Materiál',
  csn_4_12: '4.12 Šikmost',
  csn_4_14: '4.14 Směrové řešení',
  transverse_slope_pct: 'Příčný sklon',
  longitudinal_slope_pct: 'Podélný sklon',
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
  skipKeys: string[] = ['sources', 'source_pages', 'related_sos']
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

export default function SOCard({ so }: SOCardProps) {
  const contradictionCount = so.contradictions?.length || 0;
  const criticalCount = so.contradictions?.filter(c => c.severity === 'critical').length || 0;
  const typeLabel = so.structure_type ? (STRUCTURE_TYPE_LABELS[so.structure_type] || so.structure_type) : null;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
          {so.so_code}
          {so.so_name && <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '8px' }}>— {so.so_name}</span>}
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {typeLabel && (
            <span className="c-badge" style={{ backgroundColor: '#FF9F1C', color: '#fff', padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
              {typeLabel}
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
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
            }}>
              {contradictionCount} rozporů
            </span>
          )}
        </div>
      </div>

      {/* Technical data section — universal for ALL structure types */}
      {so.technical && (
        <Section title="Technické údaje">
          {renderFieldGrid(so.technical as any, TECHNICAL_LABELS, so.sources)}
        </Section>
      )}

      {/* Bridge params section — ONLY if bridge_params exists */}
      {so.bridge_params && (
        <Section title="Parametry mostu (ČSN 73 6200)">
          {renderFieldGrid(so.bridge_params as any, BRIDGE_LABELS, so.sources)}
        </Section>
      )}

      {/* GTP section — ONLY if gtp exists */}
      {so.gtp && (
        <Section title="Geotechnika">
          {renderGTP(so.gtp, so.sources)}
        </Section>
      )}

      {/* Related SOs */}
      {so.bridge_params?.related_sos && so.bridge_params.related_sos.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Související SO: {so.bridge_params.related_sos.join(', ')}
        </div>
      )}

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

// Section wrapper
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

// GTP renderer
function renderGTP(gtp: GTPExtraction, sources?: Record<string, string>) {
  return (
    <div>
      {/* Summary fields */}
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

      {/* Boreholes */}
      {gtp.boreholes && gtp.boreholes.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Vrty
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {gtp.boreholes.map((bh, i) => (
              <div key={i} style={{
                padding: '6px 10px',
                backgroundColor: 'rgba(0,0,0,0.03)',
                borderRadius: '6px',
                fontSize: '12px',
              }}>
                <strong>{bh.borehole_id}</strong>
                {bh.depth_m != null && <span> — {bh.depth_m} m</span>}
                {bh.layers && <span style={{ color: 'var(--text-secondary)' }}> ({bh.layers.length} vrstev)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aggressivity details */}
      {gtp.aggressivity_details && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {Object.entries(gtp.aggressivity_details).map(([k, v]) => (
            <span key={k} style={{ marginRight: '12px' }}>
              {k}: <strong>{String(v)}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Settlements */}
      {gtp.settlements && gtp.settlements.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Sedání
          </div>
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
