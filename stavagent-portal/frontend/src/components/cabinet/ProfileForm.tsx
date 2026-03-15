import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const TIMEZONES = [
  'Europe/Prague', 'Europe/Berlin', 'Europe/Warsaw', 'Europe/Vienna',
  'Europe/London', 'Europe/Paris', 'UTC',
];

export default function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [company, setCompany] = useState(user?.company ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'Europe/Prague');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess(false);
    setLoading(true);
    try {
      await updateProfile({ name, phone: phone || null, company: company || null, timezone });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Chyba při ukládání profilu');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: '#374151', marginBottom: 4
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#111827' }}>Osobní profil</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Jméno *</label>
            <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input value={user?.email ?? ''} disabled style={{ ...inputStyle, background: '#f9fafb', color: '#9ca3af', cursor: 'not-allowed' }} />
          </div>
          <div>
            <label style={labelStyle}>Telefon</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+420 ..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Společnost</label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Stavební firma s.r.o." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Časová zóna</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        {success && (
          <div style={{ marginTop: 14, background: '#d1fae5', color: '#065f46', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
            ✓ Profil uložen
          </div>
        )}
        {error && (
          <div style={{ marginTop: 14, background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={loading} style={{
            padding: '9px 24px', borderRadius: 6, border: 'none',
            background: loading ? '#9ca3af' : '#FF9F1C', color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14
          }}>
            {loading ? 'Ukládání...' : 'Uložit profil'}
          </button>
        </div>
      </form>
    </div>
  );
}
