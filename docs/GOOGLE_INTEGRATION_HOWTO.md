# ИНТЕГРАЦИЯ Google Cloud в Workflow C

## 📍 ГДЕ ДОБАВИТЬ КОД

### 1. В `_enrich_positions()` - Поиск норм через Vertex AI Search

**Файл:** `workflow_c.py` строка 280

**БЫЛО:**
```python
async def _enrich_positions(self, positions):
    enriched = []
    for pos in positions:
        try:
            result = self.enricher.enrich(pos)  # ← Текущий KROS enricher
            pos.update(result)
            pos["enriched"] = True
```

**ДОБАВИТЬ:**
```python
async def _enrich_positions(self, positions):
    # Импорт Vertex AI Search
    from app.integrations.vertex_search import get_vertex_client
    
    vertex_enabled = os.getenv("ENABLE_VERTEX_SEARCH") == "true"
    vertex_client = get_vertex_client() if vertex_enabled else None
    
    enriched = []
    for pos in positions:
        try:
            # 1. Текущий KROS enricher (оставить как есть)
            result = self.enricher.enrich(pos)
            pos.update(result)
            
            # 2. НОВОЕ: Vertex AI Search для норм ÚRS
            if vertex_client and pos.get("description"):
                try:
                    norm_matches = await vertex_client.search_norms(
                        work_description=pos["description"],
                        top_k=3
                    )
                    pos["vertex_norms"] = [
                        {
                            "code": m.norm_code,
                            "title": m.title,
                            "unit_price_czk": m.unit_price_czk,
                            "confidence": m.confidence
                        }
                        for m in norm_matches
                    ]
                except Exception as e:
                    logger.warning(f"Vertex Search failed: {e}")
                    pos["vertex_norms"] = []
            
            pos["enriched"] = True
```

---

### 2. В `_audit_positions()` - Использовать найденные нормы

**Файл:** `workflow_c.py` строка 320

**ДОБАВИТЬ перед Multi-Role:**
```python
async def _audit_positions(self, positions, project_name, use_parallel=True):
    # Подготовить данные для аудита
    positions_with_norms = []
    for pos in positions:
        pos_data = {
            "code": pos.get("code"),
            "description": pos.get("description"),
            "unit": pos.get("unit"),
            "quantity": pos.get("quantity"),
            "unit_price": pos.get("unit_price"),
            "total_price": pos.get("total_price"),
            
            # НОВОЕ: Добавить найденные нормы
            "vertex_norms": pos.get("vertex_norms", []),
            "kros_match": pos.get("enrichment", {})
        }
        positions_with_norms.append(pos_data)
    
    # Обновить промпт для Multi-Role
    question = f"""Audit construction estimate for "{project_name}".

Positions with matched norms:
{json.dumps(positions_with_norms[:10], indent=2, ensure_ascii=False)[:3000]}

For each position:
1. Compare unit_price with vertex_norms prices
2. Flag if delta > 10% (RED)
3. Check unit consistency

Respond in JSON...
"""
    
    # Дальше как обычно - Multi-Role execution
    classification = TaskClassification(...)
    result = execute_multi_role(...)
```

---

## 🔧 УСТАНОВКА

### 1. Зависимости

```bash
cd concrete-agent/packages/core-backend
pip install google-cloud-discoveryengine google-cloud-aiplatform
```

### 2. Environment Variables

```bash
# concrete-agent/.env
ENABLE_VERTEX_SEARCH=true
GOOGLE_PROJECT_ID=project-947a512a-481d-49b5-81c
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
VERTEX_SEARCH_DATASTORE_ID=your_datastore_id
```

### 3. Service Account

```bash
# Скачать JSON ключ из Google Cloud Console
# Сохранить как: concrete-agent/service-account.json
# Добавить в .gitignore
```

---

## ✅ РЕЗУЛЬТАТ

### До интеграции:
```json
{
  "code": "231112",
  "description": "Бетонирование фундамента C25/30",
  "unit_price": 2500,
  "enrichment": {
    "kros_match": "partial",
    "kros_price": 2300
  }
}
```

### После интеграции:
```json
{
  "code": "231112",
  "description": "Бетонирование фундамента C25/30",
  "unit_price": 2500,
  "enrichment": {
    "kros_match": "partial",
    "kros_price": 2300
  },
  "vertex_norms": [
    {
      "code": "ÚRS-231112",
      "title": "Betonování základů C25/30",
      "unit_price_czk": 2450,
      "confidence": 0.92
    },
    {
      "code": "OTSKP-231.112",
      "title": "Základy z betonu C25/30",
      "unit_price_czk": 2380,
      "confidence": 0.87
    }
  ],
  "audit": {
    "status": "AMBER",
    "reason": "Price 2500 CZK is 2% higher than ÚRS norm (2450 CZK)"
  }
}
```

---

## 📊 МИНИМАЛЬНЫЕ ИЗМЕНЕНИЯ

**Всего 2 места:**
1. `_enrich_positions()` - добавить 15 строк
2. `_audit_positions()` - обновить промпт

**Не трогать:**
- ✅ SmartParser (работает)
- ✅ Multi-Role (работает)
- ✅ Claude (работает)
- ✅ KROS enricher (работает)

**Добавить:**
- 🆕 Vertex AI Search (опционально, через feature flag)

---

## 🎯 FEATURE FLAG

```python
# Если ENABLE_VERTEX_SEARCH=false → работает как раньше
# Если ENABLE_VERTEX_SEARCH=true → добавляется Vertex Search

if os.getenv("ENABLE_VERTEX_SEARCH") == "true":
    # Использовать Vertex AI Search
else:
    # Только KROS enricher (текущая логика)
```

**Безопасно для production!**
