/**
 * PartHeader - Header for a construction part with name and concrete volume
 * v4.3.2: Correct architecture - input field for concrete volume (sync with beton row)
 * v4.4.0: Added OTSKP autocomplete search
 */

import { useState, useEffect, useMemo } from 'react';
import OtskpAutocomplete from './OtskpAutocomplete';
import { otskpAPI, API_URL } from '../services/api';
import { calculateElementTotalDays } from '@stavagent/monolit-shared';
import type { Position } from '@stavagent/monolit-shared';

interface Props {
  partName?: string;  // Name of the construction part (from OTSKP)
  betonQuantity: number;
  otskpCode?: string;
  catalogPrice?: number;
  catalogUnit?: string;
  partTotalKrosCzk?: number;  // Sum of KROS total for all positions in this part
  partPositions?: Position[];  // All positions in this part (for element total days)
  onPartNameUpdate: (partName: string) => void;  // Update part_name for all positions
  onBetonQuantityUpdate: (quantity: number) => void;
  onOtskpCodeAndNameUpdate: (code: string, name: string, unitPrice?: number, unit?: string) => void;
  onOpenFormworkCalculator?: () => void;
  isLocked: boolean;
  /** Project ID (bridge_id) — required for per-part registration */
  projectId?: string;
  /** Callback after successful part registration */
  onPartRegistered?: () => void;
}

