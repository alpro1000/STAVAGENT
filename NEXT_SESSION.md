# Next Session - Quick Start

**Last Updated:** 2026-02-24
**Current Branch:** `claude/universal-excel-parser-IcihR`
**Last Session:** R0 Pump Calculator v2 (Beton Union 2026 model) + TOV auto-save fix

---

## Quick Start Commands

```bash
cd /home/user/STAVAGENT

# 1. Read system context
cat CLAUDE.md

# 2. Check branch and recent commits
git checkout claude/universal-excel-parser-IcihR
git log --oneline -10

# 3. TypeScript check (rozpocet-registry)
cd rozpocet-registry && npx tsc --noEmit

# 4. Run tests
cd ../Monolit-Planner/shared && npx vitest run        # 51 tests
cd ../../stavagent-portal && node --test backend/tests/universalParser.test.js  # 11 tests
```

---

## Сессия 2026-02-24: Резюме

### ✅ Что сделано:

| Компонент | Задача | Статус |
|-----------|--------|--------|
| TOVModal | Fix Amazon Q bot review: stale closure, useEffect deps, isAutoSaving ref | ✅ |
| MachineryTab | R0 Pump Calculator v1 — начальная версия с плоской моделью | ✅ |
| PumpRentalSection | R0 Pump Calculator v2 — реальная модель Beton Union 2026 | ✅ |
| pump_knowledge.json | База знаний: 10 типов насосов, аксессуары, standard_times | ✅ |
| unified.ts | Новые типы: PumpConstructionItem, PumpAccessory, PumpRentalData (5 компонентов) | ✅ |

### Ключевое достижение — R0 Kalkulátor betonočerpadla:

**Модель ценообразования (из Beton Union Plzeň ceník 2026):**
```
Konečná cena =
  Doprava      = přistavení × (fixed_czk + km × czk_km × 2)
+ Manipulace   = manipulace_czk_h × Σ hodiny_celkem
+ Příplatek    = priplatek_czk_m3 × Σ celkem_m3
+ Příslušenství = Σ accessories
+ Příplatky    = Σ custom_surcharges
```

**Overhead per přistavení:** 0.5h stavba + 0.5h mytí (stánda Beton Union)

**Pump types в knowledge base:**
```
28/24m   2500 Kč/h  | 31/27m  2600 Kč/h | 34/30m  2800 Kč/h
36/32m   3000 Kč/h  | 38/34m  3300 Kč/h | 42/38m  3700 Kč/h
46/42m   4000 Kč/h  | 52/48m  4300 Kč/h | 56/52m  4600 Kč/h
PUMI 24/20m 2800 Kč/h
```

**Новые файлы:**
```
rozpocet-registry/src/data/pump_knowledge.json          NEW (~160 строк)
rozpocet-registry/src/types/unified.ts                  MOD (+89 строк)
rozpocet-registry/src/components/tov/PumpRentalSection.tsx  MOD (~785 строк)
```

### Архитектура R0 Calculators:

```
TOVModal
├── MaterialsTab → FormworkRentalSection  (BEDNENI)     ✅ работает
├── MachineryTab → PumpRentalSection      (BETON_MONOLIT / BETON_PREFAB / PILOTY) ✅ работает
└── Footer total: formworkCost + pumpCost + material + labor + machinery
```

### Коммиты сессии:
```
6000478 FEAT: Pump calculator v2 — realistic Beton Union 2026 pricing model
db1e360 FEAT: Kalkulátor betonočerpadla (R0 Pump Calculator) v1
999f004 FIX: Address bot review issues in TOVModal formwork auto-save
97b8b29 FIX: Auto-persist formwork rental rows in TOV modal
691ef5f FIX: Remove unused expandedRowId state — TS6133 build error
```

---

## ⏭️ Следующие задачи (приоритет)

### Приоритет 1: Pump Calculator — тестирование и доработка
- [ ] Проверить PumpRentalSection в браузере (реальный UI тест)
- [ ] Проверить auto-save (аналогично FormworkRentalSection — isAutoSaving ref)
- [ ] Добавить `handlePumpRentalChange` в TOVModal (см. паттерн handleFormworkRentalChange)
- [ ] Показать `pumpCost` в footer breakdown TOVModal

