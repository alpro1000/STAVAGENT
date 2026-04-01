/**
 * KPIPanel - Modern Floating KPI Card with Glassmorphism
 */

import { BarChart3, Building2, Timer } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useCreateSnapshot } from '../hooks/useCreateSnapshot';
import DaysPerMonthToggle from './DaysPerMonthToggle';

export default function KPIPanel() {
  const { headerKPI, selectedBridge, bridges, daysPerMonth, activeSnapshot } = useAppContext();
  const { handleCreateSnapshot, isCreating } = useCreateSnapshot();

  // Get full bridge data for display
  const currentBridge = bridges.find(b => b.bridge_id === selectedBridge);

  if (!selectedBridge || !headerKPI) {
    return (
      <div className="c-panel u-flex-center" style={{ flexDirection: 'column', gap: 'var(--space-md)', padding: 'var(--space-xl)' }}>
        <div style={{ fontSize: '48px', opacity: 0.6 }}><BarChart3 size={48} /></div>
        <p className="u-text-muted">Vyberte objekt pro zobrazení KPI</p>
      </div>
    );
  }

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Check if current data is locked (has active snapshot)
  const isLocked = activeSnapshot !== null;

  return (
    <div className="c-panel" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="u-flex-between u-mb-md" style={{ flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <h2 className="u-text-orange u-text-bold" style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>
            <Building2 size={18} className="inline" /> {selectedBridge}
          </h2>
          {currentBridge && (
            <span className="u-text-bold" style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
              {currentBridge.object_name}
            </span>
          )}
          {currentBridge?.project_name && (
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              | 📁 {currentBridge.project_name}
            </span>
          )}
          {headerKPI.sum_concrete_m3 > 0 && (
            <span className="u-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              | 🧱 {formatNumber(headerKPI.sum_concrete_m3)} m³
            </span>
          )}
        </div>

        <div className="u-flex u-gap-sm" style={{ alignItems: 'center' }}>
          <DaysPerMonthToggle />
          <button
            className={`c-btn ${isLocked ? 'c-btn--success' : 'c-btn--primary'}`}
            onClick={handleCreateSnapshot}
            disabled={isCreating || isLocked}
            title={isLocked ? "Data jsou zafixována (snapshot vytvořen)" : "Zafixovat aktuální stav (vytvořit snapshot)"}
          >
            {isLocked ? (
              <>🔒 Zafixováno</>
            ) : (
              <>{isCreating ? '🔄 Fixuji...' : '🔓 Zafixovat'}</>
            )}
          </button>
        </div>
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
            <Timer size={16} className="inline" /> Měsíce
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.estimated_months, 1)}
            <span className="kpi-card-unit">měsíců</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-label">
            <span>📆</span> Týdny
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.estimated_weeks, 1)}
            <span className="kpi-card-unit">týdnů</span>
          </div>
        </div>

        {/* ROW 2: Averages */}
        <div className="kpi-card">
          <div className="kpi-card-label">
            <span>👥</span> Lidé (Ø)
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.avg_crew_size, 1)}
            <span className="kpi-card-unit">lidí</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-label">
            <span>💵</span> Kč/hod (Ø)
          </div>
          <div className="kpi-card-value">
            {formatNumber(headerKPI.avg_wage_czk_ph, 0)}
            <span className="kpi-card-unit">CZK</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-label">
            <span>⏰</span> Hod/den (Ø)
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
