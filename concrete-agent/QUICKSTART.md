# Quick Start Guide: Workflows A & B

## 🎯 Choose Your Workflow

### Do you have an existing estimate (Výkaz výměr)?
- **YES** → Use **Workflow A**
- **NO** → Use **Workflow B**

---

## 📋 Workflow A: Import & Audit Existing Estimate

### Step 1: Upload Your Estimate

```bash
curl -X POST "http://localhost:8000/api/v1/workflow-a/upload" \
  -F "estimate_file=@your_estimate.xml" \
  -F "documentation=@spec1.pdf" \
  -F "documentation=@spec2.pdf" \
  -F "project_name=My Project" \
  -F "use_nanonets=true"
```

**Supported formats:**
- `.xml` (KROS UNIXML, KROS Table XML)
- `.xlsx`, `.xls` (Excel estimates)
- `.pdf` (PDF estimates)

**Response:**
```json
{
  "success": true,
  "project_id": "abc123-...",
  "total_positions": 150,
  "positions": [
    {
      "index": 0,
      "code": "121-01-015",
      "description": "Beton monolitický C25/30",
      "unit": "m³",
      "quantity": 12.5,
      "selected": false
    },
    ...
  ]
}
```

### Step 2: Review & Select Positions

Get all positions:
```bash
curl "http://localhost:8000/api/v1/workflow-a/abc123/positions"
```

Select which positions to analyze (e.g., indices 0, 5, 12):

### Step 3: Analyze Selected Positions

```bash
curl -X POST "http://localhost:8000/api/v1/workflow-a/abc123/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "selected_indices": [0, 5, 12],
    "project_context": {
      "location": "Prague",
      "project_type": "Residential"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "total_analyzed": 3,
  "results": [
    {
      "position": {...},
      "classification": "GREEN",
      "confidence": 0.95,
      "kros_match": {...},
      "hitl_required": false
    },
    ...
  ]
}
```

### Step 4: Check Status

```bash
curl "http://localhost:8000/api/v1/workflow-a/abc123/status"
```

---

## 🎨 Workflow B: Generate Estimate from Drawings

### Step 1: Upload Technical Drawings

```bash
curl -X POST "http://localhost:8000/api/v1/workflow-b/upload" \
  -F "drawings=@drawing1.pdf" \
  -F "drawings=@drawing2.pdf" \
  -F "drawings=@floor_plan.pdf" \
  -F "documentation=@technical_spec.pdf" \
  -F "project_name=New Building" \
  -F "use_gpt4v=true"
```

**Supported formats:**
- `.pdf` (Technical drawings)
- `.png`, `.jpg` (Scanned drawings)

**Note:** Workflow B requires GPT-4 Vision API key

**Response:**
```json
{
  "success": true,
  "project_id": "xyz789-...",
  "generated_positions": [
    {
      "code": "121-01-015",
      "description": "Beton monolitický C25/30",
      "unit": "m³",
      "quantity": 12.5,
      "category": "concrete",
      "notes": "Dle výkresu 01"
    },
    ...
  ],
  "total_positions": 15,
  "calculations": {
    "concrete": {
      "volume": 45.5,
      "grade": "C25/30"
    },
    "reinforcement": {
      "weight": 4500,
      "class": "B500B"
    }
  }
}
```

### Step 2: Review Generated Estimate

```bash
curl "http://localhost:8000/api/v1/workflow-b/xyz789/results"
```

### Step 3: Get Technical Card

```bash
curl "http://localhost:8000/api/v1/workflow-b/xyz789/tech-card"
```

**Tech Card includes:**
- Material calculations (concrete, reinforcement, formwork)
- Element summary
- Drawing references

---

## 🔍 Hybrid Parsing (Advanced)

Try multiple parsers and get the best result:

```bash
curl -X POST "http://localhost:8000/api/v1/parse/hybrid" \
  -F "file=@estimate.xml" \
  -F "use_nanonets=true" \
  -F "use_mineru=true" \
  -F "use_claude=true" \
  -F "primary_parser=mineru"
```

