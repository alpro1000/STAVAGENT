/**
 * PositionsTable - Main table with editable fields
 */

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePositions } from '../hooks/usePositions';
import { Position } from '@monolit/shared';
import { SUBTYPE_ICONS } from '@monolit/shared';
import PositionRow from './PositionRow';

export default function PositionsTable() {
  const { selectedBridge, positions } = useAppContext();
  const { isLoading } = usePositions(selectedBridge);
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());

  // Group positions by part_name
  const groupedPositions = useMemo(() => {
    const groups: Record<string, Position[]> = {};

    positions.forEach((pos) => {
      if (!groups[pos.part_name]) {
        groups[pos.part_name] = [];
      }
      groups[pos.part_name].push(pos);
    });

    return groups;
  }, [positions]);

  const togglePart = (partName: string) => {
    const newExpanded = new Set(expandedParts);
    if (newExpanded.has(partName)) {
      newExpanded.delete(partName);
    } else {
      newExpanded.add(partName);
    }
    setExpandedParts(newExpanded);
  };

  // Expand all by default
  useEffect(() => {
    const allParts = Object.keys(groupedPositions);
    setExpandedParts(new Set(allParts));
  }, [groupedPositions]);

  if (!selectedBridge) {
    return (
      <div className="positions-container">
        <div className="empty-state">
          <div className="empty-state-icon">🏗️</div>
          <h3>Vyberte most</h3>
          <p>Vyberte most ze seznamu vlevo nebo nahrajte XLSX soubor</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="positions-container">
        <div style={{ textAlign: 'center', padding: '64px' }}>
          <div className="spinner"></div>
          <p className="text-muted" style={{ marginTop: '16px' }}>Načítání pozic...</p>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="positions-container">
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>Žádné pozice</h3>
          <p>Pro tento most nejsou žádné pozice</p>
        </div>
      </div>
    );
  }

  return (
    <div className="positions-container">
      {Object.entries(groupedPositions).map(([partName, partPositions]) => {
        const isExpanded = expandedParts.has(partName);

        return (
          <div key={partName} className="part-card">
            <div className="part-header" onClick={() => togglePart(partName)}>
              <span>{partName}</span>
              <span>{isExpanded ? '▼' : '▶'} {partPositions.length} pozic</span>
            </div>

            {isExpanded && (
              <table className="positions-table">
                <thead>
                  <tr>
                    <th>Podtyp</th>
                    <th>MJ</th>
                    <th>Množství</th>
                    <th>Lidi</th>
                    <th>Kč/hod</th>
                    <th>Hod/den</th>
                    <th>Den</th>
                    <th>Hod celkem</th>
                    <th>Kč celkem</th>
                    <th>Beton m³</th>
                    <th className="tooltip" data-tooltip="Kč/m³ betonu - klíčová metrika!">
                      Kč/m³
                    </th>
                    <th>KROS JC</th>
                    <th>KROS celkem</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {partPositions.map((position) => (
                    <PositionRow key={position.id} position={position} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
