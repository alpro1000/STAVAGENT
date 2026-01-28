/**
 * AI Panel Component
 * Provides rule-based classification operations for BOQ items
 * Uses local classificationService (no external API required)
 *
 * IMPORTANT CLASSIFICATION RULES:
 * - Classifies ONLY main/section items (rowRole === 'main' or 'section')
 * - Subordinate rows (PP, PSC, VV, A195, B5, etc.) are NEVER classified directly
 * - Subordinate descriptions are used as CONTEXT for understanding the main item
 * - Skupina is assigned ONLY to main items, subordinates inherit via cascade
 * - Uses isMainCodeExported() to correctly identify main codes vs sub-indices
 *
 * SYSTEM PROMPT (for future LLM integration):
 *
 * You classify ONLY the main BOQ item (main row) into a "Skupina" (work group).
 * You are given: (1) main row description and (2) subordinate rows (PP/PSC/VV/A195/B5)
 * as context only. Subordinate rows may contain quantity calculations, notes, formulas,
 * and total lines. They are NOT separate positions.
 *
 * Rules:
 * - Use subordinate rows ONLY to better understand the main item's materials and work type
 * - Return Skupina ONLY for the main row. Never assign Skupina to subordinate rows
 * - If information is insufficient or confidence is low, return "unknown" or empty value
 *   with confidence=low, so the system preserves the old Skupina
 * - Never conclude "main position" solely based on presence of a value in the "code" column
 *
 * Response format (strict):
 * skupina: <one short label or "unknown">
 * confidence: high|medium|low
 * reason: <max 1 sentence, no long explanation>
 *
 * END SYSTEM PROMPT
 *
 * UX: Button assigns work groups (skupina) to main items based on keywords
 * in the item description + subordinate context. Results cascade to subordinates.
 */

