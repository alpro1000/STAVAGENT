# 🏗️ Monolit Planner

**Full-stack web application for planning and calculating concrete bridge structures in Czech Republic**

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Status](https://img.shields.io/badge/status-Phase%204%20Complete-brightgreen)

---

## 📋 Overview

Monolit Planner is a comprehensive planning tool designed for bridge construction projects in the Czech Republic. It enables:

- **Import XLSX** cost estimates for bridges (SO201, SO202...)
- **Convert ALL costs to a unified metric: CZK/m³ of concrete** (even if source unit is m², kg, ks...)
- **Calculate KROS values** with proper rounding (step 50 CZK)
- **Estimate project duration** in months and weeks based on labor costs
- **Toggle work mode**: 30 days/month (continuous) or 22 days/month (working days)
- **Export to XLSX/CSV** for KROS4 integration
- **Deploy frontend and backend separately** on Render

---

## ✨ Key Features

### 🎯 Core Functionality

1. **Universal Cost Metric: CZK/m³ of concrete**
   - All subtypes (beton, bednění, výztuž, etc.) → converted to **CZK/m³ of concrete element**
   - Enables fair comparison across different work types
   - Example:
     - `beton` (43.8 m³) → **CZK/m³**
     - `bednění` (63.6 m²) → **CZK/m³** (formwork cost per m³ of concrete)
     - `výztuž` (2100 kg) → **CZK/m³** (reinforcement cost per m³ of concrete)

2. **KROS Rounding**
   - Formula: `ceil(unit_cost_on_m3 / 50) × 50`
   - Examples:
     - 729 CZK/m³ → 750 CZK (KROS)
     - 1079 CZK/m³ → 1100 CZK (KROS)

3. **Duration Calculation**
   - **Months**: `sum_kros_total_czk / (avg_crew × avg_wage × avg_shift × days_per_month)`
   - **Weeks**: `estimated_months × days_per_month / 7`
   - **Toggle**: 30 days (continuous) or 22 days (working days)

4. **OTSKP Integration** ⭐ NEW
   - **17,904 construction codes** from Czech OTSKP catalog
   - **Accent-insensitive search** (v1.2.0): Find "ZÁKLADY" by searching "zaklady" or "27 211" by searching "27211"
   - **Autocomplete search** by code or name with flexible matching
   - **Automatic code lookup** (v1.2.0): When parsing XLSX estimates, system automatically finds matching OTSKP codes by work name and type
   - **Auto-fill position names** from catalog
   - **Two-level structure**: Bridge parts (with OTSKP) → Work positions

5. **Work Type Management** ⭐ NEW
   - **Visual selector** for work types: beton, bednění, výztuž, oboustranné (opěry), jiné
   - **Smart defaults**: Each type has predefined unit (M3, m2, t, ks)
   - **Dual creation modes**:
     - Type 1: Add bridge parts (ZÁKLADY, ŘÍMSY) with OTSKP search
     - Type 2: Add work rows (betonování, bednění) with work type selector

6. **Project Hierarchy** ⭐ NEW
   - **Collapsible folders** by project_name
   - **Visual organization**: Project → Bridges → Bridge ID
   - **Quick navigation** with expand/collapse

7. **Smart Estimate Parsing** ⭐ NEW v1.2.0
   - **Auto-find concrete work positions** when uploading XLSX estimates
   - **Prefabricated elements filter**: Automatically excludes non-monolithic prefab items (prefa, dilce, díl, hotov)
   - **Type-specific OTSKP matching**:
     - "beton" items → searches for BETONOVÁNÍ/BETON codes
     - "bednění" items → searches for BEDNAŘENÍ codes
     - "výztuž" items → searches for VÝZTUŽ/OCEL codes
   - **Three-level fallback**: Extract from Excel → Auto-find by name → NULL
   - **Automatic table generation**: Creates position rows with quantities and OTSKP codes ready to use

8. **Responsive Design**
   - **Desktop** (>1024px): Full 4-column KPI grid, expanded sidebar, all details visible
   - **Tablet** (769-1024px) ⭐ NEW v1.2.0: 3-column KPI grid, 250px sidebar, touch-friendly 40-44px targets
   - **Mobile** (≤768px): 2-column KPI grid, collapsed sidebar, optimized spacing
   - **Touch-optimized**: All buttons and inputs have minimum 40px height (Apple HIG compliance)
   - **Font sizes**: 16px on inputs to prevent iOS auto-zoom

9. **RFI System**
   - Highlights missing critical data (but doesn't block calculations)
   - Warnings for:
     - Missing concrete volume reference
     - Empty days field
     - Unmapped columns

10. **Formula Transparency**
    - Every number shows clear formula on hover
    - All calculations are traceable
    - Tooltips on all interactive elements

### 🎨 Design

- **Concrete-themed UI**: Light gray backgrounds, industrial feel
- **Orange input cells**: `#FFA726` background for all editable fields
- **Computed fields**: Gray readonly cells with bold values
- **KROS cells**: Green background for final values
- **Responsive**: Works on desktop, tablet, and mobile

---

## 🎯 Version 2.0.0 - Phase 4 Complete (November 2025)

### ✨ Major Features Added

1. **User Management System** ✅
   - Email verification (Phase 1)
   - User dashboard with profile management (Phase 2)
   - Admin panel with user administration (Phase 3)
   - Audit logging for all admin actions
   - Role-based access control (user/admin)

2. **Document Upload & Analysis** ✅
   - Excel/KROS document import with validation
   - Asynchronous document analysis
   - Multi-role audit and AI enrichment
   - Work list generation from analyzed documents
   - Material extraction and OTSKP code detection

3. **Professional Excel Export** ✅
   - Dynamic Excel formulas (labor hours, costs, KROS totals)
   - Professional formatting (zebra striping, freeze panes, auto-fit)
   - Multiple data formats (m³, m², kg, ks)
   - Summary totals with SUM formulas
   - RFI highlighting for missing data

4. **Performance Optimization** ✅
   - Fixed project creation hangs (8-10x faster)
   - Fixed file upload hangs (10-20x faster)
   - Added 60-second API timeout for all requests
   - Batch database inserts instead of loops

### 📊 Phase Completion Status

| Phase | Feature | Status | Commits |
|-------|---------|--------|---------|
| Phase 1 | Email Verification | ✅ Complete | 2 |
| Phase 2 | User Dashboard & Password Reset | ✅ Complete | 1 |
| Phase 3 | Admin Panel & Audit Logging | ✅ Complete | 2 |
| Phase 4 | Document Upload & Analysis | ✅ Complete | 2 |
| **Phase 5+** | Concrete-Agent Integration | 🔲 Ready | TBD |

---

## 🎯 Version 1.2.0 Enhancements (November 2025 Early)

### ✨ What's New

1. **Accent-Insensitive OTSKP Search**
   - Search functionality now handles Czech diacritics (ě, á, ř, ý, etc.)
   - Find "ZÁKLADY" by searching "zaklady", "základy", or "ZAKLADY"
   - Code search supports flexible formatting: "27211" matches "27 211"
   - Powered by Unicode NFD normalization with database pre-computation
   - **Files**: `backend/src/utils/text.js`, `backend/src/routes/otskp.js`

2. **Automatic OTSKP Code Lookup**
   - When uploading XLSX estimates, system automatically matches work items to OTSKP codes
   - Uses three-level fallback: Excel extraction → Name-based search → NULL
   - Type-specific filtering for concrete work: beton, bednění, výztuž, základy
   - Detailed logging of all matches for debugging
   - **Files**: `backend/src/routes/upload.js`

3. **Prefabricated Elements Filter**
   - Estimate parsing now excludes non-monolithic prefab elements
   - Filtered keywords: prefa, prefabricated, dilce, díl, hotov, prefab
   - Logged as skipped items for debugging
   - Ensures only monolithic concrete work is included
   - **Files**: `backend/src/routes/upload.js`

4. **Tablet Responsive Design**
   - Optimized layout for iPad landscape and Android tablets (769-1024px)
   - Touch-friendly button/input sizes: minimum 40-44px heights
   - 3-column KPI grid (vs 4 on desktop, 2 on mobile)
   - 250px sidebar remains visible (not collapsed)
   - 16px input font size to prevent iOS auto-zoom
   - **Files**: `frontend/src/styles/components.css` (164 lines of tablet-specific CSS)

5. **Database Enhancements**
   - New `search_name` field in `otskp_codes` table with pre-computed normalized text
   - Automatic migration for 17,904 existing codes
   - New index `idx_otskp_search_name` for O(log n) search performance
   - **Files**: `backend/src/db/init.js`, `backend/scripts/import-otskp.js`

6. **Production OTSKP Import**
   - Created `POST /api/otskp/import` endpoint for on-demand code import on production servers
   - Token-based authorization with `OTSKP_IMPORT_TOKEN` environment variable
   - Fail-closed security: Returns 401 if token not configured
   - Multiple file path fallbacks for different deployment scenarios
   - **Files**: `backend/src/routes/otskp.js`

### 🐛 Bugs Fixed (P1 Priority)

| Bug | Symptom | Fix |
|-----|---------|-----|
| **SQLite Case-Sensitivity** | "základy" → 0 results, "ZÁKLADY" → 71 results | Added `UPPER()` to search queries |
| **Route Ordering** | `/count` endpoint unreachable (caught by `/:code`) | Reordered: /search → /count → /stats/summary → /:code → /import |
| **Authorization Bypass** | Hardcoded fallback token "default-token-change-this" | Fail-closed: return 401 if `OTSKP_IMPORT_TOKEN` env var missing |
| **Production Code Gap** | Render had 0 OTSKP codes, local dev had 17,904 | Created secure import endpoint requiring token auth |

### ✅ What Works

- ✅ Accent-insensitive search works for all 17,904 OTSKP codes
- ✅ Automatic code lookup finds matches by work name with type filtering
- ✅ Prefabricated elements properly excluded from estimate parsing
- ✅ Tablet responsive design verified on iPad/Android tablet viewport sizes
- ✅ Database migration runs automatically on first start
- ✅ Import endpoint successfully imports all 17,904 codes with proper validation
- ✅ Security: No hardcoded secrets, fail-closed authorization

### ⚠️ Known Issues & Limitations

1. **Production OTSKP Import** (User Action Required)
   - After deploying to Render, user must manually:
     1. Set `OTSKP_IMPORT_TOKEN` environment variable in Render Dashboard
     2. Execute `POST /api/otskp/import` with correct token header
   - Import script is development-only and doesn't run automatically on production startup

2. **Tablet Testing**
   - Tested in Chrome DevTools mobile emulation
   - Recommend testing on actual iPad/Android tablet device for final validation
   - Orientation switching (portrait ↔ landscape) may need additional tweaks

3. **Code Lookup Matching**
   - Fuzzy matching is name-based only (not specification-based)
   - Works best with standardized estimate column names (e.g., "Betonování základů")
   - Custom or non-standard item names may not find matches automatically

### 📚 Documentation

- **claude.md**: Complete session development notes with code flows and technical details
- **CHANGELOG.md**: Detailed changelog with all changes, commits, and impact analysis
- **COMPONENTS.md**: Component documentation with v1.2.0 technical specifications

---

## 🏛️ Architecture

### Monorepo Structure

```
monolit-planner/
├── backend/           # Node.js + Express + SQLite
│   ├── src/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic (calculator, parser, exporter)
│   │   ├── models/    # Data models
│   │   ├── db/        # Database initialization
│   │   └── utils/     # Logger, error handler
│   ├── server.js      # Express app
│   └── package.json
│
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/     # UI components
│   │   │   ├── Header.tsx              # Main header with bridge selector
│   │   │   ├── Sidebar.tsx             # Project hierarchy sidebar
│   │   │   ├── PositionsTable.tsx      # Main table with positions
│   │   │   ├── PositionRow.tsx         # Editable table row
│   │   │   ├── PartHeader.tsx          # Part header with OTSKP
│   │   │   ├── KPIPanel.tsx            # KPI metrics panel
│   │   │   ├── WorkTypeSelector.tsx    # Modal: Select work type ⭐ NEW
│   │   │   ├── NewPartModal.tsx        # Modal: Create part with OTSKP ⭐ NEW
│   │   │   ├── OtskpAutocomplete.tsx   # OTSKP search autocomplete
│   │   │   ├── SnapshotBadge.tsx       # Snapshot lock indicator
│   │   │   ├── DaysPerMonthToggle.tsx  # 30/22 days toggle
│   │   │   └── ...other components
│   │   ├── hooks/          # React Query hooks
│   │   ├── services/       # API client
│   │   ├── context/        # Global state
│   │   ├── styles/         # CSS (concrete + orange theme)
│   │   └── pages/
│   ├── vite.config.ts
│   └── package.json
│
├── shared/            # Shared types and formulas
│   ├── src/
│   │   ├── types.ts      # TypeScript interfaces
│   │   ├── formulas.ts   # Calculation logic
│   │   └── constants.ts  # Defaults, colors
│   └── package.json
│
├── render.yaml        # Render deployment config
├── DEPLOY.md          # Deployment guide
└── README.md
```

### Tech Stack

**Backend:**
- Node.js 18+
- Express.js
- SQLite (better-sqlite3)
- XLSX parser (xlsx)
- Multer (file uploads)

**Frontend:**
- React 18
- TypeScript 5
- Vite 5
- TanStack React Query
- Axios

**Shared:**
- TypeScript (types + formulas)
- Shared business logic

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Git

### Installation

1. **Clone repository**
   ```bash
   git clone https://github.com/alpro1000/Monolit-Planner.git
   cd Monolit-Planner
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**

   Backend (`backend/.env`):
   ```env
   NODE_ENV=development
   PORT=3001
   DB_PATH=./data/monolit.db
   CORS_ORIGIN=http://localhost:5173
   ```

   Frontend (`frontend/.env`):
   ```env
   VITE_API_URL=http://localhost:3001
   ```

4. **Start development servers**

   **Option A: Both services at once**
   ```bash
   npm run dev
   ```

   **Option B: Separately**
   ```bash
   # Terminal 1 - Backend
   npm run dev:backend

   # Terminal 2 - Frontend
   npm run dev:frontend
   ```

5. **Open browser**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001/health

---

## 📊 Data Model

### Position (Pozice)

| Field | Type | Description |
|-------|------|-------------|
| `bridge_id` | string | SO201, SO202... |
| `part_name` | string | ZÁKLADY, ŘÍMSY, OPĚRY... |
| `subtype` | enum | beton \| bednění \| výztuž \| ... |
| `unit` | string | M3, m2, kg, ks... |
| `qty` | number | Quantity in native unit |
| `crew_size` | number | People in crew (default: 4) |
| `wage_czk_ph` | number | CZK/hour (default: 398) |
| `shift_hours` | number | Hours/day (default: 10) |
| `days` | number | Days to complete |
| **`unit_cost_on_m3`** | number | **⭐ KEY METRIC: CZK/m³ of concrete** |
| `kros_unit_czk` | number | Rounded KROS unit price |
| `kros_total_czk` | number | Total KROS cost |

### Header KPI

| Field | Description |
|-------|-------------|
| `sum_kros_total_czk` | Total KROS cost for bridge |
| `project_unit_cost_czk_per_m3` | CZK/m³ (project avg) |
| `project_unit_cost_czk_per_t` | CZK/t (ρ=2.4 t/m³) |
| `estimated_months` | ⭐ Duration in months |
| `estimated_weeks` | ⭐ Duration in weeks |
| `avg_crew_size` | Weighted average crew size |
| `avg_wage_czk_ph` | Weighted average wage |
| `days_per_month` | 30 or 22 (toggle) |

---

## 🔧 API Endpoints

### Bridges

```http
GET    /api/bridges              # List all bridges
GET    /api/bridges/:id          # Get single bridge
POST   /api/bridges/:id          # Update bridge metadata
```

### Positions

```http
GET    /api/positions?bridge_id=SO201&include_rfi=true
POST   /api/positions            # Create positions
PUT    /api/positions            # Update positions
DELETE /api/positions/:id        # Delete position
```

Response includes:
```json
{
  "positions": [...],
  "header_kpi": {
    "sum_kros_total_czk": 3616344.90,
    "estimated_months": 2.1,
    "estimated_weeks": 9.0,
    ...
  },
  "rfi_summary": { "count": 2, "issues": [...] }
}
```

### Upload

```http
POST   /api/upload               # Upload XLSX file
```

### Export

```http
GET    /api/export/xlsx?bridge_id=SO201
GET    /api/export/csv?bridge_id=SO201&delimiter=;
```

### Config

```http
GET    /api/config               # Get configuration
POST   /api/config               # Update config (e.g., days_per_month_mode)
```

---

## 📐 Formulas

### 1. Labor Cost

```
labor_hours = crew_size × shift_hours × days
cost_czk = labor_hours × wage_czk_ph
```

### 2. Concrete Volume

```
FOR subtype = "beton":
  concrete_m3 = qty

FOR other subtypes:
  concrete_m3 = qty_beton (from beton row of same part_name)
  → If not found: RFI warning + manual input
```

### 3. Unit Cost per m³ (KEY!)

```
unit_cost_on_m3 = cost_czk / concrete_m3

This converts ALL subtypes to CZK/m³ of concrete!
```

### 4. KROS Rounding

```
kros_unit_czk = ceil(unit_cost_on_m3 / 50) × 50
kros_total_czk = kros_unit_czk × concrete_m3
```

### 5. Project KPI

```
sum_concrete_m3 = Σ(concrete_m3 for subtype="beton")
sum_kros_total_czk = Σ(kros_total_czk for all positions)

project_unit_cost_czk_per_m3 = sum_kros_total_czk / sum_concrete_m3
project_unit_cost_czk_per_t = project_unit_cost_czk_per_m3 / 2.4
```

### 6. Weighted Averages

```
avg_crew_size = Σ(crew_size × concrete_m3) / Σ(concrete_m3)
avg_wage_czk_ph = Σ(wage_czk_ph × concrete_m3) / Σ(concrete_m3)
avg_shift_hours = Σ(shift_hours × concrete_m3) / Σ(concrete_m3)
```

### 7. Duration ⭐ NEW

```
estimated_months = sum_kros_total_czk /
                   (avg_crew_size × avg_wage_czk_ph × avg_shift_hours × days_per_month)

estimated_weeks = estimated_months × days_per_month / 7

where days_per_month = 30 or 22 (toggle)
```

---

## 🎨 Color Palette

```css
/* Concrete */
--light-concrete: #F5F5F5
--medium-concrete: #E8E8E8
--divider-border: #D0D0D0

/* Accent */
--primary-action: #1E5A96   /* Dark blue */
--secondary: #F39C12         /* Orange */
--success: #27AE60           /* Green */
--error: #E74C3C             /* Red */

/* Input cells - ORANGE! */
--input-bg: #FFA726          /* Apricot orange */
--input-border: #FF9800
--input-focus: #FF7043

/* Table */
--computed-cells: #F0F0F0    /* Gray */
--kros-success-bg: #F0FFF4   /* Light green */
--rfi-warning: #FEE8E8       /* Light red */
```

---

## 🚀 Deployment (Render)

See [DEPLOY.md](./DEPLOY.md) for detailed instructions.

**Quick start:**

1. Push to GitHub
2. Connect Render to repository
3. Render auto-detects `render.yaml`
4. Deploy both services automatically

**URLs:**
- Backend: `https://monolit-planner-api.onrender.com`
- Frontend: `https://monolit-planner-frontend.onrender.com`

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Upload XLSX file with bridge data
- [ ] Verify all columns are mapped correctly
- [ ] Check that beton positions calculate `concrete_m3` from `qty`
- [ ] Check that non-beton positions reference beton volume
- [ ] Verify `unit_cost_on_m3` is calculated correctly for all subtypes
- [ ] Verify KROS rounding (should round up to nearest 50)
- [ ] Toggle days/month (30 ↔ 22) and verify duration recalculates
- [ ] Edit input fields (orange cells) and verify calculations update
- [ ] Export XLSX and verify all data is correct
- [ ] Export CSV and verify formatting

### Unit Tests (TODO)

```bash
npm test
```

---

## 📝 Feature Flags

Located in `shared/src/constants.ts`:

```typescript
{
  FF_AI_DAYS_SUGGEST: false,      // AI-powered days estimation
  FF_PUMP_MODULE: false,           // Concrete pump calculations
  FF_ADVANCED_METRICS: false,      // Speed analysis
  FF_DARK_MODE: false,             // Dark theme
  FF_SPEED_ANALYSIS: false         // m²/day speed tracking
}
```

Enable via API:
```http
POST /api/config
{
  "feature_flags": {
    "FF_DARK_MODE": true
  }
}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

---

## 🙏 Acknowledgments

- Built for bridge construction planning in Czech Republic
- Designed for KROS4 integration
- Formula transparency for auditing

---

## 📧 Contact

- **Repository**: https://github.com/alpro1000/Monolit-Planner
- **Issues**: https://github.com/alpro1000/Monolit-Planner/issues

---

## 🗺️ Roadmap

- [ ] AI-powered days estimation
- [ ] Concrete pump cost calculator
- [ ] Speed analysis (m²/day tracking)
- [ ] Multi-language support (EN, DE)
- [ ] PDF report generation
- [ ] Integration with accounting systems
- [ ] Mobile app (React Native)

---

**Made with 🏗️ for bridge builders in Czech Republic**
