# Инструкция по рефакторингу concrete-agent (CORE)

## Контекст

Репозиторий **concrete-agent** является частью архитектуры StavAgent:
- **Portal** (stavagent-portal) - центральная панель управления
- **CORE** (concrete-agent) - сервис парсинга и анализа документов
- **Киоски** (Monolit-Planner и др.) - специализированные калькуляторы

## Текущее состояние concrete-agent

### ❌ Проблемы (из NAMING_ANALYSIS.md)

1. **Два фронтенда**:
   - `frontend/` - Vite + React
   - `frontend-next/` - Next.js
   - ❓ Непонятно какой использовать

2. **Нет монорепо структуры**:
   - Нет workspace в root package.json
   - Нет пакета `shared/` для общих типов
   - Прямые импорты между backend и frontend

3. **Нет unified scope**:
   - Пакеты не используют @stavagent scope
   - Нет единообразия с Portal и Monolit

4. **Неясная архитектура**:
   - Много legacy кода
   - Нет четкого разделения ответственности

## Цели рефакторинга

### 1. Унификация scope → `@stavagent/core-*`

```json
// Целевая структура пакетов
{
  "backend": "@stavagent/core-backend",
  "frontend": "@stavagent/core-frontend",
  "shared": "@stavagent/core-shared"
}
```

### 2. Создание монорепо структуры

```
concrete-agent/
├── package.json          # Root с workspaces
├── backend/
│   └── package.json      # @stavagent/core-backend
├── frontend/             # Выбрать ОДИН фронтенд
│   └── package.json      # @stavagent/core-frontend
├── shared/               # СОЗДАТЬ новый пакет
│   ├── package.json      # @stavagent/core-shared
│   ├── tsconfig.json
│   └── src/
│       ├── types/        # Общие TypeScript типы
│       └── index.ts
└── README.md
```

### 3. Решение по фронтенду

**Вопросы для уточнения:**
- Какой фронтенд используется в production?
- Есть ли зависимости от Next.js SSR?
- Планируется ли SEO для CORE (вряд ли - это внутренний сервис)?

**Рекомендация**: Если CORE - это внутренний API-сервис:
- ✅ Оставить `frontend/` (Vite) - легче, быстрее
- ❌ Удалить `frontend-next/` - избыточно для внутреннего инструмента
- 🤔 Или вообще убрать фронтенд - CORE может быть чистым API

## План действий

### Этап 1: Анализ (15-20 минут)

1. **Изучить структуру репозитория**:
   ```bash
   cd /path/to/concrete-agent
   tree -L 2 -I 'node_modules|dist'
   ```

2. **Проверить package.json всех пакетов**:
   ```bash
   cat package.json
   cat backend/package.json
   cat frontend/package.json
   cat frontend-next/package.json  # если есть
   ```

3. **Найти все импорты между пакетами**:
   ```bash
   # В backend - ищем импорты из frontend
   grep -r "from.*frontend" backend/src/

   # В frontend - ищем импорты из backend
   grep -r "from.*backend" frontend/src/
   grep -r "from.*backend" frontend-next/src/
   ```

4. **Проверить используемые типы**:
   ```bash
   # Найти все .ts файлы с типами
   find . -name "*.ts" -type f | grep -E "(types|interfaces|models)"
   ```

5. **Определить production фронтенд**:
   ```bash
   # Проверить deployment конфиги
   cat render.yaml  # или другие deployment файлы
   cat .env*
   cat */Dockerfile*
   ```

### Этап 2: Создание задач

На основе анализа создать TODO список:

```markdown
ПРИМЕР TODO (адаптировать под реальную ситуацию):

- [ ] Определить production фронтенд (Vite или Next.js)
- [ ] Создать пакет shared/ с TypeScript конфигом
- [ ] Извлечь общие типы в shared/src/types/
- [ ] Обновить root package.json (добавить workspaces)
- [ ] Переименовать backend → @stavagent/core-backend
- [ ] Переименовать frontend → @stavagent/core-frontend
- [ ] Создать shared → @stavagent/core-shared
- [ ] Обновить все импорты в backend
- [ ] Обновить все импорты в frontend
- [ ] Удалить неиспользуемый фронтенд (если решено)
- [ ] Обновить README.md с новой структурой
- [ ] Протестировать сборку всех пакетов
- [ ] Закоммитить изменения
- [ ] Запушить на ветку claude/restructure-to-stavagent-scope-*
```

### Этап 3: Принятие решений

**ВАЖНО**: Перед началом работы нужно решить:

1. **Какой фронтенд оставить?**
   - Vite (быстрый, современный)
   - Next.js (SSR, SEO)
   - Убрать фронтенд совсем (только API)

2. **Переименовать репозиторий?**
   - Оставить: `concrete-agent`
   - Переименовать в: `stavagent-core`

3. **Scope пакетов**:
   - `@stavagent/core-*` ✅ (рекомендуется)
   - `@concrete-agent/*` (альтернатива)

### Этап 4: Рефакторинг (выполнять последовательно)

#### 4.1 Создать shared пакет

```bash
mkdir -p shared/src/types
```

