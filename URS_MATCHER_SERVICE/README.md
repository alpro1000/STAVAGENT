# URS Matcher Service — Standalone Kiosk

**Независимый веб-киоск для подбора позиций ÚRS по výkazu výměr**

Полностью self-contained сервис: backend + frontend + БД в одном Docker-контейнере.

```
┌─────────────────────────────────────────────────┐
│         URS MATCHER SERVICE (Киоск)             │
├─────────────────────────────────────────────────┤
│                                                 │
│  Frontend (React / HTML)                        │
│  ├─ Загрузить Excel файл                        │
│  ├─ Ввести строку вручную                       │
│  └─ Просмотреть результаты                      │
│                                                 │
├─────────────────────────────────────────────────┤
│  Backend API (Express.js / Node.js)             │
│  ├─ /api/jobs/file-upload                       │
│  ├─ /api/jobs/text-match                        │
│  ├─ /api/jobs/{id}                              │
│  └─ /api/urs-catalog                            │
│                                                 │
├─────────────────────────────────────────────────┤
│  Database (SQLite / PostgreSQL)                 │
│  ├─ urs_items (каталог ÚRS)                     │
│  ├─ jobs (история обработанных файлов)          │
│  └─ job_items (результаты для каждой работы)   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Быстрый старт (5 минут)

### Требования
- Docker + Docker Compose
- ИЛИ Node.js 18+, SQLite3

### Вариант A: Docker (рекомендуется для киоска)

```bash
# 1. Перейти в папку сервиса
cd URS_MATCHER_SERVICE

# 2. Запустить Docker Compose
docker-compose up

# 3. Открыть в браузере
http://localhost:3001
```

**Готово! Киоск работает.**

### Вариант B: Локальный запуск (разработка)

```bash
# 1. Установить зависимости
npm install

# 2. Инициализировать БД
npm run init-db

# 3. Запустить backend
npm run dev

# 4. В отдельном терминале — frontend (если отдельный)
cd frontend && npm start

# 5. Открыть в браузере
http://localhost:3001
```

---

## 📁 Структура проекта

```
URS_MATCHER_SERVICE/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── jobs.js              (endpoints для загрузки и обработки)
│   │   │   │   ├── catalog.js           (доступ к ÚRS каталогу)
│   │   │   │   └── health.js            (health check)
│   │   │   └── middleware/
│   │   │       ├── errorHandler.js
│   │   │       ├── requestLogger.js
│   │   │       └── auth.js              (заглушка авторизации)
│   │   ├── services/
│   │   │   ├── fileParser.js            (Excel/ODS/CSV парсер)
│   │   │   ├── ursMatcher.js            (сопоставление ÚRS)
│   │   │   ├── llmClient.js             (OpenAI/Claude заглушка)
│   │   │   ├── perplexityClient.js      (Perplexity заглушка)
│   │   │   └── techRules.js             (технологические правила)
│   │   ├── db/
│   │   │   ├── init.js                  (инициализация БД)
│   │   │   ├── migrations/
│   │   │   │   └── 001_init_schema.sql
│   │   │   ├── schema.sql               (структура БД)
│   │   │   └── seeds/
│   │   │       └── urs_items.json       (примеры позиций ÚRS для MVP)
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   ├── validators.js
│   │   │   └── textNormalizer.js
│   │   └── app.js                       (Express инициализация)
│   ├── tests/
│   │   ├── fileParser.test.js
│   │   ├── ursMatcher.test.js
│   │   └── fixtures/
│   ├── .env.example
│   ├── .env.development
│   ├── package.json
│   └── README.md
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── assets/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.jsx
│   │   │   ├── TextInput.jsx
│   │   │   ├── ResultsTable.jsx
│   │   │   ├── ExportButton.jsx
│   │   │   └── Layout.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── Results.jsx
│   │   ├── services/
│   │   │   ├── api.js                   (API клиент)
│   │   │   └── storage.js               (локальное хранилище)
│   │   ├── styles/
│   │   │   ├── App.css
│   │   │   ├── theme.css
│   │   │   └── responsive.css
│   │   ├── App.jsx
│   │   └── index.jsx
│   ├── package.json
│   └── README.md
│
├── docker-compose.yml                  (всё в одном контейнере)
├── Dockerfile.backend                  (Node.js backend)
├── Dockerfile.frontend                 (Nginx static frontend)
├── .dockerignore
├── .gitignore
├── LICENSE
├── DEPLOYMENT.md                       (инструкции по развёртыванию)
├── API.md                              (OpenAPI спецификация)
├── ARCHITECTURE.md                     (архитектура)
├── CONTRIBUTING.md                     (для разработчиков)
└── README.md                           (этот файл)
```

---

## 🎯 Основные возможности (MVP-1)

- ✅ Загрузка файлов (Excel, ODS, CSV)
- ✅ Ручной ввод описания работы (одна строка)
- ✅ Сопоставление с ÚRS по локальному каталогу
- ✅ Таблица результатов (Kód–Popis–MJ–Množství)
- ✅ Экспорт в Excel
- ✅ История обработанных файлов
- ✅ Веб-интерфейс (простой, удобный)
- ✅ REST API для интеграций

---

## 📊 API endpoints

| Метод | Path | Описание |
|-------|------|---------|
| POST | `/api/jobs/file-upload` | Загрузить файл для обработки |
| POST | `/api/jobs/text-match` | Обработать текстовую строку |
| GET | `/api/jobs/{jobId}` | Получить результаты |
| GET | `/api/jobs` | История всех jobs |
| POST | `/api/jobs/{jobId}/export` | Экспортировать в Excel |
| GET | `/api/urs-catalog` | Получить список ÚRS |
| GET | `/health` | Health check |

Полная документация: `/docs/API.md`

---

## 🔧 Конфигурация

### Переменные окружения (`.env`)

```bash
# Backend
NODE_ENV=development
PORT=3001
DATABASE_URL=file:./data/urs_matcher.db
LOG_LEVEL=info

