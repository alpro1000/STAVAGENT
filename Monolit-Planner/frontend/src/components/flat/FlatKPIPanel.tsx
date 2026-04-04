/**
 * FlatKPIPanel — KPI summary split into 3 visual groups.
 *
 * Group 1 "Objem & Prvky" (blue tint): concrete volume, formwork area, element count
 * Group 2 "Čas & Zdroje" (orange tint): duration, crew, shift, uncalculated count
 * Group 3 "Náklady" (green tint): total cost, unit cost, avg wage
 */

import { Boxes, CalendarDays, Banknote } from 'lucide-react';
import type { HeaderKPI, Position } from '@stavagent/monolit-shared';

interface Props {
  kpi: HeaderKPI | null;
  positions?: Position[];
}

function fmt(n: number | undefined, decimals = 0): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function FlatKPIPanel({ kpi, positions = [] }: Props) {
  if (!kpi) return null;

  // Extra stats from positions
  const betonCount = positions.filter(p => p.subtype === 'beton').length;
  const formworkArea = positions
    .filter(p => p.subtype === 'bednění')
    .reduce((s, p) => s + (p.qty || 0), 0);
  const uncalculated = positions.filter(p => p.subtype === 'beton' && !p.kros_total_czk && !p.days).length;

  return (
    <div className="flat-kpi-groups">
      {/* Group 1: Objem & Prvky */}
      <div className="flat-kpi-group flat-kpi-group--volume">
        <div className="flat-kpi-group__header">
          <Boxes size={14} />
          <span>Objem &amp; Prvky</span>
        </div>
        <div className="flat-kpi-group__items">
          <KPIItem label="Σ Beton" value={fmt(kpi.sum_concrete_m3, 1)} unit="m³" />
          {formworkArea > 0 && <KPIItem label="Bednění" value={fmt(formworkArea, 0)} unit="m²" />}
          <KPIItem label="Počet prvků" value={String(betonCount)} />
        </div>
      </div>

      <div className="flat-kpi-divider" />

      {/* Group 2: Čas & Zdroje */}
      <div className="flat-kpi-group flat-kpi-group--time">
        <div className="flat-kpi-group__header">
          <CalendarDays size={14} />
          <span>Čas &amp; Zdroje</span>
        </div>
        <div className="flat-kpi-group__items">
          <KPIItem label="Odhadovaná doba" value={fmt(kpi.estimated_months, 1)} unit="měs." />
          <KPIItem label="Průměrná parta" value={fmt(kpi.avg_crew_size, 1)} unit="lidí" />
          <KPIItem label="Průměr. směna" value={fmt(kpi.avg_shift_hours, 1)} unit="h/den" />
          {uncalculated > 0 && (
            <KPIItem label="Nevypočtených" value={String(uncalculated)} alert />
          )}
        </div>
      </div>

      <div className="flat-kpi-divider" />

      {/* Group 3: Náklady */}
      <div className="flat-kpi-group flat-kpi-group--cost">
        <div className="flat-kpi-group__header">
          <Banknote size={14} />
          <span>Náklady</span>
        </div>
        <div className="flat-kpi-group__items">
          <KPIItem label="Celková cena" value={fmt(kpi.sum_kros_total_czk)} unit="Kč" />
          <KPIItem label="Jedn. cena/m³" value={fmt(kpi.project_unit_cost_czk_per_m3)} unit="Kč/m³" />
          <KPIItem label="Průměr. sazba" value={fmt(kpi.avg_wage_czk_ph)} unit="Kč/h" />
        </div>
      </div>
    </div>
  );
}

function KPIItem({ label, value, unit, alert }: {
  label: string; value: string; unit?: string; alert?: boolean;
}) {
  return (
    <div className="flat-kpi__item">
      <span className="flat-kpi__label">{label}</span>
      <span className={`flat-kpi__value ${alert ? 'flat-kpi__value--alert' : ''}`}>
        {value}
        {unit && <span className="flat-kpi__unit">{unit}</span>}
      </span>
    </div>
  );
}
