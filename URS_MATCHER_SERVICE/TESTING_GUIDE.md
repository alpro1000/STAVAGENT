# 🎯 ТЕСТИРОВАНИЕ URS MATCHER - ФАЗЫ 1-3

**Дата:** 2025-11-24
**Версия:** 1.0.0
**Статус:** ✅ Ready for Testing

---

## 📋 Что было реализовано:

### ✅ Фаза 1: BOQ Block Analysis
- Endpoint: `POST /api/jobs/block-match`
- Группировка работ по 11 категориям (TŘÍDNÍK)
- LLM анализ блоков с project_context
- Автоматические предложения related_items

### ✅ Фаза 2: Document Parsing & Q&A
- Endpoint: `POST /api/jobs/parse-document`
- Endpoint: `POST /api/jobs/:jobId/confirm-qa`
- Парсинг PDF/Excel через STAVAGENT SmartParser
- Автоматическая генерация вопросов
- Auto-answering из документов
- RFI detection

### ✅ Фаза 3: Multi-Role AI Validation
- Интеграция с STAVAGENT Multi-Role API
- Completeness score (0-100%)
- Missing items detection
- Warnings & critical issues
- Graceful degradation

---

## 🚀 ИНСТРУКЦИИ ПО ТЕСТИРОВАНИЮ

### Предварительные требования:

```bash
# 1. Backend URS Matcher должен быть запущен
cd URS_MATCHER_SERVICE/backend
npm install
npm run dev
# Server: http://localhost:3000

# 2. (Опционально) STAVAGENT для Фазы 2-3
cd ../../concrete-agent
# Следуйте инструкциям в concrete-agent/README.md
# Server: http://localhost:8000
```

---

## 🧪 ТЕСТ 1: Фаза 1 - Block Analysis (базовый тест)

### Создайте тестовый файл BOQ:

```bash
cat > /tmp/test_boq.csv << 'EOF'
description,quantity,unit
"Výkopy základových pásů",45,m3
"Betonáž základů C25/30",38,m3
"Bednění základů",95,m2
"Zdivo Porotherm 40 Profi",450,m2
"ŽB stropní deska tl. 200mm",180,m2
"Bednění stropů",180,m2
"Výztuž stropů",2.5,t
"Omítka vnitřní vápenná",850,m2
"Omítka vnější silikátová",420,m2
"Hydroizolace základů",95,m2
EOF
```

### Запустите тест:

```bash
curl -X POST http://localhost:3000/api/jobs/block-match \
  -F "file=@/tmp/test_boq.csv" \
  -F 'project_context={"building_type":"bytový dům","storeys":4,"main_system":["keramické zdivo Porotherm","ŽB stropní desky"]}'
```

### ✅ Ожидаемый результат:

```json
{
  "job_id": "uuid-here",
  "status": "completed",
  "filename": "test_boq.csv",
  "total_rows": 10,
  "blocks_count": 5,
  "project_context": {...},
  "blocks": [
    {
      "block_name": "Základy",
      "rows_count": 3,
      "analysis": {
        "block_summary": {
          "main_systems": ["beton C25/30", "výkopy"],
          "potential_missing_work_groups": ["lešení", "odvoz zeminy"]
        },
        "items": [
          {
            "row_id": 1,
            "selected_urs": {
              "urs_code": "3112389",
              "urs_name": "Výkopy základových konstrukcí",
              "confidence": 0.9
            }
          }
        ],
        "multi_role_validation": {
          "completeness_score": 85,
          "missing_items": ["Odvoz výkopku", "Zásypy základů"],
          "warnings": [],
          "critical_issues": []
        }
      }
    }
  ]
}
```

### 🔍 Что проверять:

- ✅ Status: "completed"
- ✅ Blocks_count > 0 (должно быть несколько блоков)
- ✅ Каждый блок имеет `analysis` с `items`
- ✅ Каждый item имеет `selected_urs` с URS кодом
- ✅ (Если STAVAGENT запущен) `multi_role_validation` присутствует
- ✅ `completeness_score` между 0-100