# Frontend
REACT_APP_API_URL=http://localhost:3001

# LLM (MVP-2)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Perplexity (MVP-3)
PERPLEXITY_API_KEY=pplx-...

# UI
UPLOAD_MAX_SIZE=50mb
CACHE_ENABLED=true
```

Копировать из `.env.example` и заполнить:

```bash
cp .env.example .env
```

---

## 📦 Docker развёртывание

### Запуск на локальной машине

```bash
# 1. Собрать образы
docker-compose build

# 2. Запустить контейнеры
docker-compose up -d

# 3. Проверить статус
docker-compose ps

# 4. Просмотреть логи
docker-compose logs -f backend
```

### Запуск на удалённом сервере (Render / DigitalOcean / AWS)

```bash
# 1. Скопировать проект на сервер
scp -r URS_MATCHER_SERVICE user@server:/app/

# 2. SSH на сервер
ssh user@server

# 3. Перейти в папку
cd /app/URS_MATCHER_SERVICE

# 4. Запустить Docker
docker-compose up -d

# 5. Проверить
curl http://localhost:3001/health
```

**Киоск доступен по IP сервера на порте 3001:**
```
http://123.45.67.89:3001
```

---

## 🎨 Веб-интерфейс (киоск)

### Страница 1: Загрузка файла

```
┌─────────────────────────────────────┐
│  URS MATCHER KIOSK                  │
├─────────────────────────────────────┤
│                                     │
│  [Загрузить файл Excel/ODS/CSV]    │
│  Drag-and-drop сюда                │
│                                     │
│  или                                │
│                                     │
│  [Ввести строку вручную]            │
│  "Podkladní beton C25/30 25 m3"    │
│                                     │
│  [Обработать] ➜                     │
│                                     │
└─────────────────────────────────────┘
```

### Страница 2: Результаты

```
┌──────────────────────────────────────────┐
│  Результаты обработки                    │
├──────────────────────────────────────────┤
│                                          │
│ Kód ÚRS │ Popis │ MJ │ Množství │ Zdroj│
│──────────────────────────────────────────│
│ 801321 │ Beton │ m3 │ 25.0 │ AI+search│
│ 801171 │ Bednění│ m2 │ 36.5 │ tech_rule│
│ ...    │ ...    │... │ ...  │ ...     │
│                                          │
│ [⬇️ Stáhnout Excel] [📋 Kopírovat] [🔄] │
│                                          │
└──────────────────────────────────────────┘
```

---

## 🧪 Тестирование

### Unit-тесты

```bash
npm test
```

### API-тесты (curl)

```bash
# Проверить здоровье сервиса
curl http://localhost:3001/health

