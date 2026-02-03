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
 */

import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Zap, Power } from 'lucide-react';
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
            className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide"
            style={{ backgroundColor: '#3e4348', color: '#f5f6f7' }}
          >
            {selectedItemIds.length > 0
              ? `${selectedItemIds.length} vybráno`
              : `${classifiedMainCount}/${mainItemsCount} hlavních položek`
            }
          </span>
          {aiEnabled ? (
            <span
              className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide flex items-center gap-1"
              style={{ backgroundColor: '#FF9F1C', color: '#1a1d21' }}
            >
              <Zap size={12} /> AI ON
            </span>
          ) : (
            <span
              className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide"
              style={{ backgroundColor: '#2d3139', color: '#8a9199' }}
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
            className="flex items-center gap-3 p-3 rounded border-2"
            style={{ backgroundColor: '#2d3139', borderColor: '#3e4348' }}
          >
            <Power size={16} style={{ color: aiEnabled ? '#FF9F1C' : '#8a9199' }} />
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary">
                AI Mode {aiEnabled ? 'Zapnuto' : 'Vypnuto'}
              </div>
              <div className="text-xs text-text-muted mt-0.5">
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
              className="px-3 py-1.5 rounded text-sm font-black uppercase tracking-wide transition-colors"
              style={{
                backgroundColor: aiEnabled ? '#FF9F1C' : '#3e4348',
                color: aiEnabled ? '#1a1d21' : '#8a9199',
              }}
            >
              {aiEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Info */}
          <div className="text-sm text-text-muted space-y-1">
            <p className="font-medium text-text-primary">Jak to funguje:</p>
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

          {/* Buttons */}
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

          {/* Stats */}
          {classificationStats && (
            <div
              className="p-3 rounded border-2 text-sm"
              style={{ backgroundColor: '#2d3139', borderColor: '#FF9F1C' }}
            >
              <div className="font-black mb-2 uppercase tracking-wide" style={{ color: '#FF9F1C' }}>
                ✓ Klasifikace dokončena
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: '#f5f6f7' }}>
                <div>Změněno: <strong>{classificationStats.changed}</strong></div>
                <div>Nezměněno: <strong>{classificationStats.unchanged}</strong></div>
                {classificationStats.keptExisting !== undefined && (
                  <div>Ponecháno: <strong>{classificationStats.keptExisting}</strong></div>
                )}
                <div>Unknown: <strong>{classificationStats.unknown}</strong></div>
              </div>

              {/* Source breakdown */}
              {classificationStats.stats && (
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid #3e4348' }}>
                  <div className="text-xs" style={{ color: '#8a9199' }}>
                    Zdroje:{' '}
                    {Object.entries(classificationStats.stats.bySource).map(([source, count]) => (
                      <span key={source} className="mr-2">
                        {source}: <strong style={{ color: '#f5f6f7' }}>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Last Action */}
          {lastAction && !classificationStats && (
            <div className="text-sm text-text-muted italic bg-bg-secondary p-2 rounded">
              {lastAction}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="p-3 rounded border-2 text-sm"
              style={{ backgroundColor: '#2d3139', borderColor: '#ef4444', color: '#fca5a5' }}
            >
              <strong style={{ color: '#ef4444' }}>Chyba:</strong> {error}
            </div>
          )}

          {/* Warning if AI disabled */}
          {!aiEnabled && (
            <div
              className="p-2 rounded border-2 text-xs"
              style={{ backgroundColor: '#2d3139', borderColor: '#3e4348', color: '#8a9199' }}
            >
              ⚠️ AI režim vypnut. Používá se pouze deterministická klasifikace podle klíčových slov.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
