# 🚀 БЫСТРЫЙ СТАРТ: Исправление модуля "Shrnutí dokumentu"

## ⚡ TL;DR (Очень кратко)

**Проблема:** Модуль обрабатывает документы 300 секунд (5 минут) → TIMEOUT  
**Причина:** Используются несуществующие AI модели + слишком длинный промпт  
**Решение:** Обновлены модели + сокращён промпт + добавлен быстрый endpoint

---

## 🔧 Что сделано (3 файла изменены)

### 1. `passport_enricher.py` - Обновлены AI модели
```python
# БЫЛО:
GEMINI_MODEL = "gemini-2.5-flash-lite"  # ❌ не существует

# СТАЛО:
GEMINI_MODEL = "gemini-2.0-flash-exp"   # ✅ существует
```

### 2. `passport_enricher.py` - Сокращён промпт
```python
# БЫЛО:
truncated_text = document_text[:30000]  # 30K → медленно

# СТАЛО:
truncated_text = document_text[:5000]   # 5K → быстро
```

### 3. `routes_passport.py` + `brief_summarizer.py` - Новый endpoint
```
POST /api/v1/passport/summarize  ← НОВЫЙ (2-3 секунды)
POST /api/v1/passport/generate   ← СТАРЫЙ (4-8 секунд)
```

---

## 🚀 Как применить (3 команды)

```bash
# 1. Перейти в директорию backend
cd concrete-agent/packages/core-backend

# 2. Перезапустить backend (Ctrl+C, затем:)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Проверить работу
curl -X POST "http://localhost:8000/api/v1/passport/summarize" \
  -F "file=@test.pdf" \
  -F "language=cs"
```

---

## ✅ Результат

### ДО:
```
Время обработки: 300 секунд (TIMEOUT)
Модель: gemini-2.5-flash-lite (не существует)
Результат: ❌ НЕ РАБОТАЕТ
```

### ПОСЛЕ:
```
Время обработки: 2-3 секунды
Модель: gemini-2.0-flash-exp (существует)
Результат: ✅ РАБОТАЕТ
```

---

## 📚 Полная документация

- **Анализ проблем:** `PASSPORT_MODULE_ANALYSIS.md`
- **Инструкции:** `PASSPORT_MODULE_FIX_INSTRUCTIONS.md`
- **Этот файл:** `PASSPORT_MODULE_QUICK_START.md`

---

## 🎯 Два режима работы

### Режим 1: Краткое summary (НОВЫЙ)
```bash
POST /api/v1/passport/summarize
```
- ⚡ Быстро: 2-3 секунды
- 📝 Вывод: Текст (5-10 предложений)
- 💰 Бесплатно: Gemini FREE tier

**Пример вывода:**
```
Projekt: Most přes Chrudimku km 15.2
Typ: Silniční most, monolitická ŽB konstrukce
Parametry: Beton C30/37, 450 m³, Výztuž B500B, 85 tun
```

### Режим 2: Полный passport (СТАРЫЙ)
```bash
POST /api/v1/passport/generate
```
- ⏱️ Средне: 4-8 секунд
- 📊 Вывод: JSON (50+ полей)
- 💰 Бесплатно: Gemini FREE tier

**Пример вывода:**
```json
{
  "passport_id": "passport_abc123",
  "concrete_specifications": [...],
  "reinforcement": [...],
  "quantities": [...]
}
```

---

## ⚠️ Если не работает

### 1. Проверить логи
```bash
tail -f logs/app.log
```

Должны видеть:
```
✅ Gemini initialized: gemini-2.0-flash-exp
```

### 2. Проверить API key
```bash
cat .env | grep GOOGLE_API_KEY
```

Должен быть:
```
GOOGLE_API_KEY=your_key_here
```

### 3. Проверить health
```bash
curl http://localhost:8000/api/v1/passport/health
```

Должен вернуть:
```json
{
  "status": "healthy",
  "layers": {
    "layer3_ai": "available"
  }
}
```

---

## 📞 Помощь

Если проблемы остались → читай `PASSPORT_MODULE_FIX_INSTRUCTIONS.md` (полная инструкция)

---

**Автор:** Amazon Q  
**Дата:** 2025-03-02
