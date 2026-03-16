import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import type { KioskToggles } from '../../types/connection';
import { KIOSK_LABELS } from '../../types/connection';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface Props {
  orgId?: string | null;
  canEdit: boolean;
}

export default function KioskTogglePanel({ orgId, canEdit }: Props) {
  const { token } = useAuth();
  const [toggles, setToggles] = useState<KioskToggles>({});
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadToggles();
  }, [orgId]);

  const loadToggles = async () => {
    setLoading(true);
    try {
      const params = orgId ? `?org_id=${orgId}` : '';
      const resp = await axios.get(`${API_URL}/api/connections/kiosk-toggles${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setToggles(resp.data.toggles);
      setPlan(resp.data.plan || 'free');
    } catch {
      setToggles({});
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (kiosk: string) => {
    if (!canEdit || !orgId) return;
    const newVal = !toggles[kiosk];
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/api/connections/kiosk-toggles`, {
        org_id: orgId,
        toggles: { [kiosk]: newVal },
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setToggles(prev => ({ ...prev, [kiosk]: newVal }));
    } catch {
      // revert on error
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Nacitam kiosky...</div>;

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '16px 20px',
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
        Kiosky
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(toggles).map(([kiosk, enabled]) => {
          const isPlanLimited = plan === 'free' && !['monolit', 'registry'].includes(kiosk);
          return (
            <div key={kiosk} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', borderRadius: 6,
              background: enabled ? '#f0fdf4' : '#f9fafb',
              opacity: isPlanLimited ? 0.5 : 1,
            }}>
              <label style={{
                position: 'relative', display: 'inline-block',
                width: 36, height: 20, flexShrink: 0,
              }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handleToggle(kiosk)}
                  disabled={!canEdit || isPlanLimited || saving}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: canEdit && !isPlanLimited ? 'pointer' : 'not-allowed',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: enabled ? '#10b981' : '#d1d5db',
                  borderRadius: 10, transition: 'background 0.2s',
                }} />
                <span style={{
                  position: 'absolute', height: 16, width: 16,
                  left: enabled ? 18 : 2, top: 2,
                  background: '#fff', borderRadius: '50%',
                  transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }} />
              </label>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
                {KIOSK_LABELS[kiosk] || kiosk}
              </span>
              {isPlanLimited && (
                <span style={{
                  fontSize: 11, color: '#f59e0b', fontWeight: 600, marginLeft: 'auto',
                }}>
                  Vyzaduje plan Starter+
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
