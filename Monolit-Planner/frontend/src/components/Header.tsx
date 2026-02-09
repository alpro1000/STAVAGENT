/**
 * Header component - Modern UI with Dark mode toggle
 */

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { useBridges } from '../hooks/useBridges';
import { useExports } from '../hooks/useExports';
import { exportAPI, uploadAPI, positionsAPI } from '../services/api';
import CreateMonolithForm from './CreateMonolithForm';
import EditBridgeForm from './EditBridgeForm';
import ExportHistory from './ExportHistory';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ isDark, toggleTheme }: HeaderProps) {
  const { selectedBridge, setSelectedBridge, bridges, setBridges } = useAppContext();
  const { refetch: refetchBridges } = useBridges();
  const { saveXLSX, isSaving } = useExports();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showExportHistory, setShowExportHistory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExportingToRegistry, setIsExportingToRegistry] = useState(false);

  const handleBridgeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBridge(e.target.value || null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadAPI.uploadXLSX(file);

      if (import.meta.env.DEV) console.log('[Upload] Response:', result);

      // Calculate total positions from all imported bridges
      const totalPositions = result.bridges?.reduce((sum: number, b: any) => sum + (b.positions_count || 0), 0) || 0;

      // ✅ FIX: Immediately update bridges from upload response
      // This avoids waiting for refetch which might timeout
      if (result.bridges?.length > 0) {
        // Convert upload response to Bridge format and merge with existing
        const importedBridges = result.bridges.map((b: any) => ({
          bridge_id: b.bridge_id,
          project_name: b.project_name || result.project_name || 'Import',
          object_name: b.object_name || b.bridge_id,
          element_count: b.positions_count || 0,
          concrete_m3: b.concrete_m3 || 0,
          sum_kros_czk: 0,
          status: 'active' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        // Merge with existing bridges (avoid duplicates)
        const existingIds = new Set(bridges.map(b => b.bridge_id));
        const newBridges = importedBridges.filter((b: any) => !existingIds.has(b.bridge_id));

        if (newBridges.length > 0) {
          // Update context immediately with new bridges
          const updatedBridges = [...bridges, ...newBridges];

          // ✅ FIX: Update BOTH context AND query cache
          // Context update triggers immediate sidebar re-render
          setBridges(updatedBridges);
          // Query cache update ensures consistency with React Query
          queryClient.setQueryData(['bridges'], updatedBridges);

          if (import.meta.env.DEV) console.log('[Upload] Added', newBridges.length, 'new bridges to sidebar');
        }

        // Auto-select the first imported bridge
        setSelectedBridge(result.bridges[0].bridge_id);
      }

      // Invalidate positions cache
      queryClient.invalidateQueries({ queryKey: ['positions'] });

      // ✅ FIX: DON'T do automatic refetch after import!
      // Data is already in context from upload response.
      // Refetch was causing race condition: if database hadn't committed yet,
      // refetch would return old data and overwrite the new bridges.
      // User can refresh page manually if needed.
      if (import.meta.env.DEV) console.log('[Upload] Skipping refetch - data already in context');

      alert(`✅ Import úspěšný! Nalezeno ${result.bridges?.length || 0} objektů s ${totalPositions} pozicemi.`);
    } catch (error: any) {
      alert(`❌ Nahrání selhalo: ${error.message}`);
    } finally {
      setIsUploading(false);
    }

    // Reset input
    e.target.value = '';
  };

  const handleExport = async () => {
    if (!selectedBridge) {
      alert('Nejdříve vyberte objekt');
      return;
    }

    try {
      const blob = await exportAPI.exportXLSX(selectedBridge);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monolit_${selectedBridge}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Chyba při exportu: ${error.message}`);
    }
  };

  const handleSaveToServer = async () => {
    if (!selectedBridge) {
      alert('Nejdříve vyberte objekt');
      return;
    }

    try {
      saveXLSX(selectedBridge, {
        onSuccess: (data: any) => {
          alert(`✅ Export uložen na server!\nSoubor: ${data.filename}\nVelikost: ${data.size} KB`);
        },
        onError: (error: any) => {
          alert(`❌ Chyba při ukládání: ${error.message}`);
        }
      });
    } catch (error: any) {
      alert(`Chyba při ukládání: ${error.message}`);
    }
  };

  const handleExportToRegistry = async () => {
    if (!selectedBridge) {
      alert('Nejdříve vyberte objekt');
      return;
    }

    setIsExportingToRegistry(true);
    try {
      // Fetch positions for the selected bridge
      const result = await positionsAPI.getForBridge(selectedBridge);
      const positions = result.positions;

      // Map positions to unified format
      const unifiedPositions = positions.map((pos: any) => ({
        id: pos.id || crypto.randomUUID(),
        portalProjectId: '', // Will be set by Registry
        sourceKiosk: 'monolit',
        sourceItemId: pos.id,
        code: pos.otskp_code || null,
        description: pos.item_name || '',
        quantity: pos.qty || null,
        unit: pos.unit || null,
        unitPrice: pos.unit_cost_native || null,
        totalPrice: pos.kros_total_czk || null,
        category: pos.subtype || null,
        rowRole: 'main',
        confidence: null,
        matchSource: 'monolit',
        source: {
          fileName: selectedBridge,
          importedAt: new Date().toISOString(),
        },
      }));

      // Export to Registry sync API
      const response = await fetch('https://stavagent-backend-ktwx.vercel.app/api/sync?action=import-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalProjectId: crypto.randomUUID(), // Generate new or use existing
          positions: unifiedPositions,
          source: 'monolit',
          mergeStrategy: 'append',
        }),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const exportResult = await response.json();
      alert(`✅ Export do Registry úspěšný!\nExportováno: ${exportResult.imported || positions.length} pozic`);

    } catch (error: any) {
      console.error('[Export to Registry] Error:', error);
      alert(`❌ Export do Registry selhal: ${error.message}`);
    } finally {
      setIsExportingToRegistry(false);
    }
  };

  const handleCreateSuccess = async (bridge_id: string) => {
    setShowCreateForm(false);

    try {
      // Refetch bridges list to update sidebar
      const result = await refetchBridges();

      // Set selected bridge AFTER refetch completes
      // This ensures the new bridge appears in the sidebar before being selected
      if (result.isSuccess || result.data) {
        setSelectedBridge(bridge_id);
      } else {
        setSelectedBridge(bridge_id);
      }
    } catch (error) {
      // Still set selected bridge even if refetch fails
      setSelectedBridge(bridge_id);
    }
  };

  const handleEditSuccess = async () => {
    setShowEditForm(false);
    // Refetch bridges to update the name in the selector
    await refetchBridges();
    alert('✅ Objekt byl úspěšně aktualizován!');
  };

  const handleLogoClick = () => {
    // Refresh page to reset state
    window.location.reload();
  };

  return (
    <header className="c-header">
      <div className="c-container u-flex-between" style={{ maxWidth: 'none', width: '100%' }}>
        <div
          className="u-flex u-gap-md"
          onClick={handleLogoClick}
          style={{ cursor: 'pointer', alignItems: 'center' }}
          title="Obnovit aplikaci (F5)"
        >
          <span style={{ fontSize: '28px' }}>🏗️</span>
          <h1 className="c-header__title" style={{ fontSize: '20px' }}>Monolit Planner</h1>
        </div>

        <div className="u-flex u-gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          <button
            className="c-btn"
            onClick={toggleTheme}
            title={isDark ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
            style={{ minWidth: '36px', padding: '6px' }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          <button
            className="c-btn c-btn--primary"
            onClick={() => setShowCreateForm(true)}
            title="Vytvořit nový objekt s prázdnými pozicemi"
            style={{ padding: '6px 10px' }}
          >
            ➕ Nový objekt
          </button>

          <select
            className="c-select"
            value={selectedBridge || ''}
            onChange={handleBridgeChange}
            style={{ minWidth: '150px', maxWidth: '250px', fontSize: '14px' }}
          >
            <option value="">Vyberte objekt...</option>
            {bridges.map((bridge) => (
              <option key={bridge.bridge_id} value={bridge.bridge_id}>
                {bridge.object_name || bridge.bridge_id} - {bridge.bridge_id} ({bridge.element_count} prvků)
              </option>
            ))}
          </select>

          <button
            className="c-btn"
            onClick={() => setShowEditForm(true)}
            disabled={!selectedBridge}
            title="Upravit název a metadata objektu"
            style={{ padding: '6px 8px' }}
          >
            ✏️ Upravit
          </button>

          <button
            className="c-btn"
            onClick={handleUploadClick}
            disabled={isUploading}
            title={isUploading ? 'Načítání souboru...' : 'Nahrát Excel soubor s pozicemi objektů'}
            style={{ padding: '6px 10px' }}
          >
            {isUploading ? (
              <>
                <span className="upload-spinner"></span>
                Načítání...
              </>
            ) : (
              <>💾 Nahrát XLSX</>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          <button
            className="c-btn c-btn--success"
            onClick={handleExport}
            disabled={!selectedBridge}
            title="Exportovat aktuální pozice do Excel souboru"
            style={{ padding: '6px 8px' }}
          >
            📥 Export XLSX
          </button>

          <button
            className="c-btn"
            onClick={handleExportToRegistry}
            disabled={!selectedBridge || isExportingToRegistry}
            title="Exportovat pozice do Rozpočet Registry"
            style={{ padding: '6px 8px', background: 'var(--color-info, #3b82f6)' }}
          >
            {isExportingToRegistry ? '⏳ Exportuji...' : '📤 → Registry'}
          </button>

          <button
            className="c-btn c-btn--success"
            onClick={handleSaveToServer}
            disabled={!selectedBridge || isSaving}
            title="Uložit export na server"
            style={{ padding: '6px 10px' }}
          >
            💾 {isSaving ? 'Ukládám...' : 'Uložit'}
          </button>

          <button
            className="c-btn"
            onClick={() => setShowExportHistory(true)}
            title="Zobrazit historii exportů"
            style={{ padding: '6px 8px' }}
          >
            📋 Historie
          </button>

        </div>
      </div>

      {/* Modal for Create Monolith Form */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setShowCreateForm(false)}
              title="Zavřít"
            >
              ✕
            </button>
            <CreateMonolithForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}

      {/* Modal for Export History */}
      {showExportHistory && (
        <div className="modal-overlay">
          <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setShowExportHistory(false)}
              title="Zavřít"
            >
              ✕
            </button>
            <ExportHistory onClose={() => setShowExportHistory(false)} />
          </div>
        </div>
      )}

      {/* Modal for Edit Bridge Form */}
      {showEditForm && selectedBridge && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setShowEditForm(false)}
              title="Zavřít"
            >
              ✕
            </button>
            <EditBridgeForm
              bridge={bridges.find(b => b.bridge_id === selectedBridge)!}
              onSuccess={handleEditSuccess}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        </div>
      )}

      <style>{`
        .upload-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-right-color: rgba(255, 255, 255, 0.6);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-right: 6px;
          vertical-align: middle;
          position: relative;
          z-index: 10000;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        /* Modal close button (X) */
        .modal-close-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border: none;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close-btn:hover {
          background: var(--color-error);
          color: white;
          transform: scale(1.1);
        }

        .modal-close-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </header>
  );
}
