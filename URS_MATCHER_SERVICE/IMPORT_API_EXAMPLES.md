# 📡 URS Catalog Import API - Примеры использования

**Дата:** 2025-12-10
**Версия:** 1.0
**Язык:** Русский/English mix

---

## 📋 Quick Reference

### API Endpoints (все начинаются с `/api/catalog`)

```
GET  /status                    → Текущий статус системы
POST /import                    → Запустить импорт
GET  /versions                  → Список всех версий
GET  /versions/:id              → Детали версии
POST /versions/:id/approve      → Утвердить версию
POST /versions/:id/reject       → Отклонить версию
POST /rollback/:id              → Откатить на старую версию
GET  /audit-log                 → История всех операций
GET  /health-check              → Проверка здоровья системы
GET  /pending-approvals         → Версии ожидающие утверждения
```

---

## 🚀 ПРИМЕР 1: Запуск импорта

### Сценарий: Администратор хочет импортировать новый каталог

```bash
# Файл уже находится в data/urs_export.csv (40,000 кодов)

curl -X POST http://localhost:3001/api/catalog/import \
  -H "Content-Type: application/json" \
  -d '{
    "source": "local_file",
    "source_path": "./data/urs_export.csv",
    "auto_approve": false
  }'
```

### Ответ (202 Accepted - импорт начался)

```json
{
  "status": "import_started",
  "data": {
    "versionId": "catalog_1702200000000",
    "status": "pending_approval",
    "validation": {
      "valid": true,
      "errors": [],
      "warnings": [
        "Missing section: 62"
      ],
      "score": 85
    },
    "stats": {
      "total": 40231,
      "skipped": 5,
      "duplicates": 0,
      "bySection": {
        "27": 4231,
        "31": 3892,
        "32": 2156,
        "41": 5421,
        "43": 3145,
        "61": 2834,
        "63": 1987
      }
    },
    "message": "Version created and pending approval. Will auto-approve in 24 hours."
  },
  "timestamp": "2025-12-10T14:30:00Z"
}
```

---

## 📊 ПРИМЕР 2: Проверить статус импорта

### Сценарий: "Какой статус импорта? Можно ли использовать?"

```bash
curl http://localhost:3001/api/catalog/status
```

### Ответ

```json
{
  "status": "ok",
  "data": {
    "active_version": {
      "version_id": "catalog_1702113600000",
      "created_at": "2025-12-09T14:00:00Z",
      "source": "local_file",
      "imported_codes_count": 40231,
      "validation_score": 95,
      "status": "active",
      "activated_at": "2025-12-09T14:15:00Z"
    },
    "pending_versions": [
      {
        "version_id": "catalog_1702200000000",
        "created_at": "2025-12-10T14:30:00Z",
        "validation_score": 85,
        "status": "pending",
        "stats": {
          "total": 40231,
          "bySection": {
            "27": 4231,
            "31": 3892
          }
        }
      }
    ],
    "health": {
      "status": "healthy",
      "checks": {
        "database": {
          "ok": true,
          "message": "Database connection OK"
        },
        "catalog_size": {
          "ok": true,
          "message": "40231 codes imported",
          "value": 40231
        },
        "section_coverage": {
          "ok": true,
          "message": "7 sections covered",
          "value": 7
        },
        "active_version": {
          "ok": true,
          "message": "Version: catalog_1702113600000",
          "value": "catalog_1702113600000"
        },
        "cache": {
          "ok": true,
          "message": "1245 mappings cached",
          "value": 1245
        }
      }
    },
    "config": {
      "require_approval": true,
      "auto_import_enabled": true,
      "versions_to_keep": 3
    }
  },
  "timestamp": "2025-12-10T14:35:00Z"
}
```

### Интерпретация:

```
✅ GOOD:
  ├─ active_version существует → система работает
  ├─ validation_score 95 → данные качественные
  ├─ catalog_size 40231 → полный каталог загружен
  ├─ health.status "healthy" → всё ОК
  └─ cache 1245 mappings → кэш работает

⚠️ PENDING:
  └─ Есть новая версия ожидающая утверждения
    └─ Нужно: POST /api/catalog/versions/catalog_1702200000000/approve
```

---

## ✅ ПРИМЕР 3: Утвердить новую версию

