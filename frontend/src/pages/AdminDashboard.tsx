/**
 * Admin Dashboard
 * Main admin panel for user management, audit logs, and system statistics
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import UserManagement from '../components/admin/UserManagement';
import AuditLogs from '../components/admin/AuditLogs';
import AdminStats from '../components/admin/AdminStats';
import { adminAPI } from '../services/api';

type Tab = 'overview' | 'users' | 'audit-logs';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Load admin statistics
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getStats();
      setStats(response.data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Chyba při načítání statistik');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#e53e3e' }}>Nemáte oprávnění pro přístup k admin panelu</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: 'bold' }}>
        Admin Panel
      </h1>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fed7d7',
          border: '1px solid #fc8181',
          borderRadius: '6px',
          marginBottom: '20px',
          color: '#742a2a'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '24px'
      }}>
        {[
          { id: 'overview', label: '📊 Přehled', icon: '📊' },
          { id: 'users', label: '👥 Správa uživatelů', icon: '👥' },
          { id: 'audit-logs', label: '📋 Auditní logy', icon: '📋' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: activeTab === tab.id ? '#667eea' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#718096',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? '600' : '500',
              borderRadius: activeTab === tab.id ? '4px 4px 0 0' : '0',
              transition: 'all 0.2s',
              fontSize: '14px'
            }}
            onMouseEnter={e => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = '#edf2f7';
              }
            }}
            onMouseLeave={e => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <AdminStats stats={stats} loading={loading} onRefresh={loadStats} />
        )}

        {activeTab === 'users' && (
          <UserManagement onUserUpdated={loadStats} />
        )}

        {activeTab === 'audit-logs' && (
          <AuditLogs />
        )}
      </div>
    </div>
  );
}
