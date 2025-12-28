# Project Summary Module - Architecture & Implementation

**Дата:** 2025-12-28
**Версия:** 3.0 (Summary as Separate Module)
**Статус:** ✅ Готово к разработке

---

## 🎯 Концепция: Summary как отдельный элемент проекта

### Идея
**Project Summary** - это самостоятельная сущность, которая:
- Сохраняется в базу данных (отдельная таблица)
- Имеет свой lifecycle (создание → редактирование → экспорт)
- Может существовать независимо от WBS
- Экспортируется в разных форматах (PDF, Excel, JSON)
- Переиспользуется в разных kiosks (URS Matcher, Monolit Planner, и т.д.)

---

## 🏗️ Архитектура

### Вариант A: Отдельный Kiosk "Project Analyzer" ⚠️
```
Плюсы:
+ Чистая архитектура
+ Переиспользование в других kiosks
+ Независимый lifecycle

Минусы:
- Еще один kiosk для пользователя
- Усложнение навигации
- Дублирование upload логики
```

### Вариант B: Модуль в URS Matcher (РЕКОМЕНДУЕТСЯ) ✅
```
Плюсы:
+ Все в одном месте (upload → summary → WBS → URS)
+ Логичный flow
+ Меньше кликов для пользователя
+ Summary сохраняется как отдельная сущность

Минусы:
- Немного усложняет URS Matcher
```

**РЕШЕНИЕ:** Вариант B - модуль в URS Matcher с возможностью экспорта и сохранения

---

## 📊 Database Schema

### Table: project_summaries

```sql
CREATE TABLE project_summaries (
  -- Identifiers
  summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  project_type VARCHAR(50) NOT NULL,  -- bridge, building, tunnel, etc.

  -- Core Data (JSON columns)
  client_requirements JSONB NOT NULL,
  /* Example:
  {
    "main_goal": "Výstavba dvoupruhového mostu",
    "location": "Vltava, km 50.2",
    "design_life_years": 100,
    "special_requirements": [...]
  }
  */

  project_parameters JSONB NOT NULL,
  /* Example:
  {
    "bridge": {
      "span_length_m": 50,
      "deck_width_m": 12,
      "number_of_spans": 3
    }
  }
  */

  materials JSONB NOT NULL,
  /* Example:
  {
    "concrete": {
      "total_m3": 1175,
      "breakdown": {...},
      "classes_used": ["C30/37", "C35/45"]
    },
    "reinforcement": {...}
  }
  */

  cost_estimate JSONB NOT NULL,
  /* Example:
  {
    "total_czk": 45000000,
    "breakdown": {...},
    "confidence_score": 0.75
  }
  */

  timeline JSONB NOT NULL,
  /* Example:
  {
    "total_duration_months": 18,
    "milestones": [...],
    "critical_path": [...]
  }
  */

  risks_assumptions JSONB,
  /* Example:
  {
    "assumptions": [...],
    "risks": [...]
  }
  */

  documentation_quality JSONB,
  /* Example:
  {
    "completeness_score": 85,
    "missing_items": [...],
    "warnings": [...]
  }
  */

  -- Metadata
  confidence FLOAT DEFAULT 0.0,  -- Overall confidence (0-1)
  status VARCHAR(50) DEFAULT 'draft',  -- draft, approved, archived
  version INT DEFAULT 1,

  -- Source files
  source_files JSONB,  -- List of uploaded files that generated this summary
  /* Example:
  [
    {"filename": "TZ.pdf", "file_type": "technical_zadanie"},
    {"filename": "Vykresy.pdf", "file_type": "drawings"}
  ]
  */

  -- Processing metadata
  processing_metadata JSONB,
  /* Example:
  {
    "parsers_used": ["MinerU", "DrawingSpecsParser"],
    "ai_models_used": ["Gemini 2.0 Flash"],
    "processing_time_seconds": 45,
    "generated_by": "Multi-Role AI"
  }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),

  -- Relations
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_summaries_project_id ON project_summaries(project_id);
CREATE INDEX idx_summaries_status ON project_summaries(status);
CREATE INDEX idx_summaries_created_at ON project_summaries(created_at DESC);

-- Full-text search on project name
CREATE INDEX idx_summaries_project_name_gin ON project_summaries
  USING gin(to_tsvector('simple', project_name));
```

