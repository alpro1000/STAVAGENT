# 🏗️ Sheathing Calculator - Formwork Calculations (Шахматный Метод)

**Status:** ✅ **Days 1-5 Complete** (Ready for testing & parser integration)
**Date Started:** November 20, 2025
**Last Updated:** November 20, 2025

---

## 📋 Overview

The **Sheathing Calculator** is a new module for Monolit-Planner that calculates formwork/sheathing construction schedules using the **checkerboard method** (шахматный метод). This allows construction teams to:

- Calculate assembly/disassembly time for formwork kits
- Determine optimal number of kits for parallel work
- Estimate project duration with staggered scheduling
- Calculate labor hours and rental costs
- See time savings vs. sequential method

### Why Checkerboard Method?

**Sequential Method (Последовательно):**
- One kit completes full cycle (assembly → curing → disassembly)
- Next kit starts only after previous finishes
- Total time = (assembly + curing + disassembly) × number_of_kits
- Long project timeline

**Staggered/Checkerboard Method (Шахматный):**
- Multiple kits work simultaneously with time offset
- While one kit cures, next kit assembles
- While one disassembles, next cures
- Total time ≈ single_cycle_days + (num_kits - 1) × shift_days
- **Significant time savings** (30-60% reduction possible)

---

## 🏛️ Architecture

### 1. **Data Structures** (`shared/src/types.ts`)

```typescript
// Main capture unit for formwork calculations
interface SheathingCapture {
  capture_id: string;           // e.g., "CAP-SO201-01"
  project_id: string;           // Bridge ID
  part_name: string;            // ZÁKLADY, PILÍŘE, MOSTOVKA...

  // Dimensions
  length_m: number;             // Length in meters
  width_m: number;              // Width in meters
  height_m?: number;            // Height (optional)
  area_m2: number;              // Sheathing area (L × W)

  // Work parameters
  assembly_norm_ph_m2: number;  // Assembly norm (man-hours/m²)
  concrete_curing_days: number; // Curing time (3-7 days)
  num_kits: number;             // Number of kits (2-4)
  work_method: 'sequential' | 'staggered'; // Work scheduling

  // Optional
  concrete_class?: string;      // C25/30, C30/37...
  daily_rental_cost_czk?: number;
  kit_type?: string;            // DOKA, PERI...
}

// Calculation results
interface SheathingCalculationResult {
  assembly_days: number;
  curing_days: number;
  disassembly_days: number;
  single_cycle_days: number;

  sequential_duration_days: number;   // Method 1
  staggered_duration_days: number;    // Method 2
  staggered_shift_days: number;       // Offset between kits

  time_savings_days?: number;
  time_savings_percent?: number;

  total_labor_hours: number;
  total_rental_cost_czk?: number;
  summary: string;
}

// Project-level defaults
interface SheathingProjectConfig {
  project_id: string;
  default_assembly_norm_ph_m2: number;
  default_concrete_curing_days: number;
  default_num_kits: number;
  default_work_method: 'sequential' | 'staggered';
  crew_size: number;
  shift_hours: number;
  days_per_month: 22 | 30;
}
```

### 2. **Calculation Formulas** (`shared/src/sheathing-formulas.ts`)

Pure functions for all calculations:

```typescript
// Assembly days = (area × assembly_norm) / (crew_size × shift_hours)
calculateAssemblyDays(area_m2, assembly_norm, crew_size, shift_hours)

// Single cycle = assembly + curing + disassembly
calculateSingleCycleDays(assemblyDays, curingDays, disassemblyDays)

// Sequential = single_cycle × num_kits
calculateSequentialDuration(singleCycleDays, numKits)

// Staggered = assembly + num_kits × shift_days + disassembly
calculateStaggredDuration(assemblyDays, curingDays, disassemblyDays, numKits)

// Main calculation (combines all)
calculateSheathing(capture: SheathingCapture, config: SheathingProjectConfig)

// Batch + stats
calculateAllCaptures(captures[], config)
calculateProjectStats(results[])
```

### 3. **Frontend Components** (`frontend/src/components/`)

**SheathingCapturesTable.tsx** - Main table component
- Displays all captures for project
- Summary statistics bar
- Edit/Delete controls
- Add new capture button
- Real-time recalculation

