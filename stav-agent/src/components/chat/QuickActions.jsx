import React from 'react';
import { QUICK_ACTIONS } from '../../utils/constants';

export default function QuickActions({ onAction, isLoading }) {
  const handleClick = (action) => {
    if (!isLoading && onAction) {
      onAction(action.apiAction);
    }
  };

  return (
    <div className="px-4 py-3 bg-white border-t border-gray-200">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {QUICK_ACTIONS.map((action) => (
          <button
            type="button"
            key={action.id}
            onClick={() => handleClick(action)}
            disabled={isLoading}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              action.color
            } disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md`}
            title={action.description || action.label}
          >
            {action.icon} {action.label}
          </button>
        ))}
      </div>
      {/* Подсказка для новичков */}
      <div className="text-xs text-gray-500 mt-2 px-2">
        💡 Tip: Můžete také psát příkazy do chatu, např. "Vypiš všechny značky betonu"
      </div>
    </div>
  );
}
