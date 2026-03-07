/**
 * Planner Page v1.0
 *
 * Interactive UI for the planElement() orchestrator.
 * Client-side only — all calculations run in the browser via shared library.
 *
 * Input form → planElement() → result display with:
 *   - Element classification
 *   - Pour decision (mode, tacts)
 *   - Formwork system + 3-phase costs
 *   - Rebar estimation
 *   - Schedule (Gantt chart)
 *   - Cost summary
 *   - Warnings + decision log
 */

import { useState, useMemo } from 'react';
import {
  planElement,
  addWorkDays,
  type PlannerInput,
  type PlannerOutput,
} from '@stavagent/monolit-shared';
import { FORMWORK_SYSTEMS } from '@stavagent/monolit-shared';
import type { StructuralElementType, SeasonMode } from '@stavagent/monolit-shared';
import type { ConcreteClass, CementType } from '@stavagent/monolit-shared';
import '../styles/r0.css';

// ─── Element type labels ────────────────────────────────────────────────────

const ELEMENT_TYPES: { value: StructuralElementType; label: string }[] = [
  { value: 'zaklady_piliru', label: 'Základy pilířů / patky' },
  { value: 'driky_piliru', label: 'Dříky pilířů' },
  { value: 'operne_zdi', label: 'Opěrné zdi' },
  { value: 'mostovkova_deska', label: 'Mostovková deska' },
  { value: 'rimsa', label: 'Římsová deska' },
  { value: 'rigel', label: 'Příčník (ригель)' },
  { value: 'opery_ulozne_prahy', label: 'Opěry, úložné prahy' },
  { value: 'mostni_zavirne_zidky', label: 'Mostní závěrné zídky' },
  { value: 'other', label: 'Jiný typ' },
];

const SEASONS: { value: SeasonMode; label: string }[] = [
  { value: 'normal', label: 'Normální (5-25°C)' },
  { value: 'hot', label: 'Horko (>25°C)' },
  { value: 'cold', label: 'Zima (<5°C)' },
];

const CONCRETE_CLASSES: ConcreteClass[] = [
  'C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37',
  'C35/45', 'C40/50', 'C45/55', 'C50/60',
];

const CEMENT_TYPES: { value: CementType; label: string }[] = [
  { value: 'CEM_I', label: 'CEM I (OPC - rychlé)' },
  { value: 'CEM_II', label: 'CEM II (směsný - střední)' },
  { value: 'CEM_III', label: 'CEM III (struska - pomalé)' },
];

// ─── Default form values ────────────────────────────────────────────────────

interface FormState {
  element_type: StructuralElementType;
  element_name: string;
  use_name_classification: boolean;
  volume_m3: number;
  formwork_area_m2: string; // empty = auto-estimate
  rebar_mass_kg: string;    // empty = auto-estimate
  has_dilatacni_spary: boolean;
  spara_spacing_m: number;
  total_length_m: number;
  adjacent_sections: boolean;
  season: SeasonMode;
  use_retarder: boolean;
  concrete_class: ConcreteClass;
  cement_type: CementType;
  temperature_c: number;
  num_sets: number;
  num_formwork_crews: number;
  num_rebar_crews: number;
  crew_size: number;
  shift_h: number;
  wage_czk_h: number;
  formwork_system_name: string; // empty = auto
  enable_monte_carlo: boolean;
  start_date: string; // ISO date string for calendar mapping
}

