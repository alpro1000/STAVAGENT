/**
 * ParsePreviewModal — Universal Parser Pipeline
 *
 * 3-Step flow:
 *   Step 1: Upload Excel → show metadata + kiosk suggestions (lightweight preview)
 *   Step 2: "Zobrazit pozice" → full parse → table of ALL items with classifications
 *   Step 3: "Uložit do projektu" → /import → shows project ID + kiosk link buttons
 *
 * Backend:
 *   POST /api/parse-preview       (Step 1: metadata only, no items)
 *   POST /api/parse-preview/full  (Step 2: all items with classifications)
 *   POST /api/parse-preview/import (Step 3: create project + positions in DB)
 */

import { useState, useRef, DragEvent } from 'react';
import {
  X, Upload, FileSpreadsheet, Loader2, CheckCircle2,
  AlertTriangle, ExternalLink, ChevronDown, ChevronUp,
  Table2, Save, Link2,
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

interface ParsedItem {
  id: string;
  kod: string;
  popis: string;
  popisFull: string;
  mj: string;
  mnozstvi: number;
  cenaJednotkova: number | null;
  cenaCelkem: number | null;
  detectedType: string;
  skupina: string | null;
  concreteGrade: string | null;
  codeType: string | null;
  section: string | null;
}

interface FullSheet {
  name: string;
  bridgeId?: string;
  bridgeName?: string;
  itemCount: number;
  stats: SheetStats;
  items: ParsedItem[];
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

interface FullParseResult {
  success: boolean;
  metadata: ParseMetadata;
  summary: ParseSummary;
  sheets: FullSheet[];
}

interface ImportResultData {
  success: boolean;
  project_id: string;
  project_name: string;
  objects_created: number;
  instances_created: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIOSK_URLS: Record<string, string> = {
  monolit: 'https://monolit-planner-frontend.vercel.app',
  registry: 'https://stavagent-backend-ktwx.vercel.app',
  urs_matcher: 'https://urs-matcher-service-1086027517695.europe-west3.run.app',
};

const KIOSK_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  monolit: { name: 'Monolit Planner', icon: '🪨', color: '#6366f1' },
  registry: { name: 'Registr Rozpočtů', icon: '📊', color: '#0ea5e9' },
  urs_matcher: { name: 'URS Matcher', icon: '🔎', color: '#10b981' },
};

const TYPE_LABELS: Record<string, string> = {
  beton: 'Beton', bedneni: 'Bednění', vyztuze: 'Výztuž',
  zemni: 'Zemní práce', izolace: 'Izolace', komunikace: 'Komunikace',
  piloty: 'Piloty', kotveni: 'Kotvení', prefab: 'Prefab', doprava: 'Doprava',
  unknown: 'Ostatní',
};

const TYPE_COLORS: Record<string, string> = {
  beton: '#6366f1', bedneni: '#8b5cf6', vyztuze: '#ec4899',
  zemni: '#a3763d', izolace: '#06b6d4', komunikace: '#64748b',
  piloty: '#d97706', kotveni: '#ef4444', prefab: '#0ea5e9', doprava: '#10b981',
  unknown: '#9ca3af',
};

const SKUPINA_LABELS: Record<string, string> = {
  BETON_MONOLIT: 'BETON_MONOLIT', BEDNENI: 'BEDNENI', 'VYZTUŽ': 'VYZTUŽ',
  ZEMNI_PRACE: 'ZEMNI_PRACE', IZOLACE: 'IZOLACE', KOMUNIKACE: 'KOMUNIKACE',
  PILOTY: 'PILOTY', KOTVENI: 'KOTVENI', BETON_PREFAB: 'BETON_PREFAB', DOPRAVA: 'DOPRAVA',
};

function fmt(n: number) { return n.toLocaleString('cs-CZ'); }

// ─── Component ────────────────────────────────────────────────────────────────

interface ParsePreviewModalProps {
  onClose: () => void;
}

type Step = 'upload' | 'preview' | 'positions' | 'saved';

export default function ParsePreviewModal({ onClose }: ParsePreviewModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Preview
  const [preview, setPreview] = useState<ParseResult | null>(null);
  // Step 2: Full positions
  const [fullData, setFullData] = useState<FullParseResult | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  // Step 3: Import result
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);

  // ── Step 1: Upload & Preview ────────────────────────────────────────────

  const parseFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx?|xls)$/i)) {
      setError('Podporovány jsou pouze soubory .xlsx a .xls');
      return;
    }

    setLoading(true);
    setPreview(null);
    setFullData(null);
    setImportResult(null);
    setError(null);
    lastFileRef.current = file;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/parse-preview`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Nepodařilo se zpracovat soubor');

      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při nahrávání');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Full parse with all positions ───────────────────────────────

  const loadFullPositions = async () => {
    if (!lastFileRef.current) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', lastFileRef.current);

    try {
      const res = await fetch(`${API_URL}/api/parse-preview/full`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Nepodařilo se načíst pozice');

      setFullData(data);
      if (data.sheets.length > 0) setActiveSheet(data.sheets[0].name);
      setStep('positions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání pozic');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Import to Portal DB ────────────────────────────────────────

  const handleImport = async () => {
    if (!lastFileRef.current) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', lastFileRef.current);
    const name = preview?.metadata.stavba || preview?.metadata.objekt || preview?.metadata.fileName || 'Import';
    formData.append('project_name', name);

    try {
      const res = await fetch(`${API_URL}/api/parse-preview/import`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Import selhal');

      setImportResult(data);
      setStep('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při importu');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 4: Push to kiosk + open ──────────────────────────────────────

  const [pushing, setPushing] = useState<string | null>(null);

  const handlePushToKiosk = async (kioskId: string) => {
    if (!importResult?.project_id) return;

    setPushing(kioskId);
    try {
      // Fetch positions formatted for the kiosk
      const res = await fetch(`${API_URL}/api/integration/for-registry/${importResult.project_id}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Nepodařilo se načíst pozice');

      // Build kiosk URL with project data
      const kioskUrl = KIOSK_URLS[kioskId];
      const info = KIOSK_LABELS[kioskId];
      if (!kioskUrl) throw new Error('Neznámý kiosk');

      if (kioskId === 'registry') {
        // Push positions to Registry via import-from-registry endpoint
        const syncRes = await fetch(`${API_URL}/api/integration/import-from-registry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portal_project_id: importResult.project_id,
            project_name: importResult.project_name,
            sheets: data.project.sheets,
          }),
        });
        const syncData = await syncRes.json();
        if (!syncRes.ok || !syncData.success) throw new Error(syncData.error || 'Sync selhal');

        // Open Registry with linked project
        window.open(`${kioskUrl}/?project_id=${syncData.portal_project_id}&portal_project=${importResult.project_id}`, '_blank');

      } else if (kioskId === 'monolit') {
        // Open Monolit with portal project reference (Monolit pulls data on its own)
        window.open(`${kioskUrl}/?portal_project=${importResult.project_id}`, '_blank');

      } else {
        // URS Matcher / others — open with query params
        window.open(`${kioskUrl}/?portal_project=${importResult.project_id}`, '_blank');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push selhal');
    } finally {
      setPushing(null);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setFullData(null);
    setImportResult(null);
    setError(null);
    lastFileRef.current = null;
  };

  const currentSheet = fullData?.sheets.find(s => s.name === activeSheet);
  const filteredItems = currentSheet?.items.filter(i =>
    !typeFilter || i.detectedType === typeFilter
  ) || [];

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '24px',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-primary, #1a1a2e)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: step === 'positions' ? '1100px' : '840px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'max-width 0.3s',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--brand-orange)' }} />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Universal Parser
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                {step === 'upload' && 'Nahrajte Excel výkaz výměr'}
                {step === 'preview' && `${preview?.metadata.fileName} — ${fmt(preview?.summary.totalItems || 0)} položek`}
                {step === 'positions' && `${fullData?.metadata.fileName} — všechny pozice s klasifikací`}
                {step === 'saved' && `Uloženo: ${importResult?.project_name}`}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {step !== 'upload' && (
              <button className="c-btn c-btn--sm" onClick={reset} style={{ fontSize: '11px' }}>
                <Upload size={12} /> Nový soubor
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color)',
          fontSize: '11px', fontWeight: 600, flexShrink: 0,
        }}>
          {[
            { key: 'upload', label: '1. Nahrát' },
            { key: 'preview', label: '2. Náhled' },
            { key: 'positions', label: '3. Pozice' },
            { key: 'saved', label: '4. Uloženo' },
          ].map(({ key, label }) => {
            const steps: Step[] = ['upload', 'preview', 'positions', 'saved'];
            const idx = steps.indexOf(key as Step);
            const currentIdx = steps.indexOf(step);
            const active = key === step;
            const done = idx < currentIdx;
            return (
              <div key={key} style={{
                flex: 1, padding: '8px 12px', textAlign: 'center',
                background: active ? 'rgba(255,159,28,0.1)' : done ? 'rgba(16,185,129,0.06)' : 'transparent',
                color: active ? 'var(--brand-orange)' : done ? '#10b981' : 'var(--text-secondary)',
                borderBottom: active ? '2px solid var(--brand-orange)' : '2px solid transparent',
              }}>
                {done ? '✓ ' : ''}{label}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Loader2 size={36} style={{ color: 'var(--brand-orange)', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {step === 'upload' ? 'Parsování souboru…' : step === 'preview' ? 'Načítání všech pozic…' : 'Ukládání do databáze…'}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: '8px', color: '#dc2626', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
            }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* ── STEP 1: Upload ──────────────────────────────────────────── */}
          {step === 'upload' && !loading && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--brand-orange)' : 'var(--border-color)'}`,
                borderRadius: '10px', padding: '48px 24px', textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'rgba(255,159,28,0.05)' : 'var(--bg-secondary)',
              }}
            >
              <Upload size={36} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }} />
              <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>Přetáhněte Excel soubor sem</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                .xlsx · .xls · max 20 MB
              </p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
                style={{ display: 'none' }}
              />
              <button className="c-btn c-btn--primary" style={{ pointerEvents: 'none' }}>
                <Upload size={16} /> Vybrat soubor
              </button>
            </div>
          )}

          {/* ── STEP 2: Preview (metadata + summary) ───────────────────── */}
          {step === 'preview' && preview && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Metadata grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                {[
                  { label: 'Soubor', value: preview.metadata.fileName },
                  { label: 'Stavba', value: preview.metadata.stavba || '—' },
                  { label: 'Objekt', value: preview.metadata.objekt || '—' },
                  { label: 'Položek', value: fmt(preview.summary.totalItems) },
                  { label: 'Celkem Kč', value: preview.summary.totalCena > 0 ? `${fmt(Math.round(preview.summary.totalCena))} Kč` : '—' },
                  { label: 'S ceníkem', value: String(preview.summary.withConcreteGrade || 0) + ' betonů' },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    padding: '10px 12px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)', borderRadius: '8px',
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Work types */}
              {Object.keys(preview.summary.byType).length > 0 && (
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Klasifikace prací
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {Object.entries(preview.summary.byType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <span key={type} style={{
                          padding: '3px 10px', borderRadius: '12px',
                          background: `${TYPE_COLORS[type] || '#9ca3af'}18`,
                          border: `1px solid ${TYPE_COLORS[type] || '#9ca3af'}40`,
                          fontSize: '12px', color: TYPE_COLORS[type] || '#9ca3af',
                          fontWeight: 600,
                        }}>
                          {TYPE_LABELS[type] || type} {count}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Sheets */}
              <div>
                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Listy ({preview.sheets.length})
                </p>
                {preview.sheets.map(sh => (
                  <div key={sh.name} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)', borderRadius: '6px',
                    marginBottom: '4px', fontSize: '13px',
                  }}>
                    <span style={{ fontWeight: 600 }}>{sh.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {fmt(sh.itemCount)} pol.
                      {sh.stats.totalCena > 0 && ` · ${fmt(Math.round(sh.stats.totalCena))} Kč`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Kiosk suggestions */}
              <div>
                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Doporučené kiosky
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                  {Object.entries(preview.summary.kioskSuggestions).map(([kioskId, suggestion]) => {
                    const info = KIOSK_LABELS[kioskId];
                    if (!info || suggestion.count === 0) return null;
                    return (
                      <div key={kioskId} style={{
                        padding: '12px', background: 'var(--bg-secondary)',
                        border: `1px solid ${info.color}30`, borderRadius: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '16px' }}>{info.icon}</span>
                          <strong style={{ fontSize: '13px' }}>{info.name}</strong>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {fmt(suggestion.count)} položek · {suggestion.types.slice(0, 3).map(t => TYPE_LABELS[t] || t).join(', ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button className="c-btn c-btn--primary" onClick={loadFullPositions}
                  style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Table2 size={14} /> Zobrazit všechny pozice
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Positions table ────────────────────────────────── */}
          {step === 'positions' && fullData && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Sheet tabs + type filter */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {fullData.sheets.map(sh => (
                  <button key={sh.name}
                    onClick={() => { setActiveSheet(sh.name); setTypeFilter(''); }}
                    style={{
                      padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                      border: '1px solid var(--border-color)', cursor: 'pointer',
                      background: activeSheet === sh.name ? 'var(--brand-orange)' : 'var(--bg-secondary)',
                      color: activeSheet === sh.name ? 'white' : 'var(--text-primary)',
                    }}
                  >
                    {sh.name} ({sh.itemCount})
                  </button>
                ))}

                <div style={{ marginLeft: 'auto' }}>
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    style={{
                      padding: '4px 8px', borderRadius: '6px', fontSize: '12px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">Všechny typy ({currentSheet?.items.length})</option>
                    {currentSheet && Object.entries(
                      currentSheet.items.reduce<Record<string, number>>((acc, i) => {
                        acc[i.detectedType] = (acc[i.detectedType] || 0) + 1;
                        return acc;
                      }, {})
                    ).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                      <option key={type} value={type}>{TYPE_LABELS[type] || type} ({count})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary stats bar */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)', padding: '4px 0' }}>
                <span>Zobrazeno: <strong>{fmt(filteredItems.length)}</strong> pozic</span>
                {currentSheet && <span>Celkem Kč: <strong style={{ color: 'var(--brand-orange)' }}>
                  {fmt(Math.round(filteredItems.reduce((s, i) => s + (i.cenaCelkem || 0), 0)))}
                </strong></span>}
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Kód</th>
                      <th style={{ ...thStyle, textAlign: 'left', minWidth: '250px' }}>Popis</th>
                      <th style={thStyle}>MJ</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Množství</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Cena/MJ</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Celkem</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Typ</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Skupina</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Beton</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, i) => (
                      <tr key={item.id} style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                      }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {item.kod || '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'left', maxWidth: '350px' }}>
                          <div style={{ lineHeight: 1.3 }}>
                            {item.popis}
                            {item.section && (
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {item.section}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{item.mj || '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                          {item.mnozstvi ? fmt(item.mnozstvi) : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                          {item.cenaJednotkova ? fmt(Math.round(item.cenaJednotkova)) : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                          {item.cenaCelkem ? fmt(Math.round(item.cenaCelkem)) : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{
                            padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700,
                            background: `${TYPE_COLORS[item.detectedType] || '#9ca3af'}18`,
                            color: TYPE_COLORS[item.detectedType] || '#9ca3af',
                          }}>
                            {TYPE_LABELS[item.detectedType] || item.detectedType}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {item.skupina ? (
                            <span style={{
                              padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                              background: 'rgba(0,0,0,0.06)', letterSpacing: '0.03em',
                            }}>
                              {item.skupina}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {item.concreteGrade ? (
                            <span style={{
                              padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700,
                              background: '#6366f118', color: '#6366f1',
                            }}>
                              {item.concreteGrade}
                            </span>
                          ) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action: Save to project */}
              <div style={{
                display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)', borderRadius: '8px',
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Uložit do projektu Portal</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Vytvoří projekt + {fmt(fullData.summary.totalItems)} pozic v databázi → propojení s kiosky
                  </div>
                </div>
                <button className="c-btn c-btn--primary" onClick={handleImport}
                  style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  <Save size={14} /> Uložit a propojit
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Saved — show kiosk links ──────────────────────── */}
          {step === 'saved' && importResult && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Success banner */}
              <div style={{
                padding: '16px', borderRadius: '8px',
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#059669', fontSize: '14px' }}>
                  <CheckCircle2 size={18} /> Import dokončen
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '8px' }}>
                  Projekt: <strong>{importResult.project_name}</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {fmt(importResult.instances_created)} pozic · {fmt(importResult.objects_created)} objektů · ID: {importResult.project_id}
                </div>
              </div>

              {/* Kiosk connection buttons */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Propojit s kioskem
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {Object.entries(KIOSK_LABELS).map(([kioskId, info]) => {
                    const isPushing = pushing === kioskId;
                    return (
                      <div key={kioskId} style={{
                        padding: '16px', background: 'var(--bg-secondary)',
                        border: `1px solid ${info.color}30`, borderRadius: '8px',
                        display: 'flex', flexDirection: 'column', gap: '10px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{info.icon}</span>
                          <strong style={{ fontSize: '14px' }}>{info.name}</strong>
                        </div>
                        <button
                          onClick={() => handlePushToKiosk(kioskId)}
                          disabled={isPushing}
                          className="c-btn c-btn--sm"
                          style={{
                            display: 'flex', alignItems: 'center',
                            gap: '6px', justifyContent: 'center',
                            color: 'white', background: isPushing ? '#9ca3af' : info.color,
                            border: 'none', cursor: isPushing ? 'wait' : 'pointer',
                          }}
                        >
                          {isPushing ? (
                            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Link2 size={13} />
                          )}
                          {isPushing ? 'Odesílám…' : 'Odeslat a otevřít'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Open in Portal projects tab */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
                <button className="c-btn" onClick={onClose}>
                  Zavřít
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontWeight: 600,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  whiteSpace: 'nowrap',
};
