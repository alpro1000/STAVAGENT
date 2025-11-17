/**
 * PositionRow - Editable table row for a single position (v3.4 Modern UI)
 */

import { useState, useRef, useEffect } from 'react';
import { Position, SUBTYPE_ICONS, SUBTYPE_LABELS } from '@monolit/shared';
import { useAppContext } from '../context/AppContext';
import { usePositions } from '../hooks/usePositions';
import FormulaDetailsModal from './FormulaDetailsModal';

interface Props {
  position: Position;
  isLocked?: boolean;
}

export default function PositionRow({ position, isLocked = false }: Props) {
  const { selectedBridge } = useAppContext();
  const { updatePositions, deletePosition, isUpdating } = usePositions(selectedBridge);

  const [editedFields, setEditedFields] = useState<Partial<Position>>({});
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFieldsRef = useRef<Set<string>>(new Set());

  const handleFieldChange = (field: keyof Position, value: any) => {
    if (isLocked) return;

    setEditedFields((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // FIX: Debounce blur - don't send immediately, wait 300ms
  const handleBlur = () => {
    if (Object.keys(editedFields).length === 0 || isLocked) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Track which fields we're about to send
    const fieldsToSend = { ...editedFields };
    pendingFieldsRef.current = new Set(Object.keys(fieldsToSend));

    // Set new timer for debounced update
    debounceTimerRef.current = setTimeout(() => {
      updatePositions([
        {
          id: position.id,
          ...fieldsToSend
        }
      ]);

      // FIX: Only clear sent fields, preserve any new edits made during debounce
      setEditedFields((prev) => {
        const updated = { ...prev };
        // Remove only the fields we just sent
        pendingFieldsRef.current.forEach(field => {
          delete updated[field as keyof Position];
        });
        return updated;
      });

      debounceTimerRef.current = null;
      pendingFieldsRef.current.clear();
    }, 300); // 300ms debounce
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleDelete = () => {
    // CRITICAL: Prevent deletion of beton row - it's essential for calculations
    if (position.subtype === 'beton') {
      alert('❌ Nelze smazat Betonování řádek\n\nTato řádka je KRITICKÁ pro správné výpočty:\n- Určuje objem betonu (concrete_m3)\n- Ovlivňuje ceny všech ostatních prací (Kč/m³)\n\nProto ji nelze odstranit.\n\nAbyste změnili objem betonu, editujte pole "Objem betonu celkem" v PartHeader výše.');
      return;
    }

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
  const displayLabel = SUBTYPE_LABELS[position.subtype as keyof typeof SUBTYPE_LABELS] || position.subtype;

  return (
    <>
    <tr className={`table-row ${position.subtype} ${position.has_rfi ? 'has-rfi' : ''} ${isLocked ? 'locked' : ''} ${Object.keys(editedFields).length > 0 ? 'editing' : ''} ${isUpdating ? 'saving' : ''}`}>
      {/* Locked indicator */}
      {isLocked && <td className="lock-indicator col-lock">🔒</td>}

      {/* Subtype with icon */}
      <td className="cell-subtype col-podtyp">
        <div className="subtype-cell">
          <span className="subtype-icon">{icon}</span>
          <span className="subtype-label" title={`Internal: ${position.subtype}`}>{displayLabel}</span>
        </div>
      </td>

      {/* Unit - Editable */}
      <td className="cell-unit col-mj">
        <input
          type="text"
          maxLength={10}
          className="input-cell"
          value={editedFields.unit ?? position.unit}
          onChange={(e) => handleFieldChange('unit', e.target.value)}
          onBlur={handleBlur}
          disabled={isLocked}
          placeholder="m2"
          title="Měrná jednotka (m2, m3, t, ks, ...)"
        />
      </td>

      {/* INPUT CELLS - Editable (orange/cyan gradient) */}

      {/* Qty */}
      <td className={`cell-input col-mnozstvi ${position.subtype === 'beton' ? 'cell-computed' : ''}`}>
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
              ? 'Objem betonu - Betonování (čte se z PartHeader výše - "Objem betonu celkem"). Klikněte tam pro změnu.'
              : 'Množství v měrných jednotkách'
          }
        />
      </td>

      {/* Crew size */}
      <td className="cell-input col-lidi">
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
      <td className="cell-input col-cena-hod">
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
      <td className="cell-input col-hod-den">
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
      <td className="cell-input col-den">
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
      <td className="cell-computed col-hod-celkem">
        <div className="computed-cell" title={`${formatNumber(position.labor_hours, 1)} hod (= crew_size × shift_hours × days)`}>
          {formatNumber(position.labor_hours, 1)}
        </div>
      </td>

      {/* Cost CZK */}
      <td className="cell-computed col-kc-celkem">
        <div className="computed-cell" title={`${formatNumber(position.cost_czk, 2)} CZK (= labor_hours × wage_czk_ph)`}>
          {formatNumber(position.cost_czk, 2)}
        </div>
      </td>

      {/* KROS CELLS - Success green with glow */}

      {/* Unit cost on m³ - KEY METRIC */}
      <td className="cell-kros-key col-kc-m3">
        <div
          className={`kros-cell kros-key ${position.has_rfi ? 'warning' : ''}`}
          title={`${formatNumber(position.unit_cost_on_m3, 2)} CZK/m³ ⭐ (= ${formatNumber(position.cost_czk, 2)} / ${position.concrete_m3})`}
        >
          {formatNumber(position.unit_cost_on_m3, 2)}
        </div>
      </td>

      {/* KROS unit */}
      <td className="cell-kros col-kros-jc">
        <div
          className="kros-cell"
          title={`${formatNumber(position.kros_unit_czk, 0)} CZK (= ceil(${formatNumber(position.unit_cost_on_m3, 2)} / 50) × 50)`}
        >
          {formatNumber(position.kros_unit_czk, 0)}
        </div>
      </td>

      {/* KROS total */}
      <td className="cell-kros col-kros-celkem">
        <div
          className="kros-cell"
          title={`${formatNumber(position.kros_total_czk, 2)} CZK (= ${formatNumber(position.kros_unit_czk, 0)} × ${position.concrete_m3})`}
        >
          {formatNumber(position.kros_total_czk, 2)}
        </div>
      </td>

      {/* RFI indicator */}
      <td className="cell-rfi col-rfi">
        {position.has_rfi && (
          <div className="rfi-badge" title={position.rfi_message || 'Request For Information'}>
            ⚠️
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="cell-actions col-akce">
        <div className="action-buttons">
          <button
            className="icon-btn btn-delete"
            onClick={handleDelete}
            title={
              position.subtype === 'beton'
                ? '❌ NELZE - Betonování je kritické\n\nTato řádka určuje objem betonu.\nSmaže se pouze s celou částí.'
                : isLocked
                ? '❌ ZAFIXOVÁNO\n\nSnapshot je aktivní.\nOdemkněte jej nejdříve.'
                : '❌ Smazat\n\nTrvale odstraní tuto pozici\nz projektu. NELZE vrátit!'
            }
            disabled={isLocked || position.subtype === 'beton'}
          >
            ❌
          </button>
          <button
            className="icon-btn btn-info"
            title="ℹ️ Zobrazit detaily\n\nVidět všechny výpočty,\nformule a surová data"
            onClick={() => setIsDetailsOpen(true)}
          >
            ℹ️
          </button>
        </div>
      </td>
    </tr>

    {/* Formula Details Modal */}
    <FormulaDetailsModal
      position={position}
      isOpen={isDetailsOpen}
      onClose={() => setIsDetailsOpen(false)}
    />
    </>
  );
}
