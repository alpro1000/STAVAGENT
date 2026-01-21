# Next Session Starter Commands

**Branch:** `claude/create-onboarding-guide-E4wrx`
**Previous Session:** 2026-01-21 (Portal Integration)
**Status:** ⏳ Awaiting user SQL execution

---

## 🚀 START COMMAND FOR NEXT SESSION

```bash
# Check current status
git status
git log --oneline -5

# Verify branch
git branch --show-current
# Expected: claude/create-onboarding-guide-E4wrx

# Read session summary
cat Monolit-Planner/SESSION_2026-01-21_PORTAL_INTEGRATION.md

# Check if user executed SQL
echo "Ask user: 'Did you execute БЫСТРОЕ_РЕШЕНИЕ.sql in Render Dashboard?'"
```

---

## 📋 PRIORITY CHECKLIST

### ✅ Completed (Last Session):
- [x] Backend audit trail for AI suggestions
- [x] Migration 007 (portal_project_id + normsets + position_suggestions)
- [x] Migration 008 (enable FF_AI_DAYS_SUGGEST)
- [x] 5 automatic enablement tools
- [x] Russian documentation (ИНСТРУКЦИЯ_RENDER.txt)

### ⏳ Pending (User Action):
- [ ] Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in Render PostgreSQL Shell
- [ ] Verify ✨ button appears in Monolit Planner UI
- [ ] Test AI suggestion functionality

### 🎯 Next Tasks (This Session):
1. [ ] Verify feature flag enabled
2. [ ] Test AI suggestion end-to-end
3. [ ] Check position_suggestions audit trail
4. [ ] Create PR for merge to main

---

## 🔍 VERIFICATION COMMANDS

### 1. Check if SQL was executed (via API):
```bash
curl -s https://monolit-planner-api.onrender.com/api/config | jq '.feature_flags.FF_AI_DAYS_SUGGEST'
# Expected: true
```

### 2. Check database directly (if DATABASE_URL available):
```bash
psql $DATABASE_URL -c "SELECT feature_flags::json->>'FF_AI_DAYS_SUGGEST' FROM project_config WHERE id = 1;"
# Expected: true
```

### 3. Check frontend (browser console):
```javascript
fetch('/api/config').then(r => r.json()).then(c => console.log('AI Enabled:', c.feature_flags.FF_AI_DAYS_SUGGEST));
// Expected: AI Enabled: true
```

---

## 🎬 SESSION SCENARIOS

### SCENARIO A: User Executed SQL ✅

**User says:** "Я выполнил SQL, кнопка появилась!"

**Actions:**
1. Ask for screenshot of ✨ button
2. Test AI suggestion:
   ```
   1. Click ✨ button
   2. Verify tooltip appears with suggestion
   3. Check browser DevTools Network tab for API call
   4. Verify position_suggestions table has new row
   ```
3. Create PR to merge branch to main
4. Update CLAUDE.md with session info

**Commands:**
```bash
# Verify position_suggestions table (if DB access)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM position_suggestions;"

# Create PR
git push -u origin claude/create-onboarding-guide-E4wrx
gh pr create --title "Portal Integration: AI Suggestions with Audit Trail" \
  --body "$(cat Monolit-Planner/SESSION_2026-01-21_PORTAL_INTEGRATION.md)"
```

---

### SCENARIO B: User Hasn't Executed SQL ⏳

**User says:** "Я не понял как это сделать" / "Не получается"

**Actions:**
1. Read ИНСТРУКЦИЯ_RENDER.txt together step-by-step
2. Offer alternative: Direct PostgreSQL connection string
3. Or: Create video/screenshots for guide

**Commands:**
```bash
# Show instruction file
cat Monolit-Planner/ИНСТРУКЦИЯ_RENDER.txt

# Show SQL script
cat Monolit-Planner/БЫСТРОЕ_РЕШЕНИЕ.sql

# Offer to guide through Render Dashboard step-by-step
```

