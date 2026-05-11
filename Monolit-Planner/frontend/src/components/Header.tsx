/**
 * Header component - Modern UI with Dark mode toggle
 */

import { useState, useRef } from 'react';
import { Building2, Sun, Moon, PlusCircle, Pencil, Save, Download, Upload, ClipboardList, X, Loader2, Menu } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { useBridges } from '../hooks/useBridges';
import { useExports } from '../hooks/useExports';
import { exportAPI, uploadAPI, API_URL } from '../services/api';
import CreateMonolithForm from './CreateMonolithForm';
import EditBridgeForm from './EditBridgeForm';
import ExportHistory from './ExportHistory';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ isDark, toggleTheme, sidebarOpen, setSidebarOpen }: HeaderProps) {
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
  const [isImportingFromRegistry, setIsImportingFromRegistry] = useState(false);
  const [showRegistryImport, setShowRegistryImport] = useState(false);
  const [registryProjects, setRegistryProjects] = useState<any[]>([]);
  const [selectedRegistryProject, setSelectedRegistryProject] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);

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

      // ✅ FIX: Force refetch to update sidebar
      // Simple and reliable - let React Query handle the update
      await refetchBridges();

      // Auto-select the first imported bridge
      if (result.bridges?.length > 0) {
        setSelectedBridge(result.bridges[0].bridge_id);
      }

      // Invalidate positions cache
      queryClient.invalidateQueries({ queryKey: ['positions'] });

      alert(
        `✅ Import úspěšný!\n\n` +
        `Objektů: ${result.bridges?.length || 0}\n` +
        `Pozic: ${totalPositions}\n\n` +
        `Objekty jsou nyní viditelné v levém panelu.`
      );
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
      if (error.response?.status === 404) {
        alert('Objekt nemá žádné pozice. Přidejte pozice před exportem.');
      } else {
        alert(`Chyba při exportu: ${error.message}`);
      }
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
      // Call backend endpoint which handles all the export logic
      const response = await fetch(`${API_URL}/api/export-to-registry/${selectedBridge}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const text = await response.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* non-JSON body */ }

      if (!response.ok) {
        throw new Error(parsed?.error || `Export failed (${response.status})`);
      }

      const result = parsed;

      // Open Registry in new tab
      window.open(result.registry_url, '_blank');

      alert(`✅ Export do Registry úspěšný!\n${result.positions_count} pozic s TOV daty a cenami`);

    } catch (error: any) {
      console.error('[Export to Registry] Error:', error);
      alert(`❌ Export do Registry selhal: ${error.message}`);
    } finally {
      setIsExportingToRegistry(false);
    }
  };

  const handleToggleRegistryImport = async () => {
    if (showRegistryImport) {
      setShowRegistryImport(false);
      return;
    }
    setShowRegistryImport(true);
    setLoadingProjects(true);
    try {
      const data = await uploadAPI.getRegistryProjects();
      setRegistryProjects(data.projects || []);
    } catch { setRegistryProjects([]); }
    finally { setLoadingProjects(false); }
  };

  const handleImportFromRegistry = async () => {
    if (!selectedRegistryProject) {
      alert('Vyberte projekt z Rozpočtu');
      return;
    }

    setIsImportingFromRegistry(true);
    try {
      const proj = registryProjects.find(p => p.portal_project_id === selectedRegistryProject);
      const result = await uploadAPI.importFromRegistry(selectedRegistryProject, proj?.project_name);

      await refetchBridges();
      if (result.bridges?.length > 0) {
        setSelectedBridge(result.bridges[0].bridge_id);
      }
      queryClient.invalidateQueries({ queryKey: ['positions'] });

      setShowRegistryImport(false);
      setSelectedRegistryProject('');
      alert(`Import z Rozpočtu úspěšný!\n\nObjektů: ${result.bridges?.length || 0}\nPozic: ${result.total_positions || 0}`);
    } catch (error: any) {
      alert(`Import z Rozpočtu selhal: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsImportingFromRegistry(false);
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
          <Building2 size={24} />
          <h1 className="c-header__title" style={{ fontSize: '20px' }}>Kalkulátor betonáže</h1>
        </div>

        <div className="u-flex u-gap-sm header-controls" style={{ flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          {/* Hamburger menu for mobile sidebar toggle */}
          <button
            className="c-btn header-hamburger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Zavřít panel' : 'Otevřít panel'}
            style={{ minWidth: '36px', padding: '6px', fontSize: '20px', lineHeight: 1 }}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <button
            className="c-btn header-btn-desktop"
            onClick={toggleTheme}
            title={isDark ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
            style={{ minWidth: '36px', padding: '6px' }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            className="c-btn c-btn--primary"
            onClick={() => setShowCreateForm(true)}
            title="Vytvořit nový objekt s prázdnými pozicemi"
            style={{ padding: '6px 10px' }}
          >
            <PlusCircle size={14} className="inline" /> Nový objekt
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
            <Pencil size={14} className="inline" /> Upravit
          </button>

          <button
            className="c-btn"
            onClick={handleToggleRegistryImport}
            disabled={isImportingFromRegistry}
            title="Načíst pozice z Registru"
            style={{ padding: '6px 10px' }}
          >
            {isImportingFromRegistry ? (
              <><Loader2 size={14} className="inline animate-spin" /> Načítání...</>
            ) : (
              <><Download size={14} className="inline" /> Načíst z Rozpočtu</>
            )}
          </button>

          <button
            className="c-btn"
            onClick={handleUploadClick}
            disabled={isUploading}
            title="Nahrát Excel soubor s pozicemi objektů (alternativní import)"
            style={{ padding: '6px 8px', opacity: 0.8 }}
          >
            {isUploading ? (
              <><Loader2 size={14} className="inline animate-spin" /> Načítání...</>
            ) : (
              <><Upload size={14} className="inline" /> XLSX</>
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
            <Download size={14} className="inline" /> Export XLSX
          </button>

          <button
            className="c-btn"
            onClick={handleExportToRegistry}
            disabled={!selectedBridge || isExportingToRegistry}
            title="Exportovat pozice do Registru"
            style={{ padding: '6px 8px', background: 'var(--color-info, #3b82f6)' }}
          >
            {isExportingToRegistry ? <><Loader2 size={14} className="inline" /> Exportuji...</> : <><Upload size={14} className="inline" /> → Registry</>}
          </button>

          <button
            className="c-btn c-btn--success"
            onClick={handleSaveToServer}
            disabled={!selectedBridge || isSaving}
            title="Uložit export na server"
            style={{ padding: '6px 10px' }}
          >
            <Save size={14} className="inline" /> {isSaving ? 'Ukládám...' : 'Uložit'}
          </button>

          <button
            className="c-btn"
            onClick={() => setShowExportHistory(true)}
            title="Zobrazit historii exportů"
            style={{ padding: '6px 8px' }}
          >
            <ClipboardList size={14} className="inline" /> Historie
          </button>

        </div>
      </div>

      {/* Inline form: Import from Registry */}
      {showRegistryImport && (
        <div style={{
          padding: '8px 16px', background: 'var(--r0-bg-secondary, #f8f9fa)',
          borderTop: '1px solid var(--r0-border, #e2e8f0)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
        }}>
          <span style={{ color: 'var(--r0-text-secondary, #6b7280)', whiteSpace: 'nowrap' }}>Projekt z Rozpočtu:</span>
          {loadingProjects ? (
            <span style={{ color: '#9ca3af' }}>Načítání projektů...</span>
          ) : registryProjects.length === 0 ? (
            <span style={{ color: '#e53e3e' }}>Žádné projekty s daty z Registru. Nejdříve importujte soubor do Registru.</span>
          ) : (
            <select
              value={selectedRegistryProject}
              onChange={(e) => setSelectedRegistryProject(e.target.value)}
              style={{
                padding: '4px 8px', border: '1px solid var(--r0-border, #d1d5db)',
                borderRadius: 4, fontSize: 13, minWidth: 250,
                background: 'var(--r0-bg, #fff)', color: 'var(--r0-text, #1a1a1a)',
              }}
            >
              <option value="">-- vyberte projekt --</option>
              {registryProjects.map(p => (
                <option key={p.portal_project_id} value={p.portal_project_id}>
                  {p.project_name} ({p.positions_total} pozic)
                </option>
              ))}
            </select>
          )}
          <button
            className="c-btn c-btn--success"
            onClick={handleImportFromRegistry}
            disabled={isImportingFromRegistry || !selectedRegistryProject}
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            {isImportingFromRegistry ? 'Načítání...' : 'Importovat'}
          </button>
          <button
            className="c-btn"
            onClick={() => { setShowRegistryImport(false); setSelectedRegistryProject(''); }}
            style={{ padding: '4px 8px', fontSize: 12 }}
          >
            Zrušit
          </button>
        </div>
      )}

      {/* Modal for Create Monolith Form */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setShowCreateForm(false)}
              title="Zavřít"
            >
              <X size={18} />
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
              <X size={18} />
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
              <X size={18} />
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
