# AWS RDS PostgreSQL Setup для Registry Backend

## Шаг 1: Создание RDS PostgreSQL Instance

### 1.1 Войти в AWS Console
- https://console.aws.amazon.com/
- Регион: выбрать ближайший (eu-central-1 Frankfurt или eu-west-1 Ireland)

### 1.2 Открыть RDS
- Services → Database → RDS
- Или: https://console.aws.amazon.com/rds/

### 1.3 Create Database
Нажать **"Create database"**

#### Engine Options:
- **Engine type**: PostgreSQL
- **Version**: PostgreSQL 15.x (latest)

#### Templates:
- ✅ **Free tier** (для начала)
  - db.t3.micro (1 vCPU, 1 GB RAM)
  - 20 GB storage
  - Single-AZ
  - **Бесплатно 750 часов/месяц на 12 месяцев**

#### Settings:
- **DB instance identifier**: `stavagent-registry-db`
- **Master username**: `postgres`
- **Master password**: `[создать сложный пароль]`
- ✅ Auto generate password (или свой)

#### Instance Configuration:
- **DB instance class**: db.t3.micro (Free tier eligible)
- **Storage type**: General Purpose SSD (gp2)
- **Allocated storage**: 20 GB
- ❌ Enable storage autoscaling (не нужно для начала)

#### Connectivity:
- **VPC**: Default VPC
- **Subnet group**: default
- **Public access**: ✅ **Yes** (важно для доступа с Render)
- **VPC security group**: Create new
  - Name: `stavagent-registry-sg`
- **Availability Zone**: No preference

#### Database Authentication:
- ✅ Password authentication

#### Additional Configuration:
- **Initial database name**: `registry`
- **DB parameter group**: default.postgres15
- **Backup retention**: 7 days (можно 1 день для экономии)
- ❌ Enable encryption (не обязательно для Free tier)
- ✅ Enable automated backups
- ❌ Enable Performance Insights (платно)

### 1.4 Create Database
- Нажать **"Create database"**
- Ожидание: 5-10 минут

---

## Шаг 2: Настройка Security Group

### 2.1 Открыть Security Group
- RDS → Databases → `stavagent-registry-db`
- Вкладка **"Connectivity & security"**
- Кликнуть на Security Group (например, `stavagent-registry-sg`)

### 2.2 Добавить Inbound Rule
- **Edit inbound rules**
- **Add rule**:
  - Type: PostgreSQL
  - Protocol: TCP
  - Port: 5432
  - Source: **0.0.0.0/0** (для доступа с Render)
  - Description: `Allow Render access`
- **Save rules**

⚠️ **Security Note**: В production лучше использовать Render IP ranges

---

## Шаг 3: Получить Connection String

### 3.1 Endpoint
- RDS → Databases → `stavagent-registry-db`
- Вкладка **"Connectivity & security"**
- Скопировать **Endpoint**: `stavagent-registry-db.xxxxxx.eu-central-1.rds.amazonaws.com`
- Скопировать **Port**: `5432`

### 3.2 Сформировать DATABASE_URL
```
postgresql://postgres:[PASSWORD]@[ENDPOINT]:5432/registry
```

Пример:
```
postgresql://postgres:MySecurePass123@stavagent-registry-db.c9akqwerty.eu-central-1.rds.amazonaws.com:5432/registry
```

---

## Шаг 4: Тестирование подключения

### 4.1 Локально (через psql)
```bash
psql "postgresql://postgres:[PASSWORD]@[ENDPOINT]:5432/registry"
```

### 4.2 Проверка таблиц
```sql
\dt
-- Должно быть пусто (таблицы создадутся при первом запуске backend)
```

---

## Шаг 5: Deploy Backend на Render

### 5.1 Создать новый Web Service
- https://dashboard.render.com/
- **New → Web Service**
- Connect GitHub: `STAVAGENT` repo
- Root Directory: `rozpocet-registry-backend`

### 5.2 Settings
- **Name**: `rozpocet-registry-backend`
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: Free

### 5.3 Environment Variables
Добавить:
```
DATABASE_URL = postgresql://postgres:[PASSWORD]@[ENDPOINT]:5432/registry
PORT = 3002
NODE_ENV = production
```

### 5.4 Deploy
- Нажать **"Create Web Service"**
- Ожидание: 3-5 минут

---

## Шаг 6: Проверка работы

### 6.1 Health Check
```bash
curl https://rozpocet-registry-backend.onrender.com/health
```

Ответ:
```json
{"status":"ok","service":"rozpocet-registry-backend"}
```

### 6.2 Создать тестовый проект
```bash
curl -X POST https://rozpocet-registry-backend.onrender.com/api/registry/projects \
  -H "Content-Type: application/json" \
  -d '{"project_name":"Test Project","user_id":1}'
```

### 6.3 Получить проекты
```bash
curl https://rozpocet-registry-backend.onrender.com/api/registry/projects?user_id=1
```

---

## Стоимость AWS RDS Free Tier

### Бесплатно (12 месяцев):
- ✅ 750 часов/месяц db.t3.micro (достаточно для 1 инстанса 24/7)
- ✅ 20 GB storage
- ✅ 20 GB backup storage

### После Free Tier (через 12 месяцев):
- db.t3.micro: ~$15/месяц
- 20 GB storage: ~$2/месяц
- **Total: ~$17/месяц**

### Альтернативы (если закончится Free Tier):
1. **Render PostgreSQL**: $7/месяц (256 MB RAM)
2. **Supabase**: Free tier (500 MB, 2 GB transfer)
3. **Neon**: Free tier (0.5 GB storage)

---

## Troubleshooting

### Ошибка: "Connection refused"
- Проверить Security Group (порт 5432 открыт для 0.0.0.0/0)
- Проверить Public access = Yes

### Ошибка: "Authentication failed"
- Проверить пароль в DATABASE_URL
- Проверить username (должен быть `postgres`)

### Ошибка: "Database does not exist"
- Проверить имя БД в DATABASE_URL (должно быть `registry`)
- Создать БД вручную через psql:
  ```sql
  CREATE DATABASE registry;
  ```

### Ошибка: "SSL required"
- Добавить `?sslmode=require` в конец DATABASE_URL:
  ```
  postgresql://postgres:pass@host:5432/registry?sslmode=require
  ```

---

## Мониторинг

### AWS CloudWatch
- RDS → Databases → `stavagent-registry-db`
- Вкладка **"Monitoring"**
- Метрики:
  - CPU Utilization
  - Database Connections
  - Free Storage Space

### Render Logs
- Dashboard → `rozpocet-registry-backend` → Logs
- Проверить ошибки подключения к БД

---

## Backup & Restore

### Автоматические бэкапы
- RDS создаёт snapshot каждый день
- Retention: 7 дней (настроено при создании)

### Ручной snapshot
- RDS → Databases → `stavagent-registry-db`
- Actions → Take snapshot
- Name: `registry-manual-backup-YYYY-MM-DD`

### Restore
- RDS → Snapshots → Select snapshot
- Actions → Restore snapshot
- Создаст новый RDS instance

---

## Следующие шаги

1. ✅ Создать RDS PostgreSQL
2. ✅ Настроить Security Group
3. ✅ Deploy backend на Render
4. ⏳ Обновить Registry frontend для работы с API
5. ⏳ Миграция данных из localStorage
6. ⏳ Тестирование multi-user сценариев

---

## Контакты для поддержки

- AWS Support: https://console.aws.amazon.com/support/
- Render Support: https://render.com/docs
- GitHub Issues: https://github.com/alpro1000/STAVAGENT/issues
