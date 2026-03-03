# TODO: Pump Calculator Improvements

## Статус

### ✅ Готово
- Данные 3 поставщиков (Berger, Frischbeton, Beton Union)
- Сервис `pumpCalculator.ts` с функциями сравнения
- UI калькулятора с Beton Union (hardcoded)

### ❌ Не реализовано

#### 1. Multi-Supplier UI
**Файл:** `src/components/tov/PumpRentalSection.tsx`

**Что нужно:**
- Добавить dropdown "Dodavatel" перед "Typ čerpadla"
- При выборе поставщика загружать его pumps
- Использовать `compareSuppliers()` для автоматического выбора лучшей цены

**Код (минимальный):**
```tsx
import { getSuppliers, compareSuppliers } from '../../services/pumpCalculator';

// Add state
const [supplierId, setSupplierId] = useState('beton_union');

// Add dropdown
<select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
  {getSuppliers().map(s => (
    <option value={s.id}>{s.name}</option>
  ))}
</select>

// Filter pumps by supplier
const supplier = getSuppliers().find(s => s.id === supplierId);
const availablePumps = supplier?.pumps || [];
```

#### 2. Excel Export with Pump Data
**Файл:** `rozpocet-registry-backend/server.js`

**Что нужно:**
- Endpoint: `POST /api/registry/export/excel-with-pump`
- Включить pump rental data в Excel export
- Добавить лист "Betonočerpadlo" с расчетом

**Структура листа:**
```
Sheet: "Betonočerpadlo"
─────────────────────────────────────
Dodavatel: Berger Beton Sadov
Typ čerpadla: 32-36m (90 m³/h)
Vzdálenost: 15 km

Konstrukce:
  Název              | m³    | Přist. | Hodiny
  ─────────────────────────────────────────
  Základy            | 45.0  | 1      | 4.5
  
Doprava:            12,500 Kč
Manipulace:         11,250 Kč
Příslušenství:       2,000 Kč
─────────────────────────────────────
CELKEM:             25,750 Kč
```

**Backend код:**
```javascript
app.post('/api/registry/export/excel-with-pump', async (req, res) => {
  const { items, pumpRental } = req.body;
  
  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Items (existing)
  const itemsSheet = workbook.addWorksheet('Položky');
  // ... existing export logic
  
  // Sheet 2: Pump (NEW)
  if (pumpRental) {
    const pumpSheet = workbook.addWorksheet('Betonočerpadlo');
    pumpSheet.addRow(['Dodavatel:', pumpRental.pump_label]);
    pumpSheet.addRow(['Vzdálenost:', `${pumpRental.vzdalenost_km} km`]);
    pumpSheet.addRow([]);
    
    // Construction items
    pumpSheet.addRow(['Konstrukce', 'm³', 'Přistavení', 'Hodiny']);
    pumpRental.items.forEach(item => {
      pumpSheet.addRow([
        item.nazev,
        item.celkem_m3,
        item.pocet_pristaveni,
        item.hodiny_celkem.toFixed(2)
      ]);
    });
    
    pumpSheet.addRow([]);
    pumpSheet.addRow(['Doprava:', pumpRental.celkem_doprava]);
    pumpSheet.addRow(['Manipulace:', pumpRental.celkem_manipulace]);
    pumpSheet.addRow(['CELKEM:', pumpRental.konecna_cena]);
  }
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=export.xlsx');
  await workbook.xlsx.write(res);
});
```

## Приоритет

**HIGH:** Excel export (нужен для production use)  
**MEDIUM:** Multi-supplier UI (улучшение UX)

## Оценка времени

- Multi-supplier UI: ~2 hours
- Excel export: ~3 hours
- **Total:** ~5 hours

## Следующие шаги

1. Создать ветку `feature/pump-calculator-improvements`
2. Реализовать Excel export (приоритет)
3. Добавить multi-supplier UI
4. Тестировать с реальными данными
5. Merge в main

---

**Created:** 2025-01-XX  
**Status:** TODO  
**Assigned:** Next session
