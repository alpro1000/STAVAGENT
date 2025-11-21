# 👤 User Management & Admin System Architecture

**Status:** 🔴 NOT IMPLEMENTED (Design Phase)
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 2-3 weeks (4 phases)

---

## 📋 CURRENT STATE

### ✅ What Works
- User registration with email/password
- User login with JWT token (24h expiry)
- Multi-tenant isolation by `owner_id`
- Role field exists but not used

### ❌ What's Missing
| Feature | Status | Impact |
|---------|--------|--------|
| Email verification | ❌ | Anyone can register with fake email |
| Admin panel | ❌ | No way to manage users |
| User dashboard | ❌ | No user profile/settings |
| Password reset | ❌ | Users stuck if forgot password |
| Role enforcement | ❌ | Admin role exists but not checked |
| Config protection | ❌ | **SECURITY BUG** - anyone can change settings |

---

## 🏗️ ARCHITECTURE OVERVIEW

### User Flow (Current)

```
[Unauthenticated User]
    ↓
    POST /api/auth/register {email, password, name}
    ├─ Email validation (regex only)
    ├─ Password hashing (bcrypt, 10 rounds)
    └─ ❌ NO email verification
    ↓
[JWT Token]
    ↓
    Access Protected Routes
    └─ owner_id isolation enforced
```

### User Flow (Desired - After Phase 1-3)

```
[User]
    ↓
[Home Page] - New landing page
    ├─ [Register Button]
    │   ↓
    │   Form: name, email, password
    │   ↓
    │   Verification Email Sent ✉️
    │   ↓
    │   User clicks link: /verify?token=xxx
    │   ↓
    │   Account activated
    │
    └─ [Login Button]
        ↓
        Form: email, password
        ↓
        JWT Token
        ↓
        [Dashboard] 👤
        ├─ Profile (name, email, created_at)
        ├─ My Projects
        ├─ Settings (change password)
        └─ Logout
```

### Admin Flow (Desired - After Phase 3)

```
[Admin User] (role='admin')
    ↓
[Admin Panel] /admin
    ├─ Users Tab
    │  ├─ List all users (table)
    │  ├─ Edit user (change role)
    │  └─ Delete user (cascade delete projects)
    ├─ Statistics Tab
    │  ├─ Total users
    │  ├─ Total projects
    │  └─ Growth charts
    ├─ Config Tab
    │  └─ Edit feature flags
    └─ Audit Log Tab
       └─ User activities
```

---

## 🔐 SECURITY FIXES REQUIRED

### 🔴 CRITICAL BUG: Config Endpoint Unprotected

**File:** `backend/src/routes/config.js`

**Current Code:**
```javascript
router.get('/api/config', async (req, res) => { ... })  // Anyone can GET ✓
router.post('/api/config', async (req, res) => { ... }) // Anyone can POST ❌ BUG!
```

**Risk:** Anyone can modify system feature flags, ROUNDING_STEP_KROS, etc.

**Fix Required:**
```javascript
router.post('/api/config', requireAuth, adminOnly, async (req, res) => {
  // Only admins can POST
})
```

---

## 📊 DATABASE SCHEMA CHANGES

### Current `users` Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',      -- ⚠️ Exists but never checked!
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 2 Addition: Email Verification

```sql
-- Add columns to users table
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP;

-- New table for verification tokens
CREATE TABLE email_verification_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 2 Addition: Password Reset

```sql
-- New table for reset tokens
CREATE TABLE password_reset_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 3 Addition: Audit Logging

```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,  -- 'login', 'register', 'project_create', etc.
  resource_type VARCHAR(50),    -- 'user', 'project', 'config', etc.
  resource_id VARCHAR(255),
  status VARCHAR(20),           -- 'success', 'failed'
  ip_address VARCHAR(45),       -- IPv4 or IPv6
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
```

---

## 🔄 IMPLEMENTATION PHASES

### PHASE 1: Security & Email Verification (Days 1-3)

**Files to Create/Modify:**

1. **backend/src/routes/auth.js** (update)
   - POST /api/auth/register → send verification email
   - POST /api/auth/verify → activate account
   - GET /api/auth/me → check email_verified

2. **backend/src/services/emailService.js** (NEW)
   - sendVerificationEmail()
   - sendPasswordResetEmail()
   - Uses Resend or SendGrid API

3. **backend/src/routes/config.js** (CRITICAL FIX)
   - Add requireAuth, adminOnly middleware
   - POST route now protected

4. **Database Migration**
   - Add email_verified, email_verified_at to users
   - Create email_verification_tokens table

**Frontend Changes:**
- LoginPage.tsx: Add verification email prompt
- New VerifyEmail.tsx page component

