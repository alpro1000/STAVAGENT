# Week 7-9: Relink Algorithm Implementation

**Created:** 2025-01-XX  
**Status:** 🚀 IN PROGRESS  
**Branch:** `feature/relink-algorithm`  
**Estimated Time:** 24-32 hours

---

## 📋 Goal

Preserve calculations when Excel file is updated. When user uploads new version of rozpočet.xlsx, automatically match old positions to new positions and transfer calculations.

---

## 🎯 Success Criteria

1. ✅ Upload new file version → creates new file_version record
2. ✅ Relink algorithm matches 90%+ positions automatically
3. ✅ User reviews matches with confidence indicators (🟢 GREEN, 🟡 AMBER, 🔴 RED)
4. ✅ Calculations preserved for matched positions
5. ✅ New/orphaned positions clearly identified

---

## 📊 Relink Algorithm (4 Steps)

### Step 1: Primary Match (Exact)
**Confidence:** 🟢 GREEN (100%)

```javascript
Match if ALL match:
- sheet_name === sheet_name
- position_no === position_no  
- catalog_code === catalog_code
```

**Expected:** 80-90% of positions

### Step 2: Fallback Match (Positional)
**Confidence:** 🟡 AMBER (75%)

```javascript
Match if ALL match:
- sheet_index === sheet_index
- row_index === row_index (±2 tolerance)
- catalog_code === catalog_code
```

**Expected:** 5-10% of positions

### Step 3: Fuzzy Match (Description Similarity)
**Confidence:** 🟡 AMBER (50-75%)

```javascript
Match if:
- catalog_code === catalog_code
- description_similarity > 0.75 (trigram/Levenshtein)
- qty_diff < 20%
```

**Expected:** 2-5% of positions

### Step 4: Classify Remainder
**Confidence:** 🔴 RED (0%)

```javascript
Unmatched old positions → ORPHANED (removed from new file)
Unmatched new positions → NEW (added in new file)
```

**Expected:** 5-10% of positions

---

## 🗓️ Week-by-Week Plan

### Week 7: File Version System (8-10 hours)

#### Day 1-2: Database Schema (3-4 hours)
- [x] Review existing `registry_file_versions` table
- [ ] Add `previous_version_id` column
- [ ] Add `relink_status` enum (pending, in_progress, completed, failed)
- [ ] Add indexes for version queries

**Migration:**
```sql
ALTER TABLE registry_file_versions 
  ADD COLUMN previous_version_id UUID REFERENCES registry_file_versions(file_version_id),
  ADD COLUMN relink_status VARCHAR(20) DEFAULT 'pending';

CREATE INDEX idx_file_versions_previous ON registry_file_versions(previous_version_id);
```

#### Day 3: Upload New Version API (3-4 hours)
- [ ] Modify `POST /api/registry/projects/:id/upload-file`
- [ ] Add `is_update` flag
- [ ] Add `previous_version_id` parameter
- [ ] Return `relink_required: true` if update

**Request:**
```javascript
POST /api/registry/projects/123/upload-file
Body: {
  file: File,
  is_update: true,
  previous_version_id: "uuid-of-old-version"
}

Response: {
  file_version_id: "new-uuid",
  version_no: 2,
  relink_required: true,
  previous_version_id: "uuid-of-old-version"
}
```

#### Day 4: Version History UI (2-3 hours)
- [ ] Add "Upload New Version" button in Monolit UI
- [ ] Show version history list
- [ ] Display version comparison stats

---

### Week 8: Relink Algorithm Core (10-12 hours)

#### Day 1-2: Step 1 - Primary Match (3-4 hours)
**File:** `Monolit-Planner/backend/src/services/relinkService.js`

```javascript
async function primaryMatch(oldPositions, newPositions) {
  const matches = [];
  const unmatchedOld = [];
  const unmatchedNew = [...newPositions];

  for (const oldPos of oldPositions) {
    const match = unmatchedNew.find(newPos =>
      newPos.sheet_name === oldPos.sheet_name &&
      newPos.position_no === oldPos.position_no &&
      newPos.catalog_code === oldPos.catalog_code
    );

    if (match) {
      matches.push({
        old_position_id: oldPos.position_instance_id,
        new_position_id: match.position_instance_id,
        confidence: 'GREEN',
        match_type: 'primary',
        qty_change: calculateQtyChange(oldPos.qty, match.qty)
      });
      unmatchedNew.splice(unmatchedNew.indexOf(match), 1);
    } else {
      unmatchedOld.push(oldPos);
    }
  }

  return { matches, unmatchedOld, unmatchedNew };
}
```

