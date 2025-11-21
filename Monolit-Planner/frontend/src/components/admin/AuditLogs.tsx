/**
 * Audit Logs Component
 * View and filter audit logs
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

interface AuditLog {
  id: string;
  admin_id: number;
  action: string;
  data: any;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);

  useEffect(() => {
    loadLogs();
    loadActions();
  }, [filterAction, limit, offset]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAuditLogs({
        action: filterAction || undefined,
        limit,
        offset
      });
      setLogs(response.data || []);
      setTotal(response.pagination?.total || 0);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Chyba při načítání auditních logů');
    } finally {
      setLoading(false);
    }
  };

  const loadActions = async () => {
    try {
      const response = await adminAPI.getAuditStats();
      const actionList = response.data?.actions_breakdown?.map((a: any) => a.action) || [];
      setActions(actionList);
    } catch (err) {
      // Ignore errors for stats
    }
  };

  const getActionBadge = (action: string) => {
    const colorMap: { [key: string]: string } = {
      'VIEW_USERS_LIST': '#bee3f8',
      'VIEW_USER_DETAILS': '#bee3f8',
      'UPDATE_USER': '#feebc8',
      'DELETE_USER': '#fed7d7',
      'VIEW_AUDIT_LOGS': '#bee3f8',
      'VIEW_ADMIN_STATS': '#bee3f8'
    };

    const textColorMap: { [key: string]: string } = {
      'VIEW_USERS_LIST': '#2c5282',
      'VIEW_USER_DETAILS': '#2c5282',
      'UPDATE_USER': '#7c2d12',
      'DELETE_USER': '#742a2a',
      'VIEW_AUDIT_LOGS': '#2c5282',
      'VIEW_ADMIN_STATS': '#2c5282'
    };

    return {
      bg: colorMap[action] || '#e2e8f0',
      color: textColorMap[action] || '#2d3748'
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ') + ' ' + date.toLocaleTimeString('cs-CZ');
  };

  const pages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Filters */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <label style={{ fontSize: '13px', fontWeight: '500' }}>Filtr:</label>
        <select
          value={filterAction}
          onChange={e => {
            setFilterAction(e.target.value);
            setOffset(0);
          }}
          style={{
            padding: '8px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '12px',
            outline: 'none'
          }}
        >
          <option value="">Všechny akce</option>
          {actions.map(action => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>

        <label style={{ fontSize: '13px', fontWeight: '500', marginLeft: 'auto' }}>Počet na stránku:</label>
        <select
          value={limit}
          onChange={e => {
            setLimit(parseInt(e.target.value));
            setOffset(0);
          }}
          style={{
            padding: '8px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '12px',
            outline: 'none'
          }}
        >
          <option value={10}>10</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      {/* Logs List */}
      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#718096' }}>
          Načítání logů...
        </div>
      ) : error ? (
        <div style={{ padding: '20px', color: '#742a2a', background: '#fed7d7' }}>
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#718096' }}>
          Žádné auditní logy
        </div>
      ) : (
        <>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {logs.map(log => {
              const badge = getActionBadge(log.action);
              const isExpanded = expandedLog === log.id;

              return (
                <div key={log.id} style={{
                  borderBottom: '1px solid #edf2f7',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: isExpanded ? '#f7fafc' : 'white',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => {
                  if (!isExpanded) e.currentTarget.style.background = '#f7fafc';
                }}
                onMouseLeave={e => {
                  if (!isExpanded) e.currentTarget.style.background = 'white';
                }}
                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      background: badge.bg,
                      color: badge.color,
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {log.action}
                    </span>
                    <span style={{ fontSize: '11px', color: '#a0aec0' }}>
                      {formatDate(log.created_at)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#718096', marginLeft: 'auto' }}>
                      Admin ID: {log.admin_id}
                    </span>
                  </div>

                  {isExpanded && log.data && Object.keys(log.data).length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#f7fafc',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#718096'
          }}>
            <span>Stránka {currentPage} z {pages} (celkem {total} logů)</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                style={{
                  padding: '6px 12px',
                  background: offset === 0 ? '#e2e8f0' : '#667eea',
                  color: offset === 0 ? '#a0aec0' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: offset === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                Předchozí
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                style={{
                  padding: '6px 12px',
                  background: offset + limit >= total ? '#e2e8f0' : '#667eea',
                  color: offset + limit >= total ? '#a0aec0' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: offset + limit >= total ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                Další
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
