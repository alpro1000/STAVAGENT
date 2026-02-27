## 🎯 Summary

This PR implements two major features:
1. **Formwork Rental Calculator** in Registry TOV
2. **Improved Auto-detection** of Excel column names

---

## 📦 Features

### 1. Formwork Rental Calculator (Registry TOV)

**Backend:**
- ✅ API endpoint `/api/formwork-rental/calculate`
- ✅ DOKA pricing logic (FRAMI XLIFE, FRAMAX XLIFE, STAXO100)
- ✅ Height multipliers (0.9-1.2)
- ✅ Formula: `unit_price × area_m2 × rental_days`

**Frontend:**
- ✅ `FormworkRentalCalculator.tsx` component
- ✅ Button "🏗️ Nájem bednění" in header
- ✅ Modal with fields: area, system, height, rental days
- ✅ Result breakdown display

**Integration (Monolit ↔ Registry):**
- ✅ Updated alert in Monolit with rental parameters
- ✅ Link to Registry TOV: https://stavagent-backend-ktwx.vercel.app
- ✅ Environment variables configured

**Documentation:**
- ✅ `docs/FORMWORK_RENTAL_CALCULATOR.md` - technical docs
- ✅ `docs/FORMWORK_RENTAL_USER_GUIDE.md` - user guide
- ✅ `docs/FORMWORK_RENTAL_SUMMARY.md` - implementation summary
- ✅ Updated `README.md`

### 2. Improved Auto-detection of Excel Columns

**Enhanced pattern matching for Czech headers:**
- ✅ **Kód položky** → `kod` (recognizes: kód, kod, položky, polozky, č., číslo, p.č.)
- ✅ **Název Položky** → `popis` (recognizes: popis, název, nazev, text, položka)
- ✅ **MJ** → `mj` (recognizes: mj, jednotka, měrná, merna, unit)
- ✅ **Množství** → `mnozstvi` (recognizes: množství, mnozstvi, výměra, quantity)
- ✅ **Cena Jednotková** → `cena_jednotkova` (recognizes: jednotková, jc, cena/mj)
- ✅ **Celkem** → `cena_celkem` (recognizes: celkem, celková, suma, total)

**Also supports English:** code, description, unit, quantity, unit price, total

---

## 🔄 Workflow

### Formwork Rental Calculator:
1. **Monolit Planner:** Kalkulátor bednění → Přenést Montáž + Demontáž
2. **Alert:** Shows rental parameters (area, days, system) + Registry link
3. **Registry TOV:** Button "🏗️ Nájem bednění" → Enter params → Calculate → Add to TOV

### Auto-mapping:
1. **Upload Excel** to Registry TOV
2. **Auto-detection** scans first 5 rows for headers
3. **Automatically maps** columns based on Czech/English names
4. **User confirms** or adjusts mapping
5. **Import** with correct column mapping

---

## 📊 Example Calculation

**Input:**
- Area: 100 m²
- System: FRAMI XLIFE
- Height: 2.7m
- Days: 15

**Calculation:**
```
8.5 Kč/m²/den × 1.15 (height coef.) = 9.78 Kč/m²/den
9.78 × 100 × 15 = 14,670 Kč
```

---

## 📁 Files Changed

### Backend
- `rozpocet-registry-backend/server.js` - API endpoint

### Frontend
- `rozpocet-registry/src/components/tov/FormworkRentalCalculator.tsx` - new component
- `rozpocet-registry/src/App.tsx` - button integration
- `rozpocet-registry/src/components/import/RawExcelViewer.tsx` - improved auto-detection
- `Monolit-Planner/frontend/src/components/PositionsTable.tsx` - updated alert

### Config
- `Monolit-Planner/frontend/.env.example` - VITE_REGISTRY_URL
- `rozpocet-registry/.env.example` - VITE_REGISTRY_API_URL

### Docs
- `docs/FORMWORK_RENTAL_CALCULATOR.md`
- `docs/FORMWORK_RENTAL_USER_GUIDE.md`
- `docs/FORMWORK_RENTAL_SUMMARY.md`
- `README.md`

---

## 🧪 Testing

### Manual Testing:
1. **Monolit:** Open formwork calculator → Enter params → Transfer
2. **Alert:** Check parameters and Registry link
3. **Registry:** Click "🏗️ Nájem bednění" → Calculate → Verify result
4. **Excel Import:** Upload file with Czech headers → Verify auto-mapping

### API Testing:
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

---

## 📝 Commits

- `addce51` FEATURE: Improved auto-detection of Excel column names
- `d442cc1` DOCS: Add formwork rental calculator implementation summary
- `1e4351b` DOCS: Add formwork rental calculator documentation and user guide
- `df5dc7b` FEATURE: Formwork rental calculator in Registry TOV

---

## ✅ Checklist

- [x] Backend API endpoint implemented
- [x] Frontend component created
- [x] Integration with Monolit completed
- [x] Auto-detection improved
- [x] Documentation written
- [x] Environment variables configured
- [x] Manual testing completed
- [ ] Production deployment pending
- [ ] User acceptance testing pending

---

## 🚀 Next Steps

1. Review and approve PR
2. Merge to main
3. Deploy to production (Render + Vercel)
4. Update production environment variables
5. User acceptance testing

---

**Estimated Time:** 4-6 hours
**Actual Time:** ~2 hours
**Status:** ✅ Ready for review
