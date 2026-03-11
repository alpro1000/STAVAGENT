import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
// Global styles (base reset - loaded FIRST)
import './styles/global.css';
// Digital Concrete Design System (overrides global - loaded LAST for priority)
import './styles/design-system/tokens.css';
import './styles/design-system/components.css';

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
