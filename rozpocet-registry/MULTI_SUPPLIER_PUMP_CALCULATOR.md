# Multi-Supplier Pump Calculator

Automatic supplier comparison and cost calculation for concrete pumps.

## Problem

Current PumpRentalSection uses hardcoded pricing from one supplier (Beton Union). Real suppliers have different billing models:

| Supplier | Billing Model | Arrival | Operation |
|----------|--------------|---------|-----------|
| Beton Union | hourly | fixed + km×rate×2 | rate×hours |
| Berger Sadov | hourly_plus_m3 | km×rate×2 | rate×hours + 65×m³ |
| Frischbeton | per_15min | one-time fixed | ceil(h×4)×rate_per_15min |

## Solution

### 1. Unified Supplier JSON
**File:** `src/data/pump_suppliers.json`

```json
{
  "suppliers": [
    {
      "id": "berger_sadov",
      "name": "Berger Beton Sadov",
      "billing_model": "hourly_plus_m3",
      "pumps": [...]
    }
  ]
}
```

### 2. Calculator Service
**File:** `src/services/pumpCalculator.ts`

**Functions:**
- `getSuppliers()` - List all suppliers
- `calculateArrival(supplier, pump, distance)` - Arrival cost by model
- `calculateOperation(supplier, pump, hours, volume)` - Operation cost by model
- `compareSuppliers(params)` - Compare all suppliers, return sorted by price

**Billing Strategies:**
```typescript
switch (supplier.billing_model) {
  case 'hourly':
    return rate × hours;
  case 'hourly_plus_m3':
    return rate × hours + volume × rate_m3;
  case 'per_15min':
    return ceil(hours × 4) × rate_per_15min;
}
```

### 3. UI Changes (Minimal)
**File:** `PumpRentalSection.tsx`

Add supplier dropdown before pump type selector:

```tsx
<select onChange={e => setSupplier(e.target.value)}>
  <option value="">— Vyberte dodavatele —</option>
  {getSuppliers().map(s => (
    <option value={s.id}>{s.name}</option>
  ))}
</select>
```

When supplier selected:
- Load pumps from `supplier.pumps`
- Use `calculateArrival()` and `calculateOperation()` in `computeTotals()`

## Concrete Prices (Materials Tab)

### Knowledge Base Files
```
concrete-agent/packages/core-backend/app/knowledge_base/B3_current_prices/
├── 01_berger_beton_sadov.json    # 18 grades, 2675-4335 Kč/m³
├── 02_frischbeton_kv.json        # 25 grades, 2295-3790 Kč/m³ (D6 offer)
├── 03_tbg_otovice_2026.json      # TBG prices
├── 04_tbg_offer_d6_2026.json     # TBG D6 specific
└── 05_berger_offer_d6_2026.json  # Berger D6 specific
```

### Price Comparison (C30/37 XF4 fco)
- Frischbeton: **3,690 Kč/m³** (cheapest)
- Berger Sadov: 3,815 Kč/m³
- Berger D6 offer: 4,277 Kč/m³ (most expensive)

### Implementation Plan

**Option A: Static JSON (Quick)**
1. Create `src/data/concrete_prices.json` from knowledge base files
2. Add "Vybrat z ceníku" button in MaterialsTab
3. Modal with supplier + grade filters
4. User selects → price auto-filled

**Option B: API Integration (Future)**
1. Endpoint: `GET /api/v1/knowledge-base/B3_current_prices/concrete`
2. Returns all suppliers with current prices
3. Frontend caches for session
4. Perplexity fallback for missing grades

## Mathematical Model

From `00_pump_calculator_schema.json`:

```
TotalCost = Σ(Steps 1-10)

Step 1: Concrete = lookup(supplier, class, env, Dmax, cons) × volume
Step 2: Transport = transport_fn(supplier)(distance, volume)
Step 3: PumpArrival = arrival_fn(supplier)(distance, pump)
Step 4: PumpOperation = operation_fn(supplier)(hours, volume, pump)
Step 5: Hoses = length × price × days
Step 6: TimeSurcharges = surcharge_fn(supplier)(base, day_type, night)
Step 7: WinterSurcharge = is_winter ? volume × rate : 0
Step 8: OneTimeItems = Σ fixed_items
Step 9: Total = Σ(1-8)
Step 10: TotalVAT = Total × 1.21
```

## Usage Example

```typescript
import { compareSuppliers } from './services/pumpCalculator';

const results = compareSuppliers({
  distance_km: 15,
  hours: 4.5,
  volume_m3: 45,
  num_arrivals: 1,
  min_reach_m: 32
});

// Results sorted by total cost:
// [
//   { supplier: Frischbeton, pump: 32m, cost: { total: 12500 } },
//   { supplier: Berger, pump: 32-36m, cost: { total: 13200 } },
//   { supplier: Beton Union, pump: 32m, cost: { total: 14000 } }
// ]
```

## Next Steps

1. ✅ Create `pump_suppliers.json`
2. ✅ Create `pumpCalculator.ts` service
3. ⏳ Add supplier dropdown to PumpRentalSection
4. ⏳ Adapt `computeTotals()` to use calculator service
5. ⏳ Create `concrete_prices.json` from knowledge base
6. ⏳ Add "Vybrat z ceníku" modal to MaterialsTab

## Files

- `src/data/pump_suppliers.json` - Unified supplier data
- `src/services/pumpCalculator.ts` - Calculator service
- `src/components/tov/PumpRentalSection.tsx` - UI (to be updated)
- `src/components/tov/MaterialsTab.tsx` - Materials (to be updated)
- `docs/MULTI_SUPPLIER_PUMP_CALCULATOR.md` - This file
