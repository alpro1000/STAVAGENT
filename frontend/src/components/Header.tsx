/**
 * Header component
 */

import React, { useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useBridges } from '../hooks/useBridges';
import { exportAPI, uploadAPI } from '../services/api';
import DaysPerMonthToggle from './DaysPerMonthToggle';

export default function Header() {
  const { selectedBridge, setSelectedBridge, bridges } = useAppContext();
  const { refetch: refetchBridges } = useBridges();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <header className="header">
      <div className="header-logo">
        <span style={{ fontSize: '32px' }}>🏗️</span>
        <h1>Monolit Planner</h1>
      </div>

      <div className="header-controls">
        <select
          className="bridge-selector"
          value={selectedBridge || ''}
          onChange={handleBridgeChange}
        >
          <option value="">Vyberte most...</option>
          {bridges.map((bridge) => (
            <option key={bridge.bridge_id} value={bridge.bridge_id}>
              {bridge.bridge_id} ({bridge.element_count} prvků)
            </option>
          ))}
        </select>

        <DaysPerMonthToggle />

        <button className="btn-primary" onClick={handleUploadClick}>
          💾 Upload XLSX
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
    </header>
  );
}
