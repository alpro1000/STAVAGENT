/**
 * Credit Management Component (Admin Panel)
 * - Credit stats overview
 * - Operation pricing editor
 * - User credit top-up
 */

import { useState, useEffect } from 'react';
import { creditsAPI } from '../../services/api';

interface OperationPrice {
  operation_key: string;
  display_name: string;
  description: string;
  credits_cost: number;
  is_ai: boolean;
  is_active: boolean;
  sort_order: number;
}

interface CreditStats {
  total_balance_in_system: number;
  users_with_credits: number;
  last_30_days: {
    topups: { total: number; count: number };
    deductions: { total: number; count: number };
  };
  top_operations: Array<{ operation_key: string; count: number; total_credits: number }>;
}

export default function CreditManagement() {
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [prices, setPrices] = useState<OperationPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editCost, setEditCost] = useState(0);

  // Top-up form
  const [topupUserId, setTopupUserId] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupDesc, setTopupDesc] = useState('');
  const [topupResult, setTopupResult] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, pricesRes] = await Promise.all([
        creditsAPI.getAdminStats(),
        creditsAPI.getAdminPrices(),
      ]);
      setStats(statsRes.stats || null);
      setPrices(pricesRes.prices || []);
    } catch (e) {
      console.error('Credit management load error:', e);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleSavePrice = async (key: string) => {
    try {
      await creditsAPI.updatePrice(key, { credits_cost: editCost });
      setEditingKey(null);
      loadData();
    } catch (e) {
      console.error('Error updating price:', e);
    }
  };

  const handleToggleActive = async (key: string, currentActive: boolean) => {
    try {
      await creditsAPI.updatePrice(key, { is_active: !currentActive });
      loadData();
    } catch (e) {
      console.error('Error toggling price:', e);
    }
  };

  const handleTopup = async () => {
    const userId = parseInt(topupUserId);
    const amount = parseInt(topupAmount);
    if (!userId || !amount || amount <= 0) {
      setTopupResult('Zadejte platné ID uživatele a kladnou částku');
      return;
    }
    try {
      const res = await creditsAPI.topupUser(userId, amount, topupDesc || undefined);
      setTopupResult(`Dobito: +${amount} kreditů. Nový zůstatek: ${res.balance}`);
      setTopupUserId('');
      setTopupAmount('');
      setTopupDesc('');
      loadData();
    } catch (e: any) {
      setTopupResult(`Chyba: ${e.response?.data?.error || e.message}`);
    }
  };

  if (loading) return <div style={{ padding: 16, color: '#9ca3af' }}>Načítám...</div>;

  const toggleStyle = (enabled: boolean): React.CSSProperties => ({
    width: 36, height: 20, borderRadius: 10,
    background: enabled ? '#48bb78' : '#cbd5e0',
    position: 'relative', cursor: 'pointer', border: 'none',
    transition: 'background 0.2s', display: 'inline-block',
  });

  const toggleDotStyle = (enabled: boolean): React.CSSProperties => ({
    width: 16, height: 16, borderRadius: '50%', background: '#fff',
    position: 'absolute', top: 2,
    left: enabled ? 18 : 2,
    transition: 'left 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  });

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db',
    fontSize: 13, outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats overview */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Kredity v systému" value={stats.total_balance_in_system.toLocaleString('cs-CZ')} />
          <StatCard label="Uživatelů s kredity" value={String(stats.users_with_credits)} />
          <StatCard
            label="Dobití (30 dní)"
            value={`+${stats.last_30_days.topups.total.toLocaleString('cs-CZ')}`}
            sub={`${stats.last_30_days.topups.count} transakcí`}
            color="#16a34a"
          />
          <StatCard
            label="Spotřeba (30 dní)"
            value={`-${stats.last_30_days.deductions.total.toLocaleString('cs-CZ')}`}
            sub={`${stats.last_30_days.deductions.count} operací`}
            color="#dc2626"
          />
        </div>
      )}

      {/* Top operations */}
      {stats?.top_operations && stats.top_operations.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Top operace (30 dní)</div>
          {stats.top_operations.map(op => (
            <div key={op.operation_key} style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0',
            }}>
              <span style={{ color: '#374151' }}>{op.operation_key}</span>
              <span style={{ color: '#6b7280' }}>
                {op.count}x = {op.total_credits.toLocaleString('cs-CZ')} kreditů
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Operation pricing editor */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Ceník operací</div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280' }}>Operace</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280' }}>Klíč</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#6b7280' }}>AI</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280' }}>Cena (kredity)</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#6b7280' }}>Aktivní</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#6b7280' }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {prices.map(op => (
              <tr key={op.operation_key} style={{
                borderBottom: '1px solid #f3f4f6',
                opacity: op.is_active ? 1 : 0.5,
              }}>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ fontWeight: 500 }}>{op.display_name}</div>
                  {op.description && (
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>{op.description}</div>
                  )}
                </td>
                <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#6b7280' }}>
                  {op.operation_key}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  {op.is_ai && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 4, fontSize: 10,
                      background: '#EDE9FE', color: '#7C3AED',
                    }}>AI</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  {editingKey === op.operation_key ? (
                    <input
                      type="number"
                      value={editCost}
                      onChange={e => setEditCost(parseInt(e.target.value) || 0)}
                      style={{ ...inputStyle, width: 60, textAlign: 'right' }}
                      min={0}
                    />
                  ) : (
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {op.credits_cost}
                    </span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleToggleActive(op.operation_key, op.is_active)}
                    style={toggleStyle(op.is_active)}
                  >
                    <span style={toggleDotStyle(op.is_active)} />
                  </button>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  {editingKey === op.operation_key ? (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        onClick={() => handleSavePrice(op.operation_key)}
                        style={{
                          padding: '3px 8px', borderRadius: 4, border: 'none',
                          background: '#48bb78', color: '#fff', fontSize: 11, cursor: 'pointer',
                        }}
                      >Uložit</button>
                      <button
                        onClick={() => setEditingKey(null)}
                        style={{
                          padding: '3px 8px', borderRadius: 4, border: '1px solid #d1d5db',
                          background: '#fff', fontSize: 11, cursor: 'pointer',
                        }}
                      >Zrušit</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingKey(op.operation_key); setEditCost(op.credits_cost); }}
                      style={{
                        padding: '3px 8px', borderRadius: 4, border: '1px solid #d1d5db',
                        background: '#fff', fontSize: 11, cursor: 'pointer', color: '#374151',
                      }}
                    >Upravit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top-up user form */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Dobít kredity uživateli</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>User ID</label>
            <input
              type="number"
              value={topupUserId}
              onChange={e => setTopupUserId(e.target.value)}
              placeholder="1"
              style={{ ...inputStyle, width: 80 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Kredity</label>
            <input
              type="number"
              value={topupAmount}
              onChange={e => setTopupAmount(e.target.value)}
              placeholder="100"
              style={{ ...inputStyle, width: 80 }}
              min={1}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Popis (volitelné)</label>
            <input
              type="text"
              value={topupDesc}
              onChange={e => setTopupDesc(e.target.value)}
              placeholder="Bonusové kredity"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <button
            onClick={handleTopup}
            style={{
              padding: '6px 16px', borderRadius: 4, border: 'none',
              background: '#FF9F1C', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Dobít
          </button>
        </div>
        {topupResult && (
          <div style={{
            marginTop: 8, fontSize: 12, padding: '6px 10px', borderRadius: 4,
            background: topupResult.startsWith('Chyba') ? '#FEE2E2' : '#ECFDF5',
            color: topupResult.startsWith('Chyba') ? '#DC2626' : '#16A34A',
          }}>
            {topupResult}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12,
    }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#1a1a1a' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
