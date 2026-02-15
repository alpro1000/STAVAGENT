# Issues to Fix - Next Session

**Created:** 2026-02-12  
**From:** Execution Log Analysis  
**Priority:** Critical (Red) → High (Orange) → Medium (Yellow) → Info (Blue)

---

## ✅ **FIXED (Session 2026-02-12)**

### 1. ✅ OpenAI Proxy Support (CRITICAL)
**Status:** FIXED in [passport_enricher.py](concrete-agent/packages/core-backend/app/services/passport_enricher.py#L204-L226)

**What was changed:**
- Added proper OpenAI SDK v1.3+ compatible initialization
- Support for HTTP/HTTPS proxy via `http_client` parameter (not deprecated `proxies`)
- Better error handling with specific detection for version mismatch
- Graceful fallback if proxy configuration fails

**Code:**
```python
# Now supports proxy properly (OpenAI SDK >= 1.3)
init_kwargs = {"api_key": settings.OPENAI_API_KEY}
http_proxy = getattr(settings, 'HTTP_PROXY', None) or getattr(settings, 'HTTPS_PROXY', None)
if http_proxy:
    http_client = httpx.Client(proxies=http_proxy)
    init_kwargs["http_client"] = http_client

self.openai_client = OpenAI(**init_kwargs)
```

### 2. ✅ Gemini 2.0 Flash Deprecated (HIGH)
**Status:** FIXED in [passport_enricher.py](concrete-agent/packages/core-backend/app/services/passport_enricher.py#L159)

**What was changed:**
- Updated model name: `gemini-2.0-flash-exp` → `gemini-2.0-flash` (stable version)
- Added intelligent fallback chain: `2.0-flash → 1.5-flash → 1.5-pro`
- Automatic recovery if preferred model not available

**Code:**
```python
GEMINI_MODEL = "gemini-2.0-flash"  # Stable version (was: gemini-2.0-flash-exp)

# And initialization with fallback:
for model_to_try in [self.GEMINI_MODEL, "gemini-1.5-flash", "gemini-1.5-pro"]:
    try:
        self.gemini_model = genai.GenerativeModel(model_to_try)
        break
    except Exception:
        continue
```

### 3. ✅ Invalid Structure Type (INFO)
**Status:** FIXED in [passport_schema.py](concrete-agent/packages/core-backend/app/models/passport_schema.py#L72-L86)

**What was changed:**
- Added missing structure types: RAILWAY, ROAD, INDUSTRIAL, RESIDENTIAL, COMMERCIAL, INFRASTRUCTURE, PARKING, STADIUM, HYDRAULIC
- Now supports 15 structure types (was: 7)
- Bilingual comments (Czech/English)

**Code:**
```python
class StructureType(str, Enum):
    BUILDING = "building"
    BRIDGE = "bridge"
    TUNNEL = "tunnel"
    FOUNDATION = "foundation"
    RETAINING_WALL = "retaining_wall"
    SLAB = "slab"
    RAILWAY = "railway"  # ← ADDED
    ROAD = "road"  # ← ADDED
    INDUSTRIAL = "industrial"  # ← ADDED
    # ... and 5 more types
```

---

## 🟡 **REMAINING ISSUES TO FIX**

---

## 🟡 **REMAINING ISSUES TO FIX**

### **MEDIUM: PDF Table Parsing Warnings**

**Issue:**
```
Warnings: unknown_header="col_1", unknown_header="col_2", unknown_header="col_3", etc.
Location: app.utils.position_normalizer (page 12 of PDF)
```

**Symptom:**
- Table on page 12 parsed with unrecognized column headers
- Columns default to generic names (`col_1`, `col_2`, etc.)
- Likely Czech column names not in dictionary

**Affected Code:**
[position_normalizer.py](concrete-agent/packages/core-backend/app/utils/position_normalizer.py)

**Solution:**
1. **Extract the table from page 12:**
   ```python
   # Log the actual headers
   logger.info(f"Page 12 headers: {actual_headers}")
   ```

2. **Map Czech headers to canonical names:**
   ```python
   CZECH_HEADER_MAPPING = {
       "Položka": "item_name",
       "Množství": "quantity",
       "Jednotka": "unit",
       "Jednotková cena": "unit_price",
       "Cena celkem": "total_price",
       # ... add more
   }
   ```

3. **Add to position_normalizer.normalize_table()**

**Action Items:**
- [ ] Add logging to capture actual headers from page 12
- [ ] Create CZECH_HEADER_MAPPING dictionary
- [ ] Test with actual PDF file: `pytest test_pdf_page12.py`
- [ ] Update [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) with header mapping

---

## 📋 Summary- [ ] Add logging to capture actual headers from page 12
- [ ] Create CZECH_HEADER_MAPPING dictionary
- [ ] Test with actual PDF file: `pytest test_pdf_page12.py`
- [ ] Update [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) with header mapping

---

## 🔵 **INFO: Invalid Structure Type Warning**

### Issue
```
Validation warning: Invalid structure_type: "railway"
Location: app.services.passport_enricher._merge_enrichments()
```

### Root Cause
- LLM predicted structure type `"railway"` which is not in allowed values
- Currently only allows: `"building" | "bridge" | "tunnel" | "foundation" | ... `

### Current Code
[passport_schema.py](concrete-agent/packages/core-backend/app/models/passport_schema.py)
```python
class StructureType(str, Enum):
    BUILDING = "building"
    BRIDGE = "bridge"
    TUNNEL = "tunnel"
    FOUNDATION = "foundation"
    # ... others
```

### Solution
Add new types to enum:
```python
class StructureType(str, Enum):
    # ... existing
    RAILWAY = "railway"
    ROAD = "road"
    INDUSTRIAL = "industrial"
    RESIDENTIAL = "residential"
    # ... others
```

### Action Items
- [ ] Add `RAILWAY = "railway"` to StructureType enum
- [ ] Add fallback in _merge_enrichments: `if structure_type not in enum: use null`
- [ ] Review CLAUDE.md for full list of Czech structure types
- [ ] Update [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) with all valid types

---

## 📋 Summary Table

| Priority | Issue | Status | Effort | ETA |
|----------|-------|--------|--------|-----|
| 🔴 P1 | OpenAI proxies param | Likely already fixed | 15min | 2026-02-12 |
| 🟠 P2 | Gemini-2.0-flash-exp deprecated | Simple rename | 30min | 2026-02-12 |
| 🟡 P3 | PDF table headers (page 12) | Medium | 1-2h | 2026-02-13 |
| 🔵 P4 | Structure type "railway" | Simple enum | 15min | 2026-02-12 |

---

## 🎯 Testing Checklist

- [ ] Run end-to-end test with sample PDF
- [ ] Verify all LLM providers initialize without errors
- [ ] Test passport enrichment with different models
- [ ] Validate structure_type enum with all known types
- [ ] Check page 12 table parsing with real document
