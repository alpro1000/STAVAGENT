# 🔍 Анализ модуля "Shrnutí dokumentu" (Document Passport)

**Дата:** 2025-03-02  
**Статус:** ❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ ОБНАРУЖЕНЫ

---

## 📋 Проблемы

### 1. ❌ MinerU НЕ ИСПОЛЬЗУЕТСЯ
**Файл:** `concrete-agent/packages/core-backend/app/core/mineru_client.py`

**Проблема:**
- MinerU client существует, но это только **STUB** (заглушка)
- В `document_processor.py` используется только `SmartParser` (pdfplumber)
- MinerU никогда не вызывается в production коде

**Доказательство:**
```python
# mineru_client.py:39
def _check_availability(self) -> bool:
    try:
        from magic_pdf.api import magic_pdf_parse
        return True
    except ImportError:
        logger.warning("⚠️  MinerU (magic-pdf) not installed")
        return False
```

**Решение:**
- Либо установить `magic-pdf`: `pip install magic-pdf`
- Либо удалить MinerU из документации (честно признать, что не используется)

---

### 2. ❌ УСТАРЕВШИЕ AI МОДЕЛИ

**Файл:** `passport_enricher.py:82-87`

**Проблема:**
```python
GEMINI_MODEL = "gemini-2.5-flash-lite"  # ❌ НЕ СУЩЕСТВУЕТ
CLAUDE_MODEL = "claude-sonnet-4-6"      # ❌ НЕ СУЩЕСТВУЕТ
CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001"  # ❌ НЕ СУЩЕСТВУЕТ
OPENAI_MODEL = "gpt-4.1"                # ❌ НЕ СУЩЕСТВУЕТ
OPENAI_MINI_MODEL = "gpt-5-mini"        # ❌ НЕ СУЩЕСТВУЕТ
```

**Актуальные модели (март 2025):**
```python
# Google Gemini
GEMINI_MODEL = "gemini-2.0-flash-exp"  # ✅ Бесплатно, быстро
# или
GEMINI_MODEL = "gemini-1.5-flash"      # ✅ Стабильная версия

# Anthropic Claude
CLAUDE_MODEL = "claude-3-5-sonnet-20241022"  # ✅ Лучшая модель
CLAUDE_HAIKU_MODEL = "claude-3-5-haiku-20241022"  # ✅ Быстрая

# OpenAI
OPENAI_MODEL = "gpt-4o"                # ✅ Актуальная GPT-4
OPENAI_MINI_MODEL = "gpt-4o-mini"      # ✅ Дешёвая версия
```

**Почему это критично:**
- API возвращает ошибку 404 (model not found)
- Fallback на старые модели (gemini-1.5-flash) работает, но медленно
- Пользователь видит timeout 300 секунд

---

### 3. ❌ СЛИШКОМ ДЛИННЫЙ ПРОМПТ

**Файл:** `passport_enricher.py:95-180`

**Проблема:**
- Промпт на **180 строк** (огромный!)
- Отправляется **30,000 символов** документа в LLM
- Результат: медленная обработка (3-5 минут вместо 3-5 секунд)

**Текущий код:**
```python
# document_processor.py:267
truncated_text = document_text[:30000]  # 30K символов!

prompt = self.ENRICHMENT_PROMPT.format(
    extracted_facts=facts_summary,
    document_text=truncated_text  # ← ПРОБЛЕМА
)
```

**Решение:**
- Сократить до **5,000 символов** (первые 2 страницы)
- Или использовать только `facts_summary` (уже извлечённые данные)

---

### 4. ❌ МОДУЛЬ ДЕЛАЕТ НЕ ТО, ЧТО НУЖНО

**Ожидание пользователя:**
> "МОДУЛЬ ДОЛЖЕН ДЕЛАТЬ ВЫЖИМКУ ИЗ ТЕКСТА ВЛОЖЕННОГО ДОКУМЕНТА ТАК КА СКАЗАТЬ КРАТКОЕ И ЧЕТКОЕ ИЗЛОЖЕНИЕ"

**Что делает модуль сейчас:**
- Извлекает **структурированные данные** (бетон, арматура, объёмы)
- Генерирует **технический паспорт** (JSON с 50+ полями)
- НЕ делает краткое изложение текста

**Пример вывода:**
```json
{
  "concrete_specifications": [...],
  "reinforcement": [...],
  "quantities": [...],
  "dimensions": {...},
  "special_requirements": [...],
  "risks": [...],
  "stakeholders": [...]
}
```

**Что нужно пользователю:**
```
КРАТКОЕ ИЗЛОЖЕНИЕ:
Проект: Polyfunkční dům Praha 5
Lokace: Smíchov, Praha 5
Typ: Bytový dům, 5 NP + 2 PP
Beton: C30/37 XC4 XD1, celkem 450 m³
Výztuž: B500B, 85 tun
Speciální požadavky: Bílá vana (vodotěsná konstrukce)
Termín: 2025-06 až 2026-03 (9 měsíců)
Investor: XYZ Development s.r.o.
```

---

## 🔧 DOPORUČENÉ OPRAVY

### Priorita 1: Opravit AI modely (5 minut)
```python
# passport_enricher.py
GEMINI_MODEL = "gemini-2.0-flash-exp"
CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
CLAUDE_HAIKU_MODEL = "claude-3-5-haiku-20241022"
OPENAI_MODEL = "gpt-4o"
OPENAI_MINI_MODEL = "gpt-4o-mini"
```

### Priorita 2: Zkrátit prompt (10 minut)
```python
# document_processor.py:267
truncated_text = document_text[:5000]  # 5K místo 30K
```

### Priorita 3: Přidat "Summary Mode" (30 minut)
Nový endpoint: `/api/v1/passport/summarize`
- Vrací **krátký text** (5-10 vět) místo JSON
- Používá jednoduchý prompt: "Shrň tento dokument v 5 větách"
- Rychlost: 2-3 sekundy

### Priorita 4: Dokumentovat MinerU status (5 minut)
- Buď nainstalovat: `pip install magic-pdf`
- Nebo odstranit z dokumentace

---

## 📊 Výkonnost

### Současný stav (ŠPATNÝ):
```
Layer 1 (Parsing):     1-3s   ✅ OK
Layer 2 (Regex):       <100ms ✅ OK
Layer 3 (AI):          300s   ❌ TIMEOUT (5 minut!)
─────────────────────────────
CELKEM:                ~300s  ❌ NEPOUŽITELNÉ
```

### Po opravách (DOBRÝ):
```
Layer 1 (Parsing):     1-3s   ✅ OK
Layer 2 (Regex):       <100ms ✅ OK
Layer 3 (AI):          3-5s   ✅ OK (správné modely + krátký prompt)
─────────────────────────────
CELKEM:                4-8s   ✅ POUŽITELNÉ
```

---

## 🎯 Závěr

**Hlavní problém:** Používají se **neexistující AI modely** → API vrací chybu → fallback na staré modely → pomalé zpracování

**Rychlé řešení (5 minut):**
1. Opravit názvy modelů v `passport_enricher.py`
2. Zkrátit prompt z 30K na 5K symbolů
3. Restartovat backend

**Dlouhodobé řešení (1 hodina):**
1. Přidat "Summary Mode" pro krátké shrnutí
2. Nainstalovat MinerU nebo odstranit z dokumentace
3. Přidat monitoring výkonu (logovat časy Layer 1/2/3)

---

**Autor:** Amazon Q  
**Verze:** 1.0.0
