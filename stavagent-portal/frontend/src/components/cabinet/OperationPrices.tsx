/**
 * Operation Prices Component
 * Shows the pricing catalog — what each operation costs in credits
 */

import { useState, useEffect } from 'react';
import { creditsAPI } from '../../services/api';

interface OperationPrice {
  operation_key: string;
  display_name: string;
  description: string;
  credits_cost: number;
  is_ai: boolean;
}

export default function OperationPrices() {
  const [prices, setPrices] = useState<OperationPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await creditsAPI.getPrices();
        setPrices(res.prices || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ padding: 12, color: '#9ca3af', fontSize: 13 }}>Načítám ceník...</div>;
  if (prices.length === 0) return null;

  const aiOps = prices.filter(p => p.is_ai);
  const basicOps = prices.filter(p => !p.is_ai);

  const renderGroup = (title: string, ops: OperationPrice[], color: string) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color, marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {title}
      </div>
      {ops.map(op => (
        <div key={op.operation_key} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 0', borderBottom: '1px solid #f9fafb', fontSize: 12,
        }}>
          <div>
            <span style={{ color: '#374151' }}>{op.display_name}</span>
            {op.description && (
              <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: 11 }}>
                — {op.description}
              </span>
            )}
          </div>
          <span style={{
            fontWeight: 600, fontFamily: 'monospace', color,
            minWidth: 40, textAlign: 'right',
          }}>
            {op.credits_cost}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Ceník operací
        <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>
          (v kreditech)
        </span>
      </div>

      {aiOps.length > 0 && renderGroup('AI operace', aiOps, '#8b5cf6')}
      {basicOps.length > 0 && renderGroup('Základní operace', basicOps, '#6b7280')}
    </div>
  );
}
