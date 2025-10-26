# Workflows Guide

> Пошаговое руководство по Workflow A и Workflow B с блок-схемами и примерами данных

**Версия документа:** 2.0.0
**Последнее обновление:** 2025-01-26
**Поддержка:** Development Team

---

## Содержание

1. [Введение](#введение)
2. [Workflow A: Импорт и Аудит](#workflow-a-импорт-и-аудит)
3. [Workflow B: Генерация из Чертежей](#workflow-b-генерация-из-чертежей)
4. [Гибридный Workflow (A+B)](#гибридный-workflow-ab)
5. [Постобработка](#постобработка)
6. [Решение проблем](#решение-проблем)

---

## Введение

### Типы Workflows

Concrete Agent поддерживает два основных workflow для работы с строительными сметами:

| Workflow | Вход | Выход | Когда использовать |
|----------|------|-------|-------------------|
| **Workflow A** | Готовый ВВ (XML, Excel, PDF) | Проаудированные позиции | Проверка существующей сметы |
| **Workflow B** | Чертежи (PDF, images) | Сгенерированный ВВ | Создание сметы с нуля |
| **Гибридный (A+B)** | ВВ + Чертежи | Кросс-валидированные позиции | Максимальная точность |

### Руководство по выбору Workflow

**Используйте Workflow A если:**
- ✅ У вас есть готовый выказ выmер (ВВ)
- ✅ Нужно проверить/проаудировать существующую смету
- ✅ Требуется сопоставление с базами KROS/RTS
- ✅ Необходима проверка соответствия нормам (ČSN)

**Используйте Workflow B если:**
- ✅ Есть только чертежи (нет готового ВВ)
- ✅ Нужно создать смету с нуля
- ✅ Чертежи четкие и детальные

**Используйте Гибридный (A+B) если:**
- ✅ Есть и ВВ, и чертежи
- ✅ Нужна кросс-валидация между документами
- ✅ Критична максимальная точность

---

## Workflow A: Импорт и Аудит

### Обзор Workflow A

**Цель:** Импорт существующего ВВ, парсинг позиций, обогащение данными KROS/RTS, AI-powered аудит

**Продолжительность:** 2-5 минут (зависит от размера ВВ и AI провайдера)

**Предварительные требования:**
- Файл ВВ (XML, XLSX, XLS, PDF, или CSV)
- Настроенные API ключи (см. [CONFIG.md](CONFIG.md))

### Блок-схема Workflow A

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW A: IMPORT & AUDIT                  │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  1. UPLOAD   │ ← Вход: ВВ файл (XML/Excel/PDF)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  2. PARSE    │ ← SmartParser → Позиции (JSON)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  3. VALIDATE │ ← PositionValidator → Валидные позиции
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  4. ENRICH   │ ← KROS/RTS Matcher → Обогащенные позиции
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  5. AUDIT    │ ← AuditClassifier + Claude → GREEN/AMBER/RED
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  6. EXPORT   │ ← ExcelExporter → audit_report.xlsx
  └──────────────┘
```

---

### Шаг 1: Upload - Загрузка файла

**Описание:** Загрузка файла ВВ на сервер и создание проекта

**Задействованные модули:**
- `app/api/routes.py::upload_project()` - API endpoint
- `app/state/project_store.py` - Хранилище проектов

**Входные данные:**

```http
POST /api/upload
Content-Type: multipart/form-data

project_name: "Bytový dům Vinohrady"
workflow: "A"
vykaz_vymer: <файл: rozpocet.xlsx>
```

**Выходные данные:**

```json
{
  "success": true,
  "project_id": "proj_1706265000_abc123",
  "workflow_type": "A",
  "status": "uploaded",
  "files": {
    "vykaz_vymer": {
      "filename": "rozpocet.xlsx",
      "size": 45632,
      "uploaded_at": "2025-01-26T10:30:00Z"
    }
  }
}
```

**Артефакты:**
- `data/raw/{project_id}/vykaz_vymer/rozpocet.xlsx` - Загруженный файл
- `project_store[{project_id}]` - Метаданные проекта в памяти

**API Reference:** [POST /api/upload](API.md#post-apiupload)

---

### Шаг 2: Parse - Парсинг документа

**Описание:** Извлечение позиций из файла ВВ с использованием SmartParser (мульти-формат парсер с fallback стратегией)

**Задействованные модули:**
- `app/parsers/smart_parser.py::SmartParser` - Главный парсер
- `app/parsers/kros_parser.py::KrosParser` - KROS UNIXML
- `app/parsers/excel_parser.py::ExcelParser` - Excel файлы
- `app/parsers/pdf_parser.py` - PDF документы

**Fallback стратегия:**
```
1. Попытка прямого парсинга (KROS/Excel/PDF)
   ↓ (если неудача)
2. Попытка через AI (Claude)
   ↓ (если неудача)
3. Ошибка парсинга
```

**Входные данные:**

```python
{
  "file_path": "data/raw/proj_123/vykaz_vymer/rozpocet.xlsx",
  "file_type": "xlsx"
}
```

**Выходные данные:**

```json
{
  "positions": [
    {
      "code": "121151113",
      "description": "Beton C 25/30",
      "unit": "m3",
      "quantity": 10.5,
      "unit_price": null,
      "total_price": 26250.0,
      "row_index": 5
    },
    {
      "code": "121151114",
      "description": "Beton C 30/37",
      "unit": "m3",
      "quantity": 5.0,
      "unit_price": null,
      "total_price": 14000.0,
      "row_index": 6
    }
  ],
  "total_positions": 53,
  "diagnostics": {
    "parser_used": "ExcelParser",
    "normalization": {
      "numbers_locale": "EU",
      "numbers_normalized": 106
    }
  }
}
```

**Артефакты:**
- `data/processed/{project_id}/parsed_positions.json` - Спарсенные позиции
- Кеш: `project_cache[{project_id}]['parsing_summary']`

**Сервисы:**
- `SmartParser.parse()` - Автоопределение формата и парсинг
- `normalize_european_numbers()` - Нормализация чисел (1 234,56 → 1234.56)

---

### Шаг 3: Validate - Валидация схемы

**Описание:** Проверка позиций на соответствие Pydantic схеме, дедупликация, проверка обязательных полей

**Задействованные модули:**
- `app/validators/position_validator.py::PositionValidator`
- `app/models/position.py::Position` - Pydantic модель

**Проверки:**
- ✅ Обязательные поля: `code`, `description`, `unit`, `quantity`
- ✅ Типы данных: `quantity` → float, `unit_price` → float (опционально)
- ✅ Дедупликация по `code`
- ✅ Валидация единиц измерения (m3, m2, t, ks и т.д.)

**Входные данные:**

```json
{
  "positions": [
    {"code": "121151113", "description": "Beton C 25/30", "unit": "m3", "quantity": 10.5},
    {"code": "121151113", "description": "Beton C 25/30", "unit": "m3", "quantity": 10.5},
    {"code": null, "description": "Invalid position", "unit": "m3", "quantity": "invalid"}
  ]
}
```

**Выходные данные:**

```json
{
  "positions": [
    {
      "code": "121151113",
      "description": "Beton C 25/30",
      "unit": "m3",
      "quantity": 10.5,
      "validation_status": "passed"
    }
  ],
  "stats": {
    "validated_total": 1,
    "invalid_total": 1,
    "duplicates_removed": 1,
    "deduplicated_total": 1
  },
  "errors": [
    {
      "row": 3,
      "field": "code",
      "error": "field required"
    },
    {
      "row": 3,
      "field": "quantity",
      "error": "value is not a valid float"
    }
  ]
}
```

**Артефакты:**
- Обновлен: `data/processed/{project_id}/parsed_positions.json`
- Добавлены поля: `validation_status`, `validation_error`

---

### Шаг 4: Enrich - Обогащение данными

**Описание:** Сопоставление позиций с базами KROS/RTS, добавление спецификаций, цен, норм

**Задействованные модули:**
- `app/services/position_enricher.py::PositionEnricher`
- `app/core/kb_loader.py::KBLoader` - База знаний (KROS/RTS)
- `app/parsers/kros_parser.py::match_kros_code()` - Сопоставление кодов

**Стратегия сопоставления:**
```
1. Exact match по коду (121151113 → KROS 121151113)
   ↓ (если не найдено)
2. Partial match по описанию + fuzzy search
   ↓ (если не найдено)
3. No match (требуется ручная обработка)
```

**Входные данные:**

```json
{
  "code": "121151113",
  "description": "Beton C 25/30",
  "unit": "m3",
  "quantity": 10.5,
  "validation_status": "passed"
}
```

**Выходные данные:**

```json
{
  "code": "121151113",
  "description": "Beton C 25/30",
  "unit": "m3",
  "quantity": 10.5,
  "validation_status": "passed",
  "enrichment_status": "matched",
  "enrichment": {
    "match_type": "exact",
    "confidence": 0.98,
    "kros_code": "121151113",
    "kros_name": "Beton prostý C 25/30",
    "unit_price_kros": 2480.0,
    "applicable_norms": [
      "ČSN EN 206-1",
      "ČSN 73 1201"
    ],
    "specifications": {
      "strength_class": "C 25/30",
      "consistency": "S3",
      "max_aggregate_size": "16mm",
      "exposure_class": "XC1"
    }
  }
}
```

**Артефакты:**
- `data/processed/{project_id}/enriched_positions.json` - Обогащенные позиции

**Сервисы:**
- `KBLoader.match_kros()` - Поиск в базе KROS
- `KBLoader.match_rts()` - Поиск в базе RTS (опционально)

---

### Шаг 5: Audit - AI-аудит позиций

**Описание:** Мульти-ролевая AI экспертиза позиций с классификацией GREEN/AMBER/RED

**Задействованные модули:**
- `app/services/audit_classifier.py::AuditClassifier`
- `app/core/claude_client.py::ClaudeClient` - AI провайдер
- `app/utils/audit_contracts.py::build_audit_contract()` - Генерация промптов

**Мульти-ролевая система:**

```
┌─────────────────────────────────────────────────┐
│  SME (Subject Matter Expert) - Технический эксперт  │
│  ARCH (Architect) - Архитектор                      │
│  ENG (Engineer) - Инженер                           │
│  SUP (Supervisor) - Супервайзер                     │
└─────────────────────────────────────────────────┘
         │         │         │         │
         └────┬────┴────┬────┴────┬────┘
              ▼         ▼         ▼
         ┌──────────────────────────┐
         │  Consensus Algorithm     │
         │  (Алгоритм консенсуса)   │
         └──────────┬───────────────┘
                    ▼
         ┌──────────────────────────┐
         │  GREEN (все "за")        │
         │  AMBER (разногласия)     │
         │  RED (большинство "против") │
         └──────────────────────────┘
```

**Входные данные:**

```json
{
  "code": "121151113",
  "description": "Beton C 25/30",
  "unit": "m3",
  "quantity": 10.5,
  "unit_price": 2500.0,
  "enrichment": {
    "kros_code": "121151113",
    "unit_price_kros": 2480.0,
    "applicable_norms": ["ČSN EN 206-1"]
  }
}
```

**Выходные данные:**

```json
{
  "code": "121151113",
  "description": "Beton C 25/30",
  "unit": "m3",
  "quantity": 10.5,
  "unit_price": 2500.0,
  "classification": "GREEN",
  "confidence": 0.97,
  "audit": {
    "status": "approved",
    "roles": ["SME", "ENG", "ARCH"],
    "consensus": "unanimous",
    "evidence": [
      "✅ Exact KROS match: 121151113",
      "✅ Price within 5% of database average (2480 CZK/m3)",
      "✅ Technical parameters validated (C 25/30, S3, Dmax 16mm)",
      "✅ Complies with ČSN EN 206-1"
    ],
    "recommendations": [],
    "ai_reasoning": "Position fully validated against KROS database with exact match. Unit price is within acceptable range. All technical specifications meet Czech standards."
  }
}
```

**Классификация:**

| Цвет | Условие | Действие |
|------|---------|----------|
| **GREEN** | Все проверки пройдены | Одобрено, можно использовать |
| **AMBER** | Частичное соответствие | Требует проверки эксперта |
| **RED** | Не пройдены проверки | Требует исправления |

**Артефакты:**
- `data/processed/{project_id}/audit_results.json` - Результаты аудита

**Сервисы:**
- `ClaudeClient.messages.create()` - AI запрос к Claude
- `build_audit_contract()` - Генерация промпта для каждой роли

---

### Шаг 6: Export - Экспорт в Excel

**Описание:** Генерация Excel отчета с результатами аудита, цветовое кодирование

**Задействованные модули:**
- `app/utils/excel_exporter.py::AuditExcelExporter`
- `openpyxl` - Библиотека для работы с Excel

**Входные данные:**

```json
{
  "positions": [
    {"code": "121151113", "classification": "GREEN", "confidence": 0.97, ...},
    {"code": "121151114", "classification": "AMBER", "confidence": 0.78, ...},
    {"code": "999999999", "classification": "RED", "confidence": 0.32, ...}
  ],
  "stats": {
    "total": 53,
    "green": 48,
    "amber": 3,
    "red": 2
  }
}
```

**Выходные данные:**

Excel файл с листами:

| Лист | Содержимое | Цвет |
|------|-----------|------|
| **Summary** | Общая статистика | - |
| **All Positions** | Все позиции | По классификации |
| **GREEN** | Одобренные (48) | 🟢 Зеленый фон |
| **AMBER** | Требуют проверки (3) | 🟡 Желтый фон |
| **RED** | Отклоненные (2) | 🔴 Красный фон |

**Структура Summary листа:**

```
┌──────────────────────────────────────────┐
│  AUDIT REPORT - Bytový dům Vinohrady     │
├──────────────────────────────────────────┤
│  Дата: 2025-01-26                        │
│  Всего позиций: 53                       │
│  ✅ GREEN: 48 (90.6%)                    │
│  ⚠️  AMBER: 3 (5.7%)                     │
│  ❌ RED: 2 (3.8%)                        │
│  Средняя уверенность: 0.92               │
└──────────────────────────────────────────┘
```

**Артефакты:**
- `data/processed/{project_id}/audit_report.xlsx` - Excel отчет

**API Reference:** [GET /api/projects/{project_id}/export/excel](API.md#get-apiprojectsproject_idexportexcel)

---

### Полный пример Workflow A (Python)

```python
#!/usr/bin/env python3
"""
Полный цикл Workflow A
"""
import requests
from pathlib import Path
import time

BASE_URL = "http://localhost:8000"

def workflow_a_complete():
    # Шаг 1: Upload
    print("[1/6] Загрузка файла...")
    files = {"vykaz_vymer": open("rozpocet.xlsx", "rb")}
    data = {"project_name": "Bytový dům Vinohrady", "workflow": "A"}

    response = requests.post(f"{BASE_URL}/api/upload", files=files, data=data)
    project_id = response.json()["project_id"]
    print(f"✅ Project ID: {project_id}")

    # Шаги 2-6 выполняются автоматически на сервере
    print("[2/6] Парсинг...")
    print("[3/6] Валидация...")
    print("[4/6] Обогащение...")
    print("[5/6] Аудит...")

    # Ожидание завершения
    while True:
        status_response = requests.get(f"{BASE_URL}/api/projects/{project_id}/status")
        status = status_response.json()["data"]["status"]

        if status == "completed":
            print("✅ Обработка завершена")
            break
        elif status == "failed":
            print("❌ Ошибка обработки")
            return

        time.sleep(3)

    # Шаг 6: Download Excel
    print("[6/6] Скачивание отчета...")
    excel_response = requests.get(f"{BASE_URL}/api/projects/{project_id}/export/excel")

    output = Path(f"{project_id}_audit.xlsx")
    output.write_bytes(excel_response.content)
    print(f"✅ Отчет сохранен: {output}")

    # Получение статистики
    results = requests.get(f"{BASE_URL}/api/projects/{project_id}/results").json()
    stats = results["results"]["statistics"]

    print(f"\n📊 Статистика:")
    print(f"   Всего: {stats['total']}")
    print(f"   GREEN: {stats['green']}")
    print(f"   AMBER: {stats['amber']}")
    print(f"   RED: {stats['red']}")

if __name__ == "__main__":
    workflow_a_complete()
```

**Запуск:**

```bash
python workflow_a_example.py
```

---

## Workflow B: Генерация из Чертежей

### Обзор Workflow B

**Цель:** Анализ строительных чертежей с использованием AI для генерации выказа выmер с нуля

**Продолжительность:** 5-15 минут (зависит от количества и сложности чертежей)

**Предварительные требования:**
- Чертежи (PDF, DWG, images)
- OpenAI API key (для GPT-4 Vision)
- Anthropic API key (для Claude)

### Блок-схема Workflow B

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW B: GENERATE FROM DRAWINGS               │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  1. UPLOAD   │ ← Вход: Чертежи (PDF/images)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  2. ANALYZE  │ ← GPT-4 Vision → Размеры, элементы, материалы
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  3. CALCULATE│ ← Python расчеты → Объемы, площади
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  4. GENERATE │ ← Claude → Позиции ВВ
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  5. AUDIT    │ ← AuditClassifier → GREEN/AMBER/RED
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  6. EXPORT   │ ← ExcelExporter → generated_estimate.xlsx
  └──────────────┘
```

---

### Шаг 1: Upload - Загрузка чертежей

**Описание:** Загрузка файлов чертежей на сервер

**Задействованные модули:**
- `app/api/routes.py::upload_project()` - API endpoint

**Входные данные:**

```http
POST /api/upload
Content-Type: multipart/form-data

project_name: "Most přes řeku"
workflow: "B"
vykresy: <файл: floor_plan.pdf>
vykresy: <файл: sections.pdf>
vykresy: <файл: details.pdf>
```

**Выходные данные:**

```json
{
  "success": true,
  "project_id": "proj_1706265100_def456",
  "workflow_type": "B",
  "status": "uploaded",
  "files": {
    "vykresy": [
      {
        "filename": "floor_plan.pdf",
        "size": 2345678,
        "uploaded_at": "2025-01-26T11:00:00Z"
      },
      {
        "filename": "sections.pdf",
        "size": 1234567,
        "uploaded_at": "2025-01-26T11:00:01Z"
      },
      {
        "filename": "details.pdf",
        "size": 987654,
        "uploaded_at": "2025-01-26T11:00:02Z"
      }
    ]
  }
}
```

**Артефакты:**
- `data/raw/{project_id}/vykresy/floor_plan.pdf`
- `data/raw/{project_id}/vykresy/sections.pdf`
- `data/raw/{project_id}/vykresy/details.pdf`

**API Reference:** [POST /api/upload](API.md#post-apiupload)

---

### Шаг 2: Analyze - Анализ чертежей

**Описание:** Использование GPT-4 Vision для извлечения информации из чертежей (размеры, элементы, материалы)

**Задействованные модули:**
- `app/core/gpt4_client.py::GPT4VisionClient`
- `app/services/workflow_b.py::_analyze_drawings()`

**AI Промпт для GPT-4 Vision:**

```
Analyze this construction drawing and extract:

1. Dimensions:
   - Length, width, height of structural elements
   - Thickness of walls, slabs, etc.

2. Structural elements:
   - Foundation slabs
   - Walls
   - Columns
   - Beams
   - Slabs

3. Materials mentioned:
   - Concrete grade (C 20/25, C 25/30, etc.)
   - Reinforcement steel grade
   - Other materials

4. Quantities (if visible):
   - Areas (m²)
   - Volumes (m³)
   - Lengths (m)

Output format: JSON
```

**Входные данные:**

```python
{
  "drawings": [
    {
      "path": "data/raw/proj_456/vykresy/floor_plan.pdf",
      "page": 2  # Страница с планом фундаментов
    }
  ]
}
```

**Выходные данные:**

```json
{
  "drawing_analysis": [
    {
      "drawing": "floor_plan.pdf",
      "page": 2,
      "elements_detected": [
        {
          "type": "foundation_slab",
          "description": "Základová deska",
          "dimensions": {
            "length": 4.5,
            "width": 3.5,
            "depth": 0.1,
            "unit": "m"
          },
          "material": "Beton C 25/30",
          "location": {
            "coordinates": {"x": 120, "y": 450},
            "label": "SO-01"
          },
          "confidence": 0.88
        },
        {
          "type": "wall",
          "description": "Obvodová zeď",
          "dimensions": {
            "length": 12.0,
            "height": 2.8,
            "thickness": 0.3,
            "unit": "m"
          },
          "material": "Beton C 20/25",
          "confidence": 0.92
        }
      ],
      "materials_mentioned": [
        "Beton C 25/30",
        "Beton C 20/25",
        "Ocel B500"
      ],
      "scale": "1:50",
      "total_elements": 15
    }
  ]
}
```

**Артефакты:**
- `data/processed/{project_id}/drawing_analysis.json`

**Сервисы:**
- `GPT4VisionClient.analyze_image()` - AI анализ изображения
- Стоимость: ~$0.01-0.03 за изображение (зависит от разрешения)

---

### Шаг 3: Calculate - Расчет материалов

**Описание:** Вычисление объемов, площадей, масс на основе данных из чертежей

**Задействованные модули:**
- `app/services/workflow_b.py::_calculate_materials()`

**Формулы расчета:**

```python
# Фундаментная плита
volume_concrete = length × width × depth
# 4.5 × 3.5 × 0.1 = 1.575 m³

# Стена
volume_wall = length × height × thickness
# 12.0 × 2.8 × 0.3 = 10.08 m³

# Площадь стены (для штукатурки)
area_wall = length × height × 2  # обе стороны
# 12.0 × 2.8 × 2 = 67.2 m²

# Масса арматуры (примерная, 100 кг/м³ бетона)
reinforcement_mass = volume_concrete × 100
# 1.575 × 100 = 157.5 kg
```

**Входные данные:**

```json
{
  "elements": [
    {
      "type": "foundation_slab",
      "dimensions": {"length": 4.5, "width": 3.5, "depth": 0.1},
      "material": "Beton C 25/30"
    }
  ]
}
```

**Выходные данные:**

```json
{
  "calculations": {
    "materials": [
      {
        "material": "Beton C 25/30",
        "type": "concrete",
        "total_volume": 15.75,
        "unit": "m3",
        "elements": [
          {
            "element_id": "foundation_slab_1",
            "volume": 1.575
          },
          {
            "element_id": "foundation_slab_2",
            "volume": 14.175
          }
        ]
      },
      {
        "material": "Ocel B500",
        "type": "reinforcement",
        "total_mass": 1575.0,
        "unit": "kg",
        "calculation_method": "estimated_100kg_per_m3"
      }
    ],
    "summary": {
      "total_concrete_volume": 15.75,
      "total_reinforcement_mass": 1575.0,
      "estimated_cost": 52500.0
    }
  }
}
```

**Артефакты:**
- `data/processed/{project_id}/calculations.json`

---

### Шаг 4: Generate - Генерация позиций

**Описание:** Использование Claude для генерации позиций ВВ в формате KROS/RTS

**Задействованные модули:**
- `app/core/claude_client.py::ClaudeClient`
- `app/services/workflow_b.py::_generate_positions()`

**AI Промпт для Claude:**

```
Based on the drawing analysis and calculations, generate Bill of Quantities positions in Czech format:

Drawing analysis: {drawing_analysis}
Calculations: {calculations}

For each structural element, create a position with:
1. KROS code (from B5_URS_KROS4 database)
2. Czech description
3. Unit of measure (m3, m2, t, ks)
4. Quantity (calculated)
5. Unit price (from KROS database or estimate)

Output format: JSON array of positions
```

**Входные данные:**

```json
{
  "drawing_analysis": [...],
  "calculations": {
    "materials": [
      {"material": "Beton C 25/30", "total_volume": 15.75, "unit": "m3"}
    ]
  }
}
```

**Выходные данные:**

```json
{
  "generated_positions": [
    {
      "id": "gen_1",
      "code": "121151113",
      "description": "Beton C 25/30 - základová deska",
      "unit": "m3",
      "quantity": 15.75,
      "unit_price": 2500.0,
      "total_price": 39375.0,
      "source_drawing": "floor_plan.pdf",
      "page": 2,
      "confidence": 0.88,
      "ai_reasoning": "Detected foundation slab: 450cm × 350cm × 10cm = 15.75 m3. Matched to KROS code 121151113 for C 25/30 plain concrete.",
      "calculation": {
        "formula": "length × width × depth",
        "values": {
          "length": 4.5,
          "width": 3.5,
          "depth": 0.1
        },
        "result": 15.75
      }
    },
    {
      "id": "gen_2",
      "code": "271354111",
      "description": "Ocelová výztuž B500 - základy",
      "unit": "t",
      "quantity": 1.58,
      "unit_price": 32000.0,
      "total_price": 50560.0,
      "source_drawing": "floor_plan.pdf",
      "page": 2,
      "confidence": 0.75,
      "ai_reasoning": "Estimated reinforcement based on 100kg/m3 concrete ratio. Total concrete: 15.75 m3 → 1575 kg = 1.58 t",
      "calculation": {
        "formula": "concrete_volume × 100 / 1000",
        "values": {
          "concrete_volume": 15.75,
          "ratio_kg_per_m3": 100
        },
        "result": 1.58
      }
    }
  ],
  "total_positions": 27,
  "total_cost": 523450.0
}
```

**Артефакты:**
- `data/processed/{project_id}/generated_positions.json`

**Сервисы:**
- `ClaudeClient.messages.create()` - AI генерация позиций
- `KBLoader.match_kros()` - Сопоставление с KROS кодами

**API Reference:** [GET /api/workflow/b/positions](API.md#get-apiworkflowbpositions)

---

### Шаг 5: Audit - Аудит сгенерированных позиций

**Описание:** Аналогично Workflow A - мульти-ролевая экспертиза

**Задействованные модули:**
- `app/services/audit_classifier.py::AuditClassifier` (тот же, что и в Workflow A)

**Особенности аудита для Workflow B:**

```
Дополнительные проверки:
- ✅ Соответствие размеров на чертеже и в расчетах
- ✅ Корректность формул расчета
- ✅ Адекватность AI рассуждений (ai_reasoning)
- ✅ Confidence score > 0.7
```

**Входные/выходные данные:** Аналогично Workflow A, шаг 5

---

### Шаг 6: Export - Экспорт в Excel

**Описание:** Аналогично Workflow A, но с дополнительными листами для чертежей и расчетов

**Структура Excel файла для Workflow B:**

| Лист | Содержимое |
|------|-----------|
| **Summary** | Общая статистика |
| **Generated Positions** | Все сгенерированные позиции |
| **Drawings Analysis** | Анализ чертежей (элементы, размеры) |
| **Calculations** | Подробные расчеты |
| **GREEN** | Одобренные позиции |
| **AMBER** | Требуют проверки |
| **RED** | Отклоненные |

**Артефакты:**
- `data/processed/{project_id}/generated_estimate.xlsx`

---

### Полный пример Workflow B (Python)

```python
#!/usr/bin/env python3
"""
Полный цикл Workflow B
"""
import requests
from pathlib import Path
import time

BASE_URL = "http://localhost:8000"

def workflow_b_complete():
    # Шаг 1: Upload чертежей
    print("[1/6] Загрузка чертежей...")

    files = [
        ("vykresy", open("floor_plan.pdf", "rb")),
        ("vykresy", open("sections.pdf", "rb")),
        ("vykresy", open("details.pdf", "rb"))
    ]

    data = {
        "project_name": "Most přes řeku",
        "workflow": "B"
    }

    response = requests.post(f"{BASE_URL}/api/upload", files=files, data=data)
    project_id = response.json()["project_id"]
    print(f"✅ Project ID: {project_id}")

    # Шаги 2-6 выполняются автоматически
    print("[2/6] Анализ чертежей (GPT-4 Vision)...")
    print("[3/6] Расчет материалов...")
    print("[4/6] Генерация позиций (Claude)...")
    print("[5/6] Аудит позиций...")

    # Ожидание завершения
    while True:
        status_response = requests.get(f"{BASE_URL}/api/projects/{project_id}/status")
        status = status_response.json()["data"]["status"]

        if status == "completed":
            print("✅ Обработка завершена")
            break
        elif status == "failed":
            print("❌ Ошибка обработки")
            return

        time.sleep(5)  # Workflow B занимает больше времени

    # Получение сгенерированных позиций
    print("[6/6] Получение результатов...")
    positions_response = requests.get(
        f"{BASE_URL}/api/workflow/b/positions?project_id={project_id}"
    )

    positions = positions_response.json()["data"]["items"]

    print(f"\n📊 Сгенерировано позиций: {len(positions)}")
    print(f"\nПервые 5 позиций:")
    for pos in positions[:5]:
        print(f"  - {pos['code']}: {pos['description']} ({pos['quantity']} {pos['unit']})")
        print(f"    Источник: {pos['source_drawing']}, стр. {pos['page']}")
        print(f"    Confidence: {pos['confidence']:.2f}")

if __name__ == "__main__":
    workflow_b_complete()
```

---

## Гибридный Workflow (A+B)

### Обзор гибридного Workflow

**Цель:** Максимальная точность через кросс-валидацию между готовым ВВ и чертежами

**Сценарий использования:**
- Есть готовый ВВ от подрядчика
- Есть проектные чертежи
- Нужно проверить соответствие ВВ чертежам

### Блок-схема гибридного Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HYBRID WORKFLOW: A + B                           │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐    ┌──────────────┐
  │ Upload ВВ    │    │ Upload       │
  │ (Workflow A) │    │ Чертежи (B)  │
  └──────┬───────┘    └──────┬───────┘
         │                   │
         ▼                   ▼
  ┌──────────────┐    ┌──────────────┐
  │ Parse ВВ     │    │ Analyze      │
  │ positions    │    │ Drawings     │
  └──────┬───────┘    └──────┬───────┘
         │                   │
         └─────────┬─────────┘
                   ▼
         ┌──────────────────┐
         │ Cross-Validate   │
         │ (Сравнение)      │
         └─────────┬────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ Discrepancy      │
         │ Report           │
         │ (Расхождения)    │
         └─────────┬────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ Unified Audit    │
         │ (Общий аудит)    │
         └─────────┬────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ Export Report    │
         └──────────────────┘
```

### Кросс-валидация

**Проверки:**

1. **Количества:**
   ```
   ВВ:       Beton C 25/30 - 10.5 m³
   Чертежи:  Beton C 25/30 - 15.75 m³
   → Расхождение: 5.25 m³ (50% разница) ⚠️
   ```

2. **Коды позиций:**
   ```
   ВВ:       121151113 (Beton C 25/30)
   Чертежи:  121151113 (Beton C 25/30)
   → Совпадение ✅
   ```

3. **Недостающие позиции:**
   ```
   В ВВ есть, в чертежах нет:
   - 271354111 (Ocelová výztuž) - возможно, не показана на чертежах

   В чертежах есть, в ВВ нет:
   - 612312345 (Hydroizolace) - забыли добавить в ВВ ⚠️
   ```

**Отчет о расхождениях:**

```json
{
  "discrepancies": [
    {
      "position_code": "121151113",
      "description": "Beton C 25/30",
      "type": "quantity_mismatch",
      "boq_quantity": 10.5,
      "drawing_quantity": 15.75,
      "difference": 5.25,
      "difference_percent": 50.0,
      "severity": "high",
      "recommendation": "Verify calculation from drawings. Possible error in BoQ."
    },
    {
      "position_code": "612312345",
      "description": "Hydroizolace podkladní",
      "type": "missing_in_boq",
      "drawing_quantity": 25.0,
      "severity": "medium",
      "recommendation": "Add missing position to BoQ"
    }
  ],
  "summary": {
    "total_discrepancies": 12,
    "high_severity": 3,
    "medium_severity": 7,
    "low_severity": 2
  }
}
```

---

## Постобработка

### Генерация артефактов

После завершения любого workflow можно сгенерировать дополнительные артефакты:

**1. Технологическая карта (Tech Card)**

```bash
curl -X POST "http://localhost:8000/api/workflow/a/tech-card" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "proj_123", "position_id": "1"}'
```

**2. Ведомость ресурсов (Resource Sheet)**

```bash
curl -X POST "http://localhost:8000/api/workflow/a/resource-sheet" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "proj_123", "position_id": "1"}'
```

**3. Спецификация материалов**

```bash
curl -X POST "http://localhost:8000/api/workflow/a/materials" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "proj_123", "position_id": "1"}'
```

**API Reference:** [Workflow A Artifacts](API.md#workflow-a-endpoints)

---

## Решение проблем

### Проблемы Workflow A

#### 1. Ошибка парсинга

**Проблема:**
```
"Failed to parse XML: Invalid UNIXML format"
```

**Решение:**
1. Проверить, что XML файл валидный
2. Убедиться, что есть корневой элемент `<unixml>`
3. Проверить кодировку (должна быть UTF-8)
4. Попробовать загрузить Excel версию вместо XML

#### 2. Низкие confidence scores

**Проблема:**
Много позиций с classification = AMBER/RED

**Решение:**
1. Проверить соответствие кодов позиций базе KROS
2. Добавить более детальные описания позиций
3. Указать корректные единицы измерения
4. Проверить разумность цен

#### 3. Timeout AI запросов

**Проблема:**
```
"Claude API error: Request timeout after 120s"
```

**Решение:**
```bash
# В .env увеличить timeout
CLAUDE_TIMEOUT=300
```

### Проблемы Workflow B

#### 1. Низкое качество анализа чертежей

**Проблема:**
GPT-4 Vision не может прочитать размеры

**Решение:**
1. Использовать чертежи высокого разрешения (300+ DPI)
2. Убедиться, что размеры четко видны
3. Использовать PDF вместо отсканированных изображений
4. Убедиться, что есть масштаб на чертеже

#### 2. Неверные расчеты

**Проблема:**
Объемы/площади рассчитаны неверно

**Решение:**
1. Проверить, что GPT-4 правильно распознал размеры
2. Вручную проверить формулы в `calculations.json`
3. Сравнить с проектной документацией

#### 3. Высокая стоимость

**Проблема:**
GPT-4 Vision дорого стоит при большом количестве чертежей

**Решение:**
1. Использовать только ключевые чертежи (планы, разрезы)
2. Избегать дублирующих видов
3. Предобработать PDF: убрать лишние страницы
4. Рассмотреть гибридный подход: часть позиций вручную

---

## Связанные документы

- **[API.md](API.md)** - Полная документация API endpoints
- **[SYSTEM_DESIGN.md](SYSTEM_DESIGN.md)** - Техническая спецификация
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Архитектура системы
- **[CONFIG.md](CONFIG.md)** - Справочник конфигурации
- **[TESTS.md](TESTS.md)** - Руководство по тестированию

---

**Последнее обновление:** 2025-01-26
**Поддержка:** Development Team
**Вопросы?** Откройте issue на GitHub
