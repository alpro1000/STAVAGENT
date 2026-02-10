/**
 * Document Summary Component - Project Passport System
 *
 * 3-Layer Hybrid Architecture for Czech Construction Documents:
 * - Layer 1: MinerU/SmartParser (document structure)
 * - Layer 2: Regex extraction (deterministic facts, confidence = 1.0)
 * - Layer 3: AI enrichment (context, risks, confidence = 0.5-0.9)
 *
 * Extract structured information:
 * - Concrete specifications (C30/37 XC4 XD1)
 * - Reinforcement (B500B, tonnage)
 * - Building dimensions (floors, height, area)
 * - Special requirements (Bílá vana, Pohledový beton)
 * - AI enrichment (risks, location, timeline)
 *
 * Design: Digital Concrete (Brutalist Neumorphism)
 * Version: 2.0.0 (2026-02-10) - Project Passport Integration
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
  Cloud,
  Folder,
  Zap,
  Shield,
  Ruler,
  AlertCircle,
  TrendingUp,
  Users,
} from 'lucide-react';

// Import Passport types
import type {
  PassportGenerationResponse,
  ProjectPassport,
  AIModelType,
} from '../../types/passport';
import { AI_MODEL_OPTIONS } from '../../types/passport';

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
  const [passportData, setPassportData] = useState<PassportGenerationResponse | null>(null);

  // AI Model Selection
  const [selectedModel, setSelectedModel] = useState<AIModelType>('gemini');
  const [enableAiEnrichment, setEnableAiEnrichment] = useState(true);

  // Save to project state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [availableProjects, setAvailableProjects] = useState<Array<{id: string, name: string}>>([]);

  // Google Drive state
  const [googleAuth, setGoogleAuth] = useState({
    isAuthorized: false,
    isLoading: false,
    userId: 'user_default' // TODO: Get from user session
  });
  const [googleFolders, setGoogleFolders] = useState<Array<{id: string, name: string}>>([]);
  const [selectedGoogleFolder, setSelectedGoogleFolder] = useState<string>('');
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState(false);

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

  // ESC key handler for closing modal
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose && !isUploading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [onClose, isUploading]);

  // Handle file upload - NEW: Project Passport API
  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    setPassportData(null);
    setSaveSuccess(false);
    setUploadedFile(file); // Save file for later

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_name', file.name.replace(/\.[^/.]+$/, '')); // Remove extension
      formData.append('enable_ai_enrichment', enableAiEnrichment.toString());
      if (enableAiEnrichment) {
        formData.append('preferred_model', selectedModel);
      }

      // Fetch with timeout (120 seconds for large documents)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(`${CORE_API_URL}/api/v1/passport/generate`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        // Better error messages based on status code
        let errorMessage = errorData?.detail || `HTTP ${response.status}`;
        if (response.status === 404) {
          errorMessage = 'API endpoint nenalezen. Zkontrolujte, zda je concrete-agent spuštěn.';
        } else if (response.status === 500) {
          errorMessage = 'Chyba serveru při zpracování souboru. Zkuste jiný formát.';
        } else if (response.status === 413) {
          errorMessage = 'Soubor je příliš velký (max 100 MB).';
        } else if (response.status === 0) {
          errorMessage = 'Nelze spojit se serverem. Zkontrolujte připojení k internetu.';
        }

        throw new Error(errorMessage);
      }

      const data: PassportGenerationResponse = await response.json();

      if (data.success) {
        setPassportData(data);
      } else {
        throw new Error('Generování pasportu selhalo. Zkuste jiný dokument.');
      }
    } catch (err) {
      let errorMessage = 'Neznámá chyba při zpracování';

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'Zpracování trvá příliš dlouho (timeout 120s). Zkuste menší soubor nebo jednodušší dokument.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      console.error('Passport generation error:', err);
    } finally {
      setIsUploading(false);
    }
  }, [selectedModel, enableAiEnrichment]);

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

  // Google Drive - OAuth2 authentication
  const handleGoogleAuth = useCallback(async () => {
    setGoogleAuth(prev => ({ ...prev, isLoading: true }));
    setError(null);

    try {
      // Open OAuth2 popup
      const authUrl = `${CORE_API_URL}/api/v1/google/auth?user_id=${googleAuth.userId}`;
      const popup = window.open(
        authUrl,
        'GoogleDriveAuth',
        'width=600,height=700,left=200,top=100'
      );

      // Listen for OAuth2 callback
      const handleMessage = async (event: MessageEvent) => {
        // Verify origin for security
        if (event.origin !== new URL(CORE_API_URL).origin) return;

        if (event.data.type === 'google_auth_success') {
          setGoogleAuth(prev => ({ ...prev, isAuthorized: true, isLoading: false }));

          // Load folders after successful auth
          await loadGoogleFolders(googleAuth.userId);

          // Remove listener
          window.removeEventListener('message', handleMessage);

          // Close popup if still open
          if (popup && !popup.closed) {
            popup.close();
          }
        } else if (event.data.type === 'google_auth_error') {
          setError(`Autorizace selhala: ${event.data.error}`);
          setGoogleAuth(prev => ({ ...prev, isLoading: false }));
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Handle popup closed without auth
      const checkPopupClosed = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(checkPopupClosed);
          if (!googleAuth.isAuthorized) {
            setGoogleAuth(prev => ({ ...prev, isLoading: false }));
          }
          window.removeEventListener('message', handleMessage);
        }
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autorizace selhala');
      setGoogleAuth(prev => ({ ...prev, isLoading: false }));
    }
  }, [googleAuth.userId, googleAuth.isAuthorized]);

  // Google Drive - Load folders
  const loadGoogleFolders = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`${CORE_API_URL}/api/v1/google/folders?user_id=${userId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const folders = await response.json();
      setGoogleFolders(folders);
    } catch (err) {
      console.error('Failed to load Google Drive folders:', err);
      setError('Nepodařilo se načíst složky z Google Drive');
    }
  }, []);

  // Google Drive - Upload file
  const handleUploadToDrive = useCallback(async () => {
    if (!uploadedFile || !selectedGoogleFolder) {
      alert('Vyberte složku Google Drive před nahráním');
      return;
    }

    setIsUploadingToDrive(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('user_id', googleAuth.userId);
      formData.append('folder_id', selectedGoogleFolder);
      formData.append('file', uploadedFile);

      const response = await fetch(`${CORE_API_URL}/api/v1/google/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setDriveUploadSuccess(true);
        setTimeout(() => setDriveUploadSuccess(false), 3000);
      } else {
        throw new Error('Nahrání do Google Drive selhalo');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nahrání do Google Drive selhalo');
    } finally {
      setIsUploadingToDrive(false);
    }
  }, [uploadedFile, selectedGoogleFolder, googleAuth.userId]);

  // Export to CSV - NEW: Export passport data
  const exportToCsv = useCallback(() => {
    if (!passportData) return;

    const { passport } = passportData;
    const rows: string[][] = [];

    // Concrete specifications
    rows.push(['=== SPECIFIKACE BETONU ===']);
    passport.concrete_specifications.forEach(spec => {
      rows.push([
        spec.concrete_class,
        spec.exposure_classes.join(' '),
        spec.volume_m3?.toString() || '-',
        spec.special_properties.join(', '),
      ]);
    });

    // Reinforcement
    rows.push([], ['=== VÝZTUŽ ===']);
    passport.reinforcement.forEach(steel => {
      rows.push([
        steel.steel_grade,
        `${steel.tonnage_t || '-'} t`,
        steel.bar_diameters.join(', '),
      ]);
    });

    // Special requirements
    if (passport.special_requirements.length > 0) {
      rows.push([], ['=== SPECIÁLNÍ POŽADAVKY ===']);
      passport.special_requirements.forEach(req => {
        rows.push([req.requirement_type, req.description, req.standard || '-']);
      });
    }

    const csv = rows.map(row => row.join(';')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }); // UTF-8 BOM
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${passport.project_name || 'passport'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [passportData]);

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
          Pasport projektu
        </h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {onClose && (
            <button onClick={onClose} className="c-btn c-btn--ghost" style={{ padding: '8px' }}>
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* AI Configuration Panel - Only show before upload */}
      {!passportData && !isUploading && (
        <div className="c-panel" style={{ padding: '16px', marginBottom: '24px', backgroundColor: 'var(--bg-secondary)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} />
            Konfigurace AI obohacení
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Enable AI toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableAiEnrichment}
                onChange={(e) => setEnableAiEnrichment(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '14px' }}>Povolit AI obohacení (rizika, lokace, časový plán)</span>
            </label>

            {/* Model selection */}
            {enableAiEnrichment && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-secondary)', minWidth: '100px' }}>
                  AI Model:
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as AIModelType)}
                  className="c-input"
                  style={{ flex: 1, maxWidth: '300px' }}
                >
                  {AI_MODEL_OPTIONS.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.cost_per_passport} ({model.speed})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Model description */}
            {enableAiEnrichment && (
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', paddingLeft: '24px' }}>
                {AI_MODEL_OPTIONS.find(m => m.id === selectedModel)?.description}
              </div>
            )}

            {/* Disable AI info */}
            {!enableAiEnrichment && (
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', paddingLeft: '24px' }}>
                ⚡ Pouze deterministická extrakce (Regex) - ZDARMA, 100% přesnost pro technické údaje
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload area */}
      {!passportData && (
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
      {error && !passportData && (
        <div className="c-alert c-alert--error" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={20} />
            <span style={{ fontWeight: 600 }}>Chyba při zpracování</span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '14px' }}>{error}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setError(null);
                setUploadedFile(null);
              }}
              className="c-btn c-btn--primary c-btn--sm"
            >
              Zkusit znovu
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="c-btn c-btn--ghost c-btn--sm"
              >
                Zavřít
              </button>
            )}
          </div>
        </div>
      )}

      {/* Passport display */}
      {passportData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', flexWrap: 'wrap' }}>
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
              <span>Vygenerováno za {passportData.metadata.processing_time_seconds.toFixed(2)}s</span>
              <span style={{ color: 'var(--text-tertiary)' }}>|</span>
              <span>Spolehlivost: {(passportData.metadata.total_confidence * 100).toFixed(0)}%</span>
              <span style={{ color: 'var(--text-tertiary)' }}>|</span>
              <span>{passportData.statistics.deterministic_fields} deterministických polí</span>
              {passportData.statistics.ai_enriched_fields > 0 && (
                <>
                  <span style={{ color: 'var(--text-tertiary)' }}>|</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                    {passportData.statistics.ai_enriched_fields} AI obohacení ({passportData.metadata.ai_model_used})
                  </span>
                </>
              )}
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

              {/* Google Drive Integration */}
              <div style={{ borderLeft: '1px solid var(--border-default)', height: '32px' }} />

              {!googleAuth.isAuthorized ? (
                <button
                  onClick={handleGoogleAuth}
                  className="c-btn c-btn--secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  disabled={googleAuth.isLoading}
                >
                  {googleAuth.isLoading ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Autorizuji...
                    </>
                  ) : (
                    <>
                      <Cloud size={16} />
                      Připojit Google Drive
                    </>
                  )}
                </button>
              ) : (
                <>
                  <select
                    value={selectedGoogleFolder}
                    onChange={(e) => setSelectedGoogleFolder(e.target.value)}
                    className="c-input"
                    style={{ minWidth: '180px' }}
                    disabled={isUploadingToDrive || googleFolders.length === 0}
                  >
                    <option value="">Vyberte složku Drive...</option>
                    {googleFolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleUploadToDrive}
                    className="c-btn c-btn--secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    disabled={!selectedGoogleFolder || isUploadingToDrive}
                  >
                    {isUploadingToDrive ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Nahrávám...
                      </>
                    ) : driveUploadSuccess ? (
                      <>
                        <CheckCircle size={16} />
                        Nahráno!
                      </>
                    ) : (
                      <>
                        <Cloud size={16} />
                        Nahrát do Drive
                      </>
                    )}
                  </button>
                </>
              )}

              <button onClick={exportToCsv} className="c-btn c-btn--secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={16} />
                Export CSV
              </button>
              <button
                onClick={() => {
                  setPassportData(null);
                  setUploadedFile(null);
                  setSaveSuccess(false);
                }}
                className="c-btn c-btn--ghost"
              >
                Nový dokument
              </button>
            </div>
          </div>

          {/* Statistics Overview */}
          <div className="c-card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} />
              Shrnutí pasportu
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div className="c-stat-box" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Název projektu</div>
                <div style={{ fontWeight: 600, fontSize: '18px' }}>{passportData.passport.project_name}</div>
              </div>
              <div className="c-stat-box" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Beton celkem</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                  {formatNumber(passportData.statistics.total_concrete_m3)} <span style={{ fontSize: '14px', fontWeight: 400 }}>m³</span>
                </div>
              </div>
              <div className="c-stat-box" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Výztuž celkem</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-secondary)' }}>
                  {formatNumber(passportData.statistics.total_reinforcement_t)} <span style={{ fontSize: '14px', fontWeight: 400 }}>t</span>
                </div>
              </div>
              <div className="c-stat-box" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Třídy betonu</div>
                <div style={{ fontSize: '24px', fontWeight: 600 }}>
                  {passportData.statistics.unique_concrete_classes}
                </div>
              </div>
              <div className="c-stat-box" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Ocelové třídy</div>
                <div style={{ fontSize: '24px', fontWeight: 600 }}>
                  {passportData.statistics.unique_steel_grades}
                </div>
              </div>
            </div>
          </div>

          {/* Concrete Specifications Card */}
          {passportData.passport.concrete_specifications.length > 0 && (
            <div className="c-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Boxes size={20} />
                Specifikace betonu ({passportData.passport.concrete_specifications.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passportData.passport.concrete_specifications.map((spec, index) => (
                  <div key={index} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: '3px solid var(--accent-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '16px' }}>{spec.concrete_class}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        Spolehlivost: {(spec.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    {spec.exposure_classes.length > 0 && (
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <strong>Expozice:</strong> {spec.exposure_classes.join(', ')}
                      </div>
                    )}
                    {spec.volume_m3 !== null && (
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <strong>Objem:</strong> {formatNumber(spec.volume_m3)} m³
                      </div>
                    )}
                    {spec.special_properties.length > 0 && (
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <strong>Vlastnosti:</strong> {spec.special_properties.join(', ')}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px', fontStyle: 'italic' }}>
                      {spec.source_text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reinforcement Card */}
          {passportData.passport.reinforcement.length > 0 && (
            <div className="c-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} />
                Výztuž ({passportData.passport.reinforcement.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passportData.passport.reinforcement.map((steel, index) => (
                  <div key={index} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: '3px solid var(--accent-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '16px' }}>{steel.steel_grade}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        Spolehlivost: {(steel.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    {steel.tonnage_t !== null && (
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <strong>Hmotnost:</strong> {formatNumber(steel.tonnage_t)} t
                      </div>
                    )}
                    {steel.bar_diameters.length > 0 && (
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <strong>Průměry:</strong> {steel.bar_diameters.join(', ')}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px', fontStyle: 'italic' }}>
                      {steel.source_text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Building Dimensions Card */}
          {passportData.passport.dimensions && (
            <div className="c-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ruler size={20} />
                Rozměry objektu
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                {passportData.passport.dimensions.floors_above_ground !== null && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Nadzemní podlaží</div>
                    <div style={{ fontWeight: 500, fontSize: '18px' }}>{passportData.passport.dimensions.floors_above_ground} NP</div>
                  </div>
                )}
                {passportData.passport.dimensions.floors_underground !== null && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Podzemní podlaží</div>
                    <div style={{ fontWeight: 500, fontSize: '18px' }}>{passportData.passport.dimensions.floors_underground} PP</div>
                  </div>
                )}
                {passportData.passport.dimensions.height_m !== null && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Výška</div>
                    <div style={{ fontWeight: 500, fontSize: '18px' }}>{formatNumber(passportData.passport.dimensions.height_m)} m</div>
                  </div>
                )}
                {passportData.passport.dimensions.length_m !== null && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Délka</div>
                    <div style={{ fontWeight: 500, fontSize: '18px' }}>{formatNumber(passportData.passport.dimensions.length_m)} m</div>
                  </div>
                )}
                {passportData.passport.dimensions.width_m !== null && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Šířka</div>
                    <div style={{ fontWeight: 500, fontSize: '18px' }}>{formatNumber(passportData.passport.dimensions.width_m)} m</div>
                  </div>
                )}
                {passportData.passport.dimensions.built_up_area_m2 !== null && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Zastavěná plocha</div>
                    <div style={{ fontWeight: 500, fontSize: '18px' }}>{formatNumber(passportData.passport.dimensions.built_up_area_m2)} m²</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Spolehlivost: {(passportData.passport.dimensions.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}

          {/* Special Requirements Card */}
          {passportData.passport.special_requirements.length > 0 && (
            <div className="c-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} />
                Speciální požadavky ({passportData.passport.special_requirements.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passportData.passport.special_requirements.map((req, index) => (
                  <div key={index} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: '3px solid #FF9F1C' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 600 }}>{req.requirement_type}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        Spolehlivost: {(req.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '6px' }}>{req.description}</div>
                    {req.standard && (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <strong>Norma:</strong> {req.standard}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px', fontStyle: 'italic' }}>
                      {req.source_text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Enrichment: Risks */}
          {passportData.passport.risks.length > 0 && (
            <div className="c-card" style={{ borderTop: '2px solid var(--accent-primary)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={20} style={{ color: 'var(--accent-primary)' }} />
                Hodnocení rizik (AI obohacení)
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                Generováno pomocí {passportData.metadata.ai_model_used}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passportData.passport.risks.map((risk, index) => (
                  <div key={index} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: `3px solid ${risk.severity === 'High' ? '#EF4444' : risk.severity === 'Medium' ? '#F59E0B' : '#10B981'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 600 }}>{risk.risk_category} - {risk.severity}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        Spolehlivost: {(risk.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '6px' }}>{risk.description}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <strong>Zmírnění:</strong> {risk.mitigation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Enrichment: Location */}
          {passportData.passport.location && (
            <div className="c-card" style={{ borderTop: '2px solid var(--accent-primary)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} />
                Lokace (AI obohacení)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {passportData.passport.location.city && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Město</div>
                    <div style={{ fontWeight: 500 }}>{passportData.passport.location.city}</div>
                  </div>
                )}
                {passportData.passport.location.region && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Kraj</div>
                    <div style={{ fontWeight: 500 }}>{passportData.passport.location.region}</div>
                  </div>
                )}
                {passportData.passport.location.address && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Adresa</div>
                    <div style={{ fontWeight: 500 }}>{passportData.passport.location.address}</div>
                  </div>
                )}
                {passportData.passport.location.coordinates && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Souřadnice</div>
                    <div style={{ fontWeight: 500 }}>{passportData.passport.location.coordinates}</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Spolehlivost: {(passportData.passport.location.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}

          {/* AI Enrichment: Timeline */}
          {passportData.passport.timeline && (
            <div className="c-card" style={{ borderTop: '2px solid var(--accent-primary)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} />
                Harmonogram (AI obohacení)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                {passportData.passport.timeline.start_date && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Zahájení</div>
                    <div style={{ fontWeight: 500 }}>{formatDate(passportData.passport.timeline.start_date)}</div>
                  </div>
                )}
                {passportData.passport.timeline.end_date && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Dokončení</div>
                    <div style={{ fontWeight: 500 }}>{formatDate(passportData.passport.timeline.end_date)}</div>
                  </div>
                )}
                {passportData.passport.timeline.duration_months !== null && (
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Délka trvání</div>
                    <div style={{ fontWeight: 500 }}>{passportData.passport.timeline.duration_months} měsíců</div>
                  </div>
                )}
              </div>
              {passportData.passport.timeline.critical_milestones.length > 0 && (
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '8px' }}>Kritické milníky</div>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {passportData.passport.timeline.critical_milestones.map((milestone, index) => (
                      <li key={index} style={{ marginBottom: '4px' }}>{milestone}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Spolehlivost: {(passportData.passport.timeline.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}

          {/* AI Enrichment: Stakeholders */}
          {passportData.passport.stakeholders.length > 0 && (
            <div className="c-card" style={{ borderTop: '2px solid var(--accent-primary)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} />
                Zúčastněné strany (AI obohacení)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passportData.passport.stakeholders.map((stakeholder, index) => (
                  <div key={index} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{stakeholder.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{stakeholder.role}</div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      Spolehlivost: {(stakeholder.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'right' }}>
            Soubor: {passportData.metadata.file_name} | ID: {passportData.passport.passport_id} | Vygenerováno: {new Date(passportData.passport.generated_at).toLocaleString('cs-CZ')}
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
