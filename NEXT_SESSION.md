# Next Session Starter Commands

**Date Created:** 2026-01-26
**Last Session:** Classification System Migration
**Branch:** `claude/review-session-notes-4I53w`

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
echo "📅 Date: 2026-01-26"
echo "✨ Feature: Classification System Migration"
echo "🔧 Branch: claude/review-session-notes-4I53w"
echo "📊 Status: ✅ Complete, pushed to remote"
echo "📝 Commits: 19c29ff (classification), a6c084f (horizontal scrolling)"
echo ""
echo "📚 Read these files for context:"
echo "  1. /home/user/STAVAGENT/CLAUDE.md (System overview - v1.4.0)"
echo "  2. /home/user/STAVAGENT/rozpocet-registry/SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md"
echo "  3. /home/user/STAVAGENT/concrete-agent/packages/core-backend/app/classifiers/rules/default_rules.yaml"
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

### 2. Last Session Summary
```bash
cat /home/user/STAVAGENT/rozpocet-registry/SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md | head -200
```

**Contains:**
- Classification system migration details
- 10 work groups (ZEMNI_PRACE, BETON_MONOLIT, etc.)
- Scoring algorithm explanation
- All test cases
- Files modified

### 3. Classification Rules (Source of Truth)
```bash
cat /home/user/STAVAGENT/concrete-agent/packages/core-backend/app/classifiers/rules/default_rules.yaml | head -100
```

**Contains:**
- Python YAML rules (source of truth)
- All 10 work groups with patterns
- Include/exclude keywords
- Priority settings

---

## Recommended Next Tasks

### Option 1: Test Classification Results
Test the new classification system with real Excel files:

```bash
cd /home/user/STAVAGENT/rozpocet-registry

# Run dev server
npm run dev

# In browser: http://localhost:5173
# 1. Import Excel file with construction items
# 2. Enable auto-classification
# 3. Verify work groups show uppercase codes:
#    - ZEMNI_PRACE (not "Výkopy")
#    - BETON_MONOLIT (not "Beton - monolitický")
#    - KOTVENI (not VYZTUŽ for anchoring items)
```

**Test Cases:**
- "ČERPÁNÍ VODY HLOUBENÍ JAM" → ZEMNI_PRACE ✅
- "OBRUBNÍKY Z BETONOVÝCH DÍLCŮ" → BETON_PREFAB ✅ (not BETON_MONOLIT)
- "MOSTNÍ KONSTRUKCE ZE ŽELEZOBETONU" → BETON_MONOLIT ✅
- "KOTVY TRVALÉ TYČOVÉ" → KOTVENI ✅ (not VYZTUŽ)
- "DOPRAVA BETONU AUTOCERPADLEM" → DOPRAVA ✅ (not BETON_MONOLIT)

### Option 2: Add Czech Label Mapping (UX Enhancement)
Users might prefer Czech labels in UI instead of uppercase codes:

```bash
cd /home/user/STAVAGENT/rozpocet-registry

# Create label mapping
cat > src/utils/groupLabels.ts << 'EOF'
import type { WorkGroup } from './constants';

export const GROUP_LABELS: Record<WorkGroup, string> = {
  ZEMNI_PRACE: 'Zemní práce',
  BETON_MONOLIT: 'Beton - monolitický',
  BETON_PREFAB: 'Beton - prefabrikát',
  VYZTUŽ: 'Výztuž',
  KOTVENI: 'Kotvení',
  BEDNENI: 'Bednění',
  PILOTY: 'Piloty',
  IZOLACE: 'Izolace',
  KOMUNIKACE: 'Komunikace',
  DOPRAVA: 'Doprava',
};

export function getGroupLabel(skupina: WorkGroup): string {
  return GROUP_LABELS[skupina] || skupina;
}
EOF

# Update SearchResults.tsx to use labels
# Replace: {item.skupina}
# With: {getGroupLabel(item.skupina)}
```

### Option 3: Add Evidence Display in UI
Show matched keywords in classification panel:

```bash
cd /home/user/STAVAGENT/rozpocet-registry

# Update ItemsTable.tsx or create ClassificationPanel.tsx
# Display:
# - Work Group: ZEMNI_PRACE
# - Confidence: 100%
# - Matched Keywords: [cerpani vody, hloubeni, jam, pazeni]
# - Rule Hit: ZEMNI_PRACE.include[cerpani vody, hloubeni]
```

### Option 4: Data Migration for Existing Users
Check if localStorage has old group names and migrate:

