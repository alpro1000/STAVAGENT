/**
 * Main Application Component
 * Contains the main UI after authentication
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Header from './Header';
import Sidebar from './Sidebar';
import KPIPanel from './KPIPanel';
import PositionsTable from './PositionsTable';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAppContext } from '../context/AppContext';
import { API_URL } from '../services/api';

const SIDEBAR_STORAGE_KEY = 'monolit-sidebar-open';

export default function MainApp() {
  // Initialize from localStorage with smart defaults
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    // Smart default: collapsed on screens < 1280px
    return window.innerWidth >= 1280;
  });

  const { isDark, toggleTheme } = useDarkMode();
  const { bridges, setBridges, setSelectedBridge } = useAppContext();
  const queryClient = useQueryClient();

  // Persist to localStorage whenever sidebarOpen changes
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  // Keyboard shortcut: Ctrl+B / Cmd+B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Portal import: read ?portal_file_id=&portal_api= URL params on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const portalFileId = params.get('portal_file_id');
    const portalApi = params.get('portal_api');

    if (!portalFileId || !portalApi) return;

    // Clean URL params immediately so refresh doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    const loadFromPortal = async () => {
      try {
        const resp = await fetch(
          `${portalApi}/api/portal-files/${portalFileId}/parsed-data/for-kiosk/monolit`
        );
        if (!resp.ok) throw new Error(`Portal fetch failed: ${resp.status}`);
        const data = await resp.json();

        if (!data.success || !data.sheets?.length) {
          alert('❌ Portal vrátil prázdná data. Ujistěte se, že soubor byl nejdříve zparsován.');
          return;
        }

        const bridgeId = `portal-${portalFileId.slice(0, 8)}`;
        const bridgeName = data.file_name?.replace(/\.[^.]+$/, '') || 'Import z Portal';

        // Create bridge (ignore "already exists" — idempotent)
        const bridgeResp = await fetch(`${API_URL}/api/bridges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bridge_id: bridgeId, project_name: bridgeName, object_name: bridgeName }),
        });
        if (!bridgeResp.ok) {
          const err = await bridgeResp.json();
          if (!err.error?.includes('already exists')) throw new Error(err.error || 'Failed to create bridge');
        }

        // Map Portal items → Monolit positions
        const positions: Record<string, unknown>[] = [];
        for (const sheet of data.sheets) {
          for (const item of sheet.items) {
            positions.push({
              part_name: sheet.name || 'Import',
              item_name: item.popis || item.kod || 'Položka',
              subtype: item.detectedType || 'jine',
              unit: item.mj || 'm3',
              qty: typeof item.mnozstvi === 'number' ? item.mnozstvi : 0,
              crew_size: 4,
              wage_czk_ph: 398,
              shift_hours: 10,
              days: 0,
              otskp_code: item.kod || null,
            });
          }
        }

        if (positions.length === 0) {
          alert('❌ V souboru nebyly nalezeny žádné betonové pozice (beton / bednění / výztuž) pro Monolit.');
          return;
        }

        const posResp = await fetch(`${API_URL}/api/positions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bridge_id: bridgeId, positions }),
        });
        if (!posResp.ok) {
          const err = await posResp.json();
          throw new Error(err.error || 'Failed to create positions');
        }

        // Update bridges context + React Query cache immediately (no refetch race)
        const newBridge = {
          bridge_id: bridgeId,
          project_name: bridgeName,
          object_name: bridgeName,
          element_count: positions.length,
          concrete_m3: 0,
          sum_kros_czk: 0,
          status: 'active' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setBridges((prev) => {
          const existingIds = new Set(prev.map(b => b.bridge_id));
          return existingIds.has(bridgeId) ? prev : [...prev, newBridge];
        });
        queryClient.setQueryData(['bridges'], (old: typeof bridges) => {
          if (!old) return [newBridge];
          const existingIds = new Set(old.map(b => b.bridge_id));
          return existingIds.has(bridgeId) ? old : [...old, newBridge];
        });
        setSelectedBridge(bridgeId);
        queryClient.invalidateQueries({ queryKey: ['positions'] });

        alert(`✅ Import z Portal úspěšný! Načteno ${positions.length} pozic z "${bridgeName}".`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`❌ Import z Portal selhal: ${message}`);
      }
    };

    loadFromPortal();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <Header
        isDark={isDark}
        toggleTheme={toggleTheme}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className={`main-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        <main className={`content ${sidebarOpen ? 'with-sidebar' : ''}`}>
          <KPIPanel />
          <PositionsTable />
        </main>
      </div>
    </div>
  );
}
