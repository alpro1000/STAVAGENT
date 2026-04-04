/**
 * FlatSnapshots — Snapshot save/restore panel.
 *
 * Uses existing snapshot API endpoints.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Trash2, Lock, Unlock } from 'lucide-react';
import { snapshotsAPI } from '../../services/api';
import { useUI } from '../../context/UIContext';
import { useProjectPositions } from '../../hooks/useProjectPositions';

export default function FlatSnapshots() {
  const { selectedProjectId, activeSnapshot, setActiveSnapshot } = useUI();
  const { positions, headerKPI } = useProjectPositions();
  const qc = useQueryClient();
  const [saveName, setSaveName] = useState('');

  const { data: snapshots = [] } = useQuery({
    queryKey: ['snapshots', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      try {
        return await snapshotsAPI.list(selectedProjectId);
      } catch {
        return []; // Graceful: empty list if snapshots API fails
      }
    },
    enabled: !!selectedProjectId,
    staleTime: 60_000,
    retry: false, // Don't retry on 500 — avoids console spam
  });

  // Check active snapshot
  useQuery({
    queryKey: ['snapshots-active', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      try {
        const data = await snapshotsAPI.getActive(selectedProjectId);
        if (data?.is_locked) setActiveSnapshot(data);
        else setActiveSnapshot(null);
        return data;
      } catch {
        setActiveSnapshot(null);
        return null;
      }
    },
    enabled: !!selectedProjectId,
    staleTime: 60_000,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedProjectId || !headerKPI) throw new Error('No data');
      return snapshotsAPI.create({
        bridge_id: selectedProjectId,
        positions,
        header_kpi: headerKPI,
        snapshot_name: saveName || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots', selectedProjectId] });
      qc.invalidateQueries({ queryKey: ['snapshots-active', selectedProjectId] });
      setSaveName('');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (snapshotId: string) => snapshotsAPI.restore(snapshotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions', selectedProjectId] });
      qc.invalidateQueries({ queryKey: ['snapshots', selectedProjectId] });
      qc.invalidateQueries({ queryKey: ['snapshots-active', selectedProjectId] });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (snapshotId: string) => snapshotsAPI.unlock(snapshotId, 'User unlock'),
    onSuccess: () => {
      setActiveSnapshot(null);
      qc.invalidateQueries({ queryKey: ['snapshots-active', selectedProjectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (snapshotId: string) => snapshotsAPI.delete(snapshotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots', selectedProjectId] });
    },
  });

  if (!selectedProjectId) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--flat-text-label)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Snapshoty
      </h4>

      {/* Active snapshot warning */}
      {activeSnapshot?.is_locked && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', marginBottom: 8,
          background: 'var(--yellow-100)', borderRadius: 6, fontSize: 13,
        }}>
          <Lock size={14} />
          <span>Zamčeno: {activeSnapshot.snapshot_name || 'Bez názvu'}</span>
          <button
            className="flat-btn flat-btn--sm"
            onClick={() => unlockMutation.mutate(activeSnapshot.id)}
            style={{ marginLeft: 'auto' }}
          >
            <Unlock size={12} /> Odemknout
          </button>
        </div>
      )}

      {/* Save new snapshot */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          className="flat-field__input"
          style={{ flex: 1, height: 32, fontSize: 13 }}
          placeholder="Název snapshotu..."
          value={saveName}
          onChange={e => setSaveName(e.target.value)}
        />
        <button
          className="flat-btn flat-btn--sm flat-btn--primary"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !positions.length}
        >
          <Save size={12} /> Uložit stav
        </button>
      </div>

      {/* Snapshot list */}
      {snapshots.length > 0 && (
        <div style={{ border: '1px solid var(--flat-border)', borderRadius: 6, overflow: 'hidden' }}>
          {snapshots.map((snap: any) => (
            <div key={snap.snapshot_id || snap.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderBottom: '1px solid var(--flat-border)',
              fontSize: 12,
            }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {snap.snapshot_name || snap.description || 'Bez názvu'}
              </span>
              <span style={{ color: 'var(--flat-text-secondary)', fontSize: 11, flexShrink: 0 }}>
                {snap.created_at ? new Date(snap.created_at).toLocaleDateString('cs-CZ') : ''}
              </span>
              <button
                className="flat-icon-btn flat-icon-btn--accent"
                onClick={() => restoreMutation.mutate(snap.snapshot_id || snap.id)}
                title="Obnovit"
              >
                <RotateCcw size={12} />
              </button>
              <button
                className="flat-icon-btn flat-icon-btn--danger"
                onClick={() => {
                  if (confirm('Smazat snapshot?')) deleteMutation.mutate(snap.snapshot_id || snap.id);
                }}
                title="Smazat"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
