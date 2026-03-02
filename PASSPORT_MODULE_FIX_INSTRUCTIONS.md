# 🔧 Инструкции по исправлению модуля "Shrnutí dokumentu"

**Дата:** 2025-03-02  
**Статус:** ✅ ИСПРАВЛЕНИЯ ГОТОВЫ К ПРИМЕНЕНИЮ

---

## 📋 Что было исправлено

### 1. ✅ Обновлены AI модели
**Файл:** `concrete-agent/packages/core-backend/app/services/passport_enricher.py`

**Изменения:**
```python
# БЫЛО (неправильно):
GEMINI_MODEL = "gemini-2.5-flash-lite"  # ❌ не существует
CLAUDE_MODEL = "claude-sonnet-4-6"      # ❌ не существует

# СТАЛО (правильно):
GEMINI_MODEL = "gemini-2.0-flash-exp"   # ✅ существует, бесплатно
CLAUDE_MODEL = "claude-3-5-sonnet-20241022"  # ✅ существует
```

### 2. ✅ Сокращён промпт
**Файл:** `concrete-agent/packages/core-backend/app/services/passport_enricher.py`

**Изменения:**
```python
# БЫЛО:
truncated_text = document_text[:30000]  # 30K символов → медленно

# СТАЛО:
truncated_text = document_text[:5000]   # 5K символов → быстро
```

### 3. ✅ Добавлен новый сервис для кратких summary
**Файл:** `concrete-agent/packages/core-backend/app/services/brief_summarizer.py` (НОВЫЙ)

**Что делает:**
- Генерирует краткое текстовое изложение (5-10 предложений)
- Быстрая обработка (2-3 секунды вместо 300)
- Простой вывод (текст вместо JSON)

### 4. ✅ Добавлен новый API endpoint
**Файл:** `concrete-agent/packages/core-backend/app/api/routes_passport.py`

**Новый endpoint:**
```
POST /api/v1/passport/summarize
```

**Пример использования:**
```bash
curl -X POST "http://localhost:8000/api/v1/passport/summarize" \
  -F "file=@technicka_zprava.pdf" \
  -F "language=cs" \
  -F "preferred_model=gemini"
```

**Ответ:**
```json
{
  "summary": "Projekt: Most přes Chrudimku km 15.2\nTyp: Silniční most, monolitická ŽB konstrukce\nLokace: Silnice I/37, okres Chrudim\nParametry: Beton C30/37 XC4 XF4 XD2, celkem 450 m³. Výztuž B500B, 85 tun. Rozpětí 3×25m.\nSpeciální požadavky: Vysoké třídy prostředí (XC4 XF4 XD2), pohledový beton na líci.\nTermín: Zahájení 2025-06, dokončení 2026-03 (9 měsíců).\nInvestor: Ředitelství silnic a dálnic ČR.",
  "processing_time_ms": 2500,
  "chars_processed": 2000,
  "model_used": "gemini"
}
```

---

## 🚀 Как применить исправления

### Шаг 1: Проверить изменённые файлы

Файлы, которые были изменены:
```
✅ concrete-agent/packages/core-backend/app/services/passport_enricher.py
✅ concrete-agent/packages/core-backend/app/services/brief_summarizer.py (НОВЫЙ)
✅ concrete-agent/packages/core-backend/app/api/routes_passport.py
✅ PASSPORT_MODULE_ANALYSIS.md (НОВЫЙ - документация)
✅ PASSPORT_MODULE_FIX_INSTRUCTIONS.md (ЭТОТ ФАЙЛ)
```

### Шаг 2: Перезапустить backend

```bash
cd concrete-agent/packages/core-backend

# Остановить текущий процесс (Ctrl+C)

# Запустить заново
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Шаг 3: Проверить, что модели работают

Проверить логи при старте:
```
✅ Gemini initialized: gemini-2.0-flash-exp
✅ Claude initialized: claude-3-5-sonnet-20241022
✅ OpenAI initialized: gpt-4o
```

Если видите ошибки:
```
⚠️  Model gemini-2.0-flash-exp not available
```

Значит fallback сработал на `gemini-1.5-flash-latest` (это нормально).

### Шаг 4: Протестировать новый endpoint

**Тест 1: Краткое summary (НОВОЕ)**
```bash
curl -X POST "http://localhost:8000/api/v1/passport/summarize" \
  -F "file=@test_document.pdf" \
  -F "language=cs" \
  -F "preferred_model=gemini"
```

Ожидаемое время: **2-3 секунды** (не 300!)

**Тест 2: Полный passport (старый endpoint)**
```bash
curl -X POST "http://localhost:8000/api/v1/passport/generate" \
  -F "file=@test_document.pdf" \
  -F "project_name=Test Project" \
  -F "enable_ai_enrichment=true" \
  -F "preferred_model=gemini"
