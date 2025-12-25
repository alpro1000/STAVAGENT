# Time Norms Automation - Design Document

**Version:** 1.0.0
**Date:** 2025-12-25
**Status:** Design Phase

---

## 📋 Executive Summary

Автоматизация расчёта норм времени (`position.days`) для строительных работ в Monolit Planner через интеграцию с Knowledge Base concrete-agent (B4_production_benchmarks, B5_tech_cards).

### Проблема
- Пользователи не знают, сколько дней указывать для разных видов работ (бетон, опалубка, арматура)
- При `days = 0` система показывает RFI (Request For Information)
- Существует feature flag `FF_AI_DAYS_SUGGEST`, но не реализован

### Решение
Использовать Multi-Role API из concrete-agent для получения норм времени из официальных источников:
- **B4_production_benchmarks** - производительность работ (~200 items)
- **B5_tech_cards** - технологические карты (~300 cards)
- **KROS/RTS** - официальные каталоги с нормами

---

## 🎯 Цель

Реализовать AI-assisted подсказки времени работ с учётом:
1. Типа работы (subtype: beton, bednění, výztuž, jiné)
2. Объёма работ (qty)
3. Размера бригады (crew_size)
4. Официальных норм времени (KROS, RTS, ČSN)

---

## 🏗️ Архитектура интеграции

```
┌─────────────────────────────────────────────────────────────┐
│                    Monolit Planner UI                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PositionRow.tsx                                    │   │
│  │                                                     │   │
│  │  [Objem: 100 m³]  [Dny: ___] [💡 AI návrh]        │   │
│  │                              ↑                      │   │
│  │                              │ onClick              │   │
│  └──────────────────────────────┼──────────────────────┘   │
└────────────────────────────────┼──────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│             Monolit Backend API                             │
│                                                             │
│  POST /api/positions/:id/suggest-days                      │
│                                                             │
│  ┌────────────────────────────────────┐                    │
│  │  timeNormsService.js               │                    │
│  │                                    │                    │
│  │  - buildContextForAI()             │                    │
│  │  - callMultiRoleAPI()              │                    │
│  │  - parseSuggestion()               │                    │
│  └────────────────────────────────────┘                    │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│          concrete-agent (CORE)                              │
│          https://concrete-agent.onrender.com                │
│                                                             │
│  POST /api/v1/multi-role/ask                               │
│                                                             │
│  ┌────────────────────────────────────┐                    │
│  │  Multi-Role Orchestrator           │                    │
│  │                                    │                    │
│  │  Roles:                            │                    │
│  │  - Standards Checker (ČSN norms)   │                    │
│  │  - Cost Estimator (KROS times)     │                    │
│  │  - Project Manager (scheduling)    │                    │
│  └────────────────────────────────────┘                    │
│                   ↓                                         │
│  ┌────────────────────────────────────┐                    │
│  │  Knowledge Base (B1-B9)            │                    │
│  │                                    │                    │
│  │  ✅ B4_production_benchmarks       │                    │
│  │     - Concrete pouring: 5-8 m³/h   │                    │
│  │     - Formwork: 2-4 m²/h           │                    │
│  │     - Reinforcement: 180-220 kg/h  │                    │
│  │                                    │                    │
│  │  ✅ B5_tech_cards                  │                    │
│  │     - Полные техкарты с нормами    │                    │
│  │                                    │                    │
│  │  ✅ B1_urs_codes (KROS/RTS)        │                    │
│  │     - Официальные нормы времени    │                    │
│  └────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Источники данных (Knowledge Base)

### 1. B4_production_benchmarks (Производительность)
**Location:** `concrete-agent/app/knowledge_base/B4_production_benchmarks/`

**Типичные нормы:**
- **Бетонирование:** 5-8 м³/час (зависит от класса бетона, высоты, сложности)
- **Опалубка сборка:** 2-4 м²/час (0.5-1.5 ч/м² per person)
- **Опалубка разборка:** 4-6 м²/час (0.5x от сборки)
- **Арматура вязка:** 180-220 кг/час

### 2. B5_tech_cards (Технологические карты)
**Location:** `concrete-agent/app/knowledge_base/B5_tech_cards/`

**Содержит:**
- Полные технологические карты с пошаговыми нормами
- Размеры бригад для разных работ
- Зависимость от условий (погода, доступность, высота)

### 3. B1_urs_codes (KROS/RTS каталоги)
**Location:** `concrete-agent/app/knowledge_base/B1_urs_codes/`

**Официальные нормы:**
- KROS - Katalog rozpočtových orientačních cen
- RTS - Rámcové technické specifikace
- Включают нормы времени для большинства строительных работ

---

## 🔧 Реализация

### Phase 1: Backend API (1-2 часа)

**Файл:** `Monolit-Planner/backend/src/services/timeNormsService.js`

```javascript
/**
 * Time Norms Service
 * Suggests work duration using concrete-agent Multi-Role API
 */

