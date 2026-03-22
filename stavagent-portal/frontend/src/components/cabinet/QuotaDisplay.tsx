/**
 * Quota Display Component
 * Shows user's current plan, usage limits, and pipeline runs remaining
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

  if (loading) return <div style={{ padding: 12, color: '#9ca3af', fontSize: 13 }}>Nacitam...</div>;
  if (!usage) return null;

  const planLabels: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
  };

  const planColors: Record<string, string> = {
    free: '#6b7280',
    starter: '#3b82f6',
    professional: '#8b5cf6',
    enterprise: '#f59e0b',
  };

  const fmtBytes = (b: number) => {
    if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  const pipelinePercent = usage.pipeline_runs_limit
    ? Math.min(100, (usage.pipeline_runs_used / usage.pipeline_runs_limit) * 100)
    : null;

  const storagePercent = usage.storage_limit_bytes
    ? Math.min(100, (usage.storage_used_bytes / usage.storage_limit_bytes) * 100)
    : null;

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Vas plan:</span>
        <span style={{
          padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
          background: planColors[usage.plan] || '#6b7280', color: '#fff',
        }}>{planLabels[usage.plan] || usage.plan}</span>
        {usage.is_admin && (
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 11,
            background: '#e53e3e', color: '#fff',
          }}>Admin</span>
        )}
      </div>

      {/* Pipeline runs */}
      {pipelinePercent !== null && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#6b7280' }}>Spusteni pipeline</span>
            <span style={{ fontWeight: 600 }}>
              {usage.pipeline_runs_used} / {usage.pipeline_runs_limit}
            </span>
          </div>
          <div style={{
            height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${pipelinePercent}%`,
              background: pipelinePercent >= 90 ? '#e53e3e' : pipelinePercent >= 60 ? '#f59e0b' : '#48bb78',
              transition: 'width 0.3s',
            }} />
          </div>
          {pipelinePercent >= 100 && (
            <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 4 }}>
              Limit vyčerpan. Upgradujte pro dalsi pouziti.
            </div>
          )}
        </div>
      )}

      {/* Storage */}
      {storagePercent !== null && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#6b7280' }}>Uloziste</span>
            <span style={{ fontWeight: 600 }}>
              {fmtBytes(usage.storage_used_bytes)} / {fmtBytes(usage.storage_limit_bytes)}
            </span>
          </div>
          <div style={{
            height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
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
          Tento mesic: {usage.monthly.events} udalosti, {usage.monthly.tokens.toLocaleString()} tokenu
        </div>
      )}

      {/* Recent events */}
      {usage.recent_events?.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Posledni aktivita</div>
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
