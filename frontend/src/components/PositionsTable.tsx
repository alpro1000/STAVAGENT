/**
 * PositionsTable - Main table with editable fields
 */

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePositions } from '../hooks/usePositions';
import { useSnapshots } from '../hooks/useSnapshots';
import { Position } from '@monolit/shared';
import PositionRow from './PositionRow';
import SnapshotBadge from './SnapshotBadge';

export default function PositionsTable() {
  const { selectedBridge, positions } = useAppContext();
  const { isLoading } = usePositions(selectedBridge);
  const { isLocked } = useSnapshots(selectedBridge);
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
      <SnapshotBadge />

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
                    <th title="Typ práce: beton, bednění, výztuž, oboustranné, jiné">Podtyp</th>
                    <th title="Měrná jednotka: m³, m², kg">MJ</th>
                    <th title="Množství v měrných jednotkách (EDITABLE)">Množství</th>
                    <th title="Počet lidí v partě (EDITABLE)">Lidi</th>
                    <th title="Hodinová sazba v CZK (EDITABLE)">Kč/hod</th>
                    <th title="Hodin za směnu (EDITABLE)">Hod/den</th>
                    <th title="Počet dní - koeficient 1 (EDITABLE)">Den</th>
                    <th title="Celkový počet hodin = lidi × hod/den × den">Hod celkem</th>
                    <th title="Celková cena = hod celkem × Kč/hod">Kč celkem</th>
                    <th title="Objem betonu této části">Beton m³</th>
                    <th title="⭐ KLÍČOVÁ METRIKA: Jednotková cena Kč/m³ betonu = Kč celkem / Beton m³">
                      Kč/m³ ⭐
                    </th>
                    <th title="KROS jednotková cena = ceil(Kč/m³ / 50) × 50">KROS JC</th>
                    <th title="KROS celkem = KROS JC × Beton m³">KROS celkem</th>
                    <th title="Request For Information - problémové položky">RFI</th>
                    <th title="Akce: Smazat / Info">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {partPositions.map((position) => (
                    <PositionRow key={position.id} position={position} isLocked={isLocked} />
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
