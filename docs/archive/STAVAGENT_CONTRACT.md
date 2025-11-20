# 📜 StavAgent System Contract

**Версия:** 1.0.0
**Дата:** 2025-11-15
**Статус:** ✅ ACTIVE

> **Назначение:** Единый контракт интеграции между сервисами StavAgent.
> Этот файл ДОЛЖЕН быть скопирован во все репозитории (Portal, CORE, Monolit, Pump, ...).
> Любые изменения интеграции НАЧИНАЮТСЯ с обновления этого контракта.

---

## 🏗️ Архитектура системы

```
┌─────────────────────────┐
│  PORTAL                 │  Репо: Monolit-Planner (текущий)
│  Главный вход, проекты  │  URL:  https://portal.stavagent.com
└───────────┬─────────────┘
            ↓
      Выбор киоска
            ↓
    ┌───────┴────────┐
    ↓                ↓
┌─────────┐    ┌─────────┐
│ Monolit │    │  Pump   │  Репо: kiosk-monolit, kiosk-pump
│  Киоск  │    │  Киоск  │  URL:  https://monolit.stavagent.com
└────┬────┘    └────┬────┘        https://pump.stavagent.com
     ↓              ↓
┌────────────────────────┐
│  Concrete-Agent CORE   │  Репо: concrete-agent
│  Парсинг, AI, аудит    │  URL:  https://concrete-agent.onrender.com
└────────────────────────┘
```

---

## 🔑 Идентификаторы (ID Convention)

### Правило: ВСЕГДА уточнять тип ID

**❌ НЕПРАВИЛЬНО:**
```javascript
project_id: "SO201"  // Какой это ID? Портала? Киоска?
```

**✅ ПРАВИЛЬНО:**
```javascript
portal_project_id: "proj_abc123"      // UUID, главный ID
core_project_id: "core_xyz789"        // ID в Concrete-Agent CORE
monolith_project_id: "SO201"          // ID в киоске Monolit
pump_project_id: "pump_12"            // ID в киоске Pump
```

### Формат ID

| Сервис | Поле | Формат | Пример |
|--------|------|--------|--------|
| Portal | `portal_project_id` | UUID | `"proj_abc123-def4-5678-90ab-cdef12345678"` |
| CORE | `core_project_id` | String (proj_*) | `"proj_xyz789"` |
| Monolit | `monolith_project_id` | String (SO*, BD*, PK*) | `"SO201"`, `"BD001"` |
| Pump | `pump_project_id` | String (pump_*) | `"pump_12"` |

### Таблица соответствий (хранится в Portal)

```sql
-- Таблица kiosk_links в Portal DB
portal_project_id | kiosk_type | kiosk_project_id
------------------|------------|------------------
proj_abc123       | monolit    | SO201
proj_abc123       | pump       | pump_12
proj_abc123       | core       | core_xyz789
```

---

## 📡 API Contract: PORTAL ↔ CORE

### Base URL
```
CORE: https://concrete-agent.onrender.com
```

### 1. Отправить документ в CORE

**Endpoint:** `POST /workflow-a/start`

**Request:**
```javascript
// multipart/form-data
{
  file: File,                        // Файл (PDF, Excel, XLSX)
  project_id: "proj_abc123",         // portal_project_id
  project_name: "Most Starý Rožmitál",
  object_type: "bridge",             // 'bridge' | 'building' | 'parking' | 'road'
  structure_type: "most"             // Тип конструкции (опционально)
}
```

**Response:**
```javascript
{
  status: "success",
  workflow_id: "wf_12345",           // ID workflow в CORE
  core_project_id: "core_xyz789",    // ID проекта в CORE
  positions: [                       // Parsed позиции
    {
      code: "121-01-001",
      description: "Betonáž základů",
      quantity: 45.0,
      unit: "m³",
      concrete_class: "C30/37",
      structure_hint: "ZÁKLADY"       // Подсказка для группировки
    }
  ],
  metadata: {
    total_positions: 150,
    concrete_positions: 35
  }
}
```

---

### 2. Получить бетонные работы

**Endpoint:** `GET /projects/{core_project_id}/concrete-items`

**Request:**
```javascript
GET /projects/core_xyz789/concrete-items
```

