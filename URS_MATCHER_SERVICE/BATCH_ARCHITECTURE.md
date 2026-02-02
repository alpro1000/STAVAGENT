# Batch URS Matcher - Architecture

**Version:** 1.0.0
**Date:** 2026-02-02
**Status:** Implementation In Progress

---

## Overview

Batch URS Matcher extends the existing manual mode (1 position → candidates) with a **batch mode** that processes entire BOQ lists automatically. It detects composite positions (multiple works hidden in one line), splits them, and matches each subwork to ÚRS codes.

**Core Principle:** LLM (interpret) → Perplexity (retrieve) → LLM (rerank)

---

## Key Requirements

### 🔴 Critical Constraints

1. **No Breaking Changes** - Manual mode must continue working exactly as before
2. **No Hallucinations** - ÚRS codes ONLY from search results, never invented
3. **Resume Support** - Batch jobs must be pausable and resumable
4. **Cache Everything** - Avoid duplicate API calls (cost optimization)
5. **Use Gemini** - Default LLM for cost optimization (40-250x cheaper than Claude)
6. **Comprehensive Logging** - Log every AI decision with reasoning + timing
7. **Subordinate Context** - Use CHILD rows as context, don't process them as separate positions

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BATCH PROCESSOR                              │
│                                                                      │
│  Input: BOQ List (text/Excel/project)                               │
│      │                                                               │
│      ▼                                                               │
│  ┌──────────────────────────────────────────────┐                   │
│  │ 1. TEXT NORMALIZER                            │                   │
│  │    - Clean text (remove drawings, duplicates) │                   │
│  │    - Extract features (material, operation)   │                   │
│  │    - Normalize units                          │                   │
│  └──────────────────────────────────────────────┘                   │
│      │                                                               │
│      ▼                                                               │
│  ┌──────────────────────────────────────────────┐                   │
│  │ 2. WORK SPLITTER (LLM - Gemini)              │                   │
│  │    - Detect: SINGLE vs COMPOSITE              │                   │
│  │    - Split composite into SubWork[] (max 5)   │                   │
│  │    - Keywords: včetně, komplet, dodávka a     │                   │
│  │      montáž, demontáž, výkop+odvoz+zásyp      │                   │
│  └──────────────────────────────────────────────┘                   │
│      │                                                               │
│      ▼                                                               │
│  FOR EACH SubWork:                                                   │
│      │                                                               │
│      ▼                                                               │
│  ┌──────────────────────────────────────────────┐                   │
│  │ 3. CANDIDATE RETRIEVER (Perplexity)          │                   │
│  │    - Generate 2-4 search queries              │                   │
│  │    - Search online ÚRS catalog                │                   │
│  │    - Return 10-30 candidates                  │                   │
│  │    - Deduplicate results                      │                   │
│  └──────────────────────────────────────────────┘                   │
│      │                                                               │
│      ▼                                                               │
│  ┌──────────────────────────────────────────────┐                   │
│  │ 4. CANDIDATE RERANKER (LLM - Gemini)         │                   │
│  │    - Score each candidate (0-100)             │                   │
│  │    - Select top 3-4                           │                   │
│  │    - Add confidence (high/medium/low)         │                   │
│  │    - Add reasoning + evidence                 │                   │
│  │    - Flag needs_review if uncertain           │                   │
│  └──────────────────────────────────────────────┘                   │
│      │                                                               │
│      ▼                                                               │
│  ┌──────────────────────────────────────────────┐                   │
│  │ 5. BATCH CACHE                                │                   │
│  │    - Store results (avoid duplicate calls)    │                   │
│  │    - Enable resume from any point             │                   │
│  │    - Track status per position                │                   │
│  └──────────────────────────────────────────────┘                   │
│      │                                                               │
│      ▼                                                               │
│  Output:                                                             │
│  - Table (UI): LineNo | Text | SubWorks | Candidates | Scores       │
│  - Excel: Matches sheet + Summary sheet                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Database Schema (SQLite)

#### batch_jobs
```sql
CREATE TABLE batch_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'paused', 'completed', 'failed')),
  settings TEXT NOT NULL,  -- JSON: {candidatesPerWork, maxSubWorks, searchDepth, language}
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  needs_review_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT
);
```

