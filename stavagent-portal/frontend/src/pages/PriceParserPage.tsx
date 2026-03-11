/**
 * PriceParserPage — Upload supplier PDF price lists, parse & compare
 *
 * Features:
 *   1. Upload single PDF → see structured price data
 *   2. Upload multiple PDFs → side-by-side supplier comparison
 *   3. Concrete price comparison table (C20/25, C25/30, C30/37, etc.)
 *   4. Delivery zone comparison
 *   5. Pump pricing comparison
 *
 * Uses concrete-agent POST /api/v1/price-parser/parse endpoint.
 * No auth required, public page.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ArrowLeft, Trash2, FileText, Loader2, AlertTriangle, ChevronDown, ChevronUp, Calculator, Download } from 'lucide-react';
import { priceParserAPI, type PriceListResult, type BetonItem } from '../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParsedSupplier {
  id: string;
  fileName: string;
  result: PriceListResult;
  parsedAt: Date;
}

interface ParseJob {
  id: string;
  fileName: string;
  status: 'uploading' | 'parsing' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: PriceListResult;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  return price.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' Kč';
}

function supplierLabel(s: ParsedSupplier): string {
  return s.result.source.company || s.fileName.replace(/\.pdf$/i, '');
}

/** Normalize concrete name for comparison (e.g. "C 25/30" → "C25/30") */
function normalizeBeton(name: string): string {
  return name.replace(/\s+/g, '').toUpperCase();
}

/** Collect all unique concrete types across suppliers */
function collectBetonTypes(suppliers: ParsedSupplier[]): string[] {
  const set = new Set<string>();
  for (const s of suppliers) {
    for (const b of s.result.betony) {
      set.add(normalizeBeton(b.name));
    }
  }
  return Array.from(set).sort();
}

