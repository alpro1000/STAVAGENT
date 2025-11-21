# 📜 STAVAGENT: КОНТРАКТ ВЗАИМОДЕЙСТВИЯ СЕРВИСОВ

**Версия:** 1.0
**Дата:** 2024-11-21
**Статус:** Active

---

## 🎯 НАЗНАЧЕНИЕ

Этот документ определяет:
1. **API контракт** между сервисами
2. **Типы данных** (TypeScript interfaces)
3. **Правила взаимодействия** между компонентами
4. **Обработка ошибок** и исключений
5. **Версионирование** API

---

## 📋 СЕРВИСЫ И ИХ РОЛИ

| Сервис | URL | Назначение | Ответственность |
|--------|-----|-----------|-----------------|
| **monolit-planner-api** | `https://monolit-planner-api.onrender.com` | Расчёты мостов | Позиции, анализ, экспорт |
| **stavagent-portal-backend** | `https://stavagent-portal-backend.onrender.com` | Управление проектами | Авторизация, проекты, интеграция |

---

## 🔐 ОБЩИЕ ПРАВИЛА

### 1. Аутентификация

**Все** защищённые endpoints требуют JWT token.

```
Request Header:
Authorization: Bearer <JWT_TOKEN>

JWT структура:
{
  "sub": "user_id",
  "username": "john.doe",
  "role": "admin|user|viewer",
  "iat": 1700000000,
  "exp": 1700086400,
  "iss": "STAVAGENT"
}

Token lifetime: 24 часа
```

### 2. Response Format

**Все** responses должны следовать формату:

```json
{
  "success": true|false,
  "statusCode": 200|201|400|401|403|404|500,
  "message": "Human-readable message",
  "data": {} | [],
  "timestamp": "2024-11-21T10:30:00Z",
  "errors": []
}
```

### 3. Error Handling

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Name is required",
      "code": "FIELD_REQUIRED"
    }
  ]
}
```

### 4. Pagination

Для endpoints, возвращающих lists:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## 🔐 AUTHENTICATION ENDPOINTS

### POST /api/auth/verify

**Purpose:** User login (verify credentials)

**Request:**
```json
{
  "username": "john.doe",
  "password": "secure_password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": "user_123",
      "username": "john.doe",
      "email": "john@example.com",
      "role": "admin",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid credentials",
  "errors": [
    { "code": "INVALID_CREDENTIALS" }
  ]
}
```

---

### POST /api/auth/me

**Purpose:** Get current authenticated user

**Request:**
```
Headers: Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "username": "john.doe",
    "email": "john@example.com",
    "role": "admin",
    "created_at": "2024-01-01T00:00:00Z",
    "last_login": "2024-11-21T10:30:00Z"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Unauthorized - token invalid or expired"
}
```

---

### POST /api/auth/change-password

**Purpose:** Change user password

**Request:**
```json
{
  "old_password": "current_password",
  "new_password": "new_secure_password",
  "confirm_password": "new_secure_password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Current password is incorrect"
}
```

---

### POST /api/auth/logout

**Purpose:** Invalidate user token

**Request:**
```
Headers: Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🌉 POSITIONS ENDPOINTS (Monolit-Planner)

### GET /api/positions

**Purpose:** List all positions (building elements)

**Query Parameters:**
```
?page=1
&pageSize=20
&filter=floor|wall|column
&sort=name|created_at
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "pos_123",
      "name": "Column A1",
      "type": "column",
      "description": "Main support column",
      "config": {
        "length": 3.5,
        "width": 0.4,
        "height": 0.4,
        "unit": "m"
      },
      "category": "structural",
      "created_at": "2024-11-20T10:00:00Z",
      "updated_at": "2024-11-21T10:00:00Z"
    },
    {...}
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 145,
    "pages": 8
  }
}
```

---

### POST /api/positions

**Purpose:** Create new position

**Request:**
```json
{
  "name": "Column B1",
  "type": "column",
  "description": "Support column",
  "config": {
    "length": 3.5,
    "width": 0.4,
    "height": 0.4,
    "unit": "m"
  },
  "category": "structural"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Position created successfully",
  "data": {
    "id": "pos_456",
    "name": "Column B1",
    "type": "column",
    ...
  }
}
```

---

### PUT /api/positions/{id}

**Purpose:** Update position

**Request:**
```json
{
  "name": "Column B1 Updated",
  "config": {
    "length": 4.0,
    "width": 0.4,
    "height": 0.4
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Position updated",
  "data": { ... }
}
```

---

### DELETE /api/positions/{id}

**Purpose:** Delete position

**Success Response (200):**
```json
{
  "success": true,
  "message": "Position deleted successfully"
}
```

---

## 🏗️ BRIDGES ENDPOINTS (Monolit-Planner)

### GET /api/bridges

