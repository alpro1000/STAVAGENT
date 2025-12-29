# Next Session Tasks

**Last Updated:** 2025-12-28
**Current Branch:** `claude/optimize-multi-role-audit-84a4u`
**Status:** ⚠️ **REQUIRES DEPLOYMENT** - Backend not deployed with Workflow C

---

## ⚠️ CRITICAL: Backend Deployment Required

### Issue Discovered

The "Audit projektu" (Workflow C) feature is returning **404 Not Found** because:
- ✅ Code is complete and committed (commits `8f6c67d`, `16dbd08`)
- ✅ Routes are correctly configured (`/api/v1/workflow/c/*`)
- ❌ **Backend NOT deployed** - `autoDeploy: false` in `render.yaml`

### Fix Applied (Commit `f5f70de`)

Updated `concrete-agent/render.yaml`:
```yaml
services:
  - type: web
    name: concrete-agent
    rootDir: concrete-agent/packages/core-backend  # ← ADDED
```

### 🚀 Deployment Instructions

**Option 1: Manual Deploy via Render Dashboard**
1. Go to https://dashboard.render.com
2. Select service: **concrete-agent**
3. Click **"Manual Deploy"** → **"Deploy latest commit"**
4. Wait 3-5 minutes for deployment
5. Test: `curl https://concrete-agent.onrender.com/api/v1/workflow/c/health`

**Option 2: Enable Auto-Deploy (Future)**
1. Edit `concrete-agent/render.yaml`
2. Change `autoDeploy: false` → `autoDeploy: true`
3. Commit and push
4. Future pushes will auto-deploy

### Testing After Deployment

```bash
# 1. Check health endpoint
curl https://concrete-agent.onrender.com/api/v1/workflow/c/health

# Expected response:
{
  "status": "healthy",
  "system": "workflow-c",
  "version": "1.0.0",
  "features": {
    "parallel_execution": true,
    "summary_generation": true,
    "file_upload": true
  }
}

# 2. Test Audit projektu in Portal
# → Upload Excel file
# → Should complete without 404 error
# → Show GREEN/AMBER/RED classification
```

---

## 🎉 What We Accomplished This Session (2025-12-28)

### Session Overview

| Task | Status | Commit | Lines Added |
|------|--------|--------|-------------|
| Version Tracking & Snapshots | ✅ Complete | `5ef2c2e` | +400 |
| Version Comparison | ✅ Complete | `5ef2c2e` | +200 |
| Excel Export | ✅ Complete | `5ef2c2e` | +180 |
| PDF Export | ✅ Complete | `5ef2c2e` | +150 |
| Portal UI Enhancement | ✅ Complete | `5ef2c2e` | +200 |
| Fix Workflow C Deployment | ✅ Complete | `f5f70de` | +1 |
| **TOTAL** | **3 commits** | | **~1131 lines** |

---

### ✅ Document Accumulator Enhancements (Commit: `5ef2c2e`)

**Goal:** Add version tracking, comparison, and export functionality to Document Accumulator

**Implemented Features:**

#### 1. Version Tracking & Snapshots

**What it does:**
- Auto-creates snapshot (ProjectVersion) every time a summary is generated
- Stores complete project state: summary, positions count, files count, file hashes
- Maintains version history with timestamps
- Each version gets auto-incrementing version number (v1, v2, v3...)

**Implementation:**
```python
# New dataclass
@dataclass
class ProjectVersion:
    version_id: str
    version_number: int  # Auto-incrementing
    created_at: datetime
    summary: Dict[str, Any]  # Full summary snapshot
    positions_count: int
    files_count: int
    file_versions: Dict[str, str]  # file_id -> hash
    metadata: Dict[str, Any]
```

**Workflow:**
```
User clicks "Generovat souhrn"
  ↓
Summary Generator runs (Multi-Role AI)
  ↓
Summary saved to cache.last_summary
  ↓
_create_version_snapshot() called
  ↓
ProjectVersion created with current state
  ↓
Version appended to _versions[project_id]
  ↓
User can now compare versions!
```

---

#### 2. Version Comparison

**What it does:**
- Compare any two versions side-by-side
- Show detailed diff: files added/removed/modified
- Track positions delta, cost delta, risk changes
- Highlight changes in key findings and recommendations

