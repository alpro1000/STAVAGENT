import { OrgRole, ORG_ROLE_LABELS } from '../../types/org';

const ROLE_COLORS: Record<OrgRole, { bg: string; text: string }> = {
  admin:      { bg: '#fef3c7', text: '#92400e' },
  manager:    { bg: '#dbeafe', text: '#1e40af' },
  estimator:  { bg: '#d1fae5', text: '#065f46' },
  viewer:     { bg: '#f3f4f6', text: '#374151' },
  api_client: { bg: '#ede9fe', text: '#5b21b6' },
};

interface OrgRoleBadgeProps {
  role: OrgRole;
  size?: 'sm' | 'md';
}

export default function OrgRoleBadge({ role, size = 'sm' }: OrgRoleBadgeProps) {
  const { bg, text } = ROLE_COLORS[role] ?? { bg: '#f3f4f6', text: '#374151' };
  const fontSize = size === 'sm' ? 11 : 13;
  return (
    <span style={{
      background: bg, color: text,
      fontSize, fontWeight: 600,
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 20, whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {ORG_ROLE_LABELS[role] ?? role}
    </span>
  );
}
