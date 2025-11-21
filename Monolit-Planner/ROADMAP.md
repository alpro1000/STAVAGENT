# 🗺️ Roadmap - План реализации

## 📅 Временная шкала

```
Phase 1: FOUNDATION (Неделя 1)
├─ БД миграция
├─ Переименование bridge → monolith_project
├─ Создание part_templates
└─ Backward compatibility

Phase 2: PARSING & GROUPING (Неделя 2)
├─ Part Detection dictionary
├─ Position Grouper
├─ Concrete-Agent интеграция
└─ Preview UI

Phase 3: UI & UX (Неделя 3)
├─ Object Type Selector
├─ Upload & Preview Page
├─ Part Editor
└─ Confirmaiton workflow

Phase 4: POLISH & TESTING (Неделя 4)
├─ E2E тесты
├─ Bug fixes
├─ Performance optimization
└─ Production deployment
```

---

## Phase 1: FOUNDATION (Неделя 1)

### Цель
Создать базовую инфраструктуру для универсальных объектов.

### Задачи

#### 1.1 БД миграция
**Файл:** `backend/src/db/migrations.js`

```javascript
// 1. Создать новую таблицу monolith_projects
db.exec(`CREATE TABLE monolith_projects (...)`);

// 2. Создать таблицу part_templates
db.exec(`CREATE TABLE part_templates (...)`);

// 3. Создать таблицу parts
db.exec(`CREATE TABLE parts (...)`);

// 4. Обновить positions table
//    - переименовать bridge_id → project_id
//    - добавить part_id

// 5. Миграция старых данных
//    - bridges → monolith_projects
//    - positions данные
```

**Критерии прохождения:**
- ✅ `npm run build` проходит без ошибок
- ✅ БД инициализируется правильно
- ✅ Старые данные успешно перенесены
- ✅ Индексы созданы

#### 1.2 Переименование bridge → monolith_project
**Файлы:**
- `backend/src/routes/bridges.js` → `backend/src/routes/monolithProjects.js`
- `frontend/src/hooks/useBridges.ts` → `frontend/src/hooks/useProjects.ts`
- Обновить все endpoint'ы

**Критерии:**
- ✅ `GET /api/monolith-projects` работает
- ✅ `POST /api/monolith-projects` создает проекты
- ✅ Frontend показывает проекты
- ✅ Старые `/api/bridges` endpoint'ы все еще работают (backward compatibility)

#### 1.3 Шаблоны частей
**Файл:** `backend/src/db/migrations.js`

```javascript
// Seed part_templates данные
const templates = {
  bridge: ['ZÁKLADY', 'OPĚRY', 'PILÍŘE', 'KLENBY', 'ŘÍMSY'],
  building: ['ZÁKLADY', 'SLOUPY', 'STĚNY', 'STROPY', 'SCHODIŠTĚ'],
  parking: ['ZÁKLADY', 'SLOUPY', 'STĚNY', 'STROPY', 'RAMPY'],
  road: ['ZÁKLADY', 'PODBASE', 'ASFALТ', 'DRENÁŽ']
};

// INSERT в part_templates
```

**Новый endpoint:**
```javascript
GET /api/part-templates?type=bridge
// Response: [{ partName, displayOrder, ... }]
```

**Критерии:**
- ✅ Шаблоны загружаются при инициализации БД
- ✅ GET endpoint возвращает правильные шаблоны по типу
- ✅ Данные семян корректные

#### 1.4 Backward Compatibility
**Что нужно:**
```sql
-- Создать VIEW для старого API
CREATE VIEW bridges AS
  SELECT
    project_id as bridge_id,
    object_name,
    concrete_m3,
    sum_kros_czk,
    ...
  FROM monolith_projects
  WHERE object_type = 'bridge';
```

**Критерии:**
- ✅ Старые скрипты/интеграции все еще работают
- ✅ Данные консистентны

### Deliverables Phase 1
- ✅ MONOLITH_SPEC.md (уже написан)
- ✅ Обновленные migrations.js
- ✅ Новая таблица monolith_projects со всеми индексами
- ✅ Таблица part_templates с семенами
- ✅ Переименованные routes и hooks
- ✅ Backward compatibility слой
- ✅ Updated API documentation

