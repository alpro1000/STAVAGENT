/**
 * CORE Panel Component
 *
 * Shows project files with Universal Parser integration:
 * - File upload (Excel / PDF)
 * - Auto-parse status per file (not_parsed → parsing → parsed / error)
 * - Parsed summary: item counts by type, kiosk suggestions
 * - One-click navigation to Monolit / Registry / URS Matcher with file context
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, FileText, CheckCircle, AlertTriangle, XCircle,
  RefreshCw, Upload, Loader, BarChart2, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
import { API_URL } from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortalProject {
  portal_project_id: string;
  project_name: string;
  project_type: string;
  core_project_id?: string;
  core_status: 'not_sent' | 'processing' | 'completed' | 'error';
  core_audit_result?: 'GREEN' | 'AMBER' | 'RED';
  core_last_sync?: string;
}

interface CorePanelProps {
  project: PortalProject;
  onClose: () => void;
  onRefresh: () => void;
}

interface ProjectFile {
  file_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  core_status: string;
  parse_status: string | null;   // 'not_parsed' | 'parsing' | 'parsed' | 'error'
  parsed_at: string | null;
}

interface KioskSuggestion {
  count: number;
  types: string[];
  description: string;
}

interface ParsedSummary {
  file_id: string;
  file_name: string;
  parsed_at: string;
  metadata: {
    stavba: string;
    objekt: string;
    soupis: string;
    fileName: string;
    sheetCount: number;
    parsedSheetCount: number;
  };
  summary: {
    totalItems: number;
    totalSheets: number;
    totalCena: number;
    byType: Record<string, { count: number; totalCena: number }>;
    withConcreteGrade: number;
    withCode: number;
    withPrice: number;
    kioskSuggestions: {
      monolit: KioskSuggestion;
      registry: KioskSuggestion;
      urs_matcher: KioskSuggestion;
    };
  };
  sheets: Array<{
    name: string;
    bridgeId: string | null;
    bridgeName: string;
    itemCount: number;
    stats: { totalItems: number; totalCena: number; byType: Record<string, number>; sections: string[] };
  }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KIOSK_META = {
  monolit: {
    label: 'Monolit Planner',
    icon: '🪨',
    color: '#3b82f6',
    bg: '#eff6ff',
    buildUrl: (fileId: string, portalUrl: string, _portalProjectId: string) =>
      `https://monolit-planner-frontend.vercel.app?portal_file_id=${fileId}&portal_api=${encodeURIComponent(portalUrl)}`,
  },
  registry: {
    label: 'Registr Rozpočtů',
    icon: '📊',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    buildUrl: (fileId: string, portalUrl: string, portalProjectId: string) =>
      `https://stavagent-backend-ktwx.vercel.app?portal_file_id=${fileId}&portal_api=${encodeURIComponent(portalUrl)}&portal_project=${portalProjectId}`,
  },
  urs_matcher: {
    label: 'URS Matcher',
    icon: '🔎',
    color: '#10b981',
    bg: '#ecfdf5',
    buildUrl: (fileId: string, portalUrl: string, _portalProjectId: string) =>
      `https://urs-matcher-service.onrender.com?portal_file_id=${fileId}&portal_api=${encodeURIComponent(portalUrl)}`,
  },
} as const;

const WORK_TYPE_LABELS: Record<string, string> = {
  beton:       'Beton (m³)',
  bedneni:     'Bednění (m²)',
  vyztuze:     'Výztuž (kg)',
  zemni:       'Zemní práce',
  izolace:     'Izolace',
  komunikace:  'Komunikace',
  piloty:      'Piloty',
  kotveni:     'Kotvení',
  prefab:      'Prefab',
  doprava:     'Doprava',
  jine:        'Ostatní',
};

const EXCEL_MIMES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader() {
  return { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatCZK(value: number): string {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CorePanel({ project, onClose, onRefresh }: CorePanelProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed summary state
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [parsedSummary, setParsedSummary] = useState<ParsedSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load files ──────────────────────────────────────────────────────────────

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_URL}/api/portal-projects/${project.portal_project_id}/files`,
        { headers: authHeader() }
      );
      if (!res.ok) throw new Error('Failed to load files');
      const data = await res.json();
      setFiles(data.files || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [project.portal_project_id]);

  useEffect(() => {
    loadFiles();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadFiles]);

  // Poll when any file is 'parsing'
  useEffect(() => {
    const hasParsingFile = files.some(f => f.parse_status === 'parsing');

    if (hasParsingFile && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(() => {
        loadFiles();
      }, 2500);
    }

    if (!hasParsingFile && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, [files, loadFiles]);

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_type', 'vykaz');

      const res = await fetch(
        `${API_URL}/api/portal-files/${project.portal_project_id}/upload`,
        { method: 'POST', headers: authHeader(), body: formData }
      );

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDrop = (e: any) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0] as File | undefined;
    if (file) handleFileUpload(file);
  };

  // ── Manual parse ─────────────────────────────────────────────────────────────

  const handleManualParse = async (fileId: string) => {
    try {
      setFiles((prev: ProjectFile[]) => prev.map((f: ProjectFile) =>
        f.file_id === fileId ? { ...f, parse_status: 'parsing' } : f
      ));
      const res = await fetch(`${API_URL}/api/portal-files/${fileId}/parse`, {
        method: 'POST',
        headers: authHeader(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Parse failed');
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse failed');
      await loadFiles();
    }
  };

  // ── Load parsed summary ───────────────────────────────────────────────────────

  const loadParsedSummary = async (fileId: string) => {
    if (selectedFileId === fileId) {
      // Toggle off
      setSelectedFileId(null);
      setParsedSummary(null);
      return;
    }

    setSelectedFileId(fileId);
    setParsedSummary(null);
    setSummaryError(null);
    setSummaryLoading(true);
    setSummaryOpen(true);

    try {
      const res = await fetch(`${API_URL}/api/portal-files/${fileId}/parsed-data/summary`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load summary');
      setParsedSummary(data);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  // ── Kiosk navigation ────────────────────────────────────────────────────────

  const openInKiosk = (kioskType: keyof typeof KIOSK_META) => {
    if (!selectedFileId) return;
    const meta = KIOSK_META[kioskType];
    const url = meta.buildUrl(selectedFileId, API_URL, project.portal_project_id);
    window.open(url, '_blank');
  };

  // ── Send to CORE ─────────────────────────────────────────────────────────────

  const handleSendToCORE = async () => {
    if (files.length === 0) {
      alert('Nahrajte alespoň jeden soubor');
      return;
    }
    if (!confirm('Odeslat projekt do CORE ke analýze?')) return;

    try {
      setSending(true);
      const res = await fetch(
        `${API_URL}/api/portal-projects/${project.portal_project_id}/send-to-core`,
        { method: 'POST', headers: authHeader() }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to send to CORE');
      }
      const data = await res.json();
      alert(`Odesláno do CORE!\nWorkflow ID: ${data.core_project_id}`);
      onRefresh();
      loadFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send to CORE');
    } finally {
      setSending(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const getParseStatusBadge = (parseStatus: string | null) => {
    switch (parseStatus) {
      case 'parsed':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '999px', fontWeight: 500 }}>
            <CheckCircle style={{ width: '12px', height: '12px' }} />
            Parsováno
          </span>
        );
      case 'parsing':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '999px', fontWeight: 500 }}>
            <Loader style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
            Parsování...
          </span>
        );
      case 'error':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '999px', fontWeight: 500 }}>
            <XCircle style={{ width: '12px', height: '12px' }} />
            Chyba
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '999px', fontWeight: 500 }}>
            Neparsováno
          </span>
        );
    }
  };

  const getAuditIcon = (result?: string) => {
    switch (result) {
      case 'GREEN':  return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'AMBER':  return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
      case 'RED':    return <XCircle className="h-8 w-8 text-red-500" />;
      default:       return <FileText className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      not_sent:   { color: 'bg-gray-500',  text: 'Neanalyzováno' },
      processing: { color: 'bg-blue-500',  text: 'Zpracovává se' },
      completed:  { color: 'bg-green-500', text: 'Hotovo' },
      error:      { color: 'bg-red-500',   text: 'Chyba' },
    };
    const b = map[status] || map.not_sent;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${b.color}`}>
        {b.text}
      </span>
    );
  };

  const isExcelFile = (file: ProjectFile) => EXCEL_MIMES.includes(
    file.file_name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : file.file_name.endsWith('.xls') ? 'application/vnd.ms-excel'
    : ''
  ) || file.file_name.endsWith('.xlsx') || file.file_name.endsWith('.xls');

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{project.project_name}</h3>
            <p className="text-sm text-gray-500">Soubory a analýza</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* ── CORE Status ─────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {getAuditIcon(project.core_audit_result)}
              <div>
                <h4 className="text-sm font-medium text-gray-900">CORE Analýza</h4>
                <p className="text-sm text-gray-500">
                  {project.core_project_id ? `ID: ${project.core_project_id}` : 'Neanalyzováno'}
                </p>
              </div>
            </div>
            {getStatusBadge(project.core_status)}
          </div>
          {project.core_last_sync && (
            <p className="text-xs text-gray-400">
              Poslední sync: {new Date(project.core_last_sync).toLocaleString('cs-CZ')}
            </p>
          )}
        </div>

        {/* ── Upload area ─────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px 0' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = '';
            }}
          />
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              background: uploading ? '#f9fafb' : 'transparent',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!uploading) (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db';
            }}
          >
            {uploading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#3b82f6' }}>
                <Loader style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px' }}>Nahrávání...</span>
              </div>
            ) : (
              <div style={{ color: '#6b7280' }}>
                <Upload style={{ width: '28px', height: '28px', margin: '0 auto 8px', color: '#9ca3af' }} />
                <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Nahrát soubor</p>
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>Excel (.xlsx, .xls) nebo PDF • přetáhnout nebo kliknout</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Files list ─────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">
              Soubory projektu {files.length > 0 && <span className="text-gray-400">({files.length})</span>}
            </h4>
            <button onClick={loadFiles} className="text-blue-600 hover:text-blue-800" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">Načítání...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="mx-auto h-10 w-10 mb-2" />
              <p className="text-sm">Žádné soubory. Nahrajte Excel nebo PDF výše.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map(file => (
                <div
                  key={file.file_id}
                  style={{
                    border: `1px solid ${selectedFileId === file.file_id ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    background: selectedFileId === file.file_id ? '#eff6ff' : '#fff',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {/* File info row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                      <FileText style={{ width: '18px', height: '18px', color: '#6b7280', flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', wordBreak: 'break-all', marginBottom: '2px' }}>
                          {file.file_name}
                        </p>
                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {formatFileSize(file.file_size)} • {new Date(file.uploaded_at).toLocaleDateString('cs-CZ')}
                          {file.parsed_at && ` • parsováno ${new Date(file.parsed_at).toLocaleDateString('cs-CZ')}`}
                        </p>
                      </div>
                    </div>

                    {/* Parse badge + actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      {getParseStatusBadge(file.parse_status)}

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {/* View summary button */}
                        {file.parse_status === 'parsed' && (
                          <button
                            onClick={() => loadParsedSummary(file.file_id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
                              border: '1px solid #3b82f6', color: '#3b82f6', background: '#eff6ff',
                              cursor: 'pointer', fontWeight: 500,
                            }}
                          >
                            <BarChart2 style={{ width: '11px', height: '11px' }} />
                            {selectedFileId === file.file_id ? 'Skrýt' : 'Souhrn'}
                          </button>
                        )}

                        {/* Re-parse button */}
                        {isExcelFile(file) && (file.parse_status === 'not_parsed' || file.parse_status === 'error' || file.parse_status == null) && (
                          <button
                            onClick={() => handleManualParse(file.file_id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
                              border: '1px solid #d1d5db', color: '#374151', background: '#f9fafb',
                              cursor: 'pointer',
                            }}
                          >
                            <RefreshCw style={{ width: '11px', height: '11px' }} />
                            Parsovat
                          </button>
                        )}

                        {/* Re-parse after error */}
                        {isExcelFile(file) && file.parse_status === 'parsed' && (
                          <button
                            onClick={() => handleManualParse(file.file_id)}
                            title="Znovu parsovat"
                            style={{
                              display: 'inline-flex', alignItems: 'center',
                              fontSize: '11px', padding: '3px 6px', borderRadius: '6px',
                              border: '1px solid #d1d5db', color: '#9ca3af', background: '#f9fafb',
                              cursor: 'pointer',
                            }}
                          >
                            <RefreshCw style={{ width: '11px', height: '11px' }} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Parsed Summary Panel ─────────────────────────────────────────── */}
        {selectedFileId && (
          <div style={{ borderBottom: '1px solid #e5e7eb' }}>
            {/* Header */}
            <button
              onClick={() => setSummaryOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 24px', background: '#f8fafc', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, color: '#1e293b',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
                Výsledky parsování
              </span>
              {summaryOpen ? <ChevronUp style={{ width: '16px', height: '16px', color: '#6b7280' }} /> : <ChevronDown style={{ width: '16px', height: '16px', color: '#6b7280' }} />}
            </button>

            {summaryOpen && (
              <div style={{ padding: '0 24px 20px' }}>
                {summaryLoading && (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '13px' }}>
                    <Loader style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                    Načítání souhrnu...
                  </div>
                )}

                {summaryError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', color: '#dc2626', fontSize: '13px' }}>
                    {summaryError}
                  </div>
                )}

                {parsedSummary && !summaryLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '12px' }}>

                    {/* Metadata */}
                    {(parsedSummary.metadata.stavba || parsedSummary.metadata.objekt) && (
                      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#374151' }}>
                        {parsedSummary.metadata.stavba && (
                          <p><strong>Stavba:</strong> {parsedSummary.metadata.stavba}</p>
                        )}
                        {parsedSummary.metadata.objekt && (
                          <p><strong>Objekt:</strong> {parsedSummary.metadata.objekt}</p>
                        )}
                        {parsedSummary.metadata.soupis && (
                          <p><strong>Soupis:</strong> {parsedSummary.metadata.soupis}</p>
                        )}
                      </div>
                    )}

                    {/* Totals */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      {[
                        { label: 'Položky celkem', value: parsedSummary.summary.totalItems.toString() },
                        { label: 'Listy', value: parsedSummary.summary.totalSheets.toString() },
                        { label: 'S cenou', value: parsedSummary.summary.withPrice.toString() },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                          <p style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{item.value}</p>
                          <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{item.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Total price */}
                    {parsedSummary.summary.totalCena > 0 && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 500 }}>Celková cena</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#15803d' }}>{formatCZK(parsedSummary.summary.totalCena)}</span>
                      </div>
                    )}

                    {/* By type breakdown */}
                    {Object.keys(parsedSummary.summary.byType).length > 0 && (
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Typy prací
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {Object.entries(parsedSummary.summary.byType)
                            .sort(([, a], [, b]) => b.count - a.count)
                            .map(([type, data]) => (
                              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                  flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${Math.round((data.count / parsedSummary.summary.totalItems) * 100)}%`,
                                    height: '100%', background: '#3b82f6', borderRadius: '999px'
                                  }} />
                                </div>
                                <span style={{ fontSize: '12px', color: '#374151', width: '120px', flexShrink: 0 }}>
                                  {WORK_TYPE_LABELS[type] || type}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', width: '30px', textAlign: 'right' }}>
                                  {data.count}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Sheets */}
                    {parsedSummary.sheets.length > 1 && (
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Listy ({parsedSummary.sheets.length})
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {parsedSummary.sheets.map(sheet => (
                            <div key={sheet.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px' }}>
                              <span style={{ color: '#374151', fontWeight: 500 }}>{sheet.bridgeName || sheet.name}</span>
                              <span style={{ color: '#6b7280' }}>{sheet.itemCount} pol.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Kiosk suggestions */}
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Otevřít v kiosku
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(Object.entries(KIOSK_META) as Array<[keyof typeof KIOSK_META, typeof KIOSK_META[keyof typeof KIOSK_META]]>).map(([key, meta]) => {
                          const suggestion = parsedSummary.summary.kioskSuggestions[key];
                          return (
                            <button
                              key={key}
                              onClick={() => openInKiosk(key)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', borderRadius: '8px',
                                border: `1px solid ${meta.color}30`,
                                background: meta.bg, cursor: 'pointer',
                                transition: 'opacity 0.15s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
                              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = '1'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>{meta.icon}</span>
                                <div style={{ textAlign: 'left' }}>
                                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>{meta.label}</p>
                                  <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{suggestion.description}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: meta.color, background: '#fff', padding: '2px 10px', borderRadius: '999px', border: `1px solid ${meta.color}40` }}>
                                  {suggestion.count} pol.
                                </span>
                                <ExternalLink style={{ width: '14px', height: '14px', color: meta.color, opacity: 0.6 }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Bottom actions ───────────────────────────────────────────────── */}
        <div className="p-6">
          <div className="flex gap-3">
            {project.core_status === 'not_sent' && (
              <button
                onClick={handleSendToCORE}
                disabled={sending || files.length === 0}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Odesílání...' : 'Odeslat do CORE'}
              </button>
            )}

            {project.core_status === 'completed' && (
              <button
                onClick={() => alert('TODO: zobrazit výsledky CORE analýzy')}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                Výsledky CORE
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Zavřít
            </button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700">
              <strong>Jak to funguje:</strong> Nahrejte Excel (výkaz výměr) → Portál jej automaticky zparsuje →
              Klikněte <em>Souhrn</em> u souboru → Otevřete libovolný kiosk s předvyplněnými daty.
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