const DEFAULT_FORM: FormState = {
  element_type: 'operne_zdi',
  element_name: '',
  use_name_classification: false,
  volume_m3: 120,
  formwork_area_m2: '',
  rebar_mass_kg: '',
  has_dilatacni_spary: true,
  spara_spacing_m: 10,
  total_length_m: 50,
  adjacent_sections: true,
  season: 'normal',
  use_retarder: false,
  concrete_class: 'C30/37',
  cement_type: 'CEM_I',
  temperature_c: 15,
  num_sets: 2,
  num_formwork_crews: 1,
  num_rebar_crews: 1,
  crew_size: 4,
  shift_h: 10,
  wage_czk_h: 398,
  formwork_system_name: '',
  enable_monte_carlo: false,
  start_date: new Date().toISOString().split('T')[0],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCZK(val: number): string {
  return val.toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' Kč';
}

function formatNum(val: number, decimals = 1): string {
  return val.toLocaleString('cs-CZ', { maximumFractionDigits: decimals });
}

/** Map work-day range [start, end] to calendar date string */
function formatWorkDayRange(baseDate: Date, range: [number, number]): string {
  const fmt = (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
  const startResult = addWorkDays(baseDate, Math.floor(range[0]));
  const endResult = addWorkDays(baseDate, Math.ceil(range[1]));
  const startStr = fmt(startResult.end_date);
  const endStr = fmt(endResult.end_date);
  return startStr === endStr ? startStr : `${startStr} – ${endStr}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<PlannerOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleCalculate = () => {
    setError(null);
    try {
      const input: PlannerInput = {
        volume_m3: form.volume_m3,
        has_dilatacni_spary: form.has_dilatacni_spary,
        season: form.season,
        use_retarder: form.use_retarder,
        concrete_class: form.concrete_class,
        cement_type: form.cement_type,
        temperature_c: form.temperature_c,
        num_sets: form.num_sets,
        num_formwork_crews: form.num_formwork_crews,
        num_rebar_crews: form.num_rebar_crews,
        crew_size: form.crew_size,
        shift_h: form.shift_h,
        k: 0.8,
        wage_czk_h: form.wage_czk_h,
        enable_monte_carlo: form.enable_monte_carlo,
      };

      // Element identification
      if (form.use_name_classification && form.element_name.trim()) {
        input.element_name = form.element_name.trim();
      } else {
        input.element_type = form.element_type;
      }

      // Optional overrides
      if (form.formwork_area_m2) {
        input.formwork_area_m2 = parseFloat(form.formwork_area_m2);
      }
      if (form.rebar_mass_kg) {
        input.rebar_mass_kg = parseFloat(form.rebar_mass_kg);
      }
      if (form.has_dilatacni_spary) {
        input.spara_spacing_m = form.spara_spacing_m;
        input.total_length_m = form.total_length_m;
        input.adjacent_sections = form.adjacent_sections;
      }
      if (form.formwork_system_name) {
        input.formwork_system_name = form.formwork_system_name;
      }

      const output = planElement(input);
      setResult(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba výpočtu');
      setResult(null);
    }
  };

  // Auto-calculate on first render with defaults
  const firstRun = useMemo(() => {
    try {
      return planElement({
        element_type: DEFAULT_FORM.element_type,
        volume_m3: DEFAULT_FORM.volume_m3,
        has_dilatacni_spary: DEFAULT_FORM.has_dilatacni_spary,
        spara_spacing_m: DEFAULT_FORM.spara_spacing_m,
        total_length_m: DEFAULT_FORM.total_length_m,
        adjacent_sections: DEFAULT_FORM.adjacent_sections,
        concrete_class: DEFAULT_FORM.concrete_class,
        temperature_c: DEFAULT_FORM.temperature_c,
      });
    } catch {
      return null;
    }
  }, []);

  const plan = result ?? firstRun;

  return (
    <div className="r0-app">
      {/* Header */}
      <header className="r0-header">
        <div className="r0-header-left">
          <a href="/" className="r0-back-link">← Zpět na Monolit</a>
          <h1 className="r0-title">
            <span className="r0-icon">📐</span>
            Plánovač elementu
          </h1>
        </div>
        <div className="r0-header-right">
          <a href="/r0" className="r0-back-link" style={{ marginRight: 12 }}>R0 Core →</a>
          <span className="r0-badge">v1.0</span>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 56px)' }}>
        {/* LEFT: Input Form */}
        <aside style={{
          width: 380,
          flexShrink: 0,
          background: 'var(--r0-slate-50)',
          borderRight: '1px solid var(--r0-slate-200)',
          overflowY: 'auto',
          padding: '16px 20px',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: 'var(--r0-slate-800)' }}>
            Vstupní parametry
          </h2>

          {/* ─── Element ─── */}
          <Section title="Element">
            <label style={labelStyle}>
              <input
                type="checkbox"
                checked={form.use_name_classification}
                onChange={e => update('use_name_classification', e.target.checked)}
              />
              {' '}Klasifikace podle názvu (AI)
            </label>

            {form.use_name_classification ? (
              <Field label="Název elementu">
                <input
                  style={inputStyle}
                  value={form.element_name}
                  onChange={e => update('element_name', e.target.value)}
                  placeholder="např. Opěrné zdi, Mostovka..."
                />
              </Field>
            ) : (
              <Field label="Typ elementu">
                <select
                  style={inputStyle}
                  value={form.element_type}
                  onChange={e => update('element_type', e.target.value as StructuralElementType)}
                >
                  {ELEMENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
            )}
          </Section>

          {/* ─── Volumes ─── */}
          <Section title="Objemy">
            <Field label="Objem betonu (m³)">
              <input
                type="number"
                style={inputStyle}
                value={form.volume_m3}
                onChange={e => update('volume_m3', parseFloat(e.target.value) || 0)}
                min={1}
              />
            </Field>
            <Field label="Plocha bednění (m²)" hint="prázdné = odhad">
              <input
                type="number"
                style={inputStyle}
                value={form.formwork_area_m2}
                onChange={e => update('formwork_area_m2', e.target.value)}
                placeholder="automatický odhad"
              />
            </Field>
            <Field label="Hmotnost výztuže (kg)" hint="prázdné = odhad">
              <input
                type="number"
                style={inputStyle}
                value={form.rebar_mass_kg}
                onChange={e => update('rebar_mass_kg', e.target.value)}
                placeholder="automatický odhad"
              />
            </Field>
          </Section>

          {/* ─── Pour ─── */}
          <Section title="Betonáž">
            <label style={labelStyle}>
              <input
                type="checkbox"
                checked={form.has_dilatacni_spary}
                onChange={e => update('has_dilatacni_spary', e.target.checked)}
              />
              {' '}Dilatační spáry
            </label>

            {form.has_dilatacni_spary && (
              <>
                <Field label="Rozteč spár (m)">
                  <input
                    type="number"
                    style={inputStyle}
                    value={form.spara_spacing_m}
                    onChange={e => update('spara_spacing_m', parseFloat(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Celková délka (m)">
                  <input
                    type="number"
                    style={inputStyle}
                    value={form.total_length_m}
                    onChange={e => update('total_length_m', parseFloat(e.target.value) || 0)}
                  />
                </Field>
                <label style={labelStyle}>
                  <input
                    type="checkbox"
                    checked={form.adjacent_sections}
                    onChange={e => update('adjacent_sections', e.target.checked)}
                  />
                  {' '}Sousední sekce (šachový pořadí)
                </label>
              </>
            )}

            <Field label="Datum zahájení" hint="pro kalendářní Gantt">
              <input
                type="date"
                style={inputStyle}
                value={form.start_date}
                onChange={e => update('start_date', e.target.value)}
              />
            </Field>

            <Field label="Sezóna">
              <select
                style={inputStyle}
                value={form.season}
                onChange={e => update('season', e.target.value as SeasonMode)}
              >
                {SEASONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </Section>

          {/* ─── Concrete / Maturity ─── */}
          <Section title="Beton / Zrání">
            <Field label="Třída betonu">
              <select style={inputStyle} value={form.concrete_class}
                onChange={e => update('concrete_class', e.target.value as ConcreteClass)}>
                {CONCRETE_CLASSES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Typ cementu">
              <select style={inputStyle} value={form.cement_type}
                onChange={e => update('cement_type', e.target.value as CementType)}>
                {CEMENT_TYPES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Teplota (°C)">
              <input type="number" style={inputStyle} value={form.temperature_c}
                onChange={e => update('temperature_c', parseFloat(e.target.value) || 0)} />
            </Field>
          </Section>

          {/* ─── Advanced ─── */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none', border: 'none', color: 'var(--r0-blue)',
              cursor: 'pointer', fontSize: 13, padding: '8px 0', width: '100%', textAlign: 'left',
            }}
          >
            {showAdvanced ? '▼' : '▶'} Pokročilé nastavení
          </button>

          {showAdvanced && (
            <>
              <Section title="Zdroje">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label="Sady bednění">
                    <input type="number" style={inputStyle} value={form.num_sets} min={1} max={10}
                      onChange={e => update('num_sets', parseInt(e.target.value) || 1)} />
                  </Field>
                  <Field label="Čety bednění">
                    <input type="number" style={inputStyle} value={form.num_formwork_crews} min={1} max={5}
                      onChange={e => update('num_formwork_crews', parseInt(e.target.value) || 1)} />
                  </Field>
                  <Field label="Čety výztuže">
                    <input type="number" style={inputStyle} value={form.num_rebar_crews} min={1} max={5}
                      onChange={e => update('num_rebar_crews', parseInt(e.target.value) || 1)} />
                  </Field>
                  <Field label="Pracovníků/četa">
                    <input type="number" style={inputStyle} value={form.crew_size} min={2} max={10}
                      onChange={e => update('crew_size', parseInt(e.target.value) || 4)} />
                  </Field>
                  <Field label="Směna (h)">
                    <input type="number" style={inputStyle} value={form.shift_h} min={6} max={12}
                      onChange={e => update('shift_h', parseFloat(e.target.value) || 10)} />
                  </Field>
                  <Field label="Mzda (Kč/h)">
                    <input type="number" style={inputStyle} value={form.wage_czk_h} min={100}
                      onChange={e => update('wage_czk_h', parseFloat(e.target.value) || 398)} />
                  </Field>
                </div>
              </Section>

              <Section title="Bednění (override)">
                <Field label="Systém bednění">
                  <select style={inputStyle} value={form.formwork_system_name}
                    onChange={e => update('formwork_system_name', e.target.value)}>
                    <option value="">Automatický výběr</option>
                    {FORMWORK_SYSTEMS.map(s => (
                      <option key={s.name} value={s.name}>{s.name} ({s.manufacturer})</option>
                    ))}
                  </select>
                </Field>
              </Section>

              <Section title="Simulace">
                <label style={labelStyle}>
                  <input type="checkbox" checked={form.enable_monte_carlo}
                    onChange={e => update('enable_monte_carlo', e.target.checked)} />
                  {' '}Monte Carlo simulace (PERT)
                </label>
              </Section>
            </>
          )}

          {/* ─── Calculate Button ─── */}
          <button
            onClick={handleCalculate}
            style={{
              width: '100%', padding: '12px', marginTop: 16,
              background: 'var(--r0-orange)', color: 'white', border: 'none',
              borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Vypočítat plán
          </button>

          {error && (
            <div style={{
              marginTop: 12, padding: 12, background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </aside>

        {/* RIGHT: Results */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--r0-slate-100)' }}>
          {plan ? (
            <PlanResult plan={plan} startDate={form.start_date} showLog={showLog} onToggleLog={() => setShowLog(!showLog)} />
          ) : (
            <div style={{ textAlign: 'center', paddingTop: 100, color: 'var(--r0-slate-400)' }}>
              <div style={{ fontSize: 48 }}>📐</div>
              <p style={{ fontSize: 16, marginTop: 16 }}>Nastavte parametry a klikněte "Vypočítat plán"</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Result Display ─────────────────────────────────────────────────────────

function PlanResult({ plan, startDate, showLog, onToggleLog }: {
  plan: PlannerOutput;
  startDate: string;
  showLog: boolean;
  onToggleLog: () => void;
}) {
  // Calendar date mapping
  const calendarInfo = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate + 'T00:00:00');
    if (isNaN(start.getTime())) return null;
    const result = addWorkDays(start, plan.schedule.total_days);
    return {
      start,
      end: result.end_date,
      calendarDays: result.calendar_days,
      formatDate: (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }),
      formatShort: (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }),
    };
  }, [startDate, plan.schedule.total_days]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPICard label="Celkem dní" value={plan.schedule.total_days} unit={calendarInfo ? `prac. dní (${calendarInfo.calendarDays} kal.)` : 'prac. dní'} color="var(--r0-blue)" />
        <KPICard label="Počet záběrů" value={plan.pour_decision.num_tacts} unit="taktů" color="var(--r0-orange)" />
        <KPICard label="Náklady práce" value={formatCZK(plan.costs.total_labor_czk)} color="var(--r0-green)" />
        <KPICard label="Úspora vs. sekvenční" value={plan.schedule.savings_pct + '%'} color={plan.schedule.savings_pct > 0 ? 'var(--r0-green)' : 'var(--r0-slate-400)'} />
      </div>

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <Card title="Varování" icon="⚠️" borderColor="var(--r0-orange)">
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#92400e' }}>
            {plan.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
          </ul>
        </Card>
      )}

      {/* Element + Pour */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Element" icon="🧱">
          <Row label="Typ" value={plan.element.label_cs} />
          <Row label="Klasifikace" value={`${(plan.element.classification_confidence * 100).toFixed(0)}%`} />
          <Row label="Orientace" value={plan.element.profile.orientation === 'horizontal' ? 'Horizontální' : 'Vertikální'} />
          <Row label="Výztuž typická" value={`${plan.element.profile.rebar_ratio_kg_m3} kg/m³`} />
          <Row label="Podpěry" value={plan.element.profile.needs_supports ? 'Ano' : 'Ne'} />
          <Row label="Jeřáb" value={plan.element.profile.needs_crane ? 'Ano' : 'Ne'} />
        </Card>

        <Card title="Betonáž" icon="🏗️">
          <Row label="Režim" value={plan.pour_decision.pour_mode === 'sectional' ? 'Záběrový' : 'Monolitický'} />
          <Row label="Sub-mód" value={plan.pour_decision.sub_mode} />
          <Row label="Záběrů" value={plan.pour_decision.num_tacts.toString()} />
          <Row label="Objem/záběr" value={`${formatNum(plan.pour_decision.tact_volume_m3)} m³`} />
          <Row label="Rychlost" value={`${formatNum(plan.pour.effective_rate_m3_h)} m³/h`} />
          <Row label="Bottleneck" value={plan.pour.rate_bottleneck} />
        </Card>
      </div>

      {/* Formwork */}
      <Card title="Bednění" icon="📦">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={subTitle}>Systém</div>
            <Row label="Název" value={plan.formwork.system.name} />
            <Row label="Výrobce" value={plan.formwork.system.manufacturer} />
            <Row label="Pronájem" value={plan.formwork.system.rental_czk_m2_month > 0
              ? `${formatNum(plan.formwork.system.rental_czk_m2_month, 0)} Kč/m²/měs`
              : 'Bez pronájmu'} />
          </div>
          <div>
            <div style={subTitle}>Časy (na záběr)</div>
            <Row label="Montáž" value={`${plan.formwork.assembly_days} dní`} />
            <Row label="Zrání" value={`${plan.formwork.curing_days} dní`} />
            <Row label="Demontáž" value={`${plan.formwork.disassembly_days} dní`} />
          </div>
          <div>
            <div style={subTitle}>3-fázový model</div>
            <Row label="1. záběr" value={formatCZK(plan.formwork.three_phase.initial_cost_labor)} />
            <Row label="Střední" value={formatCZK(plan.formwork.three_phase.middle_cost_labor)} />
            <Row label="Poslední" value={formatCZK(plan.formwork.three_phase.final_cost_labor)} />
            <Row label="Celkem" value={formatCZK(plan.formwork.three_phase.total_cost_labor)} bold />
          </div>
        </div>
      </Card>

      {/* Rebar */}
      <Card title="Výztuž" icon="🔩">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Row label="Hmotnost / záběr" value={`${formatNum(plan.rebar.mass_kg, 0)} kg`} />
            <Row label="Zdroj" value={plan.rebar.mass_source === 'estimated' ? 'Odhad z profilu' : 'Zadaná hodnota'} />
            <Row label="Doba / záběr" value={`${formatNum(plan.rebar.duration_days)} dní`} />
          </div>
          <div>
            <Row label="Pracovníků (doporuč.)" value={plan.rebar.recommended_crew.toString()} />
            <Row label="Norma" value={`${plan.rebar.norm_h_per_t} h/t`} />
            <Row label="Náklady / záběr" value={formatCZK(plan.rebar.cost_labor)} />
          </div>
        </div>
      </Card>

      {/* Schedule / Gantt */}
      <Card title="Harmonogram" icon="📅">
        <div style={{ display: 'grid', gridTemplateColumns: calendarInfo ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Row label="Celkem (prac.)" value={`${plan.schedule.total_days} dní`} bold />
          <Row label="Sekvenčně" value={`${plan.schedule.sequential_days} dní`} />
          <Row label="Úspora" value={`${plan.schedule.savings_pct}%`} bold />
          {calendarInfo && (
            <Row label="Kalendářně" value={`${calendarInfo.calendarDays} dní`} />
          )}
        </div>

        {/* Calendar dates banner */}
        {calendarInfo && (
          <div style={{
            display: 'flex', gap: 16, padding: '10px 14px', marginBottom: 12,
            background: 'var(--r0-slate-50)', borderRadius: 6,
            border: '1px solid var(--r0-slate-200)', fontSize: 13,
          }}>
            <span>
              <span style={{ color: 'var(--r0-slate-500)' }}>Zahájení: </span>
              <strong>{calendarInfo.formatDate(calendarInfo.start)}</strong>
            </span>
            <span>
              <span style={{ color: 'var(--r0-slate-500)' }}>Dokončení: </span>
              <strong>{calendarInfo.formatDate(calendarInfo.end)}</strong>
            </span>
            <span style={{ color: 'var(--r0-slate-400)', fontSize: 12 }}>
              (Prac. dní: Po-Pá, svátky ČR)
            </span>
          </div>
        )}

        {plan.schedule.gantt && (
          <pre style={{
            background: 'var(--r0-slate-800)', color: '#e2e8f0',
            padding: 16, borderRadius: 6, fontSize: 11, lineHeight: 1.5,
            overflowX: 'auto', margin: 0, fontFamily: "'JetBrains Mono', monospace",
          }}>
            {plan.schedule.gantt}
          </pre>
        )}

        {/* Calendar timeline — map work-day milestones to dates */}
        {calendarInfo && plan.schedule.tact_details && plan.schedule.tact_details.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--r0-slate-600)', marginBottom: 8 }}>
              Kalendářní milníky (záběry)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
                    <th style={thStyle}>Záběr</th>
                    <th style={thStyle}>Montáž</th>
                    <th style={thStyle}>Beton</th>
                    <th style={thStyle}>Zrání</th>
                    <th style={thStyle}>Demontáž</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.schedule.tact_details.map(td => (
                    <tr key={td.tact} style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={tdStyle}><strong>T{td.tact} (S{td.set})</strong></td>
                      <td style={tdStyle}>{formatWorkDayRange(calendarInfo.start, td.assembly)}</td>
                      <td style={tdStyle}>{formatWorkDayRange(calendarInfo.start, td.concrete)}</td>
                      <td style={tdStyle}>{formatWorkDayRange(calendarInfo.start, td.curing)}</td>
                      <td style={tdStyle}>{formatWorkDayRange(calendarInfo.start, td.stripping)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Monte Carlo */}
      {plan.monte_carlo && (
        <Card title="Monte Carlo (PERT)" icon="🎲">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Row label="P50 (medián)" value={`${plan.monte_carlo.p50} dní`} />
            <Row label="P80" value={`${plan.monte_carlo.p80} dní`} />
            <Row label="P90" value={`${plan.monte_carlo.p90} dní`} />
            <Row label="P95" value={`${plan.monte_carlo.p95} dní`} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Row label="Průměr" value={`${formatNum(plan.monte_carlo.mean)} dní`} />
            <Row label="Směrodatná odchylka" value={`${formatNum(plan.monte_carlo.std_dev)} dní`} />
          </div>
        </Card>
      )}

      {/* Costs Summary */}
      <Card title="Souhrn nákladů" icon="💰">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Row label="Bednění (práce)" value={formatCZK(plan.costs.formwork_labor_czk)} />
            <Row label="Výztuž (práce)" value={formatCZK(plan.costs.rebar_labor_czk)} />
            <Row label="Betonáž (práce)" value={formatCZK(plan.costs.pour_labor_czk)} />
          </div>
          <div>
            <Row label="Pronájem bednění" value={formatCZK(plan.costs.formwork_rental_czk)} />
            <Row label="Celkem práce" value={formatCZK(plan.costs.total_labor_czk)} bold />
            <Row label="Celkem vše" value={formatCZK(plan.costs.total_labor_czk + plan.costs.formwork_rental_czk)} bold />
          </div>
        </div>
      </Card>

      {/* Decision Log */}
      <button onClick={onToggleLog} style={{
        background: 'none', border: 'none', color: 'var(--r0-blue)',
        cursor: 'pointer', fontSize: 13, padding: '8px 0',
      }}>
        {showLog ? '▼' : '▶'} Rozhodovací log ({plan.decision_log.length} kroků)
      </button>

      {showLog && (
        <Card title="Traceability" icon="📋">
          <ol style={{ margin: 0, paddingLeft: 24, fontSize: 12, color: 'var(--r0-slate-600)' }}>
            {plan.decision_log.map((entry, i) => (
              <li key={i} style={{ marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{entry}</li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

// ─── UI Primitives ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
        color: 'var(--r0-slate-500)', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--r0-slate-600)', marginBottom: 3 }}>
        {label}
        {hint && <span style={{ color: 'var(--r0-slate-400)', marginLeft: 4 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Card({ title, icon, children, borderColor }: {
  title: string; icon: string; children: React.ReactNode; borderColor?: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: 8, padding: 16, marginBottom: 12,
      border: '1px solid var(--r0-slate-200)',
      borderLeft: borderColor ? `4px solid ${borderColor}` : undefined,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: 'var(--r0-slate-800)' }}>
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function KPICard({ label, value, unit, color }: {
  label: string; value: string | number; unit?: string; color: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: 8, padding: '14px 16px',
      border: '1px solid var(--r0-slate-200)', borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--r0-slate-500)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--r0-slate-800)', fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </div>
      {unit && <div style={{ fontSize: 11, color: 'var(--r0-slate-400)' }}>{unit}</div>}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 0', fontSize: 13, borderBottom: '1px solid var(--r0-slate-100)',
    }}>
      <span style={{ color: 'var(--r0-slate-500)' }}>{label}</span>
      <span style={{
        color: 'var(--r0-slate-800)',
        fontWeight: bold ? 700 : 500,
        fontFamily: "'JetBrains Mono', monospace",
      }}>{value}</span>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--r0-slate-300)', borderRadius: 4,
  background: 'white', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, color: 'var(--r0-slate-700)',
  marginBottom: 8, cursor: 'pointer',
};

const subTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--r0-slate-600)',
  marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontSize: 11,
  color: 'var(--r0-slate-500)', fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px', fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
};
