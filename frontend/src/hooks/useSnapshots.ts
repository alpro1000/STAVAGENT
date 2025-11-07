/**
 * useSnapshots - Hook for managing snapshots
 */

import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { snapshotsAPI } from '../services/api';

export function useSnapshots(bridgeId: string | null) {
  const { activeSnapshot, setActiveSnapshot } = useAppContext();

  // Load active snapshot when bridge changes
  useEffect(() => {
    if (!bridgeId) {
      setActiveSnapshot(null);
      return;
    }

    const loadActiveSnapshot = async () => {
      try {
        const data = await snapshotsAPI.getActive(bridgeId);

        if (data && data.id) {
          setActiveSnapshot({
            id: data.id,
            snapshot_name: data.snapshot_name,
            created_at: data.created_at,
            is_locked: data.is_locked
          });
        } else {
          setActiveSnapshot(null);
        }
      } catch (error) {
        console.error('Failed to load active snapshot:', error);
        setActiveSnapshot(null);
      }
    };

    loadActiveSnapshot();
  }, [bridgeId, setActiveSnapshot]);

  return {
    activeSnapshot,
    isLocked: activeSnapshot?.is_locked ?? false
  };
}
