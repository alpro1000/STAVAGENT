# 🏗️ Registr Rozpočtů (Rozpočet Registry)

**Version:** 2.0.0
**Status:** ✅ Production Ready (All 7 Phases Complete)
**Platform:** Browser-only (React + TypeScript + Vite)
**Project:** STAVAGENT Ecosystem

---

## 📋 Description

**Rozpočet Registry** is a browser-based Bill of Quantities (BOQ) management and analysis tool with advanced Excel import/export capabilities.

### Key Features:

- 📥 **Excel Import System** — Template-based import with auto-detection (ÚRS, OTSKP, RTS)
- 🛠️ **Custom Templates** — Visual ConfigEditor for custom Excel cell mapping
- 🤖 **Auto-Classification** — 32 work groups with regex-based classification engine
- 🔍 **Fuzzy Search** — Multi-project search with Fuse.js and advanced filters
- ✨ **Match Highlighting** — Character-level precision highlighting
- 📤 **Excel Export** — 3-sheet workbook with clickable HYPERLINK formulas
- 📊 **Statistics** — Automatic calculation of counts, totals, and group distribution
- 📁 **Multi-Project** — Work with multiple projects simultaneously
- 💾 **localStorage** — All data persisted in browser (no backend required)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

Application runs at: http://localhost:5173

---

## 🏗️ Architecture

### Tech Stack

- **Frontend:** React 18 + TypeScript 5.3
- **Build Tool:** Vite 7.x (lightning-fast HMR)
- **State Management:** Zustand with localStorage persistence
- **Styling:** Tailwind CSS 3 + Digital Concrete Design System v2.0
- **Tables:** TanStack Table v8
- **Excel Processing:** SheetJS (xlsx library)
- **Search Engine:** Fuse.js 7.0 (fuzzy search)
- **Icons:** Lucide React

### Architecture Diagram

```
Browser Only (No Backend)
         ↓
┌────────────────────────────┐
│   React 18 + TypeScript    │
├────────────────────────────┤
│  Zustand Store             │ ← State + localStorage
├────────────────────────────┤
│  SheetJS (xlsx)            │ ← Excel parsing/export
│  Fuse.js                   │ ← Fuzzy search
├────────────────────────────┤
│  localStorage              │ ← Persistence layer
└────────────────────────────┘
```

---

## 📚 Data Structures

### ParsedItem

```typescript
interface ParsedItem {
  id: string;                    // UUID
  kod: string;                   // Item code (e.g., "231112")
  popis: string;                 // Main description
  popisFull?: string;            // Full description
  mnozstvi: number;              // Quantity
  mj: string;                    // Unit of measurement
  cenaJednotkova?: number;       // Unit price
  cenaCelkem?: number;           // Total price
  skupina: string | null;        // Work group (classified)
  source: ItemSource;            // Source (project, sheet, row)
}
```

### Project

```typescript
interface Project {
  id: string;                    // UUID
  fileName: string;              // Original file name
  uploadDate: string;            // ISO timestamp
  items: ParsedItem[];           // Array of parsed items
  templateUsed: string;          // Template ID used for import
}
```

---

## 🎨 Design System

**Digital Concrete v2.0 / Brutalist Neumorphism**

