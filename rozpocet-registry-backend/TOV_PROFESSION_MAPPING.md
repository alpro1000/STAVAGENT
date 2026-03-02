# TOV Profession Mapping

Automatic profession assignment during Monolit-Planner → Registry TOV import.

## Features

### 1. Automatic Profession Mapping
Maps Monolit work types (subtype) to Registry TOV professions:

| Monolit Subtype | Registry Profession | Hourly Rate |
|----------------|---------------------|-------------|
| Betonování | Betonář | 398 Kč/h |
| Bednění | Tesař / Bednář | 385 Kč/h |
| Výztuž | Železář / Armovač | 420 Kč/h |

### 2. Sync Metadata Tracking
`registry_items.sync_metadata` stores:
```json
{
  "monolit_position_id": "uuid",
  "subtype": "Betonování"
}
```

### 3. Default Owner ID
Integration imports use `owner_id=1` by default.

## API

### Import Monolit Positions
```bash
POST /api/registry/import/monolit
Content-Type: application/json

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

## Mapping Logic

### Service: `tovProfessionMapper.js`

**Functions:**
- `mapSubtypeToProfession(subtype)` - Maps subtype to profession
- `getDefaultRate(profession)` - Returns hourly rate
- `createLaborResource(position)` - Creates labor resource object
- `batchMapPositions(positions)` - Batch mapping

**Example:**
```javascript
import { createLaborResource } from './services/tovProfessionMapper.js';

const position = {
  subtype: 'Betonování',
  crew_size: 4,
  shift_hours: 10
};

const labor = createLaborResource(position);
// {
//   profession: 'Betonář',
//   count: 4,
//   hours: 10,
//   normHours: 40,
//   hourlyRate: 398,
//   totalCost: 15920
// }
```

## Database Schema

### registry_items
```sql
ALTER TABLE registry_items ADD COLUMN sync_metadata TEXT;
```

Stores JSON with:
- `monolit_position_id` - Original Monolit position UUID
- `subtype` - Work type for re-mapping

## Testing

```bash
cd rozpocet-registry-backend
node test-mapper.js
```

**Tests:**
- ✅ Profession mapping (case-insensitive)
- ✅ Default rates
- ✅ Labor resource creation
- ✅ Batch mapping (filters unmapped)

## Integration Flow

1. **Monolit → Registry Import**
   - User exports positions from Monolit-Planner
   - POST `/api/registry/import/monolit`
   - Backend maps subtypes to professions
   - Creates project + sheet + items + TOV data

2. **Bi-directional Sync**
   - `sync_metadata` tracks original position
   - Future: Registry changes → Monolit write-back

3. **Manual Override**
   - User can edit profession in Registry UI
   - Changes stored in `registry_tov.tov_data`

## Files

- `services/tovProfessionMapper.js` - Mapping service
- `server.js` - Import endpoint
- `schema.sql` - Database schema
- `test-mapper.js` - Unit tests
- `docs/TOV_PROFESSION_MAPPING.md` - This file

## Future Enhancements

- [ ] Add more profession mappings (Jeřábník, Řidič)
- [ ] Machine learning for custom mappings
- [ ] Sync back to Monolit (write-back)
- [ ] Audit log for mapping changes
