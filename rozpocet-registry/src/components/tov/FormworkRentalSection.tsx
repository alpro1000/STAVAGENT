/**
 * FormworkRentalSection
 *
 * Tabuľka nájmu bednění — vložená sekce v záložce "Materiály" TOV modalu.
 * Zobrazuje se pouze pro pozice skupiny BEDNENI.
 *
 * Struktura sloupců:
 * Konstrukce | Celkem m2 | Sada m2 | Taktů | Sad | Dní/takt | Dem.d |
 * Doba bedn. | Beton/takt | Celkem beton | Celková doba |
 * Systém | Výška | Kč/m2 | Měs.nájem/sada | Ztracené díly | Konečný nájem | KROS popis
 *
 * Výpočtové vzorce (rev. 2.2 — Doka nabídka č. 540044877, leden 2026):
 *   pocet_taktu    = ⌈celkem_m2 / sada_m2⌉  (auto) nebo ručně
 *   takt_per_set   = pocet_taktu / pocet_sad
 *   doba_bedneni   = takt_per_set × dni_na_takt        (montáž per sada)
 *   celkem_beton   = takt_per_set × dni_beton_takt     (zrání per sada)
 *   celkova_doba   = doba_bedneni + celkem_beton + dni_demontaz  (+ fin. demontáž)
 *   mesicni_sada   = sada_m2 × mesicni_najem_jednotka
 *   najem_naklady  = mesicni_sada × MAX(1, celkova_doba/30) × pocet_sad
 *                                   ↑ min. 1 měsíc (standard DOKA/PERI/MEVA)
 *   podil_koupe    = ztracené díly (kotevní díly, expreskotvy, Doka-trenn, desky) [Kč]
 *                    — editovatelné, předvyplněno z podil_koupe_m2_typical × sada_m2
 *   konecny_najem  = najem_naklady + podil_koupe
 *
 * DŮLEŽITÉ: Cena nájmu NEZAHRNUJE dopravu, montáž ani DPH!
 */

