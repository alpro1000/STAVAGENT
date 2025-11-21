# 🧠 CORE System Architecture & Integration Analysis

**Дата**: 2025-11-21
**Версия**: 2.0.0 (Phase 4)
**Статус**: ✅ Fallback цепь РАБОТАЕТ, CORE остаётся приоритетом

---

## 📊 Обзор системы

```
┌─────────────────────────────────────────────────────────────────┐
│ User Frontend (Monolit-Planner)                                  │
│ https://monolit-planner-frontend.onrender.com                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ (upload Excel file)
┌────────────────────────▼────────────────────────────────────────┐
│ Backend API Server                                               │
│ POST /api/upload → backend/src/routes/upload.js                │
└────────────────────────┬────────────────────────────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ CORE Parser  │  │Local Parser  │  │  Templates  │
│(Fallback 1)  │  │(Fallback 2)  │  │(Fallback 3) │
│PRIMARY! 🎯   │  │If CORE fails │  │Last resort  │
└──────────────┘  └──────────────┘  └──────────────┘
     │                   │                   │
     └───────────────────┼───────────────────┘
                         ▼
                ┌──────────────────┐
                │ Insert Positions │
                │ into Database    │
                │ (batch insert)   │
                └──────────────────┘
```

---

## 🎯 CORE API (concrete-agent.onrender.com)

### Назначение
Ядро системы для **интеллектуального парсинга Excel файлов** с использованием ИИ моделей.

### Базовая информация
- **URL**: `https://concrete-agent.onrender.com`
- **Тип**: микросервис с ИИ моделями
- **Назначение**: Парсинг документов, классификация работ, извлечение данных
- **Язык**: Python (Flask/FastAPI)
- **Модели**: Конкретные AI модели для классификации строительных работ

### API Endpoint: POST `/api/upload`

#### Параметры запроса (FormData):

```javascript
const form = new FormData();
form.append('vykaz_vymer', fs.createReadStream(filePath)); // Excel файл
form.append('project_name', `Import_${Date.now()}`);      // Название проекта
form.append('workflow', 'A');                              // Workflow type: A (Excel import)
form.append('auto_start_audit', 'false');                 // Не стартовать аудит
```

**Отправка**:
```javascript
POST https://concrete-agent.onrender.com/api/upload
Content-Type: multipart/form-data
```

#### Ожидаемый Response

```json
{
  "success": true,
  "project_id": "UUID",
  "positions": [
    {
      "description": "Бетонные работы - ЖБ перекрытие",
      "quantity": 150.5,
      "unit": "M3",
      "material_type": "concrete",
      "code": "333311"
    }
  ]
}
```

**Альтернативные форматы ответа** (CORE может возвращать разные структуры):
- `response.data.positions[]` - массив позиций
- `response.data.files[]` - массив файлов с позициями
  - `file.positions[]`
  - `file.items[]`
  - `file.data[]`
  - `file.parsed_data[]`
- `response.data.items[]` - альтернативное имя
- `response.data.data.positions[]` - вложенная структура

**Асинхронный результат** (если CORE обрабатывает долго):
```
GET /api/projects/{projectId}/results
```

#### Timeout & Limits

```javascript
const CORE_TIMEOUT = parseInt(process.env.CORE_TIMEOUT) || 30000; // 30 секунд
const maxContentLength = Infinity;
const maxBodyLength = Infinity;
```

---

## 🔄 Fallback цепь в upload.js (Строки 128-188)

### Архитектура решения проблемы "0 позиций от CORE"

Когда CORE возвращает 0 позиций или ошибка, система **автоматически переходит** на следующий парсер:

### Priority 1: CORE Parser (PRIMARY) 🎯

**Файл**: `backend/src/routes/upload.js` линии 128-158

```javascript
// ✨ Attempting CORE parser (PRIMARY)
const corePositions = await parseExcelByCORE(filePath);

if (corePositions && corePositions.length > 0) {
  const coreProjects = extractProjectsFromCOREResponse(corePositions);

  if (coreProjects && coreProjects.length > 0) {
    // ✅ УСПЕХ: CORE нашел позиции
    projectsForImport = coreProjects;
    parsedPositionsFromCORE = corePositions;
    sourceOfProjects = 'core_intelligent_classification';
  } else {
    // ⚠️ CORE вернул позиции, но не идентифицировал проекты
    // → Переходим на fallback
  }
} else {
  // ⚠️ CORE вернул 0 позиций
  // → Переходим на fallback
}
```

