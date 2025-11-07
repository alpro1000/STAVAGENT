/**
 * KPIPanel - Display header KPI metrics
 */


import { useAppContext } from '../context/AppContext';

export default function KPIPanel() {
  const { headerKPI, selectedBridge, daysPerMonth } = useAppContext();

  if (!selectedBridge || !headerKPI) {
    return (
      <div className="kpi-panel">
        <p className="text-muted">Vyberte most pro zobrazení KPI</p>
      </div>
    );
  }

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div className="kpi-panel">
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ color: 'var(--primary-action)' }}>
          Most: {selectedBridge}
        </h2>
        <p className="text-muted">
          {headerKPI.span_length_m && `Délka: ${headerKPI.span_length_m}m`}
          {headerKPI.deck_width_m && ` | Šířka: ${headerKPI.deck_width_m}m`}
          {headerKPI.pd_weeks && ` | PD: ${headerKPI.pd_weeks} týdnů`}
        </p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-item">
          <div className="kpi-label">💰 Celková cena (KROS)</div>
          <div className="kpi-value">
            {formatNumber(headerKPI.sum_kros_total_czk, 2)}
            <span className="kpi-unit">CZK</span>
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">📏 Kč/m³ (projekt)</div>
          <div className="kpi-value">
            {formatNumber(headerKPI.project_unit_cost_czk_per_m3, 2)}
            <span className="kpi-unit">CZK/m³</span>
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">📏 Kč/t (ρ=2.4)</div>
          <div className="kpi-value">
            {formatNumber(headerKPI.project_unit_cost_czk_per_t, 2)}
            <span className="kpi-unit">CZK/t</span>
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">⏱️ Měsíce (výpočet)</div>
          <div className="kpi-value">
            {formatNumber(headerKPI.estimated_months, 1)}
            <span className="kpi-unit">měsíců</span>
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">⏱️ Týdny (výpočet)</div>
          <div className="kpi-value">
            {formatNumber(headerKPI.estimated_weeks, 1)}
            <span className="kpi-unit">týdnů</span>
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">👥 Průměr: lidi</div>
          <div className="kpi-value">
            {formatNumber(headerKPI.avg_crew_size, 1)}
            <span className="kpi-unit">lidí</span>
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">💵 Průměr: Kč/hod</div>
          <div className="kpi-value">
            {formatNumber(headerKPI.avg_wage_czk_ph, 0)}
            <span className="kpi-unit">CZK</span>
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">⏰ Průměr: hod/den</div>
          <div className="kpi-value">
            {formatNumber(headerKPI.avg_shift_hours, 1)}
            <span className="kpi-unit">hod</span>
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">📅 Režim práce</div>
          <div className="kpi-value" style={{ fontSize: '16px' }}>
            {daysPerMonth === 30 ? '30 dní/měsíc' : '22 dní/měsíc'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <strong>Vzorec měsíců:</strong> {formatNumber(headerKPI.sum_kros_total_czk)} / (
        {formatNumber(headerKPI.avg_crew_size, 1)} × {formatNumber(headerKPI.avg_wage_czk_ph, 0)} × {formatNumber(headerKPI.avg_shift_hours, 1)} × {daysPerMonth}
        ) = {formatNumber(headerKPI.estimated_months, 2)} měsíců
      </div>
    </div>
  );
}