#### batch_items
```sql
CREATE TABLE batch_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
  line_no INTEGER,
  original_text TEXT NOT NULL,
  normalized_text TEXT,
  detected_type TEXT CHECK(detected_type IN ('SINGLE', 'COMPOSITE', 'UNKNOWN')),
  status TEXT NOT NULL CHECK(status IN ('queued', 'parsed', 'split', 'retrieved', 'ranked', 'done', 'error', 'needs_review')),
  sub_works TEXT,  -- JSON: [{text, keywords, features}]
  results TEXT,    -- JSON: [{subWork, candidates: [{code, name, unit, score, confidence, reason, evidence}]}]
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_batch_items_batch_id ON batch_items(batch_id);
CREATE INDEX idx_batch_items_status ON batch_items(status);
```

#### batch_cache
```sql
CREATE TABLE batch_cache (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,  -- Hash of (normalized_text + settings)
  stage TEXT NOT NULL CHECK(stage IN ('split', 'retrieve', 'rerank')),
  result TEXT NOT NULL,  -- JSON result
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE INDEX idx_batch_cache_key ON batch_cache(cache_key);
CREATE INDEX idx_batch_cache_expires ON batch_cache(expires_at);
```

---

## Service Modules

### 1. textNormalizer.js

**Purpose:** Clean and extract features from raw position text.

**Input:**
```javascript
{
  originalText: "Výkop stavební jámy kat. 3, h=2.5m, vč. odvoz na skládku 10km (231112)",
  context: {
    parentText: "HSV - Zemní práce",
    previousRows: ["Díl 0 - Všeobecné konstrukce"]
  }
}
```

**Output:**
```javascript
{
  normalizedText: "Výkop stavební jámy kat. 3, h=2.5m, vč. odvoz na skládku 10km",
  features: {
    operation: "výkop",
    object: "stavební jáma",
    material: "kategorie 3",
    depth: "2.5m",
    additionalWork: "odvoz na skládku",
    distance: "10km"
  },
  markers: {
    hasComposite: true,  // "vč."
    hasTransport: true,
    hasDemolition: false
  }
}
```

**Algorithm:**
- Remove: drawing numbers, section codes, duplicate spaces
- Extract: numbers, units, materials, classes, thicknesses
- Detect: композитные маркеры (včetně, komplet, dodávka a montáž)

---

### 2. workSplitter.js (LLM)

**Purpose:** Detect if position is SINGLE or COMPOSITE, split if needed.

**Input:**
```javascript
{
  normalizedText: "Výkop jámy + odvoz + zásyp + hutnění",
  features: { ... },
  maxSubWorks: 5
}
```

**Output:**
```javascript
{
  detectedType: "COMPOSITE",
  subWorks: [
    {
      index: 1,
      text: "Výkop jámy",
      operation: "excavation",
      keywords: ["výkop", "jáma", "excavation"]
    },
    {
      index: 2,
      text: "Odvoz výkopku",
      operation: "transport",
      keywords: ["odvoz", "transport", "removal"]
    },
    {
      index: 3,
      text: "Zásyp jámy",
      operation: "backfill",
      keywords: ["zásyp", "backfill"]
    },
    {
      index: 4,
      text: "Hutnění zásypu",
      operation: "compaction",
      keywords: ["hutnění", "compaction"]
    }
  ],
  reasoning: "Detected 4 distinct works separated by '+' marker",
  confidence: "high"
}
```

**LLM Prompt (Gemini 2.0 Flash):**
```
You are a construction BOQ expert. Analyze this position and determine if it contains multiple works.

INPUT:
Text: {normalizedText}
Features: {features}

RULES:
1. SINGLE = one work operation
2. COMPOSITE = 2-5 separate works (split them)
3. Markers: "včetně", "vč.", "+", "komplet", "dodávka a montáž", "se vším"
4. Max 5 subworks - if more, mark as needs_review

OUTPUT (JSON):
{
  "detectedType": "SINGLE" | "COMPOSITE",
  "subWorks": [{index, text, operation, keywords}],
  "reasoning": "short explanation",
  "confidence": "high" | "medium" | "low"
}
```

---

### 3. candidateRetriever.js (Perplexity)

**Purpose:** Search online ÚRS catalog for matching codes.

**Input:**
```javascript
{
  subWork: {
    text: "Výkop jámy",
    operation: "excavation",
    keywords: ["výkop", "jáma"]
  },
  searchDepth: "normal"  // quick=2, normal=3, deep=4 queries
}
```

