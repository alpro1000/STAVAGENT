/**
 * PassportTab — Structured passport display (concrete, reinforcement, dimensions, risks, etc.)
 * Also handles adaptive summary (topics) and type-specific extractions (TZ, RO, PD, HA).
 */

import { AlertTriangle, Zap } from 'lucide-react';
import type {
  PassportGenerationResponse,
  AdaptiveTopic,
  ClassificationInfo,
} from '../../../types/passport';
import { DOC_CATEGORY_LABELS, DOC_CATEGORY_COLORS } from '../../../types/passport';
import styles from './DocumentAnalysis.module.css';

interface PassportTabProps {
  data: PassportGenerationResponse;
}

const formatNumber = (value: number | undefined | null, decimals = 2): string => {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('cs-CZ', { maximumFractionDigits: decimals });
};

const formatDate = (date: string | null): string => {
  if (!date) return '-';
  try { return new Date(date).toLocaleDateString('cs-CZ'); } catch { return date; }
};

export default function PassportTab({ data }: PassportTabProps) {
  const { passport } = data;
  const isAdaptive = (data as any).analysis_mode === 'summary_only' || (data as any).format === 'adaptive_v2';
  const classification = (data as any).classification as ClassificationInfo | undefined;

  return (
    <div className={styles.resultPanel}>
      {/* Classification badge */}
      {classification && (() => {
        const catColor = DOC_CATEGORY_COLORS[classification.category] || '#9CA3AF';
        return (
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className={styles.classBadge} style={{ background: catColor }}>
              {classification.category} — {DOC_CATEGORY_LABELS[classification.category] || classification.category}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {classification.method === 'filename' ? 'Rozpoznáno z názvu souboru' :
               classification.method === 'keywords' ? 'Rozpoznáno z obsahu' :
               'Rozpoznáno pomocí AI'}
              {' '}({(classification.confidence * 100).toFixed(0)}%)
            </span>
            {classification.detected_keywords && classification.detected_keywords.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                [{classification.detected_keywords.slice(0, 3).join(', ')}]
              </span>
            )}
          </div>
        );
      })()}

      {/* Document header */}
      <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600 }}>{passport.project_name}</h3>
      {(passport as any).document_type && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{(passport as any).document_type}</div>
      )}
      {passport.structure_type && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Typ konstrukce: <strong>{passport.structure_type}</strong>
        </div>
      )}

      {/* Description */}
      {passport.description && (
        <p style={{ margin: '0 0 20px', lineHeight: 1.8, fontSize: 15 }}>{passport.description}</p>
      )}

      {/* Technical highlights */}
      {passport.technical_highlights?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className={styles.sectionHeader}>Technické hlavní body</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {passport.technical_highlights.map((hl, i) => <li key={i} style={{ marginBottom: 2 }}>{hl}</li>)}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {((passport as any).warnings || []).length > 0 && (
        <div className={styles.warningStrip}>
          <div className={styles.warningTitle}>
            <AlertTriangle size={14} />
            Upozornění
          </div>
          {((passport as any).warnings || []).map((w: string, i: number) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 2 }}>{w}</div>
          ))}
        </div>
      )}

      {/* Adaptive summary (topics) */}
      {isAdaptive ? (
        <AdaptiveTopics topics={(passport as any).topics || []} />
      ) : (
        <StructuredPassport data={data} />
      )}

      {/* Type-specific extractions */}
      <TypeSpecificExtractions data={data} />

      {/* Metadata */}
      <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'right', marginTop: 16 }}>
        Soubor: {data?.metadata?.file_name || '—'} | ID: {passport.passport_id} | Vygenerováno: {new Date(passport.generated_at).toLocaleString('cs-CZ')}
      </div>
    </div>
  );
}

