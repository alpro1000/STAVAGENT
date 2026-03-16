import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import CabinetLayout from '../components/cabinet/CabinetLayout';
import ConnectionCard from '../components/connections/ConnectionCard';
import ConnectionForm from '../components/connections/ConnectionForm';
import ModelConfigPanel from '../components/connections/ModelConfigPanel';
import KioskTogglePanel from '../components/connections/KioskTogglePanel';
import type { ServiceConnection, ConnectionStatus } from '../types/connection';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

export default function ConnectionsPage() {
  const { token, user } = useAuth();
  const [connections, setConnections] = useState<ServiceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editConnection, setEditConnection] = useState<ServiceConnection | null>(null);

  // Use user's org_id if available
  const orgId = user?.org_id || null;

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const params = orgId ? `?org_id=${orgId}` : '';
      const resp = await axios.get(`${API_URL}/api/connections${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnections(resp.data.connections || []);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat toto pripojeni?')) return;
    try {
      await axios.delete(`${API_URL}/api/connections/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Chyba pri mazani');
    }
  };

  const handleStatusChange = (id: string, status: ConnectionStatus) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const handleEdit = (conn: ServiceConnection) => {
    setEditConnection(conn);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditConnection(null);
    loadConnections();
  };

  return (
    <CabinetLayout title="Pripojeni a AI modely">
      {/* Top section: ModelConfig + KioskToggles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <ModelConfigPanel orgId={orgId} />
        <KioskTogglePanel orgId={orgId} canEdit={true} />
      </div>

      {/* Connections list */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
          API klice ({connections.length})
        </h2>
        <button
          onClick={() => { setEditConnection(null); setShowForm(!showForm); }}
          style={{
            padding: '8px 18px', fontSize: 14, fontWeight: 600,
            background: '#FF9F1C', color: '#fff', border: 'none',
            borderRadius: 6, cursor: 'pointer',
          }}
        >
          + Pridat pripojeni
        </button>
      </div>

      {showForm && (
        <ConnectionForm
          orgId={orgId}
          editConnection={editConnection}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditConnection(null); }}
        />
      )}

      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: 14, padding: 20, textAlign: 'center' }}>
          Nacitam pripojeni...
        </div>
      ) : connections.length === 0 ? (
        <div style={{
          background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 10,
          padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14,
        }}>
          Zadna pripojeni. Pridejte API klic pro AI sluzbu nebo uloziste.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {connections.map(conn => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </CabinetLayout>
  );
}
