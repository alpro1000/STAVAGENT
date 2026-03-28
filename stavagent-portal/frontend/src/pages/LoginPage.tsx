/**
 * Login Page
 * Handles user login and registration with step-by-step guidance
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function LoginPage() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/portal');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegistrationSuccess(false);
    setEmailNotVerified(false);
    setResendMessage('');
    setIsLoading(true);

    try {
      if (isLoginMode) {
        await login(email, password);
        navigate('/portal');
      } else {
        if (!name.trim()) {
          setError('Jméno je povinné');
          setIsLoading(false);
          return;
        }
        await register(email, password, name);
        setRegistrationSuccess(true);
        setRegisteredEmail(email);
        setEmail('');
        setPassword('');
        setName('');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Chyba při přihlášení';
      console.error('[LOGIN] Error:', errorMessage);

      if (errorMessage.includes('Email not verified') ||
          errorMessage.includes('Ověřte si') ||
          errorMessage.includes('verify your email') ||
          errorMessage.includes('ověřen')) {
        setEmailNotVerified(true);
        setError('');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    const targetEmail = registeredEmail || email;
    if (!targetEmail) return;
    setResendLoading(true);
    setResendMessage('');
    try {
      await authAPI.resendVerification(targetEmail);
      setResendMessage('E-mail byl znovu odeslán. Zkontrolujte si schránku.');
    } catch {
      setResendMessage('Nepodařilo se odeslat. Zkuste to za chvíli.');
    } finally {
      setResendLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const,
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
        maxWidth: '440px'
      }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            margin: '0 0 4px',
            color: '#1a202c'
          }}>
            StavAgent
          </h1>
          <p style={{
            color: '#718096',
            margin: 0,
            fontSize: '13px'
          }}>
            AI platforma pro stavebnictví
          </p>
        </div>

        {/* Registration success — full instructional screen */}
        {registrationSuccess && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#c6f6d5', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 32
            }}>
              ✉️
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px', color: '#22543d' }}>
              Registrace úspěšná!
            </h2>
            <p style={{ color: '#4a5568', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
              Na adresu <strong>{registeredEmail}</strong> jsme odeslali ověřovací e-mail.
            </p>

            {/* Step-by-step instructions */}
            <div style={{
              background: '#f7fafc', borderRadius: 8, padding: '16px 20px',
              textAlign: 'left', marginBottom: 20, border: '1px solid #e2e8f0'
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#2d3748', margin: '0 0 12px' }}>
                Co dělat dál:
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', background: '#667eea', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0
                }}>1</span>
                <span style={{ fontSize: 13, color: '#4a5568' }}>Otevřete svou e-mailovou schránku</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', background: '#667eea', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0
                }}>2</span>
                <span style={{ fontSize: 13, color: '#4a5568' }}>Klikněte na tlačítko <strong>"Ověřit e-mail"</strong> v dopise od StavAgent</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', background: '#667eea', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0
                }}>3</span>
                <span style={{ fontSize: 13, color: '#4a5568' }}>Po ověření se přihlaste a začněte pracovat</span>
              </div>
            </div>

            {/* Hint about spam */}
            <p style={{ fontSize: 12, color: '#a0aec0', margin: '0 0 16px' }}>
              E-mail nedorazil? Zkontrolujte složku spam/nevyžádaná pošta.
            </p>

            {/* Resend button */}
            <button
              onClick={handleResendEmail}
              disabled={resendLoading}
              style={{
                width: '100%', padding: '10px',
                background: 'transparent', color: '#667eea',
                border: '2px solid #667eea', borderRadius: 6,
                fontSize: 14, fontWeight: 600, cursor: resendLoading ? 'not-allowed' : 'pointer',
                marginBottom: 8, transition: 'all 0.2s'
              }}
            >
              {resendLoading ? 'Odesílání...' : 'Odeslat e-mail znovu'}
            </button>

            {resendMessage && (
              <p style={{ fontSize: 12, color: resendMessage.includes('odeslán') ? '#22543d' : '#c53030', margin: '4px 0 12px' }}>
                {resendMessage}
              </p>
            )}

            {/* Go to login */}
            <button
              onClick={() => {
                setRegistrationSuccess(false);
                setIsLoginMode(true);
                setEmail(registeredEmail);
                setError('');
              }}
              style={{
                width: '100%', padding: '12px',
                background: '#667eea', color: 'white',
                border: 'none', borderRadius: 6,
                fontSize: 16, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#5a67d8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#667eea'; }}
            >
              Přejít na přihlášení
            </button>
          </div>
        )}

        {/* Email not verified warning (shown when login fails) */}
        {emailNotVerified && !registrationSuccess && (
          <div style={{
            padding: '16px',
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <p style={{ color: '#78350f', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
              E-mail ještě není ověřen
            </p>
            <p style={{ color: '#92400e', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
              Zkontrolujte si poštovní schránku a klikněte na ověřovací odkaz. Pokud e-mail nedorazil:
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resendLoading}
                style={{
                  padding: '6px 12px', background: '#f59e0b', color: '#fff',
                  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                {resendLoading ? 'Odesílání...' : 'Odeslat znovu'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/verify')}
                style={{
                  padding: '6px 12px', background: 'transparent', color: '#92400e',
                  border: '1px solid #d97706', borderRadius: 4, fontSize: 13, cursor: 'pointer'
                }}
              >
                Zadat token ručně
              </button>
            </div>
            {resendMessage && (
              <p style={{ fontSize: 12, color: resendMessage.includes('odeslán') ? '#22543d' : '#c53030', margin: '8px 0 0' }}>
                {resendMessage}
              </p>
            )}
          </div>
        )}

        {/* Login / Register form */}
        {!registrationSuccess && (
          <>
            <p style={{
              color: '#718096',
              marginBottom: '24px',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              {isLoginMode ? 'Přihlaste se ke svému účtu' : 'Vytvořte si nový účet'}
            </p>

            <form onSubmit={handleSubmit}>
              {!isLoginMode && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#2d3748' }}>
                    Jméno
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jan Novák"
                    required
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#2d3748' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vas@email.cz"
                  required
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#2d3748' }}>
                  Heslo
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
                {!isLoginMode && (
                  <p style={{ fontSize: 12, color: '#718096', marginTop: 4, marginBottom: 0 }}>
                    Minimálně 6 znaků
                  </p>
                )}
              </div>

              {error && (
                <div style={{
                  padding: '12px', background: '#fed7d7', border: '1px solid #fc8181',
                  borderRadius: '6px', color: '#742a2a', fontSize: '14px', marginBottom: '16px'
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%', padding: '12px',
                  background: isLoading ? '#a0aec0' : '#667eea',
                  color: 'white', border: 'none', borderRadius: '6px',
                  fontSize: '16px', fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = '#5a67d8'; }}
                onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.background = '#667eea'; }}
              >
                {isLoading ? 'Načítání...' : (isLoginMode ? 'Přihlásit se' : 'Zaregistrovat se')}
              </button>

              {isLoginMode && (
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    style={{
                      background: 'none', border: 'none', color: '#667eea',
                      fontSize: '13px', cursor: 'pointer', textDecoration: 'underline'
                    }}
                  >
                    Zapomenuté heslo?
                  </button>
                </div>
              )}

              {!isLoginMode && (
                <p style={{ fontSize: 11, color: '#a0aec0', textAlign: 'center', marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>
                  Registrací získáte 200 kreditů zdarma pro vyzkoušení AI nástrojů.
                </p>
              )}
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setError('');
                  setEmailNotVerified(false);
                  setResendMessage('');
                }}
                style={{
                  background: 'none', border: 'none', color: '#667eea',
                  fontSize: '14px', cursor: 'pointer', textDecoration: 'underline'
                }}
              >
                {isLoginMode ? 'Nemáte účet? Zaregistrujte se' : 'Už máte účet? Přihlaste se'}
              </button>
            </div>
          </>
        )}

        {/* Back to landing */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', color: '#a0aec0',
              fontSize: 12, cursor: 'pointer'
            }}
          >
            ← Zpět na hlavní stránku
          </button>
        </div>
      </div>
    </div>
  );
}
