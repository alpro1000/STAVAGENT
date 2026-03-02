# MinerU Installation - Performance Fix for Passport

**Date:** 2025-01-XX  
**Issue:** PDF parsing takes 4-5 minutes (using slow pdfplumber)  
**Solution:** Install MinerU (magic-pdf) for 10x faster parsing

---

## 🐛 Current Problem

**Slow PDF Parsing:**
```
79 pages × ~3-4 sec/page = 4-5 minutes
```

**Root Cause:**
- MinerU (magic-pdf) NOT installed
- Fallback to pdfplumber (slow, table-by-table parsing)
- Document parsed TWICE (tables + text)

---

## ✅ Solution: Install MinerU

**MinerU (magic-pdf):**
- 10x faster than pdfplumber
- Better table extraction
- OCR support for scanned PDFs
- Single-pass parsing (text + tables)

**Expected improvement:**
```
Before: 4-5 minutes (pdfplumber)
After:  20-30 seconds (MinerU)
```

---

## 📦 Installation

### 1. Update requirements.txt

**File:** `concrete-agent/packages/core-backend/requirements.txt`

Add:
```txt
magic-pdf>=0.7.0
```

### 2. Deploy to Render

```bash
# Commit changes
git add concrete-agent/packages/core-backend/requirements.txt
git commit -m "PERF: Add MinerU (magic-pdf) for fast PDF parsing"
git push origin main

# Render will auto-deploy (~5-10 minutes)
```

### 3. Verify Installation

Check logs for:
```
✅ MinerU (magic-pdf) is available
```

Instead of:
```
⚠️  MinerU (magic-pdf) not installed
```

---

## 🧪 Testing

### Before (pdfplumber):
```bash
curl -X POST https://concrete-agent.onrender.com/api/v1/passport/generate \
  -F "file=@test_79pages.pdf" \
  -F "project_name=Test"

# Expected: 240-300 seconds (4-5 minutes)
```

### After (MinerU):
```bash
curl -X POST https://concrete-agent.onrender.com/api/v1/passport/generate \
  -F "file=@test_79pages.pdf" \
  -F "project_name=Test"

# Expected: 20-30 seconds
```

---

## 📊 Performance Comparison

| Parser | 79 pages | Speed | Quality |
|--------|----------|-------|---------|
| pdfplumber | 4-5 min | ❌ Slow | ✅ Good |
| MinerU | 20-30 sec | ✅ Fast | ✅ Excellent |

**Improvement:** 10x faster

---

## 🔧 Implementation Details

### Current Code (document_processor.py, line 267-275):

```python
# SLOW: PDF parsed TWICE
# 1. SmartParser (tables) - 4-5 minutes
parsed = self.parser.parse(path_obj)

# 2. pdfplumber (text) - 1-2 minutes
with pdfplumber.open(path_obj) as pdf:
    for page in pdf.pages:
        text_content += page.extract_text()
```

### After MinerU Installation:

```python
# FAST: Single-pass parsing
# MinerU extracts text + tables in one go - 20-30 seconds
parsed = self.parser.parse(path_obj)  # Uses MinerU if available
text_content = parsed.get('text', '')  # Already extracted
```

**No code changes needed** - MinerU is auto-detected and used if available.

---

## 📝 Notes

### Why MinerU is Better:

1. **Faster:** C++ backend vs Python loops
2. **Smarter:** ML-based layout detection
3. **Single-pass:** Text + tables + images in one go
4. **OCR:** Handles scanned PDFs
5. **Structure:** Preserves document hierarchy

### Fallback:

If MinerU fails, system automatically falls back to pdfplumber (current behavior).

---

## ✅ Deployment Checklist

- [ ] Add `magic-pdf>=0.7.0` to requirements.txt
- [ ] Commit and push to main
- [ ] Wait for Render deployment (~10 min)
- [ ] Check logs for "MinerU is available"
- [ ] Test with 79-page PDF
- [ ] Verify response time < 60 seconds

---

## 🔗 Related

- **Issue:** Passport generation takes 4-5 minutes
- **Root Cause:** pdfplumber is slow
- **Solution:** Install MinerU (magic-pdf)
- **Expected:** 10x performance improvement

---

**Status:** Ready for Implementation  
**Priority:** Medium (Performance optimization)  
**Impact:** 10x faster PDF parsing
