# PLAN_CABINETS_ROLES_BILLING.md

**Version:** 1.0.0
**Date:** 2026-03-14
**Service:** stavagent-portal
**Status:** PLANNING

---

## 1. Executive Summary

### What We Are Building

STAVAGENT Portal currently has two roles (`user` / `admin`), JWT auth with email verification, and files stored on the server filesystem under `./uploads`. There is no billing, no organization structure, no API key management, and no async task processing.

This plan delivers four sprints that transform the Portal from a single-tenant calculator hub into a multi-tenant SaaS platform:

| Sprint | Focus | Outcome |
|--------|-------|---------|
| 1 | Cabinets + 5 Roles | User self-service cabinet (/cabinet), enhanced admin (/admin), org/team model |
| 2 | Service Connections + AI Models | Per-org AI key management with envelope encryption, kiosk toggles, model routing |
| 3 | Billing + Subscriptions | Stripe integration, 4 plans, usage metering, webhook handling |
| 4 | Object Storage + Workers | S3-compatible storage, presigned URLs, async task queue, BYOS mode |

---

## 2. Architecture Diagram (Control Plane / Data Plane Split)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CONTROL PLANE                                   │
│                    (stavagent-portal DB)                                │
│                                                                        │
│  users ─── org_members ─── organizations                               │
│    │                          │                                        │
│    ├── subscriptions          ├── service_connections (encrypted keys) │
│    ├── usage_events           ├── storage_config (BYOS mode)           │
│    └── audit_logs             └── kiosk_links, portal_projects          │
│                                                                        │
│  task_queue (async workers)                                            │
│    status: pending → processing → done / failed                        │
│    result_uri: gs://bucket/results/task-id.json  ← pointer only       │
└────────────────────┬───────────────────────────────────────────────────┘
                     │  presigned URL (signed by Portal, short TTL)
                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          DATA PLANE                                    │
│                                                                        │
│   GCS (managed)  │  AWS S3 (BYOS)  │  MinIO (private)                 │
│   gs://stavagent │  s3://customer  │  http://minio:9000/              │
│                                                                        │
│   Files NEVER hit Portal disk (except temp <30s in worker memory).    │
│   Portal DB stores only:  storage_uri, file_size, content_hash        │
└────────────────────────────────────────────────────────────────────────┘

Request Flow (Sprint 4):
User → Portal (POST /api/files/upload/initiate)
     → Portal issues presigned PUT URL (60s TTL)
     → Client uploads directly to GCS/S3
     → Client confirms (POST /api/files/upload/confirm)
     → Portal records storage_uri in portal_files
     → POST /api/tasks → task_queue row (status=pending)
     → Worker picks up task → presigned GET → process → presigned PUT result
     → Worker PATCH /api/tasks/:id (status=done, result_uri=...)
```

---

## 3. Database Schema Changes

### Migration 001: Extend users table

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS company VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Prague',
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS org_id UUID;
```

### Migration 002: Organizations + Members

```sql
CREATE TYPE storage_mode_enum AS ENUM ('managed', 'byos', 'private');
CREATE TYPE plan_enum AS ENUM ('free', 'starter', 'professional', 'enterprise');
CREATE TYPE org_role_enum AS ENUM ('admin', 'manager', 'estimator', 'viewer', 'api_client');

CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  plan          plan_enum NOT NULL DEFAULT 'free',
  storage_mode  storage_mode_enum NOT NULL DEFAULT 'managed',
  storage_config JSONB DEFAULT NULL,
  stripe_customer_id    VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  max_projects    INTEGER DEFAULT 5,
  max_storage_gb  REAL    DEFAULT 1.0,
  max_team_members INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  trial_ends_at  TIMESTAMP,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS org_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        org_role_enum NOT NULL DEFAULT 'estimator',
  invited_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invited_at  TIMESTAMP DEFAULT NOW(),
  joined_at   TIMESTAMP,
  invite_token_hash VARCHAR(64),
  invite_expires_at TIMESTAMP,
  UNIQUE(org_id, user_id)
);

ALTER TABLE users
  ADD CONSTRAINT fk_users_org_id
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
```

### Migration 003: Service Connections (Encrypted API Keys)

