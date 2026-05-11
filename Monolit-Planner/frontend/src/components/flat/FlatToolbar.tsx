/**
 * FlatToolbar — Toolbar above the positions table.
 *
 * Action buttons always visible. Modal triggers passed from parent.
 */

import { useRef, useState } from 'react';
import { Upload, Download, FileSpreadsheet, ArrowRightLeft, Plus } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { uploadAPI, exportAPI } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { saveAs } from 'file-saver';

interface Props {
  positionCount: number;
  onImportRegistry: () => void;
  onAddPosition: () => void;
}

export default function FlatToolbar({ positionCount, onImportRegistry, onAddPosition }: Props) {
  const { showOnlyRFI, setShowOnlyRFI, showOnlyMonolity, setShowOnlyMonolity, selectedProjectId } = useUI();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAPI.uploadXLSX(file);
      // Invalidate all position queries (new projects created by backend)
      qc.invalidateQueries({ queryKey: ['positions'] });
      qc.invalidateQueries({ queryKey: ['monolith-projects'] });
      qc.invalidateQueries({ queryKey: ['bridges'] });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Nahrání souboru selhalo.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleExport = async () => {
    if (!selectedProjectId) return;
    try {
      const blob = await exportAPI.exportXLSX(selectedProjectId, {
        onlyMonoliths: showOnlyMonolity,
      });
      const suffix = showOnlyMonolity ? '-monolity' : '';
      saveAs(blob, `monolit-export-${selectedProjectId}${suffix}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export selhal.');
    }
  };

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
    <div className="flat-toolbar">
      {positionCount > 0 && (
        <>
          <span style={{ fontSize: 13, color: 'var(--flat-text-secondary)' }}>
            {positionCount} pozic
          </span>
          <label className="flat-filter-check">
            <input type="checkbox" checked={showOnlyRFI}
              onChange={e => setShowOnlyRFI(e.target.checked)} />
            Jen problémy
          </label>
          <label className="flat-filter-check" title="Pouze monolitické práce — elementy s betonem (Vypočítat) a OTSKP kódem 2xx/3xx/4xx">
            <input type="checkbox" checked={showOnlyMonolity}
              onChange={e => setShowOnlyMonolity(e.target.checked)} />
            Jen monolity
          </label>
        </>
      )}

      <div className="flat-toolbar__spacer" />

      <button className="flat-btn flat-btn--sm flat-btn--primary"
        onClick={onAddPosition} disabled={!selectedProjectId}>
        <Plus size={14} /> Přidat pozici
      </button>

      <button className="flat-btn flat-btn--sm" onClick={onImportRegistry}>
        <ArrowRightLeft size={14} /> Načíst z Rozpočtu
      </button>

      <button className="flat-btn flat-btn--sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}>
        <Upload size={14} /> {uploading ? 'Nahrávám...' : 'Nahrát Excel'}
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls"
        style={{ display: 'none' }} onChange={handleUpload} />

      <button className="flat-btn flat-btn--sm"
        onClick={handleExport}
        disabled={!selectedProjectId || positionCount === 0}
        title={showOnlyMonolity
          ? 'Export pouze monolitických prací (filtr "Jen monolity" je aktivní)'
          : 'Export všech pozic do XLSX'}>
        <FileSpreadsheet size={14} /> Export XLSX{showOnlyMonolity ? ' (jen monolity)' : ''}
      </button>

      <button className="flat-btn flat-btn--sm"
        onClick={handleExportRegistry}
        disabled={!selectedProjectId || positionCount === 0}>
        <Download size={14} /> → Registry
      </button>
    </div>
  );
}
