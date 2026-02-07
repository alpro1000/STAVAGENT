/**
 * LaborTab Component
 *
 * Tab for managing labor resources (pracovní síly).
 * Shows table of workers with profession, count, hours, norm-hours.
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { LaborResource } from '../../types/unified';
import { v4 as uuidv4 } from 'uuid';

interface LaborTabProps {
  resources: LaborResource[];
  onChange: (resources: LaborResource[]) => void;
  itemQuantity: number | null;
}

const COMMON_PROFESSIONS = [
  'Betonář',
  'Železář / Armovač',
  'Tesař / Bednář',
  'Pomocný dělník',
  'Jeřábník',
  'Řidič',
  'Stavbyvedoucí',
];

const DEFAULT_RATES: Record<string, number> = {
  'Betonář': 398,
  'Železář / Armovač': 420,
  'Tesař / Bednář': 385,
  'Pomocný dělník': 280,
  'Jeřábník': 450,
  'Řidič': 350,
  'Stavbyvedoucí': 550,
};

export function LaborTab({ resources, onChange, itemQuantity }: LaborTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProfession, setNewProfession] = useState('');

  const addResource = (profession: string) => {
    const rate = DEFAULT_RATES[profession] || 350;
    const newResource: LaborResource = {
      id: uuidv4(),
      profession,
      count: 1,
      hours: 8,
      normHours: 8,
      hourlyRate: rate,
      totalCost: 8 * rate,
    };
    onChange([...resources, newResource]);
    setShowAddForm(false);
    setNewProfession('');
  };

  const updateResource = (id: string, updates: Partial<LaborResource>) => {
    onChange(
      resources.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        // Recalculate norm-hours and cost
        updated.normHours = updated.count * updated.hours;
        updated.totalCost = updated.normHours * (updated.hourlyRate || 0);
        return updated;
      })
    );
  };

  const removeResource = (id: string) => {
    onChange(resources.filter(r => r.id !== id));
  };

  const totalNormHours = resources.reduce((sum, r) => sum + r.normHours, 0);
  const totalCost = resources.reduce((sum, r) => sum + (r.totalCost || 0), 0);

  return (
    <div className="space-y-4">
      {/* Table */}
      {resources.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                <th className="text-left py-2 px-3 font-medium text-text-secondary">Profese</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-20">Počet</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-24">Hodiny</th>
                <th className="text-center py-2 px-3 font-medium text-text-secondary w-28">Normohodiny</th>
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
                      value={resource.profession}
                      onChange={e => updateResource(resource.id, { profession: e.target.value })}
                      className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-accent-primary rounded px-1"
                      list="professions"
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
                  <td className="py-2 px-3 text-center font-medium text-accent-primary">
                    {resource.normHours.toFixed(1)}
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
                <td className="py-2 px-3 text-center font-bold text-accent-primary">
                  {totalNormHours.toFixed(1)} h
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
          Žádné pracovní zdroje. Přidejte profesi níže.
        </div>
      )}

      {/* Datalist for autocomplete */}
      <datalist id="professions">
        {COMMON_PROFESSIONS.map(p => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* Add form */}
      {showAddForm ? (
        <div className="flex items-center gap-2 p-3 bg-bg-tertiary/30 rounded">
          <input
            type="text"
            value={newProfession}
            onChange={e => setNewProfession(e.target.value)}
            placeholder="Název profese..."
            className="flex-1 px-3 py-2 bg-bg-secondary rounded border border-border-color focus:outline-none focus:border-accent-primary"
            list="professions"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && newProfession.trim()) {
                addResource(newProfession.trim());
              } else if (e.key === 'Escape') {
                setShowAddForm(false);
                setNewProfession('');
              }
            }}
          />
          <button
            onClick={() => newProfession.trim() && addResource(newProfession.trim())}
            disabled={!newProfession.trim()}
            className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
          >
            Přidat
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewProfession(''); }}
            className="px-4 py-2 text-text-secondary hover:bg-bg-secondary rounded transition-colors"
          >
            Zrušit
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {COMMON_PROFESSIONS.map(profession => (
            <button
              key={profession}
              onClick={() => addResource(profession)}
              className="px-3 py-1.5 text-sm bg-bg-tertiary hover:bg-bg-secondary rounded border border-border-color/50 hover:border-accent-primary transition-colors"
            >
              + {profession}
            </button>
          ))}
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 text-sm text-accent-primary hover:bg-accent-primary/10 rounded border border-dashed border-accent-primary/50 transition-colors flex items-center gap-1"
          >
            <Plus size={14} />
            Jiná profese
          </button>
        </div>
      )}

      {/* Info about quantity */}
      {itemQuantity && itemQuantity > 0 && (
        <div className="text-xs text-text-muted mt-2">
          Položka: {itemQuantity} jednotek. Normohodiny na jednotku: {totalNormHours > 0 ? (totalNormHours / itemQuantity).toFixed(2) : '-'} h
        </div>
      )}
    </div>
  );
}
