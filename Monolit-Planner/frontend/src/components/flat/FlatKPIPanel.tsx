/**
 * FlatKPIPanel — KPI summary above the positions table.
 *
 * 9 metrics from HeaderKPI. Uses flat design Stone palette.
 * "KROS" label removed per spec — now "Celková cena" and "Jedn. cena/m³".
 */

import type { HeaderKPI } from '@stavagent/monolit-shared';

interface Props {
  kpi: HeaderKPI | null;
}

function fmt(n: number | undefined, decimals = 0): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function FlatKPIPanel({ kpi }: Props) {
  if (!kpi) return null;

  const items = [
    { label: 'Objem betonu', value: fmt(kpi.sum_concrete_m3, 1), unit: 'm³' },
    { label: 'Celková cena', value: fmt(kpi.sum_kros_total_czk), unit: 'Kč' },
    { label: 'Jedn. cena/m³', value: fmt(kpi.project_unit_cost_czk_per_m3), unit: 'Kč/m³' },
    { label: 'Odhadovaná doba', value: fmt(kpi.estimated_months, 1), unit: 'měs.' },
    { label: '', value: fmt(kpi.estimated_weeks, 1), unit: 'týd.' },
    { label: 'Průměrná party', value: fmt(kpi.avg_crew_size, 1), unit: 'lidí' },
    { label: 'Prům. sazba', value: fmt(kpi.avg_wage_czk_ph), unit: 'Kč/h' },
    { label: 'Prům. směna', value: fmt(kpi.avg_shift_hours, 1), unit: 'h/den' },
    { label: 'Režim', value: String(kpi.days_per_month ?? 30), unit: 'dní/měs' },
  ];

  return (
    <div className="flat-kpi">
      {items.map((it, i) => (
        <div key={i} className="flat-kpi__item">
          {it.label && <span className="flat-kpi__label">{it.label}</span>}
          <span className="flat-kpi__value">
            {it.value}
            <span className="flat-kpi__unit">{it.unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