**Purpose:** List all bridge projects

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "bridge_123",
      "name": "Highway Bridge 5",
      "description": "Concrete span bridge",
      "status": "draft|completed|archived",
      "positions": ["pos_123", "pos_456"],
      "created_at": "2024-11-20T10:00:00Z",
      "updated_at": "2024-11-21T10:00:00Z",
      "author": {
        "id": "user_123",
        "username": "john.doe"
      }
    }
  ]
}
```

---

### POST /api/bridges

**Purpose:** Create new bridge

**Request:**
```json
{
  "name": "New Bridge",
  "description": "Bridge description",
  "positions": ["pos_123", "pos_456"]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "bridge_789",
    "name": "New Bridge",
    ...
  }
}
```

---

### POST /api/bridges/{id}/analyze

**Purpose:** Calculate bridge analysis

**Request:**
```json
{
  "analysis_type": "structural|material|cost",
  "include_variations": true,
  "save_snapshot": true
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "analysis_123",
    "bridge_id": "bridge_123",
    "analysis_type": "structural",
    "results": {
      "total_cost": 125000,
      "material_volume": 45.5,
      "load_capacity": 250,
      "kpi": {
        "efficiency": 0.95,
        "safety_factor": 1.8,
        "cost_per_ton": 2750
      }
    },
    "created_at": "2024-11-21T10:30:00Z"
  }
}
```

---

### GET /api/bridges/{id}/analysis

**Purpose:** Get latest analysis results

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "analysis_123",
    "bridge_id": "bridge_123",
    "results": {...},
    "created_at": "2024-11-21T10:30:00Z"
  }
}
```

---

## 📊 SNAPSHOTS ENDPOINTS (Version Control)

### GET /api/bridges/{id}/snapshots

**Purpose:** Get version history

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "snap_123",
      "bridge_id": "bridge_123",
      "version": 3,
      "data_hash": "abc123def456",
      "created_at": "2024-11-21T10:30:00Z",
      "description": "Updated column dimensions",
      "author": {
        "id": "user_123",
        "username": "john.doe"
      }
    },
    {...}
  ]
}
```

---

### POST /api/bridges/{id}/snapshots

**Purpose:** Save current state as snapshot

**Request:**
```json
{
  "description": "Final approved version"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "snap_124",
    "version": 4,
    "description": "Final approved version",
    "created_at": "2024-11-21T10:35:00Z"
  }
}
```

---

## 📄 FILE UPLOAD ENDPOINTS

### POST /api/upload/document

**Purpose:** Upload document for parsing

**Request:** multipart/form-data
```
file: <binary file>
document_type: excel|pdf|image
description: "Bridge plans document"
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "file_123",
    "filename": "bridge_plans.xlsx",
    "original_name": "bridge_plans.xlsx",
    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "size": 245000,
    "upload_date": "2024-11-21T10:40:00Z",
    "url": "/api/files/file_123/download"
  }
}
```

**Error Response (413):**
```json
{
  "success": false,
  "statusCode": 413,
  "message": "File too large",
  "errors": [
    {
      "code": "FILE_SIZE_EXCEEDED",
      "maxSize": "10MB"
    }
  ]
}
```

---

### GET /api/files/{id}

**Purpose:** Get file metadata

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "file_123",
    "filename": "bridge_plans.xlsx",
    "size": 245000,
    "upload_date": "2024-11-21T10:40:00Z",
    "download_url": "/api/files/file_123/download"
  }
}
```

---

### GET /api/files/{id}/download

**Purpose:** Download file

**Success Response (200):**
- Binary file content
- Content-Type: application/octet-stream
- Content-Disposition: attachment; filename="bridge_plans.xlsx"

---

## 📚 OTSKP ENDPOINTS (Pricing Catalog)

### GET /api/otskp/search

**Purpose:** Search pricing codes (Czech construction standards)

**Query Parameters:**
```
?q=column
&category=structural
&limit=10
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "code": "02.01.01",
      "description": "Reinforced concrete column",
      "unit": "m³",
      "price": 2450.00,
      "category": "structural",
      "standard": "OTSKP",
      "material": {
        "type": "concrete",
        "class": "C30/37"
      },
      "labor_hours": 45,
      "is_standard": true
    }
  ]
}
```

---

### GET /api/otskp/{code}

