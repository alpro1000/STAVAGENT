/**
 * StavAgent Portal - Main Application Entry Point
 *
 * All pages are lazy-loaded (React.lazy + Suspense) to reduce initial bundle.
 * Only LandingPage and PortalPage are eagerly loaded for fast first paint.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import './styles/components.css';

// ── Eager imports (landing + portal = main entry points) ─────────────────────
import LandingPage from './pages/LandingPage';
import PortalPage from './pages/PortalPage';

// ── Lazy imports (loaded only when navigated to) ─────────────────────────────
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const DocumentUploadPage = lazy(() => import('./pages/DocumentUploadPage'));
const PumpCalculatorPage = lazy(() => import('./pages/PumpCalculatorPage'));
const PriceParserPage = lazy(() => import('./pages/PriceParserPage'));
const ObjednavkaBetonuPage = lazy(() => import('./pages/ObjednavkaBetonuPage'));
const CabinetPage = lazy(() => import('./pages/CabinetPage'));
const CabinetOrgsPage = lazy(() => import('./pages/CabinetOrgsPage'));
const OrgPage = lazy(() => import('./pages/OrgPage'));
const OrgInvitePage = lazy(() => import('./pages/OrgInvitePage'));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'));
const ParsePreviewPage = lazy(() => import('./pages/ParsePreviewPage'));

// ── Loading fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#f8f9fa',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #e5e7eb',
          borderTopColor: '#FF9F1C', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }} />
        <div style={{ fontSize: 14 }}>Načítání...</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ── QueryClient ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verify" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Public landing page (eager) */}
              <Route path="/" element={<LandingPage />} />

              {/* Portal (eager — main hub) */}
              <Route path="/portal" element={<PortalPage />} />

              {/* Unified concrete order: search plants + calculate + compare */}
              <Route path="/objednavka-betonu" element={<ObjednavkaBetonuPage />} />

              {/* Pump Calculator - standalone, mobile-first */}
              <Route path="/pump" element={<PumpCalculatorPage />} />

              {/* Price Parser - admin tool: upload supplier PDF price lists */}
              <Route path="/price-parser" element={<PriceParserPage />} />

              {/* Betonárny — redirects to unified page */}
              <Route path="/betonarny" element={<Navigate to="/objednavka-betonu" replace />} />

              {/* Cabinet — personal profile + orgs (Sprint 1) */}
              <Route path="/cabinet" element={<ProtectedRoute><CabinetPage /></ProtectedRoute>} />
              <Route path="/cabinet/orgs" element={<ProtectedRoute><CabinetOrgsPage /></ProtectedRoute>} />
              <Route path="/cabinet/connections" element={<ProtectedRoute><ConnectionsPage /></ProtectedRoute>} />

              {/* Parse Preview — full-page view of parsed file data */}
              <Route path="/parse-preview/:fileId" element={<ParsePreviewPage />} />

              {/* Org detail (Sprint 1) */}
              <Route path="/org/:id" element={<ProtectedRoute><OrgPage /></ProtectedRoute>} />

              {/* Accept org invite — public (user may not be logged in yet) */}
              <Route path="/org/accept-invite" element={<OrgInvitePage />} />

              {/* Protected routes */}
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/projects/:projectId/upload-document" element={<ProtectedRoute><DocumentUploadPage /></ProtectedRoute>} />

              {/* Catch-all → landing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
