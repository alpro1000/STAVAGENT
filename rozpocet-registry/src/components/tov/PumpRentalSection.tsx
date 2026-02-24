/**
 * PumpRentalSection Component
 *
 * Calculator for concrete pump (betonočerpadlo) costs embedded in MachineryTab.
 * Shows only for BETON_MONOLIT / BETON_PREFAB positions.
 *
 * Cost structure modelled on Czech supplier offers (betonárka):
 *   1. Doprava pumpy   = počet přistavení × Kč/přistavení
 *   2. Čerpání betonu  = charged_m³ × Kč/m³  (min. objem per přistavení applies)
 *   3. Příplatky       = user-defined per-přistavení surcharges
 *   ─────────────────────────────────
 *   Konečná cena       = (1) + (2) + (3)
 *
 * Přistavení logic:
 *   - Each construction element defines how many times the pump is mobilised.
 *   - For each element: charged_m3 = max(objem/přistavení, min_objem) × přistavení
 *   - This correctly handles small pours that still trigger the minimum charge.
 */

import { useState } from 'react';
import { Plus, Trash2, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import type { PumpRentalData, PumpConstructionItem, PumpSurcharge } from '../../types/unified';
import { v4 as uuidv4 } from 'uuid';

interface PumpRentalSectionProps {
  pumpRental: PumpRentalData | undefined;
  onChange: (data: PumpRentalData) => void;
  itemQuantity?: number | null; // hint for initial volume
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_DATA: PumpRentalData = {
  items: [],
  doprava_czk_pristaveni: 4500,
  cerpani_czk_m3: 250,
  min_objem_m3: 15,
  surcharges: [],
  kros_kod: '',
  celkem_m3: 0,
  celkem_pristaveni: 0,
  celkem_doprava: 0,
  celkem_cerpani: 0,
  celkem_priplatky: 0,
  konecna_cena: 0,
};

function makeItem(nazev = '', objem = 0, takty = 1, pristaveni = 1): PumpConstructionItem {
  return {
    id: uuidv4(),
    nazev,
    objem_m3_takt: objem,
    pocet_taktu: takty,
    pocet_pristaveni: pristaveni,
    celkem_m3: objem * takty,
  };
}

// ─── Pure computation ────────────────────────────────────────────────────────

function computePumpTotals(
  items: PumpConstructionItem[],
  doprava: number,
  cerpani: number,
  minObjem: number,
  surcharges: PumpSurcharge[],
): Pick<
  PumpRentalData,
  | 'celkem_m3'
  | 'celkem_pristaveni'
  | 'celkem_doprava'
  | 'celkem_cerpani'
  | 'celkem_priplatky'
  | 'konecna_cena'
> & { surcharges: PumpSurcharge[] } {
  const celkem_m3 = items.reduce((s, i) => s + i.celkem_m3, 0);
  const celkem_pristaveni = items.reduce((s, i) => s + i.pocet_pristaveni, 0);

  const celkem_doprava = celkem_pristaveni * doprava;

  // Per-item minimum volume calculation
  let charged_m3 = 0;
  for (const item of items) {
    if (item.pocet_pristaveni <= 0) continue;
    const vol_per = item.pocet_pristaveni > 0 ? item.celkem_m3 / item.pocet_pristaveni : 0;
    charged_m3 += Math.max(vol_per, minObjem) * item.pocet_pristaveni;
  }
  const celkem_cerpani = charged_m3 * cerpani;

  const updatedSurcharges = surcharges.map(s => ({
    ...s,
    celkem: s.czk_per_pristaveni * celkem_pristaveni,
  }));
  const celkem_priplatky = updatedSurcharges.reduce((s, x) => s + x.celkem, 0);

  const konecna_cena = celkem_doprava + celkem_cerpani + celkem_priplatky;

  return {
    celkem_m3,
    celkem_pristaveni,
    celkem_doprava,
    celkem_cerpani,
    celkem_priplatky,
    konecna_cena,
    surcharges: updatedSurcharges,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PumpRentalSection({ pumpRental, onChange, itemQuantity }: PumpRentalSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const data = pumpRental ?? DEFAULT_DATA;

  // Helper: update data and recompute all totals
  const update = (patch: Partial<PumpRentalData>) => {
    const merged = { ...data, ...patch };
    const computed = computePumpTotals(
      merged.items,
      merged.doprava_czk_pristaveni,
      merged.cerpani_czk_m3,
      merged.min_objem_m3,
      merged.surcharges,
    );
    onChange({ ...merged, ...computed });
  };

  // ── Item helpers ──────────────────────────────────────────────────────────

  const addItem = () => {
    const vol = data.items.length === 0 && itemQuantity ? Number(itemQuantity) : 0;
    update({ items: [...data.items, makeItem('', vol, 1, 1)] });
  };

  const updateItem = (id: string, patch: Partial<PumpConstructionItem>) => {
    const items = data.items.map(item => {
      if (item.id !== id) return item;
      const u = { ...item, ...patch };
      u.celkem_m3 = u.objem_m3_takt * u.pocet_taktu;
      return u;
    });
    update({ items });
  };

  const removeItem = (id: string) => {
    update({ items: data.items.filter(i => i.id !== id) });
  };

  // ── Surcharge helpers ─────────────────────────────────────────────────────

  const addSurcharge = () => {
    const s: PumpSurcharge = {
      id: uuidv4(),
      nazev: '',
      czk_per_pristaveni: 0,
      celkem: 0,
    };
    update({ surcharges: [...data.surcharges, s] });
  };

  const updateSurcharge = (id: string, patch: Partial<PumpSurcharge>) => {
    update({ surcharges: data.surcharges.map(s => (s.id === id ? { ...s, ...patch } : s)) });
  };

  const removeSurcharge = (id: string) => {
    update({ surcharges: data.surcharges.filter(s => s.id !== id) });
  };

  // ── Computed display ──────────────────────────────────────────────────────

  const chargedM3 = data.items.reduce((acc, item) => {
    if (item.pocet_pristaveni <= 0) return acc;
    const vol_per = item.celkem_m3 / item.pocet_pristaveni;
    return acc + Math.max(vol_per, data.min_objem_m3) * item.pocet_pristaveni;
  }, 0);
  const minApplied = chargedM3 > data.celkem_m3;

  const hasData =
    data.items.length > 0 ||
    data.surcharges.length > 0 ||
    data.konecna_cena > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-6 border border-blue-500/30 rounded-lg bg-blue-500/5">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-blue-500/10 rounded-t-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-blue-500 shrink-0" />
          <span className="text-sm font-semibold text-blue-600">
            Kalkulátor betonočerpadla
          </span>
          {hasData && !isExpanded && (
            <span className="text-xs text-blue-500 font-mono ml-2">
              {data.konecna_cena.toLocaleString('cs-CZ')} Kč
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-blue-400" />
        ) : (
          <ChevronDown size={16} className="text-blue-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-5">

          {/* ── Section 1: Construction elements ── */}
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Betonované konstrukce
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-color/50">
                    <th className="text-left py-1.5 px-2 font-medium text-text-muted min-w-[160px]">
                      Název konstrukce
                    </th>
                    <th className="text-center py-1.5 px-2 font-medium text-text-muted w-24">
                      m³/takt
                    </th>
                    <th className="text-center py-1.5 px-2 font-medium text-text-muted w-20">
                      Taktů
                    </th>
                    <th className="text-center py-1.5 px-2 font-medium text-text-muted w-24 bg-slate-50/50">
                      Celkem m³
                    </th>
                    <th className="text-center py-1.5 px-2 font-medium text-text-muted w-28">
                      Přistavení
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(item => (
                    <tr
                      key={item.id}
                      className="border-b border-border-color/30 hover:bg-bg-tertiary/20"
                    >
                      {/* Název */}
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={item.nazev}
                          onChange={e => updateItem(item.id, { nazev: e.target.value })}
                          placeholder="Betonáž základů…"
                          className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5 text-xs"
                        />
                      </td>
                      {/* m³/takt */}
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={item.objem_m3_takt || ''}
                          onChange={e =>
                            updateItem(item.id, { objem_m3_takt: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs"
                        />
                      </td>
                      {/* Taktů */}
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={item.pocet_taktu}
                          onChange={e =>
                            updateItem(item.id, { pocet_taktu: parseInt(e.target.value) || 1 })
                          }
                          className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs"
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
                            type="number"
                            min={1}
                            step={1}
                            value={item.pocet_pristaveni}
                            onChange={e =>
                              updateItem(item.id, {
                                pocet_pristaveni: parseInt(e.target.value) || 1,
                              })
                            }
                            className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs"
                          />
                          {item.pocet_pristaveni > 0 && item.celkem_m3 > 0 && (
                            <span className="text-[10px] text-text-muted tabular-nums">
                              {(item.celkem_m3 / item.pocet_pristaveni).toFixed(1)} m³/přist.
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Delete */}
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
                    <tr className="bg-bg-tertiary/30 font-semibold">
                      <td colSpan={3} className="py-1.5 px-2 text-right text-xs text-text-secondary">
                        Celkem:
                      </td>
                      <td className="py-1.5 px-2 text-center text-blue-600 tabular-nums text-xs">
                        {data.celkem_m3.toFixed(1)} m³
                      </td>
                      <td className="py-1.5 px-2 text-center text-blue-600 tabular-nums text-xs">
                        {data.celkem_pristaveni}×
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
              <Plus size={13} />
              Přidat konstrukci
            </button>
          </div>

          {/* ── Section 2: Pump offer parameters ── */}
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Nabídka pumpy
            </p>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-text-muted">Doprava (Kč/přistavení)</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={data.doprava_czk_pristaveni}
                  onChange={e =>
                    update({ doprava_czk_pristaveni: parseFloat(e.target.value) || 0 })
                  }
                  className="bg-bg-secondary/60 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 text-center tabular-nums"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-text-muted">Čerpání (Kč/m³)</span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={data.cerpani_czk_m3}
                  onChange={e => update({ cerpani_czk_m3: parseFloat(e.target.value) || 0 })}
                  className="bg-bg-secondary/60 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 text-center tabular-nums"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-text-muted">Min. objem (m³/přist.)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={data.min_objem_m3}
                  onChange={e => update({ min_objem_m3: parseFloat(e.target.value) || 0 })}
                  className="bg-bg-secondary/60 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 text-center tabular-nums"
                />
              </label>
            </div>
          </div>

          {/* ── Section 3: Surcharges (příplatky) ── */}
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Příplatky
            </p>
            {data.surcharges.length > 0 && (
              <div className="overflow-x-auto mb-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-color/50">
                      <th className="text-left py-1.5 px-2 font-medium text-text-muted">
                        Název příplatku
                      </th>
                      <th className="text-center py-1.5 px-2 font-medium text-text-muted w-32">
                        Kč/přistavení
                      </th>
                      <th className="text-right py-1.5 px-2 font-medium text-text-muted w-28 bg-slate-50/50">
                        Celkem Kč
                      </th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.surcharges.map(s => (
                      <tr
                        key={s.id}
                        className="border-b border-border-color/30 hover:bg-bg-tertiary/20"
                      >
                        <td className="py-1 px-2">
                          <input
                            type="text"
                            value={s.nazev}
                            onChange={e => updateSurcharge(s.id, { nazev: e.target.value })}
                            placeholder="Čištění pumpy…"
                            className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                            list="pump-surcharge-hints"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={s.czk_per_pristaveni || ''}
                            onChange={e =>
                              updateSurcharge(s.id, {
                                czk_per_pristaveni: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full text-center bg-bg-secondary/60 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="py-1 px-2 text-right font-medium tabular-nums bg-slate-50/50">
                          {s.celkem.toLocaleString('cs-CZ')} Kč
                        </td>
                        <td className="py-1 px-1">
                          <button
                            onClick={() => removeSurcharge(s.id)}
                            className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="pump-surcharge-hints">
                  <option value="Čištění pumpy" />
                  <option value="Příplatek za vzdálenost" />
                  <option value="Příplatek za víkend" />
                  <option value="Příplatek za noční provoz" />
                  <option value="Příplatek za čekání" />
                  <option value="Příplatek za výšku čerpání" />
                </datalist>
              </div>
            )}
            <button
              onClick={addSurcharge}
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:bg-blue-500/10 px-2 py-1.5 rounded transition-colors"
            >
              <Plus size={13} />
              Přidat příplatek
            </button>
          </div>

          {/* ── Section 4: KROS code ── */}
          <div>
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
          </div>

          {/* ── Section 5: Cost breakdown (readonly) ── */}
          {(data.celkem_pristaveni > 0 || data.konecna_cena > 0) && (
            <div className="bg-bg-tertiary/40 rounded-lg p-3 border border-border-color/40 space-y-1.5">
              <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Výpočet nákladů
              </p>

              {/* Doprava */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">
                  Doprava pumpy ({data.celkem_pristaveni}× přistavení × {data.doprava_czk_pristaveni.toLocaleString('cs-CZ')} Kč):
                </span>
                <span className="tabular-nums font-medium">
                  {data.celkem_doprava.toLocaleString('cs-CZ')} Kč
                </span>
              </div>

              {/* Čerpání */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">
                  Čerpání betonu ({chargedM3.toFixed(1)} m³
                  {minApplied && (
                    <span className="text-amber-600 ml-1">
                      ↑ min {data.min_objem_m3} m³/přist. uplatněno
                    </span>
                  )}
                  {' '}× {data.cerpani_czk_m3} Kč/m³):
                </span>
                <span className="tabular-nums font-medium">
                  {data.celkem_cerpani.toLocaleString('cs-CZ')} Kč
                </span>
              </div>

              {/* Surcharges */}
              {data.surcharges.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">
                    {s.nazev || 'Příplatek'} ({data.celkem_pristaveni}× {s.czk_per_pristaveni.toLocaleString('cs-CZ')} Kč):
                  </span>
                  <span className="tabular-nums font-medium">
                    {s.celkem.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              ))}

              {/* Divider + Total */}
              <div className="border-t border-border-color/40 pt-2 mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-blue-600">Konečná cena pumpy:</span>
                <span className="text-sm font-bold text-blue-600 tabular-nums">
                  {data.konecna_cena.toLocaleString('cs-CZ')} Kč
                </span>
              </div>

              {/* Per m³ */}
              {data.celkem_m3 > 0 && (
                <div className="text-xs text-text-muted text-right">
                  ({(data.konecna_cena / data.celkem_m3).toFixed(0)} Kč/m³ betonu)
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