**SheathingCaptureRow.tsx** - Editable row
- Inline editing for all fields
- Dimension inputs (L × W × H)
- Assembly norm, kits, method
- Save/Cancel controls
- Shows calculated time savings

### 4. **Backend API** (`backend/src/routes/sheathing.js`)

```
GET    /api/sheathing/:project_id              Get all captures
POST   /api/sheathing                          Create capture
PUT    /api/sheathing/:capture_id              Update capture
DELETE /api/sheathing/:capture_id              Delete capture
GET    /api/sheathing/:project_id/config       Get project config
POST   /api/sheathing/:project_id/config       Update project config
```

### 5. **Database** (`backend/src/db/migrations.js`)

**sheathing_captures table:**
- Dimensions (length_m, width_m, height_m, area_m2)
- Work parameters (assembly_norm, curing_days, num_kits)
- Kit/rental info (kit_type, daily_rental_cost_czk)
- Work method (sequential/staggered)
- Calculated fields (optional caching)

**sheathing_project_configs table:**
- Default values per project
- Labor defaults (crew_size, shift_hours, days_per_month)
- Concrete class defaults
- Rental cost defaults

---

## 📊 Implementation Details

### Checkerboard Formula Explanation

**Optimal shift between kits:**
```
shift_days = (assembly_days + curing_days) / num_kits
```

**Staggered project duration:**
```
total_days = (num_kits - 1) × shift_days + assembly_days + curing_days + disassembly_days
```

**Example:**
- Assembly: 5 days, Curing: 5 days, Disassembly: 3 days
- Single cycle: 5 + 5 + 3 = 13 days
- With 2 kits (staggered):
  - Kit 1: Days 1-13 (assembly 1-5, curing 6-10, disassembly 11-13)
  - Kit 2: Days 6-18 (shifted by 5 days)
  - Total: 18 days instead of 26 days
  - **Savings: 8 days (31%)**

### Curing Days by Concrete Class

| Class | Default Days | Temperature Adjustment |
|-------|------|------------------------|
| C25/30 | 3-5 | -50% cold, +0% warm |
| C30/37 | 5 | standard |
| C35/45 | 7-10 | +50% cold weather |

---

## 🔄 Integration with concrete-agent

The architecture supports future integration with `concrete-agent` parsers:

**Possible Integrations (Days 6-7):**

1. **Dimension Extraction** - Parse Excel documents to auto-fill dimensions
   - Endpoint: `/api/parse-excel` (concrete-agent)
   - Use: Extract length, width, height from specification documents

2. **Assembly Norm Lookup** - Get standards from knowledge base
   - Endpoint: `/kb/search` (concrete-agent)
   - Use: Suggest assembly_norm_ph_m2 based on concrete class

3. **Cost Estimation** - Integrate with Doka Tools pricing
   - Use: Calculate daily_rental_cost_czk from kit type

**Current State:**
- API client exists: `backend/src/services/coreAPI.js`
- Can call: `parseExcelByCORE()`, `isCOREAvailable()`
- Ready to extend with dimension extraction methods

---

## 📁 File Structure

```
shared/src/
├── types.ts                      (SheathingCapture*, SheathingProjectConfig)
├── sheathing-formulas.ts         (All calculation functions)
└── index.ts                      (Exports)

frontend/src/components/
├── SheathingCapturesTable.tsx    (Main table component)
└── SheathingCaptureRow.tsx       (Editable row component)

backend/src/
├── routes/sheathing.js           (API endpoints)
└── db/migrations.js              (Tables: sheathing_captures, sheathing_project_configs)
```

---

## ✅ Completed Tasks (Days 1-5)

### Day 1: Data Structures ✅
- [x] SheathingCapture interface with all fields
- [x] SheathingCalculationResult interface
- [x] SheathingProjectConfig interface
- [x] Full TypeScript documentation

**Commit:** `ee3a91e` - Add sheathing capture types and formulas

### Day 2: Formulas ✅
- [x] calculateAssemblyDays() - Assembly time calculation
- [x] calculateDisassemblyDays() - Disassembly time (50% assembly)
- [x] calculateSingleCycleDays() - Full cycle for one kit
- [x] calculateShiftDays() - Optimal offset between kits
- [x] calculateSequentialDuration() - Sequential method
- [x] calculateStaggredDuration() - Staggered method
- [x] calculateSheathing() - Main calculation function
- [x] getCuringDays() - Temperature & class-based curing
- [x] Batch calculation functions
- [x] Project statistics aggregation

