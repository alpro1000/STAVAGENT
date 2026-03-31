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
import PortalBreadcrumb from './PortalBreadcrumb';
import PortalImportModal from './PortalImportModal';
import type { PortalData } from './PortalImportModal';
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

  // Deep-link: read ?project=X&part=Y&position_instance_id=Z&auth_token=T URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deepLinkProject = params.get('project') || params.get('project_id');
    const deepLinkPart = params.get('part');
    const deepLinkInstanceId = params.get('position_instance_id');

    // Store auth_token from Portal (for account isolation)
    const authToken = params.get('auth_token');
    if (authToken) {
      localStorage.setItem('auth_token', authToken);
    }

    if (!deepLinkProject) return;

    // Clean URL params immediately
    window.history.replaceState({}, '', window.location.pathname);

    // Select the project (bridge)
    const bridge = bridges.find(b => b.bridge_id === deepLinkProject);
    if (bridge) {
      setSelectedBridge(deepLinkProject);

      // Scroll to specific position by position_instance_id
      if (deepLinkInstanceId) {
        setTimeout(() => {
          const posEl = document.querySelector(`[data-position-instance-id="${deepLinkInstanceId}"]`) as HTMLElement;
          if (posEl) {
            posEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            posEl.style.outline = '3px solid var(--accent-orange, #FF9F1C)';
            posEl.style.outlineOffset = '2px';
            setTimeout(() => {
              posEl.style.outline = '';
              posEl.style.outlineOffset = '';
            }, 3000);
          }
        }, 500);
      }
      // Scroll to part
      else if (deepLinkPart) {
        setTimeout(() => {
          const partEl = document.getElementById(`part-${deepLinkPart}`);
          if (partEl) {
            partEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Brief highlight effect
            partEl.style.outline = '3px solid var(--accent-orange, #FF9F1C)';
            partEl.style.outlineOffset = '2px';
            setTimeout(() => {
              partEl.style.outline = '';
              partEl.style.outlineOffset = '';
            }, 3000);
          }
        }, 500);
      }
    }
  }, [bridges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Portal import: read ?portal_file_id=&portal_api= URL params on load ──
  const [portalImportData, setPortalImportData] = useState<PortalData | null>(null);
  const [portalImporting, setPortalImporting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const portalFileId = params.get('portal_file_id');
    const portalApi = params.get('portal_api');

    if (!portalFileId || !portalApi) return;

    // Clean URL params immediately so refresh doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    // Fetch preview data and show confirmation modal
    (async () => {
      try {
        const resp = await fetch(
          `${portalApi}/api/portal-files/${portalFileId}/parsed-data/for-kiosk/monolit`
        );
        if (!resp.ok) throw new Error(`Portal fetch failed: ${resp.status}`);
        const data = await resp.json();

        if (!data.success || !data.sheets?.length) {
          alert('Portal vrátil prázdná data. Ujistěte se, že soubor byl nejdříve zparsován.');
          return;
        }

        setPortalImportData(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Import z Portal selhal: ${message}`);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePortalImportConfirm = async () => {
    if (!portalImportData) return;
    setPortalImporting(true);

    try {
      const data = portalImportData;
      const bridgeId = `portal-${data.file_id.slice(0, 8)}`;
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
        alert('V souboru nebyly nalezeny žádné betonové pozice pro Monolit.');
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

      // Update bridges context + React Query cache immediately
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

      setPortalImportData(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Import z Portal selhal: ${message}`);
    } finally {
      setPortalImporting(false);
    }
  };

  return (
    <div className="app">
      <PortalBreadcrumb />
      <Header
        isDark={isDark}
        toggleTheme={toggleTheme}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className={`main-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        <main className={`content ${sidebarOpen ? 'with-sidebar' : ''}`}>
          <KPIPanel />
          <PositionsTable />
        </main>
      </div>

      {/* Portal Import Confirmation Modal */}
      {portalImportData && (
        <PortalImportModal
          data={portalImportData}
          onConfirm={handlePortalImportConfirm}
          onCancel={() => setPortalImportData(null)}
          importing={portalImporting}
        />
      )}
    </div>
  );
}
