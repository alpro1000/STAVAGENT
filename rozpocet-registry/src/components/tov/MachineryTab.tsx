/**
 * MachineryTab Component
 *
 * Tab for managing machinery resources (mechanizace).
 * Shows table of equipment with type, count, hours, machine-hours.
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { MachineryResource } from '../../types/unified';
import { v4 as uuidv4 } from 'uuid';

interface MachineryTabProps {
  resources: MachineryResource[];
  onChange: (resources: MachineryResource[]) => void;
  itemQuantity: number | null;
}

const COMMON_MACHINERY = [
  'Autodomíchávač',
  'Autobetononasadlo',
  'Autojeřáb',
  'Věžový jeřáb',
  'Rypadlo',
  'Nakladač',
  'Sklápěč',
  'Ponorný vibrátor',
  'Čerpadlo',
  'Kompresor',
];

const DEFAULT_RATES: Record<string, number> = {
  'Autodomíchávač': 1800,
  'Autobetononasadlo': 3500,
  'Autojeřáb': 2800,
  'Věžový jeřáb': 2200,
  'Rypadlo': 1600,
  'Nakladač': 1200,
  'Sklápěč': 950,
  'Ponorný vibrátor': 180,
  'Čerpadlo': 450,
  'Kompresor': 380,
};

export function MachineryTab({ resources, onChange, itemQuantity }: MachineryTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState('');

  const addResource = (type: string) => {
    const rate = DEFAULT_RATES[type] || 1000;
    const newResource: MachineryResource = {
      id: uuidv4(),
      type,
      count: 1,
      hours: 8,
      machineHours: 8,
      hourlyRate: rate,
      totalCost: 8 * rate,
    };
    onChange([...resources, newResource]);
    setShowAddForm(false);
    setNewType('');
  };

  const updateResource = (id: string, updates: Partial<MachineryResource>) => {
    onChange(
      resources.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        // Recalculate machine-hours and cost
        updated.machineHours = updated.count * updated.hours;
        updated.totalCost = updated.machineHours * (updated.hourlyRate || 0);
        return updated;
      })
    );
  };

  const removeResource = (id: string) => {
    onChange(resources.filter(r => r.id !== id));
  };

  const totalMachineHours = resources.reduce((sum, r) => sum + r.machineHours, 0);
  const totalCost = resources.reduce((sum, r) => sum + (r.totalCost || 0), 0);

  return (
    <div className="space-y-4">
      {/* Table */}
      {resources.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                <th className="text-left py-2 px-3 font-medium text-text-secondary">Typ stroje</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-20">Počet</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-24">Hodiny</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-28">Strojhodiny</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-28">Sazba (Kč/h)</th>
                <th className="text-right py-2 px-3 font-medium text-text-secondary w-32">Náklady</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {resources.map(resource => (
                <tr key={resource.id} className="border-b border-border-color/50 hover:bg-bg-tertiary/30">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={resource.type}
                      onChange={e => updateResource(resource.id, { type: e.target.value })}
                      className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-accent-primary rounded px-1"
                      list="machinery"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="1"
                      value={resource.count}
                      onChange={e => updateResource(resource.id, { count: parseInt(e.target.value) || 1 })}
                      className="w-full text-center bg-bg-secondary/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={resource.hours}
                      onChange={e => updateResource(resource.id, { hours: parseFloat(e.target.value) || 0 })}
                      className="w-full text-center bg-bg-secondary/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                  </td>
                  <td className="py-2 px-3 text-center font-medium text-blue-500">
                    {resource.machineHours.toFixed(1)}
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      value={resource.hourlyRate || 0}
                      onChange={e => updateResource(resource.id, { hourlyRate: parseFloat(e.target.value) || 0 })}
                      className="w-full text-center bg-bg-secondary/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-medium tabular-nums">
                    {(resource.totalCost || 0).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="py-2 px-1">
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
                <td colSpan={3} className="py-2 px-3 font-medium text-right">Celkem:</td>
                <td className="py-2 px-3 text-center font-bold text-blue-500">
                  {totalMachineHours.toFixed(1)} h
                </td>
                <td></td>
                <td className="py-2 px-3 text-right font-bold tabular-nums">
                  {totalCost.toLocaleString('cs-CZ')} Kč
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-text-muted">
          Žádné mechanizmy. Přidejte stroj níže.
        </div>
      )}

      {/* Datalist for autocomplete */}
      <datalist id="machinery">
        {COMMON_MACHINERY.map(m => (
          <option key={m} value={m} />
        ))}
      </datalist>

      {/* Add form */}
      {showAddForm ? (
        <div className="flex items-center gap-2 p-3 bg-bg-tertiary/30 rounded">
          <input
            type="text"
            value={newType}
            onChange={e => setNewType(e.target.value)}
            placeholder="Typ stroje..."
            className="flex-1 px-3 py-2 bg-bg-secondary rounded border border-border-color focus:outline-none focus:border-accent-primary"
            list="machinery"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && newType.trim()) {
                addResource(newType.trim());
              } else if (e.key === 'Escape') {
                setShowAddForm(false);
                setNewType('');
              }
            }}
          />
          <button
            onClick={() => newType.trim() && addResource(newType.trim())}
            disabled={!newType.trim()}
            className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
          >
            Přidat
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewType(''); }}
            className="px-4 py-2 text-text-secondary hover:bg-bg-secondary rounded transition-colors"
          >
            Zrušit
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {COMMON_MACHINERY.slice(0, 6).map(type => (
            <button
              key={type}
              onClick={() => addResource(type)}
              className="px-3 py-1.5 text-sm bg-bg-tertiary hover:bg-bg-secondary rounded border border-border-color/50 hover:border-blue-500 transition-colors"
            >
              + {type}
            </button>
          ))}
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 text-sm text-blue-500 hover:bg-blue-500/10 rounded border border-dashed border-blue-500/50 transition-colors flex items-center gap-1"
          >
            <Plus size={14} />
            Jiný stroj
          </button>
        </div>
      )}

      {/* Info about quantity */}
      {itemQuantity && itemQuantity > 0 && (
        <div className="text-xs text-text-muted mt-2">
          Položka: {itemQuantity} jednotek. Strojhodiny na jednotku: {totalMachineHours > 0 ? (totalMachineHours / itemQuantity).toFixed(2) : '-'} h
        </div>
      )}
    </div>
  );
}
