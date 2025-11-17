/**
 * useCreateSnapshot - Hook for creating snapshots with all logic
 */

import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePositions } from './usePositions';
import { useSnapshots } from './useSnapshots';
import { snapshotsAPI } from '../services/api';

export function useCreateSnapshot() {
  const { selectedBridge, positions, headerKPI } = useAppContext();
  const { refetch: refetchPositions } = usePositions(selectedBridge);
  const { refetchActiveSnapshot } = useSnapshots(selectedBridge);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSnapshot = async () => {
    if (!selectedBridge || !positions.length || !headerKPI) {
      alert('Nejdříve vyberte most s pozicemi');
      return;
    }

    // CRITICAL VALIDATION: Check for missing concrete volume and RFI warnings
    const rfiIssues = positions.filter(p => p.has_rfi);
    const hasNoConcrete = headerKPI.sum_concrete_m3 === 0 || headerKPI.sum_concrete_m3 === undefined;

    if (hasNoConcrete || rfiIssues.length > 0) {
      let warningMessage = '⚠️ UPOZORNĚNÍ: Projekt má problémy!\n\n';

      if (hasNoConcrete) {
        warningMessage += '❌ Chybí objem betonu!\n   Zadejte "Objem betonu celkem" v PartHeader.\n\n';
      }

      if (rfiIssues.length > 0) {
        warningMessage += `⚠️ Nalezeno ${rfiIssues.length} RFI problém(ů):\n`;
        rfiIssues.slice(0, 3).forEach(p => {
          warningMessage += `   • ${p.subtype}: ${p.rfi_message || 'Problem'}\n`;
        });
        if (rfiIssues.length > 3) {
          warningMessage += `   ... a další ${rfiIssues.length - 3}\n\n`;
        } else {
          warningMessage += '\n';
        }
      }

      warningMessage += 'Chcete přesto pokračovat a zafixovat data?\n(Later můžete vytvořit nový snapshot s opravami)';

      const confirmWithWarnings = window.confirm(warningMessage);
      if (!confirmWithWarnings) return;
    }

    const confirmCreate = window.confirm(
      'Zafixovat aktuální stav?\n\nVšechna pole budou uzamčena a nelze je upravovat.\n\nChcete pokračovat?'
    );

    if (!confirmCreate) return;

    setIsCreating(true);

    try {
      await snapshotsAPI.create({
        bridge_id: selectedBridge,
        positions,
        header_kpi: headerKPI,
        description: 'Snapshot vytvořen',
        snapshot_name: `Snapshot ${new Date().toLocaleString('cs-CZ')}`
      });

      alert('✅ Snapshot vytvořen! Data jsou nyní zafixována.');

      // Refetch positions and active snapshot to reflect lock state
      await Promise.all([
        refetchPositions(),
        refetchActiveSnapshot()
      ]);
    } catch (error: any) {
      console.error('Error creating snapshot:', error);
      alert(`Chyba při vytváření snapshot: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return {
    handleCreateSnapshot,
    isCreating
  };
}
