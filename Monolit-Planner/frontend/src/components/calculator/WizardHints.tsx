/**
 * WizardHints — smart hint panels for the wizard-mode sidebar.
 *
 * Implements HINT-1 / HINT-2 / HINT-3 / HINT-4 from the calculator audit:
 *   - MissingFieldsHint    : 🔴 critical / ⚪ optional gaps per step
 *   - SanityHint           : "Hodnota mimo typický rozsah" with Ponechat/Opravit
 *   - TechnologyHint       : "Doporučení: Framax …" with "Přijmout doporučení"
 *   - ReviewHint           : final summary before "Vypočítat" on step 5
 *
 * All engine calls live in useCalculator hook. This file is presentational
 * with a tiny amount of form-diff logic for accept-recommendation actions.
 */

import { useMemo } from 'react';
import {
  REQUIRED_FIELDS,
  checkSanity,
  getElementProfile,
  calculateLateralPressure,
  filterFormworkByPressure,
  getSuitableSystemsForElement,
  type StructuralElementType,
  type SanityIssue,
} from '@stavagent/monolit-shared';
import type { FormState } from './types';

// ─── Shared styling helpers ─────────────────────────────────────────────────

const hintBoxStyle: React.CSSProperties = {
  margin: '8px 0 12px',
  padding: '10px 12px',
  background: 'var(--r0-info-bg, #fff7ed)',
  border: '1px solid var(--r0-info-border, #fed7aa)',
  borderRadius: 6,
  fontSize: 11,
  lineHeight: 1.6,
  color: 'var(--r0-slate-700)',
};

const hintWarnStyle: React.CSSProperties = {
  ...hintBoxStyle,
  background: '#fffbeb',
  border: '1px solid #fde68a',
};

const hintTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--r0-slate-800)',
  marginBottom: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const smallBtn: React.CSSProperties = {
  fontSize: 10,
  padding: '3px 8px',
  border: '1px solid var(--r0-slate-300)',
  borderRadius: 4,
  background: 'white',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const smallPrimaryBtn: React.CSSProperties = {
  ...smallBtn,
  background: 'var(--r0-orange, #FF9F1C)',
  color: 'white',
  border: 'none',
  fontWeight: 600,
};

// ─── HINT-1: Missing fields ─────────────────────────────────────────────────

export function MissingFieldsHint({
  elementType,
  form,
  wizardStep,
}: {
  elementType: StructuralElementType;
  form: FormState;
  wizardStep: number;
}) {
  const gaps = useMemo(() => {
    const required = REQUIRED_FIELDS[elementType] ?? [];
    const values: Record<string, unknown> = {
      volume_m3: form.volume_m3,
      height_m: form.height_m,
      formwork_area_m2: form.formwork_area_m2,
      total_length_m: form.total_length_m,
      rebar_mass_kg: form.rebar_mass_kg,
      span_m: form.span_m,
      num_spans: form.num_spans,
    };
    return required.filter(r => {
      const v = values[r.field];
      if (v == null) return true;
      if (typeof v === 'string') return v.trim() === '';
      if (typeof v === 'number') return v <= 0;
      return false;
    });
  }, [elementType, form]);

  // Filter by the step the user is on so we don't spam about fields
  // that haven't been asked yet.
  const stepGaps = gaps.filter(g => {
    if (wizardStep <= 1) return false; // step 1 only picks element type
    if (wizardStep === 2) return g.field === 'volume_m3';
    if (wizardStep === 3) return ['height_m', 'formwork_area_m2', 'span_m', 'num_spans', 'total_length_m'].includes(g.field);
    // Later steps: show every remaining gap
    return true;
  });

  if (stepGaps.length === 0) return null;

  return (
    <div style={hintBoxStyle}>
      <div style={hintTitleStyle}>⚠️ Chybí údaje</div>
      {stepGaps.map(g => (
        <div key={g.field} style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <span aria-hidden>{g.severity === 'critical' ? '🔴' : '⚪'}</span>
          <span>
            <strong>{g.label_cs}</strong>
            <span style={{ color: 'var(--r0-slate-500)' }}> — {g.reason_cs}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── HINT-2: Sanity check ───────────────────────────────────────────────────

export function SanityHint({
  elementType,
  form,
  onKeep,
}: {
  elementType: StructuralElementType;
  form: FormState;
  onKeep?: (field: string) => void;
}) {
  const issues: SanityIssue[] = useMemo(() => {
    const values: Parameters<typeof checkSanity>[1] = {};
    if (form.volume_m3 > 0) values.volume_m3 = form.volume_m3;
    const h = parseFloat(form.height_m);
    if (Number.isFinite(h) && h > 0) values.height_m = h;
    const fa = parseFloat(form.formwork_area_m2);
    if (Number.isFinite(fa) && fa > 0) values.formwork_area_m2 = fa;
    // rebar_kg_m3: derive from mass / volume if user gave mass
    const mass = parseFloat(form.rebar_mass_kg);
    if (Number.isFinite(mass) && mass > 0 && form.volume_m3 > 0) {
      values.rebar_kg_m3 = mass / form.volume_m3;
    } else if (form.rebar_norm_kg_m3) {
      const norm = parseFloat(form.rebar_norm_kg_m3);
      if (Number.isFinite(norm) && norm > 0) values.rebar_kg_m3 = norm;
    }
    return checkSanity(elementType, values);
  }, [elementType, form.volume_m3, form.height_m, form.formwork_area_m2, form.rebar_mass_kg, form.rebar_norm_kg_m3]);

  if (issues.length === 0) return null;

  return (
    <div style={hintWarnStyle}>
      <div style={hintTitleStyle}>🔍 Neobvyklé hodnoty</div>
      {issues.map(iss => (
        <div key={iss.field} style={{ marginTop: 6, padding: 6, background: 'white', borderRadius: 4 }}>
          <div>{iss.message_cs}</div>
          <div style={{ marginTop: 4, color: 'var(--r0-slate-500)' }}>
            Typický rozsah: <strong>{iss.min}–{iss.max}</strong>
          </div>
          {onKeep && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" style={smallBtn} onClick={() => onKeep(iss.field)}>
                Ponechat {iss.value}
              </button>
              <span style={{ fontSize: 10, color: 'var(--r0-slate-400)', alignSelf: 'center' }}>
                (upravit v poli výše)
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── HINT-3: Technology recommendation ─────────────────────────────────────

export interface TechRecommendation {
  label: string;
  detail: string;
  apply?: () => void;
}

export function TechnologyHint({
  elementType,
  heightStr,
  currentSystemName,
  onApply,
}: {
  elementType: StructuralElementType;
  heightStr: string;
  currentSystemName: string;
  onApply: (systemName: string, numTacts?: number) => void;
}) {
  const rec = useMemo<TechRecommendation | null>(() => {
    const profile = (() => { try { return getElementProfile(elementType); } catch { return null; } })();
    if (!profile || profile.orientation !== 'vertical') return null;
    const h = parseFloat(heightStr);
    if (!h || h <= 0) return null;

    const pressure = calculateLateralPressure(h, 'pump', { concrete_consistency: 'standard' });
    const { all } = getSuitableSystemsForElement(elementType);
    const filtered = filterFormworkByPressure(pressure.pressure_kn_m2, all, 'vertical', h);
    if (!filtered.suitable.length) return null;
    const best = filtered.suitable[0];
    if (!best) return null;

    // How many záběry does the recommended system need?
    let stages = 1;
    const catMax = best.max_pour_height_m ?? Infinity;
    const pressureMax = best.pressure_kn_m2 != null
      ? (best.pressure_kn_m2 / Math.max(1e-6, pressure.pressure_kn_m2)) * h
      : Infinity;
    const eff = Math.min(catMax, pressureMax);
    if (eff < h) stages = Math.max(1, Math.ceil(h / eff));

    const detailParts = [
      `${stages} záběr${stages === 1 ? '' : stages <= 4 ? 'y' : 'ů'}`,
    ];
    if (best.needs_crane) detailParts.push('jeřáb nutný');
    detailParts.push(`boční tlak ${pressure.pressure_kn_m2} kN/m²`);

    return {
      label: best.name,
      detail: detailParts.join(' · '),
      apply: () => onApply(best.name, stages),
    };
  }, [elementType, heightStr, onApply]);

  if (!rec) return null;

  const alreadyApplied = currentSystemName && currentSystemName === rec.label;

  return (
    <div style={hintBoxStyle}>
      <div style={hintTitleStyle}>💡 Doporučení</div>
      <div>
        Bednění: <strong>{rec.label}</strong>
      </div>
      <div style={{ color: 'var(--r0-slate-500)', marginTop: 2 }}>{rec.detail}</div>
      {!alreadyApplied && rec.apply && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button type="button" style={smallPrimaryBtn} onClick={rec.apply}>
            Přijmout doporučení
          </button>
        </div>
      )}
      {alreadyApplied && (
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--r0-slate-500)' }}>
          ✓ Již použito v konfiguraci
        </div>
      )}
    </div>
  );
}

// ─── HINT-4: Review summary ────────────────────────────────────────────────

export function ReviewHint({
  elementType,
  form,
}: {
  elementType: StructuralElementType;
  form: FormState;
}) {
  const profile = (() => { try { return getElementProfile(elementType); } catch { return null; } })();
  if (!profile) return null;

  const h = parseFloat(form.height_m) || 0;
  const consistencyLabel = 'standard beton (k=0.85)'; // HINT-4 warns when SCC not used
  const rebarRatio = form.rebar_mass_kg
    ? (parseFloat(form.rebar_mass_kg) / Math.max(0.01, form.volume_m3)).toFixed(0)
    : String(profile.rebar_ratio_kg_m3);

  const rows: Array<[string, string]> = [
    ['Element', profile.label_cs],
    ['Objem', `${form.volume_m3} m³, ${form.concrete_class}`],
  ];
  if (h > 0) rows.push(['Výška', `${h} m`]);
  rows.push(['Výztuž', `~${rebarRatio} kg/m³`]);
  rows.push([
    'Čety',
    `${form.num_formwork_crews}× ${form.crew_size} (bednění) + ${form.num_rebar_crews}× ${form.crew_size_rebar} (výztuž)`,
  ]);

  const warnings: string[] = [];
  // Pracovní spáry not confirmed warning
  if (!form.has_dilatacni_spary) {
    warnings.push('Pracovní spáry: neurčeno (ověřit v RDS)');
  }
  warnings.push(`k-factor: ${consistencyLabel}`);

  return (
    <div style={{ ...hintBoxStyle, background: '#f1f5f9', border: '1px solid var(--r0-slate-300)' }}>
      <div style={hintTitleStyle}>🧾 Shrnutí před výpočtem</div>
      <table style={{ width: '100%', fontSize: 11 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ color: 'var(--r0-slate-500)', padding: '2px 0' }}>{k}</td>
              <td style={{ textAlign: 'right', padding: '2px 0' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {warnings.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--r0-slate-300)' }}>
          {warnings.map(w => (
            <div key={w} style={{ color: 'var(--r0-slate-500)' }}>⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bundle all hints as one component to reduce plumbing in the sidebar ──

export interface WizardHintsPanelProps {
  wizardMode: boolean;
  wizardStep: number;
  elementType: StructuralElementType;
  form: FormState;
  currentSystemName: string;
  onApplyRecommendedSystem: (systemName: string, numTacts?: number) => void;
  /** When SANITY_RANGES has an entry the user marks "Ponechat", we just hide the hint */
  onKeepSanity?: (field: string) => void;
}

export default function WizardHintsPanel(props: WizardHintsPanelProps) {
  const { wizardMode, wizardStep, elementType, form, currentSystemName, onApplyRecommendedSystem, onKeepSanity } = props;
  if (!wizardMode) return null;
  return (
    <>
      {/* HINT-1 on every non-trivial step */}
      <MissingFieldsHint elementType={elementType} form={form} wizardStep={wizardStep} />
      {/* HINT-2 sanity check once user has entered numbers (step 2+) */}
      {wizardStep >= 2 && <SanityHint elementType={elementType} form={form} onKeep={onKeepSanity} />}
      {/* HINT-3 on step 3 when geometry is in */}
      {wizardStep >= 3 && (
        <TechnologyHint
          elementType={elementType}
          heightStr={form.height_m}
          currentSystemName={currentSystemName}
          onApply={onApplyRecommendedSystem}
        />
      )}
      {/* HINT-4 review summary on final step */}
      {wizardStep === 5 && <ReviewHint elementType={elementType} form={form} />}
    </>
  );
}
