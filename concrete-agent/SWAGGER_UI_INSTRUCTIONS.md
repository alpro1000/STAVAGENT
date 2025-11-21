# Как использовать Swagger UI для тестирования эндпоинтов

## 🔧 Проблема: Не видны поля ввода в Swagger UI

Если вы не видите поля для ввода данных в Swagger UI, следуйте этой инструкции:

---

## ✅ Шаг 1: Очистите кэш браузера

Swagger UI может использовать старую версию OpenAPI схемы из кэша.

**Способы очистки:**

### Windows (Chrome/Edge):
```
Ctrl + Shift + R  (жесткая перезагрузка)
или
Ctrl + F5
```

### macOS (Chrome/Safari):
```
Cmd + Shift + R
```

### Альтернатива: Режим инкогнито
- Chrome: `Ctrl + Shift + N` (Windows) или `Cmd + Shift + N` (Mac)
- Edge: `Ctrl + Shift + P`
- Firefox: `Ctrl + Shift + P`

Откройте в режиме инкогнито:
```
https://concrete-agent.onrender.com/docs
```

---

## ✅ Шаг 2: Правильное использование Swagger UI

### Как тестировать POST эндпоинт:

1. **Откройте /docs**
   ```
   https://concrete-agent.onrender.com/docs
   ```

2. **Найдите нужный эндпоинт** (например, `POST /api/chat/assistant`)

3. **Кликните на эндпоинт** - он развернется

4. **🚨 ВАЖНО: Кликните кнопку "Try it out"** в правом верхнем углу секции эндпоинта
   - До клика: поля серые и недоступны
   - После клика: поля становятся редактируемыми

5. **Введите данные** в JSON редакторе:
   ```json
   {
     "question": "Jaké jsou požadavky ČSN pro beton C30/37?",
     "context": {
       "project_name": "Test"
     }
   }
   ```

6. **Кликните "Execute"**

7. **Смотрите результат** в секции "Responses" ниже

---

## 📋 Примеры запросов для каждого эндпоинта

### 1. POST /api/chat/assistant
Работает БЕЗ проекта - можно тестировать сразу!

```json
{
  "question": "Jaké jsou aktuální normy ČSN pro beton C30/37?",
  "context": {
    "project_name": "Most přes potok"
  }
}
```

**Ожидаемый результат:** Status 200, ответ с нормами ČSN

---

### 2. POST /api/workflow/a/tech-card

⚠️ **Требует существующий проект!**

Сначала создайте проект:

**Шаг A: Создать проект**
```
POST /api/chat/projects
{
  "name": "Test Project",
  "workflow": "A"
}
```

Скопируйте `project_id` из ответа (например: `proj_abc123def456`)

**Шаг B: Загрузить файл**
```
POST /api/upload-to-project?project_id=proj_abc123def456
```
Загрузите Excel файл с выказом вымер

**Шаг C: Дождаться обработки** (проверяйте статус через GET /api/projects/{project_id})

**Шаг D: Сгенерировать tech card**
```json
{
  "project_id": "proj_abc123def456",
  "position_id": "pos_001"
}
```

Замените `pos_001` на реальный position_id из вашего проекта.

**Как получить position_id:**
```
GET /api/workflow/a/positions?project_id=proj_abc123def456
```

---

### 3. POST /api/workflow/a/resource-sheet

Аналогично tech-card:

```json
{
  "project_id": "proj_abc123def456",
  "position_id": "pos_001"
}
```

---

### 4. POST /api/workflow/a/materials

```json
{
  "project_id": "proj_abc123def456",
  "position_id": "pos_001"
}
```

---

### 5. POST /api/workflow/a/enrich

```json
{
  "project_id": "proj_abc123def456",
  "position_id": "pos_001",
  "include_claude_analysis": true
}
```

---

### 6. POST /api/chat/enrich

```json
{
  "project_id": "proj_abc123def456",
  "position_id": "pos_001",
  "action": "enrich"
}
```

---

## 🐛 Если проблема остается

Если после очистки кэша поля все еще не видны:

### Вариант 1: Проверить OpenAPI схему напрямую
```
https://concrete-agent.onrender.com/openapi.json
```

Найдите в схеме ваш эндпоинт (Ctrl+F: "tech-card") и проверьте что там есть `requestBody`.

### Вариант 2: Использовать curl напрямую

Вместо Swagger UI используйте curl:

```bash
# Windows (PowerShell)
curl -X POST "https://concrete-agent.onrender.com/api/chat/assistant" `
  -H "Content-Type: application/json" `
  -d '{\"question\": \"Jaké jsou požadavky ČSN pro beton C30/37?\"}'

# Linux/macOS/Git Bash
curl -X POST "https://concrete-agent.onrender.com/api/chat/assistant" \
  -H "Content-Type: application/json" \
  -d '{"question": "Jaké jsou požadavky ČSN pro beton C30/37?"}'
```

### Вариант 3: Использовать Postman или Insomnia

1. Скачайте [Postman](https://www.postman.com/downloads/)
2. Создайте POST запрос:
   - URL: `https://concrete-agent.onrender.com/api/chat/assistant`
   - Headers: `Content-Type: application/json`
   - Body: Raw JSON:
     ```json
     {
       "question": "Jaké jsou požadavky ČSN pro beton C30/37?"
     }
     ```
3. Кликните Send

---

## ✅ Проверка: API работает правильно!

Мы проверили - все эндпоинты имеют правильные requestBody определения:

```
[OK] /api/workflow/a/tech-card - TechCardRequest (project_id, position_id, action)
[OK] /api/workflow/a/resource-sheet - ResourceSheetRequest
[OK] /api/workflow/a/materials - MaterialsRequest
[OK] /api/workflow/a/enrich - EnrichPositionRequest
[OK] /api/chat/assistant - AssistantRequest
[OK] /api/chat/enrich - EnrichRequest
```

Все тесты прошли успешно:
- Status 200 (успех) или 404 (ресурс не найден)
- НЕТ статуса 422 (validation error)

**Вывод:** Код API работает идеально, проблема только в отображении в браузере.

---

## 🔗 Полезные ссылки

- **Swagger UI:** https://concrete-agent.onrender.com/docs
- **ReDoc:** https://concrete-agent.onrender.com/redoc
- **OpenAPI JSON:** https://concrete-agent.onrender.com/openapi.json
- **Health Check:** https://concrete-agent.onrender.com/health

---

## 💡 Совет для фронтенда

Если фронтенд не работает, проблема скорее всего НЕ в эндпоинтах (мы это проверили).

Возможные причины:
1. Фронтенд использует неправильный URL (может старый localhost вместо render.com)
2. CORS проблема (но у нас allow_origins=["*"], так что это не должно быть проблемой)
3. Фронтенд ожидает другую структуру ответа
4. Фронтенд не передает правильные headers (Content-Type: application/json)

**Проверьте в DevTools (F12) → Network tab:**
- Какие запросы отправляет фронтенд?
- Какие статусы возвращаются?
- Что в Request Body?
- Что в Response?