# Загрузить файл
curl -X POST http://localhost:3001/api/jobs/file-upload \
  -F "file=@test.xlsx" \
  -F "object_type=bridge"

# Получить результаты
curl http://localhost:3001/api/jobs/{jobId}

# Экспортировать
curl -X POST http://localhost:3001/api/jobs/{jobId}/export \
  -o result.xlsx
```

---

## 📈 Roadmap (фазы разработки)

### ✅ MVP-1 (неделя 1–2)
- [x] Backend API
- [x] Парсер файлов
- [x] Локальное сопоставление ÚRS
- [x] Frontend киоск
- [x] Docker setup

### 🔄 MVP-2 (неделя 3–4)
- [ ] OpenAI/Claude интеграция
- [ ] Tech-rules (автоматические сопутствующие работы)
- [ ] Confidence scores
- [ ] Экспорт в Excel/CSV

### 🚀 MVP-3 (неделя 5–6)
- [ ] Perplexity интеграция
- [ ] Web-поиск по ÚRS
- [ ] История и сравнение результатов
- [ ] Advanced фильтры

### 📦 Production (неделя 7+)
- [ ] Очереди задач (большие файлы)
- [ ] Авторизация пользователей
- [ ] Analytics и логирование
- [ ] Backup и восстановление

---

## 🔐 Безопасность

- ✅ Валидация входных данных
- ✅ Лимиты на размер файлов (50MB)
- ✅ XSS-защита (React auto-escaping)
- ✅ CORS настройки
- ✅ Rate limiting (будет добавлено)
- ⚠️ Авторизация (пока заглушка, для продакшена добавить)

---

## 📝 Документация

- **[API.md](./API.md)** — OpenAPI спецификация всех endpoints
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — описание архитектуры компонентов
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — инструкции по развёртыванию на разных платформах
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — гайд для разработчиков

---

## 🐛 Логирование и отладка

### Логи backend

```bash
docker-compose logs -f backend
```

### Логи frontend

```bash
docker-compose logs -f frontend
```

### Доступ к БД (SQLite)

```bash
# Подключиться к БД
sqlite3 data/urs_matcher.db

# Просмотреть таблицы
.tables

# Запросить данные
SELECT * FROM urs_items LIMIT 10;
```

---

## 🆘 Troubleshooting

### Ошибка: "Port 3001 already in use"

```bash
# Использовать другой порт
docker-compose up -d -p 3002:3001

# или kill процесс на порте
lsof -i :3001
kill -9 <PID>
```

### Ошибка: "Database locked"

```bash
# Перезагрузить контейнер
docker-compose restart backend

# или пересоздать БД
docker-compose exec backend npm run init-db
```

### Frontend не загружается

```bash
# Очистить кэш браузера
# Ctrl+Shift+Delete (Chrome/Firefox)
# Или Hard Refresh: Ctrl+Shift+R
```

---

## 💡 Примеры использования

### Использование как киоска в офисе

1. **Установить на тонкий клиент или рабочую станцию**
   ```bash
   docker-compose up -d
   ```

2. **Открыть в браузере на весь экран**
   ```
   http://localhost:3001
   ```

3. **Сотрудник загружает Excel → получает результаты**

### Интеграция с Monolit-Planner

На этапе MVP-2/MVP-3 можно добавить интеграцию:

```
Monolit-Planner → (API call) → URS Matcher Service → Результаты ÚRS
```

### Использование в обработке больших файлов

```bash
# Скрипт для массовой обработки
bash scripts/batch-process.sh input/*.xlsx
```

---

## 📞 Поддержка и вопросы

- **Документация:** `/docs/`
- **Примеры API:** `curl examples.sh`
- **Issues:** GitHub Issues (если в repo)
- **Email:** support@example.com (для продакшена)

---

## 📜 Лицензия

MIT (или выбрать другую для продакшена)

---

## 🎉 Готово!

Киоск полностью готов к развёртыванию и использованию.

**Далее:**
1. Заполнить БД реальными позициями ÚRS (из каталога)
2. Протестировать с реальными файлами výkazů
3. На MVP-2: добавить LLM для улучшения сопоставления
4. На MVP-3: добавить Perplexity для поиска по ÚRS

**Развёртывание:**
- Локально: `docker-compose up`
- На сервере: следовать `DEPLOYMENT.md`

---

**Версия:** 1.0
**Статус:** MVP-1 Ready
**Дата:** Ноябрь 2025
