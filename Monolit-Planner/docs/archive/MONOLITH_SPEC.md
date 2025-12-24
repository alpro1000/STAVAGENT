# 📐 MonolithProject Specification

## Введение

Это полная спецификация универсального объекта `MonolithProject`, который заменяет жесткую сущность `Bridge` и поддерживает:
- Мосты (Most)
- Здания (Budova)
- Гаражи/Подземные сооружения (Garáž)
- Дороги (Cesta)
- Произвольные объекты (Vlastní)

---

## 1. Основная таблица: monolith_projects

### Схема БД

```sql
CREATE TABLE monolith_projects (
  project_id TEXT PRIMARY KEY,           -- "SO201", "BD001", "PK005"
  object_type TEXT NOT NULL DEFAULT 'custom',
                                         -- 'bridge', 'building', 'parking', 'road', 'custom'

  project_name TEXT DEFAULT '',          -- "D6 Žalmanov" (опционально)
  object_name TEXT NOT NULL DEFAULT '',  -- "Most na D6", "Administrativní budova"

  owner_id INTEGER NOT NULL,             -- Ссылка на users table
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  -- Метрики (вычисляются)
  element_count INTEGER DEFAULT 0,       -- Количество элементов
  concrete_m3 REAL DEFAULT 0,            -- Всего бетона (m³)
  sum_kros_czk REAL DEFAULT 0,           -- Сумма KROS (CZK)

  -- Мосты (специфичные поля, опциональны)
  span_length_m REAL,                    -- Длина пролета (м)
  deck_width_m REAL,                     -- Ширина проезжей части (м)
  pd_weeks REAL,                         -- Длительность проекта (недель)

  -- Здания
  building_area_m2 REAL,                 -- Площадь строения (м²)
  building_floors INTEGER,               -- Количество этажей

  -- Дороги
  road_length_km REAL,                   -- Длина дороги (км)
  road_width_m REAL,                     -- Ширина (м)

  -- Метаданные
  description TEXT,                      -- Описание проекта
  status TEXT DEFAULT 'active',          -- 'active', 'completed', 'archived'

  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX idx_projects_owner ON monolith_projects(owner_id);
CREATE INDEX idx_projects_type ON monolith_projects(object_type);
CREATE INDEX idx_projects_status ON monolith_projects(status);
```

### Примеры данных

```json
[
  {
    "project_id": "SO201",
    "object_type": "bridge",
    "project_name": "D6 Žalmanov",
    "object_name": "Most na D6",
    "owner_id": 1,
    "concrete_m3": 156.0,
    "span_length_m": 45.0,
    "deck_width_m": 12.5
  },
  {
    "project_id": "BD001",
    "object_type": "building",
    "project_name": "Administrativní centrum",
    "object_name": "Hlavní budova",
    "owner_id": 1,
    "concrete_m3": 450.0,
    "building_area_m2": 2500.0,
    "building_floors": 5
  },
  {
    "project_id": "PK005",
    "object_type": "parking",
    "object_name": "Podzemní garáž",
    "owner_id": 1,
    "concrete_m3": 800.0,
    "building_area_m2": 3500.0
  }
]
```

---

## 2. Таблица шаблонов: part_templates

### Назначение

Предустановленные части для каждого типа объекта. Пользователь выбирает тип объекта → автоматически загружаются части из шаблона.

### Схема БД

```sql
CREATE TABLE part_templates (
  template_id TEXT PRIMARY KEY,          -- "bridge_ZÁKLADY", "building_SLOUPY"
  object_type TEXT NOT NULL,             -- 'bridge', 'building', 'parking', 'road'
  part_name TEXT NOT NULL,               -- "ZÁKLADY", "OPĚRY", "SLOUPY"

  display_order INTEGER DEFAULT 0,       -- Порядок отображения (1, 2, 3...)
  is_default BOOLEAN DEFAULT TRUE,       -- Включается по умолчанию?

  description TEXT,                      -- Описание части (опционально)

  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_type ON part_templates(object_type);
```

### Семена (seed data)

