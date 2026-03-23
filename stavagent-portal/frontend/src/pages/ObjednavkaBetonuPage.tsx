/**
 * ObjednavkaBetonuPage — Unified concrete order page for foremen
 *
 * Single flow: location → find plants → calculate total cost → compare
 *
 * Combines:
 *   - BetonarnyPage (plant search)
 *   - PumpCalculatorPage (pump cost calculation)
 *   - PriceParserPage calculator panel (total cost comparison)
 *   - Manual price entry (TOV-style) when no price list available
 *
 * Data sources:
 *   1. Parsed PDF price lists (from PriceParser) — exact prices
 *   2. Manual entry — foreman calls supplier, enters prices
 *   3. Market averages — fallback estimates
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, MapPin, Phone, Globe, Loader2,
  Building2, ChevronDown, ChevronUp, Edit3, Check, X,
  Calculator, Truck, Droplets, RefreshCw, Download,
} from 'lucide-react';
import { betonarnyAPI, type ConcretePlant, type ScrapeResult } from '../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Manual price entry per supplier (TOV-style) */
interface ManualPrices {
  beton_per_m3: number | null;       // CZK/m³ concrete
  doprava_per_m3: number | null;     // CZK/m³ delivery
  cerpadlo_pristaveni: number | null; // CZK arrival
  cerpadlo_per_h: number | null;     // CZK/h pumping
  cerpadlo_per_m3: number | null;    // CZK/m³ pumping (alternative)
  min_objem_m3: number | null;       // minimum order m³
  notes: string;                      // free text notes
}

interface PlantWithCalc extends ConcretePlant {
  /** Manual prices entered by foreman */
  manual: ManualPrices;
  /** Whether manual edit panel is open */
  editing: boolean;
  /** Computed total */
  totalCzk: number;
  /** Source of prices: 'manual' | 'average' */
  priceSource: 'manual' | 'average';
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PRESET_LOCATIONS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Praha', lat: 50.0755, lon: 14.4378 },
  { name: 'Brno', lat: 49.1951, lon: 16.6068 },
  { name: 'Ostrava', lat: 49.8209, lon: 18.2625 },
  { name: 'Plzeň', lat: 49.7384, lon: 13.3736 },
  { name: 'Karlovy Vary', lat: 50.2325, lon: 12.8713 },
  { name: 'Liberec', lat: 50.7671, lon: 15.0562 },
  { name: 'Olomouc', lat: 49.5938, lon: 17.2509 },
  { name: 'Č. Budějovice', lat: 48.9745, lon: 14.4743 },
];

const BETON_CLASSES = [
  'C8/10', 'C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50',
];

/** Average Czech market prices (2026) — fallback when no manual entry */
const MARKET_AVG = {
  beton_per_m3: 2850,     // CZK/m³ for C25/30
  doprava_per_m3: 280,    // CZK/m³ for ~20km
  cerpadlo_per_h: 3500,   // CZK/h
  cerpadlo_arrival: 5000, // CZK fixed
};

const PUMP_RATE_M3_H = 25; // Practical pump rate m³/h

