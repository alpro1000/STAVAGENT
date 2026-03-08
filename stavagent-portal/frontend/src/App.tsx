/**
 * StavAgent Portal - Main Application Entry Point
 * Portal-only version (Kiosk calculator moved to kiosk-monolit repo)
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminDashboard from './pages/AdminDashboard';
import DocumentUploadPage from './pages/DocumentUploadPage';
import PortalPage from './pages/PortalPage';
import PumpCalculatorPage from './pages/PumpCalculatorPage';
import PriceParserPage from './pages/PriceParserPage';
import BetonarnyPage from './pages/BetonarnyPage';
import ObjednavkaBetonuPage from './pages/ObjednavkaBetonuPage';
import LandingPage from './pages/LandingPage';
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
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Public landing page */}
            <Route path="/" element={<LandingPage />} />

            {/* Portal - public (no auth required) */}
            <Route path="/portal" element={<PortalPage />} />

            {/* Unified concrete order: search plants + calculate + compare (no auth) */}
            <Route path="/objednavka-betonu" element={<ObjednavkaBetonuPage />} />

            {/* Pump Calculator - standalone, mobile-first (no auth) */}
            <Route path="/pump" element={<PumpCalculatorPage />} />

            {/* Price Parser - admin tool: upload supplier PDF price lists (no auth) */}
            <Route path="/price-parser" element={<PriceParserPage />} />

            {/* Betonárny — redirects to unified page */}
            <Route path="/betonarny" element={<Navigate to="/objednavka-betonu" replace />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/projects/:projectId/upload-document" element={<ProtectedRoute><DocumentUploadPage /></ProtectedRoute>} />

            {/* Catch-all → landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
