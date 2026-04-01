/**
 * HistoryModal - Display snapshot history with timeline
 */

import { useState, useEffect } from 'react';
import { Trash2, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { snapshotsAPI } from '../services/api';
import { SnapshotListItem } from '@stavagent/monolit-shared';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const { selectedBridge } = useAppContext();
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && selectedBridge) {
      loadSnapshots();
    }
  }, [isOpen, selectedBridge]);

  const loadSnapshots = async () => {
    if (!selectedBridge) return;

    setLoading(true);
    try {
      const data = await snapshotsAPI.list(selectedBridge);
      setSnapshots(data);
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      alert('❌ Chyba při načítání historie');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (snapshotId: string, snapshotName?: string) => {
    const confirmed = window.confirm(
      `🔄 Obnovit snapshot?\n\n` +
      `Snapshot: ${snapshotName || snapshotId}\n\n` +
      `Všechna aktuální data budou nahrazena daty z tohoto snapshotu.\n` +
      `Pokračovat?`
    );

    if (!confirmed) return;

    try {
      await snapshotsAPI.restore(snapshotId);
      alert('✅ Snapshot obnoven! Obnovuje se stránka...');
      window.location.reload();
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      alert('❌ Chyba při obnovování snapshotu');
    }
  };

  const handleDelete = async (snapshotId: string, snapshotName?: string) => {
    const confirmed = window.confirm(
      `🗑️ Smazat snapshot?\n\n` +
      `Snapshot: ${snapshotName || snapshotId}\n\n` +
      `Tato akce je nevratná. Pokračovat?`
    );

    if (!confirmed) return;

    try {
      await snapshotsAPI.delete(snapshotId);
      alert('✅ Snapshot smazán!');
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      alert('❌ Chyba při mazání snapshotu');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num: number) => {
    return num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const formatDelta = (delta: number | null | undefined) => {
    if (!delta || delta === 0) return null;
    const sign = delta > 0 ? '+' : '';
    const color = delta > 0 ? 'var(--accent-success)' : 'var(--accent-secondary)';
    return (
      <span style={{ color, fontWeight: 600 }}>
        {sign}{formatNumber(delta)} CZK
      </span>
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = ''; };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Historie Snapshots">
      <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Historie Snapshots</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="history-loading">
              <div className="spinner"></div>
              <p>Načítání historie...</p>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon">📭</div>
              <p>Žádné snapshots</p>
              <p className="text-muted">Vytvořte první snapshot tlačítkem "🔒 Zafixovat"</p>
            </div>
          ) : (
            <div className="history-timeline">
              {snapshots.map((snapshot, index) => (
                <div key={snapshot.snapshot_id} className="timeline-item">
                  <div className="timeline-marker">
                    {snapshot.is_locked ? '🔒' : '🔓'}
                  </div>

                  <div className="timeline-content">
                    <div className="snapshot-item">
                      <div className="snapshot-item-header">
                        <div className="snapshot-item-title">
                          <strong>{snapshot.snapshot_name || `Snapshot #${index + 1}`}</strong>
                          {snapshot.is_locked && (
                            <span className="snapshot-locked-badge">LOCKED</span>
                          )}
                        </div>
                        <div className="snapshot-item-date">
                          {formatDate(snapshot.created_at)}
                        </div>
                      </div>

                      <div className="snapshot-item-info">
                        <div className="snapshot-stat">
                          <span className="stat-label">Suma KROS:</span>
                          <span className="stat-value">{formatNumber(snapshot.sum_kros_at_lock)} CZK</span>
                        </div>

                        {snapshot.delta_to_previous !== null && snapshot.delta_to_previous !== 0 && (
                          <div className="snapshot-stat">
                            <span className="stat-label">Delta:</span>
                            <span className="stat-value">{formatDelta(snapshot.delta_to_previous)}</span>
                          </div>
                        )}

                        {snapshot.created_by && (
                          <div className="snapshot-stat">
                            <span className="stat-label">Vytvořil:</span>
                            <span className="stat-value">{snapshot.created_by}</span>
                          </div>
                        )}
                      </div>

                      {snapshot.description && (
                        <div className="snapshot-description">
                          {snapshot.description}
                        </div>
                      )}

                      <div className="snapshot-actions">
                        <button
                          className="snapshot-action-btn btn-restore"
                          onClick={() => handleRestore(snapshot.snapshot_id, snapshot.snapshot_name)}
                          title="Obnovit data z tohoto snapshotu"
                        >
                          🔄 Obnovit
                        </button>

                        {!snapshot.is_locked && (
                          <button
                            className="snapshot-action-btn btn-danger"
                            onClick={() => handleDelete(snapshot.snapshot_id, snapshot.snapshot_name)}
                            title="Smazat tento snapshot"
                          >
                            <Trash2 size={14} className="inline" /> Smazat
                          </button>
                        )}

                        <button
                          className="snapshot-action-btn btn-info"
                          onClick={() => alert(JSON.stringify(snapshot, null, 2))}
                          title="Zobrazit detaily"
                        >
                          <Info size={14} className="inline" /> Info
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="modal-footer-text">
            Celkem snapshots: <strong>{snapshots.length}</strong>
            {snapshots.filter(s => s.is_locked).length > 0 && (
              <> | Locked: <strong>{snapshots.filter(s => s.is_locked).length}</strong></>
            )}
          </p>
          <button className="btn-secondary" onClick={onClose}>
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