**Response:**
```javascript
{
  status: "success",
  core_project_id: "core_xyz789",
  concrete_items: [
    {
      code: "121-01-001",
      description: "Betonáž základů C30/37",
      quantity: 45.0,
      unit: "m³",
      concrete_class: "C30/37",
      structure_hint: "ZÁKLADY",      // Для киоска Monolit
      part_suggestion: "ZÁKLADY"      // AI предположение
    },
    {
      code: "121-01-002",
      description: "Betonáž opěry C35/45",
      quantity: 30.0,
      unit: "m³",
      concrete_class: "C35/45",
      structure_hint: "OPĚRY",
      part_suggestion: "OPĚRY"
    }
  ]
}
```

---

### 3. Аудит (multi-role)

**Endpoint:** `POST /workflow-a/audit`

**Request:**
```javascript
{
  workflow_id: "wf_12345",
  core_project_id: "core_xyz789",
  analysis: { /* данные анализа */ },
  roles: ["architect", "foreman", "estimator"]
}
```

**Response:**
```javascript
{
  status: "success",
  audit_results: {
    architect: "GREEN",
    foreman: "AMBER",
    estimator: "GREEN"
  },
  issues: [
    {
      role: "foreman",
      severity: "warning",
      message: "Недостаточно данных о арматуре"
    }
  ],
  suggestions: { /* рекомендации */ }
}
```

---

### 4. AI обогащение

**Endpoint:** `POST /workflow-a/enrich`

**Request:**
```javascript
{
  workflow_id: "wf_12345",
  core_project_id: "core_xyz789",
  analysis: { /* данные */ },
  provider: "claude"  // 'claude' | 'gpt4' | 'perplexity'
}
```

**Response:**
```javascript
{
  status: "success",
  enriched_positions: [ /* обогащенные позиции */ ],
  ai_suggestions: { /* предложения AI */ }
}
```

---

### 5. Knowledge Base search

**Endpoint:** `GET /kb/search`

**Request:**
```javascript
GET /kb/search?query=základy&category=B5_URS_KROS4
```

**Response:**
```javascript
{
  status: "success",
  results: [
    {
      code: "121-01-001",
      name: "Betonáž základů",
      category: "B5_URS_KROS4",
      specification: "..."
    }
  ],
  total: 15
}
```

---

### 6. Калькулятор мостов

**Endpoint:** `POST /calculate/bridge`

**Request:**
```javascript
{
  length: 45.0,        // метры
  width: 12.5,         // метры
  depth: 2.5,          // метры
  concrete_class: "C30/37"
}
```

**Response:**
```javascript
{
  status: "success",
  volume_m3: 1406.25,
  labor_hours: 140,
  machine_hours: 70,
  materials: {
    cement_kg: 421875,
    sand_kg: 843750,
    gravel_kg: 1406250
  }
}
```

---

## 📡 API Contract: PORTAL ↔ MONOLIT (Kiosk)

### Base URL
```
MONOLIT: https://monolit.stavagent.com
```

### 1. Открыть киоск (redirect)

**Endpoint:** `GET /api/portal/open-project`

**Request:**
```javascript
GET /api/portal/open-project?portal_project_id=proj_abc123&token=jwt_token
```

**Query параметры:**
```javascript
{
  portal_project_id: "proj_abc123",  // ID проекта в портале
  token: "jwt_xxx",                  // JWT для авторизации
  action: "open"                     // 'open' | 'create' | 'sync'
}
```

**Response (если проект существует):**
```javascript
{
  status: "success",
  monolith_project_id: "SO201",
  redirect_url: "/projects/SO201"
}
```

**Response (если нужно создать):**
```javascript
{
  status: "not_found",
  message: "Project not linked. Create new?",
  suggested_id: "SO201"
}
```

---

### 2. Создать проект в киоске из портала

**Endpoint:** `POST /api/portal/create-project`

**Request:**
```javascript
{
  portal_project_id: "proj_abc123",
  project_name: "Most Starý Rožmitál",
  object_type: "bridge",
  concrete_items: [  // Бетонные работы из CORE
    {
      description: "Betonáž základů C30/37",
      quantity: 45.0,
      unit: "m³",
      concrete_class: "C30/37",
      part_suggestion: "ZÁKLADY"
    }
  ]
}
```

**Response:**
```javascript
{
  status: "success",
  monolith_project_id: "SO201",
  parts_created: 5,
  positions_created: 35
}
```

---

### 3. Handshake (киоск → портал)

