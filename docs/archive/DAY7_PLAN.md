# Day 7: Polish, Exports, and Parser Integration Plan

**Date:** November 20-21, 2025
**Status:** Planning phase
**Estimated Duration:** Full day

---

## Overview

Day 7 focuses on polishing the sheathing calculator implementation, adding export functionality, and integrating with concrete-agent parsers for automated data extraction.

---

## Task 1: Frontend Polish & UX Improvements (2-3 hours)

### Current State
- SheathingCapturesTable component exists
- SheathingCaptureRow component exists
- Real-time calculations working
- Basic styling in place

### Improvements Needed

#### 1.1 Input Validation UI
```typescript
// Add visual feedback for invalid inputs
- Red borders for validation errors
- Helper text showing valid ranges
- Real-time validation as user types
- Clear error messages
```

**Implementation:**
- Modify SheathingCaptureRow.tsx
- Add validation state management
- Display error messages near fields
- Disable save button if invalid

#### 1.2 Loading States
```typescript
// Better UX during API calls
- Show loading spinner during fetch
- Disable buttons while saving
- Show success/error toasts
- Prevent duplicate submissions
```

**Implementation:**
- Add loading state to SheathingCapturesTable
- Show loading indicator during API calls
- Toast notifications for feedback
- Disable controls during async operations

#### 1.3 Confirmation Dialogs
```typescript
// Improve delete UX
- Confirm before deleting capture
- Show what will be deleted
- Provide undo suggestion
- Clear consequences explanation
```

**Current:** Basic `window.confirm()`
**Improved:** Custom modal with details

#### 1.4 Responsive Design
```css
/* Mobile-friendly improvements */
- Tables adapt for small screens
- Touch-friendly buttons (larger tap targets)
- Scrollable table for mobile
- Single-column layout on mobile
```

**Implementation:**
- Add CSS media queries
- Test on different screen sizes
- Ensure touch gestures work

#### 1.5 Accessibility (a11y)
```typescript
// WCAG 2.1 compliance
- Proper ARIA labels
- Keyboard navigation (Tab, Enter, Delete)
- Screen reader support
- Color contrast compliance
```

**Implementation:**
- Add aria-labels to inputs
- Keyboard handlers
- Semantic HTML
- Test with accessibility tools

---

## Task 2: Export Functionality (2-3 hours)

### Export Formats

#### 2.1 CSV Export
```csv
Capture ID,Part Name,Length,Width,Area,Assembly Norm,Num Kits,Single Cycle,Staggered Duration,Time Savings
CAP-BR001-001,ZÁKLADY,12,8,96,0.8,2,8,6,2 (25%)
CAP-BR001-002,PILÍŘE,10,10,100,1.0,2,10,8,2 (20%)
```

**Implementation:**
- Create export utility function
- Generate CSV from captures
- Offer download via button
- Include project summary

#### 2.2 Excel Export (.xlsx)
```javascript
// More professional than CSV
- Multiple sheets (captures, summary, analysis)
- Formatted headers and data
- Charts/graphs of time savings
- Cost breakdown
```

**Implementation:**
- Use xlsx or exceljs library
- Create workbook with sheets
- Format cells (colors, borders, numbers)
- Add charts if possible

#### 2.3 PDF Export
```pdf
Project Report: BRIDGE-001
Generated: 2025-11-20
═══════════════════════

Project Statistics
───────────────────
Total Captures: 3
Total Area: 296 m²
Total Labor: 400 hours
Max Duration: 25 days

Capture Details
───────────────
[Table with all captures]

Time Savings Summary
────────────────────
Sequential: 75 days
Staggered: 25 days
Savings: 50 days (66.7%)

Cost Analysis
─────────────
[Cost breakdown by capture]
```

**Implementation:**
- Use PDFKit or jsPDF
- Layout captures in table format
- Include charts/graphs
- Add project metadata
- Footer with generation timestamp

### Export Feature Code Structure

```typescript
// backend/src/utils/exports.ts
export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  includeStats: boolean;
  includeCharts: boolean;
  dateRange?: { start: Date; end: Date };
}

export async function exportCaptures(
  captures: SheathingCapture[],
  config: SheathingProjectConfig,
  options: ExportOptions
): Promise<Buffer>;

export function generateCSV(...): string;
export function generateXLSX(...): Workbook;
export function generatePDF(...): PDFDocument;
```

