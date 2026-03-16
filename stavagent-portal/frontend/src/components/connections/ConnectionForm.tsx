import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import type { ServiceConnection, ServiceType } from '../../types/connection';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_CATEGORIES } from '../../types/connection';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface Props {
  orgId?: string | null;
  editConnection?: ServiceConnection | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function ConnectionForm({ orgId, editConnection, onSaved, onCancel }: Props) {
  const { token } = useAuth();
  const [serviceType, setServiceType] = useState<ServiceType>(editConnection?.service_type || 'gemini');
  const [displayName, setDisplayName] = useState(editConnection?.display_name || '');
  const [credentials, setCredentials] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editConnection) {
      setServiceType(editConnection.service_type);
      setDisplayName(editConnection.display_name || '');
      setCredentials(''); // never pre-fill credentials
    }
  }, [editConnection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        service_type: serviceType,
        display_name: displayName || SERVICE_TYPE_LABELS[serviceType],
      };
      if (orgId) body.org_id = orgId;
      if (credentials.trim()) body.credentials = credentials.trim();

      if (editConnection) {
        await axios.put(`${API_URL}/api/connections/${editConnection.id}`, body, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        if (!credentials.trim()) {
          setError('API klic je povinny');
          setSaving(false);
          return;
        }
        body.credentials = credentials.trim();
        await axios.post(`${API_URL}/api/connections`, body, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: 24, marginBottom: 20,
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
        {editConnection ? 'Upravit pripojeni' : 'Nove pripojeni'}
      </h3>

      <form onSubmit={handleSubmit}>
        {/* Service type */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Typ sluzby
          </label>
          <select
            value={serviceType}
            onChange={e => setServiceType(e.target.value as ServiceType)}
            disabled={!!editConnection}
            style={{
              width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
              borderRadius: 6, fontSize: 14, background: editConnection ? '#f9fafb' : '#fff',
            }}
          >
            {Object.entries(SERVICE_TYPE_CATEGORIES).map(([category, types]) => (
              <optgroup key={category} label={category}>
                {types.map(t => (
                  <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Display name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Nazev (volitelne)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={SERVICE_TYPE_LABELS[serviceType]}
            style={{
              width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
              borderRadius: 6, fontSize: 14,
            }}
          />
        </div>

        {/* Credentials */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            API klic {editConnection ? '(ponechte prazdne pro zachovani)' : ''}
          </label>
          <input
            type="password"
            value={credentials}
            onChange={e => setCredentials(e.target.value)}
            placeholder={editConnection ? '••••••••' : 'sk-...'}
            style={{
              width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
              borderRadius: 6, fontSize: 14, fontFamily: 'monospace',
            }}
          />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Sifrovano pomoci AES-256-GCM. Klic se nikdy nezobrazuje v plnem zneni.
          </div>
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '8px 20px', fontSize: 14, fontWeight: 600,
              background: '#FF9F1C', color: '#fff', border: 'none',
              borderRadius: 6, cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Ukladam...' : (editConnection ? 'Ulozit' : 'Pridat')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 20px', fontSize: 14, fontWeight: 500,
              background: '#fff', color: '#374151', border: '1px solid #d1d5db',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            Zrusit
          </button>
        </div>
      </form>
    </div>
  );
}
