/**
 * Usage Statistics — Admin Dashboard Tab
 * Shows token usage per model, service breakdown, top users, daily trends
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

interface UsageStatsProps {
  onRefresh?: () => void;
}

export default function UsageStats({ onRefresh }: UsageStatsProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getUsageStats(days);
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

  const { totals, by_service, by_model, by_event_type, top_users, daily } = stats;

  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: 16, minWidth: 160,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4 };
  const valueStyle: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: '#1a202c' };

  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#6b7280' }}>Obdobi:</span>
        {[7, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 6,
              background: days === d ? '#FF9F1C' : '#fff',
              color: days === d ? '#fff' : '#4a5568',
              cursor: 'pointer', fontSize: 13, fontWeight: days === d ? 600 : 400,
            }}
          >{d} dni</button>
        ))}
        <button onClick={load} style={{
          marginLeft: 'auto', padding: '6px 12px', border: '1px solid #e2e8f0',
          borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13,
        }}>Obnovit</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Celkem udalosti</div>
          <div style={valueStyle}>{fmt(totals.total_events)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Celkem tokenu</div>
          <div style={valueStyle}>{fmt(totals.total_tokens)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Input tokeny</div>
          <div style={valueStyle}>{fmt(totals.total_input_tokens)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Output tokeny</div>
          <div style={valueStyle}>{fmt(totals.total_output_tokens)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Naklady (USD)</div>
          <div style={valueStyle}>${totals.total_cost_usd.toFixed(2)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Unikatni uzivatele</div>
          <div style={valueStyle}>{totals.unique_users}</div>
        </div>
      </div>

      {/* By Model */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ ...cardStyle, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Pouziti podle modelu</h3>
          {by_model.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Zatim zadna data</div>
          ) : (
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280' }}>Model</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>Volani</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>Tokeny</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>USD</th>
                </tr>
              </thead>
              <tbody>
                {by_model.map((m: any) => (
                  <tr key={m.model_name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{m.model_name}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{m.count}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(m.tokens_total)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>${m.cost_usd.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* By Service */}
        <div style={{ ...cardStyle, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Pouziti podle sluzby</h3>
          {by_service.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Zatim zadna data</div>
          ) : (
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280' }}>Sluzba</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>Volani</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>Tokeny</th>
                </tr>
              </thead>
              <tbody>
                {by_service.map((s: any) => (
                  <tr key={s.service} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{s.service}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.count}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(s.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Top Users */}
      <div style={{ ...cardStyle, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Top uzivatele</h3>
        {top_users.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>Zatim zadna data</div>
        ) : (
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280' }}>Uzivatel</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280' }}>Email</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>Udalosti</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>Tokeny</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6b7280' }}>USD</th>
              </tr>
            </thead>
            <tbody>
              {top_users.map((u: any) => (
                <tr key={u.user_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: '6px 8px', color: '#6b7280' }}>{u.email}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{u.total_events}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(u.total_tokens)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>${u.total_cost_usd.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Daily chart (simple bar) */}
      {daily.length > 0 && (
        <div style={{ ...cardStyle, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Denni prehled</h3>
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 120 }}>
            {daily.slice(0, 30).reverse().map((d: any) => {
              const maxEvents = Math.max(...daily.map((x: any) => x.events), 1);
              const h = Math.max((d.events / maxEvents) * 100, 4);
              return (
                <div
                  key={d.day}
                  title={`${d.day}: ${d.events} udalosti, ${d.users} uzivatelu`}
                  style={{
                    flex: 1, height: `${h}%`, background: '#FF9F1C',
                    borderRadius: '2px 2px 0 0', minWidth: 4,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            <span>{daily[daily.length - 1]?.day}</span>
            <span>{daily[0]?.day}</span>
          </div>
        </div>
      )}
    </div>
  );
}
