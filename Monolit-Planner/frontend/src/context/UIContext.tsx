/**
 * UIContext — Pure UI state (no server data).
 *
 * Wraps ALL routes so navigation between Part A and Part B
 * doesn't destroy state. Server data lives in React Query.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface UIContextType {
  /** Currently selected project (object) ID — maps to bridge_id in API */
  selectedProjectId: string | null;
  selectProject: (id: string | null) => void;

  /** Sidebar visibility */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  /** "Jen problémy" filter */
  showOnlyRFI: boolean;
  setShowOnlyRFI: (show: boolean) => void;

  /** "Jen monolity" filter — keeps only elements with a beton subtype
   *  (i.e. positions where Vypočítat is shown) and OTSKP codes for
   *  monolitické práce (HSV 2xx, 3xx, 4xx). */
  showOnlyMonolity: boolean;
  setShowOnlyMonolity: (show: boolean) => void;

  /** Days per month mode (22 or 30) */
  daysPerMonth: 30 | 22;
  setDaysPerMonth: (d: 30 | 22) => void;

  /** Active snapshot (locks editing) */
  activeSnapshot: ActiveSnapshot | null;
  setActiveSnapshot: (s: ActiveSnapshot | null) => void;
}

interface ActiveSnapshot {
  id: string;
  snapshot_name?: string;
  created_at: string;
  is_locked: boolean;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

const SIDEBAR_KEY = 'monolit-sidebar-open';
const SIDEBAR_WIDTH_KEY = 'monolit-sidebar-width';

export function UIProvider({ children }: { children: ReactNode }) {
  // Selected project — read initial value from URL ?bridge= param
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('bridge') || params.get('project') || params.get('project_id') || null;
  });

  // Sidebar — read initial from localStorage
  const [sidebarOpen, setSidebarOpenRaw] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) return stored === 'true';
    return window.innerWidth >= 1280;
  });

  const [showOnlyRFI, setShowOnlyRFI] = useState(false);
  const [showOnlyMonolity, setShowOnlyMonolity] = useState(false);
  const [daysPerMonth, setDaysPerMonth] = useState<30 | 22>(30);
  const [activeSnapshot, setActiveSnapshot] = useState<ActiveSnapshot | null>(null);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenRaw(open);
    localStorage.setItem(SIDEBAR_KEY, String(open));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpenRaw(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);

  const selectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
  }, []);

  return (
    <UIContext.Provider value={{
      selectedProjectId,
      selectProject,
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      showOnlyRFI,
      setShowOnlyRFI,
      showOnlyMonolity,
      setShowOnlyMonolity,
      daysPerMonth,
      setDaysPerMonth,
      activeSnapshot,
      setActiveSnapshot,
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}

export { SIDEBAR_WIDTH_KEY };
