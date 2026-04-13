/**
 * CalculatorResult — Result display for the Kalkulátor betonáže.
 * Extracted from PlannerPage.tsx (PlanResult function).
 *
 * Shows: KPI cards, variants, warnings, element/pour/formwork/rebar/props,
 * schedule/Gantt, costs summary, norms sources, decision log.
 */

import { useMemo } from 'react';
import { TriangleAlert, Blocks, Siren, Zap, CircleCheckBig, Star, CalendarDays, DollarSign } from 'lucide-react';
import { addWorkDays, type PlannerOutput } from '@stavagent/monolit-shared';
import PlannerGantt from '../PlannerGantt';
import { exportPlanToXLSX } from '../../utils/exportPlanXLSX';
import { Card, KPICard, Row, CollapsibleSection } from './ui';
import { formatCZK, formatNum, formatWorkDayRange, subTitle, thStyle, tdStyle } from './helpers';
import InlineResourcePanel from './InlineResourcePanel';
import type { FormState } from './types';

// ─── CSV Export (local helper) ─────────────────────────────────────────────

function exportPlanToCSV(plan: PlannerOutput, startDate: string) {
  const BOM = '\uFEFF';
  const lines: string[] = [];
  const add = (label: string, value: string) => lines.push(`"${label}","${value}"`);

  add('Element', plan.element.label_cs);
  add('Režim betonáže', `${plan.pour_decision.pour_mode} / ${plan.pour_decision.sub_mode}`);
  add('Počet záběrů', String(plan.pour_decision.num_tacts));
  add('Objem / záběr (m³)', String(plan.pour_decision.tact_volume_m3));
  add('Celkem dní (prac.)', String(plan.schedule.total_days));
  add('Sekvenčně (dní)', String(plan.schedule.sequential_days));
  add('Úspora (%)', String(plan.schedule.savings_pct));
  add('Bednění - systém', plan.formwork.system.name);
  add('Montáž (dní/záběr)', String(plan.formwork.assembly_days));
  add('Zrání (dní)', String(plan.formwork.curing_days));
  add('Demontáž (dní/záběr)', String(plan.formwork.disassembly_days));
  add('Náklady - bednění práce (Kč)', String(Math.round(plan.costs.formwork_labor_czk)));
  add('Náklady - výztuž práce (Kč)', String(Math.round(plan.costs.rebar_labor_czk)));
  add('Náklady - betonáž práce (Kč)', String(Math.round(plan.costs.pour_labor_czk)));
  add('Náklady - pronájem bednění (Kč)', String(Math.round(plan.costs.formwork_rental_czk)));
  add('Celkem práce (Kč)', String(Math.round(plan.costs.total_labor_czk)));
  add('Celkem vše (Kč)', String(Math.round(plan.costs.total_labor_czk + plan.costs.formwork_rental_czk)));
  if (plan.monte_carlo) {
    add('P50 (dní)', String(plan.monte_carlo.p50));
    add('P80 (dní)', String(plan.monte_carlo.p80));
    add('P90 (dní)', String(plan.monte_carlo.p90));
  }

  if (plan.schedule.tact_details?.length) {
    lines.push('');
    lines.push('"Záběr","Sada","Montáž od","Montáž do","Beton od","Beton do","Zrání od","Zrání do","Demontáž od","Demontáž do"');
    for (const td of plan.schedule.tact_details) {
      lines.push(`"T${td.tact}","S${td.set}","${td.assembly[0]}","${td.assembly[1]}","${td.concrete[0]}","${td.concrete[1]}","${td.curing[0]}","${td.curing[1]}","${td.stripping[0]}","${td.stripping[1]}"`);
    }
  }

  const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plan_${plan.element.type}_${startDate || 'export'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface CalculatorResultProps {
  plan: PlannerOutput;
  startDate: string;
  showLog: boolean;
  onToggleLog: () => void;
  scenarios?: any[];
  applyStatus: 'idle' | 'saving' | 'saved' | 'error';
  onApplyToPosition?: () => void;
  savedVariants?: Array<{ id: string; label: string; total_days: number; total_cost_czk: number; is_plan?: boolean }>;
  onSaveVariant?: () => void;
  onLoadVariant?: (variant: any) => void;
  onRemoveVariant?: (id: string) => void;
  onSetAsPlan?: (id: string) => void;
  kridlaFormwork?: { system: { name: string; manufacturer: string; rental_czk_m2_month: number; needs_crane?: boolean }; height_m: number } | null;
  calcStatus?: 'idle' | 'calculating';
  resultDirty?: boolean;
  /** Part C: Inline resource panel — requires form + update for editing */
  form?: FormState;
  updateForm?: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function CalculatorResult({ plan, startDate, showLog, onToggleLog, scenarios, applyStatus, onApplyToPosition, savedVariants, onSaveVariant: _onSaveVariant, onLoadVariant, onRemoveVariant, onSetAsPlan, kridlaFormwork, calcStatus, resultDirty, form, updateForm }: CalculatorResultProps) {
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
      {/* Action buttons */}
      <div className="r0-action-bar">
        <button
          onClick={() => { exportPlanToXLSX(plan as any, startDate, scenarios && scenarios.length > 0 ? scenarios : undefined); }}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            borderRadius: 6, fontFamily: 'inherit',
            background: 'var(--r0-green-dark)', color: 'white',
          }}
        >
          Stáhnout Excel (.xlsx)
        </button>
        <button
          onClick={() => exportPlanToCSV(plan, startDate)}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--r0-slate-300)',
            cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit',
            background: 'white', color: 'var(--r0-slate-700)',
          }}
        >
          Stáhnout CSV
        </button>
        {onApplyToPosition && (
          <button
            onClick={onApplyToPosition}
            disabled={applyStatus === 'saving'}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              borderRadius: 6, fontFamily: 'inherit',
              background: applyStatus === 'saved' ? '#22c55e' : applyStatus === 'error' ? '#ef4444' : '#FF9F1C',
              color: 'white',
              opacity: applyStatus === 'saving' ? 0.6 : 1,
            }}
          >
            {applyStatus === 'saving' ? '⏳ Ukládám...' :
             applyStatus === 'saved' ? 'Uloženo' :
             applyStatus === 'error' ? '❌ Chyba' :
             '📋 Aplikovat do pozice'}
          </button>
        )}
        <button
          onClick={() => {
            navigator.clipboard.writeText(plan.schedule.gantt || '');
            alert('Gantt zkopírován do schránky');
          }}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--r0-slate-300)',
            cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit',
            background: 'white', color: 'var(--r0-slate-700)',
          }}
        >
          Kopírovat Gantt
        </button>
      </div>

      {/* Saved variants comparison (Monolit mode only) */}
      {savedVariants && savedVariants.length > 0 && (
        <div style={{
          marginBottom: 16, padding: 12, background: 'var(--r0-slate-50)',
          borderRadius: 8, border: '1px solid var(--r0-slate-200)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--r0-slate-700)' }}>
            Uložené varianty ({savedVariants.length})
          </div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--r0-slate-200)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>#</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>Konfigurace</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>Dní</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>Náklady</th>
                <th style={{ textAlign: 'center', padding: '4px 8px' }}>Stav</th>
                <th style={{ textAlign: 'center', padding: '4px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {savedVariants.map((v: any, i: number) => (
                <tr key={v.id} style={{
                  borderBottom: '1px solid var(--r0-slate-100)',
                  background: v.is_plan ? 'rgba(34,197,94,0.06)' : undefined,
                }}>
                  <td style={{ padding: '6px 8px', color: 'var(--r0-slate-400)' }}>{i + 1}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 500, cursor: onLoadVariant ? 'pointer' : 'default' }}
                      onClick={() => onLoadVariant && onLoadVariant(v)}>
                    {v.label}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>{v.total_days}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>{Math.round(v.total_cost_czk).toLocaleString('cs')} Kč</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {v.is_plan && <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: '#dcfce7', color: '#166534', fontWeight: 700,
                    }}>✓ PLÁN</span>}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {onSetAsPlan && !v.is_plan && <button onClick={() => onSetAsPlan(v.id)} style={{
                      fontSize: 10, padding: '2px 6px', border: '1px solid var(--r0-slate-300)',
                      borderRadius: 4, cursor: 'pointer', background: 'white', fontFamily: 'inherit', marginRight: 4,
                    }} title="Označit jako plán">✓</button>}
                    {onLoadVariant && <button onClick={() => onLoadVariant(v)} style={{
                      fontSize: 11, padding: '2px 8px', border: '1px solid var(--r0-slate-300)',
                      borderRadius: 4, cursor: 'pointer', background: 'white', fontFamily: 'inherit', marginRight: 4,
                    }}>Načíst</button>}
                    {onRemoveVariant && <button onClick={() => {
                      if (v.is_plan && !confirm('Tato varianta je označena jako PLÁN. Opravdu smazat?')) return;
                      onRemoveVariant(v.id);
                    }} style={{
                      fontSize: 11, padding: '2px 6px', border: '1px solid var(--r0-slate-200)',
                      borderRadius: 4, cursor: 'pointer', background: 'white', color: 'var(--r0-slate-400)', fontFamily: 'inherit',
                    }}>✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Part C: Inline resource panel — edit resources without re-entering wizard */}
      {form && updateForm && (
        <InlineResourcePanel
          form={form}
          update={updateForm}
          calcStatus={calcStatus}
          resultDirty={resultDirty}
        />
      )}

      {/* Auto-calc indicator */}
      {(calcStatus === 'calculating' || resultDirty) && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 12px', marginBottom: 10,
          background: calcStatus === 'calculating' ? 'var(--r0-info-bg, #eff6ff)' : 'var(--r0-slate-50, #f8fafc)',
          border: `1px solid ${calcStatus === 'calculating' ? 'var(--r0-info-border, #bfdbfe)' : 'var(--r0-slate-200, #e2e8f0)'}`,
          borderRadius: 4, fontSize: 11,
          color: calcStatus === 'calculating' ? 'var(--r0-info-text, #1e40af)' : 'var(--r0-slate-500, #64748b)',
        }}>
          {calcStatus === 'calculating'
            ? <><span className="flat-spinner" style={{ width: 10, height: 10 }} /> Počítám…</>
            : 'Čekám na zastavení vstupu…'}
        </div>
      )}

      {/* KPI Cards */}
      <div className="r0-grid-4" style={{ marginBottom: 20 }}>
        <KPICard label={plan.deadline_check && !plan.deadline_check.fits ? `Celkem dní (termín ${plan.deadline_check.deadline_days}d)` : 'Celkem dní'} value={plan.schedule.total_days} unit={calendarInfo ? `prac. dní (${calendarInfo.calendarDays} kal.)` : 'prac. dní'} color={plan.deadline_check && !plan.deadline_check.fits ? '#ef4444' : 'var(--r0-blue)'} />
        <KPICard label="Počet záběrů" value={plan.pour_decision.num_tacts} unit="taktů" color="var(--r0-orange)" />
        <KPICard label="Náklady práce" value={formatCZK(plan.costs.total_labor_czk)} color="var(--r0-green)" />
        <KPICard label="Úspora vs. sekvenční" value={plan.schedule.savings_pct + '%'} color={plan.schedule.savings_pct > 0 ? 'var(--r0-green)' : 'var(--r0-slate-400)'} />
      </div>

      {/* Resource Optimization + Deadline Check */}
      {plan.deadline_check && (() => {
        const dc = plan.deadline_check;
        const hasDeadline = dc.deadline_days != null;
        const hasSuggestions = dc.suggestions.length > 0;
        const deadlineExceeded = hasDeadline && !dc.fits;
        const title = deadlineExceeded
          ? `Termín investora — PŘEKROČEN (+${dc.overrun_days}d)`
          : hasSuggestions
            ? 'Optimalizace zdrojů'
            : 'Optimalizace zdrojů — aktuální nastavení je optimální';
        const icon = deadlineExceeded ? <Siren size={16} /> : hasSuggestions ? <Zap size={16} /> : <CircleCheckBig size={16} />;
        const borderColor = deadlineExceeded ? '#ef4444' : hasSuggestions ? 'var(--r0-blue)' : 'var(--r0-green)';

        return (
          <Card title={title} icon={icon} borderColor={borderColor}>
            <div style={{ fontSize: 13 }}>
              {deadlineExceeded && (
                <div style={{
                  marginBottom: 12, padding: '10px 14px', borderRadius: 6,
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                  fontWeight: 600,
                }}>
                  Termín: {dc.deadline_days} dní | Vypočteno: {dc.calculated_days} dní | Překročení: +{dc.overrun_days} dní ({Math.round((dc.overrun_days / dc.deadline_days!) * 100)}%)
                </div>
              )}

              {hasSuggestions ? (
                <>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>#</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Konfigurace</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Dní</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Úspora dní</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Náklady</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Rozdíl Kč</th>
                        {hasDeadline && <th style={{ textAlign: 'center', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Termín</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {dc.suggestions.map((s, i) => {
                        const isBestDeadline = hasDeadline && dc.best_for_deadline && s.label === dc.best_for_deadline.label;
                        return (
                          <tr key={i} style={{
                            borderBottom: '1px solid var(--r0-slate-100)',
                            background: isBestDeadline ? '#f0fdf4' : i === 0 ? '#eff6ff' : 'transparent',
                            fontWeight: isBestDeadline || i === 0 ? 600 : 400,
                          }}>
                            <td style={{ padding: '5px 6px' }}>{isBestDeadline ? <Star size={14} /> : i + 1}</td>
                            <td style={{ padding: '5px 6px' }}>{s.label}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatNum(s.total_days, 1)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>
                              −{formatNum(dc.calculated_days - s.total_days, 1)}
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatCZK(s.total_cost_czk)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', color: s.extra_cost_czk > 0 ? '#dc2626' : '#16a34a' }}>
                              {s.extra_cost_czk > 0 ? '+' : ''}{formatCZK(s.extra_cost_czk)}
                            </td>
                            {hasDeadline && (
                              <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                                {s.fits_deadline ? <span style={{ color: '#16a34a' }}>OK</span> : <span style={{ color: '#dc2626' }}>NE</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 6, background: 'var(--r0-slate-50, #f8fafc)', fontSize: 12 }}>
                    {dc.fastest && (
                      <span>
                        <strong>Nejrychlejší:</strong> {formatNum(dc.fastest.total_days, 1)} dní ({dc.fastest.label})
                        {dc.fastest.extra_cost_czk > 0 && <span style={{ color: '#dc2626' }}> +{formatCZK(dc.fastest.extra_cost_czk)}</span>}
                      </span>
                    )}
                    {dc.cheapest_faster && dc.fastest && dc.cheapest_faster.label !== dc.fastest.label && (
                      <span>
                        {' | '}<strong>Nejlevnější zrychlení:</strong> {formatNum(dc.cheapest_faster.total_days, 1)} dní
                        {dc.cheapest_faster.extra_cost_czk > 0
                          ? <span style={{ color: '#dc2626' }}> +{formatCZK(dc.cheapest_faster.extra_cost_czk)}</span>
                          : <span style={{ color: '#16a34a' }}> {formatCZK(dc.cheapest_faster.extra_cost_czk)}</span>
                        }
                      </span>
                    )}
                  </div>

                  {deadlineExceeded && dc.best_for_deadline && (
                    <div style={{
                      marginTop: 8, padding: '10px 14px', borderRadius: 6,
                      background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
                    }}>
                      <strong>Pro splnění termínu:</strong> {dc.best_for_deadline.label} → {formatNum(dc.best_for_deadline.total_days, 1)} dní
                      {dc.best_for_deadline.extra_cost_czk > 0 && (
                        <span> (navíc {formatCZK(dc.best_for_deadline.extra_cost_czk)})</span>
                      )}
                    </div>
                  )}
                  {deadlineExceeded && !dc.best_for_deadline && (
                    <div style={{
                      marginTop: 8, padding: '10px 14px', borderRadius: 6,
                      background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                    }}>
                      Žádná kombinace zdrojů (až 4 čety, 6 sad) nesplní termín {dc.deadline_days} dní.
                      Zvažte delší směny, jiný systém bednění, nebo úpravu projektu.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--r0-slate-500)', fontStyle: 'italic' }}>
                  Aktuální konfigurace je již optimální — přidání čet nebo sad nezrychlí harmonogram.
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <Card title="Varování" icon={<TriangleAlert size={16} className="inline" />} borderColor="var(--r0-orange)">
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--r0-warn-text)' }}>
            {plan.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
          </ul>
        </Card>
      )}

      {/* Element + Pour */}
      <div className="r0-grid-2">
        <Card title="Element" icon={<Blocks size={16} />}>
          <Row label="Typ" value={plan.element.label_cs} />
          <Row label="Klasifikace" value={`${(plan.element.classification_confidence * 100).toFixed(0)}%${
            plan.element.profile.classification_source === 'otskp' ? ' (OTSKP katalog)' :
            plan.element.profile.classification_source === 'keywords' ? ' (klíčová slova)' : ''
          }`} />
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
          <Row label="Úzké hrdlo" value={plan.pour.rate_bottleneck} />
        </Card>
      </div>

      {/* Formwork */}
      <Card title="Bednění" icon="📦">
        <div className="r0-grid-3">
          <div>
            <div style={subTitle}>Systém</div>
            <Row label="Název" value={plan.formwork.system.name} />
            <Row label="Výrobce" value={plan.formwork.system.manufacturer} />
            <Row label="Pronájem" value={plan.formwork.system.rental_czk_m2_month > 0
              ? `${formatNum(plan.formwork.system.rental_czk_m2_month, 0)} Kč/m²/měs`
              : 'Bez pronájmu'} />
            <Row label="Tesařů celkem" value={`${plan.resources?.total_formwork_workers ?? '-'} (${plan.resources?.num_formwork_crews ?? 1}×${plan.resources?.crew_size_formwork ?? '-'})`} />
            {plan.props?.needed && (
              <Row label="Podpěra" value={`${plan.props.system.name} (${plan.props.system.manufacturer}), ${plan.props.num_props_per_tact} ks`} bold />
            )}
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

      {/* Křídla formwork (composite opěry+křídla) */}
      {kridlaFormwork && (
        <Card title="Bednění křídel" icon="📦">
          <div className="r0-grid-2">
            <div>
              <Row label="Systém" value={kridlaFormwork.system.name} bold />
              <Row label="Výrobce" value={kridlaFormwork.system.manufacturer} />
              <Row label="Výška křídel" value={`${kridlaFormwork.height_m} m`} />
              <Row label="Pronájem" value={kridlaFormwork.system.rental_czk_m2_month > 0
                ? `${formatNum(kridlaFormwork.system.rental_czk_m2_month, 0)} Kč/m²/měs`
                : 'Bez pronájmu'} />
            </div>
            <div>
              <Row label="Jeřáb" value={kridlaFormwork.system.needs_crane ? 'Nutný (panel > 150 kg)' : 'Nepotřebuje'} />
              {kridlaFormwork.height_m > 1.2 && (
                <Row label="Vzpěry" value="IB vzpěry nutné (h > 1.2 m)" />
              )}
              <div style={{ fontSize: 10, color: 'var(--r0-slate-400)', marginTop: 8 }}>
                Samostatná sada bednění — křídla se betonují jako oddělený záběr od dříku opěry.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Rebar */}
      <Card title="Výztuž" icon="🔩">
        {(() => {
          const nTacts = plan.pour_decision.num_tacts;
          const totalMassKg = plan.rebar.mass_kg * nTacts;
          const totalMassT = totalMassKg / 1000;
          return (
            <>
              <div className="r0-grid-2" style={{ gap: 16 }}>
                <div>
                  <Row label="Hmotnost celkem" value={totalMassT >= 1 ? `${formatNum(totalMassT, 1)} t` : `${formatNum(totalMassKg, 0)} kg`} bold />
                  <Row label="Hmotnost / záběr" value={`${formatNum(plan.rebar.mass_kg, 0)} kg`} />
                  <Row label="Zdroj" value={plan.rebar.mass_source === 'estimated' ? 'Odhad z profilu' : 'Zadaná hodnota'} />
                  <Row label="Doba / záběr" value={`${formatNum(plan.rebar.duration_days)} dní`} />
                </div>
                <div>
                  <Row label="Náklady celkem" value={formatCZK(plan.rebar.cost_labor * nTacts)} bold />
                  <Row label="Náklady / záběr" value={formatCZK(plan.rebar.cost_labor)} />
                  <Row label="Železářů celkem" value={`${plan.resources?.total_rebar_workers ?? plan.rebar.crew_size} (${plan.resources?.num_rebar_crews ?? 1}×${plan.resources?.crew_size_rebar ?? plan.rebar.crew_size})`} />
                  {plan.rebar.recommended_crew !== plan.rebar.crew_size && (
                    <div style={{
                      background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6,
                      padding: '4px 8px', marginTop: 4,
                    }}>
                      <Row label={<><TriangleAlert size={14} className="inline" /> Doporučeno</>} value={`${plan.rebar.recommended_crew} pracovníků`} bold />
                    </div>
                  )}
                  <Row label="Norma" value={`${plan.rebar.norm_h_per_t} h/t`} />
                </div>
              </div>
              <div className="r0-pert-row" style={{ color: '#666' }}>
                <span>PERT: optimistická {formatNum(plan.rebar.optimistic_days)} d</span>
                <span>| nejpravděpodobnější {formatNum(plan.rebar.most_likely_days)} d</span>
                <span>| pesimistická {formatNum(plan.rebar.pessimistic_days)} d</span>
              </div>
            </>
          );
        })()}
      </Card>

      {/* Props (podpěry) */}
      {plan.props && plan.props.needed && (
        <Card title="Podpěrná konstrukce (stojky / skruž)" icon="🏗️">
          <div className="r0-grid-3">
            <div>
              <div style={subTitle}>Systém</div>
              <Row label="Typ" value={plan.props.system.name} />
              <Row label="Výrobce" value={plan.props.system.manufacturer} />
              <Row label="Raster" value={`${plan.props.grid_spacing_m} × ${plan.props.grid_spacing_m} m`} />
              <Row label="Počet stojek" value={`${plan.props.num_props_per_tact} ks`} bold />
            </div>
            <div>
              <div style={subTitle}>Časy (na záběr)</div>
              <Row label="Montáž" value={`${plan.props.assembly_days} dní`} />
              <Row label="Ponechání" value={`${plan.props.hold_days} dní`} bold />
              <Row label="Demontáž" value={`${plan.props.disassembly_days} dní`} />
              <Row label="Pronájem celkem" value={`${plan.props.rental_days} dní`} />
            </div>
            <div>
              <div style={subTitle}>Náklady</div>
              <Row label="Pronájem" value={formatCZK(plan.props.rental_cost_czk)} />
              <Row label="Práce" value={formatCZK(plan.props.labor_cost_czk)} />
              <Row label="Celkem" value={formatCZK(plan.props.total_cost_czk)} bold />
              <Row label="Hmotnost" value={`${(plan.props.total_weight_kg / 1000).toFixed(1)} t`} />
              {plan.props.crane_needed && (
                <Row label="Jeřáb" value="Nutný pro montáž" />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Bridge Technology (MSS / Fixed) */}
      {plan.bridge_technology && (
        <Card title={`Technologie: ${plan.bridge_technology.technology_label_cs}`} icon="🌉" borderColor="var(--r0-blue)">
          <Row label="Technologie" value={plan.bridge_technology.technology_label_cs} bold />
          <Row label="Doporučení" value={plan.bridge_technology.recommendation.recommended === plan.bridge_technology.technology ? 'Shoduje se s doporučením' : 'Uživatelský výběr'} />

          {plan.bridge_technology.mss_schedule && (
            <div style={{ marginTop: 8 }}>
              <div style={subTitle}>Harmonogram MSS</div>
              <Row label="Montáž MSS" value={`${plan.bridge_technology.mss_schedule.setup_days} dní`} />
              <Row label="Taktů" value={`${plan.bridge_technology.mss_schedule.num_tacts}`} />
              <Row label="Doba taktu" value={`${plan.bridge_technology.mss_schedule.tact_days} dní`} />
              <Row label="Demontáž MSS" value={`${plan.bridge_technology.mss_schedule.teardown_days} dní`} />
              <Row label="Celkem MSS" value={`${plan.bridge_technology.mss_schedule.total_days} dní`} bold />
              <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginTop: 4 }}>
                = montáž {plan.bridge_technology.mss_schedule.setup_days}d
                + {plan.bridge_technology.mss_schedule.num_tacts} × {plan.bridge_technology.mss_schedule.tact_days}d
                + demontáž {plan.bridge_technology.mss_schedule.teardown_days}d
              </div>
            </div>
          )}

          {plan.bridge_technology.mss_cost && (
            <div style={{ marginTop: 8 }}>
              <div style={subTitle}>Náklady MSS</div>
              <Row label="Mobilizace" value={formatCZK(plan.bridge_technology.mss_cost.mobilization_czk)} />
              <Row label="Pronájem" value={`${formatCZK(plan.bridge_technology.mss_cost.rental_czk_month)}/měs × ${plan.bridge_technology.mss_cost.rental_months} měs`} />
              <Row label="Pronájem celkem" value={formatCZK(plan.bridge_technology.mss_cost.rental_total_czk)} />
              <Row label="Demobilizace" value={formatCZK(plan.bridge_technology.mss_cost.demobilization_czk)} />
              <Row label="Celkem MSS" value={formatCZK(plan.bridge_technology.mss_cost.total_czk)} bold />
              <Row label="JC" value={`${plan.bridge_technology.mss_cost.unit_cost_czk_m2.toLocaleString('cs')} Kč/m² NK`} />
              <Row label="Plocha NK" value={`${plan.bridge_technology.mss_cost.nk_area_m2.toLocaleString('cs')} m²`} />
            </div>
          )}
        </Card>
      )}

      {/* Schedule / Gantt */}
      <CollapsibleSection title="Harmonogram" icon={<CalendarDays size={16} />} defaultOpen={true} mobileDefaultOpen={false}>
        <div className={calendarInfo ? 'r0-grid-4' : 'r0-grid-3'} style={{ marginBottom: 12 }}>
          <Row label="Celkem (prac.)" value={`${plan.schedule.total_days} dní`} bold />
          <Row label="Sekvenčně" value={`${plan.schedule.sequential_days} dní`} />
          <Row label="Úspora" value={`${plan.schedule.savings_pct}%`} bold />
          {calendarInfo && (
            <Row label="Kalendářně" value={`${calendarInfo.calendarDays} dní`} />
          )}
        </div>

        {calendarInfo && (
          <div className="r0-calendar-banner">
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

        {plan.schedule.tact_details && plan.schedule.tact_details.length > 0 && (
          <PlannerGantt
            tact_details={plan.schedule.tact_details}
            total_days={plan.schedule.total_days}
            ganttText={plan.schedule.gantt}
            mode={startDate ? 'calendar' : 'relative'}
            startDate={startDate}
          />
        )}

        {calendarInfo && plan.schedule.tact_details && plan.schedule.tact_details.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--r0-slate-600)', marginBottom: 4 }}>
              Kalendářní milníky (záběry)
            </div>
            <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginBottom: 8 }}>
              Datumy = kalendářní rozsah (vč. víkendů). Samotná betonáž trvá{' '}
              <strong style={{ color: 'var(--r0-phase-concrete, #f59e0b)' }}>
                {plan.pour.total_pour_hours < 1
                  ? `${Math.round(plan.pour.total_pour_hours * 60)} min`
                  : `${formatNum(plan.pour.total_pour_hours)} h`}
              </strong> / záběr ({formatNum(plan.pour.effective_rate_m3_h)} m³/h).
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
                    <th style={thStyle}>Záběr</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-assembly)' }}>Montáž</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-rebar)' }}>Výztuž</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-concrete)' }}>Beton</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-curing)' }}>Zrání</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-stripping)' }}>Demontáž</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.schedule.tact_details.map(td => (
                    <tr key={td.tact} style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={tdStyle}><strong>T{td.tact}</strong> <span style={{ color: 'var(--r0-slate-400)' }}>S{td.set}</span></td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-assembly)' }}>{formatWorkDayRange(calendarInfo.start, td.assembly)}</td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-rebar)' }}>{formatWorkDayRange(calendarInfo.start, td.rebar)}</td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-concrete)' }}>{formatWorkDayRange(calendarInfo.start, td.concrete)}</td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-curing)' }}>{formatWorkDayRange(calendarInfo.start, td.curing)}</td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-stripping)' }}>{formatWorkDayRange(calendarInfo.start, td.stripping)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Monte Carlo */}
      {plan.monte_carlo && (
        <Card title="Monte Carlo (PERT)" icon="🎲">
          <div className="r0-grid-4">
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
      <CollapsibleSection title="Souhrn nákladů" icon={<DollarSign size={16} />} defaultOpen={true} mobileDefaultOpen={false}>
        {(() => {
          const propsLabor = plan.costs.props_labor_czk || 0;
          const propsRental = plan.costs.props_rental_czk || 0;
          const totalAll = plan.costs.total_labor_czk + plan.costs.formwork_rental_czk + propsLabor + propsRental;
          const nT = plan.pour_decision.num_tacts;
          const k = 0.8;
          const fwDays = (plan.formwork.assembly_days + plan.formwork.disassembly_days) * nT;
          const fwH = fwDays * plan.resources.crew_size_formwork * plan.resources.shift_h * k;
          const rbDays = plan.rebar.duration_days * nT;
          const rbH = rbDays * plan.resources.crew_size_rebar * plan.resources.shift_h * k;
          const pourH = plan.pour.total_pour_hours * nT;
          const rentalDays = plan.schedule.total_days + 2;
          const rentalMonths = (rentalDays / 30).toFixed(1);
          const cs = { padding: '4px 10px', fontSize: 12, fontFamily: "var(--r0-font-mono, 'JetBrains Mono', monospace)", textAlign: 'right' as const, whiteSpace: 'nowrap' as const };
          const cl = { ...cs, textAlign: 'left' as const, color: 'var(--r0-slate-500)' };
          const cb = { ...cs, fontWeight: 700 };
          return (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
                      <th style={{ ...cl, fontSize: 11, fontWeight: 600 }}>Položka</th>
                      <th style={{ ...cs, fontSize: 11, fontWeight: 600, color: 'var(--r0-slate-500)' }}>Náklady</th>
                      <th style={{ ...cs, fontSize: 11, fontWeight: 600, color: 'var(--r0-slate-500)' }}>Dní</th>
                      <th style={{ ...cs, fontSize: 11, fontWeight: 600, color: 'var(--r0-slate-500)' }}>Normohodin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={cl}>Bednění (práce)</td>
                      <td style={cs}>{formatCZK(plan.costs.formwork_labor_czk)}</td>
                      <td style={cs}>{formatNum(fwDays, 1)}</td>
                      <td style={cs}>{formatNum(fwH, 0)} h</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={cl}>Výztuž (práce)</td>
                      <td style={cs}>{formatCZK(plan.costs.rebar_labor_czk)}</td>
                      <td style={cs}>{formatNum(rbDays, 1)}</td>
                      <td style={cs}>{formatNum(rbH, 0)} h</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={cl}>Betonáž (práce)</td>
                      <td style={cs}>{formatCZK(plan.costs.pour_labor_czk)}</td>
                      <td style={cs}>—</td>
                      <td style={cs}>{formatNum(pourH, 1)} h</td>
                    </tr>
                    {propsLabor > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                        <td style={cl}>Podpěry (práce)</td>
                        <td style={cs}>{formatCZK(propsLabor)}</td>
                        <td style={cs}>{plan.props ? formatNum(plan.props.assembly_days + plan.props.disassembly_days, 1) : '—'}</td>
                        <td style={cs}>—</td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: '1px solid var(--r0-slate-100)', background: 'var(--r0-slate-50)' }}>
                      <td style={cl}>Pronájem bednění</td>
                      <td style={cs}>{formatCZK(plan.costs.formwork_rental_czk)}</td>
                      <td style={{ ...cs, color: 'var(--r0-slate-500)' }} colSpan={2}>{rentalDays} dní ({rentalMonths} měs.)</td>
                    </tr>
                    {propsRental > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--r0-slate-100)', background: 'var(--r0-slate-50)' }}>
                        <td style={cl}>Pronájem podpěr</td>
                        <td style={cs}>{formatCZK(propsRental)}</td>
                        <td style={{ ...cs, color: 'var(--r0-slate-500)' }} colSpan={2}>{plan.props?.rental_days ?? '—'} dní</td>
                      </tr>
                    )}
                    <tr style={{ borderTop: '2px solid var(--r0-slate-300)' }}>
                      <td style={{ ...cl, fontWeight: 700 }}>Celkem práce</td>
                      <td style={cb}>{formatCZK(plan.costs.total_labor_czk + propsLabor)}</td>
                      <td style={cs} colSpan={2}></td>
                    </tr>
                    <tr>
                      <td style={{ ...cl, fontWeight: 700 }}>Celkem vše</td>
                      <td style={cb}>{formatCZK(totalAll)}</td>
                      <td style={cs} colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </CollapsibleSection>

      {/* Norms Sources */}
      {plan.norms_sources && (
        <CollapsibleSection title="Zdroje norem" icon={<span>📚</span>} defaultOpen={false}>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--r0-slate-600)' }}>
            <Row label="Montáž bednění" value={plan.norms_sources.formwork_assembly} />
            <Row label="Demontáž" value={plan.norms_sources.formwork_disassembly} />
            <Row label="Výztuž" value={plan.norms_sources.rebar} />
            <Row label="Zrání betonu" value={plan.norms_sources.curing} />
            {plan.norms_sources.skruz && (
              <Row label="Skruž" value={plan.norms_sources.skruz} />
            )}
          </div>
        </CollapsibleSection>
      )}

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
              <li key={i} style={{ marginBottom: 4, fontFamily: "var(--r0-font-mono, 'JetBrains Mono', monospace)" }}>{entry}</li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