### Add Export Endpoints

```javascript
// backend/src/routes/sheathing-export.ts
GET    /api/sheathing/:project_id/export/csv
GET    /api/sheathing/:project_id/export/xlsx
GET    /api/sheathing/:project_id/export/pdf

POST   /api/sheathing/:project_id/export
// Body: { format: 'csv'|'xlsx'|'pdf', options: {...} }
```

---

## Task 3: Parser Integration with concrete-agent (2-3 hours)

### Current State
- concrete-agent has excellent parsers
- Parsers handle: Excel, PDF, XML formats
- Smart column detection (20+ variants)
- Czech language support

### Integration Points

#### 3.1 Dimension Extraction from PDFs
```typescript
// Extract dimensions from specification PDFs
// Input: PDF file with construction specifications
// Output: { length_m, width_m, height_m }

POST /api/sheathing/parse-dimensions
Body: FormData with PDF file
Response: {
  detected_dimensions: [
    { length_m: 12, width_m: 8, height_m: 2.5, confidence: 0.95 }
  ],
  extracted_text: "...",
  source_pages: [1, 2]
}
```

**Implementation:**
- Extend coreAPI.js with PDF parsing
- Use concrete-agent's PDF parser
- Extract measurements from document
- Return best matches with confidence scores

#### 3.2 Excel Specification Import
```typescript
// Parse Excel files with construction specs
// Detect assembly norms, concrete class, rental costs

POST /api/sheathing/parse-excel
Body: FormData with Excel file
Response: {
  captures: [
    {
      part_name: "ZÁKLADY",
      length_m: 12,
      width_m: 8,
      assembly_norm_ph_m2: 0.8,
      concrete_class: "C30/37",
      confidence: 0.92
    }
  ],
  warnings: ["Could not determine height for capture 2"]
}
```

**Implementation:**
- Use concrete-agent's Excel parser
- Smart column detection (20+ variants)
- Support multiple sheet layouts
- Return high-confidence suggestions
- Flag ambiguous values

#### 3.3 Doka Tools Integration
```typescript
// Fetch rental costs from Doka Tools online catalog
// Input: Kit type, formwork category
// Output: Current daily rental rates

GET /api/sheathing/doka-rates?kit_type=STANDARD&category=WALL
Response: {
  kit_type: "STANDARD",
  daily_rental_czk: 5000,
  weekly_rental_czk: 28000,
  monthly_rental_czk: 85000,
  updated_at: "2025-11-20",
  source: "https://dokatools.com/pricing"
}
```

**Implementation:**
- Scrape or API integration with Doka Tools
- Cache rates (update daily/weekly)
- Support multiple kit types
- Store historical rates

#### 3.4 Batch Import Workflow
```typescript
// User uploads construction spec file
// System extracts all captures at once
// Validates and suggests corrections
// User reviews and approves

POST /api/sheathing/:project_id/import-batch
Body: FormData with document (PDF/Excel)
Response: {
  auto_created: 3,
  manual_review_needed: 1,
  captures: [
    {
      part_name: "ZÁKLADY",
      dimensions: { length_m: 12, width_m: 8 },
      confidence: 0.95,
      status: "ready_to_create"
    },
    {
      part_name: "UNKNOWN_SECTION",
      extracted_text: "...",
      confidence: 0.45,
      status: "needs_manual_review"
    }
  ]
}
```

---

## Task 4: Component Enhancements (1-2 hours)

### 4.1 Summary Panel
```typescript
// Enhanced statistics display
<SheathingProjectSummary>
  - Total area breakdown by method
  - Comparative timeline visualization
  - Cost summary with breakdown
  - Labor availability vs needed
  - Equipment utilization
```

### 4.2 Charts & Visualizations
```typescript
// Add visual representation
- Bar chart: Sequential vs Staggered duration
- Pie chart: Area distribution by capture
- Line chart: Time/cost by number of kits
- Gantt chart: Schedule visualization
```

### 4.3 Templates Library
```typescript
// Predefined capture templates
- "Standard Wall Formwork" (default values)
- "Column Formwork" (different norms)
- "Deck Formwork" (larger area, specific norms)
- "Custom" (user-defined)
```

---

## Task 5: Documentation & Testing (1-2 hours)

