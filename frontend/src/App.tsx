/**
 * Main Application Entry Point
 * Handles routing and authentication
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
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
import MainApp from './components/MainApp';
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
            {/* Login page */}
            <Route path="/login" element={<LoginPage />} />

            {/* Email verification page (public - users click link from email) */}
            <Route path="/verify" element={<VerifyEmailPage />} />

            {/* Forgot password page (public - users request reset) */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Reset password page (public - users click link from email) */}
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected user dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

            {/* Protected change password page */}
            <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />

            {/* Protected Portal page (main entry point) */}
            <Route path="/portal" element={<ProtectedRoute><PortalPage /></ProtectedRoute>} />

            {/* Protected admin panel */}
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

            {/* Protected document upload page (Phase 4) */}
            <Route path="/projects/:projectId/upload-document" element={<ProtectedRoute><DocumentUploadPage /></ProtectedRoute>} />

            {/* Protected main application */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppProvider>
                    <MainApp />
                  </AppProvider>
                </ProtectedRoute>
              }
            />

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