export default function PartHeader({
  partName,
  betonQuantity,
  otskpCode,
  catalogPrice,
  catalogUnit,
  partTotalKrosCzk,
  partPositions,
  onPartNameUpdate,
  onBetonQuantityUpdate,
  onOtskpCodeAndNameUpdate,
  onOpenFormworkCalculator,
  isLocked,
  projectId,
  onPartRegistered,
}: Props) {
  // Calculate Kč/m³ for this part (for comparison with catalog)
  const calculatedPricePerM3 = betonQuantity > 0 && partTotalKrosCzk
    ? partTotalKrosCzk / betonQuantity
    : undefined;

  // Calculate element total days (all work types + curing)
  const elementTotalDays = useMemo(() => {
    if (!partPositions || partPositions.length === 0) return 0;
    return calculateElementTotalDays(partPositions);
  }, [partPositions]);
  const [editedName, setEditedName] = useState(partName || '');
  const [editedBeton, setEditedBeton] = useState(betonQuantity.toString());
  const [editedOtskp, setEditedOtskp] = useState(otskpCode || '');
  const [localCatalogPrice, setLocalCatalogPrice] = useState<number | undefined>(catalogPrice);
  const [localCatalogUnit, setLocalCatalogUnit] = useState<string | undefined>(catalogUnit);

  // Sync state when props change (two-way binding)
  useEffect(() => {
    setEditedName(partName || '');
  }, [partName]);

  useEffect(() => {
    setEditedBeton(betonQuantity.toString());
  }, [betonQuantity]);

  useEffect(() => {
    setEditedOtskp(otskpCode || '');
  }, [otskpCode]);

  useEffect(() => {
    setLocalCatalogPrice(catalogPrice);
  }, [catalogPrice]);

  useEffect(() => {
    setLocalCatalogUnit(catalogUnit);
  }, [catalogUnit]);

  // === Per-part registration state ===
  const [registering, setRegistering] = useState(false);
  const [regStatus, setRegStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [regMessage, setRegMessage] = useState('');

  // Derive sync status from positions
  const registeredCount = useMemo(
    () => (partPositions || []).filter(p => p.position_instance_id).length,
    [partPositions]
  );
  const totalCount = partPositions?.length ?? 0;
  const allRegistered = registeredCount > 0 && registeredCount === totalCount;
  const partiallyRegistered = registeredCount > 0 && registeredCount < totalCount;

  // Drift detection: any position whose kros_total_czk differs from its registered value?
  // We store registered_kros_total in position metadata at registration time.
  const hasDrift = useMemo(() => {
    if (registeredCount === 0) return false;
    return (partPositions || []).some(p => {
      if (!p.position_instance_id) return false;
      try {
        const meta = p.metadata ? JSON.parse(p.metadata) : {};
        return typeof meta.registered_kros_total === 'number' &&
          meta.registered_kros_total !== p.kros_total_czk;
      } catch { return false; }
    });
  }, [partPositions, registeredCount]);

  const handleRegisterPart = async () => {
    if (!projectId || !partName || registering) return;
    setRegistering(true);
    setRegStatus('idle');
    setRegMessage('');

    try {
      const res = await fetch(`${API_URL}/api/export-to-registry/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part_name: partName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setRegStatus('ok');
      setRegMessage(`${data.positions_count ?? 0} pozic`);
      onPartRegistered?.();
      setTimeout(() => setRegStatus('idle'), 4000);
    } catch (err) {
      setRegStatus('error');
      setRegMessage(err instanceof Error ? err.message : 'Chyba');
      setTimeout(() => setRegStatus('idle'), 5000);
    } finally {
      setRegistering(false);
    }
  };

  // Fetch catalog price when OTSKP code exists but price is not loaded
  useEffect(() => {
    const fetchCatalogPrice = async () => {
      if (otskpCode && !localCatalogPrice) {
        try {
          const otskpData = await otskpAPI.getByCode(otskpCode);
          if (otskpData?.unit_price) {
            setLocalCatalogPrice(otskpData.unit_price);
            setLocalCatalogUnit(otskpData.unit);
          }
        } catch (error) {
          // Code not found in catalog - that's okay
          console.debug(`OTSKP code ${otskpCode} not found in catalog`);
        }
      }
    };
    fetchCatalogPrice();
  }, [otskpCode, localCatalogPrice]);

  const handleNameBlur = () => {
    if (editedName !== partName) {
      onPartNameUpdate(editedName);
    }
  };

  const handleBetonBlur = () => {
    const numValue = parseFloat(editedBeton) || 0;

    if (numValue !== betonQuantity) {
      onBetonQuantityUpdate(numValue);
    }
  };

  const handleBetonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedBeton(e.target.value);
  };

  const handleOtskpSelect = (code: string, name: string, unitPrice?: number, unit?: string) => {
    setEditedOtskp(code);
    // Update local catalog price immediately for UI feedback
    if (unitPrice !== undefined) {
      setLocalCatalogPrice(unitPrice);
      setLocalCatalogUnit(unit);
    }
    // Don't update editedName locally - let API response update it via useEffect
    // This prevents the "flash" where it shows new name then reverts to old
    // Update BOTH code and name in a SINGLE API call to avoid race condition
    onOtskpCodeAndNameUpdate(code, name, unitPrice, unit);
  };

  return (
    <div className="part-header-container">
      {/* Part name input */}
      <div className="part-name-input-wrapper">
        <label className="part-name-label">Název části konstrukce:</label>
        <input
          type="text"
          className="part-name-input"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleNameBlur}
          disabled={isLocked}
          placeholder="např. ZÁKLADY ZE ŽELEZOBETONU DO C30/37"
          title="Název části konstrukce: detailní popis prvku"
          minLength={0}
        />
      </div>

      {/* Concrete volume input */}
      <div className="concrete-params">
        <div className="concrete-param">
          <label>Objem betonu celkem:</label>
          <input
            type="number"
            className="concrete-input"
            value={editedBeton}
            onChange={handleBetonChange}
            onBlur={handleBetonBlur}
            disabled={isLocked}
            step="0.01"
            min="0"
            placeholder="0.00"
            title="Zadejte celkový objem betonu v m³ - HLAVNÍ PARAMETR PRVKU"
          />
          <span style={{ marginLeft: '4px' }}>m³</span>
        </div>

        {/* OTSKP Code autocomplete */}
        <div className="concrete-param">
          <label>OTSKP kód:</label>
          <OtskpAutocomplete
            value={editedOtskp}
            onSelect={handleOtskpSelect}
            disabled={isLocked}
          />
        </div>

        {/* Catalog Price (read-only display) */}
        <div className="concrete-param">
          <label>Cena dle katalogu:</label>
          <div className="catalog-price-display" style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            background: localCatalogPrice ? 'var(--status-success-bg, #e8f5e9)' : 'var(--panel-inset)',
            borderRadius: 'var(--radius-sm)',
            minWidth: '140px',
            border: '1px solid var(--border-default)'
          }}>
            {localCatalogPrice ? (
              <span style={{
                fontWeight: 600,
                color: 'var(--status-success, #2e7d32)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {localCatalogPrice.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč/{localCatalogUnit || 'MJ'}
              </span>
            ) : (
              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                Vyberte OTSKP kód
              </span>
            )}
          </div>
        </div>

        {/* Calculated Kč/m³ for this part (for comparison) */}
        <div className="concrete-param">
          <label>⭐ Kč/m³ (výpočet):</label>
          <div className="calculated-price-display" style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            background: calculatedPricePerM3 ? 'var(--status-info-bg, #e3f2fd)' : 'var(--panel-inset)',
            borderRadius: 'var(--radius-sm)',
            minWidth: '140px',
            border: '1px solid var(--border-default)'
          }}>
            {calculatedPricePerM3 ? (
              <span style={{
                fontWeight: 600,
                color: 'var(--status-info, #1565c0)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {calculatedPricePerM3.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč/m³
              </span>
            ) : (
              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                —
              </span>
            )}
          </div>
        </div>

        {/* Element total days (all work types + curing) */}
        <div className="concrete-param">
          <label>Celk. doba:</label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            background: elementTotalDays > 0 ? '#fff3e0' : 'var(--panel-inset)',
            borderRadius: 'var(--radius-sm)',
            minWidth: '80px',
            border: '1px solid var(--border-default)'
          }}>
            {elementTotalDays > 0 ? (
              <span style={{
                fontWeight: 600,
                color: '#e65100',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {elementTotalDays} dní
              </span>
            ) : (
              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>—</span>
            )}
          </div>
        </div>

        {/* Formwork calculator button */}
        {onOpenFormworkCalculator && (
          <div className="concrete-param">
            <label>&nbsp;</label>
            <button
              onClick={onOpenFormworkCalculator}
              disabled={isLocked}
              title="Otevřít kalkulátor bednění (pronájem)"
              style={{
                background: '#1565c0',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '12px',
                opacity: isLocked ? 0.5 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              Kalkulátor bednění
            </button>
          </div>
        )}

        {/* Per-part registration button + sync status badge */}
        {projectId && (
          <div className="concrete-param" style={{ marginLeft: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              {allRegistered && !hasDrift && (
                <span title={`Všechny pozice registrovány${regMessage ? ` (${regMessage})` : ''}`}
                  style={{ color: '#22c55e', fontSize: '13px' }}>
                  ✅ {registeredCount}/{totalCount}
                </span>
              )}
              {partiallyRegistered && !hasDrift && (
                <span title={`${registeredCount} z ${totalCount} pozic registrováno`}
                  style={{ color: '#f59e0b', fontSize: '13px' }}>
                  🔗 {registeredCount}/{totalCount}
                </span>
              )}
              {hasDrift && (
                <span title="Výpočet se změnil od posledního přenosu — klikněte Registrovat znovu"
                  style={{ color: '#ef4444', fontSize: '13px', fontWeight: 700 }}>
                  ⚠️ změněno
                </span>
              )}
              {registeredCount === 0 && regStatus === 'idle' && (
                <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                  neregistrováno
                </span>
              )}
            </label>
            <button
              onClick={handleRegisterPart}
              disabled={registering || isLocked}
              title={
                registeredCount > 0
                  ? `Aktualizovat TOV pro část "${partName}" v Registru (${registeredCount}/${totalCount} pozic propojeno)`
                  : `Registrovat část "${partName}" do Registru rozpočtů`
              }
              style={{
                background: regStatus === 'ok'
                  ? '#22c55e'
                  : regStatus === 'error'
                  ? '#ef4444'
                  : registeredCount > 0 ? '#7c3aed' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                cursor: (registering || isLocked) ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '12px',
                opacity: (registering || isLocked) ? 0.6 : 1,
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {registering ? '⏳ Registruji...' : regStatus === 'ok' ? `✅ Hotovo (${regMessage})` : regStatus === 'error' ? `⚠️ Chyba` : registeredCount > 0 ? '📤 Aktualizovat TOV' : '📤 Registrovat část'}
            </button>
            {regStatus === 'error' && regMessage && (
              <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>{regMessage}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