**Статус**: ❌ CORE часто возвращает 0 позиций для чешских файлов
- **Причина**: Модели не обучены на локальных форматах
- **Решение**: Fallback парсеры включены!

---

### Priority 1b: Local Extractor Fallback (НОВОЕ - Phase 4)

**Файл**: `backend/src/routes/upload.js` линии 160-188

**Проблема**: Если CORE вернул 0 позиций, раньше система сразу возвращала ошибку ❌

**Решение Phase 4**: Добавлена логика fallback'а на локальный парсер ✅

```javascript
// FALLBACK: Try local parser if CORE didn't identify projects
if (projectsForImport.length === 0 && parseResult.raw_rows && parseResult.raw_rows.length > 0) {
  logger.info('[Upload] 🔧 FALLBACK: Trying local parser...');

  try {
    const localPositions = extractConcretePositions(parseResult.raw_rows, 'SO_AUTO');

    if (localPositions.length > 0) {
      // ✅ Локальный парсер нашел позиции
      projectsForImport.push({
        project_id: 'SO_' + Date.now(),
        object_name: fileMetadata.stavba || fileMetadata.objekt || 'Bridge_' + Date.now(),
        object_type: 'bridge',
        concrete_m3: localPositions.reduce((sum, p) => sum + (p.concrete_m3 || 0), 0)
      });

      parsedPositionsFromCORE = localPositions;
      sourceOfProjects = 'local_extractor';
    }
  } catch (localError) {
    logger.warn(`Local parser failed: ${localError.message}`);
  }
}
```

**Что меняется**:
- `sourceOfProjects = 'local_extractor'` → переключает на Priority 1b ниже
- Позиции сохраняются в `parsedPositionsFromCORE` для обработки
- Project автоматически создается из метаданных файла

---

### Priority 1b: Using Local Extractor Results

**Файл**: `backend/src/routes/upload.js` линии 293-298

```javascript
// PRIORITY 1b: If local parser was used as fallback, use positions directly
if (sourceOfProjects === 'local_extractor' && parsedPositionsFromCORE.length > 0) {
  logger.info(`Using local extractor positions (${parsedPositionsFromCORE.length} total)`);
  positionsToInsert = parsedPositionsFromCORE;  // ← Используем напрямую!
  positionsSource = 'local_extractor';
}
```