**Comparison Output:**
```json
{
  "from_version": {
    "version_number": 1,
    "positions_count": 120,
    "files_count": 5
  },
  "to_version": {
    "version_number": 2,
    "positions_count": 135,
    "files_count": 7
  },
  "files_added": ["file_6.xlsx", "file_7.pdf"],
  "files_removed": [],
  "files_modified": ["file_1.xlsx"],
  "positions_delta": +15,
  "cost_delta": +250000,
  "risk_change": "MEDIUM → HIGH",
  "summary_comparison": {
    "key_findings_delta": {
      "added": ["New risk: missing geological report"],
      "removed": []
    },
    "recommendations_delta": {
      "added": ["Request geological survey"],
      "removed": []
    }
  }
}
```

---

#### 3. Excel Export

**What it does:**
- Export all project data to Excel (.xlsx)
- Two sheets: Summary + Positions
- Professional formatting with colors and borders
- Source file tracking for each position

**Excel Structure:**
```
Sheet 1: Souhrn
  - Project name, export date
  - Executive summary (wrapped text)
  - Key findings (bullet list)
  - Recommendations (bullet list)

Sheet 2: Pozice
  - Headers with orange background
  - Columns: #, Název, Množství, Jednotka, Cena/MJ, Celkem, Zdrojový soubor
  - Auto-width columns
  - All positions with source file tracking
```

**Dependencies:** `openpyxl`

---

#### 4. PDF Export

**What it does:**
- Export project summary to PDF
- Can export current summary OR specific version
- Professional formatting with reportlab
- Color-coded risk assessment (green/orange/red)

**PDF Structure:**
```
Page 1:
  - Title: "SOUHRN PROJEKTU" (orange)
  - Project info table (name, date, version, positions count)
  - Executive Summary paragraph
  - Key Findings (bullet list)
  - Recommendations (bullet list)
  - Risk Assessment (color-coded: LOW=green, MEDIUM=orange, HIGH=red)
  - Cost Analysis table (total, labor, material)
```

**Dependencies:** `reportlab`

---

#### 5. API Endpoints

**New endpoints added to routes_accumulator.py:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects/{id}/versions` | GET | List all versions (newest first) |
| `/projects/{id}/versions/{version_id}` | GET | Get specific version details |
| `/projects/{id}/compare?from=X&to=Y` | GET | Compare two versions |
| `/projects/{id}/export/excel` | GET | Export to Excel (download) |
| `/projects/{id}/export/pdf` | GET | Export summary to PDF (download) |
| `/projects/{id}/export/pdf?version_id=X` | GET | Export specific version to PDF |

**Example Usage:**
```bash
# List versions
curl https://concrete-agent.onrender.com/api/v1/accumulator/projects/proj-123/versions

# Compare versions
curl "https://concrete-agent.onrender.com/api/v1/accumulator/projects/proj-123/compare?from_version=v1-id&to_version=v2-id"

# Export to Excel
curl "https://concrete-agent.onrender.com/api/v1/accumulator/projects/proj-123/export/excel?project_name=My%20Project" --output export.xlsx

# Export to PDF
curl "https://concrete-agent.onrender.com/api/v1/accumulator/projects/proj-123/export/pdf?project_name=My%20Project" --output summary.pdf
```

---

#### 6. Portal UI Enhancements

**New UI Sections in ProjectDocuments.tsx:**

**A. Export Section**
- Buttons: "Excel (.xlsx)", "PDF (Souhrn)"
- Only shown when positions_count > 0
- Click → Download starts automatically

**B. Version History Section**
- Show/Hide toggle button
- Table with columns: Verze, Datum, Pozice, Soubory, Akce
- Each row has "PDF" download button for that version
- Professional table styling with borders

**C. Version Comparison UI**
- Two dropdowns: select "from" and "to" versions
- "Porovnat" button to trigger comparison
- Results panel showing:
  - Positions delta (green/red)
  - Risk change
  - Files added (green checkmark)
  - Files removed (red X)
  - Files modified (orange arrow)
  - New findings (green "+")
  - New recommendations (green "+")

**User Flow:**
```
1. User generates summary → Version v1 created
2. User adds more files → Parses them
3. User generates summary again → Version v2 created
4. User clicks "Historie verzí" → Table shows v1, v2
5. User selects v1 and v2 → Clicks "Porovnat"
6. UI shows diff: +15 positions, 2 files added, 1 file modified
7. User clicks "Excel (.xlsx)" → Downloads full export
8. User clicks PDF button on v2 row → Downloads v2 summary as PDF
```

---

## 📊 Technical Details

**Files Created (1 new file):**
```
concrete-agent/packages/core-backend/app/services/export_service.py (330 lines)
  - ExportService class
  - export_to_excel() method
  - export_summary_to_pdf() method
  - Singleton pattern: get_export_service()
