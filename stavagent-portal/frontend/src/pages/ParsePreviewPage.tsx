/**
 * ParsePreviewPage — Full-page view for parsed Excel file data
 *
 * Route: /parse-preview/:fileId
 *
 * Shows:
 *  - Parse status indicator (parsing → parsed → error)
 *  - Metadata (stavba, objekt, soupis)
 *  - Summary stats (items, sheets, price, work types)
 *  - Sheet tabs with positions table (full items with classification)
 *  - "Open in Kiosk" buttons per kiosk type
 *
 * Backend endpoints used:
 *  - GET /api/portal-files/:fileId/parsed-data          (full data)
 *  - GET /api/portal-files/:fileId/parsed-data/summary  (lightweight)
 *  - GET /api/portal-files/:fileId/parsed-data/for-kiosk/:type
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileSpreadsheet, Loader2, CheckCircle2,
  AlertTriangle, XCircle, ExternalLink,
  RefreshCw, Filter,
} from 'lucide-react';
import { API_URL } from '../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParseMetadata {
  stavba?: string;
  objekt?: string;
  soupis?: string;
  fileName: string;
  sheetCount: number;
  parsedSheetCount: number;
}

interface ByTypeEntry {
  count: number;
  totalCena: number;
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
  byType: Record<string, ByTypeEntry>;
  withConcreteGrade: number;
  withCode: number;
  withPrice: number;
  kioskSuggestions: {
    monolit: KioskSuggestion;
    registry: KioskSuggestion;
    urs_matcher: KioskSuggestion;
  };
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

interface ParsedSheet {
  name: string;
  bridgeId?: string;
  bridgeName?: string;
  itemCount: number;
  stats: {
    totalItems: number;
    totalCena: number;
    byType: Record<string, ByTypeEntry | number>;
    sections: string[];
  };
  items: ParsedItem[];
}

interface FullParsedData {
  success: boolean;
  file_id: string;
  file_name: string;
  parsed_at: string;
  data: {
    metadata: ParseMetadata;
    summary: ParseSummary;
    sheets: ParsedSheet[];
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const KIOSK_META: Record<string, { label: string; icon: string; color: string; bg: string; buildUrl: (fileId: string, portalUrl: string) => string }> = {
  monolit: {
    label: 'Monolit Planner',
    icon: '\u{1FAA8}',
    color: '#6366f1',
    bg: '#eef2ff',
    buildUrl: (fileId, portalUrl) =>
      `https://monolit-planner-frontend.vercel.app?portal_file_id=${fileId}&portal_api=${encodeURIComponent(portalUrl)}`,
  },
  registry: {
    label: 'Registr Rozpočtů',
    icon: '\u{1F4CA}',
    color: '#0ea5e9',
    bg: '#f0f9ff',
    buildUrl: (fileId, portalUrl) =>
      `https://stavagent-backend-ktwx.vercel.app?portal_file_id=${fileId}&portal_api=${encodeURIComponent(portalUrl)}`,
  },
  urs_matcher: {
    label: 'Klasifikátor stavebních prací',
    icon: '\u{1F50E}',
    color: '#10b981',
    bg: '#ecfdf5',
    buildUrl: (fileId, portalUrl) =>
      `https://urs-matcher-service-1086027517695.europe-west3.run.app?portal_file_id=${fileId}&portal_api=${encodeURIComponent(portalUrl)}`,
  },
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string { return n.toLocaleString('cs-CZ'); }
function fmtCZK(n: number): string {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ParsePreviewPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FullParsedData | null>(null);

  // Table state
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Load parsed data ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/portal-files/${fileId}/parsed-data`, {
        headers: authHeader(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Nepodařilo se načíst data');
      }
      setData(json);
      if (json.data.sheets.length > 0) {
        setActiveSheet(json.data.sheets[0].name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání');
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const currentSheet = data?.data.sheets.find(s => s.name === activeSheet);
  const filteredItems = (currentSheet?.items || []).filter(item => {
    if (typeFilter && item.detectedType !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.popis.toLowerCase().includes(q) ||
        item.kod.toLowerCase().includes(q) ||
        (item.concreteGrade?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const allItems = data?.data.sheets.flatMap(s => s.items) || [];
  const typeBreakdown = allItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.detectedType] = (acc[item.detectedType] || 0) + 1;
    return acc;
  }, {});

  // ── Kiosk navigation ──────────────────────────────────────────────────────

  const openInKiosk = (kioskType: string) => {
    if (!fileId) return;
    const meta = KIOSK_META[kioskType];
    if (!meta) return;
    window.open(meta.buildUrl(fileId, API_URL), '_blank');
  };

  // ── Render: Loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--app-bg-concrete, #f8f9fa)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={36} style={{ color: 'var(--brand-orange, #FF9F1C)', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-secondary, #6b7280)' }}>Načítání parsovaných dat...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Render: Error ─────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--app-bg-concrete, #f8f9fa)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <div className="c-panel" style={{ maxWidth: '480px', padding: '32px', textAlign: 'center' }}>
          <AlertTriangle size={36} style={{ color: '#ef4444', marginBottom: '12px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
            {error === 'File has not been parsed yet' ? 'Soubor ještě nebyl zparsován' : 'Chyba'}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary, #6b7280)', marginBottom: '20px' }}>
            {error || 'Data nejsou dostupná'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="c-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} /> Zpět
            </button>
            <button className="c-btn c-btn--primary" onClick={loadData}>
              <RefreshCw size={16} /> Zkusit znovu
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { metadata, summary, sheets } = data.data;

  // ── Render: Main Page ──────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--app-bg-concrete, #f8f9fa)',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--panel-clean, #fff)',
        borderBottom: '1px solid var(--border-color, #e5e7eb)',
        padding: '12px 24px',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="c-btn c-btn--ghost"
              onClick={() => navigate('/portal')}
              style={{ padding: '6px' }}
            >
              <ArrowLeft size={20} />
            </button>
            <FileSpreadsheet size={22} style={{ color: 'var(--brand-orange, #FF9F1C)' }} />
            <div>
              <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary, #1e293b)' }}>
                {metadata.fileName}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary, #6b7280)', margin: 0 }}>
                {fmt(summary.totalItems)} položek · {summary.totalSheets} listů
                {summary.totalCena > 0 && ` · ${fmtCZK(summary.totalCena)}`}
                {data.parsed_at && ` · parsováno ${new Date(data.parsed_at).toLocaleDateString('cs-CZ')}`}
              </p>
            </div>
          </div>

          {/* Parse status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '12px', padding: '4px 10px', borderRadius: '999px', fontWeight: 600,
              color: '#16a34a', background: '#dcfce7',
            }}>
              <CheckCircle2 size={14} /> Parsováno
            </span>
            <button className="c-btn c-btn--sm" onClick={loadData} title="Obnovit">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 24px' }}>

        {/* ── Top row: Metadata + Stats + Kiosks ─────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}>

          {/* Metadata card */}
          <div className="c-panel" style={{ padding: '16px' }}>
            <h3 style={sectionTitle}>Metadata</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { label: 'Soubor', value: metadata.fileName },
                { label: 'Stavba', value: metadata.stavba || '—' },
                { label: 'Objekt', value: metadata.objekt || '—' },
                { label: 'Soupis', value: metadata.soupis || '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary, #6b7280)', fontWeight: 500 }}>{label}</span>
                  <span style={{ color: 'var(--text-primary, #1e293b)', fontWeight: 600, textAlign: 'right', maxWidth: '200px', wordBreak: 'break-word' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '14px' }}>
              {[
                { label: 'Položky', value: fmt(summary.totalItems) },
                { label: 'S cenou', value: fmt(summary.withPrice) },
                { label: 'Betony', value: fmt(summary.withConcreteGrade) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>{value}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Work types card */}
          <div className="c-panel" style={{ padding: '16px' }}>
            <h3 style={sectionTitle}>Klasifikace prací</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Object.entries(typeBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-secondary, #e5e7eb)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.round((count / summary.totalItems) * 100)}%`,
                        height: '100%',
                        background: TYPE_COLORS[type] || '#9ca3af',
                        borderRadius: '999px',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary, #374151)', width: '90px', flexShrink: 0 }}>
                      {TYPE_LABELS[type] || type}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: TYPE_COLORS[type] || '#9ca3af', width: '30px', textAlign: 'right' }}>
                      {count}
                    </span>
                  </div>
                ))}
            </div>

            {summary.totalCena > 0 && (
              <div style={{
                marginTop: '12px', padding: '8px 12px', borderRadius: '8px',
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 500 }}>Celkem</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#059669' }}>{fmtCZK(summary.totalCena)}</span>
              </div>
            )}
          </div>

          {/* Kiosk buttons card */}
          <div className="c-panel" style={{ padding: '16px' }}>
            <h3 style={sectionTitle}>Otevřít v kiosku</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(KIOSK_META).map(([kioskId, meta]) => {
                const suggestion = summary.kioskSuggestions[kioskId as keyof typeof summary.kioskSuggestions];
                return (
                  <button
                    key={kioskId}
                    onClick={() => openInKiosk(kioskId)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '8px',
                      border: `1px solid ${meta.color}30`,
                      background: meta.bg, cursor: 'pointer',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{meta.icon}</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{meta.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)' }}>
                          {suggestion ? suggestion.description : 'Otevřít data'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {suggestion && suggestion.count > 0 && (
                        <span style={{
                          fontSize: '11px', fontWeight: 700, color: meta.color,
                          background: '#fff', padding: '2px 8px', borderRadius: '999px',
                          border: `1px solid ${meta.color}40`,
                        }}>
                          {suggestion.count} pol.
                        </span>
                      )}
                      <ExternalLink size={14} style={{ color: meta.color, opacity: 0.6 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Sheets section ──────────────────────────────────────────── */}
        {sheets.length > 0 && (
          <div className="c-panel" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Sheet tabs + filters */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 16px', flexWrap: 'wrap',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
              background: 'var(--bg-secondary, #f8fafc)',
            }}>
              {/* Sheet tabs */}
              {sheets.map(sh => (
                <button key={sh.name}
                  onClick={() => { setActiveSheet(sh.name); setTypeFilter(''); }}
                  style={{
                    padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    border: '1px solid var(--border-color, #e5e7eb)', cursor: 'pointer',
                    background: activeSheet === sh.name ? 'var(--brand-orange, #FF9F1C)' : 'var(--panel-clean, #fff)',
                    color: activeSheet === sh.name ? 'white' : 'var(--text-primary, #1e293b)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {sh.bridgeName || sh.name} ({sh.itemCount})
                </button>
              ))}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Search */}
              <input
                type="text"
                placeholder="Hledat..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '5px 10px', borderRadius: '6px', fontSize: '12px',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  background: 'var(--panel-clean, #fff)',
                  color: 'var(--text-primary, #1e293b)',
                  width: '140px',
                }}
              />

              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                style={{
                  padding: '5px 10px', borderRadius: '6px', fontSize: '12px',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  background: 'var(--panel-clean, #fff)',
                  color: 'var(--text-primary, #1e293b)',
                }}
              >
                <option value="">Všechny typy ({currentSheet?.items.length || 0})</option>
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

            {/* Summary stats bar */}
            <div style={{
              display: 'flex', gap: '20px', fontSize: '12px',
              color: 'var(--text-secondary, #6b7280)',
              padding: '8px 16px',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
            }}>
              <span>
                Zobrazeno: <strong style={{ color: 'var(--text-primary, #1e293b)' }}>{fmt(filteredItems.length)}</strong> pozic
              </span>
              <span>
                Celkem Kč: <strong style={{ color: 'var(--brand-orange, #FF9F1C)' }}>
                  {fmt(Math.round(filteredItems.reduce((s, i) => s + (i.cenaCelkem || 0), 0)))}
                </strong>
              </span>
              {typeFilter && (
                <button
                  onClick={() => setTypeFilter('')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', padding: '1px 8px', borderRadius: '999px',
                    background: `${TYPE_COLORS[typeFilter] || '#9ca3af'}15`,
                    border: `1px solid ${TYPE_COLORS[typeFilter] || '#9ca3af'}40`,
                    color: TYPE_COLORS[typeFilter] || '#9ca3af',
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  <Filter size={10} /> {TYPE_LABELS[typeFilter] || typeFilter} <XCircle size={10} />
                </button>
              )}
            </div>

            {/* Positions table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary, #f8fafc)', borderBottom: '2px solid var(--border-color, #e5e7eb)' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Kód</th>
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: '280px' }}>Popis</th>
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
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary, #6b7280)' }}>
                        {searchQuery || typeFilter ? 'Žádné položky odpovídající filtru' : 'Žádné položky'}
                      </td>
                    </tr>
                  ) : filteredItems.map((item, i) => (
                    <tr key={item.id} style={{
                      borderBottom: '1px solid var(--border-color, #e5e7eb)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                    }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--text-secondary, #6b7280)' }}>
                        {item.kod || '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'left', maxWidth: '400px', whiteSpace: 'normal' }}>
                        <div style={{ lineHeight: 1.3 }}>
                          {item.popis}
                          {item.section && (
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary, #9ca3af)', marginTop: '2px' }}>
                              {item.section}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.mj || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                        {item.mnozstvi ? fmt(item.mnozstvi) : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                        {item.cenaJednotkova ? fmt(Math.round(item.cenaJednotkova)) : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                        {item.cenaCelkem ? fmt(Math.round(item.cenaCelkem)) : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
                          background: `${TYPE_COLORS[item.detectedType] || '#9ca3af'}15`,
                          color: TYPE_COLORS[item.detectedType] || '#9ca3af',
                        }}>
                          {TYPE_LABELS[item.detectedType] || item.detectedType}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {item.skupina ? (
                          <span style={{
                            padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                            background: 'rgba(0,0,0,0.06)', letterSpacing: '0.03em',
                          }}>
                            {item.skupina}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {item.concreteGrade ? (
                          <span style={{
                            padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
                            background: '#6366f115', color: '#6366f1',
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

            {/* Bottom info */}
            {filteredItems.length > 0 && (
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border-color, #e5e7eb)',
                fontSize: '11px', color: 'var(--text-secondary, #6b7280)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{fmt(filteredItems.length)} z {fmt(currentSheet?.items.length || 0)} položek</span>
                <span>
                  List: <strong>{activeSheet}</strong>
                  {sheets.length > 1 && ` (${sheets.length} listů celkem)`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-secondary, #6b7280)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '10px',
  margin: '0 0 10px',
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontWeight: 600,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: 'var(--text-secondary, #6b7280)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 10px',
  whiteSpace: 'nowrap',
};