function emptyManual(): ManualPrices {
  return {
    beton_per_m3: null, doprava_per_m3: null,
    cerpadlo_pristaveni: null, cerpadlo_per_h: null, cerpadlo_per_m3: null,
    min_objem_m3: null, notes: '',
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('cs-CZ');
}

function distColor(km: number | null): string {
  if (km == null) return '#6b7280';
  if (km <= 20) return '#059669';
  if (km <= 40) return '#d97706';
  return '#dc2626';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ObjednavkaBetonuPage() {
  const navigate = useNavigate();

  // ── Step 1: Location
  const [lat, setLat] = useState(50.0755);
  const [lon, setLon] = useState(14.4378);
  const [radius, setRadius] = useState(50);
  const [includeQuarries, setIncludeQuarries] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  // ── Step 2: Order parameters
  const [volume, setVolume] = useState(30);
  const [betonClass, setBetonClass] = useState('C25/30');
  const [needPump, setNeedPump] = useState(true);
  const [pumpHoursOverride, setPumpHoursOverride] = useState<number | null>(null);

  // ── Admin scrape state
  const [showAdmin, setShowAdmin] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);

  // ── Results (plants with calculation)
  const [plantsRaw, setPlantsRaw] = useState<ConcretePlant[]>([]);
  const [manualData, setManualData] = useState<Record<string, { manual: ManualPrices; editing: boolean }>>({});
  const manualDataRef = useRef(manualData);
  manualDataRef.current = manualData;

  // ── Derived: pump hours
  const pumpHours = pumpHoursOverride ?? Math.max(2, Math.ceil(volume / PUMP_RATE_M3_H));

  // ── Search handler
  const handleSearch = useCallback(async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const result = await betonarnyAPI.search(lat, lon, radius, includeQuarries);
      setPlantsRaw(result.plants);
      // Initialize manual data for new plants
      const newManual: Record<string, { manual: ManualPrices; editing: boolean }> = {};
      for (const p of result.plants) {
        newManual[p.id] = manualDataRef.current[p.id] || { manual: emptyManual(), editing: false };
      }
      setManualData(newManual);
      setHasSearched(true);
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Hledání selhalo');
    } finally {
      setSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- manualData excluded to prevent infinite re-render loop (setManualData inside)
  }, [lat, lon, radius, includeQuarries]);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) { setSearchError('Geolokace není podporována'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 10000) / 10000);
        setLon(Math.round(pos.coords.longitude * 10000) / 10000);
        setGeoLoading(false);
      },
      () => { setSearchError('Geolokace zamítnuta'); setGeoLoading(false); },
    );
  }, []);

  const handleScrape = useCallback(async () => {
    setScraping(true);
    setScrapeResult(null);
    try {
      const result = await betonarnyAPI.scrape(undefined, 5);
      setScrapeResult(result);
    } catch (e: unknown) {
      setScrapeResult({
        plants_found: 0, plants_new: 0, plants_updated: 0,
        errors: [e instanceof Error ? e.message : 'Scraping selhal'],
      });
    } finally {
      setScraping(false);
    }
  }, []);

  // ── Calculate total for each plant
  const plantsWithCalc: PlantWithCalc[] = useMemo(() => {
    return plantsRaw.map(plant => {
      const md = manualData[plant.id] || { manual: emptyManual(), editing: false };
      const m = md.manual;
      const hasManual = m.beton_per_m3 != null || m.doprava_per_m3 != null;
      const priceSource = hasManual ? 'manual' as const : 'average' as const;

      // Concrete
      const betonUnit = m.beton_per_m3 ?? MARKET_AVG.beton_per_m3;
      const betonTotal = betonUnit * volume;

      // Delivery
      const dopravaUnit = m.doprava_per_m3 ?? MARKET_AVG.doprava_per_m3;
      const dopravaTotal = dopravaUnit * volume;

      // Pump
      let pumpTotal = 0;
      if (needPump) {
        const arrival = m.cerpadlo_pristaveni ?? MARKET_AVG.cerpadlo_arrival;
        if (m.cerpadlo_per_m3 != null) {
          // m³ billing
          pumpTotal = arrival + m.cerpadlo_per_m3 * volume;
        } else {
          const perH = m.cerpadlo_per_h ?? MARKET_AVG.cerpadlo_per_h;
          pumpTotal = arrival + perH * pumpHours;
        }
      }

      const totalCzk = betonTotal + dopravaTotal + pumpTotal;

      return {
        ...plant,
        manual: m,
        editing: md.editing,
        totalCzk,
        priceSource,
      };
    }).sort((a, b) => a.totalCzk - b.totalCzk);
  }, [plantsRaw, manualData, volume, needPump, pumpHours]);

  // ── Manual edit handlers
  const toggleEdit = (plantId: string) => {
    setManualData(prev => ({
      ...prev,
      [plantId]: { ...prev[plantId], editing: !prev[plantId]?.editing },
    }));
  };

  const updateManual = (plantId: string, field: keyof ManualPrices, value: string) => {
    setManualData(prev => {
      const entry = prev[plantId] || { manual: emptyManual(), editing: true };
      const numVal = value === '' ? null : Number(value);
      return {
        ...prev,
        [plantId]: {
          ...entry,
          manual: {
            ...entry.manual,
            [field]: field === 'notes' ? value : numVal,
          },
        },
      };
    });
  };

  // ── Best price reference
  const bestTotal = plantsWithCalc.length > 0 ? plantsWithCalc[0].totalCzk : 0;

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
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      }}>
        <button onClick={() => navigate('/portal')} style={{
          background: 'none', border: 'none', color: '#ccc',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14,
        }}>
          <ArrowLeft size={18} /> Portal
        </button>
        <h1 style={{ color: 'white', fontSize: 18, fontWeight: 600, margin: 0 }}>
          Objednávka betonu
        </h1>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>

        {/* ── STEP 1: Location + Order Params ─────────────────────────── */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Building2 size={20} style={{ color: '#FF9F1C' }} />
            <h2 style={H2}>Kde stavíte?</h2>
          </div>

          {/* Quick locations */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {PRESET_LOCATIONS.map(p => (
              <button key={p.name} onClick={() => { setLat(p.lat); setLon(p.lon); }}
                style={{
                  ...CHIP,
                  background: (lat === p.lat && lon === p.lon) ? '#FF9F1C' : 'white',
                  color: (lat === p.lat && lon === p.lon) ? 'white' : '#374151',
                }}
              >
                {p.name}
              </button>
            ))}
            <button onClick={handleGeolocate} disabled={geoLoading}
              style={{ ...CHIP, borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {geoLoading ? <Loader2 size={12} /> : <MapPin size={12} />}
              Moje poloha
            </button>
          </div>

          {/* GPS + Radius + Order params — one grid */}
          <div style={GRID}>
            <InputField label="Šířka (lat)" type="number" step="0.0001"
              value={lat} onChange={v => setLat(Number(v))} />
            <InputField label="Délka (lon)" type="number" step="0.0001"
              value={lon} onChange={v => setLon(Number(v))} />
            <InputField label="Radius (km)" type="number" min={1} max={200}
              value={radius} onChange={v => setRadius(Number(v))} />
          </div>

          <div style={{ ...GRID, marginTop: 12 }}>
            <InputField label="Objem betonu (m³)" type="number" min={1}
              value={volume} onChange={v => setVolume(Math.max(1, Number(v)))} />
            <div>
              <label style={LABEL}>Třída betonu</label>
              <select value={betonClass} onChange={e => setBetonClass(e.target.value)} style={INPUT}>
                {BETON_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Čerpadlo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={needPump} onChange={e => setNeedPump(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#FF9F1C' }} />
                  Potřebuji
                </label>
              </div>
            </div>
          </div>

          {needPump && (
            <div style={{ ...GRID, marginTop: 12 }}>
              <InputField label={`Doba čerpání (h) — odhad: ${Math.max(2, Math.ceil(volume / PUMP_RATE_M3_H))}h`}
                type="number" min={1} step={0.5}
                value={pumpHoursOverride ?? ''}
                placeholder={String(Math.max(2, Math.ceil(volume / PUMP_RATE_M3_H)))}
                onChange={v => setPumpHoursOverride(v === '' ? null : Number(v))} />
            </div>
          )}

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <button onClick={handleSearch} disabled={searching}
              style={{
                ...BTN_PRIMARY,
                opacity: searching ? 0.6 : 1,
              }}>
              {searching ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
              Najít betonárny a spočítat
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={includeQuarries}
                onChange={e => setIncludeQuarries(e.target.checked)} />
              Včetně lomů
            </label>
          </div>
        </div>

        {/* Error */}
        {searchError && (
          <div style={{
            padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 6, color: '#dc2626', fontSize: 14, marginBottom: 16,
          }}>
            {searchError}
          </div>
        )}

        {/* ── STEP 2: Results ─────────────────────────────────────────── */}
        {hasSearched && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                {plantsWithCalc.length} {plantsWithCalc.length === 1 ? 'betonárna' : 'betonáren'} —
                {' '}{volume} m³ {betonClass}
              </h3>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                řazeno od nejlevnějšího
              </span>
            </div>

            {/* Legend */}
            <div style={{
              display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: '#6b7280',
              flexWrap: 'wrap',
            }}>
              <span><span style={{ color: '#059669' }}>●</span> cena z ceníku / ruční zadání</span>
              <span><span style={{ color: '#9ca3af' }}>●</span> průměrná cena (odhad)</span>
              <span><Edit3 size={12} style={{ verticalAlign: 'middle' }} /> klik = zadat vlastní ceny</span>
            </div>

            {plantsWithCalc.length === 0 ? (
              <div style={{ ...CARD, textAlign: 'center', color: '#6b7280', padding: 40 }}>
                V okolí nebyly nalezeny žádné betonárny. Zkuste zvětšit radius.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plantsWithCalc.map((plant, idx) => (
                  <PlantResultCard
                    key={plant.id}
                    plant={plant}
                    rank={idx + 1}
                    isFirst={idx === 0}
                    bestTotal={bestTotal}
                    volume={volume}
                    needPump={needPump}
                    pumpHours={pumpHours}
                    onToggleEdit={() => toggleEdit(plant.id)}
                    onUpdateManual={(field, value) => updateManual(plant.id, field, value)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Admin: Scraping BetonServer ─────────────────────────── */}
        <div style={{
          background: 'white', borderRadius: 8,
          border: '1px solid #e5e7eb', overflow: 'hidden', marginTop: 24,
        }}>
          <button
            onClick={() => setShowAdmin(prev => !prev)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: '#6b7280', textAlign: 'left',
            }}
          >
            <RefreshCw size={16} />
            <span style={{ flex: 1 }}>Admin — Scraping BetonServer.cz</span>
            {showAdmin ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAdmin && (
            <div style={{ padding: '0 16px 16px' }}>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Spustí scraping BetonServer.cz pro aktualizaci seznamu betonáren.
                Doporučeno spouštět 1× měsíčně.
              </p>
              <button
                onClick={handleScrape}
                disabled={scraping}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 20px',
                  background: '#374151', color: 'white', border: 'none',
                  borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  opacity: scraping ? 0.6 : 1,
                }}
              >
                {scraping ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
                {scraping ? 'Scrapuji...' : 'Spustit scraping'}
              </button>

              {scrapeResult && (
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: scrapeResult.errors.length > 0 ? '#fef2f2' : '#f0fdf4',
                  borderRadius: 6, fontSize: 13,
                }}>
                  <div>Nalezeno: <strong>{scrapeResult.plants_found}</strong></div>
                  <div>Nových: <strong>{scrapeResult.plants_new}</strong></div>
                  <div>Aktualizovaných: <strong>{scrapeResult.plants_updated}</strong></div>
                  {scrapeResult.errors.length > 0 && (
                    <div style={{ color: '#dc2626', marginTop: 4 }}>
                      Chyby: {scrapeResult.errors.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Plant Result Card ──────────────────────────────────────────────────────

function PlantResultCard({
  plant, rank, isFirst, bestTotal, volume, needPump, pumpHours,
  onToggleEdit, onUpdateManual,
}: {
  plant: PlantWithCalc;
  rank: number;
  isFirst: boolean;
  bestTotal: number;
  volume: number;
  needPump: boolean;
  pumpHours: number;
  onToggleEdit: () => void;
  onUpdateManual: (field: keyof ManualPrices, value: string) => void;
}) {
  const m = plant.manual;
  const isManual = plant.priceSource === 'manual';

  // Cost breakdown
  const betonUnit = m.beton_per_m3 ?? MARKET_AVG.beton_per_m3;
  const betonTotal = betonUnit * volume;
  const dopravaUnit = m.doprava_per_m3 ?? MARKET_AVG.doprava_per_m3;
  const dopravaTotal = dopravaUnit * volume;
  let pumpTotal = 0;
  if (needPump) {
    const arrival = m.cerpadlo_pristaveni ?? MARKET_AVG.cerpadlo_arrival;
    if (m.cerpadlo_per_m3 != null) {
      pumpTotal = arrival + m.cerpadlo_per_m3 * volume;
    } else {
      const perH = m.cerpadlo_per_h ?? MARKET_AVG.cerpadlo_per_h;
      pumpTotal = arrival + perH * pumpHours;
    }
  }

  const savingsPct = bestTotal > 0 && !isFirst
    ? Math.round(((plant.totalCzk - bestTotal) / bestTotal) * 100)
    : 0;

  return (
    <div style={{
      background: 'white',
      borderRadius: 10,
      border: isFirst ? '2px solid #FF9F1C' : '1px solid #e5e7eb',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {isFirst && (
        <div style={{
          position: 'absolute', top: -1, right: 16,
          background: '#FF9F1C', color: 'white',
          fontSize: 11, fontWeight: 700, padding: '3px 12px',
          borderRadius: '0 0 8px 8px', textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          Nejlevnější
        </div>
      )}

      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px' }}>
        {/* Rank */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: rank <= 3 ? '#FF9F1C' : '#e5e7eb',
          color: rank <= 3 ? 'white' : '#6b7280',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
        }}>
          {rank}
        </div>

        {/* Plant info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <strong style={{ fontSize: 14 }}>{plant.name}</strong>
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 600,
              background: plant.source === 'osm' ? '#dbeafe' : '#fef3c7',
              color: plant.source === 'osm' ? '#1e40af' : '#92400e',
            }}>
              {plant.source === 'osm' ? 'OSM' : 'BetonServer'}
            </span>
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 600,
              background: isManual ? '#d1fae5' : '#f3f4f6',
              color: isManual ? '#065f46' : '#9ca3af',
            }}>
              {isManual ? 'vlastní ceny' : 'průměr'}
            </span>
          </div>

          {plant.address && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{plant.address}</div>
          )}

          {/* Contact links */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
            {plant.contact.phone && (
              <a href={`tel:${plant.contact.phone}`}
                style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', textDecoration: 'none' }}>
                <Phone size={12} /> {plant.contact.phone}
              </a>
            )}
            {plant.contact.website && (
              <a href={plant.contact.website} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', textDecoration: 'none' }}>
                <Globe size={12} /> Web
              </a>
            )}
          </div>

          {/* Cost breakdown */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto',
            gap: '2px 16px', marginTop: 10, fontSize: 13,
          }}>
            <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Droplets size={13} /> Beton ({fmt(betonUnit)} Kč/m³ × {volume})
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(betonTotal)} Kč</span>

            <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Truck size={13} /> Doprava ({fmt(dopravaUnit)} Kč/m³ × {volume})
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(dopravaTotal)} Kč</span>

            {needPump && (
              <>
                <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calculator size={13} /> Čerpadlo
                  {m.cerpadlo_per_m3 != null
                    ? ` (${fmt(m.cerpadlo_pristaveni ?? MARKET_AVG.cerpadlo_arrival)} + ${m.cerpadlo_per_m3} Kč/m³)`
                    : ` (${fmt(m.cerpadlo_pristaveni ?? MARKET_AVG.cerpadlo_arrival)} + ${pumpHours}h × ${fmt(m.cerpadlo_per_h ?? MARKET_AVG.cerpadlo_per_h)})`
                  }
                </span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(pumpTotal)} Kč</span>
              </>
            )}
          </div>

          {m.notes && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
              {m.notes}
            </div>
          )}
        </div>

        {/* Right: distance + total */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', marginBottom: 2 }}>
            {fmt(plant.totalCzk)} Kč
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            {volume > 0 ? `${fmt(Math.round(plant.totalCzk / volume))} Kč/m³` : '—'}
          </div>
          <div style={{
            fontSize: 16, fontWeight: 700,
            color: distColor(plant.distance_km),
          }}>
            {plant.distance_km != null ? `${plant.distance_km} km` : '—'}
          </div>
          {savingsPct > 0 && (
            <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
              +{savingsPct}% dražší
            </div>
          )}
        </div>
      </div>

      {/* Edit button */}
      <div style={{
        borderTop: '1px solid #f3f4f6',
        padding: '6px 16px',
        display: 'flex', alignItems: 'center',
      }}>
        <button onClick={onToggleEdit} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: plant.editing ? '#FF9F1C' : '#6b7280',
          fontWeight: plant.editing ? 600 : 400,
          padding: '4px 0',
        }}>
          {plant.editing ? <ChevronUp size={14} /> : <Edit3 size={14} />}
          {plant.editing ? 'Zavřít ruční zadání' : 'Zadat vlastní ceny (prořab ví cenu)'}
        </button>
      </div>

      {/* Manual price entry (TOV-style) */}
      {plant.editing && (
        <div style={{
          background: '#fafbfc', borderTop: '1px solid #e5e7eb',
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Ruční zadání cen
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <ManualField label="Beton (Kč/m³)" value={m.beton_per_m3}
              placeholder={String(MARKET_AVG.beton_per_m3)}
              onChange={v => onUpdateManual('beton_per_m3', v)} />
            <ManualField label="Doprava (Kč/m³)" value={m.doprava_per_m3}
              placeholder={String(MARKET_AVG.doprava_per_m3)}
              onChange={v => onUpdateManual('doprava_per_m3', v)} />
            <ManualField label="Čerpadlo přístavení (Kč)" value={m.cerpadlo_pristaveni}
              placeholder={String(MARKET_AVG.cerpadlo_arrival)}
              onChange={v => onUpdateManual('cerpadlo_pristaveni', v)} />
            <ManualField label="Čerpadlo (Kč/h)" value={m.cerpadlo_per_h}
              placeholder={String(MARKET_AVG.cerpadlo_per_h)}
              onChange={v => onUpdateManual('cerpadlo_per_h', v)} />
            <ManualField label="Čerpadlo (Kč/m³) alt." value={m.cerpadlo_per_m3}
              placeholder="—"
              onChange={v => onUpdateManual('cerpadlo_per_m3', v)} />
            <ManualField label="Min. objem (m³)" value={m.min_objem_m3}
              placeholder="—"
              onChange={v => onUpdateManual('min_objem_m3', v)} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={{ ...LABEL, marginBottom: 4 }}>Poznámky</label>
            <input type="text" value={m.notes} placeholder="Např: volal 8.3., cena platí do konce měsíce"
              onChange={e => onUpdateManual('notes', e.target.value)}
              style={{ ...INPUT, width: '100%' }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small components ───────────────────────────────────────────────────────

function InputField({ label, value, onChange, placeholder, ...rest }: {
  label: string; value: string | number; onChange: (v: string) => void;
  placeholder?: string;
  [key: string]: unknown;
}) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <input
        {...rest}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={INPUT}
      />
    </div>
  );
}

function ManualField({ label, value, placeholder, onChange }: {
  label: string; value: number | null; placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ ...LABEL, fontSize: 11 }}>{label}</label>
      <input type="number" min={0} step="any"
        value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ ...INPUT, fontSize: 13, padding: '6px 10px' }} />
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'white', borderRadius: 8, padding: 20,
  marginBottom: 24, border: '1px solid #e5e7eb',
};
const H2: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0 };
const GRID: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
};
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
};
const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
};
const CHIP: React.CSSProperties = {
  padding: '4px 12px', borderRadius: 20, border: '1px solid #d1d5db',
  fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'white',
};
const BTN_PRIMARY: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 24px', background: '#FF9F1C', color: 'white',
  border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
