/**
 * AI Panel Component
 * Provides rule-based classification operations for BOQ items
 * Uses local classificationService (no external API required)
 *
 * UX: Button assigns work groups (skupina) to items based on keywords
 * in the item description. Results are applied directly to the table.
 */

import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, RotateCcw, Zap } from 'lucide-react';
import { classifyItems as classifyItemsLocal } from '../../services/classification/classificationService';
import { useRegistryStore } from '../../stores/registryStore';
import type { ParsedItem } from '../../types/item';

interface AIPanelProps {
  items: ParsedItem[];
  projectId: string;
  sheetId: string;
  selectedItemIds?: string[];
}

export function AIPanel({ items, projectId, sheetId, selectedItemIds = [] }: AIPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [classificationStats, setClassificationStats] = useState<{
    classified: number;
    skipped: number;
    total: number;
    groupCounts: Record<string, number>;
  } | null>(null);

  const { bulkSetSkupina } = useRegistryStore();

  const itemsToProcess = selectedItemIds.length > 0
    ? items.filter(item => selectedItemIds.includes(item.id))
    : items;

  // Count current classification status
  const classifiedCount = items.filter(i => i.skupina).length;
  const unclassifiedCount = items.length - classifiedCount;

  const handleClassify = (overwrite: boolean) => {
    if (itemsToProcess.length === 0) return;

    setIsClassifying(true);
    setError(null);
    setLastAction(null);
    setClassificationStats(null);

    try {
      // Use local rule-based classifier (synchronous, no API call)
      const result = classifyItemsLocal(itemsToProcess, { overwrite });

      if (result.classified > 0) {
        // Build updates with cascade to description rows
        const updates: Array<{ itemId: string; skupina: string }> = [];

        // Sort items by row position for cascade logic
        const sortedItems = [...items].sort((a, b) =>
          a.source.rowStart - b.source.rowStart
        );

        // Create a map of classifications from the result
        const classificationMap = new Map<string, string>();
        for (const r of result.results) {
          if (r.wasClassified && r.suggestedSkupina) {
            classificationMap.set(r.itemId, r.suggestedSkupina);
          }
        }

        // Apply with cascade: when a main item (with kod) is classified,
        // all following description rows (without kod) get the same group
        let lastMainItemSkupina: string | null = null;

        for (const item of sortedItems) {
          const hasCode = item.kod && item.kod.trim().length > 0;

          if (hasCode) {
            const skupina = classificationMap.get(item.id);
            if (skupina) {
              updates.push({ itemId: item.id, skupina });
              lastMainItemSkupina = skupina;
            } else {
              lastMainItemSkupina = null;
            }
          } else {
            // Description row - cascade from last classified main item
            if (lastMainItemSkupina) {
              updates.push({ itemId: item.id, skupina: lastMainItemSkupina });
            }
          }
        }

        // Apply all at once
        if (updates.length > 0) {
          bulkSetSkupina(projectId, sheetId, updates);
        }

        setClassificationStats({
          classified: result.classified,
          skipped: result.unclassified,
          total: result.totalItems,
          groupCounts: result.groupCounts,
        });

        const mode = overwrite ? 'Překlasifikováno' : 'Klasifikováno';
        setLastAction(
          `${mode} ${result.classified} z ${result.totalItems} položek → skupiny přiřazeny do tabulky (${updates.length} řádků celkem s kaskádou)`
        );
      } else {
        setLastAction(
          overwrite
            ? 'Žádné položky nebyly klasifikovány (chybí klíčová slova v popisech)'
            : unclassifiedCount === 0
              ? 'Všechny položky již mají přiřazenou skupinu'
              : 'Žádné nové položky nebyly klasifikovány (chybí klíčová slova v popisech)'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při klasifikaci');
    } finally {
      setIsClassifying(false);
    }
  };

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--accent-orange)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="text-accent-primary" size={20} />
          <h3 className="font-semibold text-text-primary">Automatická klasifikace</h3>
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
            {selectedItemIds.length > 0
              ? `${selectedItemIds.length} vybráno`
              : `${classifiedCount}/${items.length} klasifikováno`
            }
          </span>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Explanation */}
          <p className="text-sm text-text-secondary">
            Automaticky přiřadí <strong>skupinu prací</strong> (např. BETON_MONOLIT, PILOTY, ZEMNI_PRACE)
            {' '}každé položce podle klíčových slov v popisu. Výsledek se zapíše přímo do sloupce &quot;Skupina&quot; v tabulce.
          </p>

          {/* Current status bar */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-secondary">
              Se skupinou: <strong className="text-green-400">{classifiedCount}</strong>
            </span>
            {unclassifiedCount > 0 && (
              <span className="text-text-secondary">
                Bez skupiny: <strong className="text-yellow-400">{unclassifiedCount}</strong>
              </span>
            )}
            <span className="text-text-muted">
              / {items.length} celkem
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Primary: classify only empty */}
            <button
              onClick={() => handleClassify(false)}
              disabled={isClassifying || itemsToProcess.length === 0 || unclassifiedCount === 0}
              className="btn btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
              title="Klasifikuje pouze položky bez přiřazené skupiny"
            >
              {isClassifying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              Klasifikovat prázdné ({unclassifiedCount})
            </button>

            {/* Secondary: re-classify all */}
            <button
              onClick={() => handleClassify(true)}
              disabled={isClassifying || itemsToProcess.length === 0}
              className="btn text-sm flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50"
              title="Přepíše všechny skupiny - znovu klasifikuje celý list"
            >
              <RotateCcw size={14} />
              Překlasifikovat vše
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Success message */}
          {lastAction && !error && (
            <div className="text-sm text-green-400 bg-green-900/20 px-3 py-2 rounded">
              {lastAction}
            </div>
          )}

          {/* Classification Stats */}
          {classificationStats && Object.keys(classificationStats.groupCounts).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-text-secondary">Přiřazené skupiny:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(classificationStats.groupCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([group, count]) => (
                    <div
                      key={group}
                      className="bg-bg-tertiary px-3 py-1.5 rounded border border-border-color text-sm flex items-center justify-between"
                    >
                      <span className="font-medium text-accent-primary">{group}</span>
                      <span className="text-text-muted">{count}x</span>
                    </div>
                  ))}
              </div>
              {classificationStats.skipped > 0 && (
                <p className="text-xs text-text-muted">
                  {classificationStats.skipped} položek nerozpoznáno (lze přiřadit ručně ve sloupci &quot;Skupina&quot;)
                </p>
              )}
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-text-muted">
            11 skupin: ZEMNI_PRACE, BETON_MONOLIT, BETON_PREFAB, VYZTUŽ, KOTVENI, BEDNENI, PILOTY, IZOLACE, KOMUNIKACE, DOPRAVA, LOŽISKA.
            Priorita: PILOTY &gt; vše ostatní pokud popis obsahuje &quot;pilot&quot;.
          </p>
        </div>
      )}
    </div>
  );
}
