/**
 * Main Application Component
 * Contains the main UI after authentication
 */

import { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import KPIPanel from './KPIPanel';
import PositionsTable from './PositionsTable';
import { useDarkMode } from '../hooks/useDarkMode';

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
