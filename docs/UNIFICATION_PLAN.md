# STAVAGENT Unification Plan

> **Цель:** Объединить все kiosks в единую экосистему с взаимосвязанными данными

**Версия:** 1.0.0
**Создано:** 2026-02-04
**Статус:** В разработке

---

## Содержание

1. [Обзор архитектуры](#1-обзор-архитектуры)
2. [Текущее состояние](#2-текущее-состояние)
3. [Целевая архитектура](#3-целевая-архитектура)
4. [Унифицированная модель данных](#4-унифицированная-модель-данных)
5. [Фазы реализации](#5-фазы-реализации)
6. [API контракты](#6-api-контракты)
7. [TOV (Ведомость ресурсов)](#7-tov-ведомость-ресурсов)
8. [Чеклист задач](#8-чеклист-задач)

---

## 1. Обзор архитектуры

### Принцип "Любая точка входа"

Пользователь может начать работу с любого места:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ТОЧКИ ВХОДА                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Excel файл] ──→ Registry ──→ Классификация ──→ TOV ──→ Calc   │
│                                                                  │
│  [PDF/DOCX] ──→ URS Matcher ──→ Коды ──→ Registry ──→ TOV       │
│                                                                  │
│  [Калькулятор] ──→ Monolit ──→ Позиции ──→ Registry ──→ Отчёт   │
│                                                                  │
│  [Portal] ──→ Создать проект ──→ Связать kiosks ──→ Агрегация   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Принцип "Независимость + Связанность"

- Каждый kiosk работает **автономно**
- При необходимости данные **связываются** через Portal
- Результаты **накапливаются** в проекте

---

## 2. Текущее состояние

### Аудит Project ID (февраль 2026)

| Сервис | Поле ID | Формат | Portal связь |
|--------|---------|--------|--------------|
| **Portal** | `portal_project_id` | UUID | ✅ Источник |
| **Monolit-Planner** | `project_id` / `bridge_id` | Строка (SO201) | ⚠️ Таблица есть |
| **URS_MATCHER** | `jobs.id` | UUID | ✅ Поле есть |
| **rozpocet-registry** | `projectId` | UUID | ❌ Нет связи |
| **concrete-agent** | `project_id` | UUID | ⚠️ Через файлы |

### Аудит Position полей

| Поле | Monolit | URS | Registry | CORE |
|------|---------|-----|----------|------|
| Код | `otskp_code` | `urs_code` | `kod` | `code` |
| Описание | `item_name` | `urs_name` | `popis` | `description` |
| Количество | `qty` | `quantity` | `mnozstvi` | `quantity` |
| Единица | `unit` | `unit` | `mj` | `unit` |
| Цена ед. | `unit_cost_native` | - | `cenaJednotkova` | `unit_price` |
| Сумма | `kros_total_czk` | - | `cenaCelkem` | `total_price` |
| Группа | `subtype` | - | `skupina` | `category` |

---

## 3. Целевая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         PORTAL (Hub)                             │
│                    portal_project_id = UUID                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    kiosk_links                           │    │
│  │  portal_project_id │ kiosk_type │ kiosk_project_id      │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  abc-123           │ monolit    │ SO201                 │    │
│  │  abc-123           │ urs        │ job-456               │    │
│  │  abc-123           │ registry   │ reg-789               │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┬─────────────────┐
         ▼                 ▼                 ▼                 ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   MONOLIT   │    │     URS     │    │  REGISTRY   │    │   FUTURE    │
│   PLANNER   │    │   MATCHER   │    │  ROZPOČTŮ   │    │   KIOSKS    │
│             │    │             │    │             │    │             │
│ Бетон       │    │ Коды URS    │    │ Позиции     │    │ Machinery   │
│ Kč/m³       │    │ Matching    │    │ Skupiny     │    │ Labor       │
│ Норм-часы   │    │ Extraction  │    │ TOV         │    │ ...         │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## 4. Унифицированная модель данных

### 4.1 UnifiedProject

```typescript
interface UnifiedProject {
  // Идентификация
  portalProjectId: string;        // UUID от Portal (ГЛАВНЫЙ КЛЮЧ)
  name: string;                   // Название проекта
  description?: string;

  // Статус
  status: 'active' | 'completed' | 'archived';
  createdAt: string;              // ISO datetime
  updatedAt: string;

  // Связи с kiosks
  linkedKiosks: {
    monolit?: string;             // project_id в Monolit
    urs?: string;                 // job_id в URS
    registry?: string;            // projectId в Registry
  };

  // Агрегированные данные
  summary?: {
    totalPositions: number;
    totalCost: number;
    currency: 'CZK';
  };
}
```

### 4.2 UnifiedPosition

```typescript
interface UnifiedPosition {
  // === ИДЕНТИФИКАТОРЫ ===
  id: string;                     // UUID позиции (уникальный)
  portalProjectId: string;        // Связь с Portal проектом
  sourceKiosk: 'monolit' | 'urs' | 'registry' | 'core' | 'manual';
  sourceItemId: string;           // Оригинальный ID в источнике

  // === ОСНОВНЫЕ ПОЛЯ (ЕДИНОЕ ИМЕНОВАНИЕ) ===
  code: string | null;            // Код позиции
                                  // ← kod (registry)
                                  // ← urs_code (urs)
                                  // ← otskp_code (monolit)
                                  // ← code (core)

  description: string;            // Описание работы
                                  // ← popis (registry)
                                  // ← urs_name (urs)
                                  // ← item_name (monolit)
                                  // ← description (core)

  quantity: number | null;        // Количество
                                  // ← mnozstvi (registry)
                                  // ← quantity (urs, core)
                                  // ← qty (monolit)

  unit: string | null;            // Единица измерения
                                  // ← mj (registry)
                                  // ← unit (все остальные)

  unitPrice: number | null;       // Цена за единицу
                                  // ← cenaJednotkova (registry)
                                  // ← unit_cost_native (monolit)
                                  // ← unit_price (core)

  totalPrice: number | null;      // Общая сумма
                                  // ← cenaCelkem (registry)
                                  // ← kros_total_czk (monolit)
                                  // ← total_price (core)

  // === КЛАССИФИКАЦИЯ ===
  category: string | null;        // Группа/тип работы
                                  // ← skupina (registry)
                                  // ← subtype (monolit)
                                  // ← category (core)

  rowRole: 'main' | 'section' | 'subordinate' | 'unknown';

  // === КАЧЕСТВО ДАННЫХ ===
  confidence: number | null;      // 0-100, уверенность классификации
  matchSource: string | null;     // Откуда получен код (AI, manual, rule)

  // === TOV (ВЕДОМОСТЬ РЕСУРСОВ) ===
  tov?: TOVData;

  // === ИСТОЧНИК ===
  source: {
    fileName?: string;
    sheetName?: string;
    rowNumber?: number;
    importedAt: string;
  };

  // === СВЯЗИ ===
  linkedCalculations?: {
    monolitPositionId?: string;   // Ссылка на расчёт в Monolit
    ursMatchId?: string;          // Ссылка на матч в URS
  };
}
```

### 4.3 TOVData (Ведомость ресурсов)

```typescript
interface TOVData {
  // === ТРУДОВЫЕ РЕСУРСЫ ===
  labor: LaborResource[];
  laborSummary: {
    totalNormHours: number;       // Сумма норм-часов
    totalWorkers: number;         // Всего рабочих
  };

  // === МЕХАНИЗМЫ ===
  machinery: MachineryResource[];
  machinerySummary: {
    totalMachineHours: number;    // Сумма машино-часов
    totalUnits: number;           // Всего единиц техники
  };

  // === МАТЕРИАЛЫ ===
  materials: MaterialResource[];
  materialsSummary: {
    totalCost: number;            // Сумма стоимости материалов
    itemCount: number;            // Количество наименований
  };
}

interface LaborResource {
  id: string;
  profession: string;             // бетонщик, арматурщик, опалубщик
  professionCode?: string;        // Код профессии
  count: number;                  // Количество рабочих
  hours: number;                  // Часы на единицу
  normHours: number;              // count × hours = норм-часы
  hourlyRate?: number;            // Ставка Kč/час
  totalCost?: number;             // normHours × hourlyRate
  linkedCalcId?: string;          // Ссылка на калькулятор (будущее)
}

interface MachineryResource {
  id: string;
  type: string;                   // автобетононасос, кран, вибратор
  typeCode?: string;              // Код техники
  count: number;                  // Количество единиц
  hours: number;                  // Часы работы
  machineHours: number;           // count × hours = машино-часы
  hourlyRate?: number;            // Ставка Kč/час
  totalCost?: number;
  linkedCalcId?: string;          // Ссылка на калькулятор (будущее)
}

interface MaterialResource {
  id: string;
  name: string;                   // Бетон C30/37, арматура B500B
  code?: string;                  // Код материала
  quantity: number;               // Количество
  unit: string;                   // m³, kg, ks
  unitPrice?: number;             // Цена за единицу
  totalCost?: number;             // quantity × unitPrice
  linkedCalcId?: string;          // Ссылка на Monolit для бетона
  linkedCalcType?: 'monolit' | 'future_material_calc';
}
```

---

## 5. Фазы реализации

### Фаза 1: Базовая связность ✅ ЗАВЕРШЕНА (2026-02-07)

**Цель:** Добавить `portalProjectId` во все kiosks

#### 1.1 rozpocet-registry ✅
- [x] Добавить `portalProjectId` в тип `Project` (PortalLink interface)
- [x] Добавить поле в `registryStore.ts` (linkToPortal, unlinkFromPortal)
- [x] UI для ввода/отображения Portal ID (PortalLinkBadge component)
- [x] Сохранение в localStorage (Zustand persist)

**Файлы:**
- `src/types/project.ts`
- `src/stores/registryStore.ts`
- `src/components/portal/PortalLinkBadge.tsx`

#### 1.2 Monolit-Planner ✅
- [x] Добавить `portal_project_id` в API responses
- [x] Endpoint для связывания с Portal (POST/DELETE /:id/link-portal)
- [x] GET /by-portal/:portalProjectId endpoint

**Файлы:**
- `backend/src/routes/monolith-projects.js`

#### 1.3 URS_MATCHER ✅
- [x] Использовать существующее поле `portal_project_id`
- [x] Endpoint для экспорта в Registry (POST /:jobId/export-to-registry)
- [x] Link/unlink endpoints (POST/DELETE /:jobId/link-portal)

**Файлы:**
- `backend/src/api/routes/jobs.js`

---

### Фаза 2: API синхронизации ✅ ЗАВЕРШЕНА (2026-02-07)

**Цель:** Двусторонний обмен данными между kiosks

#### 2.1 Registry API (Vercel Serverless) ✅
```
POST /api/sync/import-positions ✅
  Body: { portalProjectId, positions: UnifiedPosition[] }

GET/POST /api/sync/export-positions ✅
  Query: ?portalProjectId=xxx
  Response: UnifiedPosition[]

POST /api/sync/link-portal ✅
  Body: { portalProjectId, registryProjectId }
```

#### 2.2 Unified Types ✅
- `src/types/unified.ts` - UnifiedPosition, UnifiedProject, TOVData, etc.
- Full TypeScript interfaces for inter-kiosk communication

#### 2.3 Маппинг функции ✅

```typescript
// Registry: src/services/sync/unifiedMapper.ts
mapItemToUnified(item: ParsedItem): UnifiedPosition
mapUnifiedToItem(unified: UnifiedPosition): ParsedItem
mapProjectToUnified(project: Project): UnifiedPosition[]
mergePositions(existing, incoming, strategy): MergeResult
```

---

### Фаза 3: TOV UI ✅ ЗАВЕРШЕНА (2026-02-07)

**Цель:** Интерфейс для ведомости ресурсов в Registry

#### 3.1 Компоненты ✅

```
src/components/tov/
├── TOVButton.tsx           ✅ Кнопка [📊] возле позиции
├── TOVModal.tsx            ✅ Модальное окно с вкладками
├── LaborTab.tsx            ✅ Таблица трудовых ресурсов
├── MachineryTab.tsx        ✅ Таблица механизмов
├── MaterialsTab.tsx        ✅ Таблица материалов (с Monolit link)
├── TOVSummary.tsx          ✅ Итоги по категориям
└── index.ts                ✅ Экспорт компонентов
```

#### 3.2 Store расширение ✅

```typescript
// В registryStore.ts добавлено:
tovData: Record<string, TOVData>;  // itemId → TOVData
setItemTOV: (itemId: string, data: TOVData) => void;
getItemTOV: (itemId: string) => TOVData | undefined;
removeItemTOV: (itemId: string) => void;
hasItemTOV: (itemId: string) => boolean;
```

#### 3.3 Интеграция с калькуляторами ✅

- Link to Monolit calculator in MaterialsTab
- Quick-add buttons for common Czech construction resources
- Auto-calculation of norm-hours, machine-hours, costs

---

### Фаза 4: Интеграция калькуляторов ✅ ЗАВЕРШЕНА (2026-02-07)

**Цель:** Двусторонняя связь с Monolit и URS Matcher

#### 4.1 Monolit → Registry ✅

**Реализовано:**
- Кнопка "📤 Export do Registry" в Header
- Маппинг позиций в UnifiedPosition формат
- POST запрос к Registry API sync endpoint
- Confirmation dialog при успешном экспорте

**Файлы:**
- `Monolit-Planner/frontend/src/components/Header.tsx`

#### 4.2 Registry → Monolit ✅

**Реализовано:**
- Link to Monolit в MaterialsTab для бетонных материалов
- Открытие Monolit с параметрами через URL

**Файлы:**
- `rozpocet-registry/src/components/tov/MaterialsTab.tsx`

#### 4.3 URS → Registry ✅

**Реализовано:**
- Кнопка "📤 Export do Registry" в results section
- Обработка всех типов результатов:
  - block-match results (blocks → positions)
  - text-match results (candidates → positions)
  - file upload results (items → positions)
- POST запрос к Registry API sync endpoint
- Confirmation dialog с возможностью открыть Registry

**Файлы:**
- `URS_MATCHER_SERVICE/frontend/public/index.html` (button)
- `URS_MATCHER_SERVICE/frontend/public/app.js` (handler)

---

### Фаза 5: Будущие калькуляторы (ongoing)

#### 5.1 Machinery Calculator (Калькулятор техники)
- Расчёт машино-часов
- Каталог техники
- Интеграция с TOV

#### 5.2 Labor Calculator (Калькулятор трудозатрат)
- Нормы времени по профессиям
- Расчёт бригад
- Интеграция с TOV

#### 5.3 Material Calculator (Калькулятор материалов)
- Расширение Monolit для других материалов
- Каталог материалов
- Интеграция с TOV

---

## 6. API контракты

### 6.1 Registry Serverless API

**Base URL:** `https://rozpocet-registry.vercel.app/api`

#### Import positions
```http
POST /api/sync/import-positions
Content-Type: application/json
Authorization: Bearer <token>

{
  "portalProjectId": "uuid",
  "positions": [UnifiedPosition],
  "source": "monolit" | "urs" | "core",
  "mergeStrategy": "append" | "replace" | "merge"
}

Response 200:
{
  "success": true,
  "imported": 15,
  "updated": 3,
  "skipped": 0
}
```

#### Export positions
```http
GET /api/sync/export-positions?portalProjectId=uuid&format=unified

Response 200:
{
  "portalProjectId": "uuid",
  "positions": [UnifiedPosition],
  "exportedAt": "ISO datetime"
}
```

#### Link to Portal
```http
POST /api/sync/link-portal
Content-Type: application/json

{
  "portalProjectId": "portal-uuid",
  "registryProjectId": "registry-uuid"
}

Response 200:
{
  "success": true,
  "linked": true
}
```

### 6.2 Inter-Kiosk Communication

```typescript
// Стандартный формат сообщения между kiosks
interface KioskMessage {
  type: 'POSITION_EXPORT' | 'CALCULATION_RESULT' | 'SYNC_REQUEST';
  source: KioskType;
  target: KioskType;
  portalProjectId: string;
  payload: any;
  timestamp: string;
}
```

---

## 7. TOV (Ведомость ресурсов)

### 7.1 UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  ItemsTable                                                      │
│  ┌─────┬────────────────────┬─────┬─────────┬─────────┬───────┐ │
│  │ Kód │ Popis              │ MJ  │ Cena    │ Celkem  │ [📊]  │ │
│  ├─────┼────────────────────┼─────┼─────────┼─────────┼───────┤ │
│  │ 123 │ Betonáž základů    │ m³  │ 2500    │ 375000  │ [📊]  │←── Кнопка TOV
│  └─────┴────────────────────┴─────┴─────────┴─────────┴───────┘ │
└─────────────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼ Click
┌─────────────────────────────────────────────────────────────────┐
│  TOV Modal                                              [X]     │
│  ═══════════════════════════════════════════════════════════    │
│  Položka: 123 - Betonáž základů (150 m³)                        │
│                                                                  │
│  ┌──────────┬──────────────┬──────────────┐                     │
│  │  Люди    │  Механизмы   │  Материалы   │  ← Tabs             │
│  └──────────┴──────────────┴──────────────┘                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Profese      │ Počet │ Hodiny │ Normohodiny │ Sazba    │    │
│  ├──────────────┼───────┼────────┼─────────────┼──────────┤    │
│  │ Betonář      │   4   │   8    │     32      │ 398 Kč/h │    │
│  │ Pomocník     │   2   │   8    │     16      │ 280 Kč/h │    │
│  │ [+ Přidat]   │       │        │             │          │    │
│  └──────────────┴───────┴────────┴─────────────┴──────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Celkem normohodin: 48 h                                 │    │
│  │ Celkové náklady práce: 18 944 Kč                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Kalkulovat v Monolit]  [Uložit]  [Zrušit]                     │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Калькуляторные ссылки

| Ресурс | Калькулятор | Статус |
|--------|-------------|--------|
| Бетон | Monolit-Planner | ✅ Есть |
| Арматура | Monolit-Planner | ✅ Есть |
| Опалубка | Monolit-Planner | ✅ Есть |
| Техника | Machinery Calculator | ⏳ Будущее |
| Труд | Labor Calculator | ⏳ Будущее |

---

## 8. Чеклист задач

### Фаза 1: Базовая связность ✅

- [x] **Registry: portalProjectId**
  - [x] Добавить поле в Project type
  - [x] Обновить registryStore
  - [x] UI для отображения
  - [x] Тесты

- [x] **Monolit: Portal link**
  - [x] API endpoint для связи
  - [x] UI индикатор
  - [x] Тесты

- [x] **URS: Export endpoint**
  - [x] POST /api/jobs/:id/export-to-registry
  - [x] Маппинг в UnifiedPosition
  - [x] Тесты

### Фаза 2: API синхронизации ✅

- [x] **Registry Serverless**
  - [x] POST /api/sync?action=import-positions
  - [x] POST /api/sync?action=export-positions
  - [x] POST /api/sync?action=link-portal
  - [ ] Авторизация (будущее)

- [x] **Маппинг функции**
  - [x] mapToUnified() в Registry
  - [x] mapToUnified() в Monolit
  - [x] mapToUnified() в URS
  - [x] mapFromUnified() везде

### Фаза 3: TOV UI ✅

- [x] **Компоненты**
  - [x] TOVButton
  - [x] TOVModal
  - [x] LaborTab
  - [x] MachineryTab
  - [x] MaterialsTab
  - [x] TOVSummary

- [x] **Store**
  - [x] tovData Map
  - [x] CRUD actions
  - [x] Persistence

### Фаза 4: Интеграция ✅

- [x] **Monolit → Registry**
  - [x] Кнопка экспорта
  - [x] API вызов
  - [x] Обработка ответа

- [x] **Registry → Monolit**
  - [x] Кнопка "Калькулировать" (в MaterialsTab)
  - [x] Передача параметров через URL
  - [ ] Получение результата (будущее)

- [x] **URS → Registry**
  - [x] Кнопка экспорта
  - [x] Bulk export (all result types)
  - [x] Confirmation dialog

### Фаза 5: Будущие калькуляторы (ongoing)

- [ ] **Machinery Calculator**
- [ ] **Labor Calculator**
- [ ] **Material Calculator**

---

## Следующие шаги

1. ~~**Фаза 1:** Базовая связность~~ ✅
2. ~~**Фаза 2:** API синхронизации~~ ✅
3. ~~**Фаза 3:** TOV UI~~ ✅
4. ~~**Фаза 4:** Интеграция калькуляторов~~ ✅
5. **Фаза 5:** Будущие калькуляторы (по запросу)
6. **Тестирование:** End-to-end тесты синхронизации
7. **Авторизация:** Добавить Bearer token для API

---

*Документ обновляется по мере реализации. Последнее обновление: 2026-02-07*
