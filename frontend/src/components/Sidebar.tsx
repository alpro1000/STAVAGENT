/**
 * Sidebar component - Collapsible with Glassmorphism
 */

import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useBridges } from '../hooks/useBridges';
import HistoryModal from './HistoryModal';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { selectedBridge, setSelectedBridge, bridges, showOnlyRFI, setShowOnlyRFI } = useAppContext();
  const { isLoading } = useBridges();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'collapsed'}`}>
      <button className="sidebar-toggle" onClick={onToggle} title={isOpen ? 'Skrýt' : 'Zobrazit'}>
        {isOpen ? '◀' : '▶'}
      </button>

      {isOpen && (
        <div className="sidebar-content">
          <div className="sidebar-section">
            <h3 className="sidebar-heading">
              <span>🏗️</span> Mosty
            </h3>

            {isLoading ? (
              <div className="sidebar-loading">
                <div className="spinner"></div>
                <p>Načítám...</p>
              </div>
            ) : bridges.length === 0 ? (
              <div className="sidebar-empty">
                <p>Žádné mosty.</p>
                <p className="text-muted">Vytvořte nový nebo nahrajte XLSX.</p>
              </div>
            ) : (
              <ul className="bridge-list">
                {bridges.map((bridge) => (
                  <li
                    key={bridge.bridge_id}
                    className={`bridge-item ${selectedBridge === bridge.bridge_id ? 'active' : ''}`}
                    onClick={() => setSelectedBridge(bridge.bridge_id)}
                    title={`${bridge.object_name || bridge.bridge_id} (${bridge.element_count} prvků)`}
                  >
                    <div className="bridge-info">
                      <span className="bridge-name">{bridge.object_name || bridge.bridge_id}</span>
                      <span className="bridge-id">{bridge.bridge_id}</span>
                    </div>
                    <span className="bridge-badge">{bridge.element_count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">
              <span>🔍</span> Filtry
            </h3>

            <label className="sidebar-checkbox">
              <input
                type="checkbox"
                checked={showOnlyRFI}
                onChange={(e) => setShowOnlyRFI(e.target.checked)}
              />
              <span className="checkbox-label">Pouze s RFI</span>
            </label>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">
              <span>🔧</span> Nástroje
            </h3>
            <div className="sidebar-tools">
              <button
                className="tool-button"
                onClick={() => setShowHistoryModal(true)}
                disabled={!selectedBridge}
                title={selectedBridge ? 'Zobrazit historii snapshots' : 'Nejprve vyberte most'}
              >
                📊 Historie
              </button>
              <button className="tool-button" disabled title="Připravujeme">
                ⚙️ Nastavení
              </button>
            </div>
          </div>
        </div>
      )}

      <HistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} />
    </aside>
  );
}
