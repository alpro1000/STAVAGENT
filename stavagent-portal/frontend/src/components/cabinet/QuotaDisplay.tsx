/**
 * Quota Display Component
 * Shows credit balance, session-only status, and free-amount topup with volume discounts
 */

import { useState, useEffect, useCallback } from 'react';
import { usageAPI, creditsAPI } from '../../services/api';

interface DiscountTier {
  min_czk: number;
  discount_percent: number;
  label: string;
  example_credits: number;
}

export default function QuotaDisplay() {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Topup state
  const [showTopup, setShowTopup] = useState(false);
  const [tiers, setTiers] = useState<DiscountTier[]>([]);
  const [amountInput, setAmountInput] = useState('');
  const [preview, setPreview] = useState<{ credits: number; discount_percent: number; discount_label: string } | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await usageAPI.getMyUsage();
        setUsage(res.data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();

    // Check URL for topup success
    const params = new URLSearchParams(window.location.search);
    if (params.get('topup') === 'success') {
      setTopupSuccess(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadTiers = async () => {
    try {
      const res = await creditsAPI.getTiers();
      setTiers(res.tiers || []);
    } catch { /* ignore */ }
  };

  // Debounced preview calculation
  const updatePreview = useCallback(async (val: string) => {
    const amount = parseInt(val);
    if (!amount || amount < 125) {
      setPreview(null);
      return;
    }
    try {
      const res = await creditsAPI.calculate(amount);
      setPreview(res);
    } catch {
      setPreview(null);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => updatePreview(amountInput), 300);
    return () => clearTimeout(timer);
  }, [amountInput, updatePreview]);

  const handleCheckout = async () => {
    const amount = parseInt(amountInput);
    if (!amount || amount < 125) return;
    setCheckingOut(true);
    try {
      const res = await creditsAPI.checkout(amount);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      }
    } catch (e: any) {
      const msg = e.response?.data?.error || e.response?.data?.hint || 'Chyba při vytváření platby';
      alert(msg);
    } finally {
      setCheckingOut(false);
    }
  };

  const openTopup = () => {
    if (tiers.length === 0) loadTiers();
    setShowTopup(true);
  };

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

  const amountNum = parseInt(amountInput) || 0;

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16,
    }}>
      {/* Topup success banner */}
      {topupSuccess && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #34D399', borderRadius: 6,
          padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#065F46',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>Kredity byly úspěšně připsány na váš účet!</span>
          <button onClick={() => setTopupSuccess(false)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontSize: 14,
          }}>x</button>
        </div>
      )}

      {/* Credit Balance — main metric */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f3f4f6',
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Váš zůstatek</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: usage.is_admin ? '#1a1a1a' : balance > 0 ? '#1a1a1a' : '#e53e3e' }}>
            {usage.is_admin ? 'Neomezeno' : balance.toLocaleString('cs-CZ')}
            {!usage.is_admin && <span style={{ fontSize: 14, fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>kreditů</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {usage.is_admin && (
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11,
              background: '#e53e3e', color: '#fff',
            }}>Admin</span>
          )}
          {!usage.is_admin && (
            <button
              onClick={openTopup}
              style={{
                padding: '6px 16px', borderRadius: 6, border: 'none',
                background: '#FF9F1C', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'background 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#E8900A')}
              onMouseOut={e => (e.currentTarget.style.background = '#FF9F1C')}
            >
              Dobít kredity
            </button>
          )}
        </div>
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

      {/* Topup — free amount input with volume discount */}
      {showTopup && (
        <div style={{
          background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
          padding: 16, marginBottom: 12,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Dobít kredity</span>
            <button onClick={() => setShowTopup(false)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16,
            }}>x</button>
          </div>

          {/* Amount input + preview */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                Částka (Kč)
              </label>
              <input
                type="number"
                min={125}
                max={50000}
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="Zadejte částku v Kč"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 6,
                  border: '1px solid #D1D5DB', fontSize: 16, fontWeight: 600,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{
              minWidth: 140, textAlign: 'center', paddingTop: 20,
            }}>
              {preview ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>
                    {preview.credits.toLocaleString('cs-CZ')}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>kreditů</div>
                  {preview.discount_percent > 0 && (
                    <div style={{
                      marginTop: 4, padding: '2px 8px', borderRadius: 4,
                      background: '#ECFDF5', color: '#059669', fontSize: 11, fontWeight: 600,
                      display: 'inline-block',
                    }}>
                      +{preview.discount_percent}% bonus
                    </div>
                  )}
                </>
              ) : amountNum > 0 && amountNum < 125 ? (
                <div style={{ fontSize: 12, color: '#DC2626' }}>Min. 125 Kč (5 €)</div>
              ) : null}
            </div>
          </div>

          {/* Quick amount buttons */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[125, 250, 500, 1000, 2000, 5000].map(amt => (
              <button
                key={amt}
                onClick={() => setAmountInput(String(amt))}
                style={{
                  padding: '4px 12px', borderRadius: 4, fontSize: 12,
                  border: amountInput === String(amt) ? '2px solid #FF9F1C' : '1px solid #D1D5DB',
                  background: amountInput === String(amt) ? '#FFF7ED' : '#fff',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                {amt} Kč
              </button>
            ))}
          </div>

          {/* Discount tiers table */}
          {tiers.length > 0 && (
            <div style={{
              marginBottom: 12, fontSize: 11, color: '#6b7280',
              display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '2px 16px',
            }}>
              <span style={{ fontWeight: 600 }}>Částka</span>
              <span style={{ fontWeight: 600 }}>Bonus</span>
              <span style={{ fontWeight: 600 }}>Příklad</span>
              {tiers.slice().reverse().map(t => (
                <span key={t.min_czk} style={{
                  display: 'contents',
                  fontWeight: amountNum >= t.min_czk && (tiers.find(tt => tt.min_czk > t.min_czk && amountNum >= tt.min_czk) === undefined || amountNum < (tiers.find(tt => tt.min_czk > t.min_czk)?.min_czk ?? Infinity)) ? 600 : 400,
                  color: t.discount_percent > 0 && amountNum >= t.min_czk ? '#059669' : '#6b7280',
                }}>
                  <span>od {t.min_czk} Kč</span>
                  <span>{t.discount_percent > 0 ? `+${t.discount_percent}%` : '—'}</span>
                  <span>{t.min_czk} Kč → {t.example_credits} kr</span>
                </span>
              ))}
            </div>
          )}

          {/* Checkout button */}
          <button
            onClick={handleCheckout}
            disabled={!preview || checkingOut}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 6, border: 'none',
              background: !preview || checkingOut ? '#D1D5DB' : '#FF9F1C',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: !preview || checkingOut ? 'default' : 'pointer',
            }}
          >
            {checkingOut
              ? 'Přesměrování na platbu...'
              : preview
                ? `Zaplatit ${amountNum} Kč → ${preview.credits} kreditů`
                : 'Zadejte částku'}
          </button>

          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'center' }}>
            Platba kartou přes Stripe. Bezpečná platba, faktura na e-mail.
          </div>
        </div>
      )}

      {/* Balance visual bar */}
      {!usage.is_admin && !showTopup && (
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
