# Frontend Integration Guide

## 🎯 Проблема: Фронтенд не может вызвать API эндпоинты

Если ваш фронтенд не работает с API, следуйте этому руководству.

---

## ✅ Проверка 1: URL эндпоинтов

### Production URL (Render.com):
```
https://concrete-agent.onrender.com
```

### Проверьте в коде фронтенда:

**JavaScript/TypeScript:**
```javascript
// ❌ НЕПРАВИЛЬНО (localhost)
const API_BASE_URL = "http://localhost:8000";

// ✅ ПРАВИЛЬНО (production)
const API_BASE_URL = "https://concrete-agent.onrender.com";

// ✅ ЕЩЕ ЛУЧШЕ (автоопределение)
const API_BASE_URL = process.env.REACT_APP_API_URL ||
                     "https://concrete-agent.onrender.com";
```

**Python (если фронтенд на Python - Streamlit/Gradio):**
```python
# ❌ НЕПРАВИЛЬНО
API_BASE_URL = "http://localhost:8000"

# ✅ ПРАВИЛЬНО
API_BASE_URL = "https://concrete-agent.onrender.com"
```

---

## ✅ Проверка 2: Content-Type заголовок

**Обязательно** отправляйте `Content-Type: application/json` для POST запросов!

### JavaScript (fetch):
```javascript
// ✅ ПРАВИЛЬНО
const response = await fetch('https://concrete-agent.onrender.com/api/chat/assistant', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',  // ОБЯЗАТЕЛЬНО!
  },
  body: JSON.stringify({
    question: "Jaké jsou požadavky ČSN pro beton C30/37?",
    context: {
      project_name: "Test"
    }
  })
});

const data = await response.json();
console.log(data);
```

### JavaScript (axios):
```javascript
import axios from 'axios';

// ✅ ПРАВИЛЬНО (axios автоматически ставит Content-Type: application/json)
const response = await axios.post(
  'https://concrete-agent.onrender.com/api/chat/assistant',
  {
    question: "Jaké jsou požadavky ČSN pro beton C30/37?",
    context: {
      project_name: "Test"
    }
  }
);

console.log(response.data);
```

### Python (requests):
```python
import requests

# ✅ ПРАВИЛЬНО
response = requests.post(
    'https://concrete-agent.onrender.com/api/chat/assistant',
    json={  # json= автоматически ставит Content-Type
        'question': 'Jaké jsou požadavky ČSN pro beton C30/37?',
        'context': {
            'project_name': 'Test'
        }
    }
)

print(response.json())
```

---

## ✅ Проверка 3: Структура request body

### POST /api/chat/assistant
```javascript
// ✅ ПРАВИЛЬНАЯ структура
{
  "question": "Jaké jsou aktuální normy ČSN pro beton C30/37?",
  "context": {  // Optional
    "project_name": "Most přes potok"
  }
}

// ❌ НЕПРАВИЛЬНО (лишние поля)
{
  "query": "...",  // Должно быть "question"
  "text": "...",   // Должно быть "question"
}
```

### POST /api/workflow/a/tech-card
```javascript
// ✅ ПРАВИЛЬНАЯ структура
{
  "project_id": "proj_abc123",  // Обязательно
  "position_id": "pos_001"       // Обязательно
}

// ❌ НЕПРАВИЛЬНО
{
  "projectId": "...",  // Должно быть "project_id" (snake_case!)
  "positionId": "..."  // Должно быть "position_id"
}
```

**⚠️ ВАЖНО:** API использует `snake_case` (project_id), НЕ `camelCase` (projectId)!

---

## ✅ Проверка 4: Обработка ошибок

### Коды статуса:

| Код | Значение | Действие |
|-----|----------|----------|
| 200 | Успех | Все ОК |
| 404 | Не найдено | Проект/позиция не существует |
| 422 | Validation Error | Неправильная структура request body |
| 500 | Server Error | Ошибка на сервере |

### JavaScript пример обработки:
```javascript
try {
  const response = await fetch('https://concrete-agent.onrender.com/api/chat/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: "Jaké jsou požadavky ČSN pro beton C30/37?"
    })
  });

  if (!response.ok) {
    // Обработка ошибок
    if (response.status === 404) {
      console.error('Ресурс не найден');
    } else if (response.status === 422) {
      const error = await response.json();
      console.error('Ошибка валидации:', error.detail);
    } else {
      console.error('Ошибка сервера:', response.status);
    }
    return;
  }

  const data = await response.json();
  console.log('Успех:', data);

} catch (error) {
  console.error('Network error:', error);
}
```

---

## 🔍 Debugging: Проверка запросов в браузере

### Как проверить что отправляет фронтенд:

