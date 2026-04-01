/**
 * CraneRentalSection — Mini-calculator for crane rental costs.
 *
 * Embedded in MachineryTab for positions requiring crane operations.
 * Knowledge base: cranes.json (6 models: Liebherr LTM 30-100t, Potain tower, Terex compact).
 * Decision logic: by weight, radius, height, project duration.
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Building2 } from 'lucide-react';

// Inline crane KB (from concrete-agent/knowledge_base/B9_Equipment_Specs/cranes.json)
const CRANES = [
  { id: 'ltm_1030', model: 'LTM 1030-2.1', manufacturer: 'Liebherr', type: 'mobile', capacity_t: 30, radius_m: 35, height_m: 42, day_czk: 4500, hour_czk: 650, note: 'Nejběžnější pro běžné stavby' },
  { id: 'ltm_1050', model: 'LTM 1050-3.1', manufacturer: 'Liebherr', type: 'mobile', capacity_t: 50, radius_m: 40, height_m: 52, day_czk: 7500, hour_czk: 1050, note: 'Větší projekty, delší dosah' },
  { id: 'ltm_1070', model: 'LTM 1070-4.2', manufacturer: 'Liebherr', type: 'mobile', capacity_t: 70, radius_m: 48, height_m: 62, day_czk: 10500, hour_czk: 1450, note: 'Náročnější projekty' },
  { id: 'ltm_1100', model: 'LTM 1100-5.2', manufacturer: 'Liebherr', type: 'mobile', capacity_t: 100, radius_m: 58, height_m: 78, day_czk: 15000, hour_czk: 2000, note: 'Velké projekty' },
  { id: 'potain_md238', model: 'MD 238 B', manufacturer: 'Potain', type: 'tower', capacity_t: 10, radius_m: 55, height_m: 70, month_czk: 45000, setup_days: 2, note: 'Věžový, min. 3 měsíce' },
  { id: 'terex_ac45', model: 'AC 45 City', manufacturer: 'Terex', type: 'mobile_compact', capacity_t: 45, radius_m: 38, height_m: 48, day_czk: 6500, hour_czk: 900, note: 'Kompaktní, městské stavby' },
];

// Re-export from unified types for backwards compat
export type { CraneCalcData } from '../../types/unified';
import type { CraneCalcData } from '../../types/unified';

interface Props {
  data: CraneCalcData | undefined;
  onChange: (data: CraneCalcData) => void;
}

const defaultData: CraneCalcData = {
  crane_id: 'ltm_1030',
  billing_mode: 'daily',
  hours: 8,
  days: 5,
  months: 0,
  mobilizations: 1,
  mobilization_czk: 3000,
  total_czk: 0,
};

function recompute(d: CraneCalcData): CraneCalcData {
  const crane = CRANES.find(c => c.id === d.crane_id) || CRANES[0];
  let base = 0;

  if (d.billing_mode === 'hourly') {
    base = (crane.hour_czk || 0) * d.hours;
  } else if (d.billing_mode === 'daily') {
    base = (crane.day_czk || 0) * d.days;
  } else {
    base = (crane.month_czk || 0) * Math.max(3, d.months); // min 3 months for tower
  }

  const mobilization = d.mobilizations * d.mobilization_czk;
  return { ...d, total_czk: base + mobilization };
}

export function CraneRentalSection({ data, onChange }: Props) {
  const [expanded, setExpanded] = useState(!!data);
  const calc = useMemo(() => recompute(data || defaultData), [data]);
  const crane = CRANES.find(c => c.id === calc.crane_id) || CRANES[0];

  const update = (patch: Partial<CraneCalcData>) => {
    onChange(recompute({ ...calc, ...patch }));
  };

  if (!expanded && !data) {
    return (
      <button
        onClick={() => { setExpanded(true); onChange(recompute(defaultData)); }}
        className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded border border-dashed border-blue-300 transition-colors"
      >
        + Přidat kalkulaci jeřábu
      </button>
    );
  }

  return (
    <div className="border border-blue-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 text-sm font-medium text-blue-800"
      >
        <span><Building2 size={14} className="inline" /> Jeřáb: {crane.manufacturer} {crane.model} ({crane.capacity_t}t)</span>
        <div className="flex items-center gap-2">
          <span className="font-mono">{calc.total_czk.toLocaleString('cs-CZ')} Kč</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-3 text-sm">
          {/* Crane selection */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-text-secondary text-xs">Jeřáb</span>
              <select
                value={calc.crane_id}
                onChange={e => update({ crane_id: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm"
              >
                {CRANES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.manufacturer} {c.model} ({c.capacity_t}t, r={c.radius_m}m)
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-text-secondary text-xs">Režim účtování</span>
              <select
                value={calc.billing_mode}
                onChange={e => update({ billing_mode: e.target.value as CraneCalcData['billing_mode'] })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm"
              >
                <option value="hourly">Hodinový ({crane.hour_czk || '—'} Kč/h)</option>
                <option value="daily">Denní ({crane.day_czk || '—'} Kč/den)</option>
                {crane.type === 'tower' && <option value="monthly">Měsíční ({crane.month_czk || '—'} Kč/měs.)</option>}
              </select>
            </label>
          </div>

          {/* Duration inputs */}
          <div className="grid grid-cols-3 gap-3">
            {calc.billing_mode === 'hourly' && (
              <label className="block">
                <span className="text-text-secondary text-xs">Hodiny</span>
                <input type="number" min={1} value={calc.hours}
                  onChange={e => update({ hours: +e.target.value || 1 })}
                  className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm font-mono"
                />
              </label>
            )}
            {calc.billing_mode === 'daily' && (
              <label className="block">
                <span className="text-text-secondary text-xs">Dny</span>
                <input type="number" min={1} value={calc.days}
                  onChange={e => update({ days: +e.target.value || 1 })}
                  className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm font-mono"
                />
              </label>
            )}
            {calc.billing_mode === 'monthly' && (
              <label className="block">
                <span className="text-text-secondary text-xs">Měsíce (min 3)</span>
                <input type="number" min={3} value={calc.months || 3}
                  onChange={e => update({ months: Math.max(3, +e.target.value || 3) })}
                  className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm font-mono"
                />
              </label>
            )}
            <label className="block">
              <span className="text-text-secondary text-xs">Přistavení</span>
              <input type="number" min={1} value={calc.mobilizations}
                onChange={e => update({ mobilizations: +e.target.value || 1 })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-text-secondary text-xs">Kč/přistavení</span>
              <input type="number" min={0} value={calc.mobilization_czk}
                onChange={e => update({ mobilization_czk: +e.target.value || 0 })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm font-mono"
              />
            </label>
          </div>

          {/* Info row */}
          <div className="text-xs text-text-muted">
            Dosah: {crane.radius_m}m | Výška: {crane.height_m}m | {crane.note}
          </div>

          {/* Total */}
          <div className="flex justify-end pt-2 border-t border-border-color/50">
            <span className="font-mono font-bold text-blue-700">
              Celkem: {calc.total_czk.toLocaleString('cs-CZ')} Kč
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
