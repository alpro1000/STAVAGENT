/**
 * PartHeader - Header for a construction part with name and concrete volume
 * v4.3.2: Correct architecture - input field for concrete volume (sync with beton row)
 * v4.4.0: Added OTSKP autocomplete search
 */

import { useState, useEffect } from 'react';
import OtskpAutocomplete from './OtskpAutocomplete';
import { otskpAPI } from '../services/api';

interface Props {
  itemName?: string;
  betonQuantity: number;
  otskpCode?: string;
  catalogPrice?: number;
  catalogUnit?: string;
  partTotalKrosCzk?: number;  // Sum of KROS total for all positions in this part
  onItemNameUpdate: (itemName: string) => void;
  onBetonQuantityUpdate: (quantity: number) => void;
  onOtskpCodeAndNameUpdate: (code: string, name: string, unitPrice?: number, unit?: string) => void;
  isLocked: boolean;
}

export default function PartHeader({
  itemName,
  betonQuantity,
  otskpCode,
  catalogPrice,
  catalogUnit,
  partTotalKrosCzk,
  onItemNameUpdate,
  onBetonQuantityUpdate,
  onOtskpCodeAndNameUpdate,
  isLocked
}: Props) {
  // Calculate Kč/m³ for this part (for comparison with catalog)
  const calculatedPricePerM3 = betonQuantity > 0 && partTotalKrosCzk
    ? partTotalKrosCzk / betonQuantity
    : undefined;
  const [editedName, setEditedName] = useState(itemName || '');
  const [editedBeton, setEditedBeton] = useState(betonQuantity.toString());
  const [editedOtskp, setEditedOtskp] = useState(otskpCode || '');
  const [localCatalogPrice, setLocalCatalogPrice] = useState<number | undefined>(catalogPrice);
  const [localCatalogUnit, setLocalCatalogUnit] = useState<string | undefined>(catalogUnit);

  // Sync state when props change (two-way binding)
  useEffect(() => {
    setEditedName(itemName || '');
  }, [itemName]);

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
    if (editedName !== itemName) {
      onItemNameUpdate(editedName);
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
      </div>
    </div>
  );
}
