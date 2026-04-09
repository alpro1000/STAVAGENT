/**
 * ImportRegistryModal — Import positions from Registry.
 *
 * Shows list of available Registry/Portal projects, user selects one to import.
 * Search by name, shows sheet/position counts and timestamps.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { uploadAPI } from '../../services/api';
import { FolderOpen, Search, RefreshCw } from 'lucide-react';

interface RegistryProject {
  portal_project_id: string;
  project_name: string;
  positions_total?: number;
  sheet_count?: number;
  registry_linked?: number;
  monolit_linked?: number;
  updated_at?: string | null;
  source?: 'portal' | 'registry';
}

interface DebugInfo {
  portal?: { tried: boolean; ok: boolean; count: number; error: string | null };
  registry?: { tried: boolean; ok: boolean; count: number; error: string | null };
}

interface Props {
  onClose: () => void;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return ''; }
}

export default function ImportRegistryModal({ onClose }: Props) {
  const qc = useQueryClient();

  const [projects, setProjects] = useState<RegistryProject[]>([]);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await uploadAPI.getRegistryProjects();
      const list = Array.isArray(data) ? data : data.projects || [];
      setProjects(list);
      setDebug(data.debug || null);
    } catch (err) {
      setError('Nepodařilo se načíst projekty z Registry.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const handleImport = async (project: RegistryProject) => {
    setImporting(project.portal_project_id);
    try {
      await uploadAPI.importFromRegistry(project.portal_project_id, project.project_name);
      qc.invalidateQueries({ queryKey: ['positions'] });
      qc.invalidateQueries({ queryKey: ['monolith-projects'] });
      qc.invalidateQueries({ queryKey: ['bridges'] });
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import z Registry selhal: ' + (err instanceof Error ? err.message : 'unknown'));
    } finally {
      setImporting(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(p =>
      p.project_name?.toLowerCase().includes(q) ||
      p.portal_project_id?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const sourcesTried = debug
    ? [
        debug.portal?.tried ? `Portal: ${debug.portal.ok ? `${debug.portal.count} ✓` : `chyba (${debug.portal.error})`}` : null,
        debug.registry?.tried ? `Registry: ${debug.registry.ok ? `${debug.registry.count} ✓` : `chyba (${debug.registry.error})`}` : null,
      ].filter(Boolean).join(' | ')
    : '';

  return (
    <div className="flat-modal-overlay" onClick={onClose}>
      <div className="flat-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 className="flat-modal__title" style={{ margin: 0 }}>Načíst z Rozpočtu (Registry)</h2>
          <button
            onClick={loadProjects}
            disabled={loading}
            title="Obnovit seznam"
            style={{
              background: 'none', border: '1px solid var(--flat-border)', borderRadius: 4,
              padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: 'var(--flat-text-secondary)',
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Obnovit
          </button>
        </div>

        {/* Search box */}
        {projects.length > 0 && (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--stone-400)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder="Hledat projekt..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px 6px 30px', fontSize: 13,
                border: '1px solid var(--flat-border)', borderRadius: 4, fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {loading ? (
          <div className="flat-loading"><div className="flat-spinner" /> Načítání...</div>
        ) : error ? (
          <div>
            <p style={{ color: 'var(--red-500)', fontSize: 13 }}>{error}</p>
            {sourcesTried && (
              <p style={{ fontSize: 11, color: 'var(--stone-400)', marginTop: 4 }}>{sourcesTried}</p>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--flat-text-secondary)' }}>
            <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p style={{ margin: '4px 0' }}>
              {search ? 'Žádný projekt nevyhovuje filtru.' : 'Žádné projekty v Registry.'}
            </p>
            {!search && sourcesTried && (
              <p style={{ fontSize: 10, color: 'var(--stone-400)', marginTop: 8, fontFamily: 'monospace' }}>
                {sourcesTried}
              </p>
            )}
            {!search && !debug && (
              <p style={{ fontSize: 11, color: 'var(--stone-400)', marginTop: 8 }}>
                Zkontrolujte, že máte projekty v Registry (rozpocet-registry).
              </p>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--flat-text-secondary)', marginBottom: 6 }}>
              {filtered.length} projekt{filtered.length === 1 ? '' : filtered.length < 5 ? 'y' : 'ů'}
              {search && ` z ${projects.length}`}
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--flat-border)', borderRadius: 4 }}>
              {filtered.map(p => {
                const isImporting = importing === p.portal_project_id;
                const isDisabled = importing !== null && !isImporting;
                return (
                  <div
                    key={p.portal_project_id}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--flat-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.5 : 1,
                      background: isImporting ? 'var(--orange-50, #fff7ed)' : undefined,
                    }}
                    onClick={() => !isDisabled && !isImporting && handleImport(p)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.project_name}
                        {p.source && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 3,
                            background: p.source === 'portal' ? '#dbeafe' : '#dcfce7',
                            color: p.source === 'portal' ? '#1e40af' : '#166534',
                            fontWeight: 600, textTransform: 'uppercase',
                          }}>
                            {p.source}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--flat-text-secondary)', marginTop: 2 }}>
                        {p.positions_total != null && p.positions_total > 0 && (
                          <span>{p.positions_total} pozic</span>
                        )}
                        {p.sheet_count != null && p.sheet_count > 0 && (
                          <span>{p.positions_total ? ' · ' : ''}{p.sheet_count} list{p.sheet_count === 1 ? '' : p.sheet_count < 5 ? 'y' : 'ů'}</span>
                        )}
                        {p.updated_at && (
                          <span style={{ marginLeft: 8, color: 'var(--stone-400)' }}>
                            {formatDate(p.updated_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="flat-btn flat-btn--sm flat-btn--primary"
                      disabled={isDisabled || isImporting}
                    >
                      {isImporting ? 'Importuji...' : 'Importovat'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flat-modal__actions">
          <button className="flat-btn" onClick={onClose}>Zavřít</button>
        </div>
      </div>
    </div>
  );
}
