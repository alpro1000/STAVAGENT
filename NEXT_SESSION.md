# Next Session Starter Commands

**Date Created:** 2026-01-28
**Last Session:** Row Classification Improvements (díl/section detection)
**Branch:** `claude/general-work-gsxXr`

---

## Quick Start Command

Copy and paste this command to start the next session with full context:

```bash
# Navigate to repository
cd /home/user/STAVAGENT

# Show current status
echo "=== GIT STATUS ==="
git status

echo ""
echo "=== RECENT COMMITS ==="
git log --oneline --graph -10

echo ""
echo "=== CURRENT BRANCH ==="
git branch --show-current

echo ""
echo "=== LAST SESSION INFO ==="
echo "📅 Date: 2026-01-28"
echo "✨ Feature: Row Classification Improvements"
echo "🔧 Branch: claude/general-work-gsxXr"
echo "📊 Status: ✅ Complete, pushed to remote"
echo "📝 Commits: fcba442 (díl/section detection + cascade rowRole)"
echo ""
echo "📚 Read these files for context:"
echo "  1. /home/user/STAVAGENT/CLAUDE.md (System overview - v2.0.0)"
echo "  2. /home/user/STAVAGENT/rozpocet-registry/src/services/classification/rowClassificationService.ts"
echo "  3. /home/user/STAVAGENT/rozpocet-registry/src/stores/registryStore.ts"
```

---

## Context Files to Read

### 1. System Overview
```bash
cat /home/user/STAVAGENT/CLAUDE.md | head -100
```

**Contains:**
- Complete STAVAGENT architecture
- All 5 services (concrete-agent, portal, Monolit, URS, rozpocet-registry)
- Recent session summaries
- Current status of all branches

### 2. Row Classification Service
```bash
cat /home/user/STAVAGENT/rozpocet-registry/src/services/classification/rowClassificationService.ts | head -200
```

**Contains:**
- Row role classification (main, subordinate, section, unknown)
- Code detection patterns (URS, OTSKP, RTS, GENERIC)
- New `isDilSection()` function for ordinal-based section detection
- Parent-child relationships and BOQ line numbers

### 3. Registry Store (Zustand)
```bash
cat /home/user/STAVAGENT/rozpocet-registry/src/stores/registryStore.ts | head -300
```

**Contains:**
- `setItemSkupina` with cascade logic using rowRole
- `setItemSkupinaGlobal` for cross-project classification
- Project → Sheets → Items data structure

---

## What Was Done (2026-01-28)

### 1. Added Díl/Section Detection
New `isDilSection()` function detects section headers with:
- Small ordinal code (0-99) via `DIL_ORDINAL = /^\d{1,2}$/`
- No množství (quantity is null or 0)
- No cenaJednotkova (unit price is null or 0)
- Has popis (description text)

**Example:** kod="0", popis="Všeobecné konstrukce a práce" → `role: 'section'`

### 2. Fixed Cascade Logic
`setItemSkupina` and `setItemSkupinaGlobal` now use `rowRole`:
- Target item: `rowRole === 'main'` (with fallback to kod check)
- Stop cascade when: `rowRole === 'main' || rowRole === 'section'`
- Section headers now properly break the cascade chain

### 3. Files Changed
| File | Changes |
|------|---------|
| `rowClassificationService.ts` | +27 lines (isDilSection + step 3b) |
| `registryStore.ts` | +19/-10 lines (rowRole cascade) |

---

## Recommended Next Tasks

### Option 1: Add Inline Skupina Creation
Allow users to create new skupina directly in the table cell:
- Two ways to create: inline + Správa skupin modal
- Edit only in Správa skupin (for consistency)

### Option 2: Test Díl Detection
Import Excel file with díl sections and verify:
- kod=0, 1, 2... with no quantity → `role: 'section'`
- Section rows break cascade
- Classification doesn't cascade to next díl

### Option 3: Add Row Role Indicators
Show row role in UI:
- Main: normal display with line number
- Subordinate: indented with light gray
- Section: bold header style
- Unknown: warning indicator

---

## Git Commands Reference

### Check Status
```bash
cd /home/user/STAVAGENT/rozpocet-registry
git status
git log --oneline -10
git diff HEAD~1
```

### Create New Branch (if needed)
```bash
# Pattern: claude/<task-description>-<random>
git checkout -b claude/add-inline-skupina-X7YzK
```

### Commit Changes
```bash
git add <files>
git commit -m "$(cat <<'EOF'
FEAT: Add inline skupina creation in table cells

Added ability to create new skupina directly in ItemsTable.
Two creation methods: inline cell + Správa skupin modal.
Edit functionality remains in Správa skupin only.

Changes:
- Updated SkupinaAutocomplete.tsx to allow new value creation
- Added "create new" option in dropdown
- Store updates for new skupina persistence

Files:
- src/components/items/SkupinaAutocomplete.tsx (+30 lines)
- src/stores/registryStore.ts (+15 lines)
EOF
)"
```

### Push to Remote
```bash
git push -u origin claude/<branch-name>-<random>
```

---

## Development Commands

### Rozpočet Registry (Browser-only)
```bash
cd /home/user/STAVAGENT/rozpocet-registry

# Install dependencies (if needed)
npm install

# Run development server
npm run dev
# → http://localhost:5173

# Build for production
npm run build

# Type check
npm run type-check
```

---

## Row Classification Reference

### Row Roles
| Role | Description | Has BOQ Line# |
|------|-------------|---------------|
| `main` | Item with recognized code (URS, OTSKP, RTS, 3+ digits) | Yes |
| `subordinate` | Description/note/calculation under main item | No |
| `section` | Díl/oddíl header (ordinal code, no quantity) | No |
| `unknown` | Cannot determine role | No |

### Subordinate Types
| Type | Description |
|------|-------------|
| `repeat` | Sub-index row (A195, B5) |
| `note` | Text note, no numeric data |
| `calculation` | VV row with quantities |
| `other` | Unrecognized subordinate |

### Code Detection Priority
1. VV/PP/PSC/VRN markers → subordinate
2. VV-like description (decimal multiplication) → subordinate
3. Main code (URS 6+, OTSKP A+5, RTS, 3+ digits) → main
4. Sub-index (A+1-3 digits) → subordinate repeat
5. Section header pattern (Díl:, HSV, numbered) → section
6. **Díl ordinal (0-99, no qty, no unit price)** → section (NEW)
7. No code + has parent → subordinate
8. Unknown code + has parent → subordinate
9. Otherwise → unknown

---

## Production URLs

| Service | URL |
|---------|-----|
| concrete-agent (CORE) | https://concrete-agent.onrender.com |
| stavagent-portal | https://stav-agent.onrender.com |
| Monolit-Planner Frontend | https://monolit-planner-frontend.onrender.com |
| Monolit-Planner API | https://monolit-planner-api.onrender.com |
| URS_MATCHER_SERVICE | https://urs-matcher-service.onrender.com |
| Rozpočet Registry | Static hosting (Vercel/Netlify) |

---

## Session Checklist

Before starting work:
- [ ] Read CLAUDE.md (system overview)
- [ ] Check git status and branch
- [ ] Review recent commits (git log -10)
- [ ] Understand current task

After completing work:
- [ ] Run TypeScript compilation (npm run build)
- [ ] Test changes manually
- [ ] Commit with descriptive message
- [ ] Push to remote branch
- [ ] Update CLAUDE.md with session info
- [ ] Update NEXT_SESSION.md

---

**Last Updated:** 2026-01-28
**Version:** NEXT_SESSION v1.1.0
**Status:** ✅ Ready for next session

---
