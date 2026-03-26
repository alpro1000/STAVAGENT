/**
 * SoupisPanel — Universal bill of quantities parser for Portal.
 *
 * Upload XLSX/PDF → concrete-agent /api/v1/parse/document → ParsedDocument table.
 * Each row has [URS] button → URS Matcher classification.
 *
 * Lives in Portal (stavagent.cz), NOT in Monolit (Monolit = concrete calculator).
 */

import { useState, useRef } from 'react';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
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

interface ParseResult {
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

interface SoupisPanelProps {
  onClose?: () => void;
}

export default function SoupisPanel({ onClose }: SoupisPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSO, setSelectedSO] = useState<string | null>(null);
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

      const data = await response.json();
      setResult(data);
      if (data.stavebni_objekty?.length > 0) {
        setSelectedSO(data.stavebni_objekty[0].so_id);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Timeout — zpracování trvalo déle než 2 minuty');
      } else {
        setError(e.message || 'Chyba při zpracování');
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

  const formatNum = (n: number | undefined | null) => {
    if (n == null) return '—';
    return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
  };

  const activeSO = result?.stavebni_objekty?.find(so => so.so_id === selectedSO);

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#1a1a2e', position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Soupis praci</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.9rem' }}>
            Nahrajte XLSX nebo PDF → automaticka extrakce polozek s cenami
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            border: 'none', background: 'none', fontSize: '1.5rem',
            cursor: 'pointer', padding: '4px 8px', color: '#666',
          }}>✕</button>
        )}
      </div>

      {/* Upload area */}
      {!result && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          style={{
            border: `2px dashed ${isDragOver ? '#FF9F1C' : '#ddd'}`,
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            background: isDragOver ? 'rgba(255,159,28,0.05)' : '#fafafa',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
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
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
              <p style={{ color: '#666' }}>Zpracovavam dokument...</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
              <p style={{ fontWeight: 500, marginBottom: '8px' }}>
                Pretahnete soubor sem nebo kliknete
              </p>
              <p style={{ color: '#999', fontSize: '0.85rem' }}>
                Podporovane formaty: XLSX (Export Komplet, RTSROZP), XML (OTSKP), PDF
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', background: '#fff3f3', border: '1px solid #ffcdd2',
          borderRadius: '8px', marginTop: '16px', color: '#c62828',
        }}>
          <strong>Chyba:</strong> {error}
          <button onClick={() => { setError(null); setResult(null); }}
            style={{ marginLeft: '12px', cursor: 'pointer', border: '1px solid #ccc',
              borderRadius: '4px', padding: '4px 12px', background: '#fff' }}>
            Zkusit znovu
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Summary bar */}
          <div style={{
            display: 'flex', gap: '16px', flexWrap: 'wrap',
            padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: '8px', marginBottom: '16px', alignItems: 'center',
          }}>
            <span><strong>Format:</strong> {result.format}</span>
            <span><strong>Polozek:</strong> {result.positions_count}</span>
            <span><strong>SO:</strong> {result.so_count}</span>
            <span><strong>Pokryti:</strong> {result.coverage_pct}%</span>
            {result.project_name && <span><strong>Projekt:</strong> {result.project_name}</span>}
            <button onClick={() => { setResult(null); setError(null); setSelectedSO(null); }}
              style={{ marginLeft: 'auto', cursor: 'pointer', border: '1px solid #ccc',
                borderRadius: '4px', padding: '4px 12px', background: '#fff', fontSize: '0.85rem' }}>
              Novy soubor
            </button>
          </div>

          {/* SO selector */}
          {result.stavebni_objekty.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {result.stavebni_objekty.map(so => (
                <button key={so.so_id} onClick={() => setSelectedSO(so.so_id)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                    border: selectedSO === so.so_id ? '2px solid #FF9F1C' : '1px solid #ddd',
                    background: selectedSO === so.so_id ? '#fff7ed' : '#fff',
                    fontWeight: selectedSO === so.so_id ? 600 : 400,
                    fontSize: '0.85rem',
                  }}>
                  {so.so_id} — {so.so_name} ({so.positions_count})
                </button>
              ))}
            </div>
          )}

          {/* Positions table */}
          {activeSO && (
            <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
              {activeSO.chapters.map(ch => (
                <div key={ch.code} style={{ marginBottom: '16px' }}>
                  <h4 style={{
                    margin: '0 0 8px', padding: '6px 12px',
                    background: '#f5f5f5', borderRadius: '6px', fontSize: '0.9rem',
                  }}>
                    {ch.code} — {ch.name}
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                        <th style={{ padding: '4px 8px', width: '40px' }}>PC</th>
                        <th style={{ padding: '4px 8px', width: '100px' }}>Kod</th>
                        <th style={{ padding: '4px 8px' }}>Popis</th>
                        <th style={{ padding: '4px 8px', width: '40px' }}>MJ</th>
                        <th style={{ padding: '4px 8px', width: '80px', textAlign: 'right' }}>Mnozstvi</th>
                        <th style={{ padding: '4px 8px', width: '80px', textAlign: 'right' }}>Jed.cena</th>
                        <th style={{ padding: '4px 8px', width: '90px', textAlign: 'right' }}>Celkem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ch.positions.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '4px 8px', color: '#999', fontFamily: 'monospace' }}>{p.pc || ''}</td>
                          <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {p.url ? (
                              <a href={p.url} target="_blank" rel="noopener noreferrer"
                                style={{ color: '#1565c0' }}>{p.code}</a>
                            ) : p.code}
                          </td>
                          <td style={{ padding: '4px 8px' }}>
                            <div style={{ fontWeight: 500 }}>{p.description}</div>
                            {p.specification && (
                              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                                {p.specification.substring(0, 100)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '4px 8px', color: '#666' }}>{p.unit}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNum(p.quantity)}
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNum(p.unit_price)}
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>
                            {formatNum(p.total_price)}
                          </td>
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
            <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fffde7',
              border: '1px solid #fff9c4', borderRadius: '6px', fontSize: '0.8rem' }}>
              {result.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
