/**
 * FlatHeader — Top header bar with minimal controls.
 */

import { PanelLeftOpen, LogOut, AlertCircle } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useProjects } from '../../hooks/useProjects';
import { useState, useEffect } from 'react';

export default function FlatHeader() {
  const { selectedProjectId, sidebarOpen, toggleSidebar } = useUI();
  const { projects } = useProjects();
  const [tokenExpired, setTokenExpired] = useState(false);

  // Selected object info
  const selectedObj = projects.find(p => p.bridge_id === selectedProjectId);

  // JWT expiry check — verify via backend (server validates signature)
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) setTokenExpired(true);
      })
      .catch(() => {
        // Network error — don't mark as expired (might be offline)
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    window.location.reload();
  };

  return (
    <header className="flat-header">
      {!sidebarOpen && (
        <button className="flat-icon-btn" onClick={toggleSidebar} title="Otevřít sidebar (Ctrl+B)">
          <PanelLeftOpen size={18} />
        </button>
      )}

      <span className="flat-header__title">Monolit Planner</span>

      {selectedObj && (
        <span className="flat-header__subtitle">
          {selectedObj.project_name ? `${selectedObj.project_name} / ` : ''}
          {selectedObj.object_name}
        </span>
      )}

      <div className="flat-header__actions">
        {tokenExpired && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--orange-500)', fontSize: 12 }}>
            <AlertCircle size={14} />
            Token vypršel
          </span>
        )}

        {localStorage.getItem('auth_token') && (
          <button className="flat-icon-btn" onClick={handleLogout} title="Odhlásit">
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