#### Day 3: Step 2 - Fallback Match (2-3 hours)
```javascript
async function fallbackMatch(unmatchedOld, unmatchedNew) {
  const matches = [];
  const stillUnmatchedOld = [];
  const stillUnmatchedNew = [...unmatchedNew];

  for (const oldPos of unmatchedOld) {
    const match = stillUnmatchedNew.find(newPos =>
      newPos.sheet_index === oldPos.sheet_index &&
      Math.abs(newPos.row_index - oldPos.row_index) <= 2 &&
      newPos.catalog_code === oldPos.catalog_code
    );

    if (match) {
      matches.push({
        old_position_id: oldPos.position_instance_id,
        new_position_id: match.position_instance_id,
        confidence: 'AMBER',
        match_type: 'fallback',
        row_shift: match.row_index - oldPos.row_index
      });
      stillUnmatchedNew.splice(stillUnmatchedNew.indexOf(match), 1);
    } else {
      stillUnmatchedOld.push(oldPos);
    }
  }

  return { matches, unmatchedOld: stillUnmatchedOld, unmatchedNew: stillUnmatchedNew };
}
```

#### Day 4: Step 3 - Fuzzy Match (3-4 hours)
```javascript
const stringSimilarity = require('string-similarity');

async function fuzzyMatch(unmatchedOld, unmatchedNew) {
  const matches = [];
  const orphaned = [];
  const newPositions = [...unmatchedNew];

  for (const oldPos of unmatchedOld) {
    // Find candidates with same catalog_code
    const candidates = newPositions.filter(
      newPos => newPos.catalog_code === oldPos.catalog_code
    );

    if (candidates.length === 0) {
      orphaned.push(oldPos);
      continue;
    }

    // Calculate similarity scores
    const scores = candidates.map(candidate => ({
      position: candidate,
      similarity: stringSimilarity.compareTwoStrings(
        oldPos.description_normalized,
        candidate.description_normalized
      ),
      qty_diff: Math.abs(candidate.qty - oldPos.qty) / oldPos.qty
    }));

    // Find best match
    const best = scores.reduce((a, b) => a.similarity > b.similarity ? a : b);

    if (best.similarity > 0.75 && best.qty_diff < 0.2) {
      matches.push({
        old_position_id: oldPos.position_instance_id,
        new_position_id: best.position.position_instance_id,
        confidence: best.similarity > 0.9 ? 'AMBER' : 'RED',
        match_type: 'fuzzy',
        similarity_score: best.similarity,
        qty_change: calculateQtyChange(oldPos.qty, best.position.qty)
      });
      newPositions.splice(newPositions.indexOf(best.position), 1);
    } else {
      orphaned.push(oldPos);
    }
  }

  return { matches, orphaned, newPositions };
}
```

#### Day 5: Step 4 - Classify & Report (2-3 hours)
```javascript
async function generateRelinkReport(oldVersionId, newVersionId) {
  // Get all positions
  const oldPositions = await getPositionsByVersion(oldVersionId);
  const newPositions = await getPositionsByVersion(newVersionId);

  // Step 1: Primary match
  let result = await primaryMatch(oldPositions, newPositions);
  const allMatches = [...result.matches];

  // Step 2: Fallback match
  result = await fallbackMatch(result.unmatchedOld, result.unmatchedNew);
  allMatches.push(...result.matches);

  // Step 3: Fuzzy match
  result = await fuzzyMatch(result.unmatchedOld, result.unmatchedNew);
  allMatches.push(...result.matches);

  // Step 4: Classify remainder
  const orphaned = result.orphaned;
  const newItems = result.newPositions;

  // Generate summary
  const summary = {
    total_old: oldPositions.length,
    total_new: newPositions.length,
    matched_exact: allMatches.filter(m => m.match_type === 'primary').length,
    matched_fallback: allMatches.filter(m => m.match_type === 'fallback').length,
    matched_fuzzy: allMatches.filter(m => m.match_type === 'fuzzy').length,
    orphaned: orphaned.length,
    new_positions: newItems.length,
    confidence_green: allMatches.filter(m => m.confidence === 'GREEN').length,
    confidence_amber: allMatches.filter(m => m.confidence === 'AMBER').length,
    confidence_red: allMatches.filter(m => m.confidence === 'RED').length
  };

  // Save report
  const report = await db.query(`
    INSERT INTO registry_relink_reports 
      (old_file_version, new_file_version, summary, details)
    VALUES ($1, $2, $3, $4)
    RETURNING report_id
  `, [oldVersionId, newVersionId, summary, { matches: allMatches, orphaned, newItems }]);

  return { report_id: report.rows[0].report_id, summary, details: { matches: allMatches, orphaned, newItems } };
}
```

