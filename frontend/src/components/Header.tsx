/**
 * Header component - Modern UI with Dark mode toggle
 */

import { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useBridges } from '../hooks/useBridges';
import { usePositions } from '../hooks/usePositions';
import { useSnapshots } from '../hooks/useSnapshots';
import { exportAPI, uploadAPI, snapshotsAPI } from '../services/api';
import DaysPerMonthToggle from './DaysPerMonthToggle';
import CreateBridgeForm from './CreateBridgeForm';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ isDark, toggleTheme }: HeaderProps) {
  const { selectedBridge, setSelectedBridge, bridges, positions, headerKPI } = useAppContext();
  const { refetch: refetchBridges } = useBridges();
  const { refetch: refetchPositions } = usePositions(selectedBridge);
  const { refetchActiveSnapshot } = useSnapshots(selectedBridge);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  const handleBridgeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBridge(e.target.value || null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      console.log('Uploading:', file.name);
      const result = await uploadAPI.uploadXLSX(file);
      console.log('Upload result:', result);

      // Refetch bridges after upload
      await refetchBridges();

      alert(`Import successful! Found ${result.bridges.length} bridges with ${result.row_count} rows.`);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    }

    // Reset input
    e.target.value = '';
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!selectedBridge) {
      alert('Please select a bridge first');
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
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
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
      console.error('Error refetching bridges after creation:', error);
      // Still set selected bridge even if refetch fails
      setSelectedBridge(bridge_id);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!selectedBridge || !positions.length || !headerKPI) {
      alert('Nejdříve vyberte most s pozicemi');
      return;
    }

    const confirmCreate = window.confirm(
      'Zafixovat aktuální stav?\n\nVšechna pole budou uzamčena a nelze je upravovat.\n\nChcete pokračovat?'
    );

    if (!confirmCreate) return;

    setIsCreatingSnapshot(true);

    try {
      await snapshotsAPI.create({
        bridge_id: selectedBridge,
        positions,
        header_kpi: headerKPI,
        description: 'Snapshot vytvořen',
        snapshot_name: `Snapshot ${new Date().toLocaleString('cs-CZ')}`
      });

      alert('✅ Snapshot vytvořen! Data jsou nyní zafixována.');

      // Refetch positions and active snapshot to reflect lock state
      await Promise.all([
        refetchPositions(),
        refetchActiveSnapshot()
      ]);
    } catch (error: any) {
      console.error('Error creating snapshot:', error);
      alert(`Chyba při vytváření snapshot: ${error.message}`);
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  return (
    <header className="header">
      <div className="header-logo">
        <span style={{ fontSize: '32px' }}>🏗️</span>
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

        <button className="btn-create" onClick={() => setShowCreateForm(true)}>
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

        <DaysPerMonthToggle />

        <button className="btn-secondary" onClick={handleUploadClick}>
          💾 Nahrát XLSX
        </button>

        <button
          className="btn-lock"
          onClick={handleCreateSnapshot}
          disabled={!selectedBridge || isCreatingSnapshot}
          title="Zafixovat aktuální stav (snapshot)"
        >
          🔒 {isCreatingSnapshot ? 'Fixuji...' : 'Zafixovat'}
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
        >
          📥 Export XLSX
        </button>

        <button
          className="btn-secondary"
          onClick={() => handleExport('csv')}
          disabled={!selectedBridge}
        >
          📥 Export CSV
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
    </header>
  );
}
