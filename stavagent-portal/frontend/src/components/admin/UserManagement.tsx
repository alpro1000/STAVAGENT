/**
 * User Management Component
 * List, view, edit users with plan/quota controls
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  email_verified: boolean;
  email_verified_at?: string;
  phone?: string;
  phone_verified?: boolean;
  plan?: string;
  free_pipeline_runs_used?: number;
  registration_ip?: string;
  banned?: boolean;
  banned_at?: string;
  banned_reason?: string;
  created_at: string;
}

interface UserManagementProps {
  onUserUpdated: () => void;
}

export default function UserManagement({ onUserUpdated }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState('');
  const [editingPlan, setEditingPlan] = useState('free');
  const [verifyEmail, setVerifyEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getUsers();
      setUsers(response.data || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Chyba');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setEditingRole(user.role);
    setEditingPlan(user.plan || 'free');
    setVerifyEmail(user.email_verified);
    setError('');
  };

  const handleBanToggle = async () => {
    if (!selectedUser) return;
    const newBanned = !selectedUser.banned;
    const reason = newBanned
      ? window.prompt('Důvod zablokování (volitelné):') || ''
      : undefined;
    try {
      await adminAPI.updateUser(selectedUser.id, {
        banned: newBanned,
        ...(reason ? { banned_reason: reason } : {}),
      });
      loadUsers();
      setSelectedUser(null);
      onUserUpdated();
    } catch (err: any) {
      setError(err.message || 'Chyba');
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      const changes: any = {};
      if (editingRole !== selectedUser.role) changes.role = editingRole;
      if (verifyEmail !== selectedUser.email_verified) changes.email_verified = verifyEmail;

      if (Object.keys(changes).length > 0) {
        await adminAPI.updateUser(selectedUser.id, changes);
      }

      // Plan change
      if (editingPlan !== (selectedUser.plan || 'free')) {
        await adminAPI.changeUserPlan(selectedUser.id, editingPlan);
      }

      setError('');
      setSelectedUser(null);
      onUserUpdated();
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  const handleResetQuota = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Reset kvoty pro ${selectedUser.email}?`)) return;
    try {
      await adminAPI.resetUserQuota(selectedUser.id);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: number, email: string) => {
    if (!window.confirm(`Opravdu smazat ${email}? Nelze vratit.`)) return;
    try {
      await adminAPI.deleteUser(userId);
      setSelectedUser(null);
      onUserUpdated();
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredUsers = filter
    ? users.filter(u =>
        u.email.toLowerCase().includes(filter.toLowerCase()) ||
        u.name.toLowerCase().includes(filter.toLowerCase())
      )
    : users;

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: '#6b7280', starter: '#3b82f6', professional: '#8b5cf6', enterprise: '#f59e0b',
    };
    return (
      <span style={{
        fontSize: 10, padding: '1px 6px', borderRadius: 3,
        background: colors[plan] || '#6b7280', color: '#fff',
      }}>{plan}</span>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Users List */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Uzivatele ({users.length})</span>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Hledat..."
            style={{
              marginLeft: 'auto', padding: '4px 8px', border: '1px solid #e2e8f0',
              borderRadius: 4, fontSize: 12, width: 140,
            }}
          />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>Nacitam...</div>
        ) : (
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filteredUsers.map(user => (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user)}
                style={{
                  padding: '10px 16px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                  background: selectedUser?.id === user.id ? '#edf2f7' : '#fff',
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 12, color: '#718096', marginBottom: 4 }}>
                  {user.email}
                </div>
                <div style={{ fontSize: 11, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 3,
                    background: user.role === 'admin' ? '#fed7d7' : '#c6f6d5',
                    color: user.role === 'admin' ? '#742a2a' : '#22543d',
                  }}>{user.role}</span>
                  {planBadge(user.plan || 'free')}
                  {user.banned && <span style={{
                    padding: '1px 6px', borderRadius: 3,
                    background: '#e53e3e', color: '#fff',
                  }}>BANNED</span>}
                  {user.email_verified && <span style={{ color: '#38a169' }}>email</span>}
                  {user.phone_verified && <span style={{ color: '#38a169' }}>tel</span>}
                  {(user.free_pipeline_runs_used || 0) > 0 && (
                    <span style={{ color: '#6b7280' }}>
                      {user.free_pipeline_runs_used} runs
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Edit Panel */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
        {selectedUser ? (
          <>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
              Upravit uzivatele
            </h3>

            {error && (
              <div style={{
                padding: 12, background: '#fed7d7', border: '1px solid #fc8181',
                borderRadius: 4, marginBottom: 16, color: '#742a2a', fontSize: 13,
              }}>{error}</div>
            )}

            {/* Name & Email (read-only) */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Jmeno</label>
              <div style={{ padding: '8px 12px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13 }}>
                {selectedUser.name}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Email</label>
              <div style={{ padding: '8px 12px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13 }}>
                {selectedUser.email}
              </div>
            </div>

            {/* Banned warning */}
            {selectedUser.banned && (
              <div style={{
                padding: 12, background: '#fee2e2', border: '1px solid #fca5a5',
                borderRadius: 4, marginBottom: 12, fontSize: 13, color: '#991b1b',
              }}>
                <strong>Zablokováno</strong>
                {selectedUser.banned_reason && <span> — {selectedUser.banned_reason}</span>}
                {selectedUser.banned_at && (
                  <div style={{ fontSize: 11, marginTop: 4, color: '#b91c1c' }}>
                    {new Date(selectedUser.banned_at).toLocaleString('cs-CZ')}
                  </div>
                )}
              </div>
            )}

            {/* Role */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Role</label>
              <select
                value={editingRole}
                onChange={e => setEditingRole(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13 }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Plan */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Plan</label>
              <select
                value={editingPlan}
                onChange={e => setEditingPlan(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13 }}
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                <input type="checkbox" checked={verifyEmail} onChange={e => setVerifyEmail(e.target.checked)} style={{ marginRight: 8 }} />
                Email overen
              </label>
            </div>

            {/* Usage info */}
            <div style={{ marginBottom: 16, fontSize: 12, color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
              <div>Pipeline runs: {selectedUser.free_pipeline_runs_used || 0}</div>
              {selectedUser.phone && <div>Tel: {selectedUser.phone} {selectedUser.phone_verified ? '(overen)' : '(neoveren)'}</div>}
              {selectedUser.registration_ip && <div>Reg. IP: {selectedUser.registration_ip}</div>}
              <div>Vytvoren: {new Date(selectedUser.created_at).toLocaleDateString('cs-CZ')}</div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                style={{
                  flex: 1, padding: 10, background: '#FF9F1C', color: '#fff',
                  border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  opacity: saving ? 0.6 : 1,
                }}
              >{saving ? 'Ukladam...' : 'Ulozit'}</button>
              <button
                onClick={handleResetQuota}
                style={{
                  padding: '10px 16px', background: '#3b82f6', color: '#fff',
                  border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                }}
                title="Vynulovat pocitadlo bezplatnych pipeline runs"
              >Reset kvoty</button>
              <button
                onClick={handleBanToggle}
                style={{
                  padding: '10px 16px',
                  background: selectedUser.banned ? '#48bb78' : '#f59e0b',
                  color: '#fff',
                  border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                }}
              >{selectedUser.banned ? 'Odblokovat' : 'Zablokovat'}</button>
              <button
                onClick={() => handleDeleteUser(selectedUser.id, selectedUser.email)}
                style={{
                  padding: '10px 16px', background: '#e53e3e', color: '#fff',
                  border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                }}
              >Smazat</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#718096', padding: 40 }}>
            Vyberte uzivatele ze seznamu
          </div>
        )}
      </div>
    </div>
  );
}
