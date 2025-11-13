/**
 * Email Verification Page
 * Verifies user email with token from link
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

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('Žádný token nebyl poskytnut. Zkuste zadat token ručně nebo klikněte na odkaz v e-mailu.');
    }
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      setStatus('loading');
      const response = await authAPI.verify(token);

      if (response.success) {
        setStatus('success');
        setMessage('Email byl úspěšně ověřen! Nyní se můžete přihlásit.');
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        padding: '40px',
        width: '100%',
        maxWidth: '500px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          marginBottom: '8px',
          color: '#1a202c'
        }}>
          Ověřit e-mail
        </h1>

        <p style={{
          color: '#718096',
          marginBottom: '32px',
          fontSize: '14px'
        }}>
          Potvrzení vaší e-mailové adresy
        </p>

        {status === 'loading' && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px'
            }}>
              ⏳
            </div>
            <p style={{
              color: '#718096',
              fontSize: '16px'
            }}>
              Ověřuji váš email...
            </p>
          </div>
        )}

        {status === 'success' && (
          <>
            <div style={{
              padding: '20px',
              background: '#c6f6d5',
              border: '1px solid #9ae6b4',
              borderRadius: '6px',
              marginBottom: '24px'
            }}>
              <div style={{
                fontSize: '48px',
                textAlign: 'center',
                marginBottom: '16px'
              }}>
                ✅
              </div>
              <p style={{
                color: '#22543d',
                fontSize: '16px',
                fontWeight: '500',
                textAlign: 'center',
                marginBottom: '8px'
              }}>
                {message}
              </p>
              {email && (
                <p style={{
                  color: '#276749',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  E-mail: {email}
                </p>
              )}
            </div>

            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                padding: '12px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#5a67d8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#667eea';
              }}
            >
              Přejít na přihlášení
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              padding: '20px',
              background: '#fed7d7',
              border: '1px solid #fc8181',
              borderRadius: '6px',
              marginBottom: '24px'
            }}>
              <div style={{
                fontSize: '48px',
                textAlign: 'center',
                marginBottom: '16px'
              }}>
                ❌
              </div>
              <p style={{
                color: '#742a2a',
                fontSize: '16px',
                fontWeight: '500',
                textAlign: 'center'
              }}>
                {message}
              </p>
            </div>

            {!showManualForm ? (
              <button
                onClick={() => setShowManualForm(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  marginBottom: '12px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#5a67d8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#667eea';
                }}
              >
                Zadat token ručně
              </button>
            ) : (
              <form onSubmit={handleManualVerify} style={{ marginBottom: '12px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    color: '#2d3748'
                  }}>
                    Ověřovací token
                  </label>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Vložte token z emailu"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#5a67d8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#667eea';
                  }}
                >
                  Ověřit email
                </button>
              </form>
            )}

            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f4ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Zpět na přihlášení
            </button>
          </>
        )}
      </div>
    </div>
  );
}
