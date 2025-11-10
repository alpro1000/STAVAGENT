/**
 * FormulaDetailsModal - Shows calculation formulas and details for a position
 */

import { Position } from '@monolit/shared';

interface Props {
  position: Position;
  isOpen: boolean;
  onClose: () => void;
}

export default function FormulaDetailsModal({ position, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📋 Detaily výpočtu</h2>
          <button className="btn-close" onClick={onClose} title="Zavřít">✕</button>
        </div>

        <div className="modal-body">
          {/* Position Info */}
          <div className="details-section">
            <h3>Základní informace</h3>
            <table className="details-table">
              <tbody>
                <tr>
                  <td className="label">Typ práce:</td>
                  <td className="value">{position.subtype}</td>
                </tr>
                <tr>
                  <td className="label">Položka:</td>
                  <td className="value">{position.item_name || '—'}</td>
                </tr>
                <tr>
                  <td className="label">Měrná jednotka:</td>
                  <td className="value">{position.unit}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Input Parameters */}
          <div className="details-section">
            <h3>Editovatelné parametry (INPUT)</h3>
            <table className="details-table">
              <tbody>
                <tr>
                  <td className="label">Množství:</td>
                  <td className="value">{formatNumber(position.qty, 2)} {position.unit}</td>
                </tr>
                <tr>
                  <td className="label">Počet lidí v partě:</td>
                  <td className="value">{formatNumber(position.crew_size, 0)} osob</td>
                </tr>
                <tr>
                  <td className="label">Hodinová sazba:</td>
                  <td className="value">{formatNumber(position.wage_czk_ph, 2)} CZK/h</td>
                </tr>
                <tr>
                  <td className="label">Hodin za směnu:</td>
                  <td className="value">{formatNumber(position.shift_hours, 1)} h</td>
                </tr>
                <tr>
                  <td className="label">Počet dní:</td>
                  <td className="value">{formatNumber(position.days, 1)} d</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Calculated Fields */}
          <div className="details-section">
            <h3>Vypočítané hodnoty (CALCULATED)</h3>
            <table className="details-table">
              <tbody>
                <tr>
                  <td className="label formula-label">Celk.hod. (Celkový počet hodin):</td>
                  <td className="value">
                    {formatNumber(position.labor_hours, 1)} h
                  </td>
                  <td className="formula">
                    = {formatNumber(position.crew_size, 0)} × {formatNumber(position.shift_hours, 1)} × {formatNumber(position.days, 1)}
                  </td>
                </tr>
                <tr>
                  <td className="label formula-label">Celk.Kč (Celková cena):</td>
                  <td className="value">
                    {formatNumber(position.cost_czk, 2)} CZK
                  </td>
                  <td className="formula">
                    = {formatNumber(position.labor_hours, 1)} × {formatNumber(position.wage_czk_ph, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* KROS Calculation */}
          <div className="details-section">
            <h3>KROS (Ksop-relevantní obnoslava) Výpočet</h3>
            <table className="details-table">
              <tbody>
                <tr>
                  <td className="label formula-label">Objem betonu (m³):</td>
                  <td className="value">
                    {formatNumber(position.concrete_m3, 2)} m³
                  </td>
                  <td className="formula">
                    {position.subtype === 'beton' ? '(od PartHeader)' : '(z betonu řádku)'}
                  </td>
                </tr>
                <tr>
                  <td className="label formula-label">Kč/m³ (Jednotková cena):</td>
                  <td className="value">
                    {formatNumber(position.unit_cost_on_m3, 2)} CZK/m³
                  </td>
                  <td className="formula">
                    = {formatNumber(position.cost_czk, 2)} ÷ {formatNumber(position.concrete_m3, 2)}
                  </td>
                </tr>
                <tr>
                  <td className="label formula-label">KROS j. (Jednotková):</td>
                  <td className="value">
                    {formatNumber(position.kros_unit_czk, 0)} CZK
                  </td>
                  <td className="formula">
                    = zaokrouhlit({formatNumber(position.unit_cost_on_m3, 2)} ÷ 50) × 50
                  </td>
                </tr>
                <tr>
                  <td className="label formula-label">KROS Σ (Celkem):</td>
                  <td className="value">
                    {formatNumber(position.kros_total_czk, 2)} CZK
                  </td>
                  <td className="formula">
                    = {formatNumber(position.kros_unit_czk, 0)} × {formatNumber(position.concrete_m3, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* RFI Status */}
          {position.has_rfi && (
            <div className="details-section rfi-section">
              <h3>⚠️ Request For Information (RFI)</h3>
              <p className="rfi-message">{position.rfi_message || 'Tato položka vyžaduje upřesnění'}</p>
            </div>
          )}

          {/* Raw Data */}
          <details className="details-section raw-data-section">
            <summary>Zobrazit raw data (JSON)</summary>
            <pre>{JSON.stringify(position, null, 2)}</pre>
          </details>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Zavřít</button>
        </div>
      </div>
    </div>
  );
}
