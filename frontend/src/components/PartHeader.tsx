/**
 * PartHeader - Header for a construction part (name only)
 * Quantity input moved to PositionRow for beton subtype
 */

import { useState } from 'react';

interface Props {
  itemName?: string;
  onItemNameUpdate: (itemName: string) => void;
  isLocked: boolean;
}

export default function PartHeader({
  itemName,
  onItemNameUpdate,
  isLocked
}: Props) {
  const [editedName, setEditedName] = useState(itemName || '');

  const handleNameBlur = () => {
    if (editedName !== itemName) {
      onItemNameUpdate(editedName);
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
        />
      </div>
    </div>
  );
}
