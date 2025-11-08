/**
 * PositionRow - Editable table row for a single position (v3.4 Modern UI)
 */

import { useState } from 'react';
import { Position, SUBTYPE_ICONS } from '@monolit/shared';
import { useAppContext } from '../context/AppContext';
import { usePositions } from '../hooks/usePositions';

interface Props {
  position: Position;
  isLocked?: boolean;
}

export default function PositionRow({ position, isLocked = false }: Props) {
  const { selectedBridge } = useAppContext();
  const { updatePositions, deletePosition } = usePositions(selectedBridge);

  const [editedFields, setEditedFields] = useState<Partial<Position>>({});

  const handleFieldChange = (field: keyof Position, value: any) => {
    if (isLocked) return;

    setEditedFields((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBlur = () => {
    if (Object.keys(editedFields).length === 0 || isLocked) return;

    // Send update to server
    updatePositions([
      {
        id: position.id,
        ...editedFields
      }
    ]);

    setEditedFields({});
  };

  const handleDelete = () => {
    if (isLocked) {
      alert('❌ Nelze smazat: Data jsou zafixována (snapshot aktivní)');
      return;
    }

    if (confirm(`Smazat pozici "${position.subtype}"?`)) {
      deletePosition(position.id!);
    }
  };

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const getValue = (field: keyof Position): number => {
    const value = editedFields[field] !== undefined ? editedFields[field] : position[field];
    return typeof value === 'number' ? value : 0;
  };

  const icon = SUBTYPE_ICONS[position.subtype as keyof typeof SUBTYPE_ICONS] || '📋';

  return (
    <tr className={`table-row ${position.subtype} ${position.has_rfi ? 'has-rfi' : ''} ${isLocked ? 'locked' : ''}`}>
      {/* Locked indicator */}
      {isLocked && <td className="lock-indicator">🔒</td>}

      {/* Subtype with icon */}
      <td className="cell-subtype">
        <div className="subtype-cell">
          <span className="subtype-icon">{icon}</span>
          <span className="subtype-label">{position.subtype}</span>
        </div>
      </td>

      {/* Unit */}
      <td className="cell-unit">{position.unit}</td>

      {/* INPUT CELLS - Editable (orange/cyan gradient) */}

      {/* Qty */}
      <td className={`cell-input ${position.subtype === 'beton' ? 'cell-computed' : ''}`}>
        <input
          type="number"
          step="0.01"
          min="0"
          className={`input-cell ${position.subtype === 'beton' ? 'readonly-style' : ''}`}
          value={getValue('qty')}
          onChange={(e) => {
            // For beton rows, prevent manual edits (sync from PartHeader only)
            if (position.subtype === 'beton') return;
            handleFieldChange('qty', Math.max(0, parseFloat(e.target.value) || 0));
          }}
          onBlur={handleBlur}
          disabled={isLocked || position.subtype === 'beton'}
          title={
            position.subtype === 'beton'
              ? 'Objem betonu (čte se z PartHeader výše - "Objem betonu celkem"). Klikněte tam pro změnu.'
              : 'Množství v měrných jednotkách'
          }
        />
      </td>

      {/* Crew size */}
      <td className="cell-input">
        <input
          type="number"
          min="0"
          className="input-cell"
          value={getValue('crew_size')}
          onChange={(e) => handleFieldChange('crew_size', Math.max(0, parseInt(e.target.value) || 0))}
          onBlur={handleBlur}
          disabled={isLocked}
          title="Počet lidí v partě"
        />
      </td>

      {/* Wage */}
      <td className="cell-input">
        <input
          type="number"
          step="1"
          min="0"
          className="input-cell"
          value={getValue('wage_czk_ph')}
          onChange={(e) => handleFieldChange('wage_czk_ph', Math.max(0, parseFloat(e.target.value) || 0))}
          onBlur={handleBlur}
          disabled={isLocked}
          title="Hodinová sazba v CZK"
        />
      </td>

      {/* Shift hours */}
      <td className="cell-input">
        <input
          type="number"
          step="0.5"
          min="0"
          className="input-cell"
          value={getValue('shift_hours')}
          onChange={(e) => handleFieldChange('shift_hours', Math.max(0, parseFloat(e.target.value) || 0))}
          onBlur={handleBlur}
          disabled={isLocked}
          title="Hodin za směnu"
        />
      </td>

      {/* Days */}
      <td className="cell-input">
        <input
          type="number"
          step="0.5"
          min="0"
          className="input-cell"
          value={getValue('days')}
          onChange={(e) => handleFieldChange('days', Math.max(0, parseFloat(e.target.value) || 0))}
          onBlur={handleBlur}
          disabled={isLocked}
          title="Počet dní (koeficient 1)"
        />
      </td>

      {/* COMPUTED CELLS - Readonly (gray) */}

      {/* Labor hours */}
      <td className="cell-computed">
        <div className="computed-cell" title="= crew_size × shift_hours × days">
          {formatNumber(position.labor_hours, 1)}
        </div>
      </td>

      {/* Cost CZK */}
      <td className="cell-computed">
        <div className="computed-cell" title="= labor_hours × wage_czk_ph">
          {formatNumber(position.cost_czk, 2)}
        </div>
      </td>

      {/* KROS CELLS - Success green with glow */}

      {/* Unit cost on m³ - KEY METRIC */}
      <td className="cell-kros-key">
        <div
          className={`kros-cell kros-key ${position.has_rfi ? 'warning' : ''}`}
          title="⭐ KLÍČOVÁ METRIKA: Kč/m³ betonu (= cost_czk / concrete_m3)"
        >
          {formatNumber(position.unit_cost_on_m3, 2)}
        </div>
      </td>

      {/* KROS unit */}
      <td className="cell-kros">
        <div
          className="kros-cell"
          title="KROS jednotková cena (= ceil(unit_cost_on_m3 / 50) × 50)"
        >
          {formatNumber(position.kros_unit_czk, 0)}
        </div>
      </td>

      {/* KROS total */}
      <td className="cell-kros">
        <div
          className="kros-cell"
          title="KROS celkem (= kros_unit_czk × concrete_m3)"
        >
          {formatNumber(position.kros_total_czk, 2)}
        </div>
      </td>

      {/* RFI indicator */}
      <td className="cell-rfi">
        {position.has_rfi && (
          <div className="rfi-badge" title={position.rfi_message || 'Request For Information'}>
            ⚠️
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="cell-actions">
        <div className="action-buttons">
          <button
            className="icon-btn btn-delete"
            onClick={handleDelete}
            title={isLocked ? 'Nelze smazat (zafixováno)' : 'Smazat pozici'}
            disabled={isLocked}
          >
            ❌
          </button>
          <button
            className="icon-btn btn-info"
            title="Zobrazit detaily"
            onClick={() => alert(JSON.stringify(position, null, 2))}
          >
            ℹ️
          </button>
        </div>
      </td>
    </tr>
  );
}
