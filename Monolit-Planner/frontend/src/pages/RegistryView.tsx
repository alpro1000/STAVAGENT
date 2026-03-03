import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getProjectPositions, PositionInstance } from '../api/registryApi';
import UnifiedPositionModal from '../components/UnifiedPositionModal';

export default function RegistryView() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [positions, setPositions] = useState<PositionInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ kiosk: '', search: '' });
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<{ field: keyof PositionInstance; order: 'asc' | 'desc' }>({ field: 'catalog_code', order: 'asc' });

  useEffect(() => {
    if (projectId) {
      getProjectPositions(projectId)
        .then(setPositions)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [projectId]);

  // Handle deep link from URL parameter
  useEffect(() => {
    const positionId = searchParams.get('position_instance_id');
    if (positionId && positions.length > 0) {
      setSelectedPositionId(positionId);
      searchParams.delete('position_instance_id');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, positions]);

  const filtered = positions.filter(p => {
    if (filter.kiosk && p.kiosk_type !== filter.kiosk) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      return p.description.toLowerCase().includes(s) || p.catalog_code.toLowerCase().includes(s);
    }
    return true;
  }).sort((a, b) => {
    const aVal = a[sortBy.field];
    const bVal = b[sortBy.field];
    const order = sortBy.order === 'asc' ? 1 : -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * order;
    }
    return String(aVal).localeCompare(String(bVal), 'cs') * order;
  });

  const toggleSort = (field: keyof PositionInstance) => {
    setSortBy(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (loading) return (
    <div className="c-panel" style={{ margin: '24px', padding: '48px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
      <p>Načítání pozic...</p>
    </div>
  );

  return (
    <div className="c-panel" style={{ margin: '24px', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Link to="/" className="c-btn c-btn--sm" style={{ textDecoration: 'none' }}>← Zpět</Link>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Registry pozic</h1>
        <span className="c-badge c-badge--orange">{filtered.length}</span>
      </div>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Hledat podle popisu nebo kódu..."
          value={filter.search}
          onChange={e => setFilter({ ...filter, search: e.target.value })}
          className="c-input"
          style={{ flex: '1 1 300px', minWidth: '200px' }}
        />
        <select 
          value={filter.kiosk} 
          onChange={e => setFilter({ ...filter, kiosk: e.target.value })}
          className="c-select"
          style={{ minWidth: '150px' }}
        >
          <option value="">📊 Všechny kiosky</option>
          <option value="monolit">🪨 Monolit</option>
          <option value="registry_tov">📋 Registry TOV</option>
        </select>
        <button
          className="c-btn c-btn--sm"
          onClick={() => {
            const csv = [
              ['Kód', 'Popis', 'Množství', 'MJ', 'Kiosk', 'Kategorie'].join(','),
              ...filtered.map(p => [
                p.catalog_code,
                `"${p.description.replace(/"/g, '""')}"`,
                p.qty,
                p.unit,
                p.kiosk_type,
                p.work_category
              ].join(','))
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `registry_${projectId}_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
          }}
          disabled={filtered.length === 0}
          title="Exportovat do CSV"
        >
          💾 Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="c-panel c-panel--inset" style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <h3 style={{ marginBottom: '8px' }}>Žádné pozice</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            {positions.length === 0 ? 'Projekt neobsahuje žádné pozice.' : 'Zkuste změnit filtry.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="c-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th onClick={() => toggleSort('catalog_code')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Kód {sortBy.field === 'catalog_code' && (sortBy.order === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => toggleSort('description')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Popis {sortBy.field === 'description' && (sortBy.order === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => toggleSort('qty')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                  Množství {sortBy.field === 'qty' && (sortBy.order === 'asc' ? '↑' : '↓')}
                </th>
                <th>MJ</th>
                <th onClick={() => toggleSort('kiosk_type')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Kiosk {sortBy.field === 'kiosk_type' && (sortBy.order === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr 
                  key={p.position_instance_id} 
                  onClick={() => setSelectedPositionId(p.position_instance_id)} 
                  style={{ cursor: 'pointer' }}
                  className="c-table-row--hover"
                >
                  <td><code>{p.catalog_code}</code></td>
                  <td>{p.description}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.qty}</td>
                  <td>{p.unit}</td>
                  <td>
                    <span className="c-badge" style={{
                      background: p.kiosk_type === 'monolit' ? '#e3f2fd' : '#fff3e0',
                      color: p.kiosk_type === 'monolit' ? '#1976d2' : '#f57c00'
                    }}>
                      {p.kiosk_type === 'monolit' ? '🪨' : '📋'} {p.kiosk_type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPositionId && (
        <UnifiedPositionModal
          positionId={selectedPositionId}
          onClose={() => setSelectedPositionId(null)}
        />
      )}
    </div>
  );
}
