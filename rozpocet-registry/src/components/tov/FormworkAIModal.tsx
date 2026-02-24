/**
 * FormworkAIModal — AI Assistant for formwork tact planning
 *
 * Shows a wizard with construction questions, calls /api/formwork-assistant,
 * and returns pre-filled values to apply to a FormworkRentalRow.
 *
 * Model pipeline:
 *   Default:       Gemini 2.0 Flash (fast, cheap JSON output)
 *   Deep analysis: Claude Sonnet 4.6 (extended reasoning, optional toggle)
 */

import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertTriangle, ChevronRight, RotateCcw } from 'lucide-react';
import type { FormworkAIRequest, FormworkAIResponse, ElementType, Season, ConcreteClass, Workforce }
  from '../../../api/formwork-assistant';

// ─── Question option definitions ──────────────────────────────────────────

const ELEMENT_OPTIONS: { id: ElementType; label: string; sub: string; cure: string }[] = [
  { id: 'zakl',    label: 'Základy, čela stěn',         sub: 'Boční bednění základových pasů a desek', cure: 'Zrání: 2 dny' },
  { id: 'stena',   label: 'Stěny, opěry, opěrné zdi',   sub: 'Mostní opěry, protihlukové stěny',       cure: 'Zrání: 5 dní ✓ doporučeno' },
  { id: 'pilir',   label: 'Pilíře, masivní opěry',      sub: 'Mostní pilíře, masivní průřezy',          cure: 'Zrání: 7 dní' },
  { id: 'strop',   label: 'Stropní desky — spodní',     sub: 'Nosné spodní bednění stropů/desek',       cure: 'Zrání: 21 dní ⚠' },
  { id: 'mostovka',label: 'Mostovka (bridge deck)',     sub: 'Mostovkové desky, skružová bednění',      cure: 'Zrání: 28 dní TP 102 ⚠' },
];

const SEASON_OPTIONS: { id: Season; label: string; temp: string; factor: string; warn?: boolean }[] = [
  { id: 'summer',       label: 'Léto',          temp: '20–25°C',  factor: '×1.0' },
  { id: 'spring_autumn',label: 'Jaro / Podzim', temp: '10–15°C',  factor: '×2.0' },
  { id: 'winter',       label: 'Zima',          temp: '5–10°C',   factor: '×3.0', warn: true },
  { id: 'frost',        label: 'Mráz',          temp: '<5°C',     factor: '×4.0 ⚠', warn: true },
];

const CONCRETE_OPTIONS: { id: ConcreteClass; label: string; sub: string; factor: string }[] = [
  { id: 'C25_CEM1',   label: 'C25/30 CEM I 42.5R',  sub: 'Nejčastější pro mosty — rychlé tuhnutí', factor: '×1.0' },
  { id: 'C30_CEM2',   label: 'C30/37 CEM II/A',      sub: 'Normální tuhnutí',                       factor: '×1.2' },
  { id: 'C35_mostni', label: 'C35/45 mostní (CEM I)',sub: 'Mosty, tunely — obvykle CEM I 52.5R',    factor: '×1.0' },
  { id: 'C25_CEM3',   label: 'C25/30 CEM III/A',     sub: 'Strusky — pomalý, zvl. v zimě ⚠',        factor: '×1.8' },
];

const WORKFORCE_OPTIONS: { id: Workforce; label: string; sub: string; days: string }[] = [
  { id: 'small_2',    label: '2 pracovníci — bez jeřábu', sub: 'Frami h≤1.8m, manuální přesun', days: '3 dny/takt' },
  { id: 'medium_4',   label: '4 pracovníci + jeřáb',      sub: 'Standardní — Framax, Frami',    days: '2 dny/takt' },
  { id: 'large_6plus',label: '6+ pracovníci + jeřáb',    sub: 'Framax h=4.65m, velké záběry',  days: '2 dny/takt' },
];

// ─── Props ─────────────────────────────────────────────────────────────────

interface FormworkAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fill from current row */
  initialCelkemM2?: number;
  initialSadaM2?: number;
  initialPocetSad?: number;
  initialSystem?: string;
  /** Called when user accepts AI result */
  onApply: (values: {
    pocet_taktu: number;
    sada_m2: number;
    dni_na_takt: number;
    dni_beton_takt: number;
    dni_demontaz: number;
  }) => void;
}

