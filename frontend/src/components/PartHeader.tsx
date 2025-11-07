/**
 * PartHeader - Header for a construction part with editable name and concrete parameters
 */

import { useState } from 'react';

interface Props {
  itemName?: string;
  betonQuantity: number;
  onUpdate: (itemName: string) => void;
  isLocked: boolean;
}

export default function PartHeader({ itemName, betonQuantity, onUpdate, isLocked }: Props) {
  const [editedName, setEditedName] = useState(itemName || '');

  const handleBlur = () => {
    if (editedName !== itemName) {
      onUpdate(editedName);
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
          onBlur={handleBlur}
          disabled={isLocked}
          placeholder="např. ZÁKLADY ZE ŽELEZOBETONU DO C30/37"
          title="Název části konstrukce: detailní popis prvku"
        />
      </div>

      {/* Concrete parameters */}
      <div className="concrete-params">
        <div className="concrete-param">
          <label>MJ betonu:</label>
          <span className="concrete-value">M3</span>
        </div>
        <div className="concrete-param">
          <label>Množství betonu celkem:</label>
          <span className="concrete-value">
            {betonQuantity.toFixed(2).replace('.', ',')} m³
          </span>
        </div>
      </div>
    </div>
  );
}
