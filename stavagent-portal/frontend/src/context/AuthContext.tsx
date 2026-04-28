/**
 * Authentication Context
 * Manages user authentication state and JWT token
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

/**
 * Cross-subdomain JWT cookie. Written alongside `localStorage.auth_token`
 * (kept for backward compatibility with the existing 50+ consumers in
 * the Portal frontend) so other STAVAGENT apps on `*.stavagent.cz`
 * subdomains (Registry, Monolit Planner, URS Matcher, Beton
 * Calculator) can read the JWT and authenticate their own backend
 * calls without forcing each kiosk to ship its own login UI.
 *
 * Cookie attributes:
 *   - domain=.stavagent.cz — the leading dot is critical (without it
 *     the cookie scopes to www.stavagent.cz only, not subdomains).
 *   - secure=true — HTTPS-only. Skipped on localhost during dev so the
 *     cookie still lands in dev mode.
 *   - sameSite=lax — lets the cookie ride along with same-origin GETs;
 *     'strict' would block kiosk reads on first visit.
 *   - max-age = 24 h, matches JWT_EXPIRY in Portal backend.
 *   - httpOnly=false — Registry needs to read it from JS. The token is
 *     short-lived and the same JWT used to sit in localStorage (which
 *     is also JS-readable), so this is not a regression.
 */
const SHARED_COOKIE_NAME = 'stavagent_jwt';
const COOKIE_MAX_AGE_S = 86400;

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
}

function cookieDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  // Production / staging — share across subdomains.
  if (host.endsWith('stavagent.cz')) return '.stavagent.cz';
  // Localhost / preview deploys — no domain attribute = host-only cookie.
  return null;
}

function setSharedJwtCookie(token: string): void {
  if (typeof document === 'undefined') return;
  const domain = cookieDomain();
  const parts = [
    `${SHARED_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'path=/',
    `max-age=${COOKIE_MAX_AGE_S}`,
    'samesite=lax',
  ];
  if (domain) parts.push(`domain=${domain}`);
  if (isSecureContext()) parts.push('secure');
  document.cookie = parts.join('; ');
}

function clearSharedJwtCookie(): void {
  if (typeof document === 'undefined') return;
  const domain = cookieDomain();
  // RFC: deleting requires same path + domain attributes that were used to set
  // it, with max-age=0. Setting max-age=0 with no domain on a domain-scoped
  // cookie is a no-op, hence the explicit branch.
  const baseParts = [`${SHARED_COOKIE_NAME}=`, 'path=/', 'max-age=0', 'samesite=lax'];
  if (domain) baseParts.push(`domain=${domain}`);
  if (isSecureContext()) baseParts.push('secure');
  document.cookie = baseParts.join('; ');
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  phone_verified?: boolean;
  company?: string | null;
  avatar_url?: string | null;
  timezone?: string;
  preferences?: Record<string, unknown>;
  org_id?: string | null;
  email_verified?: boolean;
  plan?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateProfile: (fields: Partial<Pick<User, 'name' | 'phone' | 'company' | 'timezone' | 'preferences'>>) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const DISABLE_AUTH = (import.meta as any).env?.VITE_DISABLE_AUTH === 'true';

    if (DISABLE_AUTH) {
      // Dev mode: skip token verification entirely to avoid 401 errors
      // ProtectedRoute handles the bypass separately
      setIsLoading(false);
      return;
    }

    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
      // Verify token and get user info
      verifyToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Verify token and get user info
  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${tokenToVerify}`
        }
      });

      if (response.data.success) {
        setUser(response.data.user);
        setToken(tokenToVerify);
        // Mirror to the shared cookie on every successful verify so a
        // user who logged in BEFORE this PR lands (token only in
        // localStorage) gets the cross-subdomain cookie populated on
        // their next visit without needing to re-login.
        setSharedJwtCookie(tokenToVerify);
      } else {
        // Invalid token
        localStorage.removeItem('auth_token');
        clearSharedJwtCookie();
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('auth_token');
      clearSharedJwtCookie();
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Login
  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      });

      if (response.data.success) {
        const { token: newToken, user: newUser } = response.data;
        localStorage.setItem('auth_token', newToken);
        // Mirror to a cross-subdomain cookie so Registry / Monolit /
        // URS / Beton Calculator can read it on their own subdomains.
        setSharedJwtCookie(newToken);
        setToken(newToken);
        setUser(newUser);
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      // Handle both error and message fields from backend
      let errorMsg: string;
      if (error.response?.data) {
        errorMsg = error.response.data.message || error.response.data.error || 'Login failed';
      } else if (error.request) {
        // Request was made but no response received (network/CORS issue)
        errorMsg = 'Server nedostupný. Zkontrolujte připojení k internetu.';
      } else {
        errorMsg = error.message || 'Login failed';
      }
      console.error('[AUTH] Login error:', errorMsg, error.response?.status);
      throw new Error(errorMsg);
    }
  };

  // Register
  const register = async (email: string, password: string, name: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        email,
        password,
        name
      });

      if (!response.data.success) {
        throw new Error('Registration failed');
      }
      // Don't set auth state — user must verify email first, then login
    } catch (error: any) {
      const message = error.response?.data?.error || 'Registration failed';
      throw new Error(message);
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('auth_token');
    clearSharedJwtCookie();
    setToken(null);
    setUser(null);
  };

  // Update profile fields via PATCH /api/auth/me
  const updateProfile = async (fields: Partial<Pick<User, 'name' | 'phone' | 'company' | 'timezone' | 'preferences'>>) => {
    if (!token) throw new Error('Not authenticated');
    const response = await axios.patch(`${API_URL}/api/auth/me`, fields, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.data.success) {
      setUser(prev => prev ? { ...prev, ...response.data.user } : response.data.user);
    } else {
      throw new Error('Profile update failed');
    }
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user && !!token,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
