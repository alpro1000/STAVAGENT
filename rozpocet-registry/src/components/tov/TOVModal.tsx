/**
 * TOVModal Component
 *
 * Modal dialog for viewing and editing resource breakdown (TOV - Ведомость ресурсов).
 * Contains three tabs: Labor, Machinery, Materials.
 *
 * @see docs/UNIFICATION_PLAN.md - Phase 3
 */

import { useState, useEffect } from 'react';
import { X, Users, Truck, Package, Calculator, ExternalLink } from 'lucide-react';
import type { ParsedItem } from '../../types';
import type { TOVData, LaborResource, MachineryResource, MaterialResource } from '../../types/unified';
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
}

type TabType = 'labor' | 'machinery' | 'materials';

const emptyTOV: TOVData = {
  labor: [],
  laborSummary: { totalNormHours: 0, totalWorkers: 0 },
  machinery: [],
  machinerySummary: { totalMachineHours: 0, totalUnits: 0 },
  materials: [],
  materialsSummary: { totalCost: 0, itemCount: 0 },
};

export function TOVModal({ isOpen, onClose, item, tovData, onSave }: TOVModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('labor');
  const [localData, setLocalData] = useState<TOVData>(tovData || emptyTOV);

  // Sync local state when props change
  useEffect(() => {
    setLocalData(tovData || emptyTOV);
  }, [tovData, item.id]);

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
              Ведомость ресурсов (TOV)
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
              href={`https://monolit-planner-frontend.onrender.com/calculate?material=${encodeURIComponent(item.popis)}&quantity=${item.mnozstvi || 0}&unit=${item.mj || ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
              title="Otevřít kalkulátor Monolit"
            >
              <ExternalLink size={14} />
              Kalkulovat v Monolit
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
            />
          )}
          {activeTab === 'materials' && (
            <MaterialsTab
              resources={localData.materials}
              onChange={handleMaterialsChange}
              itemQuantity={item.mnozstvi}
            />
          )}
        </div>

        {/* Summary */}
        <TOVSummary data={localData} />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border-color shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary rounded transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-accent-primary text-white hover:bg-accent-primary/90 rounded transition-colors"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
}
