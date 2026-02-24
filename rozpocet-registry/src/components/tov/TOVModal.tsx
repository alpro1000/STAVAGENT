/**
 * TOVModal Component
 *
 * Modal dialog for viewing and editing resource breakdown (TOV - Rozpis zdrojů).
 * Contains three tabs: Pracovní síly, Mechanizace, Materiály.
 *
 * Features:
 * - Calculate total cost from labor + machinery + materials
 * - Apply calculated cost to position (cenaJednotkova)
 * - Manual price override still possible
 *
 * @see docs/UNIFICATION_PLAN.md - Phase 3
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Users, Truck, Package, Calculator, ExternalLink, Check, ArrowRight } from 'lucide-react';
import type { ParsedItem } from '../../types';
import type { TOVData, LaborResource, MachineryResource, MaterialResource, FormworkRentalRow, PumpRentalData } from '../../types/unified';
import { LaborTab } from './LaborTab';
import { MachineryTab } from './MachineryTab';
import { MaterialsTab } from './MaterialsTab';
import { TOVSummary } from './TOVSummary';

interface TOVModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ParsedItem;
  tovData: TOVData | undefined;
  onSave: (data: TOVData) => void;
  onApplyPrice?: (itemId: string, unitPrice: number, totalPrice: number) => void;
}

type TabType = 'labor' | 'machinery' | 'materials';

const emptyTOV: TOVData = {
  labor: [],
  laborSummary: { totalNormHours: 0, totalWorkers: 0 },
  machinery: [],
  machinerySummary: { totalMachineHours: 0, totalUnits: 0 },
  materials: [],
  materialsSummary: { totalCost: 0, itemCount: 0 },
  formworkRental: [],
};

export function TOVModal({ isOpen, onClose, item, tovData, onSave, onApplyPrice }: TOVModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('labor');
  const [localData, setLocalData] = useState<TOVData>(tovData || emptyTOV);
  const [priceApplied, setPriceApplied] = useState(false);
  // Tracks when we triggered a store update ourselves so the resulting
  // tovData prop change doesn't reset localData back from the store.
  const isAutoSaving = useRef(false);

  // Sync local state when external props change (new item opened, or
  // external update to this item's data). Skips the cycle caused by
  // our own auto-save in handleFormworkRentalChange.
  useEffect(() => {
    if (isAutoSaving.current) {
      isAutoSaving.current = false;
      return;
    }
    setLocalData(tovData || emptyTOV);
    setPriceApplied(false);
  }, [tovData, item.id]);

  // Calculate total cost from all resources (labor + machinery + materials + formwork + pump)
  const calculatedTotals = useMemo(() => {
    const laborCost = localData.labor.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const machineryCost = localData.machinery.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const materialsCost = localData.materials.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const formworkCost = (localData.formworkRental ?? []).reduce((sum, r) => sum + r.konecny_najem, 0);
    const pumpCost = localData.pumpRental?.konecna_cena ?? 0;
    const totalCost = laborCost + machineryCost + materialsCost + formworkCost + pumpCost;
    const quantity = item.mnozstvi || 1;
    const unitPrice = quantity > 0 ? totalCost / quantity : totalCost;

    return {
      laborCost,
      machineryCost,
      materialsCost,
      formworkCost,
      pumpCost,
      totalCost,
      unitPrice,
      quantity,
    };
  }, [localData, item.mnozstvi]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Update handlers
  const handleLaborChange = (labor: LaborResource[]) => {
    const totalNormHours = labor.reduce((sum, r) => sum + r.normHours, 0);
    const totalWorkers = labor.reduce((sum, r) => sum + r.count, 0);
    setLocalData(prev => ({
      ...prev,
      labor,
      laborSummary: { totalNormHours, totalWorkers },
    }));
  };

  const handleMachineryChange = (machinery: MachineryResource[]) => {
    const totalMachineHours = machinery.reduce((sum, r) => sum + r.machineHours, 0);
    const totalUnits = machinery.reduce((sum, r) => sum + r.count, 0);
    setLocalData(prev => ({
      ...prev,
      machinery,
      machinerySummary: { totalMachineHours, totalUnits },
    }));
  };

  const handleMaterialsChange = (materials: MaterialResource[]) => {
    const totalCost = materials.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const itemCount = materials.length;
    setLocalData(prev => ({
      ...prev,
      materials,
      materialsSummary: { totalCost, itemCount },
    }));
  };

  // Auto-persist formwork rental rows on every change so they survive
  // closing the modal via X / ESC / "Zavřít" without clicking "Uložit TOV".
  // Uses functional update to always merge with the latest state (no stale closure).
  const handleFormworkRentalChange = (formworkRental: FormworkRentalRow[]) => {
    setLocalData(prev => {
      const updatedData = { ...prev, formworkRental };
      isAutoSaving.current = true;
      onSave(updatedData);
      return updatedData;
    });
  };

  // Auto-persist pump rental data on every change (same pattern as formwork).
  const handlePumpRentalChange = (pumpRental: PumpRentalData) => {
    setLocalData(prev => {
      const updatedData = { ...prev, pumpRental };
      isAutoSaving.current = true;
      onSave(updatedData);
      return updatedData;
    });
  };

  const handleSave = () => {
    onSave(localData);
    onClose();
  };

  const tabs: { key: TabType; label: string; icon: typeof Users; count: number }[] = [
    { key: 'labor', label: 'Lidé', icon: Users, count: localData.labor.length },
    { key: 'machinery', label: 'Mechanizmy', icon: Truck, count: localData.machinery.length },
    { key: 'materials', label: 'Materiály', icon: Package, count: localData.materials.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-secondary border border-border-accent rounded-lg shadow-neuro-up w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-color shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Calculator size={20} className="text-accent-primary shrink-0" />
              Rozpis zdrojů (TOV)
            </h2>
            <p className="text-sm text-text-secondary mt-1 truncate">
              <span className="font-mono font-medium">{item.kod}</span>
              {' - '}
              {item.popis}
              {item.mnozstvi && (
                <span className="ml-2 text-text-muted">
                  ({item.mnozstvi} {item.mj})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bg-tertiary rounded transition-colors shrink-0 ml-4"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-color shrink-0">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'text-accent-primary border-b-2 border-accent-primary -mb-px'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <Icon size={16} />
              {label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                  activeTab === key
                    ? 'bg-accent-primary text-white'
                    : 'bg-bg-tertiary text-text-muted'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}

          {/* Link to Monolit Calculator */}
          <div className="ml-auto flex items-center pr-4">
            <a
              href="https://monolit-planner-frontend.onrender.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
              title="Otevřít kalkulátor Monolit"
            >
              <ExternalLink size={14} />
              Monolit Planner
            </a>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {activeTab === 'labor' && (
            <LaborTab
              resources={localData.labor}
              onChange={handleLaborChange}
              itemQuantity={item.mnozstvi}
            />
          )}
          {activeTab === 'machinery' && (
            <MachineryTab
              resources={localData.machinery}
              onChange={handleMachineryChange}
              itemQuantity={item.mnozstvi}
              itemSkupina={item.skupina}
              pumpRental={localData.pumpRental}
              onPumpRentalChange={handlePumpRentalChange}
            />
          )}
          {activeTab === 'materials' && (
            <MaterialsTab
              resources={localData.materials}
              onChange={handleMaterialsChange}
              itemQuantity={item.mnozstvi}
              itemSkupina={item.skupina}
              itemPopis={item.popis}
              formworkRental={localData.formworkRental ?? []}
              onFormworkRentalChange={handleFormworkRentalChange}
            />
          )}
        </div>

        {/* Summary */}
        <TOVSummary data={localData} />

        {/* Footer with calculated cost */}
        <div className="border-t border-border-color shrink-0">
          {/* Calculated cost summary */}
          {calculatedTotals.totalCost > 0 && (
            <div className="px-4 py-3 bg-bg-tertiary/50 border-b border-border-color/50">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-text-secondary">Celkový náklad TOV: </span>
                  <span className="font-bold text-accent-primary">
                    {calculatedTotals.totalCost.toLocaleString('cs-CZ')} Kč
                  </span>
                  {calculatedTotals.quantity > 1 && (
                    <span className="ml-3 text-text-muted">
                      ({calculatedTotals.unitPrice.toFixed(2)} Kč/{item.mj || 'MJ'})
                    </span>
                  )}
                </div>

                {/* Apply price button */}
                {onApplyPrice && (
                  <button
                    onClick={() => {
                      onApplyPrice(item.id, calculatedTotals.unitPrice, calculatedTotals.totalCost);
                      setPriceApplied(true);
                    }}
                    disabled={priceApplied}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                      priceApplied
                        ? 'bg-green-500/20 text-green-600 cursor-default'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {priceApplied ? (
                      <>
                        <Check size={16} />
                        Cena aplikována
                      </>
                    ) : (
                      <>
                        <ArrowRight size={16} />
                        Aplikovat na pozici
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Price breakdown */}
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-text-muted">
                {calculatedTotals.laborCost > 0 && (
                  <span>Práce: {calculatedTotals.laborCost.toLocaleString('cs-CZ')} Kč</span>
                )}
                {calculatedTotals.machineryCost > 0 && (
                  <span>Mechanizace: {calculatedTotals.machineryCost.toLocaleString('cs-CZ')} Kč</span>
                )}
                {calculatedTotals.materialsCost > 0 && (
                  <span>Materiály: {calculatedTotals.materialsCost.toLocaleString('cs-CZ')} Kč</span>
                )}
                {calculatedTotals.formworkCost > 0 && (
                  <span className="text-blue-600">
                    Nájem bednění: {calculatedTotals.formworkCost.toLocaleString('cs-CZ')} Kč
                  </span>
                )}
                {calculatedTotals.pumpCost > 0 && (
                  <span className="text-blue-600">
                    Betonočerpadlo: {calculatedTotals.pumpCost.toLocaleString('cs-CZ')} Kč
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 p-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary rounded transition-colors"
            >
              Zavřít
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium bg-accent-primary text-white hover:bg-accent-primary/90 rounded transition-colors"
            >
              Uložit TOV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
