/**
 * FormworkRentalSection
 *
 * Tabuľka nájmu bednění — vložená sekce v záložce "Materiály" TOV modalu.
 * Zobrazuje se pouze pro pozice skupiny BEDNENI.
 *
 * Struktura sloupců (shodná s uživatelskou tabulkou):
 * Konstrukce | Celkem m2 | Sada m2 | Taktů | Sad | Dní/takt | Doba bedn. |
 * Beton/takt | Celkem beton | Celková doba | Měs.nájem/sada | Konečný nájem |
 * Systém | Výška | Kč/m2 | KROS popis
 *
 * Výpočtové vzorce (ověřeno na datech uživatele):
 *   takt_per_set   = pocet_taktu / pocet_sad
 *   doba_bedneni   = takt_per_set × dni_na_takt
 *   celkem_beton   = takt_per_set × dni_beton_takt
 *   celkova_doba   = doba_bedneni + celkem_beton
 *   mesicni_sada   = sada_m2 × mesicni_najem_jednotka
 *   konecny_najem  = mesicni_sada × (celkova_doba / 30) × pocet_sad
 */

import { Plus, Trash2, ArrowDownToLine } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { FormworkRentalRow } from '../../types/unified';
import type { MaterialResource } from '../../types/unified';
import formworkKnowledge from '../../data/formwork_knowledge.json';

// ─── Knowledge base: formwork systems (loaded from formwork_knowledge.json) ──

interface BedniSystem {
  id: string;
  label: string;         // Display name in dropdown
  system: string;        // bednici_system value
  rozmery: string;       // rozmery / výška
  jednotka: number;      // Kč/m²/měsíc
}

// Derive dropdown options from JSON knowledge base (single source of truth)
const BEDNI_SYSTEMS: BedniSystem[] = [
  ...formworkKnowledge.systems.map(s => ({
    id: s.id,
    label: s.label_cs,
    system: s.system_name,
    rozmery: s.variant,
    jednotka: s.rental_czk_m2_month,
  })),
  { id: 'custom', label: '— Vlastní systém —', system: '', rozmery: '', jednotka: 0.00 },
];

// ─── Computation helpers ───────────────────────────────────────────────────

/** Auto-generate KROS popis from row data */
export function generateKrosPopis(r: FormworkRentalRow): string {
  const mesicni = r.sada_m2 * r.mesicni_najem_jednotka;
  return `Bednění - ${r.construction_name} (${r.bednici_system}${r.rozmery ? ' ' + r.rozmery : ''}; ${r.mesicni_najem_jednotka.toFixed(2)} Kč/m2) sada - ${r.sada_m2.toFixed(2)} m2 => ${mesicni.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč/sada/měsíc`;
}

function computeRow(r: FormworkRentalRow): FormworkRentalRow {
  // Auto-derive tacts from area ratio when auto_taktu=true:
  //   pocet_taktu = ⌈celkem_m2 / sada_m2⌉
  // With pocet_sad > 1 (šachmatný postup), takt_per_set halves → duration halves
  // but rental cost stays the same (more sets × less time = same Kč).
  const pocet_taktu = r.auto_taktu === true && r.sada_m2 > 0
    ? Math.ceil(r.celkem_m2 / r.sada_m2)
    : r.pocet_taktu;

  const takt_per_set = r.pocet_sad > 0 ? pocet_taktu / r.pocet_sad : pocet_taktu;
  const doba_bedneni  = Math.round(takt_per_set * r.dni_na_takt * 1000) / 1000;
  const celkem_beton  = Math.round(takt_per_set * r.dni_beton_takt * 1000) / 1000;
  const celkova_doba  = Math.round((doba_bedneni + celkem_beton) * 1000) / 1000;
  const mesicni_najem_sada = Math.round(r.sada_m2 * r.mesicni_najem_jednotka * 100) / 100;
  const konecny_najem = Math.round(mesicni_najem_sada * (celkova_doba / 30) * r.pocet_sad * 100) / 100;

  // Preserve user-edited kros_popis; auto-generate only when empty
  const kros_popis = r.kros_popis || generateKrosPopis({ ...r, mesicni_najem_sada });

  return { ...r, pocet_taktu, doba_bedneni, celkem_beton, celkova_doba, mesicni_najem_sada, konecny_najem, kros_popis };
}

