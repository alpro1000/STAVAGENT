/**
 * PositionRow - Editable table row for a single position (v3.4 Modern UI)
 */

import { useState, useRef, useEffect } from 'react';
import { Position, SUBTYPE_ICONS, SUBTYPE_LABELS } from '@stavagent/monolit-shared';
import { useAppContext } from '../context/AppContext';
import { usePositions } from '../hooks/usePositions';
import { useConfig } from '../hooks/useConfig';
import FormulaDetailsModal from './FormulaDetailsModal';
import { Sparkles, Send, TriangleAlert, Pencil, CircleCheckBig, Lightbulb, Upload, Info, Settings, Trash2, Loader2, X } from 'lucide-react';

// AI Suggestion interface
interface DaysSuggestion {
  success: boolean;
  suggested_days: number;
  reasoning: string;
  confidence: number;
  norm_source: string;
  crew_size_recommendation?: number;
  error?: string;
}

interface Props {
  position: Position;
  isLocked?: boolean;
  partNumSets?: number;  // Number of formwork sets in this part (for curing÷sets display)
}

export default function PositionRow({ position, isLocked = false, partNumSets }: Props) {
  const { selectedBridge } = useAppContext();
  const { updatePositions, deletePosition, isUpdating } = usePositions(selectedBridge);
  const { data: config } = useConfig(); // Get feature flags from config

  const [editedFields, setEditedFields] = useState<Partial<Position>>({});
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFieldsRef = useRef<Set<string>>(new Set());

  // AI Days Suggestion states
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<DaysSuggestion | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Speed (MJ/h) manual input state - allows user to type speed and recalculate days
  const [speedInput, setSpeedInput] = useState<string>('');
  const [isEditingSpeed, setIsEditingSpeed] = useState(false);

  // Pump cost state (stored in metadata.pump_cost_czk)
  const parsedMeta = (() => {
    try { return position.metadata ? JSON.parse(position.metadata) : {}; } catch { return {}; }
  })();
  const defaultPumpCost = Math.ceil((position.qty || 0) / 20) * 2500;
  const [pumpCost, setPumpCost] = useState<number>(
    typeof parsedMeta.pump_cost_czk === 'number' ? parsedMeta.pump_cost_czk : defaultPumpCost
  );

  // Work name editing state
  const [isEditingWorkName, setIsEditingWorkName] = useState(false);
  const [workNameInput, setWorkNameInput] = useState('');

  // Portal TOV sync state
  const [syncingToPortal, setSyncingToPortal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  // Push this position's calculated data as DOV payload to Portal
  const handleSyncToPortal = async () => {
    if (!position.position_instance_id || syncingToPortal) return;
    setSyncingToPortal(true);
    setSyncStatus('idle');

    const PORTAL_API = (import.meta as any).env?.VITE_PORTAL_API_URL || 'https://stavagent-portal-backend-1086027517695.europe-west3.run.app';
    const professionMap: Record<string, string> = {
      beton: 'Betonář', 'bednění': 'Tesař / Bednář', výztuž: 'Železář / Armovač', jiné: 'Stavební dělník'
    };
    const profession = professionMap[position.subtype] || 'Stavební dělník';
    const crewSize = position.crew_size || 0;
    const shiftHours = position.shift_hours || 0;
    const days = position.days || 0;

    const dovPayload = {
      labor: [{
        id: `lab_${position.id}`,
        profession,
        count: crewSize,
        hours: shiftHours,
        norm_hours: position.labor_hours || crewSize * shiftHours * days,
        hourly_rate: position.wage_czk_ph || 0,
        total_cost_czk: position.cost_czk || 0,
      }],
      labor_summary: {
        total_norm_hours: position.labor_hours || crewSize * shiftHours * days,
        total_workers: crewSize,
        total_cost_czk: position.cost_czk || 0,
      },
      machinery: [],
      machinery_summary: { total_machine_hours: 0, total_units: 0, total_cost_czk: 0 },
      materials: [],
      materials_summary: { total_cost_czk: 0, item_count: 0 },
      formwork_rental: null,
      pump_rental: null,
      source_tag: 'MONOLIT_LIVE',
    };

    try {
      const res = await fetch(
        `${PORTAL_API}/api/positions/${position.position_instance_id}/dov`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: dovPayload }), signal: AbortSignal.timeout(5000) }
      );
      setSyncStatus(res.ok ? 'ok' : 'error');
    } catch {
      setSyncStatus('error');
    } finally {
      setSyncingToPortal(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  // Check if AI Days Suggestion feature is enabled
  const isAiDaysSuggestEnabled = config?.feature_flags?.FF_AI_DAYS_SUGGEST ?? false;

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

  /**
   * AI Days Suggestion - Call Multi-Role API
   * Gets official construction norms from KROS/RTS/ČSN
   */
  const handleSuggestDays = async () => {
    if (isLocked || loadingSuggestion) return;

    // Validate required fields
    if (!position.qty || position.qty <= 0) {
      alert('⚠️ Nejprve zadejte množství (qty)');
      return;
    }

    setLoadingSuggestion(true);
    setSuggestion(null);
    setShowTooltip(false);

    try {
      const response = await fetch(`/api/positions/${position.id}/suggest-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setSuggestion(data);
      setShowTooltip(true);

      // Auto-fill days field with suggestion if successful
      if (data.success && data.suggested_days > 0) {
        handleFieldChange('days', data.suggested_days);
      }

    } catch (error) {
      console.error('[AI Suggestion] Error:', error);
      alert('❌ Chyba při získávání AI návrhu. Zkuste to znovu.');
    } finally {
      setLoadingSuggestion(false);
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

  // Compute derived values locally so they update immediately when user edits
  const qty = getValue('qty');
  const crewSize = getValue('crew_size');
  const shiftHours = getValue('shift_hours');
  const days = getValue('days');
  const wageCzkPh = getValue('wage_czk_ph');
  const concreteM3 = position.concrete_m3 || 0;

  // Compute labor_hours locally: crew_size × shift_hours × days
  const computedLaborHours = crewSize * shiftHours * days;

  // Compute cost_czk locally: labor_hours × wage_czk_ph
  const computedCostCzk = computedLaborHours * wageCzkPh;

  // Compute unit_cost_on_m3 locally: cost_czk / concrete_m3
  const computedUnitCostOnM3 = concreteM3 > 0 ? computedCostCzk / concreteM3 : 0;

  // Compute KROS unit: ceil(unit_cost_on_m3 / 50) × 50
  const computedKrosUnitCzk = Math.ceil(computedUnitCostOnM3 / 50) * 50;

  // Compute KROS total: kros_unit_czk × concrete_m3
  const computedKrosTotalCzk = computedKrosUnitCzk * concreteM3;

  const icon = SUBTYPE_ICONS[position.subtype as keyof typeof SUBTYPE_ICONS] || '📋';

  // Get default label from subtype
  const defaultLabel = SUBTYPE_LABELS[position.subtype as keyof typeof SUBTYPE_LABELS] || position.subtype;

  // For 'beton' always show default label (ignore item_name from Excel import)
  // For other subtypes, display custom name if set, otherwise show default
  const displayLabel = position.subtype === 'beton'
    ? defaultLabel
    : (position.item_name || defaultLabel);

  // Start editing work name
  const handleStartEditWorkName = () => {
    if (isLocked) return;

    // Prevent editing 'beton' name - it must always be "Betonování"
    if (position.subtype === 'beton') {
      alert('❌ Nelze upravit název "Betonování"\n\nTato řádka má pevně stanovený název, který nelze měnit.');
      return;
    }

    // Always start with default label for editing
    setWorkNameInput(position.item_name || defaultLabel);
    setIsEditingWorkName(true);
  };

  // Save edited work name
  const handleSaveWorkName = () => {
    const trimmedInput = workNameInput.trim();

    // Determine new value for item_name
    let newItemName: string | undefined;

    // If empty or same as default → clear custom name (revert to default)
    if (!trimmedInput || trimmedInput === defaultLabel) {
      newItemName = undefined;  // Clear custom name
    } else if (trimmedInput !== position.item_name) {
      newItemName = trimmedInput;  // Save custom name
    } else {
      // No change - exit early
      setIsEditingWorkName(false);
      setWorkNameInput('');
      return;
    }

    // Close editing UI
    setIsEditingWorkName(false);
    setWorkNameInput('');

    // CRITICAL: Send update DIRECTLY to server, bypassing editedFields
    // (setState is async, so handleBlur would see old empty editedFields)
    updatePositions([
      {
        id: position.id,
        item_name: newItemName
      }
    ]);
  };

  // Cancel editing work name
  const handleCancelEditWorkName = () => {
    setIsEditingWorkName(false);
    setWorkNameInput('');
  };

  // Save pump rental cost to metadata.pump_cost_czk
  const handlePumpRentalChange = (cost: number) => {
    if (isLocked) return;
    let meta: Record<string, unknown> = {};
    try { if (position.metadata) meta = JSON.parse(position.metadata); } catch { /* ignore */ }
    meta.pump_cost_czk = cost;
    updatePositions([{ id: position.id, metadata: JSON.stringify(meta) }]);
  };

  return (
    <>
    <tr data-position-id={position.id} data-position-instance-id={position.position_instance_id || undefined} className={`table-row ${position.subtype} ${position.has_rfi ? 'has-rfi' : ''} ${isLocked ? 'locked' : ''} ${Object.keys(editedFields).length > 0 ? 'editing' : ''} ${isUpdating ? 'saving' : ''}`}>
      {/* Locked indicator */}
      {isLocked && <td className="lock-indicator col-lock">🔒</td>}

      {/* Subtype with icon - EDITABLE NAME */}
      <td className="cell-subtype col-podtyp">
        <div className="subtype-cell">
          <span className="subtype-icon">{icon}</span>
          {isEditingWorkName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
              <input
                type="text"
                className="input-cell"
                value={workNameInput}
                onChange={(e) => setWorkNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveWorkName();
                  if (e.key === 'Escape') handleCancelEditWorkName();
                }}
                autoFocus
                style={{ flex: 1, minWidth: '120px' }}
                placeholder={displayLabel}
              />
              <button
                onClick={handleSaveWorkName}
                className="btn-save-work-name"
                title="Uložit"
                style={{
                  padding: '2px 6px',
                  fontSize: '12px',
                  background: 'var(--color-success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                ✓
              </button>
              <button
                onClick={handleCancelEditWorkName}
                className="btn-cancel-work-name"
                title="Zrušit"
                style={{
                  padding: '2px 6px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
              <span className="subtype-label" title={`Internal: ${position.subtype}`}>
                {displayLabel}
              </span>
              {!isLocked && position.subtype !== 'beton' && (
                <button
                  onClick={handleStartEditWorkName}
                  className="btn-edit-work-name"
                  title="Upravit název práce"
                  style={{
                    padding: '2px 6px',
                    fontSize: '11px',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid transparent',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    opacity: 0.5,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.5';
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Pencil size={11} />
                </button>
              )}
            </div>
          )}
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

      {/* Days with AI Suggestion */}
      <td className="cell-input col-den">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
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
            style={{ flex: 1 }}
          />

          {/* AI Suggestion Button - Only show if feature flag enabled */}
          {isAiDaysSuggestEnabled && (
            <button
              onClick={handleSuggestDays}
              disabled={isLocked || loadingSuggestion || !position.qty}
              className="ai-suggest-button"
              title="AI návrh norem času (KROS/RTS/ČSN)"
              style={{
                background: loadingSuggestion ? '#666' : '#4CAF50',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 6px',
                cursor: isLocked || loadingSuggestion ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '28px',
                height: '28px',
                opacity: isLocked || !position.qty ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              <Sparkles size={16} color="white" />
            </button>
          )}

          {/* AI Suggestion Tooltip */}
          {isAiDaysSuggestEnabled && showTooltip && suggestion && (
            <div
              className="ai-suggestion-tooltip"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '8px',
                background: 'white',
                border: '2px solid #4CAF50',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
                minWidth: '300px',
                maxWidth: '400px'
              }}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: suggestion.success ? '#4CAF50' : '#ff9800', fontSize: '14px' }}>
                  {suggestion.success ? <><CircleCheckBig size={14} className="inline" /> AI návrh</> : <><TriangleAlert size={14} className="inline" /> Empirický odhad</>}:{' '}
                  {suggestion.suggested_days} dní
                </strong>
              </div>

              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                <div><strong>Zdroj:</strong> {suggestion.norm_source}</div>
                <div><strong>Jistota:</strong> {Math.round(suggestion.confidence * 100)}%</div>
                {suggestion.crew_size_recommendation &&
                 suggestion.crew_size_recommendation !== position.crew_size && (
                  <div style={{ color: '#ff9800', marginTop: '4px' }}>
                    <Lightbulb size={14} className="inline" /> Doporučená parta: {suggestion.crew_size_recommendation} lidí
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: '11px',
                  color: '#444',
                  borderTop: '1px solid #eee',
                  paddingTop: '8px',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}
              >
                {suggestion.reasoning}
              </div>

              {suggestion.error && (
                <div style={{ marginTop: '8px', color: '#f44336', fontSize: '11px' }}>
                  <TriangleAlert size={11} className="inline" /> {suggestion.error}
                </div>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Speed (MJ/hour) - Editable, bidirectional with days */}
      {/* Formula: speed = qty / labor_hours (MJ/hod) - standard construction norm */}
      <td className="cell-input col-rychlost">
        <input
          type="number"
          step="0.01"
          min="0"
          className="input-cell"
          value={
            // When editing, show user's input; otherwise show calculated value
            isEditingSpeed ? speedInput : (() => {
              const qty = getValue('qty');
              const crewSize = getValue('crew_size');
              const shiftHours = getValue('shift_hours');
              const days = getValue('days');
              const laborHours = crewSize * shiftHours * days;
              if (laborHours > 0 && qty > 0) {
                return parseFloat((qty / laborHours).toFixed(3));
              }
              return '';
            })()
          }
          onFocus={(e) => {
            // Start editing - capture current calculated value
            setIsEditingSpeed(true);
            const currentValue = e.target.value;
            setSpeedInput(currentValue);
          }}
          onChange={(e) => {
            // While editing, just update local state (don't recalculate yet)
            setSpeedInput(e.target.value);
          }}
          onBlur={(e) => {
            // On blur - recalculate days from entered speed
            const speedPerHour = parseFloat(e.target.value) || 0;
            if (speedPerHour > 0) {
              const qty = getValue('qty');
              const crewSize = getValue('crew_size');
              const shiftHours = getValue('shift_hours');

              const laborHoursNeeded = qty / speedPerHour;
              const hoursPerDay = crewSize * shiftHours;

              if (hoursPerDay > 0) {
                const newDays = laborHoursNeeded / hoursPerDay;
                handleFieldChange('days', Math.max(0.5, parseFloat(newDays.toFixed(1))));
              }
            }
            // Exit editing mode - will show calculated value again
            setIsEditingSpeed(false);
            setSpeedInput('');
            handleBlur();
          }}
          disabled={isLocked}
          placeholder="—"
          title={`Norma rychlosti (${position.unit}/hod). Zadejte normu → automaticky se přepočítají dny. Nebo zadejte dny → norma se vypočítá zpětně.`}
        />
      </td>

      {/* COMPUTED CELLS - Readonly (gray) - Using locally computed values for instant update */}

      {/* Labor hours */}
      <td className="cell-computed col-hod-celkem">
        <div className="computed-cell" title={`${formatNumber(computedLaborHours, 1)} hod (= ${crewSize} × ${shiftHours} × ${days})`}>
          {formatNumber(computedLaborHours, 1)}
        </div>
      </td>

      {/* Cost CZK */}
      <td className="cell-computed col-kc-celkem">
        <div className="computed-cell" title={`${formatNumber(computedCostCzk, 2)} CZK (= ${formatNumber(computedLaborHours, 1)} × ${wageCzkPh})`}>
          {formatNumber(computedCostCzk, 2)}
        </div>
      </td>

      {/* KROS CELLS - Success green with glow */}

      {/* Unit cost on m³ - KEY METRIC */}
      <td className="cell-kros-key col-kc-m3">
        <div
          className={`kros-cell kros-key ${position.has_rfi ? 'warning' : ''}`}
          title={`${formatNumber(computedUnitCostOnM3, 2)} CZK/m³ ⭐ (= ${formatNumber(computedCostCzk, 2)} / ${concreteM3})`}
        >
          {formatNumber(computedUnitCostOnM3, 2)}
        </div>
      </td>

      {/* KROS unit */}
      <td className="cell-kros col-kros-jc">
        <div
          className="kros-cell"
          title={`${formatNumber(computedKrosUnitCzk, 0)} CZK (= ceil(${formatNumber(computedUnitCostOnM3, 2)} / 50) × 50)`}
        >
          {formatNumber(computedKrosUnitCzk, 0)}
        </div>
      </td>

      {/* KROS total */}
      <td className="cell-kros col-kros-celkem">
        <div
          className="kros-cell"
          title={`${formatNumber(computedKrosTotalCzk, 2)} CZK (= ${formatNumber(computedKrosUnitCzk, 0)} × ${concreteM3})`}
        >
          {formatNumber(computedKrosTotalCzk, 2)}
        </div>
      </td>

      {/* RFI indicator */}
      <td className="cell-rfi col-rfi">
        {position.has_rfi && (
          <div className="rfi-badge" title={position.rfi_message || 'Request For Information'}>
            <TriangleAlert size={14} />
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
            <Trash2 size={13} />
          </button>
          <button
            className="icon-btn btn-info"
            title="Zobrazit detaily\n\nVidět všechny výpočty,\nformule a surová data"
            onClick={() => setIsDetailsOpen(true)}
          >
            <Info size={13} />
          </button>
          {/* Portal TOV sync — only visible when position is linked to Portal */}
          {position.position_instance_id && (
            <button
              className="icon-btn"
              onClick={handleSyncToPortal}
              disabled={syncingToPortal}
              title={
                syncStatus === 'ok'
                  ? '✅ Přeneseno do Portal TOV'
                  : syncStatus === 'error'
                  ? '⚠️ Přenos selhal – zkuste znovu'
                  : '📤 Přenést do TOV\n\nOdešle výpočet (normohodiny, náklady)\npřímo do TOV tohoto záznamu v Registru'
              }
              style={{
                color: syncStatus === 'ok' ? '#22c55e' : syncStatus === 'error' ? '#ef4444' : '#6366f1',
                opacity: syncingToPortal ? 0.5 : 1,
              }}
            >
              {syncingToPortal ? (
                <Loader2 size={13} />
              ) : syncStatus === 'ok' ? (
                <CircleCheckBig size={13} />
              ) : syncStatus === 'error' ? (
                <TriangleAlert size={13} />
              ) : (
                <Send size={13} />
              )}
            </button>
          )}
        </div>
      </td>
    </tr>

    {/* Curing sub-row - only for beton positions */}
    {position.subtype === 'beton' && (
      <tr className="curing-sub-row" style={{
        background: 'var(--status-warning-bg, #fff8e1)',
        borderBottom: '1px solid var(--border-default, #eee)'
      }}>
        {isLocked && <td></td>}
        <td colSpan={2} style={{ padding: '4px 12px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={14} />
            <span style={{ fontWeight: 600, color: '#e65100' }}>Zrání betonu</span>
          </div>
        </td>
        <td colSpan={4}></td>
        <td style={{ padding: '4px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              className="input-cell"
              value={(editedFields as any).curing_days ?? (position as any).curing_days ?? 3}
              onChange={(e) => handleFieldChange('curing_days' as any, Math.max(0, parseInt(e.target.value) || 0))}
              onBlur={handleBlur}
              disabled={isLocked}
              title="Dny zrání betonu (technologická pauza). Výchozí: 3 dny."
              style={{ width: '50px', textAlign: 'center', fontWeight: 600, fontSize: '13px' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>dní</span>
          </div>
        </td>
        <td colSpan={7} style={{ padding: '4px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          {(() => {
            const curingDays = (editedFields as any).curing_days ?? (position as any).curing_days ?? 3;
            const numSets = partNumSets || 1;
            if (numSets > 1) {
              const effective = (curingDays / numSets).toFixed(1);
              return (
                <span>
                  Technologická pauza • {curingDays} dní ÷ {numSets} sad = <b style={{ color: '#e65100' }}>{effective} efektivních dní</b>
                </span>
              );
            }
            return <span>Technologická pauza • {curingDays} dní zrání betonu</span>;
          })()}
        </td>
        <td></td>
      </tr>
    )}

    {/* Pump sub-row - only for beton positions */}
    {position.subtype === 'beton' && (
      <tr className="pump-sub-row" style={{
        background: 'var(--status-info-bg, #e3f2fd)',
        borderBottom: '1px solid var(--border-default, #eee)'
      }}>
        {isLocked && <td></td>}
        <td colSpan={2} style={{ padding: '4px 12px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={14} />
            <span style={{ fontWeight: 600, color: '#1565c0' }}>Čerpadlo betonu</span>
          </div>
        </td>
        <td colSpan={7}></td>
        <td style={{ padding: '4px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="number"
              min={0}
              step={500}
              className="input-cell"
              value={pumpCost}
              onChange={(e) => setPumpCost(Math.max(0, parseFloat(e.target.value) || 0))}
              onBlur={(e) => handlePumpRentalChange(Math.max(0, parseFloat(e.target.value) || 0))}
              disabled={isLocked}
              title="Celkové náklady na čerpadlo betonu (Kč). Uloží se do TOV export."
              style={{ width: '80px', textAlign: 'right', fontWeight: 600, fontSize: '13px' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Kč</span>
          </div>
        </td>
        <td colSpan={4} style={{ padding: '4px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          {(() => {
            const estimateHours = Math.ceil((position.qty || 0) / 20);
            const estimate = estimateHours * 2500;
            return (
              <span>
                Odhad: {position.qty || 0} m³ ÷ 20 m³/h × 2 500 Kč/h = <b style={{ color: '#1565c0' }}>{estimate.toLocaleString('cs-CZ')} Kč</b>
                {pumpCost !== estimate && pumpCost !== defaultPumpCost && (
                  <span style={{ marginLeft: '8px', color: '#4caf50' }}>✓ vlastní</span>
                )}
              </span>
            );
          })()}
        </td>
        <td></td>
      </tr>
    )}

    {/* Formula Details Modal */}
    <FormulaDetailsModal
      position={position}
      isOpen={isDetailsOpen}
      onClose={() => setIsDetailsOpen(false)}
    />
    </>
  );
}
