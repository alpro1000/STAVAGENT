/**
 * AI Panel Component - AI-powered classification with AI on/off toggle
 * Integrates with AI Agent (api/agent/) for smart classification
 *
 * FEATURES:
 * - AI Mode: cache → rules → memory → Gemini
 * - Rules-only Mode: deterministic keyword matching (no AI costs)
 * - Learns from user corrections (Memory Store)
 * - Confidence indicators (high/medium/low)
 * - Source tracking (rule/memory/gemini/cache)
 *
 * CLASSIFICATION RULES:
 * - Classifies ONLY main/section items (rowRole === 'main' or 'section')
 * - Subordinate rows (PP, PSC, VV, A195, B5) used as CONTEXT only
 * - Skupina cascades to subordinates automatically
 *
 * LIGHT THEME - легкий читаемый стиль
 */

import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Zap, Power, Brain, Eraser } from 'lucide-react';
import { useRegistryStore } from '../../stores/registryStore';
import { isMainCodeExported } from '../../services/classification/rowClassificationService';
import type { ParsedItem } from '../../types/item';

interface AIPanelProps {
  items: ParsedItem[];
  projectId: string;
  sheetId: string;
  selectedItemIds?: string[];
}

interface ClassificationResult {
  itemId: string;
  skupina: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  reasoning: string;
  source: 'rule' | 'memory' | 'gemini' | 'cache';
  modelUsed?: string;
  action?: 'updated' | 'kept';
}

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
  accentDark: '#E68A00',
  success: '#10B981',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  warningBg: '#FFFBEB',
};

