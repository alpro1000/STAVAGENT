# FEATURE: TOV Profession Mapping for Monolit→Registry Import

## 📋 Summary
Automatic profession assignment during Monolit-Planner → Registry TOV import. Maps work types to professions with correct hourly rates and enables bi-directional sync tracking.

## 🎯 Problem
Manual profession assignment in Registry TOV was time-consuming when importing positions from Monolit-Planner. No tracking for bi-directional sync between systems.

## ✅ Solution

### 1. Automatic Profession Mapping
**File:** `services/tovProfessionMapper.js`

Maps Monolit subtypes to Registry professions:

| Monolit Subtype | Registry Profession | Hourly Rate |
|----------------|---------------------|-------------|
| Betonování | Betonář | 398 Kč/h |
| Bednění | Tesař / Bednář | 385 Kč/h |
| Výztuž | Železář / Armovač | 420 Kč/h |

**Functions:**
- `mapSubtypeToProfession(subtype)` - Case-insensitive keyword matching
- `getDefaultRate(profession)` - Returns hourly rate
- `createLaborResource(position)` - Creates labor resource with calculations
- `batchMapPositions(positions)` - Batch processing (filters unmapped)

### 2. Sync Metadata Tracking
**File:** `schema.sql`

Added `sync_metadata` column to `registry_items`:
```sql
ALTER TABLE registry_items ADD COLUMN sync_metadata TEXT;
```

Stores JSON for bi-directional sync:
```json
{
  "monolit_position_id": "uuid",
  "subtype": "Betonování"
}
```

### 3. Import Endpoint
**File:** `server.js`

New endpoint: `POST /api/registry/import/monolit`

**Request:**
```json
{
  "project_name": "Most přes Chrudimku",
  "user_id": 1,
  "positions": [
    {
      "id": "pos_123",
      "subtype": "Betonování",
      "item_name": "Základy ze železobetonu",
      "qty": 45.5,
      "unit": "m³",
      "crew_size": 4,
      "shift_hours": 10,
      "cost_czk": 8500
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "project_id": "reg_abc123",
  "mapped_count": 1
}
```

### 4. Default Owner ID
Integration imports use `owner_id=1` by default (configurable via `user_id` parameter).

## 📊 Impact

### Before:
- ❌ Manual profession assignment for each position
- ❌ No sync tracking between Monolit and Registry
- ❌ Inconsistent hourly rates

### After:
- ✅ Automatic profession mapping (3 work types)
- ✅ Sync metadata for bi-directional updates
- ✅ Consistent rates from LaborTab defaults
- ✅ Batch import with transaction safety

## 📁 Files Changed

### Added:
- `rozpocet-registry-backend/services/tovProfessionMapper.js` - Mapping service
- `rozpocet-registry-backend/test-mapper.js` - Unit tests
- `rozpocet-registry-backend/TOV_PROFESSION_MAPPING.md` - Documentation

### Modified:
- `rozpocet-registry-backend/server.js`
  - Import tovProfessionMapper
  - Add `/api/registry/import/monolit` endpoint
  - Update `/api/registry/sheets/:id/items` to accept sync_metadata
  - Comment clarification for default owner_id
  
- `rozpocet-registry-backend/schema.sql`
  - Add `sync_metadata TEXT` column to registry_items

## 🧪 Testing

### Unit Tests
```bash
cd rozpocet-registry-backend
node test-mapper.js
```

**Results:**
```
✅ mapSubtypeToProfession tests passed (5 assertions)
✅ getDefaultRate tests passed (4 assertions)
✅ createLaborResource tests passed (7 assertions)
✅ batchMapPositions tests passed (4 assertions)

✅ All tests passed! (20 assertions)
```

### Integration Test
```bash
curl -X POST "http://localhost:3002/api/registry/import/monolit" \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "Test Import",
    "positions": [
      {"subtype": "Betonování", "crew_size": 4, "shift_hours": 10, "qty": 45.5}
    ]
  }'
```

**Expected:**
- Project created with `owner_id=1`
- Sheet created: "Imported from Monolit"
- Item created with sync_metadata
- Labor TOV created: Betonář, 4 workers, 10h, 398 Kč/h

## 🚀 Deployment

### No Breaking Changes
- Existing endpoints unchanged
- New endpoint is additive
- Schema change is backward compatible (nullable column)

### Database Migration
```sql
-- Run on production database
ALTER TABLE registry_items ADD COLUMN IF NOT EXISTS sync_metadata TEXT;
```

### Restart Required
```bash
# Restart Registry backend
pm2 restart rozpocet-registry-backend
```

## 📝 Notes

### Mapping Logic
- Case-insensitive keyword matching
- Partial match (e.g., "BETONOVÁNÍ ZÁKLADŮ" → "Betonář")
- Returns `null` for unmapped subtypes (filtered in batch)

### Future Enhancements
- [ ] Add more professions (Jeřábník, Řidič, Stavbyvedoucí)
- [ ] Machine learning for custom mappings
- [ ] Write-back to Monolit (bi-directional sync)
- [ ] Audit log for mapping changes

### Hourly Rates
Rates match `LaborTab.tsx` defaults:
- Betonář: 398 Kč/h
- Železář / Armovač: 420 Kč/h
- Tesař / Bednář: 385 Kč/h
- Pomocný dělník: 280 Kč/h (fallback)

## ✅ Checklist

- [x] Code implemented and tested
- [x] Unit tests passing (20 assertions)
- [x] Documentation created
- [x] No breaking changes
- [x] Backward compatible
- [x] Transaction safety (BEGIN/COMMIT/ROLLBACK)

## 🔗 Related

- Feature request: Automatic TOV population from Monolit
- Related: Monolit-Registry integration architecture

## 👥 Reviewers

@alpro1000

---

**Type:** Feature  
**Priority:** Medium (Quality of life improvement)  
**Impact:** Integration between Monolit-Planner and Registry TOV  
**Breaking Changes:** None
