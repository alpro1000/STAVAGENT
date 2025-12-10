# 🔍 ГЛУБОКИЙ АНАЛИЗ: monolith-projects.js

**Файл:** `Monolit-Planner/backend/src/routes/monolith-projects.js`
**Анализ:** 2025-12-10
**Строки кода:** 552

---

## 📋 ОБЗОР

Это **универсальный API для управления проектами** монолитного строительства всех типов: мосты, здания, парковки, дороги, и кастомные объекты.

### Endpoints (5 маршрутов)
```
GET    /api/monolith-projects           - Список всех проектов
POST   /api/monolith-projects           - Создание нового проекта
GET    /api/monolith-projects/:id       - Детали проекта
PUT    /api/monolith-projects/:id       - Обновление проекта
DELETE /api/monolith-projects/:id       - Удаление проекта
GET    /api/monolith-projects/search/:type - Поиск по типу
```

---

## ✅ СИЛЬНЫЕ СТОРОНЫ

### 1. **Безопасность** ⭐⭐⭐⭐⭐

#### Аутентификация
```javascript
// Строка 23: Все роуты защищены
router.use(requireAuth);
```
- ✅ **JWT аутентификация** на всех эндпоинтах
- ✅ **Проверка владельца** (owner_id) на каждой операции
- ✅ **Защита от SQL-injection** через prepared statements

#### Проверка владельца на каждом действии
```javascript
// GET: Строка 362
const project = await db.prepare(`
  SELECT * FROM monolith_projects WHERE project_id = ? AND owner_id = ?
`).get(id, ownerId);

// UPDATE: Строка 405-407
// DELETE: Строка 506-508
```
✅ **Пользователи могут работать только со своими проектами**

#### Валидация входных данных
```javascript
// POST: Строки 108-130
if (!project_id || !object_type) {
  return res.status(400).json({ error: 'Required fields missing' });
}

if (!['bridge', 'building', 'parking', 'road', 'custom'].includes(object_type)) {
  return res.status(400).json({ error: 'Invalid object_type' });
}

// Валидация числовых полей
for (const [field, value] of Object.entries(numericFields)) {
  if (value !== undefined && value !== null) {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      return res.status(400).json({ error: `${field} must be a positive number` });
    }
  }
}
```
✅ **Предотвращает некорректные данные**

---

### 2. **Транзакционная целостность данных** ⭐⭐⭐⭐⭐

#### PostgreSQL Транзакция в POST (строки 185-322)
```javascript
// Строка 188-190: Начало транзакции
const pool = getPool();
client = await pool.connect();
await client.query('BEGIN');

try {
  // 1. Создание проекта
  await client.query(insertProjectSql, [...]);

  // 2. Создание частей (batch insert)
  await client.query(batchInsertSql, values);

  // 3. Создание позиций (опционально для bridge)
  await client.query(insertPositionsSql, positionValues);

  // Коммит
  await client.query('COMMIT');
} catch (txError) {
  // Откат при ошибке
  await client.query('ROLLBACK');
  throw txError;
} finally {
  // Освобождение клиента
  client.release();
}
```

✅ **Атомарность:** Либо создается ВСЁ (проект + части + позиции), либо НИЧЕГО
✅ **Откат при ошибке:** ROLLBACK предотвращает неконсистентные данные
✅ **Правильное управление ресурсами:** client.release() в finally

---

### 3. **Batch Insert для производительности** ⭐⭐⭐⭐⭐

#### Оптимизированная вставка частей (строки 229-248)
```javascript
// БЫЛО БЫ МЕДЛЕННО (N запросов):
for (const template of templates) {
  await client.query('INSERT INTO parts ...', [partId, ...]);
}

// БЫСТРО (1 запрос для всех):
const placeholders = templates.map((_, idx) => {
  const offset = idx * 4;
  return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
}).join(',');

const batchInsertSql = `
  INSERT INTO parts (part_id, project_id, part_name, is_predefined)
  VALUES ${placeholders}
`;

await client.query(batchInsertSql, values);
```

✅ **10-100x быстрее** для 5-10 частей
✅ **Меньше сетевых запросов**
✅ **Параметризованный запрос** (безопасно от SQL-injection)

