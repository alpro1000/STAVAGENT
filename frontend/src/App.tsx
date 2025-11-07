import { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import KPIPanel from './components/KPIPanel';
import PositionsTable from './components/PositionsTable';
import { AppProvider } from './context/AppContext';
import { useDarkMode } from './hooks/useDarkMode';
import './styles/components.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isDark, toggleTheme } = useDarkMode();

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
