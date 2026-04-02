/**
 * Row Actions Cell Component
 *
 * Управление строками таблицы:
 * - Удалить позицию (🗑️)
 * - Изменить роль (Hlavní / Podřízený / Sekce)
 * - Переместить вверх/вниз (↑↓)
 * - Připojit k... (выбор родителя)
 *
 * LIGHT THEME - легкий читаемый стиль
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { MoveUp, MoveDown, Link2, X, GripVertical, ClipboardList, FileText, CircleHelp } from 'lucide-react';
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

const ROLE_ICONS: Record<RowRole, React.ReactNode> = {
  main: <ClipboardList size={12} className="inline" />,
  subordinate: '↳',
  section: <FileText size={12} className="inline" />,
  unknown: <CircleHelp size={12} className="inline" />,
};

// Light theme colors
const LIGHT = {
  panelBg: '#FFFFFF',
  panelBgAlt: '#F5F6F7',
  headerBg: '#EAEBEC',
  border: '#D0D2D4',
  borderLight: '#E5E7EB',
  text: '#1A1C1E',
  textMuted: '#6B7280',
  accent: '#FF9F1C',
  accentHover: '#E68A00',
  shadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  backdrop: 'rgba(0, 0, 0, 0.4)',
};

export function RowActionsCell({ item, projectId, sheetId, allItems }: RowActionsCellProps) {
  const { updateItemRole, updateItemParent, moveItemUp, moveItemDown } = useRegistryStore();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showParentMenu, setShowParentMenu] = useState(false);
  const [dropdownFlip, setDropdownFlip] = useState(false); // true = open upward
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const roleButtonRef = useRef<HTMLButtonElement>(null);

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

      {/* Role dropdown - compact, LIGHT theme */}
      <div className="relative" ref={roleMenuRef}>
        <button
          ref={roleButtonRef}
          onClick={() => {
            if (!showRoleMenu && roleButtonRef.current) {
              const rect = roleButtonRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              setDropdownFlip(spaceBelow < 130); // ~120px for 3 options + padding
            }
            setShowRoleMenu(!showRoleMenu);
          }}
          title={`Role: ${ROLE_LABELS[currentRole]}`}
          className="px-1 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-0.5"
          style={{
            backgroundColor: showRoleMenu ? LIGHT.headerBg : 'transparent',
            color: LIGHT.textMuted,
          }}
        >
          <span className="text-[10px]">{ROLE_ICONS[currentRole]}</span>
        </button>

        {showRoleMenu && (
          <div
            className={`absolute left-0 py-1 min-w-[120px] border rounded-lg z-50 ${dropdownFlip ? 'bottom-full mb-1' : 'top-full mt-1'}`}
            style={{
              backgroundColor: LIGHT.panelBg,
              borderColor: LIGHT.border,
              boxShadow: LIGHT.shadow,
            }}
          >
            {(['main', 'subordinate', 'section'] as RowRole[]).map((role) => (
              <button
                key={role}
                onClick={() => handleChangeRole(role)}
                className="w-full px-3 py-1.5 text-left text-xs font-medium flex items-center gap-2 transition-colors"
                style={{
                  backgroundColor: currentRole === role ? LIGHT.accent : 'transparent',
                  color: currentRole === role ? '#ffffff' : LIGHT.text,
                }}
                onMouseEnter={(e) => {
                  if (currentRole !== role) {
                    e.currentTarget.style.backgroundColor = LIGHT.panelBgAlt;
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
              {/* Backdrop - semi-transparent */}
              <div
                className="fixed inset-0 z-[99998]"
                style={{ backgroundColor: LIGHT.backdrop }}
              />

              {/* Modal panel - LIGHT theme, centered, resizable */}
              <div
                className="fixed border rounded-xl z-[99999] flex flex-col"
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
                  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
                  backgroundColor: LIGHT.panelBg,
                  borderColor: LIGHT.border,
                }}
              >
                {/* Header - light with accent border */}
                <div
                  className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                  style={{ backgroundColor: LIGHT.headerBg, borderColor: LIGHT.border }}
                >
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: LIGHT.text }}>
                      🔗 Připojit k položce
                    </h3>
                    <p className="text-xs mt-1" style={{ color: LIGHT.textMuted }}>
                      Vyberte hlavní položku pro připojení
                    </p>
                  </div>
                  {/* Close button X */}
                  <button
                    onClick={() => setShowParentMenu(false)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: LIGHT.textMuted }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = LIGHT.panelBgAlt}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Zavřít"
                  >
                    <X size={24} strokeWidth={2} />
                  </button>
                </div>

                {/* Content - light background, scrollable */}
                <div
                  className="flex-1 overflow-y-auto p-5"
                  style={{ backgroundColor: LIGHT.panelBgAlt }}
                >
                  {/* Option to detach (no parent) */}
                  <button
                    onClick={() => handleAttachToParent(null)}
                    className="w-full px-5 py-4 text-left transition-all rounded-lg mb-3 border"
                    style={{
                      backgroundColor: !item.parentItemId ? LIGHT.accent : LIGHT.panelBg,
                      borderColor: !item.parentItemId ? LIGHT.accentHover : LIGHT.border,
                      color: !item.parentItemId ? '#ffffff' : LIGHT.text,
                      boxShadow: !item.parentItemId ? '0 4px 12px rgba(255, 159, 28, 0.3)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl">🔓</span>
                      <span className="text-sm font-semibold">
                        (Žádný rodič - odpojit)
                      </span>
                    </div>
                  </button>

                  {/* List of potential parents */}
                  {potentialParents.length > 0 ? (
                    <div className="space-y-2">
                      {potentialParents.map((parent) => {
                        const isSelected = item.parentItemId === parent.id;
                        return (
                          <button
                            key={parent.id}
                            onClick={() => handleAttachToParent(parent.id)}
                            className="w-full px-5 py-4 text-left transition-all rounded-lg border"
                            style={{
                              backgroundColor: isSelected ? LIGHT.accent : LIGHT.panelBg,
                              borderColor: isSelected ? LIGHT.accentHover : LIGHT.border,
                              color: isSelected ? '#ffffff' : LIGHT.text,
                              boxShadow: isSelected ? '0 4px 12px rgba(255, 159, 28, 0.3)' : 'none',
                            }}
                          >
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-3">
                                <span
                                  className="font-mono text-xs px-2 py-1 rounded font-semibold"
                                  style={{
                                    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : LIGHT.headerBg,
                                    color: isSelected ? '#ffffff' : LIGHT.textMuted,
                                  }}
                                >
                                  {parent.boqLineNumber || '—'}
                                </span>
                                <span className="font-bold">
                                  {parent.kod}
                                </span>
                              </div>
                              <span className="text-sm leading-snug">
                                {parent.popis}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className="px-6 py-12 text-center text-sm font-medium rounded-lg border"
                      style={{
                        backgroundColor: LIGHT.panelBg,
                        borderColor: LIGHT.border,
                        color: LIGHT.textMuted,
                      }}
                    >
                      Žádné hlavní položky
                    </div>
                  )}
                </div>

                {/* Resize handle - bottom right corner */}
                <div
                  className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center rounded-br-xl"
                  style={{ backgroundColor: LIGHT.headerBg }}
                  onMouseDown={handleResizeStart}
                  title="Změnit velikost"
                >
                  <GripVertical size={14} style={{ color: LIGHT.textMuted }} className="rotate-45" />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
