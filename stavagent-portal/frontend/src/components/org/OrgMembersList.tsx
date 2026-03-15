import { useState } from 'react';
import axios from 'axios';
import { OrgMember, OrgRole, ORG_ROLE_LABELS } from '../../types/org';
import { useAuth } from '../../context/AuthContext';
import OrgRoleBadge from './OrgRoleBadge';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface OrgMembersListProps {
  orgId: string;
  members: OrgMember[];
  myRole: OrgRole;
  ownerId: number;
  onChanged: () => void;
}

export default function OrgMembersList({ orgId, members, myRole, ownerId, onChanged }: OrgMembersListProps) {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  async function changeRole(userId: number, role: OrgRole) {
    setLoading(`role-${userId}`);
    try {
      await axios.patch(`${API_URL}/api/orgs/${orgId}/members/${userId}`, { role }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onChanged();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Chyba při změně role');
    } finally {
      setLoading(null);
    }
  }

  async function removeMember(userId: number, name: string) {
    if (!confirm(`Odebrat ${name} z organizace?`)) return;
    setLoading(`remove-${userId}`);
    try {
      await axios.delete(`${API_URL}/api/orgs/${orgId}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onChanged();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Chyba při odebírání člena');
    } finally {
      setLoading(null);
    }
  }

  const canManage = myRole === 'admin';
  const roles: OrgRole[] = ['admin', 'manager', 'estimator', 'viewer', 'api_client'];

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>Člen</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>Email</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>Role</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>Připojen</th>
            {canManage && <th style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>Akce</th>}
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>
                {m.name}
                {m.user_id === ownerId && (
                  <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 10, marginLeft: 6 }}>
                    Vlastník
                  </span>
                )}
              </td>
              <td style={{ padding: '10px 12px', color: '#6b7280' }}>{m.email}</td>
              <td style={{ padding: '10px 12px' }}>
                {canManage && m.user_id !== ownerId && m.user_id !== user?.id ? (
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.user_id, e.target.value as OrgRole)}
                    disabled={loading === `role-${m.user_id}`}
                    style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <OrgRoleBadge role={m.role} />
                )}
              </td>
              <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 12 }}>
                {m.joined_at ? new Date(m.joined_at).toLocaleDateString('cs-CZ') : '(čeká)'}
              </td>
              {canManage && (
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {m.user_id !== ownerId && m.user_id !== user?.id && (
                    <button
                      onClick={() => removeMember(m.user_id, m.name)}
                      disabled={loading === `remove-${m.user_id}`}
                      style={{
                        background: 'none', border: '1px solid #fca5a5', color: '#dc2626',
                        padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12
                      }}
                    >
                      {loading === `remove-${m.user_id}` ? '...' : 'Odebrat'}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {members.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 14 }}>
          Zatím žádní členové
        </div>
      )}
    </div>
  );
}