**Output:**
```javascript
{
  subWork: { ... },
  candidates: [
    {
      code: "121101101",
      name: "Hloubení jam nezapažených v hornině tř. 3",
      unit: "m3",
      snippet: "Výkop stavebních jam a šachet nezapažených...",
      source: "https://katalogy.ckait.cz/urs/...",
      searchQuery: "výkop stavební jáma kategorie 3"
    },
    // ... 10-30 candidates
  ],
  queriesUsed: ["výkop jáma kategorie 3", "hloubení jáma nezapažená", "výkop hornina třída 3"],
  timing: {
    query1Ms: 1240,
    query2Ms: 1180,
    totalMs: 2420
  }
}
```

**Algorithm:**
1. Generate 2-4 queries based on searchDepth:
   - Strict: operation + material + key feature
   - Expanded: synonyms + variations
   - Reverse: object + operation
2. Call Perplexity for each query
3. Deduplicate candidates (by code)
4. Return top 30 max

---

### 4. candidateReranker.js (LLM)

**Purpose:** Score and select top candidates from retrieved list.

**Input:**
```javascript
{
  subWork: {
    text: "Výkop jámy",
    operation: "excavation",
    keywords: ["výkop", "jáma"]
  },
  candidates: [
    {code: "121101101", name: "Hloubení jam...", unit: "m3"},
    // ... 30 candidates
  ],
  topN: 4
}
```

**Output:**
```javascript
{
  subWork: { ... },
  topCandidates: [
    {
      rank: 1,
      code: "121101101",
      name: "Hloubení jam nezapažených v hornině tř. 3",
      unit: "m3",
      score: 95,
      confidence: "high",
      reason: "Exact match for excavation + category 3 + pit",
      evidence: "stavební jáma + kategorie 3 + hloubení",
      needsReview: false
    },
    {
      rank: 2,
      code: "121101201",
      name: "Hloubení jam zapažených v hornině tř. 3",
      unit: "m3",
      score: 75,
      confidence: "medium",
      reason: "Similar but assumes shoring (zapažení)",
      evidence: "jáma + kategorie 3",
      needsReview: false
    },
    // ... up to 4 candidates
  ],
  reasoning: "Top candidate matches all key features",
  timing: {
    llmMs: 2340
  }
}
```

**LLM Prompt (Gemini 2.0 Flash):**
```
You are a ÚRS expert. Score these candidates for the work description.

WORK:
Text: {subWork.text}
Operation: {subWork.operation}
Keywords: {subWork.keywords}

CANDIDATES (from search):
{candidates.map(c => `${c.code}: ${c.name} (${c.unit})`)}

RULES:
1. ONLY select from the candidates list (NO invented codes)
2. Score 0-100 based on: operation match, material match, unit match
3. Confidence: high (90+), medium (70-89), low (<70)
4. If no good match, return score=0 + confidence=low + needsReview=true
5. Return top {topN} candidates

OUTPUT (JSON):
{
  "topCandidates": [
    {
      "rank": 1,
      "code": "...",
      "name": "...",
      "unit": "...",
      "score": 0-100,
      "confidence": "high" | "medium" | "low",
      "reason": "1 sentence",
      "evidence": "key matching words",
      "needsReview": false
    }
  ],
  "reasoning": "overall assessment"
}
```

---

### 5. batchProcessor.js (Orchestrator)

**Purpose:** Main pipeline controller.