---

## 🧪 ТЕСТ 2: Фаза 2 - Document Parsing

### Создайте тестовый документ:

```bash
cat > /tmp/test_techspec.txt << 'EOF'
TECHNICKÁ ZPRÁVA - NOVOSTAVBA BYTOVÉHO DOMU

Projekt: Bytový dům Rezidence Park, Praha 6

1. ZÁKLADNÍ ÚDAJE:
   - Počet nadzemních podlaží: 5NP + 1PP
   - Celková zastavěná plocha: 1200 m²
   - Typ konstrukce: Zděná konstrukce

2. KONSTRUKČNÍ SYSTÉM:
   - Svislé konstrukce: Porotherm 40 Profi
   - Vodorovné konstrukce: ŽB monolitické desky tl. 200mm
   - Základy: Základové pasy z betonu C25/30

3. IZOLACE:
   - Tepelná izolace: EPS polystyren 150mm
   - Hydroizolace: SBS modifikované asfaltové pásy

4. STŘECHA:
   - Plochá střecha s hydroizolací
   - Spádové klíny EPS
EOF
```

### Zapustite test:

```bash
curl -X POST http://localhost:3000/api/jobs/parse-document \
  -F "file=@/tmp/test_techspec.txt"
```

### ✅ Ожидаемый результат:

```json
{
  "job_id": "uuid",
  "status": "completed",
  "filename": "test_techspec.txt",
  "parsed_document": {
    "file_type": ".txt",
    "pages_count": 0,
    "has_tables": false
  },
  "project_context": {
    "building_type": "bytový dům",
    "storeys": 5,
    "main_system": ["keramické zdivo Porotherm", "ŽB stěny"],
    "source_document": "test_techspec.txt",
    "extraction_confidence": 0.7
  },
  "qa_flow": {
    "questions": [
      {
        "id": "q_building_type",
        "question": "Jaký je typ stavby?",
        "priority": "high",
        "found": true,
        "answer": "bytový dům",
        "confidence": 0.85,
        "source": {...}
      },
      {
        "id": "q_storeys",
        "question": "Kolik má stavba nadzemních podlaží?",
        "priority": "high",
        "found": true,
        "answer": 5,
        "confidence": 0.9
      }
    ],
    "answered_count": 4,
    "unanswered_count": 2,
    "enhanced_context": {...},
    "requires_user_input": true,
    "rfi_needed": false
  }
}
```

### 🔍 Что проверять:

- ✅ `project_context.building_type` = "bytový dům"
- ✅ `project_context.storeys` = 5
- ✅ `qa_flow.questions` содержит вопросы
- ✅ Некоторые вопросы имеют `found: true` и `answer`
- ✅ `answered_count` > 0

---

## 🧪 ТЕСТ 3: Фаза 2 - Q&A Confirmation

### Подтвердите ответы из Теста 2:

```bash
# Используйте job_id из предыдущего теста
JOB_ID="<job_id_from_test_2>"

curl -X POST "http://localhost:3000/api/jobs/${JOB_ID}/confirm-qa" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed_answers": {
      "q_building_type": {"value": "bytový dům", "user_edited": false},
      "q_storeys": {"value": "5", "user_edited": false},
      "q_foundation_concrete": {"value": "C25/30", "user_edited": false},
      "q_wall_material": {"value": "Porotherm 40 Profi", "user_edited": false}
    }
  }'
```

### ✅ Ожидаемый результат:

```json
{
  "job_id": "uuid",
  "status": "ready_for_analysis",
  "final_context": {
    "building_type": "bytový dům",
    "storeys": 5,
    "main_system": ["Porotherm 40 Profi"],
    "foundation_concrete": "C25/30"
  },
  "message": "Q&A answers confirmed. Ready for block analysis.",
  "next_step": {
    "action": "Upload BOQ file for block-match analysis",
    "endpoint": "POST /api/jobs/block-match"
  }
}
```

