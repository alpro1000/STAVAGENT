# Next Session - Quick Start

**Last Updated:** 2026-02-03 (11:30 UTC)
**Current Branch:** `claude/update-deployment-docs-cSIO1`
**Last Session:** Rozpočet Registry UX Fixes (Excel Export + Modal Colors)

---

## 🚀 Quick Start Commands

```bash
# Current working directory
cd /home/user/STAVAGENT

# Check branch and status
git status
git log --oneline -5

# Pull latest changes
git pull origin claude/update-deployment-docs-cSIO1

# Start development (choose service)
cd rozpocet-registry && npm run dev                  # Rozpočet Registry (Vite)
cd URS_MATCHER_SERVICE/backend && npm run dev        # URS Matcher backend
cd URS_MATCHER_SERVICE/frontend && npm run dev       # URS Matcher frontend
cd Monolit-Planner/backend && npm run dev            # Monolit backend
cd Monolit-Planner/frontend && npm run dev           # Monolit frontend
cd concrete-agent && npm run dev:backend             # CORE backend
```

---

## 📋 Recent Work (2026-02-03)

### ✅ LATEST: Rozpočet Registry UX Fixes (11:30 UTC)

**Problems Fixed:**
1. **Excel Export Grouping** - Price Request export grouped by Skupina instead of main → subordinates
2. **Modal Colors** - "Attach to Parent" modal used pure black instead of corporate slate palette

**Solutions:**
- `c54238a` - FIX: Excel export grouping - main items → subordinates structure
- `a210e55` - STYLE: Modal colors - use Digital Concrete slate palette

**Files changed:**
- `rozpocet-registry/src/services/priceRequest/priceRequestService.ts` (+87 -93)
- `rozpocet-registry/src/components/items/RowActionsCell.tsx` (+6 -6)

**Status:** ✅ Pushed to `claude/update-deployment-docs-cSIO1`

**Details:** See `docs/archive/completed-sessions/SESSION_2026-02-03_ROZPOCET_UX_FIXES.md`

---

### ✅ Completed Earlier Today: Deployment Timeout Fixes

**What was fixed:**
- Redis connection hang (10s timeout + fallback)
- MinerU parsing timeout (2min → 5min)

**Commits:**
- `6d1ca88` - FIX: Add Redis connection timeout
- `08c43bd` - FIX: Increase MinerU timeout to 5 minutes

**Session Summary:** See `docs/archive/completed-sessions/DEPLOYMENT_FIX_2026-02-03.md`

---

### ✅ Completed Earlier: Document Work Extraction Pipeline

**What was built:**
- Full pipeline: PDF → MinerU → LLM → TSKP → Deduplication → Batch
- Backend: `documentExtractionService.js` (520 lines)
- Frontend: Extraction UI with stats cards

**Session Summary:** See `docs/archive/completed-sessions/SESSION_2026-02-03_DOCUMENT_EXTRACTION.md`

---

## 🎯 Next Tasks (Priority Order)

### 1. Test Rozpočet Registry Changes (High Priority)
- [ ] Deploy to Vercel (rozpocet-registry is static)
- [ ] Test Excel export with real data (Poptávka)
- [ ] Verify main items have +/- collapse buttons
- [ ] Verify subordinates are indented and hidden by default
- [ ] Test modal colors on different screens
- [ ] Verify no Skupina group headers appear

### 2. Merge or Create PR
- [ ] Review changes in `claude/update-deployment-docs-cSIO1`
- [ ] Create PR if needed
- [ ] Merge to main branch

### 3. Document Extraction Testing (Next Priority)
- [ ] Test with real PDF documents (sample: `203_01_Techn zprava.pdf`)
- [ ] Verify MinerU parsing works correctly
- [ ] Check LLM extraction produces valid structured data
- [ ] Test TSKP matching accuracy
- [ ] Verify deduplication (85% threshold)

### 4. Monitor Performance
- [ ] Check MinerU response times (target: <2 min)
- [ ] Monitor LLM extraction times (target: <90s)
- [ ] Check memory usage for large PDFs