**Flow:**
```javascript
async function processPosition(batchId, itemId) {
  const item = await db.getBatchItem(itemId);
  const settings = await db.getBatchJob(batchId).settings;

  try {
    // Step 1: Normalize
    updateStatus(itemId, 'parsed');
    const normalized = await textNormalizer.normalize(item.original_text, item.context);
    await db.updateItem(itemId, { normalized_text: normalized.normalizedText });

    // Step 2: Split (with cache)
    updateStatus(itemId, 'split');
    const cacheKey = hash(normalized.normalizedText + settings);
    let splitResult = await batchCache.get(cacheKey, 'split');
    if (!splitResult) {
      splitResult = await workSplitter.split(normalized, settings.maxSubWorks);
      await batchCache.set(cacheKey, 'split', splitResult, TTL_30_DAYS);
    }
    await db.updateItem(itemId, { detected_type: splitResult.detectedType, sub_works: splitResult.subWorks });

    // Step 3: Retrieve candidates for each subwork
    updateStatus(itemId, 'retrieved');
    const results = [];
    for (const subWork of splitResult.subWorks) {
      const retrieveCacheKey = hash(subWork.text + settings.searchDepth);
      let candidates = await batchCache.get(retrieveCacheKey, 'retrieve');
      if (!candidates) {
        candidates = await candidateRetriever.retrieve(subWork, settings.searchDepth);
        await batchCache.set(retrieveCacheKey, 'retrieve', candidates, TTL_7_DAYS);
      }

      // Step 4: Rerank candidates
      const rerankCacheKey = hash(subWork.text + JSON.stringify(candidates) + settings.candidatesPerWork);
      let reranked = await batchCache.get(rerankCacheKey, 'rerank');
      if (!reranked) {
        reranked = await candidateReranker.rerank(subWork, candidates, settings.candidatesPerWork);
        await batchCache.set(rerankCacheKey, 'rerank', reranked, TTL_7_DAYS);
      }

      results.push({
        subWork: subWork,
        candidates: reranked.topCandidates
      });
    }

    // Final status
    const needsReview = results.some(r => r.candidates.some(c => c.needsReview || c.confidence === 'low'));
    updateStatus(itemId, needsReview ? 'needs_review' : 'done');
    await db.updateItem(itemId, { results: results });

  } catch (error) {
    updateStatus(itemId, 'error');
    await db.updateItem(itemId, { error_message: error.message });
    throw error;
  }
}

async function processBatch(batchId) {
  const job = await db.getBatchJob(batchId);
  await db.updateBatchJob(batchId, { status: 'running', started_at: new Date() });

  const items = await db.getBatchItems(batchId, { status: ['queued', 'error'] });
  const concurrency = 3;  // Process 3 positions in parallel

  try {
    await pMap(items, async (item) => {
      await processPosition(batchId, item.id);
      await db.incrementProcessedCount(batchId);
    }, { concurrency });

    await db.updateBatchJob(batchId, { status: 'completed', completed_at: new Date() });
  } catch (error) {
    await db.updateBatchJob(batchId, { status: 'failed', error_message: error.message });
    throw error;
  }
}
```

---

### 6. batchCache.js

**Purpose:** Cache results to avoid duplicate API calls.

**API:**
```javascript
async function get(cacheKey, stage) {
  const cached = await db.getBatchCache(cacheKey, stage);
  if (!cached || cached.expires_at < new Date()) {
    return null;
  }
  return JSON.parse(cached.result);
}

async function set(cacheKey, stage, result, ttlMs) {
  const expires_at = new Date(Date.now() + ttlMs);
  await db.upsertBatchCache({
    id: uuid(),
    cache_key: cacheKey,
    stage: stage,
    result: JSON.stringify(result),
    expires_at: expires_at
  });
}

function hash(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
```

**TTL:**
- Split: 30 days (position text rarely changes)
- Retrieve: 7 days (ÚRS catalog updates slowly)
- Rerank: 7 days (scoring is deterministic)

---

## API Endpoints

### POST /api/batch/create
Create new batch job.

**Request:**
```json
{
  "name": "Project BOQ - 2026-02-02",
  "items": [
    {"lineNo": 1, "text": "Výkop jámy kat. 3", "context": {...}},
    {"lineNo": 2, "text": "Beton C25/30 vč. doprava", "context": {...}}
  ],
  "settings": {
    "candidatesPerWork": 4,
    "maxSubWorks": 5,
    "searchDepth": "normal",
    "language": "cs"
  }
}
```

**Response:**
```json
{
  "batchId": "batch_xyz",
  "status": "queued",
  "totalItems": 2
}
```

---

### POST /api/batch/:id/start
Start processing batch.

**Response:**
```json
{
  "batchId": "batch_xyz",
  "status": "running",
  "startedAt": "2026-02-02T10:00:00Z"
}
```

---

### POST /api/batch/:id/pause
Pause batch processing.

**Response:**
```json
{
  "batchId": "batch_xyz",
  "status": "paused",
  "processedItems": 15,
  "totalItems": 100
}
```

---

### POST /api/batch/:id/resume
Resume paused batch.

**Response:**
```json
{
  "batchId": "batch_xyz",
  "status": "running",
  "processedItems": 15,
  "remainingItems": 85
}
```

---

### GET /api/batch/:id/status
Get batch status and progress.

**Response:**
```json
{
  "batchId": "batch_xyz",
  "status": "running",
  "totalItems": 100,
  "processedItems": 45,
  "errorCount": 2,
  "needsReviewCount": 8,
  "progress": 45,
  "estimatedTimeRemaining": "5 minutes"
}
```

