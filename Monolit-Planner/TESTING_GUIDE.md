# Time Norms Automation - Manual Testing Guide (Windows)

## 🚀 Quick Start

### 1. Start Backend (Terminal 1)

```powershell
cd C:\Users\prokopovo\Documents\beton_agent\PROJEKT\STAVAGENT\Monolit-Planner\backend
npm run dev
```

**Expected output:**
```
[Server] Starting on port 3001...
[Database] Connected
[Server] Ready at http://localhost:3001
```

### 2. Start Frontend (Terminal 2)

```powershell
cd C:\Users\prokopovo\Documents\beton_agent\PROJEKT\STAVAGENT\Monolit-Planner\frontend
npm run dev
```

**Expected output:**
```
VITE ready in 500ms
Local: http://localhost:5173
```

### 3. Test in Browser

1. Open: http://localhost:5173
2. Login or create project
3. Find any position row
4. Look for **Sparkles button (✨)** next to "Dny" field
5. Click the button
6. Wait 2-4 seconds
7. Verify:
   - ✅ Tooltip appears with suggestion
   - ✅ Days field auto-fills
   - ✅ Shows norm source (KROS, RTS, ČSN)
   - ✅ Shows confidence percentage

---

## 🧪 API Testing (Without Frontend)

### Test 1: Create Position

```powershell
# Create test position
curl -X POST http://localhost:3001/api/positions `
  -H "Content-Type: application/json" `
  -d '{
    "bridge_id": "test-time-norms",
    "positions": [{
      "subtype": "beton",
      "qty": 100,
      "unit": "m³",
      "crew_size": 4,
      "shift_hours": 10,
      "days": 0,
      "part_name": "ZÁKLADY",
      "item_name": "Betonování"
    }]
  }'
```

**Expected:** Returns position with `id`

### Test 2: Request AI Suggestion

```powershell
# Replace {POSITION_ID} with ID from Test 1
curl -X POST http://localhost:3001/api/positions/{POSITION_ID}/suggest-days
```

**Expected response:**
```json
{
  "success": true,
  "suggested_days": 6,
  "reasoning": "S partou 4 lidí a směnou 10 hodin bude betonování 100 m³ trvat 5-7 dní podle KROS normy...",
  "confidence": 0.92,
  "norm_source": "KROS",
  "crew_size_recommendation": 4
}
```

---

## ⚠️ Troubleshooting

### Backend won't start

```powershell
# Build shared module first
cd C:\Users\prokopovo\Documents\beton_agent\PROJEKT\STAVAGENT\Monolit-Planner\shared
npm install
npm run build

# Then start backend
cd ..\backend
npm run dev
```

### Frontend won't start

```powershell
# Install dependencies
cd C:\Users\prokopovo\Documents\beton_agent\PROJEKT\STAVAGENT\Monolit-Planner\frontend
npm install
npm run dev
```

### Test script fails

```powershell
# Make sure backend is running first
# Check: http://localhost:3001/health

# Then run test
cd C:\Users\prokopovo\Documents\beton_agent\PROJEKT\STAVAGENT
node Monolit-Planner/test-time-norms.js
```

---

## ✅ Success Criteria

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Sparkles button (✨) visible in UI
- [ ] Clicking button shows loading state
- [ ] Tooltip appears with suggestion (2-4s)
- [ ] Days field auto-fills
- [ ] Tooltip shows norm source + confidence
- [ ] No console errors

---

## 📝 Notes

- **Cold Start:** First request to concrete-agent may take ~60s (Render free tier)
- **Fallback:** If AI unavailable, shows "Empirický odhad" with 50% confidence
- **Feature Flag:** Already enabled (`FF_AI_DAYS_SUGGEST: true`)

---

**Status:** Ready for Testing ✅  
**Documentation:** [TIME_NORMS_IMPLEMENTATION_STATUS.md](docs/TIME_NORMS_IMPLEMENTATION_STATUS.md)
