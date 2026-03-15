import { useState } from 'react';
import axios from 'axios';
import { OrgRole, ORG_ROLE_LABELS } from '../../types/org';
import { useAuth } from '../../context/AuthContext';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface OrgInviteFormProps {
  orgId: string;
  onInvited: () => void;
}

export default function OrgInviteForm({ orgId, onInvited }: OrgInviteFormProps) {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('estimator');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const invitableRoles: OrgRole[] = ['manager', 'estimator', 'viewer', 'api_client'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/orgs/${orgId}/invite`, { email, role }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(`Pozvánka odeslána na ${email}`);
      setEmail('');
      onInvited();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při odesílání pozvánky');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ flex: 2, minWidth: 200 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
          Email
        </label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="kolega@firma.cz" required
          style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
          Role
        </label>
        <select
          value={role} onChange={e => setRole(e.target.value as OrgRole)}
          style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
        >
          {invitableRoles.map(r => (
            <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={loading || !email.trim()} style={{
        padding: '7px 18px', borderRadius: 6, border: 'none',
        background: loading ? '#9ca3af' : '#FF9F1C', color: '#fff',
        cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        whiteSpace: 'nowrap',
      }}>
        {loading ? 'Odesílání...' : 'Pozvat'}
      </button>

      {success && (
        <div style={{ width: '100%', background: '#d1fae5', color: '#065f46', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
          {success}
        </div>
      )}
      {error && (
        <div style={{ width: '100%', background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}
    </form>
  );
}