**Endpoint портала:** `POST /api/portal/kiosk-handshake`

**Request (от киоска Monolit):**
```javascript
{
  kiosk_type: "monolit",
  portal_project_id: "proj_abc123",
  monolith_project_id: "SO201",
  status: "opened",
  user_id: 123
}
```

**Response:**
```javascript
{
  status: "ack",
  portal_project_id: "proj_abc123",
  files: [
    {
      file_id: "file_def456",
      file_name: "VV_most.xlsx",
      file_type: "vv",
      download_url: "/api/portal/files/file_def456/download"
    }
  ],
  core_data: {
    core_project_id: "core_xyz789",
    status: "completed",
    audit_result: "GREEN"
  }
}
```

---

### 4. Запрос списка файлов проекта (киоск → портал)

**Endpoint портала:** `GET /api/portal/projects/{portal_project_id}/files`

**Request:**
```javascript
GET /api/portal/projects/proj_abc123/files
Authorization: Bearer jwt_token
```

**Response:**
```javascript
{
  status: "success",
  portal_project_id: "proj_abc123",
  files: [
    {
      file_id: "file_def456",
      file_name: "VV_most.xlsx",
      file_type: "vv",
      file_size: 125000,
      uploaded_at: "2025-11-15T10:30:00Z",
      download_url: "/api/portal/files/file_def456/download"
    }
  ]
}
```

---

## 📡 API Contract: PORTAL ↔ PUMP (Kiosk)

### Base URL
```
PUMP: https://pump.stavagent.com
```

### 1. Открыть киоск Pump

**Endpoint:** `GET /api/portal/open-project`

**Request:**
```javascript
GET /api/portal/open-project?portal_project_id=proj_abc123&token=jwt_token
```

**Response:**
```javascript
{
  status: "success",
  pump_project_id: "pump_12",
  redirect_url: "/projects/pump_12"
}
```

---

### 2. Создать расчет насоса

**Endpoint:** `POST /api/portal/create-calculation`

**Request:**
```javascript
{
  portal_project_id: "proj_abc123",
  concrete_volume_m3: 1350.0,
  distance_m: 250,
  pump_type: "stationary"  // 'stationary' | 'mobile'
}
```

**Response:**
```javascript
{
  status: "success",
  pump_project_id: "pump_12",
  calculation: {
    pump_hours: 13.5,
    shifts: 2,
    cost_czk: 45000
  }
}
```

---

## 🔄 Сценарии интеграции

### Сценарий 1: Загрузка документа и автозаполнение Monolit

```
1. [PORTAL] Пользователь загружает VV_most.xlsx
   POST /api/portal/projects/proj_abc123/files

2. [PORTAL] Отправляет файл в CORE
   POST https://concrete-agent.onrender.com/workflow-a/start
   {
     file: VV_most.xlsx,
     project_id: "proj_abc123",
     object_type: "bridge"
   }

3. [CORE] Парсит документ, возвращает:
   {
     core_project_id: "core_xyz789",
     positions: [...],
     concrete_items: [35 бетонных работ]
   }

4. [PORTAL] Сохраняет:
   - core_project_id в таблице portal_projects
   - Бетонные работы в кэш

5. [PORTAL] Пользователь нажимает "Открыть Monolit"

6. [PORTAL] Редирект на Monolit:
   https://monolit.stavagent.com/api/portal/open-project?
     portal_project_id=proj_abc123&
     token=jwt_xxx

7. [MONOLIT] Проверяет: есть ли проект SO201?
   - Если НЕТ → создает:
     POST /api/portal/create-project (обратно на портал)

8. [PORTAL] Возвращает бетонные работы:
   {
     concrete_items: [35 работ]
   }

9. [MONOLIT] Авто-заполняет таблицу:
   - Создает части: ZÁKLADY, OPĚRY, PILÍŘE, ...
   - Распределяет 35 бетонных работ по частям
   - Пользователь видит готовую таблицу

10. [MONOLIT] Пользователь корректирует вручную
```

---

### Сценарий 2: Открытие существующего проекта