```sql
-- Encryption: AES-256-GCM, MASTER_ENCRYPTION_KEY in env, never in DB
-- credentials_encrypted = base64(iv + ciphertext + authTag)

CREATE TYPE service_type_enum AS ENUM (
  'gemini', 'openai', 'anthropic', 'aws_bedrock',
  'perplexity', 'azure_openai',
  'gcs', 'aws_s3', 'azure_blob'
);

CREATE TYPE connection_status_enum AS ENUM ('active', 'error', 'untested', 'disabled');

CREATE TABLE IF NOT EXISTS service_connections (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              INTEGER REFERENCES users(id) ON DELETE CASCADE,
  org_id               UUID REFERENCES organizations(id) ON DELETE CASCADE,
  service_type         service_type_enum NOT NULL,
  display_name         VARCHAR(255),
  credentials_encrypted TEXT NOT NULL,
  credentials_iv        VARCHAR(64) NOT NULL,
  config               JSONB DEFAULT '{}',
  status               connection_status_enum DEFAULT 'untested',
  last_tested_at       TIMESTAMP,
  last_error           TEXT,
  created_by           INTEGER NOT NULL REFERENCES users(id),
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_scope CHECK (
    (user_id IS NOT NULL AND org_id IS NULL) OR
    (user_id IS NULL AND org_id IS NOT NULL)
  )
);
```

### Migration 004: Subscriptions + Usage

```sql
CREATE TYPE subscription_status_enum AS ENUM (
  'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                INTEGER REFERENCES users(id) ON DELETE CASCADE,
  org_id                 UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan                   plan_enum NOT NULL DEFAULT 'free',
  status                 subscription_status_enum NOT NULL DEFAULT 'active',
  current_period_start   TIMESTAMP,
  current_period_end     TIMESTAMP,
  trial_ends_at          TIMESTAMP,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id     VARCHAR(255),
  stripe_price_id        VARCHAR(255),
  cancel_at_period_end   BOOLEAN DEFAULT false,
  canceled_at            TIMESTAMP,
  created_at             TIMESTAMP DEFAULT NOW(),
  updated_at             TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_sub_scope CHECK (
    (user_id IS NOT NULL AND org_id IS NULL) OR
    (user_id IS NULL AND org_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  metric      VARCHAR(50) NOT NULL,   -- 'ai_tokens', 'storage_mb', 'api_calls', 'file_uploads'
  quantity    BIGINT NOT NULL DEFAULT 1,
  metadata    JSONB DEFAULT '{}',
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_monthly (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  org_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  period   VARCHAR(7) NOT NULL,
  metric   VARCHAR(50) NOT NULL,
  total    BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, period, metric),
  UNIQUE(user_id, period, metric)
);
```

### Migration 005: Task Queue

```sql
CREATE TYPE task_status_enum AS ENUM (
  'pending', 'processing', 'done', 'failed', 'canceled'
);

CREATE TYPE task_type_enum AS ENUM (
  'core_workflow_a', 'core_workflow_c', 'pdf_parse',
  'excel_import', 'export_excel', 'export_pdf', 'file_migrate_s3'
);

CREATE TABLE IF NOT EXISTS task_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
  task_type        task_type_enum NOT NULL,
  status           task_status_enum NOT NULL DEFAULT 'pending',
  input_uri        TEXT,
  input_params     JSONB DEFAULT '{}',
  result_uri       TEXT,
  result_metadata  JSONB DEFAULT '{}',
  error_message    TEXT,
  retry_count      INTEGER DEFAULT 0,
  max_retries      INTEGER DEFAULT 3,
  created_at       TIMESTAMP DEFAULT NOW(),
  started_at       TIMESTAMP,
  completed_at     TIMESTAMP,
  priority         INTEGER DEFAULT 5,
  portal_project_id VARCHAR(255) REFERENCES portal_projects(portal_project_id) ON DELETE SET NULL,
  portal_file_id    VARCHAR(255) REFERENCES portal_files(file_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status, priority, created_at);
```

### Migration 006: Extend portal_files for Storage URIs

```sql
ALTER TABLE portal_files
  ADD COLUMN IF NOT EXISTS storage_uri TEXT,
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(20) DEFAULT 'local';

UPDATE portal_files SET storage_backend = 'local' WHERE storage_backend IS NULL;
```

---

## 4. Role Matrix