### Тестирование Phase 1
```bash
# 1. БД инициализируется без ошибок
npm run build

# 2. Проверить таблицы
sqlite3 data/database.db ".schema monolith_projects"

# 3. Проверить семена
sqlite3 data/database.db "SELECT * FROM part_templates LIMIT 10"

# 4. Старые API endpoint'ы работают
curl http://localhost:3001/api/bridges
```

---

## Phase 2: PARSING & GROUPING (Неделя 2)

### Цель
Реализовать автоматический парсинг Excel и группировку позиций по частям.

### Задачи

#### 2.1 Part Detection Dictionary
**Файл:** `backend/src/utils/partDetector.js` (НОВЫЙ)

```javascript
const PART_KEYWORDS = {
  ZÁKLADY: ['základ', 'patka', 'foundation', ...],
  OPĚRY: ['opěra', 'abutment', ...],
  // ... все слова
};

export function detectPart(description, objectType) {
  // Алгоритм из MONOLITH_SPEC.md
}
```

**Тесты:**
```javascript
// backend/src/utils/__tests__/partDetector.test.js

describe('detectPart', () => {
  it('detects ZÁKLADY from "Betonáž základů"', () => {
    expect(detectPart('Betonáž základů', 'bridge')).toBe('ZÁKLADY');
  });

  it('detects OPĚRY from "Železobeton opěry"', () => {
    expect(detectPart('Železobeton opěry', 'bridge')).toBe('OPĚRY');
  });

  it('returns null for unknown description', () => {
    expect(detectPart('XYZ unknown', 'bridge')).toBeNull();
  });
});
```

**Критерии:**
- ✅ 95%+ accuracy на тестовых данных
- ✅ Тесты покрывают все основные части
- ✅ Работает для всех object_types

#### 2.2 Position Grouper
**Файл:** `backend/src/services/positionGrouper.js` (НОВЫЙ)

```javascript
export function groupPositionsByPart(positions, objectType, partTemplates) {
  // Алгоритм из MONOLITH_SPEC.md
}

export function prepareGroupsForUI(groups) {
  // Вычисление metric'ов (concrete_m3, position_count, ...)
}
```

**Тесты:**
```javascript
describe('groupPositionsByPart', () => {
  it('groups positions by detected part', () => {
    const positions = [
      { description: 'Betonáž základů', qty: 45 },
      { description: 'Betonáž opěry', qty: 30 }
    ];

    const groups = groupPositionsByPart(positions, 'bridge', []);

    expect(groups.ZÁKLADY.length).toBe(1);
    expect(groups.OPĚRY.length).toBe(1);
  });

  it('creates NEURČENÉ group for unknown', () => {
    const positions = [{ description: 'unknown xyz', qty: 10 }];
    const groups = groupPositionsByPart(positions, 'bridge', []);

    expect(groups.NEURČENÉ.length).toBe(1);
  });
});
```

**Критерии:**
- ✅ Positions группируются правильно
- ✅ Вычисляются metric'и (concrete_m3, etc.)
- ✅ NEURČENÉ группа создается для неопределенных

#### 2.3 Concrete-Agent интеграция
**Файл:** `backend/src/services/concreteAgentClient.js` (НОВЫЙ)

```javascript
export async function parseXlsxWithConcreteAgent(filePath) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const response = await fetch(
    `${process.env.CONCRETE_AGENT_URL}/api/parse/xlsx`,
    {
      method: 'POST',
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error(`Concrete Agent error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.positions;  // [ { description, quantity, ... } ]
}
```

**Fallback (если concrete-agent недоступен):**
```javascript
// Использовать локальный парсер (базовый Excel парсер)
import { parseXlsxLocal } from './localExcelParser';