**shared/package.json**:
```json
{
  "name": "@stavagent/core-shared",
  "version": "1.0.0",
  "description": "Shared types and utilities for StavAgent CORE",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "echo \"No tests yet\""
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**shared/tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**shared/src/index.ts**:
```typescript
// Экспортировать все общие типы
export * from './types';
```

#### 4.2 Обновить root package.json

```json
{
  "name": "concrete-agent",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "backend",
    "frontend",
    "shared"
  ],
  "scripts": {
    "install:all": "npm install && npm install --workspaces",
    "build:shared": "npm run build --workspace=shared",
    "build:backend": "npm run build --workspace=backend",
    "build:frontend": "npm run build --workspace=frontend",
    "build": "npm run build:shared && npm run build:backend && npm run build:frontend",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "test": "npm test --workspaces"
  }
}
```

#### 4.3 Обновить backend/package.json

```json
{
  "name": "@stavagent/core-backend",
  "version": "1.0.0",
  "description": "Backend API for StavAgent CORE (document parsing)",
  "dependencies": {
    "@stavagent/core-shared": "file:../shared",
    // ... остальные зависимости
  }
}
```

#### 4.4 Обновить frontend/package.json

```json
{
  "name": "@stavagent/core-frontend",
  "version": "1.0.0",
  "description": "Frontend for StavAgent CORE (document parsing)",
  "dependencies": {
    "@stavagent/core-shared": "file:../shared",
    // ... остальные зависимости
  }
}
```

#### 4.5 Обновить импорты (batch операция)

**В backend файлах**:
```bash
# Найти все файлы с импортами
find backend/src -name "*.js" -o -name "*.ts" | while read file; do
  # Заменить старые импорты на @stavagent/core-shared
  sed -i "s|from ['\"].*shared|from '@stavagent/core-shared|g" "$file"
done
```

**В frontend файлах**:
```bash
find frontend/src -name "*.jsx" -o -name "*.tsx" -o -name "*.ts" | while read file; do
  sed -i "s|from ['\"].*shared|from '@stavagent/core-shared|g" "$file"
done
```

### Этап 5: Тестирование

```bash
# Очистить все node_modules
rm -rf node_modules backend/node_modules frontend/node_modules shared/node_modules

# Установить зависимости
npm install

# Собрать shared
npm run build:shared

# Собрать backend
npm run build:backend

# Собрать frontend
npm run build:frontend

# Запустить в dev режиме (проверить что работает)
npm run dev:backend  # в одном терминале
npm run dev:frontend # в другом терминале
```

### Этап 6: Git операции

```bash
# Создать ветку с session ID
git checkout -b claude/restructure-to-stavagent-scope-{SESSION_ID}

# Отключить GPG signing если нужно
git config commit.gpgsign false

# Закоммитить изменения
git add .
git commit -m "$(cat <<'EOF'
🏗️ Refactor: Restructure to monorepo with @stavagent/core-* scope

Changes:
- Create shared/ package for common types
- Rename backend → @stavagent/core-backend
- Rename frontend → @stavagent/core-frontend
- Add workspaces to root package.json
- Update all imports to use @stavagent/core-shared
- [Remove frontend-next/] (если удалили)

BREAKING CHANGE: Package names changed to @stavagent/core-* scope
EOF
)"

# Запушить на GitHub
git push -u origin claude/restructure-to-stavagent-scope-{SESSION_ID}
```

## Чеклист перед завершением

- [ ] Все пакеты используют `@stavagent/core-*` scope
- [ ] Root package.json содержит workspaces
- [ ] Пакет shared создан и содержит общие типы
- [ ] Все импорты обновлены на `@stavagent/core-shared`
- [ ] `npm install` успешно выполняется
- [ ] `npm run build` собирает все пакеты без ошибок
- [ ] Backend запускается (`npm run dev:backend`)
- [ ] Frontend запускается (`npm run dev:frontend`)
- [ ] Неиспользуемый код удален
- [ ] README.md обновлен с новой структурой
- [ ] Изменения закоммичены с понятным сообщением
- [ ] Ветка запушена на GitHub
- [ ] Создан Pull Request (опционально)

## Вопросы для пользователя (задать в начале сессии)

1. **Какой фронтенд используется в production?**
   - `frontend/` (Vite)?
   - `frontend-next/` (Next.js)?
   - Оба?

2. **Задеплоен ли CORE на Render/другом хостинге?**
   - Если да - какие URL и сервисы?
   - Нужно ли учитывать при рефакторинге?

3. **Переименовать ли репозиторий?**
   - Оставить: `concrete-agent`
   - Переименовать: `stavagent-core`

4. **Приоритеты**:
   - Быстрая унификация scope (минимальные изменения)
   - Полный рефакторинг архитектуры (займет больше времени)

## Ссылки

- **NAMING_ANALYSIS.md** - анализ текущего состояния всех репозиториев
- **stavagent-portal** - пример готовой монорепо структуры с @stavagent scope
- **Monolit-Planner** - пример киоска с @stavagent/monolit-* scope

## Автор инструкции

Создано в сессии рефакторинга Monolit-Planner (2025-11-17)
