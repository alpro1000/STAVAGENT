import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

// Design System — Flat Design (new)
import './styles/flat-design.css';

// Legacy styles for Part B (PlannerPage) — keep until Part B is migrated
import './styles/design-system/tokens.css';
import './styles/design-system/components.css';
import './styles/global.css';
import './styles/slate-table.css';

// Build timestamp for cache debugging (injected by Vite)
declare const __BUILD_TIMESTAMP__: string;
if (import.meta.env.DEV) {
  console.log(`[Monolit Planner] Build: ${typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'dev'}`);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