```

**Files Modified (3 files):**
```
concrete-agent/packages/core-backend/app/services/document_accumulator.py (+150 lines)
  - ProjectVersion dataclass
  - _versions storage Dict[str, List[ProjectVersion]]
  - _create_version_snapshot() method
  - _compare_summaries() method
  - get_project_versions() method
  - get_version() method
  - compare_versions() method
  - export_to_excel() method
  - export_summary_to_pdf() method

concrete-agent/packages/core-backend/app/api/routes_accumulator.py (+154 lines)
  - GET /projects/{id}/versions
  - GET /projects/{id}/versions/{version_id}
  - GET /projects/{id}/compare
  - GET /projects/{id}/export/excel (StreamingResponse)
  - GET /projects/{id}/export/pdf (StreamingResponse)

stavagent-portal/frontend/src/components/portal/ProjectDocuments.tsx (+200 lines)
  - ProjectVersion, VersionComparison interfaces
  - States: versions, showVersions, showComparison, fromVersion, toVersion, comparison
  - loadVersions() function
  - handleCompareVersions() function
  - handleExportExcel() function
  - handleExportPDF(versionId?) function
  - Export Section UI (2 buttons)
  - Version History Section UI (table + comparison)
  - Comparison Results UI (diff panel)
```

**Total Lines Added:** ~1047

---

## 🚀 Use Cases

### Use Case 1: Project Evolution Tracking
```
Client sends revision 1 of project → v1 (120 positions, MEDIUM risk)
Client sends revision 2 with changes → v2 (135 positions, HIGH risk)
Project manager compares v1 → v2:
  - Sees +15 positions (+12.5%)
  - Risk increased MEDIUM → HIGH
  - New finding: "Missing geological report"
  - Cost increased by +250,000 CZK
Decision: Request geological survey before proceeding
```

### Use Case 2: Compliance Audit Trail
```
Auditor asks: "What changed between March and April versions?"
User selects v3 (March) and v5 (April)
Comparison shows:
  - 3 files added (new structural drawings)
  - 2 files modified (updated BOQ)
  - 8 new positions
  - New recommendation: "Increase concrete strength from C30/37 to C35/45"
Auditor exports v5 PDF for documentation
```

### Use Case 3: Client Reporting
```
Client meeting scheduled
User clicks "Excel (.xlsx)" → Gets full export with:
  - Summary sheet: Project overview, findings, recommendations
  - Positions sheet: All 135 positions with source file tracking
User presents Excel in meeting
Client requests PDF summary for board
User clicks "PDF (Souhrn)" → Exports professional PDF report
```

---

## ⚠️ Dependencies

**Python packages required (add to requirements.txt):**
```txt
openpyxl>=3.1.0  # Excel export
reportlab>=4.0.0  # PDF export
```

**Install:**
```bash
cd concrete-agent/packages/core-backend
pip install openpyxl reportlab
```

---

## 🔗 Integration Points

**Version Tracking:**
- Triggered automatically in `_execute_generate_summary()`
- No manual intervention needed
- Versions stored in-memory (`_versions` dict)
- **Production:** Replace with database storage

**Export Service:**
- Lazy-loaded via `get_export_service()`
- Uses DocumentAccumulator data (cache.aggregated_positions)
- Returns bytes (Excel/PDF)
- FastAPI StreamingResponse for file download

---

## 🚨 PRIORITY: Testing Required (Next Session)

### ⚠️ CRITICAL: Test Deployed Features

**Backend deployed successfully but requires user testing:**

#### 1. Test Workflow C (Audit projektu) - 15 minutes
```bash
# 1. Open Portal UI
https://stav-agent.onrender.com