### Сценарий: Администратор проверил и одобрил новый каталог

```bash
curl -X POST http://localhost:3001/api/catalog/versions/catalog_1702200000000/approve \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Verified on 2025-12-10. All sections present and validated."
  }'
```

### Ответ (200 OK - активирована)

```json
{
  "status": "approved_and_activated",
  "data": {
    "version_id": "catalog_1702200000000",
    "approved_at": "2025-12-10T14:40:00Z",
    "validation_score": 85
  },
  "timestamp": "2025-12-10T14:40:00Z"
}
```

### Что произошло в БД:

```
catalog_versions TABLE:
┌─────────────────────────────────────────────┐
│ version_id              │ status  │ notes   │
├─────────────────────────┼─────────┼─────────┤
│ catalog_1702113600000   │ inactive│         │ ← Old
│ catalog_1702200000000   │ active  │ Verified│ ← NEW!
└─────────────────────────────────────────────┘

catalog_audit_log TABLE:
┌──────────────────────────────────────────────────┐
│ timestamp           │ action                │    │
├─────────────────────┼──────────────────────┤────┤
│ 2025-12-10 14:40   │ catalog_version_activated  │
└──────────────────────────────────────────────────┘
```

---

## ❌ ПРИМЕР 4: Отклонить плохую версию

### Сценарий: Новый каталог имеет ошибки → отклонить

```bash
curl -X POST http://localhost:3001/api/catalog/versions/catalog_1702200000000/reject \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Found 1000 duplicate codes. Missing section 62."
  }'
```

### Ответ (200 OK)

```json
{
  "status": "rejected",
  "data": {
    "version_id": "catalog_1702200000000",
    "rejected_at": "2025-12-10T14:42:00Z",
    "reason": "Found 1000 duplicate codes. Missing section 62."
  },
  "timestamp": "2025-12-10T14:42:00Z"
}
```

---

## 🔄 ПРИМЕР 5: Откатить на старую версию

### Сценарий: Новая версия содержит неверные коды → вернуться к старой

```bash
curl -X POST http://localhost:3001/api/catalog/rollback/catalog_1702113600000 \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Section 27 codes are incorrect. Rolling back to previous."
  }'
```

### Ответ (200 OK)

```json
{
  "status": "rollback_started",
  "data": {
    "version_id": "catalog_1702113600000",
    "rollback_started_at": "2025-12-10T14:45:00Z",
    "reason": "Section 27 codes are incorrect. Rolling back to previous."
  },
  "timestamp": "2025-12-10T14:45:00Z"
}
```

### Результат:

```
Старая активная версия → становится 'inactive'
Целевая версия → становится 'active'
Система использует откатанную версию
```

---

## 📜 ПРИМЕР 6: Просмотреть все версии

### Сценарий: "Какие версии у нас есть? Какая активна?"

```bash
curl http://localhost:3001/api/catalog/versions
```

### Ответ

```json
{
  "status": "ok",
  "count": 5,
  "data": [
    {
      "version_id": "catalog_1702200000000",
      "source": "local_file",
      "status": "active",
      "created_at": "2025-12-10T14:30:00Z",
      "activated_at": "2025-12-10T14:40:00Z",
      "stats": {
        "total": 40231,
        "bySection": { "27": 4231, "31": 3892 }
      },
      "validation_score": 85
    },
    {
      "version_id": "catalog_1702113600000",
      "source": "local_file",
      "status": "inactive",
      "created_at": "2025-12-09T14:00:00Z",
      "activated_at": "2025-12-09T14:15:00Z",
      "stats": {
        "total": 40231,
        "bySection": { "27": 4231, "31": 3892 }
      },
      "validation_score": 95
    },
    {
      "version_id": "catalog_1702027200000",
      "source": "local_file",
      "status": "inactive",
      "created_at": "2025-12-08T14:00:00Z",
      "stats": {
        "total": 40200
      },
      "validation_score": 88
    }
  ],
  "timestamp": "2025-12-10T14:50:00Z"
}
```

### Фильтрация только активных версий:

```bash
curl 'http://localhost:3001/api/catalog/versions?status=active'
```

---

## 🔍 ПРИМЕР 7: Проверить детали версии

### Сценарий: "Что именно содержит version X?"

