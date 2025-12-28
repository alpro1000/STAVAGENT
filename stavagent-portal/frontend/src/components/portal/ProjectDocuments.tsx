/**
 * Project Documents Component
 *
 * Manage project documents with:
 * - File upload (drag-drop, multi-file)
 * - Folder linking
 * - Background processing status
 * - Aggregated summary generation
 *
 * Design: Digital Concrete (Brutalist Neumorphism)
 * Version: 1.0.0 (2025-12-28)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  Folder,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Trash2,
  FolderPlus,
  FileUp,
  Zap,
  X,
  Clock,
  Database,
  Sparkles,
  History,
  Download,
  FileSpreadsheet,
  FileType,
  GitCompare,
} from 'lucide-react';

// Types
interface ProjectFile {
  file_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  content_hash: string;
  status: 'pending' | 'scanning' | 'parsing' | 'parsed' | 'error' | 'skipped';
  error_message?: string;
  parsed_data?: {
    positions_count?: number;
  };
}

interface FolderLink {
  folder_id: string;
  folder_path: string;
  folder_type: string;
  sync_status: 'idle' | 'scanning' | 'syncing' | 'complete' | 'error';
  file_count: number;
  last_sync?: string;
}

interface BackgroundTask {
  task_id: string;
  task_type: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number;
  message: string;
}

interface ProjectCache {
  positions_count: number;
  files_count: number;
  cache_valid: boolean;
  last_summary?: {
    executive_summary?: string;
    key_findings?: string[];
    recommendations?: string[];
  };
  summary_generated_at?: string;
}

interface ProjectVersion {
  version_id: string;
  version_number: number;
  created_at: string;
  summary: any;
  positions_count: number;
  files_count: number;
}

interface VersionComparison {
  from_version: {
    version_id: string;
    version_number: number;
    created_at: string;
    positions_count: number;
  };
  to_version: {
    version_id: string;
    version_number: number;
    created_at: string;
    positions_count: number;
  };
  files_added: string[];
  files_removed: string[];
  files_modified: string[];
  positions_delta: number;
  cost_delta?: number;
  risk_change: string;
  summary_comparison: {
    executive_summary_changed: boolean;
    key_findings_delta: {
      added: string[];
      removed: string[];
    };
    recommendations_delta: {
      added: string[];
      removed: string[];
    };
  };
}

interface ProjectStatus {
  project_id: string;
  files: {
    total: number;
    pending: number;
    parsing: number;
    parsed: number;
    errors: number;
    skipped: number;
  };
  folders: {
    total: number;
    syncing: number;
  };
  cache?: ProjectCache;
  active_tasks: BackgroundTask[];
  has_pending_work: boolean;
}

interface ProjectDocumentsProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

// API base URL
const CORE_API_URL = (import.meta as any).env?.VITE_CORE_API_URL || 'https://concrete-agent.onrender.com';

export default function ProjectDocuments({ projectId, projectName, onClose }: ProjectDocumentsProps) {
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [folders, setFolders] = useState<FolderLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [folderPath, setFolderPath] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [language, setLanguage] = useState<'cs' | 'en' | 'sk'>('cs');

  // Version management states
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [fromVersion, setFromVersion] = useState<string>('');
  const [toVersion, setToVersion] = useState<string>('');
  const [comparison, setComparison] = useState<VersionComparison | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load status, files, and folders in parallel
      const [statusRes, filesRes, foldersRes] = await Promise.all([
        fetch(`${CORE_API_URL}/api/v1/accumulator/projects/${projectId}/status`),
        fetch(`${CORE_API_URL}/api/v1/accumulator/projects/${projectId}/files`),
        fetch(`${CORE_API_URL}/api/v1/accumulator/projects/${projectId}/folders`),
      ]);

      if (statusRes.ok) {
        setStatus(await statusRes.json());
      }
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.files || []);
      }
      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setFolders(data.folders || []);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Connect WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    const wsUrl = CORE_API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/v1/accumulator/ws/${projectId}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.event === 'task_progress' || message.event === 'task_completed') {
          // Refresh data on task updates
          loadData();
        } else if (message.event === 'connected' || message.event === 'status') {
          setStatus(message.data);
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      // Fallback to polling
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = window.setInterval(loadData, 5000);
      }
    };

    wsRef.current = ws;
  }, [projectId, loadData]);

  useEffect(() => {
    loadData();
    loadVersions();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadData, connectWebSocket]);

  // File upload handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await uploadFiles(droppedFiles);
  }, [projectId]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.currentTarget.files;
    if (selectedFiles) {
      await uploadFiles(Array.from(selectedFiles));
    }
  }, [projectId]);

  const uploadFiles = async (filesToUpload: File[]) => {
    setUploading(true);

    try {
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('file', file);

        await fetch(`${CORE_API_URL}/api/v1/accumulator/files/upload`, {
          method: 'POST',
          body: formData,
        });
      }

      // Refresh data
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Add folder
  const handleAddFolder = async () => {
    if (!folderPath.trim()) return;

    try {
      const response = await fetch(`${CORE_API_URL}/api/v1/accumulator/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          folder_path: folderPath.trim(),
          folder_type: 'local',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add folder');
      }

      setFolderPath('');
      setShowAddFolder(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add folder');
    }
  };

  // Parse all files
  const handleParseAll = async () => {
    try {
      await fetch(`${CORE_API_URL}/api/v1/accumulator/parse-all?project_id=${projectId}`, {
        method: 'POST',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start parsing');
    }
  };

  // Generate summary
  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);

    try {
      await fetch(`${CORE_API_URL}/api/v1/accumulator/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          language,
        }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Full pipeline
  const handleFullPipeline = async () => {
    try {
      await fetch(`${CORE_API_URL}/api/v1/accumulator/projects/${projectId}/full-pipeline?language=${language}`, {
        method: 'POST',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start pipeline');
    }
  };

  // Load versions
  const loadVersions = async () => {
    try {
      const response = await fetch(`${CORE_API_URL}/api/v1/accumulator/projects/${projectId}/versions`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  };

  // Compare versions
  const handleCompareVersions = async () => {
    if (!fromVersion || !toVersion) {
      setError('Vyberte obě verze pro srovnání');
      return;
    }

    try {
      const response = await fetch(
        `${CORE_API_URL}/api/v1/accumulator/projects/${projectId}/compare?from_version=${fromVersion}&to_version=${toVersion}`
      );
      if (response.ok) {
        const data = await response.json();
        setComparison(data.comparison);
        setShowComparison(true);
      } else {
        throw new Error('Failed to compare versions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare versions');
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const response = await fetch(
        `${CORE_API_URL}/api/v1/accumulator/projects/${projectId}/export/excel?project_name=${encodeURIComponent(projectName)}`
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}_export.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export to Excel');
    }
  };

  // Export to PDF
  const handleExportPDF = async (versionId?: string) => {
    try {
      let url = `${CORE_API_URL}/api/v1/accumulator/projects/${projectId}/export/pdf?project_name=${encodeURIComponent(projectName)}`;
      if (versionId) {
        url += `&version_id=${versionId}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = versionId
        ? `${projectName}_v${versions.find(v => v.version_id === versionId)?.version_number || 'X'}.pdf`
        : `${projectName}_summary.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export to PDF');
    }
  };

  const getStatusIcon = (fileStatus: string) => {
    switch (fileStatus) {
      case 'parsed':
        return <CheckCircle size={16} style={{ color: 'var(--status-success)' }} />;
      case 'parsing':
      case 'scanning':
        return <Loader2 size={16} style={{ color: 'var(--brand-orange)', animation: 'spin 1s linear infinite' }} />;
      case 'error':
        return <XCircle size={16} style={{ color: 'var(--status-error)' }} />;
      case 'pending':
        return <Clock size={16} style={{ color: 'var(--text-secondary)' }} />;
      case 'skipped':
        return <AlertTriangle size={16} style={{ color: 'var(--status-warning)' }} />;
      default:
        return <FileText size={16} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}>
        <div className="c-panel" style={{ padding: '48px', textAlign: 'center' }}>
          <Loader2 size={48} style={{ color: 'var(--brand-orange)', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 1000,
      }}
    >
      <div
        className="c-panel"
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              📁 Dokumenty projektu
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {projectName}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Status Bar */}
        {status && (
          <div
            className="c-panel c-panel--inset"
            style={{ marginBottom: '20px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-orange)' }}>
                {status.files.total}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Souborů</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--status-success)' }}>
                {status.files.parsed}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Zpracováno</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--status-warning)' }}>
                {status.files.pending}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Čeká</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {status.cache?.positions_count || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pozic</div>
            </div>
            {status.has_pending_work && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <Loader2 size={16} style={{ color: 'var(--brand-orange)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Zpracování...</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="c-panel c-panel--inset" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-error)', marginBottom: '20px' }}>
            <p style={{ color: 'var(--status-error)', margin: 0, fontSize: '14px' }}>{error}</p>
          </div>
        )}

        {/* Active Tasks */}
        {status?.active_tasks && status.active_tasks.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Aktivní úlohy
            </h4>
            {status.active_tasks.map(task => (
              <div key={task.task_id} className="c-panel c-panel--inset" style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Loader2 size={16} style={{ color: 'var(--brand-orange)', animation: 'spin 1s linear infinite' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{task.message}</div>
                    <div style={{ height: '4px', background: 'var(--surface-inset)', borderRadius: '2px', marginTop: '4px' }}>
                      <div style={{ height: '100%', width: `${task.progress * 100}%`, background: 'var(--brand-orange)', borderRadius: '2px' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{Math.round(task.progress * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: isDragging ? '2px solid var(--brand-orange)' : '2px dashed var(--border-color)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            background: isDragging ? 'rgba(255, 159, 28, 0.1)' : 'var(--surface-inset)',
            marginBottom: '20px',
          }}
        >
          <Upload size={32} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>
            {isDragging ? 'Pusťte soubory zde' : 'Přetáhněte soubory nebo klikněte'}
          </p>
          <input
            type="file"
            id="doc-file-input"
            onChange={handleFileSelect}
            multiple
            style={{ display: 'none' }}
            accept=".xlsx,.xls,.pdf,.xml,.csv,.json"
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <label htmlFor="doc-file-input" className="c-btn c-btn--sm">
              <FileUp size={16} />
              Vybrat soubory
            </label>
            <button onClick={() => setShowAddFolder(true)} className="c-btn c-btn--sm">
              <FolderPlus size={16} />
              Přidat složku
            </button>
          </div>
        </div>

        {/* Add Folder Modal */}
        {showAddFolder && (
          <div className="c-panel c-panel--inset" style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Přidat složku</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="/cesta/ke/složce"
                className="c-input"
                style={{ flex: 1 }}
              />
              <button onClick={handleAddFolder} className="c-btn c-btn--primary c-btn--sm">Přidat</button>
              <button onClick={() => setShowAddFolder(false)} className="c-btn c-btn--sm">Zrušit</button>
            </div>
          </div>
        )}

        {/* Folders List */}
        {folders.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Připojené složky ({folders.length})
            </h4>
            {folders.map(folder => (
              <div key={folder.folder_id} className="c-panel c-panel--inset" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Folder size={20} style={{ color: 'var(--brand-orange)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{folder.folder_path}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {folder.file_count} souborů • {folder.sync_status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Files List */}
        {files.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Soubory ({files.length})
              </h4>
              {status?.files.pending && status.files.pending > 0 && (
                <button onClick={handleParseAll} className="c-btn c-btn--sm c-btn--primary">
                  <Zap size={14} />
                  Zpracovat vše ({status.files.pending})
                </button>
              )}
            </div>
            <div style={{ maxHeight: '200px', overflow: 'auto' }}>
              {files.map(file => (
                <div
                  key={file.file_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  {getStatusIcon(file.status)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.file_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {formatFileSize(file.file_size)} • {file.status}
                      {file.parsed_data?.positions_count && ` • ${file.parsed_data.positions_count} pozic`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Section */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Souhrn projektu
            </h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'cs' | 'en' | 'sk')}
                className="c-input"
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                <option value="cs">Čeština</option>
                <option value="en">English</option>
                <option value="sk">Slovenčina</option>
              </select>
              <button
                onClick={handleGenerateSummary}
                disabled={generatingSummary || !status?.cache?.positions_count}
                className="c-btn c-btn--sm c-btn--primary"
              >
                {generatingSummary ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                Generovat souhrn
              </button>
            </div>
          </div>

          {status?.cache?.last_summary ? (
            <div className="c-panel c-panel--inset">
              {status.cache.last_summary.executive_summary && (
                <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                  {status.cache.last_summary.executive_summary}
                </p>
              )}
              {status.cache.last_summary.key_findings && status.cache.last_summary.key_findings.length > 0 && (
                <>
                  <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Klíčová zjištění:</p>
                  <ul style={{ margin: '0 0 12px', paddingLeft: '20px', fontSize: '13px' }}>
                    {status.cache.last_summary.key_findings.map((f, i) => (
                      <li key={i} style={{ color: 'var(--text-secondary)' }}>{f}</li>
                    ))}
                  </ul>
                </>
              )}
              {status.cache.last_summary.recommendations && status.cache.last_summary.recommendations.length > 0 && (
                <>
                  <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Doporučení:</p>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                    {status.cache.last_summary.recommendations.map((r, i) => (
                      <li key={i} style={{ color: 'var(--text-secondary)' }}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                Vygenerováno: {status.cache.summary_generated_at ? new Date(status.cache.summary_generated_at).toLocaleString() : 'N/A'}
              </p>
            </div>
          ) : (
            <div className="c-panel c-panel--inset" style={{ textAlign: 'center', padding: '24px' }}>
              <Database size={32} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                {status?.cache?.positions_count
                  ? 'Klikněte "Generovat souhrn" pro vytvoření AI souhrnu'
                  : 'Nejprve nahrajte a zpracujte soubory'}
              </p>
            </div>
          )}
        </div>

        {/* Export Section */}
        {status?.cache?.positions_count && status.cache.positions_count > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Export dat
            </h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleExportExcel} className="c-btn c-btn--sm">
                <FileSpreadsheet size={14} />
                Excel (.xlsx)
              </button>
              <button onClick={() => handleExportPDF()} className="c-btn c-btn--sm">
                <FileType size={14} />
                PDF (Souhrn)
              </button>
            </div>
          </div>
        )}

        {/* Versions Section */}
        {versions.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Historie verzí ({versions.length})
              </h4>
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="c-btn c-btn--sm"
              >
                <History size={14} />
                {showVersions ? 'Skrýt' : 'Zobrazit'}
              </button>
            </div>

            {showVersions && (
              <div className="c-panel c-panel--inset" style={{ maxHeight: '300px', overflow: 'auto' }}>
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Verze</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Datum</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Pozice</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Soubory</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v) => (
                      <tr key={v.version_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>v{v.version_number}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                          {new Date(v.created_at).toLocaleString('cs-CZ')}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{v.positions_count}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{v.files_count}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleExportPDF(v.version_id)}
                            className="c-btn c-btn--sm"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            <Download size={12} />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Version Comparison */}
                {versions.length >= 2 && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                      Porovnat verze
                    </h5>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={fromVersion}
                        onChange={(e) => setFromVersion(e.target.value)}
                        className="c-input"
                        style={{ padding: '4px 8px', fontSize: '12px', flex: 1 }}
                      >
                        <option value="">Vyberte verzi...</option>
                        {versions.map((v) => (
                          <option key={v.version_id} value={v.version_id}>
                            v{v.version_number} ({new Date(v.created_at).toLocaleDateString('cs-CZ')})
                          </option>
                        ))}
                      </select>
                      <span style={{ color: 'var(--text-secondary)' }}>→</span>
                      <select
                        value={toVersion}
                        onChange={(e) => setToVersion(e.target.value)}
                        className="c-input"
                        style={{ padding: '4px 8px', fontSize: '12px', flex: 1 }}
                      >
                        <option value="">Vyberte verzi...</option>
                        {versions.map((v) => (
                          <option key={v.version_id} value={v.version_id}>
                            v{v.version_number} ({new Date(v.created_at).toLocaleDateString('cs-CZ')})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleCompareVersions}
                        disabled={!fromVersion || !toVersion}
                        className="c-btn c-btn--sm c-btn--primary"
                      >
                        <GitCompare size={14} />
                        Porovnat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comparison Results */}
            {showComparison && comparison && (
              <div className="c-panel c-panel--inset" style={{ marginTop: '12px', background: 'var(--surface-base)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h5 style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
                    Porovnání verzí v{comparison.from_version.version_number} → v{comparison.to_version.version_number}
                  </h5>
                  <button onClick={() => setShowComparison(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Změna pozic:</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: comparison.positions_delta >= 0 ? 'var(--status-success)' : 'var(--status-error)' }}>
                      {comparison.positions_delta >= 0 ? '+' : ''}{comparison.positions_delta}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Změna rizika:</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{comparison.risk_change}</div>
                  </div>
                </div>

                {comparison.files_added.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-success)', marginBottom: '4px' }}>
                      ✓ Přidané soubory ({comparison.files_added.length})
                    </div>
                  </div>
                )}

                {comparison.files_removed.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-error)', marginBottom: '4px' }}>
                      ✗ Odebrané soubory ({comparison.files_removed.length})
                    </div>
                  </div>
                )}

                {comparison.files_modified.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-orange)', marginBottom: '4px' }}>
                      ⟳ Změněné soubory ({comparison.files_modified.length})
                    </div>
                  </div>
                )}

                {comparison.summary_comparison.key_findings_delta.added.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Nová zjištění:</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
                      {comparison.summary_comparison.key_findings_delta.added.map((f, i) => (
                        <li key={i} style={{ color: 'var(--status-success)' }}>+ {f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {comparison.summary_comparison.recommendations_delta.added.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Nová doporučení:</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
                      {comparison.summary_comparison.recommendations_delta.added.map((r, i) => (
                        <li key={i} style={{ color: 'var(--status-success)' }}>+ {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={handleFullPipeline} className="c-btn c-btn--primary">
            <Zap size={16} />
            Kompletní pipeline
          </button>
          <button onClick={() => { loadData(); loadVersions(); }} className="c-btn">
            <RefreshCw size={16} />
            Obnovit
          </button>
          <button onClick={onClose} className="c-btn">
            Zavřít
          </button>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
