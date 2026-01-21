/**
 * Main Application Entry Point
 * Clean calculator app without authentication
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './context/AppContext';
import MainApp from './components/MainApp';
import R0App from './components/r0/R0App';
import './styles/components.css';

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Main calculator application */}
          <Route
            path="/"
            element={
              <AppProvider>
                <MainApp />
              </AppProvider>
            }
          />
          {/* R0 Deterministic Core */}
          <Route
            path="/r0/*"
            element={<R0App />}
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