---

### 4. **Подробное логирование** ⭐⭐⭐⭐⭐

```javascript
// Логирование на каждом этапе
logger.info(`[CREATE PROJECT] Starting creation for project_id: ${project_id}`);
logger.info(`[CREATE PROJECT] Transaction started`);
logger.info(`[CREATE PROJECT] ✓ Project created successfully`);
logger.info(`[CREATE PROJECT] ✅ SUCCESS - Project ${project_id} created`);

// Логирование ошибок с контекстом
logger.error(`[CREATE PROJECT] ❌ FAILED - Error creating project:`, error);
logger.error(`[CREATE PROJECT] Error stack:`, error.stack);
```

✅ **Префиксы [CREATE PROJECT]** для легкого поиска в логах
✅ **Эмодзи** для визуального разделения (✅ успех, ❌ ошибка, ⚠️ предупреждение)
✅ **Stack traces** для отладки

---

### 5. **Safety Check: Проверка шаблонов** ⭐⭐⭐⭐⭐

#### КРИТИЧЕСКАЯ проверка перед созданием (строки 138-180)
```javascript
// Проверяем, что шаблоны существуют
const templates = await db.prepare(`
  SELECT * FROM part_templates
  WHERE object_type = ? AND is_default = true
  ORDER BY display_order
`).all(object_type);

// SAFETY: Отклоняем создание проекта, если шаблонов нет
if (!templates || templates.length === 0) {
  logger.error(`❌ SAFETY CHECK FAILED - No templates found for ${object_type}`);

  // Диагностическая информация
  const allTemplateCount = await db.prepare('SELECT COUNT(*) as count FROM part_templates').get();
  const typesCounts = await db.prepare(`
    SELECT object_type, COUNT(*) as count
    FROM part_templates
    GROUP BY object_type
  `).all();

  return res.status(503).json({
    error: `Template loading failed for '${object_type}'. Please contact administrator.`,
    details: {
      object_type,
      available_templates: templateCount,
      total_templates_in_db: allTemplateCount.count,
      available_types: typesCounts.map(t => ({ type: t.object_type, count: t.count })),
      required_for_creation: true,
      suggestion: 'Restart application to trigger template loading'
    }
  });
}

logger.info(`✅ SAFETY CHECK PASSED - ${templateCount} templates ready`);
```

✅ **Предотвращает создание "пустых" проектов** без структуры
✅ **Детальная диагностика** для администратора
✅ **503 Service Unavailable** - правильный HTTP код для проблем с инфраструктурой

---

## ⚠️ ПРОБЛЕМЫ И РИСКИ

### 1. **🔴 КРИТИЧЕСКАЯ: Двойная база данных (SQLite + PostgreSQL)** ⭐⚠️⚠️⚠️⚠️

#### Проблема: Несогласованность данных
```javascript
// Строка 188-190: ЗАПИСЬ в PostgreSQL
const pool = getPool();
client = await pool.connect();
await client.query('BEGIN');
await client.query(insertProjectSql, [...]);  // PostgreSQL INSERT
await client.query('COMMIT');

// Строка 326: ЧТЕНИЕ из SQLite
const project = await db.prepare('SELECT * FROM monolith_projects WHERE project_id = ?').get(project_id);
```

#### Риски:
1. **Рассинхронизация:** SQLite может не видеть данные, записанные в PostgreSQL
2. **Race conditions:** Данные могут прийти с задержкой
3. **Replication lag:** Если SQLite - read replica, возможна задержка
4. **Неконсистентность:** Разные результаты при чтении из разных БД

#### Где происходит:
- **POST /api/monolith-projects** (строка 326)
- **GET /api/monolith-projects** (строка 69)
- **GET /api/monolith-projects/:id** (строка 365)
- **PUT /api/monolith-projects/:id** (строка 447, 483)
- **DELETE /api/monolith-projects/:id** (строка 515)

#### Решение:
```javascript
// ВАРИАНТ 1: Использовать только PostgreSQL
const pool = getPool();
const result = await pool.query('SELECT * FROM monolith_projects WHERE project_id = $1', [project_id]);
const project = result.rows[0];

// ВАРИАНТ 2: Синхронизировать SQLite после записи в PostgreSQL (сложно)
// ВАРИАНТ 3: Миграция на единую БД (рекомендуется)
```

