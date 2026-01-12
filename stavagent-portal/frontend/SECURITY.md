# Security Best Practices - StavAgent Portal Frontend

## 🔐 Authentication

### Production Mode (DEFAULT)

**✅ Authentication ALWAYS ENABLED**

By default, all routes require authentication via JWT tokens:
- Users must login to access protected routes
- JWT token stored in localStorage
- Token validated on every request
- Automatic redirect to `/login` if not authenticated

### Development Mode (OPTIONAL)

**⚠️ Use ONLY for local development!**

To bypass authentication during development:

1. Create `.env` file in `stavagent-portal/frontend/`:
   ```env
   VITE_DISABLE_AUTH=true
   ```

2. Restart dev server:
   ```bash
   npm run dev
   ```

3. **CRITICAL:** Delete `.env` before committing:
   ```bash
   rm .env
   ```

---

## 🚨 Security Checklist

### Before Deployment

- [ ] **Remove `.env` file** (if exists)
- [ ] **Verify** `VITE_DISABLE_AUTH` is NOT in `.env.production`
- [ ] **Test** login flow works in production build
- [ ] **Confirm** protected routes redirect to `/login`

### Production Build

```bash
# Build with production env
npm run build

# Test production build locally
npm run preview
# → Should require login!
```

### Verify Authentication

1. Open browser console
2. Check for warnings:
   - ✅ No "DEV MODE: Authentication disabled" warnings
   - ❌ If warning appears → **DO NOT DEPLOY!**

---

## 🔍 How Authentication Works

### Flow Diagram

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Access /portal  │
└────────┬────────┘
         │
         ▼
┌──────────────────┐      YES     ┌──────────────┐
│ Authenticated?   │ ────────────▶│ Show Portal  │
└────────┬─────────┘              └──────────────┘
         │
         │ NO
         ▼
┌──────────────────┐
│ Redirect to      │
│ /login           │
└──────────────────┘
```

### Code Reference

**File:** `src/components/ProtectedRoute.tsx`

```typescript
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();

  // DEV MODE: Auth bypass via environment variable
  const devBypassAuth = import.meta.env.VITE_DISABLE_AUTH === 'true';

  if (devBypassAuth) {
    console.warn('⚠️ DEV MODE: Authentication disabled!');
    return <>{children}</>;
  }

  // PRODUCTION: Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

---

## 🛡️ Environment Variables Security

### Safe to Commit

✅ `.env.example` - Documentation (no secrets)
✅ `.env.production` - Public URLs only (no secrets)

### NEVER Commit

❌ `.env` - Local development (may contain `VITE_DISABLE_AUTH=true`)
❌ `.env.local` - Local overrides (may contain secrets)
❌ `.env.development` - Dev settings (may contain test credentials)

---

## 📋 Production Deployment Checklist

### Render.com / Vercel / Netlify

1. **Environment Variables:**
   - `VITE_API_URL` → https://stav-agent.onrender.com
   - `VITE_CORE_API_URL` → https://concrete-agent.onrender.com
   - **DO NOT SET:** `VITE_DISABLE_AUTH`

2. **Build Command:**
   ```bash
   npm run build
   ```

3. **Start Command:**
   ```bash
   npm run preview
   ```

4. **Verify:**
   - Open production URL
   - Should redirect to `/login`
   - Login with test credentials
   - Check console for NO warnings

---

## 🚨 Emergency Response

### If Authentication is Accidentally Disabled in Production

**IMMEDIATE ACTIONS:**

1. **Stop deployment:**
   ```bash
   git revert HEAD
   git push origin main --force
   ```

2. **Remove `VITE_DISABLE_AUTH` from production env:**
   - Render Dashboard → Environment → Delete `VITE_DISABLE_AUTH`
   - Trigger manual redeploy

3. **Verify fix:**
   ```bash
   curl https://stav-agent.onrender.com/portal
   # Should return login page HTML (not portal data)
   ```

4. **Post-incident:**
   - Review commit history for `VITE_DISABLE_AUTH=true`
   - Add pre-commit hook to check for auth bypass
   - Update team documentation

---

## 📚 Related Documentation

- **Authentication Flow:** `docs/AUTH_FLOW.md`
- **JWT Token Management:** `src/context/AuthContext.tsx`
- **Protected Routes:** `src/components/ProtectedRoute.tsx`
- **Login Component:** `src/pages/LoginPage.tsx`

---

## 🔗 Contact

For security concerns, contact:
- **Security Lead:** [security@stavagent.com]
- **DevOps Team:** [devops@stavagent.com]

---

**Last Updated:** 2026-01-12
**Version:** 1.0.0
