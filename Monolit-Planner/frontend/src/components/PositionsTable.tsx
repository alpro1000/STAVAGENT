/**
 * PositionsTable - Main table with editable fields
 */

import { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { usePositions } from '../hooks/usePositions';
import { useSnapshots } from '../hooks/useSnapshots';
import { positionsAPI } from '../services/api';
import type { Position, Subtype, Unit } from '@stavagent/monolit-shared';
import { SUBTYPE_LABELS } from '@stavagent/monolit-shared';
import PositionRow from './PositionRow';
import SnapshotBadge from './SnapshotBadge';
import PartHeader from './PartHeader';
import WorkTypeSelector from './WorkTypeSelector';
import NewPartModal from './NewPartModal';
import CustomWorkModal from './CustomWorkModal';

export default function PositionsTable() {
  const { selectedBridge, positions, setPositions, setHeaderKPI, showOnlyRFI } = useAppContext();
  const { isLoading, updatePositions, deletePosition } = usePositions(selectedBridge);
  const { isLocked } = useSnapshots(selectedBridge);
  const queryClient = useQueryClient();
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
  const [showWorkSelector, setShowWorkSelector] = useState(false);
  const [selectedPartForAdd, setSelectedPartForAdd] = useState<string | null>(null);
  const [showNewPartModal, setShowNewPartModal] = useState(false);
  const [showCustomWorkModal, setShowCustomWorkModal] = useState(false);
  const [pendingCustomWork, setPendingCustomWork] = useState<{ subtype: Subtype; } | null>(null);

  // Resizable column state
  const [workColumnWidth, setWorkColumnWidth] = useState<number>(150); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);

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
    // Find the beton position for this part
    const betonPosition = positions.find(
      p => p.part_name === partName && p.subtype === 'beton'
    );

    if (!betonPosition) {
      return;
    }

    // IMPORTANT: Only send editable fields, NOT calculated fields!
    // Backend will recalculate: labor_hours, cost_czk, unit_cost_on_m3, kros_total_czk, etc.
    const updates = [{
      id: betonPosition.id,
      qty: newQuantity
      // Do NOT include: labor_hours, cost_czk, unit_cost_native, concrete_m3,
      //                 unit_cost_on_m3, kros_unit_czk, kros_total_czk, has_rfi, rfi_message
      // These are calculated by backend in calculatePositionFields()
    }];

    updatePositions(updates);
  };

  // Handle part name update from PartHeader
  // This updates the part_name field for ALL positions in this construction part
  const handlePartNameUpdate = (oldPartName: string, newPartName: string) => {
    // Update part_name for all positions in this part
    const partPositions = positions.filter(p => p.part_name === oldPartName);

    if (partPositions.length === 0) return;

    // IMPORTANT: Only send editable fields!
    const updates = partPositions.map(pos => ({
      id: pos.id,
      part_name: newPartName
    }));

    updatePositions(updates);
  };

  // Handle OTSKP code AND name update together (prevent race condition)
  const handleOtskpCodeAndNameUpdate = (partName: string, newOtskpCode: string, newPartName: string, _unitPrice?: number, _unit?: string) => {
    // Update BOTH otskp_code and part_name for all positions in this part
    // Note: unitPrice and unit are passed for UI display but not stored in database
    const partPositions = positions.filter(p => p.part_name === partName);

    if (partPositions.length === 0) return;

    // Send both updates in ONE API call to avoid race condition
    const updates = partPositions.map(pos => ({
      id: pos.id,
      otskp_code: newOtskpCode,
      part_name: newPartName
    }));

    updatePositions(updates);
  };

  // Handle deletion of entire part with all its positions
  const handleDeletePart = async (partName: string) => {
    if (!selectedBridge) return;
    if (isLocked) {
      alert('❌ Nelze smazat: Data jsou zafixována (snapshot aktivní)');
      return;
    }

    // Confirm deletion
    const partPositions = positions.filter(p => p.part_name === partName);
    const confirmed = window.confirm(
      `Opravdu smazat část "${partName}" se všemi ${partPositions.length} pozicemi?\n\nTuto akci nelze vrátit!`
    );
    if (!confirmed) return;

    try {
      // Delete all positions in this part (filter out positions without id)
      const positionsToDelete = partPositions.filter(p => p.id);
      if (positionsToDelete.length === 0) {
        alert('Chyba: Žádné pozice k smazání');
        return;
      }

      await Promise.all(
        positionsToDelete.map(position => positionsAPI.delete(position.id!))
      );
      setExpandedParts(prev => {
        const newSet = new Set(prev);
        newSet.delete(partName);
        return newSet;
      });

      // Invalidate and refetch positions
      queryClient.invalidateQueries({ queryKey: ['positions', selectedBridge] });
    } catch (error) {
      alert(`Chyba při mazání části: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
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

  // Resizable column handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = workColumnWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(80, Math.min(400, startWidth + deltaX)); // Min 80px, max 400px
      setWorkColumnWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle adding new row to a part - show work type selector first
  const handleAddRow = (partName: string) => {
    setSelectedPartForAdd(partName);
    setShowWorkSelector(true);
  };

  // Handle work type selection - create position with selected type
  const handleWorkTypeSelected = async (subtype: Subtype, unit: Unit) => {
    if (!selectedBridge || !selectedPartForAdd) return;

    setShowWorkSelector(false);

    // If custom work type ("jiné"), show modal for user input
    if (subtype === 'jiné') {
      setPendingCustomWork({ subtype });
      setShowCustomWorkModal(true);
      return;
    }

    try {
      // Get default name from subtype (e.g., "Betonování", "Bednění", "Výztuž")
      const defaultName = SUBTYPE_LABELS[subtype] || subtype;

      const newPosition: Partial<Position> = {
        id: uuidv4(),
        bridge_id: selectedBridge,
        part_name: selectedPartForAdd,
        item_name: defaultName,
        subtype: subtype,
        unit: unit,
        qty: 0,
        crew_size: 4,
        wage_czk_ph: 398,
        shift_hours: 10,
        days: 0
      };

      // Create position via API
      const result = await positionsAPI.create(selectedBridge, [newPosition as Position]);

      // Update context with new positions
      if (result.positions) {
        setPositions(result.positions);
        if (result.header_kpi) {
          setHeaderKPI(result.header_kpi);
        }
      }

      // 🔄 Invalidate React Query cache to ensure UI syncs immediately
      queryClient.invalidateQueries({ queryKey: ['positions', selectedBridge, showOnlyRFI] });

      setSelectedPartForAdd(null);
    } catch (error) {
      alert(`Chyba při přidávání řádku: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setSelectedPartForAdd(null);
    }
  };

  // Handle custom work modal submission
  const handleCustomWorkSubmit = async (itemName: string, unit: Unit) => {
    if (!selectedBridge || !selectedPartForAdd || !pendingCustomWork) return;

    try {
      setShowCustomWorkModal(false);

      const newPosition: Partial<Position> = {
        id: uuidv4(),
        bridge_id: selectedBridge,
        part_name: selectedPartForAdd,
        item_name: itemName,
        subtype: pendingCustomWork.subtype,
        unit: unit,
        qty: 0,
        crew_size: 4,
        wage_czk_ph: 398,
        shift_hours: 10,
        days: 0
      };

      // Create position via API
      const result = await positionsAPI.create(selectedBridge, [newPosition as Position]);

      // Update context with new positions
      if (result.positions) {
        setPositions(result.positions);
        if (result.header_kpi) {
          setHeaderKPI(result.header_kpi);
        }
      }

      // 🔄 Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ['positions', selectedBridge, showOnlyRFI] });

      setSelectedPartForAdd(null);
      setPendingCustomWork(null);
    } catch (error) {
      alert(`Chyba při přidávání práce: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setSelectedPartForAdd(null);
      setPendingCustomWork(null);
    }
  };

  // Handle work type selector cancel
  const handleWorkTypeCancelled = () => {
    setShowWorkSelector(false);
    setSelectedPartForAdd(null);
  };

  // Handle custom work modal cancel
  const handleCustomWorkCancelled = () => {
    setShowCustomWorkModal(false);
    setSelectedPartForAdd(null);
    setPendingCustomWork(null);
  };

  // Handle new part creation from OTSKP search
  const handleNewPartSelected = async (otskpCode: string, partName: string) => {
    if (!selectedBridge) return;

    try {
      setShowNewPartModal(false);

      // Create first position (beton) for the new part
      const newPosition: Partial<Position> = {
        id: uuidv4(),
        bridge_id: selectedBridge,
        part_name: partName,
        item_name: SUBTYPE_LABELS['beton'] || 'Betonování', // Use subtype name, not part name
        otskp_code: otskpCode,
        subtype: 'beton', // First position is always beton (concrete volume)
        unit: 'M3',
        qty: 0,
        crew_size: 4,
        wage_czk_ph: 398,
        shift_hours: 10,
        days: 0
      };

      // Create position via API
      const result = await positionsAPI.create(selectedBridge, [newPosition as Position]);

      // Update context with new positions
      if (result.positions) {
        setPositions(result.positions);
        if (result.header_kpi) {
          setHeaderKPI(result.header_kpi);
        }
      }

      // 🔄 Invalidate React Query cache to ensure UI syncs immediately
      queryClient.invalidateQueries({ queryKey: ['positions', selectedBridge, showOnlyRFI] });
    } catch (error) {
      alert(`Chyba při vytváření části: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  };

  // Handle new part modal cancel
  const handleNewPartCancelled = () => {
    setShowNewPartModal(false);
  };

  // Expand all by default
  useEffect(() => {
    const allParts = Object.keys(groupedPositions);
    setExpandedParts(new Set(allParts));
  }, [groupedPositions]);

  if (!selectedBridge) {
    return (
      <div className="c-panel u-flex-center" style={{ flexDirection: 'column', gap: 'var(--space-lg)', padding: 'var(--space-2xl)', minHeight: '300px' }}>
        <div style={{ fontSize: '64px', opacity: 0.5 }}>🏗️</div>
        <h3 className="u-text-bold" style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>Vyberte objekt</h3>
        <p className="u-text-muted">Vyberte objekt ze seznamu vlevo nebo nahrajte XLSX soubor</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="c-panel u-flex-center" style={{ flexDirection: 'column', gap: 'var(--space-md)', padding: 'var(--space-2xl)', minHeight: '300px' }}>
        <div className="spinner"></div>
        <p className="u-text-muted">Načítání pozic...</p>
      </div>
    );
  }

  // If no positions exist, show empty table with ability to add rows
  const hasPositions = positions.length > 0;
  const displayGroups = hasPositions ? groupedPositions : { 'NOVÁ ČÁST': [] };

  return (
    <div className="positions-container">
      <SnapshotBadge />

      {/* Add New Part Button */}
      <div className="c-panel--inset u-p-md u-mb-md" style={{ borderRadius: 'var(--radius-md)' }}>
        <button
          className="c-btn"
          onClick={() => setShowNewPartModal(true)}
          disabled={isLocked}
          title={isLocked ? 'Nelze přidat část - snapshot je zamčen' : 'Přidat novou část konstrukce s OTSKP kódem'}
          style={{
            background: 'var(--accent-orange, #FF9F1C)',
            color: '#1a1a1a',
            fontWeight: 600,
            border: 'none'
          }}
        >
          🏗️ Přidat část konstrukce
        </button>
      </div>

      {!hasPositions && (
        <div className="empty-positions-container">
          <p className="empty-positions-message">
            📝 Žádné pozice. Vytvořte první část konstrukce kliknutím na "🏗️ Přidat část konstrukce" výše.
          </p>
        </div>
      )}

      {Object.entries(displayGroups)
        .map(([partName, partPositions]) => {
        const isExpanded = expandedParts.has(partName);

        return (
          <div key={partName} className="c-panel u-mb-md" style={{ padding: 0 }}>
            <div
              className="u-flex-between u-p-md"
              onClick={() => togglePart(partName)}
              style={{ cursor: 'pointer', background: 'var(--data-surface-alt)' }}
            >
              <span className="u-text-bold">{partPositions[0]?.item_name || partName}</span>
              <div className="u-flex u-gap-md" style={{ alignItems: 'center' }}>
                <span className="u-text-muted">{isExpanded ? '▼' : '▶'} {partPositions.length} pozic</span>
                {!isLocked && (
                  <button
                    className="c-btn c-btn--sm c-btn--danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePart(partName);
                    }}
                    title={`Smazat část "${partName}" (${partPositions.length} pozic)`}
                  >
                    🗑️ Smazat
                  </button>
                )}
              </div>
            </div>

            {isExpanded && (
              <>
                <PartHeader
                  partName={partPositions[0]?.part_name || ''}
                  betonQuantity={partPositions
                    .filter(p => p.subtype === 'beton')
                    .reduce((sum, p) => sum + (p.qty || 0), 0)}
                  otskpCode={partPositions[0]?.otskp_code || ''}
                  partTotalKrosCzk={partPositions.reduce((sum, p) => sum + (p.kros_total_czk || 0), 0)}
                  onPartNameUpdate={(newName) =>
                    handlePartNameUpdate(partName, newName)
                  }
                  onBetonQuantityUpdate={(newQuantity) =>
                    handleBetonQuantityUpdate(partName, newQuantity)
                  }
                  onOtskpCodeAndNameUpdate={(code, name, unitPrice, unit) =>
                    handleOtskpCodeAndNameUpdate(partName, code, name, unitPrice, unit)
                  }
                  isLocked={isLocked}
                />

                {/* Unified Table Wrapper - Synchronized header and body widths */}
                <div
                  className="c-table-wrapper"
                  style={{
                    margin: 'var(--space-md)',
                    borderRadius: 'var(--radius-md)',
                    '--work-column-width': `${workColumnWidth}px`
                  } as React.CSSProperties}
                >
                  {/* Header Table - Sticky with synchronized width */}
                  <table className="c-table positions-table">
                    <thead>
                    <tr>
                      {isLocked && <th className="lock-col" title="Snapshot je zamčen">🔒</th>}
                      <th
                        className="col-podtyp"
                        title="Typ práce: beton, bednění, výztuž, oboustranné, jiné"
                        style={{
                          width: `${workColumnWidth}px`,
                          minWidth: `${workColumnWidth}px`,
                          maxWidth: `${workColumnWidth}px`,
                          position: 'relative'
                        }}
                      >
                        Práce
                        <div
                          className="column-resizer"
                          onMouseDown={handleResizeStart}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '4px',
                            cursor: 'col-resize',
                            background: isResizing ? 'var(--accent-orange, #FF9F1C)' : 'transparent',
                            transition: 'background 0.2s ease',
                            zIndex: 10
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-hover, #ccc)'}
                          onMouseLeave={(e) => {
                            if (!isResizing) e.currentTarget.style.background = 'transparent';
                          }}
                        />
                      </th>
                      <th className="col-mj" title="Měrná jednotka: m³, m², kg">MJ</th>
                      <th className="col-mnozstvi" title="Množství v měrných jednotkách (EDITABLE)">Množ.</th>
                      <th className="col-lidi" title="Počet lidí v partě (EDITABLE)">Počet</th>
                      <th className="col-cena-hod" title="Hodinová sazba v CZK (EDITABLE)">Kč/h</th>
                      <th className="col-hod-den" title="Hodin za směnu (EDITABLE)">Hod./den</th>
                      <th className="col-den" title="Počet dní - koeficient 1 (EDITABLE)">Dny</th>
                      <th className="col-rychlost" title="Norma rychlosti v MJ/hod (EDITABLE). Zadejte normu → přepočítá dny. Nebo zadejte dny → norma se vypočítá zpětně.">MJ/h</th>
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
                          <td colSpan={isLocked ? 16 : 15} style={{
                            textAlign: 'center',
                            padding: '20px',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic'
                          }}>
                            Zatím žádné řádky. Klikněte na „➕ Přidat řádek" níže.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="u-p-md" style={{ background: 'var(--panel-inset)' }}>
                  <button
                    className="c-btn c-btn--primary c-btn--sm"
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

      {/* Work Type Selector Modal */}
      {showWorkSelector && selectedPartForAdd && (
        <WorkTypeSelector
          onSelect={handleWorkTypeSelected}
          onCancel={handleWorkTypeCancelled}
        />
      )}

      {/* New Part Modal */}
      {showNewPartModal && (
        <NewPartModal
          onSelect={handleNewPartSelected}
          onCancel={handleNewPartCancelled}
        />
      )}

      {/* Custom Work Modal */}
      {showCustomWorkModal && (
        <CustomWorkModal
          onSelect={handleCustomWorkSubmit}
          onCancel={handleCustomWorkCancelled}
        />
      )}
    </div>
  );
}