---

## 🔌 API Endpoints

### 1. Generate Summary
```http
POST /api/summaries/generate

Request:
{
  "files": [
    { "file_id": "...", "file_type": "technical_zadanie" },
    { "file_id": "...", "file_type": "specifications" },
    { "file_id": "...", "file_type": "drawings" }
  ],
  "project_type": "bridge",
  "project_name": "Most přes řeku Vltava"
}

Response:
{
  "summary_id": "sum_abc123",
  "status": "draft",
  "confidence": 0.82,
  "data": {
    "client_requirements": {...},
    "materials": {...},
    "cost_estimate": {...},
    "timeline": {...}
  },
  "processing_time_seconds": 45,
  "warnings": [
    "Chybí geologický průzkum",
    "Neúplná specifikace protihluku"
  ]
}
```

---

### 2. Get Summary
```http
GET /api/summaries/:summary_id

Response:
{
  "summary_id": "sum_abc123",
  "project_id": "proj_def456",
  "project_name": "Most přes řeku Vltava",
  "project_type": "bridge",
  "status": "approved",
  "version": 2,
  "data": {
    "client_requirements": {...},
    "materials": {...},
    "cost_estimate": {...},
    "timeline": {...}
  },
  "created_at": "2025-12-28T10:00:00Z",
  "updated_at": "2025-12-28T11:30:00Z"
}
```

---

### 3. Update Summary
```http
PUT /api/summaries/:summary_id

Request:
{
  "data": {
    "materials": {
      "concrete": {
        "total_m3": 1200  // User adjusted from 1175
      }
    },
    "cost_estimate": {
      "total_czk": 47000000  // Recalculated
    }
  },
  "updated_by": "user@example.com"
}

Response:
{
  "summary_id": "sum_abc123",
  "version": 3,  // Version incremented
  "updated_at": "2025-12-28T12:00:00Z"
}
```

---

### 4. Approve Summary
```http
POST /api/summaries/:summary_id/approve

Request:
{
  "approved_by": "user@example.com"
}

Response:
{
  "summary_id": "sum_abc123",
  "status": "approved",
  "approved_at": "2025-12-28T12:00:00Z",
  "next_step": "generate_wbs"
}
```

---

### 5. Export Summary
```http
GET /api/summaries/:summary_id/export?format=pdf

Query Parameters:
- format: pdf | excel | json
- language: cs | en (default: cs)

Response:
- Content-Type: application/pdf | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | application/json
- Content-Disposition: attachment; filename="Summary_Most_Vltava_2025-12-28.pdf"
```

**Export Formats:**

#### PDF Export
```
┌─────────────────────────────────────────┐
│  SOUHRN PROJEKTU                         │
│  Most přes řeku Vltava                   │
│  Datum: 28.12.2025                       │
├─────────────────────────────────────────┤
│                                          │
│  1. POŽADAVKY ZÁKAZNÍKA                  │
│     Hlavní cíl: Výstavba dvoupruhového   │
│     mostu přes řeku Vltava               │
│                                          │
│  2. MATERIÁLY                            │
│     Beton: 1 175 m³ (C30/37, C35/45)     │
│     Výztuž: 180 000 kg (B500B)           │
│                                          │
│  3. ODHAD NÁKLADŮ                        │
│     Celkem: 45 000 000 Kč                │
│     [Graf rozdělení nákladů]             │
│                                          │
│  4. ČASOVÝ PLÁN                          │
│     Celková doba: 18 měsíců              │
│     [Gantt chart milestones]             │
│                                          │
└─────────────────────────────────────────┘
```

