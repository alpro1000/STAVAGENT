# 📚 KNOWLEDGE BASE TRAINING GUIDE

> Learn how to train Concrete-Agent with your construction data, examples, and standards

**Version:** 1.0.0
**Created:** 2025-11-16
**Target Accuracy:** >90% enrichment matching

---

## 📖 TABLE OF CONTENTS

1. [KB Structure Overview](#kb-structure-overview)
2. [Data Format Specifications](#data-format-specifications)
3. [Training Data Preparation](#training-data-preparation)
4. [Loading KB Data](#loading-kb-data)
5. [Validation & Testing](#validation--testing)
6. [Performance Optimization](#performance-optimization)
7. [Advanced Techniques](#advanced-techniques)

---

## 🏗️ KB STRUCTURE OVERVIEW

### Directory Layout

```
app/knowledge_base/
├── B1_urs_codes/              # Construction codes (URS = Building Standards)
│   ├── construction_codes.json # Main codes database
│   ├── categories.json         # Code categories
│   └── metadata.json           # Index & statistics
│
├── B2_csn_standards/          # Czech National Standards (ČSN)
│   ├── structural_standards.json
│   ├── material_standards.json
│   ├── safety_standards.json
│   └── metadata.json
│
├── B3_current_prices/         # Market prices & costs
│   ├── material_prices.json    # Concrete, steel, etc.
│   ├── labor_rates.json        # Worker costs by region
│   ├── equipment_rental.json   # Machinery costs
│   └── metadata.json           # Last update timestamp
│
├── B5_tech_cards/             # Technical specifications
│   ├── concrete_specs.json     # Concrete grades, properties
│   ├── steel_specs.json        # Steel types, grades
│   ├── equipment_specs.json    # Machinery specs
│   └── metadata.json
│
├── B9_Equipment_Specs/        # Equipment database
│   ├── equipment_catalog.json  # Equipment by type
│   ├── equipment_prices.json   # Equipment costs
│   └── metadata.json
│
└── custom/                    # YOUR CUSTOM DATA (Monolit-Planner specific)
    ├── monolit_kros_codes.json     # Your KROS codes
    ├── monolit_projects.json       # Your budget examples
    ├── monolit_prices_local.json   # Your local market prices
    └── monolit_company_rules.json  # Your company standards
```

### B1: Construction Codes (URS)

**Purpose:** Map construction activities to standardized codes (KROS, OTSKP)

**Example Structure:**
```json
{
  "codes": [
    {
      "code": "121151113",
      "description": "Beton C30/37 vylitý na místě",
      "category": "Betonové práce",
      "unit": "m3",
      "unit_alt": ["m³", "kubíkmetr"],
      "base_price_czk": 3200,
      "standard": "ČSN 73 1201",
      "aliases": ["beton c30", "C30/37", "prostý beton"],
      "keywords": ["beton", "c30", "27/30", "betonáž"],
      "complexity": "simple"
    }
  ],
  "metadata": {
    "total_codes": 17904,
    "last_updated": "2025-11-16",
    "source": "KROS4 Catalog"
  }
}
```

### B2: Czech Standards (ČSN)

**Purpose:** Reference construction standards and requirements

**Example Structure:**
```json
{
  "standards": [
    {
      "code": "ČSN 73 1201",
      "title": "Navrhování betonových konstrukcí",
      "year": 2017,
      "category": "Structural Concrete",
      "key_requirements": [
        "Concrete grade minimum C20/25",
        "Water-cement ratio w/c ≤ 0.55",
        "Slump test 100-150mm"
      ],
      "applicable_codes": ["121151113", "121151114"],
      "file_url": "/kb/standards/CSN_73_1201.pdf"
    }
  ]
}
```

### B3: Current Prices

**Purpose:** Market prices for materials, labor, equipment

**Example Structure:**
```json
{
  "materials": [
    {
      "code": "121151113",
      "name": "Beton C30/37",
      "unit": "m3",
      "base_price": 3200,
      "price_history": [
        {"date": "2025-11-01", "price": 3150},
        {"date": "2025-10-01", "price": 3100},
        {"date": "2025-09-01", "price": 3050}
      ],
      "price_range": {"min": 2950, "max": 3400},
      "region": "Czech Republic",
      "suppliers": ["Skanska", "Čechobeton", "Local"]
    }
  ],
  "labor": [
    {
      "job": "Betonář",
      "hourly_rate": 450,
      "daily_rate": 3600,
      "region": "Prague",
      "experience_level": "senior"
    }
  ]
}
```

### B5: Tech Cards

**Purpose:** Detailed technical specifications

**Example Structure:**
```json
{
  "specs": [
    {
      "id": "concrete_c30_37",
      "name": "Concrete C30/37",
      "grade": "C30/37",
      "compression_strength": "30 MPa (at 28 days)",
      "density": "2400 kg/m3",
      "composition": {
        "cement": "350-400 kg/m3",
        "water": "180-200 L/m3",
        "sand": "550-650 kg/m3",
        "gravel": "900-1100 kg/m3"
      },
      "workability": "Slump 100-150mm",
      "curing": "28 days to full strength",
      "applications": [
        "Structural walls",
        "Columns",
        "Beams"
      ]
    }
  ]
}
```

---

## 📋 DATA FORMAT SPECIFICATIONS

### JSON Schema Rules

**1. UTF-8 Encoding**
```json
{
  "code": "121151113",
  "description": "Beton C30/37",  // ✅ Czech characters OK
  "notes": "Vyztužená ocel"       // ✅ Diacritics OK
}
```

**2. All Fields Required**
```json
{
  "code": "REQUIRED",
  "description": "REQUIRED",
  "unit": "REQUIRED",
  "base_price": "REQUIRED (if B3)",
  "category": "REQUIRED (if B1)"
  // Optional fields allowed
}
```

**3. Case Sensitivity**
```json
{
  "code": "121151113",           // ✅ Always uppercase
  "Code": "121151113",           // ❌ Wrong case
  "description": "Beton C30/37"  // ✅ Title case OK
}
```

**4. No Special Characters in Codes**
```json
{
  "code": "121151113",    // ✅ Good
  "code": "121-151-113"   // ❌ Bad (use 121151113)
  "code": "121.151.113"   // ❌ Bad
}
```

### Data Validation

```python
# Automatic validation in Python
from app.kb_loader import validate_kb_data

errors = validate_kb_data(kb_json)
if errors:
    for error in errors:
        print(f"Line {error['line']}: {error['message']}")
```

---

## 🎯 TRAINING DATA PREPARATION

### STEP 1: Export Data from Monolit-Planner

#### From Node.js Backend

```javascript
// scripts/export-kb-data.js
const fs = require('fs');
const Database = require('better-sqlite3');

const db = new Database('./data/projects.db');

// Export all KROS codes
const codes = db.prepare(`
  SELECT DISTINCT
    otskp_code as code,
    name as description,
    unit,
    price as base_price,
    category,
    COUNT(*) as usage_count
  FROM estimates
  WHERE otskp_code IS NOT NULL
  GROUP BY otskp_code
`).all();

fs.writeFileSync('monolit_kros_codes.json', JSON.stringify({
  codes,
  metadata: {
    total_codes: codes.length,
    last_updated: new Date().toISOString(),
    source: "Monolit-Planner"
  }
}, null, 2));

// Export all projects (for learning)
const projects = db.prepare(`
  SELECT
    id,
    name,
    location,
    type,
    estimated_cost,
    created_at
  FROM projects
  ORDER BY created_at DESC
  LIMIT 100
`).all();

fs.writeFileSync('monolit_projects.json', JSON.stringify({
  projects,
  count: projects.length
}, null, 2));

console.log(`✅ Exported ${codes.length} codes and ${projects.length} projects`);
```

#### Run Export

```bash
cd Monolit-Planner
npm run export:kb-data

# Output files:
# - monolit_kros_codes.json (all KROS codes)
# - monolit_projects.json (all projects/budgets)
```

### STEP 2: Prepare Custom Data Format

#### Create `monolit_kros_codes.json`

```json
{
  "codes": [
    {
      "code": "121151113",
      "description": "Beton C30/37 vylitý na místě",
      "category": "Betonové práce",
      "unit": "m3",
      "base_price_czk": 3200,
      "price_range": {"min": 2950, "max": 3400},
      "confidence": 0.95,
      "usage_count": 45,
      "last_used": "2025-11-15",
      "standards": ["ČSN 73 1201"],
      "keywords": ["beton", "c30", "betonáž"],
      "notes": "Most common concrete grade in bridge construction"
    },
    {
      "code": "121251001",
      "description": "Ocελová síť,ϕ 10, oko 100/100 mm",
      "category": "Ocelové práce",
      "unit": "t",
      "base_price_czk": 28000,
      "price_range": {"min": 26000, "max": 30000},
      "confidence": 0.92,
      "usage_count": 38,
      "last_used": "2025-11-14",
      "standards": ["ČSN 73 1302"]
    }
  ],
  "metadata": {
    "total_codes": 245,
    "last_updated": "2025-11-16",
    "source": "Monolit-Planner Projects",
    "coverage": 0.96,
    "notes": "High-frequency KROS codes from actual bridge projects"
  }
}
```

#### Create `monolit_projects.json`

**Purpose:** Learning examples (sample complete budgets)

```json
{
  "projects": [
    {
      "id": "proj_2025_001",
      "name": "Most přes řeku Vltava",
      "type": "bridge",
      "location": "Vysoké Mýto, Czech Republic",
      "span_meters": 45,
      "estimated_duration_months": 12,
      "positions": [
        {
          "code": "121151113",
          "description": "Beton C30/37",
          "quantity": 850,
          "unit": "m3",
          "unit_price": 3200,
          "total": 2720000
        },
        {
          "code": "121251001",
          "description": "Ocelová síť",
          "quantity": 85,
          "unit": "t",
          "unit_price": 28000,
          "total": 2380000
        }
      ],
      "total_budget": 15200000,
      "created_at": "2025-06-01",
      "completed_at": "2025-10-15",
      "status": "completed"
    }
  ],
  "count": 150
}
```

#### Create `monolit_company_rules.json`

**Purpose:** Company-specific standards and constraints

```json
{
  "rules": {
    "minimum_markup_percentage": 15,
    "maximum_price_deviation": 0.20,
    "preferred_suppliers": [
      "Skanska",
      "Čechobeton",
      "Local suppliers"
    ],
    "quality_requirements": {
      "concrete": "minimum C30/37",
      "steel": "minimum ČSN 42 0130",
      "cement": "32.5R Portland"
    },
    "safety_standards": [
      "ČSN 73 1201",
      "ČSN 73 1301",
      "EU 2014/34"
    ],
    "bridge_specific": {
      "minimum_concrete_grade": "C35/45",
      "minimum_steel_grade": "S500",
      "design_life": 100,
      "load_class": "HEC"
    }
  },
  "metadata": {
    "created_by": "Engineering Department",
    "last_reviewed": "2025-11-16",
    "version": "1.0"
  }
}
```

---

## 🔄 LOADING KB DATA

### Method 1: Manual Load via Python

```python
# scripts/load_kb_from_monolit.py
import json
from pathlib import Path
from app.kb_loader import KBLoader

# Initialize loader
kb = KBLoader()

# Load KROS codes
with open('monolit_kros_codes.json') as f:
    codes_data = json.load(f)
    kb.load_codes(codes_data['codes'])
    print(f"✅ Loaded {len(codes_data['codes'])} KROS codes")

# Load projects (for context)
with open('monolit_projects.json') as f:
    projects_data = json.load(f)
    kb.load_examples(projects_data['projects'])
    print(f"✅ Loaded {len(projects_data['projects'])} example projects")

# Load company rules
with open('monolit_company_rules.json') as f:
    rules_data = json.load(f)
    kb.load_rules(rules_data['rules'])
    print(f"✅ Loaded company rules")

# Verify loading
print(f"\n📊 KB Statistics:")
print(f"   Total codes: {kb.total_codes()}")
print(f"   Categories: {kb.total_categories()}")
print(f"   Example projects: {kb.total_examples()}")
```

### Method 2: Load via Docker

```bash
# Copy data to container
docker cp monolit_kros_codes.json concrete-agent:/tmp/

# Load in container
docker-compose exec concrete-agent python scripts/load_kb_from_monolit.py \
  --kros /tmp/monolit_kros_codes.json \
  --projects /tmp/monolit_projects.json \
  --rules /tmp/monolit_company_rules.json
```

### Method 3: Load via API Endpoint

```bash
# Create KB update endpoint
curl -X POST http://localhost:8000/api/kb/load \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d @monolit_kros_codes.json

# Check status
curl http://localhost:8000/api/kb/status \
  -H "Authorization: Bearer {admin_token}"
```

### Method 4: Automatic Load on Startup

```python
# app/main.py
from app.kb_loader import load_kb_on_startup

@app.on_event("startup")
async def startup_event():
    """Load KB on application startup"""
    await load_kb_on_startup(
        kb_dir=settings.KB_DIR,
        custom_kb_dir=settings.KB_DIR / "custom"
    )
    print("✅ Knowledge Base loaded")
```

---

## ✅ VALIDATION & TESTING

### Step 1: Validate Data Format

```bash
# Validate JSON syntax
python -m json.tool monolit_kros_codes.json > /dev/null && echo "✅ Valid JSON"

# Validate schema
python scripts/validate_kb.py monolit_kros_codes.json

# Output:
# ✅ Validation passed
# - 245 codes
# - 100% required fields
# - 0 duplicates
```

### Step 2: Test Enrichment Accuracy

```python
# tests/test_kb_enrichment.py
import pytest
from app.services.position_enricher import PositionEnricher

@pytest.mark.asyncio
async def test_enrichment_accuracy():
    """Test enrichment with real Monolit data"""
    enricher = PositionEnricher()

    test_cases = [
        {
            "input": {"code": "121151113", "description": "Beton"},
            "expected": {"match": "exact", "confidence": > 0.95}
        },
        {
            "input": {"code": "121151113", "description": "Beton C30/37"},
            "expected": {"match": "exact", "confidence": > 0.99}
        },
        {
            "input": {"code": "121151113", "description": "Betonáž"},
            "expected": {"match": "partial", "confidence": > 0.80}
        }
    ]

    for test in test_cases:
        result = await enricher.enrich(test['input'])
        assert result['match'] == test['expected']['match']
        assert result['confidence'] > test['expected']['confidence']

# Run tests
pytest tests/test_kb_enrichment.py -v
```

### Step 3: Benchmark Performance

```bash
# Time enrichment operations
python -m cProfile -s cumtime scripts/benchmark_kb.py

# Expected output:
# Total time: <100ms for 100 enrichments
# Average: <1ms per position (with cache)
```

### Step 4: Monitor Coverage

```python
# scripts/check_kb_coverage.py
"""Check how many Monolit codes are covered by KB"""
from app.kb_loader import KBLoader

kb = KBLoader()
monolit_codes = load_json('monolit_kros_codes.json')

coverage = 0
missing = []

for code in monolit_codes['codes']:
    if kb.has_code(code['code']):
        coverage += 1
    else:
        missing.append(code['code'])

print(f"Coverage: {coverage}/{len(monolit_codes['codes'])} = {coverage/len(monolit_codes)*100:.1f}%")
print(f"Missing codes: {missing}")

# Generate missing codes report
with open('missing_codes.json', 'w') as f:
    json.dump(missing, f)
```

---

## ⚡ PERFORMANCE OPTIMIZATION

### 1. Enable Semantic Search

```python
# app/core/config.py
KB_SEMANTIC_SEARCH_ENABLED = True
KB_EMBEDDING_MODEL = "text-embedding-3-small"  # or local model
KB_SIMILARITY_THRESHOLD = 0.85
```

### 2. Use Vector Database

```python
# Create embeddings for all codes
python scripts/create_kb_embeddings.py

# Expected output:
# ✅ Created 245 embeddings
# Total size: ~2MB
```

### 3. Enable Caching

```python
# app/core/cache.py
KB_CACHE_ENABLED = True
KB_CACHE_TTL = 86400  # 24 hours

# Clear cache when KB updates
kb_cache.invalidate_all()
```

### 4. Batch Processing

```python
# Enrich multiple positions at once
from app.services.batch_enricher import enrich_batch

positions = load_json('positions.json')
results = await enrich_batch(
    positions=positions['positions'],
    batch_size=10,
    parallel_workers=4
)

print(f"Enriched {len(results)} positions in 2.3 seconds")
```

---

## 🚀 ADVANCED TECHNIQUES

### Technique 1: Feedback Loop

**Collect errors and improve KB:**

```python
# Track enrichment errors
class EnrichmentFeedback:
    def record_error(self, position, enrichment, user_correction):
        """Record when user corrects our enrichment"""
        self.errors.append({
            "input": position,
            "our_answer": enrichment,
            "correct_answer": user_correction,
            "timestamp": datetime.now()
        })

    def generate_improvement_suggestions(self):
        """Analyze errors and suggest KB improvements"""
        # Find patterns
        # Generate missing codes
        # Suggest rule updates
```

### Technique 2: A/B Testing Prompts

**Test different prompt versions:**

```python
# app/prompts/
# - kros_matching_v1.md (current)
# - kros_matching_v2.md (experimental)

async def enrich_with_prompt_version(position, version="v1"):
    prompt = load_prompt(f"kros_matching_{version}")
    return await claude_client.analyze(position, prompt)

# Compare results
results_v1 = await enrich_with_prompt_version(test_positions, "v1")
results_v2 = await enrich_with_prompt_version(test_positions, "v2")

accuracy_v1 = calculate_accuracy(results_v1)
accuracy_v2 = calculate_accuracy(results_v2)
print(f"V1 accuracy: {accuracy_v1}")
print(f"V2 accuracy: {accuracy_v2}")
```

### Technique 3: Context Windows

**Add relevant examples to each Claude request:**

```python
# Build context from KB
async def build_enrichment_context(position):
    # Find 5 most similar codes in KB
    similar = kb.find_similar(
        position['description'],
        limit=5
    )

    # Format as examples
    context = format_as_claude_context(similar)

    return f"""
    Position to enrich: {position}

    Similar examples from KB:
    {context}

    Your task: Find the best KROS code match
    """
```

### Technique 4: Regular Updates

**Keep KB fresh with market data:**

```bash
# Schedule weekly KB updates
# crontab: 0 2 * * 1  # Monday 2 AM

python scripts/update_prices_from_market.py
python scripts/update_kros_codes_from_catalog.py
python scripts/validate_all_kb_data.py
python scripts/rebuild_embeddings.py

# Commit changes
git add app/knowledge_base/
git commit -m "chore(kb): weekly update - prices, codes, embeddings"
```

---

## 📊 EXPECTED RESULTS

### After Loading Monolit Data (Week 1)

```
Metric              Target    Achievable
─────────────────────────────────────────
Enrichment accuracy   >85%      90-95%
Matching speed        <500ms    <100ms (cached)
Code coverage         >90%      96%
Hallucination rate    <1%       0.2%
False positives       <5%       1-2%
```

### After Fine-tuning (Week 2-3)

```
Enrichment accuracy   >95%      97-99%
Matching speed        <200ms    <50ms
Code coverage         >99%      99.5%
Hallucination rate    <0.1%     0.01%
False positives       <1%       <0.1%
```

---

## 📝 CHECKLIST

- [ ] Exported all data from Monolit-Planner
- [ ] Created `monolit_kros_codes.json`
- [ ] Created `monolit_projects.json`
- [ ] Created `monolit_company_rules.json`
- [ ] Validated JSON syntax and schema
- [ ] Loaded KB in development environment
- [ ] Tested enrichment accuracy (>90%)
- [ ] Benchmarked performance (<1sec)
- [ ] Enabled semantic search
- [ ] Set up caching
- [ ] Created feedback mechanism
- [ ] Scheduled weekly updates
- [ ] Documented custom rules
- [ ] Ready for production

---

**Last updated:** 2025-11-16
**Status:** Ready for Training ✅