---

### 2. **🟡 СРЕДНЯЯ: Ограничение на создание позиций только для bridge** ⚠️⚠️⚠️

#### Проблема: Асимметричная функциональность
```javascript
// Строка 256-306: Позиции создаются ТОЛЬКО для bridge
if (templates.length > 0 && object_type === 'bridge') {
  // Создание позиций...
} else if (templates.length > 0) {
  logger.info(`ℹ️ Skipped position creation for object_type=${object_type}`);
}
```

#### Последствия:
- ❌ **building, parking, road, custom** - без позиций
- ❌ **Неполная функциональность** для других типов
- ❌ **Пользователи не могут экспортировать** проекты non-bridge типов

#### Причина:
```javascript
// Строка 253: TODO комментарий
// TODO: Refactor to support positions for all object types (not just bridges)
```

**Schema constraint:** Таблица `positions` имеет FK на `bridges`, а не на `monolith_projects`

#### Решение:
```sql
-- Изменить схему:
ALTER TABLE positions ADD COLUMN project_id TEXT;
ALTER TABLE positions ADD FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id);
-- Удалить старый FK на bridges
```

---

### 3. **🟡 СРЕДНЯЯ: ON CONFLICT DO NOTHING скрывает ошибки** ⚠️⚠️

```javascript
// Строка 293-294
INSERT INTO positions (...)
VALUES (...)
ON CONFLICT (id) DO NOTHING
```

#### Проблема:
- **Молча игнорирует** дубликаты
- **Не логирует** конфликты
- **Не возвращает** информацию о том, сколько строк пропущено

#### Решение:
```javascript
// ВАРИАНТ 1: Логировать конфликты
const result = await client.query(insertPositionsSql + ' RETURNING id', positionValues);
if (result.rowCount < defaultPositions.length) {
  logger.warn(`[CREATE PROJECT] ⚠️ ${defaultPositions.length - result.rowCount} positions skipped (conflicts)`);
}

// ВАРИАНТ 2: ON CONFLICT DO UPDATE (если нужна идемпотентность)
ON CONFLICT (id) DO UPDATE SET
  qty = EXCLUDED.qty,
  crew_size = EXCLUDED.crew_size
```

---

### 4. **🟡 СРЕДНЯЯ: Backward compatibility alias загрязняет API** ⚠️⚠️

```javascript
// В каждом ответе:
return res.json({
  ...project,
  bridge_id: project.project_id  // Строки 337, 345, 385, 487
});
```

#### Проблема:
- **Дублирование данных:** `project_id` и `bridge_id` содержат одно и то же
- **Запутывает пользователей:** Не ясно, какое поле использовать
- **Увеличивает размер ответа**

#### Решение:
```javascript
// Фаза 1: Добавить deprecation warning
res.json({
  ...project,
  bridge_id: project.project_id,  // @deprecated Use project_id instead
  _meta: {
    deprecated_fields: ['bridge_id'],
    migration_guide: 'https://docs.example.com/migration'
  }
});

// Фаза 2 (через 6 месяцев): Удалить bridge_id
res.json(project);
```

---

### 5. **🟢 НИЗКАЯ: Отсутствие пагинации в GET /api/monolith-projects** ⚠️

```javascript
// Строка 69: Возвращает ВСЕ проекты
const projects = await db.prepare(query).all(...params);
res.json(projects);
```

#### Проблема:
- Пользователь с **1000+ проектами** получит огромный ответ
- **Медленная загрузка** в UI
- **Высокое потребление памяти**

#### Решение:
```javascript
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 50;
const offset = (page - 1) * limit;

query += ` LIMIT ${limit} OFFSET ${offset}`;

const total = await db.prepare('SELECT COUNT(*) as count FROM monolith_projects WHERE owner_id = ?').get(ownerId);

res.json({
  projects,
  pagination: {
    page,
    limit,
    total: total.count,
    totalPages: Math.ceil(total.count / limit)
  }
});
```

---

### 6. **🟢 НИЗКАЯ: COALESCE может скрыть ошибки в PUT** ⚠️

