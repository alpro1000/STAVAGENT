# URS Matcher Service - API Documentation

## Base URL

```
http://localhost:3001/api
```

---

## Endpoints

### 1. Upload File

**Endpoint:** `POST /jobs/file-upload`

**Description:** Upload an Excel/ODS/CSV file for processing

**Request:**
```bash
curl -X POST http://localhost:3001/api/jobs/file-upload \
  -F "file=@my_budget.xlsx"
```

**Response (201 Created):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "filename": "my_budget.xlsx",
  "total_rows": 15,
  "items_created": 18,
  "message": "File processed successfully"
}
```

**Error (400):**
```json
{
  "error": "File type not allowed: .txt"
}
```

---

### 2. Text Match

**Endpoint:** `POST /jobs/text-match`

**Description:** Match a single text description with URS items

**Request:**
```bash
curl -X POST http://localhost:3001/api/jobs/text-match \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Podkladní beton C25/30 tl. 100 mm",
    "quantity": 25,
    "unit": "m3"
  }'
```

**Response (200 OK):**
```json
{
  "candidates": [
    {
      "urs_code": "801321111",
      "urs_name": "Beton podkladní C 16/20 až C 25/30",
      "unit": "m3",
      "confidence": 0.94
    },
    {
      "urs_code": "801321121",
      "urs_name": "Beton podkladní C 25/30 až C 30/37",
      "unit": "m3",
      "confidence": 0.88
    }
  ],
  "related_items": [
    {
      "urs_code": "801171321",
      "urs_name": "Bednění vodorovných konstrukcí",
      "reason": "Tech rule: formwork required for concrete slab"
    }
  ],
  "processing_time_ms": 145
}
```

**Parameters:**
- `text` (required): Description of the work
- `quantity` (optional): Quantity (default: 0)
- `unit` (optional): Unit of measurement (default: "ks")

---

### 3. Get Job Results

**Endpoint:** `GET /jobs/{jobId}`

**Description:** Retrieve results of a processed job

**Request:**
```bash
curl http://localhost:3001/api/jobs/550e8400-e29b-41d4-a716-446655440000
```

**Response (200 OK):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "filename": "my_budget.xlsx",
  "created_at": "2025-11-22T10:30:00Z",
  "total_rows": 15,
  "processed_rows": 18,
  "items": [
    {
      "input_row_id": 1,
      "input_text": "Podkladní beton C25/30 23.57 m3",
      "urs_code": "801321111",
      "urs_name": "Beton podkladní C 16/20 až C 25/30",
      "unit": "m3",
      "quantity": 23.57,
      "confidence": 0.94,
      "source": "local_match",
      "extra_generated": false
    },
    {
      "input_row_id": 1,
      "urs_code": "801171321",
      "urs_name": "Bednění vodorovných konstrukcí",
      "unit": "m2",
      "quantity": 36.5,
      "confidence": 0.88,
      "source": "tech_rule",
      "extra_generated": true
    }
  ]
}
```

---

### 4. List Jobs

**Endpoint:** `GET /jobs`

**Description:** Get list of all processed jobs (last 50)

**Request:**
```bash
curl http://localhost:3001/api/jobs
```

**Response (200 OK):**
```json
{
  "total": 5,
  "jobs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "my_budget.xlsx",
      "status": "completed",
      "created_at": "2025-11-22T10:30:00Z",
      "total_rows": 15,
      "processed_rows": 18
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "filename": "budget2.xlsx",
      "status": "completed",
      "created_at": "2025-11-22T09:15:00Z",
      "total_rows": 8,
      "processed_rows": 10
    }
  ]
}
```

---

### 5. Export Results

**Endpoint:** `POST /jobs/{jobId}/export`

**Description:** Export job results to Excel or CSV

**Request:**
```bash
curl -X POST http://localhost:3001/api/jobs/{jobId}/export \
  -H "Content-Type: application/json" \
  -d '{"format": "xlsx"}' \
  -o result.xlsx
```

**Response (200 OK):**
- Returns binary Excel/CSV file

**Parameters:**
- `format` (optional): "xlsx" or "csv" (default: "xlsx")

---

### 6. Get URS Catalog

**Endpoint:** `GET /urs-catalog`

**Description:** Get list of available URS items or search

**Request (Get all):**
```bash
curl "http://localhost:3001/api/urs-catalog"
```

**Request (Search):**
```bash
curl "http://localhost:3001/api/urs-catalog?search=beton&limit=20"
```

