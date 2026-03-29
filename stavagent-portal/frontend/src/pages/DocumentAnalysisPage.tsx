/**
 * DocumentAnalysisPage — Full-page document analysis.
 *
 * Upload-first flow: user drops file → system auto-detects type → shows results.
 * No pre-upload configuration. AI model selected automatically (Vertex AI on Cloud Run).
 *
 * Route: /portal/analysis
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, CheckCircle, AlertTriangle, Loader2, Download, Save, FolderOpen,
  ArrowLeft, FileSpreadsheet, Database, RotateCcw, FileText, Search,
  Clock, Plus, X,
} from 'lucide-react';
import type { PassportGenerationResponse } from '../types/passport';
import type { ProjectAnalysisData } from '../components/portal/ProjectAnalysis';
import ProjectAnalysis from '../components/portal/ProjectAnalysis';
import SoupisTab from '../components/portal/DocumentAnalysis/SoupisTab';
import type { ParseResult } from '../components/portal/DocumentAnalysis/SoupisTab';
import PassportTab from '../components/portal/DocumentAnalysis/PassportTab';
import AuditTab from '../components/portal/DocumentAnalysis/AuditTab';
import SummaryTab from '../components/portal/DocumentAnalysis/SummaryTab';
import ComplianceTab from '../components/portal/DocumentAnalysis/ComplianceTab';
import CrossValidationPanel from '../components/portal/DocumentAnalysis/CrossValidationPanel';
import { API_URL, creditsAPI } from '../services/api';

const CORE_API_URL = `${API_URL}/api/core`;
const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'xml', 'docx', 'csv', 'jpg', 'jpeg', 'png', 'tiff', 'tif'];

const IDENT_LABELS: Record<string, string> = {
  stavba: 'Stavba',
  investor: 'Investor',
  misto: 'Místo',
  kraj: 'Kraj',
  projektant: 'Projektant',
  datum: 'Datum',
  cislo_zakazky: 'Číslo zakázky',
  stupen_pd: 'Stupeň PD',
  ico: 'IČO',
  ckait: 'ČKAIT',
};

type TabId = 'passport' | 'soupis' | 'audit' | 'summary' | 'compliance' | 'project';

interface PortalProject {
  portal_project_id: string;
  project_name: string;
  project_type: string;
  created_at: string;
}

interface SavedDocument {
  document_id: string;
  project_id: string;
  document_type: string;
  title: string;
  version: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

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
  if (['jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext))
    return { label: 'Obrázek (OCR)', icon: FileText };
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

  // Credits / session-only mode
  const [sessionOnly, setSessionOnly] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  // Save to project
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Saved documents (load previous analyses)
  const [savedDocs, setSavedDocs] = useState<SavedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [showSavedDocs, setShowSavedDocs] = useState(false);
  const [loadedDocId, setLoadedDocId] = useState<string | null>(null);

  const hasResults = !!(passportData || projectData || soupisData);
  const authHeaders = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };

  // Load credit balance on mount (anonymous users → session-only)
  const isAnonymous = !localStorage.getItem('auth_token');
  useEffect(() => {
    if (isAnonymous) {
      setSessionOnly(true);
      setCreditBalance(0);
      return;
    }
    creditsAPI.getBalance()
      .then(res => {
        setCreditBalance(res.balance ?? 0);
        setSessionOnly(res.session_only ?? false);
      })
      .catch(() => {
        setSessionOnly(true);
        setCreditBalance(0);
      });
  }, [isAnonymous]);

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
      setError(`Nepodporovaný formát .${ext}. Povolené: PDF, XLSX, XLS, XML, DOCX, CSV, JPG, PNG, TIFF.`);
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

      const isSpreadsheet = ['xlsx', 'xls', 'xml'].includes(ext);
      setUploadProgress(isSpreadsheet ? 'Parsování tabulky...' : 'Analyzuji dokument...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const headers: Record<string, string> = {};
      const token = localStorage.getItem('auth_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${CORE_API_URL}/passport/generate`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers,
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

      const headers: Record<string, string> = {};
      const token = localStorage.getItem('auth_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${CORE_API_URL}/passport/process-project`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers,
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

  /* ── CSV export — universal (all available data) ── */
  const exportToCsv = useCallback(() => {
    if (!passportData) return;
    const { passport, statistics } = passportData;
    const rows: string[][] = [];

    // Header
    rows.push(['=== PASSPORT DOKUMENTU ===']);
    rows.push(['Název', passport.project_name || '']);
    if (passport.description && String(passport.description).length > 1) rows.push(['Popis', passport.description]);
    if (passport.structure_type) rows.push(['Typ konstrukce', passport.structure_type]);

    // Identification
    const ident = (passportData as any)?.identification;
    if (ident && Object.keys(ident).length > 0) {
      rows.push([], ['=== IDENTIFIKACE ===']);
      Object.entries(ident).forEach(([key, val]) => {
        if (val) rows.push([key, String(val)]);
      });
    }

    // Statistics
    if (statistics && ((statistics.total_concrete_m3 ?? 0) > 0 || (statistics.total_reinforcement_t ?? 0) > 0)) {
      rows.push([], ['=== SOUHRNNÉ ÚDAJE ===']);
      if ((statistics.total_concrete_m3 ?? 0) > 0) rows.push(['Beton celkem (m³)', String(statistics.total_concrete_m3)]);
      if ((statistics.total_reinforcement_t ?? 0) > 0) rows.push(['Výztuž celkem (t)', String(statistics.total_reinforcement_t)]);
    }

    // Concrete specifications
    if (passport.concrete_specifications?.length > 0) {
      rows.push([], ['=== SPECIFIKACE BETONU ===']);
      rows.push(['Třída', 'Expozice', 'Objem (m³)', 'Vlastnosti']);
      passport.concrete_specifications.forEach(spec => {
        rows.push([spec.concrete_class, spec.exposure_classes?.join(' ') || '', spec.volume_m3?.toString() || '', spec.special_properties?.join(', ') || '']);
      });
    }

    // Reinforcement
    if (passport.reinforcement?.length > 0) {
      rows.push([], ['=== VÝZTUŽ ===']);
      rows.push(['Třída oceli', 'Hmotnost (t)', 'Průměry']);
      passport.reinforcement.forEach(steel => {
        rows.push([steel.steel_grade, steel.tonnage_t?.toString() || '', steel.bar_diameters?.join(', ') || '']);
      });
    }

    // Dimensions
    const dims = passport.dimensions;
    if (dims) {
      const dimRows: string[][] = [];
      if (dims.floors_above_ground != null && dims.floors_above_ground > 0) dimRows.push(['Nadzemní podlaží', String(dims.floors_above_ground)]);
      if (dims.floors_underground != null && dims.floors_underground > 0) dimRows.push(['Podzemní podlaží', String(dims.floors_underground)]);
      if (dims.height_m != null && dims.height_m > 0) dimRows.push(['Výška (m)', String(dims.height_m)]);
      if (dims.length_m != null && dims.length_m > 0) dimRows.push(['Délka (m)', String(dims.length_m)]);
      if (dims.width_m != null && dims.width_m > 0) dimRows.push(['Šířka (m)', String(dims.width_m)]);
      if (dims.built_up_area_m2 != null && dims.built_up_area_m2 > 0) dimRows.push(['Zastavěná plocha (m²)', String(dims.built_up_area_m2)]);
      if (dimRows.length > 0) {
        rows.push([], ['=== ROZMĚRY ===']);
        dimRows.forEach(r => rows.push(r));
      }
    }

    // Special requirements
    if (passport.special_requirements?.length > 0) {
      rows.push([], ['=== SPECIÁLNÍ POŽADAVKY ===']);
      passport.special_requirements.forEach(req => {
        rows.push([req.requirement_type, req.description, req.standard || '']);
      });
    }

    // Technical highlights
    if (passport.technical_highlights?.length > 0) {
      rows.push([], ['=== TECHNICKÉ HLAVNÍ BODY ===']);
      passport.technical_highlights.forEach(hl => rows.push([hl]));
    }

    // Risks
    if (passport.risks?.length > 0) {
      rows.push([], ['=== RIZIKA ===']);
      rows.push(['Kategorie', 'Závažnost', 'Popis', 'Zmírnění']);
      passport.risks.forEach(risk => {
        rows.push([risk.risk_category, risk.severity, risk.description, risk.mitigation]);
      });
    }

    // Norms
    const norms = (passportData as any)?.norms;
    if (norms?.length > 0) {
      rows.push([], ['=== NORMY ===']);
      norms.forEach((n: string) => rows.push([n]));
    }

    // Tender info
    const tender = (passport as any)?.tender_info;
    if (tender) {
      rows.push([], ['=== ZADÁVACÍ DOKUMENTACE ===']);
      const tenderFields: [string, any][] = [
        ['IČO', tender.ico], ['ISDS', tender.isds], ['CPV', tender.cpv_code],
        ['Zákon', tender.zakon], ['Předpokládaná hodnota (Kč)', tender.predpokladana_hodnota_czk],
        ['Hodnota s DPH (Kč)', tender.hodnota_s_dph_czk],
        ['Jistota (Kč)', tender.jistota_czk], ['Číslo účtu', tender.cislo_uctu],
        ['Lhůta podání', tender.lhuta_podani], ['Zadávací lhůta (dní)', tender.zadavaci_lhuta_dnu],
        ['Hodnotící kritérium', tender.hodnotici_kriterium], ['URL', tender.tender_url],
      ];
      tenderFields.forEach(([label, val]) => {
        if (val != null && val !== '') rows.push([label, String(val)]);
      });
      if (tender.prilohy?.length > 0) {
        rows.push([], ['=== PŘÍLOHY ZD ===']);
        tender.prilohy.forEach((p: string) => rows.push([p]));
      }
    }

    // Location + stakeholders
    if (passport.location?.city || passport.location?.address) {
      rows.push([], ['=== LOKALITA ===']);
      if (passport.location?.city) rows.push(['Město', passport.location.city]);
      if (passport.location?.region) rows.push(['Kraj', passport.location.region]);
      if (passport.location?.address) rows.push(['Adresa', passport.location.address]);
    }
    if (passport.stakeholders?.length > 0) {
      rows.push([], ['=== ÚČASTNÍCI ===']);
      passport.stakeholders.forEach(s => rows.push([s.role, s.name]));
    }

    // Type-specific extractions (technical, bill_of_quantities, etc.)
    const technical = (passportData as any)?.technical;
    if (technical) {
      rows.push([], ['=== TECHNICKÉ PARAMETRY ===']);
      Object.entries(technical).forEach(([key, val]) => {
        if (val != null && val !== '' && val !== 0 && !(Array.isArray(val) && val.length === 0)) {
          rows.push([key, Array.isArray(val) ? val.join(', ') : String(val)]);
        }
      });
    }

    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${passport.project_name || 'passport'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [passportData]);

  /* ── Fetch projects for picker ── */
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/portal-projects`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch { /* ignore */ }
  }, []);

  /* ── Save analysis to project ── */
  const handleSave = useCallback(async (projectId: string) => {
    if (!passportData && !projectData && !soupisData) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const fileName = uploadedFile?.name || 'Analýza';
      const title = fileName.replace(/\.[^/.]+$/, '');

      // Compute content hash for deduplication (SHA-256 of JSON)
      const contentStr = JSON.stringify({ passportData, soupisData, projectData });
      const contentHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contentStr))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

      // Build content object with all available data
      const content: Record<string, unknown> = {};
      if (passportData) content.passport = passportData;
      if (soupisData) content.soupis_praci = soupisData;
      if (projectData) content.project_analysis = projectData;
      // Include extracted metadata for future compliance checks
      if ((passportData as any)?.norms) content.norms = (passportData as any).norms;
      if ((passportData as any)?.identification) content.identification = (passportData as any).identification;
      if ((passportData as any)?.referenced_documents) content.referenced_documents = (passportData as any).referenced_documents;
      if ((passportData as any)?.classification) content.classification = (passportData as any).classification;

      // Detect document type from classification or file extension
      const classifiedType = (passportData as any)?.classification?.category;
      const docType = classifiedType || (projectData ? 'project_analysis' : 'passport');

      const metadata: Record<string, unknown> = {
        file_name: uploadedFile?.name,
        file_size: uploadedFile?.size,
        content_hash: contentHash,
        saved_at: new Date().toISOString(),
        processing_time_seconds: passportData?.metadata?.processing_time_seconds,
        parser_used: passportData?.metadata?.parser_used,
        has_norms: !!((passportData as any)?.norms?.length),
        has_identification: !!((passportData as any)?.identification),
      };

      const res = await fetch(`${API_URL}/api/portal-documents/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          document_type: docType,
          title,
          content,
          source_file_id: fileName, // Used for version detection (same filename → new version)
          metadata,
          created_by: 'document_analysis_page',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      setSaveSuccess(true);
      setLoadedDocId(result.document_id);
      setShowProjectPicker(false);

      // Also send to CORE add-document for server-side cross-validation (fire-and-forget)
      if (uploadedFile && projectId) {
        sendToCoreAddDocument(projectId, uploadedFile).catch(() => {});
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Uložení selhalo');
    } finally {
      setIsSaving(false);
    }
  }, [passportData, projectData, soupisData, uploadedFile]);

  /* ── Send file to CORE add-document for server-side cross-validation ── */
  const sendToCoreAddDocument = useCallback(async (projectId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('enable_ai', 'true');

      const res = await fetch(`${CORE_API_URL}/project/${projectId}/add-document`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.cross_validation || data.norm_compliance) {
          console.log('[CORE] add-document cross-validation received');
        }
      }
    } catch {
      // Non-critical — don't block the save flow
    }
  }, []);

  /* ── Create project + save ── */
  const handleCreateAndSave = useCallback(async () => {
    if (!newProjectName.trim()) return;
    setIsCreatingProject(true);
    setSaveError(null);

    try {
      const res = await fetch(`${API_URL}/api/portal-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          project_name: newProjectName.trim(),
          project_type: 'analysis',
        }),
      });

      if (!res.ok) throw new Error('Vytvoření projektu selhalo');
      const data = await res.json();
      const newProjectId = data.project?.portal_project_id;
      if (!newProjectId) throw new Error('Chybí ID projektu');

      setSelectedProjectId(newProjectId);
      await handleSave(newProjectId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setIsCreatingProject(false);
    }
  }, [newProjectName, handleSave]);

  /* ── Open save picker ── */
  const openSavePicker = useCallback(() => {
    setShowProjectPicker(true);
    setSaveError(null);
    setNewProjectName(uploadedFile?.name.replace(/\.[^/.]+$/, '') || '');
    fetchProjects();
  }, [fetchProjects, uploadedFile]);

  /* ── Fetch saved documents ── */
  const fetchSavedDocs = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      // Fetch documents from all projects (latest only)
      const projRes = await fetch(`${API_URL}/api/portal-projects`, {
        headers: authHeaders,
      });
      if (!projRes.ok) return;
      const projData = await projRes.json();
      const allDocs: SavedDocument[] = [];

      for (const proj of (projData.projects || []).slice(0, 20)) {
        try {
          const docsRes = await fetch(
            `${API_URL}/api/portal-documents/${proj.portal_project_id}?latest=true`,
            { headers: authHeaders }
          );
          if (docsRes.ok) {
            const docsData = await docsRes.json();
            for (const doc of docsData.documents || []) {
              allDocs.push(doc);
            }
          }
        } catch { /* skip */ }
      }

      // Sort by created_at desc
      allDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSavedDocs(allDocs);
    } catch { /* ignore */ } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  /* ── Load a saved document ── */
  const handleLoadDocument = useCallback(async (doc: SavedDocument) => {
    setIsLoadingDocs(true);
    setShowSavedDocs(false);

    try {
      const res = await fetch(
        `${API_URL}/api/portal-documents/${doc.project_id}/${doc.document_id}`,
        { headers: authHeaders }
      );
      if (!res.ok) throw new Error('Nepodařilo se načíst dokument');
      const data = await res.json();
      const content = data.document?.content;
      if (!content) throw new Error('Dokument je prázdný');

      // Restore state from saved content
      if (content.passport) {
        setPassportData(content.passport);
        setActiveTab('passport');
      }
      if (content.soupis_praci) {
        setSoupisData(content.soupis_praci);
        if (!content.passport) setActiveTab('soupis');
      }
      if (content.project_analysis) {
        setProjectData(content.project_analysis);
        if (!content.passport && !content.soupis_praci) setActiveTab('project');
      }

      setLoadedDocId(doc.document_id);
      setSaveSuccess(true);
      setUploadedFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání');
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  /* ── Toggle saved docs panel ── */
  const openSavedDocs = useCallback(() => {
    setShowSavedDocs(true);
    fetchSavedDocs();
  }, [fetchSavedDocs]);

  /* ── Reset ── */
  const handleReset = () => {
    setPassportData(null);
    setProjectData(null);
    setSoupisData(null);
    setUploadedFile(null);
    setError(null);
    setIsUploading(false);
    setSaveSuccess(false);
    setSaveError(null);
    setShowProjectPicker(false);
    setLoadedDocId(null);
    setActiveTab('passport');
    setUploadProgress('');
    // Clear the file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Scroll to top for mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Tab config ── */
  const tabs: Array<{ id: TabId; label: string; show: boolean }> = [
    { id: 'passport', label: 'Passport dokumentu', show: !!passportData },
    { id: 'soupis', label: 'Soupis prací', show: !!soupisData },
    { id: 'audit', label: 'AI Audit', show: true },
    { id: 'summary', label: 'Shrnutí', show: !!passportData },
    { id: 'compliance', label: 'Normy (NKB)', show: !!passportData },
    { id: 'project', label: `Projektová analýza (${projectData?.merged_sos?.length || 0} SO)`, show: !!projectData },
  ];
  const visibleTabs = tabs.filter(t => t.show);

  /* ── Render ── */
  return (
    <div className="da-page">
      {/* Page header */}
      <header className="da-header">
        <button onClick={() => navigate(isAnonymous ? '/' : '/portal')} className="da-back-btn">
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
              <span className="da-format-tag">JPG</span>
              <span className="da-format-tag">PNG</span>
            </div>
            <p className="da-upload-hint">
              Více souborů najednou = projektová analýza s SO merge
            </p>
            {!isAnonymous && (
              <button
                onClick={(e) => { e.stopPropagation(); openSavedDocs(); }}
                className="da-load-saved-btn"
              >
                <FolderOpen size={14} /> Načíst uloženou analýzu
              </button>
            )}
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
            {/* Classification badge + meta */}
            {passportData && (
              <>
                <div className="da-meta-bar">
                  {/* Classification badge */}
                  {(passportData as any)?.classification?.category && (
                    <div className="da-class-badge">
                      <span className="da-class-tag">{(passportData as any).classification.category}</span>
                      <span className="da-class-conf">
                        {((passportData as any).classification.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="da-class-method">{(passportData as any).classification.method}</span>
                    </div>
                  )}
                  <div className="da-meta-item da-meta-item--success">
                    <CheckCircle size={16} />
                    <span>
                      {typeof passportData?.metadata?.processing_time_seconds === 'number'
                        ? `${passportData.metadata.processing_time_seconds.toFixed(1)}s`
                        : '—'}
                    </span>
                  </div>
                  {soupisData && soupisData.positions_count > 0 && (
                    <div className="da-meta-item">
                      <span className="da-meta-label">Pozice</span>
                      <span className="da-meta-value">{soupisData.positions_count}</span>
                    </div>
                  )}
                  <div className="da-meta-spacer" />
                  <button onClick={exportToCsv} className="c-btn c-btn--ghost c-btn--sm">
                    <Download size={14} /> Export CSV
                  </button>
                  {saveSuccess ? (
                    <span className="da-save-badge">
                      <CheckCircle size={14} /> Uloženo
                    </span>
                  ) : sessionOnly ? (
                    isAnonymous ? (
                      <button
                        onClick={() => navigate('/login')}
                        className="c-btn c-btn--sm"
                        style={{
                          background: '#FF9F1C', color: '#fff', border: 'none',
                          fontWeight: 600, fontSize: '12px',
                        }}
                      >
                        Registrace → 200 kreditů zdarma
                      </button>
                    ) : (
                      <span className="da-session-badge" title="Dobijte kredity pro uložení do projektu">
                        Pouze v prohlížeči
                      </span>
                    )
                  ) : (
                    <button
                      onClick={openSavePicker}
                      className="c-btn c-btn--primary c-btn--sm"
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 size={14} className="da-spin" /> : <Save size={14} />}
                      {isSaving ? 'Ukládám...' : 'Uložit do projektu'}
                    </button>
                  )}
                </div>

                {/* Identification card — light background for readability */}
                {(passportData as any)?.identification && Object.keys((passportData as any).identification).length > 0 && (
                  <div className="da-ident-card">
                    {Object.entries((passportData as any).identification as Record<string, string>).map(([key, val]) => (
                      <div key={key} className="da-ident-row">
                        <span className="da-ident-label">{IDENT_LABELS[key] || key}</span>
                        <span className="da-ident-value">{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Norms — compact pill list */}
                {(passportData as any)?.norms?.length > 0 && (
                  <div className="da-norms-bar">
                    <span className="da-norms-label">Normy ({(passportData as any).norms.length})</span>
                    <div className="da-norms-list">
                      {((passportData as any).norms as string[]).slice(0, 20).map((n, i) => (
                        <span key={i} className="da-norm-pill">{n}</span>
                      ))}
                      {(passportData as any).norms.length > 20 && (
                        <span className="da-norm-pill da-norm-pill--more">+{(passportData as any).norms.length - 20}</span>
                      )}
                    </div>
                  </div>
                )}
                {/* Referenced documents (potentially missing) */}
                {(passportData as any)?.referenced_documents?.length > 0 && (
                  <div className="da-refs-bar">
                    <span className="da-refs-label">Odkazované dokumenty</span>
                    <div className="da-refs-list">
                      {((passportData as any).referenced_documents as string[]).map((ref, i) => (
                        <div key={i} className="da-ref-item">
                          <AlertTriangle size={12} />
                          <span>{ref}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
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
              {activeTab === 'audit' && <AuditTab uploadedFile={uploadedFile} />}
              {activeTab === 'summary' && <SummaryTab data={passportData} />}
              {activeTab === 'compliance' && <ComplianceTab data={passportData} />}
              {activeTab === 'project' && projectData && (
                <ProjectAnalysis data={projectData} />
              )}
            </div>

            {/* Bottom action bar — always visible in results */}
            <div className="da-bottom-bar">
              <button onClick={handleReset} className="c-btn c-btn--primary">
                <RotateCcw size={16} />
                Analyzovat další dokument
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Project picker overlay ── */}
      {showProjectPicker && (
        <div className="da-overlay" onClick={() => setShowProjectPicker(false)}>
          <div className="da-picker-card" onClick={e => e.stopPropagation()}>
            <div className="da-picker-header">
              <h3>Uložit do projektu</h3>
              <button onClick={() => setShowProjectPicker(false)} className="da-picker-close">
                <X size={18} />
              </button>
            </div>

            {saveError && (
              <div className="da-picker-error">
                <AlertTriangle size={14} /> {saveError}
              </div>
            )}

            {/* Create new project */}
            <div className="da-picker-section">
              <label className="da-picker-label">Nový projekt</label>
              <div className="da-picker-create-row">
                <input
                  className="da-picker-input"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="Název projektu..."
                  onKeyDown={e => e.key === 'Enter' && handleCreateAndSave()}
                />
                <button
                  onClick={handleCreateAndSave}
                  className="c-btn c-btn--primary c-btn--sm"
                  disabled={!newProjectName.trim() || isCreatingProject}
                >
                  {isCreatingProject ? <Loader2 size={14} className="da-spin" /> : <Plus size={14} />}
                  Vytvořit a uložit
                </button>
              </div>
            </div>

            {/* Existing projects */}
            {projects.length > 0 && (
              <div className="da-picker-section">
                <label className="da-picker-label">Existující projekty</label>
                <div className="da-picker-list">
                  {projects.map(proj => (
                    <button
                      key={proj.portal_project_id}
                      onClick={() => {
                        setSelectedProjectId(proj.portal_project_id);
                      }}
                      className={`da-picker-item ${selectedProjectId === proj.portal_project_id ? 'da-picker-item--selected' : ''}`}
                      disabled={isSaving}
                    >
                      <span className="da-picker-item-name">{proj.project_name}</span>
                      <span className="da-picker-item-meta">
                        {new Date(proj.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Cross-validation + confirm when project selected */}
                {selectedProjectId && (
                  <div className="da-picker-confirm">
                    <CrossValidationPanel
                      projectId={selectedProjectId}
                      currentData={passportData}
                    />
                    <button
                      onClick={() => handleSave(selectedProjectId)}
                      className="c-btn c-btn--primary"
                      disabled={isSaving}
                      style={{ marginTop: 12, width: '100%' }}
                    >
                      {isSaving ? <Loader2 size={14} className="da-spin" /> : <Save size={14} />}
                      Uložit do vybraného projektu
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Saved documents panel ── */}
      {showSavedDocs && (
        <div className="da-overlay" onClick={() => setShowSavedDocs(false)}>
          <div className="da-picker-card" onClick={e => e.stopPropagation()}>
            <div className="da-picker-header">
              <h3>Uložené analýzy</h3>
              <button onClick={() => setShowSavedDocs(false)} className="da-picker-close">
                <X size={18} />
              </button>
            </div>

            {isLoadingDocs && (
              <div className="da-picker-loading">
                <Loader2 size={20} className="da-spin" /> Načítám...
              </div>
            )}

            {!isLoadingDocs && savedDocs.length === 0 && (
              <div className="da-picker-empty">
                Žádné uložené analýzy. Nahrajte dokument a uložte ho do projektu.
              </div>
            )}

            {!isLoadingDocs && savedDocs.length > 0 && (
              <div className="da-picker-list">
                {savedDocs.map(doc => (
                  <button
                    key={doc.document_id}
                    onClick={() => handleLoadDocument(doc)}
                    className="da-picker-item"
                  >
                    <div className="da-picker-item-top">
                      <span className="da-picker-item-name">{doc.title}</span>
                      <span className="da-picker-item-type">{doc.document_type}</span>
                    </div>
                    <div className="da-picker-item-bottom">
                      <span className="da-picker-item-meta">
                        <Clock size={12} />
                        {new Date(doc.created_at).toLocaleDateString('cs-CZ')}{' '}
                        {new Date(doc.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {doc.version > 1 && (
                        <span className="da-picker-item-version">v{doc.version}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept=".pdf,.xlsx,.xls,.xml,.docx,.csv,.jpg,.jpeg,.png,.tiff,.tif"
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

.da-bottom-bar {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-default, rgba(0,0,0,0.08));
  display: flex;
  justify-content: center;
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

/* ── Referenced documents (missing) ── */
.da-refs-bar {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.04);
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: 8px;
}
.da-refs-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-orange, #FF9F1C);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.da-refs-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.da-ref-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}
.da-ref-item svg { color: var(--accent-orange, #FF9F1C); flex-shrink: 0; }

/* ── Classification badge ── */
.da-class-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 8px;
  background: rgba(255, 159, 28, 0.08);
  border: 1px solid rgba(255, 159, 28, 0.2);
}
.da-class-tag {
  font-weight: 700;
  font-size: 13px;
  color: var(--accent-orange, #FF9F1C);
  letter-spacing: 0.5px;
}
.da-class-conf {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}
.da-class-method {
  font-size: 11px;
  color: var(--text-muted, #9ca3af);
  padding-left: 6px;
  border-left: 1px solid rgba(0,0,0,0.1);
}

/* ── Identification card (light for readability) ── */
.da-ident-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px 24px;
  border: 1px solid rgba(0,0,0,0.06);
}
.da-ident-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 0;
}
.da-ident-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #9ca3af);
  min-width: 100px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.da-ident-value {
  font-size: 14px;
  color: var(--text-primary, #1a1a1a);
  font-weight: 500;
}

/* ── Norms bar ── */
.da-norms-bar {
  margin-bottom: 16px;
  padding: 12px 0;
}
.da-norms-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.da-norms-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.da-norm-pill {
  padding: 3px 10px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 500;
  background: #fff;
  color: var(--text-secondary, #6b7280);
  border: 1px solid rgba(0,0,0,0.08);
  white-space: nowrap;
}
.da-norm-pill--more {
  background: rgba(255, 159, 28, 0.06);
  color: var(--accent-orange, #FF9F1C);
  font-weight: 600;
}

/* ── Save badge ── */
.da-save-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--status-success, #22c55e);
  background: rgba(34, 197, 94, 0.08);
}

/* ── Session-only badge ── */
.da-session-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #C2410C;
  background: #FFF7ED;
  border: 1px solid #FB923C;
  cursor: help;
}

/* ── Load saved button in upload zone ── */
.da-load-saved-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid var(--border-default, rgba(0,0,0,0.12));
  background: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  transition: all 0.15s;
}
.da-load-saved-btn:hover {
  border-color: var(--accent-orange, #FF9F1C);
  color: var(--accent-orange, #FF9F1C);
  background: rgba(255, 159, 28, 0.04);
}

/* ── Overlay (shared for picker + saved docs) ── */
.da-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(2px);
}

.da-picker-card {
  background: var(--panel-clean, #eaebec);
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.da-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-default, rgba(0,0,0,0.06));
}
.da-picker-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.da-picker-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  color: var(--text-secondary, #6b7280);
  transition: background 0.15s;
}
.da-picker-close:hover { background: rgba(0,0,0,0.06); }

.da-picker-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 24px 0;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--status-error, #EF4444);
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
}

.da-picker-section {
  padding: 16px 24px;
}
.da-picker-section + .da-picker-section {
  border-top: 1px solid var(--border-default, rgba(0,0,0,0.06));
}

.da-picker-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.da-picker-create-row {
  display: flex;
  gap: 8px;
}

.da-picker-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-default, rgba(0,0,0,0.12));
  background: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.da-picker-input:focus {
  border-color: var(--accent-orange, #FF9F1C);
}

.da-picker-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.da-picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: #fff;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.15s;
}
.da-picker-item:hover {
  border-color: var(--accent-orange, #FF9F1C);
  background: rgba(255, 159, 28, 0.03);
}
.da-picker-item--selected {
  border-color: var(--accent-orange, #FF9F1C);
  background: rgba(255, 159, 28, 0.06);
}
.da-picker-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.da-picker-confirm {
  padding: 0 24px 20px;
}

.da-picker-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}
.da-picker-item-bottom {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.da-picker-item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
}

.da-picker-item-meta {
  font-size: 12px;
  color: var(--text-muted, #9ca3af);
  display: flex;
  align-items: center;
  gap: 4px;
}

.da-picker-item-type {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255, 159, 28, 0.08);
  color: var(--accent-orange, #FF9F1C);
}

.da-picker-item-version {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #9ca3af);
}

.da-picker-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  font-size: 14px;
  color: var(--text-secondary, #6b7280);
}

.da-picker-empty {
  padding: 40px 24px;
  text-align: center;
  font-size: 14px;
  color: var(--text-muted, #9ca3af);
}

/* Responsive */
@media (max-width: 768px) {
  .da-header { padding: 12px 16px; }
  .da-main { padding: 16px; }
  .da-upload-zone { padding: 48px 24px; }
  .da-results { padding: 16px; }
  .da-meta-bar { gap: 8px; }
  .da-tabs { overflow-x: auto; }
  .da-ident-card { grid-template-columns: 1fr; }
  .da-picker-card { margin: 16px; max-width: calc(100% - 32px); }
  .da-picker-create-row { flex-direction: column; }
}
`;
