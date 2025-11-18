# CORE Integration - Интеграция с продвинутым парсером

## Что это?

Интеграция с **concrete-agent (CORE)** - мощным парсером Excel файлов, который умеет:
- ✅ Автоматически находить заголовки в любом месте файла (до 100 строк)
- ✅ Распознавать колонки по ~20 вариантам названий для каждого поля
- ✅ Правильно парсить EU формат чисел ("1.234,56" → 1234.56)
- ✅ Фильтровать служебные строки ("Souhrn", "Celkem", разделители)
- ✅ Предоставлять диагностику парсинга

## Как работает fallback?

```
1. Monolit загружает Excel
   ↓
2. Пытается извлечь бетонные работы локальным парсером
   ↓
3. Если extractedPositions.length === 0
   ↓
4. → Отправляет файл в CORE API
   ↓
5. CORE парсит с помощью SmartParser
   ↓
6. Возвращает нормализованные позиции
   ↓
7. Monolit конвертирует в свой формат и сохраняет в БД
   ↓
8. Если CORE тоже не смог → используются templates
```

## Настройка

### 1. Установить зависимости

```bash
cd backend
npm install
```

Будет установлен `axios` для HTTP запросов к CORE.

### 2. Создать .env файл

```bash
cd backend
cp .env.example .env
```

### 3. Настроить CORE интеграцию в .env

```bash
# backend/.env

# CORE Integration (Advanced Excel Parser)
ENABLE_CORE_FALLBACK=true
CORE_API_URL=http://localhost:8000
CORE_TIMEOUT=30000
```

**Параметры:**
- `ENABLE_CORE_FALLBACK` - включить/выключить CORE fallback (по умолчанию `true`)
- `CORE_API_URL` - URL CORE сервиса (по умолчанию `http://localhost:8000`)
- `CORE_TIMEOUT` - таймаут запроса в мс (по умолчанию `30000`)

### 4. Запустить CORE сервис

**Вариант A: Локально**

```bash
# В отдельном терминале
cd /path/to/concrete-agent
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Вариант B: Docker**

```bash
cd /path/to/concrete-agent
docker-compose up -d
```

**Вариант C: Production на Render/другом хостинге**

```bash
# В .env укажите production URL
CORE_API_URL=https://your-core-service.onrender.com
```

### 5. Проверить доступность CORE

```bash
curl http://localhost:8000/api/health
```

Ожидаемый ответ:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "features": {
    "workflow_a": true,
    "workflow_b": true,
    "drawing_enrichment": true,
    "csn_validation": true,
    "monolit_integration": true
  }
}
```

### 6. Запустить Monolit-Planner

```bash
cd backend
npm run dev
```

## Тестирование

### Тест 1: Проверка CORE endpoint

```bash
# Отправить Excel файл напрямую в CORE
curl -X POST http://localhost:8000/api/parse-excel \
  -F "file=@/path/to/your/file.xlsx" \
  | jq
```

Ожидаемый ответ:
```json
{
  "success": true,
  "filename": "file.xlsx",
  "positions": [
    {
      "code": "22694",
      "description": "Beton C25/30",
      "unit": "m3",
      "quantity": 834.506
    }
  ],
  "diagnostics": {
    "raw_total": 150,
    "normalized_total": 120,
    "format": "OTSKP"
  }
}
```

### Тест 2: Загрузка через Monolit с fallback

1. Подготовить Excel файл, который **НЕ распознается** локальным парсером
   - Например, с нестандартными названиями колонок
   - Или с ключевыми словами не из списка `concreteExtractor.js`

2. Загрузить через Monolit UI или API:

```bash
curl -X POST http://localhost:3001/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@difficult_file.xlsx"
```

3. Проверить логи backend:

```bash
# Вы должны увидеть:
[ConcreteExtractor] Found 0 data rows for bridge SO 241
No positions extracted from Excel for SO 241, trying CORE parser...
[CORE] Sending file to CORE parser: /tmp/xxx.xlsx
[CORE] ✅ Parsed 45 positions (format: OTSKP, raw: 150, normalized: 45)
✅ CORE extracted 45 positions for SO 241
Created 45 positions for bridge SO 241 (source: core, local_extracted: 0)
```

4. Проверить response:

```json
{
  "status": "success",
  "bridges": [
    {
      "bridge_id": "SO 241",
      "positions_created": 45,
      "positions_from_excel": 0,
      "positions_source": "core"  ← Источник данных!
    }
  ]
}
```

### Тест 3: Отключение CORE fallback

```bash
# В .env
ENABLE_CORE_FALLBACK=false

# Перезапустить backend
npm run dev
```

Теперь при загрузке того же файла:
- Локальный парсер не найдет позиций
- CORE не будет вызван (disabled)
- Будут использованы templates

```bash
# Логи:
[ConcreteExtractor] Found 0 data rows for bridge SO 241
[CORE] CORE fallback is disabled (ENABLE_CORE_FALLBACK=false)
Created 11 positions for bridge SO 241 (source: templates, local_extracted: 0)
```

## Диагностика проблем

### CORE не отвечает

**Симптомы:**
```
[CORE] ⚠️ Cannot connect to CORE at http://localhost:8000 - Is CORE service running?
Created 11 positions for bridge SO 241 (source: templates, local_extracted: 0)
```

