/**
 * Document Summary Component
 *
 * Extract structured information from construction documents:
 * - Project info (name, location, type, investor)
 * - Work items (all positions with quantities)
 * - Key quantities (total concrete, reinforcement, formwork)
 * - Timeline (start, end, milestones)
 * - Requirements (standards, environmental, safety)
 *
 * Design: Digital Concrete (Brutalist Neumorphism)
 * Version: 1.0.0 (2026-01-08)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Building2,
  MapPin,
  User,
  Hash,
  Boxes,
  Calendar,
  ClipboardList,
  Download,
  X,
  FileSpreadsheet,
  Database,
} from 'lucide-react';

// Types
interface WorkItem {
  type: string;
  quantity: number;
  unit: string;
  note: string;
  source_row?: number;
}

interface ProjectInfo {
  name: string;
  location: string;
  type: string;
  investor: string;
  object_id: string;
}

interface KeyQuantities {
  total_concrete_m3: number;
  total_reinforcement_t: number;
  total_formwork_m2: number;
  estimated_cost_czk?: number;
}

interface Timeline {
  start: string | null;
  end: string | null;
  milestones: string[];
}

interface DocumentSummaryData {
  project_info: ProjectInfo;
  work_items: WorkItem[];
  quantities: KeyQuantities;
  timeline: Timeline;
  requirements: string[];
  metadata: {
    source_file: string;
    extracted_at: string;
    extraction_time_seconds: number;
    confidence: number;
    language: string;
  };
}

interface DocumentSummaryProps {
  projectId?: string;
  onClose?: () => void;
}

// API base URL
const CORE_API_URL = (import.meta as any).env?.VITE_CORE_API_URL || 'https://concrete-agent.onrender.com';

export default function DocumentSummary({ projectId: _projectId, onClose }: DocumentSummaryProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DocumentSummaryData | null>(null);
  const [language, setLanguage] = useState<'cs' | 'en' | 'sk'>('cs');

  // Save to project state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [availableProjects, setAvailableProjects] = useState<Array<{id: string, name: string}>>([]);

  // Load available projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const portalApiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${portalApiUrl}/api/portal/projects`);
        if (response.ok) {
          const projects = await response.json();
          setAvailableProjects(projects.map((p: any) => ({
            id: p.portal_project_id || p.id,
            name: p.project_name || 'Unnamed'
          })));
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    };
    loadProjects();
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    setSummary(null);
    setSaveSuccess(false);
    setUploadedFile(file); // Save file for later

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);

      const response = await fetch(`${CORE_API_URL}/api/v1/accumulator/summarize/file`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSummary(data);
      } else {
        throw new Error('Extraction failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsUploading(false);
    }
  }, [language]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  // File input handler
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  // Save to project
  const handleSaveToProject = useCallback(async () => {
    if (!uploadedFile || !selectedProjectId) {
      alert('Vyberte projekt před uložením');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('project_id', selectedProjectId);
      formData.append('file', uploadedFile);

      const response = await fetch(`${CORE_API_URL}/api/v1/accumulator/files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        throw new Error('Save failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [uploadedFile, selectedProjectId]);

  // Export to CSV
  const exportToCsv = useCallback(() => {
    if (!summary) return;

    const rows = summary.work_items.map(item => [
      item.type,
      item.quantity,
      item.unit,
      item.note,
    ]);

    const header = ['Typ práce', 'Množství', 'MJ', 'Poznámky'];
    const csv = [header, ...rows].map(row => row.join(';')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${summary.project_info.name || 'summary'}_work_items.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [summary]);

  // Format number with Czech locale
  const formatNumber = (value: number | undefined | null, decimals = 2): string => {
    if (value === undefined || value === null) return '-';
    return value.toLocaleString('cs-CZ', { maximumFractionDigits: decimals });
  };

  // Format date
  const formatDate = (date: string | null): string => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('cs-CZ');
    } catch {
      return date;
    }
  };

  return (
    <div className="c-panel" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSpreadsheet size={24} />
          Shrnutí dokumentu
        </h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'cs' | 'en' | 'sk')}
            className="c-input"
            style={{ width: '80px' }}
          >
            <option value="cs">CZ</option>
            <option value="en">EN</option>
            <option value="sk">SK</option>
          </select>
          {onClose && (
            <button onClick={onClose} className="c-btn c-btn--ghost" style={{ padding: '8px' }}>
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Upload area */}
      {!summary && (
        <div
          className={`c-upload-zone ${isDragOver ? 'c-upload-zone--active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: '2px dashed var(--border-default)',
            borderRadius: '8px',
            padding: '48px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragOver ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            transition: 'all 0.2s ease',
          }}
        >
          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <Loader2 size={48} className="spin" style={{ color: 'var(--accent-primary)' }} />
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Analyzuji dokument...</p>
            </div>
          ) : (
            <>
              <Upload size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }} />
              <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 500 }}>
                Přetáhněte dokument sem
              </p>
              <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                nebo klikněte pro výběr souboru
              </p>
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '13px' }}>
                Podporované formáty: PDF, XLSX, XLS, DOCX
              </p>
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.docx"
                onChange={handleFileSelect}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="c-alert c-alert--error" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary display */}
      {summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
              <span>Extrahováno za {summary.metadata.extraction_time_seconds.toFixed(2)}s</span>
              <span style={{ color: 'var(--text-tertiary)' }}>|</span>
              <span>Spolehlivost: {(summary.metadata.confidence * 100).toFixed(0)}%</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Project selector and save button */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="c-input"
                style={{ minWidth: '200px' }}
                disabled={isSaving}
              >
                <option value="">Vyberte projekt...</option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSaveToProject}
                className="c-btn c-btn--primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={!selectedProjectId || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Ukládám...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle size={16} />
                    Uloženo!
                  </>
                ) : (
                  <>
                    <Database size={16} />
                    Uložit do projektu
                  </>
                )}
              </button>

              <button onClick={exportToCsv} className="c-btn c-btn--secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={16} />
                Export CSV
              </button>
              <button
                onClick={() => {
                  setSummary(null);
                  setUploadedFile(null);
                  setSaveSuccess(false);
                }}
                className="c-btn c-btn--ghost"
              >
                Nový dokument
              </button>
            </div>
          </div>

          {/* Project Info Card */}
          <div className="c-card">
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={20} />
              Přehled projektu
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Název projektu</div>
                <div style={{ fontWeight: 500 }}>{summary.project_info.name || '-'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} /> Lokalita
                </div>
                <div style={{ fontWeight: 500 }}>{summary.project_info.location || '-'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Typ stavby</div>
                <div style={{ fontWeight: 500 }}>{summary.project_info.type || '-'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={12} /> Investor
                </div>
                <div style={{ fontWeight: 500 }}>{summary.project_info.investor || '-'}</div>
              </div>
              {summary.project_info.object_id && (
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Hash size={12} /> ID objektu
                  </div>
                  <div style={{ fontWeight: 500 }}>{summary.project_info.object_id}</div>
                </div>
              )}
            </div>
          </div>

          {/* Key Quantities Card */}
          <div className="c-card">
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Boxes size={20} />
              Klíčové objemy
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div className="c-stat-box" style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Beton celkem</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                  {formatNumber(summary.quantities.total_concrete_m3)} <span style={{ fontSize: '14px', fontWeight: 400 }}>m³</span>
                </div>
              </div>
              <div className="c-stat-box" style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Výztuž celkem</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-secondary)' }}>
                  {formatNumber(summary.quantities.total_reinforcement_t)} <span style={{ fontSize: '14px', fontWeight: 400 }}>t</span>
                </div>
              </div>
              <div className="c-stat-box" style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Bednění celkem</div>
                <div style={{ fontSize: '24px', fontWeight: 600 }}>
                  {formatNumber(summary.quantities.total_formwork_m2)} <span style={{ fontSize: '14px', fontWeight: 400 }}>m²</span>
                </div>
              </div>
              {summary.quantities.estimated_cost_czk && (
                <div className="c-stat-box" style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Odhadovaná cena</div>
                  <div style={{ fontSize: '24px', fontWeight: 600 }}>
                    {formatNumber(summary.quantities.estimated_cost_czk, 0)} <span style={{ fontSize: '14px', fontWeight: 400 }}>CZK</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Work Items Table */}
          <div className="c-card">
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={20} />
              Rozsah prací ({summary.work_items.length} položek)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="c-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '2px solid var(--border-default)' }}>Typ práce</th>
                    <th style={{ textAlign: 'right', padding: '12px 8px', borderBottom: '2px solid var(--border-default)' }}>Množství</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '2px solid var(--border-default)' }}>MJ</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '2px solid var(--border-default)' }}>Poznámky</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.work_items.map((item, index) => (
                    <tr key={index} style={{ backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-subtle)' }}>{item.type}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatNumber(item.quantity)}
                      </td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{item.unit}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '13px' }}>{item.note || '-'}</td>
                    </tr>
                  ))}
                  {summary.work_items.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        Žádné pracovní položky nebyly extrahovány
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Timeline Card */}
          {(summary.timeline.start || summary.timeline.end || summary.timeline.milestones.length > 0) && (
            <div className="c-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} />
                Harmonogram
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: summary.timeline.milestones.length > 0 ? '16px' : 0 }}>
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Zahájení</div>
                  <div style={{ fontWeight: 500 }}>{formatDate(summary.timeline.start)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Dokončení</div>
                  <div style={{ fontWeight: 500 }}>{formatDate(summary.timeline.end)}</div>
                </div>
              </div>
              {summary.timeline.milestones.length > 0 && (
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '8px' }}>Milníky</div>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {summary.timeline.milestones.map((milestone, index) => (
                      <li key={index} style={{ marginBottom: '4px' }}>{milestone}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Requirements Card */}
          {summary.requirements.length > 0 && (
            <div className="c-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} />
                Požadavky a normy
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {summary.requirements.map((req, index) => (
                  <li key={index} style={{ marginBottom: '6px' }}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata */}
          <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'right' }}>
            Soubor: {summary.metadata.source_file} | Extrahováno: {new Date(summary.metadata.extracted_at).toLocaleString('cs-CZ')}
          </div>
        </div>
      )}

      {/* Spinner animation */}
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
