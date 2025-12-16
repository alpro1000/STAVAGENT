# NEXT_SESSION.md - Session Handoff Document

**Last Session:** 2025-12-16
**Status:** ✅ All tasks completed and merged to main

---

## Session Summary (2025-12-16)

### What Was Done

#### 1. PostgreSQL Compatibility Fixes (Monolit-Planner)

**Problem:** Excel import was failing in production (PostgreSQL) but working locally (SQLite).

**Root Causes & Fixes:**

| Issue | Cause | Fix |
|-------|-------|-----|
| `positions is not iterable` | PostgreSQL `db.transaction()` passes `(client, ...args)` not `(positions)` | Split transaction handling for PostgreSQL vs SQLite |
| Bridges not loading on start | `refetchOnMount: false` in useBridges.ts | Changed to `refetchOnMount: true` |
| FK constraint violations | `db.prepare().get()` returns Promise in PostgreSQL, wasn't awaited | Added `await` to all db.prepare() operations |

**Key File:** `Monolit-Planner/backend/src/routes/upload.js`
```javascript
// PostgreSQL: Use pool directly for explicit transaction control
if (db.isPostgres) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ... operations
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

#### 2. Quantity Detection Fixes (Monolit-Planner)

**Problem:** Excel parser was extracting wrong values:
- First: Taking OTSKP codes (43131) instead of volumes (7.838)
- After fix: Taking smallest number (3.00) instead of correct volume (7.838)

**Solution:** Implemented scoring system in `concreteExtractor.js`:
```javascript
candidates.forEach(item => {
  let score = 0;
  if (item.isQuantityColumn) score += 100;  // Column named "quantity/množství"
  const decimalPlaces = (String(item.num).split('.')[1] || '').length;
  if (decimalPlaces >= 2) score += 50;      // 7.838 has 3 decimals
  if (decimalPlaces >= 1) score += 20;
  if (Number.isInteger(item.num)) score -= 30;
  if (item.num >= 5 && item.num <= 500) score += 25;
  if (item.num < 5 && Number.isInteger(item.num)) score -= 40;
  if (item.isLikelyPrice) score -= 20;
  item.score = score;
});
candidates.sort((a, b) => b.score - a.score);
qty = candidates[0].num;  // Take highest scored candidate
```

**Key Files:**
- `Monolit-Planner/backend/src/services/concreteExtractor.js` - Scoring algorithm
- `Monolit-Planner/backend/src/services/parser.js` - Bridge ID extraction

#### 3. Bridge ID Extraction Fix

**Problem:** Sheet name "SO 12-23-01" was parsed as:
- bridgeId: "SO12" (truncated)
- bridgeName: "23-01"

**Fix:** Added priority for compound IDs in `parser.js`:
```javascript
// PRIORITY 1: Compound IDs like "SO 12-23-01"
const compoundMatch = sheetName.match(/^SO\s*(\d+[-–][\d\-–\.]+)\s*$/i);
if (compoundMatch) {
  const fullId = compoundMatch[1].replace(/\s+/g, '').replace(/–/g, '-');
  return { bridgeId: `SO${fullId}`, bridgeName: sheetName.trim() };
}
```

#### 4. claude-mem Plugin Installed

**Purpose:** Persistent memory across Claude Code sessions.

**Installation:**
- Location: `/home/user/claude-mem/`
- Worker: http://localhost:37777
- Database: `~/.claude-mem/claude-mem.db`
- Hooks: Configured in `~/.claude/settings.json`

**Hooks Configured:**
| Event | Script |
|-------|--------|
| SessionStart | context-hook.js, user-message-hook.js |
| UserPromptSubmit | new-hook.js |
| PostToolUse | save-hook.js |
| Stop | summary-hook.js |
| SessionEnd | cleanup-hook.js |

---

## Commits Merged to Main

```
eb8ad11 Merge pull request #116
bda9740 FIX: Quantity detection - use scoring system instead of sorting
79c329b FIX: Bridge ID extraction - use full compound ID
b0fc8ca FIX: Quantity extraction - exclude OTSKP codes and prices
435723a FIX: PostgreSQL async - add await to db.prepare()
79587df FIX: useBridges - refetchOnMount: true
74e86a9 FIX: PostgreSQL transaction signature
```

---

## Technical Debt (Acknowledged)

**"bridge_id" Naming Convention:**
- All objects (bridges, buildings, tunnels) use `bridge_id` in database
- This is technical debt from VARIANT 1 migration
- Decision: Keep as-is for now, rename in future refactor
- Affected tables: `bridges`, `positions` (FK)

---

## Files Modified This Session

### Monolit-Planner
```
backend/src/routes/upload.js          # PostgreSQL transaction handling
backend/src/services/concreteExtractor.js  # Scoring system for quantities
backend/src/services/parser.js        # Compound bridge ID extraction
frontend/src/hooks/useBridges.ts      # refetchOnMount: true
```

### Root
```
~/.claude/settings.json               # claude-mem hooks
CLAUDE.md                             # Updated documentation
NEXT_SESSION.md                       # This file
```

---

## Verification Checklist

After deployment, verify:
- [ ] Excel import with multi-sheet files works
- [ ] Concrete volumes detected correctly (decimals preferred)
- [ ] Bridge IDs extracted as full compound IDs
- [ ] Bridges load on initial app start
- [ ] claude-mem captures session context

---

## Production URLs

| Service | URL | Status |
|---------|-----|--------|
| Monolit-Planner Frontend | https://monolit-planner-frontend.onrender.com | Auto-deploys from main |
| Monolit-Planner API | https://monolit-planner-api.onrender.com | Auto-deploys from main |

---

## Next Steps (Optional)

1. **Test Excel Import** - Upload multi-sheet Excel file, verify volumes
2. **Rename bridge_id → object_id** - Future refactor task
3. **Verify claude-mem** - Check if memory persists across sessions

---

**Session ended:** 2025-12-16
**All changes merged to main branch.**
