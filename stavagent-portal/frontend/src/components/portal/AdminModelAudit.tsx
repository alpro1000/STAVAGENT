import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';

interface AuditReportData {
  path: string;
  updated_at: string;
  size_bytes: number;
  content: string;
}

export default function AdminModelAudit() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReportData | null>(null);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminAPI.getModelAuditReport();
      setReport(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Nepodařilo se načíst audit report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  return (
    <section style={{ marginBottom: '48px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            🛡️ Model Audit Report (Admin)
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Přehled konektivity modelů, dostupnosti služeb a odhad token/cost metrik.
          </p>
        </div>

        <button onClick={loadReport} className="c-btn c-btn--primary" disabled={loading}>
          {loading ? 'Načítám…' : '🔄 Obnovit report'}
        </button>
      </div>

      {error && (
        <div className="c-panel" style={{ border: '1px solid #ef4444', background: '#fef2f2', marginBottom: '16px' }}>
          <p style={{ margin: 0, color: '#991b1b' }}>❌ {error}</p>
        </div>
      )}

      {report && (
        <div className="c-panel" style={{ marginBottom: '16px' }}>
          <p style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontWeight: 600 }}>
            Zdroj reportu: <code>{report.path}</code>
          </p>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
            Aktualizováno: {new Date(report.updated_at).toLocaleString('cs-CZ')} • Velikost: {report.size_bytes} B
          </p>
        </div>
      )}

      <div className="c-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <pre style={{
          margin: 0,
          padding: '16px',
          maxHeight: '70vh',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: '12px',
          lineHeight: 1.5,
          color: 'var(--text-primary)',
          background: 'var(--bg-primary)'
        }}>
          {loading ? 'Načítám report…' : (report?.content || 'Report není k dispozici')}
        </pre>
      </div>
    </section>
  );
}
