/**
 * Zeleznice kiosk — kalkulátor železničního svršku a spodku.
 *
 * Výpočet běží IN-BROWSER přes kanonický engine `@zeleznice/shared`
 * (planRailSection) — stejný engine konzumuje backend /api/rail/calculate
 * a MCP tool calculate_railway_works (SSOT, žádná divergence).
 */
import { useEffect, useMemo, useState } from 'react';
import { TrainFront } from 'lucide-react';
import {
  planRailSection,
  type RailPlanResult,
  type RailPlannerInput,
} from '@zeleznice/shared';
import { RailForm } from './components/RailForm';
import { RailResults } from './components/RailResults';

export interface TurnoutRow {
  form_id: string;
  count: string;
}
export interface SpodekRow {
  name_cs: string;
  unit: string;
  quantity: string;
  work_type: string;
}
export interface UserNormRow {
  machine_id: string;
  rate_value: string;
  rate_unit: 'm/h' | 'h/ks';
}

export interface FormState {
  length_mode: 'stanicieni' | 'delka';
  km_od: string;
  km_do: string;
  section_length_m: string;
  track_count: string;
  contract_type: 'sz_verejna' | 'vlecka';
  project_kind: 'novostavba' | 'rekonstrukce' | 'udrzba';
  assembly_id: string;
  spacing_code: string; // '' = default sestavy
  field_length_m: string; // '' = default
  y_sleeper_spacing_m: string;
  rail_delivery_length_m: string; // '' = KB default
  ballast_mode: 'none' | 'preset' | 'parametric' | 'area';
  ballast_preset_id: string;
  ballast_area_m2: string;
  ballast_thickness_m: string;
  ballast_crown_m: string;
  ballast_slope: string;
  curve_min_radius_m: string;
  cant_max_mm: string;
  izolovane_styky_ks: string;
  turnouts: TurnoutRow[];
  obstacles: { prejezdy: string; prechody: string; ukolejneni: string; pojistne_uhelniky_m: string; magneticke_body: string };
  spodek_items: SpodekRow[];
  tamping_machine_id: string; // '' = auto
  user_norms: UserNormRow[];
  shift_hours: string;
  possession_window_h: string;
  front_length_m: string;
}

export const DEFAULT_FORM: FormState = {
  length_mode: 'delka',
  km_od: '',
  km_do: '',
  section_length_m: '1000',
  track_count: '1',
  contract_type: 'sz_verejna',
  project_kind: 'novostavba',
  assembly_id: 'UIC60_bezstykova',
  spacing_code: '',
  field_length_m: '',
  y_sleeper_spacing_m: '',
  rail_delivery_length_m: '',
  ballast_mode: 'none',
  ballast_preset_id: 'jednokolejna_bezstykova',
  ballast_area_m2: '',
  ballast_thickness_m: '0.35',
  ballast_crown_m: '3.4',
  ballast_slope: '1.25',
  curve_min_radius_m: '',
  cant_max_mm: '',
  izolovane_styky_ks: '',
  turnouts: [],
  obstacles: { prejezdy: '', prechody: '', ukolejneni: '', pojistne_uhelniky_m: '', magneticke_body: '' },
  spodek_items: [],
  tamping_machine_id: '',
  user_norms: [],
  shift_hours: '8',
  possession_window_h: '',
  front_length_m: '',
};

const LS_KEY = 'zeleznice-form-v1';

function num(s: string): number | undefined {
  if (s == null || s.trim() === '') return undefined;
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
}

