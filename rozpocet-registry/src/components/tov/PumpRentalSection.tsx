/**
 * PumpRentalSection — Kalkulátor betonočerpadla
 *
 * Realistic pump cost model based on Czech supplier offers (Beton Union 2026):
 *
 *   Doprava    = přistavení × (pristaveni_fixed + vzdalenost_km × czk_km × 2)
 *   Manipulace = manipulace_czk_h × Σ hodiny_celkem
 *                  hodiny_celkem per item = celkem_m3/výkon + přist × (0.5h stavba + 0.5h mytí)
 *   Příplatek  = priplatek_czk_m3 × celkem_m3   (0 Kč for smaller pumps)
 *   Příslušenství = Σ accessories
 *   Příplatky  = Σ surcharges × celkem_přistavení
 *   ────────────────────────────────────────────
 *   Konečná cena = součet všeho
 */

import { useState } from 'react';
import { Plus, Trash2, Truck, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import type {
  PumpRentalData,
  PumpConstructionItem,
  PumpSurcharge,
  PumpAccessory,
} from '../../types/unified';
import pumpKnowledge from '../../data/pump_knowledge.json';
import { v4 as uuidv4 } from 'uuid';

// ─── Types from knowledge base ────────────────────────────────────────────────

interface KbPump {
  id: string;
  label_cs: string;
  boom_m: number;
  reach_m: number;
  vykon_m3h: number;
  manipulace_czk_h: number;
  priplatek_czk_m3: number;
  pristaveni_czk: number;
  czk_km: number;
  notes: string;
}

interface KbAccessoryItem {
  id: string;
  label_cs: string;
  unit: string;
  czk_per_unit: number;
  note: string;
}

const KB_PUMPS = pumpKnowledge.pumps as KbPump[];
const KB_ACCESSORIES = pumpKnowledge.accessories.items as KbAccessoryItem[];
const KB_SURCHARGE_HINTS = pumpKnowledge.surcharge_hints as string[];
const STD_STAVBA_H = pumpKnowledge.standard_times.stavba_h;
const STD_MYTI_H   = pumpKnowledge.standard_times.myti_h;

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_DATA: PumpRentalData = {
  pump_type_id: undefined,
  pump_label: undefined,
  manipulace_czk_h: 2500,
  priplatek_czk_m3: 0,
  pristaveni_fixed_czk: 2000,
  czk_km: 60,
  vykon_m3h: 90,
  vzdalenost_km: 10,
  stavba_h: STD_STAVBA_H,
  myti_h: STD_MYTI_H,
  items: [],
  accessories: [],
  surcharges: [],
  kros_kod: '',
  celkem_m3: 0,
  celkem_pristaveni: 0,
  celkem_hodiny: 0,
  celkem_doprava: 0,
  celkem_manipulace: 0,
  celkem_priplatek_m3: 0,
  celkem_prislusenstvi: 0,
  celkem_priplatky: 0,
  konecna_cena: 0,
};

// ─── Pure computation ──────────────────────────────────────────────────────────

function recomputeItem(
  item: PumpConstructionItem,
  vykon_m3h: number,
  stavba_h: number,
  myti_h: number,
): PumpConstructionItem {
  const celkem_m3 = item.objem_m3_takt * item.pocet_taktu;
  const hodiny_cerpani = vykon_m3h > 0 ? celkem_m3 / vykon_m3h : 0;
  const hodiny_overhead = item.pocet_pristaveni * (stavba_h + myti_h);
  return {
    ...item,
    celkem_m3,
    hodiny_cerpani,
    hodiny_overhead,
    hodiny_celkem: hodiny_cerpani + hodiny_overhead,
  };
}

function computeTotals(d: PumpRentalData): PumpRentalData {
  const items = d.items.map(i =>
    recomputeItem(i, d.vykon_m3h, d.stavba_h, d.myti_h),
  );

  const celkem_m3 = items.reduce((s, i) => s + i.celkem_m3, 0);
  const celkem_pristaveni = items.reduce((s, i) => s + i.pocet_pristaveni, 0);
  const celkem_hodiny = items.reduce((s, i) => s + i.hodiny_celkem, 0);

  const celkem_doprava =
    celkem_pristaveni * (d.pristaveni_fixed_czk + d.vzdalenost_km * d.czk_km * 2);
  const celkem_manipulace = d.manipulace_czk_h * celkem_hodiny;
  const celkem_priplatek_m3 = d.priplatek_czk_m3 * celkem_m3;

  const accessories = d.accessories.map(a => ({
    ...a,
    celkem: a.mnozstvi * a.czk_per_unit,
  }));
  const celkem_prislusenstvi = accessories.reduce((s, a) => s + a.celkem, 0);

  const surcharges = d.surcharges.map(s => ({
    ...s,
    celkem: s.czk_per_pristaveni * celkem_pristaveni,
  }));
  const celkem_priplatky = surcharges.reduce((s, x) => s + x.celkem, 0);

  const konecna_cena =
    celkem_doprava +
    celkem_manipulace +
    celkem_priplatek_m3 +
    celkem_prislusenstvi +
    celkem_priplatky;

  return {
    ...d,
    items,
    accessories,
    surcharges,
    celkem_m3,
    celkem_pristaveni,
    celkem_hodiny,
    celkem_doprava,
    celkem_manipulace,
    celkem_priplatek_m3,
    celkem_prislusenstvi,
    celkem_priplatky,
    konecna_cena,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface PumpRentalSectionProps {
  pumpRental: PumpRentalData | undefined;
  onChange: (data: PumpRentalData) => void;
  itemQuantity?: number | null;
}

export function PumpRentalSection({ pumpRental, onChange, itemQuantity }: PumpRentalSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showParamsAdvanced, setShowParamsAdvanced] = useState(false);

  const data = pumpRental ?? DEFAULT_DATA;

  const update = (patch: Partial<PumpRentalData>) =>
    onChange(computeTotals({ ...data, ...patch }));

  // ── Pump type selection ──────────────────────────────────────────────────

  const selectPumpType = (id: string) => {
    if (id === '') {
      update({ pump_type_id: undefined, pump_label: undefined });
      return;
    }
    const pump = KB_PUMPS.find(p => p.id === id);
    if (!pump) return;
    // Auto-fill all parameters from knowledge base
    update({
      pump_type_id: pump.id,
      pump_label: pump.label_cs,
      manipulace_czk_h: pump.manipulace_czk_h,
      priplatek_czk_m3: pump.priplatek_czk_m3,
      pristaveni_fixed_czk: pump.pristaveni_czk,
      czk_km: pump.czk_km,
      vykon_m3h: pump.vykon_m3h,
    });
  };

  // ── Construction item helpers ────────────────────────────────────────────

  const addItem = () => {
    const vol = data.items.length === 0 && itemQuantity ? Number(itemQuantity) : 0;
    const newItem = recomputeItem(
      {
        id: uuidv4(),
        nazev: '',
        objem_m3_takt: vol,
        pocet_taktu: 1,
        pocet_pristaveni: 1,
        celkem_m3: 0,
        hodiny_cerpani: 0,
        hodiny_overhead: 0,
        hodiny_celkem: 0,
      },
      data.vykon_m3h,
      data.stavba_h,
      data.myti_h,
    );
    update({ items: [...data.items, newItem] });
  };

  const updateItem = (id: string, patch: Partial<PumpConstructionItem>) => {
    const items = data.items.map(item =>
      item.id === id
        ? recomputeItem({ ...item, ...patch }, data.vykon_m3h, data.stavba_h, data.myti_h)
        : item,
    );
    update({ items });
  };

  const removeItem = (id: string) =>
    update({ items: data.items.filter(i => i.id !== id) });

  // ── Accessory helpers ────────────────────────────────────────────────────

  const addAccessoryFromKb = (kbItem: KbAccessoryItem) => {
    const a: PumpAccessory = {
      id: uuidv4(),
      nazev: kbItem.label_cs,
      mnozstvi: 0,
      unit: kbItem.unit,
      czk_per_unit: kbItem.czk_per_unit,
      celkem: 0,
    };
    update({ accessories: [...data.accessories, a] });
  };

  const addCustomAccessory = () => {
    const a: PumpAccessory = {
      id: uuidv4(),
      nazev: '',
      mnozstvi: 1,
      unit: 'ks',
      czk_per_unit: 0,
      celkem: 0,
    };
    update({ accessories: [...data.accessories, a] });
  };

  const updateAccessory = (id: string, patch: Partial<PumpAccessory>) =>
    update({
      accessories: data.accessories.map(a => (a.id === id ? { ...a, ...patch } : a)),
    });

  const removeAccessory = (id: string) =>
    update({ accessories: data.accessories.filter(a => a.id !== id) });

  // ── Surcharge helpers ────────────────────────────────────────────────────

  const addSurcharge = () =>
    update({
      surcharges: [
        ...data.surcharges,
        { id: uuidv4(), nazev: '', czk_per_pristaveni: 0, celkem: 0 },
      ],
    });

  const updateSurcharge = (id: string, patch: Partial<PumpSurcharge>) =>
    update({
      surcharges: data.surcharges.map(s => (s.id === id ? { ...s, ...patch } : s)),
    });

  const removeSurcharge = (id: string) =>
    update({ surcharges: data.surcharges.filter(s => s.id !== id) });

  // ── Display helpers ──────────────────────────────────────────────────────

  const hasData =
    data.items.length > 0 ||
    data.accessories.length > 0 ||
    data.surcharges.length > 0 ||
    data.konecna_cena > 0;

  const dopravaPerPristaveni =
    data.pristaveni_fixed_czk + data.vzdalenost_km * data.czk_km * 2;

  const selectedPump = KB_PUMPS.find(p => p.id === data.pump_type_id);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mt-6 border border-blue-500/30 rounded-lg bg-blue-500/5">

      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-blue-500/10 rounded-t-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-blue-500 shrink-0" />
          <span className="text-sm font-semibold text-blue-600">Kalkulátor betonočerpadla</span>
          {data.pump_label && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {data.pump_label.split('(')[0].trim()}
            </span>
          )}
          {hasData && !isExpanded && (
            <span className="text-xs text-blue-500 font-mono ml-1">
              {data.konecna_cena.toLocaleString('cs-CZ')} Kč
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={16} className="text-blue-400" /> : <ChevronDown size={16} className="text-blue-400" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-5">

          {/* ── Section 1: Pump type selector ── */}
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Typ čerpadla
            </p>
            <select
              value={data.pump_type_id ?? ''}
              onChange={e => selectPumpType(e.target.value)}
              className="w-full bg-bg-secondary/60 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 border border-border-color/50"
            >
              <option value="">— Vyberte čerpadlo ze seznamu nebo zadejte ručně —</option>
              {KB_PUMPS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label_cs} · {p.vykon_m3h} m³/h · {p.manipulace_czk_h.toLocaleString('cs-CZ')} Kč/h
                  {p.priplatek_czk_m3 > 0 ? ` + ${p.priplatek_czk_m3} Kč/m³` : ''}
                </option>
              ))}
            </select>
            {selectedPump && (
              <p className="text-[10px] text-text-muted mt-1 italic">{selectedPump.notes}</p>
            )}
          </div>

          {/* ── Section 2: Transport + pump params ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Doprava a parametry
              </p>
              <button
                type="button"
                onClick={() => setShowParamsAdvanced(v => !v)}
                className="text-[11px] text-blue-500 hover:underline"
              >
                {showParamsAdvanced ? 'Skrýt detaily' : 'Zobrazit všechny parametry'}
              </button>
            </div>

            {/* Row 1: distance — always visible */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-text-muted">Vzdálenost od betonárny (km)</span>
                <input
                  type="number" min={0} step={1}
                  value={data.vzdalenost_km || ''}
                  onChange={e => update({ vzdalenost_km: parseFloat(e.target.value) || 0 })}
                  className="bg-bg-secondary/60 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 text-center tabular-nums"
                />
              </label>
              <div className="flex flex-col gap-1 justify-end">
                <span className="text-[11px] text-text-muted">Doprava / přistavení</span>
                <div className="bg-blue-50/50 rounded px-2 py-1.5 text-xs text-blue-600 font-medium tabular-nums text-center">
                  {dopravaPerPristaveni.toLocaleString('cs-CZ')} Kč
                  <span className="text-[10px] text-text-muted ml-1">
                    ({data.pristaveni_fixed_czk.toLocaleString()} + {data.vzdalenost_km} km × {data.czk_km} × 2)
                  </span>
                </div>
              </div>
            </div>

            {/* Advanced params — collapsible */}
            {showParamsAdvanced && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-bg-tertiary/30 rounded-lg border border-border-color/30">
                {[
                  { label: 'Manipulace (Kč/h)', key: 'manipulace_czk_h' as const, step: 50 },
                  { label: 'Příplatek (Kč/m³)', key: 'priplatek_czk_m3' as const, step: 5 },
                  { label: 'Výkon (m³/h)', key: 'vykon_m3h' as const, step: 5 },
                  { label: 'Přistavení fixed (Kč)', key: 'pristaveni_fixed_czk' as const, step: 100 },
                  { label: 'Sazba km (Kč/km)', key: 'czk_km' as const, step: 5 },
                ].map(({ label, key, step }) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-muted">{label}</span>
                    <input
                      type="number" min={0} step={step}
                      value={data[key] || ''}
                      onChange={e => update({ [key]: parseFloat(e.target.value) || 0 })}
                      className="bg-bg-secondary/60 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 text-center tabular-nums"
                    />
                  </label>
                ))}
                <div className="col-span-3 grid grid-cols-2 gap-2 pt-2 border-t border-border-color/30">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-muted">Stavba (h/přist.) — default 0.5</span>
                    <input
                      type="number" min={0} step={0.25}
                      value={data.stavba_h}
                      onChange={e => update({ stavba_h: parseFloat(e.target.value) || 0 })}
                      className="bg-bg-secondary/60 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 text-center tabular-nums"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-muted">Mytí (h/přist.) — default 0.5</span>
                    <input
                      type="number" min={0} step={0.25}
                      value={data.myti_h}
                      onChange={e => update({ myti_h: parseFloat(e.target.value) || 0 })}
                      className="bg-bg-secondary/60 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 text-center tabular-nums"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3: Construction elements ── */}
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Betonované konstrukce
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[520px]">
                <thead>
                  <tr className="border-b border-border-color/50 text-text-muted">
                    <th className="text-left py-1.5 px-2 font-medium min-w-[130px]">Název</th>
                    <th className="text-center py-1.5 px-2 font-medium w-20">m³/takt</th>
                    <th className="text-center py-1.5 px-2 font-medium w-16">Taktů</th>
                    <th className="text-center py-1.5 px-2 font-medium w-20 bg-slate-50/50">Celkem m³</th>
                    <th className="text-center py-1.5 px-2 font-medium w-20">Přistavení</th>
                    <th className="text-center py-1.5 px-2 font-medium w-24 bg-slate-50/50">
                      <span className="flex items-center justify-center gap-1">
                        <Zap size={10} />Hod. celkem
                      </span>
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(item => (
                    <tr key={item.id} className="border-b border-border-color/30 hover:bg-bg-tertiary/20">
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={item.nazev}
                          onChange={e => updateItem(item.id, { nazev: e.target.value })}
                          placeholder="Betonáž základů…"
                          className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="number" min={0} step={0.5}
                          value={item.objem_m3_takt || ''}
                          onChange={e => updateItem(item.id, { objem_m3_takt: parseFloat(e.target.value) || 0 })}
                          className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="number" min={1} step={1}
                          value={item.pocet_taktu}
                          onChange={e => updateItem(item.id, { pocet_taktu: parseInt(e.target.value) || 1 })}
                          className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>
                      {/* Celkem m³ — computed */}
                      <td className="py-1 px-2 text-center font-medium text-blue-600 bg-slate-50/50 tabular-nums">
                        {item.celkem_m3.toFixed(1)}
                      </td>
                      {/* Přistavení */}
                      <td className="py-1 px-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <input
                            type="number" min={1} step={1}
                            value={item.pocet_pristaveni}
                            onChange={e => updateItem(item.id, { pocet_pristaveni: parseInt(e.target.value) || 1 })}
                            className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          {item.pocet_pristaveni > 0 && item.celkem_m3 > 0 && (
                            <span className="text-[10px] text-text-muted tabular-nums">
                              {(item.celkem_m3 / item.pocet_pristaveni).toFixed(1)} m³/přist.
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Hours — computed */}
                      <td className="py-1 px-2 bg-slate-50/50">
                        <div className="text-center text-blue-600 font-medium tabular-nums">
                          {item.hodiny_celkem.toFixed(2)} h
                        </div>
                        <div className="text-[10px] text-text-muted text-center">
                          {item.hodiny_cerpani.toFixed(2)}h + {item.hodiny_overhead.toFixed(2)}h
                        </div>
                      </td>
                      <td className="py-1 px-1">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Odstranit"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {data.items.length > 1 && (
                  <tfoot>
                    <tr className="bg-bg-tertiary/30 font-semibold text-xs">
                      <td colSpan={3} className="py-1.5 px-2 text-right text-text-secondary">Celkem:</td>
                      <td className="py-1.5 px-2 text-center text-blue-600 tabular-nums bg-slate-50/50">
                        {data.celkem_m3.toFixed(1)} m³
                      </td>
                      <td className="py-1.5 px-2 text-center text-blue-600 tabular-nums">
                        {data.celkem_pristaveni}×
                      </td>
                      <td className="py-1.5 px-2 text-center text-blue-600 tabular-nums bg-slate-50/50">
                        {data.celkem_hodiny.toFixed(2)} h
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <button
              onClick={addItem}
              className="mt-2 flex items-center gap-1.5 text-xs text-blue-500 hover:bg-blue-500/10 px-2 py-1.5 rounded transition-colors"
            >
              <Plus size={13} /> Přidat konstrukci
            </button>
          </div>

          {/* ── Section 4: Accessories (příslušenství) ── */}
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Příslušenství
            </p>
            {data.accessories.length > 0 && (
              <div className="overflow-x-auto mb-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-color/50 text-text-muted">
                      <th className="text-left py-1.5 px-2 font-medium">Název</th>
                      <th className="text-center py-1.5 px-2 font-medium w-24">Množství</th>
                      <th className="text-center py-1.5 px-2 font-medium w-14">MJ</th>
                      <th className="text-center py-1.5 px-2 font-medium w-24">Kč/MJ</th>
                      <th className="text-right py-1.5 px-2 font-medium w-24 bg-slate-50/50">Celkem Kč</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.accessories.map(a => (
                      <tr key={a.id} className="border-b border-border-color/30 hover:bg-bg-tertiary/20">
                        <td className="py-1 px-2">
                          <input
                            type="text"
                            value={a.nazev}
                            onChange={e => updateAccessory(a.id, { nazev: e.target.value })}
                            className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input
                            type="number" min={0} step={1}
                            value={a.mnozstvi || ''}
                            onChange={e => updateAccessory(a.id, { mnozstvi: parseFloat(e.target.value) || 0 })}
                            className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="py-1 px-2 text-center text-text-muted">{a.unit}</td>
                        <td className="py-1 px-2">
                          <input
                            type="number" min={0} step={10}
                            value={a.czk_per_unit || ''}
                            onChange={e => updateAccessory(a.id, { czk_per_unit: parseFloat(e.target.value) || 0 })}
                            className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="py-1 px-2 text-right font-medium tabular-nums bg-slate-50/50">
                          {a.celkem.toLocaleString('cs-CZ')} Kč
                        </td>
                        <td className="py-1 px-1">
                          <button onClick={() => removeAccessory(a.id)} className="p-1 text-red-400 hover:bg-red-500/10 rounded">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Quick-add buttons from knowledge base */}
            <div className="flex flex-wrap gap-1.5">
              {KB_ACCESSORIES.map(kbA => (
                <button
                  key={kbA.id}
                  onClick={() => addAccessoryFromKb(kbA)}
                  className="text-[11px] px-2 py-1 bg-bg-tertiary hover:bg-blue-500/10 border border-border-color/40 hover:border-blue-400 rounded transition-colors"
                >
                  + {kbA.label_cs} ({kbA.czk_per_unit} Kč/{kbA.unit})
                </button>
              ))}
              <button
                onClick={addCustomAccessory}
                className="text-[11px] px-2 py-1 text-blue-500 hover:bg-blue-500/10 border border-dashed border-blue-400/50 rounded transition-colors flex items-center gap-1"
              >
                <Plus size={11} /> Vlastní
              </button>
            </div>
          </div>

          {/* ── Section 5: Custom surcharges (příplatky) ── */}
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Příplatky
            </p>
            {data.surcharges.length > 0 && (
              <div className="overflow-x-auto mb-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-color/50 text-text-muted">
                      <th className="text-left py-1.5 px-2 font-medium">Název příplatku</th>
                      <th className="text-center py-1.5 px-2 font-medium w-32">Kč/přistavení</th>
                      <th className="text-right py-1.5 px-2 font-medium w-24 bg-slate-50/50">Celkem Kč</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.surcharges.map(s => (
                      <tr key={s.id} className="border-b border-border-color/30 hover:bg-bg-tertiary/20">
                        <td className="py-1 px-2">
                          <input
                            type="text"
                            value={s.nazev}
                            onChange={e => updateSurcharge(s.id, { nazev: e.target.value })}
                            placeholder="Příplatek za víkend…"
                            list="pump-surcharge-hints"
                            className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input
                            type="number" min={0} step={100}
                            value={s.czk_per_pristaveni || ''}
                            onChange={e => updateSurcharge(s.id, { czk_per_pristaveni: parseFloat(e.target.value) || 0 })}
                            className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="py-1 px-2 text-right font-medium tabular-nums bg-slate-50/50">
                          {s.celkem.toLocaleString('cs-CZ')} Kč
                        </td>
                        <td className="py-1 px-1">
                          <button onClick={() => removeSurcharge(s.id)} className="p-1 text-red-400 hover:bg-red-500/10 rounded">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="pump-surcharge-hints">
                  {KB_SURCHARGE_HINTS.map(h => <option key={h} value={h} />)}
                </datalist>
              </div>
            )}
            <button
              onClick={addSurcharge}
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:bg-blue-500/10 px-2 py-1.5 rounded transition-colors"
            >
              <Plus size={13} /> Přidat příplatek
            </button>
          </div>

          {/* ── Section 6: KROS code ── */}
          <label className="flex flex-col gap-1 max-w-xs">
            <span className="text-[11px] text-text-muted font-medium">Kód KROS</span>
            <input
              type="text"
              value={data.kros_kod ?? ''}
              onChange={e => update({ kros_kod: e.target.value })}
              placeholder="napr. 831106…"
              className="bg-bg-secondary/60 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
            />
          </label>

          {/* ── Section 7: Cost breakdown (readonly) ── */}
          {data.konecna_cena > 0 && (
            <div className="bg-bg-tertiary/40 rounded-lg p-3 border border-border-color/40 space-y-1.5">
              <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Výpočet nákladů
              </p>

              {/* Doprava */}
              {data.celkem_doprava > 0 && (
                <div className="flex items-start justify-between text-xs gap-2">
                  <span className="text-text-muted">
                    Doprava ({data.celkem_pristaveni}× přist. × {dopravaPerPristaveni.toLocaleString('cs-CZ')} Kč):
                  </span>
                  <span className="tabular-nums font-medium shrink-0">
                    {data.celkem_doprava.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              )}

              {/* Manipulace */}
              {data.celkem_manipulace > 0 && (
                <div className="flex items-start justify-between text-xs gap-2">
                  <span className="text-text-muted">
                    Manipulace ({data.celkem_hodiny.toFixed(2)} h × {data.manipulace_czk_h.toLocaleString('cs-CZ')} Kč/h):
                  </span>
                  <span className="tabular-nums font-medium shrink-0">
                    {data.celkem_manipulace.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              )}

              {/* Příplatek m³ */}
              {data.celkem_priplatek_m3 > 0 && (
                <div className="flex items-start justify-between text-xs gap-2">
                  <span className="text-text-muted">
                    Příplatek za čerpání ({data.celkem_m3.toFixed(1)} m³ × {data.priplatek_czk_m3} Kč/m³):
                  </span>
                  <span className="tabular-nums font-medium shrink-0">
                    {data.celkem_priplatek_m3.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              )}

              {/* Příslušenství */}
              {data.celkem_prislusenstvi > 0 && data.accessories.map(a => (
                <div key={a.id} className="flex items-start justify-between text-xs gap-2">
                  <span className="text-text-muted">
                    {a.nazev || 'Příslušenství'} ({a.mnozstvi} {a.unit} × {a.czk_per_unit} Kč):
                  </span>
                  <span className="tabular-nums font-medium shrink-0">
                    {a.celkem.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              ))}

              {/* Příplatky */}
              {data.surcharges.map(s => s.celkem > 0 && (
                <div key={s.id} className="flex items-start justify-between text-xs gap-2">
                  <span className="text-text-muted">
                    {s.nazev || 'Příplatek'} ({data.celkem_pristaveni}× × {s.czk_per_pristaveni.toLocaleString('cs-CZ')} Kč):
                  </span>
                  <span className="tabular-nums font-medium shrink-0">
                    {s.celkem.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              ))}

              {/* Total */}
              <div className="border-t border-border-color/40 pt-2 mt-1 flex items-center justify-between">
                <span className="text-sm font-bold text-blue-600">Konečná cena pumpy:</span>
                <span className="text-sm font-bold text-blue-600 tabular-nums">
                  {data.konecna_cena.toLocaleString('cs-CZ')} Kč
                </span>
              </div>
              {data.celkem_m3 > 0 && (
                <div className="text-xs text-text-muted text-right">
                  ({(data.konecna_cena / data.celkem_m3).toFixed(0)} Kč/m³ betonu · {data.celkem_hodiny.toFixed(2)} h celkem)
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