---

### Week 9: UI & Conflict Resolution (6-10 hours)

#### Day 1-2: Relink Report Modal (4-5 hours)
**File:** `Monolit-Planner/frontend/src/components/RelinkReportModal.tsx`

```tsx
interface RelinkReportModalProps {
  reportId: string;
  onApprove: () => void;
  onReject: () => void;
}

export function RelinkReportModal({ reportId, onApprove, onReject }: RelinkReportModalProps) {
  const { data: report } = useQuery(['relink-report', reportId], () =>
    fetch(`/api/registry/relink-reports/${reportId}`).then(r => r.json())
  );

  return (
    <div className="modal">
      <h2>Relink Report</h2>
      
      {/* Summary */}
      <div className="summary">
        <div>Total old: {report.summary.total_old}</div>
        <div>Total new: {report.summary.total_new}</div>
        <div>🟢 Exact: {report.summary.matched_exact}</div>
        <div>🟡 Fallback: {report.summary.matched_fallback}</div>
        <div>🟡 Fuzzy: {report.summary.matched_fuzzy}</div>
        <div>🔴 Orphaned: {report.summary.orphaned}</div>
        <div>🆕 New: {report.summary.new_positions}</div>
      </div>

      {/* Matches table */}
      <table>
        <thead>
          <tr>
            <th>Old Position</th>
            <th>New Position</th>
            <th>Confidence</th>
            <th>Match Type</th>
            <th>Qty Change</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {report.details.matches.map(match => (
            <tr key={match.old_position_id} className={`confidence-${match.confidence.toLowerCase()}`}>
              <td>{match.old_description}</td>
              <td>{match.new_description}</td>
              <td>{match.confidence === 'GREEN' ? '🟢' : match.confidence === 'AMBER' ? '🟡' : '🔴'}</td>
              <td>{match.match_type}</td>
              <td>{match.qty_change > 0 ? `+${match.qty_change}%` : `${match.qty_change}%`}</td>
              <td>
                {match.confidence === 'RED' && (
                  <button onClick={() => manualRelink(match)}>Manual Review</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Actions */}
      <div className="actions">
        <button onClick={onApprove}>Approve & Apply</button>
        <button onClick={onReject}>Reject</button>
      </div>
    </div>
  );
}
```

#### Day 3: Apply Relink (2-3 hours)
**Endpoint:** `POST /api/registry/relink-reports/:id/apply`

```javascript
async function applyRelink(reportId) {
  const report = await getRelinkReport(reportId);
  
  // Start transaction
  await db.query('BEGIN');
  
  try {
    // For each match, copy payload from old to new
    for (const match of report.details.matches) {
      const oldPos = await getPosition(match.old_position_id);
      const newPos = await getPosition(match.new_position_id);
      
      // Copy monolith_payload
      if (oldPos.monolith_payload) {
        await db.query(`
          UPDATE registry_position_instances
          SET monolith_payload = $1,
              updated_at = NOW()
          WHERE position_instance_id = $2
        `, [oldPos.monolith_payload, newPos.position_instance_id]);
      }
      
      // Flag if qty changed significantly
      if (Math.abs(match.qty_change) > 20) {
        await db.query(`
          UPDATE registry_position_instances
          SET status = 'needs_review'
          WHERE position_instance_id = $1
        `, [newPos.position_instance_id]);
      }
    }
    
    // Mark old positions as archived
    await db.query(`
      UPDATE registry_position_instances
      SET status = 'archived'
      WHERE file_version_id = $1
    `, [report.old_file_version]);
    
    // Update relink status
    await db.query(`
      UPDATE registry_file_versions
      SET relink_status = 'completed'
      WHERE file_version_id = $1
    `, [report.new_file_version]);
    
    await db.query('COMMIT');
    
    return { success: true, applied: report.details.matches.length };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
```

