/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 *
 * DEV MODE: Set VITE_DISABLE_AUTH=true in .env to bypass authentication
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // 🔐 Authentication is handled by stavagent-portal
  // Monolit-Planner is a calculator app that runs AFTER user logs in to portal
  // NEVER enable authentication here - portal handles it!
  const TEMP_BYPASS_AUTH = true; // ✅ Always bypass - auth in portal

  if (isLoading) {
    // Show loading spinner while checking authentication
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f7fafc'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e2e8f0',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{
            color: '#718096',
            fontSize: '14px'
          }}>
            Načítání...
          </p>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
