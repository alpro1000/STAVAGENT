/**
 * PositionsTable - Main table with editable fields
 */

import { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../context/AppContext';
import { usePositions } from '../hooks/usePositions';
import { useSnapshots } from '../hooks/useSnapshots';
import { positionsAPI } from '../services/api';
import { Position } from '@monolit/shared';
import PositionRow from './PositionRow';
import SnapshotBadge from './SnapshotBadge';
import PartHeader from './PartHeader';

export default function PositionsTable() {
  const { selectedBridge, positions, setPositions, setHeaderKPI } = useAppContext();
  const { isLoading, updatePositions } = usePositions(selectedBridge);
  const { isLocked } = useSnapshots(selectedBridge);
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());

  // Group positions by part_name and sort each group (beton first, then others)
  const groupedPositions = useMemo(() => {
    const groups: Record<string, Position[]> = {};

    positions.forEach((pos) => {
      if (!groups[pos.part_name]) {
        groups[pos.part_name] = [];
      }
      groups[pos.part_name].push(pos);
    });

    // Sort each group: 'beton' first, then others
    Object.keys(groups).forEach((partName) => {
      groups[partName].sort((a, b) => {
        // 'beton' (Бетонирование) always first
        if (a.subtype === 'beton' && b.subtype !== 'beton') return -1;
        if (a.subtype !== 'beton' && b.subtype === 'beton') return 1;
        // Keep original order for others
        return 0;
      });
    });

    return groups;
  }, [positions]);

  // Handle concrete volume update from PartHeader
  const handleBetonQuantityUpdate = (partName: string, newQuantity: number) => {
    console.log(`📊 handleBetonQuantityUpdate called: part="${partName}", qty=${newQuantity}`);

    // Find the beton position for this part
    const betonPosition = positions.find(
      p => p.part_name === partName && p.subtype === 'beton'
    );

    if (!betonPosition) {
      console.error(
        `❌ No 'beton' position found for part "${partName}". Cannot update concrete volume.`
      );
      console.log(`Available parts: ${positions.map(p => `${p.part_name}/${p.subtype}`).join(', ')}`);
      return;
    }

    console.log(`✅ Found beton position: id=${betonPosition.id}, current qty=${betonPosition.qty}, new qty=${newQuantity}`);

    // IMPORTANT: Only send editable fields, NOT calculated fields!
    // Backend will recalculate: labor_hours, cost_czk, unit_cost_on_m3, kros_total_czk, etc.
    const updates = [{
      id: betonPosition.id,
      qty: newQuantity
      // Do NOT include: labor_hours, cost_czk, unit_cost_native, concrete_m3,
      //                 unit_cost_on_m3, kros_unit_czk, kros_total_czk, has_rfi, rfi_message
      // These are calculated by backend in calculatePositionFields()
    }];

    console.log(`📤 Calling updatePositions with:`, updates);
    updatePositions(updates);
  };

  // Handle item name update from PartHeader
  const handleItemNameUpdate = (partName: string, newItemName: string) => {
    console.log(`📝 handleItemNameUpdate called: part="${partName}", newName="${newItemName}"`);

    // Update item_name for all positions in this part
    const partPositions = positions.filter(p => p.part_name === partName);

    if (partPositions.length === 0) return;

    // IMPORTANT: Only send editable fields!
    const updates = partPositions.map(pos => ({
      id: pos.id,
      item_name: newItemName
      // Do NOT include calculated fields
    }));

    console.log(`📤 Calling updatePositions with ${updates.length} updates:`, updates);
    updatePositions(updates);
  };

  const togglePart = (partName: string) => {
    const newExpanded = new Set(expandedParts);
    if (newExpanded.has(partName)) {
      newExpanded.delete(partName);
    } else {
      newExpanded.add(partName);
    }
    setExpandedParts(newExpanded);
  };

  // Handle adding new row to a part
  const handleAddRow = async (partName: string) => {
    if (!selectedBridge) return;

    try {
      // Create new position with default values
      const newPosition: Partial<Position> = {
        id: uuidv4(),
        bridge_id: selectedBridge,
        part_name: partName,
        item_name: '',
        subtype: 'jiné', // Default subtype: "Other"
        unit: 'ks',
        qty: 1,
        crew_size: 4,
        wage_czk_ph: 398,
        shift_hours: 10,
        days: 0
      };

      console.log(`➕ Adding new row to part "${partName}":`, newPosition);

      // Create position via API
      const result = await positionsAPI.create(selectedBridge, [newPosition as Position]);
      console.log(`✅ New row added:`, result);

      // Update context with new positions
      if (result.positions) {
        setPositions(result.positions);
        if (result.header_kpi) {
          setHeaderKPI(result.header_kpi);
        }
      }
    } catch (error) {
      console.error(`❌ Error adding row:`, error);
      alert(`Chyba při přidávání řádku: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
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

  // If no positions exist, show empty table with ability to add rows
  const hasPositions = positions.length > 0;
  const displayGroups = hasPositions ? groupedPositions : { 'NOVÁ ČÁST': [] };

  return (
    <div className="positions-container">
      <SnapshotBadge />

      {!hasPositions && (
        <div className="empty-positions-container">
          <p className="empty-positions-message">
            📝 Žádné pozice. Vytvořte první řádek kliknutím na "➕ Přidat řádek" níže.
          </p>
        </div>
      )}

      {Object.entries(displayGroups).map(([partName, partPositions]) => {
        const isExpanded = expandedParts.has(partName);

        return (
          <div key={partName} className="part-card">
            <div className="part-header" onClick={() => togglePart(partName)}>
              <span>{partName}</span>
              <span>{isExpanded ? '▼' : '▶'} {partPositions.length} pozic</span>
            </div>

            {isExpanded && (
              <>
                <PartHeader
                  itemName={partPositions[0]?.item_name || ''}
                  betonQuantity={partPositions
                    .filter(p => p.subtype === 'beton')
                    .reduce((sum, p) => sum + (p.qty || 0), 0)}
                  onItemNameUpdate={(newName) =>
                    handleItemNameUpdate(partName, newName)
                  }
                  onBetonQuantityUpdate={(newQuantity) =>
                    handleBetonQuantityUpdate(partName, newQuantity)
                  }
                  isLocked={isLocked}
                />

                {/* Unified Table Wrapper - Synchronized header and body widths */}
                <div className="table-wrapper">
                  {/* Header Table - Sticky with synchronized width */}
                  <table className="positions-table">
                    <thead>
                    <tr>
                      {isLocked && <th className="lock-col" title="Snapshot je zamčen">🔒</th>}
                      <th className="col-podtyp" title="Typ práce: beton, bednění, výztuž, oboustranné, jiné">Práce</th>
                      <th className="col-mj" title="Měrná jednotka: m³, m², kg">MJ</th>
                      <th className="col-mnozstvi" title="Množství v měrných jednotkách (EDITABLE)">Množ.</th>
                      <th className="col-lidi" title="Počet lidí v partě (EDITABLE)">Počet</th>
                      <th className="col-cena-hod" title="Hodinová sazba v CZK (EDITABLE)">Kč/h</th>
                      <th className="col-hod-den" title="Hodin za směnu (EDITABLE)">Hod./den</th>
                      <th className="col-den" title="Počet dní - koeficient 1 (EDITABLE)">Dny</th>
                      <th className="col-hod-celkem" title="Celkový počet hodin = Počet × Hod./den × Dny">Celk.hod.</th>
                      <th className="col-kc-celkem" title="Celková cena v CZK = Celk.hod. × Kč/h">Celk.Kč</th>
                      <th className="col-kc-m3" title="⭐ KLÍČOVÁ METRIKA: Jednotková cena Kč/m³ betonu = Celk.Kč ÷ Objem betonu">
                        Kč/m³ ⭐
                      </th>
                      <th className="col-kros-jc" title="KROS jednotková cena = zaokrouhleno nahoru na nejbližších 50 CZK">KROS j.</th>
                      <th className="col-kros-celkem" title="KROS celkem = KROS j. × Objem betonu">KROS Σ</th>
                      <th className="col-rfi" title="Request For Information - problémové položky">RFI</th>
                      <th className="col-akce" title="Akce se řádkem">Akce</th>
                    </tr>
                    </thead>
                    <tbody>
                      {partPositions.length > 0 ? (
                        partPositions.map((position) => (
                          <PositionRow key={position.id} position={position} isLocked={isLocked} />
                        ))
                      ) : (
                        <tr>
                          <td colSpan={isLocked ? 15 : 14} style={{
                            textAlign: 'center',
                            padding: '20px',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic'
                          }}>
                            Zatім žádné řádky. Klikněte na "➕ Přidat řádek" níže.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{
                  padding: '16px',
                  borderTop: '1px solid var(--border-light)',
                  background: 'var(--bg-tertiary)'
                }}>
                  <button
                    className="btn-create"
                    onClick={() => handleAddRow(partName)}
                    disabled={isLocked}
                    title={isLocked ? 'Nelze přidat řádek - snapshot je zamčen' : 'Přidat nový řádek'}
                  >
                    ➕ Přidat řádek
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
