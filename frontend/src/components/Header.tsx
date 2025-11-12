/**
 * Header component - Modern UI with Dark mode toggle
 */

import { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useBridges } from '../hooks/useBridges';
import { useExports } from '../hooks/useExports';
import { exportAPI, uploadAPI, bridgesAPI } from '../services/api';
import CreateBridgeForm from './CreateBridgeForm';
import EditBridgeForm from './EditBridgeForm';
import ExportHistory from './ExportHistory';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ isDark, toggleTheme }: HeaderProps) {
  const { selectedBridge, setSelectedBridge, bridges } = useAppContext();
  const { refetch: refetchBridges } = useBridges();
  const { saveXLSX, isSaving } = useExports();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showExportHistory, setShowExportHistory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

      // Refetch bridges after upload
      await refetchBridges();

      alert(`✅ Import úspěšný! Nalezeno ${result.bridges.length} mostů s ${result.row_count} řádky.`);
    } catch (error: any) {
      alert(`❌ Nahrání selhalo: ${error.message}`);
    } finally {
      setIsUploading(false);
    }

    // Reset input
    e.target.value = '';
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!selectedBridge) {
      alert('Nejdříve vyberte most');
      return;
    }

    try {
      const blob = format === 'xlsx'
        ? await exportAPI.exportXLSX(selectedBridge)
        : await exportAPI.exportCSV(selectedBridge);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monolit_${selectedBridge}_${Date.now()}.${format}`;
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
      alert('Nejdříve vyberte most');
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
    alert('✅ Most byl úspěšně aktualizován!');
  };

  const handleLogoClick = () => {
    // Refresh page to reset state
    window.location.reload();
  };

  return (
    <header className="header">
      <div
        className="header-logo"
        onClick={handleLogoClick}
        style={{ cursor: 'pointer' }}
        title="Obnovit aplikaci (F5)"
      >
        <span className="header-icon">🏗️</span>
        <h1>Monolit Planner</h1>
      </div>

      <div className="header-controls">
        <button
          className="btn-theme-toggle"
          onClick={toggleTheme}
          title={isDark ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>

        <button
          className="btn-create"
          onClick={() => setShowCreateForm(true)}
          title="Vytvořit nový most s prázdnými pozicemi"
        >
          ➕ Nový most
        </button>

        <select
          className="bridge-selector"
          value={selectedBridge || ''}
          onChange={handleBridgeChange}
        >
          <option value="">Vyberte most...</option>
          {bridges.map((bridge) => (
            <option key={bridge.bridge_id} value={bridge.bridge_id}>
              {bridge.object_name || bridge.bridge_id} - {bridge.bridge_id} ({bridge.element_count} prvků)
            </option>
          ))}
        </select>

        <button
          className="btn-secondary"
          onClick={() => setShowEditForm(true)}
          disabled={!selectedBridge}
          title="Upravit název a metadata mostu"
        >
          ✏️ Upravit most
        </button>

        <button
          className="btn-danger"
          onClick={async () => {
            if (!selectedBridge) return;
            const bridge = bridges.find(b => b.bridge_id === selectedBridge);
            const bridgeName = bridge?.object_name || selectedBridge;
            if (window.confirm(`❌ Opravdu chcete smazat most "${bridgeName}"?\n\nTato akce je nevratná! Budou smazány všechny pozice, snapshoty a data.`)) {
              try {
                await bridgesAPI.delete(selectedBridge);
                setSelectedBridge(null);
                await refetchBridges();
                alert('✅ Most byl úspěšně smazán');
              } catch (err: any) {
                alert(`❌ Chyba při mazání: ${err.message}`);
              }
            }
          }}
          disabled={!selectedBridge}
          title="Smazat most (nevratné!)"
        >
          🗑️ Smazat most
        </button>

        <button
          className="btn-secondary"
          onClick={handleUploadClick}
          disabled={isUploading}
          title={isUploading ? 'Načítání souboru...' : 'Nahrát Excel soubor s pozicemi mostů'}
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
          className="btn-success"
          onClick={() => handleExport('xlsx')}
          disabled={!selectedBridge}
          title="Exportovat aktuální pozice do Excel souboru"
        >
          📥 Export XLSX
        </button>

        <button
          className="btn-secondary"
          onClick={() => handleExport('csv')}
          disabled={!selectedBridge}
          title="Exportovat aktuální pozice do CSV souboru"
        >
          📥 Export CSV
        </button>

        <button
          className="btn-success"
          onClick={handleSaveToServer}
          disabled={!selectedBridge || isSaving}
          title="Uložit export na server"
        >
          💾 {isSaving ? 'Ukládám...' : 'Uložit na server'}
        </button>

        <button
          className="btn-secondary"
          onClick={() => setShowExportHistory(true)}
          title="Zobrazit historii exportů"
        >
          📋 Historie exportů
        </button>
      </div>

      {/* Modal for Create Bridge Form */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <CreateBridgeForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}

      {/* Modal for Export History */}
      {showExportHistory && (
        <div className="modal-overlay" onClick={() => setShowExportHistory(false)}>
          <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
            <ExportHistory onClose={() => setShowExportHistory(false)} />
          </div>
        </div>
      )}

      {/* Modal for Edit Bridge Form */}
      {showEditForm && selectedBridge && (
        <div className="modal-overlay" onClick={() => setShowEditForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
      `}</style>
    </header>
  );
}