```javascript
// Строка 447-464: UPDATE с COALESCE
UPDATE monolith_projects SET
  project_name = COALESCE(?, project_name),
  object_name = COALESCE(?, object_name),
  ...
WHERE project_id = ?
```

#### Проблема:
- **null/undefined** не обновляют поле (остается старое значение)
- Невозможно **очистить поле** (установить в пустую строку)

#### Когда это проблема:
```javascript
// Попытка очистить description:
PUT /api/monolith-projects/123
{ "description": null }

// Результат: description НЕ изменится (COALESCE вернет старое значение)
```

#### Решение:
```javascript
// ВАРИАНТ 1: Явное перечисление полей для обновления
const updates = [];
const values = [];
let idx = 1;

if (project_name !== undefined) {
  updates.push(`project_name = $${idx++}`);
  values.push(project_name);
}
if (description !== undefined) {
  updates.push(`description = $${idx++}`);
  values.push(description);
}
// ...

if (updates.length === 0) {
  return res.status(400).json({ error: 'No fields to update' });
}

const sql = `UPDATE monolith_projects SET ${updates.join(', ')} WHERE project_id = $${idx}`;
values.push(id);

// ВАРИАНТ 2: Специальный токен для очистки
// Клиент отправляет: { "description": "__CLEAR__" }
// Сервер проверяет: if (description === '__CLEAR__') description = '';
```

---

## 🏗️ АРХИТЕКТУРНЫЙ АНАЛИЗ

### Паттерны и практики

#### ✅ Используются хорошие паттерны:
1. **Separation of Concerns:**
   - Routes (этот файл) - HTTP обработка
   - Database (db/init.js, db/postgres.js) - работа с БД
   - Utils (positionDefaults.js) - бизнес-логика
   - Middleware (auth.js) - аутентификация

2. **Error Handling:**
   - Try-catch на каждом endpoint
   - Подробные логи ошибок
   - HTTP коды: 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 409 (Conflict), 500 (Internal Error), 503 (Service Unavailable)

3. **Transaction Management:**
   - BEGIN → операции → COMMIT/ROLLBACK
   - finally блок для освобождения ресурсов

4. **Batch Operations:**
   - Batch insert для частей и позиций
   - Сокращает количество запросов

#### ❌ Анти-паттерны:
1. **Dual Database Pattern** (SQLite + PostgreSQL)
2. **Magic Numbers:** Hardcoded 12 columns в строке 268
3. **Deep Nesting:** 5+ уровней вложенности в POST handler

---

## 📊 ПРОИЗВОДИТЕЛЬНОСТЬ

### Оптимизации
✅ **Batch Insert:** 1 запрос вместо N
✅ **Prepared Statements:** Переиспользование планов запросов
✅ **LEFT JOIN вместо N+1:** Строка 51 (parts_count в одном запросе)

### Проблемы
⚠️ **Нет индексов** (предполагается, что они есть в схеме):
```sql
-- Необходимые индексы:
CREATE INDEX idx_mp_owner_id ON monolith_projects(owner_id);
CREATE INDEX idx_mp_object_type ON monolith_projects(object_type);
CREATE INDEX idx_mp_status ON monolith_projects(status);
CREATE INDEX idx_parts_project_id ON parts(project_id);
```

⚠️ **Отсутствие кэширования:**
- Templates запрашиваются при каждом создании проекта
- Можно кэшировать в памяти с TTL 1 час

---

## 🔒 БЕЗОПАСНОСТЬ (детальный анализ)

### ✅ Что защищено:
1. **SQL Injection:** Prepared statements везде
2. **Authentication:** requireAuth middleware
3. **Authorization:** Проверка owner_id
4. **Input Validation:** Проверка типов и диапазонов
5. **DoS Prevention:** Валидация перед тяжелыми операциями

### ⚠️ Потенциальные уязвимости:

#### 1. **No Rate Limiting**
Злоумышленник может создавать проекты в цикле:
```javascript
// Нет ограничения на количество запросов
POST /api/monolith-projects (repeat 10000 times)
```

**Решение:**
```javascript
import rateLimit from 'express-rate-limit';

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many projects created, please try again later'
});

router.post('/', createLimiter, async (req, res) => { ... });
```