function makeEmptyRow(constructionName?: string, totalM2?: number): FormworkRentalRow {
  const area = totalM2 ?? 0;
  const sys = BEDNI_SYSTEMS[0];
  const raw: FormworkRentalRow = {
    id: uuidv4(),
    construction_name: constructionName ?? '',
    celkem_m2:  area,
    sada_m2:    area,       // Default: 1 set covers full area → 1 tact auto-derived
    pocet_taktu: 1,
    auto_taktu:  true,      // New rows use auto-derivation by default
    pocet_sad:   1,
    dni_na_takt: 3,
    dni_beton_takt: 5,
    doba_bedneni: 0,
    celkem_beton: 0,
    celkova_doba: 0,
    bednici_system: sys.system,
    rozmery:    sys.rozmery,
    mesicni_najem_jednotka: sys.jednotka,
    mesicni_najem_sada: 0,
    konecny_najem: 0,
    kros_popis: '',
  };
  return computeRow(raw);
}

// ─── Cell helpers ──────────────────────────────────────────────────────────

const cellInput = 'w-full text-right bg-white border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums';
const cellReadonly = 'w-full text-right bg-slate-50 rounded px-1 py-0.5 text-xs tabular-nums text-slate-600 select-all cursor-default';
const thCell = 'px-2 py-1.5 text-xs font-medium text-slate-500 text-center border-b border-slate-200 bg-slate-50 whitespace-nowrap';
const tdCell = 'px-1 py-1 border-b border-slate-100 align-middle';

// ─── Props ────────────────────────────────────────────────────────────────