try {
  positions = await parseXlsxWithConcreteAgent(filePath);
} catch (error) {
  console.warn('Concrete Agent unavailable, using local parser');
  positions = parseXlsxLocal(filePath);  // Базовый парсер
}
```

**Критерии:**
- ✅ Может отправлять файлы в concrete-agent
- ✅ Правильно парсит response
- ✅ Graceful fallback если сервис недоступен
- ✅ Timeout protection (30s max)

#### 2.4 Backend Upload Endpoint
**Файл:** `backend/src/routes/monolithProjects.js`

```javascript
router.post('/:projectId/upload', requireAuth, uploadLimiter, async (req, res) => {
  const file = req.files.file;
  const { projectId } = req.params;

  // 1. Получить проект и его type
  const project = await db.prepare(
    'SELECT * FROM monolith_projects WHERE project_id = ?'
  ).get(projectId);

  // 2. Парсить с concrete-agent (или fallback)
  const positions = await parseXlsxWithConcreteAgent(file.path);

  // 3. Добавить OTSKP коды из своей БД
  for (const pos of positions) {
    const otskpCode = await findOtskpCode(pos.description);
    pos.otskp_code = otskpCode;
  }

  // 4. Получить шаблоны
  const templates = await db.prepare(
    'SELECT * FROM part_templates WHERE object_type = ?'
  ).all(project.object_type);

  // 5. Группировать
  const groups = groupPositionsByPart(positions, project.object_type, templates);
  const preview = prepareGroupsForUI(groups);

  // 6. Вернуть preview
  res.json({ preview, metadata: { ... } });
});
```

**Критерии:**
- ✅ Endpoint работает
- ✅ Positions парсятся
- ✅ OTSKP коды подставляются
- ✅ Preview возвращается

### Deliverables Phase 2
- ✅ `partDetector.js` с алгоритмом
- ✅ `positionGrouper.js`
- ✅ `concreteAgentClient.js` с fallback
- ✅ `POST /api/monolith-projects/:projectId/upload` endpoint
- ✅ Unit тесты (90%+ coverage)
- ✅ Integration тесты

### Тестирование Phase 2
```bash
# 1. Unit тесты
npm test -- partDetector.test.js

# 2. Загрузить тестовый Excel
curl -X POST http://localhost:3001/api/monolith-projects/SO201/upload \
  -F "file=@test.xlsx" \
  -H "Authorization: Bearer $TOKEN"

# 3. Проверить preview
# Должно показать правильные части и коды
```

---

## Phase 3: UI & UX (Неделя 3)

### Цель
Создать интуитивный интерфейс для создания и загрузки проектов.

### Задачи

#### 3.1 Object Type Selector Component
**Файл:** `frontend/src/components/projects/ObjectTypeSelector.tsx` (НОВЫЙ)

```typescript
interface ObjectTypeOption {
  type: 'bridge' | 'building' | 'parking' | 'road' | 'custom';
  label: string;
  description: string;
  icon: ReactNode;
}