| Capability | admin | manager | estimator | viewer | api_client |
|-----------|:-----:|:-------:|:---------:|:------:|:----------:|
| Create / delete projects | Y | Y | Y | N | Y |
| View all org projects | Y | Y | Y | Y | Y |
| Upload files | Y | Y | Y | N | Y |
| Delete files | Y | Y | N | N | N |
| Run CORE workflows (AI) | Y | Y | Y | N | Y |
| Export (Excel/PDF) | Y | Y | Y | Y | N |
| Invite team members | Y | Y | N | N | N |
| Remove team members | Y | N | N | N | N |
| View audit logs | Y | N | N | N | N |
| Manage AI service connections | Y | Y | N | N | N |
| View billing / usage | Y | Y | N | N | N |
| Change subscription plan | Y | N | N | N | N |
| Configure storage (BYOS) | Y | N | N | N | N |
| API key authentication | N | N | N | N | Y |

---

## 5. Plans Definition

| Field | Free | Starter | Professional | Enterprise |
|-------|------|---------|--------------|------------|
| **Price (CZK/month)** | 0 | 490 | 1 490 | Dohodou |
| **Price (CZK/year)** | 0 | 4 990 | 14 990 | Dohodou |
| **Projects** | 3 | 25 | Unlimited | Unlimited |
| **Storage (GB)** | 1 | 10 | 100 | Unlimited |
| **AI tokens / month** | 500 000 | 5 000 000 | 50 000 000 | Unlimited |
| **Team members** | 1 | 5 | 25 | Unlimited |
| **API clients** | 0 | 1 | 5 | Unlimited |
| **Kiosks** | Monolit, Registry | All 5 | All 5 | All 5 + custom |
| **BYOS Storage** | N | N | Y | Y |
| **Async Workers** | N | N | Y | Y |
| **Audit Log Retention** | 7 days | 30 days | 365 days | Unlimited |

---

## 6. API Endpoints

### Sprint 1: Cabinets + Roles

```
PATCH  /api/auth/me                          — Update profile
GET    /api/cabinet/stats                    — Projects count, storage used, activity
POST   /api/orgs                             — Create org (caller becomes admin)
GET    /api/orgs                             — List my orgs
GET    /api/orgs/:id                         — Org details + subscription
PATCH  /api/orgs/:id                         — Update name/slug (admin)
DELETE /api/orgs/:id                         — Soft delete (admin)
POST   /api/orgs/:id/invite                  — Send email invite (admin, manager)
GET    /api/orgs/:id/members                 — List members with roles
PATCH  /api/orgs/:id/members/:userId         — Change member role (admin)
DELETE /api/orgs/:id/members/:userId         — Remove member (admin)
POST   /api/orgs/accept-invite               — Accept invitation by token
```

### Sprint 2: Service Connections + AI Models

```
GET    /api/connections                      — List connections (no credentials exposed)
POST   /api/connections                      — Add connection (AES-256-GCM encrypt on write)
PUT    /api/connections/:id                  — Update connection
DELETE /api/connections/:id                  — Delete connection
POST   /api/connections/:id/test             — Test key (rate limited: 5/min)
GET    /api/connections/model-config         — Effective model routing for caller's org
GET    /api/connections/kiosk-toggles        — Per-kiosk on/off per org
PATCH  /api/connections/kiosk-toggles        — Update kiosk toggles (admin, manager)
```

### Sprint 3: Billing + Subscriptions

```
GET    /api/billing/plans                    — Plan definitions (public)
GET    /api/billing/subscription             — Current subscription
POST   /api/billing/checkout                 — Create Stripe Checkout session
GET    /api/billing/portal                   — Create Stripe Customer Portal session
POST   /api/webhooks/stripe                  — Stripe webhook (raw body, signature validated)
GET    /api/billing/usage                    — Usage metrics for current period
```

### Sprint 4: Object Storage + Workers

```
POST   /api/files/upload/initiate            — Get presigned PUT URL (60s TTL)
POST   /api/files/upload/confirm             — Record file after direct upload
GET    /api/files/:id/presigned-url          — Get presigned GET URL (max 3600s)
DELETE /api/files/:id                        — Delete from storage + DB
POST   /api/storage/config                   — Configure BYOS (admin, encrypted)
GET    /api/storage/usage                    — Storage used / limit
POST   /api/tasks                            — Enqueue background task
GET    /api/tasks/:id                        — Task status + result_uri when done
GET    /api/tasks                            — List tasks (filter by status, org)
DELETE /api/tasks/:id                        — Cancel pending task
```

