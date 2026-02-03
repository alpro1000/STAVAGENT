/**
 * Bulk Actions Bar Component
 * Панель массовых операций для выбранных строк
 */

import { useState } from 'react';
import { Trash2, Tag, X } from 'lucide-react';
import { useRegistryStore } from '../../stores/registryStore';
import { SkupinaAutocomplete } from './SkupinaAutocomplete';

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  projectId: string;
  sheetId: string;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedIds,
  projectId,
  sheetId,
  onClearSelection,
}: BulkActionsBarProps) {
  const { bulkSetSkupina, getAllGroups, addCustomGroup } = useRegistryStore();
  const allGroups = getAllGroups();
  const [showSkupinaDropdown, setShowSkupinaDropdown] = useState(false);

  const selectedCount = selectedIds.size;

  if (selectedCount === 0) {
    return null; // Не показываем панель, если ничего не выбрано
  }

  const handleBulkDelete = () => {
    if (!confirm(`Opravdu chcete smazat ${selectedCount} položek?`)) {
      return;
    }

    const { deleteItem } = useRegistryStore.getState();
    selectedIds.forEach((id) => {
      deleteItem(projectId, sheetId, id);
    });

    onClearSelection();
  };

  const handleBulkSetSkupina = (skupina: string | null) => {
    if (skupina === null) {
      // Clear skupina for all selected
      const updates = Array.from(selectedIds).map((itemId) => ({
        itemId,
        skupina: null!,
      }));
      bulkSetSkupina(projectId, sheetId, updates);
    } else {
      // Set skupina for all selected
      const updates = Array.from(selectedIds).map((itemId) => ({
        itemId,
        skupina,
      }));
      bulkSetSkupina(projectId, sheetId, updates);
    }

    setShowSkupinaDropdown(false);
    onClearSelection();
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className="bg-[var(--accent-orange)] text-white rounded-lg shadow-2xl px-6 py-4 flex items-center gap-4"
        style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}
      >
        {/* Selected count */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{selectedCount}</span>
          <span className="text-sm">
            {selectedCount === 1 ? 'položka vybrána' : selectedCount < 5 ? 'položky vybrány' : 'položek vybráno'}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/30"></div>

        {/* Delete button */}
        <button
          onClick={handleBulkDelete}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded transition-colors"
          title="Smazat vybrané položky"
        >
          <Trash2 size={16} />
          <span className="text-sm font-medium">Smazat</span>
        </button>

        {/* Apply skupina button */}
        <div className="relative">
          <button
            onClick={() => setShowSkupinaDropdown(!showSkupinaDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
            title="Aplikovat skupinu na vybrané položky"
          >
            <Tag size={16} />
            <span className="text-sm font-medium">Nastavit skupinu</span>
          </button>

          {showSkupinaDropdown && (
            <div
              className="absolute bottom-full left-0 mb-2 bg-[var(--bg-primary)] border-2 border-[var(--border-color)] rounded-lg shadow-xl z-50 min-w-[280px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3">
                <p className="text-xs text-[var(--text-secondary)] mb-2">
                  Vyberte skupinu pro {selectedCount} položek:
                </p>
                <SkupinaAutocomplete
                  value={null}
                  onChange={(value) => handleBulkSetSkupina(value)}
                  allGroups={allGroups}
                  onAddGroup={addCustomGroup}
                  itemId="bulk-action"
                  enableLearning={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* Clear selection */}
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1 px-3 py-2 hover:bg-white/20 rounded transition-colors ml-2"
          title="Zrušit výběr"
        >
          <X size={18} />
          <span className="text-xs">Zrušit</span>
        </button>
      </div>
    </div>
  );
}
