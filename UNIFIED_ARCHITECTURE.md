# Unified Architecture: Portal-Centric Project Management

**Философия:** Все киоски работают с одним проектом, данные собираются в Portal.

---

## 🏗️ Центральная модель: Portal Projects

```
stavagent-portal
    │
    ├── portal_projects (UUID)  ← ЕДИНАЯ ТОЧКА ВХОДА
    │       │
    │       ├── Audit projektu (Workflow C)
    │       ├── Akumulace dokumentů
    │       ├── Monolit Planner
    │       ├── URS Matcher
    │       ├── Pump Module
    │       └── ... (future kiosks)
    │
    └── kiosk_links
            ├── portal_project_id
            ├── kiosk_name
            └── kiosk_result_id
```

**Пример:**
```
Portal Project: "Most přes Biokoridor" (UUID: proj_123)
    │
    ├── Audit → audit_result_id: "audit_456"
    ├── Documents → accumulator_project_id: "doc_789"
    ├── Monolit → bridge_id: "SO 11-20-01"
    ├── URS → job_id: "urs_012"
    └── Pump → pump_calc_id: "pump_345"
```

---

## 🪨 Monolit Planner: НЕ заменять, а УСИЛИТЬ

### Текущая таблица (оставить как есть)

```sql
positions (
  id,
  bridge_id,
  part_name,      -- "ZÁKLADY", "ŘÍMSY"
  subtype,        -- "beton", "bednění", "výztuž"
  item_name,      -- Custom name или Excel description
  qty,
  unit,
  crew_size,
  wage_czk_ph,
  shift_hours,
  days,           -- ← ВЫ вводите ВРУЧНУЮ
  labor_hours,    -- ← Вычисляется
  cost_czk,       -- ← Вычисляется
  ...
)
```

**ЭТО ОСТАЁТСЯ!** Это финальная таблица, удобная и привычная.

---

### Новые калькуляторы = AI-подсказки

**Добавить кнопку "Подсказать ✨" рядом с полем `days`:**

```
┌─────────────────────────────────────────────────────┐
│  Позиция: Bednění (82 m²)                           │
├─────────────────────────────────────────────────────┤
│  Množství:  82 m²                                   │
│  Lidí:      4                                       │
│  Kč/hod:    398                                     │
│  Hod/den:   10                                      │
│  Dny:       [2.5] [Подсказать ✨]  ← НОВАЯ КНОПКА  │
└─────────────────────────────────────────────────────┘
```

**При клике на "Подсказать ✨":**

1. Берём данные из позиции (qty=82, unit=m², subtype=bednění)
2. Вызываем калькулятор `calculateFormwork()`:
   ```typescript
   const suggestion = calculateFormwork({
     area_m2: 82,
     norm_assembly_h_m2: 0.8,  // Из normsets
     crew_size: 4,
     shift_h: 10,
     k: 0.8,
     ...
   });
   // suggestion.assembly_days = 2.05 дня
   ```
3. Показываем tooltip:
   ```
   💡 Рекомендация: 2.05 дня
   Источник: ÚRS 2024
   Расчёт: 82m² × 0.8ч/m² / (4 × 10 × 0.8) = 2.05 дня
   Уверенность: 90%

   [Применить] [Игнорировать]
   ```
4. Пользователь **решает сам**: применить или ввести своё значение

**КЛЮЧЕВОЕ:** Калькуляторы = **помощники**, не диктуют!

---

## 🔗 Связь таблиц: positions + normsets + suggestions

### Новая таблица: position_suggestions (опционально)

