/**
 * SummaryTab — Adaptive text summary.
 * Shows adaptive topics from summary_only mode, or a text overview from passport data.
 */

import type { PassportGenerationResponse, AdaptiveTopic } from '../../../types/passport';
import styles from './DocumentAnalysis.module.css';

interface SummaryTabProps {
  data: PassportGenerationResponse | null;
}

export default function SummaryTab({ data }: SummaryTabProps) {
  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Nejprve nahrajte dokument na z\u00e1lo\u017ece <strong>Soupis prac\u00ed</strong> nebo <strong>Passport</strong>.
      </div>
    );
  }

  const passport = data.passport;
  const topics: AdaptiveTopic[] = (passport as any).topics || [];
  const hasTopics = topics.length > 0;

  return (
    <div className={styles.resultPanel}>
      <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>
        {passport.project_name}
      </h3>

      {/* Description */}
      {passport.description && (
        <p style={{ margin: '0 0 20px', lineHeight: 1.8, fontSize: 15 }}>{passport.description}</p>
      )}

      {/* Topics (from adaptive summary) */}
      {hasTopics && topics.map((topic, index) => (
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
                kl\u00ed\u010dov\u00e9
              </span>
            )}
          </h4>
          <p style={{ margin: '0 0 8px', lineHeight: 1.8 }}>{topic.content}</p>
          {topic.key_facts?.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {topic.key_facts.map((fact, i) => (
                <li key={i} style={{ marginBottom: 2, color: topic.importance === 'high' ? 'var(--accent-orange)' : '#64748b' }}>{fact}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Fallback: technical highlights + stakeholders */}
      {!hasTopics && (
        <>
          {passport.technical_highlights?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className={styles.sectionHeader}>Technick\u00e9 hlavn\u00ed body</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {passport.technical_highlights.map((hl, i) => <li key={i} style={{ marginBottom: 2 }}>{hl}</li>)}
              </ul>
            </div>
          )}

          {passport.stakeholders?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className={styles.sectionHeader}>\u00da\u010dastn\u00edci</div>
              <table className={styles.dataTable}>
                <tbody>
                  {passport.stakeholders.map((s, i) => (
                    <tr key={i}><td className={styles.label}>{s.role}</td><td className={styles.value}>{s.name}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {passport.risks?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className={styles.sectionHeader}>Rizika</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {passport.risks.map((r, i) => (
                  <li key={i} style={{ marginBottom: 4, fontSize: 14 }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6,
                      backgroundColor: r.severity === 'High' ? '#EF4444' : r.severity === 'Medium' ? '#F59E0B' : '#10B981',
                    }} />
                    <strong>{r.risk_category}</strong>: {r.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Metadata */}
      <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'right', marginTop: 16 }}>
        Soubor: {data.metadata?.file_name || '\u2014'} |
        Parser: {data.metadata?.parser_used || '\u2014'} |
        Model: {data.metadata?.ai_model_used || 'none'}
      </div>
    </div>
  );
}
