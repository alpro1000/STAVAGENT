# Registry Frontend - API Migration Guide

## Что изменилось

Registry теперь работает с PostgreSQL backend вместо localStorage.

### До (localStorage):
```
User → Registry Frontend → localStorage (браузер)
```

### После (PostgreSQL):
```
User → Registry Frontend → Registry Backend API → AWS RDS PostgreSQL
```

## Преимущества

✅ **Multi-user**: Несколько пользователей работают с одним проектом
✅ **Sync**: Данные синхронизируются между устройствами
✅ **Backup**: Автоматические бэкапы AWS RDS
✅ **No data loss**: Данные не теряются при очистке браузера

## Использование

### Вариант A: Новый API Store (рекомендуется)

```typescript
import { useRegistryStoreAPI } from './stores/registryStoreAPI';

function MyComponent() {
  const { projects, loadProjects, createProject } = useRegistryStoreAPI();

  useEffect(() => {
    loadProjects(); // Load from backend
  }, []);

  const handleCreate = async () => {
    await createProject('New Project');
  };

  return <div>{projects.map(p => <div key={p.id}>{p.name}</div>)}</div>;
}
```

### Вариант B: Старый Store (localStorage)

```typescript
import { useRegistryStore } from './stores/registryStore';

// Работает как раньше, но данные только в браузере
```

## API Endpoints

### Projects
- `GET /api/registry/projects?user_id=1` - Список проектов
- `POST /api/registry/projects` - Создать проект
- `DELETE /api/registry/projects/:id` - Удалить проект

### Sheets
- `GET /api/registry/projects/:id/sheets` - Листы проекта
- `POST /api/registry/projects/:id/sheets` - Создать лист
- `DELETE /api/registry/sheets/:id` - Удалить лист

### Items
- `GET /api/registry/sheets/:id/items` - Позиции листа
- `POST /api/registry/sheets/:id/items` - Создать позицию
- `PUT /api/registry/items/:id` - Обновить позицию
- `DELETE /api/registry/items/:id` - Удалить позицию
- `PATCH /api/registry/items/:id/tov` - Обновить TOV данные

## Миграция данных

### Экспорт из localStorage

```typescript
import { useRegistryStore } from './stores/registryStore';

const exportData = () => {
  const { projects } = useRegistryStore.getState();
  const json = JSON.stringify(projects, null, 2);
  
  // Download as file
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'registry-export.json';
  a.click();
};
```

### Импорт в backend

```typescript
import { registryAPI } from './services/registryAPI';

const importData = async (projects: Project[]) => {
  for (const project of projects) {
    // Create project
    const newProject = await registryAPI.createProject(
      project.name,
      project.portalLink?.portalProjectId
    );

    // Create sheets
    for (const sheet of project.sheets) {
      const newSheet = await registryAPI.createSheet(newProject.project_id, sheet.name);

      // Create items
      for (const item of sheet.items) {
        await registryAPI.createItem(newSheet.sheet_id, {
          kod: item.kod,
          popis: item.popis,
          mnozstvi: item.mnozstvi,
          mj: item.mj,
          cena_jednotkova: item.cenaJednotkova,
          cena_celkem: item.cenaCelkem,
          item_order: 0,
        });
      }
    }
  }
};
```

## Конфигурация

### .env файл

```bash
# Backend API URL
VITE_REGISTRY_API_URL=https://rozpocet-registry-backend.onrender.com

# Portal API URL (for sync)
VITE_PORTAL_API_URL=https://stavagent-portal-backend.onrender.com
```

### Локальная разработка

```bash
# Backend
cd rozpocet-registry-backend
npm install
npm start  # Port 3002

# Frontend
cd rozpocet-registry
npm install
npm run dev  # Port 5173
```

## Troubleshooting

### Ошибка: "Failed to fetch projects"

**Причина**: Backend не доступен или спит (Render Free tier)

**Решение**: Подожди 30 секунд, backend проснётся

---

### Ошибка: "CORS error"

**Причина**: Frontend URL не в whitelist backend

**Решение**: Добавь в `server.js`:
```javascript
app.use(cors({
  origin: ['http://localhost:5173', 'https://your-frontend.vercel.app']
}));
```

---

### Ошибка: "Database connection failed"

**Причина**: Неправильный DATABASE_URL

**Решение**: Проверь env var в Render:
```
DATABASE_URL=postgresql://postgres:PASSWORD@ENDPOINT:5432/registry
```

## Roadmap

- [ ] Миграция UI на новый store
- [ ] Автоматическая миграция из localStorage
- [ ] Real-time sync через WebSocket
- [ ] Offline mode с Service Worker
- [ ] Multi-user permissions
- [ ] Audit log

## Support

- Backend API: https://rozpocet-registry-backend.onrender.com/health
- Issues: https://github.com/alpro1000/STAVAGENT/issues