**Purpose:** Get detailed pricing code info

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "code": "02.01.01",
    "description": "Reinforced concrete column",
    "full_description": "Reinforced concrete column C30/37, labour includes formwork, rebar placement, concrete pouring",
    "unit": "m³",
    "price": 2450.00,
    "price_per_unit": 2450.00,
    "category": "structural",
    "subcategory": "vertical_elements",
    "standard": "OTSKP",
    "updated_at": "2024-11-15T00:00:00Z",
    "material": {
      "type": "concrete",
      "class": "C30/37",
      "density": 2500,
      "unit": "kg/m³"
    },
    "labor": {
      "hours": 45,
      "rate_per_hour": 380,
      "total": 17100
    },
    "related_codes": ["02.01.02", "02.02.01"]
  }
}
```

---

## 👥 ADMIN ENDPOINTS

### GET /api/admin/users

**Purpose:** List all users (admin only)

**Required Role:** admin

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_123",
      "username": "john.doe",
      "email": "john@example.com",
      "role": "admin",
      "status": "active|inactive|suspended",
      "created_at": "2024-01-01T00:00:00Z",
      "last_login": "2024-11-21T10:30:00Z",
      "projects_count": 15,
      "files_count": 45
    }
  ]
}
```

---

### POST /api/admin/users

**Purpose:** Create new user (admin only)

**Request:**
```json
{
  "username": "jane.smith",
  "email": "jane@example.com",
  "password": "secure_password",
  "role": "user|viewer",
  "full_name": "Jane Smith"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "user_456",
    "username": "jane.smith",
    "email": "jane@example.com",
    "role": "user",
    "created_at": "2024-11-21T10:40:00Z"
  }
}
```

---

### PUT /api/admin/users/{id}

**Purpose:** Update user (admin only)

**Request:**
```json
{
  "email": "jane.new@example.com",
  "role": "admin",
  "status": "active"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user_456",
    "username": "jane.smith",
    "email": "jane.new@example.com",
    "role": "admin",
    "updated_at": "2024-11-21T10:45:00Z"
  }
}
```

---

### DELETE /api/admin/users/{id}

**Purpose:** Delete user (admin only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### GET /api/admin/logs

**Purpose:** Get audit logs

**Query Parameters:**
```
?type=login|create|update|delete
&user_id=user_123
&limit=50
&offset=0
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "log_123",
      "timestamp": "2024-11-21T10:30:00Z",
      "event_type": "LOGIN",
      "user_id": "user_123",
      "user_name": "john.doe",
      "ip_address": "192.168.1.1",
      "details": {
        "resource": "users",
        "action": "create",
        "resource_id": "user_456"
      }
    }
  ]
}
```

---

## 🌐 PORTAL-SPECIFIC ENDPOINTS

### GET /api/projects (Portal)

**Purpose:** List user's projects (Portal-specific)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "proj_123",
      "name": "Project Alpha",
      "description": "Bridge construction project",
      "status": "active|completed|archived",
      "created_at": "2024-11-20T10:00:00Z",
      "owner": {
        "id": "user_123",
        "username": "john.doe"
      },
      "files_count": 12,
      "members": ["user_123", "user_456"]
    }
  ]
}
```

---

### POST /api/projects

**Purpose:** Create new project (Portal-specific)

**Request:**
```json
{
  "name": "New Project",
  "description": "Project description",
  "members": ["user_123", "user_456"]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "proj_789",
    "name": "New Project",
    ...
  }
}
```

---

## 🔄 INTEGRATION POINTS

### Portal → Monolit Integration

Portal can request data from Monolit:

```
stavagent-portal → https://monolit-planner-api.onrender.com/api/positions
stavagent-portal → https://monolit-planner-api.onrender.com/api/bridges
```

**Important:** Use same authentication format (JWT)

---

## ⚠️ ERROR CODES

### Standard HTTP Status Codes

| Status | Meaning | Example |
|--------|---------|---------|
| 200 | OK | Successful GET/PUT |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry |
| 413 | Payload Too Large | File too large |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Server Error | Server error |

### Custom Error Codes

```
FIELD_REQUIRED        - Required field missing
FIELD_INVALID         - Field validation failed
INVALID_CREDENTIALS   - Auth failed
INSUFFICIENT_RIGHTS   - User lacks permission
RESOURCE_NOT_FOUND    - Resource doesn't exist
DUPLICATE_ENTRY       - Entry already exists
FILE_SIZE_EXCEEDED    - Uploaded file too large
FILE_TYPE_INVALID     - File type not supported
DATABASE_ERROR        - Database operation failed
EXTERNAL_API_ERROR    - Third-party API failed
RATE_LIMIT_EXCEEDED   - Too many requests
```

---

## 📝 VERSIONING STRATEGY

### Current
- API Version: **v1**
- Backwards compatible

### Future
- When breaking changes needed:
  - Introduce `/api/v2/` endpoints
  - Keep v1 for 6 months
  - Document migration path

---

## 🔗 RELATED DOCUMENTS

- [STAVAGENT_MONOREPO_GUIDE.md](./STAVAGENT_MONOREPO_GUIDE.md) — Quick start guide
- [STAVAGENT_ARCHITECTURE.md](./STAVAGENT_ARCHITECTURE.md) — Technical architecture
- [MIGRATION_ROADMAP.md](./MIGRATION_ROADMAP.md) — Future plans

---

**Last Updated:** 2024-11-21
**Next Review:** 2024-12-01