import axios from 'axios';

const CORE_API_URL = process.env.CORE_API_URL || 'https://concrete-agent.onrender.com';
const CORE_TIMEOUT = parseInt(process.env.CORE_TIMEOUT || '30000');

/**
 * Suggest days for a position using AI
 */
export async function suggestDays(position) {
  // Build context for AI
  const question = buildQuestion(position);
  const context = buildContext(position);

  try {
    // Call Multi-Role API
    const response = await axios.post(
      `${CORE_API_URL}/api/v1/multi-role/ask`,
      {
        question,
        context,
        enable_kb: true,          // Use Knowledge Base (B1-B9)
        enable_perplexity: false, // No external search needed
        use_cache: true           // Cache results for 24h
      },
      { timeout: CORE_TIMEOUT }
    );

    if (!response.data.success) {
      throw new Error('Multi-Role API failed');
    }

    // Parse AI response
    const suggestion = parseSuggestion(response.data.answer, position);

    return {
      success: true,
      suggested_days: suggestion.days,
      reasoning: suggestion.reasoning,
      confidence: response.data.confidence,
      norm_source: suggestion.source, // "KROS", "RTS", "B4_benchmarks", etc.
      crew_size_recommendation: suggestion.crew_size
    };

  } catch (error) {
    console.error('[Time Norms] Error:', error.message);

    // Fallback to empirical estimates
    const fallback = calculateFallbackDays(position);

    return {
      success: false,
      suggested_days: fallback.days,
      reasoning: 'Fallback estimate (AI unavailable)',
      confidence: 0.5,
      error: error.message
    };
  }
}

/**
 * Build question for AI
 */
function buildQuestion(position) {
  const { subtype, qty, unit, crew_size, shift_hours } = position;

  // Example questions based on subtype
  const questions = {
    'beton': `Kolik dní bude trvat betonování ${qty} ${unit} betonu s partou ${crew_size} lidí, směna ${shift_hours} hodin? Použij KROS normy.`,
    'bednění': `Kolik dní bude trvat montáž a demontáž bednění ${qty} ${unit} s partou ${crew_size} lidí? Použij RTS normy.`,
    'výztuž': `Kolik dní bude trvat vázání ${qty} ${unit} výztuže s partou ${crew_size} lidí?`,
    'jiné': `Kolik dní bude trvat práce "${position.item_name}" - ${qty} ${unit} s partou ${crew_size} lidí?`
  };

  return questions[subtype] || questions['jiné'];
}

/**
 * Build context for AI
 */
function buildContext(position) {
  return {
    project_type: 'bridge_construction',
    work_type: position.subtype,
    quantity: position.qty,
    unit: position.unit,
    crew_size: position.crew_size,
    shift_hours: position.shift_hours,
    part_name: position.part_name,
    item_name: position.item_name
  };
}

/**
 * Parse AI response to extract days suggestion
 */
function parseSuggestion(answer, position) {
  // AI answer example: "S partou 4 lidí a směnou 10 hodin bude práce trvat **8-10 dní** podle KROS normy 271354111.
  // Průměrná produktivita: 6 m³/den."

  // Extract days using regex
  const daysMatch = answer.match(/(\d+)[\s-]+(\d+)?\s*d(ní|en|ny|ays?)/i);

  let days = 0;
  let source = 'AI estimate';

  if (daysMatch) {
    // Take average if range given (e.g., "8-10 dní" → 9)
    const min = parseInt(daysMatch[1]);
    const max = daysMatch[2] ? parseInt(daysMatch[2]) : min;
    days = Math.ceil((min + max) / 2);
  }

  // Detect source
  if (answer.includes('KROS')) source = 'KROS';
  else if (answer.includes('RTS')) source = 'RTS';
  else if (answer.includes('ČSN')) source = 'ČSN';
  else if (answer.includes('B4') || answer.includes('benchmark')) source = 'B4_production_benchmarks';

  // Extract crew size recommendation (if different from current)
  const crewMatch = answer.match(/doporučen[ýá]\s+parta\s+(\d+)\s+lid/i);
  const crew_size = crewMatch ? parseInt(crewMatch[1]) : position.crew_size;

  return {
    days,
    reasoning: answer,
    source,
    crew_size
  };
}

/**
 * Fallback calculation (when AI unavailable)
 */
