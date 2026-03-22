/**
 * Anti-fraud Panel — Admin Dashboard Tab
 * Shows registration IP stats and suspicious activity
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function AntifraudPanel() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(7);

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getRegistrationIPs(days);
      setStats(res.data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Chyba');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [days]);

  if (loading) return <div style={{ padding: 20, color: '#6b7280' }}>Nacitam...</div>;
  if (error) return <div style={{ padding: 20, color: '#e53e3e' }}>{error}</div>;
  if (!stats) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#6b7280' }}>Obdobi:</span>
        {[1, 7, 30].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 6,
              background: days === d ? '#FF9F1C' : '#fff',
              color: days === d ? '#fff' : '#4a5568',
              cursor: 'pointer', fontSize: 13,
            }}
          >{d === 1 ? '24h' : `${d} dni`}</button>
        ))}
      </div>

      {/* Summary */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
        padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_registrations}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Registraci za obdobi</div>
      </div>

      {/* Suspicious IPs */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
        padding: 20,
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>
          Podezrele IP adresy (2+ registrace)
        </h3>
        {stats.suspicious_ips.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>Zadne podezrele IP adresy</div>
        ) : (
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280' }}>IP adresa</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>Registrace</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>Posledni</th>
              </tr>
            </thead>
            <tbody>
              {stats.suspicious_ips.map((ip: any) => (
                <tr key={ip.ip_address} style={{
                  borderBottom: '1px solid #f3f4f6',
                  background: ip.count >= 3 ? '#fff5f5' : 'transparent',
                }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 500 }}>
                    {ip.ip_address}
                    {ip.count >= 3 && (
                      <span style={{
                        marginLeft: 8, fontSize: 10, padding: '1px 6px',
                        background: '#fc8181', color: '#fff', borderRadius: 4,
                      }}>PODEZRELE</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{ip.count}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#6b7280' }}>
                    {new Date(ip.last_at).toLocaleString('cs-CZ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
