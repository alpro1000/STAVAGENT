import { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import KPIPanel from './components/KPIPanel';
import PositionsTable from './components/PositionsTable';
import { AppProvider } from './context/AppContext';
import { useDarkMode } from './hooks/useDarkMode';
import './styles/components.css';

const SIDEBAR_STORAGE_KEY = 'monolit-sidebar-open';

function App() {
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
    <AppProvider>
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
    </AppProvider>
  );
}

export default App;