```bash
curl http://localhost:3001/api/catalog/versions/catalog_1702200000000
```

### Ответ

```json
{
  "status": "ok",
  "data": {
    "version_id": "catalog_1702200000000",
    "source": "local_file",
    "source_info": {
      "source": "local_file",
      "path": "./data/urs_export.csv"
    },
    "status": "active",
    "created_at": "2025-12-10T14:30:00Z",
    "activated_at": "2025-12-10T14:40:00Z",
    "approved_by": "automated",
    "approval_notes": "Verified on 2025-12-10. All sections present.",
    "stats": {
      "total": 40231,
      "skipped": 5,
      "duplicates": 0,
      "bySection": {
        "27": 4231,
        "31": 3892,
        "32": 2156,
        "41": 5421,
        "43": 3145,
        "61": 2834,
        "63": 1987,
        "21": 1267
      }
    },
    "validation_score": 85,
    "validation_details": {
      "valid": true,
      "errors": [],
      "warnings": [
        "Missing section: 62"
      ],
      "score": 85
    }
  },
  "timestamp": "2025-12-10T14:52:00Z"
}
```

---

## 📋 ПРИМЕР 8: Получить список версий ожидающих утверждения

### Сценарий: "Что нужно утвердить?"

```bash
curl http://localhost:3001/api/catalog/pending-approvals
```

### Ответ

```json
{
  "status": "ok",
  "count": 2,
  "data": [
    {
      "version_id": "catalog_1702286400000",
      "created_at": "2025-12-11T14:30:00Z",
      "stats": {
        "total": 40245,
        "bySection": {
          "27": 4240,
          "31": 3900
        }
      }
    },
    {
      "version_id": "catalog_1702372800000",
      "created_at": "2025-12-12T14:30:00Z",
      "stats": {
        "total": 40250
      }
    }
  ],
  "timestamp": "2025-12-12T14:35:00Z"
}
```

**⚠️ ВАЖНО:** Если версия pending > 24 часа → автоматически активируется!

---

## 📊 ПРИМЕР 9: Получить историю операций (Audit Log)

### Сценарий: "Какие операции проводились с каталогом?"

```bash
curl 'http://localhost:3001/api/catalog/audit-log?limit=50'
```

### Ответ

```json
{
  "status": "ok",
  "count": 15,
  "data": [
    {
      "id": 1,
      "action": "catalog_version_activated",
      "details": {
        "timestamp": "2025-12-10T14:40:00Z",
        "action": "catalog_version_activated",
        "version": "catalog_1702200000000",
        "user": "automated"
      },
      "timestamp": "2025-12-10T14:40:00Z"
    },
    {
      "id": 2,
      "action": "catalog_import_pending_approval",
      "details": {
        "timestamp": "2025-12-10T14:30:00Z",
        "action": "catalog_import_pending_approval",
        "versionId": "catalog_1702200000000",
        "validation_score": 85,
        "stats": {
          "total": 40231
        }
      },
      "timestamp": "2025-12-10T14:30:00Z"
    },
    {
      "id": 3,
      "action": "auto_approval_completed",
      "details": {
        "timestamp": "2025-12-09T14:15:00Z",
        "action": "auto_approval_completed",
        "version_id": "catalog_1702113600000",
        "timeout_hours": 24
      },
      "timestamp": "2025-12-09T14:15:00Z"
    }
  ],
  "timestamp": "2025-12-10T14:55:00Z"
}
```

**Анализ операций:**
- Что импортировалось и когда?
- Кто утвердил?
- Были ли откаты?
- Есть ошибки?

---

## 🏥 ПРИМЕР 10: Проверка здоровья системы

### Сценарий: "Нормально ли работает каталог?"

```bash
curl http://localhost:3001/api/catalog/health-check
```

### Ответ (здоровая система)

```json
{
  "status": "healthy",
  "data": {
    "timestamp": "2025-12-10T15:00:00Z",
    "status": "healthy",
    "checks": {
      "database": {
        "ok": true,
        "message": "Database connection OK"
      },
      "catalog_size": {
        "ok": true,
        "message": "40231 codes imported",
        "value": 40231
      },
      "section_coverage": {
        "ok": true,
        "message": "7 sections covered",
        "value": 7
      },
      "active_version": {
        "ok": true,
        "message": "Version: catalog_1702200000000",
        "value": "catalog_1702200000000"
      },
      "cache": {
        "ok": true,
        "message": "5432 mappings cached",
        "value": 5432
      }
    }
  },
  "timestamp": "2025-12-10T15:00:00Z"
}
```