```sql
-- МОСТЫ
INSERT INTO part_templates VALUES
  ('bridge_ZÁKLADY', 'bridge', 'ZÁKLADY', 1, TRUE, 'Фундаменты под опоры'),
  ('bridge_OPĚRY', 'bridge', 'OPĚRY', 2, TRUE, 'Опоры (абатменты)'),
  ('bridge_PILÍŘE', 'bridge', 'PILÍŘE', 3, TRUE, 'Промежуточные опоры'),
  ('bridge_KLENBY', 'bridge', 'KLENBY', 4, TRUE, 'Пролетные строения'),
  ('bridge_ŘÍMSY', 'bridge', 'ŘÍMSY', 5, TRUE, 'Карнизы и откосы');

-- ЗДАНИЯ
INSERT INTO part_templates VALUES
  ('building_ZÁKLADY', 'building', 'ZÁKLADY', 1, TRUE, 'Фундаменты'),
  ('building_SLOUPY', 'building', 'SLOUPY', 2, TRUE, 'Несущие колонны'),
  ('building_STĚNY', 'building', 'STĚNY', 3, TRUE, 'Стены'),
  ('building_STROPY', 'building', 'STROPY', 4, TRUE, 'Перекрытия'),
  ('building_SCHODIŠTĚ', 'building', 'SCHODIŠTĚ', 5, FALSE, 'Лестницы');

-- ГАРАЖИ
INSERT INTO part_templates VALUES
  ('parking_ZÁKLADY', 'parking', 'ZÁKLADY', 1, TRUE, 'Фундаменты'),
  ('parking_SLOUPY', 'parking', 'SLOUPY', 2, TRUE, 'Опорные колонны'),
  ('parking_STĚNY', 'parking', 'STĚNY', 3, TRUE, 'Боковые стены'),
  ('parking_STROPY', 'parking', 'STROPY', 4, TRUE, 'Потолки/платформы'),
  ('parking_RAMPY', 'parking', 'RAMPY', 5, TRUE, 'Пандусы и скаты');

-- ДОРОГИ
INSERT INTO part_templates VALUES
  ('road_ZÁKLADY', 'road', 'ZÁKLADY', 1, TRUE, 'Земельное основание'),
  ('road_PODBASE', 'road', 'PODBASE', 2, TRUE, 'Подстилающий слой'),
  ('road_ASFALТ', 'road', 'ASFALТ', 3, TRUE, 'Асфальтобетон'),
  ('road_DRENÁŽ', 'road', 'DRENÁŽ', 4, FALSE, 'Дренажные системы');
```

---

## 3. Таблица частей: parts

### Назначение

Хранит части конкретного проекта (может отличаться от шаблона, если пользователь добавил свои).

### Схема БД

```sql
CREATE TABLE parts (
  part_id TEXT PRIMARY KEY,              -- "SO201_ZÁKLADY", "SO201_custom_1"
  project_id TEXT NOT NULL,              -- Ссылка на monolith_projects

  part_name TEXT NOT NULL,               -- "ZÁKLADY", "OPĚRY", "Мои стены"
  display_order INTEGER DEFAULT 0,

  is_predefined BOOLEAN DEFAULT FALSE,   -- Из шаблона (TRUE) или custom (FALSE)

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_parts_project ON parts(project_id);
```

### Примеры данных

```json
[
  {
    "part_id": "SO201_ZÁKLADY",
    "project_id": "SO201",
    "part_name": "ZÁKLADY",
    "display_order": 1,
    "is_predefined": true
  },
  {
    "part_id": "SO201_OPĚRY",
    "project_id": "SO201",
    "part_name": "OPĚRY",
    "display_order": 2,
    "is_predefined": true
  },
  {
    "part_id": "SO201_custom_1",
    "project_id": "SO201",
    "part_name": "Мои специальные элементы",
    "display_order": 6,
    "is_predefined": false
  }
]
```

---

## 4. Таблица позиций: positions (ИЗМЕНЯЕТСЯ)

### Текущая схема

```sql
-- БЫЛО (жестко привязана к bridges):
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  bridge_id TEXT NOT NULL,
  ...
);
```

### Новая схема

```sql
-- СТАЛО (универсальна для всех объектов):
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,        -- ИЗМЕНЕНО: было bridge_id
  part_id TEXT NOT NULL,           -- НОВОЕ: ссылка на part

  -- Описание работы
  part_name TEXT,                  -- (deprecated, используется part_id)
  item_name TEXT,
  subtype TEXT NOT NULL,           -- 'beton', 'bednění', 'výztuž', 'jiné'

  -- Количество и единицы
  unit TEXT NOT NULL,              -- 'm³', 'm²', 'kg', 'ks'
  qty REAL NOT NULL,               -- Количество

  -- OTSKP код
  otskp_code TEXT,                 -- '121-01-001'

  -- Расчеты
  unit_cost_native REAL,           -- Стоимость в исходных единицах
  concrete_m3 REAL,                -- Объем бетона (m³) - для нормализации
  unit_cost_on_m3 REAL,            -- Стоимость на m³ бетона
  cost_czk REAL,                   -- Итоговая стоимость (CZK)
  kros_unit_czk REAL,              -- KROS на единицу
  kros_total_czk REAL,             -- KROS всего

  -- Рабочая сила
  crew_size INTEGER DEFAULT 4,
  wage_czk_ph REAL DEFAULT 398,
  shift_hours REAL DEFAULT 10,
  days REAL DEFAULT 0,
  labor_hours REAL,

  -- RFI (Request For Information)
  has_rfi INTEGER DEFAULT 0,
  rfi_message TEXT,

  -- Timestamps
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id),
  FOREIGN KEY (part_id) REFERENCES parts(part_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_positions_project ON positions(project_id);
CREATE INDEX idx_positions_part ON positions(part_id);
CREATE INDEX idx_positions_otskp ON positions(otskp_code);
CREATE INDEX idx_positions_subtype ON positions(subtype);
```

