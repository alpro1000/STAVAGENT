import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Organization } from '../../types/org';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface OrgCreateProps {
  onCreated: (org: Organization) => void;
  onCancel: () => void;
}

export default function OrgCreate({ onCreated, onCancel }: OrgCreateProps) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function autoSlug(n: string) {
    return n.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  function handleNameChange(v: string) {
    setName(v);
    if (!slugManual) setSlug(autoSlug(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/orgs`, { name, slug }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onCreated(res.data.org);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při vytváření organizace');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
        Vytvořit organizaci
      </h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Název organizace *
          </label>
          <input
            value={name} onChange={e => handleNameChange(e.target.value)}
            placeholder="Moje Stavební Firma s.r.o."
            required style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Slug (URL identifikátor)
          </label>
          <input
            value={slug}
            onChange={e => { setSlug(e.target.value); setSlugManual(true); }}
            placeholder="moje-stavebni-firma"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
            Bude použit jako: /org/<strong>{slug || 'nazev-org'}</strong>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={{
            padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 14
          }}>
            Zrušit
          </button>
          <button type="submit" disabled={loading || !name.trim()} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: loading ? '#9ca3af' : '#FF9F1C', color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14
          }}>
            {loading ? 'Vytváření...' : 'Vytvořit'}
          </button>
        </div>
      </form>
    </div>
  );
}
