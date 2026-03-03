import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getProjectPositions, PositionInstance } from '../api/registryApi';

export default function RegistryView() {
  const { projectId } = useParams<{ projectId: string }>();
  const [positions, setPositions] = useState<PositionInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ kiosk: '', search: '' });

  useEffect(() => {
    if (projectId) {
      getProjectPositions(projectId)
        .then(setPositions)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [projectId]);

  const filtered = positions.filter(p => {
    if (filter.kiosk && p.kiosk_type !== filter.kiosk) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      return p.description.toLowerCase().includes(s) || p.catalog_code.toLowerCase().includes(s);
    }
    return true;
  });

  if (loading) return <div>Načítání...</div>;

  return (
    <div style={{ padding: '24px' }}>
      <h1>Registry pozic</h1>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Hledat..."
          value={filter.search}
          onChange={e => setFilter({ ...filter, search: e.target.value })}
          style={{ flex: 1, padding: '8px' }}
        />
        <select value={filter.kiosk} onChange={e => setFilter({ ...filter, kiosk: e.target.value })}>
          <option value="">Všechny kiosky</option>
          <option value="monolit">Monolit</option>
          <option value="registry_tov">Registry TOV</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Kód</th>
            <th>Popis</th>
            <th>Množství</th>
            <th>MJ</th>
            <th>Kiosk</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr key={p.position_instance_id}>
              <td>{p.catalog_code}</td>
              <td>{p.description}</td>
              <td>{p.qty}</td>
              <td>{p.unit}</td>
              <td>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: p.kiosk_type === 'monolit' ? '#e3f2fd' : '#fff3e0'
                }}>
                  {p.kiosk_type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
