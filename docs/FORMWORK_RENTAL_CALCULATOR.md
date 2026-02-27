# Formwork Rental Calculator - Registry TOV Integration

## Overview

Калькулятор аренды бедения в Registry TOV позволяет рассчитать стоимость аренды бедения на основе параметров из Monolit Planner.

## Architecture Decision

**Monolit Planner** = LABOR ONLY (Montáž + Demontáž)
**Registry TOV** = RENTAL (Nájem od dodavatele DOKA/Peri)

Это разделение позволяет:
- Отделить трудозатраты от внешних услуг
- Использовать разные источники данных (KROS/RTS для труда, прайс-листы DOKA для аренды)
- Упростить учёт и отчётность

## Workflow

### 1. Monolit Planner - Расчёт труда

Пользователь открывает "Kalkulátor bednění" в Monolit Planner:
1. Вводит параметры (площадь, система, такты)
2. Калькулятор рассчитывает дни монтажа и демонтажа
3. Нажимает "Přenést Montáž + Demontáž"
4. Создаются 2 позиции в текущей части:
   - `Bednění + {name} - Montáž` (subtype: 'bednění', unit: 'm2')
   - `Bednění + {name} - Demontáž` (subtype: 'bednění', unit: 'm2')

### 2. Alert с параметрами для Registry TOV

После переноса показывается alert:
```
✅ Přeneseno 2 řádků (Montáž + Demontáž) do části "..."

💡 NÁJEM BEDNĚNÍ - přidejte do Registry TOV:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Parametry pro kalkulátor:
   • Plocha: 100.0 m²
   • Termín nájmu: 15 dní
   • Systém: FRAMI XLIFE

🔗 Otevřete Registry TOV:
   https://stavagent-backend-ktwx.vercel.app

   Klikněte na "🏗️ Nájem bednění" → zadejte parametry → přidejte do TOV
```

### 3. Registry TOV - Расчёт аренды

Пользователь открывает Registry TOV:
1. Нажимает кнопку "🏗️ Nájem bednění" в header
2. Вводит параметры из alert:
   - Plocha (m²)
   - Systém bednění (FRAMI XLIFE, FRAMAX XLIFE, STAXO100)
   - Výška (m)
   - Dny nájmu
3. Нажимает "Vypočítat"
4. Видит результат:
   - Cena za m²/den
   - Denní náklady
   - Celkem nájem
5. Нажимает "Přidat do Registry TOV"

## API Endpoint

### POST /api/formwork-rental/calculate

**Request:**
```json
{
  "area_m2": 100,
  "system": "FRAMI XLIFE",
  "height": 2.7,
  "rental_days": 15
}
```

**Response:**
```json
{
  "success": true,
  "calculation": {
    "area_m2": 100,
    "system": "FRAMI XLIFE",
    "height": 2.7,
    "rental_days": 15,
    "unit_price_czk_m2_day": 9.78,
    "total_rental_czk": 14670,
    "breakdown": {
      "base_price": 8.5,
      "height_multiplier": 1.15,
      "daily_cost": 978
    }
  }
}
```

## Pricing Logic

### Base Prices (Kč/m²/den)

```javascript
const FORMWORK_PRICES = {
  'FRAMI XLIFE': { 
    base: 8.5, 
    heights: { 1.2: 0.9, 1.5: 1.0, 2.4: 1.1, 2.7: 1.15, 3.0: 1.2 } 
  },
  'FRAMAX XLIFE': { 
    base: 9.0, 
    heights: { 1.5: 1.0, 2.4: 1.1, 2.7: 1.15, 3.0: 1.2 } 
  },
  'STAXO100': { 
    base: 12.0, 
    heights: { 2.7: 1.0, 3.0: 1.1 } 
  }
};
```

### Calculation Formula

```
unit_price = base_price × height_multiplier
daily_cost = unit_price × area_m2
total_rental = daily_cost × rental_days
```

### Example

```
System: FRAMI XLIFE
Height: 2.7m
Area: 100 m²
Days: 15

unit_price = 8.5 × 1.15 = 9.78 Kč/m²/den
daily_cost = 9.78 × 100 = 978 Kč/den
total_rental = 978 × 15 = 14,670 Kč
```

## Rental Days Calculation

Rental days = max(Výztuž days, Betonování days, Zrání days, Montáž days, Demontáž days)

Это максимальное значение из всех работ, так как бедение должно быть на стройке весь период.

## Data Source

Цены взяты из прайс-листа DOKA:
- `concrete-agent/packages/core-backend/app/knowledge_base/B3_current_prices/cennik_doka_extracted_content_markdown.txt`

## Environment Variables

### Monolit-Planner Frontend
```bash
VITE_REGISTRY_URL=https://stavagent-backend-ktwx.vercel.app
```

### Registry Frontend
```bash
VITE_REGISTRY_API_URL=http://localhost:3002  # Development
VITE_REGISTRY_API_URL=https://rozpocet-registry-backend.onrender.com  # Production
```

## Files Modified

### Backend
- `rozpocet-registry-backend/server.js` - Added `/api/formwork-rental/calculate` endpoint

### Frontend
- `rozpocet-registry/src/components/tov/FormworkRentalCalculator.tsx` - New calculator component
- `rozpocet-registry/src/App.tsx` - Added button and modal integration
- `Monolit-Planner/frontend/src/components/PositionsTable.tsx` - Updated alert with Registry link

### Configuration
- `Monolit-Planner/frontend/.env.example` - Added VITE_REGISTRY_URL
- `rozpocet-registry/.env.example` - Added VITE_REGISTRY_API_URL

## Testing

### Manual Testing

1. **Monolit Planner:**
   ```bash
   cd Monolit-Planner/frontend
   npm run dev
   ```
   - Open formwork calculator
   - Enter parameters
   - Transfer to positions
   - Check alert message

2. **Registry TOV:**
   ```bash
   cd rozpocet-registry-backend
   npm run dev  # Port 3002
   
   cd ../rozpocet-registry
   npm run dev  # Port 5173
   ```
   - Click "🏗️ Nájem bednění"
   - Enter parameters from Monolit alert
   - Calculate rental cost
   - Verify calculation

### API Testing

```bash
curl -X POST http://localhost:3002/api/formwork-rental/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "area_m2": 100,
    "system": "FRAMI XLIFE",
    "height": 2.7,
    "rental_days": 15
  }'
```

## Future Improvements

1. **Auto-fill from Monolit:**
   - Pass parameters via URL query params
   - Auto-populate calculator fields

2. **Price Updates:**
   - Admin panel for price management
   - Import from DOKA Excel files
   - Version control for prices

3. **Integration:**
   - Direct API call from Monolit to Registry
   - Auto-create TOV item without manual input

4. **Reporting:**
   - Export rental calculations to Excel
   - Compare rental costs across projects

## Version

- **Created:** 2025-01-XX
- **Status:** ✅ Implemented
- **Estimated Time:** 4-6 hours
- **Actual Time:** ~2 hours

---

**Next Steps:**
1. Test in development environment
2. Deploy to production (Render + Vercel)
3. Update production environment variables
4. User acceptance testing
