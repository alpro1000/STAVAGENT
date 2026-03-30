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
import DataPipeline from '../components/admin/DataPipeline';
import { adminAPI } from '../services/api';

type Tab = 'overview' | 'users' | 'credits' | 'usage' | 'flags' | 'antifraud' | 'audit-logs' | 'nkb' | 'pipeline';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Přehled' },
  { id: 'users', label: 'Uživatelé' },
  { id: 'credits', label: 'Kredity' },
  { id: 'usage', label: 'Použití & tokeny' },
  { id: 'flags', label: 'Funkce & služby' },
  { id: 'antifraud', label: 'Antifraud' },
  { id: 'audit-logs', label: 'Audit logy' },
  { id: 'nkb', label: 'Normy (NKB)' },
  { id: 'pipeline', label: 'Data Pipeline' },
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
        {activeTab === 'pipeline' && (
          <DataPipeline />
        )}
        {activeTab === 'nkb' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: '#718096', marginBottom: 12 }}>
                Správa normativní znalostní báze — normy, pravidla, audit zdrojů, URS harvest.
              </p>
              <button
                onClick={() => navigate('/portal/nkb')}
                style={{
                  padding: '12px 24px', background: '#FF9F1C', color: '#fff', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600,
                }}
              >
                Otevřít NKB správce →
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { label: 'Normy & pravidla', desc: 'Procházet a přidávat ČSN, TKP, VTP...', tab: 'norms' },
                { label: 'Stav NKB (audit)', desc: 'Gap-analýza — co chybí, co je zastaralé', tab: 'audit' },
                { label: 'URS Harvest', desc: 'Sběr OTSKP kódů z podminky.urs.cz', tab: 'harvest' },
              ].map(item => (
                <div key={item.tab} onClick={() => navigate(`/portal/nkb?tab=${item.tab}`)}
                  style={{
                    padding: 16, background: '#f7f7f8', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid #e2e8f0', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = '#FF9F1C')}
                  onMouseOut={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#718096' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