**Implementation:**
```javascript
// POST /api/auth/register flow:
1. User submits form
2. Create user with email_verified=false
3. Generate and send verification token
4. Email sent to user
5. User clicks link: /verify?token=xxx
6. POST /api/auth/verify { token }
7. Mark user as email_verified=true
8. Redirect to login
9. User can now login
```

---

### PHASE 2: User Dashboard & Password Reset (Days 4-7)

**Files to Create:**

1. **frontend/src/pages/DashboardPage.tsx** (NEW)
   - Show user profile (name, email, created_at)
   - List user's projects
   - Change password button
   - Settings modal

2. **frontend/src/pages/ChangePasswordPage.tsx** (NEW)
   - Form: old password, new password, confirm
   - Password strength indicator
   - Validation

3. **backend/src/routes/auth.js** (update)
   - POST /api/auth/forgot-password { email }
   - POST /api/auth/reset-password { token, password }

4. **Database Migration**
   - Create password_reset_tokens table

**Routes Added:**
```javascript
GET /api/auth/me                    // Get current user profile
POST /api/auth/change-password      // Change password while logged in
POST /api/auth/forgot-password      // Request password reset
POST /api/auth/reset-password       // Reset password with token
```

**UI Layout:**
```
/dashboard
├─ Header: "Dashboard" + Logout button
├─ Welcome: "Hello, Ivan!"
├─ Profile Card
│  ├─ Avatar/Initial
│  ├─ Name: Ivan Svoboda
│  ├─ Email: ivan@example.com
│  ├─ Joined: Nov 13, 2025
│  └─ [Change Password] button
├─ Statistics
│  ├─ My Projects: 5
│  ├─ Total Positions: 127
│  └─ Last Updated: Nov 13, 2025
├─ Recent Projects
│  ├─ Project 1
│  ├─ Project 2
│  └─ [View All] link
└─ [Create New Project] button
```

---

### PHASE 3: Admin Panel (Days 8-12)

**Files to Create:**

1. **backend/src/routes/admin.js** (NEW)
   - GET /api/admin/users → list all users
   - GET /api/admin/users/:id → user details
   - PUT /api/admin/users/:id/role → change role
   - DELETE /api/admin/users/:id → delete user
   - GET /api/admin/stats → system statistics
   - GET /api/admin/projects → all projects (no filter)

2. **backend/src/middleware/adminOnly.js** (NEW)
   ```javascript
   export function adminOnly(req, res, next) {
     if (req.user?.role !== 'admin') {
       return res.status(403).json({ error: 'Admin access required' });
     }
     next();
   }
   ```

3. **frontend/src/pages/AdminPanel.tsx** (NEW)
   - TabComponent: Users, Statistics, Config, Logs
   - UsersList with table
   - UserEdit modal
   - ConfirmDelete dialog

4. **frontend/src/components/AdminRoute.tsx** (NEW)
   - Protected route checking role === 'admin'

**Database Migration:**
   - Create audit_logs table
   - Add unique constraint on email (already exists)

**Routes Added:**
```javascript
GET /api/admin/users                    // List all users
GET /api/admin/users/:id                // Get user details
PUT /api/admin/users/:id/role           // Change user role
DELETE /api/admin/users/:id             // Delete user (cascade)
GET /api/admin/stats                    // System stats
GET /api/admin/projects                 // All projects
GET /api/admin/audit-logs               // Audit trail
```

**Admin Panel Layout:**
```
/admin
├─ Navigation (Users | Statistics | Config | Logs)
│
├─ Users Tab
│  ├─ Table
│  │  ├─ Columns: ID, Email, Name, Role, Created, Actions
│  │  └─ Rows: User1, User2, ...
│  ├─ Actions per user: View, Edit Role, Delete
│  └─ [New User] button (optional)
│
├─ Statistics Tab
│  ├─ Cards:
│  │  ├─ Total Users: 42
│  │  ├─ Total Projects: 156
│  │  ├─ Total Positions: 3,847
│  │  └─ Active Projects: 23
│  ├─ Charts:
│  │  ├─ Users Growth (line chart, last 30 days)
│  │  ├─ Projects by Type (pie chart)
│  │  └─ Positions per Project (bar chart)
│  └─ [Export Stats] button
│
├─ Config Tab
│  ├─ Feature Flags (toggles)
│  │  ├─ FF_AI_DAYS_SUGGEST
│  │  ├─ FF_PUMP_MODULE
│  │  ├─ FF_ADVANCED_METRICS
│  │  ├─ FF_DARK_MODE
│  │  └─ FF_SPEED_ANALYSIS
│  └─ [Save Changes] button
│
└─ Logs Tab
   ├─ Filters: User, Action, Date Range
   └─ Table: User, Action, Resource, Status, Timestamp
```

