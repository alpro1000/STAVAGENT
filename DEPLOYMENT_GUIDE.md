# 🚀 Deployment & Setup Guide

## Critical Issues Fixed in Phase 1

### 1. ✅ Project Creation Validation
- **Issue**: Projects could be created without part templates, causing empty projects
- **Fix**: Added validation to check templates before creation
- **Status**: Fixed in backend/src/routes/monolith-projects.js

### 2. ✅ Form Control Errors
- **Issue**: Browser console errors about invalid form controls with name=""
- **Fix**: Removed problematic hidden select element from ObjectTypeSelector
- **Status**: Fixed in frontend/src/components/ObjectTypeSelector.tsx

### 3. ✅ UI/UX Improvements
- **Issue**: Project creation form was unreadable with inline styles
- **Fix**: Added modern CSS styling and removed inline styles
- **Status**: Fixed in frontend/src/styles/components.css

### 4. ⚠️ OTSKP Database Initialization
- **Issue**: OTSKP codes not loading from XML file
- **Root Cause**: Database tables not created (empty database)
- **Solution**: Follow initialization steps below

---

## Database Initialization

### Fresh Start (After Code Changes)

```bash
# 1. Stop backend if running
# Ctrl+C in backend terminal

# 2. Delete old database
rm monolit.db

# 3. Start backend (will auto-initialize)
npm run dev

# OR manually initialize:
node backend/scripts/init-database.js
```

### Verify OTSKP Codes Loaded

```bash
node << 'EOF'
const Database = require('better-sqlite3');
const db = new Database('monolit.db');

const result = db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();
console.log('OTSKP codes in database:', result.count);

if (result.count > 0) {
  console.log('✓ OTSKP database is ready!');

  // Sample codes
  const samples = db.prepare(`
    SELECT code, name, unit_price FROM otskp_codes LIMIT 3
  `).all();

  console.log('\nSample codes:');
  samples.forEach(c => {
    console.log(`  ${c.code}: ${c.name} (${c.unit_price} CZK)`);
  });
} else {
  console.log('✗ OTSKP codes NOT loaded!');
  console.log('Ensure 2025_03 OTSKP.xml is in project root');
}

db.close();
EOF
```

---

## Troubleshooting

### Problem: "No part templates found" when creating project

**Cause**: Database tables not initialized

**Solution**:
```bash
# Delete database and restart backend
rm monolit.db
npm run dev
```

### Problem: OTSKP search not working / returns empty

**Cause**: OTSKP codes not loaded into database

**Solution**:
1. Verify XML file exists:
   ```bash
   ls -lah "2025_03 OTSKP.xml"
   ```

2. Check database was initialized:
   ```bash
   npm run dev  # Check server logs for [OTSKP] messages
   ```

3. Manual reload if needed:
   ```bash
   node backend/scripts/init-database.js
   ```

### Problem: Browser shows console errors about form controls

**Status**: ✅ Fixed in latest build

If still seeing errors:
1. Clear browser cache: Ctrl+Shift+Delete
2. Rebuild frontend: `npm run build`

---

## Project Creation Workflow (After Fixes)

1. **Frontend**: User clicks "Create Object" button
2. **Frontend**: Form validates object_type selected
3. **Frontend**: Sends POST to /api/monolith-projects
4. **Backend**:
   - Validates object_type
   - Validates numeric fields (positive numbers)
   - **Checks if templates exist** ← NEW VALIDATION
   - Creates project
   - Creates default parts from templates
   - Returns project with parts_count
5. **Frontend**: Shows success message with project ID

### Error Response (if templates missing):
```json
{
  "error": "No part templates found for object type 'bridge'. Please contact administrator to load templates.",
  "details": {
    "object_type": "bridge",
    "available_templates": 0,
    "required_for_creation": true
  }
}
```

---

## File Locations

| Component | Path | Status |
|-----------|------|--------|
| Database Init | backend/src/db/migrations.js | ✅ Fixed |
| Project API | backend/src/routes/monolith-projects.js | ✅ Fixed |
| Frontend Form | frontend/src/components/CreateMonolithForm.tsx | ✅ Fixed |
| Type Selector | frontend/src/components/ObjectTypeSelector.tsx | ✅ Fixed |
| Styles | frontend/src/styles/components.css | ✅ Fixed |
| Init Script | backend/scripts/init-database.js | ✅ Created |
| OTSKP Data | 2025_03 OTSKP.xml | ℹ️ Required |

---

## Recent Commits

- `7d00902` 🎨 Fix: Project creation validation, UI improvements
- `af329e0` 🐛 Fix: Remove TypeScript syntax from JavaScript
- `58df225` ✨ Phase 1: Fix critical and high-priority issues

---

## Next Steps for Production

- [ ] Run database initialization script
- [ ] Verify OTSKP codes loaded (see commands above)
- [ ] Test project creation with each object type
- [ ] Clear browser cache and rebuild frontend
- [ ] Deploy to production
- [ ] Monitor server logs for any [OTSKP] warnings

