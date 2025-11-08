/**
 * PartHeader - Header for a construction part with name and concrete volume
 * v4.3.2: Correct architecture - input field for concrete volume (sync with beton row)
 */

import { useState } from 'react';

interface Props {
  itemName?: string;
  betonQuantity: number;
  onItemNameUpdate: (itemName: string) => void;
  onBetonQuantityUpdate: (quantity: number) => void;
  isLocked: boolean;
}

export default function PartHeader({
  itemName,
  betonQuantity,
  onItemNameUpdate,
  onBetonQuantityUpdate,
  isLocked
}: Props) {
  const [editedName, setEditedName] = useState(itemName || '');
  const [editedBeton, setEditedBeton] = useState(betonQuantity.toString());

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
      </div>
    </div>
  );
}
