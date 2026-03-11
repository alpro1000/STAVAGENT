# STAVAGENT Design System

**Digital Concrete** — Brutalist Neumorphism

**Version:** 1.0.0
**Date:** 2025-12-26
**Status:** ✅ Active

---

## 🎨 Philosophy

> "Элементы интерфейса = бетонные блоки"

Интерфейс имитирует физические бетонные панели с эффектом экструзии. При взаимодействии элементы **физически вдавливаются** в поверхность.

### Core Principles

1. **Монохромная палитра** — серые оттенки бетона
2. **Один акцент** — оранжевый (#FF9F1C) для CTA
3. **Мягкие тени** — двусторонние (neumorphism)
4. **Физичность** — элементы реагируют как реальные объекты
5. **Минимализм** — никаких градиентов, бордеров, лишних декораций

---

## 📦 Installation

### Import in your app:

```tsx
// In your main.tsx or App.tsx
import './styles/design-system/tokens.css';
import './styles/design-system/components.css';
```

---

## 🎨 Design Tokens

### Colors

```css
/* Surfaces */
--app-bg-concrete: #C9CBCD;      /* App background */
--panel-bg-concrete: #CFD1D3;    /* Panels, buttons, cards */
--panel-bg-dark: #B8BABC;        /* Dark panels, sidebar */
--input-bg: #D5D7D9;             /* Input fields */

/* Text */
--text-primary: #2F3133;         /* Primary text */
--text-secondary: #5A5D60;       /* Secondary text */
--text-disabled: #8A8D90;        /* Disabled state */

/* Accent */
--brand-orange: #FF9F1C;         /* CTA, important numbers */
--brand-orange-hover: #FFB347;
--brand-orange-active: #E88A00;

/* Status */
--status-success: #4CAF50;
--status-warning: #FFC107;
--status-error: #F44336;
--status-info: #2196F3;
```

### Shadows

```css
/* Elevation (выпуклые) */
--elevation-low: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
--elevation-medium: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light);
--elevation-high: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);

/* Depression (вдавленные) */
--depressed-inset: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
--depressed-deep: inset 5px 5px 10px var(--shadow-dark), inset -5px -5px 10px var(--shadow-light);
```

---

## 🧩 Components

### Button

```tsx
// Primary CTA button
<button className="c-btn c-btn--primary">
  Submit
</button>

// Success button
<button className="c-btn c-btn--success">
  Save
</button>

// Small button
<button className="c-btn c-btn--sm">
  Close
</button>
```

**States:**
- Default → `elevation-low` (выпуклая)
- Hover → `scale(1.02)` + `elevation-medium`
- Active → `depressed-inset` (вдавленная) + `translateY(1px)`
- Focus → Orange ring 2px

### Input

```tsx
<input
  type="text"
  className="c-input"
  placeholder="Enter text..."
/>

// Error state
<input
  type="text"
  className="c-input c-input--error"
/>
```

**States:**
- Default → `depressed-inset` (вдавленная)
- Focus → `depressed-inset` + orange ring

### Panel / Card

```tsx
// Regular panel (elevated)
<div className="c-panel">
  Content here
</div>

// Inset panel (depressed)
<div className="c-panel c-panel--inset">
  Results here
</div>

// Interactive card
<div className="c-card">
  Clickable card
</div>
```

### Tabs

```tsx
<div className="c-tabs">
  <button className="c-tab is-active">Tab 1</button>
  <button className="c-tab">Tab 2</button>
  <button className="c-tab">Tab 3</button>
</div>
```

### Badge

```tsx
<span className="c-badge c-badge--success">
  Active
</span>

<span className="c-badge c-badge--orange">
  42
</span>
```

---

## 📐 Layout

### Container

```tsx
<div className="c-container">
  <!-- Max-width: 1280px, centered -->
</div>

<div className="c-container c-container--wide">
  <!-- Max-width: 1600px -->
</div>
```

### Grid

```tsx
<!-- 2-column responsive grid -->
<div className="c-grid c-grid--2">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- 3-column grid -->
<div className="c-grid c-grid--3">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

---

## 🎯 Color Usage Rules

| Element | Color |
|---------|-------|
| CTA buttons (text) | `--brand-orange` |
| Important numbers/results | `--brand-orange` |
| Regular text | `--text-primary` |
| Labels, meta | `--text-secondary` |
| Success status | `--status-success` |
| Warning status | `--status-warning` |
| Error status | `--status-error` |
| Backgrounds | **ONLY** gray shades |

**NEVER use:**
- ❌ Bright backgrounds for buttons
- ❌ Colored borders
- ❌ Gradients (except progress bars)
- ❌ Hardcoded colors in styles

---

## ✨ Interaction States

### Button

```
Default  → elevation-low (elevated)
Hover    → scale(1.02) + elevation-medium
Active   → depressed-inset + translateY(1px)
Disabled → opacity: 0.6, no shadow
Focus    → orange ring 2px
```

### Input

```
Default  → depressed-inset
Focus    → depressed-inset + orange ring
Error    → depressed-inset + red ring
```

### Card

```
Default → elevation-low
Hover   → elevation-medium + translateY(-2px)
Active  → translateY(0)
```

---

## 🚀 Quick Start Example

```tsx
import './styles/design-system/tokens.css';
import './styles/design-system/components.css';

function MyComponent() {
  return (
    <div className="c-container">
      <div className="c-panel">
        <h2 className="u-text-orange u-mb-md">Title</h2>

        <input
          type="text"
          className="c-input"
          placeholder="Enter value..."
        />

        <div className="u-flex u-gap-md u-mt-lg">
          <button className="c-btn">
            Cancel
          </button>
          <button className="c-btn c-btn--primary">
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🎨 BEM Naming Convention

```
Component:  .c-btn
Modifier:   .c-btn--primary, .c-btn--sm
Element:    .c-btn__icon

Utility:    .u-text-orange, .u-mt-md
```

---

## ♿ Accessibility

- **Focus states:** Always visible orange ring (2px)
- **Contrast:** Minimum 4.5:1 for text
- **Touch targets:** Minimum 44x44px
- **Motion:** Respects `prefers-reduced-motion`

---

## 📚 Resources

- **Tokens:** `/stavagent-portal/frontend/src/styles/design-system/tokens.css`
- **Components:** `/stavagent-portal/frontend/src/styles/design-system/components.css`
- **Examples:** See PortalPage, Monolit-Planner

---

## 🔄 Updating Services

To apply Digital Concrete to existing services:

1. Import tokens and components CSS
2. Replace custom styles with `.c-*` classes
3. Use CSS variables instead of hardcoded colors
4. Follow interaction state rules

---

**Maintained by:** STAVAGENT Team
**Last updated:** 2025-12-26
