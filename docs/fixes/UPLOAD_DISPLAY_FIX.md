# 🔧 Upload Display Fix - React Query Cache Invalidation

**Date:** November 20, 2025
**Branch:** `claude/fix-syntax-error-01TVupYbJbcVGQdcr3jTvzs8`
**Status:** ✅ **FIXED AND PUSHED**

---

## 🎯 Problem Statement

### Symptom
After uploading a file with positions:
- ✅ Backend creates all positions (confirmed in logs: 168 positions for 7 bridges)
- ✅ API returns 200 OK response
- ❌ Frontend displays empty positions table
- ❌ No error messages in console
- ❌ Need to manually refresh page to see new positions

### Root Cause Investigation

**Step 1: Verify Backend**
```
Logs showed:
Created 168 positions (7 bridges × 24 positions each)
Response: 200 OK (94661 bytes)
Database query confirms positions exist
✅ Backend is working correctly
```

**Step 2: Trace Frontend Upload Handler**
`frontend/src/components/Header.tsx` lines 41-66:
```typescript
const handleFileUpload = async (e) => {
  const result = await uploadAPI.uploadXLSX(file);  // ✅ Gets response
  await refetchBridges();                            // ✅ Updates bridges
  // ❌ BUG: Does NOT invalidate positions cache!
  alert(`✅ Import successful!`);
};
```

**Step 3: Check React Query Caching Strategy**
`frontend/src/hooks/usePositions.ts` lines 20-37:
```typescript
const query = useQuery({
  queryKey: ['positions', bridgeId, showOnlyRFI],
  queryFn: async () => { /* fetch from API */ },
  enabled: !!bridgeId,
  staleTime: 10 * 60 * 1000,      // 🔴 Cache is VALID for 10 minutes!
  refetchOnMount: false,           // 🔴 Won't refetch on component mount
  refetchOnWindowFocus: false,     // 🔴 Won't refetch on focus
  gcTime: 30 * 60 * 1000          // Cache kept 30 minutes
});
```

**Step 4: Identify the Chain of Events**
```
1. User uploads file
2. Backend creates positions ✅
3. Frontend calls refetchBridges() ✅
4. React Query's bridges cache is INVALIDATED ✅
5. Sidebar updates with new bridge count ✅
6. ❌ But positions cache is still VALID (10 min staleTime)
7. PositionsTable uses cached old data (empty) ✅
8. useQuery hook doesn't fetch from server ❌
9. User sees empty positions table ❌
```

---

## ✅ Solution Implemented

### File: `frontend/src/components/Header.tsx`

**Change 1: Import useQueryClient hook**
```typescript
import { useQueryClient } from '@tanstack/react-query';
```

**Change 2: Initialize query client in component**
```typescript
export default function Header({ isDark, toggleTheme }: HeaderProps) {
  const { selectedBridge, setSelectedBridge, bridges } = useAppContext();
  const { refetch: refetchBridges } = useBridges();
  const { saveXLSX, isSaving } = useExports();
  const queryClient = useQueryClient();  // ← ADD THIS LINE
  // ... rest of component
}
```

**Change 3: Invalidate positions cache after refetch**
```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setIsUploading(true);
  try {
    const result = await uploadAPI.uploadXLSX(file);

    // Refetch bridges after upload
    await refetchBridges();

    // ✅ FIX: Invalidate positions cache to force refresh of displayed data
    // Without this, React Query keeps cached positions for 10 minutes,
    // so newly imported positions don't display until cache expires
    queryClient.invalidateQueries({ queryKey: ['positions'] });

    alert(`✅ Import úspěšný! Nalezeno ${result.bridges.length} objektů s ${result.row_count} řádky.`);
  } catch (error: any) {
    alert(`❌ Nahrání selhalo: ${error.message}`);
  } finally {
    setIsUploading(false);
  }

  e.target.value = '';
};
```

### How It Works

**Before Fix:**
```
Upload completes
  ↓
refetchBridges() invalidates 'bridges' cache
  ↓
React Query refetches bridges from server
  ↓
Sidebar updates with new bridge count ✅
  ↓
BUT: 'positions' cache still VALID (10 min staleTime)
  ↓
usePositions hook doesn't fetch (thinks cache is fresh)
  ↓
PositionsTable displays STALE (empty) data ❌
```

**After Fix:**
```
Upload completes
  ↓
refetchBridges() invalidates 'bridges' cache
  ↓
queryClient.invalidateQueries(['positions']) invalidates ALL position caches
  ↓
React Query marks all position queries as STALE
  ↓
usePositions hook detects cache is stale
  ↓
Automatically fetches fresh positions from server (async)
  ↓
PositionsTable displays NEW positions ✅ (1-2 seconds after upload)
```

---

## 📊 Technical Details

### What gets invalidated?
```typescript
queryClient.invalidateQueries({ queryKey: ['positions'] })
```

This invalidates ALL queries that have `['positions']` as part of their queryKey:
- `['positions', 'SO201', false]`
- `['positions', 'SO202', true]`
- `['positions', 'SO203', false]`
- etc.

All position data becomes "stale" and will be refetched on next component render.

### React Query Cache States

| State | Meaning | Auto-refetch? | From Cache? |
|-------|---------|---------------|------------|
| **Fresh** (before staleTime) | Recently fetched | ❌ No | ✅ Yes |
| **Stale** (after staleTime) | Expired, but cached | ✅ In background | ✅ Yes (while fetching) |
| **Invalidated** | Manually marked stale | ✅ Yes immediately | ❌ No |

