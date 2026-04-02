/**
 * Email Verification Page
 * Verifies user email with token from link, then auto-redirects to login
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('Žádný token nebyl poskytnut. Zkuste zadat token ručně nebo klikněte na odkaz v e-mailu.');
    }
  }, [searchParams]);

  // Auto-redirect countdown after successful verification
  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) {
      navigate('/login');
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, navigate]);

  const verifyEmail = async (token: string) => {
    try {
      setStatus('loading');
      const response = await authAPI.verify(token);

      if (response.success) {
        setStatus('success');
        setEmail(response.user?.email || '');
      } else {
        setStatus('error');
        setMessage(response.message || 'Ověření emailu selhalo');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Chyba při ověřování emailu');
    }
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      await verifyEmail(manualToken);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        padding: '40px',
        width: '100%',
        maxWidth: '460px'
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 'bold', margin: '0 0 4px', color: '#1a202c' }}>
            StavAgent
          </h1>
          <p style={{ color: '#718096', margin: 0, fontSize: 13 }}>
            Ověření e-mailové adresy
          </p>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: '3px solid #e2e8f0', borderTopColor: '#667eea',
              margin: '0 auto 20px',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#718096', fontSize: 16 }}>
              Ověřuji váš email...
            </p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#c6f6d5', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 36
            }}>
              ✓
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#22543d', margin: '0 0 8px' }}>
              E-mail ověřen!
            </h2>

            {email && (
              <p style={{ color: '#4a5568', fontSize: 14, margin: '0 0 20px' }}>
                {email}
              </p>
            )}

            {/* What's next */}
            <div style={{
              background: '#f0fff4', borderRadius: 8, padding: '16px 20px',
              textAlign: 'left', marginBottom: 24, border: '1px solid #9ae6b4'
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#22543d', margin: '0 0 10px' }}>
                Váš účet je připraven! Co vás čeká:
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ color: '#38a169', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: '#276749' }}>200 kreditů zdarma na vyzkoušení</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ color: '#38a169', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: '#276749' }}>AI analýza dokumentů (PDF, XLSX, obrázky)</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#38a169', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: '#276749' }}>Kalkulátor betonáže, URS klasifikace</span>
              </div>
            </div>

            {/* Auto-redirect countdown */}
            <p style={{ fontSize: 12, color: '#a0aec0', margin: '0 0 12px' }}>
              Přesměrování na přihlášení za {countdown}s...
            </p>

            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%', padding: '12px',
                background: '#667eea', color: 'white',
                border: 'none', borderRadius: '6px',
                fontSize: '16px', fontWeight: '600', cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#5a67d8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#667eea'; }}
            >
              Přihlásit se nyní
            </button>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div style={{
              padding: '20px', background: '#fed7d7', border: '1px solid #fc8181',
              borderRadius: '8px', marginBottom: '20px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✕</div>
              <p style={{ color: '#742a2a', fontSize: 14, fontWeight: 500, margin: 0 }}>
                {message}
              </p>
            </div>

            {!showManualForm ? (
              <button
                onClick={() => setShowManualForm(true)}
                style={{
                  width: '100%', padding: '12px',
                  background: '#667eea', color: 'white',
                  border: 'none', borderRadius: '6px',
                  fontSize: 14, fontWeight: '600', cursor: 'pointer',
                  marginBottom: '10px', transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#5a67d8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#667eea'; }}
              >
                Zadat token ručně
              </button>
            ) : (
              <form onSubmit={handleManualVerify} style={{ marginBottom: '10px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#2d3748' }}>
                    Ověřovací token
                  </label>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Vložte token z emailu"
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1px solid #e2e8f0', borderRadius: '6px',
                      fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    width: '100%', padding: '12px',
                    background: '#667eea', color: 'white',
                    border: 'none', borderRadius: '6px',
                    fontSize: 14, fontWeight: '600', cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#5a67d8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#667eea'; }}
                >
                  Ověřit
                </button>
              </form>
            )}

            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%', padding: '12px',
                background: 'transparent', color: '#667eea',
                border: '2px solid #667eea', borderRadius: '6px',
                fontSize: 14, fontWeight: '600', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Zpět na přihlášení
            </button>
          </>
        )}

        {/* Back to landing */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#a0aec0', fontSize: 12, cursor: 'pointer' }}
          >
            ← Zpět na hlavní stránku
          </button>
        </div>
      </div>
    </div>
  );
}
