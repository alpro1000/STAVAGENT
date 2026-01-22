/**
 * AI Panel Component
 * Provides AI-powered operations for BOQ items
 */

import { useState } from 'react';
import { Sparkles, Loader2, Brain, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { classifyItems, groupItems, type GroupResult } from '../../services/ai';
import { useRegistryStore } from '../../stores/registryStore';
import type { ParsedItem } from '../../types/item';

interface AIPanelProps {
  items: ParsedItem[];
  projectId: string;
  selectedItemIds?: string[];
}

export function AIPanel({ items, projectId, selectedItemIds = [] }: AIPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isGrouping, setIsGrouping] = useState(false);
  const [groupingResult, setGroupingResult] = useState<GroupResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const { bulkSetSkupina } = useRegistryStore();

  const itemsToProcess = selectedItemIds.length > 0
    ? items.filter(item => selectedItemIds.includes(item.id))
    : items;

  const handleClassify = async () => {
    if (itemsToProcess.length === 0) return;

    setIsClassifying(true);
    setError(null);
    setLastAction(null);

    try {
      const response = await classifyItems(itemsToProcess);

      if (response.success && response.results) {
        // Apply classifications to store
        const updates = response.results.map(r => ({
          itemId: r.id,
          skupina: r.skupina
        }));

        bulkSetSkupina(projectId, updates);
        setLastAction(`Klasifikováno ${updates.length} položek (${response.source})`);
      } else {
        setError(response.error || 'Classification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsClassifying(false);
    }
  };

  const handleGroup = async (groupBy: 'similarity' | 'function' | 'material' | 'location') => {
    if (itemsToProcess.length === 0) return;

    setIsGrouping(true);
    setError(null);
    setGroupingResult(null);

    try {
      const response = await groupItems(itemsToProcess, groupBy);

      if (response.success && response.groups) {
        setGroupingResult(response.groups);
        setLastAction(`Seskupeno do ${response.groups.length} skupin (${response.source})`);
      } else {
        setError(response.error || 'Grouping failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGrouping(false);
    }
  };

  const handleApplyGroup = (group: GroupResult) => {
    const updates = group.itemIds.map(id => ({
      itemId: id,
      skupina: group.groupName
    }));
    bulkSetSkupina(projectId, updates);
    setLastAction(`Aplikována skupina "${group.groupName}" na ${updates.length} položek`);
  };

  const handleApplyAllGroups = () => {
    if (!groupingResult) return;

    const allUpdates = groupingResult.flatMap(group =>
      group.itemIds.map(id => ({
        itemId: id,
        skupina: group.groupName
      }))
    );
    bulkSetSkupina(projectId, allUpdates);
    setGroupingResult(null);
    setLastAction(`Aplikováno ${groupingResult.length} skupin na ${allUpdates.length} položek`);
  };

  return (
    <div className="card bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/30">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Brain className="text-purple-400" size={20} />
          <h3 className="font-semibold text-purple-300">AI Asistent</h3>
          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
            {selectedItemIds.length > 0
              ? `${selectedItemIds.length} vybráno`
              : `${items.length} položek`
            }
          </span>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Action Buttons */}
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
              AI Klasifikace
            </button>

            <div className="relative group">
              <button
                disabled={isGrouping || itemsToProcess.length === 0}
                className="btn btn-secondary text-sm flex items-center gap-2"
              >
                {isGrouping ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Layers size={16} />
                )}
                AI Seskupení
                <ChevronDown size={14} />
              </button>
              <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-color rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[200px]">
                <button
                  onClick={() => handleGroup('similarity')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-bg-tertiary"
                >
                  Podle podobnosti
                </button>
                <button
                  onClick={() => handleGroup('function')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-bg-tertiary"
                >
                  Podle funkce
                </button>
                <button
                  onClick={() => handleGroup('material')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-bg-tertiary"
                >
                  Podle materiálu
                </button>
                <button
                  onClick={() => handleGroup('location')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-bg-tertiary"
                >
                  Podle umístění
                </button>
              </div>
            </div>
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

          {/* Grouping Results */}
          {groupingResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Navrhované skupiny:</h4>
                <button
                  onClick={handleApplyAllGroups}
                  className="btn btn-primary text-xs py-1"
                >
                  Aplikovat vše
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {groupingResult.map((group, i) => (
                  <div
                    key={i}
                    className="bg-bg-tertiary p-3 rounded-lg border border-border-color"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{group.groupName}</p>
                        <p className="text-xs text-text-secondary">{group.groupDescription}</p>
                        <p className="text-xs text-text-muted mt-1">
                          {group.itemCount} položek • {group.totalCena.toLocaleString('cs-CZ')} Kč
                        </p>
                      </div>
                      <button
                        onClick={() => handleApplyGroup(group)}
                        className="btn btn-secondary text-xs py-1 px-2"
                      >
                        Aplikovat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-text-muted">
            AI využívá concrete-agent Multi-Role API pro inteligentní klasifikaci a seskupování položek.
          </p>
        </div>
      )}
    </div>
  );
}