function calculateFallbackDays(position) {
  const { subtype, qty, crew_size, shift_hours } = position;

  // Empirical productivity rates (person-hours per unit)
  const rates = {
    'beton': 1.5,     // 1.5 ph/m³ (6 m³/h with 4 workers)
    'bednění': 0.8,   // 0.8 ph/m² (formwork assembly)
    'výztuž': 0.005,  // 0.005 ph/kg (200 kg/h with 1 worker)
    'jiné': 1.0       // Default
  };

  const rate = rates[subtype] || rates['jiné'];
  const total_ph = qty * rate;
  const days = Math.ceil(total_ph / (crew_size * shift_hours));

  return {
    days: Math.max(1, days), // Minimum 1 day
    reasoning: `Empirical estimate: ${qty} × ${rate} ph/unit ÷ (${crew_size} × ${shift_hours}) = ${days} days`
  };
}
```

### Phase 2: API Route (30 min)

**Файл:** `Monolit-Planner/backend/src/routes/positions.js`

```javascript
import { suggestDays } from '../services/timeNormsService.js';

// New endpoint: POST /api/positions/:id/suggest-days
router.post('/api/positions/:id/suggest-days', async (req, res) => {
  const { id } = req.params;

  try {
    // Get position from database
    const position = await db.prepare(
      'SELECT * FROM positions WHERE id = ?'
    ).get(id);

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // Call AI service
    const suggestion = await suggestDays(position);

    res.json(suggestion);

  } catch (error) {
    console.error('[API] Error suggesting days:', error);
    res.status(500).json({
      error: 'Failed to suggest days',
      message: error.message
    });
  }
});
```

### Phase 3: Frontend UI (1-2 часа)

**Файл:** `Monolit-Planner/frontend/src/components/PositionRow.tsx`

```typescript
import { useState } from 'react';
import { Sparkles } from 'lucide-react'; // AI icon

interface DaysSuggestion {
  suggested_days: number;
  reasoning: string;
  confidence: number;
  norm_source: string;
  crew_size_recommendation?: number;
}

