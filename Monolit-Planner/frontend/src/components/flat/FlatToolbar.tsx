/**
 * FlatToolbar — Toolbar above the positions table.
 *
 * Contains: RFI filter, import/export buttons.
 */

import { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, ArrowRightLeft } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { uploadAPI, exportAPI } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { saveAs } from 'file-saver';
import ImportRegistryModal from './ImportRegistryModal';

interface Props {
  positionCount: number;
}

export default function FlatToolbar({ positionCount }: Props) {
  const { showOnlyRFI, setShowOnlyRFI, selectedProjectId } = useUI();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showImportRegistry, setShowImportRegistry] = useState(false);

  // XLSX Upload (standalone, no Registry)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;
    setUploading(true);
    try {
      await uploadAPI.uploadXLSX(file);
      qc.invalidateQueries({ queryKey: ['positions', selectedProjectId] });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Nahrání souboru selhalo.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // XLSX Export
  const handleExport = async () => {
    if (!selectedProjectId) return;
    try {
      const blob = await exportAPI.exportXLSX(selectedProjectId);
      saveAs(blob, `monolit-export-${selectedProjectId}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export selhal.');
    }
  };

  // Export to Registry
  const handleExportRegistry = async () => {
    if (!selectedProjectId) return;
    try {
      const resp = await fetch(
        `${(import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'}/api/export-to-registry/${encodeURIComponent(selectedProjectId)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      const data = await resp.json();
      if (data.registry_url) {
        window.open(data.registry_url, '_blank');
      } else {
        alert('Export do Registry proběhl úspěšně.');
      }
    } catch (err) {
      console.error('Registry export failed:', err);
      alert('Export do Registry selhal.');
    }
  };

  return (
    <>
      <div className="flat-toolbar">
        {/* Position count */}
        <span style={{ fontSize: 13, color: 'var(--flat-text-secondary)' }}>
          {positionCount} pozic
        </span>

        {/* RFI filter */}
        <label className="flat-filter-check">
          <input
            type="checkbox"
            checked={showOnlyRFI}
            onChange={e => setShowOnlyRFI(e.target.checked)}
          />
          Jen problémy
        </label>

        <div className="flat-toolbar__spacer" />

        {/* Import from Registry */}
        <button className="flat-btn flat-btn--sm" onClick={() => setShowImportRegistry(true)}>
          <ArrowRightLeft size={14} /> Načíst z Rozpočtu
        </button>

        {/* XLSX Upload */}
        <button
          className="flat-btn flat-btn--sm"
          onClick={() => fileRef.current?.click()}
          disabled={!selectedProjectId || uploading}
        >
          <Upload size={14} /> {uploading ? 'Nahrávám...' : 'Nahrát Excel'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />

        {/* XLSX Export */}
        <button
          className="flat-btn flat-btn--sm"
          onClick={handleExport}
          disabled={!selectedProjectId || positionCount === 0}
        >
          <FileSpreadsheet size={14} /> Export XLSX
        </button>

        {/* Export to Registry */}
        <button
          className="flat-btn flat-btn--sm"
          onClick={handleExportRegistry}
          disabled={!selectedProjectId || positionCount === 0}
        >
          <Download size={14} /> → Registry
        </button>
      </div>

      {showImportRegistry && (
        <ImportRegistryModal onClose={() => setShowImportRegistry(false)} />
      )}
    </>
  );
}
