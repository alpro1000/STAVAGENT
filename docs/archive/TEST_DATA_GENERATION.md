# 📊 Test Data Generation Guide

**Purpose:** Create realistic Excel files for Phase 3 testing
**Time:** ~15 minutes to generate all test files
**Tools:** Excel, LibreOffice Calc, or similar

---

## 🎯 Overview

This guide helps create 4 test Excel files that match the expected file formats used in real projects.

---

## 📝 Test File 1: Single Bridge (test_single_bridge.xlsx)

### File Structure

| Row | Column A | Column B | Column C | Column D |
|-----|----------|----------|----------|----------|
| 1 | Stavba | I/20 HNĚVKOV - SEDLICE | | |
| 2 | Objekt | SO 202 - MOST PŘES POTOK V KM 2,710 | | |
| 3 | Сoupis | 202 - MOST PŘES POTOK | | |
| 4 | | | | |
| 5 | | | | |
| 6 | **Popis** | **MJ** | **Množství** | **Jednotková cena** |
| 7 | ZÁKLADY MOSTU - Beton C30/37 XC2 | m3 | 75 | 2500 |
| 8 | PILÍŘE - Beton C30/37 | m3 | 50 | 2500 |
| 9 | KRYTÍ - Beton C30/37 | m3 | 25 | 2500 |

### Expected Results After Import

```
Stavba: "I/20 HNĚVKOV - SEDLICE"
Stavba Project Created: project_id = "i20_hnevkov__sedlice"

Object Created:
  project_id: "so_202_most_pres_potok_v_km_2,710"
  object_type: "bridge"
  stavba: "I/20 HNĚVKOV - SEDLICE"
  parent_project_id: "i20_hnevkov__sedlice"
  concrete_m3: 150 (75 + 50 + 25)
  positions_created: 3
```

### How to Create

1. Open Excel/Calc
2. Type values exactly as shown in table above
3. Make sure:
   - Row 1 has "Stavba" in A1
   - Row 6 has "Popis" in A6 (header row)
   - Quantities in column C are numbers (not text)
   - Units in column B are exactly "m3" (not "m³" or "M3")
4. Save as **test_single_bridge.xlsx** in project root

---

## 📝 Test File 2: Multiple Objects (test_multiple_objects.xlsx)

### File Structure

```
Row 1:  Stavba | I/20 HNĚVKOV - SEDLICE
Row 2:  [empty]
Row 3:  Objekt | SO 202 - MOST PŘES POTOK V KM 2,710
Row 4:  Сoupis | 202 - MOST
Row 5:  [empty]
Row 6:  Popis | MJ | Množství
Row 7:  BETON C30/37 ZÁKLADY | m3 | 100
Row 8:  BETON C30/37 PILÍŘE | m3 | 50

Row 10: Objekt | SO 203 - TUNEL POD SILNICÍ
Row 11: Сoupis | 203 - TUNEL
Row 12: [empty]
Row 13: Popis | MJ | Množství
Row 14: BETON C25/30 LOŽE | m3 | 120
Row 15: BETON C30/37 KRYTÍ | m3 | 80

Row 17: Objekt | SO 204 - BUDOVA SPRÁVY
Row 18: Сoupis | 204 - BUDOVA
Row 19: [empty]
Row 20: Popis | MJ | Množství
Row 21: BETON C30/37 SLOUPŮ | m3 | 40
Row 22: BETON C30/37 STROPŮ | m3 | 35
```

### Expected Results After Import

```
Stavba Project: project_id = "i20_hnevkov__sedlice"

Object 1 (Bridge):
  project_id: "so_202_most_pres_potok_v_km_2,710"
  object_type: "bridge"
  concrete_m3: 150

Object 2 (Tunnel):
  project_id: "so_203_tunel_pod_silnici"
  object_type: "tunnel"
  concrete_m3: 200

Object 3 (Building):
  project_id: "so_204_budova_spravy"
  object_type: "building"
  concrete_m3: 75

Total: 3 objects, all linked to same stavba project
```

### How to Create

1. Create new Excel file
2. Enter data structure as shown above
3. Important points:
   - ALL objects share same "Stavba" in row 1
   - Each object section has own "Objekt" header
   - Each object section has own data rows
   - Concrete descriptions have different keywords: MOST, TUNEL, BUDOVA
4. Save as **test_multiple_objects.xlsx**

---

## 📝 Test File 3: No Metadata (test_no_metadata.xlsx)

### File Structure

```
Row 1:  [empty]
Row 2:  [empty]
Row 3:  [empty]
Row 4:  [empty]
Row 5:  [empty]
Row 6:  Popis | MJ | Množství
Row 7:  BETON C30/37 | m3 | 100
Row 8:  BETON C25/30 | m3 | 50
```

### Expected Results After Import

```
Response:
  stavba: null
  stavbaProject: null
  bridges[0]:
    object_type: "custom" (no type keyword in description)
    parent_project: null
    concrete_m3: 100

bridges[1]:
  object_type: "custom" (no type keyword in description)
  parent_project: null
  concrete_m3: 50

Status: success = true
Message: "Created 2 objects with X positions"
```

### How to Create

1. Create new Excel file
2. Leave rows 1-5 completely empty
3. Start with header row at row 6
4. Add concrete items without any stavba/objekt metadata
5. No special keywords in descriptions
6. Save as **test_no_metadata.xlsx**

