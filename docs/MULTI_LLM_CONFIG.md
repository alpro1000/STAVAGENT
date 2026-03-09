# Multi-LLM Configuration для STAVAGENT

## 🎯 Текущее состояние

**УЖЕ РАБОТАЕТ:**
- ✅ Claude (основной)
- ✅ Gemini (есть в orchestrator.py)
- ✅ Auto fallback (Gemini → Claude)

**ДОБАВИТЬ:**
- 🆕 OpenAI (GPT-4)
- 🆕 Vertex AI Search (поиск норм)

---

## 📋 Environment Variables

```bash
# concrete-agent/.env

# ============================================================================
# AI MODELS (Multi-Role Audit)
# ============================================================================

# Основная модель для Multi-Role
# Варианты: claude | gemini | openai | auto
MULTI_ROLE_LLM=gemini

# API ключи
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-...

# ============================================================================
# GOOGLE CLOUD (Vertex AI Search для норм ÚRS)
# ============================================================================

# Включить Vertex AI Search для поиска норм
ENABLE_VERTEX_SEARCH=true

# Google Cloud настройки
GOOGLE_PROJECT_ID=project-947a512a-481d-49b5-81c
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
VERTEX_SEARCH_DATASTORE_ID=your_datastore_id

# ============================================================================
# FEATURE FLAGS
# ============================================================================

# Workflow A/B (уже есть)
ENABLE_WORKFLOW_A=true
ENABLE_WORKFLOW_B=false

# KROS matching (уже есть)
ENABLE_KROS_MATCHING=true
```

---

## 🔧 Как работает Multi-LLM

### 1. В orchestrator.py (УЖЕ ЕСТЬ)

```python
# Строка 60-100 в orchestrator.py
multi_role_llm = settings.MULTI_ROLE_LLM.lower()

if multi_role_llm == "gemini":
    self.llm_client = GeminiClient()
elif multi_role_llm == "openai":
    self.llm_client = OpenAIClient()  # ← ДОБАВИТЬ
elif multi_role_llm == "auto":
    # Gemini → Claude fallback
    self.llm_client = GeminiClient()
    self.fallback_client = ClaudeClient()
else:
    self.llm_client = ClaudeClient()
```

### 2. Добавить OpenAI Client

**Файл:** `concrete-agent/packages/core-backend/app/core/openai_client.py`

```python
import os
from openai import OpenAI

class OpenAIClient:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model_name = "gpt-4-turbo-preview"
    
    def call(self, prompt: str, system_prompt: str = None, temperature: float = 0.7):
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=temperature
        )
        
        return {"raw_text": response.choices[0].message.content}
```

---

## 🎯 Vertex AI Search Integration

### В workflow_c.py (ДОБАВИТЬ)

```python
async def _enrich_positions(self, positions):
    # Текущий KROS enricher
    enriched = []
    
    # НОВОЕ: Vertex AI Search
    vertex_enabled = os.getenv("ENABLE_VERTEX_SEARCH") == "true"
    if vertex_enabled:
        from app.integrations.vertex_search import get_vertex_client
        vertex_client = get_vertex_client()
    
    for pos in positions:
        # 1. KROS enricher (как раньше)
        result = self.enricher.enrich(pos)
        pos.update(result)
        
        # 2. Vertex AI Search (если включен)
        if vertex_enabled and pos.get("description"):
            try:
                norms = await vertex_client.search_norms(
                    pos["description"], 
                    top_k=3
                )
                pos["vertex_norms"] = [
                    {
                        "code": n.norm_code,
                        "price_czk": n.unit_price_czk,
                        "confidence": n.confidence
                    }
                    for n in norms
                ]
            except:
                pos["vertex_norms"] = []
        
        enriched.append(pos)
    
    return enriched
```

---

## 📊 Сравнение моделей

| Модель | Скорость | Цена | Качество | Использование |
|--------|----------|------|----------|---------------|
| **Gemini Flash** | ⚡⚡⚡ | 💰 | ⭐⭐⭐ | Multi-Role (быстро) |
| **Claude Sonnet** | ⚡⚡ | 💰💰 | ⭐⭐⭐⭐⭐ | Парсинг PDF (точно) |
| **GPT-4 Turbo** | ⚡⚡ | 💰💰💰 | ⭐⭐⭐⭐ | Резерв |
| **Vertex Search** | ⚡⚡⚡ | 💰 | ⭐⭐⭐⭐ | Поиск норм ÚRS |

---

## ✅ Рекомендуемая конфигурация

```bash
# Оптимальная настройка для production

# Multi-Role: Gemini (быстро + дешево)
MULTI_ROLE_LLM=gemini
GOOGLE_API_KEY=AIzaSy...

# Парсинг PDF: Claude (лучшее качество)
ANTHROPIC_API_KEY=sk-ant-...

# Поиск норм: Vertex AI Search (GenAI кредит $1000)
ENABLE_VERTEX_SEARCH=true
VERTEX_SEARCH_DATASTORE_ID=...

# Резерв: OpenAI (если Gemini недоступен)
OPENAI_API_KEY=sk-...
```

---

## 🚀 Что делать

### 1. Добавить OpenAI Client (5 минут)

```bash
cd concrete-agent/packages/core-backend
pip install openai

# Создать app/core/openai_client.py (код выше)
```

### 2. Обновить orchestrator.py (2 строки)

```python
# Строка 70 в orchestrator.py
elif multi_role_llm == "openai":
    from app.core.openai_client import OpenAIClient
    self.llm_client = OpenAIClient()
    self.llm_name = "openai"
```

### 3. Настроить .env

```bash
# Добавить в .env
MULTI_ROLE_LLM=gemini
ENABLE_VERTEX_SEARCH=true
```

---

## 💡 Feature Flags - Как использовать

```python
# В любом месте кода:
import os

# Проверить feature flag
if os.getenv("ENABLE_VERTEX_SEARCH") == "true":
    # Использовать Vertex AI Search
    vertex_client = get_vertex_client()
    norms = await vertex_client.search_norms(description)
else:
    # Только KROS enricher (как раньше)
    norms = []
```

**Преимущества:**
- ✅ Безопасно для production (можно отключить)
- ✅ Постепенное внедрение
- ✅ A/B тестирование
- ✅ Откат за 1 секунду (изменить .env)

---

## 📈 Итого

**Минимальные изменения:**
1. Добавить `openai_client.py` (30 строк)
2. Обновить `orchestrator.py` (2 строки)
3. Добавить в `workflow_c.py` (15 строк для Vertex Search)
4. Настроить `.env` (3 переменные)

**Результат:**
- 🎯 3 AI модели (Claude, Gemini, OpenAI)
- 🔍 Vertex AI Search для норм
- 🎚️ Feature flags для контроля
- 💰 Оптимальное использование кредитов

**Безопасно - ничего не ломается!**
