/**
 * OrgPage — organization detail: members, invite, settings
 * Route: /org/:id
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Organization, OrgMember, OrgRole } from '../types/org';
import OrgRoleBadge from '../components/org/OrgRoleBadge';
import OrgMembersList from '../components/org/OrgMembersList';
import OrgInviteForm from '../components/org/OrgInviteForm';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

export default function OrgPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [myRole, setMyRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'members' | 'settings'>('members');

  const load = useCallback(async () => {
    if (!id || !token) return;
    try {
      const res = await axios.get(`${API_URL}/api/orgs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrg(res.data.org);
      setMembers(res.data.members);
      const me = res.data.members.find((m: OrgMember) => m.user_id === user?.id);
      setMyRole(me?.role ?? null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při načítání organizace');
    } finally {
      setLoading(false);
    }
  }, [id, token, user?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280' }}>Načítání...</div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#dc2626', fontSize: 16, marginBottom: 16 }}>{error || 'Organizace nenalezena'}</div>
          <button onClick={() => navigate('/cabinet/orgs')} style={{
            padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 14
          }}>
            ← Zpět na organizace
          </button>
        </div>
      </div>
    );
  }

  const canInvite = myRole === 'admin' || myRole === 'manager';

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Top bar */}
      <div style={{ background: '#111827', color: '#fff', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/cabinet/orgs')} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}>
          ← Organizace
        </button>
        <span style={{ color: '#4b5563' }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{org.name}</span>
        {myRole && <OrgRoleBadge role={myRole} size="sm" />}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
        {/* Header */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>{org.name}</h1>
              <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>/{org.slug}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ background: '#f3f4f6', color: '#374151', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {members.filter(m => m.joined_at).length} / {org.max_team_members} členů
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 4, width: 'fit-content' }}>
          {(['members', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 600 : 400,
              background: tab === t ? '#FF9F1C' : 'transparent',
              color: tab === t ? '#fff' : '#6b7280',
            }}>
              {t === 'members' ? 'Členové' : 'Nastavení'}
            </button>
          ))}
        </div>

        {tab === 'members' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Invite form */}
            {canInvite && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#374151' }}>Pozvat člena</h3>
                <OrgInviteForm orgId={org.id} onInvited={load} />
              </div>
            )}

            {/* Members list */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#374151' }}>
                  Členové ({members.filter(m => m.joined_at).length})
                </h3>
              </div>
              <div style={{ padding: '0 8px' }}>
                {myRole && (
                  <OrgMembersList
                    orgId={org.id}
                    members={members}
                    myRole={myRole}
                    ownerId={org.owner_id}
                    onChanged={load}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <OrgSettings org={org} myRole={myRole} onUpdated={load} />
        )}
      </div>
    </div>
  );
}

// Inline OrgSettings component
function OrgSettings({ org, myRole, onUpdated }: { org: Organization; myRole: OrgRole | null; onUpdated: () => void }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = myRole === 'admin';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess(false);
    setLoading(true);
    try {
      await axios.patch(`${API_URL}/api/orgs/${org.id}`, { name, slug }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(true);
      onUpdated();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při ukládání');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Smazat organizaci "${org.name}"? Tato akce je nevratná.`)) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/api/orgs/${org.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/cabinet/orgs');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Chyba při mazání organizace');
    } finally {
      setDeleting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
    borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Informace o organizaci</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Název</label>
              <input value={name} onChange={e => setName(e.target.value)} required disabled={!isAdmin} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Slug</label>
              <input value={slug} onChange={e => setSlug(e.target.value)} disabled={!isAdmin} style={inputStyle} />
            </div>
          </div>
          {success && <div style={{ marginTop: 12, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>✓ Uloženo</div>}
          {error && <div style={{ marginTop: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}
          {isAdmin && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={loading} style={{
                padding: '8px 20px', borderRadius: 6, border: 'none',
                background: loading ? '#9ca3af' : '#FF9F1C', color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14
              }}>
                {loading ? 'Ukládání...' : 'Uložit'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Limits */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Limity plánu</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Projekty', value: org.max_projects },
            { label: 'Úložiště', value: `${org.max_storage_gb} GB` },
            { label: 'Členové', value: org.max_team_members },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center', padding: 16, background: '#f9fafb', borderRadius: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{item.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      {isAdmin && (
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 8, padding: 24 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#dc2626' }}>Nebezpečná zóna</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Smazání organizace je nevratné. Všechna propojení s projekty budou odstraněna.</p>
          <button onClick={handleDelete} disabled={deleting} style={{
            padding: '8px 20px', borderRadius: 6, border: '1px solid #dc2626',
            background: '#fff', color: '#dc2626', cursor: deleting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14
          }}>
            {deleting ? 'Mazání...' : 'Smazat organizaci'}
          </button>
        </div>
      )}
    </div>
  );
}