```bash
cd /home/user/STAVAGENT/rozpocet-registry

# Create migration script
cat > src/utils/migrateGroups.ts << 'EOF'
import type { WorkGroup } from './constants';

const GROUP_MIGRATION_MAP: Record<string, WorkGroup> = {
  'Výkopy': 'ZEMNI_PRACE',
  'Zemní práce': 'ZEMNI_PRACE',
  'Násypy': 'ZEMNI_PRACE',
  'Beton - monolitický': 'BETON_MONOLIT',
  'Beton - prefabrikát': 'BETON_PREFAB',
  'Obrubníky': 'BETON_PREFAB',
  'Výztuž': 'VYZTUŽ',
  'Kotvení': 'KOTVENI',
  'Bednění': 'BEDNENI',
  'Piloty': 'PILOTY',
  'Izolace': 'IZOLACE',
  'Komunikace': 'KOMUNIKACE',
  'Doprava': 'DOPRAVA',
};

export function migrateOldGroup(oldGroup: string): WorkGroup | null {
  return GROUP_MIGRATION_MAP[oldGroup] || null;
}
EOF
```

### Option 5: Create Pull Request
If testing is complete, create PR to merge to main:

```bash
cd /home/user/STAVAGENT/rozpocet-registry

# Ensure all changes committed
git status

# Create PR description
cat > PR_DESCRIPTION.md << 'EOF'
# Classification System Migration to Rule-Based Uppercase Codes

## Summary
Complete migration from 25 Czech work group names to 10 standardized uppercase codes, matching Python YAML classifier in concrete-agent.

## Changes
- **Work Groups:** 25 → 10 (ZEMNI_PRACE, BETON_MONOLIT, etc.)
- **Classifier:** Complete rewrite (336 lines) with scoring algorithm
- **Scoring:** +1.0 include, -2.0 exclude, +0.5 unit boost, +0.3 priority
- **UI:** Fixed horizontal scrolling for project/sheet tabs

## Commits
- `19c29ff` - FEAT: Migrate classification to rule-based system
- `a6c084f` - FIX: Prevent infinite horizontal expansion

## Testing
- ✅ TypeScript compilation successful
- ✅ Build successful (11.09s)
- ⏳ Manual testing pending

## Files Modified
- `src/utils/constants.ts` (28 lines, rewrite)
- `src/services/classification/classificationRules.ts` (336 lines, rewrite)
- `src/App.tsx` (+6 lines)

## Breaking Changes
⚠️ Work group names changed from Czech to uppercase codes. May affect:
- localStorage data (migration may be needed)
- UI display (Czech labels optional)
- Search filters
- Export files

## Documentation
- SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md (1200+ lines)

## Version
rozpocet-registry v2.1.0 (Classification 2.0.0)
EOF

echo "✅ PR description created: PR_DESCRIPTION.md"
echo "🔗 Create PR at: https://github.com/alpro1000/STAVAGENT/compare/main...claude/review-session-notes-4I53w"
```

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
git checkout -b claude/add-label-mapping-X7YzK

# Example: Add Czech label mapping
git checkout -b claude/add-czech-labels-M9pQw
```

### Commit Changes
```bash
git add <files>
git commit -m "$(cat <<'EOF'
FEAT: Add Czech label mapping for work groups

Added human-readable Czech labels for uppercase work group codes.
Users now see "Zemní práce" instead of "ZEMNI_PRACE" in UI.

Changes:
- Created src/utils/groupLabels.ts with label mapping
- Updated SearchResults.tsx to use getGroupLabel()
- Updated ItemsTable.tsx to display Czech labels
- Updated filters to show Czech labels

Files:
- src/utils/groupLabels.ts (NEW - 20 lines)
- src/components/search/SearchResults.tsx (+2 lines)
- src/components/items/ItemsTable.tsx (+2 lines)
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

### Monolit Planner
```bash
cd /home/user/STAVAGENT/Monolit-Planner

# Backend
cd backend && npm run dev    # Port 3001

# Frontend
cd frontend && npm run dev   # Port 5173
```

### Concrete Agent (CORE)
```bash
cd /home/user/STAVAGENT/concrete-agent

# Install
npm install

# Backend (Python)
npm run dev:backend          # Port 8000

# Frontend (React)
npm run dev:frontend         # Port 5173

# Run classifier tests
cd packages/core-backend
python app/classifiers/tests/test_work_classifier.py
```

---

## Production URLs

| Service | URL |
|---------|-----|
| concrete-agent (CORE) | https://concrete-agent.onrender.com |
| stavagent-portal | https://stav-agent.onrender.com |
| Monolit-Planner Frontend | https://monolit-planner-frontend.onrender.com |
| Monolit-Planner API | https://monolit-planner-api.onrender.com |
| URS_MATCHER_SERVICE | https://urs-matcher-service.onrender.com |
| Rozpočet Registry | Static hosting (Vercel/Netlify/GitHub Pages) |

---

## Documentation Structure

```
/home/user/STAVAGENT/
├── CLAUDE.md                                      # System overview (v1.4.0)
├── NEXT_SESSION.md                                # This file
├── rozpocet-registry/
│   ├── SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md  # Last session (1200+ lines)
│   ├── SESSION_2026-01-16_PHASE6_7.md             # Phase 6 & 7 (search + export)
│   ├── README.md                                  # Project overview (v2.1.0)
│   └── src/
│       ├── utils/constants.ts                     # 10 work groups (NEW)
│       └── services/classification/
│           ├── classificationRules.ts             # 336 lines (NEW)
│           └── classificationService.ts           # Wrapper
├── concrete-agent/
│   └── packages/core-backend/app/classifiers/
│       ├── README.md                              # Python classifier docs
│       ├── work_classifier.py                     # Main classifier
│       ├── rules/
│       │   ├── default_rules.yaml                 # Source of truth (10 groups)
│       │   └── corrections.yaml                   # Self-learning
│       └── tests/
│           └── test_work_classifier.py            # 8/8 tests passing
└── Monolit-Planner/
    └── CLAUDE.MD                                  # Monolit docs (v4.3.8)
```

