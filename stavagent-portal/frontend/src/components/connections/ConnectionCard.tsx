import type { ServiceConnection, ConnectionStatus } from '../../types/connection';
import { SERVICE_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '../../types/connection';
import ConnectionTestButton from './ConnectionTestButton';

interface Props {
  connection: ServiceConnection;
  onEdit: (connection: ServiceConnection) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ConnectionStatus) => void;
}

export default function ConnectionCard({ connection, onEdit, onDelete, onStatusChange }: Props) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      {/* Service icon placeholder */}
      <div style={{
        width: 40, height: 40, borderRadius: 8, background: '#f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {connection.service_type === 'gemini' ? 'G' :
         connection.service_type === 'openai' ? 'O' :
         connection.service_type === 'anthropic' ? 'A' :
         connection.service_type === 'perplexity' ? 'P' :
         connection.service_type.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
          {connection.display_name || SERVICE_TYPE_LABELS[connection.service_type]}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
          {SERVICE_TYPE_LABELS[connection.service_type]}
          {connection.last_tested_at && (
            <span> · Testováno {new Date(connection.last_tested_at).toLocaleDateString('cs-CZ')}</span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
        background: STATUS_COLORS[connection.status] + '18',
        color: STATUS_COLORS[connection.status],
      }}>
        {STATUS_LABELS[connection.status]}
      </div>

      {/* Actions */}
      <ConnectionTestButton
        connectionId={connection.id}
        onTestComplete={(status, _msg) => onStatusChange(connection.id, status)}
      />

      <button
        onClick={() => onEdit(connection)}
        style={{
          padding: '6px 12px', fontSize: 13, border: '1px solid #d1d5db',
          borderRadius: 6, cursor: 'pointer', background: '#fff', color: '#374151',
        }}
      >
        Upravit
      </button>

      <button
        onClick={() => onDelete(connection.id)}
        style={{
          padding: '6px 12px', fontSize: 13, border: '1px solid #fecaca',
          borderRadius: 6, cursor: 'pointer', background: '#fff', color: '#ef4444',
        }}
      >
        Smazat
      </button>
    </div>
  );
}
