/**
 * Forgot Password Page
 * Allows users to request a password reset email
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Zadejte svou e-mailovou adresu');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Zadejte platnou e-mailovou adresu');
      return;
    }

    setIsLoading(true);

    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
      setEmail('');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Chyba při odesílání odkazu na resetování hesla');
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
        maxWidth: '500px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          marginBottom: '8px',
          color: '#1a202c'
        }}>
          Zapomenuté heslo
        </h1>

        <p style={{
          color: '#718096',
          marginBottom: '32px',
          fontSize: '14px'
        }}>
          Zadejte svou e-mailovou adresu a pošleme vám odkaz na resetování hesla
        </p>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#fed7d7',
            border: '1px solid #fc8181',
            borderRadius: '6px',
            marginBottom: '20px',
            color: '#742a2a',
            fontSize: '14px'
          }}>
            ❌ {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '20px',
            background: '#c6f6d5',
            border: '1px solid #9ae6b4',
            borderRadius: '6px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '12px'
            }}>
              ✅
            </div>
            <p style={{
              color: '#22543d',
              fontSize: '16px',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              Odkaz byl odeslán!
            </p>
            <p style={{
              color: '#276749',
              fontSize: '14px',
              margin: 0
            }}>
              Zkontrolujte svou e-mailovou schránku na instrukce k resetování hesla.
            </p>
            <p style={{
              color: '#276749',
              fontSize: '12px',
              marginTop: '8px'
            }}>
              Za 3 sekundy budete přesměrováni na přihlášení...
            </p>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            {/* Email Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '8px',
                color: '#2d3748'
              }}>
                E-mailová adresa
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Zadejte svou e-mailovou adresu"
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
                disabled={isLoading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                background: isLoading ? '#cbd5e0' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                marginBottom: '12px'
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
              {isLoading ? 'Odesílám...' : 'Odeslat odkaz na resetování'}
            </button>

            {/* Back to Login Link */}
            <div style={{
              textAlign: 'center',
              marginTop: '16px'
            }}>
              <button
                type="button"
                onClick={() => navigate('/login')}
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
          </form>
        )}
      </div>
    </div>
  );
}
