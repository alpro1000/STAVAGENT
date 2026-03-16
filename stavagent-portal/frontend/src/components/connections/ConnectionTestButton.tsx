import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import type { ConnectionStatus } from '../../types/connection';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface Props {
  connectionId: string;
  onTestComplete: (status: ConnectionStatus, message: string) => void;
}

export default function ConnectionTestButton({ connectionId, onTestComplete }: Props) {
  const { token } = useAuth();
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const resp = await axios.post(
        `${API_URL}/api/connections/${connectionId}/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onTestComplete(resp.data.status, resp.data.message);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      onTestComplete('error', msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <button
      onClick={handleTest}
      disabled={testing}
      style={{
        padding: '6px 14px', fontSize: 13, fontWeight: 500,
        border: '1px solid #d1d5db', borderRadius: 6, cursor: testing ? 'wait' : 'pointer',
        background: testing ? '#f3f4f6' : '#fff', color: '#374151',
        transition: 'background 0.15s',
      }}
    >
      {testing ? 'Testuji...' : 'Otestovat'}
    </button>
  );
}