export const ObjectTypeSelector = ({ value, onChange }) => {
  const options: ObjectTypeOption[] = [
    { type: 'bridge', label: 'Most', description: 'Mosty a propusty' },
    { type: 'building', label: 'Budova', description: 'Obytné a komerční budovy' },
    { type: 'parking', label: 'Podzemní garáž', description: 'Parkovací domy' },
    { type: 'road', label: 'Cesta', description: 'Silnice a mosty' },
    { type: 'custom', label: 'Vlastní', description: 'Vlastní projekt' }
  ];

  return (
    <div className="type-selector">
      {options.map(opt => (
        <button
          key={opt.type}
          className={value === opt.type ? 'selected' : ''}
          onClick={() => onChange(opt.type)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
```

**Критерии:**
- ✅ Компонент отображает все типы
- ✅ Выбор работает
- ✅ Стилизация красивая

#### 3.2 Create Project Page
**Файл:** `frontend/src/pages/CreateProjectPage.tsx` (НОВЫЙ)

```typescript
export const CreateProjectPage = () => {
  const [objectType, setObjectType] = useState('bridge');
  const [projectName, setProjectName] = useState('');
  const [objectName, setObjectName] = useState('');

  const handleCreate = async () => {
    const response = await fetch('/api/monolith-projects', {
      method: 'POST',
      body: JSON.stringify({
        object_type: objectType,
        project_name: projectName,
        object_name: objectName
      })
    });

    const project = await response.json();
    navigate(`/projects/${project.project_id}`);
  };

  return (
    <div className="create-project">
      <h1>Vytvořit nový projekt</h1>

      <ObjectTypeSelector value={objectType} onChange={setObjectType} />

      <input
        placeholder="ID projektu (SO201)"
        onChange={(e) => setProjectName(e.target.value)}
      />

      <input
        placeholder="Název stavby"
        onChange={(e) => setObjectName(e.target.value)}
      />

      <button onClick={handleCreate}>Vytvořit</button>
    </div>
  );
};
```

**Критерии:**
- ✅ Форма работает
- ✅ Проект создается
- ✅ Редирект на detail page

#### 3.3 Upload & Preview Page
**Файл:** `frontend/src/pages/UploadPage.tsx` (НОВЫЙ)

```typescript
export const UploadPage = ({ projectId }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `/api/monolith-projects/${projectId}/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    const data = await response.json();
    setPreview(data.preview);
    setLoading(false);
  };

  if (preview) {
    return <PreviewGroups preview={preview} projectId={projectId} />;
  }

  return (
    <div className="upload-page">
      <h1>Nahrát soupis</h1>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={!file || loading}>
        {loading ? 'Načítá se...' : 'Nahrát a zobrazit náhled'}
      </button>
    </div>
  );
};
```

#### 3.4 Preview Groups Component
**Файл:** `frontend/src/components/editor/PreviewGroups.tsx` (НОВЫЙ)

```typescript
export const PreviewGroups = ({ preview, projectId }) => {
  const [groups, setGroups] = useState(preview);

  const handleConfirm = async () => {
    const response = await fetch(
      `/api/monolith-projects/${projectId}/confirm-upload`,
      {
        method: 'POST',
        body: JSON.stringify({ preview: groups })
      }
    );

    if (response.ok) {
      navigate(`/projects/${projectId}`);
    }
  };

  return (
    <div className="preview-groups">
      <h2>Náhled nahraného obsahu</h2>

      {Object.entries(groups).map(([partName, group]) => (
        <div key={partName} className={group.isWarning ? 'warning' : ''}>
          <h3>{partName}</h3>
          <p>{group.position_count} pozic, {group.concrete_m3} m³</p>

          <table>
            <thead>
              <tr>
                <th>Popis</th>
                <th>Množství</th>
                <th>OTSKP</th>
              </tr>
            </thead>
            <tbody>
              {group.positions.map(pos => (
                <tr key={pos.id}>
                  <td>{pos.item_name}</td>
                  <td>{pos.qty}</td>
                  <td>{pos.otskp_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <button onClick={handleConfirm}>Potvrdit</button>
    </div>
  );
};
```

**Критерии:**
- ✅ Preview показывает группы
- ✅ Может редактировать части
- ✅ Может удалять позиции
- ✅ Confirm работает

### Deliverables Phase 3
- ✅ `ObjectTypeSelector.tsx`
- ✅ `CreateProjectPage.tsx`
- ✅ `UploadPage.tsx`
- ✅ `PreviewGroups.tsx`
- ✅ Updated navigation/routing
- ✅ CSS styles

### Тестирование Phase 3
```bash
# 1. Создать проект
# - Выбрать тип
# - Ввести данные
# - Нажать "Vytvořit"

# 2. Загрузить Excel
# - Выбрать файл
# - Нажать "Nahrát"
# - Проверить preview

# 3. Подтвердить
# - Нажать "Potvrdit"
# - Проверить, что проект создан
```

---

## Phase 4: DOCUMENT UPLOAD & ANALYSIS ✅ COMPLETE

### ✅ Completed Features

#### 4.1 Document Upload Infrastructure
- ✅ Multer file upload with validation
- ✅ XLSX/KROS document parsing via CORE Engine
- ✅ Async document analysis pipeline
- ✅ Multi-role audit system
- ✅ Material extraction and OTSKP code detection
- ✅ Work list generation from analyzed documents

#### 4.2 Excel Export with Formulas
- ✅ Dynamic Excel formulas (labor hours, costs, KROS totals)
- ✅ Professional formatting (zebra striping, freeze panes, auto-fit)
- ✅ Support for all position types (m³, m², kg, ks)
- ✅ Summary totals with SUM formulas
- ✅ RFI highlighting for missing data

#### 4.3 Performance Optimization
- ✅ Fixed project creation hangs (10x faster with batch inserts)
- ✅ Fixed file upload hangs (20x faster with batch transactions)
- ✅ Added 60-second API timeout for all requests
- ✅ Batch database inserts instead of loops

#### 4.4 User Management System
- ✅ Phase 1: Email verification
- ✅ Phase 2: User dashboard & password reset
- ✅ Phase 3: Admin panel & audit logging
- ✅ Role-based access control (user/admin)

### Deliverables Phase 4
- ✅ `backend/src/routes/upload.js` - Document upload endpoint
- ✅ `backend/src/routes/documents.js` - Document management
- ✅ `backend/src/services/exporter.js` - Excel export with formulas
- ✅ `backend/src/routes/admin.js` - Admin panel endpoints
- ✅ `frontend/src/pages/DocumentUploadPage.tsx` - Upload UI
- ✅ `frontend/src/pages/AdminDashboard.tsx` - Admin dashboard
- ✅ Performance audit with 8 identified issues, 3 critical fixes
- ✅ Complete documentation

### Commits Phase 4
- **2fd7199**: ⚡ CRITICAL FIX: Resolve project creation and file upload hangs
- **fe4be6a**: 📝 Documentation: Hang analysis and quick reference guide
- **300f3d2**: ♻️ Excel export with formulas and professional formatting
- **7d44887**: 🔧 Render deployment configuration fixes
- **7273670**: 🚨 CRITICAL FIX: KROS formula correction

---

## Phase 5: CONCRETE-AGENT ADVANCED INTEGRATION 🔲 Ready to Start

### Цель
Интеграция с Concrete-Agent CORE Engine для интеллектуального анализа документов

### Задачи

#### 5.1 Advanced Document Parsing
- [ ] Multi-format support (PDF, images, scans)
- [ ] OCR integration for scanned documents
- [ ] Intelligent table detection
- [ ] AI-powered field extraction

#### 5.2 Smart Cost Estimation
- [ ] Time-series analysis for seasonal variations
- [ ] Market rate integration
- [ ] Labor cost optimization suggestions
- [ ] Material price tracking

#### 5.3 Collaborative Features
- [ ] Multi-user project sharing
- [ ] Real-time collaboration
- [ ] Comment system for discussions
- [ ] Version history with rollback

#### 5.4 Advanced Reporting
- [ ] PDF report generation
- [ ] Custom report templates
- [ ] Data visualization (charts, graphs)
- [ ] Export to accounting systems

### Estimated Timeline
- **Duration**: 3-4 weeks
- **Effort**: 80-100 hours
- **Priority**: HIGH (integration with existing CORE Engine)

---

## Phase 6: MOBILE APP & OFFLINE SUPPORT 🔲 Future

### Features
- [ ] React Native mobile app
- [ ] Offline mode with local sync
- [ ] Photo capture from site
- [ ] Site measurements integration

---

## Success Criteria (Updated)

### ✅ Phase 1-4 COMPLETE
- ✅ Full user management (registration, verification, password reset)
- ✅ Admin panel with user management and audit logs
- ✅ Document upload and analysis pipeline
- ✅ Excel export with dynamic formulas
- ✅ Performance optimization (10-20x faster operations)
- ✅ Production deployment on Render
- ✅ Comprehensive documentation

### 🔲 Phase 5 Goals
- [ ] Concrete-Agent CORE Engine integration
- [ ] Advanced document parsing (PDF, images, OCR)
- [ ] Collaborative features (sharing, comments)
- [ ] Advanced reporting (PDF, charts)

### Current Status (Nov 20, 2025)
**Phase Completion: 4/6 - 67%**
- Phase 1: ✅ COMPLETE
- Phase 2: ✅ COMPLETE
- Phase 3: ✅ COMPLETE
- Phase 4: ✅ COMPLETE
- Phase 5: 🔲 Ready to Start
- Phase 6: 🔲 Future

---

## Success Criteria

### После Phase 1
- ✅ БД полностью переделана
- ✅ Все старые проекты мигрированы
- ✅ API endpoint'ы работают

### После Phase 2
- ✅ Excel парсится и группируется
- ✅ OTSKP коды подставляются
- ✅ Preview готов

### После Phase 3
- ✅ UI полностью функциональный
- ✅ Пользователь может создавать проекты
- ✅ Пользователь может загружать Excel

### После Phase 4
- ✅ Все тесты проходят
- ✅ Production ready
- ✅ Документация полная

---

## Regressions to Watch

| Компонент | Риск | Как тестировать |
|-----------|------|-----------------|
| **Старые bridge projects** | Может сломаться миграция | Импортировать старый проект, проверить данные |
| **OTSKP search** | Медленнее с новыми индексами | Load test с 17904 кодами |
| **Upload performance** | Excel с 1000+ позициями | Загрузить большой файл |
| **Backward compatibility** | /api/bridges endpoint | curl на старый API |

---

**Последнее обновление:** November 13, 2025
**Статус:** Ready for Phase 1