---

### PHASE 4: Multi-Kiosk Support (Weeks 3-4) [Future]

See separate document: MULTI_KIOSK_ARCHITECTURE.md

---

## 🔑 KEY DECISIONS

### 1. Email Service Provider

**Options:**
- **Resend** (Recommended) - Simple, good for startups
  - 100 free emails/day
  - API: `resend.emails.send({to, subject, html})`
- **SendGrid** - Enterprise, reliable
- **AWS SES** - Cheap but complex setup

**Decision:** Use Resend for MVP, can switch later

### 2. Role Enforcement

**Strategy:** Check `req.user.role` in middleware

```javascript
// Middleware stack:
router.get('/api/admin/users',
  requireAuth,        // Check JWT token
  adminOnly,          // Check role === 'admin'
  handler
);
```

### 3. Email Verification Token Storage

**Option A:** Store as plain text (risky)
**Option B:** Store as hash (recommended)

```javascript
// When creating token:
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
// Store tokenHash in DB
// Send token to user email (they can't guess the hash)

// When verifying:
const userToken = req.query.token;
const userTokenHash = crypto.createHash('sha256').update(userToken).digest('hex');
// Compare with DB
```

### 4. Password Reset Flow

```
User requests reset:
  POST /api/auth/forgot-password {email}
    ↓
  User found? Yes
    ↓
  Generate reset token
    ↓
  Store token hash + expiry (1 hour)
    ↓
  Send email with token
    ↓
User receives email, clicks link:
  /reset-password?token=xxx
    ↓
  Frontend shows form: newPassword, confirmPassword
    ↓
  User submits:
    POST /api/auth/reset-password {token, newPassword}
    ↓
  Backend validates token (hash check, not expired)
    ↓
  Update password
    ↓
  Delete reset token
    ↓
  Redirect to login
```

---

## 📚 Related Files

**Current Implementation:**
- `backend/src/routes/auth.js` - Registration/login (lines 19-165)
- `backend/src/middleware/auth.js` - JWT verification
- `frontend/src/context/AuthContext.tsx` - Auth state management
- `frontend/src/pages/LoginPage.tsx` - Login/register UI
- `backend/src/db/schema-postgres.sql` - Database schema (lines 4-13)

**To Be Created:**
- `backend/src/services/emailService.js` - Email sending
- `backend/src/middleware/adminOnly.js` - Admin authorization
- `backend/src/routes/admin.js` - Admin endpoints
- `frontend/src/pages/DashboardPage.tsx` - User dashboard
- `frontend/src/pages/AdminPanel.tsx` - Admin panel UI
- `frontend/src/components/AdminRoute.tsx` - Admin route protection

---

## ✅ CHECKLIST

### Phase 1 Checklist
- [ ] Fix config.js security bug (add requireAuth, adminOnly)
- [ ] Create emailService.js with Resend integration
- [ ] Add email_verified fields to users table
- [ ] Create email_verification_tokens table
- [ ] Update auth.js register endpoint
- [ ] Create auth.js verify endpoint
- [ ] Update LoginPage to show verification prompt
- [ ] Create VerifyEmail page component
- [ ] Test email verification flow

### Phase 2 Checklist
- [ ] Create DashboardPage.tsx
- [ ] Add /dashboard route to frontend router
- [ ] Create ChangePasswordPage.tsx
- [ ] Add change-password endpoint to auth.js
- [ ] Add forgot-password endpoint
- [ ] Add reset-password endpoint
- [ ] Create password_reset_tokens table
- [ ] Add email sending for password reset
- [ ] Test password reset flow

### Phase 3 Checklist
- [ ] Create admin.js routes file
- [ ] Create adminOnly.js middleware
- [ ] Add GET /api/admin/users endpoint
- [ ] Add PUT /api/admin/users/:id/role endpoint
- [ ] Add DELETE /api/admin/users/:id endpoint
- [ ] Add GET /api/admin/stats endpoint
- [ ] Create audit_logs table
- [ ] Create AdminPanel.tsx page
- [ ] Create AdminRoute.tsx component
- [ ] Add /admin route to frontend router
- [ ] Test admin panel access control

---

## 🚀 NEXT STEPS

1. **Immediately:** Fix config.js security bug (CRITICAL)
2. **This week:** Implement Phase 1 (Email Verification)
3. **Next week:** Implement Phase 2 (Dashboard + Password Reset)
4. **Week after:** Implement Phase 3 (Admin Panel)
5. **Future:** Multi-Kiosk Architecture (Phase 4)