function PositionRow({ position, onUpdate }) {
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<DaysSuggestion | null>(null);

  const handleSuggestDays = async () => {
    setLoadingSuggestion(true);
    setSuggestion(null);

    try {
      const response = await fetch(
        `/api/positions/${position.id}/suggest-days`,
        { method: 'POST' }
      );

      if (!response.ok) throw new Error('Failed to get suggestion');

      const data = await response.json();
      setSuggestion(data);

      // Auto-fill days field with suggestion
      if (data.success && data.suggested_days > 0) {
        onUpdate({ ...position, days: data.suggested_days });
      }

    } catch (error) {
      console.error('Error getting days suggestion:', error);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  return (
    <tr>
      {/* ... other columns ... */}

      <td>
        <div className="days-input-wrapper">
          <input
            type="number"
            value={position.days}
            onChange={(e) => onUpdate({ ...position, days: parseFloat(e.target.value) })}
          />

          {/* AI Suggestion Button */}
          <button
            className="ai-suggest-button"
            onClick={handleSuggestDays}
            disabled={loadingSuggestion}
            title="AI návrh normy času"
          >
            <Sparkles size={16} />
          </button>
        </div>

        {/* Suggestion tooltip */}
        {suggestion && (
          <div className="suggestion-tooltip">
            <strong>AI návrh: {suggestion.suggested_days} dní</strong>
            <div className="suggestion-details">
              <div>Zdroj: {suggestion.norm_source}</div>
              <div>Jistota: {Math.round(suggestion.confidence * 100)}%</div>
              {suggestion.crew_size_recommendation &&
               suggestion.crew_size_recommendation !== position.crew_size && (
                <div className="crew-recommendation">
                  💡 Doporučená parta: {suggestion.crew_size_recommendation} lidí
                </div>
              )}
            </div>
            <div className="suggestion-reasoning">
              {suggestion.reasoning}
            </div>
          </div>
        )}
      </td>

      {/* ... other columns ... */}
    </tr>
  );
}
```

### Phase 4: Feature Flag (5 min)

**Файл:** `Monolit-Planner/backend/src/db/migrations.js`

Update default feature flags:

```javascript
const defaultFeatureFlags = JSON.stringify({
  FF_AI_DAYS_SUGGEST: true,  // ✅ Enable AI days suggestion
  FF_PUMP_MODULE: false,
  FF_ADVANCED_METRICS: false,
  FF_DARK_MODE: false,
  FF_SPEED_ANALYSIS: false
});
```

---

## 🧪 Testování

### Test 1: Бетонирование
**Input:**
- Subtype: `beton`
- Qty: `100 m³`
- Crew size: `4 lidí`
- Shift: `10 hodin`

**Expected AI Response:**
```
S partou 4 lidí a směnou 10 hodin bude betonování 100 m³ trvat **5-7 dní**.

Podle KROS normy 271354111, průměrná produktivita betonáže je 6-8 m³/hod s partou 4 lidí.
```

**Parsed Suggestion:**
```json
{
  "suggested_days": 6,
  "reasoning": "...",
  "confidence": 0.92,
  "norm_source": "KROS"
}
```

### Test 2: Опалубка
**Input:**
- Subtype: `bednění`
- Qty: `150 m²`
- Crew size: `3 lidí`

**Expected:**
- Days: 8-10 (montáž + demontáž)
- Source: RTS / B5_tech_cards

### Test 3: Арматура
**Input:**
- Subtype: `výztuž`
- Qty: `5000 kg`
- Crew size: `2 lidí`

**Expected:**
- Days: 3-4
- Productivity: ~200 kg/h per worker

---

## 📈 Преимущества

1. **Точность:** Использование официальных норм KROS/RTS вместо догадок
2. **Скорость:** AI подсказка за 1-2 секунды
3. **Прозрачность:** Показывается источник данных (KROS, RTS, ČSN)
4. **Обучение:** Пользователи видят reasoning и учатся правильным нормам
5. **Кэширование:** Повторные запросы отвечают мгновенно (24h cache)
6. **Fallback:** Если AI недоступен, используются эмпирические оценки

---

## 🚀 Альтернативные подходы

### Вариант A: Локальная база норм (проще, но менее гибко)
```javascript
// timeNormsDatabase.js
export const TIME_NORMS = {
  beton: { productivity: 6, unit: 'm³/h', crew_size: 4 },
  bednění: { productivity: 3, unit: 'm²/h', crew_size: 3 },
  výztuž: { productivity: 200, unit: 'kg/h', crew_size: 2 }
};

function calculateDays(qty, norm, crew_size, shift_hours) {
  const hours_needed = qty / (norm.productivity * crew_size);
  return Math.ceil(hours_needed / shift_hours);
}
```

**Pros:** Быстро, без зависимости от concrete-agent
**Cons:** Статичные данные, нет контекста, нет официальных норм

### Вариант B: Hybrid (рекомендуется)
1. Локальная база для базовых оценок (fallback)
2. AI для сложных случаев и официальных норм
3. Кэш AI результатов в локальной БД

---

## 💾 Кэширование

**Таблица:** `time_norms_cache`

```sql
CREATE TABLE time_norms_cache (
  id VARCHAR(255) PRIMARY KEY,
  subtype VARCHAR(50) NOT NULL,
  qty REAL NOT NULL,
  unit VARCHAR(10) NOT NULL,
  crew_size INTEGER NOT NULL,
  shift_hours REAL NOT NULL,
  suggested_days REAL NOT NULL,
  norm_source VARCHAR(100),
  reasoning TEXT,
  confidence REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  INDEX idx_lookup (subtype, qty, crew_size)
);
```

**Cache key:** `${subtype}_${qty}_${unit}_${crew_size}_${shift_hours}`

**TTL:** 30 дней (нормы меняются редко)

---

## 📊 Метрики успеха

1. **Adoption Rate:** % пользователей, использующих AI suggest
2. **Acceptance Rate:** % AI предложений, принятых пользователями
3. **Accuracy:** Сравнение AI норм с фактическими результатами
4. **Speed:** Время ответа API (target: <2s)

---

## 🛣️ Roadmap

### Phase 1: MVP (4-6 часов)
- ✅ Backend service (timeNormsService.js)
- ✅ API endpoint
- ✅ Frontend button "AI náврh"
- ✅ Basic UI tooltip
- ✅ Feature flag `FF_AI_DAYS_SUGGEST`

### Phase 2: Polish (2-3 часа)
- [ ] Кэширование в БД
- [ ] Улучшенный UI (animations, icons)
- [ ] Batch suggest для всех positions
- [ ] Настройки конфиденциальности

### Phase 3: Advanced (будущее)
- [ ] Учёт погоды (зима vs лето)
- [ ] Учёт высоты работ
- [ ] Учёт сложности доступа
- [ ] Machine learning на исторических данных

---

## 🔒 Безопасность

1. **Rate Limiting:** Max 10 AI requests/min per user
2. **API Key:** concrete-agent требует валидный origin
3. **Input Validation:** Проверка qty, crew_size на разумные значения
4. **Timeout:** 30s timeout для предотвращения зависания

---

## 📚 Документация

- **Multi-Role API:** `/concrete-agent/docs/MULTI_ROLE_API.md`
- **Knowledge Base:** `/concrete-agent/docs/KB_TRAINING_GUIDE.md`
- **Feature Flags:** `/Monolit-Planner/CLAUDE.MD` (section 7.2)

---

**Автор:** Claude Code
**Дата:** 2025-12-25
**Статус:** Ready for Implementation ✅