```sql
CREATE TABLE position_suggestions (
  id TEXT PRIMARY KEY,
  position_id TEXT REFERENCES positions(id),

  -- Suggestion metadata
  suggested_days REAL,           -- 2.05
  suggested_by TEXT,             -- "CALCULATOR_FORMWORK" / "AI_FOREMAN"
  norm_source TEXT,              -- "URS_2024_OFFICIAL"
  assumptions_log TEXT,          -- JSON с параметрами
  confidence REAL,               -- 0.90

  -- User decision
  status TEXT,                   -- "pending" / "accepted" / "rejected"
  user_decision_days REAL,       -- Что пользователь выбрал
  user_note TEXT,                -- Комментарий пользователя

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Это НЕ заменяет positions, а дополняет:**
- В `positions` хранится финальное значение (что пользователь ввёл)
- В `position_suggestions` хранится история подсказок (для аналитики)

---

## 📊 Визуальное разбиение на такты

### Текущая группировка по `part_name`

```
Мост: SO 11-20-01
  │
  ├── ZÁKLADY (Такт 1)
  │   ├── Bednění (82 m²) - 2.5 дня
  │   ├── Výztuž (2.05 t) - 3.2 дня
  │   └── Betonování (20.5 m³) - 0.24 дня
  │
  ├── ŘÍMSY (Такт 2)
  │   └── ...
  │
  └── MOSTNÍ OPĚRY (Такт 3)
      └── ...
```

**ЭТО УЖЕ ЕСТЬ!** `part_name` = ваши такты.

**Усиление:** Добавить AI-подсказку "Разбить на такты":

```
┌─────────────────────────────────────────────────────┐
│  Элемент: DESKA (164 m², 41 m³)                     │
│                                                     │
│  [Разбить на такты ✨]  ← НОВАЯ КНОПКА              │
│                                                     │
│  💡 Рекомендация: 2 такта                           │
│     - Такт 1: 20.5 m³ (вписывается в 12ч окно)     │
│     - Такт 2: 20.5 m³                               │
│                                                     │
│  [Применить] [Ввести вручную]                       │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 Workflow: Пользователь + AI-помощник

### Сценарий 1: Ручной ввод (как сейчас)

```
1. Пользователь создаёт позицию "Bednění"
2. Вводит qty=82, crew_size=4, shift_hours=10
3. Вводит days=2.5 ВРУЧНУЮ (по опыту)
4. Сохраняет
```

**Никаких изменений!** Работает как раньше.

---

### Сценарий 2: С AI-подсказкой (новое)

```
1. Пользователь создаёт позицию "Bednění"
2. Вводит qty=82, crew_size=4, shift_hours=10
3. Кликает "Подсказать ✨"
4. Видит рекомендацию: 2.05 дня (ÚRS 2024, 90% уверенность)
5. Решает:
   - Применить 2.05 → автозаполнение
   - Отклонить → вводит 2.5 вручную (знает лучше!)
6. Сохраняет
```

**Финальное значение:** Что пользователь выбрал (2.05 или 2.5).

---

### Сценарий 3: Разбиение на такты (новое)

```
1. Пользователь имеет элемент "DESKA" (41 m³)
2. Кликает "Разбить на такты ✨"
3. AI анализирует:
   - Объём 41 m³
   - Насос Q=15 м³/ч
   - Окно непрерывности 12ч
   - Рекомендация: 2 такта по 20.5 m³
4. Пользователь:
   - Принимает → автосоздание 2 part_name
   - Отклоняет → создаёт 3 такта вручную (свой опыт!)
5. Заполняет позиции для каждого такта
```

---

## 🌐 Связь киосков через Portal

### Portal Project Schema (расширить)

```sql
-- stavagent-portal database

portal_projects (
  portal_project_id UUID PRIMARY KEY,
  project_name TEXT,
  project_type TEXT,
  owner_id INTEGER,
  status TEXT,
  created_at TIMESTAMP,

  -- Geometry (optional, from drawings)
  total_volume_m3 REAL,
  total_area_m2 REAL,
  total_mass_t REAL
);

kiosk_links (
  id UUID PRIMARY KEY,
  portal_project_id UUID REFERENCES portal_projects(portal_project_id),
  kiosk_name TEXT,              -- "monolit" / "urs_matcher" / "pump"
  kiosk_result_id TEXT,         -- ID в БД киоска
  metadata JSON,                -- Дополнительные данные
  created_at TIMESTAMP
);
```

