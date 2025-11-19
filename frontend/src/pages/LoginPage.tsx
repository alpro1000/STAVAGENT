/**
 * Login Page
 * Handles user login and registration
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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
  const [emailNotVerified, setEmailNotVerified] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegistrationSuccess(false);
    setEmailNotVerified(false);
    setIsLoading(true);

    try {
      if (isLoginMode) {
        await login(email, password);
        // Navigate to home on success
        navigate('/');
      } else {
        if (!name.trim()) {
          setError('Jméno je povinné');
          setIsLoading(false);
          return;
        }
        await register(email, password, name);
        setRegistrationSuccess(true);
        setEmail('');
        setPassword('');
        setName('');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Chyba při přihlášení';
      console.error('[LOGIN] Error:', errorMessage);

      // Check if it's an email verification error (check both English and Czech versions)
      if (errorMessage.includes('Email not verified') ||
          errorMessage.includes('Ověřte si') ||
          errorMessage.includes('verify your email') ||
          errorMessage.includes('ověřen')) {
        console.log('[LOGIN] Email verification error detected, showing prompt');
        setEmailNotVerified(true);
        setError('');
      } else {
        console.log('[LOGIN] Other error:', errorMessage);
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
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
        maxWidth: '400px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          marginBottom: '8px',
          color: '#1a202c'
        }}>
          Monolit Planner
        </h1>

        <p style={{
          color: '#718096',
          marginBottom: '32px',
          fontSize: '14px'
        }}>
          {isLoginMode ? 'Přihlaste se ke svému účtu' : 'Vytvořte si nový účet'}
        </p>

        {registrationSuccess && (
          <div style={{
            padding: '12px',
            background: '#c6f6d5',
            border: '1px solid #9ae6b4',
            borderRadius: '6px',
            color: '#22543d',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            ✅ Registrace byla úspěšná! Zkontrolujte si email a klikněte na odkaz k ověření.
          </div>
        )}

        {emailNotVerified && (
          <div style={{
            padding: '12px',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '6px',
            color: '#78350f',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            ⚠️ Váš email ještě není ověřen. Zkontrolujte si poštovní schránku a klikněte na odkaz k ověření.
            <br />
            <button
              type="button"
              onClick={() => navigate('/verify')}
              style={{
                marginTop: '8px',
                display: 'inline-block',
                color: '#92400e',
                textDecoration: 'underline',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Máte token? Ověřte si email zde →
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: registrationSuccess ? 'none' : 'block' }}>
          {!isLoginMode && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '8px',
                color: '#2d3748'
              }}>
                Jméno
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jan Novák"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#2d3748'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vas@email.cz"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#2d3748'
            }}>
              Heslo
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            {!isLoginMode && (
              <p style={{
                fontSize: '12px',
                color: '#718096',
                marginTop: '4px'
              }}>
                Minimálně 6 znaků
              </p>
            )}
          </div>

          {error && (
            <div style={{
              padding: '12px',
              background: '#fed7d7',
              border: '1px solid #fc8181',
              borderRadius: '6px',
              color: '#742a2a',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: isLoading ? '#a0aec0' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = '#5a67d8';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = '#667eea';
              }
            }}
          >
            {isLoading ? 'Načítání...' : (isLoginMode ? 'Přihlásit se' : 'Registrovat')}
          </button>

          {/* Forgot Password link - only show in login mode */}
          {isLoginMode && (
            <div style={{
              marginTop: '12px',
              textAlign: 'center'
            }}>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#667eea',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Zapomenuté heslo?
              </button>
            </div>
          )}
        </form>

        {!registrationSuccess && (
          <div style={{
            marginTop: '24px',
            textAlign: 'center'
          }}>
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError('');
                setEmailNotVerified(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: '14px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isLoginMode ? 'Nemáte účet? Zaregistrujte se' : 'Už máte účet? Přihlaste se'}
            </button>
          </div>
        )}

        {registrationSuccess && (
          <div style={{
            marginTop: '24px',
            textAlign: 'center'
          }}>
            <button
              onClick={() => {
                setRegistrationSuccess(false);
                setIsLoginMode(true);
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: '14px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Zpět na přihlášení
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
