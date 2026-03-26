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

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Download,
  X,
  FileSpreadsheet,
  Database,
  Cloud,
  Zap,
} from 'lucide-react';

// Import Passport types
import type {
  PassportGenerationResponse,
  ProjectPassport,
  AIModelType,
  AdaptiveTopic,
  ClassificationInfo,
  DocCategory,
} from '../../types/passport';
import { AI_MODELS, AI_MODEL_OPTIONS, DOC_CATEGORY_LABELS, DOC_CATEGORY_COLORS } from '../../types/passport';
import ProjectAnalysis from './ProjectAnalysis';
import type { ProjectAnalysisData } from './ProjectAnalysis';

interface DocumentSummaryProps {
  projectId?: string;
  onClose?: () => void;
}

import { API_URL } from '../../services/api';

// Proxied through portal backend
const CORE_API_URL = `${API_URL}/api/core`;

const ALLOWED_FILE_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'xml', 'docx', 'csv'];

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function isVertexModel(model: AIModelType): boolean {
  return model === AI_MODELS.VERTEX_AI_GEMINI;
}

function extractPassportError(data: any): string {
  return data?.detail || data?.error || data?.message || data?.metadata?.error || 'Generování pasportu selhalo. Zkuste jiný dokument.';
}


export default function DocumentSummary({ projectId: _projectId, onClose }: DocumentSummaryProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passportData, setPassportData] = useState<PassportGenerationResponse | null>(null);

  // AI Model Selection
  const [selectedModel, setSelectedModel] = useState<AIModelType>('gemini');
  const [enableAiEnrichment, setEnableAiEnrichment] = useState(true);
  const [analysisMode, setAnalysisMode] = useState<'adaptive_extraction' | 'summary_only' | 'project_analysis'>('adaptive_extraction');
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // v3: Project analysis state (multi-file)
  const [projectData, setProjectData] = useState<ProjectAnalysisData | null>(null);

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
        const response = await fetch(`${portalApiUrl}/api/portal-projects`, {
          credentials: 'include',  // Include cookies for authentication
          headers: {
            'Content-Type': 'application/json',
          }
        });
        if (response.ok) {
          const data = await response.json();
          // Handle both array and object response formats
          const projects = Array.isArray(data) ? data : (data.projects || []);
          setAvailableProjects(projects.map((p: any) => ({
            id: p.portal_project_id || p.id,
            name: p.project_name || 'Unnamed'
          })));
        } else if (response.status === 401) {
          console.warn('[DocumentSummary] Authentication required - projects list disabled');
          // Don't show error if auth is disabled in production
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

  // v3: Handle multi-file project analysis
  const handleProjectUpload = useCallback(async (files: File[]) => {
    setIsUploading(true);
    setError(null);
    setPassportData(null);
    setProjectData(null);
    setSaveSuccess(false);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }
      formData.append('project_name', files[0].name.replace(/\.[^/.]+$/, ''));
      formData.append('enable_ai_enrichment', enableAiEnrichment.toString());
      if (enableAiEnrichment) {
        formData.append('preferred_model', selectedModel);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min for multi-file

      const response = await fetch(`${CORE_API_URL}/passport/process-project`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `HTTP ${response.status}`);
      }

      const data: ProjectAnalysisData = await response.json();
      if (data?.success === false) {
        throw new Error('Zpracování projektu selhalo.');
      }
      setProjectData(data);
    } catch (err) {
      let errorMessage = 'Neznámá chyba při zpracování';
      if (err instanceof Error) {
        errorMessage = err.name === 'AbortError'
          ? 'Zpracování trvá příliš dlouho (timeout 10 minut).'
          : err.message;
      }
      setError(errorMessage);
      console.error('Project analysis error:', err);
    } finally {
      setIsUploading(false);
    }
  }, [selectedModel, enableAiEnrichment]);

  // Handle file upload - NEW: Project Passport API
  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    setPassportData(null);
    setProjectData(null);
    setSaveSuccess(false);
    setUploadedFile(file); // Save file for later

    try {
      const ext = getFileExtension(file.name);
      if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
        throw new Error(`Nepodporovaný formát ${ext || 'souboru'}. Povolené formáty: PDF, XLSX, XLS, XML, DOCX, CSV.`);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_name', file.name.replace(/\.[^/.]+$/, '')); // Remove extension
      formData.append('enable_ai_enrichment', enableAiEnrichment.toString());
      if (enableAiEnrichment) {
        formData.append('preferred_model', selectedModel);
        formData.append('requested_model', selectedModel);
      }
      formData.append('analysis_mode', analysisMode);

      if (enableAiEnrichment && isVertexModel(selectedModel)) {
        formData.append('llm_provider', 'vertex-ai');
      }

      // Fetch with timeout (5 minutes for large documents - 46+ pages)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

      const response = await fetch(`${CORE_API_URL}/passport/generate`, {
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

      if (data?.success === false) {
        throw new Error(extractPassportError(data));
      }

      if (data?.passport) {
        // Some CORE versions do not return `success`, only passport payload.
        setPassportData({ ...data, success: true });
      } else {
        throw new Error(extractPassportError(data));
      }
    } catch (err) {
      let errorMessage = 'Neznámá chyba při zpracování';

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'Zpracování trvá příliš dlouho (timeout 5 minut). Zkuste menší soubor nebo kontaktujte administrátora.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      console.error('Passport generation error:', err);
    } finally {
      setIsUploading(false);
    }
  }, [selectedModel, enableAiEnrichment, analysisMode]);

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
      if (analysisMode === 'project_analysis' && files.length > 1) {
        handleProjectUpload(Array.from(files));
      } else {
        handleFileUpload(files[0]);
      }
    }
  }, [handleFileUpload, handleProjectUpload, analysisMode]);

  // File input handler
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (analysisMode === 'project_analysis') {
        handleProjectUpload(Array.from(files));
      } else {
        handleFileUpload(files[0]);
      }
    }
    // Reset input value to allow re-uploading the same file
    e.target.value = '';
  }, [handleFileUpload, handleProjectUpload, analysisMode]);

  // Trigger file input click
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Save to project
  const handleSaveToProject = useCallback(async () => {
    if (!uploadedFile || !selectedProjectId) {
      setError('Vyberte projekt před uložením');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const ext = getFileExtension(uploadedFile.name);
      if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
        throw new Error(`Nepodporovaný formát ${ext || 'souboru'}. Povolené formáty: PDF, XLSX, XLS, XML.`);
      }

      const formData = new FormData();
      formData.append('project_id', selectedProjectId);
      formData.append('file', uploadedFile);

      const response = await fetch(`${CORE_API_URL}/accumulator/files/upload`, {
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
      const authUrl = `${CORE_API_URL}/google/auth?user_id=${googleAuth.userId}`;
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
      const response = await fetch(`${CORE_API_URL}/google/folders?user_id=${userId}`);

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
      setError('Vyberte složku Google Drive před nahráním');
      return;
    }

    setIsUploadingToDrive(true);
    setError(null);

    try {
      const ext = getFileExtension(uploadedFile.name);
      if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
        throw new Error(`Nepodporovaný formát ${ext || 'souboru'}. Povolené formáty: PDF, XLSX, XLS, XML.`);
      }

      const formData = new FormData();
      formData.append('user_id', googleAuth.userId);
      formData.append('folder_id', selectedGoogleFolder);
      formData.append('file', uploadedFile);

      const response = await fetch(`${CORE_API_URL}/google/upload`, {
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
      {!passportData && !projectData && !isUploading && (
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

            {/* Analysis mode */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-secondary)', minWidth: '100px' }}>
                Režim:
              </label>
              <select
                value={analysisMode}
                onChange={(e) => setAnalysisMode(e.target.value as 'adaptive_extraction' | 'summary_only')}
                className="c-input"
                style={{ flex: 1, maxWidth: '300px' }}
              >
                <option value="adaptive_extraction">Strukturovaný pasport (beton, výztuž, rozměry)</option>
                <option value="summary_only">Adaptivní shrnutí (univerzální, dynamické téma)</option>
                <option value="project_analysis">Projektová analýza (více dokumentů, SO merge)</option>
              </select>
            </div>

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

      {/* Hidden file input */}
      <input
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept=".pdf,.xlsx,.xls,.xml,.docx,.csv"
        multiple={analysisMode === 'project_analysis'}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Upload area */}
      {!passportData && !projectData && (
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
            backgroundColor: isDragOver ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
        >
          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <Loader2 size={48} className="spin" style={{ color: 'var(--accent-primary)' }} />
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {analysisMode === 'project_analysis' ? 'Analyzuji projekt (více dokumentů)...' : 'Analyzuji dokument...'}
              </p>
            </div>
          ) : (
            <>
              <Upload size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }} />
              <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 500 }}>
                {analysisMode === 'project_analysis'
                  ? 'Přetáhněte dokumenty projektu sem'
                  : 'Přetáhněte dokument sem'}
              </p>
              <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                {analysisMode === 'project_analysis'
                  ? 'Více souborů najednou (TZ, výkresy, GTP, rozpočet...)'
                  : 'nebo klikněte na tlačítko níže'}
              </p>
              <button
                onClick={handleUploadClick}
                className="c-btn c-btn--primary"
                style={{ marginBottom: '16px' }}
              >
                <Upload size={16} style={{ marginRight: '8px' }} />
                Vybrat soubor
              </button>
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '13px' }}>
                Podporované formáty: PDF, XLSX, XLS, XML
              </p>
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

      {/* v3: Project Analysis display (multi-document) */}
      {projectData && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <CheckCircle size={20} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Projektová analýza dokončena · {projectData.project_name}
            </span>
            <button
              onClick={() => { setProjectData(null); setError(null); }}
              className="c-btn c-btn--ghost"
              style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '13px' }}
            >
              Nová analýza
            </button>
          </div>
          <ProjectAnalysis data={projectData} />
        </div>
      )}

      {/* Passport display */}
      {passportData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Action bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', flexWrap: 'wrap' }}>
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
              <span>
                Vygenerováno za {
                  (() => {
                    const t = passportData?.metadata?.processing_time_seconds;
                    return (typeof t === 'number') ? `${t.toFixed(2)}s` : '—';
                  })()
                }
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>|</span>
              <span>
                Spolehlivost: {(() => {
                  const conf = passportData?.metadata?.total_confidence;
                  return (typeof conf === 'number') ? `${(conf * 100).toFixed(0)}%` : '—%';
                })()}
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>|</span>
              <span>{passportData?.statistics?.deterministic_fields ?? 0} deterministických polí</span>
              {(passportData?.statistics?.ai_enriched_fields ?? 0) > 0 && (
                <>
                  <span style={{ color: 'var(--text-tertiary)' }}>|</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                    {passportData?.statistics?.ai_enriched_fields} AI obohacení ({passportData?.metadata?.ai_model_used || 'unknown'})
                  </span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Project selector and save button */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="c-input"
                style={{ minWidth: '180px', flex: '1 1 180px' }}
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
                    style={{ minWidth: '160px', flex: '1 1 160px' }}
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

          {/* === DOCUMENT ANALYSIS RESULT — Clean flowing layout === */}
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: '28px 32px',
            lineHeight: 1.8,
            fontSize: '14px',
            color: 'var(--text-primary)',
          }}>
            {/* Classification badge */}
            {(passportData as any).classification && (() => {
              const cls = (passportData as any).classification as ClassificationInfo;
              const catColor = DOC_CATEGORY_COLORS[cls.category] || '#9CA3AF';
              return (
                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: catColor,
                    color: 'white',
                    padding: '3px 12px',
                    borderRadius: '12px',
                    letterSpacing: '0.3px',
                  }}>
                    {cls.category} — {DOC_CATEGORY_LABELS[cls.category] || cls.category}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {cls.method === 'filename' ? 'Rozpoznáno z názvu souboru' :
                     cls.method === 'keywords' ? 'Rozpoznáno z obsahu' :
                     'Rozpoznáno pomocí AI'}
                    {' '}({(cls.confidence * 100).toFixed(0)}%)
                  </span>
                  {cls.detected_keywords && cls.detected_keywords.length > 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      [{cls.detected_keywords.slice(0, 3).join(', ')}]
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Document header */}
            <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {passportData.passport.project_name}
            </h3>
            {(passportData.passport as any).document_type && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                {(passportData.passport as any).document_type}
              </div>
            )}
            {passportData.passport.structure_type && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Typ konstrukce: <strong>{passportData.passport.structure_type}</strong>
              </div>
            )}

            {/* Executive summary — flowing text */}
            {passportData.passport.description && (
              <p style={{ margin: '0 0 20px', lineHeight: 1.8, fontSize: '15px' }}>
                {passportData.passport.description}
              </p>
            )}

            {/* Technical highlights */}
            {passportData.passport.technical_highlights && passportData.passport.technical_highlights.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Technické hlavní body
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {passportData.passport.technical_highlights.map((hl, i) => (
                    <li key={i} style={{ marginBottom: '2px' }}>{hl}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings — inline alert strip */}
            {((passportData.passport as any).warnings || []).length > 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                borderLeft: '3px solid #EF4444',
                borderRadius: '0 6px 6px 0',
                padding: '10px 16px',
                marginBottom: '20px',
              }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#EF4444', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} />
                  Upozornění
                </div>
                {((passportData.passport as any).warnings || []).map((w: string, i: number) => (
                  <div key={i} style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px' }}>{w}</div>
                ))}
              </div>
            )}

            {/* === ADAPTIVE SUMMARY TOPICS — flowing text with inline tables === */}
            {((passportData as any).analysis_mode === 'summary_only' || (passportData as any).format === 'adaptive_v2') ? (
              <>
                {((passportData.passport as any).topics || []).map((topic: AdaptiveTopic, index: number) => (
                  <div key={index} style={{ marginBottom: '22px' }}>
                    {/* Topic heading — inline with importance accent */}
                    <h4 style={{
                      margin: '0 0 6px',
                      fontSize: '15px',
                      fontWeight: 600,
                      color: topic.importance === 'high' ? 'var(--accent-primary)' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <span>{topic.icon}</span>
                      {topic.title}
                      {topic.importance === 'high' && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          background: 'var(--accent-primary)',
                          color: 'white',
                          padding: '1px 6px',
                          borderRadius: '8px',
                        }}>
                          klíčové
                        </span>
                      )}
                    </h4>

                    {/* Topic content — flowing paragraph */}
                    <p style={{ margin: '0 0 8px', lineHeight: 1.8 }}>
                      {topic.content}
                    </p>

                    {/* Key facts as compact table */}
                    {topic.key_facts && topic.key_facts.length > 0 && (
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px',
                        marginBottom: '4px',
                      }}>
                        <tbody>
                          {topic.key_facts.map((fact, i) => (
                            <tr key={i}>
                              <td style={{
                                padding: '4px 10px',
                                borderBottom: '1px solid rgba(0,0,0,0.06)',
                                color: 'var(--text-secondary)',
                                verticalAlign: 'top',
                              }}>
                                <span style={{ color: topic.importance === 'high' ? 'var(--accent-primary)' : '#64748b', fontWeight: 500 }}>
                                  {fact}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <>
                {/* === STRUCTURED PASSPORT — tables for structured data === */}

                {/* Statistics table */}
                {(passportData?.statistics?.total_concrete_m3 || passportData?.statistics?.total_reinforcement_t ||
                  passportData?.statistics?.unique_concrete_classes || passportData?.statistics?.unique_steel_grades) && (
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '24px',
                    fontSize: '14px',
                  }}>
                    <thead>
                      <tr>
                        <th colSpan={2} style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          borderBottom: '2px solid var(--accent-primary)',
                        }}>
                          Souhrnné údaje
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(passportData?.statistics?.total_concrete_m3 ?? 0) > 0 && (
                        <tr>
                          <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>Beton celkem</td>
                          <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                            {formatNumber(passportData.statistics!.total_concrete_m3)} m³
                          </td>
                        </tr>
                      )}
                      {(passportData?.statistics?.total_reinforcement_t ?? 0) > 0 && (
                        <tr>
                          <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>Výztuž celkem</td>
                          <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontWeight: 600 }}>
                            {formatNumber(passportData.statistics!.total_reinforcement_t)} t
                          </td>
                        </tr>
                      )}
                      {(passportData?.statistics?.unique_concrete_classes ?? 0) > 0 && (
                        <tr>
                          <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>Třídy betonu</td>
                          <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontWeight: 600 }}>
                            {passportData.statistics!.unique_concrete_classes}
                          </td>
                        </tr>
                      )}
                      {(passportData?.statistics?.unique_steel_grades ?? 0) > 0 && (
                        <tr>
                          <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>Ocelové třídy</td>
                          <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontWeight: 600 }}>
                            {passportData.statistics!.unique_steel_grades}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* Concrete specifications table */}
                {passportData.passport.concrete_specifications.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                      borderBottom: '2px solid var(--accent-primary)',
                      paddingBottom: '6px',
                    }}>
                      Specifikace betonu
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
                          <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Třída</th>
                          <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Expozice</th>
                          <th style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Objem</th>
                          <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Vlastnosti</th>
                        </tr>
                      </thead>
                      <tbody>
                        {passportData.passport.concrete_specifications.map((spec, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--accent-primary)' }}>{spec.concrete_class}</td>
                            <td style={{ padding: '6px 10px' }}>{spec.exposure_classes?.join(', ') || '—'}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>{spec.volume_m3 !== null ? `${formatNumber(spec.volume_m3)} m³` : '—'}</td>
                            <td style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>{spec.special_properties?.join(', ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Reinforcement table */}
                {passportData.passport.reinforcement.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                      borderBottom: '2px solid #64748b',
                      paddingBottom: '6px',
                    }}>
                      Výztuž
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
                          <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Třída oceli</th>
                          <th style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Hmotnost</th>
                          <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Průměry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {passportData.passport.reinforcement.map((steel, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            <td style={{ padding: '6px 10px', fontWeight: 600 }}>{steel.steel_grade}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>{steel.tonnage_t !== null ? `${formatNumber(steel.tonnage_t)} t` : '—'}</td>
                            <td style={{ padding: '6px 10px', fontSize: '12px' }}>{steel.bar_diameters.length > 0 ? steel.bar_diameters.join(', ') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Dimensions — compact key-value table */}
                {passportData.passport.dimensions && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                      borderBottom: '2px solid #F59E0B',
                      paddingBottom: '6px',
                    }}>
                      Rozměry objektu
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <tbody>
                        {passportData.passport.dimensions.floors_above_ground !== null && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Nadzemní podlaží</td><td style={{ padding: '4px 10px', fontWeight: 600, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{passportData.passport.dimensions.floors_above_ground} NP</td></tr>
                        )}
                        {passportData.passport.dimensions.floors_underground !== null && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Podzemní podlaží</td><td style={{ padding: '4px 10px', fontWeight: 600, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{passportData.passport.dimensions.floors_underground} PP</td></tr>
                        )}
                        {passportData.passport.dimensions.height_m !== null && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Výška</td><td style={{ padding: '4px 10px', fontWeight: 600, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{formatNumber(passportData.passport.dimensions.height_m)} m</td></tr>
                        )}
                        {passportData.passport.dimensions.length_m !== null && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Délka</td><td style={{ padding: '4px 10px', fontWeight: 600, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{formatNumber(passportData.passport.dimensions.length_m)} m</td></tr>
                        )}
                        {passportData.passport.dimensions.width_m !== null && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Šířka</td><td style={{ padding: '4px 10px', fontWeight: 600, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{formatNumber(passportData.passport.dimensions.width_m)} m</td></tr>
                        )}
                        {passportData.passport.dimensions.built_up_area_m2 !== null && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Zastavěná plocha</td><td style={{ padding: '4px 10px', fontWeight: 600, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{formatNumber(passportData.passport.dimensions.built_up_area_m2)} m²</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Special requirements — flowing text */}
                {passportData.passport.special_requirements.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                      borderBottom: '2px solid #FF9F1C',
                      paddingBottom: '6px',
                    }}>
                      Speciální požadavky
                    </div>
                    {passportData.passport.special_requirements.map((req, i) => (
                      <div key={i} style={{ marginBottom: '8px', paddingLeft: '10px', borderLeft: '2px solid #FF9F1C' }}>
                        <strong>{req.requirement_type}</strong>
                        {req.standard && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>({req.standard})</span>}
                        <span style={{ marginLeft: '6px' }}>— {req.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Risks table — color-coded severity */}
                {passportData.passport.risks.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                      borderBottom: '2px solid #EF4444',
                      paddingBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                      Hodnocení rizik (AI)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
                          <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)', width: '8px' }}></th>
                          <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Kategorie</th>
                          <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Popis</th>
                          <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Zmírnění</th>
                        </tr>
                      </thead>
                      <tbody>
                        {passportData.passport.risks.map((risk, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            <td style={{ padding: '6px 4px' }}>
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: risk.severity === 'High' ? '#EF4444' : risk.severity === 'Medium' ? '#F59E0B' : '#10B981',
                              }} />
                            </td>
                            <td style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{risk.risk_category}</td>
                            <td style={{ padding: '6px 10px' }}>{risk.description}</td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '12px' }}>{risk.mitigation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Location + Timeline + Stakeholders — compact flowing text */}
                {(passportData.passport.location || passportData.passport.timeline || passportData.passport.stakeholders.length > 0) && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                      borderBottom: '2px solid #6366F1',
                      paddingBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                      Další informace (AI)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <tbody>
                        {passportData.passport.location?.city && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)', width: '140px' }}>Město</td><td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{passportData.passport.location.city}</td></tr>
                        )}
                        {passportData.passport.location?.region && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Kraj</td><td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{passportData.passport.location.region}</td></tr>
                        )}
                        {passportData.passport.location?.address && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Adresa</td><td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{passportData.passport.location.address}</td></tr>
                        )}
                        {passportData.passport.timeline?.start_date && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Zahájení</td><td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{formatDate(passportData.passport.timeline.start_date)}</td></tr>
                        )}
                        {passportData.passport.timeline?.end_date && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Dokončení</td><td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{formatDate(passportData.passport.timeline.end_date)}</td></tr>
                        )}
                        {passportData.passport.timeline?.duration_months != null && (
                          <tr><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Délka trvání</td><td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{passportData.passport.timeline.duration_months} měsíců</td></tr>
                        )}
                        {passportData.passport.stakeholders.map((s, i) => (
                          <tr key={i}><td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{s.role}</td><td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{s.name}</td></tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Critical milestones as flowing list */}
                    {passportData.passport.timeline?.critical_milestones && passportData.passport.timeline.critical_milestones.length > 0 && (
                      <div style={{ marginTop: '10px', paddingLeft: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Milníky: </span>
                        <span style={{ fontSize: '13px' }}>
                          {passportData.passport.timeline.critical_milestones.join(' — ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* === TYPE-SPECIFIC EXTRACTIONS === */}

            {/* Technical Report (TZ) */}
            {(passportData as any).technical && (() => {
              const t = (passportData as any).technical;
              const rows: [string, string][] = [];
              if (t.structure_type) rows.push(['Typ konstrukce', t.structure_type]);
              if (t.structure_subtype) rows.push(['Podtyp', t.structure_subtype]);
              if (t.total_length_m) rows.push(['Délka', `${t.total_length_m} m`]);
              if (t.width_m) rows.push(['Šířka', `${t.width_m} m`]);
              if (t.height_m) rows.push(['Výška', `${t.height_m} m`]);
              if (t.area_m2) rows.push(['Plocha', `${t.area_m2} m²`]);
              if (t.volume_m3) rows.push(['Objem', `${t.volume_m3} m³`]);
              if (t.span_count) rows.push(['Počet polí', `${t.span_count}`]);
              if (t.span_lengths_m?.length) rows.push(['Rozpětí', t.span_lengths_m.map((v: number) => `${v} m`).join(', ')]);
              if (t.concrete_grade) rows.push(['Beton', t.concrete_grade]);
              if (t.reinforcement_grade) rows.push(['Výztuž', t.reinforcement_grade]);
              if (t.foundation_type) rows.push(['Základy', t.foundation_type]);
              if (t.fabrication_method) rows.push(['Výstavba', t.fabrication_method]);
              if (t.load_class) rows.push(['Zatížení', t.load_class]);
              if (t.design_life_years) rows.push(['Životnost', `${t.design_life_years} let`]);
              if (t.construction_duration_months) rows.push(['Doba výstavby', `${t.construction_duration_months} měsíců`]);
              if (t.applicable_standards?.length) rows.push(['Normy', t.applicable_standards.join(', ')]);
              if (t.special_conditions?.length) rows.push(['Speciální podmínky', t.special_conditions.join('; ')]);
              if (rows.length === 0) return null;
              return (
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', borderBottom: '2px solid #3B82F6', paddingBottom: '6px' }}>
                    Technické parametry (AI extrakce)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <tbody>
                      {rows.map(([label, value], i) => (
                        <tr key={i}>
                          <td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)', width: '160px' }}>{label}</td>
                          <td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Bill of Quantities (RO) */}
            {(passportData as any).bill_of_quantities && (() => {
              const b = (passportData as any).bill_of_quantities;
              const rows: [string, string][] = [];
              if (b.total_items) rows.push(['Počet položek', `${b.total_items}`]);
              if (b.total_price_czk) rows.push(['Celková cena', `${b.total_price_czk.toLocaleString('cs-CZ')} Kč`]);
              if (b.concrete_volume_m3) rows.push(['Beton', `${b.concrete_volume_m3} m³`]);
              if (b.steel_tonnage_t) rows.push(['Výztuž', `${b.steel_tonnage_t} t`]);
              if (b.earthwork_volume_m3) rows.push(['Zemní práce', `${b.earthwork_volume_m3} m³`]);
              if (rows.length === 0) return null;
              return (
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', borderBottom: '2px solid #10B981', paddingBottom: '6px' }}>
                    Rozpočet — souhrn (AI extrakce)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <tbody>
                      {rows.map(([label, value], i) => (
                        <tr key={i}>
                          <td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)', width: '160px' }}>{label}</td>
                          <td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {b.categories?.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '10px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
                          <th style={{ textAlign: 'left', padding: '4px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Kategorie</th>
                          <th style={{ textAlign: 'right', padding: '4px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Cena</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.categories.map((cat: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            <td style={{ padding: '4px 10px' }}>{cat.name}</td>
                            <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: 500 }}>
                              {cat.price_czk ? `${Number(cat.price_czk).toLocaleString('cs-CZ')} Kč` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })()}

            {/* Tender Conditions (PD) */}
            {(passportData as any).tender_conditions && (() => {
              const p = (passportData as any).tender_conditions;
              const rows: [string, string][] = [];
              if (p.tender_name) rows.push(['Název zakázky', p.tender_name]);
              if (p.contracting_authority) rows.push(['Zadavatel', p.contracting_authority]);
              if (p.submission_deadline) rows.push(['Termín podání', p.submission_deadline]);
              if (p.question_deadline) rows.push(['Termín pro dotazy', p.question_deadline]);
              if (p.estimated_budget) rows.push(['Předpokládaná hodnota', `${Number(p.estimated_budget).toLocaleString('cs-CZ')} ${p.currency || 'CZK'}`]);
              if (p.submission_method) rows.push(['Způsob podání', p.submission_method]);
              if (rows.length === 0) return null;
              return (
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', borderBottom: '2px solid #8B5CF6', paddingBottom: '6px' }}>
                    Zadávací podmínky (AI extrakce)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <tbody>
                      {rows.map(([label, value], i) => (
                        <tr key={i}>
                          <td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)', width: '180px' }}>{label}</td>
                          <td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {p.qualification_criteria?.length > 0 && (
                    <div style={{ marginTop: '8px', paddingLeft: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Kvalifikace: </span>
                      <span style={{ fontSize: '13px' }}>{p.qualification_criteria.join('; ')}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Schedule (HA) */}
            {(passportData as any).schedule && (() => {
              const s = (passportData as any).schedule;
              const rows: [string, string][] = [];
              if (s.total_duration_months) rows.push(['Celková doba', `${s.total_duration_months} měsíců`]);
              if (s.start_date) rows.push(['Zahájení', s.start_date]);
              if (s.end_date) rows.push(['Dokončení', s.end_date]);
              if (rows.length === 0 && !s.phases?.length && !s.milestones?.length) return null;
              return (
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', borderBottom: '2px solid #EC4899', paddingBottom: '6px' }}>
                    Harmonogram (AI extrakce)
                  </div>
                  {rows.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <tbody>
                        {rows.map(([label, value], i) => (
                          <tr key={i}>
                            <td style={{ padding: '4px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(0,0,0,0.06)', width: '160px' }}>{label}</td>
                            <td style={{ padding: '4px 10px', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {s.phases?.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '10px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
                          <th style={{ textAlign: 'left', padding: '4px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Etapa</th>
                          <th style={{ textAlign: 'left', padding: '4px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-tertiary)' }}>Trvání</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.phases.map((phase: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            <td style={{ padding: '4px 10px' }}>{phase.name}</td>
                            <td style={{ padding: '4px 10px' }}>{phase.duration || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {s.milestones?.length > 0 && (
                    <div style={{ marginTop: '8px', paddingLeft: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Milníky: </span>
                      <span style={{ fontSize: '13px' }}>
                        {s.milestones.map((m: any) => `${m.name}${m.date ? ` (${m.date})` : ''}`).join(' — ')}
                      </span>
                    </div>
                  )}
                  {s.critical_path?.length > 0 && (
                    <div style={{ marginTop: '6px', paddingLeft: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#EF4444', textTransform: 'uppercase' }}>Kritická cesta: </span>
                      <span style={{ fontSize: '13px' }}>{s.critical_path.join(' → ')}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Metadata */}
          <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'right' }}>
            Soubor: {passportData?.metadata?.file_name || '—'} | ID: {passportData.passport.passport_id} | Vygenerováno: {new Date(passportData.passport.generated_at).toLocaleString('cs-CZ')}
          </div>

          {/* v5.0: Soupis Prací — parsed positions from universal_parser */}
          {(passportData as any)?.soupis_praci && (() => {
            const soupis = (passportData as any).soupis_praci;
            return (
              <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-secondary, #f8f9fa)', borderRadius: '8px', border: '1px solid var(--border-primary, #e0e0e0)' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📋</span> Soupis prací
                  <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>
                    {soupis.positions_count} položek | {soupis.format} | pokrytí {soupis.coverage_pct}%
                  </span>
                </h3>

                {soupis.stavebni_objekty?.map((so: any, soIdx: number) => (
                  <div key={soIdx} style={{ marginBottom: '12px' }}>
                    {soupis.so_count > 1 && (
                      <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text-primary)' }}>
                        {so.so_id} — {so.so_name}
                      </h4>
                    )}

                    {so.chapters?.map((ch: any, chIdx: number) => (
                      <div key={chIdx} style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, padding: '4px 8px', background: 'var(--bg-tertiary, #eee)', borderRadius: '4px', marginBottom: '4px' }}>
                          {ch.code} — {ch.name}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-primary, #ddd)', textAlign: 'left' }}>
                              <th style={{ padding: '3px 6px', width: '35px' }}>PČ</th>
                              <th style={{ padding: '3px 6px', width: '90px' }}>Kód</th>
                              <th style={{ padding: '3px 6px' }}>Popis</th>
                              <th style={{ padding: '3px 6px', width: '35px' }}>MJ</th>
                              <th style={{ padding: '3px 6px', width: '70px', textAlign: 'right' }}>Množství</th>
                              <th style={{ padding: '3px 6px', width: '70px', textAlign: 'right' }}>J.cena</th>
                              <th style={{ padding: '3px 6px', width: '80px', textAlign: 'right' }}>Celkem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ch.positions?.slice(0, 50).map((p: any, pIdx: number) => (
                              <tr key={pIdx} style={{ borderBottom: '1px solid var(--border-secondary, #eee)' }}>
                                <td style={{ padding: '3px 6px', color: '#999', fontFamily: 'monospace', fontSize: '11px' }}>{p.pc || ''}</td>
                                <td style={{ padding: '3px 6px', fontFamily: 'monospace', fontSize: '11px' }}>
                                  {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1565c0' }}>{p.code}</a> : p.code}
                                </td>
                                <td style={{ padding: '3px 6px' }}>
                                  <div style={{ fontWeight: 500, fontSize: '12px' }}>{p.description}</div>
                                  {p.specification && <div style={{ fontSize: '10px', color: '#888', marginTop: '1px' }}>{p.specification.substring(0, 80)}</div>}
                                </td>
                                <td style={{ padding: '3px 6px', color: '#666' }}>{p.unit}</td>
                                <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                                  {p.quantity != null ? new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 3 }).format(p.quantity) : '—'}
                                </td>
                                <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                                  {p.unit_price != null ? new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(p.unit_price) : '—'}
                                </td>
                                <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>
                                  {p.total_price != null ? new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(p.total_price) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {ch.positions?.length > 50 && (
                          <div style={{ fontSize: '11px', color: '#999', padding: '4px 6px' }}>
                            ... a dalších {ch.positions.length - 50} položek
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                {soupis.warnings?.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#f57c00', marginTop: '8px' }}>
                    {soupis.warnings.map((w: string, i: number) => <div key={i}>⚠️ {w}</div>)}
                  </div>
                )}
              </div>
            );
          })()}
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