#### 2. **No Project Count Limit**
Пользователь может создать неограниченное количество проектов:
```javascript
// Нет проверки на максимальное количество проектов
```

**Решение:**
```javascript
// В POST, перед созданием:
const userProjectCount = await db.prepare(`
  SELECT COUNT(*) as count FROM monolith_projects WHERE owner_id = ?
`).get(ownerId);

const MAX_PROJECTS_PER_USER = 1000;
if (userProjectCount.count >= MAX_PROJECTS_PER_USER) {
  return res.status(429).json({
    error: 'Project limit reached',
    limit: MAX_PROJECTS_PER_USER
  });
}
```

#### 3. **No Input Size Limit**
Поля `description`, `project_name`, `object_name` могут быть очень длинными:
```javascript
POST /api/monolith-projects
{
  "description": "A".repeat(1000000)  // 1 MB строка
}
```

**Решение:**
```javascript
const MAX_STRING_LENGTH = 10000;

if (description && description.length > MAX_STRING_LENGTH) {
  return res.status(400).json({
    error: `description exceeds maximum length of ${MAX_STRING_LENGTH} characters`
  });
}
```

---

## 🧪 ТЕСТИРУЕМОСТЬ

### Проблемы:
1. **Тесная связь с БД:** Сложно мокировать
2. **Зависимость от глобальных объектов:** db, getPool(), logger
3. **Отсутствие интерфейсов:** Нет абстракции над БД

### Решение:
```javascript
// Dependency Injection:
export function createMonolithProjectsRouter(deps) {
  const { db, pool, logger, auth } = deps;
  const router = express.Router();

  router.use(auth.requireAuth);

  router.get('/', async (req, res) => {
    const projects = await db.prepare(query).all(...params);
    res.json(projects);
  });

  return router;
}

// В тестах:
const mockDb = { prepare: jest.fn() };
const mockPool = { connect: jest.fn() };
const mockLogger = { info: jest.fn(), error: jest.fn() };
const router = createMonolithProjectsRouter({ db: mockDb, pool: mockPool, logger: mockLogger });
```

---

## 📝 РЕКОМЕНДАЦИИ

### 🔴 Критические (сделать немедленно):
1. **Унифицировать доступ к БД:** Либо SQLite, либо PostgreSQL
2. **Добавить индексы:** На owner_id, object_type, status
3. **Добавить rate limiting:** На POST endpoint

### 🟡 Важные (сделать в течение месяца):
4. **Поддержка позиций для всех типов:** Изменить схему БД
5. **Добавить пагинацию:** На GET endpoint
6. **Ограничение размера строк:** Валидация длины
7. **Логировать ON CONFLICT:** Мониторить конфликты

### 🟢 Улучшения (сделать когда будет время):
8. **Убрать bridge_id alias:** Миграция API
9. **Кэширование шаблонов:** Уменьшить нагрузку на БД
10. **Dependency Injection:** Улучшить тестируемость
11. **Фикс COALESCE:** Позволить очистку полей

---

## ✅ ИТОГОВАЯ ОЦЕНКА

### Оценка по категориям (из 5):
- **Безопасность:** ⭐⭐⭐⭐☆ (4/5) - Хорошо, но нет rate limiting
- **Производительность:** ⭐⭐⭐⭐☆ (4/5) - Batch insert хорош, но нет пагинации
- **Надежность:** ⭐⭐⭐☆☆ (3/5) - Транзакции хороши, но dual DB - риск
- **Читаемость:** ⭐⭐⭐⭐☆ (4/5) - Отличные комментарии и логи
- **Тестируемость:** ⭐⭐☆☆☆ (2/5) - Сложно тестировать

### Общая оценка: **⭐⭐⭐⭐☆ (3.5/5)**

**Код хороший, но требует исправления dual database pattern.**

---

## 🎯 ТОП-3 ПРИОРИТЕТА

1. **Унифицировать БД (SQLite ИЛИ PostgreSQL, но не оба)**
2. **Добавить rate limiting на POST**
3. **Расширить поддержку позиций для всех типов объектов**

---

**Анализ завершен:** 2025-12-10
**Аналитик:** Claude AI Assistant
