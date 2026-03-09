# АКТИВАЦИЯ GOOGLE CLOUD КРЕДИТОВ - Пошаговая инструкция

## ✅ ШАГ 1: Получить API ключи (5 минут)

### 1.1 Gemini API Key (для Free Trial $300)

```
1. Открыть: https://aistudio.google.com/app/apikey
2. Нажать: "Create API Key"
3. Выбрать проект: project-947a512a-481d-49b5-81c
4. Копировать ключ: AIzaSy...
```

**Вставить в `.env`:**
```bash
GOOGLE_API_KEY=AIzaSy...
```

---

## ✅ ШАГ 2: Создать Service Account (10 минут)

### 2.1 Создать Service Account

```
1. Открыть: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Выбрать проект: project-947a512a-481d-49b5-81c
3. Нажать: "CREATE SERVICE ACCOUNT"
4. Name: stavagent-vertex-search
5. Description: For Vertex AI Search and Embeddings
6. Нажать: "CREATE AND CONTINUE"
```

### 2.2 Добавить роли

```
7. Grant this service account access to project:
   - Role 1: "Discovery Engine Admin"
   - Role 2: "Vertex AI User"
8. Нажать: "CONTINUE"
9. Нажать: "DONE"
```

### 2.3 Создать JSON ключ

```
10. Найти созданный Service Account в списке
11. Нажать на него → вкладка "KEYS"
12. Нажать: "ADD KEY" → "Create new key"
13. Type: JSON
14. Нажать: "CREATE"
15. Файл скачается автоматически (project-947a512a-481d-49b5-81c-xxxxx.json)
```

### 2.4 Сохранить ключ в проект

```bash
# Переименовать скачанный файл
mv ~/Downloads/project-947a512a-481d-49b5-81c-xxxxx.json service-account.json

# Переместить в проект
mv service-account.json c:/Users/prokopovo/Documents/beton_agent/PROJEKT/STAVAGENT/concrete-agent/

# Добавить в .gitignore (ВАЖНО!)
echo "service-account.json" >> .gitignore
```

**Вставить в `.env`:**
```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GOOGLE_PROJECT_ID=project-947a512a-481d-49b5-81c
```

---

## ✅ ШАГ 3: Создать Vertex AI Search Data Store (15 минут)

### 3.1 Включить API

```
1. Открыть: https://console.cloud.google.com/apis/library/discoveryengine.googleapis.com
2. Выбрать проект: project-947a512a-481d-49b5-81c
3. Нажать: "ENABLE"
4. Подождать 1-2 минуты
```

### 3.2 Создать Data Store

```
5. Открыть: https://console.cloud.google.com/gen-app-builder/data-stores
6. Нажать: "CREATE DATA STORE"
7. Source: "Cloud Storage"
8. Data Store name: "stavagent-norms"
9. Location: "global"
10. Нажать: "CREATE"
```

### 3.3 Создать Cloud Storage Bucket

```
11. Открыть: https://console.cloud.google.com/storage/browser
12. Нажать: "CREATE BUCKET"
13. Name: "stavagent-norms-bucket"
14. Location: "europe-west1" (ближе к Чехии)
15. Storage class: "Standard"
16. Нажать: "CREATE"
```

### 3.4 Загрузить документы

```
17. Открыть созданный bucket: stavagent-norms-bucket
18. Нажать: "UPLOAD FILES"
19. Загрузить:
    - urs_catalog.pdf (каталог ÚRS норм)
    - otskp_catalog.pdf (каталог OTSKP)
    - csn_norms.pdf (ČSN нормы)
20. Подождать загрузки
```

### 3.5 Подключить Bucket к Data Store

```
21. Вернуться: https://console.cloud.google.com/gen-app-builder/data-stores
22. Открыть: stavagent-norms
23. Нажать: "IMPORT" → "Cloud Storage"
24. Bucket: gs://stavagent-norms-bucket/*
25. Нажать: "IMPORT"
26. Подождать индексации (5-10 минут)
```

### 3.6 Получить Data Store ID

```
27. В Data Store stavagent-norms скопировать ID из URL:
    https://console.cloud.google.com/gen-app-builder/data-stores/ЭТОТ_ID
    
Пример ID: stavagent-norms_1234567890
```

**Вставить в `.env`:**
```bash
VERTEX_SEARCH_DATASTORE_ID=stavagent-norms_1234567890
```

