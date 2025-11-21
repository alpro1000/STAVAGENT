/**
 * SnapshotBadge - Display active snapshot info
 */

import { useAppContext } from '../context/AppContext';
import { snapshotsAPI } from '../services/api';

export default function SnapshotBadge() {
  const { activeSnapshot, setActiveSnapshot, selectedBridge } = useAppContext();

  if (!activeSnapshot) return null;

  const handleUnlock = async () => {
    if (!selectedBridge || !activeSnapshot) return;

    const confirmed = window.confirm(
      `🔓 Odemknout snapshot?\n\n` +
      `Snapshot: ${activeSnapshot.snapshot_name || activeSnapshot.id}\n` +
      `Vytvořen: ${new Date(activeSnapshot.created_at).toLocaleString('cs-CZ')}\n\n` +
      `Data budou znovu editovatelná. Pokračovat?`
    );

    if (!confirmed) return;

    try {
      await snapshotsAPI.unlock(activeSnapshot.id, 'Manuální odemčení uživatelem');

      // Refresh active snapshot
      const updatedSnapshot = await snapshotsAPI.getActive(selectedBridge);

      if (updatedSnapshot && updatedSnapshot.is_locked) {
        setActiveSnapshot({
          id: updatedSnapshot.id,
          snapshot_name: updatedSnapshot.snapshot_name,
          created_at: updatedSnapshot.created_at,
          is_locked: updatedSnapshot.is_locked
        });
      } else {
        setActiveSnapshot(null);
      }

      alert('✅ Snapshot odemčen! Data jsou znovu editovatelná.');

      // Refresh page to reload data
      window.location.reload();
    } catch (error) {
      console.error('Failed to unlock snapshot:', error);
      alert('❌ Chyba při odemykání snapshotu');
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

  return (
    <div className="snapshot-badge-container">
      <div className="snapshot-badge">
        <div className="snapshot-icon">🔒</div>

        <div className="snapshot-info">
          <div className="snapshot-title">
            {activeSnapshot.snapshot_name || `Snapshot #${activeSnapshot.id.substring(0, 8)}`}
          </div>
          <div className="snapshot-date">
            Zafixováno: {formatDate(activeSnapshot.created_at)}
          </div>
        </div>

        <button
          className="snapshot-unlock-btn"
          onClick={handleUnlock}
          title="Odemknout snapshot a povolit úpravy"
        >
          🔓 Odemknout
        </button>
      </div>

      <div className="snapshot-message">
        ℹ️ Data jsou zafixována a nelze je upravovat. Pro editaci odemkněte snapshot.
      </div>
    </div>
  );
}
