# Week 5-6 Progress - Unified Registry Frontend

**Branch:** `feature/unified-registry-frontend`  
**Started:** 2025-01-XX  
**Status:** 🚧 IN PROGRESS

---

## ✅ Completed (Day 1-2 - 4 hours)

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
- Click row to open modal
- Back link to main app

### 3. UnifiedPositionModal Component
**File:** `Monolit-Planner/frontend/src/components/UnifiedPositionModal.tsx`

**Features:**
- Detail view for single position
- Show all position data
- Expandable monolith_payload (JSON)
- Modal overlay with close button

### 4. Routing Setup
**File:** `Monolit-Planner/frontend/src/App.tsx`

**Routes:**
- `/registry/:projectId` - Registry view for project
- Wrapped in AppProvider context

### 5. Sidebar Integration
**File:** `Monolit-Planner/frontend/src/components/Sidebar.tsx`

**Features:**
- New "Registry" section
- "Zobrazit pozice" button
- Disabled when no object selected
- Links to `/registry/:projectId`

---

## 🔜 Next Steps (Day 3 - 3-4 hours)

### 1. Cross-Kiosk Navigation
**Files:** Multiple

**Tasks:**
- [ ] Add deep link support with `?position_instance_id=...`
- [ ] From Monolit → Registry TOV link
- [ ] From Registry TOV → Monolit link
- [ ] URL parameter handling

### 2. Styling & UX Polish
**Files:** RegistryView, UnifiedPositionModal

**Tasks:**
- [ ] Match Monolit design system
- [ ] Responsive layout
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling

---

## 📊 Time Tracking

| Task | Estimated | Actual | Status |
|------|-----------|--------|--------|
| Registry API | 1h | 0.5h | ✅ Done |
| RegistryView | 2h | 1h | ✅ Done |
| UnifiedPositionModal | 1h | 0.5h | ✅ Done |
| Sidebar Integration | 2h | 1h | ✅ Done |
| Routing | 1h | 1h | ✅ Done |
| Cross-kiosk Nav | 3h | - | 🔜 Next |
| Styling & UX | 4h | - | 🔜 Next |
| **Total** | **14h** | **4h** | **29%** |

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