---

### SCENARIO C: User Encountered Errors ❌

**User says:** "Ошибка при выполнении SQL" + error message

**Actions:**
1. Read error message
2. Diagnose issue (table already exists? syntax error?)
3. Provide corrected SQL

**Common Errors:**

#### Error 1: "relation project_config already exists"
```sql
-- Solution: Use IF NOT EXISTS (already in script)
-- Or: Just run INSERT part
DELETE FROM project_config WHERE id = 1;
INSERT INTO project_config VALUES (...);
```

#### Error 2: "permission denied"
```bash
# User needs to use correct PostgreSQL user
psql -U monolit_user -d monolit_planner
```

#### Error 3: "syntax error near '::json'"
```sql
-- PostgreSQL version < 9.2 doesn't support ::json
-- Solution: Use text comparison
SELECT feature_flags FROM project_config WHERE id = 1;
```

---

## 📊 TESTING PLAN

### Frontend Testing:
```javascript
// In browser console on Monolit Planner

// 1. Check config loaded
fetch('/api/config').then(r => r.json()).then(console.log);

// 2. Check button exists in DOM
document.querySelector('.ai-suggest-button');
// Expected: <button class="ai-suggest-button">...</button>

// 3. Check Sparkles icon
document.querySelector('.ai-suggest-button svg');
// Expected: SVG element

// 4. Simulate click (on position with qty > 0)
// Manual: Click ✨ button in UI
```

### Backend Testing:
```bash
# Test AI suggestion endpoint
curl -X POST https://monolit-planner-api.onrender.com/api/positions/POSITION_ID/suggest-days \
  -H "Content-Type: application/json"

# Expected response:
{
  "success": true,
  "suggested_days": 2.5,
  "reasoning": "Pro betonování 100 m³...",
  "confidence": 0.92,
  "norm_source": "KROS 2024"
}
```

### Database Testing:
```sql
-- Check position_suggestions table
SELECT * FROM position_suggestions ORDER BY created_at DESC LIMIT 5;

-- Check normsets table
SELECT id, name, source_tag FROM normsets;

-- Expected: 4 rows (ÚRS 2024, RTS 2023, KROS 2024, Internal)
```

---

## 🔄 MIGRATION EXECUTION

### If Migration 007 Not Yet Run:

```bash
# PostgreSQL (production)
psql $DATABASE_URL -f backend/migrations/007_portal_integration.sql

# Verify tables created
psql $DATABASE_URL -c "\dt" | grep -E "normsets|position_suggestions"
```

### If Migration 008 Not Yet Run:

```bash
# Already handled by БЫСТРОЕ_РЕШЕНИЕ.sql
# But if needed separately:
psql $DATABASE_URL -f backend/migrations/008_enable_ai_suggestion_flag.sql
```

---

## 🎯 SESSION GOALS

### Primary Goals:
1. ✅ Verify ✨ button visible in UI
2. ✅ Test AI suggestion functionality
3. ✅ Confirm audit trail working
4. ✅ Create PR for merge

### Secondary Goals:
1. Add accept/reject endpoints (if time permits)
2. Frontend UI for suggestions history
3. Documentation updates (CLAUDE.md)

### Stretch Goals:
1. Admin UI for feature flags
2. Normsets management UI
3. Portal dashboard integration

---

## 📝 CONTEXT REMINDER

**What Was Done:**
- Implemented backend audit trail for AI suggestions
- Created Migration 007 (portal integration tables)
- Created Migration 008 (enable feature flag)
- Built 5 automatic tools to enable AI button
- Discovered button exists since Dec 2025 but hidden by flag

**Current State:**
- Code: ✅ Complete and committed
- Migrations: ✅ Created, ⏳ Not executed
- Feature Flag: ⏳ Disabled (empty project_config)
- Button: ❌ Not visible (waiting for flag)

