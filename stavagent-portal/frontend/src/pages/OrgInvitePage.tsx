/**
 * OrgInvitePage — accept org invite via token in URL
 * Route: /org/accept-invite?token=...
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

export default function OrgInvitePage() {
  const [params] = useSearchParams();
  const { token, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const inviteToken = params.get('token');

  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (!inviteToken) {
      setStatus('error');
      setMessage('Chybí token pozvánky');
    }
  }, [inviteToken]);

  async function acceptInvite() {
    if (!inviteToken || !token) return;
    setStatus('accepting');
    try {
      const res = await axios.post(`${API_URL}/api/orgs/accept-invite`, { token: inviteToken }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrgName(res.data.org?.name ?? 'organizaci');
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Chyba při přijímání pozvánky');
    }
  }

  if (isLoading) {
    return <PageWrapper><div style={{ color: '#6b7280' }}>Načítání...</div></PageWrapper>;
  }

  if (!isAuthenticated) {
    return (
      <PageWrapper>
        <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#111827' }}>Pozvánka do organizace</h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
          Přihlaste se nebo zaregistrujte, abyste mohli přijmout pozvánku.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate(`/login?redirect=/org/accept-invite?token=${inviteToken}`)} style={{
            padding: '9px 20px', borderRadius: 6, border: 'none',
            background: '#FF9F1C', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14
          }}>
            Přihlásit se
          </button>
          <button onClick={() => navigate(`/register?redirect=/org/accept-invite?token=${inviteToken}`)} style={{
            padding: '9px 20px', borderRadius: 6, border: '1px solid #d1d5db',
            background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 14
          }}>
            Registrovat
          </button>
        </div>
      </PageWrapper>
    );
  }

  if (status === 'success') {
    return (
      <PageWrapper>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>Pozvánka přijata!</h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
          Úspěšně jste se připojili k organizaci <strong>{orgName}</strong>.
        </p>
        <button onClick={() => navigate('/cabinet/orgs')} style={{
          padding: '9px 20px', borderRadius: 6, border: 'none',
          background: '#FF9F1C', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14
        }}>
          Zobrazit organizace
        </button>
      </PageWrapper>
    );
  }

  if (status === 'error') {
    return (
      <PageWrapper>
        <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#dc2626' }}>Chyba</h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>{message}</p>
        <button onClick={() => navigate('/portal')} style={{
          padding: '9px 20px', borderRadius: 6, border: '1px solid #d1d5db',
          background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 14
        }}>
          Na portál
        </button>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>Pozvánka do organizace</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Byli jste pozváni do organizace na platformě StavAgent. Klikněte pro přijetí pozvánky.
      </p>
      <button onClick={acceptInvite} disabled={status === 'accepting'} style={{
        padding: '10px 28px', borderRadius: 6, border: 'none',
        background: status === 'accepting' ? '#9ca3af' : '#FF9F1C',
        color: '#fff', cursor: status === 'accepting' ? 'not-allowed' : 'pointer',
        fontWeight: 600, fontSize: 15
      }}>
        {status === 'accepting' ? 'Přijímání...' : 'Přijmout pozvánku'}
      </button>
    </PageWrapper>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
        padding: 40, maxWidth: 440, width: '100%', textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {children}
      </div>
    </div>
  );
}
