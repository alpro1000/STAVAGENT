# API Reference

> Complete REST API documentation for Concrete Agent

**Document version:** 1.0.0
**Last updated:** 2025-01-26
**API version:** v1
**Maintainer:** Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL & Endpoints](#base-url--endpoints)
4. [Common Patterns](#common-patterns)
5. [Project Management](#project-management)
6. [Workflow A - Import & Audit](#workflow-a---import--audit)
7. [Workflow B - Generate from Drawings](#workflow-b---generate-from-drawings)
8. [File & Resource Management](#file--resource-management)
9. [Error Handling](#error-handling)
10. [Examples](#examples)

---

## Overview

### API Architecture

Concrete Agent provides a RESTful API built with **FastAPI** for:

- **Project Management**: Create, upload, and manage construction projects
- **Workflow A**: Import vykaz vymer (BoQ), parse, enrich, and audit
- **Workflow B**: Generate positions from construction drawings (PDF/images)
- **Artifact Generation**: Tech cards, resource sheets, material specifications
- **File Management**: Upload, download, and manage project files

### Key Features

- ✅ **Async/Await**: All endpoints are async for high performance
- ✅ **Pydantic Validation**: Request/response schemas validated automatically
- ✅ **OpenAPI/Swagger**: Auto-generated interactive docs at `/docs`
- ✅ **File Uploads**: Support for multipart/form-data file uploads
- ✅ **Streaming**: Large file uploads with streaming support
- ✅ **Security**: Path traversal protection, file size limits, MIME type validation

### Technology Stack

| Component | Technology |
|-----------|-----------|
| **Framework** | FastAPI 0.115.0 |
| **Server** | Uvicorn (dev) / Gunicorn (prod) |
| **Validation** | Pydantic 2.10.3 |
| **File Handling** | aiofiles, python-multipart |
| **Documentation** | OpenAPI 3.1 (Swagger UI) |

---

## Authentication

### Current Status

**Authentication is not currently required** for API endpoints. This is suitable for:
- Development environments
- Internal deployments behind VPN/firewall
- Single-user installations

### Future Authentication (Roadmap)

For production deployments with multiple users:

```python
# Future: API key authentication
headers = {
    "X-API-Key": "your-api-key-here"
}
```

**Security Best Practices:**
- Run behind reverse proxy (nginx)
- Use HTTPS in production
- Implement rate limiting
- Add API key authentication
- Use CORS configuration

---

## Base URL & Endpoints

### Development

```
http://localhost:8000
```

### Production

```
https://your-domain.com
```

### Interactive Documentation

| URL | Description |
|-----|-------------|
| `/docs` | Swagger UI (interactive API explorer) |
| `/redoc` | ReDoc (alternative documentation) |
| `/openapi.json` | OpenAPI schema (JSON) |

### Health Check

```http
GET /
```

**Response:**
```json
{
  "message": "Concrete Agent API",
  "version": "1.0.0",
  "status": "healthy"
}
```

---

## Common Patterns

### Request/Response Format

**Content-Type:** `application/json` (except file uploads: `multipart/form-data`)

**Standard Response Wrapper:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2025-01-26T10:30:00Z"
}
```

**Error Response:**

```json
{
  "detail": "Error description",
  "status_code": 400
}
```

### Common HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful GET/POST/PUT |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid input data |
| `404` | Not Found | Resource not found (project, file) |
| `422` | Unprocessable Entity | Pydantic validation error |
| `500` | Internal Server Error | Server-side error |

### Pagination (Future)

```http
GET /api/projects?page=1&limit=20
```

### File Size Limits

- **Maximum file size**: 50 MB
- **Allowed extensions**: See [File Upload](#file-upload) section

---

## Project Management

### Create Project

**Endpoint:** `POST /api/projects/upload`

**Description:** Create a new project with file upload(s). Supports Workflow A (import) and Workflow B (generate from drawings).

**Request:**

```http
POST /api/projects/upload
Content-Type: multipart/form-data

project_name: "Bytový dům Vinohrady"
vykaz_vymer: <file: rozpocet.xlsx>
vykresy: <file: plan.pdf>
workflow: "a"  // or "b" or "both"
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_name` | string | Yes | Project name |
| `vykaz_vymer` | file | Workflow A | BoQ file (XML, XLSX, PDF) |
| `vykresy` | file(s) | Workflow B | Drawing files (PDF, DWG, images) |
| `dokumentace` | file(s) | No | Additional documentation |
| `workflow` | string | No | Workflow type: `"a"`, `"b"`, `"both"` (default: auto-detect) |

**Allowed File Extensions:**

- **vykaz_vymer**: `.xml`, `.xlsx`, `.xls`, `.pdf`, `.csv`
- **vykresy**: `.pdf`, `.dwg`, `.dxf`, `.png`, `.jpg`, `.jpeg`, `.txt`
- **dokumentace**: `.pdf`, `.doc`, `.docx`, `.xlsx`, `.xls`, `.txt`, `.csv`

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "message": "Project created successfully",
  "data": {
    "project_name": "Bytový dům Vinohrady",
    "workflow_type": "a",
    "status": "uploaded",
    "files": {
      "vykaz_vymer": {
        "file_id": "proj_1706265000_abc123:vykaz_vymer:rozpocet.xlsx",
        "filename": "rozpocet.xlsx",
        "file_type": "vykaz_vymer",
        "size": 45632,
        "uploaded_at": "2025-01-26T10:30:00Z"
      }
    }
  }
}
```

**Example (curl):**

```bash
curl -X POST "http://localhost:8000/api/projects/upload" \
  -F "project_name=Bytový dům Vinohrady" \
  -F "vykaz_vymer=@rozpocet.xlsx" \
  -F "workflow=a"
```

**Example (Python):**

```python
import requests

url = "http://localhost:8000/api/projects/upload"

files = {
    "vykaz_vymer": open("rozpocet.xlsx", "rb")
}

data = {
    "project_name": "Bytový dům Vinohrady",
    "workflow": "a"
}

response = requests.post(url, files=files, data=data)
print(response.json())
```

---

### Get Project Status

**Endpoint:** `GET /api/projects/{project_id}/status`

**Description:** Retrieve current project status and metadata.

**Request:**

```http
GET /api/projects/proj_1706265000_abc123/status
```

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "data": {
    "project_name": "Bytový dům Vinohrady",
    "workflow_type": "a",
    "status": "completed",
    "created_at": "2025-01-26T10:30:00Z",
    "updated_at": "2025-01-26T10:35:00Z",
    "files": {
      "vykaz_vymer": { ... }
    },
    "artifacts": {
      "parsed_positions": {
        "position_id": "all",
        "path": "/data/processed/proj_.../parsed_positions.json",
        "type": "parsed_positions",
        "source": "workflow_a",
        "updated_at": "2025-01-26T10:32:00Z"
      },
      "audit_results": { ... }
    },
    "metadata": {
      "total_positions": 53,
      "green_count": 48,
      "amber_count": 3,
      "red_count": 2
    }
  }
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `uploaded` | Files uploaded, workflow not started |
| `processing` | Workflow currently running |
| `completed` | Workflow completed successfully |
| `failed` | Workflow failed (see error message) |
| `archived` | Project archived |

---

### List Projects

**Endpoint:** `GET /api/projects`

**Description:** List all projects (future: with pagination and filtering).

**Request:**

```http
GET /api/projects
```

**Response:**

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "project_id": "proj_1706265000_abc123",
        "project_name": "Bytový dům Vinohrady",
        "workflow_type": "a",
        "status": "completed",
        "created_at": "2025-01-26T10:30:00Z"
      },
      {
        "project_id": "proj_1706265100_def456",
        "project_name": "Most přes řeku",
        "workflow_type": "b",
        "status": "processing",
        "created_at": "2025-01-26T11:00:00Z"
      }
    ],
    "total": 2
  }
}
```

---

### Delete Project

**Endpoint:** `DELETE /api/projects/{project_id}`

**Description:** Delete a project and all associated files/artifacts.

**Request:**

```http
DELETE /api/projects/proj_1706265000_abc123
```

**Response:**

```json
{
  "success": true,
  "message": "Project proj_1706265000_abc123 deleted successfully"
}
```

---

## Workflow A - Import & Audit

Workflow A imports an existing BoQ (vykaz vymer), parses positions, enriches with KROS/RTS data, and performs AI-powered audit.

### Start Workflow A

**Endpoint:** `POST /api/workflow/a/execute`

**Description:** Start or continue Workflow A execution.

**Request:**

```json
{
  "project_id": "proj_1706265000_abc123",
  "action": "execute"
}
```

**Actions:**

| Action | Description |
|--------|-------------|
| `execute` | Full workflow execution |
| `parse` | Parse positions only |
| `enrich` | Enrich positions with KROS/RTS |
| `audit` | Perform AI audit |
| `export` | Export results to Excel |

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "data": {
    "status": "completed",
    "artifacts": {
      "parsed_positions": "/data/processed/proj_.../parsed_positions.json",
      "audit_results": "/data/processed/proj_.../audit_results.json",
      "exported_excel": "/data/processed/proj_.../audit_report.xlsx"
    },
    "stats": {
      "total_positions": 53,
      "green_count": 48,
      "amber_count": 3,
      "red_count": 2,
      "avg_confidence": 0.92
    }
  }
}
```

---

### Get Positions (Workflow A)

**Endpoint:** `POST /api/workflow/a/positions`

**Description:** Retrieve parsed and audited positions.

**Request:**

```json
{
  "project_id": "proj_1706265000_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "data": {
    "positions": [
      {
        "id": "1",
        "code": "121151113",
        "description": "Beton C 25/30",
        "unit": "m3",
        "quantity": 10.5,
        "unit_price": 2500.0,
        "total_price": 26250.0,
        "classification": "GREEN",
        "confidence": 0.97,
        "audit": {
          "status": "approved",
          "roles": ["SME", "ENG", "ARCH"],
          "consensus": "unanimous",
          "evidence": [
            "Exact KROS match: 121151113",
            "Price within 5% of database average",
            "All technical parameters validated"
          ],
          "recommendations": []
        },
        "enrichment": {
          "kros_code": "121151113",
          "kros_name": "Beton prostý C 25/30",
          "unit_price_kros": 2480.0,
          "applicable_norms": ["ČSN EN 206-1", "ČSN 73 1201"]
        }
      }
    ],
    "total": 53,
    "stats": {
      "green_count": 48,
      "amber_count": 3,
      "red_count": 2
    }
  }
}
```

---

### Generate Tech Card (Workflow A)

**Endpoint:** `POST /api/workflow/a/tech-card`

**Description:** Generate a technology card (Technologická karta) for a specific position.

**Request:**

```json
{
  "project_id": "proj_1706265000_abc123",
  "position_id": "1",
  "action": "tech_card"
}
```

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "artifact": {
    "type": "tech_card",
    "position_id": "1",
    "title": "Technologická karta - 121151113",
    "data": {
      "position_id": "1",
      "code": "121151113",
      "description": "Beton C 25/30",
      "unit": "m3",
      "quantity": 10.5,
      "classification": "GREEN",
      "steps": [
        {
          "step_num": 1,
          "title": "Příprava",
          "description": "Příprava podkladu a bednění",
          "duration_minutes": 45,
          "workers": 2
        },
        {
          "step_num": 2,
          "title": "Betonáž",
          "description": "Ukládání a hutnění betonu",
          "duration_minutes": 120,
          "workers": 4
        }
      ],
      "norms": [
        "ČSN EN 206-1",
        "ČSN 73 1201"
      ],
      "materials": [
        {
          "name": "Beton C 25/30",
          "quantity": 10.5,
          "unit": "m3"
        }
      ],
      "safety_requirements": [
        "Ochranné pracovní pomůcky",
        "Zabezpečení pracoviště"
      ]
    },
    "metadata": {
      "generated_at": "2025-01-26T10:35:00Z",
      "source": "workflow_a_audit"
    }
  }
}
```

---

### Generate Resource Sheet (Workflow A)

**Endpoint:** `POST /api/workflow/a/resource-sheet`

**Description:** Generate a resource sheet (TOV - Technická ochranná vesta) for labor, equipment, and materials.

**Request:**

```json
{
  "project_id": "proj_1706265000_abc123",
  "position_id": "1",
  "action": "resource_sheet"
}
```

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "artifact": {
    "type": "resource_sheet",
    "position_id": "1",
    "title": "Zdroje - 121151113",
    "data": {
      "position_id": "1",
      "code": "121151113",
      "description": "Beton C 25/30",
      "quantity": 10.5,
      "unit": "m3",
      "labor": {
        "total_hours": 12.5,
        "trades": [
          {
            "trade": "Betonář",
            "workers": 4,
            "hours": 10.0
          },
          {
            "trade": "Pomocník",
            "workers": 2,
            "hours": 2.5
          }
        ]
      },
      "equipment": {
        "items": [
          {
            "name": "Autodomíchávač",
            "quantity": 1,
            "hours": 2.0
          },
          {
            "name": "Vibrátory",
            "quantity": 2,
            "hours": 3.0
          }
        ]
      },
      "materials": [
        {
          "name": "Beton C 25/30",
          "quantity": 10.5,
          "unit": "m3",
          "unit_price": 2500.0,
          "total": 26250.0
        }
      ],
      "cost_estimate": 32500.0
    },
    "metadata": {
      "generated_at": "2025-01-26T10:36:00Z",
      "source": "workflow_a_audit"
    }
  }
}
```

---

### Generate Materials Specification (Workflow A)

**Endpoint:** `POST /api/workflow/a/materials`

**Description:** Generate detailed materials specification.

**Request:**

```json
{
  "project_id": "proj_1706265000_abc123",
  "position_id": "1",
  "action": "materials"
}
```

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "artifact": {
    "type": "materials_detailed",
    "position_id": "1",
    "title": "Materiály - 121151113",
    "data": {
      "position_id": "1",
      "code": "121151113",
      "description": "Beton C 25/30",
      "materials": [
        {
          "type": "Beton",
          "name": "Beton C 25/30",
          "quantity": 10.5,
          "unit": "m3",
          "specifications": {
            "strength_class": "C 25/30",
            "consistency": "S3",
            "max_aggregate_size": "16mm"
          }
        }
      ],
      "total_items": 1,
      "material_types": ["Beton"]
    },
    "metadata": {
      "generated_at": "2025-01-26T10:37:00Z",
      "source": "workflow_a_audit"
    }
  }
}
```

---

### Enrich Position (Workflow A)

**Endpoint:** `POST /api/workflow/a/enrich`

**Description:** Enrich a single position with KROS/RTS data and optional Claude analysis.

**Request:**

```json
{
  "project_id": "proj_1706265000_abc123",
  "position_id": "1",
  "include_claude_analysis": true
}
```

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "data": {
    "position": {
      "id": "1",
      "code": "121151113",
      "description": "Beton C 25/30",
      "enrichment_status": "matched",
      "kros_code": "121151113",
      "kros_name": "Beton prostý C 25/30",
      "unit_price": 2500.0,
      "applicable_norms": ["ČSN EN 206-1"],
      "claude_analysis": {
        "confidence": 0.97,
        "reasoning": "Exact match found in KROS database",
        "recommendations": []
      }
    }
  }
}
```

---

## Workflow B - Generate from Drawings

Workflow B analyzes construction drawings (PDF, images) using AI to generate a complete Bill of Quantities.

### Start Workflow B

**Endpoint:** `POST /api/workflow/b/execute`

**Description:** Start Workflow B execution (drawing analysis).

**Request:**

```json
{
  "project_id": "proj_1706265100_def456",
  "action": "execute"
}
```

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265100_def456",
  "data": {
    "status": "completed",
    "artifacts": {
      "generated_positions": "/data/processed/proj_.../generated_positions.json"
    },
    "stats": {
      "total_positions": 27,
      "drawings_analyzed": 3,
      "confidence_avg": 0.85
    }
  }
}
```

---

### Get Positions (Workflow B)

**Endpoint:** `POST /api/workflow/b/positions`

**Description:** Retrieve positions generated from drawings.

**Request:**

```json
{
  "project_id": "proj_1706265100_def456"
}
```

**Response:**

```json
{
  "success": true,
  "project_id": "proj_1706265100_def456",
  "data": {
    "positions": [
      {
        "id": "gen_1",
        "code": "121151113",
        "description": "Beton C 25/30 - základy",
        "unit": "m3",
        "quantity": 15.75,
        "source_drawing": "plan_zaklady.pdf",
        "confidence": 0.88,
        "ai_reasoning": "Detected foundation slab 450x350cm, depth 0.1m"
      }
    ],
    "total": 27,
    "stats": {
      "drawings_analyzed": 3,
      "avg_confidence": 0.85
    }
  }
}
```

---

### Generate Tech Card (Workflow B)

**Endpoint:** `POST /api/workflow/b/tech-card`

**Description:** Generate tech card for a position from Workflow B.

**Request/Response:** Similar to Workflow A tech card endpoint.

---

### Generate Resource Sheet (Workflow B)

**Endpoint:** `POST /api/workflow/b/resource-sheet`

**Description:** Generate resource sheet for a position from Workflow B.

**Request/Response:** Similar to Workflow A resource sheet endpoint.

---

## File & Resource Management

### Download File

**Endpoint:** `GET /api/files/{project_id}/{file_type}/{filename}`

**Description:** Download a project file or artifact.

**Request:**

```http
GET /api/files/proj_1706265000_abc123/vykaz_vymer/rozpocet.xlsx
```

**Response:** File stream (Content-Type based on file extension)

---

### Download Artifact

**Endpoint:** `GET /api/artifacts/{project_id}/{artifact_type}`

**Description:** Download generated artifacts (JSON or Excel).

**Request:**

```http
GET /api/artifacts/proj_1706265000_abc123/audit_results.json
```

**Artifact Types:**

- `parsed_positions.json` - Parsed positions
- `audit_results.json` - Audit results
- `audit_report.xlsx` - Excel export
- `tech_card_{position_id}.json` - Tech card
- `resource_sheet_{position_id}.json` - Resource sheet

**Response:** File stream

---

## Error Handling

### Error Response Format

```json
{
  "detail": "Error message describing what went wrong",
  "status_code": 400
}
```

### Common Errors

#### 400 Bad Request

**Cause:** Invalid input data

**Example:**

```json
{
  "detail": "Invalid filename",
  "status_code": 400
}
```

**Fix:** Ensure filenames don't contain path traversal characters (`..`, `/`, `\`)

#### 404 Not Found

**Cause:** Resource not found

**Example:**

```json
{
  "detail": "Project proj_nonexistent not found",
  "status_code": 404
}
```

**Fix:** Verify project_id is correct

#### 422 Unprocessable Entity

**Cause:** Pydantic validation error

**Example:**

```json
{
  "detail": [
    {
      "loc": ["body", "project_id"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Fix:** Ensure all required fields are present and correctly typed

#### 500 Internal Server Error

**Cause:** Server-side error (parsing, AI API failure, file I/O)

**Example:**

```json
{
  "detail": "Failed to parse XML: Invalid UNIXML format",
  "status_code": 500
}
```

**Fix:** Check server logs, verify file format, ensure API keys are configured

---

## Examples

### Complete Workflow A Example (Python)

```python
import requests
from pathlib import Path

BASE_URL = "http://localhost:8000"

# 1. Create project with file upload
def create_project():
    url = f"{BASE_URL}/api/projects/upload"

    files = {
        "vykaz_vymer": open("rozpocet.xlsx", "rb")
    }

    data = {
        "project_name": "Bytový dům Vinohrady",
        "workflow": "a"
    }

    response = requests.post(url, files=files, data=data)
    response.raise_for_status()

    result = response.json()
    print(f"✅ Project created: {result['project_id']}")
    return result["project_id"]


# 2. Execute Workflow A
def execute_workflow(project_id):
    url = f"{BASE_URL}/api/workflow/a/execute"

    payload = {
        "project_id": project_id,
        "action": "execute"
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()

    result = response.json()
    print(f"✅ Workflow completed: {result['data']['stats']}")
    return result


# 3. Get audit results
def get_positions(project_id):
    url = f"{BASE_URL}/api/workflow/a/positions"

    payload = {
        "project_id": project_id
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()

    result = response.json()
    positions = result["data"]["positions"]

    print(f"✅ Retrieved {len(positions)} positions")

    for pos in positions[:5]:  # Show first 5
        print(f"  - {pos['code']}: {pos['description']} ({pos['classification']})")

    return positions


# 4. Generate tech card for first position
def generate_tech_card(project_id, position_id):
    url = f"{BASE_URL}/api/workflow/a/tech-card"

    payload = {
        "project_id": project_id,
        "position_id": position_id,
        "action": "tech_card"
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()

    result = response.json()
    print(f"✅ Tech card generated: {result['artifact']['title']}")
    return result


# 5. Download audit report (Excel)
def download_report(project_id):
    url = f"{BASE_URL}/api/artifacts/{project_id}/audit_report.xlsx"

    response = requests.get(url)
    response.raise_for_status()

    output_path = Path(f"{project_id}_audit.xlsx")
    output_path.write_bytes(response.content)

    print(f"✅ Report downloaded: {output_path}")
    return output_path


# Run complete workflow
if __name__ == "__main__":
    # Step 1: Create project
    project_id = create_project()

    # Step 2: Execute workflow
    execute_workflow(project_id)

    # Step 3: Get positions
    positions = get_positions(project_id)

    # Step 4: Generate tech card for first position
    if positions:
        first_pos_id = positions[0]["id"]
        generate_tech_card(project_id, first_pos_id)

    # Step 5: Download Excel report
    download_report(project_id)

    print(f"\n🎉 Workflow A completed successfully for {project_id}")
```

---

### Complete Workflow B Example (JavaScript/Node.js)

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const BASE_URL = 'http://localhost:8000';

// 1. Create project with drawings
async function createProject() {
  const url = `${BASE_URL}/api/projects/upload`;

  const formData = new FormData();
  formData.append('project_name', 'Most přes řeku');
  formData.append('vykresy', fs.createReadStream('plan.pdf'));
  formData.append('workflow', 'b');

  const response = await axios.post(url, formData, {
    headers: formData.getHeaders()
  });

  const projectId = response.data.project_id;
  console.log(`✅ Project created: ${projectId}`);
  return projectId;
}

// 2. Execute Workflow B
async function executeWorkflow(projectId) {
  const url = `${BASE_URL}/api/workflow/b/execute`;

  const payload = {
    project_id: projectId,
    action: 'execute'
  };

  const response = await axios.post(url, payload);
  console.log(`✅ Workflow completed:`, response.data.data.stats);
  return response.data;
}

// 3. Get generated positions
async function getPositions(projectId) {
  const url = `${BASE_URL}/api/workflow/b/positions`;

  const payload = {
    project_id: projectId
  };

  const response = await axios.post(url, payload);
  const positions = response.data.data.positions;

  console.log(`✅ Retrieved ${positions.length} positions`);

  positions.slice(0, 5).forEach(pos => {
    console.log(`  - ${pos.code}: ${pos.description} (${pos.quantity} ${pos.unit})`);
  });

  return positions;
}

// Run complete workflow
(async () => {
  try {
    // Step 1: Create project
    const projectId = await createProject();

    // Step 2: Execute workflow
    await executeWorkflow(projectId);

    // Step 3: Get positions
    const positions = await getPositions(projectId);

    console.log(`\n🎉 Workflow B completed successfully for ${projectId}`);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
})();
```

---

### curl Examples

```bash
# Create project
curl -X POST "http://localhost:8000/api/projects/upload" \
  -F "project_name=Test Project" \
  -F "vykaz_vymer=@rozpocet.xlsx" \
  -F "workflow=a"

# Execute Workflow A
curl -X POST "http://localhost:8000/api/workflow/a/execute" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "proj_1706265000_abc123", "action": "execute"}'

# Get positions
curl -X POST "http://localhost:8000/api/workflow/a/positions" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "proj_1706265000_abc123"}'

# Generate tech card
curl -X POST "http://localhost:8000/api/workflow/a/tech-card" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_1706265000_abc123",
    "position_id": "1",
    "action": "tech_card"
  }'

# Download audit report
curl -O "http://localhost:8000/api/artifacts/proj_1706265000_abc123/audit_report.xlsx"
```

---

## Appendix

### Rate Limiting (Future)

Rate limiting configuration (when implemented):

```python
# Per-IP limits
- 100 requests per minute (general endpoints)
- 10 requests per minute (AI-powered endpoints)
- 5 requests per minute (file uploads)
```

### Webhooks (Future)

Webhook notifications for long-running workflows:

```json
{
  "event": "workflow.completed",
  "project_id": "proj_1706265000_abc123",
  "workflow_type": "a",
  "status": "completed",
  "timestamp": "2025-01-26T10:35:00Z"
}
```

### API Versioning (Future)

```
/api/v1/projects/...
/api/v2/projects/...
```

### GraphQL Support (Future)

GraphQL endpoint for flexible queries:

```graphql
query GetProject($id: ID!) {
  project(id: $id) {
    projectName
    status
    positions {
      code
      description
      classification
    }
  }
}
```

---

## Related Documentation

- [README.md](../README.md) - Project overview
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) - Technical specification
- [CONFIG.md](CONFIG.md) - Configuration reference
- [TESTS.md](TESTS.md) - Testing guide

---

**Last updated:** 2025-01-26
**Maintainer:** Development Team
**Questions?** Open an issue on GitHub