---

## 7. New Middleware

```javascript
// backend/src/middleware/orgRole.js
// Usage: router.delete('/:id', requireAuth, requireOrgRole('admin'), handler)

export function requireOrgRole(...allowedRoles) {
  return async (req, res, next) => {
    const orgId = req.params.id || req.body.org_id || req.query.org_id;
    if (!orgId) return res.status(400).json({ error: 'org_id is required' });

    const pool = getPool();
    const result = await pool.query(
      `SELECT role FROM org_members
       WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL`,
      [orgId, req.user.userId]
    );

    if (result.rows.length === 0)
      return res.status(403).json({ error: 'Not a member of this organization' });

    const memberRole = result.rows[0].role;
    if (!allowedRoles.includes(memberRole))
      return res.status(403).json({ error: 'Insufficient role', required: allowedRoles, actual: memberRole });

    req.orgRole = memberRole;
    next();
  };
}
```

---

## 8. Security Checklist

### API Key Encryption

```
Algorithm:   AES-256-GCM
Key size:    256 bits
IV size:     96 bits (12 bytes, random per encryption)
Auth tag:    128 bits
AAD:         connection.id (UUID) — prevents ciphertext reuse

MASTER_ENCRYPTION_KEY in env (32-byte hex): openssl rand -hex 32
NEVER stored in DB, NEVER logged.

Storage: credentials_encrypted = base64url(iv + ciphertext + authTag)
```

### Stripe Webhooks

- Use `express.raw({ type: 'application/json' })` for the webhook route ONLY.
- Validate via `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`.
- Register route BEFORE `express.json()` middleware in server.js.

### Rate Limiting

```javascript
billingLimiter:       windowMs: 15min, max: 10   // prevent checkout abuse
connectionTestLimiter: windowMs: 1min,  max: 5   // prevent key-fishing
inviteLimiter:        windowMs: 1h,    max: 20   // prevent email flooding
```

### Other

- Invite tokens: `randomUUID()` → SHA256 → stored as hex, expire 7 days.
- `credentials_encrypted` is NEVER returned in API responses.
- `orgRole` middleware checks `org_members` on EVERY org-scoped route.

---

## 9. Migration Strategy: ./uploads → GCS (Zero Downtime)

### Phase 1: Dual-Write (Sprint 4, Week 1)
New uploads go directly to GCS via presigned PUT. Existing files remain at `./uploads` (`storage_backend = 'local'`).

### Phase 2: Background Migration Job (`migrateFilesWorker.js`)
```
SELECT * FROM portal_files WHERE storage_backend = 'local' LIMIT 100
→ Read from ./uploads
→ Upload to gs://stavagent-prod/portal/{org_id}/{file_id}/{name}
→ UPDATE portal_files SET storage_uri=..., storage_backend='gcs'
→ Delete local copy after checksum verify
Estimated: ~50 files/min, 1000 files ≈ 20 min
```

### Phase 3: Remove Legacy Route
After `storage_backend = 'local'` count = 0: remove disk-read route, replace with presigned GET.

---

## 10. New Files (Backend)

```
backend/src/db/migrations/
  001_extend_users.sql
  002_organizations.sql
  003_service_connections.sql
  004_billing.sql
  005_task_queue.sql
  006_storage_uris.sql

backend/src/middleware/
  orgRole.js                      ← NEW

backend/src/routes/
  cabinet.js                      ← NEW
  orgs.js                         ← NEW
  connections.js                  ← NEW
  billing.js                      ← NEW
  webhooks-stripe.js              ← NEW
  files.js                        ← NEW (replaces multer upload path)
  storage.js                      ← NEW
  tasks.js                        ← NEW

backend/src/services/
  encryptionService.js            ← NEW (AES-256-GCM)
  storageService.js               ← NEW (GCS/S3/MinIO adapter)
  stripeService.js                ← NEW
  usageService.js                 ← NEW
  taskService.js                  ← NEW
  modelRoutingService.js          ← NEW

backend/src/workers/
  taskWorker.js                   ← NEW (polls task_queue every 5s)
  migrateFilesWorker.js           ← NEW (one-time job)
```

