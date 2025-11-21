# 🚀 Деплой StavAgent Portal на Render.com

## 📋 Что будет создано

Blueprint автоматически развернёт:
- ✅ **Backend** (Node.js Web Service) - Express API на порту 3001
- ✅ **Frontend** (Static Site) - React приложение (Vite build)
- ✅ **PostgreSQL Database** - База данных Portal

---

## 🎯 Способ 1: Через Render Blueprint (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Подготовка репозитория

```bash
# Убедись что все изменения закоммичены
git status

# Если есть изменения - закоммить
git add render.yaml DEPLOY.md
git commit -m "📦 Add Render Blueprint for deployment"
git push origin main
```

### Шаг 2: Создать Blueprint на Render

1. Открой [Render Dashboard](https://dashboard.render.com/)
2. Нажми **"New +" → "Blueprint"**
3. Выбери репозиторий: `alpro1000/stavagent-portal`
4. Render автоматически найдёт `render.yaml` и покажет что будет создано:
   - 🟢 stavagent-portal-backend (Web Service)
   - 🟢 stavagent-portal-frontend (Static Site)
   - 🗄️ stavagent-portal-db (PostgreSQL)
5. Нажми **"Apply"**

### Шаг 3: Дождаться деплоя

Render начнёт деплой (займёт 5-10 минут):
- ✅ Создаст PostgreSQL базу
- ✅ Развернёт Backend (установит зависимости, запустит сервер)
- ✅ Соберёт и развернёт Frontend

### Шаг 4: Обновить CORS_ORIGIN

После деплоя frontend получит URL типа:
```
https://stavagent-portal-frontend.onrender.com
```

Обнови backend env var:
1. Открой **stavagent-portal-backend** в Render Dashboard
2. Перейди в **Environment**
3. Измени `CORS_ORIGIN` с `*` на `https://stavagent-portal-frontend.onrender.com`
4. Нажми **"Save Changes"** (backend перезапустится автоматически)

### Шаг 5: Настроить SMTP (опционально)

Если нужна отправка email (регистрация, reset password):

1. Открой **stavagent-portal-backend** → **Environment**
2. Заполни:
   - `SMTP_HOST` → например `smtp.gmail.com`
   - `SMTP_USER` → твой email
   - `SMTP_PASS` → App Password (для Gmail: https://myaccount.google.com/apppasswords)
3. Нажми **"Save Changes"**

---

## 🎯 Способ 2: Ручное создание сервисов (альтернатива)

Если не хочешь использовать Blueprint:

### 1. Создать PostgreSQL Database

1. Dashboard → **"New +" → "PostgreSQL"**
2. Name: `stavagent-portal-db`
3. Database: `stavagent_portal`
4. User: `portal_user`
5. Region: **Frankfurt** (EU) или **Oregon** (US)
6. Plan: **Free**
7. Нажми **"Create Database"**
8. Скопируй **Internal Database URL**

### 2. Создать Backend Web Service

1. Dashboard → **"New +" → "Web Service"**
2. Connect репозиторий: `alpro1000/stavagent-portal`
3. Настройки:
   - **Name**: `stavagent-portal-backend`
   - **Region**: Frankfurt (EU)
   - **Branch**: `main`
   - **Root Directory**: оставь пустым
   - **Runtime**: Node
   - **Build Command**: `npm install && cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: Free

4. **Environment Variables** (добавь):
   ```
   NODE_VERSION=18.20.4
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=<вставь Internal Database URL из шага 1>
   JWT_SECRET=<сгенерируй случайную строку 32+ символов>
   JWT_EXPIRY=24h
   CORE_API_URL=https://concrete-agent.onrender.com
   UPLOAD_DIR=/opt/render/project/src/backend/uploads
   EXPORT_DIR=/opt/render/project/src/backend/exports
   CORS_ORIGIN=*
   RENDER=true
   ```

5. **Health Check Path**: `/health`
6. Нажми **"Create Web Service"**

### 3. Создать Frontend Static Site

1. Dashboard → **"New +" → "Static Site"**
2. Connect репозиторий: `alpro1000/stavagent-portal`
3. Настройки:
   - **Name**: `stavagent-portal-frontend`
   - **Region**: Frankfurt (EU)
   - **Branch**: `main`
   - **Root Directory**: оставь пустым
   - **Build Command**: `npm install && cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`

4. **Environment Variables**:
   ```
   VITE_API_URL=https://stavagent-portal-backend.onrender.com
   ```
   (замени URL на реальный URL backend из шага 2)

5. **Rewrites/Redirects** (для SPA):
   - Source: `/*`
   - Destination: `/index.html`
   - Action: `Rewrite`

6. Нажми **"Create Static Site"**

### 4. Обновить CORS

После деплоя frontend обнови `CORS_ORIGIN` в backend на реальный URL frontend.

---

## ✅ Проверка работы

### Backend API

```bash
# Health check
curl https://stavagent-portal-backend.onrender.com/health

# Должен вернуть:
{
  "status": "OK",
  "timestamp": "2025-11-17T...",
  "uptime": 123.45,
  "version": "1.0.0"
}
```

### Frontend

Открой: `https://stavagent-portal-frontend.onrender.com`

Должна открыться страница логина Portal.

---

## 🔧 Первый запуск: Инициализация БД

При первом запуске backend автоматически:
- ✅ Создаст таблицы (`users`, `portal_projects`, `portal_files`, `kiosk_links`, и т.д.)
- ✅ Загрузит OTSKP справочник (если есть XML файл)

Проверь логи backend в Render Dashboard:
```
✅ Database initialized successfully
🚀 StavAgent Portal Backend running on port 3001
```

---

## 📝 Настройка первого пользователя

### Вариант 1: Через регистрацию

1. Открой frontend
2. Перейди на страницу регистрации
3. Зарегистрируйся
4. Проверь email для верификации (если SMTP настроен)

### Вариант 2: Через SQL (если нет SMTP)

Подключись к БД через Render Dashboard:

1. Открой **stavagent-portal-db** → **Connect** → **External Connection**
2. Используй `psql` или любой SQL клиент
3. Создай первого админа:

```sql
-- Пароль: Admin123! (хэш ниже)
INSERT INTO users (email, password_hash, role, is_verified, created_at)
VALUES (
  'admin@stavagent.com',
  '$2b$10$YourHashedPasswordHere',  -- сгенерируй через bcrypt
  'admin',
  true,
  NOW()
);
```

Для генерации хэша пароля:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Admin123!', 10).then(console.log)"
```

---

## 🗄️ База данных

### Таблицы Portal:

- `users` - Пользователи
- `email_verification_tokens` - Токены верификации
- `password_reset_tokens` - Токены сброса пароля
- `audit_logs` - Логи действий
- `portal_projects` - Проекты
- `portal_files` - Файлы
- `kiosk_links` - Связи с киосками
- `chat_sessions` - Чат сессии (будущее)
- `chat_messages` - Сообщения чата (будущее)
- `otskp_codes` - OTSKP справочник

### Подключение к БД:

```bash
# Через Render Dashboard
1. Открой stavagent-portal-db
2. Connect → External Connection
3. Скопируй PSQL Command или Individual Fields

# Или через DATABASE_URL из env vars
psql $DATABASE_URL
```

---

## 📊 Мониторинг

### Логи Backend:

Render Dashboard → stavagent-portal-backend → **Logs**

Ищи:
- `✅ Database initialized successfully`
- `🚀 StavAgent Portal Backend running`
- `📊 CORS enabled for:`
- `🗄️ Database: PostgreSQL`

### Логи Frontend:

Render Dashboard → stavagent-portal-frontend → **Events**

Ищи:
- `Build succeeded`
- `Deploy live`

---

## 🔄 Обновление деплоя

### Автоматически (через Git):

```bash
# Внеси изменения, закоммить и запушить
git add .
git commit -m "Update feature"
git push origin main

# Render автоматически пересоберёт и задеплоит
```

### Вручную:

Render Dashboard → Service → **Manual Deploy** → **Deploy latest commit**

---

## ⚠️ Важные замечания

### Free Plan Limitations:

- ⚠️ **Backend засыпает** после 15 минут неактивности (холодный старт ~30 сек)
- ⚠️ **База данных** удаляется через 90 дней неактивности
- ⚠️ **Файлы** (uploads/) не персистентны на Free плане

### Для Production:

Рекомендуется:
- 💰 Paid plan для backend ($7/мес) - no sleep
- 💰 Persistent storage для файлов
- 💰 Paid DB plan для долгосрочного хранения

---

## 🆘 Troubleshooting

### Backend не запускается:

1. Проверь логи в Render Dashboard
2. Проверь `DATABASE_URL` в Environment Variables
3. Проверь что `NODE_VERSION=18.20.4`

### Frontend показывает API errors:

1. Проверь `VITE_API_URL` в frontend env vars
2. Проверь `CORS_ORIGIN` в backend env vars
3. Проверь что backend работает: `/health`

### База данных не инициализируется:

1. Проверь логи backend: ищи ошибки миграции
2. Проверь подключение к БД: `DATABASE_URL` корректен?
3. Перезапусти backend: Manual Deploy

---

## 📚 Полезные ссылки

- [Render Blueprints](https://render.com/docs/blueprint-spec)
- [Render PostgreSQL](https://render.com/docs/databases)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [StavAgent Contract](./docs/STAVAGENT_CONTRACT.md)
- [Portal Architecture](./docs/PORTAL_ARCHITECTURE.md)

---

**Последнее обновление:** 2025-11-17
**Статус:** 📋 Ready for deployment
