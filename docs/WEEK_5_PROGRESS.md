# Week 5-6 Progress - Unified Registry Frontend

**Branch:** `feature/unified-registry-frontend`  
**Started:** 2025-01-XX  
**Status:** 🚧 IN PROGRESS

---

## ✅ Completed (Day 1 - 2 hours)

### 1. Registry API Client
**File:** `Monolit-Planner/frontend/src/api/registryApi.ts`

**Functions:**
- `getProjectPositions(projectId)` - Get all positions for project
- `getPositionById(positionId)` - Get single position details

**Interfaces:**
- `PositionInstance` - Unified position data structure

### 2. RegistryView Page
**File:** `Monolit-Planner/frontend/src/pages/RegistryView.tsx`

**Features:**
- List all position_instances for project
- Filter by kiosk_type (monolit, registry_tov)
- Search by description/catalog_code
- Kiosk type badges with colors
- Table view with key columns

### 3. UnifiedPositionModal Component
**File:** `Monolit-Planner/frontend/src/components/UnifiedPositionModal.tsx`

**Features:**
- Detail view for single position
- Show all position data
- Expandable monolith_payload (JSON)
- Modal overlay with close button

---

## 🔜 Next Steps (Day 2-3 - 4-6 hours)

### 1. Sidebar Integration
**File:** `Monolit-Planner/frontend/src/components/Sidebar.tsx`

**Tasks:**
- [ ] Add "Registry" tab after "Objekty"
- [ ] Link to RegistryView page
- [ ] Show position count badge

### 2. Routing Setup
**File:** `Monolit-Planner/frontend/src/App.tsx` (or router config)

**Tasks:**
- [ ] Add route `/registry/:projectId`
- [ ] Add route `/registry/position/:positionId`

### 3. Cross-Kiosk Navigation
**Files:** Multiple

**Tasks:**
- [ ] Add deep link support with `?position_instance_id=...`
- [ ] From Monolit → Registry TOV link
- [ ] From Registry TOV → Monolit link

---

## 📊 Time Tracking

| Task | Estimated | Actual | Status |
|------|-----------|--------|--------|
| Registry API | 1h | 0.5h | ✅ Done |
| RegistryView | 2h | 1h | ✅ Done |
| UnifiedPositionModal | 1h | 0.5h | ✅ Done |
| Sidebar Integration | 2h | - | 🔜 Next |
| Routing | 1h | - | 🔜 Next |
| Cross-kiosk Nav | 3h | - | 🔜 Next |
| Styling & UX | 4h | - | ⏳ Later |
| **Total** | **14h** | **2h** | **14%** |

---

## 🎯 Goals

### Week 5 (8-12 hours)
- ✅ Registry API client
- ✅ RegistryView page
- ✅ UnifiedPositionModal
- 🔜 Sidebar integration
- 🔜 Routing setup

### Week 6 (6-10 hours)
- 🔜 Cross-kiosk navigation
- 🔜 Styling & UX polish
- 🔜 Testing with real data
- 🔜 Documentation

---

## 📝 Notes

### Design Decisions
- Minimal UI - focus on functionality
- Reuse existing Monolit styles
- Table view for position list
- Modal for detail view

### Technical Decisions
- TypeScript interfaces for type safety
- Fetch API for HTTP requests
- React hooks for state management
- No external dependencies

---

**Next Session:** Add Sidebar integration + Routing
