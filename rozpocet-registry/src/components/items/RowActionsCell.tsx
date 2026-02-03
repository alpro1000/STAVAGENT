/**
 * Row Actions Cell Component
 *
 * Управление строками таблицы:
 * - Удалить позицию (🗑️)
 * - Изменить роль (Hlavní / Podřízený / Sekce)
 * - Переместить вверх/вниз (↑↓)
 * - Připojit k... (выбор родителя)
 */

import { useState, useRef, useEffect } from 'react';
import { Trash2, MoveUp, MoveDown, Link2 } from 'lucide-react';
import type { ParsedItem } from '../../types/item';
import { useRegistryStore } from '../../stores/registryStore';

interface RowActionsCellProps {
  item: ParsedItem;
  projectId: string;
  sheetId: string;
  allItems: ParsedItem[]; // Needed for parent selection
}

type RowRole = 'main' | 'subordinate' | 'section' | 'unknown';

const ROLE_LABELS: Record<RowRole, string> = {
  main: 'Hlavní',
  subordinate: 'Podřízený',
  section: 'Sekce',
  unknown: 'Neznámý',
};

const ROLE_ICONS: Record<RowRole, string> = {
  main: '📋',
  subordinate: '↳',
  section: '📑',
  unknown: '❓',
};

export function RowActionsCell({ item, projectId, sheetId, allItems }: RowActionsCellProps) {
  const { deleteItem, updateItemRole, updateItemParent, moveItemUp, moveItemDown } = useRegistryStore();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showParentMenu, setShowParentMenu] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const parentMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
      if (parentMenuRef.current && !parentMenuRef.current.contains(e.target as Node)) {
        setShowParentMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentRole = item.rowRole || 'unknown';

  // Get potential parents (only main items)
  const potentialParents = allItems.filter(
    (i) => i.rowRole === 'main' && i.id !== item.id
  );

  const handleDelete = () => {
    if (confirm(`Opravdu chcete smazat položku "${item.popis || item.kod}"?`)) {
      deleteItem(projectId, sheetId, item.id);
    }
  };

  const handleChangeRole = (newRole: RowRole) => {
    updateItemRole(projectId, sheetId, item.id, newRole);
    setShowRoleMenu(false);
  };

  const handleAttachToParent = (parentId: string | null) => {
    updateItemParent(projectId, sheetId, item.id, parentId);
    setShowParentMenu(false);
  };

  const handleMoveUp = () => {
    moveItemUp(projectId, sheetId, item.id);
  };

  const handleMoveDown = () => {
    moveItemDown(projectId, sheetId, item.id);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Delete button */}
      <button
        onClick={handleDelete}
        title="Smazat položku"
        className="p-1 rounded hover:bg-red-500/20 transition-colors text-red-500"
      >
        <Trash2 size={14} />
      </button>

      {/* Role dropdown */}
      <div className="relative" ref={roleMenuRef}>
        <button
          onClick={() => setShowRoleMenu(!showRoleMenu)}
          title="Změnit roli"
          className="px-2 py-1 text-xs rounded hover:bg-bg-secondary transition-colors flex items-center gap-1"
        >
          <span>{ROLE_ICONS[currentRole]}</span>
          <span className="text-[10px] text-text-muted">{ROLE_LABELS[currentRole]}</span>
        </button>

        {showRoleMenu && (
          <div
            className="absolute left-0 top-full mt-1 bg-bg-primary border-2 border-border-color rounded-lg z-50 min-w-[140px]"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}
          >
            {(Object.keys(ROLE_LABELS) as RowRole[]).map((role) => (
              <button
                key={role}
                onClick={() => handleChangeRole(role)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-bg-secondary transition-colors ${
                  role === currentRole ? 'bg-accent-primary/10 text-accent-primary font-semibold' : ''
                }`}
              >
                <span>{ROLE_ICONS[role]}</span>
                <span>{ROLE_LABELS[role]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Move up/down buttons */}
      <button
        onClick={handleMoveUp}
        title="Přesunout nahoru"
        className="p-1 rounded hover:bg-bg-secondary transition-colors text-text-muted"
      >
        <MoveUp size={14} />
      </button>
      <button
        onClick={handleMoveDown}
        title="Přesunout dolů"
        className="p-1 rounded hover:bg-bg-secondary transition-colors text-text-muted"
      >
        <MoveDown size={14} />
      </button>

      {/* Attach to parent button (only for subordinate rows) */}
      {currentRole === 'subordinate' && (
        <div className="relative" ref={parentMenuRef}>
          <button
            onClick={() => setShowParentMenu(!showParentMenu)}
            title="Připojit k hlavní položce"
            className="p-1 rounded hover:bg-blue-500/20 transition-colors text-blue-500"
          >
            <Link2 size={14} />
          </button>

          {showParentMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/30 z-40"
                onClick={() => setShowParentMenu(false)}
              />

              {/* Modal panel on the right */}
              <div
                className="fixed right-4 top-1/2 -translate-y-1/2 bg-white border-2 border-slate-300 rounded-lg shadow-2xl z-50 w-[500px] max-h-[600px] overflow-y-auto"
              >
                {/* Header */}
                <div className="sticky top-0 bg-blue-50 border-b-2 border-blue-200 px-4 py-3 z-10">
                  <h3 className="font-semibold text-blue-900 text-sm">Připojit k hlavní položce</h3>
                  <p className="text-xs text-slate-600 mt-1">Vyberte hlavní položku pro připojení podřízeného řádku</p>
                </div>

                {/* Content */}
                <div className="p-2">
                  {/* Option to detach (no parent) */}
                  <button
                    onClick={() => handleAttachToParent(null)}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-100 transition-colors rounded-lg mb-2 ${
                      !item.parentItemId ? 'bg-orange-100 border-2 border-orange-400 text-orange-900 font-semibold' : 'border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔓</span>
                      <em className="text-sm">(Žádný rodič - odpojit)</em>
                    </div>
                  </button>

                  {/* List of potential parents */}
                  {potentialParents.length > 0 ? (
                    <div className="space-y-1">
                      {potentialParents.map((parent) => (
                        <button
                          key={parent.id}
                          onClick={() => handleAttachToParent(parent.id)}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-100 transition-colors rounded-lg ${
                            item.parentItemId === parent.id ? 'bg-blue-100 border-2 border-blue-400 text-blue-900 font-semibold' : 'border-2 border-transparent'
                          }`}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-700">{parent.boqLineNumber || '—'}</span>
                              <span className="font-bold text-sm text-slate-800">{parent.kod}</span>
                            </div>
                            <span className="text-xs text-slate-600 leading-tight">{parent.popis}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-500 italic bg-slate-50 rounded-lg">
                      Žádné hlavní položky nebyly nalezeny
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
