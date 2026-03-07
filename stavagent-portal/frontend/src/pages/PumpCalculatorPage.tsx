/**
 * PumpCalculatorPage — Standalone pump cost calculator for field use
 *
 * Mobile-first, no auth required. For прораб (foreman) on site:
 *   1. Enter volume + distance + date
 *   2. See all 3 suppliers compared, sorted by price
 *   3. See surcharges (weekend/holiday/night) auto-detected from date
 *   4. See working days calendar context
 *
 * Uses pump-engine logic (browser-side, no backend needed).
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Embedded pump supplier data (from rozpocet-registry) ────────────────────

type BillingModel = 'hourly' | 'hourly_plus_m3' | 'per_15min';

interface PumpSpec {
  name: string;
  reach_m: number;
  arrival_fixed?: number;
  arrival_per_km?: number;
  operation_per_h?: number;
  operation_per_15min?: number;
  volume_per_m3?: number;
}

interface SupplierSurcharges {
  saturday?: number;
  sunday?: number;
  night?: number;
  saturday_pct?: number;
  sunday_pct?: number;
  night_pct?: number;
  night_per_h?: number;
  sunday_per_h?: number;
}

interface Supplier {
  id: string;
  name: string;
  billing_model: BillingModel;
  pumps: PumpSpec[];
  hose_per_m_per_day: number;
  surcharges: SupplierSurcharges;
}

const SUPPLIERS: Supplier[] = [
  {
    id: 'berger_sadov', name: 'Berger Beton Sadov', billing_model: 'hourly_plus_m3',
    pumps: [
      { name: 'PUMI', reach_m: 24, arrival_per_km: 82, operation_per_h: 2450, volume_per_m3: 65 },
      { name: '32-36m', reach_m: 36, arrival_per_km: 80, operation_per_h: 2500, volume_per_m3: 65 },
      { name: '38-42m', reach_m: 42, arrival_per_km: 80, operation_per_h: 3600, volume_per_m3: 65 },
    ],
    hose_per_m_per_day: 140,
    surcharges: { saturday_pct: 15, sunday_pct: 20, night_pct: 15 },
  },
  {
    id: 'frischbeton_kv', name: 'Frischbeton KV', billing_model: 'per_15min',
    pumps: [
      { name: '24-26m PUMI', reach_m: 26, arrival_fixed: 2200, operation_per_15min: 550 },
      { name: '28m', reach_m: 28, arrival_fixed: 2200, operation_per_15min: 550 },
      { name: '32m', reach_m: 32, arrival_fixed: 2400, operation_per_15min: 550 },
      { name: '34-36m', reach_m: 36, arrival_fixed: 2480, operation_per_15min: 630 },
      { name: '38m', reach_m: 38, arrival_fixed: 2720, operation_per_15min: 630 },
    ],
    hose_per_m_per_day: 130,
    surcharges: { night_per_h: 200, sunday_per_h: 220 },
  },
  {
    id: 'beton_union', name: 'Beton Union Plzeň', billing_model: 'hourly',
    pumps: [
      { name: 'PUMI 24m', reach_m: 24, arrival_fixed: 2500, arrival_per_km: 50, operation_per_h: 2200 },
      { name: '32m', reach_m: 32, arrival_fixed: 2500, arrival_per_km: 50, operation_per_h: 2400 },
      { name: '36m', reach_m: 36, arrival_fixed: 2800, arrival_per_km: 50, operation_per_h: 2600 },
      { name: '42m', reach_m: 42, arrival_fixed: 3200, arrival_per_km: 50, operation_per_h: 3000 },
    ],
    hose_per_m_per_day: 120,
    surcharges: { saturday: 1500, sunday: 2000, night: 1200 },
  },
];

// ─── Czech holidays (embedded from calendar-engine) ──────────────────────────

const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1], [5, 1], [5, 8], [7, 5], [7, 6], [9, 28], [10, 28], [11, 17], [12, 24], [12, 25], [12, 26],
];

function easterMonday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day + 1);
}

function goodFriday(year: number): Date {
  const em = easterMonday(year);
  return new Date(em.getFullYear(), em.getMonth(), em.getDate() - 3);
}

type DayType = 'workday' | 'saturday' | 'sunday' | 'holiday';

function getDayType(date: Date): { type: DayType; label: string } {
  const year = date.getFullYear();
  // Check fixed holidays
  const m = date.getMonth() + 1;
  const d = date.getDate();
  for (const [hm, hd] of FIXED_HOLIDAYS) {
    if (m === hm && d === hd) return { type: 'holiday', label: getHolidayName(hm, hd) };
  }
  // Easter
  const gf = goodFriday(year);
  if (date.getMonth() === gf.getMonth() && date.getDate() === gf.getDate()) {
    return { type: 'holiday', label: 'Velký pátek' };
  }
  const em = easterMonday(year);
  if (date.getMonth() === em.getMonth() && date.getDate() === em.getDate()) {
    return { type: 'holiday', label: 'Velikonoční pondělí' };
  }
  const dow = date.getDay();
  if (dow === 0) return { type: 'sunday', label: 'Neděle' };
  if (dow === 6) return { type: 'saturday', label: 'Sobota' };
  return { type: 'workday', label: DAY_NAMES[dow] };
}

const DAY_NAMES = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
const HOLIDAY_NAMES: Record<string, string> = {
  '1-1': 'Nový rok', '5-1': 'Svátek práce', '5-8': 'Den vítězství',
  '7-5': 'Cyril a Metoděj', '7-6': 'Jan Hus', '9-28': 'Den české státnosti',
  '10-28': 'Den vzniku ČSR', '11-17': 'Den boje za svobodu',
  '12-24': 'Štědrý den', '12-25': '1. svátek vánoční', '12-26': '2. svátek vánoční',
};

function getHolidayName(month: number, day: number): string {
  return HOLIDAY_NAMES[`${month}-${day}`] ?? 'Státní svátek';
}

// ─── Pump cost calculation (embedded from pump-engine) ───────────────────────

function calculateArrival(pump: PumpSpec, distance_km: number): number {
  let cost = 0;
  if (pump.arrival_fixed) cost += pump.arrival_fixed;
  if (pump.arrival_per_km) cost += distance_km * pump.arrival_per_km * 2;
  return Math.round(cost);
}

function calculateOperation(model: BillingModel, pump: PumpSpec, hours: number, volume_m3: number): number {
  switch (model) {
    case 'hourly': return (pump.operation_per_h ?? 0) * hours;
    case 'hourly_plus_m3': return (pump.operation_per_h ?? 0) * hours + (pump.volume_per_m3 ?? 0) * volume_m3;
    case 'per_15min': return (pump.operation_per_15min ?? 0) * Math.ceil(hours * 4);
    default: return 0;
  }
}

function calculateSurcharges(s: SupplierSurcharges, baseCost: number, hours: number, dayType: DayType, isNight: boolean): number {
  let surcharge = 0;
  if (dayType === 'saturday') {
    if (s.saturday_pct) surcharge += baseCost * s.saturday_pct / 100;
    else if (s.saturday) surcharge += s.saturday;
  }
  if (dayType === 'sunday' || dayType === 'holiday') {
    if (s.sunday_pct) surcharge += baseCost * s.sunday_pct / 100;
    else if (s.sunday_per_h) surcharge += s.sunday_per_h * hours;
    else if (s.sunday) surcharge += s.sunday;
  }
  if (isNight) {
    if (s.night_pct) surcharge += baseCost * s.night_pct / 100;
    else if (s.night_per_h) surcharge += s.night_per_h * hours;
    else if (s.night) surcharge += s.night;
  }
  return Math.round(surcharge);
}

interface PumpResult {
  supplier: string;
  supplierId: string;
  pumpName: string;
  reachM: number;
  billingModel: string;
  arrival: number;
  operation: number;
  surcharge: number;
  total: number;
  perM3: number;
}

function compareAll(
  volume: number, distance: number, hours: number, minReach: number,
  dayType: DayType, isNight: boolean,
): PumpResult[] {
  const results: PumpResult[] = [];
  for (const sup of SUPPLIERS) {
    for (const pump of sup.pumps) {
      if (pump.reach_m < minReach) continue;
      const arrival = calculateArrival(pump, distance);
      const operation = calculateOperation(sup.billing_model, pump, hours, volume);
      const surcharge = calculateSurcharges(sup.surcharges, operation, hours, dayType, isNight);
      const total = arrival + operation + surcharge;
      results.push({
        supplier: sup.name,
        supplierId: sup.id,
        pumpName: pump.name,
        reachM: pump.reach_m,
        billingModel: sup.billing_model === 'hourly' ? 'Kč/h' : sup.billing_model === 'per_15min' ? 'Kč/15min' : 'Kč/h + Kč/m³',
        arrival, operation, surcharge, total,
        perM3: volume > 0 ? Math.round(total / volume) : 0,
      });
    }
  }
  return results.sort((a, b) => a.total - b.total);
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('cs-CZ');
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Styles (inline — no external CSS needed) ───────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-textured, #B0B2B5)',
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: 'var(--text-primary, #1A1C1E)',
    padding: '0',
  } as React.CSSProperties,
  header: {
    background: 'linear-gradient(180deg, var(--panel-clean, #EAEBEC), var(--panel-clean-end, #DCDEE0))',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  } as React.CSSProperties,
  headerTitle: {
    fontSize: '18px',
    fontWeight: 700,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
    color: 'var(--text-primary, #1A1C1E)',
  } as React.CSSProperties,
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '16px',
  } as React.CSSProperties,
  section: {
    background: 'linear-gradient(180deg, var(--panel-clean, #EAEBEC), var(--panel-clean-end, #DCDEE0))',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--text-secondary, #4A4D50)',
    marginBottom: '12px',
  } as React.CSSProperties,
  inputRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  inputGroup: {
    flex: '1 1 120px',
    minWidth: '120px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary, #4A4D50)',
    marginBottom: '4px',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '16px',
    fontFamily: "'JetBrains Mono', monospace",
    border: '1px solid var(--panel-inset, #D0D2D4)',
    borderRadius: '8px',
    background: 'var(--data-surface, #F5F6F7)',
    color: 'var(--text-primary, #1A1C1E)',
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,
  dateInput: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif",
    border: '1px solid var(--panel-inset, #D0D2D4)',
    borderRadius: '8px',
    background: 'var(--data-surface, #F5F6F7)',
    color: 'var(--text-primary, #1A1C1E)',
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,
  dayBadge: (type: DayType) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    background: type === 'workday' ? '#e6f4ea'
      : type === 'saturday' ? '#fff3e0'
      : type === 'holiday' ? '#fce4ec'
      : '#fce4ec', // sunday
    color: type === 'workday' ? '#1e7e34'
      : type === 'saturday' ? '#e65100'
      : '#c62828',
  } as React.CSSProperties),
  nightToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
  } as React.CSSProperties,
  checkbox: {
    width: '20px',
    height: '20px',
    accentColor: 'var(--accent-orange, #FF9F1C)',
  } as React.CSSProperties,
  resultCard: (isFirst: boolean) => ({
    background: isFirst
      ? 'linear-gradient(135deg, #FFF8E1, #FFF3E0)'
      : 'var(--data-surface, #F5F6F7)',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '10px',
    border: isFirst ? '2px solid var(--accent-orange, #FF9F1C)' : '1px solid var(--panel-inset, #D0D2D4)',
    position: 'relative' as const,
  } as React.CSSProperties),
  bestLabel: {
    position: 'absolute' as const,
    top: '-10px',
    right: '12px',
    background: 'var(--accent-orange, #FF9F1C)',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '8px',
  } as React.CSSProperties,
  supplierName: {
    fontSize: '15px',
    fontWeight: 600,
  } as React.CSSProperties,
  totalPrice: {
    fontSize: '20px',
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--text-primary, #1A1C1E)',
  } as React.CSSProperties,
  pumpInfo: {
    fontSize: '13px',
    color: 'var(--text-secondary, #4A4D50)',
    marginBottom: '8px',
  } as React.CSSProperties,
  costBreakdown: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '2px 12px',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace",
  } as React.CSSProperties,
  costLabel: {
    color: 'var(--text-secondary, #4A4D50)',
    fontFamily: "'Inter', sans-serif",
  } as React.CSSProperties,
  costValue: {
    textAlign: 'right' as const,
  } as React.CSSProperties,
  perM3Badge: {
    display: 'inline-block',
    marginTop: '8px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    background: 'rgba(0,0,0,0.06)',
  } as React.CSSProperties,
  surchargeWarning: {
    display: 'inline-block',
    marginLeft: '6px',
    color: '#c62828',
    fontSize: '12px',
    fontWeight: 600,
  } as React.CSSProperties,
  emptyState: {
    textAlign: 'center' as const,
    padding: '32px 16px',
    color: 'var(--text-muted, #7A7D80)',
    fontSize: '14px',
  } as React.CSSProperties,
  miniCalendar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
    marginTop: '8px',
  } as React.CSSProperties,
  calDay: (type: DayType, isSelected: boolean) => ({
    textAlign: 'center' as const,
    padding: '6px 2px',
    fontSize: '12px',
    fontFamily: "'JetBrains Mono', monospace",
    borderRadius: '4px',
    background: isSelected ? 'var(--accent-orange, #FF9F1C)'
      : type === 'holiday' ? '#ffcdd2'
      : type === 'sunday' ? '#ffcdd2'
      : type === 'saturday' ? '#fff3e0'
      : 'transparent',
    color: isSelected ? '#fff'
      : type === 'holiday' || type === 'sunday' ? '#c62828'
      : type === 'saturday' ? '#e65100'
      : 'var(--text-primary, #1A1C1E)',
    fontWeight: isSelected ? 700 : 400,
    cursor: 'pointer',
  } as React.CSSProperties),
  calHeader: {
    textAlign: 'center' as const,
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-muted, #7A7D80)',
    padding: '4px 0',
  } as React.CSSProperties,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function PumpCalculatorPage() {
  const navigate = useNavigate();

  // Inputs
  const [volume, setVolume] = useState(60);
  const [distance, setDistance] = useState(30);
  const [hours, setHours] = useState(4);
  const [minReach, setMinReach] = useState(24);
  const [dateStr, setDateStr] = useState(toISODate(new Date()));
  const [isNight, setIsNight] = useState(false);

  // Parse date
  const selectedDate = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [dateStr]);

  const dayInfo = useMemo(() => getDayType(selectedDate), [selectedDate]);

  // Calculate results
  const results = useMemo(() => {
    if (volume <= 0 || hours <= 0) return [];
    return compareAll(volume, distance, hours, minReach, dayInfo.type, isNight);
  }, [volume, distance, hours, minReach, dayInfo.type, isNight]);

  const hasSurcharges = dayInfo.type !== 'workday' || isNight;

  // Mini-calendar for the month
  const miniCalDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Start from Monday of the week containing the 1st
    let startDow = firstDay.getDay();
    if (startDow === 0) startDow = 7; // Sunday = 7 in ISO
    const startDate = new Date(year, month, 1 - (startDow - 1));

    const days: { date: Date; dayNum: number; inMonth: boolean; type: DayType }[] = [];
    const cur = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      const dayType = getDayType(cur);
      days.push({
        date: new Date(cur),
        dayNum: cur.getDate(),
        inMonth: cur.getMonth() === month,
        type: dayType.type,
      });
      cur.setDate(cur.getDate() + 1);
      if (i >= 35 && cur.getMonth() !== month) break;
    }
    return days;
  }, [selectedDate]);

  const handleDateClick = useCallback((d: Date) => {
    setDateStr(toISODate(d));
  }, []);

  const monthName = selectedDate.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });

  // Count working days this month
  const workingDaysInMonth = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= lastDay; d++) {
      const dt = getDayType(new Date(year, month, d));
      if (dt.type === 'workday') count++;
    }
    return count;
  }, [selectedDate]);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button style={S.backBtn} onClick={() => navigate('/portal')} title="Zpět na portál">
            &#8592;
          </button>
          <h1 style={S.headerTitle}>
            Kalkulace čerpadla
          </h1>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted, #7A7D80)' }}>
          {workingDaysInMonth} prac. dnů v měsíci
        </span>
      </div>

      <div style={S.container}>
        {/* Input: Volume + Distance */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Parametry betonáže</div>
          <div style={S.inputRow}>
            <div style={S.inputGroup}>
              <label style={S.label}>Objem (m³)</label>
              <input
                type="number"
                inputMode="decimal"
                style={S.input}
                value={volume}
                onChange={e => setVolume(Math.max(0, Number(e.target.value)))}
                min={0}
              />
            </div>
            <div style={S.inputGroup}>
              <label style={S.label}>Vzdálenost (km)</label>
              <input
                type="number"
                inputMode="decimal"
                style={S.input}
                value={distance}
                onChange={e => setDistance(Math.max(0, Number(e.target.value)))}
                min={0}
              />
            </div>
          </div>
          <div style={S.inputRow}>
            <div style={S.inputGroup}>
              <label style={S.label}>Doba čerpání (h)</label>
              <input
                type="number"
                inputMode="decimal"
                style={S.input}
                value={hours}
                onChange={e => setHours(Math.max(0.5, Number(e.target.value)))}
                min={0.5}
                step={0.5}
              />
            </div>
            <div style={S.inputGroup}>
              <label style={S.label}>Min. dosah (m)</label>
              <input
                type="number"
                inputMode="numeric"
                style={S.input}
                value={minReach}
                onChange={e => setMinReach(Math.max(0, Number(e.target.value)))}
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Date + Calendar */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Datum betonáže &amp; kalendář</div>
          <div style={S.inputRow}>
            <div style={{ ...S.inputGroup, flex: '1 1 160px' }}>
              <label style={S.label}>Datum</label>
              <input
                type="date"
                style={S.dateInput}
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
              />
            </div>
            <div style={{ ...S.inputGroup, flex: '1 1 auto', display: 'flex', alignItems: 'flex-end' }}>
              <span style={S.dayBadge(dayInfo.type)}>
                {dayInfo.type === 'workday' ? '&#9679;' : dayInfo.type === 'saturday' ? '&#9888;' : '&#10006;'}
                {' '}{dayInfo.label}
              </span>
            </div>
          </div>

          {/* Night toggle */}
          <div style={S.nightToggle}>
            <input
              type="checkbox"
              style={S.checkbox}
              checked={isNight}
              onChange={e => setIsNight(e.target.checked)}
              id="night"
            />
            <label htmlFor="night" style={{ fontSize: '13px', cursor: 'pointer' }}>
              Noční betonáž (po 18:00)
            </label>
          </div>

          {/* Surcharge indicator */}
          {hasSurcharges && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#fff3e0',
              fontSize: '13px',
              color: '#e65100',
              fontWeight: 500,
            }}>
              Příplatky aktivní: {dayInfo.type !== 'workday' && dayInfo.label}
              {dayInfo.type !== 'workday' && isNight && ' + '}
              {isNight && 'noční'}
            </div>
          )}

          {/* Mini calendar */}
          <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #4A4D50)' }}>
            {monthName}
          </div>
          <div style={S.miniCalendar}>
            {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(d => (
              <div key={d} style={S.calHeader}>{d}</div>
            ))}
            {miniCalDays.map((d, i) => {
              const isSel = d.date.getDate() === selectedDate.getDate()
                && d.date.getMonth() === selectedDate.getMonth();
              return (
                <div
                  key={i}
                  style={{
                    ...S.calDay(d.type, isSel),
                    opacity: d.inMonth ? 1 : 0.3,
                  }}
                  onClick={() => d.inMonth && handleDateClick(d.date)}
                >
                  {d.dayNum}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted, #7A7D80)' }}>
            <span style={{ color: '#c62828' }}>&#9632;</span> svátek/neděle &nbsp;
            <span style={{ color: '#e65100' }}>&#9632;</span> sobota &nbsp;
            <span style={{ background: 'var(--accent-orange, #FF9F1C)', color: '#fff', padding: '0 4px', borderRadius: '3px' }}>&#9632;</span> vybraný den
          </div>
        </div>

        {/* Results */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            Porovnání dodavatelů ({results.length} nabídek)
          </div>

          {results.length === 0 ? (
            <div style={S.emptyState}>
              {volume <= 0 || hours <= 0
                ? 'Zadejte objem a dobu čerpání'
                : 'Žádné čerpadlo nesplňuje požadavek na dosah'}
            </div>
          ) : (
            results.map((r, i) => (
              <div key={`${r.supplierId}-${r.pumpName}`} style={S.resultCard(i === 0)}>
                {i === 0 && <div style={S.bestLabel}>Nejlevnější</div>}
                <div style={S.resultHeader}>
                  <span style={S.supplierName}>{r.supplier}</span>
                  <span style={S.totalPrice}>{fmt(r.total)} Kč</span>
                </div>
                <div style={S.pumpInfo}>
                  {r.pumpName} &middot; dosah {r.reachM} m &middot; {r.billingModel}
                </div>
                <div style={S.costBreakdown}>
                  <span style={S.costLabel}>Příjezd</span>
                  <span style={S.costValue}>{fmt(r.arrival)} Kč</span>
                  <span style={S.costLabel}>Čerpání</span>
                  <span style={S.costValue}>{fmt(r.operation)} Kč</span>
                  {r.surcharge > 0 && (
                    <>
                      <span style={S.costLabel}>
                        Příplatky
                        <span style={S.surchargeWarning}>!</span>
                      </span>
                      <span style={{ ...S.costValue, color: '#c62828' }}>+{fmt(r.surcharge)} Kč</span>
                    </>
                  )}
                </div>
                <span style={S.perM3Badge}>{fmt(r.perM3)} Kč/m³</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