## 11. New Files (Frontend)

```
frontend/src/pages/
  CabinetPage.tsx                 ← NEW
  OrgPage.tsx                     ← NEW
  OrgInvitePage.tsx               ← NEW
  ConnectionsPage.tsx             ← NEW
  BillingPage.tsx                 ← NEW

frontend/src/components/
  cabinet/CabinetLayout.tsx       ← NEW (sidebar: Profil | Organizace | Platby | Zabezpečení)
  cabinet/CabinetStats.tsx        ← NEW
  cabinet/ProfileForm.tsx         ← NEW
  org/OrgCard.tsx                 ← NEW
  org/OrgCreate.tsx               ← NEW
  org/OrgMembersList.tsx          ← NEW
  org/OrgInviteForm.tsx           ← NEW
  org/OrgRoleBadge.tsx            ← NEW
  connections/ConnectionCard.tsx  ← NEW
  connections/ConnectionForm.tsx  ← NEW
  connections/ConnectionTestButton.tsx ← NEW
  connections/ModelConfigPanel.tsx ← NEW
  connections/KioskTogglePanel.tsx ← NEW
  billing/PlanCard.tsx            ← NEW
  billing/PlanSelector.tsx        ← NEW
  billing/UsageMeter.tsx          ← NEW
  billing/SubscriptionBadge.tsx   ← NEW
  files/DirectUploadInput.tsx     ← NEW (presigned PUT with progress)
  files/PresignedDownloadButton.tsx ← NEW
  tasks/TaskStatusBadge.tsx       ← NEW
  tasks/TaskQueuePanel.tsx        ← NEW

frontend/src/types/
  org.ts                          ← NEW
  connection.ts                   ← NEW
  billing.ts                      ← NEW
  task.ts                         ← NEW
```

---

## 12. Environment Variables (New)

```bash
# Sprint 2
MASTER_ENCRYPTION_KEY=<64-char hex>   # openssl rand -hex 32

# Sprint 3
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_...

# Sprint 4
GCS_BUCKET=stavagent-prod-files
GCS_PROJECT_ID=stavagent-prod
GOOGLE_APPLICATION_CREDENTIALS=/secrets/gcs-key.json
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-central-1
```

---

## 13. Dependencies to Install

```bash
# Sprint 3
cd stavagent-portal/backend && npm install stripe

# Sprint 4
cd stavagent-portal/backend && npm install @google-cloud/storage
cd stavagent-portal/backend && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## 14. Deployment Order

```
Sprint 1:
  1. Run migrations 001 + 002 on Render PostgreSQL shell
  2. Deploy backend (cabinet, orgs routes + orgRole middleware)
  3. Deploy frontend (CabinetPage, OrgPage, OrgInvitePage)

Sprint 2:
  4. Add MASTER_ENCRYPTION_KEY to Render env
  5. Run migration 003
  6. Deploy backend (connections routes + encryptionService)
  7. Deploy frontend (ConnectionsPage)

Sprint 3:
  8. Create Stripe products + prices in Stripe Dashboard
  9. Add STRIPE_* env vars to Render
  10. Run migration 004
  11. Deploy backend (billing + webhooks-stripe)
  12. Register Stripe webhook:
      https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app/api/webhooks/stripe
  13. Deploy frontend (BillingPage)

Sprint 4:
  14. Create GCS bucket + service account + mount key
  15. Run migrations 005 + 006
  16. Deploy backend (files, storage, tasks, taskWorker)
  17. Run migrateFilesWorker as Cloud Run Job (one-time)
  18. Deploy frontend (DirectUploadInput, TaskQueuePanel)
  19. After migration: remove legacy ./uploads disk route
```

---

## 15. Critical Files for Implementation

- `backend/src/db/schema-postgres.sql` — append all 6 migrations here (idempotent pattern)
- `backend/src/middleware/adminOnly.js` — pattern to follow for `orgRole.js`
- `backend/src/routes/auth.js` — add `PATCH /api/auth/me` here
- `backend/src/routes/portal-files.js` — migrate to presigned flow in Sprint 4
- `frontend/src/context/AuthContext.tsx` — extend `User` with `org` + `subscription`
