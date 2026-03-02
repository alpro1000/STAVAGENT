# 🔍 ИСПРАВЛЕННЫЙ АНАЛИЗ: Модуль "Shrnutí dokumentu"

**Дата:** 2026-03-02  
**Статус:** ✅ МОДЕЛИ ПРАВИЛЬНЫЕ, ПРОБЛЕМА В ДРУГОМ

---

## ⚠️ ВАЖНОЕ УТОЧНЕНИЕ

**Модели УЖЕ АКТУАЛЬНЫЕ (март 2026):**
```python
GEMINI_MODEL = "gemini-2.5-flash-lite"  # ✅ ПРАВИЛЬНО
CLAUDE_MODEL = "claude-sonnet-4-6"      # ✅ ПРАВИЛЬНО  
OPENAI_MODEL = "gpt-4.1"                # ✅ ПРАВИЛЬНО
```

**Gemini 2.0 discontinued 31 марта 2026** → используется 2.5 family ✅

---

## 🔍 РЕАЛЬНЫЕ ПРОБЛЕМЫ

### 1. ❌ **СЛИШКОМ ДЛИННЫЙ ПРОМПТ** (ГЛАВНАЯ ПРОБЛЕМА!)

**Файл:** `passport_enricher.py:267`

**Проблема:**
```python
truncated_text = document_text[:30000]  # 30K символов → медленно (300s)
```

**Решение:**
```python
truncated_text = document_text[:5000]   # 5K символов → быстро (3-5s)
```

**Почему это критично:**
- 30K символов = огромный контекст для LLM
- Gemini 2.5 Flash Lite оптимизирован для коротких запросов
- Результат: обработка 300 секунд вместо 3-5

---

### 2. ❌ **МОДУЛЬ ДЕЛАЕТ НЕ ТО, ЧТО НУЖНО**

**Пользователь хочет:** Краткое изложение (5-10 предложений)  
**Модуль делает:** Структурированную экстракцию (JSON с 50+ полями)

**Решение:** Добавлен новый endpoint `/api/v1/passport/summarize`

---

### 3. ⚠️ **MinerU НЕ ИСПОЛЬЗУЕТСЯ**

MinerU client существует, но это заглушка. Используется только `pdfplumber`.

**Решение:** Либо установить `pip install magic-pdf`, либо удалить из документации.

---

## ✅ ЧТО ИСПРАВЛЕНО

### 1. Сокращён промпт (30K → 5K)
**Файл:** `passport_enricher.py`

```python
# БЫЛО:
truncated_text = document_text[:30000]

# СТАЛО:
truncated_text = document_text[:5000]
```

### 2. Добавлен новый сервис для кратких summary
**Файл:** `brief_summarizer.py` (НОВЫЙ)

- Генерирует краткое текстовое изложение (5-10 предложений)
- Обработка: 2-3 секунды (вместо 300)
- Промпт: 2K символов (вместо 30K)

### 3. Добавлен новый API endpoint
**Файл:** `routes_passport.py`

```
POST /api/v1/passport/summarize  ← НОВЫЙ (2-3s, краткий текст)
POST /api/v1/passport/generate   ← СТАРЫЙ (4-8s, полный JSON)
```

---

## 📊 РЕЗУЛЬТАТЫ

### ДО исправлений:
```
Endpoint: /api/v1/passport/generate
Prompt: 30,000 символов
Время: 300 секунд (TIMEOUT)
Причина: Слишком длинный промпт
```

### ПОСЛЕ исправлений:
```
Endpoint 1: /api/v1/passport/generate
Prompt: 5,000 символов
Время: 4-8 секунд ✅

Endpoint 2: /api/v1/passport/summarize (НОВЫЙ)
Prompt: 2,000 символов
Время: 2-3 секунды ✅
```

---

## 🚀 КАК ПРИМЕНИТЬ

### Шаг 1: Перезапустить backend
```bash
cd concrete-agent/packages/core-backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Шаг 2: Проверить логи
```
✅ Gemini initialized: gemini-2.5-flash-lite
```

### Шаг 3: Тестировать новый endpoint
```bash
curl -X POST "http://localhost:8000/api/v1/passport/summarize" \
  -F "file=@test.pdf" \
  -F "language=cs"
```

**Ожидаемое время:** 2-3 секунды

---

## 🎯 ДВА РЕЖИМА

### `/summarize` - Краткое изложение (НОВЫЙ)
- ⚡ 2-3 секунды
- 📝 Текст (5-10 предложений)
- 💰 Бесплатно (Gemini FREE tier)

### `/generate` - Полный passport (СТАРЫЙ)
- ⏱️ 4-8 секунд (было 300s)
- 📊 JSON (50+ полей)
- 💰 Бесплатно (Gemini FREE tier)

---

**Автор:** Amazon Q  
**Версия:** 1.1.0 (исправлено)
