/**
 * TariffPage — CRUD UI for supplier tariff management
 *
 * Stores TariffRegistry in localStorage.
 * Uses tariff-versioning.ts from shared package for all business logic.
 *
 * Features:
 *   - View tariffs grouped by service type
 *   - Add new tariff entry (closes overlapping automatically)
 *   - Delete tariff entry
 *   - Price change indicators (current vs previous version)
 *   - Multiple rates per tariff (key/value/unit)
 */

import { useState, useMemo, useCallback } from 'react';
import {
  addTariff,
  comparePrices,
  getTariffHistory,
  getSuppliersByService,
  createRegistry,
  type TariffRegistry,
  type TariffEntry,
  type TariffService,
  type TariffSource,
  type TariffRate,
} from '@stavagent/monolit-shared';
import PortalBreadcrumb from '../components/PortalBreadcrumb';
import '../styles/r0.css';

// ─── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'monolit-tariff-registry';

function loadRegistry(): TariffRegistry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return createRegistry(2024);
}

function saveRegistry(r: TariffRegistry): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch { /* ignore */ }
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<TariffService, string> = {
  pump: 'Čerpadlo',
  concrete: 'Beton',
  formwork_rental: 'Bednění (pronájem)',
  transport: 'Doprava',
  crane: 'Jeřáb',
};

const SOURCE_LABELS: Record<TariffSource, string> = {
  price_list: 'Ceník',
  quote: 'Nabídka',
  contract: 'Smlouva',
  estimated: 'Odhadnuté',
};

const ALL_SERVICES: TariffService[] = ['pump', 'concrete', 'formwork_rental', 'transport', 'crane'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  if (iso === '9999-12-31') return 'aktuální';
  return iso;
}

// ─── Blank form state ─────────────────────────────────────────────────────────

interface NewEntryForm {
  supplier_id: string;
  supplier_name: string;
  service: TariffService;
  valid_from: string;
  valid_to: string;
  source: TariffSource;
  rates: Array<{ key: string; value: string; unit: string; note: string }>;
}

function blankForm(): NewEntryForm {
  return {
    supplier_id: '',
    supplier_name: '',
    service: 'pump',
    valid_from: todayISO(),
    valid_to: '9999-12-31',
    source: 'price_list',
    rates: [{ key: '', value: '', unit: 'Kč/h', note: '' }],
  };
}

// ─── Price change badge ───────────────────────────────────────────────────────

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: '#888', fontSize: '11px' }}>nový</span>;
  if (pct === 0) return <span style={{ color: '#888', fontSize: '11px' }}>beze změny</span>;
  const up = pct > 0;
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 600,
      color: up ? '#c62828' : '#1e7e34',
      background: up ? '#fce4ec' : '#e6f4ea',
      borderRadius: '4px',
      padding: '1px 6px',
    }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Tariff entry card ────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: TariffEntry;
  registry: TariffRegistry;
  onDelete: (id: string) => void;
}

