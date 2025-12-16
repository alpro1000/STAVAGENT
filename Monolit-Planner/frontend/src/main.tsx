import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/global.css';

// Build timestamp for cache debugging (injected by Vite)
declare const __BUILD_TIMESTAMP__: string;
console.log(`[Monolit Planner] Build: ${typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'dev'}`);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false, // CRITICAL: Never refetch on mount
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes - no refetch unless stale
      gcTime: 10 * 60 * 1000 // 10 minutes - keep unused data in cache before garbage collection
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
