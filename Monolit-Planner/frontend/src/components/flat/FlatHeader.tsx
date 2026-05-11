/**
 * FlatHeader — Portal-style header with stone-200 background.
 */

import { PanelLeftOpen, LogOut, AlertCircle, ExternalLink } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useProjects } from '../../hooks/useProjects';
import { useState, useEffect } from 'react';

export default function FlatHeader() {
  const { selectedProjectId, sidebarOpen, toggleSidebar } = useUI();
  const { projects } = useProjects();
  const [tokenExpired, setTokenExpired] = useState(false);

  const selectedObj = projects.find(p => p.bridge_id === selectedProjectId);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) setTokenExpired(true); })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    window.location.reload();
  };

  return (
    <header className="app-header">
      {/* Portal home link */}
      <a href="https://www.stavagent.cz/portal" className="app-header__home" title="Zpět na Portal">
        <ExternalLink size={14} />
        <span>Portal</span>
      </a>

      <span className="app-header__sep">/</span>

      {!sidebarOpen && (
        <button className="sb__icon-btn" onClick={toggleSidebar} title="Otevřít sidebar (Ctrl+B)">
          <PanelLeftOpen size={16} />
        </button>
      )}

      <span className="app-header__app">Kalkulátor betonáže</span>

      {selectedObj && (
        <>
          <span className="app-header__sep">/</span>
          <span className="app-header__project">{selectedObj.project_name || selectedObj.bridge_id}</span>
          {selectedObj.object_name && selectedObj.object_name !== selectedObj.project_name && (
            <>
              <span className="app-header__sep">·</span>
              <span className="app-header__object">{selectedObj.object_name}</span>
            </>
          )}
        </>
      )}

      <div className="app-header__actions">
        {tokenExpired && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--orange-500)', fontSize: 11 }}>
            <AlertCircle size={13} /> Token vypršel
          </span>
        )}
        {localStorage.getItem('auth_token') && (
          <button className="sb__icon-btn" onClick={handleLogout} title="Odhlásit">
            <LogOut size={15} />
          </button>
        )}
      </div>
    </header>
  );
}
