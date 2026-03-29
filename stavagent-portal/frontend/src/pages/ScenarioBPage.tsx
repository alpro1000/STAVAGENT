/**
 * ScenarioBPage — Generate výkaz výměr from TZ (technical documentation).
 *
 * Upload PDF/DOCX → CORE extracts construction elements → generates positions.
 * Volumes come ONLY from the uploaded document, never from examples.
 *
 * Route: /portal/scenario-b
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileText, Loader2, AlertTriangle, CheckCircle, Download,
  ArrowLeft, FileSpreadsheet, Layers, Box, ChevronDown, ChevronUp,
} from 'lucide-react';
import { API_URL } from '../services/api';

const CORE_API = `${API_URL}/api/core/scenario-b`;
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'txt'];

interface ExtractedElement {
  nazev: string;
  typ?: string;
  beton_trida?: string;
  objem_m3?: number;
  plocha_bedneni_m2?: number;
  hmotnost_vyztuze_t?: number;
  poznamka?: string;
}

interface GeneratedPosition {
  nazev: string;
  kod?: string;
  mj: string;
  mnozstvi: number;
  typ_prace: string;
  element_ref?: string;
}

interface ScenarioBResult {
  success: boolean;
  elements: ExtractedElement[];
  positions: GeneratedPosition[];
  summary: {
    total_beton_m3: number;
    total_vyzuz_t: number;
    total_bedneni_m2: number;
    element_count: number;
    position_count: number;
  };
  warnings: string[];
  error?: string;
}

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export default function ScenarioBPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioBResult | null>(null);
  const [expandedElements, setExpandedElements] = useState(true);

  const authHeaders = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };

  const handleFile = useCallback((f: File) => {
    const ext = getExtension(f.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Nepodporovaný formát .${ext}. Použijte PDF, DOCX nebo TXT.`);
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleUploadAndProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setProgress('Nahrávání souboru...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_name', file.name.replace(/\.[^.]+$/, ''));

      setProgress('Analýza technické zprávy (AI)...');
      const response = await fetch(`${CORE_API}/upload`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
        throw new Error(errData.detail || `Chyba ${response.status}`);
      }

      const data: ScenarioBResult = await response.json();
      setResult(data);
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba');
      setProgress('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress('');
  };

  const handleExportCSV = () => {
    if (!result) return;
    const header = 'Název;Kód;MJ;Množství;Typ práce;Element\n';
    const rows = result.positions.map(p =>
      `${p.nazev};${p.kod || ''};${p.mj};${p.mnozstvi};${p.typ_prace};${p.element_ref || ''}`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vykaz-vymer_${file?.name || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <button
          onClick={() => navigate('/portal')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} /> StavAgent
        </button>
        <span style={{ color: '#FF9F1C', fontWeight: 700, fontSize: 16 }}>
          Generátor výkazu výměr
        </span>
        <div style={{ width: 100 }} />
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: 0 }}>
            Skenář B: TZ → Výkaz výměr
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15, marginTop: 8 }}>
            Nahrajte technickou zprávu (PDF/DOCX) — AI extrahuje konstrukce a objemy, vygeneruje výkaz výměr
          </p>
        </div>

        {/* Upload zone (shown when no result) */}
        {!result && (
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: `2px dashed ${isDragOver ? '#FF9F1C' : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 12, padding: 48, textAlign: 'center',
            transition: 'border-color 0.2s, background 0.2s',
            ...(isDragOver ? { background: 'rgba(255,159,28,0.08)' } : {}),
          }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {!file ? (
              <>
                <Upload size={48} style={{ color: '#FF9F1C', margin: '0 auto 16px' }} />
                <p style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                  Přetáhněte technickou zprávu nebo klikněte
                </p>
                <p style={{ color: '#64748b', fontSize: 13 }}>
                  Podporované formáty: PDF, DOCX, TXT
                </p>
              </>
            ) : (
              <>
                <FileText size={40} style={{ color: '#FF9F1C', margin: '0 auto 12px' }} />
                <p style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
                  {file.name}
                </p>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                  {(file.size / 1024).toFixed(0)} KB
                </p>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUploadAndProcess(); }}
                    disabled={isProcessing}
                    style={{
                      padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: isProcessing ? '#475569' : '#FF9F1C', color: '#fff',
                      fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {isProcessing ? (
                      <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {progress}</>
                    ) : (
                      <><Layers size={16} /> Analyzovat a generovat</>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    disabled={isProcessing}
                    style={{
                      padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                      background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14,
                    }}
                  >
                    Zrušit
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            <span style={{ color: '#fca5a5', fontSize: 14 }}>{error}</span>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && progress && (
          <div style={{
            marginTop: 16, padding: '12px 16px', background: 'rgba(255,159,28,0.1)',
            border: '1px solid rgba(255,159,28,0.2)', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Loader2 size={18} style={{ color: '#FF9F1C', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#fbbf24', fontSize: 14 }}>{progress}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ marginTop: 0 }}>
            {/* Summary cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12, marginBottom: 24,
            }}>
              {[
                { label: 'Konstrukcí', value: result.summary.element_count, icon: Box, color: '#FF9F1C' },
                { label: 'Pozic celkem', value: result.summary.position_count, icon: FileSpreadsheet, color: '#3b82f6' },
                { label: 'Beton (m³)', value: result.summary.total_beton_m3.toFixed(1), icon: Layers, color: '#10b981' },
                { label: 'Výztuž (t)', value: result.summary.total_vyzuz_t.toFixed(2), icon: Layers, color: '#8b5cf6' },
                { label: 'Bednění (m²)', value: result.summary.total_bedneni_m2.toFixed(1), icon: Layers, color: '#f59e0b' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '16px 14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon size={16} style={{ color }} />
                    <span style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
                  </div>
                  <span style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div style={{
                marginBottom: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8,
              }}>
                <p style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>
                  Upozornění ({result.warnings.length})
                </p>
                {result.warnings.map((w, i) => (
                  <p key={i} style={{ color: '#fde68a', fontSize: 13, margin: '2px 0', paddingLeft: 12 }}>• {w}</p>
                ))}
              </div>
            )}

            {/* Extracted elements (collapsible) */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, marginBottom: 20, overflow: 'hidden',
            }}>
              <button
                onClick={() => setExpandedElements(!expandedElements)}
                style={{
                  width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', color: '#e2e8f0',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  Extrahované konstrukce ({result.elements.length})
                </span>
                {expandedElements ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedElements && (
                <div style={{ padding: '0 16px 16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        {['Název', 'Typ', 'Třída betonu', 'Objem m³', 'Bednění m²', 'Výztuž t'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 6px', color: '#94a3b8', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.elements.map((el, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 6px', color: '#e2e8f0', fontWeight: 500 }}>{el.nazev}</td>
                          <td style={{ padding: '8px 6px', color: '#94a3b8' }}>{el.typ || '—'}</td>
                          <td style={{ padding: '8px 6px', color: '#94a3b8' }}>{el.beton_trida || '—'}</td>
                          <td style={{ padding: '8px 6px', color: el.objem_m3 ? '#10b981' : '#64748b', fontFamily: 'monospace' }}>{el.objem_m3?.toFixed(1) ?? '—'}</td>
                          <td style={{ padding: '8px 6px', color: '#94a3b8', fontFamily: 'monospace' }}>{el.plocha_bedneni_m2?.toFixed(1) ?? '—'}</td>
                          <td style={{ padding: '8px 6px', color: '#94a3b8', fontFamily: 'monospace' }}>{el.hmotnost_vyztuze_t?.toFixed(3) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Generated positions table */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>
                  Výkaz výměr ({result.positions.length} pozic)
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleExportCSV}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(255,255,255,0.05)', color: '#e2e8f0',
                      fontSize: 13, cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    <Download size={14} /> Stáhnout CSV
                  </button>
                  <button
                    onClick={handleReset}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Nový soubor
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['#', 'Název pozice', 'Kód', 'MJ', 'Množství', 'Typ', 'Element'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 8px', color: '#94a3b8', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.positions.map((pos, i) => {
                      const typeColor: Record<string, string> = {
                        beton: '#3b82f6', vyzuz: '#8b5cf6', bedneni: '#f59e0b',
                      };
                      const bgColor = pos.typ_prace === 'beton' ? 'rgba(59,130,246,0.06)'
                        : pos.typ_prace === 'vyzuz' ? 'rgba(139,92,246,0.06)'
                        : pos.typ_prace === 'bedneni' ? 'rgba(245,158,11,0.06)'
                        : 'transparent';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: bgColor }}>
                          <td style={{ padding: '8px', color: '#64748b', fontSize: 12 }}>{i + 1}</td>
                          <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 500 }}>{pos.nazev}</td>
                          <td style={{ padding: '8px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>{pos.kod || '—'}</td>
                          <td style={{ padding: '8px', color: '#94a3b8' }}>{pos.mj}</td>
                          <td style={{ padding: '8px', color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>{pos.mnozstvi > 0 ? pos.mnozstvi : '—'}</td>
                          <td style={{ padding: '8px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                              color: typeColor[pos.typ_prace] || '#94a3b8',
                              background: `${typeColor[pos.typ_prace] || '#64748b'}20`,
                            }}>
                              {pos.typ_prace}
                            </span>
                          </td>
                          <td style={{ padding: '8px', color: '#64748b', fontSize: 12 }}>{pos.element_ref || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Success message */}
            <div style={{
              marginTop: 20, padding: '12px 16px', background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <CheckCircle size={18} style={{ color: '#10b981' }} />
              <span style={{ color: '#6ee7b7', fontSize: 14 }}>
                Výkaz výměr vygenerován. Objemy pocházejí výhradně z nahraného dokumentu.
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
