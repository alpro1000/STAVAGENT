/**
 * Sidebar component - Collapsible with Modern Animations
 * Features:
 * - Smooth collapse/expand with cubic-bezier easing
 * - Hover tooltips for collapsed state
 * - Enhanced visual feedback
 * - Keyboard shortcut: Ctrl+B / Cmd+B
 */

import { useState, useEffect } from 'react';
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
  const [hoveredBridgeId, setHoveredBridgeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const bridgeCount = bridges.length;

  const handleBridgeHover = (bridgeId: string, e: React.MouseEvent<HTMLLIElement>) => {
    if (!isOpen) {
      setHoveredBridgeId(bridgeId);
      // Position tooltip below the hovered bridge item
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2
      });
    }
  };

  // Group bridges by project_name
  const bridgesByProject = bridges.reduce((acc, bridge) => {
    const projectName = bridge.project_name || 'Bez projektu';
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(bridge);
    return acc;
  }, {} as Record<string, typeof bridges>);

  // Toggle project expansion
  const toggleProject = (projectName: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectName)) {
      newExpanded.delete(projectName);
    } else {
      newExpanded.add(projectName);
    }
    setExpandedProjects(newExpanded);
  };

  // Expand all projects by default on first load
  useEffect(() => {
    if (expandedProjects.size === 0 && Object.keys(bridgesByProject).length > 0) {
      setExpandedProjects(new Set(Object.keys(bridgesByProject)));
    }
  }, [bridgesByProject]);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'collapsed'}`}>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        title={isOpen ? 'Skrýt (Ctrl+B)' : `Zobrazit seznam (Ctrl+B) • ${bridgeCount} mostů`}
      >
        {isOpen ? '◀' : '▶'}
      </button>

      {/* Collapsed state indicator */}
      {!isOpen && bridgeCount > 0 && (
        <div className="sidebar-collapsed-indicator">
          <div className="collapsed-icon">🏗️</div>
          <div className="collapsed-badge">{bridgeCount}</div>
        </div>
      )}

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
              <div className="project-list">
                {Object.entries(bridgesByProject).map(([projectName, projectBridges]) => {
                  const isExpanded = expandedProjects.has(projectName);
                  const bridgeCount = projectBridges.length;

                  return (
                    <div key={projectName} className="project-group">
                      {/* Project Header */}
                      <div
                        className="project-header"
                        onClick={() => toggleProject(projectName)}
                        title={`${projectName} (${bridgeCount} mostů)`}
                      >
                        <span className="project-toggle">{isExpanded ? '▼' : '▶'}</span>
                        <span className="project-icon">📁</span>
                        <span className="project-name">{projectName}</span>
                        <span className="project-count">{bridgeCount}</span>
                      </div>

                      {/* Bridge List (shown when expanded) */}
                      {isExpanded && (
                        <ul className="bridge-list">
                          {projectBridges.map((bridge) => (
                            <li
                              key={bridge.bridge_id}
                              className={`bridge-item ${selectedBridge === bridge.bridge_id ? 'active' : ''}`}
                              onClick={() => setSelectedBridge(bridge.bridge_id)}
                              onMouseEnter={(e) => handleBridgeHover(bridge.bridge_id, e)}
                              onMouseLeave={() => setHoveredBridgeId(null)}
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
                  );
                })}
              </div>
            )}

            {/* Hover Tooltip for Collapsed State */}
            {!isOpen && hoveredBridgeId && (
              <div
                className="sidebar-tooltip"
                style={{
                  position: 'fixed',
                  top: `${tooltipPos.top}px`,
                  left: `${tooltipPos.left}px`,
                  transform: 'translateX(-50%)',
                  zIndex: 1000
                }}
              >
                {bridges.find(b => b.bridge_id === hoveredBridgeId) && (
                  <>
                    <div className="tooltip-name">
                      {bridges.find(b => b.bridge_id === hoveredBridgeId)?.object_name || 'Unknown'}
                    </div>
                    <div className="tooltip-id">
                      {hoveredBridgeId}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">
              <span>🔍</span> Filtry
            </h3>

            <label className="sidebar-checkbox" title="Zobrazit pouze řádky s problémy (varovná oznámení)">
              <input
                type="checkbox"
                checked={showOnlyRFI}
                onChange={(e) => setShowOnlyRFI(e.target.checked)}
              />
              <span className="checkbox-label">⚠️ Jen problémy</span>
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
