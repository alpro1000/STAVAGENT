/**
 * TOVSummary Component
 *
 * Summary bar showing totals for all resource categories.
 * Displayed at the bottom of the TOV modal.
 */

import { Users, Truck, Package, Layers, Zap } from 'lucide-react';
import type { TOVData } from '../../types/unified';

interface TOVSummaryProps {
  data: TOVData;
}

export function TOVSummary({ data }: TOVSummaryProps) {
  const laborCost = data.labor.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const machineryCost = data.machinery.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const materialsCost = data.materialsSummary.totalCost;
  const formworkCost = (data.formworkRental ?? []).reduce((sum, r) => sum + r.konecny_najem, 0);
  const pumpCost = data.pumpRental?.konecna_cena ?? 0;
  const totalCost = laborCost + machineryCost + materialsCost + formworkCost + pumpCost;

  const hasData =
    data.labor.length > 0 ||
    data.machinery.length > 0 ||
    data.materials.length > 0 ||
    formworkCost > 0 ||
    pumpCost > 0;

  if (!hasData) {
    return null;
  }

  return (
    <div className="border-t border-border-color px-4 py-3 bg-bg-tertiary/30">
      <div className="flex items-center justify-between">
        {/* Category summaries */}
        <div className="flex items-center gap-6 text-sm">
          {/* Labor */}
          {data.labor.length > 0 && (
            <div className="flex items-center gap-2">
              <Users size={16} className="text-accent-primary" />
              <span className="text-text-secondary">
                {data.laborSummary.totalNormHours.toFixed(1)} h
              </span>
              <span className="text-text-muted">|</span>
              <span className="font-medium tabular-nums">
                {laborCost.toLocaleString('cs-CZ')} Kč
              </span>
            </div>
          )}

          {/* Machinery */}
          {data.machinery.length > 0 && (
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-blue-500" />
              <span className="text-text-secondary">
                {data.machinerySummary.totalMachineHours.toFixed(1)} h
              </span>
              <span className="text-text-muted">|</span>
              <span className="font-medium tabular-nums">
                {machineryCost.toLocaleString('cs-CZ')} Kč
              </span>
            </div>
          )}

          {/* Materials */}
          {data.materials.length > 0 && (
            <div className="flex items-center gap-2">
              <Package size={16} className="text-green-600" />
              <span className="text-text-secondary">
                {data.materials.length} pol.
              </span>
              <span className="text-text-muted">|</span>
              <span className="font-medium tabular-nums">
                {materialsCost.toLocaleString('cs-CZ')} Kč
              </span>
            </div>
          )}

          {/* Formwork rental */}
          {formworkCost > 0 && (
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-blue-500" />
              <span className="text-text-secondary">bednění</span>
              <span className="text-text-muted">|</span>
              <span className="font-medium tabular-nums text-blue-600">
                {formworkCost.toLocaleString('cs-CZ')} Kč
              </span>
            </div>
          )}

          {/* Pump rental */}
          {pumpCost > 0 && (
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-blue-500" />
              <span className="text-text-secondary">pumpa</span>
              <span className="text-text-muted">|</span>
              <span className="font-medium tabular-nums text-blue-600">
                {pumpCost.toLocaleString('cs-CZ')} Kč
              </span>
            </div>
          )}
        </div>

        {/* Grand total */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">Celkem TOV:</span>
          <span className="text-lg font-bold tabular-nums text-accent-primary">
            {totalCost.toLocaleString('cs-CZ')} Kč
          </span>
        </div>
      </div>
    </div>
  );
}