#### Excel Export
```
Sheet 1: Overview
+------------------+------------------------+
| Projekt          | Most přes řeku Vltava  |
| Typ              | Bridge                 |
| Celkové náklady  | 45 000 000 Kč          |
| Doba výstavby    | 18 měsíců              |
+------------------+------------------------+

Sheet 2: Materials
+-----------+-------------+-----------+
| Material  | Quantity    | Unit      |
+-----------+-------------+-----------+
| Beton     | 1 175       | m3        |
| C30/37    | 650         | m3        |
| C35/45    | 525         | m3        |
| Výztuž    | 180 000     | kg        |
+-----------+-------------+-----------+

Sheet 3: Cost Breakdown
+-------------+----------------+-------------+
| Phase       | Amount (CZK)   | Percentage  |
+-------------+----------------+-------------+
| Založení    | 12 000 000     | 26.7%       |
| Konstrukce  | 22 000 000     | 48.9%       |
| Dokončení   | 6 000 000      | 13.3%       |
+-------------+----------------+-------------+

Sheet 4: Timeline
+-------+----------------------+----------+
| ID    | Milestone            | Days     |
+-------+----------------------+----------+
| M1    | Přípravné práce      | 30       |
| M2    | Založení             | 90       |
| M3    | Pilíře               | 120      |
+-------+----------------------+----------+
```

#### JSON Export
```json
{
  "export_metadata": {
    "exported_at": "2025-12-28T12:00:00Z",
    "exported_by": "user@example.com",
    "format": "json",
    "version": "1.0"
  },
  "summary": {
    "summary_id": "sum_abc123",
    "project_name": "Most přes řeku Vltava",
    "project_type": "bridge",
    ...full summary data...
  }
}
```

---

## 🎨 UI Design

### Main Flow

```
┌─────────────────────────────────────────┐
│  URS Matcher Kiosk                       │
│                                          │
│  [Upload TZ + Docs] → [Parse] → ...     │
└─────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────┐
│  📊 Project Summary Module (Modal)       │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ Most přes řeku Vltava              │ │
│  │ Typ: Bridge | Confidence: 82%      │ │
│  ├────────────────────────────────────┤ │
│  │                                    │ │
│  │ [Tab: Overview] [Materials] [Cost] │ │
│  │       [Timeline] [Risks]           │ │
│  │                                    │ │
│  │ ┌─ Overview ─────────────────────┐│ │
│  │ │ Požadavky zákazníka:           ││ │
│  │ │ • Hlavní cíl: [editable]       ││ │
│  │ │ • Délka mostu: [150] m         ││ │
│  │ │ • Šířka: [12] m                ││ │
│  │ └────────────────────────────────┘│ │
│  │                                    │ │
│  │ ┌─ Actions ──────────────────────┐│ │
│  │ │ [💾 Uložit] [📥 Export]        ││ │
│  │ │ [✅ Schválit a pokračovat]     ││ │
│  │ │ [❌ Zamítnout]                 ││ │
│  │ └────────────────────────────────┘│ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

### Tab Structure

#### Tab 1: Overview (Přehled)
```html
<div class="summary-tab overview-tab">
  <section class="summary-section">
    <h3>📋 Základní údaje</h3>
    <div class="form-grid">
      <div class="form-item">
        <label>Název projektu:</label>
        <input type="text" v-model="summary.project_name" />
      </div>
      <div class="form-item">
        <label>Typ projektu:</label>
        <select v-model="summary.project_type">
          <option value="bridge">Most</option>
          <option value="building">Budova</option>
          <option value="tunnel">Tunel</option>
        </select>
      </div>
    </div>
  </section>

  <section class="summary-section">
    <h3>🎯 Požadavky zákazníka</h3>
    <textarea v-model="summary.requirements.main_goal" rows="3"></textarea>

    <div class="requirements-list">
      <div v-for="req in summary.requirements.special_requirements" class="requirement-item">
        <input type="text" v-model="req.value" />
        <button @click="removeRequirement(req)">✕</button>
      </div>
      <button @click="addRequirement" class="btn-add">+ Přidat požadavek</button>
    </div>
  </section>

  <section class="summary-section">
    <h3>📊 Kvalita dokumentace</h3>
    <div class="quality-score">
      <div class="score-ring" :data-score="summary.doc_quality.completeness_score">
        <span class="score-value">{{ summary.doc_quality.completeness_score }}%</span>
      </div>
      <div class="quality-details">
        <h4>⚠️ Chybějící položky:</h4>
        <ul>
          <li v-for="item in summary.doc_quality.missing_items">{{ item }}</li>
        </ul>
      </div>
    </div>
  </section>