// ─── Styles ────────────────────────────────────────────────────────────────

const radioOption = (selected: boolean, warn?: boolean) =>
  `flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all text-xs
   ${selected
     ? warn
       ? 'border-amber-400 bg-amber-50'
       : 'border-blue-400 bg-blue-50'
     : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
   }`;

// ─── Component ─────────────────────────────────────────────────────────────

export function FormworkAIModal({
  isOpen,
  onClose,
  initialCelkemM2 = 0,
  initialSadaM2 = 0,
  initialPocetSad = 1,
  initialSystem = '',
  onApply,
}: FormworkAIModalProps) {
  // Form state
  const [elementType, setElementType]     = useState<ElementType>('stena');
  const [season, setSeason]               = useState<Season>('spring_autumn');
  const [concreteClass, setConcreteClass] = useState<ConcreteClass>('C25_CEM1');
  const [workforce, setWorkforce]         = useState<Workforce>('medium_4');
  const [deepAnalysis, setDeepAnalysis]   = useState(false);

  // UI state
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<FormworkAIResponse | null>(null);
  const [error, setError]         = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const body: FormworkAIRequest = {
      element_type:    elementType,
      celkem_m2:       initialCelkemM2,
      sada_m2:         initialSadaM2 > 0 ? initialSadaM2 : Math.round(initialCelkemM2 * 0.4),
      pocet_sad:       initialPocetSad,
      bednici_system:  initialSystem || 'Frami Xlife',
      season,
      concrete_class:  concreteClass,
      workforce,
      deep_analysis:   deepAnalysis,
    };

    try {
      const resp = await fetch('/api/formwork-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const data: FormworkAIResponse = await resp.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Chyba při komunikaci s AI');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply({
      pocet_taktu:   result.pocet_taktu,
      sada_m2:       result.sada_m2_doporucena,
      dni_na_takt:   result.dni_na_takt,
      dni_beton_takt: result.dni_beton_takt,
      dni_demontaz:  result.dni_demontaz,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
          <div className="flex items-center gap-2.5">
            <Sparkles size={18} className="text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">AI Průvodce taktování bednění</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Zodpovězte otázky → AI vypočte optimální plán taktů
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Project summary */}
          <div className="flex gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
            <span>Plocha: <strong className="text-slate-800">{initialCelkemM2} m²</strong></span>
            <span>Sada: <strong className="text-slate-800">{initialSadaM2 > 0 ? initialSadaM2 : '—'} m²</strong></span>
            <span>Sad: <strong className="text-slate-800">{initialPocetSad}</strong></span>
            <span>Systém: <strong className="text-slate-800">{initialSystem || '—'}</strong></span>
          </div>

          {!result ? (
            <>
              {/* Q1: Element type */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  1. Typ konstrukčního prvku
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {ELEMENT_OPTIONS.map(opt => (
                    <label key={opt.id} className={radioOption(elementType === opt.id)}>
                      <input
                        type="radio" name="element" value={opt.id}
                        checked={elementType === opt.id}
                        onChange={() => setElementType(opt.id)}
                        className="mt-0.5 accent-blue-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-slate-800">{opt.label}</span>
                        <span className="text-slate-500 ml-1.5">{opt.sub}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{opt.cure}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q2: Season / temperature */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  2. Roční období (teplota betonu při betonáži)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SEASON_OPTIONS.map(opt => (
                    <label key={opt.id} className={radioOption(season === opt.id, opt.warn)}>
                      <input
                        type="radio" name="season" value={opt.id}
                        checked={season === opt.id}
                        onChange={() => setSeason(opt.id)}
                        className="mt-0.5 accent-blue-600 shrink-0"
                      />
                      <div>
                        <span className="font-medium text-slate-800">{opt.label}</span>
                        <div className="text-[10px] text-slate-500">{opt.temp} · zrání {opt.factor}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q3: Concrete class */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  3. Třída betonu a typ cementu
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {CONCRETE_OPTIONS.map(opt => (
                    <label key={opt.id} className={radioOption(concreteClass === opt.id)}>
                      <input
                        type="radio" name="concrete" value={opt.id}
                        checked={concreteClass === opt.id}
                        onChange={() => setConcreteClass(opt.id)}
                        className="mt-0.5 accent-blue-600 shrink-0"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-slate-800">{opt.label}</span>
                        <span className="text-slate-500 ml-1.5 text-[10px]">{opt.sub}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">faktor {opt.factor}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q4: Workforce */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  4. Pracovní síla a technika
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {WORKFORCE_OPTIONS.map(opt => (
                    <label key={opt.id} className={radioOption(workforce === opt.id)}>
                      <input
                        type="radio" name="workforce" value={opt.id}
                        checked={workforce === opt.id}
                        onChange={() => setWorkforce(opt.id)}
                        className="mt-0.5 accent-blue-600 shrink-0"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-slate-800">{opt.label}</span>
                        <div className="text-[10px] text-slate-500">{opt.sub}</div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{opt.days}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Deep analysis toggle */}
              <label className="flex items-center gap-2.5 p-2.5 bg-purple-50 border border-purple-200 rounded-lg cursor-pointer text-xs">
                <input
                  type="checkbox" checked={deepAnalysis}
                  onChange={e => setDeepAnalysis(e.target.checked)}
                  className="accent-purple-600"
                />
                <div>
                  <span className="font-medium text-purple-800">Hloubková analýza (Claude Sonnet 4.6)</span>
                  <div className="text-[10px] text-purple-600 mt-0.5">
                    Lepší vysvětlení a kontextová upozornění. Pomalejší (~5s), vyšší náklady.
                    Výchozí: Gemini 2.0 Flash (~1s, levný).
                  </div>
                </div>
              </label>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleCalculate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Počítám… ({deepAnalysis ? 'Claude 4.6' : 'Gemini 2.0'})
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Navrhnout plán taktů (AI)
                    <ChevronRight size={14} />
                  </>
                )}
              </button>
            </>
          ) : (
            /* Result view */
            <div className="space-y-4">
              {/* Values grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Počet taktů',   value: result.pocet_taktu,      unit: 'ks',  color: 'blue'  },
                  { label: 'Montáž/takt',   value: result.dni_na_takt,      unit: 'dní', color: 'slate' },
                  { label: 'Zrání betonu',  value: result.dni_beton_takt,   unit: 'dní', color: 'slate' },
                  { label: 'Fin. demontáž', value: result.dni_demontaz,     unit: 'dní', color: 'slate' },
                  { label: 'Celková doba',  value: result.celkova_doba_dni, unit: 'dní', color: 'blue'  },
                  { label: 'Min. fakturace',value: Math.ceil(result.billing_months), unit: 'měs.', color: 'amber' },
                ].map(item => (
                  <div key={item.label} className={`p-3 rounded-lg border text-center
                    ${item.color === 'blue'  ? 'bg-blue-50 border-blue-200' :
                      item.color === 'amber' ? 'bg-amber-50 border-amber-200' :
                      'bg-slate-50 border-slate-200'}`}>
                    <div className={`text-xl font-bold
                      ${item.color === 'blue'  ? 'text-blue-700' :
                        item.color === 'amber' ? 'text-amber-700' :
                        'text-slate-700'}`}>
                      {item.value}
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{item.label}</div>
                    <div className="text-[9px] text-slate-400">{item.unit}</div>
                  </div>
                ))}
              </div>

              {/* Calculation detail */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-500 space-y-0.5">
                <div>Korekce: teplota ×{result.temp_factor} · cement ×{result.cement_factor.toFixed(1)}</div>
                <div>Model: <span className="text-slate-700">{result.model_used}</span></div>
                {result.sada_m2_doporucena !== initialSadaM2 && (
                  <div className="text-amber-600">
                    ⚠ Doporučená sada: {result.sada_m2_doporucena} m² (místo {initialSadaM2} m²)
                  </div>
                )}
              </div>

              {/* AI explanation */}
              {result.zduvodneni && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-[10px] font-medium text-blue-700 mb-1 flex items-center gap-1">
                    <Sparkles size={11} /> AI vysvětlení
                  </p>
                  <p className="text-xs text-blue-900 leading-relaxed">{result.zduvodneni}</p>
                </div>
              )}

              {/* Warnings */}
              {result.upozorneni.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                  <p className="text-[10px] font-medium text-amber-700 flex items-center gap-1">
                    <AlertTriangle size={11} /> Upozornění stavbyvedoucímu
                  </p>
                  {result.upozorneni.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setResult(null)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <RotateCcw size={12} /> Zpět (upravit)
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle size={15} />
                  Použít tyto hodnoty do řádku
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