**Blocking Issue:**
- project_config table empty/missing
- Need user to execute БЫСТРОЕ_РЕШЕНИЕ.sql

**Solution Ready:**
- SQL script: БЫСТРОЕ_РЕШЕНИЕ.sql
- Instructions: ИНСТРУКЦИЯ_RENDER.txt
- User needs 5 minutes in Render Dashboard

---

## 🗂️ KEY FILES REFERENCE

```
Monolit-Planner/
├── SESSION_2026-01-21_PORTAL_INTEGRATION.md  ← Full session summary
├── NEXT_SESSION.md                           ← This file
├── БЫСТРОЕ_РЕШЕНИЕ.sql                       ← SQL to enable flag
├── ИНСТРУКЦИЯ_RENDER.txt                     ← User guide (Russian)
├── backend/
│   ├── migrations/
│   │   ├── 007_portal_integration.sql
│   │   └── 008_enable_ai_suggestion_flag.sql
│   └── src/routes/
│       └── positions.js                      ← Enhanced with audit trail
└── frontend/src/components/
    └── PositionRow.tsx                       ← ✨ button (existing)
```

---

## 🤖 SUGGESTED OPENING MESSAGE

```
Привет! Продолжаю работу с предыдущей сессии.

Вчера мы работали над Portal Integration и AI Suggestion кнопкой.

Краткий статус:
✅ Код готов (6 коммитов запушены)
✅ Документация готова
⏳ Ожидаем: ты должен выполнить SQL скрипт

Вопрос: ты успел выполнить SQL из файла БЫСТРОЕ_РЕШЕНИЕ.sql
в Render Dashboard?

Если да - проверим работу кнопки ✨
Если нет - помогу сделать это прямо сейчас (5 минут)

Что скажешь?
```

---

## 📖 DOCUMENTATION TO UPDATE

After successful verification:

### 1. Update CLAUDE.md:
```markdown
### ✅ COMPLETED: Portal Integration + AI Suggestion Enablement (2026-01-21)

**Branch:** `claude/create-onboarding-guide-E4wrx`

**Summary:**
- Enhanced AI suggestions with audit trail (position_suggestions table)
- Created Migration 007 (portal_project_id + normsets)
- Created Migration 008 (enable FF_AI_DAYS_SUGGEST)
- Built 5 automatic enablement tools
- Enabled ✨ AI suggestion button in Monolit Planner

**Key Commits:**
| Commit | Description |
|--------|-------------|
| 5f44a4a | Portal integration backend |
| 64d6a0c | Audit trail enhancement |
| abe3ea5 | Migration 008 |
| 47eadc5 | Automatic tools |
| ce30dc9 | Russian docs |
| e602ec9 | SQL fix |

**Files Changed:** 13 files, ~1630 lines added
```

### 2. Update README.md (if exists):
- Add AI Suggestion feature to features list
- Document ✨ button usage
- Link to session summary

### 3. Create PR Description:
Use SESSION_2026-01-21_PORTAL_INTEGRATION.md as PR body

---

## ⚡ QUICK COMMANDS CHEATSHEET

```bash
# Status check
git status && git log --oneline -5

# Read session summary
less Monolit-Planner/SESSION_2026-01-21_PORTAL_INTEGRATION.md

# Verify API config
curl -s https://monolit-planner-api.onrender.com/api/config | jq

# Test health
curl -s https://monolit-planner-api.onrender.com/health

# Show SQL script
cat Monolit-Planner/БЫСТРОЕ_РЕШЕНИЕ.sql

# Show user instructions
cat Monolit-Planner/ИНСТРУКЦИЯ_RENDER.txt

# Create PR (after verification)
gh pr create --title "Portal Integration: AI Suggestions Audit Trail" \
  --body-file Monolit-Planner/SESSION_2026-01-21_PORTAL_INTEGRATION.md
```

---

**End of Next Session Guide**
**Ready to start next session!** 🚀