### 5. Documentation Updates
- [ ] Update `CLAUDE.md` Recent Activity table
- [ ] Update `rozpocet-registry/README.md` if needed

---

## 🔧 Known Issues

### ✅ All Fixed (2026-02-03)
✅ Excel export grouping → Fixed with hierarchy structure
✅ Modal colors → Fixed with slate palette
✅ Redis connection hang → Fixed with 10s timeout
✅ MinerU parsing timeout → Fixed with 5min timeout

### 💡 Potential Enhancements
- Czech label mapping for work groups (UX)
- Data migration for users with old group names in localStorage
- Caching for TSKP matches in Price Request
- Progressive UI updates for document extraction

---

## 🏗️ Architecture Context

### Rozpočet Registry - Excel Export (Price Request)

**New Structure:**
```
Main item 1 (+ collapse button, Excel outline level 0)
  ├─ ↳ Subordinate 1.1 (hidden, Excel outline level 1)
  └─ ↳ Subordinate 1.2 (hidden, Excel outline level 1)
Main item 2 (+ collapse button, Excel outline level 0)
  ├─ ↳ Subordinate 2.1 (hidden, Excel outline level 1)
  └─ ↳ Subordinate 2.2 (hidden, Excel outline level 1)
SUM row
```

**Outline Levels Mapping:**
- Level 0: Header/SUM row (always visible, no outline)
- Level 1: Main items (outline level 0, can have children, visible)
- Level 2: Subordinates (outline level 1, hidden by default, indented)

**Key Code:**
```typescript
wsItems['!rows'] = outlineLevels.map((level, idx) => {
  if (idx === 0) return { hpx: 28 };        // Header
  else if (level === 0) return { hpx: 22 }; // SUM
  else if (level === 1) return { level: 0, hpx: 20 }; // Main
  else if (level === 2) return { level: 1, hidden: true, hpx: 20 }; // Sub
  return {};
});
```

### Modal - Digital Concrete Colors