1. **Откройте DevTools** (F12)
2. **Перейдите на вкладку Network**
3. **Выполните действие** на фронтенде
4. **Найдите запрос** к API в списке
5. **Кликните на запрос** и проверьте:

   **Headers:**
   - Request URL: должен быть `https://concrete-agent.onrender.com/...`
   - Request Method: должен быть `POST`
   - Content-Type: должен быть `application/json`

   **Payload:**
   - Проверьте что отправляется в body
   - Должен быть правильный JSON

   **Response:**
   - Status Code: 200 = OK, 404 = not found, 422 = validation error
   - Смотрите ответ сервера

---

## 📋 Полный пример интеграции

### React Component:

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'https://concrete-agent.onrender.com';

function AssistantChat() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const askQuestion = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE}/api/chat/assistant`, {
        question: question,
        context: {
          project_name: 'My Project'
        }
      });

      setAnswer(response.data);
    } catch (err) {
      if (err.response) {
        // Сервер ответил с ошибкой
        setError(`Error ${err.response.status}: ${err.response.data.detail || 'Unknown error'}`);
      } else if (err.request) {
        // Запрос был отправлен, но ответа нет
        setError('Network error - no response from server');
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Construction Assistant</h1>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Zadejte otázku..."
        rows={4}
        cols={50}
      />
      <br />

      <button onClick={askQuestion} disabled={loading}>
        {loading ? 'Zpracovává se...' : 'Odeslat'}
      </button>

      {error && (
        <div style={{color: 'red'}}>
          <h3>Chyba:</h3>
          <p>{error}</p>
        </div>
      )}

      {answer && (
        <div>
          <h3>Odpověď:</h3>
          <p>{answer.answer}</p>

          {answer.sources && answer.sources.length > 0 && (
            <>
              <h4>Zdroje:</h4>
              <ul>
                {answer.sources.map((source, i) => (
                  <li key={i}>{source}</li>
                ))}
              </ul>
            </>
          )}

          {answer.related_norms && answer.related_norms.length > 0 && (
            <>
              <h4>Související normy:</h4>
              <ul>
                {answer.related_norms.map((norm, i) => (
                  <li key={i}>{norm}</li>
                ))}
              </ul>
            </>
          )}

          <p>
            <strong>Confidence:</strong> {(answer.confidence * 100).toFixed(1)}%
            <br />
            <strong>Language:</strong> {answer.language}
          </p>
        </div>
      )}
    </div>
  );
}

export default AssistantChat;
```

---

## 🚀 Тестовый запрос из консоли браузера

Откройте DevTools (F12) → Console и вставьте:

```javascript
// Test 1: Chat Assistant
fetch('https://concrete-agent.onrender.com/api/chat/assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: "Jaké jsou aktuální normy ČSN pro beton C30/37?"
  })
})
  .then(r => r.json())
  .then(data => console.log('SUCCESS:', data))
  .catch(err => console.error('ERROR:', err));
```

Если это работает, значит API работает, проблема в коде фронтенда.

---

## ⚠️ Частые ошибки

### 1. CORS Error
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Решение:** Это не должно происходить, т.к. на сервере `allow_origins=["*"]`.
Если происходит, проверьте что запрос идет по HTTPS, не HTTP.

### 2. 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "question"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Решение:** Проверьте структуру request body. Поле `question` отсутствует или написано неправильно.

### 3. 404 Not Found на эндпоинте
```
404: Not Found
```

**Решение:** Проверьте URL. Должно быть:
- ✅ `/api/chat/assistant`
- ❌ `/chat/assistant` (без /api)
- ❌ `/api/assistant` (без /chat)

### 4. Network Error / Failed to fetch
```
TypeError: Failed to fetch
```

**Причины:**
1. Неправильный URL (опечатка)
2. Сервер недоступен
3. Проблема с интернетом
4. Mixed content (HTTP → HTTPS)

**Решение:** Проверьте URL и что сервер работает:
```
https://concrete-agent.onrender.com/health
```

---

## ✅ Checklist для фронтенда

- [ ] URL: `https://concrete-agent.onrender.com` (не localhost!)
- [ ] Method: `POST`
- [ ] Header: `Content-Type: application/json`
- [ ] Body: Правильная JSON структура с `snake_case` полями
- [ ] Обработка ошибок (404, 422, 500)
- [ ] Таймаут для долгих запросов (assistant может отвечать 10-30 сек)

---

## 📞 Нужна помощь?

Если после всех проверок не работает:

1. **Проверьте в DevTools:**
   - F12 → Network
   - Что отправляется в Request?
   - Что возвращается в Response?
   - Status code?

2. **Попробуйте curl:**
   ```bash
   curl -X POST "https://concrete-agent.onrender.com/api/chat/assistant" \
     -H "Content-Type: application/json" \
     -d '{"question": "Test"}'
   ```

3. **Откройте issue с:**
   - Request URL
   - Request body
   - Response status + body
   - Скриншот Network tab
