/**
 * PositionRow - Editable table row for a single position
 */

import { useState } from 'react';
import { Position, SUBTYPE_ICONS } from '@monolit/shared';
import { useAppContext } from '../context/AppContext';
import { usePositions } from '../hooks/usePositions';

interface Props {
  position: Position;
}

export default function PositionRow({ position }: Props) {
  const { selectedBridge } = useAppContext();
  const { updatePositions, deletePosition } = usePositions(selectedBridge);

  const [editedFields, setEditedFields] = useState<Partial<Position>>({});

  const handleFieldChange = (field: keyof Position, value: any) => {
    setEditedFields((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBlur = () => {
    if (Object.keys(editedFields).length === 0) return;

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
    if (confirm(`Smazat pozici "${position.subtype}"?`)) {
      deletePosition(position.id!);
    }
  };

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toFixed(decimals).replace('.', ',');
  };

  const getValue = (field: keyof Position): number => {
    const value = editedFields[field] !== undefined ? editedFields[field] : position[field];
    return typeof value === 'number' ? value : 0;
  };

  const icon = SUBTYPE_ICONS[position.subtype as keyof typeof SUBTYPE_ICONS] || '📋';

  return (
    <tr className={position.has_rfi ? 'rfi-row' : ''}>
      {/* Subtype */}
      <td>
        <div className="subtype-cell">
          <span className="icon">{icon}</span>
          <span>{position.subtype}</span>
        </div>
        {position.has_rfi && (
          <div className="rfi-badge" title={position.rfi_message}>
            ⚠️ RFI
          </div>
        )}
      </td>

      {/* Unit */}
      <td>{position.unit}</td>

      {/* Qty - EDITABLE (orange) */}
      <td className="input-cell">
        <input
          type="number"
          step="0.1"
          value={getValue('qty')}
          onChange={(e) => handleFieldChange('qty', parseFloat(e.target.value) || 0)}
          onBlur={handleBlur}
        />
      </td>

      {/* Crew size - EDITABLE (orange) */}
      <td className="input-cell">
        <input
          type="number"
          value={getValue('crew_size')}
          onChange={(e) => handleFieldChange('crew_size', parseInt(e.target.value) || 0)}
          onBlur={handleBlur}
        />
      </td>

      {/* Wage - EDITABLE (orange) */}
      <td className="input-cell">
        <input
          type="number"
          step="1"
          value={getValue('wage_czk_ph')}
          onChange={(e) => handleFieldChange('wage_czk_ph', parseFloat(e.target.value) || 0)}
          onBlur={handleBlur}
        />
      </td>

      {/* Shift hours - EDITABLE (orange) */}
      <td className="input-cell">
        <input
          type="number"
          step="0.5"
          value={getValue('shift_hours')}
          onChange={(e) => handleFieldChange('shift_hours', parseFloat(e.target.value) || 0)}
          onBlur={handleBlur}
        />
      </td>

      {/* Days - EDITABLE (orange) */}
      <td className="input-cell">
        <input
          type="number"
          step="0.5"
          value={getValue('days')}
          onChange={(e) => handleFieldChange('days', parseFloat(e.target.value) || 0)}
          onBlur={handleBlur}
        />
      </td>

      {/* Labor hours - COMPUTED (readonly gray) */}
      <td className="computed-cell">
        <input
          type="text"
          className="readonly-field"
          value={formatNumber(position.labor_hours, 1)}
          readOnly
        />
      </td>

      {/* Cost CZK - COMPUTED (readonly gray) */}
      <td className="computed-cell">
        <input
          type="text"
          className="readonly-field"
          value={formatNumber(position.cost_czk, 2)}
          readOnly
        />
      </td>

      {/* Concrete m³ - COMPUTED (readonly gray) */}
      <td className="computed-cell">
        <input
          type="text"
          className="readonly-field"
          value={formatNumber(position.concrete_m3, 2)}
          readOnly
        />
      </td>

      {/* Unit cost on m³ - KEY METRIC (readonly, bold) */}
      <td className="computed-cell">
        <input
          type="text"
          className="readonly-field"
          style={{ fontWeight: 700, color: 'var(--primary-action)' }}
          value={formatNumber(position.unit_cost_on_m3, 2)}
          readOnly
          title="Klíčová metrika: Kč/m³ betonu"
        />
      </td>

      {/* KROS unit - COMPUTED (green bg) */}
      <td className="kros-cell">
        <input
          type="text"
          className="readonly-field"
          style={{ background: 'var(--kros-success-bg)', color: 'var(--success)' }}
          value={formatNumber(position.kros_unit_czk, 0)}
          readOnly
        />
      </td>

      {/* KROS total - COMPUTED (green bg) */}
      <td className="kros-cell">
        <input
          type="text"
          className="readonly-field"
          style={{ background: 'var(--kros-success-bg)', color: 'var(--success)' }}
          value={formatNumber(position.kros_total_czk, 2)}
          readOnly
        />
      </td>

      {/* Actions */}
      <td>
        <div className="action-buttons">
          <button
            className="icon-button"
            onClick={handleDelete}
            title="Smazat"
          >
            ❌
          </button>
          <button
            className="icon-button"
            title="Info"
            onClick={() => alert(JSON.stringify(position, null, 2))}
          >
            ℹ️
          </button>
        </div>
      </td>
    </tr>
  );
}
