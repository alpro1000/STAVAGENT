/**
 * BetonarnyPage — Find concrete plants near your construction site
 *
 * Features:
 *   1. Enter GPS coords or use geolocation
 *   2. Search Overpass API (OSM) + cached BetonServer data
 *   3. Distance-sorted list with contact info
 *   4. Admin: trigger BetonServer scraping
 *   5. Link to PriceParser for each supplier with website
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, MapPin, Phone, Globe, Download,
  Loader2, Building2, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { betonarnyAPI, type ConcretePlant, type ScrapeResult } from '../services/api';

// ─── Czech cities quick-select ──────────────────────────────────────────────

const PRESET_LOCATIONS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Praha', lat: 50.0755, lon: 14.4378 },
  { name: 'Brno', lat: 49.1951, lon: 16.6068 },
  { name: 'Ostrava', lat: 49.8209, lon: 18.2625 },
  { name: 'Plzeň', lat: 49.7384, lon: 13.3736 },
  { name: 'Karlovy Vary', lat: 50.2325, lon: 12.8713 },
  { name: 'Liberec', lat: 50.7671, lon: 15.0562 },
  { name: 'Olomouc', lat: 49.5938, lon: 17.2509 },
  { name: 'České Budějovice', lat: 48.9745, lon: 14.4743 },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function BetonarnyPage() {
  const navigate = useNavigate();

  // Search state
  const [lat, setLat] = useState<number>(50.0755);
  const [lon, setLon] = useState<number>(14.4378);
  const [radius, setRadius] = useState<number>(50);
  const [includeQuarries, setIncludeQuarries] = useState(false);
  const [searching, setSearching] = useState(false);
  const [plants, setPlants] = useState<ConcretePlant[]>([]);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Admin scrape state
  const [showAdmin, setShowAdmin] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);

  // Geolocation
  const [geoLoading, setGeoLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const result = await betonarnyAPI.search(lat, lon, radius, includeQuarries);
      setPlants(result.plants);
      setSourcesUsed(result.sources_used);
      setHasSearched(true);
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Hledání selhalo');
    } finally {
      setSearching(false);
    }
  }, [lat, lon, radius, includeQuarries]);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setSearchError('Geolokace není podporována');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 10000) / 10000);
        setLon(Math.round(pos.coords.longitude * 10000) / 10000);
        setGeoLoading(false);
      },
      () => {
        setSearchError('Geolokace zamítnuta');
        setGeoLoading(false);
      },
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

  const handlePreset = (preset: typeof PRESET_LOCATIONS[0]) => {
    setLat(preset.lat);
    setLon(preset.lon);
  };

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
            background: 'none', border: 'none', color: 'var(--text-inverse, #ccc)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14,
          }}
        >
          <ArrowLeft size={18} /> Portal
        </button>
        <h1 style={{ color: 'white', fontSize: 18, fontWeight: 600, margin: 0 }}>
          Betonárny v okolí
        </h1>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
        {/* Search Panel */}
        <div style={{
          background: 'var(--bg-secondary, white)',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          border: '1px solid var(--border-color, #e5e7eb)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Building2 size={20} style={{ color: 'var(--brand-orange, #FF9F1C)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Hledat betonárny</h2>
          </div>

          {/* Quick locations */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {PRESET_LOCATIONS.map(p => (
              <button
                key={p.name}
                onClick={() => handlePreset(p)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: '1px solid var(--border-color, #ccc)',
                  background: (lat === p.lat && lon === p.lon) ? 'var(--brand-orange, #FF9F1C)' : 'white',
                  color: (lat === p.lat && lon === p.lon) ? 'white' : 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {p.name}
              </button>
            ))}
            <button
              onClick={handleGeolocate}
              disabled={geoLoading}
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                border: '1px dashed var(--border-color, #ccc)',
                background: 'white',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--text-secondary)',
              }}
            >
              {geoLoading ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
              Moje poloha
            </button>
          </div>

          {/* Inputs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}>
            <label style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Šířka (lat)</span>
              <input type="number" step="0.0001" value={lat}
                onChange={e => setLat(Number(e.target.value))}
                style={INPUT_STYLE} />
            </label>
            <label style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Délka (lon)</span>
              <input type="number" step="0.0001" value={lon}
                onChange={e => setLon(Number(e.target.value))}
                style={INPUT_STYLE} />
            </label>
            <label style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Radius (km)</span>
              <input type="number" min={1} max={200} value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                style={INPUT_STYLE} />
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={handleSearch}
              disabled={searching}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 24px',
                background: 'var(--brand-orange, #FF9F1C)',
                color: 'white', border: 'none', borderRadius: 6,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                opacity: searching ? 0.6 : 1,
              }}
            >
              {searching ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
              Hledat
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

        {/* Results */}
        {hasSearched && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                Nalezeno: {plants.length} {plants.length === 1 ? 'betonárna' : 'betonáren'}
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Zdroje: {sourcesUsed.join(', ')}
              </span>
            </div>

            {plants.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center',
                background: 'var(--bg-secondary, white)',
                borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)',
                color: 'var(--text-secondary)',
              }}>
                V okolí nebyly nalezeny žádné betonárny. Zkuste zvětšit radius.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plants.map((plant, idx) => (
                  <PlantCard key={plant.id} plant={plant} rank={idx + 1} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin Section */}
        <div style={{
          background: 'var(--bg-secondary, white)',
          borderRadius: 8,
          border: '1px solid var(--border-color, #e5e7eb)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowAdmin(prev => !prev)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              color: 'var(--text-secondary)',
              textAlign: 'left',
            }}
          >
            <RefreshCw size={16} />
            <span style={{ flex: 1 }}>Admin — Scraping BetonServer.cz</span>
            {showAdmin ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAdmin && (
            <div style={{ padding: '0 16px 16px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
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

// ─── Plant Card Component ───────────────────────────────────────────────────

function PlantCard({ plant, rank }: { plant: ConcretePlant; rank: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '14px 16px',
      background: 'var(--bg-secondary, white)',
      borderRadius: 8,
      border: '1px solid var(--border-color, #e5e7eb)',
    }}>
      {/* Rank */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: rank <= 3 ? 'var(--brand-orange, #FF9F1C)' : '#e5e7eb',
        color: rank <= 3 ? 'white' : '#6b7280',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}>
        {rank}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <strong style={{ fontSize: 14 }}>{plant.name}</strong>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 10,
            background: plant.source === 'osm' ? '#dbeafe' : '#fef3c7',
            color: plant.source === 'osm' ? '#1e40af' : '#92400e',
            fontWeight: 600,
          }}>
            {plant.source === 'osm' ? 'OSM' : 'BetonServer'}
          </span>
        </div>
        {plant.company && plant.company !== plant.name && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
            {plant.company}
          </div>
        )}
        {plant.address && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {plant.address}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
          {plant.contact.phone && (
            <a href={`tel:${plant.contact.phone}`} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              color: '#2563eb', textDecoration: 'none',
            }}>
              <Phone size={12} /> {plant.contact.phone}
            </a>
          )}
          {plant.contact.website && (
            <a href={plant.contact.website} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              color: '#2563eb', textDecoration: 'none',
            }}>
              <Globe size={12} /> Web
            </a>
          )}
        </div>
      </div>

      {/* Distance */}
      <div style={{
        textAlign: 'right', flexShrink: 0,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700,
          color: (plant.distance_km ?? 999) <= 20 ? '#059669' : (plant.distance_km ?? 999) <= 40 ? '#d97706' : '#dc2626',
        }}>
          {plant.distance_km != null ? `${plant.distance_km} km` : '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          GPS: {plant.location.lat.toFixed(3)}, {plant.location.lon.toFixed(3)}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border-color, #ccc)',
  borderRadius: 6,
  fontSize: 14,
};
