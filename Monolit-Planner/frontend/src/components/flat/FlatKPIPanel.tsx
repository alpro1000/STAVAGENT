/**
 * FlatKPIPanel — 4 compact cards on stone-150 strip.
 *
 * Block 1 (blue):   Objem & prvky — Σ Beton, Bednění, Výztuž, Prvků
 * Block 2 (amber):  Čas — Doba (měs + týd), Nevypočtených
 * Block 3 (green):  Náklady — Celková cena, Jedn. cena/m³
 * Block 4 (violet): Průměry — Parta, Sazba, Směna
 *
 * ≤70px height. Uses calculateHeaderKPI from shared.
 */

import type { HeaderKPI, Position } from '@stavagent/monolit-shared';

interface Props {
  kpi: HeaderKPI | null;
  positions?: Position[];
}

function fmt(n: number | undefined, d = 0): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function FlatKPIPanel({ kpi, positions = [] }: Props) {
  if (!kpi) return null;

  const betonCount = positions.filter(p => p.subtype === 'beton').length;
  const formworkArea = positions.filter(p => p.subtype === 'bednění').reduce((s, p) => s + (p.qty || 0), 0);
  const rebarMass = positions.filter(p => p.subtype === 'výztuž').reduce((s, p) => s + (p.qty || 0), 0);
  const uncalculated = positions.filter(p => p.subtype === 'beton' && !p.kros_total_czk && !p.days).length;

  return (
    <div className="kpi-strip">
      {/* Block 1: Objem & prvky */}
      <div className="kpi-card kpi-card--blue">
        <div className="kpi-card__head">Objem &amp; prvky</div>
        <div className="kpi-card__body">
          <div className="kpi-card__hero">
            {fmt(kpi.sum_concrete_m3, 1)}<span className="kpi-u">m³</span>
          </div>
          <div className="kpi-card__rows">
            <KRow label="Bednění" value={fmt(formworkArea, 0)} unit="m²" />
            <KRow label="Výztuž" value={fmt(rebarMass, 1)} unit="t" />
            <KRow label="Prvků" value={String(betonCount)} />
          </div>
        </div>
      </div>

      {/* Block 2: Čas */}
      <div className="kpi-card kpi-card--amber">
        <div className="kpi-card__head">Čas</div>
        <div className="kpi-card__body">
          <div className="kpi-card__hero">
            {fmt(kpi.estimated_months, 1)}<span className="kpi-u">měs.</span>
          </div>
          <div className="kpi-card__rows">
            <KRow label="" value={fmt(kpi.estimated_weeks, 1)} unit="týd." />
            {uncalculated > 0 && (
              <KRow label="Nevypočtených" value={String(uncalculated)} alert />
            )}
          </div>
        </div>
      </div>

      {/* Block 3: Náklady */}
      <div className="kpi-card kpi-card--green">
        <div className="kpi-card__head">Náklady</div>
        <div className="kpi-card__body">
          <div className="kpi-card__hero">
            {fmt(kpi.sum_kros_total_czk)}<span className="kpi-u">Kč</span>
          </div>
          <div className="kpi-card__rows">
            <KRow label="Jedn. cena/m³" value={fmt(kpi.project_unit_cost_czk_per_m3)} unit="Kč/m³" />
          </div>
        </div>
      </div>

      {/* Block 4: Průměry */}
      <div className="kpi-card kpi-card--violet">
        <div className="kpi-card__head">Průměry</div>
        <div className="kpi-card__body">
          <div className="kpi-card__rows" style={{ paddingTop: 2 }}>
            <KRow label="Parta" value={fmt(kpi.avg_crew_size, 1)} unit="lidí" />
            <KRow label="Sazba" value={fmt(kpi.avg_wage_czk_ph)} unit="Kč/h" />
            <KRow label="Směna" value={fmt(kpi.avg_shift_hours, 1)} unit="h/den" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KRow({ label, value, unit, alert }: { label: string; value: string; unit?: string; alert?: boolean }) {
  return (
    <div className="kpi-row">
      {label && <span className="kpi-row__label">{label}</span>}
      <span className={`kpi-row__value ${alert ? 'kpi-row__value--alert' : ''}`}>
        {value}{unit && <span className="kpi-u">{unit}</span>}
      </span>
    </div>
  );
}