function EntryCard({ entry, registry, onDelete }: EntryCardProps) {
  const [showHistory, setShowHistory] = useState(false);

  const history = useMemo(
    () => getTariffHistory(registry, entry.supplier_id, entry.service),
    [registry, entry.supplier_id, entry.service],
  );

  const priceComparisons = useMemo(
    () => comparePrices(registry, entry.supplier_id, entry.service),
    [registry, entry.supplier_id, entry.service],
  );

  const isLatest = history.length > 0 && history[0].id === entry.id;

  return (
    <div style={{
      background: 'var(--bg-panel, #f0f2f4)',
      border: isLatest ? '1px solid #90a4ae' : '1px solid #cfd8dc',
      borderRadius: '8px',
      padding: '12px 14px',
      marginBottom: '8px',
      opacity: isLatest ? 1 : 0.7,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{entry.supplier_name}</span>
          {' '}
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            background: '#e8eaf6',
            color: '#283593',
            borderRadius: '4px',
            padding: '1px 6px',
          }}>
            {SERVICE_LABELS[entry.service]}
          </span>
          {' '}
          <span style={{ fontSize: '11px', color: '#78909c' }}>
            {SOURCE_LABELS[entry.source]}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#78909c', fontFamily: 'monospace' }}>
            {formatDate(entry.valid_from)} → {formatDate(entry.valid_to)}
          </span>
          <button
            onClick={() => onDelete(entry.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#b71c1c',
              fontSize: '16px',
              padding: '0 4px',
              lineHeight: 1,
            }}
            title="Smazat tento záznam"
          >
            ×
          </button>
        </div>
      </div>

      {/* Rates table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '6px' }}>
        <thead>
          <tr style={{ color: '#78909c' }}>
            <th style={{ textAlign: 'left', paddingBottom: '4px', fontWeight: 500 }}>Položka</th>
            <th style={{ textAlign: 'right', paddingBottom: '4px', fontWeight: 500 }}>Hodnota</th>
            <th style={{ textAlign: 'left', paddingBottom: '4px', fontWeight: 500, paddingLeft: '8px' }}>Jednotka</th>
            {isLatest && <th style={{ textAlign: 'right', paddingBottom: '4px', fontWeight: 500 }}>Změna</th>}
          </tr>
        </thead>
        <tbody>
          {entry.rates.map(rate => {
            const comp = priceComparisons.find(c => c.rate_key === rate.key);
            return (
              <tr key={rate.key} style={{ borderTop: '1px solid #e0e0e0' }}>
                <td style={{ padding: '3px 0', fontFamily: 'monospace', fontSize: '12px', color: '#455a64' }}>
                  {rate.key}
                  {rate.note && <span style={{ color: '#90a4ae', marginLeft: '6px' }}>({rate.note})</span>}
                </td>
                <td style={{ textAlign: 'right', padding: '3px 8px', fontFamily: 'monospace', fontWeight: 600 }}>
                  {rate.value.toLocaleString('cs-CZ')}
                </td>
                <td style={{ padding: '3px 0', color: '#78909c' }}>{rate.unit}</td>
                {isLatest && (
                  <td style={{ textAlign: 'right', padding: '3px 0' }}>
                    <ChangeBadge pct={comp?.change_pct ?? null} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* History toggle */}
      {history.length > 1 && (
        <button
          onClick={() => setShowHistory(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#546e7a',
            padding: '2px 0',
          }}
        >
          {showHistory ? '▲ skrýt historii' : `▼ ${history.length - 1} starší verze`}
        </button>
      )}

      {/* History list */}
      {showHistory && history.slice(1).map(h => (
        <div key={h.id} style={{
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1px dashed #cfd8dc',
          fontSize: '12px',
          color: '#78909c',
        }}>
          <span style={{ fontFamily: 'monospace' }}>{formatDate(h.valid_from)} → {formatDate(h.valid_to)}</span>
          <span style={{ marginLeft: '8px' }}>
            {h.rates.map(r => `${r.key}: ${r.value.toLocaleString('cs-CZ')} ${r.unit}`).join(' | ')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Add tariff form ──────────────────────────────────────────────────────────

interface AddFormProps {
  form: NewEntryForm;
  setForm: (f: NewEntryForm) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function AddForm({ form, setForm, onSubmit, onCancel }: AddFormProps) {
  const addRate = () => {
    setForm({ ...form, rates: [...form.rates, { key: '', value: '', unit: 'Kč/h', note: '' }] });
  };

  const removeRate = (i: number) => {
    setForm({ ...form, rates: form.rates.filter((_, idx) => idx !== i) });
  };

  const updateRate = (i: number, field: keyof typeof form.rates[0], val: string) => {
    const rates = form.rates.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    setForm({ ...form, rates });
  };

  const labelStyle = { fontSize: '12px', fontWeight: 500, color: '#546e7a', display: 'block', marginBottom: '3px' } as React.CSSProperties;
  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    fontSize: '13px',
    border: '1px solid #cfd8dc',
    borderRadius: '6px',
    background: '#fafbfc',
    boxSizing: 'border-box' as const,
  };
  const selectStyle = { ...inputStyle };

  return (
    <div style={{
      background: '#e8f4fd',
      border: '1px solid #90caf9',
      borderRadius: '10px',
      padding: '16px',
      marginBottom: '16px',
    }}>
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px', color: '#0d47a1' }}>
        Nový tarif
      </div>

      {/* Supplier */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <label style={labelStyle}>ID dodavatele</label>
          <input
            style={inputStyle}
            placeholder="berger_sadov"
            value={form.supplier_id}
            onChange={e => setForm({ ...form, supplier_id: e.target.value })}
          />
        </div>
        <div>
          <label style={labelStyle}>Název dodavatele</label>
          <input
            style={inputStyle}
            placeholder="Berger Beton Sadov"
            value={form.supplier_name}
            onChange={e => setForm({ ...form, supplier_name: e.target.value })}
          />
        </div>
      </div>

      {/* Service + Source */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <label style={labelStyle}>Typ služby</label>
          <select
            style={selectStyle}
            value={form.service}
            onChange={e => setForm({ ...form, service: e.target.value as TariffService })}
          >
            {ALL_SERVICES.map(s => (
              <option key={s} value={s}>{SERVICE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Zdroj ceny</label>
          <select
            style={selectStyle}
            value={form.source}
            onChange={e => setForm({ ...form, source: e.target.value as TariffSource })}
          >
            {(Object.entries(SOURCE_LABELS) as [TariffSource, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Date range */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <div>
          <label style={labelStyle}>Platný od</label>
          <input
            type="date"
            style={inputStyle}
            value={form.valid_from}
            onChange={e => setForm({ ...form, valid_from: e.target.value })}
          />
        </div>
        <div>
          <label style={labelStyle}>Platný do (prázdné = aktuální)</label>
          <input
            type="date"
            style={inputStyle}
            value={form.valid_to === '9999-12-31' ? '' : form.valid_to}
            onChange={e => setForm({ ...form, valid_to: e.target.value || '9999-12-31' })}
          />
        </div>
      </div>

      {/* Rates */}
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Sazby</label>
        {form.rates.map((rate, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
            <input
              style={inputStyle}
              placeholder="klíč (např. operation_per_h)"
              value={rate.key}
              onChange={e => updateRate(i, 'key', e.target.value)}
            />
            <input
              style={inputStyle}
              type="number"
              placeholder="hodnota"
              value={rate.value}
              onChange={e => updateRate(i, 'value', e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="jednotka"
              value={rate.unit}
              onChange={e => updateRate(i, 'unit', e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="poznámka (volitelné)"
              value={rate.note}
              onChange={e => updateRate(i, 'note', e.target.value)}
            />
            <button
              onClick={() => removeRate(i)}
              disabled={form.rates.length === 1}
              style={{
                background: 'none',
                border: 'none',
                cursor: form.rates.length === 1 ? 'not-allowed' : 'pointer',
                color: '#b71c1c',
                fontSize: '18px',
                padding: '0 4px',
                opacity: form.rates.length === 1 ? 0.3 : 1,
              }}
              title="Odebrat sazbu"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={addRate}
          style={{
            background: 'none',
            border: '1px dashed #90caf9',
            borderRadius: '6px',
            padding: '4px 12px',
            fontSize: '12px',
            color: '#1565c0',
            cursor: 'pointer',
            marginTop: '2px',
          }}
        >
          + přidat sazbu
        </button>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          className="c-btn c-btn--sm"
          style={{ background: 'none' }}
        >
          Zrušit
        </button>
        <button
          onClick={onSubmit}
          className="c-btn c-btn--sm c-btn--primary"
          disabled={!form.supplier_id || !form.supplier_name || !form.valid_from}
        >
          Uložit tarif
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function TariffPage() {
  const [registry, setRegistry] = useState<TariffRegistry>(loadRegistry);
  const [activeService, setActiveService] = useState<TariffService | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NewEntryForm>(blankForm());
  const [saved, setSaved] = useState(false);

  // Persist on every change
  const updateRegistry = useCallback((r: TariffRegistry) => {
    setRegistry(r);
    saveRegistry(r);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  // Filter entries by selected service
  const filteredEntries = useMemo(() => {
    if (activeService === 'all') return [...registry.entries];
    return registry.entries.filter(e => e.service === activeService);
  }, [registry, activeService]);

  // Sort: latest valid_from first, then by supplier
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const cmp = b.valid_from.localeCompare(a.valid_from);
      return cmp !== 0 ? cmp : a.supplier_name.localeCompare(b.supplier_name);
    });
  }, [filteredEntries]);

  // Count per service
  const countByService = useMemo(() => {
    const counts: Partial<Record<TariffService | 'all', number>> = { all: registry.entries.length };
    for (const s of ALL_SERVICES) {
      counts[s] = registry.entries.filter(e => e.service === s).length;
    }
    return counts;
  }, [registry]);

  // Suppliers for current service (for autocomplete hint)
  const knownSuppliers = useMemo(() => {
    if (activeService === 'all') return [];
    return getSuppliersByService(registry, activeService);
  }, [registry, activeService]);

  const handleSubmit = useCallback(() => {
    // Validate
    const rates: TariffRate[] = form.rates
      .filter(r => r.key && r.value)
      .map(r => ({
        key: r.key.trim(),
        value: parseFloat(r.value),
        unit: r.unit.trim() || 'Kč',
        ...(r.note ? { note: r.note.trim() } : {}),
      }));

    if (!form.supplier_id || !form.supplier_name || rates.length === 0) return;

    const entry: TariffEntry = {
      id: `${form.supplier_id}_${form.service}_${form.valid_from}_${Date.now()}`,
      supplier_id: form.supplier_id.trim(),
      supplier_name: form.supplier_name.trim(),
      service: form.service,
      valid_from: form.valid_from,
      valid_to: form.valid_to || '9999-12-31',
      rates,
      source: form.source,
      created_at: new Date().toISOString(),
    };

    const updated = addTariff(registry, entry);
    updateRegistry(updated);
    setShowAddForm(false);
    setForm(blankForm());
  }, [form, registry, updateRegistry]);

  const handleDelete = useCallback((id: string) => {
    const updated = {
      ...registry,
      entries: registry.entries.filter(e => e.id !== id),
    };
    updateRegistry(updated);
  }, [registry, updateRegistry]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-textured, #e8eaed)',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <PortalBreadcrumb />

      {/* Header */}
      <div style={{
        background: 'var(--bg-panel, #f0f2f4)',
        borderBottom: '1px solid #cfd8dc',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => window.history.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#546e7a', padding: '0 4px' }}
            title="Zpět"
          >
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Tarify dodavatelů</h1>
          {saved && (
            <span style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 500 }}>✓ uloženo</span>
          )}
        </div>
        <button
          onClick={() => { setShowAddForm(v => !v); setForm(blankForm()); }}
          className="c-btn c-btn--sm c-btn--primary"
        >
          {showAddForm ? '✕ Zrušit' : '+ Přidat tarif'}
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
        {/* Add form */}
        {showAddForm && (
          <AddForm
            form={form}
            setForm={setForm}
            onSubmit={handleSubmit}
            onCancel={() => { setShowAddForm(false); setForm(blankForm()); }}
          />
        )}

        {/* Service filter tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {(['all', ...ALL_SERVICES] as (TariffService | 'all')[]).map(s => (
            <button
              key={s}
              onClick={() => setActiveService(s)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: activeService === s ? '2px solid #1565c0' : '1px solid #cfd8dc',
                background: activeService === s ? '#e3f2fd' : 'white',
                color: activeService === s ? '#0d47a1' : '#546e7a',
                fontWeight: activeService === s ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {s === 'all' ? 'Vše' : SERVICE_LABELS[s]}
              {' '}
              <span style={{
                background: activeService === s ? '#1565c0' : '#e0e0e0',
                color: activeService === s ? 'white' : '#546e7a',
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '11px',
                marginLeft: '2px',
              }}>
                {countByService[s] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Known suppliers hint */}
        {activeService !== 'all' && knownSuppliers.length > 0 && (
          <div style={{ fontSize: '12px', color: '#78909c', marginBottom: '8px' }}>
            Aktivní dodavatelé: {knownSuppliers.map(s => s.supplier_name).join(', ')}
          </div>
        )}

        {/* Entries */}
        {sortedEntries.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 16px',
            color: '#90a4ae',
            fontSize: '15px',
          }}>
            {registry.entries.length === 0
              ? 'Žádné tarify. Přidejte první pomocí tlačítka výše.'
              : 'Žádné tarify pro tuto kategorii.'}
          </div>
        ) : (
          sortedEntries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              registry={registry}
              onDelete={handleDelete}
            />
          ))
        )}

        {/* Footer note */}
        {registry.entries.length > 0 && (
          <div style={{ fontSize: '11px', color: '#90a4ae', textAlign: 'center', marginTop: '16px' }}>
            Data uložena v localStorage prohlížeče.
            {registry.base_year && ` Základní rok inflace: ${registry.base_year}.`}
          </div>
        )}
      </div>
    </div>
  );
}