---

## Key Concepts Refresher

### Work Groups (10 total)

| Code | Czech Name | Examples |
|------|------------|----------|
| ZEMNI_PRACE | Zemní práce | výkopy, hloubění, pažení, čerpání vody |
| BETON_MONOLIT | Beton - monolitický | betonáž, železobeton, konstrukce |
| BETON_PREFAB | Beton - prefabrikát | obrubníky, dílce, prefabrikát |
| VYZTUŽ | Výztuž | výztuž, armatura, kari, pruty |
| KOTVENI | Kotvení | kotvy, injektáž, tyčové/lanové |
| BEDNENI | Bednění | bednění, systémové, tvarové |
| PILOTY | Piloty | piloty, mikropiloty, vrtané |
| IZOLACE | Izolace | hydroizolace, geotextilie, fólie |
| KOMUNIKACE | Komunikace | vozovka, asfalt, chodník, dlažba |
| DOPRAVA | Doprava | doprava betonu, odvoz zeminy |

### Priority Rules

1. **KOTVENI** > VYZTUŽ
   - "KOTVY TRVALÉ" → KOTVENI (not VYZTUŽ)

2. **BETON_PREFAB** > BETON_MONOLIT
   - "OBRUBNÍKY Z DÍLCŮ" → BETON_PREFAB (not BETON_MONOLIT)

3. **BETON_PREFAB** > KOMUNIKACE
   - "BETONOVÉ OBRUBNÍKY" → BETON_PREFAB (not KOMUNIKACE)

4. **DOPRAVA** > BETON_MONOLIT
   - "DOPRAVA BETONU" → DOPRAVA (not BETON_MONOLIT)

### Scoring Algorithm

```typescript
score = 0

// +1.0 for each include match
for (keyword in rule.include) {
  if (text.includes(keyword)) score += 1.0
}

// -2.0 for each exclude match (strong penalty)
for (keyword in rule.exclude) {
  if (text.includes(keyword)) score -= 2.0
}

// +0.5 for unit boost
if (unit in rule.boostUnits) score += 0.5

// +0.3 for priority conflicts
if (rule.priorityOver.length > 0) {
  for (target in rule.priorityOver) {
    if (scores[target] > 0) score += 0.3
  }
}

// Return best match (highest score > 0)
confidence = min(100, (score / 2.0) * 100)
```

---

## Troubleshooting

### Issue: TypeScript Errors
```bash
cd /home/user/STAVAGENT/rozpocet-registry
npm run build

# If errors, check:
# 1. WorkGroup type matches constants.ts
# 2. All imports updated
# 3. No old Czech names in code
```

### Issue: Classification Not Working
```bash
# Check browser console for errors
# Verify constants.ts imported correctly
# Check classificationRules.ts has all 10 groups
# Test with simple case: "VYKOP JAM" → ZEMNI_PRACE
```

### Issue: Old Group Names Appear
```bash
# Clear browser localStorage
localStorage.clear()

# Or implement migration (see Option 4 above)
```

### Issue: Horizontal Scrolling Broken
```bash
# Check App.tsx has wrapper divs:
# <div className="w-full overflow-hidden">
#   <div className="flex overflow-x-auto">
```

---

## Session Checklist

Before starting work:
- [ ] Read CLAUDE.md (system overview)
- [ ] Read last session summary (SESSION_2026-01-26_*.md)
- [ ] Check git status and branch
- [ ] Review recent commits (git log -10)
- [ ] Understand current task

After completing work:
- [ ] Run TypeScript compilation (npm run build)
- [ ] Test changes manually
- [ ] Commit with descriptive message
- [ ] Push to remote branch
- [ ] Update CLAUDE.md with session info
- [ ] Create session summary (SESSION_*.md)
- [ ] Update NEXT_SESSION.md

---

## Contact & Resources

**Repository:** https://github.com/alpro1000/STAVAGENT

**Branch Naming Pattern:** `claude/<task-description>-<random5chars>`

**Commit Message Format:**
```
FEAT: Add new feature
FIX: Fix bug
REFACTOR: Refactor code
DOCS: Update documentation
STYLE: Style changes
TEST: Add tests
```

**Documentation Standards:**
- Session summaries: 1000+ lines with detailed explanations
- Code comments: Minimal, only where logic is complex
- Commit messages: Multi-line with context

---

**Last Updated:** 2026-01-26
**Version:** NEXT_SESSION v1.0.0
**Status:** ✅ Ready for next session

---