</div>
```

---

#### Tab 2: Materials (Materiály)
```html
<div class="summary-tab materials-tab">
  <section class="summary-section">
    <h3>🏗️ Beton</h3>
    <div class="material-summary">
      <div class="total-quantity">
        <label>Celkové množství:</label>
        <input type="number" v-model="summary.materials.concrete.total_m3" />
        <span class="unit">m³</span>
      </div>

      <h4>Rozdělení po prvcích:</h4>
      <div class="material-breakdown">
        <div v-for="(qty, element) in summary.materials.concrete.breakdown" class="breakdown-item">
          <span class="element-name">{{ element }}:</span>
          <input type="number" v-model="summary.materials.concrete.breakdown[element]" />
          <span class="unit">m³</span>
        </div>
      </div>

      <h4>Použité třídy:</h4>
      <div class="classes-list">
        <span v-for="cls in summary.materials.concrete.classes_used" class="class-badge">
          {{ cls }}
        </span>
      </div>

      <h4>Třídy prostředí:</h4>
      <div class="exposure-list">
        <span v-for="exp in summary.materials.concrete.exposure_classes" class="exposure-badge">
          {{ exp }}
        </span>
      </div>
    </div>
  </section>

  <section class="summary-section">
    <h3>⚙️ Výztuž</h3>
    <div class="material-summary">
      <div class="total-quantity">
        <label>Celkové množství:</label>
        <input type="number" v-model="summary.materials.reinforcement.total_kg" />
        <span class="unit">kg</span>
      </div>
      <div class="grade">
        <label>Třída:</label>
        <input type="text" v-model="summary.materials.reinforcement.grade" />
      </div>
    </div>
  </section>

  <section class="summary-section">
    <h3>📦 Bednění</h3>
    <div class="material-summary">
      <div class="total-quantity">
        <label>Celkové množství:</label>
        <input type="number" v-model="summary.materials.formwork.total_m2" />
        <span class="unit">m²</span>
      </div>
    </div>
  </section>
