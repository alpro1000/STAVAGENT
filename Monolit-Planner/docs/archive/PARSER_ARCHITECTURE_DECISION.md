# 🏗️ Parser Architecture Decision: Local vs. Concrete-Agent Integration

**Date:** November 20, 2025
**Status:** 🤔 ARCHITECTURAL DECISION NEEDED
**Current Issue:** File uploads parse successfully but results don't display to user

---

## 📋 Current Problem

### What's Happening Now
```
✅ File uploaded
✅ Parser extracts bridges (7 found: SO 201-205, SO 221, SO 241)
✅ Parser extracts header metadata
❌ NO: Positions created
❌ NO: Results shown to user
❌ NO: KROS calculations
❌ NO: Materials extracted
```

### Logs Show
```
[INFO] Parsed 55 rows from Rekapitulace stavby
[INFO] Found bridge: SO 201 at row 41
[INFO] Found bridge: SO 202 at row 43
...
[INFO] Bridge already exists: SO 201
[INFO] Bridge already exists: SO 202
...
[INFO] Cleaned up uploaded file
```

**Gap:** After finding bridges → nothing happens. No positions created. No UI update.

---

## 🎯 Two Architecture Options

### Option 1: Keep Local Parser (Current Approach)
**Pros:**
- ✅ Fast (no external API calls)
- ✅ No dependency on external service
- ✅ Complete control over parsing logic
- ✅ Works offline
- ✅ Cheap (no external compute)

**Cons:**
- ❌ Limited extraction (only basic data)
- ❌ No AI enrichment
- ❌ Manual maintenance of parsing rules
- ❌ Brittle (breaks with format changes)
- ❌ Can't handle complex documents (PDF, images)
- ❌ No material/concrete type detection
- ❌ No assembly norm suggestions

**What It Can Do:**
- Extract bridge IDs from Excel
- Parse column headers
- Detect row structure
- Basic quantity extraction

**What It Cannot Do:**
- Extract material types (C25/30 vs C30/37)
- Suggest assembly norms
- Calculate concrete volume
- Handle PDF/image documents
- Recognize non-standard formats
- Cross-reference material databases

---

### Option 2: Use Concrete-Agent (External Service)
**Pros:**
- ✅ Powerful AI parsing (can handle any format)
- ✅ Material recognition
- ✅ Assembly norm suggestions
- ✅ Handles PDF, images, scanned documents
- ✅ AI enrichment built-in
- ✅ Maintains parsing logic (not our problem)
- ✅ Can cross-reference knowledge base

**Cons:**
- ❌ External dependency
- ❌ API call latency
- ❌ Potential downtime
- ❌ Cost (if not free-tier)
- ❌ Data privacy (sending files to external service)
- ❌ Need to wait for API response

**What It Can Do:**
- Everything Option 1 does
- Plus material type detection
- Plus assembly norm recommendations
- Plus AI-powered field extraction
- Plus PDF/image parsing
- Plus format variations handling

---

## 🔄 The Hybrid Approach (RECOMMENDED)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ User uploads XLSX file                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Local Parser (FAST - < 1 second)                         │
│                                                           │
│ ✅ Extract:                                             │
│   - Bridge IDs (SO 201, SO 202, ...)                    │
│   - Part descriptions (ZÁKLADY, OPĚRY, ...)            │
│   - Quantities (tons, m3, pcs)                          │
│   - Row structure                                        │
│                                                           │
│ ✅ Store as: temporary "Raw Import"                    │
│ ✅ Show to user: "Parsed 55 rows, found 7 bridges"     │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌────────────┐          ┌──────────────────┐
    │ Simple     │          │ Complex Format?  │
    │ Format?    │          │ Need AI?         │
    │            │          │                  │
    │ YES → Use  │          │ YES → Use        │
    │ Local      │          │ Concrete-Agent   │
    │ Rules      │          │ API              │
    └────┬───────┘          └────────┬─────────┘
         │                           │
         ▼                           ▼
    ┌───────────────┐        ┌──────────────────┐
    │ Apply Local   │        │ Call Concrete-   │
    │ Rules:        │        │ Agent API        │
    │               │        │                  │
    │ • Detect      │        │ • Material types │
    │   materials   │        │ • Assembly norms │
    │ • Guess norms │        │ • AI enrichment  │
    │ • Calc volume │        │ • Format fix     │
    │               │        │                  │
    └───────┬───────┘        └────────┬─────────┘
            │                         │
            └──────────┬──────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │ Create Positions     │
            │ in Database          │
            │                      │
            │ - part_name          │
            │ - qty                │
            │ - otskp_code         │
            │ - assembly_norm      │
            │ - concrete_class     │
            │                      │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │ Show Results to User │
            │                      │
            │ ✅ Table with 55 rows│
            │ ✅ Highlighted parts │
            │ ✅ KROS calculated   │
            │ ✅ Warnings/RFI      │
            └──────────────────────┘
```

### Decision Tree

```
IF file format is standard Excel:
  IF data structure is familiar:
    USE local parser + simple rules
  ELSE:
    SEND to Concrete-Agent for analysis
ELSE:
  SEND to Concrete-Agent (handles PDF, scanned, etc.)