---

### Примеры связи

#### 1. Создание проекта в Portal

```http
POST /api/portal/projects
{
  "project_name": "Most přes Biokoridor",
  "project_type": "bridge",
  "total_volume_m3": 150.5,
  "total_area_m2": 600.0
}

Response:
{
  "portal_project_id": "proj_123abc"
}
```

#### 2. Запуск Monolit Planner

```http
POST /api/monolit/bridges
{
  "portal_project_id": "proj_123abc",  ← Связь с Portal!
  "bridge_id": "SO 11-20-01",
  "object_name": "ZÁKLADY"
}

Response:
{
  "bridge_id": "SO 11-20-01"
}
```

**Portal автоматически создаёт kiosk_link:**
```sql
INSERT INTO kiosk_links (portal_project_id, kiosk_name, kiosk_result_id)
VALUES ('proj_123abc', 'monolit', 'SO 11-20-01');
```

#### 3. Запуск URS Matcher

```http
POST /api/urs/jobs
{
  "portal_project_id": "proj_123abc",  ← Тот же проект!
  "file_path": "rozpocet.xlsx"
}

Response:
{
  "job_id": "urs_012"
}
```

**Ещё один kiosk_link:**
```sql
INSERT INTO kiosk_links (portal_project_id, kiosk_name, kiosk_result_id)
VALUES ('proj_123abc', 'urs_matcher', 'urs_012');
```

---

### Portal Project Dashboard

```
Portal → Project "Most přes Biokoridor"

┌─────────────────────────────────────────────────────┐
│  📊 Project Overview                                │
├─────────────────────────────────────────────────────┤
│  Name: Most přes Biokoridor                         │
│  Type: Bridge                                       │
│  Volume: 150.5 m³                                   │
│  Status: In Progress                                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  🔗 Connected Kiosks                                │
├─────────────────────────────────────────────────────┤
│  ✅ Audit projektu                                  │
│     Status: GREEN (no issues)                       │
│     [View Report]                                   │
│                                                     │
│  ✅ Monolit Planner                                 │
│     Bridge: SO 11-20-01                             │
│     Positions: 35                                   │
│     Total cost: 2,450,000 CZK                       │
│     [Open in Monolit Planner]                       │
│                                                     │
│  ✅ URS Matcher                                     │
│     Job: urs_012                                    │
│     Matched: 120/150 items                          │
│     [Open in URS Matcher]                           │
│                                                     │
│  ⏳ Pump Module (not started)                       │
│     [Launch Calculator]                             │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Изменения в Monolit Planner

### 1. Добавить связь с Portal

```sql
-- Monolit Planner database

ALTER TABLE bridges ADD COLUMN portal_project_id TEXT;
```

**При создании моста:**
```javascript
// frontend/src/components/CreateBridgeForm.tsx
const createBridge = async (formData) => {
  const response = await fetch('/api/bridges', {
    method: 'POST',
    body: JSON.stringify({
      ...formData,
      portal_project_id: portalProjectId  // ← Передать из Portal!
    })
  });
};
```

---

### 2. Добавить нормы (normsets)

```sql
-- Monolit Planner database

CREATE TABLE normsets (
  id TEXT PRIMARY KEY,
  name TEXT,
  source_tag TEXT,
  rebar_h_per_t REAL,
  formwork_assembly_h_per_m2 REAL,
  ...
);

-- Seed data (4 normsets)
INSERT INTO normsets ...;
```

---

### 3. Добавить кнопку "Подсказать" в UI

```tsx
// frontend/src/components/PositionRow.tsx

<td className="cell-days">
  <input
    type="number"
    value={days}
    onChange={(e) => setDays(e.target.value)}
  />

  <button
    className="btn-suggest"
    onClick={() => handleSuggestDays()}
    title="AI-подсказка по нормам"
  >
    ✨
  </button>