/* ── Adaptive Topics ── */
function AdaptiveTopics({ topics }: { topics: AdaptiveTopic[] }) {
  return (
    <>
      {topics.map((topic, index) => (
        <div key={index} style={{ marginBottom: 22 }}>
          <h4 style={{
            margin: '0 0 6px', fontSize: 15, fontWeight: 600,
            color: topic.importance === 'high' ? 'var(--accent-orange)' : 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{topic.icon}</span>
            {topic.title}
            {topic.importance === 'high' && (
              <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--accent-orange)', color: '#fff', padding: '1px 6px', borderRadius: 8 }}>
                klíčové
              </span>
            )}
          </h4>
          <p style={{ margin: '0 0 8px', lineHeight: 1.8 }}>{topic.content}</p>
          {topic.key_facts?.length > 0 && (
            <table className={styles.dataTable}>
              <tbody>
                {topic.key_facts.map((fact, i) => (
                  <tr key={i}>
                    <td style={{ color: topic.importance === 'high' ? 'var(--accent-orange)' : '#64748b', fontWeight: 500 }}>{fact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </>
  );
}

/* ── Structured Passport ── */
function StructuredPassport({ data }: { data: PassportGenerationResponse }) {
  const { passport, statistics } = data;

  return (
    <>
      {/* Statistics */}
      {(statistics?.total_concrete_m3 || statistics?.total_reinforcement_t || statistics?.unique_concrete_classes || statistics?.unique_steel_grades) && (
        <table className={styles.dataTable}>
          <thead>
            <tr><th colSpan={2} style={{ borderBottom: '2px solid var(--accent-orange)' }}>Souhrnné údaje</th></tr>
          </thead>
          <tbody>
            {(statistics?.total_concrete_m3 ?? 0) > 0 && (
              <tr><td className={styles.label}>Beton celkem</td><td className={styles.accent}>{formatNumber(statistics!.total_concrete_m3)} m³</td></tr>
            )}
            {(statistics?.total_reinforcement_t ?? 0) > 0 && (
              <tr><td className={styles.label}>Výztuž celkem</td><td className={styles.value}>{formatNumber(statistics!.total_reinforcement_t)} t</td></tr>
            )}
            {(statistics?.unique_concrete_classes ?? 0) > 0 && (
              <tr><td className={styles.label}>Třídy betonu</td><td className={styles.value}>{statistics!.unique_concrete_classes}</td></tr>
            )}
            {(statistics?.unique_steel_grades ?? 0) > 0 && (
              <tr><td className={styles.label}>Ocelové třídy</td><td className={styles.value}>{statistics!.unique_steel_grades}</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Concrete specifications */}
      {passport.concrete_specifications.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className={styles.sectionHeader} style={{ borderBottom: '2px solid var(--accent-orange)' }}>Specifikace betonu</div>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Třída</th>
                <th>Expozice</th>
                <th style={{ textAlign: 'right' }}>Objem</th>
                <th>Vlastnosti</th>
              </tr>
            </thead>
            <tbody>
              {passport.concrete_specifications.map((spec, i) => (
                <tr key={i}>
                  <td className={styles.accent}>{spec.concrete_class}</td>
                  <td>{spec.exposure_classes?.join(', ') || '—'}</td>
                  <td className={styles.right}>{spec.volume_m3 !== null ? `${formatNumber(spec.volume_m3)} m³` : '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{spec.special_properties?.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reinforcement */}
      {passport.reinforcement.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className={styles.sectionHeader} style={{ borderBottom: '2px solid #64748b' }}>Výztuž</div>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Třída oceli</th>
                <th style={{ textAlign: 'right' }}>Hmotnost</th>
                <th>Průměry</th>
              </tr>
            </thead>
            <tbody>
              {passport.reinforcement.map((steel, i) => (
                <tr key={i}>
                  <td className={styles.value}>{steel.steel_grade}</td>
                  <td className={styles.right}>{steel.tonnage_t !== null ? `${formatNumber(steel.tonnage_t)} t` : '—'}</td>
                  <td style={{ fontSize: 12 }}>{steel.bar_diameters.length > 0 ? steel.bar_diameters.join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dimensions */}
      {passport.dimensions && (
        <div style={{ marginBottom: 24 }}>
          <div className={styles.sectionHeader} style={{ borderBottom: '2px solid #F59E0B' }}>Rozměry objektu</div>
          <table className={styles.dataTable}>
            <tbody>
              {passport.dimensions.floors_above_ground !== null && <tr><td className={styles.label}>Nadzemní podlaží</td><td className={styles.value}>{passport.dimensions.floors_above_ground} NP</td></tr>}
              {passport.dimensions.floors_underground !== null && <tr><td className={styles.label}>Podzemní podlaží</td><td className={styles.value}>{passport.dimensions.floors_underground} PP</td></tr>}
              {passport.dimensions.height_m !== null && <tr><td className={styles.label}>Výška</td><td className={styles.value}>{formatNumber(passport.dimensions.height_m)} m</td></tr>}
              {passport.dimensions.length_m !== null && <tr><td className={styles.label}>Délka</td><td className={styles.value}>{formatNumber(passport.dimensions.length_m)} m</td></tr>}
              {passport.dimensions.width_m !== null && <tr><td className={styles.label}>Šířka</td><td className={styles.value}>{formatNumber(passport.dimensions.width_m)} m</td></tr>}
              {passport.dimensions.built_up_area_m2 !== null && <tr><td className={styles.label}>Zastavěná plocha</td><td className={styles.value}>{formatNumber(passport.dimensions.built_up_area_m2)} m²</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Special requirements */}
      {passport.special_requirements.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className={styles.sectionHeader} style={{ borderBottom: '2px solid #FF9F1C' }}>Speciální požadavky</div>
          {passport.special_requirements.map((req, i) => (
            <div key={i} style={{ marginBottom: 8, paddingLeft: 10, borderLeft: '2px solid #FF9F1C' }}>
              <strong>{req.requirement_type}</strong>
              {req.standard && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>({req.standard})</span>}
              <span style={{ marginLeft: 6 }}>— {req.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      {passport.risks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className={styles.sectionHeader} style={{ borderBottom: '2px solid #EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} style={{ color: 'var(--accent-orange)' }} />
            Hodnocení rizik (AI)
          </div>
          <table className={styles.dataTable}>
            <thead>
              <tr><th style={{ width: 8 }}></th><th>Kategorie</th><th>Popis</th><th>Zmírnění</th></tr>
            </thead>
            <tbody>
              {passport.risks.map((risk, i) => (
                <tr key={i}>
                  <td>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: risk.severity === 'High' ? '#EF4444' : risk.severity === 'Medium' ? '#F59E0B' : '#10B981',
                    }} />
                  </td>
                  <td className={styles.value} style={{ whiteSpace: 'nowrap' }}>{risk.risk_category}</td>
                  <td>{risk.description}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{risk.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Location + Timeline + Stakeholders */}
      {(passport.location || passport.timeline || passport.stakeholders.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          <div className={styles.sectionHeader} style={{ borderBottom: '2px solid #6366F1', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} style={{ color: 'var(--accent-orange)' }} />
            Další informace (AI)
          </div>
          <table className={styles.dataTable}>
            <tbody>
              {passport.location?.city && <tr><td className={styles.label}>Město</td><td className={styles.value}>{passport.location.city}</td></tr>}
              {passport.location?.region && <tr><td className={styles.label}>Kraj</td><td className={styles.value}>{passport.location.region}</td></tr>}
              {passport.location?.address && <tr><td className={styles.label}>Adresa</td><td className={styles.value}>{passport.location.address}</td></tr>}
              {passport.timeline?.start_date && <tr><td className={styles.label}>Zahájení</td><td className={styles.value}>{formatDate(passport.timeline.start_date)}</td></tr>}
              {passport.timeline?.end_date && <tr><td className={styles.label}>Dokončení</td><td className={styles.value}>{formatDate(passport.timeline.end_date)}</td></tr>}
              {passport.timeline?.duration_months != null && <tr><td className={styles.label}>Délka trvání</td><td className={styles.value}>{passport.timeline.duration_months} měsíců</td></tr>}
              {passport.stakeholders.map((s, i) => (
                <tr key={i}><td className={styles.label}>{s.role}</td><td className={styles.value}>{s.name}</td></tr>
              ))}
            </tbody>
          </table>
          {(passport.timeline?.critical_milestones ?? []).length > 0 && passport.timeline && (
            <div style={{ marginTop: 10, paddingLeft: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Milníky: </span>
              <span style={{ fontSize: 13 }}>{passport.timeline.critical_milestones.join(' — ')}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ── Type-specific extractions (TZ, RO, PD, HA) ── */
function TypeSpecificExtractions({ data }: { data: PassportGenerationResponse }) {
  return (
    <>
      <KeyValueSection
        data={(data as any).technical}
        title="Technické parametry (AI extrakce)"
        borderColor="#3B82F6"
        mapFn={(t: any) => {
          const r: [string, string][] = [];
          if (t.structure_type) r.push(['Typ konstrukce', t.structure_type]);
          if (t.structure_subtype) r.push(['Podtyp', t.structure_subtype]);
          if (t.total_length_m) r.push(['Délka', `${t.total_length_m} m`]);
          if (t.width_m) r.push(['Šířka', `${t.width_m} m`]);
          if (t.height_m) r.push(['Výška', `${t.height_m} m`]);
          if (t.area_m2) r.push(['Plocha', `${t.area_m2} m²`]);
          if (t.volume_m3) r.push(['Objem', `${t.volume_m3} m³`]);
          if (t.span_count) r.push(['Počet polí', `${t.span_count}`]);
          if (t.span_lengths_m?.length) r.push(['Rozpětí', t.span_lengths_m.map((v: number) => `${v} m`).join(', ')]);
          if (t.concrete_grade) r.push(['Beton', t.concrete_grade]);
          if (t.reinforcement_grade) r.push(['Výztuž', t.reinforcement_grade]);
          if (t.foundation_type) r.push(['Základy', t.foundation_type]);
          if (t.fabrication_method) r.push(['Výstavba', t.fabrication_method]);
          if (t.load_class) r.push(['Zatížení', t.load_class]);
          if (t.design_life_years) r.push(['Životnost', `${t.design_life_years} let`]);
          if (t.construction_duration_months) r.push(['Doba výstavby', `${t.construction_duration_months} měsíců`]);
          if (t.applicable_standards?.length) r.push(['Normy', t.applicable_standards.join(', ')]);
          if (t.special_conditions?.length) r.push(['Speciální podmínky', t.special_conditions.join('; ')]);
          return r;
        }}
      />

      <KeyValueSection
        data={(data as any).bill_of_quantities}
        title="Rozpočet — souhrn (AI extrakce)"
        borderColor="#10B981"
        mapFn={(b: any) => {
          const r: [string, string][] = [];
          if (b.total_items) r.push(['Počet položek', `${b.total_items}`]);
          if (b.total_price_czk) r.push(['Celková cena', `${b.total_price_czk.toLocaleString('cs-CZ')} Kč`]);
          if (b.concrete_volume_m3) r.push(['Beton', `${b.concrete_volume_m3} m³`]);
          if (b.steel_tonnage_t) r.push(['Výztuž', `${b.steel_tonnage_t} t`]);
          if (b.earthwork_volume_m3) r.push(['Zemní práce', `${b.earthwork_volume_m3} m³`]);
          return r;
        }}
      />

      <KeyValueSection
        data={(data as any).tender_conditions}
        title="Zadávací podmínky (AI extrakce)"
        borderColor="#8B5CF6"
        mapFn={(p: any) => {
          const r: [string, string][] = [];
          if (p.tender_name) r.push(['Název zakázky', p.tender_name]);
          if (p.contracting_authority) r.push(['Zadavatel', p.contracting_authority]);
          if (p.submission_deadline) r.push(['Termín podání', p.submission_deadline]);
          if (p.question_deadline) r.push(['Termín pro dotazy', p.question_deadline]);
          if (p.estimated_budget) r.push(['Předpokládaná hodnota', `${Number(p.estimated_budget).toLocaleString('cs-CZ')} ${p.currency || 'CZK'}`]);
          if (p.submission_method) r.push(['Způsob podání', p.submission_method]);
          return r;
        }}
      />

      <KeyValueSection
        data={(data as any).schedule}
        title="Harmonogram (AI extrakce)"
        borderColor="#EC4899"
        mapFn={(s: any) => {
          const r: [string, string][] = [];
          if (s.total_duration_months) r.push(['Celková doba', `${s.total_duration_months} měsíců`]);
          if (s.start_date) r.push(['Zahájení', s.start_date]);
          if (s.end_date) r.push(['Dokončení', s.end_date]);
          return r;
        }}
      />
    </>
  );
}

/* ── Reusable key-value section ── */
function KeyValueSection({ data, title, borderColor, mapFn }: {
  data: any;
  title: string;
  borderColor: string;
  mapFn: (data: any) => [string, string][];
}) {
  if (!data) return null;
  const rows = mapFn(data);
  if (rows.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div className={styles.sectionHeader} style={{ borderBottom: `2px solid ${borderColor}` }}>{title}</div>
      <table className={styles.dataTable}>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={i}>
              <td className={styles.label}>{label}</td>
              <td className={styles.value}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
