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
import { X, Users, Truck, Package, Calculator, ExternalLink, Check, ArrowRight, Zap , RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import type { ParsedItem } from '../../types';
import type { TOVData, LaborResource, MachineryResource, MaterialResource, FormworkRentalRow, PumpRentalData, CraneCalcData, DeliveryCalcData } from '../../types/unified';
import { LaborTab } from './LaborTab';
import { MachineryTab } from './MachineryTab';
import { MaterialsTab } from './MaterialsTab';
import { TOVSummary } from './TOVSummary';
import { MONOLIT_FRONTEND_URL } from '../../utils/config.js';
import { hasExtendedCosts, prefillTOVFromMonolit, mergeCalcRefresh } from '../../services/tovPrefill';

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
  // Expand the dialog to (almost) the full viewport. Handy on wide BOQ rows
  // where the three tabs + summary don't fit the default 4xl width.
  const [isMaximized, setIsMaximized] = useState(false);
  // C: unsaved-changes tracking. Lidé/Mechanizmy/Materiály are only persisted
  // on "Uložit TOV" (formwork/pump/crane/delivery auto-save on change), so a
  // close with pending edits must prompt. D: visible "saved" indicator.
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
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
    setDirty(false);
    setJustSaved(false);
    setShowCloseConfirm(false);
  }, [tovData, item.id]);

  // Calculate total cost from all resources (labor + machinery + materials + formwork + pump)
  const calculatedTotals = useMemo(() => {
    const laborCost = localData.labor.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const machineryCost = localData.machinery.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const materialsCost = localData.materials.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const formworkCost = (localData.formworkRental ?? []).reduce((sum, r) => sum + r.konecny_najem, 0);
    const pumpCost = localData.pumpRental?.konecna_cena ?? 0;
    const craneCost = localData.craneRental?.total_czk ?? 0;
    const deliveryCost = localData.deliveryCalc?.total_czk ?? 0;
    const totalCost = laborCost + machineryCost + materialsCost + formworkCost + pumpCost + craneCost + deliveryCost;
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

  // ESC key handler — guards unsaved changes (dirtyRef avoids a stale closure).
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dirtyRef.current) setShowCloseConfirm(true);
      else onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Marks Lidé/Mechanizmy/Materiály edits as unsaved (they persist only on
  // "Uložit TOV"). Auto-saved sections (formwork/pump/crane/delivery) don't.
  const markDirty = () => { setDirty(true); setJustSaved(false); };

  // Update handlers
  const handleLaborChange = (labor: LaborResource[]) => {
    markDirty();
    const totalNormHours = labor.reduce((sum, r) => sum + r.normHours, 0);
    const totalWorkers = labor.reduce((sum, r) => sum + r.count, 0);
    setLocalData(prev => ({
      ...prev,
      labor,
      laborSummary: { totalNormHours, totalWorkers },
    }));
  };

  const handleMachineryChange = (machinery: MachineryResource[]) => {
    markDirty();
    const totalMachineHours = machinery.reduce((sum, r) => sum + r.machineHours, 0);
    const totalUnits = machinery.reduce((sum, r) => sum + r.count, 0);
    setLocalData(prev => ({
      ...prev,
      machinery,
      machinerySummary: { totalMachineHours, totalUnits },
    }));
  };

  const handleMaterialsChange = (materials: MaterialResource[]) => {
    markDirty();
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

  // Auto-persist crane rental data on every change.
  const handleCraneRentalChange = (craneRental: CraneCalcData) => {
    setLocalData(prev => {
      const updatedData = { ...prev, craneRental };
      isAutoSaving.current = true;
      onSave(updatedData);
      return updatedData;
    });
  };

  // Auto-persist delivery calc data on every change.
  const handleDeliveryCalcChange = (deliveryCalc: DeliveryCalcData) => {
    setLocalData(prev => {
      const updatedData = { ...prev, deliveryCalc };
      isAutoSaving.current = true;
      onSave(updatedData);
      return updatedData;
    });
  };

  // D: save keeps the modal OPEN and shows a "✓ Uloženo" indicator, so the save
  // is visibly confirmed (the previous save+close gave no feedback). The user
  // closes via Zavřít / X (now a clean, non-dirty close).
  const handleSave = () => {
    onSave(localData);
    setDirty(false);
    setJustSaved(true);
  };

  // C: closing with unsaved Lidé/Mechanizmy/Materiály edits prompts first.
  const requestClose = () => {
    if (dirtyRef.current) setShowCloseConfirm(true);
    else onClose();
  };
  const saveAndClose = () => { onSave(localData); onClose(); };

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
        onClick={requestClose}
      />

      {/* Modal */}
      <div
        className={`relative bg-bg-secondary border border-border-accent rounded-lg shadow-neuro-up flex flex-col ${
          isMaximized
            ? 'w-[98vw] h-[96vh] max-w-none max-h-none'
            : 'w-full max-w-4xl max-h-[85vh]'
        }`}
      >
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
          <div className="flex items-center gap-1 shrink-0 ml-4">
            <button
              onClick={() => setIsMaximized(m => !m)}
              className="p-1 hover:bg-bg-tertiary rounded transition-colors"
              title={isMaximized ? 'Zmenšit okno' : 'Rozšířit na celou obrazovku'}
              aria-label={isMaximized ? 'Zmenšit okno' : 'Rozšířit na celou obrazovku'}
            >
              {isMaximized
                ? <Minimize2 size={18} className="w-[18px] h-[18px] text-text-secondary" />
                : <Maximize2 size={18} className="w-[18px] h-[18px] text-text-secondary" />}
            </button>
            <button
              onClick={requestClose}
              className="p-1 hover:bg-bg-tertiary rounded transition-colors"
              aria-label="Zavřít"
            >
              <X size={20} className="w-[20px] h-[20px] text-text-secondary" />
            </button>
          </div>
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

          {/* Link to Monolit Calculator — deep-link to specific part when metadata available */}
          <div className="ml-auto flex items-center pr-4">
            {localData.monolitMetadata?.project_id ? (
              <a
                href={`${localData.monolitMetadata.monolit_url || MONOLIT_FRONTEND_URL}?project=${encodeURIComponent(localData.monolitMetadata.project_id)}&part=${encodeURIComponent(localData.monolitMetadata.part_name || '')}${item.position_instance_id ? `&position_instance_id=${encodeURIComponent(item.position_instance_id)}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors border border-blue-300/50"
                title={`Otevřít v Kalkulátoru → ${localData.monolitMetadata.part_name || 'projekt'}`}
              >
                <ExternalLink size={14} />
                Otevřít v Kalkulátoru
                {localData.monolitMetadata.part_name && (
                  <span className="text-blue-400 ml-1">({localData.monolitMetadata.part_name})</span>
                )}
              </a>
            ) : (
              <a
                href={MONOLIT_FRONTEND_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                title="Otevřít Kalkulátor betonáže"
              >
                <ExternalLink size={14} />
                Kalkulátor betonáže
              </a>
            )}
          </div>
        </div>

        {/* Pre-fill banner from Kalkulátor betonáže */}
        {hasExtendedCosts(item.monolith_payload) && localData.labor.length === 0 && (
          <div className="mx-4 mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Zap size={16} className="text-orange-500" />
              <span className="text-orange-800">
                <strong>Kalkulátor betonáže</strong> — data z výpočtu jsou k dispozici.
                Předvyplnit práce, bednění a materiály?
              </span>
            </div>
            <button
              onClick={() => {
                const prefilled = prefillTOVFromMonolit(item.monolith_payload!);
                if (prefilled) {
                  setLocalData(prefilled);
                  markDirty();
                }
              }}
              className="px-3 py-1.5 text-sm font-medium bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors whitespace-nowrap"
            >
              Předvyplnit TOV
            </button>
          </div>
        )}

        {/* Refresh banner — TOV already filled, a calculator result is available.
            Replaces ONLY calculator-origin rows (linkedCalcId / prefill ids);
            manual labor, machinery and materials stay untouched. */}
        {hasExtendedCosts(item.monolith_payload) && localData.labor.length > 0 && (
          <div className="mx-4 mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-blue-800">
              <RefreshCw size={13} className="w-[13px] h-[13px] text-blue-500" />
              <span>
                <strong>Kalkulátor betonáže</strong> — k dispozici výpočet
                {item.monolith_payload?.calculated_at
                  ? ` z ${new Date(item.monolith_payload.calculated_at).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                  : ''}
                . Aktualizace nahradí jen řádky z kalkulátoru, ruční zůstanou.
              </span>
            </div>
            <button
              onClick={() => {
                const fresh = prefillTOVFromMonolit(item.monolith_payload!);
                if (fresh) {
                  setLocalData(prev => mergeCalcRefresh(prev, fresh));
                  markDirty();
                }
              }}
              className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors whitespace-nowrap border border-blue-300"
            >
              Aktualizovat z Kalkulátoru
            </button>
          </div>
        )}

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
              itemLabel={item.kod ? `${item.kod} - ${item.popis}` : item.popis}
              pumpRental={localData.pumpRental}
              onPumpRentalChange={handlePumpRentalChange}
              craneRental={localData.craneRental}
              onCraneRentalChange={handleCraneRentalChange}
              deliveryCalc={localData.deliveryCalc}
              onDeliveryCalcChange={handleDeliveryCalcChange}
              defaultVolume={item.mnozstvi || undefined}
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
                    {calculatedTotals.totalCost.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč
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

              {/* Applied confirmation — inline, inside the modal, so the user
                  sees it immediately (the old page-level AlertModal rendered
                  BEHIND this dialog and forced a close to notice it). */}
              {priceApplied && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                  <Check size={16} className="w-[16px] h-[16px] text-green-600 shrink-0" />
                  <span>
                    Jednotková cena{' '}
                    <strong>{calculatedTotals.unitPrice.toFixed(2)} Kč/{item.mj || 'MJ'}</strong>
                    {' '}byla aplikována na pozici.
                  </span>
                </div>
              )}

              {/* Price breakdown */}
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-text-muted">
                {calculatedTotals.laborCost > 0 && (
                  <span>Práce: {calculatedTotals.laborCost.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč</span>
                )}
                {calculatedTotals.machineryCost > 0 && (
                  <span>Mechanizace: {calculatedTotals.machineryCost.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč</span>
                )}
                {calculatedTotals.materialsCost > 0 && (
                  <span>Materiály: {calculatedTotals.materialsCost.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč</span>
                )}
                {calculatedTotals.formworkCost > 0 && (
                  <span className="text-blue-600">
                    Nájem bednění: {calculatedTotals.formworkCost.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč
                  </span>
                )}
                {calculatedTotals.pumpCost > 0 && (
                  <span className="text-blue-600">
                    Betonočerpadlo: {calculatedTotals.pumpCost.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 p-4">
            {/* D: visible save state (green ✓ after save, amber when unsaved). */}
            {justSaved ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 mr-auto">
                <Check size={16} className="w-[16px] h-[16px]" /> Uloženo
              </span>
            ) : dirty ? (
              <span className="text-sm text-amber-600 mr-auto">Neuložené změny</span>
            ) : null}
            <button
              onClick={requestClose}
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

        {/* C: unsaved-changes prompt on close (overlays the modal body). */}
        {showCloseConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-lg">
            <div className="bg-bg-secondary border border-border-accent rounded-lg shadow-neuro-up p-5 max-w-sm w-full mx-4">
              <p className="text-sm font-medium text-text-primary">Máte neuložené změny</p>
              <p className="text-sm text-text-secondary mt-1">
                Chcete je před zavřením uložit?
              </p>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-tertiary rounded transition-colors"
                >
                  Zpět
                </button>
                <button
                  onClick={() => { setShowCloseConfirm(false); onClose(); }}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Zavřít bez uložení
                </button>
                <button
                  onClick={() => { setShowCloseConfirm(false); saveAndClose(); }}
                  className="px-3 py-1.5 text-sm font-medium bg-accent-primary text-white hover:bg-accent-primary/90 rounded transition-colors"
                >
                  Uložit a zavřít
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