### Ответ (деградированная система)

```json
{
  "status": "degraded",
  "data": {
    "timestamp": "2025-12-10T15:00:00Z",
    "status": "degraded",
    "checks": {
      "database": {
        "ok": true,
        "message": "Database connection OK"
      },
      "catalog_size": {
        "ok": false,
        "message": "50 codes imported",
        "value": 50
      },
      "section_coverage": {
        "ok": false,
        "message": "2 sections covered",
        "value": 2
      },
      "active_version": {
        "ok": false,
        "message": "No active version",
        "value": null
      },
      "cache": {
        "ok": true,
        "message": "245 mappings cached",
        "value": 245
      }
    }
  },
  "timestamp": "2025-12-10T15:00:00Z"
}
```

**Что это означает?**
```
❌ catalog_size = 50 → Недостаточно кодов!
   └─ Action: Запустить импорт → POST /api/catalog/import

❌ active_version = null → Нет активной версии!
   └─ Action: Утвердить pending версию → POST /approve

⚠️ section_coverage = 2 → Мало разделов
   └─ Action: Проверить исходный файл
```

---

## 🔄 Полный workflow: Импорт → Утверждение → Использование

```
Временная шкала:

2025-12-10 14:30 → POST /api/catalog/import
                   ├─ version: catalog_1702200000000
                   ├─ status: pending
                   └─ validation_score: 85

2025-12-10 14:35 → GET /api/catalog/status
                   └─ Можно увидеть pending версию

2025-12-10 14:40 → POST /api/catalog/versions/catalog_1702200000000/approve
                   ├─ status: active
                   └─ Система ТЕПЕРЬ использует новый каталог

2025-12-10 14:45 → GET /api/catalog/status
                   ├─ active_version: catalog_1702200000000
                   └─ pending_versions: []

ИЛИ (если не утвердить):

2025-12-11 14:30 → (24 часа спустя)
                   └─ Автоматическое утверждение
                      ├─ status: active
                      └─ approved_by: automated
```

---

## 🆘 Troubleshooting: Частые проблемы и решения

### Проблема 1: Импорт медленный

```bash
# Проверить прогресс
curl http://localhost:3001/api/catalog/status | jq '.data.pending_versions'

# Может быть проблема с:
# - Большой CSV файл (> 1GB)
# - Медленная база данных
# - Много дублей (INSERT OR REPLACE медленнее)

# Решение: Убедиться в индексах
sqlite3 data/urs_matcher.db "SELECT name FROM sqlite_master WHERE type='index'"
```

### Проблема 2: Низкий validation_score (< 70)

```bash
# Получить детали
curl http://localhost:3001/api/catalog/versions/catalog_1702200000000 \
  | jq '.data.validation_details'

# Может быть:
# - Много дублей (duplicates > 100)
# - Пропущены разделы (missing sections)
# - Мало кодов (< 100)

# Решение: Проверить исходный CSV файл
head -20 data/urs_export.csv
```

### Проблема 3: No active version

```bash
# Какая версия активна?
curl http://localhost:3001/api/catalog/status \
  | jq '.data.active_version'

# Если null → нужно утвердить pending версию
curl http://localhost:3001/api/catalog/pending-approvals

# Утвердить
curl -X POST http://localhost:3001/api/catalog/versions/{id}/approve
```

---

## 📊 Performance Expectations

### Импорт 40,000 кодов:

```
Время:        90-120 секунд
Размер БД:    8-12 MB
Батчи:       500 кодов за раз
Транзакции:   ACID-safe
```

### Поиск после импорта:

```
Cache hit (80%):      50ms (возвращаем из кэша)
Local match (15%):    100-200ms (БД поиск)
Perplexity (5%):      5-10s (LLM запрос)

Средний ответ:        500-1000ms (vs 15-30s раньше)
```

---

**Последнее обновление:** 2025-12-10
**Статус:** ✅ Production Ready

