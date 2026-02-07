/**
 * TOVButton Component
 *
 * A button that appears next to each position in the ItemsTable.
 * Opens the TOV (Ведомость ресурсов / Resource Breakdown) modal.
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
      title={hasData ? 'Zobrazit ведомость ресурсов' : 'Přidat ресурсы'}
    >
      <BarChart3 size={16} />
    </button>
  );
}
