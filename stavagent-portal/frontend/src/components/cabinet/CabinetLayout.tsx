import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Profil', path: '/cabinet', icon: '👤' },
  { label: 'Organizace', path: '/cabinet/orgs', icon: '🏢' },
  { label: 'Pripojeni', path: '/cabinet/connections', icon: '🔑' },
  { label: 'Zabezpečení', path: '/change-password', icon: '🔐' },
];

interface CabinetLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function CabinetLayout({ children, title }: CabinetLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        background: '#111827', color: '#fff',
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16
      }}>
        <button onClick={() => navigate('/portal')} style={{
          background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14
        }}>
          ← Portal
        </button>
        <span style={{ color: '#4b5563' }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Moje Nastavení</span>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px', display: 'flex', gap: 24 }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <nav style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path ||
                (item.path !== '/cabinet' && location.pathname.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 16px', border: 'none', cursor: 'pointer',
                    background: active ? '#fff7ed' : '#fff',
                    color: active ? '#92400e' : '#374151',
                    borderLeft: active ? '3px solid #FF9F1C' : '3px solid transparent',
                    fontWeight: active ? 600 : 400, fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '1px solid #f3f4f6',
                    transition: 'background 0.1s',
                  }}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && (
            <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: '#111827' }}>{title}</h1>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