export function AIPanel({ items, projectId, sheetId, selectedItemIds = [] }: AIPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true); // AI toggle state
  const [classificationStats, setClassificationStats] = useState<{
    classified: number;
    changed: number;
    unchanged: number;
    unknown: number;
    keptExisting?: number;
    stats: {
      total: number;
      bySource: Record<string, number>;
      byConfidence: Record<string, number>;
      unknown: number;
    };
  } | null>(null);

  const { bulkSetSkupina, clearSheetSkupiny, skupinyMemory, getSkupinyMemoryCount } = useRegistryStore();

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

  /**
   * Classify empty items (Klasifikovat prázdné)
   */
  const handleClassifyEmpty = async () => {
    if (itemsToProcess.length === 0) return;

    setIsClassifying(true);
    setError(null);
    setLastAction(null);
    setClassificationStats(null);

    try {
      console.log('[AIPanel] Classifying empty items...', { aiEnabled });

      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'classify-empty',
          projectId,
          sheetId,
          items: itemsToProcess,
          aiEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`Classification failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Apply classifications
        const updates = data.results.map((r: ClassificationResult) => ({
          itemId: r.itemId,
          skupina: r.skupina,
        }));

        if (updates.length > 0) {
          bulkSetSkupina(projectId, sheetId, updates);
        }

        setClassificationStats({
          classified: data.changed,
          changed: data.changed,
          unchanged: data.unchanged,
          unknown: data.unknown,
          stats: data.stats,
        });

        const modeText = aiEnabled ? 'AI + Rules' : 'Rules only';
        setLastAction(
          `Klasifikováno ${data.changed} prázdných položek (${modeText})`
        );
      } else {
        throw new Error(data.message || 'Classification failed');
      }
    } catch (err) {
      console.error('[AIPanel] Classification error:', err);
      setError(err instanceof Error ? err.message : 'Chyba při klasifikaci');
    } finally {
      setIsClassifying(false);
    }
  };

  /**
   * Re-classify all items (Překlasifikovat vše)
   */
  const handleClassifyAll = async () => {
    if (itemsToProcess.length === 0) return;

    // Confirmation
    const confirmed = window.confirm(
      'Opravdu chcete překlasifikovat všechny položky?\n\n' +
      'Tato akce přepíše existující skupiny u položek s vysokou jistotou.\n' +
      'Položky s nízkou jistotou zůstanou beze změny.\n' +
      'Pokračovat?'
    );
    if (!confirmed) return;

    setIsClassifying(true);
    setError(null);
    setLastAction(null);
    setClassificationStats(null);

    try {
      console.log('[AIPanel] Re-classifying all items...', { aiEnabled });

      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'classify-all',
          projectId,
          sheetId,
          items: itemsToProcess,
          forceUpdate: false,
          aiEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`Classification failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Apply classifications (filter out 'kept' actions)
        const updates = data.results
          .filter((r: ClassificationResult) => r.action !== 'kept')
          .map((r: ClassificationResult) => ({
            itemId: r.itemId,
            skupina: r.skupina,
          }));

        if (updates.length > 0) {
          bulkSetSkupina(projectId, sheetId, updates);
        }

        setClassificationStats({
          classified: data.changed,
          changed: data.changed,
          unchanged: data.unchanged,
          unknown: data.unknown,
          keptExisting: data.keptExisting,
          stats: data.stats,
        });

        const modeText = aiEnabled ? 'AI + Rules' : 'Rules only';
        setLastAction(
          `Překlasifikováno ${data.changed} položek, ` +
          `${data.keptExisting} ponecháno (${modeText})`
        );
      } else {
        throw new Error(data.message || 'Classification failed');
      }
    } catch (err) {
      console.error('[AIPanel] Classification error:', err);
      setError(err instanceof Error ? err.message : 'Chyba při klasifikaci');
    } finally {
      setIsClassifying(false);
    }
  };

  /**
   * Apply skupiny from browser localStorage memory to unclassified items
   * Works fully offline — no API call needed
   */
  const handleApplyFromMemory = () => {
    const updates: Array<{ itemId: string; skupina: string }> = [];

    for (const item of itemsToProcess) {
      const isMain = item.rowRole
        ? (item.rowRole === 'main' || item.rowRole === 'section')
        : (item.kod ? isMainCodeExported(item.kod) : false);

      if (isMain && !item.skupina && item.kod) {
        const memSkupina = skupinyMemory[item.kod.trim()];
        if (memSkupina) {
          updates.push({ itemId: item.id, skupina: memSkupina });
        }
      }
    }

    if (updates.length > 0) {
      bulkSetSkupina(projectId, sheetId, updates);
      setClassificationStats(null);
      setLastAction(`Aplikováno ${updates.length} skupin z paměti (z ${getSkupinyMemoryCount()} uložených)`);
    } else {
      setLastAction('Paměť neobsahuje shody pro prázdné položky');
    }
  };

  /**
   * Clear all skupiny in the current sheet (without deleting items)
   */
  const handleClearSkupiny = () => {
    const classifiedCount = items.filter(i => i.skupina).length;
    if (classifiedCount === 0) {
      setLastAction('Žádné skupiny k vymazání');
      return;
    }
    if (!window.confirm(`Opravdu chcete vymazat skupiny u ${classifiedCount} položek v tomto listu?\nPoložky zůstanou zachovány.`)) return;
    clearSheetSkupiny(projectId, sheetId);
    setClassificationStats(null);
    setLastAction(`Skupiny vymazány u ${classifiedCount} položek`);
  };

  const memoryCount = getSkupinyMemoryCount();

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--accent-orange)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="text-accent-primary" size={20} />
          <h3 className="font-semibold text-text-primary">AI Klasifikace</h3>
          <span
            className="text-xs px-2 py-0.5 rounded font-semibold"
            style={{ backgroundColor: LIGHT.headerBg, color: LIGHT.text }}
          >
            {selectedItemIds.length > 0
              ? `${selectedItemIds.length} vybráno`
              : `${classifiedMainCount}/${mainItemsCount} hlavních položek`
            }
          </span>
          {aiEnabled ? (
            <span
              className="text-xs px-2 py-0.5 rounded font-bold flex items-center gap-1"
              style={{ backgroundColor: LIGHT.accent, color: '#ffffff' }}
            >
              <Zap size={12} /> AI ON
            </span>
          ) : (
            <span
              className="text-xs px-2 py-0.5 rounded font-semibold"
              style={{ backgroundColor: LIGHT.headerBg, color: LIGHT.textMuted }}
            >
              Rules only
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* AI Toggle */}
          <div
            className="flex items-center gap-3 p-3 rounded-lg border"
            style={{ backgroundColor: LIGHT.panelBgAlt, borderColor: LIGHT.border }}
          >
            <Power size={16} style={{ color: aiEnabled ? LIGHT.accent : LIGHT.textMuted }} />
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: LIGHT.text }}>
                AI Mode {aiEnabled ? 'Zapnuto' : 'Vypnuto'}
              </div>
              <div className="text-xs mt-0.5" style={{ color: LIGHT.textMuted }}>
                {aiEnabled
                  ? 'Používá Gemini AI + Memory + Rules (vyšší přesnost, vyžaduje API key)'
                  : 'Pouze Rules (bez AI, bez nákladů, deterministický)'}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAiEnabled(!aiEnabled);
              }}
              className="px-3 py-1.5 rounded text-sm font-bold transition-colors"
              style={{
                backgroundColor: aiEnabled ? LIGHT.accent : LIGHT.headerBg,
                color: aiEnabled ? '#ffffff' : LIGHT.textMuted,
              }}
            >
              {aiEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Info */}
          <div className="text-sm space-y-1" style={{ color: LIGHT.textMuted }}>
            <p className="font-medium" style={{ color: LIGHT.text }}>Jak to funguje:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li><strong>Klasifikuje POUZE</strong> hlavní položky (s kódy URS/OTSKP)</li>
              <li>Podřízené řádky (PP/PSC/VV) = <strong>kontext</strong> pro AI</li>
              <li>Skupina se <strong>kaskáduje</strong> na podřízené řádky automaticky</li>
              {aiEnabled && (
                <>
                  <li><strong>AI strategie:</strong> Cache → Rules → Memory → Gemini</li>
                  <li><strong>Učení:</strong> Pamatuje si vaše ruční úpravy</li>
                </>
              )}
              {!aiEnabled && (
                <li><strong>Rules:</strong> Deterministická klasifikace podle klíčových slov</li>
              )}
            </ul>
          </div>

          {/* Memory info */}
          {memoryCount > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ backgroundColor: '#EEF2FF', borderColor: '#818CF8', border: '1px solid' }}
            >
              <Brain size={14} style={{ color: '#6366F1' }} />
              <span style={{ color: '#4338CA' }}>
                Paměť: <strong>{memoryCount}</strong> naučených skupin (kód → skupina)
              </span>
            </div>
          )}

          {/* Buttons row 1 — AI classification */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleClassifyEmpty}
              disabled={isClassifying || unclassifiedMainCount === 0}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClassifying ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Klasifikuji...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Klasifikovat prázdné</span>
                </>
              )}
            </button>

            <button
              onClick={handleClassifyAll}
              disabled={isClassifying || mainItemsCount === 0}
              className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClassifying ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Klasifikuji...</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Překlasifikovat vše</span>
                </>
              )}
            </button>
          </div>

          {/* Buttons row 2 — Memory + Clear */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleApplyFromMemory}
              disabled={isClassifying || unclassifiedMainCount === 0 || memoryCount === 0}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: memoryCount > 0 ? '#EEF2FF' : LIGHT.headerBg,
                color: memoryCount > 0 ? '#4338CA' : LIGHT.textMuted,
                border: `1px solid ${memoryCount > 0 ? '#818CF8' : LIGHT.border}`,
              }}
              title="Aplikovat skupiny z paměti prohlížeče na prázdné položky (offline, bez AI)"
            >
              <Brain size={16} />
              <span>Z paměti ({memoryCount})</span>
            </button>

            <button
              onClick={handleClearSkupiny}
              disabled={isClassifying || items.filter(i => i.skupina).length === 0}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: LIGHT.warningBg,
                color: '#92400E',
                border: `1px solid #F59E0B`,
              }}
              title="Vymazat skupiny ze všech položek v tomto listu (položky zůstanou)"
            >
              <Eraser size={16} />
              <span>Vymazat skupiny</span>
            </button>
          </div>

          {/* Stats */}
          {classificationStats && (
            <div
              className="p-3 rounded-lg border text-sm"
              style={{ backgroundColor: '#ECFDF5', borderColor: LIGHT.success }}
            >
              <div className="font-bold mb-2 flex items-center gap-2" style={{ color: LIGHT.success }}>
                ✓ Klasifikace dokončena
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: LIGHT.text }}>
                <div>Změněno: <strong>{classificationStats.changed}</strong></div>
                <div>Nezměněno: <strong>{classificationStats.unchanged}</strong></div>
                {classificationStats.keptExisting !== undefined && (
                  <div>Ponecháno: <strong>{classificationStats.keptExisting}</strong></div>
                )}
                <div>Unknown: <strong>{classificationStats.unknown}</strong></div>
              </div>

              {/* Source breakdown */}
              {classificationStats.stats && (
                <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${LIGHT.border}` }}>
                  <div className="text-xs" style={{ color: LIGHT.textMuted }}>
                    Zdroje:{' '}
                    {Object.entries(classificationStats.stats.bySource).map(([source, count]) => (
                      <span key={source} className="mr-2">
                        {source}: <strong style={{ color: LIGHT.text }}>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Last Action */}
          {lastAction && !classificationStats && (
            <div className="text-sm italic p-2 rounded" style={{ backgroundColor: LIGHT.panelBgAlt, color: LIGHT.textMuted }}>
              {lastAction}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="p-3 rounded-lg border text-sm"
              style={{ backgroundColor: LIGHT.errorBg, borderColor: LIGHT.error }}
            >
              <strong style={{ color: LIGHT.error }}>Chyba:</strong>{' '}
              <span style={{ color: LIGHT.text }}>{error}</span>
            </div>
          )}

          {/* Warning if AI disabled */}
          {!aiEnabled && (
            <div
              className="p-2 rounded-lg border text-xs"
              style={{ backgroundColor: LIGHT.warningBg, borderColor: '#F59E0B', color: '#92400E' }}
            >
              ⚠️ AI režim vypnut. Používá se pouze deterministická klasifikace podle klíčových slov.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
