# SESSION 2026-02-24 — R0 Pump Calculator + TOV Auto-Save Fix

**Date:** 2026-02-24
**Branch:** `claude/universal-excel-parser-IcihR`
**Service:** `rozpocet-registry`

---

## Цель сессии

1. Исправить замечания Amazon Q Developer Bot в PR (3 issues в TOVModal)
2. Разработать R0 Калькулятор бетононасоса в MachineryTab TOV-модала
3. Переработать калькулятор на основе реального прайс-листа Beton Union Plzeň 2026

---

## Коммиты сессии

| Хэш | Сообщение |
|-----|-----------|
| `97b8b29` | FIX: Auto-persist formwork rental rows in TOV modal |
| `691ef5f` | FIX: Remove unused expandedRowId state — TS6133 build error |
| `b7ed7d4` | FEAT: Task A — DOKA/PERI formwork knowledge base (JSON) |
| `9b0deda` | FEAT: Task C — Stavba hierarchy in Portal (group SO objects by stavba_name) |
| `783868d` | FEAT: Task B — Formwork rental in TOV + KROS fields + TOV export breakdown |
| `999f004` | FIX: Address bot review issues in TOVModal formwork auto-save |
| `db1e360` | FEAT: Kalkulátor betonočerpadla (R0 Pump Calculator) — v1 initial |
| `6000478` | FEAT: Pump calculator v2 — realistic Beton Union 2026 pricing model |

---

## Задача 1: Fix Amazon Q Developer Bot review (TOVModal)

### Проблемы которые поднял бот:

**Issue 1 — Race condition (stale closure):**
```tsx
// БЫЛО (stale closure):
const updatedData = { ...localData, formworkRental };

// СТАЛО (functional update):
setLocalData(prev => {
  const updatedData = { ...prev, formworkRental };
  isAutoSaving.current = true;
  onSave(updatedData);
  return updatedData;
});
```

**Issue 2 — useEffect dep array:**
```tsx
// БЫЛО: [item.id] — stale tovData при смене item
useEffect(() => { ... }, [item.id]);

// СТАЛО: restored [tovData, item.id] с guard:
useEffect(() => {
  if (isAutoSaving.current) { isAutoSaving.current = false; return; }
  setLocalData(tovData ?? createEmptyTOVData());
}, [tovData, item.id]);
```

**Issue 3 — isAutoSaving ref:**
```tsx
const isAutoSaving = useRef<boolean>(false);
```
Защищает от render-loop: auto-save → Zustand update → prop change → useEffect re-sync → бесконечный цикл.

---

## Задача 2: R0 Калькулятор бетононасоса — v1

Первая версия с упрощённой моделью. Определена архитектура:

- **MachineryTab** — место для калькулятора насоса (для BETON_MONOLIT / BETON_PREFAB / PILOTY)
- **MaterialsTab** — место для калькулятора опалубки (для BEDNENI) — уже работает

Структура `PumpRentalData` v1:
```typescript
doprava_czk_pristaveni: number  // flat rate per přistavení
cerpani_czk_m3: number          // flat rate per m³
min_objem_m3: number            // minimum order
```

---

## Задача 3: Анализ прайс-листа Beton Union Plzeň 2026

Пользователь предоставил 4-5 фото из реального ceníku Beton Union.

### Реальная модель ценообразования:

| Компонент | Формула |
|-----------|---------|
| Doprava | `přistavení × (fixed + km × Kč/km × 2)` |
| Manipulace | `Kč/h × (Σ hodiny_čerpání + počet_přistavení × overhead)` |
| Příplatek m³ | `Kč/m³ × Σ celkem_m3` |
| Příslušenství | `Σ accessories (ks/m/m³)` |
| Příplatky | `Σ custom surcharges × přistavení` |

**Стандарт Beton Union:** 0.5h stavba + 0.5h mytí overhead per přistavení

### Типы насосов (из ceníku):