```
1. [PORTAL] Пользователь нажимает "Открыть Monolit"

2. [PORTAL] Редирект:
   https://monolit.stavagent.com/api/portal/open-project?
     portal_project_id=proj_abc123&
     token=jwt_xxx

3. [MONOLIT] Проверяет: есть ли проект SO201?
   - Если ДА → открывает: /projects/SO201

4. [MONOLIT] Отправляет handshake:
   POST https://portal.stavagent.com/api/portal/kiosk-handshake
   {
     kiosk_type: "monolit",
     portal_project_id: "proj_abc123",
     monolith_project_id: "SO201",
     status: "opened"
   }

5. [PORTAL] Фиксирует: пользователь открыл киоск Monolit
```

---

### Сценарий 3: Запрос файлов из киоска

```
1. [MONOLIT] Пользователь в киоске нажимает "Показать файлы проекта"

2. [MONOLIT] Запрос к порталу:
   GET https://portal.stavagent.com/api/portal/projects/proj_abc123/files
   Authorization: Bearer jwt_token

3. [PORTAL] Возвращает список файлов:
   {
     files: [
       { file_id: "file_def456", file_name: "VV_most.xlsx", download_url: "..." }
     ]
   }

4. [MONOLIT] Показывает список пользователю
   Пользователь может скачать файл по download_url
```

---

## 🔒 Авторизация

### JWT Token

**Формат:** Bearer token в заголовке Authorization

```javascript
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Payload:**
```javascript
{
  userId: 123,
  email: "user@example.com",
  role: "user",
  iat: 1700000000,
  exp: 1700086400
}
```

### Передача токена киоску

**Вариант 1: Query parameter (для редиректа)**
```
https://monolit.stavagent.com/api/portal/open-project?
  portal_project_id=proj_abc123&
  token=jwt_xxx
```

**Вариант 2: Header (для API запросов)**
```javascript
fetch('https://portal.stavagent.com/api/portal/projects/proj_abc123/files', {
  headers: {
    'Authorization': 'Bearer jwt_xxx'
  }
})
```

---

## 🧪 Тесты на контракт

### Portal

```javascript
// test/contract/core-integration.test.js
describe('CORE Integration Contract', () => {
  it('should send correct format to /workflow-a/start', async () => {
    const request = {
      file: mockFile,
      project_id: "proj_abc123",  // ❌ WRONG! Should be portal_project_id
      object_type: "bridge"
    };

    // Validate against contract
    expect(request).toMatchContract('stavagent-contract.md#workflow-a-start');
  });
});
```

### Monolit

```javascript
// test/contract/portal-integration.test.js
describe('Portal Integration Contract', () => {
  it('should handle /api/portal/open-project correctly', async () => {
    const request = {
      portal_project_id: "proj_abc123",
      token: "jwt_xxx"
    };

    const response = await openProject(request);

    expect(response).toHaveProperty('monolith_project_id');
    expect(response.monolith_project_id).toMatch(/^SO\d+$/);
  });
});
```

### CORE

```javascript
// test/contract/workflow-a.test.py
def test_workflow_a_start_contract():
    """Test Workflow A start matches contract"""
    request = {
        "file": mock_file,
        "project_id": "proj_abc123",
        "object_type": "bridge"
    }

    response = workflow_a_start(request)

    assert "core_project_id" in response
    assert "concrete_items" in response
    assert all("structure_hint" in item for item in response["concrete_items"])
```

---

## 📝 Changelog

### Version 1.0.0 (2025-11-15)
- ✅ Initial contract
- ✅ PORTAL ↔ CORE API
- ✅ PORTAL ↔ MONOLIT API
- ✅ PORTAL ↔ PUMP API
- ✅ ID convention
- ✅ Auth flow
- ✅ Integration scenarios

---

## 🚨 Правила работы с контрактом

### 1. Этот файл - источник правды
- Любые изменения интеграции НАЧИНАЮТСЯ с обновления этого контракта
- После обновления контракта - обновить код во всех сервисах

### 2. Копии во всех репо
- `portal/docs/stavagent-contract.md`
- `core/docs/stavagent-contract.md`
- `kiosk-monolit/docs/stavagent-contract.md`
- `kiosk-pump/docs/stavagent-contract.md`

### 3. Перед коммитом
- Проверить что изменения не ломают существующую интеграцию
- Обновить версию контракта
- Добавить запись в Changelog

### 4. При работе с AI
- Всегда показывать AI этот файл
- Просить AI работать СТРОГО по контракту
- Не разрешать AI придумывать свои форматы

---

**Последнее обновление:** 2025-11-15
**Мейнтейнер:** StavAgent Team
**Вопросы:** См. репо stavagent-spec
