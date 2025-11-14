/**
 * Header component - Modern UI with Dark mode toggle
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useBridges } from '../hooks/useBridges';
import { useExports } from '../hooks/useExports';
import { exportAPI, uploadAPI, bridgesAPI } from '../services/api';
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
  const { selectedBridge, setSelectedBridge, bridges } = useAppContext();
  const { user, logout } = useAuth();
  const { refetch: refetchBridges } = useBridges();
  const { saveXLSX, isSaving } = useExports();
  const navigate = useNavigate();
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

      alert(`✅ Import úspěšný! Nalezeno ${result.bridges.length} objektů s ${result.row_count} řádky.`);
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
          title="Vytvořit nový objekt s prázdnými pozicemi"
        >
          ➕ Nový objekt
        </button>

        <select
          className="bridge-selector"
          value={selectedBridge || ''}
          onChange={handleBridgeChange}
        >
          <option value="">Vyberte objekt...</option>
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
          title="Upravit název a metadata objektu"
        >
          ✏️ Upravit objekt
        </button>

        <button
          className="btn-secondary"
          onClick={handleUploadClick}
          disabled={isUploading}
          title={isUploading ? 'Načítání souboru...' : 'Nahrát Excel soubor s pozicemi objektů'}
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
          onClick={handleExport}
          disabled={!selectedBridge}
          title="Exportovat aktuální pozice do Excel souboru"
        >
          📥 Export XLSX
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

        <button
          className="btn-primary"
          onClick={() => navigate(`/projects/${selectedBridge}/upload-document`)}
          disabled={!selectedBridge}
          title="Nahrát a analyzovat dokument (PDF, Excel)"
        >
          📄 Upload Document
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user?.role === 'admin' && (
            <button
              className="btn-admin"
              onClick={() => navigate('/admin')}
              title="Admin Panel - správa uživatelů a audit logs"
            >
              👑 Admin Panel
            </button>
          )}

          <button
            className="btn-secondary"
            onClick={() => navigate('/dashboard')}
            title="Uživatelský profil a nastavení"
          >
            👤 Profil
          </button>

          <span style={{ fontSize: '14px', color: '#718096' }}>
            {user?.name || user?.email}
          </span>
          <button
            className="btn-danger"
            onClick={logout}
            title="Odhlásit se"
          >
            🚪 Odhlásit
          </button>
        </div>
      </div>

      {/* Modal for Create Monolith Form */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <CreateMonolithForm
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

        .btn-admin {
          padding: 8px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
        }

        .btn-admin:hover {
          background: linear-gradient(135deg, #5568d3 0%, #6b3f8f 100%);
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
          transform: translateY(-1px);
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
