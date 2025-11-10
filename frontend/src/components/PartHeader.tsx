/**
 * PartHeader - Header for a construction part with name and concrete volume
 * v4.3.2: Correct architecture - input field for concrete volume (sync with beton row)
 */

import { useState, useEffect } from 'react';

interface Props {
  itemName?: string;
  betonQuantity: number;
  otskpCode?: string;
  onItemNameUpdate: (itemName: string) => void;
  onBetonQuantityUpdate: (quantity: number) => void;
  onOtskpCodeUpdate: (code: string) => void;
  isLocked: boolean;
}

export default function PartHeader({
  itemName,
  betonQuantity,
  otskpCode,
  onItemNameUpdate,
  onBetonQuantityUpdate,
  onOtskpCodeUpdate,
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
    console.log(`🪨 PartHeader useEffect: betonQuantity changed to ${betonQuantity}, syncing state`);
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
    console.log(`🪨 PartHeader.handleBetonBlur: value="${editedBeton}", parsed=${numValue}, current=${betonQuantity}`);

    if (numValue !== betonQuantity) {
      console.log(`🪨 Calling onBetonQuantityUpdate(${numValue})`);
      onBetonQuantityUpdate(numValue);
    } else {
      console.log(`🪨 Value unchanged, not calling callback`);
    }
  };

  const handleBetonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedBeton(e.target.value);
    console.log(`🪨 PartHeader.handleBetonChange: ${e.target.value}`);
  };

  const handleOtskpBlur = () => {
    if (editedOtskp !== otskpCode) {
      onOtskpCodeUpdate(editedOtskp);
    }
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

        {/* OTSKP Code input */}
        <div className="concrete-param">
          <label>OTSKP kód:</label>
          <input
            type="text"
            className="concrete-input"
            value={editedOtskp}
            onChange={(e) => setEditedOtskp(e.target.value)}
            onBlur={handleOtskpBlur}
            disabled={isLocked}
            placeholder="např. 113472"
            title="OTSKP kód z katalogu pro tento prvek konstrukce"
            style={{ width: '140px', fontFamily: 'monospace' }}
          />
        </div>
      </div>
    </div>
  );
}