---

## 🧪 ТЕСТ 4: Полный workflow (E2E)

### Шаг 1: Парсинг документа
```bash
RESPONSE=$(curl -s -X POST http://localhost:3000/api/jobs/parse-document \
  -F "file=@/tmp/test_techspec.txt")

echo "$RESPONSE" | jq '.'
JOB_ID=$(echo "$RESPONSE" | jq -r '.job_id')
echo "Job ID: $JOB_ID"
```

### Шаг 2: Подтверждение Q&A
```bash
curl -X POST "http://localhost:3000/api/jobs/${JOB_ID}/confirm-qa" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed_answers": {
      "q_building_type": {"value": "bytový dům", "user_edited": false},
      "q_storeys": {"value": "5", "user_edited": false}
    }
  }' | jq '.'
```

### Шаг 3: Анализ BOQ с контекстом
```bash
curl -X POST http://localhost:3000/api/jobs/block-match \
  -F "file=@/tmp/test_boq.csv" \
  -F 'project_context={"building_type":"bytový dům","storeys":5,"main_system":["Porotherm 40 Profi"]}' \
  | jq '.'
```

---

## 🧪 АВТОМАТИЧЕСКИЕ ТЕСТЫ

### Запустить все тесты:

```bash
cd URS_MATCHER_SERVICE/backend

# Тест 1: Parse Document
./test/test_parse_document.sh

# Тест 2: Q&A Flow
./test/test_qa_flow.sh

# Тест 3: Block Match (если есть backend tests)
npm test
```

---

## ❌ Troubleshooting

### Проблема 1: "STAVAGENT SmartParser not available" (503)

**Решение:**
```bash
# Проверьте, запущен ли STAVAGENT
curl http://localhost:8000/api/v1/health

# Если нет, запустите:
cd concrete-agent
# Следуйте инструкциям запуска
```

**Альтернатива:** Тесты Фазы 1 работают без STAVAGENT

### Проблема 2: "Multi-Role API not available"

**Решение:**
- Multi-Role validation опциональна
- Система работает с graceful degradation
- Блоки будут проанализированы без Multi-Role

### Проблема 3: Долгое выполнение (> 5 минут)

**Причина:** Perplexity поиск для всех URS кандидатов

**Решение:**
- Уменьшите количество строк в BOQ файле
- Или дождитесь завершения (нормально для 30+ строк)

---

## 📊 Ожидаемая производительность:

| Операция | Время | Зависимости |
|----------|-------|-------------|
| Parse Document | 5-15 сек | STAVAGENT SmartParser |
| Q&A Flow | 10-30 сек | Document size |
| Block Match (10 rows) | 30-60 сек | Perplexity API |
| Block Match (30 rows) | 2-5 мин | Perplexity API |
| Multi-Role Validation | 5-10 сек/блок | STAVAGENT Multi-Role API |

---

## 📝 Checklist перед тестированием:

- [ ] Backend URS Matcher запущен (port 3000)
- [ ] (Опционально) STAVAGENT запущен (port 8000)
- [ ] Создан тестовый BOQ файл
- [ ] Создан тестовый TechSpec документ
- [ ] Установлен `jq` для красивого вывода JSON

---

## 🎯 Критерии успеха:

### Фаза 1:
- ✅ Block-match возвращает grouped blocks
- ✅ Каждый блок имеет URS коды
- ✅ Related_items предложены

### Фаза 2:
- ✅ Parse-document извлекает context
- ✅ Q&A генерирует вопросы
- ✅ Auto-answering работает
- ✅ Confirm-qa строит final_context

### Фаза 3:
- ✅ Multi-Role validation работает (если API доступен)
- ✅ Completeness_score вычислен
- ✅ Missing items обнаружены
- ✅ Graceful degradation работает

---

**Дата обновления:** 2025-11-24
**Версия:** 1.0.0