**Response (200 OK):**
```json
{
  "total": 3,
  "items": [
    {
      "urs_code": "801321111",
      "urs_name": "Beton podkladní C 16/20 až C 25/30",
      "unit": "m3",
      "description": "Podkladní beton"
    },
    {
      "urs_code": "801321121",
      "urs_name": "Beton podkladní C 25/30 až C 30/37",
      "unit": "m3",
      "description": "Podkladní beton"
    }
  ]
}
```

**Parameters:**
- `search` (optional): Search query (searches in name and code)
- `limit` (optional): Results limit (default: 100, max: 1000)

---

### 7. Get Specific URS Item

**Endpoint:** `GET /urs-catalog/{code}`

**Description:** Get details of a specific URS item

**Request:**
```bash
curl http://localhost:3001/api/urs-catalog/801321111
```

**Response (200 OK):**
```json
{
  "urs_code": "801321111",
  "urs_name": "Beton podkladní C 16/20 až C 25/30",
  "unit": "m3",
  "description": "Podkladní beton pro základové desky a konstrukce"
}
```

**Error (404):**
```json
{
  "error": "URS item not found"
}
```

---

### 8. Health Check

**Endpoint:** `GET /health`

**Description:** Check service status and database connectivity

**Request:**
```bash
curl http://localhost:3001/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "URS Matcher Service",
  "timestamp": "2025-11-22T10:30:00Z",
  "database": "connected"
}
```

**Error (503):**
```json
{
  "status": "error",
  "service": "URS Matcher Service",
  "error": "Database connection failed"
}
```

---

## Data Models

### Job Object
```json
{
  "id": "uuid",
  "filename": "string",
  "status": "processing|completed|error",
  "total_rows": "number",
  "processed_rows": "number",
  "created_at": "ISO8601 timestamp"
}
```

### Job Item Object
```json
{
  "id": "uuid",
  "job_id": "uuid",
  "input_row_id": "number",
  "input_text": "string",
  "urs_code": "string",
  "urs_name": "string",
  "unit": "string",
  "quantity": "number",
  "confidence": "0.0-1.0",
  "source": "local_match|llm_match|perplexity_search|tech_rule",
  "extra_generated": "boolean"
}
```

### URS Item Object
```json
{
  "urs_code": "string",
  "urs_name": "string",
  "unit": "string",
  "description": "string"
}
```

---

## Error Handling

### Error Response Format
```json
{
  "error": "Error message",
  "status": 400
}
```

### Common Status Codes
- **200 OK** - Request successful
- **201 Created** - Resource created
- **400 Bad Request** - Invalid input
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error
- **503 Service Unavailable** - Database or service down

---

## Rate Limiting

Currently disabled for MVP-1. Will be added in MVP-2:
- 100 requests per minute per IP
- 10 MB file size limit
- 30 second timeout for file processing

---

## Authentication

Currently disabled for MVP-1. Will be added in MVP-3:
- JWT tokens
- API key authentication
- User role-based access

---

## Examples

### Complete Workflow Example

**1. Upload file:**
```bash
curl -X POST http://localhost:3001/api/jobs/file-upload \
  -F "file=@budget.xlsx" \
  -H "Accept: application/json"
```

**2. Get results:**
```bash
curl http://localhost:3001/api/jobs/{jobId}
```

**3. Export to Excel:**
```bash
curl -X POST http://localhost:3001/api/jobs/{jobId}/export \
  -d '{"format":"xlsx"}' \
  -o results.xlsx
```

### Search URS Items

```bash
# Find all concrete items
curl "http://localhost:3001/api/urs-catalog?search=beton"

# Get specific item
curl http://localhost:3001/api/urs-catalog/801321111
```

---

## Integration Examples

### JavaScript Fetch

```javascript
// Upload file
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/jobs/file-upload', {
  method: 'POST',
  body: formData
});

const job = await response.json();
console.log('Job ID:', job.job_id);
```

### Python Requests

```python
import requests

# Text match
response = requests.post(
    'http://localhost:3001/api/jobs/text-match',
    json={
        'text': 'Podkladní beton C25/30',
        'quantity': 25,
        'unit': 'm3'
    }
)

results = response.json()
print(results['candidates'])
```

### cURL

```bash
# Complete example
curl -X POST http://localhost:3001/api/jobs/text-match \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Beton C30/37 - 50 m3",
    "quantity": 50,
    "unit": "m3"
  }' \
  -s | jq '.candidates[0]'
```

---

**API Version:** 1.0
**Status:** Production Ready
**Last Updated:** November 2025
