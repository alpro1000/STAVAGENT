import { useEffect, useState } from 'react';
import axios from 'axios';
import { FolderOpen, FileText, HardDrive, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Organization } from '../../types/org';
import OrgRoleBadge from '../org/OrgRoleBadge';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface Stats {
  projects: { total: number };
  files: { total: number; total_bytes: number };
  orgs: { member_of: Array<Organization & { role: string; joined_at: string }>; owned: number };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CabinetStats() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/cabinet/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setStats(r.data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Načítání statistik...</div>;
  if (!stats) return null;

  const tiles = [
    { label: 'Projekty', value: stats.projects.total, icon: <FolderOpen size={24} /> },
    { label: 'Soubory', value: stats.files.total, icon: <FileText size={24} /> },
    { label: 'Úložiště', value: formatBytes(stats.files.total_bytes), icon: <HardDrive size={24} /> },
    { label: 'Organizace', value: stats.orgs.member_of.length, icon: <Building2 size={24} /> },
  ];

  return (
    <div>
      {/* Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {tiles.map(t => (
          <div key={t.label} style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
            padding: '16px 20px', textAlign: 'center'
          }}>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{t.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{t.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Org memberships */}
      {stats.orgs.member_of.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Mé organizace</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.orgs.member_of.map((o: any) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{o.name}</span>
                <OrgRoleBadge role={o.role} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