</div>
```

---

#### Tab 3: Cost (Náklady)
```html
<div class="summary-tab cost-tab">
  <section class="summary-section">
    <h3>💰 Celkové náklady</h3>
    <div class="total-cost-display">
      <input type="number" v-model="summary.cost_estimate.total_czk" class="cost-input-large" />
      <span class="currency">Kč</span>
      <div class="confidence-indicator" :data-level="summary.cost_estimate.confidence_level">
        Confidence: {{ summary.cost_estimate.confidence_score * 100 }}%
        ({{ summary.cost_estimate.confidence_level }})
      </div>
    </div>
  </section>

  <section class="summary-section">
    <h3>📊 Rozdělení nákladů po fázích</h3>
    <div class="cost-breakdown-chart">
      <div v-for="(phase, cost) in summary.cost_estimate.breakdown" class="cost-bar-container">
        <label>{{ phase }}:</label>
        <div class="cost-bar-wrapper">
          <div class="cost-bar" :style="{ width: (cost.amount_czk / summary.cost_estimate.total_czk * 100) + '%' }">
            <span class="cost-label">{{ formatCurrency(cost.amount_czk) }} ({{ cost.percentage }}%)</span>
          </div>
        </div>
        <input type="number" v-model="cost.amount_czk" class="cost-input-inline" />
      </div>
    </div>
  </section>

  <section class="summary-section">
    <h3>📈 Rozdělení po kategoriích</h3>
    <div class="cost-categories">
      <div class="category-pie-chart">
        <!-- Pie chart visualization -->
        <canvas id="costPieChart"></canvas>
      </div>
      <div class="category-table">
        <table>
          <thead>
            <tr>
              <th>Kategorie</th>
              <th>Částka (Kč)</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(cat, cost) in summary.cost_estimate.cost_by_category">
              <td>{{ cat }}</td>
              <td><input type="number" v-model="cost.amount_czk" /></td>
              <td>{{ cost.percentage }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</div>
```

---

#### Tab 4: Timeline (Časový plán)
```html
<div class="summary-tab timeline-tab">
  <section class="summary-section">
    <h3>⏱️ Celková doba výstavby</h3>
    <div class="duration-summary">
      <input type="number" v-model="summary.timeline.total_duration_months" />
      <span class="unit">měsíců</span>
      <span class="days-equivalent">({{ summary.timeline.total_duration_days }} dní)</span>
    </div>
  </section>

  <section class="summary-section">
    <h3>📅 Milníky</h3>
    <div class="milestones-list">
      <div v-for="milestone in summary.timeline.milestones" class="milestone-item">
        <div class="milestone-header">
          <input type="text" v-model="milestone.name" class="milestone-name" />
          <input type="number" v-model="milestone.duration_days" class="milestone-duration" />
          <span class="unit">dní</span>
        </div>
        <div class="milestone-details">
          <label>Fáze:</label>
          <select v-model="milestone.phase">
            <option value="preparation">Příprava</option>
            <option value="foundation">Založení</option>
            <option value="structure">Konstrukce</option>
            <option value="finishing">Dokončení</option>
          </select>
        </div>
        <div class="milestone-dependencies" v-if="milestone.dependencies">
          <label>Závislosti:</label>
          <span v-for="dep in milestone.dependencies" class="dependency-badge">{{ dep }}</span>
        </div>
      </div>
    </div>
  </section>

  <section class="summary-section">
    <h3>🎯 Kritická cesta</h3>
    <div class="critical-path">
      <div v-for="milestoneId in summary.timeline.critical_path" class="critical-milestone">
        {{ getMilestoneName(milestoneId) }}
      </div>
    </div>
  </section>

  <section class="summary-section">
    <h3>📊 Gantt Chart</h3>
    <div class="gantt-chart">
      <!-- Gantt chart visualization (use library like vue-gantt) -->
      <canvas id="ganttChart"></canvas>
    </div>
  </section>
</div>
```

---

#### Tab 5: Risks (Rizika)
```html
<div class="summary-tab risks-tab">
  <section class="summary-section">
    <h3>📝 Předpoklady</h3>
    <div class="assumptions-list">
      <div v-for="(assumption, idx) in summary.risks_assumptions.assumptions" class="assumption-item">
        <textarea v-model="summary.risks_assumptions.assumptions[idx]" rows="2"></textarea>
        <button @click="removeAssumption(idx)">✕</button>
      </div>
      <button @click="addAssumption" class="btn-add">+ Přidat předpoklad</button>
    </div>
  </section>

  <section class="summary-section">
    <h3>⚠️ Rizika</h3>
    <div class="risks-list">
      <div v-for="risk in summary.risks_assumptions.risks" class="risk-item">
        <div class="risk-header">
          <input type="text" v-model="risk.risk" placeholder="Popis rizika" />
          <button @click="removeRisk(risk)">✕</button>
        </div>
        <div class="risk-details">
          <div class="risk-field">
            <label>Dopad:</label>
            <select v-model="risk.impact">
              <option value="low">Nízký</option>
              <option value="medium">Střední</option>
              <option value="high">Vysoký</option>
            </select>
          </div>
          <div class="risk-field">
            <label>Pravděpodobnost:</label>
            <select v-model="risk.probability">
              <option value="low">Nízká</option>
              <option value="medium">Střední</option>
              <option value="high">Vysoká</option>
            </select>
          </div>
          <div class="risk-field full-width">
            <label>Mitigace:</label>
            <textarea v-model="risk.mitigation" rows="2"></textarea>
          </div>
        </div>
      </div>
      <button @click="addRisk" class="btn-add">+ Přidat riziko</button>
    </div>
  </section>

  <section class="summary-section">
    <h3>📊 Matice rizik</h3>
    <div class="risk-matrix">
      <!-- Risk matrix visualization (Impact vs Probability) -->
      <div class="matrix-grid">
        <div class="matrix-cell" v-for="cell in riskMatrixCells"
             :class="cell.severity"
             :data-count="cell.risks.length">
          {{ cell.risks.length }}
        </div>
      </div>
    </div>
  </section>
</div>
```

---

## 💾 Export Implementations

### PDF Export (using jsPDF or puppeteer)

```javascript
// Backend: Node.js with Puppeteer
const puppeteer = require('puppeteer');

async function exportSummaryToPDF(summaryId) {
  const summary = await getSummaryById(summaryId);

  // Generate HTML from summary data
  const html = generateSummaryHTML(summary);

  // Launch headless browser
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set content and generate PDF
  await page.setContent(html);
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    }
  });

  await browser.close();

  return pdf;
}

