import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import type { ModelConfig } from '../../types/connection';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface Props {
  orgId?: string | null;
}

export default function ModelConfigPanel({ orgId }: Props) {
  const { token } = useAuth();
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, [orgId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const params = orgId ? `?org_id=${orgId}` : '';
      const resp = await axios.get(`${API_URL}/api/connections/model-config${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfig(resp.data.config);
      setSource(resp.data.source);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Nacitam konfiguraci modelu...</div>;
  if (!config) return null;

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '16px 20px',
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
        Smerovani AI modelu
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
        <div>
          <div style={{ color: '#6b7280', marginBottom: 2 }}>Primarni</div>
          <div style={{ fontWeight: 600, color: '#111827' }}>{config.primary}</div>
        </div>
        <div>
          <div style={{ color: '#6b7280', marginBottom: 2 }}>Zalopni (fallback)</div>
          <div style={{ fontWeight: 600, color: '#111827' }}>{config.fallback}</div>
        </div>
      </div>

      {config.available_providers && config.available_providers.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>Dostupni provideri</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {config.available_providers.map(p => (
              <span key={p} style={{
                padding: '2px 8px', background: '#f3f4f6', borderRadius: 4,
                fontSize: 12, fontWeight: 500, color: '#374151',
              }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {config.model_overrides && Object.keys(config.model_overrides).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>Konkretni modely</div>
          {Object.entries(config.model_overrides).map(([provider, model]) => (
            <div key={provider} style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>
              <span style={{ fontWeight: 600 }}>{provider}:</span>{' '}
              <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{model}</code>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
        Zdroj: {source === 'org' ? 'Konfigurace organizace' : 'Vychozi nastaveni'}
      </div>
    </div>
  );
}
