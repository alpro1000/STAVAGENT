/**
 * Reusable UI primitives for the Calculator (PlannerPage Part B).
 * Extracted from PlannerPage.tsx — Section, Field, Card, KPICard, Row,
 * NumInput, CollapsibleSection, SuggestionBadge, DocWarningsBanner.
 */

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { DocSuggestion, DocSuggestionsResponse } from './types';

// ─── Section ───────────────────────────────────────────────────────────────

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
        color: 'var(--r0-slate-500)', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Field ─────────────────────────────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--r0-slate-600)', marginBottom: 3 }}>
        {label}
        {hint && <span style={{ color: 'var(--r0-slate-400)', marginLeft: 4 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────

export function Card({ title, icon, children, borderColor }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; borderColor?: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: 6, padding: 16, marginBottom: 12,
      border: '1px solid var(--r0-slate-200)',
      borderLeftWidth: borderColor ? 4 : 1, borderLeftColor: borderColor || 'var(--r0-slate-200)',
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: 'var(--r0-slate-800)' }}>
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

// ─── KPICard ───────────────────────────────────────────────────────────────

export function KPICard({ label, value, unit, color, tooltip }: {
  label: string; value: string | number; unit?: string; color: string;
  /** Optional hover tooltip shown on the label (ℹ️) — explains the number */
  tooltip?: string;
}) {
  return (
    <div
      style={{
        background: 'white', borderRadius: 6, padding: 0,
        border: '1px solid var(--r0-slate-200)',
        borderLeftWidth: 4, borderLeftColor: color,
        overflow: 'visible',
      }}
      title={tooltip}
    >
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--r0-slate-500)',
        padding: '5px 12px 4px', borderBottom: '1px solid var(--r0-slate-200)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span>{label}</span>
        {tooltip && (
          <span
            style={{
              fontSize: 10, color: 'var(--r0-slate-400)',
              cursor: 'help', userSelect: 'none',
            }}
            aria-label={tooltip}
          >ⓘ</span>
        )}
      </div>
      <div style={{ padding: '6px 12px 7px' }}>
        <div style={{
          fontSize: 20, fontWeight: 600, color: 'var(--r0-slate-800)',
          fontFamily: "var(--r0-font-mono, 'JetBrains Mono', monospace)",
          fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
        }}>
          {value}
        </div>
        {unit && <div style={{ fontSize: 9, color: 'var(--r0-slate-400)', marginTop: 2 }}>{unit}</div>}
      </div>
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────

export function Row({ label, value, bold }: { label: React.ReactNode; value: string; bold?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 0', fontSize: 13, borderBottom: '1px solid var(--r0-slate-100)',
    }}>
      <span style={{ color: 'var(--r0-slate-500)' }}>{label}</span>
      <span style={{
        color: 'var(--r0-slate-800)',
        fontWeight: bold ? 600 : 500,
        fontFamily: "var(--r0-font-mono, 'JetBrains Mono', monospace)",
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  );
}

// ─── NumInput ──────────────────────────────────────────────────────────────

export function NumInput({ value, onChange, min = 0, max, fallback, step, style, placeholder }: {
  value: number | string;
  onChange: (v: number | string) => void;
  min?: number;
  max?: number;
  fallback?: number;
  step?: number;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;

  const handleFocus = () => setDraft(String(value));
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value);
  const handleBlur = () => {
    const raw = (draft ?? '').trim();
    setDraft(null);
    if (raw === '') {
      onChange(fallback !== undefined ? fallback : '');
      return;
    }
    let num = parseFloat(raw);
    if (isNaN(num)) { onChange(fallback !== undefined ? fallback : ''); return; }
    if (num < min) num = min;
    if (max !== undefined && num > max) num = max;
    onChange(typeof value === 'string' && fallback === undefined ? String(num) : num);
  };

  return (
    <input
      type="number"
      style={style}
      value={editing ? draft : value}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
    />
  );
}

// ─── SuggestionBadge ───────────────────────────────────────────────────────

export function SuggestionBadge({ suggestion, onAccept, onDismiss }: {
  suggestion: DocSuggestion | undefined;
  onAccept: (param: string, value: any) => void;
  onDismiss: (param: string) => void;
}) {
  if (!suggestion) return null;

  const confPct = Math.round(suggestion.source.confidence * 100);
  const displayValue = Array.isArray(suggestion.value)
    ? suggestion.value.join(', ')
    : String(suggestion.value);

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 6px', marginLeft: 6,
      background: 'var(--r0-info-bg, #e8f4fd)', border: '1px solid var(--r0-info-border, #b3d9f2)',
      borderRadius: 4, fontSize: 10, lineHeight: '16px', whiteSpace: 'nowrap',
    }}>
      <span style={{ color: 'var(--r0-info-text, #1a73e8)' }} title={
        `Zdroj: ${suggestion.source.document}${suggestion.source.page ? `, str. ${suggestion.source.page}` : ''} (${confPct}%)`
      }>
        {suggestion.label}: <strong>{displayValue}</strong>
      </span>
      <button
        onClick={() => onAccept(suggestion.param, suggestion.value)}
        title="Přijmout doporučení"
        style={{
          background: 'var(--r0-green, #34a853)', color: 'white', border: 'none',
          borderRadius: 3, padding: '0 4px', fontSize: 10, cursor: 'pointer',
          fontFamily: 'inherit', lineHeight: '14px',
        }}
      >
        Prijmout
      </button>
      <button
        onClick={() => onDismiss(suggestion.param)}
        title="Odmítnout"
        style={{
          background: 'none', color: 'var(--r0-slate-400, #999)', border: 'none',
          padding: '0 2px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          lineHeight: '14px',
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── DocWarningsBanner ─────────────────────────────────────────────────────

export function DocWarningsBanner({ response }: {
  response: DocSuggestionsResponse | null;
}) {
  if (!response || response.warnings.length === 0) return null;

  const blocking = response.warnings.filter(w => w.severity === 'blocking');
  const recommended = response.warnings.filter(w => w.severity === 'recommended');
  const info = response.warnings.filter(w => w.severity === 'info');

  const hasActionable = blocking.length > 0 || recommended.length > 0;

  return (
    <div style={{ marginBottom: 12 }}>
      {blocking.map((w, i) => (
        <div key={`b-${i}`} style={{
          padding: '8px 10px', marginBottom: 4,
          background: '#fde8e8', border: '1px solid #f5c6c6',
          borderRadius: 6, fontSize: 11, color: '#c53030', lineHeight: 1.5,
        }}>
          <strong>Chyba:</strong> {w.message}
          {w.rule && <span style={{ opacity: 0.7, marginLeft: 4 }}>({w.rule})</span>}
        </div>
      ))}

      {recommended.map((w, i) => (
        <div key={`r-${i}`} style={{
          padding: '8px 10px', marginBottom: 4,
          background: '#fef9e7', border: '1px solid #f5e6a3',
          borderRadius: 6, fontSize: 11, color: '#7c6a0a', lineHeight: 1.5,
        }}>
          <strong>Doporuceni:</strong> {w.message}
        </div>
      ))}

      {info.length > 0 && !hasActionable && (
        <div style={{
          padding: '6px 10px', marginBottom: 4,
          background: 'var(--r0-info-bg, #e8f4fd)', border: '1px solid var(--r0-info-border, #b3d9f2)',
          borderRadius: 6, fontSize: 10, color: 'var(--r0-info-text, #1a73e8)',
        }}>
          {info[0].message}
          {response.documents_used.length > 0 && (
            <span style={{ marginLeft: 4, opacity: 0.7 }}>
              ({response.documents_used.join(', ')})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CollapsibleSection (accordion) ────────────────────────────────────────

export function CollapsibleSection({ title, icon, children, defaultOpen = false, mobileDefaultOpen }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Override default for mobile (<768px). Falls back to defaultOpen if not set. */
  mobileDefaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (mobileDefaultOpen !== undefined && typeof window !== 'undefined' && window.innerWidth < 768) {
      return mobileDefaultOpen;
    }
    return defaultOpen;
  });

  return (
    <div className={`r0-collapsible${isOpen ? ' r0-collapsible--open' : ''}`}>
      <button
        className="r0-collapsible__trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <ChevronRight size={16} />
        {icon} {title}
      </button>
      {isOpen && (
        <div className="r0-collapsible__body">
          {children}
        </div>
      )}
    </div>
  );
}