---

## 📝 Test File 4: No Concrete (test_no_concrete.xlsx)

### File Structure

```
Row 1:  Stavba | TEST PROJECT - NO CONCRETE
Row 2:  [empty]
Row 3:  [empty]
Row 4:  [empty]
Row 5:  [empty]
Row 6:  Popis | MJ | Množství
Row 7:  VÝZTUŽ OCELOVÁ | t | 50
Row 8:  TVÁRNICE CIHELNÉ | ks | 1000
Row 9:  KROV DŘEVĚNÝ | m | 250
```

### Expected Results After Import

```
Response:
  success: false
  error: "No concrete projects identified"
  message: "CORE parser did not identify any concrete items..."
  createdProjects: 0
  bridges: []

Expected Log:
  [Upload] CORE returned positions but identified NO concrete bridges
  [Upload] Possible reasons:
    1. No concrete items in the file
    2. CORE parser is unavailable
    3. File format not recognized by CORE
```

### How to Create

1. Create new Excel file
2. Add stavba metadata (shows metadata extraction still works)
3. Add ONLY non-concrete materials:
   - Reinforcement (VÝZTUŽ)
   - Masonry (TVÁRNICE)
   - Wood/timber (KROV)
   - But NO concrete (no C20/25, C30/37, etc.)
4. Save as **test_no_concrete.xlsx**

---

## 🔍 Verification Checklist for Each File

### Before Upload:

- [ ] File is .xlsx format
- [ ] File named correctly (test_*.xlsx)
- [ ] Quantities are NUMBERS, not text
- [ ] Units are exactly "m3" (not "m³", "M3", or other variants)
- [ ] No hidden rows or columns
- [ ] No merged cells
- [ ] UTF-8 encoding for Czech/Russian characters

### Common Mistakes to Avoid:

| Mistake | Impact | Solution |
|---------|--------|----------|
| Quantities as text "150" | Won't be recognized | Use numbers without quotes |
| Units as "m³" instead of "m3" | Won't match detection | Use "m3" exactly |
| "Stavba" in wrong row | Metadata not found | Must be in first 15 rows |
| "Popis" header missing | Concrete detection fails | Add header row |
| "MOST" vs "most" inconsistent | Type detection fails | Keywords are case-insensitive |
| Extra spaces "Stavba  " | May not match | Use exact text |

---

## 📥 Alternative: Using Python to Generate Files

If you prefer programmatic generation:

```python
import openpyxl
from openpyxl.utils import get_column_letter

# Test File 1: Single Bridge
wb = openpyxl.Workbook()
ws = wb.active

ws['A1'] = 'Stavba'
ws['B1'] = 'I/20 HNĚVKOV - SEDLICE'
ws['A2'] = 'Objekt'
ws['B2'] = 'SO 202 - MOST PŘES POTOK V KM 2,710'
ws['A3'] = 'Сoupis'
ws['B3'] = '202 - MOST PŘES POTOK'

ws['A6'] = 'Popis'
ws['B6'] = 'MJ'
ws['C6'] = 'Množství'

ws['A7'] = 'ZÁKLADY MOSTU - Beton C30/37 XC2'
ws['B7'] = 'm3'
ws['C7'] = 75

ws['A8'] = 'PILÍŘE - Beton C30/37'
ws['B8'] = 'm3'
ws['C8'] = 50

ws['A9'] = 'KRYTÍ - Beton C30/37'
ws['B9'] = 'm3'
ws['C9'] = 25

wb.save('test_single_bridge.xlsx')
```

---

## 📊 File Size Reference

Expected file sizes:
- Single bridge: ~5-10 KB
- Multiple objects: ~8-15 KB
- No metadata: ~3-5 KB
- No concrete: ~4-6 KB

If file is significantly larger:
- Remove hidden rows/columns
- Delete unused worksheets
- Remove formatting/styles if not needed

---

## 🚀 Using Generated Files for Testing

### Upload via API

```bash
# Using curl
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test_single_bridge.xlsx" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Using Python
import requests

files = {'file': open('test_single_bridge.xlsx', 'rb')}
response = requests.post(
  'http://localhost:3000/api/upload',
  files=files,
  headers={'Authorization': 'Bearer YOUR_TOKEN'}
)
print(response.json())
```

### Check Response

```json
{
  "import_id": "uuid",
  "stavba": "I/20 HNĚVKOV - SEDLICE",
  "stavbaProject": "i20_hnevkov__sedlice",
  "createdProjects": 1,
  "bridges": [
    {
      "object_type": "bridge",
      "parent_project": "i20_hnevkov__sedlice",
      "concrete_m3": 150
    }
  ],
  "message": "Created 1 objects with 3 positions in project \"I/20 HNĚVKOV - SEDLICE\""
}
```

---

## 📋 Summary

| File | Purpose | Key Feature | Expected Objects |
|------|---------|-------------|------------------|
| test_single_bridge.xlsx | Basic functionality | One bridge with metadata | 1 bridge |
| test_multiple_objects.xlsx | Hierarchy & types | Mixed types (bridge/tunnel/building) | 3 objects, 1 project |
| test_no_metadata.xlsx | Edge case | No stavba metadata | 2 custom objects |
| test_no_concrete.xlsx | CORE-only validation | No concrete items | 0 objects (error) |

---

**Status:** Ready to generate and test ✅
