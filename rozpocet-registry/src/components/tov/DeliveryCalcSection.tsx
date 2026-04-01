/**
 * DeliveryCalcSection — Mini-calculator for concrete delivery costs.
 *
 * Calculates transport costs for ready-mix concrete (autodomíchávač).
 * Based on Czech betonárka pricing: fixed + per-km + per-m³ + surcharges.
 *
 * Typical Czech pricing (2026):
 *   Autodomíchávač 7-9 m³: 1800 Kč/h (min 3h) or fixed per delivery
 *   Dopravné: 30-80 Kč/km (depending on distance and supplier)
 *   Čerpání: separate (see PumpRentalSection)
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Truck } from 'lucide-react';

// Mixer truck types (autodomíchávač)
const MIXER_TYPES = [
  { id: 'am_7', label: 'Autodomíchávač 7 m³', capacity_m3: 7, delivery_czk: 1800, czk_km: 45 },
  { id: 'am_9', label: 'Autodomíchávač 9 m³', capacity_m3: 9, delivery_czk: 2200, czk_km: 55 },
  { id: 'am_12', label: 'Autodomíchávač 12 m³', capacity_m3: 12, delivery_czk: 2800, czk_km: 65 },
];

// Concrete price examples (CZK per m³, without VAT)
const CONCRETE_PRICES: Record<string, number> = {
  'C12/15': 2150,
  'C16/20': 2350,
  'C20/25': 2550,
  'C25/30': 2800,
  'C30/37': 3100,
  'C35/45': 3400,
  'C40/50': 3800,
  'C45/55': 4200,
  'C50/60': 4600,
};

// Re-export from unified types for backwards compat
export type { DeliveryCalcData } from '../../types/unified';
import type { DeliveryCalcData } from '../../types/unified';

interface Props {
  data: DeliveryCalcData | undefined;
  onChange: (data: DeliveryCalcData) => void;
  defaultVolume?: number;
  defaultClass?: string;
}

function recompute(d: DeliveryCalcData): DeliveryCalcData {
  const mixer = MIXER_TYPES.find(m => m.id === d.mixer_id) || MIXER_TYPES[1];
  const numDeliveries = Math.ceil(d.volume_m3 / mixer.capacity_m3);

  // Transport: per delivery (fixed + distance)
  const transportPerDelivery = mixer.delivery_czk + d.distance_km * mixer.czk_km * 2; // round trip
  const transport_czk = numDeliveries * transportPerDelivery;

  // Concrete material cost
  const concrete_czk = d.volume_m3 * d.concrete_price_m3;

  // Surcharges
  let surcharges = 0;
  if (d.weekend_surcharge) surcharges += numDeliveries * 500; // weekend flat per delivery
  if (d.small_qty_surcharge && d.volume_m3 < 3) surcharges += 800; // small batch penalty
  surcharges += d.waiting_hours * d.waiting_czk_h;

  return {
    ...d,
    num_deliveries: numDeliveries,
    transport_czk: Math.round(transport_czk),
    concrete_czk: Math.round(concrete_czk),
    surcharges_czk: Math.round(surcharges),
    total_czk: Math.round(transport_czk + concrete_czk + surcharges),
  };
}

export function DeliveryCalcSection({ data, onChange, defaultVolume, defaultClass }: Props) {
  const [expanded, setExpanded] = useState(!!data);

  const defaultData: DeliveryCalcData = {
    mixer_id: 'am_9',
    concrete_class: defaultClass || 'C30/37',
    volume_m3: defaultVolume || 50,
    distance_km: 15,
    concrete_price_m3: CONCRETE_PRICES[defaultClass || 'C30/37'] || 3100,
    weekend_surcharge: false,
    small_qty_surcharge: false,
    waiting_hours: 0,
    waiting_czk_h: 600,
    num_deliveries: 0,
    transport_czk: 0,
    concrete_czk: 0,
    surcharges_czk: 0,
    total_czk: 0,
  };

  const calc = useMemo(() => recompute(data || defaultData), [data]);
  const mixer = MIXER_TYPES.find(m => m.id === calc.mixer_id) || MIXER_TYPES[1];

  const update = (patch: Partial<DeliveryCalcData>) => {
    const merged = { ...calc, ...patch };
    // Auto-update concrete price when class changes
    if (patch.concrete_class && !patch.concrete_price_m3) {
      merged.concrete_price_m3 = CONCRETE_PRICES[patch.concrete_class] || merged.concrete_price_m3;
    }
    onChange(recompute(merged));
  };

  if (!expanded && !data) {
    return (
      <button
        onClick={() => { setExpanded(true); onChange(recompute(defaultData)); }}
        className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded border border-dashed border-green-300 transition-colors"
      >
        + Přidat kalkulaci dopravy betonu
      </button>
    );
  }

  return (
    <div className="border border-green-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-green-50 text-sm font-medium text-green-800"
      >
        <span><Truck size={14} className="inline" /> Doprava betonu: {calc.volume_m3} m³ {calc.concrete_class}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono">{calc.total_czk.toLocaleString('cs-CZ')} Kč</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-3 text-sm">
          {/* Main inputs */}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-text-secondary text-xs">Třída betonu</span>
              <select
                value={calc.concrete_class}
                onChange={e => update({ concrete_class: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm"
              >
                {Object.keys(CONCRETE_PRICES).map(cls => (
                  <option key={cls} value={cls}>{cls} ({CONCRETE_PRICES[cls]} Kč/m³)</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-text-secondary text-xs">Objem (m³)</span>
              <input type="number" min={0.5} step={0.5} value={calc.volume_m3}
                onChange={e => update({ volume_m3: +e.target.value || 1 })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-text-secondary text-xs">Vzdálenost (km)</span>
              <input type="number" min={1} value={calc.distance_km}
                onChange={e => update({ distance_km: +e.target.value || 1 })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm font-mono"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-text-secondary text-xs">Typ domíchávače</span>
              <select
                value={calc.mixer_id}
                onChange={e => update({ mixer_id: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm"
              >
                {MIXER_TYPES.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-text-secondary text-xs">Cena betonu (Kč/m³)</span>
              <input type="number" min={0} value={calc.concrete_price_m3}
                onChange={e => update({ concrete_price_m3: +e.target.value || 0 })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-text-secondary text-xs">Čekání (h)</span>
              <input type="number" min={0} step={0.5} value={calc.waiting_hours}
                onChange={e => update({ waiting_hours: +e.target.value || 0 })}
                className="w-full mt-1 px-2 py-1.5 bg-bg-primary border border-border-color rounded text-sm font-mono"
              />
            </label>
          </div>

          {/* Surcharges */}
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={calc.weekend_surcharge}
                onChange={e => update({ weekend_surcharge: e.target.checked })}
              />
              Víkend/svátek (+500 Kč/dodávka)
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={calc.small_qty_surcharge}
                onChange={e => update({ small_qty_surcharge: e.target.checked })}
              />
              Malé množství ({'<'}3 m³, +800 Kč)
            </label>
          </div>

          {/* Breakdown */}
          <div className="bg-bg-tertiary/30 rounded p-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Beton: {calc.volume_m3} m³ × {calc.concrete_price_m3} Kč</span>
              <span className="font-mono">{calc.concrete_czk.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div className="flex justify-between">
              <span>Doprava: {calc.num_deliveries}× {mixer.label} ({calc.distance_km} km)</span>
              <span className="font-mono">{calc.transport_czk.toLocaleString('cs-CZ')} Kč</span>
            </div>
            {calc.surcharges_czk > 0 && (
              <div className="flex justify-between">
                <span>Příplatky</span>
                <span className="font-mono">{calc.surcharges_czk.toLocaleString('cs-CZ')} Kč</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-end pt-2 border-t border-border-color/50">
            <span className="font-mono font-bold text-green-700">
              Celkem: {calc.total_czk.toLocaleString('cs-CZ')} Kč
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
