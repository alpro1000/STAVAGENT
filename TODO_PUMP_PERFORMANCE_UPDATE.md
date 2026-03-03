# DONE: Pump Performance Data Update ✅

**Created:** 2025-01-XX  
**Status:** ✅ DONE  
**Time:** 2 hours  
**Branch:** `feature/unified-registry-foundation`

---

## 📋 Summary

Updated pump performance data to use realistic practical performance values (25-40 m³/h) instead of theoretical maximum (56-163 m³/h) for accurate time and cost calculations.

---

## 🎯 Problem

Current pump calculator uses theoretical maximum performance values from supplier specs:
- **Theoretical:** 56-163 m³/h (ideal conditions)
- **Practical:** 25-40 m³/h (real construction site)

**Gap:** 4-6x difference causes significant underestimation of:
- Pumping time
- Labor hours
- Total cost

**Root cause:** Height, concrete consistency, boom repositioning, equipment switching.

---

## ✅ Solution

### 1. Added `practical_performance_m3h` Field

**File:** `rozpocet-registry/src/data/pump_knowledge.json`

```json
{
  "id": "bu_28_24",
  "vykon_m3h": 90,                    // Theoretical max
  "practical_performance_m3h": 30,    // NEW: Real-world performance
  ...
}
```

**Values:**
| Pump | Theoretical | Practical | Ratio |
|------|-------------|-----------|-------|
| PUMI 24 | 56 m³/h | 25 m³/h | 0.45x |
| M28 | 90 m³/h | 30 m³/h | 0.33x |
| M31-M46 | 150-163 m³/h | 38-40 m³/h | 0.25x |
| M52-M56 | 160 m³/h | 38 m³/h | 0.24x |

### 2. Updated Calculator Logic

**File:** `rozpocet-registry/src/components/tov/PumpRentalSection.tsx`

```typescript
// Before:
vykon_m3h: pump.vykon_m3h,

// After:
const performance = pump.practical_performance_m3h || pump.vykon_m3h;
vykon_m3h: performance,
```

**Behavior:**
- Uses `practical_performance_m3h` if available
- Falls back to `vykon_m3h` for backward compatibility
- User can still override manually in "Zobrazit všechny parametry"

### 3. Added Documentation

**File:** `pump_knowledge.json` → `_meta.performance_note`

```json
"performance_note": "vykon_m3h = teoretický maximální výkon. practical_performance_m3h = reálný výkon na stavbě (25-40 m³/h) zohledňující výšku, konzistenci betonu, přestavování výložníku."
```

---

## 📊 Impact

### Example: 100 m³ concrete pour

**Before (theoretical 90 m³/h):**
```
Pumping time: 100 ÷ 90 = 1.11 hours
Total time: 1.11h + 1h overhead = 2.11 hours
Cost: 2.11h × 2500 Kč/h = 5,275 Kč
```

**After (practical 30 m³/h):**
```
Pumping time: 100 ÷ 30 = 3.33 hours
Total time: 3.33h + 1h overhead = 4.33 hours
Cost: 4.33h × 2500 Kč/h = 10,825 Kč
```

**Difference:** +2.05x more accurate cost estimation

---

## 🧪 Testing

### Manual Test:
1. Open Registry TOV
2. Add item with 100 m³ concrete
3. Open pump calculator
4. Select "28/24 m" pump
5. Verify:
   - Výkon shows 30 m³/h (not 90)
   - Pumping time: ~3.33h (not 1.11h)
   - Total cost reflects realistic hours

### Backward Compatibility:
- ✅ Old data without `practical_performance_m3h` still works
- ✅ User can override in advanced params
- ✅ No breaking changes

---

## 📁 Files Changed

### Modified:
1. `rozpocet-registry/src/data/pump_knowledge.json`
   - Added `practical_performance_m3h` to all 10 pumps
   - Added `performance_note` to `_meta`

2. `rozpocet-registry/src/components/tov/PumpRentalSection.tsx`
   - Updated `KbPump` interface
   - Modified `selectPumpType()` to use practical performance

### Documentation:
- `TODO_PUMP_PERFORMANCE_UPDATE.md` (this file)

---

## 🔜 Future Improvements

### Option 1: User Toggle
Add UI toggle to switch between theoretical and practical:
```tsx
<label>
  <input type="checkbox" checked={useTheoretical} />
  Použít teoretický výkon (ne doporučeno)
</label>
```

### Option 2: Performance Coefficient
Add adjustable coefficient (0.2-0.5) for different conditions:
```tsx
<input 
  type="range" 
  min={0.2} 
  max={0.5} 
  step={0.05}
  value={performanceCoefficient}
/>
```

### Option 3: Condition-Based Performance
Calculate performance based on:
- Height (>10m → -20%)
- Concrete type (S4 → -10%, S5 → -15%)
- Temperature (<5°C → -15%)

---

## ✅ Checklist

- [x] Added `practical_performance_m3h` to all pumps
- [x] Updated calculator to use practical performance
- [x] Added documentation in `_meta`
- [x] Tested with sample data
- [x] Backward compatible
- [x] No breaking changes

---

## 📝 Notes

### Data Source
Practical performance values based on:
- User feedback from construction sites
- Industry standards (25-40 m³/h typical)
- Technical specs from TBG Otovice and Berger Beton

### Why Not Remove Theoretical?
- Kept `vykon_m3h` for reference
- Some users may want to see max capacity
- Useful for equipment comparison

---

**Status:** ✅ DONE  
**Commit:** (to be added)  
**Branch:** feature/unified-registry-foundation  
**Next:** Merge with Unified Registry PR