function generateSummaryHTML(summary) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        h1 { color: #FF9F1C; }
        .section { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; }
      </style>
    </head>
    <body>
      <h1>Souhrn Projektu: ${summary.project_name}</h1>

      <div class="section">
        <h2>1. Požadavky zákazníka</h2>
        <p>${summary.client_requirements.main_goal}</p>
      </div>

      <div class="section">
        <h2>2. Materiály</h2>
        <table>
          <tr>
            <th>Materiál</th>
            <th>Množství</th>
            <th>Jednotka</th>
          </tr>
          <tr>
            <td>Beton</td>
            <td>${summary.materials.concrete.total_m3}</td>
            <td>m³</td>
          </tr>
          ...
        </table>
      </div>

      ...
    </body>
    </html>
  `;
}
```

---

### Excel Export (using ExcelJS)

```javascript
const ExcelJS = require('exceljs');

async function exportSummaryToExcel(summaryId) {
  const summary = await getSummaryById(summaryId);

  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Overview
  const overviewSheet = workbook.addWorksheet('Přehled');
  overviewSheet.columns = [
    { header: 'Položka', key: 'item', width: 30 },
    { header: 'Hodnota', key: 'value', width: 40 }
  ];

  overviewSheet.addRows([
    { item: 'Název projektu', value: summary.project_name },
    { item: 'Typ projektu', value: summary.project_type },
    { item: 'Celkové náklady', value: `${summary.cost_estimate.total_czk} Kč` },
    { item: 'Doba výstavby', value: `${summary.timeline.total_duration_months} měsíců` }
  ]);

  // Sheet 2: Materials
  const materialsSheet = workbook.addWorksheet('Materiály');
  materialsSheet.columns = [
    { header: 'Materiál', key: 'material', width: 25 },
    { header: 'Množství', key: 'quantity', width: 15 },
    { header: 'Jednotka', key: 'unit', width: 15 }
  ];

  materialsSheet.addRows([
    { material: 'Beton celkem', quantity: summary.materials.concrete.total_m3, unit: 'm³' },
    { material: 'Výztuž', quantity: summary.materials.reinforcement.total_kg, unit: 'kg' },
    { material: 'Bednění', quantity: summary.materials.formwork.total_m2, unit: 'm²' }
  ]);

  // Sheet 3: Cost Breakdown
  const costSheet = workbook.addWorksheet('Náklady');
  costSheet.columns = [
    { header: 'Fáze', key: 'phase', width: 25 },
    { header: 'Částka (Kč)', key: 'amount', width: 20 },
    { header: 'Procenta', key: 'percentage', width: 15 }
  ];

  Object.entries(summary.cost_estimate.breakdown).forEach(([phase, data]) => {
    costSheet.addRow({
      phase: phase,
      amount: data.amount_czk,
      percentage: `${data.percentage}%`
    });
  });

  // Sheet 4: Timeline
  const timelineSheet = workbook.addWorksheet('Časový plán');
  timelineSheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Milník', key: 'name', width: 30 },
    { header: 'Dny', key: 'days', width: 10 }
  ];

  summary.timeline.milestones.forEach(milestone => {
    timelineSheet.addRow({
      id: milestone.id,
      name: milestone.name,
      days: milestone.duration_days
    });
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return buffer;
}
```

---

## 🚀 Implementation Timeline

| Phase | Task | Files | Duration |
|-------|------|-------|----------|
| **Phase 1** | Database schema + migrations | `migrations.js`, schema | 0.5 дня |
| **Phase 2** | API endpoints (CRUD + export) | `routes/summaries.js` | 1 день |
| **Phase 3** | Summary generation logic | `services/summaryGenerator.js` | 1.5 дня |
| **Phase 4** | UI - Modal + Tabs | `SummaryModal.tsx`, components | 2 дня |
| **Phase 5** | Export implementations | `services/exporters/` | 1 день |
| **Phase 6** | Testing + integration | Tests, docs | 1 день |
| **Total** | | | **7 дней** |

---

## 📝 Next Steps

1. ✅ **Approve architecture** (Summary as separate module)
2. Start Phase 1: Create database schema
3. Implement API endpoints
4. Build UI with tabs
5. Implement export functionality
6. Test with real documents

---

**Автор:** Claude (AI Assistant)
**Дата:** 2025-12-28
**Версия:** 3.0 (Summary Module)
**Статус:** ✅ Готово к разработке