interface FormworkRentalSectionProps {
  rows: FormworkRentalRow[];
  onChange: (rows: FormworkRentalRow[]) => void;
  itemPopis?: string;          // Pre-fill construction_name
  itemMnozstvi?: number | null; // Pre-fill celkem_m2
  onAddToMaterials: (resource: MaterialResource) => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export function FormworkRentalSection({
  rows,
  onChange,
  itemPopis,
  itemMnozstvi,
  onAddToMaterials,
}: FormworkRentalSectionProps) {
  const addRow = () => {
    const name = rows.length === 0 ? (itemPopis ?? '') : '';
    const area = rows.length === 0 ? (itemMnozstvi ?? 0) : 0;
    onChange([...rows, makeEmptyRow(name, area)]);
  };

  const removeRow = (id: string) => {
    onChange(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, patch: Partial<FormworkRentalRow>) => {
    onChange(
      rows.map(r => {
        if (r.id !== id) return r;
        return computeRow({ ...r, ...patch });
      })
    );
  };

  const handleSystemChange = (id: string, sysId: string) => {
    const sys = BEDNI_SYSTEMS.find(s => s.id === sysId) ?? BEDNI_SYSTEMS[BEDNI_SYSTEMS.length - 1];
    updateRow(id, {
      bednici_system: sys.system,
      rozmery: sys.rozmery,
      mesicni_najem_jednotka: sys.jednotka,
    });
  };

  const addRowToMaterials = (row: FormworkRentalRow) => {
    onAddToMaterials({
      id: uuidv4(),
      name: row.kros_popis ?? `Bednění - ${row.construction_name}`,
      unit: 'kpl',
      quantity: 1,
      unitPrice: row.konecny_najem,
      totalCost: row.konecny_najem,
      linkedCalcType: 'future_material_calc',
    });
  };

  const totalRental = rows.reduce((s, r) => s + r.konecny_najem, 0);

  if (rows.length === 0) {
    return (
      <div className="mt-4 border border-dashed border-blue-300 rounded-lg p-4 bg-blue-50/40">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">Nájem bednění (Rozpis zdrojů)</p>
            <p className="text-xs text-blue-500 mt-0.5">Přidejte řádky pro každý konstrukční prvek</p>
          </div>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            Přidat řádek
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          Nájem bednění — Rozpis zdrojů
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            Celkem: <strong className="text-blue-700">{totalRental.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč</strong>
          </span>
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
          >
            <Plus size={12} />
            Přidat
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-slate-200 shadow-sm">
        <table className="w-max min-w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={`${thCell} text-left min-w-[140px]`}>Konstrukce</th>
              <th className={`${thCell} min-w-[70px]`}>Celkem<br/>m2</th>
              <th className={`${thCell} min-w-[70px]`}>Sada<br/>m2</th>
              <th className={`${thCell} min-w-[60px]`} title="Počet přestavení sady. Auto = ⌈Celkem m2 ÷ Sada m2⌉">Taktů<br/><span className="text-[9px] font-normal text-blue-400">⌈m2÷sada⌉</span></th>
              <th className={`${thCell} min-w-[45px]`} title="Počet sad (šachmatný postup: 2 sady → doba × 0.5)">Sad<br/>kus</th>
              <th className={`${thCell} min-w-[55px]`}>Dní/<br/>takt</th>
              <th className={`${thCell} min-w-[65px] bg-slate-100`}>Doba<br/>bedn. d</th>
              <th className={`${thCell} min-w-[65px]`}>Beton<br/>/takt d</th>
              <th className={`${thCell} min-w-[70px] bg-slate-100`}>Celkem<br/>beton d</th>
              <th className={`${thCell} min-w-[65px] bg-slate-100`}>Celk.<br/>doba d</th>
              <th className={`${thCell} min-w-[150px]`}>Systém bednění</th>
              <th className={`${thCell} min-w-[110px]`}>Výška / rozm.</th>
              <th className={`${thCell} min-w-[70px]`}>Kč/m2<br/>měsíc</th>
              <th className={`${thCell} min-w-[90px] bg-slate-100`}>Měs. nájem<br/>sada Kč</th>
              <th className={`${thCell} min-w-[95px] bg-blue-50`}>Konečný<br/>nájem Kč</th>
              <th className={`${thCell} min-w-[90px]`}>Kód KROS</th>
              <th className={`${thCell} min-w-[220px]`}>Popis KROS</th>
              <th className={`${thCell} min-w-[30px]`}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <>
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Konstrukce */}
                  <td className={tdCell}>
                    <input
                      type="text"
                      value={row.construction_name}
                      onChange={e => updateRow(row.id, { construction_name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Název prvku"
                    />
                  </td>
                  {/* Celkem m2 */}
                  <td className={tdCell}>
                    <input type="number" min="0" step="0.01" value={row.celkem_m2}
                      onChange={e => updateRow(row.id, { celkem_m2: parseFloat(e.target.value) || 0 })}
                      className={cellInput} />
                  </td>
                  {/* Sada m2 */}
                  <td className={tdCell}>
                    <input type="number" min="0" step="0.01" value={row.sada_m2}
                      onChange={e => updateRow(row.id, { sada_m2: parseFloat(e.target.value) || 0 })}
                      className={cellInput} />
                  </td>
                  {/* Taktů — Auto mode: ⌈celkem_m2/sada_m2⌉, or manual override */}
                  <td className={tdCell}>
                    {row.auto_taktu ? (
                      <div>
                        <div
                          className="w-full text-right bg-blue-50 border border-blue-200 rounded px-1 py-0.5 text-xs tabular-nums text-blue-700 font-medium select-all cursor-default"
                          title={`Auto: ⌈${row.celkem_m2} ÷ ${row.sada_m2}⌉ = ${row.pocet_taktu}`}
                        >
                          {row.pocet_taktu}
                        </div>
                        <button
                          onClick={() => updateRow(row.id, { auto_taktu: false })}
                          className="text-[9px] text-blue-400 hover:text-blue-600 text-right w-full block leading-tight mt-0.5"
                          title="Klikněte pro ruční zadání počtu taktů"
                        >
                          ∑ Auto ✎
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="number" min="1" step="1" value={row.pocet_taktu}
                          onChange={e => updateRow(row.id, { pocet_taktu: parseFloat(e.target.value) || 1 })}
                          className={cellInput}
                        />
                        {row.sada_m2 > 0 && (
                          <button
                            onClick={() => updateRow(row.id, { auto_taktu: true })}
                            className="text-[9px] text-blue-400 hover:text-blue-600 text-right w-full block leading-tight mt-0.5"
                            title={`Automaticky: ⌈${row.celkem_m2} ÷ ${row.sada_m2}⌉ = ${Math.ceil(row.celkem_m2 / row.sada_m2)}`}
                          >
                            ∑ {Math.ceil(row.celkem_m2 / row.sada_m2)} → Auto
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  {/* Sad */}
                  <td className={tdCell}>
                    <input type="number" min="1" step="1" value={row.pocet_sad}
                      onChange={e => updateRow(row.id, { pocet_sad: parseFloat(e.target.value) || 1 })}
                      className={cellInput} />
                  </td>
                  {/* Dní/takt */}
                  <td className={tdCell}>
                    <input type="number" min="0" step="0.5" value={row.dni_na_takt}
                      onChange={e => updateRow(row.id, { dni_na_takt: parseFloat(e.target.value) || 0 })}
                      className={cellInput} />
                  </td>
                  {/* Doba bednění (computed) */}
                  <td className={`${tdCell} bg-slate-50`}>
                    <div className={cellReadonly}>{row.doba_bedneni.toFixed(3).replace(/\.?0+$/, '')}</div>
                  </td>
                  {/* Beton/takt */}
                  <td className={tdCell}>
                    <input type="number" min="0" step="0.5" value={row.dni_beton_takt}
                      onChange={e => updateRow(row.id, { dni_beton_takt: parseFloat(e.target.value) || 0 })}
                      className={cellInput} />
                  </td>
                  {/* Celkem beton (computed) */}
                  <td className={`${tdCell} bg-slate-50`}>
                    <div className={cellReadonly}>{row.celkem_beton.toFixed(3).replace(/\.?0+$/, '')}</div>
                  </td>
                  {/* Celková doba (computed) */}
                  <td className={`${tdCell} bg-slate-50`}>
                    <div className={cellReadonly}>{row.celkova_doba.toFixed(3).replace(/\.?0+$/, '')}</div>
                  </td>
                  {/* Systém — dropdown */}
                  <td className={tdCell}>
                    <select
                      value={BEDNI_SYSTEMS.find(s => s.system === row.bednici_system && s.rozmery === row.rozmery)?.id ?? 'custom'}
                      onChange={e => handleSystemChange(row.id, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      {BEDNI_SYSTEMS.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  {/* Výška */}
                  <td className={tdCell}>
                    <input type="text" value={row.rozmery}
                      onChange={e => updateRow(row.id, { rozmery: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="h= 0,9 m" />
                  </td>
                  {/* Kč/m2 */}
                  <td className={tdCell}>
                    <input type="number" min="0" step="0.01" value={row.mesicni_najem_jednotka}
                      onChange={e => updateRow(row.id, { mesicni_najem_jednotka: parseFloat(e.target.value) || 0 })}
                      className={cellInput} />
                  </td>
                  {/* Měsíční nájem/sada (computed) */}
                  <td className={`${tdCell} bg-slate-50`}>
                    <div className={cellReadonly}>
                      {row.mesicni_najem_sada.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </td>
                  {/* Konečný nájem (computed) */}
                  <td className={`${tdCell} bg-blue-50`}>
                    <div className="w-full text-right font-semibold text-xs text-blue-700 tabular-nums px-1 py-0.5">
                      {row.konecny_najem.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </td>
                  {/* Kód KROS */}
                  <td className={tdCell}>
                    <input
                      type="text"
                      value={row.kros_kod ?? ''}
                      onChange={e => updateRow(row.id, { kros_kod: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                      placeholder="bed_zakl_202"
                    />
                  </td>
                  {/* Popis KROS */}
                  <td className={tdCell}>
                    <input
                      type="text"
                      value={row.kros_popis ?? ''}
                      onChange={e => updateRow(row.id, { kros_popis: e.target.value })}
                      onFocus={e => {
                        // Auto-generate if empty
                        if (!row.kros_popis) {
                          updateRow(row.id, { kros_popis: generateKrosPopis(row) });
                          setTimeout(() => (e.target as HTMLInputElement).select(), 10);
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Auto-generated popis (klikněte pro editaci)"
                    />
                  </td>
                  {/* Actions */}
                  <td className={`${tdCell} text-center`}>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => addRowToMaterials(row)}
                        title="Přidat do Materiálů jako MaterialResource"
                        className="p-0.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                      >
                        <ArrowDownToLine size={13} />
                      </button>
                      <button
                        onClick={() => removeRow(row.id)}
                        title="Odstranit řádek"
                        className="p-0.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Remove the kros sub-row since kros_popis is now inline */}
              </>
            ))}
          </tbody>
          {/* Totals footer */}
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td colSpan={16} className="px-2 py-1.5 text-right text-xs font-medium text-blue-700">
                Celkem nájem bednění:
              </td>
              <td className="px-1 py-1.5 text-right text-sm font-bold text-blue-800 tabular-nums">
                {totalRental.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add all to materials */}
      {rows.length > 0 && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-slate-400 italic">
            Takty Auto = ⌈Celkem m2 ÷ Sada m2⌉. Šachmatný postup: 2 sady zkrátí dobu 2×, ale cena zůstane stejná. Klikněte na ↓ pro přidání do Materiálů:
          </p>
          <button
            onClick={() => rows.forEach(row => addRowToMaterials(row))}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-green-700 border border-green-400 rounded hover:bg-green-50 transition-colors"
          >
            <ArrowDownToLine size={12} />
            Přidat vše do Materiálů
          </button>
        </div>
      )}
    </div>
  );
}
