# Workflow Guide

> Step-by-step operational guides for Workflow A and Workflow B

**Document version:** 1.0.0
**Last updated:** 2025-01-26
**Maintainer:** Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Workflow A: Import & Audit](#workflow-a-import--audit)
3. [Workflow B: Generate from Drawings](#workflow-b-generate-from-drawings)
4. [Hybrid Workflow: Combined A+B](#hybrid-workflow-combined-ab)
5. [Post-Processing](#post-processing)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### Workflow Types

Concrete Agent supports two primary workflows:

| Workflow | Input | Output | Use Case |
|----------|-------|--------|----------|
| **Workflow A** | Existing BoQ (XML, Excel, PDF) | Audited & enriched positions | Verify/audit existing budget |
| **Workflow B** | Construction drawings (PDF, images) | Generated BoQ positions | Create budget from drawings |
| **Hybrid (A+B)** | BoQ + Drawings | Cross-validated positions | Maximum accuracy |

### Workflow Selection Guide

**Use Workflow A when:**
- ✅ You have an existing BoQ (vykaz vymer)
- ✅ You need to audit/verify positions
- ✅ You want KROS/RTS code matching
- ✅ You need compliance checking (ČSN norms)

**Use Workflow B when:**
- ✅ You only have construction drawings (no BoQ)
- ✅ You need to generate a budget from scratch
- ✅ Drawings are clear and detailed

**Use Hybrid (A+B) when:**
- ✅ You have both BoQ and drawings
- ✅ You need cross-validation between documents
- ✅ Maximum accuracy is critical

---

## Workflow A: Import & Audit

**Goal:** Import existing BoQ, parse positions, enrich with KROS/RTS data, perform AI-powered audit.

**Duration:** 2-5 minutes (depends on BoQ size and AI provider)

**Prerequisites:**
- BoQ file (XML, XLSX, XLS, PDF, or CSV)
- API keys configured (see [CONFIG.md](CONFIG.md))

---

### Step 1: Prepare Input File

**Supported Formats:**

| Format | Extension | Best For | Notes |
|--------|-----------|----------|-------|
| **KROS UNIXML** | `.xml` | Czech construction (KROS software) | ✅ Recommended |
| **Excel** | `.xlsx`, `.xls` | Custom budgets | Requires standard columns |
| **PDF** | `.pdf` | Scanned documents | Uses OCR + Claude parsing |
| **CSV** | `.csv` | Simple exports | Must have headers |

**Excel Format Requirements:**

Required columns (Czech names):
- `Kód položky` or `Kod` - Position code
- `Popis` or `Název` - Description
- `MJ` - Unit of measure
- `Množství` - Quantity
- `Cena celkem` or `Celkem` - Total price (optional)

**Example (rozpocet.xlsx):**

```
| Kód položky | Popis                | MJ  | Množství | Cena celkem |
|-------------|---------------------|-----|----------|-------------|
| 121151113   | Beton C 25/30       | m3  | 10,5     | 26 250,00   |
| 121151114   | Beton C 30/37       | m3  | 5,0      | 14 000,00   |
| 271354111   | Ocelová výztuž B500 | t   | 1,2      | 38 400,00   |
```

**KROS UNIXML Format:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<unixml version="1.0">
  <hlavicka>
    <projekt_nazev>Bytový dům Vinohrady</projekt_nazev>
    <projekt_kod>BDV-2025-001</projekt_kod>
  </hlavicka>
  <objekty>
    <objekt kod="SO01" nazev="Základy">
      <polozky>
        <polozka kod="121151113" nazev="Beton C 25/30" mj="m3" mnozstvi="10.5" cena="26250.00"/>
      </polozky>
    </objekt>
  </objekty>
</unixml>
```

---

### Step 2: Upload & Create Project

**Option A: Web UI (if available)**

1. Navigate to `http://localhost:8000/upload`
2. Fill in project name
3. Select workflow type: "Workflow A"
4. Upload BoQ file (drag & drop or browse)
5. Click "Create Project"

**Option B: API (curl)**

```bash
curl -X POST "http://localhost:8000/api/projects/upload" \
  -F "project_name=Bytový dům Vinohrady" \
  -F "vykaz_vymer=@rozpocet.xlsx" \
  -F "workflow=a"
```

**Option C: API (Python)**

```python
import requests

url = "http://localhost:8000/api/projects/upload"

files = {
    "vykaz_vymer": open("rozpocet.xlsx", "rb")
}

data = {
    "project_name": "Bytový dům Vinohrady",
    "workflow": "a"
}

response = requests.post(url, files=files, data=data)
result = response.json()

project_id = result["project_id"]
print(f"✅ Project created: {project_id}")
```

**Expected Output:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "message": "Project created successfully",
  "data": {
    "project_name": "Bytový dům Vinohrady",
    "workflow_type": "a",
    "status": "uploaded",
    "files": {
      "vykaz_vymer": {
        "filename": "rozpocet.xlsx",
        "size": 45632
      }
    }
  }
}
```

**⚠️ Save the `project_id`!** You'll need it for all subsequent operations.

---

### Step 3: Execute Workflow A

**Trigger workflow execution:**

```bash
curl -X POST "http://localhost:8000/api/workflow/a/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_1706265000_abc123",
    "action": "execute"
  }'
```

**Python:**

```python
url = "http://localhost:8000/api/workflow/a/execute"

payload = {
    "project_id": project_id,
    "action": "execute"
}

response = requests.post(url, json=payload)
result = response.json()

print(f"✅ Workflow completed: {result['data']['stats']}")
```

**What happens during execution:**

```
1. [Parsing] 📄 Parse BoQ file → Extract positions
   - KROS XML: Parse <polozky> elements
   - Excel: Read rows, normalize European numbers (1 234,56)
   - PDF: OCR + Claude extraction

2. [Normalization] 🔧 Normalize data
   - Convert numbers: "10,5" → 10.5
   - Standardize units: "m3" → "m3"
   - Clean descriptions

3. [Validation] ✅ Validate positions
   - Check required fields (code, description, quantity)
   - Detect missing/invalid data

4. [Enrichment] 💎 Enrich with KROS/RTS
   - Match position codes to KROS database
   - Add unit prices, norms, specifications
   - Calculate derived values

5. [Audit] 🔍 AI-powered audit
   - Multi-role expert system (SME, ARCH, ENG, SUP)
   - Classify: GREEN (approved), AMBER (review), RED (reject)
   - Generate evidence and recommendations

6. [Export] 📊 Export to Excel
   - Create audit_report.xlsx with color-coded results
```

**Expected Duration:**

| BoQ Size | Parsing | Enrichment | Audit (Claude) | Total |
|----------|---------|------------|----------------|-------|
| 10 positions | 2s | 5s | 30s | ~40s |
| 50 positions | 5s | 10s | 90s | ~2 min |
| 100 positions | 10s | 20s | 180s | ~3.5 min |
| 500 positions | 30s | 60s | 600s | ~12 min |

**Expected Output:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "data": {
    "status": "completed",
    "artifacts": {
      "parsed_positions": "/data/processed/proj_.../parsed_positions.json",
      "audit_results": "/data/processed/proj_.../audit_results.json",
      "exported_excel": "/data/processed/proj_.../audit_report.xlsx"
    },
    "stats": {
      "total_positions": 53,
      "green_count": 48,
      "amber_count": 3,
      "red_count": 2,
      "avg_confidence": 0.92
    }
  }
}
```

---

### Step 4: Review Audit Results

**Get positions with audit results:**

```bash
curl -X POST "http://localhost:8000/api/workflow/a/positions" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "proj_1706265000_abc123"}'
```

**Python:**

```python
url = "http://localhost:8000/api/workflow/a/positions"

payload = {"project_id": project_id}

response = requests.post(url, json=payload)
positions = response.json()["data"]["positions"]

for pos in positions:
    print(f"{pos['code']}: {pos['description']} - {pos['classification']}")
```

**Example Position (GREEN):**

```json
{
  "id": "1",
  "code": "121151113",
  "description": "Beton C 25/30",
  "unit": "m3",
  "quantity": 10.5,
  "unit_price": 2500.0,
  "total_price": 26250.0,
  "classification": "GREEN",
  "confidence": 0.97,
  "audit": {
    "status": "approved",
    "roles": ["SME", "ENG", "ARCH"],
    "consensus": "unanimous",
    "evidence": [
      "✅ Exact KROS match: 121151113",
      "✅ Price within 5% of database average (2480 CZK/m3)",
      "✅ Technical parameters validated (C 25/30, S3, Dmax 16mm)",
      "✅ Complies with ČSN EN 206-1"
    ],
    "recommendations": []
  },
  "enrichment": {
    "kros_code": "121151113",
    "kros_name": "Beton prostý C 25/30",
    "unit_price_kros": 2480.0,
    "applicable_norms": ["ČSN EN 206-1", "ČSN 73 1201"]
  }
}
```

**Example Position (AMBER):**

```json
{
  "id": "15",
  "code": "121151114",
  "description": "Beton C 30/37",
  "unit": "m3",
  "quantity": 5.0,
  "unit_price": 3200.0,
  "total_price": 16000.0,
  "classification": "AMBER",
  "confidence": 0.78,
  "audit": {
    "status": "review_required",
    "roles": ["SME", "ENG"],
    "consensus": "partial",
    "evidence": [
      "✅ KROS match found: 121151114",
      "⚠️  Price 12% above database average (2850 CZK/m3)",
      "⚠️  Quantity seems high for stated purpose"
    ],
    "recommendations": [
      "Verify unit price with supplier quotes",
      "Confirm quantity calculation from drawings"
    ]
  }
}
```

**Example Position (RED):**

```json
{
  "id": "42",
  "code": "999999999",
  "description": "Custom material XYZ",
  "unit": "ks",
  "quantity": 100.0,
  "unit_price": 0.0,
  "total_price": 0.0,
  "classification": "RED",
  "confidence": 0.32,
  "audit": {
    "status": "rejected",
    "roles": ["SME"],
    "consensus": "reject",
    "evidence": [
      "❌ Code 999999999 not found in KROS database",
      "❌ Description too vague (no specifications)",
      "❌ Unit price missing",
      "❌ No applicable norm identified"
    ],
    "recommendations": [
      "Replace with standard KROS code",
      "Add detailed technical specifications",
      "Obtain unit price from supplier"
    ]
  }
}
```

---

### Step 5: Download Excel Report

**Download audit report:**

```bash
curl -O "http://localhost:8000/api/artifacts/proj_1706265000_abc123/audit_report.xlsx"
```

**Python:**

```python
url = f"http://localhost:8000/api/artifacts/{project_id}/audit_report.xlsx"

response = requests.get(url)

with open(f"{project_id}_audit.xlsx", "wb") as f:
    f.write(response.content)

print("✅ Report downloaded")
```

**Excel Report Structure:**

| Sheet | Content |
|-------|---------|
| **Summary** | Overall statistics, GREEN/AMBER/RED counts |
| **All Positions** | Complete list with audit results |
| **GREEN** | Approved positions (ready to use) |
| **AMBER** | Positions requiring review |
| **RED** | Rejected positions (require fixes) |

**Color Coding:**

- 🟢 **GREEN cells**: Approved, high confidence
- 🟡 **AMBER cells**: Review required
- 🔴 **RED cells**: Rejected, needs fixes

---

### Step 6: Generate Artifacts (Optional)

Generate detailed artifacts for specific positions:

#### Tech Card (Technologická karta)

```python
url = "http://localhost:8000/api/workflow/a/tech-card"

payload = {
    "project_id": project_id,
    "position_id": "1",
    "action": "tech_card"
}

response = requests.post(url, json=payload)
tech_card = response.json()["artifact"]

print(f"Tech card: {tech_card['title']}")
print(f"Steps: {len(tech_card['data']['steps'])}")
```

#### Resource Sheet (TOV)

```python
url = "http://localhost:8000/api/workflow/a/resource-sheet"

payload = {
    "project_id": project_id,
    "position_id": "1",
    "action": "resource_sheet"
}

response = requests.post(url, json=payload)
resource_sheet = response.json()["artifact"]

print(f"Labor hours: {resource_sheet['data']['labor']['total_hours']}")
print(f"Materials: {len(resource_sheet['data']['materials'])}")
```

#### Materials Specification

```python
url = "http://localhost:8000/api/workflow/a/materials"

payload = {
    "project_id": project_id,
    "position_id": "1",
    "action": "materials"
}

response = requests.post(url, json=payload)
materials = response.json()["artifact"]

print(f"Total items: {materials['data']['total_items']}")
```

---

### Workflow A: Complete Script

```python
#!/usr/bin/env python3
"""
Complete Workflow A automation script
"""
import requests
from pathlib import Path
import time

BASE_URL = "http://localhost:8000"

def workflow_a_complete(boq_file: Path, project_name: str):
    """Execute complete Workflow A"""

    print(f"🚀 Starting Workflow A for: {project_name}")
    print(f"📄 BoQ file: {boq_file}")

    # Step 1: Upload & create project
    print("\n[1/5] Creating project...")
    url = f"{BASE_URL}/api/projects/upload"

    files = {"vykaz_vymer": open(boq_file, "rb")}
    data = {"project_name": project_name, "workflow": "a"}

    response = requests.post(url, files=files, data=data)
    response.raise_for_status()

    project_id = response.json()["project_id"]
    print(f"✅ Project created: {project_id}")

    # Step 2: Execute workflow
    print("\n[2/5] Executing Workflow A...")
    url = f"{BASE_URL}/api/workflow/a/execute"

    payload = {"project_id": project_id, "action": "execute"}

    response = requests.post(url, json=payload)
    response.raise_for_status()

    stats = response.json()["data"]["stats"]
    print(f"✅ Workflow completed:")
    print(f"   Total: {stats['total_positions']}")
    print(f"   GREEN: {stats['green_count']}")
    print(f"   AMBER: {stats['amber_count']}")
    print(f"   RED: {stats['red_count']}")

    # Step 3: Get positions
    print("\n[3/5] Retrieving positions...")
    url = f"{BASE_URL}/api/workflow/a/positions"

    payload = {"project_id": project_id}

    response = requests.post(url, json=payload)
    response.raise_for_status()

    positions = response.json()["data"]["positions"]
    print(f"✅ Retrieved {len(positions)} positions")

    # Step 4: Download Excel report
    print("\n[4/5] Downloading Excel report...")
    url = f"{BASE_URL}/api/artifacts/{project_id}/audit_report.xlsx"

    response = requests.get(url)
    response.raise_for_status()

    output_path = Path(f"{project_id}_audit.xlsx")
    output_path.write_bytes(response.content)
    print(f"✅ Report saved: {output_path}")

    # Step 5: Generate tech cards for GREEN positions
    print("\n[5/5] Generating tech cards...")
    green_positions = [p for p in positions if p["classification"] == "GREEN"]

    for pos in green_positions[:3]:  # First 3 GREEN positions
        url = f"{BASE_URL}/api/workflow/a/tech-card"

        payload = {
            "project_id": project_id,
            "position_id": pos["id"],
            "action": "tech_card"
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()

        print(f"  ✅ Tech card: {pos['code']} - {pos['description']}")

    print(f"\n🎉 Workflow A completed successfully!")
    print(f"📊 Results saved to: {output_path}")

    return project_id, positions


if __name__ == "__main__":
    boq_file = Path("rozpocet.xlsx")
    project_name = "Bytový dům Vinohrady"

    project_id, positions = workflow_a_complete(boq_file, project_name)
```

---

## Workflow B: Generate from Drawings

**Goal:** Analyze construction drawings to generate Bill of Quantities positions.

**Duration:** 3-10 minutes (depends on drawing count and complexity)

**Prerequisites:**
- Construction drawings (PDF, DWG, images)
- OpenAI API key configured (for GPT-4 Vision)

---

### Step 1: Prepare Drawings

**Supported Formats:**

| Format | Extension | Best For | Notes |
|--------|-----------|----------|-------|
| **PDF** | `.pdf` | Architectural plans | ✅ Recommended |
| **Images** | `.jpg`, `.png` | Scanned drawings | High resolution preferred |
| **DWG** | `.dwg` | AutoCAD files | Requires conversion |
| **DXF** | `.dxf` | CAD interchange | Text-based |

**Drawing Quality Requirements:**

✅ **Good:**
- Clear labels and dimensions
- High resolution (300+ DPI for scans)
- Readable text
- Scale indicator present

❌ **Poor:**
- Blurry or low resolution
- Missing dimensions
- Handwritten notes (illegible)
- No scale

**Example Drawing Structure:**

```
floor_plan.pdf
├── Page 1: Site Plan (měřítko 1:200)
├── Page 2: Foundation Plan (měřítko 1:50)
├── Page 3: Floor Plan - Level 1 (měřítko 1:50)
├── Page 4: Sections (měřítko 1:50)
└── Page 5: Details (měřítko 1:20)
```

---

### Step 2: Upload & Create Project

**API (curl):**

```bash
curl -X POST "http://localhost:8000/api/projects/upload" \
  -F "project_name=Most přes řeku" \
  -F "vykresy=@floor_plan.pdf" \
  -F "vykresy=@sections.pdf" \
  -F "workflow=b"
```

**Python:**

```python
import requests

url = "http://localhost:8000/api/projects/upload"

files = [
    ("vykresy", open("floor_plan.pdf", "rb")),
    ("vykresy", open("sections.pdf", "rb"))
]

data = {
    "project_name": "Most přes řeku",
    "workflow": "b"
}

response = requests.post(url, files=files, data=data)
result = response.json()

project_id = result["project_id"]
print(f"✅ Project created: {project_id}")
```

---

### Step 3: Execute Workflow B

```python
url = "http://localhost:8000/api/workflow/b/execute"

payload = {
    "project_id": project_id,
    "action": "execute"
}

response = requests.post(url, json=payload)
result = response.json()

print(f"✅ Workflow completed: {result['data']['stats']}")
```

**What happens during execution:**

```
1. [Drawing Analysis] 🖼️ Analyze drawings with GPT-4 Vision
   - Extract dimensions, labels, quantities
   - Identify construction elements
   - Calculate areas/volumes

2. [Position Generation] 📝 Generate positions
   - Map elements to KROS codes
   - Calculate quantities from dimensions
   - Generate descriptions

3. [Validation] ✅ Validate generated positions
   - Check completeness
   - Verify calculations
   - Flag uncertainties

4. [Export] 💾 Save generated positions
```

**Expected Output:**

```json
{
  "success": true,
  "project_id": "proj_1706265100_def456",
  "data": {
    "status": "completed",
    "artifacts": {
      "generated_positions": "/data/processed/proj_.../generated_positions.json"
    },
    "stats": {
      "total_positions": 27,
      "drawings_analyzed": 2,
      "confidence_avg": 0.85
    }
  }
}
```

---

### Step 4: Review Generated Positions

```python
url = "http://localhost:8000/api/workflow/b/positions"

payload = {"project_id": project_id}

response = requests.post(url, json=payload)
positions = response.json()["data"]["positions"]

for pos in positions:
    print(f"{pos['code']}: {pos['description']} - {pos['quantity']} {pos['unit']}")
```

**Example Generated Position:**

```json
{
  "id": "gen_1",
  "code": "121151113",
  "description": "Beton C 25/30 - základová deska",
  "unit": "m3",
  "quantity": 15.75,
  "source_drawing": "floor_plan.pdf",
  "page": 2,
  "confidence": 0.88,
  "ai_reasoning": "Detected foundation slab: 450cm × 350cm × 10cm = 15.75 m3",
  "calculation": {
    "length": 4.5,
    "width": 3.5,
    "depth": 0.1,
    "formula": "length × width × depth",
    "result": 15.75
  }
}
```

---

### Step 5: Refine & Export

**Manual review:**
- Verify quantities match drawings
- Adjust positions as needed
- Add missing details

**Export to Excel:**

```python
# (Same as Workflow A)
url = f"http://localhost:8000/api/artifacts/{project_id}/generated_positions.xlsx"

response = requests.get(url)

with open(f"{project_id}_generated.xlsx", "wb") as f:
    f.write(response.content)
```

---

## Hybrid Workflow: Combined A+B

**Goal:** Maximum accuracy by cross-validating BoQ against drawings.

**Use Case:** You have both an existing BoQ and drawings, want to verify consistency.

---

### Step 1: Upload Both BoQ and Drawings

```python
url = "http://localhost:8000/api/projects/upload"

files = [
    ("vykaz_vymer", open("rozpocet.xlsx", "rb")),
    ("vykresy", open("floor_plan.pdf", "rb"))
]

data = {
    "project_name": "Bytový dům Vinohrady",
    "workflow": "both"  # Enable both workflows
}

response = requests.post(url, files=files, data=data)
project_id = response.json()["project_id"]
```

---

### Step 2: Execute Both Workflows

```python
# Execute Workflow A
url = "http://localhost:8000/api/workflow/a/execute"
payload = {"project_id": project_id, "action": "execute"}
requests.post(url, json=payload)

# Execute Workflow B
url = "http://localhost:8000/api/workflow/b/execute"
payload = {"project_id": project_id, "action": "execute"}
requests.post(url, json=payload)
```

---

### Step 3: Cross-Validate Results

**Compare positions:**

```python
# Get Workflow A results
url = "http://localhost:8000/api/workflow/a/positions"
response_a = requests.post(url, json={"project_id": project_id})
positions_a = response_a.json()["data"]["positions"]

# Get Workflow B results
url = "http://localhost:8000/api/workflow/b/positions"
response_b = requests.post(url, json={"project_id": project_id})
positions_b = response_b.json()["data"]["positions"]

# Compare
print(f"BoQ positions: {len(positions_a)}")
print(f"Generated positions: {len(positions_b)}")

# Find discrepancies
boq_codes = {p["code"] for p in positions_a}
gen_codes = {p["code"] for p in positions_b}

missing_in_boq = gen_codes - boq_codes
missing_in_drawings = boq_codes - gen_codes

if missing_in_boq:
    print(f"⚠️  Positions in drawings but not in BoQ: {missing_in_boq}")

if missing_in_drawings:
    print(f"⚠️  Positions in BoQ but not in drawings: {missing_in_drawings}")
```

---

## Post-Processing

### Export to Other Formats

**Excel (default):**
```python
url = f"{BASE_URL}/api/artifacts/{project_id}/audit_report.xlsx"
response = requests.get(url)
# Save XLSX
```

**JSON (programmatic):**
```python
url = f"{BASE_URL}/api/artifacts/{project_id}/audit_results.json"
response = requests.get(url)
data = response.json()
# Process JSON
```

**CSV (for spreadsheets):**
```python
import pandas as pd

# Get positions
positions = get_positions(project_id)

# Convert to DataFrame
df = pd.DataFrame(positions)

# Export to CSV
df.to_csv(f"{project_id}_positions.csv", index=False)
```

---

### Integration with Other Systems

**ERP Integration:**

```python
# Export to SAP/Oracle format
positions = get_positions(project_id)

erp_data = []
for pos in positions:
    erp_data.append({
        "MATERIAL_CODE": pos["code"],
        "MATERIAL_DESC": pos["description"],
        "QUANTITY": pos["quantity"],
        "UOM": pos["unit"],
        "PRICE": pos["unit_price"],
        "CURRENCY": "CZK"
    })

# Upload to ERP via API
```

**Project Management Tools:**

```python
# Export to MS Project / Primavera format
# ... custom export logic ...
```

---

## Troubleshooting

### Common Issues

#### 1. Parsing Errors

**Problem:** "Failed to parse XML: Invalid UNIXML format"

**Solutions:**
- Verify XML is valid UNIXML format
- Check for encoding issues (must be UTF-8)
- Ensure `<unixml>` root element exists

#### 2. Low Confidence Scores

**Problem:** Many AMBER/RED positions

**Solutions:**
- Ensure position codes match KROS database
- Add more detailed descriptions
- Verify unit prices are reasonable
- Check applicable norms are specified

#### 3. AI Timeout

**Problem:** "Request timeout after 120s"

**Solutions:**
- Increase timeout in config: `CLAUDE_TIMEOUT=300`
- Process in smaller batches
- Check Claude API status

#### 4. Excel Export Fails

**Problem:** "Failed to save artifact: Permission denied"

**Solutions:**
- Check `data/processed/` directory permissions
- Ensure disk space available
- Close Excel file if open

#### 5. Drawing Analysis Fails (Workflow B)

**Problem:** "GPT-4 Vision: Image too large"

**Solutions:**
- Compress images/PDFs before upload
- Ensure drawings are < 50 MB
- Use higher quality scans (not photos)

---

### Performance Optimization

**For large BoQs (500+ positions):**

1. **Batch processing:**
```python
# Process in batches of 50
for i in range(0, len(positions), 50):
    batch = positions[i:i+50]
    # Process batch
```

2. **Parallel execution:**
```python
# Enable parallel processing
# Set in .env: ENABLE_PARALLEL_AUDIT=true
```

3. **Cache warm-up:**
```python
# Pre-load KROS database
# Ensures faster matching
```

---

### Debug Mode

**Enable verbose logging:**

```bash
# In .env
LOG_LEVEL=DEBUG
ENABLE_DETAILED_LOGGING=true
```

**Check logs:**

```bash
tail -f logs/app.log
```

---

## Related Documentation

- [README.md](../README.md) - Project overview
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [API.md](API.md) - API reference
- [CONFIG.md](CONFIG.md) - Configuration reference
- [TESTS.md](TESTS.md) - Testing guide

---

**Last updated:** 2025-01-26
**Maintainer:** Development Team
**Questions?** Open an issue on GitHub
