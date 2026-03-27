/**
 * DocumentAnalysisPage — Full-page document analysis.
 *
 * Upload-first flow: user drops file → system auto-detects type → shows results.
 * No pre-upload configuration. AI model selected automatically (Vertex AI on Cloud Run).
 *
 * Route: /portal/analysis
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, CheckCircle, AlertTriangle, Loader2, Download,
  ArrowLeft, FileSpreadsheet, Database, Cloud, RotateCcw, FileText, Search,
} from 'lucide-react';
import type { PassportGenerationResponse } from '../types/passport';
import type { ProjectAnalysisData } from '../components/portal/ProjectAnalysis';
import ProjectAnalysis from '../components/portal/ProjectAnalysis';
import SoupisTab from '../components/portal/DocumentAnalysis/SoupisTab';
import type { ParseResult } from '../components/portal/DocumentAnalysis/SoupisTab';
import PassportTab from '../components/portal/DocumentAnalysis/PassportTab';
import AuditTab from '../components/portal/DocumentAnalysis/AuditTab';
import SummaryTab from '../components/portal/DocumentAnalysis/SummaryTab';
import { API_URL } from '../services/api';

const CORE_API_URL = `${API_URL}/api/core`;
const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'xml', 'docx', 'csv'];

type TabId = 'passport' | 'soupis' | 'audit' | 'summary' | 'project';

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

/** Detect what the file likely is, to show the user a human-readable label. */
function detectFileIntent(file: File): { label: string; icon: typeof FileText } {
  const ext = getFileExtension(file.name);
  const name = file.name.toLowerCase();
  if (['xlsx', 'xls'].includes(ext)) {
    if (name.includes('soupis') || name.includes('rozpoc') || name.includes('poloz'))
      return { label: 'Soupis prací (rozpočet)', icon: FileSpreadsheet };
    return { label: 'Excel dokument', icon: FileSpreadsheet };
  }
  if (ext === 'xml') return { label: 'XML soupis (OTSKP/TSKP)', icon: Database };
  if (ext === 'pdf') return { label: 'PDF dokument', icon: FileText };
  return { label: file.name, icon: FileText };
}