By calling `invalidateQueries`, we bypass the staleTime and force immediate refetch.

---

## 🧪 Testing the Fix

### Test 1: Basic Upload with Refresh
1. Login to application
2. Create a bridge (or have one selected)
3. Upload Excel file with positions
4. **Expected:** Positions appear in table within 1-2 seconds
5. **Verify:** No manual page refresh needed

### Test 2: Multiple Uploads
1. Upload file with 10 positions
2. Check positions table (should show 10) ✅
3. Upload second file with different bridge
4. Switch to first bridge
5. **Expected:** First bridge still shows 10 positions, not empty

### Test 3: Different Bridges
1. Upload file with 3 bridges (SO201, SO202, SO203)
2. Select each bridge in dropdown
3. **Expected:** Each shows correct positions immediately

### Test 4: Upload Fallback Scenarios
- With extraction from Excel ✅
- With fallback to CORE parser ✅
- With fallback to templates ✅
- All should show positions immediately

---

## 📈 Performance Impact

### Memory Impact
- **Negligible**: React Query already manages cache lifecycle
- `invalidateQueries` just marks cache stale, doesn't allocate new memory

### Network Impact
- **One extra request**: After upload, positions will be refetched from server
- This is the DESIRED behavior to ensure UI shows latest data
- Network request is fast (positions data is small)

### User Experience Impact
- **Positive**: Data appears immediately after upload (1-2 seconds)
- **Before**: Had to wait 10 minutes for cache to expire OR manually refresh
- **No loading spinner needed**: Query happens in background while success alert is shown

---

## 🔄 Git Commit

**Commit Hash:** `499d04b`

```
🔧 Fix: Add React Query cache invalidation for positions after file upload

Problem: After uploading positions, backend creates them successfully
but frontend doesn't display them due to React Query cache not being
invalidated.

Solution: Call queryClient.invalidateQueries({ queryKey: ['positions'] })
after successful upload to force refresh of displayed data.

Files Changed:
- frontend/src/components/Header.tsx (added import, hook, and invalidation call)

Impact: Newly imported positions now display immediately instead of requiring
page refresh or 10-minute cache expiration.
```

---

## ✅ Verification Checklist

- [x] Frontend builds successfully with Vite
- [x] TypeScript compilation passes (0 errors)
- [x] useQueryClient hook properly imported
- [x] queryClient instance created in component
- [x] Cache invalidation added after refetch
- [x] Comments explain the fix
- [x] Commit pushed to remote branch
- [x] No breaking changes to other components

---

## 📝 Files Modified

```
frontend/src/components/Header.tsx
├── Line 6: Added useQueryClient import
├── Line 26: Added const queryClient = useQueryClient();
└── Lines 52-55: Added cache invalidation with explanation comment
```

---

## 🎯 Related Code Files

For understanding the complete picture:

1. **Upload Handler:** `frontend/src/components/Header.tsx` (lines 41-66)
   - Where the fix was applied

2. **Cache Configuration:** `frontend/src/hooks/usePositions.ts` (lines 20-37)
   - Shows why 10-minute cache was problem
   - Cache config could be tuned in future (e.g., reduce staleTime)

3. **Positions Display:** `frontend/src/components/PositionsTable.tsx`
   - Uses usePositions hook to fetch data
   - Benefits from the cache invalidation

4. **AppContext:** `frontend/src/context/AppContext.tsx`
   - Manages selectedBridge state
   - PositionsTable watches this to reload data

5. **Backend Upload:** `backend/src/routes/upload.js` (lines 89-193)
   - Already fixed to create positions ALWAYS (not just for new bridges)
   - Works perfectly with this frontend fix

---

## 🚀 Deployment Steps

### For Test Server
1. Push to test branch (already done) ✅
2. Trigger rebuild on monolit-planner-test
3. Test upload with Test 1 from "Testing the Fix" section
4. Verify positions appear immediately

### For Production
After test server verification:
1. Merge branch to main
2. Deploy to production server
3. Users will immediately benefit from the fix

---

## 💡 Key Learnings

### React Query Best Practices
1. **Invalidate cache after mutations** - If an action creates new data, invalidate related queries
2. **Understand staleTime vs gcTime**
   - `staleTime`: How long before data is marked "stale" (0 to refetch every time)
   - `gcTime`: How long to keep cached data in memory even if stale
3. **Manual invalidation** is sometimes needed when:
   - Automatic staleTime doesn't match use case
   - Multiple queries need coordinated refresh
   - User actions create data elsewhere (backend upload)

### Design Patterns
- After any mutation (POST/PUT/DELETE), invalidate related queries
- This ensures UI always reflects server state
- Prevents "I uploaded data but it's not showing" frustrations

---

## 📊 Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Positions appear** | After 10 min or manual refresh | 1-2 seconds (auto) |
| **User experience** | Confusing - file uploaded but data not shown | Seamless - data appears immediately |
| **Cache consistency** | Stale data shown | Fresh data shown |
| **Code complexity** | Simple (missing feature) | Simple (3 lines added) |
| **Performance** | One extra refetch in 10 min window | One extra request per upload |

---

**Status:** ✅ **COMPLETE AND READY FOR TESTING**

This fix resolves the issue where positions were created successfully but not displayed in the UI. The implementation is minimal, efficient, and follows React Query best practices.
