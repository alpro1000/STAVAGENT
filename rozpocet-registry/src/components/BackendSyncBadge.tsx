/**
 * BackendSyncBadge — Phase 3 (2026-04-15)
 *
 * Small status indicator rendered next to the "Projekty" title. Shows
 * one of: synced · syncing · pending · offline · error. Hidden when
 * status='idle' so the UI stays clean during normal browsing.
 *
 * Subscribes to the module-level state exposed by
 * services/backendSync.ts via subscribeBackendSync(). No store, no
 * provider — it's a single global state.
 */

import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import {
  getBackendSyncState,
  subscribeBackendSync,
  type BackendSyncStatus,
} from '../services/backendSync';

interface Visual {
  label: string;
  icon: React.ReactElement;
  bg: string;
  border: string;
  color: string;
  title: string;
}

function visualFor(status: BackendSyncStatus, lastError: string | null, pendingName: string | null): Visual | null {
  switch (status) {
    case 'idle':
      return null;
    case 'pending':
      return {
        label: 'Čeká se na uložení…',
        icon: <Clock size={13} />,
        bg: '#fef3c7',
        border: '#fde68a',
        color: '#92400e',
        title: pendingName
          ? `Čeká se 2s před odesláním projektu "${pendingName}" na backend.`
          : 'Čeká se na odeslání změn.',
      };
    case 'syncing':
      return {
        label: 'Ukládám…',
        icon: <RefreshCw size={13} className="animate-spin" />,
        bg: '#dbeafe',
        border: '#bfdbfe',
        color: '#1e40af',
        title: pendingName ? `Odesílám projekt "${pendingName}" na PostgreSQL…` : 'Synchronizace běží',
      };
    case 'synced':
      return {
        label: 'Uloženo',
        icon: <CheckCircle2 size={13} />,
        bg: '#dcfce7',
        border: '#bbf7d0',
        color: '#166534',
        title: 'Poslední synchronizace proběhla úspěšně.',
      };
    case 'offline':
      return {
        label: 'Offline',
        icon: <CloudOff size={13} />,
        bg: '#fef2f2',
        border: '#fecaca',
        color: '#991b1b',
        title: 'Backend není dostupný. Data se ukládají pouze lokálně v prohlížeči.',
      };
    case 'error':
      return {
        label: 'Chyba synchronizace',
        icon: <AlertTriangle size={13} />,
        bg: '#fef2f2',
        border: '#fecaca',
        color: '#991b1b',
        title: lastError
          ? `Poslední chyba: ${lastError}. Data zůstávají v prohlížeči — další pokus proběhne při příští změně.`
          : 'Neznámá chyba při synchronizaci.',
      };
    default:
      return {
        label: 'Synchronizace',
        icon: <Cloud size={13} />,
        bg: '#f1f5f9',
        border: '#e2e8f0',
        color: '#475569',
        title: '',
      };
  }
}

export function BackendSyncBadge() {
  const [state, setState] = useState(() => getBackendSyncState());

  useEffect(() => {
    return subscribeBackendSync(next => setState(next));
  }, []);

  const visual = visualFor(state.status, state.lastError, state.pendingProjectName);
  if (!visual) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: visual.bg,
        border: `1px solid ${visual.border}`,
        color: visual.color,
        cursor: 'help',
        userSelect: 'none',
      }}
      title={visual.title}
    >
      {visual.icon}
      {visual.label}
    </span>
  );
}
