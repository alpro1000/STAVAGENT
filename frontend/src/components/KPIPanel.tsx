/**
 * KPIPanel - Modern Floating KPI Card with Glassmorphism
 */

import { useAppContext } from '../context/AppContext';
import { useCreateSnapshot } from '../hooks/useCreateSnapshot';

export default function KPIPanel() {
  const { headerKPI, selectedBridge, daysPerMonth } = useAppContext();
  const { handleCreateSnapshot, isCreating } = useCreateSnapshot();

  if (!selectedBridge || !headerKPI) {
    return (
      <div className="kpi-float-card empty-state-kpi">
        <div className="kpi-empty-icon">📊</div>
        <p className="kpi-empty-text">Vyberte most pro zobrazení KPI</p>
      </div>
    );
  }

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div className="kpi-float-card">
      <div className="kpi-header">
        <div className="kpi-title-section">
          <h2 className="kpi-bridge-title">
            🏗️ {selectedBridge}
          </h2>
          <p className="kpi-metadata">
            {headerKPI.span_length_m && `Délka: ${headerKPI.span_length_m}m`}
            {headerKPI.deck_width_m && ` | Šířka: ${headerKPI.deck_width_m}m`}
            {headerKPI.pd_weeks && ` | PD: ${headerKPI.pd_weeks} týdnů`}
          </p>
        </div>
        <button
          className="btn-lock-kpi"
          onClick={handleCreateSnapshot}
          disabled={isCreating}
          title="Zafixovat aktuální stav (snapshot)"
        >
          🔒 {isCreating ? 'Fixuji...' : 'Zafixovat'}
        </button>
      </div>

      <div className="kpi-grid-modern">
        {/* ROW 1: Main metrics */}
        <div className="kpi-card kpi-card-primary">
          <div className="kpi-card-label">
            <span>💰</span> Celková cena (KROS)
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.sum_kros_total_czk, 2)}
            <span className="kpi-card-unit">CZK</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-accent">
          <div className="kpi-card-label">
            <span>📏</span> Kč/m³ (projekt)
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.project_unit_cost_czk_per_m3, 2)}
            <span className="kpi-card-unit">CZK/m³</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-success">
          <div className="kpi-card-label">
            <span>⏱️</span> Měsíce (výpočet)
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.estimated_months, 1)}
            <span className="kpi-card-unit">měsíců</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-label">
            <span>📆</span> Týdny (výpočet)
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.estimated_weeks, 1)}
            <span className="kpi-card-unit">týdnů</span>
          </div>
        </div>

        {/* ROW 2: Averages */}
        <div className="kpi-card">
          <div className="kpi-card-label">
            <span>👥</span> Průměr: lidi
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.avg_crew_size, 1)}
            <span className="kpi-card-unit">lidí</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-label">
            <span>💵</span> Průměr: Kč/hod
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.avg_wage_czk_ph, 0)}
            <span className="kpi-card-unit">CZK</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-label">
            <span>⏰</span> Průměr: hod/den
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.avg_shift_hours, 1)}
            <span className="kpi-card-unit">hod</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-label">
            <span>📅</span> Režim práce
          </div>
          <div className="kpi-card-value kpi-mode-value">
            {daysPerMonth === 30 ? '30 dní/měsíc' : '22 dní/měsíc'}
          </div>
        </div>
      </div>

      <div className="kpi-formula">
        <span className="formula-label">⚡ Vzorec měsíců:</span>
        <span className="formula-content">
          {formatNumber(headerKPI.sum_kros_total_czk)} / (
          {formatNumber(headerKPI.avg_crew_size, 1)} × {formatNumber(headerKPI.avg_wage_czk_ph, 0)} × {formatNumber(headerKPI.avg_shift_hours, 1)} × {daysPerMonth}
          ) = <strong>{formatNumber(headerKPI.estimated_months, 2)} měsíců</strong>
        </span>
      </div>
    </div>
  );
}
