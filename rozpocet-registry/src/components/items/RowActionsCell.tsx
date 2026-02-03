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
import { MoveUp, MoveDown, Link2, X, GripVertical } from 'lucide-react';
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
  const { updateItemRole, updateItemParent, moveItemUp, moveItemDown } = useRegistryStore();

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

  // Close role menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentRole = (item.rowRole || 'unknown') as RowRole;

  // Get potential parents (only main items)
  const potentialParents = allItems.filter(
    (i) => i.rowRole === 'main' && i.id !== item.id
  );

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
    <div className="flex items-center gap-0">
      {/* Move up/down buttons - compact, left-aligned */}
      <button
        onClick={handleMoveUp}
        title="Přesunout nahoru"
        className="p-0.5 rounded hover:bg-bg-secondary transition-colors text-text-muted"
      >
        <MoveUp size={11} />
      </button>
      <button
        onClick={handleMoveDown}
        title="Přesunout dolů"
        className="p-0.5 rounded hover:bg-bg-secondary transition-colors text-text-muted"
      >
        <MoveDown size={11} />
      </button>

      {/* Role dropdown - compact */}
      <div className="relative" ref={roleMenuRef}>
        <button
          onClick={() => setShowRoleMenu(!showRoleMenu)}
          title={`Role: ${ROLE_LABELS[currentRole]}`}
          className="px-1 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-0.5"
          style={{
            backgroundColor: showRoleMenu ? '#3e4348' : 'transparent',
            color: '#8a9199',
          }}
        >
          <span className="text-[10px]">{ROLE_ICONS[currentRole]}</span>
        </button>

        {showRoleMenu && (
          <div
            className="absolute left-0 top-full mt-1 py-1 min-w-[120px] border-2 z-50"
            style={{
              backgroundColor: '#2d3139',
              borderColor: '#3e4348',
              boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            }}
          >
            {(['main', 'subordinate', 'section'] as RowRole[]).map((role) => (
              <button
                key={role}
                onClick={() => handleChangeRole(role)}
                className="w-full px-3 py-1.5 text-left text-xs font-medium flex items-center gap-2 transition-colors"
                style={{
                  backgroundColor: currentRole === role ? '#FF9F1C' : 'transparent',
                  color: currentRole === role ? '#ffffff' : '#f5f6f7',
                }}
                onMouseEnter={(e) => {
                  if (currentRole !== role) {
                    e.currentTarget.style.backgroundColor = '#3e4348';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentRole !== role) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{ROLE_ICONS[role]}</span>
                <span>{ROLE_LABELS[role]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
              {/* Backdrop - Digital Concrete темно-серый, НЕ закрывается по клику */}
              <div
                className="fixed inset-0 z-[99998]"
                style={{ backgroundColor: '#1a1d21' }} // Digital Concrete dark gray - fully opaque
              />

              {/* Modal panel - Digital Concrete, ЦЕНТР, ИЗМЕНЯЕМЫЙ РАЗМЕР */}
              <div
                className="fixed border-4 z-[99999] flex flex-col"
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
                  boxShadow: '8px 8px 0 rgba(0,0,0,0.4), 0 16px 48px rgba(0,0,0,0.6)',
                  backgroundColor: '#2d3139', // Digital Concrete panel bg
                  borderColor: '#3e4348', // Digital Concrete border
                }}
              >
                {/* Header - Digital Concrete с кнопкой X */}
                <div
                  className="flex items-center justify-between px-6 py-4 border-b-4 flex-shrink-0"
                  style={{ backgroundColor: '#2d3139', borderColor: '#3e4348' }}
                >
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-widest" style={{ color: '#f5f6f7' }}>🔗 PŘIPOJIT K POLOŽCE</h3>
                    <p className="text-xs mt-1 font-bold uppercase tracking-wide" style={{ color: '#8a9199' }}>Vyberte hlavní položku pro připojení</p>
                  </div>
                  {/* Close button X */}
                  <button
                    onClick={() => setShowParentMenu(false)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: '#8a9199' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3e4348'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Zavřít"
                  >
                    <X size={24} strokeWidth={3} />
                  </button>
                </div>

                {/* Content - Digital Concrete светлый фон, прокручиваемый */}
                <div
                  className="flex-1 overflow-y-auto p-5"
                  style={{ backgroundColor: '#f5f6f7' }} // Digital Concrete data surface
                >
                  {/* Option to detach (no parent) */}
                  <button
                    onClick={() => handleAttachToParent(null)}
                    className="w-full px-6 py-5 text-left transition-all rounded-none mb-3 border-4"
                    style={{
                      backgroundColor: !item.parentItemId ? '#FF9F1C' : '#ffffff',
                      borderColor: !item.parentItemId ? '#e68a00' : '#3e4348',
                      color: !item.parentItemId ? '#ffffff' : '#1a1d21',
                      boxShadow: !item.parentItemId ? '6px 6px 0 rgba(0,0,0,0.3)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">🔓</span>
                      <span className="text-sm font-black uppercase tracking-wide">
                        (ŽÁDNÝ RODIČ - ODPOJIT)
                      </span>
                    </div>
                  </button>

                  {/* List of potential parents */}
                  {potentialParents.length > 0 ? (
                    <div className="space-y-3">
                      {potentialParents.map((parent) => {
                        const isSelected = item.parentItemId === parent.id;
                        return (
                          <button
                            key={parent.id}
                            onClick={() => handleAttachToParent(parent.id)}
                            className="w-full px-6 py-5 text-left transition-all rounded-none border-4"
                            style={{
                              backgroundColor: isSelected ? '#FF9F1C' : '#ffffff',
                              borderColor: isSelected ? '#e68a00' : '#3e4348',
                              color: isSelected ? '#ffffff' : '#1a1d21',
                              boxShadow: isSelected ? '6px 6px 0 rgba(0,0,0,0.3)' : 'none',
                            }}
                          >
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-3">
                                <span
                                  className="font-mono text-xs px-3 py-1.5 font-black uppercase tracking-wider border-2"
                                  style={{
                                    backgroundColor: '#2d3139',
                                    color: '#f5f6f7',
                                    borderColor: '#3e4348'
                                  }}
                                >
                                  {parent.boqLineNumber || '—'}
                                </span>
                                <span className="font-black text-lg tracking-tight">
                                  {parent.kod}
                                </span>
                              </div>
                              <span className="text-sm leading-snug font-bold">
                                {parent.popis}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className="px-6 py-12 text-center text-sm font-black rounded-none border-4 uppercase tracking-widest"
                      style={{
                        backgroundColor: '#e5e7eb',
                        borderColor: '#3e4348',
                        color: '#1a1d21',
                        boxShadow: '4px 4px 0 rgba(0,0,0,0.2)',
                      }}
                    >
                      ŽÁDNÉ HLAVNÍ POLOŽKY
                    </div>
                  )}
                </div>

                {/* Resize handle - нижний правый угол */}
                <div
                  className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center"
                  style={{ backgroundColor: '#3e4348' }}
                  onMouseDown={handleResizeStart}
                  title="Změnit velikost"
                >
                  <GripVertical size={14} style={{ color: '#8a9199' }} className="rotate-45" />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
