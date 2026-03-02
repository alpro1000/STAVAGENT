# Multi-Supplier Implementation Guide

## Status: Foundation Complete ✅

**Completed:**
- ✅ `pump_suppliers.json` - 3 suppliers, 3 billing models
- ✅ `pumpCalculator.ts` - Strategy pattern service
- ✅ `concrete_prices.json` - 2 suppliers, 37 grades
- ✅ Type updates - `supplier_id`, `supplier_name` in PumpRentalData
- ✅ Patch files - Ready-to-apply code changes

**Remaining:**
- ⏳ Apply patches to PumpRentalSection.tsx
- ⏳ Apply patches to MaterialsTab.tsx
- ⏳ Test UI integration
- ⏳ Deploy to production

---

## Quick Apply

### Step 1: PumpRentalSection (Supplier Dropdown)

**File:** `src/components/tov/PumpRentalSection.tsx`

**Changes:**
1. Add import: `import { getSuppliers, getSupplier, calculateArrival, calculateOperation } from '../../services/pumpCalculator';`
2. Add state: `const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>(data.supplier_id);`
3. Replace pump type selector section with code from `PUMP_RENTAL_PATCH.txt` (lines 50-90)
4. Update `computeTotals()` function with code from `PUMP_RENTAL_PATCH.txt` (lines 30-100)

**Result:**
- Supplier dropdown before pump selector
- Pumps filtered by selected supplier
- Automatic billing model adaptation (hourly, hourly_plus_m3, per_15min)

### Step 2: MaterialsTab (Concrete Price Selector)

**File:** `src/components/tov/MaterialsTab.tsx`

**Changes:**
1. Add import: `import concretePrices from '../../data/concrete_prices.json';`
2. Add modal state (lines 10-20 from `MATERIALS_TAB_PATCH.txt`)
3. Add "Vybrat z ceníku" button after existing quick-add buttons
4. Add modal component at end (lines 100-200 from `MATERIALS_TAB_PATCH.txt`)

**Result:**
- "💰 Vybrat z ceníku" button
- Modal with supplier + grade filters
- Click to add concrete with real price

---

## Testing Checklist

### Pump Calculator
- [ ] Select Berger Sadov → see 3 pumps (PUMI, 32-36m, 38-42m)
- [ ] Select Frischbeton → see 5 pumps (24-26m, 28m, 32m, 34-36m, 38m)
- [ ] Select Beton Union → see 4 pumps (PUMI 24m, 32m, 36m, 42m)
- [ ] Add construction item → verify arrival cost calculation
- [ ] Verify operation cost uses correct billing model:
  - Berger: rate×hours + 65×m³
  - Frischbeton: ceil(hours×4)×rate_per_15min
  - Beton Union: rate×hours

### Concrete Prices
- [ ] Click "Vybrat z ceníku" → modal opens
- [ ] Select Berger Sadov → see 19 grades
- [ ] Select Frischbeton → see 18 grades
- [ ] Filter by C30/37 → see only C30/37 grades
- [ ] Filter by XF4 → see only XF4 grades
- [ ] Click grade → material added with correct price
- [ ] Verify Frischbeton C30/37 XF4 = 3,690 Kč/m³ (cheapest)

---

## Price Comparison Examples

### C30/37 XF4 (Most Common)
| Supplier | Price | Note |
|----------|-------|------|
| Frischbeton | **3,690 Kč/m³** | ✅ Cheapest |
| Berger Sadov | 3,815 Kč/m³ | +125 Kč |

### C25/30 XF3
| Supplier | Price | Note |
|----------|-------|------|
| Berger Sadov | 3,515 Kč/m³ | - |
| Frischbeton | 3,590 Kč/m³ | +75 Kč |

### Pump 32m, 15km, 4h, 45m³
| Supplier | Arrival | Operation | Total |
|----------|---------|-----------|-------|
| Frischbeton | 2,400 Kč | 8,800 Kč | **11,200 Kč** |
| Berger | 2,400 Kč | 12,925 Kč | 15,325 Kč |
| Beton Union | 4,000 Kč | 8,800 Kč | 12,800 Kč |

---

## Future Enhancements

### Phase 2: Comparison View
Add "Porovnat dodavatele" button that shows all suppliers side-by-side:
```typescript
const comparison = compareSuppliers({
  distance_km: 15,
  hours: 4,
  volume_m3: 45,
  num_arrivals: 1,
  min_reach_m: 32
});
// Shows sorted table: Frischbeton (11,200 Kč), Beton Union (12,800 Kč), Berger (15,325 Kč)
```

### Phase 3: API Integration
Replace static JSON with API calls to concrete-agent knowledge base:
```typescript
const prices = await fetch('/api/v1/knowledge-base/B3_current_prices/concrete');
// Always up-to-date prices from knowledge base
```

### Phase 4: Perplexity Fallback
For materials not in knowledge base, use AI search:
```typescript
if (!foundInKnowledgeBase) {
  const price = await searchPrice(materialName); // Uses Perplexity via concrete-agent
}
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/data/pump_suppliers.json` | Supplier data (3 suppliers) |
| `src/data/concrete_prices.json` | Concrete prices (2 suppliers, 37 grades) |
| `src/services/pumpCalculator.ts` | Calculator service with strategies |
| `src/types/unified.ts` | Updated PumpRentalData type |
| `PUMP_RENTAL_PATCH.txt` | Code changes for PumpRentalSection |
| `MATERIALS_TAB_PATCH.txt` | Code changes for MaterialsTab |
| `MULTI_SUPPLIER_PUMP_CALCULATOR.md` | Full documentation |

---

## Deployment

1. Apply patches to components
2. Test locally: `npm run dev`
3. Commit: `git commit -m "FEATURE: Multi-supplier pump + concrete prices"`
4. Push: `git push origin feature/mineru-dependencies`
5. Deploy: Vercel auto-deploys on push

**No backend changes required** - all data is static JSON.

---

**Ready to apply?** Start with Step 1 (PumpRentalSection), test, then Step 2 (MaterialsTab).