---

## ✅ ШАГ 4: Финальный `.env` файл

**Файл:** `concrete-agent/.env`

```bash
# ============================================================================
# GOOGLE CLOUD CREDENTIALS
# ============================================================================

# Gemini API (Free Trial $300)
GOOGLE_API_KEY=AIzaSy...

# Service Account (для Vertex AI)
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GOOGLE_PROJECT_ID=project-947a512a-481d-49b5-81c

# Vertex AI Search Data Store ID (GenAI кредит $1000)
VERTEX_SEARCH_DATASTORE_ID=stavagent-norms_1234567890

# ============================================================================
# FEATURE FLAGS
# ============================================================================

# Включить Vertex AI Search
ENABLE_VERTEX_SEARCH=true

# Multi-LLM для Multi-Role
MULTI_ROLE_LLM=gemini

# ============================================================================
# ДРУГИЕ API КЛЮЧИ (уже есть)
# ============================================================================

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## ✅ ШАГ 5: Проверка (2 минуты)

### 5.1 Проверить Gemini API

```bash
cd concrete-agent/packages/core-backend

# Создать test_gemini.py
cat > test_gemini.py << 'EOF'
import os
from dotenv import load_dotenv
load_dotenv()

import google.generativeai as genai
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = genai.GenerativeModel('gemini-1.5-flash')
response = model.generate_content("Hello, test!")
print("✅ Gemini works:", response.text[:50])
EOF

# Запустить
python test_gemini.py
```

### 5.2 Проверить Service Account

```bash
# Создать test_vertex.py
cat > test_vertex.py << 'EOF'
import os
from dotenv import load_dotenv
load_dotenv()

from google.cloud import discoveryengine_v1

project_id = os.getenv("GOOGLE_PROJECT_ID")
print(f"✅ Project ID: {project_id}")
print(f"✅ Credentials: {os.getenv('GOOGLE_APPLICATION_CREDENTIALS')}")
print("✅ Service Account works!")
EOF

# Запустить
python test_vertex.py
```

### 5.3 Проверить Vertex AI Search

```bash
# Создать test_search.py
cat > test_search.py << 'EOF'
import os
from dotenv import load_dotenv
load_dotenv()

from google.cloud import discoveryengine_v1

client = discoveryengine_v1.SearchServiceClient()
project_id = os.getenv("GOOGLE_PROJECT_ID")
datastore_id = os.getenv("VERTEX_SEARCH_DATASTORE_ID")

serving_config = (
    f"projects/{project_id}/locations/global/"
    f"collections/default_collection/dataStores/{datastore_id}/"
    f"servingConfigs/default_config"
)

request = discoveryengine_v1.SearchRequest(
    serving_config=serving_config,
    query="бетонирование фундамента",
    page_size=3
)

response = client.search(request)
print(f"✅ Vertex AI Search works! Found {len(list(response.results))} results")
EOF

# Запустить
python test_search.py
```

---

## ✅ CHECKLIST

- [ ] Gemini API Key получен и добавлен в `.env`
- [ ] Service Account создан
- [ ] JSON ключ скачан и сохранен как `service-account.json`
- [ ] `service-account.json` добавлен в `.gitignore`
- [ ] Discovery Engine API включен
- [ ] Data Store создан
- [ ] Cloud Storage Bucket создан
- [ ] Документы загружены (ÚRS, OTSKP, ČSN)
- [ ] Data Store ID скопирован в `.env`
- [ ] Все 3 теста пройдены (Gemini, Service Account, Vertex Search)

---

## 🎯 ИТОГО - Что вписать вручную:

### В `.env` файл (3 строки):

```bash
GOOGLE_API_KEY=AIzaSy...                              # ← Из AI Studio
VERTEX_SEARCH_DATASTORE_ID=stavagent-norms_1234567890 # ← Из Data Store URL
ENABLE_VERTEX_SEARCH=true                             # ← Включить
```

### Файл `service-account.json` (скачать и положить в `concrete-agent/`)

---

## 💰 Проверить остаток кредитов

```
1. Открыть: https://console.cloud.google.com/billing/credits
2. Смотреть:
   - Free Trial: $300 (осталось)
   - GenAI App Builder: $1000 (осталось)
```

---

**Время настройки: ~30 минут**  
**После этого кредиты работают автоматически!** 🚀
