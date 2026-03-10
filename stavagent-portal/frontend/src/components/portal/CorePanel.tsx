/**
 * CORE Panel Component
 *
 * Shows project files with Universal Parser integration:
 * - File upload (Excel / PDF)
 * - Auto-parse status per file (not_parsed → parsing → parsed / error)
 * - Parsed summary: item counts by type, kiosk suggestions
 * - One-click navigation to Monolit / Registry / URS Matcher with file context
 *
 * Design: Digital Concrete (inline styles, no Tailwind)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, FileText, CheckCircle, AlertTriangle, XCircle,
  RefreshCw, Upload, Loader, BarChart2, ExternalLink, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { API_URL } from '../../services/api';
import { KioskLinksPanel } from './KioskLinksPanel';
import { PositionsPanel } from './PositionsPanel';

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
  onDelete?: (projectId: string) => void;
  inline?: boolean;
}

interface ProjectFile {
  file_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  core_status: string;
  parse_status: string | null;
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
    icon: '\u{1FAA8}',
    color: '#3b82f6',
    bg: '#eff6ff',
    buildUrl: (fileId: string, portalUrl: string, _portalProjectId: string) =>
      `https://monolit-planner-frontend.vercel.app?portal_file_id=${fileId}&portal_api=${encodeURIComponent(portalUrl)}`,
  },
  registry: {
    label: 'Registr Rozpočtů',
    icon: '\u{1F4CA}',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    buildUrl: (fileId: string, portalUrl: string, portalProjectId: string) =>
      `https://stavagent-backend-ktwx.vercel.app?portal_file_id=${fileId}&portal_api=${encodeURIComponent(portalUrl)}&portal_project=${portalProjectId}`,
  },
  urs_matcher: {
    label: 'URS Matcher',
    icon: '\u{1F50E}',
    color: '#10b981',
    bg: '#ecfdf5',
    buildUrl: (fileId: string, portalUrl: string, _portalProjectId: string) =>
      `https://urs-matcher-service-1086027517695.europe-west3.run.app?portal_file_id=${fileId}&portal_api=${encodeURIComponent(portalUrl)}`,
  },
} as const;

const WORK_TYPE_LABELS: Record<string, string> = {
  beton:       'Beton (m\u00B3)',
  bedneni:     'Bednění (m\u00B2)',
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

export default function CorePanel({ project, onClose, onRefresh, onDelete, inline = false }: CorePanelProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const hasParsingFile = files.some(f => f.parse_status === 'parsing');
    if (hasParsingFile && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(() => { loadFiles(); }, 2500);
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  };

  // ── Manual parse ─────────────────────────────────────────────────────────────

  const handleManualParse = async (fileId: string) => {
    try {
      setFiles(prev => prev.map(f => f.file_id === fileId ? { ...f, parse_status: 'parsing' } : f));
      const res = await fetch(`${API_URL}/api/portal-files/${fileId}/parse`, {
        method: 'POST', headers: authHeader(),
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
      const res = await fetch(`${API_URL}/api/portal-files/${fileId}/parsed-data/summary`, { headers: authHeader() });
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
    if (files.length === 0) { alert('Nahrajte alespoň jeden soubor'); return; }
    if (!confirm('Odeslat projekt do CORE ke analýze?')) return;
    try {
      setSending(true);
      const res = await fetch(
        `${API_URL}/api/portal-projects/${project.portal_project_id}/send-to-core`,
        { method: 'POST', headers: authHeader() }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to send to CORE'); }
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
    const base: React.CSSProperties = {
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 500,
    };
    switch (parseStatus) {
      case 'parsed':
        return <span style={{ ...base, color: '#16a34a', background: '#dcfce7' }}><CheckCircle style={{ width: 12, height: 12 }} /> Parsováno</span>;
      case 'parsing':
        return <span style={{ ...base, color: '#2563eb', background: '#dbeafe' }}><Loader style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> Parsování...</span>;
      case 'error':
        return <span style={{ ...base, color: '#dc2626', background: '#fee2e2' }}><XCircle style={{ width: 12, height: 12 }} /> Chyba</span>;
      default:
        return <span style={{ ...base, color: '#6b7280', background: '#f3f4f6' }}>Neparsováno</span>;
    }
  };

  const isExcelFile = (file: ProjectFile) =>
    file.file_name.endsWith('.xlsx') || file.file_name.endsWith('.xls');

  const auditIcons: Record<string, { icon: typeof CheckCircle; color: string }> = {
    GREEN: { icon: CheckCircle, color: '#16a34a' },
    AMBER: { icon: AlertTriangle, color: '#f59e0b' },
    RED: { icon: XCircle, color: '#dc2626' },
  };

  const statusMap: Record<string, { bg: string; color: string; label: string }> = {
    not_sent:   { bg: '#f3f4f6', color: '#6b7280', label: 'Neanalyzováno' },
    processing: { bg: '#dbeafe', color: '#2563eb', label: 'Zpracovává se' },
    completed:  { bg: '#dcfce7', color: '#16a34a', label: 'Hotovo' },
    error:      { bg: '#fee2e2', color: '#dc2626', label: 'Chyba' },
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const content = (
    <>
      <div style={{
        background: '#fff',
        borderRadius: inline ? '8px' : '12px',
        border: '1px solid #e5e7eb',
        width: '100%',
        ...(inline ? {} : { maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto' as const }),
        boxShadow: inline ? '0 1px 3px rgba(0,0,0,0.08)' : '0 25px 50px rgba(0,0,0,0.25)',
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
          position: 'sticky', top: 0, background: '#fff', zIndex: 10,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
              {project.project_name}
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Soubory a analýza</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onDelete && (
              <button
                onClick={() => onDelete(project.portal_project_id)}
                title="Smazat projekt"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px', opacity: 0.6 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
              >
                <Trash2 style={{ width: 18, height: 18 }} />
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
            >
              <X style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>

        {/* ── CORE Status ─────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {(() => {
                const a = auditIcons[project.core_audit_result || ''];
                const Icon = a ? a.icon : FileText;
                const clr = a ? a.color : '#9ca3af';
                return <Icon style={{ width: 28, height: 28, color: clr }} />;
              })()}
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>CORE Analýza</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                  {project.core_project_id ? `ID: ${project.core_project_id}` : 'Neanalyzováno'}
                </p>
              </div>
            </div>
            {(() => {
              const s = statusMap[project.core_status] || statusMap.not_sent;
              return (
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px',
                  background: s.bg, color: s.color,
                }}>
                  {s.label}
                </span>
              );
            })()}
          </div>
          {project.core_last_sync && (
            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
              Poslední sync: {new Date(project.core_last_sync).toLocaleString('cs-CZ')}
            </p>
          )}
        </div>

        {/* ── Upload area ─────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px 0' }}>
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
              padding: '16px',
              textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              background: uploading ? '#f9fafb' : 'transparent',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => { if (!uploading) (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db'; }}
          >
            {uploading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#3b82f6' }}>
                <Loader style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px' }}>Nahrávání...</span>
              </div>
            ) : (
              <div style={{ color: '#6b7280' }}>
                <Upload style={{ width: 24, height: 24, margin: '0 auto 6px', color: '#9ca3af' }} />
                <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>Nahrát soubor</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Excel (.xlsx, .xls) nebo PDF</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Files list ─────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
              Soubory projektu {files.length > 0 && <span style={{ color: '#9ca3af' }}>({files.length})</span>}
            </h4>
            <button
              onClick={loadFiles}
              disabled={loading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '4px' }}
            >
              <RefreshCw style={{ width: 14, height: 14, ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
            </button>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
              padding: '10px 14px', marginBottom: '12px', color: '#dc2626', fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{
                width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px',
              }} />
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Načítání...</p>
            </div>
          ) : files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
              <FileText style={{ width: 36, height: 36, margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ fontSize: '13px', margin: 0 }}>Žádné soubory. Nahrajte Excel nebo PDF výše.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map(file => (
                <div
                  key={file.file_id}
                  style={{
                    border: `1px solid ${selectedFileId === file.file_id ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    padding: '10px 12px',
                    background: selectedFileId === file.file_id ? '#eff6ff' : '#fff',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
                      <FileText style={{ width: 16, height: 16, color: '#6b7280', flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', wordBreak: 'break-all', margin: '0 0 2px' }}>
                          {file.file_name}
                        </p>
                        <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                          {formatFileSize(file.file_size)} · {new Date(file.uploaded_at).toLocaleDateString('cs-CZ')}
                          {file.parsed_at && ` · parsováno ${new Date(file.parsed_at).toLocaleDateString('cs-CZ')}`}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      {getParseStatusBadge(file.parse_status)}
                      <div style={{ display: 'flex', gap: '6px' }}>
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
                            <BarChart2 style={{ width: 11, height: 11 }} />
                            {selectedFileId === file.file_id ? 'Skrýt' : 'Souhrn'}
                          </button>
                        )}
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
                            <RefreshCw style={{ width: 11, height: 11 }} /> Parsovat
                          </button>
                        )}
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
                            <RefreshCw style={{ width: 11, height: 11 }} />
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
            <button
              onClick={() => setSummaryOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', background: '#f8fafc', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, color: '#1e293b',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 style={{ width: 16, height: 16, color: '#3b82f6' }} />
                Výsledky parsování
              </span>
              {summaryOpen
                ? <ChevronUp style={{ width: 16, height: 16, color: '#6b7280' }} />
                : <ChevronDown style={{ width: 16, height: 16, color: '#6b7280' }} />
              }
            </button>

            {summaryOpen && (
              <div style={{ padding: '0 20px 16px' }}>
                {summaryLoading && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '13px' }}>
                    <Loader style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                    Načítání souhrnu...
                  </div>
                )}

                {summaryError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>
                    {summaryError}
                  </div>
                )}

                {parsedSummary && !summaryLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px' }}>

                    {/* Metadata */}
                    {(parsedSummary.metadata.stavba || parsedSummary.metadata.objekt) && (
                      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#374151' }}>
                        {parsedSummary.metadata.stavba && <p style={{ margin: '0 0 2px' }}><strong>Stavba:</strong> {parsedSummary.metadata.stavba}</p>}
                        {parsedSummary.metadata.objekt && <p style={{ margin: '0 0 2px' }}><strong>Objekt:</strong> {parsedSummary.metadata.objekt}</p>}
                        {parsedSummary.metadata.soupis && <p style={{ margin: 0 }}><strong>Soupis:</strong> {parsedSummary.metadata.soupis}</p>}
                      </div>
                    )}

                    {/* Totals */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      {[
                        { label: 'Položky celkem', value: parsedSummary.summary.totalItems.toString() },
                        { label: 'Listy', value: parsedSummary.summary.totalSheets.toString() },
                        { label: 'S cenou', value: parsedSummary.summary.withPrice.toString() },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                          <p style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{item.value}</p>
                          <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>{item.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Total price */}
                    {parsedSummary.summary.totalCena > 0 && (
                      <div style={{
                        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
                        padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 500 }}>Celková cena</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#15803d' }}>{formatCZK(parsedSummary.summary.totalCena)}</span>
                      </div>
                    )}

                    {/* By type breakdown */}
                    {Object.keys(parsedSummary.summary.byType).length > 0 && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Typy prací
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {Object.entries(parsedSummary.summary.byType)
                            .sort(([, a], [, b]) => b.count - a.count)
                            .map(([type, data]) => (
                              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${Math.round((data.count / parsedSummary.summary.totalItems) * 100)}%`,
                                    height: '100%', background: '#3b82f6', borderRadius: '999px',
                                  }} />
                                </div>
                                <span style={{ fontSize: '12px', color: '#374151', width: 110, flexShrink: 0 }}>
                                  {WORK_TYPE_LABELS[type] || type}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', width: 30, textAlign: 'right' }}>
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
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Listy ({parsedSummary.sheets.length})
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {parsedSummary.sheets.map(sheet => (
                            <div key={sheet.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '5px 10px', background: '#f8fafc', borderRadius: '6px' }}>
                              <span style={{ color: '#374151', fontWeight: 500 }}>{sheet.bridgeName || sheet.name}</span>
                              <span style={{ color: '#6b7280' }}>{sheet.itemCount} pol.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Kiosk suggestions */}
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Otevřít v kiosku
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(Object.entries(KIOSK_META) as Array<[keyof typeof KIOSK_META, typeof KIOSK_META[keyof typeof KIOSK_META]]>).map(([key, meta]) => {
                          const suggestion = parsedSummary.summary.kioskSuggestions[key];
                          return (
                            <button
                              key={key}
                              onClick={() => openInKiosk(key)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', borderRadius: '8px',
                                border: `1px solid ${meta.color}30`,
                                background: meta.bg, cursor: 'pointer',
                                transition: 'opacity 0.15s',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px' }}>{meta.icon}</span>
                                <div style={{ textAlign: 'left' }}>
                                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>{meta.label}</p>
                                  <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{suggestion.description}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  fontSize: '12px', fontWeight: 700, color: meta.color,
                                  background: '#fff', padding: '2px 8px', borderRadius: '999px',
                                  border: `1px solid ${meta.color}40`,
                                }}>
                                  {suggestion.count} pol.
                                </span>
                                <ExternalLink style={{ width: 14, height: 14, color: meta.color, opacity: 0.6 }} />
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

        {/* ── Kiosk Links ───────────────────────────────────────────────── */}
        <KioskLinksPanel projectId={project.portal_project_id} onRefresh={onRefresh} />

        {/* ── Positions ──────────────────────────────────────────────────── */}
        <PositionsPanel projectId={project.portal_project_id} />

        {/* ── Bottom actions ───────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {project.core_status === 'not_sent' && (
              <button
                onClick={handleSendToCORE}
                disabled={sending || files.length === 0}
                style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: '6px', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  color: '#fff',
                  background: (sending || files.length === 0) ? '#d1d5db' : '#3b82f6',
                  border: 'none', cursor: (sending || files.length === 0) ? 'not-allowed' : 'pointer',
                }}
              >
                <Send style={{ width: 14, height: 14 }} />
                {sending ? 'Odesílání...' : 'Odeslat do CORE'}
              </button>
            )}

            {project.core_status === 'completed' && (
              <button
                onClick={() => alert('TODO: zobrazit výsledky CORE analýzy')}
                style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: '6px', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
                  color: '#374151', background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer',
                }}
              >
                <FileText style={{ width: 14, height: 14 }} />
                Výsledky CORE
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
                color: '#374151', background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer',
              }}
            >
              Zavřít
            </button>
          </div>

          <div style={{
            marginTop: '12px', padding: '10px 14px',
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
          }}>
            <p style={{ fontSize: '11px', color: '#1d4ed8', margin: 0 }}>
              <strong>Jak to funguje:</strong> Nahrejte Excel (výkaz výměr) → Portál jej automaticky zparsuje →
              Klikněte <em>Souhrn</em> u souboru → Otevřete libovolný kiosk s předvyplněnými daty.
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );

  if (inline) {
    return content;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', zIndex: 50,
    }}>
      {content}
    </div>
  );
}
