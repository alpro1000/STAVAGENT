/**
 * FlatSidebar — Project list sidebar with flat design.
 *
 * Groups objects by project_name (stavba).
 * Supports: filter tabs (Aktivní/Hotové/Vše), create, rename, delete, bulk ops.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ChevronRight, Plus, Pencil, Trash2, FolderOpen, Settings,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useUI, SIDEBAR_WIDTH_KEY } from '../../context/UIContext';
import { useProjects } from '../../hooks/useProjects';
import type { Bridge } from '@stavagent/monolit-shared';
import CreateObjectModal from './CreateObjectModal';

type StatusFilter = 'active' | 'completed' | 'all';

interface ProjectGroup {
  name: string;
  objects: Bridge[];
}

export default function FlatSidebar() {
  const {
    selectedProjectId, selectProject,
    sidebarOpen, toggleSidebar,
  } = useUI();
  const {
    projects, isLoading,
    deleteObject, deleteProject, renameProject, bulkDelete,
  } = useProjects();

  const [filter, setFilter] = useState<StatusFilter>('active');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Sidebar resizing
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return stored ? parseInt(stored, 10) : 280;
  });
  const resizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const newW = Math.max(200, Math.min(500, e.clientX));
      setWidth(newW);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(newW));
    };
    const handleMouseUp = () => { resizing.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Filter objects by status
  const filtered = useMemo(() => {
    if (filter === 'all') return projects;
    return projects.filter(p => (p.status ?? 'active') === filter);
  }, [projects, filter]);

  // Group by project_name
  const groups = useMemo((): ProjectGroup[] => {
    const map = new Map<string, Bridge[]>();
    for (const obj of filtered) {
      const key = obj.project_name || 'Bez projektu';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(obj);
    }
    // Auto-expand groups
    const result: ProjectGroup[] = [];
    for (const [name, objects] of map) {
      result.push({ name, objects });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, [filtered]);

  // Auto-expand group containing selected project
  useEffect(() => {
    if (!selectedProjectId) return;
    for (const g of groups) {
      if (g.objects.some(o => o.bridge_id === selectedProjectId)) {
        setExpandedGroups(prev => {
          if (prev.has(g.name)) return prev;
          return new Set([...prev, g.name]);
        });
      }
    }
  }, [selectedProjectId, groups]);

  const toggleGroup = useCallback((name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Smazat ${selectedIds.size} objektů?`)) return;
    await bulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    if (selectedProjectId && selectedIds.has(selectedProjectId)) {
      selectProject(null);
    }
  }, [selectedIds, bulkDelete, selectedProjectId, selectProject]);

  const handleRenameSubmit = useCallback(async (oldName: string) => {
    if (!editName.trim() || editName === oldName) {
      setEditingProject(null);
      return;
    }
    await renameProject({ oldName, newName: editName.trim() });
    setEditingProject(null);
  }, [editName, renameProject]);

  const handleDeleteProject = useCallback(async (projectName: string) => {
    if (!confirm(`Smazat projekt "${projectName}" a všechny jeho objekty?`)) return;
    await deleteProject(projectName);
    // Deselect if any deleted object was selected
    const deleted = projects.filter(p => p.project_name === projectName);
    if (deleted.some(d => d.bridge_id === selectedProjectId)) {
      selectProject(null);
    }
  }, [deleteProject, projects, selectedProjectId, selectProject]);

  if (!sidebarOpen) {
    return (
      <div className="flat-sidebar-collapsed" onClick={toggleSidebar} title="Otevřít sidebar (Ctrl+B)">
        <PanelLeftOpen size={16} />
        <span className="flat-sidebar-collapsed__label">Objekty</span>
      </div>
    );
  }

  return (
    <>
      <aside className="flat-sidebar" style={{ width, minWidth: width }}>
        {/* Resize handle */}
        <div
          className="flat-sidebar__resize"
          onMouseDown={() => { resizing.current = true; }}
        />

        {/* Header */}
        <div className="flat-sidebar__header">
          <h3>Objekty</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="flat-icon-btn flat-icon-btn--accent" onClick={() => setShowCreate(true)} title="Nový objekt">
              <Plus size={16} />
            </button>
            <button className="flat-icon-btn" onClick={toggleSidebar} title="Skrýt sidebar (Ctrl+B)">
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flat-tabs">
          {(['active', 'completed', 'all'] as const).map(f => (
            <button
              key={f}
              className={`flat-tab ${filter === f ? 'flat-tab--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'active' ? 'Aktivní' : f === 'completed' ? 'Hotové' : 'Vše'}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--flat-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--flat-text-secondary)' }}>
              Vybráno: {selectedIds.size}
            </span>
            <button className="flat-btn flat-btn--sm" onClick={handleBulkDelete}>
              <Trash2 size={12} /> Smazat
            </button>
            <button className="flat-btn flat-btn--sm flat-btn--ghost" onClick={() => setSelectedIds(new Set())}>
              Zrušit
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flat-sidebar__body">
          {isLoading ? (
            <div className="flat-loading"><div className="flat-spinner" /> Načítání...</div>
          ) : groups.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--flat-text-secondary)', fontSize: 13 }}>
              <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <p>Žádné objekty</p>
              <button className="flat-btn flat-btn--primary flat-btn--sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Vytvořit
              </button>
            </div>
          ) : (
            groups.map(group => {
              const isOpen = expandedGroups.has(group.name);
              return (
                <div key={group.name} className="flat-project-group">
                  {/* Group header */}
                  <div className="flat-project-group__header" onClick={() => toggleGroup(group.name)}>
                    <ChevronRight
                      size={14}
                      className={`flat-project-group__chevron ${isOpen ? 'flat-project-group__chevron--open' : ''}`}
                    />

                    {editingProject === group.name ? (
                      <input
                        className="flat-field__input"
                        style={{ height: 24, fontSize: 13, padding: '0 6px' }}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSubmit(group.name);
                          if (e.key === 'Escape') setEditingProject(null);
                        }}
                        onBlur={() => handleRenameSubmit(group.name)}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flat-project-group__name">{group.name}</span>
                    )}

                    <span className="flat-project-group__badge">{group.objects.length}</span>

                    <div className="flat-project-group__actions">
                      <button
                        className="flat-icon-btn"
                        onClick={e => {
                          e.stopPropagation();
                          setEditingProject(group.name);
                          setEditName(group.name);
                        }}
                        title="Přejmenovat"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="flat-icon-btn flat-icon-btn--danger"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteProject(group.name);
                        }}
                        title="Smazat projekt"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Objects */}
                  {isOpen && group.objects.map(obj => (
                    <div
                      key={obj.bridge_id}
                      className={`flat-object-item ${obj.bridge_id === selectedProjectId ? 'flat-object-item--selected' : ''}`}
                      onClick={() => selectProject(obj.bridge_id)}
                    >
                      <input
                        type="checkbox"
                        className="flat-object-item__checkbox"
                        checked={selectedIds.has(obj.bridge_id)}
                        onChange={() => {}} // controlled by onClick
                        onClick={e => toggleSelect(obj.bridge_id, e)}
                      />
                      <span className="flat-object-item__name" title={obj.object_name}>
                        {obj.object_name}
                      </span>
                      <span className="flat-object-item__count">
                        {obj.element_count ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {showCreate && (
        <CreateObjectModal onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}
