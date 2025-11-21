# API Reference

> Полная документация REST API для Concrete Agent

**Версия документа:** 2.0.0
**Последнее обновление:** 2025-01-26
**Версия API:** v2.0
**Поддержка:** Development Team

---

## Содержание

1. [Обзор](#обзор)
2. [Базовый URL и документация](#базовый-url-и-документация)
3. [Аутентификация](#аутентификация)
4. [Общие шаблоны](#общие-шаблоны)
5. [Основные Endpoints](#основные-endpoints)
6. [Workflow A Endpoints](#workflow-a-endpoints)
7. [Workflow B Endpoints](#workflow-b-endpoints)
8. [Chat Endpoints](#chat-endpoints)
9. [Agents Endpoints](#agents-endpoints)
10. [PDF Extraction Endpoints](#pdf-extraction-endpoints)
11. [Resource Endpoints](#resource-endpoints)
12. [Обработка ошибок](#обработка-ошибок)
13. [Примеры использования](#примеры-использования)

---

## Обзор

### Архитектура API

Concrete Agent предоставляет REST API на базе **FastAPI** для:

- **Управление проектами**: Создание, загрузка файлов, отслеживание статуса
- **Workflow A**: Импорт и аудит существующих ВВ (Выказ Выmер)
- **Workflow B**: Генерация позиций из строительных чертежей
- **Генерация артефактов**: Технологические карты, ведомости ресурсов, спецификации материалов
- **AI агенты**: Специализированные агенты для различных задач
- **Чат-интерфейс**: Интерактивное общение с AI

### Ключевые особенности

- ✅ **Async/Await**: Все endpoints асинхронные для высокой производительности
- ✅ **Pydantic валидация**: Автоматическая валидация запросов и ответов
- ✅ **OpenAPI/Swagger**: Автогенерируемая интерактивная документация
- ✅ **Загрузка файлов**: Поддержка multipart/form-data с потоковой передачей
- ✅ **Безопасность**: Защита от path traversal, лимиты размера файлов, проверка MIME

### Технологический стек

| Компонент | Технология |
|-----------|-----------|
| **Фреймворк** | FastAPI 0.115.0 |
| **Сервер** | Uvicorn (dev) / Gunicorn (prod) |
| **Валидация** | Pydantic 2.10.3 |
| **Обработка файлов** | aiofiles, python-multipart |
| **Документация** | OpenAPI 3.1 (Swagger UI) |

---

## Базовый URL и документация

### Разработка

```
http://localhost:8000
```

### Продакшн

```
https://your-domain.com
```

### Интерактивная документация

| URL | Описание |
|-----|----------|
| `/docs` | Swagger UI (интерактивный исследователь API) |
| `/redoc` | ReDoc (альтернативная документация) |
| `/openapi.json` | OpenAPI схема (JSON) |

---

## Аутентификация

### Текущий статус

**Аутентификация в данный момент не требуется** для API endpoints. Подходит для:
- Разработческих сред
- Внутренних развертываний за VPN/firewall
- Однопользовательских установок

### Будущая аутентификация (Roadmap)

Для production развертываний с множеством пользователей:

```python
# Будущее: Аутентификация по API ключу
headers = {
    "X-API-Key": "your-api-key-here"
}
```

**Best Practices безопасности:**
- Запуск за reverse proxy (nginx)
- Использование HTTPS в production
- Внедрение rate limiting
- Добавление API key аутентификации
- Настройка CORS

---

## Общие шаблоны

### Формат запроса/ответа

**Content-Type:** `application/json` (кроме загрузки файлов: `multipart/form-data`)

**Стандартная обертка ответа (APIResponse):**

```json
{
  "status": "success",
  "data": { ... },
  "meta": {
    "project_id": "proj_123",
    "timestamp": "2025-01-26T10:30:00Z"
  },
  "warning": null
}
```

**Ответ с ошибкой:**

```json
{
  "detail": "Описание ошибки",
  "status_code": 400
}
```

### HTTP статус коды

| Код | Значение | Когда используется |
|-----|----------|-------------------|
| `200` | OK | Успешный GET/POST/PUT |
| `201` | Created | Ресурс создан успешно |
| `400` | Bad Request | Неверные входные данные |
| `404` | Not Found | Ресурс не найден (проект, файл) |
| `422` | Unprocessable Entity | Ошибка валидации Pydantic |
| `500` | Internal Server Error | Серверная ошибка |

### Лимиты размера файлов

- **Максимальный размер файла**: 50 MB
- **Разрешенные расширения**: См. раздел [загрузка файлов](#post-apiupload)

---

## Основные Endpoints

### GET /

**Описание:** Health check endpoint - проверка состояния системы

**Параметры:** Нет

**Пример запроса:**

```http
GET / HTTP/1.1
Host: localhost:8000
```

**Пример ответа:**

```json
{
  "service": "Czech Building Audit System",
  "status": "running",
  "version": "2.0.0",
  "features": {
    "workflow_a": true,
    "workflow_b": true,
    "drawing_enrichment": true,
    "csn_validation": true
  }
}
```

**Возможные ошибки:**

| Код | Причина | Решение |
|-----|---------|---------|
| `500` | Сервер не запущен | Проверить логи, перезапустить сервер |

**curl пример:**

```bash
curl http://localhost:8000/
```

**Python пример:**

```python
import requests

response = requests.get("http://localhost:8000/")
print(response.json())
```

---

### POST /api/upload

**Описание:** Загрузка нового проекта с файлами для обработки

**Content-Type:** `multipart/form-data`

**Параметры формы:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `project_name` | string | ✅ Да | Название проекта |
| `workflow` | string | ✅ Да | Тип workflow: `"A"` или `"B"` |
| `vykaz_vymer` | file | Для Workflow A | Файл ВВ (XML, XLSX, PDF, CSV) |
| `vykresy` | file[] | Для Workflow B | Чертежи (PDF, DWG, images) |
| `rozpocet` | file | ❌ Нет | Смета с ценами (опционально) |
| `dokumentace` | file[] | ❌ Нет | Проектная документация |
| `zmeny` | file[] | ❌ Нет | Изменения и дополнения |
| `generate_summary` | bool | ❌ Нет | Генерировать сводку (default: true) |
| `auto_start_audit` | bool | ❌ Нет | Автоматически запустить аудит (default: true) |
| `enable_enrichment` | bool | ❌ Нет | Включить обогащение позиций (default: true) |

**Разрешенные расширения файлов:**

- **vykaz_vymer**: `.xml`, `.xlsx`, `.xls`, `.pdf`, `.csv`
- **vykresy**: `.pdf`, `.dwg`, `.dxf`, `.png`, `.jpg`, `.jpeg`, `.txt`
- **dokumentace**: `.pdf`, `.doc`, `.docx`, `.xlsx`, `.xls`, `.txt`, `.csv`

**Пример запроса (Workflow A):**

```http
POST /api/upload HTTP/1.1
Host: localhost:8000
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="project_name"

Bytový dům Vinohrady
------WebKitFormBoundary
Content-Disposition: form-data; name="workflow"

A
------WebKitFormBoundary
Content-Disposition: form-data; name="vykaz_vymer"; filename="rozpocet.xlsx"
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

[binary data]
------WebKitFormBoundary--
```

**Пример ответа (успех):**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "message": "Project created successfully",
  "workflow_type": "A",
  "status": "processing",
  "project_name": "Bytový dům Vinohrady",
  "created_at": "2025-01-26T10:30:00.123456",
  "files": {
    "vykaz_vymer": {
      "file_id": "proj_1706265000_abc123:vykaz_vymer:rozpocet.xlsx",
      "filename": "rozpocet.xlsx",
      "file_type": "vykaz_vymer",
      "size": 45632,
      "uploaded_at": "2025-01-26T10:30:00.123456"
    }
  }
}
```

**Возможные ошибки:**

| Код | Причина | Сообщение | Решение |
|-----|---------|-----------|---------|
| `400` | Неверный workflow | `"workflow must be 'A' or 'B'"` | Указать `workflow=A` или `workflow=B` |
| `400` | Отсутствует файл ВВ | `"Workflow A requires vykaz_vymer file"` | Добавить файл `vykaz_vymer` |
| `400` | Отсутствуют чертежи | `"Workflow B requires vykresy files"` | Добавить файлы `vykresy` |
| `400` | Файл слишком большой | `"File exceeds 50MB limit"` | Уменьшить размер файла |
| `400` | Неверное имя файла | `"Invalid filename"` | Использовать безопасное имя файла |
| `403` | Workflow отключен | `"Workflow A is disabled"` | Включить в настройках: `ENABLE_WORKFLOW_A=true` |
| `500` | Ошибка сохранения | `"Failed to save file"` | Проверить права доступа к `data/` |

**curl пример:**

```bash
curl -X POST "http://localhost:8000/api/upload" \
  -F "project_name=Bytový dům Vinohrady" \
  -F "workflow=A" \
  -F "vykaz_vymer=@rozpocet.xlsx"
```

**Python пример:**

```python
import requests

url = "http://localhost:8000/api/upload"

files = {
    "vykaz_vymer": open("rozpocet.xlsx", "rb")
}

data = {
    "project_name": "Bytový dům Vinohrady",
    "workflow": "A",
    "auto_start_audit": "true"
}

response = requests.post(url, files=files, data=data)
result = response.json()

print(f"Project ID: {result['project_id']}")
print(f"Status: {result['status']}")
```

**Связанные ссылки:**
- [WORKFLOWS.md - Workflow A](WORKFLOWS.md#workflow-a-import--audit)
- [SYSTEM_DESIGN.md - Upload Flow](SYSTEM_DESIGN.md#file-upload-flow)

---

### GET /api/projects/{project_id}/status

**Описание:** Получить текущий статус и метаданные проекта

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `project_id` | string | Идентификатор проекта |

**Пример запроса:**

```http
GET /api/projects/proj_1706265000_abc123/status HTTP/1.1
Host: localhost:8000
```

**Пример ответа:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "data": {
    "project_name": "Bytový dům Vinohrady",
    "workflow_type": "A",
    "status": "completed",
    "created_at": "2025-01-26T10:30:00.123456",
    "updated_at": "2025-01-26T10:35:00.987654",
    "completed_at": "2025-01-26T10:35:00.987654",
    "progress": 100,
    "message": "Workflow A processing completed successfully",
    "total_positions": 53,
    "positions_processed": 53,
    "green_count": 48,
    "amber_count": 3,
    "red_count": 2,
    "files": {
      "vykaz_vymer": {
        "filename": "rozpocet.xlsx",
        "size": 45632,
        "uploaded_at": "2025-01-26T10:30:00.123456"
      }
    },
    "artifacts": {
      "parsed_positions": {
        "path": "/data/processed/proj_.../parsed_positions.json",
        "type": "parsed_positions",
        "updated_at": "2025-01-26T10:32:00Z"
      },
      "audit_results": {
        "path": "/data/processed/proj_.../audit_results.json",
        "type": "audit_results",
        "updated_at": "2025-01-26T10:35:00Z"
      }
    }
  }
}
```

**Возможные статусы:**

| Статус | Описание |
|--------|----------|
| `uploaded` | Файлы загружены, обработка не началась |
| `processing` | Workflow выполняется |
| `completed` | Workflow завершен успешно |
| `failed` | Workflow завершился с ошибкой |
| `archived` | Проект заархивирован |

**Возможные ошибки:**

| Код | Причина | Решение |
|-----|---------|---------|
| `404` | Проект не найден | Проверить правильность `project_id` |

**curl пример:**

```bash
curl http://localhost:8000/api/projects/proj_1706265000_abc123/status
```

---

### GET /api/projects/{project_id}/results

**Описание:** Получить результаты аудита проекта

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `project_id` | string | Идентификатор проекта |

**Пример запроса:**

```http
GET /api/projects/proj_1706265000_abc123/results HTTP/1.1
```

**Пример ответа:**

```json
{
  "project_id": "proj_1706265000_abc123",
  "project_name": "Bytový dům Vinohrady",
  "status": "completed",
  "workflow_type": "A",
  "results": {
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
          "evidence": [
            "✅ Exact KROS match: 121151113",
            "✅ Price within 5% of database average"
          ]
        }
      }
    ],
    "statistics": {
      "total": 53,
      "green": 48,
      "amber": 3,
      "red": 2,
      "avg_confidence": 0.92
    }
  },
  "updated_at": "2025-01-26T10:35:00Z"
}
```

**Возможные ошибки:**

| Код | Причина | Решение |
|-----|---------|---------|
| `404` | Проект не найден | Проверить `project_id` |
| `404` | Результаты не готовы | Дождаться завершения обработки |

---

### GET /api/projects

**Описание:** Получить список всех проектов

**Параметры запроса:** Нет (пагинация - в будущем)

**Пример запроса:**

```http
GET /api/projects HTTP/1.1
```

**Пример ответа:**

```json
{
  "projects": [
    {
      "project_id": "proj_1706265000_abc123",
      "project_name": "Bytový dům Vinohrady",
      "workflow_type": "A",
      "status": "completed",
      "created_at": "2025-01-26T10:30:00.123456",
      "total_positions": 53
    },
    {
      "project_id": "proj_1706265100_def456",
      "project_name": "Most přes řeku",
      "workflow_type": "B",
      "status": "processing",
      "created_at": "2025-01-26T11:00:00.987654",
      "total_positions": 0
    }
  ],
  "total": 2
}
```

---

### GET /api/projects/{project_id}/files

**Описание:** Получить список всех файлов проекта

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `project_id` | string | Идентификатор проекта |

**Пример ответа:**

```json
{
  "project_id": "proj_1706265000_abc123",
  "files": {
    "vykaz_vymer": {
      "file_id": "proj_1706265000_abc123:vykaz_vymer:rozpocet.xlsx",
      "filename": "rozpocet.xlsx",
      "file_type": "vykaz_vymer",
      "size": 45632,
      "uploaded_at": "2025-01-26T10:30:00.123456"
    }
  }
}
```

---

### GET /api/projects/{project_id}/files/{file_id}/download

**Описание:** Скачать файл проекта

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `project_id` | string | Идентификатор проекта |
| `file_id` | string | Идентификатор файла |

**Пример запроса:**

```http
GET /api/projects/proj_123/files/vykaz_vymer:rozpocet.xlsx/download HTTP/1.1
```

**Ответ:** Файловый поток (Content-Type зависит от расширения файла)

**curl пример:**

```bash
curl -O http://localhost:8000/api/projects/proj_123/files/vykaz_vymer:rozpocet.xlsx/download
```

---

### GET /api/projects/{project_id}/export/excel

**Описание:** Экспортировать результаты аудита в Excel

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `project_id` | string | Идентификатор проекта |

**Пример запроса:**

```http
GET /api/projects/proj_1706265000_abc123/export/excel HTTP/1.1
```

**Ответ:** Excel файл (.xlsx) с результатами аудита

**Структура Excel файла:**

| Лист | Содержимое |
|------|-----------|
| **Summary** | Общая статистика, подсчеты GREEN/AMBER/RED |
| **All Positions** | Полный список с результатами аудита |
| **GREEN** | Одобренные позиции |
| **AMBER** | Позиции, требующие проверки |
| **RED** | Отклоненные позиции |

**curl пример:**

```bash
curl -O http://localhost:8000/api/projects/proj_123/export/excel
```

---

### GET /api/health

**Описание:** Расширенная проверка здоровья системы

**Пример ответа:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T10:30:00Z",
  "services": {
    "api": "up",
    "database": "up",
    "ai_providers": {
      "claude": "available",
      "gpt4": "available"
    }
  }
}
```

---

## Workflow A Endpoints

**Базовый префикс:** `/api/workflow/a`

**Описание:** Endpoints для работы с Workflow A (импорт и аудит ВВ)

### GET /api/workflow/a/positions

**Описание:** Получить список всех обработанных позиций проекта

**Параметры запроса:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `project_id` | string | ✅ Да | Идентификатор проекта |

**Пример запроса:**

```http
GET /api/workflow/a/positions?project_id=proj_123 HTTP/1.1
```

**Пример ответа:**

```json
{
  "status": "success",
  "data": {
    "items": [
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
        "validation_status": "passed",
        "enrichment_status": "matched",
        "audit": {
          "status": "approved",
          "roles": ["SME", "ENG", "ARCH"],
          "consensus": "unanimous",
          "evidence": [
            "✅ Exact KROS match: 121151113",
            "✅ Price within 5% of database average (2480 CZK/m3)",
            "✅ Complies with ČSN EN 206-1"
          ],
          "recommendations": []
        },
        "enrichment": {
          "kros_code": "121151113",
          "kros_name": "Beton prostý C 25/30",
          "unit_price_kros": 2480.0,
          "applicable_norms": ["ČSN EN 206-1", "ČSN 73 1201"],
          "match_type": "exact"
        }
      }
    ],
    "count": 53
  },
  "meta": {
    "project_id": "proj_123",
    "project_name": "Bytový dům Vinohrady",
    "count": 53
  }
}
```

**Возможные ошибки:**

| Код | Причина | Решение |
|-----|---------|---------|
| `404` | Проект не найден | Проверить `project_id` |
| `200` (warning) | Позиции еще не обработаны | Дождаться завершения парсинга |

**curl пример:**

```bash
curl "http://localhost:8000/api/workflow/a/positions?project_id=proj_123"
```

**Связанные ссылки:**
- [WORKFLOWS.md - Workflow A Step 4](WORKFLOWS.md#step-4-review-audit-results)

---

### POST /api/workflow/a/tech-card

**Описание:** Сгенерировать или получить технологическую карту для позиции

**Request Body:**

```json
{
  "project_id": "proj_123",
  "position_id": "1",
  "action": "tech_card"
}
```

**Параметры тела запроса:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `project_id` | string | ✅ Да | Идентификатор проекта |
| `position_id` | string | ✅ Да | Идентификатор позиции |
| `action` | string | ❌ Нет | Тип действия (default: "tech_card") |

**Пример запроса:**

```http
POST /api/workflow/a/tech-card HTTP/1.1
Content-Type: application/json

{
  "project_id": "proj_123",
  "position_id": "1"
}
```

**Пример ответа:**

```json
{
  "status": "success",
  "data": {
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
          },
          {
            "step_num": 3,
            "title": "Ošetřování",
            "description": "Ošetřování betonu",
            "duration_minutes": 30,
            "workers": 1
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
            "unit": "m3",
            "specifications": {
              "strength_class": "C 25/30",
              "consistency": "S3",
              "max_aggregate_size": "16mm"
            }
          }
        ],
        "safety_requirements": [
          "Ochranné pracovní pomůcky (helma, rukavice)",
          "Zabezpečení pracoviště",
          "Školení pracovníků"
        ]
      },
      "metadata": {
        "generated_at": "2025-01-26T10:35:00Z",
        "source": "workflow_a_audit"
      }
    }
  },
  "meta": {
    "project_id": "proj_123",
    "project_name": "Bytový dům Vinohrady",
    "position_id": "1",
    "source": "cache"
  }
}
```

**Возможные ошибки:**

| Код | Причина | Решение |
|-----|---------|---------|
| `404` | Проект не найден | Проверить `project_id` |
| `404` | Позиция не найдена | Проверить `position_id` |
| `200` (warning) | Результаты аудита не готовы | Дождаться завершения аудита |

**curl пример:**

```bash
curl -X POST "http://localhost:8000/api/workflow/a/tech-card" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_123",
    "position_id": "1"
  }'
```

**Python пример:**

```python
import requests

url = "http://localhost:8000/api/workflow/a/tech-card"

payload = {
    "project_id": "proj_123",
    "position_id": "1"
}

response = requests.post(url, json=payload)
tech_card = response.json()["data"]["artifact"]

print(f"Title: {tech_card['title']}")
print(f"Steps: {len(tech_card['data']['steps'])}")
```

**Связанные ссылки:**
- [WORKFLOWS.md - Generate Tech Card](WORKFLOWS.md#tech-card-technologická-karta)

---

### POST /api/workflow/a/resource-sheet

**Описание:** Сгенерировать или получить ведомость ресурсов (TOV) для позиции

**Request Body:**

```json
{
  "project_id": "proj_123",
  "position_id": "1",
  "action": "resource_sheet"
}
```

**Пример ответа:**

```json
{
  "status": "success",
  "data": {
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
              "hours": 10.0,
              "rate_per_hour": 350.0
            },
            {
              "trade": "Pomocník",
              "workers": 2,
              "hours": 2.5,
              "rate_per_hour": 200.0
            }
          ]
        },
        "equipment": {
          "items": [
            {
              "name": "Autodomíchávač",
              "quantity": 1,
              "hours": 2.0,
              "rate_per_hour": 1500.0
            },
            {
              "name": "Vibrátory",
              "quantity": 2,
              "hours": 3.0,
              "rate_per_hour": 150.0
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
  },
  "meta": {
    "project_id": "proj_123",
    "project_name": "Bytový dům Vinohrady",
    "position_id": "1",
    "source": "generated"
  }
}
```

**curl пример:**

```bash
curl -X POST "http://localhost:8000/api/workflow/a/resource-sheet" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "proj_123", "position_id": "1"}'
```

**Связанные ссылки:**
- [WORKFLOWS.md - Generate Resource Sheet](WORKFLOWS.md#resource-sheet-tov)

---

### POST /api/workflow/a/materials

**Описание:** Сгенерировать или получить детальную спецификацию материалов для позиции

**Request Body:**

```json
{
  "project_id": "proj_123",
  "position_id": "1",
  "action": "materials"
}
```

**Пример ответа:**

```json
{
  "status": "success",
  "data": {
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
              "max_aggregate_size": "16mm",
              "exposure_class": "XC1"
            },
            "suppliers": [
              {
                "name": "Betonárna Praha",
                "unit_price": 2500.0,
                "delivery_time": "2 days"
              }
            ]
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
}
```

**curl пример:**

```bash
curl -X POST "http://localhost:8000/api/workflow/a/materials" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "proj_123", "position_id": "1"}'
```

---

### POST /api/workflow/a/enrich

**Описание:** Обогатить позицию полной технической информацией (материалы, нормы, поставщики, трудозатраты, оборудование)

**Request Body:**

```json
{
  "project_id": "proj_123",
  "position_id": "1",
  "include_claude_analysis": true
}
```

**Параметры тела запроса:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `project_id` | string | ✅ Да | Идентификатор проекта |
| `position_id` | string | ✅ Да | Идентификатор позиции |
| `include_claude_analysis` | bool | ❌ Нет | Включить анализ Claude AI (default: false) |

**Что добавляет обогащение:**

- ✅ Материалы и их характеристики
- ✅ Применимые нормы (ČSN, TKP)
- ✅ Поставщики и ориентировочные цены
- ✅ Трудозатраты (labor hours, workers)
- ✅ Необходимое оборудование
- ✅ Claude анализ (опционально)

**Пример ответа:**

```json
{
  "status": "success",
  "data": {
    "enriched_position": {
      "id": "1",
      "code": "121151113",
      "description": "Beton C 25/30",
      "unit": "m3",
      "quantity": 10.5,
      "enrichment_status": "matched",
      "enrichment": {
        "confidence": 0.95,
        "match_type": "exact",
        "kros_code": "121151113",
        "kros_name": "Beton prostý C 25/30",
        "materials": [
          {
            "name": "Beton C 25/30",
            "specifications": {
              "strength_class": "C 25/30",
              "consistency": "S3"
            }
          }
        ],
        "applicable_norms": [
          "ČSN EN 206-1",
          "ČSN 73 1201"
        ],
        "suppliers": [
          {
            "name": "Betonárna Praha",
            "unit_price": 2500.0,
            "contact": "+420 123 456 789"
          }
        ],
        "labor": {
          "total_hours": 12.5,
          "workers_required": 4
        },
        "equipment": [
          {
            "name": "Autodomíchávač",
            "quantity": 1
          }
        ],
        "claude_analysis": {
          "confidence": 0.97,
          "reasoning": "Exact match found in KROS database. All technical parameters validated.",
          "recommendations": []
        }
      }
    }
  },
  "meta": {
    "project_id": "proj_123",
    "project_name": "Bytový dům Vinohrady",
    "position_id": "1",
    "confidence": 0.95,
    "warnings": []
  }
}
```

**Возможные ошибки:**

| Код | Причина | Решение |
|-----|---------|---------|
| `404` | Проект не найден | Проверить `project_id` |
| `404` | Позиция не найдена | Проверить `position_id` |
| `200` (warning) | Результаты аудита не готовы | Дождаться завершения аудита |
| `500` | Ошибка AI анализа | Проверить API ключи Claude |

**curl пример:**

```bash
curl -X POST "http://localhost:8000/api/workflow/a/enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_123",
    "position_id": "1",
    "include_claude_analysis": true
  }'
```

---

## Workflow B Endpoints

**Базовый префикс:** `/api/workflow/b`

**Описание:** Endpoints для работы с Workflow B (генерация позиций из чертежей)

### GET /api/workflow/b/positions

**Описание:** Получить список позиций, сгенерированных из чертежей

**Параметры запроса:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `project_id` | string | ✅ Да | Идентификатор проекта |

**Пример запроса:**

```http
GET /api/workflow/b/positions?project_id=proj_456 HTTP/1.1
```

**Пример ответа:**

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "gen_1",
        "code": "121151113",
        "description": "Beton C 25/30 - základová deska",
        "unit": "m3",
        "quantity": 15.75,
        "source_drawing": "floor_plan.pdf",
        "page": 2,
        "confidence": 0.88,
        "ai_reasoning": "Detected foundation slab: 450cm × 350cm × 10cm = 15.75 m3",
        "calculation": {
          "length": 4.5,
          "width": 3.5,
          "depth": 0.1,
          "formula": "length × width × depth",
          "result": 15.75
        },
        "extracted_from": {
          "drawing": "floor_plan.pdf",
          "page": 2,
          "coordinates": {
            "x": 120,
            "y": 450
          }
        }
      }
    ],
    "count": 27
  },
  "meta": {
    "project_id": "proj_456",
    "project_name": "Most přes řeku",
    "count": 27,
    "drawings_analyzed": 3,
    "avg_confidence": 0.85
  }
}
```

**curl пример:**

```bash
curl "http://localhost:8000/api/workflow/b/positions?project_id=proj_456"
```

**Связанные ссылки:**
- [WORKFLOWS.md - Workflow B Step 4](WORKFLOWS.md#step-4-review-generated-positions)

---

### POST /api/workflow/b/tech-card

**Описание:** Сгенерировать технологическую карту для позиции из Workflow B

**Request Body:** Аналогично Workflow A

```json
{
  "project_id": "proj_456",
  "position_id": "gen_1",
  "action": "tech_card"
}
```

**Пример ответа:** Аналогично Workflow A

---

### POST /api/workflow/b/resource-sheet

**Описание:** Сгенерировать ведомость ресурсов для позиции из Workflow B

**Request Body:** Аналогично Workflow A

```json
{
  "project_id": "proj_456",
  "position_id": "gen_1",
  "action": "resource_sheet"
}
```

**Пример ответа:** Аналогично Workflow A

---

## Chat Endpoints

**Базовый префикс:** `/api/chat`

**Описание:** Интерактивный чат-интерфейс с AI агентами

### POST /api/chat/message

**Описание:** Отправить сообщение в чат и получить ответ от AI

**Request Body:**

```json
{
  "message": "Проанализируй проект proj_123",
  "project_id": "proj_123",
  "context": {
    "previous_messages": []
  }
}
```

**Параметры тела запроса:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `message` | string | ✅ Да | Сообщение пользователя |
| `project_id` | string | ❌ Нет | Идентификатор текущего проекта |
| `context` | object | ❌ Нет | Контекст разговора |

**Пример ответа:**

```json
{
  "response": "Проект 'Bytový dům Vinohrady' успешно обработан. Найдено 53 позиции: 48 GREEN, 3 AMBER, 2 RED. Хотите посмотреть детали по критическим позициям?",
  "data": {
    "project_summary": {
      "total": 53,
      "green": 48,
      "amber": 3,
      "red": 2
    }
  },
  "suggested_actions": [
    {
      "action": "view_red_positions",
      "label": "Показать RED позиции"
    },
    {
      "action": "export_excel",
      "label": "Экспортировать в Excel"
    }
  ]
}
```

**curl пример:**

```bash
curl -X POST "http://localhost:8000/api/chat/message" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Проанализируй проект proj_123",
    "project_id": "proj_123"
  }'
```

---

### POST /api/chat/action

**Описание:** Выполнить действие, предложенное чатом

**Request Body:**

```json
{
  "action": "view_red_positions",
  "project_id": "proj_123",
  "parameters": {}
}
```

**Пример ответа:**

```json
{
  "response": "Найдено 2 RED позиции:",
  "data": {
    "positions": [
      {
        "code": "999999999",
        "description": "Custom material XYZ",
        "issue": "Code not found in KROS database"
      }
    ]
  }
}
```

---

### POST /api/chat/projects

**Описание:** Получить список проектов через чат-интерфейс

**Request Body:**

```json
{
  "filter": "active"
}
```

**Пример ответа:**

```json
{
  "projects": [
    {
      "project_id": "proj_123",
      "project_name": "Bytový dům Vinohrady",
      "status": "completed"
    }
  ]
}
```

---

### POST /api/chat/enrich

**Описание:** Запросить обогащение позиции через чат

**Request Body:**

```json
{
  "project_id": "proj_123",
  "position_id": "1",
  "enrichment_type": "full"
}
```

---

## Agents Endpoints

**Базовый префикс:** `/api/agents`

**Описание:** Управление AI агентами и их выполнение

### GET /api/agents/agents

**Описание:** Получить список доступных AI агентов

**Пример запроса:**

```http
GET /api/agents/agents HTTP/1.1
```

**Пример ответа:**

```json
{
  "agents": [
    {
      "id": "tzd_reader",
      "name": "Technical Drawing Reader",
      "description": "Extracts information from technical drawings (PDF, DWG)",
      "status": "available",
      "capabilities": [
        "pdf_extraction",
        "drawing_analysis",
        "dimension_detection",
        "material_identification"
      ],
      "version": "1.0.0"
    },
    {
      "id": "boq_parser",
      "name": "Bill of Quantities Parser",
      "description": "Parses BOQ/estimate files (Excel, PDF, XML)",
      "status": "available",
      "capabilities": [
        "excel_parsing",
        "position_extraction",
        "quantity_calculation",
        "unit_normalization"
      ],
      "version": "1.0.0"
    },
    {
      "id": "csn_validator",
      "name": "ČSN Standards Validator",
      "description": "Validates positions against ČSN standards",
      "status": "available",
      "capabilities": [
        "norm_validation",
        "code_verification",
        "unit_checking"
      ],
      "version": "1.0.0"
    },
    {
      "id": "enrichment_agent",
      "name": "Position Enrichment Agent",
      "description": "Enriches positions with materials, suppliers, resources",
      "status": "available",
      "capabilities": [
        "material_enrichment",
        "supplier_search",
        "resource_calculation",
        "norm_lookup"
      ],
      "version": "1.0.0"
    }
  ]
}
```

**curl пример:**

```bash
curl http://localhost:8000/api/agents/agents
```

---

### POST /api/agents/execute

**Описание:** Запустить выполнение AI агента

**Request Body:**

```json
{
  "agent_id": "tzd_reader",
  "project_id": "proj_456",
  "input_data": {
    "drawing_path": "/path/to/floor_plan.pdf"
  },
  "options": {
    "extract_dimensions": true,
    "identify_materials": true
  }
}
```

**Параметры тела запроса:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `agent_id` | string | ✅ Да | ID агента для запуска |
| `project_id` | string | ❌ Нет | ID проекта (если применимо) |
| `input_data` | object | ❌ Нет | Входные данные для агента |
| `options` | object | ❌ Нет | Опции выполнения |

**Пример ответа:**

```json
{
  "execution_id": "exec_789xyz",
  "agent_id": "tzd_reader",
  "status": "running",
  "started_at": "2025-01-26T10:40:00Z",
  "completed_at": null,
  "result": null,
  "error": null
}
```

**curl пример:**

```bash
curl -X POST "http://localhost:8000/api/agents/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "tzd_reader",
    "project_id": "proj_456",
    "input_data": {
      "drawing_path": "/path/to/floor_plan.pdf"
    }
  }'
```

---

### GET /api/agents/status/{execution_id}

**Описание:** Проверить статус выполнения агента

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `execution_id` | string | ID выполнения агента |

**Пример запроса:**

```http
GET /api/agents/status/exec_789xyz HTTP/1.1
```

**Пример ответа (в процессе):**

```json
{
  "execution_id": "exec_789xyz",
  "agent_id": "tzd_reader",
  "status": "running",
  "started_at": "2025-01-26T10:40:00Z",
  "completed_at": null,
  "result": null,
  "error": null
}
```

**Пример ответа (завершен):**

```json
{
  "execution_id": "exec_789xyz",
  "agent_id": "tzd_reader",
  "status": "completed",
  "started_at": "2025-01-26T10:40:00Z",
  "completed_at": "2025-01-26T10:42:00Z",
  "result": {
    "dimensions_extracted": 15,
    "materials_identified": 8,
    "positions_generated": 12
  },
  "error": null
}
```

**Возможные статусы:**

| Статус | Описание |
|--------|----------|
| `queued` | Задача в очереди |
| `running` | Агент выполняется |
| `completed` | Выполнение завершено успешно |
| `failed` | Выполнение завершилось с ошибкой |

**curl пример:**

```bash
curl http://localhost:8000/api/agents/status/exec_789xyz
```

---

## PDF Extraction Endpoints

**Базовый префикс:** `/api/pdf`

**Описание:** Специализированные endpoints для извлечения данных из PDF

### POST /api/pdf/extract-full

**Описание:** Запустить полный pipeline извлечения данных из PDF документа

**Content-Type:** `multipart/form-data`

**Параметры:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `pdf_file` | file | ✅ Да | PDF документ для обработки |
| `project_id` | string (query) | ✅ Да | Идентификатор проекта |
| `use_ocr` | bool (query) | ❌ Нет | Включить OCR для закодированных страниц (default: true) |

**Пример запроса:**

```http
POST /api/pdf/extract-full?project_id=proj_123&use_ocr=true HTTP/1.1
Content-Type: multipart/form-data

[PDF file data]
```

**Пример ответа:**

```json
{
  "success": true,
  "project_id": "proj_123",
  "filename": "rozpocet.pdf",
  "pages_processed": 5,
  "ocr_pages": 2,
  "extracted_data": {
    "positions": [
      {
        "code": "121151113",
        "description": "Beton C 25/30",
        "quantity": 10.5,
        "unit": "m3",
        "page": 3
      }
    ],
    "total_positions": 47
  },
  "processing_time_seconds": 12.5
}
```

**Возможные ошибки:**

| Код | Причина | Решение |
|-----|---------|---------|
| `400` | Не PDF файл | Загрузить PDF файл |
| `400` | Файл пустой | Проверить файл |
| `500` | Ошибка извлечения | Проверить формат PDF, попробовать с `use_ocr=true` |

**curl пример:**

```bash
curl -X POST "http://localhost:8000/api/pdf/extract-full?project_id=proj_123&use_ocr=true" \
  -F "pdf_file=@rozpocet.pdf"
```

**Python пример:**

```python
import requests

url = "http://localhost:8000/api/pdf/extract-full"

files = {
    "pdf_file": open("rozpocet.pdf", "rb")
}

params = {
    "project_id": "proj_123",
    "use_ocr": "true"
}

response = requests.post(url, files=files, params=params)
result = response.json()

print(f"Pages processed: {result['pages_processed']}")
print(f"Positions extracted: {result['extracted_data']['total_positions']}")
```

**Связанные ссылки:**
- [SYSTEM_DESIGN.md - PDF Processing](SYSTEM_DESIGN.md#pdf-processing-pipeline)

---

## Resource Endpoints

**Базовый префикс:** `/api/resource`

### GET /api/resource/calc

**Описание:** Демо endpoint для расчетных операций (планируется расширение функционала)

**Пример запроса:**

```http
GET /api/resource/calc HTTP/1.1
```

**Пример ответа:**

```json
{
  "message": "Resource calculation endpoint"
}
```

**Примечание:** Этот endpoint является демонстрационным и будет расширен в будущих версиях для расчета трудозатрат, материалов и оборудования.

---

## Обработка ошибок

### Формат ошибки

Все ошибки возвращаются в стандартном формате FastAPI:

```json
{
  "detail": "Детальное описание ошибки",
  "status_code": 400
}
```

### Типичные ошибки

#### 400 Bad Request

**Причина:** Неверные входные данные

**Примеры:**

```json
{
  "detail": "Invalid filename",
  "status_code": 400
}
```

```json
{
  "detail": "File exceeds 50MB limit",
  "status_code": 400
}
```

**Решение:**
- Проверить формат входных данных
- Убедиться, что все обязательные поля заполнены
- Проверить размер файла

---

#### 404 Not Found

**Причина:** Ресурс не найден

**Примеры:**

```json
{
  "detail": "Project proj_nonexistent not found",
  "status_code": 404
}
```

```json
{
  "detail": "Position pos_999 not found in audit results",
  "status_code": 404
}
```

**Решение:**
- Проверить правильность `project_id`
- Убедиться, что проект существует (`GET /api/projects`)
- Проверить, что обработка завершена

---

#### 422 Unprocessable Entity

**Причина:** Ошибка валидации Pydantic

**Пример:**

```json
{
  "detail": [
    {
      "loc": ["body", "project_id"],
      "msg": "field required",
      "type": "value_error.missing"
    },
    {
      "loc": ["body", "position_id"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Решение:**
- Добавить все обязательные поля в request body
- Проверить типы данных (string, int, bool)

---

#### 500 Internal Server Error

**Причина:** Серверная ошибка (парсинг, AI API, файловая система)

**Примеры:**

```json
{
  "detail": "Failed to parse XML: Invalid UNIXML format",
  "status_code": 500
}
```

```json
{
  "detail": "Claude API error: Rate limit exceeded",
  "status_code": 500
}
```

**Решение:**
- Проверить логи сервера (`logs/app.log`)
- Проверить формат файла
- Убедиться, что API ключи настроены (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)
- Проверить лимиты AI провайдеров

---

### Отладка ошибок

**1. Включить подробное логирование:**

```bash
# В .env
LOG_LEVEL=DEBUG
ENABLE_DETAILED_LOGGING=true
```

**2. Проверить логи:**

```bash
tail -f logs/app.log
```

**3. Использовать интерактивную документацию:**

Откройте `http://localhost:8000/docs` и протестируйте endpoints в Swagger UI

---

## Примеры использования

### Полный цикл Workflow A (Python)

```python
#!/usr/bin/env python3
"""
Полный цикл Workflow A: загрузка → обработка → получение результатов → экспорт
"""
import requests
from pathlib import Path
import time

BASE_URL = "http://localhost:8000"

def complete_workflow_a(boq_file: Path, project_name: str):
    """Выполнить полный Workflow A"""

    # Шаг 1: Загрузка проекта
    print(f"[1/5] Загрузка проекта '{project_name}'...")

    url = f"{BASE_URL}/api/upload"
    files = {"vykaz_vymer": open(boq_file, "rb")}
    data = {
        "project_name": project_name,
        "workflow": "A",
        "auto_start_audit": "true"
    }

    response = requests.post(url, files=files, data=data)
    response.raise_for_status()

    result = response.json()
    project_id = result["project_id"]
    print(f"✅ Проект создан: {project_id}")

    # Шаг 2: Ожидание завершения обработки
    print(f"\n[2/5] Ожидание завершения обработки...")

    url = f"{BASE_URL}/api/projects/{project_id}/status"

    while True:
        response = requests.get(url)
        status_data = response.json()
        status = status_data["data"]["status"]

        if status == "completed":
            print(f"✅ Обработка завершена")
            break
        elif status == "failed":
            error = status_data["data"].get("error", "Unknown error")
            raise RuntimeError(f"Workflow failed: {error}")
        else:
            print(f"   Статус: {status}...")
            time.sleep(3)

    # Шаг 3: Получение позиций
    print(f"\n[3/5] Получение позиций...")

    url = f"{BASE_URL}/api/workflow/a/positions?project_id={project_id}"
    response = requests.get(url)
    response.raise_for_status()

    positions = response.json()["data"]["items"]
    print(f"✅ Получено {len(positions)} позиций")

    # Статистика по классификации
    green = sum(1 for p in positions if p["classification"] == "GREEN")
    amber = sum(1 for p in positions if p["classification"] == "AMBER")
    red = sum(1 for p in positions if p["classification"] == "RED")

    print(f"   GREEN: {green}, AMBER: {amber}, RED: {red}")

    # Шаг 4: Генерация технологических карт для GREEN позиций
    print(f"\n[4/5] Генерация технологических карт...")

    green_positions = [p for p in positions if p["classification"] == "GREEN"]

    for pos in green_positions[:3]:  # Первые 3 GREEN позиции
        url = f"{BASE_URL}/api/workflow/a/tech-card"
        payload = {
            "project_id": project_id,
            "position_id": pos["id"]
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()

        print(f"  ✅ Tech card: {pos['code']} - {pos['description']}")

    # Шаг 5: Скачивание Excel отчета
    print(f"\n[5/5] Скачивание Excel отчета...")

    url = f"{BASE_URL}/api/projects/{project_id}/export/excel"
    response = requests.get(url)
    response.raise_for_status()

    output_path = Path(f"{project_id}_audit.xlsx")
    output_path.write_bytes(response.content)

    print(f"✅ Отчет сохранен: {output_path}")

    print(f"\n🎉 Workflow A завершен успешно!")
    print(f"📊 Project ID: {project_id}")
    print(f"📄 Отчет: {output_path}")

    return project_id, positions

if __name__ == "__main__":
    boq_file = Path("rozpocet.xlsx")
    project_name = "Bytový dům Vinohrady"

    project_id, positions = complete_workflow_a(boq_file, project_name)
```

**Запуск:**

```bash
python workflow_a_example.py
```

**Ожидаемый вывод:**

```
[1/5] Загрузка проекта 'Bytový dům Vinohrady'...
✅ Проект создан: proj_1706265000_abc123

[2/5] Ожидание завершения обработки...
   Статус: processing...
   Статус: processing...
✅ Обработка завершена

[3/5] Получение позиций...
✅ Получено 53 позиций
   GREEN: 48, AMBER: 3, RED: 2

[4/5] Генерация технологических карт...
  ✅ Tech card: 121151113 - Beton C 25/30
  ✅ Tech card: 121151114 - Beton C 30/37
  ✅ Tech card: 271354111 - Ocelová výztuž B500

[5/5] Скачивание Excel отчета...
✅ Отчет сохранен: proj_1706265000_abc123_audit.xlsx

🎉 Workflow A завершен успешно!
📊 Project ID: proj_1706265000_abc123
📄 Отчет: proj_1706265000_abc123_audit.xlsx
```

---

### Работа с агентами (JavaScript/Node.js)

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function useAgent() {
  // 1. Получить список доступных агентов
  console.log('[1/3] Получение списка агентов...');

  const agentsResponse = await axios.get(`${BASE_URL}/api/agents/agents`);
  const agents = agentsResponse.data.agents;

  console.log(`✅ Доступно агентов: ${agents.length}`);
  agents.forEach(agent => {
    console.log(`  - ${agent.name} (${agent.id})`);
  });

  // 2. Запустить агента
  console.log('\n[2/3] Запуск агента tzd_reader...');

  const executeResponse = await axios.post(`${BASE_URL}/api/agents/execute`, {
    agent_id: 'tzd_reader',
    project_id: 'proj_456',
    input_data: {
      drawing_path: '/path/to/floor_plan.pdf'
    },
    options: {
      extract_dimensions: true,
      identify_materials: true
    }
  });

  const executionId = executeResponse.data.execution_id;
  console.log(`✅ Агент запущен: ${executionId}`);

  // 3. Проверить статус
  console.log('\n[3/3] Проверка статуса...');

  let status = 'running';
  while (status === 'running' || status === 'queued') {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 сек

    const statusResponse = await axios.get(
      `${BASE_URL}/api/agents/status/${executionId}`
    );

    status = statusResponse.data.status;
    console.log(`   Статус: ${status}`);

    if (status === 'completed') {
      const result = statusResponse.data.result;
      console.log('✅ Агент завершил работу:');
      console.log(`   Dimensions: ${result.dimensions_extracted}`);
      console.log(`   Materials: ${result.materials_identified}`);
      console.log(`   Positions: ${result.positions_generated}`);
    } else if (status === 'failed') {
      console.error(`❌ Ошибка: ${statusResponse.data.error}`);
    }
  }
}

useAgent().catch(console.error);
```

---

### curl примеры для всех основных операций

```bash
#!/bin/bash
# complete_workflow.sh - Полный цикл работы с API

BASE_URL="http://localhost:8000"

# 1. Health check
echo "[1/6] Health check..."
curl -s "$BASE_URL/" | jq '.'

# 2. Загрузка проекта
echo -e "\n[2/6] Загрузка проекта..."
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload" \
  -F "project_name=Test Project" \
  -F "workflow=A" \
  -F "vykaz_vymer=@rozpocet.xlsx")

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.project_id')
echo "Project ID: $PROJECT_ID"

# 3. Проверка статуса
echo -e "\n[3/6] Проверка статуса..."
sleep 5  # Ждем завершения обработки
curl -s "$BASE_URL/api/projects/$PROJECT_ID/status" | jq '.data.status'

# 4. Получение позиций
echo -e "\n[4/6] Получение позиций..."
curl -s "$BASE_URL/api/workflow/a/positions?project_id=$PROJECT_ID" \
  | jq '.data.count'

# 5. Генерация tech card
echo -e "\n[5/6] Генерация tech card..."
curl -s -X POST "$BASE_URL/api/workflow/a/tech-card" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": \"$PROJECT_ID\", \"position_id\": \"1\"}" \
  | jq '.data.artifact.title'

# 6. Скачивание отчета
echo -e "\n[6/6] Скачивание отчета..."
curl -o "${PROJECT_ID}_report.xlsx" \
  "$BASE_URL/api/projects/$PROJECT_ID/export/excel"

echo -e "\n✅ Готово! Отчет: ${PROJECT_ID}_report.xlsx"
```

**Запуск:**

```bash
chmod +x complete_workflow.sh
./complete_workflow.sh
```

---

## Связанные документы

- **[README.md](../README.md)** - Обзор проекта
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Архитектура системы
- **[WORKFLOWS.md](WORKFLOWS.md)** - Пошаговые руководства по работе
- **[SYSTEM_DESIGN.md](SYSTEM_DESIGN.md)** - Техническая спецификация
- **[CONFIG.md](CONFIG.md)** - Справочник по конфигурации
- **[TESTS.md](TESTS.md)** - Руководство по тестированию

---

## Changelog

### v2.0.0 (2025-01-26)

- ✨ Добавлен полный endpoint для PDF extraction
- ✨ Добавлены endpoints для агентов
- ✨ Добавлен чат-интерфейс
- ✨ Обновлены Workflow A/B endpoints
- 📝 Полная документация всех endpoints
- 📝 Примеры использования на Python, JavaScript, curl

### v1.0.0 (2025-01-20)

- 🎉 Первый релиз API
- ✅ Основные endpoints для Workflow A и B

---

**Последнее обновление:** 2025-01-26
**Поддержка:** Development Team
**Вопросы?** Откройте issue на GitHub