```

---

## 🔧 Current Implementation Gap

### What's Missing Now
1. **No position creation from parsed data**
   - Parser extracts bridges → but doesn't create positions
   - Need: `createPositionsFromParsedData()` function

2. **No results display to user**
   - File uploaded → processed silently
   - User doesn't see what was parsed
   - Need: UI component showing parsed results

3. **No decision logic**
   - Every file uses same parser
   - Should decide: local rules or Concrete-Agent?
   - Need: `selectOptimalParser()` function

---

## 📊 Comparison Table

| Feature | Local Parser | Concrete-Agent | Hybrid |
|---------|--------------|-----------------|--------|
| **Speed** | <1s | 2-5s | 1-5s (adaptive) |
| **Accuracy** | ~70% | ~95% | ~95% |
| **Format Handling** | Limited | Excellent | Excellent |
| **AI Enrichment** | No | Yes | Yes (when needed) |
| **Offline** | Yes | No | Partial |
| **Cost** | Free | Depends | Depends |
| **Implementation** | Simple | Complex | Medium |
| **Maintenance** | High | Low | Medium |
| **User Experience** | Basic | Advanced | Adaptive |

---

## 🎯 Recommendation: Hybrid Approach

### Phase 1: Fix Current Parser (Immediate)
1. **Create positions from parsed data**
   ```javascript
   // pseudo-code
   const parsed = await localParser.parse(file);
   const positions = parsed.rows.map(row => ({
     bridge_id: row.bridge_id,
     part_name: row.part_name,
     qty: row.qty,
     otskp_code: findOTSKPCode(row.name),
     assembly_norm_ph_m2: guessAssemblyNorm(row.part_name)
   }));
   await db.insertPositions(positions);
   ```

2. **Display results to user**
   ```javascript
   // Return import result
   {
     import_id: 'UUID',
     bridges: ['SO 201', 'SO 202'],
     rows_parsed: 55,
     positions_created: 52,
     warnings: ['Row 15: unclear part name'],
     data: positions  // show in UI
   }
   ```

### Phase 2: Add Decision Logic (Week 1)
```javascript
async function selectOptimalParser(file) {
  const format = detectFormat(file);  // XLSX, PDF, CSV, etc.

  if (format === 'XLSX' && isStandardFormat(file)) {
    return 'LOCAL_PARSER';  // Fast path
  } else {
    return 'CONCRETE_AGENT';  // Powerful path
  }
}
```

### Phase 3: Concrete-Agent Integration (Week 2-3)
- Set up API client
- Add async job handling
- Show progress to user
- Fallback to local parser if API down

---

## 🚀 Why Hybrid is Best

**Scenario 1: Standard Excel Format**
```
User uploads standard project file
↓
Local parser: <1s, extracts data
↓
Shows immediate results
↓
(Done! No API call needed)
```

**Scenario 2: Complex/Non-Standard Format**
```
User uploads scanned PDF or unusual Excel
↓
Local parser: tries, gets partial results
↓
Detects format issue
↓
Calls Concrete-Agent: 3-5s
↓
AI enriches and corrects data
↓
Shows complete results
```

**Scenario 3: Offline/Fallback**
```
Concrete-Agent API is down
↓
Local parser activates
↓
Shows basic results
↓
User can manually correct/refine
```

---

## 📋 Implementation Checklist

### For Today (Fix Current Gap)
- [ ] Extract positions from parsed bridges
- [ ] Create DB records from parsed data
- [ ] Return results to frontend
- [ ] Display parsed data in UI
- [ ] Show warnings/errors to user

### For This Week (Add Logic)
- [ ] Implement parser selection logic
- [ ] Add format detection
- [ ] Create fallback mechanism
- [ ] Test with various file formats

### For Next Week (Integration)
- [ ] Connect to Concrete-Agent API
- [ ] Add async job processing
- [ ] Implement progress tracking
- [ ] Handle API failures gracefully

---

## 🎓 Current Log Analysis

Your logs show:
```
[INFO] Parsed 55 rows from Rekapitulace stavby
[INFO] Found bridge: SO 201 at row 41
...
[INFO] Bridge already exists: SO 201
```

**Issues:**
1. ✅ Parser works (finds 55 rows, 7 bridges)
2. ❌ But only checks if bridge exists, doesn't create positions
3. ❌ Doesn't extract individual line items (positions)
4. ❌ Doesn't return results to UI

**Fix:**
```javascript
// CURRENT (incomplete)
for (const bridge of parsed.bridges) {
  if (bridgeAlreadyExists(bridge.id)) {
    continue;  // ← PROBLEM: Nothing else happens!
  }
  // Creates bridge but not positions
}

// NEEDED (complete)
for (const row of parsed.rows) {
  const position = {
    bridge_id: row.bridge_id,
    part_name: row.part_name,
    qty: row.qty,
    // ... other fields
  };
  await db.insertPosition(position);
}
```

---

## ✅ Recommended Decision

**Use: Hybrid Approach**

1. **Default:** Local parser (fast, reliable for standard formats)
2. **When needed:** Concrete-Agent (complex formats, AI enrichment)
3. **Fallback:** Local parser if API fails
4. **User control:** "Use AI" checkbox for manual override

This gives you:
- ✅ Speed (most files <1s)
- ✅ Quality (AI when needed)
- ✅ Reliability (fallback available)
- ✅ Flexibility (user can choose)

---

## 🎯 Next Action Items

1. **Today:**
   - Fix upload endpoint to create positions from parsed data
   - Display parsed results to user
   - Test with your Excel files

2. **This Week:**
   - Add parser selection logic
   - Implement format detection
   - Add "Use AI" option to UI

3. **Next Week:**
   - Integrate with Concrete-Agent API
   - Add progress tracking
   - Handle errors gracefully

Would you like me to implement the position creation logic first?

---

**Architecture Decision:** 🟢 **HYBRID APPROACH RECOMMENDED**
