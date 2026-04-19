# AUDIT: Дизайн-система STAVAGENT — текущее состояние

**Дата:** 2026-04-06
**Метод:** Статический анализ кода (READ ONLY, 4 параллельных агента)
**Покрытие:** 4 kiosks + Core Engine frontend

---

## 1. Portal (stavagent.cz)

### Шрифты
| Шрифт | Источник | Веса | Использование |
|-------|----------|------|---------------|
| Inter | Google Fonts | 400, 500, 600, 700 | Основной текст |
| JetBrains Mono | Google Fonts | 500, 600 | Код, технические данные |
| Roboto Mono | Google Fonts | 400, 500, 600 | Fallback моноширинный |

**CSS переменные:** `--font-body: Inter`, `--font-mono: JetBrains Mono`

### Цвета (CSS переменные — Light theme)
```
Поверхности:
  --bg-textured:     #B0B2B5  (фон страницы с SVG noise)
  --panel-clean:     #EAEBEC  (панели/карточки)
  --data-surface:    #F5F6F7  (таблицы, данные)

Текст:
  --text-primary:    #1A1C1E
  --text-secondary:  #4A4D50
  --text-muted:      #7A7D80

Акцент:
  --accent-orange:   #FF9F1C  (кнопки, ссылки, фокус)

Статусы:
  --status-success:  #4CAF50
  --status-warning:  #FFC107
  --status-error:    #F44336
  --status-info:     #2196F3

Границы:
  --edge-light:      rgba(255,255,255,0.5)
  --edge-dark:       rgba(0,0,0,0.1)
  --divider:         rgba(0,0,0,0.08)
```

**Дополнительно:** secondary color system в global.css (`--bg-primary: #F5F5F5`, `--color-success: #6B8E6B` — приглушённые тона).

### Компоненты
| Компонент | Стиль |
|-----------|-------|
| **Кнопки** | `.c-btn` gradient bg, min-h 44px, radius-md. Primary=orange glow. Hover: translateY(-2px) |
| **Inputs** | `.c-input` white bg, 44px height, orange focus с 2px glow halo |
| **Панели** | `.c-panel` gradient 145deg, radius-xl, neumorphic shadow, 24px padding |
| **Таблицы** | `.c-table` data-surface bg, inset shadow, alternating rows, orange hover highlight |
| **Бейджи** | `.c-badge` 4px 10px padding, radius-sm. Варианты: success/warning/error/info/orange |
| **Модалы** | `.c-panel` based, rgba(0,0,0,0.7) overlay |
| **Tabs** | `.c-tabs` inset bg, active=orange text+glow, border-top |
| **Header** | `.c-header` gradient bg, 36px title, shadow-panel |
| **Sidebar** | 240px, bg-secondary, collapses to 70px |
| **Theme toggle** | Fixed bottom-right, panel gradient |

### Иконки
`lucide-react` v0.263.1

### CSS архитектура
**Plain CSS + CSS Modules** (no Tailwind). BEM-like: `.c-component--modifier`.
- `tokens.css` — design tokens (311 строк)
- `components.css` — компоненты (2530 строк)
- `global.css` — base styles (280 строк)
- `DocumentAnalysis.module.css` — CSS Module

### Тема
Light (default) + Dark (`[data-theme="dark"]`). "Digital Concrete" — 3-level texture hierarchy.

### Анимации
`slideIn` (0.3s), `fadeIn` (0.3s), `tooltipSlide` (0.2s), `pulse` (1.5s)

---

## 2. Registry (registry.stavagent.cz)

### Шрифты
| Шрифт | Источник | Веса | Использование |
|-------|----------|------|---------------|
| Inter | Google Fonts | 400, 500, 600, 700 | Основной текст |
| JetBrains Mono | Google Fonts | 500, 600 | Код, числа |

