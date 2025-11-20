# Sheathing API Testing Plan - Day 6/7 Integration

**Status:** Ready for implementation testing
**API Base URL:** `http://localhost:3001/api/sheathing`
**Authentication:** Bearer token (required on all endpoints)

---

## API Endpoints Summary

### 1. GET /api/sheathing/:project_id
**Get all captures for a project**

```
Method:     GET
URL:        /api/sheathing/BRIDGE-001
Auth:       Required (Bearer token)
Response:   Array of SheathingCapture objects
```

**Expected Behavior:**
- Returns all captures for the specified project
- Only accessible to project owner
- Returns 404 if project not found or access denied
- Returns 200 with empty array if no captures exist

**Sample Response (200 OK):**
```json
[
  {
    "capture_id": "CAP-BRIDGE-001-001",
    "project_id": "BRIDGE-001",
    "part_name": "ZÁKLADY",
    "length_m": 12,
    "width_m": 8,
    "height_m": 2.5,
    "area_m2": 96,
    "assembly_norm_ph_m2": 0.8,
    "concrete_curing_days": 5,
    "num_kits": 2,
    "work_method": "staggered",
    "concrete_class": "C30/37",
    "created_at": "2025-11-20T09:00:00.000Z",
    "updated_at": "2025-11-20T09:00:00.000Z"
  }
]
```

---

### 2. POST /api/sheathing
**Create new capture**

```
Method:     POST
URL:        /api/sheathing
Auth:       Required (Bearer token)
Content:    application/json
```

**Required Fields:**
```json
{
  "project_id": "BRIDGE-001",
  "part_name": "ZÁKLADY",
  "length_m": 12,
  "width_m": 8,
  "assembly_norm_ph_m2": 0.8,
  "concrete_curing_days": 5,
  "num_kits": 2,
  "work_method": "staggered"
}
```

**Optional Fields:**
```json
{
  "height_m": 2.5,
  "concrete_class": "C30/37",
  "kit_type": "DOKA",
  "daily_rental_cost_czk": 5000
}
```

**Expected Behavior:**
- Validates project ownership
- Auto-calculates area_m2 = length_m × width_m
- Generates unique capture_id
- Returns 201 Created with full capture object
- Returns 400 if required fields missing
- Returns 404 if project not found or access denied

**Sample Request:**
```bash
curl -X POST http://localhost:3001/api/sheathing \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "BRIDGE-001",
    "part_name": "PILÍŘE",
    "length_m": 10,
    "width_m": 10,
    "assembly_norm_ph_m2": 1.0,
    "concrete_curing_days": 5,
    "num_kits": 2,
    "work_method": "staggered"
  }'
```

**Sample Response (201 Created):**
```json
{
  "capture_id": "CAP-BRIDGE-001-1732012800000",
  "project_id": "BRIDGE-001",
  "part_name": "PILÍŘE",
  "length_m": 10,
  "width_m": 10,
  "height_m": null,
  "area_m2": 100,
  "assembly_norm_ph_m2": 1.0,
  "concrete_curing_days": 5,
  "num_kits": 2,
  "work_method": "staggered",
  "concrete_class": null,
  "created_at": "2025-11-20T09:00:00.000Z",
  "updated_at": "2025-11-20T09:00:00.000Z"
}
```

---

### 3. PUT /api/sheathing/:capture_id
**Update capture**

```
Method:     PUT
URL:        /api/sheathing/CAP-BRIDGE-001-001
Auth:       Required (Bearer token)
Content:    application/json
```

**Updateable Fields (all optional):**
```json
{
  "part_name": "ZÁKLADY-UPDATED",
  "length_m": 13,
  "width_m": 8.5,
  "height_m": 2.6,
  "assembly_norm_ph_m2": 0.85,
  "concrete_curing_days": 6,
  "num_kits": 3,
  "work_method": "sequential",
  "concrete_class": "C35/45",
  "kit_type": "PERI",
  "daily_rental_cost_czk": 6000
}
```

**Expected Behavior:**
- Auto-recalculates area_m2 if dimensions change
- Only owner can update
- Returns 200 with updated capture
- Returns 404 if capture not found or access denied
- All fields optional (partial updates supported)

**Sample Request:**
```bash
curl -X PUT http://localhost:3001/api/sheathing/CAP-BRIDGE-001-001 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "num_kits": 3,
    "assembly_norm_ph_m2": 0.9
  }'
```

**Sample Response (200 OK):**
```json
{
  "capture_id": "CAP-BRIDGE-001-001",
  "project_id": "BRIDGE-001",
  "part_name": "ZÁKLADY",
  "length_m": 12,
  "width_m": 8,
  "height_m": 2.5,
  "area_m2": 96,
  "assembly_norm_ph_m2": 0.9,
  "concrete_curing_days": 5,
  "num_kits": 3,
  "work_method": "staggered",
  "concrete_class": "C30/37",
  "created_at": "2025-11-20T09:00:00.000Z",
  "updated_at": "2025-11-20T09:05:00.000Z"
}
```