- **Philosophy:** UI elements as concrete blocks
- **Colors:** Monochrome palette + orange accent (#FF9F1C)
- **Typography:** JetBrains Mono (tabular numbers, monospace)
- **Shadows:** Neumorphic elevation (multi-layer shadows)
- **Surface Hierarchy:**
  1. Level 0: Textured background (#e5e5e5 with grid)
  2. Level 1: Clean panels (raised, soft shadows)
  3. Level 2: Data surfaces (flat, content containers)

---

## 📖 Implementation Phases

### ✅ Phase 1: Design System (commit: ec1baa4)
- Digital Concrete v2.0 design tokens
- Brutalist neumorphism components
- 3-level surface hierarchy
- Typography system (JetBrains Mono)

### ✅ Phase 2: Template Selector (commit: e7c12c5)
- 3 predefined import templates (ÚRS, OTSKP/KROS, RTS)
- Template preview with metadata
- Template-based Excel parsing
- Sheet selection UI

### ✅ Phase 3: Custom Templates (commit: b85f0b9)
- Visual ConfigEditor (370 lines)
- Column letter inputs (A-Z validation)
- Metadata cell configuration
- Custom template save/load to localStorage

### ✅ Phase 4: Auto-Detection (commit: a61a5c0)
- Structure detector (330 lines)
- Keyword matching engine
- Code pattern detection (ÚRS/OTSKP/RTS)
- Confidence scoring (HIGH/MEDIUM/LOW)
- Top 3 template suggestions

### ✅ Phase 5: Auto-Classification (commit: 76733d6)
- 32 work groups with regex rules
- Priority system (HIGH: 100, MEDIUM: 50-90, LOW: 10-30)
- Bulk classification service
- Classification statistics and suggestions

### ✅ Phase 6: Multi-Project Search (commit: d61ae73)
- Fuse.js fuzzy search integration
- Weighted search keys (kod: 40%, popis: 30%, popisFull: 20%)
- Advanced filters (project, skupina, price range, classification)
- Match highlighting with character-level precision
- Empty state and loading state UI

### ✅ Phase 7: Excel Export (commit: d61ae73)
- 3-sheet workbook generation:
  1. **Položky** — Items with clickable HYPERLINK formulas
  2. **Souhrn** — Statistics (counts, totals, groups)
  3. **Metadata** — Project info and export details
- HYPERLINK formulas to jump back to items in browser
- Statistics calculation (total items, classified/unclassified, group distribution)

---

## 🔍 Key Features Deep Dive

### Excel Import

**Supported Formats:**
- .xlsx (Office Open XML)
- .xls (Binary Excel format)

**Templates:**
1. **ÚRS (Jednotné resortní soupisy)** — Czech construction standard
2. **OTSKP/KROS** — Price catalog format
3. **RTS** — Alternative format

**Auto-Detection:**
- Scans first 20 rows for keywords
- Detects code patterns (digits, letter+digits, dash format)
- Assigns confidence score (0-100%)
- Suggests best matching template

### Classification System

**32 Work Groups:**
```
Výkopy, Základy, Izolace, Železobeton, Zdivo, Omítky, Obklady,
Podlahy, Dveře, Okna, Schodiště, Střecha, Klempířství, Elektroinstalace,
VZT, Zdravotní technika, Vytápění, Zateplení, Fasády, Zámečnictví,
Truhlářství, Malování, Povrchy, Zemní práce, Komunikace, Terénní úpravy,
Oplocení, Technologie, Stroje, Zařízení, Vybavení, Ostatní
```

**Classification Rules:**
- Regex-based pattern matching
- Priority system (HIGH/MEDIUM/LOW)
- Keyword extraction
- Confidence scoring (0-100%)

### Search System

**Fuzzy Search:**
- Powered by Fuse.js 7.0
- Threshold: 0.4 (balance precision/recall)
- Min match length: 2 characters

**Weighted Keys:**
- kod: 40% — Highest priority
- popis: 30% — Main description
- popisFull: 20% — Full description
- mj: 5% — Unit
- skupina: 5% — Group

**Filters:**
- Project IDs (multi-select)
- Skupiny (work groups, multi-select)
- Price range (min/max, cenaCelkem)
- Classification status (all/classified/unclassified)

### Excel Export

**Sheet 1: Položky (Items)**
```
Columns: Kód | Popis | Množství | MJ | Cena jednotková | Cena celkem | Skupina | Odkaz
```

**HYPERLINK Formula:**
```excel
=HYPERLINK("http://localhost:5173/#/project/{id}/item/{id}", "Otevřít")
```

**Sheet 2: Souhrn (Summary)**
- Total items count
- Classified items count
- Unclassified items count
- Total cost (sum of cenaCelkem)
- Groups distribution table

**Sheet 3: Metadata**
- Project name
- File name
- Import date
- Total items
- Export date

---

## 📊 Bundle Size

**Production Build:**
```
dist/index.html                   0.46 kB │ gzip:   0.30 kB
dist/assets/index-bxPToaCZ.css   23.37 kB │ gzip:   5.86 kB
dist/assets/index-MlTmCYK8.js   759.52 kB │ gzip: 244.16 kB
```

**Total:** 759.52 KB (uncompressed) → 244.16 kB (gzipped)

---

## 🗂️ Project Structure

```
rozpocet-registry/
├── src/
│   ├── components/
│   │   ├── config/
│   │   │   └── ConfigEditor.tsx          # Visual template editor (370 lines)
│   │   ├── import/
│   │   │   ├── ImportModal.tsx           # Import wizard
│   │   │   └── TemplateSelector.tsx      # Template picker
│   │   ├── search/
│   │   │   ├── SearchBar.tsx             # Search UI (220 lines)
│   │   │   └── SearchResults.tsx         # Results display (172 lines)
│   │   └── ...
│   ├── services/
│   │   ├── parser/
│   │   │   └── excelParser.ts            # Excel parsing logic
│   │   ├── search/
│   │   │   └── searchService.ts          # Fuse.js integration (209 lines)
│   │   ├── export/
│   │   │   └── excelExportService.ts     # Excel export (260 lines)
│   │   ├── classification/
│   │   │   ├── classificationRules.ts    # 32 work groups (330 lines)
│   │   │   └── classificationService.ts  # Classification logic (180 lines)
│   │   └── autoDetect/
│   │       └── structureDetector.ts      # Auto-detection (330 lines)
│   ├── store/
│   │   └── projectStore.ts               # Zustand store
│   ├── config/
│   │   ├── templates.ts                  # Predefined templates
│   │   └── defaultConfig.ts              # Base configuration
│   ├── App.tsx                           # Main application
│   └── main.tsx                          # Entry point
├── public/
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 🧪 Testing

### Manual Testing Checklist

**Import:**
- [x] Upload Excel file (.xlsx, .xls)
- [x] Template selection (ÚRS, OTSKP, RTS)
- [x] Auto-detection with confidence scoring
- [x] Custom template creation
- [x] Sheet selection
- [x] Multi-sheet parsing

**Classification:**
- [x] Auto-classify on import
- [x] Manual classification
- [x] Bulk operations
- [x] Statistics display

**Search:**
- [x] Fuzzy search across projects
- [x] Filter by skupina
- [x] Filter by price range
- [x] Filter by classification status
- [x] Match highlighting
- [x] Clear search

**Export:**
- [x] Excel download
- [x] 3 sheets generated
- [x] HYPERLINK formulas work
- [x] Links open correct items
- [x] Statistics accurate

---

## 🤝 STAVAGENT Ecosystem

Rozpočet Registry is a standalone tool in the STAVAGENT ecosystem.

**Related Services:**
- **concrete-agent** — CORE AI system (Python FastAPI)
- **stavagent-portal** — Main portal (Node.js)
- **Monolit-Planner** — Concrete cost calculator (Node.js)
- **URS_MATCHER_SERVICE** — URS matching (Node.js)

---

## 📝 Documentation

**Session Summaries:**
- `SESSION_2026-01-16_PHASE6_7.md` — Phase 6 & 7 implementation (comprehensive)
- `/home/user/STAVAGENT/CLAUDE.md` — STAVAGENT system overview (v1.3.6)

**Design System:**
- Digital Concrete v2.0 design tokens
- Brutalist Neumorphism UI philosophy
- 3-level surface hierarchy

---

## 🚀 Deployment

**Development:**
```bash
npm run dev    # http://localhost:5173
```

**Production:**
```bash
npm run build  # Generate dist/ folder
npm run preview # Preview production build
```

**Static Hosting:**
- Deploy `dist/` folder to any static host
- No backend required (browser-only)
- Recommended: Vercel, Netlify, GitHub Pages

---

## 📄 License

Part of STAVAGENT Ecosystem © 2026

---

## 🏆 Status

**Version:** 2.0.0
**Status:** ✅ Production Ready
**All 7 Phases:** Complete
**Last Updated:** 2026-01-16