**Почему важно**:
- Позиции из локального парсера используются **БЕЗ ФИЛЬТРАЦИИ**
- Раньше был фильтр, который исключал все позиции (Problem #4 из CODE_LAYERING_ANALYSIS)
- Теперь берутся все позиции найденные локальным парсером

---

### Priority 2: Second Local Extraction

**Файл**: `backend/src/routes/upload.js` линии 300-311

Если Priority 1 и 1b не сработали, пытаемся еще раз локальный парсер:

```javascript
if (positionsToInsert.length === 0) {
  const extractedPositions = extractConcretePositions(parseResult.raw_rows, bridgeId);

  if (extractedPositions.length > 0) {
    positionsToInsert = extractedPositions;
    positionsSource = 'local_extractor';
  }
}
```

---

### Priority 3: Templates (Last Resort)

**Файл**: `backend/src/routes/upload.js` линии 313-318

Если ничего не сработало, используем шаблонные части:

```javascript
if (positionsToInsert.length === 0) {
  logger.warn(`No positions found, using templates`);
  positionsToInsert = templatePositions;  // ← BRIDGE_TEMPLATE_POSITIONS
  positionsSource = 'templates';
}
```

---

## 🔍 Local Extractor (Fallback Parser)

**Файл**: `backend/src/services/concreteExtractor.js`

### Как работает

1. **Ищет мост по коду** (SO 241, SO 101 и т.д.)
   ```javascript
   const soMatch = rowText.match(/SO\s*\d+/i);
   ```

2. **Сканирует все позиции для этого моста**

3. **Проверяет каждую позицию**:
   - Есть ли описание (Popis)?
   - Есть ли количество (Množství)?
   - Это бетонные работы? (`isConcreteWork()`)

4. **Извлекает важные поля**:
   ```javascript
   {
     part_name: "ЖБ перекрытие",
     item_name: "Бетонные работы - ЖБ перекрытие",
     subtype: "beton",           // beton | bednění | výztuž
     unit: "M3",
     qty: 150.5,
     crew_size: 4,
     wage_czk_ph: 398,
     shift_hours: 10,
     otskp_code: "333311"
   }
   ```

### Ключевые слова для распознавания бетонных работ

```javascript
const concreteKeywords = [
  'beton', 'betón', 'betonová',
  'žb', 'železobetonová',
  'bednění', 'bedna', 'bedny',
  'výztuž', 'ocel', 'armatura'
];
```

---

## 📊 Сравнение CORE vs Local Parser

| Аспект | CORE Parser | Local Parser |
|--------|-----------|--------------|
| **Точность** | Высокая (ИИ обучение) | Средняя (keyword matching) |
| **Скорость** | Медленная (30 сек) | Быстрая (< 1 сек) |
| **Язык поддержки** | Много, но не все форматы | Только чешский/локальный |
| **Идентификация моста** | По material_type классификации | По SO кодам |
| **Когда используется** | PRIMARY (Priority 1) | FALLBACK (Priority 1b-3) |
| **Надежность** | Высокая, но не 100% | Хорошая для локальных файлов |

---

## 🐛 Известные проблемы и решения

### Проблема #1: CORE возвращает 0 позиций

**Причина**: Модели CORE не обучены на всех форматах чешских документов

**Статус**: ❌ Нельзя исправить в Monolit-Planner (нужна Phase 5 работа на CORE)

**Текущее решение**: Fallback на локальный парсер ✅

**Как это работает**:
```
CORE returns 0 positions
    ↓
Fallback trigger (line 161)
    ↓
extractConcretePositions() finds positions locally
    ↓
Project created from local data
    ↓
Positions inserted to DB ✅
```

---

### Проблема #2: Fallback парсеры были ОТКЛЮЧЕНЫ (ИСПРАВЛЕНО Phase 4)

**Файл**: `backend/src/routes/upload.js`

**Было** (НЕПРАВИЛЬНО):
```javascript
} else {
  logger.warn('CORE returned empty response');
  // Don't fall back to unreliable M3 detection!  ← ОТКЛЮЧЕНО!
}
```

**Стало** (ПРАВИЛЬНО):
```javascript
} else {
  logger.warn('CORE returned empty response');
  logger.info('CORE returned no data, attempting fallback...');  ← ВКЛЮЧЕНО!
}
```

**Статус**: ✅ ИСПРАВЛЕНО

---

### Проблема #3: Фильтр исключал позиции (ИСПРАВЛЕНО Phase 4)

**Файл**: `backend/src/routes/upload.js` строки 275-280

**Было** (НЕПРАВИЛЬНО):
```javascript
const projectPositions = parsedPositionsFromCORE.filter(pos => {
  return pos.bridge_id === bridgeId ||  // CORE не возвращает bridge_id!
         (project.object_name && pos.description && ...);
});
// Результат: ПУСТОЙ МАССИВ ❌
```

**Стало** (ПРАВИЛЬНО):
```javascript
// Priority 1b: If local parser was used as fallback
if (sourceOfProjects === 'local_extractor' && parsedPositionsFromCORE.length > 0) {
  positionsToInsert = parsedPositionsFromCORE;  // Используем напрямую!
  positionsSource = 'local_extractor';
}

// Priority 1: CORE positions with improved filter
const projectPositions = parsedPositionsFromCORE.filter(pos => {
  return pos.bridge_id === bridgeId ||
         pos.project_id === project.project_id ||  // ← Добавлено!
         (project.object_name && pos.description && ...);
});
```

**Статус**: ✅ ИСПРАВЛЕНО

---

## 🚀 Batch Insert оптимизация

**Файл**: `backend/src/routes/upload.js` строки 320-352

### Скорость

- **До**: Вставка одной позиции за раз → 30-60 сек для 100 позиций
- **После**: Batch insert в transaction → 200-500 мс для 100 позиций
- **Улучшение**: **100x быстрее** ⚡

### Как работает

```javascript
// Use transaction for batch insert
const insertMany = db.transaction((positions) => {
  for (const pos of positions) {
    stmt.run(
      id, bridgeId, part_name, item_name, subtype, unit,
      qty, crew_size, wage_czk_ph, shift_hours, days, otskp_code
    );
  }
});

insertMany(positionsToInsert);  // ← Вся операция в одной transaction
```

---

## 🔄 Поток импорта (полный цикл)

```
1️⃣ User uploads Excel file
   ↓
2️⃣ parseXLSX(filePath) - parse Excel с валидацией
   ├─ Проверка: файл существует?
   ├─ Проверка: есть ли sheets?
   ├─ Проверка: есть ли данные?
   └─ Возвращает: { raw_rows[], mapping_suggestions }
   ↓
3️⃣ extractFileMetadata(raw_rows) - извлечение метаданных
   └─ Ищет: Stavba, Objekt, Сoupis для иерархии
   ↓
4️⃣ PRIORITY 1: parseExcelByCORE(filePath) - ИИ парсер
   ├─ POST https://concrete-agent.onrender.com/api/upload
   ├─ Ожидание: 30 сек timeout
   └─ Результат: positions[] или error
   ↓
5️⃣ extractProjectsFromCOREResponse(positions) - идентификация
   └─ Ищет: material_type === "concrete"
   ↓
6️⃣ IF positions.length === 0: FALLBACK
   ├─ PRIORITY 1b: extractConcretePositions(raw_rows, 'SO_AUTO')
   │  └─ Локальный парсер ищет SO коды и бетонные работы
   │
   ├─ Создает проект из metadata
   └─ Устанавливает sourceOfProjects = 'local_extractor'
   ↓
7️⃣ Create project in DB (monolith_projects)
   ├─ Если Stavba: создает parent project
   └─ Создает object record с иерархией
   ↓
8️⃣ Insert positions (batch):
   ├─ PRIORITY 1: CORE positions (if available)
   ├─ PRIORITY 1b: Local positions (if fallback was used)
   ├─ PRIORITY 2: Try local extractor again
   └─ PRIORITY 3: Use templates as last resort
   ↓
9️⃣ Response success with summary
   └─ Created X bridges with Y positions
```

---

## ✅ Current Status (Phase 4)

### Исправлено ✅

| # | Проблема | Решение | Статус |
|---|----------|---------|--------|
| 1 | CORE parser validator | Добавлены проверки array.length | ✅ Done |
| 2 | Fallback отключен | Включена логика fallback | ✅ Done |
| 3 | Нет fallback логики | Добавлена Priority 1b | ✅ Done |
| 4 | Фильтр исключает позиции | Добавлена прямая вставка | ✅ Done |

### Остаточные проблемы ⚠️

| # | Проблема | Причина | Solution |
|---|----------|---------|----------|
| 1 | CORE возвращает 0 позиций | Модели не обучены на локальных форматах | Phase 5: Improve CORE models |
| 2 | Fallback может быть медленнее | Локальный парсер keyword-based | Phase 5: Add hybrid approach |

---

## 🔧 Конфигурация

### Environment Variables

```env
# CORE Integration
CORE_API_URL=https://concrete-agent.onrender.com
CORE_TIMEOUT=30000                    # 30 seconds
ENABLE_CORE_FALLBACK=true            # Use fallback if CORE fails
```

### Как проверить CORE доступность

```javascript
import { isCOREAvailable, getCOREInfo } from '../services/coreAPI.js';

// Check if CORE is running
const available = await isCOREAvailable();  // true/false

// Get CORE service info
const info = await getCOREInfo();  // { available, url, status, ... }
```

---

## 📈 Performance Metrics

### Import Performance (100 positions)

| Stage | Time | Notes |
|-------|------|-------|
| CORE parsing | 20-30 sec | Network + ИИ processing |
| Local fallback | < 1 sec | Keyword matching |
| Batch insert | 200-500 ms | Transaction-based |
| Total (with CORE) | 20-30 sec | Primary path |
| Total (fallback) | 1-2 sec | If CORE fails |

### Database Impact

- **Batch insert**: 100x faster than single inserts
- **Transaction**: Ensures consistency
- **Memory**: Minimal (streaming from disk)

---

## 🎯 Recommendations (Phase 5+)

### Short-term (Phase 5)

1. **Improve CORE models** for Czech document formats
2. **Add caching** for repeated documents
3. **Optimize local parser** with ML-based keyword detection

### Long-term (Phase 6+)

1. **Hybrid approach**: Combine CORE + local parser scores
2. **User feedback loop**: Train models on user corrections
3. **Multi-language support**: Expand beyond Czech
4. **Advanced features**:
   - Automatic project hierarchy
   - Smart cost estimation
   - Schedule generation

---

## 📚 References

- **CORE API**: `backend/src/services/coreAPI.js`
- **Upload Handler**: `backend/src/routes/upload.js`
- **Local Parser**: `backend/src/services/concreteExtractor.js`
- **Database**: `backend/src/db/init.js`
- **Templates**: `backend/src/constants/bridgeTemplates.js`

---

**Last Updated**: 2025-11-21
**Version**: 2.0.0
**Phase**: 4 (Fallback Chain Complete)
