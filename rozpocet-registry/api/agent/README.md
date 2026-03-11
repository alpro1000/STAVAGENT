# AI Agent - Skupina Classification System

## Overview

Specialized AI agent for classifying BOQ (Bill of Quantities) items into work groups (Skupina).

**Key Features:**
- Classifies ONLY main items (MAIN/section rows)
- Uses subordinate rows (PP/PSC/VV/A195/B5) as context
- Cascades skupina to subordinate items automatically
- Learns from user corrections (Memory Store)
- Multi-layer decision system: cache → rules → memory → Gemini

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Decision Orchestrator                     │
│                                                              │
│  1. Cache Check (exact hash match)                          │
│  2. Rules Layer (fast deterministic)                        │
│  3. Memory Store (similar examples)                         │
│  4. Gemini API (AI classification)                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  RowPack Builder │
                  │  MAIN + CHILD    │
                  └──────────────────┘
```

## Modules

### 1. types.ts
Shared TypeScript interfaces for all modules.

**Key Types:**
- `ParsedItem` - BOQ item from Excel
- `RowPack` - MAIN + subordinates context
- `ClassificationResult` - AI classification output
- `MemoryExample` - Learning data from user corrections

### 2. rowpack.ts
Builds context for AI classification by combining MAIN item with subordinate descriptions.

**Functions:**
- `buildRowPack()` - Creates RowPack from main item + subordinates
- `extractSubordinates()` - Finds subordinate rows for a main item
- `createHash()` - Generates deterministic hash for caching

**Limits:**
- Main text: 2000 chars
- Child text: 6000 chars

### 3. rules.ts
Fast deterministic classification layer using keyword matching.

**Features:**
- 11 classification rules (synced with frontend)
- Diacritics normalization (výkop → vykop)
- Unit boost (m³ → higher confidence for concrete)
- Priority-based conflict resolution

**Example Rules:**
- ZEMNÍ_PRACE: vykop, hloubeni, jama, ryha → confidence 85%
- BETON_MONOLIT: beton, c30/37, monolit → confidence 90%
- VYZTUŽ: vyztuž, armatura, b500 → confidence 92%

### 4. memory.ts
Learning system that stores user corrections and retrieves similar examples.

**Phase 1 (Current):**
- In-memory storage (resets on cold start)
- Simple text similarity (Jaccard coefficient)
- Export/import for migration

**Phase 2 (Planned):**
- Persistent storage (Supabase/Vercel Postgres)
- Vector embeddings + pgvector
- Cross-project learning

**Functions:**
- `storeMemoryExample()` - Save user correction
- `retrieveSimilarExamples()` - Find top-K similar cases
- `checkCache()` - Exact hash match

### 5. gemini.ts
Direct integration with Google Gemini API for AI classification.

**Configuration:**
- Model: `gemini-2.0-flash-exp`
- Temperature: 0.1 (deterministic)
- Max tokens: 200
- Timeout: 30s

**Prompt Structure:**
```
SYSTEM: Ты присваиваешь Skupina ТОЛЬКО для MAIN...

EXAMPLES (from memory):
1. MAIN: [12345] Betonáž...
   CHILD: PP Beton C30/37 | PSC 150 m³
   → Skupina: BETON_MONOLIT

TASK:
MAIN: [67890] Výkopy rýh (45 m³)
CHILD: VV hloubení | A195*15

OUTPUT (JSON only):
{"skupina": "ZEMNÍ_PRACE", "confidence": "high", "reason": "..."}
```

### 6. orchestrator.ts
Main coordination module that orchestrates classification pipeline.

**Algorithm:**
1. Check cache (hash match) → return if found
2. Try rules → return if confidence ≥80%
3. Retrieve similar examples from memory
4. Call Gemini with examples as few-shot context
5. Validate result (must be in allowed list)
6. Return classification

**Batch Processing:**
- Concurrent limit: 5 requests
- Rate limiting: 100ms delay between batches
- Progress callbacks supported

## API Endpoints

### POST /api/classify-empty
Klasifikovat prázdné - Classifies items with empty skupina.

**Request:**
```json
{
  "projectId": "uuid",
  "sheetId": "uuid",
  "items": [...]
}
```

**Response:**
```json
{
  "success": true,
  "changed": 45,
  "unchanged": 5,
  "unknown": 3,
  "stats": {
    "total": 45,
    "bySource": {"rule": 20, "gemini": 25},
    "byConfidence": {"high": 35, "medium": 10},
    "unknown": 3
  },
  "results": [
    {
      "itemId": "uuid",
      "skupina": "BETON_MONOLIT",
      "confidence": "high",
      "confidenceScore": 90,
      "reasoning": "Matched keywords: beton, monolit",
      "source": "rule"
    }
  ]
}
```

### POST /api/classify-all
Překlasifikovat vše - Re-classifies ALL main items.

**Behavior:**
- If AI confidence is low/unknown → keeps existing skupina
- If AI confidence is medium/high → updates skupina
- `forceUpdate: true` → updates regardless of confidence

**Request:**
```json
{
  "projectId": "uuid",
  "sheetId": "uuid",
  "items": [...],
  "forceUpdate": false
}
```

**Response:**
```json
{
  "success": true,
  "changed": 30,
  "unchanged": 5,
  "unknown": 2,
  "keptExisting": 15,
  "stats": {...},
  "results": [...]
}
```

### POST /api/record-correction
Records user correction to Memory Store.

**Request:**
```json
{
  "projectId": "uuid",
  "sheetId": "uuid",
  "itemId": "uuid",
  "newSkupina": "VYZTUŽ",
  "allItems": [...]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Correction recorded successfully",
  "memoryId": "uuid",
  "skupina": "VYZTUŽ",
  "learned": true
}
```

## Decision Flow

```
┌─────────────┐
│  New Item   │
└──────┬──────┘
       │
       ▼