---

### GET /api/batch/:id/results
Get batch results.

**Response:**
```json
{
  "batchId": "batch_xyz",
  "status": "completed",
  "results": [
    {
      "lineNo": 1,
      "originalText": "Výkop jámy kat. 3",
      "detectedType": "SINGLE",
      "subWorks": [
        {
          "index": 1,
          "text": "Výkop jámy kat. 3",
          "candidates": [
            {
              "rank": 1,
              "code": "121101101",
              "name": "Hloubení jam...",
              "unit": "m3",
              "score": 95,
              "confidence": "high",
              "reason": "Exact match",
              "evidence": "výkop + jáma + kategorie 3",
              "needsReview": false
            }
          ]
        }
      ]
    }
  ]
}
```

---

### GET /api/batch/:id/export/xlsx
Export results to Excel.

**Response:** Excel file (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

**Sheet 1: Matches**
| LineNo | OriginalText | DetectedType | SubWorkNo | SubWorkText | CandidateRank | UrsCode | UrsName | UrsUnit | Score | Confidence | NeedsReview | Reason | Evidence | Source |
|--------|--------------|--------------|-----------|-------------|---------------|---------|---------|---------|-------|------------|-------------|--------|----------|--------|

**Sheet 2: Summary**
```
Total Positions: 100
SINGLE: 75
COMPOSITE: 25
  - 2 subworks: 15
  - 3 subworks: 8
  - 4 subworks: 2

Confidence:
  High: 85
  Medium: 12
  Low: 3

Needs Review: 8
Errors: 2
```

---

## Logging Strategy

### Log Levels

**INFO:** Progress updates
```
[Batch:batch_xyz] Started processing 100 items
[Batch:batch_xyz] Item 1/100: Parsed + Normalized
[Batch:batch_xyz] Item 1/100: Split → COMPOSITE (3 subworks)
[Batch:batch_xyz] Completed: 45/100 (45%)
```

**DEBUG:** Detailed AI decisions
```
[WorkSplitter] Input: "Výkop + odvoz + zásyp"
[WorkSplitter] LLM (Gemini-2.0-Flash): detectedType=COMPOSITE, subWorks=3, confidence=high
[WorkSplitter] Reasoning: "Detected 3 distinct operations separated by '+'"
[WorkSplitter] Timing: 1,240ms

[CandidateRetriever] SubWork: "Výkop jámy"
[CandidateRetriever] Query 1: "výkop stavební jáma kategorie 3"
[CandidateRetriever] Perplexity: 12 candidates found (1,180ms)
[CandidateRetriever] Query 2: "hloubení jáma nezapažená"
[CandidateRetriever] Perplexity: 8 candidates found (1,050ms)
[CandidateRetriever] Total candidates: 18 (deduplicated to 15)

[CandidateReranker] SubWork: "Výkop jámy"
[CandidateReranker] Candidates: 15
[CandidateReranker] LLM (Gemini-2.0-Flash): Top 4 selected
[CandidateReranker] Rank 1: code=121101101, score=95, confidence=high
[CandidateReranker] Reasoning: "Exact match for excavation + category 3 + pit"
[CandidateReranker] Timing: 2,340ms
```

**WARN:** Low confidence / needs review
```
[CandidateReranker] WARNING: Low confidence (score=45) for "Speciální práce"
[CandidateReranker] Marked as needs_review=true
```

**ERROR:** Failures
```
[BatchProcessor] ERROR: Item batch_xyz_item_5 failed
[BatchProcessor] Error: Perplexity timeout after 60000ms
[BatchProcessor] Retrying in 2s...
```

---

## Frontend UI

### Batch Tab (new)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ URS MATCHER                                                     │
├─────────────────────────────────────────────────────────────────┤
│  [ Manual Mode ]  [ Batch Mode ]  ← Tabs                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BATCH MODE - Seznam pozic                                      │
│                                                                 │
│  Input Options:                                                 │
│  ○ Paste list (textarea)                                        │
│  ○ Select from project (dropdown)                               │
│                                                                 │
│  Settings:                                                      │
│  Candidates per work: [4 ▼]                                     │
│  Max subworks: [5 ▼]                                            │
│  Search depth: [○ Quick ● Normal ○ Deep]                        │
│  Language: [Czech ▼]                                            │
│                                                                 │
│  [ Start Batch ]  [ Pause ]  [ Resume ]  [ Export XLSX ]        │
│                                                                 │
│  Progress: ████████████░░░░░░░░ 45/100 (45%)                    │
│  Needs Review: 8 | Errors: 2                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ RESULTS TABLE                                            │   │
│  ├─────┬──────────┬──────┬─────────┬──────┬────┬─────────┤   │
│  │ №   │ Original │ Type │ SubWork │ Rank │ ÚRS│ Score   │   │
│  ├─────┼──────────┼──────┼─────────┼──────┼────┼─────────┤   │
│  │ 1   │ Výkop... │ SING │ Výkop...│  1   │ 12 │ 95 ✓    │   │
│  │     │          │      │         │  2   │ 12 │ 75 ✓    │   │
│  │ 2   │ Beton... │ COMP │ Beton...│  1   │ 24 │ 90 ✓    │   │
│  │     │          │      │ Doprava │  1   │ 44 │ 85 ✓    │   │
│  │ 3   │ Special..│ SING │ Special │  1   │ ?? │ 45 ⚠    │   │
│  └─────┴──────────┴──────┴─────────┴──────┴────┴─────────┘   │
│                                                                 │
│  Legend: ✓ High conf. | ○ Medium | ⚠ Needs review             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Plan

### Unit Tests

1. **textNormalizer**
   - Clean drawing numbers
   - Extract features (material, operation, depth)
   - Detect composite markers

2. **workSplitter**
   - SINGLE detection
   - COMPOSITE detection (včetně, +, komplet)
   - Max 5 subworks limit

3. **candidateRetriever**
   - Query generation
   - Deduplication
   - Timeout handling

4. **candidateReranker**
   - Score calculation
   - Confidence levels
   - No hallucinations (codes only from input)

5. **batchCache**
   - Cache hit/miss
   - TTL expiration
   - Hash collision

### Integration Tests

1. **SINGLE position** → 1 subwork → 3-4 candidates
2. **COMPOSITE position** → 3 subworks → 12 candidates total
3. **Resume after pause** → continue from last position
4. **Rate limit** → backoff + retry
5. **Empty search** → unknown + confidence=low + needsReview=true

---

## Cost Optimization

### Model Selection (Gemini 2.0 Flash)

**Cost comparison (per 1M tokens):**
- Claude Sonnet 4.5: $3 input / $15 output
- GPT-4o: $5 input / $15 output
- **Gemini 2.0 Flash: $0.075 input / $0.30 output** ← 40-250x cheaper!

**Estimated costs (100 positions, 50% composite = 150 subworks):**
- Split: 150 LLM calls × 500 tokens avg = 75k tokens ≈ **$0.006**
- Rerank: 150 LLM calls × 2k tokens avg = 300k tokens ≈ **$0.113**
- Perplexity: 450 searches × $0.005 = **$2.25**
- **Total: ~$2.37 per 100 positions**

With Claude: ~$60 per 100 positions (25x more expensive!)

### Caching Strategy

**Cache hit rates (estimated):**
- Split: 30% (common position patterns)
- Retrieve: 50% (same search queries)
- Rerank: 40% (same candidate lists)

**Savings:** ~40% cost reduction with cache

---

## Deployment Checklist

### Backend
- [ ] Database migrations (batch_jobs, batch_items, batch_cache)
- [ ] Environment variables (GOOGLE_API_KEY for Gemini)
- [ ] Service modules (6 files: normalizer, splitter, retriever, reranker, processor, cache)
- [ ] API routes (7 endpoints)
- [ ] Excel exporter
- [ ] Logging configuration

### Frontend
- [ ] Batch tab UI
- [ ] Input components (textarea, project selector)
- [ ] Settings panel
- [ ] Progress indicator
- [ ] Results table
- [ ] Export button

### Testing
- [ ] Unit tests (5 services)
- [ ] Integration tests (5 scenarios)
- [ ] Manual testing (SINGLE, COMPOSITE, Resume)

### Documentation
- [ ] API documentation
- [ ] User guide (how to use batch mode)
- [ ] Architecture doc (this file)

---

## Future Enhancements

1. **Smart grouping** - Group similar positions before processing
2. **Parallel Perplexity** - Search multiple subworks simultaneously
3. **User feedback loop** - Learn from corrections
4. **Cost dashboard** - Show real-time API costs
5. **Schedule processing** - Run batches overnight
6. **Multi-language** - Support RU/UA/EN positions

---

**Next Steps:** Begin implementation with database schema + textNormalizer service.

