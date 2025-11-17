# 🏛️ StavAgent Portal

**StavAgent Portal** - главный вход в систему StavAgent. Портал обеспечивает управление проектами, загрузку файлов, интеграцию с киосками и CORE системой.

## 🎯 Назначение

Портал НЕ является калькулятором, а выполняет роль диспетчера:

- 🔐 Авторизация пользователей
- 📁 Управление проектами (создание, список, карточка)
- 📄 Загрузка исходных файлов (ТЗ, смета, чертежи)
- 🔗 Маршрутизация к киоскам (Monolit, Pump, Formwork...)
- 🤖 Интеграция с Ядром (Concrete-Agent CORE)
- 💬 Чат-ассистент StavAgent

## 🗂️ Структура репозитория

```
stavagent-portal/
├── backend/              # Express API сервер
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Бизнес-логика
│   │   ├── middleware/  # Auth, rate limiting
│   │   └── db/          # База данных и миграции
│   └── server.js
│
├── frontend/            # React + TypeScript UI
│   ├── src/
│   │   ├── pages/      # Страницы
│   │   ├── components/ # Компоненты
│   │   └── context/    # State management
│   └── vite.config.ts
│
├── shared/              # Общие типы и утилиты
│   └── src/
│
└── docs/                # Документация
    ├── STAVAGENT_CONTRACT.md           # Контракт интеграции
    ├── PORTAL_ARCHITECTURE.md          # Архитектура портала
    └── REPOSITORIES_STRUCTURE.md       # Структура репозиториев
```

## 🚀 Быстрый старт

### Требования

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL (production) или SQLite (development)

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/alpro1000/stavagent-portal.git
cd stavagent-portal

# Установить зависимости
npm install
npm run install:all

# Настроить environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Отредактируйте .env файлы

# Запустить в режиме разработки
npm run dev
```

### Доступ

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## 📋 Основные API endpoints

### Проекты
- `POST /api/portal/projects` - Создать проект
- `GET /api/portal/projects` - Список проектов пользователя
- `GET /api/portal/projects/:id` - Детали проекта

### Файлы
- `POST /api/portal/projects/:id/files` - Загрузить файл
- `GET /api/portal/projects/:id/files` - Список файлов проекта
- `GET /api/portal/files/:fileId/download` - Скачать файл

### Киоски
- `POST /api/portal/projects/:id/kiosks` - Подключить киоск
- `GET /api/portal/projects/:id/kiosks` - Список киосков проекта
- `GET /api/portal/projects/:id/kiosks/:type/open` - Открыть киоск

### CORE Integration
- `POST /api/portal/projects/:id/core/submit` - Отправить в CORE
- `GET /api/portal/projects/:id/core/results` - Получить результаты
- `POST /api/portal/projects/:id/core/accept-to-kiosk` - Принять в киоск

## 🏗️ База данных

Portal использует следующие основные таблицы:

- `users` - Пользователи системы
- `portal_projects` - Проекты
- `portal_files` - Загруженные файлы
- `kiosk_links` - Связи с киосками
- `chat_sessions` - Чат-сессии
- `chat_messages` - Сообщения чата

Полная схема БД: [docs/PORTAL_ARCHITECTURE.md](docs/PORTAL_ARCHITECTURE.md)

## 🔗 Интеграция с другими сервисами

### Киоски
- **kiosk-monolit** - Калькулятор монолитных работ
- **kiosk-pump** - Калькулятор насосных работ (планируется)
- **kiosk-formwork** - Калькулятор опалубки (планируется)

### CORE
- **concrete-agent** - AI система анализа документов и аудита

Контракт интеграции: [docs/STAVAGENT_CONTRACT.md](docs/STAVAGENT_CONTRACT.md)

## 📚 Документация

- [STAVAGENT_CONTRACT.md](docs/STAVAGENT_CONTRACT.md) - Контракт интеграции между сервисами
- [PORTAL_ARCHITECTURE.md](docs/PORTAL_ARCHITECTURE.md) - Детальная архитектура портала
- [REPOSITORIES_STRUCTURE.md](docs/REPOSITORIES_STRUCTURE.md) - Структура репозиториев системы

## 🛠️ Разработка

### Скрипты

```bash
npm run dev              # Запустить backend + frontend
npm run dev:backend      # Только backend
npm run dev:frontend     # Только frontend

npm run build            # Собрать все
npm run build:backend    # Собрать backend
npm run build:frontend   # Собрать frontend
npm run build:shared     # Собрать shared типы

npm test                 # Запустить тесты
```

### Tech Stack

**Backend:**
- Express.js
- PostgreSQL / SQLite
- JWT authentication
- Multer (file uploads)

**Frontend:**
- React 18
- TypeScript
- Vite
- React Router
- Context API

## 🔐 Безопасность

- JWT токены для аутентификации
- Rate limiting на API endpoints
- Helmet.js для безопасности headers
- CORS настроен для production
- Валидация всех входящих данных

## 📝 Лицензия

Private repository - все права защищены.

## 👥 Авторы

StavAgent Team

---

**Последнее обновление:** 2025-11-17
**Статус:** 🚀 Initial release
