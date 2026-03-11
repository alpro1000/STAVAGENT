/**
 * Drawing Analysis Component (Workflow B)
 *
 * Upload architectural/structural drawings (PDF, images) for AI analysis:
 * 1. Upload drawing file
 * 2. GPT-4 Vision + OCR extract quantities
 * 3. Display extracted positions (work items)
 * 4. Option to send to kiosk for pricing
 *
 * Design: Digital Concrete (Brutalist Neumorphism)
 * Version: 1.0.0 (2026-03-08)
 */

import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Image,
  Ruler,
  CheckCircle,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { API_URL } from '../../services/api';

const CORE_API_URL = `${API_URL}/api/core`;

interface DrawingPosition {
  id: string;
  description: string;
  quantity?: number;
  unit?: string;
  category?: string;
  confidence?: number;
}

interface AnalysisResult {
  project_id: string;
  positions: DrawingPosition[];
  dimensions?: Record<string, unknown>;
  analysis?: {
    document_type?: string;
    scale?: string;
    total_elements?: number;
    notes?: string[];
  };
  summary?: string;
}

interface DrawingAnalysisProps {
  onClose: () => void;
}

export default function DrawingAnalysis({ onClose }: DrawingAnalysisProps) {
  const [file, setFile] = useState<File | null>(null);
  const [objectType, setObjectType] = useState<string>('building');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPositions, setExpandedPositions] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const OBJECT_TYPES = [
    { value: 'building', label: 'Budova' },
    { value: 'bridge', label: 'Most' },
    { value: 'tunnel', label: 'Tunel' },
    { value: 'road', label: 'Komunikace' },
    { value: 'foundation', label: 'Základy' },
    { value: 'parking', label: 'Parkovací dům' },
    { value: 'custom', label: 'Ostatní' },
  ];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
      setResult(null);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);
    setProgress('Nahrávání výkresu...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_id', `drawing-${Date.now()}`);
      formData.append('project_name', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('generate_summary', 'true');
      formData.append('use_parallel', 'true');
      formData.append('language', 'cs');

      setProgress('Zpracování výkresu (OCR + AI analýza)...');

      // Use Workflow C upload which handles all file types
      const response = await fetch(`${CORE_API_URL}/workflow-c/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: 'Neznámá chyba' }));
        throw new Error(errData.detail || errData.error || `Chyba serveru: ${response.status}`);
      }

      const data = await response.json();

      // Map Workflow C result to our display format
      const positions: DrawingPosition[] = (data.positions || data.audit_results || []).map(
        (p: any, i: number) => ({
          id: p.id || `pos-${i}`,
          description: p.description || p.name || p.popis || `Položka ${i + 1}`,
          quantity: p.quantity || p.mnozstvi,
          unit: p.unit || p.jednotka,
          category: p.category || p.classification || p.skupina,
          confidence: p.confidence,
        })
      );

      setResult({
        project_id: data.project_id || `drawing-${Date.now()}`,
        positions,
        analysis: {
          document_type: objectType,
          total_elements: positions.length,
          notes: data.summary ? [data.summary] : [],
        },
        summary: data.summary,
      });

      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analýza selhala');
      setProgress('');
    } finally {
      setProcessing(false);
    }
  }, [file, objectType]);

  const confidenceColor = (c?: number) => {
    if (c == null) return '#6b7280';
    if (c >= 0.8) return '#059669';
    if (c >= 0.5) return '#d97706';
    return '#dc2626';
  };

  const confidenceLabel = (c?: number) => {
    if (c == null) return '';
    return `${Math.round(c * 100)}%`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="c-panel"
        style={{
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          padding: '32px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Image size={22} />
              Analýza výkresů
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Nahrajte PDF výkres → AI extrahuje rozměry, pozice a objemy
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Upload Zone */}
        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? '#FF9F1C' : 'var(--border-color, #d1d5db)'}`,
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center',
              background: isDragging ? 'rgba(255, 159, 28, 0.05)' : 'transparent',
              transition: 'all 0.2s',
              marginBottom: '20px',
            }}
          >
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <FileText size={24} style={{ color: '#FF9F1C' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{file.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
                <button
                  onClick={() => { setFile(null); setResult(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={32} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  Přetáhněte výkres sem
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  PDF, PNG, JPG, DWG (max 50 MB)
                </div>
                <label className="c-btn c-btn--primary" style={{ cursor: 'pointer', display: 'inline-flex', gap: '6px' }}>
                  <Upload size={14} />
                  Vybrat soubor
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </label>
              </>
            )}
          </div>
        )}

        {/* Object Type Selector + Analyze Button */}
        {file && !result && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px', display: 'block' }}>
                Typ objektu
              </label>
              <select
                className="c-input"
                value={objectType}
                onChange={(e) => setObjectType(e.target.value)}
                style={{ width: '100%' }}
              >
                {OBJECT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <button
              className="c-btn c-btn--primary"
              onClick={handleAnalyze}
              disabled={processing}
              style={{ alignSelf: 'flex-end', display: 'flex', gap: '6px', alignItems: 'center' }}
            >
              {processing ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Analyzuji...
                </>
              ) : (
                <>
                  <Ruler size={14} />
                  Analyzovat výkres
                </>
              )}
            </button>
          </div>
        )}

        {/* Progress */}
        {processing && progress && (
          <div className="c-panel" style={{
            background: 'rgba(255, 159, 28, 0.08)',
            border: '1px solid rgba(255, 159, 28, 0.2)',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <Loader2 size={18} style={{ color: '#FF9F1C', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px' }}>{progress}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="c-panel" style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '16px',
            marginBottom: '20px',
            color: '#dc2626',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <AlertTriangle size={16} />
              Chyba analýzy
            </div>
            <p style={{ marginTop: '8px', fontSize: '13px' }}>{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary */}
            <div className="c-panel" style={{
              background: 'rgba(5, 150, 105, 0.06)',
              border: '1px solid rgba(5, 150, 105, 0.2)',
              padding: '16px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#059669' }}>
                <CheckCircle size={16} />
                Analýza dokončena
              </div>
              <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '14px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Typ: </span>
                  <strong>{OBJECT_TYPES.find(t => t.value === objectType)?.label}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Pozic: </span>
                  <strong>{result.positions.length}</strong>
                </div>
              </div>
              {result.summary && (
                <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {result.summary}
                </p>
              )}
            </div>

            {/* Positions Table */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '8px 0',
                }}
                onClick={() => setExpandedPositions(!expandedPositions)}
              >
                <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} />
                  Extrahované pozice ({result.positions.length})
                </h3>
                {expandedPositions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {expandedPositions && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color, #e5e7eb)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>#</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Popis</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Množství</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Jednotka</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Kategorie</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Spolehlivost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.positions.map((pos, i) => (
                        <tr
                          key={pos.id}
                          style={{
                            borderBottom: '1px solid var(--border-color, #f0f0f0)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                          }}
                        >
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{i + 1}</td>
                          <td style={{ padding: '8px 12px' }}>{pos.description}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {pos.quantity != null ? pos.quantity.toLocaleString('cs-CZ') : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {pos.unit || '—'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {pos.category ? (
                              <span style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(0,0,0,0.06)',
                              }}>
                                {pos.category}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {pos.confidence != null ? (
                              <span style={{
                                fontWeight: 600,
                                fontSize: '12px',
                                color: confidenceColor(pos.confidence),
                              }}>
                                {confidenceLabel(pos.confidence)}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="c-btn"
                onClick={() => { setResult(null); setFile(null); }}
              >
                Nová analýza
              </button>
              <button className="c-btn c-btn--primary" onClick={onClose}>
                Zavřít
              </button>
            </div>
          </>
        )}

        {/* Spinner animation */}
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );
}