| Тип | Манипулация Kč/h | Příplatek Kč/m³ | Přistavení Kč | Kč/km |
|-----|-----------------|-----------------|---------------|-------|
| 28/24m | 2 500 | 0 | 1 900 | 32 |
| 31/27m | 2 600 | 0 | 2 100 | 34 |
| 34/30m | 2 800 | 0 | 2 300 | 36 |
| 36/32m | 3 000 | 0 | 2 500 | 40 |
| 38/34m | 3 300 | 20 | 2 800 | 44 |
| 42/38m | 3 700 | 40 | 3 200 | 48 |
| 46/42m | 4 000 | 50 | 3 500 | 52 |
| 52/48m | 4 300 | 55 | 3 800 | 56 |
| 56/52m | 4 600 | 60 | 4 200 | 60 |
| PUMI 24/20m | 2 800 | 20 | 2 200 | 40 |

### Příslušenství:
- Gumová hadice: 120 Kč/m
- Ocelové potrubí: 100 Kč/m
- Drátkobetonová tryska: 50 Kč/m³
- Nájezd přísadou: 500 Kč/ks
- Marný výjezd: 2 999 Kč/ks

---

## Задача 4: Pump Calculator v2 — Redesign

### Новые файлы:

**1. `src/data/pump_knowledge.json` (NEW ~160 строк)**
- Source of truth для параметров насосов (зеркало `formwork_knowledge.json`)
- 10 типов насосов с полными параметрами
- `accessories.items` — каталог аксессуаров для quick-add
- `standard_times` — стандартные overhead времена
- `surcharge_hints` — датлист для autocomplete

**2. `src/types/unified.ts` (обновлён)**

Новые типы:
```typescript
interface PumpConstructionItem {
  id, nazev, objem_m3_takt, pocet_taktu, pocet_pristaveni,
  // computed:
  celkem_m3, hodiny_cerpani, hodiny_overhead, hodiny_celkem
}

interface PumpAccessory {
  id, nazev, mnozstvi, unit, czk_per_unit, celkem
}

interface PumpRentalData {
  pump_type_id, pump_label,
  manipulace_czk_h, priplatek_czk_m3, pristaveni_fixed_czk,
  czk_km, vykon_m3h, vzdalenost_km, stavba_h, myti_h,
  items[], accessories[], surcharges[], kros_kod,
  // computed totals:
  celkem_m3, celkem_pristaveni, celkem_hodiny,
  celkem_doprava, celkem_manipulace, celkem_priplatek_m3,
  celkem_prislusenstvi, celkem_priplatky, konecna_cena
}
```

`TOVData.pumpRental?: PumpRentalData` добавлен.

**3. `src/components/tov/PumpRentalSection.tsx` (полный переписывание ~785 строк)**

Секции интерфейса:
1. Dropdown выбора типа насоса (auto-fill всех параметров)
2. Vzdálenost km + вычисляемые doprava per přistavení
3. Collapsible панель расширенных параметров
4. Таблица конструктивных элементов с вычисляемыми часами
5. Příslušenství с KB quick-add кнопками
6. Custom příplatky
7. KROS kod
8. Разбивка стоимости (5 строк + итог)

Pure функции без side effects:
- `recomputeItem(item, vykon)` — пересчёт часов для одной позиции
- `computeTotals(draft, vzdalenost)` — пересчёт всех 5 компонентов + итог

---

## Архитектура R0 Calculators (общая схема)

```
TOVModal
├── MaterialsTab
│   └── FormworkRentalSection    ← R0 Kalkulátor opálubky (BEDNENI)
├── MachineryTab
│   └── PumpRentalSection        ← R0 Kalkulátor betonočerpadla (BETON_MONOLIT/PREFAB/PILOTY)
├── LaborTab                     ← (будущий: калькулятор рабочей силы)
└── Footer: calculated totals включает formworkCost + pumpCost
```

---

## Изменённые файлы

```
rozpocet-registry/src/data/pump_knowledge.json          NEW  ~160 строк
rozpocet-registry/src/types/unified.ts                  MOD  +89 строк
rozpocet-registry/src/components/tov/PumpRentalSection.tsx MOD ~785 строк (полный переписывание)
rozpocet-registry/src/components/tov/TOVModal.tsx        MOD  handlePumpRentalChange, pumpCost в footer
rozpocet-registry/src/components/tov/MachineryTab.tsx    MOD  PUMP_SKUPINY, showPumpCalc condition
rozpocet-registry/src/components/tov/index.ts            MOD  export PumpRentalSection
```

---

## TypeScript: 0 ошибок

```bash
cd rozpocet-registry && npx tsc --noEmit  # ✅ Clean
```

---

*Session archived: 2026-02-24*