### Цвета
**Те же tokens.css что и Portal** (Digital Concrete v2.0):
```
--bg-textured:     #B0B2B5
--panel-clean:     #EAEBEC
--accent-orange:   #FF9F1C
--text-primary:    #1A1C1E
```
Полное совпадение с Portal — **один и тот же файл tokens.css**.

### Компоненты
| Компонент | Стиль |
|-----------|-------|
| **Кнопки** | `.btn` + `.btn-primary` (orange bg), radius-md |
| **Inputs** | `.input` data-surface bg, orange focus с 3px glow |
| **Таблицы** | `.table` separate spacing, 13px header, alternating rows |
| **Модалы** | `.modal-backdrop` rgba(0,0,0,0.85) + blur(2px). Content=panel-clean bg, radius-lg |
| **Бейджи** | Tailwind inline: `bg-green-50`, `bg-red-100`, etc. |
| **Bulk toolbar** | Fixed bottom, orange bg (#FF9F1C), white text |
| **Resize handle** | 4px wide, orange glow on hover |

### Иконки
`lucide-react` v0.562.0

### CSS архитектура
**Tailwind CSS v3.4.19 + CSS Variables (tokens.css)**. Hybrid approach.
- `tokens.css` — design tokens (тот же что Portal)
- `index.css` — Tailwind directives + @layer component adaptations
- Inline Tailwind classes в JSX

### Тема
Light + Dark. "Digital Concrete" metaphor (concrete texture SVG noise).

---

## 3. Monolit Part A (kalkulator.stavagent.cz)

### Шрифты
| Шрифт | Источник | Веса | Использование |
|-------|----------|------|---------------|
| **DM Sans** | **Bunny Fonts** (GDPR) | 400, 500, 600 | Основной текст |
| JetBrains Mono | Bunny Fonts | 400, 500 | Числа, коды |

**⚠️ КОНФЛИКТ:** DM Sans (Part A) vs Inter (Portal/Registry)

### Цвета
```
Stone palette (НОВАЯ, отличается от Portal):
  --stone-50:   #FAFAF9
  --stone-100:  #F5F5F4
  --stone-200:  #E7E5E4
  --stone-300:  #D6D3D1
  --stone-400:  #A8A29E
  --stone-500:  #78716C
  --stone-600:  #57534E
  --stone-700:  #44403C
  --stone-800:  #292524
  --stone-900:  #1C1917

Акцент:
  --orange-500: #F97316  (≠ Portal #FF9F1C!)
  --orange-100: #FFF7ED

Semantic aliases:
  --flat-bg:       #FAFAF9
  --flat-surface:  #FFFFFF
  --flat-hover:    #F5F3F0
  --flat-selected: #EDEBE8
  --flat-accent:   #F97316
```

**⚠️ КОНФЛИКТ:** Orange `#F97316` (Part A) vs `#FF9F1C` (Portal/Registry)

### Компоненты
| Компонент | Стиль |
|-----------|-------|
| **Header** | `.app-header` 44px, stone-200 bg, stone-300 border |
| **Sidebar** | `.sb` stone-200 bg, white active item + orange border-left |
| **KPI** | `.kpi-card` 4 cards, colored left borders (blue/amber/green/violet), max-h 80px |
| **Settings** | `.pset` white bg, gear marker, segment toggle (dark active) |
| **Table** | `.flat-table` white bg, 32px rows, stone-200 borders |
| **Info row** | `.flat-el-info` stone-100 bg, flex metrics |
| **Work rows** | `.flat-work-row` white, 32px, 16px left padding |
| **Badges** | `.flat-badge--*` beton=stone, bednění=orange, výztuž=blue, zrání=indigo |
| **Editable cells** | `.flat-ecell` mono, click-to-edit, orange focus, shake on error |
| **Modals** | `.flat-modal` white, radius 12px, shadow 0 8px 30px |
| **Tooltips** | `.flat-tooltip` stone-800 bg, white text, 12px mono |
| **Gantt** | `.flat-gantt__bar` beton=stone-500, bednění=orange, výztuž=blue |

### Иконки
`lucide-react` v0.562.0

### CSS архитектура
**Plain CSS** — один большой файл `flat-design.css` (~34KB).
- `flat-design.css` — PRIMARY (новый Part A)
- `tokens.css` — legacy (Digital Concrete, для Part B)
- `components.css` — legacy (для Part B)
- NO Tailwind

### Тема
Light only (dark mode определён в legacy tokens.css но НЕ используется в flat-design.css).

---

## 4. Monolit Part B (Kalkulátor betonáže, /planner)

### Шрифты
| Шрифт | Источник | Веса | Использование |
|-------|----------|------|---------------|
| JetBrains Mono | Наследуется | 400, 500 | **ВСЁ приложение** — monospace-first! |

**⚠️ КОНФЛИКТ:** Part B = monospace (JetBrains Mono) для всего. Part A = DM Sans (sans-serif).

### Цвета
```
R0 palette (Tailwind Slate):
  --r0-slate-50:  #f8fafc
  --r0-slate-100: #f1f5f9
  --r0-slate-300: #cbd5e1
  --r0-slate-500: #64748b
  --r0-slate-700: #334155
  --r0-slate-900: #0f172a

  --r0-orange:    #f97316  (совпадает с Part A!)
  --r0-blue:      #3b82f6
  --r0-green:     #22c55e
  --r0-red:       #ef4444
  --r0-amber:     #f59e0b
  --r0-purple:    #8b5cf6
```

### Компоненты
| Компонент | Стиль |
|-----------|-------|
| **Header** | `.r0-header` sticky, dark slate bg |
| **Layout** | `.r0-planner-layout` sidebar 380px + main |
| **Buttons** | `.r0-btn-primary` orange, `.r0-btn-secondary` white+border |
| **Forms** | `.r0-form-group` uppercase 0.75rem labels |
| **Grids** | `.r0-grid-2/3/4` responsive columns |
| **Gantt** | Phase-colored bars (blue/amber/red/lime/purple) |

### Иконки
`lucide-react` (наследуется из package.json)

### CSS архитектура
**r0.css ONLY** — изолирован от Part A. Не импортирует flat-design.css, tokens.css.
100+ inline `style={}` атрибутов для динамических значений.

---

## 5. MD-файлы: что описано vs что реально

| Файл | Описанные стили | Совпадение с кодом |
|------|-----------------|-------------------|
| `/DESIGN_SYSTEM.md` | Brutalist Neumorphism, orange #FF9F1C, concrete palette, shadows | ✅ Совпадает с Portal и Registry tokens.css |
| `/Monolit-Planner/ARCHITECTURE_R0.md` | R0 engine архитектура | N/A — не про дизайн |
| `/Monolit-Planner/README.md` | Responsive layout, concrete-themed | ⚠️ Частично — Part A переписан на flat design |
| `/CLAUDE.md` | DM Sans, Stone palette, flat design | ✅ Совпадает с Part A flat-design.css |

**Критический пробел:** Нет MD-документации для R0 дизайн-системы (Part B). Токены описаны только в коде r0.css.

---

## 6. Конфликты и расхождения

### A. Шрифты

| Аспект | Portal | Registry | Part A | Part B |
|--------|--------|----------|--------|--------|
| Body font | Inter | Inter | **DM Sans** | **JetBrains Mono** |
| Mono font | JetBrains Mono | JetBrains Mono | JetBrains Mono | JetBrains Mono |
| Источник | Google Fonts | Google Fonts | **Bunny Fonts** | Наследует |

**Конфликт:** 3 разных body font across kiosks.

### B. Акцентный цвет

| Kiosk | Orange hex | Разница |
|-------|-----------|---------|
| Portal | `#FF9F1C` | — |
| Registry | `#FF9F1C` | ✅ совпадает |
| Part A | `#F97316` | ❌ **отличается** (Tailwind orange-500) |
| Part B | `#f97316` | ❌ **тот же что Part A** |

**Конфликт:** Portal/Registry = `#FF9F1C`, Monolit = `#F97316`. Разница видна: #FF9F1C теплее, #F97316 ярче.

### C. Палитра

| Аспект | Portal/Registry | Part A | Part B |
|--------|----------------|--------|--------|
| Palette name | Digital Concrete (gray) | Stone (warm gray) | Slate (cool gray) |
| Page bg | #B0B2B5 (medium gray) | #FAFAF9 (near white) | #f8fafc (very light) |
| Card bg | #EAEBEC | #FFFFFF | — |
| Text primary | #1A1C1E | #1C1917 | #334155 |
| Shadow style | Neumorphic (multi-layer) | Minimal (single layer) | None |
| Texture | SVG noise overlay | None | None |

### D. CSS архитектура

| Kiosk | Approach | Framework |
|-------|----------|-----------|
| Portal | Plain CSS + CSS Modules | None |
| Registry | Tailwind + CSS Variables | Tailwind v3.4 |
| Part A | Plain CSS (single file) | None |
| Part B | Plain CSS (r0.css) | None |

### E. Dark mode

| Kiosk | Dark mode | Status |
|-------|-----------|--------|
| Portal | ✅ Полный (tokens.css) | Активный, с toggle |
| Registry | ✅ Полный (tokens.css) | Активный |
| Part A | ❌ Нет в flat-design.css | Legacy dark mode в tokens.css (не используется) |
| Part B | ⚠️ CSS определён | Не активен в UI |

### F. Компоненты — одинаковые элементы, разный стиль

| Компонент | Portal | Registry | Part A |
|-----------|--------|----------|--------|
| Button primary | Gradient + glow text | Orange bg flat | Orange bg flat |
| Modal backdrop | rgba(0,0,0,0.7) | rgba(0,0,0,0.85) + blur | rgba(0,0,0,0.3) |
| Table row height | ~48px (14px+16px pad) | ~44px | 32px |
| Badge radius | radius-sm (4px) | Tailwind rounded | 4px |
| Input focus | Orange + 2px glow | Orange + 3px glow | Orange border only |

---

## 7. Рекомендации

### Что взять за основу
- **Шрифт:** DM Sans (Part A) — современный, чистый. Или Inter (Portal/Registry) — уже в 2 kiosks.
- **Палитра:** Stone (Part A) — тёплая, нейтральная. Digital Concrete (Portal) — индустриальная.
- **Orange:** Выбрать ОДИН: `#FF9F1C` (Portal, теплее) или `#F97316` (Part A, ярче Tailwind).
- **CSS arch:** Plain CSS + CSS Variables (общий tokens файл). Tailwind только в Registry.

### Что менять
1. **Унифицировать шрифт** — один body font для всех kiosks
2. **Унифицировать orange** — один hex для акцента
3. **Общий tokens.css** — вынести в shared/ и импортировать во все kiosks
4. **Part B шрифт** — заменить monospace-only на общий sans + mono для чисел
5. **Modal backdrop** — один стиль (рекомендую rgba(0,0,0,0.5))

### Что оставить
- Part A flat design (stone palette) — уже самый чистый и современный
- Part B r0.css — изолированный, работает, трогать после Part A стабилизации
- Registry Tailwind — работает, можно унифицировать tokens позже
- Dark mode — отложить до унификации light theme

### Минимальный план унификации
1. Создать `shared/design-tokens.css` с общими переменными
2. Выбрать один orange, один body font
3. Подключить shared tokens в каждый kiosk
4. Каждый kiosk может добавлять свои tokens поверх
5. Part B — последний (после стабилизации Part A + Portal)

---

**Аудит завершён. Ни один файл не изменён.**