import { useState } from 'react';
import { Plus, Trash2, ArrowDownToLine, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { FormworkRentalRow } from '../../types/unified';
import type { MaterialResource } from '../../types/unified';
import formworkKnowledge from '../../data/formwork_knowledge.json';
import { FormworkAIModal } from './FormworkAIModal';

// ─── Knowledge base: formwork systems (loaded from formwork_knowledge.json) ──

interface BedniSystem {
  id: string;
  label: string;         // Display name in dropdown
  system: string;        // bednici_system value
  rozmery: string;       // rozmery / výška
  jednotka: number;      // Kč/m²/měsíc
  podil_koupe_m2: number; // Typical purchase share of lost items [Kč/m²] (Doka offer 540044877)
}

// Derive dropdown options from JSON knowledge base (single source of truth)
const BEDNI_SYSTEMS: BedniSystem[] = [
  ...formworkKnowledge.systems.map(s => ({
    id: s.id,
    label: s.label_cs,
    system: s.system_name,
    rozmery: s.variant,
    jednotka: s.rental_czk_m2_month,
    podil_koupe_m2: (s as unknown as { podil_koupe_m2_typical?: number }).podil_koupe_m2_typical ?? 0,
  })),
  { id: 'custom', label: '— Vlastní systém —', system: '', rozmery: '', jednotka: 0.00, podil_koupe_m2: 0 },
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
  // With pocet_sad > 1 (šachmatný postup), takt_per_set halves → calendar duration halves.
  const pocet_taktu = r.auto_taktu === true && r.sada_m2 > 0
    ? Math.ceil(r.celkem_m2 / r.sada_m2)
    : r.pocet_taktu;

  // takt_per_set = how many tacts each set must do (can be fractional when not evenly divisible)
  const takt_per_set = r.pocet_sad > 0 ? pocet_taktu / r.pocet_sad : pocet_taktu;

  // Assembly time (montáž) and curing time (zrání) per set
  const doba_bedneni = Math.round(takt_per_set * r.dni_na_takt * 1000) / 1000;
  const celkem_beton = Math.round(takt_per_set * r.dni_beton_takt * 1000) / 1000;

  // dni_demontaz = final stripping of last takt (ČSN EN 13670 §8.5).
  // Intermediate re-stripping is implicitly part of mobilization before next takt.
  // Default 1 day; backward-compat: treat missing field as 1.
  const dni_demontaz = r.dni_demontaz ?? 1;

  // celkova_doba = total calendar duration incl. final dismantling
  const celkova_doba = Math.round((doba_bedneni + celkem_beton + dni_demontaz) * 1000) / 1000;

  const mesicni_najem_sada = Math.round(r.sada_m2 * r.mesicni_najem_jednotka * 100) / 100;

  // Minimum billing = 1 full month — industry standard for DOKA / PERI / MEVA.
  // Without this, short projects (1 takt, 9 days) are underestimated by 3×.
  const billing_months = Math.max(1, celkova_doba / 30);
  // najem_naklady = pure rental cost (nájemné)
  const najem_naklady = Math.round(mesicni_najem_sada * billing_months * r.pocet_sad * 100) / 100;
  // podil_koupe = one-time purchase of lost items (Doka: kotevní díly ztracené, expreskotvy, doka-trenn, desky)
  // Backward-compat: old rows from localStorage may not have this field yet → treat as 0.
  const podil_koupe = r.podil_koupe ?? 0;
  // konecny_najem = total = rental + purchase of lost items
  const konecny_najem = Math.round((najem_naklady + podil_koupe) * 100) / 100;

  // Preserve user-edited kros_popis; auto-generate only when empty
  const kros_popis = r.kros_popis || generateKrosPopis({ ...r, mesicni_najem_sada });

  return { ...r, pocet_taktu, dni_demontaz, doba_bedneni, celkem_beton, celkova_doba, mesicni_najem_sada, najem_naklady, podil_koupe, konecny_najem, kros_popis };
}

// Curing-time presets by element type (ČSN EN 13670, at +20°C).
// dni_beton_takt recommendation: minimum time before formwork stripping.
// Multiply by 2 at +10°C, ×3 at +5°C, ×4 at 0°C (frost protection required).
export const CURING_PRESETS = [
  { id: 'zakl',    label: 'Základy, čela (1–2 d)',         dni: 2,  note: 'Boční bednění základových desek a čel. Beton dosáhne 50 % pevnosti za ~24–48 h.' },
  { id: 'stena',   label: 'Stěny, opěry, opěrné zdi (5 d)',dni: 5,  note: 'Standardní případ mostních opěr a stěn. ČSN EN 13670 §8.5 — min. 70 % fck.' },
  { id: 'pilir',   label: 'Pilíře, masivní prvky (7 d)',   dni: 7,  note: 'Masivní opěry, mostní pilíře. Tepelný gradient > 20 K → prodlužte.' },
  { id: 'strop',   label: 'Stropní desky — spodní (21 d)', dni: 21, note: 'Nosné spodní bednění desek. Nesmí se odstranit do dosažení 70 % fck nosné kce.' },
  { id: 'mostovka',label: 'Mostovka (28 d)',               dni: 28, note: 'Mostovkové desky mostů. Dle TP 102 min. 28 dní nebo 80 % fck.' },
] as const;

function makeEmptyRow(constructionName?: string, totalM2?: number): FormworkRentalRow {
  const area = totalM2 ?? 0;
  const sys = BEDNI_SYSTEMS[0];
  // sada_m2 default: ~40% of total area (realistic for bridge abutment staging).
  // If area is 0 or very small, start at 0 so user must enter actual kit size.
  const defaultSada = area > 10 ? Math.round(area * 0.4 * 10) / 10 : area;
  // Pre-fill podil_koupe from knowledge base: podil_koupe_m2_typical × sada_m2
  const podil_koupe = Math.round(sys.podil_koupe_m2 * defaultSada * 100) / 100;
  const raw: FormworkRentalRow = {
    id: uuidv4(),
    construction_name: constructionName ?? '',
    celkem_m2:     area,
    sada_m2:       defaultSada,   // 40% of total → auto-takt ≈ 3 relocations (realistic start)
    pocet_taktu:   1,
    auto_taktu:    true,          // New rows use auto-derivation by default
    pocet_sad:     1,
    dni_na_takt:   3,             // Assembly days per takt (DOKA frami_basic norm)
    dni_beton_takt: 5,            // Curing days — stěny/opěry default; adjust per CURING_PRESETS
    dni_demontaz:  1,             // Final stripping of last takt (DOKA frami_basic: 1 day)
    doba_bedneni:  0,
    celkem_beton:  0,
    celkova_doba:  0,
    bednici_system: sys.system,
    rozmery:       sys.rozmery,
    mesicni_najem_jednotka: sys.jednotka,
    mesicni_najem_sada: 0,
    najem_naklady:  0,
    podil_koupe,                  // Ztracené díly: pre-filled from knowledge base
    konecny_najem:  0,
    kros_popis:    '',
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
  // AI modal state: which row is being suggested (null = closed)
  const [aiTargetRowId, setAiTargetRowId] = useState<string | null>(null);

  const aiTargetRow = aiTargetRowId ? rows.find(r => r.id === aiTargetRowId) ?? null : null;

  const handleApplyAI = (
    rowId: string,
    values: { pocet_taktu: number; sada_m2: number; dni_na_takt: number; dni_beton_takt: number; dni_demontaz: number }
  ) => {
    updateRow(rowId, { ...values, auto_taktu: false });
  };

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
    const row = rows.find(r => r.id === id);
    const sada = row?.sada_m2 ?? 0;
    updateRow(id, {
      bednici_system: sys.system,
      rozmery: sys.rozmery,
      mesicni_najem_jednotka: sys.jednotka,
      // Auto-update podil_koupe from new system's knowledge base default × sada_m2
      podil_koupe: Math.round(sys.podil_koupe_m2 * sada * 100) / 100,
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

  const totalNajem = rows.reduce((s, r) => s + (r.najem_naklady ?? 0), 0);
  const totalPodilKoupe = rows.reduce((s, r) => s + (r.podil_koupe ?? 0), 0);
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
            Nájem: <strong className="text-blue-700">{totalNajem.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč</strong>
            {totalPodilKoupe > 0 && (
              <> + Ztracené díly: <strong className="text-amber-700">{totalPodilKoupe.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč</strong></>
            )}
            {' '}= <strong className="text-blue-800">{totalRental.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč</strong>
          </span>
          {rows.length > 0 && (
            <button
              onClick={() => setAiTargetRowId(rows[0].id)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 border border-purple-300 rounded hover:bg-purple-50 transition-colors"
              title="AI Průvodce taktování — vyplní takty, montáž, zrání na základě vašich odpovědí"
            >
              <Sparkles size={12} />
              AI Průvodce
            </button>
          )}
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
              <th className={`${thCell} min-w-[55px]`} title="Počet dní na montáž bednění v jednom taktu (bez finální demontáže)">Montáž<br/>dní/takt</th>
              <th className={`${thCell} min-w-[50px]`} title="Demontáž posledního taktu [dny] — ČSN EN 13670 §8.5. Průběžná demontáž je součástí přesunu na další záběr.">Dem.<br/>dní</th>
              <th className={`${thCell} min-w-[65px] bg-slate-100`}>Doba<br/>bedn. d</th>
              <th className={`${thCell} min-w-[90px]`} title="Zrání betonu před odbedněním dle ČSN EN 13670. Doporučení: Stěny/opěry 5 d · Pilíře 7 d · Desky 21 d · Mostovka 28 d. Při 10°C × 2, při 5°C × 3.">Zrání<br/>/takt d ⓘ</th>
              <th className={`${thCell} min-w-[70px] bg-slate-100`}>Celkem<br/>beton d</th>
              <th className={`${thCell} min-w-[65px] bg-slate-100`} title="= Doba bednění + Celkem beton + Demontáž. Fakturace: min. 1 měsíc.">Celk.<br/>doba d</th>
              <th className={`${thCell} min-w-[150px]`}>Systém bednění</th>
              <th className={`${thCell} min-w-[110px]`}>Výška / rozm.</th>
              <th className={`${thCell} min-w-[70px]`}>Kč/m2<br/>měsíc</th>
              <th className={`${thCell} min-w-[90px] bg-slate-100`}>Měs. nájem<br/>sada Kč</th>
              <th className={`${thCell} min-w-[105px] bg-amber-50`} title="Ztracené díly (podíl koupě): kotevní díly ztracené, expreskotvy, Doka-trenn, bednící desky. Jednorázový nákup při výstavbě. Odvozeno z reálné nabídky Doka č. 540044877 (Nýřany-Heřmanova Huť, leden 2026). Editovatelné — tlačítko ~% doplní odhad z plochy sady.">Ztracené díly<br/>Kč ⓘ</th>
              <th className={`${thCell} min-w-[95px] bg-blue-50`} title="= Nájem (nájemné) + Ztracené díly. Min. 1 měsíc fakturace (standard DOKA/PERI/MEVA). NEZAHRNUJE dopravu (50–200 tis. Kč) ani montáž!">Konečný<br/>nájem Kč ⚠</th>
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
                  {/* Montáž dní/takt */}
                  <td className={tdCell}>
                    <input type="number" min="0" step="0.5" value={row.dni_na_takt}
                      onChange={e => updateRow(row.id, { dni_na_takt: parseFloat(e.target.value) || 0 })}
                      className={cellInput}
                      title="Dny na montáž bednění v jednom taktu (bez finální demontáže)" />
                  </td>
                  {/* Demontáž posledního taktu */}
                  <td className={tdCell}>
                    <input type="number" min="0" step="0.5" value={row.dni_demontaz ?? 1}
                      onChange={e => updateRow(row.id, { dni_demontaz: parseFloat(e.target.value) || 0 })}
                      className={cellInput}
                      title="Demontáž posledního taktu (finální stripping). DOKA norma: 1 den." />
                  </td>
                  {/* Doba bednění (computed) */}
                  <td className={`${tdCell} bg-slate-50`}>
                    <div className={cellReadonly} title="= takt_per_set × dni_na_takt">{row.doba_bedneni.toFixed(1)}</div>
                  </td>
                  {/* Zrání betonu/takt — s předvolbami dle typu konstrukce */}
                  <td className={tdCell}>
                    <div className="space-y-0.5">
                      <input type="number" min="0" step="0.5" value={row.dni_beton_takt}
                        onChange={e => updateRow(row.id, { dni_beton_takt: parseFloat(e.target.value) || 0 })}
                        className={cellInput}
                        title="Zrání betonu před odbedněním dle ČSN EN 13670" />
                      <select
                        value=""
                        onChange={e => {
                          const preset = CURING_PRESETS.find(p => p.id === e.target.value);
                          if (preset) updateRow(row.id, { dni_beton_takt: preset.dni });
                        }}
                        className="w-full text-[9px] bg-white border border-slate-200 rounded px-0.5 py-0 text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                        title="Předvolby dle ČSN EN 13670 při +20°C"
                      >
                        <option value="">⏱ Typ prvku…</option>
                        {CURING_PRESETS.map(p => (
                          <option key={p.id} value={p.id} title={p.note}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  {/* Celkem beton (computed) */}
                  <td className={`${tdCell} bg-slate-50`}>
                    <div className={cellReadonly} title="= takt_per_set × dni_beton_takt">{row.celkem_beton.toFixed(1)}</div>
                  </td>
                  {/* Celková doba (computed = montáž + zrání + demontáž) */}
                  <td className={`${tdCell} bg-slate-50`}>
                    <div className={cellReadonly} title={`= ${row.doba_bedneni.toFixed(1)} montáž + ${row.celkem_beton.toFixed(1)} beton + ${row.dni_demontaz ?? 1} dem. = ${row.celkova_doba.toFixed(1)} d. Fakturace: min. 1 měsíc.`}>
                      {row.celkova_doba.toFixed(1)}
                    </div>
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
                  {/* Ztracené díly (podil_koupe) — editable, pre-filled from knowledge base */}
                  <td className={`${tdCell} bg-amber-50`}>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number" min="0" step="0.01" value={row.podil_koupe ?? 0}
                        onChange={e => updateRow(row.id, { podil_koupe: parseFloat(e.target.value) || 0 })}
                        className="w-full text-right bg-white border border-amber-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 tabular-nums"
                        title="Ztracené díly: kotevní díly ztracené, expreskotvy, Doka-trenn, bednící desky [Kč]"
                      />
                      <button
                        onClick={() => {
                          const sys = BEDNI_SYSTEMS.find(s => s.system === row.bednici_system && s.rozmery === row.rozmery) ?? null;
                          if (sys) updateRow(row.id, { podil_koupe: Math.round(sys.podil_koupe_m2 * row.sada_m2 * 100) / 100 });
                        }}
                        title={`~Odhad: ${(BEDNI_SYSTEMS.find(s => s.system === row.bednici_system && s.rozmery === row.rozmery)?.podil_koupe_m2 ?? 0).toFixed(0)} Kč/m² × ${row.sada_m2} m²`}
                        className="flex-shrink-0 px-1 py-0.5 text-[9px] text-amber-600 border border-amber-300 rounded hover:bg-amber-100 transition-colors whitespace-nowrap leading-tight"
                      >
                        ~%
                      </button>
                    </div>
                  </td>
                  {/* Konečný nájem (= najem_naklady + podil_koupe, computed) */}
                  <td className={`${tdCell} bg-blue-50`}>
                    <div
                      className="w-full text-right font-semibold text-xs text-blue-700 tabular-nums px-1 py-0.5"
                      title={`Nájem: ${(row.najem_naklady ?? 0).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč + Ztracené díly: ${(row.podil_koupe ?? 0).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč`}
                    >
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
                        onClick={() => setAiTargetRowId(row.id)}
                        title="✨ AI Průvodce — navrhnout takty a zrání pro tento řádek"
                        className="p-0.5 text-purple-500 hover:bg-purple-50 rounded transition-colors"
                      >
                        <Sparkles size={13} />
                      </button>
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
              <td colSpan={15} className="px-2 py-1.5 text-right text-xs font-medium text-blue-700">
                Nájem: <span className="font-bold">{totalNajem.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč</span>
                {totalPodilKoupe > 0 && (
                  <> + Ztracené díly: <span className="font-bold text-amber-700">{totalPodilKoupe.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč</span></>
                )}
                {' '}= Celkem:
              </td>
              <td className="px-1 py-1.5 text-right text-xs font-semibold text-amber-700 tabular-nums bg-amber-50">
                {totalPodilKoupe > 0
                  ? `${totalPodilKoupe.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč`
                  : '—'}
              </td>
              <td className="px-1 py-1.5 text-right text-sm font-bold text-blue-800 tabular-nums">
                {totalRental.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* AI Modal — rendered per-row when ✨ button is clicked */}
      {aiTargetRow && (
        <FormworkAIModal
          isOpen={true}
          onClose={() => setAiTargetRowId(null)}
          initialCelkemM2={aiTargetRow.celkem_m2}
          initialSadaM2={aiTargetRow.sada_m2}
          initialPocetSad={aiTargetRow.pocet_sad}
          initialSystem={aiTargetRow.bednici_system}
          onApply={values => handleApplyAI(aiTargetRow.id, values)}
        />
      )}

      {/* Add all to materials */}
      {rows.length > 0 && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-slate-400 italic max-w-xl">
            Takty Auto = ⌈m2÷sada⌉ · Šachmatný: 2 sady → doba ÷2 · Min. 1 měs. fakturace ·{' '}
            Ztracené díly = kotevní díly + expreskotvy + Doka-trenn + desky (dle nabídky Doka č. 540044877) ·{' '}
            <span className="text-amber-600 font-medium">⚠ Cena NEZAHRNUJE dopravu (~50–200 tis. Kč/mobilizace), montáž ani DPH!</span>{' '}
            · Zrání: Stěny 5d · Pilíře 7d · Desky 21d · Mostovka 28d (×2 při 10°C)
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