**Palette:**
- Backdrop: `#020617` (slate-950, 100% opaque)
- Modal border: `border-slate-900` (#0f172a)
- Header: `bg-slate-900` (#0f172a)
- Header border: `border-slate-700` (#334155)
- Content: `bg-slate-100` (#f1f5f9)

**Z-index Layering:**
- Backdrop: `z-[99998]`
- Modal: `z-[99999]`
- Header: `z-[100000]`

**Positioning:**
```typescript
style={{
  transform: 'translate(-50%, -50%)',
  left: '50%',
  top: '50%'
}}
```

---

## 📝 Important Notes

### Deployment
- **Branch:** `claude/update-deployment-docs-cSIO1`
- **Must start with:** `claude/`
- **Must end with:** matching session ID
- **Push command:** `git push -u origin claude/update-deployment-docs-cSIO1`

### Git Retry Logic
- **Fetch/Pull/Push failures:** Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s)
- **Network errors only:** Don't retry permission errors

### Testing Rozpočet Registry
```bash
cd /home/user/STAVAGENT/rozpocet-registry
npm install
npm run dev     # Start Vite on :5173
npm run build   # Production build
```

### Build Verification
```bash
cd /home/user/STAVAGENT/rozpocet-registry
npx vite build
# Expected: ✓ Built in ~11s, 1771 modules
```

---

## 🔍 Debug Commands

```bash
# Check rozpočet-registry
cd /home/user/STAVAGENT/rozpocet-registry
npm run dev
# Open: http://localhost:5173

# Test Excel export locally
# 1. Import items with main/subordinate structure
# 2. Use search to filter items
# 3. Click "Vytvořit poptávku"
# 4. Download Excel file
# 5. Open in Excel/LibreOffice
# 6. Verify +/- buttons appear next to main items
# 7. Click + to expand subordinates

# Check modal styling
# 1. Filter to show subordinate items
# 2. Click Link2 icon (Připojit k hlavní položce)
# 3. Verify backdrop is slate-950 (dark gray, not black)
# 4. Verify modal border is slate-900
# 5. Verify header is slate-900
# 6. Verify modal is centered

# Git log
git log --oneline --graph -10
```

---

## 📚 Documentation Files

### Main Documentation
- `CLAUDE.md` - System overview (v2.0.2)
- `NEXT_SESSION.md` - **THIS FILE** - Quick start for next session
- `BACKLOG.md` - Pending tasks and priorities
- `README.md` - Project overview (Russian)

### Service Documentation
- `concrete-agent/CLAUDE.md` - CORE system (v2.4.1)
- `Monolit-Planner/CLAUDE.MD` - Monolit kiosk (v4.3.8)
- `rozpocet-registry/README.md` - BOQ Registry (v2.1.0)
- `URS_MATCHER_SERVICE/README.md` - URS Matcher

### Session Archives
- `docs/archive/completed-sessions/SESSION_2026-02-03_ROZPOCET_UX_FIXES.md` - **Latest session**
- `docs/archive/completed-sessions/DEPLOYMENT_FIX_2026-02-03.md`
- `docs/archive/completed-sessions/SESSION_2026-02-03_DOCUMENT_EXTRACTION.md`
- Previous sessions in same directory

---

## 🚦 Service Status

| Service | Status | URL | Port (Dev) |
|---------|--------|-----|------------|
| concrete-agent | ✅ Running | https://concrete-agent.onrender.com | 8000 |
| stavagent-portal | ✅ Running | https://stav-agent.onrender.com | 3001 |
| Monolit-Planner API | ✅ Running | https://monolit-planner-api.onrender.com | 3001 |
| Monolit-Planner Frontend | ✅ Running | https://monolit-planner-frontend.onrender.com | 5173 |
| URS_MATCHER_SERVICE | ✅ Running | https://urs-matcher-service.onrender.com | 3001 (BE), 3000 (FE) |
| rozpocet-registry | ✅ Static | Vercel | 5173 |

---

## 🎓 Context for Claude

### What Just Happened (Latest Session)

**Fixed two UX issues in rozpočet-registry:**

1. ✅ **Excel export grouping** - Changed Price Request export from Skupina-based grouping to hierarchy-based (main items → subordinates). Now main items show with +/- collapse buttons, subordinates are indented with "  ↳ " marker and hidden by default.

2. ✅ **Modal colors** - Updated "Attach to Parent" modal to use Digital Concrete corporate slate palette instead of pure black. Backdrop now uses slate-950 (#020617), modal border and header use slate-900, while maintaining 100% opacity and correct z-index layering.

**User Requirements:**
- User provided screenshot showing Excel export with Skupina group headers (wrong structure)
- User wanted main items → subordinates (like regular Excel export)
- User requested corporate color scheme (slate palette) instead of pure black
- Layer issue was already fixed (100% opacity, z-index correct), just needed color update

**Files Modified:**
- `rozpocet-registry/src/services/priceRequest/priceRequestService.ts` - Excel export hierarchy
- `rozpocet-registry/src/components/items/RowActionsCell.tsx` - Modal colors

### Key Technical Decisions

**Excel Export:**
- Outline levels: 0 (header/SUM), 1 (main items), 2 (subordinates)
- Main items: Excel outline level 0, can have children, visible
- Subordinates: Excel outline level 1, hidden by default, indented
- Removed Skupina group headers completely

**Modal Colors:**
- Backdrop: `#020617` (slate-950) - still 100% opaque
- Border/Header: `slate-900` (#0f172a)
- Borders: `slate-700` (#334155)
- Z-index preserved: z-[99998], z-[99999], z-[100000]

### Current State
- ✅ Both fixes committed and pushed
- ✅ Build verified (TypeScript compilation successful)
- ✅ Branch: `claude/update-deployment-docs-cSIO1`
- ⏳ Testing in production pending

### Next Actions
1. **Deploy to Vercel** - rozpocet-registry is static hosting
2. **Test Excel export** - Verify main items have +/- buttons, subordinates hidden
3. **Test modal colors** - Verify slate palette on different screens
4. **Create PR or merge** - If testing successful

---

**Ready for next session!** 🚀