export function buildInput(form: FormState): RailPlannerInput {
  const input: RailPlannerInput = {
    track_count: num(form.track_count) ?? 1,
    assembly_id: form.assembly_id,
    contract_type: form.contract_type,
    project_kind: form.project_kind,
  };
  if (form.length_mode === 'delka') {
    input.section_length_m = num(form.section_length_m);
  } else {
    input.km_od = num(form.km_od);
    input.km_do = num(form.km_do);
  }
  if (form.spacing_code) input.spacing_code = form.spacing_code;
  const fl = num(form.field_length_m);
  if (fl) input.field_length_m = fl;
  const ys = num(form.y_sleeper_spacing_m);
  if (ys) input.y_sleeper_spacing_m = ys;
  const rd = num(form.rail_delivery_length_m);
  if (rd) input.rail_delivery_length_m = rd;

  if (form.ballast_mode === 'preset') {
    input.ballast_profile = { mode: 'preset', preset_id: form.ballast_preset_id };
  } else if (form.ballast_mode === 'area') {
    const a = num(form.ballast_area_m2);
    if (a) input.ballast_profile = { mode: 'area', area_m2: a };
  } else if (form.ballast_mode === 'parametric') {
    const t = num(form.ballast_thickness_m);
    const c = num(form.ballast_crown_m);
    const s = num(form.ballast_slope);
    if (t != null && c != null && s != null) {
      input.ballast_profile = {
        mode: 'parametric',
        thickness_under_sleeper_m: t,
        crown_width_m: c,
        slope_ratio: s,
      };
    }
  }

  const curve = num(form.curve_min_radius_m);
  if (curve) input.curve_min_radius_m = curve;
  const cant = num(form.cant_max_mm);
  if (cant) input.cant_max_mm = cant;
  const izol = num(form.izolovane_styky_ks);
  if (izol) input.izolovane_styky_ks = izol;

  const turnouts = form.turnouts
    .map(t => ({ form_id: t.form_id, count: num(t.count) ?? 0 }))
    .filter(t => t.count > 0);
  if (turnouts.length) input.turnouts = turnouts;

  const o = form.obstacles;
  const obstacles = {
    prejezdy: num(o.prejezdy),
    prechody: num(o.prechody),
    ukolejneni: num(o.ukolejneni),
    pojistne_uhelniky_m: num(o.pojistne_uhelniky_m),
    magneticke_body: num(o.magneticke_body),
  };
  if (Object.values(obstacles).some(v => v != null)) input.obstacles = obstacles;

  const spodek = form.spodek_items
    .map(i => ({ name_cs: i.name_cs.trim(), unit: i.unit.trim() || 'm³', quantity: num(i.quantity) ?? 0, work_type: i.work_type }))
    .filter(i => i.name_cs && i.quantity > 0);
  if (spodek.length) input.spodek_items = spodek;

  if (form.tamping_machine_id) {
    input.machines = [{ work_type: 'podbiti_trate', machine_id: form.tamping_machine_id }];
  }
  const norms = form.user_norms
    .map(n => ({ machine_id: n.machine_id, rate_value: num(n.rate_value) ?? 0, rate_unit: n.rate_unit }))
    .filter(n => n.machine_id && n.rate_value > 0);
  if (norms.length) input.user_machine_norms = norms;

  const shift = num(form.shift_hours);
  if (shift) input.shift_hours = shift;
  const window = num(form.possession_window_h);
  if (window) input.possession_window_h = window;
  const front = num(form.front_length_m);
  if (front) input.front_length_m = front;

  return input;
}

export type ComputeState =
  | { kind: 'ok'; result: RailPlanResult }
  | { kind: 'uncalculated'; reason_cs: string; missing_fields: string[] }
  | { kind: 'invalid'; message: string };

function loadForm(): FormState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_FORM, ...JSON.parse(raw) };
  } catch {
    /* poškozený LS → default */
  }
  return DEFAULT_FORM;
}

export default function App() {
  const [form, setForm] = useState<FormState>(loadForm);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(form));
    } catch {
      /* quota — ignore */
    }
  }, [form]);

  const compute: ComputeState = useMemo(() => {
    try {
      return { kind: 'ok', result: planRailSection(buildInput(form)) };
    } catch (err: any) {
      if (err?.uncalculated === true) {
        return { kind: 'uncalculated', reason_cs: err.reason_cs ?? String(err.message), missing_fields: err.missing_fields ?? [] };
      }
      return { kind: 'invalid', message: err?.message ? String(err.message) : 'Neplatný vstup.' };
    }
  }, [form]);

  return (
    <>
      <header className="zel-header">
        <TrainFront size={18} />
        <h1>Železniční svršek + spodek — kalkulátor</h1>
        <span className="zel-badge">v1 · deterministický engine · data se zdrojem</span>
      </header>
      <div className="zel-layout">
        <RailForm form={form} onChange={setForm} />
        <RailResults compute={compute} />
      </div>
      <footer className="zel-disclaimer">
        Orientační předrasčet pro přípraváře a rozpočtáře (±10–15 %) — technologicky správný rozklad,
        ne projekční výpočet. Hodnoty označené jako orientační pocházejí z KB (technologické listy /
        katalogy) a mají být nahrazeny firemními normami; závazné hodnoty určují ZTP zakázky, předpisy
        správce infrastruktury (S3, S3/1, S3/2, S4, S8/3), TKP staveb státních drah a ČSN 73 6360.
        Detail u dodavatele / správce infrastruktury.
      </footer>
    </>
  );
}
