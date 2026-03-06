/**
 * KioskLinksPanel Component
 *
 * Displays all linked kiosks for a portal project.
 * Shows status, last sync, position count, and actions (open / unlink).
 *
 * API: GET {API_URL}/api/portal-projects/{projectId}/kiosks
 * Design: Digital Concrete (inline styles)
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Unlink, Loader } from 'lucide-react';
import { API_URL } from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KioskLink {
  link_id: string;
  kiosk_type: 'monolit' | 'registry' | 'urs_matcher';
  kiosk_project_id: string;
  status: 'active' | 'inactive';
  last_sync?: string;
  position_count?: number;
}

interface KioskLinksPanelProps {
  projectId: string;
  onRefresh?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const KIOSK_META: Record<string, { label: string; icon: string; color: string; url: string }> = {
  monolit: { label: 'Monolit Planner', icon: '\u{1FAA8}', color: '#6366f1', url: 'https://monolit-planner-frontend.vercel.app' },
  registry: { label: 'Registr Rozpočtů', icon: '\u{1F4CA}', color: '#f59e0b', url: 'https://stavagent-backend-ktwx.vercel.app' },
  urs_matcher: { label: 'URS Matcher', icon: '\u{1F50E}', color: '#22c55e', url: 'https://urs-matcher-service.onrender.com' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${localStorage.getItem('auth_token')}` };
}

function formatSyncDate(iso?: string): string {
  if (!iso) return 'nikdy';
  return new Date(iso).toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function KioskLinksPanel({ projectId, onRefresh }: KioskLinksPanelProps) {
  const [links, setLinks] = useState<KioskLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  // ── Fetch kiosk links ────────────────────────────────────────────────────

  const loadLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `${API_URL}/api/portal-projects/${projectId}/kiosks`,
        { headers: authHeader() }
      );
      if (!res.ok) throw new Error(`Failed to load kiosk links (${res.status})`);
      const data = await res.json();
      setLinks(data.kiosks || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kiosk links');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  // ── Unlink kiosk ─────────────────────────────────────────────────────────

  const handleUnlink = async (link: KioskLink) => {
    const meta = KIOSK_META[link.kiosk_type];
    const label = meta?.label || link.kiosk_type;

    if (!confirm(`Opravdu chcete odpojit kiosk "${label}"?\nTato akce neodstraní data v kiosku.`)) {
      return;
    }

    try {
      setUnlinking(link.link_id);
      const res = await fetch(
        `${API_URL}/api/portal-projects/${projectId}/kiosks/${link.link_id}`,
        { method: 'DELETE', headers: authHeader() }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Failed to unlink (${res.status})`);
      }
      await loadLinks();
      onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unlink kiosk');
    } finally {
      setUnlinking(null);
    }
  };

  // ── Open kiosk ───────────────────────────────────────────────────────────

  const handleOpen = (link: KioskLink) => {
    const meta = KIOSK_META[link.kiosk_type];
    if (!meta) return;

    // Build deep-link URL with kiosk-specific routing
    if (link.kiosk_type === 'monolit') {
      // Monolit reads ?project=X&portal_project=Y on root path
      const url = new URL(meta.url);
      url.searchParams.set('project', link.kiosk_project_id);
      url.searchParams.set('portal_project', projectId);
      window.open(url.toString(), '_blank');
    } else if (link.kiosk_type === 'registry') {
      // Registry uses /registry/:projectId route (react-router)
      window.open(`${meta.url}/?project_id=${link.kiosk_project_id}&portal_project=${projectId}`, '_blank');
    } else {
      // Default: query params
      const url = new URL(meta.url);
      url.searchParams.set('project_id', link.kiosk_project_id);
      url.searchParams.set('portal_project', projectId);
      window.open(url.toString(), '_blank');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ borderBottom: '1px solid #e5e5e5' }}>
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          background: '#f8f8f8',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          color: '#1e293b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{'\u{1F517}'}</span>
          Propojene kiosky
          {!loading && links.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: '#6b7280',
                background: '#e5e7eb',
                padding: '1px 8px',
                borderRadius: '999px',
              }}
            >
              {links.length}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp style={{ width: '16px', height: '16px', color: '#6b7280' }} />
        ) : (
          <ChevronDown style={{ width: '16px', height: '16px', color: '#6b7280' }} />
        )}
      </button>

      {/* Collapsible body */}
      {open && (
        <div style={{ padding: '0 24px 20px' }}>
          {/* Loading state */}
          {loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '24px',
                color: '#6b7280',
                fontSize: '13px',
              }}
            >
              <Loader
                style={{
                  width: '24px',
                  height: '24px',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 8px',
                }}
              />
              Nacitani...
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '12px',
                color: '#dc2626',
                fontSize: '13px',
                marginTop: '12px',
              }}
            >
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && links.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                marginTop: '12px',
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#6b7280',
                  margin: '0 0 6px',
                }}
              >
                Zadne propojene kiosky
              </p>
              <p
                style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  margin: 0,
                }}
              >
                Kiosky se propoji automaticky pri otevreni z parsovaneho souboru vyse,
                nebo je lze pripojit z jednotlivych kioskovych aplikaci.
              </p>
            </div>
          )}

          {/* Kiosk link cards */}
          {!loading && !error && links.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                paddingTop: '12px',
              }}
            >
              {links.map((link) => {
                const meta = KIOSK_META[link.kiosk_type] || {
                  label: link.kiosk_type,
                  icon: '\u{1F4E6}',
                  color: '#6b7280',
                  url: '#',
                };
                const isActive = link.status === 'active';
                const isUnlinking = unlinking === link.link_id;

                return (
                  <div
                    key={link.link_id}
                    style={{
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      background: '#fff',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = meta.color;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5';
                    }}
                  >
                    {/* Top row: icon + name + status */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span style={{ fontSize: '22px' }}>{meta.icon}</span>
                        <div>
                          <p
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#1e293b',
                              margin: 0,
                            }}
                          >
                            {meta.label}
                          </p>
                          <p
                            style={{
                              fontSize: '11px',
                              color: '#9ca3af',
                              margin: 0,
                            }}
                          >
                            ID: {link.kiosk_project_id.length > 20
                              ? link.kiosk_project_id.slice(0, 20) + '...'
                              : link.kiosk_project_id}
                          </p>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: isActive ? '#15803d' : '#dc2626',
                          background: isActive ? '#dcfce7' : '#fee2e2',
                          padding: '2px 10px',
                          borderRadius: '999px',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isActive ? '#22c55e' : '#ef4444',
                            display: 'inline-block',
                          }}
                        />
                        {isActive ? 'Aktivni' : 'Neaktivni'}
                      </span>
                    </div>

                    {/* Info row: sync + position count */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                        fontSize: '12px',
                        color: '#6b7280',
                      }}
                    >
                      <span>
                        Posledni sync: {formatSyncDate(link.last_sync)}
                      </span>
                      {link.position_count != null && (
                        <span
                          style={{
                            fontWeight: 600,
                            color: '#374151',
                            background: '#f3f4f6',
                            padding: '2px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {link.position_count} polozek
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpen(link)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          border: `1px solid ${meta.color}`,
                          color: '#fff',
                          background: meta.color,
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.opacity = '0.85';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.opacity = '1';
                        }}
                      >
                        <ExternalLink style={{ width: '13px', height: '13px' }} />
                        Otevrit
                      </button>

                      <button
                        onClick={() => handleUnlink(link)}
                        disabled={isUnlinking}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          border: '1px solid #e5e5e5',
                          color: isUnlinking ? '#9ca3af' : '#6b7280',
                          background: '#f8f8f8',
                          cursor: isUnlinking ? 'wait' : 'pointer',
                          transition: 'color 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isUnlinking) {
                            (e.currentTarget as HTMLElement).style.color = '#dc2626';
                            (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5';
                          }
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color = '#6b7280';
                          (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5';
                        }}
                      >
                        {isUnlinking ? (
                          <Loader
                            style={{
                              width: '13px',
                              height: '13px',
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                        ) : (
                          <Unlink style={{ width: '13px', height: '13px' }} />
                        )}
                        Odpojit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
