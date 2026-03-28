/**
 * Admin Dashboard
 * Main admin panel: user management, usage stats, feature flags, credits, audit logs, anti-fraud
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import UserManagement from '../components/admin/UserManagement';
import AuditLogs from '../components/admin/AuditLogs';
import AdminStats from '../components/admin/AdminStats';
import UsageStats from '../components/admin/UsageStats';
import FeatureFlags from '../components/admin/FeatureFlags';
import AntifraudPanel from '../components/admin/AntifraudPanel';
import CreditManagement from '../components/admin/CreditManagement';
import { adminAPI } from '../services/api';

type Tab = 'overview' | 'users' | 'credits' | 'usage' | 'flags' | 'antifraud' | 'audit-logs';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Přehled' },
  { id: 'users', label: 'Uživatelé' },
  { id: 'credits', label: 'Kredity' },
  { id: 'usage', label: 'Použití & tokeny' },
  { id: 'flags', label: 'Funkce & služby' },
  { id: 'antifraud', label: 'Antifraud' },
  { id: 'audit-logs', label: 'Audit logy' },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => { loadStats(); }, []);

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
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ color: '#e53e3e' }}>Nemáte oprávnění pro přístup k admin panelu</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24, fontSize: 28, fontWeight: 'bold' }}>
        Admin Panel
      </h1>

      {error && (
        <div style={{
          padding: '12px 16px', background: '#fed7d7', border: '1px solid #fc8181',
          borderRadius: 6, marginBottom: 20, color: '#742a2a',
        }}>
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{
        display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 24,
        overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px', border: 'none',
              background: activeTab === tab.id ? '#FF9F1C' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#718096',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 500,
              borderRadius: activeTab === tab.id ? '6px 6px 0 0' : 0,
              transition: 'all 0.2s', fontSize: 13, whiteSpace: 'nowrap',
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
        {activeTab === 'credits' && (
          <CreditManagement />
        )}
        {activeTab === 'usage' && (
          <UsageStats />
        )}
        {activeTab === 'flags' && (
          <FeatureFlags />
        )}
        {activeTab === 'antifraud' && (
          <AntifraudPanel />
        )}
        {activeTab === 'audit-logs' && (
          <AuditLogs />
        )}
      </div>
    </div>
  );
}