### 5.1 End-User Documentation
```markdown
# Sheathing Calculator - User Guide

## Getting Started
1. Create captures for your project
2. Set up project defaults
3. Run calculations
4. Export reports

## Features
- Real-time calculation
- Checkerboard optimization
- Export to PDF/Excel
- Automatic dimension extraction
```

### 5.2 Integration Tests
```typescript
// Test end-to-end workflows
- Create → Calculate → Export
- Import → Validate → Calculate
- Multiple captures → Aggregate → Report
```

### 5.3 API Documentation
```markdown
## Sheathing API

### Endpoints
[Complete endpoint docs]

### Examples
[Code samples in Python, JavaScript, cURL]

### Rate Limiting
[Performance expectations]
```

---

## Implementation Priority

### High Priority (MUST HAVE)
1. ✅ Core calculations (Days 1-2) - DONE
2. ✅ Frontend UI (Day 3) - DONE
3. ✅ Backend API (Day 4) - DONE
4. ✅ Database (Day 5) - DONE
5. ✅ Testing (Day 6) - DONE
6. **CSV Export** - Basic export format
7. **Input validation UI** - Better error handling
8. **Toast notifications** - User feedback

### Medium Priority (SHOULD HAVE)
9. **PDF Export** - Professional reports
10. **Excel Export** - Office compatibility
11. **Dimension extraction from PDF** - Parser integration
12. **Responsive design** - Mobile support
13. **Excel batch import** - Quick data entry

### Low Priority (NICE TO HAVE)
14. **Charts/Visualizations** - Analysis
15. **Templates library** - Quick setup
16. **Doka Tools integration** - Live pricing
17. **Accessibility improvements** - a11y
18. **Advanced analytics** - Historical data

---

## File Changes Required

### New Files
- `backend/src/utils/exports.ts` - Export utilities
- `backend/src/routes/sheathing-export.ts` - Export endpoints
- `frontend/src/components/ExportButton.tsx` - UI component
- `frontend/src/components/SheathingImport.tsx` - Import component
- `backend/src/services/parser-integration.ts` - Parser service

### Modified Files
- `backend/src/routes/sheathing.js` - Add export/import endpoints
- `backend/server.js` - Register new routes
- `frontend/src/components/SheathingCapturesTable.tsx` - Add export button
- `frontend/src/components/SheathingCaptureRow.tsx` - Add validation UI
- `shared/src/sheathing-formulas.ts` - Add export helpers

### Dependencies to Add
```json
{
  "xlsx": "^0.18.5",
  "jspdf": "^2.5.1",
  "pdfkit": "^0.13.0",
  "multer": "^1.4.5",
  "uuid": "^9.0.0"
}
```

---

## Success Criteria

- [ ] All Day 1-6 work is complete and tested
- [ ] At least CSV export working
- [ ] PDF export with basic formatting
- [ ] Input validation UI complete
- [ ] Toast notifications for feedback
- [ ] Responsive design for mobile
- [ ] 90%+ test coverage for new code
- [ ] API documentation complete
- [ ] End-user guide written
- [ ] All features working without errors

---

## Time Allocation

```
Task 1: Frontend Polish       2.5 hours
Task 2: Export Functionality 2.5 hours
Task 3: Parser Integration   2.5 hours
Task 4: Component Enhancements 1.5 hours
Task 5: Documentation        1 hour
Contingency                   1 hour
───────────────────────────────────────
Total                         11 hours (1 full day)
```

---

## Success Indicators

✅ By end of Day 7:
- Sheathing calculator is feature-complete
- Export functionality working (CSV minimum)
- API well-documented
- User guide available
- Integration with parsers initiated
- Ready for beta testing/deployment
- Code quality: 85%+ coverage
- Performance: < 100ms per operation
- All tests passing

---

## Rollover Tasks (If Time Runs Out)

These can be deferred to a future date:
- [ ] Excel export (if only CSV done)
- [ ] Advanced visualizations
- [ ] Doka Tools live integration
- [ ] Historical analytics
- [ ] Performance optimization

---

## Notes

- Backend is currently running and tested ✅
- Test suite passing (86.3% success rate) ✅
- Core formulas validated ✅
- Database schema ready ✅
- API endpoints functional ✅
- Ready for Day 7 implementation 🚀

---

*Day 7 Plan Created: November 20, 2025*
*Status: Ready for implementation*
*Next: Begin Task 1 - Frontend Polish*