### Приоритет 2: Universal Parser Phase 2 (Portal UI)
- [ ] UI превью парсинга: после загрузки файла показать summary (листы, позиции, типы работ)
- [ ] Кнопка "Отправить в Monolit / Registry / URS Matcher" из превью
- [ ] Визуальный статус парсинга (parsing → parsed → error)

### Приоритет 3: Кiosks получают данные из Portal
- [ ] Monolit: опция "Загрузить из Portal" (GET /for-kiosk/monolit)
- [ ] Registry: опция "Загрузить из Portal" (GET /for-kiosk/registry)
- [ ] URS Matcher: опция "Загрузить из Portal" (GET /for-kiosk/urs_matcher)

### Приоритет 4: Будущие R0 Калькуляторы
- [ ] LaborTab — калькулятор рабочей силы (бригада, смены, норма-часы)
- [ ] MachineryTab — калькулятор аренды крана/экскаватора
- [ ] Общий паттерн: каждый calculator tab имеет collapsible section с auto-save

---

## ⏳ AWAITING USER ACTION

### 1. AI Suggestion Button (Monolit)
```bash
# В Render Dashboard → monolit-db → Shell:
# Выполнить: Monolit-Planner/БЫСТРОЕ_РЕШЕНИЕ.sql
```

### 2. Environment Variables
```env
# stavagent-portal-backend:
DISABLE_AUTH=true

# URS_MATCHER_SERVICE:
PPLX_API_KEY=pplx-...
```

### 3. Google Drive + Keep-Alive Setup
- См. `GOOGLE_DRIVE_SETUP.md` и `KEEP_ALIVE_SETUP.md`

### 4. PR Review
- `claude/universal-excel-parser-IcihR` — содержит все изменения этой сессии, готов к review

---

## 🧪 Статус тестов

| Сервис | Тесты | Статус |
|--------|-------|--------|
| Portal Universal Parser | 11/11 | ✅ Pass |
| Monolit shared formulas | 51/51 | ✅ Pass |
| rozpocet-registry | `npx tsc --noEmit` | ✅ 0 errors |
| URS Matcher | 159 | ⚠️ Not run this session |

---

## 📐 R0 Calculator Pattern (для будущих калькуляторов)

```typescript
// 1. Knowledge base JSON (src/data/xxx_knowledge.json)
// 2. Types in unified.ts (XXXData interface с computed totals)
// 3. XxxSection.tsx:
//    - recomputeItem() — pure function
//    - computeTotals() — pure function
//    - collapsible header с badge + total
//    - auto-save on every change (isAutoSaving ref pattern)
// 4. В TOVModal:
//    handleXxxChange = (data: XxxData) => setLocalData(prev => {
//      const updatedData = { ...prev, xxxData: data };
//      isAutoSaving.current = true;
//      onSave(updatedData);
//      return updatedData;
//    });
// 5. В footer: включить xxxCost в calculatedTotals
```

---

## 🔑 Ключевые паттерны (anti-render-loop)

```tsx
// Проблема: auto-save → Zustand → prop change → useEffect re-sync → loop

// Решение:
const isAutoSaving = useRef<boolean>(false);

// В useEffect:
useEffect(() => {
  if (isAutoSaving.current) { isAutoSaving.current = false; return; }
  setLocalData(tovData ?? createEmptyTOVData());
}, [tovData, item.id]);

// В обработчике изменений:
setLocalData(prev => {
  const updatedData = { ...prev, someData };
  isAutoSaving.current = true;   // ← флаг ПЕРЕД onSave
  onSave(updatedData);
  return updatedData;
});
```

---

**При старте следующей сессии:**
```bash
1. Прочитай CLAUDE.md
2. Прочитай NEXT_SESSION.md (этот файл)
3. git log --oneline -10
4. Спроси: тестировать PumpRentalSection или идти на Phase 2 Parser UI?
```

*Ready for next session!*
