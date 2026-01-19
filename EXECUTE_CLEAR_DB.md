# Инструкция по очистке Production БД

## 📋 Ваша БД:
```
Host: dpg-d4ao5tripnbc73aegphg-a.oregon-postgres.render.com
Database: monolit_planner
User: monolit_user
Password: XG78v4ASVxwe3X8uEg0Cma6tviE7xcVx
```

---

## 🚀 Вариант 1: Через командную строку (быстрый)

### Шаг 1: Проверьте текущее состояние

```bash
psql "postgresql://monolit_user:XG78v4ASVxwe3X8uEg0Cma6tviE7xcVx@dpg-d4ao5tripnbc73aegphg-a.oregon-postgres.render.com/monolit_planner" -c "SELECT COUNT(*) FROM monolith_projects;"
```

### Шаг 2: Очистите БД (ОДНОЙ КОМАНДОЙ)

```bash
psql "postgresql://monolit_user:XG78v4ASVxwe3X8uEg0Cma6tviE7xcVx@dpg-d4ao5tripnbc73aegphg-a.oregon-postgres.render.com/monolit_planner" << 'EOF'
BEGIN;
DELETE FROM positions;
DELETE FROM parts;
DELETE FROM snapshots;
DELETE FROM bridges;
DELETE FROM monolith_projects;
COMMIT;
SELECT 'Database cleared!' as status;
SELECT COUNT(*) as remaining_projects FROM monolith_projects;
EOF
```

### Шаг 3: Проверьте результат

```bash
psql "postgresql://monolit_user:XG78v4ASVxwe3X8uEg0Cma6tviE7xcVx@dpg-d4ao5tripnbc73aegphg-a.oregon-postgres.render.com/monolit_planner" -c "SELECT COUNT(*) FROM monolith_projects; SELECT COUNT(*) FROM positions;"
```

**Ожидается:** 0 проектов, 0 позиций

---

## 🖥️ Вариант 2: Через Render Dashboard (визуальный)

### Шаг 1: Откройте psql в Render

1. Зайдите на https://dashboard.render.com
2. Найдите PostgreSQL сервис "monolit_planner"
3. Нажмите кнопку **"Connect"** → **"External Connection"**
4. Скопируйте команду подключения
5. Выполните в терминале

### Шаг 2: Выполните команды

После подключения к БД введите:

```sql
-- 1. Проверьте что сейчас в БД
SELECT COUNT(*) FROM monolith_projects;

-- 2. Удалите всё (COPY-PASTE всё вместе)
BEGIN;
DELETE FROM positions;
DELETE FROM parts;
DELETE FROM snapshots;
DELETE FROM bridges;
DELETE FROM monolith_projects;
COMMIT;

-- 3. Проверьте результат
SELECT COUNT(*) FROM monolith_projects;
```

**Ожидается:** 0

---

## 🔧 Вариант 3: Через SQL файл

### Шаг 1: Загрузите SQL файл

Я создал файл: `clear-production-db.sql`

### Шаг 2: Выполните его

```bash
psql "postgresql://monolit_user:XG78v4ASVxwe3X8uEg0Cma6tviE7xcVx@dpg-d4ao5tripnbc73aegphg-a.oregon-postgres.render.com/monolit_planner" < clear-production-db.sql
```

---

## ❗ Возможные ошибки

### Ошибка: "could not translate host name"

Попробуйте с другим регионом:

```bash
# Если oregon не работает, попробуйте:
psql "postgresql://monolit_user:XG78v4ASVxwe3X8uEg0Cma6tviE7xcVx@dpg-d4ao5tripnbc73aegphg-a.render.com/monolit_planner"
```

### Ошибка: "psql: command not found"

Установите PostgreSQL:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Windows
# Скачайте с https://www.postgresql.org/download/
```

---

## ✅ После очистки

1. **Обновите страницу** Monolit Planner (F5)
2. Список проектов должен быть **пустой**
3. Сделайте импорт Excel файла
4. **Проверьте backend логи** на Render
5. Ищите строки:
   ```
   [Upload] ✅ Created bridge: ...
   [Upload] 🚀 Inserted ... positions
   ```
6. **Обновите страницу** (F5)
7. Проекты должны **остаться** (не исчезнуть!)

---

## 🆘 Если не получается

Пришлите мне:
- Текст ошибки из терминала
- Скриншот команды которую вы выполняли

Я помогу!
