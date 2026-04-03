/**
 * ImportRegistryModal — Import positions from Registry.
 *
 * Shows list of available Registry projects, user selects one to import.
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { uploadAPI } from '../../services/api';
import { useUI } from '../../context/UIContext';
import { FolderOpen } from 'lucide-react';

interface RegistryProject {
  portal_project_id: string;
  project_name: string;
  sheet_count?: number;
  position_count?: number;
}

interface Props {
  onClose: () => void;
}

export default function ImportRegistryModal({ onClose }: Props) {
  const { selectedProjectId } = useUI();
  const qc = useQueryClient();

  const [projects, setProjects] = useState<RegistryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await uploadAPI.getRegistryProjects();
        setProjects(Array.isArray(data) ? data : data.projects || []);
      } catch (err) {
        setError('Nepodařilo se načíst projekty z Registry.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleImport = async (project: RegistryProject) => {
    if (!selectedProjectId) {
      alert('Nejdříve vyberte objekt v postranním panelu.');
      return;
    }
    setImporting(true);
    try {
      await uploadAPI.importFromRegistry(project.portal_project_id, project.project_name);
      qc.invalidateQueries({ queryKey: ['positions', selectedProjectId] });
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import z Registry selhal.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flat-modal-overlay" onClick={onClose}>
      <div className="flat-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h2 className="flat-modal__title">Načíst z Rozpočtu (Registry)</h2>

        {loading ? (
          <div className="flat-loading"><div className="flat-spinner" /> Načítání...</div>
        ) : error ? (
          <p style={{ color: 'var(--red-500)', fontSize: 13 }}>{error}</p>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--flat-text-secondary)' }}>
            <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p>Žádné projekty v Registry.</p>
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {projects.map(p => (
              <div
                key={p.portal_project_id}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--flat-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onClick={() => !importing && handleImport(p)}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.project_name}</div>
                  {p.position_count != null && (
                    <div style={{ fontSize: 12, color: 'var(--flat-text-secondary)' }}>
                      {p.position_count} pozic
                      {p.sheet_count ? `, ${p.sheet_count} listů` : ''}
                    </div>
                  )}
                </div>
                <button className="flat-btn flat-btn--sm flat-btn--primary" disabled={importing}>
                  {importing ? 'Importuji...' : 'Importovat'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flat-modal__actions">
          <button className="flat-btn" onClick={onClose}>Zavřít</button>
        </div>
      </div>
    </div>
  );
}
