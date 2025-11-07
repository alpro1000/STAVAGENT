# 🏗️ Monolit Planner

**Full-stack web application for planning and calculating concrete bridge structures in Czech Republic**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

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

3. **Duration Calculation** ⭐ NEW
   - **Months**: `sum_kros_total_czk / (avg_crew × avg_wage × avg_shift × days_per_month)`
   - **Weeks**: `estimated_months × days_per_month / 7`
   - **Toggle**: 30 days (continuous) or 22 days (working days)

4. **RFI System**
   - Highlights missing critical data (but doesn't block calculations)
   - Warnings for:
     - Missing concrete volume reference
     - Empty days field
     - Unmapped columns

5. **Formula Transparency**
   - Every number shows clear formula on hover
   - All calculations are traceable

### 🎨 Design

- **Concrete-themed UI**: Light gray backgrounds, industrial feel
- **Orange input cells**: `#FFA726` background for all editable fields
- **Computed fields**: Gray readonly cells with bold values
- **KROS cells**: Green background for final values
- **Responsive**: Works on desktop and tablet

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
│   │   ├── components/  # UI components
│   │   ├── hooks/       # React Query hooks
│   │   ├── services/    # API client
│   │   ├── context/     # Global state
│   │   ├── styles/      # CSS (concrete + orange theme)
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
