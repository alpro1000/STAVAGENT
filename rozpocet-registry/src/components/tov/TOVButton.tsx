/**
 * TOVButton Component
 *
 * A button that appears next to each position in the ItemsTable.
 * Opens the TOV (Rozpis zdrojů / Resource Breakdown) modal.
 */

import { BarChart3 } from 'lucide-react';

interface TOVButtonProps {
  itemId: string;
  hasData: boolean;
  onClick: () => void;
}

export function TOVButton({ hasData, onClick }: TOVButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`p-1 rounded transition-colors ${
        hasData
          ? 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
          : 'hover:bg-bg-secondary text-text-muted hover:text-text-secondary'
      }`}
      title={hasData ? 'Zobrazit rozpis zdrojů' : 'Přidat zdroje'}
    >
      <BarChart3 size={16} />
    </button>
  );
}
