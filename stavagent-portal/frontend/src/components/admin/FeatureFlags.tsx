/**
 * Feature Flags Management — Admin Dashboard Tab
 * Toggle services, modules, and actions per plan/org/user
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

interface FeatureFlag {
  id: string;
  flag_key: string;
  display_name: string;
  description: string;
  category: string;
  default_enabled: boolean;
  overrides: Array<{
    flag_key: string;
    scope_type: string;
    scope_value: string;
    enabled: boolean;
  }>;
}

export default function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overrideModal, setOverrideModal] = useState<{ flagKey: string } | null>(null);
  const [overrideForm, setOverrideForm] = useState({ scope_type: 'plan', scope_value: 'free', enabled: false });

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getFeatureFlags();
      setFlags(res.data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Chyba');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleDefault = async (flagKey: string, currentEnabled: boolean) => {
    try {
      await adminAPI.updateFlagDefault(flagKey, !currentEnabled);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addOverride = async () => {
    if (!overrideModal) return;
    try {
      await adminAPI.setFlagOverride(
        overrideModal.flagKey,
        overrideForm.scope_type,
        overrideForm.scope_value,
        overrideForm.enabled,
      );
      setOverrideModal(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeOverride = async (flagKey: string, scopeType: string, scopeValue: string) => {
    try {
      await adminAPI.removeFlagOverride(flagKey, scopeType, scopeValue);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div style={{ padding: 20, color: '#6b7280' }}>Nacitam...</div>;
  if (error) return <div style={{ padding: 20, color: '#e53e3e' }}>{error}</div>;

  const categories = ['service', 'module', 'action'];
  const categoryLabels: Record<string, string> = {
    service: 'Sluzby',
    module: 'Moduly',
    action: 'Akce',
  };

  const toggleStyle = (enabled: boolean): React.CSSProperties => ({
    width: 44, height: 24, borderRadius: 12,
    background: enabled ? '#48bb78' : '#cbd5e0',
    position: 'relative', cursor: 'pointer', border: 'none',
    transition: 'background 0.2s',
  });

  const toggleDotStyle = (enabled: boolean): React.CSSProperties => ({
    width: 18, height: 18, borderRadius: '50%', background: '#fff',
    position: 'absolute', top: 3,
    left: enabled ? 23 : 3,
    transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Sprava funkci</h3>
        <button onClick={load} style={{
          padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 6,
          background: '#fff', cursor: 'pointer', fontSize: 13,
        }}>Obnovit</button>
      </div>

      {categories.map(cat => {
        const catFlags = flags.filter(f => f.category === cat);
        if (catFlags.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              {categoryLabels[cat] || cat}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {catFlags.map(flag => (
                <div key={flag.flag_key} style={{
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {/* Toggle */}
                  <button
                    style={toggleStyle(flag.default_enabled)}
                    onClick={() => toggleDefault(flag.flag_key, flag.default_enabled)}
                    title={flag.default_enabled ? 'Kliknete pro deaktivaci' : 'Kliknete pro aktivaci'}
                  >
                    <div style={toggleDotStyle(flag.default_enabled)} />
                  </button>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{flag.display_name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{flag.description}</div>
                    <div style={{ fontSize: 11, color: '#c4b5fd', fontFamily: 'monospace' }}>{flag.flag_key}</div>
                  </div>

                  {/* Overrides */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 300 }}>
                    {flag.overrides.map((o, i) => (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: o.enabled ? '#c6f6d5' : '#fed7d7',
                        color: o.enabled ? '#22543d' : '#742a2a',
                      }}>
                        {o.scope_type}={o.scope_value}: {o.enabled ? 'ON' : 'OFF'}
                        <button
                          onClick={() => removeOverride(flag.flag_key, o.scope_type, o.scope_value)}
                          style={{
                            border: 'none', background: 'none', cursor: 'pointer',
                            fontSize: 14, lineHeight: 1, color: 'inherit', padding: 0,
                          }}
                        >x</button>
                      </span>
                    ))}
                  </div>

                  {/* Add override button */}
                  <button
                    onClick={() => {
                      setOverrideModal({ flagKey: flag.flag_key });
                      setOverrideForm({ scope_type: 'plan', scope_value: 'free', enabled: false });
                    }}
                    style={{
                      padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4,
                      background: '#f7fafc', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap',
                    }}
                  >+ Override</button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Override Modal */}
      {overrideModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, minWidth: 360,
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>
              Override pro: <code>{overrideModal.flagKey}</code>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13 }}>
                Rozsah:
                <select
                  value={overrideForm.scope_type}
                  onChange={e => setOverrideForm(f => ({ ...f, scope_type: e.target.value }))}
                  style={{ marginLeft: 8, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4 }}
                >
                  <option value="plan">Plan</option>
                  <option value="org">Organizace (UUID)</option>
                  <option value="user">Uzivatel (ID)</option>
                </select>
              </label>

              <label style={{ fontSize: 13 }}>
                Hodnota:
                {overrideForm.scope_type === 'plan' ? (
                  <select
                    value={overrideForm.scope_value}
                    onChange={e => setOverrideForm(f => ({ ...f, scope_value: e.target.value }))}
                    style={{ marginLeft: 8, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4 }}
                  >
                    <option value="free">free</option>
                    <option value="starter">starter</option>
                    <option value="professional">professional</option>
                    <option value="enterprise">enterprise</option>
                  </select>
                ) : (
                  <input
                    value={overrideForm.scope_value}
                    onChange={e => setOverrideForm(f => ({ ...f, scope_value: e.target.value }))}
                    placeholder={overrideForm.scope_type === 'user' ? 'User ID' : 'Org UUID'}
                    style={{ marginLeft: 8, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, width: 180 }}
                  />
                )}
              </label>

              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                Stav:
                <button
                  style={toggleStyle(overrideForm.enabled)}
                  onClick={() => setOverrideForm(f => ({ ...f, enabled: !f.enabled }))}
                >
                  <div style={toggleDotStyle(overrideForm.enabled)} />
                </button>
                <span>{overrideForm.enabled ? 'Zapnuto' : 'Vypnuto'}</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOverrideModal(null)}
                style={{
                  padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', cursor: 'pointer',
                }}
              >Zrusit</button>
              <button
                onClick={addOverride}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 6,
                  background: '#FF9F1C', color: '#fff', cursor: 'pointer', fontWeight: 600,
                }}
              >Ulozit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
