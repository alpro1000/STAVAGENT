/**
 * MaterialsTab Component
 *
 * Tab for managing material resources (materiály).
 * Shows table of materials with name, quantity, unit, price.
 */

import { useState } from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import type { MaterialResource, FormworkRentalRow } from '../../types/unified';
import { v4 as uuidv4 } from 'uuid';
import { FormworkRentalSection } from './FormworkRentalSection';

interface MaterialsTabProps {
  resources: MaterialResource[];
  onChange: (resources: MaterialResource[]) => void;
  itemQuantity: number | null;
  /** Item skupina — shows FormworkRentalSection only for BEDNENI */
  itemSkupina?: string | null;
  itemPopis?: string;
  formworkRental?: FormworkRentalRow[];
  onFormworkRentalChange?: (rows: FormworkRentalRow[]) => void;
}

const COMMON_MATERIALS = [
  { name: 'Beton C30/37', unit: 'm³', price: 3200 },
  { name: 'Beton C25/30', unit: 'm³', price: 2900 },
  { name: 'Výztuž B500B', unit: 'kg', price: 32 },
  { name: 'Bednění systémové', unit: 'm²', price: 85 },
  { name: 'Separační olej', unit: 'l', price: 45 },
  { name: 'Distanční kroužky', unit: 'ks', price: 3 },
  { name: 'Vázací drát', unit: 'kg', price: 48 },
  { name: 'Těsnící pás', unit: 'm', price: 120 },
];

export function MaterialsTab({
  resources,
  onChange,
  itemQuantity,
  itemSkupina,
  itemPopis,
  formworkRental = [],
  onFormworkRentalChange,
}: MaterialsTabProps) {
  const isBedneni = itemSkupina === 'BEDNENI';
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: '', unit: '', price: 0 });

  const addResource = (name: string, unit: string, unitPrice: number) => {
    const newResource: MaterialResource = {
      id: uuidv4(),
      name,
      unit,
      quantity: 1,
      unitPrice,
      totalCost: unitPrice,
    };
    onChange([...resources, newResource]);
    setShowAddForm(false);
    setNewMaterial({ name: '', unit: '', price: 0 });
  };

  const addFromTemplate = (template: { name: string; unit: string; price: number }) => {
    addResource(template.name, template.unit, template.price);
  };

  const updateResource = (id: string, updates: Partial<MaterialResource>) => {
    onChange(
      resources.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        // Recalculate total cost
        updated.totalCost = updated.quantity * (updated.unitPrice || 0);
        return updated;
      })
    );
  };

  const removeResource = (id: string) => {
    onChange(resources.filter(r => r.id !== id));
  };

  const openInMonolit = () => {
    window.open('https://monolit-planner-frontend.onrender.com', '_blank');
  };

  const totalCost = resources.reduce((sum, r) => sum + (r.totalCost || 0), 0);

  return (
    <div className="space-y-4">
      {/* Table */}
      {resources.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                <th className="text-left py-2 px-3 font-medium text-text-secondary">Materiál</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-24">Množství</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-20">MJ</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-28">Cena/MJ</th>
                <th className="text-right py-2 px-3 font-medium text-text-secondary w-32">Celkem</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {resources.map(resource => (
                <tr key={resource.id} className="border-b border-border-color/50 hover:bg-bg-tertiary/30">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={resource.name}
                      onChange={e => updateResource(resource.id, { name: e.target.value })}
                      className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-accent-primary rounded px-1"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={resource.quantity}
                      onChange={e => updateResource(resource.id, { quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full text-center bg-bg-secondary/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={resource.unit}
                      onChange={e => updateResource(resource.id, { unit: e.target.value })}
                      className="w-full text-center bg-bg-secondary/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={resource.unitPrice || 0}
                      onChange={e => updateResource(resource.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full text-center bg-bg-secondary/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-medium tabular-nums text-green-600">
                    {(resource.totalCost || 0).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="py-2 px-1 flex items-center gap-1">
                    {/* Link to Monolit for concrete materials */}
                    {resource.name.toLowerCase().includes('beton') && (
                      <button
                        onClick={openInMonolit}
                        className="p-1 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                        title="Otevřít Monolit Planner"
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => removeResource(resource.id)}
                      className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      title="Odstranit"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-bg-tertiary/30">
                <td colSpan={4} className="py-2 px-3 font-medium text-right">Celkem materiály:</td>
                <td className="py-2 px-3 text-right font-bold tabular-nums text-green-600">
                  {totalCost.toLocaleString('cs-CZ')} Kč
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-text-muted">
          Žádné materiály. Přidejte materiál níže.
        </div>
      )}

      {/* Add form */}
      {showAddForm ? (
        <div className="p-3 bg-bg-tertiary/30 rounded space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={newMaterial.name}
              onChange={e => setNewMaterial(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Název materiálu"
              className="px-3 py-2 bg-bg-secondary rounded border border-border-color focus:outline-none focus:border-accent-primary"
              autoFocus
            />
            <input
              type="text"
              value={newMaterial.unit}
              onChange={e => setNewMaterial(prev => ({ ...prev, unit: e.target.value }))}
              placeholder="MJ (m³, kg...)"
              className="px-3 py-2 bg-bg-secondary rounded border border-border-color focus:outline-none focus:border-accent-primary"
            />
            <input
              type="number"
              value={newMaterial.price || ''}
              onChange={e => setNewMaterial(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              placeholder="Cena/MJ"
              className="px-3 py-2 bg-bg-secondary rounded border border-border-color focus:outline-none focus:border-accent-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => newMaterial.name.trim() && addResource(newMaterial.name.trim(), newMaterial.unit, newMaterial.price)}
              disabled={!newMaterial.name.trim()}
              className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
            >
              Přidat
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewMaterial({ name: '', unit: '', price: 0 }); }}
              className="px-4 py-2 text-text-secondary hover:bg-bg-secondary rounded transition-colors"
            >
              Zrušit
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {COMMON_MATERIALS.slice(0, 5).map(template => (
            <button
              key={template.name}
              onClick={() => addFromTemplate(template)}
              className="px-3 py-1.5 text-sm bg-bg-tertiary hover:bg-bg-secondary rounded border border-border-color/50 hover:border-green-500 transition-colors"
            >
              + {template.name}
            </button>
          ))}
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-500/10 rounded border border-dashed border-green-500/50 transition-colors flex items-center gap-1"
          >
            <Plus size={14} />
            Jiný materiál
          </button>
        </div>
      )}

      {/* Info about quantity */}
      {itemQuantity && itemQuantity > 0 && (
        <div className="text-xs text-text-muted mt-2">
          Položka: {itemQuantity} jednotek. Náklady materiálů na jednotku: {totalCost > 0 ? (totalCost / itemQuantity).toFixed(2) : '-'} Kč
        </div>
      )}

      {/* Formwork rental table — only for BEDNENI positions */}
      {isBedneni && onFormworkRentalChange && (
        <FormworkRentalSection
          rows={formworkRental}
          onChange={onFormworkRentalChange}
          itemPopis={itemPopis}
          itemMnozstvi={itemQuantity}
          onAddToMaterials={(res) => onChange([...resources, res])}
        />
      )}
    </div>
  );
}
