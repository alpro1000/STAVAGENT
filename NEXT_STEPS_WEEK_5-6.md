# Next Steps: Weeks 5-6 - Unified Registry Frontend Integration

**Created:** 2025-01-XX  
**Status:** 🔜 PLANNING  
**Branch:** `feature/unified-registry-frontend` (to be created)

---

## 📋 Current Status

### ✅ DONE (Weeks 1-4):
- ✅ Database schema (8 tables)
- ✅ API endpoints (11 registry + 1 export)
- ✅ File versioning (SHA-256)
- ✅ Monolit adapter
- ✅ Registry TOV adapter
- ✅ Security fixes
- ✅ Pump calculator improvements
- ✅ Integration tests (7)

### 🔜 NEXT (Weeks 5-6):
- 🔜 Registry tab in Monolit UI
- 🔜 Unified position view
- 🔜 Cross-kiosk navigation

---

## 🎯 Week 5-6 Goals

### Goal 1: Registry Tab in Monolit UI
**Priority:** OPTIONAL (можно пропустить)  
**Time:** 8-12 hours

**Features:**
1. New tab "Registry" in Monolit sidebar
2. List all position_instances for current project
3. Show kiosk_type badges (monolit, registry_tov)
4. Filter by work_category, kiosk_type
5. Search by description, catalog_code

**Files to modify:**
- `Monolit-Planner/frontend/src/components/Sidebar.tsx`
- `Monolit-Planner/frontend/src/pages/RegistryView.tsx` (NEW)
- `Monolit-Planner/frontend/src/api/registryApi.ts` (NEW)

### Goal 2: Unified Position View
**Priority:** OPTIONAL  
**Time:** 6-8 hours

**Features:**
1. Click on position → open unified view
2. Show all data: catalog_code, description, qty, unit
3. Show monolith_payload if exists
4. Show source file info (filename, version)
5. Link to original kiosk (Monolit bridge or Registry sheet)

**Files to modify:**
- `Monolit-Planner/frontend/src/components/UnifiedPositionModal.tsx` (NEW)

### Goal 3: Cross-Kiosk Navigation
**Priority:** OPTIONAL  
**Time:** 4-6 hours

**Features:**
1. From Monolit position → link to Registry TOV
2. From Registry TOV → link to Monolit calculation
3. Deep links with position_instance_id

**Example:**
```
Monolit: /bridges/SO201?position_instance_id=550e8400-...
Registry: /sheets/123?position_instance_id=550e8400-...
```

---

## 🚀 Alternative: Skip to Week 7-9 (Relink Algorithm)

**Recommendation:** Пропустить Weeks 5-6 (frontend) и сразу перейти к Week 7-9 (Relink Algorithm)

**Причины:**
1. Frontend integration не критична для MVP
2. Relink algorithm даёт больше бизнес-ценности
3. Можно вернуться к frontend позже

---

## 📊 Other Priorities

### 1. Pump Calculator - Performance Data Update
**Status:** ⏳ PENDING DECISION  
**Time:** 2-4 hours

**Issue:** Current pump performance data uses theoretical max (90-190 m³/h), but practical is 25-40 m³/h.

**Options:**
1. Add `practical_performance_m3h` field to pump_knowledge.json
2. Use coefficient (0.25x) for time calculations
3. User-selectable mode (theoretical vs practical)

**Files:**
- `rozpocet-registry/src/data/pump_knowledge.json`
- `rozpocet-registry/src/services/pumpCalculator.ts`

**Decision needed:** Какой вариант выбрать?

### 2. Formwork Rental Calculator - Next Steps
**Status:** ✅ IMPLEMENTED  
**Next:** Production testing

**Current state:**
- ✅ Calculator implemented
- ✅ API endpoint working
- ✅ UI integrated
- ⏳ Production testing needed

**Files:**
- `docs/FORMWORK_RENTAL_CALCULATOR.md` - Complete documentation
- `rozpocet-registry/src/components/tov/FormworkRentalCalculator.tsx`
- `rozpocet-registry-backend/server.js`

**Next steps:**
1. Test with real DOKA price data
2. Add more formwork systems (PERI, NOE)
3. Auto-fill from Monolit parameters

### 3. MinerU Integration
**Status:** ⚠️ STUB ONLY (NOT USED)  
**Time:** 8-12 hours (if needed)

**Current state:**
- ⚠️ `mineru_client.py` exists but is a stub
- ⚠️ `magic-pdf` NOT installed
- ✅ Currently using `pdfplumber` for PDF parsing

