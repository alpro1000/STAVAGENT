/**
 * Portal Breadcrumb — always-visible back-navigation to StavAgent
 *
 * Always shows "← StavAgent" link.
 * When portal context is active (via URL param or localStorage),
 * also shows project link.
 *
 * Also handles auth_token from URL: Portal passes JWT token when opening
 * Monolit so the backend can enforce account isolation.
 */

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

const PORTAL_URL = 'https://www.stavagent.cz/portal';
const STORAGE_KEY = 'monolit-portal-project';

export default function PortalBreadcrumb() {
  const [portalProjectId, setPortalProjectId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('portal_project');

    // Read auth_token from URL (passed by Portal for account isolation)
    const authToken = params.get('auth_token');
    if (authToken) {
      localStorage.setItem('auth_token', authToken);
      params.delete('auth_token');
    }

    if (fromUrl) {
      setPortalProjectId(fromUrl);
      localStorage.setItem(STORAGE_KEY, fromUrl);
      params.delete('portal_project');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPortalProjectId(stored);
      }
      // Clean auth_token from URL even without portal_project
      if (authToken) {
        const newUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  const portalLink = portalProjectId
    ? `${PORTAL_URL}/?project=${portalProjectId}`
    : PORTAL_URL;

  return (
    <div style={{
      background: '#1e293b',
      padding: '6px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      borderBottom: '1px solid #334155',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <a
          href={PORTAL_URL}
          style={{
            color: '#94a3b8',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
          onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
        >
          <ArrowLeft size={12} />
          <span>StavAgent</span>
        </a>
        {portalProjectId && (
          <>
            <span style={{ color: '#475569' }}>/</span>
            <a
              href={portalLink}
              style={{ color: '#64748b', textDecoration: 'none', fontSize: 11 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
            >
              Projekt
            </a>
          </>
        )}
      </div>
      {portalProjectId && (
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('auth_token');
            setPortalProjectId(null);
          }}
          style={{
            background: 'none', border: 'none', color: '#475569',
            cursor: 'pointer', fontSize: 11, padding: '2px 6px',
          }}
          title="Odpojit od portálu"
        >
          ✕
        </button>
      )}
    </div>
  );
}
