/**
 * User Management Component
 * List, view, edit, and delete users
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
  const [verifyEmail, setVerifyEmail] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getUsers();
      setUsers(response.data || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Chyba při načítání uživatelů');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setEditingRole(user.role);
    setVerifyEmail(user.email_verified);
    setError('');
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      const changes: any = {};

      if (editingRole !== selectedUser.role) {
        changes.role = editingRole;
      }

      if (verifyEmail !== selectedUser.email_verified) {
        changes.email_verified = verifyEmail;
      }

      if (Object.keys(changes).length === 0) {
        setError('Žádné změny k uložení');
        setSaving(false);
        return;
      }

      await adminAPI.updateUser(selectedUser.id, changes);
      setError('');
      setSelectedUser(null);
      onUserUpdated();
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Chyba při uložení změn');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: number, email: string) => {
    if (!window.confirm(`Opravdu chcete smazat uživatele ${email}? Tuto akci nelze vrátit.`)) {
      return;
    }

    try {
      await adminAPI.deleteUser(userId);
      setError('');
      setSelectedUser(null);
      onUserUpdated();
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Chyba při mazání uživatele');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Users List */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e2e8f0',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          Uživatelé ({users.length})
        </div>

        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#718096' }}>
            Načítání uživatelů...
          </div>
        ) : error && !selectedUser ? (
          <div style={{ padding: '20px', color: '#742a2a', background: '#fed7d7' }}>
            {error}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#718096' }}>
            Žádní uživatelé
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {users.map(user => (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #edf2f7',
                  cursor: 'pointer',
                  background: selectedUser?.id === user.id ? '#edf2f7' : 'white',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => {
                  if (selectedUser?.id !== user.id) {
                    e.currentTarget.style.background = '#f7fafc';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedUser?.id !== user.id) {
                    e.currentTarget.style.background = 'white';
                  }
                }}
              >
                <div style={{ fontWeight: '500', fontSize: '13px', marginBottom: '4px' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>
                  {user.email}
                </div>
                <div style={{ fontSize: '11px', color: '#a0aec0' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    background: user.role === 'admin' ? '#fed7d7' : '#c6f6d5',
                    color: user.role === 'admin' ? '#742a2a' : '#22543d',
                    borderRadius: '3px',
                    marginRight: '8px'
                  }}>
                    {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                  </span>
                  {user.email_verified ? '✅ Ověřen' : '❌ Neověřen'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Edit Panel */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px'
      }}>
        {selectedUser ? (
          <>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
              Upravit uživatele
            </h3>

            {error && (
              <div style={{
                padding: '12px',
                background: '#fed7d7',
                border: '1px solid #fc8181',
                borderRadius: '4px',
                marginBottom: '16px',
                color: '#742a2a',
                fontSize: '13px'
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '6px',
                color: '#2d3748'
              }}>
                Jméno
              </label>
              <div style={{
                padding: '10px 12px',
                background: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                fontSize: '13px'
              }}>
                {selectedUser.name}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '6px',
                color: '#2d3748'
              }}>
                Email
              </label>
              <div style={{
                padding: '10px 12px',
                background: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                fontSize: '13px'
              }}>
                {selectedUser.email}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '6px',
                color: '#2d3748'
              }}>
                Role
              </label>
              <select
                value={editingRole}
                onChange={e => setEditingRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                <option value="user">👤 User</option>
                <option value="admin">👑 Admin</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                <input
                  type="checkbox"
                  checked={verifyEmail}
                  onChange={e => setVerifyEmail(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                Email ověřen
              </label>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '12px', color: '#718096' }}>
              <div>Vytvořen: {new Date(selectedUser.created_at).toLocaleDateString('cs-CZ')}</div>
              {selectedUser.email_verified_at && (
                <div>Ověřen: {new Date(selectedUser.email_verified_at).toLocaleDateString('cs-CZ')}</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '13px',
                  opacity: saving ? 0.6 : 1
                }}
              >
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
              <button
                onClick={() => handleDeleteUser(selectedUser.id, selectedUser.email)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#f56565',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '13px'
                }}
              >
                Smazat
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#718096', padding: '40px 20px' }}>
            Vyberte uživatele ze seznamu na levé straně
          </div>
        )}
      </div>
    </div>
  );
}
