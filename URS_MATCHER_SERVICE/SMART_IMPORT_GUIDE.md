# 🔒 Smart & Legal URS Catalog Import System

**Version:** 1.0
**Status:** ✅ Ready for Production
**Last Updated:** 2025-12-10

---

## 🎯 Executive Summary

A **fully automated, versioned, and legally-compliant** system for importing the official ÚRS catalog with:

- ✅ **Zero scraping** (licensed sources only)
- ✅ **Version control & rollback** (like Git for your catalog)
- ✅ **Approval workflow** (human-in-the-loop safety)
- ✅ **Audit logging** (100% transparency)
- ✅ **Health checks** (data integrity validation)
- ✅ **Scheduled imports** (weekly/monthly automatic updates)
- ✅ **Graceful degradation** (system works with old data if import fails)

---

## ⚖️ LEGAL FRAMEWORK (CRITICAL!)

### What's LEGAL ✅

```
✅ LICENSED SOURCES:
├─ Your company's KROS/ÚRS account (if you have license)
├─ Official ÚRS export files (CSV/XLSX)
├─ Company FTP server with authorized export
├─ Cloud storage (S3/Google Drive) with licensed files
└─ Official ÚRS API (if they provide one)

✅ USAGE:
├─ Internal use only (no redistribution)
├─ Business purposes (construction, estimation, planning)
├─ Improving your internal systems
└─ Data analysis for your company

✅ ATTRIBUTION:
├─ Keep license information
├─ Document source & version
├─ Audit log all imports
└─ Respect copyright notices
```

### What's ILLEGAL/RISKY ❌

```
❌ NEVER:
├─ Scrape podminky.urs.cz website (violates ToS!)
├─ Use Web Scraping tools (automated HTTP requests)
├─ Bypass authentication or access controls
├─ Share exported catalog with others
├─ Redistribute the data commercially
├─ Modify version numbers to hide origin
└─ Use fake/invalid export sources

❌ RISKS:
├─ IP ban from ÚRS website
├─ Legal action from ČKAIT
├─ Loss of business license
├─ Financial penalties (100,000+ CZK)
└─ Reputation damage
```

---

