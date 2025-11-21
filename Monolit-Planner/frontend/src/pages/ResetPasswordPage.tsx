/**
 * Reset Password Page
 * Handles password reset via token from email link
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      setStatus('form');
      setMessage('');
    } else {
      setStatus('error');
      setMessage('Žádný token nebyl poskytnut. Zkuste požádat o nové resetování hesla.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!newPassword.trim()) {
      setMessage('Zadejte nové heslo');
      return;
    }

    if (newPassword.length < 6) {
      setMessage('Heslo musí mít minimálně 6 znaků');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Hesla se neshodují');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authAPI.resetPassword(token, newPassword);

      if (response.success) {
        setStatus('success');
        setMessage(response.message || 'Heslo bylo úspěšně resetováno! Nyní se můžete přihlásit s novým heslem.');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setStatus('error');
        setMessage(response.message || 'Resetování hesla selhalo');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Chyba při resetování hesla');
    } finally {
      setIsSubmitting(false);
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
          Resetovat heslo
        </h1>

        <p style={{
          color: '#718096',
          marginBottom: '32px',
          fontSize: '14px'
        }}>
          Nastavte si nové heslo
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
              Kontroluji token...
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

            <button
              onClick={() => navigate('/forgot-password')}
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
              Požádat o nový odkaz
            </button>
          </>
        )}

        {status === 'form' && (
          <form onSubmit={handleSubmit}>
            {message && (
              <div style={{
                padding: '12px 16px',
                background: '#fed7d7',
                border: '1px solid #fc8181',
                borderRadius: '6px',
                marginBottom: '20px',
                color: '#742a2a',
                fontSize: '14px'
              }}>
                ❌ {message}
              </div>
            )}

            {/* New Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '8px',
                color: '#2d3748'
              }}>
                Nové heslo
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Zadejte nové heslo (minimálně 6 znaků)"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
                disabled={isSubmitting}
              />
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '8px',
                color: '#2d3748'
              }}>
                Potvrzení hesla
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Potvrzení nového hesla"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
                disabled={isSubmitting}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px',
                background: isSubmitting ? '#cbd5e0' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = '#5a67d8';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = '#667eea';
                }
              }}
            >
              {isSubmitting ? 'Resetuji heslo...' : 'Resetovat heslo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
