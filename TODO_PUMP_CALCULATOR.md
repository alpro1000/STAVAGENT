# DONE: Pump Calculator Improvements ✅

## Статус

### ✅ ГОТОВО (2025-01-XX)
- ✅ Данные 3 поставщиков (Berger, Frischbeton, Beton Union)
- ✅ Сервис `pumpCalculator.ts` с функциями сравнения
- ✅ Multi-supplier UI реализован
- ✅ Excel export с pump data реализован

## Что реализовано

### 1. Multi-Supplier UI ✅
**Файл:** `src/components/tov/PumpRentalSection.tsx`

**Изменения:**
- ✅ Добавлен dropdown "Dodavatel" перед "Тип čerpadla"
- ✅ При выборе поставщика загружаются его pumps
- ✅ Отображение billing model (часовая, часы + m³, 15min такты)

**Код:**
```tsx
import { getSuppliers } from '../../services/pumpCalculator';

const [supplierId, setSupplierId] = useState<string>('beton_union');
const suppliers = getSuppliers();
const selectedSupplier = suppliers.find(s => s.id === supplierId);

// Dropdown
<select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
  {suppliers.map(s => (
    <option key={s.id} value={s.id}>
      {s.name} · {s.billing_model}
    </option>
  ))}
</select>

// Pumps filtered by supplier
{selectedSupplier?.pumps.map(p => ...)}
```

### 2. Excel Export with Pump Data ✅
**Файл:** `rozpocet-registry-backend/server.js`

**Endpoint:** `POST /api/registry/export/excel-with-pump`

**Структура Excel:**
```
Sheet 1: "Položky"
  - Kód, Popis, Množství, MJ, Cena/MJ, Celkem

Sheet 2: "Betonočerpadlo" (NEW)
  - Dodavatel: {pump_label}
  - Vzdálenost: {vzdalenost_km} km
  - Výkon: {vykon_m3h} m³/h
  
  KONSTRUKCE:
    Název | m³ | Přistavení | Hodiny
    ----------------------------------------
    {items}
  
  NÁKLADY:
    Doprava: {celkem_doprava} Kč
    Manipulace: {celkem_manipulace} Kč
    Příslušenství: {celkem_prislusenstvi} Kč
    ----------------------------------------
    CELKEM: {konecna_cena} Kč
    Cena/m³: {konecna_cena / celkem_m3} Kč/m³
```

**Request:**
```json
{
  "items": [...],
  "pumpRental": {
    "pump_label": "32-36m (90 m³/h)",
    "vzdalenost_km": 15,
    "items": [...],
    "celkem_doprava": 12500,
    "celkem_manipulace": 11250,
    "konecna_cena": 25750
  },
  "projectName": "Projekt XYZ"
}
```

**Response:** Excel file download

## Приоритет

**✅ DONE:** Оба фича реализованы

## Оценка времени

- Multi-supplier UI: ~2 hours ✅
- Excel export: ~3 hours ✅
- **Total:** ~5 hours ✅

## Следующие шаги

1. ✅ Создать ветку `feature/unified-registry-foundation`
2. ✅ Реализовать Excel export (приоритет)
3. ✅ Добавить multi-supplier UI
4. ⏳ Тестировать с реальными данными
5. ⏳ Merge в main

---

**Created:** 2025-01-XX  
**Status:** ✅ DONE  
**Completed:** 2025-01-XX  
**Commit:** 72acd6e  
**Branch:** feature/unified-registry-foundation