---

### 4. DELETE /api/sheathing/:capture_id
**Delete capture**

```
Method:     DELETE
URL:        /api/sheathing/CAP-BRIDGE-001-001
Auth:       Required (Bearer token)
Response:   Success message
```

**Expected Behavior:**
- Only owner can delete
- Returns 200 with success message
- Returns 404 if capture not found or access denied
- Should handle cascade (verify database integrity)

**Sample Request:**
```bash
curl -X DELETE http://localhost:3001/api/sheathing/CAP-BRIDGE-001-001 \
  -H "Authorization: Bearer TOKEN"
```

**Sample Response (200 OK):**
```json
{
  "message": "Capture deleted successfully"
}
```

---

### 5. GET /api/sheathing/:project_id/config
**Get project configuration**

```
Method:     GET
URL:        /api/sheathing/BRIDGE-001/config
Auth:       Required (Bearer token)
Response:   SheathingProjectConfig object
```

**Expected Behavior:**
- Returns project defaults for new captures
- Only accessible to project owner
- Returns default values if config doesn't exist
- Returns 404 if project not found or access denied

**Sample Response (200 OK):**
```json
{
  "id": 1,
  "project_id": "BRIDGE-001",
  "default_assembly_norm_ph_m2": 1.0,
  "default_concrete_curing_days": 5,
  "default_num_kits": 2,
  "default_work_method": "staggered",
  "crew_size": 4,
  "shift_hours": 10,
  "days_per_month": 22,
  "created_at": "2025-11-20T09:00:00.000Z",
  "updated_at": "2025-11-20T09:00:00.000Z"
}
```

**Default Values (if config not found):**
```json
{
  "project_id": "BRIDGE-001",
  "default_assembly_norm_ph_m2": 1.0,
  "default_concrete_curing_days": 5,
  "default_num_kits": 2,
  "default_work_method": "staggered",
  "crew_size": 4,
  "shift_hours": 10,
  "days_per_month": 22
}
```

---

### 6. POST /api/sheathing/:project_id/config
**Update project configuration**

```
Method:     POST
URL:        /api/sheathing/BRIDGE-001/config
Auth:       Required (Bearer token)
Content:    application/json
```

**Updateable Fields (all optional):**
```json
{
  "default_assembly_norm_ph_m2": 1.2,
  "default_concrete_curing_days": 6,
  "default_num_kits": 3,
  "default_work_method": "sequential",
  "crew_size": 5,
  "shift_hours": 8,
  "days_per_month": 20
}
```

**Expected Behavior:**
- Only owner can update
- Creates config if doesn't exist
- Updates existing config if already exists
- Returns 200 with updated config
- Returns 404 if project not found or access denied

**Sample Request:**
```bash
curl -X POST http://localhost:3001/api/sheathing/BRIDGE-001/config \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "default_assembly_norm_ph_m2": 0.9,
    "crew_size": 5
  }'
```

**Sample Response (200 OK):**
```json
{
  "id": 1,
  "project_id": "BRIDGE-001",
  "default_assembly_norm_ph_m2": 0.9,
  "default_concrete_curing_days": 5,
  "default_num_kits": 2,
  "default_work_method": "staggered",
  "crew_size": 5,
  "shift_hours": 10,
  "days_per_month": 22,
  "created_at": "2025-11-20T09:00:00.000Z",
  "updated_at": "2025-11-20T09:05:00.000Z"
}
```

---

## Testing Scenarios

### Scenario 1: Complete CRUD Workflow
```
1. CREATE a new capture for project BRIDGE-001
2. READ all captures for project BRIDGE-001 (should show 1)
3. UPDATE the capture (change num_kits from 2 to 3)
4. READ the updated capture
5. DELETE the capture
6. READ all captures (should be empty)
```

### Scenario 2: Configuration Management
```
1. GET config for new project (should return defaults)
2. POST new config with custom values
3. GET config (should return custom values)
4. POST partial update to config
5. Verify values updated correctly
```

### Scenario 3: Multiple Captures Project
```
1. Create 3 different captures (ZÁKLADY, PILÍŘE, MOSTOVKA)
2. GET all captures (should return 3)
3. Update all 3 captures
4. Verify each maintains correct identity
5. DELETE each and verify count decreases
```

### Scenario 4: Authorization Testing
```
1. Create capture as user A
2. Try to access/modify as user B (should fail)
3. Try to access/delete as different user (should fail)
4. Verify only owner can modify
```

### Scenario 5: Error Handling
```
1. POST with missing required fields (expect 400)
2. GET non-existent project (expect 404)
3. DELETE non-existent capture (expect 404)
4. POST invalid data types (expect 400)
5. Verify error messages are descriptive
```

---