## 🏗️ ARCHITECTURE: Smart Import System

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│           SMART & LEGAL URS IMPORT SYSTEM                       │
│                                                                 │
│  LICENSED SOURCE ONLY:                                          │
│  ├─ Local file (./data/urs_export.csv)                         │
│  ├─ S3 bucket (s3://company-urs-exports/)                      │
│  ├─ FTP server (ftp://urs.company.com)                         │
│  ├─ Official API (if ÚRS provides)                             │
│  └─ NEVER: Website scraping!                                    │
│    │                                                             │
│    ▼                                                             │
│  ┌──────────────────────────────────────┐                      │
│  │  catalogImportService.js             │                      │
│  ├──────────────────────────────────────┤                      │
│  │ 1. Source validation (licensed only) │                      │
│  │ 2. Create version (versionId)        │                      │
│  │ 3. Import data                       │                      │
│  │ 4. Validate integrity                │                      │
│  │ 5. Health checks                     │                      │
│  │ 6. Audit logging                     │                      │
│  │ 7. Approval workflow                 │                      │
│  │ 8. Activate version                  │                      │
│  └──────────────────────────────────────┘                      │
│    │   │   │   │   │   │   │                                    │
│    ▼   ▼   ▼   ▼   ▼   ▼   ▼                                    │
│  Database Tables:                                               │
│  ├─ urs_items (40,000+ codes)                                   │
│  ├─ catalog_versions (version history)                          │
│  └─ catalog_audit_log (all operations logged)                   │
│                                                                 │
│  REST API:                                                      │
│  ├─ GET  /api/catalog/status           (current state)          │
│  ├─ POST /api/catalog/import           (start import)           │
│  ├─ GET  /api/catalog/versions         (list versions)          │
│  ├─ POST /api/catalog/versions/:id/approve                      │
│  ├─ POST /api/catalog/rollback/:id                              │
│  ├─ GET  /api/catalog/audit-log        (transparency)           │
│  └─ GET  /api/catalog/health-check     (data validation)        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 VERSION CONTROL WORKFLOW

### Version Lifecycle

```
1. PENDING (Created, waiting for approval)
   ├─ Created automatically or manually
   ├─ Data imported to temp location
   ├─ Validation checks run
   ├─ Audit log created
   └─ Awaits human approval

2. APPROVED (Approved, ready to activate)
   ├─ Human reviewed and approved
   ├─ Validation score > threshold
   ├─ Ready for immediate use
   └─ Auto-activate after timeout if needed

3. ACTIVE (Current production catalog)
   ├─ In use by /api/jobs/block-match-fast
   ├─ Only ONE version can be active
   ├─ Search results use this version
   └─ Can be rolled back to previous

4. INACTIVE (Previous version, kept for rollback)
   ├─ Replaced by newer version
   ├─ Can be reactivated if needed
   ├─ Kept for last 3 versions
   └─ Archived after 3 versions ago

5. REJECTED (Failed validation)
   ├─ Validation errors found
   ├─ Cannot be used
   ├─ Kept for audit trail
   └─ Archived after 90 days

6. ARCHIVED (Old version)
   ├─ Beyond retention period
   ├─ Kept for compliance
   ├─ Read-only access
   └─ Can be recovered if needed
```

### Version Example

```bash
# Get current version
curl https://urs-matcher.example.com/api/catalog/status

{
  "active_version": {
    "version_id": "catalog_1702200000000",
    "created_at": "2025-12-10T15:00:00Z",
    "source": "local_file",
    "imported_codes_count": 40231,
    "validation_score": 98,
    "status": "active"
  },
  "pending_versions": [
    {
      "version_id": "catalog_1702286400000",
      "created_at": "2025-12-11T15:00:00Z",
      "validation_score": 95,
      "status": "pending"
    }
  ]
}

# Approve pending version
curl -X POST https://urs-matcher.example.com/api/catalog/versions/catalog_1702286400000/approve \
  -H "Content-Type: application/json" \
  -d '{"notes": "Approved by John Doe - validated on 2025-12-11"}'

{
  "status": "approved_and_activated",
  "version_id": "catalog_1702286400000",
  "approved_at": "2025-12-11T15:05:00Z"
}

# Rollback if needed
curl -X POST https://urs-matcher.example.com/api/catalog/rollback/catalog_1702200000000 \
  -H "Content-Type: application/json" \
  -d '{"reason": "New version has incorrect codes in section 31"}'

{
  "status": "rollback_started",
  "version_id": "catalog_1702200000000",
  "rollback_started_at": "2025-12-11T15:10:00Z"
}
```

---

## 🤖 AUTOMATED IMPORT SETUP

### Option 1: Manual Import (Recommended for first setup)

```bash
# 1. Get licensed export file
# - From your KROS account, or
# - Ask your company for authorized export, or
# - Request from ČKAIT if you have enterprise license

# 2. Place in data directory
cp ~/Downloads/urs_export_2025_12.csv /home/user/STAVAGENT/URS_MATCHER_SERVICE/backend/data/urs_export.csv

# 3. Manual import with approval workflow
curl -X POST http://localhost:3001/api/catalog/import \
  -H "Content-Type: application/json" \
  -d '{
    "source": "local_file",
    "source_path": "./data/urs_export.csv",
    "auto_approve": false
  }'

# 4. Human reviews the version
curl http://localhost:3001/api/catalog/pending-approvals

# 5. Approve after verification
curl -X POST http://localhost:3001/api/catalog/versions/{version_id}/approve \
  -H "Content-Type: application/json" \
  -d '{"notes": "Verified on 2025-12-11 by DevOps team"}'
```

### Option 2: Weekly Scheduled Import (Production)

```javascript
// backend/src/services/scheduledImportService.js

import cron from 'node-cron';
import { importService } from './catalogImportService.js';
import { logger } from '../utils/logger.js';

/**
 * Schedule automatic weekly imports from licensed source
 * Runs every Sunday at 2:00 AM UTC
 */
export function setupScheduledImports() {
  if (process.env.AUTO_IMPORT_DISABLED === 'true') {
    logger.info('[SCHEDULED-IMPORT] Auto-import disabled via env variable');
    return;
  }

  logger.info('[SCHEDULED-IMPORT] Scheduled weekly import at: 0 2 * * 0 (Sundays 2 AM UTC)');

  cron.schedule('0 2 * * 0', async () => {
    try {
      logger.info('[SCHEDULED-IMPORT] Starting scheduled import...');

      // Trigger import from licensed source
      const result = await importService.importFromLicensedSource({
        source: 'local_file',
        path: process.env.AUTO_IMPORT_PATH || './data/urs_export.csv',
        autoApprove: false  // Still require human approval!
      });

      logger.info('[SCHEDULED-IMPORT] Import started:', result.versionId);

      // Send notification to admins for approval
      await sendApprovalNotification({
        versionId: result.versionId,
        validationScore: result.validation.score,
        codesImported: result.stats.total,
        warnings: result.validation.warnings
      });

    } catch (error) {
      logger.error('[SCHEDULED-IMPORT] Import failed:', error.message);

      // Send alert to monitoring system
      await sendAlert({
        severity: 'critical',
        message: `Scheduled URS catalog import failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Send approval notification to admin team
 */
async function sendApprovalNotification(details) {
  // Could use email, Slack, PagerDuty, etc.
  logger.info('[SCHEDULED-IMPORT] Approval notification would be sent to admins');
  console.log('Pending approval:', details);
  // Example: await sendSlackMessage({...})
}

/**
 * Send alert to monitoring
 */
async function sendAlert(details) {
  logger.error('[SCHEDULED-IMPORT] ALERT:', details);
  // Could send to: Datadog, New Relic, PagerDuty, etc.
}
```

**Enable in production:**
```bash
# Start with scheduled imports
node backend/src/services/scheduledImportService.js

# Or add to package.json scripts:
"scripts": {
  "start": "node backend/server.js",
  "start:with-scheduled-imports": "node backend/server.js & node backend/src/services/scheduledImportService.js"
}
```

### Option 3: CI/CD Integration (Advanced)

```yaml
# .github/workflows/urs-import.yml
name: Weekly URS Catalog Import

on:
  schedule:
    - cron: '0 2 * * 0'  # Every Sunday at 2 AM UTC
  workflow_dispatch:     # Allow manual trigger

jobs:
  import:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Download licensed export
        env:
          S3_BUCKET: ${{ secrets.URS_EXPORT_S3_BUCKET }}
          S3_KEY: ${{ secrets.URS_EXPORT_S3_KEY }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws s3 cp "s3://$S3_BUCKET/$S3_KEY" ./data/urs_export.csv

      - name: Run import
        run: |
          cd URS_MATCHER_SERVICE/backend
          npm install
          node scripts/import_urs_catalog.mjs --from-csv ../data/urs_export.csv

      - name: Validate data
        run: |
          cd URS_MATCHER_SERVICE/backend
          npm run validate-catalog

      - name: Run tests
        run: |
          cd URS_MATCHER_SERVICE/backend
          npm test

      - name: Notify for approval
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            payload.attachments = [{
              color: 'good',
              text: 'URS Catalog Import Ready for Approval',
              fields: [{
                title: 'Action Required',
                value: 'https://urs-matcher.example.com/admin/import-approvals'
              }]
            }]
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

      - name: Alert on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            payload.attachments = [{
              color: 'danger',
              text: 'URS Catalog Import FAILED'
            }]
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## ✅ LEGAL COMPLIANCE CHECKLIST

Before implementing automated import, verify:

- [ ] **Licensed Source**
  - [ ] We have valid KROS/ÚRS license
  - [ ] Export file is from authorized source
  - [ ] No web scraping is used
  - [ ] Source is documented

- [ ] **Data Usage**
  - [ ] Internal use only (no redistribution)
  - [ ] Used for stated business purposes
  - [ ] No commercial resale
  - [ ] Compliance with ČKAIT terms

- [ ] **Audit & Transparency**
  - [ ] All imports logged with timestamps
  - [ ] Source and version tracked
  - [ ] Approval workflow implemented
  - [ ] Rollback capability in place

- [ ] **Data Security**
  - [ ] Access control implemented
  - [ ] Database encrypted at rest
  - [ ] Export file secured (access logs)
  - [ ] No accidental sharing

- [ ] **Operational**
  - [ ] Health checks verify data integrity
  - [ ] Automated tests pass
  - [ ] Rollback tested and working
  - [ ] Alert system configured

- [ ] **Documentation**
  - [ ] License terms documented
  - [ ] Import process documented
  - [ ] Admin procedures documented
  - [ ] Incident response plan

---

## 🚨 INCIDENT RESPONSE

### If Import Fails

```bash
# 1. Check status
curl http://localhost:3001/api/catalog/health-check

# 2. Review audit log
curl http://localhost:3001/api/catalog/audit-log?limit=20

# 3. Check pending versions
curl http://localhost:3001/api/catalog/pending-approvals

# 4. Reject bad version
curl -X POST http://localhost:3001/api/catalog/versions/{id}/reject \
  -d '{"reason": "Validation failed: duplicates found"}'

# 5. Rollback to last good version
curl -X POST http://localhost:3001/api/catalog/rollback/{old_version_id} \
  -d '{"reason": "Emergency rollback due to bad import"}'

# 6. System continues with previous version
# No service interruption!
```

### If Source File is Compromised

```bash
# 1. IMMEDIATELY reject current import
curl -X POST http://localhost:3001/api/catalog/versions/{id}/reject \
  -d '{"reason": "Source file integrity compromised"}'

# 2. Verify last active version
curl http://localhost:3001/api/catalog/status | jq '.active_version'

# 3. If needed, rollback to known-good version
curl -X POST http://localhost:3001/api/catalog/rollback/{good_version_id}

# 4. Review audit log for what happened
curl http://localhost:3001/api/catalog/audit-log

# 5. Re-obtain licensed export from trusted source
# 6. Re-run import with fresh file
```

---

## 📊 MONITORING & ALERTS

### Key Metrics to Monitor

```
Critical Alerts:
├─ Import fails 3 times in a row
├─ Validation score drops below 70
├─ Health check unhealthy (< 100 codes)
├─ Audit log shows unauthorized access
└─ Approval timeout approaching

Warning Alerts:
├─ Import takes > 3 minutes
├─ Missing sections (27, 31, 32, 41, etc.)
├─ Duplicate codes found (> 0)
├─ Skipped rows (> 5%)
└─ No active version in database

Info Alerts:
├─ Import completed successfully
├─ Version approved and activated
├─ Health check passed
├─ Rollback performed
└─ Scheduled import started
```

### Monitoring Implementation

```javascript
// Pseudo-code for monitoring setup

setInterval(async () => {
  const health = await importService.healthCheck.check();

  if (health.status === 'unhealthy') {
    await sendCriticalAlert('Catalog is unhealthy', health);
  } else if (health.status === 'degraded') {
    await sendWarningAlert('Catalog is degraded', health);
  }

  // Check for pending approvals timeout
  const pending = await importService.getPendingApprovals();
  for (const version of pending) {
    const createdTime = new Date(version.created_at);
    const ageHours = (Date.now() - createdTime) / (1000 * 60 * 60);

    if (ageHours > 20 && ageHours < 24) {
      // Within 4 hours of auto-approval
      await sendWarningAlert(`Version will auto-approve in ${24 - ageHours} hours`, version);
    }
  }
}, 60000); // Check every minute
```

---

## 📚 SUMMARY

**Safe, Legal, Automated URS Catalog Imports:**

✅ **Only licensed sources** (never scrape)
✅ **Version control** (Git-like rollback)
✅ **Approval workflow** (human oversight)
✅ **Audit logging** (100% transparency)
✅ **Health checks** (data validation)
✅ **Scheduled imports** (weekly automation)
✅ **Incident response** (safe rollback)
✅ **Legal compliance** (ČKAIT terms respected)

---

**Status:** ✅ Ready for Production
**Last Updated:** 2025-12-10
**Next Review:** 2026-03-10 (quarterly)
