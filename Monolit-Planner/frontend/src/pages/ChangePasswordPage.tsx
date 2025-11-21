/**
 * Change Password Page
 * Allows authenticated users to change their password
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!currentPassword.trim()) {
      setError('Zadejte současné heslo');
      return;
    }

    if (!newPassword.trim()) {
      setError('Zadejte nové heslo');
      return;
    }

    if (newPassword.length < 6) {
      setError('Nové heslo musí mít minimálně 6 znaků');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Nové hesla se neshodují');
      return;
    }

    if (currentPassword === newPassword) {
      setError('Nové heslo musí být jiné než stávající heslo');
      return;
    }

    setIsLoading(true);

    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setSuccess('Heslo bylo úspěšně změněno!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Chyba při změně hesla');
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
          Změna hesla
        </h1>

        <p style={{
          color: '#718096',
          marginBottom: '32px',
          fontSize: '14px'
        }}>
          Změňte si heslo k vašemu účtu
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
            padding: '12px 16px',
            background: '#c6f6d5',
            border: '1px solid #9ae6b4',
            borderRadius: '6px',
            marginBottom: '20px',
            color: '#22543d',
            fontSize: '14px'
          }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Current Password */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#2d3748'
            }}>
              Současné heslo
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Zadejte vaše stávající heslo"
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
              disabled={isLoading}
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
              Potvrzení nového hesla
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
              disabled={isLoading}
            />
          </div>

          {/* Password Requirements */}
          <div style={{
            padding: '12px',
            background: '#edf2f7',
            borderRadius: '6px',
            marginBottom: '24px',
            fontSize: '12px',
            color: '#4a5568',
            lineHeight: '1.6'
          }}>
            <strong>Požadavky na heslo:</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>Minimálně 6 znaků</li>
              <li>Musí se lišit od stávajícího hesla</li>
              <li>Obě pole musí být shodná</li>
            </ul>
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
            {isLoading ? 'Změňuji heslo...' : 'Změnit heslo'}
          </button>

          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'transparent',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isLoading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = '#f0f4ff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            Zpět na profil
          </button>
        </form>
      </div>
    </div>
  );
}
