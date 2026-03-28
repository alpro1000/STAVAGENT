/**
 * Credit History Component
 * Shows user's transaction history (top-ups and deductions)
 */

import { useState, useEffect } from 'react';
import { creditsAPI } from '../../services/api';

interface Transaction {
  id: string;
  amount: number;
  balance_after: number;
  operation_key: string | null;
  description: string;
  created_at: string;
}

export default function CreditHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const load = async (newOffset: number) => {
    setLoading(true);
    try {
      const res = await creditsAPI.getHistory(limit, newOffset);
      setTransactions(res.transactions || []);
      setTotal(res.total || 0);
      setOffset(newOffset);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(0); }, []);

  if (loading && transactions.length === 0) {
    return <div style={{ padding: 12, color: '#9ca3af', fontSize: 13 }}>Načítám historii...</div>;
  }

  if (transactions.length === 0) {
    return (
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16,
        color: '#9ca3af', fontSize: 13, textAlign: 'center',
      }}>
        Žádné transakce
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Historie kreditů
        <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>
          ({total} celkem)
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {transactions.map(tx => (
          <div key={tx.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
            borderBottom: '1px solid #f9fafb', fontSize: 12,
          }}>
            {/* Amount badge */}
            <span style={{
              minWidth: 60, textAlign: 'right', fontWeight: 600, fontFamily: 'monospace',
              color: tx.amount > 0 ? '#16a34a' : '#dc2626',
            }}>
              {tx.amount > 0 ? '+' : ''}{tx.amount}
            </span>

            {/* Description */}
            <span style={{ flex: 1, color: '#374151' }}>
              {tx.description || tx.operation_key || '—'}
            </span>

            {/* Balance after */}
            <span style={{ color: '#9ca3af', fontSize: 11, minWidth: 50, textAlign: 'right' }}>
              → {tx.balance_after}
            </span>

            {/* Date */}
            <span style={{ color: '#9ca3af', fontSize: 11, minWidth: 100, textAlign: 'right' }}>
              {new Date(tx.created_at).toLocaleString('cs-CZ', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => load(Math.max(0, offset - limit))}
            disabled={offset === 0}
            style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 4,
              border: '1px solid #e2e8f0', background: offset === 0 ? '#f9fafb' : '#fff',
              color: offset === 0 ? '#d1d5db' : '#374151', cursor: offset === 0 ? 'default' : 'pointer',
            }}
          >
            Předchozí
          </button>
          <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>
            {offset + 1}–{Math.min(offset + limit, total)} z {total}
          </span>
          <button
            onClick={() => load(offset + limit)}
            disabled={offset + limit >= total}
            style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 4,
              border: '1px solid #e2e8f0',
              background: offset + limit >= total ? '#f9fafb' : '#fff',
              color: offset + limit >= total ? '#d1d5db' : '#374151',
              cursor: offset + limit >= total ? 'default' : 'pointer',
            }}
          >
            Další
          </button>
        </div>
      )}
    </div>
  );
}
