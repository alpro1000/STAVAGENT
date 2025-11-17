/**
 * User Dashboard Page
 * Displays user profile information and navigation to settings
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

interface UserInfo {
  id: number;
  email: string;
  name: string;
  role: string;
  email_verified: boolean;
  created_at: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setLoading(true);
        const response = await authAPI.getMe();
        setUserInfo(response.user);
      } catch (err: any) {
        setError(err.message || 'Chyba při načítání profilu');
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        maxWidth: '600px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          marginBottom: '8px',
          color: '#1a202c'
        }}>
          Profil uživatele
        </h1>

        <p style={{
          color: '#718096',
          marginBottom: '32px',
          fontSize: '14px'
        }}>
          Správa vašeho účtu a bezpečnostních nastavení
        </p>

        {loading && (
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
              Načítám váš profil...
            </p>
          </div>
        )}

        {error && (
          <div style={{
            padding: '16px',
            background: '#fed7d7',
            border: '1px solid #fc8181',
            borderRadius: '6px',
            marginBottom: '24px',
            color: '#742a2a',
            fontSize: '14px'
          }}>
            ❌ {error}
          </div>
        )}

        {!loading && userInfo && (
          <>
            {/* User Info Card */}
            <div style={{
              padding: '24px',
              background: '#f8f9fa',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              {/* Name */}
              <div style={{
                marginBottom: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#718096',
                  marginBottom: '4px',
                  textTransform: 'uppercase'
                }}>
                  Jméno
                </label>
                <p style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1a202c',
                  margin: 0
                }}>
                  {userInfo.name}
                </p>
              </div>

              {/* Email */}
              <div style={{
                marginBottom: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#718096',
                  marginBottom: '4px',
                  textTransform: 'uppercase'
                }}>
                  Email
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <p style={{
                    fontSize: '16px',
                    color: '#2d3748',
                    margin: 0
                  }}>
                    {userInfo.email}
                  </p>
                  {userInfo.email_verified ? (
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      background: '#c6f6d5',
                      color: '#22543d',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      ✓ Ověřený
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      background: '#fef3c7',
                      color: '#92400e',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      ⚠ Neověřený
                    </span>
                  )}
                </div>
              </div>

              {/* Role */}
              <div style={{
                marginBottom: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#718096',
                  marginBottom: '4px',
                  textTransform: 'uppercase'
                }}>
                  Typ účtu
                </label>
                <p style={{
                  fontSize: '16px',
                  color: '#2d3748',
                  margin: 0,
                  textTransform: 'capitalize'
                }}>
                  {userInfo.role === 'admin' ? '👨‍💼 Administrátor' : '👤 Uživatel'}
                </p>
              </div>

              {/* Created At */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#718096',
                  marginBottom: '4px',
                  textTransform: 'uppercase'
                }}>
                  Registrován
                </label>
                <p style={{
                  fontSize: '14px',
                  color: '#4a5568',
                  margin: 0
                }}>
                  {formatDate(userInfo.created_at)}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '12px'
            }}>
              {/* Change Password Button */}
              <button
                onClick={() => navigate('/change-password')}
                style={{
                  padding: '12px 16px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
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
                🔐 Heslo
              </button>

              {/* Verify Email Button (if not verified) */}
              {!userInfo.email_verified && (
                <button
                  onClick={() => navigate('/verify')}
                  style={{
                    padding: '12px 16px',
                    background: '#ed8936',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#dd6b20';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ed8936';
                  }}
                >
                  ✉️ Ověřit email
                </button>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '12px',
                background: '#f1f5f9',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e0e7ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
              }}
            >
              Odhlásit se
            </button>
          </>
        )}
      </div>
    </div>
  );
}