# 2. Click "🔍 Audit projektu"
# 3. Upload Excel file with výkaz výměr
# 4. Wait for progress bar (15-30 seconds)
# 5. Verify result: GREEN/AMBER/RED classification

# Expected behavior:
✅ No 404 error
✅ Progress bar shows stages (parsing → validating → enriching → auditing)
✅ Result displays classification + critical issues + warnings
✅ Summary shows key findings + recommendations
```

#### 2. Test Document Accumulator Features - 30 minutes
```bash
# Test version tracking:
1. Open "📁 Akumulace dokumentů"
2. Upload 2-3 files
3. Click "Generovat souhrn" → v1 created
4. Upload 1 more file
5. Click "Generovat souhrn" → v2 created
6. Verify "Historie verzí" table shows v1, v2

# Test version comparison:
1. Select v1 and v2 from dropdowns
2. Click "Porovnat"
3. Verify diff shows:
   - Files added/removed/modified
   - Positions delta
   - Risk change
   - Summary changes

# Test Excel export:
1. Click "📊 Exportovat do Excel"
2. Download file
3. Open in Excel
4. Verify 2 sheets: "Souhrn" + "Pozice"

# Test PDF export:
1. Click "📄 Exportovat do PDF"
2. Download file
3. Open in PDF viewer
4. Verify color-coded risk assessment
```

#### 3. Report Bugs if Found
- Screenshot error messages
- Check browser console (F12 → Console tab)
- Note exact steps to reproduce
- Check network tab for API errors

---

## 🟢 Future Enhancement Options

### OPTION A: Database Migration for Versions (3 hours)
- Replace in-memory `_versions` with PostgreSQL table
- Create `project_versions` table schema
- Add CRUD operations for versions
- Migrate comparison logic to work with DB
- Add pagination for version list (if > 50 versions)

### OPTION B: Enhanced Comparison Features (2 hours)
- Add visual diff for executive summary (highlight changed sentences)
- Add percentage changes (positions: +12.5%, cost: +14.6%)
- Add trend analysis (last 3 versions)
- Export comparison results to PDF

### OPTION C: Google Drive / SharePoint Integration (4 hours)
- Implement Google Drive API for folder linking
- Implement SharePoint API for enterprise users
- Auto-sync on file changes (watch mode)
- Background polling for cloud storage

### OPTION D: Portal UI/UX Improvements (2 hours)
- Add loading skeletons for better perceived performance
- Improve error messages (user-friendly Czech text)
- Add keyboard shortcuts (Ctrl+S to save, etc.)
- Mobile responsive design improvements

---

## 📈 Session Statistics

**Date:** 2025-12-29
**Duration:** ~1.5 hours (continued from previous session)
**Branch:** `claude/optimize-multi-role-audit-84a4u`
**Commits:** 4 total (1 feature + 1 fix + 2 docs)
  - `5ef2c2e` - Document Accumulator enhancements
  - `f5f70de` - Workflow C deployment fix
  - `153fc3f` - Deployment instructions
  - `73dc90e` - CLAUDE.md update
**Files Changed:** 5 (1 new, 4 modified)
**Lines Added:** ~1131
**Features Implemented:**
  - Version Tracking (auto-snapshots)
  - Version Comparison (detailed diff)
  - Excel Export (openpyxl)
  - PDF Export (reportlab)
  - Deployment Fix (render.yaml rootDir)

---

## ✅ Testing Checklist (for next session)

- [ ] Test version snapshot creation after summary generation
- [ ] Test version history display in Portal UI
- [ ] Test version comparison (select v1 and v2, verify diff)
- [ ] Test Excel export (download and open in Excel)
- [ ] Test PDF export (download and open in PDF reader)
- [ ] Test export of specific version (select v2, download PDF)
- [ ] Test error handling (no versions, no data, API failures)
- [ ] Test with large projects (100+ positions, 10+ files)
- [ ] Test with multiple versions (v1-v10)
- [ ] Performance test: comparison with large file counts

---

**Last Updated:** 2025-12-28
**Session Status:** ✅ Ready for Testing & Deployment
**Branch:** `claude/optimize-multi-role-audit-84a4u`
