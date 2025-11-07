/**
 * Sidebar component
 */

import React from 'react';
import { useAppContext } from '../context/AppContext';
import { useBridges } from '../hooks/useBridges';

export default function Sidebar() {
  const { selectedBridge, setSelectedBridge, bridges, showOnlyRFI, setShowOnlyRFI } = useAppContext();
  const { isLoading } = useBridges();

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3>Mosty</h3>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="spinner"></div>
          </div>
        ) : bridges.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '14px' }}>
            Žádné mosty. Nahrajte XLSX soubor.
          </p>
        ) : (
          <ul className="bridge-list">
            {bridges.map((bridge) => (
              <li
                key={bridge.bridge_id}
                className={`bridge-item ${selectedBridge === bridge.bridge_id ? 'active' : ''}`}
                onClick={() => setSelectedBridge(bridge.bridge_id)}
              >
                <span>{bridge.bridge_id}</span>
                <span className="badge">{bridge.element_count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sidebar-section">
        <h3>Filtry</h3>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showOnlyRFI}
            onChange={(e) => setShowOnlyRFI(e.target.checked)}
          />
          <span style={{ fontSize: '14px' }}>Pouze s RFI</span>
        </label>
      </div>

      <div className="sidebar-section">
        <h3>Nástroje</h3>
        <p className="text-muted" style={{ fontSize: '13px' }}>
          Coming soon: Mapping editor, nastavení
        </p>
      </div>
    </aside>
  );
}
