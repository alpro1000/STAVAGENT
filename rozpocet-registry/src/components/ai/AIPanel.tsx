/**
 * AI Panel Component
 * Provides rule-based classification operations for BOQ items
 * Uses local classificationService (no external API required)
 */

import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
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

  const handleClassify = () => {
    if (itemsToProcess.length === 0) return;

    setIsClassifying(true);
    setError(null);
    setLastAction(null);
    setClassificationStats(null);

    try {
      // Use local rule-based classifier (synchronous, no API call)
      const result = classifyItemsLocal(itemsToProcess, { overwrite: true });

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
              // Item was not classified (already had a group or low confidence)
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

        setLastAction(
          `Klasifikováno ${result.classified} z ${result.totalItems} položek (${updates.length} celkem s kaskádou)`
        );
      } else {
        setLastAction('Žádné položky nebyly klasifikovány (chybí klíčová slova v popisech)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při klasifikaci');
    } finally {
      setIsClassifying(false);
    }
  };

  // Count current classification status
  const classifiedCount = items.filter(i => i.skupina).length;
  const unclassifiedCount = items.length - classifiedCount;

  return (
    <div className="card bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/30">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="text-purple-400" size={20} />
          <h3 className="font-semibold text-purple-300">Automatická klasifikace</h3>
          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
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
          {/* Current status */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-secondary">
              Klasifikováno: <strong className="text-green-400">{classifiedCount}</strong>
            </span>
            {unclassifiedCount > 0 && (
              <span className="text-text-secondary">
                Bez skupiny: <strong className="text-yellow-400">{unclassifiedCount}</strong>
              </span>
            )}
          </div>

          {/* Action Button */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleClassify}
              disabled={isClassifying || itemsToProcess.length === 0}
              className="btn btn-primary text-sm flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isClassifying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              Klasifikovat položky
            </button>
            <span className="text-xs text-text-muted self-center">
              Lokální pravidlový klasifikátor (10 skupin prací)
            </span>
          </div>

          {/* Status */}
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {lastAction && !error && (
            <div className="text-sm text-green-400 bg-green-900/20 px-3 py-2 rounded">
              ✓ {lastAction}
            </div>
          )}

          {/* Classification Stats */}
          {classificationStats && Object.keys(classificationStats.groupCounts).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-text-secondary">Rozřazení do skupin:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(classificationStats.groupCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([group, count]) => (
                    <div
                      key={group}
                      className="bg-bg-tertiary px-3 py-2 rounded-lg border border-border-color text-sm"
                    >
                      <span className="font-medium text-accent-primary">{group}</span>
                      <span className="text-text-muted ml-2">({count})</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-text-muted">
            Pravidlový klasifikátor na základě klíčových slov v popisu.
            Skupiny: ZEMNI_PRACE, BETON_MONOLIT, BETON_PREFAB, VYZTUŽ, KOTVENI, BEDNENI, PILOTY, IZOLACE, KOMUNIKACE, DOPRAVA.
          </p>
        </div>
      )}
    </div>
  );
}