**Решение:**
1. Проверить что CORE запущен: `curl http://localhost:8000/api/health`
2. Проверить `CORE_API_URL` в .env
3. Проверить firewall/network

### CORE таймаут

**Симптомы:**
```
[CORE] ⏱️ Request timeout after 30000ms
```

**Решение:**
1. Увеличить `CORE_TIMEOUT` в .env (например, `60000`)
2. Проверить производительность CORE сервера
3. Уменьшить размер Excel файла

### CORE возвращает 0 позиций

**Симптомы:**
```
[CORE] ✅ Parsed 0 positions (format: unknown, raw: 150, normalized: 0)
CORE parser failed: CORE returned no positions, falling back to templates
```

**Решение:**
1. Проверить структуру Excel файла
2. Проверить логи CORE сервиса
3. Отправить файл напрямую в CORE API для диагностики

## Производительность

**Типичные времена парсинга:**

| Размер файла | Строк | Локальный | CORE | Итого с fallback |
|--------------|-------|-----------|------|------------------|
| 50 KB        | 100   | 50ms      | -    | 50ms             |
| 200 KB       | 500   | 150ms     | 800ms| 950ms            |
| 1 MB         | 2000  | 300ms     | 2s   | 2.3s             |

**Рекомендации:**
- CORE fallback добавляет ~1-2 секунды
- Используйте только когда локальный парсер не справляется
- В production можно настроить `ENABLE_CORE_FALLBACK=false` если все файлы стандартные

## Логи и мониторинг

### Полезные логи

**Успешный CORE fallback:**
```
[2024-11-17 10:30:15] No positions extracted from Excel for SO 241, trying CORE parser...
[2024-11-17 10:30:15] [CORE] Sending file to CORE parser: /tmp/abc123.xlsx
[2024-11-17 10:30:16] [CORE] ✅ Parsed 45 positions (format: OTSKP, raw: 150, normalized: 45)
[2024-11-17 10:30:16] ✅ CORE extracted 45 positions for SO 241
[2024-11-17 10:30:16] Created 45 positions for bridge SO 241 (source: core, local_extracted: 0)
```

**CORE недоступен:**
```
[2024-11-17 10:35:20] [CORE] ⚠️ Cannot connect to CORE at http://localhost:8000
[2024-11-17 10:35:20] CORE parser failed: connect ECONNREFUSED, falling back to templates
[2024-11-17 10:35:20] Created 11 positions for bridge SO 241 (source: templates, local_extracted: 0)
```

### Метрики

В ответе API добавлено поле `positions_source`:
- `"excel"` - извлечено локальным парсером
- `"core"` - извлечено CORE парсером
- `"templates"` - использованы шаблоны

Можно мониторить:
```sql
-- В будущем можно добавить в БД
SELECT positions_source, COUNT(*)
FROM uploads
GROUP BY positions_source;
```

## Архитектура

### Файлы

**CORE (concrete-agent):**
- `app/api/routes.py:1032-1102` - endpoint `/api/parse-excel`
- `app/parsers/smart_parser.py` - SmartParser
- `app/parsers/excel_parser.py` - ExcelParser
- `app/utils/position_normalizer.py` - нормализатор

**Monolit (Monolit-Planner):**
- `backend/src/services/coreAPI.js` - CORE API клиент
- `backend/src/routes/upload.js:111-145` - интеграция fallback
- `backend/.env.example` - конфигурация

### Формат данных

**CORE возвращает:**
```json
{
  "positions": [
    {
      "code": "22694",
      "description": "Beton C25/30",
      "unit": "m3",
      "quantity": 834.506
    }
  ]
}
```

**Monolit конвертирует в:**
```json
{
  "part_name": "Beton C25/30",
  "item_name": "Beton C25/30",
  "subtype": "beton",
  "unit": "M3",
  "qty": 834.506,
  "crew_size": 4,
  "wage_czk_ph": 398,
  "shift_hours": 10,
  "days": 0,
  "otskp_code": "22694"
}
```

## FAQ

**Q: Нужно ли всегда держать CORE запущенным?**
A: Нет, только если локальный парсер не справляется. Можно отключить через `ENABLE_CORE_FALLBACK=false`.

**Q: Можно ли использовать CORE как основной парсер?**
A: Да, можно модифицировать код чтобы всегда использовать CORE. Но это медленнее.

**Q: Что если CORE и локальный парсер дают разные результаты?**
A: Приоритет у локального парсера. CORE используется только если локальный вернул 0 позиций.

**Q: Можно ли парсить PDF через CORE?**
A: Да, CORE умеет парсить PDF. Нужно добавить аналогичный endpoint.

**Q: Сколько стоит запуск CORE?**
A: CORE - бесплатный open-source. Затраты только на хостинг (Render, AWS, etc).

## Следующие шаги

1. ✅ **Завершено**: Базовая интеграция CORE parser через HTTP API
2. ⏳ **TODO**: Добавить кеширование результатов парсинга
3. ⏳ **TODO**: Добавить retry логику при временных ошибках CORE
4. ⏳ **TODO**: Поддержка PDF парсинга через CORE
5. ⏳ **TODO**: Статистика использования CORE vs локального парсера

## Поддержка

Проблемы? Создайте issue в GitHub или свяжитесь с разработчиками.
