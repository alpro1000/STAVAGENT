import React, { Suspense } from 'react';
import ChatPage from './pages/ChatPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import './styles/globals.css';

function LoadingFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-4xl mb-3">⏳</div>
        <p className="text-gray-600">Načítání Stav Agent...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary resetError={() => window.location.reload()}>
      <Suspense fallback={<LoadingFallback />}>
        <ChatPage />
      </Suspense>
    </ErrorBoundary>
  );
}
