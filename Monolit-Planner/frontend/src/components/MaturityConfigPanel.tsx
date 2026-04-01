/**
 * MaturityConfigPanel — Inline panel for concrete curing configuration
 *
 * Integrates into FormworkCalculatorModal to replace fixed strip_wait_hours
 * with temperature- and class-dependent curing from ČSN EN 13670.
 */

import { useState, useMemo } from 'react';
import { TriangleAlert } from 'lucide-react';
import {
  calculateCuring,
  getStripWaitHours,
  curingThreePoint,
  CZ_MONTHLY_TEMPS,
  type ConcreteClass,
  type CementType,
  type ElementType,
  type CuringResult,
} from '@stavagent/monolit-shared';

export interface MaturityConfig {
  concrete_class: ConcreteClass;
  temperature_c: number;
  cement_type: CementType;
  element_type: ElementType;
  month: number | null; // 1-12 or null for custom temp
}

interface Props {
  config: MaturityConfig;
  onChange: (config: MaturityConfig) => void;
}

const CONCRETE_CLASSES: ConcreteClass[] = [
  'C12/15', 'C16/20', 'C20/25', 'C25/30',
  'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60',
];

const CEMENT_TYPES: { value: CementType; label: string }[] = [
  { value: 'CEM_I', label: 'CEM I (rychlý)' },
  { value: 'CEM_II', label: 'CEM II (směsný)' },
  { value: 'CEM_III', label: 'CEM III (pomalý)' },
];

const ELEMENT_TYPES: { value: ElementType; label: string }[] = [
  { value: 'slab', label: 'Deska (vodorovná)' },
  { value: 'beam', label: 'Trám (vodorovný)' },
  { value: 'wall', label: 'Stěna (svislá)' },
  { value: 'column', label: 'Sloup (svislý)' },
];

const MONTHS: { value: number; label: string }[] = [
  { value: 1, label: 'Leden' }, { value: 2, label: 'Únor' },
  { value: 3, label: 'Březen' }, { value: 4, label: 'Duben' },
  { value: 5, label: 'Květen' }, { value: 6, label: 'Červen' },
  { value: 7, label: 'Červenec' }, { value: 8, label: 'Srpen' },
  { value: 9, label: 'Září' }, { value: 10, label: 'Říjen' },
  { value: 11, label: 'Listopad' }, { value: 12, label: 'Prosinec' },
];

export function getDefaultMaturityConfig(): MaturityConfig {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  return {
    concrete_class: 'C25/30',
    temperature_c: CZ_MONTHLY_TEMPS[month] ?? 15,
    cement_type: 'CEM_I',
    element_type: 'slab',
    month,
  };
}

