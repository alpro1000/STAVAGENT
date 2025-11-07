import Header from './components/Header';
import Sidebar from './components/Sidebar';
import KPIPanel from './components/KPIPanel';
import PositionsTable from './components/PositionsTable';
import { AppProvider } from './context/AppContext';
import './styles/components.css';

function App() {
  return (
    <AppProvider>
      <div className="app">
        <Header />

        <div className="main-layout">
          <Sidebar />

          <main className="content">
            <KPIPanel />
            <PositionsTable />
          </main>
        </div>
      </div>
    </AppProvider>
  );
}

export default App;
