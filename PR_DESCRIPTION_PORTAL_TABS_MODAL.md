# FEATURE: Portal Tabs + Modal Redesign - Design System UI Improvements

## 📋 Summary
Redesigns Portal UI with tabs for better content organization and updates Create Project modal to use the design system (Digital Concrete / Brutalist Neumorphism).

## 🎯 Problem
1. **Modal inconsistency**: Create Project modal used Tailwind CSS classes instead of design system (c-btn, c-panel, c-input)
2. **Content overload**: Services and Projects displayed on same page causing visual clutter
3. **Scalability**: With many projects, page becomes too long and hard to navigate

## ✅ Solution

### 1. Tabs for Content Separation
**File:** `PortalPage.tsx`

Added two tabs to separate content:
- **📊 Služby** - Shows available services (12 kiosks) + Poradna Widget
- **📁 Projekty (N)** - Shows project statistics + project list with count badge

**Features:**
- Active tab highlighted with orange underline (var(--brand-orange))
- Smooth transitions (0.2s)
- Project count badge in tab label
- Clean visual separation with border-bottom

### 2. Modal Redesign to Design System
**File:** `CreateProjectModal.tsx`

Converted from Tailwind CSS to design system:

**Before:**
```tsx
<div className="fixed inset-0 bg-gray-500 bg-opacity-75">
  <div className="bg-white rounded-lg shadow-xl">
    <input className="mt-1 block w-full border border-gray-300..." />
    <button className="flex-1 px-4 py-2 border border-transparent...">
```

**After:**
```tsx
<div style={{ position: 'fixed', background: 'rgba(0, 0, 0, 0.7)' }}>
  <div className="c-panel">
    <input className="c-input" />
    <button className="c-btn c-btn--primary">
```

**Design System Classes Used:**
- `c-panel` - Modal container with neumorphic styling
- `c-btn c-btn--primary` - Primary action button (orange)
- `c-btn c-btn--secondary` - Secondary action button (gray)
- `c-btn c-btn--ghost` - Close button (transparent)
- `c-input` - Form input fields
- CSS variables: `var(--brand-orange)`, `var(--text-primary)`, `var(--text-secondary)`

**Czech Localization:**
- "Create New Project" → "Nový projekt"
- "Project Name *" → "Název projektu *"
- "Cancel" → "Zrušit"
- "Create Project" → "Vytvořit"
- "Creating..." → "Vytváření..."

## 📊 Impact

### Before:
```
❌ Modal: Tailwind CSS (inconsistent with design system)
❌ Layout: All content on one page (services + stats + projects)
❌ Navigation: Scroll through everything to find projects
❌ Scalability: Page becomes very long with many projects
```

### After:
```
✅ Modal: Design system (c-panel, c-btn, c-input)
✅ Layout: Tabbed interface (Služby | Projekty)
✅ Navigation: Click tab to switch between sections
✅ Scalability: Each tab shows only relevant content
✅ UX: Project count visible in tab badge
```

## 📁 Files Changed

### Modified:
1. **stavagent-portal/frontend/src/components/portal/CreateProjectModal.tsx** (+150, -60)
   - Replaced all Tailwind classes with design system classes
   - Added backdrop click-to-close functionality
   - Czech localization for all labels
   - Simplified project type descriptions (removed English descriptions)

2. **stavagent-portal/frontend/src/pages/PortalPage.tsx** (+258, -1)
   - Added `activeTab` state ('services' | 'projects')
   - Created tab navigation UI with orange active indicator
   - Wrapped Services section in `{activeTab === 'services' && ...}`
   - Wrapped Stats + Projects sections in `{activeTab === 'projects' && ...}`
   - Project count badge in Projekty tab

### Added:
3. **PORTAL_TABS_MODAL_PATCH.txt**
   - Complete patch file with all changes documented
   - Testing instructions
   - Before/after comparisons

## 🧪 Testing

### Test 1: Modal Redesign
1. Click "Nový projekt" button in header
2. **Expected:** Modal opens with design system styling (c-panel, orange buttons)
3. Fill in form fields
4. **Expected:** c-input styling applied to all fields
5. Click backdrop (outside modal)
6. **Expected:** Modal closes
7. Click X button
8. **Expected:** Modal closes

### Test 2: Tabs Navigation
1. Open Portal page
2. **Expected:** "Služby" tab active by default (orange underline)
3. **Expected:** Services grid + Poradna Widget visible
4. Click "Projekty (N)" tab
5. **Expected:** Tab switches to orange, content changes to stats + projects
6. **Expected:** Services section hidden
7. Click "Služby" tab again
8. **Expected:** Content switches back to services

### Test 3: Project Count Badge
1. Create 3 projects
2. **Expected:** Tab shows "📁 Projekty (3)"
3. Delete 1 project
4. **Expected:** Tab updates to "📁 Projekty (2)"

## 🎨 Design System Compliance

### Colors:
- `var(--brand-orange)` - Active tab, primary buttons
- `var(--text-primary)` - Headings, labels
- `var(--text-secondary)` - Descriptions, placeholders
- `var(--border-color)` - Tab separator
- `var(--status-error)` - Error messages

### Components:
- `c-panel` - Modal container
- `c-btn c-btn--primary` - Create button
- `c-btn c-btn--secondary` - Cancel button
- `c-btn c-btn--ghost` - Close button
- `c-input` - Text inputs, textarea, select

### Typography:
- Modal title: 20px, font-weight 700
- Labels: 14px, font-weight 600
- Descriptions: 12px, color secondary

## 🚀 Deployment

### No Backend Changes
Frontend-only changes, no API modifications.

### No Database Changes
No migrations required.

### No Breaking Changes
- Existing functionality preserved
- All modals still work
- Project creation flow unchanged
- Only UI/UX improvements

### Build & Deploy:
```bash
cd stavagent-portal/frontend
npm run build
# Deploy to Vercel (automatic via GitHub)
```

## 📝 Notes

### Future Improvements:
1. Add keyboard shortcuts (Ctrl+1 for Služby, Ctrl+2 for Projekty)
2. Remember last active tab in localStorage
3. Add tab transition animations
4. Consider adding more tabs (Dokumenty, Nastavení)

### Design Consistency:
All Portal components now use design system:
- ✅ CreateProjectModal
- ✅ ProjectCard
- ✅ ServiceCard
- ✅ CorePanel
- ✅ PortalPage tabs

## ✅ Checklist

- [x] Modal redesigned to design system
- [x] Tabs implemented with active state
- [x] Project count badge working
- [x] Czech localization complete
- [x] Backdrop click-to-close working
- [x] No breaking changes
- [x] Design system compliance verified

## 🔗 Related

- Design System: `stavagent-portal/frontend/src/styles/design-system/`
- Previous work: Time Norms Automation, Formwork Calculator

## 👥 Reviewers

@alpro1000

---

**Type:** Feature (UI/UX Improvement)  
**Priority:** Medium  
**Impact:** User-facing (Portal UI)  
**Breaking Changes:** None  
**Lines Changed:** +468, -61
