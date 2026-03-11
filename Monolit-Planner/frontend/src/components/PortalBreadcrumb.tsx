/**
 * Portal Breadcrumb — back-navigation to StavAgent Portal
 *
 * Detects portal context from:
 *   1. URL param: ?portal_project=<id>
 *   2. localStorage: monolit-portal-project (persisted from previous visit)
 *
 * Shows a sticky breadcrumb bar when active.
 */

import { useState, useEffect } from 'react';

const PORTAL_URL = 'https://www.stavagent.cz';
const STORAGE_KEY = 'monolit-portal-project';

export default function PortalBreadcrumb() {
  const [portalProjectId, setPortalProjectId] = useState<string | null>(null);

  useEffect(() => {
    // Check URL params first
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('portal_project');

    if (fromUrl) {
      setPortalProjectId(fromUrl);
      localStorage.setItem(STORAGE_KEY, fromUrl);
      // Clean the param from URL without page reload
      params.delete('portal_project');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } else {
      // Check localStorage for previous portal context
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPortalProjectId(stored);
      }
    }
  }, []);

  if (!portalProjectId) return null;

  const portalLink = `${PORTAL_URL}/?project=${portalProjectId}`;

  return (
    <div style={{
      background: 'var(--r0-slate-800, #1e293b)',
      padding: '6px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      borderBottom: '1px solid var(--r0-slate-700, #334155)',
    }}>
      <a
        href={portalLink}
        style={{
          color: '#94a3b8',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
        onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
      >
        <span>←</span>
        <span>StavAgent Portal</span>
        <span style={{ color: '#475569' }}>/</span>
        <span>Projekt</span>
      </a>
      <button
        onClick={() => {
          localStorage.removeItem(STORAGE_KEY);
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
    </div>
  );
}
