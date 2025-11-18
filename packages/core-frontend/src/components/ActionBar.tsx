import React, { useCallback, useState } from 'react';
import type { ChatAction, ChatResponse } from '../services/chatApi';
import { triggerAction } from '../services/chatApi';

type ActionConfig = {
  label: string;
  action: ChatAction;
  icon: string;
  options?: Record<string, unknown>;
  requiresPosition?: boolean;
  freeFormQuery?: string;
};

const ACTIONS: ActionConfig[] = [
  {
    label: 'Kontrola',
    action: 'audit_positions',
    icon: '✓',
    options: { check_norms: true, check_catalog: true },
  },
  {
    label: 'Výměr',
    action: 'vykaz_vymer',
    icon: '📊',
    options: { by_section: true, totals: true },
  },
  {
    label: 'Materiály',
    action: 'materials_detailed',
    icon: '🧱',
    options: { show_sources: true, show_characteristics: true, show_suppliers: true },
  },
  {
    label: 'Zdroje',
    action: 'resource_sheet',
    icon: '⚙️',
    options: { by_section: true, include_timeline: true },
  },
  {
    label: 'Shrnutí',
    action: 'project_summary',
    icon: '📋',
    options: { detail_level: 'full' },
  },
  {
    label: 'Technická karta',
    action: 'tech_card',
    icon: '🛠️',
    requiresPosition: true,
  },
];

interface ActionBarProps {
  projectId?: string;
  disabled?: boolean;
  onActionStart?: (label: string) => void;
  onActionComplete?: (response: ChatResponse, label: string) => void;
  onError?: (message: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  positionId?: string;
}

const ActionBar: React.FC<ActionBarProps> = ({
  projectId,
  disabled = false,
  onActionStart,
  onActionComplete,
  onError,
  onLoadingChange,
  positionId,
}) => {
  const [activeAction, setActiveAction] = useState<ChatAction | null>(null);

  const handleError = useCallback(
    (message: string) => {
      if (onError) {
        onError(message);
      }
    },
    [onError],
  );

  const handleClick = useCallback(
    async (action: ActionConfig) => {
      if (!projectId || disabled || activeAction) {
        if (!projectId) {
          handleError('Vyber projekt a zkus to znovu.');
        }
        return;
      }

      if (action.requiresPosition && !positionId) {
        handleError('Technická karta vyžaduje zvolenou pozici.');
        return;
      }

      try {
        setActiveAction(action.action);
        onLoadingChange?.(true);
        onActionStart?.(action.label);

        const response = await triggerAction({
          projectId,
          action: action.action,
          options: action.options,
          positionId: action.requiresPosition ? positionId : undefined,
          freeFormQuery: action.freeFormQuery,
        });
        onActionComplete?.(response, action.label);
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'Neznámá chyba');
      } finally {
        setActiveAction(null);
        onLoadingChange?.(false);
      }
    },
    [projectId, disabled, activeAction, positionId, onActionStart, onActionComplete, onLoadingChange, handleError],
  );

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        {ACTIONS.map((item) => {
          const isLoading = activeAction === item.action;
          return (
            <button
              key={item.action}
              type="button"
              onClick={() => handleClick(item)}
              disabled={disabled || Boolean(activeAction)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {item.label}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ActionBar;