**Commit:** `ee3a91e` - Formulas in sheathing-formulas.ts

### Day 3: Frontend ✅
- [x] SheathingCapturesTable component
- [x] Project statistics bar
- [x] Captures table with real-time calculations
- [x] SheathingCaptureRow component
- [x] Inline editing for all fields
- [x] Automatic area recalculation
- [x] Edit/Delete/Save controls
- [x] Responsive styling

**Commits:**
- `dd7a3a3` - SheathingCapturesTable.tsx
- `bd544e5` - SheathingCaptureRow.tsx

### Day 4: Backend API ✅
- [x] GET /:project_id - Fetch all captures
- [x] POST / - Create new capture
- [x] PUT /:capture_id - Update capture
- [x] DELETE /:capture_id - Delete capture
- [x] GET /:project_id/config - Get project config
- [x] POST /:project_id/config - Update project config
- [x] Authentication/authorization on all routes
- [x] Ownership validation
- [x] Automatic area calculation
- [x] Proper error handling

**Commit:** `e9e1d00` - Sheathing API routes

### Day 5: Database ✅
- [x] sheathing_captures table with all fields
- [x] sheathing_project_configs table
- [x] Foreign keys and CASCADE delete
- [x] Indexes for performance
- [x] Default values

**Commit:** `12ebcbc` - Database migrations

---

## 📋 Next Steps (Days 6-7)

### Day 6: Testing & Validation
- [ ] Manual testing of full CRUD workflow
- [ ] Test checkerboard calculations with multiple scenarios
- [ ] Edge case testing (0 kits, 1 kit, high count)
- [ ] Verify time savings accuracy
- [ ] Test with various concrete classes
- [ ] Boundary testing (negative values, null fields)

### Day 7: Parser Integration & Polish
- [ ] Extend coreAPI.js with dimension extraction
- [ ] Add `/api/sheathing/parse-dimensions` endpoint
- [ ] Export functionality (PDF/Excel)
- [ ] Performance optimization
- [ ] Documentation for end-users
- [ ] Accessibility review

---

## 🧪 Testing Scenarios

### Test Case 1: Simple Sequential
```
Input:
- Length: 10m, Width: 8m
- Assembly norm: 0.8 h/m²
- Curing: 5 days
- Kits: 2
- Method: sequential

Expected:
- Area: 80 m²
- Assembly: 80 × 0.8 / (4 × 10) = 1.6 → 2 days
- Disassembly: 1 day
- Cycle: 2 + 5 + 1 = 8 days
- Sequential: 8 × 2 = 16 days
```

### Test Case 2: Staggered with Savings
```
Input:
- Same as above but staggered method

Expected:
- Shift: (2 + 5) / 2 ≈ 3.5 → 4 days
- Staggered: (2-1) × 4 + 2 + 5 + 1 = 12 days
- Savings: 16 - 12 = 4 days (25%)
```

---

## 📝 Git Commit History

```
12ebcbc 🗄️ Add sheathing_captures and sheathing_project_configs database tables
e9e1d00 🔌 Add sheathing API routes for CRUD operations
bd544e5 🎨 Add SheathingCaptureRow component
dd7a3a3 🎨 Add SheathingCapturesTable frontend component
ee3a91e ✨ Add sheathing capture types and formulas
```

---

## 🚀 Deployment Checklist

- [ ] All tests passing
- [ ] Database migrations working
- [ ] Backend API endpoints responding
- [ ] Frontend components rendering
- [ ] Calculations verified
- [ ] Documentation complete
- [ ] No console errors
- [ ] Performance acceptable

---

## 📖 References

- **STAVAGENT_CONTRACT.md** - System integration contract
- **QUICK_REFERENCE.md** - API endpoints and setup
- **ARCHITECTURE.md** - System architecture
- **concrete-agent** - Parser service (separate repo)

---

**Status:** Ready for Days 6-7 (Testing & Parser Integration)
**Maintainer:** Development Team
**Last Review:** November 20, 2025