**Options:**
1. **Install MinerU:** `pip install magic-pdf` (10x faster PDF parsing)
2. **Remove stub:** Delete `mineru_client.py` and references
3. **Keep as-is:** Leave stub for future use

**Decision needed:** Нужен ли MinerU или удалить?

**Benefits of MinerU:**
- 10x faster PDF parsing
- Better table extraction
- OCR for scanned documents
- Formula recognition

**Drawbacks:**
- Large dependencies (~500MB)
- Complex setup (PaddleOCR)
- May not work on Render free tier

---

## 🎯 Recommended Priority Order

### Option A: Focus on Relink (Business Value)
1. ✅ Merge current PR (Unified Registry Foundation)
2. 🔜 Week 7-9: Relink Algorithm (HIGH PRIORITY)
3. 🔜 Week 10-12: Template System
4. ⏳ Weeks 5-6: Frontend Integration (LATER)

### Option B: Complete Current Track
1. ✅ Merge current PR (Unified Registry Foundation)
2. 🔜 Weeks 5-6: Frontend Integration (OPTIONAL)
3. 🔜 Week 7-9: Relink Algorithm
4. 🔜 Week 10-12: Template System

### Option C: Fix Pump Calculator First
1. ✅ Merge current PR (Unified Registry Foundation)
2. 🔜 Update pump performance data (2-4 hours)
3. 🔜 Test formwork calculator in production
4. 🔜 Week 7-9: Relink Algorithm

---

## 📝 Quick Wins (1-2 hours each)

### Quick Win 1: Update Pump Performance Data
```typescript
// Add practical_performance_m3h to pump_knowledge.json
{
  "model": "M28",
  "theoretical_performance_m3h": 136,
  "practical_performance_m3h": 35,  // NEW
  "performance_coefficient": 0.26   // NEW
}
```

### Quick Win 2: MinerU Decision
- **Option 1:** Install and test (8 hours)
- **Option 2:** Remove stub (30 minutes)
- **Option 3:** Document as "future enhancement" (15 minutes)

### Quick Win 3: Formwork Calculator Testing
- Test with 5 real projects
- Verify DOKA prices
- Document edge cases

---

## 🤔 Decision Points

### Decision 1: Weeks 5-6 Frontend Integration?
- ✅ **YES** → Implement Registry tab in Monolit UI (12-20 hours)
- ❌ **NO** → Skip to Week 7-9 Relink Algorithm (RECOMMENDED)

### Decision 2: Pump Performance Data?
- ✅ **Update now** → Add practical performance (2-4 hours)
- ❌ **Later** → Keep theoretical values for now

### Decision 3: MinerU Integration?
- ✅ **Install** → Better PDF parsing (8-12 hours)
- ❌ **Remove** → Clean up stub code (30 minutes)
- ⏸️ **Keep stub** → Document as future enhancement (15 minutes)

---

## 📋 Action Items

### Immediate (This Session):
1. [ ] Merge PR: Unified Registry Foundation
2. [ ] Decide: Skip Weeks 5-6 or implement?
3. [ ] Decide: Update pump performance data?
4. [ ] Decide: MinerU - install, remove, or keep stub?

### Next Session:
1. [ ] Start Week 7-9: Relink Algorithm (if skipping 5-6)
2. [ ] OR: Start Week 5-6: Frontend Integration
3. [ ] Update pump calculator (if decided)
4. [ ] Test formwork calculator in production

---

## 📊 Time Estimates

| Task | Time | Priority |
|------|------|----------|
| **Weeks 5-6: Frontend Integration** | 18-26 hours | OPTIONAL |
| **Week 7-9: Relink Algorithm** | 24-32 hours | HIGH |
| **Pump Performance Update** | 2-4 hours | MEDIUM |
| **Formwork Testing** | 2-3 hours | LOW |
| **MinerU Install** | 8-12 hours | LOW |
| **MinerU Remove** | 30 minutes | LOW |

---

## 🎯 Recommendation

**Skip Weeks 5-6 (Frontend) → Go directly to Week 7-9 (Relink Algorithm)**

**Reasons:**
1. Relink algorithm has higher business value
2. Frontend can be added later without blocking
3. Current API is sufficient for testing
4. Faster path to production-ready system

**Quick wins before Relink:**
1. Update pump performance data (2-4 hours)
2. Document MinerU as future enhancement (15 minutes)
3. Test formwork calculator (2-3 hours)

**Total time before Relink:** 4-7 hours (vs 18-26 hours for frontend)

---

**Next Steps:**
1. Merge current PR
2. Decide on priorities
3. Create new branch for next phase
4. Start implementation

**Questions?** Ask now!