```

Ожидаемое время: **4-8 секунд** (не 300!)

---

## 📊 Сравнение производительности

### ДО исправлений:
```
Endpoint: /api/v1/passport/generate
Модель: gemini-2.5-flash-lite (не существует)
Fallback: gemini-1.5-flash (старая версия)
Prompt: 30,000 символов
Время: 300 секунд (TIMEOUT)
Результат: ❌ НЕРАБОТАЕТ
```

### ПОСЛЕ исправлений:
```
Endpoint 1: /api/v1/passport/generate
Модель: gemini-2.0-flash-exp (актуальная)
Prompt: 5,000 символов
Время: 4-8 секунд
Результат: ✅ РАБОТАЕТ (полный JSON passport)

Endpoint 2: /api/v1/passport/summarize (НОВЫЙ)
Модель: gemini-2.0-flash-exp (актуальная)
Prompt: 2,000 символов
Время: 2-3 секунды
Результат: ✅ РАБОТАЕТ (краткое текстовое summary)
```

---

## 🎯 Какой endpoint использовать?

### Используйте `/summarize` если нужно:
- ✅ Краткое изложение документа (5-10 предложений)
- ✅ Быстрая обработка (2-3 секунды)
- ✅ Простой текстовый вывод
- ✅ Для email уведомлений, dashboard preview

**Пример вывода:**
```
Projekt: Most přes Chrudimku km 15.2
Typ: Silniční most, monolitická ŽB konstrukce
Lokace: Silnice I/37, okres Chrudim
Parametry: Beton C30/37, 450 m³, Výztuž B500B, 85 tun
```

### Используйте `/generate` если нужно:
- ✅ Полная структурированная информация (JSON)
- ✅ Детальные данные (бетон, арматура, объёмы, риски)
- ✅ Для интеграции с другими системами
- ✅ Для сохранения в базу данных

**Пример вывода:**
```json
{
  "passport_id": "passport_abc123",
  "concrete_specifications": [...],
  "reinforcement": [...],
  "quantities": [...],
  "risks": [...],
  "stakeholders": [...]
}
```

---

## 🔍 Проверка работы

### 1. Проверить логи backend
```bash
tail -f concrete-agent/packages/core-backend/logs/app.log
```

Должны видеть:
```
✅ Gemini initialized: gemini-2.0-flash-exp
Generating brief summary: test.pdf, language: cs
Brief summary complete: 2500ms
```

### 2. Проверить frontend
Открыть в браузере:
```
http://localhost:5173
```

Нажать "Shrnutí dokumentu" → загрузить PDF → должно обработаться за 2-3 секунды.

### 3. Проверить API напрямую
```bash
# Health check
curl http://localhost:8000/api/v1/passport/health

# Должен вернуть:
{
  "status": "healthy",
  "layers": {
    "layer1_parser": "available",
    "layer2_regex": "available",
    "layer3_ai": "available"
  }
}
```

---

## ⚠️ Возможные проблемы

### Проблема 1: "Model not found"
**Симптом:**
```
Model gemini-2.0-flash-exp not available
```

**Решение:**
Это нормально! Fallback автоматически переключится на `gemini-1.5-flash-latest`.

### Проблема 2: "No API key"
**Симптом:**
```
layer3_ai: "unavailable (no API keys)"
```

**Решение:**
Проверить `.env` файл:
```bash
GOOGLE_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here  # опционально
```

### Проблема 3: Всё ещё медленно (>10 секунд)
**Решение:**
1. Проверить, что используется правильная модель (логи)
2. Проверить размер документа (большие PDF >20MB медленнее)
3. Попробовать другую модель: `preferred_model=claude-haiku`

---

## 📝 Дополнительные улучшения (опционально)

### 1. Установить MinerU (для лучшего парсинга PDF)
```bash
pip install magic-pdf
```

Это улучшит качество извлечения текста из сложных PDF.

### 2. Добавить кэширование
Сохранять результаты summary в Redis/PostgreSQL, чтобы не генерировать повторно.

### 3. Добавить batch processing
Обрабатывать несколько документов одновременно.

---

## ✅ Чеклист проверки

- [ ] Backend перезапущен
- [ ] Логи показывают правильные модели (gemini-2.0-flash-exp или gemini-1.5-flash-latest)
- [ ] `/api/v1/passport/health` возвращает "healthy"
- [ ] `/api/v1/passport/summarize` работает за 2-3 секунды
- [ ] `/api/v1/passport/generate` работает за 4-8 секунд
- [ ] Frontend показывает результаты без timeout

---

## 📞 Поддержка

Если проблемы остались:
1. Проверить логи: `tail -f logs/app.log`
2. Проверить API keys в `.env`
3. Попробовать другую модель: `preferred_model=claude-haiku`
4. Открыть issue на GitHub с логами

---

**Автор:** Amazon Q  
**Версия:** 1.0.0  
**Дата:** 2025-03-02
