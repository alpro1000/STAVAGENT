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
import DeleteBridgeModal from './DeleteBridgeModal';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { selectedBridge, setSelectedBridge, bridges, showOnlyRFI, setShowOnlyRFI } = useAppContext();
  const { isLoading, updateBridgeStatus, deleteBridge } = useBridges();
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [hoveredBridgeId, setHoveredBridgeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [bridgeToDelete, setBridgeToDelete] = useState<typeof bridges[0] | null>(null);

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

  // Filter bridges by status
  const filteredBridges = bridges.filter(bridge => {
    if (statusFilter === 'all') return true;
    return (bridge.status || 'active') === statusFilter;
  });

  // Group filtered bridges by project_name
  const bridgesByProject = filteredBridges.reduce((acc, bridge) => {
    const projectName = bridge.project_name || 'Bez projektu';
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(bridge);
    return acc;
  }, {} as Record<string, typeof bridges>);

  // Handle status change
  const handleMarkComplete = async (e: React.MouseEvent, bridgeId: string) => {
    e.stopPropagation();
    try {
      await updateBridgeStatus(bridgeId, 'completed');
    } catch (error) {
      console.error('Failed to update bridge status:', error);
      alert('Chyba při změně statusu mostu');
    }
  };

  // Handle delete
  const handleDeleteClick = (e: React.MouseEvent, bridge: typeof bridges[0]) => {
    e.stopPropagation();
    setBridgeToDelete(bridge);
  };

  const confirmDelete = async () => {
    if (!bridgeToDelete) return;

    try {
      await deleteBridge(bridgeToDelete.bridge_id);
      setBridgeToDelete(null);

      // If deleted bridge was selected, clear selection
      if (selectedBridge === bridgeToDelete.bridge_id) {
        setSelectedBridge(null);
      }
    } catch (error) {
      console.error('Failed to delete bridge:', error);
      alert('Chyba při mazání mostu');
    }
  };

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

            {/* Status Filter Tabs */}
            <div className="status-filter-tabs">
              <button
                className={`filter-tab ${statusFilter === 'active' ? 'active' : ''}`}
                onClick={() => setStatusFilter('active')}
                title="Zobrazit aktivní mosty"
              >
                🚧 Aktivní
              </button>
              <button
                className={`filter-tab ${statusFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('completed')}
                title="Zobrazit dokončené mosty"
              >
                ✅ Dokončené
              </button>
              <button
                className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
                title="Zobrazit všechny mosty"
              >
                📋 Vše
              </button>
            </div>

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
            ) : filteredBridges.length === 0 ? (
              <div className="sidebar-empty">
                <p>Žádné mosty v této kategorii.</p>
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
                              <div className="bridge-actions">
                                <span className="bridge-badge">{bridge.element_count}</span>
                                {bridge.status !== 'completed' && (
                                  <button
                                    className="bridge-action-btn btn-complete"
                                    onClick={(e) => handleMarkComplete(e, bridge.bridge_id)}
                                    title="Označit jako dokončený"
                                    disabled={isLoading}
                                  >
                                    ✅
                                  </button>
                                )}
                                <button
                                  className="bridge-action-btn btn-delete"
                                  onClick={(e) => handleDeleteClick(e, bridge)}
                                  title="Smazat most"
                                  disabled={isLoading}
                                >
                                  🗑️
                                </button>
                              </div>
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
      <DeleteBridgeModal
        bridge={bridgeToDelete}
        isOpen={!!bridgeToDelete}
        onConfirm={confirmDelete}
        onCancel={() => setBridgeToDelete(null)}
        isDeleting={isLoading}
      />
    </aside>
  );
}
