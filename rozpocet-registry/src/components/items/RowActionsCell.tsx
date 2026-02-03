/**
 * Row Actions Cell Component
 *
 * Управление строками таблицы:
 * - Удалить позицию (🗑️)
 * - Изменить роль (Hlavní / Podřízený / Sekce)
 * - Переместить вверх/вниз (↑↓)
 * - Připojit k... (выбор родителя)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, MoveUp, MoveDown, Link2, X, GripVertical } from 'lucide-react';
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

  // Modal resize state
  const [modalSize, setModalSize] = useState({ width: 550, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef({ startX: 0, startY: 0, startWidth: 550, startHeight: 500 });

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: modalSize.width,
      startHeight: modalSize.height,
    };
  }, [modalSize]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;
      setModalSize({
        width: Math.max(400, Math.min(900, resizeRef.current.startWidth + deltaX)),
        height: Math.max(300, Math.min(800, resizeRef.current.startHeight + deltaY)),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Close role menu on outside click (NOT parent modal - that closes only on X)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
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
    <div className="flex items-center gap-0.5">
      {/* Delete button - compact */}
      <button
        onClick={handleDelete}
        title="Smazat položku"
        className="p-0.5 rounded hover:bg-red-500/20 transition-colors text-red-500"
      >
        <Trash2 size={12} />
      </button>

      {/* Role dropdown - compact */}
      <div className="relative" ref={roleMenuRef}>
        <button
          onClick={() => setShowRoleMenu(!showRoleMenu)}
          title="Změnit roli"
          className="px-1 py-0.5 text-xs rounded hover:bg-bg-secondary transition-colors flex items-center gap-0.5"
        >
          <span className="text-[10px]">{ROLE_ICONS[currentRole]}</span>
          <span className="text-[9px] text-text-muted">{ROLE_LABELS[currentRole].slice(0, 3)}</span>
        </button>

        {showRoleMenu && (
          <div
            className="absolute left-0 top-full mt-1 border-2 border-slate-700 rounded-lg z-[99999] min-w-[140px] overflow-hidden"
            style={{
              boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
              backgroundColor: '#1e293b', // slate-800 - fully opaque
            }}
          >
            {(Object.keys(ROLE_LABELS) as RowRole[]).map((role) => (
              <button
                key={role}
                onClick={() => handleChangeRole(role)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                  role === currentRole
                    ? 'bg-orange-500 text-white font-semibold'
                    : 'text-slate-200 hover:bg-slate-700'
                }`}
                style={{ backgroundColor: role === currentRole ? '#f97316' : undefined }}
              >
                <span>{ROLE_ICONS[role]}</span>
                <span>{ROLE_LABELS[role]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Move up/down buttons - compact */}
      <button
        onClick={handleMoveUp}
        title="Přesunout nahoru"
        className="p-0.5 rounded hover:bg-bg-secondary transition-colors text-text-muted"
      >
        <MoveUp size={12} />
      </button>
      <button
        onClick={handleMoveDown}
        title="Přesunout dolů"
        className="p-0.5 rounded hover:bg-bg-secondary transition-colors text-text-muted"
      >
        <MoveDown size={12} />
      </button>

      {/* Attach to parent button (only for subordinate rows) - compact */}
      {currentRole === 'subordinate' && (
        <div className="relative">
          <button
            onClick={() => setShowParentMenu(!showParentMenu)}
            title="Připojit k hlavní položce"
            className="p-0.5 rounded hover:bg-blue-500/20 transition-colors text-blue-500"
          >
            <Link2 size={12} />
          </button>

          {showParentMenu && (
            <>
              {/* Backdrop - ПОЛНОСТЬЮ НЕПРОЗРАЧНЫЙ - SLATE-950, НЕ закрывается по клику */}
              <div
                className="fixed inset-0 z-[99998]"
                style={{ backgroundColor: '#020617' }} // slate-950 fully opaque
              />

              {/* Modal panel - Digital Concrete, ЦЕНТР, ИЗМЕНЯЕМЫЙ РАЗМЕР */}
              <div
                className="fixed border-4 border-slate-800 z-[99999] flex flex-col"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: `${modalSize.width}px`,
                  height: `${modalSize.height}px`,
                  minWidth: '400px',
                  minHeight: '300px',
                  maxWidth: '900px',
                  maxHeight: '800px',
                  boxShadow: '12px 12px 0 rgba(0,0,0,0.5), 0 24px 72px rgba(0,0,0,0.9)',
                  backgroundColor: '#0f172a', // slate-900 base
                }}
              >
                {/* Header - SLATE-900 с кнопкой X */}
                <div
                  className="flex items-center justify-between px-6 py-4 border-b-4 border-slate-700 flex-shrink-0"
                  style={{ backgroundColor: '#0f172a' }}
                >
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-widest text-white">🔗 PŘIPOJIT K POLOŽCE</h3>
                    <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wide">Vyberte hlavní položku pro připojení</p>
                  </div>
                  {/* Close button X */}
                  <button
                    onClick={() => setShowParentMenu(false)}
                    className="p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                    title="Zavřít"
                  >
                    <X size={24} strokeWidth={3} />
                  </button>
                </div>

                {/* Content - светло-серый ПОЛНОСТЬЮ непрозрачный, прокручиваемый */}
                <div
                  className="flex-1 overflow-y-auto p-5"
                  style={{ backgroundColor: '#f1f5f9' }} // slate-100
                >
                  {/* Option to detach (no parent) */}
                  <button
                    onClick={() => handleAttachToParent(null)}
                    className={`w-full px-6 py-5 text-left transition-all rounded-none mb-3 border-4 ${
                      !item.parentItemId
                        ? 'bg-orange-500 border-orange-700 text-white font-black shadow-[6px_6px_0_rgba(0,0,0,0.3)] uppercase tracking-wide'
                        : 'border-slate-600 bg-white hover:bg-slate-50 hover:border-slate-800 hover:shadow-[4px_4px_0_rgba(0,0,0,0.1)]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">🔓</span>
                      <span className={`text-sm font-black uppercase tracking-wide ${!item.parentItemId ? 'text-white' : 'text-slate-800'}`}>
                        (ŽÁDNÝ RODIČ - ODPOJIT)
                      </span>
                    </div>
                  </button>

                  {/* List of potential parents */}
                  {potentialParents.length > 0 ? (
                    <div className="space-y-3">
                      {potentialParents.map((parent) => (
                        <button
                          key={parent.id}
                          onClick={() => handleAttachToParent(parent.id)}
                          className={`w-full px-6 py-5 text-left transition-all rounded-none border-4 ${
                            item.parentItemId === parent.id
                              ? 'bg-orange-500 border-orange-700 text-white font-black shadow-[6px_6px_0_rgba(0,0,0,0.3)]'
                              : 'border-slate-600 bg-white hover:bg-slate-50 hover:border-slate-800 hover:shadow-[4px_4px_0_rgba(0,0,0,0.1)]'
                          }`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs bg-slate-900 text-white px-3 py-1.5 font-black uppercase tracking-wider border-2 border-slate-700">
                                {parent.boqLineNumber || '—'}
                              </span>
                              <span className={`font-black text-lg tracking-tight ${
                                item.parentItemId === parent.id ? 'text-white' : 'text-slate-900'
                              }`}>{parent.kod}</span>
                            </div>
                            <span className={`text-sm leading-snug font-bold ${
                              item.parentItemId === parent.id ? 'text-white' : 'text-slate-800'
                            }`}>{parent.popis}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-6 py-12 text-center text-sm font-black bg-slate-300 rounded-none border-4 border-slate-600 text-slate-900 uppercase tracking-widest shadow-[4px_4px_0_rgba(0,0,0,0.2)]">
                      ŽÁDNÉ HLAVNÍ POLOŽKY
                    </div>
                  )}
                </div>

                {/* Resize handle - нижний правый угол */}
                <div
                  className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center"
                  style={{ backgroundColor: '#334155' }} // slate-700
                  onMouseDown={handleResizeStart}
                  title="Změnit velikost"
                >
                  <GripVertical size={14} className="text-slate-400 rotate-45" />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