#### Day 4: Manual Relink (2-3 hours)
**Endpoint:** `POST /api/registry/relink-reports/:id/manual-match`

```javascript
async function manualMatch(reportId, oldPositionId, newPositionId) {
  // Validate positions exist
  const oldPos = await getPosition(oldPositionId);
  const newPos = await getPosition(newPositionId);
  
  // Copy payload
  await db.query(`
    UPDATE registry_position_instances
    SET monolith_payload = $1,
        updated_at = NOW()
    WHERE position_instance_id = $2
  `, [oldPos.monolith_payload, newPos.position_instance_id]);
  
  // Update report
  await db.query(`
    UPDATE registry_relink_reports
    SET details = jsonb_set(
      details,
      '{manual_matches}',
      COALESCE(details->'manual_matches', '[]'::jsonb) || $1::jsonb
    )
    WHERE report_id = $2
  `, [JSON.stringify({ old_position_id: oldPositionId, new_position_id: newPositionId }), reportId]);
  
  return { success: true };
}
```

---

## 📁 Files to Create/Modify

### New Files:
1. `Monolit-Planner/backend/src/services/relinkService.js` - Core algorithm
2. `Monolit-Planner/backend/src/routes/relink.js` - API endpoints
3. `Monolit-Planner/frontend/src/components/RelinkReportModal.tsx` - UI
4. `Monolit-Planner/frontend/src/components/VersionHistory.tsx` - Version list

### Modified Files:
1. `Monolit-Planner/backend/migrations/011_add_relink_columns.sql` - DB changes
2. `Monolit-Planner/backend/src/routes/registry.js` - Update upload endpoint
3. `Monolit-Planner/frontend/src/pages/BridgeDetail.tsx` - Add version UI

---

## 🧪 Testing Strategy

### Unit Tests:
```javascript
describe('Relink Algorithm', () => {
  test('Primary match - exact match', () => {
    const old = [{ sheet_name: 'SO201', position_no: '1', catalog_code: '272324' }];
    const new = [{ sheet_name: 'SO201', position_no: '1', catalog_code: '272324' }];
    const result = primaryMatch(old, new);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].confidence).toBe('GREEN');
  });

  test('Fallback match - row shift', () => {
    const old = [{ sheet_index: 0, row_index: 10, catalog_code: '272324' }];
    const new = [{ sheet_index: 0, row_index: 12, catalog_code: '272324' }];
    const result = fallbackMatch(old, new);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].confidence).toBe('AMBER');
  });

  test('Fuzzy match - description similarity', () => {
    const old = [{ catalog_code: '272324', description_normalized: 'zaklady ze zelezobetonu' }];
    const new = [{ catalog_code: '272324', description_normalized: 'zaklady z zelezobetonu' }];
    const result = fuzzyMatch(old, new);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].similarity_score).toBeGreaterThan(0.9);
  });
});
```

### Integration Tests:
```javascript
describe('Relink API', () => {
  test('POST /api/registry/relink-reports/:id/apply', async () => {
    const response = await request(app)
      .post('/api/registry/relink-reports/test-report-id/apply')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.applied).toBeGreaterThan(0);
  });
});
```

---

## ✅ Deliverables

### Week 7:
- [ ] Database migration (relink columns)
- [ ] Upload new version API
- [ ] Version history UI

### Week 8:
- [ ] Relink algorithm (4 steps)
- [ ] Generate relink report API
- [ ] Unit tests (10+ tests)

### Week 9:
- [ ] Relink report modal UI
- [ ] Apply relink API
- [ ] Manual relink API
- [ ] Integration tests (5+ tests)

---

## 📊 Success Metrics

- [ ] 90%+ positions matched automatically
- [ ] <10s relink time for 500 positions
- [ ] User can review and approve in <5 minutes
- [ ] Zero data loss during relink

---

## 🚀 Next Steps

1. **Start Week 7:** Database migration + Upload API
2. **Dependencies:** `string-similarity` npm package
3. **Testing:** Create sample Excel files with variations

---

**Status:** 🚀 IN PROGRESS  
**Current:** Week 7 - File Version System  
**Next:** Database migration
