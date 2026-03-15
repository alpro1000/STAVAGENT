/**
 * CabinetOrgsPage — manage user's organizations
 * Route: /cabinet/orgs
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Organization } from '../types/org';
import CabinetLayout from '../components/cabinet/CabinetLayout';
import OrgCard from '../components/org/OrgCard';
import OrgCreate from '../components/org/OrgCreate';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

export default function CabinetOrgsPage() {
  const { token } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await axios.get(`${API_URL}/api/orgs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrgs(res.data.orgs);
    } catch (err) {
      console.error('Load orgs error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  function handleCreated(org: Organization) {
    setCreating(false);
    setOrgs(prev => [{ ...org, my_role: 'admin' as const }, ...prev]);
  }

  return (
    <CabinetLayout title="Organizace">
      <div>
        {/* Header + create button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            Spravujte týmy a přístupy ke sdíleným projektům.
          </p>
          {!creating && (
            <button onClick={() => setCreating(true)} style={{
              padding: '8px 18px', borderRadius: 6, border: 'none',
              background: '#FF9F1C', color: '#fff', cursor: 'pointer',
              fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap'
            }}>
              + Nová organizace
            </button>
          )}
        </div>

        {/* Create form */}
        {creating && (
          <div style={{ marginBottom: 20 }}>
            <OrgCreate onCreated={handleCreated} onCancel={() => setCreating(false)} />
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>Načítání...</div>
        ) : orgs.length === 0 ? (
          <div style={{
            background: '#fff', border: '2px dashed #e5e7eb', borderRadius: 8,
            padding: 40, textAlign: 'center', color: '#9ca3af'
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#6b7280' }}>Žádné organizace</div>
            <div style={{ fontSize: 13 }}>Vytvořte organizaci a pozvěte kolegy ke spolupráci.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {orgs.map(org => <OrgCard key={org.id} org={org} />)}
          </div>
        )}
      </div>
    </CabinetLayout>
  );
}