</td>
```

**Handler:**
```typescript
const handleSuggestDays = async () => {
  // Call calculator API
  const suggestion = await fetch('/api/positions/suggest-days', {
    method: 'POST',
    body: JSON.stringify({
      position_id: position.id,
      normset_id: 'norm_urs_2024'  // Default normset
    })
  });

  // Show tooltip with suggestion
  showTooltip({
    suggested_days: suggestion.days,
    source: suggestion.source_tag,
    calculation: suggestion.assumptions_log,
    confidence: suggestion.confidence
  });
};
```

---

### 4. Backend API для подсказок

```javascript
// backend/src/routes/positions.js

router.post('/:id/suggest-days', async (req, res) => {
  const { id } = req.params;
  const { normset_id } = req.body;

  // Get position
  const position = await db.prepare('SELECT * FROM positions WHERE id = ?').get(id);

  // Get normset
  const normset = await db.prepare('SELECT * FROM normsets WHERE id = ?').get(normset_id);

  // Call appropriate calculator
  let suggestion;
  if (position.subtype === 'beton') {
    suggestion = calculateConcreting({ ... });
  } else if (position.subtype === 'bednění') {
    suggestion = calculateFormwork({ ... });
  } else if (position.subtype === 'výztuž') {
    suggestion = calculateRebar({ ... });
  }

  res.json({
    suggested_days: suggestion.duration_days,
    source_tag: suggestion.source_tag,
    assumptions_log: suggestion.assumptions_log,
    confidence: suggestion.confidence
  });
});
```

---

## 📊 Итоговая архитектура

```
┌──────────────────────────────────────────────────────┐
│           STAVAGENT PORTAL (Центр)                   │
│                                                      │
│  portal_projects (UUID)                              │
│      ├── portal_project_id: "proj_123"               │
│      ├── project_name: "Most přes Biokoridor"        │
│      └── kiosk_links:                                │
│             ├── monolit → "SO 11-20-01"              │
│             ├── urs_matcher → "urs_012"              │
│             └── pump → "pump_345"                    │
└──────────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Monolit    │ │ URS Matcher │ │ Pump Module │
│  Planner    │ │             │ │             │
├─────────────┤ ├─────────────┤ ├─────────────┤
│ bridges     │ │ jobs        │ │ calculations│
│ positions   │ │ matches     │ │ results     │
│  ↓          │ │             │ │             │
│ [✨ AI      │ │             │ │             │
│  suggest]   │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘
```

---

## ✅ Преимущества этого подхода

1. **Не ломает текущую систему** - `positions` остаётся как есть
2. **Постепенное внедрение** - добавляем AI-подсказки, не меняя workflow
3. **Пользователь контролирует** - AI предлагает, пользователь решает
4. **Все киоски связаны** - через `portal_project_id`
5. **История решений** - видно где AI помог, где пользователь изменил

---

## 🎯 Приоритеты реализации

### Фаза 1: Связь с Portal (1 неделя)
- [ ] Добавить `portal_project_id` в `bridges`
- [ ] Создать `kiosk_links` в Portal
- [ ] Dashboard проекта в Portal

### Фаза 2: Нормы и калькуляторы (1 неделя)
- [ ] Добавить таблицу `normsets` в Monolit
- [ ] Seed data (4 normsets)
- [ ] Backend API `/suggest-days`

### Фаза 3: UI подсказки (1 неделя)
- [ ] Кнопка "Подсказать ✨" в PositionRow
- [ ] Tooltip с рекомендацией
- [ ] Логирование принятия/отклонения

### Фаза 4: Разбиение на такты (1 неделя)
- [ ] Анализ элемента (объём, окно непрерывности)
- [ ] AI-предложение тактов
- [ ] Автосоздание `part_name`

---

**Это правильный путь?** Усиливаем то что есть, вместо замены!