### Миграция старых данных

```javascript
// backend/src/db/migrations.js

// Шаг 1: Создаем новую таблицу positions_new
db.exec(`CREATE TABLE positions_new (...)`);

// Шаг 2: Копируем данные из old positions
db.exec(`
  INSERT INTO positions_new
  SELECT
    id,
    bridge_id as project_id,     -- переименовываем
    CONCAT(bridge_id, '_', part_name) as part_id,  -- генерируем part_id
    part_name,
    item_name,
    subtype,
    ...
  FROM positions
`);

// Шаг 3: Создаем части для старых проектов
db.exec(`
  INSERT INTO parts (part_id, project_id, part_name, is_predefined)
  SELECT DISTINCT
    CONCAT(bridge_id, '_', part_name),
    bridge_id,
    part_name,
    FALSE  -- старые части считаются custom
  FROM positions
`);

// Шаг 4: Переименовываем таблицы
db.exec(`DROP TABLE positions`);
db.exec(`ALTER TABLE positions_new RENAME TO positions`);
```

---

## 5. Dictionary: Part Detection

### Назначение

Для автоматического определения части объекта из описания позиции (когда парсим Excel).

### Реализация

```javascript
// backend/src/utils/partDetector.js

const PART_KEYWORDS = {
  // МОСТЫ
  ZÁKLADY: [
    "základ", "patka", "pata", "foundation",
    "fundament", "podkład", "фундамент", "основа"
  ],

  OPĚRY: [
    "opěra", "abutment", "podpora", "опора",
    "абатмент", "концевая опора"
  ],

  PILÍŘE: [
    "pilíř", "sloup", "column", "пилон",
    "средняя опора", "промежуточная"
  ],

  KLENBY: [
    "klenba", "oblouk", "arch", "пролет",
    "пролетное строение", "løbewerk"
  ],

  ŘÍMSY: [
    "říms", "karnis", "cornice", "карниз",
    "откос", "скат"
  ],

  // ЗДАНИЯ
  SLOUPY: [
    "sloup", "kolona", "column", "pilaster",
    "колонна", "столб", "несущий столб"
  ],

  STĚNY: [
    "stěna", "zeď", "wall", "mur", "ściana",
    "стена", "стеновая панель", "muur"
  ],

  STROPY: [
    "strop", "deska", "slab", "deck", "dach",
    "перекрытие", "потолок", "stropnica",
    "монолитная плита"
  ],

  SCHODIŠTĚ: [
    "schod", "schody", "stairs", "escalier",
    "лестница", "марш", "stupně"
  ],

  // ГАРАЖИ/ПОДЗЕМНЫЕ
  RAMPY: [
    "rampa", "sklon", "ramp", "podjazd",
    "пандус", "спираль", "autos"
  ],

  DRENÁŽ: [
    "drenáž", "drainage", "dreniraž",
    "дренаж", "водоотвод"
  ]
};

/**
 * Определяет часть объекта по описанию
 * @param {string} description - Описание позиции из Excel
 * @param {string} objectType - Тип объекта ('bridge', 'building', 'parking')
 * @returns {string|null} - Имя части или null
 */
export function detectPart(description, objectType = 'custom') {
  const upper = description.toUpperCase();

  // Фильтруем ключевые слова по типу объекта
  const relevantKeywords = filterKeywordsByType(PART_KEYWORDS, objectType);

  for (const [partName, keywords] of Object.entries(relevantKeywords)) {
    for (const keyword of keywords) {
      if (upper.includes(keyword.toUpperCase())) {
        return partName;
      }
    }
  }

  return null;  // "NEURČENÉ"
}

function filterKeywordsByType(allKeywords, objectType) {
  const typeGroups = {
    bridge: ['ZÁKLADY', 'OPĚRY', 'PILÍŘE', 'KLENBY', 'ŘÍMSY'],
    building: ['ZÁKLADY', 'SLOUPY', 'STĚNY', 'STROPY', 'SCHODIŠTĚ'],
    parking: ['ZÁKLADY', 'SLOUPY', 'STĚNY', 'STROPY', 'RAMPY'],
    road: ['ZÁKLADY', 'PODBASE', 'ASFALТ', 'DRENÁŽ'],
    custom: Object.keys(allKeywords)  // Все слова
  };

  const relevantParts = typeGroups[objectType] || typeGroups.custom;

  return Object.fromEntries(
    Object.entries(allKeywords).filter(
      ([partName]) => relevantParts.includes(partName)
    )
  );
}
```