export default function DocumentAnalysisPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');

  // Results
  const [passportData, setPassportData] = useState<PassportGenerationResponse | null>(null);
  const [projectData, setProjectData] = useState<ProjectAnalysisData | null>(null);
  const [soupisData, setSoupisData] = useState<ParseResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('passport');

  // Save to project
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const hasResults = !!(passportData || projectData || soupisData);

  /* ── Upload single file ── */
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
      setError(`Nepodporovaný formát .${ext}. Povolené: PDF, XLSX, XLS, XML, DOCX, CSV.`);
      setIsUploading(false);
      return;
    }

    try {
      setUploadProgress('Nahrávám soubor...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_name', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('enable_ai_enrichment', 'true');
      formData.append('analysis_mode', 'adaptive_extraction');

      setUploadProgress(isSoupis ? 'Parsování tabulky...' : 'Analyzuji dokument...');

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

      setUploadProgress('Zpracovávám výsledky...');
      const data: PassportGenerationResponse = await response.json();

      if (data?.success === false) {
        throw new Error((data as any)?.detail || (data as any)?.error || 'Generování selhalo.');
      }

      if (data?.passport) {
        setPassportData({ ...data, success: true });
        if ((data as any)?.soupis_praci) {
          setSoupisData((data as any).soupis_praci as ParseResult);
          setActiveTab('soupis');
        } else {
          setActiveTab('passport');
        }
      } else {
        throw new Error('Generování selhalo — žádná data v odpovědi.');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.name === 'AbortError'
          ? 'Zpracování trvá příliš dlouho (timeout 5 minut). Zkuste menší soubor.'
          : err.message);
      } else {
        setError('Neznámá chyba při zpracování');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  }, []);

  /* ── Upload multiple files (project mode) ── */
  const handleProjectUpload = useCallback(async (files: File[]) => {
    setIsUploading(true);
    setError(null);
    setPassportData(null);
    setProjectData(null);
    setSoupisData(null);
    setSaveSuccess(false);
    setUploadedFile(files[0]);

    try {
      setUploadProgress(`Analyzuji ${files.length} dokumentů...`);
      const formData = new FormData();
      for (const file of files) formData.append('files', file);
      formData.append('project_name', files[0].name.replace(/\.[^/.]+$/, ''));
      formData.append('enable_ai_enrichment', 'true');

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
      setUploadProgress('');
    }
  }, []);

  /* ── Drag & drop ── */
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 1) {
      handleProjectUpload(Array.from(files));
    } else if (files.length === 1) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload, handleProjectUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 1) {
      handleProjectUpload(Array.from(files));
    } else if (files && files.length === 1) {
      handleFileUpload(files[0]);
    }
    e.target.value = '';
  }, [handleFileUpload, handleProjectUpload]);

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
    setActiveTab('passport');
    setUploadProgress('');
  };

  /* ── Tab config ── */
  const tabs: Array<{ id: TabId; label: string; show: boolean }> = [
    { id: 'passport', label: 'Passport dokumentu', show: !!passportData },
    { id: 'soupis', label: 'Soupis prací', show: !!soupisData },
    { id: 'audit', label: 'AI Audit', show: true },
    { id: 'summary', label: 'Shrnutí', show: !!passportData },
    { id: 'project', label: `Projektová analýza (${projectData?.merged_sos?.length || 0} SO)`, show: !!projectData },
  ];
  const visibleTabs = tabs.filter(t => t.show);

  /* ── Render ── */
  return (
    <div className="da-page">
      {/* Page header */}
      <header className="da-header">
        <button onClick={() => navigate('/portal')} className="da-back-btn">
          <ArrowLeft size={18} />
          <span>Portal</span>
        </button>
        <h1 className="da-page-title">
          <Search size={22} />
          Analýza dokumentů
        </h1>
        <div className="da-header-actions">
          {hasResults && (
            <button onClick={handleReset} className="c-btn c-btn--ghost c-btn--sm">
              <RotateCcw size={14} />
              Nový dokument
            </button>
          )}
        </div>
      </header>

      <main className="da-main">
        {/* ── Upload zone (before results) ── */}
        {!hasResults && !isUploading && !error && (
          <div
            className={`da-upload-zone ${isDragOver ? 'da-upload-zone--active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="da-upload-icon-ring">
              <Upload size={32} />
            </div>
            <h2 className="da-upload-title">Přetáhněte soubor sem</h2>
            <p className="da-upload-subtitle">
              nebo klikněte pro výběr souboru
            </p>
            <div className="da-upload-formats">
              <span className="da-format-tag">PDF</span>
              <span className="da-format-tag">XLSX</span>
              <span className="da-format-tag">XLS</span>
              <span className="da-format-tag">XML</span>
              <span className="da-format-tag">DOCX</span>
              <span className="da-format-tag">CSV</span>
            </div>
            <p className="da-upload-hint">
              Více souborů najednou = projektová analýza s SO merge
            </p>
          </div>
        )}

        {/* ── Processing spinner ── */}
        {isUploading && (
          <div className="da-processing">
            <div className="da-processing-card">
              <Loader2 size={40} className="da-spin" />
              <h3 className="da-processing-title">{uploadProgress || 'Zpracovávám...'}</h3>
              {uploadedFile && (
                <div className="da-processing-file">
                  {(() => { const d = detectFileIntent(uploadedFile); return <><d.icon size={16} /> {d.label}</>; })()}
                </div>
              )}
              <p className="da-processing-hint">Analýza může trvat 10–60 sekund</p>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && !hasResults && (
          <div className="da-error-card">
            <div className="da-error-icon">
              <AlertTriangle size={24} />
            </div>
            <h3 className="da-error-title">Nepodařilo se zpracovat</h3>
            <p className="da-error-message">{error}</p>
            <button onClick={() => { setError(null); setUploadedFile(null); }} className="c-btn c-btn--primary">
              Zkusit znovu
            </button>
          </div>
        )}

        {/* ── Results ── */}
        {hasResults && (
          <div className="da-results">
            {/* Meta bar */}
            {passportData && (
              <div className="da-meta-bar">
                <div className="da-meta-item da-meta-item--success">
                  <CheckCircle size={16} />
                  <span>
                    {typeof passportData?.metadata?.processing_time_seconds === 'number'
                      ? `${passportData.metadata.processing_time_seconds.toFixed(1)}s`
                      : '—'}
                  </span>
                </div>
                <div className="da-meta-item">
                  <span className="da-meta-label">Spolehlivost</span>
                  <span className="da-meta-value">
                    {typeof passportData?.metadata?.total_confidence === 'number'
                      ? `${(passportData.metadata.total_confidence * 100).toFixed(0)}%`
                      : '—'}
                  </span>
                </div>
                {soupisData && (
                  <div className="da-meta-item">
                    <span className="da-meta-label">Pozice</span>
                    <span className="da-meta-value">{soupisData.positions_count}</span>
                  </div>
                )}
                <div className="da-meta-spacer" />
                <button onClick={exportToCsv} className="c-btn c-btn--ghost c-btn--sm">
                  <Download size={14} /> Export CSV
                </button>
              </div>
            )}

            {/* Tab bar */}
            <div className="da-tabs">
              {visibleTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`da-tab ${activeTab === tab.id ? 'da-tab--active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="da-tab-content">
              {activeTab === 'passport' && passportData && <PassportTab data={passportData} />}
              {activeTab === 'soupis' && <SoupisTab soupisData={soupisData} />}
              {activeTab === 'audit' && <AuditTab />}
              {activeTab === 'summary' && <SummaryTab data={passportData} />}
              {activeTab === 'project' && projectData && (
                <ProjectAnalysis data={projectData} />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Hidden file input */}
      <input
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept=".pdf,.xlsx,.xls,.xml,.docx,.csv"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <style>{documentAnalysisStyles}</style>
    </div>
  );
}

/* ── Embedded styles (page-level, not module CSS) ── */
const documentAnalysisStyles = `
.da-page {
  min-height: 100vh;
  background: var(--bg-app, #f0f1f2);
  display: flex;
  flex-direction: column;
}

/* Header */
.da-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 32px;
  background: var(--panel-clean, #eaebec);
  border-bottom: 1px solid var(--border-default, rgba(0,0,0,0.08));
}

.da-back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  font-size: 14px;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.15s;
}
.da-back-btn:hover { background: rgba(0,0,0,0.05); }

.da-page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.da-header-actions {
  display: flex;
  gap: 8px;
}

/* Main content */
.da-main {
  flex: 1;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: 32px;
}

/* ── Upload zone ── */
.da-upload-zone {
  border: 2px dashed var(--border-default, rgba(0,0,0,0.12));
  border-radius: 16px;
  padding: 80px 48px;
  text-align: center;
  background: var(--panel-clean, #eaebec);
  cursor: pointer;
  transition: all 0.25s ease;
}
.da-upload-zone:hover {
  border-color: var(--accent-orange, #FF9F1C);
  background: rgba(255, 159, 28, 0.03);
}
.da-upload-zone--active {
  border-color: var(--accent-orange, #FF9F1C);
  background: rgba(255, 159, 28, 0.06);
  transform: scale(1.005);
}

.da-upload-icon-ring {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 159, 28, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: var(--accent-orange, #FF9F1C);
}
.da-upload-zone:hover .da-upload-icon-ring {
  background: rgba(255, 159, 28, 0.14);
}

.da-upload-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.da-upload-subtitle {
  margin: 0 0 24px;
  font-size: 15px;
  color: var(--text-secondary, #6b7280);
}

.da-upload-formats {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.da-format-tag {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(0,0,0,0.04);
  color: var(--text-secondary, #6b7280);
  letter-spacing: 0.3px;
}

.da-upload-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted, #9ca3af);
}

/* ── Processing ── */
.da-processing {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}

.da-processing-card {
  text-align: center;
  padding: 48px;
  background: var(--panel-clean, #eaebec);
  border-radius: 16px;
  min-width: 360px;
}

.da-processing-title {
  margin: 20px 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.da-processing-file {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 8px;
}

.da-processing-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted, #9ca3af);
}

@keyframes da-spin { to { transform: rotate(360deg); } }
.da-spin { animation: da-spin 1s linear infinite; color: var(--accent-orange, #FF9F1C); }

/* ── Error ── */
.da-error-card {
  text-align: center;
  padding: 64px 48px;
  background: var(--panel-clean, #eaebec);
  border-radius: 16px;
}

.da-error-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: var(--status-error, #EF4444);
}

.da-error-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.da-error-message {
  margin: 0 0 24px;
  font-size: 14px;
  color: var(--text-secondary, #6b7280);
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

/* ── Results ── */
.da-results {
  background: var(--panel-clean, #eaebec);
  border-radius: 12px;
  padding: 24px 28px;
}

.da-meta-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-default, rgba(0,0,0,0.06));
}

.da-meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}
.da-meta-item--success { color: var(--status-success, #22c55e); font-weight: 600; }
.da-meta-label { color: var(--text-muted, #9ca3af); }
.da-meta-value { font-weight: 600; color: var(--text-primary, #1a1a1a); }
.da-meta-spacer { flex: 1; }

/* Tabs */
.da-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--border-default, rgba(0,0,0,0.08));
  margin-bottom: 20px;
}

.da-tab {
  padding: 10px 20px;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  background: none;
  color: var(--text-secondary, #6b7280);
  transition: all 0.15s;
  margin-bottom: -1px;
}
.da-tab:hover { color: var(--text-primary, #1a1a1a); }
.da-tab--active {
  font-weight: 700;
  color: var(--accent-orange, #FF9F1C);
  border-bottom-color: var(--accent-orange, #FF9F1C);
}

.da-tab-content {
  min-height: 300px;
}

/* Responsive */
@media (max-width: 768px) {
  .da-header { padding: 12px 16px; }
  .da-main { padding: 16px; }
  .da-upload-zone { padding: 48px 24px; }
  .da-results { padding: 16px; }
  .da-meta-bar { gap: 8px; }
  .da-tabs { overflow-x: auto; }
}
`;