/** Find beton item by normalized name */
function findBeton(items: BetonItem[], normalized: string): BetonItem | undefined {
  return items.find(b => normalizeBeton(b.name) === normalized);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PriceParserPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [suppliers, setSuppliers] = useState<ParsedSupplier[]>([]);
  const [jobs, setJobs] = useState<ParseJob[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    betony: true,
    doprava: true,
    cerpadla: true,
    priplatky: false,
    malty: false,
    laborator: false,
  });

  // Calculator state
  const [calcVolume, setCalcVolume] = useState<number>(30);
  const [calcDistance, setCalcDistance] = useState<number>(15);
  const [calcBetonClass, setCalcBetonClass] = useState<string>('');
  const [showCalculator, setShowCalculator] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Available beton classes from all suppliers
  const availableBetonClasses = useMemo(() => collectBetonTypes(suppliers), [suppliers]);

  // Auto-select first beton class
  useMemo(() => {
    if (availableBetonClasses.length > 0 && !calcBetonClass) {
      // Default to C25/30 if available, otherwise first
      const preferred = availableBetonClasses.find(b => b.includes('25/30'));
      setCalcBetonClass(preferred || availableBetonClasses[0]);
    }
  }, [availableBetonClasses, calcBetonClass]);

  // Calculate total cost per supplier
  const calcResults = useMemo(() => {
    if (suppliers.length === 0 || !calcBetonClass) return [];

    return suppliers.map((s, idx) => {
      // 1. Concrete price
      const beton = findBeton(s.result.betony, calcBetonClass);
      const betonPrice = beton?.price_per_m3 ?? 0;
      const betonTotal = betonPrice * calcVolume;

      // 2. Delivery price (find matching zone)
      let deliveryPrice = 0;
      for (const z of s.result.doprava.zony) {
        if (calcDistance >= z.km_from && calcDistance <= z.km_to) {
          deliveryPrice = z.price_per_m3;
          break;
        }
      }
      const deliveryTotal = deliveryPrice * calcVolume;

      // 3. Pump price (estimate: use first pump type)
      const pump = s.result.cerpadla[0];
      let pumpTotal = 0;
      if (pump) {
        const arrival = pump.pristaveni ?? 0;
        const hourly = pump.hodinova_sazba ?? 0;
        const perM3 = pump.cena_per_m3 ?? 0;
        // Estimate: ~25 m³/h practical rate → hours needed
        const pumpHours = Math.max(2, Math.ceil(calcVolume / 25));
        pumpTotal = arrival + (hourly * pumpHours) + (perM3 * calcVolume);
      }

      const total = betonTotal + deliveryTotal + pumpTotal;
      const perM3 = calcVolume > 0 ? total / calcVolume : 0;

      return {
        supplier: s,
        supplierIdx: idx,
        betonPrice,
        betonTotal,
        deliveryPrice,
        deliveryTotal,
        pumpTotal,
        pumpName: pump?.type || '—',
        total,
        perM3,
      };
    }).sort((a, b) => a.total - b.total);
  }, [suppliers, calcVolume, calcDistance, calcBetonClass]);

  // Export tariffs as JSON (for Monolit import)
  const exportTariffs = useCallback(() => {
    if (suppliers.length === 0) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const entries = suppliers.flatMap(s => {
      const label = supplierLabel(s);
      const supplierId = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      const result: Array<Record<string, unknown>> = [];

      // Concrete tariff
      if (s.result.betony.length > 0) {
        result.push({
          id: `${supplierId}_concrete_${todayStr}`,
          supplier_id: supplierId,
          supplier_name: label,
          service: 'concrete',
          valid_from: s.result.source.valid_from || todayStr,
          valid_to: s.result.source.valid_to || '9999-12-31',
          source: 'price_list',
          rates: s.result.betony.map(b => ({
            key: normalizeBeton(b.name).replace('/', '_') + '_per_m3',
            value: b.price_per_m3 ?? 0,
            unit: 'CZK/m³',
            note: b.exposure_class || undefined,
          })),
        });
      }

      // Transport tariff
      if (s.result.doprava.zony.length > 0) {
        result.push({
          id: `${supplierId}_transport_${todayStr}`,
          supplier_id: supplierId,
          supplier_name: label,
          service: 'transport',
          valid_from: s.result.source.valid_from || todayStr,
          valid_to: s.result.source.valid_to || '9999-12-31',
          source: 'price_list',
          rates: s.result.doprava.zony.map(z => ({
            key: `zone_${z.km_from}_${z.km_to}_per_m3`,
            value: z.price_per_m3,
            unit: 'CZK/m³',
            note: `${z.km_from}–${z.km_to} km`,
          })),
        });
      }

      // Pump tariff
      if (s.result.cerpadla.length > 0) {
        result.push({
          id: `${supplierId}_pump_${todayStr}`,
          supplier_id: supplierId,
          supplier_name: label,
          service: 'pump',
          valid_from: s.result.source.valid_from || todayStr,
          valid_to: s.result.source.valid_to || '9999-12-31',
          source: 'price_list',
          rates: s.result.cerpadla.flatMap(c => {
            const rates: Array<{ key: string; value: number; unit: string; note?: string }> = [];
            const prefix = c.type.replace(/\s+/g, '_').toLowerCase();
            if (c.pristaveni) rates.push({ key: `${prefix}_arrival`, value: c.pristaveni, unit: 'CZK', note: c.type });
            if (c.hodinova_sazba) rates.push({ key: `${prefix}_per_h`, value: c.hodinova_sazba, unit: 'CZK/h', note: c.type });
            if (c.cena_per_m3) rates.push({ key: `${prefix}_per_m3`, value: c.cena_per_m3, unit: 'CZK/m³', note: c.type });
            return rates;
          }),
        });
      }

      return result;
    });

    const registry = { entries, base_year: new Date().getFullYear() };
    const blob = new Blob([JSON.stringify(registry, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarify_dodavatelu_${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setSavedMessage('Tarify exportovány jako JSON');
    setTimeout(() => setSavedMessage(null), 3000);
  }, [suppliers]);

  // Handlers
  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const parseFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Pouze PDF soubory jsou podporovány.');
      return;
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const job: ParseJob = {
      id: jobId,
      fileName: file.name,
      status: 'uploading',
      progress: 10,
    };

    setJobs(prev => [...prev, job]);

    try {
      // Update to parsing
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'parsing', progress: 40 } : j));

      const result = await priceParserAPI.parse(file);

      // Done
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'done', progress: 100, result } : j));

      const supplier: ParsedSupplier = {
        id: jobId,
        fileName: file.name,
        result,
        parsedAt: new Date(),
      };
      setSuppliers(prev => [...prev, supplier]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Neznámá chyba';
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error', error: message } : j));
    }
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(f => parseFile(f));
  }, [parseFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const clearAll = () => {
    setSuppliers([]);
    setJobs([]);
  };

  const activeJobs = jobs.filter(j => j.status === 'uploading' || j.status === 'parsing');
  const errorJobs = jobs.filter(j => j.status === 'error');

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary, #f8f9fa)',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <header style={{
        height: 60,
        background: 'var(--bg-dark, #1a1c1e)',
        borderBottom: '1px solid var(--border-color, #333)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
      }}>
        <button
          onClick={() => navigate('/portal')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-inverse, #ccc)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
          }}
        >
          <ArrowLeft size={18} /> Portal
        </button>
        <h1 style={{
          color: 'var(--text-inverse, white)',
          fontSize: 18,
          fontWeight: 600,
          margin: 0,
        }}>
          📄 Ceníky dodavatelů betonu
        </h1>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>
        {/* Upload Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--brand-orange, #FF9F1C)' : 'var(--border-color, #ccc)'}`,
            borderRadius: 12,
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(255, 159, 28, 0.05)' : 'var(--bg-secondary, white)',
            transition: 'all 0.2s',
            marginBottom: 24,
          }}
        >
          <Upload size={40} style={{ color: 'var(--brand-orange, #FF9F1C)', marginBottom: 12 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Přetáhněte PDF ceníky sem
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            nebo klikněte pro výběr. Podporuje hromadný upload — porovná více dodavatelů najednou.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {/* Active Jobs */}
        {activeJobs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {activeJobs.map(job => (
              <div key={job.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'var(--bg-secondary, white)',
                borderRadius: 8,
                marginBottom: 8,
                border: '1px solid var(--border-color, #e5e7eb)',
              }}>
                <Loader2 size={18} style={{ color: 'var(--brand-orange)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 14, flex: 1 }}>{job.fileName}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {job.status === 'uploading' ? 'Nahrávání...' : 'Parsování...'}
                </span>
                <div style={{
                  width: 100,
                  height: 4,
                  background: 'var(--border-color, #e5e7eb)',
                  borderRadius: 2,
                }}>
                  <div style={{
                    width: `${job.progress}%`,
                    height: '100%',
                    background: 'var(--brand-orange, #FF9F1C)',
                    borderRadius: 2,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error Jobs */}
        {errorJobs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {errorJobs.map(job => (
              <div key={job.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: '#fef2f2',
                borderRadius: 8,
                marginBottom: 8,
                border: '1px solid #fecaca',
              }}>
                <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: 14, flex: 1 }}>{job.fileName}</span>
                <span style={{ fontSize: 12, color: '#ef4444' }}>{job.error}</span>
                <button
                  onClick={() => setJobs(prev => prev.filter(j => j.id !== job.id))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Supplier chips */}
        {suppliers.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
              Dodavatelé ({suppliers.length}):
            </span>
            {suppliers.map((s, i) => (
              <span key={s.id} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                background: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].bg,
                color: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].text,
              }}>
                <FileText size={12} />
                {supplierLabel(s)}
                <button
                  onClick={(e) => { e.stopPropagation(); removeSupplier(s.id); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'inherit',
                    padding: 0,
                    lineHeight: 1,
                    opacity: 0.6,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            {suppliers.length > 1 && (
              <button
                onClick={clearAll}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-color, #ccc)',
                  borderRadius: 20,
                  padding: '4px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                Vymazat vše
              </button>
            )}
          </div>
        )}

        {/* Calculator Panel */}
        {suppliers.length > 0 && (
          <div style={{
            background: 'var(--bg-secondary, white)',
            borderRadius: 8,
            border: '2px solid var(--brand-orange, #FF9F1C)',
            marginBottom: 24,
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setShowCalculator(prev => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 16px',
                background: 'linear-gradient(135deg, #FF9F1C 0%, #e88b0e 100%)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 700,
                color: 'white',
                textAlign: 'left',
              }}
            >
              <Calculator size={18} />
              <span style={{ flex: 1 }}>Kalkulovat ceny — celkový náklad na dodávku betonu</span>
              {showCalculator ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showCalculator && (
              <div style={{ padding: 16 }}>
                {/* Inputs */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}>
                  <label style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Objem (m³)</span>
                    <input
                      type="number"
                      value={calcVolume}
                      onChange={e => setCalcVolume(Math.max(1, Number(e.target.value) || 1))}
                      min={1}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border-color, #ccc)',
                        borderRadius: 6,
                        fontSize: 14,
                      }}
                    />
                  </label>
                  <label style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Vzdálenost (km)</span>
                    <input
                      type="number"
                      value={calcDistance}
                      onChange={e => setCalcDistance(Math.max(0, Number(e.target.value) || 0))}
                      min={0}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border-color, #ccc)',
                        borderRadius: 6,
                        fontSize: 14,
                      }}
                    />
                  </label>
                  <label style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Třída betonu</span>
                    <select
                      value={calcBetonClass}
                      onChange={e => setCalcBetonClass(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border-color, #ccc)',
                        borderRadius: 6,
                        fontSize: 14,
                        background: 'white',
                      }}
                    >
                      {availableBetonClasses.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Results table */}
                {calcResults.length > 0 && (
                  <table style={TABLE_STYLE}>
                    <thead>
                      <tr>
                        <th style={TH_STYLE}>Dodavatel</th>
                        <th style={{ ...TH_STYLE, textAlign: 'right' }}>Beton ({calcBetonClass})</th>
                        <th style={{ ...TH_STYLE, textAlign: 'right' }}>Doprava ({calcDistance} km)</th>
                        <th style={{ ...TH_STYLE, textAlign: 'right' }}>Čerpadlo</th>
                        <th style={{ ...TH_STYLE, textAlign: 'right', fontWeight: 700 }}>Celkem</th>
                        <th style={{ ...TH_STYLE, textAlign: 'right', fontWeight: 700 }}>Kč/m³</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcResults.map((r, idx) => {
                        const isMin = idx === 0 && calcResults.length > 1;
                        return (
                          <tr key={r.supplier.id} style={{
                            background: isMin ? '#f0fdf4' : undefined,
                          }}>
                            <td style={{
                              ...TD_STYLE,
                              fontWeight: 600,
                              color: SUPPLIER_COLORS[r.supplierIdx % SUPPLIER_COLORS.length].text,
                            }}>
                              {supplierLabel(r.supplier)}
                              {isMin && <span style={{
                                marginLeft: 8,
                                fontSize: 10,
                                background: '#059669',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: 10,
                                fontWeight: 600,
                              }}>NEJLEVNĚJŠÍ</span>}
                            </td>
                            <td style={{ ...TD_STYLE, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <div>{formatPrice(r.betonTotal)}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatPrice(r.betonPrice)}/m³</div>
                            </td>
                            <td style={{ ...TD_STYLE, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <div>{formatPrice(r.deliveryTotal)}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatPrice(r.deliveryPrice)}/m³</div>
                            </td>
                            <td style={{ ...TD_STYLE, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <div>{formatPrice(r.pumpTotal)}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.pumpName}</div>
                            </td>
                            <td style={{
                              ...TD_STYLE,
                              textAlign: 'right',
                              fontWeight: 700,
                              fontSize: 15,
                              fontVariantNumeric: 'tabular-nums',
                              color: isMin ? '#059669' : 'var(--text-primary)',
                            }}>
                              {formatPrice(r.total)}
                            </td>
                            <td style={{
                              ...TD_STYLE,
                              textAlign: 'right',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              color: isMin ? '#059669' : 'var(--text-primary)',
                            }}>
                              {formatPrice(r.perM3)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* Export + savings info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 16,
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  {calcResults.length > 1 && (() => {
                    const saving = calcResults[calcResults.length - 1].total - calcResults[0].total;
                    return saving > 0 ? (
                      <span style={{
                        fontSize: 13,
                        color: '#059669',
                        fontWeight: 600,
                      }}>
                        Úspora výběrem nejlevnějšího: {formatPrice(saving)} ({Math.round(saving / calcResults[calcResults.length - 1].total * 100)}%)
                      </span>
                    ) : null;
                  })()}
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button
                      onClick={exportTariffs}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        background: 'var(--bg-primary, #f3f4f6)',
                        border: '1px solid var(--border-color, #ccc)',
                        borderRadius: 6,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      <Download size={14} /> Export tarifů (JSON)
                    </button>
                  </div>
                </div>

                {savedMessage && (
                  <div style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: '#d1fae5',
                    color: '#065f46',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                  }}>
                    {savedMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {suppliers.length > 0 && (
          <>
            {/* BETONY — Concrete comparison table */}
            <CollapsibleSection
              title="Betony"
              icon="🧱"
              count={collectBetonTypes(suppliers).length}
              expanded={expandedSections.betony}
              onToggle={() => toggleSection('betony')}
            >
              <BetonComparisonTable suppliers={suppliers} />
            </CollapsibleSection>

            {/* DOPRAVA — Delivery zones */}
            <CollapsibleSection
              title="Doprava"
              icon="🚛"
              count={suppliers.reduce((sum, s) => sum + s.result.doprava.zony.length, 0)}
              expanded={expandedSections.doprava}
              onToggle={() => toggleSection('doprava')}
            >
              <DopravaComparisonTable suppliers={suppliers} />
            </CollapsibleSection>

            {/* CERPADLA — Pumps */}
            <CollapsibleSection
              title="Čerpadla"
              icon="⚙️"
              count={suppliers.reduce((sum, s) => sum + s.result.cerpadla.length, 0)}
              expanded={expandedSections.cerpadla}
              onToggle={() => toggleSection('cerpadla')}
            >
              <CerpadlaComparisonTable suppliers={suppliers} />
            </CollapsibleSection>

            {/* PRIPLATKY — Surcharges */}
            <CollapsibleSection
              title="Příplatky"
              icon="💰"
              count={suppliers.reduce((sum, s) =>
                sum + s.result.priplatky.casove.length + s.result.priplatky.zimni.length + s.result.priplatky.technologicke.length, 0)}
              expanded={expandedSections.priplatky}
              onToggle={() => toggleSection('priplatky')}
            >
              <PriplatkyTable suppliers={suppliers} />
            </CollapsibleSection>

            {/* MALTY */}
            <CollapsibleSection
              title="Malty a potěry"
              icon="🏗️"
              count={suppliers.reduce((sum, s) => sum + s.result.malty_potere.length, 0)}
              expanded={expandedSections.malty}
              onToggle={() => toggleSection('malty')}
            >
              <MaltyTable suppliers={suppliers} />
            </CollapsibleSection>

            {/* LABORATOR */}
            <CollapsibleSection
              title="Laboratorní služby"
              icon="🔬"
              count={suppliers.reduce((sum, s) => sum + s.result.laborator.length, 0)}
              expanded={expandedSections.laborator}
              onToggle={() => toggleSection('laborator')}
            >
              <LaboratorTable suppliers={suppliers} />
            </CollapsibleSection>

            {/* Source info */}
            <div style={{
              marginTop: 24,
              padding: 16,
              background: 'var(--bg-secondary, white)',
              borderRadius: 8,
              border: '1px solid var(--border-color, #e5e7eb)',
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Metadata ceníků</h3>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(suppliers.length, 4)}, 1fr)`, gap: 16 }}>
                {suppliers.map((s, i) => (
                  <div key={s.id} style={{ fontSize: 13 }}>
                    <div style={{
                      fontWeight: 600,
                      color: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].text,
                      marginBottom: 4,
                    }}>
                      {supplierLabel(s)}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {s.result.source.provozovna && <div>Provozovna: {s.result.source.provozovna}</div>}
                      {s.result.source.valid_from && <div>Platnost od: {s.result.source.valid_from}</div>}
                      {s.result.source.valid_to && <div>Platnost do: {s.result.source.valid_to}</div>}
                      <div>DPH: {s.result.source.vat_rate}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {suppliers.length === 0 && activeJobs.length === 0 && errorJobs.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            color: 'var(--text-secondary)',
          }}>
            <FileText size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p style={{ fontSize: 16, fontWeight: 500 }}>Nahrajte PDF ceníky dodavatelů betonu</p>
            <p style={{ fontSize: 13 }}>
              Systém automaticky rozpozná sekce: betony, doprava, čerpadla, příplatky, laboratorní služby.
              <br />
              Nahrajte více ceníků pro srovnání dodavatelů.
            </p>
          </div>
        )}
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Supplier Colors ────────────────────────────────────────────────────────

const SUPPLIER_COLORS = [
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#d1fae5', text: '#065f46' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#e0e7ff', text: '#3730a3' },
  { bg: '#fce4ec', text: '#880e4f' },
];

// ─── Collapsible Section ────────────────────────────────────────────────────

function CollapsibleSection({ title, icon, count, expanded, onToggle, children }: {
  title: string;
  icon: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--bg-secondary, white)',
      borderRadius: 8,
      border: '1px solid var(--border-color, #e5e7eb)',
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          textAlign: 'left',
        }}
      >
        <span>{icon}</span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontWeight: 400,
          background: 'var(--bg-tertiary, #f3f4f6)',
          padding: '2px 8px',
          borderRadius: 10,
        }}>
          {count}
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Table Styles ───────────────────────────────────────────────────────────

const TH_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  textAlign: 'left',
  color: 'var(--text-secondary)',
  borderBottom: '2px solid var(--border-color, #e5e7eb)',
  whiteSpace: 'nowrap',
};

const TD_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  borderBottom: '1px solid var(--border-color, #f3f4f6)',
};

const TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

// ─── Beton Comparison Table ─────────────────────────────────────────────────

function BetonComparisonTable({ suppliers }: { suppliers: ParsedSupplier[] }) {
  const types = collectBetonTypes(suppliers);

  if (types.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Žádné betony nalezeny.</p>;
  }

  return (
    <table style={TABLE_STYLE}>
      <thead>
        <tr>
          <th style={TH_STYLE}>Beton</th>
          <th style={TH_STYLE}>Třída prostředí</th>
          {suppliers.map((s, i) => (
            <th key={s.id} style={{
              ...TH_STYLE,
              color: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].text,
            }}>
              {supplierLabel(s)} (Kč/m³)
            </th>
          ))}
          {suppliers.length > 1 && <th style={TH_STYLE}>Rozdíl</th>}
        </tr>
      </thead>
      <tbody>
        {types.map(type => {
          const items = suppliers.map(s => findBeton(s.result.betony, type));
          const prices = items.map(b => b?.price_per_m3).filter((p): p is number => p != null);
          const minPrice = prices.length > 0 ? Math.min(...prices) : null;
          const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
          const diff = minPrice != null && maxPrice != null && minPrice > 0
            ? Math.round(((maxPrice - minPrice) / minPrice) * 100)
            : null;

          return (
            <tr key={type}>
              <td style={{ ...TD_STYLE, fontWeight: 600 }}>{type}</td>
              <td style={{ ...TD_STYLE, fontSize: 12, color: 'var(--text-secondary)' }}>
                {items.find(b => b?.exposure_class)?.exposure_class || '—'}
              </td>
              {items.map((b, i) => {
                const price = b?.price_per_m3;
                const isMin = price != null && price === minPrice && suppliers.length > 1;
                return (
                  <td key={suppliers[i].id} style={{
                    ...TD_STYLE,
                    fontWeight: isMin ? 700 : 400,
                    color: isMin ? '#059669' : 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatPrice(price)}
                  </td>
                );
              })}
              {suppliers.length > 1 && (
                <td style={{
                  ...TD_STYLE,
                  fontSize: 12,
                  color: diff != null && diff > 10 ? '#ef4444' : 'var(--text-secondary)',
                }}>
                  {diff != null ? `${diff}%` : '—'}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Doprava Comparison Table ───────────────────────────────────────────────

function DopravaComparisonTable({ suppliers }: { suppliers: ParsedSupplier[] }) {
  // Collect all unique km ranges
  const allZones = new Map<string, { km_from: number; km_to: number }>();
  for (const s of suppliers) {
    for (const z of s.result.doprava.zony) {
      const key = `${z.km_from}-${z.km_to}`;
      allZones.set(key, { km_from: z.km_from, km_to: z.km_to });
    }
  }
  const zones = Array.from(allZones.values()).sort((a, b) => a.km_from - b.km_from);

  if (zones.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Žádné dopravní zóny nalezeny.</p>;
  }

  return (
    <>
      {/* General delivery info */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
        {suppliers.map((s, i) => (
          <div key={s.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600, color: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].text }}>
              {supplierLabel(s)}:
            </span>
            {s.result.doprava.min_objem_m3 != null && <span> min. {s.result.doprava.min_objem_m3} m³</span>}
            {s.result.doprava.volny_cas_min != null && <span> | volný čas {s.result.doprava.volny_cas_min} min</span>}
            {s.result.doprava.cekani_per_15min != null && <span> | čekání {s.result.doprava.cekani_per_15min} Kč/15min</span>}
          </div>
        ))}
      </div>
      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={TH_STYLE}>Vzdálenost (km)</th>
            {suppliers.map((s, i) => (
              <th key={s.id} style={{
                ...TH_STYLE,
                color: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].text,
              }}>
                {supplierLabel(s)} (Kč/m³)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zones.map(zone => {
            const key = `${zone.km_from}-${zone.km_to}`;
            return (
              <tr key={key}>
                <td style={{ ...TD_STYLE, fontWeight: 500 }}>{zone.km_from}–{zone.km_to} km</td>
                {suppliers.map(s => {
                  const match = s.result.doprava.zony.find(
                    z => z.km_from === zone.km_from && z.km_to === zone.km_to
                  );
                  return (
                    <td key={s.id} style={{ ...TD_STYLE, fontVariantNumeric: 'tabular-nums' }}>
                      {match ? formatPrice(match.price_per_m3) : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

// ─── Cerpadla Comparison Table ──────────────────────────────────────────────

function CerpadlaComparisonTable({ suppliers }: { suppliers: ParsedSupplier[] }) {
  const hasPumps = suppliers.some(s => s.result.cerpadla.length > 0);
  if (!hasPumps) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Žádná čerpadla nalezena.</p>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(suppliers.length, 3)}, 1fr)`, gap: 16 }}>
      {suppliers.map((s, i) => (
        <div key={s.id}>
          <h4 style={{
            fontSize: 13,
            fontWeight: 600,
            color: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].text,
            marginBottom: 8,
          }}>
            {supplierLabel(s)}
          </h4>
          {s.result.cerpadla.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Žádná data</p>
          ) : (
            <table style={TABLE_STYLE}>
              <thead>
                <tr>
                  <th style={{ ...TH_STYLE, fontSize: 11 }}>Typ</th>
                  <th style={{ ...TH_STYLE, fontSize: 11 }}>Přístavení</th>
                  <th style={{ ...TH_STYLE, fontSize: 11 }}>Kč/h</th>
                  <th style={{ ...TH_STYLE, fontSize: 11 }}>Kč/m³</th>
                </tr>
              </thead>
              <tbody>
                {s.result.cerpadla.map((c, j) => (
                  <tr key={j}>
                    <td style={{ ...TD_STYLE, fontSize: 12, fontWeight: 500 }}>{c.type}</td>
                    <td style={{ ...TD_STYLE, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(c.pristaveni)}</td>
                    <td style={{ ...TD_STYLE, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(c.hodinova_sazba)}</td>
                    <td style={{ ...TD_STYLE, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(c.cena_per_m3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Priplatky Table ────────────────────────────────────────────────────────

function PriplatkyTable({ suppliers }: { suppliers: ParsedSupplier[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(suppliers.length, 3)}, 1fr)`, gap: 16 }}>
      {suppliers.map((s, i) => {
        const { casove, zimni, technologicke } = s.result.priplatky;
        const total = casove.length + zimni.length + technologicke.length;
        return (
          <div key={s.id}>
            <h4 style={{
              fontSize: 13,
              fontWeight: 600,
              color: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].text,
              marginBottom: 8,
            }}>
              {supplierLabel(s)} ({total})
            </h4>
            {total === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Žádné příplatky</p>
            ) : (
              <div style={{ fontSize: 12 }}>
                {casove.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, marginTop: 4, marginBottom: 2 }}>Časové</div>
                    {casove.map((p, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>{p.nazev}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.hodnota} {p.typ}</span>
                      </div>
                    ))}
                  </>
                )}
                {zimni.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 2 }}>Zimní</div>
                    {zimni.map((p, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>{p.teplota_from}°C – {p.teplota_to}°C</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(p.price_per_m3)}/m³</span>
                      </div>
                    ))}
                  </>
                )}
                {technologicke.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 2 }}>Technologické</div>
                    {technologicke.map((p, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>{p.nazev}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.hodnota} {p.typ}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Malty Table ────────────────────────────────────────────────────────────

function MaltyTable({ suppliers }: { suppliers: ParsedSupplier[] }) {
  const hasData = suppliers.some(s => s.result.malty_potere.length > 0);
  if (!hasData) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Žádné malty/potěry nalezeny.</p>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(suppliers.length, 3)}, 1fr)`, gap: 16 }}>
      {suppliers.map((s, i) => (
        <div key={s.id}>
          <h4 style={{
            fontSize: 13,
            fontWeight: 600,
            color: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].text,
            marginBottom: 8,
          }}>
            {supplierLabel(s)}
          </h4>
          {s.result.malty_potere.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Žádná data</p>
          ) : (
            <table style={TABLE_STYLE}>
              <thead>
                <tr>
                  <th style={{ ...TH_STYLE, fontSize: 11 }}>Název</th>
                  <th style={{ ...TH_STYLE, fontSize: 11 }}>Kč/m³</th>
                </tr>
              </thead>
              <tbody>
                {s.result.malty_potere.map((m, j) => (
                  <tr key={j}>
                    <td style={{ ...TD_STYLE, fontSize: 12 }}>{m.name}</td>
                    <td style={{ ...TD_STYLE, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(m.price_per_m3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Laborator Table ────────────────────────────────────────────────────────

function LaboratorTable({ suppliers }: { suppliers: ParsedSupplier[] }) {
  const hasData = suppliers.some(s => s.result.laborator.length > 0);
  if (!hasData) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Žádné laboratorní služby nalezeny.</p>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(suppliers.length, 3)}, 1fr)`, gap: 16 }}>
      {suppliers.map((s, i) => (
        <div key={s.id}>
          <h4 style={{
            fontSize: 13,
            fontWeight: 600,
            color: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length].text,
            marginBottom: 8,
          }}>
            {supplierLabel(s)}
          </h4>
          {s.result.laborator.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Žádná data</p>
          ) : (
            <table style={TABLE_STYLE}>
              <thead>
                <tr>
                  <th style={{ ...TH_STYLE, fontSize: 11 }}>Služba</th>
                  <th style={{ ...TH_STYLE, fontSize: 11 }}>Jednotka</th>
                  <th style={{ ...TH_STYLE, fontSize: 11 }}>Cena</th>
                </tr>
              </thead>
              <tbody>
                {s.result.laborator.map((l, j) => (
                  <tr key={j}>
                    <td style={{ ...TD_STYLE, fontSize: 12 }}>{l.nazev}</td>
                    <td style={{ ...TD_STYLE, fontSize: 12 }}>{l.jednotka || '—'}</td>
                    <td style={{ ...TD_STYLE, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(l.cena)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
