/**
 * GroupManager Component
 * Manage work groups: view, rename, delete, add with duplicate prevention
 */

import { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, Pencil, Trash2, Plus, Check, X, AlertTriangle, Settings,
} from 'lucide-react';
import { useRegistryStore } from '../../stores/registryStore';
import { DEFAULT_GROUPS } from '../../utils/constants';

export function GroupManager() {
  const {
    getAllGroups, addCustomGroup, renameGroup, deleteGroup, getGroupItemCounts,
  } = useRegistryStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newGroupValue, setNewGroupValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const allGroups = getAllGroups();
  const itemCounts = useMemo(() => getGroupItemCounts(), [getGroupItemCounts]);
  const defaultSet = useMemo(() => new Set<string>(DEFAULT_GROUPS as unknown as string[]), []);

  const totalItems = useMemo(() => {
    let total = 0;
    itemCounts.forEach(count => { total += count; });
    return total;
  }, [itemCounts]);

  // Check for duplicate (case-insensitive)
  const isDuplicate = (name: string, excludeCurrent?: string) => {
    const normalized = name.trim().toUpperCase();
    return allGroups.some(
      g => g.toUpperCase() === normalized && g !== excludeCurrent
    );
  };

  // Start editing
  const startEdit = (group: string) => {
    setEditingGroup(group);
    setEditValue(group);
    setConfirmDelete(null);
    setLastAction(null);
  };

  // Save rename
  const saveRename = () => {
    if (!editingGroup) return;
    const trimmed = editValue.trim();

    if (!trimmed) return;
    if (trimmed === editingGroup) {
      setEditingGroup(null);
      return;
    }
    if (isDuplicate(trimmed, editingGroup)) {
      return; // duplicate shown in UI
    }

    const count = renameGroup(editingGroup, trimmed);
    setLastAction(`Přejmenováno "${editingGroup}" → "${trimmed}" (${count} položek aktualizováno)`);
    setEditingGroup(null);
    setEditValue('');
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingGroup(null);
    setEditValue('');
  };

  // Handle delete
  const handleDelete = (group: string) => {
    const count = itemCounts.get(group) || 0;
    if (count > 0 && confirmDelete !== group) {
      setConfirmDelete(group);
      setLastAction(null);
      return;
    }

    const affected = deleteGroup(group);
    setLastAction(`Smazána skupina "${group}" (${affected} položek vymazáno)`);
    setConfirmDelete(null);
  };

  // Add new group
  const handleAddGroup = () => {
    const trimmed = newGroupValue.trim();
    if (!trimmed) return;
    if (isDuplicate(trimmed)) return;

    addCustomGroup(trimmed);
    setLastAction(`Přidána nová skupina "${trimmed}"`);
    setNewGroupValue('');
  };

  const newGroupDuplicate = newGroupValue.trim() ? isDuplicate(newGroupValue.trim()) : false;

  return (
    <div className="card bg-gradient-to-r from-slate-900/20 to-gray-900/20 border-slate-500/30">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings className="text-slate-400" size={20} />
          <h3 className="font-semibold text-slate-300">Správa skupin</h3>
          <span className="text-xs bg-slate-500/20 text-slate-300 px-2 py-0.5 rounded">
            {allGroups.length} skupin · {totalItems} položek
          </span>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {/* Action feedback */}
          {lastAction && (
            <div className="text-sm text-green-400 bg-green-900/20 px-3 py-2 rounded">
              {lastAction}
            </div>
          )}

          {/* Groups list */}
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {allGroups.map(group => {
              const count = itemCounts.get(group) || 0;
              const isDefault = defaultSet.has(group);
              const isEditing = editingGroup === group;
              const isConfirmingDelete = confirmDelete === group;

              return (
                <div key={group} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-secondary group/row">
                  {isEditing ? (
                    /* Edit mode */
                    <>
                      <input
                        type="text"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveRename();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        autoFocus
                        className="flex-1 text-sm bg-bg-tertiary border border-accent-primary rounded px-2 py-1 focus:outline-none"
                      />
                      {isDuplicate(editValue.trim(), editingGroup) && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <AlertTriangle size={12} /> existuje
                        </span>
                      )}
                      <button onClick={saveRename} className="p-1 text-green-400 hover:bg-green-900/30 rounded" title="Uložit">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-red-400 hover:bg-red-900/30 rounded" title="Zrušit">
                        <X size={14} />
                      </button>
                    </>
                  ) : isConfirmingDelete ? (
                    /* Delete confirmation */
                    <>
                      <span className="flex-1 text-sm text-yellow-400">
                        Smazat &quot;{group}&quot;? ({count} položek bude bez skupiny)
                      </span>
                      <button
                        onClick={() => handleDelete(group)}
                        className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Smazat
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-0.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-500"
                      >
                        Ne
                      </button>
                    </>
                  ) : (
                    /* Normal display */
                    <>
                      <span className={`flex-1 text-sm font-medium truncate ${count > 0 ? 'text-accent-primary' : 'text-text-muted'}`}>
                        {group}
                      </span>
                      {isDefault && (
                        <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">výchozí</span>
                      )}
                      <span className="text-xs text-text-muted w-8 text-right tabular-nums">
                        {count}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(group); }}
                        className="p-1 text-text-muted hover:text-accent-primary opacity-0 group-hover/row:opacity-100 transition-opacity rounded"
                        title="Přejmenovat"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(group); }}
                        className="p-1 text-text-muted hover:text-red-400 opacity-0 group-hover/row:opacity-100 transition-opacity rounded"
                        title="Smazat skupinu"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add new group */}
          <div className="flex items-center gap-2 pt-2 border-t border-border-color">
            <input
              type="text"
              value={newGroupValue}
              onChange={e => setNewGroupValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !newGroupDuplicate) handleAddGroup();
              }}
              placeholder="Nová skupina..."
              className="flex-1 text-sm bg-bg-tertiary border border-border-color rounded px-2 py-1.5 focus:border-accent-primary focus:outline-none"
            />
            {newGroupDuplicate && (
              <span className="text-xs text-yellow-400 flex items-center gap-1 whitespace-nowrap">
                <AlertTriangle size={12} /> již existuje
              </span>
            )}
            <button
              onClick={handleAddGroup}
              disabled={!newGroupValue.trim() || newGroupDuplicate}
              className="p-1.5 bg-accent-primary text-white rounded hover:bg-accent-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Přidat skupinu"
            >
              <Plus size={16} />
            </button>
          </div>

          <p className="text-xs text-text-muted">
            Přejmenování aktualizuje všechny položky. Smazání odstraní skupinu ze všech položek.
          </p>
        </div>
      )}
    </div>
  );
}