---

## 6. Группировка позиций

### Алгоритм

```javascript
// backend/src/services/positionGrouper.js

export function groupPositionsByPart(positions, objectType, partTemplates) {
  const groups = {};

  // Инициализируем из шаблона
  partTemplates.forEach(template => {
    groups[template.part_name] = [];
  });

  // "Неопределенные" позиции
  groups["NEURČENÉ"] = [];

  // Группируем позиции
  positions.forEach(pos => {
    const detectedPart = detectPart(pos.description, objectType);
    const groupName = detectedPart || "NEURČENÉ";

    if (groups[groupName] === undefined) {
      // Если часть не в шаблоне, создаем новую
      groups[groupName] = [];
    }

    groups[groupName].push(pos);
  });

  // Удаляем пустые группы (кроме NEURČENÉ)
  Object.keys(groups).forEach(key => {
    if (key !== "NEURČENÉ" && groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

/**
 * Подготовить группы для показа пользователю
 */
export function prepareGroupsForUI(groups) {
  const result = [];

  Object.entries(groups).forEach(([partName, positions]) => {
    let concreteM3 = 0;

    // Вычисляем объем бетона
    positions.forEach(pos => {
      if (pos.unit === 'm³') {
        concreteM3 += pos.qty;
      }
    });

    result.push({
      part_name: partName,
      position_count: positions.length,
      concrete_m3: concreteM3.toFixed(2),
      positions: positions,
      isWarning: partName === "NEURČENÉ"  // Помечаем неопределенные
    });
  });

  return result;
}
```

---

## 7. REST API Endpoints

### Управление проектами

```
POST   /api/monolith-projects
       Body: { objectType, projectName, objectName }
       Response: { projectId, ... }

GET    /api/monolith-projects
       Query: ?type=bridge&status=active
       Response: [ { projectId, objectType, ... } ]

GET    /api/monolith-projects/:projectId
       Response: { projectId, objectType, parts: [...], ... }

PUT    /api/monolith-projects/:projectId
       Body: { objectName, description, ... }

DELETE /api/monolith-projects/:projectId
```

### Загрузка и парсинг

```
POST   /api/monolith-projects/upload
       Form: { file: XLSX, projectId, objectType }
       Response: {
         preview: {
           ZÁKLADY: { positions: [...], concrete_m3: 45 },
           OPĚRY: { positions: [...], concrete_m3: 30 },
           NEURČENÉ: [ ... ]
         },
         metadata: { totalPositions: 18, ... }
       }

POST   /api/monolith-projects/:projectId/confirm-upload
       Body: { preview, modifiedGroups? }
       Response: { projectId, savedCount: 18, ... }
```

### Управление частями

```
POST   /api/parts
       Body: { projectId, partName }
       Response: { partId, ... }

DELETE /api/parts/:partId
       Response: { deleted: true }

PUT    /api/parts/:partId
       Body: { partName, displayOrder }
```

---

## 8. Frontend Models (TypeScript)

```typescript
// types/monolith.ts

interface MonolithProject {
  project_id: string;
  object_type: 'bridge' | 'building' | 'parking' | 'road' | 'custom';
  project_name: string;
  object_name: string;

  concrete_m3: number;
  sum_kros_czk: number;
  element_count: number;

  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

interface Part {
  part_id: string;
  project_id: string;
  part_name: string;
  display_order: number;
  is_predefined: boolean;
}

interface Position {
  id: string;
  project_id: string;
  part_id: string;

  item_name: string;
  subtype: 'beton' | 'bednění' | 'výztuž' | 'jiné';
  unit: string;
  qty: number;

  otskp_code?: string;
  kros_total_czk: number;
}

interface UploadPreview {
  [partName: string]: {
    positions: Position[];
    concrete_m3: number;
    position_count: number;
    isWarning: boolean;
  }
}
```

---

## 9. Миграция со старой архитектуры

| Компонент | Старое | Новое |
|-----------|--------|-------|
| **Таблица проекта** | `bridges` | `monolith_projects` |
| **ID проекта** | `bridge_id` | `project_id` |
| **Части объекта** | Не было | `parts` таблица |
| **Шаблоны** | Не было | `part_templates` таблица |
| **Ссылка в positions** | `bridge_id` | `project_id` + `part_id` |
| **Выбор типа** | Не было (только мосты) | UI с выбором типа |
| **Автопарсинг** | Базовый | С concrete-agent + AI |

---

**Последнее обновление:** November 13, 2025
**Статус:** Ready for implementation Phase 1