import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, RotateCcw, Zap } from 'lucide-react';
import { classifyItems as classifyItemsLocal } from '../../services/classification/classificationService';
import { useRegistryStore } from '../../stores/registryStore';
import { isMainCodeExported } from '../../services/classification/rowClassificationService';
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

  // Count current classification status (ONLY for main/section items)
  const mainItemsCount = items.filter(i => {
    const isMain = i.rowRole
      ? (i.rowRole === 'main' || i.rowRole === 'section')
      : (i.kod ? isMainCodeExported(i.kod) : false);
    return isMain;
  }).length;

  const classifiedMainCount = items.filter(i => {
    const isMain = i.rowRole
      ? (i.rowRole === 'main' || i.rowRole === 'section')
      : (i.kod ? isMainCodeExported(i.kod) : false);
    return isMain && i.skupina;
  }).length;

  const unclassifiedMainCount = mainItemsCount - classifiedMainCount;

  const handleClassify = (overwrite: boolean) => {
    if (itemsToProcess.length === 0) return;

    // Confirmation for overwrite mode
    if (overwrite) {
      const confirmed = window.confirm(
        'Opravdu chcete překlasifikovat všechny položky?\n\n' +
        'Tato akce přepíše existující skupiny u všech položek.\n' +
        'Pokračovat?'
      );
      if (!confirmed) return;
    }

    setIsClassifying(true);
    setError(null);
    setLastAction(null);
    setClassificationStats(null);

    try {
      // Sort items by row position for correct parent-child relationships
      const sortedItems = [...items].sort((a, b) =>
        a.source.rowStart - b.source.rowStart
      );

      // Step 1: Filter ONLY main/section items for classification
      // Subordinate rows will get skupina via cascade, not direct classification
      const mainItems: ParsedItem[] = [];
      const itemToSubordinatesMap = new Map<string, ParsedItem[]>();

      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];

        // Determine if this is a main/section item using rowRole or code check
        const isMain = item.rowRole
          ? (item.rowRole === 'main' || item.rowRole === 'section')
          : (item.kod ? isMainCodeExported(item.kod) : false);

        if (isMain) {
          mainItems.push(item);

          // Collect subordinate items following this main item (for context)
          const subordinates: ParsedItem[] = [];
          for (let j = i + 1; j < sortedItems.length; j++) {
            const nextItem = sortedItems[j];

            // Check if next item is also main/section (stop collecting)
            const isNextMain = nextItem.rowRole
              ? (nextItem.rowRole === 'main' || nextItem.rowRole === 'section')
              : (nextItem.kod ? isMainCodeExported(nextItem.kod) : false);

            if (isNextMain) break;

            // This is a subordinate item
            subordinates.push(nextItem);
          }

          itemToSubordinatesMap.set(item.id, subordinates);
        }
      }

      // Step 2: Classify ONLY main items (with subordinate context)
      // Create enriched items with context from subordinates
      const mainItemsWithContext = mainItems.map(mainItem => {
        const subordinates = itemToSubordinatesMap.get(mainItem.id) || [];
        const subordinateContext = subordinates
          .map(sub => sub.popis || '')
          .filter(p => p.trim().length > 0)
          .join(' | ');

        return {
          ...mainItem,
          // Add subordinate descriptions as context (but don't change popis)
          popisFull: subordinateContext
            ? `${mainItem.popisFull || mainItem.popis} [Kontext: ${subordinateContext}]`
            : (mainItem.popisFull || mainItem.popis),
        };
      });

      // Classify only main items
      const result = classifyItemsLocal(mainItemsWithContext, { overwrite });

      if (result.classified > 0) {
        // Build updates with cascade to subordinate rows
        const updates: Array<{ itemId: string; skupina: string }> = [];

        // Create a map of classifications from the result
        const classificationMap = new Map<string, string>();
        for (const r of result.results) {
          if (r.wasClassified && r.suggestedSkupina) {
            classificationMap.set(r.itemId, r.suggestedSkupina);
          }
        }

        // Apply classifications to main items and cascade to subordinates
        for (const mainItem of mainItems) {
          const skupina = classificationMap.get(mainItem.id);
          if (skupina) {
            // Add main item
            updates.push({ itemId: mainItem.id, skupina });

            // Cascade to all subordinates of this main item
            const subordinates = itemToSubordinatesMap.get(mainItem.id) || [];
            for (const sub of subordinates) {
              updates.push({ itemId: sub.id, skupina });
            }
          }
        }

        // Apply all at once (bulkSetSkupina will also cascade, so we're double-safe)
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
          `${mode} ${result.classified} hlavních položek (z ${result.totalItems} celkem) → ` +
          `skupiny přiřazeny do tabulky (${updates.length} řádků celkem s kaskádou k podřízeným řádkům)`
        );
      } else {
        setLastAction(
          overwrite
            ? 'Žádné hlavní položky nebyly klasifikovány (chybí klíčová slova v popisech)'
            : unclassifiedMainCount === 0
              ? 'Všechny hlavní položky již mají přiřazenou skupinu'
              : 'Žádné nové hlavní položky nebyly klasifikovány (chybí klíčová slova v popisech)'
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
              : `${classifiedMainCount}/${mainItemsCount} hlavních položek`
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
            {' '}pouze <strong>hlavním položkám</strong> podle klíčových slov v popisu. Podřízené řádky (PP/PSC/VV/...)
            {' '}se použijí jako kontext a automaticky zdědí skupinu od hlavní položky.
          </p>

          {/* Current status bar */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-secondary">
              Hlavní položky se skupinou: <strong className="text-green-400">{classifiedMainCount}</strong>
            </span>
            {unclassifiedMainCount > 0 && (
              <span className="text-text-secondary">
                Bez skupiny: <strong className="text-yellow-400">{unclassifiedMainCount}</strong>
              </span>
            )}
            <span className="text-text-muted">
              / {mainItemsCount} hlavních celkem ({items.length} všech řádků)
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Primary: classify only empty */}
            <button
              onClick={() => handleClassify(false)}
              disabled={isClassifying || itemsToProcess.length === 0 || unclassifiedMainCount === 0}
              className="btn btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
              title="Klasifikuje pouze hlavní položky bez přiřazené skupiny. Podřízené řádky (PP/PSC/VV) se použijí jako kontext a automaticky zdědí skupinu."
            >
              {isClassifying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              Klasifikovat prázdné ({unclassifiedMainCount})
            </button>

            {/* Secondary: re-classify all */}
            <button
              onClick={() => handleClassify(true)}
              disabled={isClassifying || itemsToProcess.length === 0}
              className="btn text-sm flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50"
              title="Překlasifikuje všechny hlavní položky (vyžaduje potvrzení). Podřízené řádky automaticky zdědí novou skupinu."
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
            Klasifikace probíhá pouze pro <strong>hlavní položky</strong> (řádky s kódy URS/OTSKP/RTS).
            Podřízené řádky (PP/PSC/VV/A195/B5) se použijí jako kontext a automaticky zdědí skupinu.
            {' '}11 skupin: ZEMNI_PRACE, BETON_MONOLIT, BETON_PREFAB, VYZTUŽ, KOTVENI, BEDNENI, PILOTY, IZOLACE, KOMUNIKACE, DOPRAVA, LOŽISKA.
          </p>
        </div>
      )}
    </div>
  );
}
