/**
 * SoupisTab — Bill of quantities display.
 * Renders ParsedDocument data from universal_parser (v5.0).
 * Can display both standalone upload results and soupis_praci from passport response.
 */

import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../../services/api';
import styles from './DocumentAnalysis.module.css';

const CORE_API_URL = `${API_URL}/api/core`;

interface ParsedPosition {
  pc?: string;
  code?: string;
  description: string;
  specification?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  price_source?: string;
  url?: string;
  vv_lines_count?: number;
  source_row?: number;
}

interface ParsedChapter {
  code: string;
  name: string;
  positions: ParsedPosition[];
}

interface ParsedSO {
  so_id: string;
  so_name: string;
  chapters_count: number;
  positions_count: number;
  chapters: ParsedChapter[];
}

export interface ParseResult {
  success: boolean;
  format: string;
  project_name?: string;
  project_id?: string;
  positions_count: number;
  coverage_pct: number;
  so_count: number;
  stavebni_objekty: ParsedSO[];
  warnings: string[];
}

interface SoupisTabProps {
  /** Pre-loaded soupis data from passport response */
  soupisData?: ParseResult | null;
}

const formatNum = (n: number | undefined | null) => {
  if (n == null) return '\u2014';
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
};

export default function SoupisTab({ soupisData }: SoupisTabProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(soupisData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSO, setSelectedSO] = useState<string | null>(
    soupisData?.stavebni_objekty?.[0]?.so_id ?? null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(`${CORE_API_URL}/parse/document`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || errData?.error || `HTTP ${response.status}`);
      }

      const data: ParseResult = await response.json();
      setResult(data);
      if (data.stavebni_objekty?.length > 0) {
        setSelectedSO(data.stavebni_objekty[0].so_id);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Timeout \u2014 zpracov\u00e1n\u00ed trvalo d\u00e9le ne\u017e 2 minuty');
      } else {
        setError(e.message || 'Chyba p\u0159i zpracov\u00e1n\u00ed');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const activeSO = result?.stavebni_objekty?.find(so => so.so_id === selectedSO);

  /* If no data yet, show upload zone */
  if (!result) {
    return (
      <div>
        <div
          className={styles.uploadZone}
          data-active={isDragOver}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls,.xml,.pdf"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
          {isUploading ? (
            <>
              <Loader2 size={40} className={styles.spin} style={{ color: 'var(--accent-orange)', marginBottom: 8 }} />
              <p style={{ color: 'var(--text-secondary)' }}>Zpracov\u00e1v\u00e1m dokument...</p>
            </>
          ) : (
            <>
              <p className={styles.uploadHint}>P\u0159et\u00e1hn\u011bte soubor sem nebo klikn\u011bte</p>
              <p className={styles.uploadFormats}>
                Podporovan\u00e9 form\u00e1ty: XLSX (Export Komplet, RTSROZP), XML (OTSKP), PDF
              </p>
            </>
          )}
        </div>

        {error && (
          <div className={styles.errorBox}>
            <strong>Chyba:</strong> {error}
            <button onClick={() => setError(null)} className="c-btn c-btn--sm" style={{ marginLeft: 12 }}>
              Zkusit znovu
            </button>
          </div>
        )}
      </div>
    );
  }

  /* Render results */
  return (
    <div>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap',
        padding: '12px 16px', background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)',
        borderRadius: 8, marginBottom: 16, alignItems: 'center',
      }}>
        <span><strong>Form\u00e1t:</strong> {result.format}</span>
        <span><strong>Polo\u017eek:</strong> {result.positions_count}</span>
        <span><strong>SO:</strong> {result.so_count}</span>
        <span><strong>Pokryt\u00ed:</strong> {result.coverage_pct}%</span>
        {result.project_name && <span><strong>Projekt:</strong> {result.project_name}</span>}
        <button
          onClick={() => { setResult(null); setError(null); setSelectedSO(null); }}
          className="c-btn c-btn--sm c-btn--ghost"
          style={{ marginLeft: 'auto' }}
        >
          Nov\u00fd soubor
        </button>
      </div>

      {/* SO selector */}
      {result.stavebni_objekty.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {result.stavebni_objekty.map(so => (
            <button
              key={so.so_id}
              onClick={() => setSelectedSO(so.so_id)}
              className={`c-btn c-btn--sm ${selectedSO === so.so_id ? 'c-btn--primary' : ''}`}
            >
              {so.so_id} \u2014 {so.so_name} ({so.positions_count})
            </button>
          ))}
        </div>
      )}

      {/* Positions table */}
      {activeSO && (
        <div style={{ overflow: 'auto', maxHeight: '55vh' }}>
          {activeSO.chapters.map(ch => (
            <div key={ch.code} style={{ marginBottom: 16 }}>
              <h4 className={styles.soupisChapterHeader}>
                {ch.code} \u2014 {ch.name}
              </h4>
              <table className={styles.soupisTable}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>P\u010c</th>
                    <th style={{ width: 100 }}>K\u00f3d</th>
                    <th>Popis</th>
                    <th style={{ width: 40 }}>MJ</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Mno\u017estv\u00ed</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Jed.cena</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {ch.positions.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ color: '#999', fontFamily: 'monospace' }}>{p.pc || ''}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1565c0' }}>{p.code}</a>
                        ) : p.code}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.description}</div>
                        {p.specification && (
                          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>
                            {p.specification.substring(0, 100)}
                          </div>
                        )}
                      </td>
                      <td style={{ color: '#666' }}>{p.unit}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatNum(p.quantity)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatNum(p.unit_price)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{formatNum(p.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {result.warnings?.length > 0 && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.2)', borderRadius: 6, fontSize: '0.8rem' }}>
          {result.warnings.map((w, i) => <div key={i}>&#9888;&#65039; {w}</div>)}
        </div>
      )}
    </div>
  );
}