export default function MaturityConfigPanel({ config, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const result: CuringResult = useMemo(() =>
    calculateCuring({
      concrete_class: config.concrete_class,
      temperature_c: config.temperature_c,
      cement_type: config.cement_type,
      element_type: config.element_type,
    }),
    [config.concrete_class, config.temperature_c, config.cement_type, config.element_type]
  );

  const threePoint = useMemo(() =>
    curingThreePoint(
      config.concrete_class,
      config.element_type,
      config.temperature_c,
      config.cement_type,
    ),
    [config.concrete_class, config.element_type, config.temperature_c, config.cement_type]
  );

  const handleMonthChange = (month: number | null) => {
    if (month) {
      onChange({
        ...config,
        month,
        temperature_c: CZ_MONTHLY_TEMPS[month] ?? config.temperature_c,
      });
    } else {
      onChange({ ...config, month: null });
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: '4px 6px',
    border: '1px solid var(--border-default, #ccc)',
    borderRadius: '4px',
    fontSize: '12px',
    background: 'var(--panel-bg, #fff)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: 'var(--text-secondary, #666)',
  };

  return (
    <div style={{
      display: 'flex',
      gap: '16px',
      padding: '8px 24px',
      background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)',
      borderBottom: '1px solid var(--border-default, #eee)',
      alignItems: 'center',
      flexWrap: 'wrap',
      fontSize: '12px',
    }}>
      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: '1px solid #4caf50',
          borderRadius: '4px',
          padding: '3px 8px',
          cursor: 'pointer',
          fontSize: '12px',
          color: '#2e7d32',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title="Nastavení zrání betonu dle ČSN EN 13670"
      >
        🧊 Zrání
        <span style={{ fontSize: '10px' }}>{expanded ? '▼' : '▶'}</span>
      </button>

      {/* Summary (always shown) */}
      <span style={{ fontWeight: 600, color: '#2e7d32' }}>
        {result.min_curing_days === Infinity ? <><TriangleAlert size={14} className="inline" /> N/A</> : `${result.min_curing_days} dní`}
      </span>
      <span style={{ color: '#666' }}>
        ({config.concrete_class}, {config.temperature_c}°C, {
          ELEMENT_TYPES.find(e => e.value === config.element_type)?.label || config.element_type
        })
      </span>

      {/* PERT range */}
      <span style={{ color: '#888', fontSize: '11px' }}>
        PERT: {(threePoint.optimistic_hours / 24).toFixed(1)}–{(threePoint.pessimistic_hours / 24).toFixed(1)} dní
      </span>

      {/* Warning */}
      {result.warning && (
        <span style={{ color: '#e65100', fontSize: '11px', fontWeight: 600 }}>
          <TriangleAlert size={11} className="inline" /> {result.warning.split('.')[0]}
        </span>
      )}

      {/* Expanded controls */}
      {expanded && (
        <div style={{
          display: 'flex',
          gap: '12px',
          width: '100%',
          marginTop: '4px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {/* Concrete class */}
          <label style={labelStyle}>
            Třída:
            <select
              value={config.concrete_class}
              onChange={e => onChange({ ...config, concrete_class: e.target.value as ConcreteClass })}
              style={selectStyle}
            >
              {CONCRETE_CLASSES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          {/* Month selector */}
          <label style={labelStyle}>
            Měsíc:
            <select
              value={config.month ?? ''}
              onChange={e => {
                const v = e.target.value;
                handleMonthChange(v ? parseInt(v) : null);
              }}
              style={selectStyle}
            >
              <option value="">— vlastní —</option>
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label} ({CZ_MONTHLY_TEMPS[m.value]}°C)
                </option>
              ))}
            </select>
          </label>

          {/* Temperature (manual or from month) */}
          <label style={labelStyle}>
            Teplota:
            <input
              type="number"
              min={-10}
              max={45}
              step={1}
              value={config.temperature_c}
              onChange={e => onChange({
                ...config,
                temperature_c: parseFloat(e.target.value) || 0,
                month: null,
              })}
              style={{ ...selectStyle, width: '50px' }}
            />
            °C
          </label>

          {/* Cement type */}
          <label style={labelStyle}>
            Cement:
            <select
              value={config.cement_type}
              onChange={e => onChange({ ...config, cement_type: e.target.value as CementType })}
              style={selectStyle}
            >
              {CEMENT_TYPES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          {/* Element type */}
          <label style={labelStyle}>
            Prvek:
            <select
              value={config.element_type}
              onChange={e => onChange({ ...config, element_type: e.target.value as ElementType })}
              style={selectStyle}
            >
              {ELEMENT_TYPES.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </label>

          {/* Result details */}
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: '12px',
            fontSize: '11px',
            color: '#555',
          }}>
            <span>Pevnost při odbednění: <b>{result.estimated_strength_pct}%</b> f<sub>ck</sub></span>
            <span>Min. požadováno: <b>{result.strip_strength_pct}%</b></span>
            <span>Zralost: <b>{Math.round(result.maturity_index)}</b> °C·h</span>
          </div>
        </div>
      )}
    </div>
  );
}
