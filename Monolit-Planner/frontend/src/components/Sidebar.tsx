/**
 * Sidebar component - Collapsible with Modern Animations + Resizable
 * Features:
 * - Smooth collapse/expand with cubic-bezier easing
 * - Hover tooltips for collapsed state
 * - Enhanced visual feedback
 * - Keyboard shortcut: Ctrl+B / Cmd+B
 * - Resizable width via drag handle
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useBridges } from '../hooks/useBridges';
import HistoryModal from './HistoryModal';
import DeleteBridgeModal from './DeleteBridgeModal';
import DeleteProjectModal from './DeleteProjectModal';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 280;
const STORAGE_KEY = 'monolit-sidebar-width';

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { selectedBridge, setSelectedBridge, bridges, showOnlyRFI, setShowOnlyRFI } = useAppContext();
  const { completeBridge, deleteBridge, deleteProject, isLoading } = useBridges();
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [hoveredBridgeId, setHoveredBridgeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [bridgeToDelete, setBridgeToDelete] = useState<typeof bridges[0] | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<{ name: string; count: number } | null>(null);

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const bridgeCount = bridges.length;

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    setSidebarWidth(newWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      localStorage.setItem(STORAGE_KEY, sidebarWidth.toString());
    }
  }, [isResizing, sidebarWidth]);

  // Attach global mouse listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

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

  // Handle status change (mark as completed with final snapshot)
  const handleMarkComplete = async (e: React.MouseEvent, bridgeId: string) => {
    e.stopPropagation();

    const bridge = bridges.find(b => b.bridge_id === bridgeId);
    const bridgeName = bridge?.object_name || bridgeId;

    const confirmed = window.confirm(
      `✅ Dokončit projekt "${bridgeName}"?\n\n` +
      `Tato akce:\n` +
      `• Vytvoří finální snapshot s aktuálními daty\n` +
      `• Smaže všechny předchozí snapshots\n` +
      `• Označí projekt jako dokončený\n\n` +
      `Pokračovat?`
    );

    if (!confirmed) return;

    try {
      const result = await completeBridge(bridgeId);
      alert(
        `✅ Projekt dokončen!\n\n` +
        `Finální snapshot: ${result.final_snapshot_id}\n` +
        `Smazáno snapshotů: ${result.snapshots_deleted}`
      );
    } catch (error) {
      console.error('Failed to complete bridge:', error);
      alert('Chyba při dokončování projektu');
    }
  };

  // Handle delete click (open modal)
  const handleDeleteClick = (e: React.MouseEvent, bridge: typeof bridges[0]) => {
    e.stopPropagation();
    setBridgeToDelete(bridge);
  };

  // Confirm delete (called from modal)
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
      alert('Chyba při mazání objektu');
    }
  };

  // Handle project delete click (open modal)
  const handleDeleteProjectClick = (e: React.MouseEvent, projectName: string, objectCount: number) => {
    e.stopPropagation();
    setProjectToDelete({ name: projectName, count: objectCount });
  };

  // Confirm project delete (called from modal)
  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      const result = await deleteProject(projectToDelete.name);
      setProjectToDelete(null);

      // Clear selection if the selected bridge was in the deleted project
      if (selectedBridge) {
        const deletedIds = result.deleted_ids || [];
        if (deletedIds.includes(selectedBridge)) {
          setSelectedBridge(null);
        }
      }

      alert(`✅ Projekt smazán!\n\nSmazáno objektů: ${result.deleted_count}`);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Chyba při mazání projektu');
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

  // Expand all projects by default, including NEW projects after import
  useEffect(() => {
    const projectNames = Object.keys(bridgesByProject);
    if (projectNames.length > 0) {
      // Find projects that aren't expanded yet (new projects from import)
      const newProjects = projectNames.filter(name => !expandedProjects.has(name));

      if (newProjects.length > 0 || expandedProjects.size === 0) {
        // Add new projects to expanded set (keep existing expanded state)
        setExpandedProjects(prev => {
          const updated = new Set(prev);
          projectNames.forEach(name => updated.add(name));
          return updated;
        });
      }
    }
  }, [bridges, statusFilter]); // Зависимость от bridges и statusFilter, не от bridgesByProject!

  return (
    <aside
      ref={sidebarRef}
      className={`c-panel sidebar ${isOpen ? 'open' : 'collapsed'}`}
      style={{
        borderRadius: 0,
        padding: 0,
        borderTop: 'none',
        width: isOpen ? `${sidebarWidth}px` : '70px',
        minWidth: isOpen ? `${MIN_WIDTH}px` : '70px',
        maxWidth: isOpen ? `${MAX_WIDTH}px` : '70px',
        transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative'
      }}
    >
      <button
        className="c-btn sidebar-toggle"
        onClick={onToggle}
        title={isOpen ? 'Skrýt (Ctrl+B)' : `Zobrazit seznam (Ctrl+B) • ${bridgeCount} objektů`}
        style={{ position: 'absolute', top: '10px', right: '-12px', zIndex: 10, minHeight: '32px', padding: '6px 10px' }}
      >
        {isOpen ? '◀' : '▶'}
      </button>

      {/* Resize Handle */}
      {isOpen && (
        <div
          className="sidebar-resize-handle"
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '6px',
            height: '100%',
            cursor: 'ew-resize',
            background: isResizing ? 'var(--accent-orange)' : 'transparent',
            transition: 'background 0.2s',
            zIndex: 20
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              (e.target as HTMLElement).style.background = 'var(--accent-orange)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              (e.target as HTMLElement).style.background = 'transparent';
            }
          }}
          title="Táhněte pro změnu šířky"
        />
      )}

      {/* Collapsed state indicator */}
      {!isOpen && bridgeCount > 0 && (
        <div className="sidebar-collapsed-indicator">
          <div className="collapsed-icon">🏗️</div>
          <div className="c-badge c-badge--orange">{bridgeCount}</div>
        </div>
      )}

      {isOpen && (
        <div className="sidebar-content" style={{ padding: 'var(--space-md)', paddingRight: 'var(--space-lg)' }}>
          <div className="sidebar-section">
            <h3 className="c-section-title">
              <span>🏗️</span> Objekty
            </h3>

            {/* Status Filter Tabs */}
            <div className="c-tabs" style={{ marginBottom: 'var(--space-md)' }}>
              <button
                className={`c-tab ${statusFilter === 'active' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('active')}
                title="Zobrazit aktivní objekty"
              >
                🚧 Aktivní
              </button>
              <button
                className={`c-tab ${statusFilter === 'completed' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('completed')}
                title="Zobrazit dokončené objekty"
              >
                ✅ Hotové
              </button>
              <button
                className={`c-tab ${statusFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('all')}
                title="Zobrazit všechny objekty"
              >
                📋 Vše
              </button>
            </div>

            {bridges.length === 0 ? (
              <div className="sidebar-empty">
                <p>Žádné objekty.</p>
                <p className="text-muted">Vytvořte nový nebo nahrajte XLSX.</p>
              </div>
            ) : filteredBridges.length === 0 ? (
              <div className="sidebar-empty">
                <p>Žádné objekty v této kategorii.</p>
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
                        title={`${projectName} (${bridgeCount} objektů)`}
                      >
                        <span className="project-toggle">{isExpanded ? '▼' : '▶'}</span>
                        <span className="project-icon">📁</span>
                        <span className="project-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{projectName}</span>
                        <span className="project-count">{bridgeCount}</span>
                        <button
                          className="bridge-action-btn btn-delete"
                          onClick={(e) => handleDeleteProjectClick(e, projectName, bridgeCount)}
                          title="Smazat celý projekt"
                          disabled={isLoading}
                          style={{ marginLeft: '4px' }}
                        >
                          🗑️
                        </button>
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
                              <div className="bridge-info" style={{ overflow: 'hidden' }}>
                                <span className="bridge-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{bridge.object_name || bridge.bridge_id}</span>
                                <span className="bridge-id" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{bridge.bridge_id}</span>
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
                                  title="Smazat objekt"
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

          <div className="sidebar-section u-mt-lg">
            <h3 className="c-section-title">
              <span>🔍</span> Filtry
            </h3>

            <label className="u-flex u-gap-sm" style={{ cursor: 'pointer', alignItems: 'center' }} title="Zobrazit pouze řádky s problémy (varovná oznámení)">
              <input
                type="checkbox"
                checked={showOnlyRFI}
                onChange={(e) => setShowOnlyRFI(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>⚠️ Jen problémy</span>
            </label>
          </div>

          <div className="sidebar-section u-mt-lg">
            <h3 className="c-section-title">
              <span>🔧</span> Nástroje
            </h3>
            <div className="u-flex u-gap-sm" style={{ flexWrap: 'wrap' }}>
              <button
                className="c-btn c-btn--sm"
                onClick={() => setShowHistoryModal(true)}
                disabled={!selectedBridge}
                title={selectedBridge ? 'Zobrazit historii snapshots' : 'Nejprve vyberte objekt'}
              >
                📊 Historie
              </button>
              <button className="c-btn c-btn--sm" disabled title="Připravujeme">
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
      <DeleteProjectModal
        projectName={projectToDelete?.name || null}
        objectCount={projectToDelete?.count || 0}
        isOpen={!!projectToDelete}
        onConfirm={confirmDeleteProject}
        onCancel={() => setProjectToDelete(null)}
        isDeleting={isLoading}
      />
    </aside>
  );
}
