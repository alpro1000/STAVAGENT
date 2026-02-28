/**
 * ParsePreviewModal — Universal Parser Phase 2 UI
 *
 * Lets user drag-drop an Excel file → server parses it instantly →
 * shows summary preview (metadata, sheets, work types, kiosk suggestions).
 *
 * "Send to Kiosk" buttons open the target kiosk in a new tab.
 * No project required, no database storage.
 *
 * Backend: POST /api/parse-preview  (portal backend)
 */

import { useState, useRef, DragEvent } from 'react';
import {
  X, Upload, FileSpreadsheet, Loader2, CheckCircle2,
  AlertTriangle, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import { API_URL } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SheetStats {
  totalItems: number;
  totalCena: number;
  byType: Record<string, number>;
  sections: string[];
}

interface SheetPreview {
  name: string;
  bridgeId?: string;
  bridgeName?: string;
  itemCount: number;
  stats: SheetStats;
}

interface KioskSuggestion {
  count: number;
  types: string[];
  description: string;
}

interface ParseSummary {
  totalItems: number;
  totalSheets: number;
  totalCena: number;
  byType: Record<string, number>;
  withConcreteGrade: number;
  withCode: number;
  withPrice: number;
  kioskSuggestions: {
    monolit: KioskSuggestion;
    registry: KioskSuggestion;
    urs_matcher: KioskSuggestion;
  };
}

interface ParseMetadata {
  stavba?: string;
  objekt?: string;
  soupis?: string;
  fileName: string;
  sheetCount: number;
  parsedSheetCount: number;
}

interface ParseResult {
  success: boolean;
  metadata: ParseMetadata;
  summary: ParseSummary;
  sheets: SheetPreview[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIOSK_URLS: Record<string, string> = {
  monolit: 'https://monolit-planner-frontend.vercel.app',
  registry: 'https://stavagent-backend-ktwx.vercel.app',
  urs_matcher: 'https://urs-matcher-service.onrender.com',
};

const KIOSK_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  monolit: { name: 'Monolit Planner', icon: '🪨', color: '#6366f1' },
  registry: { name: 'Registr Rozpočtů', icon: '📊', color: '#0ea5e9' },
  urs_matcher: { name: 'URS Matcher', icon: '🔎', color: '#10b981' },
};

const TYPE_LABELS: Record<string, string> = {
  beton: 'Beton',
  bedneni: 'Bednění',
  vyztuze: 'Výztuž',
  zemni: 'Zemní práce',
  izolace: 'Izolace',
  komunikace: 'Komunikace',
  piloty: 'Piloty',
  kotveni: 'Kotvení',
  prefab: 'Prefabrikáty',
  doprava: 'Doprava',
  unknown: 'Ostatní',
};

function fmt(n: number) {
  return n.toLocaleString('cs-CZ');
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ParsePreviewModalProps {
  onClose: () => void;
}

interface ImportResultData {
  success: boolean;
  project_id: string;
  project_name: string;
  objects_created: number;
  instances_created: number;
}

export default function ParsePreviewModal({ onClose }: ParsePreviewModalProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);

  const handleImportToPortal = async () => {
    if (!lastFileRef.current || !result) return;

    setImporting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', lastFileRef.current);
    formData.append('project_name', result.metadata.stavba || result.metadata.objekt || result.metadata.fileName);

    try {
      const res = await fetch(`${API_URL}/api/parse-preview/import`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Import selhal');
      }

      setImportResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při importu');
    } finally {
      setImporting(false);
    }
  };

  const parseFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx?|xls)$/i)) {
      setError('Podporovány jsou pouze soubory .xlsx a .xls');
      return;
    }

    setUploading(true);
    setResult(null);
    setImportResult(null);
    setError(null);
    lastFileRef.current = file;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/parse-preview`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se zpracovat soubor');
      }

      setResult(data);
      // Auto-expand first sheet
      if (data.sheets.length > 0) {
        setExpandedSheets(new Set([data.sheets[0].name]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při nahrávání');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const toggleSheet = (name: string) => {
    setExpandedSheets(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-primary, #1a1a2e)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '840px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--brand-orange)' }} />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Universal Parser — Náhled výkazu
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Nahrajte Excel · zjistěte typy prací · odešlete do kiosku
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Upload zone */}
          {!result && !uploading && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--brand-orange)' : 'var(--border-color)'}`,
                borderRadius: '10px',
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'rgba(255,159,28,0.05)' : 'var(--bg-secondary)',
                transition: 'all 0.2s',
              }}
            >
              <Upload size={36} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }} />
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Přetáhněte Excel soubor sem
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                nebo klikněte pro výběr souboru · .xlsx · .xls · max 20 MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileChange}
                style={{ display: 'none' }}
              />
              <button
                className="c-btn c-btn--primary"
                style={{ pointerEvents: 'none' }}
              >
                <Upload size={16} />
                Vybrat soubor
              </button>
            </div>
          )}

          {/* Loading */}
          {uploading && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Loader2 size={36} style={{ color: 'var(--brand-orange)', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Parsování souboru…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}>
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Re-upload button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="c-btn c-btn--sm"
                  onClick={() => { setResult(null); setError(null); fileInputRef.current?.click(); }}
                  style={{ fontSize: '12px' }}
                >
                  <Upload size={13} />
                  Nahrát jiný soubor
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={onFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Metadata */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
              }}>
                {[
                  { label: 'Soubor', value: result.metadata.fileName },
                  { label: 'Stavba', value: result.metadata.stavba || '—' },
                  { label: 'Objekt', value: result.metadata.objekt || '—' },
                  { label: 'Soupis', value: result.metadata.soupis || '—' },
                  { label: 'Celkem položek', value: fmt(result.summary.totalItems) },
                  { label: 'Celkem Kč', value: result.summary.totalCena > 0 ? `${fmt(Math.round(result.summary.totalCena))} Kč` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    padding: '10px 14px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Work types summary */}
              {Object.keys(result.summary.byType).length > 0 && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Typy prací
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {Object.entries(result.summary.byType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <span key={type} style={{
                          padding: '4px 10px',
                          borderRadius: '14px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                        }}>
                          {TYPE_LABELS[type] || type} <strong>{count}</strong>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Kiosk suggestions */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Doporučené kiosky
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {Object.entries(result.summary.kioskSuggestions).map(([kioskId, suggestion]) => {
                    const info = KIOSK_LABELS[kioskId];
                    if (!info || suggestion.count === 0) return null;
                    return (
                      <div key={kioskId} style={{
                        padding: '14px',
                        background: 'var(--bg-secondary)',
                        border: `1px solid ${info.color}40`,
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>{info.icon}</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {info.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {fmt(suggestion.count)} položek · {suggestion.types.slice(0, 3).map(t => TYPE_LABELS[t] || t).join(', ')}
                            </div>
                          </div>
                        </div>
                        <a
                          href={KIOSK_URLS[kioskId]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="c-btn c-btn--sm"
                          style={{
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            justifyContent: 'center',
                            color: 'white',
                            background: info.color,
                            border: 'none',
                          }}
                        >
                          <ExternalLink size={13} />
                          Otevřít {info.name}
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Import to Portal */}
              <div style={{
                padding: '14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
              }}>
                {importResult ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Import dokoncen
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {importResult.project_name} — {fmt(importResult.instances_created)} pozic, {fmt(importResult.objects_created)} objektu
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Importovat do Portal DB
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Vytvorit PositionInstance pro kazdy radek — umozni propojeni s kiosky
                      </div>
                    </div>
                    <button
                      className="c-btn c-btn--primary c-btn--sm"
                      onClick={handleImportToPortal}
                      disabled={importing}
                      style={{ flexShrink: 0 }}
                    >
                      {importing ? (
                        <>
                          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                          Importuji...
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          Importovat
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Sheets breakdown */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Listy ({result.sheets.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {result.sheets.map(sheet => {
                    const expanded = expandedSheets.has(sheet.name);
                    return (
                      <div key={sheet.name} style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}>
                        <button
                          onClick={() => toggleSheet(sheet.name)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: 'var(--bg-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            gap: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                            <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {sheet.name}
                              </span>
                              {sheet.bridgeName && (
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                                  {sheet.bridgeId} — {sheet.bridgeName}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {fmt(sheet.itemCount)} pol.
                            </span>
                            {sheet.stats.totalCena > 0 && (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-orange)' }}>
                                {fmt(Math.round(sheet.stats.totalCena))} Kč
                              </span>
                            )}
                            {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />}
                          </div>
                        </button>

                        {expanded && (
                          <div style={{ padding: '12px 14px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)' }}>
                            {/* Section headers */}
                            {sheet.stats.sections.length > 0 && (
                              <div style={{ marginBottom: '10px' }}>
                                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                  Díly
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {sheet.stats.sections.slice(0, 10).map(sec => (
                                    <span key={sec} style={{
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      background: 'var(--bg-secondary)',
                                      fontSize: '11px',
                                      color: 'var(--text-secondary)',
                                    }}>
                                      {sec}
                                    </span>
                                  ))}
                                  {sheet.stats.sections.length > 10 && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      +{sheet.stats.sections.length - 10} dalších
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Types per sheet */}
                            {Object.keys(sheet.stats.byType).length > 0 && (
                              <div>
                                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                  Typy prací
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {Object.entries(sheet.stats.byType).map(([type, count]) => (
                                    <span key={type} style={{
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      background: 'var(--bg-secondary)',
                                      fontSize: '11px',
                                      color: 'var(--text-primary)',
                                    }}>
                                      {TYPE_LABELS[type] || type} {count}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
