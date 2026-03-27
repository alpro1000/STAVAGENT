/**
 * DocumentAnalysis — Unified document analysis module.
 *
 * Single upload → system detects format → results in tabs:
 * 1. Soupis prací (positions, chapters, SO) — from universal_parser
 * 2. Passport (technical parameters) — from SmartParser
 * 3. AI Audit (Multi-Role analysis) — from workflow C
 * 4. Shrnutí (adaptive summary) — text
 *
 * Replaces: DocumentSummary.tsx, ProjectAudit modal, ProjectDocuments modal, SoupisPanel modal
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
import type { PassportGenerationResponse, AIModelType } from '../../../types/passport';
import { AI_MODELS, AI_MODEL_OPTIONS } from '../../../types/passport';
import type { ProjectAnalysisData } from '../ProjectAnalysis';
import ProjectAnalysis from '../ProjectAnalysis';
import SoupisTab from './SoupisTab';
import type { ParseResult } from './SoupisTab';
import PassportTab from './PassportTab';
import AuditTab from './AuditTab';
import SummaryTab from './SummaryTab';
import styles from './DocumentAnalysis.module.css';
import { API_URL } from '../../../services/api';

const CORE_API_URL = `${API_URL}/api/core`;
const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'xml', 'docx', 'csv'];

type TabId = 'soupis' | 'passport' | 'audit' | 'summary' | 'project';

interface DocumentAnalysisProps {
  onClose?: () => void;
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function isVertexModel(model: AIModelType): boolean {
  return model === AI_MODELS.VERTEX_AI_GEMINI;
}

export default function DocumentAnalysis({ onClose }: DocumentAnalysisProps) {
  /* ── State ── */
  const [activeTab, setActiveTab] = useState<TabId>('soupis');

  // Upload & processing
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // AI config
  const [selectedModel, setSelectedModel] = useState<AIModelType>('gemini');
  const [enableAiEnrichment, setEnableAiEnrichment] = useState(true);
  const [analysisMode, setAnalysisMode] = useState<'adaptive_extraction' | 'summary_only' | 'project_analysis'>('adaptive_extraction');

  // Results
  const [passportData, setPassportData] = useState<PassportGenerationResponse | null>(null);
  const [projectData, setProjectData] = useState<ProjectAnalysisData | null>(null);
  const [soupisData, setSoupisData] = useState<ParseResult | null>(null);

  // Save to project
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; name: string }>>([]);

  // Google Drive
  const [googleAuth, setGoogleAuth] = useState({ isAuthorized: false, isLoading: false, userId: 'user_default' });
  const [googleFolders, setGoogleFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGoogleFolder, setSelectedGoogleFolder] = useState('');
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasResults = !!(passportData || projectData || soupisData);

  /* ── Load projects ── */
  useEffect(() => {
    (async () => {
      try {
        const portalApiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${portalApiUrl}/api/portal-projects`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          const projects = Array.isArray(data) ? data : (data.projects || []);
          setAvailableProjects(projects.map((p: any) => ({
            id: p.portal_project_id || p.id,
            name: p.project_name || 'Unnamed',
          })));
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    })();
  }, []);

  /* ── ESC to close ── */
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose && !isUploading) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, isUploading]);

  /* ── Upload handlers ── */
  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    setPassportData(null);
    setProjectData(null);
    setSoupisData(null);
    setSaveSuccess(false);
    setUploadedFile(file);

    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Nepodporovaný formát ${ext || 'souboru'}. Povolené: PDF, XLSX, XLS, XML, DOCX, CSV.`);
      setIsUploading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_name', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('enable_ai_enrichment', enableAiEnrichment.toString());
      if (enableAiEnrichment) {
        formData.append('preferred_model', selectedModel);
        formData.append('requested_model', selectedModel);
      }
      formData.append('analysis_mode', analysisMode);
      if (enableAiEnrichment && isVertexModel(selectedModel)) {
        formData.append('llm_provider', 'vertex-ai');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch(`${CORE_API_URL}/passport/generate`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let msg = errorData?.detail || `HTTP ${response.status}`;
        if (response.status === 404) msg = 'API endpoint nenalezen. Zkontrolujte, zda je concrete-agent spuštěn.';
        else if (response.status === 500) msg = 'Chyba serveru při zpracování souboru.';
        else if (response.status === 413) msg = 'Soubor je příliš velký (max 100 MB).';
        throw new Error(msg);
      }

      const data: PassportGenerationResponse = await response.json();
      if (data?.success === false) {
        throw new Error((data as any)?.detail || (data as any)?.error || (data as any)?.metadata?.error || 'Generování pasportu selhalo.');
      }
      if (data?.passport) {
        setPassportData({ ...data, success: true });
        // If soupis_praci present, populate SoupisTab
        if ((data as any)?.soupis_praci) {
          setSoupisData((data as any).soupis_praci as ParseResult);
          setActiveTab('soupis');
        } else {
          setActiveTab('passport');
        }
      } else {
        throw new Error('Generování pasportu selhalo.');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.name === 'AbortError'
          ? 'Zpracování trvá příliš dlouho (timeout 5 minut).'
          : err.message);
      } else {
        setError('Neznámá chyba při zpracování');
      }
    } finally {
      setIsUploading(false);
    }
  }, [selectedModel, enableAiEnrichment, analysisMode]);

  const handleProjectUpload = useCallback(async (files: File[]) => {
    setIsUploading(true);
    setError(null);
    setPassportData(null);
    setProjectData(null);
    setSoupisData(null);
    setSaveSuccess(false);

    try {
      const formData = new FormData();
      for (const file of files) formData.append('files', file);
      formData.append('project_name', files[0].name.replace(/\.[^/.]+$/, ''));
      formData.append('enable_ai_enrichment', enableAiEnrichment.toString());
      if (enableAiEnrichment) formData.append('preferred_model', selectedModel);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);

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
      if (data?.success === false) throw new Error('Zpracování projektu selhalo.');
      setProjectData(data);
      setActiveTab('project');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.name === 'AbortError' ? 'Timeout 10 minut.' : err.message);
      } else {
        setError('Neznámá chyba');
      }
    } finally {
      setIsUploading(false);
    }
  }, [selectedModel, enableAiEnrichment]);

  /* ── Drag & drop ── */
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (analysisMode === 'project_analysis') {
        handleProjectUpload(Array.from(files));
      } else {
        handleFileUpload(files[0]);
      }
    }
    e.target.value = '';
  }, [handleFileUpload, handleProjectUpload, analysisMode]);

  /* ── Save to project ── */
  const handleSaveToProject = useCallback(async () => {
    if (!uploadedFile || !selectedProjectId) { setError('Vyberte projekt před uložením'); return; }
    setIsSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('project_id', selectedProjectId);
      formData.append('file', uploadedFile);
      const response = await fetch(`${CORE_API_URL}/accumulator/files/upload`, { method: 'POST', body: formData });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }
      else throw new Error('Save failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [uploadedFile, selectedProjectId]);

  /* ── Google Drive ── */
  const loadGoogleFolders = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`${CORE_API_URL}/google/folders?user_id=${userId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setGoogleFolders(await response.json());
    } catch (err) {
      console.error('Failed to load Google Drive folders:', err);
    }
  }, []);

  const handleGoogleAuth = useCallback(async () => {
    setGoogleAuth(prev => ({ ...prev, isLoading: true }));
    try {
      const authUrl = `${CORE_API_URL}/google/auth?user_id=${googleAuth.userId}`;
      const popup = window.open(authUrl, 'GoogleDriveAuth', 'width=600,height=700,left=200,top=100');
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== new URL(CORE_API_URL).origin) return;
        if (event.data.type === 'google_auth_success') {
          setGoogleAuth(prev => ({ ...prev, isAuthorized: true, isLoading: false }));
          await loadGoogleFolders(googleAuth.userId);
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) popup.close();
        } else if (event.data.type === 'google_auth_error') {
          setError(`Autorizace selhala: ${event.data.error}`);
          setGoogleAuth(prev => ({ ...prev, isLoading: false }));
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
      const checkClosed = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(checkClosed);
          if (!googleAuth.isAuthorized) setGoogleAuth(prev => ({ ...prev, isLoading: false }));
          window.removeEventListener('message', handleMessage);
        }
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autorizace selhala');
      setGoogleAuth(prev => ({ ...prev, isLoading: false }));
    }
  }, [googleAuth.userId, googleAuth.isAuthorized, loadGoogleFolders]);

  const handleUploadToDrive = useCallback(async () => {
    if (!uploadedFile || !selectedGoogleFolder) { setError('Vyberte složku Google Drive'); return; }
    setIsUploadingToDrive(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('user_id', googleAuth.userId);
      formData.append('folder_id', selectedGoogleFolder);
      formData.append('file', uploadedFile);
      const response = await fetch(`${CORE_API_URL}/google/upload`, { method: 'POST', body: formData });
      if (!response.ok) { const errData = await response.json().catch(() => null); throw new Error(errData?.detail || `HTTP ${response.status}`); }
      const data = await response.json();
      if (data.success) { setDriveUploadSuccess(true); setTimeout(() => setDriveUploadSuccess(false), 3000); }
      else throw new Error('Nahrání do Google Drive selhalo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nahrání selhalo');
    } finally {
      setIsUploadingToDrive(false);
    }
  }, [uploadedFile, selectedGoogleFolder, googleAuth.userId]);

  /* ── CSV export ── */
  const exportToCsv = useCallback(() => {
    if (!passportData) return;
    const { passport } = passportData;
    const rows: string[][] = [];
    rows.push(['=== SPECIFIKACE BETONU ===']);
    passport.concrete_specifications.forEach(spec => {
      rows.push([spec.concrete_class, spec.exposure_classes.join(' '), spec.volume_m3?.toString() || '-', spec.special_properties.join(', ')]);
    });
    rows.push([], ['=== VÝZTUŽ ===']);
    passport.reinforcement.forEach(steel => {
      rows.push([steel.steel_grade, `${steel.tonnage_t || '-'} t`, steel.bar_diameters.join(', ')]);
    });
    if (passport.special_requirements.length > 0) {
      rows.push([], ['=== SPECIÁLNÍ POŽADAVKY ===']);
      passport.special_requirements.forEach(req => {
        rows.push([req.requirement_type, req.description, req.standard || '-']);
      });
    }
    const csv = rows.map(row => row.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${passport.project_name || 'passport'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [passportData]);

  /* ── Reset ── */
  const handleReset = () => {
    setPassportData(null);
    setProjectData(null);
    setSoupisData(null);
    setUploadedFile(null);
    setError(null);
    setSaveSuccess(false);
    setActiveTab('soupis');
  };

  /* ── Tabs config ── */
  const tabs: Array<{ id: TabId; label: string; show: boolean; badge?: number; badgeColor?: string }> = [
    { id: 'soupis', label: 'Soupis prací', show: true },
    { id: 'passport', label: 'Passport', show: true },
    { id: 'audit', label: 'AI Audit', show: true },
    { id: 'summary', label: 'Shrnutí', show: !!passportData },
    { id: 'project', label: `Projektová analýza (${projectData?.merged_sos?.length || 0} SO)`, show: !!projectData },
  ];

  const visibleTabs = tabs.filter(t => t.show);

  /* ── Render ── */
  return (
    <div
      className={styles.overlay}
      onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Analýza dokumentů"
    >
      <div className={styles.container} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            <FileSpreadsheet size={24} />
            Analýza dokumentů
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {hasResults && (
              <button onClick={handleReset} className="c-btn c-btn--ghost c-btn--sm">Nový dokument</button>
            )}
            {onClose && (
              <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
            )}
          </div>
        </div>

        {/* AI Configuration — only before upload */}
        {!hasResults && !isUploading && (
          <div className={styles.configPanel}>
            <h3 className={styles.configTitle}><Zap size={16} /> Konfigurace AI obohacení</h3>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
              <input type="checkbox" checked={enableAiEnrichment} onChange={e => setEnableAiEnrichment(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 14 }}>Povolit AI obohacení (rizika, lokace, časový plán)</span>
            </label>

            <div className={styles.configRow}>
              <label className={styles.configLabel}>Režim:</label>
              <select value={analysisMode} onChange={e => setAnalysisMode(e.target.value as any)} className="c-input" style={{ flex: 1, maxWidth: 300 }}>
                <option value="adaptive_extraction">Strukturovaný pasport (beton, výztuž, rozměry)</option>
                <option value="summary_only">Adaptivní shrnutí (univerzální)</option>
                <option value="project_analysis">Projektová analýza (více dokumentů, SO merge)</option>
              </select>
            </div>

            {enableAiEnrichment && (
              <div className={styles.configRow}>
                <label className={styles.configLabel}>AI Model:</label>
                <select value={selectedModel} onChange={e => setSelectedModel(e.target.value as AIModelType)} className="c-input" style={{ flex: 1, maxWidth: 300 }}>
                  {AI_MODEL_OPTIONS.map(model => (
                    <option key={model.id} value={model.id}>{model.name} - {model.cost_per_passport} ({model.speed})</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.configHint}>
              {enableAiEnrichment
                ? AI_MODEL_OPTIONS.find(m => m.id === selectedModel)?.description
                : 'Pouze deterministická extrakce (Regex) — ZDARMA, 100% přesnost pro technické údaje'}
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

        {/* Upload zone — only when no results */}
        {!hasResults && (
          <div
            className={styles.uploadZone}
            data-active={isDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <Loader2 size={48} className={styles.spin} style={{ color: 'var(--accent-orange)' }} />
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  {analysisMode === 'project_analysis' ? 'Analyzuji projekt (více dokumentů)...' : 'Analyzuji dokument...'}
                </p>
              </div>
            ) : (
              <>
                <Upload size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                <p className={styles.uploadHint}>
                  {analysisMode === 'project_analysis' ? 'Přetáhněte dokumenty projektu sem' : 'Přetáhněte dokument sem'}
                </p>
                <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 14 }}>
                  {analysisMode === 'project_analysis' ? 'Více souborů najednou (TZ, výkresy, GTP, rozpočet...)' : 'nebo klikněte na tlačítko níže'}
                </p>
                <button onClick={() => fileInputRef.current?.click()} className="c-btn c-btn--primary" style={{ marginBottom: 16 }}>
                  <Upload size={16} style={{ marginRight: 8 }} />
                  Vybrat soubor
                </button>
                <p className={styles.uploadFormats}>Podporované formáty: PDF, XLSX, XLS, XML, DOCX, CSV</p>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && !hasResults && (
          <div className={styles.errorBox}>
            <div className={styles.errorTitle}>
              <AlertTriangle size={20} />
              <span>Chyba při zpracování</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>{error}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setError(null); setUploadedFile(null); }} className="c-btn c-btn--primary c-btn--sm">Zkusit znovu</button>
            </div>
          </div>
        )}

        {/* Results — tabs */}
        {hasResults && (
          <>
            {/* Action bar */}
            {passportData && (
              <div style={{ marginBottom: 16 }}>
                <div className={styles.metaLine}>
                  <CheckCircle size={20} style={{ color: 'var(--status-success)' }} />
                  <span>Vygenerováno za {typeof passportData?.metadata?.processing_time_seconds === 'number' ? `${passportData.metadata.processing_time_seconds.toFixed(2)}s` : '—'}</span>
                  <span className={styles.separator}>|</span>
                  <span>Spolehlivost: {typeof passportData?.metadata?.total_confidence === 'number' ? `${(passportData.metadata.total_confidence * 100).toFixed(0)}%` : '—%'}</span>
                  {(passportData?.statistics?.ai_enriched_fields ?? 0) > 0 && (
                    <>
                      <span className={styles.separator}>|</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={14} style={{ color: 'var(--accent-orange)' }} />
                        {passportData.statistics!.ai_enriched_fields} AI obohacení
                      </span>
                    </>
                  )}
                </div>

                <div className={styles.actionBar}>
                  <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="c-input" style={{ minWidth: 180, flex: '1 1 180px' }} disabled={isSaving}>
                    <option value="">Vyberte projekt...</option>
                    {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={handleSaveToProject} className="c-btn c-btn--primary" disabled={!selectedProjectId || isSaving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isSaving ? <><Loader2 size={16} className={styles.spin} /> Ukládám...</> :
                     saveSuccess ? <><CheckCircle size={16} /> Uloženo!</> :
                     <><Database size={16} /> Uložit do projektu</>}
                  </button>
                  <div style={{ borderLeft: '1px solid var(--border-default)', height: 32 }} />
                  {!googleAuth.isAuthorized ? (
                    <button onClick={handleGoogleAuth} className="c-btn c-btn--secondary" disabled={googleAuth.isLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {googleAuth.isLoading ? <><Loader2 size={16} className={styles.spin} /> Autorizuji...</> : <><Cloud size={16} /> Připojit Google Drive</>}
                    </button>
                  ) : (
                    <>
                      <select value={selectedGoogleFolder} onChange={e => setSelectedGoogleFolder(e.target.value)} className="c-input" style={{ minWidth: 160, flex: '1 1 160px' }} disabled={isUploadingToDrive || googleFolders.length === 0}>
                        <option value="">Vyberte složku Drive...</option>
                        {googleFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <button onClick={handleUploadToDrive} className="c-btn c-btn--secondary" disabled={!selectedGoogleFolder || isUploadingToDrive} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isUploadingToDrive ? <><Loader2 size={16} className={styles.spin} /> Nahrávám...</> :
                         driveUploadSuccess ? <><CheckCircle size={16} /> Nahráno!</> :
                         <><Cloud size={16} /> Nahrát do Drive</>}
                      </button>
                    </>
                  )}
                  <button onClick={exportToCsv} className="c-btn c-btn--secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Download size={16} /> Export CSV
                  </button>
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div className={styles.tabs}>
              {visibleTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                >
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className={styles.tabBadge} style={{ backgroundColor: tab.badgeColor || '#999' }}>{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'soupis' && <SoupisTab soupisData={soupisData} />}
            {activeTab === 'passport' && passportData && <PassportTab data={passportData} />}
            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'summary' && <SummaryTab data={passportData} />}
            {activeTab === 'project' && projectData && (
              <div style={{ marginTop: 16 }}>
                <ProjectAnalysis data={projectData} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
