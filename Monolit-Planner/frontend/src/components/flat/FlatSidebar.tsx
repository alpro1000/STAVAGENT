/**
 * FlatSidebar — Portal-style sidebar with warm stone background.
 *
 * Stone-200 background, white active item with orange border-left.
 * Groups objects by project_name (stavba).
 * Shows element count + concrete volume under each object.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ChevronRight, Plus, Pencil, Trash2, FolderOpen,
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

  const filtered = useMemo(() => {
    if (filter === 'all') return projects;
    return projects.filter(p => (p.status ?? 'active') === filter);
  }, [projects, filter]);

  const groups = useMemo((): ProjectGroup[] => {
    const map = new Map<string, Bridge[]>();
    for (const obj of filtered) {
      const key = obj.project_name || 'Bez projektu';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(obj);
    }
    return Array.from(map, ([name, objects]) => ({ name, objects }))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, [filtered]);

  useEffect(() => {
    if (!selectedProjectId) return;
    for (const g of groups) {
      if (g.objects.some(o => o.bridge_id === selectedProjectId)) {
        setExpandedGroups(prev => prev.has(g.name) ? prev : new Set([...prev, g.name]));
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
    if (selectedProjectId && selectedIds.has(selectedProjectId)) selectProject(null);
  }, [selectedIds, bulkDelete, selectedProjectId, selectProject]);

  const handleRenameSubmit = useCallback(async (oldName: string) => {
    if (!editName.trim() || editName === oldName) { setEditingProject(null); return; }
    await renameProject({ oldName, newName: editName.trim() });
    setEditingProject(null);
  }, [editName, renameProject]);

  const handleDeleteProject = useCallback(async (projectName: string) => {
    if (!confirm(`Smazat projekt "${projectName}" a všechny jeho objekty?`)) return;
    await deleteProject(projectName);
    const deleted = projects.filter(p => p.project_name === projectName);
    if (deleted.some(d => d.bridge_id === selectedProjectId)) selectProject(null);
  }, [deleteProject, projects, selectedProjectId, selectProject]);

  /* ── Collapsed state ─── */
  if (!sidebarOpen) {
    return (
      <div className="sb-collapsed" onClick={toggleSidebar} title="Otevřít sidebar (Ctrl+B)">
        <PanelLeftOpen size={16} />
        <span className="sb-collapsed__label">Objekty</span>
      </div>
    );
  }

  /* ── Open state ─── */
  return (
    <>
      <aside className="sb" style={{ width, minWidth: width }}>
        <div className="sb__resize" onMouseDown={() => { resizing.current = true; }} />

        {/* Header */}
        <div className="sb__head">
          <span className="sb__title">Objekty</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="sb__icon-btn sb__icon-btn--accent" onClick={() => setShowCreate(true)} title="Nový objekt">
              <Plus size={15} />
            </button>
            <button className="sb__icon-btn" onClick={toggleSidebar} title="Skrýt (Ctrl+B)">
              <PanelLeftClose size={15} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="sb__tabs">
          {(['active', 'completed', 'all'] as const).map(f => (
            <button key={f} className={`sb__tab ${filter === f ? 'sb__tab--on' : ''}`} onClick={() => setFilter(f)}>
              {f === 'active' ? 'Aktivní' : f === 'completed' ? 'Hotové' : 'Vše'}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="sb__bulk">
            <span>Vybráno: {selectedIds.size}</span>
            <button className="flat-btn flat-btn--sm" onClick={handleBulkDelete}><Trash2 size={12} /> Smazat</button>
            <button className="flat-btn flat-btn--sm flat-btn--ghost" onClick={() => setSelectedIds(new Set())}>Zrušit</button>
          </div>
        )}

        {/* Body */}
        <div className="sb__body">
          {isLoading ? (
            <div className="flat-loading"><div className="flat-spinner" /> Načítání...</div>
          ) : groups.length === 0 ? (
            <div className="sb__empty">
              <FolderOpen size={28} style={{ opacity: 0.3, marginBottom: 6 }} />
              <p>Žádné objekty</p>
            </div>
          ) : (
            groups.map(group => {
              const isOpen = expandedGroups.has(group.name);
              const totalM3 = group.objects.reduce((s, o) => s + (o.concrete_m3 || 0), 0);
              return (
                <div key={group.name} className="sb__group">
                  {/* Stavba header */}
                  <div className="sb__stavba" onClick={() => toggleGroup(group.name)}>
                    <ChevronRight size={13} className={`sb__chevron ${isOpen ? 'sb__chevron--open' : ''}`} />

                    {editingProject === group.name ? (
                      <input className="sb__rename-input" value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(group.name); if (e.key === 'Escape') setEditingProject(null); }}
                        onBlur={() => handleRenameSubmit(group.name)}
                        autoFocus onClick={e => e.stopPropagation()} />
                    ) : (
                      <span className="sb__stavba-name">{group.name}</span>
                    )}

                    <span className="sb__stavba-badge">{group.objects.length}</span>

                    <div className="sb__stavba-actions">
                      <button className="sb__icon-btn" onClick={e => { e.stopPropagation(); setEditingProject(group.name); setEditName(group.name); }} title="Přejmenovat">
                        <Pencil size={11} />
                      </button>
                      <button className="sb__icon-btn sb__icon-btn--danger" onClick={e => { e.stopPropagation(); handleDeleteProject(group.name); }} title="Smazat">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Objects */}
                  {isOpen && group.objects.map(obj => {
                    const isActive = obj.bridge_id === selectedProjectId;
                    return (
                      <div key={obj.bridge_id} className={`sb__obj ${isActive ? 'sb__obj--active' : ''}`}
                        onClick={() => selectProject(obj.bridge_id)}>
                        <input type="checkbox" className="sb__obj-check"
                          checked={selectedIds.has(obj.bridge_id)} onChange={() => {}}
                          onClick={e => toggleSelect(obj.bridge_id, e)} />
                        <div className="sb__obj-info">
                          <span className="sb__obj-name" title={obj.object_name}>{obj.object_name}</span>
                          <span className="sb__obj-meta">
                            {obj.element_count ?? 0} prvků
                            {obj.concrete_m3 ? ` · ${obj.concrete_m3.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} m³` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: + Nový objekt */}
        <div className="sb__footer">
          <button className="sb__new-btn" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Nový objekt
          </button>
        </div>
      </aside>

      {showCreate && <CreateObjectModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
