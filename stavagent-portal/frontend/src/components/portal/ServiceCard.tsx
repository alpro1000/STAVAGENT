/**
 * Service Card Component
 * Displays available STAVAGENT kiosks/services
 *
 * Uses Digital Concrete Design System
 */

import { ExternalLink } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  status: 'active' | 'beta' | 'coming_soon';
  tags?: string[];
}

interface ServiceCardProps {
  service: Service;
  onClick?: () => void; // Optional custom click handler
}

export default function ServiceCard({ service, onClick }: ServiceCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="c-badge c-badge--success">Aktivní</span>;
      case 'beta':
        return <span className="c-badge c-badge--warning">Beta</span>;
      case 'coming_soon':
        return <span className="c-badge c-badge--info">Připravujeme</span>;
      default:
        return null;
    }
  };

  const isDisabled = service.status === 'coming_soon';
  const isInternal = service.url.startsWith('#');

  const handleClick = () => {
    if (isDisabled) return;

    // Use custom onClick if provided
    if (onClick) {
      onClick();
      return;
    }

    // For internal links, don't open new tab
    if (isInternal) return;

    // Default: open external link
    window.open(service.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="c-card"
      onClick={handleClick}
      style={{
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>{service.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {service.name}
            </h3>
            {getStatusBadge(service.status)}
          </div>
        </div>
        {!isDisabled && !isInternal && (
          <ExternalLink
            size={20}
            style={{ color: 'var(--brand-orange)', flexShrink: 0 }}
          />
        )}
      </div>

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: '14px',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        flex: 1
      }}>
        {service.description}
      </p>

      {/* Tags */}
      {service.tags && service.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          {service.tags.map((tag, index) => (
            <span
              key={index}
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                background: 'var(--input-bg)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--depressed-inset)'
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