┌─────────────┐  Cache HIT    ┌──────────────┐
│ Check Cache ├──────────────→│ Return (95%) │
└──────┬──────┘                └──────────────┘
       │ Cache MISS
       ▼
┌─────────────┐  Conf ≥80%    ┌──────────────┐
│ Try Rules   ├──────────────→│ Return (85%) │
└──────┬──────┘                └──────────────┘
       │ Conf <80%
       ▼
┌─────────────┐
│   Memory    │  Retrieved 3 similar examples
│   Search    │
└──────┬──────┘
       │
       ▼
┌─────────────┐  Success      ┌──────────────┐
│  Call AI    ├──────────────→│ Validate &   │
│  (Gemini)   │                │ Return (90%) │
└──────┬──────┘                └──────────────┘
       │ Failure
       ▼
┌─────────────┐
│  Fallback   │  Return rule match or "unknown"
│  to Rules   │
└─────────────┘
```

## Confidence Levels

| Level  | Score | Meaning |
|--------|-------|---------|
| high   | 80-100 | Strong match, high trust |
| medium | 50-79  | Moderate match, review recommended |
| low    | 0-49   | Weak match, manual review required |

## Sources

| Source | Priority | Description |
|--------|----------|-------------|
| cache  | 1 (highest) | Exact hash match from previous classification |
| rule   | 2 | Deterministic keyword matching |
| memory | 3 | Similar examples from user corrections |
| gemini | 4 | AI classification with context |

## Environment Variables

```env
# Required
GOOGLE_API_KEY=xxx          # or GEMINI_API_KEY
GEMINI_MODEL=gemini-2.0-flash-exp

# Optional
GEMINI_TIMEOUT_MS=30000
```

## Testing

```bash
# Test TypeScript compilation
cd api && npx tsc --noEmit agent/*.ts

# Test API endpoints locally
vercel dev

# Test classification
curl -X POST http://localhost:3000/api/classify-empty \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

## Migration Path

### Phase 1 (Current): In-Memory
- Memory Store: In-memory Map (stateless)
- Embeddings: Simple text similarity (Jaccard)
- Persistence: None (resets on cold start)

### Phase 2 (Planned): Persistent Storage
- Memory Store: Supabase PostgreSQL
- Embeddings: OpenAI `text-embedding-3-small`
- Vector search: pgvector
- Cross-project learning enabled

### Phase 3 (Future): Advanced Features
- Active learning (confidence-based sampling)
- Multi-language support (CS/SK/EN)
- Custom rules per project
- Batch export/import for memory

## Acceptance Criteria

✅ Classifies ONLY main items, subordinates as context
✅ "Klasifikovat prázdné" skips filled items
✅ "Překlasifikovat vše" keeps existing if confidence low
✅ User corrections stored and used for future classifications
✅ Deterministic results (same input → same output)
✅ Audit trail (source, confidence, reasoning logged)
✅ No breaking changes to existing UI

## Known Limitations

1. **Memory Resets**: In-memory storage resets on Vercel cold starts
   - Workaround: Export memory before deploy, import after
   - Solution: Migrate to Supabase (Phase 2)

2. **Simple Similarity**: Jaccard coefficient is basic
   - Limitation: May miss semantic similarity
   - Solution: Use embeddings (Phase 2)

3. **No Cross-Project Learning**: Memory is project-scoped
   - Limitation: Can't learn from other projects
   - Solution: Global memory pool (Phase 3)

4. **Gemini Rate Limits**: Free tier has limits
   - Workaround: Batch delay + concurrent limit
   - Solution: Use paid tier or add Redis queue

## Maintainers

- Claude Code Agent
- Last Updated: 2026-01-29
