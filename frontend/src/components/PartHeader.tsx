/**
 * PartHeader - Header for a construction part with name and concrete volume
 * v4.3.2: Correct architecture - input field for concrete volume (sync with beton row)
 * v4.4.0: Added OTSKP autocomplete search
 */

import { useState, useEffect } from 'react';
import OtskpAutocomplete from './OtskpAutocomplete';

interface Props {
  itemName?: string;
  betonQuantity: number;
  otskpCode?: string;
  onItemNameUpdate: (itemName: string) => void;
  onBetonQuantityUpdate: (quantity: number) => void;
  onOtskpCodeAndNameUpdate: (code: string, name: string) => void;
  isLocked: boolean;
}

export default function PartHeader({
  itemName,
  betonQuantity,
  otskpCode,
  onItemNameUpdate,
  onBetonQuantityUpdate,
  onOtskpCodeAndNameUpdate,
  isLocked
}: Props) {
  const [editedName, setEditedName] = useState(itemName || '');
  const [editedBeton, setEditedBeton] = useState(betonQuantity.toString());
  const [editedOtskp, setEditedOtskp] = useState(otskpCode || '');

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

  const handleOtskpSelect = (code: string, name: string) => {
    setEditedOtskp(code);
    // Don't update editedName locally - let API response update it via useEffect
    // This prevents the "flash" where it shows new name then reverts to old
    // Update BOTH code and name in a SINGLE API call to avoid race condition
    onOtskpCodeAndNameUpdate(code, name);
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
      </div>
    </div>
  );
}
