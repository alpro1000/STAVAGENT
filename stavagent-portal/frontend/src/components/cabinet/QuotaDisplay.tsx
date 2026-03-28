/**
 * Quota Display Component
 * Shows user's credit balance, session-only status, and usage info
 */

import { useState, useEffect } from 'react';
import { usageAPI } from '../../services/api';

export default function QuotaDisplay() {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await usageAPI.getMyUsage();
        setUsage(res.data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ padding: 12, color: '#9ca3af', fontSize: 13 }}>Načítám...</div>;
  if (!usage) return null;

  const balance = usage.credit_balance || 0;
  const sessionOnly = usage.session_only;

  const fmtBytes = (b: number) => {
    if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  const storagePercent = usage.storage_limit_bytes
    ? Math.min(100, (usage.storage_used_bytes / usage.storage_limit_bytes) * 100)
    : null;

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16,
    }}>
      {/* Credit Balance — main metric */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f3f4f6',
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Váš zůstatek</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: balance > 0 ? '#1a1a1a' : '#e53e3e' }}>
            {balance.toLocaleString('cs-CZ')}
            <span style={{ fontSize: 14, fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>kreditů</span>
          </div>
        </div>
        {usage.is_admin && (
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 11,
            background: '#e53e3e', color: '#fff',
          }}>Admin</span>
        )}
      </div>

      {/* Session-only warning */}
      {sessionOnly && !usage.is_admin && (
        <div style={{
          background: '#FFF7ED', border: '1px solid #FB923C', borderRadius: 6,
          padding: '8px 12px', marginBottom: 12, fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, color: '#C2410C', marginBottom: 2 }}>
            Režim bez uložení
          </div>
          <div style={{ color: '#9A3412' }}>
            Výsledky jsou dostupné pouze v této relaci prohlížeče.
            Dobijte kredity pro trvalé uložení a další AI funkce.
          </div>
        </div>
      )}

      {/* Balance visual bar */}
      {!usage.is_admin && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${Math.min(100, (balance / 100) * 100)}%`,
              background: balance <= 5 ? '#e53e3e' : balance <= 20 ? '#f59e0b' : '#48bb78',
              transition: 'width 0.3s',
            }} />
          </div>
          {balance <= 5 && balance > 0 && (
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
              Nízký zůstatek kreditů.
            </div>
          )}
          {balance === 0 && (
            <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 4 }}>
              Žádné kredity. Dobijte si účet.
            </div>
          )}
        </div>
      )}

      {/* Storage */}
      {storagePercent !== null && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#6b7280' }}>Úložiště</span>
            <span style={{ fontWeight: 600 }}>
              {fmtBytes(usage.storage_used_bytes)} / {fmtBytes(usage.storage_limit_bytes)}
            </span>
          </div>
          <div style={{
            height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${storagePercent}%`,
              background: storagePercent >= 90 ? '#e53e3e' : storagePercent >= 60 ? '#f59e0b' : '#48bb78',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Monthly usage */}
      {usage.monthly && (
        <div style={{ fontSize: 12, color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
          Tento měsíc: {usage.monthly.events} operací, {(usage.monthly.tokens || 0).toLocaleString()} tokenů
        </div>
      )}

      {/* Recent events */}
      {usage.recent_events?.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Poslední aktivita</div>
          {usage.recent_events.slice(0, 5).map((e: any, i: number) => (
            <div key={i} style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 8, padding: '2px 0' }}>
              <span style={{ minWidth: 100 }}>{e.service}</span>
              <span>{e.event_type}</span>
              {e.tokens_total > 0 && <span>{e.tokens_total} tok</span>}
              <span style={{ marginLeft: 'auto' }}>{new Date(e.created_at).toLocaleString('cs-CZ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