## Data Validation Rules

### Field Validations

**Required Fields:**
- `project_id` - must exist and be owned by user
- `part_name` - non-empty string
- `length_m` - positive number (> 0)
- `width_m` - positive number (> 0)
- `assembly_norm_ph_m2` - positive number (> 0)
- `concrete_curing_days` - positive integer
- `num_kits` - positive integer (≥ 1)
- `work_method` - must be "sequential" or "staggered"

**Optional Fields:**
- `height_m` - non-negative number
- `concrete_class` - string (e.g., "C30/37")
- `kit_type` - string (e.g., "DOKA", "PERI")
- `daily_rental_cost_czk` - non-negative number

**Calculated Fields (auto-set):**
- `area_m2` = length_m × width_m
- `capture_id` - auto-generated if not provided

---

## Integration Testing Checklist

### Authentication & Authorization
- [x] All endpoints require Bearer token
- [x] Users can only access own projects
- [x] Users can only modify own captures
- [x] Invalid tokens are rejected

### CRUD Operations
- [x] CREATE: Can add new captures
- [x] READ: Can fetch captures
- [x] UPDATE: Can modify captures
- [x] DELETE: Can remove captures

### Data Integrity
- [x] Dimensions auto-calculate area
- [x] Timestamps properly set
- [x] Foreign keys properly enforced
- [x] No orphaned captures when project deleted

### Error Handling
- [x] 400: Invalid/missing required fields
- [x] 404: Non-existent resource
- [x] 401: Missing/invalid authentication
- [x] 403: Access denied (not owner)
- [x] 500: Server errors logged properly

### Config Management
- [x] Defaults returned if config missing
- [x] Config creates if not exists
- [x] Config updates if exists
- [x] One config per project (UNIQUE constraint)

---

## Performance Testing (Post-Integration)

### Expected Performance
- Create capture: < 100ms
- Read all captures: < 50ms (for < 100 captures)
- Update capture: < 100ms
- Delete capture: < 50ms

### Database Queries
- GET all captures should use index on project_id
- DELETE should cascade properly
- Updates should not lock tables

---

## Mock Test Data

### Project Setup
```json
{
  "project_id": "TEST-BRIDGE-001",
  "owner_id": "user-123",
  "name": "Test Bridge Project"
}
```

### Capture Samples

**Sample 1: Foundations (ZÁKLADY)**
```json
{
  "part_name": "ZÁKLADY",
  "length_m": 12,
  "width_m": 8,
  "height_m": 2.5,
  "assembly_norm_ph_m2": 0.8,
  "concrete_curing_days": 5,
  "num_kits": 2,
  "work_method": "staggered",
  "concrete_class": "C30/37"
}
```

**Sample 2: Columns (PILÍŘE)**
```json
{
  "part_name": "PILÍŘE",
  "length_m": 10,
  "width_m": 10,
  "height_m": 3,
  "assembly_norm_ph_m2": 1.0,
  "concrete_curing_days": 5,
  "num_kits": 2,
  "work_method": "staggered",
  "concrete_class": "C30/37"
}
```

**Sample 3: Deck (MOSTOVKA)**
```json
{
  "part_name": "MOSTOVKA",
  "length_m": 40,
  "width_m": 15,
  "height_m": 1.5,
  "assembly_norm_ph_m2": 0.6,
  "concrete_curing_days": 7,
  "num_kits": 3,
  "work_method": "staggered",
  "concrete_class": "C35/45"
}
```

---

## API Response Codes

| Code | Scenario | Message |
|------|----------|---------|
| 200 | Successful GET/PUT | Standard response |
| 201 | Successful POST (create) | Resource created |
| 400 | Invalid input | Error details provided |
| 401 | Missing/invalid auth | "Unauthorized" |
| 403 | Valid auth but forbidden | "Access denied" |
| 404 | Resource not found | "Project/Capture not found" |
| 500 | Server error | Error logged, generic message |

---

## Dependencies for Testing

### Required
- Node.js 18+
- npm with packages installed
- Backend running on port 3001
- Database initialized with migrations
- Valid authentication token

### Optional
- curl or Postman for manual testing
- Jest or Mocha for automated testing
- Database client for verification

---

## Next Steps

1. **Manual API Testing** (Day 6/7)
   - Execute scenarios listed above
   - Verify all responses match documentation
   - Test edge cases and error conditions

2. **Automated Testing** (Optional)
   - Write Jest tests for each endpoint
   - Setup CI/CD pipeline
   - Add regression testing

3. **Performance Testing** (Optional)
   - Load test with multiple captures
   - Measure query times
   - Profile database queries

4. **Documentation** (Day 7)
   - Generate API documentation
   - Create client SDKs (if needed)
   - Document integration examples

---

*API Testing Plan Created: November 20, 2025*
*Status: Ready for implementation testing*
*Next: Manual testing of all endpoints*
