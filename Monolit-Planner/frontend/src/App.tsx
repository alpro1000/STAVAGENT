/**
 * Main Application Entry Point — Flat Design Rewrite
 *
 * Single UIProvider wraps ALL routes so state persists across navigation.
 * Part B (PlannerPage) works standalone — doesn't need UIProvider but
 * benefits from it being available (shared QueryClient, persistent selection).
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UIProvider } from './context/UIContext';
import FlatMainPage from './components/flat/FlatMainPage';
import PlannerPage from './pages/PlannerPage';

function App() {
  return (
    <UIProvider>
      <BrowserRouter>
        <Routes>
          {/* Part A: Main page (new flat design) */}
          <Route path="/" element={<FlatMainPage />} />

          {/* Part B: Element Planning Orchestrator (UNCHANGED) */}
          <Route path="/planner" element={<PlannerPage />} />
        </Routes>
      </BrowserRouter>
    </UIProvider>
  );
}

export default App;
