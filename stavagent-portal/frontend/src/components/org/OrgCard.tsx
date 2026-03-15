import { useNavigate } from 'react-router-dom';
import { Organization, PLAN_LABELS } from '../../types/org';
import OrgRoleBadge from './OrgRoleBadge';

interface OrgCardProps {
  org: Organization;
}

export default function OrgCard({ org }: OrgCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/org/${org.id}`)}
      style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: 20, cursor: 'pointer', transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{org.name}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>/{org.slug}</div>
        </div>
        <span style={{
          background: '#f3f4f6', color: '#374151',
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12
        }}>
          {PLAN_LABELS[org.plan] ?? org.plan}
        </span>
      </div>
      {org.my_role && (
        <div style={{ marginTop: 8 }}>
          <OrgRoleBadge role={org.my_role} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
        <span>Max {org.max_team_members} členů</span>
        <span>Max {org.max_projects} projektů</span>
      </div>
    </div>
  );
}
