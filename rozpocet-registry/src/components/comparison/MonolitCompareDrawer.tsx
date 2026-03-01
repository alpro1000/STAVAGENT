/**
 * MonolitCompareDrawer
 *
 * Slide-in drawer showing Registry vs Monolit price comparison.
 * Groups items by severity (conflicts first) and allows accepting
 * Monolit prices into Registry.
 *
 * Design: Tailwind CSS, consistent with rozpocet-registry light theme.
 */

import { useMemo } from 'react';
import { X, RefreshCw, AlertTriangle, CheckCircle2, Info, AlertOctagon } from 'lucide-react';
import type { ComparisonItem } from '../../services/monolithPolling';

interface MonolitCompareDrawerProps {
  open: boolean;
  onClose: () => void;
  comparisons: ComparisonItem[];
  conflictCount: number;
  lastFetch: Date | null;
  onAcceptPrice: (itemId: string, monolithTotal: number, monolithUnit: number) => void;
  onRefresh: () => void;
}

/** Severity display config */
const SEVERITY_CONFIG = {
  conflict: {
    label: 'Konflikt',
    bgRow: 'bg-red-50',
    borderRow: 'border-red-200',
    badgeBg: 'bg-red-100 text-red-800',
    varianceColor: 'text-red-600',
    icon: AlertOctagon,
    iconColor: 'text-red-500',
  },
  warning: {
    label: 'Varování',
    bgRow: 'bg-amber-50',
    borderRow: 'border-amber-200',
    badgeBg: 'bg-amber-100 text-amber-800',
    varianceColor: 'text-orange-600',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  info: {
    label: 'Odchylka',
    bgRow: 'bg-blue-50',
    borderRow: 'border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-800',
    varianceColor: 'text-yellow-600',
    icon: Info,
    iconColor: 'text-blue-500',
  },
  match: {
    label: 'Shoda',
    bgRow: 'bg-green-50',
    borderRow: 'border-green-200',
    badgeBg: 'bg-green-100 text-green-800',
    varianceColor: 'text-green-600',
    icon: CheckCircle2,
    iconColor: 'text-green-500',
  },
} as const;

/** Severity display order: conflicts first */
const SEVERITY_ORDER: ComparisonItem['severity'][] = ['conflict', 'warning', 'info', 'match'];

/** Group label (Czech) */
const GROUP_LABELS: Record<ComparisonItem['severity'], string> = {
  conflict: 'Konflikty (>30%)',
  warning: 'Varování (15-30%)',
  info: 'Odchylky (5-15%)',
  match: 'Shoda (<5%)',
};

/** Format number as Czech CZK */
function formatCZK(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + ' Kc';
}

/** Format variance percentage */
function formatVariance(pct: number | null): string {
  if (pct === null) return '-';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/** Format Date to Czech locale time string */
function formatTime(date: Date | null): string {
  if (!date) return 'nikdy';
  return date.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function MonolitCompareDrawer({
  open,
  onClose,
  comparisons,
  conflictCount,
  lastFetch,
  onAcceptPrice,
  onRefresh,
}: MonolitCompareDrawerProps) {
  // Group comparisons by severity
  const grouped = useMemo(() => {
    const groups = new Map<ComparisonItem['severity'], ComparisonItem[]>();
    for (const sev of SEVERITY_ORDER) {
      groups.set(sev, []);
    }
    for (const c of comparisons) {
      groups.get(c.severity)!.push(c);
    }
    return groups;
  }, [comparisons]);

  // Summary stats
  const stats = useMemo(() => ({
    total: comparisons.length,
    match: grouped.get('match')?.length ?? 0,
    info: grouped.get('info')?.length ?? 0,
    warning: grouped.get('warning')?.length ?? 0,
    conflict: grouped.get('conflict')?.length ?? 0,
  }), [comparisons, grouped]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[420px] max-w-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">
              Srovnani Monolit
            </h2>
            {conflictCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                {conflictCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
            title="Zavrit"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Summary Stats Bar ──────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-px bg-gray-200 border-b border-gray-200 shrink-0">
          <div className="bg-white px-3 py-2 text-center">
            <div className="text-lg font-bold text-gray-900">{stats.total}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Celkem</div>
          </div>
          <div className="bg-white px-3 py-2 text-center">
            <div className="text-lg font-bold text-green-600">{stats.match}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Shoda</div>
          </div>
          <div className="bg-white px-3 py-2 text-center">
            <div className="text-lg font-bold text-amber-600">{stats.warning}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Varovani</div>
          </div>
          <div className="bg-white px-3 py-2 text-center">
            <div className="text-lg font-bold text-red-600">{stats.conflict}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Konflikty</div>
          </div>
        </div>

        {/* ── Scrollable List ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {comparisons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center text-gray-400">
              <Info size={36} className="mb-3 text-gray-300" />
              <p className="text-sm font-medium">Zadna data k porovnani</p>
              <p className="text-xs mt-1">
                Propojte projekt s Portalem a spustte Monolit kalkulaci.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {SEVERITY_ORDER.map((severity) => {
                const items = grouped.get(severity);
                if (!items || items.length === 0) return null;
                const config = SEVERITY_CONFIG[severity];
                const SevIcon = config.icon;

                return (
                  <div key={severity}>
                    {/* Group Header */}
                    <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <SevIcon size={14} className={config.iconColor} />
                      <span className="text-xs font-semibold text-gray-700">
                        {GROUP_LABELS[severity]}
                      </span>
                      <span className="ml-auto text-xs text-gray-400">
                        {items.length}
                      </span>
                    </div>

                    {/* Items */}
                    {items.map((item) => (
                      <ComparisonRow
                        key={item.itemId}
                        item={item}
                        config={config}
                        onAcceptPrice={onAcceptPrice}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Aktualizovano: {formatTime(lastFetch)}
          </span>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={12} />
            Obnovit
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ComparisonRow — single item row inside the drawer
 * ═══════════════════════════════════════════════════════════════════════════ */

interface ComparisonRowProps {
  item: ComparisonItem;
  config: typeof SEVERITY_CONFIG[keyof typeof SEVERITY_CONFIG];
  onAcceptPrice: (itemId: string, monolithTotal: number, monolithUnit: number) => void;
}

function ComparisonRow({ item, config, onAcceptPrice }: ComparisonRowProps) {
  const canAccept = item.monolithTotal !== null && item.monolithUnitCost !== null;

  return (
    <div className={`px-4 py-3 ${config.bgRow} border-l-2 ${config.borderRow}`}>
      {/* Code + Description */}
      <div className="flex items-start gap-2 mb-2">
        <span className="font-mono text-xs text-gray-500 shrink-0 pt-0.5 min-w-[60px]">
          {item.kod || '-'}
        </span>
        <span className="text-sm text-gray-800 leading-tight line-clamp-2">
          {item.popis}
        </span>
      </div>

      {/* Price Comparison */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        {/* Registry */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
            Registry
          </div>
          <div className="text-sm font-semibold text-blue-700">
            {formatCZK(item.registryTotal)}
          </div>
          {item.registryUnitPrice !== null && (
            <div className="text-[10px] text-blue-500">
              JC: {formatCZK(item.registryUnitPrice)}
            </div>
          )}
        </div>

        {/* Monolit */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
            Monolit
          </div>
          <div className="text-sm font-semibold text-amber-700">
            {formatCZK(item.monolithTotal)}
          </div>
          {item.monolithUnitCost !== null && (
            <div className="text-[10px] text-amber-500">
              KROS JC: {formatCZK(item.monolithUnitCost)}
            </div>
          )}
        </div>
      </div>

      {/* Variance + Details + Accept */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Variance badge */}
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${config.varianceColor}`}
          >
            {formatVariance(item.variancePct)}
          </span>

          {/* Monolit details */}
          <span className="text-[10px] text-gray-400">
            {item.monolithDays}d / {item.monolithCrew} prac.
          </span>
        </div>

        {/* Accept button */}
        {canAccept && item.severity !== 'match' && (
          <button
            onClick={() => onAcceptPrice(item.itemId, item.monolithTotal!, item.monolithUnitCost!)}
            className="px-2 py-1 text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded hover:bg-amber-200 transition-colors whitespace-nowrap"
          >
            Prijmout cenu
          </button>
        )}
      </div>
    </div>
  );
}