**Response:**
```json
{
  "success": true,
  "parser_used": "kros_parser",
  "parsers_attempted": ["kros_parser"],
  "positions": [...],
  "total_positions": 150
}
```

---

## 📊 Check Parser Availability

```bash
curl "http://localhost:8000/api/v1/parse/formats"
```

**Response:**
```json
{
  "supported_formats": {
    "xml": {...},
    "pdf": {...},
    "excel": {...}
  },
  "parsers_available": {
    "kros_parser": true,
    "pdf_parser": true,
    "excel_parser": true,
    "nanonets": false,
    "mineru": false
  },
  "primary_parser": "claude",
  "fallback_enabled": true
}
```

---

## ⚙️ Configuration

### Required Environment Variables

```env
# Core (Required)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Workflow B (Optional)
OPENAI_API_KEY=sk-...
ENABLE_WORKFLOW_B=true

# Enhanced Parsing (Optional)
NANONETS_API_KEY=...
PRIMARY_PARSER=claude
FALLBACK_ENABLED=true

# Rate Limiting
CLAUDE_TOKENS_PER_MINUTE=25000
GPT4_TOKENS_PER_MINUTE=8000
```

---

## 🎯 Common Use Cases

### Case 1: Quick Audit of XML Estimate
```bash
# 1. Upload
project_id=$(curl -X POST "http://localhost:8000/api/v1/workflow-a/upload" \
  -F "estimate_file=@estimate.xml" \
  -F "project_name=Quick Audit" | jq -r '.project_id')

# 2. Analyze first 10 positions
curl -X POST "http://localhost:8000/api/v1/workflow-a/${project_id}/analyze" \
  -H "Content-Type: application/json" \
  -d '{"selected_indices": [0,1,2,3,4,5,6,7,8,9]}'
```

### Case 2: Generate Estimate from Floor Plan
```bash
# 1. Upload floor plan
project_id=$(curl -X POST "http://localhost:8000/api/v1/workflow-b/upload" \
  -F "drawings=@floor_plan.pdf" \
  -F "project_name=Floor Plan Analysis" | jq -r '.project_id')

# 2. Get generated estimate
curl "http://localhost:8000/api/v1/workflow-b/${project_id}/results"

# 3. Get material calculations
curl "http://localhost:8000/api/v1/workflow-b/${project_id}/tech-card"
```

### Case 3: Parse Unknown Format
```bash
# Try all available parsers
curl -X POST "http://localhost:8000/api/v1/parse/hybrid" \
  -F "file=@unknown_estimate.pdf" \
  -F "use_nanonets=true" \
  -F "use_mineru=true" \
  -F "use_claude=true"
```

---

## 🐛 Troubleshooting

### Issue: "No positions found"

**Solution 1:** Try hybrid parsing
```bash
curl -X POST "http://localhost:8000/api/v1/parse/hybrid" -F "file=@estimate.xml"
```

**Solution 2:** Check file format
```bash
curl "http://localhost:8000/api/v1/parse/formats"
```

**Solution 3:** Enable all parsers in `.env`
```env
FALLBACK_ENABLED=true
NANONETS_API_KEY=your_key
```

### Issue: "Rate limit exceeded"

**Solution:** Check current usage and adjust timing
```python
from app.core.rate_limiter import get_rate_limiter
stats = get_rate_limiter().get_usage_stats()
print(stats)
```

### Issue: "Workflow B not available"

**Solution:** Enable Workflow B
```env
ENABLE_WORKFLOW_B=true
OPENAI_API_KEY=sk-...
```

---

## 📚 Next Steps

1. **Test with your data:** Upload a real estimate
2. **Review results:** Check parsing accuracy
3. **Adjust settings:** Fine-tune parsers and rate limits
4. **Integrate:** Connect to your existing systems

---

## 🔗 More Information

- **Architecture Guide:** See `ARCHITECTURE.md`
- **API Documentation:** Visit `http://localhost:8000/docs`
- **Configuration:** See `.env.example`

---

**Happy Building! 🏗️**
